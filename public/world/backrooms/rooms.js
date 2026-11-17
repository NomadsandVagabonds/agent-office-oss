// The Backrooms — the rooms, part one: the plain connective rooms and what
// gets left in them, the room you land in, the way out, and the first half of
// the deck. A builder gets the toolbox from world.js (`c`) and the details
// rolled for it by gen.js (`c.params`), and works in the room's own frame:
// x across, z deep, centred, and you walk in through the +z wall.
import * as THREE from 'three';
import { Vox, M } from '../vox/vox.js';
import { Batch, lin, atlas, drawText, WHITE } from './kit.js';
import { makeCutout, drawPortrait } from './cutout.js';
import { TILE, RISE, RUN, wallPoint, pinchHalf } from './gen.js';
import { P, clamp, turnTo, framed, card, scatter, doorLeaf, doorFrame, woodLeaf, wetSign, standee, mugVox, floorPlan } from './bits.js';
import { marks, trace } from './traces.js';
import { thinWall, refuses } from './thin.js';
import { MORE } from './rooms2.js';
import { stairwell } from './stairwell.js';
import { lawn, standing, THINGS } from './suburb.js';
import { poolroom, poolStanding, POOL_THINGS } from './waterpark.js';
import { concourse } from './mall.js';

/* ---- the plain rooms, and what somebody left in them ------------------------------- */

/** A door where a door has no business being: `w` wide on a wall, its foot at y0, its head at y1. */
function wallDoor(c, side, at, w, y0, y1, rgb) {
  const cream = lin('#e2d8bd'), h = y1 - y0;
  c.wbox(side, at - w / 2 - 0.035, 0.07, y0 - 0.02, y1 + 0.07, 0, 0.05, cream); c.wbox(side, at + w / 2 + 0.035, 0.07, y0 - 0.02, y1 + 0.07, 0, 0.05, cream);
  c.wbox(side, at, w, y1, y1 + 0.07, 0, 0.05, cream); c.wbox(side, at, w + 0.14, y0 - 0.06, y0, 0, 0.07, cream);
  // the leaf is the sculpted door (wooddoor.model.js), however much of one the wall had room for
  const p = c.wallAt(side, at, 0.012);
  woodLeaf(c, c.vox, [p.x, y0, p.z], [p.U[0], 0, p.U[2]], [0, 1, 0], [p.n[0], 0, p.n[2]], w - 0.02, h - 0.005, 0.04, rgb);
}

/** Somewhere a door could lie flat (0.86 × 1.9 m, long side deep): open floor if there is any, else any level patch beside the way through. */
function hatchSpot(c, head) {
  const open = c.spot(0.95, { head });
  if (open) return open;
  const { W, D, room } = c, level = (x, z) => Math.abs(c.floorAt(x, z)) < 0.01 && c.ceilAt(x, z) >= head;
  for (let tries = 0; tries < 60; tries++) {
    const x = c.R.range(-W / 2 + 0.65, W / 2 - 0.65), z = c.R.range(-D / 2 + 1.15, D / 2 - 1.15);
    if (![[0, 0], [-0.43, -0.95], [0.43, -0.95], [-0.43, 0.95], [0.43, 0.95]].every(([dx, dz]) => level(x + dx, z + dz))) continue;
    if (room.pillars.some((q) => Math.abs(x - q.x) < q.w / 2 + 0.55 && Math.abs(z - q.z) < q.d / 2 + 1.05)) continue;
    if (room.doors.some((dr) => { const p = c.doorPoint(dr, 0.3); return Math.abs(x - p.x) < 0.43 + dr.w / 2 && Math.abs(z - p.z) < 1.25; })) continue;
    c.reserve(x, z, 0.95);
    return { x, z };
  }
  return null;
}

/** A door lying in the carpet. Open it and step in, and you come out of a ceiling somewhere else. */
function floorDoor(c, item) {
  const s = hatchSpot(c, 1.6); if (!s) return;
  const wood = lin('#7a5230'), cream = lin('#e2d8bd'), w = 0.86, l = 1.9, x0 = s.x - w / 2, z0 = s.z - l / 2;
  for (const [a, b, e, f] of [[x0 - 0.07, z0 - 0.07, x0 + w + 0.07, z0], [x0 - 0.07, z0 + l, x0 + w + 0.07, z0 + l + 0.07], [x0 - 0.07, z0, x0, z0 + l], [x0 + w, z0, x0 + w + 0.07, z0 + l]]) c.flat.box(a, 0, b, e, 0.03, f, cream, { skip: '-y' });
  c.flat.quad([x0, 0.004, z0 + l], [x0 + w, 0.004, z0 + l], [x0 + w, 0.004, z0], [x0, 0.004, z0], [0.003, 0.003, 0.003]);
  const leaf = new Batch(true);                 // the sculpted door, lying on its back
  woodLeaf(c, leaf, [s.x, 0.008, z0 + 0.01], [1, 0, 0], [0, 0, 1], [0, 1, 0], w - 0.02, l - 0.02, 0.028, wood);
  const door = c.dynamic(leaf, { pivot: [x0, 0.02, s.z] });
  let open = 0, fell = false;
  const here = c.toWorld(s.x, s.z);
  c.use({ x: s.x, z: s.z, r: 1.5, cone: -1, label: 'open', when: () => !open && c.env.player.me.pitch < -0.25, use: () => {
    if (c.env.hatches.has(item.to)) { open = 0.0001; c.env.play('door', here.x, here.z, 5); } else c.env.play('rattle', here.x, here.z, 5);
  } });
  c.tick((dt, t, me) => {
    if (!open) return;
    if (open < 1) { open = Math.min(1, open + dt / 0.7); door.rotation.z = 1.9 * open * open * (3 - 2 * open); }
    else if (!fell && me.inside && Math.abs(me.x - s.x) < w / 2 - 0.1 && Math.abs(me.z - s.z) < l / 2 - 0.15) { fell = true; c.env.hatches.get(item.to)?.drop(); }
    else if (fell && !me.inside) { fell = false; open = 0; door.rotation.z = 0; }
  });
}

