// The Backrooms — filing cabinets, and what a room can do with them (docs/BACKROOMS.md, the toolbox; the preview:
// docs/BLOCKROOMS-PREVIEWS.md "Filing cabinets"). The owner: "put them in crazy big piles, sink into floors, go into
// walls … and some drawers sliding open to reveal items."
//
// The models are cabinets.model.js (two, three, four, tall, lateral). Down here:
//   put(c, kind, x, z, o)        one cabinet, any way up (rot, y, tilt, flip as c.place), its drawers working where it
//                                stands upright on the floor (o.open)
//   againstWall(c, kind, side, at, o)   backed onto a wall, as the office keeps them
//   pile(c, x, z, rot, o)        a heap of seven to nine: upright, stacked, one on its back, one leaning, one on its side
//   sunkRow(c, x, z, rot, o)     a row of four-drawer cabinets gone down into the carpet to the second drawer
//   flush(c, side, at, o)        a cabinet let into a wall, only its drawers in the room · wallOfDrawers(c, side, from, to)
//   ceiling(c, x, z, o)          one coming down through the ceiling, upside down
//   alone(c, o)                  one standing in the middle of an empty room, facing the way in
//   deal(c, what, seed)          any of those, wherever this room has the floor or the wall for it → its record, or null
// Everything is put into the room's own batches (c.place, or clip() where the structure cuts it), so it is baked with
// the room and costs nothing a frame. Only a drawer that opens is a mesh of its own: its front, and the tray behind it,
// which is drawn only while it is out. A room has at most DRAWERS.open of them.
//
// Solid: each cabinet's collider is the box round what is drawn of it between knee and chest (as c.place has it), and
// nothing that would close a doorway's lane; a placement is only made where, once its colliders are in, every doorway
// that could be walked to before still can be, by the visitor and by something the size of the cast (r = 0.35).
//
// The drawers. E at a cabinet opens the drawer looked at (or the nearest shut one): it slides out with a sound. A
// drawer dented in will not come out (it rattles); a locked cabinet's lock is pushed in and none of its drawers comes
// out. What is in one: most hold files or paper (to look at) or nothing; now and then something odd (to look at).
// What can be carried is only ever what this part of the building had lying about anyway (supplies.js: the same
// things, as many of them, as rare): a room with drawers that open may hide one of the things dealt to it in one of
// them instead of on its floor (rt.hide, which inventory.js asks), and it is put in the drawer, as an ordinary pickup, when
// the drawer is opened. So a drawer is a hiding place, like an oddity's stash, and never more than that.
//
// Seeded: what a cabinet is (paint, wear, locked, what is in each drawer) is from its own stream,
// `${seed}/cabinets/${room}/${n}`; where a placement goes from `${seed}/cabinets/${room}/deal/${n}`. Nothing here reads the
// room's own stream, nor anything unseeded.
import { Batch } from './kit.js';
import { makeRng, wallPoint, stairZones, fitsAt } from './gen.js';
import { clip, doorLanes, placeMatrix, roomBox, previewing } from './clipping.js';
import { CABINETS, dims, carcase, drawerFront, drawerBody, whole, dented, ODD } from './cabinets.model.js';

export const DRAWERS = Object.freeze({
  slide: 0.36,       // metres a drawer comes out (one let into a wall: `flushSlide`)
  flushSlide: 0.3,
  time: 0.5,         // seconds it takes
  locked: 0.12,      // the chance a cabinet is locked
  odd: 1 / 30,       // the chance a drawer holds something odd
  files: 0.45,       // …else files, else paper, else nothing
  paper: 0.2,
  open: 12,          // the most drawers that open in one room (each a mesh of its own while shut, two while open)
  holds: 0.45,       // the highest a drawer's floor may be and still be given something to hold: low enough to see into from a visitor's eye
  hide: 0.5,         // the chance a thing dealt to a room with drawers goes into one rather than onto its floor
  creature: 0.35,    // the body that must still get through, besides the visitor's
  wall: 0.34,        // how far from a wall a drawer's tray must be to be given something (the widest pickup's radius, and a little)
});
const VS = CABINETS.voxel, SC = CABINETS.scale, PITCH_TOP = CABINETS.pitch - 8;      // (how high in a drawer the tops of its hanging files are, in voxels)
const meets = (a, b, pad = 0) => a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.z0 < b.z1 + pad && b.z0 < a.z1 + pad;
const hashOf = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** The room's record of its cabinets (for the tests and the dev page): rt.cabinets, rt.drawers. */
function ledger(c) {
  const rt = c.rt;
  if (!rt.cabinets) {
    rt.cabinets = []; rt.drawers = [];
    rt.hide = (item) => hide(rt, item);            // (what inventory.js asks a room as it lays out the part's supplies)
    rt.cabinetBudget = DRAWERS.open;
    const moving = [];
    rt.cabinetMoving = moving;
    c.tick((dt) => {
      for (let i = moving.length - 1; i >= 0; i--) {
        const d = moving[i];
        d.t = Math.min(1, d.t + dt / DRAWERS.time);
        const k = 1 - (1 - d.t) * (1 - d.t), s = k * d.slide;
        for (const g of [d.front, d.body]) g.position.set(d.pivot[0] + d.n[0] * s, d.pivot[1], d.pivot[2] + d.n[2] * s);
        d.body.visible = d.lenM - s <= d.hidden;
        if (d.t >= 1) { moving.splice(i, 1); d.state = 'open'; d.opened?.(); }
      }
    });
  }
  return rt;
}

