// The Backrooms — the neighbourhood (themes.js `suburb`): what an office built
// indoors when it tried to remember one. It is still the building: ceiling
// tiles and tubes over every lawn, carpet showing where the fake grass was cut
// short of the wall, sky-blue emulsion on the partitions with clouds cut out of
// board and screwed on. Every object in it is one of three things, and nothing
// says which: real (it does what it looks as if it does), a prop (a painted
// flat: walk round it and there is bare board and a brace with a sandbag on
// its foot), or misremembered (the right thing, the wrong size or the wrong
// number of them).
//
// This file is what its plain rooms are dressed with (rooms.js asks for it),
// and the parts its own rooms (rooms/show-home.js, rooms/recess.js) share:
//   lawn(c)        the carpet left showing round the grass, and the clouds on the walls
//   standing(c, p) one piece of a plain room's layout that is not wall: a run of picket fence, a scenic flat, a brace (quiet.js)
//   THINGS         what somebody left on a lawn (gen.js KNOWN_THINGS)
//   setArt(kit)    the painted board everything flat is cut from, as one texture
//   sheet, beam    a flat piece and a length of timber between any two points
//   fence, flat    a run of pickets and a braced flat, anywhere, at any angle
//   daylight(c)    the tubes of a room too big to be lit one lamp to a panel
import { lin, ticks, WHITE } from './kit.js';
import { TILE } from './gen.js';
import { FENCE, FLAT } from './quiet.js';

const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const PPM = 40;                                    // painted pixels to the metre, as everywhere down here
/** The office's own carpet, which is what is under all of it. */
export const CARPET = '#857c62';
export const BOARD = [0.74, 0.6, 0.4], TIMBER = [0.78, 0.66, 0.46], WHITEWASH = [0.93, 0.92, 0.86];

/* ---- the painted board ---------------------------------------------------------------------------------- */

// name → [x, y, w, h] on the sheet, in pixels
const CELLS = {
  cloudA: [0, 0, 96, 40], cloudB: [96, 0, 64, 32], cloudC: [160, 0, 48, 24], picket: [208, 0, 48, 40],
  ply: [256, 0, 48, 96], streetA: [304, 0, 48, 96], streetB: [352, 0, 48, 96], streetC: [400, 0, 48, 96],
  flamingo: [448, 0, 24, 40], flamingoBack: [472, 0, 24, 40],
  hillA: [0, 40, 96, 36], hillB: [96, 40, 96, 36], hose: [208, 40, 32, 32],
  tree: [0, 96, 64, 112], treeBack: [64, 96, 64, 112], duck: [128, 96, 32, 28], duckBack: [160, 96, 32, 28], bush: [192, 96, 48, 32],
  corn: [256, 96, 48, 80], mallA: [304, 96, 96, 48], mallB: [400, 96, 96, 48],
};
const SW = 512, SH = 256;

