// The look-dev lab: a few fixed test rooms of the real level, each drawn from a fixed camera with a chosen set of
// proposed graphics features, so that "the level as it draws today" and "the same room with one improvement" can be
// put side by side. Nothing here ships to players; nothing of the level's own files is changed (docs/BACKROOMS-LOOKDEV.md).
//
//   /world/dev/lookdev/?room=office&cam=a&features=none&vhs=0&t=2
//     room      office | torch | shiny | wet | tall           (rooms.js)
//     cam       a camera name of that room (rooms.js), default its first
//     features  none (today) | all | a comma list of relief,sheen,reflect,contact,water,air,grade (+ shadowmap, cold)
//     vhs       0 clean · 1 steady · 2 the camcorder as players have it (default 2)
//     t         the time, in seconds, everything that moves is drawn at (default 2)
//     live=1    keep rendering every frame (otherwise one frame is drawn and the page says `ready`)
//   window.__lab: { ready, render(), time(frames) → mean ms, set({features, t}) }
import * as THREE from 'three';
import { enterBackrooms } from '../../backrooms/index.js';
import { toWorld } from '../../backrooms/gen.js';
import { createVhs } from '../../backrooms/vhs.js';
import { FLASHLIGHT_POSES } from '../../backrooms/flashlight.js';
import { profile as graphicsProfile, gradeOf } from '../../backrooms/graphics.js';
import { themeOf } from '../../backrooms/themes.js';
import { ROOMS as ROOMS1 } from './rooms.js';
import { ROOMS2 } from './rooms2.js';
import { createLook, FEATURES } from './look.js';
import { createLook2, FEATURES2 } from './look2.js';

const q = new URLSearchParams(location.search);
const ROOMS = { ...ROOMS1, ...ROOMS2 };
const roomId = q.get('room') || 'office';
const spec = { ...ROOMS[roomId] };
if (!ROOMS[roomId]) throw new Error(`no test room ${roomId}: ${Object.keys(ROOMS).join(', ')}`);
// (for finding a picture: any of these may be overridden from the address)
if (q.has('seed')) spec.seed = q.get('seed');
if (q.has('goto')) spec.goto = /^\d+$/.test(q.get('goto')) ? Number(q.get('goto')) : q.get('goto');
if (q.has('themes')) spec.themes = q.get('themes').split(',');
if (q.has('only')) spec.only = q.get('only').split(',');
if (q.has('barricades')) spec.barricades = q.get('barricades') !== '0';
if (q.has('lighting')) spec.lighting = q.get('lighting') === '0' ? false : q.get('lighting');
let camName = q.get('cam') || Object.keys(spec.cams)[0];
if (/^[-\d.,]+$/.test(camName)) { spec.cams = { ...spec.cams, custom: camName.split(',').map(Number) }; camName = 'custom'; }
const bank = q.get('bank') || 'all';
spec.camName = camName;
// Round two stands on the level as it now draws at a Graphics tier (graphics.js): its own tube shadows, doorway light,
// sculpted fittings, grade, haze, bloom and the scene drawn larger than the tape. Round one stays on Classic.
const tier = q.get('gfx') || spec.gfx || 'classic';
const round2 = !!spec.round2;
if (q.has('variant')) spec.variant = q.get('variant');
if (q.has('held')) spec.held = q.get('held') === '1';
if (q.has('flicker')) spec.flicker = q.get('flicker') === '1';
const parseFeatures = (s) => {
  if (!s || s === 'none') return new Set();
  if (round2 && (s === 'all' || s === 'chosen')) return new Set(s === 'all' ? FEATURES2 : spec.chosen || FEATURES2);
  if (s === 'all' || s === 'high') return new Set([...FEATURES, ...(spec.allAlso || [])]);
  return new Set(s.split(',').filter(Boolean));
};
let features = parseFeatures(q.get('features'));
let T = q.has('t') ? Number(q.get('t')) : 2;
const vhsLevel = q.has('vhs') ? Number(q.get('vhs')) : 2;
const label = document.getElementById('lab');