/** The other end of a door in a floor: a door in a ceiling, with nothing under it but carpet. */
function ceilDoor(c) {
  const s = hatchSpot(c, 2.1); if (!s) return;
  const wood = lin('#7a5230'), cream = lin('#e2d8bd'), w = 0.86, l = 1.9, x0 = s.x - w / 2, z0 = s.z - l / 2, y = c.ceilAt(s.x, s.z);
  for (const [a, b, e, f] of [[x0 - 0.07, z0 - 0.07, x0 + w + 0.07, z0], [x0 - 0.07, z0 + l, x0 + w + 0.07, z0 + l + 0.07], [x0 - 0.07, z0, x0, z0 + l], [x0 + w, z0, x0 + w + 0.07, z0 + l]]) c.flat.box(a, y - 0.04, b, e, y, f, cream);
  c.flat.quad([x0, y - 0.003, z0], [x0 + w, y - 0.003, z0], [x0 + w, y - 0.003, z0 + l], [x0, y - 0.003, z0 + l], [0.003, 0.003, 0.003]);
  const leaf = new Batch(true);                 // the sculpted door, face down
  woodLeaf(c, leaf, [s.x, y - 0.012, z0 + 0.01], [1, 0, 0], [0, 0, 1], [0, -1, 0], w - 0.02, l - 0.02, 0.028, wood);
  const door = c.dynamic(leaf, { pivot: [x0, y - 0.02, s.z] });
  let swing = 0;
  const here = c.toWorld(s.x, s.z);
  // whoever steps into the matching floor door arrives here, from above
  c.env.hatches.set(c.room.id, { drop: () => {
    const pl = c.env.player;
    pl.warp(here.x, here.z);
    pl.me.sink = 0; pl.me.drop = Math.max(0.4, y - pl.EYE - 0.25); pl.me.dropV = -0.5; pl.me.pitch = Math.min(pl.me.pitch, -0.05);
    c.world.enter(c.rt);
    c.env.interfere(1); c.env.sound.play('thunk');
    swing = 0.0001;
  } });
  c.tick((dt) => {
    if (!swing) return;
    swing += dt;
    const k = swing < 0.35 ? swing / 0.35 : swing < 3 ? 1 : Math.max(0, 1 - (swing - 3) / 1.2);
    door.rotation.z = -1.45 * k * k * (3 - 2 * k);
    if (swing > 4.2) { swing = 0; door.rotation.z = 0; }
  });
}

function dressing(c, item) {
  const R = c.R;
  if (item.type === 'trace') { trace(c, item); return; }                   // something an earlier visitor left (traces.js)
  if (POOL_THINGS[item.type]) { POOL_THINGS[item.type](c, item); return; }
  if (THINGS[item.type]) { THINGS[item.type](c, item); return; }           // …or what is left on a lawn (suburb.js)
  if (item.type === 'boxes') {
    const s = c.spot(0.65, { head: 1.0 }); if (!s) return;
    c.prop('boxes', s.x, s.z, { rot: item.turn, o: { variant: item.seed % 3 }, fallback: [0.8, 0.7, 0.8] });
    scatter(c, s.x, s.z, item.n);
  } else if (item.type === 'chair') {
    const w = c.wallSpot(1.2, undefined, 0.35, 1.2); if (!w) return;
    const p = c.wallAt(w.side, w.at, 0.55);
    if (!c.clear(p.x, p.z, 0.4, 1.1)) return;
    c.reserve(p.x, p.z, 0.45);
    c.prop('chair', p.x, p.z, { rot: p.rot + Math.PI + R.range(-0.15, 0.15), o: { color: R.pick(['#4a7a6a', '#b5483f', '#5a5a66']) } });
  } else if (item.type === 'plant') {
    const tall = R.chance(0.5), k = c.corner(0.55, undefined, tall ? 1.8 : 1.0); if (!k) return;
    c.prop(tall ? 'planttall' : 'plant', k.x, k.z, { rot: item.turn, tint: [0.8, 0.66, 0.42], o: { variant: item.seed % 4 } });
  } else if (item.type === 'lamp') {
    const k = c.corner(0.5, undefined, 1.8); if (!k) return;
    c.prop('floorlamp', k.x, k.z, { rot: item.turn });
    c.light(k.x, 1.5, k.z, '#ffca82', 0.55, { k: 1.3, far: 6 });
    c.shining('lampglow', c.kit.tex.blob(), 1.4, lin('#ffca82'), { transparent: true, depthWrite: false }).quad([k.x - 0.2, 1.36, k.z + 0.2], [k.x + 0.2, 1.36, k.z + 0.2], [k.x + 0.2, 1.36, k.z - 0.2], [k.x - 0.2, 1.36, k.z - 0.2]);
  } else if (item.type === 'bin') {
    const k = c.corner(0.45, undefined, 0.8) || c.spot(0.4, { head: 0.8 }); if (!k) return;
    c.prop('bin', k.x, k.z, { rot: item.turn });
    for (let i = 0; i < item.n; i++) { const x = k.x + R.range(-0.7, 0.7), z = k.z + R.range(-0.7, 0.7); if (c.clear(x, z, 0.05)) c.flat.ball(x, 0.035, z, 0.035, [0.9, 0.88, 0.8], 0.8, 5); }
  } else if (item.type === 'wetsign') {
    const s = c.spot(0.4, { head: 0.8 }); if (!s) return;
    wetSign(c, s.x, s.z, item.turn, ['CAUTION', 'WET FLOOR']);
    c.blot(s.x + 0.5, s.z + 0.3, 1.3, 0.9, { rgb: [0.05, 0.04, 0.02], a: 0.35 });
  } else if (item.type === 'papers') {
    const s = c.spot(0.5); if (s) scatter(c, s.x, s.z, item.n + 3, 1.0);
  } else if (item.type === 'stain') {
    const s = c.spot(0.5, { head: 0.5 }); if (!s) return;
    const y = c.ceilAt(s.x, s.z);
    c.blot(s.x, s.z, 1.5, 1.2, { rgb: [0.2, 0.12, 0.03], a: 0.5, y: y - 0.004, down: true });
    c.blot(s.x, s.z, 0.7, 0.6, { rgb: [0.14, 0.08, 0.02], a: 0.5, y: y - 0.005, down: true });
    c.blot(s.x, s.z, 1.1, 1.0, { rgb: [0.03, 0.03, 0.02], a: 0.42 });
    c.flat.box(s.x - 0.13, 0, s.z - 0.13, s.x + 0.13, 0.22, s.z + 0.13, [0.25, 0.4, 0.6]);
    c.flat.box(s.x - 0.11, 0.2, s.z - 0.11, s.x + 0.11, 0.221, s.z + 0.11, [0.12, 0.16, 0.2]);
    c.solid(s.x - 0.13, s.z - 0.13, s.x + 0.13, s.z + 0.13);
    let wait = 1 + R() * 2;
    c.tick((dt, t, me) => { wait -= dt; if (wait < 0 && me.inside) { wait = 1.6 + Math.random() * 2.2; const p = c.toWorld(s.x, s.z); c.env.play('click', p.x, p.z, 3); } });
  } else if (item.type === 'poster') {
    const w = c.wallSpot(1.3); if (!w) return;
    const tex = c.kit.tex.custom('poster' + item.text, 72, 96, (g, tw, th) => {
      P(g, '#101418', 0, 0, tw, th); P(g, '#27506a', 5, 5, tw - 10, 54);
      g.fillStyle = '#e8b33c'; g.beginPath(); g.arc(tw / 2, 40, 13, Math.PI, 0); g.fill(); P(g, '#1a3a4e', 5, 40, tw - 10, 19);
      drawText(g, item.text.length > 12 ? item.text.split(/ (?=[^ ]*$)/) : [item.text], 3, 62, tw - 6, 22, { color: '#f1ead8', size: 9, pad: 2 });
      drawText(g, ['is its own reward'], 3, 84, tw - 6, 8, { color: '#8a93a0', size: 5, pad: 2, weight: 400 });
    }, { clamp: true });
    framed(c, c.mapped('poster' + item.text, tex), w.side, w.at, 1.42, 0.66, 0.88, null, [0.05, 0.05, 0.06]);
  } else if (item.type === 'clock') {
    const w = c.wallSpot(0.8); if (w) c.wallProp('clock', w.side, w.at, { y: 1.72 });
  } else if (item.type === 'frame') {
    const w = c.wallSpot(1.0); if (!w || !c.env.cast.length) return;
    const who = c.env.cast[item.who % c.env.cast.length];
    const tex = c.kit.tex.custom('eotm' + who.name, 64, 84, (g, tw, th) => {
      P(g, '#efe9d8', 0, 0, tw, th); drawPortrait(g, who.look, 6, 14, 52, 52, { bg: '#b9c7c4', creations: c.env.who.creations });
      drawText(g, ['EMPLOYEE OF THE MONTH'], 0, 2, tw, 11, { size: 5, pad: 2 }); drawText(g, [who.name.toUpperCase()], 0, 68, tw, 14, { size: 7, pad: 4 });
    }, { clamp: true });
    framed(c, c.mapped('eotm' + who.name, tex), w.side, w.at, 1.3, 0.5, 0.66);
  } else if (item.type === 'ladder') {
    const s = c.spot(0.6, { head: 1.75 }); if (!s) return;
    const hole = c.hole(s.x, s.z);
    c.prop('ladder', hole.x, hole.z + 0.15, { rot: item.turn, fallback: [0.5, 1.6, 0.5] });
  } else if (item.type === 'coat') {
    const k = c.corner(0.45, undefined, 1.8); if (k) c.prop('coatrack', k.x, k.z, { rot: item.turn, fallback: [0.3, 1.6, 0.3] });
  } else if (item.type === 'fan') {
    const k = c.corner(0.5, undefined, 1.5) || c.spot(0.4, { head: 1.5 }); if (k) c.prop('fan', k.x, k.z, { rot: Math.atan2(-k.x, -k.z), fallback: [0.4, 1.3, 0.4] });
  } else if (item.type === 'tile') {
    const s = c.spot(0.6); if (!s) return;
    const hole = c.hole(s.x, s.z);
    c.lay(c.ceil, hole.x + 0.2, hole.z - 0.1, TILE, TILE, item.turn, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.012);
    c.blot(hole.x + 0.2, hole.z - 0.1, 1.0, 1.0, { a: 0.3 });
    c.flat.box(hole.x - 0.01, hole.y - 0.45, hole.z - 0.01, hole.x + 0.01, hole.y, hole.z + 0.01, [0.05, 0.05, 0.05]);
  } else if (item.type === 'highdoor') {
    const w = c.wallSpot(1.3, undefined, 0.4, 2.5); if (!w) return;
    const p = c.wallAt(w.side, w.at, 0.05), y0 = R.range(0.9, 1.35), y1 = Math.min(y0 + 1.95, c.ceilAt(p.x, p.z) - 0.1);
    if (y1 - y0 > 0.6) wallDoor(c, w.side, w.at, 0.86, y0, y1, lin(R.pick(['#7a5230', '#5a6a7a', '#6a4a3a', '#8a3a34'])));
  } else if (item.type === 'floordoor') floorDoor(c, item);
  else if (item.type === 'ceildoor') ceilDoor(c);
  else if (item.type === 'map') floorPlan(c);
  else if (item.type === 'cabinet' || item.type === 'shelving') {
    // against a wall, backed onto it, the way they always are
    const w = c.wallSpot(item.type === 'cabinet' ? 0.7 : 1.4, undefined, 0.35, 2.1); if (!w) return;
    const p = c.wallAt(w.side, w.at, item.type === 'cabinet' ? 0.32 : 0.3);
    if (!c.clear(p.x, p.z, 0.35)) return;
    c.reserve(p.x, p.z, item.type === 'cabinet' ? 0.45 : 0.75);
    c.prop(item.type, p.x, p.z, { rot: p.rot, fallback: item.type === 'cabinet' ? [0.5, 1.3, 0.6] : [1.2, 1.8, 0.45] });
  } else if (item.type === 'armchair' || item.type === 'globe') {
    const k = c.corner(0.6, undefined, 1.4); if (!k) return;
    c.prop(item.type, k.x, k.z, { rot: Math.atan2(-k.x, -k.z), fallback: [0.7, 0.9, 0.7] });
  }
}

