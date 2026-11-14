// The Office — furniture for the rooms where work happens.
//
// Every prop is a function that returns a Vox (see ../vox/vox.js): 2.5 cm
// voxels, floor at y = 0, centred on x = z = 0, FRONT facing +z. Sizes are in
// voxels — 40 to the metre — so a 64-wide desk is 1.6 m.
//
// House style: warm wood, cream plastics, steel greys; tex 0 for plastic and
// metal, 1–2 for wood, 2–3 for cloth. Add the small things that make an
// object feel used — a handle, a cable, a sticky note — and let the baked
// shading do the rest.
import { Vox, M, glow, glass, tone, mix, noise3 } from '../vox/vox.js';

const WOOD = '#9a6a3c', WOOD_DARK = '#6b4a2f', CREAM = '#cfc6b0', STEEL = '#8a8f96', BLACK = '#2b2b30';

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

/** Desk-top height in voxels. People here are 1.3 m tall, so furniture is scaled to them. */
export const DESK_H = 26;

/** A work desk. The person sits on the −z side, looking toward +z. 64 × 26 × 32. */
export function desk(opt = {}) {
  const v = new Vox();
  const H = DESK_H;
  const wood = M(opt.color || WOOD, 2), dark = tone(wood, -0.24), pale = tone(wood, 0.14);
  v.box(-32, H - 2, -16, 32, H, 16, (x, y, z) => (y === H - 2 ? dark : (z + 16) % 6 === 0 ? tone(wood, -0.08) : noise3(x >> 2, 1, z >> 1) > 0.84 ? pale : wood));
  v.box(-31, 0, -14, -29, H - 2, 14, dark);                 // side panels
  v.box(29, 0, -14, 31, H - 2, 14, dark);
  v.box(-29, 8, 12, 29, H - 2, 13, tone(wood, -0.32));      // modesty panel
  v.box(13, 3, -13, 29, H - 2, 11, dark);                   // drawer unit
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * 7;
    v.box(14, y, -14, 28, y + 6, -13, wood);
    v.box(19, y + 3, -15, 24, y + 4, -14, M(STEEL, 0));
  }
  v.box(-31, 0, -14, -29, 1, 14, M(BLACK, 0)); v.box(29, 0, -14, 31, 1, 14, M(BLACK, 0));    // feet
  v.cyl('y', -22, 10, H - 1, H, 1.6, M(BLACK, 0));          // cable grommet
  v.tube(-22, H - 2, 11, -24, 5, 13, 0.6, M(BLACK, 0));     // a cable heading for the floor
  return v;
}

/**
 * Where things sit on a desk, in voxels from the desk's origin. The monitor and
 * keyboard are turned to face the person (who is on the −z side).
 */
export const DESK = Object.freeze({
  top: DESK_H,
  monitor: [-3, DESK_H, 5], keyboard: [-3, DESK_H, -10], mouse: [12, DESK_H, -10], lamp: [25, DESK_H, 9],
  plate: [-24, DESK_H, -13],
  items: [[-24, DESK_H, 6], [22, DESK_H, -3], [-22, DESK_H, -5], [12, DESK_H, 11]],
});

/** Seat height in voxels: the top of the cushion, and where a sitter's hips rest. */
export const SEAT_H = 16;
export const SIT_H = 19;

/** A swivel chair. Sit facing +z; the origin is where your hips go. */
export function chair(opt = {}) {
  const v = new Vox();
  const fab = M(opt.color || '#4d5a78', 3), fabD = tone(fab, -0.2), k = M(BLACK, 0), steel = M('#9aa3b0', 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    v.tube(0, 2, 0, Math.cos(a) * 9, 1.4, Math.sin(a) * 9, 1.0, k);
    v.sphere(Math.round(Math.cos(a) * 9), 1, Math.round(Math.sin(a) * 9), 1.3, M('#18181c', 0));
  }
  v.cyl('y', -0.5, -0.5, 2, 12, 1.5, steel);
  v.cyl('y', -0.5, -0.5, 10, 13, 3.6, k);
  v.rbox(-9, 12, -8, 9, SEAT_H, 7, 3, fab);                  // the seat stops short of the knees
  v.paint(-9, 12, -8, 9, 13, 7, k);
  v.box(-1, 13, -10, 1, 22, -8, k);                          // spine
  v.rbox(-8, 20, -10, 8, 39, -7, 3, fab, 'xy');              // back
  v.paint(-6, 23, -10, 6, 36, -9, fabD);
  v.paint(-5, 24, -8, 5, 35, -7, (x, y) => ((y - 24) % 4 === 3 ? fabD : 0));       // stitching
  for (const s of [-1, 1]) {
    v.box(s > 0 ? 11 : -12, 14, -4, s > 0 ? 12 : -11, 22, -2, k);
    v.box(s > 0 ? 9 : -11, 14, -4, s > 0 ? 11 : -9, 15, -2, k);
    v.rbox(s > 0 ? 10 : -13, 22, -6, s > 0 ? 13 : -10, 24, 4, 1, k);
  }
  return v;
}

