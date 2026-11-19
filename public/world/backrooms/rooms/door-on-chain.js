// The Door on the Chain (docs/art-direction/yellow-office, "The Door on the Chain"; the owner's pick for the build).
// Two ends and a short low passage. What looks like a wood-panelled hall is the gap behind one enormous office door
// standing ajar: its back face is the left wall, the panels of an office door at six and a half times (the same four-panel door
// as the one at the far end, wooddoor.model.js, to the voxel), a crack of light at its hinge, a dark slot behind its
// latch edge. Across the hall a brass security chain the size of the corridor, four long faceted links from a slide plate
// on the door to a steel plate on the yellow wall, sagging, its wall end raised and lit. Under that end there is room to
// get by (the automatic duck does the rest, player.js); past it, a slice of ordinary office and an ordinary door, open,
// which is the scale given away. Walk it back and it is the same thing the other way: the latch edge, the chain, the hall.
// Where everything is, and what a body meets, is rooms/door-on-chain/rule.js: the builder draws from the same numbers.
import { lin, WHITE } from '../kit.js';
import { woodLeaf, doorFrame } from '../bits.js';
import { planOf, CHAIN, DOOR_PARTS, roomHead, headwayOf, gapUnder, corners } from './door-on-chain/rule.js';

const BRASS = lin('#b58f3e'), BRASS_DARK = lin('#6f5524'), STEEL = lin('#8e9094'), STEEL_DARK = lin('#4c4e52'), CREAM = lin('#ddd2b4');

/** An oriented box (rule.js linkBars: centre, three axes, half sizes) into a batch, each face lit on its own. */
function obox(batch, b, rgb) {
  const P = corners(b), idx = (i, j, k) => P[(i > 0 ? 4 : 0) + (j > 0 ? 2 : 0) + (k > 0 ? 1 : 0)];
  const faces = [
    [idx(1, -1, -1), idx(1, 1, -1), idx(1, 1, 1), idx(1, -1, 1)], [idx(-1, -1, -1), idx(-1, -1, 1), idx(-1, 1, 1), idx(-1, 1, -1)],
    [idx(-1, 1, -1), idx(-1, 1, 1), idx(1, 1, 1), idx(1, 1, -1)], [idx(-1, -1, -1), idx(1, -1, -1), idx(1, -1, 1), idx(-1, -1, 1)],
    [idx(-1, -1, 1), idx(1, -1, 1), idx(1, 1, 1), idx(-1, 1, 1)], [idx(-1, -1, -1), idx(-1, 1, -1), idx(1, 1, -1), idx(1, -1, -1)],
  ];
  for (const f of faces) {
    // (wound so that it faces away from the middle of the box, whichever way its axes happen to turn)
    const m = [0, 1, 2].map((d) => (f[0][d] + f[1][d] + f[2][d] + f[3][d]) / 4 - b.c[d]);
    const u = [0, 1, 2].map((d) => f[1][d] - f[0][d]), v = [0, 1, 2].map((d) => f[3][d] - f[0][d]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const flip = n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0, up = (flip ? -n[1] : n[1]) / (Math.hypot(n[0], n[1], n[2]) || 1);
    if (flip) f.reverse();
    // (the facets: one turned up to the tubes is the polished one, one turned down has the dirt in it)
    batch.quad(f[0], f[1], f[2], f[3], rgb.map((v) => Math.min(1, v * (1 + 0.28 * up))));
  }
}

/** Wood, its grain running up (`up`) or along: a texture of a few metres of it. */
function grain(kit, hex, up) {
  return kit.tex.custom(`chainwood:${hex}:${up ? 'v' : 'h'}`, up ? 32 : 64, up ? 64 : 32, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    let s = 0x2f6a1 ^ hex.length;
    const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) >>> 0) / 4294967296);
    for (let i = 0; i < 46; i++) {
      const at = Math.floor(rnd() * (up ? w : h)), len = 6 + rnd() * (up ? h : w), from = rnd() * (up ? h : w), dark = rnd() < 0.62;
      g.fillStyle = dark ? 'rgba(40,20,8,0.22)' : 'rgba(255,220,170,0.10)';
      if (up) g.fillRect(at, from, 1, len); else g.fillRect(from, at, len, 1);
    }
  });
}

