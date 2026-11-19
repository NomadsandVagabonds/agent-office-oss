// The Backrooms — bloom from what shines (glow.js; graphics.js `glow`, Medium and High), for the WebGPU renderer
// (?gpu=webgpu). The same picture as glow.js, made a cheaper way:
//   - glow.js draws the scene a second time with every material swapped for a stand-in that writes only what shines.
//     Here the one scene pass writes it, into a second picture beside the colour (MRT): a kit surface writes its
//     self-lit voxels (kit-node.js), a lamp or sign its own colour (sceneGlowMRT, below, by kit.glowing()'s mark), and
//     everything else black, so whatever stands in front of a tube hides it by the depth test, exactly, with no reading
//     of the depth. What is see-through and writes no depth adds nothing and hides nothing, as in glow.js.
//   - the alpha is glow.js's mark: 1 a lamp (the glow is laid over it in full), under a half a picture or a self-lit
//     voxel (only GLOW_BLOOM.over of it lands on top, so what a sign says stays crisp).
//   - then glow.js's chain, number for number: that picture at half the scene's size, six halvings down (a weighted
//     five-tap) and back up (a nine-tap tent adding the level it lands on, mix[]), and the result added over the
//     picture in the tubes' warm white (tint, strength), before the tape's signal.
import { gpu } from '../engine/gpu.js';
import { glowStrength } from './glow.rule.js';

// (glow.js's numbers, GLOW_BLOOM, come in through createGlowChain from vhs-node.js: glow.js imports the WebGL
// post-processing, which kit.js, and so this, must not pull in. Until then, a picture's mark is glow.js's 0.25)
let pictureAlpha = 0.25;

/**
 * While the glow's scene pass draws (vhs-node.js sets `on` round it). three.js r180 keeps a material's compiled shader by
 * a key that does not know about the pass's several outputs, so a material first drawn at Classic would be drawn into
 * the glow's pass with its one-output shader. keyByPass() makes the key say which pass it is, for every material, from
 * the first time the glow is made: one shader for each, made once.
 */
export const glowPass = { on: false };
let keyed = false;
function keyByPass() {
  if (keyed) return;
  keyed = true;
  const N = gpu.nodes, { mrt, vec4 } = N.TSL;
  for (const proto of new Set([N.Material.prototype, N.NodeMaterial.prototype])) {
    const base = proto.customProgramCacheKey;
    proto.customProgramCacheKey = function () { const k = base.call(this); return glowPass.on ? `${k}|glow-mrt` : k; };
  }
  // Keep glowPass.on aligned with renderer.setMRT() so nested single-target passes (e.g. ReflectorNode) that
  // temporarily clear MRT during the glow pass never pick up cached 2-output |glow-mrt shaders.
  const rendererProto = N.WebGPURenderer?.prototype;
  if (rendererProto && typeof rendererProto.setMRT === 'function') {
    const baseSetMRT = rendererProto.setMRT;
    rendererProto.setMRT = function (node) {
      glowPass.on = !!node?.has?.('emissive');
      return baseSetMRT.call(this, node);
    };
  }
  // three.js gives a material the pass's outputs only when it has no fragmentNode of its own. One that has one (a kit
  // surface, water, the points, spray, the paper fire's spill, the forest's water and mist) gets them here: its colour,
  // and what it gives the glow, its own (glowEmissive(builder), as kit-node.js says) or black that hides, or nothing
  // where it is see-through and writes no depth, as glow.js's 'skip'
  const proto = N.NodeMaterial.prototype, setupOutput = proto.setupOutput;
  proto.setupOutput = function (builder, node) {
    const out = setupOutput.call(this, builder, node);
    if (this.fragmentNode === null || out?.isOutputStructNode || !builder?.renderer?.getMRT?.()?.has?.('emissive')) return out;
    const own = this.glowEmissive?.(builder);
    const emissive = own || (this.transparent && this.depthWrite === false ? vec4(0) : vec4(0, 0, 0, 1));
    return mrt({ output: out, emissive });
  };
}

/**
 * The scene pass's outputs while the glow is on: the colour, and beside it what each material gives the glow (a kit
 * surface says for itself, kit-node.js). A lamp or sign (kit.glowing: userData.glow) gives its colour as drawn, × its
 * own bloom: glow.js glowRole and shining(), with a picture marked in the alpha. What is see-through and writes no
 * depth gives nothing and hides nothing ('skip'); everything else is black with alpha 1: it hides.
 */
