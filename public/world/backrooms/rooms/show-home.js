// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Show
// Home ("the house with its lights on"). A house with a front garden, a fence
// and a gate, a letter box with the visitor's own name on it, in a room with a
// suspended ceiling: the chimney goes up through the tiles. From the gate it is
// a house, and its windows are lit. The front door is a door. Behind it there
// is no back wall and half a roof: bare board, the timber that holds the front
// up, two boxes of tubes where the windows are, and a desk with its monitor on.
//
// What is real: the door, the fence, the gate, the desk. What is a prop: the
// tree, the bushes, the windows, most of the house. Nothing in it is used.
// Where it all stands is rooms/show-home/layout.js, which the deck asks too.
import { atlas, drawText, ticks, WHITE } from '../kit.js';
import { P } from '../bits.js';
import { Vox, M } from '../../vox/vox.js';
import { sunk, SUNK } from '../quiet.js';
import { lawn, fence, flat, sheet, upright, beam, brace, daylight, onWall, postbox, doorVox, gnomeVox, CARPET, TIMBER, WHITEWASH } from '../suburb.js';
import { HOME, homePlan } from './show-home/layout.js';

/** A window box: a trough of earth, and what an office thinks flowers are: all of them the same one, in a row. */
const flowerBox = () => { const v = new Vox(); v.box(-20, 0, -3, 20, 5, 3, M('#efe9d8', 1)); v.box(-19, 4, -2, 19, 6, 2, M('#3a2a1c', 3)); for (let x = -17; x <= 17; x += 4.25) { v.tube(x, 6, 0, x, 10, 0, 0.5, M('#3f7a3a', 1)); v.ellipsoid(x, 11.4, 0, 1.7, 1.5, 1.5, M('#d9433a', 1)); v.set(Math.round(x), 11, 1, M('#f3d44a', 0)); v.box(x - 2, 7.4, -0.5, x, 8.2, 0.5, M('#3f7a3a', 1)); } return v; };
const hexRgb = (hex) => [1, 3, 5].map((i) => Math.pow(parseInt(hex.slice(i, i + 2), 16) / 255, 2.2));