/** A corridor with a waist: two slanted lengths of wall on either side, in front of the real ones. */
function pinchWalls(c, s) {
  const { W, D, H, room } = c, alongZ = s.axis === 'z', len = alongZ ? D : W, wide = (alongZ ? W : D) / 2, trim = lin(c.look.trim);
  const rows = [0, 0.16, 0.7, 1.3, 1.9, H - 0.16, H], n = Math.ceil(len / 0.3);
  for (let i = 0; i < n; i++) {
    const v0 = -len / 2 + (i / n) * len, v1 = -len / 2 + ((i + 1) / n) * len, h0 = pinchHalf(room, v0), h1 = pinchHalf(room, v1);
    if (h0 > wide - 0.004 && h1 > wide - 0.004) continue;
    for (const sx of [-1, 1]) {
      const at = (v, h, y) => (alongZ ? [sx * h, y, v] : [v, y, sx * h]);
      // which end comes first decides which way the quad faces: always into the corridor
      const flip = alongZ ? sx < 0 : sx > 0, a0 = flip ? v1 : v0, a1 = flip ? v0 : v1, ha = flip ? h1 : h0, hb = flip ? h0 : h1;
      for (let k = 0; k + 1 < rows.length; k++) {
        const y0 = rows[k], y1 = rows[k + 1], ao = k === 0 || k === rows.length - 2 ? 0.84 : 1;
        c.wall.quad(at(a0, ha, y0), at(a1, hb, y0), at(a1, hb, y1), at(a0, ha, y1), WHITE, [[a0 / 0.8, y0 / 0.8], [a1 / 0.8, y0 / 0.8], [a1 / 0.8, y1 / 0.8], [a0 / 0.8, y1 / 0.8]], ao);
      }
      const k2 = 0.022;
      c.flat.quad(at(a0, ha - k2, 0), at(a1, hb - k2, 0), at(a1, hb - k2, 0.11), at(a0, ha - k2, 0.11), trim);
    }
  }
}

/** Stairs that climb toward the ceiling and stop: at a door too high to use, at a hole, or at nothing. */
function nowhereStairs(c, s) {
  const { room } = c, wood = lin(c.look.trim).map((v) => Math.min(1, v * 1.5 + 0.05)), trim = lin(c.look.trim), topY = s.n * RISE;
  for (let i = 0; i < s.n; i++) {
    const y = (s.n - i) * RISE;
    c.wbox(s.side, s.c, s.w, 0, y, i * RUN, (i + 1) * RUN, wood, { skip: '-y' });
    c.wbox(s.side, s.c, s.w, y - 0.022, y + 0.002, (i + 1) * RUN - 0.03, (i + 1) * RUN + 0.012, trim);
  }
  for (let k = 0; k <= s.n * RUN + 0.8; k += 0.45) { const p = wallPoint(room, s.side, s.c, k); c.reserve(p.x, p.z, s.w / 2 + 0.3); }
  const top = wallPoint(room, s.side, s.c, 0.05), ceil = c.ceilAt(top.x, top.z);
  if (s.top === 'door' && ceil - topY > 0.5) {
    wallDoor(c, s.side, s.c, Math.min(0.86, s.w - 0.16), topY, Math.min(topY + 1.95, ceil - 0.02), lin('#7a5230'));
    const at = wallPoint(room, s.side, s.c, 0.3), here = c.toWorld(at.x, at.z);
    c.use({ x: at.x, z: at.z, r: 0.9, label: 'try the door', use: () => c.env.play('rattle', here.x, here.z, 4) });
  } else if (s.top === 'hole') for (const k of [0.2, 0.8]) { const p = wallPoint(room, s.side, s.c, k); c.hole(p.x, p.z, 2); }
}

