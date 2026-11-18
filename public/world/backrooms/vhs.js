// The Backrooms — the camcorder. The level is drawn small (a few hundred
// lines, like the tape it pretends to be), then two passes turn it into
// home video: first the SIGNAL — each line a little to one side of where it
// should be, luma soft, colour softer still and smeared to the right, noise
// that gets worse in the dark, a band of bad tracking, a ragged bottom edge —
// then the SCREEN: a 4:3 picture between black bars, scan lines, a vignette.
// setLevel(2) is the full effect, 1 keeps the frame and softness but holds
// the picture still and quiet, 0 is a clean full-window image.
import * as THREE from 'three';
import { EffectComposer } from '/vendor/three-addons/postprocessing/EffectComposer.js';
import { RenderPass } from '/vendor/three-addons/postprocessing/RenderPass.js';
import { ShaderPass } from '/vendor/three-addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '/vendor/three-addons/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from '/vendor/three-addons/postprocessing/Pass.js';
import { profile, bloomOn, internalSize } from './graphics.js';
import { GlowPass } from './glow.js';
import { createLiquidView } from './liquid.js';

const HAZE_LIGHT = 1.6;                                  // the haze's brightness for each unit of the room's light

const QUAD = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const Signal = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(640, 480) }, uTime: { value: 0 },
    uAmt: { value: 1 }, uSoft: { value: 1 }, uTrack: { value: 0 }, uGain: { value: 1 }, uExposure: { value: 1 },
    uBlack: { value: 0 }, uWhite: { value: 0 }, uRed: { value: 0 }, uSnow: { value: 0 }, uStaticDark: { value: 0 }, uRoll: { value: 0 },
    // the Graphics setting (graphics.js): both 0 at Classic, and then the picture is exactly what it was before them
    uGrade: { value: 0 }, uHaze: { value: 0 },
    uLift: { value: new THREE.Vector3(0, 0, 0) }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGainRGB: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 },
    tDepth: { value: null }, uNear: { value: 0.06 }, uFar: { value: 170 }, uHazeColor: { value: new THREE.Vector3(0.8, 0.78, 0.72) }, uHazeLight: { value: 0.3 },
    uHazeFrom: { value: 8 },                             // (where the haze begins, m: the kind of floor's, graphics.js gradeOf)
  },
  vertexShader: QUAD,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uRes;
    uniform float uTime, uAmt, uSoft, uTrack, uGain, uExposure, uBlack, uWhite, uRed, uSnow, uStaticDark, uRoll;
    uniform float uGrade, uHaze, uSat, uNear, uFar, uHazeLight, uHazeFrom; uniform vec3 uLift, uGamma, uGainRGB, uHazeColor; uniform sampler2D tDepth;
    varying vec2 vUv;
    const mat3 YIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
    const mat3 RGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    // a gentle shoulder: bright things wash out toward white, the way cheap video does
    vec3 film(vec3 c) { return 1.0 - exp(-c * (1.3 * uExposure * uGain)); }
    // the air: nothing nearer than uHazeFrom (8 m unless the kind of floor says), then exponentially toward the floor's colour; never more than about half way.
    // The air is only as bright as what is behind it (and the room it hangs in): a dark end of a corridor stays dark,
    // it is not fogged grey. Where nothing was drawn (the depth is the far plane) it is left alone: the void stays black
    vec3 haze(vec3 c, vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      if (d >= 0.99999) return c;
      float z = uNear * uFar / (uFar - d * (uFar - uNear));
      float k = (1.0 - exp(-max(z - uHazeFrom, 0.0) * 0.05)) * 0.5 * uHaze;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 air = uHazeColor / max(dot(uHazeColor, vec3(0.299, 0.587, 0.114)), 0.001) * l * 1.08 + uHazeColor * min(uHazeLight, l) * 0.3;
      return mix(c, air, k);
    }
    // the floor's grade (themes.js), on the picture as seen: lift into the shadows, gain on the highlights, gamma, saturation
    vec3 grade(vec3 c) {
      vec3 g = pow(max(c * uGainRGB + uLift * (1.0 - c), 0.0), 1.0 / uGamma);
      g = mix(vec3(dot(g, vec3(0.299, 0.587, 0.114))), g, uSat);
      return mix(c, g, uGrade);
    }
    vec3 see(vec2 uv) {
      vec2 at = clamp(uv, 0.001, 0.999);
      vec3 c = texture2D(tDiffuse, at).rgb;
      if (uHaze > 0.0) c = haze(c, at);
      c = pow(film(c), vec3(0.4545));
      if (uGrade > 0.0) c = grade(c);
      return c;
    }
    void main() {
      vec2 uv = vUv;
      uv.y = fract(uv.y + uRoll);
      float line = floor(uv.y * uRes.y), frame = floor(uTime * 30.0);
      // every line sits a little to one side of where it should
      float wob = (hash(vec2(line, frame)) - 0.5) * 0.0015 + sin(uv.y * 7.0 + uTime * 1.3) * 0.0006;
      // a band of bad tracking drifts up the picture; worse when something is interfering
      float bandAt = fract(uTime * 0.045 + 0.2);
      float band = smoothstep(0.045, 0.0, abs(uv.y - bandAt)) * (0.12 + uTrack);
      wob += band * (hash(vec2(line * 1.7, frame)) - 0.5) * 0.05;
      wob += uTrack * (hash(vec2(frame, floor(uv.y * 14.0))) - 0.5) * 0.012 * step(0.6, hash(vec2(floor(uv.y * 14.0), frame * 0.5)));
      // the head switch: the bottom few lines never line up
      float foot = smoothstep(0.028, 0.0, uv.y);
      wob += foot * (0.018 + 0.012 * sin(uTime * 2.0 + line * 0.7));
      uv.x += wob * uAmt;

      float px = uSoft / uRes.x;
      vec3 c0 = see(uv);
      vec3 q0 = YIQ * c0;
      // luma: soft; chroma: softer, and late — it lands to the right of where it belongs
      float y = q0.x * 0.5 + 0.25 * (dot(see(uv + vec2(px * 1.25, 0.0)), vec3(0.299, 0.587, 0.114)) + dot(see(uv - vec2(px * 1.25, 0.0)), vec3(0.299, 0.587, 0.114)));
      vec2 iq = q0.yz * 0.26;
      iq += (YIQ * see(uv - vec2(px * 2.5, 0.0))).yz * 0.28;
      iq += (YIQ * see(uv - vec2(px * 5.0, 0.0))).yz * 0.22;
      iq += (YIQ * see(uv - vec2(px * 7.5, 0.0))).yz * 0.15;
      iq += (YIQ * see(uv - vec2(px * 10.5, 0.0))).yz * 0.09;
      iq *= 1.0 + 0.16 * uSoft;
      // noise: fine in the brightness, coarse in the colour, both worse when the gain is up
      float grain = uAmt * (0.6 + 0.9 * (uGain - 1.0) + 1.5 * uTrack);
      y += (hash(vec2(uv.x * uRes.x, line) + frame * 17.0) - 0.5) * 0.06 * grain;
      vec2 cell = vec2(floor(uv.x * uRes.x / 6.0), line);
      iq += (vec2(hash(cell + frame * 3.0), hash(cell + 71.0 + frame * 7.0)) - 0.5) * 0.045 * grain;
      // dropouts: short white dashes
      float at = hash(vec2(frame, line));
      float dash = step(0.9994 - 0.006 * uTrack, hash(vec2(line, frame * 1.3))) * step(at, uv.x) * step(uv.x, at + 0.06);
      y = mix(y, 0.92, dash * uAmt);
      y = mix(y, hash(vec2(uv.x * uRes.x * 0.5, line + frame * 5.0)), clamp(band * 0.5 + foot * 0.4, 0.0, 1.0) * uAmt);
      vec3 c = RGB * vec3(y, iq);
      c = c * (1.0 - 0.05 * uSoft) + 0.03 * uSoft;                 // blacks never quite black
      float snow = hash(vec2(floor(uv.x * uRes.x * 0.5), floor(line * 0.5)) + frame * 13.0);
      // Losing power leaves dim noise, not a bright full-screen flash.
      float staticLight = mix(snow * 0.8 + 0.06, snow * 0.12 + 0.008, uStaticDark);
      c = mix(c, vec3(staticLight), uSnow);
      c = mix(c, vec3(0.0), uBlack);
      c = mix(c, vec3(1.0, 0.98, 0.93), uWhite);
      c = mix(c, vec3(0.78, 0.025, 0.02), uRed);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const Screen = {
  // uPicture: how much of the window the picture takes, each way · uShift: how far its middle is from the window's, in windows (y up)
  uniforms: { tDiffuse: { value: null }, uPicture: { value: new THREE.Vector2(1, 1) }, uShift: { value: new THREE.Vector2(0, 0) }, uSoft: { value: 1 }, uLines: { value: 240 }, uScan: { value: 0.08 } },
  vertexShader: QUAD,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uPicture, uShift; uniform float uSoft, uLines, uScan;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5 - uShift) / uPicture + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
      vec3 c = texture2D(tDiffuse, p).rgb;
      float dy = 0.25 / uLines;
      c = mix(c, 0.5 * (texture2D(tDiffuse, p + vec2(0.0, dy)).rgb + texture2D(tDiffuse, p - vec2(0.0, dy)).rgb), 0.4 * uSoft);
      c *= 1.0 - uScan * (0.5 - 0.5 * cos(p.y * uLines * 6.28318));
      vec2 q = p - 0.5;
      c *= 1.0 - 0.36 * uSoft * smoothstep(0.36, 0.9, length(q * vec2(1.0, 1.08)));
      float e = smoothstep(0.0, 0.004, p.x) * smoothstep(0.0, 0.004, 1.0 - p.x) * smoothstep(0.0, 0.005, p.y) * smoothstep(0.0, 0.005, 1.0 - p.y);
      gl_FragColor = vec4(c * mix(1.0, e, uSoft), 1.0);
    }`,
};

/**
 * The scene drawn larger than the tape (graphics.js `supersample`) and brought down to the tape's size with a small tent
 * filter: what a camera with a good lens records onto a soft medium. Only on while a tier asks for it; otherwise the
 * RenderPass draws the scene at the tape's size, as it always did.
 */
class SupersamplePass extends Pass {
  constructor(camera) {
    super();
    // (an empty scene until setScene, as the RenderPass has: a tier that starts supersampled may draw before anything has landed)
    this.needsSwap = false; this.enabled = false; this.scene = new THREE.Scene(); this.camera = camera;
    this.draw = null;                                      // (water, liquid.js: the scene in two parts, while a surface is in view)
    this.target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.material = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, uStep: { value: new THREE.Vector2() } }, vertexShader: QUAD, depthTest: false, depthWrite: false,
      fragmentShader: `
        uniform sampler2D tScene; uniform vec2 uStep; varying vec2 vUv;
        // four bilinear taps, each a little under half a tape pixel from the middle: a tent over the scene's pixels
        void main() {
          vec3 c = texture2D(tScene, vUv + vec2(-uStep.x, -uStep.y)).rgb + texture2D(tScene, vUv + vec2(uStep.x, -uStep.y)).rgb
                 + texture2D(tScene, vUv + vec2(-uStep.x, uStep.y)).rgb + texture2D(tScene, vUv + vec2(uStep.x, uStep.y)).rgb;
          gl_FragColor = vec4(c * 0.25, 1.0);
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  setSize() {}                                           // (its own size is set by layout(), not by the composer)
  resize(sw, sh, iw, ih) { this.target.setSize(sw, sh); this.material.uniforms.uStep.value.set(0.375 / iw, 0.375 / ih); }
  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.target); renderer.clear();
    if (this.draw) this.draw(renderer, this.target, () => renderer.render(this.scene, this.camera)); else renderer.render(this.scene, this.camera);
    this.material.uniforms.tScene.value = this.target.texture;
    renderer.setRenderTarget(readBuffer); this.quad.render(renderer);
  }
  dispose() { this.target.depthTexture?.dispose(); this.target.dispose(); this.material.dispose(); this.quad.dispose(); }
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PerspectiveCamera} camera
 * @param {{bloom?:boolean, level?:number, profile?:object}} [opt]  bloom: whether the host has bloom (Classic follows it)
 *        profile: graphics.js profile(tier); Classic if none
 */
