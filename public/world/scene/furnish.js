// The Office — furnishing. Walks the floor plan's object list and puts a real
// thing wherever the plan says one stands: desks with their kit, chairs, rugs,
// boards on the walls, everything in the catalogue (../props/index.js).
// Anything the catalogue does not know yet gets a plain stand-in block, so a
// new kind of object in the plan never breaks the scene.
import * as THREE from 'three';
import { VOXEL } from '../vox/vox.js';
import { voxObject } from '../vox/material.js';
import { buildProp, hasProp, PROPS } from '../props/index.js';
import * as O from '../props/office.js';
import { faceAngle, faceVector } from '/core/layout.mjs';
import { hashId } from '/core/look.mjs';
import { TASK_STATUS } from '/core/contract.mjs';
import { roomPalette } from './building.js';
import { canvasTexture, shade, mixHex, signTexture } from './textures.js';

const v2m = (p) => [p[0] * VOXEL, p[1] * VOXEL, p[2] * VOXEL];

/* ---- a desk with its kit, as one mesh ---------------------------------------- */
function deskSet() {
  const v = O.desk();
  v.stamp(O.crt().turned(2), ...O.DESK.monitor);
  v.stamp(O.keyboard().turned(2), ...O.DESK.keyboard);
  v.stamp(O.mouse(), ...O.DESK.mouse);
  return v;
}

/* ---- rugs ------------------------------------------------------------------- */
function rugTexture(color, round, w, d) {
  const ppm = 20, W = Math.round(w * ppm), H = Math.round(d * ppm);
  return canvasTexture(W, H, (g) => {
    const edge = shade(color, -0.3), field = color, lite = shade(color, 0.16), cream = mixHex(color, '#e9dcc0', 0.72);
    const R = (c, x, y, ww, hh) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
    if (round) {
      g.clearRect(0, 0, W, H);
      const ring = (r, c) => { g.fillStyle = c; g.beginPath(); g.arc(W / 2, H / 2, r, 0, 7); g.fill(); };
      ring(W / 2, edge); ring(W / 2 - 2, cream); ring(W / 2 - 4, field); ring(W / 2 - 12, lite); ring(W / 2 - 14, field);
      ring(W / 5, cream); ring(W / 5 - 2, field);
    } else {
      R(edge, 0, 0, W, H); R(cream, 2, 2, W - 4, H - 4); R(field, 4, 4, W - 8, H - 8);
      R(lite, 9, 9, W - 18, 1); R(lite, 9, H - 10, W - 18, 1); R(lite, 9, 9, 1, H - 18); R(lite, W - 10, 9, 1, H - 18);
      for (let x = 16; x < W - 16; x += 12) for (let y = 16; y < H - 16; y += 12) {      // a small diamond repeat
        const c = ((x / 12 + y / 12) | 0) % 2 ? lite : shade(color, -0.12);
        R(c, x + 2, y, 2, 1); R(c, x + 1, y + 1, 4, 1); R(c, x, y + 2, 6, 2); R(c, x + 1, y + 4, 4, 1); R(c, x + 2, y + 5, 2, 1);
      }
      for (let x = 1; x < W; x += 3) { R(cream, x, 0, 1, 1); R(cream, x, H - 1, 1, 1); }   // fringe
    }
    // a little weave
    const img = g.getImageData(0, 0, W, H), d8 = img.data;
    for (let i = 0; i < d8.length; i += 4) {
      if (!d8[i + 3]) continue;
      const p = i / 4, n = ((p % W) + Math.floor(p / W)) % 2 ? 1.035 : 0.965;
      d8[i] = Math.min(255, d8[i] * n); d8[i + 1] = Math.min(255, d8[i + 1] * n); d8[i + 2] = Math.min(255, d8[i + 2] * n);
    }
    g.putImageData(img, 0, 0);
  }, { clamp: true });
}