/**
 * A plain room's walls in the room, as the plan has them (gen.js, quiet.js): blocks of wall floor to ceiling, and the
 * pieces of a partition with holes in it — a header over the hole you can crawl through (you go under it: it is not solid,
 * the low headroom under it is the plan's `lows`), and the wall under and over the hole you cannot reach.
 */
function walls(c) {
  for (const p of c.room.pillars) {
    if (p.prop === 'cabana') { poolStanding(c, p); continue; }
    if (p.prop) { standing(c, p); continue; }             // not wall at all: a run of fence, a scenic flat and its brace (suburb.js)
    if (p.y0 > 0.01) c.pillar(p.x, p.z, p.w, p.d, { y0: p.y0, solid: false, skirting: false });
    else c.pillar(p.x, p.z, p.w, p.d, p.h ? { h: p.h, cap: lin(c.look.trim) } : undefined);
  }
}

/** The workstation in the carpet: the office's own desk, chair, monitor, keyboard and mouse, full size, sunk where the plan says. */
function sunken(c) {
  const ok = (c.room.props || []).every((p) => c.hasProp(p.type));
  for (const p of c.room.props || []) {
    if (!ok) break;                                       // (all of it or none: a desk with a crate on it would be a different joke)
    c.prop(p.type, p.x, p.z, { y: p.y, rot: p.rot, solid: false, shadow: false });
  }
  for (const b of c.room.blocks || []) { c.solid(b.x0, b.z0, b.x1, b.z1, { keep: true }); c.reserve((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2 + 0.2); }
  // the carpet dips a little toward it, the way carpet does over something heavy
  for (const b of c.room.blocks || []) c.blot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0 + 0.6, b.z1 - b.z0 + 0.6, { rgb: [0.05, 0.04, 0.02], a: 0.22 });
}

function plain(c) {
  const { room } = c, s = room.shape;
  c.shell();
  walls(c);
  if (room.blocks) sunken(c);
  if (s && s.kind === 'pinch') pinchWalls(c, s);
  if (s && s.kind === 'stairs') nowhereStairs(c, s);
  if (room.sign) c.exitSign(room.doors[room.sign.door], room.sign.text);
  // the wall the plan would have called thin, if this is the room it is in — before anything else is hung on it or stood in front of it
  if (c.level.thin && c.level.thin.room === room.id) thinWall(c, c.level.thin);
  for (const item of room.dress) if (item.type === 'marks') refuses(c, item.side, item.at, marks(c, item));          // (likewise the other walls somebody tried: all of them only walls)
  for (const item of room.dress) if (item.type !== 'marks') dressing(c, item);
  if (c.level.pursuer?.room === room.id) c.env.lair?.(c);
  if (c.level.theme === 'waterpark') poolroom(c);
  if (c.level.theme === 'suburb') lawn(c);
  if (c.level.theme === 'mall') concourse(c);
}

/** Where you land: a hole in the ceiling above you, and the tiles you brought down. */
function start(c) {
  c.reserve(0, 0, 1.1);
  plain(c);
  const hole = c.hole(0, 0, 2);
  for (const [dx, dz, rot] of [[0.35, 0.2, 0.4], [-0.5, -0.3, 1.9], [0.1, -0.75, 2.8]]) c.lay(c.ceil, hole.x + dx, hole.z + dz, TILE, TILE, rot, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.01 + Math.abs(dx) * 0.01);
  c.blot(hole.x, hole.z, 2.2, 2.2, { rgb: [0.3, 0.28, 0.22], a: 0.35 });
  for (const [dx, dz, len] of [[-0.4, 0.3, 0.5], [0.3, -0.2, 0.32], [0.45, 0.45, 0.7]]) c.flat.box(hole.x + dx - 0.008, hole.y - len, hole.z + dz - 0.008, hole.x + dx + 0.008, hole.y, hole.z + dz + 0.008, [0.04, 0.04, 0.04]);
}

/* ---- the deck, part one ------------------------------------------------------------ */

/** Cardboard colleagues that have moved when you look back. */
function cutouts(c) {
  const { W, D, R, params: p } = c;
  c.shell();
  const cast = c.env.cast, people = [];
  const n = Math.min(p.count, Math.max(3, cast.length + (p.self ? 1 : 0)));
  const spots = [];
  if (p.formation === 'queue') { const x = R.range(-W / 4, W / 4); for (let i = 0; i < n; i++) spots.push([x + R.range(-0.06, 0.06), -D / 2 + 1.3 + i * 0.72, Math.PI]); }
  else if (p.formation === 'ring') { const r = Math.min(1.9, Math.min(W, D) / 2 - 1.6), cz = -0.4; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; spots.push([Math.sin(a) * r, cz + Math.cos(a) * r, a + Math.PI]); } }
  else if (p.formation === 'wall') { for (let i = 0; i < n; i++) spots.push([(i - (n - 1) / 2) * 0.82, -D / 2 + 0.5, Math.PI]); }
  else if (p.formation === 'crowd') { const sx = R.pick([-1, 1]); for (let i = 0; i < n; i++) spots.push([sx * (W / 2 - 0.8 - (i % 3) * 0.62), -D / 2 + 0.8 + Math.floor(i / 3) * 0.6, Math.atan2(-sx, 1)]); }
  else for (let i = 0; i < n; i++) { const s = c.spot(0.5, { pad: 0.5 }) || { x: 0, z: 0 }; spots.push([s.x, s.z, R.range(-0.7, 0.7)]); }
  if (p.formation === 'queue') {
    const tex = card(c, 'serving', ['NOW SERVING', '0'], { w: 96, h: 56, bg: '#20242a', fg: '#ff5a3c', size: 16 });
    c.hang(c.shining('serving', tex, 1.5), 'back', spots[0][0], 1.75, 0.8, 0.46);
    c.wbox('back', spots[0][0], 0.86, 1.49, 2.01, 0, 0.01, [0.08, 0.08, 0.09]);
  }
  spots.forEach(([x, z, rot], i) => {
    const self = p.self && i === n - 1;
    const who = self ? { name: c.level.name, look: c.env.who.look } : cast[p.who[i % p.who.length] % cast.length];
    const g = makeCutout(c.kit, (self ? 'self:' : 'who:') + who.name, who.look, { creations: c.env.who.creations, name: who.name });
    c.add(g); c.reserve(x, z, 0.4);
    const k = { g, x, z, rot, unseen: 0, name: who.name, self, i };
    people.push(k);
  });
  const put = (k) => { k.g.position.set(k.x, 0, k.z); k.g.rotation.y = k.rot; k.g.userData.light(c.sample(k.x, 1.0, k.z)); };
  c.after.push(() => people.forEach(put));
  for (let i = 0; i < p.boxes; i++) { const s = c.spot(0.65); if (s) { c.prop('boxes', s.x, s.z, { rot: R.range(0, 6), o: { variant: i }, fallback: [0.8, 0.7, 0.8] }); scatter(c, s.x, s.z, 3); } }
  { const s = c.spot(0.4); if (s) scatter(c, s.x, s.z, p.papers, 1.6); }

  // they only ever move while you are not looking
  const fits = (x, z, k) => Math.abs(x) < W / 2 - 0.35 && Math.abs(z) < D / 2 - 0.35 && people.every((o) => o === k || o.gone || Math.hypot(o.x - x, o.z - z) > 0.55) && (() => { const w = c.toWorld(x, z); return c.world.free(w.x, w.z, 0.2); })();
  let wait = 0, woke = false;
  c.tick((dt, t, me) => {
    wait += dt; if (wait < 0.2) return;
    const step = wait; wait = 0;
    if (!woke) { if (!me.inside) return; woke = true; }
    const tx = clamp(me.x, -W / 2 + 0.5, W / 2 - 0.5), tz = clamp(me.z, -D / 2 + 0.5, D / 2 - 0.5);
    for (const k of people) {
      if (k.gone) continue;
      if (c.seen(k.x, k.z, { radius: 0.55 })) { k.unseen = 0; continue; }
      k.unseen += step;
      if (k.unseen < 0.5) continue;
      if (k.i === 0 && p.follower && !me.inside && c.env.adopt?.(c, k)) { k.gone = true; continue; }
      const dx = tx - k.x, dz = tz - k.z, d = Math.hypot(dx, dz) || 1, keep = me.inside ? 1.35 : 0.4 + (k.i % 3) * 0.5;
      let moved = false;
      if (d > keep + 0.08) {
        const s = Math.min(0.3, d - keep);
        for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
          const cs = Math.cos(turn), sn = Math.sin(turn), nx = k.x + ((dx * cs - dz * sn) / d) * s, nz = k.z + ((dx * sn + dz * cs) / d) * s;
          if (fits(nx, nz, k)) { k.x = nx; k.z = nz; moved = true; break; }
        }
      }
      const face = Math.atan2(me.x - k.x, me.z - k.z);
      if (moved || Math.abs(turnTo(k.rot, face)) > 0.1) {
        k.rot = face; put(k);
        if (moved && Math.random() < 0.45) { const w = c.toWorld(k.x, k.z); c.env.play('shuffle', w.x, w.z, 4); }
      }
    }
  });
}

