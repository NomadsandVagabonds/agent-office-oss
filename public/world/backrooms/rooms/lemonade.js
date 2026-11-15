// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Stand
// ("the lemonade stand that is going down"). A child's lemonade stand, leaning,
// one end of it under the grass, and the child who keeps it: a girl in a
// frock, as remembered by something that got as far as her face and could not
// stop. She has a glass of lemonade for you.
//
// Her rule (pure, below). She comes after whoever is in her room, holding the
// glass out, at less than a walk. Take it (E) and it is a heart back, and she
// skips home to the stand. Keep her waiting and she starts to shake; keep her
// waiting longer and she comes at a run, and that is a heart gone. Then she
// goes home, and after a while she tries again. She never leaves the room,
// and leaving it is always allowed: outside it her patience comes back.
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { Batch, lamp } from '../kit.js';
import { P } from '../bits.js';
import { garble, lawn, daylight } from '../suburb.js';

export const STAND = Object.freeze({ patience: 14, shakes: 0.65, walk: 1.05, run: 3.4, skip: 1.8, reach: 0.95, grab: 0.62, sulk: 9, glasses: 3 });
/**
 * One moment of her. s: { mode: 'home' | 'offer' | 'angry' | 'back', waited, sulk, glasses }
 * sense: { inside (the visitor is in her room), d (metres to them), took (they took the glass this moment), home (she is at the stand) }
 * → the same s, changed, and what happened: null | 'gave' | 'hit'. Pure.
 */
export function minds(s, dt, sense) {
  s.sulk = Math.max(0, s.sulk - dt);
  if (s.mode === 'home') { if (sense.inside && s.sulk <= 0 && s.glasses > 0) { s.mode = 'offer'; s.waited = 0; } return null; }
  if (s.mode === 'back') { if (sense.home) s.mode = 'home'; return null; }
  if (!sense.inside) { s.waited = Math.max(0, s.waited - dt * 2); if (s.mode === 'angry' || s.waited <= 0) { s.mode = 'back'; } return null; }
  if (s.mode === 'offer') {
    if (sense.took) { s.glasses -= 1; s.mode = 'back'; s.happy = true; s.sulk = STAND.sulk; return 'gave'; }
    s.waited += dt; if (s.waited >= STAND.patience) s.mode = 'angry';
    return null;
  }
  if (s.mode === 'angry' && sense.d < STAND.grab) { s.mode = 'back'; s.happy = false; s.sulk = STAND.sulk; s.waited = 0; return 'hit'; }
  return null;
}

const S = 0.03;                                    // metres to one of her voxels, as the rest of the cast
/** A tumbler of lemonade about (x, y, z): glass you can nearly see through, a slice on the rim, a paper straw. */
function tumbler(v, x, y, z, r = 1.8, h = 6) {
  v.cyl('y', x, z, y, y + 1, r, M('#dbeaec', 0)); v.cyl('y', x, z, y + 1, y + h - 1.4, r, M('#f1cf3c', 0), r + 0.4); v.cyl('y', x, z, y + h - 1.4, y + h, r + 0.4, M('#dbeaec', 0), r + 0.5);
  v.cyl('y', x, z, y + h - 1, y + h, r - 0.2, M('#f7e27a', 0)); v.box(x - 0.6, y + h - 2.4, z + r - 0.2, x + 0.6, y + h - 1.2, z + r + 0.6, M('#eef7f8', 0));           // ice, showing at the top; a highlight down the side
  v.set(Math.floor(x + r), Math.floor(y + 2), Math.floor(z), M('#fbf0b0', 0)); v.set(Math.floor(x + r), Math.floor(y + 3), Math.floor(z), M('#fbf0b0', 0));
  v.cyl('z', x + r + 0.6, y + h + 0.4, z - 0.5, z + 0.5, 1.7, M('#f6e36a', 0)); v.cyl('z', x + r + 0.6, y + h + 0.4, z - 0.5, z + 0.5, 1, M('#fff6c9', 0));
  v.tube(x - 0.6, y + 2, z, x - 1.8, y + h + 3.4, z - 0.5, 0.5, M('#d9433a', 0)); v.tube(x - 1.4, y + h + 0.8, z - 0.3, x - 1.6, y + h + 2, z - 0.4, 0.55, M('#f4f1e4', 0));
}
/**
 * Her: a girl of about six in a gingham frock, ankle socks and buckled shoes, hair in bunches with a bow, one arm held out with a
 * glass in it. Sculpted as the rest of the cast is. And the face: it starts as a face on the left of it, one clear eye, and then
 * whatever made her did not stop: the nose again, and again further round, an eye that is smaller each time, a mouth that goes on
 * past the cheek to where an ear would be, the skin between them dragged into folds.
 */
