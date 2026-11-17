// The Backrooms — a room of the Offsite Reserve (`forest`):
// The Rope Walk (`canopy-walk` — "the elevated rope bridges under the fluorescent ceiling").
//
// Six colossal indoor redwoods pierce the 5.6 m suspended ceiling. Ramped wooden
// stairs climb to `+1.80 m` treehouse decks linked by rope-and-plank bridges
// right beside hanging fluorescent office troffers!
//
// Overhead hang three **Manila Bagworm Husks** (`bagwormVox` + `stepBagworm`):
// loud upright walkers beneath them trigger a paper-shred warning before they
// drop; crouch (`C`), freeze, snip with Safety Scissors, or blow the Trail Call
// (`call`) whistle to reel them back up — and blowing `call` (or cranking the
// ground winch `[E]`) drops the counterweighted canopy drawbridge!

import { Batch } from '../kit.js';
import {
  forestRoom, woodlandLight, installForestFloor, registerCallTarget,
  makeVoxGroup, placeVoxStack, trailSign,
  bagwormVox, campLanternVox, plenumBreach, castCanopyShadow,
  CEDAR_TIMBER, BRASS_TRIM, BLAZE_ORANGE,
} from '../forest.js';
import { thicket } from '../forest-thicket.js';
import { occluderWall, addMistVeils, hangCardboardBirds, placeStageSetClutter } from '../forest-maze.js';
import { gnarledPineVox } from '../forest-models.js';
import { BAGWORM, makeBagworm, stepBagworm, snipBagworm } from '../forest.rule.js';