/** A meeting, table and chairs and all, bolted to the ceiling. */
function ceilingMeeting(c) {
  const { W, D, H, R, params: p } = c;
  c.shell();
  const long = W >= D, cx = R.range(-0.4, 0.4), cz = R.range(-0.5, 0.2);
  const table = c.prop('hottable', cx, cz, { flip: true, y: H, rot: long ? 0 : Math.PI / 2, fallback: [2.4, 0.75, 0.9] });
  const per = Math.ceil(p.chairs / 2), under = H - 0.76;
  for (let i = 0; i < p.chairs; i++) {
    const row = i < per ? -1 : 1, k = (i % per) - (per - 1) / 2, along = k * (2.1 / Math.max(1, per - 0.4)), out = row * 0.78;
    const x = cx + (long ? along : out), z = cz + (long ? out : along);
    c.prop('chair', x, z, { flip: true, y: H, rot: (long ? (row > 0 ? Math.PI : 0) : (row > 0 ? -Math.PI / 2 : Math.PI / 2)) + R.range(-0.12, 0.12), o: { color: p.color } });
  }
  // what was on the table still is
  const paper = c.mapped('paper', c.kit.tex.paper());
  for (let i = 0; i < 5; i++) c.lay(paper, cx + R.range(-0.9, 0.9) * (long ? 1 : 0.3), cz + R.range(-0.9, 0.9) * (long ? 0.3 : 1), 0.21, 0.297, R.range(0, 6), null, WHITE, under - 0.004, true);
  for (let i = 0; i < p.mugs; i++) c.model('mug' + (i % 2), mugVox(i % 2 ? '#cf6b4b' : '#e8e2d0'), cx + R.range(-0.95, 0.95) * (long ? 1 : 0.3), cz + R.range(-0.95, 0.95) * (long ? 0.3 : 1), { flip: true, y: under, rot: R.range(0, 6), solid: false, shadow: false });
  // the agenda, on a board that is also the wrong way up
  const tex = card(c, 'agenda' + c.room.id, ['AGENDA', ...p.agenda.map((t, i) => `${i + 1}. ${t}`)], { w: 160, h: 96, bg: '#f3f1e8', fg: '#23262e', size: 11, pad: 12, weight: 600 });
  const spot = c.wallSpot(2.2, ['back', 'left', 'right'], 0.5);
  if (spot) {
    c.wbox(spot.side, spot.at, 1.92, H - 1.52, H - 0.3, 0, 0.03, [0.55, 0.57, 0.6]);
    c.hang(c.mapped('agenda', tex), spot.side, spot.at, H - 0.91, 1.8, 1.08, [[1, 1], [0, 1], [0, 0], [1, 0]], WHITE, 0.034);
    c.wbox(spot.side, spot.at, 1.2, H - 0.3, H - 0.26, 0, 0.08, [0.45, 0.47, 0.5]);
  }
  if (p.stray) { c.reserve(cx + 0.3, cz + 0.2, 0.5); c.prop('chair', cx + 0.3, cz + 0.2, { rot: R.range(0, 6), o: { color: p.color } }); c.paper(cx - 0.4, cz + 0.5); }
  return table;
}

