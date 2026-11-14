// The Backrooms — hands. While a visit runs, every key, click, finger and turn
// of the wheel is ours: taken in the capture phase, so the office underneath
// never hears any of it, and handed back when the visit is over. Keys held and
// how far the mouse (or a finger) has moved are kept in one `state` that lasts
// the whole visit — a key held down as you fall through a ceiling is still
// held when you land. A mouse looks (locked, or dragged); a finger that lands
// low on the left is a thumb stick, any other finger looks.

/**
 * @param {{ canvas, stage, hud, sound, key(k), use(), quit(), click(), wheel(step) }} o
 *        key: a key went down (once, not on repeat) · use: E, Enter, or a tap on the [E] · click: the mouse button, while it is looking
 *        wheel: ±1 for each notch
 * @returns {{ state: {keys:Set, dx:number, dy:number, stick:{x:number,y:number}}, dispose() }}
 */
export function createInput(o) {
  const { canvas, stage, hud, sound } = o;
  const state = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const keys = state.keys;
  let dragging = false, stickId = null, stickAt = null, wheel = 0, live = true, press = null;
  const looks = new Map();

  const onKeyDown = (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    e.stopPropagation();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.metaKey || e.ctrlKey || e.altKey || /^F\d+$/.test(k)) return;      // the browser's own shortcuts stay the browser's
    e.preventDefault();
    sound.start();
    if (e.repeat) return;
    keys.add(k);
    if (k === 'Escape') o.quit();
    else if (k === 'e' || k === 'Enter') o.use();
    else o.key(k);
  };
  const onKeyUp = (e) => { e.stopPropagation(); keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (e.key === 'Shift') keys.delete('Shift'); };
  const onPointerDown = (e) => {
    e.stopPropagation();
    sound.start();
    if (e.pointerType === 'touch') {
      hud.setTouch(true);
      if (e.target === hud.leave) { o.quit(); return; }
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
    if (live && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* no pointer lock: arrows still turn */ } }
  };
  const onPointerMove = (e) => {
    e.stopPropagation();
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
    e.stopPropagation();
    if (e.pointerType !== 'touch' && press && document.pointerLockElement !== canvas && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5 && performance.now() - press.t < 320) o.click();
    dragging = false;
    if (e.pointerId === stickId) { stickId = null; state.stick.x = 0; state.stick.y = 0; }
    looks.delete(e.pointerId);
  };
  const onMouseMove = (e) => {
    e.stopPropagation();
    if (document.pointerLockElement !== canvas && !dragging) return;
    state.dx += e.movementX || 0; state.dy += e.movementY || 0;
  };
  const onWheel = (e) => {
    e.stopPropagation(); e.preventDefault();
    // a notch is a notch, whatever the mouse calls it; a trackpad's dribble adds up to one
    wheel += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    while (Math.abs(wheel) >= 40) { const step = Math.sign(wheel); wheel -= step * 40; o.wheel(step); }
  };
  const swallow = (e) => { e.stopPropagation(); if (e.type === 'contextmenu' || e.type === 'touchmove') e.preventDefault(); };
  const onBlur = () => { keys.clear(); dragging = false; stickId = null; looks.clear(); state.stick.x = 0; state.stick.y = 0; };
  const listeners = [['keydown', onKeyDown], ['keyup', onKeyUp], ['pointerdown', onPointerDown], ['pointerup', onPointerUp], ['pointercancel', onPointerUp],
    ['mousemove', onMouseMove], ['pointermove', onPointerMove], ['wheel', onWheel], ['click', swallow], ['dblclick', swallow], ['contextmenu', swallow], ['touchstart', swallow], ['touchmove', swallow]];
  for (const [type, fn] of listeners) window.addEventListener(type, fn, { capture: true, passive: false });
  window.addEventListener('blur', onBlur);
  if (window.matchMedia?.('(pointer: coarse)').matches) hud.setTouch(true);

  return {
    state,
    dispose() {
      live = false;
      for (const [type, fn] of listeners) window.removeEventListener(type, fn, true);
      window.removeEventListener('blur', onBlur);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    },
  };
}
