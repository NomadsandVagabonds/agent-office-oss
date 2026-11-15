// The Backrooms — the hallway that is not sure where it leads. The room you
// come into, a hallway out of the far side of it, and a room at the far end
// of that with nothing in it but a column. Walk through, go round the column
// (there is nowhere else to go), and the room you came through is not there:
// the hallway now ends in a room with no doorway in it but the hallway. You
// came in by a doorway. Look away again, look back, and it is a third room,
// and that one has the way out in it.
//
// It is the building that changes, not the wallpaper (rooms/unsure-hall/rule.js):
// the doorway you came in by and the doorway to the fire exit are real
// doorways to real rooms, and each is there or is wall, for you and for
// anything else that walks (world.throats). The fire exit is beyond this
// room and nowhere else (deck2.js, `gate`), so this is the way out of the part.
//
// It takes the cardboard people for granted (`needs: unwatched`): they are
// where anybody learns that some things only move while nobody is looking.
// Nobody can be shut in for good: the three rooms come round again, the first
// has the way back in it and the third the way on, it never turns while
// anybody or anything is standing in it or in one of its doorways, and it
// never turns at all unless the visitor is in the hallway or the room beyond.
import { Batch, lin, WHITE } from '../kit.js';
import { toLocal } from '../gen.js';
import { T } from '../frame.js';
import { card } from '../bits.js';
import { ROOMS, DOORWAYS, PLAN, partsOf, settled, unsure } from './unsure-hall/rule.js';

// What the other two rooms are papered and furnished as: each a kind of room you would know anywhere, in paper this part of the building does not have.
const FACES = {
  break: { family: 'salmon', pattern: 'dots', floor: 'lino', wall: '#e2b3a4', ink: '#c98f7f', pale: '#edc9bd', carpet: '#7b8a86', trim: '#5c4036' },
  waiting: { family: 'blue', pattern: 'stripes', floor: 'carpet', wall: '#aebfcc', ink: '#8fa4b5', pale: '#c3d1db', carpet: '#4d566b', trim: '#343a4a' },
  store: { family: 'records', pattern: 'blocks', floor: 'screed', wall: '#c2c3b2', ink: '#a5a796', pale: '#d0d1c2', carpet: '#70726a', trim: '#3e4a42' },
  lounge: { family: 'panel', pattern: 'panel', floor: 'plush', wall: '#79512f', ink: '#5f3d22', pale: '#8c6240', carpet: '#22442f', trim: '#3f2a18' },
};
export const FACE_IDS = Object.keys(FACES);

