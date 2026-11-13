// The Office — the 3D client. Assembles the stage, the building, the
// furniture and the people from what the daemon says, and keeps them in step
// with it. The rest of the UI (ui/*.js) hangs off the `office` object this
// module builds.
import * as THREE from 'three';
import { createStage } from './engine/stage.js';
import { createCameraRig } from './engine/camera.js';
import { createLighting } from './scene/lighting.js';
import { buildBuilding } from './scene/building.js';
import { furnish } from './scene/furnish.js';
import { createScreens } from './scene/screens.js';
import { createPeople } from './scene/people.js';
import { buildDeskItem, buildHat } from './scene/deskitems.js';
import { createExhibits } from './scene/exhibits.js';
import { createDynamics } from './scene/dynamics.js';
import { createFx } from './scene/fx.js';
import { createCat } from './scene/creatures.js';
import { createWalk } from './walk.js';
import { createEggs } from './eggs.js';
import { createNet } from './net.js';
import { createUI } from './ui/index.js';
import { VOXEL } from './vox/vox.js';
import { DESK } from './props/office.js';
import { buildLayout, faceAngle } from '/core/layout.mjs';
import { createNav } from '/core/nav.mjs';
import { hashId } from '/core/look.mjs';

const q = new URLSearchParams(location.search);
const stage = createStage(document.getElementById('stage'), {
  fx: q.get('fx') !== '0', shadows: q.get('shadows') !== '0', preserve: q.has('shot'),
  pixelRatio: q.has('shot') ? Number(q.get('dpr') || 1) : undefined,
});
const net = createNet();
const lighting = createLighting(stage, { shadowSize: Number(q.get('shadowmap') || 2048) });
const screens = createScreens();
const rig = createCameraRig(stage, {});

// what the person chose, remembered in this browser
const settings = (() => {
  let data = {};
  try { data = JSON.parse(localStorage.getItem('office.settings') || '{}') || {}; } catch { data = {}; }
  const defaults = { graphics: 'auto', time: 'auto' };
  const listeners = new Set();
  return {
    get: (k) => data[k] ?? defaults[k],
    set(k, v) { data[k] = v; try { localStorage.setItem('office.settings', JSON.stringify(data)); } catch { /* fine */ } for (const fn of listeners) fn(k, v); },
    on: (fn) => listeners.add(fn),
  };
})();

const office = {
  stage, net, lighting, screens, rig, q, settings,
  world: null,                 // { layout, nav, building, furniture, planKey }
  people: null,
  creations: {},               // id → creation spec
  ready: false,
};
window.office = office;        // for the console, and for the curious
office.fx = createFx(office);
office.exhibits = createExhibits(office);
office.dynamics = createDynamics(office);
office.cat = createCat(office);
office.walk = createWalk(office);
office.ui = q.get('ui') === '0' ? null : createUI(office);
office.eggs = createEggs(office);
office.onUsed = (target, result) => office.eggs.used(target, result);

/* ---- desk items ---------------------------------------------------------------- */
function makeItems(agent, group, desk) {
  const ids = agent.profile?.desk?.items || [];
  const seed = agent.persona || agent.id;
  const turn = -faceAngle(desk.face);                       // things on a desk face the room, not the wall
  ids.slice(0, DESK.items.length).forEach((id, i) => {
    let item;
    try { item = buildDeskItem(id, seed, office.creations); } catch (err) { console.warn('[office] desk item', id, err); return; }
    const [x, y, z] = DESK.items[i];
    item.position.set(x * VOXEL, y * VOXEL, z * VOXEL);
    item.rotation.y = turn + ((hashId(seed + id) % 100) / 100 - 0.5) * 0.5;
    group.add(item);
  });
}
const itemsKey = (agent) => (agent.profile?.desk?.items || []).join(',');

/* ---- the world: build it, rebuild it when the floor plan changes --------------- */
function dispose(object) {
  object.traverse((o) => { if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.(); });
}

function buildWorld(snapshot) {
  const planKey = JSON.stringify(snapshot.plan || {});
  if (office.world && office.world.planKey === planKey) return false;
  const first = !office.world;
  if (office.world) {
    stage.scene.remove(office.world.building.group, office.world.furniture.group);
    dispose(office.world.building.group);
  }
  const layout = buildLayout(snapshot.plan || {});
  const nav = createNav(layout);
  const building = buildBuilding(layout);
  const furniture = furnish(layout, building, { screens, onLampsChanged: () => { office.lampsDirty = true; } });
  stage.scene.add(building.group, furniture.group);
  office.world = { layout, nav, building, furniture, planKey };
  rig.setBounds(layout.bounds);
  if (!office.people) {
    office.people = createPeople({ layout, nav, furniture, screens, now: net.now, makeItems,
      hatFor: (look) => { const spec = office.creations[look?.accessory]; return spec && spec.kind === 'hat' ? buildHat(spec) : null; },
      itemsChanged: (person, agent) => { const k = itemsKey(agent); if (person.itemsKey === k) return false; person.itemsKey = k; return true; } });
    stage.scene.add(office.people.group);
  } else office.people.rebind(office.world);
  for (const [deptId, tasks] of net.state.tasks) furniture.boards.get(deptId)?.setTasks(tasks);
  if (first) rig.overview(true);
  office.lampsDirty = true; office.clockAt = undefined;
  office.dynamics.bind();
  return true;
}

function syncPeople() {
  if (!office.people) return;
  for (const agent of net.state.agents.values()) office.people.setAgent(agent);
  for (const id of [...office.people.people.keys()]) if (!net.state.agents.has(id)) office.people.remove(id);
  for (const [id, place] of net.state.places) if (!office.people.people.get(id)?.place) office.people.setPlace(id, place);
}

