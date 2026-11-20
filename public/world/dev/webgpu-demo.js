// Live side-by-side / split-wipe Lighting & WebGPU Tech Demo.
// Drives two synchronized same-origin /world/dev/backrooms.html viewports
// (default: WebGL High left vs WebGPU High right) across curated lighting,
// shadow, bloom, sheen, mirror, water, and forest scenes.
import { makeItem } from '../backrooms/inventory-state.js';
import { toWorld } from '../backrooms/gen.js';
import { SHADOWS } from '../backrooms/shadowmap.js';

const PRESETS = [
  {
    id: 'flashlight-shadows',
    key: '1',
    title: 'Flashlight Shadows',
    sub: 'Dark room · PCF shadows · doorway bloom',
    desc: 'Ceiling banks killed in this room while the next room stays lit: High real-time flashlight shadows across desks & CRTs plus warm doorway spill.',
    query: { seed: '7', lighting: '1' },
    torch: true,
    lights: 'dark-here',
    setup(handle) {
      const world = handle.world;
      const rooms = world.rooms.filter((r) => r.lighting).sort((a, b) => b.def.W * b.def.D - a.def.W * a.def.D);
      const r = rooms[0] || world.rooms[0];
      if (!r) return;
      const alongZ = r.def.D >= r.def.W;
      let spot = null;
      for (const inset of [1.1, 1.6, 2.1, 2.6]) {
        for (const shift of [0, -1, 1, -2, 2]) {
          const x = alongZ ? shift : r.def.W / 2 - inset;
          const z = alongZ ? r.def.D / 2 - inset : shift;
          const p = toWorld(r.def, x, z);
          if (!spot && world.roomAt(p.x, p.z) === r && world.free(p.x, p.z, 0.24)) {
            spot = { x, z };
          }
        }
      }
      if (spot) handle.goto(r.id, spot.x, spot.z, alongZ ? 0 : Math.PI / 2, -0.06);
      applyDarkHereLitNeighbors(handle, r);
    },
  },
  {
    id: 'blackout-flicker',
    key: '2',
    title: 'Dynamic Flicker',
    sub: 'Failing banks · horror contrast',
    desc: 'Seeded failing & emergency fluorescent banks across the night office — dramatic dark-to-bright transitions with doorway spill and active torch.',
    query: { seed: '7', themes: 'night', lighting: 'failing', room: 'last-light' },
    torch: true,
    lights: 'preset',
    setup(handle) {
      const r = handle.world.rooms.find((rm) => rm.def.arch === 'last-light') || handle.world.current();
      if (r) handle.goto(r.id, 0, Math.max(1, r.def.D / 2 - 1.2), 0, -0.04);
    },
  },
  {
    id: 'mall-sheen',
    key: '3',
    title: 'Mall Neon & Sheen',
    sub: 'GGX floor sheen · storefront glow',
    desc: 'Anisotropic GGX tube streaks across polished terrazzo & corridor tiles paired with warm mall neon signs and MRT bloom.',
    query: { seed: '7', themes: 'mall', room: 'the-atrium' },
    torch: false,
    lights: 'preset',
    setup(handle) {
      const r = handle.world.rooms.find((rm) => rm.def.arch === 'the-atrium') || handle.world.current();
      if (r) handle.goto(r.id, 0, r.def.D / 2 - 1.6, 0, -0.14);
    },
  },
  {
    id: 'grotto-glow',
    key: '4',
    title: 'Grotto Glow & Snow',
    sub: 'MRT neon bloom · particle quads',
    desc: 'Vivid mall neon lettering preserved at crisp picture-alpha through the single-pass MRT glow plus drifting instanced snow quads.',
    query: { seed: '7', themes: 'mall', room: 'the-grotto' },
    torch: false,
    lights: 'preset',
    setup(handle) {
      const r = handle.world.rooms.find((rm) => rm.def.arch === 'the-grotto') || handle.world.current();
      if (r) handle.goto(r.id, 0, r.def.D / 2 - 1.3, 0, -0.06);
    },
  },
  {
    id: 'shower-mirror',
    key: '5',
    title: 'Shower Floor Mirror',
    sub: 'ReflectorNode · rippled wet tiles',
    desc: 'Room-isolated planar wet-floor mirror (ReflectorNode) with animated ripples running cleanly alongside Medium/High MRT ceiling glow.',
    query: { seed: '7', themes: 'waterpark', room: 'locker-showers', x: '0', z: '2.4', yaw: '0', pitch: '-0.22' },
    torch: false,
    lights: 'preset',
  },
  {
    id: 'lagoon-water',
    key: '6',
    title: 'Lagoon High Water',
    sub: 'Refraction · caustics · High mirror',
    desc: 'One-pass node water with underwater tile refraction, animated caustics, contact lines, mushroom fountain curtains, and High planar mirror.',
    query: { seed: '7', themes: 'waterpark', room: 'kiddie-lagoon', x: '0', z: '4.2', yaw: '0', pitch: '-0.12' },
    torch: false,
    lights: 'preset',
  },
  {
    id: 'wave-swell',
    key: '7',
    title: 'Surge Basin Swell',
    sub: 'Live wave geometry · foam · mirror',
    desc: 'Rolling vertex-displaced wave swell, banded face light, breaking crest foam, and High planar reflections of the wave chambers.',
    query: { seed: '7', themes: 'waterpark', room: 'wave-pool', x: '0', z: '6.2', yaw: '0', pitch: '-0.14' },
    torch: false,
    lights: 'preset',
  },
  {
    id: 'deep-end-dive',
    key: '8',
    title: 'Deep End Dive',
    sub: "Snell's window · underwater dome",
    desc: "Auto-submerged in the 2 m emerald diving well: underwater Snell's window refraction, glowing cyan wall niches, and tinted acrylic diving bell.",
    query: { seed: '7', themes: 'waterpark', room: 'deep-end', x: '0', z: '2.2', yaw: '0', pitch: '0.36' },
    torch: false,
    dive: true,
    lights: 'preset',
  },
  {
    id: 'bog-forest',
    key: '9',
    title: 'Bog Water & Mist',
    sub: 'Forest lighting · dark water · mist',
    desc: 'Dark forest canopy illumination, rippled bog water & caustics, and layered drifting mist veils in the glow pass.',
    query: { seed: '7', themes: 'forest', room: 'bog-boardwalk' },
    torch: true,
    lights: 'preset',
    setup(handle) {
      const r = handle.world.rooms.find((rm) => rm.def.arch === 'bog-boardwalk') || handle.world.current();
      if (r) handle.goto(r.id, 0, r.def.D / 2 - 1.4, 0, -0.10);
    },
  },
];

