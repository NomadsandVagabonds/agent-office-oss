// The Backrooms — a room of the corporate aquatics annex (`waterpark`):
// The Toadstool Lagoon ("the red spotted mushroom fountain and the upside-down legs in floats").
//
// A cheerful ankle-deep wading lagoon under humming fluorescent tubes, centred
// on a sculpted polka-dot mushroom fountain misting chlorinated water. Ten
// candy-coloured inner tubes bob in the shallows — half of them have dark
// office trousers and dress shoes sticking straight up into the air. Walk
// calmly past them and they only twitch; splash fast (`speed > 2.3`) right
// beside an occupied float and it lunges!

import {finishPoolRoom} from '../pool-finish.js';
import * as THREE from 'three';
import { Batch } from '../kit.js';
import { makeBather } from './kiddie-lagoon/rig.js';
import { resident } from '../resident.js';
import {
  poolTileTex, poolroom, natatoriumLight, createBasin, makeVoxGroup, makeInnerTube, placeVox, addTranslucent,
  mushroomVox, noodleVox, poolSign, depthTile,
  COPING,
} from '../waterpark.js';

// A thin, broken bell of water leaves the lip sideways before gravity takes
// over. The last strip lies flat on the pool and carries the impact ripples.
function fountainWater(c, lipY, lipRadius, waterY) {
  const batch = new Batch(), sectors = 64, bands = 7;
  function point(angle, fall) {
    const radius = lipRadius + .40*fall - .05*fall*fall;
    return [radius*Math.cos(angle), lipY+(waterY-lipY)*fall*fall, radius*Math.sin(angle)];
  }
  const water = [.62,.86,.81];
  for (let i=0;i<sectors;i++) {
    const u=i/sectors, v=(i+1)/sectors, a=u*2*Math.PI, b=v*2*Math.PI;
    for (let j=0;j<bands;j++) {
      const from=j/bands, to=(j+1)/bands;
      batch.quad(point(a,from),point(b,from),point(b,to),point(a,to),water,[[u,from],[v,from],[v,to],[u,to]]);
    }
    const impact=(angle,offset)=>[(lipRadius+.35+offset)*Math.cos(angle),waterY+.009,(lipRadius+.35+offset)*Math.sin(angle)];
    batch.quad(impact(a,-.05),impact(b,-.05),impact(b,.4),impact(a,.4),water,[[u,-1],[v,-1],[v,-2],[u,-2]]);
  }
  const clock={value:0};
  addTranslucent(c,batch,{alpha:.67,order:5,side:THREE.DoubleSide,finishMaterial(mat) {
    mat.forceSinglePass=true;
    mat.uniforms.uFountainTime=clock;
    mat.fragmentShader='uniform float uFountainTime;\n'+mat.fragmentShader.replace('gl_FragColor = vec4(c, uAlpha);',`
      float angle = vUv.x * 6.2831853;
      float flow = vUv.y*9. - uFountainTime*4.;
      float nozzle = .5+.5*cos(20.*angle + .58*sin(flow+3.*angle));
      float strands = .5+.5*cos(93.*angle + 1.7*sin(flow+11.*angle));
      float glint = pow(strands,4.) * (.5+.5*sin(2.7*flow+13.*angle));
      float coverage = (.11 + .71*pow(nozzle,2.))*(.38+.62*strands);
      if(vUv.y<0.){
        float dist = -vUv.y-1.;
        glint = pow(.5+.5*cos(dist*18. - uFountainTime*4.2 + .8*sin(angle*9.)),5.);
        coverage = glint*(1.-dist)*(.24+.51*nozzle);
      }
      gl_FragColor = vec4(c*(1.+glint*.58),uAlpha*coverage);`);
  }});
  return clock;
}

