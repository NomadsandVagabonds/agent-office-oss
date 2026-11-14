// The Backrooms — what other people left. You are not the first to lean on
// the wrong wall, and most of the others did not get out: they marked the
// walls they tried, kept count of something, made camp where they gave up,
// and went on or did not. Nothing here is explained and none of it is grim;
// it is what anybody leaves behind who has been somewhere too long.
//
// Same contract as the room builders: the toolbox `c` (world.js), the room's
// own frame. Everything is drawn into the room's own batches and lit by its
// bake, so a room with a camp in it costs what it cost before.
//
// A mark goes on a wall. Usually that is one of the room's four (`side`:
// 'back' | 'left' | …); it may also be any upright surface a builder has made
// for itself: { at(along, off) → { x, z, n, U }, y } — where along it, how far
// proud of it, and the height of the floor at its foot.
import { Vox, M } from '../vox/vox.js';
import { Batch, WHITE } from './kit.js';
import { makeRng } from './gen.js';
import { P, card, standee } from './bits.js';
import { drawText } from './kit.js';

const TAPE = '#3f74bf';                              // painter's tape: the blue kind
const on = (c, wall, at, off = 0) => (typeof wall === 'string' ? c.wallAt(wall, at, off) : wall.at(at, off));
const foot = (wall) => (typeof wall === 'string' ? 0 : wall.y || 0);

/** A roll of it, nearly finished, wherever it was put down. */
const tapeRoll = () => { const v = new Vox(); v.cyl('y', 0, 0, 0, 2, 3.4, M(TAPE, 1)); v.cyl('y', 0, 0, 0, 2, 2.2, M('#b89a6a', 1)); v.carve(-1, 0, -1, 1, 2, 1); return v; };

export const tapeTex = (kit) => kit.tex.custom('ptape', 16, 8, (g) => {
  P(g, TAPE, 0, 0, 16, 8);
  for (let x = 0; x < 16; x += 2) P(g, x % 4 ? '#3a6cb3' : '#4a80cb', x, 0, 1, 8);
  P(g, '#5c8ed4', 0, 0, 16, 1); P(g, '#325f9f', 0, 7, 16, 1);
});

/** A flat picture on a wall (as c.hang, for any wall). */
function hangOn(c, batch, wall, at, y, w, h, uv = null, alb = WHITE, off = 0.012) {
  const p = on(c, wall, at, off), U = p.U, hw = w / 2, hh = h / 2, yy = y + foot(wall);
  batch.quad([p.x - U[0] * hw, yy - hh, p.z - U[2] * hw], [p.x + U[0] * hw, yy - hh, p.z + U[2] * hw], [p.x + U[0] * hw, yy + hh, p.z + U[2] * hw], [p.x - U[0] * hw, yy + hh, p.z - U[2] * hw], alb, uv);
}

/** A strip of something flat on a wall, from (u0, y0) to (u1, y1) — u along the wall from `at`, y up from its foot — `wd` wide, `off` proud of it. */
export function strip(c, batch, wall, at, u0, y0, u1, y1, wd, alb = WHITE, off = 0.006) {
  const p = on(c, wall, at, off), U = p.U, n = p.n, base = foot(wall);
  const len = Math.hypot(u1 - u0, y1 - y0) || 1, du = (u1 - u0) / len, dy = (y1 - y0) / len, hu = (-dy * wd) / 2, hy = (du * wd) / 2;
  const pt = (u, y) => [p.x + U[0] * u, y + base, p.z + U[2] * u];
  let q = [pt(u0 - hu, y0 - hy), pt(u1 - hu, y1 - hy), pt(u1 + hu, y1 + hy), pt(u0 + hu, y0 + hy)];
  // whichever way the strip runs, it faces the room
  const ax = q[1][0] - q[0][0], ay = q[1][1] - q[0][1], az = q[1][2] - q[0][2], bx = q[3][0] - q[0][0], by = q[3][1] - q[0][1], bz = q[3][2] - q[0][2];
  if ((ay * bz - az * by) * n[0] + (az * bx - ax * bz) * n[1] + (ax * by - ay * bx) * n[2] < 0) q = [q[1], q[0], q[3], q[2]];
  batch.quad(q[0], q[1], q[2], q[3], alb, [[0, 0], [len / 0.12, 0], [len / 0.12, 1], [0, 1]]);
}