export function build(c) {
  const { W, D, H, params: p, kit } = c;
  const plan = planOf(W, D, H), o = CHAIN, face = plan.face, half = W / 2;
  c.shell({ panels: false, sockets: false });

  /* ---- what a body meets: the floor plan's solids, and the headroom under the chain (rule.js, the numbers drawn below) */
  for (const s of plan.solids) c.solid(s.x0, s.z0, s.x1, s.z1, { tall: s.tall, keep: true });
  c.rt.headY = (x, z) => roomHead(plan, x, z);
  // (the most headroom the widest of the cast, half a metre across its middle, gets on the only way through: anything
  // taller does not set off into the room, cast/walk.js. Only the small ones go under the chain: the toner, the worms)
  c.rt.headway = headwayOf(plan, 0.5);

  /* ---- the door: an office door at 6.5 times (its lower two panels show under the ceiling), seen from behind, from its latch edge to its hinge */
  const wood = lin(p.wood), up = c.mapped('chainwoodV', grain(kit, p.wood, true)), along = c.mapped('chainwoodH', grain(kit, p.wood, false));
  const sunk = wood.map((v) => v * 0.74), bead = wood.map((v) => v * 0.55), pale = wood.map((v) => Math.min(1, v * 1.12));
  const S = DOOR_PARTS.vox * o.scale, Z = (u) => plan.edge + u * S, foot = 0.05;          // (u: voxels of the ordinary door from its latch edge)
  const deep = face - S;                                                                     // the panels are sunk one voxel
  // the slab itself, at the depth of its sunk panels: its latch edge shows how thick it is; behind the edge a dark slot
  c.pillar((face - o.thick + deep) / 2, (plan.edge + plan.hinge) / 2, deep - (face - o.thick), plan.hinge - plan.edge, { batch: up, skirting: false, solid: false, h: H });
  c.pillar((-half + face - o.thick) / 2, (plan.edge + o.crack + plan.hinge) / 2, face - o.thick + half, plan.hinge - plan.edge - o.crack, { batch: c.mapped('chainslot', kit.tex.white()), skirting: false, solid: false, h: H, alb: wood.map((v) => v * 0.32) });
  // its frame, proud of the panels: two stiles, the muntin, the bottom rail (the lock rail is far above the ceiling)
  const { across, stile, foot: rail, mid } = DOOR_PARTS, m0 = (across - mid) / 2, m1 = m0 + mid;
  const piece = (batch, u0, u1, y0, y1, rgb = WHITE) => batch.box(deep, y0, Z(u0), face, y1, Z(u1), rgb, { skip: '+y-y-x', uv: 0.8, step: 0.5 });
  piece(up, 0, stile, foot, H); piece(up, across - stile, across, foot, H); piece(up, m0, m1, rail * S, H);
  piece(along, stile, across - stile, foot, rail * S);
  // the latch edge (the stile's end grain, and the pillar's face behind it, are the slab's thickness)
  up.box(face - o.thick, foot, plan.edge - 0.002, face, H, plan.edge, wood.map((v) => v * 0.86), { skip: '+z+y-y+x-x', uv: 0.8 });
  // two panels sunk in the frame: a dark bead round each, a field standing in the middle of it, its lit and its shaded edge
  for (const [u0, u1] of [[stile, m0], [m1, across - stile]]) {
    const y0 = rail * S, inset = 4 * S;
    c.flat.box(deep, y0, Z(u0), deep + 0.004, y0 + S * 0.5, Z(u1), bead, { skip: '-x+y-y' });
    c.flat.box(deep, y0, Z(u0), deep + 0.004, H, Z(u0) + S * 0.5, bead, { skip: '-x+y-y' });
    c.flat.box(deep, y0, Z(u1) - S * 0.5, deep + 0.004, H, Z(u1), bead, { skip: '-x+y-y' });
    c.flat.box(deep, y0 + S * 0.5, Z(u0) + S * 0.5, deep + 0.002, H, Z(u1) - S * 0.5, sunk, { skip: '-x+y-y' });
    up.box(deep, y0 + inset, Z(u0) + inset, face, H, Z(u1) - inset, WHITE, { skip: '-x+y-y', uv: 0.8, step: 0.5 });
    c.flat.box(face - 0.004, y0 + inset, Z(u0) + inset, face + 0.002, y0 + inset + S, Z(u1) - inset, wood.map((v) => v * 0.88), { skip: '-x+y-y' });
    c.flat.box(face - 0.004, y0 + inset + S, Z(u1) - inset - S, face + 0.002, H, Z(u1) - inset, pale, { skip: '-x+y-y' });
  }
  // under the door, the gap it swings over, and the dark it leaves on the carpet
  c.flat.box(face - o.thick + 0.02, 0, plan.edge, face - 0.03, foot, plan.hinge, [0.03, 0.025, 0.02], { skip: '-y' });
  c.blot(face + 0.12, (plan.edge + plan.hinge) / 2, 0.3, plan.hinge - plan.edge, { a: 0.42 });
  // the hinge edge: the crack of light between it and the jamb, and a knuckle of the hinge across it
  const crack = c.shining('chaincrack', kit.tex.white(), 1.7, lin('#fff3d6'), { bloom: 1.2 });
  crack.quad([face - 0.28, foot, plan.jambZ], [face - 0.28, foot, plan.hinge], [face - 0.28, H, plan.hinge], [face - 0.28, H, plan.jambZ]);
  c.flat.box(face - 0.3, 0, plan.hinge, face - 0.28, H, plan.jambZ, [0.02, 0.02, 0.02], { skip: '+y-y' });
  c.flat.box(face - 0.05, 0.94, plan.hinge, face + 0.1, 1.66, plan.jambZ, BRASS, { skip: '-x' });
  c.detail.box(face + 0.1, 1.0, plan.hinge + 0.005, face + 0.112, 1.6, plan.jambZ - 0.005, BRASS_DARK);
  // the slot behind the latch edge goes back into the dark, and at its end daylight as thin as a pencil
  const sliver = c.shining('chainsliver', kit.tex.white(), 1.5, lin('#fff6e4'), { bloom: 1 });
  sliver.quad([-half + 0.045, foot, plan.edge + o.crack - 0.004], [-half + 0.012, foot, plan.edge + o.crack - 0.004], [-half + 0.012, H, plan.edge + o.crack - 0.004], [-half + 0.045, H, plan.edge + o.crack - 0.004]);
  c.light(-half + 0.1, 1.4, plan.edge + 0.1, '#fff1d8', 0.16, { k: 0.5, far: 1.6 });
  // the latch, standing out of the edge over everybody's head
  const t = plan.tongue;
  if (plan.overhead.includes(t)) { c.flat.box(t.x0, t.y0, t.z0, t.x1, t.y1, t.z1, BRASS); c.flat.box(t.x0 - 0.05, t.y0 - 0.1, plan.edge - 0.012, t.x1 + 0.05, t.y1 + 0.1, plan.edge, BRASS_DARK); }

  /* ---- the jamb at the hinge, in the cream every door frame down here is, and the wall from it to the way in */
  c.flat.box(-half, 0, plan.jambZ, face + o.proud, H, plan.jambZ + o.jamb, CREAM, { skip: '+y-y-x', step: 0.5 });
  c.detail.box(face + o.proud, 0.4, plan.jambZ + 0.06, face + o.proud + 0.012, H, plan.jambZ + 0.08, CREAM.map((v) => v * 0.8));
  const wallZ0 = plan.jambZ + o.jamb;
  if (D / 2 - wallZ0 > 0.05) c.pillar((-half + face) / 2, (wallZ0 + D / 2) / 2, face + half, D / 2 - wallZ0, { solid: false, h: H });

  /* ---- the chain: four links of square brass, each face its own shade; the knob in its slide plate; the plate on the wall */
  const pl = plan.plate, st = plan.strike, kn = plan.knob;
  plan.links.forEach((l, i) => l.bars.forEach((b, j) => obox(c.flat, b, BRASS.map((v) => v * (0.86 + 0.14 * ((i + j) % 3) / 2)))));
  c.flat.box(pl.x0, pl.y0, pl.z0, pl.x1, pl.y1, pl.z1, BRASS, { skip: '-x' });
  c.flat.box(pl.x1, o.doorY - 0.035, pl.z0 + 0.1, pl.x1 + 0.004, o.doorY + 0.035, pl.z1 - 0.1, BRASS_DARK, { skip: '-x' });      // the slot it slides in
  c.flat.box(kn.x0, kn.y0, kn.z0, kn.x1, kn.y1, kn.z1, BRASS.map((v) => v * 1.08));
  c.flat.box(st.x0, st.y0, st.z0, st.x1, st.y1, st.z1, STEEL, { skip: '+x' });
  c.flat.box(st.x0 - 0.004, o.wallY - 0.2, plan.zc - 0.09, st.x0, o.wallY + 0.2, plan.zc + 0.09, [0.02, 0.02, 0.02], { skip: '+x' });   // the hole the chain goes into
  for (const [y, z] of [[pl.y0 + 0.06, pl.z0 + 0.06], [pl.y1 - 0.06, pl.z0 + 0.06], [pl.y0 + 0.06, pl.z1 - 0.06], [pl.y1 - 0.06, pl.z1 - 0.06]]) c.detail.box(pl.x1, y - 0.018, z - 0.018, pl.x1 + 0.012, y + 0.018, z + 0.018, BRASS_DARK);
  for (const [y, z] of [[st.y0 + 0.07, st.z0 + 0.07], [st.y1 - 0.07, st.z0 + 0.07], [st.y0 + 0.07, st.z1 - 0.07], [st.y1 - 0.07, st.z1 - 0.07]]) c.detail.box(st.x0 - 0.012, y - 0.022, z - 0.022, st.x0, y + 0.022, z + 0.022, STEEL_DARK);
  c.keepWall('right', plan.zc - 0.6, plan.zc + 0.6);
  // the carpet under the raised end, worn by everybody who has stooped there; the shadow of the sag on the rest of it
  const gap = gapUnder(plan);
  if (gap) c.blot((gap.x0 + gap.x1) / 2, plan.zc, gap.x1 - gap.x0 + 0.5, 1.3, { a: 0.16, rgb: [0.12, 0.1, 0.04] });
  c.blot(0, plan.zc, 2.6, 0.5, { a: 0.22 });

  /* ---- the ordinary door, the far end: its frame, and its leaf standing open into this room */
  const back = c.room.doors.find((d) => d.side === 'back');
  if (back) {
    const h = Math.min(back.h ?? 2.05, o.ordinary.h + 0.02), w = back.w;
    doorFrame(c, 'back', back.c, w, h, CREAM);
    const lf = plan.leaf;
    woodLeaf(c, c.vox, [lf.x0, 0.012, (lf.z0 + lf.z1) / 2], [0, 0, 1], [0, 1, 0], [1, 0, 0], lf.z1 - lf.z0, h - 0.02, lf.x1 - lf.x0, wood);
    c.shadow((lf.x0 + lf.x1) / 2, (lf.z0 + lf.z1) / 2, 0.05, lf.z1 - lf.z0, 0.35);
  }
  c.reserve(0, -D / 2 + 1.1, 0.8);
  c.reserve(half - 0.8, -D / 2 + 1.8, 0.5);                 // (where a coin is hidden: the stash in deck2.js)

  /* ---- the ceiling's own: three fittings down the middle (the one over the raised end on the lit side), its stains */
  c.fitting(0.3, D / 2 - 1.6, { dead: p.dead, flick: !p.dead && p.stain % 4 === 0 });
  c.fitting(0.9, plan.zc + 0.3);
  c.fitting(0.3, -D / 2 + 1.4);
  let s = p.stain;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 5; i++) c.blot(-0.6 + rnd() * 2.2, -D / 2 + 0.6 + rnd() * (D - 1.2), 0.35 + rnd() * 0.6, 0.3 + rnd() * 0.5, { down: true, y: H - 0.004, a: 0.12 + rnd() * 0.14, rgb: [0.32, 0.24, 0.08] });
  c.blot(face + 0.35, plan.edge + 0.6, 0.7, 0.6, { down: true, y: H - 0.004, a: 0.2, rgb: [0.25, 0.17, 0.05] });
  c.socket('right', D / 2 - 2.2);
}
