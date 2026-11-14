// What the shot files have in common. A shot's setup() and tick() run in the page, so they cannot see anything in
// this file: everything they need travels in `arg`.
export const STUDIO = 'http://localhost:4410';

/**
 * A shot of the office floor: a tape, a camera path, and what is on screen besides the room.
 *   keys     [[seconds, { x, z, dist, yaw, pitch }, ease?], …]   the camera (ease: io | io2 | out | in | linear)
 *   follow   an agent's name: x and z of every key are then offsets from wherever that agent is
 *   chrome   which parts of the interface stay: any of 'plate' (nameplate + census), 'clock', 'dock', 'tray', 'labels', 'ticker'
 *   events   [[seconds, 'js'], …]   run once each as the take passes that moment
 */
export function officeShot(o) {
  return {
    name: o.name, base: o.base || STUDIO,
    url: `/?shot=1&hour=${o.hour ?? 13}${o.query || ''}`,
    tape: o.tape ? `../tapes/${o.tape}.json` : undefined, tapeStart: o.start || 0,
    size: [1920, 1080], fps: 30, seconds: o.seconds, pre: o.pre, settle: o.settle,
    blind: 'office.stage.setView({ scene: office.stage.scene, camera: office.stage.camera, render() {} })', unblind: 'office.stage.setView(null)',
    storage: { 'office.settings': { graphics: 'auto', time: 'auto', sound: 'off', notify: 'off' }, ...(o.storage || {}) },
    arg: { keys: o.keys, follow: o.follow || '', chrome: o.chrome || [], events: o.events || [], select: o.select || '' },
    setup(arg) {
      document.getElementById('boot')?.remove();
      const hide = { plate: '.hud-tl', clock: '.hud-tr', dock: '.dock', tray: '.intray', labels: '.labels', ticker: '.ticker' };
      const css = Object.entries(hide).filter(([k]) => !arg.chrome.includes(k)).map(([, sel]) => `#ui ${sel} { display: none !important; }`).join('\n');
      document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css + '\n#ui .toasts, #ui .toast { display: none !important; }\n* { cursor: none !important; }' }));
      window.__fired = new Set();
      const first = arg.keys[0][1];
      office.rig.flyTo(first, { instant: true });
    },
    tick(t, i, arg) {
      const v = __k.kf(t, arg.keys);
      if (arg.follow) {
        const a = [...office.net.state.agents.values()].find((x) => x.name === arg.follow);
        const p = a && office.people.positionOf(a.id);
        if (p) { window.__last = p; }
        if (window.__last) { v.x += window.__last.x; v.z += window.__last.z; }
      }
      office.rig.flyTo(v, { instant: true });
      arg.events.forEach(([at, code], n) => { if (t >= at && !window.__fired.has(n)) { window.__fired.add(n); (0, eval)(code); } });
    },
  };
}

export const TRUNK = 'http://localhost:4401';     // the upgraded office (the Backrooms with floors)
export const LAB = 'http://localhost:4402';       // codex/backrooms-expansion-lab (Dispatch, the quiet maze)
export const FPS = 'http://localhost:4403';       // codex/after-hours-fps
export const WORKSHOP = 'http://localhost:4404';  // gemini/backrooms-workshop

/**
 * A shot inside the Backrooms, through the level's own dev page (public/world/dev/backrooms.html).
 *   room, at { x, z, yaw, pitch }   where the take starts, in that room's own frame (yaw 0 looks in from the door)
 *   path  [[seconds, { yaw, pitch, fwd, side }, ease?], …]   where the camcorder points, and how hard the thumb pushes
 *         (fwd/side: 1 is a walk; the feet, the bob and the footsteps are the game's own)
 *   events  [[seconds, 'js'], …]    __k.press('e') uses whatever is in front of you
 */
