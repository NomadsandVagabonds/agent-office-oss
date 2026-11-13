// The Office — the floor plan, as a pure function.
//
//   buildLayout(plan) → rooms, walls, doors, furniture, desks, points of interest
//
// The daemon and the 3D client both run this exact file (the client loads it
// from /core/layout.mjs), so the server only ever ships the tiny `plan`
// (which project sits in which slot, what has been unlocked) and both sides
// agree on every wall and chair. Deterministic; no randomness, no I/O.
//
// World units are metres on a 1 m tile grid. +x is east, +z is south, y is up.
// Tile (i, j) covers [i, i+1) × [j, j+1).
//
//                               N
//      ┌────────────┬────────────┬───────┬──┬───────┬────────────┬────────────┐
//      │  project   │  project   │library│el│kitchen│  project   │  project   │
//      │   W·N·1    │   W·N·0    │       │ev│       │   E·N·0    │   E·N·1    │
//      ├─────▫──────┴─────▫──────┤       └──┘       ├─────▫──────┴─────▫──────┤
//   W  │        west corridor            plaza            east corridor       │  E
//      ├─────▫──────┬─────▫──────┤                  ├─────▫──────┬─────▫──────┤
//      │  project   │  project   ├──────┐    ┌──────┤  project   │  project   │
//      │   W·S·1    │   W·S·0    │closet│foyer│server│   E·S·0    │   E·S·1    │
//      └────────────┴────────────┴──────┴─▫▫─┴──────┴────────────┴────────────┘
//                                         S

import { hashId } from './look.mjs';

export const ROOM_W = 10;
export const ROOM_D = 8;
export const CORRIDOR_D = 3;          // corridor band is z ∈ [0, 3)
export const HALL_HALF = 8;           // the commons hall is x ∈ [-8, 8)
export const NORTH_Z = -ROOM_D;       // -8
export const SOUTH_Z = CORRIDOR_D + ROOM_D;   // 11
export const WALL_H = 2.6;
export const DESKS_PER_ROOM = 8;
export const HOT_DESKS = 4;
export const PEDESTALS = 10;
export const SHELF_SLOTS = 6;         // creations a team can display on its credenza

const FACE = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
export const faceVector = (face) => FACE[face] || FACE.S;
/** three.js rotation.y for something whose local front is +z. */
export const faceAngle = (face) => ({ S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 }[face] ?? 0);
export const tileKey = (x, z) => `${x},${z}`;
export const edgeKey = (o, x, z) => `${o}:${x}:${z}`;

// Footprints [width along local x, depth along local z, blocks walking?]
const PREFAB = {
  desk: [1.6, 0.8, true], hottable: [2.4, 0.9, true],
  bookshelf: [2, 0.5, true], sofa: [2.2, 0.9, true], armchair: [0.9, 0.9, true],
  sidetable: [0.5, 0.5, true], floorlamp: [0.4, 0.4, false], lectern: [0.6, 0.6, true],
  globe: [0.6, 0.6, true], counter: [4, 0.6, true], fridge: [0.9, 0.7, true],
  vending: [1.0, 0.8, true], cooler: [0.5, 0.5, true], bin: [0.5, 0.5, true],
  cafetable: [0.9, 0.9, true], stool: [0.4, 0.4, false], tree: [1.4, 1.4, true],
  bigboard: [3.2, 0.4, true], printer: [0.8, 0.7, true], pedestal: [0.6, 0.6, true],
  reception: [2.4, 0.8, true], guestbook: [0.6, 0.6, true], trophycase: [1.4, 0.5, true],
  shelving: [2.5, 0.5, true], boxes: [0.9, 0.9, true], roombadock: [0.5, 0.5, false],
  hatch: [1, 1, false], rack: [0.7, 1.0, true], console: [0.8, 0.6, true],
  acunit: [0.7, 0.7, true], arcade: [0.8, 0.8, true], jukebox: [0.9, 0.6, true],
  beanbag: [0.9, 0.9, true], minifridge: [0.6, 0.6, true], credenza: [2, 0.5, true],
  cabinet: [0.6, 0.6, true], plant: [0.6, 0.6, true], planttall: [0.6, 0.6, true],
  ladder: [0.6, 0.6, true], doormat: [1.6, 0.8, false], rug: [0, 0, false],
  taskboard: [0, 0, false], roomsign: [0, 0, false], clock: [0, 0, false],
  painting: [0, 0, false], neon: [0, 0, false], discoball: [0, 0, false],
  coffeemachine: [0, 0, false], bell: [0, 0, false], catbed: [0.6, 0.6, false],
  bench: [1.6, 0.5, true], vacantsign: [0, 0, false],
  // room flair: every project room gets a couple, so no two teams' rooms feel alike
  foosball: [1.2, 0.9, true], pinball: [0.7, 1.3, true], aquarium: [1.0, 0.5, true], telescope: [0.6, 0.8, true],
  coatrack: [0.4, 0.4, true], gumball: [0.4, 0.4, true], fan: [0.5, 0.5, true], dartboard: [0, 0, false],
  liftpanel: [0, 0, false],
};

