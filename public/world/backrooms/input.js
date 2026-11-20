// The Backrooms — hands. While a visit runs, every key, click, finger and turn
// of the wheel is ours: taken in the capture phase, so the office underneath
// never hears any of it, and handed back when the visit is over. Keys held and
// how far the mouse (or a finger) has moved are kept in one `state` that lasts
// the whole visit — a key held down as you fall through a ceiling is still
// held when you land. A mouse looks (locked, or dragged); a finger that lands
// low on the left is a thumb stick, a finger on one of the camcorder's buttons
// presses it, and any other finger looks (touch.js draws the stick and the
// buttons; touch.rule.js says where they are and what a push means).
import { THUMBS, stickOf, inZone } from './touch.rule.js';

/**
 * @param {{ canvas, stage, hud, sound, key(k), use(), light()?, menu(), click(), smash()?, wheel(step), owns(target)?, interceptKey(event)?, blocked()? }} o
 *        key: a key went down (once, not on repeat) · use: E, Enter, or a tap on the [E] (or the hand) · light: a tap on the light
 *        click: the mouse button, while it is looking · smash: the right button, while it is looking (what is in the hand's other use) · wheel: ±1 for each notch · owns: native UI events pass through to their target
 *        interceptKey: UI consumed this key · blocked: UI owns the hands, while the visit keeps running
 * @returns {{ state: {keys:Set, dx:number, dy:number, stick:{x:number,y:number}, hurry:boolean, firing:boolean}, clear(), capture(), release(), dispose() }}
 *          stick: a thumb's push, x right and y forward, together never longer than 1 · hurry: that thumb is past the ring, which is running
 *          firing: the mouse button is down while it is looking (or a finger on the [E]): what is in the hand goes on (the extinguisher)
 */