/* ---- DOM refs ------------------------------------------------------- */
const stageWrap = document.getElementById('stage-wrap');
const frameLeft = document.getElementById('frame-left');
const frameRight = document.getElementById('frame-right');
const wipeHandle = document.getElementById('wipe-handle');
const wipeRange = document.getElementById('wipe-range');
const wipeSliderWrap = document.getElementById('wipe-slider-wrap');
const selLeft = document.getElementById('sel-left');
const selRight = document.getElementById('sel-right');
const selLights = document.getElementById('sel-lights');
const selShadows = document.getElementById('sel-shadows');
const selVhs = document.getElementById('sel-vhs');
const btnTorch = document.getElementById('btn-torch');
const btnDive = document.getElementById('btn-dive');
const btnReset = document.getElementById('btn-reset');
const btnHide = document.getElementById('btn-hide');
const btnUnhide = document.getElementById('unhide-btn');
const presetPills = document.getElementById('preset-pills');
const presetDesc = document.getElementById('preset-desc');
const liveStatus = document.getElementById('live-status');
const errDrawer = document.getElementById('err-drawer');
const errLog = document.getElementById('err-log');
const btnCloseErr = document.getElementById('btn-close-err');
const camStatus = document.getElementById('cam-status');
const btnWalk = document.getElementById('btn-walk');

const badges = {
  left: {
    name: document.getElementById('lbl-left-name'),
    fps: document.getElementById('lbl-left-fps'),
    meta: document.getElementById('lbl-left-meta'),
  },
  right: {
    name: document.getElementById('lbl-right-name'),
    fps: document.getElementById('lbl-right-fps'),
    meta: document.getElementById('lbl-right-meta'),
  },
};

/* ---- State (initialized from URL params if present) ----------------- */
const urlParams = new URLSearchParams(location.search);
const state = {
  presetId: PRESETS.some((p) => p.id === urlParams.get('preset')) ? urlParams.get('preset') : PRESETS[0].id,
  mode: ['wipe', 'split', 'single'].includes(urlParams.get('mode')) ? urlParams.get('mode') : 'wipe',
  split: clamp(Number(urlParams.get('split') ?? 50), 0, 100),
  left: urlParams.get('left') || 'webgl:high',
  right: urlParams.get('right') || 'webgpu:high',
  vhs: [0, 1, 2].includes(Number(urlParams.get('vhs'))) ? Number(urlParams.get('vhs')) : 0,
  shadows: ['compare', 'smooth', 'blocky'].includes(urlParams.get('shadows')) ? urlParams.get('shadows') : 'compare',
  lights: 'preset',
  torch: true,
  dive: false,
  generation: 0,
};

const panes = {
  left: makePaneState('left', frameLeft),
  right: makePaneState('right', frameRight),
};

function makePaneState(side, iframe) {
  return {
    side,
    iframe,
    ready: false,
    handle: null,
    stage: null,
    errors: [],
    stats: { fps: 0, ms: 0, calls: 0, tris: 0, backend: '…' },
    lastPose: null,
    pendingTorch: null,
    cleanup: null,
  };
}

function clamp(v, lo, hi) {
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
}

function currentPreset() {
  return PRESETS.find((p) => p.id === state.presetId) || PRESETS[0];
}

function parseSpec(spec) {
  const [gpu, graphics] = String(spec || 'webgl:high').split(':');
  return {
    gpu: gpu === 'webgpu' ? 'webgpu' : 'webgl',
    graphics: ['classic', 'medium', 'high'].includes(graphics) ? graphics : 'high',
  };
}

function specLabel(spec) {
  const { gpu, graphics } = parseSpec(spec);
  return `${gpu === 'webgpu' ? 'WEBGPU' : 'WEBGL'} · ${graphics.toUpperCase()}`;
}

function announce(msg) {
  liveStatus.textContent = '';
  requestAnimationFrame(() => { liveStatus.textContent = msg; });
}

function syncUrl() {
  const u = new URL(location.href);
  u.searchParams.set('preset', state.presetId);
  u.searchParams.set('mode', state.mode);
  u.searchParams.set('left', state.left);
  u.searchParams.set('right', state.right);
  u.searchParams.set('vhs', String(state.vhs));
  u.searchParams.set('shadows', state.shadows);
  if (Math.round(state.split) !== 50) u.searchParams.set('split', String(Math.round(state.split)));
  else u.searchParams.delete('split');
  history.replaceState(null, '', u);
}