// What a team might have against its side walls. Chosen per project, stably.
const FLAIR_BIG = [
  ['foosball', 'game', 'the foosball table'], ['pinball', 'game', 'a pinball machine'],
  ['aquarium', 'aquarium', 'the team aquarium'], ['telescope', 'telescope', 'a brass telescope'],
];
const FLAIR_SMALL = [
  ['coatrack', 'coatrack', 'the coat rack'], ['gumball', 'gumball', 'a gumball machine'], ['fan', 'fan', 'a pedestal fan'],
];

/** slot index → which wing, which side of the corridor, how far out. */
export function slotInfo(slot) {
  const col = Math.floor(slot / 4);
  const r = slot % 4;
  return { wing: r % 2 === 0 ? 'W' : 'E', side: r < 2 ? 'N' : 'S', col };
}

export function slotRect(slot) {
  const { wing, side, col } = slotInfo(slot);
  return {
    x: wing === 'W' ? -HALL_HALF - ROOM_W * (col + 1) : HALL_HALF + ROOM_W * col,
    z: side === 'N' ? NORTH_Z : CORRIDOR_D,
    w: ROOM_W,
    d: ROOM_D,
  };
}

export const projectRoomId = (deptId) => `dept:${deptId}`;

// Fill order: the middle of the bench first, opposite seats paired up, so two
// teammates face each other instead of sitting at far ends.
const DESK_ORDER = [1, 5, 2, 6, 0, 4, 3, 7];
export const deskFillOrder = () => DESK_ORDER.slice();

/**
 * @param {{rooms?:Array<{slot:number, deptId:string, name:string, color?:string|null}>,
 *          unlocked?:{backroom?:boolean}}} plan
 */
