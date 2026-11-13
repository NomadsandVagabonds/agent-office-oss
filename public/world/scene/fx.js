// The Office — things that happen and are gone: a paper plane for every
// direct message, confetti when a card reaches Done, lift doors opening for
// whoever is arriving. Each one is the visible side of a real event from the
// daemon (see fx() in server/world/world.mjs); nothing here is made up.
import * as THREE from 'three';

const CONFETTI = ['#f2d45c', '#6fb6e8', '#ee6f5e', '#c59af0', '#7fd08a', '#ffffff', '#f0b860'];
const MAX_BITS = 600;

function planeGeometry() {
  // a folded dart: two wings and a keel, nose toward +z
  const g = new THREE.BufferGeometry();
  const v = [
    0, 0, 0.16, -0.11, 0.02, -0.12, 0, 0, -0.1,          // left wing
    0, 0, 0.16, 0, 0, -0.1, 0.11, 0.02, -0.12,           // right wing
    0, 0, 0.16, 0, -0.045, -0.1, 0, 0, -0.1,             // keel
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export function createFx(office) {
  const { scene, camera } = office.stage;
  const group = new THREE.Group();
  scene.add(group);

  /* ---- paper planes ------------------------------------------------------------ */
  const planeGeo = planeGeometry();
  const planeMat = new THREE.MeshLambertMaterial({ color: '#fbf7ea', side: THREE.DoubleSide, emissive: '#3a3628' });
  const planes = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();

  function anchor(ref, out) {
    if (ref === 'lead' || !ref) {                          // the human: somewhere just this side of the glass
      camera.getWorldDirection(out).multiplyScalar(4).add(camera.position);
      out.y -= 0.8;
      return true;
    }
    const pos = office.people?.positionOf(ref);
    if (!pos) return false;
    out.set(pos.x, 1.35, pos.z);
    return true;
  }

  function plane(from, to, done) {
    if (!anchor(from, a) || !anchor(to, b)) return;
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.castShadow = true;
    group.add(mesh);
    const dist = a.distanceTo(b);
    planes.push({ mesh, from, to, t: 0, dur: THREE.MathUtils.clamp(dist / 9, 0.9, 2.6), lift: 0.8 + dist * 0.12, done, wob: Math.random() * 6 });
  }

  /* ---- confetti ------------------------------------------------------------------ */
  const bitGeo = new THREE.BoxGeometry(0.045, 0.012, 0.03);
  const bitMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const bits = new THREE.InstancedMesh(bitGeo, bitMat, MAX_BITS);
  bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bits.count = 0; bits.frustumCulled = false; bits.castShadow = false;
  group.add(bits);
  const live = [];
  const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), eul = new THREE.Euler(), scl = new THREE.Vector3(1, 1, 1), col = new THREE.Color();

  function confetti(x, z, n = 90, y = 1.5) {
    for (let i = 0; i < n && live.length < MAX_BITS; i++) {
      const ang = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.2;
      live.push({ x, y: y + Math.random() * 0.3, z, vx: Math.cos(ang) * sp, vy: 2.2 + Math.random() * 2.6, vz: Math.sin(ang) * sp,
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 14, life: 2.6 + Math.random() * 1.6,
        color: CONFETTI[(Math.random() * CONFETTI.length) | 0] });
    }
  }

  /* ---- the lift ------------------------------------------------------------------ */
  let liftUntil = 0;
  function lift(ms = 3200) {
    const door = office.world?.building.doors.get('door:elevator');
    if (!door) return;
    door.target = 1;
    liftUntil = performance.now() + ms;
  }

  function update(dt) {
    for (let i = planes.length - 1; i >= 0; i--) {
      const pl = planes[i];
      pl.t += dt / pl.dur;
      if (!anchor(pl.from, a) || !anchor(pl.to, b) || pl.t >= 1) {
        group.remove(pl.mesh); planes.splice(i, 1);
        if (pl.t >= 1) pl.done?.();
        continue;
      }
      const t = pl.t, u = 1 - t;
      c.copy(a).lerp(b, 0.5); c.y += pl.lift * 2;
      p.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
      const t2 = Math.min(1, t + 0.02), u2 = 1 - t2;
      q.set(u2 * u2 * a.x + 2 * u2 * t2 * c.x + t2 * t2 * b.x, u2 * u2 * a.y + 2 * u2 * t2 * c.y + t2 * t2 * b.y, u2 * u2 * a.z + 2 * u2 * t2 * c.z + t2 * t2 * b.z);
      pl.mesh.position.copy(p);
      pl.mesh.lookAt(q);
      pl.mesh.rotateZ(Math.sin(pl.wob + t * 9) * 0.25);
      pl.mesh.scale.setScalar(Math.min(1, t * 6, (1 - t) * 6) * 1.25);
    }

    let n = 0;
    for (let i = live.length - 1; i >= 0; i--) {
      const f = live[i];
      f.life -= dt;
      if (f.life <= 0) { live.splice(i, 1); continue; }
      f.vy -= 5.2 * dt;
      const drag = Math.exp(-1.6 * dt);
      f.vx *= drag; f.vz *= drag; if (f.vy < -1.1) f.vy = -1.1;          // paper flutters, it does not plummet
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      if (f.y < 0.02) { f.y = 0.02; f.vx = f.vz = 0; f.sx = f.sy = 0; }
      f.rx += f.sx * dt; f.ry += f.sy * dt;
    }
    for (const f of live) {
      eul.set(f.rx, f.ry, 0); quat.setFromEuler(eul);
      p.set(f.x, f.y, f.z); scl.setScalar(Math.min(1, f.life * 2));
      m4.compose(p, quat, scl);
      bits.setMatrixAt(n, m4); bits.setColorAt(n, col.set(f.color));
      n++;
    }
    bits.count = n;
    if (n) { bits.instanceMatrix.needsUpdate = true; if (bits.instanceColor) bits.instanceColor.needsUpdate = true; }

    if (liftUntil && performance.now() > liftUntil) {
      liftUntil = 0;
      const door = office.world?.building.doors.get('door:elevator');
      if (door) door.target = 0;
    }
  }

  return { group, plane, confetti, lift, update };
}
