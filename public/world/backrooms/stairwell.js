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
// Somebody got this far and stayed a while. The way out is not here; it is a
// wall, somewhere near (thin.js), and they had worked out which.
//
// Same contract as the builders in rooms.js: the toolbox `c`, the room's own
// frame, entered through the +z wall — where, this once, there is a real door.
import * as THREE from 'three';
import { Batch, lin, drawText, WHITE } from './kit.js';
import { RISE, RUN, T, makeRng } from './gen.js';
import { P, doorFrame, floorPlan } from './bits.js';
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

/** What is painted on the landing wall: this floor, and what the arrow says is under it. */
function floorPlate(c, label, below) {
  return c.kit.tex.custom(`floor:${label}>${below}`, 96, 128, (g, w, h) => {
    P(g, '#2f5d4a', 0, 0, w, h); P(g, '#e9e4d2', 3, 3, w - 6, 1); P(g, '#e9e4d2', 3, h - 4, w - 6, 1); P(g, '#e9e4d2', 3, 3, 1, h - 6); P(g, '#e9e4d2', w - 4, 3, 1, h - 6);
    drawText(g, ['FLOOR'], 0, 8, w, 14, { color: '#e9e4d2', size: 11, pad: 10 });
    drawText(g, [label], 0, 22, w, 58, { color: '#f4f0e0', size: label.length > 3 ? 20 : label.length > 1 ? 34 : 54, pad: 12 });
    g.fillStyle = '#e9e4d2'; g.beginPath(); g.moveTo(w / 2 - 9, 86); g.lineTo(w / 2 + 9, 86); g.lineTo(w / 2, 97); g.fill();
    drawText(g, [below], 0, 100, w, 22, { color: '#e9e4d2', size: below.length > 3 ? 11 : 17, pad: 12 });
  }, { clamp: true });
}

export function stairwell(c) {
  const { W, D, kit, room, level } = c, down = room.way === 'stairs';
  const dr = room.doors[0], zF = D / 2, zL = zF - (down ? 1.3 : 3.0);        // the front wall, and where the landing ends
  const n = down ? 16 : 6, yB = -n * RISE, zB = zL - n * RUN;                // how many stairs, how far down, where they end
  const back = down ? -D / 2 : zB;                                            // …and where the well does
  const drop = down ? 2.8 : 0.45, reach = drop / SLOPE;                       // the soffit follows the flight down, and then stops
  const floorY = (z) => (z >= zL ? 0 : -Math.min(n, Math.floor((zL - z) / RUN + 1e-6) + 1) * RISE);
  const ceilY = (z) => 2.6 - SLOPE * Math.max(0, Math.min(reach, zL + 0.6 - z));
  const con = concrete(kit), grey = [0.8, 0.8, 0.78], other = c.world.rooms[dr.to];
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
  // what is painted on the wall, where you cannot miss it
  c.hang(c.mapped('floorplate', floorPlate(c, String(level.label ?? '1'), String(level.below ?? 'G'))), 'right', zF - 0.66, 1.5, 0.6, 0.8, null, WHITE, 0.012);

  /* ---- the door: steel, a bar to push, and a notice --------------------------------------------- */
  const dw = dr.w - 0.05, dh = dr.h - 0.02, zd = zF + T / 2, steelDoor = lin('#6f7a80'), bar = [0.7, 0.72, 0.7];
  const leaf = new Batch(), hx = dr.c - dw / 2;
  leaf.box(hx, dr.sill + 0.02, zd - 0.022, hx + dw, dr.sill + dh, zd + 0.022, steelDoor);
  leaf.box(hx + 0.08, dr.sill + 0.98, zd + 0.022, hx + dw - 0.08, dr.sill + 1.06, zd + 0.075, bar);                                  // the bar, on the side you leave by
  for (const x of [hx + 0.1, hx + dw - 0.14]) leaf.box(x, dr.sill + 0.96, zd + 0.022, x + 0.04, dr.sill + 1.08, zd + 0.06, [0.2, 0.2, 0.21]);
  leaf.box(hx + dw - 0.36, dr.sill + 1.36, zd - 0.026, hx + dw - 0.12, dr.sill + 1.74, zd + 0.026, [0.03, 0.035, 0.04]);              // a slit of wired glass with nothing behind it
  for (let k = 1; k < 4; k++) leaf.box(hx + dw - 0.36 + k * 0.06, dr.sill + 1.36, zd + 0.026, hx + dw - 0.355 + k * 0.06, dr.sill + 1.74, zd + 0.028, [0.3, 0.32, 0.33]);
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
  c.use({ x: 0, z: zF + T + 0.35, r: 1.6, label: 'push the bar', when: () => !open, use: () => {
    open = 0.0001; c.world.openLink(dr.link);
    c.env.play('thunk', here.x, here.z, 6); c.env.play('door', here.x, here.z, 6); c.env.noise?.(here.x, here.z, 1);
  } });
  c.tick((dt) => {
    if (!open || open >= 1) return;
    open = Math.min(1, open + dt / 1.1);
    door.rotation.y = sticker.rotation.y = 1.75 * open * open * (3 - 2 * open);
  });

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
    c.env.descend?.();
  } });
}

