// The Backrooms — the fire exit. Every floor has one, in its furthest room,
// under the green sign: a steel door with a push bar, and behind it a concrete
// stairwell going down. The building is honest about this much: fire exits do
// lead to stairs, and stairs do lead down.
//
// On every floor of a visit but the last they run out: where the next flight
// should be there is the back of a suspended ceiling, lit from underneath, and
// it does not take your weight. You arrive on the floor below the way you
// arrived in the first place. On the last floor there is no next flight and
// no ceiling either: six stairs down, the building has been papered over.
// Somebody got this far, taped a door on the paper, kept a tally and stayed a
// while. They had the right wall (thin.js). They did not lean on it for long
// enough.
//
// Same contract as the builders in rooms.js: the toolbox `c`, the room's own
// frame, entered through the +z wall — where, this once, there is a real door.
import * as THREE from 'three';
import { Batch, lin, drawText, WHITE } from './kit.js';
import { RISE, RUN, T, makeRng } from './gen.js';
import { P, doorFrame, floorPlan, card, wetSign } from './bits.js';
import { leafModel, addLeaf, LEAF_THICK } from './doorleaf.js';
import { gives } from './thin.js';
import { GAP, flight, holeIn, ledgeAt, ductIn, pushes } from './seam.js';
import { camp, rationList, tallyMark, tapeMark } from './traces.js';

const UP = [0, 1, 0], SLOPE = RISE / RUN;
const ticksBetween = (a, b, step) => { const out = []; const n = Math.max(1, Math.round((b - a) / step)); for (let i = 0; i <= n; i++) out.push(((b - a) * i) / n); return out; };

/** Poured concrete, the marks of the boards it was poured against still in it. */
const concrete = (kit) => kit.tex.custom('concrete', 32, 32, (g, w, h) => {
  P(g, '#8f8c82', 0, 0, w, h);
  let s = 7; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 60; i++) P(g, r() > 0.5 ? '#93908650' : '#8a877d', (r() * w) | 0, (r() * h) | 0, 1 + ((r() * 4) | 0), 1);
  P(g, '#858279', 0, 0, w, 1); P(g, '#95928a', 0, 1, w, 1);                    // one board to a repeat
  P(g, '#7d7a72', 11, 16, 1, 1); P(g, '#7d7a72', 27, 16, 1, 1);               // where the ties went through
  for (let i = 0; i < 3; i++) P(g, '#898679', (r() * w) | 0, 2, 1, 5 + ((r() * 14) | 0));
});
/** A suspended ceiling from the side nobody was meant to see: the backs of the tiles, the bars they sit on. */
const tileBack = (kit) => kit.tex.custom('tileback', 24, 24, (g, w, h) => {
  P(g, '#b3aa94', 0, 0, w, h);
  let s = 31; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 70; i++) P(g, r() > 0.5 ? '#bdb49e' : '#a39a85', (r() * w) | 0, (r() * h) | 0, 2, 1);
  P(g, '#55524a', 0, 0, w, 2); P(g, '#55524a', 0, 0, 2, h); P(g, '#c9c5b8', 2, 2, w - 2, 1);
}, { clamp: false });