export function createInput(o) {
  const { canvas, stage, hud, sound } = o;
  const state = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false, firing: false };
  const keys = state.keys;
  let viewPointer = null, firingId = null, dragging = false, stickId = null, stickAt = null, wheel = 0, live = true, press = null, held = false;
  const looks = new Map(), pressing = new Map();         // fingers that are looking · fingers that are on a button (which one)
  const owns = e => !!o.owns?.(e.target);
  const blocked = () => !!o.blocked?.();
  const thumbs = () => hud.thumbs || null;
  function dropStick() {
    stickId = null; stickAt = null; state.stick.x = state.stick.y = 0; state.hurry = false;
    thumbs()?.stick(null);
  }
  function endView(commit) {
    if (viewPointer === null) return;
    viewPointer = null;
    o.lowerView?.(commit);
  }
  function pressView(e) {
    if (!o.raiseView?.()) return false;
    viewPointer = e.pointerId;
    return true;
  }
  function clear() {
    endView(false);
    keys.clear(); state.dx = state.dy = 0; state.firing = false; dropStick();
    dragging = false; press = null; wheel = 0; looks.clear();
    for (const name of pressing.values()) thumbs()?.down(name, false);
    pressing.clear(); thumbs()?.set({ crouched: false });
  }
  function capture() {
    if (!live || blocked() || document.pointerLockElement === canvas) return;
    const ownerDocument = canvas.ownerDocument || document;
    try {
      canvas.requestPointerLock?.()?.then?.(() => {
        if ((!live || blocked()) && ownerDocument.pointerLockElement === canvas) ownerDocument.exitPointerLock?.();
      })?.catch?.(() => {});
    } catch { /* drag-to-look and keyboard turning still work */ }
  }
  // A deliberate release is not Esc, even if its event arrives after the UI
  // has already closed. This also clears a held movement key before pausing.
  function release() {
    held = false; clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }

  const onKeyDown = (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.metaKey || e.ctrlKey || e.altKey || /^F\d+$/.test(k)) { if (!owns(e)) e.stopPropagation(); return; }
    if (o.interceptKey?.(e)) { e.stopPropagation(); e.preventDefault(); sound.start(); return; }
    // Esc still opens the menu if focus stayed on its launcher after resume.
    // Owned buttons keep their native activation keys, not the pause key.
    if (k === 'Escape') {
      e.stopPropagation(); e.preventDefault();
      if (!e.repeat) { sound.start(); o.menu(); }
      return;
    }
    // Enter and Space must reach an owned button's native activation behavior.
    // The UI stops their bubbling locally after its own handlers have run.
    if (owns(e)) return;
    e.stopPropagation();
    if (blocked()) { e.preventDefault(); clear(); return; }
    e.preventDefault();
    sound.start();
    if (e.repeat) return;
    keys.add(k);
    if (k === 'e' || k === 'Enter') o.use();
    else o.key(k);
  };
  const onKeyUp = (e) => {
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (e.key === 'Shift') keys.delete('Shift');
    if (!owns(e)) e.stopPropagation();
  };
  /** One of the camcorder's own buttons, under a finger (touch.js): what a key would have done. */
  function pressButton(name, id) {
    pressing.set(id, name); thumbs()?.down(name, true);
    if (name === 'use') o.use({ finger: true });                               // (with nothing in front of it to use, a thumb's hand shoves: index.js)
    else if (name === 'light') o.light?.();
    else if (name === 'jump') keys.add(' ');                                   // (held for as long as the finger is: player.js hops once a press)
    else if (name === 'crouch') { if (keys.has('c')) keys.delete('c'); else keys.add('c'); thumbs()?.set({ crouched: keys.has('c') }); }     // (a thumb cannot hold C down and look round: one tap ducks, the next stands)
  }
  const onPointerDown = (e) => {
    sound.start();
    // whichever is being used is what the screen offers: a finger gets the thumb stick, a mouse is rid of it
    if (e.pointerType === 'touch') hud.setTouch(true);
    else if (e.pointerType === 'mouse') hud.setTouch(false);
    if (owns(e)) { clear(); return; }
    e.stopPropagation();
    if (blocked()) { clear(); return; }
    if (e.pointerType === 'touch') {
      if (e.target === hud.leave) { o.menu(); return; }
      if ((e.target === hud.use || thumbs()?.act(e.target) === 'use') && pressView(e)) return;
      if (e.target === hud.use) { state.firing = true; firingId = e.pointerId; o.use({ finger: true }); return; }
      if (e.target === hud.tip) { o.key('r'); return; }
      const t = thumbs(), name = t?.act(e.target);
      if (name) { pressButton(name, e.pointerId); return; }
      const zone = t?.zone || { x0: 0, y0: stage.size.h * 0.45, x1: stage.size.w * 0.4, y1: stage.size.h };
      if (stickId === null && inZone(zone, e.clientX, e.clientY)) {
        stickId = e.pointerId; stickAt = { x: e.clientX, y: e.clientY };
        t?.stick({ x: stickAt.x, y: stickAt.y, nx: 0, ny: 0, run: false });
      } else looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    if (e.target === hud.use) { o.use(); return; }
    if (e.button === 0 && pressView(e)) {
      press = null; dragging = true; capture(); return;
    }
    if (e.target === hud.tip) { o.key('r'); return; }
    // the first click only takes hold of the mouse; after that a click is a click. (Where the mouse cannot be held —
    // it is dragged to look instead — a click is a press that went nowhere: see onPointerUp.)
    if (document.pointerLockElement === canvas) { if (e.button === 0) { state.firing = true; o.click(); } else if (e.button === 2) o.smash?.(); press = null; }
    else press = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now(), first: !press } : null;
    dragging = true;
    capture();
  };
  const onPointerMove = (e) => {
    if (owns(e)) return;
    e.stopPropagation();
    if (blocked()) { clear(); return; }
    if (e.pointerType !== 'touch') return;
    if (e.pointerId === stickId) {
      // a push walks, as fast as it is far; a push past the ring runs, and goes on running until it is back inside it
      const reach = thumbs()?.reach || Math.max(THUMBS.reach.least, Math.min(stage.size.w, stage.size.h) * THUMBS.reach.share);
      const push = stickOf(e.clientX - stickAt.x, e.clientY - stickAt.y, reach, state.hurry);
      state.stick.x = push.x; state.stick.y = push.y; state.hurry = push.run;
      thumbs()?.stick({ x: stickAt.x, y: stickAt.y, nx: push.nub.x, ny: push.nub.y, run: push.run });
    } else if (looks.has(e.pointerId)) {
      const last = looks.get(e.pointerId);
      state.dx += (e.clientX - last.x) * THUMBS.look; state.dy += (e.clientY - last.y) * THUMBS.look;
      last.x = e.clientX; last.y = e.clientY;
    }
  };
  const onPointerUp = (e) => {
    // (a phone does not count a finger coming down as having been touched, only one that is lifted: without this the
    // place would be silent until the second tap)
    if (e.type !== 'pointercancel') sound.start();
    if (viewPointer !== null && viewPointer === e.pointerId && (e.button === 0 || e.type === 'pointercancel')) {
      endView(e.type === 'pointerup' && !blocked() && !owns(e));
    }
    const pendingPress = press; press = null;
    dragging = false; if (e.pointerType !== 'touch' || e.pointerId === firingId) { state.firing = false; firingId = null; }
    if (e.pointerId === stickId) dropStick();
    looks.delete(e.pointerId);
    const name = pressing.get(e.pointerId);
    if (name) { pressing.delete(e.pointerId); thumbs()?.down(name, false); if (name === 'jump') keys.delete(' '); }
    // A finger released over a UI button must still release its old thumb stick.
    if (owns(e)) return;
    e.stopPropagation();
    if (blocked()) { clear(); return; }
    if (e.type !== 'pointercancel' && e.pointerType !== 'touch' && pendingPress && document.pointerLockElement !== canvas && Math.hypot(e.clientX - pendingPress.x, e.clientY - pendingPress.y) < 5 && performance.now() - pendingPress.t < 320) o.click();
  };
  const onMouseMove = (e) => {
    if (owns(e)) return;
    e.stopPropagation();
    if (blocked()) { clear(); return; }
    if (document.pointerLockElement !== canvas && !dragging) return;
    state.dx += e.movementX || 0; state.dy += e.movementY || 0;
  };
  const onWheel = (e) => {
    if (owns(e)) return; // Native inspection scrolling; its own root stops bubbling.
    e.stopPropagation(); e.preventDefault();
    if (blocked()) { clear(); return; }
    // a notch is a notch, whatever the mouse calls it; a trackpad's dribble adds up to one
    wheel += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    while (Math.abs(wheel) >= 40) { const step = Math.sign(wheel); wheel -= step * 40; o.wheel(step); }
  };
  const swallow = (e) => { if (owns(e)) return; e.stopPropagation(); if (e.type === 'contextmenu' || e.type === 'touchmove') e.preventDefault(); };
  // Esc with the mouse held never reaches the page: the browser takes that key to let the mouse go. So a mouse let go
  // while the page still has the visitor (not the bag opening, which lets it go on purpose; not another window taking
  // over, which a moment's wait tells apart) is that Esc, and opens the menu.
  const onPointerLockChange = () => {
    const mine = document.pointerLockElement === canvas, was = held;
    held = mine;
    if (!mine) {
      clear();
      if (was && live && !blocked()) setTimeout(() => {
        if (live && !blocked() && document.pointerLockElement !== canvas && (document.hasFocus?.() ?? true) && !document.hidden) o.menu();
      }, 120);
    } else if (blocked()) { clear(); document.exitPointerLock?.(); } // A pending lock request finished after the bag opened.
  };
  const listeners = [['keydown', onKeyDown], ['keyup', onKeyUp], ['pointerdown', onPointerDown], ['pointerup', onPointerUp], ['pointercancel', onPointerUp],
    ['mousemove', onMouseMove], ['pointermove', onPointerMove], ['wheel', onWheel], ['click', swallow], ['dblclick', swallow], ['contextmenu', swallow], ['touchstart', swallow], ['touchmove', swallow]];
  for (const [type, fn] of listeners) window.addEventListener(type, fn, { capture: true, passive: false });
  window.addEventListener('blur', clear);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  if (window.matchMedia?.('(pointer: coarse)').matches) hud.setTouch(true);

  return {
    state, clear, capture, release,
    dispose() {
      live = false; clear();
      for (const [type, fn] of listeners) window.removeEventListener(type, fn, true);
      window.removeEventListener('blur', clear);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    },
  };
}