/** A smudge on a wall: where shoulders have been. */
function smudge(c, wall, at, y, w, h, a = 0.3) {
  const p = on(c, wall, at, 0.004), U = p.U, q = c.decals, base = q.pos.length / 3, yy = y + foot(wall);
  // (along the wall, then up: that is the winding the walls themselves have, so it faces the room)
  for (const [u, v] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) q.pos.push(p.x + U[0] * u, yy + v, p.z + U[2] * u);
  q.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
  for (let i = 0; i < 4; i++) q.col.push(0.05, 0.04, 0.03, a);
  q.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * An outline of a door in painter's tape, most of it let go since. Somebody marked this wall.
 * opt.stir: the loose ends are their own meshes, to be moved (→ `loose`: [{ node, axis, phase, len }]); opt.roll: the roll is still here.
 */
export function tapeMark(c, wall, at, R, opt = {}) {
  const { kit } = c, tex = tapeTex(kit), tape = c.mapped('ptape', tex), w = 0.92, h = 2.0, wd = 0.048, p = on(c, wall, at), n = p.n, U = p.U, base = foot(wall);
  const loose = [], axis = Math.abs(n[2]) > 0.5 ? 'z' : 'x';                    // a hanging end swings about the way the wall faces
  /** A length of tape that has let go at one end and hangs from the other, a little off the wall. */
  const hang = (u, y, len, lean) => {
    const off = 0.014 + R() * 0.02;
    if (!opt.stir) { strip(c, tape, wall, at, u, y, u + Math.sin(lean) * len, y - Math.cos(lean) * len, wd, [0.86, 0.86, 0.86], off); return; }
    const b = new Batch();
    strip(c, b, wall, at, u, y, u + Math.sin(lean) * len, y - Math.cos(lean) * len, wd, [0.9, 0.9, 0.9], off);
    const top = on(c, wall, at, off);
    loose.push({ node: c.dynamic(b, { map: tex, pivot: [top.x + U[0] * u, y + base, top.z + U[2] * u] }), axis, phase: R() * 6, len });
  };
  // the left side has held; the top has let go at one end; the right has let go from the top down
  strip(c, tape, wall, at, -w / 2, 0.03, -w / 2, R.chance(0.7) ? h : 0.9 + R() * 0.5, wd);
  const held = -w / 2 + 0.25 + R() * 0.45;
  strip(c, tape, wall, at, -w / 2 - 0.03, h, held, h - (held + w / 2) * 0.03, wd);
  hang(held, h - (held + w / 2) * 0.03, w / 2 - held + 0.05, 0.12 + R() * 0.2);
  const stuck = 0.35 + R() * 0.7;
  strip(c, tape, wall, at, w / 2, 0.03, w / 2, stuck, wd);
  hang(w / 2, stuck, Math.min(stuck - 0.08, 0.3 + R() * 0.4), -0.08 - R() * 0.16);
  if (R.chance(0.5)) strip(c, tape, wall, at, -w / 2 + 0.1, 0.05, -w / 2 + 0.36, 0.045, wd);            // a bit of the sill
  // what came off altogether is on the floor, with the roll
  const out = (u, d) => ({ x: p.x + U[0] * u + n[0] * d, z: p.z + U[2] * u + n[2] * d });
  for (let i = 0, k = R.int(2, 4); i < k; i++) { const f = out(R.range(-0.5, 0.7), R.range(0.1, 0.5)); c.lay(tape, f.x, f.z, R.range(0.2, 0.55), wd, R.range(0, 3.1), [[0, 0], [3, 0], [3, 1], [0, 1]], [0.8, 0.8, 0.8], base + 0.007 + i * 0.001); }
  if (opt.roll !== false && R.chance(opt.roll ? 1 : 0.55)) { const f = out(R.range(-0.7, 0.7), R.range(0.25, 0.6)); c.model('taperoll', tapeRoll, f.x, f.z, { y: base, solid: false, shadow: base ? false : 0.3, rot: R.range(0, 3) }); }
  smudge(c, wall, at + R.range(-0.1, 0.1), 1.05, 0.7, 0.9, 0.16 + R() * 0.12);
  return { loose, w, h };
}

/** A door, in pencil, with its measurements. It was going to be cut out. */
function pencilMark(c, wall, at, R) {
  const tex = c.kit.tex.custom('pencildoor', 64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(60,56,50,.92)'; g.lineWidth = 1;
    g.strokeRect(8.5, 6.5, 46, 116); g.beginPath(); g.moveTo(12, 3.5); g.lineTo(51, 3.5); g.moveTo(58.5, 10); g.lineTo(58.5, 118); g.stroke();
    g.beginPath(); g.arc(46, 66, 2.5, 0, 7); g.stroke();
    g.fillStyle = 'rgba(60,56,50,.95)'; g.font = '8px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center';
    g.fillText('762', 31, 12); g.save(); g.translate(52, 70); g.rotate(-Math.PI / 2); g.fillText('1981', 0, 0); g.restore();
    g.font = '700 13px ui-monospace, Menlo, Consolas, monospace'; g.fillText('?', 31, 60);
  }, { clamp: true });
  hangOn(c, c.mapped('pencildoor', tex, { cutout: true }), wall, at, 1.06, 1.0, 2.0, null, [0.75, 0.75, 0.75], 0.004);
  smudge(c, wall, at + 0.1, 1.1, 0.6, 0.7, 0.14);
  if (R.chance(0.6)) { const p = on(c, wall, at + R.range(-0.3, 0.5), R.range(0.12, 0.3)); c.flat.box(p.x - 0.07, 0.004, p.z - 0.004, p.x + 0.07, 0.012, p.z + 0.004, [0.85, 0.6, 0.12]); }      // the pencil
}

