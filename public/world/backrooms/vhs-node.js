// The Backrooms — the camcorder, for the WebGPU renderer (?gpu=webgpu: engine/gpu.js). The same two passes as vhs.js,
// written in three.js's node language (TSL) instead of GLSL: the SIGNAL (lines to one side, soft luma, softer and late
// chroma, noise, the tracking band, the head switch at the foot; the floor's grade and the haze) into a picture the
// tape's size, then the SCREEN (4:3 between black bars, scan lines, vignette) onto the window. Every number is vhs.js's;
// a change to the look there wants the same change here until vhs.js is this file (docs/BLOCKROOMS-WEBGPU.md).
//
// The scene drawn larger than the tape (supersample: Medium, High) and brought down with vhs.js's tent is here too, and
// so is the glow from what shines (glow.js, Medium and High: glow-node.js, from the scene pass's second picture).
// Water (liquid.js, Medium and High) is liquid-node.js: one pass, the water reading three.js's copies of the picture.
// Not here yet, and so not drawn under ?gpu=webgpu whatever the tier says: the tier's and the host's plain bloom (only
// the office's Classic has it).
//
// It takes three.js's WebGPU build from engine/gpu.js (the stage put it there), so nothing on the default path loads it.
import { gpu } from '../engine/gpu.js';
import { profile, internalSize } from './graphics.js';
import { GLOW_BLOOM } from './glow.js';
import { createGlowChain, sceneGlowMRT, glowPass } from './glow-node.js';
import { createLiquidViewNode } from './liquid-node.js';

const HAZE_LIGHT = 1.6;                                  // (vhs.js's)

/**
 * The same interface as vhs.js createVhs, drawn with node materials. `renderer` is a WebGPURenderer.
 * @param {object} renderer
 * @param {import('three').PerspectiveCamera} camera
 * @param {{bloom?:boolean, level?:number, profile?:object}} [opt]
 */