export function sceneGlowMRT() {
  const { TSL: T } = gpu.nodes;
  const { Fn, mrt, vec4, uniform, output } = T;
  return mrt({
    output,
    emissive: Fn((builder) => {
      const mat = builder.material;
      if (!mat || (mat.transparent && mat.depthWrite === false)) return vec4(0);
      if (!mat.userData?.glow) return vec4(0, 0, 0, 1);
      const strength = uniform(1).onRenderUpdate(() => glowStrength(mat.userData.bloom));
      const picture = mat.userData.glow === 'picture' && !mat.transparent;
      return vec4(output.rgb.mul(strength), picture ? pictureAlpha : output.a);
    })(),
  });
}

/**
 * glow.js's chain on the glow picture. resize(sw, sh): the size the scene is drawn at. render(renderer, emissive,
 * into): `emissive` the scene pass's glow picture, `into` the picture the tape's signal reads, which the glow is added to.
 */
export function createGlowChain(k) {
  const N = gpu.nodes, T = N.TSL;
  pictureAlpha = k.pictureAlpha;
  keyByPass();
  const { Fn, vec2, vec4, uniform, texture, uv, mix, smoothstep } = T;
  const rt = () => new N.RenderTarget(1, 1, { type: N.HalfFloatType, depthBuffer: false });
  const half = rt(), down = Array.from({ length: k.steps }, rt), up = Array.from({ length: k.steps - 1 }, rt);
  const quad = (fragment, extra = {}) => { const m = new N.NodeMaterial(); m.fragmentNode = fragment; Object.assign(m, { depthTest: false, depthWrite: false }, extra); return new N.QuadMesh(m); };
  let source = null, halfQuad = null;
  // (down: s * 4 and the four diagonal taps, over 8)
  const downs = down.map((t, i) => {
    const texel = uniform(new N.Vector2());
    const src = i === 0 ? half : down[i - 1];
    const s = (x, y) => texture(src.texture, uv().add(vec2(texel.x.mul(x), texel.y.mul(y))));
    const q = quad(Fn(() => s(0, 0).mul(4).add(s(-1, -1)).add(s(1, -1)).add(s(-1, 1)).add(s(1, 1)).div(8))());
    return { q, texel, src, t };
  });
  // (up: the four taps two texels out and the four diagonals twice over, over 12, × mix; plus the level it lands on × base)
  const ups = up.map((t, i) => {
    const texel = uniform(new N.Vector2()), from = i === up.length - 1 ? down[i + 1] : up[i + 1], base = down[i];
    const s = (x, y) => texture(from.texture, uv().add(vec2(texel.x.mul(x), texel.y.mul(y))));
    const sum = s(-2, 0).add(s(2, 0)).add(s(0, -2)).add(s(0, 2)).add(s(-1, -1).add(s(1, -1)).add(s(-1, 1)).add(s(1, 1)).mul(2));
    const q = quad(Fn(() => texture(base.texture, uv()).mul(i === 0 ? k.mix[0] : 1).add(sum.div(12).mul(k.mix[i + 1])))());
    return { q, texel, from, t };
  });
  const glowTex = (up[0] || down[0]).texture;
  const add = quad(Fn(() => {
    const on = smoothstep(0.35, 0.65, texture(half.texture, uv()).a).oneMinus();
    const g = texture(glowTex, uv()).rgb.mul(T.vec3(...k.tint)).mul(k.strength).mul(mix(1, k.over, on));
    return vec4(g, 1);
  })(), { transparent: true, blending: N.AdditiveBlending });
  const run = (renderer, q, target) => { renderer.setRenderTarget(target); q.render(renderer); };
  return {
    resize(sw, sh) {
      const w = Math.max(1, Math.ceil(sw * k.scale)), h = Math.max(1, Math.ceil(sh * k.scale));
      if (half.width === w && half.height === h) return;
      half.setSize(w, h);
      let bw = w, bh = h;
      for (let i = 0; i < down.length; i++) {
        bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2));
        down[i].setSize(bw, bh); if (i < up.length) up[i].setSize(bw, bh);
      }
      downs.forEach((d) => d.texel.value.set(1 / d.src.width, 1 / d.src.height));
      ups.forEach((u, i) => u.texel.value.set(1 / down[i + 1].width, 1 / down[i + 1].height));
    },
    render(renderer, emissive, into) {
      if (emissive !== source) { halfQuad?.material.dispose(); source = emissive; halfQuad = quad(Fn(() => texture(emissive, uv()))()); }
      run(renderer, halfQuad, half);
      for (const d of downs) run(renderer, d.q, d.t);
      for (let i = ups.length - 1; i >= 0; i--) run(renderer, ups[i].q, ups[i].t);
      const autoClear = renderer.autoClear; renderer.autoClear = false;            // (added over the picture, not in place of it)
      try { run(renderer, add, into); } finally { renderer.autoClear = autoClear; }
    },
    dispose() {
      for (const t of [half, ...down, ...up]) t.dispose();
      for (const x of [...downs, ...ups]) x.q.material.dispose();
      add.material.dispose(); halfQuad?.material.dispose();
    },
  };
}
