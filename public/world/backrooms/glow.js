// The Backrooms — bloom from what shines (the Graphics setting's `glow`, graphics.js): a glow round the ceiling's tubes
// and lit pans, the exit signs and every other shining batch (kit.glowing), and the voxels that light themselves
// (screens, lamps, the exit box's charge lamp: kit.js bake, GLOW), and round nothing else. The tier's own bloom takes
// whatever is bright enough, so a pale yellow wall under a tube blooms and washes out; this one never looks at the
// picture's brightness at all.
//
// With the switch at 0 nothing here exists (vhs.js makes the pass only when a tier asks for it): the composer has the
// passes it always had, and no material of the level's is touched. With it on, each frame, inside the camcorder's chain
// where the tier's bloom was:
//   - what shines is drawn once more, at half the size the scene is drawn at, without multisampling, into a picture of
//     its own: what shines as it is (a picture, a sign or a notice, marked in the alpha), and of a kit mesh only the
//     triangles whose voxels light themselves, by a twin (the kit's own shader with EMISSIVE_BLOOM defined). Nothing
//     else is drawn: each fragment reads the depth of the scene the camcorder has just drawn (there for the haze, at
//     Medium and High; held things in its nearest sliver) and is left out where something is in front of it
//     (glow.rule.js), so a tube behind a wall or a hand blooms nothing through it. Where there is no such depth (the
//     fallback) the scene is drawn again whole, everything that hides anything in black, as the first version did.
//     What is see-through and writes no depth (glass, blots, painted pools of light and halos, the water's sheets) is
//     left out either way;
//   - that picture goes down a chain of six halvings and back up (the look-dev lab's chain, look2.js);
//   - the result is added over the scene in the tubes' own warm white, before the tape's signal: in full over and round
//     a lamp, and round a picture or a self-lit voxel but only a small share over it (where the alpha marks it), so
//     that what a sign says stays as crisp as it is drawn and the glow is a halo round it.
// Each shining batch adds to the picture as strongly as its own `bloom` says (kit.glowing's option, userData.bloom, 1
// unless given, 0…3; glow.rule.js glowStrength): its stand-in's colour is its colour × that, read every frame, so a neon
// fascia can bloom harder than a ceiling panel without either being drawn differently. At 1 the stand-ins are exactly
// the ones there were before the option. At 0 a lamp is not drawn at all (exact; without the scene's depth it is drawn
// black, as it still hides what is behind it) and a picture is drawn black with its mark (so it stays crisp). A kit
// surface takes it the same way (kit.surface's `bloom`): its twin's emitted colour × that, by a twin of its own (a uniform
// beside the surface's, only in that twin) that exists only for a strength other than 1; at 0 its twin is left out
// (exact), or drawn emitting nothing where it must still hide what is behind it.
// The level's materials are never changed: each is swapped for its stand-in for the length of the one draw, and put back.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from '/vendor/three-addons/postprocessing/Pass.js';
import { GLOW_BLOOM, GLOW_DEPTH_GLSL, glowStrength } from './glow.rule.js';

/**
 * The numbers: how strong, in what colour, how much of each step of the chain comes back up (defined in glow.rule.js).
 */
export { GLOW_BLOOM };

// (the line of the kit's emissive bloom block that writes what a voxel gives the bloom: a scaled twin multiplies it)
const EMITTED = 'gl_FragColor = vec4(emitted, plainly);';
const scaleEmitted = (frag) => frag.replace('void main() {', 'uniform float uGlowStrength;\nvoid main() {')
  .replace(EMITTED, 'gl_FragColor = vec4(emitted * uGlowStrength, plainly);');

/** Is this a kit surface that can draw its emissive part (kit.js FRAG, the emissive bloom block)? */
export const isKitSurface = (m) => !!(m && m.isShaderMaterial && m.uniforms?.uTorchOrigin && typeof m.fragmentShader === 'string'
  && m.fragmentShader.includes('#ifdef EMISSIVE_BLOOM'));