export function build(c) {
  const { W, D, R, kit } = c;
  c.shell({ panels: false, floor: false, wallTex:poolTileTex(c.kit,'white') });
  natatoriumLight(c, 3, 3, 1, 1.05);
  poolroom(c, { wrong: 0, footbath: false, signs: false });

  // Shallow ankle-deep lagoon (`depth: 0.42 m`) leaving >= 1.65 m dry perimeter around all 4 walls
  const bx0 = -W / 2 + 1.65, bx1 = W / 2 - 1.65;
  const bz0 = -D / 2 + 1.65, bz1 = D / 2 - 1.65;
  const depth = 0.42;
  const waterY = -0.05;

  // 1. Centerpiece Sculpted Polka-Dot Mushroom Fountain at (0, 0)
  c.flat.box(-0.52, -depth, -0.52, 0.52, -depth + 0.14, 0.52, COPING);
  const mush = makeVoxGroup(kit, 'wp:mushroom', mushroomVox(), 0.036);
  mush.position.set(0, -depth + 0.12, 0);
  c.add(mush);
  c.after.push(() => mush.userData.light(c.sample(0, 1.4, 0)));
  c.solid(-0.42, -0.42, 0.42, 0.42);

  const fountainClock = fountainWater(c, mush.position.y + .036*51, .036*32, waterY);
  c.light(0, 0.85, 0, '#6cf4ff', 0.65, { k: 2.6, far: 7.5 });

  // 2. Ten Candy-Coloured Inner Tubes — 5 Empty, 5 Occupied by Upside-Down Office Workers' Legs!
  const colors = ['#f2c12e', '#ff5c8a', '#29b6d8', '#6fd96c', '#ff8833'];
  const rings = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const occupied = i % 2 === 0;
    const col = colors[i % colors.length];
    const ang = (i / count) * Math.PI * 2 + 0.25;
    const rad = (i % 3 === 0 ? 1.85 : 2.85) * Math.min(1, (bx1 - 0.8) / 3.4);
    const hx = Math.cos(ang) * rad, hz = Math.sin(ang) * rad;
    // an occupied tube is a bather (its rig: kicking, a flinch, its going); an empty one is only a tube
    const b = occupied ? makeBather(kit, col, 0.031) : null;
    const g = b ? b.group : makeInnerTube(kit, col, false, 0.031);
    g.position.set(hx, waterY - 0.06, hz);
    g.rotation.y = ang + 1.1;
    c.add(g);
    const f = { g, b, hx, hz, x: hx, z: hz, occupied, phase: i * 1.37, cooldown: 0, life: null };
    // Health (resident.js; basic: one jab), reachable at the water's surface. A jab that lands takes it: what is left is
    // an empty tube like the others, in nobody's way.
    if (b) f.life = resident(c.env, 'inverted-bathers', {
      at: () => { const w = c.toWorld(f.x, f.z); return { x: w.x, z: w.z, y: (c.room.y || 0) + waterY + 0.3 }; }, r: 0.35,
      hit: () => { f.cooldown = 2.6; },
      dies: (k) => b.die(k, fountainClock.value),
      gone: () => { f.occupied = false; },
    });
    rings.push(f);
  }
  c.after.push(() => {
    for (const r of rings) (r.b ? r.b.light : r.g.userData.light)(c.sample(r.hx, 0.35, r.hz));
  });

  // Scattered pool noodles on the dry coping
  placeVox(c, 'wp:noodle:#29b6d8', noodleVox('#29b6d8'), bx1 + 0.55, 1.2, { rot: 0.4 });
  c.leave('paper', bx1 - 0.45, bz0 - 0.55, { y: 0, quantity: 3 });

  let met = false;
  let mistTimer = 1.5;

  createBasin(c, {
    x0: bx0, z0: bz0, x1: bx1, z1: bz1,
    depth,
    waterY,
    tile: 'white',
    wallTile: 'seafoam',
    waterTone: 'aqua',
    stepsSide: 'both',
    onTick: (info, dt, t, me) => {
      fountainClock.value = t;
      mistTimer -= dt;
      if (mistTimer <= 0 && me.inside) {
        mistTimer = 3.2 + R() * 1.4;
        const w = c.toWorld(0, 0);
        c.env.play?.('wade', w.x, w.z, 5);
      }

      if (!met && me.inside && c.seen(0, 0)) {
        met = true;
        c.met('inverted-bathers');
      }

      const splashingFast = me.inside && info.inBasin(me.x, me.z) && me.speed > 2.25;

      for (const f of rings) {
        f.cooldown = Math.max(0, f.cooldown - dt);
        const dist = me.inside ? Math.hypot(me.x - f.x, me.z - f.z) : 99;
        const still = f.life && (f.life.out || f.life.stalled);
        if (f.b) { if (!f.life?.out) f.b.pose(t, f.phase, splashingFast && dist < 1.35 ? 1 : 0, f.life ? f.life.hurt : Infinity); }
        else f.g.userData.kick?.(t, f.phase, 0);

        if (f.occupied && !still && splashingFast && dist < 1.35 && f.cooldown <= 0) {
          // Startled submerged office worker kicks & lunges!
          const dx = (me.x - f.x) / Math.max(0.1, dist);
          const dz = (me.z - f.z) / Math.max(0.1, dist);
          f.x += dx * 2.8 * dt;
          f.z += dz * 2.8 * dt;
          f.g.rotation.z = Math.sin(t * 26) * 0.28;
          if (dist < 0.72) {
            f.cooldown = 2.6;
            const w = c.toWorld(f.x, f.z);
            c.env.play?.('wade', w.x, w.z, 8);
            c.env.play?.('glug', w.x, w.z, 8);
            c.env.interfere?.(0.8);
            c.env.hud?.glitch?.(0.45);
            const hit = c.hurt(1);
            if (hit?.landed && !hit?.ended) f.life?.escaped();
          }
        } else {
          // Drift gently back toward home tether, legs twitching now and then
          f.x += (f.hx + Math.cos(t * 0.55 + f.phase) * 0.16 - f.x) * Math.min(1, dt * 1.8);
          f.z += (f.hz + Math.sin(t * 0.65 + f.phase) * 0.16 - f.z) * Math.min(1, dt * 1.8);
          const twitch = f.occupied && Math.sin(t * 1.9 + f.phase) > 0.92 ? Math.sin(t * 24) * 0.12 : Math.sin(t * 1.6 + f.phase) * 0.04;
          f.g.rotation.z = twitch;
        }
        f.g.position.set(f.x, waterY - 0.06 + Math.sin(t * 2.2 + f.phase) * 0.02, f.z);
      }
    },
  });

  depthTile(c, 0, 0.045, bz1 + 0.12, 'KIDDIE 0.4M', 0, 83);
  poolSign(c, 'right', 0, 1.55, [
    'JUNIOR LAGOON',
    'NO SPLASHING NEAR STAFF',
    'SHOES MUST FACE CEILING',
  ], { seed: 89, warn: true, mess: 0.22 });
  finishPoolRoom(c,'kiddie-lagoon');
}
