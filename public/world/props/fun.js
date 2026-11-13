// The Office — props for fun: the Back Room and room flair.
//
// The Back Room is the arcade lounge hidden behind a bookshelf (purple walls,
// pink neon): two cabinets, a jukebox, beanbags, a neon sign and a mirror ball.
// The rest is flair — each project room gets two of these, so that no two
// teams' rooms look alike.
//
// Same rules as office.js: 2.5 cm voxels, floor at y = 0, centred on x = z = 0,
// FRONT facing +z; wall things have their back on the plane z = 0. Sizes are in
// voxels, 40 to the metre.
//
// A note on light: `glow` colours are pushed hard by the renderer (and bloom
// once they are bright enough), so anything pale turns white. A glow that
// should keep its hue is written a good deal darker and more saturated than
// it ends up on screen — see LIT below.
import { Vox, M, glow, glass, tone, mix, noise3 } from '../vox/vox.js';
import { hashId } from '/core/look.mjs';

const pick = (o, n) => hashId(String(o?.id || o?.type || '')) % n;

const WOOD = '#9a6a3c', WOOD_DARK = '#6b4a2f', CREAM = '#cfc6b0', STEEL = '#8a8f96', BLACK = '#2b2b30';
const CHROME = '#c3c8d0', BRASS = '#c9a24a', PAPER = '#f1ead8', RED = '#d0392f';
/** Glow colours that still read as their hue once the renderer has lit them up. */
const LIT = Object.freeze({
  pink: '#e8248a', amber: '#e88a00', cyan: '#00a8c0', lime: '#48b018', red: '#b01810', yellow: '#e0ac00', violet: '#5a28c8',
  white: '#fff3c0',
});

/** Stamp a small bitmap — rows of text, top row first, '.' is empty — onto the slab z0..z1. `ink` is a colour or (char) => colour. */
function bitmap(v, rows, x, top, z0, z1, ink) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      const c = typeof ink === 'function' ? ink(row[i]) : ink;
      if (c) v.box(x + i, top - j, z0, x + i + 1, top - j + 1, z1, c);
    }
  });
}