export function backroomsShot(o) {
  const at = o.at || {};
  const q = new URLSearchParams({ seed: String(o.seed ?? 7), vhs: String(o.vhs ?? 2), mute: '1', fx: '1', pursuer: String(o.pursuer ?? 0), name: 'Robin' });
  if (o.room !== undefined) q.set('room', String(o.room));
  for (const k of ['x', 'z', 'yaw', 'pitch']) if (at[k] !== undefined) q.set(k, String(at[k]));
  for (const [k, v] of Object.entries(o.query || {})) q.set(k, String(v));
  return {
    name: o.name, base: o.base || TRUNK, url: `/world/dev/backrooms.html?${q}`,
    ready: "document.title === 'ready' && !!window.__backrooms",
    settle: o.settle ?? 1.8, afterSetup: 0, pre: o.pre,
    size: [1920, 1080], fps: 30, seconds: o.seconds,
    arg: { path: o.path || [[0, { yaw: at.yaw || 0, pitch: at.pitch || 0, fwd: 0, side: 0 }]], events: o.events || [], yaw0: at.yaw || 0, free: !!o.free, aim: o.aim || '' },
    setup(arg) {
      document.getElementById('dev')?.remove();
      document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '* { cursor: none !important; }' }));
      const h = window.__backrooms, me = h.player.me;
      window.__rot = me.yaw - arg.yaw0;            // the room's own turn: path yaws are in the room's frame
      if (arg.aim === 'pursuer') {                 // yaw 0 is then "looking straight at whatever follows you"
        const p = h.env.pursuer?.at?.();
        if (p) { me.yaw = Math.atan2(-(p.x - me.x), -(p.z - me.z)); window.__rot = me.yaw; }
      }
      window.__fired = new Set();
    },
    tick(t, i, arg) {
      const h = window.__backrooms;
      if (!h) return;
      const me = h.player.me, v = __k.kf(t, arg.path);
      if (!arg.free) { me.yaw = v.yaw + window.__rot; me.pitch = v.pitch; }
      h.player.input.stick.y = v.fwd || 0; h.player.input.stick.x = v.side || 0;
      arg.events.forEach(([at, code], n) => { if (t >= at && !window.__fired.has(n)) { window.__fired.add(n); (0, eval)(code); } });
    },
  };
}

/**
 * A shot on one of the lift's floors (anything built on levels/kit.js).
 *   level   its id in core/levels.mjs        at { x, z, heading }   where you stand when the take starts
 *   keys    [[seconds, { yaw, pitch, dist }, ease?], …]   the camera round you (first person: where you look)
 *   hold    [[from, to, key], …]              keys held between those seconds ('w', 'Shift', 'f', 'ArrowLeft' …)
 *   events  [[seconds, 'js'], …]              office.level is the floor: .walkTo(x, z, seconds), .look({…}), .use()
 */
export function levelShot(o) {
  return {
    name: o.name, base: o.base || STUDIO,
    url: `/?shot=1&level=${o.level}&hour=${o.hour ?? 13}${o.query || ''}`,
    tape: o.tape ? `../tapes/${o.tape}.json` : undefined, tapeStart: o.start || 0,
    ready: '!!(window.office && office.ready && office.level && office.stage.view)',
    settle: o.settle ?? 1.5, afterSetup: o.afterSetup ?? 0.3, pre: o.pre,
    size: [1920, 1080], fps: 30, seconds: o.seconds,
    arg: { at: o.at || null, keys: o.keys || [], hold: o.hold || [], events: o.events || [], chrome: o.chrome ?? true },
    setup(arg) {
      document.getElementById('boot')?.remove();
      document.head.appendChild(Object.assign(document.createElement('style'), { textContent: `* { cursor: none !important; }${arg.chrome ? '' : ' #ui { display: none !important; }'}` }));
      window.__fired = new Set(); window.__held = new Set();
      const first = arg.keys[0]?.[1] || {};
      if (arg.at || arg.keys.length) office.level.look({ ...(arg.at || {}), ...first });
    },
    tick(t, i, arg) {
      const L = office.level;
      if (!L) return;
      if (arg.keys.length) { const v = __k.kf(t, arg.keys); for (const k of ['yaw', 'pitch', 'dist']) if (v[k] !== undefined) L.cam[k] = v[k]; }
      arg.hold.forEach(([from, to, key], n) => {
        const want = t >= from && t < to, has = window.__held.has(n);
        if (want && !has) { window.__held.add(n); __k.down(key); } else if (!want && has) { window.__held.delete(n); __k.up(key); }
      });
      arg.events.forEach(([at, code], n) => { if (t >= at && !window.__fired.has(n)) { window.__fired.add(n); (0, eval)(code); } });
    },
  };
}