/* ---- a stage of our own: the level asks a stage for these five things and no more ---- */
const container = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;          // (as engine/stage.js sets it; the level's shaders do not use it)
container.appendChild(renderer.domElement);
const size = { w: 1, h: 1 };
const resize = () => { size.w = Math.max(1, container.clientWidth); size.h = Math.max(1, container.clientHeight); renderer.setSize(size.w, size.h); };
resize();
const frameFns = [];
let view = null;
const stage = {
  renderer, size, quality: { fx: true, pixelRatio: renderer.getPixelRatio() },
  setView(next) { view = next || null; },
  onFrame(fn) { frameFns.push(fn); return () => frameFns.splice(frameFns.indexOf(fn), 1); },
};
const office = { stage, creations: {}, net: { state: { world: { plan: { rooms: ['Webstore', 'Mobile App', 'Api Gateway', 'Data Pipeline'].map((name, slot) => ({ slot, deptId: name.toLowerCase().replace(/ /g, '-'), name })) } }, agents: new Map(), tasks: new Map() } } };

/* ---- the level, stood in one room ---- */
const ready = new Promise((resolve) => {
  enterBackrooms(office, {
    name: 'Robin', seed: spec.seed, only: spec.only, themes: spec.themes, pursuer: false, vhs: vhsLevel, mute: true, debug: true, graphics: tier,
    scorecard: false, inventory: false, barricades: spec.barricades ?? false, count: spec.count,
    dev: { cast: ['nobody'], owns: () => false, lighting: spec.lighting || false },
    onReady(handle) { resolve(handle); },
  }).catch((err) => { console.error(err); document.title = 'error'; });
});
const pump = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) for (const fn of [...frameFns]) fn(dt, i * dt, i); };

const handle = await ready;
pump(2);
const cam = spec.cams[camName];
const target = spec.goto;
if (!handle.goto(target, cam[0], cam[1], cam[2], cam[3] || 0)) console.warn(`[lab] no ${target} on this floor`);
pump(45);                                              // on its feet; rooms that settle have settled
const level = handle.level, world = handle.world, env = handle.env, kit = env.kit;
const rt = world.current();
const def = rt.def;
// Our own camera, copied from where the level put its eye (and then held still: no bob, no shake).
const camera = new THREE.PerspectiveCamera(view.camera.fov, 4 / 3, view.camera.near, view.camera.far);
view.camera.updateMatrixWorld(true);
camera.position.copy(view.camera.position); camera.quaternion.copy(view.camera.quaternion);
if (cam[4] !== undefined) camera.position.y = cam[4];
camera.updateMatrixWorld(true);
// The level stops here: from now on nothing of it runs but what the lab asks for (so the picture holds still).
frameFns.length = 0;
for (const r of world.rooms) { r.u.flick.value = 1; }
const root = handle.root;

/* ---- the camcorder, the real one ---- */
const vhs = createVhs(renderer, camera, { bloom: true, level: vhsLevel, ...(tier !== 'classic' ? { profile: graphicsProfile(tier) } : {}) });
vhs.setScene(root);
if (tier !== 'classic') vhs.setGrade(gradeOf(themeOf(level.theme)));

/* ---- what the room is, for the proposed features ---- */
const toW = (x, z) => toWorld(def, x, z);
// the lights out (the kit's own per-room dimmer, as the level's black-outs use it) and the tubes dark with them
if (spec.dim !== undefined) {
  rt.u.dim.value = spec.dim;
  const dark = (m) => { if (m?.material?.color) m.material.color.multiplyScalar(spec.dim * 0.5); };
  dark(rt.panelMesh); rt.flickers.forEach(dark); rt.bankPanels.forEach(dark);
}
const built = await spec.build?.({ THREE, root, rt, def, kit, toW, world, level, camera }) || {};
spec.occluders = [...(spec.occluders || []), ...(built.occluders || [])];
if (built.water) spec.water = built.water;
const look = await (round2 ? createLook2 : createLook)({ THREE, renderer, root, camera, world, rt, def, kit, level, toW, spec, vhs, size, tier, vhsLevel, bank });
await spec.extras?.({ THREE, root, rt, def, kit, toW, look, world, built, camera });