/* ---- Split Wipe slider & drag handle -------------------------------- */
function setSplit(pct, announceChange = false) {
  state.split = clamp(pct, 0, 100);
  const rounded = Math.round(state.split * 10) / 10;
  document.documentElement.style.setProperty('--split', `${rounded}%`);
  wipeRange.value = String(rounded);
  // Fallback sync for typed attr() and progress() (slider guide)
  wipeRange.style.setProperty('--attr-min', wipeRange.min || '0');
  wipeRange.style.setProperty('--attr-max', wipeRange.max || '100');
  wipeRange.style.setProperty('--control-value', wipeRange.value);
  wipeRange.setAttribute('aria-valuetext', `${Math.round(rounded)}% split: ${specLabel(state.left)} left, ${specLabel(state.right)} right`);
  if (announceChange) announce(`Comparison divider at ${Math.round(rounded)} percent`);
}

wipeRange.addEventListener('input', () => setSplit(Number(wipeRange.value)));

wipeHandle.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  wipeHandle.setPointerCapture(event.pointerId);
  wipeHandle.classList.add('dragging');
});

wipeHandle.addEventListener('pointermove', (event) => {
  if (!wipeHandle.hasPointerCapture(event.pointerId)) return;
  const rect = stageWrap.getBoundingClientRect();
  if (rect.width > 0) setSplit(((event.clientX - rect.left) / rect.width) * 100);
});

wipeHandle.addEventListener('lostpointercapture', () => {
  wipeHandle.classList.remove('dragging');
  syncUrl();
});

wipeHandle.addEventListener('keydown', (event) => {
  const step = event.shiftKey ? 10 : 2;
  if (event.key === 'ArrowLeft') { event.preventDefault(); setSplit(state.split - step, true); syncUrl(); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); setSplit(state.split + step, true); syncUrl(); }
  else if (event.key === 'Home') { event.preventDefault(); setSplit(0, true); syncUrl(); }
  else if (event.key === 'End') { event.preventDefault(); setSplit(100, true); syncUrl(); }
});

