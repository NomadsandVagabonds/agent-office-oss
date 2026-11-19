// The Backrooms — the flashlight casting shadows (the Graphics setting's `beamShadows`, graphics.js): the numbers and
// rules, as plain data and arithmetic. No three.js in here: the tests read it, and beam-shadows.js draws with it.
//
// Each frame the flashlight is on, the level's opaque geometry is drawn once more, depth only, from the flashlight's
// emitter into a square picture whose frustum is the beam's outer cone (FLASHLIGHT.edgeCos, 18°) with a degree to
// spare, out to the beam's reach (FLASHLIGHT.range). The surface shader (kit.js FRAG) multiplies the beam's light by
// how much of a small kernel of that picture can see the point. The camcorder's own lamp is not shadowed: its emitter
// sits 4 cm under the lens, so whatever it throws lies behind the thing that throws it, as seen from the lens.
import { FLASHLIGHT } from './flashlight.js';

const DEG = Math.PI / 180;

export const BEAM_SHADOW = Object.freeze({
  margin: 1,          // degrees of picture past the beam's edge, so the filter's outer taps never read off the picture
  near: 0.02,         // metres (the emitter is inside the visitor's collision radius: a wall pressed against can be this near)
  far: FLASHLIGHT.range,
  normalBias: 1.5,    // texels the point looked up is pushed out along its surface's normal (flat walls do not speckle)
  slopeBias: 1.0,     // further texels per unit of tan(angle between the surface and the light): grazing walls
  slopeCap: 4,        // (tan capped: a wall the beam only skims is barely lit by it anyway)
  kernel: 1.25,       // texels between the taps of the 3 × 3 kernel (each tap is itself a 2 × 2 hardware comparison)
  edge: 0.02,         // the outer 2 % of the picture fades to unshadowed, so its border can never show
  polygonOffset: [1, 1],   // factor, units: a hair of slope-scaled bias in the depth pass itself
  sizes: Object.freeze([0, 512, 1024, 2048]),
});

/** Draw order at and above which a thing is held in the hand (hand.js draws them last, the room's depth discarded). */
export const HELD_ORDER = 10000;

/** The half-angle the shadow picture covers, in degrees: the beam's outer edge and the margin. */
export const coverDegrees = () => Math.acos(FLASHLIGHT.edgeCos) / DEG + BEAM_SHADOW.margin;

/** A value for the profile switch, cleaned: 0 (off) or one of the sizes the picture may be. */
export function beamShadowSize(v) {
  const n = Number(v);
  return BEAM_SHADOW.sizes.includes(n) ? n : 0;
}

/**
 * The shadow picture's frustum, for a pose (flashlight.js FLASHLIGHT_POSES: an emitter in the camera's own space) and
 * a size. → { fov (degrees, vertical; the picture is square), aspect, near, far, origin, direction, size }, or null
 * when there is nothing to draw: no size, or the pose is the camera's own eye (FLASHLIGHT_POSES.camera, a visit
 * without pockets): a light at the lens throws every shadow straight behind what throws it, where it cannot be seen.
 */
export function beamFrustum(pose, size) {
  const res = beamShadowSize(size);
  if (!res || !pose) return null;
  const o = pose.origin, d = pose.direction;
  if (Math.hypot(o[0], o[1], o[2]) < 1e-6) return null;
  const n = Math.hypot(d[0], d[1], d[2]) || 1;
  return { fov: 2 * coverDegrees(), aspect: 1, near: BEAM_SHADOW.near, far: BEAM_SHADOW.far, size: res,
    origin: [o[0], o[1], o[2]], direction: [d[0] / n, d[1] / n, d[2] / n] };
}

/** How wide one texel of the picture is, in metres, at distance d from the emitter (at the middle of the picture). */
export const texelAt = (d, size) => (2 * d * Math.tan(coverDegrees() * DEG)) / beamShadowSize(size);

/**
 * How far (metres) a point at distance d whose surface faces the light at cosine cosI is pushed out along its normal
 * before it is looked up: a texel and a half, and more as the surface turns away from the beam. What the shader does
 * (BEAM_SHADOW_GLSL), as arithmetic.
 */
export function beamShadowBias(d, cosI, size) {
  const c = Math.max(1e-3, Math.min(1, cosI));
  const tan = Math.min(BEAM_SHADOW.slopeCap, Math.sqrt(Math.max(0, 1 - c * c)) / c);
  return texelAt(d, size) * (BEAM_SHADOW.normalBias + BEAM_SHADOW.slopeBias * tan);
}

