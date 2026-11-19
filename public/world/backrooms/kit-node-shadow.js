// The Backrooms — the flashlight's shadows (BEAM_SHADOWS: High, beam-shadows.rule.js / beam-shadows.js), for the node
// surface (kit-node.js) under ?gpu=webgpu. The same lookup as BEAM_SHADOW_GLSL, number for number:
//   · normal + slope-scaled bias in texels so flat and grazing walls do not speckle;
//   · projection through uBeamShadowMatrix (camera view space → shadow picture);
//   · 3 × 3 weighted kernel of 2 × 2 hardware depth comparisons (sampler2DShadow / textureSampleCompare);
//   · border fade on the outer 2 % of the picture.
//
// Uniforms (uBeamShadowMap, uBeamShadowMatrix, uBeamShadowK) are read every frame from m.uniforms; a 1 × 1 comparison
// DepthTexture stand-in is used if uBeamShadowMap has not been set yet. All 9 taps execute in uniform control flow
// (selected afterward) so WGSL textureSampleCompare validation passes on the WebGPU backend.
import { gpu } from '../engine/gpu.js';
import { BEAM_SHADOW, coverDegrees } from './beam-shadows.rule.js';

const DEG = Math.PI / 180;
const TEXEL_SCALE = 2 * Math.tan(coverDegrees() * DEG);

let blankDepth = null;
/** 1 × 1 DepthTexture stand-in with hardware comparison enabled (valid for both sampler2DShadow and texture_depth_2d). */
function standDepth() {
  if (!blankDepth) {
    const N = gpu.nodes;
    blankDepth = new N.DepthTexture(1, 1);
    blankDepth.type = N.UnsignedIntType;
    blankDepth.compareFunction = N.LessEqualCompare;
    blankDepth.minFilter = blankDepth.magFilter = N.LinearFilter;
  }
  return blankDepth;
}

/**
 * The flashlight shadow factor for a kit surface. Called inside kit-node's fragment Fn.
 * Returns `(viewPos, normal) => factor` (0 in shadow .. 1 lit), or null when BEAM_SHADOWS is not defined.
 */
export function beamShadowNode(m, D, uTorchOrigin) {
  if (!D.BEAM_SHADOWS) return null;
  const N = gpu.nodes, T = N.TSL;
  const { vec2, vec4, float, uniform, texture, dot, length, sqrt, max, min, clamp, mix, select } = T;
  const read = (key) => m.uniforms[key]?.value;

  const shadowMap = texture(read('uBeamShadowMap') || standDepth()).onRenderUpdate(() => read('uBeamShadowMap') || standDepth());
  const uMatrix = uniform(new N.Matrix4()).onRenderUpdate(() => { const v = read('uBeamShadowMatrix'); if (v?.isMatrix4) uMatrix.value.copy(v); });
  const uK = uniform(new N.Vector2(0, 0)).onRenderUpdate(() => { const v = read('uBeamShadowK'); if (v?.isVector2) uK.value.copy(v); });
  const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };

  return (p, n) => {
    const l = uTorchOrigin.sub(p);
    const d = length(l);
    const ci = clamp(dot(n, l.div(max(d, 0.0001))), 0.001, 1.0);
    const slope = min(sqrt(max(float(1).sub(ci.mul(ci)), 0)).div(ci), BEAM_SHADOW.slopeCap);
    const texel = d.mul(TEXEL_SCALE).mul(uK.x);
    const biased = p.add(n.mul(texel.mul(float(BEAM_SHADOW.normalBias).add(slope.mul(BEAM_SHADOW.slopeBias)))));
    const sp = uMatrix.mul(vec4(biased, 1));
    const s = sp.xyz.div(max(sp.w, 1e-5));
    const active = uK.y.greaterThanEqual(0.5).and(sp.w.greaterThan(0)).and(s.z.lessThan(1.0));

    // uBeamShadowMatrix maps NDC y ∈ [-1, +1] (+1 top) to s.y ∈ [0, 1] (1 top, GLSL convention).
    // TSL texture() uses top-left (0, 0) on both WebGPU and WebGL 2 backends (WebGL 2 auto-flips depth textures),
    // so we flip s.y once here and negate the y kernel offset to match GLSL tap directions.
    const baseUv = vec2(s.x, s.y.oneMinus());
    const stepK = uK.x.mul(BEAM_SHADOW.kernel);
    const refZ = clamp(s.z, 0.0, 1.0);
    const tap = (ox, oy) => {
      const q = clamp(baseUv.add(vec2(stepK.mul(ox), stepK.mul(-oy))), 0.0, 1.0);
      return shadowMap.sample(q).compare(refZ);
    };

    const v = tap(0, 0).mul(0.25)
      .add(tap(-1, 0).add(tap(1, 0)).add(tap(0, -1)).add(tap(0, 1)).mul(0.125))
      .add(tap(-1, -1).add(tap(1, -1)).add(tap(-1, 1)).add(tap(1, 1)).mul(0.0625));
    const e = ss(0, BEAM_SHADOW.edge, s.x).mul(ss(0, BEAM_SHADOW.edge, s.x.oneMinus()))
      .mul(ss(0, BEAM_SHADOW.edge, s.y)).mul(ss(0, BEAM_SHADOW.edge, s.y.oneMinus()));
    return select(active, mix(1, v, e), float(1));
  };
}