/* ---- View Mode ------------------------------------------------------ */
function setMode(mode) {
  state.mode = mode;
  stageWrap.dataset.mode = mode;
  for (const btn of document.querySelectorAll('[data-mode-btn]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.modeBtn === mode));
  }
  wipeSliderWrap.classList.toggle('hidden', mode !== 'wipe');
  // In single mode, ensure right pane is active and left isn't wasted if not needed
  syncUrl();
  // Trigger a resize in both iframes so canvas/composer adjusts cleanly
  requestAnimationFrame(() => {
    for (const p of [panes.left, panes.right]) {
      try { p.iframe.contentWindow?.dispatchEvent(new Event('resize')); } catch { /* ignore */ }
    }
  });
}

for (const btn of document.querySelectorAll('[data-mode-btn]')) {
  btn.addEventListener('click', () => setMode(btn.dataset.modeBtn));
}

/* ---- Lighting & Torch helpers --------------------------------------- */
function applyDarkHereLitNeighbors(handle, currentRoom) {
  const world = handle.world;
  for (const rt of world.rooms) {
    if (rt === currentRoom) {
      if (rt.lighting) rt.lighting.preview = 'outage';
      world.setLights(rt, 0);
    } else {
      if (rt.lighting) rt.lighting.preview = 'working';
      world.setLights(rt, 1);
    }
  }
}

function applyLightsToPane(pane) {
  const h = pane.handle;
  if (!h?.world) return;
  const world = h.world;
  const cur = world.current() || world.roomAt(h.player.me.x, h.player.me.z) || world.rooms[0];
  const mode = state.lights;
  if (mode === 'preset') {
    const p = currentPreset();
    if (p.lights === 'dark-here') {
      applyDarkHereLitNeighbors(h, cur);
    } else {
      for (const rt of world.rooms) {
        if (rt.lighting) rt.lighting.preview = null;
        world.setLights(rt, 1);
      }
    }
  } else if (mode === 'blackout') {
    applyDarkHereLitNeighbors(h, cur);
  } else if (mode === 'dim') {
    for (const rt of world.rooms) {
      if (rt.lighting) rt.lighting.preview = rt === cur ? 'outage' : 'working';
      world.setLights(rt, rt === cur ? 0.2 : 1);
    }
  } else if (mode === 'full') {
    for (const rt of world.rooms) {
      if (rt.lighting) rt.lighting.preview = 'working';
      world.setLights(rt, 1);
    }
  }
}

function setPaneTorch(pane, wantOn) {
  const h = pane.handle;
  const bag = h?.inventory;
  if (!bag) return false;
  if (h.state !== 'play' || h.paused) {
    pane.pendingTorch = wantOn;
    return false;
  }
  let slots = bag.model.read().slots;
  let idx = slots.findIndex((item) => item?.type === 'torch');
  if (idx < 0 && wantOn) {
    const added = bag.give(makeItem('torch', `demo-torch-${pane.side}`));
    if (!added.ok) {
      pane.pendingTorch = wantOn;
      return false;
    }
    idx = added.index;
  }
  if (idx < 0) {
    pane.pendingTorch = null;
    return true;
  }
  const isOn = bag.torchPower() > 0;
  if (wantOn && !isOn) {
    bag.select(idx);
    bag.toggleLight();
  } else if (!wantOn && isOn) {
    bag.toggleLight();
  }
  pane.pendingTorch = null;
  return true;
}

function setPaneDive(pane, wantDive) {
  const keys = pane.handle?.player?.input?.keys;
  if (!keys) return;
  if (wantDive) keys.add('c');
  else keys.delete('c');
}

function updateTorchButton() {
  btnTorch.setAttribute('aria-pressed', String(state.torch));
  btnTorch.textContent = state.torch ? 'Torch: On' : 'Torch: Off';
}

function updateDiveButton() {
  const show = currentPreset().id === 'deep-end-dive';
  btnDive.hidden = !show;
  btnDive.setAttribute('aria-pressed', String(state.dive));
  btnDive.textContent = state.dive ? 'Dive: On' : 'Dive: Off';
}

/* ---- Build iframe URL & instrument each viewport -------------------- */
function buildFrameUrl(preset, spec) {
  const { gpu, graphics } = parseSpec(spec);
  const q = new URLSearchParams({
    seed: '7',
    mute: '1',
    pursuer: '0',
    card: '0',
    vhs: String(state.vhs),
    gpu,
    graphics,
    ...(preset.query || {}),
  });
  return `/world/dev/backrooms.html?${q.toString()}`;
}

function hookPane(pane, gen) {
  const win = pane.iframe.contentWindow;
  if (!win) return;

  pane.errors.length = 0;
  const recordErr = (msg) => {
    const text = String(msg).slice(0, 400);
    if (pane.errors.length < 40) pane.errors.push(text);
    renderTelemetry(pane);
  };

  try {
    const origErr = win.console.error.bind(win.console);
    win.console.error = (...args) => {
      recordErr(args.map((a) => (a && a.message) || String(a)).join(' '));
      origErr(...args);
    };
    const origWarn = win.console.warn.bind(win.console);
    win.console.warn = (...args) => {
      const msg = args.map((a) => (a && a.message) || String(a)).join(' ');
      if (/webgpu|wgsl|three\.|shader|pipeline|renderpass|attachment|mrt/i.test(msg)) {
        recordErr(`[warn] ${msg}`);
      }
      origWarn(...args);
    };
    win.addEventListener('error', (e) => recordErr(e.message || String(e.error || 'Window error')));
    win.addEventListener('unhandledrejection', (e) => recordErr(e.reason?.message || String(e.reason || 'Unhandled rejection')));
  } catch { /* ignore */ }

  const poll = () => {
    if (gen !== state.generation) return;
    const h = win.__backrooms;
    const st = win.__stage;
    if (!h || !st || !h.player || !h.world) {
      setTimeout(poll, 60);
      return;
    }

    pane.handle = h;
    pane.stage = st;
    pane.ready = true;

    // Detect actual renderer & backend
    const r = st.renderer;
    if (r?.isWebGPURenderer) {
      pane.stats.backend = r.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGPU (GL2 fallback)';
      // Surface WebGPU GPUDevice validation errors directly in the telemetry error badge
      const dev = r.backend?.device;
      if (dev && !dev.__demoErrHooked) {
        dev.__demoErrHooked = true;
        dev.addEventListener('uncapturederror', (ev) => {
          recordErr(`[WebGPU] ${ev.error?.message || String(ev.error)}`);
        });
      }
    } else {
      pane.stats.backend = 'WebGL 2';
    }

    // Lightweight per-frame counter (works accurately on both WebGLRenderer and WebGPURenderer)
    const info = r.info;
    const origRender = r.render;
    let accCalls = 0, accTris = 0;
    r.render = function (scene, camera) {
      const c0 = info.render.calls;
      const t0 = info.render.triangles;
      origRender.call(this, scene, camera);
      const dc = info.render.calls >= c0 ? info.render.calls - c0 : info.render.calls;
      const dt = info.render.triangles >= t0 ? info.render.triangles - t0 : info.render.triangles;
      if (dc > 0) accCalls += dc;
      if (dt > 0) accTris += dt;
    };

    const recent = [];
    let lastT = 0;
    const offFrame = st.onFrame(() => {
      const now = performance.now();
      if (lastT) {
        recent.push({ t: now, ms: now - lastT });
        while (recent.length && recent[0].t < now - 1500) recent.shift();
        const span = recent.length > 1 ? recent[recent.length - 1].t - recent[0].t + recent[0].ms : 0;
        pane.stats.fps = span > 0 ? (recent.length * 1000) / span : 0;
        pane.stats.ms = recent.reduce((a, b) => a + b.ms, 0) / Math.max(1, recent.length);
      }
      lastT = now;
      pane.stats.calls = accCalls;
      pane.stats.tris = accTris;
      accCalls = 0;
      accTris = 0;
    });

    pane.cleanup = () => {
      try { offFrame?.(); } catch { /* ignore */ }
    };

    // Apply preset framing, shake removal in Clean mode, lights, torch, dive
    applyPresetToPane(pane);
    renderTelemetry(pane);
  };

  poll();
}

/** Separable [1,2,1]/4 soft-penumbra blur strictly inside each lightmap atlas region (never bleeds across gutters). */
function blurLightmapData(src, layout, passes = 2) {
  const W = layout.width, H = layout.height;
  const ch = src.length / (W * H);
  if (ch !== 4 && ch !== 2) return new Uint8Array(src);
  let cur = new Uint8Array(src);
  let tmp = new Uint8Array(src);
  for (let pass = 0; pass < passes; pass++) {
    for (const r of layout.list) {
      const x0 = r.px, x1 = r.px + r.nu - 1, y0 = r.py, y1 = r.py + r.nv - 1;
      // Horizontal pass
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const xl = Math.max(x0, x - 1), xr = Math.min(x1, x + 1);
          const o = (y * W + x) * ch, ol = (y * W + xl) * ch, or = (y * W + xr) * ch;
          for (let c = 0; c < ch; c++) tmp[o + c] = (cur[ol + c] + cur[o + c] * 2 + cur[or + c] + 2) >> 2;
        }
      }
      // Vertical pass
      for (let y = y0; y <= y1; y++) {
        const yu = Math.max(y0, y - 1), yd = Math.min(y1, y + 1);
        for (let x = x0; x <= x1; x++) {
          const o = (y * W + x) * ch, ou = (yu * W + x) * ch, od = (yd * W + x) * ch;
          for (let c = 0; c < ch; c++) cur[o + c] = (tmp[ou + c] + tmp[o + c] * 2 + tmp[od + c] + 2) >> 2;
        }
      }
      // Refresh 1-texel gutter so hardware bilinear never reads unblurred border
      const copyPx = (sx, sy, dx, dy) => {
        if (dx < 0 || dx >= W || dy < 0 || dy >= H) return;
        const s = (sy * W + sx) * ch, d = (dy * W + dx) * ch;
        for (let c = 0; c < ch; c++) cur[d + c] = cur[s + c];
      };
      for (let x = x0; x <= x1; x++) { copyPx(x, y0, x, y0 - 1); copyPx(x, y1, x, y1 + 1); }
      for (let y = y0 - 1; y <= y1 + 1; y++) {
        const cy = Math.max(y0, Math.min(y1, y));
        copyPx(x0, cy, x0 - 1, y);
        copyPx(x1, cy, x1 + 1, y);
      }
    }
  }
  return cur;
}

