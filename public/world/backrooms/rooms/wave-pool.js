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
import {
  poolroom, natatoriumLight, createBasin,
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

  // Dynamic rolling wave crest + foam lip spanning the basin width
  const waveW = bx1 - bx0 - 0.16;
  const crestBatch = new Batch();
  // Faceted curling cross-section with a broken foam lip, not a stack of
  // rectangular slabs. The old hazard bounds and timing are unchanged.
  const profile=[[-.65,-.35],[-.55,.05],[-.32,.42],[.02,.65],[.38,.68],[.58,.49],[.30,.34],[.10,.36],[.05,.18],[.55,-.35]];
  function crestPoint(x, k) {
    const [z,y]=profile[k];
    const sweep=.15*Math.sin(x*1.5) + .07*Math.sin(x*3.3+.5);
    const roll=.10*Math.cos(x*1.7) + .055*Math.sin(x*3.7);
    return [x, y + Math.max(y,0)*roll, bz0 + z + sweep];
  }
  // Broken runs of foam gather on the rolled lip, leaving wet green gaps
  // across its width. Map the cross-section continuously around the curve.
  const rollerSkin = kit.tex.custom('surge:breaking-water', 256, 80, (g, width, height) => {
    g.fillStyle = '#387b72';
    g.fillRect(0, 0, width, height);
    for (let x = 0; x < width; x++) {
      const a = 2 * Math.PI * x / width;
      const roll = Math.sin(3*a) + .5*Math.sin(7*a + .7);
      const lip = 33 + 3*roll + 1.7*Math.sin(13*a);
      const widthOfFoam = Math.max(0, 3.6 + 3.4*roll + 1.6*Math.cos(9*a));
      g.fillStyle = '#60a49a';
      g.fillRect(x, lip-9, 1, 16 + 3*Math.sin(4*a));
      g.fillStyle = '#8bbcb0';
      g.fillRect(x, lip-3, 1, 6 + widthOfFoam);
      g.fillStyle = '#d5dfc8';
      g.fillRect(x, lip, 1, widthOfFoam);
      if (Math.sin(15*a + roll) > .3) g.fillRect(x, lip+8+3*Math.cos(8*a), 1, 1.5);
    }
  });
  const spans=Math.ceil(waveW/.29);
  for(let i=0;i<spans;i++){
    const x=waveW*(i/spans-.5),end=waveW*((i+1)/spans-.5);
    for(let k=0;k<profile.length;k++){
      const next=(k+1)%profile.length;
      const v = 1-k/profile.length, nextV = 1-(k+1)/profile.length;
      const uv = [[x/3.8,v],[x/3.8,nextV],[end/3.8,nextV],[end/3.8,v]];
      crestBatch.quad(crestPoint(x,k),crestPoint(x,next),crestPoint(end,next),crestPoint(end,k),WHITE,uv);
    }
  }
  const caps=THREE.ShapeUtils.triangulateShape(profile.map(([z,y])=>new THREE.Vector2(z,y)),[]);
  for(const side of [-1,1])for(const face of caps){
    const pts=face.map(k=>crestPoint(side*waveW/2,k));
    if(side>0)pts.reverse();
    crestBatch.tri(...pts,WHITE);
  }
  const crestMesh = c.dynamic(crestBatch, { pivot: [0, 0, bz0], wet: .75, map: rollerSkin });
  crestMesh.name='surge-crest';
  crestMesh.visible = false;
  c.rt.wavePool = { get crestZ() { return crestMesh.visible ? crestMesh.position.z : null; } };
  const cobTile = c.mapped('wp:pier:cobalt', poolTileTex(kit, 'cobalt'));
  const klaxonMesh=waveCaissons(c,cobTile,bx0,bx1,bz0,-maxDepth);

  let klaxonPlayed = false;
  let surgeHitCooldown = 0;

  createBasin(c, {
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
    'DIVE UNDER [C] OR USE PIER',
    'NO FILING IN BREAKERS',
  ], { w: 2.1, h: 0.92, seed: 29, warn: true, mess: 0.22 });

  finishPoolRoom(c,'wave-pool');
}
