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
import { setGpu } from './gpu.js';
import { createRecovery } from './gpu-recover.js';

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
 * A stage with the renderer the page asked for (engine/gpu.js rendererChoice): `opt.renderer` 'webgpu' fetches the
 * three.js WebGPU build and draws with WebGPURenderer (on its WebGL 2 backend where there is no WebGPU adapter);
 * anything else is createStage, exactly as it always was. If the WebGPU build cannot start at all, the old renderer.
 * @param {HTMLElement} container
 * @param {{renderer?:'webgl'|'webgpu', fx?:boolean, shadows?:boolean, pixelRatio?:number}} [opt]
 */
export async function openStage(container, opt = {}) {
  if (opt.renderer !== 'webgpu') return createStage(container, opt);
  let stage = null;
  try {
    const nodes = await import('../../vendor/three.webgpu.min.js');
    stage = createStage(container, { ...opt, nodes });
    await stage.renderer.init();
    const guard = guardDevice(stage, nodes, container);
    // (a device that cannot show a picture on this page is often lost only at its first frame: show one, and wait for it)
    await guard.probe();
    if (guard.recovery.state === 'failed') throw new Error('no device held');
    noteBackend(stage.renderer, nodes);
    return stage;
  } catch (err) {
    console.warn('[stage] WebGPURenderer could not start; the WebGL renderer instead', err);
    if (stage) { try { stage.dispose?.(); } catch { /* a lost device */ } for (const c of container.querySelectorAll('canvas')) c.remove(); }
    setGpu({ renderer: 'webgl', backend: 'webgl', nodes: null });
    return createStage(container, opt);
  }
}

function noteBackend(renderer, nodes) {
  const backend = renderer.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2';
  setGpu({ renderer: 'webgpu', backend, nodes });
  console.info(`[stage] WebGPURenderer on its ${backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'} backend (?gpu=webgpu)`);
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keep a WebGPURenderer's picture through a lost device (engine/gpu-recover.js says what is tried, in what order).
 * The renderer object stays the one everything holds; only its backend is swapped, and re-initialised: a fresh WebGPU
 * device on the same canvas, or the WebGL 2 backend on a new canvas put underneath the old one. The old canvas stays
 * where it was, unseen, on top: it is what the game's input (pointer lock, clicks) is bound to. While it recovers the
 * stage keeps running the game and does not draw.
 */
function guardDevice(stage, nodes, container) {
  const renderer = stage.renderer, input = renderer.domElement, params = stage.gpuParams;
  let lostHere = false, shown = null;
  const WebGPUBackend = renderer.backend?.isWebGPUBackend ? renderer.backend.constructor : null;
  let WebGLBackend = renderer.backend?.isWebGPUBackend ? null : renderer.backend.constructor;
  const fallback = renderer._getFallback;
  async function attempt(kind) {
    if (kind === 'webgpu' && !WebGPUBackend) return false;
    try { renderer.backend?.dispose?.(); } catch { /* a lost device may not let go cleanly */ }
    let canvas = input;
    if (kind === 'webgl2') {
      // (a canvas that has had a WebGPU context can never have a WebGL one: a new canvas, under the old)
      canvas = document.createElement('canvas');
      Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none' });
      Object.assign(input.style, { position: 'relative', zIndex: '1', opacity: '0' });
      shown?.remove(); input.before(canvas); shown = canvas;
    }
    params.canvas = canvas;
    let backend;
    if (kind === 'webgpu') backend = new WebGPUBackend(params);
    else if (WebGLBackend) backend = new WebGLBackend(params);
    else { backend = fallback(); WebGLBackend = backend.constructor; }
    renderer._animation?.stop?.();
    Object.assign(renderer, { backend, domElement: canvas, _initialized: false, _initPromise: null, _isDeviceLost: false, _getFallback: null });
    lostHere = false;
    try { await renderer.init(); } finally { renderer._getFallback = null; }
    watch();
    stage.resize();
    await probe();
    if (lostHere) return false;
    noteBackend(renderer, nodes);
    return true;
  }
  const recovery = createRecovery({
    attempt,
    onChange: (state, info) => {
      stage.setDrawing(state !== 'recovering' && state !== 'failed');
      if (state === 'recovering') console.warn(`[stage] the ${info?.api || ''} device was lost (${info?.message || 'no reason given'}); finding another`);
      if (state === 'failed') console.error('[stage] no device would hold: nothing can be drawn (reload with ?gpu=webgl)');
    },
  });
  // A loss counts only if it is the current backend's: a device or canvas just let go may still say it is gone.
  // (three.js calls onDeviceLost for both; a WebGPU device is watched here instead, by its identity)
  const lose = (info) => { renderer._isDeviceLost = true; lostHere = true; recovery.lost(info); };
  function watch() {
    const device = renderer.backend?.device;
    device?.lost?.then((i) => { if (renderer.backend?.device === device) lose({ api: 'WebGPU', message: i?.message, reason: i?.reason }); });
  }
  renderer.onDeviceLost = (info) => { if (info?.api === 'WebGL' && info.originalEvent?.target === renderer.domElement) lose(info); };
  watch();
  /** One frame shown with the backend there is, and long enough for a device that cannot show it to say so. */
  async function probe() {
    try { renderer.setRenderTarget(null); renderer.render(new nodes.Scene(), stage.camera); } catch { lostHere = true; }
    try { await renderer.backend?.device?.queue?.onSubmittedWorkDone?.(); } catch { /* lost */ }
    await nextFrame(); await nextFrame(); await pause(120);
  }
  stage.recovery = recovery;
  // (at the start: one frame, then whatever recovery that frame set off, to its end)
  return { recovery, probe: async () => { await probe(); await recovery.settled; } };
}

/**
 * @param {HTMLElement} container
 * @param {{fx?:boolean, shadows?:boolean, pixelRatio?:number, nodes?:object}} [opt]  nodes: the three.js WebGPU build
 *        (openStage passes it): draw with its WebGPURenderer. The office's own post-processing (bloom, tilt-shift) is
 *        WebGL only, so it is off there
 */
export function createStage(container, opt = {}) {
  const nodes = opt.nodes || null;
  const fx = opt.fx !== false && !nodes;
  const antialias = opt.antialias ?? !fx;
  const gpuParams = nodes ? { antialias, powerPreference: 'high-performance' } : null;
  const renderer = nodes
    ? new nodes.WebGPURenderer(gpuParams)
    : new THREE.WebGLRenderer({ antialias, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.preserve });
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
  const dispose = () => { running = false; window.removeEventListener('resize', resize); renderer.dispose(); };

  const frameFns = [];
  const clock = new THREE.Clock();
  let running = false, frame = 0;
  // quality can be turned down while running (see setQuality): post-processing off, fewer pixels
  const quality = { fx: !!composer, pixelRatio };
  let lastMs = 16;
  let drawing = true;                      // (false only while a lost WebGPU device is being replaced: openStage)
  function tick() {
    if (!running) return;
    const raw = clock.getDelta();
    const dt = Math.min(0.1, raw);
    lastMs += (raw * 1000 - lastMs) * 0.05;                    // a slow average: are we keeping up?
    frame += 1;
    for (const fn of frameFns) fn(dt, clock.elapsedTime, frame);
    if (!drawing) { requestAnimationFrame(tick); return; }
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
    renderer, scene, camera, composer, bloom, tilt, size, dispose, gpuParams,
    /** Draw or not (the game's frame callbacks run either way): openStage holds the picture while it replaces a lost device. */
    setDrawing(on) { drawing = !!on; },
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
