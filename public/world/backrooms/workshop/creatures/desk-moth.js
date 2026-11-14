// The Backrooms — Friendly Entity: Paper-Wing Desk Moth (inspired by Entity 4, Male Deathmoths).
// Cat-sized fuzzy moth with folded manila-envelope wings ("CONFIDENTIAL"), wire-staple legs, and
// warm amber eyes. Startles if rushed; offer Almond Water (`E`) and it chirps, drinks, and flies
// across the room to perch above the doorway leading shortest toward the real EXIT.
import * as THREE from 'three';
import { Vox, M, glow, tone } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';
import { clamp, turnTo } from '../../bits.js';
import { getWorkshop } from '../state.js';

function mothBodyVox() {
  const v = new Vox();
  const fur = M('#4c3d30', 3), ruff = M('#ebe0c8', 3), dark = M('#26201b', 2);
  const ant = M('#c89246', 2), leg = M('#8d949c', 0), eye = glow('#ffca58');

  // Plump segmented abdomen (-z) and fuzzy cream collar/thorax (+z)
  v.ellipsoid(0, 5, -4, 3.4, 3.0, 5.2, (x, y, z) => ((z & 1) ? fur : tone(fur, -0.14)));
  v.ellipsoid(0, 6, 2, 3.8, 3.5, 3.6, ruff);
  v.ellipsoid(0, 6, 5, 2.6, 2.4, 2.2, fur);

  // Warm glowing compound eyes
  for (const sx of [-1, 1]) {
    v.box(sx > 0 ? 2 : -3, 6, 6, sx > 0 ? 3 : -2, 8, 8, eye);
    // Feathery antennae curving forward and up
    v.tube(sx * 1.5, 8, 6, sx * 4.5, 12, 9, 0.65, ant);
    v.tube(sx * 4.5, 12, 9, sx * 6.5, 13, 10, 0.55, ant);
    // Six staple-wire legs
    for (const lz of [-2, 1, 4]) v.tube(sx * 2.5, 4, lz, sx * 5.2, 0, lz + 0.5, 0.55, leg);
  }
  v.box(-1, 5, 7, 1, 6, 8, dark);
  return v;
}

/** Right manila-envelope wing, hinged along x = 0 so positive/negative roll flaps it cleanly. */
function mothWingVox() {
  const v = new Vox();
  const manila = M('#dcc084', 2), crease = M('#ab8b52', 2), edge = M('#c4a56a', 2);
  const red = M('#b54238', 0), clasp = M('#8a6f2c', 0);

  for (let x = 0; x < 14; x++) {
    const zMin = -9 + Math.floor(x * 0.35), zMax = 6 - Math.floor(x * 0.45);
    const lift = Math.floor(x * 0.12);
    for (let z = zMin; z <= zMax; z++) {
      const border = x === 13 || z === zMin || z === zMax;
      const diag = Math.abs((z + 2) - x * 0.35) < 0.7 || Math.abs((z - 2) + x * 0.4) < 0.7;
      v.set(x, lift, z, border ? edge : diag ? crease : manila);
    }
  }
  // Interoffice red clasp button + tiny "CONFIDENTIAL" stamp bar
  v.set(5, 1, 0, clasp);
  v.set(5, 1, -3, clasp);
  for (let z = -3; z <= 0; z++) v.set(5, 1, z, z === 0 || z === -3 ? clasp : red);
  for (let x = 7; x <= 11; x++) v.set(x, 1, -2, red);
  return v;
}

/**
 * Spawn a friendly Paper-Wing Desk Moth in room `c`.
 * @param c  room builder context
 * @param {{ perches: Array<{x:number,y:number,z:number,rot?:number}>, guideDoor?: object, almondSpot?: {x:number,z:number,isTaken?:()=>boolean} }} spec
 */