export function stairwell(c) {
  const { W, D, kit, room } = c;
  if (room.way === 'hole' || room.way === 'ledge' || room.way === 'chute') { corridor(c, room.way); return; }
  const down = room.way === 'stairs';
  // the front wall, where the landing ends, how many stairs, how far down, where they end, and where the well does (seam.js)
  const { zF, zL, n, yB, zB, back } = flight(D, down);
  const drop = down ? 2.8 : 0.45, reach = drop / SLOPE;                       // the soffit follows the flight down, and then stops
  const floorY = (z) => (z >= zL ? 0 : -Math.min(n, Math.floor((zL - z) / RUN + 1e-6) + 1) * RISE);
  const ceilY = (z) => 2.6 - SLOPE * Math.max(0, Math.min(reach, zL + 0.6 - z));
  const con = concrete(kit), grey = [0.8, 0.8, 0.78];
  const tube = lin('#eef6ff'), warm = lin('#ffd9a0');

  c.rt.floorY = (x, z) => floorY(z);
  c.rt.headY = (x, z) => ceilY(z) - floorY(z);
  c.rt.level = 0.2; c.rt.footstep = 'stone';
  // the wall the door is in comes from the shell (with the hole for the door); the rest of a stairwell is not a box
  c.shell({ walls: ['front'], floor: false, ceiling: false, panels: false, sockets: false, skirting: false, wallTex: con, floorTex: con, ceilTex: con });

  /* ---- the well itself -------------------------------------------------------------------- */
  const zs = ticksBetween(back, zF, RUN);
  if (!down) c.rt.clip = (x, z, r) => z >= back + r;
  const shadeAt = (z) => Math.max(0.16, Math.min(1, 1 - (zL - z) / (down ? 6.5 : 14)));       // it is darker the further down you look
  for (const sx of [-1, 1]) {
    const o = sx < 0 ? [-W / 2, 0, zF] : [W / 2, 0, back], U = sx < 0 ? [0, 0, -1] : [0, 0, 1];
    const zOf = (u) => (sx < 0 ? zF - u : back + u), lo = (z) => floorY(z) - 0.42, rows = [0, 0.06, 0.3, 0.6, 0.94, 1];
    c.wall.grid(o, U, UP, zs, rows, (u, v) => { const z = zOf(u); return [u / 0.8, (lo(z) + v * (ceilY(z) - lo(z))) / 0.8]; }, grey,
      (u, v) => shadeAt(zOf(u)) * (v > 0.9 || v < 0.1 ? 0.84 : 1), (u, v) => { const z = zOf(u); return lo(z) + v * (ceilY(z) - lo(z)); });
  }
  const xs = [0, 0.16, W / 2, W - 0.16, W];
  c.wall.grid([-W / 2, yB - 0.42, back], [1, 0, 0], UP, xs, ticksBetween(yB - 0.42, ceilY(back), 0.5), (u, v) => [u / 0.8, (yB + v) / 0.8], grey, () => shadeAt(back) * 0.9);
  c.ceil.grid([-W / 2, 0, back], [1, 0, 0], [0, 0, 1], xs, zs, (u, v) => [u / 0.8, v / 0.8], grey, (u, v) => shadeAt(back + v) * 0.8, (u, v, x, z) => ceilY(z));
  // the landing you step onto, then the flight: each stair a block of the same concrete with a worn yellow edge
  c.floor.grid([-W / 2, 0, zL], [0, 0, 1], [1, 0, 0], [0, 0.2, zF - zL - 0.16, zF - zL], xs, (u, v) => [v / 0.8, u / 0.8], grey, (u, v) => (v < 0.2 || v > W - 0.2 ? 0.8 : 1));
  // …and a line of shadow at the back, under the stair above, so that from the top it reads as a flight and not a ramp
  const stairs = c.mapped('stairs', con), edge = [0.72, 0.57, 0.12], tread = [1, 1, 0.98];
  for (let i = 1; i <= n; i++) {
    const y = -i * RISE, z1 = zL - (i - 1) * RUN, z0 = z1 - RUN, k = shadeAt(z0);
    stairs.box(-W / 2, y - 0.5, z0, W / 2, y, z1, tread.map((v) => v * k), { uv: 0.8, skip: '-y-x+x' });
    c.flat.box(-W / 2 + 0.02, y, z0 + 0.008, W / 2 - 0.02, y + 0.004, z0 + 0.055, edge.map((v) => v * k));
    c.flat.box(-W / 2, y, z1 - 0.05, W / 2, y + 0.003, z1, [0.1 * k, 0.1 * k, 0.1 * k]);
  }
  // a steel rail down one side, on brackets
  const steel = [0.42, 0.44, 0.46], rx = -W / 2 + 0.1, t = 0.022;
  const railY = (z) => 0.94 - SLOPE * Math.max(0, zL - z), za = zL + 0.15, zb = zB + 0.1;
  for (const [da, db] of [[[rx - t, t], [rx + t, t]], [[rx + t, t], [rx + t, -t]], [[rx + t, -t], [rx - t, -t]]]) {       // its top, its side, its underside
    const a = [da[0], railY(za) + da[1], za], b = [db[0], railY(za) + db[1], za], e = [db[0], railY(zb) + db[1], zb], f = [da[0], railY(zb) + da[1], zb];
    c.flat.quad(a, b, e, f, steel); c.flat.quad(f, e, b, a, steel);
  }
  for (let z = za - 0.2; z > zb; z -= 1.15) c.flat.box(-W / 2, railY(z) - 0.05, z - 0.015, rx, railY(z) - 0.02, z + 0.015, steel.map((v) => v * shadeAt(z)));
  c.flat.box(rx - t, 0.94 - t, za, rx + t, 0.94 + t, zF - 0.45, steel);

  /* ---- light: one bulkhead over the landing that has seen better days ---------------------------- */
  const lampB = new Batch(), ly = 2.6 - 0.07, lz = zL + 0.65;
  lampB.quad([-0.17, ly, lz - 0.1], [0.17, ly, lz - 0.1], [0.17, ly, lz + 0.1], [-0.17, ly, lz + 0.1]);
  const lamp = new THREE.Mesh(kit.plain(lampB), kit.glowing(kit.tex.white(), 2.4, tube));
  lamp.userData.on = lamp.material.color.clone();
  c.rt.flickers.push(lamp); c.add(lamp);
  c.flat.box(-0.2, 2.6 - 0.065, lz - 0.13, 0.2, 2.6, lz + 0.13, [0.2, 0.2, 0.2]);
  for (const x of [-0.08, 0.08]) c.flat.box(x - 0.006, ly - 0.012, lz - 0.12, x + 0.006, ly - 0.004, lz + 0.12, [0.12, 0.12, 0.12]);
  c.light(0, 2.42, lz, tube, 0.75, { axis: [0, -1, 0], floor: 0.3, k: 2.0, far: 7, flick: true });
  c.light(0, 2.3, lz, tube, 0.3, { axis: [0, -1, 0], floor: 0.3, k: 2.0, far: 7 });

  fireDoor(c);

  if (down) bottomless(c, { zB, yB, back, shadeAt, warm });
  else paperedOver(c, { zL, zF, yB, back, shadeAt });
}

