// The Backrooms — the doors themselves (doors.js says which doorways have
// them). A pair of leaves hinged at the jambs, standing open into one of the
// two rooms: square to the wall, the way a door held open on a magnet stands,
// each with a kick plate, a push plate and a sign nobody has read. E shuts
// them, and opens them again, from either side. Shut, the doorway is wall as
// far as walking and seeing go; open, each leaf is something tall and thin.
// Built once the floor is up, so that the rooms themselves know nothing of it.
import * as THREE from 'three';
import { toWorld, toLocal, T } from './gen.js';
import { Batch, lin, drawText } from './kit.js';
import { WALLS } from './world.js';
import { doorPlan, inTheWay, DOORS } from './doors.js';

export const TINTS = ['#5d7a78', '#8a5a45', '#6f6a5a', '#49607c'];
const WUV = [[0.05, 0.1], [0.05, 0.1], [0.05, 0.1], [0.05, 0.1]];          // the plain part of the leaf's texture
const smooth = (k) => k * k * (3 - 2 * k);

/** A box whose every face is the plain part of the door texture. (In the room's frame; no top, no underside: nobody sees them.) */
export function slab(b, x0, y0, z0, x1, y1, z1, rgb) {
  b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], rgb, WUV);
  b.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], rgb, WUV);
  b.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], rgb, WUV, 0.88);
  b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], rgb, WUV, 0.88);
}

/** What a leaf is painted with: plain on the left half, its sign on the right. One to a floor's kit, whoever asks. */
export function leafTexture(kit) {
  return kit.tex.custom('doorleaf', 128, 64, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1d4f9c'; g.fillRect(64, 0, 64, 64); g.fillStyle = '#f4f6f8'; g.fillRect(66, 2, 60, 60); g.fillStyle = '#1d4f9c'; g.fillRect(68, 4, 56, 56);
    drawText(g, ['FIRE DOOR', 'KEEP', 'SHUT'], 68, 6, 56, 52, { color: '#f4f6f8', size: 13, pad: 0 });
  }, { clamp: true });
}
/** Where the sign is on that texture. */
export const SIGN = [[0.52, 0.02], [0.98, 0.02], [0.98, 0.98], [0.52, 0.98]];

/**
 * Hang the floor's doors. Call once the world is built and somebody is standing in it.
 * → { list, at(linkId), shut(door, who), open(door, who), watched(door), update(dt), version }
 */