function makeRug(o, palette) {
  const [w, d] = o.size || [3, 2];
  const round = o.shape === 'round';
  const color = o.tint || !o.color ? palette.rug : o.color;
  const mat = new THREE.MeshLambertMaterial({ map: rugTexture(color, round, w, d), transparent: round, alphaTest: round ? 0.5 : 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(o.x, 0.012, o.z);
  mesh.receiveShadow = true;
  return mesh;
}

/* ---- stand-ins for things nobody has modelled yet ------------------------------ */
const STANDIN_H = { fridge: 1.5, vending: 1.6, rack: 1.7, arcade: 1.5, tree: 2.2, shelving: 1.7, trophycase: 1.5, counter: 0.8,
  reception: 0.9, bigboard: 1.8, cooler: 1.1, lectern: 1.0, jukebox: 1.2, ladder: 1.6, stool: 0.45, bench: 0.42, armchair: 0.75,
  cafetable: 0.65, sidetable: 0.45, bin: 0.5, printer: 0.8, boxes: 0.7, console: 0.9, acunit: 0.9, globe: 0.9, guestbook: 0.9,
  beanbag: 0.45, minifridge: 0.7 };
let standinMaterial = null;
function standIn(o) {
  if (!o.w || !o.d) return null;
  standinMaterial ||= new THREE.MeshLambertMaterial({ color: '#8f88a6' });
  const h = STANDIN_H[o.type] || 0.3;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.w * 0.92, h, o.d * 0.92), standinMaterial);
  mesh.position.y = h / 2;
  mesh.castShadow = true; mesh.receiveShadow = true;
  const g = new THREE.Group(); g.add(mesh); g.userData.standIn = true;
  return g;
}

/* ---- the cards on a task board -------------------------------------------------- */
const CARD = { backlog: '#b9c2cf', todo: '#f2d45c', doing: '#6fb6e8', blocked: '#ee6f5e', review: '#c59af0', done: '#7fd08a' };
let cardMaterial = null;
function boardCards(tasks) {
  const B = O.BOARD;
  const pos = [], col = [], nor = [], idx = [];
  const c = new THREE.Color();
  const quad = (x, y, w, h, z, hex) => {
    c.set(hex);
    const s = pos.length / 3;
    pos.push(x, y, z, x + w, y, z, x + w, y + h, z, x, y + h, z);
    for (let i = 0; i < 4; i++) { nor.push(0, 0, 1); col.push(c.r, c.g, c.b); }
    idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
  };
  TASK_STATUS.forEach((status, i) => {
    const list = tasks.filter((t) => t.status === status).slice(0, B.perCol);
    list.forEach((t, k) => {
      const x = B.colX(i) + 1 + (k % 2) * 7, y = B.top - 6 - Math.floor(k / 2) * 6;
      const tilt = (hashId(String(t.id)) % 3) - 1;                       // nobody pins a card perfectly straight
      quad(x, y + tilt * 0.25, B.cardW, B.cardH, B.z + 0.12, CARD[status] || '#dddddd');
      quad(x + 1, y + 3 + tilt * 0.25, B.cardW - 2, 0.6, B.z + 0.16, '#3a3340');
      quad(x + 1, y + 1.6 + tilt * 0.25, B.cardW - 3, 0.6, B.z + 0.16, '#3a3340');
      if (t.priority === 'high') quad(x + B.cardW - 1.6, y + B.cardH - 1.4 + tilt * 0.25, 1.4, 1.4, B.z + 0.2, '#d8392f');
    });
  });
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  cardMaterial ||= new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, cardMaterial);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * @param {object} layout     from buildLayout(plan)
 * @param {object} building   from buildBuilding(layout)
 * @param {{screens:object}} opt
 */