/** Where the stairs run out: the top of somebody else's ceiling, and the light of their room coming up round the edges of it. */
function bottomless(c, { zB, yB, back, shadeAt, warm }) {
  const { W, kit } = c, y = yB + 0.004, k = shadeAt(back) * 1.6;
  c.mapped('tileback', tileBack(kit)).grid([-W / 2, y, back], [0, 0, 1], [1, 0, 0], [0, zB - back], [0, W], (u, v) => [v / 0.6, u / 0.6], [k, k, k]);
  // the back of a light fitting, and the gaps the light gets through
  const fx = 0.3, fz = (back + zB) / 2;
  c.flat.box(fx - 0.3, y, fz - 0.42, fx + 0.3, y + 0.09, fz + 0.42, [0.3, 0.3, 0.29]);
  const leak = c.shining('leak', kit.tex.white(), 2.6, warm);
  for (const [x0, z0, x1, z1] of [[fx - 0.33, fz - 0.45, fx + 0.33, fz - 0.42], [fx - 0.33, fz + 0.42, fx + 0.33, fz + 0.45], [fx - 0.33, fz - 0.45, fx - 0.3, fz + 0.45], [fx + 0.3, fz - 0.45, fx + 0.33, fz + 0.45], [-W / 2 + 0.3, back + 0.28, -W / 2 + 0.9, back + 0.3]])
    leak.quad([x0, y + 0.002, z1], [x1, y + 0.002, z1], [x1, y + 0.002, z0], [x0, y + 0.002, z0]);
  c.light(fx, yB + 0.25, fz, warm, 0.5, { k: 0.7, far: 4.5, wrap: 0.8 });
  for (const [x, z] of [[-0.9, back + 0.25], [0.95, zB - 0.2], [-0.2, fz]]) c.flat.box(x - 0.005, y, z - 0.005, x + 0.005, y + 2.2, z + 0.005, [0.2, 0.2, 0.2]);          // the wires it all hangs from
  // …and it was never meant to be stood on
  let gone = false;
  c.zone({ x0: -W / 2, x1: W / 2, z0: back, z1: zB - 0.06, enter: () => {
    if (gone) return;
    gone = true;
    c.env.sound.play('crack'); c.env.interfere(1);
    const at = c.toWorld(0, (back + zB) / 2); c.env.descend?.(at);
  } });
}

