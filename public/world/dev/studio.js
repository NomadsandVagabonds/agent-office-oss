// The prop studio: a neutral room for looking at furniture while you sculpt it.
//   /world/dev/studio.html?show=desk,chair,sofa        things from the catalogue (props/index.js)
//   &from=kitchen  load ONE props file (props/kitchen.js) instead of the whole catalogue —
//                  use this while writing a file, so nobody else's half-finished file gets in your way
//   &turn=1        quarter turns, to see the sides and back
//   &cam=wide|close|top|low      &hour=14      &who=1  (a person, for scale)      &fx=0
// Everything is lit and post-processed exactly like the real office.
import * as THREE from 'three';
import { createStage } from '../engine/stage.js';
import { createCameraRig } from '../engine/camera.js';
import { createLighting } from '../scene/lighting.js';
import { FLOORS, WALLS, WALL_H, signTexture } from '../scene/textures.js';
import { voxObject } from '../vox/material.js';
import { Avatar } from '../avatar/rig.js';
import { resolveLook } from '/core/look.mjs';
import { VOXEL } from '../vox/vox.js';

const q = new URLSearchParams(location.search);
const stage = createStage(document.getElementById('stage'), { fx: q.get('fx') !== '0', preserve: true, pixelRatio: Number(q.get('dpr') || 1) });
const lighting = createLighting(stage);
lighting.setHour(Number(q.get('hour') || 14));
const rig = createCameraRig(stage, { bounds: { x0: -30, z0: -6, x1: 30, z1: 6 } });

// the whole catalogue, or just one file of it
let PROPS;
if (q.get('from')) PROPS = (await import(`/world/props/${q.get('from').replace(/[^a-z0-9_-]/gi, '')}.js`)).CATALOGUE;
else PROPS = (await import('../props/index.js')).PROPS;
function buildProp(type, o) {
  const entry = PROPS[type];
  return voxObject(() => entry.make(o), { key: `${type}:${entry.variant ? entry.variant(o) : ''}:${o.id}` });
}

const names = (q.get('show') || 'all').split(',').map((s) => s.trim()).filter(Boolean);
const list = names.includes('all') ? Object.keys(PROPS) : names;
const turn = Number(q.get('turn') || 0) * Math.PI / 2;
const gap = Number(q.get('gap') || 0.5);

const items = [];
let x = 0;
const stats = {};
for (const entry of list) {
  // "boxes#2" shows another variant of the same kind (a different object id)
  const [name, tag = 'studio'] = entry.split('#');
  if (!PROPS[name]) { console.error(`no such prop: ${name}`); continue; }
  let node;
  const extra = {};
  for (const [k, val] of q) if (k.startsWith('o.')) extra[k.slice(2)] = Number.isFinite(Number(val)) ? Number(val) : val;   // &o.stage=3 → passed to make()
  try { node = buildProp(name, { id: `${name}:${tag}`, type: name, ...extra }); } catch (err) { console.error(`prop ${name} failed: ${err.message}`); continue; }
  const b = node.userData.bounds;
  const w = (b.x1 - b.x0) * VOXEL, d = (b.z1 - b.z0) * VOXEL, h = (b.y1 - b.y0) * VOXEL;
  const span = Math.max(w, d);
  const holder = new THREE.Group();
  holder.add(node);
  holder.rotation.y = turn;
  holder.position.set(x + span / 2, PROPS[name].y || 0, 0);
  stage.scene.add(holder);
  // a label on the floor in front
  const tex = signTexture(`${entry}  ${b.x1 - b.x0}×${b.y1 - b.y0}×${b.z1 - b.z0}  ${node.userData.quads}q`, { size: 10 });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.2 * tex.userData.aspect, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
  label.rotation.x = -Math.PI / 2; label.position.set(x + span / 2, 0.01, Math.max(d, w) / 2 + 0.45);
  stage.scene.add(label);
  stats[entry] = { size: [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0], min: [b.x0, b.y0, b.z0], quads: node.userData.quads };
  items.push({ name, x: x + span / 2, span, h });
  x += span + gap;
}
const total = Math.max(1, x - gap);
for (const o of stage.scene.children) if (o.isGroup || (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.material.map?.userData?.aspect)) o.position.x -= total / 2;

if (q.get('who')) {
  const a = new Avatar(resolveLook('studio-person'), { seed: 'studio-person', provider: 'claude' });
  a.root.position.set(total / 2 + 0.7, 0, 0.2);
  a.snap('stand');
  stage.scene.add(a.root);
}

// a floor and a back wall, so shadows and silhouettes can be judged
const fl = FLOORS.wood('#a5764a');
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshLambertMaterial({ map: fl.tex }));
fl.tex.repeat.set(80 / fl.size, 30 / fl.size);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
stage.scene.add(floor);
const wl = WALLS.plaster();
const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, WALL_H), new THREE.MeshLambertMaterial({ map: wl.tex.clone() }));
wall.material.map.repeat.set(80 / wl.tile, 1); wall.material.map.needsUpdate = true;
wall.position.set(0, WALL_H / 2, -2.2); wall.receiveShadow = true;
stage.scene.add(wall);

const tallest = Math.max(1, ...items.map((i) => i.h));
const cam = q.get('cam') || 'wide';
const views = { wide: [0.3, 0.55, 1], close: [0.45, 0.42, 0.72], top: [0, 1.45, 1], low: [-0.5, 0.2, 0.85], back: [Math.PI - 0.5, 0.5, 1] };
const [yaw, pitch, k] = views[cam] || views.wide;
const wide = total + (q.get('who') ? 1.6 : 0);
rig.frame({ x: -total / 2, z: -tallest * 0.9, w: wide, d: Math.max(1.6, tallest * 1.8) }, { instant: true, yaw, pitch });
rig.flyTo({ dist: rig.goal.dist * k * Number(q.get('zoom') || 1) }, { instant: true });
if (cam === 'back') wall.visible = false;

stage.onFrame((dt) => { rig.update(dt); lighting.follow(rig.cur, rig.cur.dist); });
stage.start();
window.__stats = stats;
document.title = 'ready';
