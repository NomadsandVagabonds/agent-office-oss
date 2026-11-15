import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The browser resolves /core/ through its import map. Give the same module
// its local files here, and a small DOM so the dismissal contract is tested.
const source = readFileSync(new URL('../public/world/backrooms/scorecard.js', import.meta.url), 'utf8')
  .replaceAll("'/core/runs.mjs'", JSON.stringify(new URL('../core/runs.mjs', import.meta.url).href))
  .replaceAll("'/core/game.mjs'", JSON.stringify(new URL('../core/game.mjs', import.meta.url).href));
const { showScorecard } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class Surface {
  listeners = new Map();
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(value => value !== fn)); }
  emit(type, data = {}) {
    const event = { type, target:this, key:'', button:0, repeat:false, stopped:false, defaultPrevented:false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...data };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
}

class Element extends Surface {
  children = []; parent = null; attributes = new Map(); className = ''; disabled = false;
  constructor(tag, document) { super(); this.tagName = tag.toUpperCase(); this.document = document; }
  append(...children) { for (const child of children) { if (child instanceof Element) child.parent = this; this.children.push(child); } }
  setAttribute(key, value) { this.attributes.set(key, value); if (key === 'class') this.className = value; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  contains(target) { return target === this || this.children.some(child => child instanceof Element && child.contains(target)); }
  focus() { this.document.activeElement = this; }
  get isConnected() { return !!this.parent || this === this.document.body || this === this.document.head; }
  matches(selector) {
    if (selector === 'a[href]') return this.tagName === 'A' && !!this.href;
    if (selector === 'button:not(:disabled)') return this.tagName === 'BUTTON' && !this.disabled;
    const [tag, cls] = selector.split('.');
    return (!tag || tag.toUpperCase() === this.tagName) && (!cls || this.className.split(' ').includes(cls));
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => child instanceof Element
      ? [...(selector.split(',').some(part => child.matches(part.trim())) ? [child] : []), ...child.querySelectorAll(selector)] : []);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

async function setup(t, { standalone = true, tape = false, anew = false, reason, run = {} } = {}) {
  t.mock.timers.enable({ apis:['setTimeout'] });
  const previous = { document:globalThis.document, window:globalThis.window };
  const document = globalThis.document = {}, window = globalThis.window = new Surface();
  document.createElement = tag => new Element(tag, document);
  document.createElementNS = (_ns, tag) => new Element(tag, document);
  document.body = document.createElement('body'); document.head = document.createElement('head');
  const card = { reason:reason || (tape ? 'exit' : 'quit'), score:123, lines:[], tape:{ kept:tape, seed:'held-tape' } };
  const result = showScorecard({ office:{ game:{ report:async () => card } }, reason:card.reason, run,
    ...(standalone ? { home:{ label:'Return to homepage' } } : {}), ...(anew ? { anew:{ label:'Go back in' } } : {}), share:seed => `./play?tape=${seed}` });
  await Promise.resolve();
  let settled = false; result.then(() => { settled = true; });
  t.after(() => { for (const name of ['document', 'window']) if (previous[name] === undefined) delete globalThis[name]; else globalThis[name] = previous[name]; });
  const veil = document.body.querySelector('.brc-veil'), form = veil.querySelector('.brc-form');
  return { document, window, card, result, veil, form, home:veil.querySelector('button.brc-home'), anew:veil.querySelector('button.brc-anew'),
    number:veil.querySelector('a.brc-seed'), get settled() { return settled; } };
}

test('the standalone score waits for its explicit return action, not a carried-over key or background click', async t => {
  const h = await setup(t);
  assert.equal(h.home.disabled, true);
  h.home.emit('click'); await Promise.resolve(); assert.equal(h.settled, false);
  t.mock.timers.tick(900); assert.equal(h.home.disabled, false);
  for (const key of ['Escape', 'w', 'Enter', ' ']) h.window.emit('keydown', { key, repeat:true, target:h.home });
  h.window.emit('keydown', { key:'Escape' }); h.veil.emit('pointerup', { target:h.form });
  await Promise.resolve(); assert.equal(h.settled, false); assert.ok(h.document.body.contains(h.veil));
  h.home.emit('click'); assert.equal(await h.result, h.card);
  assert.equal(h.document.body.children.length, 0); assert.equal(h.document.head.children.length, 0);
  assert.equal(h.window.listeners.get('keydown').length, 0);
});

test('the standalone score traps tab focus and allows native Enter and Space activation of the return button', async t => {
  const h = await setup(t); t.mock.timers.tick(900);
  assert.equal(h.document.activeElement, h.form);
  assert.equal(h.window.emit('keydown', { key:'Tab' }).defaultPrevented, true);
  assert.equal(h.document.activeElement, h.home);
  for (const key of ['Enter', ' ']) {
    const event = h.window.emit('keydown', { key, target:h.home });
    assert.equal(event.defaultPrevented, false, 'the browser may activate the button');
    assert.equal(event.stopped, true, 'the office underneath must not hear this key');
  }
  h.home.emit('click'); await h.result;
});

test('a kept tape remains a replay action beside Return to homepage', async t => {
  const h = await setup(t, { tape:true }); t.mock.timers.tick(900);
  h.window.emit('keydown', { key:'Tab', shiftKey:true }); assert.equal(h.document.activeElement, h.home);
  h.window.emit('keydown', { key:'Tab' }); assert.equal(h.document.activeElement, h.number);
  h.number.emit('click'); assert.equal((await h.result).again, 'held-tape');
});

test('the Office card retains its any-key return behavior', async t => {
  const h = await setup(t, { standalone:false }); assert.equal(h.home, null);
  t.mock.timers.tick(900); h.window.emit('keydown', { key:'Escape' });
  assert.equal(await h.result, h.card);
});

test('Go back in asks for a building nobody has had, and only once the card has been seen', async t => {
  const h = await setup(t, { anew:true });
  assert.equal(h.anew.disabled, true); assert.match(h.home.className, /quiet/, 'the way home stands quietly beside it');
  h.anew.emit('click'); await Promise.resolve(); assert.equal(h.settled, false);
  t.mock.timers.tick(900); assert.equal(h.anew.disabled, false);
  for (const key of ['Escape', 'Enter', ' ']) h.window.emit('keydown', { key, repeat:true, target:h.anew });
  await Promise.resolve(); assert.equal(h.settled, false, 'a key carried over from play does not put it down');
  h.anew.emit('click');
  const card = await h.result;
  assert.equal(card.anew, true); assert.equal(card.again, undefined);
  assert.equal(h.document.body.children.length, 0);
});

test('with Go back in offered, Return to homepage still goes home and a kept tape is still a replay', async t => {
  const h = await setup(t, { anew:true }); t.mock.timers.tick(900);
  h.home.emit('click'); const card = await h.result;
  assert.equal(card.anew, undefined); assert.equal(card.again, undefined);
  t.mock.timers.reset();
  const k = await setup(t, { anew:true, tape:true }); t.mock.timers.tick(900);
  k.number.emit('click'); assert.equal((await k.result).again, 'held-tape');
});

test('the wall does not say how it ended, or which pattern it is: only what was done, and whose it is', async t => {
  const h = await setup(t, { reason:'battery', run:{ parts:{ reached:2, of:4 } } }); t.mock.timers.tick(900);
  const text = (node) => node.children.map(child => typeof child === 'string' ? child : text(child)).join(' ');
  assert.equal(h.veil.querySelector('.brc-ended'), null);
  assert.doesNotMatch(text(h.form), /battery flat|part 2 of 4|PATTERN/i);
  assert.match(h.form.attributes.get('aria-label'), /battery flat/, 'it is still read out');
  h.home.emit('click'); await h.result;
});
