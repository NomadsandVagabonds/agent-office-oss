// Round two's water (look2.js `water`): a pool's surface drawn over the room as the scene left it, in place of the level's
// own (a translucent sheet with a caustic texture, waterpark.js createBasin), which it hides while it is on.
//
//   - the room reflected in it: the room drawn once more from under the water's plane (look2.js planar), looked up
//     through the ripple, Schlick fresnel (water, 0.02 straight down)
//   - the floor under it seen through it: the scene's own colour, displaced by the ripple, darkened and tinted by how far
//     the eye looks through water to reach it (the scene's depth less the surface's: real depth, the basin is sunk)
//   - the ripple stepped to the grid: a few slow waves and the rings of somebody wading, as a height on 5 cm cells; the
//     slope between cells is what tilts the surface, so it moves in blocks
//   - a contact line: where the surface is within a couple of centimetres of what stands in it or walls it in (the
//     scene's depth just behind the surface), a pale line, a cell wide
//   - a wake: rings left along the path a wader has taken in the last two seconds, each growing from where it was made
import * as THREE from 'three';

const MAX_WAKE = 12;

const VERT = `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `
uniform sampler2D tScene, tDepth, tMirror;
uniform mat4 uInvProj, uProj, uMirrorVP, uViewInv;
uniform vec2 uSize;
uniform float uTime, uSliver, uCell;
uniform vec3 uAbsorb, uDeep;
uniform vec4 uWake[${MAX_WAKE}];          // x, z, age (s), strength
uniform int uWakeN;
varying vec3 vW;
vec3 viewAt(vec2 uv, float d) { vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float height(vec2 p) {
  float h = 0.006 * sin(p.x * 3.1 + uTime * 1.3) + 0.005 * sin(p.y * 2.3 - uTime * 1.1) + 0.003 * sin((p.x + p.y) * 5.7 + uTime * 2.1);
  for (int i = 0; i < ${MAX_WAKE}; i++) {
    if (i >= uWakeN) break;
    vec4 w = uWake[i];
    float r = length(p - w.xy), front = w.z * 0.55;                 // rings go out at 0.55 m/s
    float k = exp(-pow((r - front) * 9.0, 2.0)) * w.w * exp(-w.z * 1.1) / (1.0 + r * 2.0);
    h += 0.05 * k * sin((r - front) * 40.0);
    h -= 0.012 * w.w * exp(-r * r * 60.0) * exp(-w.z * 3.0);         // the trough where the leg is
  }
  return h;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float sd = texture2D(tDepth, uv).x;
  if (sd < uSliver || gl_FragCoord.z > sd) discard;                // in front of the surface: what is held, a wader's legs
  // the ripple, on cells of the grid: the slope between this cell and its neighbours, stepped
  vec2 c = (floor(vW.xz / uCell) + 0.5) * uCell;
  float h0 = height(c), hx = height(c + vec2(uCell, 0.0)), hz = height(c + vec2(0.0, uCell));
  vec2 slope = floor(vec2(hx - h0, hz - h0) / uCell * 25.0 + 0.5) / 25.0;
  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 eye = (uViewInv * vec4(0.0, 0.0, 0.0, 1.0)).xyz, V = normalize(eye - vW);
  // through it: how much water the eye looks through to reach what is under it
  vec3 sv = viewAt(uv, sd), wv = (viewMatrix * vec4(vW, 1.0)).xyz;
  float thick = max(0.0, length(sv) - length(wv));
  vec2 ruv = uv + n.xz * vec2(1.0, -1.0) * 0.06 * min(thick, 0.4);
  float rd = texture2D(tDepth, ruv).x;
  if (rd < gl_FragCoord.z || rd < uSliver) ruv = uv;                 // (refraction never fetches what is above the water)
  else thick = max(0.0, length(viewAt(ruv, rd)) - length(wv));
  vec3 under = texture2D(tScene, ruv).rgb;
  vec3 T = exp(-uAbsorb * thick);
  vec3 body = under * T + uDeep * (1.0 - T);
  // the room in it
  vec4 m = uMirrorVP * vec4(vW + vec3(n.x, 0.0, n.z) * 0.12, 1.0);
  vec3 refl = texture2D(tMirror, m.xy / m.w * 0.5 + 0.5).rgb;
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 col = mix(body, refl, F);
  // the line where it meets what stands in it and what walls it in: the scene just behind the surface
  float behind = length(sv) - length(wv);
  float edge = 1.0 - step(0.035, behind);
  col = mix(col, vec3(0.86, 0.95, 0.97) * (0.35 + 0.65 * dot(under, vec3(0.4))), edge * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildWater2({ rt, spec, root }) {
  // the level's own surface in this room: flat, see-through, mapped (createBasin)
  const level = [];
  rt.group.traverse((m) => {
    if (!m.isMesh || !m.material?.transparent || !m.material.uniforms?.map?.value) return;
    m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox;
    if (b.max.y - b.min.y < 0.01 && b.min.y > -0.3 && b.max.y < 0.05 && (b.max.x - b.min.x) > 2) level.push(m);
  });
  const box = level[0]?.geometry.boundingBox;
  const y = spec.y ?? (box ? box.min.y : -0.06);
  const x0 = box ? box.min.x : -2, x1 = box ? box.max.x : 2, z0 = box ? box.min.z : -2, z1 = box ? box.max.z : 2;
  const uniforms = {
    tScene: { value: null }, tDepth: { value: null }, tMirror: { value: null },
    uInvProj: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() }, uMirrorVP: { value: new THREE.Matrix4() }, uViewInv: { value: null },
    uSize: { value: new THREE.Vector2() }, uTime: { value: 0 }, uSliver: { value: 0 }, uCell: { value: spec.cell ?? 0.05 },
    uAbsorb: { value: new THREE.Vector3(...(spec.absorb || [2.4, 0.75, 0.55])) }, uDeep: { value: new THREE.Vector3(...(spec.deep || [0.02, 0.09, 0.11])) },
    uWake: { value: Array.from({ length: MAX_WAKE }, () => new THREE.Vector4()) }, uWakeN: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide, depthWrite: false, depthTest: false });
  // (in the world's frame, in a scene of its own: it is only ever drawn by itself, over the room)
  rt.group.updateMatrixWorld(true);
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, y, (z0 + z1) / 2); geo.applyMatrix4(rt.group.matrixWorld);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const planeY = new THREE.Vector3(0, y, 0).applyMatrix4(rt.group.matrixWorld).y;
  const scene = new THREE.Scene(); scene.add(mesh);
  return {
    meshes: [], level, planeY, uniforms, rect: [x0, z0, x1, z1, y],
    setOn(on) { for (const m of level) m.visible = !on; },
    /** wake: [[x, z, age, strength]] in the world, newest first */
    update(t, wake = []) {
      uniforms.uTime.value = t;
      uniforms.uWakeN.value = Math.min(MAX_WAKE, wake.length);
      wake.slice(0, MAX_WAKE).forEach((w, i) => uniforms.uWake.value[i].set(...w));
    },
    /** drawn by itself into `target` (alpha 1 where there is water), the room's scene and depth already drawn */
    draw({ renderer, camera, S, target, mirror, mirrorVP, mirrorTex, view, size, sliver }) {
      mirror(planeY);
      Object.assign(uniforms.tScene, { value: S.texture }); uniforms.tDepth.value = S.depthTexture; uniforms.tMirror.value = mirrorTex;
      uniforms.uInvProj.value.copy(view.uInvProj.value); uniforms.uProj.value.copy(view.uProj.value); uniforms.uMirrorVP.value.copy(mirrorVP);
      uniforms.uViewInv.value = camera.matrixWorld; uniforms.uSize.value.copy(size); uniforms.uSliver.value = sliver;
      renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    },
  };
}