/** A corridor of water coolers that goes on rather longer than the building does. Exactly one is bubbling. */
function coolers(c) {
  const { W, D, H, R, params: p } = c, kit = c.kit;
  const lit0 = D / 2 - 5.4, fade = (z) => clamp((z - (lit0 - 3.6)) / 3.6, 0, 1) ** 1.5;
  // a hand-made shell: everything past the lit end sinks into black, so the far wall is never seen
  c.shell({ walls: ['front'], floor: false, ceiling: false, panels: false, sockets: false });
  const zs = []; for (let z = -D / 2; z < D / 2; z += 0.6) zs.push(z + D / 2); zs.push(D);
  const xs = [0, 0.16, W / 2, W - 0.16, W];
  c.floor.grid([-W / 2, 0, -D / 2], [0, 0, 1], [1, 0, 0], zs, xs, (u, v) => [(v + c.room.cx) / 1.6, (u + c.room.cz) / 1.6], WHITE, (u, v) => fade(u - D / 2) * (v < 0.2 || v > W - 0.2 ? 0.78 : 1));
  c.ceil.grid([-W / 2, H, -D / 2], [1, 0, 0], [0, 0, 1], xs, zs, (u, v) => [(u - W / 2) / TILE, (v - D / 2) / TILE], WHITE, (u, v) => fade(v - D / 2));
  const hs = [0, 0.16, 0.9, 1.7, H - 0.16, H];
  c.wall.grid([-W / 2, 0, D / 2], [0, 0, -1], [0, 1, 0], zs, hs, (u, v) => [u / 0.8, v / 0.8], WHITE, (u, v) => fade(D / 2 - u) * (v < 0.2 || v > H - 0.2 ? 0.82 : 1));
  c.wall.grid([W / 2, 0, -D / 2], [0, 0, 1], [0, 1, 0], zs, hs, (u, v) => [u / 0.8, v / 0.8], WHITE, (u, v) => fade(u - D / 2) * (v < 0.2 || v > H - 0.2 ? 0.82 : 1));
  const trim = lin(c.look.trim);
  for (let z = lit0 - 3.6; z < D / 2; z += 1.2) for (const sx of [-1, 1]) c.flat.box(sx > 0 ? W / 2 - 0.022 : -W / 2, 0, z, sx > 0 ? W / 2 : -W / 2 + 0.022, 0.11, Math.min(D / 2, z + 1.2), trim.map((v) => v * fade(z + 0.6)), { skip: '-y' });
  const tube = lin(c.look.tube), on = c.shining('panel', kit.tex.panel(true), 2.5, tube), dead = c.mapped('dead', kit.tex.panel(false));
  for (let z = D / 2 - 1.2, i = 0; z > -D / 2 + 1; z -= 2.4, i++) {
    const o = [-TILE / 2, H - 0.006, z - TILE], uv = (u, v) => [u / TILE, v / (TILE * 2)];
    if (z > lit0) { on.grid(o, [1, 0, 0], [0, 0, 1], [0, TILE], [0, TILE * 2], uv); c.light(0, H - 0.14, z, tube, 1.1, { axis: [0, -1, 0], floor: 0.24, k: 3.4, far: 6.5 }); }
    else dead.grid(o, [1, 0, 0], [0, 0, 1], [0, TILE], [0, TILE * 2], uv, WHITE, () => fade(z));
  }
  c.rt.noTorch = true;
  // the coolers
  const rows = p.both ? [-1, 1] : [R.pick([-1, 1])];
  const first = D / 2 - 1.5, list = [];
  for (const sx of rows) for (let z = first, i = 0; z > -D / 2 + 0.6; z -= p.spacing, i++) {
    const k = fade(z);
    const foot = c.prop('cooler', sx * (W / 2 - 0.3), z, { rot: sx > 0 ? -Math.PI / 2 : Math.PI / 2, tint: [k, k, k], noGlow: k < 0.9, shadow: k > 0.4 ? 0.4 : false, fallback: [0.45, 1.1, 0.45] });
    if (z > lit0 - 1 && sx === rows[0]) list.push({ x: sx * (W / 2 - 0.3), z, i, foot });
  }
  const live = list[Math.min(list.length - 1, p.bubbling)];
  // the one that works: bubbles climbing the bottle, a glug now and then
  const bubbles = [];
  if (live) {
    const mat = kit.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })), geo = kit.own(new THREE.SphereGeometry(0.016, 6, 5));
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(geo, mat); b.userData = { t: i / 5, a: i * 2.1 }; c.add(b); bubbles.push(b); }
    mat.color.setRGB(1.6, 1.8, 2.0);
    let glug = 2;
    c.tick((dt, t, me) => {
      for (const b of bubbles) { b.userData.t = (b.userData.t + dt * 0.55) % 1; const u = b.userData; b.position.set(live.x + Math.cos(u.a + t) * 0.05, 0.8 + u.t * 0.3, live.z + Math.sin(u.a * 1.7 + t) * 0.05); b.scale.setScalar(0.6 + u.t * 0.7); }
      glug -= dt;
      if (glug < 0 && me.inside) { glug = 2.5 + Math.random() * 3; const w = c.toWorld(live.x, live.z); c.env.play('glug', w.x, w.z, 4); }
    });
    c.flat.box(live.x * 0.72 - 0.03, 0, live.z + 0.2, live.x * 0.72 + 0.03, 0.07, live.z + 0.26, [0.92, 0.9, 0.84]);
    // every cup you take ends up on the carpet with the others
    const cups = [], cupGeo = kit.own(new THREE.CylinderGeometry(0.034, 0.024, 0.075, 8)), cupMat = kit.own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    c.after.push(() => { const L = c.sample(live.x * 0.6, 0.1, live.z); cupMat.color.setRGB(0.93 * L[0], 0.91 * L[1], 0.85 * L[2]); });
    c.use({ x: live.x * 0.8, z: live.z, r: 1.2, label: 'take a cup of water', use: () => {
      const w = c.toWorld(live.x, live.z); c.env.play('glug', w.x, w.z, 4);
      if (cups.length >= 14) return;
      const cup = new THREE.Mesh(cupGeo, cupMat), n = cups.length, tipped = n % 4 === 3;
      cup.position.set(live.x * 0.62 - Math.sign(live.x) * (n % 3) * 0.085, tipped ? 0.03 : 0.038, live.z + 0.3 + Math.floor(n / 3) * 0.085);
      if (tipped) cup.rotation.z = Math.PI / 2;
      c.add(cup); cups.push(cup);
    } });
  }
  // walk into the dark for as long as you like: the corridor is patient
  c.zone({ x0: -W / 2, x1: W / 2, z0: -D / 2, z1: lit0 - 6.2, stay: (dt, me) => {
    if (Math.cos(me.yaw) < 0.25) return;                                   // only while you face the dark: nothing may be seen to jump
    const w = c.toWorld(me.x, me.z + 2.4), pl = c.env.player;
    if (c.world.free(w.x, w.z, 0.22)) pl.warp(w.x, w.z);
  } });
}

