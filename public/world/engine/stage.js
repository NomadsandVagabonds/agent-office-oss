// The Office — the stage: renderer, post-processing, and the frame loop.
//
// The look is "a lit miniature": soft shadows, a gentle bloom so screens and
// lamps actually glow, and a tilt-shift blur toward the top and bottom of the
// frame that makes the whole office read as a model on a table.
import * as THREE from 'three';
import { EffectComposer } from '/vendor/three-addons/postprocessing/EffectComposer.js';
import { RenderPass } from '/vendor/three-addons/postprocessing/RenderPass.js';
import { ShaderPass } from '/vendor/three-addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '/vendor/three-addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/vendor/three-addons/postprocessing/OutputPass.js';

const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    uFocus: { value: 0.5 },        // screen y that stays sharp (0 bottom … 1 top)
    uBand: { value: 0.22 },        // half-height of the sharp band
    uAmount: { value: 1.0 },       // 0 disables
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uVignette: { value: 0.32 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uFocus, uBand, uAmount, uVignette; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      float blur = smoothstep(uBand, uBand + 0.42, d) * uAmount;
      vec4 sum = texture2D(tDiffuse, vUv);
      float total = 1.0;
      if (blur > 0.01) {
        float r = blur * 5.5;
        for (int i = 0; i < 12; i++) {
          float a = float(i) * 2.39996;                       // golden angle spiral
          float k = sqrt((float(i) + 0.5) / 12.0);
          vec2 o = vec2(cos(a), sin(a)) * k * r * uTexel;
          sum += texture2D(tDiffuse, vUv + o); total += 1.0;
        }
      }
      vec4 c = sum / total;
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(q * vec2(1.05, 1.25)));
      gl_FragColor = c;
    }`,
};

/**
 * @param {HTMLElement} container
 * @param {{fx?:boolean, shadows?:boolean, pixelRatio?:number}} [opt]
 */
export function createStage(container, opt = {}) {
  const fx = opt.fx !== false;
  const renderer = new THREE.WebGLRenderer({ antialias: !fx, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.preserve });
  const pixelRatio = Math.min(opt.pixelRatio || window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = opt.shadows !== false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);

  let composer = null, bloom = null, tilt = null, renderPass = null;
  let view = null;                         // { scene, camera, render? } while something else has the screen
  if (fx) {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.92);
    composer.addPass(bloom);
    tilt = new ShaderPass(TiltShift);
    composer.addPass(tilt);
    composer.addPass(new OutputPass());
  }

  const size = { w: 1, h: 1 };
  function resize() {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    size.w = w; size.h = h;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) {
      const ratio = renderer.getPixelRatio();
      composer.setPixelRatio(ratio);
      composer.setSize(w, h);
      tilt.uniforms.uTexel.value.set(1 / (w * ratio), 1 / (h * ratio));
    }
  }
  resize();
  window.addEventListener('resize', resize);

  const frameFns = [];
  const clock = new THREE.Clock();
  let running = false, frame = 0;
  // quality can be turned down while running (see setQuality): post-processing off, fewer pixels
  const quality = { fx: !!composer, pixelRatio };
  let lastMs = 16;
  function tick() {
    if (!running) return;
    const raw = clock.getDelta();
    const dt = Math.min(0.1, raw);
    lastMs += (raw * 1000 - lastMs) * 0.05;                    // a slow average: are we keeping up?
    frame += 1;
    for (const fn of frameFns) fn(dt, clock.elapsedTime, frame);
    if (view?.render) view.render(dt);                         // a guest scene that draws itself
    else if (composer && quality.fx) composer.render(dt);
    else renderer.render(view ? view.scene : scene, view ? view.camera : camera);
    requestAnimationFrame(tick);
  }
  function setQuality(next = {}) {
    if (next.pixelRatio && next.pixelRatio !== quality.pixelRatio) {
      quality.pixelRatio = next.pixelRatio;
      renderer.setPixelRatio(quality.pixelRatio);
      if (composer) composer.setPixelRatio(quality.pixelRatio);
      resize();
    }
    if (next.fx !== undefined) quality.fx = !!next.fx && !!composer;
    return { ...quality };
  }

  return {
    renderer, scene, camera, composer, bloom, tilt, size,
    get frame() { return frame; },
    /** Smoothed milliseconds per frame. */
    get frameMs() { return lastMs; },
    quality, setQuality,
    /**
     * Hand the screen to another scene (a mini-game, a hidden level) and take it
     * back with setView(null). Pass `render(dt)` to draw it yourself — for
     * example with your own post-processing; otherwise it goes through the
     * office's pipeline. Frame callbacks keep running either way.
     */
    setView(next) {
      view = next || null;
      if (renderPass) { renderPass.scene = view ? view.scene : scene; renderPass.camera = view ? view.camera : camera; }
      const cam = view ? view.camera : camera;
      if (cam.isPerspectiveCamera) { cam.aspect = size.w / size.h; cam.updateProjectionMatrix(); }
    },
    get view() { return view; },
    onFrame(fn) { frameFns.push(fn); return () => frameFns.splice(frameFns.indexOf(fn), 1); },
    start() { if (!running) { running = true; clock.start(); requestAnimationFrame(tick); } },
    stop() { running = false; },
    /** depth-of-field strength 0..1 and where on screen stays sharp */
    setTilt(amount, focusY = 0.5, band = 0.22) {
      if (!tilt) return;
      tilt.uniforms.uAmount.value = amount; tilt.uniforms.uFocus.value = focusY; tilt.uniforms.uBand.value = band;
    },
    resize,
  };
}
