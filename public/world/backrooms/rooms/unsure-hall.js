// The Backrooms — the hallway that is not sure where it leads ("the long
// hallway, whichever room it ends in"). An open hallway with no door frame
// at the end of it, and a room there. Turn your back on the room and it is
// another room: different paper, different floor, different furniture, the
// same walls and the same ways through. There are two to four of them and
// they come round again (rooms/unsure-hall/rule.js).
//
// It takes the cardboard people for granted (`needs: unwatched`): they are
// where anybody learns that some things only move while nobody is looking.
// Nothing here can trap anybody. Every room it can be has every doorway the
// others have; the furniture of all of them keeps to the walls, and the
// level's doorway check walks the floor with all of it in place at once.
// It never changes while anybody, or anything, is standing in it.
import * as THREE from 'three';
import { Batch, lin, WHITE } from '../kit.js';
import { toLocal } from '../gen.js';
import { card } from '../bits.js';
import { settled, unsure } from './unsure-hall/rule.js';

// What the far end can be, besides more of the same: each a kind of room you would know anywhere, in paper this part of the building does not have.
const FACES = {
  break: { family: 'salmon', pattern: 'dots', floor: 'lino', wall: '#e2b3a4', ink: '#c98f7f', pale: '#edc9bd', carpet: '#7b8a86', trim: '#5c4036' },
  waiting: { family: 'blue', pattern: 'stripes', floor: 'carpet', wall: '#aebfcc', ink: '#8fa4b5', pale: '#c3d1db', carpet: '#4d566b', trim: '#343a4a' },
  store: { family: 'records', pattern: 'blocks', floor: 'screed', wall: '#c2c3b2', ink: '#a5a796', pale: '#d0d1c2', carpet: '#70726a', trim: '#3e4a42' },
  lounge: { family: 'panel', pattern: 'panel', floor: 'plush', wall: '#79512f', ink: '#5f3d22', pale: '#8c6240', carpet: '#22442f', trim: '#3f2a18' },
};
export const FACE_IDS = Object.keys(FACES);