/** What a cabinet is: rolled from its own stream, the same number of rolls whatever is asked of it. */
function rollCabinet(c, kind, n) {
  const R = makeRng(`${c.level.seed}/cabinets/${c.room.id}/${n}`), d = dims(kind);
  const paint = R.int(0, CABINETS.paints.length - 1), wear = R.int(0, CABINETS.wears - 1), locked = R.chance(DRAWERS.locked);
  const fills = [];
  for (let i = 0; i < 5; i++) {
    const odd = R.chance(DRAWERS.odd), which = R.int(0, ODD.length - 1), roll = R();
    if (i >= d.n) continue;
    fills.push(odd ? ODD[which] : roll < DRAWERS.files ? 'files' : roll < DRAWERS.files + DRAWERS.paper ? 'paper' : 'empty');
  }
  return { paint, wear, locked, fills, dents: dented(kind, wear) };
}

/** The box round the 8 corners of a model's bounds put down with these options (as c.place works out a foot). */
function footOf(geo, x, z, opt) {
  const m = placeMatrix(x, z, opt), b = geo.bounds, out = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  const e = m.elements;
  for (const bx of [b.x0, b.x1]) for (const by of [b.y0, b.y1]) for (const bz of [b.z0, b.z1]) {
    const px = e[0] * bx + e[4] * by + e[8] * bz + e[12], py = e[1] * bx + e[5] * by + e[9] * bz + e[13], pz = e[2] * bx + e[6] * by + e[10] * bz + e[14];
    out.x0 = Math.min(out.x0, px); out.x1 = Math.max(out.x1, px); out.y0 = Math.min(out.y0, py); out.y1 = Math.max(out.y1, py); out.z0 = Math.min(out.z0, pz); out.z1 = Math.max(out.z1, pz);
  }
  return out;
}

/**
 * One cabinet. o: rot, y, tilt, flip (as c.place) · open (its drawers work: only upright and on the floor) · clip (cut by
 * the structure: clipping.js) · cut (planes for clip) · len, slide, hidden (a drawer's tray, how far it comes out, how
 * far behind the front its tray may be seen: for one let into a wall) · solid (default true) · shadow · n (which of
 * the room's cabinets this is: its stream; default the next).
 * → its record { kind, x, z, foot (what is drawn, the room's frame), solid (its collider or null), drawers }
 */
