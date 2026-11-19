// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Windfall Shaft (`hollow-tree` — "the colossal hollow tree trunk bursting through the office floor").
//
// The floor's own themed way down (`goesDown` + `c.env.hold` + `c.env.descend`,
// parallel to `car-park.js` in `suburb` and `whirlpool-flume.js` in `waterpark`):
// A monumental sculpted `Vox` ancient redwood bole (`ancientHollowTreeVox` at
// `scale = 0.055`, ~3.3 m wide) erupts through torn ceiling tiles and heaved
// moss, fused organically with giant polypore bracket fungi, galvanized HVAC
// ductwork, and a grey steel filing cabinet wedged in its bark!
//
// Surrounded by a dense claustrophobic grove of gnarled pines, birches, mossy
// boulders, and a silent Barn Owl (`sadOwlVox`) watching from a stump.
//
// The way down is not offered. The archway is dark and the hollow inside it
// is only a hollow: nothing glows, nothing asks to be pressed. In its side wall,
// out of sight of the archway, low down under a root, a crack in the heartwood goes in
// further than the trunk is deep, and you only fit if you crouch to it. It
// takes you down, and the drop down costs a heart. (The owl watches you go in.)

import { goesDown } from '../seam.js';
import {
  forestRoom, woodlandLight, placeVox, placeVoxStack, trailSign, forestMural,
  stumpVox, plenumBreach, ensureForestDetail,
} from '../forest.js';
import { thicket } from '../forest-thicket.js';
import { buildBlindRingMaze, addMistVeils } from '../forest-maze.js';
import {
  ancientHollowTreeVox, sadOwlVox, mushroomRingVox, fallenNurseLogVox,
  hangingCanopyDrapeVox,
} from '../forest-models.js';