/**
 * Where there is nothing under them at all: the stairs go down into a wall with this floor's paper on it, skirting and
 * all, and the carpet has been run up the last of them. Somebody made camp on the landing, and tried this wall first.
 * It is the wall that gives.
 */
function paperedOver(c, { zL, zF, yB, back, shadeAt }) {
  const { W, kit, level } = c, look = c.look, k = shadeAt(back), R = makeRng(`${level.seed}/dead-end`);
  const top = 2.6 - 0.45, rows = [0, 0.16, 0.7, 1.4, 2.1, top - yB - 0.16, top - yB];
  c.mapped('papered', kit.tex.wallpaper(look)).grid([-W / 2, yB, back + 0.012], [1, 0, 0], [0, 1, 0], [0, 0.16, W / 2, W - 0.16, W], rows, (u, v) => [u / 0.8, v / 0.8], [k, k, k], (u, v) => (v < 0.2 ? 0.8 : 1));
  c.flat.box(-W / 2, yB, back + 0.012, W / 2, yB + 0.11, back + 0.034, lin(look.trim).map((v) => v * k));
  const carpet = c.mapped('carpeted', kit.tex.floor(look));
  for (let i = 0; i < 2; i++) { const y = yB + i * RISE, z0 = back + i * RUN; carpet.box(-W / 2, y - RISE, z0, W / 2, y + 0.012, z0 + RUN + 0.012, [k, k, k], { uv: 1.6, skip: '-y-x+x-z' }); }
  // it was the first wall they tried, and the right one: they did not lean on it for long enough
  const wall = { y: yB, at: (at, off = 0) => ({ x: at, z: back + 0.012 + off, n: [0, 0, 1], U: [1, 0, 0] }), to: (me) => ({ d: me.z - back, c: me.x }) };
  gives(c, wall, 0, tapeMark(c, wall, 0, R, { roll: true, stir: true }));
  tallyMark(c, wall, 0.95, R, 1.5);

  // the camp, along the wall the door does not open against
  const cz = zL + 1.3;
  camp(c, 0.86, cz, -Math.PI / 2, { narrow: true });
  rationList(c, { side: 'right', at: cz + 0.2, y: 1.2 });
  tallyMark(c, 'right', cz - 0.75, R, 1.42);
  // what they had concluded, on a sheet torn off the same pad
  const note = card(c, 'gaveup', ['LEANED ON IT.', 'NOTHING.', '', '(GAVE IT A', 'WHOLE SECOND)'], { w: 96, h: 96, bg: '#f4f1e6', fg: '#3a342a', size: 9, pad: 9, weight: 600 });
  c.hang(c.mapped('gaveup', note), 'right', cz - 0.18, 1.22, 0.22, 0.22, null, WHITE, 0.006);
  // and this floor's own evacuation plan, with every other wall they tried struck off it in red: all but the one they were sitting beside
  const tried = level.rooms.filter((r) => r.dress.some((d) => d.type === 'marks') || (level.thin && level.thin.room === r.id));
  floorPlan(c, { side: 'left', at: zL + 0.95 }, (g, mx, my) => {
    g.strokeStyle = '#c8281c'; g.lineWidth = 1.5; g.lineCap = 'round';
    for (const r of tried) { const x = mx(r.cx, r.cz), y = my(r.cx, r.cz), k = Math.max(4, Math.min(8, Math.hypot(r.w, r.d) * 0.7)); g.beginPath(); g.moveTo(x - k, y - k * 0.6); g.lineTo(x + k, y + k * 0.6); g.moveTo(x - k, y + k * 0.6); g.lineTo(x + k, y - k * 0.6); g.stroke(); }
  });
}

