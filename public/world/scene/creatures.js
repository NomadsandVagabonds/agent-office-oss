// The Office — Kernel, the office cat. The daemon decides where Kernel goes
// (the warm server racks, the cushion in the plaza, whoever is typing); the
// client walks them there, curls them up, and twitches an ear.
import * as THREE from 'three';
import { Vox, M, glow, tone } from '../vox/vox.js';
import { voxObject } from '../vox/material.js';
import { VOXEL } from '../vox/vox.js';

const FUR = '#2b2b33', WHITE = '#f3efe6', PINK = '#e8a0a8';

function part(build, key) { return voxObject(build, { key: 'cat:' + key }); }

function body() {
  const v = new Vox();
  const fur = M(FUR, 3);
  v.rbox(-4, 0, -7, 4, 6, 6, 3, fur);
  v.paint(-2, 0, 2, 2, 3, 6, M(WHITE, 3));                    // white bib
  return v;
}
function head() {
  const v = new Vox();
  const fur = M(FUR, 3), white = M(WHITE, 3);
  v.rbox(-4, 0, -3, 4, 7, 4, 3, fur);
  for (const s of [-1, 1]) {                                   // ears
    v.box(s > 0 ? 2 : -4, 6, -1, s > 0 ? 4 : -2, 8, 1, fur);
    v.set(s > 0 ? 3 : -4, 8, 0, fur); v.set(s > 0 ? 2 : -3, 6, 1, M(PINK, 0));
  }
  v.paint(-2, 0, 3, 2, 3, 4, white);                           // muzzle
  v.set(-3, 3, 3, glow('#b8e86a')); v.set(2, 3, 3, glow('#b8e86a'));       // eyes that catch the light
  v.set(-1, 2, 4, M(PINK, 0)); v.set(0, 2, 4, M(PINK, 0));     // nose
  return v;
}
function leg(white) {
  const v = new Vox();
  v.box(-1, -4, -1, 1, 0, 1, M(FUR, 3));
  if (white) v.box(-1, -4, -1, 1, -3, 1, M(WHITE, 3));         // socks
  return v;
}
function tail() {
  const v = new Vox();
  v.tube(0, 0, 0, 0, 4, -3, 0.9, M(FUR, 3));
  v.tube(0, 4, -3, 0, 9, -2, 0.9, M(FUR, 3));
  v.sphere(0, 9, -2, 1.1, M(WHITE, 3));                        // white tip
  return v;
}