/** A beige CRT. The screen faces +z; a live picture is laid over it by the scene. 20 × 20 × 18. */
export function crt(opt = {}) {
  const v = new Vox();
  const body = M(opt.color || CREAM, 0), shade = tone(body, -0.14), deep = tone(body, -0.3);
  v.rbox(-10, 3, -9, 10, 20, 9, 2, body);
  for (let z = -9; z < -3; z++) {                            // the tube tapers toward the back
    const k = Math.round((-3 - z) * 0.55);
    v.carve(-10, 3, z, -10 + k, 20, z + 1); v.carve(10 - k, 3, z, 10, 20, z + 1); v.carve(-10, 20 - k, z, 10, 20, z + 1);
  }
  v.decal('+z', -9, 4, 9, 19, shade);                        // bezel
  v.carve(-7, 7, 8, 7, 18, 9);                               // the screen sits back a little
  v.box(-7, 7, 7, 7, 18, 8, M('#0e1512', 0));
  v.box(-7, 5, 8, -3, 6, 9, deep);                           // badge
  v.set(6, 5, 8, glow('#86e0a8')); v.set(4, 5, 8, deep);
  for (let x = -7; x < 7; x += 2) v.carve(x, 19, -6, x + 1, 20, 2);        // vents
  v.box(-3, 2, -3, 3, 3, 3, shade);
  v.rbox(-7, 0, -5, 7, 2, 5, 2, shade, 'xz');
  return v;
}
/** The live screen: centre (voxels, from the CRT origin) and size. */
export const CRT_SCREEN = Object.freeze({ x: 0, y: 12.5, z: 8.08, w: 14, h: 11 });

export function keyboard() {
  const v = new Vox();
  const body = M(CREAM, 0);
  v.rbox(-12, 0, -4, 12, 2, 4, 1, tone(body, -0.12), 'xz');
  for (let z = -3; z < 3; z++) for (let x = -11; x < 11; x++) {
    const wide = z === 2 && x >= -4 && x < 4;                // space bar
    v.set(x, 2, z, (x + z) % 2 === 0 || wide ? body : tone(body, -0.08));
  }
  v.set(-11, 2, -3, M('#c96a5a', 0));
  for (let x = 8; x < 11; x++) v.set(x, 2, -3, M('#9aa3b0', 0));
  return v;
}

export function mouse() {
  const v = new Vox();
  v.rbox(-2, 0, -3, 2, 2, 3, 1, M(CREAM, 0));
  v.set(-1, 2, 1, M('#b3aa94', 0)); v.set(0, 2, 1, M('#b3aa94', 0));
  for (let z = 3; z < 9; z++) v.set(0, 0, z, M(BLACK, 0));
  return v;
}

export const LAMP_SHADES = Object.freeze(['#3f8a5a', '#c9893f', '#3f7f9a', '#b5483f', '#8a5a8f']);

