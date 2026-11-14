// The Backrooms — Neutral Entity: The Night Porter (inspired by Entity 9, Facelings).
// Tall featureless custodian in slate coveralls endlessly mopping the same dry patch of carpet.
// Polite and harmless if respected; sprint into its yellow mop bucket (tipping it over) and it
// stops, snaps its blank head toward you, and herds you back with raised mop. Righting the bucket
// (`E`) or offering Almond Water (`E`) earns a polite bow and unlocks its custodial supply locker.
import * as THREE from 'three';
import { Vox, M, tone } from '../../../vox/vox.js';
import { Batch, lamp } from '../../kit.js';
import { turnTo } from '../../bits.js';
import { getWorkshop } from '../state.js';

function porterBodyVox() {
  const v = new Vox();
  const suit = M('#3c556a', 2), dark = tone(suit, -0.22), boot = M('#222024', 1);
  const belt = M('#2a2420', 0), brass = M('#c9a24a', 0), tag = M('#f2ede0', 0), red = M('#b54238', 0);

  // Boots & coverall legs
  for (const x0 of [-5, 1]) {
    v.box(x0, 0, -3, x0 + 4, 3, 5, boot);
    v.box(x0, 3, -3, x0 + 4, 14, 3, dark);
  }
  // Torso coveralls + collar
  v.rbox(-7, 13, -4, 7, 29, 4, 2, suit);
  v.box(-8, 14, -5, 8, 17, 5, belt);
  v.box(-2, 14, 4, 2, 17, 5, brass);
  // Keyring hanging at hip
  v.box(7, 11, 0, 8, 15, 2, brass);
  // "HELLO MY NAME IS: ____" blank badge on left chest
  v.box(2, 23, 3, 6, 26, 5, tag);
  v.box(2, 25, 3, 6, 26, 5, red);
  return v;
}

function porterHeadVox() {
  const v = new Vox();
  const skin = M('#dfd2be', 1), hair = M('#38312b', 2);
  // Completely smooth, featureless face — ears and parted hair, zero eyes/mouth
  v.ellipsoid(0, 7, 0, 5.6, 6.8, 5.6, skin);
  for (const sx of [-1, 1]) v.box(sx > 0 ? 5 : -6, 5, -1, sx > 0 ? 6 : -5, 8, 1, tone(skin, -0.08));
  v.remap((x, y, z, c) => (y >= 11 || (y >= 7 && z < -2) ? hair : c));
  return v;
}

function porterArmVox() {
  const v = new Vox();
  const suit = M('#3c556a', 2), skin = M('#dfd2be', 1);
  v.rbox(-2, -12, -2, 2, 2, 2, 1, suit);
  v.rbox(-2, -16, -2, 2, -12, 2, 1, skin);
  return v;
}

function mopVox() {
  const v = new Vox();
  const wood = M('#9c7444', 2), clampM = M('#7c848c', 0), yarn = M('#d8d2c0', 3), damp = M('#b5ae9a', 3);
  v.cyl('y', 0.5, 0.5, 4, 44, 0.85, wood);
  v.box(-3, 3, -1, 4, 5, 2, clampM);
  for (let x = -5; x <= 5; x++) {
    for (let z = -3; z <= 3; z++) {
      if ((x * x) / 30 + (z * z) / 12 <= 1) {
        v.box(x, 0, z, x + 1, 4, z + 1, (x + z) & 1 ? yarn : damp);
      }
    }
  }
  return v;
}

export function mopBucketVox() {
  const v = new Vox();
  const yel = M('#e6b828', 0), dark = tone(yel, -0.22), wheel = M('#232328', 0), steel = M('#8d949c', 0), water = M('#5f7d8c', 0);
  for (const sx of [-5, 4]) for (const sz of [-5, 4]) v.box(sx, 0, sz, sx + 2, 2, sz + 2, wheel);
  v.rbox(-6, 2, -6, 6, 13, 6, 2, yel, 'xz');
  v.carve(-5, 5, -5, 5, 13, 5);
  v.box(-5, 5, -5, 5, 8, 5, water);
  // Wringer hopper on back half
  v.box(-5, 11, -6, 5, 17, 0, dark);
  v.carve(-4, 12, -5, 4, 17, -1);
  // Lever handle
  v.tube(5, 14, -3, 7, 21, -1, 0.7, steel);
  return v;
}