function blob(g, col, list) { g.fillStyle = col; for (const [x, y, rx, ry] of list) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); } }
function cloud(g, w, h, puffs) {
  blob(g, '#c9d6de', puffs.map(([x, y, rx, ry]) => [x * w, y * h + 2, rx * w, ry * h]));
  blob(g, '#f6f7f1', puffs.map(([x, y, rx, ry]) => [x * w, y * h, rx * w, ry * h]));
  g.clearRect(0, h - 3, w, 3); P(g, '#c9d6de', w * 0.14, h - 5, w * 0.72, 2);
}
function hills(g, w, h, seed) {
  for (let x = 0; x < w; x++) {
    const far = 10 + Math.round(5 * Math.sin((x / w) * Math.PI * 2 + seed) + 3 * Math.sin((x / w) * Math.PI * 4 + seed * 2.1));
    const near = 20 + Math.round(4 * Math.sin((x / w) * Math.PI * 2 + seed + 2.2) + 2 * Math.sin((x / w) * Math.PI * 6 + seed));
    P(g, '#9cc47a', x, far, 1, h - far); P(g, '#6ea552', x, near, 1, h - near); P(g, '#86b866', x, near, 1, 1);
  }
}
// a street, as far as anybody could remember: sky, a row of houses much too small and all the same, a lawn, a road
function street(g, w, h, k) {
  P(g, '#a9d3ee', 0, 0, w, h); P(g, '#bcdcf0', 0, 34, w, 14); P(g, '#cfe6f2', 0, 48, w, 8);
  if (k === 1) blob(g, '#f6f7f1', [[30, 18, 12, 5], [22, 15, 7, 5], [37, 16, 6, 4]]);
  if (k === 2) blob(g, '#f6f7f1', [[10, 26, 8, 3]]);
  P(g, '#8fbd6e', 0, 56, w, 6);
  const house = (x, body, roof) => { P(g, body, x, 50, 12, 9); g.fillStyle = roof; g.beginPath(); g.moveTo(x - 1, 50); g.lineTo(x + 6, 44); g.lineTo(x + 13, 50); g.fill(); P(g, '#5b4636', x + 5, 54, 2, 5); P(g, '#f3e7a6', x + 1, 52, 3, 3); P(g, '#f3e7a6', x + 8, 52, 3, 3); };
  for (let x = 2 - k * 5; x < w; x += 16) house(x, '#efe9d8', '#8c5145');
  P(g, '#79ad5c', 0, 59, w, h - 59); P(g, '#6ea552', 0, 70, w, h - 70);
  for (let i = 0; i < 26; i++) P(g, '#86b866', (i * 37 + k * 11) % w, 62 + ((i * 23) % 22), 1, 2);
  P(g, '#77787a', 0, 84, w, 10); P(g, '#e9e6d6', 0, 84, w, 1); for (let x = 4 + k * 3; x < w; x += 14) P(g, '#e9e6d6', x, 89, 7, 1);
  P(g, '#6ea552', 0, 94, w, 2);
}
function plyBack(g, w, h) {
  P(g, '#c8a473', 0, 0, w, h);
  for (let y = 0; y < h; y += 3) P(g, y % 9 ? '#c19c6b' : '#b58f5f', 0, y, w, 1);
  blob(g, '#a9824f', [[13, 22, 3, 2], [34, 61, 2, 3], [9, 80, 2, 2]]);
  // the frame it is nailed to, and a rail across
  for (const [x, y, ww, hh] of [[0, 0, w, 4], [0, h - 4, w, 4], [0, 0, 4, h], [w - 4, 0, 4, h], [0, 46, w, 4]]) { P(g, '#dcc08e', x, y, ww, hh); P(g, '#a98a5c', x, y + hh - 1, ww, 1); }
  g.fillStyle = '#5a4026'; g.font = '700 7px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center';
  g.fillText('THIS SIDE', w / 2, 24); g.fillText('BACK', w / 2, 33);
}
function tree(g, w, h, back) {
  P(g, '#7a5236', w / 2 - 4, h * 0.5, 8, h * 0.5); P(g, '#63402a', w / 2 + 1, h * 0.5, 3, h * 0.5);
  blob(g, '#4f8f45', [[w / 2, 38, 28, 30], [w / 2 - 12, 52, 18, 16], [w / 2 + 13, 50, 17, 17], [w / 2 + 2, 20, 18, 16]]);
  blob(g, '#6fae58', [[w / 2 - 8, 26, 9, 7], [w / 2 + 10, 36, 8, 6], [w / 2 - 14, 46, 6, 5]]);
  if (back) { g.globalCompositeOperation = 'source-in'; P(g, '#c8a473', 0, 0, w, h); g.globalCompositeOperation = 'source-atop'; for (let y = 0; y < h; y += 3) P(g, '#b99364', 0, y, w, 1); P(g, '#dcc08e', w / 2 - 3, 6, 6, h); P(g, '#dcc08e', 6, 44, w - 12, 5); g.globalCompositeOperation = 'source-over'; }
}
function flamingo(g, w, h, back) {
  g.strokeStyle = '#e8739a'; g.lineWidth = 3; g.beginPath(); g.moveTo(12, 20); g.quadraticCurveTo(21, 12, 14, 7); g.stroke();
  blob(g, '#f08db0', [[10, 22, 8, 5.5]]); blob(g, '#e8739a', [[13, 6, 3, 2.6]]); P(g, '#2a2420', 15, 6, 4, 2); P(g, '#e8739a', 5, 21, 6, 2);
  P(g, '#3a3632', 10, 27, 1, 13);
  if (back) { g.globalCompositeOperation = 'source-in'; P(g, '#b08a5c', 0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
}
function duck(g, w, h, back) {
  blob(g, '#f2c230', [[14, 17, 12, 8], [24, 8, 6.5, 6]]); P(g, '#e8862e', 28, 8, 4, 3); P(g, '#2a2420', 24, 6, 2, 2);
  g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(2, 14); g.lineTo(0, 6); g.lineTo(8, 12); g.fill(); blob(g, '#dba51c', [[13, 18, 6, 4]]);
  if (back) { g.globalCompositeOperation = 'source-in'; P(g, '#c8a473', 0, 0, w, h); g.globalCompositeOperation = 'source-over'; }
}
// a field of corn by somebody who was told about one: the same stalk, the same ear, at the same height, for ever
function corn(g, w, h) {
  for (let x = 2; x < w; x += 8) {
    P(g, '#5f8f3a', x + 3, 4, 2, h - 4); P(g, '#4b7630', x + 4, 4, 1, h - 4);
    for (let y = 12; y < h; y += 14) { g.fillStyle = '#6fa544'; g.beginPath(); g.moveTo(x + 4, y + 6); g.quadraticCurveTo(x + 9, y, x + 10, y + 5); g.quadraticCurveTo(x + 8, y + 3, x + 4, y + 8); g.fill(); g.beginPath(); g.moveTo(x + 4, y + 12); g.quadraticCurveTo(x - 1, y + 6, x - 2, y + 11); g.quadraticCurveTo(x, y + 9, x + 4, y + 14); g.fill(); }
    P(g, '#e6c648', x + 5, 30, 3, 8); P(g, '#c9a52f', x + 7, 30, 1, 8); P(g, '#d9cf9a', x + 3, 1, 4, 4);
  }
}
// a row of shops, drawn straight on the paint with a marker by somebody who had them described: boxes, a sign each, somewhere to leave a car
function mall(g, w, h, k) {
  g.strokeStyle = '#2c3f5c'; g.fillStyle = '#2c3f5c'; g.lineWidth = 1;
  const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0 + 0.5, y0 + 0.5); g.lineTo(x1 + 0.5, y1 + 0.5); g.stroke(); };
  line(0, 34, w, 34); line(0, 10, w, 10);
  const names = k ? ['STOR', 'SHOPE', 'OPEN OPEN'] : ['SHOP', 'STORE 2', 'SHOP'];
  for (let i = 0; i < 3; i++) {
    const x = i * 32; line(x, 10, x, 34); g.strokeRect(x + 4.5, 13.5, 23, 6); g.strokeRect(x + 4.5, 22.5, 10, 11); g.strokeRect(x + 17.5, 23.5, 10, 7);
    g.font = '5px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.fillText(names[i], x + 16, 18.5);
  }
  for (let x = 6; x < w; x += 12) line(x, 38, x - 4, 47);
  if (k) { line(80, 34, 80, 2); line(80, 2, 86, 2); g.strokeRect(84.5, 2.5, 4, 2); }
}
const DRAW = {
  cloudA: (g, w, h) => cloud(g, w, h, [[0.3, 0.6, 0.26, 0.32], [0.52, 0.42, 0.24, 0.38], [0.72, 0.62, 0.22, 0.28], [0.5, 0.7, 0.4, 0.22]]),
  cloudB: (g, w, h) => cloud(g, w, h, [[0.32, 0.58, 0.26, 0.32], [0.6, 0.48, 0.28, 0.4], [0.5, 0.72, 0.38, 0.2]]),
  cloudC: (g, w, h) => cloud(g, w, h, [[0.36, 0.56, 0.28, 0.34], [0.64, 0.6, 0.26, 0.3]]),
  picket: (g, w, h) => {
    for (let x = 3; x < w; x += 12) { P(g, '#f1efe4', x, 4, 6, h - 4); P(g, '#f1efe4', x + 1, 2, 4, 2); P(g, '#f1efe4', x + 2, 0, 2, 2); P(g, '#cfccbd', x + 5, 4, 1, h - 4); }
    P(g, '#e4e1d3', 0, 11, w, 3); P(g, '#c4c1b2', 0, 14, w, 1); P(g, '#e4e1d3', 0, 30, w, 3); P(g, '#c4c1b2', 0, 33, w, 1);
  },
  ply: plyBack, streetA: (g, w, h) => street(g, w, h, 0), streetB: (g, w, h) => street(g, w, h, 1), streetC: (g, w, h) => street(g, w, h, 2),
  flamingo: (g, w, h) => flamingo(g, w, h, false), flamingoBack: (g, w, h) => flamingo(g, w, h, true),
  hillA: (g, w, h) => hills(g, w, h, 0.4), hillB: (g, w, h) => hills(g, w, h, 3.1),
  hose: (g) => { g.strokeStyle = '#3f8a4a'; g.lineWidth = 2.4; for (const r of [6, 9.5, 13]) { g.beginPath(); g.arc(16, 16, r, 0, 7); g.stroke(); } g.strokeStyle = '#2f6b3a'; g.lineWidth = 1; for (const r of [7, 10.5, 14]) { g.beginPath(); g.arc(16, 16, r, 0.6, 3.4); g.stroke(); } P(g, '#c9a43a', 26, 3, 4, 3); },
  tree: (g, w, h) => tree(g, w, h, false), treeBack: (g, w, h) => tree(g, w, h, true),
  duck: (g, w, h) => duck(g, w, h, false), duckBack: (g, w, h) => duck(g, w, h, true),
  corn, mallA: (g, w, h) => mall(g, w, h, 0), mallB: (g, w, h) => mall(g, w, h, 1),
  bush: (g) => { blob(g, '#4f8f45', [[14, 20, 13, 12], [30, 18, 14, 14], [24, 24, 20, 8]]); blob(g, '#6fae58', [[12, 16, 5, 4], [32, 12, 6, 4]]); },
};
/** The sheet of painted board, and where each thing is on it: art.uv(name, mirrored) → [u0, v0, u1, v1]; art.size(name) → [w, h] in metres. */
export function setArt(kit) {
  const texture = kit.tex.custom('suburb:set', SW, SH, (g) => {
    for (const [name, [x, y, w, h]] of Object.entries(CELLS)) { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w, h); g.clip(); DRAW[name](g, w, h); g.restore(); g.globalCompositeOperation = 'source-over'; }
  }, { clamp: true });
  const uv = (name, mirror = false) => { const [x, y, w, h] = CELLS[name], u0 = x / SW, u1 = (x + w) / SW; return [mirror ? u1 : u0, 1 - (y + h) / SH, mirror ? u0 : u1, 1 - y / SH]; };
  return { texture, uv, size: (name) => [CELLS[name][2] / PPM, CELLS[name][3] / PPM] };
}
/** The batch everything cut from that sheet is drawn into: one mesh a room. */
export const cutBatch = (c) => c.mapped('suburb:set', setArt(c.kit).texture, { cutout: true });