/** A banker's lamp: brass stem, a coloured glass shade, and a warm strip of light under it. */
export function desklamp(opt = {}) {
  const v = new Vox();
  const brass = M('#c9a24a', 0), dark = tone(brass, -0.32);
  const shade = M(opt.color || LAMP_SHADES[0], 0), lite = tone(shade, 0.22);
  v.cyl('y', -0.5, -0.5, 0, 1, 4.4, dark);
  v.cyl('y', -0.5, -0.5, 1, 2, 3.4, brass);
  v.cyl('y', -0.5, -0.5, 2, 11, 0.9, brass);
  for (let x = -7; x < 7; x++) {
    for (let y = 10; y < 15; y++) for (let z = -4; z < 4; z++) {
      const r = Math.hypot(y - 9.5, z + 0.5 + 0.5);
      const cap = x === -7 || x === 6;
      if (r <= 4.6 && (cap || r > 3.2)) v.set(x, y, z, cap ? brass : (y >= 13 && z > -2 && z < 1 ? lite : shade));
    }
  }
  v.box(-6, 10, -3, 6, 11, 3, glow('#ffe6b0'));               // the lit underside
  v.set(4, 9, 3, brass); v.set(4, 8, 3, brass); v.set(4, 7, 3, dark);     // pull chain
  return v;
}

/** A three-drawer filing cabinet with something left on top. 20 × 52 × 22. */
export function cabinet() {
  const v = new Vox();
  const st = M(STEEL, 0), lite = tone(st, 0.16), dark = tone(st, -0.26);
  v.box(-10, 0, -11, 10, 50, 11, st);
  v.box(-10, 0, -11, 10, 2, 11, dark);
  for (let i = 0; i < 3; i++) {
    const y = 3 + i * 16;
    v.box(-9, y, 11, 9, y + 14, 12, lite);
    v.box(-4, y + 9, 12, 4, y + 10, 13, dark);                // handle
    v.box(-3, y + 3, 12, 3, y + 6, 13, M('#f1ead8', 0));      // label
    v.set(7, y + 11, 12, dark);                               // lock
  }
  v.box(-7, 50, -6, 5, 56, 6, M('#b98d57', 2));               // a cardboard box
  v.box(-7, 55, -1, 5, 56, 1, M('#d9c08a', 0));
  v.box(6, 50, 2, 9, 51, 8, M('#f1ead8', 0));                 // loose papers
  return v;
}

/** A low sideboard: the team shelf. Things the team made are displayed on top. 80 × 28 × 20. */
export function credenza(opt = {}) {
  const v = new Vox();
  const wood = M(opt.color || WOOD_DARK, 2), pale = tone(wood, 0.18), dark = tone(wood, -0.25);
  for (const x of [-37, 35]) for (const z of [-8, 6]) v.box(x, 0, z, x + 2, 5, z + 2, dark);
  v.box(-40, 5, -10, 40, 26, 10, wood);
  v.box(-40, 26, -10, 40, 28, 10, pale);
  for (let i = 0; i < 4; i++) {
    const x = -39 + i * 19.5;
    v.box(Math.round(x), 7, 10, Math.round(x + 18.5), 25, 11, i % 2 ? wood : pale);
    v.box(Math.round(x + (i % 2 ? 2 : 15)), 14, 11, Math.round(x + (i % 2 ? 3 : 16)), 19, 12, M(STEEL, 0));
  }
  return v;
}
/** Six display spots along the top of the credenza (voxels). */
export const CREDENZA_SLOTS = Object.freeze([-33, -20, -7, 6, 19, 32].map((x) => [x, 28, 0]));

/** The task board, for hanging on a wall. Origin is its bottom centre, back against the wall. 100 × 56 × 3. */
export function taskboard() {
  const v = new Vox();
  const frame = M(WOOD, 2);
  v.box(-50, 0, 0, 50, 56, 2, frame);
  v.box(-48, 2, 1, 48, 54, 3, M('#f1ead8', 0));
  v.box(-48, 47, 2, 48, 54, 3, M('#d9cdb0', 0));              // header strip
  for (let i = 1; i < 6; i++) v.box(-48 + i * 16, 2, 2, -47 + i * 16, 47, 3, M('#cfc3a4', 0));
  v.box(-46, 0, 2, 46, 2, 5, tone(frame, -0.2));              // pen tray
  v.box(-40, 2, 3, -34, 3, 4, M('#d8493f', 0)); v.box(-30, 2, 3, -24, 3, 4, M('#3f7f9a', 0));
  return v;
}
/** Where cards go on the board: six columns; each cell is [x, y] of a card's bottom-left, z in front. */
export const BOARD = Object.freeze({ cols: 6, colX: (i) => -47 + i * 16, colW: 15, top: 45, z: 3, cardW: 6, cardH: 5, perCol: 12 });

