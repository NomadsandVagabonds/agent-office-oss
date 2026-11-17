// The Backrooms — a shop of the shopping centre (themes.js `mall`): Keys Cut
// ("the key cutter's, all doors"). Somebody was told that in a shopping
// centre there is a little place where they cut you a key. A key is for a
// door. So the walls are doors, every one with a keyhole, packed edge to edge
// to the roof, the size of a cupboard, the size of a stamp, the size of a
// barn; none of them opens. Over the counter the blanks hang in their
// thousands, on strings, to just over your head, and they move when you do.
// The machine does not stop. Along the side, on a shelf, heels: a heel bar,
// as described.
import { P } from '../bits.js';
import { Batch } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { upright, sheet } from '../suburb.js';
import { mallNeon, wallFace, wallBox } from '../mall.js';

export const KEYS = Object.freeze({ counter: 1.3, low: 1.75, every: 0.17, sway: 0.05 });
const WOOD = [[0.62, 0.42, 0.26], [0.78, 0.6, 0.4], [0.5, 0.33, 0.22], [0.92, 0.9, 0.84], [0.42, 0.52, 0.58], [0.66, 0.22, 0.18], [0.36, 0.5, 0.36]];

/** A heel, on its own: a block and a lift, off a shoe that is not there. */
function heelVox(c) { return () => { const v = new Vox(); v.rbox(-2, 0, -2, 2, 6, 2, 1, M(c, 2)); v.box(-2, 0, -2, 2, 0, 2, M('#17171a', 0)); return v; }; }
/** The machine: a grinding wheel, the clamp, the blank in it. */
function machineVox() { const v = new Vox(), b = M('#5a6470', 0); v.rbox(-10, 0, -6, 10, 8, 6, 2, b); v.cyl('z', -4, 12, -2, 2, 5, M('#9aa1a8', 0)); v.cyl('z', -4, 12, -1, 1, 1.4, M('#2a2f36', 0)); v.box(2, 8, -3, 9, 11, 3, b); v.box(3, 11, -1, 12, 12, 1, M('#c9a43a', 0)); v.box(-12, 4, -1, -10, 6, 1, M('#d9433a', 0)); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = KEYS, env = c.env;
  c.shell({ panels: false });
  /* the doors: every wall, packed, floor to roof */
  // (painted white and tinted, door by door: the panels in shadow, a brass knob, and a keyhole that is the darkest thing in the room)
  const door = c.mapped('keys:door', kit.tex.custom('keys:door', 32, 64, (g, w, h) => { P(g, '#e8e4dc', 0, 0, w, h); for (const y of [4, 34]) { P(g, '#a8a49c', 4, y, w - 8, 26); P(g, '#ccc8c0', 5, y + 1, w - 10, 24); P(g, '#fbf8f2', 4, y, w - 8, 1); } P(g, '#c9a43a', w - 9, 30, 5, 4); P(g, '#7a5f1a', w - 9, 33, 5, 1); P(g, '#050403', w - 8, 36, 3, 2); P(g, '#050403', w - 7, 38, 1, 3); P(g, '#8a8680', 0, 0, 1, h); P(g, '#8a8680', w - 1, 0, 1, h); }));
  for (const side of ['back', 'front', 'left', 'right']) for (const [a, b] of c.spans(side, 0.0, 1.0)) {
    const top = Math.min(...[a, b].map((t) => { const q = c.wallAt(side, t, 0.2); return c.ceilAt(q.x, q.z); })) - 0.02;
    let y = 0;
    while (y < top - 0.15) {
      const rowH = Math.min(top - y, y === 0 ? R.pick([2.1, 2.3, 1.2, 0.9]) : R.pick([0.35, 0.6, 0.9, 0.25, 1.2]));
      let s = a; while (s < b - 0.08) {
        const w = Math.min(b - s, rowH * R.range(0.38, 0.6)), x0 = s, x1 = s + w, inset = Math.min(0.05, w * 0.08), tint = WOOD[(((Math.round(s * 7) + Math.round(y * 5)) % 7) + 7) % 7];
        wallBox(c, side, x0, x1, y, y + rowH, 0, 0.03, tint.map((v) => v * 0.6));                                                 // the frame
        wallFace(c, side, x0 + inset, x1 - inset, y + inset, y + rowH - inset * 0.5, door, [0, 0, 1, 1], 0.035, tint);             // the door, in its colour
        s = x1;
      }
      y += rowH;
    }
  }
  /* the counter, the machine, the board of blanks, the name */
  const zc = -D / 2 + K.counter;
  c.flat.box(-W / 2 + 0.2, 0, zc - 0.5, W / 2 - 0.2, 0.95, zc, [0.3, 0.33, 0.36]); c.flat.box(-W / 2 + 0.15, 0.95, zc - 0.55, W / 2 - 0.15, 1.0, zc + 0.05, [0.7, 0.68, 0.62]); c.solid(-W / 2, zc - 0.55, W / 2, zc + 0.05, { tall: false });
  const mx = R.range(-W / 4, W / 4); c.model('keys:machine', machineVox, mx, zc - 0.25, { y: 1.0, rot: Math.PI, solid: false, shadow: false });
  const neon = mallNeon(kit, 'keys:' + p.seed, ['KEYS CUT', 'HEELS', 'KEYS CUT HEELS', 'WHILE YOU WAIT', 'ANY KEY', 'NO KEY', 'DOORS', 'KEYS KEYS'], p.seed), lit = c.shining('mall:neon:keys:' + p.seed, neon.texture, 2.4);
  for (const [z, i, s] of [[zc + 0.06, 2, 1], [zc - 0.56, 0, -1]]) upright(lit, -s * (W / 2 - 0.4), z, s * (W / 2 - 0.4), z, 1.02, 1.38, neon.uv(i));
  c.light(mx, 1.5, zc + 0.3, '#ffb02e', 0.8, { k: 1.3, far: 5 }); c.light(0, H - 0.5, D / 4, '#ffe9c2', 0.6, { k: 1.4, far: 6 });
  /* heels, on a shelf along a side */
  const side = R.pick(['left', 'right']), spans = c.spans(side, 0.3, 1.5);
  if (spans.length) { const [a, b] = spans[0]; for (const y of [0.9, 1.3]) { wallBox(c, side, a, b, y - 0.03, y, 0, 0.25, [0.66, 0.52, 0.2]); for (let s = a + 0.12; s < b - 0.1; s += 0.14) { const q = c.wallAt(side, s, 0.12), k = ((Math.round(s * 10) % 3) + 3) % 3; c.model('keys:heel:' + k, heelVox(['#3a2a1c', '#17171a', '#7a3a34'][k]), q.x, q.z, { y, scale: 1.3, rot: R.range(0, 6), solid: false, shadow: false }); } } }
  /* the blanks, on strings, from the roof to just over your head; they move when you do */
  const strand = kit.tex.custom('keys:strand', 16, 128, (g, w, h) => { g.clearRect(0, 0, w, h); P(g, '#55504a', 7, 0, 1, h); for (let y = 6; y < h; y += 11) { const gold = (y / 11) % 3 === 0; P(g, gold ? '#c9a43a' : '#a8adb3', 4, y, 7, 5); P(g, gold ? '#8a7020' : '#6e7378', 6, y + 1, 3, 3); P(g, gold ? '#c9a43a' : '#a8adb3', 6, y + 5, 3, 5); P(g, gold ? '#c9a43a' : '#a8adb3', 8, y + 7, 2, 1); } }, { clamp: true });
  const curtain = new Batch();
  for (let x = -W / 2 + 0.4; x < W / 2 - 0.3; x += K.every) for (let z = -D / 2 + 0.3; z < zc + 0.6; z += K.every * 1.3) { const low = K.low + R.range(-0.08, 0.25), j = R.range(-0.04, 0.04), a = R.range(0, 3.14); const dx = Math.cos(a) * 0.04, dz = Math.sin(a) * 0.04;
    sheet(curtain, [x + j - dx, low, z - dz], [x + j + dx, low, z + dz], [x + j + dx, H, z + dz], [x + j - dx, H, z - dz], 1, 1, [0, 0, 1, (H - low) / 1.4]); sheet(curtain, [x + j + dx, low, z + dz], [x + j - dx, low, z - dz], [x + j - dx, H, z - dz], [x + j + dx, H, z + dz], 1, 1, [0, 0, 1, (H - low) / 1.4]); }
  const hang = c.dynamic(curtain, { pivot: [0, H, (zc - D / 2) / 2], map: strand, cutout: true, side: 2 });
  let t0 = 0, push = 0;
  c.tick((dt, t, me) => {
    t0 += dt; if (me.inside) push = Math.min(1, push + (me.speed || 0) * dt * 0.6); push *= Math.exp(-dt * 0.8);
    hang.rotation.x = Math.sin(t0 * 1.3) * K.sway * (0.15 + push); hang.rotation.z = Math.sin(t0 * 1.7 + 1) * K.sway * (0.15 + push);
    if (me.inside && Math.random() < dt * 1.5) { const w = c.toWorld(mx, zc); env.play?.('click', w.x, w.z, 5); }
  });
}