export function put(c, kind, x, z, o = {}) {
  const rt = ledger(c), d = dims(kind), n = o.n ?? rt.cabinets.length, me = rollCabinet(c, kind, n), kit = c.kit;
  const upright = !o.tilt && !o.flip, rot = o.rot || 0, y = o.clip ? Math.round((o.y || 0) / 0.0125) * 0.0125 : o.y || 0;   // (clip puts it on the half-voxel grid)
  // which drawers slide: upright, a working cabinet, not dented in, wholly above the floor, while the room has meshes for them
  const slides = [];
  if (o.open && upright && !me.locked) for (let i = 0; i < d.n; i++) {
    const b = d.bays[i];
    if (!me.dents[i] && y + b.y0 * VS > 0.004 && y + (b.y1 + 1) * VS < c.H - 0.05 && (o.only ? o.only(i) : true)) slides.push(i);
  }
  // (past the room's budget it is only furniture: none of it answers, rather than all of it seeming stuck)
  const spent = slides.length > rt.cabinetBudget;
  if (spent) slides.length = 0;
  const usable = !!o.open && upright && !spent && (slides.length > 0 || me.locked || me.dents.some(Boolean)) && y + d.bays[d.n - 1].y1 * VS > 0.05;
  rt.cabinetBudget -= slides.length;
  const mask = slides.reduce((m, i) => m | (1 << i), 0), look = { paint: me.paint, wear: me.wear, locked: me.locked };
  const key = `cabinet:${kind}:${me.paint}:${me.wear}:${me.locked ? 1 : 0}:${mask}`;
  const geo = kit.model(key, () => {
    if (!mask) return whole(kind, look);
    const v = carcase(kind, { ...look, bays: mask });
    for (let i = 0; i < d.n; i++) if (!slides.includes(i)) v.stamp(drawerFront(kind, i, look));
    return v;
  }, { ao: false });
  const at = { rot, y, tilt: o.tilt, flip: o.flip, scale: SC };
  let foot, solid = null;
  if (o.clip) {
    const k = clip(c, geo, x, z, { ...at, cut: o.cut, solid: o.solid, shadow: o.shadow ?? 0.45 });
    if (!k) return null;
    foot = k.foot; solid = k.solid; x = k.x; z = k.z;
  } else {
    c.place(geo, x, z, { ...at, solid: false, shadow: false });
    foot = roomBox(geo.solid, placeMatrix(x, z, at));
    if (o.solid !== false && foot.y0 < 1.0 && foot.y1 > 0.25) solid = c.solid(foot.x0 + 0.01, foot.z0 + 0.01, foot.x1 - 0.01, foot.z1 - 0.01, { tall: foot.y1 > 1.25, top: foot.y1 });
    if (o.shadow !== false && foot.y0 < 0.3) c.shadow((foot.x0 + foot.x1) / 2, (foot.z0 + foot.z1) / 2, foot.x1 - foot.x0, foot.z1 - foot.z0, o.shadow || 0.45);
  }
  const nrm = [Math.sin(rot), 0, Math.cos(rot)], m = placeMatrix(x, z, at), face = d.front * VS;
  const rec = { kind, x, z, rot, y, foot, solid, n, locked: me.locked, how: o.how || 'stand', drawers: [] };
  for (let i = 0; i < d.n; i++) {
    const b = d.bays[i], y0 = y + b.y0 * VS, y1 = y + (b.y1 + 1) * VS;
    const dr = { cabinet: rec, i, y0, y1, fill: me.fills[i], state: slides.includes(i) ? 'shut' : me.locked ? 'locked' : me.dents[i] ? 'stuck' : 'fixed', held: null };
    rec.drawers.push(dr);
    if (dr.state !== 'shut') continue;
    const len = o.len || d.D - 8, slide = o.slide ?? DRAWERS.slide, front = new Batch(true), body = new Batch(true);
    front.addVox(kit.model(`cabinet:front:${kind}:${i}:${me.paint}:${me.wear}:${me.locked ? 1 : 0}`, () => drawerFront(kind, i, look), { ao: false }).solid, m);
    body.addVox(kit.model(`cabinet:body:${kind}:${i}:${me.wear}:${len}:${dr.fill}`, () => drawerBody(kind, i, { wear: me.wear, len, fill: dr.fill }), { ao: false }).solid, m);
    const pivot = [x + nrm[0] * face, (y0 + y1) / 2, z + nrm[2] * face];
    Object.assign(dr, { n: nrm, pivot, slide, lenM: len * VS, hidden: o.hidden ?? Infinity, t: 0,
      front: c.dynamic(front, { pivot }), body: c.dynamic(body, { pivot }),
      // where a thing given to it is put once it is out: in the front of the tray, on its floor (the room's frame)
      at: { x: x + nrm[0] * (face + slide - (len * VS) / 2), z: z + nrm[2] * (face + slide - (len * VS) / 2), y: y + (b.y0 + 2 + (dr.fill === 'files' || dr.fill === 'carpet' ? PITCH_TOP : dr.fill === 'paper' ? 9 : 0)) * VS },   // (on the floor of the tray, or on top of what fills it)
      holds: y + (b.y0 + 2) * VS <= DRAWERS.holds });
    // (and far enough from the room's walls for a pickup to lie there: inventory-world.js keeps one its radius off them)
    if (Math.min(c.W / 2 - Math.abs(dr.at.x), c.D / 2 - Math.abs(dr.at.z)) < DRAWERS.wall) dr.holds = false;
    dr.body.visible = false;
    rt.drawers.push(dr);
  }
  if (usable) {
    const at2 = { x: x + nrm[0] * (face + 0.2), z: z + nrm[2] * (face + 0.2) }, here = c.toWorld(at2.x, at2.z);
    c.use({ x: at2.x, z: at2.z, r: 1.45, cone: 0.5, label: 'filing cabinet',
      when: () => rec.drawers.some((q) => q.state !== 'open' && q.state !== 'moving'),
      use: () => work(c, rec, here) });
  }
  rt.cabinets.push(rec);
  return rec;
}

