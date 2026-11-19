// The Backrooms — what comes out of the extinguisher, drawn: puffs of white that leave the horn fast, slow, spread, drift
// up and thin away (extinguisher.rule.js puffAt says how, by age), that stop and spread at a wall rather than go through
// it, and that hang where they were sprayed. Standing in it, the picture goes white (whiteOut): you cannot see through
// it, and neither, for what comes when you are not looking, can you see it (index.js sees).
//
// One mesh: a pool of camera-facing quads drawn by one instanced draw, a soft disc each, lit by the light where you
// stand. Then a second, the white over the whole picture when you are in it. How each puff wobbles is a hash of how
// many have been sprayed (no Math.random: the same squeeze looks the same on any page).
import * as THREE from 'three';
import { EXTINGUISHER, puffAt, whiteOut } from './extinguisher.rule.js';

const POOL = 220, RATE = 70;            // puffs at most at once · puffs a second while it sprays

const VERT = `
attribute vec3 aPos; attribute float aSize; attribute float aAlpha; attribute float aSpin;
varying vec2 vUv; varying float vA; varying float vSeed;
void main() {
  vUv = uv; vA = aAlpha; vSeed = aSpin;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  float c = cos(aSpin), s = sin(aSpin);
  mv.xy += mat2(c, -s, s, c) * position.xy * aSize;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform vec3 uTint; varying vec2 vUv; varying float vA; varying float vSeed;
float h(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv - 0.5; float r = length(p) * 2.0;
  float lump = n(vUv * 4.0 + vSeed * 7.0) * 0.6 + n(vUv * 9.0 - vSeed * 3.0) * 0.4;
  float a = (1.0 - smoothstep(0.3, 0.95, r + (lump - 0.5) * 0.45)) * (1.0 - smoothstep(0.7, 1.0, r)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uTint * (0.9 + 0.1 * lump), a);
}`;
const OVER_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const OVER_FRAG = `
uniform vec3 uTint; uniform float uK; uniform float uT; varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float patch = n(vUv * 3.0 + vec2(uT * 0.11, -uT * 0.07)) * 0.55 + n(vUv * 7.0 - vec2(uT * 0.05, uT * 0.13)) * 0.45;
  gl_FragColor = vec4(uTint, clamp(uK * (0.65 + 0.7 * patch), 0.0, 1.0));
}`;

/**
 * The spray, for one part of the building.
 * @param env  the part's env (env.world: scene, los, lightAt)
 * → { emit(dt, from, dir), update(dt, camera), whiteOut(): 0…1 how white the picture is, live(): puffs in the air, dispose() }
 */
