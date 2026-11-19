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

function setup(t, extra = {}) {
  const previous = { window:globalThis.window, document:globalThis.document };
  const window = globalThis.window = new Surface(), document = globalThis.document = new Surface();
  window.matchMedia = () => ({ matches:false }); document.activeElement = { tagName:'BODY' }; document.pointerLockElement = null;
  const calls = { sound:0, use:0, menu:0, click:0, lock:0, unlock:0, keys:[], wheels:[] };
  document.exitPointerLock = () => { calls.unlock++; document.pointerLockElement = null; };
  const canvas = { requestPointerLock:() => { calls.lock++; return Promise.resolve(); } }, button = { tagName:'BUTTON' };
  const ui = { blocked:false, intercept:() => false };
  const hud = { use:{}, leave:{}, setTouch() {}, ...(extra.hud || {}) };
  const input = createInput({ canvas, hud, stage:{ size:{ w:1000, h:800 } }, sound:{ start:() => calls.sound++ },
    owns:target => target === button, blocked:() => ui.blocked, interceptKey:event => ui.intercept(event), light:extra.light,
    key:key => calls.keys.push(key), use:() => calls.use++, menu:() => calls.menu++, click:() => calls.click++, smash:() => calls.smash = (calls.smash || 0) + 1, wheel:step => calls.wheels.push(step) });
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
  assert.deepEqual({ ...h.input.state, keys:[...h.input.state.keys] }, { keys:[], dx:0, dy:0, stick:{ x:0, y:0 }, hurry:false, firing:false });
  h.window.emit('keydown', { key:'w' }); h.window.emit('keydown', { key:'Enter' });
  h.window.emit('mousemove', { target:h.canvas, movementX:200, movementY:100 });
  h.window.emit('pointerdown', { pointerType:'touch', pointerId:3, clientX:100, clientY:600 });
  h.window.emit('pointermove', { pointerType:'touch', pointerId:3, clientX:200, clientY:500 });
  h.window.emit('wheel', { deltaY:80 });
  assert.deepEqual({ ...h.input.state, keys:[...h.input.state.keys] }, { keys:[], dx:0, dy:0, stick:{ x:0, y:0 }, hurry:false, firing:false });
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

// What a phone has instead of keys (touch.js draws it; here it is a stand-in that remembers what it was told).
function withThumbs(t) {
  const buttons = { use:{}, light:{}, jump:{}, crouch:{} }, told = { stick:[], set:[], down:[], touch:[], light:0 };
  const h = setup(t, { light:() => told.light++, hud:{
    setTouch:on => told.touch.push(on),
    thumbs:{
      zone:{ x0:0, y0:300, x1:400, y1:800 }, reach:50,
      act:target => Object.keys(buttons).find(name => buttons[name] === target) || null,
      stick:s => told.stick.push(s), set:patch => told.set.push(patch), down:(name, on) => told.down.push([name, on]),
    },
  } });
  const touch = (type, pointerId, clientX, clientY, target = h.canvas) => h.window.emit(type, { pointerType:'touch', pointerId, clientX, clientY, target });
  return { ...h, buttons, told, touch };
}

test('a thumb walks, and only runs when it is pushed past the ring on purpose; it goes on running until it is back inside', t => {
  const h = withThumbs(t), s = h.input.state;
  h.touch('pointerdown', 1, 100, 600);
  assert.deepEqual(h.told.stick.at(-1), { x:100, y:600, nx:0, ny:0, run:false }, 'the ring is drawn where the thumb came down');
  h.touch('pointermove', 1, 100, 596);                                   // a thumb at rest
  assert.deepEqual([s.stick.x, s.stick.y, s.hurry], [0, 0, false]);
  h.touch('pointermove', 1, 100, 570);                                   // 30 of 50 px, straight up: forward, at part of a walk
  assert.ok(s.stick.y > 0.4 && s.stick.y < 0.7 && s.stick.x === 0 && !s.hurry);
  h.touch('pointermove', 1, 100, 550);                                   // at the ring: a full walk, and not a run
  assert.deepEqual([s.stick.y, s.hurry], [1, false]);
  h.touch('pointermove', 1, 100, 532);                                   // a little past it: still a walk (the old stick ran from here)
  assert.equal(s.hurry, false);
  h.touch('pointermove', 1, 100, 520);                                   // well past it: running
  assert.deepEqual([s.stick.y, s.hurry], [1, true]);
  assert.equal(h.told.stick.at(-1).run, true); assert.equal(h.told.stick.at(-1).ny, -50, 'the thumb is drawn at the ring, not beyond it');
  h.touch('pointermove', 1, 100, 532);                                   // eased back, but not yet inside: still running
  assert.equal(s.hurry, true);
  h.touch('pointermove', 1, 100, 545);                                   // inside: walking again
  assert.equal(s.hurry, false);
  h.touch('pointermove', 1, 150, 600);                                   // to the right is to the right
  assert.deepEqual([s.stick.x, s.stick.y === 0], [1, true]);
  h.touch('pointerup', 1, 150, 600);
  assert.deepEqual([s.stick, s.hurry], [{ x:0, y:0 }, false]); assert.equal(h.told.stick.at(-1), null, 'and the ring goes back to where it rests');
});

test('one finger walks while another looks; a finger outside the stick\'s part of the screen is never the stick', t => {
  const h = withThumbs(t), s = h.input.state;
  h.touch('pointerdown', 1, 100, 600); h.touch('pointermove', 1, 100, 560);
  h.touch('pointerdown', 2, 700, 300); h.touch('pointermove', 2, 650, 310);
  assert.ok(s.stick.y > 0.5, 'still walking'); assert.ok(s.dx < -100 && s.dy > 0, 'and looking, further than a mouse would for the same distance');
  h.touch('pointerup', 2, 650, 310);
  assert.ok(s.stick.y > 0.5, 'lifting the looking finger does not stop the walk');
  h.touch('pointerdown', 3, 100, 200);                                   // high on the left: above the stick's part
  h.touch('pointermove', 3, 100, 100);
  assert.equal(h.told.stick.filter(Boolean).every(d => d.y === 600), true, 'the ring stayed with the first thumb');
  h.touch('pointerdown', 4, 150, 650); h.touch('pointermove', 4, 300, 650);       // a second finger in the stick's part looks: there is one stick
  assert.ok(s.stick.y > 0.5 && s.stick.x === 0);
});

test('the camcorder\'s buttons under a finger: a hop while it is held, a duck that stays, the light, and the hand', t => {
  const h = withThumbs(t), keys = h.input.state.keys;
  h.touch('pointerdown', 1, 900, 500, h.buttons.jump);
  assert.equal(keys.has(' '), true); assert.deepEqual(h.told.down.at(-1), ['jump', true]);
  h.touch('pointermove', 1, 700, 300, h.buttons.jump);
  assert.equal(h.input.state.dx, 0, 'a finger on a button is not looking, wherever it wanders');
  h.touch('pointerup', 1, 700, 300, h.buttons.jump);
  assert.equal(keys.has(' '), false); assert.deepEqual(h.told.down.at(-1), ['jump', false]);
  h.touch('pointerdown', 2, 900, 600, h.buttons.crouch); h.touch('pointerup', 2, 900, 600, h.buttons.crouch);
  assert.equal(keys.has('c'), true, 'ducked, and it stays ducked with the finger gone'); assert.deepEqual(h.told.set.at(-1), { crouched:true });
  h.touch('pointerdown', 3, 900, 600, h.buttons.crouch); h.touch('pointerup', 3, 900, 600, h.buttons.crouch);
  assert.equal(keys.has('c'), false); assert.deepEqual(h.told.set.at(-1), { crouched:false });
  h.touch('pointerdown', 4, 800, 500, h.buttons.light); h.touch('pointerup', 4, 800, 500, h.buttons.light);
  h.touch('pointerdown', 5, 800, 600, h.buttons.use); h.touch('pointerup', 5, 800, 600, h.buttons.use);
  assert.deepEqual([h.told.light, h.calls.use], [1, 1]);
  // with the bag or the menu up they do nothing, and whatever was held is let go
  h.touch('pointerdown', 6, 900, 600, h.buttons.crouch); h.touch('pointerup', 6, 900, 600, h.buttons.crouch);
  assert.equal(keys.has('c'), true);
  h.ui.blocked = true;
  h.touch('pointerdown', 7, 900, 500, h.buttons.jump);
  assert.equal(keys.size, 0); assert.deepEqual(h.told.set.at(-1), { crouched:false }, 'the button is told it is no longer lit');
  h.touch('pointerdown', 8, 800, 500, h.buttons.light);
  assert.equal(h.told.light, 1);
});

test('a phone counts a lifted finger as a touch, not one coming down: sound is asked for on both; and the screen offers whichever is in use', t => {
  const h = withThumbs(t);
  const before = h.calls.sound;
  h.touch('pointerdown', 1, 700, 300); assert.equal(h.calls.sound, before + 1);
  h.touch('pointerup', 1, 700, 300); assert.equal(h.calls.sound, before + 2);
  h.window.emit('pointercancel', { pointerType:'touch', pointerId:1, target:h.canvas }); assert.equal(h.calls.sound, before + 2);
  assert.deepEqual(h.told.touch, [true], 'a finger: the thumb stick is there');
  h.window.emit('pointerdown', { target:h.canvas }); h.window.emit('pointerup', { target:h.canvas });
  assert.deepEqual(h.told.touch, [true, false], 'a mouse: it is gone again');
  h.window.emit('pointerdown', { target:h.canvas, pointerType:'pen' });
  assert.deepEqual(h.told.touch, [true, false], 'anything else leaves it as it was');
});

test('before a finger has ever been used there is nothing drawn, and a thumb low on the left still walks', t => {
  const h = setup(t);
  h.window.emit('pointerdown', { pointerType:'touch', pointerId:2, clientX:100, clientY:600 });
  h.window.emit('pointermove', { pointerType:'touch', pointerId:2, clientX:100, clientY:490 });
  assert.equal(h.input.state.stick.y, 1); assert.equal(h.input.state.hurry, false, 'a hundred and ten pixels is past the ring\'s edge on a screen this size, and still not a run');
  h.window.emit('pointermove', { pointerType:'touch', pointerId:2, clientX:100, clientY:430 });
  assert.equal(h.input.state.hurry, true);
});

test('the mouse button held while looking is `firing` (the extinguisher goes on while it is down); let go, or the UI taking the hands, it is not', t => {
  const h = setup(t);
  h.document.pointerLockElement = h.canvas;
  h.window.emit('pointerdown', { target:h.canvas });
  assert.equal(h.calls.click, 1); assert.equal(h.input.state.firing, true);
  h.window.emit('pointerup', { target:h.canvas }); assert.equal(h.input.state.firing, false);
  h.window.emit('pointerdown', { target:h.canvas }); assert.equal(h.input.state.firing, true);
  h.input.clear(); assert.equal(h.input.state.firing, false, 'cleared with everything else');
  // a finger on the [E] holds it too, until that finger lifts (another finger lifting does not)
  h.document.pointerLockElement = null;
  h.window.emit('pointerdown', { pointerType:'touch', pointerId:4, target:h.hud.use });
  assert.equal(h.input.state.firing, true); assert.equal(h.calls.use, 1);
  h.window.emit('pointerup', { pointerType:'touch', pointerId:5, target:h.canvas }); assert.equal(h.input.state.firing, true);
  h.window.emit('pointerup', { pointerType:'touch', pointerId:4, target:h.hud.use }); assert.equal(h.input.state.firing, false);
});

test("the right button while looking is the smash (what is in the hand's other use); it is not a click and does not fire", t => {
  const h = setup(t);
  h.document.pointerLockElement = h.canvas;
  h.window.emit('pointerdown', { target:h.canvas, button:2 });
  assert.equal(h.calls.smash, 1); assert.equal(h.calls.click, 0); assert.equal(h.input.state.firing, false);
  h.document.pointerLockElement = null;
  h.window.emit('pointerdown', { target:h.canvas, button:2 }); assert.equal(h.calls.smash, 1, 'not before the mouse is held');
});