/**
 * What one material becomes in the emissive picture:
 *   'skip'   not drawn: it is not drawn anyway, or it is see-through and writes no depth (it hides nothing)
 *   'shine'  drawn as it is: it shines by itself (kit.glowing marks it 'lamp'), and its glow is laid over it in full
 *   'picture' it shines and has something on it to read (kit.glowing marks it 'picture'): drawn as it is, but marked in
 *            the picture's alpha, so that the glow goes round it and leaves it crisp
 * A shining sheet that is see-through and writes no depth (a painted pool of light, a lamp's halo) is 'skip'.
 *   'keep'   drawn as it is: it writes no colour, only depth (it still hides what is behind it)
 *   'kit'    a kit surface: its twin, which writes its self-lit voxels and black for the rest
 *   'black'  anything else: black, where it is, cut out as it is cut out
 */
export function glowRole(m) {
  if (!m || m.visible === false) return 'skip';
  if (m.userData?.glow) {
    // (a see-through shining sheet that writes no depth is light painted on to something: a pool under a microphone,
    // a halo round a lamp. It is not a source, and blooming it only blooms the room's light again)
    if (m.transparent && m.depthWrite === false) return 'skip';
    return m.userData.glow === 'picture' && !m.transparent ? 'picture' : 'shine';
  }
  if (m.colorWrite === false) return 'keep';
  if (m.depthWrite === false) return 'skip';
  if (isKitSurface(m)) return 'kit';
  return 'black';
}

/**
 * Which triangles of a voxel geometry light themselves (aSurf's y above a half on any of their corners), as a small
 * geometry of their own: those triangles and only their corners, every attribute copied (a few hundred corners in a
 * room, so it can be let go of without touching the room's own buffers). What the emissive picture draws of a kit mesh
 * when the scene's depth does the hiding; null for one with none (it is not drawn there at all). Once per geometry.
 */
export function glowFaces(geo, cache = null) {
  if (cache?.has(geo)) return cache.get(geo);
  const s = geo?.attributes?.aSurf, index = geo?.index;
  let sub = null;
  if (s) {
    const lit = (i) => s.getY(i) > 0.5, tri = [];
    const n = index ? index.count : s.count, at = (k) => (index ? index.getX(k) : k);
    for (let k = 0; k + 2 < n; k += 3) { const a = at(k), b = at(k + 1), c = at(k + 2); if (lit(a) || lit(b) || lit(c)) tri.push(a, b, c); }
    if (tri.length) {
      const remap = new Map(), order = [];
      const idx = tri.map((v) => { if (!remap.has(v)) { remap.set(v, order.length); order.push(v); } return remap.get(v); });
      sub = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(geo.attributes)) {
        const w = attr.itemSize, out = new attr.array.constructor(order.length * w);
        order.forEach((v, i) => { for (let c = 0; c < w; c++) out[i * w + c] = attr.array[v * w + c]; });
        sub.setAttribute(name, new THREE.BufferAttribute(out, w, attr.normalized));
      }
      sub.setIndex(idx);
      sub.boundingSphere = geo.boundingSphere; sub.boundingBox = geo.boundingBox;
      sub.name = 'glow:faces';
    }
  }
  cache?.set(geo, sub);
  return sub;
}

/**
 * The stand-ins, made once each and kept while the switch is on: swap(scene, exact) puts them on everything visible in
 * the scene and returns what restore() needs to put the scene back as it was. dispose() lets go of all of them.
 *
 * exact (the scene's depth is there to read: vhs.js, wherever the tier has haze): only what shines is drawn, each
 * fragment of it left out where the scene's depth says something is in front (glow.rule.js), and of a kit mesh only
 * the triangles that light themselves; nothing else is drawn at all. Not exact: everything that hides anything is
 * drawn, black where it does not shine, and the emissive picture's own depth does the hiding.
 */
