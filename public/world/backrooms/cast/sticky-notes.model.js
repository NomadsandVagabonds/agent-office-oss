// The Backrooms — one of the sticky notes (cast/sticky-notes.js: the cast's rule says where it is and what it is doing;
// this is its body and how that moves). A square of paper, glued along its top edge, and the rest of it free to curl:
// one sheet, five rows deep, bent by moving its own vertices, so it costs one mesh a note however it moves.
//
//   makeStickyNote(kit, colour, seed) → { group, light(rgb), pose({ mode, t, time, heading }) }
//   group    the cast places and moves it. It faces +z, its glued edge at the top, its back flat at z 0: on a wall,
//            the wall is behind it.
//   pose     mode 'wall' | 'peel' | 'flutter' | 'dive' | 'stuck' | 'knocked' | 'wiped', t seconds in that mode,
//            time the room's clock, heading the way it goes (radians, as the cast's rot). Nothing random: seed is the
//            cast's (which note of the room it is), and only shifts its timing.
//     wall     flat, the free edge lifting a hair now and then, as paper in a draught
//     peel     it comes away from the bottom up, trembling, and stands off the wall by its glued edge
//     flutter  in the air: it flaps from the glued edge, tips and bobs
//     dive     rigid, edge first, the way it is going, with a slow turn about its long line
//     stuck    on the lens: the hand's view draws it there (hand-notes.js), so nothing here
//     knocked  hit out of the air: it tumbles, and comes to rest lying flat
//     wiped    gone with the hand: nothing here
import * as THREE from 'three';
import { Batch, lin } from '../kit.js';

export const NOTE_SIZE = 0.135;       // metres along a side: well over a real one's, so it reads as a note from across a room (the lead: at 8.5 cm, "only a small speck")
const ROWS = 5;
// (its curls were set for a sheet of 8.5 cm: a bigger one bends through the same angles, not further)
const CURL = 0.085 / NOTE_SIZE;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); };

/**
 * Where a point of the sheet goes for a bend (pure): `s` metres down from the glued edge, the sheet bent from `from` metres
 * down with curvature `k` (1/m; + curls toward +z, off a wall) → [y, z] in the note's own frame (y 0 the glued edge).
 */
export function bentAt(s, k, from = NOTE_SIZE * 0.22) {
  if (s <= from || Math.abs(k) < 1e-6) return [-s, 0];
  const a = (s - from) * k;
  return [-from - Math.sin(a) / k, (1 - Math.cos(a)) / k];
}

/** How a note is bent and held, by mode (pure) → { k, from, hidden, pitch, roll, yaw, bob }. */
export function notePose({ mode = 'wall', t = 0, time = 0, heading = 0 } = {}, seed = 0) {
  const ph = seed * 1.913, L = NOTE_SIZE;
  switch (mode) {
    case 'stuck': case 'wiped': return { k: 0, from: 0, hidden: true, pitch: 0, roll: 0, yaw: 0, bob: 0 };
    case 'peel': {
      const e = smooth(t / 0.5);
      return { k: (2 + 16 * e) * (1 + 0.15 * Math.sin(time * 41 + ph)), from: L * (0.9 - 0.68 * e), hidden: false, pitch: 0.35 * e, roll: 0.04 * Math.sin(time * 33 + ph) * e, yaw: 0, bob: 0 };
    }
    case 'flutter': {
      const f = Math.sin(time * 15 + ph);
      return { k: 14 * f, from: L * 0.15, hidden: false, pitch: 0.5 + 0.25 * Math.sin(time * 4.3 + ph), roll: 0.3 * Math.sin(time * 3.1 + ph * 2), yaw: heading, bob: 0.03 * Math.sin(time * 7.5 + ph) };
    }
    case 'dive':
      return { k: -1.5, from: L * 0.22, hidden: false, pitch: 1.35, roll: time * 3 + ph, yaw: heading, bob: 0 };
    case 'knocked': {
      const spin = Math.max(0, 1 - t / 0.7);
      const flat = smooth((t - 0.55) / 0.3);
      return { k: 10 * Math.sin(t * 22 + ph) * spin, from: L * 0.15, hidden: false, pitch: (t * 13 + ph) * spin * (1 - flat) + (-Math.PI / 2) * flat, roll: (t * 7) * spin * (1 - flat), yaw: heading, bob: 0 };
    }
    default: {          // wall
      const draught = Math.max(0, Math.sin(time * 0.9 + ph)) ** 6;
      return { k: 1.5 + 5 * draught * (0.7 + 0.3 * Math.sin(time * 23 + ph)), from: L * 0.45, hidden: false, pitch: 0, roll: 0, yaw: 0, bob: 0 };
    }
  }
}