export function build(c) {
  const { W, D, H, kit, room, params: p } = c;
  const { zEnd, zView, on, column } = partsOf(room);
  c.shell();

  // its two doorways: the one it is entered by (in the front wall), and the one the way out is beyond (in a side wall of the room at the front)
  const linkOf = (id) => room.doors.find((d) => d.link === id) || null;
  const dIn = (room.gate && linkOf(room.gate.in)) || room.doors.find((d) => d.side === 'front') || null;
  const dOn = (room.gate && linkOf(room.gate.on)) || room.doors.find((d) => d !== dIn && (d.side === 'left' || d.side === 'right')) || null;
  const sx = dOn ? (dOn.side === 'left' ? -1 : 1) : 1;                                        // which side the way on is

  // the hallway: straight on from the doorway you came in by, walled with the part's own paper; and the column in the room it leads to
  const hw = PLAN.half, xh = Math.max(-W / 2 + hw + 0.5, Math.min(W / 2 - hw - 0.5, dIn ? dIn.c : 0));
  for (const [x0, x1] of [[-W / 2, xh - hw], [xh + hw, W / 2]]) if (x1 - x0 > 0.3) c.pillar((x0 + x1) / 2, (zEnd + zView) / 2, x1 - x0, zEnd - zView);
  c.pillar(xh + column.x, column.z, column.s, column.s);
  // (kept clear, whichever room it is: the way in, the way on, the mouth of the hallway, and behind the column, where something may be hidden)
  for (const [x, z, r] of [[dIn ? dIn.c : 0, D / 2 - 1.1, 1.1], [sx * (W / 2 - 1.1), on, 1.1], [xh, zEnd + 0.9, 1.3], [xh, column.z - column.s / 2 - 0.8, 0.7]]) c.reserve(x, z, r);

  /* ---- the three rooms the room at the front can be ------------------------------------------- */
  const k = 0.012;                                                                            // each is laid over the shell, a finger's width proud of it
  const span = (d) => (d ? [d.c - d.w / 2 - 0.02, d.c + d.w / 2 + 0.02, (d.sill || 0) + d.h] : null);
  /** One stretch of wall from a to b (n, to the left of that, points into the room), papered, skirted, with a gap wherever `gaps` says: [from, to, top] along it. */
  const wall = (wallB, flatB, trim, ax, az, bx, bz, gaps = []) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux;
    const cuts = [0, ...gaps.flatMap((g) => [g[0], g[1]]), len].map((t) => Math.max(0, Math.min(len, t)));
    const quad = (t0, t1, y0, y1) => {
      if (t1 - t0 < 0.02 || y1 - y0 < 0.02) return;
      const A = [ax + ux * t0 + nx * k, az + uz * t0 + nz * k], B = [ax + ux * t1 + nx * k, az + uz * t1 + nz * k];
      wallB.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], WHITE, [[t0 / 0.8, y0 / 0.8], [t1 / 0.8, y0 / 0.8], [t1 / 0.8, y1 / 0.8], [t0 / 0.8, y1 / 0.8]]);
      if (y0 < 0.01) flatB.box(Math.min(A[0], B[0], A[0] + nx * 0.02), 0, Math.min(A[1], B[1], A[1] + nz * 0.02), Math.max(A[0], B[0], A[0] + nx * 0.02), 0.11, Math.max(A[1], B[1], A[1] + nz * 0.02), trim, { skip: '-y' });
    };
    for (let i = 0; i + 1 < cuts.length; i += 2) quad(cuts[i], cuts[i + 1], 0, H);
    for (const g of gaps) quad(Math.max(0, g[0]), Math.min(len, g[1]), g[2], H);
  };
  // furniture keeps to the walls and the corners, and never to the three places a way through can be
  const L = -W / 2 + 0.75, R = W / 2 - 0.75, zf = D / 2 - 0.75, zb = zEnd + 0.75, far = -sx * (W / 2 - 0.75), mid = (zf + zb) / 2, turn = -sx * Math.PI / 2;
  const furnish = {
    own: (put) => { put('plant', far, zf, 0); put('boxes', sx * (W / 2 - 0.8), zb + 0.1, 0.4); },
    break: (put) => { put('desk', far - sx * 0.2, mid, turn); put('chair', far + sx * 0.9, mid + 0.2, -turn + 0.4, { solid: false }); put('bin', far, zb, 0); put('plant', far, zf, 0); },
    waiting: (put) => { for (let i = 0; i < 4; i++) put('chair', far, zb + 0.5 + i * 0.75, -turn); put('plant', sx * (W / 2 - 0.75), zb, 0); },
    store: (put) => { put('shelving', far - sx * 0.2, zb + 0.9, -turn); put('shelving', far - sx * 0.2, zf - 0.9, -turn); put('boxes', sx * (W / 2 - 0.8), zb + 0.1, 0.3); put('boxes', sx * (W / 2 - 0.8), zf - 0.1, 1.2); },
    lounge: (put) => { put('armchair', far, zb + 0.3, -turn + 0.3 * sx); put('armchair', far, zf - 0.3, -turn - 0.3 * sx); put('lamp', sx * (W / 2 - 0.75), zb, 0); put('plant', sx * (W / 2 - 0.75), zf, 0); },
  };
  const faces = ROOMS.map((name, i) => {
    const id = i === 0 ? 'own' : p.faces[i - 1] || FACE_IDS[i - 1], look = i === 0 ? c.look : { ...c.look, ...FACES[id] };
    const open = DOORWAYS[name], face = { name, id, parts: [], solids: [] };
    const floorB = new Batch(), wallB = new Batch(), flatB = new Batch(), voxB = new Batch(true), trim = lin(look.trim);
    floorB.grid([-W / 2, 0.006, zEnd], [0, 0, 1], [1, 0, 0], [0, PLAN.end / 2, PLAN.end], [0, W / 2, W], (u, v) => [v / 1.6, u / 1.6], WHITE);
    // its four walls, as somebody standing in it reads them, with a gap only where this room has a doorway
    const gIn = open.in && dIn ? span(dIn) : null, gOn = open.on && dOn ? span(dOn) : null;
    wall(wallB, flatB, trim, W / 2, D / 2, -W / 2, D / 2, gIn ? [[W / 2 - gIn[1], W / 2 - gIn[0], gIn[2]]] : []);                                  // the front: where you came in
    wall(wallB, flatB, trim, -W / 2, D / 2, -W / 2, zEnd, gOn && sx < 0 ? [[D / 2 - gOn[1], D / 2 - gOn[0], gOn[2]]] : []);                         // the left
    wall(wallB, flatB, trim, W / 2, zEnd, W / 2, D / 2, gOn && sx > 0 ? [[gOn[0] - zEnd, gOn[1] - zEnd, gOn[2]]] : []);                             // the right
    if (xh - hw > -W / 2 + 0.05) wall(wallB, flatB, trim, -W / 2, zEnd, xh - hw, zEnd);                                                            // either side of the hallway's mouth
    if (xh + hw < W / 2 - 0.05) wall(wallB, flatB, trim, xh + hw, zEnd, W / 2, zEnd);
    const before = c.rt.colliders.length;
    furnish[id]((type, x, z, rot, o) => { if (c.hasProp(type)) c.prop(type, x, z, { rot, batch: voxB, shadow: false, ...o }); });
    face.solids = c.rt.colliders.slice(before);
    face.parts.push(c.dynamic(floorB, { map: kit.tex.floor(look) }), c.dynamic(wallB, { map: kit.tex.wallpaper(look) }), c.dynamic(flatB), c.dynamic(voxB));
    return face;
  });

  // A doorway that is not there is wall from the other side as well: papered as the room on that side is (nobody is
  // meant to be standing there to see it, and it is there in case somebody is).
  const stopped = (d) => {
    if (!d) return null;
    const there = c.world.rooms[d.to]?.def.look || c.look, b = new Batch(), fb = new Batch(), out = T / 2 - 0.004, y1 = (d.sill || 0) + d.h, a = d.c - d.w / 2, e = d.c + d.w / 2;
    const uv = [[0, 0], [d.w / 0.8, 0], [d.w / 0.8, y1 / 0.8], [0, y1 / 0.8]];
    if (d.side === 'front') { const z = D / 2 + out; b.quad([a, 0, z], [e, 0, z], [e, y1, z], [a, y1, z], WHITE, uv); fb.box(a, 0, z, e, 0.11, z + 0.02, lin(there.trim), { skip: '-y' }); }
    else if (d.side === 'left') { const x = -W / 2 - out; b.quad([x, 0, a], [x, 0, e], [x, y1, e], [x, y1, a], WHITE, uv); fb.box(x - 0.02, 0, a, x, 0.11, e, lin(there.trim), { skip: '-y' }); }
    else if (d.side === 'right') { const x = W / 2 + out; b.quad([x, 0, e], [x, 0, a], [x, y1, a], [x, y1, e], WHITE, uv); fb.box(x, 0, a, x + 0.02, 0.11, e, lin(there.trim), { skip: '-y' }); }
    else return null;
    return [c.dynamic(b, { map: kit.tex.wallpaper(there) }), c.dynamic(fb)];
  };
  const shutIn = stopped(dIn), shutOn = stopped(dOn);

  // In the room with the way on: the sign over it, and one on the wall the hallway looks at, pointing. (A fire exit is signed.)
  const signs = [];
  if (dOn) {
    const lit = (key, text, side, at, y, w, h) => { const b = new Batch(); c.hang(b, side, at, y, w, h, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.05); signs.push(c.dynamic(b, { map: card(c, key, [text], { w: 128, h: 40, bg: '#1f8a4e', fg: '#eafff0', edge: '#0d3a22', size: 24, pad: 6, weight: 700 }), unlit: true })); };
    lit('unsure:exit', 'EXIT', dOn.side, dOn.c, Math.min(H - 0.2, (dOn.sill || 0) + dOn.h + 0.26), 0.82, 0.26);
    // (somebody looking down the hallway has the room's left wall on their right)
    lit(`unsure:exit:${sx}`, sx < 0 ? 'EXIT >' : '< EXIT', 'front', xh, Math.min(H - 0.3, 2.2), 0.96, 0.3);
  }

  /* ---- which of them it is ------------------------------------------------------------------ */
  // A doorway with a door of its own in it (the fire exit, hung straight off this room) is put back the way that door had left it.
  const held = new Map();
  const doorway = (d, open) => {
    const th = d ? c.world.throats[d.link] : null;
    if (!th) return;
    if (!th.link.door) { th.open = open; return; }
    if (!open) { if (!held.has(d.link)) held.set(d.link, th.open); th.open = false; } else if (held.has(d.link)) { th.open = held.get(d.link); held.delete(d.link); }
  };
  const show = (i) => {
    faces.forEach((f, j) => { for (const part of f.parts) part.visible = j === i; for (const col of f.solids) col.on = j === i; });
    const open = DOORWAYS[ROOMS[i]];
    doorway(dIn, open.in); doorway(dOn, open.on);
    for (const part of shutIn || []) part.visible = !open.in;
    for (const part of shutOn || []) part.visible = !open.on;
    for (const sign of signs) sign.visible = open.on;
  };
  c.after.push(() => show(0));

  // while nobody is looking, nobody is in it, and the visitor is in the hallway or the room beyond
  const inEnd = (x, z) => x > -W / 2 - 0.7 && x < W / 2 + 0.7 && z > zEnd - 0.15 && z < D / 2 + 0.7;       // (the room, and half a pace into each of its doorways)
  const spots = [[xh, zEnd + 0.5], [xh, D / 2 - 0.5], [0, on], [-W / 4, on], [W / 4, on], [-W / 2 + 0.6, zEnd + 0.6], [W / 2 - 0.6, zEnd + 0.6], [-W / 2 + 0.6, D / 2 - 0.6], [W / 2 - 0.6, D / 2 - 0.6]];
  let s = settled();
  c.tick((dt, t, me) => {
    const inside = inEnd(me.x, me.z), near = !!me.inside && !inside;
    const busy = c.world.bodies.some((b) => { const l = toLocal(room, b.x, b.z); return inEnd(l.x, l.z); });
    const watched = spots.some(([x, z]) => c.seen(x, z, { margin: 0.25, radius: 0.8 }));
    s = unsure(s, dt, { watched, inside, busy, near });
    if (s.turned) show(s.face);
  });
  c.rt.unsure = { get face() { return ROOMS[s.face]; }, count: ROOMS.length, parts: { zEnd, zView, xh, column: { x: xh + column.x, z: column.z, s: column.s } } };          // (for the dev page, and for whoever is checking it)
}