export function hangDoors(env) {
  const world = env.world, level = env.level, kit = env.kit;
  const list = [], byLink = new Map();
  const api = { list, version: 0, at: (id) => byLink.get(id) || null };
  const tex = leafTexture(kit);
  const steel = [0.52, 0.53, 0.52], dark = [0.1, 0.1, 0.1];
  const frames = new Map();                                  // room → the batch its door frames are drawn in

  for (const plan of doorPlan(level)) {
    const rt = world.rooms[plan.room], def = rt.def, dr = def.doors.find((d) => d.link === plan.link), throat = world.throats.find((t) => t.link.id === plan.link);
    if (!dr || !throat || !throat.open) continue;
    const wl = WALLS[dr.side], n = wl.n, U = wl.U, o = wl.o(def.W, def.D), s = wl.s(dr.c, def.W, def.D);
    const C = [o[0] + U[0] * s, o[2] + U[2] * s], half = plan.w / 2, L = half - 0.012, h = plan.h - 0.015;
    const at = (across, out) => [C[0] + U[0] * across + n[0] * out, C[1] + U[2] * across + n[2] * out];
    // each leaf, open, needs its strip of floor
    let room = true;
    for (const side of [-1, 1]) for (let k = 0.15; k <= L + 0.1 && room; k += 0.15) { const p = at(side * (half + DOORS.thick / 2), k), wp = toWorld(def, p[0], p[1]); if (!world.free(wp.x, wp.z, 0.08, { ghost: true })) room = false; }
    if (!room) continue;
    const rgb = lin(TINTS[plan.tint % TINTS.length]), leaves = [], cols = [];
    for (const side of [-1, 1]) {
      const b = new Batch(), a0 = side * half, a1 = side * (half + DOORS.thick);
      const box = (aa, ab, oa, ob, y0, y1, col) => { const p = at(aa, oa), q = at(ab, ob); slab(b, Math.min(p[0], q[0]), y0, Math.min(p[1], q[1]), Math.max(p[0], q[0]), y1, Math.max(p[1], q[1]), col); };
      box(a0, a1, 0, L, 0.012, h, rgb);
      // on each face: a steel kick plate; on the face you push, a plate, and on the other a bar to pull
      for (const [f, face] of [[a0 - side * 0.004, -side], [a1 + side * 0.004, side]]) {
        box(f, f - face * 0.004, 0.02, L - 0.02, 0.02, 0.26, steel);
        if (face === side) box(f, f - face * 0.004, L - 0.2, L - 0.08, 1.0, 1.32, steel);
        else { box(f, f + face * 0.045, L - 0.15, L - 0.12, 0.92, 1.3, steel); }
        // …and the sign, at eye level
        const p0 = at(f + face * 0.002, L / 2 + face * 0.16), p1 = at(f + face * 0.002, L / 2 - face * 0.16);
        b.quad([p0[0], 1.36, p0[1]], [p1[0], 1.36, p1[1]], [p1[0], 1.68, p1[1]], [p0[0], 1.68, p0[1]], [1, 1, 1], SIGN);
      }
      const pv = at(a0, 0), holder = new THREE.Group();
      holder.position.set(pv[0], 0, pv[1]); rt.group.add(holder);
      const geo = kit.geometry(b, rt.lights, rt.amb), mesh = new THREE.Mesh(geo, kit.surface({ map: tex, room: rt.u, flick: geo.userData.flick, side: THREE.DoubleSide }));
      mesh.position.set(-pv[0], 0, -pv[1]); holder.add(mesh);
      leaves.push({ holder, turn: -side * Math.PI / 2 });
      // open, a leaf is in the way and blocks the view
      const p = at(a0, 0.02), q = at(a1, L), wa = toWorld(def, p[0], p[1]), wb = toWorld(def, q[0], q[1]);
      const col = { x0: Math.min(wa.x, wb.x), z0: Math.min(wa.z, wb.z), x1: Math.max(wa.x, wb.x), z1: Math.max(wa.z, wb.z), tall: true, keep: false, on: true, leaf: true };
      rt.colliders.push(col); cols.push(col);
    }
    // the frame it hangs in
    if (!frames.has(rt)) frames.set(rt, new Batch());
    const fb = frames.get(rt), trim = lin(def.look.trim).map((v) => v * 0.8);
    const fbox = (aa, ab, y0, y1) => { const p = at(aa, 0), q = at(ab, 0.028); fb.box(Math.min(p[0], q[0]), y0, Math.min(p[1], q[1]), Math.max(p[0], q[0]), y1, Math.max(p[1], q[1]), trim, { skip: '-y' }); };
    for (const side of [-1, 1]) fbox(side * (half + DOORS.thick + 0.005), side * (half + DOORS.thick + 0.07), 0, plan.h + 0.07);
    fbox(-half - DOORS.thick - 0.07, half + DOORS.thick + 0.07, plan.h, plan.h + 0.07);
    // …and the same frame round the far side of the opening, on the other room's wall
    {
      const ot = world.rooms[plan.other], od = ot.def, odr = od.doors.find((d) => d.link === plan.link), ow = WALLS[odr.side], oo = ow.o(od.W, od.D), os = ow.s(odr.c, od.W, od.D);
      if (!frames.has(ot)) frames.set(ot, new Batch());
      const ob = frames.get(ot), otrim = lin(od.look.trim).map((v) => v * 0.8), oat = (across, out) => [oo[0] + ow.U[0] * (os + across) + ow.n[0] * out, oo[2] + ow.U[2] * (os + across) + ow.n[2] * out];
      const obox = (aa, ab, y0, y1) => { const p = oat(aa, 0), q = oat(ab, 0.028); ob.box(Math.min(p[0], q[0]), y0, Math.min(p[1], q[1]), Math.max(p[0], q[0]), y1, Math.max(p[1], q[1]), otrim, { skip: '-y' }); };
      for (const side of [-1, 1]) obox(side * (half + 0.005), side * (half + 0.07), 0, plan.h + 0.07);
      obox(-half - 0.07, half + 0.07, plan.h, plan.h + 0.07);
    }

    const cw = toWorld(def, C[0], C[1]), nw = toWorld(def, C[0] + n[0], C[1] + n[2]), uw = toWorld(def, C[0] + U[0], C[1] + U[2]);
    const door = {
      id: plan.link, link: throat.link, throat, room: plan.room, other: plan.other, w: plan.w, h: plan.h,
      x: cw.x, z: cw.z, nx: nw.x - cw.x, nz: nw.z - cw.z, ux: uw.x - cw.x, uz: uw.z - cw.z,           // the middle of the opening on this room's wall face · into this room · along the wall
      isShut: false, k: 0, moving: 0, by: null, news: false, solid: true, leaves, cols, jolt: 0,
    };
    /** A point in the doorway's own frame: across the opening, out into the room the leaves are in. */
    door.where = (x, z) => ({ across: (x - door.x) * door.ux + (z - door.z) * door.uz, out: (x - door.x) * door.nx + (z - door.z) * door.nz });
    door.point = (across, out) => ({ x: door.x + door.ux * across + door.nx * out, z: door.z + door.uz * across + door.nz * out });
    list.push(door); byLink.set(door.id, door);
    // E, from either side: half a metre into each room, in front of the opening
    for (const [roomId, out] of [[plan.room, 0.55], [plan.other, -(T + 0.55)]]) {
      const p = door.point(0, out), sign = Math.sign(out);
      world.rooms[roomId].uses.push({ r: 1.3, wx: p.x, wz: p.z, room: world.rooms[roomId], label: 'the doors', door,
        when: () => !door.moving && Math.sign(door.where(env.player.me.x, env.player.me.z).out + T / 2) === sign,
        use: () => (door.isShut ? api.open(door, 'you') : api.shut(door, 'you')) });
    }
  }
  for (const [rt, fb] of frames) {
    const geo = kit.geometry(fb, rt.lights, rt.amb); if (!geo) continue;
    const mesh = new THREE.Mesh(geo, kit.surface({ map: kit.tex.white(), room: rt.u, flick: geo.userData.flick }));
    mesh.matrixAutoUpdate = false; rt.group.add(mesh);
  }
  // never a trap: a room whose open leaves would wall one of its doorways off has leaves you can walk through
  for (const rt of new Set(list.map((d) => world.rooms[d.room]))) {
    const def = rt.def; if (def.doors.length < 2) continue;
    const walk = world.walkable(rt), seen = walk.flood([def.doors[0]]);
    const p = (dr) => { const w = WALLS[dr.side], o = w.o(def.W, def.D), s = w.s(dr.c, def.W, def.D); return { x: o[0] + w.U[0] * s + w.n[0] * 0.5, z: o[2] + w.U[2] * s + w.n[2] * 0.5 }; };
    if (def.doors.every((dr) => seen[walk.key(p(dr))])) continue;
    for (const d of list) if (d.room === rt.id) { d.solid = false; for (const c of d.cols) c.on = false; }
  }

  const sound = (name, door, vol = 1) => { const at = env.hear(door.x, door.z, 7); if (at.vol > 0.02) env.sound.play(name, { vol: at.vol * vol, pan: at.pan }); };
  /** Is anybody standing where the leaves have to go? */
  api.blocked = (door) => {
    const hit = (x, z, r) => { const p = door.where(x, z); return inTheWay(door.w, T, p.across, p.out, r); };
    const me = env.player?.me;
    return (me && hit(me.x, me.z, 0.22)) || world.bodies.some((b) => hit(b.x, b.z, b.r));
  };
  /** Shut a pair of doors. → whether they shut (something in the doorway stops them, and you hear it). */
  api.shut = (door, who = 'you') => {
    if (door.isShut || door.moving) return false;
    if (api.blocked(door)) { door.jolt = 0.3; sound('thunk', door, 0.7); return false; }
    door.isShut = true; door.moving = 1; door.by = who; door.news = who === 'you';
    door.throat.open = false; for (const c of door.cols) c.on = false;
    api.version++;
    sound('slide', door, 0.6);
    return true;
  };
  /** Open them. Nothing can stop this: a door is never a way of being shut in. */
  api.open = (door, who = 'you') => {
    if (!door.isShut || door.moving) return false;
    door.isShut = false; door.moving = -1; door.by = who; door.news = false;
    door.throat.open = true;
    api.version++;
    sound('door', door);
    return true;
  };
  /** Is somebody looking at these doors, from either side? */
  api.watched = (door) => {
    for (const out of [0.4, -(T + 0.4)]) { const p = door.point(0, out); if (env.sees(p.x, p.z, { radius: door.w / 2, margin: 0.05, far: 30 })) return true; }
    return false;
  };
  api.update = (dt) => {
    for (const door of list) {
      if (!door.moving && door.jolt <= 0) continue;
      if (door.moving) {
        door.k = Math.max(0, Math.min(1, door.k + (door.moving * dt) / DOORS.swing));
        if (door.k === 1 && door.moving > 0) { door.moving = 0; sound('thunk', door, 0.5); sound('click', door); }
        if (door.k === 0 && door.moving < 0) { door.moving = 0; if (door.solid) for (const c of door.cols) c.on = true; api.version++; }
      }
      door.jolt = Math.max(0, door.jolt - dt);
      const shake = door.jolt > 0 ? Math.sin(door.jolt * 40) * 0.09 * (door.jolt / 0.3) + 0.1 * (door.jolt / 0.3) : 0;
      for (const leaf of door.leaves) leaf.holder.rotation.y = leaf.turn * Math.min(1, smooth(door.k) + shake);
    }
  };
  return api;
}