export function build(c) {
  const { W, D, H, kit } = c;
  c.shell({ panels: false });
  woodlandLight(c, 4, 3, 1, 1.06, { mode: 'canopy' });
  forestRoom(c, { wrong: 0, spotter: false, trail: false, signs: false });

  const deckY = 1.80;
  // West canopy deck (`x = -3.8..-1.8, z = -2.2..2.2`) + stepped ramp on `-x` side (`z = 2.2..5.2`)
  // East cache deck (`x = 1.8..3.8, z = -1.6..1.6`), bridged across `x = -1.8..1.8, |z| <= 0.72` once lowered!
  const wX0 = -3.8, wX1 = -1.8, wZ0 = -2.2, wZ1 = 2.2;
  const eX0 = 1.8, eX1 = 3.8, eZ0 = -1.6, eZ1 = 1.6;
  const rampZ0 = 2.2, rampZ1 = Math.min(D / 2 - 1.35, 5.4);

  let bridgeDown = false;
  let bridgeAngle = 1.28; // radians tilted up until lowered

  // Visual decks & stepped timber ascent ramp (`<= 0.16 m` per 0.125 m grid step!)
  c.flat.box(wX0, deckY - 0.14, wZ0, wX1, deckY, wZ1, CEDAR_TIMBER);
  c.flat.box(eX0, deckY - 0.14, eZ0, eX1, deckY, eZ1, CEDAR_TIMBER);
  // Rope-post railings along outer edges of both decks
  for (const [rx0, rz0, rx1, rz1] of [
    [wX0, wZ0, wX0 + 0.08, wZ1],
    [wX0, wZ0, wX1, wZ0 + 0.08],
    [eX1 - 0.08, eZ0, eX1, eZ1],
    [eX0, eZ0, eX1, eZ0 + 0.08],
    [eX0, eZ1 - 0.08, eX1, eZ1],
  ]) {
    c.flat.box(rx0, deckY, rz0, rx1, deckY + 0.92, rz1, [0.58, 0.44, 0.26]);
  }

  const nSteps = 12;
  const stepLen = (rampZ1 - rampZ0) / nSteps;
  for (let i = 0; i < nSteps; i++) {
    const zA = rampZ1 - (i + 1) * stepLen, zB = rampZ1 - i * stepLen;
    const sy = ((i + 1) / nSteps) * deckY;
    c.flat.box(wX0 + 0.15, sy - 0.16, zA, wX1 - 0.15, sy, zB, CEDAR_TIMBER);
  }

  // Dynamic Counterweighted Canopy Drawbridge pivoting from `(eX0, deckY, 0)` across to `wX1`!
  const spanLen = eX0 - wX1; // 3.6 m
  const drawBatch = new Batch();
  for (let i = 0; i < 12; i++) {
    const px0 = wX1 + i * (spanLen / 12) + 0.02;
    const px1 = px0 + (spanLen / 12) - 0.04;
    drawBatch.box(px0, deckY - 0.08, -0.68, px1, deckY, 0.68, CEDAR_TIMBER);
  }
  drawBatch.box(wX1, deckY + 0.82, -0.68, eX0, deckY + 0.88, -0.62, [0.72, 0.62, 0.42]);
  drawBatch.box(wX1, deckY + 0.82, 0.62, eX0, deckY + 0.88, 0.68, [0.72, 0.62, 0.42]);
  const bridgeMesh = c.dynamic(drawBatch, { pivot: [eX0, deckY, 0] });
  bridgeMesh.rotation.z = -bridgeAngle;

  // Ground-level Forestry Winch & Acoustic Latch (`winchX, winchZ`)
  const winchX = 1.35, winchZ = 2.15;
  c.flat.box(winchX - 0.22, 0, winchZ - 0.22, winchX + 0.22, 1.05, winchZ + 0.22, CEDAR_TIMBER, { skip: '-y' });
  c.flat.box(winchX - 0.26, 0.85, winchZ - 0.06, winchX + 0.26, 1.12, winchZ + 0.06, BRASS_TRIM);
  c.flat.box(winchX - 0.08, 1.12, winchZ - 0.08, winchX + 0.08, 1.24, winchZ + 0.08, BLAZE_ORANGE);
  c.solid(winchX - 0.24, winchZ - 0.24, winchX + 0.24, winchZ + 0.24);
  c.reserve(winchX, winchZ, 0.65);

  const releaseDrawbridge = () => {
    if (bridgeDown) return;
    bridgeDown = true;
    const w = c.toWorld(eX0, 0);
    c.env.play?.('creak', w.x, w.z, 12);
    c.env.play?.('clack', w.x, w.z, 10);
  };
  c.use({ x: winchX, z: winchZ, r: 1.65, label: 'crank canopy winch', when: () => !bridgeDown, use: releaseDrawbridge });
  registerCallTarget(c, 0, 0, releaseDrawbridge, { r: 14, when: () => !bridgeDown });

  c.tick((dt) => {
    const want = bridgeDown ? 0 : 1.28;
    if (Math.abs(bridgeAngle - want) > 0.002) {
      bridgeAngle += (want - bridgeAngle) * Math.min(1, dt * 3.4);
      bridgeMesh.rotation.z = -bridgeAngle;
    }
  });

  // Dry bracken carpet under the canopy + elevated `floorY` across ramp, decks, and lowered drawbridge!
  installForestFloor(c, {
    brackens: [{ x0: -1.4, z0: -3.2, x1: 1.4, z1: 3.2 }],
    bridgeAt: (x, z) => {
      if (x >= wX0 && x <= wX1 && z >= wZ0 && z <= wZ1) return { on: true, y: deckY };
      if (x >= wX0 + 0.1 && x <= wX1 - 0.1 && z >= rampZ0 && z <= rampZ1) {
        const u = 1 - (z - rampZ0) / (rampZ1 - rampZ0);
        return { on: true, y: Math.max(0, Math.min(deckY, u * deckY)) };
      }
      if (bridgeDown && x >= wX1 - 0.05 && x <= eX0 + 0.05 && Math.abs(z) <= 0.66) {
        return { on: true, y: deckY };
      }
      if (x >= eX0 && x <= eX1 && z >= eZ0 && z <= eZ1) return { on: true, y: deckY };
      return { on: false, y: null };
    },
  });

  // Six colossal full-AO redwood trunks supporting the two canopy decks (consolidated into 1 mesh!)
  const redwoodScale = 0.042;
  const tallVox = Math.max(96, Math.round((H + 0.18) / redwoodScale));
  const trunkCoords = [
    [wX0 + 0.25, wZ0 + 0.25], [wX1 - 0.25, wZ0 + 0.25], [wX0 + 0.25, wZ1 - 0.25],
    [eX0 + 0.25, eZ0 + 0.25], [eX1 - 0.25, eZ0 + 0.25], [eX1 - 0.25, eZ1 - 0.25],
  ];
  const stackEntries = trunkCoords.map(([tx, tz], idx) => {
    plenumBreach(c, tx - 0.15, tz - 0.15, 1, idx + 31);
    castCanopyShadow(c, tx, tz, 1.65, idx + 5);
    c.solid(tx - 0.28, tz - 0.28, tx + 0.28, tz + 0.28, { tall: true });
    c.reserve(tx, tz, 0.55);
    return {
      key: `forest:canopy:pine:${tallVox}`,
      make: gnarledPineVox(tallVox, true),
      x: tx,
      y: 0,
      z: tz,
      rot: idx * 1.05,
      scale: redwoodScale,
    };
  });
  stackEntries.push({
    key: 'forest:canopy:lantern',
    make: campLanternVox(),
    x: eX1 - 0.55,
    y: deckY,
    z: 0,
    scale: 0.028,
  });
  c.light(eX1 - 0.55, deckY + 0.45, 0, '#ffd480', 0.68, { bank: 3, k: 1.6, far: 5.8 });
  placeVoxStack(c, 'forest:canopy:redwoods', stackEntries);

  // Ground-floor painted-drywall & hedgerow baffles + upper canopy mist veils shrouding the rope bridge & Bagworms!
  const clearWalk = [{ x: winchX, z: winchZ, r: 1.15 }, { x: -2.8, z: rampZ1, r: 1.35 }];
  occluderWall(c, -1.25, -3.55, 1.45, -3.32, { style: 'drywall', keepClear: clearWalk, h: 2.55 });
  occluderWall(c, -W * 0.38, -0.25, -4.45, 0.20, { style: 'hedge', keepClear: clearWalk, h: 2.55 });
  occluderWall(c, 4.45, -0.20, W * 0.38, 0.25, { style: 'drywall', keepClear: clearWalk, h: 2.55 });
  placeStageSetClutter(c, [[-0.4, 3.35], [4.4, 2.25]]);
  hangCardboardBirds(c, 0, 0, 3);
  addMistVeils(c, [
    { x0: -0.9, z0: -1.6, x1: -0.9, z1: 1.6, y0: 0.1, y1: 3.6 },
    { x0: 0.9, z0: -1.6, x1: 0.9, z1: 1.6, y0: 0.1, y1: 3.6 },
  ], { color: [0.06, 0.14, 0.09], alpha: 0.62 });

  // Claustrophobic AAA ground-floor forest & ferns surrounding the elevated rope bridges (`big: true` 500k tier)!
  thicket(c, {
    tag: 'canopyfloor',
    big: true,
    ordCap: 230000,
    budget: 118000,
    detCap: 244000,
    detBudget: 192000,
    laneWidth: 1.48,
    spacing: 0.80,
    trees: 42,
    companionStems: 38,
    under: 74,
    hillsOpt: { style: 'rocky', density: 1.5, maxHeight: 2.35 },
    region: (x, z) => (x < wX0 - 0.55 || x > eX1 + 0.55 || z < -2.65 || z > rampZ1 + 0.55),
  });

  // Reward supply on the East Canopy Platform once the drawbridge is lowered!
  c.leave('battery', eX0 + 0.95, 0.35, { y: deckY });
  c.leave('snack', eX0 + 0.95, -0.35, { y: deckY });

  // ---- Overhead Ambush Entities: 3 MANILA BAGWORM HUSKS ---------------------
  const bagSpots = [
    [0.0, -1.85],
    [0.15, 1.35],
    [-2.8, 0.0], // hangs above the West Canopy Deck (`deckY + 1.45`)!
  ];
  let metBagworm = false;

  bagSpots.forEach(([bx, bz], idx) => {
    const overDeck = bx < -1.7;
    const baseFloor = overDeck ? deckY : 0;
    const topY = H - 0.08;
    let bwState = makeBagworm(bx, bz, topY, 1.35);

    const rigGroup = makeVoxGroup(kit, `forest:bagworm:${idx}`, bagwormVox(), 0.028);
    const worldPos = c.toWorld(bx, bz);
    rigGroup.position.set(0, 0, 0);

    // Register each Bagworm with `denizens` so Safety Scissors can snip them mid-drop!
    const den = c.env.denizens?.add({
      id: `bagworm-${idx}`,
      x: worldPos.x,
      y: (c.room.y || 0) + topY,
      z: worldPos.z,
      r: 0.28,
      tall: 1.15,
      heading: idx * 1.7,
      group: rigGroup,
      light: (rgb) => rigGroup.userData.light(rgb),
      snipTarget: () => (bwState.mode === 'dropping' || bwState.mode === 'windup' || bwState.mode === 'reeling'
        ? { id: 'manila-bagworm', r: 0.48, priority: 2 }
        : false),
      snip() {
        if (!metBagworm) { metBagworm = true; c.met('manila-bagworm'); }
        bwState = snipBagworm(bwState);
        c.env.play?.('snip', worldPos.x, worldPos.z, 8);
        c.env.play?.('shred', worldPos.x, worldPos.z, 8);
        c.survived('manila-bagworm');
        return { ok: true, target: 'manila-bagworm' };
      },
      update(dt, time, me) {
        const inRoom = c.world.current() === c.rt;
        if (!inRoom) return;
        const pLoc = c.toLocal(me.x, me.z);
        const horizDist = Math.hypot(pLoc.x - bx, pLoc.z - bz);
        const speedNow = Math.hypot(me.vx || 0, me.vz || 0);
        const keys = c.env.player?.input?.keys;
        const crouch = !!(keys && keys.has('c'));
        const playerFloor = c.rt.floorY ? c.rt.floorY(pLoc.x, pLoc.z) : baseFloor;
        const recentCall = c.rt.lastCall && (performance.now() * 0.001 - c.rt.lastCall.time) < 0.35;

        const res = stepBagworm(bwState, dt, {
          horizDist,
          playerY: playerFloor,
          speed: speedNow,
          crouch,
          heardCall: !!recentCall,
        });
        bwState = res.state;
        den.y = (c.room.y || 0) + bwState.y;
        rigGroup.rotation.y = time * 0.35 + idx;
        rigGroup.rotation.z = bwState.mode === 'windup' ? Math.sin(time * 32) * 0.14 : Math.sin(time * 1.8 + idx) * 0.04;

        if (res.warned) {
          if (!metBagworm) { metBagworm = true; c.met('manila-bagworm'); }
          c.env.play?.('shred', worldPos.x, worldPos.z, 9);
        }
        if (res.bit) {
          if (!metBagworm) { metBagworm = true; c.met('manila-bagworm'); }
          c.env.play?.('shred', worldPos.x, worldPos.z, 10);
          c.env.interfere?.(0.75);
          const hit = c.hurt(BAGWORM.hurt);
          if (hit?.landed) {
            c.env.hud?.glitch?.(0.45);
            c.survived('manila-bagworm');
          }
        }
      },
    });

    // Fallback tick when `denizens` is absent in unit tests
    if (!den) {
      c.add(rigGroup);
      rigGroup.position.set(bx, topY, bz);
    }
  });

  const spSign = c.wallSpot(1.55, ['front', 'left', 'right']);
  if (spSign) {
    trailSign(c, spSign.side, spSign.at, 1.52, [
      'CANOPY ROPE WALK',
      'SOUND CALL OR CRANK WINCH',
      'CROUCH [C] UNDER COCOONS',
    ], { seed: 73, warn: true });
  }
}
