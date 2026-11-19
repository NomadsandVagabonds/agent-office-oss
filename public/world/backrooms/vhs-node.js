// The Backrooms — the camcorder, for the WebGPU renderer (?gpu=webgpu: engine/gpu.js). The same pipeline as vhs.js,
// written in three.js's node language (TSL) instead of GLSL:
//   - optional supersample target (`sw > iw`, Medium / High) with a 4-tap tent downsample;
//   - optional emissive MRT glow (`prof.glow > 0`, Medium / High): the scene pass writes attachment 1 (`emissive`)
//     directly (no twin scene redraw), blurred through glow.js's 6-step down / 5-step up pyramid and added in resolve;
//   - SIGNAL (lines to one side, soft luma, softer and late chroma, noise, tracking band, head switch, grade & haze);
//   - SCREEN (4:3 between black bars, scan lines, vignette) onto the window.
//
// Not here yet (docs/BLOCKROOMS-WEBGPU.md): water view (liquid.js, Step 5) and host threshold bloom (Classic office).
//
// It takes three.js's WebGPU build from engine/gpu.js (the stage put it there), so nothing on the default path loads it.
import { gpu } from '../engine/gpu.js';
import { profile, internalSize } from './graphics.js';
import { GLOW_BLOOM } from './glow.rule.js';

const HAZE_LIGHT = 1.6;                                  // (vhs.js's)

/**
 * The same interface as vhs.js createVhs, drawn with node materials. `renderer` is a WebGPURenderer.
 * @param {object} renderer
 * @param {import('three').PerspectiveCamera} camera
 * @param {{bloom?:boolean, level?:number, profile?:object}} [opt]
 */