export function createVhs(renderer, camera, opt = {}) {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  const renderPass = new RenderPass(new THREE.Scene(), camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
  const hostBloom = opt.bloom !== false;
  bloom.enabled = hostBloom;
  const signal = new ShaderPass(Signal), screen = new ShaderPass(Screen);
  const superPass = new SupersamplePass(camera);           // (off unless a tier draws the scene larger than the tape)
  composer.addPass(renderPass); composer.addPass(superPass); composer.addPass(bloom); composer.addPass(signal); composer.addPass(screen);
  const u = signal.uniforms, s = screen.uniforms;
  // (the haze reads the depth of whatever the scene was drawn into, when there is one)
  const signalRender = signal.render.bind(signal);
  signal.render = (r, write, read, dt, mask) => {
    u.tDepth.value = (superPass.enabled ? superPass.target.depthTexture : read.depthTexture) || null; u.uNear.value = camera.near; u.uFar.value = camera.far;
    signalRender(r, write, read, dt, mask);
  };
  let level = opt.level ?? 2, last = '', time = 0, prof = profile('classic');
  let hazeK = 1;                                         // (the kind of floor's share of the tier's haze: setGrade)
  let glow = null;                                       // (bloom from what shines, glow.js: made only while a tier's glow is on)
  const sceneDepth = (read) => (superPass.enabled ? superPass.target.depthTexture : read.depthTexture) || null;
  const picture = { x: 0, y: 0, w: 1, h: 1 };            // where the picture sits in the window, CSS pixels
  // --- water ---
  // (liquid.js: made only while a tier's water is on. While a surface of a part that is up has been in view in the last
  // half second, the scene is drawn in two parts, the opaque first and the water over a copy of it; otherwise, and
  // always at 0, the scene's pass is the one it always was. At 2 (High) the two-part draw begins with the mirror: the
  // room drawn once more, mirrored about the nearest surface in view, into a picture of the view's own at half the
  // scene's size, before anything is drawn into the scene's target; liquid.js mirrorPass)
  let liquids = null, split = false;
  const drawScene = (r, target, under) => (split && liquids ? liquids.draw(r, renderPass.scene, camera, target, under) : under());
  superPass.draw = drawScene;
  const renderPassRender = renderPass.render.bind(renderPass);
  renderPass.render = (r, write, read, dt, mask) => drawScene(r, read, () => renderPassRender(r, write, read, dt, mask));
  // --- end water ---

  /**
   * Fit the picture to the window. w, h in CSS pixels. `top`: where its top edge goes, px from the window's (a phone held
   * upright has the picture at the top and its thumbs under it); with none, or no room to spare, it sits in the middle.
   */
  function layout(w, h, top = null) {
    const ratio = renderer.getPixelRatio(), key = `${w}x${h}@${ratio}/${level}/${top ?? ''}/${prof.tier}`;
    if (key === last) return picture;
    last = key;
    // a 4:3 picture a few hundred lines tall (levels 2 and 1), or the whole window (0): graphics.js internalSize
    const { cw, ch, pw, ph, iw, ih, sw, sh } = internalSize(w, h, ratio, level, prof);
    composer.setSize(iw, ih);
    superPass.enabled = sw > iw; renderPass.enabled = !superPass.enabled;
    if (superPass.enabled) superPass.resize(sw, sh, iw, ih);
    if (glow) glow.resize(sw, sh);
    for (const rt of [composer.renderTarget1, composer.renderTarget2, superPass.target]) if (rt.depthTexture) Object.assign(rt.depthTexture.image, { width: rt.width, height: rt.height });
    camera.aspect = iw / ih; camera.updateProjectionMatrix();
    u.uRes.value.set(iw, ih);
    s.uPicture.value.set(pw / cw, ph / ch);
    s.uLines.value = ih / 2;
    const perLine = ph / (ih / 2);                       // screen pixels per scan-line pair: too few and they would shimmer
    s.uScan.value = level > 0 ? 0.1 * Math.max(0, Math.min(1, (perLine - 2.4) / 1.6)) * (level === 2 ? 1 : 0.5) : 0;
    const spare = h - ph / ratio, y = Number.isFinite(top) && top !== null && spare > 0 ? Math.max(0, Math.min(spare, top)) : spare / 2;
    s.uShift.value.set(0, (spare / 2 - y) / h);            // (the shader counts upwards, the page downwards)
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
  /** A Graphics tier's picture (graphics.js profile): lines, edge smoothing, bloom, grade and haze strength. */
  function setProfile(p) {
    prof = p;
    // bloom from what shines (graphics.js glow): in place of the tier's bloom, its pass where that one is; at 0 there is
    // no such pass and nothing of it is made, and the chain is the one it always was
    // (the pass reads the scene's depth where there is one, as the haze does: then it draws only what shines)
    if (p.glow > 0 && !glow) { glow = new GlowPass(camera, renderPass.scene, undefined, sceneDepth); composer.insertPass(glow, composer.passes.indexOf(bloom) + 1); }
    else if (!(p.glow > 0) && glow) { composer.removePass(glow); glow.dispose(); glow = null; }
    bloom.enabled = bloomOn(p, hostBloom) && !glow;
    // --- water --- (graphics.js water: at 0 the view and everything it made are let go, every room's sheet as it was)
    if (p.water > 0 && !liquids) liquids = createLiquidView();
    else if (!(p.water > 0) && liquids) { liquids.release(renderPass.scene); liquids = null; split = false; }
    liquids?.setLevel(p.water);                          // (2, High: the mirror; 1, Medium: none of it)
    // --- end water ---
    // a tier's own bloom is tighter than the office's: a glow round the tubes, not a wash over the dark end of a corridor
    // (the widest blurs are left out: they are what spread a tube over everything)
    const own = p.bloom !== 'host';
    bloom.strength = own ? 0.3 : 0.32; bloom.radius = own ? 0 : 0.55;
    bloom.compositeMaterial.uniforms.bloomFactors.value = own ? [1, 0.5, 0, 0, 0] : [1, 0.8, 0.6, 0.4, 0.2];
    u.uGrade.value = p.grade; u.uHaze.value = p.haze * hazeK;
    // haze needs the depth of the picture: a depth texture on both of the composer's targets (resolved from the
    // multisampled one by three.js), only while some haze is asked for. Classic leaves the targets as they were
    const depth = p.haze > 0;
    for (const rt of [composer.renderTarget1, composer.renderTarget2, superPass.target]) {
      let dirty = false;
      if (rt.samples !== p.msaa) { rt.samples = p.msaa; dirty = true; }
      if (depth !== !!rt.depthTexture) {
        rt.depthTexture?.dispose();
        rt.depthTexture = depth ? new THREE.DepthTexture(rt.width, rt.height) : null;
        dirty = true;
      }
      if (dirty) rt.dispose();
    }
    last = '';
  }
  /** The kind of floor's grade, haze colour, haze strength (times the tier's) and where the haze begins (graphics.js gradeOf). */
  function setGrade(g) {
    u.uLift.value.fromArray(g.lift); u.uGamma.value.fromArray(g.gamma); u.uGainRGB.value.fromArray(g.gain); u.uSat.value = g.sat;
    u.uHazeColor.value.fromArray(g.haze);
    // (absent, 1 and 8: the tier's own strength, times 1, and the 8 m the shader always had)
    hazeK = Number.isFinite(g.hazeK) ? g.hazeK : 1; u.uHaze.value = prof.haze * hazeK;
    u.uHazeFrom.value = Number.isFinite(g.hazeFrom) ? g.hazeFrom : 8;
  }
  if (opt.profile) setProfile(opt.profile);

  return {
    picture, layout, setLevel, setProfile, setGrade, uniforms: u, bloom,
    get level() { return level; },
    /** The bloom from what shines while a tier has it on (glow.js), else null; and the chain as it stands. */
    get glow() { return glow; },
    /** The water's view while a tier has it on (liquid.js), else null: its `force` ('split' | 'single') is the dev page's. */
    get liquids() { return liquids; },
    get passes() { return composer.passes.slice(); },
    get profile() { return prof; },
    /** How lit the room is (index.js `light`, 0.3 a lit room): the haze is as bright as the air it hangs in. */
    setAmbient(light) { u.uHazeLight.value = Math.max(0, light) * HAZE_LIGHT; },
    setScene(scene) { renderPass.scene = scene; superPass.scene = scene; if (glow) glow.scene = scene; },
    render(dt) { time += dt; u.uTime.value = time; split = !!liquids && liquids.frame(renderPass.scene, camera, time); composer.render(dt); },
    dispose() { liquids?.release(renderPass.scene); liquids = null; glow?.dispose(); glow = null; composer.renderTarget1.depthTexture?.dispose(); composer.renderTarget2.depthTexture?.dispose(); composer.dispose(); superPass.dispose(); target.dispose(); bloom.dispose(); signal.dispose?.(); screen.dispose?.(); signal.material?.dispose(); screen.material?.dispose(); },
  };
}
