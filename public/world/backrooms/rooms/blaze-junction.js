// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Trail Loop (`blaze-junction` — "the ring of wooden trail arrows that turn when you look away").
//
// Observational & acoustic puzzle (`makeBlazePuzzle` / `stepBlazePuzzle`):
// Five numbered cedar Trail Blaze Posts surround a central stone Survey Cairn.
// Every decoy post rotates its painted wooden arrow whenever you look away!
//   - Sight clue: the brass plaque on the Cairn states the true stump's growth-
//     ring count (`TRUE BLAZE = N RINGS`); inspect the sculpted cut tree stumps
//     (`stumpVox`) beside the five posts and count their concentric heartwood rings!
//   - Sound clue: blow the Trail Call (`call`) whistle (or pull the Cairn Bell
//     cord `[E]`) and listen — a brass chime echoes back from the true post!
// Pulling the true post's latch pops open the central Ranger Supply Cache!

import { Batch } from '../kit.js';
import {
  forestRoom, woodlandLight, registerCallTarget,
  placeVoxStack, trailSign, forestMural,
  stumpVox,
  CEDAR_TIMBER, BRASS_TRIM, BLAZE_ORANGE,
} from '../forest.js';
import { thicket } from '../forest-thicket.js';
import { occluderWall, addMistVeils } from '../forest-maze.js';
import { makeBlazePuzzle, stepBlazePuzzle } from '../forest.rule.js';