/* ---- pieces ------------------------------------------------------------------------------------------------- */

/**
 * A flat piece between four corners (bottom-left, bottom-right, top-right, top-left as seen from the side it faces), cut
 * nu × nv so that the light has something to hold on to. uv: [u0, v0, u1, v1], or (s, t) → [u, v] for 0…1 across and up.
 */
export function sheet(batch, a, b, cc, d, nu = 1, nv = 1, uv = null, alb = WHITE, ao = 1) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1; nx /= len; ny /= len; nz /= len;
  const base = batch.verts;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const s = i / nu, t = j / nv;
    for (let k = 0; k < 3; k++) batch.pos.push((a[k] * (1 - s) + b[k] * s) * (1 - t) + (d[k] * (1 - s) + cc[k] * s) * t);
    batch.nor.push(nx, ny, nz);
    const q = typeof uv === 'function' ? uv(s, t) : uv ? [uv[0] + (uv[2] - uv[0]) * s, uv[1] + (uv[3] - uv[1]) * t] : [s, t];
    batch.uv.push(q[0], q[1]); batch.alb.push(alb[0], alb[1], alb[2]); batch.ao.push(ao);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const p = base + j * (nu + 1) + i; batch.idx.push(p, p + 1, p + nu + 2, p, p + nu + 2, p + nu + 1); }
  return batch;
}
/** An upright flat piece from (ax, az) to (bx, bz), y0 to y1: it faces whoever sees a on their left. */
export const upright = (batch, ax, az, bx, bz, y0, y1, uv, alb, ao) => sheet(batch, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 0.6)), Math.max(1, Math.round((y1 - y0) / 0.8)), uv, alb, ao);
/** A length of square timber from a to b, t thick. */
export function beam(batch, a, b, t = 0.05, alb = TIMBER, ao = 1) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, e = d.map((v) => v / L);
  const ref = Math.abs(e[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  let p = [e[1] * ref[2] - e[2] * ref[1], e[2] * ref[0] - e[0] * ref[2], e[0] * ref[1] - e[1] * ref[0]]; const pl = Math.hypot(...p); p = p.map((v) => (v / pl) * t / 2);
  let q = [e[1] * p[2] - e[2] * p[1], e[2] * p[0] - e[0] * p[2], e[0] * p[1] - e[1] * p[0]]; const ql = Math.hypot(...q); q = q.map((v) => (v / ql) * t / 2);
  const at = (o, sp, sq) => [o[0] + sp * p[0] + sq * q[0], o[1] + sp * p[1] + sq * q[1], o[2] + sp * p[2] + sq * q[2]];
  const n = Math.max(1, Math.round(L / 1.2));
  // four faces, each wound to face out (p × e = q's side, and so round)
  for (const [s0, t0, s1, t1] of [[1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1], [-1, -1, 1, -1]]) sheet(batch, at(a, s0, t0), at(a, s1, t1), at(b, s1, t1), at(b, s0, t0), 1, n, null, alb, ao);
  return batch;
}

/** A run of picket fence from (ax, az) to (bx, bz): pickets on both faces, a post at either end. Solid where it runs square to the room. */
export function fence(c, ax, az, bx, bz, opt = {}) {
  const art = setArt(c.kit), cut = cutBatch(c), len = Math.hypot(bx - ax, bz - az), h = opt.h || FENCE.h;
  if (len < 0.05) return;
  const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, [mw] = art.size('picket'), uv = art.uv('picket');
  for (let s = 0; s < len - 0.01; s += mw) {
    const e = Math.min(len, s + mw), part = [uv[0], uv[1], uv[0] + (uv[2] - uv[0]) * ((e - s) / mw), uv[3]];
    for (const k of [1, -1]) {
      const o = 0.022 * k, x0 = ax + ux * s + nx * o, z0 = az + uz * s + nz * o, x1 = ax + ux * e + nx * o, z1 = az + uz * e + nz * o;
      // (opt.hang: the same fence, the other way up, from that height down)
      const y0 = opt.hang ? opt.hang - h : 0.02, y1 = opt.hang || h, pv = opt.hang ? [part[0], part[3], part[2], part[1]] : part;
      if (k > 0) upright(cut, x0, z0, x1, z1, y0, y1, pv); else upright(cut, x1, z1, x0, z0, y0, y1, [pv[2], pv[1], pv[0], pv[3]]);
    }
  }
  if (opt.hang) return;
  for (const [x, z] of opt.posts === false ? [] : [[ax, az], [bx, bz]]) { c.flat.box(x - 0.05, 0, z - 0.05, x + 0.05, h + 0.07, z + 0.05, WHITEWASH, { skip: '-y' }); c.flat.box(x - 0.065, h + 0.07, z - 0.065, x + 0.065, h + 0.1, z + 0.065, WHITEWASH); }
  if (opt.solid !== false && (Math.abs(ux) > 0.999 || Math.abs(uz) > 0.999)) c.solid(Math.min(ax, bx) - 0.05, Math.min(az, bz) - 0.05, Math.max(ax, bx) + 0.05, Math.max(az, bz) + 0.05, { keep: !!opt.keep });
  for (let s = 0; s <= len; s += 0.6) c.reserve(ax + ux * s, az + uz * s, 0.4);
}

/**
 * A scenic flat: a sheet of board from (ax, az) to (bx, bz), painted with `front` on the side that sees a on its left and
 * bare on the other. opt: h, back (the art for the back: the board, unless it is a cut-out shape), brace (how far out behind).
 */
export function flat(c, ax, az, bx, bz, front, opt = {}) {
  const art = setArt(c.kit), cut = cutBatch(c), len = Math.hypot(bx - ax, bz - az), h = opt.h || FLAT.h;
  const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux, o = 0.012, fu = art.uv(front), bu = art.uv(opt.back || 'ply', !!opt.back);
  // (where the ceiling is lower than the sheet, the sheet was sawn off at the top: the picture loses its sky, not its road)
  const crop = (uv) => [uv[0], uv[1], uv[2], uv[1] + (uv[3] - uv[1]) * Math.min(1, h / (opt.full || h))];
  upright(cut, ax + nx * o, az + nz * o, bx + nx * o, bz + nz * o, 0, h, crop(fu));
  upright(cut, bx - nx * o, bz - nz * o, ax - nx * o, az - nz * o, 0, h, crop(bu));
  if (opt.brace) brace(c, (ax + bx) / 2 - nx * o, (az + bz) / 2 - nz * o, -nx, -nz, opt.brace, Math.min(h * 0.72, 1.75));
  if (opt.solid !== false && (Math.abs(ux) > 0.999 || Math.abs(uz) > 0.999)) c.solid(Math.min(ax, bx) - 0.03, Math.min(az, bz) - 0.03, Math.max(ax, bx) + 0.03, Math.max(az, bz) + 0.03, { tall: h > 1.25, keep: !!opt.keep });
  c.reserve((ax + bx) / 2, (az + bz) / 2, len / 2 + 0.2);
}
/** What holds a flat up: a length of timber from part-way up its back down to the floor `reach` out behind, a rail along the floor, a sandbag on the rail. */
export function brace(c, x, z, dx, dz, reach = FLAT.brace, up = 1.7) {
  const fx = x + dx * reach, fz = z + dz * reach;
  beam(c.flat, [x, up, z], [fx, 0.04, fz], 0.045); beam(c.flat, [x, 0.025, z], [fx, 0.025, fz], 0.045);
  c.flat.ball(x + dx * reach * 0.72, 0.1, z + dz * reach * 0.72, 0.19, [0.62, 0.56, 0.42], 0.5, 7);
  c.shadow(x + dx * reach * 0.6, z + dz * reach * 0.6, 0.3 + Math.abs(dx) * reach * 0.6, 0.3 + Math.abs(dz) * reach * 0.6, 0.35);
}

/* ---- a plain room's layout, where it is not wall (quiet.js: `prop` on a pillar) ------------------------------------- */

/** One piece of it. The room's frame; the pillar says where, how high, and which way round. */
export function standing(c, p) {
  const along = p.w >= p.d, x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, z0 = p.z - p.d / 2, z1 = p.z + p.d / 2;
  if (p.prop === 'fence') {
    if (along) fence(c, x0, p.z, x1, p.z, { h: p.h, keep: true }); else fence(c, p.x, z0, p.x, z1, { h: p.h, keep: true });
  } else if (p.prop === 'flat') {
    // the row stands off the middle of the room, and its back is to the nearer wall (quiet.js `flats`)
    const names = ['streetA', 'streetB', 'streetC'], front = names[(p.art || 0) % 3], o = { h: p.h, full: FLAT.h, keep: true };
    if (along) { if (p.z < 0) flat(c, x0, p.z, x1, p.z, front, o); else flat(c, x1, p.z, x0, p.z, front, o); }
    else if (p.x < 0) flat(c, p.x, z1, p.x, z0, front, o); else flat(c, p.x, z0, p.x, z1, front, o);
  } else if (p.prop === 'brace') {
    // (a brace's pillar reaches out from the back of its flat: the end nearer the middle of the room is the flat's)
    if (along) { const s = p.x < 0 ? -1 : 1; brace(c, s < 0 ? x1 : x0, p.z, s, 0, p.w); } else { const s = p.z < 0 ? -1 : 1; brace(c, p.x, s < 0 ? z1 : z0, 0, s, p.d); }
    c.solid(x0, z0, x1, z1, { keep: true }); c.reserve(p.x, p.z, Math.max(p.w, p.d) / 2 + 0.15);
  }
}

/* ---- the lawn ------------------------------------------------------------------------------------------------ */

/** A piece cut from the board, screwed flat to a wall. */
export function onWall(c, name, side, at, y, opt = {}) {
  const art = setArt(c.kit), [w, h] = art.size(name), k = opt.scale || 1, p = c.wallAt(side, at, opt.off ?? 0.014), U = p.U, hw = (w * k) / 2, hh = (h * k) / 2;
  sheet(cutBatch(c), [p.x - U[0] * hw, y - hh, p.z - U[2] * hw], [p.x + U[0] * hw, y - hh, p.z + U[2] * hw], [p.x + U[0] * hw, y + hh, p.z + U[2] * hw], [p.x - U[0] * hw, y + hh, p.z - U[2] * hw], Math.max(1, Math.round(w * k / 0.8)), 1, art.uv(name, !!opt.mirror));
}
/**
 * What every room of the neighbourhood has, plain or not: the grass stops short of the walls and the carpet shows (not across
 * a doorway: the grass goes on through), and there are clouds on the walls. opt: { clouds: false, border: false, paint: 'sky' | 'corn' | 'mall', wrong: 0…1 (how likely one thing got wrong is), which }
 */
export function lawn(c, opt = {}) {
  const { W, D, R, room } = c, s = room.shape;
  if (room.crawl) return;
  if (opt.border !== false && !(s && (s.kind === 'ell' || s.kind === 'pinch'))) {
    const bw = opt.width || R.pick([0.3, 0.4, 0.4, 0.55]), carpet = c.mapped('suburb:carpet', c.kit.tex.carpet(CARPET)), edge = [0.07, 0.11, 0.05];
    const rect = (x0, z0, x1, z1, y, batch, alb, uv) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) batch.grid([x0, y, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0, 0.5, 0), ticks(x1 - x0, 0.5, 0), uv ? (u, v) => [(x0 + v) / 1.6, (z0 + u) / 1.6] : null, alb); };
    for (const side of ['back', 'front', 'left', 'right']) {
      const ends = side === 'left' || side === 'right', half = (ends ? D : W) / 2, trim = ends ? bw : 0;          // (the side strips stop short of the corners, which are the end strips')
      const cuts = room.doors.filter((d) => d.side === side).map((d) => [d.c - d.w / 2, d.c + d.w / 2]).sort((p, q) => p[0] - q[0]);
      let from = -half + trim;
      for (const [a, b] of [...cuts, [half - trim, half - trim]]) {
        if (a - from > 0.05) {
          const p = c.wallAt(side, from, 0), q = c.wallAt(side, a, bw), e = c.wallAt(side, from, bw + 0.03);
          rect(Math.min(p.x, q.x), Math.min(p.z, q.z), Math.max(p.x, q.x), Math.max(p.z, q.z), 0.011, carpet, WHITE, true);
          rect(Math.min(e.x, q.x), Math.min(e.z, q.z), Math.max(e.x, q.x), Math.max(e.z, q.z), 0.012, c.flat, edge, false);      // the cut edge of the grass, and its shadow
        }
        from = Math.max(from, b);
      }
    }
  }
  // what is on the walls: clouds, mostly. In some rooms a field of corn, or a row of shops, as described to whoever drew them
  const paint = opt.paint || R.pick(['sky', 'sky', 'sky', 'corn', 'corn', 'mall', 'mall']), art = setArt(c.kit), low = paint === 'corn' ? 2.75 : paint === 'mall' ? 1.95 : 1.55;
  c.rt.paint = paint;
  if (paint !== 'sky') for (const side of ['back', 'left', 'right', 'front']) for (const [a, b] of c.spans(side, 0.12, paint === 'corn' ? 2.2 : 1.5)) {
    const [w, h] = art.size(paint === 'corn' ? 'corn' : 'mallA'), n = Math.floor((b - a) / w);
    for (let i = 0; i < n; i++) onWall(c, paint === 'corn' ? 'corn' : (i + (side.length % 2)) % 2 ? 'mallB' : 'mallA', side, a + (b - a - n * w) / 2 + (i + 0.5) * w, 0.11 + h / 2, { off: 0.006 });
  }
  if (opt.clouds !== false) for (const side of ['back', 'left', 'right', 'front']) for (const [a, b] of c.spans(side, 0.3, 2.2)) {
    const len = b - a; if (len < 2.7) continue;
    for (let i = 0, n = Math.max(1, Math.round(len / 5)); i < n; i++) {
      const name = R.pick(['cloudA', 'cloudA', 'cloudB', 'cloudB', 'cloudC']), [w, h] = art.size(name), at = a + (len / n) * (i + R.range(0.3, 0.7));
      const p = c.wallAt(side, at, 0.3), top = c.ceilAt(p.x, p.z), hi = Math.min(top - h / 2 - 0.25, opt.cloudTop || 2.9);
      if (hi < low) continue;
      const y = R.range(low, Math.max(low, hi));
      if (at - w / 2 < a || at + w / 2 > b || y + h / 2 > top - 0.1) continue;
      onWall(c, name, side, at, y, { mirror: R.chance(0.5) });
    }
  }
  // …and in some lawns that have nothing else, one thing that whoever built this got wrong (WRONG, below)
  const chance = opt.wrong ?? (!room.quiet && !s && room.kind === 'plain' && Math.min(W, D) >= 3.4 ? 0.4 : 0);
  if (chance > 0 && R.chance(chance)) { const name = opt.which || R.pick(Object.keys(WRONG)); if (WRONG[name](c) !== false) c.rt.weird = name; }
}

