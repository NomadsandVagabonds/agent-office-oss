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

const QUAD = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const Signal = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(640, 480) }, uTime: { value: 0 },
    uAmt: { value: 1 }, uSoft: { value: 1 }, uTrack: { value: 0 }, uGain: { value: 1 }, uExposure: { value: 1 },
    uBlack: { value: 0 }, uWhite: { value: 0 }, uRed: { value: 0 }, uSnow: { value: 0 }, uRoll: { value: 0 },
  },
  vertexShader: QUAD,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uRes;
    uniform float uTime, uAmt, uSoft, uTrack, uGain, uExposure, uBlack, uWhite, uRed, uSnow, uRoll;
    varying vec2 vUv;
    const mat3 YIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
    const mat3 RGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    // a gentle shoulder: bright things wash out toward white, the way cheap video does
    vec3 film(vec3 c) { return 1.0 - exp(-c * (1.3 * uExposure * uGain)); }
    vec3 see(vec2 uv) { return pow(film(texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb), vec3(0.4545)); }
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
      c = mix(c, vec3(snow * 0.8 + 0.06), uSnow);
      c = mix(c, vec3(0.0), uBlack);
      c = mix(c, vec3(1.0, 0.98, 0.93), uWhite);
      c = mix(c, vec3(0.78, 0.025, 0.02), uRed);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

const Screen = {
  uniforms: { tDiffuse: { value: null }, uPicture: { value: new THREE.Vector2(1, 1) }, uSoft: { value: 1 }, uLines: { value: 240 }, uScan: { value: 0.08 } },
  vertexShader: QUAD,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uPicture; uniform float uSoft, uLines, uScan;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) / uPicture + 0.5;
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
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PerspectiveCamera} camera
 * @param {{bloom?:boolean, level?:number}} [opt]
 */
export function createVhs(renderer, camera, opt = {}) {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  const renderPass = new RenderPass(new THREE.Scene(), camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
  bloom.enabled = opt.bloom !== false;
  const signal = new ShaderPass(Signal), screen = new ShaderPass(Screen);
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(signal); composer.addPass(screen);
  const u = signal.uniforms, s = screen.uniforms;
  let level = opt.level ?? 2, last = '', time = 0;
  const picture = { x: 0, y: 0, w: 1, h: 1 };            // where the picture sits in the window, CSS pixels

  /** Fit the picture to the window. w, h in CSS pixels. */
  function layout(w, h) {
    const ratio = renderer.getPixelRatio(), key = `${w}x${h}@${ratio}/${level}`;
    if (key === last) return picture;
    last = key;
    const cw = w * ratio, ch = h * ratio;
    let pw = cw, ph = ch, iw, ih;
    if (level > 0) {                                     // a 4:3 picture, a few hundred lines tall
      pw = Math.min(cw, (ch * 4) / 3); ph = (pw * 3) / 4;
      ih = Math.round(Math.max(300, Math.min(ph, level === 2 ? 540 : 660))); iw = Math.round((ih * 4) / 3);
    } else { const k = Math.min(1, 1680 / cw); iw = Math.round(cw * k); ih = Math.round(ch * k); }
    composer.setSize(iw, ih);
    camera.aspect = iw / ih; camera.updateProjectionMatrix();
    u.uRes.value.set(iw, ih);
    s.uPicture.value.set(pw / cw, ph / ch);
    s.uLines.value = ih / 2;
    const perLine = ph / (ih / 2);                       // screen pixels per scan-line pair: too few and they would shimmer
    s.uScan.value = level > 0 ? 0.1 * Math.max(0, Math.min(1, (perLine - 2.4) / 1.6)) * (level === 2 ? 1 : 0.5) : 0;
    Object.assign(picture, { w: pw / ratio, h: ph / ratio, x: (w - pw / ratio) / 2, y: (h - ph / ratio) / 2 });
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

  return {
    picture, layout, setLevel, uniforms: u, bloom,
    get level() { return level; },
    setScene(scene) { renderPass.scene = scene; },
    render(dt) { time += dt; u.uTime.value = time; composer.render(dt); },
    dispose() { composer.dispose(); target.dispose(); bloom.dispose(); signal.dispose?.(); screen.dispose?.(); signal.material?.dispose(); screen.material?.dispose(); },
  };
}
