// The Backrooms — the rooms, part four: scenes somebody set up and then left.
// A museum of ordinary office things behind ropes, a team photo with one
// place kept free, and a meeting room that has another meeting room in it.
// Like the party, they explain themselves with objects and signs or not at all.
import { Vox, M } from '../vox/vox.js';
import { lin, drawText, WHITE } from './kit.js';
import { headAt } from './gen.js';
import { P, card, framed, standee, mugVox } from './bits.js';
import { clip, previewing } from './clipping.js';
import { uplit } from './floorlight.js';

/* ---- the museum --------------------------------------------------------------------- */

const FLOOR_PIECES = new Set(['chair', 'plant', 'planttall', 'floorlamp', 'bin', 'cabinet']);
const staplerVox = () => { const v = new Vox(), red = M('#b5342c', 0); v.box(-5, 0, -1, 5, 1, 2, M('#2a2a2e', 0)); v.box(-5, 1, -1, 4, 3, 2, red); v.box(-5, 3, -1, -3, 4, 2, red); v.box(3, 1, -1, 5, 2, 2, M('#8d949c', 0)); return v; };

/** Ordinary things, on plinths, behind ropes, with labels. */
function museum(c) {
  const { W, D, R, params: p, kit } = c;
  const up = uplit(c);                               // (preview, &preview=floorlight: null without it, and the room is as it always was)
  c.shell(up?.shell);
  const rope = lin(p.rope), brass = [0.74, 0.6, 0.28], white = [0.88, 0.86, 0.8];
  const wing = kit.tex.custom('wing' + c.room.id, 256, 60, (g) => {
    P(g, '#25221e', 0, 0, 256, 60); P(g, '#c9a24a', 3, 3, 250, 1); P(g, '#c9a24a', 3, 56, 250, 1);
    drawText(g, [p.wing], 0, 6, 256, 30, { color: '#eadfbd', size: 22, pad: 16 }); drawText(g, ['PERMANENT COLLECTION  ·  PLEASE DO NOT TOUCH'], 0, 36, 256, 16, { color: '#b9ad8a', size: 8, weight: 400 });
  }, { clamp: true });
  const where = c.wallSpot(3.0, ['back'], 0.3, 2.4) || c.wallSpot(3.0, ['left', 'right'], 0.3, 2.4);
  if (where) framed(c, c.mapped('wing', wing), where.side, where.at, 2.08, 2.7, 2.7 * 60 / 256, null, [0.16, 0.12, 0.08]);

  const q = 0.82;                                             // half the side of a roped square
  const slots = [[-W / 2 + 1.55, -D / 2 + 1.6], [W / 2 - 1.55, -D / 2 + 1.6], [-W / 2 + 1.55, 0.9], [W / 2 - 1.55, 0.9], [0, -D / 2 + 1.6], [0, 0.4]].filter(([x, z]) => c.clear(x, z, q + 0.1));
  slots.slice(0, p.items.length).forEach(([x, z], i) => {
    const e = p.items[i], onFloor = FLOOR_PIECES.has(e.type);
    c.reserve(x, z, q + 0.3);
    let top = 0.1;
    if (onFloor || !c.hasProp('pedestal')) { top = onFloor ? 0.1 : 0.9; const s = onFloor ? 0.52 : 0.25; c.flat.box(x - s, 0, z - s, x + s, top, z + s, white, { skip: '-y' }); c.shadow(x, z, s * 2, s * 2, 0.4); }
    else top = c.prop('pedestal', x, z, { solid: false }).top;
    const on = { y: top, solid: false, shadow: false, rot: R.range(-0.6, 0.6) };
    if (e.type === 'mug') c.model('mug', mugVox(), x, z, on);
    else if (e.type === 'stapler') c.model('stapler', staplerVox, x, z, on);
    else if (e.type === 'paper') c.lay(c.mapped('paper', kit.tex.paper()), x, z, 0.21, 0.297, 0.4, null, WHITE, top + 0.004);
    else if (e.type !== 'empty') { const it = c.prop(e.type, x, z, { ...on, o: { color: '#4a7a6a' } }); if (up) up.stands(it); }
    if (up) up.stands({ x0: x - 0.25, z0: z - 0.25, x1: x + 0.25, z1: z + 0.25, y0: 0, y1: top });
    // four posts and the rope that sags between them
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = x + sx * q, pz = z + sz * q;
      c.flat.box(px - 0.018, 0, pz - 0.018, px + 0.018, 0.9, pz + 0.018, brass, { skip: '-y' }); c.flat.box(px - 0.09, 0, pz - 0.09, px + 0.09, 0.02, pz + 0.09, brass, { skip: '-y' });
      c.flat.ball(px, 0.93, pz, 0.04, brass, 1, 6);
    }
    for (const [ax, az, bx, bz] of [[-q, -q, q, -q], [q, -q, q, q], [q, q, -q, q], [-q, q, -q, -q]]) for (let k = 0; k < 4; k++) {
      const t0 = k / 4, t1 = (k + 1) / 4, y = 0.84 - Math.sin((k + 0.5) / 4 * Math.PI) * 0.1;
      const x0 = x + ax + (bx - ax) * t0, x1 = x + ax + (bx - ax) * t1, z0 = z + az + (bz - az) * t0, z1 = z + az + (bz - az) * t1;
      c.flat.box(Math.min(x0, x1) - 0.014, y - 0.014, Math.min(z0, z1) - 0.014, Math.max(x0, x1) + 0.014, y + 0.014, Math.max(z0, z1) + 0.014, rope);
    }
    c.solid(x - q, z - q, x + q, z + q);
    // its label, on a little stand of its own
    const tex = kit.tex.custom(`label${c.room.id}:${i}`, 128, 64, (g) => {
      P(g, '#f4f0e2', 0, 0, 128, 64); P(g, '#b9ad8a', 0, 0, 128, 2);
      drawText(g, [e.title], 0, 6, 128, 28, { size: 17, pad: 10 }); drawText(g, [e.note], 0, 36, 128, 20, { size: 9, weight: 400, pad: 10, color: '#4a4436' });
    }, { clamp: true });
    const lz = z + q + 0.16;
    c.board(c.mapped(`label${i}`, tex), x, 0.66, lz + 0.012, 0.42, 0.21, 0);
    c.flat.box(x - 0.22, 0.545, lz - 0.012, x + 0.22, 0.775, lz + 0.011, [0.12, 0.11, 0.1]);
    c.flat.box(x - 0.015, 0, lz - 0.015, x + 0.015, 0.55, lz + 0.01, brass, { skip: '-y' });
    // (preview, &preview=floorlight: its light comes up at it from a can let into the floor inside the rope, in front)
    if (up) up.spot(x, z + 0.66, { tube: '#ffe2b0', light: { power: 0.55, k: 1.5, far: 4.5, floor: 0.2 } });
    else c.light(x, 2.25, z + 0.3, '#ffe2b0', 0.4, { k: 1.5, far: 4.5, axis: [0, -1, 0], floor: 0.2 });
  });
  // (preview: the room's tubes in the floor, wherever they miss the roped squares)
  if (up) { up.panels(slots.slice(0, p.items.length).map(([x, z]) => ({ x0: x - q - 0.1, z0: z - q - 0.1, x1: x + q + 0.1, z1: z + q + 0.4 }))); up.done(); }
}