export function createGlowMaterials() {
  const made = new Map(), blacks = new Map(), faces = new Map(), skipped = new THREE.MeshBasicMaterial({ visible: false });
  const depthUniforms = { tGlowDepth: { value: null }, uGlowDepth: { value: new THREE.Vector4(1, 1, 0.06, 170) } };
  const KINDS = ['twin', 'twinX', 'twinS', 'twinXS', 'shine', 'shineX', 'picture', 'pictureX'];
  const forget = (e) => {
    const m = e.target, x = made.get(m);
    if (x) { for (const k of KINDS) x[k]?.dispose(); made.delete(m); }
    m.removeEventListener('dispose', forget);
  };
  const forgetFaces = (e) => { faces.get(e.target)?.dispose(); faces.delete(e.target); e.target.removeEventListener('dispose', forgetFaces); };
  const entry = (m) => { let x = made.get(m); if (!x) { x = {}; made.set(m, x); m.addEventListener('dispose', forget); } return x; };
  /**
   * The kit surface's twin: its own shader, uniforms (the same objects: the room's dimmer, flicker and banks) and defines,
   * with EMISSIVE_BLOOM (and, exact, EMISSIVE_BLOOM_DEPTH and the depth's uniforms beside the surface's own).
   * strength (glowStrength of the surface's userData.bloom, this frame): at 1 the twin there always was; otherwise a twin
   * of its own (twinS / twinXS) whose emitted colour is multiplied by uGlowStrength, a uniform only it has, set here each
   * frame. A shader the kit did not write (no emitted line to scale) keeps its plain twin.
   */
  function twin(m, exact, strength = 1) {
    const scaled = strength !== 1 && m.fragmentShader.includes(EMITTED) && m.fragmentShader.includes('void main() {');
    const defines = { ...m.defines };
    delete defines.BEAM_SHADOWS;                     // (the beam is light, not emission: its shadow has nothing to do here)
    defines.EMISSIVE_BLOOM = 1;
    if (exact) defines.EMISSIVE_BLOOM_DEPTH = 1;
    const key = `${JSON.stringify(defines)}|${m.side}|${m.transparent}`, x = entry(m), k = (exact ? 'twinX' : 'twin') + (scaled ? 'S' : '');
    if (x[k] && x[k + 'Key'] === key && x[k + 'Frag'] === m.fragmentShader && x[k + 'Vert'] === m.vertexShader) {
      if (scaled) x[k].uniforms.uGlowStrength.value = strength;
      return x[k];
    }
    x[k]?.dispose();
    // (its alpha is a mark, not a coverage: written as it is, in whichever queue the surface is drawn in)
    const uniforms = exact ? { ...m.uniforms, ...depthUniforms } : m.uniforms;
    const material = new THREE.ShaderMaterial({ defines, uniforms: scaled ? { ...uniforms, uGlowStrength: { value: strength } } : uniforms, vertexShader: m.vertexShader,
      fragmentShader: scaled ? scaleEmitted(m.fragmentShader) : m.fragmentShader, side: m.side, transparent: m.transparent, depthWrite: true, blending: THREE.NoBlending });
    material.name = (exact ? 'glow:kit:exact' : 'glow:kit') + (scaled ? ':scaled' : '');
    Object.assign(x, { [k]: material, [k + 'Key']: key, [k + 'Frag']: m.fragmentShader, [k + 'Vert']: m.vertexShader });
    return material;
  }
  /** Black, on the same side, cut out by the same picture if it is a cut-out, and in the same queue (held things are drawn last). */
  function black(m) {
    const cut = m.alphaTest > 0 && m.map ? m.map : null;
    const key = `${m.side}|${!!m.transparent}|${cut ? cut.uuid : ''}|${cut ? m.alphaTest : 0}`;
    let b = blacks.get(key);
    if (!b) {
      b = new THREE.MeshBasicMaterial({ color: 0x000000, side: m.side ?? THREE.FrontSide, transparent: !!m.transparent, map: cut, alphaTest: cut ? m.alphaTest : 0, fog: false });
      b.name = 'glow:black';
      blacks.set(key, b);
    }
    return b;
  }
  /**
   * What shines, as it is this frame (its colour and picture followed: a room may dim it or change what it shows): a
   * picture with its alpha the mark (k.pictureAlpha); exact, with the scene's depth read before anything is drawn.
   * A lamp, not exact, at its own strength 1, is drawn as it is. strength: glowStrength of its userData.bloom, this frame.
   */
  function shining(m, mark, exact, strength = 1) {
    if (!mark && !exact && strength === 1) return m;
    const x = entry(m), k = (mark ? 'picture' : 'shine') + (exact ? 'X' : '');
    let p = x[k];
    if (!p) {
      p = m.clone();
      if (mark) Object.assign(p, { transparent: true, blending: THREE.NoBlending, opacity: GLOW_BLOOM.pictureAlpha, alphaTest: m.alphaTest * GLOW_BLOOM.pictureAlpha, depthWrite: true });
      if (exact) {
        p.defines = { ...(p.defines || {}), EMISSIVE_BLOOM: 1, EMISSIVE_BLOOM_DEPTH: 1 };
        p.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, depthUniforms);
          shader.fragmentShader = shader.fragmentShader.replace('void main() {', `${GLOW_DEPTH_GLSL}\nvoid main() {\n\tif ( glowHidden() ) discard;`);
        };
        p.customProgramCacheKey = () => 'glow:depth';
      }
      p.name = `glow:${k}`;
      x[k] = p;
    }
    p.color.copy(m.color); p.map = m.map;
    if (strength !== 1) p.color.multiplyScalar(strength);   // (its own share of the bloom: the batch itself is not touched)
    return p;
  }
  function standIn(m, exact = false) {
    const role = glowRole(m);
    if (role === 'skip') return skipped;
    if (role === 'shine' || role === 'picture') {
      const strength = glowStrength(m.userData.bloom);
      // (a lamp at 0 adds nothing: not drawn where the scene's depth does the hiding, black where it must still hide)
      if (strength === 0 && role === 'shine') return exact ? skipped : black(m);
      return shining(m, role === 'picture', exact, strength);
    }
    if (role === 'kit') {
      const strength = glowStrength(m.userData.bloom);
      // (at 0: left out where the scene's depth does the hiding; else its twin emitting nothing, so it still hides, cut-outs and all)
      return exact && strength === 0 ? skipped : twin(m, exact, strength);
    }
    if (exact) return skipped;                                           // (black and depth-only: the scene's depth does their hiding)
    return role === 'black' ? black(m) : m;
  }
  const list = [], stats = { drawn: 0, faces: 0 };
  const facesOf = (geo) => { if (!faces.has(geo)) { glowFaces(geo, faces); geo.addEventListener('dispose', forgetFaces); } return faces.get(geo); };
  return {
    standIn, depthUniforms, stats,
    /** → the list restore() takes: each mesh with the material (and geometry) it had, each thing hidden for the pass. */
    swap(scene, exact = false) {
      list.length = 0; stats.drawn = 0; stats.faces = 0;
      scene.traverseVisible((o) => {
        if (o.isMesh) {
          const was = o.material, geo = o.geometry;
          let now, sub = null;
          if (Array.isArray(was)) now = was.map((m) => standIn(m, exact));
          else if (exact && glowRole(was) === 'kit') {
            // (only the triangles that light themselves; a mesh with none, or at strength 0, is not drawn)
            const strength = glowStrength(was.userData.bloom);
            sub = strength === 0 ? null : facesOf(geo);
            now = sub ? twin(was, true, strength) : skipped;
          } else now = standIn(was, exact);
          list.push(o, was, sub ? geo : null, true);
          o.material = now;
          if (sub) { o.geometry = sub; stats.faces++; }
          if (Array.isArray(now) ? now.some((m) => m !== skipped) : now !== skipped) stats.drawn++;
        } else if (o.isSprite || o.isPoints || o.isLine) { list.push(o, null, null, false); o.visible = false; }
      });
      return list;
    },
    restore(saved = list) {
      for (let i = 0; i < saved.length; i += 4) {
        const o = saved[i];
        if (saved[i + 3]) { o.material = saved[i + 1]; if (saved[i + 2]) o.geometry = saved[i + 2]; } else o.visible = true;
      }
      saved.length = 0;
    },
    get twins() { let n = 0; for (const x of made.values()) n += (x.twin ? 1 : 0) + (x.twinX ? 1 : 0) + (x.twinS ? 1 : 0) + (x.twinXS ? 1 : 0); return n; },
    get blacks() { return blacks.size; },
    get pictures() { let n = 0; for (const x of made.values()) n += (x.picture ? 1 : 0) + (x.pictureX ? 1 : 0); return n; },
    get faces() { let n = 0; for (const f of faces.values()) if (f) n++; return n; },
    dispose() {
      for (const m of [...made.keys()]) forget({ target: m });
      for (const b of blacks.values()) b.dispose();
      blacks.clear();
      for (const g of [...faces.keys()]) forgetFaces({ target: g });
      skipped.dispose();
    },
  };
}