/** A party for you. It has been ready for some time. */
function party(c) {
  const { W, D, H, R, params: p } = c, kit = c.kit;
  c.shell();
  const cols = p.flags.map((h) => lin(h));
  // the banner
  const tex = kit.tex.custom('banner' + c.room.id, 320, 72, (g, w, h) => {
    P(g, '#f4efe0', 0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = p.flags[(x / 16) % p.flags.length]; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, 9); g.fill(); }
    drawText(g, [p.banner[0]], 0, 10, w, 36, { color: '#c0392b', size: 30, pad: 14 }); drawText(g, [p.banner[1]], 0, 46, w, 22, { color: '#2a3a5a', size: 15, pad: 20 });
  }, { clamp: true });
  const bw = Math.min(W - 1.6, 4.6);
  c.hang(c.mapped('banner', tex), 'back', 0, 1.82, bw, bw * 72 / 320, null, WHITE, 0.02);
  // bunting, sagging between pins, round the three walls that have room for it
  for (const side of ['back', 'left', 'right']) {
    for (const [a, b] of c.spans(side, 0.2)) {
      const n = Math.max(2, Math.round((b - a) / 0.26));
      for (let i = 0; i < n; i++) {
        const at = a + (i + 0.5) * ((b - a) / n), sag = Math.sin((i + 0.5) / n * Math.PI) * 0.16, y = (side === 'back' ? 2.42 : 2.3) - sag;
        const p0 = c.wallAt(side, at - 0.1, 0.02), p1 = c.wallAt(side, at + 0.1, 0.02), pm = c.wallAt(side, at, 0.03);
        c.flat.tri([p0.x, y, p0.z], [pm.x, y - 0.25, pm.z], [p1.x, y, p1.z], cols[i % cols.length]);
      }
    }
  }
  // the table: a cake, plates, cups, and chairs pushed in
  const tz = -0.3, top = c.prop('hottable', 0, tz, { fallback: [2.4, 0.75, 0.9] }).top;
  c.model('cake' + p.candles, () => {
    const v = new Vox(), cream = M('#f3e7d3', 1), pink = M('#e8a0b4', 1);
    v.cyl('y', 0, 0, 0, 1, 12, M('#e8e2d0', 0)); v.cyl('y', 0, 0, 1, 7, 9, cream); v.cyl('y', 0, 0, 7, 8, 9, pink); v.cyl('y', 0, 0, 8, 13, 6, cream); v.cyl('y', 0, 0, 13, 14, 6, pink);
    for (let a = 0; a < 12; a++) v.box(Math.round(Math.cos(a * 0.52) * 8.4), 4 + (a % 2), Math.round(Math.sin(a * 0.52) * 8.4), Math.round(Math.cos(a * 0.52) * 8.4) + 1, 7, Math.round(Math.sin(a * 0.52) * 8.4) + 1, pink);
    const n = Math.min(p.candles, 9);
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, x = Math.round(Math.cos(a) * 4), z = Math.round(Math.sin(a) * 4); v.box(x, 14, z, x + 1, 18, z + 1, M(i % 2 ? '#7ab8ff' : '#f0d24b', 0)); }
    return v;
  }, 0, tz, { y: top, solid: false, shadow: false });
  const topper = card(c, 'cake' + p.cake, [p.cake], { w: 64, h: 24, bg: '#fff7e6', fg: '#c0392b', edge: '#e8a0b4', size: 14 });
  c.board(c.mapped('topper', topper, { side: THREE.DoubleSide }), 0, top + 0.47, tz, 0.3, 0.11, 0);
  c.flat.box(-0.005, top + 0.3, tz - 0.005, 0.005, top + 0.42, tz + 0.005, [0.7, 0.6, 0.4]);
  const plate = () => { const v = new Vox(); v.cyl('y', 0, 0, 0, 1, 4, M('#f4f1e6', 0)); return v; };
  const cup = (col) => () => { const v = new Vox(); v.cyl('y', 0, 0, 0, 4, 1.6, M(col, 0), 2.2); return v; };
  for (let i = 0; i < p.chairs; i++) {
    const row = i % 2 ? 1 : -1, x = (Math.floor(i / 2) - (Math.ceil(p.chairs / 2) - 1) / 2) * 0.72;
    c.prop('chair', x, tz + row * 0.85, { rot: (row > 0 ? Math.PI : 0) + R.range(-0.1, 0.1), o: { color: '#4a7a6a' } });
    c.model('plate', plate, x, tz + row * 0.26, { y: top, solid: false, shadow: false });
    c.model('cup' + (i % 3), cup(p.flags[i % p.flags.length]), x + 0.2, tz + row * 0.3, { y: top, solid: false, shadow: false });
    if (p.hats && i % 2 === 0) c.model('hat' + (i % 3), () => { const v = new Vox(); v.cyl('y', 0, 0, 0, 9, 3.4, M(p.flags[i % p.flags.length], 1), 0.3); v.sphere(0, 9, 0, 1, M('#ffffff', 1)); return v; }, x + R.range(-0.08, 0.08), tz + row * 0.86, { y: 0.41, solid: false, shadow: false, tilt: [R.range(-0.3, 0.3), R.range(-0.3, 0.3)] });
  }
  // balloons: most have reached the ceiling, a couple have given up
  for (let i = 0; i < p.balloons; i++) {
    const s = c.spot(0.25, { pad: 0.3 }) || { x: R.range(-2, 2), z: R.range(-2, 2) }, col = cols[i % cols.length], down = i < 2;
    if (down) { c.flat.ball(s.x, 0.09, s.z, 0.15, col.map((v) => v * 0.8), 0.6); c.shadow(s.x, s.z, 0.2, 0.2, 0.3); }
    else { const y = H - 0.19 - (i % 3) * 0.01; c.flat.ball(s.x, y, s.z, 0.17, col, 1.12); c.flat.box(s.x - 0.004, y - 0.19 - 0.8, s.z - 0.004, s.x + 0.004, y - 0.19, s.z + 0.004, [0.85, 0.85, 0.8]); }
  }
  for (let i = 0; i < 70; i++) { const x = R.range(-W / 2 + 0.3, W / 2 - 0.3), z = R.range(-D / 2 + 0.3, D / 2 - 0.3), a = R.range(0, 3); c.flat.quad([x, 0.007, z], [x + Math.cos(a) * 0.035, 0.007, z + Math.sin(a) * 0.035], [x + Math.cos(a) * 0.035 - Math.sin(a) * 0.02, 0.007, z + Math.sin(a) * 0.035 + Math.cos(a) * 0.02], [x - Math.sin(a) * 0.02, 0.007, z + Math.cos(a) * 0.02], cols[i % cols.length]); }
  // a guest or two, in a paper hat, who were not facing that way a moment ago
  p.guests.forEach((idx, i) => {
    const who = c.env.cast[idx % c.env.cast.length]; if (!who) return;
    const x = (i ? 1 : -1) * 1.75, z = tz + R.range(-0.5, 0.6);
    if (!c.clear(x, z, 0.4)) return;
    c.reserve(x, z, 0.45);
    standee(c, 'party:' + who.name, { ...who.look, accessory: 'partyhat' }, x, z, Math.atan2(-x, 1));
  });
}

