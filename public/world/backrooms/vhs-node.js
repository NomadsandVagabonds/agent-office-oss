// The Backrooms — the camcorder, for the WebGPU renderer (?gpu=webgpu: engine/gpu.js). The same two passes as vhs.js,
// written in three.js's node language (TSL) instead of GLSL: the SIGNAL (lines to one side, soft luma, softer and late
// chroma, noise, the tracking band, the head switch at the foot; the floor's grade and the haze) into a picture the
// tape's size, then the SCREEN (4:3 between black bars, scan lines, vignette) onto the window. Every number is vhs.js's;
// a change to the look there wants the same change here until vhs.js is this file (docs/BLOCKROOMS-WEBGPU.md).
//
// Not here yet, and so not drawn under ?gpu=webgpu whatever the tier says: the scene drawn larger than the tape
// (supersample), bloom (the tier's and the host's), the glow from what shines (glow.js), and water (liquid.js). Those
// tiers draw as Classic does, plus their grade and haze.
//
// It takes three.js's WebGPU build from engine/gpu.js (the stage put it there), so nothing on the default path loads it.
import { gpu } from '../engine/gpu.js';
import { profile, internalSize } from './graphics.js';

const HAZE_LIGHT = 1.6;                                  // (vhs.js's)

/**
 * The same interface as vhs.js createVhs, drawn with node materials. `renderer` is a WebGPURenderer.
 * @param {object} renderer
 * @param {import('three').PerspectiveCamera} camera
 * @param {{bloom?:boolean, level?:number, profile?:object}} [opt]
 */
export function createVhsNode(renderer, camera, opt = {}) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec2, vec3, vec4, float, uniform, texture, uv, fract, floor, dot, sin, cos, exp, pow, mix, clamp, step, abs, max, min, length, select } = T;

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
  // (one node uniform for each, given the plain one's value before every frame: whoever holds `uniforms` keeps writing `.value`)
  const node = {}, screenNode = {};
  const copy = (from, to) => { for (const [k, v] of Object.entries(from)) if (to[k]) { if (v.value?.isVector2 || v.value?.isVector3) to[k].value.copy(v.value); else to[k].value = v.value; } };
  for (const [k, v] of Object.entries(u)) if (k !== 'tDepth') node[k] = uniform(v.value?.clone ? v.value.clone() : v.value);
  for (const [k, v] of Object.entries(s)) screenNode[k] = uniform(v.value?.clone ? v.value.clone() : v.value);

  // the scene's picture and the tape: the tape's size, half float, multisampled as the tier says (WebGPU knows 1 and 4)
  const samplesOf = (msaa) => (msaa > 1 ? 4 : 1);
  const makeTarget = (w, h, samples, depth) => {
    const rt = new N.RenderTarget(w, h, { type: N.HalfFloatType, samples });
    if (depth) rt.depthTexture = new N.DepthTexture(w, h);
    return rt;
  };
  let sceneTarget = makeTarget(4, 4, 4, false);
  const tapeTarget = new N.RenderTarget(4, 4, { type: N.HalfFloatType });

  // (three.js's quad has v = 0 at the top of the picture; the passes below count from the bottom, as vhs.js's GLSL does)
  const up = () => vec2(uv().x, uv().y.oneMinus());
  const at = (tex, p) => texture(tex, vec2(p.x, p.y.oneMinus()));
  // smoothstep by its formula, so that the edges given high-to-low (vhs.js does) mean the same in WGSL as in GLSL
  const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };
  const LUMA = vec3(0.299, 0.587, 0.114);
  const luma = (c) => dot(c, LUMA);
  const hash = (p) => { const q = fract(vec3(p.x, p.y, p.x).mul(0.1031)); const r = q.add(dot(q, q.yzx.add(33.33))); return fract(r.x.add(r.y).mul(r.z)); };
  // (YIQ and back: vhs.js's matrices, row by row)
  const toIQ = (c) => vec2(dot(c, vec3(0.596, -0.274, -0.322)), dot(c, vec3(0.211, -0.523, 0.312)));
  const toRGB = (y, iq) => vec3(y.add(iq.x.mul(0.956)).add(iq.y.mul(0.621)), y.sub(iq.x.mul(0.272)).sub(iq.y.mul(0.647)), y.sub(iq.x.mul(1.106)).add(iq.y.mul(1.703)));

  /** The SIGNAL pass, with the haze (reading the scene's depth) or without it. */
  function signalMaterial(withDepth) {
    const U = node;
    const film = (c) => float(1).sub(exp(c.negate().mul(U.uExposure.mul(U.uGain).mul(1.3))));
    const haze = (c, p) => {
      const d = at(sceneTarget.depthTexture, p).x;
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
      let c = at(sceneTarget.texture, q).rgb;
      if (withDepth) c = select(U.uHaze.greaterThan(0), haze(c, q), c);
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

  function screenMaterial() {
    const S = screenNode;
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

  let withDepth = false;
  let signal = signalMaterial(false);
  const signalQuad = new N.QuadMesh(signal), screenQuad = new N.QuadMesh(screenMaterial());
  let scene = new N.Scene();

  let level = opt.level ?? 2, last = '', time = 0, prof = profile('classic'), hazeK = 1;
  const picture = { x: 0, y: 0, w: 1, h: 1 };
  const size = { iw: 4, ih: 4 };

  function layout(w, h, top = null) {
    const ratio = renderer.getPixelRatio(), key = `${w}x${h}@${ratio}/${level}/${top ?? ''}/${prof.tier}`;
    if (key === last) return picture;
    last = key;
    const { cw, ch, pw, ph, iw, ih } = internalSize(w, h, ratio, level, prof);
    size.iw = iw; size.ih = ih;
    sceneTarget.setSize(iw, ih); tapeTarget.setSize(iw, ih);
    if (sceneTarget.depthTexture) Object.assign(sceneTarget.depthTexture.image, { width: iw, height: ih });
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
    const depth = p.haze > 0, samples = samplesOf(p.msaa);
    if (depth !== withDepth || samples !== sceneTarget.samples) {
      sceneTarget.dispose();
      sceneTarget = makeTarget(Math.max(4, size.iw), Math.max(4, size.ih), samples, depth);
      if (depth !== withDepth) { withDepth = depth; signal.dispose(); signal = signalMaterial(depth); signalQuad.material = signal; }
      else { signal.dispose(); signal = signalMaterial(depth); signalQuad.material = signal; }   // (its textures are the new target's)
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
      renderer.setRenderTarget(sceneTarget); renderer.render(scene, camera);
      renderer.setRenderTarget(tapeTarget); signalQuad.render(renderer);
      renderer.setRenderTarget(null); screenQuad.render(renderer);
    },
    dispose() {
      sceneTarget.dispose(); tapeTarget.dispose(); signal.dispose(); screenQuad.material.dispose();
      renderer.toneMapping = output.toneMapping; renderer.outputColorSpace = output.colorSpace;
    },
  };
}
