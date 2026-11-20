// The Backrooms — a room of the Offsite Reserve (`forest`): Lights Out (`lights-out` — "the dark campsite, where the
// tent beside you goes out").
//
// The overnight part of the offsite: a campsite in a clearing of the reserve, after lights out. The ceiling's lights
// are off, the fire has been let go to coals, and round it a ring of ridge tents stands pitched in the moss, each lit
// from inside, its door half down, nobody in any of them. What the office brought camping is still out where it left
// it: a picnic table with a laptop open on it, a flip chart at the fire, shirts and a lanyard on the line, the water
// cooler, a power strip in the moss with a cord run to every tent, and at the edge of the trees a portable toilet in
// office green, engaged, with a badge reader on its door.
//
// The tent you are nearest goes dark, and comes back on when you have moved away: so the camp is crossed in a patch of
// dark that moves with you, between lit tents you never get to see into from close by.
//
// Nothing here can be used and nothing here hurts. The rule is `nearestTent` in forest.rule.js (pure): the nearest tent
// within reach is the dark one, one at a time. The room reads the visitor's place and nothing else; the seed decides
// where the tents stand and what colour they are.
import * as THREE from 'three';
import { Batch, WHITE } from '../kit.js';
import {
  makeVoxGroup, placeVoxStack, tentVox, trailSign, forestRoom, backpackVox, campLanternVox, stumpVox,
  ensureForestDetail,
} from '../forest.js';
import { thicket, doorLanes } from '../forest-thicket.js';
import { ceilingTurfAndLogs, hangCardboardBirds } from '../forest-maze.js';
import {
  firePitVox, portaPottyVox, picnicTableVox, campCoolerVox, laundryLineVox, campFlipChartVox, powerStripVox,
  splitLogBenchVox, campCotVox, fallenNurseLogVox, mushroomRingVox, fernClumpVox, rottingBinderPileVox,
  forestLitterVox, hangingCanopyDrapeVox,
} from '../forest-models.js';
import { LIGHTS_OUT, nearestTent } from '../forest.rule.js';

const NYLON = ['#d47a28', '#2b6e58', '#8a5a2b', '#3d5f8a', '#a03b34', '#c9a13a'];
const LAMP = [2.1, 1.62, 0.98];          // the light inside a tent, on its own nylon
const POOL = [0.95, 0.62, 0.30];          // and what of it reaches the ground round it
const SLOTS = 10;                         // places round the fire: tents, and the camp's other things

