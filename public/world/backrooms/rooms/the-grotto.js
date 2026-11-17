// The Backrooms — a shop of the shopping centre (themes.js `mall`): The
// Grotto ("the grotto, in July"). Somebody was told that at a certain time
// of year a shopping centre has a little house with snow on it, and a queue,
// and inside it somebody in a big chair you sit with while your picture is
// taken; and that there is a tree. They were not told when. So it is up,
// and the calendar by it says JULY. The queue folds on itself five times to
// get there. The tree is a coat stand with the decorations the office had.
// In the chair there is a sack, which is the right shape for whoever sits
// there. The camera on its legs is pointed at it, and goes off when you go
// near. There is a present under the chair with something in it.
import { P } from '../bits.js';
import { Vox, M, glow } from '../../vox/vox.js';
import { upright, sheet, garble } from '../suburb.js';
import { mallNeon, dummyVox, wallFace, wallBox } from '../mall.js';

// hut: its width, depth, height · queue: how many times it folds, and its pitch
export const GROTTO = Object.freeze({ hutW: 3.6, hutD: 2.8, hutH: 2.5, folds: 5, pitch: 0.8 });

/** The tree: a coat stand, and up it, in tiers, what green there was; baubles; a star that is an exit sign's arrow. */
function treeVox() {
  const v = new Vox(), g1 = M('#2f5f34', 2), g2 = M('#3f7a3a', 2), wood = M('#5a3c22', 3);
  v.cyl('y', 0, 0, 0, 4, 10, M('#8a1a14', 1)); v.cyl('y', 0, 0, 4, 84, 1.4, wood);
  for (let t = 0; t < 6; t++) { const y = 14 + t * 11, r = 26 - t * 4; v.cyl('y', 0, 0, y, y + 9, r, t % 2 ? g1 : g2, Math.max(2, r - 8)); }
  const balls = ['#ff3d9a', '#35e0ff', '#ffb02e', '#e9e4d6', '#b3261e'];
  for (let i = 0; i < 26; i++) { const t = (i * 0.37) % 1, y = 16 + t * 60, r = 25 - t * 22, a = i * 2.4; v.ellipsoid(Math.round(Math.cos(a) * r), Math.round(y), Math.round(Math.sin(a) * r), 1.6, 1.6, 1.6, glow(balls[i % 5])); }
  v.box(-5, 86, -1, 5, 92, 1, glow('#3fdc6a')); v.box(2, 84, -1, 5, 94, 1, glow('#3fdc6a'));                                                       // the star: it points that way
  return v;
}
/** The sack, sat in the chair: the shape of somebody, and tied at the top. */
function sackVox() { const v = new Vox(), s = M('#8a6a3a', 2), d = M('#6a4a24', 2); v.ellipsoid(0, 14, 0, 11, 14, 9, s); v.ellipsoid(0, 30, 0, 6, 6, 6, s); v.cyl('y', 0, 0, 34, 37, 2, d); v.ellipsoid(-10, 18, 4, 4, 8, 4, s); v.ellipsoid(10, 18, 4, 4, 8, 4, s); v.ellipsoid(-4, 2, 8, 4, 3, 6, s); v.ellipsoid(4, 2, 8, 4, 3, 6, s); return v; }
/** The chair: red, gilt, too big. */
function chairVox() { const v = new Vox(), r = M('#9a1a14', 1), gold = M('#c9a43a', 0); v.rbox(-16, 0, -14, 16, 18, 14, 3, r); v.rbox(-16, 18, -14, 16, 56, -8, 4, r); v.rbox(-18, 18, -14, -13, 30, 14, 2, r); v.rbox(13, 18, -14, 18, 30, 14, 2, r); for (const x of [-15, 15]) v.cyl('y', x, -11, 56, 60, 2.5, gold); v.box(-16, 54, -9, 16, 56, -8, gold); return v; }
/** A present: a box, its paper, the ribbon both ways and the bow. */
function presentVox(paper, ribbon) { return () => { const v = new Vox(), p = M(paper, 1), r = M(ribbon, 0); v.box(-6, 0, -5, 6, 9, 5, p); v.box(-1, 0, -6, 1, 10, 6, r); v.box(-7, 0, -1, 7, 10, 1, r); v.ellipsoid(-2, 11, 0, 2, 1.4, 1.4, r); v.ellipsoid(2, 11, 0, 2, 1.4, 1.4, r); return v; }; }
/** The camera, on its three legs. */
function cameraVox() { const v = new Vox(), m = M('#2a2f36', 0); for (const a of [0, 2.1, 4.2]) v.tube(0, 50, 0, Math.round(Math.cos(a) * 10), 0, Math.round(Math.sin(a) * 10), 0.6, M('#8d949c', 0)); v.rbox(-5, 50, -4, 5, 58, 4, 1, m); v.cyl('z', 0, 54, 4, 9, 2.6, m); v.box(-2, 58, -2, 2, 61, 2, glow('#f6f3e8')); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = GROTTO, env = c.env;
  c.shell({ panels: false, wallAlb: [0.42, 0.4, 0.44], floorAlb: [0.7, 0.7, 0.72] });
  /* the hut, against the back wall: plywood painted as a cottage with snow on it, a door you go in at, and the inside */
  const hx = R.range(-W / 2 + K.hutW / 2 + 0.6, W / 2 - K.hutW / 2 - 0.6), z0 = -D / 2, z1 = z0 + K.hutD, x0 = hx - K.hutW / 2, x1 = hx + K.hutW / 2, top = K.hutH;
  const cottage = c.mapped('grotto:cottage', kit.tex.custom('grotto:cottage', 64, 64, (g, w, h) => { P(g, '#7a4f2a', 0, 0, w, h); for (let y = 0; y < h; y += 8) { P(g, '#5a3a20', 0, y, w, 1); P(g, '#8a5f36', 0, y + 1, w, 2); } P(g, '#f4f2ec', 0, 0, w, 10); for (let x = 0; x < w; x += 6) P(g, '#f4f2ec', x, 10, 4, 3 + (x % 5)); for (let i = 0; i < 12; i++) P(g, '#ffffff', (i * 23) % w, (i * 37) % 60, 2, 2); }));
  const doorW = 1.0, dx0 = hx - doorW / 2, dx1 = hx + doorW / 2;
  for (const [a, b] of [[x0, dx0], [dx1, x1]]) { upright(cottage, a, z1, b, z1, 0, top, [0, 0, (b - a) / 1.2, top / 1.2]); upright(cottage, b, z1 - 0.06, a, z1 - 0.06, 0, top, [0, 0, (b - a) / 1.2, top / 1.2]); c.solid(a, z1 - 0.08, b, z1 + 0.02, { tall: true }); }
  upright(cottage, dx0, z1, dx1, z1, 2.1, top, [0, 0, 1, 0.3]);
  for (const x of [x0, x1]) { const [a, b] = x === x0 ? [z1, z0] : [z0, z1]; upright(cottage, x, a, x, b, 0, top, [0, 0, K.hutD / 1.2, top / 1.2]); upright(cottage, x + (x === x0 ? 0.06 : -0.06), b, x + (x === x0 ? 0.06 : -0.06), a, 0, top, [0, 0, K.hutD / 1.2, top / 1.2]); c.solid(x - 0.04, z0, x + 0.04, z1, { tall: true }); }
  for (const s of [-1, 1]) sheet(c.flat, [x0 - 0.2, top, z1 + 0.25], [x1 + 0.2, top, z1 + 0.25], [x1 + 0.2, top + 0.7, (z0 + z1) / 2], [x0 - 0.2, top + 0.7, (z0 + z1) / 2], 2, 1, null, [0.95, 0.94, 0.9]), void s;   // the roof, snow on it
  c.flat.box(x0, top, z0, x1, top + 0.02, z1, [0.2, 0.18, 0.16]);
  const name = mallNeon(kit, 'grotto:' + p.seed, ['GROTTO', 'SANTAS GROTTO', 'MERRY', 'HO HO', 'JULY', 'CLOSED FOR', 'OPEN', 'QUEUE HERE'], p.seed), lit = c.shining('mall:neon:grotto:' + p.seed, name.texture, 2.4);
  upright(lit, hx - 1.5, z1 + 0.27, hx + 1.5, z1 + 0.27, top + 0.15, top + 0.65, name.uv(1));
  const bulbs = c.shining('grotto:bulbs', kit.tex.white(), 2.4, [1, 0.8, 0.4]); for (let t = 0; t <= 1.001; t += 0.05) { const x = dx0 - 0.1 + t * (doorW + 0.2), y = 2.1 + Math.sin(Math.PI * t) * 0.3; bulbs.box(x - 0.025, y - 0.025, z1 + 0.04, x + 0.025, y + 0.025, z1 + 0.09, [1, 1, 1]); }
  c.light(hx, top - 0.4, z1 + 1.0, '#ffd27a', 0.9, { k: 1.4, far: 5 });
  // inside: the chair, the sack in it, the present under it, the camera at it, and the pictures it has taken on the walls
  c.model('grotto:chair', chairVox, hx, z0 + 0.6, { solid: false }); c.solid(hx - 0.45, z0, hx + 0.45, z0 + 1.0, { tall: false });
  c.model('grotto:sack', sackVox, hx, z0 + 0.6, { y: 0.45, solid: false, shadow: false });
  c.model('grotto:present:0', presentVox('#b3261e', '#e8c040'), hx + 0.55, z0 + 1.0, { rot: 0.3, scale: 1.4, solid: false }); c.leave('snack', hx + 0.55, z0 + 1.0, { y: 0.32 });
  const cam = { x: hx - 0.4, z: z1 - 0.45 }; c.model('grotto:camera', cameraVox, cam.x, cam.z, { rot: Math.PI, solid: false }); c.solid(cam.x - 0.2, cam.z - 0.2, cam.x + 0.2, cam.z + 0.2, { tall: false });
  const pics = c.mapped('grotto:pics', kit.tex.custom('grotto:pics', 128, 32, (g, w, h) => { for (let i = 0; i < 4; i++) { const x = i * 32; P(g, '#f4efe0', x, 0, 32, h); P(g, '#3a1a14', x + 3, 3, 26, 22); P(g, '#9a1a14', x + 8, 10, 16, 15); P(g, '#8a6a3a', x + 11, 8, 10, 12); P(g, '#8a6a3a', x + 14, 5, 4, 4);
    if (i > 0) { P(g, '#16131a', x + (i === 3 ? 4 : 22), 12 - i, 5 + i, 13 + i); P(g, '#16131a', x + (i === 3 ? 5 : 23), 8 - i, 4 + i, 5); } } }));                    // each with somebody stood by the sack, and in the last, nearer
  for (let k = 0; k < 4; k++) upright(pics, x0 + 0.08, z0 + 0.4 + k * 0.55, x0 + 0.08, z0 + 0.85 + k * 0.55, 1.3, 1.65, [k / 4, 0, (k + 1) / 4, 1]);
  c.light(hx, 1.8, z0 + 1.2, '#ffe2c0', 0.5, { k: 1.6, far: 3 });
  /* the queue: posts and belts, folded on itself five times, from the way in to the door */
  const qx0 = hx - Math.min(2.6, W / 2 - 1.2), qx1 = hx + Math.min(2.6, W / 2 - 1.2), belt = [0.5, 0.12, 0.12], post = [0.78, 0.66, 0.24];
  for (let r = 0; r < K.folds; r++) { const z = z1 + 1.0 + r * K.pitch; if (z > D / 2 - 1.2) break; const open = r % 2 ? qx1 : qx0, xa = r % 2 ? qx0 : qx0 + 0.7, xb = r % 2 ? qx1 - 0.7 : qx1;
    if (r > 0) for (let x = xa; x <= xb + 0.01; x += (xb - xa) / 4) { c.flat.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.95, z + 0.03, post); c.flat.box(x - 0.09, 0, z - 0.09, x + 0.09, 0.03, z + 0.09, post); }
    if (r > 0) { c.flat.box(xa, 0.86, z - 0.012, xb, 0.9, z + 0.012, belt); c.solid(xa, z - 0.05, xb, z + 0.05, { tall: false }); } void open; }
  /* the tree, the calendar, the snow that was put down, and the two who help */
  const tx = hx > 0 ? -W / 2 + 1.3 : W / 2 - 1.3, tz = -D / 2 + 1.3; c.model('grotto:tree', treeVox, tx, tz, { scale: 1.2, solid: false }); c.solid(tx - 0.65, tz - 0.65, tx + 0.65, tz + 0.65, { tall: false }); c.light(tx, 1.6, tz + 0.6, '#ff3d9a', 0.7, { k: 1.4, far: 4 });
  const cal = c.mapped('grotto:cal', kit.tex.custom('grotto:cal', 32, 48, (g, w, h) => { P(g, '#f4efe0', 0, 0, w, h); P(g, '#b3261e', 0, 0, w, 12); garble(g, 'JULY', 1, 1, w - 2, 10, { color: '#f4efe0', mess: 0.1 }, 2); for (let y = 16; y < h - 2; y += 6) for (let x = 2; x < w - 2; x += 4) P(g, '#8a8680', x, y, 2, 3); P(g, '#b3261e', 14, 28, 4, 4); }));
  { const side = hx > 0 ? 'left' : 'right', sp = c.spans(side, 0.4, 2); if (sp.length) { const m = (sp[0][0] + sp[0][1]) / 2; wallFace(c, side, m - 0.3, m + 0.3, 1.3, 2.2, cal, [0, 0, 1, 1], 0.012); } }
  for (let i = 0; i < 9; i++) { const x = R.range(-W / 2 + 0.6, W / 2 - 0.6), z = R.range(z1 + 0.5, D / 2 - 0.6); c.flat.box(x - R.range(0.3, 0.7), 0, z - R.range(0.2, 0.5), x + R.range(0.3, 0.7), 0.025, z + R.range(0.2, 0.5), [0.96, 0.95, 0.92], { skip: '-y' }); }
  for (const s of [-1, 1]) { const ex = hx + s * 0.85, ez = z1 + 0.45; c.model('grotto:elf:' + (s > 0 ? 1 : 0), dummyVox(s > 0 ? 3 : 0, '#3f7a3a', s > 0 ? 'orange' : null), ex, ez, { rot: s > 0 ? Math.PI : 0, scale: 0.72, solid: false }); c.solid(ex - 0.15, ez - 0.15, ex + 0.15, ez + 0.15, { tall: false }); }   // one of them faces the door
  /* tinsel, overhead, in loops */
  const tinsel = c.shining('grotto:tinsel', kit.tex.white(), 0.9, [0.9, 0.62, 0.18]);
  for (let z = z1 + 0.8; z < D / 2 - 0.4; z += 1.7) for (let t = 0; t < 1; t += 1 / 40) { const x = -W / 2 + t * W, y = H - 0.1 - Math.abs(Math.sin(t * Math.PI * 5)) * 0.35; tinsel.box(x, y - 0.012, z - 0.012, x + W / 40, y + 0.012, z + 0.012, [1, 1, 1]); }
  /* go near the chair and the camera goes off */
  let last = -9, clock = 0, flash = 0;
  c.tick((dt, t, me) => { clock += dt; if (flash > 0) { flash -= dt; if (flash <= 0) c.world.setLights(c.rt, 1); }
    if (!me.inside || env.player?.me?.frozen) return;
    if (Math.abs(me.x - hx) < 0.9 && me.z < z0 + 1.7 && clock - last > 4) { last = clock; flash = 0.18; c.world.setLights(c.rt, 4); env.interfere?.(0.3); const w = c.toWorld(cam.x, cam.z); env.play?.('shutter', w.x, w.z, 8); } });
}