export function build(c) {
  const { W, D, R, params: p } = c;
  c.shell({ panels: false });
  woodlandLight(c, 3, 3, 1, 1.02, { mode: 'islands' });
  forestRoom(c, { wrong: 0, spotter: false, signs: false });

  const nPosts = 5;
  const targetRings = p.targetRings || 4;
  const trueIdx = (p.trueIdx ?? 2) % nPosts;
  let puzzle = makeBlazePuzzle(nPosts, trueIdx, targetRings);

  // 1. Central Mossy Stone Survey Cairn + Locked Timber Ranger Cache (`0, 0`)
  for (const [ry, rad] of [[0.14, 0.62], [0.34, 0.48], [0.52, 0.36], [0.68, 0.25]]) {
    c.flat.ball(0, ry, 0, rad, [0.42, 0.44, 0.40], 0.65, 7);
  }
  // Brass bell hung on a small timber gallows atop the cairn
  c.flat.box(-0.04, 0.68, -0.04, 0.04, 1.38, 0.04, CEDAR_TIMBER);
  c.flat.box(-0.04, 1.32, -0.04, 0.24, 1.38, 0.04, CEDAR_TIMBER);
  c.flat.ball(0.20, 1.22, 0, 0.085, BRASS_TRIM, 1.1, 6);
  c.solid(-0.56, -0.56, 0.56, 0.56);
  c.reserve(0, 0, 1.05);

  // Ranger Supply Cache crate on the south side of the cairn (`0, 0.88`) with hinged lid
  const cx = 0, cz = 0.88;
  c.flat.box(cx - 0.42, 0, cz - 0.28, cx + 0.42, 0.42, cz + 0.28, [0.22, 0.38, 0.24], { skip: '-y' });
  const lidBatch = new Batch();
  lidBatch.box(cx - 0.44, 0.42, cz - 0.30, cx + 0.44, 0.49, cz + 0.30, CEDAR_TIMBER);
  lidBatch.box(cx - 0.08, 0.40, cz + 0.26, cx + 0.08, 0.48, cz + 0.33, BRASS_TRIM);
  const lidMesh = c.dynamic(lidBatch, { pivot: [cx, 0.42, cz - 0.28] });
  c.solid(cx - 0.44, cz - 0.30, cx + 0.44, cz + 0.30);

  // Rewards sit inside/atop the cache once unlocked (or leave them with `when` via lid opening:
  // `c.leave` items are physical pickups, so place them inside the crate at `y = 0.43` once opened,
  // or place them right on the cache shelf at `y = 0.18` shielded by the closed lid until solved!)
  // Wait: `c.leave` runs at build time! Let's check: if `c.leave('bandage', ...)` is at `y = 0.50`,
  // it's visible; if we want solving the puzzle to dispense the reward cleanly, we can ALSO give +charge / +heal
  // or slide the crate lid open to reveal the items tucked inside `(cx, cz)`! Let's tuck a `battery` & `bandage`
  // inside at `y = 0.14` and keep a solid cover or let opening the cache lift the lid + chime!
  c.leave('snack', cx - 0.18, cz + 0.04, { y: 0.49 });
  c.leave('battery', cx + 0.18, cz + 0.04, { y: 0.49 });

  // 2. Ring of 5 Trail Blaze Posts + Countable Growth-Ring Stumps (`rRing`)
  const rRing = Math.min(3.85, Math.min(W, D) * 0.5 - 2.05);
  const posts = [];
  const voxEntries = [];

  for (let i = 0; i < nPosts; i++) {
    const ang = (i / nPosts) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(ang) * rRing;
    const pz = Math.sin(ang) * rRing;

    // Cedar post + orange blaze collar + brass latch
    c.flat.box(px - 0.065, 0, pz - 0.065, px + 0.065, 1.56, pz + 0.065, CEDAR_TIMBER, { skip: '-y' });
    c.flat.box(px - 0.072, 1.05, pz - 0.072, px + 0.072, 1.22, pz + 0.072, BLAZE_ORANGE);
    c.flat.box(px - 0.045, 0.88, pz - 0.085, px + 0.045, 0.98, pz + 0.085, BRASS_TRIM);
    c.solid(px - 0.11, pz - 0.11, px + 0.11, pz + 0.11);
    c.reserve(px, pz, 0.65);

    // Dynamic wooden trail arrow atop the post (`y = 1.48`)
    const arrowB = new Batch();
    arrowB.box(px - 0.04, 1.44, pz - 0.28, px + 0.04, 1.54, pz + 0.26, [0.88, 0.78, 0.46]);
    arrowB.box(px - 0.11, 1.42, pz + 0.16, px + 0.11, 1.56, pz + 0.36, BLAZE_ORANGE); // tip points +Z
    const arrowMesh = c.dynamic(arrowB, { pivot: [px, 1.48, pz] });

    // Adjacent sculpted cut stump with `puzzle.rings[i]` countable concentric heartwood rings!
    const sx = px + Math.cos(ang + 0.42) * 0.62;
    const sz = pz + Math.sin(ang + 0.42) * 0.62;
    const nRings = puzzle.rings[i];
    voxEntries.push({
      key: `forest:puzzle:stump:${nRings}`,
      make: stumpVox(nRings),
      x: sx,
      y: 0,
      z: sz,
      rot: ang,
      scale: 0.031,
    });
    c.solid(sx - 0.26, sz - 0.26, sx + 0.26, sz + 0.26);

    posts.push({ idx: i, px, pz, arrowMesh });

    c.use({
      x: px,
      z: pz,
      r: 1.55,
      label: `pull blaze latch ${i + 1}`,
      when: () => !puzzle.solved,
      use: () => {
        const res = stepBlazePuzzle(puzzle, { triedIdx: i });
        puzzle = res.state;
        const pw = c.toWorld(px, pz);
        if (res.opened) {
          c.env.play?.('ding', pw.x, pw.z, 11);
          const cw = c.toWorld(cx, cz);
          c.env.play?.('door', cw.x, cw.z, 10);
          c.env.camera?.recharge?.(28); // rewards camera battery recharge too!
        } else if (res.shocked) {
          c.env.play?.('buzz', pw.x, pw.z, 9);
          c.env.camera?.drain?.(0.12);
          c.env.interfere?.(0.65);
          c.env.hud?.glitch?.(0.4);
        }
      },
    });
  }

  placeVoxStack(c, 'forest:blaze:stumps', voxEntries);

  // 5 Sightline-Blocking Pinwheel Hedgerow Baffles (`tall: true`, `h = 2.48 m`) between the 5 Blaze Posts
  // so NO two Blaze Posts can ever be seen at the same time — looking at one guarantees the others turn unseen!
  const clearPosts = [
    { x: 0, z: 0, r: 1.75 },
    ...posts.map((pt) => ({ x: pt.px, z: pt.pz, r: 1.15 })),
  ];
  for (let i = 0; i < nPosts; i++) {
    const midAng = ((i + 0.5) / nPosts) * Math.PI * 2 - Math.PI / 2;
    const mx = Math.cos(midAng) * (rRing * 0.88);
    const mz = Math.sin(midAng) * (rRing * 0.88);
    const alongX = Math.abs(Math.cos(midAng)) >= Math.abs(Math.sin(midAng));
    if (alongX) {
      occluderWall(c, mx - 1.15, mz - 0.14, mx + 1.15, mz + 0.14, { style: i % 2 ? 'drywall' : 'hedge', keepClear: clearPosts, h: 2.50 });
    } else {
      occluderWall(c, mx - 0.14, mz - 1.15, mx + 0.14, mz + 1.15, { style: i % 2 ? 'drywall' : 'hedge', keepClear: clearPosts, h: 2.50 });
    }
  }
  addMistVeils(c, [
    { x0: -2.4, z0: 1.8, x1: -0.9, z1: 1.8 },
    { x0: 0.9, z0: -1.8, x1: 2.4, z1: -1.8 },
  ], { color: [0.07, 0.15, 0.10], alpha: 0.62 });

  // Dense claustrophobic AAA woodland surrounding the 5-post Trail Loop clearing!
  if (c.rt.lights.length < 14) c.light(0, 1.35, 0, '#ffe09c', 0.72, { bank: 3, k: 1.6, far: 6.2 });
  thicket(c, {
    tag: 'blazering',
    laneWidth: 1.5,
    region: (x, z) => Math.hypot(x, z) > rRing + 1.05,
  });

  // Acoustic Echo Clue: pull the Cairn Bell `[E]` OR sound the Trail Call (`call`) whistle!
  const ringEchoClue = () => {
    const res = stepBlazePuzzle(puzzle, { rangCall: true });
    puzzle = res.state;
    const cairnW = c.toWorld(0, 0);
    c.env.play?.('ring', cairnW.x, cairnW.z, 8);
    if (res.chimedIdx >= 0) {
      const tp = posts[res.chimedIdx];
      const tw = c.toWorld(tp.px, tp.pz);
      setTimeout(() => c.env.play?.('ding', tw.x, tw.z, 14), 240);
    }
  };
  c.use({ x: 0.2, z: -0.2, r: 1.55, label: 'ring cairn bell', when: () => !puzzle.solved, use: ringEchoClue });
  registerCallTarget(c, 0, 0, ringEchoClue, { r: 13, when: () => !puzzle.solved });

  let lidOpen = 0;
  c.tick((dt, _t, me) => {
    if (me.inside && !puzzle.solved) {
      const seenMask = posts.map((pt) => c.seen(pt.px, pt.pz, { radius: 0.35 }));
      const res = stepBlazePuzzle(puzzle, { seenMask });
      puzzle = res.state;
      if (res.shuffled) {
        const anyPost = posts[(puzzle.trueIdx + 1) % nPosts];
        const w = c.toWorld(anyPost.px, anyPost.pz);
        c.env.play?.('clack', w.x, w.z, 6);
      }
    }

    // Point each post's wooden arrow toward its current `puzzle.pointTo[i]` target post!
    for (let i = 0; i < nPosts; i++) {
      const pt = posts[i];
      const tgt = posts[puzzle.pointTo[i]];
      const wantYaw = i === puzzle.pointTo[i]
        ? Math.atan2(-pt.px, -pt.pz) + Math.PI // points outward / steady
        : Math.atan2(tgt.px - pt.px, tgt.pz - pt.pz);
      pt.arrowMesh.rotation.y = wantYaw;
    }

    if (puzzle.solved && lidOpen < 1) {
      lidOpen = Math.min(1, lidOpen + dt * 2.2);
      lidMesh.rotation.x = -1.15 * lidOpen;
    }
  });

  // The survey board: the ring count and nothing else (the arrows and the bell are for the visitor to find)
  const spSign = c.wallSpot(1.55, ['front', 'back', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      'TRAIL LOOP SURVEY',
      `${targetRings} RINGS`,
    ], { seed: 91 + targetRings, warn: true, mess: 0.14 });
  }
  const spMural = c.wallSpot(3.0, ['left', 'right', 'back']);
  if (spMural) forestMural(c, spMural.side, spMural.at, 1.48, 2.85, 1.75, 1, 59 + R.int(0, 9));

  c.rt.blazePuzzle = {
    get state() { return puzzle; },
    posts,
  };
}