export function buildLayout(plan = {}) {
  const assigned = (plan.rooms || []).filter((r) => Number.isInteger(r.slot) && r.slot >= 0);
  const unlocked = plan.unlocked || {};
  const cols = Math.max(1, ...assigned.map((r) => slotInfo(r.slot).col + 1));
  const westX = -HALL_HALF - ROOM_W * cols;
  const eastX = HALL_HALF + ROOM_W * cols;

  const rooms = [];
  const roomById = new Map();
  const tiles = new Map();            // "x,z" → room id
  const objects = [];
  const desks = [];
  const doorEdges = new Map();        // edge key → door
  const doors = [];
  const overrides = [];               // wall type overrides along spans
  const blocked = new Set();          // tiles furniture stands on

  function addRoom(id, kind, name, rect, extra = {}) {
    const room = { id, kind, name, rect, open: false, ...extra };
    rooms.push(room);
    roomById.set(id, room);
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      for (let z = rect.z; z < rect.z + rect.d; z++) tiles.set(tileKey(x, z), id);
    }
    return room;
  }

  const roomAt = (x, z) => tiles.get(tileKey(Math.floor(x), Math.floor(z))) || null;

  function put(type, x, z, face = 'S', extra = {}) {
    const spec = PREFAB[type] || [0, 0, false];
    const turned = face === 'E' || face === 'W';
    const w = turned ? spec[1] : spec[0];
    const d = turned ? spec[0] : spec[1];
    const object = {
      id: extra.id || `${type}:${x},${z}`,
      type, x, z, face,
      room: extra.room || roomAt(x, z),
      w: spec[0], d: spec[1],
      ...extra,
    };
    if (spec[2] && extra.block !== false) {
      const x0 = x - w / 2 + 0.1, x1 = x + w / 2 - 0.1;
      const z0 = z - d / 2 + 0.1, z1 = z + d / 2 - 0.1;
      for (let tx = Math.floor(x0 - 0.3); tx <= Math.floor(x1 + 0.3); tx++) {
        for (let tz = Math.floor(z0 - 0.3); tz <= Math.floor(z1 + 0.3); tz++) {
          // the tile's inner square (centre ± 0.3) must overlap the footprint
          if (tx + 0.8 > x0 && tx + 0.2 < x1 && tz + 0.8 > z0 && tz + 0.2 < z1) blocked.add(tileKey(tx, tz));
        }
      }
    }
    if (extra.poi) {
      const [fx, fz] = faceVector(face);
      const reach = (turned ? spec[0] : spec[1]) / 2 + 0.7;
      object.poi = {
        id: extra.poi.id || object.id,
        kind: extra.poi.kind,
        label: extra.poi.label,
        // where an avatar stands to use it, and which way it then faces
        stand: extra.poi.stand || { x: x + fx * reach, z: z + fz * reach },
        look: { x, z },
        hidden: !!extra.poi.hidden,
      };
    }
    objects.push(object);
    return object;
  }

  /** A doorway across the edge between tile (x,z) and its N or W neighbour. */
  function door(o, x, z, kind, id) {
    const record = { id, o, x, z, kind };
    doors.push(record);
    doorEdges.set(edgeKey(o, x, z), record);
    return record;
  }

  /* ---- rooms ---------------------------------------------------------- */

  const hall = { open: true, group: 'hall' };
  addRoom('library', 'library', 'Library', { x: -8, z: -8, w: 7, d: 6 }, hall);
  addRoom('landing', 'landing', 'Elevator Landing', { x: -1, z: -8, w: 2, d: 6 }, hall);
  addRoom('kitchen', 'kitchen', 'Kitchen', { x: 1, z: -8, w: 7, d: 6 }, hall);
  addRoom('plaza', 'plaza', 'Plaza', { x: -8, z: -2, w: 16, d: 9 }, hall);
  addRoom('foyer', 'foyer', 'Foyer', { x: -4, z: 7, w: 8, d: 4 }, hall);
  addRoom('corridor-w', 'corridor', 'West Corridor', { x: westX, z: 0, w: -HALL_HALF - westX, d: CORRIDOR_D }, hall);
  addRoom('corridor-e', 'corridor', 'East Corridor', { x: HALL_HALF, z: 0, w: eastX - HALL_HALF, d: CORRIDOR_D }, hall);
  addRoom('closet', 'closet', 'Supply Closet', { x: -8, z: 7, w: 4, d: 4 });
  addRoom('server', 'server', 'Server Room', { x: 4, z: 7, w: 4, d: 4 });
  addRoom('elevator', 'elevator', 'Elevator', { x: -1, z: -10, w: 2, d: 2 });
  addRoom('backroom', 'backroom', 'The Back Room', { x: -8, z: -12, w: 7, d: 4 },
    { secret: true, locked: !unlocked.backroom });

  const bySlot = new Map(assigned.map((r) => [r.slot, r]));
  for (let slot = 0; slot < cols * 4; slot++) {
    const rect = slotRect(slot);
    const info = slotInfo(slot);
    const dept = bySlot.get(slot);
    const where = `${info.wing === 'W' ? 'west' : 'east'} wing, ${info.side === 'N' ? 'north' : 'south'} side`;
    if (dept) {
      addRoom(projectRoomId(dept.deptId), 'project', dept.name || dept.deptId, rect,
        { deptId: dept.deptId, color: dept.color || null, slot, ...info, where });
    } else {
      addRoom(`vacant:${slot}`, 'vacant', 'Vacant', rect, { slot, ...info, where });
    }
  }

  /* ---- doors ---------------------------------------------------------- */

  door('h', -1, -8, 'elevator', 'door:elevator');
  door('h', 0, -8, 'elevator', 'door:elevator');
  door('v', -4, 8, 'door', 'door:closet');
  door('v', 4, 8, 'door', 'door:server');
  const secret = unlocked.backroom ? 'secret-open' : 'secret';
  door('h', -5, -8, secret, 'door:backroom');
  door('h', -4, -8, secret, 'door:backroom');
  for (const room of rooms) {
    if (room.kind !== 'project' && room.kind !== 'vacant') continue;
    const z = room.side === 'N' ? 0 : CORRIDOR_D;
    door('h', room.rect.x + 4, z, 'open', `door:${room.id}`);
    door('h', room.rect.x + 5, z, 'open', `door:${room.id}`);
    // daylight on the outside wall
    const wz = room.side === 'N' ? NORTH_Z : SOUTH_Z;
    overrides.push({ o: 'h', line: wz, from: room.rect.x + 1, to: room.rect.x + 3, type: 'window' });
    overrides.push({ o: 'h', line: wz, from: room.rect.x + 7, to: room.rect.x + 9, type: 'window' });
    // south-side rooms hang their board on a solid stretch of the corridor wall
    if (room.side === 'S') {
      overrides.push({ o: 'h', line: CORRIDOR_D, from: room.rect.x, to: room.rect.x + 4, type: 'solid' });
    }
  }
  overrides.push({ o: 'h', line: SOUTH_Z, from: -1, to: 1, type: 'entrance' });
  overrides.push({ o: 'v', line: westX, from: 0, to: CORRIDOR_D, type: 'window' });
  overrides.push({ o: 'v', line: eastX, from: 0, to: CORRIDOR_D, type: 'window' });
  overrides.push({ o: 'h', line: NORTH_Z, from: 2, to: 5, type: 'window' });       // over the kitchen counter
  overrides.push({ o: 'h', line: SOUTH_Z, from: -7, to: -5, type: 'window' });     // closet
  overrides.push({ o: 'h', line: SOUTH_Z, from: 5, to: 7, type: 'window' });       // server room

  /* ---- walls ---------------------------------------------------------- */

  const roomOf = (x, z) => roomById.get(tiles.get(tileKey(x, z))) || null;
  const sameSpace = (a, b) => a && b && (a.id === b.id || (a.group && a.group === b.group));

  function wallType(o, line, at, a, b) {
    for (const ov of overrides) {
      if (ov.o === o && ov.line === line && at >= ov.from && at < ov.to) return ov.type;
    }
    if (!a || !b) return 'solid';
    const kinds = [a.kind, b.kind];
    const desk = kinds.includes('project') || kinds.includes('vacant');
    if (desk && kinds.includes('corridor')) return 'glass';
    return 'solid';
  }

  const unitEdges = [];
  const wallEdges = new Set();        // edge keys that block walking
  function considerEdge(o, x, z) {
    // 'h' edge at z between tile (x, z-1) [north] and (x, z) [south]
    // 'v' edge at x between tile (x-1, z) [west]  and (x, z) [east]
    const a = o === 'h' ? roomOf(x, z - 1) : roomOf(x - 1, z);
    const b = roomOf(x, z);
    if (!a && !b) return;
    if (sameSpace(a, b)) return;
    const k = edgeKey(o, x, z);
    const d = doorEdges.get(k);
    if (d && d.kind !== 'secret') return;                 // an open doorway
    wallEdges.add(k);
    unitEdges.push({
      o, line: o === 'h' ? z : x, at: o === 'h' ? x : z,
      type: d ? 'solid' : wallType(o, o === 'h' ? z : x, o === 'h' ? x : z, a, b),
      a: a ? a.id : null, b: b ? b.id : null,
    });
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const k of tiles.keys()) {
    const [x, z] = k.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x + 1);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z + 1);
  }
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      considerEdge('h', x, z);
      considerEdge('v', x, z);
    }
  }
  // Merge collinear unit edges into runs.
  unitEdges.sort((p, q) => (p.o < q.o ? -1 : p.o > q.o ? 1 : p.line - q.line || p.at - q.at));
  const walls = [];
  for (const e of unitEdges) {
    const last = walls[walls.length - 1];
    if (last && last.o === e.o && last.line === e.line && last.to === e.at
      && last.type === e.type && last.a === e.a && last.b === e.b) {
      last.to = e.at + 1;
    } else {
      walls.push({ o: e.o, line: e.line, from: e.at, to: e.at + 1, type: e.type, a: e.a, b: e.b,
        exterior: !e.a || !e.b });
    }
  }

  /* ---- furniture: the commons ----------------------------------------- */

  // library
  put('bookshelf', -7, -7.75, 'S', { id: 'shelf-a' });
  put('bookshelf', -4, -7.75, 'S', { id: 'shelf-secret', swings: !!unlocked.backroom,
    block: !unlocked.backroom,
    poi: { kind: 'bookshelf', label: 'a bookshelf with one very red book', id: 'redbook', stand: { x: -4, z: -6.5 } } });
  put('bookshelf', -2, -7.75, 'S', { id: 'shelf-c' });
  put('painting', -5.5, -7.95, 'S', { id: 'painting-classic',
    poi: { kind: 'painting', label: 'a framed pixel painting of the old office', stand: { x: -5.5, z: -6.5 } } });
  put('bookshelf', -7.75, -4.5, 'E', { id: 'shelf-d' });
  put('armchair', -5.6, -4.2, 'E', { id: 'armchair-1', poi: { kind: 'seat', label: 'a reading chair', stand: { x: -5.6, z: -4.2 } } });
  put('armchair', -3.8, -4.2, 'W', { id: 'armchair-2', color: '#6e2a2c',      // oxblood, facing the green one
    poi: { kind: 'seat', label: 'a reading chair', stand: { x: -3.8, z: -4.2 } } });
  put('sidetable', -4.7, -4.2, 'S');
  put('floorlamp', -6.4, -3.3, 'S');
  put('rug', -4.7, -4.2, 'S', { id: 'rug-library', shape: 'round', size: [3.4, 3.4], color: '#8d3b3b' });
  put('lectern', -2.5, -3.4, 'S', { id: 'binder',
    poi: { kind: 'binder', label: 'the binder — every project\'s docs' } });
  put('globe', -6.9, -2.7, 'S', { id: 'globe', poi: { kind: 'globe', label: 'a globe' } });

  // landing
  put('clock', 0, -7.95, 'S', { id: 'clock', poi: { kind: 'clock', label: 'the wall clock', stand: { x: 0, z: -6.5 } } });
  put('doormat', 0, -7.3, 'S', { id: 'mat-elevator', block: false });
  // the lift: a sill across the doorway and a call plate beside it (its floors are in levels.mjs)
  put('liftpanel', 0, -7.94, 'S', { id: 'lift', poi: { kind: 'elevator', label: 'the lift', stand: { x: 0.6, z: -7.25 } } });

  // kitchen
  put('counter', 3.5, -7.7, 'S', { id: 'counter' });
  put('coffeemachine', 2.3, -7.7, 'S', { id: 'coffee',
    poi: { kind: 'coffee', label: 'the coffee machine', stand: { x: 2.3, z: -6.6 } } });
  put('fridge', 6.1, -7.65, 'S', { id: 'fridge', poi: { kind: 'fridge', label: 'the fridge' } });
  put('vending', 7.25, -7.6, 'S', { id: 'vending', poi: { kind: 'vending', label: 'the vending machine' } });
  put('cooler', 7.65, -5.5, 'W', { id: 'cooler', poi: { kind: 'cooler', label: 'the water cooler' } });
  put('bin', 7.65, -4.4, 'W');
  put('cafetable', 3.2, -4.6, 'S', { id: 'cafe-1' });
  put('stool', 2.4, -4.6, 'E', { poi: { kind: 'seat', label: 'a stool', stand: { x: 2.4, z: -4.6 } } });
  put('stool', 4.0, -4.6, 'W', { poi: { kind: 'seat', label: 'a stool', stand: { x: 4.0, z: -4.6 } } });
  put('stool', 3.2, -3.8, 'N', { poi: { kind: 'seat', label: 'a stool', stand: { x: 3.2, z: -3.8 } } });
  put('cafetable', 5.5, -3.5, 'S', { id: 'cafe-2' });
  put('stool', 4.7, -3.5, 'E', { poi: { kind: 'seat', label: 'a stool', stand: { x: 4.7, z: -3.5 } } });
  put('stool', 6.3, -3.5, 'W', { poi: { kind: 'seat', label: 'a stool', stand: { x: 6.3, z: -3.5 } } });

  // plaza
  put('tree', 0, 1.5, 'S', { id: 'tree', poi: { kind: 'tree', label: 'the office tree', stand: { x: 0, z: 3.4 } } });
  put('bigboard', 4.2, -1.75, 'S', { id: 'bigboard',
    poi: { kind: 'bigboard', label: 'the big board — every project at a glance' } });
  put('sofa', -3, -1.5, 'S', { id: 'sofa', poi: { kind: 'seat', label: 'the sofa', stand: { x: -3, z: -1.45 } } });
  put('sidetable', -1.5, -1.5, 'S');
  put('planttall', -4.6, -1.6, 'S');
  put('hottable', -6.4, 4.4, 'S', { id: 'hottable' });
  put('printer', 7.5, -1.2, 'W', { id: 'printer', poi: { kind: 'printer', label: 'the printer' } });
  put('bench', 6.6, 4.3, 'N', { poi: { kind: 'seat', label: 'a bench', stand: { x: 6.6, z: 4.3 } } });
  put('planttall', 7.5, 4.3, 'S');
  put('catbed', 5.3, 4.4, 'S', { id: 'catbed', poi: { kind: 'catbed', label: 'a small cushion covered in fur' } });
  // the gallery — one pedestal per exhibited creation
  const pedestalSpots = [
    [-7.3, 6.55, 'N'], [-6.2, 6.55, 'N'], [-5.1, 6.55, 'N'],
    [5.1, 6.55, 'N'], [6.2, 6.55, 'N'], [7.3, 6.55, 'N'],
    [-3.55, 7.6, 'E'], [-3.55, 10.3, 'E'], [3.55, 7.6, 'W'], [3.55, 10.3, 'W'],
  ];
  pedestalSpots.forEach(([x, z, face], i) => put('pedestal', x, z, face, { id: `pedestal:${i}`, index: i,
    poi: { kind: 'pedestal', label: `gallery pedestal ${i + 1}` } }));

  // foyer
  put('doormat', 0, 10.4, 'S', { id: 'mat-entrance', block: false });
  put('reception', 0, 8.5, 'S', { id: 'reception',
    poi: { kind: 'reception', label: 'the reception desk', stand: { x: 0, z: 9.7 } } });
  put('bell', 0.7, 8.6, 'S', { id: 'bell', poi: { kind: 'bell', label: 'the brass bell', stand: { x: 0.7, z: 9.7 } } });
  put('guestbook', -2.3, 9.3, 'S', { id: 'guestbook', poi: { kind: 'guestbook', label: 'the guestbook' } });
  put('trophycase', 2.2, 9.9, 'N', { id: 'trophies',
    poi: { kind: 'trophies', label: 'the trophy case — everything anyone has discovered here' } });

  // supply closet
  put('shelving', -7.7, 9.2, 'E', { id: 'closet-shelves', poi: { kind: 'shelving', label: 'shelves of spare parts' } });
  put('boxes', -6.6, 7.55, 'S');
  put('roombadock', -4.45, 10.5, 'N', { id: 'roombadock', poi: { kind: 'roomba', label: 'a robot vacuum dock' } });
  put('hatch', -6.3, 10.0, 'S', { id: 'hatch', poi: { kind: 'hatch', label: 'a floor hatch', stand: { x: -5.4, z: 9.5 } } });

  // server room
  put('rack', 7.45, 7.6, 'W', { id: 'rack-1' });
  put('rack', 7.45, 8.5, 'W', { id: 'rack-2', poi: { kind: 'rack', label: 'the server racks' } });
  put('rack', 7.45, 9.4, 'W', { id: 'rack-3' });
  put('console', 5.3, 10.55, 'N', { id: 'console', poi: { kind: 'console', label: 'the ops console' } });
  put('acunit', 4.5, 10.5, 'N');

  // the back room (furniture exists either way; you just cannot get to it)
  put('arcade', -6.6, -11.5, 'S', { id: 'arcade-1', poi: { kind: 'arcade', label: 'an arcade cabinet: BUG SQUASH', hidden: true } });
  put('arcade', -5.5, -11.5, 'S', { id: 'arcade-2', poi: { kind: 'arcade', label: 'an arcade cabinet: BUG SQUASH', hidden: true } });
  put('jukebox', -2.2, -11.6, 'S', { id: 'jukebox', poi: { kind: 'jukebox', label: 'a jukebox', hidden: true } });
  put('beanbag', -3.4, -9.8, 'S', { poi: { kind: 'seat', label: 'a beanbag', hidden: true, stand: { x: -3.4, z: -9.8 } } });
  put('beanbag', -7.2, -9.3, 'E', { poi: { kind: 'seat', label: 'a beanbag', hidden: true, stand: { x: -7.2, z: -9.3 } } });
  put('minifridge', -1.4, -9.6, 'W');
  put('neon', -4, -11.95, 'S', { id: 'neon' });
  put('discoball', -4.3, -10.2, 'S', { id: 'discoball-backroom' });
  put('rug', -4.3, -10.2, 'S', { id: 'rug-backroom', shape: 'rect', size: [4.6, 2.6], color: '#4b2a66' });

  // corridor end caps
  put('planttall', westX + 0.5, 0.5, 'S');
  put('bench', westX + 0.45, 2.0, 'E', { poi: { kind: 'seat', label: 'a bench by the west window', stand: { x: westX + 0.45, z: 2.0 } } });
  put('planttall', eastX - 0.5, 0.5, 'S');
  put('bench', eastX - 0.45, 2.0, 'W', { poi: { kind: 'seat', label: 'a bench by the east window', stand: { x: eastX - 0.45, z: 2.0 } } });

  // hot desks (overflow seating in the plaza)
  const hot = [[-7.0, 3.75, 'S'], [-5.8, 3.75, 'S'], [-7.0, 5.05, 'N'], [-5.8, 5.05, 'N']];
  hot.forEach(([x, z, face], i) => desks.push({
    id: `plaza#${i}`, room: 'plaza', index: i, hot: true,
    x, z: z + (face === 'S' ? 0.45 : -0.45), face,
    seat: { x, z, face },
  }));

  /* ---- furniture: project rooms --------------------------------------- */

  const DESK_X = [2.45, 4.15, 5.85, 7.55];
  for (const room of rooms) {
    if (room.kind !== 'project' && room.kind !== 'vacant') continue;
    const { x: x0, z: z0 } = room.rect;
    const doorZ = room.side === 'N' ? 0 : CORRIDOR_D;
    put('roomsign', x0 + 5, doorZ, room.side === 'N' ? 'S' : 'N', { id: `sign:${room.id}`, room: room.id });
    if (room.kind === 'vacant') {
      put('boxes', x0 + 2.5, z0 + 2.5, 'S', { id: `boxes:${room.id}:a` });
      put('boxes', x0 + 7.2, z0 + 5.6, 'E', { id: `boxes:${room.id}:b` });
      put('ladder', x0 + 6.4, z0 + 2.2, 'S', { id: `ladder:${room.id}` });
      put('vacantsign', x0 + 5, z0 + 0.06, 'S', { id: `vacant:${room.id}` });
      continue;
    }
    // Everything hangs on the north wall, which faces the default camera.
    const boardX = room.side === 'N' ? x0 + 5 : x0 + 2;
    const credenzaX = room.side === 'N' ? x0 + 2 : x0 + 7.6;
    put('taskboard', boardX, z0 + 0.06, 'S', { id: `board:${room.id}`, room: room.id, deptId: room.deptId,
      poi: { kind: 'board', label: 'the task board', stand: { x: boardX, z: z0 + 1.4 } } });
    put('credenza', credenzaX, z0 + 0.3, 'S', { id: `credenza:${room.id}`, deptId: room.deptId,
      poi: { kind: 'shelf', label: 'the team shelf', stand: { x: credenzaX, z: z0 + 1.4 } } });
    put('cabinet', x0 + 9.5, z0 + 0.4, 'S', { id: `cabinet:${room.id}`, deptId: room.deptId,
      poi: { kind: 'cabinet', label: 'the filing cabinet (project binder)', stand: { x: x0 + 9.5, z: z0 + 1.5 } } });
    put('plant', x0 + 0.5, z0 + 7.5, 'S', { id: `plant:${room.id}` });
    put('floorlamp', x0 + 9.5, z0 + 7.5, 'S', { id: `lamp:${room.id}` });
    put('rug', x0 + 5, z0 + 4, 'S', { id: `rug:${room.id}`, shape: 'rect', size: [8.6, 4.4], color: room.color || null, tint: true });
    // Flair, against the side walls in the half of the room away from the board.
    // (The aisles past the ends of the desks stay clear: they are the only way round.)
    const h = hashId(String(room.deptId));
    const big = FLAIR_BIG[h % FLAIR_BIG.length], small = FLAIR_SMALL[(h >>> 3) % FLAIR_SMALL.length];
    const bigWest = ((h >>> 6) & 1) === 0;
    for (const [flair, west] of [[big, bigWest], [small, !bigWest]]) {
      const depth = PREFAB[flair[0]][1];
      put(flair[0], west ? x0 + 0.14 + depth / 2 : x0 + 9.86 - depth / 2, z0 + 6.1, west ? 'E' : 'W',
        { id: `${flair[0]}:${room.id}`, poi: { kind: flair[1], label: flair[2] } });
    }
    if ((h >>> 9) % 2 === 0) {
      put('dartboard', x0 + 0.06, z0 + 1.9, 'E', { id: `dartboard:${room.id}`,
        poi: { kind: 'darts', label: 'a dartboard', stand: { x: x0 + 1.6, z: z0 + 1.9 } } });
    }
    for (let i = 0; i < DESKS_PER_ROOM; i++) {
      const rowA = i < 4;
      const dx = x0 + DESK_X[i % 4];
      const dz = z0 + (rowA ? 3.6 : 4.4);
      const face = rowA ? 'S' : 'N';
      const id = `${room.id}#${i}`;
      put('desk', dx, dz, face, { id: `desk:${id}`, room: room.id, desk: id });
      desks.push({
        id, room: room.id, index: i, hot: false,
        x: dx, z: dz, face,
        // close enough to reach the keyboard, and still on the walkable tile behind the desk
        seat: { x: dx, z: z0 + (rowA ? 2.95 : 5.05), face },
      });
    }
  }

  /* ---- finish --------------------------------------------------------- */

  const pois = new Map();
  for (const o of objects) if (o.poi) pois.set(o.poi.id, { ...o.poi, room: o.room, object: o.id });
  const locked = new Set(rooms.filter((r) => r.locked).map((r) => r.id));
  const walkable = (x, z) => {
    const room = tiles.get(tileKey(x, z));
    return !!room && !locked.has(room) && !blocked.has(tileKey(x, z));
  };

  return {
    v: 1,
    cols, westX, eastX,
    bounds: { x0: minX, z0: minZ, x1: maxX, z1: maxZ },
    rooms, roomById, tiles, walls, doors, wallEdges, objects, desks, pois, blocked,
    roomAt, walkable,
    desk: (id) => desks.find((d) => d.id === id) || null,
    spots: {
      elevator: { x: 0, z: -9 },          // inside the car
      landing: { x: 0, z: -7.3 },         // just outside the doors
      entrance: { x: 0, z: 10.4 },
      plaza: { x: 0, z: 3.6 },
    },
  };
}

/** A compact description of the plan for humans and logs. */
export function describeSlot(slot) {
  const { wing, side, col } = slotInfo(slot);
  return `${wing === 'W' ? 'West' : 'East'} wing · ${side === 'N' ? 'north' : 'south'} side · bay ${col + 1}`;
}