/**
 * Where there is nothing under them at all: the stairs go down into a wall with this floor's paper on it, skirting and
 * all, and the carpet has been run up the last of them. Somebody made camp on the landing, and tried this wall first.
 */
function paperedOver(c, { zL, zF, yB, back, shadeAt }) {
  const { W, kit, level } = c, look = c.look, k = shadeAt(back), R = makeRng(`${level.seed}/dead-end`);
  const top = 2.6 - 0.45, rows = [0, 0.16, 0.7, 1.4, 2.1, top - yB - 0.16, top - yB];
  c.mapped('papered', kit.tex.wallpaper(look)).grid([-W / 2, yB, back + 0.012], [1, 0, 0], [0, 1, 0], [0, 0.16, W / 2, W - 0.16, W], rows, (u, v) => [u / 0.8, v / 0.8], [k, k, k], (u, v) => (v < 0.2 ? 0.8 : 1));
  c.flat.box(-W / 2, yB, back + 0.012, W / 2, yB + 0.11, back + 0.034, lin(look.trim).map((v) => v * k));
  const carpet = c.mapped('carpeted', kit.tex.floor(look));
  for (let i = 0; i < 2; i++) { const y = yB + i * RISE, z0 = back + i * RUN; carpet.box(-W / 2, y - RISE, z0, W / 2, y + 0.012, z0 + RUN + 0.012, [k, k, k], { uv: 1.6, skip: '-y-x+x-z' }); }
  // it was the first wall they tried
  const wall = { y: yB, at: (at, off = 0) => ({ x: at, z: back + 0.012 + off, n: [0, 0, 1], U: [1, 0, 0] }) };
  tapeMark(c, wall, 0, R, { roll: true });
  tallyMark(c, wall, 0.95, R, 1.5);

  // the camp, along the wall the door does not open against
  const cz = zL + 1.3;
  camp(c, 0.86, cz, -Math.PI / 2, { narrow: true });
  rationList(c, { side: 'right', at: cz + 0.2, y: 1.2 });
  tallyMark(c, 'right', cz - 0.75, R, 1.42);
  // and what they had worked out: this floor's own evacuation plan, corrected in red
  const thin = level.thin, room = thin && level.rooms[thin.room];
  floorPlan(c, { side: 'left', at: zL + 0.95 }, room && ((g, mx, my) => {
    const ex = level.rooms[level.exit.room], x = mx(ex.cx, ex.cz), y = my(ex.cx, ex.cz);
    g.strokeStyle = '#c8281c'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 9, y - 4); g.lineTo(x + 9, y + 5); g.moveTo(x - 9, y + 5); g.lineTo(x + 9, y - 4); g.stroke();            // not this
    const tx = mx(room.cx, room.cz), ty = my(room.cx, room.cz), r = Math.max(7, Math.hypot(room.w, room.d) * 1.6);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(tx + i - 1, ty + (i % 2), r + i * 1.3, r * 0.8 + i, i * 0.4, 0, 6.6); g.stroke(); }     // this, three times round
    g.beginPath(); g.moveTo(x, y + 8); g.quadraticCurveTo((x + tx) / 2 + 8, (y + ty) / 2 + 10, tx + (x > tx ? r : -r), ty); g.stroke();
  }));
}