export function createVhsNode(renderer, camera, opt = {}) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, If, vec2, vec3, vec4, float, uniform, texture, uv, fract, floor, dot, sin, cos, exp, pow, mix, clamp, step, abs, max, min, length, select } = T;

  // the uniforms, as vhs.js has them (index.js and the rooms set these by name: uBlack, uSnow, uWhite, uRed, uTrack...)
  // Node uniforms expose `.value` directly (and tDepth stays a plain holder), so no per-frame copy is needed.
  const u = {
    uRes: uniform(new N.Vector2(640, 480)), uTime: uniform(0),
    uAmt: uniform(1), uSoft: uniform(1), uTrack: uniform(0), uGain: uniform(1), uExposure: uniform(1),
    uBalance: uniform(new N.Vector3(1, 1, 1)), uDefocus: uniform(0),
    uBlack: uniform(0), uWhite: uniform(0), uRed: uniform(0), uSnow: uniform(0), uStaticDark: uniform(0), uRoll: uniform(0),
    uGrade: uniform(0), uHaze: uniform(0),
    uLift: uniform(new N.Vector3(0, 0, 0)), uGamma: uniform(new N.Vector3(1, 1, 1)), uGainRGB: uniform(new N.Vector3(1, 1, 1)), uSat: uniform(1),
    tDepth: { value: null }, uNear: uniform(0.06), uFar: uniform(170), uHazeColor: uniform(new N.Vector3(0.8, 0.78, 0.72)), uHazeLight: uniform(0.3),
    uHazeFrom: uniform(8),
  };
  const s = { uPicture: uniform(new N.Vector2(1, 1)), uShift: uniform(new N.Vector2(0, 0)), uSoft: uniform(1), uLines: uniform(240), uScan: uniform(0.08) };

  // the scene's picture and the tape: the tape's size, half float, multisampled as the tier says (WebGPU knows 1 and 4)
  const samplesOf = (msaa) => (msaa > 1 ? 4 : 1);
  const makeTarget = (w, h, samples, depth, count = 1) => {
    const rt = new N.RenderTarget(w, h, { type: N.HalfFloatType, samples, count });
    rt.textures[0].name = 'output'; if (count > 1) rt.textures[1].name = 'emissive';     // (the glow's MRT, by name)
    if (depth) rt.depthTexture = new N.DepthTexture(w, h);
    return rt;
  };
  let sceneTarget = makeTarget(4, 4, 4, false);
  // Signal already outputs tone-mapped, gamma-encoded [0, 1] colour, so UnsignedByteType halves tapeTarget bandwidth.
  const tapeTarget = new N.RenderTarget(4, 4, { type: N.UnsignedByteType });
  // (supersample: the scene is drawn sw × sh into sceneTarget, and the tent brings it down into this, the tape's size)
  const downTarget = new N.RenderTarget(4, 4, { type: N.HalfFloatType });
  const uStep = uniform(new N.Vector2(0.375 / 640, 0.375 / 480));
  let supersampled = false;
  // (the glow: while a tier has it, the scene pass writes a second picture of what shines, and glow-node.js's chain
  // adds its bloom to the picture the signal reads)
  let glowOn = false, chain = null, glowMRT = null;
  let liquids = null;                                    // (the water's view while a tier has water: liquid-node.js)
  const routed = () => supersampled || glowOn;

  // (three.js's quad has v = 0 at the top of the picture; the passes below count from the bottom, as vhs.js's GLSL does)
  const up = () => vec2(uv().x, uv().y.oneMinus());
  const at = (tex, p) => texture(tex, vec2(p.x, p.y.oneMinus()));
  // smoothstep by its formula, so that the edges given high-to-low (vhs.js does) mean the same in WGSL as in GLSL
  const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1).toVar(); return t.mul(t).mul(t.mul(-2).add(3)); };
  const LUMA = vec3(0.299, 0.587, 0.114);
  const luma = (c) => dot(c, LUMA);
  const hash = Fn(([p]) => {
    const q = fract(vec3(p.x, p.y, p.x).mul(0.1031)).toVar();
    const r = q.add(dot(q, q.yzx.add(33.33))).toVar();
    return fract(r.x.add(r.y).mul(r.z));
  });
  // (YIQ and back: vhs.js's matrices, row by row)
  const toIQ = (c) => { const v = c.toVar(); return vec2(dot(v, vec3(0.596, -0.274, -0.322)), dot(v, vec3(0.211, -0.523, 0.312))); };
  const toRGB = (y, iq) => vec3(y.add(iq.x.mul(0.956)).add(iq.y.mul(0.621)), y.sub(iq.x.mul(0.272)).sub(iq.y.mul(0.647)), y.sub(iq.x.mul(1.106)).add(iq.y.mul(1.703)));

  /** The SIGNAL pass, with the haze (reading the scene's depth) or without it. */
  function signalMaterial(withDepth) {
    const U = u;
    const film = (c) => {
      const sv = float(1).sub(exp(c.mul(U.uBalance).negate().mul(U.uExposure.mul(U.uGain).mul(1.3)))).toVar();
      const over = max(U.uExposure.sub(1.05), 0);
      const t = clamp(sv.sub(0.28).div(0.60), 0, 1).toVar();
      const knee = t.mul(t).mul(t.mul(-2).add(3));
      return clamp(sv.add(knee.mul(over.mul(0.44))), 0, 1);
    };
    const srcTex = routed() ? downTarget.texture : sceneTarget.texture;
    const sampleOptical = Fn(([q]) => {
      const out = at(srcTex, q).rgb.toVar();
      If(U.uDefocus.greaterThan(0.001), () => {
        const r = vec2(U.uRes.y.div(max(U.uRes.x, 1)), 1).mul(U.uDefocus.mul(0.0058)).toVar();
        const d = r.mul(0.56).toVar();
        const tap = (dx, dy) => at(srcTex, clamp(q.add(vec2(dx, dy)), 0.001, 0.999)).rgb;
        out.assign(
          out.mul(0.20)
            .add(tap(r.x, 0).add(tap(r.x.negate(), 0)).add(tap(0, r.y)).add(tap(0, r.y.negate())).mul(0.09))
            .add(tap(d.x, d.y).add(tap(d.x.negate(), d.y)).add(tap(d.x, d.y.negate())).add(tap(d.x.negate(), d.y.negate())).mul(0.11))
        );
      });
      return out;
    });
    const haze = (c, p) => {
      const d = at(sceneTarget.depthTexture, p).x.toVar();
      const z = U.uNear.mul(U.uFar).div(U.uFar.sub(d.mul(U.uFar.sub(U.uNear))));
      const k = float(1).sub(exp(max(z.sub(U.uHazeFrom), 0).mul(-0.05))).mul(0.5).mul(U.uHaze);
      const l = luma(c).toVar();
      const air = U.uHazeColor.div(max(luma(U.uHazeColor), 0.001)).mul(l).mul(1.08).add(U.uHazeColor.mul(min(U.uHazeLight, l)).mul(0.3));
      return select(d.greaterThanEqual(0.99999), c, mix(c, air, k));
    };
    const grade = (c) => {
      const g0 = pow(max(c.mul(U.uGainRGB).add(U.uLift.mul(c.oneMinus())), 0), vec3(1).div(U.uGamma)).toVar();
      const g = mix(vec3(luma(g0)), g0, U.uSat).toVar();
      return mix(c, g, U.uGrade);
    };
    const seeRaw = Fn(([p]) => {
      const q = clamp(p, 0.001, 0.999).toVar();
      const c = at(srcTex, q).rgb.toVar();
      if (withDepth) If(U.uHaze.greaterThan(0), () => { c.assign(haze(c, q)); });
      c.assign(pow(film(c), vec3(0.4545)));
      If(U.uGrade.greaterThan(0), () => { c.assign(grade(c)); });
      return c;
    });
    const see = Fn(([p]) => {
      const q = clamp(p, 0.001, 0.999).toVar();
      const c = sampleOptical(q).toVar();
      if (withDepth) If(U.uHaze.greaterThan(0), () => { c.assign(haze(c, q)); });
      c.assign(pow(film(c), vec3(0.4545)));
      If(U.uGrade.greaterThan(0), () => { c.assign(grade(c)); });
      return c;
    });
    const main = Fn(() => {
      const p = up().toVar();
      p.y.assign(fract(p.y.add(U.uRoll)));
      const line = floor(p.y.mul(U.uRes.y)).toVar(), frame = floor(U.uTime.mul(30)).toVar();
      const wob = hash(vec2(line, frame)).sub(0.5).mul(0.0015).add(sin(p.y.mul(7).add(U.uTime.mul(1.3))).mul(0.0006)).toVar();
      const bandAt = fract(U.uTime.mul(0.045).add(0.2));
      const band = ss(0.045, 0.0, abs(p.y.sub(bandAt))).mul(U.uTrack.add(0.12)).toVar();
      wob.addAssign(band.mul(hash(vec2(line.mul(1.7), frame)).sub(0.5)).mul(0.05));
      const rows = floor(p.y.mul(14)).toVar();
      wob.addAssign(U.uTrack.mul(hash(vec2(frame, rows)).sub(0.5)).mul(0.012).mul(step(0.6, hash(vec2(rows, frame.mul(0.5))))));
      const foot = ss(0.028, 0.0, p.y).toVar();
      wob.addAssign(foot.mul(sin(U.uTime.mul(2).add(line.mul(0.7))).mul(0.012).add(0.018)));
      p.x.addAssign(wob.mul(U.uAmt));

      const px = U.uSoft.div(U.uRes.x).toVar();
      const side = (k) => vec2(px.mul(k), 0);
      const c0 = see(p).toVar();
      const y = luma(c0).toVar();
      const iq = toIQ(c0).toVar();
      If(U.uSoft.greaterThan(0.001), () => {
        y.assign(y.mul(0.5).add(luma(seeRaw(p.add(side(1.25)))).add(luma(seeRaw(p.sub(side(1.25))))).mul(0.25)));
        iq.assign(
          iq.mul(0.26)
            .add(toIQ(seeRaw(p.sub(side(2.5)))).mul(0.28))
            .add(toIQ(seeRaw(p.sub(side(5.0)))).mul(0.22))
            .add(toIQ(seeRaw(p.sub(side(7.5)))).mul(0.15))
            .add(toIQ(seeRaw(p.sub(side(10.5)))).mul(0.09))
            .mul(U.uSoft.mul(0.16).add(1))
        );
      });
      const grain = U.uAmt.mul(U.uGain.sub(1).mul(0.9).add(0.6).add(U.uTrack.mul(1.5))).toVar();
      y.addAssign(hash(vec2(p.x.mul(U.uRes.x), line).add(frame.mul(17))).sub(0.5).mul(0.06).mul(grain));
      const cell = vec2(floor(p.x.mul(U.uRes.x).div(6)), line).toVar();
      iq.addAssign(vec2(hash(cell.add(frame.mul(3))), hash(cell.add(71).add(frame.mul(7)))).sub(0.5).mul(0.045).mul(grain));
      const at0 = hash(vec2(frame, line)).toVar();
      const dash = step(U.uTrack.mul(-0.006).add(0.9994), hash(vec2(line, frame.mul(1.3)))).mul(step(at0, p.x)).mul(step(p.x, at0.add(0.06)));
      y.assign(mix(y, 0.92, dash.mul(U.uAmt)));
      y.assign(mix(y, hash(vec2(p.x.mul(U.uRes.x).mul(0.5), line.add(frame.mul(5)))), clamp(band.mul(0.5).add(foot.mul(0.4)), 0, 1).mul(U.uAmt)));
      const c = toRGB(y, iq).mul(U.uSoft.mul(-0.05).add(1)).add(U.uSoft.mul(0.03)).toVar();
      const snow = hash(vec2(floor(p.x.mul(U.uRes.x).mul(0.5)), floor(line.mul(0.5))).add(frame.mul(13))).toVar();
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

  function screenMaterial() {
    const S = s;
    const main = Fn(() => {
      const p = up().sub(0.5).sub(S.uShift).div(S.uPicture).add(0.5).toVar();
      const out = p.x.lessThan(0).or(p.x.greaterThan(1)).or(p.y.lessThan(0)).or(p.y.greaterThan(1));
      const c = at(tapeTarget.texture, p).rgb.toVar();
      const dy = float(0.25).div(S.uLines);
      c.assign(mix(c, at(tapeTarget.texture, p.add(vec2(0, dy))).rgb.add(at(tapeTarget.texture, p.sub(vec2(0, dy))).rgb).mul(0.5), S.uSoft.mul(0.4)));
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

  /** vhs.js SupersamplePass: four bilinear taps, each a little under half a tape pixel from the middle. */
  function tentMaterial() {
    const main = Fn(() => {
      const p = up(), t = sceneTarget.texture;
      const c = at(t, p.add(vec2(uStep.x.negate(), uStep.y.negate()))).rgb.add(at(t, p.add(vec2(uStep.x, uStep.y.negate()))).rgb)
        .add(at(t, p.add(vec2(uStep.x.negate(), uStep.y))).rgb).add(at(t, p.add(vec2(uStep.x, uStep.y))).rgb);
      return vec4(c.mul(0.25), 1);
    });
    const m = new N.NodeMaterial();
    m.fragmentNode = main();
    m.depthTest = false; m.depthWrite = false;
    return m;
  }
  let withDepth = false;
  let signal = signalMaterial(false);
  const tentQuad = new N.QuadMesh(tentMaterial());
  const copyMaterial = () => { const m = new N.NodeMaterial(); m.fragmentNode = Fn(() => vec4(texture(sceneTarget.texture, uv()).rgb, 1))(); m.depthTest = false; m.depthWrite = false; return m; };
  const copyQuad = new N.QuadMesh(copyMaterial());
  // (the passes hold the targets' textures: made again when a target is, or when supersampling starts or stops)
  function remake() {
    signal.dispose(); signal = signalMaterial(withDepth); signalQuad.material = signal;
    tentQuad.material.dispose(); tentQuad.material = tentMaterial();
    copyQuad.material.dispose(); copyQuad.material = copyMaterial();
  }
  const signalQuad = new N.QuadMesh(signal), screenQuad = new N.QuadMesh(screenMaterial());
  let scene = new N.Scene();

  let level = opt.level ?? 2, last = '', time = 0, prof = profile('classic'), hazeK = 1;
  const picture = { x: 0, y: 0, w: 1, h: 1 };
  const size = { iw: 4, ih: 4, sw: 4, sh: 4 };

  function layout(w, h, top = null) {
    const ratio = renderer.getPixelRatio(), key = `${w}x${h}@${ratio}/${level}/${top ?? ''}/${prof.tier}`;
    if (key === last) return picture;
    last = key;
    const { cw, ch, pw, ph, iw, ih, sw, sh } = internalSize(w, h, ratio, level, prof);
    size.iw = iw; size.ih = ih; size.sw = sw; size.sh = sh;
    sceneTarget.setSize(sw, sh); tapeTarget.setSize(iw, ih); downTarget.setSize(iw, ih);
    if (sceneTarget.depthTexture) Object.assign(sceneTarget.depthTexture.image, { width: sw, height: sh });
    uStep.value.set(0.375 / iw, 0.375 / ih);
    chain?.resize(sw, sh);
    if ((sw > iw) !== supersampled) { supersampled = sw > iw; remake(); }
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
    if (p.water > 0 && !liquids) liquids = createLiquidViewNode();
    else if (!(p.water > 0) && liquids) { liquids.release(scene); liquids = null; }
    liquids?.setLevel(p.water);
    const depth = p.haze > 0, samples = samplesOf(p.msaa), glow = p.glow > 0;
    if (glow && !chain) { chain = createGlowChain(GLOW_BLOOM); glowMRT = sceneGlowMRT(); chain.resize(size.sw, size.sh); }
    else if (!glow && chain) { chain.dispose(); chain = null; glowMRT = null; }
    if (depth !== withDepth || samples !== sceneTarget.samples || glow !== glowOn) {
      glowOn = glow;
      sceneTarget.depthTexture?.dispose();
      sceneTarget.dispose();
      sceneTarget = makeTarget(Math.max(4, size.sw), Math.max(4, size.sh), samples, depth, glow ? 2 : 1);
      withDepth = depth; remake();                                                   // (its textures are the new target's)
    }
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
  const output = { toneMapping: renderer.toneMapping, colorSpace: renderer.outputColorSpace };
  renderer.toneMapping = N.NoToneMapping; renderer.outputColorSpace = N.LinearSRGBColorSpace;

  return {
    picture, layout, setLevel, setProfile, setGrade, uniforms: u, bloom: null,
    get level() { return level; },
    get glow() { return null; },
    get liquids() { return liquids; },
    get passes() { return []; },
    get profile() { return prof; },
    /** Which renderer draws this camcorder: the node one. */
    nodes: true,
    setAmbient(light) { u.uHazeLight.value = Math.max(0, light) * HAZE_LIGHT; },
    setScene(next) { scene = next; },
    /** Pre-compile WebGPU pipelines for `targetScene` into the live sceneTarget + glowMRT layout so crossing doorways never stalls. */
    async warm(targetScene) {
      if (!targetScene || typeof renderer.compileAsync !== 'function') return;
      const wasRT = renderer.getRenderTarget?.() ?? null;
      const wasMRT = renderer.getMRT?.() ?? null;
      const wasGlow = glowPass.on;
      const culled = [];
      targetScene.traverse((o) => {
        if (o.isMesh && o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
      });
      let restored = false;
      const restore = () => {
        if (restored) return;
        restored = true;
        for (const o of culled) o.frustumCulled = true;
        renderer.setMRT?.(wasMRT);
        glowPass.on = wasGlow;
        renderer.setRenderTarget(wasRT);
      };
      renderer.setRenderTarget(sceneTarget);
      if (glowOn) {
        renderer.setMRT?.(glowMRT);
        glowPass.on = true;
      }
      try {
        const p = renderer.compileAsync(targetScene, camera);
        if (renderer._initialized) restore();
        await p;
      } catch { /* ignore if device lost or backend not initialized yet */ } finally {
        restore();
      }
    },
    render(dt) {
      time += dt; u.uTime.value = time; u.uNear.value = camera.near; u.uFar.value = camera.far;
      liquids?.frame(scene, camera, time);
      renderer.setRenderTarget(sceneTarget);
      if (glowOn) { renderer.setMRT(glowMRT); glowPass.on = true; try { renderer.render(scene, camera); } finally { glowPass.on = false; renderer.setMRT(null); } }
      else renderer.render(scene, camera);
      liquids?.after();
      if (supersampled) { renderer.setRenderTarget(downTarget); tentQuad.render(renderer); }
      else if (glowOn) { renderer.setRenderTarget(downTarget); copyQuad.render(renderer); }
      if (glowOn) chain.render(renderer, sceneTarget.textures[1], downTarget);
      renderer.setRenderTarget(tapeTarget); signalQuad.render(renderer);
      renderer.setRenderTarget(null); screenQuad.render(renderer);
    },
    dispose() {
      liquids?.release(scene); liquids = null;
      sceneTarget.depthTexture?.dispose(); sceneTarget.dispose(); tapeTarget.dispose(); downTarget.dispose(); signal.dispose(); tentQuad.material.dispose(); copyQuad.material.dispose(); chain?.dispose(); screenQuad.material.dispose();
      renderer.toneMapping = output.toneMapping; renderer.outputColorSpace = output.colorSpace;
    },
  };
}