/** The same board on a wheeled stand, for rooms with no wall to hang it on. */
export function whiteboard() {
  const v = new Vox();
  const st = M('#9aa3b0', 0);
  for (const s of [-1, 1]) {
    v.box(s * 46 - 1, 2, -1, s * 46 + 1, 78, 1, st);
    v.box(s * 46 - 1, 1, -9, s * 46 + 1, 3, 9, st);
    v.sphere(s * 46 - 0.5, 0.6, -8.5, 1.2, M(BLACK, 0)); v.sphere(s * 46 - 0.5, 0.6, 7.5, 1.2, M(BLACK, 0));
  }
  v.stamp(taskboard(), 0, 22, -1);
  return v;
}
export const WHITEBOARD_BOARD_Y = 22;

/** A leafy plant in a pot. */
export function plant(opt = {}) {
  const v = new Vox();
  const r = rng(opt.seed || 5);
  const pot = M('#a5552f', 1), leaf = M('#5f9150', 2), leafL = M('#86c06a', 2), leafD = M('#3f6638', 2);
  v.cyl('y', -0.5, -0.5, 0, 9, 6.5, pot, 7.6);
  v.cyl('y', -0.5, -0.5, 9, 11, 8.2, tone(pot, 0.12));
  v.cyl('y', -0.5, -0.5, 10, 11, 6.5, M('#3a2a1c', 3));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.6, reach = 5 + r() * 5, h = 16 + r() * 16;
    const x = Math.cos(a) * reach, z = Math.sin(a) * reach;
    v.tube(0, 10, 0, x * 0.7, h - 3, z * 0.7, 0.6, leafD);
    v.ellipsoid(Math.round(x), Math.round(h), Math.round(z), 4 + r() * 2, 2 + r() * 1.5, 3 + r() * 2, [leaf, leafL, leaf, leafD][i % 4]);
  }
  return v;
}

/** A tall plant for corners. */
export function planttall(opt = {}) {
  const v = new Vox();
  const r = rng(opt.seed || 9);
  const pot = M('#d9d2c2', 0), leaf = M('#4f8a4a', 2), leafL = M('#7fb86a', 2), leafD = M('#36603a', 2);
  v.cyl('y', -0.5, -0.5, 0, 14, 7, pot, 8.5);
  v.cyl('y', -0.5, -0.5, 13, 14, 7.2, M('#3a2a1c', 3));
  v.tube(0, 13, 0, 1, 40, -1, 1.1, M('#6b4a2f', 2));
  v.tube(1, 40, -1, -1, 58, 1, 0.9, M('#6b4a2f', 2));
  for (let i = 0; i < 14; i++) {
    const y = 28 + i * 2.6 + r() * 3, a = i * 2.4 + r(), reach = 5 + r() * 5;
    v.ellipsoid(Math.round(Math.cos(a) * reach), Math.round(y), Math.round(Math.sin(a) * reach), 4.5, 2.2, 3.6, [leaf, leafL, leafD][i % 3]);
  }
  return v;
}

/** A standing lamp with a glowing shade. */
export function floorlamp() {
  const v = new Vox();
  const k = M('#4a4038', 0);
  v.cyl('y', -0.5, -0.5, 0, 2, 6, k);
  v.cyl('y', -0.5, -0.5, 2, 58, 0.8, k);
  v.cyl('y', -0.5, -0.5, 54, 66, 8, glow('#f3d9a4'), 5.5);     // the shade is lit from inside
  v.cyl('y', -0.5, -0.5, 54, 65, 6.6, 0, 4.2);
  v.sphere(-0.5, 58, -0.5, 2.6, glow('#ffe2a8'));
  return v;
}