/** Chalk strokes in fives. Somebody was counting something, and stopped. */
export function tallyMark(c, wall, at, R, y = 1.35) {
  const n = R.int(9, 38), tex = c.kit.tex.custom('tally' + n, 128, 48, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(238,236,226,.95)'; g.lineWidth = 1.6; g.lineCap = 'round';
    let s = n * 31 + 7; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0, x = 5, yy = 5; i < n; i++) {
      if (i % 5 === 4) { g.beginPath(); g.moveTo(x - 14, yy + 13 + r() * 2); g.lineTo(x + 1, yy + 2 + r() * 2); g.stroke(); x += 7; }
      else { g.beginPath(); g.moveTo(x + r(), yy + r() * 2); g.lineTo(x + r() - 0.5, yy + 15 + r() * 2); g.stroke(); x += 3.4; }
      if (x > w - 16) { x = 5; yy += 21; }
    }
  }, { clamp: true });
  hangOn(c, c.mapped('tally' + n, tex, { cutout: true }), wall, at, y, 0.9, 0.34, null, WHITE, 0.004);
}

/**
 * What `dressing` (rooms.js) does with a thing of type 'marks': something a person left on a wall, and honest.
 * → the tape on it, if there is a taped door (its loose ends can be moved: thin.js).
 */