/** The fire door every part of the building ends at: steel, a bar to push, and a notice. What is behind it differs. */
function fireDoor(c) {
  const { D, kit } = c, dr = c.room.doors[0], zF = D / 2, other = c.world.rooms[dr.to];
  /* ---- the door: steel, a bar to push, and a notice --------------------------------------------- */
  const dw = dr.w - 0.05, dh = dr.h - 0.02, zd = zF + T / 2, steelDoor = lin('#6f7a80'), bar = [0.7, 0.72, 0.7];
  // the leaf is the sculpted fire door (doorleaf.model.js) in this one's steel: a bar across the side you leave by, a
  // pull on the other, the slit of wired glass with nothing behind it
  const leaf = new Batch(true), hx = dr.c - dw / 2;
  addLeaf(leaf, leafModel(kit, dw, dh - 0.02, 0, { colour: '#6f7a80', bar: 'push' }), [hx, zd], dr.sill + 0.02, [1, 0], [0, 1], LEAF_THICK / 2);
  const notice = kit.tex.custom('firedoor', 96, 40, (g, w, h) => {
    P(g, '#1f8a4e', 0, 0, w, h); P(g, '#eafff0', 2, 2, w - 4, 1); P(g, '#eafff0', 2, h - 3, w - 4, 1);
    drawText(g, ['FIRE EXIT'], 0, 3, w, 20, { color: '#eafff0', size: 15, pad: 8 }); drawText(g, ['KEEP SHUT'], 0, 22, w, 14, { color: '#bfe8cf', size: 9, pad: 8 });
  }, { clamp: true });
  const door = c.dynamic(leaf, { pivot: [hx, 0, zd] });
  const plate = new Batch(), pw = Math.min(0.56, dw - 0.2), py = dr.sill + 1.52, px = hx + 0.1 + pw / 2;
  plate.quad([px - pw / 2, py - pw * 0.21, zd + 0.024], [px + pw / 2, py - pw * 0.21, zd + 0.024], [px + pw / 2, py + pw * 0.21, zd + 0.024], [px - pw / 2, py + pw * 0.21, zd + 0.024]);
  const sticker = c.dynamic(plate, { map: notice, pivot: [hx, 0, zd] });
  doorFrame(c, 'front', dr.c, dr.w, dr.h, lin('#585f63'), 0.03, 0.06);
  // the side you see it from is lit by the room you are standing in, which is not this one
  const fill = Math.max(0.12, Math.min(0.5, other.level * 1.3));
  c.light(0, dr.sill + 1.4, zF + T + 1.1, lin(other.def.look.tube), fill * 2.4, { k: 2.4, far: 5, wrap: 0.5 });
  // a room that hangs no sign of its own over this door gets one from us, on its side of the wall
  if (other.def.kind === 'special') {
    const sy = Math.min(dr.sill + dr.h + 0.26, other.def.H - 0.2), sw = Math.min(dr.w - 0.2, 0.82), zs2 = zF + T + 0.035;
    const tex = kit.tex.custom('exitEXIT', 64, 20, (g, w, h) => { P(g, '#0d3a22', 0, 0, w, h); P(g, '#1f8a4e', 1, 1, w - 2, h - 2); g.fillStyle = '#eafff0'; g.font = '700 14px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', w / 2, h / 2 + 1); }, { clamp: true });
    c.shining('exitEXIT', tex, 1.9).quad([-sw / 2, sy - sw * 0.156, zs2], [sw / 2, sy - sw * 0.156, zs2], [sw / 2, sy + sw * 0.156, zs2], [-sw / 2, sy + sw * 0.156, zs2]);
    c.flat.box(-sw / 2 - 0.02, sy - sw * 0.18, zs2 - 0.03, sw / 2 + 0.02, sy + sw * 0.18, zs2 - 0.005, [0.1, 0.12, 0.1]);
  }
  let open = 0;
  const here = c.toWorld(0, zF + T + 0.35);
  // A bar is pushed by walking into it. Nobody presses a key to leave a part of the building (the owner: a level that
  // happens at the press of a button is a video game's): the door gives to whoever comes at it from the room side.
  const push = () => {
    open = 0.0001; c.world.openLink(dr.link);
    c.env.play('thunk', here.x, here.z, 6); c.env.play('door', here.x, here.z, 6); c.env.noise?.(here.x, here.z, 1);
  };
  c.tick((dt, t, me) => {
    if (!open && me && pushes(me, { c: dr.c, w: dw, z: zF + T })) push();
    if (!open || open >= 1) return;
    open = Math.min(1, open + dt / 1.1);
    door.rotation.y = sticker.rotation.y = 1.75 * open * open * (3 - 2 * open);
  });
}

/* ---- the other things a fire door can have behind it ------------------------------------------------ */

