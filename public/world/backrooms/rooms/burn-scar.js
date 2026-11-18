// The Backrooms — a room of the Offsite Reserve (`forest`): The Burn (`burn-scar` — "the charred trees standing in
// the smoke, and the fire drill that never ended").
//
// The offsite scheduled a controlled burn for itself, as a team exercise, and the wood went. What is left is a stand
// of charred snags with embers still glowing in their splits, ash where the moss was, the skeletons of the cubicles
// that were set out among the trees, filing cabinets gone soft in the heat — and the office's own fire safety, which
// is still running the drill: the ceiling's sprinklers, the laminated posters, an EXIT sign that points at a tree,
// and the carpet round the edge, which did not burn at all. Under one charred printer, something green.
//
// The rule is the posters' own: STAY LOW AND GO. The smoke lies in a layer (forest.rule.js `SMOKE`): stand up in it
// and the picture fogs at once, and then the lens takes soot (camcorder charge, never a heart); crouch (C) and your
// head is under it, in clear air, and you can see under the smoke to the far side. The Fire Marshal (`MARSHAL`) walks
// the drill with a smoke detector for a face, and can only see what is in the smoke: a head up in it, in its sight,
// gets a chirp — and then it comes. Get under the smoke and it loses you. If it reaches you: the extinguisher, a heart.
import * as THREE from 'three';
import { Batch, WHITE } from '../kit.js';
import {
  forestRoom, woodlandLight, garble, makeVoxGroup, placeVox, placeVoxStack, trailSign,
  plenumBreach, buildForestWater, peatWaterTex, ensureForestDetail,
} from '../forest.js';
import { thicket } from '../forest-thicket.js';
import { occluderWall, addMistVeils } from '../forest-maze.js';
import {
  fireMarshalVox, marshalLedVox, meltedCabinetVox, ashSproutPrinterVox,
  cellophaneFireVox, forestLitterVox, hangingCanopyDrapeVox,
  rottingBinderPileVox, fernClumpVox,
} from '../forest-models.js';
import { SMOKE, makeSmoke, stepSmoke, MARSHAL, makeMarshal, stepMarshal, snipMarshal } from '../forest.rule.js';

const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** Ash over what was moss: grey, speckled, with charred twigs and a few embers. */
function ashTex(kit) {
  return kit.tex.custom('burn:ash', 128, 128, (g, w, h) => {
    P(g, '#57534f', 0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = Math.floor(hash(i) * w), y = Math.floor(hash(i + 999) * h), k = hash(i + 77);
      P(g, k < 0.4 ? '#45413e' : k < 0.75 ? '#6b6763' : k < 0.97 ? '#7d7974' : '#2a2725', x, y, 1 + (k > 0.85 ? 1 : 0), 1);
    }
    g.strokeStyle = '#1d1b1a'; g.lineWidth = 1;
    for (let i = 0; i < 26; i++) { const x = hash(i + 5) * w, y = hash(i + 51) * h, a = hash(i + 501) * 6.28, l = 4 + hash(i + 7) * 12; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    for (let i = 0; i < 9; i++) P(g, hash(i + 3) > 0.5 ? '#e0611a' : '#ffae3a', Math.floor(hash(i + 300) * w), Math.floor(hash(i + 600) * h), 1, 1);
  });
}

/** Soft smoke: a few overlapping grey blobs with soft edges, on transparency. */
function smokeTex(kit) {
  return kit.tex.custom('burn:smoke', 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const x = w * (0.22 + hash(i + 1) * 0.56), y = h * (0.3 + hash(i + 11) * 0.4), r = w * (0.18 + hash(i + 21) * 0.18);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
    }
  }, { clamp: true });
}

