// The Backrooms — a room of the corporate aquatics annex (`waterpark`):
// The Surge Basin ("the sloping tiled beach facing the dark wave grates").
//
// A municipal wave pool squeezed beneath a low suspended acoustic tile ceiling.
// At the far wall, four dark rusted pneumatic wave-caissons boom behind steel
// bars; when the amber klaxon flashes, a cresting wall of turquoise water rolls
// toward the damp-carpeted shoreline. Duck completely underwater (`C`) or stand
// in the lee of a tiled breakwater bollard to let the surge pass harmlessly!

import {finishPoolRoom} from '../pool-finish.js';
import * as THREE from 'three';
import { Batch, lin, WHITE } from '../kit.js';
import {
  poolroom, natatoriumLight, createBasin,
  poolSign, depthTile, loungerVox, lifeRingVox, innerTubeVox, placeVox,
  COPING, CHROME, GROUT_DARK, poolTileTex,
} from '../waterpark.js';
import { waveState, wavePush } from '../waterpark.rule.js';

export function build(c) {
  const { W, D, H, params: p, kit } = c;
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

  // Dynamic rolling wave crest + foam lip spanning the basin width
  const waveW = bx1 - bx0 - 0.16;
  const crestBatch = new Batch();
  // Faceted curling cross-section with a broken foam lip, not a stack of
  // rectangular slabs. The old hazard bounds and timing are unchanged.
  const profile=[[-.65,-.35],[-.55,.05],[-.32,.42],[.02,.65],[.38,.68],[.58,.49],[.30,.34],[.10,.36],[.05,.18],[.55,-.35]];
  let lastJitter=0;
  for(let x=-waveW/2,i=0;x<waveW/2;x+=.32,i++){
    const end=Math.min(waveW/2,x+.32),jitter=.025*Math.sin(i*1.7),nextJitter=.025*Math.sin((i+1)*1.7);
    lastJitter=nextJitter;
    for(let k=0;k<profile.length;k++){
      const [z0,y0]=profile[k],[z1,y1]=profile[(k+1)%profile.length];
      const col=lin(k===3||k===4?'#d4e2cf':k===5||k===6?'#9cbcab':k<3?'#518e83':'#317367');
      crestBatch.quad([x,y0+jitter,z0],[x,y1+jitter,z1],[end,y1+nextJitter,z1],[end,y0+nextJitter,z0],col);
    }
    if(i%5!==2){
      const w=.08+(i%3)*.035,z=.20+(i%4)*.045;
      crestBatch.box(x+.04,.66+jitter,z,Math.min(end,x+.04+w),.685+jitter,z+.06,lin('#dce5ce'));
    }
  }
  // The shore-side promenade sees the ends of the moving sheet too.
  const caps=THREE.ShapeUtils.triangulateShape(profile.map(([z,y])=>new THREE.Vector2(z,y)),[]);
  for(const [side,jitter] of [[-1,0],[1,lastJitter]])for(const face of caps){
    const pts=face.map(i=>[side*waveW/2,profile[i][1]+jitter,profile[i][0]]);
    if(side>0)pts.reverse();
    crestBatch.tri(...pts,lin('#518e83'));
  }
  const crestMesh = c.dynamic(crestBatch, { pivot: [0, -0.06, bz0] });
  crestMesh.visible = false;
  c.rt.wavePool = { get crestZ() { return crestMesh.visible ? crestMesh.position.z : null; } };

  // Rotating/flashing amber klaxon dome above the pneumatic wave grates
  const klaxonBatch = new Batch();
  klaxonBatch.box(-0.18, -0.12, -0.18, 0.18, 0.18, 0.18, [0.98, 0.62, 0.12]);
  const klaxonMesh = c.dynamic(klaxonBatch, { pivot: [0, 2.35, bz0 - 0.25] });

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
        klaxonMesh.rotation.y = t * 9.0;
        klaxonMesh.scale.setScalar(1.0 + 0.25 * Math.sin(t * 22));
        if (!klaxonPlayed && me.inside) {
          klaxonPlayed = true;
          const w = c.toWorld(0, bz0);
          c.env.play?.('whir', w.x, w.z, 11);
        }
      } else {
        klaxonPlayed = false;
        klaxonMesh.scale.setScalar(0.85);
      }

      if (ws.active) {
        crestMesh.visible = true;
        crestMesh.position.set(0, -0.05 + (ws.amp - 0.62) * 0.6, ws.crestZ);
        crestMesh.scale.set(1, Math.max(0.25, ws.amp / 0.72), 1);
      } else {
        crestMesh.visible = false;
      }

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

  // Render the two tiled breakwater bollards with yellow/black hazard stripe caps
  const cobTile = c.mapped('wp:pier:cobalt', poolTileTex(kit, 'cobalt'));
  for (const pr of piers) {
    const fY = slopeFloor(pr.x, pr.z);
    cobTile.box(pr.x - pr.w / 2, fY, pr.z - pr.d / 2, pr.x + pr.w / 2, 0.85, pr.z + pr.d / 2, WHITE, { uv: 0.7 });
    c.flat.box(pr.x - pr.w / 2 - 0.04, 0.85, pr.z - pr.d / 2 - 0.04, pr.x + pr.w / 2 + 0.04, 0.92, pr.z + pr.d / 2 + 0.04, COPING);
    c.solid(pr.x - pr.w / 2, pr.z - pr.d / 2, pr.x + pr.w / 2, pr.z + pr.d / 2);
  }

  // Pneumatic Wave-Caisson Wall at bz0: 4 dark flooded chambers behind vertical steel bars!
  const nBays = 4, bayW = (bx1 - bx0 - 1.0) / nBays;
  c.flat.box(bx0, -maxDepth, bz0 - 0.48, bx1, 2.25, bz0 + 0.04, [0.16, 0.22, 0.26]);
  for (let i = 0; i < nBays; i++) {
    const cx = bx0 + 0.5 + (i + 0.5) * bayW;
    const xA = cx - bayW * 0.38, xB = cx + bayW * 0.38;
    // Deep black pneumatic maw
    c.flat.box(xA, -maxDepth + 0.05, bz0 - 0.42, xB, 1.45, bz0 + 0.06, [0.02, 0.03, 0.04]);
    // Rusted vertical steel grate bars
    for (let bx = xA + 0.18; bx < xB - 0.1; bx += 0.26) {
      c.flat.box(bx - 0.025, -maxDepth + 0.05, bz0 + 0.03, bx + 0.025, 1.45, bz0 + 0.08, [0.34, 0.25, 0.20]);
    }
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

  void H;
  void basin;
  finishPoolRoom(c,'wave-pool');
}