export function createVhsNode(renderer, camera, opt = {}) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec2, vec3, vec4, float, uniform, texture, uv, fract, floor, dot, sin, cos, exp, pow, mix, clamp, step, abs, max, min, length, select, mrt, output } = T;

  // the uniforms, as vhs.js has them (index.js and the rooms set these by name: uBlack, uSnow, uWhite, uRed, uTrack...)
  const u = {
    uRes: { value: new N.Vector2(640, 480) }, uTime: { value: 0 },
    uAmt: { value: 1 }, uSoft: { value: 1 }, uTrack: { value: 0 }, uGain: { value: 1 }, uExposure: { value: 1 },
    uBlack: { value: 0 }, uWhite: { value: 0 }, uRed: { value: 0 }, uSnow: { value: 0 }, uStaticDark: { value: 0 }, uRoll: { value: 0 },
    uGrade: { value: 0 }, uHaze: { value: 0 },
    uLift: { value: new N.Vector3(0, 0, 0) }, uGamma: { value: new N.Vector3(1, 1, 1) }, uGainRGB: { value: new N.Vector3(1, 1, 1) }, uSat: { value: 1 },
    tDepth: { value: null }, uNear: { value: 0.06 }, uFar: { value: 170 }, uHazeColor: { value: new N.Vector3(0.8, 0.78, 0.72) }, uHazeLight: { value: 0.3 },
    uHazeFrom: { value: 8 },
  };
  const s = { uPicture: { value: new N.Vector2(1, 1) }, uShift: { value: new N.Vector2(0, 0) }, uSoft: { value: 1 }, uLines: { value: 240 }, uScan: { value: 0.08 } };
  const node = {}, screenNode = {};
  const copy = (from, to) => { for (const [k, v] of Object.entries(from)) if (to[k]) { if (v.value?.isVector2 || v.value?.isVector3) to[k].value.copy(v.value); else to[k].value = v.value; } };
  for (const [k, v] of Object.entries(u)) if (k !== 'tDepth') node[k] = uniform(v.value?.clone ? v.value.clone() : v.value);
  for (const [k, v] of Object.entries(s)) screenNode[k] = uniform(v.value?.clone ? v.value.clone() : v.value);

  // WebGPU knows 1 and 4 samples only. MRT attachments must be named to match MRTNode keys ('output', 'emissive').
  const samplesOf = (msaa) => (msaa > 1 ? 4 : 1);
  const makeTarget = (w, h, { samples = 1, depth = false, count = 1 } = {}) => {
    const rt = new N.RenderTarget(w, h, { type: N.HalfFloatType, samples, count, depthBuffer: depth || count > 0 });
    rt.textures[0].name = 'output';
    if (count > 1) rt.textures[1].name = 'emissive';
    if (depth) rt.depthTexture = new N.DepthTexture(w, h);
    return rt;
  };
  const makeFlatTarget = (w, h) => new N.RenderTarget(w, h, { type: N.HalfFloatType, depthBuffer: false });

  // (three.js's quad has v = 0 at the top of the picture; SIGNAL/SCREEN count from the bottom, as vhs.js's GLSL does)
  const up = () => vec2(uv().x, uv().y.oneMinus());
  const at = (tex, p) => texture(tex, vec2(p.x, p.y.oneMinus()));
  const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };
  const LUMA = vec3(0.299, 0.587, 0.114);
  const luma = (c) => dot(c, LUMA);
  const hash = (p) => { const q = fract(vec3(p.x, p.y, p.x).mul(0.1031)); const r = q.add(dot(q, q.yzx.add(33.33))); return fract(r.x.add(r.y).mul(r.z)); };
  const toIQ = (c) => vec2(dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312)));
  const toRGB = (y, iq) => vec3(y.add(iq.x.mul(0.956)).add(iq.y.mul(0.621)), y.sub(iq.x.mul(0.272)).sub(iq.y.mul(0.647)), y.sub(iq.x.mul(1.106)).add(iq.y.mul(1.703)));

  // Per-material MRT emissive selector: only active while renderer.setMRT(glowMrt) is set, so Classic and
  // single-attachment render targets (ReflectorNode, the-sets CCTV) never see an extra attachment.
  class EmissiveMrtNode extends N.Node {
    constructor() { super('vec4'); }
    setup(builder) {
      const mat = builder.material;
      if (mat?.userData?.emissiveMrt) return mat.userData.emissiveMrt;
      if (mat?.transparent && mat?.depthWrite === false) return vec4(0, 0, 0, 0);
      return vec4(0, 0, 0, 1);
    }
  }
  const glowMrt = mrt({ output, emissive: new EmissiveMrtNode() });
  const uSuperStep = uniform(new N.Vector2(0, 0));

  function makeQuad(fragmentNode) {
    const m = new N.NodeMaterial();
    m.fragmentNode = fragmentNode;
    m.depthTest = false; m.depthWrite = false;
    return new N.QuadMesh(m);
  }

  /** Weighted 5-tap downsample step (glow.js DOWN). */
  function downPass(srcTex) {
    const uTexel = uniform(new N.Vector2(1, 1));
    const quad = makeQuad(Fn(() => {
      const p = uv(), h = uTexel;
      const sample = (dx, dy) => texture(srcTex, clamp(p.add(vec2(dx, dy)), 0.0005, 0.9995));
      const acc = sample(0, 0).mul(4)
        .add(sample(h.x.negate(), h.y.negate()))
        .add(sample(h.x, h.y.negate()))
        .add(sample(h.x.negate(), h.y))
        .add(sample(h.x, h.y));
      return acc.div(8);
    })());
    return { quad, uTexel };
  }

  /** 9-tap tent upsample + base accumulation (glow.js UP). */
  function upPass(srcTex, baseTex, mixW, baseW) {
    const uTexel = uniform(new N.Vector2(1, 1));
    const quad = makeQuad(Fn(() => {
      const p = uv(), h = uTexel;
      const sample = (dx, dy) => texture(srcTex, clamp(p.add(vec2(dx, dy)), 0.0005, 0.9995));
      const cross4 = sample(h.x.mul(-2), 0).add(sample(h.x.mul(2), 0)).add(sample(0, h.y.mul(-2))).add(sample(0, h.y.mul(2)));
      const diag4 = sample(h.x.negate(), h.y.negate()).add(sample(h.x, h.y.negate())).add(sample(h.x.negate(), h.y)).add(sample(h.x, h.y));
      const blurred = cross4.add(diag4.mul(2)).div(12);
      return texture(baseTex, p).mul(baseW).add(blurred.mul(mixW));
    })());
    return { quad, uTexel };
  }

  /** Combine scene colour (direct or 4-tap supersample tent) with optional MRT emissive glow into sceneTarget. */
  function resolvePass(colorTex, emitTex, glowTex, supersampled) {
    const K = GLOW_BLOOM;
    const tint = vec3(K.tint[0], K.tint[1], K.tint[2]);
    return makeQuad(Fn(() => {
      const p = uv();
      const base = supersampled
        ? texture(colorTex, clamp(p.add(vec2(uSuperStep.x.negate(), uSuperStep.y.negate())), 0.0005, 0.9995)).rgb
          .add(texture(colorTex, clamp(p.add(vec2(uSuperStep.x, uSuperStep.y.negate())), 0.0005, 0.9995)).rgb)
          .add(texture(colorTex, clamp(p.add(vec2(uSuperStep.x.negate(), uSuperStep.y)), 0.0005, 0.9995)).rgb)
          .add(texture(colorTex, clamp(p.add(vec2(uSuperStep.x, uSuperStep.y)), 0.0005, 0.9995)).rgb)
          .mul(0.25)
        : texture(colorTex, p).rgb;
      if (!glowTex || !emitTex) return vec4(base, 1);
      const on = float(1).sub(ss(0.35, 0.65, texture(emitTex, p).a));
      const added = texture(glowTex, p).rgb.mul(tint).mul(K.strength).mul(mix(1, K.over, on));
      return vec4(base.add(added), 1);
    })());
  }

  /** The SIGNAL pass, reading `colorTex` and optional `depthTex` (for Medium / High haze). */
  function signalMaterial(colorTex, depthTex) {
    const U = node;
    const film = (c) => float(1).sub(exp(c.negate().mul(U.uExposure.mul(U.uGain).mul(1.3))));
    const haze = (c, p) => {
      const d = at(depthTex, p).x;
      const z = U.uNear.mul(U.uFar).div(U.uFar.sub(d.mul(U.uFar.sub(U.uNear))));
      const k = float(1).sub(exp(max(z.sub(U.uHazeFrom), 0).mul(-0.05))).mul(0.5).mul(U.uHaze);
      const l = luma(c);
      const air = U.uHazeColor.div(max(luma(U.uHazeColor), 0.001)).mul(l).mul(1.08).add(U.uHazeColor.mul(min(U.uHazeLight, l)).mul(0.3));
      return select(d.greaterThanEqual(0.99999), c, mix(c, air, k));
    };
    const grade = (c) => {
      const g0 = pow(max(c.mul(U.uGainRGB).add(U.uLift.mul(c.oneMinus())), 0), vec3(1).div(U.uGamma));
      const g = mix(vec3(luma(g0)), g0, U.uSat);
      return mix(c, g, U.uGrade);
    };
    const see = (p) => {
      const q = clamp(p, 0.001, 0.999);
      let c = at(colorTex, q).rgb;
      if (depthTex) c = select(U.uHaze.greaterThan(0), haze(c, q), c);
      c = pow(film(c), vec3(0.4545));
      return select(U.uGrade.greaterThan(0), grade(c), c);
    };
    const main = Fn(() => {
      const p = up().toVar();
      p.y.assign(fract(p.y.add(U.uRoll)));
      const line = floor(p.y.mul(U.uRes.y)), frame = floor(U.uTime.mul(30));
      const wob = hash(vec2(line, frame)).sub(0.5).mul(0.0015).add(sin(p.y.mul(7).add(U.uTime.mul(1.3))).mul(0.0006)).toVar();
      const bandAt = fract(U.uTime.mul(0.045).add(0.2));
      const band = ss(0.045, 0.0, abs(p.y.sub(bandAt))).mul(U.uTrack.add(0.12));
      wob.addAssign(band.mul(hash(vec2(line.mul(1.7), frame)).sub(0.5)).mul(0.05));
      const rows = floor(p.y.mul(14));
      wob.addAssign(U.uTrack.mul(hash(vec2(frame, rows)).sub(0.5)).mul(0.012).mul(step(0.6, hash(vec2(rows, frame.mul(0.5))))));
      const foot = ss(0.028, 0.0, p.y);
      wob.addAssign(foot.mul(sin(U.uTime.mul(2).add(line.mul(0.7))).mul(0.012).add(0.018)));
      p.x.addAssign(wob.mul(U.uAmt));

      const px = U.uSoft.div(U.uRes.x);
      const side = (k) => vec2(px.mul(k), 0);
      const c0 = see(p);
      const y = luma(c0).mul(0.5).add(luma(see(p.add(side(1.25)))).add(luma(see(p.sub(side(1.25))))).mul(0.25)).toVar();
      const iq = toIQ(c0).mul(0.26)
        .add(toIQ(see(p.sub(side(2.5)))).mul(0.28))
        .add(toIQ(see(p.sub(side(5.0)))).mul(0.22))
        .add(toIQ(see(p.sub(side(7.5)))).mul(0.15))
        .add(toIQ(see(p.sub(side(10.5)))).mul(0.09))
        .mul(U.uSoft.mul(0.16).add(1)).toVar();
      const grain = U.uAmt.mul(U.uGain.sub(1).mul(0.9).add(0.6).add(U.uTrack.mul(1.5)));
      y.addAssign(hash(vec2(p.x.mul(U.uRes.x), line).add(frame.mul(17))).sub(0.5).mul(0.06).mul(grain));
      const cell = vec2(floor(p.x.mul(U.uRes.x).div(6)), line);
      iq.addAssign(vec2(hash(cell.add(frame.mul(3))), hash(cell.add(71).add(frame.mul(7)))).sub(0.5).mul(0.045).mul(grain));
      const at0 = hash(vec2(frame, line));
      const dash = step(U.uTrack.mul(-0.006).add(0.9994), hash(vec2(line, frame.mul(1.3)))).mul(step(at0, p.x)).mul(step(p.x, at0.add(0.06)));
      y.assign(mix(y, 0.92, dash.mul(U.uAmt)));
      y.assign(mix(y, hash(vec2(p.x.mul(U.uRes.x).mul(0.5), line.add(frame.mul(5)))), clamp(band.mul(0.5).add(foot.mul(0.4)), 0, 1).mul(U.uAmt)));
      const c = toRGB(y, iq).mul(U.uSoft.mul(-0.05).add(1)).add(U.uSoft.mul(0.03)).toVar();
      const snow = hash(vec2(floor(p.x.mul(U.uRes.x).mul(0.5)), floor(line.mul(0.5))).add(frame.mul(13)));
      const staticLight = mix(snow.mul(0.8).add(0.06), snow.mul(0.12).add(0.008), U.uStaticDark);
      c.assign(mix(c, vec3(staticLight), U.uSnow));
      c.assign(mix(c, vec3(0), U.uBlack));
      c.assign(mix(c, vec3(1.0, 0.98, 0.93), U.uWhite));
      c.assign(mix(c, vec3(0.78, 0.025, 0.02), U.uRed));
      return vec4(clamp(c, 0, 1), 1);
    });
    const m = new N.NodeMaterial();
    m.fragmentNode = main();
    m.depthTest = false; m.depthWrite = false;
    return m;
  }

  function screenMaterial(tapeTex) {
    const S = screenNode;
    const main = Fn(() => {
      const p = up().sub(0.5).sub(S.uShift).div(S.uPicture).add(0.5).toVar();
      const out = p.x.lessThan(0).or(p.x.greaterThan(1)).or(p.y.lessThan(0)).or(p.y.greaterThan(1));
      const c = at(tapeTex, p).rgb.toVar();
      const dy = float(0.25).div(S.uLines);
      c.assign(mix(c, at(tapeTex, p.add(vec2(0, dy))).rgb.add(at(tapeTex, p.sub(vec2(0, dy))).rgb).mul(0.5), S.uSoft.mul(0.4)));
      c.mulAssign(float(1).sub(S.uScan.mul(float(0.5).sub(cos(p.y.mul(S.uLines).mul(6.28318)).mul(0.5)))));
      const q = p.sub(0.5);
      c.mulAssign(float(1).sub(S.uSoft.mul(0.36).mul(ss(0.36, 0.9, length(q.mul(vec2(1.0, 1.08)))))));
      const e = ss(0.0, 0.004, p.x).mul(ss(0.0, 0.004, p.x.oneMinus())).mul(ss(0.0, 0.005, p.y)).mul(ss(0.0, 0.005, p.y.oneMinus()));
      return select(out, vec4(0, 0, 0, 1), vec4(c.mul(mix(1, e, S.uSoft)), 1));
    });
    const m = new N.NodeMaterial();
    m.fragmentNode = main();
    m.depthTest = false; m.depthWrite = false;
    return m;
  }

  // Pipeline state: rebuilt only when profile switches depth / glow / msaa / supersample mode.
  const tapeTarget = makeFlatTarget(4, 4);
  const screenQuad = new N.QuadMesh(screenMaterial(tapeTarget.texture));
  let drawTarget = null, sceneTarget = null, resolveQuad = null, signalQuad = null;
  let glowChain = null; // { down: [{rt, quad, uTexel}], up: [{rt, quad, uTexel}] }
  let pipeKey = '';
  const size = { iw: 4, ih: 4, sw: 4, sh: 4 };
  let scene = new N.Scene();

  function disposePipeline() {
    if (sceneTarget && sceneTarget !== drawTarget) sceneTarget.dispose();
    drawTarget?.depthTexture?.dispose();
    drawTarget?.dispose();
    resolveQuad?.material?.dispose();
    signalQuad?.material?.dispose();
    if (glowChain) {
      for (const d of glowChain.down) { d.rt.dispose(); d.quad.material.dispose(); }
      for (const upStep of glowChain.up) { upStep.rt.dispose(); upStep.quad.material.dispose(); }
    }
    drawTarget = sceneTarget = resolveQuad = signalQuad = glowChain = null;
  }

  function resizeGlowTargets(sw, sh) {
    if (!glowChain) return;
    let prevW = sw, prevH = sh;
    let bw = sw, bh = sh;
    for (let i = 0; i < glowChain.down.length; i++) {
      bw = Math.max(1, Math.ceil(bw * (i === 0 ? GLOW_BLOOM.scale : 0.5)));
      bh = Math.max(1, Math.ceil(bh * (i === 0 ? GLOW_BLOOM.scale : 0.5)));
      glowChain.down[i].rt.setSize(bw, bh);
      glowChain.down[i].uTexel.value.set(1 / prevW, 1 / prevH);
      if (i < glowChain.up.length) glowChain.up[i].rt.setSize(bw, bh);
      prevW = bw; prevH = bh;
    }
    for (let i = glowChain.up.length - 1; i >= 0; i--) {
      const srcRt = glowChain.down[i + 1].rt;
      glowChain.up[i].uTexel.value.set(1 / srcRt.width, 1 / srcRt.height);
    }
  }

  function ensurePipeline(withDepth, withGlow, samples, useSuper) {
    const key = `${withDepth ? 1 : 0}/${withGlow ? 1 : 0}/${samples}/${useSuper ? 1 : 0}`;
    if (key === pipeKey && drawTarget) return;
    pipeKey = key;
    disposePipeline();
    const dw = Math.max(4, useSuper ? size.sw : size.iw);
    const dh = Math.max(4, useSuper ? size.sh : size.ih);
    const iw = Math.max(4, size.iw), ih = Math.max(4, size.ih);
    drawTarget = makeTarget(dw, dh, { samples, depth: withDepth, count: withGlow ? 2 : 1 });
    if (useSuper || withGlow) {
      sceneTarget = makeFlatTarget(iw, ih);
      if (withGlow) {
        const steps = GLOW_BLOOM.steps;
        const down = [], upArr = [];
        for (let i = 0; i < steps; i++) {
          const rt = makeFlatTarget(2, 2);
          const srcTex = i === 0 ? drawTarget.textures[1] : down[i - 1].rt.texture;
          down.push({ rt, ...downPass(srcTex) });
        }
        for (let i = 0; i < steps - 1; i++) upArr.push({ rt: makeFlatTarget(2, 2), quad: null, uTexel: null });
        for (let i = steps - 2; i >= 0; i--) {
          const fromTex = i === steps - 2 ? down[i + 1].rt.texture : upArr[i + 1].rt.texture;
          const pass = upPass(fromTex, down[i].rt.texture, GLOW_BLOOM.mix[i + 1], i === 0 ? GLOW_BLOOM.mix[0] : 1);
          upArr[i].quad = pass.quad; upArr[i].uTexel = pass.uTexel;
        }
        glowChain = { down, up: upArr };
        resizeGlowTargets(dw, dh);
      }
      const glowTex = glowChain ? (glowChain.up[0] || glowChain.down[0]).rt.texture : null;
      const emitTex = glowChain ? drawTarget.textures[1] : null;
      resolveQuad = resolvePass(drawTarget.textures[0], emitTex, glowTex, useSuper);
    } else {
      sceneTarget = drawTarget;
    }
    signalQuad = new N.QuadMesh(signalMaterial(sceneTarget.texture, withDepth ? drawTarget.depthTexture : null));
  }

  let level = opt.level ?? 2, last = '', time = 0, prof = profile('classic'), hazeK = 1;
  const picture = { x: 0, y: 0, w: 1, h: 1 };
  const glowInfo = { active: true, mrt: true, stats: { drawn: false, exact: true } };

  ensurePipeline(false, false, samplesOf(prof.msaa), false);

  function layout(w, h, top = null) {
    const ratio = renderer.getPixelRatio(), key = `${w}x${h}@${ratio}/${level}/${top ?? ''}/${prof.tier}`;
    if (key === last) return picture;
    last = key;
    const { cw, ch, pw, ph, iw, ih, sw, sh } = internalSize(w, h, ratio, level, prof);
    size.iw = iw; size.ih = ih; size.sw = sw; size.sh = sh;
    const useSuper = sw > iw, withDepth = prof.haze > 0, withGlow = prof.glow > 0;
    ensurePipeline(withDepth, withGlow, samplesOf(prof.msaa), useSuper);
    const dw = useSuper ? sw : iw, dh = useSuper ? sh : ih;
    drawTarget.setSize(dw, dh);
    if (sceneTarget !== drawTarget) sceneTarget.setSize(iw, ih);
    tapeTarget.setSize(iw, ih);
    if (drawTarget.depthTexture) Object.assign(drawTarget.depthTexture.image, { width: dw, height: dh });
    if (useSuper) uSuperStep.value.set(0.375 / iw, 0.375 / ih);
    if (glowChain) resizeGlowTargets(dw, dh);
    camera.aspect = iw / ih; camera.updateProjectionMatrix();
    u.uRes.value.set(iw, ih);
    s.uPicture.value.set(pw / cw, ph / ch);
    s.uLines.value = ih / 2;
    const perLine = ph / (ih / 2);
    s.uScan.value = level > 0 ? 0.1 * Math.max(0, Math.min(1, (perLine - 2.4) / 1.6)) * (level === 2 ? 1 : 0.5) : 0;
    const spare = h - ph / ratio, y = Number.isFinite(top) && top !== null && spare > 0 ? Math.max(0, Math.min(spare, top)) : spare / 2;
    s.uShift.value.set(0, (spare / 2 - y) / h);
    Object.assign(picture, { w: pw / ratio, h: ph / ratio, x: (w - pw / ratio) / 2, y });
    return picture;
  }
  function setLevel(next) {
    level = Math.max(0, Math.min(2, next | 0));
    u.uAmt.value = level === 2 ? 1 : 0;
    u.uSoft.value = level === 2 ? 1 : level === 1 ? 0.55 : 0;
    s.uSoft.value = level === 2 ? 1 : level === 1 ? 0.6 : 0;
    last = '';
  }
  setLevel(level);
  function setProfile(p) {
    prof = p;
    u.uGrade.value = p.grade; u.uHaze.value = p.haze * hazeK;
    ensurePipeline(p.haze > 0, p.glow > 0, samplesOf(p.msaa), size.sw > size.iw && (p.supersample || 1) > 1);
    last = '';
  }
  function setGrade(g) {
    u.uLift.value.fromArray(g.lift); u.uGamma.value.fromArray(g.gamma); u.uGainRGB.value.fromArray(g.gain); u.uSat.value = g.sat;
    u.uHazeColor.value.fromArray(g.haze);
    hazeK = Number.isFinite(g.hazeK) ? g.hazeK : 1; u.uHaze.value = prof.haze * hazeK;
    u.uHazeFrom.value = Number.isFinite(g.hazeFrom) ? g.hazeFrom : 8;
  }
  if (opt.profile) setProfile(opt.profile);

  // The tape is written as it is meant to be seen, as vhs.js's passes write it: no tone mapping or colour conversion on the
  // way to the window (WebGPURenderer would otherwise add its own output pass). Put back when the camcorder is let go.
  const outputCfg = { toneMapping: renderer.toneMapping, colorSpace: renderer.outputColorSpace };
  renderer.toneMapping = N.NoToneMapping; renderer.outputColorSpace = N.LinearSRGBColorSpace;

  return {
    picture, layout, setLevel, setProfile, setGrade, uniforms: u, bloom: null,
    get level() { return level; },
    get glow() { return glowChain ? glowInfo : null; },
    get liquids() { return null; },
    get passes() { return []; },
    get profile() { return prof; },
    /** Which renderer draws this camcorder: the node one. */
    nodes: true,
    setAmbient(light) { u.uHazeLight.value = Math.max(0, light) * HAZE_LIGHT; },
    setScene(next) { scene = next; },
    render(dt) {
      time += dt; u.uTime.value = time; u.uNear.value = camera.near; u.uFar.value = camera.far;
      copy(u, node); copy(s, screenNode);
      if (glowChain) renderer.setMRT(glowMrt);
      try {
        renderer.setRenderTarget(drawTarget);
        renderer.render(scene, camera);
      } finally {
        if (glowChain) renderer.setMRT(null);
      }
      if (glowChain) {
        for (const d of glowChain.down) { renderer.setRenderTarget(d.rt); d.quad.render(renderer); }
        for (let i = glowChain.up.length - 1; i >= 0; i--) { renderer.setRenderTarget(glowChain.up[i].rt); glowChain.up[i].quad.render(renderer); }
        glowInfo.stats.drawn = true;
      }
      if (resolveQuad) { renderer.setRenderTarget(sceneTarget); resolveQuad.render(renderer); }
      renderer.setRenderTarget(tapeTarget); signalQuad.render(renderer);
      renderer.setRenderTarget(null); screenQuad.render(renderer);
    },
    dispose() {
      disposePipeline();
      tapeTarget.dispose(); screenQuad.material.dispose();
      renderer.toneMapping = outputCfg.toneMapping; renderer.outputColorSpace = outputCfg.colorSpace;
    },
  };
}