export function spawnDeskMoth(c, spec) {
  const { kit, rt } = c;
  const ws = getWorkshop(c.env);
  const S = 0.025 * 0.72;
  const mat = kit.surface({ vox: true, room: rt.u });
  const matGlow = kit.surface({ vox: true });
  const lights = [lamp(0.2, 2.2, 0.8, [1.25, 1.2, 1.1], { k: 9, wrap: 0.5, far: 24 })], amb = [0.55, 0.53, 0.5];
  const m4 = new THREE.Matrix4().makeScale(S, S, S);

  const root = new THREE.Group();
  const bodyB = new Batch(true);
  bodyB.addVox(kit.model('workshop:moth-body', mothBodyVox).solid, m4);
  root.add(new THREE.Mesh(kit.geometry(bodyB, lights, amb), mat));

  // Separate tiny un-dimmed eye overlay so its warm amber eyes softly gleam even in dim corners
  const eyeVox = () => {
    const v = new Vox(), eye = glow('#ffca58');
    for (const sx of [-1, 1]) v.box(sx > 0 ? 2 : -3, 6, 6, sx > 0 ? 3 : -2, 8, 8, eye);
    return v;
  };
  const eyeB = new Batch(true);
  eyeB.addVox(kit.model('workshop:moth-eyes', eyeVox).solid, m4);
  root.add(new THREE.Mesh(kit.geometry(eyeB, lights, amb), matGlow));

  const wingGeo = (() => {
    const b = new Batch(true);
    b.addVox(kit.model('workshop:moth-wing', mothWingVox).solid, m4);
    return kit.geometry(b, lights, amb);
  })();
  const wingR = new THREE.Group(), wingL = new THREE.Group();
  wingR.position.set(1.8 * S, 7.2 * S, 1 * S);
  wingL.position.set(-1.8 * S, 7.2 * S, 1 * S);
  const meshR = new THREE.Mesh(wingGeo, mat);
  const meshL = new THREE.Mesh(wingGeo, mat);
  meshL.scale.x = -1; // note: negative scale flips winding; use DoubleSide wing material
  const matWing = kit.surface({ vox: true, room: rt.u, side: THREE.DoubleSide });
  meshR.material = matWing;
  meshL.material = matWing;
  wingR.add(meshR);
  wingL.add(meshL);
  root.add(wingR, wingL);
  c.add(root);

  const perches = spec.perches.length ? spec.perches : [{ x: 0, y: 1.85, z: 0, rot: 0 }];
  let perchIdx = 0;
  let cur = { ...perches[0] };
  let from = { ...cur }, target = { ...cur };
  let state = 'roosting'; // 'roosting' | 'flying' | 'guiding'
  let flight = 0, flightDur = 1.2, cooldown = 0, nextAction = 'roosting', chirpWait = 0;

  // Determine the doorway that leads shortest toward the true EXIT
  const bestDoor = spec.guideDoor || (() => {
    const doors = c.room.doors.slice();
    if (!doors.length) return null;
    doors.sort((a, b) => (c.level.rooms[a.to]?.toExit ?? 99) - (c.level.rooms[b.to]?.toExit ?? 99));
    return doors[0];
  })();
  const guidePerch = bestDoor ? (() => {
    const p = c.wallAt(bestDoor.side, bestDoor.c, 0.22);
    return { x: p.x, y: Math.min(c.H - 0.32, (bestDoor.sill || 0) + (bestDoor.h || 2.05) + 0.14), z: p.z, rot: p.rot };
  })() : perches[0];

  // Small offered droplet/cap left behind when fed Almond Water
  const giftB = new Batch();
  giftB.ball(0, 0.02, 0, 0.035, [0.94, 0.91, 0.82], 0.6, 6);
  const gift = c.dynamic(giftB);
  gift.visible = false;

  const tintAt = (x, y, z) => {
    const L = c.sample(x, y, z);
    mat.uniforms.uTint.value.set(L[0], L[1], L[2]);
    matWing.uniforms.uTint.value.set(L[0], L[1], L[2]);
  };

  function flyTo(dest, afterState = 'roosting', dur = 1.25) {
    from = { x: cur.x, y: cur.y, z: cur.z, rot: cur.rot ?? 0 };
    target = { x: dest.x, y: dest.y, z: dest.z, rot: dest.rot ?? Math.atan2(-dest.x, -dest.z) };
    flight = 0;
    flightDur = dur;
    state = 'flying';
    nextAction = afterState;
    const w = c.toWorld(cur.x, cur.z);
    c.env.play('rustle', w.x, w.z, 5);
  }

  const syncUse = () => {
    const w = c.toWorld(cur.x, cur.z);
    use.x = cur.x; use.z = cur.z; use.wx = w.x; use.wz = w.z;
  };

  const use = c.use({
    x: cur.x,
    z: cur.z,
    r: 2.0,
    cone: 0.35,
    label: 'offer almond water',
    when: () => state === 'roosting',
    use: () => {
      const w = c.toWorld(cur.x, cur.z);
      if (ws.almond && ws.spendAlmond(c, cur.x, cur.z, 'glug')) {
        c.env.play('squeak', w.x, w.z, 6);
        gift.position.set(cur.x, Math.max(0.02, cur.y - 0.08), cur.z);
        gift.visible = true;
        flyTo(guidePerch, 'guiding', 1.55);
      } else {
        // Friendly inquisitive chirp; if there is Almond Water in the room, briefly flutter toward it to hint!
        c.env.play('squeak', w.x, w.z, 5);
        if (spec.almondSpot && !spec.almondSpot.isTaken?.()) {
          const hint = {
            x: spec.almondSpot.x,
            y: (spec.almondSpot.y ?? 0.55) + 0.55,
            z: spec.almondSpot.z,
            rot: Math.atan2(cur.x - spec.almondSpot.x, cur.z - spec.almondSpot.z),
          };
          flyTo(hint, 'roosting', 1.1);
          cooldown = 3.0;
        }
      }
    },
  });

  root.position.set(cur.x, cur.y, cur.z);
  root.rotation.y = cur.rot ?? 0;
  c.after.push(() => tintAt(cur.x, cur.y, cur.z));

  c.tick((dt, t, me) => {
    if (me.world.frozen) return;
    if (cooldown > 0) cooldown -= dt;
    if (chirpWait > 0) chirpWait -= dt;

    if (state === 'roosting') {
      // Gentle wing breathing; startles to another sconce if player sprints right at it
      const d = Math.hypot(me.x - cur.x, me.z - cur.z);
      if (me.inside && d < 2.15 && me.speed > 2.75 && perches.length > 1 && cooldown <= 0) {
        perchIdx = (perchIdx + 1) % perches.length;
        cooldown = 2.2;
        flyTo(perches[perchIdx], 'roosting', 1.1);
        return;
      }
      const lookWant = me.inside && d < 3.6 ? Math.atan2(me.x - cur.x, me.z - cur.z) : (cur.rot ?? 0);
      cur.rot = (cur.rot ?? 0) + turnTo(cur.rot ?? 0, lookWant) * Math.min(1, dt * 3.5);
      root.position.set(cur.x, cur.y + Math.sin(t * 2.1) * 0.012, cur.z);
      root.rotation.set(0.18, cur.rot, 0);
      const flap = 0.28 + Math.sin(t * 2.6) * 0.16;
      wingR.rotation.z = flap;
      wingL.rotation.z = -flap;
    } else if (state === 'flying') {
      flight = Math.min(1, flight + dt / flightDur);
      const e = flight * flight * (3 - 2 * flight);
      cur.x = from.x + (target.x - from.x) * e;
      cur.z = from.z + (target.z - from.z) * e;
      cur.y = from.y + (target.y - from.y) * e + Math.sin(flight * Math.PI) * 0.48;
      const heading = Math.atan2(target.x - from.x, target.z - from.z);
      cur.rot = flight < 0.85 ? heading : target.rot;
      root.position.set(cur.x, cur.y, cur.z);
      root.rotation.set(-0.15 * Math.sin(flight * Math.PI), cur.rot, 0);
      const flap = Math.sin(t * 38) * 0.78;
      wingR.rotation.z = flap;
      wingL.rotation.z = -flap;
      tintAt(cur.x, cur.y, cur.z);
      if (flight >= 1) {
        cur = { ...target };
        state = nextAction;
        syncUse();
        if (state === 'guiding') {
          const w = c.toWorld(cur.x, cur.z);
          c.env.play('squeak', w.x, w.z, 6);
        }
      }
    } else if (state === 'guiding') {
      // Perched over the exit-ward doorway, fanning warm wings to beckon the player through
      const d = Math.hypot(me.x - cur.x, me.z - cur.z);
      root.position.set(cur.x, cur.y + Math.sin(t * 3.4) * 0.018, cur.z);
      const face = me.inside ? Math.atan2(me.x - cur.x, me.z - cur.z) : (cur.rot ?? 0);
      cur.rot = (cur.rot ?? 0) + turnTo(cur.rot ?? 0, face) * Math.min(1, dt * 4);
      root.rotation.set(0.25, cur.rot, 0);
      const fan = 0.18 + Math.abs(Math.sin(t * 5.2)) * 0.45;
      wingR.rotation.z = fan;
      wingL.rotation.z = -fan;
      if (me.inside && d < 2.2 && chirpWait <= 0) {
        chirpWait = 5.5;
        const w = c.toWorld(cur.x, cur.z);
        c.env.play('squeak', w.x, w.z, 4);
      }
    }
  });

  return {
    root,
    get state() { return state; },
    get position() { return { ...cur }; },
  };
}
