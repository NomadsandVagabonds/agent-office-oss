// Small, isolated authoring visits. None of these candidates enters the normal
// room deck: the dev page must explicitly select a study and its builder.
import { generate, makeRng, T, TILE, DOOR_H } from './gen.js';

export const FEATURE_STUDIES = Object.freeze({
  underfloor: Object.freeze({ name: 'Underfloor Walker', W: 11.8, D: 19.8, H: 3.2 }),
  'flood-mark': Object.freeze({ name: 'Flood-Mark Hall', W: 17.8, D: 23.8, H: 5 }),
  'window-court': Object.freeze({ name: 'Window Court', W: 23.8, D: 27.8, H: 12 }),
});

const YELLOW = {
  family: 'yellow', pattern: 'dots', wall: '#d7cd8f', ink: '#c7b76d', pale: '#dfd8ab',
  carpet: '#827d61', trim: '#6e4f2d', ceil: '#d6d5c9', tube: '#ffeec4',
};
const FLOOD = {
  family: 'sage', pattern: 'dots', wall: '#adb5a0', ink: '#88917f', pale: '#c9ccba',
  carpet: '#4d5b52', trim: '#5d6257', ceil: '#bec1b3', tube: '#e4edda',
};
const DOOR_WIDTH = 1.8, ANNEX = 6;

function panelsFor(W, D, sparse) {
  const nx = Math.max(1, Math.round(W / (sparse ? 5 : 3))), nz = Math.max(1, Math.round(D / (sparse ? 5 : 3)));
  const panels = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = (Math.round((-W / 2 + (i + 0.5) * W / nx) / TILE - 0.5) + 0.5) * TILE;
    const z = Math.round((-D / 2 + (j + 0.5) * D / nz) / TILE) * TILE;
    if (Math.abs(x) + TILE / 2 >= W / 2 || Math.abs(z) + TILE >= D / 2) continue;
    panels.push({ x, z, state: sparse && (i + 2 * j) % 4 === 3 ? 'dead' : 'on' });
  }
  return panels;
}

function room(id, x, z, w, d, H, look, sparse = false) {
  const W = w - T, D = d - T;
  return {
    id, kind: 'plain', arch: null, x, z, w, d, cx: x + w / 2, cz: z + d / 2,
    W, D, H, rot: 0, y: 0, crawl: false, doors: [], depth: id, toExit: 2 - id,
    look: { ...look }, light: { dead: 0, flicker: 0, power: 1, mode: 'normal' },
    pillars: [], dress: [], sign: null, shape: null, wins: [], panels: panelsFor(W, D, sparse),
  };
}

// Both connections lie on a horizontal shared wall, centered on the study.
function join(rooms, links, south, north) {
  const a = rooms[south], b = rooms[north], mid = a.cx, at = a.z;
  const link = { id: links.length, a: south, b: north, axis: 'z', at,
    from: mid - DOOR_WIDTH / 2, to: mid + DOOR_WIDTH / 2,
    door: false, kind: 'door', y: 0, h: DOOR_H };
  links.push(link);
  for (const [r, side, to] of [[a, 'back', north], [b, 'front', south]]) {
    r.doors.push({ side, c: 0, w: DOOR_WIDTH, link: link.id, to,
      door: false, kind: 'door', sill: 0, h: DOOR_H });
  }
}

/** Generate one feature, preceded and followed by ordinary annexes.
 * Identity and camcorder metadata come from a normal generated visit. Room
 * choices, pursuit, loot, pacing and production defaults are not inherited.
 */
export function generateFeatureStudy(name, seed, opt = {}) {
  if (!Object.hasOwn(FEATURE_STUDIES, name)) throw new RangeError(`Unknown Backrooms feature study: ${name}`);
  const study = FEATURE_STUDIES[name];
  const base = generate(seed, { name: opt.name, projects: opt.projects, agents: opt.agents, tasks: opt.tasks, pursuer: false });
  const R = makeRng(`feature-study:${name}:${seed}`);
  const nativeYellow = base.rooms.find(r => r.look.family === 'yellow');
  const look = nativeYellow ? { ...nativeYellow.look, tube: YELLOW.tube } : { ...YELLOW };
  // Outer extents are whole metres, as expected by the existing console map.
  const w = Math.round(study.W + T), d = Math.round(study.D + T), annexX = (w - ANNEX) / 2;
  const rooms = [
    room(0, annexX, ANNEX + d, ANNEX, ANNEX, 2.6, look),
    room(1, 0, ANNEX, w, d, study.H, name === 'flood-mark' ? FLOOD : look, true),
    room(2, annexX, 0, ANNEX, ANNEX, 2.6, look),
  ];
  Object.assign(rooms[1], { kind: 'special', arch: name, name: study.name,
    params: { studySeed: `feature-study:${name}:${seed}`, variant: R.int(0, 3) } });
  Object.assign(rooms[2], { kind: 'exit', name: 'Way out' });
  const links = [];
  join(rooms, links, 0, 1);
  join(rooms, links, 1, 2);
  return {
    seed: base.seed, name: base.name, cast: base.cast.slice(), projects: base.projects.slice(),
    rooms, links, picked: [name], pursuer: null, windows: [], hint: 'the way through',
    start: { room: 0, x: rooms[0].cx, z: rooms[0].cz + 0.8, yaw: 0 }, exit: { room: 2 },
    stamp: { ...base.stamp }, hum: base.hum,
    featureStudy: { version: 1, id: name, feature: 1 },
  };
}