/** How much of the shadow is kept at (u, v) of the picture (0…1 each): 1 inside, falling to 0 at the border. */
export function edgeFade(u, v, edge = BEAM_SHADOW.edge) {
  const s = (x) => { const t = Math.max(0, Math.min(1, x / edge)); return t * t * (3 - 2 * t); };
  return s(u) * s(1 - u) * s(v) * s(1 - v);
}

/** Is the pass drawn this frame: a size, a pose that is not the eye, and the flashlight's power above the shader's own threshold. */
export const drawsBeamShadow = (size, pose, torch) => !!beamFrustum(pose, size) && torch > 0.0001;

/**
 * Does a thing throw a shadow in the beam. Only meshes (instanced and skinned too); never what is held in the hand
 * (HELD_ORDER), nothing marked userData.noBeamShadow, nothing that writes no colour or no depth (decals, blots, the
 * round shadows under things), nothing see-through unless it is a cut-out (alphaTest), which is then cut out in the
 * depth pass too.
 */
export function castsBeamShadow(o) {
  if (!o || !o.isMesh || (o.renderOrder || 0) >= HELD_ORDER || o.userData?.noBeamShadow) return false;
  const list = Array.isArray(o.material) ? o.material : [o.material];
  return list.length > 0 && list.every((m) => m && m.visible !== false && m.colorWrite !== false && m.depthWrite !== false
    && (!m.transparent || m.alphaTest > 0) && !(m.uniforms?.uAlpha?.value < 1));
}

/** Does a thing take the shadow: a kit surface (it has the beam), not held in the hand. */
export function receivesBeamShadow(o) {
  if (!o || !o.isMesh || (o.renderOrder || 0) >= HELD_ORDER || Array.isArray(o.material)) return false;
  const m = o.material;
  return !!(m && (m.isShaderMaterial || m.isKitSurface) && m.uniforms?.uTorchOrigin && typeof m.fragmentShader === 'string' && m.fragmentShader.includes('beamShadow('));
}

const gl = (n) => Number(n).toFixed(8);
/**
 * The shader's half, inserted into the kit's fragment shader (kit.js FRAG) and only compiled where BEAM_SHADOWS is
 * defined (beam-shadows.js defines it on kit surfaces while the switch is on). p and n are in the camera's space, as
 * the beam's are. uBeamShadowK: x, 1 / the picture's size; y, 1 when this frame's picture is of the beam (else every
 * point is lit as before).
 */
export const BEAM_SHADOW_GLSL = `
#ifdef BEAM_SHADOWS
uniform sampler2DShadow uBeamShadowMap;
uniform mat4 uBeamShadowMatrix;
uniform vec2 uBeamShadowK;
float beamShadowTap(vec3 s, float x, float y) {
  return texture(uBeamShadowMap, vec3(s.xy + vec2(x, y) * ${gl(BEAM_SHADOW.kernel)} * uBeamShadowK.x, s.z));
}
float beamShadow(vec3 p, vec3 n) {
  if (uBeamShadowK.y < 0.5) return 1.0;
  vec3 l = uTorchOrigin - p;
  float d = length(l);
  float ci = clamp(dot(n, l / max(d, 0.0001)), 0.001, 1.0);
  float slope = min(sqrt(max(1.0 - ci * ci, 0.0)) / ci, ${gl(BEAM_SHADOW.slopeCap)});
  float texel = d * ${gl(2 * Math.tan(coverDegrees() * DEG))} * uBeamShadowK.x;
  vec4 sp = uBeamShadowMatrix * vec4(p + n * texel * (${gl(BEAM_SHADOW.normalBias)} + ${gl(BEAM_SHADOW.slopeBias)} * slope), 1.0);
  if (sp.w <= 0.0) return 1.0;
  vec3 s = sp.xyz / sp.w;
  if (s.z >= 1.0) return 1.0;
  vec2 e = smoothstep(vec2(0.0), vec2(${gl(BEAM_SHADOW.edge)}), s.xy) * smoothstep(vec2(0.0), vec2(${gl(BEAM_SHADOW.edge)}), 1.0 - s.xy);
  float v = beamShadowTap(s, 0.0, 0.0) * 0.25
    + (beamShadowTap(s, -1.0, 0.0) + beamShadowTap(s, 1.0, 0.0) + beamShadowTap(s, 0.0, -1.0) + beamShadowTap(s, 0.0, 1.0)) * 0.125
    + (beamShadowTap(s, -1.0, -1.0) + beamShadowTap(s, 1.0, -1.0) + beamShadowTap(s, -1.0, 1.0) + beamShadowTap(s, 1.0, 1.0)) * 0.0625;
  return mix(1.0, v, e.x * e.y);
}
#endif`;