function applyTextureSoftness(tex, layout, smooth, passes) {
  if (!tex?.image?.data || !layout?.list) return;
  if (!tex.__rawData) tex.__rawData = new Uint8Array(tex.image.data);
  if (smooth && !tex.__softData) tex.__softData = blurLightmapData(tex.__rawData, layout, passes);
  const want = smooth ? tex.__softData : tex.__rawData;
  if (tex.__appliedSmooth === smooth) return;
  tex.image.data.set(want);
  tex.needsUpdate = true;
  tex.__appliedSmooth = smooth;
}

function applyShadowsToPane(pane) {
  const world = pane.handle?.world;
  if (!world) return;
  const smooth = state.shadows === 'smooth' || (state.shadows === 'compare' && pane.side === 'right');
  // 1e-4 m (0.1 mm) keeps classic WebGL's untouched lmUv() free of /0 while eliminating 5 cm texel stepping;
  // WebGPU (kit-node-light.js) bypasses quantization directly at 0.
  const step = smooth ? (pane.actualBackend === 'WebGPU' ? 0 : 1e-4) : SHADOWS.step;
  for (const rt of world.rooms) {
    const lm = rt.lm;
    if (!lm?.uniforms) continue;
    const uLm = lm.uniforms.uLm?.value;
    if (uLm?.[5]) uLm[5].z = step;
    applyTextureSoftness(lm.uniforms.uLmA?.value, lm.layout, smooth, 1);
    if (lm.uniforms.uLmB?.value && lm.uniforms.uLmB.value !== lm.uniforms.uLmA?.value) {
      applyTextureSoftness(lm.uniforms.uLmB.value, lm.layout, smooth, 1);
    }
    applyTextureSoftness(lm.uniforms.uLmC?.value, lm.layout, smooth, 2);
  }
}

function applyPresetToPane(pane) {
  const h = pane.handle;
  if (!h) return;
  const preset = currentPreset();
  preset.setup?.(h);
  if (state.vhs === 0 && h.player?.me) {
    // Eliminate phase-drifting idle sway in Clean mode so the wipe seam stays sub-pixel locked
    h.player.me.shake = 0;
  }
  applyLightsToPane(pane);
  applyShadowsToPane(pane);
  h.resetCamcorder?.();
  setPaneTorch(pane, state.torch);
  setPaneDive(pane, state.dive);
  pane.lastPose = snapshotPose(h.player.me);
}

function snapshotPose(me) {
  return {
    x: me.x, z: me.z, yaw: me.yaw, pitch: me.pitch,
    sink: me.sink, sinkTo: me.sinkTo, drop: me.drop, dropV: me.dropV,
  };
}

function poseDelta(a, b) {
  if (!a || !b) return 0;
  return (
    Math.abs(a.x - b.x) +
    Math.abs(a.z - b.z) +
    Math.abs(a.yaw - b.yaw) +
    Math.abs(a.pitch - b.pitch) +
    Math.abs(a.sink - b.sink) +
    Math.abs(a.drop - b.drop)
  );
}

function copyPose(srcHandle, dstHandle) {
  const s = srcHandle.player.me;
  const d = dstHandle.player.me;
  d.x = s.x;
  d.z = s.z;
  d.yaw = s.yaw;
  d.pitch = s.pitch;
  d.sink = s.sink;
  d.sinkTo = s.sinkTo;
  d.drop = s.drop;
  d.dropV = s.dropV;
  d.vx = s.vx;
  d.vz = s.vz;
  d.speed = s.speed;
  d.moving = s.moving;
  if (state.vhs === 0) {
    s.shake = 0;
    d.shake = 0;
  }
  // Keep underwater/crouch key mirrored so buoyancy physics match in deep-end
  const srcC = srcHandle.player.input?.keys?.has('c');
  if (dstHandle.player.input?.keys) {
    if (srcC) dstHandle.player.input.keys.add('c');
    else dstHandle.player.input.keys.delete('c');
  }
  const rt = dstHandle.world.roomAt(d.x, d.z);
  if (rt && rt !== dstHandle.world.current()) dstHandle.world.enter(rt);
}

/* ---- Doorway Threshold Walk (demonstrates camcorder iris / AWB / AF) - */
const walkDemo = { active: false, t: 0, lastNow: 0, ax: 0, az: 0, bx: 0, bz: 0, yawA: 0, yawB: 0 };

function stopWalkDemo() {
  walkDemo.active = false;
  btnWalk.textContent = '▶ Walk Door';
  btnWalk.setAttribute('aria-pressed', 'false');
}

