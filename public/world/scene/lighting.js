// The Office — light and time of day.
//
// One warm key light with soft shadows (the sun, or the moon), a sky/ground
// fill, and a cool rim so silhouettes separate from the floor. The hour comes
// from the daemon, so the office is bright at noon and lamplit at midnight —
// wherever the daemon lives.
import * as THREE from 'three';
import { voxelUniforms } from '../vox/material.js';

const hexLerp = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

// hour → look. Interpolated between neighbours.
const KEYS = [
  { h: 0,    bg: '#0d0b14', sky: '#7f86bd', ground: '#4c3f40', hemi: 1.1, sun: '#a9b8ff', power: 1.0, dir: [0.45, 1.0, 0.7],  glow: 1.7, bloom: 0.55, fill: 0.35, lamp: 1 },
  { h: 5.5,  bg: '#0f0d18', sky: '#7f86bd', ground: '#4c3f40', hemi: 1.1, sun: '#a9b8ff', power: 1.0, dir: [0.45, 1.0, 0.7],  glow: 1.7, bloom: 0.55, fill: 0.35, lamp: 1 },
  { h: 7.5,  bg: '#221c2a', sky: '#f0c8b0', ground: '#6a5648', hemi: 1.25, sun: '#ffc48a', power: 2.1,  dir: [0.95, 0.55, 0.6], glow: 1.8, bloom: 0.55, fill: 0.5, lamp: 0.45 },
  { h: 10,   bg: '#262330', sky: '#e3ecff', ground: '#8a7560', hemi: 1.55, sun: '#fff3df', power: 2.7,  dir: [0.55, 1.0, 0.7],  glow: 1.5, bloom: 0.45, fill: 0.6, lamp: 0 },
  { h: 15,   bg: '#262330', sky: '#e3ecff', ground: '#8a7560', hemi: 1.55, sun: '#fff0d8', power: 2.7,  dir: [-0.5, 1.0, 0.75], glow: 1.5, bloom: 0.45, fill: 0.6, lamp: 0 },
  { h: 18.5, bg: '#231a26', sky: '#f2b9a0', ground: '#6a5244', hemi: 1.2,  sun: '#ffb070', power: 2.2,  dir: [-0.95, 0.5, 0.6], glow: 1.9, bloom: 0.6, fill: 0.45, lamp: 0.6 },
  { h: 20.5, bg: '#0f0d18', sky: '#7f86bd', ground: '#4c3f40', hemi: 1.1, sun: '#a9b8ff', power: 1.0, dir: [0.45, 1.0, 0.7],  glow: 1.7, bloom: 0.55, fill: 0.35, lamp: 1 },
  { h: 24,   bg: '#0d0b14', sky: '#7f86bd', ground: '#4c3f40', hemi: 1.1, sun: '#a9b8ff', power: 1.0, dir: [0.45, 1.0, 0.7],  glow: 1.7, bloom: 0.55, fill: 0.35, lamp: 1 },
];

export function lookAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (h - a.h) / Math.max(1e-6, b.h - a.h)));
  const n = (k) => a[k] + (b[k] - a[k]) * t;
  return {
    bg: hexLerp(a.bg, b.bg, t), sky: hexLerp(a.sky, b.sky, t), ground: hexLerp(a.ground, b.ground, t), sun: hexLerp(a.sun, b.sun, t),
    hemi: n('hemi'), power: n('power'), glow: n('glow'), bloom: n('bloom'), fill: n('fill'), lamp: n('lamp'),
    dir: new THREE.Vector3(a.dir[0] + (b.dir[0] - a.dir[0]) * t, a.dir[1] + (b.dir[1] - a.dir[1]) * t, a.dir[2] + (b.dir[2] - a.dir[2]) * t).normalize(),
    night: h < 6.5 || h >= 19.5,
  };
}

/**
 * @param {object} stage  from createStage()
 * @param {{shadowSize?:number}} [opt]
 */
export function createLighting(stage, opt = {}) {
  const { scene } = stage;
  const hemi = new THREE.HemisphereLight('#e3ecff', '#8a7560', 1.5);
  const sun = new THREE.DirectionalLight('#fff3df', 2.6);
  const rim = new THREE.DirectionalLight('#9fb4ff', 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(opt.shadowSize || 2048, opt.shadowSize || 2048);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  scene.add(hemi, sun, sun.target, rim);
  scene.background = new THREE.Color('#262330');

  // the table the model stands on
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: '#2a2634' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; ground.receiveShadow = true;
  scene.add(ground);
  scene.fog = new THREE.Fog('#262330', 160, 420);

  // Real light for the lamps nearest to wherever you are looking; the rest
  // only glow. A handful of lights is all a miniature needs.
  const lampLights = Array.from({ length: opt.lamps ?? 6 }, () => {
    const l = new THREE.PointLight('#ffc98a', 0, 8.5, 2);
    scene.add(l);
    return l;
  });
  let lampSpots = [], lampAt = { x: 1e9, z: 1e9 }, lampDirty = true;

  let hour = 14, look = lookAt(hour), extent = 0;
  const dir = new THREE.Vector3(0.5, 1, 0.7).normalize();

  function apply() {
    look = lookAt(hour);
    hemi.color.copy(look.sky); hemi.groundColor.copy(look.ground); hemi.intensity = look.hemi;
    sun.color.copy(look.sun); sun.intensity = look.power;
    rim.intensity = look.fill;
    dir.copy(look.dir);
    scene.background.copy(look.bg); scene.fog.color.copy(look.bg);
    ground.material.color.copy(look.bg).multiplyScalar(1.12);
    voxelUniforms.uGlow.value = look.glow;
    if (stage.bloom) stage.bloom.strength = look.bloom;
    lampDirty = true;
  }
  apply();

  return {
    hemi, sun, rim, ground,
    get hour() { return hour; },
    get night() { return look.night; },
    setHour(h) { if (Math.abs(h - hour) > 1e-3) { hour = h; apply(); } },
    /** Where the lamps are: [{x, y, z, power?}]. Call again when lamps come and go. */
    setLamps(list) { lampSpots = list || []; lampDirty = true; },
    /** Keep the shadow map wrapped tightly around whatever the camera is looking at. */
    follow(target, distance) {
      const want = Math.max(9, Math.min(70, distance * 0.62));
      if (Math.abs(want - extent) > extent * 0.08) {
        extent = want;
        const c = sun.shadow.camera;
        c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 1; c.far = 220;
        c.updateProjectionMatrix();
      }
      const texel = (2 * extent) / sun.shadow.mapSize.x;
      const tx = Math.round(target.x / texel) * texel, tz = Math.round(target.z / texel) * texel;
      sun.target.position.set(tx, 0, tz);
      sun.position.set(tx + dir.x * 90, dir.y * 90, tz + dir.z * 90);
      rim.position.set(tx - dir.x * 40, 30, tz - 50);
      if (lampDirty || Math.hypot(target.x - lampAt.x, target.z - lampAt.z) > 1.5) {
        lampDirty = false; lampAt = { x: target.x, z: target.z };
        const near = look.lamp > 0.02
          ? lampSpots.map((p) => ({ p, d: Math.hypot(p.x - target.x, p.z - target.z) })).sort((a, b) => a.d - b.d).slice(0, lampLights.length)
          : [];
        lampLights.forEach((l, i) => {
          const n = near[i];
          l.visible = !!n;
          if (n) { l.position.set(n.p.x, n.p.y, n.p.z); l.intensity = 9 * look.lamp * (n.p.power || 1); }
        });
      }
    },
  };
}