/** E at a cabinet: the drawer looked at, or the nearest shut one to it. */
function work(c, rec, here) {
  const me = c.env.player?.me, waiting = rec.drawers.filter((q) => q.state !== 'open' && q.state !== 'moving');
  if (!waiting.length) return;
  let aim = (rec.drawers[0].y0 + rec.drawers[rec.drawers.length - 1].y1) / 2;
  if (me) {
    const p = c.toLocal(me.x, me.z), dist = Math.max(0.2, (p.x - rec.x) * Math.sin(rec.rot) + (p.z - rec.z) * Math.cos(rec.rot) - dims(rec.kind).front * VS - 0.03);   // (to its front)
    aim = (Number.isFinite(me.y) ? me.y - (c.room.y || 0) : 1.1) + Math.tan(me.pitch || 0) * dist;     // (me.y: the eye, in the world)
  }
  const d = waiting.reduce((best, q) => (Math.abs((q.y0 + q.y1) / 2 - aim) < Math.abs((best.y0 + best.y1) / 2 - aim) ? q : best));
  if (d.state === 'shut') {
    d.state = 'moving'; d.t = 0; d.body.visible = d.lenM <= d.hidden;
    c.rt.cabinetMoving.push(d);
    c.env.play('slide', here.x, here.z, 6);
    d.opened = () => { c.env.play('thunk', here.x, here.z, 4); if (d.held) give(c, d); };
  } else if (d.state === 'locked') { c.env.play('click', here.x, here.z, 4); c.env.play('rattle', here.x, here.z, 5); }
  else c.env.play('rattle', here.x, here.z, 5);
}

/** The thing a drawer was given, put into it now it is out (an ordinary pickup: inventory-world.js spawn). */
function give(c, d) {
  const physical = c.env.inventory?.physical, item = d.held;
  if (!physical || !item) return;
  d.held = null;
  for (const k of [0, 0.06, 0.12]) {
    const x = d.at.x + d.n[0] * k, z = d.at.z + d.n[2] * k;
    if (physical.spawn(item, { room: c.rt.id, x, z, y: d.at.y, ignore: new Set(c.rt.cabinets.map((k) => k.solid).filter(Boolean)) }).ok) { d.gave = item.id; return; }
  }
  for (let ring = 0; ring < 8; ring++) for (let a = 0; a < 8; a++) {            // (it fell out: the floor in front)
    const r = 0.5 + ring * 0.15, ang = a * 0.785 + ring * 0.3, x = d.at.x + d.n[0] * r + Math.cos(ang) * ring * 0.1, z = d.at.z + d.n[2] * r + Math.sin(ang) * ring * 0.1;
    if (physical.spawn(item, { room: c.rt.id, x, z }).ok) { d.gave = item.id; return; }
  }
}

/**
 * (inventory.js, as it lays out a part's supplies: rt.hide) Put a thing dealt to this room into one of its drawers instead of on its
 * floor: about half the time (DRAWERS.hide, by the thing's own id), into the drawer its id picks of those that open,
 * are low enough, and hold nothing yet. → true if it went into one.
 */
export function hide(rt, item) {
  const free = (rt?.drawers || []).filter((d) => d.holds && !d.held && d.state === 'shut' && d.front?.parent);   // (still in the room: not one a failed build threw away)
  if (!free.length || !item?.id) return false;
  const h = hashOf(item.id);
  if ((h % 1000) / 1000 >= DRAWERS.hide) return false;
  free[(h >>> 10) % free.length].held = item;
  return true;
}

/** Backed onto a wall, facing into the room (the office's way). */
export function againstWall(c, kind, side, at, o = {}) {
  const d = dims(kind), p = c.wallAt(side, at, (d.D / 2) * VS + 0.015);
  return put(c, kind, p.x, p.z, { open: true, ...o, rot: p.rot + (o.rot || 0) });
}

/* ---- where a placement may go --------------------------------------------------- */

/** A rectangle (the room's frame) on level, open floor: inside the room, off the stairs, out of every doorway's lane and approach, clear of what is already there. */
function floorFree(c, r, head = 0) {
  const { W, D } = c, rt = c.rt;
  if (r.x0 < -W / 2 || r.x1 > W / 2 || r.z0 < -D / 2 || r.z1 > D / 2) return false;
  if (doorLanes(c.room).some((l) => meets(r, l, 0.05))) return false;
  const mine = rt.colliders.map((q) => { const a = c.toLocal(q.x0, q.z0), b = c.toLocal(q.x1, q.z1); return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }; });
  if (mine.some((q) => meets(r, q, 0.05))) return false;
  // level floor under all of it (no stairs, no pit, no filled-in corner), the ceiling high enough, and not over a doorway's sill
  const stairs = stairZones(c.room, 0.3);
  if (stairs.some((q) => meets(r, q))) return false;
  if (c.room.doors.some((dr) => { const p = wallPoint(c.room, dr.side, dr.c, 0.3); return p.x > r.x0 - dr.w / 2 - 0.35 && p.x < r.x1 + dr.w / 2 + 0.35 && p.z > r.z0 - dr.w / 2 - 0.35 && p.z < r.z1 + dr.w / 2 + 0.35; })) return false;
  const nx = Math.max(1, Math.ceil((r.x1 - r.x0) / 0.2)), nz = Math.max(1, Math.ceil((r.z1 - r.z0) / 0.2));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const x = Math.min(Math.max(r.x0 + ((r.x1 - r.x0) * i) / nx, -W / 2 + 0.03), W / 2 - 0.03), z = Math.min(Math.max(r.z0 + ((r.z1 - r.z0) * j) / nz, -D / 2 + 0.03), D / 2 - 0.03);
    if (Math.abs(c.floorAt(x, z)) > 0.01 || !fitsAt(c.room, x, z, 0.02) || (head && c.ceilAt(x, z) < head)) return false;
  }
  return true;
}

