// The Backrooms — hands. While a visit runs, every key, click, finger and turn
// of the wheel is ours: taken in the capture phase, so the office underneath
// never hears any of it, and handed back when the visit is over. Keys held and
// how far the mouse (or a finger) has moved are kept in one `state` that lasts
// the whole visit — a key held down as you fall through a ceiling is still
// held when you land. A mouse looks (locked, or dragged); a finger that lands
// low on the left is a thumb stick, any other finger looks.

/**
 * @param {{ canvas, stage, hud, sound, key(k), use(), menu(), click(), wheel(step), owns(target)?, interceptKey(event)?, blocked()? }} o
 *        key: a key went down (once, not on repeat) · use: E, Enter, or a tap on the [E] · click: the mouse button, while it is looking
 *        wheel: ±1 for each notch · owns: native UI events pass through to their target
 *        interceptKey: UI consumed this key · blocked: UI owns the hands, while the visit keeps running
 * @returns {{ state: {keys:Set, dx:number, dy:number, stick:{x:number,y:number}}, clear(), capture(), release(), dispose() }}
 */
export function createInput(o) {
  const { canvas, stage, hud, sound } = o;
  const state = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const keys = state.keys;
  let dragging = false, stickId = null, stickAt = null, wheel = 0, live = true, press = null, held = false;
  const looks = new Map();
  const owns = e => !!o.owns?.(e.target);
  const blocked = () => !!o.blocked?.();
  function clear() {
    keys.clear(); state.dx = state.dy = 0; state.stick.x = state.stick.y = 0;
    dragging = false; stickId = null; stickAt = null; press = null; wheel = 0; looks.clear();
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
  const onPointerDown = (e) => {
    sound.start();
    if (e.pointerType === 'touch') hud.setTouch(true);
    if (owns(e)) { clear(); return; }
    e.stopPropagation();
    if (blocked()) { clear(); return; }
    if (e.pointerType === 'touch') {
      if (e.target === hud.leave) { o.menu(); return; }
      if (e.target === hud.use) { o.use(); return; }
      if (hud.owns?.(e.target)) { hud.tap?.(e.target); return; }                // something of the camcorder's own that can be touched
      if (stickId === null && e.clientX < stage.size.w * 0.4 && e.clientY > stage.size.h * 0.45) { stickId = e.pointerId; stickAt = { x: e.clientX, y: e.clientY }; }
      else looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    if (e.target === hud.use) { o.use(); return; }
    // the first click only takes hold of the mouse; after that a click is a click. (Where the mouse cannot be held —
    // it is dragged to look instead — a click is a press that went nowhere: see onPointerUp.)
    if (document.pointerLockElement === canvas) { if (e.button === 0) o.click(); press = null; }
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
      const reach = Math.max(46, Math.min(stage.size.w, stage.size.h) * 0.11), dx = (e.clientX - stickAt.x) / reach, dy = (e.clientY - stickAt.y) / reach, len = Math.max(1, Math.hypot(dx, dy));
      state.stick.x = dx / len; state.stick.y = -dy / len;
    } else if (looks.has(e.pointerId)) {
      const last = looks.get(e.pointerId);
      state.dx += (e.clientX - last.x) * 2.6; state.dy += (e.clientY - last.y) * 2.6;
      last.x = e.clientX; last.y = e.clientY;
    }
  };
  const onPointerUp = (e) => {
    const pendingPress = press; press = null;
    dragging = false;
    if (e.pointerId === stickId) { stickId = null; stickAt = null; state.stick.x = 0; state.stick.y = 0; }
    looks.delete(e.pointerId);
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
