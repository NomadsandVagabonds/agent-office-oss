// The Backrooms — Hostile Entity: The Smiler (inspired by Entity 3, Smilers).
// Inverse of Capt. Legacy: in the dark, only two pinprick phosphor eyes and a wide jagged grin
// float in the void; your camcorder torch reveals a hunched tangle of black phone cords and a
// crooked tie. Shining your camcorder LIGHT directly at it while standing agitates it into lunging!
// Counterplay: look away / crouch (`C`), vent a steam pipe (`E`), flick the utility breaker (`E`),
// or carry Almond Water (shatters on contact to blind it and save your life once).
import * as THREE from 'three';
import { Vox, M, glow } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';
import { clamp, turnTo } from '../../bits.js';
import { getWorkshop } from '../state.js';

/** Glowing eyes + Cheshire toothy grin in its own un-dimmed voxel mesh so it blazes in pitch black. */
function smilerFaceVox() {
  const v = new Vox();
  const hi = glow('#f6fae8'), dim = glow('#cfd8b8');

  // Wide manic crescent eyes
  for (const sx of [-1, 1]) {
    const cx = sx * 4.5;
    v.box(cx - 1.5, 22, 6, cx + 1.5, 24, 7, hi);
    v.set(Math.round(cx - sx * 2), 21, 6, dim);
    v.set(Math.round(cx + sx * 2), 21, 6, dim);
  }

  // Wide upturned jagged grin from x = -8 to +8
  for (let x = -8; x <= 8; x++) {
    const lift = Math.round((x * x) / 13);
    const y0 = 12 + lift;
    // Upper and lower tooth tips with gaps so individual sharp teeth read clearly
    v.set(x, y0 + 2, 6, hi);
    v.set(x, y0 - 1, 6, hi);
    if (Math.abs(x) % 2 === 0) {
      v.set(x, y0 + 1, 6, hi);
      v.set(x, y0, 6, dim);
    }
  }
  return v;
}

/** Matte-black coiled telephone-cord silhouette + crooked tie: invisible in pitch black until lit by torch/worklamps. */
function smilerBodyVox() {
  const v = new Vox();
  const cord = M('#09090c', 3), coat = M('#121318', 2), tie = M('#6e1d1d', 2), collar = M('#bab4a2', 1);

  // Hunched shadowy head & torso mass
  v.ellipsoid(0, 18, 1, 9.5, 9.2, 5.8, cord);
  v.rbox(-8, 4, -3, 8, 15, 4, 2, coat);
  // Crooked collar + red office tie hanging out of the tangle
  v.box(-3, 12, 4, 3, 14, 5, collar);
  v.tube(0, 12, 5, 2, 4, 5, 1.1, tie);

  // Trailing coiled phone-cord tendrils hanging below
  for (const [x0, z0, x1, y1, z1] of [
    [-7, 1, -9, -6, 2], [-4, -1, -5, -9, -1], [0, -2, -1, -10, -2],
    [4, 0, 6, -8, 1], [7, 1, 9, -5, 2], [-2, 2, -3, -7, 3],
  ]) {
    v.tube(x0, 5, z0, x1, y1, z1, 1.15, cord);
  }
  return v;
}

/**
 * Spawn a hostile Smiler in room `c`.
 * @param c     room builder context
 * @param {{ home:{x:number,z:number,rot?:number}, ceilingY?:number, isLit?:()=>boolean, isSteamed?:(x:number,z:number)=>boolean }} spec
 */