export function createCat(office) {
  const root = new THREE.Group();
  const rig = new THREE.Group();                                // voxel units
  rig.scale.setScalar(VOXEL);
  root.add(rig);
  const torso = new THREE.Group(); rig.add(torso);
  const bodyMesh = part(body, 'body'); bodyMesh.scale.setScalar(1); torso.add(bodyMesh);
  const headPivot = new THREE.Group(); headPivot.position.set(0, 4, 6); torso.add(headPivot);
  headPivot.add(part(head, 'head')).children[0].scale.setScalar(1);
  const tailPivot = new THREE.Group(); tailPivot.position.set(0, 4, -6); torso.add(tailPivot);
  tailPivot.add(part(tail, 'tail')).children[0].scale.setScalar(1);
  const legs = [[-3, 5, true], [3, 5, true], [-3, -5, false], [3, -5, true]].map(([x, z, sock]) => {
    const g = new THREE.Group(); g.position.set(x, 4, z);
    const mesh = part(() => leg(sock), sock ? 'legw' : 'leg'); mesh.scale.setScalar(1);
    g.add(mesh); rig.add(g);
    return g;
  });
  office.stage.scene.add(root);

  const s = { x: 5.3, z: 4.4, heading: 0, state: 'nap', path: null, lengths: null, total: 0, travel: 0, speed: 1.1, walking: false, t: Math.random() * 10, pose: 0, loaf: 1 };
  let seeded = false;

  function goto(from, to, state, eta) {
    const nav = office.world?.nav;
    let path = null;
    try { path = nav?.findPath(from, to); } catch { path = null; }
    if (!path || path.length < 2) path = [from, to];
    const L = [0];
    for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
    const remaining = Math.max(0.5, (eta - office.net.now()) / 1000);
    Object.assign(s, { path, lengths: L, total: L[L.length - 1], travel: 0, walking: L[L.length - 1] > 0.05, next: state,
      speed: THREE.MathUtils.clamp(L[L.length - 1] / remaining, 0.6, 2.4) });
  }

  return {
    root, state: s,
    get pos() { return s; },
    /** From the world snapshot: where Kernel is right now. */
    place(cat) {
      if (!cat) return;
      if (!seeded || !s.walking) { s.x = cat.x; s.z = cat.z; s.state = cat.state || 'nap'; seeded = true; }
    },
    /** From a 'cat' fx: Kernel sets off somewhere. */
    move(fx) { goto({ x: s.x, z: s.z }, fx.to, fx.state || 'sit', fx.eta || office.net.now() + 4000); },
    purr() { s.purr = 1.2; },
    update(dt) {
      s.t += dt;
      if (s.walking) {
        s.travel += s.speed * dt;
        if (s.travel >= s.total) { s.walking = false; s.state = s.next || 'sit'; const e = s.path[s.path.length - 1]; s.x = e.x; s.z = e.z; }
        else {
          let i = 1;
          while (i < s.lengths.length - 1 && s.lengths[i] < s.travel) i++;
          const a = s.path[i - 1], b = s.path[i], t = (s.travel - s.lengths[i - 1]) / Math.max(1e-6, s.lengths[i] - s.lengths[i - 1]);
          s.x = a.x + (b.x - a.x) * t; s.z = a.z + (b.z - a.z) * t;
          const want = Math.atan2(b.x - a.x, b.z - a.z);
          let d = (want - s.heading) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
          s.heading += d * (1 - Math.exp(-10 * dt));
        }
      }
      const k = 1 - Math.exp(-7 * dt);
      const nap = !s.walking && s.state === 'nap', sit = !s.walking && s.state !== 'nap';
      s.loaf += ((nap ? 1 : 0) - s.loaf) * k;                    // 1 = curled up
      s.pose += ((sit ? 1 : 0) - s.pose) * k;                    // 1 = sitting upright
      const step = s.walking ? Math.sin(s.t * 13 * s.speed) : 0;
      // legs: stride when walking, tucked away when curled
      legs.forEach((g, i) => {
        g.rotation.x = step * (i === 0 || i === 3 ? 0.6 : -0.6) + (i >= 2 ? -s.pose * 0.9 : 0);
        g.scale.y = 1 - s.loaf * 0.92 - (i >= 2 ? s.pose * 0.55 : 0);
      });
      torso.position.y = 4 - s.loaf * 3.4 + (s.walking ? Math.abs(step) * 0.4 : 0) + Math.sin(s.t * 1.6) * 0.12 * s.loaf;
      torso.rotation.x = -s.pose * 0.55;                         // sitting: chest up
      headPivot.rotation.x = s.pose * 0.5 + s.loaf * 0.35 + Math.sin(s.t * 0.7) * 0.05;
      headPivot.rotation.y = s.loaf * 0.9 + (s.walking ? 0 : Math.sin(s.t * 0.4) * 0.25 * (1 - s.loaf));
      headPivot.position.y = 4 - s.loaf * 1.2;
      tailPivot.rotation.x = s.walking ? -0.2 : s.pose * 1.0 + s.loaf * 1.5;
      tailPivot.rotation.y = s.loaf * 1.1 + Math.sin(s.t * (s.walking ? 5 : 1.7)) * (s.loaf ? 0.08 : 0.35);
      if (s.purr > 0) { s.purr -= dt; torso.position.y += Math.sin(s.t * 40) * 0.12; }
      root.position.set(s.x, 0, s.z);
      root.rotation.y = s.heading;
    },
  };
}