/** Which doorways can be reached from the first, by the visitor (the level's own walk) and by something of r = 0.35. */
export function reach(c) {
  const rt = c.rt, def = c.room, r = DRAWERS.creature;
  if (!def.doors.length) return [];
  const walk = c.world.walkable(rt);
  const rects = rt.colliders.filter((q) => q.on !== false && !q.floor).map((q) => { const a = c.toLocal(q.x0, q.z0), b = c.toLocal(q.x1, q.z1); return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }; });
  const big = (x, z) => Math.abs(x) <= def.W / 2 - r && Math.abs(z) <= def.D / 2 - r && walk.free(x, z)
    && !rects.some((q) => { const dx = x - Math.min(Math.max(x, q.x0), q.x1), dz = z - Math.min(Math.max(z, q.z0), q.z1); return dx * dx + dz * dz < r * r; });
  const seen = walk.flood(def.doors.slice(0, 1)), wide = new Uint8Array(seen.length), queue = [];
  const k0 = walk.key(wallPoint(def, def.doors[0]?.side, def.doors[0]?.c, 0.5));
  if (def.doors.length && seen[k0]) { wide[k0] = 1; queue.push(k0); }
  while (queue.length) {
    const k = queue.pop(), i = k % walk.nx, j = (k - i) / walk.nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj, kk = ii + walk.nx * jj;
      if (ii < 0 || jj < 0 || ii >= walk.nx || jj >= walk.nz || wide[kk] || !seen[kk]) continue;
      const p = walk.at(kk); if (!big(p.x, p.z)) continue;
      wide[kk] = 1; queue.push(kk);
    }
  }
  return def.doors.map((dr) => { const k = walk.key(wallPoint(def, dr.side, dr.c, 0.5)); return [!!seen[k], !!wide[k]]; });
}

/** Would these colliders (rectangles in the room's frame) leave every doorway as reachable as it was? Tried, then taken back out. */
function passes(c, rects) {
  const rt = c.rt, before = JSON.stringify(reach(c)), added = rects.map((r) => c.solid(r.x0, r.z0, r.x1, r.z1));
  const after = JSON.stringify(reach(c));
  rt.colliders.splice(rt.colliders.length - added.length, added.length);
  return before === after;
}

/* ---- the placements --------------------------------------------------------------- */

// the pile, in its own frame: u along the wall it is backed onto, v out from it; each piece's foot box is set at
// (u, v) and stood on `on` (another piece's top); kinds swap for what fits under the ceiling
const PILE = [
  { id: 'end', kind: 'four', u: -1.05, v: 0.33, open: true },
  { id: 'a', kind: 'four', u: -0.53, v: 0.33, open: true },
  { id: 'b', kind: 'three', u: 0.0, v: 0.33, rot: 0.04, open: true },
  { id: 'on-b', kind: 'two', u: 0.02, v: 0.34, rot: Math.PI + 0.08, on: 'b' },
  { id: 'on-a', kind: 'two', u: -0.62, v: 0.34, rot: 0.07, tilt: [0, Math.PI / 2], on: 'a' },
  { id: 'lean', kind: 'three', u: 0.62, v: 0.35, tilt: [0, 0.2] },
  { id: 'back', kind: 'lateral', u: 0.86, v: 1.33, rot: 0.05, tilt: [-Math.PI / 2, 0] },
  { id: 'face', kind: 'two', u: 0.8, v: 1.25, rot: 0.55, tilt: [Math.PI / 2, 0], on: 'back' },
  { id: 'side', kind: 'three', u: -0.7, v: 1.05, rot: -0.12, tilt: [0, -Math.PI / 2] },
];