function girl() {
  const v = new Vox(), skin = M('#e2b494', 1), deep = M('#c48d6e', 1), fold = M('#b57a5d', 2), hair = M('#a8321c', 2), hairD = M('#7d2212', 2), white = M('#f4f1e4', 1), shoe = M('#1b1614', 0);
  const check = (x, y, z) => (((x + 40) >> 1) + ((y + 40) >> 1)) % 2 ? M('#6fa3cf', 1) : ((x + 40) >> 1) % 2 ? M('#dfeaf2', 1) : M('#9cc0de', 1);
  // shoes with a strap, socks with a turned-down top, legs
  for (const sx of [-1, 1]) { const x = sx * 2.6; v.rbox(x - 1.8, 0, -2, x + 1.8, 2.4, 3.6, 1, shoe); v.box(x - 1.8, 2.4, 0.4, x + 1.8, 3, 1.2, shoe); v.set(Math.round(x + sx * 1.2), 2, 1, M('#c9a43a', 0));
    v.cyl('y', x, 0, 2.4, 6, 1.5, white); v.cyl('y', x, 0, 5.4, 6.4, 1.9, white); v.cyl('y', x, 0, 6.4, 14, 1.3, skin, 1.5); v.ellipsoid(x, 11, 0.9, 1.3, 1.2, 1, deep); }
  // the frock: a full skirt over a petticoat, a fitted bodice, puffed sleeves, a round collar, a sash tied behind
  v.cyl('y', 0, 0, 12, 13.4, 9.2, white, 8.8); v.cyl('y', 0, 0, 13, 23, 9, check, 4.2);
  for (let a = 0; a < 12; a++) v.tube(Math.cos(a * 0.5236) * 4.4, 22, Math.sin(a * 0.5236) * 4.4, Math.cos(a * 0.5236) * 9.2, 13.2, Math.sin(a * 0.5236) * 9.2, 0.8, check);
  v.rbox(-4.2, 22, -3, 4.2, 31, 3, 1.5, check); v.cyl('y', 0, 0, 22, 23.6, 4.6, M('#d9433a', 1)); v.ellipsoid(-2.2, 23, -4.4, 2.2, 1.5, 1, M('#d9433a', 1)); v.ellipsoid(2.2, 23, -4.4, 2.2, 1.5, 1, M('#d9433a', 1)); v.tube(-1, 22, -4.6, -2, 17, -6, 0.7, M('#d9433a', 1)); v.tube(1, 22, -4.6, 2.4, 18, -6.2, 0.7, M('#d9433a', 1));
  for (const b of [-1.4, 0, 1.4]) v.set(0, Math.round(26 + b * 1.6), 3, white);
  v.ellipsoid(-2.4, 31, 1.6, 2.6, 1, 2, white); v.ellipsoid(2.4, 31, 1.6, 2.6, 1, 2, white);
  for (const sx of [-1, 1]) v.ellipsoid(sx * 5.4, 29.4, 0, 2.3, 2.2, 2.4, check);
  // her left arm at her side; her right held out, and the glass in it
  v.tube(-5.8, 28, 0, -6.8, 21, 0.6, 1.15, skin); v.ellipsoid(-6.9, 19.8, 0.8, 1.3, 1.5, 1.2, skin);
  v.tube(5.8, 28, 0.4, 6.6, 25.4, 5.4, 1.15, skin); v.tube(6.6, 25.4, 5.4, 5.6, 25.6, 9.4, 1.05, skin); v.ellipsoid(5.2, 25.8, 10.4, 1.5, 1.4, 1.5, skin);
  tumbler(v, 5.2, 24.2, 12.4, 1.8, 6); for (const f of [-1, 0, 1]) v.box(3.6, 25 + f * 1.3, 11.4, 4.2, 25.8 + f * 1.3, 13.2, skin);
  // neck and head
  v.ellipsoid(0, 42.8, -0.9, 7.2, 4.6, 6.6, hair); v.rbox(-7, 35, -6.6, 7, 43, -1.4, 3, hair); v.carve(-5.6, 32, -1.4, 5.6, 42.2, 7);
  v.cyl('y', 0, 0, 30.6, 33, 1.7, skin); v.rbox(-6.4, 32.4, -5.6, 6.4, 45.4, 5.8, 4.4, skin); v.ellipsoid(0, 44.6, -0.6, 6.9, 2.6, 6.2, hair); v.ellipsoid(0, 34.4, 1.2, 4.6, 2.6, 4.4, skin);
  // hair (the back and crown of it went on before her head): a fringe, bunches tied with ribbon, a bow
  for (let x = -5; x <= 5; x++) v.box(x, 42.8 - (Math.abs(x) % 3 === 1 ? 0.9 : 0.2), 4.4, x + 1, 45, 6.3, x % 2 ? hair : hairD);
  for (const sx of [-1, 1]) { v.ellipsoid(sx * 8.4, 37.6, -1, 2.4, 3.6, 2.6, hair); v.tube(sx * 8.4, 35, -1, sx * 9.2, 30.6, -0.4, 1.5, hairD); v.cyl('x', 39.6, -1, sx > 0 ? 6.4 : -7.6, sx > 0 ? 7.6 : -6.4, 1.6, M('#d9433a', 1)); }
  v.ellipsoid(-2.4, 47, 0, 2.4, 1.6, 1.3, M('#d9433a', 1)); v.ellipsoid(2.4, 47, 0, 2.4, 1.6, 1.3, M('#d9433a', 1)); v.box(-0.8, 46.2, -0.8, 0.8, 47.8, 0.8, M('#b3261e', 1));
  // the face. One eye that is an eye: white, a blue iris, a lid over it
  const eye = (x, y, z, r, dir) => { const [ax, az] = dir ? [0, 1] : [1, 0]; v.ellipsoid(x, y, z, dir ? 0.9 : r, r * 0.8, dir ? r : 0.9, white); v.ellipsoid(x + ax * 0.5 + (dir ? 0.4 : 0), y, z + (dir ? 0 : 0.5), dir ? 0.7 : r * 0.55, r * 0.55, dir ? r * 0.55 : 0.7, M('#4f8fa8', 0)); v.set(Math.floor(x + (dir ? 0.8 : 0)), Math.floor(y), Math.floor(z + (dir ? 0 : 0.9)), M('#12100f', 0)); void az; };
  eye(-3.4, 39.4, 5.4, 1.9, 0); v.box(-5.2, 40.9, 5.2, -1.6, 41.5, 6.4, deep);
  // …and then the rest of it, again and again, sliding off to her left and round the side of her head
  const nose = (x, y, z, k) => { v.tube(x, y + 2.6 * k, z, x + 0.4, y, z + 0.9 * k, 0.9 * k, deep); v.ellipsoid(x + 0.4, y - 0.3, z + 1.1 * k, 1.25 * k, 0.95 * k, 0.95 * k, skin); v.set(Math.floor(x - 0.3), Math.floor(y - 0.9), Math.floor(z + 1.2 * k), fold); };
  nose(-0.6, 37, 5.6, 1); nose(2.2, 36.4, 5.5, 0.9); nose(4.6, 36, 4.6, 0.8);
  eye(1.4, 40, 5.5, 1.3, 0); eye(4.4, 39.8, 4.8, 1.0, 0);
  for (const [z, y, k] of [[3.4, 39.2, 1.3], [0.6, 38.6, 1.0], [-2, 38.2, 0.8]]) { eye(6.2, y, z, k, 1); v.tube(6.3, y - 2.4 * k, z + 0.6, 6.9, y - 4.2 * k, z + 0.2, 0.75 * k, deep); v.ellipsoid(7, y - 4.4 * k, z + 0.2, 0.9 * k, 0.8 * k, 1.05 * k, skin); }
  // the mouth: one mouth, that goes on. Lips that sag as they go, a second pair under the first, and the folds between
  const lip = M('#a8473f', 1), lipD = M('#7d2f2a', 1);
  for (let i = 0; i < 9; i++) { const x = -3.4 + i, y = 34.6 - (i > 4 ? (i - 4) * 0.35 : 0); v.box(x, y, 5.5, x + 1, y + 0.7, 6.3, lip); v.box(x, y - 0.4, 5.6, x + 1, y, 6.1, lipD); if (i > 5) v.box(x, y - 1.7, 5.4, x + 1, y - 1.2, 6.1, lipD); }
  for (let i = 0; i < 8; i++) { const z = 4.6 - i, y = 32.8 - i * 0.15; v.box(5.9, y, z, 7, y + 0.8, z + 1, lip); v.box(6, y - 0.5, z, 6.8, y, z + 1, lipD); if (i % 2) v.box(6, y - 1.8, z, 6.9, y - 1.3, z + 1, lip); }
  for (const [x, y0, y1] of [[0.6, 35.4, 38], [3.2, 34.8, 37.4], [5.4, 34.2, 38.6], [1.8, 41.4, 43]]) v.box(x, y0, 5.5, x + 0.7, y1, 6.2, fold);
  for (const [z, y0, y1] of [[2, 34, 37.6], [-0.6, 33.6, 37], [-3, 33.4, 40]]) v.box(6.2, y0, z, 6.9, y1, z + 0.7, fold);
  return v;
}
/** The stand: a counter of old boards with one board missing, two uprights, a board across the top for the name; and what is on it. */
function standVox() {
  const v = new Vox(), a = M('#b8935f', 3), b = M('#a17c4c', 3), d = M('#7d5d36', 3), white = M('#efe9d8', 2);
  for (let i = 0; i < 8; i++) if (i !== 5) v.box(-32 + i * 8, 0, 6, -32 + i * 8 + 7, 31, 8, i % 2 ? a : b);
  for (const z of [-10, 8]) for (const x of [-32, 30]) v.box(x, 0, z < 0 ? -10 : 6, x + 2, 31, z < 0 ? -8 : 8, d);
  for (const y of [4, 26]) { v.box(-32, y, 8, 32, y + 3, 9, d); v.box(-32, y, -10, -30, y + 3, 8, d); v.box(30, y, -10, 32, y + 3, 8, d); }
  v.box(-34, 31, -12, 34, 33, 11, white); v.box(-34, 30, 10, 34, 31, 11, M('#cfc8b4', 2));
  for (const x of [-31, 29]) { v.box(x, 33, -9, x + 2, 76, -7, d); v.tube(x + 1, 60, -8, x + (x < 0 ? 9 : -7), 68, -8, 0.8, d); }
  v.box(-34, 62, -9.4, 34, 76, -8, white); v.box(-34, 62, -9.6, 34, 63, -9.4, d); v.box(-34, 75, -9.6, 34, 76, -9.4, d);
  for (let i = 0; i < 9; i++) { const x = -30 + i * 7.5; v.tube(x, 62, -7.6, x + 3.75, 58, -7.6, 0.6, M(['#d9433a', '#f3d44a', '#4f8fa8'][i % 3], 0)); v.tube(x + 3.75, 58, -7.6, x + 7.5, 62, -7.6, 0.6, M(['#d9433a', '#f3d44a', '#4f8fa8'][i % 3], 0)); }
  // the jug: glass, a handle, lemonade most of the way up it, slices and ice at the top
  v.cyl('y', -20, 0, 33, 34, 5.2, M('#dbeaec', 0)); v.cyl('y', -20, 0, 34, 43, 5.2, M('#f1cf3c', 0), 4.6); v.cyl('y', -20, 0, 43, 47, 4.6, M('#dbeaec', 0), 4.4); v.carve(-23, 45, -3, -17, 48, 3); v.ring(-25.6, 40, 0, 3.2, 0.8, M('#cfe3e6', 0), 'z'); v.box(-18, 46, -1, -15, 48, 1, M('#cfe3e6', 0));
  for (const [x, z] of [[-21, 1], [-19, -1.6], [-20.4, -0.4]]) { v.cyl('y', x, z, 44, 45, 1.6, M('#f6e36a', 0)); v.set(Math.round(x), 44, Math.round(z), M('#fff6c9', 0)); } v.box(-18.6, 44, 0.6, -17, 45.6, 2.2, M('#eaf6f8', 0));
  [[-6, 2], [1, -1], [8, 3], [15, 0]].forEach(([x, z]) => tumbler(v, x, 33, z));
  // a bowl of lemons, one cut; a tin for the money
  v.cyl('y', 24, 2, 33, 36, 3.6, M('#4f8fa8', 1), 5.4); for (const [x, y, z] of [[22.6, 37, 1.4], [25.6, 37, 2.6], [24, 38.6, 2.2], [24.4, 37, -0.6]]) v.ellipsoid(x, y, z, 1.9, 1.5, 1.5, M('#f3d44a', 1));
  v.rbox(-1, 33, -8, 7, 37, -3, 1, M('#8a8f94', 0)); v.box(1.6, 37, -5.8, 4.4, 37.4, -5.2, M('#1b1614', 0));
  return v;
}

