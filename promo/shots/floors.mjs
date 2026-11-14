// The lift, and where it goes.
//   rig/film shots/floors.mjs --shot liftRoof
import { officeShot, levelShot, STUDIO, FPS } from './lib.mjs';

const LANDING = { x: 0, z: -6.7, dist: 6.6, yaw: 0, pitch: 0.34 };
const CALL = "import('/world/levels/index.js').then((m) => m.callLift(office))";
const HIDE_POINTER = "(() => { const p = document.getElementById('promo-pointer'); if (p) p.style.display = 'none'; })()";

/** The landing, the plate of buttons, a hand choosing one, and the ride. */
function liftShot(o) {
  const shot = officeShot({ tape: '08-lift', start: 1, seconds: o.seconds, hour: o.hour ?? 13, chrome: [],
    keys: [[0, { ...LANDING, dist: 8.2, pitch: 0.4 }], [1.6, LANDING, 'io']], events: [[0.5, CALL]] });
  shot.pointer = [1180, 760];
  shot.actions = o.actions;
  return shot;
}

export const shots = {
  // press R
  liftRoof: liftShot({ seconds: 13, hour: 18.3, actions: [
    { at: 1.9, hover: { css: '.liftpanel .lbtn', text: '3' }, dur: 0.55 },
    { at: 2.8, hover: { css: '.liftpanel .lbtn', text: '11' }, dur: 0.45 },
    { at: 3.6, click: { css: '.liftpanel .lbtn', text: 'R' }, dur: 0.5 },
    { at: 4.3, js: HIDE_POINTER },
  ] }),

  // the button that was not there yesterday
  thirteen: liftShot({ seconds: 16, actions: [
    { at: 1.9, hover: { css: '.liftpanel .lbtn', text: '9' }, dur: 0.5 },
    { at: 2.7, hover: { css: '.liftpanel .lbtn.odd' }, dur: 0.6 },
    { at: 4.2, click: { css: '.liftpanel .lbtn.odd' }, dur: 0.1 },
    { at: 4.6, js: HIDE_POINTER },
  ] }),

  // R — the rooftop garden, at the hour the office is at
  roof: levelShot({ level: 'roof', hour: 18.3, tape: '03-collab', start: 5, seconds: 7,
    at: { x: -2, z: 1, heading: 0.5 }, keys: [[0, { yaw: 0.72, pitch: 0.2, dist: 10 }], [7, { yaw: -0.25, pitch: 0.17, dist: 8.6 }, 'io']],
    hold: [[1.2, 4.6, 'd']] }),

  // P — formerly parking
  pasture: levelShot({ level: 'pasture', tape: '08-lift', start: 1, seconds: 7.5,
    at: { x: -17.5, z: 6, heading: 1.57 }, keys: [[0, { yaw: -1.57, pitch: 0.15, dist: 8.5 }], [7.5, { yaw: -1.2, pitch: 0.1, dist: 11 }, 'io']],
    hold: [[0.5, 6.5, 'w']] }),
  goats: levelShot({ level: 'pasture', tape: '08-lift', start: 1, seconds: 6,
    at: { x: -10.5, z: 4.4, heading: 1.2 }, keys: [[0, { yaw: -0.7, pitch: 0.2, dist: 6.4 }], [6, { yaw: -1.2, pitch: 0.16, dist: 7.4 }, 'io']],
    hold: [[1.0, 3.6, 'w']] }),

  // 3 — mission control: everything the office knows, on one wall
  mission: levelShot({ level: 'mission', tape: '04-needs', start: 0.5, seconds: 7,
    keys: [[0, { yaw: 0.38, pitch: 0.12, dist: 6 }], [7, { yaw: -0.05, pitch: 0.17, dist: 8.2 }, 'io']] }),

  // 11 — a very ordinary paper company
  scranton: (() => {
    const s = levelShot({ level: 'scranton', tape: '08-lift', start: 1, seconds: 6, hold: [] });
    s.arg.sweep = [[0, 0.55], [6, -0.7]];
    s.setup = function setup(arg) { document.getElementById('boot')?.remove(); document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '* { cursor: none !important; }' })); window.__held = new Set(); window.__fired = new Set(); window.__yaw0 = office.level.cam.yaw; };
    s.tick = function tick(t, i, arg) {
      const L = office.level; if (!L) return;
      const [[t0, a], [t1, b]] = arg.sweep, k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0))), e = k * k * (3 - 2 * k);
      L.cam.yaw = window.__yaw0 + a + (b - a) * e;
      arg.hold.forEach(([from, to, key], n) => { const want = t >= from && t < to, has = window.__held.has(n); if (want && !has) { window.__held.add(n); __k.down(key); } else if (!want && has) { window.__held.delete(n); __k.up(key); } });
    };
    return s;
  })(),

  // 9 — the night shift: stay out of the light
  nightshift: (() => {
    const s = levelShot({ level: 'nightshift', tape: '08-lift', start: 1, seconds: 9, hold: [[0.5, 2.2, 'd'], [3.6, 5.2, 'd'], [5.2, 6.4, 's'], [6.4, 9, 'd']] });
    s.setup = function setup() { document.getElementById('boot')?.remove(); document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '* { cursor: none !important; }' })); window.__held = new Set(); window.__fired = new Set(); };
    return s;
  })(),

  // 7 — after hours (the crowbar version, from its own branch): somebody has to go down there
  crowbar: {
    base: FPS, url: '/?shot=1&level=afterhours&hour=22',
    ready: '!!(window.office && office.ready && office.level && office.level.fps && office.stage.view)',
    settle: 1.2, afterSetup: 0.2, size: [1920, 1080], fps: 30, seconds: 22,
    setup() {
      document.getElementById('boot')?.remove();
      document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '* { cursor: none !important; }' }));
      window.__keys = new Set();
    },
    // a player, more or less: through the door, face whatever is nearest, close in, swing, back off while it winds up
    tick(t) {
      const L = office.level;
      if (!L?.fps) return;
      const s = L.fps.state, c = L.fps.controls, keys = window.__keys;
      const set = (k, on) => { const has = keys.has(k); if (on && !has) { keys.add(k); __k.down(k); } else if (!on && has) { keys.delete(k); __k.up(k); } };
      const alive = (s.enemies || []).filter((e) => e.health > 0 && e.state !== 'dead' && e.room === 'bullpen');
      let best = null, bd = 1e9;
      for (const e of alive) { const d = Math.hypot(e.x - s.x, e.z - s.z); if (d < bd) { bd = d; best = e; } }
      const inLobby = s.z > 7.6;
      const goal = inLobby ? { x: 0, z: 6.2 } : best && bd < 11 ? best : { x: -3, z: 2.6 };
      let turn = Math.atan2(-(goal.x - s.x), -(goal.z - s.z)) - c.yaw;
      while (turn > Math.PI) turn -= 2 * Math.PI; while (turn < -Math.PI) turn += 2 * Math.PI;
      set('ArrowLeft', turn > 0.07); set('ArrowRight', turn < -0.07);
      const fighting = !inLobby && best && bd < 11;
      set('w', !fighting || bd > 1.55);
      set('s', fighting && bd < 0.9);
      set('f', fighting && bd < 2.2 && Math.abs(turn) < 0.6);
    },
  },
};