/** A heap of cabinets backed onto a wall at (x, z), its back to the wall `rot` faces away from. → the pieces put down. */
export function pile(c, x, z, rot, o = {}) {
  const mirror = o.mirror ? -1 : 1, out = [], tops = {};
  const pieces = PILE.filter((p) => !(o.small && ['end', 'side', 'on-a'].includes(p.id)));
  const cs = Math.cos(rot), sn = Math.sin(rot), at = (u, v) => ({ x: x + cs * u * mirror + sn * v, z: z - sn * u * mirror + cs * v });
  for (const p of pieces) {
    let kind = p.kind;
    const base = p.on ? tops[p.on] : 0;
    if (base === undefined) continue;
    const opt = { rot: rot + (p.rot || 0) * mirror, tilt: p.tilt ? [p.tilt[0], p.tilt[1] * mirror] : undefined, scale: SC };
    const geo0 = c.kit.model(`cabinet:probe:${kind}`, () => whole(kind, {}), { ao: false });
    let f = footOf(geo0, 0, 0, opt);
    if (base + (f.y1 - f.y0) > c.H - 0.06) { if (kind === 'four') kind = 'three'; else continue; f = footOf(c.kit.model(`cabinet:probe:${kind}`, () => whole(kind, {}), { ao: false }), 0, 0, opt); if (base + (f.y1 - f.y0) > c.H - 0.06) continue; }
    const q = at(p.u, p.v), px = q.x - (f.x0 + f.x1) / 2, pz = q.z - (f.z0 + f.z1) / 2;
    const rec = put(c, kind, px, pz, { ...opt, y: base - f.y0, clip: true, open: !!p.open && !p.tilt, how: 'pile', only: (i) => i < 3 });   // (clip: nothing of it in a wall or the ceiling)
    if (rec) { tops[p.id] = rec.foot.y1; out.push(rec); }
  }
  // paper that came out of them, round the foot of the heap (detail: a low Graphics setting leaves it out)
  const R = makeRng(`${c.level.seed}/cabinets/${c.room.id}/litter/${out.length}`), sheet = c.mapped('cabinet-paper', c.kit.tex.paper(), { detail: true });
  for (let k = 0; k < 14; k++) {
    const q = at(R.range(-1.4, 1.4), R.range(0.6, 2.2)), w = R.range(0.18, 0.24);
    if (Math.abs(q.x) < c.W / 2 - 0.15 && Math.abs(q.z) < c.D / 2 - 0.15) c.lay(sheet, q.x, q.z, w, w * 1.414, R.range(-3, 3), null, undefined, 0.006 + k * 0.0006);
  }
  return out;
}

/** The pile's colliders before it is put down (to see whether it may go there): its pieces' foot boxes at a body's height. */
function pileRects(c, x, z, rot, o = {}) {
  const mirror = o.mirror ? -1 : 1, cs = Math.cos(rot), sn = Math.sin(rot), out = [];
  for (const p of PILE) {
    if (p.on || (o.small && ['end', 'side'].includes(p.id))) continue;
    const opt = { rot: rot + (p.rot || 0) * mirror, tilt: p.tilt ? [p.tilt[0], p.tilt[1] * mirror] : undefined, scale: SC };
    const f = footOf(c.kit.model(`cabinet:probe:${p.kind}`, () => whole(p.kind, {}), { ao: false }), 0, 0, opt), w = (f.x1 - f.x0) / 2, d = (f.z1 - f.z0) / 2;
    const qx = x + cs * p.u * mirror + sn * p.v, qz = z - sn * p.u * mirror + cs * p.v;
    out.push({ x0: qx - w, z0: qz - d, x1: qx + w, z1: qz + d });
  }
  return out;
}

/** Four-drawer cabinets side by side, `count` of them, gone into the carpet to the middle of the second drawer: the two above it open. */
export function sunkRow(c, x, z, rot, o = {}) {
  const d = dims('four'), count = o.count || 3, y = -(d.bays[1].y0 + 14) * VS, w = d.W * VS + 0.01, out = [];
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (let k = 0; k < count; k++) {
    const u = (k - (count - 1) / 2) * w;
    // (the ones at the ends have gone down crooked, and do not open; the rest went straight down and still do)
    const end = count > 2 && (k === 0 || k === count - 1), tilt = end ? (k === 0 ? [0.06, 0.05] : [-0.04, -0.07]) : undefined;
    const rec = put(c, 'four', x + cs * u * (end ? 1.03 : 1), z - sn * u * (end ? 1.03 : 1), { rot: rot + (k % 2 ? 0.015 : -0.01), tilt, y: y + (k === 1 ? -0.03 : 0), clip: true, open: true, how: 'sunk' });
    if (rec) out.push(rec);
  }
  return out;
}

/** A cabinet let into a wall at `at`: its back in the wall (cut away a centimetre behind it), its drawers 4 cm into the room. */
export function flush(c, side, at, o = {}) {
  const kind = o.kind || 'four', d = dims(kind), p = c.wallAt(side, at, -(d.D / 2) * VS + 0.04);
  return put(c, kind, p.x, p.z, { clip: true, open: o.open !== false, slide: DRAWERS.flushSlide, len: 24, hidden: 0.16, how: 'flush', ...o, rot: p.rot, y: o.y || 0 });
}