function findDoorwayWalk(handle) {
  const world = handle?.world;
  const r = world?.current?.();
  if (!r?.def?.doors?.length) return null;
  const hereL = r.level * (r.u?.dim?.value ?? 1);
  let best = null;
  for (const dr of r.def.doors) {
    if (dr.kind === 'crawl') continue;
    const nb = world.rooms[dr.to];
    if (!nb) continue;
    const nbL = nb.level * (nb.u?.dim?.value ?? 1);
    let dx = 0, dz = 0, nx = 0, nz = 0;
    if (dr.side === 'front') { dx = dr.c; dz = r.def.D / 2; nz = 1; }
    else if (dr.side === 'back') { dx = dr.c; dz = -r.def.D / 2; nz = -1; }
    else if (dr.side === 'right') { dx = r.def.W / 2; dz = dr.c; nx = 1; }
    else if (dr.side === 'left') { dx = -r.def.W / 2; dz = dr.c; nx = -1; }
    let a = null, b = null;
    for (const d of [2.1, 1.7, 1.35]) {
      const p = toWorld(r.def, dx - nx * d, dz - nz * d);
      if (!a && world.roomAt(p.x, p.z) === r && world.free(p.x, p.z, 0.24)) a = p;
    }
    // Keep at least ~1.1 m of open room sightline beyond B so the walk never ends nose-to-wall
    for (const d of [1.45, 1.15, 0.9]) {
      const q = toWorld(r.def, dx + nx * d, dz + nz * d);
      const ahead = toWorld(r.def, dx + nx * (d + 1.1), dz + nz * (d + 1.1));
      if (!b && world.roomAt(q.x, q.z) === nb && world.free(q.x, q.z, 0.24) && world.roomAt(ahead.x, ahead.z) === nb) b = q;
    }
    if (!b) {
      for (const d of [1.1, 0.85]) {
        const q = toWorld(r.def, dx + nx * d, dz + nz * d);
        if (!b && world.roomAt(q.x, q.z) === nb && world.free(q.x, q.z, 0.24)) b = q;
      }
    }
    if (!a || !b) continue;
    const yawA = Math.atan2(-(b.x - a.x), -(b.z - a.z));
    // Measure open sightline into nb from b toward nb's centre (prefer wide rooms over tight walls)
    const dirX = nb.def.cx - b.x, dirZ = nb.def.cz - b.z, dirLen = Math.hypot(dirX, dirZ) || 1;
    let sight = 0;
    for (let dist = 0.8; dist <= 5.0; dist += 0.6) {
      const sx = b.x + (dirX / dirLen) * dist, sz = b.z + (dirZ / dirLen) * dist;
      if (world.free(sx, sz, 0.24)) sight = dist;
      else break;
    }
    const yawB = dirLen > 0.6 ? Math.atan2(-dirX, -dirZ) : yawA;
    const score = Math.abs(nbL - hereL) * 4 + Math.min(sight, 4.5) * 0.25 + (dr.door ? -0.3 : 0.15);
    if (!best || score > best.score) {
      best = { score, ax: a.x, az: a.z, bx: b.x, bz: b.z, yawA, yawB };
    }
  }
  return best;
}

function startWalkDemo() {
  const driver = (state.mode === 'single' ? panes.right : panes.left);
  if (!driver.ready) return;
  const path = findDoorwayWalk(driver.handle);
  if (!path) return;
  Object.assign(walkDemo, path, { active: true, t: 0, lastNow: performance.now() });
  btnWalk.textContent = '■ Stop Walk';
  btnWalk.setAttribute('aria-pressed', 'true');
  // Place both panes at start point A and reset camcorder so the dark-room baseline is clean
  for (const p of [panes.left, panes.right]) {
    if (!p.ready) continue;
    p.handle.player.warp(path.ax, path.az, path.yawA);
    p.handle.player.me.pitch = -0.05;
    const rt = p.handle.world.roomAt(path.ax, path.az);
    if (rt) p.handle.world.enter(rt);
    p.handle.resetCamcorder?.();
    p.lastPose = snapshotPose(p.handle.player.me);
  }
}