/* ---- the team photo ----------------------------------------------------------------- */

const tripodVox = () => {
  const v = new Vox(), dark = M('#26262b', 0), steel = M('#8d949c', 0);
  for (const [x, z] of [[-12, 9], [12, 9], [0, -14]]) v.tube(0, 42, 0, x, 0, z, 0.9, steel);
  v.box(-1, 40, -1, 1, 46, 1, steel);
  v.box(-5, 46, -5, 5, 54, 5, dark); v.cyl('z', 0, 50, 5, 10, 3, dark); v.cyl('z', 0, 50, 10, 11, 2.2, M('#3f6f9a', 0));
  v.box(-3, 54, -1, 3, 58, 3, M('#e9e6da', 0)); v.box(3, 49, 5, 5, 51, 6, M('#d8281c', 0, { glow: true }));
  return v;
};

/** Everybody lined up against a backdrop, a camera on a tripod, and a cross of tape where you are meant to stand. */
function photo(c) {
  const { W, D, params: p, kit } = c, cast = c.env.cast;
  c.shell();
  const zb = -D / 2, drop = lin(p.drop);
  // the backdrop: a roll of painted paper down the wall and out across the carpet
  const cloth = kit.tex.custom('drop' + p.drop, 64, 64, (g) => { P(g, '#ffffff', 0, 0, 64, 64); for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.08)`; g.beginPath(); g.ellipse((i * 37) % 64, (i * 23) % 64, 14, 9, i, 0, 7); g.fill(); } });
  const dw = Math.min(4.4, W - 2.4);
  c.hang(c.mapped('drop', cloth), 'back', 0, 1.2, dw, 2.4, [[0, 0], [2, 0], [2, 1.2], [0, 1.2]], drop, 0.03);
  c.lay(c.mapped('drop', cloth), 0, zb + 0.9, dw, 1.8, 0, [[0, 0], [2, 0], [2, 0.9], [0, 0.9]], drop.map((v) => v * 0.9), 0.009);
  for (const sx of [-1, 1]) { c.flat.box(sx * (dw / 2 + 0.06) - 0.02, 0, zb + 0.05, sx * (dw / 2 + 0.06) + 0.02, 2.46, zb + 0.09, [0.2, 0.2, 0.22], { skip: '-y' }); c.flat.box(sx * (dw / 2 + 0.06) - 0.2, 0, zb + 0.03, sx * (dw / 2 + 0.06) + 0.2, 0.03, zb + 0.4, [0.2, 0.2, 0.22], { skip: '-y' }); }
  const banner = kit.tex.custom('photo' + c.room.id, 256, 56, (g) => { P(g, '#f4efe0', 0, 0, 256, 56); drawText(g, [p.banner[0]], 0, 4, 256, 30, { color: '#2a3a5a', size: 24, pad: 14 }); drawText(g, [p.banner[1]], 0, 34, 256, 18, { color: '#c0392b', size: 11, pad: 14 }); }, { clamp: true });
  c.hang(c.mapped('banner', banner), 'back', 0, 2.36, 2.6, 2.6 * 56 / 256, null, WHITE, 0.045);
  // two rows: the back one stands on a bench
  const zBack = zb + 0.62, zFront = zb + 1.3, people = [];
  c.crate(0, zBack, Math.min(dw - 0.3, p.back * 0.66 + 0.2), 0.42, 0.42, 0, [0.42, 0.3, 0.2], { tall: false });
  let n = 0;
  const who = () => cast[p.who[n++ % p.who.length] % cast.length];
  // Stagger adjacent standees slightly in Z so overlapping cardboard borders never coplanar Z-fight
  for (let i = 0; i < p.back; i++) { const w = who(), x = (i - (p.back - 1) / 2) * 0.66, z = zBack + (i % 2 ? 0.024 : -0.024); people.push(standee(c, 'who:' + w.name, w.look, x, z, 0, { watch: false, y: 0.42, name: w.name })); }
  const gap = Math.floor(p.front / 2);
  for (let i = 0; i <= p.front; i++) {
    const x = (i - p.front / 2) * 0.68, z = zFront + (i % 2 ? 0.032 : -0.032);
    if (i === gap) continue;
    const w = who(); people.push(standee(c, 'who:' + w.name, w.look, x, z, 0, { watch: false, name: w.name }));
    c.reserve(x, zFront, 0.3);
  }
  // your place: a cross of tape and your name
  const mx = (gap - p.front / 2) * 0.68, tape = [0.9, 0.86, 0.72];
  c.lay(c.flat, mx, zFront, 0.5, 0.05, 0.785, null, tape, 0.012);
  c.lay(c.flat, mx, zFront, 0.5, 0.05, -0.785, null, tape, 0.0126);
  const name = card(c, 'spot' + c.level.name, [c.level.name.toUpperCase()], { w: 96, h: 28, bg: '#f4f0e2', edge: '#b9ad8a', size: 16 });
  c.lay(c.mapped('spot', name), mx, zFront + 0.42, 0.36, 0.105, 0, null, WHITE, 0.013);
  // the camera
  const zc = Math.min(D / 2 - 1.6, zFront + 2.9);
  c.model('tripod', tripodVox, mx, zc, { rot: Math.PI });
  c.reserve(mx, zc, 0.5);
  let held = 0, flash = 0, shots = 0, armed = true;
  const u = c.env.vhs.uniforms;
  c.zone({ x0: mx - 0.33, z0: zFront - 0.33, x1: mx + 0.33, z1: zFront + 0.4,
    leave: () => { held = 0; armed = true; },
    stay: (dt, me) => {
      if (!armed) return;
      held += dt;
      if (held < 1.1) return;
      armed = false; flash = 1; shots++;
      c.env.sound.play('shutter'); c.env.interfere(0.5);
      // nobody saw them move: the light was in your eyes
      for (const k of people) { k.rot = shots % 3 === 1 ? Math.atan2(me.x - k.x, me.z - k.z) : shots % 3 === 2 ? Math.PI : 0; k.g.rotation.y = k.rot; }
    } });
  c.tick((dt) => { if (flash > 0) { flash = Math.max(0, flash - dt * 1.7); u.uWhite.value = flash * flash; } });
}

/* ---- the room in the room ------------------------------------------------------------- */

/** A meeting room. Inside it, a smaller one. Inside that, one you would have to be a mouse to book. */
function nested(c) {
  const { kit, look, params: p } = c, cream = lin('#e2d8bd'), trim = lin(look.trim), tube = lin(look.tube), boxes = [];
  c.shell();
  /** One room-shaped box: `size` square and `h` high with walls `t` thick, a doorway (dw × dh) in one side, everything else scaled by k. */
  const hut = (size, h, t, side, dw, dh, k, plate, solid = true) => {
    const x0 = -size / 2, x1 = size / 2, z0 = -size / 2 + p.z, z1 = size / 2 + p.z, cz = p.z, rt = 0.05 * k, tall = h > 1.25, uv = 0.8 * k;
    const slab = (ax0, az0, ax1, az1, y0 = 0, y1 = h - rt, block = true) => {
      c.wall.box(ax0, y0, az0, ax1, y1, az1, WHITE, { uv, skip: y0 ? '+y' : '-y+y' });
      if (block && solid && y0 < 0.01) c.solid(ax0, az0, ax1, az1, { tall, keep: true });
      if (y0 < 0.01) c.flat.box(ax0 - 0.012 * k, 0, az0 - 0.012 * k, ax1 + 0.012 * k, 0.1 * k, az1 + 0.012 * k, trim, { skip: '-y' });
    };
    for (const s of ['back', 'front', 'left', 'right']) {
      const alongX = s === 'back' || s === 'front', at = s === 'back' ? z0 : s === 'front' ? z1 - t : s === 'left' ? x0 : x1 - t, lo = alongX ? x0 : z0, hi = alongX ? x1 : z1, mid = alongX ? 0 : cz;
      const seg = (a, b, y0, y1, block) => (alongX ? slab(a, at, b, at + t, y0, y1, block) : slab(at, a, at + t, b, y0, y1, block));
      if (s !== side) { seg(lo, hi); continue; }
      seg(lo, mid - dw / 2); seg(mid + dw / 2, hi); seg(mid - dw / 2, mid + dw / 2, dh, h - rt, false);
      // a painted frame round the doorway, and the room's name over it
      const out = s === 'back' ? -1 : s === 'left' ? -1 : 1, face = (s === 'back' || s === 'left' ? at : at + t) + out * 0.012 * k, f = 0.05 * k;
      const stick = (a, b, y0, y1) => (alongX ? c.flat.box(a, y0, Math.min(face, face - out * 0.03 * k), b, y1, Math.max(face, face - out * 0.03 * k), cream) : c.flat.box(Math.min(face, face - out * 0.03 * k), y0, a, Math.max(face, face - out * 0.03 * k), y1, b, cream));
      stick(mid - dw / 2 - f, mid - dw / 2, 0, dh + f); stick(mid + dw / 2, mid + dw / 2 + f, 0, dh + f); stick(mid - dw / 2, mid + dw / 2, dh, dh + f);
      if (plate) {
        const tex = card(c, 'plate:' + plate, [plate], { w: 160, h: 28, bg: '#1e2228', fg: '#e8e2d0', size: 13, pad: 12 });
        const y = Math.min(h - rt - 0.09 * k, dh + 0.17 * k), pw = Math.min(dw * 1.5, 0.8 * k * 1.6), rot = s === 'front' ? 0 : s === 'back' ? Math.PI : s === 'left' ? -Math.PI / 2 : Math.PI / 2;
        c.board(c.mapped('plate:' + plate, tex), alongX ? mid : face + out * 0.004, y, alongX ? face + out * 0.004 : mid, pw, pw * 28 / 160, rot);
      }
    }
    // its ceiling, with one small tube of its own
    c.ceil.box(x0, h - rt, z0, x1, h, z1, WHITE, { uv: 0.6 * k });
    const lw = 0.15 * k, ll = 0.3 * k, y = h - rt - 0.004;
    c.shining('panel', kit.tex.panel(true), 2.5, tube).quad([-lw, y, cz - ll], [lw, y, cz - ll], [lw, y, cz + ll], [-lw, y, cz + ll], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    c.light(0, h - rt - 0.1, cz, tube, 0.42 * k, { k: 1.6 * k * k, far: size * 1.1, axis: [0, -1, 0], floor: 0.3 });
    boxes.push({ x0, x1, z0, z1, t, head: h - rt, side, dw, dh });
  };
  const order = ['front', 'right', 'back', 'left'], s1 = order[p.turn % 4], s2 = order[(p.turn + 2) % 4];
  hut(4.4, 2.14, 0.1, s1, 1.1, 1.86, 1, p.plates[0]);
  hut(2.3, 1.3, 0.07, s2, 0.62, 1.0, 0.56, p.plates[1]);
  hut(0.96, 0.58, 0.035, s2, 0.24, 0.4, 0.25, p.plates[2], false);
  c.solid(-0.48, p.z - 0.48, 0.48, p.z + 0.48, { keep: true });
  // (preview, &preview=clip: an office chair most of the way through the meeting room's blank wall, the one the way in
  // looks at, or its right-hand wall where the way in looks at its door. Cut at the middle of that wall, so nothing of
  // it is inside the meeting room. Fixed choices, nothing rolled)
  if (previewing(c, 'clip')) {
    const b = boxes[0], face = s1 === 'front' ? 'right' : 'front', out = face === 'front' ? [0, 0, 1] : [1, 0, 0];
    const f = face === 'front' ? b.z1 : b.x1, mid = f - b.t / 2;
    const x = face === 'front' ? -1.15 : f - 0.08, z = face === 'front' ? f - 0.08 : p.z + 1.05;
    clip(c, 'chair', x, z, { rot: Math.atan2(out[0], out[2]) + 0.5, cut: [{ n: out.map((v) => -v), d: -mid }] });
  }
  // through the smallest door: light, and nothing you could get to
  const g = boxes[2], warm = lin('#ffd9a0');
  const glow = c.shining('inner', kit.tex.white(), 2.6, warm);
  if (s2 === 'front') glow.quad([-0.12, 0, g.z1 - 0.03], [0.12, 0, g.z1 - 0.03], [0.12, 0.4, g.z1 - 0.03], [-0.12, 0.4, g.z1 - 0.03]);
  else if (s2 === 'back') glow.quad([0.12, 0, g.z0 + 0.03], [-0.12, 0, g.z0 + 0.03], [-0.12, 0.4, g.z0 + 0.03], [0.12, 0.4, g.z0 + 0.03]);
  else if (s2 === 'left') glow.quad([g.x0 + 0.03, 0, p.z - 0.12], [g.x0 + 0.03, 0, p.z + 0.12], [g.x0 + 0.03, 0.4, p.z + 0.12], [g.x0 + 0.03, 0.4, p.z - 0.12]);
  else glow.quad([g.x1 - 0.03, 0, p.z + 0.12], [g.x1 - 0.03, 0, p.z - 0.12], [g.x1 - 0.03, 0.4, p.z - 0.12], [g.x1 - 0.03, 0.4, p.z + 0.12]);
  c.light(s2 === 'left' ? g.x0 - 0.2 : s2 === 'right' ? g.x1 + 0.2 : 0, 0.2, s2 === 'front' ? g.z1 + 0.2 : s2 === 'back' ? g.z0 - 0.2 : p.z, warm, 0.25, { k: 0.5, far: 2.2 });
  // how much room there is to stand up in: under each roof, and lower still in each doorway
  const base = (x, z) => headAt(c.room, x, z);
  c.rt.headY = (x, z) => {
    let head = base(x, z);
    for (const b of boxes.slice(0, 2)) {
      if (x <= b.x0 || x >= b.x1 || z <= b.z0 || z >= b.z1) {
        // just outside: is this the doorway?
        const alongX = b.side === 'front' || b.side === 'back', off = alongX ? Math.abs(x) : Math.abs(z - p.z);
        const depth = b.side === 'front' ? z - b.z1 : b.side === 'back' ? b.z0 - z : b.side === 'left' ? b.x0 - x : x - b.x1;
        if (off < b.dw / 2 + 0.1 && depth >= 0 && depth < 0.25) head = Math.min(head, b.dh);
        continue;
      }
      head = Math.min(head, b.head);
      const alongX = b.side === 'front' || b.side === 'back', off = alongX ? Math.abs(x) : Math.abs(z - p.z);
      const depth = b.side === 'front' ? b.z1 - z : b.side === 'back' ? z - b.z0 : b.side === 'left' ? x - b.x0 : b.x1 - x;
      if (off < b.dw / 2 + 0.1 && depth < b.t + 0.25) head = Math.min(head, b.dh);
    }
    return head;
  };
}

export const MORE3 = { museum, photo, nested };