export function createSpray(env) {
  const C = EXTINGUISHER.cloud, scene = env.world.scene;
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 3), 3), aSize = new THREE.InstancedBufferAttribute(new Float32Array(POOL), 1);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(POOL), 1), aSpin = new THREE.InstancedBufferAttribute(new Float32Array(POOL), 1);
  for (const a of [aPos, aSize, aAlpha, aSpin]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', aPos); geo.setAttribute('aSize', aSize); geo.setAttribute('aAlpha', aAlpha); geo.setAttribute('aSpin', aSpin);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTint: { value: new THREE.Color(0.85, 0.86, 0.86) } }, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'extinguisher-spray'; mesh.frustumCulled = false; mesh.renderOrder = 5;
  // the white over the picture, standing in it: drawn after the room and before what is in the hand (held things are 10000)
  const overMat = new THREE.ShaderMaterial({ vertexShader: OVER_VERT, fragmentShader: OVER_FRAG, uniforms: { uTint: { value: new THREE.Color(0.8, 0.8, 0.8) }, uK: { value: 0 }, uT: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false });
  const over = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overMat);
  over.name = 'extinguisher-white'; over.frustumCulled = false; over.renderOrder = 9990; over.visible = false;
  let added = false, owed = 0, white = 0, clock = 0, count = 0;
  /** 0…1 from the puff's number and a channel: the same every time (a hash, not a die). */
  const roll = (k) => { let h = Math.imul((count * 8 + k) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const puffs = [];                                     // { o: origin (scene), d: direction, age, stop: metres it can go before the wall, wob, spin, turn }
  const v = new THREE.Vector3(), cam = new THREE.Vector3();

  /** How far a puff can go from `o` along `d` before a wall: a few halvings of a line of sight (world.los is on the floor). */
  function free(o, d) {
    const w = env.world, at = (k) => [o.x + d.x * k + scene.position.x, o.z + d.z * k + scene.position.z];
    const [ax, az] = at(0), far = (C.speed / C.drag) * 1.05, [fx, fz] = at(far);
    if (!w.los || w.los(ax, az, fx, fz)) return far;
    let lo = 0, hi = far;
    for (let i = 0; i < 6; i++) { const mid = (lo + hi) / 2, [mx, mz] = at(mid); if (w.los(ax, az, mx, mz)) lo = mid; else hi = mid; }
    return Math.max(0.05, lo - 0.08);
  }

  return {
    /** While it sprays: puffs leave `from` (the horn's mouth, world) along `dir` (normalised, world). */
    emit(dt, from, dir) {
      if (!added) { scene.add(mesh); scene.add(over); added = true; }
      owed += RATE * dt;
      const o = v.copy(from).sub(scene.position);
      while (owed >= 1 && puffs.length < POOL) {
        owed -= 1; count++;
        // (a cone of it, not a line: each puff a little off the horn's line, and a little older, so the stream is continuous)
        const jx = (roll(0) - 0.5) * 0.22, jy = (roll(1) - 0.5) * 0.16, jz = (roll(2) - 0.5) * 0.22;
        const d = new THREE.Vector3(dir.x + jx, dir.y + jy, dir.z + jz).normalize();
        const p = { o: o.clone(), d, age: roll(3) * dt, wob: roll(4) * 6.28, spin: roll(5) * 6.28, turn: (roll(6) - 0.5) * 1.6, grow: 0.8 + roll(7) * 0.5 };
        p.stop = free(p.o, d);
        puffs.push(p);
      }
      if (owed > 4) owed = 4;
    },
    /** Every frame: age them, place them, and say how white the picture is where the camera is. */
    update(dt, camera) {
      clock += dt;
      if (!puffs.length && white <= 0.001) { if (added) { mesh.visible = false; over.visible = false; } return; }
      camera.getWorldPosition(cam).sub(scene.position);
      let n = 0, thick = 0;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]; p.age += dt;
        const s = puffAt(p.age);
        if (!s) { puffs.splice(i, 1); continue; }
        // stopped by a wall, it goes no further and spreads instead
        const along = Math.min(s.dist, p.stop), crowd = s.dist > p.stop ? 1 + Math.min(0.8, (s.dist - p.stop) * 0.9) : 1;
        const size = s.size * p.grow * crowd;
        v.copy(p.d).multiplyScalar(along).add(p.o);
        v.y += s.rise + Math.sin(p.age * 2.1 + p.wob) * 0.02 * p.age;
        v.x += Math.sin(p.age * 1.3 + p.wob) * 0.03 * p.age;
        // how much of it is round the camera: what makes the picture white
        const d = v.distanceTo(cam);
        if (d < size * 0.8) thick += s.alpha * (1 - d / (size * 0.8));
        aPos.setXYZ(n, v.x, v.y, v.z); aSize.setX(n, size); aAlpha.setX(n, s.alpha * (d < 0.25 ? d / 0.25 : 1)); aSpin.setX(n, p.spin + p.turn * p.age);
        n++;
      }
      geo.instanceCount = n;
      for (const a of [aPos, aSize, aAlpha, aSpin]) a.needsUpdate = true;
      mesh.visible = n > 0;
      // (white comes up quickly and goes slowly: the eye takes a moment to clear)
      const want = whiteOut(thick);
      white += (want - white) * (1 - Math.exp(-(want > white ? 9 : 1.6) * dt));
      const L = env.world.lightAt ? env.world.lightAt(cam.x + scene.position.x, cam.z + scene.position.z, 1.2) : [0.7, 0.7, 0.7];
      const k = (x) => Math.min(1, Math.max(0.16, x * 1.15 + 0.04));
      mat.uniforms.uTint.value.setRGB(k(L[0]), k(L[1]), k(L[2]));
      overMat.uniforms.uTint.value.setRGB(k(L[0]) * 0.95, k(L[1]) * 0.95, k(L[2]) * 0.95);
      overMat.uniforms.uK.value = white; overMat.uniforms.uT.value = clock;
      over.visible = white > 0.004;
    },
    /** 0…EXTINGUISHER.cloud.thick: how white the picture is, standing where you are. */
    whiteOut: () => white,
    /** How many puffs are in the air (a test, a probe). */
    live: () => puffs.length,
    dispose() { mesh.removeFromParent(); over.removeFromParent(); geo.dispose(); quad.dispose(); mat.dispose(); over.geometry.dispose(); overMat.dispose(); puffs.length = 0; },
  };
}