/** Cabinets let into a stretch of wall from `from` to `to`, side by side, and stacked to the ceiling (cut by it). */
export function wallOfDrawers(c, side, from, to, o = {}) {
  const w = dims('four').W * VS + 0.004, n = Math.max(1, Math.floor((to - from) / w)), start = (from + to) / 2 - ((n - 1) * w) / 2, out = [];
  for (let k = 0; k < n; k++) {
    const at = start + k * w, low = k % 3 === 1 ? 'three' : 'four', lowH = dims(low).h * VS;
    out.push(flush(c, side, at, { kind: low, how: 'wall' }));
    let y = lowH;
    for (const up of ['two', 'three']) { if (y > c.H - 0.15) break; out.push(flush(c, side, at, { kind: up, y, open: false, how: 'wall' })); y += dims(up).h * VS; }
  }
  return out.filter(Boolean);
}

/** One coming down through the ceiling at (x, z), upside down, its drawers to `rot`: `show` metres of it in the room. */
export function ceiling(c, x, z, o = {}) {
  const kind = o.kind || 'three', d = dims(kind), show = o.show ?? 0.75, top = c.ceilAt(x, z);
  return put(c, kind, x, z, { rot: o.rot || 0, flip: true, y: top + d.h * VS - show, clip: true, how: 'ceiling' });
}

/** One standing in the middle of the room, facing the first doorway. */
export function alone(c, o = {}) {
  const dr = c.room.doors[0], p = dr ? wallPoint(c.room, dr.side, dr.c, 0) : { x: 0, z: c.D / 2 }, x = o.x ?? 0, z = o.z ?? 0;
  return put(c, o.kind || 'three', x, z, { rot: Math.atan2(p.x - x, p.z - z), open: true, how: 'alone' });
}

/* ---- dealt: a placement wherever this room has room for it ------------------------ */

export const PLACEMENTS = Object.freeze(['pile', 'sunk', 'wall', 'flush', 'ceiling', 'alone', 'against']);

/** Is the room empty enough for a cabinet alone in the middle of it: nothing solid, nothing in it but its shell. */
const empty = (c) => !c.rt.colliders.length && !(c.room.pillars || []).length;

/**
 * Put one of PLACEMENTS down where this room has the floor or wall for it, seeded by `seed` (and never the room's own
 * stream). → the records put down, or null where it does not fit (and then nothing was put down).
 */