/* ---- got wrong: what a lawn has on it when whoever built it had only been told ------------------------------------- */

function flamingoAt(c, x, z, turn) {
  const art = setArt(c.kit), cut = cutBatch(c), dx = Math.cos(turn) * 0.3, dz = Math.sin(turn) * 0.3;
  upright(cut, x - dx, z - dz, x + dx, z + dz, 0, 1.0, art.uv('flamingo')); upright(cut, x + dx, z + dz, x - dx, z - dz, 0, 1.0, art.uv('flamingoBack', true));
  c.shadow(x, z, 0.3, 0.3, 0.3);
}
/** A car, as far down in the lawn as its door handles, its lamps still on. Along x, or along z. */
export function car(c, x, z, along = true, rgb = [0.6, 0.52, 0.38]) {
  const B = (u0, y0, v0, u1, y1, v1, col, o) => (along ? c.flat.box(x + u0, y0, z + v0, x + u1, y1, z + v1, col, o) : c.flat.box(x + v0, y0, z + u0, x + v1, y1, z + u1, col, o));
  B(-2.1, 0, -0.85, 2.1, 0.42, 0.85, rgb, { skip: '-y' }); B(-2.1, 0.16, -0.86, 2.1, 0.3, 0.86, [0.36, 0.22, 0.12]);          // the body, and the strip of wood down its side
  B(-1.25, 0.42, -0.74, 0.75, 0.86, 0.74, [0.07, 0.09, 0.11]); B(-1.3, 0.86, -0.78, 0.8, 0.93, 0.78, rgb);                    // glass all round, a roof
  for (const u of [-1.28, -0.28, 0.72]) for (const v of [-0.76, 0.72]) B(u, 0.42, v, u + 0.07, 0.86, v + 0.04, rgb);
  B(-0.9, 0.93, -0.6, 0.4, 0.97, -0.55, [0.6, 0.6, 0.6]); B(-0.9, 0.93, 0.55, 0.4, 0.97, 0.6, [0.6, 0.6, 0.6]);               // somewhere to put the luggage
  const glow = c.shining('suburb:lamp', c.kit.tex.white(), 1.6, lin('#ffe9a8'));
  for (const v of [-0.6, 0.6]) { const p = along ? [x + 2.105, z + v] : [x + v, z + 2.105], q = 0.11; if (along) sheet(glow, [p[0], 0.22, p[1] + q], [p[0], 0.22, p[1] - q], [p[0], 0.36, p[1] - q], [p[0], 0.36, p[1] + q]); else sheet(glow, [p[0] - q, 0.22, p[1]], [p[0] + q, 0.22, p[1]], [p[0] + q, 0.36, p[1]], [p[0] - q, 0.36, p[1]]); }
  c.light(x + (along ? 2.5 : 0), 0.35, z + (along ? 0 : 2.5), '#ffe9a8', 0.5, { k: 1.1, far: 4 });
  if (along) c.solid(x - 2.1, z - 0.85, x + 2.1, z + 0.85); else c.solid(x - 0.85, z - 2.1, x + 0.85, z + 2.1);
  c.blot(x, z, along ? 5.2 : 2.6, along ? 2.6 : 5.2, { a: 0.45 }); c.reserve(x, z, 2.3);
}
export const WRONG = {
  // one sprinkler head (the one thing here that is where it should be)
  sprinkler(c) { const at = c.spot(0.3, { pad: 1 }); if (!at) return false; sprinkler(c, at.x, at.z); },
  // every letter box the street had, delivered to one corner
  pile(c) {
    const k = c.corner(1.0); if (!k) return false;
    const R = c.R;
    for (const [n, r, y] of [[13, 0.85, 0], [8, 0.55, 0.19], [4, 0.28, 0.38], [1, 0, 0.57]]) for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + R.range(-0.3, 0.3), x = k.x + Math.cos(a) * r * R.range(0.6, 1), z = k.z + Math.sin(a) * r * R.range(0.6, 1), t = R.chance(0.5), hw = t ? 0.22 : 0.1, hd = t ? 0.1 : 0.22, g = R.range(0.3, 0.46);
      c.flat.box(x - hw, y, z - hd, x + hw, y + 0.19, z + hd, [g * 0.9, g, g * 1.15], y ? {} : { skip: '-y' });
      c.flat.box(x - 0.015, y + 0.19, z - 0.015, x + 0.015, y + 0.19 + R.range(0.04, 0.2), z + 0.015, [0.75, 0.12, 0.1]);
    }
    c.solid(k.x - 0.8, k.z - 0.8, k.x + 0.8, k.z + 0.8); c.shadow(k.x, k.z, 2, 2, 0.4);
  },
  // the fence, where the description said it went: up
  ceilfence(c) {
    const { W, D } = c, x = c.ceilAt(0, 0);
    if (x < 2.5) return false;
    if (W >= D) fence(c, -W / 2 + 0.02, D * 0.12, W / 2 - 0.02, D * 0.12, { hang: x }); else fence(c, W * 0.12, -D / 2 + 0.02, W * 0.12, D / 2 - 0.02, { hang: x });
  },
  // a second lawn, overhead, with its own sprinkler
  ceillawn(c) {
    const { W, D } = c, y = c.ceilAt(0, 0) - 0.012, w = Math.min(3.6, W - 1.8), d = Math.min(2.4, D - 1.8);
    if (c.ceilAt(w / 2, d / 2) !== c.ceilAt(-w / 2, -d / 2)) return false;
    c.floor.grid([-w / 2, y, -d / 2], [1, 0, 0], [0, 0, 1], ticks(w, 0.6, 0), ticks(d, 0.6, 0), (u, v) => [u / 1.6, v / 1.6]);
    c.flat.box(-0.03, y - 0.07, -0.03, 0.03, y, 0.03, [0.06, 0.06, 0.06]); c.flat.box(-0.02, y - 0.085, -0.02, 0.02, y - 0.07, 0.02, [0.7, 0.55, 0.2]);
  },
  // flamingos: one was mentioned. Nobody said how many
  flock(c) {
    const { W, D } = c, d = c.room.doors[0], p = d ? c.doorPoint(d, 0) : { x: 0, z: D / 2 };
    let n = 0;
    for (let x = -W / 2 + 1.2; x <= W / 2 - 1.2; x += 0.95) for (let z = -D / 2 + 1.2; z <= D / 2 - 1.2; z += 0.95) { if (!c.clear(x, z, 0.3, 1.2)) continue; flamingoAt(c, x, z, Math.atan2(x - p.x, p.z - z)); n++; }
    return n > 3 ? undefined : false;
  },
  // a car, most of the way down
  car(c) {
    const { W, D } = c, along = W >= D;
    if (Math.max(W, D) < 6.6 || Math.min(W, D) < 4.6) return false;
    const x = along ? 0 : c.R.pick([-0.5, 0.5]), z = along ? c.R.pick([-0.5, 0.5]) : 0;
    if (!c.clear(x, z, 0.9) || !c.clear(x + (along ? 1.5 : 0), z + (along ? 0 : 1.5), 0.9) || !c.clear(x - (along ? 1.5 : 0), z - (along ? 0 : 1.5), 0.9)) return false;
    car(c, x, z, along);
  },
};
export function sprinkler(c, x, z) {
  c.flat.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.07, z + 0.03, [0.06, 0.06, 0.06], { skip: '-y' });
  c.flat.box(x - 0.02, 0.07, z - 0.02, x + 0.02, 0.085, z + 0.02, [0.7, 0.55, 0.2]);
  c.blot(x, z, 0.5, 0.5, { a: 0.3 });
}

