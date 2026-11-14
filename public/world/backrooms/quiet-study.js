// Optional authoring fixture, used only when the dev preview explicitly requests it.
// These repeated rooms do not join DECK or alter the normal generator's pacing.
import { generate, makeRng, toLocal, toWorld, T, DOOR_H, TILE } from './gen.js';
import { quietMazeLayout } from './quiet-maze-layout.js';

const SIZE = 12, HEIGHT = 2.6, WIDTH = 1.8;
const EDGES = [[0, 1], [1, 2], [2, 5], [5, 4], [4, 3], [3, 0], [3, 6], [6, 7], [7, 8], [8, 5]];
const YELLOW = {
  family: 'yellow', pattern: 'dots', wall: '#d7cd8f', ink: '#c7b76d', pale: '#dfd8ab',
  carpet: '#827d61', trim: '#6e4f2d', ceil: '#d6d5c9', tube: '#ffeec4',
};

// The same ceiling rhythm in every large room. Coordinates respect the shell's
// 60 cm ceiling grid; the two dead panels repeat instead of becoming landmarks.
function panelsFor(W, D) {
  const nx = Math.max(1, Math.round(W / 3)), nz = Math.max(1, Math.round(D / 3));
  const panels = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = (Math.round((-W / 2 + (i + 0.5) * W / nx) / TILE - 0.5) + 0.5) * TILE;
    const z = Math.round((-D / 2 + (j + 0.5) * D / nz) / TILE) * TILE;
    if (Math.abs(x) + TILE / 2 >= W / 2 || Math.abs(z) + TILE >= D / 2) continue;
    panels.push({ x, z, state: nx === 4 && nz === 4 && ((i === 0 && j === 2) || (i === 3 && j === 1)) ? 'dead' : 'on' });
  }
  return panels;
}

function descriptor(id, x, z, w, d, rot, look) {
  const W = (rot % 2 ? d : w) - T, D = (rot % 2 ? w : d) - T;
  return {
    id, kind: 'plain', arch: null, x, z, w, d, rot, y: 0, H: HEIGHT, crawl: false,
    cx: x + w / 2, cz: z + d / 2, W, D, doors: [], depth: 0, toExit: 0,
    look: { ...look }, light: { dead: 0, flicker: 0, power: 1, mode: 'normal' },
    pillars: [], dress: [], sign: null, shape: null, wins: [], panels: panelsFor(W, D),
  };
}

function connect(rooms, links, aId, bId, offset) {
  const a = rooms[aId], b = rooms[bId];
  const axis = a.x + a.w === b.x || b.x + b.w === a.x ? 'x' : 'z';
  const at = axis === 'x' ? Math.max(a.x, b.x) : Math.max(a.z, b.z);
  // Shared wall midpoint: offsets are always one of the same two positions.
  const from = axis === 'x' ? Math.max(a.z, b.z) : Math.max(a.x, b.x);
  const to = axis === 'x' ? Math.min(a.z + a.d, b.z + b.d) : Math.min(a.x + a.w, b.x + b.w);
  const mid = (from + to) / 2 + offset;
  const link = { id: links.length, a: aId, b: bId, axis, at, from: mid - WIDTH / 2, to: mid + WIDTH / 2, door: false, kind: 'door', y: 0, h: DOOR_H };
  links.push(link);
  for (const room of [a, b]) {
    const p = toLocal(room, axis === 'x' ? at : mid, axis === 'x' ? mid : at);
    const side = Math.abs(Math.abs(p.z) - (room.D + T) / 2) < 1e-6 ? (p.z > 0 ? 'front' : 'back') : (p.x > 0 ? 'right' : 'left');
    room.doors.push({ side, c: side === 'front' || side === 'back' ? p.x : p.z, w: WIDTH, link: link.id, to: room === a ? b.id : a.id, door: false, kind: 'door', sill: 0, h: DOOR_H });
  }
}

function distances(rooms, origin) {
  const found = new Map([[origin, 0]]), queue = [origin];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const door of rooms[id].doors) if (!found.has(door.to)) {
      found.set(door.to, found.get(id) + 1);
      queue.push(door.to);
    }
  }
  return found;
}

/** A finite, deliberately repetitive walk-through for comparing quiet room motifs.
 * Only identity fields are borrowed from opt; loot, pursuers and normal deck options
 * cannot leak into this fixture. The normal generate() result is never mutated.
 */
export function generateQuietStudy(seed, opt = {}) {
  const base = generate(seed, { name: opt.name, projects: opt.projects, agents: opt.agents, tasks: opt.tasks, pursuer: false });
  const R = makeRng(`quiet-study:${seed}`), phase = R.int(0, 3), sign = R.chance(0.5) ? 1 : -1;
  const yellow = base.rooms.find((r) => r.look.family === 'yellow');
  const look = yellow ? { ...yellow.look, tube: YELLOW.tube } : { ...base.rooms[0].look, ...YELLOW };
  const rooms = Array.from({ length: 9 }, (_, id) => {
    const col = id % 3, row = Math.floor(id / 3);
    const room = descriptor(id, col * SIZE, row * SIZE, SIZE, SIZE, 0, look);
    const variant = (row + col) % 3, turn = (phase + row + col * 2) % 4;
    const { pillars, probes } = quietMazeLayout({ W: room.W, D: room.D, variant, turn });
    room.pillars = pillars;
    room.quietStudy = { variant, turn, probes, detail: null };
    return room;
  });

  // Repeated static wrongness belongs in the connective fabric too. Both
  // copies use the same motif-local composition; no room gets its own event.
  for (const room of rooms.filter(r => r.id !== 0 && r.quietStudy.variant === 0)) room.quietStudy.detail = 'apertures';
  for (const room of R.fork('still-details').shuffle(rooms.filter(r => r.quietStudy.variant === 1)).slice(0, 2)) room.quietStudy.detail = 'sunken';

  // A normal exit annex, outside the nine-room study. Its local front faces west
  // toward room 8; the existing exit builder puts the actual exit on its back wall.
  const oldExit = base.rooms[base.exit.room];
  rooms.push({ ...oldExit, ...descriptor(9, 36, 26, 4, 8, 3, look), kind: 'exit', name: 'Way out' });
  const links = [];
  EDGES.forEach(([a, b], i) => connect(rooms, links, a, b, (i % 2 ? -sign : sign) * 2.4));
  connect(rooms, links, 8, 9, sign * 2.4);
  const depth = distances(rooms, 0), toExit = distances(rooms, 9);
  for (const room of rooms) { room.depth = depth.get(room.id); room.toExit = toExit.get(room.id); }

  // Face into the repeated aisle, rather than arriving nose-on to the broad
  // side of a partition when the motif has turned. Still on the outer strip.
  const turn = rooms[0].quietStudy.turn, edge = rooms[0].D / 2 - 0.8;
  const localSpawn = [{ x: 0, z: edge }, { x: edge, z: 0 }, { x: 0, z: -edge }, { x: -edge, z: 0 }][turn];
  const spawn = toWorld(rooms[0], localSpawn.x, localSpawn.z);
  return {
    seed: base.seed, name: base.name, cast: base.cast.slice(), projects: base.projects.slice(),
    rooms, links, picked: [], pursuer: null, windows: [], hint: 'the plain rooms',
    start: { room: 0, x: spawn.x, z: spawn.z, yaw: turn * Math.PI / 2 }, exit: { room: 9 },
    stamp: { ...base.stamp }, hum: base.hum,
    quietStudy: { version: 2, rooms: 9, motifs: 3 },
  };
}
