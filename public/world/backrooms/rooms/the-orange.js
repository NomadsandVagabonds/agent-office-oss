// The Backrooms — a shop of the shopping centre (themes.js `mall`): The
// Orange ("the place that sells the orange drink"). Somebody was told there
// is a place in a shopping centre where they squeeze oranges and you drink
// it, and that it is very orange, and that the person behind the counter
// is friendly. So: everything is orange and white, in stripes. There are a
// great many oranges, in the machines and in drifts in the corners and one
// very large one going round over the counter. Cut open, they are not the
// right colour inside. The person behind the counter has an orange for a
// head and turns to keep facing whoever came in. There is a drink on the
// counter, poured. It can be drunk.
import * as THREE from 'three';
import { Batch, lamp } from '../kit.js';
import { P } from '../bits.js';
import { Vox, M } from '../../vox/vox.js';
import { upright } from '../suburb.js';
import { mallNeon, dummyVox, orangeVox, juicerVox, cupVox, heapVox, wallBox } from '../mall.js';

export const ORANGE = Object.freeze({ counter: 2.3, turn: 1.6, big: 0.5 });
const S = 0.025, MENU = ['ORANGE', 'ORANGE LARGE', 'NOT ORANGE', 'THE ORANGE ONE', 'DRINK', 'ORANGE ORANGE', 'ASK', 'SAME AGAIN'];

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = ORANGE;
  const stripes = kit.tex.custom('orange:wall', 32, 32, (g, w, h) => { for (let x = 0; x < w; x += 8) P(g, (x / 8) % 2 ? '#f08a1e' : '#f4efe0', x, 0, 8, h); for (let i = 0; i < 60; i++) P(g, 'rgba(120,60,10,0.18)', (i * 37) % w, (i * 53) % h, 1, 2 + (i % 4)); P(g, '#b3661a', 0, h - 5, w, 5); });
  const tiles = kit.tex.custom('orange:floor', 32, 32, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { P(g, (x + y) % 2 ? '#f08a1e' : '#f4efe0', x * 16, y * 16, 16, 16); P(g, 'rgba(0,0,0,0.25)', x * 16, y * 16, 16, 1); P(g, 'rgba(0,0,0,0.25)', x * 16, y * 16, 1, 16); } for (let i = 0; i < 40; i++) P(g, 'rgba(150,80,10,0.3)', (i * 29) % w, (i * 47) % h, 2, 1); });
  c.shell({ wallTex: stripes, floorTex: tiles, panels: false });
  const zc = -D / 2 + K.counter;                                                                     // the counter's front; behind it, the back wall
  /* the counter: laminate, a brass foot rail, and what is kept on it */
  c.flat.box(-W / 2 + 0.3, 0, zc - 0.6, W / 2 - 0.3, 0.95, zc, [0.94, 0.52, 0.12]); c.flat.box(-W / 2 + 0.25, 0.95, zc - 0.66, W / 2 - 0.25, 1.0, zc + 0.06, [0.93, 0.9, 0.82]);
  for (let x = -W / 2 + 0.3; x < W / 2 - 0.3; x += 0.5) c.flat.box(x, 0.02, zc, x + 0.25, 0.9, zc + 0.012, [0.96, 0.94, 0.88]);
  c.flat.box(-W / 2 + 0.3, 0.16, zc + 0.1, W / 2 - 0.3, 0.2, zc + 0.14, [0.7, 0.55, 0.2]);
  c.solid(-W / 2, zc - 0.66, W / 2, zc + 0.06, { tall: false });
  const n = Math.max(3, Math.floor((W - 1.4) / 1.1));
  for (let i = 0; i < n; i++) { const x = -W / 2 + 0.9 + i * ((W - 1.8) / (n - 1)); if (i % 2 === 0) c.model('orange:juicer', juicerVox, x, zc - 0.34, { y: 1.0, rot: Math.PI, solid: false, shadow: false }); else for (let k = 0; k < 3; k++) c.model('orange:cup', cupVox, x + (k - 1) * 0.16, zc - 0.2 - (k % 2) * 0.14, { y: 1.0, solid: false, shadow: false }); }
  const sx = R.pick([-1, 1]) * R.range(0.4, W / 2 - 1.3);
  c.model('orange:cup', cupVox, sx, zc - 0.08, { y: 1.0, scale: 1.3, solid: false, shadow: false }); c.leave('snack', sx + 0.25, zc - 0.1, { y: 1.02 });
  /* the board: what there is, in tube; and the name of the place, twice */
  const names = R.shuffle(MENU.slice()), neon = mallNeon(kit, 'orange:' + p.seed, names, 2), lit = c.shining('mall:neon:orange:' + p.seed, neon.texture, 2.4, undefined, { bloom: 2 });
  const rows = Math.min(4, Math.floor((H - 1.7) / 0.42));
  for (let r = 0; r < rows; r++) for (const side of [-1, 1]) upright(lit, side < 0 ? -W / 2 + 0.4 : 0.2, -D / 2 + 0.04, side < 0 ? -0.2 : W / 2 - 0.4, -D / 2 + 0.04, H - 0.35 - (r + 1) * 0.42, H - 0.35 - r * 0.42, neon.uv((r * 2 + (side > 0 ? 1 : 0)) % 8));
  c.light(-W / 4, H - 0.9, -D / 2 + 0.9, '#ffb02e', 1.0, { k: 1.2, far: 7 }); c.light(W / 4, H - 0.9, -D / 2 + 0.9, '#ff5a3c', 0.9, { k: 1.2, far: 7 }); c.light(0, H - 0.5, D / 4, '#ffd9a0', 0.55, { k: 1.4, far: 6 });
  /* oranges: drifts in the corners; some cut, to show the inside */
  for (const [cx, cz, k] of [[-W / 2 + 0.8, D / 2 - 0.8, 0], [W / 2 - 0.8, D / 2 - 0.9, 1], [W / 2 - 0.7, zc + 0.7, 2], [-W / 2 + 0.7, -D / 2 + 0.7, 3], [W / 2 - 0.9, -D / 2 + 0.8, 4]]) { if (Math.abs(cz) < 1.2 && Math.abs(cx) > W / 2 - 1.6) continue; c.model('orange:heap:' + k, heapVox(k), cx, cz, { rot: R.range(0, 6), scale: k < 3 ? 1.2 : 1.6, solid: false }); if (cz > zc) c.solid(cx - 0.45, cz - 0.45, cx + 0.45, cz + 0.45, { tall: false }); }
  for (let i = 0; i < 6; i++) { const x = R.range(-W / 2 + 0.6, W / 2 - 0.6), z = R.range(zc + 0.5, D / 2 - 0.6); if (Math.abs(x) < 0.9 && z > D / 2 - 1.8) continue; c.model(i % 2 ? 'orange:cut' : 'orange:one', orangeVox(5, !!(i % 2)), x, z, { rot: R.range(0, 6), tilt: i % 2 ? [R.range(-0.5, 0.5), R.range(-0.5, 0.5)] : [0, 0], solid: false }); c.blot(x, z, 0.5, 0.5, { a: 0.3 }); }

  /* the detail: pendant shades, stools, a chiller of bottles, what is kept on the counter, a shelf of jars. Batch `orange:detail` for
     what is only looked at; stools and the chiller are walked into, so they are in the room's own */
  { const det = c.mapped('orange:detail', kit.tex.white(), { detail: true }), chrome = [0.75, 0.77, 0.8], white = [0.94, 0.92, 0.86], orange = [0.94, 0.52, 0.12];
    const shades = c.shining('orange:shades', kit.tex.white(), 1.7, [1, 0.72, 0.32]);
    // pendants over the counter: a flex, a shade like half an orange, the bulb in it lit
    for (let x = -W / 2 + 1.0; x < W / 2 - 0.6; x += 1.4) { const y = H - 0.9; det.box(x - 0.006, y + 0.2, zc + 0.35 - 0.006, x + 0.006, H, zc + 0.35 + 0.006, [0.1, 0.1, 0.1]);
      c.model('orange:shade', () => { const v = new Vox(); v.ellipsoid(0, 6, 0, 9, 8, 9, M('#f08a1e', 1)); v.carve(-9, 0, -9, 9, 6, 9); v.carve(-7, 5, -7, 7, 6, 7); v.cyl('y', 0, 0, 13, 15, 2, M('#3f7a3a', 1)); return v; }, x, zc + 0.35, { y: y, solid: false, shadow: false });
      shades.box(x - 0.05, y + 0.08, zc + 0.3, x + 0.05, y + 0.15, zc + 0.4, [1, 1, 1]); }
    // stools at the counter: a chrome stem, a foot ring, a seat in orange vinyl; screwed down
    for (let x = -W / 2 + 0.9; x < W / 2 - 0.6; x += 0.9) { const z = zc + 0.55; c.model('orange:stool', () => { const v = new Vox(), cr = M('#c9ccd0', 0); v.cyl('y', 0, 0, 0, 1, 8, cr); v.cyl('y', 0, 0, 1, 28, 1.2, cr); v.ring(0, 12, 0, 6, 0.7, cr); v.cyl('y', 0, 0, 28, 30, 6, M('#2a2a2e', 0)); v.cyl('y', 0, 0, 30, 33, 7.5, M('#e8761c', 2), 7); return v; }, x, z, { solid: false });
      c.solid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, { tall: false }); }
    // the chiller: a glass door, shelves of bottles of the drink, lit inside; against the side wall, clear of the way in
    { const side = R.pick(['left', 'right']), sp = c.spans(side, 0.4, 2.2).find(([a, b]) => b - a > 1.2); if (sp) { const m = sp[0] + 0.7, p0 = c.wallAt(side, m - 0.5, 0), p1 = c.wallAt(side, m + 0.5, 0.7);
      c.flat.box(Math.min(p0.x, p1.x), 0, Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), 2.0, Math.max(p0.z, p1.z), white); c.solid(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), { tall: true });
      const lit = c.shining('orange:chiller', kit.tex.white(), 1.3, [0.95, 0.98, 1]); wallBox(c, side, m - 0.44, m + 0.44, 0.15, 1.85, 0.7, 0.705, [1, 1, 1], lit);
      for (let y = 0.25; y < 1.8; y += 0.4) { wallBox(c, side, m - 0.44, m + 0.44, y - 0.01, y, 0.1, 0.69, chrome, det); for (let k = 0; k < 6; k++) { const s0 = m - 0.38 + k * 0.15; wallBox(c, side, s0, s0 + 0.07, y, y + 0.22, 0.6, 0.67, orange, det); wallBox(c, side, s0 + 0.02, s0 + 0.05, y + 0.22, y + 0.28, 0.62, 0.65, white, det); } }
      wallBox(c, side, m - 0.5, m + 0.5, 1.88, 2.0, 0.7, 0.72, orange, det); c.light(c.wallAt(side, m, 1.0).x, 1.2, c.wallAt(side, m, 1.0).z, '#e8f4ff', 0.5, { k: 1.6, far: 3 }); } }
    // on the counter: a straw holder, a napkin box, a till; on the back wall a shelf of jars, each with oranges in it
    for (let x = -W / 2 + 1.3; x < W / 2 - 1; x += 2.4) { det.box(x - 0.05, 1.0, zc - 0.15, x + 0.05, 1.22, zc - 0.05, [0.85, 0.9, 0.95]); for (let k = 0; k < 6; k++) det.box(x - 0.035 + (k % 3) * 0.03, 1.2, zc - 0.13 + Math.floor(k / 3) * 0.04, x - 0.03 + (k % 3) * 0.03, 1.32, zc - 0.125 + Math.floor(k / 3) * 0.04, [0.85, 0.2, 0.18]);
      det.box(x + 0.25, 1.0, zc - 0.2, x + 0.45, 1.09, zc - 0.08, [0.2, 0.2, 0.22]); det.box(x + 0.28, 1.09, zc - 0.18, x + 0.42, 1.12, zc - 0.1, white); }
    det.box(-W / 2 + 0.4, 1.35, -D / 2 + 0.02, W / 2 - 0.4, 1.38, -D / 2 + 0.3, [0.66, 0.52, 0.2]);
    for (let x = -W / 2 + 0.6; x < W / 2 - 0.5; x += 0.45) { c.model('orange:jar', () => { const v = new Vox(), g = M('#d8e6e0', 0); v.cyl('y', 0, 0, 0, 10, 4, g); v.carve(-3, 1, -3, 3, 10, 3); for (let k = 0; k < 3; k++) v.ellipsoid(-1 + k, 2 + k * 3, (k % 2) * 1 - 0.5, 1.6, 1.6, 1.6, M('#f08a1e', 2)); v.cyl('y', 0, 0, 10, 12, 4.2, M('#c9a43a', 0)); return v; }, x, -D / 2 + 0.16, { y: 1.38, solid: false, shadow: false }); }
    }
  /* take a number: a ticket machine at the end of the counter, and a board over it that says who is being served. It counts up
     towards yours and stops one short. Take another and it moves on one, and stops one short of that. Nobody else is queueing */
  { const spot = [[-W / 2 + 0.42, zc + 0.42], [-W / 2 + 0.42, zc + 1.1], [W / 2 - 0.42, zc + 1.5], [W / 2 - 0.42, zc + 2.1]].find(([x, z]) => c.clear(x, z, 0.3));
    if (spot) { const [tx, tz] = spot, face = tx < 0 ? Math.PI / 2 : -Math.PI / 2;
      c.model('orange:ticket', () => { const v = new Vox(), cr = M('#c9ccd0', 0), red = M('#d23a22', 1);
        v.cyl('y', 0, 0, 0, 1, 7, M('#3a3d42', 0)); v.cyl('y', 0, 0, 1, 44, 1.4, cr);
        v.box(-5, 43, -4, 5, 56, 5, red); v.box(-4, 55, -3, 4, 57, 4, red); v.box(-5, 49, 5, 5, 50, 6, M('#f4efe0', 0));
        v.box(-1, 45, 5, 2, 49, 7, M('#f4efe0', 0)); v.box(-3, 51, 5, 3, 54, 6, M('#1a1a1e', 0)); v.box(-2, 52, 6, 2, 53, 7, M('#f08a1e', 2));   // the tongue of the next ticket; a slot and a label
        return v; }, tx, tz, { rot: face, solid: false, shadow: false });
      c.solid(tx - 0.12, tz - 0.12, tx + 0.12, tz + 0.12, { tall: true });
      const bw = 128, bh = 64, board = kit.tex.live(bw, bh, () => {}), g = board.image.getContext('2d');
      board.generateMipmaps = false; board.minFilter = THREE.LinearFilter;
      let served = Math.floor(R.range(21, 88)), mine = 0, next = 0;
      const paint = () => { g.fillStyle = '#0b0605'; g.fillRect(0, 0, bw, bh); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#f08a1e'; g.font = 'bold 11px monospace'; g.fillText('NOW SERVING', bw / 2, 9);
        g.shadowColor = '#ff3020'; g.shadowBlur = 6; g.fillStyle = '#ff4a2a'; g.font = 'bold 34px monospace'; g.fillText(String(served % 100).padStart(2, '0'), bw / 2, 36); g.shadowBlur = 0;
        if (mine) { g.fillStyle = '#f4efe0'; g.font = 'bold 9px monospace'; g.fillText('YOU ' + String(mine % 100).padStart(2, '0'), bw / 2, 58); }
        g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 0; y < bh; y += 2) g.fillRect(0, y, bw, 1); board.needsUpdate = true; };
      paint();
      // hung from the ceiling over the end of the counter, readable from both ways along the room
      const bx = tx < 0 ? Math.max(-W / 2 + 1.25, -W / 4) : Math.min(W / 2 - 1.25, W / 4), bz = zc + 0.95, by0 = Math.max(1.95, H - 0.85), by1 = by0 + 0.34;
      const lit = c.shining('orange:serving', board, 1.6, [1, 1, 1], { bloom: 1 });
      c.board(lit, bx, (by0 + by1) / 2, bz + 0.032, 0.66, 0.33, 0); c.board(lit, bx, (by0 + by1) / 2, bz - 0.032, 0.66, 0.33, Math.PI);
      c.flat.box(bx - 0.36, by0 - 0.02, bz - 0.03, bx + 0.36, by1 + 0.02, bz + 0.03, [0.2, 0.18, 0.18]);
      for (const s of [-1, 1]) c.flat.box(bx + s * 0.28 - 0.008, by1 + 0.02, bz - 0.008, bx + s * 0.28 + 0.008, H, bz + 0.008, [0.6, 0.62, 0.65]);
      const at = c.toWorld(bx, bz);
      const u = c.use({ x: tx + (tx < 0 ? 0.45 : -0.45), z: tz, r: 1.0, label: 'take a number', use: () => {
        mine = mine ? mine + 1 : served + 2 + Math.floor(Math.random() * 3); next = 2.5 + Math.random() * 2; u.label = 'take another number'; paint();
        const w = c.toWorld(tx, tz); c.env.play?.('click', w.x, w.z, 6);
      } });
      c.tick((dt, t, me) => {
        if (!me.inside || !mine || served >= mine - 1) return;
        next -= dt; if (next > 0) return;
        served++; next = 5 + Math.random() * 5; paint(); c.env.play?.('ding', at.x, at.z, 12);   // (run-time dice: not the room's R)
      });
    } }

  /* what moves: the big one over the counter, going round; and who is serving */
  const mat = kit.surface({ vox: true }), mesh = (key, make, k = S) => { const b = new Batch(true); b.addVox(kit.model(key, make).solid, new THREE.Matrix4().makeScale(k, k, k)); return new THREE.Mesh(kit.geometry(b, [lamp(0.4, 2.6, 1.2, [1.25, 1.0, 0.7], { k: 9, wrap: 0.5, far: 30 })], [0.7, 0.6, 0.5]), mat); };
  const big = mesh('orange:big', orangeVox(22, false), S * 1.0), who = mesh('orange:server', dummyVox(1, '#f4efe0', 'orange')), fig = new THREE.Group();
  big.position.set(0, H - 1.55, zc - 0.3); who.position.set(R.range(-1, 1), 0, zc - 1.25); fig.add(big, who); c.add(fig);
  c.flat.box(-0.02, H - 0.45, zc - 0.32, 0.02, H, zc - 0.28, [0.2, 0.2, 0.22]);
  let t0 = 0, face = 0;
  c.tick((dt, t, me) => {
    t0 += dt; big.rotation.y = t0 * K.big; big.position.y = H - 1.55 + Math.sin(t0 * 0.7) * 0.03;
    if (!me.inside) return;
    // it keeps its front to whoever came in, and its place opposite them along the counter: never quickly
    const want = Math.atan2(me.x - who.position.x, me.z - who.position.z); let d = want - face; d = Math.atan2(Math.sin(d), Math.cos(d)); face += d * Math.min(1, dt * K.turn); who.rotation.y = face;
    const tx = Math.max(-W / 2 + 0.8, Math.min(W / 2 - 0.8, me.x)); who.position.x += (tx - who.position.x) * Math.min(1, dt * 0.5);
  });
}