/** A room of doors. Each has a status. One of them is OK. */
function manyDoors(c) {
  const { params: p } = c, kit = c.kit;
  c.shell({ sockets: false });
  const tone = lin(p.color), DW = 0.9, DH = 2.02;
  const real = c.room.doors.find((d) => d.door) || null;
  const plates = atlas(kit, 'codes' + c.room.id, 80, 34, p.codes.length + 1, (g, i, w, h) => {
    const it = i === p.codes.length ? { code: '200', words: 'OK' } : p.codes[i];
    P(g, '#1c1f24', 0, 0, w, h); P(g, '#c8b98a', 1, 1, w - 2, h - 2); P(g, '#1c1f24', 2, 2, w - 4, h - 4);
    drawText(g, [it.code], 2, 2, w - 4, 19, { color: '#f0e2b0', size: 17, pad: 4 });
    drawText(g, [it.words], 2, 20, w - 4, 11, { color: '#c8b98a', size: 8, pad: 4 });
  });
  const plateB = c.mapped('codes', plates.texture);
  let n = 0;
  for (const side of ['back', 'left', 'right']) {
    const len = side === 'back' ? c.W : c.D;
    for (let i = 0; i < p.per; i++, n++) {
      const at = -len / 2 + (i + 0.5) * (len / p.per), isReal = real && side === real.side && Math.abs(at - real.c) < 0.05;
      const code = p.codes[n % p.codes.length];
      doorFrame(c, side, at, DW, DH);
      const pt = c.wallAt(side, at, 0.3);
      c.hang(plateB, side, at, DH + 0.24, 0.6, 0.255, plates.uv(isReal ? p.codes.length : n % p.codes.length), WHITE, 0.012);
      if (!isReal) {
        const fake = new Batch(true), right = n % 2 === 1;
        doorLeaf(c, side, at, DW - 0.02, DH - 0.01, tone.map((v) => v * (0.9 + (n % 3) * 0.06)), { batch: fake, hinge: right ? 'right' : 'left' });
        const pin = c.wallAt(side, at + (right ? 1 : -1) * (DW / 2 - 0.01), 0.03), node = c.dynamic(fake, { pivot: [pin.x, 0, pin.z] });
        let rattle = 0;
        c.use({ x: pt.x, z: pt.z, r: 1.2, label: `try door ${code.code}`, use: () => { rattle = 0.45; const w = c.toWorld(pt.x, pt.z); c.env.play('rattle', w.x, w.z, 4); } });
        c.tick((dt, t) => { if (rattle <= 0) return; rattle -= dt; node.rotation.y = rattle > 0 ? Math.sin(t * 46) * 0.022 * (rattle / 0.45) * (right ? 1 : -1) : 0; });
        continue;
      }
      // the real one: a leaf that swings, light under it, and a doorway behind
      const leaf = new Batch(true);
      doorLeaf(c, side, at, DW - 0.02, DH - 0.01, tone, { batch: leaf, hinge: 'left' });
      const hinge = c.wallAt(side, at - DW / 2 + 0.01, 0.03);
      const door = c.dynamic(leaf, { pivot: [hinge.x, 0, hinge.z] });
      const a = c.wallAt(side, at - DW / 2, -0.02), b = c.wallAt(side, at + DW / 2, 0.06);
      const bar = c.solid(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), { tall: true, keep: true });
      c.hang(c.shining('underdoor', kit.tex.white(), 1.5, lin(c.world.rooms[real.to].def.look.tube)), side, at, 0.012, DW - 0.06, 0.02, null, WHITE, 0.06);
      let open = 0;
      c.use({ x: pt.x, z: pt.z, r: 1.3, label: 'try door 200', when: () => !open, use: () => { open = 0.0001; bar.on = false; c.world.openLink(real.link); c.env.sound.play('door'); } });
      c.tick((dt) => { if (!open || open >= 1) return; open = Math.min(1, open + dt / 0.8); door.rotation.y = -1.7 * open * open * (3 - 2 * open); });
    }
  }
  // a sign, hanging in the middle of the room, that is no help
  const tex = card(c, 'correct', ['PLEASE USE', 'THE CORRECT DOOR'], { w: 128, h: 40, bg: '#20242a', fg: '#f0e2b0', size: 12 });
  const sign = c.mapped('correct', tex, { side: THREE.DoubleSide });
  c.board(sign, 0, 2.2, 0.4, 1.3, 0.4, 0);
  for (const x of [-0.5, 0.5]) c.flat.box(x - 0.006, 2.4, 0.394, x + 0.006, c.H, 0.406, [0.2, 0.2, 0.2]);
}

/** A corridor of framed colleagues, every one of them employee of the same month. */
function hallOfFame(c) {
  const { W, D, params: p } = c, kit = c.kit, cast = c.env.cast;
  c.shell({ sockets: false });
  const n = p.frames.length, wood = lin(p.wood);
  const faces = atlas(kit, 'fame' + c.room.id, 52, 52, n * 2 + 2, (g, i, w, h) => {
    const bg = ['#b9c7c4', '#c9bfa8', '#aab4c8', '#c8b4b4'][Math.floor(i / 2) % 4];
    if (i < n * 2) { const who = cast[p.order[p.frames[Math.floor(i / 2)].who % p.order.length] % cast.length]; drawPortrait(g, who.look, 0, 0, w, h, { bg, blink: i % 2 === 1, creations: c.env.who.creations }); }
    else if (i === n * 2) { if (p.last === 'empty') P(g, '#d9d0b8', 0, 0, w, h); else drawPortrait(g, c.env.who.look, 0, 0, w, h, { bg: '#b9c7c4', back: p.last === 'mirror', creations: c.env.who.creations }); }
    else P(g, '#d9d0b8', 0, 0, w, h);
  });
  const plates = atlas(kit, 'fameplate' + c.room.id, 96, 26, n + 1, (g, i, w, h) => {
    P(g, '#8a6f2c', 0, 0, w, h); P(g, '#d6b65a', 1, 1, w - 2, h - 2);
    const name = i < n ? cast[p.order[p.frames[i].who % p.order.length] % cast.length].name : c.level.name;
    drawText(g, [name.toUpperCase(), i < n ? p.frames[i].plate : p.last === 'empty' ? 'next month' : p.last === 'mirror' ? 'for looking' : 'for leaning'], 0, 1, w, h - 2, { color: '#3a2c08', size: 9, pad: 6, leading: 1.15 });
  });
  const head = card(c, 'month' + p.month, ['EMPLOYEE OF THE MONTH', p.month], { w: 112, h: 24, bg: c.look.wall, fg: '#3a2c08', size: 8, pad: 4 });
  const faceB = c.mapped('fame', faces.texture), plateB = c.mapped('fameplate', plates.texture), headB = c.mapped('month', head);
  const step = (D - 2.2) / Math.ceil((n + 1) / 2), list = [];
  for (let i = 0; i <= n; i++) {
    const side = i % 2 ? 'right' : 'left', at = D / 2 - 1.4 - Math.floor(i / 2) * step - (i % 2 ? step / 2 : 0);
    if (at < -D / 2 + 0.6) continue;
    const pt = c.wallAt(side, at, 0.3);
    c.wbox(side, at, 0.6, 1.02, 1.62, 0, 0.024, wood);
    const eyes = [];
    if (i < n) for (const blink of [0, 1]) {            // each portrait twice, eyes open and shut; only one shows
      const b = new Batch(); c.hang(b, side, at, 1.32, 0.52, 0.52, faces.uv(i * 2 + blink), WHITE, 0.028 + blink * 0.001);
      const m = c.dynamic(b, { map: faces.texture }); m.visible = !blink; eyes.push(m);
    } else c.hang(faceB, side, at, 1.32, 0.52, 0.52, faces.uv(n * 2), WHITE, 0.028);
    c.hang(plateB, side, at, 0.9, 0.5, 0.135, plates.uv(i), WHITE, 0.012);
    c.hang(headB, side, at, 1.74, 0.56, 0.12, null, WHITE, 0.012);
    const name = i < n ? cast[p.order[p.frames[i].who % p.order.length] % cast.length].name : c.level.name;
    const k = { x: pt.x, z: pt.z, at, eyes, passed: false, shut: false };
    list.push(k);
  }
  // walk past a portrait, and behind your back it closes its eyes
  c.tick((dt, t, me) => {
    for (const k of list) {
      if (!k.eyes.length) continue;
      if (me.inside && me.z < k.at - 0.8) k.passed = true;
      if (!me.inside) k.passed = false;
      const want = k.passed;
      if (want !== k.shut && !c.seen(k.x, k.z, { radius: 0.5 })) { k.shut = want; k.eyes[0].visible = !want; k.eyes[1].visible = want; }
    }
  });
  if (W > 3) c.prop('pedestal', 0, -D / 2 + (c.room.doors.some((d) => d.side === 'back') ? 2.2 : 0.7), { fallback: [0.5, 0.9, 0.5] });
}

const exit = stairwell;                               // the fire exit, and on the last floor the way out (stairwell.js)
export const BUILDERS = { plain, start, exit, cutouts, 'ceiling-meeting': ceilingMeeting, coolers, party, 'many-doors': manyDoors, 'hall-of-fame': hallOfFame, ...MORE };
