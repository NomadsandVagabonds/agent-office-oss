import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../public/world/backrooms/input.js';

class Surface {
  listeners = new Map();
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(listener => listener !== fn)); }
  emit(type, data = {}) {
    const event = { type, target:this, key:'', button:0, pointerType:'mouse', pointerId:1, clientX:200, clientY:200,
      movementX:0, movementY:0, deltaY:0, deltaMode:0, repeat:false, stopped:false, defaultPrevented:false,
      stopPropagation() { this.stopped = true; }, preventDefault() { this.defaultPrevented = true; }, ...data };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, list) => sum + list.length, 0); }
}

function setup(t) {
  const previous = { window:globalThis.window, document:globalThis.document };
  const window = globalThis.window = new Surface(), document = globalThis.document = new Surface();
  window.matchMedia = () => ({ matches:false }); document.activeElement = { tagName:'BODY' }; document.pointerLockElement = null;
  const calls = { sound:0, use:0, menu:0, click:0, lock:0, unlock:0, keys:[], wheels:[] };
  document.exitPointerLock = () => { calls.unlock++; document.pointerLockElement = null; };
  const canvas = { requestPointerLock:() => { calls.lock++; return Promise.resolve(); } }, button = { tagName:'BUTTON' };
  const ui = { blocked:false, intercept:() => false };
  const hud = { use:{}, leave:{}, setTouch() {} };
  const input = createInput({ canvas, hud, stage:{ size:{ w:1000, h:800 } }, sound:{ start:() => calls.sound++ },
    owns:target => target === button, blocked:() => ui.blocked, interceptKey:event => ui.intercept(event),
    key:key => calls.keys.push(key), use:() => calls.use++, menu:() => calls.menu++, click:() => calls.click++, wheel:step => calls.wheels.push(step) });
  t.after(() => {
    input.dispose();
    for (const key of ['window', 'document']) if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
  });
  return { window, document, canvas, button, hud, input, ui, calls };
}

test('UI key interception precedes Escape, world use and key storage; native button keys pass through', t => {
  const h = setup(t); let escapeSteps = 2;
  h.ui.intercept = e => e.key === 'Escape' && escapeSteps > 0 ? (escapeSteps--, true) : ['Tab', 'i', 'q', 'g', '1'].includes(e.key);
  for (const key of ['Tab', 'i', 'q', 'g', '1', 'Escape', 'Escape']) {
    const event = h.window.emit('keydown', { key });
    assert.equal(event.defaultPrevented, true); assert.equal(event.stopped, true);
  }
  assert.equal(h.calls.menu, 0); assert.equal(h.calls.use, 0); assert.equal(h.input.state.keys.size, 0);
  h.window.emit('keydown', { key:'Escape' }); assert.equal(h.calls.menu, 1);
  h.input.clear(); h.ui.blocked = true;
  for (const key of ['Enter', ' ']) for (const type of ['keydown', 'keyup']) {
    const event = h.window.emit(type, { key, target:h.button });
    assert.equal(event.defaultPrevented, false); assert.equal(event.stopped, false);
  }
  assert.equal(h.calls.use, 0); assert.equal(h.input.state.keys.size, 0);
});

test('opening UI clears all pending input and blocks new world gestures', t => {
  const h = setup(t);
  h.window.emit('keydown', { key:'w' });
  h.window.emit('pointerdown', { target:h.canvas });
  h.window.emit('mousemove', { target:h.canvas, movementX:40, movementY:20 });
  h.window.emit('pointerdown', { pointerType:'touch', pointerId:2, clientX:100, clientY:600 });
  h.window.emit('pointermove', { pointerType:'touch', pointerId:2, clientX:160, clientY:570 });
  h.window.emit('wheel', { deltaY:30 });
  assert.ok(h.input.state.dx > 0 && h.input.state.stick.x > 0);
  h.ui.blocked = true; h.input.clear();
  assert.deepEqual({ ...h.input.state, keys:[...h.input.state.keys] }, { keys:[], dx:0, dy:0, stick:{ x:0, y:0 } });
  h.window.emit('keydown', { key:'w' }); h.window.emit('keydown', { key:'Enter' });
  h.window.emit('mousemove', { target:h.canvas, movementX:200, movementY:100 });
  h.window.emit('pointerdown', { pointerType:'touch', pointerId:3, clientX:100, clientY:600 });
  h.window.emit('pointermove', { pointerType:'touch', pointerId:3, clientX:200, clientY:500 });
  h.window.emit('wheel', { deltaY:80 });
  assert.deepEqual({ ...h.input.state, keys:[...h.input.state.keys] }, { keys:[], dx:0, dy:0, stick:{ x:0, y:0 } });
  assert.deepEqual(h.calls.wheels, []); assert.equal(h.calls.use, 0); assert.equal(h.calls.lock, 1);
  h.ui.blocked = false;
  h.window.emit('pointerup', { target:h.canvas }); assert.equal(h.calls.click, 0);
  h.window.emit('wheel', { deltaY:20 }); assert.deepEqual(h.calls.wheels, []);
  h.window.emit('pointerdown', { target:h.canvas }); assert.equal(h.calls.lock, 2);
});

test('Esc opens the menu even when an owned button retained keyboard focus', t => {
  const h = setup(t);
  h.document.activeElement = h.button;
  const event = h.window.emit('keydown', { key:'Escape', target:h.button });
  assert.equal(h.calls.menu, 1); assert.equal(event.defaultPrevented, true);
  h.window.emit('keydown', { key:'Escape', target:h.button, repeat:true });
  assert.equal(h.calls.menu, 1);
});