/* ---- a room too big for a lamp to every panel ----------------------------------------------------------------- */

/**
 * The ceiling's tubes, for a room whose shell was built with `panels: false` (its deck line still says `lights: 'normal'`):
 * `cols` × `rows` lit panels, and a lamp to every `every`-th of them (the light budget is sixteen a room).
 */
export function daylight(c, cols, rows, every = 1, power = 1) {
  const { W, D, H, kit } = c, tube = lin(c.look.tube), on = c.shining('panel', kit.tex.panel(true), 2.5, tube), uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const head = Math.max(0.3, Math.min(2.5, H / 2.6));
  let k = 0;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++, k++) {
    const x = (Math.round((-W / 2 + (i + 0.5) * W / cols) / TILE - 0.5) + 0.5) * TILE, z = Math.round((-D / 2 + (j + 0.5) * D / rows) / TILE) * TILE, y = H - 0.006;
    on.quad([x - TILE / 2, y, z - TILE], [x + TILE / 2, y, z - TILE], [x + TILE / 2, y, z + TILE], [x - TILE / 2, y, z + TILE], WHITE, uv);
    if ((i + j * 2) % every === 0) c.light(x, H - 0.14, z, tube, 1.05 * power * Math.pow(head, 1.5), { axis: [0, -1, 0], floor: 0.24, k: 3.4 * head, far: 14 * head });
  }
}