function stepWalkDemo(now) {
  if (!walkDemo.active) return;
  const dt = Math.min(0.1, Math.max(0, (now - walkDemo.lastNow) / 1000));
  walkDemo.lastNow = now;
  walkDemo.t += dt;
  // 11.8 s relaxed cycle: 0.6s pause in A -> 2.0s walk A->B -> 3.6s settle in B -> 2.0s walk B->A -> 3.6s settle in A
  const cyc = walkDemo.t % 11.8;
  let u = 0;
  if (cyc < 0.6) u = 0;
  else if (cyc < 2.6) u = (cyc - 0.6) / 2.0;
  else if (cyc < 6.2) u = 1;
  else if (cyc < 8.2) u = 1 - (cyc - 6.2) / 2.0;
  else u = 0;
  const s = u * u * (3 - 2 * u);
  const x = walkDemo.ax + (walkDemo.bx - walkDemo.ax) * s;
  const z = walkDemo.az + (walkDemo.bz - walkDemo.az) * s;
  const driver = state.mode === 'single' ? panes.right : panes.left;
  if (!driver.ready) return;
  const me = driver.handle.player.me;
  // Cancel auto-walk if the user actively steers with keyboard
  if (driver.handle.player.input?.keys?.size > 0) { stopWalkDemo(); return; }
  // Smooth shortest-angle yaw interpolation from doorway gaze into the room interior
  const turn = Math.max(0, Math.min(1, (s - 0.55) / 0.45));
  const turnS = turn * turn * (3 - 2 * turn);
  let dyaw = ((walkDemo.yawB - walkDemo.yawA + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (dyaw < -Math.PI) dyaw += Math.PI * 2;
  me.x = x;
  me.z = z;
  me.yaw = walkDemo.yawA + dyaw * turnS;
  me.pitch = -0.05;
  const rt = driver.handle.world.roomAt(x, z);
  if (rt && rt !== driver.handle.world.current()) driver.handle.world.enter(rt);
}

function renderCamStatus() {
  const pane = panes.right.ready ? panes.right : panes.left;
  const c = pane?.handle?.camcorder;
  if (!c) return;
  const exp = c.exposure ?? 1;
  const b = c.balance || [1, 1, 1];
  const def = c.defocus ?? 0;
  const wbDelta = b[0] - b[2];
  const wbLabel = Math.abs(wbDelta) < 0.03 ? 'AWB OK' : (wbDelta > 0 ? 'AWB WARM' : 'AWB COOL');
  const afLabel = def > 0.03 ? 'AF HUNT' : 'AF LOCK';
  const active = def > 0.03 || Math.abs(exp - 1) > 0.04 || Math.abs(wbDelta) >= 0.03;
  camStatus.textContent = `CAM · IRIS ${exp.toFixed(2)}× · ${wbLabel} · ${afLabel}`;
  camStatus.classList.toggle('active', active);
}

/* ---- Load preset into both iframes ---------------------------------- */
function loadBoth({ resetPresetDefaults = false } = {}) {
  stopWalkDemo();
  const preset = currentPreset();
  if (resetPresetDefaults) {
    state.torch = !!preset.torch;
    state.dive = !!preset.dive;
    state.lights = 'preset';
    selLights.value = 'preset';
  }
  updateTorchButton();
  updateDiveButton();
  updateDeckUI();
  syncUrl();

  state.generation += 1;
  const gen = state.generation;

  for (const [side, spec] of [['left', state.left], ['right', state.right]]) {
    const pane = panes[side];
    pane.cleanup?.();
    pane.cleanup = null;
    pane.ready = false;
    pane.handle = null;
    pane.stage = null;
    pane.errors.length = 0;
    pane.stats = { fps: 0, ms: 0, calls: 0, tris: 0, backend: 'loading…' };
    badges[side].name.textContent = specLabel(spec);
    badges[side].fps.textContent = 'loading…';
    badges[side].meta.textContent = 'Building room & light maps…';

    const url = buildFrameUrl(preset, spec);
    pane.iframe.onload = () => hookPane(pane, gen);
    pane.iframe.src = url;
  }
}

/* ---- Lockstep rAF sync & telemetry redraw --------------------------- */
let lastTelemetryAt = 0;
let lastCamAt = 0;

function tick(now) {
  requestAnimationFrame(tick);

  const L = panes.left;
  const R = panes.right;

  if (L.ready && L.pendingTorch !== null) setPaneTorch(L, L.pendingTorch);
  if (R.ready && R.pendingTorch !== null) setPaneTorch(R, R.pendingTorch);
  stepWalkDemo(now);

  if (L.ready && R.ready && state.mode !== 'single') {
    const lPose = snapshotPose(L.handle.player.me);
    const rPose = snapshotPose(R.handle.player.me);
    const lMoved = poseDelta(lPose, L.lastPose);
    const rMoved = poseDelta(rPose, R.lastPose);

    // In Wipe mode Left is always the interactive driver; in Side-by-Side whichever moved drives
    let driver = L, follower = R;
    if (state.mode === 'split' && rMoved > lMoved + 1e-4) {
      driver = R;
      follower = L;
    }

    copyPose(driver.handle, follower.handle);

    // Sync flashlight toggled via in-game F key (only once pending preset torch has settled)
    if (L.pendingTorch === null && R.pendingTorch === null && driver.handle.state === 'play') {
      const driverTorch = (driver.handle.inventory?.torchPower?.() ?? 0) > 0;
      const followerTorch = (follower.handle.inventory?.torchPower?.() ?? 0) > 0;
      if (driverTorch !== followerTorch) setPaneTorch(follower, driverTorch);
      if (driverTorch !== state.torch) {
        state.torch = driverTorch;
        updateTorchButton();
      }
    }

    L.lastPose = snapshotPose(L.handle.player.me);
    R.lastPose = snapshotPose(R.handle.player.me);
  } else if (R.ready && state.mode === 'single') {
    if (state.vhs === 0) R.handle.player.me.shake = 0;
  }

  if (now - lastCamAt >= 80) {
    lastCamAt = now;
    renderCamStatus();
  }

  if (now - lastTelemetryAt >= 280) {
    lastTelemetryAt = now;
    if (L.ready) { applyShadowsToPane(L); renderTelemetry(L); }
    if (R.ready) { applyShadowsToPane(R); renderTelemetry(R); }
  }
}

function renderTelemetry(pane) {
  const b = badges[pane.side];
  const s = pane.stats;
  const shadowTag = state.shadows === 'compare'
    ? (pane.side === 'right' ? ' · SMOOTH' : ' · BLOCKY')
    : (state.shadows === 'smooth' ? ' · SMOOTH' : '');
  b.name.textContent = specLabel(state[pane.side]) + shadowTag;
  if (!pane.ready) return;

  b.fps.textContent = s.fps > 0 ? `${Math.round(s.fps)} fps · ${s.ms.toFixed(1)} ms` : 'ready';

  const trisK = s.tris >= 1000 ? `${(s.tris / 1000).toFixed(1)}k` : String(s.tris);
  const errCount = pane.errors.length;
  b.meta.replaceChildren();
  b.meta.append(document.createTextNode(`${s.backend} · ${s.calls} draws · ${trisK} tris · `));
  const errSpan = document.createElement('span');
  if (errCount > 0) {
    errSpan.className = 'badge-err';
    errSpan.textContent = `${errCount} err`;
    errSpan.title = 'Click badge to view captured console errors';
    const preview = document.createElement('div');
    preview.className = 'badge-err';
    preview.style.cssText = 'font-size:10px;text-decoration:none;margin-top:3px;word-break:break-word;max-width:320px;';
    preview.textContent = pane.errors[0].slice(0, 180);
    b.meta.append(errSpan, preview);
  } else {
    errSpan.className = 'badge-ok';
    errSpan.textContent = '0 err';
    b.meta.append(errSpan);
  }
}

document.getElementById('badge-left').addEventListener('click', () => {
  if (panes.left.errors.length) openErrorDrawer();
});
document.getElementById('badge-right').addEventListener('click', () => {
  if (panes.right.errors.length) openErrorDrawer();
});

function openErrorDrawer() {
  const lines = [];
  for (const side of ['left', 'right']) {
    const errs = panes[side].errors;
    if (!errs.length) continue;
    lines.push(`=== ${side.toUpperCase()} (${specLabel(state[side])}) ===`);
    for (const e of errs) lines.push(`• ${e}`);
    lines.push('');
  }
  errLog.textContent = lines.length ? lines.join('\n') : 'No runtime errors captured.';
  errDrawer.hidden = false;
}

btnCloseErr.addEventListener('click', () => { errDrawer.hidden = true; });

/* ---- Showcase Deck UI ----------------------------------------------- */
function buildDeck() {
  presetPills.replaceChildren();
  for (const p of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-pill';
    btn.dataset.preset = p.id;
    const t = document.createElement('span');
    t.className = 'p-title';
    t.textContent = `${p.key} · ${p.title}`;
    const s = document.createElement('span');
    s.className = 'p-sub';
    s.textContent = p.sub;
    btn.append(t, s);
    btn.addEventListener('click', () => selectPreset(p.id));
    presetPills.append(btn);
  }
}

function updateDeckUI() {
  const p = currentPreset();
  presetDesc.replaceChildren();
  const strong = document.createElement('strong');
  strong.textContent = p.title;
  presetDesc.append(strong, document.createTextNode(p.desc));

  for (const btn of presetPills.querySelectorAll('.preset-pill')) {
    btn.setAttribute('aria-current', btn.dataset.preset === p.id ? 'true' : 'false');
  }
}

function selectPreset(id) {
  if (!PRESETS.some((p) => p.id === id)) return;
  state.presetId = id;
  loadBoth({ resetPresetDefaults: true });
  announce(`Loaded scene: ${currentPreset().title}`);
}

/* ---- Control Listeners ---------------------------------------------- */
selLeft.value = state.left;
selRight.value = state.right;
selShadows.value = state.shadows;
selVhs.value = String(state.vhs);

selLeft.addEventListener('change', () => {
  state.left = selLeft.value;
  loadBoth({ resetPresetDefaults: false });
});

selRight.addEventListener('change', () => {
  state.right = selRight.value;
  loadBoth({ resetPresetDefaults: false });
});

selLights.addEventListener('change', () => {
  state.lights = selLights.value;
  if (panes.left.ready) applyLightsToPane(panes.left);
  if (panes.right.ready) applyLightsToPane(panes.right);
});

selShadows.addEventListener('change', () => {
  state.shadows = selShadows.value;
  if (panes.left.ready) { applyShadowsToPane(panes.left); renderTelemetry(panes.left); }
  if (panes.right.ready) { applyShadowsToPane(panes.right); renderTelemetry(panes.right); }
  syncUrl();
});

selVhs.addEventListener('change', () => {
  state.vhs = Number(selVhs.value);
  for (const p of [panes.left, panes.right]) {
    if (!p.ready) continue;
    p.handle.setSetting('vhs', state.vhs);
    if (state.vhs === 0) p.handle.player.me.shake = 0;
  }
  syncUrl();
});

btnTorch.addEventListener('click', () => {
  state.torch = !state.torch;
  updateTorchButton();
  if (panes.left.ready) setPaneTorch(panes.left, state.torch);
  if (panes.right.ready) setPaneTorch(panes.right, state.torch);
});

btnDive.addEventListener('click', () => {
  state.dive = !state.dive;
  updateDiveButton();
  if (panes.left.ready) setPaneDive(panes.left, state.dive);
  if (panes.right.ready) setPaneDive(panes.right, state.dive);
});

btnWalk.addEventListener('click', () => {
  if (walkDemo.active) stopWalkDemo();
  else startWalkDemo();
});

btnReset.addEventListener('click', () => {
  stopWalkDemo();
  if (panes.left.ready) applyPresetToPane(panes.left);
  if (panes.right.ready) applyPresetToPane(panes.right);
});

function toggleChrome() {
  document.body.classList.toggle('chrome-hidden');
}
btnHide.addEventListener('click', toggleChrome);
btnUnhide.addEventListener('click', toggleChrome);

window.addEventListener('keydown', (event) => {
  if (event.target.closest('select, input, textarea')) return;
  const k = event.key.toLowerCase();
  if (k >= '1' && k <= '9') {
    const idx = Number(k) - 1;
    if (PRESETS[idx]) selectPreset(PRESETS[idx].id);
  } else if (k === 'h') {
    toggleChrome();
  } else if (k === 'l') {
    btnTorch.click();
  } else if (k === '[') {
    setSplit(state.split - 10, true);
  } else if (k === ']') {
    setSplit(state.split + 10, true);
  }
});

/* ---- Keep telemetry badges positioned cleanly below topbar ---------- */
const topbar = document.getElementById('topbar');
const positionBadges = () => {
  const top = Math.ceil(topbar.getBoundingClientRect().bottom) + 8;
  document.getElementById('badge-left').style.top = `${top}px`;
  document.getElementById('badge-right').style.top = `${top}px`;
};
new ResizeObserver(positionBadges).observe(topbar);
positionBadges();

/* ---- Boot ----------------------------------------------------------- */
buildDeck();
setSplit(state.split);
setMode(state.mode);
loadBoth({ resetPresetDefaults: true });
requestAnimationFrame(tick);
