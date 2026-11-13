// The Office — the building shell: floors, walls, windows, doorways.
//
// Built straight from core/layout.mjs (the same floor plan the daemon uses),
// so what you see is what agents are told about. Walls are split at knee
// height: the low stub always stays, and the upper part of any wall that is
// between you and a room quietly folds away, so you can always look in — a
// doll's house whose near walls step aside as you walk around it.
import * as THREE from 'three';
import { FLOORS, WALLS, WALL_H, mixHex, skylineTexture } from './textures.js';
import { hashId } from '/core/look.mjs';

export const WALL_T = 0.14;
export const STUB = 0.42;
const DOOR_H = 2.12;

const ROOM_HUES = ['#3f7d74', '#5a6fa8', '#8a5a8f', '#6f8a4a', '#b5683f', '#c9893f', '#3f7f9a', '#8a5a62'];

/** Colours for a room: wallpaper, carpet, accent. Stable per project. */
export function roomPalette(room) {
  const base = room.color || ROOM_HUES[hashId(String(room.deptId || room.id)) % ROOM_HUES.length];
  return { accent: base, wall: mixHex(base, '#7d8480', 0.3), carpet: mixHex(base, '#5a524c', 0.84), rug: mixHex(base, '#2a2018', 0.22) };
}

function floorStyle(room) {
  switch (room.kind) {
    case 'project': return FLOORS.carpet(roomPalette(room).carpet);
    case 'vacant': return FLOORS.concrete('#6a665f');
    case 'library': return FLOORS.wood('#6b4a2f');
    case 'kitchen': return FLOORS.tile();
    case 'plaza': case 'landing': return FLOORS.wood('#a5764a');
    case 'foyer': return FLOORS.tile('#b9b2a6', '#a8a195');
    case 'corridor': return FLOORS.carpet('#5d5348');
    case 'server': return FLOORS.raised();
    case 'closet': return FLOORS.concrete();
    case 'elevator': return FLOORS.tile('#8a8f98', '#7d828b');
    case 'backroom': return FLOORS.carpet('#3a2a4d');
    default: return FLOORS.carpet();
  }
}

function wallStyle(room) {
  if (!room) return WALLS.brick();
  switch (room.kind) {
    case 'project': return WALLS.office(roomPalette(room).wall);
    case 'vacant': return WALLS.closet();
    case 'library': return WALLS.library();
    case 'kitchen': return WALLS.kitchen();
    case 'server': return WALLS.server();
    case 'closet': return WALLS.closet();
    case 'elevator': return WALLS.steel();
    case 'backroom': return WALLS.backroom();
    default: return WALLS.plaster();
  }
}