/* ---- what somebody left on a lawn (themes.js `dressing`) ------------------------------------------------------- */

export const THINGS = {
  // a letter box on a post, its flag up: nothing has been collected
  mailbox(c, item) {
    const s = c.spot(0.4, { head: 1.6 }); if (!s) return;
    postbox(c, s.x, s.z, item.turn);
  },
  // a flamingo, cut out of board, on a wire
  flamingo(c, item) {
    const s = c.spot(0.45, { head: 1.3 }); if (!s) return;
    flamingoAt(c, s.x, s.z, item.turn);
  },
  // a garden hose, coiled, connected to nothing
  hose(c, item) {
    const s = c.spot(0.5); if (!s) return;
    const art = setArt(c.kit), u = art.uv('hose');
    c.lay(cutBatch(c), s.x, s.z, 0.8, 0.8, item.turn, [[u[0], u[1]], [u[2], u[1]], [u[2], u[3]], [u[0], u[3]]], WHITE, 0.03);
    c.blot(s.x, s.z, 0.9, 0.9, { a: 0.35 });
  },
};
/** A letter box on a post. opt.plate: a batch and uv for what is written on its side. */
export function postbox(c, x, z, rot = 0, opt = {}) {
  const along = Math.abs(Math.sin(rot)) > 0.7, hw = along ? 0.11 : 0.24, hd = along ? 0.24 : 0.11, body = opt.rgb || [0.32, 0.36, 0.42];
  c.flat.box(x - 0.04, 0, z - 0.04, x + 0.04, 1.02, z + 0.04, TIMBER, { skip: '-y' });
  c.flat.box(x - hw, 1.02, z - hd, x + hw, 1.2, z + hd, body); c.flat.box(x - hw * 0.86, 1.2, z - hd * 0.86, x + hw * 0.86, 1.25, z + hd * 0.86, body);
  // the flag, up
  if (along) c.flat.box(x + hw, 1.1, z - 0.02, x + hw + 0.012, 1.36, z + 0.02, [0.75, 0.12, 0.1]); else c.flat.box(x - 0.02, 1.1, z + hd, x + 0.02, 1.36, z + hd + 0.012, [0.75, 0.12, 0.1]);
  c.solid(x - 0.12, z - 0.12, x + 0.12, z + 0.12); c.shadow(x, z, 0.3, 0.3, 0.4); c.reserve(x, z, 0.4);
  return { top: 1.25, hw, hd, along };
}
