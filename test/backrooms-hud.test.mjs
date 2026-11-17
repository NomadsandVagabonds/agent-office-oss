import test from 'node:test';
import assert from 'node:assert/strict';
import { createHud } from '../public/world/backrooms/hud.js';

// Only the HUD's DOM/state contract. Picture layout and its CSS/GLSL effects
// are reviewed in the browser, without installing a DOM or rendering library.
class Element {
  children = []; parent = null; attributes = new Map(); className = ''; id = ''; hidden = false;
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
    this.classList = {
      contains: name => this.className.split(' ').includes(name),
      toggle: (name, on) => { const classes = new Set(this.className.split(' ').filter(Boolean)); if (on) classes.add(name); else classes.delete(name); this.className = [...classes].join(' '); },
      add: (...names) => names.forEach(name => this.classList.toggle(name, true)),
      remove: (...names) => names.forEach(name => this.classList.toggle(name, false)),
    };
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.className = String(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.classList.contains(selector.slice(1)) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(node => node.textContent).join(''); }
}

function setup(t) {
  const before = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = Element;
  const document = globalThis.document = {
    createElement: tag => new Element(tag), createElementNS: (ns, tag) => new Element(tag),
    createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; },
    getElementById: () => null, head: new Element('head'), body: new Element('body'),
  };
  const hud = createHud({ stamp: { hour: 11, minute: 39, month: 'MAR', day: 9, year: 1995 } });
  t.after(() => { hud.remove(); for (const name of ['document', 'Node']) { if (before[name] === undefined) delete globalThis[name]; else globalThis[name] = before[name]; } });
  const warning = hud.el.querySelector('.br-battery-warning'), glyph = hud.el.querySelector('.br-battery-glyph'), count = hud.el.querySelector('.br-battery-count');
  return { hud, document, warning, glyph, count, fill: glyph.children[1] };
}

test('last-ten-second warning shows whole actual seconds and clears when a pack is fitted', t => {
  const { hud, warning, count } = setup(t);
  assert.equal(warning.hidden, true);
  for (const remaining of [300, 10.01, 0, -1, NaN, null, undefined]) { hud.batteryWarning(remaining); assert.equal(warning.hidden, true); }
  hud.batteryWarning(10); assert.equal(warning.hidden, false); assert.equal(count.textContent, '10');
  hud.batteryWarning(9.2); assert.equal(count.textContent, '10');
  hud.batteryWarning(9); assert.equal(count.textContent, '9');
  hud.batteryWarning(.1); assert.equal(count.textContent, '1'); assert.match(warning.getAttribute('aria-label'), /1 second remaining/);
  hud.battery({ remaining: 120.1, capacity: 400 });
  assert.equal(warning.hidden, true); assert.equal(count.textContent, ''); assert.equal(warning.getAttribute('aria-label'), null);
});

test('battery exhaustion leaves only the empty glyph, immune to ordinary warning or charge refreshes', t => {
  const { hud, warning, count, fill } = setup(t);
  hud.batteryWarning(1); assert.equal(fill.getAttribute('visibility'), 'visible');
  hud.batteryEnding({ opacity: 1 });
  assert.equal(hud.el.classList.contains('is-battery-ending'), true);
  assert.equal(warning.hidden, false); assert.equal(count.hidden, true); assert.equal(fill.getAttribute('visibility'), 'hidden');
  assert.equal(warning.getAttribute('aria-label'), 'Camera battery empty');
  hud.batteryWarning(null); hud.battery({ remaining: 0, capacity: 400 });
  assert.equal(warning.hidden, false); assert.equal(fill.getAttribute('visibility'), 'hidden');
  hud.batteryEnding({ opacity: .5 }); assert.equal(warning.style.opacity, '0.5');
  hud.batteryEnding({ opacity: 0 }); assert.equal(warning.style.opacity, '0');
});

test('warning belongs to the actual picture and remains available in clean and touch modes', t => {
  const { hud, warning, document } = setup(t);
  hud.layout({ x: 0, y: 110, w: 390, h: 292.5 }); hud.setClean(true); hud.setTouch(true); hud.batteryWarning(7);
  assert.equal(warning.parent, hud.el.querySelector('.br-frame'));
  assert.equal(warning.classList.contains('br-osd'), false, 'clean mode hides regular OSD only');
  assert.equal(hud.el.style['--ph'], '292.5px'); assert.equal(warning.hidden, false);
  hud.setPaused(true); assert.equal(hud.el.classList.contains('is-paused'), true);
  hud.setPaused(false); assert.equal(warning.hidden, false);
  hud.remove(); assert.equal(document.head.children.length, 0); assert.equal(document.body.children.length, 0);
});

test('a finger gets a thumb stick and four buttons; a mouse gets none; and the picture moves up for a phone held upright', t => {
  const { hud, document } = setup(t);
  assert.equal(hud.thumbs, null, 'nothing is made for a finger until there is one');
  assert.equal(hud.pictureTop({ w: 390, h: 844 }), null);
  hud.layout({ x: 162, y: 0, w: 520, h: 390 }, { w: 844, h: 390 });
  hud.hint(true);
  hud.setTouch(true);
  const thumbs = hud.thumbs, find = name => hud.el.querySelector(`.br-tb-${name}`);
  assert.ok(thumbs && hud.el.querySelector('.br-thumbs') && hud.el.querySelector('.br-stick-ring'));
  for (const name of ['use', 'light', 'jump', 'crouch']) assert.equal(find(name).getAttribute('data-act'), name);
  assert.equal(find('use').hidden, false); assert.equal(find('use').classList.contains('is-ready'), true, 'there was already something to use when the finger arrived');
  assert.equal(find('light').hidden, true, 'no light to switch yet');
  // the hand is always there for a finger (with nothing to use it is a shove: index.js useIt); only how plainly it shows changes
  hud.hint(false); assert.equal(find('use').hidden, false); assert.equal(find('use').classList.contains('is-ready'), false);
  hud.hint(true); assert.equal(find('use').hidden, false); assert.equal(find('use').classList.contains('is-ready'), true);
  thumbs.set({ light: 'off' }); assert.equal(find('light').hidden, false); assert.equal(find('light').classList.contains('is-on'), false);
  thumbs.set({ light: 'on' }); assert.equal(find('light').classList.contains('is-on'), true);
  thumbs.set({ light: 'none' }); assert.equal(find('light').hidden, true);
  thumbs.set({ crouched: true }); assert.equal(find('crouch').classList.contains('is-on'), true);
  // laid out for the screen it was given: the ring in the bar on the left, the buttons in the bar on the right
  assert.ok(thumbs.zone && thumbs.reach > 40);
  assert.ok(parseFloat(hud.el.querySelector('.br-stick').style.left) < 162 && parseFloat(find('jump').style.left) > 682);
  // sideways the picture stays in the middle; upright it goes to the top; and with a mouse back in the hand, to the middle again
  assert.equal(hud.pictureTop({ w: 844, h: 390 }), null);
  assert.ok(hud.pictureTop({ w: 390, h: 844 }) >= 0);
  hud.setTouch(false);
  assert.equal(hud.pictureTop({ w: 390, h: 844 }), null);
  assert.equal(hud.thumbs, thumbs, '(what was made is kept: the next finger does not make another)');
  hud.setTouch(true); assert.equal(hud.el.querySelectorAll('.br-thumbs').length, 1);
  hud.remove(); assert.equal(document.head.children.length, 0);
});