export function spawnSmiler(c, spec) {
  const { kit, rt, world } = c;
  const ws = getWorkshop(c.env);
  const S = 0.025 * 1.15;
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0, 2.2, 1.2, [1.2, 1.2, 1.25], { k: 8, wrap: 0.45, far: 22 })], amb = [0.45, 0.45, 0.48];

  const matBody = kit.surface({ vox: true, room: rt.u });
  const matFace = kit.surface({ vox: true });

  const group = new THREE.Group();
  const bodyB = new Batch(true);
  bodyB.addVox(kit.model('workshop:smiler-body', smilerBodyVox).solid, m4);
  group.add(new THREE.Mesh(kit.geometry(bodyB, lights, amb), matBody));

  const faceB = new Batch(true);
  faceB.addVox(kit.model('workshop:smiler-face', smilerFaceVox).solid, m4);
  const faceMesh = new THREE.Mesh(kit.geometry(faceB, lights, amb), matFace);
  group.add(faceMesh);
  c.add(group);

  const home = { x: spec.home.x, z: spec.home.z, rot: spec.home.rot ?? 0 };
  const baseY = 0.96, ceilY = (spec.ceilingY ?? c.H) + 0.35;
  let x = home.x, z = home.z, y = baseY, rot = home.rot;
  let state = 'watching'; // 'watching' | 'lunging' | 'retreating' | 'banished'
  let anger = 0, banishTimer = 0, hissCooldown = 0;

  const updateLight = () => {
    const L = c.sample(x, 1.1, z);
    const dim = rt.u.dim.value;
    matBody.uniforms.uTint.value.set(L[0] * dim, L[1] * dim, L[2] * dim);
  };

  function stepToward(tx, tz, dist) {
    const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    if (d < 0.03) return 0;
    const step = Math.min(dist, d, 0.1);
    for (const turn of [0, 0.55, -0.55, 1.1, -1.1]) {
      const cs = Math.cos(turn), sn = Math.sin(turn);
      const nx = x + ((dx * cs - dz * sn) / d) * step;
      const nz = z + ((dx * sn + dz * cs) / d) * step;
      if (Math.abs(nx) > c.W / 2 - 0.35 || Math.abs(nz) > c.D / 2 - 0.55) continue;
      const w = c.toWorld(nx, nz);
      if (world.free(w.x, w.z, 0.24)) {
        x = nx; z = nz;
        return step;
      }
    }
    return 0;
  }

  function banish(seconds = 5.5) {
    if (state === 'banished') { banishTimer = Math.max(banishTimer, seconds); return; }
    state = 'banished';
    anger = 0;
    banishTimer = seconds;
    const w = c.toWorld(x, z);
    c.env.play('rattle', w.x, w.z, 7);
    c.env.play('seek', w.x, w.z, 7);
  }

  group.position.set(x, y, z);
  group.rotation.y = rot;
  c.after.push(updateLight);

  c.tick((dt, t, me) => {
    if (me.world.frozen) return;
    if (hissCooldown > 0) hissCooldown -= dt;

    const fullLit = !!spec.isLit?.();
    const steamed = !!spec.isSteamed?.(x, z);
    if ((fullLit || steamed) && state !== 'banished') banish(fullLit ? 3.5 : 6.0);

    if (state === 'banished') {
      y += (ceilY - y) * Math.min(1, dt * 7.5);
      group.position.set(x, y, z);
      group.visible = y < ceilY - 0.08;
      if (!fullLit && !steamed) banishTimer -= dt;
      if (banishTimer <= 0 && !fullLit && !steamed) {
        // Slips quietly back down from the ceiling void in its home shadow bay when nobody is staring right at the hole
        x = home.x; z = home.z;
        group.visible = true;
        state = 'watching';
      }
      return;
    }

    group.visible = true;
    y += (baseY + Math.sin(t * 2.1) * 0.045 - y) * Math.min(1, dt * 6);

    const d = Math.hypot(me.x - x, me.z - z);
    const wantRot = me.inside ? Math.atan2(me.x - x, me.z - z) : home.rot;
    rot += turnTo(rot, wantRot) * Math.min(1, dt * 6);

    const torchOn = kit.shared.uTorch.value > 0.45 && !fullLit;
    const crouched = me.world.sink > 0.24;
    const staredAt = me.inside && c.seen(x, z, { margin: -0.04, far: 9.5 });

    if (state === 'watching') {
      // Drifts back to home bay when idle
      if (Math.hypot(home.x - x, home.z - z) > 0.08) stepToward(home.x, home.z, 1.15 * dt);

      if (me.inside && ((staredAt && torchOn && !crouched) || d < 1.35)) {
        anger = clamp(anger + dt * (d < 1.35 ? 1.8 : 0.92), 0, 1);
        c.env.interfere(0.18 + 0.35 * anger);
        if (hissCooldown <= 0 && anger > 0.28) {
          hissCooldown = 0.9;
          const w = c.toWorld(x, z);
          c.env.play('seek', w.x, w.z, 7);
        }
        if (anger >= 1) {
          state = 'lunging';
          const w = c.toWorld(x, z);
          c.env.play('static', w.x, w.z, 8);
        }
      } else {
        anger = Math.max(0, anger - dt * 0.75);
      }
    } else if (state === 'lunging') {
      c.env.interfere(clamp(0.75 - d * 0.08, 0.25, 0.8));
      if (!me.inside || (!staredAt && crouched && d > 2.6)) {
        state = 'retreating';
        anger = 0.3;
      } else {
        const moved = stepToward(me.x, me.z, 3.35 * dt);
        if (!moved && d > 1.2) state = 'retreating';
        const nowD = Math.hypot(me.x - x, me.z - z);
        if (me.inside && !me.world.frozen && nowD < 0.58) {
          // Almond Water one-hit sanity/splash shield!
          if (ws.almond && ws.spendAlmond(c, x, z, 'glug')) {
            c.env.interfere(1);
            c.env.hud?.glitch?.(0.9);
            banish(6.5);
            return;
          }
          c.env.end('caught');
          return;
        }
      }
    } else if (state === 'retreating') {
      anger = Math.max(0, anger - dt * 0.9);
      stepToward(home.x, home.z, 2.2 * dt);
      if (Math.hypot(home.x - x, home.z - z) < 0.2) state = 'watching';
    }

    const jitter = anger > 0.15 ? (Math.random() - 0.5) * 0.05 * anger : 0;
    const pulse = 0.92 + 0.45 * anger + Math.sin(t * 9) * 0.06 * anger;
    matFace.uniforms.uTint.value.set(pulse, pulse * (1 - 0.15 * anger), pulse * (1 - 0.28 * anger));
    group.position.set(x + jitter, y, z + jitter);
    group.rotation.set(state === 'lunging' ? 0.16 : 0, rot, Math.sin(t * 1.7) * 0.06 + jitter * 2);
    updateLight();
  });

  return {
    group,
    banish,
    get state() { return state; },
    get anger() { return anger; },
    get position() { return { x, y, z }; },
  };
}