export function build(c) {
  const { W, D, H, kit, room, params: p, env } = c;
  c.shell();
  // the hallway: as wide as the door you came in by wants, straight on from it, walled with the room's own paper
  const dr = room.doors.find((d) => d.side === 'front') || { c: 0, w: 1.8 };
  const hw = Math.max(1.15, dr.w / 2 + 0.2), xh = Math.max(-W / 2 + hw + 0.5, Math.min(W / 2 - hw - 0.5, dr.c));
  const deep = Math.min(7.5, D * 0.48), zM = -D / 2 + deep, len = D / 2 - zM;                 // where the hallway opens into whatever is at the end of it
  for (const [x0, x1] of [[-W / 2, xh - hw], [xh + hw, W / 2]]) if (x1 - x0 > 0.3) c.pillar((x0 + x1) / 2, zM + len / 2, x1 - x0, len);
  c.reserve(xh, zM - 1.8, 1.0);                                                               // (the stash, and the way through: kept clear in every room it can be)

  // the rooms it can be. The first is only more of this one; the rest are laid over it, a finger's width proud, and put away
  const faces = [{ id: 'plain', parts: [], solids: [] }];
  const doors = room.doors.filter((d) => d.side !== 'front');
  for (const id of p.faces) {
    const look = { ...c.look, ...FACES[id] }, face = { id, parts: [], solids: [] };
    const floorB = new Batch(), wallB = new Batch(), flatB = new Batch(), voxB = new Batch(true), k = 0.012, trim = lin(look.trim);
    floorB.grid([-W / 2, 0.006, -D / 2], [0, 0, 1], [1, 0, 0], [0, deep / 2, deep], [0, W / 2, W], (u, v) => [v / 1.6, u / 1.6], WHITE);
    // the three walls of the end, and the shoulders either side of the hallway's mouth — with a gap wherever there is a doorway
    const wall = (ax, az, bx, bz, side) => {
      const lenW = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / lenW, uz = (bz - az) / lenW, nx = -uz, nz = ux;       // (drawn a to b as somebody in the room reads it, left to right: n points at them)
      const gaps = doors.filter((d) => d.side === side).map((d) => { const t = side === 'back' ? d.c + W / 2 : side === 'left' ? D / 2 - d.c : d.c + D / 2; return [t - d.w / 2 - 0.02, t + d.w / 2 + 0.02, (d.sill || 0) + d.h]; });
      const cuts = [0, ...gaps.flatMap((g) => [g[0], g[1]]), lenW].map((t) => Math.max(0, Math.min(lenW, t)));
      const quad = (t0, t1, y0, y1) => {
        if (t1 - t0 < 0.02 || y1 - y0 < 0.02) return;
        const A = [ax + ux * t0 + nx * k, az + uz * t0 + nz * k], B = [ax + ux * t1 + nx * k, az + uz * t1 + nz * k];
        wallB.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], WHITE, [[t0 / 0.8, y0 / 0.8], [t1 / 0.8, y0 / 0.8], [t1 / 0.8, y1 / 0.8], [t0 / 0.8, y1 / 0.8]]);
        if (y0 < 0.01) flatB.box(Math.min(A[0], B[0], A[0] + nx * 0.02), 0, Math.min(A[1], B[1], A[1] + nz * 0.02), Math.max(A[0], B[0], A[0] + nx * 0.02), 0.11, Math.max(A[1], B[1], A[1] + nz * 0.02), trim, { skip: '-y' });
      };
      for (let i = 0; i + 1 < cuts.length; i += 2) quad(cuts[i], cuts[i + 1], 0, H);
      for (const g of gaps) quad(Math.max(0, g[0]), Math.min(lenW, g[1]), g[2], H);
    };
    wall(-W / 2, -D / 2, W / 2, -D / 2, 'back');
    wall(-W / 2, zM, -W / 2, -D / 2, 'left'); wall(W / 2, -D / 2, W / 2, zM, 'right');
    if (xh - hw > -W / 2 + 0.3) wall(xh - hw, zM, -W / 2, zM, 'none');
    if (xh + hw < W / 2 - 0.3) wall(W / 2, zM, xh + hw, zM, 'none');
    // what is in it: against the walls, never across the middle (and nothing with glass in it: glass is the room's, not a face's)
    const before = c.rt.colliders.length, put = (type, x, z, rot, o) => { if (c.hasProp(type)) c.prop(type, x, z, { rot, batch: voxB, shadow: false, ...o }); };
    const L = -W / 2 + 0.75, Rr = W / 2 - 0.75, zb = -D / 2 + 0.7, zf = zM - 0.8;
    if (id === 'break') { put('bin', L, zb + 0.1, 0); put('chair', L, zb + 1.4, Math.PI / 2 - 0.3, { solid: false }); put('desk', Rr - 0.2, (zb + zf) / 2, -Math.PI / 2); put('chair', Rr - 1.0, (zb + zf) / 2 + 0.2, Math.PI / 2 + 0.4, { solid: false }); put('plant', L, zf, 0); }
    else if (id === 'waiting') { for (let i = 0; i < 4; i++) { put('chair', L, zb + 0.4 + i * 0.75, Math.PI / 2); put('chair', Rr, zb + 0.4 + i * 0.75, -Math.PI / 2); } }
    else if (id === 'store') { put('shelving', L - 0.2, zb + 0.8, Math.PI / 2); put('shelving', L - 0.2, zb + 2.6, Math.PI / 2); put('boxes', Rr, zb + 0.3, 0.3); put('boxes', Rr - 0.1, zf - 0.2, 1.2); }
    else { put('armchair', L, zb + 0.5, Math.PI / 2 + 0.3); put('armchair', Rr, zb + 0.5, -Math.PI / 2 - 0.3); put('lamp', L, zf, 0); put('plant', Rr, zf, 0); }
    face.solids = c.rt.colliders.slice(before);
    face.parts.push(c.dynamic(floorB, { map: kit.tex.floor(look) }), c.dynamic(wallB, { map: kit.tex.wallpaper(look) }), c.dynamic(flatB), c.dynamic(voxB));
    faces.push(face);
  }
  // in the last of them, somebody has kept count
  const last = faces[faces.length - 1], n = faces.length;
  if (last.id !== 'plain') {
    const tex = card(c, 'unsure' + n, [`ROOM ${n} OF ${n}`, '', 'YOU MAY STOP', 'TURNING ROUND'], { w: 96, h: 96, bg: '#f6e27a', fg: '#3a342a', size: 9, pad: 9, weight: 600 }), nb = new Batch(), x = xh + hw + 0.6 < W / 2 - 0.3 ? xh + hw + 0.5 : xh - hw - 0.5;
    if (Math.abs(x) < W / 2 - 0.3) { nb.quad([x + 0.11, 1.3, zM - 0.02], [x - 0.11, 1.3, zM - 0.02], [x - 0.11, 1.52, zM - 0.02], [x + 0.11, 1.52, zM - 0.02]); last.parts.push(c.dynamic(nb, { map: tex })); }
  }
  const show = (i) => faces.forEach((f, j) => { for (const part of f.parts) part.visible = j === i; for (const s of f.solids) s.on = j === i; });
  c.after.push(() => show(0));                                                                 // (after the doorway check has walked the floor with everything in place)

  // while nobody is looking, and nobody is in it
  const spots = [[xh, zM - 0.4], [xh, zM - deep / 2], [-W / 4, zM - deep / 2], [W / 4, zM - deep / 2], [xh, -D / 2 + 0.6], [-W / 2 + 0.6, zM - 0.6], [W / 2 - 0.6, zM - 0.6]];
  const inEnd = (x, z) => Math.abs(x) < W / 2 && z > -D / 2 - 0.3 && z < zM + 0.7;
  let s = settled();
  c.tick((dt, t, me) => {
    const walkers = [env.pursuer?.at?.(), env.pursuer?.follower].filter(Boolean).map((w) => toLocal(room, w.x, w.z));
    const occupied = (me.inside && inEnd(me.x, me.z)) || walkers.some((w) => inEnd(w.x, w.z));
    const watched = spots.some(([x, z]) => c.seen(x, z, { margin: 0.25, radius: 0.8 }));
    s = unsure(s, dt, watched, occupied, faces.length);
    if (s.turned) show(s.face);
  });
  c.rt.unsure = { get face() { return faces[s.face].id; }, count: faces.length };            // (for the dev page)
}