export function marks(c, item) {
  const R = makeRng(`${c.level.seed}/mark/${c.room.id}/${item.seed}`), tape = c.mapped('ptape', tapeTex(c.kit));
  c.keepWall(item.side, item.at - 1, item.at + 1);
  const p = c.wallAt(item.side, item.at, 0.5);
  if (c.clear(p.x, p.z, 0.35)) c.reserve(p.x, p.z, 0.55);
  const cross = (y, r) => { strip(c, tape, item.side, item.at, -r, y - r, r, y + r, 0.048, WHITE, 0.012); strip(c, tape, item.side, item.at, -r, y + r, r, y - r, 0.048, WHITE, 0.013); };
  const says = (key, lines, y) => {
    const tex = c.kit.tex.custom('says:' + key, 160, 44, (g, tw, th) => { g.clearRect(0, 0, tw, th); drawText(g, lines, 0, 0, tw, th, { color: 'rgba(30,30,34,.95)', size: 20, pad: 4, weight: 800, font: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' }); }, { clamp: true });
    hangOn(c, c.mapped('says:' + key, tex, { cutout: true }), item.side, item.at, y, 0.8, 0.22, null, WHITE, 0.005);
  };
  if (item.style === 'wrongway') { cross(1.5, 0.3); says('wrongway', ['WRONG WAY'], 1.02); return null; }
  // a door somebody taped, leaned on, and crossed out
  const mark = tapeMark(c, item.side, item.at, R, { stir: true });
  cross(1.1, 0.42); says('nothere', ['NOT HERE'], 2.22);
  return mark;
}

/* ---- a camp ------------------------------------------------------------------------------------ */

const shoe = () => { const v = new Vox(), tan = M('#6a4a2a', 1); v.rbox(-2, 0, -5, 2, 2, 5, 1, M('#2a2420', 0), 'xz'); v.rbox(-2, 2, -5, 2, 4, 1, 1, tan); v.rbox(-2, 2, 1, 2, 5, 5, 1, tan); v.carve(-1, 3, 2, 1, 5, 4); return v; };
const cups = (n) => () => { const v = new Vox(); for (let i = 0; i < n; i++) v.cyl('y', 0, 0, i * 2, i * 2 + 3, 1.7, M(i % 2 ? '#f4f1e6' : '#e6e2d2', 0), 2.3); return v; };

/**
 * Where somebody stopped: a bed of bubble wrap on flattened boxes, the cups they got through, a lamp, a shoe.
 * (x, z) is the middle of the bed, 1.9 × 0.75 m, its length along `rot` (a quarter turn or none). What they owned is
 * strewn to one side of it — both sides, unless o.narrow. o: { lamp:false, light:false, narrow }
 */
export function camp(c, x, z, rot = 0, o = {}) {
  const { kit, R } = c, cs = Math.round(Math.cos(rot)), sn = Math.round(Math.sin(rot)), at = (lx, lz) => ({ x: x + lx * cs + lz * sn, z: z - lx * sn + lz * cs });
  const fy = c.rt.floorY ? c.rt.floorY(x, z) : 0, far = o.narrow ? 0.34 : -0.5;
  const cardT = kit.tex.custom('cardboard', 32, 32, (g) => { P(g, '#b08a5c', 0, 0, 32, 32); for (let y = 2; y < 32; y += 5) P(g, '#a37f52', 0, y, 32, 1); P(g, '#c9a877', 4, 14, 24, 3); });
  const wrapT = kit.tex.custom('bubblewrap', 16, 16, (g) => { P(g, '#cfd9de', 0, 0, 16, 16); for (let y = 0; y < 16; y += 4) for (let i = (y / 4) % 2 ? 2 : 0; i < 16; i += 4) { P(g, '#e9f1f4', i, y, 2, 2); P(g, '#aebbc2', i + 2, y + 1, 1, 1); } });
  // the bed: boxes opened out flat, and bubble wrap to lie under
  c.lay(c.mapped('cardboard', cardT), x, z, 1.9, 0.75, rot, [[0, 0], [3, 0], [3, 1], [0, 1]], WHITE, fy + 0.008);
  const wrap = c.mapped('bubblewrap', wrapT);
  for (const [lx, w, hgt] of [[-0.33, 0.55, 0.05], [0.17, 0.5, 0.075], [0.62, 0.45, 0.06]]) {
    const q = at(lx, 0.02), hx = (Math.abs(cs) * w + Math.abs(sn) * 0.58) / 2, hz = (Math.abs(sn) * w + Math.abs(cs) * 0.58) / 2;
    wrap.box(q.x - hx, fy + 0.01, q.z - hz, q.x + hx, fy + hgt, q.z + hz, WHITE, { uv: 0.16, skip: '-y' });
  }
  { const q = at(-0.78, 0); c.flat.box(q.x - 0.13, fy + 0.01, q.z - 0.13, q.x + 0.13, fy + 0.06, q.z + 0.13, [0.9, 0.89, 0.84]); }                       // a ream of paper, for a pillow
  { const q = at(0.12, 0.02); c.shadow(q.x, q.z, Math.abs(cs) * 1.3 + Math.abs(sn) * 0.5, Math.abs(sn) * 1.3 + Math.abs(cs) * 0.5, 0.3, fy + 0.007); }
  // what they got through
  { const q = at(0.95, 0.5); c.model('cups7', cups(7), q.x, q.z, { y: fy, solid: false, shadow: 0.25 }); const r = at(0.8, 0.62); c.model('cups3', cups(3), r.x, r.z, { y: fy, solid: false, shadow: false }); }
  for (let i = 0; i < 6; i++) { const q = at(R.range(-0.9, 0.7), R.range(0.46, 0.8)), col = [[0.7, 0.2, 0.16], [0.85, 0.78, 0.5], [0.25, 0.45, 0.6]][i % 3]; c.flat.box(q.x - 0.05, fy + 0.006, q.z - 0.03, q.x + 0.05, fy + 0.012 + (i % 2) * 0.01, q.z + 0.03, col); }
  { const q = at(-0.3, far < 0 ? far : 0.6); c.model('shoe', shoe, q.x, q.z, { y: fy, rot: rot + R.range(-1, 1), solid: false, shadow: 0.3 }); }
  // a lanyard, where it was taken off
  { const q = at(0.45, far < 0 ? far : 0.95), red = [0.62, 0.18, 0.15]; c.lay(c.flat, q.x, q.z, 0.34, 0.016, rot + 0.5, null, red, fy + 0.008); c.lay(c.flat, q.x + 0.05, q.z + 0.05, 0.3, 0.016, rot - 0.3, null, red, fy + 0.009); c.lay(c.flat, q.x - 0.14, q.z - 0.08, 0.09, 0.055, rot + 0.5, null, [0.92, 0.9, 0.82], fy + 0.01); }
  if (o.lamp !== false) {
    const q = at(-1.0, 0.5);
    c.prop('desklamp', q.x, q.z, { y: fy, rot: rot + 2.2, solid: false, shadow: 0.3, fallback: [0.2, 0.4, 0.2] });
    if (o.light !== false) c.light(q.x, fy + 0.45, q.z, '#ffca82', 0.34, { k: 0.9, far: 3.5 });
  }
  c.reserve(x, z, 1.1);
}

/** A list, on a sheet of paper, of how something was going to be made to last. where: { side, at, y }. */
export function rationList(c, where) {
  const tex = card(c, 'rations', ['MON  ½ SANDWICH', 'TUE  ½ OF THAT', 'WED  THE CRUST', 'THU  —', 'FRI'], { w: 96, h: 120, bg: '#f4f1e6', fg: '#3a342a', size: 9, pad: 10, weight: 600 });
  const y = where.y ?? 1.25;
  hangOn(c, c.mapped('rations', tex), where.side, where.at, y, 0.24, 0.3, null, WHITE, 0.006);
  strip(c, c.mapped('ptape', tapeTex(c.kit)), where.side, where.at, -0.05, y + 0.15, 0.05, y + 0.15, 0.04, WHITE, 0.008);
}

/* ---- what was left in a room ----------------------------------------------------------------------- */

// Six things an earlier visitor may have left (gen.js `TRACES` says which rooms: two or three to a floor, far apart, in
// rooms with nothing else in them). None can be used, none moves, none is explained. Each bails out quietly if the
// room has not the wall or the floor for it: a room with nothing in it is never wrong.

/** Something written straight on the wall, in pencil. */
function scrawl(c, key, lines, side, at, y, w = 0.6, h = 0.2, ink = 'rgba(58,54,48,.92)') {
  const tex = c.kit.tex.custom('scrawl:' + key, 160, Math.round((160 * h) / w), (g, tw, th) => { g.clearRect(0, 0, tw, th); drawText(g, lines, 0, 0, tw, th, { color: ink, size: lines.length > 1 ? 12 : 15, pad: 4, weight: 600, font: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' }); }, { clamp: true });
  hangOn(c, c.mapped('scrawl:' + key, tex, { cutout: true }), side, at, y, w, h, null, WHITE, 0.004);
}
/** A sheet of paper stuck to a wall with a bit of the blue tape. */
function sheet(c, key, tex, side, at, y, w, h) {
  hangOn(c, c.mapped(key, tex), side, at, y, w, h, null, WHITE, 0.006);
  strip(c, c.mapped('ptape', tapeTex(c.kit)), side, at, -0.05, y + h / 2, 0.05, y + h / 2, 0.04, WHITE, 0.008);
}
const along = (U) => Math.atan2(-U[2], U[0]);                 // the turn that lays something on the floor along a wall

/** A camp left in a hurry: the bed, the lamp still on — and a shoe, and their papers, most of the way to the door. */
function leftInAHurry(c, R) {
  const k = c.corner(1.3, undefined, 1.6) || c.spot(1.15, { head: 1.6 });
  if (!k) return;
  const rot = Math.abs(k.x) > Math.abs(k.z) ? Math.PI / 2 : 0;
  camp(c, k.x, k.z, rot, {});
  const door = c.room.doors.slice().sort((a, b) => { const p = c.doorPoint(a, 0.8), q = c.doorPoint(b, 0.8); return Math.hypot(p.x - k.x, p.z - k.z) - Math.hypot(q.x - k.x, q.z - k.z); })[0];
  if (!door) return;
  const d = c.doorPoint(door, 1.1);
  for (let i = 1; i <= 4; i++) { const t = i / 5, x = k.x + (d.x - k.x) * t + R.range(-0.25, 0.25), z = k.z + (d.z - k.z) * t + R.range(-0.25, 0.25); if (c.clear(x, z, 0.12)) c.paper(x, z); }
  const sx = k.x + (d.x - k.x) * 0.8, sz = k.z + (d.z - k.z) * 0.8;
  c.model('shoe', shoe, sx, sz, { rot: R.range(-3, 3), solid: false, shadow: 0.3 });                     // the other one
}

/** Arrows in tape on one wall, each sure of itself, no two agreeing. */
function arrows(c, R) {
  const w = c.wallSpot(2.7, undefined, 0.4, 2.2); if (!w) return;
  const tape = c.mapped('ptape', tapeTex(c.kit)), y = 1.38;
  c.keepWall(w.side, w.at - 1.35, w.at + 1.35);
  const says = [['THIS WAY'], ['NO. THIS WAY'], ['SEE FIRST ARROW']];
  [-0.86, 0, 0.86].forEach((u, i) => {
    const dir = i % 2 ? -1 : 1, tip = u + dir * 0.26, lean = R.range(-0.04, 0.04);
    strip(c, tape, w.side, w.at, u - dir * 0.26, y + lean, tip, y - lean, 0.048);
    strip(c, tape, w.side, w.at, tip, y - lean, tip - dir * 0.15, y - lean + 0.12, 0.048);
    strip(c, tape, w.side, w.at, tip, y - lean, tip - dir * 0.15, y - lean - 0.12, 0.048);
    scrawl(c, 'arrow' + i, says[i], w.side, w.at + u, y - 0.3, 0.62, 0.16);
  });
  const f = c.wallAt(w.side, w.at + R.range(-0.9, 0.9), R.range(0.25, 0.5));
  c.model('taperoll', tapeRoll, f.x, f.z, { solid: false, shadow: 0.3, rot: R.range(0, 3) });
}

/** A note that stops. The pen is on the carpet under it. */
function note(c, R, item) {
  const w = c.wallSpot(0.7, undefined, 0.4, 2.0); if (!w) return;
  const lines = Array.isArray(item.text) && item.text.length ? item.text : ['IF YOU FIND THIS:', 'THE WAY OUT IS', 'DEFINITELY PAST THE'];
  const tex = card(c, 'note:' + lines.join('|'), [...lines, ''], { w: 128, h: 128, bg: '#f4f1e6', fg: '#2f2a22', size: 10, pad: 10, weight: 600 });
  c.keepWall(w.side, w.at - 0.35, w.at + 0.35);
  sheet(c, 'note:' + item.seed, tex, w.side, w.at, 1.42, 0.27, 0.27);
  const p = c.wallAt(w.side, w.at + R.range(-0.15, 0.25), R.range(0.14, 0.4)), a = R.range(0, 3);
  c.lay(c.flat, p.x, p.z, 0.14, 0.012, a, null, [0.1, 0.15, 0.45], 0.011);                               // the pen
  c.lay(c.flat, p.x + Math.cos(a) * 0.075, p.z - Math.sin(a) * 0.075, 0.02, 0.012, a, null, [0.75, 0.75, 0.78], 0.012);
}

/** A tape measure run out along a wall, as far as it goes. Somebody wrote down what it said, and what the plan says. */
function measure(c, R) {
  let best = null;
  for (const side of ['back', 'left', 'right', 'front']) for (const [a, b] of c.spans(side, 0.3, 0)) if (b - a >= 2.6 && (!best || b - a > best.b - best.a)) best = { side, a, b };
  if (!best) return;
  // (a five-metre tape, a three, or the two-metre one off somebody's keys: whichever this wall is longer than)
  const len = best.b - best.a >= 5.6 ? 5 : best.b - best.a >= 3.6 ? 3 : 2, from = best.a + 0.25, to = from + len, yellow = [0.92, 0.74, 0.1], p0 = c.wallAt(best.side, from, 0.16), p1 = c.wallAt(best.side, to, 0.16), rot = along(p0.U);
  c.lay(c.flat, (p0.x + p1.x) / 2, (p0.z + p1.z) / 2, len, 0.022, rot, null, yellow, 0.007);
  for (let m = 0.5; m < len; m += 0.5) { const q = c.wallAt(best.side, from + m, 0.16); c.lay(c.flat, q.x, q.z, m % 1 ? 0.006 : 0.012, 0.022, rot, null, [0.08, 0.08, 0.08], 0.0085); }
  c.flat.box(p0.x - 0.045, 0, p0.z - 0.045, p0.x + 0.045, 0.075, p0.z + 0.045, yellow, { skip: '-y' });                 // the case
  c.flat.box(p0.x - 0.03, 0.075, p0.z - 0.03, p0.x + 0.03, 0.08, p0.z + 0.03, [0.1, 0.1, 0.1]);
  c.lay(c.flat, p1.x, p1.z, 0.012, 0.05, rot, null, [0.7, 0.7, 0.72], 0.009);                                           // the hook, and nothing to hook it to
  c.keepWall(best.side, to - 0.5, to + 0.5);
  scrawl(c, 'measure' + len, [`${len}.00 m`, `(PLAN SAYS ${len - 1}.40)`], best.side, to, 0.5, 0.56, 0.2);
  const t = c.wallAt(best.side, to, 0.002);
  c.flat.box(t.x - Math.abs(t.U[0]) * 0.003 - 0.001, 0.12, t.z - Math.abs(t.U[2]) * 0.003 - 0.001, t.x + Math.abs(t.U[0]) * 0.003 + 0.001, 0.34, t.z + Math.abs(t.U[2]) * 0.003 + 0.001, [0.2, 0.19, 0.17]);   // a pencil line up the wall where it ends
}

/** A map somebody drew from memory. It is wrong, and it has been corrected, and the corrections are wrong. */
function wrongMap(c, R, item) {
  const w = c.wallSpot(0.9, undefined, 0.4, 2.0); if (!w) return;
  const tex = c.kit.tex.custom('wrongmap:' + item.seed, 160, 120, (g, tw, th) => {
    P(g, '#f1ecdc', 0, 0, tw, th);
    let s = item.seed * 7919 + 13; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    g.strokeStyle = 'rgba(40,44,70,.9)'; g.lineWidth = 1.2; g.lineJoin = 'round';
    const boxes = [];
    let x = 18, y = 46;
    for (let i = 0; i < 7; i++) {
      const bw = 16 + r() * 16, bh = 12 + r() * 12;
      g.beginPath(); g.moveTo(x + r() * 2, y + r() * 2); g.lineTo(x + bw + r() * 2, y + r() * 2); g.lineTo(x + bw + r() * 2, y + bh + r() * 2); g.lineTo(x + r() * 2, y + bh + r() * 2); g.closePath(); g.stroke();
      boxes.push([x + bw / 2, y + bh / 2]);
      if (i % 3 === 2) { y += (r() < 0.5 ? -1 : 1) * (bh + 6); y = Math.max(22, Math.min(th - 36, y)); } else x += bw + 3;
      if (x > tw - 34) { x = 20 + r() * 20; y = y < th / 2 ? y + 34 : y - 34; }
    }
    g.font = '700 7px ui-monospace, Menlo, Consolas, monospace'; g.fillStyle = 'rgba(40,44,70,.95)'; g.textAlign = 'center';
    g.fillText('YOU ARE HERE', boxes[1][0], boxes[1][1] + 2); g.fillText('YOU ARE HERE', boxes[5][0], boxes[5][1] + 2);
    // the exit, three times, the first two struck out
    g.strokeStyle = g.fillStyle = 'rgba(190,40,30,.95)';
    for (const [i, cross] of [[3, true], [6, true], [0, false]]) {
      const [bx, by] = boxes[i]; g.fillText('EXIT', bx, by - 6);
      if (cross) { g.beginPath(); g.moveTo(bx - 10, by - 10); g.lineTo(bx + 10, by - 5); g.stroke(); }
    }
    g.beginPath(); g.moveTo(boxes[0][0] - 6, boxes[0][1]); g.lineTo(4, boxes[0][1] + 8); g.lineTo(9, boxes[0][1] + 3); g.moveTo(4, boxes[0][1] + 8); g.lineTo(10, boxes[0][1] + 10); g.stroke();   // …and an arrow off the edge of the paper
    g.fillStyle = 'rgba(40,44,70,.95)'; g.textAlign = 'left'; g.fillText('NOT TO SCALE (OR ANYTHING)', 8, th - 6);
    g.strokeStyle = 'rgba(120,80,40,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(tw - 26, 22, 11, 0.4, 6.1); g.stroke();                                                                       // where the cup stood
  }, { clamp: true });
  c.keepWall(w.side, w.at - 0.45, w.at + 0.45);
  sheet(c, 'wrongmap:' + item.seed, tex, w.side, w.at, 1.4, 0.46, 0.345);
  // the two before it, on the carpet
  for (let i = 0; i < 2; i++) { const p = c.wallAt(w.side, w.at + R.range(-0.5, 0.5), R.range(0.2, 0.6)); if (c.clear(p.x, p.z, 0.1)) c.paper(p.x, p.z); }
}

/** A queue of cardboard colleagues at a bare wall. There is nothing on the wall. They are waiting anyway. */
function queue(c, R, item) {
  const cast = c.env.cast || [];
  if (!cast.length) return;
  // (a few goes at finding a wall with room in front of it for three of them in single file)
  let w = null, head = null, n = null, spots = [];
  for (let tries = 0; tries < 10 && spots.length < 3; tries++) {
    w = c.wallSpot(1.3, undefined, 0.5, 2.0); if (!w) return;
    head = c.wallAt(w.side, w.at, 0.85); n = head.n; spots = [];
    for (let i = 0; i < Math.max(3, Math.min(5, item.n || 4)); i++) {
      const x = head.x + n[0] * i * 0.62, z = head.z + n[2] * i * 0.62;
      if (!c.clear(x, z, 0.3)) break;
      spots.push([x + R.range(-0.05, 0.05), z + R.range(-0.05, 0.05)]);
    }
  }
  if (spots.length < 3) return;
  c.keepWall(w.side, w.at - 0.65, w.at + 0.65);
  const order = R.shuffle(cast.map((_, i) => i));
  spots.forEach(([x, z], i) => {
    const who = cast[order[i % order.length]];
    standee(c, 'queue:' + who.name, who.look, x, z, Math.atan2(-n[0], -n[2]) + R.range(-0.06, 0.06), { watch: false });
    c.reserve(x, z, 0.35);
  });
  // where to stand, in tape, in front of the one at the front
  const line = c.wallAt(w.side, w.at, 0.5);
  c.lay(c.mapped('ptape', tapeTex(c.kit)), line.x, line.z, 0.6, 0.048, along(line.U), [[0, 0], [5, 0], [5, 1], [0, 1]], WHITE, 0.007);
}

/** What `dressing` (rooms.js) does with a thing of type 'trace'. */
export function trace(c, item) {
  const R = makeRng(`${c.level.seed}/trace/${c.room.id}/${item.seed}`);
  if (item.kind === 'camp') leftInAHurry(c, R);
  else if (item.kind === 'arrows') arrows(c, R);
  else if (item.kind === 'note') note(c, R, item);
  else if (item.kind === 'measure') measure(c, R);
  else if (item.kind === 'map') wrongMap(c, R, item);
  else if (item.kind === 'queue') queue(c, R, item);
}
