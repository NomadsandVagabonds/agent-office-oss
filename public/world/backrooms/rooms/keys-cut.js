// The Backrooms — a shop of the shopping centre (themes.js `mall`): Keys Cut
// ("the key cutter's, all doors"). Somebody was told that in a shopping
// centre there is a little place where they cut you a key. A key is for a
// door. So the walls are doors, every one with a keyhole, packed edge to edge
// to the roof, the size of a cupboard, the size of a stamp, the size of a
// barn; none of them opens. Over the counter the blanks hang in their
// thousands, on strings, to just over your head, and they move when you do.
// The machine does not stop. Along the side, on a shelf, heels: a heel bar,
// as described.
import * as THREE from 'three';
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

/** On the counter by the machine: a vice, a tray of brass filings, a stand of key tags, and the blanks it got wrong. */
function benchVox() {
  const v = new Vox(), iron = M('#4a5058', 0), jaw = M('#8a9098', 0), brass = M('#c9a43a', 0), dull = M('#8a7020', 0), tray = M('#2a2d32', 0);
  v.box(-14, 0, -3, -4, 2, 3, iron); v.box(-13, 2, -2, -11, 7, 2, iron); v.box(-7, 2, -2, -5, 7, 2, iron); v.box(-11, 5, -1, -7, 7, 1, jaw); v.tube(-5, 6, 0, 0, 6, 0, 0.5, jaw); v.box(-1, 4, -1, 0, 8, 1, jaw);   // the vice, a blank in it
  v.box(-10, 7, 0, -8, 11, 1, brass);
  v.box(2, 0, -4, 12, 1, 4, tray); v.box(2, 1, -4, 12, 2, -3, tray); v.box(2, 1, 3, 12, 2, 4, tray); v.box(2, 1, -4, 3, 2, 4, tray); v.box(11, 1, -4, 12, 2, 4, tray);
  for (let i = 0; i < 22; i++) { const x = 3 + ((i * 7) % 8), z = -3 + ((i * 5) % 6); v.set(x, 1, z, i % 3 ? brass : dull); }                              // filings, and what was cut
  for (const [x, z, r] of [[5, -1, 0], [8, 1, 1], [10, -2, 0]]) { v.box(x, 2, z, x + 3, 3, z + 1, r ? M('#a8adb3', 0) : brass); v.box(x + 3, 2, z, x + 5, 3, z + 1, brass); }
  v.cyl('y', 18, 0, 0, 1, 3, iron); v.cyl('y', 18, 0, 1, 16, 0.6, jaw);                                                                                 // the tag stand
  const tags = ['#d9433a', '#3f7a3a', '#2a4a6a', '#e8c040', '#e8e2d0', '#b3261e'];
  for (let i = 0; i < 12; i++) { const a = i * 0.9, y = 5 + (i % 4) * 3, x = 18 + Math.round(Math.cos(a) * 3), z = Math.round(Math.sin(a) * 3); v.box(x - 1, y - 2, z, x + 1, y, z + 1, M(tags[i % 6], 1)); v.set(x, y, z, jaw); }
  return v;
}

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = KEYS, env = c.env;
  c.shell({ panels: false });
  /* the doors: every wall, packed, floor to roof */
  // (painted white and tinted, door by door: the panels in shadow, a brass knob, and a keyhole that is the darkest thing in the room)
  const doorTex = kit.tex.custom('keys:door', 32, 64, (g, w, h) => { P(g, '#e8e4dc', 0, 0, w, h); for (const y of [4, 34]) { P(g, '#a8a49c', 4, y, w - 8, 26); P(g, '#ccc8c0', 5, y + 1, w - 10, 24); P(g, '#fbf8f2', 4, y, w - 8, 1); } P(g, '#c9a43a', w - 9, 30, 5, 4); P(g, '#7a5f1a', w - 9, 33, 5, 1); P(g, '#050403', w - 8, 36, 3, 2); P(g, '#050403', w - 7, 38, 1, 3); P(g, '#8a8680', 0, 0, 1, h); P(g, '#8a8680', w - 1, 0, 1, h); }), door = c.mapped('keys:door', doorTex);
  const zc = -D / 2 + K.counter, ground = [], lows = [], heelSide = R.pick(['left', 'right']), shelf = c.spans(heelSide, 0.3, 1.5)[0];   // (the heels' shelf: its wall and stretch, chosen first, so no door opens through it)
  for (const side of ['back', 'front', 'left', 'right']) for (const [a, b] of c.spans(side, 0.0, 1.0)) {
    const top = Math.min(...[a, b].map((t) => { const q = c.wallAt(side, t, 0.2); return c.ceilAt(q.x, q.z); })) - 0.02;
    let y = 0;
    while (y < top - 0.15) {
      const rowH = Math.min(top - y, y === 0 ? R.pick([2.1, 2.3, 1.2, 0.9]) : R.pick([0.35, 0.6, 0.9, 0.25, 1.2]));
      let s = a; while (s < b - 0.08) {
        const w = Math.min(b - s, rowH * R.range(0.38, 0.6)), x0 = s, x1 = s + w, inset = Math.min(0.05, w * 0.08), tint = WOOD[(((Math.round(s * 7) + Math.round(y * 5)) % 7) + 7) % 7];
        wallBox(c, side, x0, x1, y, y + rowH, 0, 0.03, tint.map((v) => v * 0.6));                                                 // the frame
        const mid = c.wallAt(side, (x0 + x1) / 2, 0.75);
        if (y === 0 && w >= 0.3 && side !== 'back' && mid.z > zc + 0.6 && c.clear(mid.x, mid.z, 0.3)) lows.push({ side, x0, x1, inset });
        if (y === 0 && rowH >= 1.15 && w >= 0.5 && side !== 'back' && !(side === heelSide && shelf && x1 > shelf[0] - 0.1 && x0 < shelf[1] + 0.1) && mid.z > zc + 0.6 && c.clear(mid.x, mid.z, 0.3)) ground.push({ side, x0, x1, y1: rowH, inset, tint, at: mid });   // (one of these will open; it is drawn after)
        else wallFace(c, side, x0 + inset, x1 - inset, y + inset, y + rowH - inset * 0.5, door, [0, 0, 1, 1], 0.035, tint);        // the door, in its colour
        s = x1;
      }
      y += rowH;
    }
  }
  /* the counter, the machine, the board of blanks, the name */
  c.flat.box(-W / 2 + 0.2, 0, zc - 0.5, W / 2 - 0.2, 0.95, zc, [0.3, 0.33, 0.36]); c.flat.box(-W / 2 + 0.15, 0.95, zc - 0.55, W / 2 - 0.15, 1.0, zc + 0.05, [0.7, 0.68, 0.62]); c.solid(-W / 2, zc - 0.55, W / 2, zc + 0.05, { tall: false });
  const mx = R.range(-W / 4, W / 4); c.model('keys:machine', machineVox, mx, zc - 0.25, { y: 1.0, rot: Math.PI, solid: false, shadow: false });
  const neon = mallNeon(kit, 'keys:' + p.seed, ['KEYS CUT', 'HEELS', 'KEYS CUT HEELS', 'WHILE YOU WAIT', 'ANY KEY', 'NO KEY', 'DOORS', 'KEYS KEYS'], p.seed), lit = c.shining('mall:neon:keys:' + p.seed, neon.texture, 2.4, undefined, { bloom: 2 });
  const ms = mx >= 0 ? 1 : -1, end = mx - ms * 0.45;                       // (the front one along the half of the counter away from the machine: the whole length hid the machine and all on it)
  upright(lit, Math.min(-ms * (W / 2 - 0.4), end), zc + 0.06, Math.max(-ms * (W / 2 - 0.4), end), zc + 0.06, 1.02, 1.38, neon.uv(2)); upright(lit, W / 2 - 0.4, zc - 0.56, -(W / 2 - 0.4), zc - 0.56, 1.02, 1.38, neon.uv(0));
  c.model('keys:bench', benchVox, mx + (mx >= 0 ? 1 : -1) * 0.7, zc - 0.28, { y: 1.0, rot: Math.PI + R.range(-0.2, 0.2), solid: false, shadow: false });
  c.light(mx, 1.5, zc + 0.3, '#ffb02e', 0.8, { k: 1.3, far: 5 }); c.light(0, H - 0.5, D / 4, '#ffe9c2', 0.6, { k: 1.4, far: 6 });
  /* heels, on a shelf along a side */
  if (shelf) { const side = heelSide, [a, b] = shelf; for (const y of [0.9, 1.3]) { wallBox(c, side, a, b, y - 0.03, y, 0, 0.25, [0.66, 0.52, 0.2]); for (let s = a + 0.12; s < b - 0.1; s += 0.14) { const q = c.wallAt(side, s, 0.12), k = ((Math.round(s * 10) % 3) + 3) % 3; c.model('keys:heel:' + k, heelVox(['#3a2a1c', '#17171a', '#7a3a34'][k]), q.x, q.z, { y, scale: 1.3, rot: R.range(0, 6), solid: false, shadow: false }); } } }
  /* one door of them all opens, to the key the machine cuts you: E at the machine, and while it grinds the keyhole of one door, somewhere
     on the walls, begins to shine. Try the key there and the door opens, onto a smaller door, in its frame, with its keyhole. The key
     does not fit that one. Somebody on the other side of it knocks, once. (The rest, and the light under another one, are only doors) */
  const pick = R.shuffle(ground), the = pick[0], others = lows.filter((l) => !the || l.side !== the.side || l.x0 !== the.x0), under = others.length ? R.pick(others) : null;
  for (const g of pick.slice(the ? 1 : 0)) wallFace(c, g.side, g.x0 + g.inset, g.x1 - g.inset, g.inset, g.y1 - g.inset * 0.5, door, [0, 0, 1, 1], 0.035, g.tint);
  if (under) { const glow = c.shining('keys:under', kit.tex.white(), 1.6, [1, 0.78, 0.45], { bloom: 1.5 }); wallBox(c, under.side, under.x0 + under.inset + 0.02, under.x1 - under.inset - 0.02, 0, 0.012, 0.03, 0.05, [1, 1, 1], glow);
    const q = c.wallAt(under.side, (under.x0 + under.x1) / 2, 0.25); c.light(q.x, 0.06, q.z, '#ffc070', 0.32, { k: 2.2, far: 1.6 }); }   // (light under a door: somebody is in)
  if (the) {
    const { side, x0, x1, y1, inset, tint } = the, a = x0 + inset, b = x1 - inset, w = b - a, m = (a + b) / 2;
    wallBox(c, side, a, b, inset * 0.5, y1 - inset * 0.5, 0.03, 0.032, [0.05, 0.04, 0.04]);                                                       // the dark behind it…
    const sw = w * 0.34, sy = (y1 - inset) * 0.66; wallBox(c, side, m - sw - 0.03, m + sw + 0.03, inset, sy + 0.03, 0.03, 0.033, tint.map((v) => v * 0.55));
    wallFace(c, side, m - sw, m + sw, inset, sy, door, [0, 0, 1, 1], 0.034, tint.map((v) => v * 0.85));                                            // …and the door in it
    const leaf = new Batch(); wallBox(c, side, a, b, inset, y1 - inset * 0.5, 0.036, 0.058, tint.map((v) => v * 0.8), leaf); wallFace(c, side, a, b, inset, y1 - inset * 0.5, leaf, [0, 0, 1, 1], 0.06, tint);
    const turn = side === 'left' || side === 'front', hinge = c.wallAt(side, turn ? b : a, 0.036), far = c.wallAt(side, turn ? a : b, 0.036),   // (the knob is at the texture's right: hinged on its left)
      swing = c.dynamic(leaf, { pivot: [hinge.x, 0, hinge.z], map: doorTex });
    const vx = far.x - hinge.x, vz = far.z - hinge.z, sign = (vx * Math.cos(0.5) + vz * Math.sin(0.5) - vx) * hinge.n[0] + (-vx * Math.sin(0.5) + vz * Math.cos(0.5) - vz) * hinge.n[2] > 0 ? 1 : -1;
    const holeGeo = c.kit.own(new THREE.BoxGeometry(0.035, 0.05, 0.03));
    const hole = (s, y, d) => { const q = c.wallAt(side, s, d); const m3 = new THREE.Mesh(holeGeo, c.kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.75, 0.3) }))); m3.position.set(q.x, y, q.z); m3.visible = false; c.add(m3); return m3; };
    const uS = (u, l, r) => (turn ? r - (r - l) * u : l + (r - l) * u), big = hole(uS(0.75, a, b), inset + (y1 - 1.5 * inset) * (1 - 37 / 64), 0.06), small = hole(uS(0.75, m - sw, m + sw), inset + (sy - inset) * (1 - 37 / 64), 0.034);
    const st = { now: 'none', t: 0, ang: 0 }, sound = (name, s0, vol) => { const q = c.toWorld(s0.x, s0.z); env.play?.(name, q.x, q.z, vol); };
    c.use({ x: mx, z: zc + 0.45, r: 0.9, label: 'have a key cut', when: () => st.now === 'none', use: () => { st.now = 'cutting'; st.t = 3.2; sound('whir', { x: mx, z: zc }, 7); } });
    c.use({ x: the.at.x, z: the.at.z, r: 0.85, label: 'try the key', when: () => st.now === 'cut', use: () => { st.now = 'opening'; big.visible = false; sound('creak', the.at, 8); } });
    c.use({ x: the.at.x, z: the.at.z, r: 0.85, label: 'try the key', when: () => st.now === 'open', use: () => { st.now = 'tried'; st.t = 1.1; small.visible = false; sound('click', the.at, 5); } });
    c.tick((dt, t, me) => {
      if (st.now === 'cutting') { st.t -= dt; if (Math.random() < dt * 8) sound('click', { x: mx, z: zc }, 5); if (st.t <= 0) { st.now = 'cut'; big.visible = true; sound('ding', { x: mx, z: zc }, 6); } }
      if (big.visible || small.visible) { const k = 0.75 + 0.25 * Math.sin(t * 5); (big.visible ? big : small).material.color.setRGB(k, k * 0.75, k * 0.3); }
      if (st.now === 'opening') { st.ang = Math.min(1.45, st.ang + dt * 0.9); if (st.ang >= 1.45) { st.now = 'open'; small.visible = true; } }
      if (st.now === 'tried') { st.t -= dt; if (st.t <= 0) { st.now = 'heard'; sound('knock', the.at, 9); } }
      if (!me.inside && st.now !== 'none' && st.now !== 'cutting') { st.ang = Math.max(0, st.ang - dt * 0.6); if (st.ang <= 0) { st.now = 'none'; big.visible = small.visible = false; } }   // (shut again, while nobody is looking)
      swing.rotation.y = sign * st.ang;
    });
  }
  /* the blanks, on strings, from the roof to just over your head; they move when you do */
  const strand = kit.tex.custom('keys:strand', 16, 128, (g, w, h) => { g.clearRect(0, 0, w, h); P(g, '#55504a', 7, 0, 1, h); for (let y = 6; y < h; y += 11) { const gold = (y / 11) % 3 === 0; P(g, gold ? '#c9a43a' : '#a8adb3', 4, y, 7, 5); P(g, gold ? '#8a7020' : '#6e7378', 6, y + 1, 3, 3); P(g, gold ? '#c9a43a' : '#a8adb3', 6, y + 5, 3, 5); P(g, gold ? '#c9a43a' : '#a8adb3', 8, y + 7, 2, 1); } }, { clamp: true });
  const curtain = new Batch();
  for (let x = -W / 2 + 0.4; x < W / 2 - 0.3; x += K.every) for (let z = -D / 2 + 0.3; z < zc + 0.6; z += K.every * 1.3) { const low = K.low + R.range(-0.08, 0.25), j = R.range(-0.04, 0.04), a = R.range(0, 3.14); const dx = Math.cos(a) * 0.04, dz = Math.sin(a) * 0.04;
    sheet(curtain, [x + j - dx, low, z - dz], [x + j + dx, low, z + dz], [x + j + dx, H, z + dz], [x + j - dx, H, z - dz], 1, 1, [0, 0, 1, (H - low) / 1.4]); }
  const hang = c.dynamic(curtain, { pivot: [0, H, (zc - D / 2) / 2], map: strand, cutout: true, side: 2 });
  let t0 = 0, push = 0;
  c.tick((dt, t, me) => {
    t0 += dt; if (me.inside) push = Math.min(1, push + (me.speed || 0) * dt * 0.6); push *= Math.exp(-dt * 0.8);
    hang.rotation.x = Math.sin(t0 * 1.3) * K.sway * (0.15 + push); hang.rotation.z = Math.sin(t0 * 1.7 + 1) * K.sway * (0.15 + push);
    if (me.inside && Math.random() < dt * 1.5) { const w = c.toWorld(mx, zc); env.play?.('click', w.x, w.z, 5); }
  });
}