export function build(c) {
  const { H, R } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 0.96, { mode: 'islands', shaftTint: [0.98, 0.88, 0.56] });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false, thicket: false });

  // Monumental Full-AO Sculpted `Vox` Ancient Hollow Redwood (`ancientHollowTreeVox`, `scale = 0.055`)
  const cx = 0, cz = -0.35;
  const boleScale = 0.055;
  const tallVox = Math.max(88, Math.round((H + 0.25) / boleScale));

  // Pop a wide ragged cluster of 3D return-plenum ceiling breaches overhead where the ancient trunk punches through!
  const det = ensureForestDetail(c);
  for (const [hx, hz, idx] of [[cx, cz, 1], [cx - 0.9, cz, 2], [cx + 0.9, cz, 3], [cx, cz - 0.9, 4], [cx, cz + 0.9, 5]]) {
    plenumBreach(c, hx, hz, 2, idx + 81);
    if (idx > 1) det.pushVox({ key: 'forest:detail:ceildrape', make: hangingCanopyDrapeVox(), x: hx, y: H + 0.02, z: hz, rot: idx * 1.4, scale: 0.032 });
  }

  // Full per-vertex AO (`~46k` tris) gives deep shadowed bark flutes & glowing sap interior!
  placeVox(c, `forest:ancient:bole:${tallVox}:dark`, ancientHollowTreeVox(tallVox, false), cx, cz, {
    scale: boleScale,
  });
  c.blot(cx, cz, 4.6, 4.6, { rgb: [0.04, 0.03, 0.02], a: 0.62 });

  // Ring of colliders around the hollow trunk walls, leaving the `+Z` arched portal (`ang` near `Math.PI / 2`) wide open!
  const rMid = 1.38;
  for (let i = 0; i < 12; i++) {
    if (i === 2 || i === 3) continue; // `+Z` hollow archway entrance!
    const am = ((i + 0.5) / 12) * Math.PI * 2;
    const mx = cx + Math.cos(am) * rMid, mz = cz + Math.sin(am) * rMid;
    c.solid(mx - 0.36, mz - 0.36, mx + 0.36, mz + 0.36, { tall: true });
  }
  c.reserve(cx, cz, 2.55);
  c.reserve(cx, cz + 2.1, 1.45);

  // (No light inside the trunk. It used to glow amber out of the archway, with a light of its own, and offered the
  // way down from the middle of the room: the owner found it at once and was dropped a floor for pressing E. A way
  // down should be found. docs/AUDIT-LOG.md, 19 Nov)
  c.blot(cx - 0.3, cz, 1.6, 2.0, { rgb: [0.01, 0.01, 0.008], a: 0.7 });

  // ---- Themed Way Down (`goesDown` + `c.env.hold` + `c.env.descend`) --------
  // The crack in the side of the hollow (`-X`, under the root, out of sight of the archway): reached by going in
  // through the dark archway and turning, and only offered to someone crouched at it (C), facing it, close.
  const entryX = cx - 0.72, entryZ = cz;
  const chuteW = c.toWorld(cx - 0.6, cz);
  const SINK_TIME = 2.45;
  let sliding = 0, low = false;

  c.use({
    x: entryX,
    z: entryZ,
    r: 0.75,
    label: 'squeeze into the crack',
    when: () => !sliding && low,
    use: () => {
      if (goesDown(c.level.exit.way) && c.env.hold && c.env.descend) {
        c.env.play?.('creak', chuteW.x, chuteW.z, 10);
        c.env.play?.('slide', chuteW.x, chuteW.z, 9);
        c.env.interfere?.(0.5);
        c.env.hold(true);
        sliding = 0.001;
      } else {
        // (not a floor that goes down: the crack stops an arm's length in)
        c.env.play?.('knock', chuteW.x, chuteW.z, 8);
        c.env.play?.('creak', chuteW.x, chuteW.z, 7);
      }
    },
  });

  // Watching Barn Owl perched on a mossy stump right beside the hollow portal!
  const owlX = cx - 1.95, owlZ = cz + 1.85;
  const owl = placeVox(c, 'forest:sad:owl', sadOwlVox(), owlX, owlZ, { y: 0.45, rot: 0.35, scale: 0.027 });
  c.solid(owlX - 0.28, owlZ - 0.28, owlX + 0.28, owlZ + 0.28);
  c.reserve(owlX, owlZ, 0.7);

  c.tick((dt, _t, me) => {
    low = !!(me.inside && me.world?.crouching);
    if (me.inside && !sliding) {
      owl.rotation.y = Math.atan2(me.x - owlX, me.z - owlZ);
    }
    if (!sliding || sliding >= SINK_TIME + 1) return;
    sliding += dt;
    const k = Math.min(1, sliding / SINK_TIME);
    if (me.world) {
      const spiral = k * Math.PI * 2.2;
      const rad = (1 - k) * 0.45;
      const targetW = c.toWorld(cx + Math.cos(spiral) * rad, cz + Math.sin(spiral) * rad);
      me.world.x += (targetW.x - me.world.x) * Math.min(1, dt * 6);
      me.world.z += (targetW.z - me.world.z) * Math.min(1, dt * 6);
      me.world.sinkTo = 1.25 * k * k;
    }
    c.env.interfere?.(0.28 + 0.65 * k);
    if (sliding >= SINK_TIME) {
      sliding = SINK_TIME + 1;
      c.env.hold(false);
      // (the drop down costs a heart. If it was the last one, that is the end of the visit, and there is no floor below)
      const hit = c.hurt(1);
      if (hit.dead) { sliding = 0; if (me.world) me.world.sinkTo = 0; return; }
      if (!c.env.descend({ x: chuteW.x, z: chuteW.z })) {
        sliding = 0;
      }
    }
  });

  // Foreground camp lantern, owl's stump, mushroom ring & nurse log (all full AO!)
  const voxEntries = [
    { key: 'forest:hollow:stump', make: stumpVox(5), x: owlX, y: 0, z: owlZ, rot: 0.6, scale: 0.03 },
    { key: 'forest:under:mushrooms', make: mushroomRingVox(), x: cx + 2.05, y: 0, z: cz + 1.35, rot: -0.5, scale: 0.03 },
    { key: 'forest:under:log', make: fallenNurseLogVox(), x: cx - 2.65, y: 0, z: cz - 1.95, rot: 0.75, scale: 0.03 },
  ];
  c.solid(cx - 2.9, cz - 2.6, cx - 2.4, cz - 1.3);
  c.reserve(cx - 2.65, cz - 1.95, 0.9);
  placeVoxStack(c, 'forest:hollow:props', voxEntries);

  // Spiral stage-set painted-drywall & hedgerow labyrinth wrapping around the ancient hollow redwood!
  buildBlindRingMaze(c, {
    cx,
    cz,
    style: 'drywall',
    outerStyle: 'hedge',
    rInner: 3.05,
    h: 2.56,
    keepClear: [{ x: cx, z: cz, r: 2.75 }, { x: cx, z: cz + 2.05, r: 1.55 }, { x: owlX, z: owlZ, r: 0.9 }],
  });
  addMistVeils(c, [
    { x0: -2.2, z0: cz + 2.8, x1: 1.8, z1: cz + 2.8 },
  ], { color: [0.10, 0.14, 0.08], alpha: 0.60 });

  // Dense claustrophobic AAA forest crowding all round the ancient hollow redwood!
  thicket(c, {
    tag: 'windfall',
    ordCap: 108000,
    budget: 42000,
    detBudget: 62000,
    hub: [cx, cz + 2.4],
    laneWidth: 1.45,
    region: (x, z) => Math.hypot(x - cx, z - cz) > 2.85,
  });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      'WINDFALL CORE SHAFT',
      'MIND HVAC SAP DUCTS',
    ], { seed: 151, warn: true });
  }
  const spMural = c.wallSpot(3.0, ['back', 'left', 'right']);
  if (spMural) forestMural(c, spMural.side, spMural.at, 1.48, 2.85, 1.75, 1, 163 + R.int(0, 9));
}