test('owned touch, pointer and scrolling events reach UI; releases over UI still clear the thumb stick', t => {
  const h = setup(t);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'click', 'wheel', 'touchstart', 'touchmove', 'contextmenu']) {
    const event = h.window.emit(type, { target:h.button, pointerType:'touch', deltaY:80 });
    assert.equal(event.stopped, false, type); assert.equal(event.defaultPrevented, false, type);
  }
  assert.equal(h.calls.lock, 0); assert.equal(h.calls.click, 0); assert.deepEqual(h.calls.wheels, []);
  h.window.emit('pointerdown', { pointerType:'touch', pointerId:2, clientX:100, clientY:600 });
  h.window.emit('pointermove', { pointerType:'touch', pointerId:2, clientX:160, clientY:570 });
  assert.ok(h.input.state.stick.x > 0);
  h.window.emit('pointerup', { target:h.button, pointerType:'touch', pointerId:2 });
  assert.deepEqual(h.input.state.stick, { x:0, y:0 });
  h.window.emit('pointerdown', { target:h.canvas }); h.window.emit('pointercancel', { target:h.canvas });
  assert.equal(h.calls.click, 0);
});

test('late pointer lock is released while UI is open, and disposal removes every listener', t => {
  const h = setup(t);
  h.window.emit('keydown', { key:'w' });
  h.window.emit('pointerdown', { target:h.canvas });
  h.window.emit('mousemove', { target:h.canvas, movementX:20 });
  h.window.emit('blur'); assert.equal(h.input.state.dx, 0); assert.equal(h.input.state.keys.size, 0);
  h.ui.blocked = true; h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  assert.equal(h.calls.unlock, 1); assert.equal(h.document.pointerLockElement, null);
  h.input.dispose(); assert.equal(h.window.listenerCount, 0); assert.equal(h.document.listenerCount, 0);
});

test('Esc with the mouse held never reaches the page: the mouse let go while the page still has the visitor is that Esc, and opens the menu', async t => {
  const h = setup(t), wait = () => new Promise(resolve => setTimeout(resolve, 180));
  h.document.hasFocus = () => true;
  // never held: nothing was let go
  h.document.emit('pointerlockchange'); await wait(); assert.equal(h.calls.menu, 0);
  // held, then let go by the browser (its own answer to Esc)
  h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  h.document.pointerLockElement = null; h.document.emit('pointerlockchange');
  assert.equal(h.calls.menu, 0, 'not at once: another window taking over lets the mouse go too, and says so a moment later');
  await wait(); assert.equal(h.calls.menu, 1);
  // let go because another window took over: not leaving
  h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  h.document.hasFocus = () => false; h.document.pointerLockElement = null; h.document.emit('pointerlockchange');
  await wait(); assert.equal(h.calls.menu, 1);
  // let go because the page was put away
  h.document.hasFocus = () => true; h.document.hidden = true;
  h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  h.document.pointerLockElement = null; h.document.emit('pointerlockchange');
  await wait(); assert.equal(h.calls.menu, 1); h.document.hidden = false;
  // let go by the bag opening, which lets it go on purpose
  h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  h.ui.blocked = true; h.document.pointerLockElement = null; h.document.emit('pointerlockchange');
  await wait(); assert.equal(h.calls.menu, 1); h.ui.blocked = false;
  // taken hold of again before the moment is up: still playing
  h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  h.document.pointerLockElement = null; h.document.emit('pointerlockchange');
  h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  await wait(); assert.equal(h.calls.menu, 1);
  // and nothing is said after the level has gone
  h.document.pointerLockElement = null; h.document.emit('pointerlockchange'); h.input.dispose();
  await wait(); assert.equal(h.calls.menu, 1);
});

test('world keyboard, locked mouse, touch use and wheel controls retain upstream behavior', t => {
  const h = setup(t);
  h.window.emit('keydown', { key:'W' }); assert.equal(h.input.state.keys.has('w'), true);
  h.window.emit('keyup', { key:'W' }); assert.equal(h.input.state.keys.has('w'), false);
  h.window.emit('keydown', { key:'e' }); h.window.emit('keydown', { key:'Enter' });
  h.window.emit('pointerdown', { target:h.hud.use, pointerType:'touch' }); assert.equal(h.calls.use, 3);
  h.document.pointerLockElement = h.canvas;
  h.window.emit('mousemove', { target:h.canvas, movementX:10, movementY:-5 });
  assert.equal(h.input.state.dx, 10); assert.equal(h.input.state.dy, -5);
  h.window.emit('pointerdown', { target:h.canvas }); assert.equal(h.calls.click, 1);
  h.window.emit('wheel', { deltaY:85 }); assert.deepEqual(h.calls.wheels, [1, 1]);
});

test('a pending pointer-lock promise cannot capture the mouse after the visit is disposed', async t => {
  const h = setup(t); let finishLock;
  h.canvas.requestPointerLock = () => new Promise(resolve => { finishLock = resolve; });
  h.window.emit('pointerdown', { target:h.canvas });
  h.input.dispose();
  h.document.pointerLockElement = h.canvas; finishLock(); await Promise.resolve();
  assert.equal(h.document.pointerLockElement, null); assert.equal(h.calls.unlock, 1);
});

test('a deliberate menu release cannot reopen the menu after a quick resume', async t => {
  const h = setup(t);
  h.document.hasFocus = () => true;
  h.document.pointerLockElement = h.canvas; h.document.emit('pointerlockchange');
  h.window.emit('keydown', { key:'w' });
  h.input.release();
  assert.equal(h.input.state.keys.size, 0);
  assert.equal(h.calls.unlock, 1);
  h.document.emit('pointerlockchange');
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(h.calls.menu, 0);
  h.ui.blocked = true; h.input.capture(); assert.equal(h.calls.lock, 0);
  h.ui.blocked = false; h.input.capture(); assert.equal(h.calls.lock, 1);
});