const QUAD = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
// (the lab's chain, look2.js: a weighted five-tap step down, a nine-tap tent step up that adds the level it lands on)
const DOWN = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() { vec2 h = uTexel;
  vec4 s = texture2D(tSrc, vUv) * 4.0 + texture2D(tSrc, vUv + vec2(-h.x, -h.y)) + texture2D(tSrc, vUv + vec2(h.x, -h.y)) + texture2D(tSrc, vUv + vec2(-h.x, h.y)) + texture2D(tSrc, vUv + vec2(h.x, h.y));
  gl_FragColor = s / 8.0; }`;
const UP = `uniform sampler2D tSrc, tBase; uniform vec2 uTexel; uniform float uMix, uBase; varying vec2 vUv;
void main() { vec2 h = uTexel;
  vec4 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)) + texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)) + texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)) + texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0))
         + (texture2D(tSrc, vUv + vec2(-h.x, -h.y)) + texture2D(tSrc, vUv + vec2(h.x, -h.y)) + texture2D(tSrc, vUv + vec2(-h.x, h.y)) + texture2D(tSrc, vUv + vec2(h.x, h.y))) * 2.0;
  gl_FragColor = texture2D(tBase, vUv) * uBase + s / 12.0 * uMix; }`;
// (over a picture that shines, a sign or a screen, only a share of it: the halo is round its words, not on top of them.
// Lamps take it in full. The emissive picture's alpha says which is which: under a half, a picture)
const ADD = `uniform sampler2D tGlow, tEmit; uniform vec3 uTint; uniform float uStrength, uOver; varying vec2 vUv;
void main() {
  float on = 1.0 - smoothstep(0.35, 0.65, texture2D(tEmit, vUv).a);
  gl_FragColor = vec4(texture2D(tGlow, vUv).rgb * uTint * uStrength * mix(1.0, uOver, on), 1.0);
}`;

/**
 * The pass (vhs.js puts it where the tier's bloom is, and takes it out again when the switch goes back to 0). It draws
 * onto the picture it is given and does not swap. resize(sw, sh): the size the scene is drawn at (vhs.js layout).
 */
export class GlowPass extends Pass {
  /**
   * depthOf(readBuffer): the depth texture of the scene the camcorder has just drawn, or null (vhs.js: the supersampled
   * scene's, or the picture's own; there only where the tier has haze). With one, only what shines is drawn and that
   * depth does the hiding (exact); without, everything that hides anything is drawn again, black.
   */
  constructor(camera, scene = new THREE.Scene(), k = GLOW_BLOOM, depthOf = null) {
    super();
    this.needsSwap = false; this.camera = camera; this.scene = scene; this.k = k; this.depthOf = depthOf;
    this.materials = createGlowMaterials();
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.emissive = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });     // (its own depth: what hides what)
    this.down = Array.from({ length: k.steps }, rt);
    this.up = Array.from({ length: k.steps - 1 }, rt);
    const pass = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: QUAD, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.downMat = pass(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.upMat = pass(UP, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 }, uBase: { value: 1 } });
    this.addMat = pass(ADD, { tGlow: { value: null }, tEmit: { value: this.emissive.texture }, uTint: { value: new THREE.Vector3(...k.tint) }, uStrength: { value: k.strength },
      uOver: { value: k.over } },
      { transparent: true, blending: THREE.AdditiveBlending });
    this.quad = new FullScreenQuad(null);
    this.size = [0, 0];
    this.stats = { drawn: false, meshes: 0, exact: false };
    this.clear = new THREE.Color();
  }
  setSize() {}                                           // (its own size is set by resize(), from layout(), not by the composer)
  resize(sw, sh) {
    const w = Math.max(1, Math.ceil(sw * this.k.scale)), h = Math.max(1, Math.ceil(sh * this.k.scale));
    if (w === this.size[0] && h === this.size[1]) return;
    this.size = [w, h];
    this.emissive.setSize(w, h);
    let bw = w, bh = h;
    for (let i = 0; i < this.down.length; i++) {
      bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2));
      this.down[i].setSize(bw, bh); if (i < this.up.length) this.up[i].setSize(bw, bh);
    }
  }
  run(renderer, material, target) { this.quad.material = material; renderer.setRenderTarget(target); this.quad.render(renderer); }
  /**
   * Leaves the renderer and the scene as it found them, whatever happens: every material and visibility (the stand-ins
   * are only on for the one draw), the background, the render target, clear colour, autoClear and the shadow maps'
   * autoUpdate, each put back in a finally. It sets nothing on the scene or its meshes that anything else reads (no
   * overrideMaterial, no layers), so a room that draws the scene again itself in the same frame (the-sets.js's camera, in
   * its tick, before the camcorder draws) sees the scene as it is.
   */
  render(renderer, writeBuffer, readBuffer) {
    const was = renderer.getRenderTarget?.() ?? null, autoClear = renderer.autoClear, clearAlpha = renderer.getClearAlpha();
    const shadowAuto = renderer.shadowMap?.autoUpdate, scene = this.scene, bg = scene.background;
    renderer.getClearColor(this.clear);
    let saved = null;
    try {
      renderer.autoClear = false;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;     // (what the scene's draw already brought up to date)
      // 1. what shines, and what hides it
      const depth = this.depthOf?.(readBuffer) || null, exact = !!depth;
      if (exact) {
        const u = this.materials.depthUniforms;
        u.tGlowDepth.value = depth;
        u.uGlowDepth.value.set(1 / this.emissive.width, 1 / this.emissive.height, this.camera.near, this.camera.far);
      }
      saved = this.materials.swap(scene, exact);
      this.stats.meshes = this.materials.stats.drawn; this.stats.exact = exact;
      scene.background = null;
      renderer.state?.buffers.depth.setMask(true);       // (a see-through mesh drawn before may have left depth writes off)
      renderer.setRenderTarget(this.emissive); renderer.setClearColor(0x000000, 1); renderer.clear(true, true, false);
      renderer.render(scene, this.camera);
      this.materials.restore(saved); saved = null;
      // 2. down the chain and back up
      let src = this.emissive;
      const d = this.downMat.uniforms, u = this.upMat.uniforms;
      for (const t of this.down) { d.tSrc.value = src.texture; d.uTexel.value.set(1 / src.width, 1 / src.height); this.run(renderer, this.downMat, t); src = t; }
      for (let i = this.up.length - 1; i >= 0; i--) {
        const from = i === this.up.length - 1 ? this.down[i + 1] : this.up[i + 1];
        u.tSrc.value = from.texture; u.tBase.value = this.down[i].texture;
        u.uTexel.value.set(1 / this.down[i + 1].width, 1 / this.down[i + 1].height); u.uMix.value = this.k.mix[i + 1]; u.uBase.value = i === 0 ? this.k.mix[0] : 1;
        this.run(renderer, this.upMat, this.up[i]);
      }
      // 3. over the picture, in the tubes' colour
      this.addMat.uniforms.tGlow.value = (this.up[0] || this.down[0]).texture;
      this.run(renderer, this.addMat, this.renderToScreen ? null : readBuffer);
      this.stats.drawn = true;
    } finally {
      if (saved) this.materials.restore(saved);
      scene.background = bg;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = shadowAuto;
      renderer.setClearColor(this.clear, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(was);
    }
  }
  /** Everything it made: its targets, its passes' materials, the stand-ins. */
  dispose() {
    for (const t of [this.emissive, ...this.down, ...this.up]) t.dispose();
    this.downMat.dispose(); this.upMat.dispose(); this.addMat.dispose(); this.quad.dispose();
    this.materials.dispose();
  }
}