// blocky 3 × 5 capitals, enough for a marquee
const FONT = {
  A: ['###', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], G: ['###', '#..', '#.#', '#.#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'], Q: ['###', '#.#', '#.#', '###', '..#'], S: ['###', '#..', '###', '..#', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
};
function text(v, str, x, top, z, ink) {
  for (const ch of str) { bitmap(v, FONT[ch], x, top, z, z + 1, ink); x += 4; }
}

/** A flat-ended round bar from point p along unit direction d, between distances t0 and t1. `color` may be (t, x, y, z) => colour. */
function rod(v, p, d, t0, t1, r, color) {
  const a = p.map((c, i) => c + d[i] * t0), b = p.map((c, i) => c + d[i] * t1);
  const lo = (i) => Math.floor(Math.min(a[i], b[i]) - r - 1), hi = (i) => Math.ceil(Math.max(a[i], b[i]) + r + 1);
  for (let x = lo(0); x < hi(0); x++) for (let y = lo(1); y < hi(1); y++) for (let z = lo(2); z < hi(2); z++) {
    const qx = x + 0.5 - p[0], qy = y + 0.5 - p[1], qz = z + 0.5 - p[2];
    const t = qx * d[0] + qy * d[1] + qz * d[2];
    if (t < t0 || t >= t1 || qx * qx + qy * qy + qz * qz - t * t > r * r) continue;
    v.set(x, y, z, typeof color === 'function' ? color(t, x, y, z) : color);
  }
}

/* ================================ the Back Room ================================ */

const BUG = ['.#.....#.', '..#...#..', '#.#####.#', '.#######.', '#########', '.#######.', '#.#####.#', '...###...'];
const BUG_SMALL = ['#.#.#', '.###.', '#####', '.###.', '#.#.#'];

/** Two liveries, so a pair of cabinets side by side is not a pair of twins. */
export const ARCADE_LOOKS = Object.freeze([
  { color: '#2a2f58', trim: '#f2c230', marquee: '#8f1008' },
  { color: '#6a2334', trim: '#59d6c8', marquee: '#16308a' },
]);

/** An upright arcade cabinet, "BUG SQUASH". The player stands at +z; the scene draws the game on the dark screen. 32 × 72 × 32. */
export function arcade(opt = {}) {
  const v = new Vox();
  const body = M(opt.color || ARCADE_LOOKS[0].color, 1), deep = tone(body, -0.4), k = M(BLACK, 0);
  const trim = M(opt.trim || ARCADE_LOOKS[0].trim, 0), steel = M('#565a66', 0);
  // the side profile: how far forward the cheeks and the body between them reach at each height
  const cheek = (y) => (y < 25 ? 11 : y < 27 ? 13 + (y - 25) * 2 : y < 30 ? 16 : y < 34 ? 45 - y : y < 55 ? 11 : y < 56 ? 12 : 13);
  const inner = (y) => (y < 2 ? 9 : y < 26 ? 10 : y < 27 ? 14 : y < 30 ? 16 : y < 31 ? 13 : y < 32 ? 10 : y < 55 ? 8 : y < 57 ? y - 46 : y < 70 ? 11 : 12);
  const rear = (y) => (y < 62 ? -16 : y < 66 ? -14 : y < 70 ? -12 : -10);
  for (let y = 0; y < 72; y++) {
    const b = rear(y);
    for (const x of [-16, 14]) v.box(x, y, b, x + 2, y + 1, cheek(y), body);
    v.box(-14, y, b, 14, y + 1, 0, body);
    v.box(-14, y, 0, 14, y + 1, inner(y), y < 2 ? deep : y < 26 ? body : y < 55 ? k : y < 57 ? M('#3d404c', 0) : deep);
  }
  // T-moulding along the front edge of each cheek, and stripes down the sides
  const edge = (x, y, z) => (z + 1 >= cheek(y) || (y < 71 && z >= cheek(y + 1)) || (y > 0 && z >= cheek(y - 1)) || y === 71 ? trim : 0);
  const bug = M('#9be24a', 1), stripes = [M('#e2503f', 1), M('#f2a93a', 1), M('#f2d45c', 1)];
  const art = (x, y, z, cur) => {
    if (cur === trim) return 0;
    const bz = z + 10, by = 64 - y;
    if (bz >= 0 && bz < 9 && by >= 0 && by < 8 && BUG[by][bz] === '#') return bz === 4 && by >= 3 && by < 7 ? deep : bug;
    const t = y - z - 22;
    return t >= 0 && t < 12 ? stripes[(t / 4) | 0] : 0;
  };
  for (const x of [-16, 14]) v.paint(x, 0, -16, x + 2, 72, 16, edge);
  for (const x of [-16, 15]) v.paint(x, 0, -16, x + 1, 72, 16, art);

  // marquee: lit from behind, and set back so that it hides as little of the screen as it can
  v.paint(-14, 57, 10, 14, 70, 11, glow(opt.marquee || ARCADE_LOOKS[0].marquee));
  text(v, 'BUG', -6, 68, 10, glow(LIT.white));
  text(v, 'SQUASH', -12, 62, 10, glow(LIT.white));
  for (const x of [-13, 7]) bitmap(v, BUG_SMALL, x, 68, 10, 11, glow(LIT.lime));
  v.paint(-12, 55, 8, 12, 57, 11, (x) => (x & 1 ? k : 0));     // speaker slits under it

  // screen: plain dark glass, set back in the bezel
  v.carve(-10, 38, 7, 10, 54, 8);
  v.paint(-10, 38, 6, 10, 54, 7, M('#0c0f17', 0));
  v.paint(-7, 34, 7, 3, 36, 8, M(PAPER, 0));                   // how-to-play card
  v.paint(10, 40, 7, 13, 43, 8, M('#f2d45c', 0));              // somebody's high score, on a sticky note

  // control panel: joystick, two buttons, player-one start
  v.paint(-14, 28, 15, 14, 29, 16, trim);
  v.box(-8, 31, 10, -5, 32, 13, M('#17171c', 0));
  v.box(-7, 32, 11, -6, 34, 12, M(CHROME, 0));
  v.sphere(-6.5, 35.5, 11.5, 1.5, M('#d8322b', 0));
  v.box(2, 31, 11, 4, 32, 13, glow('#f5c400'));
  v.box(7, 31, 11, 9, 32, 13, glow('#2fd6e6'));
  v.set(-12, 30, 14, glow(LIT.white));

  // coin door
  v.box(-7, 5, 10, 7, 21, 11, tone(steel, 0.12));
  v.paint(-6, 6, 10, 6, 20, 11, steel);
  for (const x of [-5, 2]) {
    v.paint(x, 13, 10, x + 3, 18, 11, tone(steel, 0.3));
    v.paint(x + 1, 14, 10, x + 2, 17, 11, glow('#e05a10'));    // coin slots
  }
  v.carve(-2, 7, 10, 2, 10, 11); v.paint(-2, 7, 9, 2, 10, 10, k);          // coin return
  v.set(5, 8, 10, M(BRASS, 0));

  // back: service hatch, vents, a power switch
  v.paint(-10, 6, -16, 10, 44, -15, deep);
  for (let y = 48; y < 56; y += 2) v.paint(-8, y, -16, 8, y + 1, -15, k);
  v.set(11, 9, -16, glow(LIT.red));
  return v;
}
/** The arcade's live screen: centre and size in voxels, in the plane z = ARCADE_SCREEN.z facing +z. */
export const ARCADE_SCREEN = Object.freeze({ x: 0, y: 46, z: 7.08, w: 20, h: 16 });

/** A 1950s dome-top jukebox: glowing tubes round the arch, a record behind glass, selector buttons. Faces +z. 36 × 60 × 24. */
export function jukebox() {
  const v = new Vox();
  const wood = M('#8a5230', 2), dark = tone(wood, -0.32), lite = tone(wood, 0.16);
  const chrome = M(CHROME, 0), gold = M('#d8a843', 0), k = M(BLACK, 0);
  const tubes = [glow(LIT.cyan), glow(LIT.amber), glow(LIT.pink)];          // from the inside out
  const SY = 42;                                                // where the straight sides turn into the arch
  const rho = (x, y) => (y < SY ? Math.abs(x) : Math.hypot(x, y - SY));
  for (let x = -18; x < 18; x++) for (let y = 3; y < 60; y++) {
    // the cabinet is the arch pushed straight back, in two-voxel steps so the top stays cheap to draw
    if (rho((x >> 1) * 2 + 1, y < SY ? y + 0.5 : SY + ((y - SY) >> 1) * 2 + 1) <= 17.3) v.box(x, y, -12, x + 1, y + 1, 8, wood);
    const r = rho(x + 0.5, y + 0.5);                            // …and the face is the true arch
    if (r > 18 || r <= 10) continue;
    v.box(x, y, 8, x + 1, y + 1, 10, r > 16 ? lite : tubes[Math.min(2, Math.floor((r - 10) / 2))]);
  }
  v.box(-18, 0, -12, 18, 3, 10, dark);                          // plinth
  v.paint(-16, 3, 8, 16, 5, 10, gold);                          // tube sockets
  for (const s of [-1, 1]) v.paint(s > 0 ? 10 : -16, 41, 8, s > 0 ? 16 : -10, 43, 10, gold);
  v.box(-2, 52, 8, 2, 60, 11, gold);                            // keystone
  v.box(-1, 55, 11, 1, 57, 12, glow(LIT.red));
  v.decal('+y', -3, -12, 3, 8, lite);

  // record window
  const pane = glass('#8fb4c4');
  for (let x = -10; x < 10; x++) for (let y = 30; y < 54; y++) {
    const r = rho(x + 0.5, y + 0.5);
    if (r > 10) continue;
    if (r > 9 || y === 30) { v.set(x, y, 7, chrome); continue; }
    v.carve(x, y, 3, x + 1, y + 1, 8);
    v.set(x, y, 2, glow('#a87838'));                            // lit from behind
    v.set(x, y, 7, pane);
  }
  v.box(-9, 31, 3, 9, 33, 7, M('#5a1f2a', 3));                  // the deck
  v.cyl('z', 0, 42, 3, 4, 7, (x, y) => {                        // a record, on its edge
    const r = Math.hypot(x + 0.5, y + 0.5 - 42);
    return r < 0.8 ? M(PAPER, 0) : r < 2.6 ? M('#e2503f', 0) : r > 4.4 && r < 5.4 ? M('#3d3d46', 0) : M('#1b1b20', 0);
  });
  v.box(6, 33, 4, 8, 36, 6, chrome);                            // tone arm
  v.tube(7, 36, 5, 3.5, 40.5, 5, 0.8, M(PAPER, 0));
  v.box(2, 39, 4, 4, 42, 6, gold);

  // selector: a chrome shelf of buttons, title cards on its slope
  v.box(-10, 24, 8, 10, 28, 11, chrome);
  v.box(-10, 28, 8, 10, 29, 10, chrome);
  v.box(-10, 29, 8, 10, 30, 9, chrome);
  for (const x of [-8, 1]) v.box(x, 28, 9, x + 7, 29, 10, M(PAPER, 0));
  for (let i = 0; i < 9; i++) v.box(-9 + i * 2, 25, 11, -8 + i * 2, 27, 12, i === 6 ? glow('#ff9a1f') : i % 2 ? M(RED, 0) : M(PAPER, 0));

  // speaker grille: cloth behind gilt bars, in a raised frame
  const cloth = M('#8a6a34', 3);
  v.box(-9, 4, 8, 9, 23, 9, gold);
  v.carve(-8, 5, 8, 8, 22, 9);
  v.paint(-8, 5, 7, 8, 22, 8, (x) => ([-6, -3, -1, 0, 2, 5].includes(x) ? gold : cloth));
  v.cyl('z', 0, 13.5, 8, 9, 2.6, gold);
  v.box(-1, 13, 9, 1, 14, 10, glow(LIT.pink));

  // sides and back
  for (const dir of ['+x', '-x']) v.decal(dir, -9, 8, 5, 38, (u, w) => (u === -9 || u === 4 || w === 8 || w === 37 ? lite : 0));
  v.paint(-14, 6, -12, 14, 38, -11, dark);
  for (let y = 26; y < 34; y += 2) v.paint(-8, y, -12, 8, y + 1, -11, k);
  return v;
}

export const BEANBAG_COLORS = Object.freeze(['#3f9a8f', '#d98a3a', '#c9566a', '#7a9a45']);

/** A squashy beanbag with a sat-in dent. Sit in the dent facing +z — its middle is the origin, 9 up. 36 × 18 × 36. */
export function beanbag(opt = {}) {
  const v = new Vox();
  const fab = M(opt.color || BEANBAG_COLORS[0], 3), dark = tone(fab, -0.22), seam = tone(fab, -0.36);
  const R = 18, P = 2.6;
  const rim = (x, z) => Math.pow(Math.pow(Math.abs(x) / R, P) + Math.pow(Math.abs(z) / R, P), 1 / P);   // 0 in the middle … 1 at the edge
  for (let x = -R; x < R; x++) for (let z = -R; z < R; z++) {
    // the outline is cut in two-voxel steps and the sides stand straight for a few rows: both keep the mesh small
    if (rim((x >> 1) * 2 + 1, (z >> 1) * 2 + 1) >= 1) continue;
    const cx = x + 0.5, cz = z + 0.5;
    const body = Math.max(opt.wall ?? 6, 13.5 * Math.sqrt(Math.max(0, 1 - Math.pow(rim(cx, cz), 5))));     // a soft shoulder
    const hump = 5 * Math.exp(-(((cz + 12) ** 2) / 40 + (cx * cx) / 170));                    // slumped up at the back
    const dent = 5.1 * Math.exp(-((cx * cx) / 60 + ((cz - 1) ** 2) / 48));                    // where somebody sat
    const h = Math.round(body + hump - dent);
    for (let y = 0; y < h; y++) v.set(x, y, z, y < 2 ? dark : fab);
  }
  v.paint(-1, 0, -R, 0, 20, R, seam);                           // the seam runs over the top, front to back
  const patch = M('#e6c15a', 3);
  v.decal('+y', 7, 6, 13, 12, (u, w) => ((u === 7 || u === 12) && (w === 6 || w === 11) ? tone(patch, -0.3) : patch));
  return v;
}

const NEON = {
  O: ['..#####..', '.#######.', ...Array(12).fill('##.....##'), '.#######.', '..#####..'],
  P: ['#######..', '########.', ...Array(5).fill('##.....##'), '########.', '#######..', ...Array(7).fill('##.......')],
  E: ['#########', '#########', ...Array(5).fill('##.......'), '#######..', '#######..', ...Array(5).fill('##.......'), '#########', '#########'],
  N: ['###....##', '###....##', '####...##', '####...##', '####...##', '##.##..##', '##.##..##', '##.##..##', '##..##.##', '##..##.##',
    '##..##.##', '##...####', '##...####', '##...####', '##....###', '##....###'],
  glass: ['############', '############', '.##......##.', '.##......##.', '..##....##..', '..##....##..', '...##..##...', '...##..##...',
    '....####....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '..########..', '..########..'],
};

/** A neon bar sign for a wall: "OPEN" in pink tubes beside a cyan cocktail glass. Back on z = 0, bottom centre at the origin. 64 × 28 × 3. */
export function neon() {
  const v = new Vox();
  const pink = glow('#f7349a'), cyan = glow('#12c2d6');
  const board = M('#1d1a26', 1);
  v.rbox(-32, 0, 0, 32, 28, 1, 3, board, 'xy');
  for (const x of [-31, 29]) for (const y of [1, 25]) v.box(x, y, 1, x + 2, y + 2, 2, M(STEEL, 0));     // mounting studs
  [...'OPEN'].forEach((ch, i) => bitmap(v, NEON[ch], -30 + i * 12, 21, 1, 3, pink));
  bitmap(v, NEON.glass, 19, 21, 1, 3, cyan);
  v.box(24, 17, 1, 26, 19, 3, glow('#6fd62a'));                 // an olive…
  for (const [x, y] of [[26, 19], [27, 20], [28, 22], [29, 23]]) v.box(x, y, 1, x + 1, y + 1, 3, glow('#ff9a1f'));   // …on a stick
  // the light the tubes throw on the board behind them
  const spill = new Map([[pink, glow('#3d0a26')], [cyan, glow('#06323a')]]);
  v.paint(-32, 0, 0, 32, 28, 1, (x, y) => {
    for (let d = 0; d <= 1; d++) for (let dx = -d; dx <= d; dx++) for (let dy = -d; dy <= d; dy++) {
      const c = spill.get(v.get(x + dx, y + dy, 1));
      if (c) return c;
    }
    return 0;
  });
  return v;
}

/** The mirror ball: centre height and radius in voxels from the prop's origin on the floor — the scene spins it. */
export const DISCOBALL = Object.freeze({ y: 90, r: 7 });

/** A mirror ball hanging from the ceiling on a wire. The origin is on the FLOOR below it; the ball's centre is 90 up. 14 × 104 × 14. */
export function discoball() {
  const v = new Vox();
  const CY = DISCOBALL.y;
  const tiles = [M('#aab3c0', 0), M('#f2f4f7', 0), M('#bcd8f0', 0)];
  const sparkle = [glow('#ffffff'), glow('#ffe9b8'), glow('#ffc4e6'), glow('#bff3ff')];
  v.sphere(0, CY, 0, DISCOBALL.r + 0.3, (x, y, z) => {
    const band = (y - CY + 8) >> 1;                             // mirror tiles two voxels tall, eighteen to a turn
    const lon = Math.floor((Math.atan2(z + 0.5, x + 0.5) / (2 * Math.PI) + 0.5) * 18 + (band & 1) * 0.5) % 18;
    const n = noise3(band, lon, 0, 11);
    return n > 0.88 ? sparkle[Math.floor(n * 1000) % 4] : tiles[(band + lon) % 3];
  });
  v.box(-1, CY + 7, -1, 1, CY + 8, 1, M(STEEL, 0));             // eyelet
  for (let y = CY + 8; y < 102; y++) { const a = y & 1; v.set(a ? -1 : 0, y, -1, M('#55585f', 0)); v.set(a ? 0 : -1, y, 0, M('#55585f', 0)); }
  v.box(-2, 102, -2, 2, 104, 2, M('#3a3a42', 0));               // ceiling rose
  return v;
}

/* ================================ room flair ================================ */

/** A table-football table: red against blue on six steel rods. You play from the long sides (±z). 48 × 32 × 36. */
export function foosball() {
  const v = new Vox();
  const wood = M('#8f5f38', 2), dark = tone(wood, -0.32), rail = tone(wood, 0.2);
  const steel = M('#b4bac4', 0), k = M(BLACK, 0), red = M(RED, 0), blue = M('#2f66c9', 0);
  const grass = M('#3f9a57', 1), grassL = tone(grass, 0.1), line = M(PAPER, 0);
  const B = 17, F = B + 7, RIM = B + 14, ROD = B + 11;          // underside of the box, the pitch, the rim, the rods
  for (const x of [-23, 19]) for (const z of [-12, 8]) { v.box(x, 1, z, x + 4, B, z + 4, dark); v.box(x, 0, z, x + 4, 1, z + 4, k); }
  for (const x of [-22, 20]) v.box(x, 6, -8, x + 2, 9, 8, dark);                  // stretchers
  v.box(-24, B, -13, 24, RIM, 13, wood);
  v.box(-24, B, -13, 24, B + 2, 13, dark);
  v.paint(-24, RIM - 1, -13, 24, RIM, 13, rail);
  v.carve(-21, F, -11, 21, RIM, 11);
  v.paint(-21, F - 1, -11, 21, F, 11, (x, y, z) => {                            // the pitch
    const ax = Math.abs(x + 0.5), az = Math.abs(z + 0.5), r = Math.hypot(ax, az);
    if (ax < 1 || (r > 4.3 && r <= 5.3)) return line;
    if ((ax > 14 && ax < 15 && az < 7) || (ax > 15 && az > 6 && az < 7)) return line;
    return (((x + 21) / 3) | 0) & 1 ? grassL : grass;
  });
  for (const s of [-1, 1]) {                                                    // goal mouths
    const x = s < 0 ? -22 : 21;
    v.carve(x, F, -4, x + 1, F + 4, 4);
    v.paint(x + s, F, -4, x + s + 1, F + 4, 4, k);
    v.paint(x, F - 1, -4, x + 1, F, 4, k);
  }
  // rods: [x, team, where the men are, how far the rod has been pulled]
  const rods = [[-18, red, [0], 0], [-11, red, [-5, 5], -1], [-4, blue, [-7, 0, 7], 1], [3, red, [-7, 0, 7], 0], [10, blue, [-5, 5], 0], [17, blue, [0], 1]];
  for (const [x, team, men, slide] of rods) {
    const mine = team === red ? 1 : -1;                         // red plays from the +z side
    const z0 = (mine > 0 ? -15 : -14) + slide, z1 = (mine > 0 ? 14 : 15) + slide;
    v.box(x, ROD, z0, x + 1, ROD + 1, z1, steel);
    v.cyl('z', x + 0.5, ROD + 0.5, mine > 0 ? z1 : z0 - 4, mine > 0 ? z1 + 4 : z0, 1.2, k);  // grip
    v.set(x, ROD, mine > 0 ? z0 - 1 : z1, k);                   // rubber stop on the far end
    for (const m of men) {
      v.box(x, ROD - 3, m + slide - 1, x + 1, ROD + 2, m + slide + 1, team);
      v.box(x, ROD + 1, m + slide - 1, x + 1, ROD + 2, m + slide + 1, tone(team, 0.35));
    }
  }
  // score beads, the ball, and where it comes back out
  for (const [x, team, n] of [[-24, red, 3], [22, blue, 1]]) {
    for (let i = 0; i < 5; i++) { const z = i < n ? -5 + i : i; v.box(x, RIM, z, x + 2, RIM + 1, z + 1, i % 2 ? tone(team, 0.25) : team); }
  }
  v.box(7, F, -4, 9, F + 2, -2, M('#f4f1e6', 0));
  v.box(-3, B + 3, 13, 3, B + 6, 14, dark); v.paint(-2, B + 4, 13, 2, B + 6, 14, k);
  return v;
}

const FISH = {
  gold: ['...oo...', '.OOOOO.o', 'OeOOOOoo', '.OOwwO.o', '..o.....'],
  tang: ['..yy...', '.yyyy.k', 'yeyyykk', '.yyyy.k'],
  red: ['.rr.r', 'rerrr', '.rr.r'],
};
const FISH_INK = { O: '#f08a2c', o: '#d9601f', w: '#f6d9a8', e: '#1b1b20', y: '#f2d03a', k: '#2b2b30', r: '#e2503f' };

/** A fish tank on a cabinet, lit from the hood. Faces +z. 40 × 52 × 20. */
export function aquarium() {
  const v = new Vox();
  const wood = M(WOOD_DARK, 2), pale = tone(wood, 0.18), dark = tone(wood, -0.28), k = M(BLACK, 0);
  const water = glass('#6fb6e8');
  v.box(-19, 0, -8, 19, 2, 8, dark);                            // plinth, set back
  v.box(-20, 2, -9, 20, 22, 9, wood);
  v.box(-20, 22, -9, 20, 24, 9, pale);
  v.paint(-18, 4, 8, 18, 21, 9, (x) => (x === -1 || x === 0 ? dark : pale));    // two doors
  for (const x of [-4, 3]) v.box(x, 11, 9, x + 1, 15, 10, M(BRASS, 0));
  // the tank: trim, a painted back, gravel
  v.box(-19, 24, -9, 19, 25, 9, k);
  v.box(-19, 25, -9, 19, 43, -8, k);
  v.box(-19, 25, -8, 19, 43, -7, M('#2a6a9c', 0));
  const sand = M('#d9c08a', 1);
  v.box(-19, 25, -7, 19, 27, 9, (x, y, z) => (noise3(x >> 2, 0, z >> 2, 5) > 0.62 ? tone(sand, -0.14) : sand));
  v.box(-19, 27, -7, 19, 28, 0, sand);
  for (const [x, z, c] of [[-6, 3, '#8f8f96'], [2, 6, '#f1ead8'], [-15, 5, '#8f8f96'], [15, 2, '#b98d57'], [9, 7, '#8f8f96'], [-10, 7, '#f1ead8']]) v.set(x, 27, z, M(c, 1));
  // weed, a rock to hide in, bubbles
  const weed = [M('#3f8a4a', 2), M('#62b05c', 2)];
  for (const [x0, z0, h, ph] of [[-15, -3, 12, 0], [-13, -5, 14, 2], [-11, -2, 9, 1]]) {
    for (let i = 0; i < h; i++) {
      const x = x0 + ((i + ph) % 4 < 2 ? 0 : 1);
      v.set(x, 28 + i, z0, weed[(i >> 1) & 1]);
      if (i % 3 === 1) v.set(x + ((i + ph) % 4 < 2 ? -1 : 1), 28 + i, z0, weed[1]);
    }
  }
  for (let i = 0; i < 6; i++) v.set(12 + (i % 4 < 2 ? 0 : 1), 28 + i, -4, M('#c9566a', 2));
  const rock = M('#7d7f8a', 1);
  v.ellipsoid(8, 28, -2, 5, 4, 3, (x, y) => (y > 29 ? tone(rock, 0.12) : rock));
  v.carve(6, 28, -6, 10, 30, 3);
  for (const [x, y] of [[15, 29], [16, 32], [15, 35], [16, 38]]) v.set(x, y, 3, M('#e6f6ff', 0));
  // fish
  const fish = (rows, x, y, z, flip) => bitmap(v, flip ? rows.map((r) => [...r].reverse().join('')) : rows, x, y, z, z + 2, (c) => M(FISH_INK[c], 0));
  fish(FISH.gold, -6, 37, 2, false);
  fish(FISH.tang, 5, 39, -2, true);
  fish(FISH.red, -13, 33, 5, true);
  // the light bar, then water in everything that is still empty
  v.box(-15, 41, -2, 15, 43, 2, glow('#eafaff'));
  for (let x = -19; x < 19; x++) for (let y = 25; y < 43; y++) for (let z = -7; z < 9; z++) if (!v.has(x, y, z)) v.set(x, y, z, water);
  // hood, fish food, and the filter and its lead round the back
  v.box(-20, 43, -9, 20, 47, 9, k);
  v.box(-17, 47, -6, 17, 48, 6, M('#3d3d46', 0));
  v.paint(-16, 43, 8, 16, 44, 9, glow('#d8f3ff'));
  v.cyl('y', 13.5, 3.5, 48, 51, 1.6, M('#f2c230', 0));
  v.cyl('y', 13.5, 3.5, 51, 52, 1.6, M(RED, 0));
  v.box(8, 33, -10, 16, 45, -9, k);
  v.box(12, 0, -10, 13, 33, -9, k);
  return v;
}

/** A wooden coat stand: a hat on top, a scarf over a peg, an umbrella in the ring. No front to speak of. 16 × 68 × 16. */
export function coatrack(opt = {}) {
  const v = new Vox();
  const wood = M(opt.color || WOOD, 2), dark = tone(wood, -0.3), brass = M(BRASS, 0);
  v.cyl('y', 0, 0, 0, 2, 7.6, dark);                            // weighted foot
  v.cyl('y', 0, 0, 2, 3, 6.2, wood);
  v.cyl('y', 0, 0, 3, 6, 3.2, wood, 1.4);
  v.cyl('y', 0, 0, 6, 63, 1.2, wood);                           // the pole
  for (const y of [18, 44]) v.cyl('y', 0, 0, y, y + 2, 1.9, dark);
  v.ring(0, 18.5, 0, 6, 0.75, brass, 'y');                      // umbrella ring
  v.box(-6, 18, -1, 6, 19, 1, brass);
  for (let i = 0; i < 4; i++) {                                 // pegs: four high, four lower down between them
    const a = (i * Math.PI) / 2, b = a + Math.PI / 4;
    v.tube(Math.cos(a), 55, Math.sin(a), Math.cos(a) * 6, 59, Math.sin(a) * 6, 0.8, wood);
    v.sphere(Math.cos(a) * 6, 59.5, Math.sin(a) * 6, 1.3, dark);
    v.tube(Math.cos(b), 46, Math.sin(b), Math.cos(b) * 5.5, 49, Math.sin(b) * 5.5, 0.8, wood);
  }
  // hat
  const felt = M('#4a4d5c', 3);
  v.cyl('y', 0, 0, 63, 64, 6.3, felt);
  v.cyl('y', 0, 0, 64, 68, 4, felt, 3.3);
  v.cyl('y', 0, 0, 64, 65, 4.1, M('#b5483f', 2));
  // scarf, over the +x peg
  const scarf = M('#c9463f', 3), band = M(PAPER, 3);
  const stripe = (x, y) => (y % 5 === 0 ? band : scarf);
  v.box(3, 59, -2, 5, 61, 2, scarf);
  v.box(3, 41, 1, 5, 60, 2, stripe);
  v.box(3, 48, -2, 5, 60, -1, stripe);
  v.set(3, 40, 1, scarf); v.set(4, 47, -2, scarf);
  // umbrella, standing in the ring
  const umb = M('#e0b23a', 2);
  v.box(3, 3, 3, 4, 6, 4, M(STEEL, 0));
  v.cyl('y', 3.5, 3.5, 6, 27, 0.9, (x, y) => (y === 22 ? tone(umb, -0.3) : umb), 1.7);
  v.box(3, 27, 3, 4, 33, 4, dark);
  v.box(3, 33, 3, 6, 34, 4, dark); v.box(5, 31, 3, 6, 33, 4, dark);
  return v;
}

const GUM = ['#d92a20', '#f2b600', '#1f6fd0', '#2fa83a', '#f06a10', '#f4f1ea', '#e0409a'];

/** A gumball machine on a stand: red base and cap, a glass globe of gumballs, the coin knob toward +z. 16 × 48 × 16. */
export function gumball() {
  const v = new Vox();
  const red = M('#c8322b', 0), redD = tone(red, -0.28), chrome = M(CHROME, 0), k = M(BLACK, 0);
  v.cyl('y', 0, 0, 0, 2, 7.6, redD);                            // stand
  v.cyl('y', 0, 0, 2, 3, 5.4, red);
  v.cyl('y', 0, 0, 3, 20, 1.2, chrome);
  v.cyl('y', 0, 0, 3, 5, 2.4, chrome);
  v.rbox(-6, 20, -6, 6, 30, 6, 2, red, 'xz');                   // body
  v.paint(-6, 20, -6, 6, 21, 6, redD);
  v.cyl('y', 0, 0, 30, 31, 5.4, chrome);
  // globe, and what is in it
  const GY = 38, shell = glass('#7fa6b8');
  v.sphere(0, GY, 0, 7.3, shell);
  v.sphere(0, GY, 0, 6.3, (x, y, z) => {
    if (y > GY + 1 + (Math.hypot(x + 0.5, z + 0.5) < 3 ? 1 : 0)) return shell;
    const by = y >> 1, bx = (x + 8 + (by & 1)) >> 1, bz = (z + 8 + (by & 1)) >> 1;
    return M(GUM[Math.floor(noise3(bx, by, bz, 3) * GUM.length)], 0);
  });
  v.cyl('y', 0, 0, 44, 46, 4.6, red);                           // cap
  v.cyl('y', 0, 0, 46, 47, 2.6, redD);
  v.box(-1, 47, -1, 1, 48, 1, chrome);
  // coin mechanism
  v.box(-3, 22, 6, 3, 29, 7, chrome);
  v.box(-1, 24, 7, 1, 26, 8, k);
  v.box(-2, 24, 7, 2, 26, 8, k);
  v.set(-1, 27, 6, k); v.set(0, 27, 6, k);
  v.box(-2, 20, 6, 2, 22, 8, chrome); v.paint(-1, 20, 7, 1, 21, 8, k);
  return v;
}

const ROCKET = ['....#..', '...###.', '..####.', '.####..', 'f###...', 'ff#....', '.f.....'];

/** A pinball machine: the playfield slopes up under glass to a lit backbox. The player stands at +z. 28 × 57 × 51. */
export function pinball() {
  const v = new Vox();
  const cab = M('#7d2230', 1), cabD = tone(cab, -0.38), k = M(BLACK, 0), chrome = M(CHROME, 0), steel = M(STEEL, 0);
  const sun = M('#f2c230', 1), flame = M('#f08a2c', 1), bumper = M(RED, 0);
  const ZB = -15;                                               // the front of the backbox
  const top = (z) => 30 + Math.round(((21 - Math.max(ZB, Math.min(21, z))) * 8) / 36);        // rail height
  for (let z = -25; z < 23; z++) v.box(-13, 20, z, 13, top(z), z + 1, cab);
  v.box(-13, 20, -25, 13, 21, 23, cabD);
  const stripe = (x, y, z) => { const d = top(z) - y; return d >= 4 && d < 6 ? sun : d === 6 ? flame : 0; };
  for (const x of [-13, 12]) v.paint(x, 20, -25, x + 1, 38, 21, stripe);
  // playfield
  const field = M('#2f58ad', 1), cream = M('#f4f1e6', 0);
  for (let z = ZB; z < 21; z++) {
    const t = top(z);
    v.carve(-11, t - 4, z, 11, t, z + 1);
    v.paint(-11, t - 5, z, 11, t - 4, z + 1, (x) => {
      const r = Math.hypot(x + 0.5, z - 6.5);
      if (x >= 9) return M('#b98d57', 2);                       // shooter lane
      return r < 3 ? sun : r < 4 ? flame : field;
    });
    v.paint(-13, t - 1, z, -11, t, z + 1, steel); v.paint(11, t - 1, z, 13, t, z + 1, steel);
  }
  const on = (x, z, h, c) => v.box(x, top(z) - 4, z, x + 1, top(z) - 4 + h, z + 1, c);
  const lamp = (x, z, c) => v.paint(x, 0, z, x + 1, 60, z + 1, (px, py, pz, cur) => (cur === field ? glow(c) : 0));
  for (let z = ZB; z < ZB + 4; z++) for (let x = -11; x < 11; x++) if (Math.abs(x + 0.5) > 7 + (z - ZB) * 1.4) on(x, z, 2, cabD);   // top arch
  for (const [x, c] of [[-5, LIT.pink], [-1, LIT.amber], [3, LIT.cyan]]) { lamp(x, -10, c); lamp(x + 1, -10, c); }
  for (const x of [-7, -3, 1, 5]) for (const z of [-11, -10]) on(x, z, 1, steel);
  for (const [bx, bz] of [[-5, -5], [4, -5], [-1, 0]]) {        // pop bumpers
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { on(bx + dx, bz + dz, 2, cream); v.set(bx + dx, top(bz + dz) - 3, bz + dz, dx || dz ? bumper : glow(LIT.white)); }
  }
  for (const z of [-3, 0, 3]) on(-11, z, 1, sun);                // drop targets
  for (let z = 8; z < 13; z++) for (let i = 0; i <= (z - 8) * 0.7; i++) {                     // slingshots
    const rubber = i + 1 > (z - 8) * 0.7;
    on(-9 + i, z, 1, rubber ? bumper : sun); on(6 - i, z, 1, rubber ? bumper : sun);
  }
  for (const [x, z] of [[-6, 14], [-5, 14], [-5, 15], [-4, 15], [-3, 16]]) { on(x, z, 1, cream); on(-x - 3, z, 1, cream); }   // flippers
  on(-7, 14, 1, bumper); on(4, 14, 1, bumper);
  for (let z = -8; z < 17; z++) on(8, z, 1, steel);              // shooter lane wall
  for (const x of [9, 10]) for (const z of [15, 16]) on(x, z, 2, chrome);       // a ball, waiting
  for (let z = 17; z < 21; z++) for (let x = -11; x < 11; x++) on(x, z, 1, z > 17 && z < 20 && ((x >= -9 && x < -3) || (x >= 2 && x < 8)) ? cream : k);   // apron and its cards
  for (const [x, z, c] of [[-8, 4, LIT.lime], [5, 4, LIT.lime], [-1, 11, LIT.amber], [0, 12, LIT.amber]]) lamp(x, z, c);
  const pane = glass('#4f7a90');
  for (let z = ZB; z < 21; z++) v.box(-11, top(z) - 2, z, 11, top(z) - 1, z + 1, pane);
  v.paint(-13, 29, 21, 13, 30, 23, chrome);                     // lockdown bar

  // backbox
  v.box(-14, 38, -25, 14, 57, ZB, cab);
  v.paint(-14, 38, -25, 14, 39, ZB, cabD);
  v.carve(-12, 41, ZB - 1, 12, 55, ZB);
  v.paint(-12, 41, ZB - 2, 12, 55, ZB - 1, (x, y) => {
    const r = Math.hypot(x + 7.5, y - 48.5);
    if (r < 3.4) return glow(LIT.yellow);
    if (Math.abs(y - 48.5 + (x + 7.5) * 0.35) < 0.6 && r < 6.2) return glow(LIT.amber);
    return noise3(x, y, 0, 4) > 0.93 ? glow('#ffffff') : glow('#141c5a');
  });
  bitmap(v, ROCKET, 2, 51, ZB - 2, ZB - 1, (c) => (c === 'f' ? glow('#e05a10') : glow('#e8e8e8')));
  for (let x = -9; x < 9; x += 3) v.paint(x, 39, ZB - 1, x + 2, 40, ZB, glow(LIT.amber));
  for (const x of [-14, 13]) v.paint(x, 40, -25, x + 1, 56, ZB, (px, y, z) => (Math.hypot(z + 20, y - 48) < 3.6 ? sun : 0));

  // legs, and the front: coin door, start button, plunger, flipper buttons on the sides
  for (const [z, h] of [[19, 24], [-24, 26]]) for (const x of [-14, 12]) { v.box(x, 1, z, x + 2, h, z + 2, chrome); v.box(x, 0, z, x + 2, 1, z + 2, k); }
  v.paint(-5, 21, 22, 5, 28, 23, M('#4a4d57', 0));
  for (const x of [-3, 2]) v.paint(x, 24, 22, x + 1, 26, 23, glow('#e05a10'));
  v.box(-10, 25, 23, -8, 27, 24, glow('#f5c400'));
  v.box(9, 25, 23, 10, 26, 25, steel);
  v.cyl('z', 9.5, 25.5, 25, 26, 1.2, k);
  for (const x of [-14, 13]) v.box(x, 26, 15, x + 1, 28, 17, cream);
  // back
  for (let y = 44; y < 52; y += 2) v.paint(-8, y, -25, 8, y + 1, -24, cabD);
  return v;
}

/** A brass telescope on a wooden tripod, aimed up and away over −z; you look in at the +z end. 22 × 53 × 28. */
export function telescope() {
  const v = new Vox();
  const brass = M(BRASS, 0), brassD = tone(brass, -0.3), brassL = tone(brass, 0.3), k = M(BLACK, 0);
  const wood = M('#8f5f38', 2), woodD = tone(wood, -0.3);
  const HUB = 33, PY = 41;
  // tripod: two legs toward the front, one behind, a tray between them
  for (const [fx, fz] of [[-10.5, 7], [10.5, 7], [0, -12]]) {
    v.tube(0, HUB, 0, fx, 0.5, fz, 1.1, (x, y) => (y < 2 ? k : y > HUB - 5 ? brassD : wood));
    v.tube(fx * 0.56, 14.5, fz * 0.56, 0, 14.5, 0, 0.5, brassD);
  }
  v.cyl('y', 0, 0, 14, 15, 3.4, woodD);
  v.cyl('y', 0, 0, HUB - 2, HUB + 1, 2.6, woodD);
  // mount: a brass fork, a knob on each side
  v.box(-4, HUB + 1, -2, 4, HUB + 3, 2, brass);
  for (const x of [-4, 3]) v.box(x, HUB + 3, -1, x + 1, PY + 2, 1, brass);
  for (const x of [-6, 4]) v.box(x, PY - 1, -1, x + 2, PY + 1, 1, k);
  // the tube
  const A = 0.62, d = [0, Math.sin(A), -Math.cos(A)], n = [0, Math.cos(A), Math.sin(A)], P = [0, PY, 0];
  const along = (t, u = 0) => P.map((c, i) => c + d[i] * t + n[i] * u);
  rod(v, P, d, -6, 13, 3, (t, x, y, z) => {
    const up = (y + 0.5 - PY) * n[1] + (z + 0.5) * n[2];
    return Math.abs(Math.round(t) % 6) === 2 ? brassD : up > 1.8 ? brassL : brass;
  });
  rod(v, P, d, 11, 14, 3.6, brassL);                            // dew cap
  rod(v, P, d, 13, 14, 2.7, M('#a9d8ee', 0));                   // objective
  rod(v, P, d, -11, -6, 1.8, brassD);                           // draw tube
  rod(v, P, d, -13, -11, 2.1, brass);                           // diagonal
  rod(v, along(-12), n, 1.5, 5, 1.2, k);                        // eyepiece, pointing up at you
  rod(v, along(-12), n, 4, 5, 1.6, brass);
  rod(v, along(0, 4.6), d, 2, 11, 1.0, k);                      // finder scope, riding on top
  for (const t of [3.5, 9.5]) rod(v, along(t), n, 2.6, 4.2, 0.8, brassD);
  return v;
}

/** A pedestal fan, switched off: three blades behind a wire cage. Blows toward +z. 20 × 56 × 19. */
export function fan() {
  const v = new Vox();
  const body = M(CREAM, 0), shade = tone(body, -0.18), steel = M('#aab1bb', 0), k = M(BLACK, 0), blade = M('#86b4d4', 0);
  v.cyl('y', 0, 0, 0, 2, 8.6, shade);                           // weighted base
  v.cyl('y', 0, 0, 2, 3, 7.4, body);
  v.cyl('y', 0, -3, 3, 6, 3, body, 1.6);
  v.box(-1, 5, -4, 1, 40, -2, steel);                           // pole, a little behind centre
  v.cyl('y', 0, -3, 22, 25, 1.9, body);
  v.box(1, 23, -4, 3, 24, -3, k);
  v.rbox(-3, 31, -6, 3, 38, 0, 1, body);                        // switch box
  for (let i = 0; i < 4; i++) v.box(-2 + i, 33, 0, -1 + i, 35, 1, i === 1 ? shade : M('#ece6d6', 0));
  v.set(2, 36, -1, glow(LIT.red));
  v.rbox(-2, 38, -5, 2, 43, -1, 1, shade);                      // neck
  // head: motor, then the cage with the blades inside it
  const CY = 46;
  v.cyl('z', 0, CY, -6, 1, 3.6, body);
  v.cyl('z', 0, CY, -7, -6, 2.6, shade);
  for (const z of [-4, -2]) v.paint(-4, CY - 4, z, 4, CY + 4, z + 1, shade);
  for (let x = -10; x < 10; x++) for (let y = CY - 10; y < CY + 10; y++) {
    const cx = x + 0.5, cy = y + 0.5 - CY, r = Math.hypot(cx, cy), a = Math.atan2(cy, cx);
    if (r > 9.7) continue;
    if (r > 8.7) v.box(x, y, 2, x + 1, y + 1, 5, steel);                         // rim
    const spoke = (n, off) => { const s = ((a + off) / (2 * Math.PI)) * n; return Math.abs(s - Math.round(s)) * ((2 * Math.PI) / n) * r < 0.55; };
    if (r <= 9.2 && (r > 8.2 || Math.abs(r - 5.4) <= 0.5 || spoke(8, Math.PI / 8))) v.set(x, y, 5, steel);     // front wires
    if (r <= 9.2 && (r > 8.2 || spoke(4, Math.PI / 4))) v.set(x, y, 1, steel);    // back wires
    for (let i = 0; i < 3; i++) {
      const f = Math.PI / 2 + 0.4 + (i * 2 * Math.PI) / 3, u = r * Math.cos(a - f), w = r * Math.sin(a - f);
      if (((u - 4.4) / 3.9) ** 2 + ((w + 0.6) / 2.5) ** 2 <= 1) v.set(x, y, 3, blade);
    }
    if (r <= 1.9) { v.box(x, y, 1, x + 1, y + 1, 5, shade); v.set(x, y, 5, body); }
  }
  v.box(-1, CY - 1, 5, 1, CY + 1, 6, M('#3f7f9a', 0));          // badge
  // lead and plug
  v.box(-1, 0, -10, 8, 1, -9, k); v.box(7, 0, -9, 8, 1, -6, k); v.box(6, 0, -6, 9, 1, -4, k);
  return v;
}

/** A dartboard on a cork backing: three darts, one of them nowhere near. Hangs on a wall, back on z = 0. 22 × 26 × 3, darts stick out to 9. */
export function dartboard() {
  const v = new Vox();
  const cork = M('#c49a62', 3), frame = M(WOOD_DARK, 2), k = M('#26262b', 1), bone = M('#e9dfc4', 1), red = M('#c8322b', 1), green = M('#2f8a52', 1);
  v.box(-11, 0, 0, 11, 26, 2, frame);
  v.carve(-10, 1, 1, 10, 25, 2);
  v.paint(-10, 1, 0, 10, 25, 1, cork);
  const CY = 13, N = 12;
  v.cyl('z', 0, CY, 1, 3, 9.2, (x, y) => {
    const cx = x + 0.5, cy = y + 0.5 - CY, r = Math.hypot(cx, cy);
    const dark = Math.floor((Math.atan2(cx, cy) / (2 * Math.PI)) * N + N + 0.5) % 2 === 0;   // sector 0 is straight up
    if (r < 0.8) return red;
    if (r < 1.6) return green;
    if (r > 7.6) return k;
    if ((r > 3.8 && r <= 4.8) || r > 6.6) return dark ? red : green;
    return dark ? k : bone;
  });
  const dart = (x, y, c) => {
    v.box(x, y, 3, x + 1, y + 1, 6, M(BRASS, 0));
    v.box(x, y, 6, x + 1, y + 1, 7, M(BLACK, 0));
    v.box(x - 1, y, 7, x + 2, y + 1, 9, c); v.box(x, y - 1, 7, x + 1, y + 2, 9, c);
  };
  dart(0, 17, M(RED, 0));
  dart(-3, 11, M('#3f7fd8', 0));
  v.box(8, 3, 1, 9, 4, 6, M(BRASS, 0)); v.box(8, 3, 6, 9, 4, 7, M(BLACK, 0));               // the one that got away
  v.box(7, 3, 7, 10, 4, 9, M('#f2c230', 0)); v.box(8, 2, 7, 9, 5, 9, M('#f2c230', 0));
  for (const [x, y] of [[-8, 3], [-9, 21], [7, 22]]) v.set(x, y, 0, tone(cork, -0.4));      // old holes
  return v;
}

export const CATALOGUE = {
  arcade: { make: (o) => arcade(ARCADE_LOOKS[pick(o, ARCADE_LOOKS.length)]), variant: (o) => String(pick(o, ARCADE_LOOKS.length)) },
  jukebox: { make: () => jukebox() },
  beanbag: { make: (o) => beanbag({ color: BEANBAG_COLORS[pick(o, BEANBAG_COLORS.length)] }), variant: (o) => String(pick(o, BEANBAG_COLORS.length)), seat: 9 },
  neon: { make: () => neon(), wall: true, y: 1.5 },
  discoball: { make: () => discoball() },
  foosball: { make: () => foosball() },
  aquarium: { make: () => aquarium() },
  coatrack: { make: () => coatrack() },
  gumball: { make: () => gumball() },
  pinball: { make: () => pinball() },
  telescope: { make: () => telescope() },
  fan: { make: () => fan() },
  dartboard: { make: () => dartboard(), wall: true, y: 1.45 },
};