/* ---- a tiny batcher: many quads, one mesh per material ---------------------- */
class Batch {
  constructor() { this.parts = new Map(); }
  _part(material) {
    let p = this.parts.get(material);
    if (!p) { p = { pos: [], nor: [], uv: [], idx: [] }; this.parts.set(material, p); }
    return p;
  }
  /** corners counter-clockwise seen from the normal's side; uv as [u0,v0,u1,v1] */
  quad(material, a, b, c, d, n, uv = [0, 0, 1, 1]) {
    const p = this._part(material);
    const s = p.pos.length / 3;
    p.pos.push(...a, ...b, ...c, ...d);
    for (let i = 0; i < 4; i++) p.nor.push(...n);
    p.uv.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    p.idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
  }
  /** an axis-aligned box in one flat material */
  box(material, x0, y0, z0, x1, y1, z1) {
    this.quad(material, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    this.quad(material, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    this.quad(material, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    this.quad(material, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    this.quad(material, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    this.quad(material, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  }
  build(parent, { cast = true, receive = true } = {}) {
    for (const [material, p] of this.parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(p.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(p.uv, 2));
      geo.setIndex(p.idx);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = cast && !material.transparent; mesh.receiveShadow = receive;
      if (material.transparent) mesh.renderOrder = 3;
      parent.add(mesh);
    }
  }
}

const materials = new Map();
function texMat(tex) {
  if (!materials.has(tex)) materials.set(tex, new THREE.MeshLambertMaterial({ map: tex }));
  return materials.get(tex);
}
function flat(color, opt = {}) {
  const key = color + JSON.stringify(opt);
  if (!materials.has(key)) materials.set(key, new THREE.MeshLambertMaterial({ color, ...opt }));
  return materials.get(key);
}
const GLASS = () => flat('#bfe0ea', { transparent: true, opacity: 0.2, depthWrite: false });
// what you see through the outside windows: a painted sky that follows the clock
const skyMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
function setSky(hour) {
  const tex = skylineTexture(hour, 1);
  tex.wrapS = THREE.RepeatWrapping;
  if (skyMaterial.map !== tex) { skyMaterial.map = tex; skyMaterial.needsUpdate = true; }
  const night = hour < 5.5 || hour >= 20.5;
  skyMaterial.color.setScalar(night ? 0.9 : 1.15);
}
setSky(14);
const TRIM = () => flat('#3b2a1c');
const FRAME = () => flat('#5a4024');
const METAL = () => flat('#6d7582');

/**
 * @param {object} layout  from buildLayout(plan)
 * @returns {{group:THREE.Group, floors:THREE.Mesh[], update:(camera:THREE.Camera, dt:number)=>void,
 *            attachToWall:(object:THREE.Object3D, x:number, z:number)=>boolean, doors:Map<string,object>}}
 */
export function buildBuilding(layout) {
  const group = new THREE.Group();
  const floors = [];

  /* ---- floors ----------------------------------------------------------- */
  for (const room of layout.rooms) {
    if (room.locked) continue;
    const style = floorStyle(room);
    const { x, z, w, d } = room.rect;
    const geo = new THREE.BufferGeometry();
    const s = style.size;
    geo.setAttribute('position', new THREE.Float32BufferAttribute([x, 0, z, x, 0, z + d, x + w, 0, z + d, x + w, 0, z], 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([x / s, -z / s, x / s, -(z + d) / s, (x + w) / s, -(z + d) / s, (x + w) / s, -z / s], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new THREE.Mesh(geo, texMat(style.tex));
    mesh.receiveShadow = true;
    mesh.userData.room = room.id;
    group.add(mesh);
    floors.push(mesh);
  }
  // the slab the whole model stands on
  const b = layout.bounds;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0 + 0.8, 0.5, b.z1 - b.z0 + 0.8), flat('#2c2530'));
  slab.position.set((b.x0 + b.x1) / 2, -0.262, (b.z0 + b.z1) / 2);
  slab.receiveShadow = true;
  group.add(slab);

  /* ---- walls ------------------------------------------------------------ */
  // Upper wall sections that hide together share a group: runs with the same
  // orientation and the same "is there a room on each side" behave identically.
  const lower = new Batch();
  const classes = new Map();      // key → { batch, group, cut, o, aIn, bIn, never }
  const getClass = (o, aIn, bIn, never) => {
    const key = `${o}${aIn ? 1 : 0}${bIn ? 1 : 0}${never ? 'n' : ''}`;
    if (!classes.has(key)) {
      const g = new THREE.Group();
      g.position.y = STUB;
      group.add(g);
      classes.set(key, { key, batch: new Batch(), group: g, cut: 0, o, aIn, bIn, never });
    }
    return classes.get(key);
  };
  const runs = [];
  const hiddenRooms = new Set(layout.rooms.filter((r) => r.locked || r.kind === 'elevator').map((r) => r.id));

  /** One face of a wall section: a textured quad between heights y0..y1 (absolute). */
  function face(batch, style, o, line, from, to, side, y0, y1, yBase) {
    const mat = texMat(style.tex);
    const off = (side < 0 ? -1 : 1) * WALL_T / 2;
    const u0 = from / style.tile, u1 = to / style.tile;
    const v0 = y0 / WALL_H, v1 = y1 / WALL_H;
    const a = y0 - yBase, c = y1 - yBase;
    if (o === 'h') {
      const z = line + off;
      if (side > 0) batch.quad(mat, [from, a, z], [to, a, z], [to, c, z], [from, c, z], [0, 0, 1], [u0, v0, u1, v1]);
      else batch.quad(mat, [to, a, z], [from, a, z], [from, c, z], [to, c, z], [0, 0, -1], [-u1, v0, -u0, v1]);
    } else {
      const x = line + off;
      if (side > 0) batch.quad(mat, [x, a, to], [x, a, from], [x, c, from], [x, c, to], [1, 0, 0], [-u1, v0, -u0, v1]);
      else batch.quad(mat, [x, a, from], [x, a, to], [x, c, to], [x, c, from], [-1, 0, 0], [u0, v0, u1, v1]);
    }
  }
  /** A box that follows a wall run (for caps, rails, sills, glass). */
  function along(batch, material, o, line, from, to, y0, y1, yBase, thick = WALL_T, shift = 0) {
    const h = thick / 2;
    if (o === 'h') batch.box(material, from, y0 - yBase, line - h + shift, to, y1 - yBase, line + h + shift);
    else batch.box(material, line - h + shift, y0 - yBase, from, line + h + shift, y1 - yBase, to);
  }

  for (const w of layout.walls) {
    const ra = w.a ? layout.roomById.get(w.a) : null, rb = w.b ? layout.roomById.get(w.b) : null;
    const sa = wallStyle(ra), sb = wallStyle(rb);
    const never = w.type === 'glass' || hiddenRooms.has(w.a) || hiddenRooms.has(w.b);
    const cls = getClass(w.o, !!ra, !!rb, never);
    const up = cls.batch;
    runs.push({ ...w, cls });
    // the stub
    face(lower, sa, w.o, w.line, w.from, w.to, -1, 0, STUB, 0);
    face(lower, sb, w.o, w.line, w.from, w.to, 1, 0, STUB, 0);
    along(lower, TRIM(), w.o, w.line, w.from - WALL_T / 2, w.to + WALL_T / 2, STUB - 0.001, STUB + 0.02, 0, WALL_T + 0.02);

    if (w.type === 'glass') {
      face(up, sa, w.o, w.line, w.from, w.to, -1, STUB, 0.94, STUB);
      face(up, sb, w.o, w.line, w.from, w.to, 1, STUB, 0.94, STUB);
      along(up, FRAME(), w.o, w.line, w.from, w.to, 0.94, 1.0, STUB, WALL_T + 0.03);
      along(up, GLASS(), w.o, w.line, w.from, w.to, 1.0, 2.3, STUB, 0.03);
      along(up, FRAME(), w.o, w.line, w.from, w.to, 2.3, 2.4, STUB, WALL_T);
      for (let p = w.from; p <= w.to + 1e-6; p += 2) along(up, FRAME(), w.o, w.line, Math.min(p, w.to) - 0.035, Math.min(p, w.to) + 0.035, 1.0, 2.3, STUB, 0.07);
    } else if (w.type === 'window') {
      face(up, sa, w.o, w.line, w.from, w.to, -1, STUB, 1.0, STUB);
      face(up, sb, w.o, w.line, w.from, w.to, 1, STUB, 1.0, STUB);
      face(up, sa, w.o, w.line, w.from, w.to, -1, 2.2, WALL_H, STUB);
      face(up, sb, w.o, w.line, w.from, w.to, 1, 2.2, WALL_H, STUB);
      along(up, TRIM(), w.o, w.line, w.from, w.to, WALL_H - 0.001, WALL_H + 0.02, STUB, WALL_T + 0.02);
      along(up, GLASS(), w.o, w.line, w.from + 0.06, w.to - 0.06, 1.0, 2.2, STUB, 0.025);
      const mid = (w.from + w.to) / 2;
      for (const p of [w.from + 0.03, mid, w.to - 0.03]) along(up, FRAME(), w.o, w.line, p - 0.035, p + 0.035, 1.0, 2.2, STUB, WALL_T + 0.02);
      for (const y of [1.0, 1.6, 2.14]) along(up, FRAME(), w.o, w.line, w.from, w.to, y, y + 0.06, STUB, WALL_T + 0.02);
      along(up, FRAME(), w.o, w.line, w.from - 0.06, w.to + 0.06, 0.95, 1.0, STUB, WALL_T + 0.16);   // sill
      if (w.exterior) {                                                   // the view outside, facing in
        const out = (ra ? 1 : -1) * 0.05, at = w.line + out, y0 = 1.0 - STUB, y1 = 2.2 - STUB;
        const uv = [w.from / 16, 0.12, w.to / 16, 0.95];
        if (w.o === 'h' && !ra) up.quad(skyMaterial, [w.from, y0, at], [w.to, y0, at], [w.to, y1, at], [w.from, y1, at], [0, 0, 1], uv);
        else if (w.o === 'h') up.quad(skyMaterial, [w.to, y0, at], [w.from, y0, at], [w.from, y1, at], [w.to, y1, at], [0, 0, -1], uv);
        else if (!ra) up.quad(skyMaterial, [at, y0, w.to], [at, y0, w.from], [at, y1, w.from], [at, y1, w.to], [1, 0, 0], uv);
        else up.quad(skyMaterial, [at, y0, w.from], [at, y0, w.to], [at, y1, w.to], [at, y1, w.from], [-1, 0, 0], uv);
      }
    } else if (w.type === 'entrance') {
      face(up, sa, w.o, w.line, w.from, w.to, -1, 2.2, WALL_H, STUB);
      face(up, sb, w.o, w.line, w.from, w.to, 1, 2.2, WALL_H, STUB);
      along(up, GLASS(), w.o, w.line, w.from + 0.05, w.to - 0.05, STUB, 2.2, STUB, 0.03);
      const mid = (w.from + w.to) / 2;
      for (const p of [w.from + 0.03, mid, w.to - 0.03]) along(up, METAL(), w.o, w.line, p - 0.03, p + 0.03, STUB, 2.2, STUB, WALL_T);
      along(up, METAL(), w.o, w.line, w.from, w.to, 2.14, 2.2, STUB, WALL_T);
      for (const p of [mid - 0.18, mid + 0.12]) along(up, flat('#d8c48a'), w.o, w.line, p, p + 0.06, 0.95, 1.25, STUB, WALL_T + 0.08);
    } else {
      face(up, sa, w.o, w.line, w.from, w.to, -1, STUB, WALL_H, STUB);
      face(up, sb, w.o, w.line, w.from, w.to, 1, STUB, WALL_H, STUB);
      along(up, TRIM(), w.o, w.line, w.from - WALL_T / 2, w.to + WALL_T / 2, WALL_H - 0.001, WALL_H + 0.02, STUB, WALL_T + 0.02);
    }
  }

  /* ---- doorways --------------------------------------------------------- */
  const doors = new Map();
  const spans = new Map();
  for (const d of layout.doors) {
    if (d.kind === 'secret') continue;
    const key = `${d.id}:${d.o}:${d.o === 'h' ? d.z : d.x}`;
    const at = d.o === 'h' ? d.x : d.z;
    const s = spans.get(key) || { id: d.id, kind: d.kind, o: d.o, line: d.o === 'h' ? d.z : d.x, from: at, to: at + 1 };
    s.from = Math.min(s.from, at); s.to = Math.max(s.to, at + 1);
    spans.set(key, s);
  }
  const frames = new Batch();
  for (const s of spans.values()) {
    const post = s.kind === 'elevator' ? METAL() : FRAME();
    along(frames, post, s.o, s.line, s.from - 0.05, s.from + 0.05, 0, DOOR_H, 0, WALL_T + 0.06);
    along(frames, post, s.o, s.line, s.to - 0.05, s.to + 0.05, 0, DOOR_H, 0, WALL_T + 0.06);
    along(frames, post, s.o, s.line, s.from - 0.05, s.to + 0.05, DOOR_H, DOOR_H + 0.1, 0, WALL_T + 0.06);
    if (s.kind === 'elevator') {
      // two steel leaves that slide apart
      const leaves = [];
      const mid = (s.from + s.to) / 2;
      for (const side of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(s.o === 'h' ? (s.to - s.from) / 2 - 0.02 : 0.06, DOOR_H - 0.04, s.o === 'h' ? 0.06 : (s.to - s.from) / 2 - 0.02), flat('#9aa3b0'));
        const c = mid + side * (s.to - s.from) / 4;
        leaf.position.set(s.o === 'h' ? c : s.line, (DOOR_H - 0.04) / 2, s.o === 'h' ? s.line : c);
        leaf.castShadow = true;
        leaf.userData = { closed: c, open: c + side * ((s.to - s.from) / 2 - 0.06), axis: s.o === 'h' ? 'x' : 'z' };
        group.add(leaf); leaves.push(leaf);
      }
      doors.set(s.id, { ...s, leaves, open: 0, target: 0 });
    } else if (s.kind === 'door') {
      const pivot = new THREE.Group();
      const width = s.to - s.from - 0.1;
      pivot.position.set(s.o === 'h' ? s.from + 0.05 : s.line, 0, s.o === 'h' ? s.line : s.from + 0.05);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(s.o === 'h' ? width : 0.05, DOOR_H - 0.04, s.o === 'h' ? 0.05 : width), flat('#7a5836'));
      leaf.position.set(s.o === 'h' ? width / 2 : 0, (DOOR_H - 0.04) / 2, s.o === 'h' ? 0 : width / 2);
      leaf.castShadow = true;
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), flat('#d8c48a'));
      knob.position.set(s.o === 'h' ? width - 0.12 : 0.05, 1.0, s.o === 'h' ? 0.05 : width - 0.12);
      pivot.add(leaf, knob);
      pivot.rotation.y = s.o === 'h' ? -1.2 : 1.2;                        // standing open
      group.add(pivot);
      doors.set(s.id, { ...s, pivot });
    } else {
      doors.set(s.id, { ...s });
    }
  }
  frames.build(group);
  lower.build(group);
  for (const cls of classes.values()) cls.batch.build(cls.group);

  // roofs over the places you are not meant to see into
  for (const room of layout.rooms) {
    if (!hiddenRooms.has(room.id)) continue;
    const { x, z, w, d } = room.rect;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + WALL_T, 0.16, d + WALL_T), flat(room.kind === 'elevator' ? '#5a626e' : '#4a3f48'));
    roof.position.set(x + w / 2, WALL_H + 0.08, z + d / 2);
    roof.castShadow = true; roof.receiveShadow = true;
    group.add(roof);
    if (room.kind === 'elevator') {                                     // lift machinery, for character
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 1.0), flat('#6d7582'));
      box.position.set(x + w / 2, WALL_H + 0.41, z + d / 2); box.castShadow = true; group.add(box);
    }
  }

  /* ---- which walls step aside -------------------------------------------- */
  const view = new THREE.Vector3();
  function update(camera, dt) {
    camera.getWorldDirection(view);
    const len = Math.hypot(view.x, view.z) || 1;
    const vx = view.x / len, vz = view.z / len;
    const steep = Math.abs(view.y) > 0.92;                               // looking almost straight down: nothing hides anything
    for (const cls of classes.values()) {
      let want = 0;
      if (!cls.never && !steep) {
        const dot = cls.o === 'h' ? vz : vx;                              // + : looking toward side b
        const farIsRoom = dot > 0 ? cls.bIn : cls.aIn;
        if (farIsRoom) want = THREE.MathUtils.smoothstep(Math.abs(dot), 0.22, 0.5);
      }
      cls.cut += (want - cls.cut) * (1 - Math.exp(-9 * dt));
      const s = 1 - cls.cut;
      cls.group.scale.y = Math.max(0.001, s);
      cls.group.visible = s > 0.02;
    }
    for (const d of doors.values()) {
      if (!d.leaves) continue;
      d.open += (d.target - d.open) * (1 - Math.exp(-6 * dt));
      for (const leaf of d.leaves) leaf.position[leaf.userData.axis] = leaf.userData.closed + (leaf.userData.open - leaf.userData.closed) * d.open;
    }
  }

  /** Hang something on the wall nearest (x, z) so it hides when that wall does. */
  function attachToWall(object, x, z) {
    let best = null, bestD = 0.35;
    for (const r of runs) {
      const d = r.o === 'h' ? Math.abs(z - r.line) : Math.abs(x - r.line);
      const t = r.o === 'h' ? x : z;
      if (d < bestD && t >= r.from - 0.01 && t <= r.to + 0.01) { best = r; bestD = d; }
    }
    if (!best) return false;
    object.position.y -= STUB;
    best.cls.group.add(object);
    return true;
  }

  return { group, floors, update, attachToWall, doors, classes, setSky };
}
