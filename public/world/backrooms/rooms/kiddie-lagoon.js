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
import {
  poolTileTex, poolroom, natatoriumLight, createBasin, makeVoxGroup, makeInnerTube, placeVox, addTranslucent,
  mushroomVox, noodleVox, poolSign, depthTile,
  COPING,
} from '../waterpark.js';

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

  // Translucent shimmering water umbrella cascading from the mushroom cap rim (`r = 0.78 m` down to `waterY`)
  const veil = new Batch();
  const nSeg = 14, rCap = 0.78, yCap = -depth + 1.92;
  for (let i = 0; i < nSeg; i++) {
    const a0 = (i / nSeg) * Math.PI * 2, a1 = ((i + 1) / nSeg) * Math.PI * 2;
    const x0 = Math.cos(a0) * rCap, z0 = Math.sin(a0) * rCap;
    const x1 = Math.cos(a1) * rCap, z1 = Math.sin(a1) * rCap;
    veil.quad([x0, yCap, z0], [x1, yCap, z1], [x1 * 1.12, waterY, z1 * 1.12], [x0 * 1.12, waterY, z0 * 1.12], [0.78, 0.98, 1.0]);
  }
  addTranslucent(c, veil, { alpha: 0.28, side: THREE.DoubleSide, order: 3 });
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
    const g = makeInnerTube(kit, col, occupied, 0.031);
    g.position.set(hx, waterY - 0.06, hz);
    g.rotation.y = ang + 1.1;
    c.add(g);
    rings.push({ g, hx, hz, x: hx, z: hz, occupied, phase: i * 1.37, cooldown: 0 });
  }
  c.after.push(() => {
    for (const r of rings) r.g.userData.light(c.sample(r.hx, 0.35, r.hz));
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
        f.g.userData.kick?.(t, f.phase, splashingFast && dist < 1.35 ? 1 : 0);

        if (f.occupied && splashingFast && dist < 1.35 && f.cooldown <= 0) {
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
            c.hurt(1);
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
