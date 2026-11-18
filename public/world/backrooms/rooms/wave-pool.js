// The Backrooms — a room of the corporate aquatics annex (`waterpark`):
// The Surge Basin ("the sloping tiled beach facing the dark wave grates").
//
// A municipal wave pool squeezed beneath a low suspended acoustic tile ceiling.
// At the far wall, four dark rusted pneumatic wave-caissons boom behind steel
// bars; when the amber klaxon flashes, a cresting wall of turquoise water rolls
// toward the damp-carpeted shoreline. Duck completely underwater (`C`) or stand
// in the lee of a tiled breakwater bollard to let the surge pass harmlessly!

import {waveCaissons} from './wave-pool/caissons.js';
import {finishPoolRoom} from '../pool-finish.js';
import * as THREE from 'three';
import { Batch, WHITE } from '../kit.js';
import { SWELL, swellUnit, swellCrestZ } from '../liquid.rule.js';
import {
  poolroom, natatoriumLight, createBasin, addTranslucent,
  poolSign, depthTile, loungerVox, lifeRingVox, innerTubeVox, placeVox,
  COPING, GROUT_DARK, poolTileTex,
} from '../waterpark.js';
import { waveState, wavePush } from '../waterpark.rule.js';

export function build(c) {
  const { W, D, params: p, kit } = c;
  c.shell({ panels: false, floor: false, wallTex:poolTileTex(c.kit,'white') });
  natatoriumLight(c, 4, 4, 2, 1.08);
  poolroom(c, { wrong: 0, footbath: false, signs: false });

  // Dry promenades on all 4 sides (>= 1.9 m wide) so left/right/front doorways + stash are always unobstructed!
  const bx0 = -W / 2 + 1.95, bx1 = W / 2 - 1.95;
  const bz0 = -D / 2 + 2.05, bz1 = D / 2 - 2.35;
  const maxDepth = 1.18;

  // Gently sloping mosaic shoreline: 0 m at +z beach (bz1) down to -1.18 m at -z caissons (bz0)
  const slopeFloor = (x, z) => {
    const u = Math.max(0, Math.min(1, (bz1 - z) / (bz1 - bz0)));
    return -maxDepth * Math.pow(u, 0.92);
  };

  // Two tiled breakwater piers standing inside the surf (shelter behind +z face!)
  const shift = p.bollardShift || 0;
  const piers = [
    { x: -2.4 + shift * 0.4, z: 1.6, w: 1.45, d: 0.55 },
    { x: 2.3 + shift * 0.4, z: -2.1, w: 1.45, d: 0.55 },
  ];

  // The wave as the room draws it (Classic and Low): a see-through strip of the water's own swell (liquid.rule.js
  // swellUnit: the shape the surface itself rises into at Medium and High), in the pool water's muted teal, with a
  // broken pale foam top in 4 px texels and a darker trough behind, moved and raised by the tick as the crest always
  // was. At Medium and High the surface rises (`water.swell`, below) and this is its stand-in, hidden for the
  // camcorder's draw. The hazard's bounds and timing are unchanged.
  const stripX0 = bx0 + 0.08, stripX1 = bx1 - 0.08, spans = 24;
  // rows (metres ahead of the crest), closer near it; the first and last tuck under the sheet
  const rowsD = [-2.4, -2.1, -1.8, -1.5, -1.2, -0.9, -0.6, -0.4, -0.25, -0.1, 0, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1.05, 1.35, 1.7, 2.05, 2.4];
  const wallFade = (x) => { const t = Math.max(0, Math.min(1, Math.min(x - stripX0, stripX1 - x) / SWELL.wall)); return t * t * (3 - 2 * t); };
  const stripPoint = (x, r) => {
    const d = rowsD[r], h = r === 0 || r === rowsD.length - 1 ? 0 : swellUnit(d) * (1 + SWELL.vary[0] * Math.sin(x * SWELL.vary[1] + SWELL.vary[2])) * wallFade(x);
    return [x, h, d + swellCrestZ(0, x)];
  };
  const stripSkin = kit.tex.custom('surge:swell-strip', 256, 256, (g, w, h) => {
    // 64 × 64 texels of 4 px: v runs from behind the crest (0, the canvas's foot) to ahead of it (1, its top)
    const hash = (i, j) => { let k = (i * 374761393 + j * 668265263) | 0; k = Math.imul(k ^ (k >>> 13), 1274126177); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
    for (let r = 0; r < 64; r++) for (let q = 0; q < 64; q++) {
      const d = -2.4 + (r + 0.5) / 64 * 4.8, u = swellUnit(d), n = hash(q, r);
      // the pool water's teal (causticWaterTex aqua), a little lifted toward the crest; the trough a shade darker
      let col = u < -0.03 ? [28, 76, 86] : [61 + 70 * u, 129 + 68 * u, 131 + 56 * u];
      if (d > 0.15 && u > 0.3) col = col.map((v) => v - 8);           // the face, a little darker than the crest
      const foam = d > -0.32 && d < 0.14 ? 0.5 : d > -0.6 && d < 0.3 ? 0.18 : 0;
      if (n < foam) col = n < foam * 0.55 ? [222, 234, 226] : [168, 202, 196];
      g.fillStyle = `rgb(${col.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`;
      g.fillRect(q * 4, (63 - r) * 4, 4, 4);
    }
  });
  const stripBatch = new Batch();
  for (let i = 0; i < spans; i++) {
    const xa = stripX0 + (stripX1 - stripX0) * i / spans, xb = stripX0 + (stripX1 - stripX0) * (i + 1) / spans;
    for (let r = 0; r < rowsD.length - 1; r++) {
      const va = (rowsD[r] + 2.4) / 4.8, vb = (rowsD[r + 1] + 2.4) / 4.8;
      stripBatch.quad(stripPoint(xa, r), stripPoint(xa, r + 1), stripPoint(xb, r + 1), stripPoint(xb, r), WHITE,
        [[xa / 3.8, va], [xa / 3.8, vb], [xb / 3.8, vb], [xb / 3.8, va]]);
    }
  }
  const crestMesh = addTranslucent(c, stripBatch, { map: stripSkin, alpha: 0.7, side: THREE.FrontSide, order: 5 });
  c.after.push(() => { crestMesh.userData.mesh = crestMesh.children[0]; });
  crestMesh.name = 'surge-crest';
  crestMesh.visible = false;
  crestMesh.userData.liquidStandIn = true;        // (at Medium and High the water's own swell is drawn in its place)
  c.rt.wavePool = { get crestZ() { return crestMesh.visible ? crestMesh.position.z : null; } };
  const cobTile = c.mapped('wp:pier:cobalt', poolTileTex(kit, 'cobalt'));
  const klaxonMesh=waveCaissons(c,cobTile,bx0,bx1,bz0,-maxDepth);

  let klaxonPlayed = false;
  let surgeHitCooldown = 0;

  const basin = createBasin(c, {
    x0: bx0, z0: bz0, x1: bx1, z1: bz1,
    depth: maxDepth,
    waterY: -0.05,
    tile: 'seafoam',
    wallTile: 'cobalt',
    waterTone: 'aqua',
    stepsSide: 'none',
    floorAtInner: slopeFloor,
    onTick: (info, dt, t, me) => {
      surgeHitCooldown = Math.max(0, surgeHitCooldown - dt);
      const ws = waveState(t, bz0 + 0.6, bz1 - 0.4);

      if (ws.klaxon) {
        klaxonMesh.visible = true;
        klaxonMesh.rotation.y = t * 6.2;
        if (!klaxonPlayed && me.inside) {
          klaxonPlayed = true;
          const w = c.toWorld(0, bz0);
          c.env.play?.('whir', w.x, w.z, 11);
        }
      } else {
        klaxonPlayed = false;
        klaxonMesh.visible = false;
      }

      if (ws.active) {
        crestMesh.visible = true;
        crestMesh.position.set(0, -0.065, ws.crestZ);
        crestMesh.scale.set(1, Math.max(0.05, ws.amp * SWELL.scale), 1);
      } else {
        crestMesh.visible = false;
      }
      // the water's own swell at Medium and High (nothing at Classic and Low): where the crest is, how high, how far broken
      info.water?.swell?.(ws.active ? { at: ws.crestZ, height: ws.amp, breaking: Math.max(0, Math.min(1, (ws.u - 0.55) / 0.35)) } : null);

      if (me.inside && me.world && info.inBasin(me.x, me.z)) {
        const sheltered = piers.some((pr) => Math.abs(me.x - pr.x) <= pr.w * 0.58 && me.z > pr.z && me.z < pr.z + 2.1);
        const push = wavePush(ws, me.z, {
          inWater: info.swimmer.inWater,
          submerged: info.swimmer.submerged,
          sheltered,
        });
        if (push > 0) {
          const roomYaw = (c.room.rot * Math.PI) / 2;
          // Push along local +z in world coordinates
          const wx = Math.sin(roomYaw) * push, wz = Math.cos(roomYaw) * push;
          me.world.vx += (wx - me.world.vx) * Math.min(1, dt * 7.5);
          me.world.vz += (wz - me.world.vz) * Math.min(1, dt * 7.5);
          if (surgeHitCooldown <= 0) {
            surgeHitCooldown = 2.4;
            const w = c.toWorld(me.x, me.z);
            c.env.play?.('wade', w.x, w.z, 9);
            c.env.interfere?.(0.55);
            c.env.camera?.drain?.(0.06);
          }
        }
      }
    },
  });

  // what the water's swell breaks on (rings at Medium and High): the piers, and the beach along its far end
  basin.water?.swellBreaks?.(piers.map((pr) => ({ x0: pr.x - pr.w / 2, z0: pr.z - pr.d / 2, x1: pr.x + pr.w / 2, z1: pr.z + pr.d / 2 })), { z: bz1, x0: bx0, x1: bx1 });

  // Render the two tiled breakwater bollards with yellow/black hazard stripe caps
  for (const pr of piers) {
    const fY = slopeFloor(pr.x, pr.z);
    cobTile.box(pr.x - pr.w / 2, fY, pr.z - pr.d / 2, pr.x + pr.w / 2, 0.85, pr.z + pr.d / 2, WHITE, { uv: 0.7 });
    c.flat.box(pr.x - pr.w / 2 - 0.04, 0.85, pr.z - pr.d / 2 - 0.04, pr.x + pr.w / 2 + 0.04, 0.92, pr.z + pr.d / 2 + 0.04, COPING);
    c.solid(pr.x - pr.w / 2, pr.z - pr.d / 2, pr.x + pr.w / 2, pr.z + pr.d / 2);
  }

  c.light(0, 1.85, bz0 + 0.6, '#ffae38', 0.78, { k: 2.6, far: 9 });

  // Backrooms shoreline wrongness: poolside loungers lined up at the tideline, one waterlogged office filing cabinet in the surf, and life rings
  placeVox(c, 'wp:lounger:#2b8da8', loungerVox('#2b8da8'), bx0 + 0.85, bz1 + 0.75, { rot: Math.PI, solidRadius: 0.36 });
  placeVox(c, 'wp:lounger:#e05a47', loungerVox('#e05a47'), bx1 - 0.85, bz1 + 0.75, { rot: Math.PI - 0.18, solidRadius: 0.36 });
  placeVox(c, 'wp:tube:#f2c12e:0', innerTubeVox('#f2c12e', false), -1.6, bz1 - 1.5, { y: -0.09, rot: 0.6 });
  placeVox(c, 'wp:lifering', lifeRingVox(), W / 2 - 0.12, -2.5, { y: 1.15, rot: -Math.PI / 2 });
  if (c.hasProp('cabinet')) {
    c.prop('cabinet', bx1 - 1.1, 2.8, { y: slopeFloor(bx1 - 1.1, 2.8), rot: -1.2, solid: false, shadow: false });
  }

  // Reward battery on dry maintenance plinth near the far -z caisson promenade
  c.flat.box(bx1 + 0.35, 0, bz0 + 0.3, bx1 + 1.05, 0.42, bz0 + 1.0, GROUT_DARK, { skip: '-y' });
  c.leave('battery', bx1 + 0.7, bz0 + 0.65, { y: 0.42 });

  // Depth markers & garbled wave-schedule board
  depthTile(c, 0, 0.02, bz1 + 0.22, 'BEACH 0.0M', 0, 5);
  depthTile(c, bx0 - 0.45, 0.02, bz0 + 0.9, 'CAISSON 1.2M', Math.PI / 2, 9);
  poolSign(c, 'back', 0, 3.05, [
    `${p.dept || 'Q3 TIDE'} WAVE POOL`,
    'HORN SOUNDS BEFORE SURGE',
    'NO FILING IN BREAKERS',
  ], { w: 2.1, h: 0.92, seed: 29, warn: true, mess: 0.22 });

  finishPoolRoom(c,'wave-pool');
}