export function deal(c, what, seed = 0) {
  const R = makeRng(`${c.level.seed}/cabinets/${c.room.id}/deal/${what}/${seed}`), { W, D, H } = c, VSD = 0.0125;
  const wallsBy = () => R.shuffle(['back', 'left', 'right', 'front']);
  const along = (need, minTop = 2.2) => {
    const out = [];
    for (const side of wallsBy()) for (const [a, b] of c.spans(side, 0.35, minTop)) if (b - a >= need) for (let at = a + need / 2; at <= b - need / 2 + 1e-6; at += 0.25) out.push({ side, at, a, b });
    return R.shuffle(out);
  };
  if (what === 'pile') {
    if (H < 2.25) return null;
    // backed onto a wall; or, in a big room, standing out in it with its back to nothing
    const open = [];
    for (let x = -W / 2 + 1.5; x <= W / 2 - 1.5 + 1e-6; x += 0.5) for (let z = -D / 2 + 1.5; z <= D / 2 - 1.5 + 1e-6; z += 0.5) for (const rot of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) open.push({ x, z, rot });
    for (const small of [false, true]) for (const s of [...along(small ? 1.7 : 2.3), ...R.shuffle(open).slice(0, 40)]) {
      const p = s.side ? c.wallAt(s.side, s.at, 0.0) : s, mirror = R.chance(0.5), rects = pileRects(c, p.x, p.z, p.rot ?? s.rot, { mirror, small });
      if (!rects.every((r) => floorFree(c, r)) || !passes(c, rects)) continue;
      if (s.side) c.keepWall(s.side, s.at - 1.3, s.at + 1.3);
      return pile(c, p.x, p.z, p.rot ?? s.rot, { mirror, small });
    }
    return null;
  }
  if (what === 'sunk') {
    const d = dims('four'), depth = d.D * VSD + 0.06;
    for (const count of [4, 3, 2]) {
      const w = count * (d.W * VSD + 0.01);
      // across the room, a third of the way in from the back, facing the way in; or backed onto a wall
      const open = [];
      for (let x = -W / 2 + 1; x <= W / 2 - 1 + 1e-6; x += 0.5) for (let z = -D / 2 + 1; z <= D / 2 - 1 + 1e-6; z += 0.5) for (const rot of [0, Math.PI / 2]) open.push({ x, z, rot });
      const tries = [{ x: 0, z: -D / 6, rot: 0 }, { x: -W / 6, z: 0, rot: Math.PI / 2 }, ...R.shuffle(open).slice(0, 24), ...along(w + 0.2).slice(0, 12).map((s) => { const p = c.wallAt(s.side, s.at, depth / 2); return { x: p.x, z: p.z, rot: p.rot }; })];
      for (const t of tries) {
        const along2 = Math.abs(Math.sin(t.rot)) > 0.7, r = along2 ? { x0: t.x - depth / 2, x1: t.x + depth / 2, z0: t.z - w / 2, z1: t.z + w / 2 } : { x0: t.x - w / 2, x1: t.x + w / 2, z0: t.z - depth / 2, z1: t.z + depth / 2 };
        if (!floorFree(c, r) || !passes(c, [r])) continue;
        return sunkRow(c, t.x, t.z, t.rot, { count });
      }
    }
    return null;
  }
  if (what === 'wall' || what === 'flush') {
    const kind = R.pick(['four', 'three', 'lateral']), half = (dims(kind).W * VSD) / 2 + 0.01, need = what === 'wall' ? 1.6 : half * 2 + 0.1;
    for (const s of along(need, 1.7)) {
      const from = what === 'wall' ? s.a + 0.05 : s.at - half, to = what === 'wall' ? Math.min(s.b - 0.05, s.a + 0.05 + 3.1) : s.at + half;
      const p0 = c.wallAt(s.side, from, 0.3), p1 = c.wallAt(s.side, to, 0.3), r = { x0: Math.min(p0.x, p1.x) - 0.05, x1: Math.max(p0.x, p1.x) + 0.05, z0: Math.min(p0.z, p1.z) - 0.05, z1: Math.max(p0.z, p1.z) + 0.05 };
      if (!floorFree(c, r)) continue;
      c.keepWall(s.side, from, to);
      return what === 'wall' ? wallOfDrawers(c, s.side, from, to) : [flush(c, s.side, s.at, { kind })].filter(Boolean);
    }
    return null;
  }
  if (what === 'ceiling') {
    for (let k = 0; k < 30; k++) {
      const x = R.range(-W / 2 + 0.8, W / 2 - 0.8), z = R.range(-D / 2 + 0.8, D / 2 - 0.8), top = c.ceilAt(x, z);
      if (top < 2.2 || Math.abs(top - c.ceilAt(x + 0.4, z + 0.4)) > 0.01 || Math.abs(top - c.ceilAt(x - 0.4, z - 0.4)) > 0.01) continue;
      if ((c.room.panels || []).some((p) => Math.abs(p.x - x) < 0.75 && Math.abs(p.z - z) < 1.05)) continue;
      return [ceiling(c, x, z, { rot: R.range(-Math.PI, Math.PI), show: Math.min(0.85, top - 1.45) })].filter(Boolean);
    }
    return null;
  }
  if (what === 'alone') {
    if (!empty(c) || W < 3 || D < 3) return null;
    const r = { x0: -0.45, x1: 0.45, z0: -0.45, z1: 0.45 };
    if (!floorFree(c, r)) return null;
    return [alone(c, { kind: R.pick(['three', 'four', 'two', 'lateral']) })].filter(Boolean);
  }
  if (what === 'against') {
    const kind = R.pick(CABINETS.kinds), d = dims(kind), need = d.W * VSD + 0.2;
    for (const s of along(need, d.h * VSD + 0.1)) {
      const p = c.wallAt(s.side, s.at, (d.D / 2) * VSD + 0.015), hw = (d.W * VSD) / 2 + 0.02, a = c.wallAt(s.side, s.at - hw, 0.005), b = c.wallAt(s.side, s.at + hw, (d.D + 3) * VSD + 0.03);
      const r = { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
      if (!floorFree(c, r) || !passes(c, [r])) continue;
      c.reserve(p.x, p.z, 0.45);
      return [againstWall(c, kind, s.side, s.at)].filter(Boolean);
    }
    return null;
  }
  return null;
}

/**
 * (preview, &preview=cabinets: docs/BLOCKROOMS-PREVIEWS.md "Filing cabinets") In a plain room, after its dressing: the
 * part's plain rooms take the placements in turn (each the one the part has had least of that fits), pile, sunk row,
 * wall of drawers, one let into a wall, one through the ceiling, one alone. Without the flag: nothing, and nothing is read.
 */
const shown = new WeakMap();
export function previewCabinets(c) {
  if (!previewing(c, 'cabinets') || c.room.kind !== 'plain' || c.room.crawl) return null;
  // (each room tries first what the part has had least of so far, in this order: so the three to see come round soonest)
  const order = ['pile', 'sunk', 'wall', 'flush', 'ceiling', 'alone'], had = (shown.get(c.world) || shown.set(c.world, new Map()).get(c.world));
  const turn = [...order].sort((a, b) => (had.get(a) || 0) - (had.get(b) || 0) || order.indexOf(a) - order.indexOf(b));
  for (const what of turn) { const got = deal(c, what, 0); if (got) { had.set(what, (had.get(what) || 0) + 1); return got; } }
  return null;
}