export function build(c) {
  const { H, params: p, kit } = c, h = homePlan(c.room);
  const { x0, x1, back, front, mid, ridge, slope } = h, t = HOME.t, wh = HOME.wall, dx = h.doorX, dw = HOME.door.w / 2, dh = HOME.door.h;
  c.shell({ panels: false });
  daylight(c, 4, 3, 1, 1.1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.55, cloudTop: H - 1.3 });
  for (const side of ['back', 'left', 'right']) for (const [a, b] of c.spans(side, 0.2, 2)) for (let at = a + 1.2, k = 0; at + 1.2 <= b; at += 2.4, k++) onWall(c, k % 2 ? 'hillB' : 'hillA', side, at, 0.11 + 0.45, { off: 0.006 });

  /* what it is made of */
  const siding = c.mapped('home:siding', kit.tex.custom('home:siding', 32, 32, (g, w, hh) => { P(g, '#eceadf', 0, 0, w, hh); for (let y = 0; y < hh; y += 8) { P(g, '#f6f5ee', 0, y, w, 1); P(g, '#b9b6a8', 0, y + 7, w, 1); P(g, '#d9d6c9', 0, y + 6, w, 1); } }));
  const shingle = c.mapped('home:shingle', kit.tex.custom('home:shingle', 32, 32, (g, w, hh) => { P(g, '#5b4b46', 0, 0, w, hh); for (let y = 0; y < hh; y += 8) { P(g, '#3d322f', 0, y + 7, w, 1); P(g, '#6c5a54', 0, y, w, 1); for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) P(g, '#3d322f', x, y, 1, 8); } }));
  const studs = c.mapped('home:studs', kit.tex.custom('home:studs', 48, 48, (g, w, hh) => { P(g, '#b8935f', 0, 0, w, hh); for (let y = 0; y < hh; y += 3) P(g, y % 9 ? '#b08a57' : '#a47f4e', 0, y, w, 1); for (const x of [0, 24]) { P(g, '#dcc08e', x, 0, 4, hh); P(g, '#8d6c41', x + 4, 0, 1, hh); } P(g, '#dcc08e', 0, 22, w, 4); P(g, '#8d6c41', 0, 26, w, 1); }));
  const bricks = c.mapped('home:brick', kit.tex.brick());
  const words = atlas(kit, `home:words:${p.number}:${p.name}:${p.board.join('|')}`, 128, 80, 3, (g, i, w, hh) => {
    if (i === 0) { P(g, '#f4f1e4', 0, 0, w, hh); P(g, '#b3261e', 0, 0, w, 26); drawText(g, [p.board[0]], 0, 0, w, 26, { color: '#f4f1e4', size: 19 }); drawText(g, p.board.slice(1), 0, 28, w, hh - 30, { color: '#22201c', size: 13, pad: 8 }); }
    else if (i === 1) { P(g, '#1d1c1a', 0, 0, w, hh); drawText(g, [p.number], 0, 0, w, hh, { color: '#e8d9a0', size: 52, pad: 10 }); }
    else { P(g, '#32363f', 0, 0, w, hh); drawText(g, [p.name], 0, 0, w, hh, { color: '#f1efe4', size: 30, pad: 10 }); }
  });
  const wordB = c.mapped('home:words', words.texture), cell = (i) => { const q = words.uv(i); return [q[0][0], q[0][1], q[2][0], q[2][1]]; };
  // a face of something built in courses or sheets: the texture repeats every `rep` metres, measured along and up
  const face = (batch, ax, az, bx, bz, y0, y1, rep, ao = 1) => { const len = Math.hypot(bx - ax, bz - az); return upright(batch, ax, az, bx, bz, y0, y1, (s, v) => [(s * len) / rep, (y0 + v * (y1 - y0)) / rep], WHITE, ao); };
  const IN = 0.55;                                    // how much of the light gets inside (nothing down here casts a shadow: this is the roof's)

  /* the front, and the two sides: finished outside, bare inside */
  const box = (bx0, by0, bz0, bx1, by1, bz1, skip) => siding.box(bx0, by0, bz0, bx1, by1, bz1, WHITE, { uv: 0.8, skip });
  box(x0, 0, front - t, dx - dw, wh, front, '-z-y'); box(dx + dw, 0, front - t, x1, wh, front, '-z-y'); box(dx - dw, dh, front - t, dx + dw, wh, front, '-z');
  box(x0, 0, back, x0 + t, wh, front - t, '+x-y'); box(x1 - t, 0, back, x1, wh, front - t, '-x-y');
  face(studs, x1 - t, front - t, dx + dw, front - t, 0, wh, 1.2, IN); face(studs, dx - dw, front - t, x0 + t, front - t, 0, wh, 1.2, IN); face(studs, dx + dw, front - t, dx - dw, front - t, dh, wh, 1.2, IN);
  face(studs, x0 + t, front - t, x0 + t, back, 0, wh, 1.2, IN); face(studs, x1 - t, back, x1 - t, front - t, 0, wh, 1.2, IN);
  c.solid(x0, front - t, dx - dw, front, { tall: true }); c.solid(dx + dw, front - t, x1, front, { tall: true });
  c.solid(x0, back, x0 + t, front, { tall: true }); c.solid(x1 - t, back, x1, front, { tall: true });
  // the gables (each a sheet that comes to a point), outside and in
  const gable = (batch, x, za, zb, rep, ao) => sheet(batch, [x, wh, za], [x, wh, zb], [x, ridge, mid], [x, ridge, mid], 6, 3, (s, v) => [((za + (zb - za) * s) * (1 - v) + mid * v) / rep, (wh + HOME.rise * v) / rep], WHITE, ao);
  gable(siding, x0, back, front, 0.8, 1); gable(siding, x1, front, back, 0.8, 1); gable(studs, x0 + t, front, back, 1.2, IN); gable(studs, x1 - t, back, front, 1.2, IN);

  /* the roof: the half that can be seen from the gate, and the rafters of the other */
  const ez = front + HOME.eave, ey = wh - HOME.eave * slope, rx0 = x0 - 0.3, rx1 = x1 + 0.3, run = Math.hypot(ez - mid, ridge - ey);
  sheet(shingle, [rx0, ey, ez], [rx1, ey, ez], [rx1, ridge, mid], [rx0, ridge, mid], 12, 4, (s, v) => [(rx0 + (rx1 - rx0) * s) / 0.8, (v * run) / 0.8]);
  sheet(studs, [rx1, ey - 0.03, ez], [rx0, ey - 0.03, ez], [rx0, ridge - 0.03, mid], [rx1, ridge - 0.03, mid], 12, 4, (s, v) => [(rx1 - (rx1 - rx0) * s) / 1.2, (v * run) / 1.2], WHITE, IN);
  c.flat.box(rx0, ey - 0.14, ez - 0.03, rx1, ey + 0.01, ez, WHITEWASH);
  beam(c.flat, [rx0, ridge - 0.04, mid], [rx1, ridge - 0.04, mid], 0.08, TIMBER, 0.8);
  beam(c.flat, [x0, wh, back + 0.04], [x1, wh, back + 0.04], 0.09, TIMBER, 0.8);
  for (let x = x0 + 0.07; x <= x1; x += (HOME.w - 0.14) / 10) beam(c.flat, [x, ridge - 0.05, mid], [x, wh - HOME.eave * slope, back - HOME.eave], 0.06, TIMBER, 0.8);
  // what holds it up, out behind, a sandbag on each foot
  for (const x of [x0 + t / 2, x1 - t / 2]) { brace(c, x, back, 0, -1, 1.5, 2.3); c.solid(x - 0.1, back - 1.5, x + 0.1, back - 0.9); }
  // the chimney goes on up through the ceiling
  { const cx = 2.1, cz0 = mid + 0.35, cz1 = mid + 1.0; bricks.box(cx - 0.36, ridge - 1.0 * slope - 0.1, cz0, cx + 0.36, H, cz1, WHITE, { uv: 1, skip: '-y+y' }); c.hole(cx - 0.3, cz0 - 0.1, 2); }

  /* windows: lit. From inside, a box of tubes on the back of the board, and a cable */
  const glass = c.shining('home:window', kit.tex.custom('home:window', 48, 40, (g, w, hh) => {
    P(g, '#ffd98a', 0, 0, w, hh); P(g, '#ffe9b5', 6, 4, w - 12, hh - 8);
    g.fillStyle = '#f3c97a'; for (const s of [0, 1]) { g.beginPath(); g.moveTo(s ? w : 0, 0); g.lineTo(s ? w - 16 : 16, 0); g.quadraticCurveTo(s ? w - 5 : 5, hh * 0.5, s ? w - 9 : 9, hh); g.lineTo(s ? w : 0, hh); g.fill(); }
    P(g, '#f1efe4', w / 2 - 1, 0, 2, hh); P(g, '#f1efe4', 0, hh / 2 - 1, w, 2);
  }, { clamp: true }), 1.2);
  for (const [wx, ww] of [[1.55, 1.5], [-2.85, 0.8]]) {
    const y0 = 0.95, y1 = 2.15, z = front + 0.02;
    upright(glass, wx - ww / 2, z, wx + ww / 2, z, y0, y1, [0, 0, 1, 1]);
    for (const [fx0, fy0, fx1, fy1] of [[wx - ww / 2 - 0.07, y0 - 0.07, wx + ww / 2 + 0.07, y0], [wx - ww / 2 - 0.07, y1, wx + ww / 2 + 0.07, y1 + 0.07], [wx - ww / 2 - 0.07, y0, wx - ww / 2, y1], [wx + ww / 2, y0, wx + ww / 2 + 0.07, y1]]) c.flat.box(fx0, fy0, front, fx1, fy1, front + 0.05, WHITEWASH);
    c.flat.box(wx - ww / 2 - 0.12, y0 - 0.11, front, wx + ww / 2 + 0.12, y0 - 0.07, front + 0.11, WHITEWASH);
    for (const s of [-1, 1]) { const sx0 = wx + s * (ww / 2 + 0.09), sx1 = wx + s * (ww / 2 + 0.38), a = Math.min(sx0, sx1), b = Math.max(sx0, sx1); c.flat.box(a, y0 - 0.04, front, b, y1 + 0.04, front + 0.02, [0.07, 0.16, 0.11]); for (let y = y0; y < y1; y += 0.075) c.flat.box(a + 0.03, y, front + 0.02, b - 0.03, y + 0.045, front + 0.04, [0.11, 0.25, 0.18]); }
    c.model('home:flowers', flowerBox, wx, front + 0.13, { y: y0 - 0.32, scale: [ww / 1.0, 1, 1], solid: false, shadow: false });
    c.light(wx, 1.5, front + 0.7, '#ffd98a', 0.3, { k: 1.1, far: 4.5 });
    c.flat.box(wx - ww / 2 - 0.05, y0 - 0.05, front - t - 0.13, wx + ww / 2 + 0.05, y1 + 0.05, front - t, [0.3, 0.3, 0.3], { ao: IN });
    c.flat.box(wx + ww / 2 - 0.1, 0.02, front - t - 0.03, wx + ww / 2 - 0.08, y0 - 0.05, front - t - 0.01, [0.04, 0.04, 0.04]);
  }
  for (const [bx, k] of [[1.2, 0], [2.5, 1], [-2.9, 0]]) flat(c, bx - 0.6, front + 0.3 + k * 0.06, bx + 0.6, front + 0.3 + k * 0.06, 'bush', { h: 0.8, back: 'bush', solid: false });

  /* the door: open, inward. A step, a mat, a number */
  const red = hexRgb(p.door), hx = dx - dw, hz = front - t, ax = hx + Math.sin(0.3) * HOME.door.w, az = hz - Math.cos(0.3) * HOME.door.w;
  c.model('suburb:door:' + p.door, doorVox(p.door), hx, hz, { rot: Math.PI / 2 - 0.3 + Math.PI, solid: false, shadow: false }); void red;
  c.solid(Math.min(hx, ax) - 0.03, az, Math.max(hx, ax) + 0.03, hz);
  for (const [fx0, fy0, fx1, fy1] of [[dx - dw - 0.09, 0, dx - dw, dh + 0.09], [dx + dw, 0, dx + dw + 0.09, dh + 0.09], [dx - dw, dh, dx + dw, dh + 0.09]]) c.flat.box(fx0, fy0, front, fx1, fy1, front + 0.04, WHITEWASH, { skip: '-y' });
  c.flat.box(dx - 0.85, 0, front, dx + 0.85, 0.05, front + 0.6, [0.55, 0.55, 0.52], { skip: '-y' });
  c.flat.box(dx - 0.4, 0.05, front + 0.08, dx + 0.4, 0.065, front + 0.52, [0.36, 0.26, 0.14]);
  upright(wordB, dx + dw + 0.2, front + 0.012, dx + dw + 0.52, front + 0.012, 1.5, 1.7, cell(1));

  /* inside: the carpet again, and a desk */
  { const carpet = c.mapped('suburb:carpet', kit.tex.carpet(CARPET)), a = x0 + t, b = x1 - t, z0 = back - 0.25, z1 = front - t;
    carpet.grid([a, 0.011, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0), ticks(b - a), (u, v) => [(a + v) / 1.6, (z0 + u) / 1.6], [IN + 0.15, IN + 0.15, IN + 0.15]); }
  const desk = { x: 1.3, z: mid - 0.35 };
  for (const q of sunk(desk.x, desk.z, 2).props) if (c.hasProp(q.type)) c.prop(q.type, q.x, q.z, { y: q.y - SUNK, rot: q.rot, solid: q.type === 'desk' || q.type === 'chair' });
  c.light(desk.x, 1.15, desk.z + 0.5, '#a9d0ff', 0.35, { k: 1, far: 3.5 });
  c.leave('opener', desk.x + 0.75, desk.z + 0.05, { y: 0.66 });               // on the desk: the thing that opens the garage doors

  // gnomes, up the path, all looking at the door
  for (let z = h.fenceZ - 0.7, k = 0; z > front + 1.1; z -= 0.85, k++) c.model('suburb:gnome', gnomeVox, dx + (k % 2 ? 0.62 : -0.62), z, { rot: Math.atan2(dx - (dx + (k % 2 ? 0.62 : -0.62)), front - z), solid: false, shadow: 0.3 });

  /* the garden: a fence with a gate left open, stones up to the step, a tree, a board, a letter box with your name on it */
  const fz = h.fenceZ, gx = dx;
  fence(c, h.fx0, front - 0.7, h.fx0, fz); fence(c, h.fx1, front - 0.7, h.fx1, fz);
  fence(c, h.fx0, fz, gx - 0.65, fz); fence(c, gx + 0.65, fz, h.fx1, fz);
  fence(c, gx - 0.65, fz, gx - 0.65 - 0.42, fz + 1.2, { solid: false, posts: false });
  for (let z = fz - 0.45, k = 0; z > front + 0.75; z -= 0.72, k++) c.flat.box(gx - 0.28 + (k % 2) * 0.1, 0, z - 0.22, gx + 0.24 + (k % 2) * 0.1, 0.022, z + 0.2, [0.62, 0.61, 0.57], { skip: '-y' });
  { const tx = p.tree * 3.3, tz = fz - 1.5; flat(c, tx - 0.8, tz, tx + 0.8, tz, 'tree', { h: 2.8, back: 'treeBack', brace: 0.9 }); }
  { const bx = -p.tree * 3.2, bz = fz - 0.9;
    c.flat.box(bx - 0.035, 0, bz - 0.035, bx + 0.035, 1.75, bz + 0.035, WHITEWASH, { skip: '-y' });
    c.flat.box(bx - 0.5, 1.05, bz + 0.035, bx + 0.5, 1.7, bz + 0.06, WHITEWASH);
    upright(wordB, bx - 0.48, bz + 0.062, bx + 0.48, bz + 0.062, 1.07, 1.68, cell(0));
    c.solid(bx - 0.5, bz - 0.05, bx + 0.5, bz + 0.07); c.shadow(bx, bz, 0.9, 0.2, 0.35); }
  { const mx = gx + 1.25, mz = fz + 0.45, m = postbox(c, mx, mz, 0);
    upright(wordB, mx - m.hw + 0.02, mz + m.hd + 0.004, mx + m.hw - 0.02, mz + m.hd + 0.004, 1.045, 1.175, cell(2)); }
}