net.on('world', (snapshot) => {
  buildWorld(snapshot);
  syncPeople();
  office.cat.place(snapshot.cat);
  office.exhibits.sync();
  office.ready = true;
  document.body.classList.add('ready');
});
net.on('snapshot', () => syncPeople());
net.on('agent', (agent) => { office.people?.setAgent(agent); const p = net.state.places.get(agent.id); if (p && !office.people?.people.get(agent.id)?.place) office.people.setPlace(agent.id, p); });
net.on('remove', (id) => office.people?.remove(id));
net.on('place', (id, place) => office.people?.setPlace(id, place));
net.on('tasks', (deptId, tasks) => office.world?.furniture.boards.get(deptId)?.setTasks(tasks));
net.on('status', (up) => document.body.classList.toggle('offline', !up));
net.on('object', (object) => {                       // a team rearranged its shelf
  if (object?.kind === 'shelf' && net.state.world) { (net.state.world.shelves ||= {})[object.deptId] = object.items; office.exhibits.sync(); }
});
net.on('creations', async () => {                    // someone signed a new creation: the gallery moves along one
  await loadCreations();
  try { const world = await net.api('/api/world'); if (net.state.world) net.state.world.gallery = world.gallery; } catch { /* next snapshot will have it */ }
  if (net.state.world) office.exhibits.sync();
});

async function loadCreations() {
  try {
    const data = await net.api('/creations.json');
    office.creations = Object.fromEntries((data?.creations || []).map((c) => [c.id, c]));
  } catch { office.creations = {}; }
}

/* ---- every frame ----------------------------------------------------------------- */
const forcedHour = q.has('hour') ? Number(q.get('hour')) : null;
const FIXED_HOUR = { day: 13, dusk: 18.4, night: 22 };
function officeHour() {
  if (forcedHour !== null && Number.isFinite(forcedHour)) return forcedHour;
  if (FIXED_HOUR[settings.get('time')] !== undefined) return FIXED_HOUR[settings.get('time')];
  const tz = net.state.world?.today?.tzOffsetMin;
  const d = new Date(net.now() + (Number.isFinite(tz) ? tz : -new Date().getTimezoneOffset()) * 60000);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

stage.onFrame((dt, t, frame) => {
  rig.update(dt);
  if (t - office.clockAt > 2 || office.clockAt === undefined) {       // the office clock moves slowly; check it now and then
    office.clockAt = t;
    const h = officeHour();
    lighting.setHour(h); office.world?.building.setSky(h);
  }
  if (office.lampsDirty && office.world) { office.lampsDirty = false; lighting.setLamps(office.world.furniture.lamps()); }
  lighting.follow(rig.cur, rig.cur.dist);
  office.world?.building.update(stage.camera, dt);
  office.people?.update(dt);
  office.cat.update(dt);
  office.walk.update(dt);
  office.eggs.update(dt, t);
  office.exhibits.update(dt);
  office.dynamics.update(dt, t);
  office.fx.update(dt);
  office.ui?.update(dt);
  screens.update(t);
  // the further out you are, the more it looks like a model on a table
  const far = THREE.MathUtils.smoothstep(rig.cur.dist, 14, 60);
  stage.setTilt(0.35 + far * 0.55, 0.5, 0.26 - far * 0.06);
});

/* ---- graphics: pretty when the machine can, fast when it cannot ------------------------ */
function applyGraphics() {
  const mode = settings.get('graphics');
  if (mode === 'fast') stage.setQuality({ fx: false, pixelRatio: 1 });
  else stage.setQuality({ fx: q.get('fx') !== '0', pixelRatio: Math.min(window.devicePixelRatio || 1, 2) });
}
settings.on((key) => { if (key === 'graphics') applyGraphics(); if (key === 'time') office.clockAt = undefined; });
if (!q.has('shot')) {
  applyGraphics();
  let strikes = 0;
  setInterval(() => {                                        // falling behind for a while? step the quality down, once
    if (settings.get('graphics') !== 'auto' || document.hidden || !office.ready) { strikes = 0; return; }
    strikes = stage.frameMs > 42 ? strikes + 1 : 0;
    if (strikes < 3) return;
    strikes = 0;
    if (stage.quality.pixelRatio > 1) stage.setQuality({ pixelRatio: 1 });
    else if (stage.quality.fx) { stage.setQuality({ fx: false }); office.ui?.toast('Switched to faster graphics. (Ctrl-K → Graphics to change it back.)'); }
  }, 2500);
}

await loadCreations();
net.connect();
stage.start();

/* ---- deep links: ?room=<id> ?agent=<id> ?cam=x,z,dist,yaw,pitch ------------------- */
function applyDeepLink() {
  const w = office.world;
  if (!w) return;
  if (q.get('room')) {
    const room = w.layout.roomById.get(q.get('room')) || w.layout.rooms.find((r) => r.deptId === q.get('room'));
    if (room) rig.frame(room.rect, { instant: true });
  }
  if (q.get('agent')) {
    const want = q.get('agent').toLowerCase();
    const agent = [...net.state.agents.values()].find((a) => a.id === q.get('agent') || a.name.toLowerCase() === want);
    if (agent) office.ui?.select(agent.id);
  }
  if (q.get('cam')) {
    const [x, z, dist, yaw, pitch] = q.get('cam').split(',').map(Number);
    rig.flyTo({ x, z, dist, yaw, pitch }, { instant: true });
  }
}
const once = net.on('world', () => { once(); applyDeepLink(); });

export { office };