export function build(c) {
  const { W, D, H, params: p, kit } = c;
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.4, cloudTop: H - 0.7, neighbour: 0 });

  /* the stand: a crate of a counter, two uprights, a board across; one end of it going down */
  const sx = p.side * 0.6, sz = -D / 2 + 2.4, lean = -p.side * 0.2;
  c.model('stand:stall:2', standVox, sx, sz, { y: -0.34, tilt: [0.05, lean], solid: false, shadow: false });
  // its name, in paint, on the board across the top (the board is the model's; this goes over with it)
  { const sign = new Batch(); sign.quad([sx - 0.8, 1.6, sz - 0.19], [sx + 0.8, 1.6, sz - 0.19], [sx + 0.8, 1.86, sz - 0.19], [sx - 0.8, 1.86, sz - 0.19]);
    const tex = kit.tex.custom('stand:sign', 128, 22, (g, w, h) => { P(g, '#efe9d8', 0, 0, w, h); garble(g, 'LEMONADE', 2, 0, 92, h, { color: '#b3261e', size: 17, mess: 0.4 }, 11); garble(g, '5c', 94, 0, 32, h, { color: '#1f6b3a', size: 17, mess: 0.5 }, 3); }, { clamp: true });
    const g = c.dynamic(sign, { pivot: [sx, -0.34, sz], map: tex }); g.rotation.set(0.05, 0, lean, 'YXZ'); g.position.y = -0.34; }
  c.solid(sx - 0.9, sz - 0.4, sx + 0.9, sz + 0.4); c.blot(sx + p.side * 0.5, sz, 2.6, 1.6, { a: 0.45 }); c.reserve(sx, sz, 1.4);

  /* her */
  const fig = new THREE.Group(), mat = kit.surface({ vox: true }), q = new Batch(true);
  q.addVox(kit.model('stand:girl:3', girl).solid, new THREE.Matrix4().makeScale(S, S, S));
  fig.add(new THREE.Mesh(kit.geometry(q, [lamp(0.4, 2.4, 1.2, [1.15, 1.15, 1.15], { k: 9, wrap: 0.45, far: 30 })], [0.62, 0.62, 0.62]), mat));
  fig.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  const home = { x: sx - p.side * 1.25, z: sz + 0.5 }, me0 = { x: home.x, z: home.z, rot: 0 };
  c.add(fig); c.reserve(home.x, home.z, 0.5);
  const s = { mode: 'home', waited: 0, sulk: 0, glasses: STAND.glasses, happy: false };
  let took = false, clock = 0;
  c.rt.vendor = s;                                        // (for the dev page and for scripts: what she is doing)
  const put = (bob = 0, shake = 0) => { fig.position.set(me0.x + shake * (Math.random() - 0.5), bob, me0.z + shake * (Math.random() - 0.5)); fig.rotation.y = me0.rot; };
  c.after.push(() => { fig.userData.light(c.sample(home.x, 0.8, home.z)); put(); });
  const free = (x, z) => Math.abs(x) < W / 2 - 0.4 && Math.abs(z) < D / 2 - 0.4 && (() => { const w = c.toWorld(x, z); return c.world.free(w.x, w.z, 0.2); })();
  const go = (tx, tz, speed, dt, keep = 0) => {
    const dx = tx - me0.x, dz = tz - me0.z, d = Math.hypot(dx, dz); if (d <= keep + 0.02) return true;
    const step = Math.min(speed * dt, d - keep);
    for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) { const cs = Math.cos(turn), sn = Math.sin(turn), nx = me0.x + ((dx * cs - dz * sn) / d) * step, nz = me0.z + ((dx * sn + dz * cs) / d) * step; if (free(nx, nz)) { me0.x = nx; me0.z = nz; break; } }
    me0.rot = Math.atan2(dx, dz); return false;
  };
  c.use({ x: home.x, z: home.z, r: 1.4, label: 'take the lemonade', when: () => s.mode === 'offer' && Math.hypot(me0.x - c.rt.vendorMe?.x, me0.z - c.rt.vendorMe?.z) < 1.5, use: () => { took = true; } });
  const use = c.rt.uses[c.rt.uses.length - 1];
  c.tick((dt, t, me) => {
    clock += dt; c.rt.vendorMe = { x: me.x, z: me.z };
    const d = Math.hypot(me.x - me0.x, me.z - me0.z), atHome = Math.hypot(home.x - me0.x, home.z - me0.z) < 0.1;
    const did = minds(s, dt, { inside: me.inside, d, took, home: atHome }); took = false;
    if (did === 'gave') { c.env.health?.heal?.(1); const w = c.toWorld(me0.x, me0.z); c.env.play?.('click', w.x, w.z, 5); }
    if (did === 'hit') { c.hurt(1); c.env.interfere?.(1); c.env.hud?.glitch?.(0.5); }
    let bob = 0, shake = 0;
    if (s.mode === 'offer') { go(me.x, me.z, STAND.walk, dt, STAND.reach); if (s.waited > STAND.patience * STAND.shakes) shake = 0.03 * (s.waited / STAND.patience); }
    else if (s.mode === 'angry') { go(me.x, me.z, STAND.run, dt, 0.3); shake = 0.05; }
    else if (s.mode === 'back') { go(home.x, home.z, s.happy ? STAND.skip : STAND.walk, dt); if (s.happy) bob = Math.abs(Math.sin(clock * 9)) * 0.12; }
    else me0.rot = Math.atan2(me.x - me0.x, me.z - me0.z) * (me.inside ? 1 : 0);
    put(bob, shake);
    const w = c.toWorld(me0.x, me0.z); use.wx = w.x; use.wz = w.z;                                    // E is wherever she is
    if (c.rt.group.visible && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) fig.userData.light(c.sample(me0.x, 0.8, me0.z));
  });
}