export function furnish(layout, building, opt = {}) {
  const group = new THREE.Group();
  const nodes = new Map();          // layout object id → scene node
  const desks = new Map();          // desk id → desk handle
  const boards = new Map();         // deptId → board handle
  const standIns = [];
  const screens = opt.screens;
  const hidden = new Set(layout.rooms.filter((r) => r.locked).map((r) => r.id));
  const deskObject = new Map(layout.objects.filter((o) => o.desk).map((o) => [o.desk, o]));

  for (const o of layout.objects) {
    if (hidden.has(o.room)) continue;
    const room = layout.roomById.get(o.room);
    const palette = room ? roomPalette(room) : { accent: '#3f7d74', rug: '#5a4038' };
    let node = null;

    if (o.type === 'rug') {
      node = makeRug(o, palette);
      group.add(node); nodes.set(o.id, node);
      continue;
    }
    if (o.type === 'desk') {
      node = voxObject(deskSet, { key: 'deskset' });
    } else if (o.type === 'roomsign') {
      node = roomSign(room, palette);
    } else if (hasProp(o.type)) {
      node = buildProp(o.type, o);
    } else {
      node = standIn(o);
      if (node) standIns.push(o.type);
    }
    if (!node) continue;

    const holder = new THREE.Group();
    holder.add(node);
    holder.position.set(o.x, PROPS[o.type]?.y || 0, o.z);
    holder.rotation.y = faceAngle(o.face);
    holder.userData.object = o;
    if (o.swings) {                                              // the secret shelf, standing open on its hinge
      const a = faceAngle(o.face), hw = (o.w || 2) / 2, swing = -1.75;
      const hx = o.x - Math.cos(a) * hw, hz = o.z + Math.sin(a) * hw;          // the hinge: the shelf's left end
      holder.rotation.y = a + swing;
      holder.position.set(hx + Math.cos(a + swing) * hw, 0, hz - Math.sin(a + swing) * hw);
    }
    nodes.set(o.id, holder);
    if (PROPS[o.type]?.wall) {
      if (!building.attachToWall(holder, o.x, o.z)) group.add(holder);
    } else group.add(holder);

    if (o.type === 'taskboard' && o.deptId) {
      const board = { deptId: o.deptId, holder, node, cards: null,
        setTasks(tasks) {
          if (this.cards) { node.remove(this.cards); this.cards.geometry.dispose(); this.cards = null; }
          const mesh = boardCards(tasks || []);
          if (mesh) { node.add(mesh); this.cards = mesh; }
        } };
      boards.set(o.deptId, board);
    }
  }

  /* ---- desks: chair, screen, the things on top -------------------------------- */
  const chairs = new THREE.Group();
  group.add(chairs);
  for (const desk of layout.desks) {
    const room = layout.roomById.get(desk.room);
    const palette = room ? roomPalette(room) : { accent: '#4d5a78' };
    const color = mixHex(palette.accent, '#4a4f60', 0.45);
    const chair = buildProp('chair', { color });
    const [fx, fz] = faceVector(desk.seat.face);
    const tuck = desk.hot ? 0.1 : 0.2;
    const wobble = ((hashId(desk.id) % 100) / 100 - 0.5) * 0.5;
    chair.position.set(desk.seat.x + fx * tuck, 0, desk.seat.z + fz * tuck);
    chair.rotation.y = faceAngle(desk.seat.face) + wobble;
    chairs.add(chair);

    const o = deskObject.get(desk.id);
    const holder = o ? nodes.get(o.id) : null;
    const set = holder ? holder.children[0] : null;       // the scaled voxel group: children are in voxel units
    let screen = null, lamp = null;
    if (set && screens) {
      screen = new THREE.Mesh(new THREE.PlaneGeometry(O.CRT_SCREEN.w, O.CRT_SCREEN.h), screens.material('off'));
      screen.position.set(O.DESK.monitor[0] - O.CRT_SCREEN.x, O.DESK.monitor[1] + O.CRT_SCREEN.y, O.DESK.monitor[2] - O.CRT_SCREEN.z);
      screen.rotation.y = Math.PI;
      set.add(screen);
    }
    const items = new THREE.Group();
    if (holder) holder.add(items);

    const handle = {
      id: desk.id, desk, holder, chair, screen, items, owner: null, seated: false, screenKind: 'off',
      /** Someone sits down (true) or gets up (false): the chair pulls out or tucks in. */
      setSeated(on) {
        this.seated = on;
        chair.position.set(desk.seat.x + (on ? 0 : fx * tuck), 0, desk.seat.z + (on ? 0 : fz * tuck));
        chair.rotation.y = faceAngle(desk.seat.face) + (on ? 0 : wobble);
      },
      setScreen(kind) {
        if (!screen || kind === this.screenKind) return;
        this.screenKind = kind;
        screen.material = screens.material(kind);
      },
      /** Whose desk this is (or null): the lamp comes on and their things appear. */
      setOwner(agent, makeItems) {
        const id = agent ? agent.id : null;
        if (id === this.owner) return;
        this.owner = id;
        opt.onLampsChanged?.();
        if (lamp) { holder.remove(lamp); lamp = null; }
        while (items.children.length) items.remove(items.children[0]);
        if (!agent || !holder) { this.setScreen('off'); return; }
        if (!desk.hot) {
          lamp = buildProp('desklamp', { color: O.LAMP_SHADES[hashId(agent.persona || agent.id) % O.LAMP_SHADES.length] });
          lamp.rotation.y = Math.PI;                             // the chain hangs on the sitter's side
          lamp.position.set(...v2m(O.DESK.lamp));
          holder.add(lamp);
        }
        if (makeItems) makeItems(agent, items, desk);
      },
    };
    desks.set(desk.id, handle);
  }

  function roomSign(room, palette) {
    if (!room) return null;
    const vacant = room.kind === 'vacant';
    const tex = signTexture(vacant ? 'VACANT' : String(room.name || '').toUpperCase().slice(0, 22),
      { accent: vacant ? '#8a8f96' : palette.accent, size: 11, bg: vacant ? '#4a4a50' : '#5a3a22', fg: vacant ? '#c9c9d2' : '#f4ddb4' });
    const h = 0.28, w = h * tex.userData.aspect;
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    for (const side of [1, -1]) {
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      plate.position.set(0, 2.4, side * 0.095);
      plate.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(plate);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.17), new THREE.MeshLambertMaterial({ color: '#3b2a1c' }));
    slab.position.y = 2.4; slab.castShadow = true;
    g.add(slab);
    return g;
  }

  // what can be pointed at: one box per thing that does something
  let boxes = null;
  function hitBoxes() {
    if (boxes) return boxes;
    boxes = [];
    for (const o of layout.objects) {
      if (!o.poi || hidden.has(o.room)) continue;
      const node = nodes.get(o.id);
      if (!node) continue;
      node.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(node);
      if (box.isEmpty()) continue;
      box.expandByScalar(0.06);
      boxes.push({ object: o, poi: o.poi, box });
    }
    return boxes;
  }

  /** The plaza tree grows in stages (0 sprout … 4 grand) as tasks get finished. */
  function setTreeStage(stage) {
    const o = layout.objects.find((x) => x.type === 'tree');
    const holder = o && nodes.get(o.id);
    if (!holder || !hasProp('tree')) return;
    while (holder.children.length) holder.remove(holder.children[0]);
    holder.add(buildProp('tree', { ...o, stage }));
    boxes = null;
  }

  return {
    group, nodes, desks, boards, hitBoxes, setTreeStage,
    standIns: [...new Set(standIns)],
    /** Every lamp that is switched on: floor lamps, and the desk lamp of each claimed desk. */
    lamps() {
      const out = [];
      const p = new THREE.Vector3();
      for (const o of layout.objects) {
        if (hidden.has(o.room)) continue;
        if (o.type === 'floorlamp') out.push({ x: o.x, y: 1.5, z: o.z, power: 1.5 });
        // the Speakeasy has no windows: its neon and machines are the light, day and night
        else if (o.type === 'neon') out.push({ x: o.x, y: 1.9, z: o.z + 0.5, power: 1.5, color: '#ff6fb0', always: true });
        else if (o.type === 'jukebox') out.push({ x: o.x, y: 1.2, z: o.z + 0.7, power: 1.0, color: '#ffb86a', always: true });
        else if (o.type === 'arcade' && o.id === 'arcade-1') out.push({ x: o.x + 0.55, y: 1.5, z: o.z + 0.9, power: 0.9, color: '#8fb8ff', always: true });
        else if (o.type === 'vending') out.push({ x: o.x, y: 1.2, z: o.z + 0.7, power: 0.6, color: '#dfe8ff' });
      }
      for (const d of desks.values()) {
        if (!d.owner || !d.holder || d.desk.hot) continue;
        p.set((O.DESK.lamp[0] - 10) * VOXEL, (O.DESK.lamp[1] + 34) * VOXEL, (O.DESK.lamp[2] - 4) * VOXEL);
        d.holder.updateMatrixWorld(true);
        d.holder.localToWorld(p);
        out.push({ x: p.x, y: p.y, z: p.z, power: 0.5 });
      }
      return out;
    },
    update() {},
  };
}