/** The posters the drill put up: a crouching figure under a grey cloud, nearly-words, scorched at the edges. */
function poster(c, key, lines, figure, side, at, y, seed) {
  const tex = c.kit.tex.custom(key, 96, 128, (g, w, h) => {
    P(g, '#f2efe4', 0, 0, w, h); P(g, '#c4231b', 0, 0, w, 26);
    garble(g, lines[0], 3, 2, w - 6, 22, { color: '#ffffff', size: 14, mess: 0.22 }, seed);
    if (figure) {
      P(g, '#8a8784', 10, 34, 76, 16); P(g, '#a3a09c', 18, 30, 30, 10); P(g, '#a3a09c', 50, 31, 26, 9);   // the cloud
      P(g, '#1d6b3a', 28, 66, 12, 10); P(g, '#1d6b3a', 36, 70, 22, 10); P(g, '#1d6b3a', 52, 78, 6, 12); P(g, '#1d6b3a', 30, 78, 6, 12); // somebody, low
      P(g, '#1d6b3a', 22, 64, 10, 10);
      for (let i = 0; i < 4; i++) P(g, '#1d6b3a', 62 + i * 6, 72, 4, 3);                                  // and the way, arrowed
    }
    garble(g, lines[1], 4, 96, w - 8, 14, { color: '#1b1b1b', size: 10, mess: 0.3 }, seed + 5);
    garble(g, lines[2] || '', 4, 110, w - 8, 12, { color: '#1b1b1b', size: 8, mess: 0.38 }, seed + 9);
    for (let i = 0; i < 70; i++) { const e = Math.floor(hash(seed + i) * 4); const t = hash(seed + i + 40); const p = Math.floor(hash(seed + i + 80) * (e % 2 ? h : w)); g.fillStyle = `rgba(28,20,14,${0.35 + t * 0.6})`; if (e === 0) g.fillRect(p, 0, 3, 2 + t * 9); else if (e === 1) g.fillRect(0, p, 2 + t * 8, 3); else if (e === 2) g.fillRect(p, h - 2 - t * 10, 3, 2 + t * 10); else g.fillRect(w - 2 - t * 8, p, 2 + t * 8, 3); }
  }, { clamp: true });
  c.hang(c.mapped(key, tex), side, at, y, 0.62, 0.82, null, WHITE, 0.012);
}

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  c.shell({ panels: false, floorTex: ashTex(kit) });
  // Dynamic 4-bank smoky ember lighting + soot-blackened dead ceiling fixtures + smoky amber god-ray shafts!
  woodlandLight(c, 3, 3, 1, 0.76, { mode: 'ember', tubeHex: '#ffe9c4', shaftTint: [1.0, 0.68, 0.35], shaftStrength: 0.12 });
  // the office edge round the ash: the carpet that did not burn, the sockets. (The woods come later, as snags.)
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Shimmering dark sprinkler-runoff soot puddles pooled on the ash floor!
  buildForestWater(
    c,
    [
      { x0: -3.2, z0: 1.2, x1: -1.1, z1: 2.9, depth: 0.08, waterY: 0.014 },
      { x0: 1.5, z0: -3.1, x1: 3.5, z1: -1.3, depth: 0.08, waterY: 0.014 },
    ],
    {
      map: peatWaterTex(kit, 'deep'),
      shallowHex: '#2e2a26',
      deepHex: '#0d0c0c',
      foamHex: '#69625a',
      caustics: false,
    }
  );

  /* where the smoke lies: everywhere but the first three metres in from the door you came by */
  const smokeZ1 = D / 2 - 3.2;
  const inSmoke = (x, z) => z < smokeZ1 && Math.abs(x) < W / 2 - 0.1 && z > -D / 2 + 0.1;

  /* what the drill set out among the trees, and what the heat did to it */
  // the cause: the HR campfire, cellophane and a desk fan, still "burning" in the middle of what it burned
  const fire = c.spot(0.75, { near: [0, -0.5, 2.4], head: 2.2 }) || { x: 0, z: -0.5 };
  placeVox(c, 'forest:cellofire', cellophaneFireVox(), fire.x, fire.z, { scale: 0.032, bloom: 1 });
  c.solid(fire.x - 0.45, fire.z - 0.45, fire.x + 0.45, fire.z + 0.45);
  c.light(fire.x, 0.55, fire.z, '#ff8a2a', 0.95, { bank: 3, k: 1.7, far: 7.0 });
  c.reserve(fire.x, fire.z, 1.2);
  // the assembly point: a ring of office chairs, charred, facing a sign on a post
  const ap = c.spot(1.4, { head: 2.2 });
  if (ap) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3, x = ap.x + Math.cos(a) * 0.95, z = ap.z + Math.sin(a) * 0.95;
      c.prop('chair', x, z, { rot: Math.atan2(ap.x - x, ap.z - z) + R.range(-0.4, 0.4), o: { color: '#1f1c1a' }, tint: [0.32, 0.29, 0.27] });
    }
    c.flat.box(ap.x - 0.04, 0, ap.z - 0.04, ap.x + 0.04, 1.6, ap.z + 0.04, [0.12, 0.11, 0.1]);
    const apTex = kit.tex.custom('burn:assembly', 96, 64, (g, w, h) => {
      P(g, '#1d7a43', 0, 0, w, h); P(g, '#f4f4ee', 4, 4, w - 8, h - 8); P(g, '#1d7a43', 8, 8, w - 16, 30);
      for (let k = 0; k < 4; k++) P(g, '#ffffff', 16 + k * 18, 14, 8, 18);
      garble(g, 'FIRE ASSEMBLY POINT', 6, 40, w - 12, 18, { color: '#1d7a43', size: 10, mess: 0.25 }, p.seed);
      for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(20,14,10,0.7)'; g.fillRect(Math.floor(hash(k) * w), Math.floor(hash(k + 9) * h), 3, 2); }
    }, { clamp: true });
    c.board(c.mapped('burn:assembly', apTex, { side: THREE.DoubleSide }), ap.x, 1.75, ap.z, 0.6, 0.4, 0);
  }
  // two cubicles that were set out in the trees: the steel frames stood the heat, the panels slumped
  const steel = [0.2, 0.2, 0.21], cloth = [0.17, 0.16, 0.15];
  for (let k = 0; k < 2; k++) {
    const s = c.spot(1.1, { head: 2.2 }); if (!s) break;
    const sx = k ? -1 : 1;
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8]]) c.flat.box(s.x + dx * sx - 0.03, 0, s.z + dz - 0.03, s.x + dx * sx + 0.03, 1.5, s.z + dz + 0.03, steel);
    c.flat.box(s.x - 0.8, 1.47, s.z - 0.83, s.x + 0.8, 1.53, s.z - 0.77, steel);
    c.flat.box(s.x - 0.8 * sx - 0.03, 1.47, s.z - 0.8, s.x - 0.8 * sx + 0.03, 1.53, s.z + 0.8, steel);
    // the panel on the long side, run down like candle wax: tall at one end, puddled at the other
    for (let i = 0; i < 8; i++) { const x0 = s.x - 0.78 + i * 0.195, top = 1.35 - i * 0.14 - hash(i + k * 9) * 0.18; c.flat.box(x0, 0, s.z - 0.82, x0 + 0.2, Math.max(0.12, top), s.z - 0.78, cloth); }
    c.flat.box(s.x + 0.2, 0, s.z - 0.82, s.x + 0.9, 0.05, s.z - 0.45, cloth);
    c.solid(s.x - 0.82, s.z - 0.85, s.x + 0.82, s.z - 0.75);
  }
  // filing cabinets gone soft, and a printer with something growing out of its paper feed (and a battery by it)
  const props = [];
  for (let k = 0; k < 2; k++) { const s = c.corner(0.7, k, 2.0) || c.spot(0.6, { head: 2.0 }); if (s) props.push({ key: 'forest:meltcab', make: meltedCabinetVox(), x: s.x, y: 0, z: s.z, rot: R.range(0, 6.28), scale: 0.03, solid: 0.36 }); }
  const sprout = c.spot(0.55, { head: 1.6 });
  if (sprout) {
    props.push({ key: 'forest:ashsprout', make: ashSproutPrinterVox(), x: sprout.x, y: 0, z: sprout.z, rot: R.range(0, 6.28), scale: 0.03, solid: 0.28 });
    c.leave('battery', sprout.x + 0.42, sprout.z + 0.1);
    c.light(sprout.x, 1.2, sprout.z, '#bfffb0', 0.34, { k: 1.3, far: 3.5 });
  }
  for (const e of props) c.solid(e.x - e.solid, e.z - e.solid, e.x + e.solid, e.z + e.solid);
  placeVoxStack(c, `forest:burn:props:${c.room.id}`, props);

  /* the posters, and an EXIT that points at a tree */
  for (const [k, side] of [[0, 'left'], [1, 'right']]) {
    const w = c.wallSpot(0.8, [side], 0.35, 2.2); if (!w) continue;
    poster(c, `burn:poster${k}`, k ? ['DRILL IN PROGRESS', 'THIS IS ONLY A DRILL', 'DAY 1 OF 1'] : ['STAY LOW AND GO', 'SMOKE RISES', 'KEEP YOUR HEAD BELOW IT'], !k, side, w.at, 1.35, p.seed + k * 31);
  }
  const ex = c.wallSpot(0.7, ['back', p.side < 0 ? 'left' : 'right'], 0.35, 2.5);
  if (ex) {
    const exitTex = kit.tex.custom('burn:exit', 64, 24, (g, w, h) => { P(g, '#0d3a22', 0, 0, w, h); P(g, '#1f8a4e', 2, 2, w - 4, h - 4); garble(g, 'EXIT', 4, 2, 34, h - 4, { color: '#eafff0', size: 14, mess: 0.15 }, 4); P(g, '#eafff0', 42, 10, 12, 4); P(g, '#eafff0', 50, 6, 4, 12); }, { clamp: true });
    c.hang(c.shining('burn:exit', exitTex, 1.6), ex.side, ex.at, 2.3, 0.56, 0.21, null, WHITE, 0.03);
  }

  /* embers: two beds still glowing in the ash on Bank 3, with sparks going up off them */
  const beds = [];
  const emberTex = kit.tex.custom('burn:ember', 32, 32, (g, w, h) => { P(g, '#2a1a12', 0, 0, w, h); for (let i = 0; i < 90; i++) P(g, hash(i) > 0.6 ? '#ff7a1c' : hash(i + 1) > 0.5 ? '#c43a10' : '#ffc046', Math.floor(hash(i + 3) * w), Math.floor(hash(i + 7) * h), 2, 2); });
  const glowB = c.shining('burn:embers', emberTex, 1.5);
  for (let k = 0; k < 2; k++) {
    const s = c.spot(0.7, { head: 2 }); if (!s) break;
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + k, r = 0.15 + i * 0.08, x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r, h = 0.22 + hash(i + k * 5) * 0.2; glowB.quad([x - h, 0.012, z + h], [x + h, 0.012, z + h], [x + h, 0.012, z - h], [x - h, 0.012, z - h], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]); }
    c.light(s.x, 0.35, s.z, '#ff6a1a', 0.68, { bank: 3, k: 1.5, far: 5.2 });
    beds.push(s);
  }
  const sparks = [];
  for (const s of beds) for (let g = 0; g < 2; g++) {
    const b = new Batch();
    for (let i = 0; i < 9; i++) { const x = s.x + (hash(i + g * 17) - 0.5) * 0.9, z = s.z + (hash(i + g * 17 + 3) - 0.5) * 0.9, y = hash(i + g * 31) * 1.2, e = 0.012 + hash(i) * 0.012; b.box(x - e, y - e, z - e, x + e, y + e, z + e, hash(i + 5) > 0.5 ? [1, 0.55, 0.12] : [1, 0.8, 0.3]); }
    sparks.push({ m: c.dynamic(b, { unlit: true }), phase: g * 0.5 + hash(s.x) });
  }

  /* the Fire Marshal's rounds: four points it walks between (kept free, so nothing is planted on them) */
  const rounds = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + R.range(-0.3, 0.3), r = Math.min(W, D) * 0.28;
    const s = c.spot(0.55, { near: [Math.cos(a) * r, Math.sin(a) * r - 0.6, 2.2] }); if (s) rounds.push(s);
  }

  /* 5 Fire-Warped Drywall & Blackened Stud-Walls (`tall: true`) breaking the burn zone into blind crawl alleys
     so crouching under the smoke only shows 3–4 m to the next burned corner while the Marshal chirps nearby! */
  const burnGuard = [
    { x: fire.x, z: fire.z, r: 1.35 },
    ...(ap ? [{ x: ap.x, z: ap.z, r: 1.55 }] : []),
    ...(sprout ? [{ x: sprout.x, z: sprout.z, r: 0.95 }] : []),
    ...rounds.map((pt) => ({ x: pt.x, z: pt.z, r: 0.85 })),
  ];
  occluderWall(c, -W * 0.35, 1.55, -0.75, 1.95, { style: 'charred', keepClear: burnGuard, h: 2.28 });
  occluderWall(c, 0.75, -1.95, W * 0.35, -1.55, { style: 'charred', keepClear: burnGuard, h: 2.28 });
  occluderWall(c, -2.55, -D * 0.34, -2.15, -0.45, { style: 'charred', keepClear: burnGuard, h: 2.28 });
  occluderWall(c, 2.15, 0.45, 2.55, D * 0.34, { style: 'charred', keepClear: burnGuard, h: 2.28 });
  addMistVeils(c, [
    { x0: -2.2, z0: 0.2, x1: -0.7, z1: 0.2 },
    { x0: 0.7, z0: -0.4, x1: 2.2, z1: -0.4 },
  ], { color: [0.12, 0.11, 0.10], alpha: 0.66 });

  /* and now the wood, as it is: full-AO charred snags, 3D plenum breaches, and soot round where they went through */
  const wood = thicket(c, {
    species: { snag: 1 },
    under: 0,
    ceiling: false,
    hub: [fire.x, fire.z + 1.6],
    ordCap: 108000,
    budget: 82000,
    trees: 18,
    hillsOpt: { style: 'scorched', density: 1.35, maxHeight: 1.92 },
    litter: [[0.08, 0.07, 0.07], [0.14, 0.13, 0.12], [0.05, 0.04, 0.04]],
  });
  const det = ensureForestDetail(c);
  for (let idx = 0; idx < wood.trees.length; idx++) {
    const t = wood.trees[idx];
    plenumBreach(c, t.x - 0.15, t.z - 0.15, 1, idx + 71);
    c.blot(t.x, t.z, 1.9, 1.9, { rgb: [0.02, 0.02, 0.02], a: 0.7, y: c.ceilAt(t.x, t.z) - 0.009, down: true });
    det.pushVox({ key: 'forest:detail:charlitter', make: forestLitterVox(), x: t.x + R.range(-0.6, 0.6), y: 0.004, z: t.z + R.range(-0.6, 0.6), rot: R.range(0, 6.28), scale: 0.028, tint: [0.34, 0.30, 0.28] });
    det.pushVox({ key: 'forest:detail:chardrape', make: hangingCanopyDrapeVox(), x: t.x, y: c.ceilAt(t.x, t.z) + 0.02, z: t.z, rot: idx * 1.7, scale: 0.028, tint: [0.24, 0.21, 0.20] });
  }
  // Scorched blackened bracken skeletons & burned binder piles across the ash bed (`detail: true`)
  for (let i = 0; i < 24; i++) {
    const bx = R.range(-W / 2 + 0.7, W / 2 - 0.7), bz = R.range(-D / 2 + 0.7, D / 2 - 0.7);
    const kind = i % 3 === 0 ? 'binders' : 'fern';
    det.pushVox({
      key: `forest:detail:char:${kind}`,
      make: kind === 'binders' ? rottingBinderPileVox() : fernClumpVox(),
      x: bx,
      y: -0.006,
      z: bz,
      rot: R.range(0, 6.28),
      scale: kind === 'fern' ? R.range(0.022, 0.029) : 0.027,
      tint: kind === 'fern' ? [0.22, 0.19, 0.17] : [0.36, 0.32, 0.30],
    });
  }

  /* the smoke: soft grey drifts hung between the underside of the layer and its top, so that a standing head looks
     through a dozen of them and a crouched one looks under them all; and a flat underside, so that crouched you see
     the smoke as a low grey ceiling */
  const puffs = new Batch(), under = new Batch(), sTex = smokeTex(kit);
  for (let i = 0; i < 150; i++) {
    const x = R.range(-W / 2 + 0.4, W / 2 - 0.4), z = R.range(-D / 2 + 0.4, smokeZ1 - 0.2), a = R.range(0, Math.PI), w = R.range(1.0, 2.0), y0 = SMOKE.under + R.range(0.02, 0.12), y1 = SMOKE.over + R.range(-0.1, 0.12);
    const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    puffs.quad([x - dx, y0, z - dz], [x + dx, y0, z + dz], [x + dx, y1, z + dz], [x - dx, y1, z - dz], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  for (let x = -W / 2; x < W / 2 - 0.01; x += 2) for (let z = -D / 2; z < smokeZ1 - 0.01; z += 2) {
    const x1 = Math.min(W / 2, x + 2), z1 = Math.min(smokeZ1, z + 2), y = SMOKE.under + 0.04;
    under.quad([x, y, z], [x1, y, z], [x1, y, z1], [x, y, z1], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  const haze = new THREE.Group();
  c.add(haze);
  c.after.push(() => {
    const mk = (b, rgb, power) => { const m = new THREE.Mesh(kit.plain(b), kit.glowing(sTex, power, rgb, { transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 4; m.matrixAutoUpdate = false; m.updateMatrix(); haze.add(m); return m; };
    mk(puffs, [0.34, 0.33, 0.32], 0.85); mk(under, [0.3, 0.29, 0.28], 0.7);
  });

  /* the Fire Marshal */
  const fig = makeVoxGroup(kit, 'forest:marshal', fireMarshalVox(), 0.026, { room: c.rt.u }), led = makeVoxGroup(kit, 'forest:marshal:led', marshalLedVox(), 0.026, { room: c.rt.u });
  led.position.set(2.4 * 0.026, 52.2 * 0.026, 6.8 * 0.026); fig.add(led);
  c.add(fig);
  const start = rounds[0] || { x: 0, z: -D / 4 };
  const me0 = { x: start.x, z: start.z, rot: 0 };
  let marshal = makeMarshal(), smoke = makeSmoke(), next = 1, clock = 0, known = false, walked = 0;
  c.rt.burn = { get marshal() { return marshal; }, get smoke() { return smoke; }, get at() { return { ...me0 }; }, rounds };
  c.after.push(() => { fig.position.set(me0.x, 0, me0.z); fig.userData.light(c.sample(me0.x, 1.1, me0.z)); });
  const free = (x, z) => { if (Math.abs(x) > W / 2 - 0.35 || Math.abs(z) > D / 2 - 0.35) return false; const w = c.toWorld(x, z); return c.world.free(w.x, w.z, 0.24); };
  const go = (tx, tz, speed, dt) => {
    const dx = tx - me0.x, dz = tz - me0.z, d = Math.hypot(dx, dz); if (d < 0.05) return true;
    const step = Math.min(speed * dt, d);
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
      const cs = Math.cos(turn), sn = Math.sin(turn), ux = (dx * cs - dz * sn) / d, uz = (dx * sn + dz * cs) / d;
      const nx = me0.x + ux * step, nz = me0.z + uz * step;
      if (free(nx, nz)) { me0.x = nx; me0.z = nz; me0.rot = Math.atan2(ux, uz); walked += step; return d - step < 0.3; }
    }
    return true;                                                    // boxed in: count it as arrived, try the next point
  };
  // scissors: a jab makes it stand down (a resident with no body of its own in the list: only so that it can be jabbed)
  c.env.denizens?.add({
    id: 'fire-marshal', physical: false,
    get x() { return c.toWorld(me0.x, me0.z).x; }, get z() { return c.toWorld(me0.x, me0.z).z; }, get y() { return c.room.y || 0; },
    get visible() { return c.rt.group.visible; }, r: 0.32,
    snipTarget: () => (marshal.mode === 'cool' ? false : { id: 'fire-marshal', r: 0.5, priority: 2 }),
    snip() { if (marshal.mode === 'cool') return false; marshal = snipMarshal(marshal); const w = c.toWorld(me0.x, me0.z); c.env.play?.('snip', w.x, w.z, 7); return true; },
  });

  c.tick((dt, t, me) => {
    clock += dt;
    // sparks go up off the embers, round and round
    for (const s of sparks) { const k = ((clock * 0.28 + s.phase) % 1); s.m.position.y = k * 2.2; s.m.scale.setScalar(1 - k * 0.6); }
    haze.position.x = Math.sin(clock * 0.07) * 0.35; haze.position.z = Math.cos(clock * 0.05) * 0.25;

    // the visitor's head: in the smoke, or under it
    const eyeY = me.world ? me.world.y - (c.room.y || 0) - c.floorAt(me.x, me.z) : 1.1;
    const sm = stepSmoke(smoke, dt, { inSmoke: me.inside && inSmoke(me.x, me.z), eyeY });
    smoke = sm.state;
    if (sm.fog > 0.05 && me.inside) c.env.interfere?.(sm.fog * 0.8);
    if (sm.drain) { c.env.camera?.drain?.(sm.drain); }
    if (sm.cough) { const w = c.toWorld(me.x, me.z); c.env.play?.('static', w.x, w.z, 3); }

    // the Marshal
    const d = Math.hypot(me.x - me0.x, me.z - me0.z), wMe = c.toWorld(me.x, me.z), wM = c.toWorld(me0.x, me0.z);
    const clearLine = me.inside && c.world.los(wM.x, wM.z, wMe.x, wMe.z);
    const mr = stepMarshal(marshal, dt, { inside: me.inside, exposed: smoke.exposed, dist: d, clearLine });
    marshal = mr.state;
    if (!known && me.inside && d < 8 && c.seen(me0.x, me0.z, { radius: 0.6 })) { known = true; c.met('fire-marshal'); }
    if (mr.event === 'chirp') { c.env.play?.('beep', wM.x, wM.z, 9); }
    if (mr.event === 'lost' && known) c.survived('fire-marshal');
    if (mr.event === 'spray') { c.hurt(1); c.env.interfere?.(1); c.env.hud?.glitch?.(0.6); c.env.play?.('static', wM.x, wM.z, 10); c.env.play?.('glug', wM.x, wM.z, 8); }
    if (marshal.mode === 'pursue') go(me.x, me.z, mr.speed, dt);
    else if (marshal.mode === 'patrol' && rounds.length) { const r = rounds[next % rounds.length]; if (go(r.x, r.z, mr.speed, dt)) next++; }
    if (marshal.mode === 'chirp' || marshal.mode === 'pursue') me0.rot = Math.atan2(me.x - me0.x, me.z - me0.z);
    // its detector blinks: slow on its rounds, fast when it has somebody
    const rate = marshal.mode === 'patrol' ? 1 : marshal.mode === 'cool' ? 0.4 : 7;
    led.visible = Math.floor(clock * rate * 2) % 2 === 0;
    const bob = mr.speed > 0 ? Math.abs(Math.sin(walked * 3.2)) * 0.03 : 0;
    fig.position.set(me0.x, bob, me0.z); fig.rotation.y = me0.rot; fig.rotation.z = mr.speed > 0 ? Math.sin(walked * 3.2) * 0.04 : 0;
    if (c.rt.group.visible && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) fig.userData.light(c.sample(me0.x, 1.1, me0.z));
  });

  // a routed board by the door, the reserve's own, as if nothing has happened
  const sign = c.wallSpot(1.4, ['front'], 0.35, 2.0);
  if (sign) trailSign(c, sign.side, sign.at, 1.5, ['SECTOR 7 · CONTROLLED BURN', 'THANK YOU FOR PARTICIPATING'], { seed: p.seed % 97, warn: true });
}
