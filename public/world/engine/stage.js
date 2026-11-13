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

  let composer = null, bloom = null, tilt = null;
  if (fx) {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
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
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
      tilt.uniforms.uTexel.value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
    }
  }
  resize();
  window.addEventListener('resize', resize);

  const frameFns = [];
  const clock = new THREE.Clock();
  let running = false, frame = 0;
  function tick() {
    if (!running) return;
    const dt = Math.min(0.1, clock.getDelta());
    frame += 1;
    for (const fn of frameFns) fn(dt, clock.elapsedTime, frame);
    if (composer) composer.render(dt); else renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  return {
    renderer, scene, camera, composer, bloom, tilt, size,
    get frame() { return frame; },
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