export function makeStickyNote(kit, colour = '#f4e04d', seed = 0) {
  const h = NOTE_SIZE / 2, rows = Array.from({ length: ROWS + 1 }, (_, i) => (i / ROWS) * NOTE_SIZE);
  const b = new Batch();
  // the sheet: facing +z, from the glued edge (y 0) down; a little darker toward the free edge, where it lifts
  b.grid([h, 0, 0], [-1, 0, 0], [0, -1, 0], [0, NOTE_SIZE], rows, null, lin(colour), (u, v) => 1 - 0.12 * (v / NOTE_SIZE));
  // and on it (the cast's stand-in, noteVox: "words live in the world"), on an 8 × 8 grid: the glue strip along the top two
  // rows, a shade lighter; then three lines of scribble in dark ink, each ending somewhere else, with gaps, so it reads as
  // writing from across a room and not as a rule. Which note of the room it is (seed) moves the ends and the gaps.
  const G = 8, cell = NOTE_SIZE / G, k = ((Math.round(seed) % 3) + 3) % 3, lift = new Map();
  const patch = (x0, x1, y0, y1, alb, off) => { const at = b.verts; b.quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], alb); for (let i = at; i < b.verts; i++) lift.set(i, off); };
  patch(-h, h, -2 * cell, 0, lin(colour, 1.08), 0.0006);
  // (and on the back as well, as seen from behind: one that flies or tumbles turns its back to you as often as its face,
  // and a blank one reads as a coloured square, not a note)
  for (const side of [1, -1]) for (let line = 0; line < 3; line++) {
    const top = (2 + line * 2) * cell + cell * 0.3, end = G - 1 - ((k + line) % 3);
    for (let x = 1; x < end; x++) if ((x * 7 + line * 3 + k) % 5 !== 0) {
      const x0 = side * (-h + x * cell), x1 = side * (-h + (x + 1) * cell);
      patch(Math.min(x0, x1), Math.max(x0, x1), -top - cell * 0.4, -top, lin('#2a2f4a'), side * 0.0012);
    }
  }
  const geo = kit.geometry(b, [], [1, 1, 1]);
  const mat = kit.surface({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'sticky-note';
  const inner = new THREE.Group(), group = new THREE.Group();
  group.name = 'sticky-note';
  inner.add(mesh); group.add(inner);
  const pos = geo.attributes.position, down = Float32Array.from({ length: pos.count }, (_, i) => -pos.getY(i)), proud = Float32Array.from({ length: pos.count }, (_, i) => lift.get(i) || 0);
  let lastK = NaN, lastFrom = NaN;

  function bend(k, from) {
    if (Math.abs(k - lastK) < 1e-4 && Math.abs(from - lastFrom) < 1e-6) return;          // (still: nothing redrawn)
    lastK = k; lastFrom = from;
    for (let i = 0; i < pos.count; i++) {
      // (what is on the sheet stands off it along the sheet's own face, however far that face has turned)
      const [y, z] = bentAt(down[i], k, from), a = Math.max(0, down[i] - from) * k, off = 0.0015 + proud[i];
      pos.setY(i, y + Math.sin(a) * off); pos.setZ(i, z + Math.cos(a) * off);
    }
    pos.needsUpdate = true;
  }

  function pose(state = {}) {
    const p = notePose(state, seed);
    inner.visible = !p.hidden;
    if (p.hidden) return;
    bend(p.k * CURL, p.from);
    inner.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
    inner.position.set(0, p.bob, 0);
  }

  pose({ mode: 'wall' });
  return {
    group,
    mesh,
    // lit by the room, but never past full: a bright room let it out to near white, and it is its colour that makes it a note
    // from across a room (the cast: "saturated paper rather than near-white"). A dark one keeps a floor, so it still shows.
    light(rgb) { const f = (v) => Math.min(1, Math.max(0.3, v * 0.95 + 0.04)); mat.uniforms.uTint.value.set(f(rgb[0]), f(rgb[1]), f(rgb[2])); },
    pose,
  };
}
