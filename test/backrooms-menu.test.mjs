import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Resolve the browser import-map root to the same local core module in Node.
const source = readFileSync(new URL('../public/world/backrooms/menu.js', import.meta.url), 'utf8')
  .replace("'/core/backrooms-settings.mjs'", JSON.stringify(new URL('../core/backrooms-settings.mjs', import.meta.url).href))
  .replace("'../ui/dom.js'", JSON.stringify(new URL('../public/world/ui/dom.js', import.meta.url).href))
  .replace("'./menu-style.js'", JSON.stringify(new URL('../public/world/backrooms/menu-style.js', import.meta.url).href));
const { createMenu } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

// Only the DOM's event and focus contract: layout and native widgets are
// checked in the browser. This catches a menu letting Esc or Tab leak out.
class Element {
  children = []; parent = null; listeners = new Map(); attributes = new Map();
  className = ''; hidden = false; disabled = false; checked = false; value = ''; id = ''; type = ''; tabIndex = -1;
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc;
    this.classList = { toggle: (name, on) => { const set = new Set(this.className.split(' ').filter(Boolean)); if (on) set.add(name); else set.delete(name); this.className = [...set].join(' '); } };
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter(f => f !== fn)); }
  emit(type, values = {}) {
    const event = { type, target: this, key: '', defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...values };
    for (const fn of this.listeners.get(type) || []) fn(event);
    return event;
  }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  focus() { this.doc.activeElement = this; }
  blur() { this.doc.activeElement = this.doc.body; }
  get isConnected() { return this === this.doc.head || this === this.doc.body || !!this.parent?.isConnected; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  matches(selector) {
    if (selector === '[hidden]') return this.hidden;
    if (selector === '[tabindex="0"]') return this.tabIndex === 0;
    const [tag, cls] = selector.split('.');
    return (!tag || this.tagName === tag.toUpperCase()) && (!cls || this.className.split(' ').includes(cls));
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [
    ...(selector.split(',').some(s => child.matches(s.trim())) ? [child] : []), ...child.querySelectorAll(selector),
  ]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return (this._text || '') + this.children.map(c => c.textContent).join(''); }
}

function setup(t, settings) {
  const before = { document: globalThis.document, Node: globalThis.Node };
  const document = globalThis.document = {}, Node = globalThis.Node = Element;
  document.createElement = tag => new Node(tag, document);
  document.createTextNode = text => { const node = new Node('#text', document); node.textContent = text; return node; };
  document.head = document.createElement('head'); document.body = document.createElement('body'); document.activeElement = document.body;
  const calls = { open: 0, resume: 0, quit: 0, changed: [] };
  const menu = createMenu({ settings, onRequestOpen: () => calls.open++, onResume: () => calls.resume++, onGiveUp: () => calls.quit++, onChange: (...args) => calls.changed.push(args) });
  t.after(() => { menu.dispose(); for (const name of ['document', 'Node']) { if (before[name] === undefined) delete globalThis[name]; else globalThis[name] = before[name]; } });
  const find = cls => menu.el.querySelector(`.${cls}`), choices = menu.el.querySelectorAll('.br-menu-choice');
  return { document, menu, calls, find, choices };
}

test('pause menu opens only on request, and Esc backs out of a page before resuming', t => {
  const h = setup(t), launcher = h.find('br-menu-launcher'); launcher.focus();
  assert.equal(h.menu.isOpen, false); assert.equal(h.menu.owns(h.document.body), false);
  launcher.emit('click'); assert.equal(h.calls.open, 1); assert.equal(h.menu.isOpen, false);
  h.menu.setOpen(true); assert.equal(h.menu.isOpen, true); assert.equal(h.document.activeElement, h.choices[0]);
  assert.equal(h.menu.owns(h.find('br-menu-overlay')), true);
  h.choices[1].emit('click'); assert.equal(h.find('br-menu-title').textContent, 'Controls');
  assert.equal(h.menu.handleKey({ key: 'Escape', target: h.document.activeElement }), true);
  assert.equal(h.calls.resume, 0); assert.equal(h.find('br-menu-title').textContent, 'Paused');
  h.menu.handleKey({ key: 'Escape', target: h.document.activeElement }); assert.equal(h.calls.resume, 1);
  h.menu.setOpen(false); assert.equal(h.document.activeElement, launcher); assert.equal(h.calls.resume, 1);
  assert.equal(h.menu.owns(h.find('br-menu-overlay')), false);
});

test('settings emit typed values immediately, while restoring preferences emits nothing', t => {
  const h = setup(t, { musicVolume: .35, sfxVolume: .8, sensitivity: 1.25, invertY: true, vhs: 1, mute: true });
  const inputs = h.menu.el.querySelectorAll('input'), music = inputs[0], mute = inputs[2], invert = inputs[4];
  assert.equal(music.value, '0.35'); assert.equal(mute.checked, true); assert.equal(invert.checked, true);
  assert.equal(music.getAttribute('aria-valuetext'), '35%');
  music.value = '0.6'; music.emit('input'); assert.deepEqual(h.calls.changed, [['musicVolume', .6]]);
  mute.checked = false; mute.emit('change'); assert.deepEqual(h.calls.changed.at(-1), ['mute', false]);
  const [picture, difficulty] = h.menu.el.querySelectorAll('select');
  picture.value = '0'; picture.emit('change'); assert.deepEqual(h.calls.changed.at(-1), ['vhs', 0]);
  assert.equal(difficulty.disabled, true);
  h.menu.update({ musicVolume: .1, invertY: false });
  assert.equal(music.getAttribute('aria-valuetext'), '10%'); assert.equal(invert.checked, false); assert.equal(h.calls.changed.length, 3);
  inputs[5].checked = true; inputs[5].emit('change'); assert.deepEqual(h.calls.changed.at(-1), ['steadyLighting', true]);
});

test('native slider keys work, Tab stays in the dialog, and Esc still works from a focused input', t => {
  const h = setup(t); h.menu.setOpen(true); h.choices[2].emit('click');
  const slider = h.document.activeElement;
  assert.equal(slider.type, 'range');
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']) assert.equal(h.menu.handleKey({ key, target: slider }), false);
  assert.equal(h.menu.handleKey({ key: 'w', target: h.document.body }), true);
  h.find('br-menu-close').focus();
  assert.equal(h.menu.handleKey({ key: 'Tab', shiftKey: true, target: h.document.activeElement }), true);
  assert.equal(h.document.activeElement, h.find('br-menu-back'));
  h.menu.handleKey({ key: 'Tab', target: h.document.activeElement }); assert.equal(h.document.activeElement, h.find('br-menu-close'));
  slider.focus();
  const escape = h.menu.el.emit('keydown', { key: 'Escape', target: slider });
  assert.equal(escape.defaultPrevented, true); assert.equal(h.find('br-menu-title').textContent, 'Paused'); assert.equal(h.calls.resume, 0);
});

test('Give up needs its own explicit confirmation and can be backed out of with Esc', t => {
  const h = setup(t); h.menu.setOpen(true); h.choices[3].emit('click');
  assert.equal(h.calls.quit, 0); assert.equal(h.find('br-menu-title').textContent, 'Give up?');
  h.menu.handleKey({ key: 'Escape', target: h.document.activeElement });
  assert.equal(h.calls.quit, 0); assert.equal(h.find('br-menu-confirm').hidden, true);
  h.choices[3].emit('click'); h.find('br-menu-confirm-end').emit('click'); assert.equal(h.calls.quit, 1);
});