function torchOn() {
  kit.shared.uTorch.value = spec.torch ? 1.5 : 0;
  kit.shared.uCameraLamp.value = spec.cameraLamp ?? 0;
  const pose = FLASHLIGHT_POSES.hand;
  kit.shared.uTorchOrigin.value.fromArray(pose.origin);
  if (spec.torchAim) kit.shared.uTorchDirection.value.set(...spec.torchAim).normalize();
  else kit.shared.uTorchDirection.value.fromArray(pose.direction);
}

let lastFeatures = null;
function setBanks() {
  const b = spec.banks?.[bank];
  if (b && rt.lighting) {
    rt.u.banks.value = [b[0], b[1]]; if (b.length > 2) rt.u.moreBanks.value = [b[2], b[3] ?? 0];
    for (const m of rt.bankPanels) { const k = [b[0], b[1], b[2] ?? 0, b[3] ?? 0][m.userData.bank] ?? 1; m.material.color.copy(m.userData.on).multiplyScalar(k); }
  }
}
function render() {
  setBanks();
  const key = [...features].sort().join(',');
  if (key !== lastFeatures) { look.apply(features); lastFeatures = key; }
  torchOn();
  look.update(T, features);
  vhs.layout(size.w, size.h);
  // the camcorder's own clock is pinned too (its noise and tracking band move with it)
  vhs.uniforms.uTime.value = T;
  // (round two: the camcorder's gain and haze as the level sets them for a visitor standing here: index.js)
  const light = rt.level * rt.u.dim.value;
  vhs.uniforms.uGain.value = spec.gain ?? (round2 ? Math.max(0.9, Math.min(2.3, Math.pow(0.3 / Math.max(light, 0.04), 0.55))) : 1);
  if (round2) vhs.setAmbient(light);
  look.draw(features, () => vhs.render(0));
}

if (q.has('dbg')) { look.debug = q.get('dbg'); look.debugK = Number(q.get('dbgk') || 1); }
window.__lab = {
  look,
  room: roomId, cam: camName, tier, def: { arch: def.arch, kind: def.kind, W: def.W, D: def.D, H: def.H, rot: def.rot, x: def.x, z: def.z, theme: level.theme?.id || level.theme },
  get features() { return [...features]; },
  set(o = {}) { if (o.features !== undefined) features = parseFeatures(o.features); if (o.t !== undefined) T = o.t; render(); },
  render,
  /** mean milliseconds a frame over n frames, the GPU made to finish each one */
  time(n = 200) {
    const gl = renderer.getContext();
    const px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // (finish() does not wait in a browser: a read-back does)
    render(); sync();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { render(); sync(); }
    return (performance.now() - t0) / n;
  },
  info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures }),
  where: () => handle.where(),
  sketch: () => handle.sketch?.(),
  rooms: () => world.rooms.map((r) => ({ id: r.id, arch: r.def.arch, kind: r.def.kind, W: r.def.W, D: r.def.D, H: r.def.H, level: +r.level.toFixed(2), lighting: r.lighting?.kind, solids: r.colliders.length, furniture: world.furniture?.filter((f) => f.room === r || f.rt === r).length, doors: r.def.doors.map((d) => ({ side: d.side, c: d.c, w: d.w, to: d.to })) })),
  lamps: () => rt.lights.map((L) => ({ x: +L.x.toFixed(2), y: +L.y.toFixed(2), z: +L.z.toFixed(2), flick: L.flick, bank: L.bank, lobe: L.lobe, rgb: [L.r, L.g, L.b].map((v) => +v.toFixed(2)) })),
  current: () => ({ id: rt.id, arch: def.arch, kind: def.kind, W: def.W, D: def.D, H: def.H, look: def.look, lighting: rt.lighting?.kind, lamps: rt.lights.length, colliders: rt.colliders.length, occluders: look.occluders.length, bake: look.baked.stats, doors: def.doors.map((d) => ({ side: d.side, c: d.c, w: d.w, h: d.h, to: d.to, toLevel: world.rooms[d.to]?.level })) }),
};
render();
label.textContent = `${roomId} · ${camName} · ${bank} · ${[...features].join(',') || 'today'} · vhs ${vhsLevel} · t ${T}`;
if (q.get('live') === '1') { const loop = () => { T += 1 / 60; render(); requestAnimationFrame(loop); }; loop(); }
window.__lab.ready = true;
document.title = 'ready';