export function build(c) {
  const { W, D, H, R, kit } = c;
  c.shell({ panels: false });
  // the office's own ceiling, every light of it out, and next to nothing to see by: the tents and the coals are the light
  c.rt.amb = [0.032, 0.038, 0.034];
  // (The room reports one light for each doorway besides its own two. Those are the shell's: the light that falls in
  // through a doorway from next door, 1.4 m up at the threshold (`spill`). They are meant to be here. A dark room with
  // its doorways lit from outside is how the rest of the building does a dark room; with the camcorder's own lamp,
  // which comes on in the dark, they are why the trees at the edge read at all.)
  for (const [fx, fz] of [[-W / 4, -D / 4], [W / 4, -D / 4], [-W / 4, D / 4], [W / 4, D / 4], [0, 0]]) c.fitting(Math.round(fx / 0.6) * 0.6 + 0.3, Math.round(fz / 0.6) * 0.6, { dead: true });
  // the reserve's own dressing: the strip of office carpet at the walls, the outlets, the painted trees. Its thicket is
  // planted below, round the camp, once the camp is pitched
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });
  // the ways in, from every doorway to the fire, kept before anything is pitched across them
  doorLanes(c, [0, 0], 1.3);

  const stack = [];
  const det = ensureForestDetail(c);

  // 1. the fire ring, gone to coals, and what is sat round it: two split-log benches and two office chairs
  stack.push({ key: 'forest:camp:firepit', ao: false, make: firePitVox(), x: 0, z: 0, scale: 0.03 });
  c.solid(-0.55, -0.55, 0.55, 0.55);
  c.reserve(0, 0, 1.0);
  c.light(0, 0.35, 0, '#ff6a24', 0.55, { k: 2.6, far: 4.2 });
  c.blot(0, 0, 2.2, 2.2, { rgb: [0.04, 0.035, 0.03], a: 0.6 });
  const turn = R.range(0, Math.PI * 2);
  const seats = [];
  for (let i = 0; i < 4; i++) {
    const a = turn + i * (Math.PI / 2) + R.range(-0.2, 0.2), r = 1.75;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (!c.clear(x, z, 0.5)) continue;
    if (i % 2 === 0) {
      stack.push({ key: 'forest:bench:splitlog', ao: false, make: splitLogBenchVox(), x, z, rot: -a + Math.PI / 2, scale: 0.026 });
      const tx = -Math.sin(a) * 0.62, tz = Math.cos(a) * 0.62;
      c.solid(Math.min(x - tx, x + tx) - 0.16, Math.min(z - tz, z + tz) - 0.16, Math.max(x - tx, x + tx) + 0.16, Math.max(z - tz, z + tz) + 0.16);
      c.reserve(x, z, 0.8);
    } else {
      c.prop('chair', x, z, { y: -0.04, rot: Math.atan2(-x, -z) + R.range(-0.4, 0.4), o: { color: '#3a3f46' } });
      c.reserve(x, z, 0.5);
    }
    seats.push(a);
  }
  // the flip chart, stood in the gap between two seats, facing the fire; and the power strip by it
  {
    const a = turn + Math.PI / 4, x = Math.cos(a) * 1.85, z = Math.sin(a) * 1.85;
    if (c.clear(x, z, 0.4)) {
      stack.push({ key: 'forest:camp:flipchart', ao: false, make: campFlipChartVox(), x, z, rot: Math.atan2(-x, -z), scale: 0.03 });
      c.solid(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
      c.reserve(x, z, 0.45);
    }
  }
  const sa = turn + Math.PI * 1.25, strip = { x: Math.cos(sa) * 1.15, z: Math.sin(sa) * 1.15 };
  stack.push({ key: 'forest:camp:strip', make: powerStripVox(), x: strip.x, z: strip.z, rot: sa, scale: 0.025, ao: false });

  // 2. the ring of places round the fire: tents in most, and in the others the camp's toilet, its table, its washing
  const rx = W / 2 - 2.45, rz = D / 2 - 2.45, phase = R.range(0, Math.PI * 2);
  const order = [...Array(SLOTS).keys()];
  for (let i = order.length - 1; i > 0; i--) { const j = R.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  const job = new Array(SLOTS).fill('tent');
  job[order[0]] = 'potty'; job[order[1]] = 'table'; job[order[2]] = 'line';
  const shoes = order[3 + R.int(0, SLOTS - 4)];
  const tents = [];
  for (let s = 0; s < SLOTS; s++) {
    const a = phase + (s / SLOTS) * Math.PI * 2 + R.range(-0.08, 0.08);
    const out = job[s] === 'potty' ? 1.12 : job[s] === 'line' ? 1.05 : 1;
    let x = 0, z = 0, ok = false;
    // (its mark, or the nearest free ground beside it round the ring, or toward the fire, if a doorway's way in has it)
    for (const f of [1, 0.88, 0.76]) for (const da of [0, 0.13, -0.13, 0.26, -0.26]) {
      if (ok) break;
      x = Math.cos(a + da) * rx * out * f; z = Math.sin(a + da) * rz * out * f;
      ok = c.clear(x, z, job[s] === 'tent' ? 0.95 : 0.85);
    }
    if (!ok) continue;
    const face = Math.atan2(-x, -z);   // (each thing's front, +Z, turned to the fire)
    if (job[s] === 'tent') {
      const rot = face + R.range(-0.25, 0.25), colour = R.pick(NYLON), out2 = s === shoes;
      c.reserve(x, z, 1.15);
      const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)), hx = 0.55 * cs + 0.8 * sn, hz = 0.55 * sn + 0.8 * cs;
      c.solid(x - hx, z - hz, x + hx, z + hz);
      const g = makeVoxGroup(kit, `forest:camp:tent:${colour}:${out2 ? 1 : 0}`, tentVox(colour, out2), 0.03, { room: c.rt.u, ao: false });   // (flat faces: a tenth of the triangles, and its light is one colour anyway)
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      c.add(g);
      c.blot(x, z, 1.9, 2.2, { rgb: [0.05, 0.05, 0.035], a: 0.42 });
      tents.push({ x, z, a, g, on: 1, dim: [0.05, 0.05, 0.05], pool: null });
      // what was left out by its door: a pack, a cot, a lantern gone out, a stump to sit on
      const kit2 = R.int(0, 3), bx = x + Math.cos(a + 0.9) * 1.15, bz = z + Math.sin(a + 0.9) * 1.15;
      if (c.clear(bx, bz, 0.35)) {
        if (kit2 === 0) stack.push({ key: `forest:camp:pack:${colour}`, make: backpackVox(R.pick(['#c98a26', '#b84b28', '#3d5f8a'])), x: bx, z: bz, rot: R.range(0, 6.28) });
        else if (kit2 === 1) det.pushVox({ key: 'forest:detail:cot', make: campCotVox(), x: bx, y: 0, z: bz, rot: face + 1.5, scale: 0.024 });
        else if (kit2 === 2) stack.push({ key: 'forest:camp:stump', make: stumpVox(5), x: bx, z: bz, scale: 0.026 });
        else stack.push({ key: 'forest:camp:cooler', make: campCoolerVox(), x: bx, z: bz, rot: face + R.range(-0.5, 0.5), scale: 0.028 });
        c.reserve(bx, bz, 0.4);
      }
    } else if (job[s] === 'potty') {
      stack.push({ key: 'forest:camp:potty', ao: false, make: portaPottyVox(), x, z, rot: face, scale: 0.032 });
      c.solid(x - 0.62, z - 0.62, x + 0.62, z + 0.62);
      c.reserve(x, z, 1.0);
      // (lit inside: the moon in its door, and a little of it under the door onto the moss)
      const w = 0.62, fx = Math.sin(face), fz = Math.cos(face);
      c.light(x + fx * 0.3, 1.8, z + fz * 0.3, '#ffd28a', 0.32, { k: 3.2, far: 3.0 });
      c.blot(x + fx * w, z + fz * w, 0.9, 0.5, { rgb: [0.5, 0.4, 0.22], a: 0.18 });
      // and a stump beside it, to wait on
      stack.push({ key: 'forest:camp:stump:short', make: stumpVox(2), x: x + Math.cos(face) * 0.85, z: z - Math.sin(face) * 0.85, scale: 0.02 });
    } else if (job[s] === 'table') {
      const rot = face + Math.PI / 2 + R.range(-0.2, 0.2);
      stack.push({ key: 'forest:camp:table', ao: false, make: picnicTableVox(), x, z, rot, scale: 0.03 });
      stack.push({ key: 'forest:lantern', make: campLanternVox(), x: x + Math.cos(rot) * 0.55, y: 0.75, z: z - Math.sin(rot) * 0.55, scale: 0.024 });
      const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)), hx = 0.92 * cs + 0.66 * sn, hz = 0.92 * sn + 0.66 * cs;
      c.solid(x - hx, z - hz, x + hx, z + hz);
      c.reserve(x, z, 1.25);
      // the laptop's screen, still on, and the lantern on the table
      c.light(x, 1.05, z, '#9fc4e8', 0.18, { k: 3.6, far: 2.2 });
      // the office's water cooler, carried out to the table
      const wx = x + Math.cos(a + 0.55) * 1.35, wz = z + Math.sin(a + 0.55) * 1.35;
      if (c.clear(wx, wz, 0.35)) { c.prop('cooler', wx, wz, { rot: face }); c.reserve(wx, wz, 0.45); }
    } else {
      // the washing line, strung across the place, along the ring
      const rot = face + Math.PI / 2;
      stack.push({ key: 'forest:camp:line', ao: false, make: laundryLineVox(), x, z, rot, scale: 0.03 });
      for (const e of [-1.2, 1.2]) { const px = x + Math.cos(rot) * e, pz = z - Math.sin(rot) * e; c.solid(px - 0.08, pz - 0.08, px + 0.08, pz + 0.08); }
      c.reserve(x, z, 1.35);
    }
  }

  // 3. a cord from the power strip to every tent's door, laid across the moss as it fell
  {
    const b = c.flat, cord = [0.12, 0.12, 0.11], y = 0.018, hw = 0.012;
    for (const t of tents) {
      const dx = t.x - strip.x, dz = t.z - strip.z, len = Math.hypot(dx, dz), n = Math.max(3, Math.round(len / 0.5));
      const nx = -dz / len, nz = dx / len, bend = R.range(-0.4, 0.4);
      let px = strip.x, pz = strip.z;
      for (let i = 1; i <= n; i++) {
        const f = i / n, sway = Math.sin(f * Math.PI) * bend;
        const qx = strip.x + dx * f * 0.9 + nx * sway, qz = strip.z + dz * f * 0.9 + nz * sway;
        const sx = qx - px, sz = qz - pz, sl = Math.hypot(sx, sz) || 1, ox = (-sz / sl) * hw, oz = (sx / sl) * hw;
        b.quad([px - ox, y, pz - oz], [qx - ox, y, qz - oz], [qx + ox, y, qz + oz], [px + ox, y, pz + oz], cord);
        px = qx; pz = qz;
      }
    }
  }

  // 4. the reserve round the camp: a fallen log, mushrooms, ferns and litter between the places; the thicket beyond
  for (let i = 0; i < 6; i++) {
    const a = phase + ((i + 0.5) / 6) * Math.PI * 2, r = 0.6 + R.range(0, 0.15);
    const x = Math.cos(a) * rx * r, z = Math.sin(a) * rz * r;
    if (!c.clear(x, z, 0.3)) continue;
    det.pushVox({ key: i % 2 ? 'forest:detail:ferns' : 'forest:detail:litter', make: i % 2 ? fernClumpVox() : forestLitterVox(), x, y: 0, z, rot: R.range(0, 6.28), scale: 0.028 });
  }
  {
    const a = phase + Math.PI / SLOTS, x = Math.cos(a) * rx * 1.15, z = Math.sin(a) * rz * 1.15;
    if (c.clear(x, z, 0.7)) { stack.push({ key: 'forest:under:log', make: fallenNurseLogVox(), x, z, rot: a + Math.PI / 2, scale: 0.03 }); c.solid(x - 0.35, z - 0.35, x + 0.35, z + 0.35); c.reserve(x, z, 0.8); }
  }
  det.pushVox({ key: 'forest:detail:mushrooms', make: mushroomRingVox(), x: Math.cos(turn + 2.6) * 2.7, y: 0, z: Math.sin(turn + 2.6) * 2.7, rot: 1.1, scale: 0.03 });
  det.pushVox({ key: 'forest:detail:binders', make: rottingBinderPileVox(), x: Math.cos(turn + 4.2) * 2.6, y: 0, z: Math.sin(turn + 4.2) * 2.6, rot: 0.65, scale: 0.026 });
  placeVoxStack(c, 'forest:lightsout:camp', stack);

  // the ceiling over the camp: night up there, boughs hung from it, turf and a log laid up there, and the cardboard
  // birds, all of it hard to make out
  for (let x = -W / 2 + 1.6; x < W / 2 - 0.4; x += 2.4) for (let z = -D / 2 + 1.6; z < D / 2 - 0.4; z += 2.4) {
    c.blot(x + R.range(-0.3, 0.3), z + R.range(-0.3, 0.3), 3.2, 3.2, { rgb: [0.012, 0.014, 0.02], a: 0.6, y: H - 0.0045, down: true });
  }
  for (let i = 0; i < 8; i++) {
    const a = phase + (i / 8) * Math.PI * 2 + R.range(-0.2, 0.2), r = R.range(0.55, 0.95);
    det.pushVox({ key: 'forest:detail:ceildrape', make: hangingCanopyDrapeVox(), x: Math.cos(a) * rx * r, y: H + 0.02, z: Math.sin(a) * rz * r, rot: R.range(0, 6.28), scale: 0.034 });
  }
  ceilingTurfAndLogs(c, R.range(-1, 1), R.range(-1.5, 1.5), W >= D, 3.6);
  hangCardboardBirds(c, R.range(-2, 2), R.range(-2, 2), 3);

  // the trees: everything beyond the ring of places, thickest in the corners
  const ex = W / 2 - 1.0, ez = D / 2 - 1.0;
  thicket(c, {
    tag: 'lightsout',
    routes: true,
    laneWidth: 1.3,
    hills: false,
    // (the campsite's trees: full conifers and pines more than the bare poles, and in among the outer tents as well)
    species: { sweeping: 6, pine: 3, hemlock: 2, birchStem: 2 },
    spacing: 0.72,
    region: (x, z) => (x / ex) ** 2 + (z / ez) ** 2 > 0.5,
  });

  // what each lit tent throws on the ground: a soft warm patch of its own, so that it can go out with its tent
  c.after.push(() => {
    for (const t of tents) {
      t.dim = c.sample(t.x, 0.6, t.z).map((v) => Math.max(0.035, v));
      const b = new Batch(), r = 1.4, y = 0.02;
      b.quad([t.x - r, y, t.z + r], [t.x + r, y, t.z + r], [t.x + r, y, t.z - r], [t.x - r, y, t.z - r], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const mat = kit.glowing(kit.tex.blob(), 1, POOL, { transparent: true, depthWrite: false, bloom: 0 });
      mat.opacity = LIGHTS_OUT.pool;
      t.pool = new THREE.Mesh(kit.plain(b), mat);
      t.pool.renderOrder = 2;
      t.pool.matrixAutoUpdate = false;
      t.pool.updateMatrix();
      c.rt.group.add(t.pool);
      t.g.userData.light(LAMP);
    }
  });

  let dark = -1;
  c.rt.lightsOut = { tents, get dark() { return dark; } };
  c.tick((dt, _t, me) => {
    const now = me.inside ? nearestTent(tents, me.x, me.z) : -1;
    if (now !== dark) {
      // (a lamp being switched off, heard from where it was)
      if (now >= 0) { const w = c.toWorld(tents[now].x, tents[now].z); c.env.play?.('clack', w.x, w.z, 6); }
      dark = now;
    }
    for (let i = 0; i < tents.length; i++) {
      const t = tents[i], want = i === dark ? 0 : 1;
      if (t.on === want) continue;
      // out at once, as a lamp goes; back on slowly, as if whoever it is were making sure
      t.on = want < t.on ? Math.max(want, t.on - dt / LIGHTS_OUT.off) : Math.min(want, t.on + dt / LIGHTS_OUT.on);
      const k = t.on;
      t.g.userData.light([t.dim[0] + (LAMP[0] - t.dim[0]) * k, t.dim[1] + (LAMP[1] - t.dim[1]) * k, t.dim[2] + (LAMP[2] - t.dim[2]) * k]);
      if (t.pool) { t.pool.material.opacity = LIGHTS_OUT.pool * k; t.pool.visible = k > 0.01; }
    }
  });

  const sign = c.wallSpot(1.5, ['front', 'left', 'right'], 0.35, 2.0);
  if (sign) trailSign(c, sign.side, sign.at, 1.5, ['OVERNIGHT COMPONENT', 'QUIET HOURS ARE IN EFFECT'], { seed: 313, warn: true });
}