/**
 * Spawn the neutral Night Porter Faceling + tippable Mop Bucket in room `c`.
 * @param c     room builder context
 * @param {{ home:{x:number,z:number,rot?:number}, bucket:{x:number,z:number}, onReward?:()=>void }} spec
 */
export function spawnNightPorter(c, spec) {
  const { kit, rt, world } = c;
  const ws = getWorkshop(c.env);
  const S = 0.025 * 1.15;
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0.2, 2.5, 0.9, [1.25, 1.25, 1.25], { k: 9, wrap: 0.45, far: 26 })], amb = [0.55, 0.55, 0.55];
  const mat = kit.surface({ vox: true, room: rt.u });

  const part = (key, make) => {
    const b = new Batch(true);
    b.addVox(kit.model('workshop:' + key, make).solid, m4);
    return new THREE.Mesh(kit.geometry(b, lights, amb), mat);
  };

  const figure = new THREE.Group();
  figure.add(part('porter-body', porterBodyVox));
  const head = new THREE.Group();
  head.position.set(0, 29 * S, 0);
  head.add(part('porter-head', porterHeadVox));
  figure.add(head);

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-8 * S, 27 * S, 0);
  armR.position.set(8 * S, 27 * S, 0);
  armL.add(part('porter-arm', porterArmVox));
  armR.add(part('porter-arm', porterArmVox));
  figure.add(armL, armR);

  const mop = new THREE.Group();
  mop.position.set(0, 0, 0.34);
  mop.add(part('porter-mop', mopVox));
  figure.add(mop);

  const shadow = new THREE.Mesh(
    kit.own(new THREE.PlaneGeometry(0.95, 0.95)),
    kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.renderOrder = 1;
  figure.add(shadow);
  c.add(figure);

  // Tippable yellow mop bucket
  const bx = spec.bucket.x, bz = spec.bucket.z;
  const bucketB = new Batch(true);
  const bm = new THREE.Matrix4().compose(new THREE.Vector3(bx, 0, bz), new THREE.Quaternion(), new THREE.Vector3(0.025, 0.025, 0.025));
  bucketB.addVox(kit.model('workshop:mop-bucket', mopBucketVox).solid, bm);
  const bucketNode = c.dynamic(bucketB, { pivot: [bx, 0.14, bz] });

  // Spill puddle mesh that appears only if bucket is knocked over
  const spillGeo = kit.own(new THREE.PlaneGeometry(1.15, 0.9));
  const spillMat = kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x1a262e, transparent: true, opacity: 0, depthWrite: false }));
  const spill = c.add(new THREE.Mesh(spillGeo, spillMat));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(bx + 0.35, 0.01, bz);
  spill.renderOrder = 1;

  let x = spec.home.x, z = spec.home.z, rot = spec.home.rot ?? 0;
  let state = 'mopping'; // 'mopping' | 'annoyed' | 'grateful'
  let tipped = false, rewarded = false, sweepTimer = 0, nod = 0, tipAnim = 0;

  const updateLight = () => {
    const L = c.sample(x, 1.1, z);
    mat.uniforms.uTint.value.set(L[0], L[1], L[2]);
  };

  function reward() {
    state = 'grateful';
    nod = 1.4;
    if (!rewarded) {
      rewarded = true;
      spec.onReward?.();
    }
  }

  // Right the tipped bucket (`E`)
  c.use({
    x: bx,
    z: bz,
    r: 1.55,
    cone: 0.35,
    label: 'right the mop bucket',
    when: () => tipped,
    use: () => {
      tipped = false;
      const w = c.toWorld(bx, bz);
      c.env.play('clack', w.x, w.z, 5);
      reward();
    },
  });

  // Offer Almond Water directly to the Night Porter (`E`)
  const porterUse = c.use({
    x,
    z,
    r: 1.75,
    cone: 0.4,
    label: 'offer almond water',
    when: () => ws.almond && !rewarded,
    use: () => {
      if (ws.spendAlmond(c, x, z, 'glug')) {
        tipped = false;
        const w = c.toWorld(x, z);
        c.env.play('ding', w.x, w.z, 5);
        reward();
      }
    },
  });

  const syncUse = () => {
    const w = c.toWorld(x, z);
    porterUse.x = x; porterUse.z = z; porterUse.wx = w.x; porterUse.wz = w.z;
  };

  figure.position.set(x, 0, z);
  figure.rotation.y = rot;
  c.after.push(updateLight);

  c.tick((dt, t, me) => {
    if (me.world.frozen) return;

    // Sprinting into the upright bucket tips it over!
    if (me.inside && !tipped && me.speed > 2.85 && Math.hypot(me.x - bx, me.z - bz) < 0.62) {
      tipped = true;
      state = 'annoyed';
      const w = c.toWorld(bx, bz);
      c.env.play('thunk', w.x, w.z, 6);
      c.env.play('wade', w.x, w.z, 6);
    }

    const wantTip = tipped ? 1 : 0;
    if (tipAnim !== wantTip) {
      tipAnim += (wantTip - tipAnim) * Math.min(1, dt * 10);
      bucketNode.rotation.z = -1.42 * tipAnim;
      spillMat.opacity = 0.48 * tipAnim;
    }

    const d = Math.hypot(me.x - x, me.z - z);

    if (state === 'annoyed') {
      // Sternly marches toward the rude runner with raised mop, shooing them back (never lethal!)
      const face = Math.atan2(me.x - x, me.z - z);
      rot += turnTo(rot, face) * Math.min(1, dt * 7);
      if (me.inside && d > 0.92) {
        const step = Math.min(1.75 * dt, d - 0.9);
        const nx = x + Math.sin(face) * step, nz = z + Math.cos(face) * step;
        // Keep clear of doorways so the player can always leave or reach the bucket
        const nearDoor = c.room.doors.some((dr) => {
          const dp = c.doorPoint(dr, 0.5);
          return Math.hypot(nx - dp.x, nz - dp.z) < 1.35;
        });
        const w = c.toWorld(nx, nz);
        if (!nearDoor && Math.abs(nx) < c.W / 2 - 0.5 && Math.abs(nz) < c.D / 2 - 0.5 && world.free(w.x, w.z, 0.28)) {
          x = nx; z = nz;
          syncUse();
        }
      }
      if (me.inside && d < 1.25) {
        me.world.slow = Math.min(me.world.slow, 0.58);
        c.env.interfere(0.18);
      }
      armL.rotation.set(-0.9, 0, 0.15);
      armR.rotation.set(-1.25, 0, -0.15);
      mop.position.set(0.16, 0.28 + Math.abs(Math.sin(t * 7)) * 0.06, 0.28);
      mop.rotation.set(-0.15, 0, 0);
      head.rotation.set(0, 0, Math.sin(t * 5) * 0.08);
    } else {
      // Return calmly to custodial post and mop in a gentle arc
      const hd = Math.hypot(spec.home.x - x, spec.home.z - z);
      if (hd > 0.05) {
        const dir = Math.atan2(spec.home.x - x, spec.home.z - z);
        const step = Math.min(1.1 * dt, hd);
        x += Math.sin(dir) * step;
        z += Math.cos(dir) * step;
        rot += turnTo(rot, dir) * Math.min(1, dt * 5);
        syncUse();
      } else {
        const polite = me.inside && d < 2.35;
        const targetYaw = polite ? Math.atan2(me.x - x, me.z - z) : (spec.home.rot ?? 0) + Math.sin(t * 0.7) * 0.25;
        rot += turnTo(rot, targetYaw) * Math.min(1, dt * 4);
        if (polite && nod <= 0 && state === 'mopping') nod = 0.7;
      }

      if (nod > 0) nod = Math.max(0, nod - dt);
      const bow = state === 'grateful' && nod > 0 ? Math.sin((nod / 1.4) * Math.PI) * 0.45
        : nod > 0 ? Math.sin((nod / 0.7) * Math.PI) * 0.24 : 0;
      head.rotation.set(bow, 0, 0);

      const sweep = nod > 0.1 ? 0 : Math.sin(t * 2.2);
      armL.rotation.set(-0.65, 0, sweep * 0.18);
      armR.rotation.set(-0.72, 0, sweep * 0.18);
      mop.position.set(sweep * 0.24, 0, 0.38 + Math.cos(t * 2.2) * 0.05);
      mop.rotation.set(0.18, 0, -sweep * 0.22);

      sweepTimer -= dt;
      if (sweepTimer <= 0 && me.inside && nod <= 0.1) {
        sweepTimer = 2.1 + Math.random() * 0.6;
        const w = c.toWorld(x, z);
        c.env.play('shuffle', w.x, w.z, 4.5);
      }
      if (state === 'grateful' && nod <= 0) state = 'mopping';
    }

    figure.position.set(x, 0, z);
    figure.rotation.y = rot;
    updateLight();
  });

  return {
    figure,
    bucketNode,
    get state() { return state; },
    get tipped() { return tipped; },
    get rewarded() { return rewarded; },
  };
}