/** One upright or sloping flat thing, facing the way `n` points whatever order its corners come in. */
function facing(batch, q, n, alb, uv) {
  const ax = q[1][0] - q[0][0], ay = q[1][1] - q[0][1], az = q[1][2] - q[0][2], bx = q[3][0] - q[0][0], by = q[3][1] - q[0][1], bz = q[3][2] - q[0][2];
  if ((ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0) { q = [q[1], q[0], q[3], q[2]]; if (uv) uv = [uv[1], uv[0], uv[3], uv[2]]; }
  batch.quad(q[0], q[1], q[2], q[3], alb, uv);
}

/**
 * A square pit through the building under [x0, z0, x1, z1]: the edge of the slab, then whatever the part below is
 * papered with, running down to where its ceiling would be. Seen from inside only.
 */
function shaft(c, x0, z0, x1, z1, top, sides = 'wesn') {
  const { kit, level } = c, con = c.mapped('slab', concrete(kit)), look = level.shaft || c.look, paper = c.mapped('shaftpaper', kit.tex.wallpaper(look));
  const slab = 0.36, deep = GAP - 2.75, walls = { w: [[x0, z1], [x0, z0], [1, 0, 0]], e: [[x1, z0], [x1, z1], [-1, 0, 0]], n: [[x0, z0], [x1, z0], [0, 0, 1]], s: [[x1, z1], [x0, z1], [0, 0, -1]] };
  for (const k of sides) {
    const [a, b, n] = walls[k], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    facing(con, [[a[0], top - slab, a[1]], [b[0], top - slab, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]], n, [0.5, 0.5, 0.48], [[0, 0], [len / 0.8, 0], [len / 0.8, slab / 0.8], [0, slab / 0.8]]);
    // (darker toward the middle of the drop, and lit again from the room it comes out over)
    for (let i = 0, rows = 6; i < rows; i++) {
      const ya = top - slab - (deep * i) / rows, yb = top - slab - (deep * (i + 1)) / rows, k2 = 0.16 + 0.5 * Math.abs(i - (rows - 1) * 0.45) / rows + (i === rows - 1 ? 0.3 : 0);
      facing(paper, [[a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], ya, b[1]], [a[0], ya, a[1]]], n, [k2, k2, k2], [[0, yb / 0.8], [len / 0.8, yb / 0.8], [len / 0.8, ya / 0.8], [0, ya / 0.8]]);
    }
    con.box(Math.min(a[0], b[0]) - 0.001, top - slab - 0.05, Math.min(a[1], b[1]) - 0.001, Math.max(a[0], b[0]) + 0.001, top - slab, Math.max(a[1], b[1]) + 0.001, [0.2, 0.2, 0.2], { uv: 0.8 });
  }
}

/**
 * What is at the bottom of a drop before the part below has been hung there: a floor in its carpet, lit, so that
 * nobody who gets to an edge early ever looks down into black. The conductor puts it away once the real rooms are in
 * (`env.below`: index.js).
 */
function standIn(c, x0, z0, x1, z1, y) {
  const look = c.level.shaft || c.look, b = new Batch(), m = 1.6;
  b.quad([x0 - m, y, z1 + m], [x1 + m, y, z1 + m], [x1 + m, y, z0 - m], [x0 - m, y, z0 - m], [0.5, 0.5, 0.5], [[(x0 - m) / 1.6, (z1 + m) / 1.6], [(x1 + m) / 1.6, (z1 + m) / 1.6], [(x1 + m) / 1.6, (z0 - m) / 1.6], [(x0 - m) / 1.6, (z0 - m) / 1.6]]);
  (c.env.below ||= []).push(c.dynamic(b, { map: c.kit.tex.floor(look), unlit: true }));
}

/** A notice in the house style of fire notices. */
function greenSign(c, key, lines, side, at, y, w = 0.62) {
  const tex = c.kit.tex.custom('green:' + key, 112, 56, (g, tw, th) => {
    P(g, '#1f8a4e', 0, 0, tw, th); P(g, '#eafff0', 2, 2, tw - 4, 1); P(g, '#eafff0', 2, th - 3, tw - 4, 1);
    drawText(g, lines, 0, 3, tw, th - 6, { color: '#eafff0', size: lines.length > 1 ? 12 : 15, pad: 8 });
  }, { clamp: true });
  c.hang(c.mapped('green:' + key, tex), side, at, y, w, w / 2, null, WHITE, 0.012);
}