/** A bookcase, well used. 80 × 88 × 14. */
export function bookshelf(opt = {}) {
  const v = new Vox();
  const r = rng(opt.seed || 3);
  const wood = M(opt.color || WOOD_DARK, 2), dark = tone(wood, -0.28);
  v.box(-40, 0, -7, 40, 88, 7, wood);
  v.carve(-38, 3, -5, 38, 86, 7);
  v.box(-38, 3, -6, 38, 86, -5, dark);
  const spines = ['#b5483f', '#3f8a72', '#5a6fa8', '#c9893f', '#8a5a8f', '#6f8a4a', '#3f7f9a', '#d9cdb0', '#4a3f35', '#e0705f'];
  for (let s = 0; s < 5; s++) {
    const y0 = 3 + s * 17;
    if (s) v.box(-38, y0 - 2, -5, 38, y0, 6, wood);
    let x = -37;
    while (x < 36) {
      if (r() < 0.14) {                                         // a gap with something in it
        const w = 5 + ((r() * 4) | 0);
        if (r() < 0.5) v.sphere(x + 2, y0 + 3, 0, 2.6, M(spines[(r() * spines.length) | 0], 0));
        else { v.box(x + 1, y0, -2, x + 4, y0 + 2, 2, M('#a5552f', 1)); v.ellipsoid(x + 2, y0 + 5, 0, 2.6, 3, 2.6, M('#5f9150', 2)); }
        x += w; continue;
      }
      const w = 2 + ((r() * 3) | 0), h = 9 + ((r() * 5) | 0), c = M(spines[(r() * spines.length) | 0], 1);
      const depth = 3 + ((r() * 2) | 0);
      if (x + w > 37) break;
      v.box(x, y0, -4, x + w, y0 + h, depth, c);
      v.box(x, y0 + 2, depth - 1, x + w, y0 + 3, depth, tone(c, 0.3));
      if (h > 11) v.box(x, y0 + h - 3, depth - 1, x + w, y0 + h - 2, depth, tone(c, 0.3));
      x += w;
    }
  }
  return v;
}

/** A sofa. 88 × 32 × 36, seat about 16 voxels up. */
export function sofa(opt = {}) {
  const v = new Vox();
  const fab = M(opt.color || '#6b5a7e', 3), dark = tone(fab, -0.22), lite = tone(fab, 0.14);
  for (const x of [-40, 38]) for (const z of [-14, 13]) v.box(x, 0, z, x + 2, 4, z + 2, M(WOOD_DARK, 1));
  v.rbox(-44, 4, -16, 44, 14, 18, 2, dark);
  v.rbox(-44, 12, -18, 44, 32, -8, 4, fab);                    // back
  for (const s of [-1, 1]) v.rbox(s > 0 ? 34 : -44, 10, -16, s > 0 ? 44 : -34, 24, 18, 4, fab);
  for (const x of [-33, 1]) v.rbox(x, 13, -9, x + 32, 18, 17, 3, lite);              // seat cushions
  for (const x of [-33, 1]) v.rbox(x, 17, -11, x + 32, 30, -6, 3, lite, 'xy');       // back cushions
  v.rbox(-30, 18, -6, -18, 28, -1, 3, M(opt.pillow || '#e0705f', 3));                // a throw pillow
  return v;
}

/** A plinth for the gallery; whatever is exhibited stands on top. 20 × 36 × 20. */
export function pedestal() {
  const v = new Vox();
  const w = M('#e9e3d4', 1);
  v.box(-10, 0, -10, 10, 3, 10, tone(w, -0.16));
  v.box(-8, 3, -8, 8, 33, 8, w);
  v.box(-10, 33, -10, 10, 36, 10, tone(w, 0.08));
  v.box(-5, 20, 8, 5, 26, 9, M('#c9a24a', 0));                 // brass plaque
  v.box(-3, 22, 9, 3, 23, 10, M('#6b4a1c', 0)); v.box(-3, 24, 9, 2, 25, 10, M('#6b4a1c', 0));
  return v;
}
export const PEDESTAL_TOP = 36;

/** A long table for whoever has no desk today. 96 × 30 × 36. */
export function hottable() {
  const v = new Vox();
  const wood = M('#b98d57', 2);
  v.box(-48, 28, -18, 48, 30, 18, (x, y, z) => (y === 28 ? tone(wood, -0.25) : (x + 48) % 12 === 0 ? tone(wood, -0.1) : wood));
  for (const x of [-44, 41]) { v.box(x, 0, -14, x + 3, 28, -11, M(BLACK, 0)); v.box(x, 0, 11, x + 3, 28, 14, M(BLACK, 0)); v.box(x, 2, -14, x + 3, 4, 14, M(BLACK, 0)); }
  return v;
}

export { rng, WOOD, WOOD_DARK, CREAM, STEEL, BLACK };