function corridor(c, way) {
  const { W, D, H, kit, level } = c, zF = D / 2, next = level.shaft || c.look, glow = lin(next.tube || '#fff6dc');
  c.shell({ floor: false });
  const floor = (x0, z0, x1, z1) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) c.floor.grid([x0, 0, z0], [0, 0, 1], [1, 0, 0], [0, z1 - z0], [0, x1 - x0], (u, v) => [(x0 + v) / 1.6, (z0 + u) / 1.6], WHITE); };
  const edge = lin(c.look.trim).map((v) => v * 0.6);
  let gone = false;
  const over = (x, z) => { if (gone) return; gone = true; const at = c.toWorld(x, z); c.env.play('rustle', at.x, at.z, 4); c.env.descend?.(at); };

  if (way === 'hole') {
    // the middle of the floor has gone, some time ago, and somebody has done what the procedure says to do about it
    const [x0, z0, x1, z1] = holeIn(W, D);
    floor(-W / 2, z1, W / 2, zF); floor(-W / 2, -D / 2, W / 2, z0); floor(-W / 2, z0, x0, z1); floor(x1, z0, W / 2, z1);
    shaft(c, x0, z0, x1, z1, 0); standIn(c, x0, z0, x1, z1, -GAP + 0.03);
    for (const [a0, b0, a1, b1] of [[x0 - 0.03, z0 - 0.03, x1 + 0.03, z0], [x0 - 0.03, z1, x1 + 0.03, z1 + 0.03], [x0 - 0.03, z0, x0, z1], [x1, z0, x1 + 0.03, z1]]) c.flat.box(a0, 0, b0, a1, 0.012, b1, edge);
    for (const [x, len] of [[x0 + 0.3, 0.5], [x1 - 0.25, 0.35], [0.1, 0.6]]) c.flat.box(x - 0.008, -0.22, z0, x + 0.008, -0.2, z0 + len, [0.22, 0.14, 0.1]);          // what the floor was reinforced with
    wetSign(c, x0 + 0.25, z1 + 0.75, 0.3, ['CAUTION', 'FLOOR']);
    wetSign(c, x1 - 0.1, z1 + 0.3, 1.1, ['CAUTION', 'FLOOR'], true);
    greenSign(c, 'assembly', ['ASSEMBLY POINT', '▼'], 'back', 0, 1.6);
    c.light(0, -0.6, (z0 + z1) / 2, glow, 0.5, { k: 0.8, far: 4, wrap: 0.8 });
    c.zone({ x0: x0 + 0.12, z0: z0 + 0.12, x1: x1 - 0.12, z1: z1 - 0.12, enter: (me) => over(me.x, me.z) });
  } else if (way === 'ledge') {
    // the corridor stops. The walls and the ceiling carry on for a bit, out of habit
    const zE = ledgeAt(D);
    floor(-W / 2, zE, W / 2, zF);
    shaft(c, -W / 2, -D / 2, W / 2, zE, 0); standIn(c, -W / 2, -D / 2, W / 2, zE, -GAP + 0.03);
    c.flat.box(-W / 2, 0, zE - 0.03, W / 2, 0.012, zE, edge);
    for (const x of [-0.8, 0.35, 0.9]) c.flat.box(x - 0.008, -0.22, zE - 0.35 - Math.abs(x) * 0.2, x + 0.008, -0.2, zE, [0.22, 0.14, 0.1]);          // what the floor was reinforced with
    if (c.hasProp('chair')) c.prop('chair', 0.45, zE + 0.5, { rot: Math.PI + 0.2, solid: false });                                              // somebody sat and looked at it for a while
    greenSign(c, 'step', ['MIND THE STEP'], 'right', zE + 1.1, 1.5);
    c.light(0, -0.8, zE - 1.4, glow, 0.6, { k: 0.8, far: 5, wrap: 0.8 });
    c.zone({ x0: -W / 2, z0: -D / 2, x1: W / 2, z1: zE - 0.3, enter: (me) => over(me.x, Math.min(me.z, zE - 0.6)) });
  } else {
    // a chute for the internal post, big enough to get into, and nothing that says not to
    const d = ductIn(D), steel = [0.42, 0.44, 0.46], dark = [0.16, 0.17, 0.18], slope = d.y1 / (d.wall - d.z1);
    const yAt = (z) => (z >= d.wall ? 0 : Math.max(d.y1, (d.wall - z) * slope));
    floor(-W / 2, d.wall, W / 2, zF);
    for (const sx of [-1, 1]) c.pillar(sx * (W / 2 + d.half) / 2, d.wall - 0.1, W / 2 - d.half, 0.2);
    c.wall.box(-d.half, d.top, d.wall - 0.2, d.half, H, d.wall, WHITE, { uv: 0.8, skip: '+y-x+x' });
    for (const [a0, b0, a1, b1] of [[-d.half - 0.06, 0, -d.half, d.top + 0.06], [d.half, 0, d.half + 0.06, d.top + 0.06], [-d.half, d.top, d.half, d.top + 0.06]]) c.flat.box(a0, b0, d.wall, a1, b1, d.wall + 0.03, steel);
    // the duct: four sides of folded steel, a seam every arm's length, going down into the dark
    const steelB = c.flat, seams = Math.round((d.wall - d.z1) / 0.6);
    for (let i = 0; i < seams; i++) {
      const za = d.wall - ((d.wall - d.z1) * i) / seams, zb = d.wall - ((d.wall - d.z1) * (i + 1)) / seams, ya = yAt(za), yb = yAt(zb), k = Math.max(0.12, 0.8 - i * 0.11), col = (i % 2 ? steel : steel.map((v) => v * 0.9)).map((v) => v * k);
      facing(steelB, [[-d.half, ya, za], [d.half, ya, za], [d.half, yb, zb], [-d.half, yb, zb]], [0, 1, 0], col);
      facing(steelB, [[-d.half, ya + d.top, za], [d.half, ya + d.top, za], [d.half, yb + d.top, zb], [-d.half, yb + d.top, zb]], [0, -1, 0], col.map((v) => v * 0.8));
      for (const sx of [-1, 1]) facing(steelB, [[sx * d.half, ya, za], [sx * d.half, yb, zb], [sx * d.half, yb + d.top, zb], [sx * d.half, ya + d.top, za]], [-sx, 0, 0], col.map((v) => v * 0.9));
      c.flat.box(-d.half, ya - 0.001, za - 0.012, d.half, ya + 0.006, za, dark);
    }
    const tex = card(c, 'post', ['INTERNAL POST', 'NEXT COLLECTION:', '—'], { w: 96, h: 56, bg: '#1f8a4e', fg: '#eafff0', size: 9, pad: 6, weight: 700 });
    c.mapped('postsign', tex).quad([-0.34, 1.32, d.wall + 0.012], [0.34, 1.32, d.wall + 0.012], [0.34, 1.72, d.wall + 0.012], [-0.34, 1.72, d.wall + 0.012]);
    c.light(0, d.y1 + 0.3, d.z1 - 0.3, glow, 0.35, { k: 0.8, far: 3.5, wrap: 0.8 });
    standIn(c, -d.half, d.z1 - 1.2, d.half, d.z1, d.y1 - GAP + 0.03);
    c.rt.floorY = (x, z) => yAt(z);
    c.rt.headY = (x, z) => (z >= d.wall + 0.12 ? H : d.top);
    c.rt.clip = (x, z, r) => (z >= d.wall + r ? Math.abs(x) <= W / 2 - r && z <= zF - r : Math.abs(x) <= d.half - Math.min(r, 0.2) && z >= -D / 2 + r);
    // once you are in, it has you: the controls are not yours again until the carpet
    let sliding = 0;
    c.tick((dt, t, me) => {
      if (gone || !me.inside) return;
      if (!sliding) { if (me.z < d.wall - 0.25) { sliding = 0.0001; c.env.hold?.(true); const at = c.toWorld(0, d.wall); c.env.play('slide', at.x, at.z, 5); } return; }
      sliding += dt;
      const z = me.z - (1.6 + sliding * 7) * dt, x = me.x * Math.exp(-6 * dt), at = c.toWorld(x, z);
      c.env.player.warp(at.x, at.z);
      c.env.interfere(0.35);
      if (Math.floor((me.z - d.z1) / 0.6) !== Math.floor((z - d.z1) / 0.6)) c.env.play('clack', at.x, at.z, 4);
      if (z < d.z1 - 0.25) over(0, d.z1 - 0.5);
    });
  }
  fireDoor(c);
}
