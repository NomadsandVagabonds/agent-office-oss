// The Backrooms — what the middle manager is made of (cast/middle-manager.js). Voxels, fine ones.
//
// Somebody who has been in the building a long time and has been stretched by it: three metres, so that under an
// ordinary ceiling it stands bent, its head down, and in a doorway it folds nearly in half; and thin enough to stand
// sideways in one. A tired grey-brown suit a size too short for it, so that the wrists and the ankles show; an
// off-white shirt; a dull patterned tie; a lanyard and a big badge whose photograph is blank. Long legs, longer arms,
// hands with fingers too long by a joint. And where the face should be, nothing: a head like an egg, sallow, smooth,
// turned to you.
// Then the same suit with far too much in it: the jacket will not close, the shirt has gone at the buttons, the tie lies
// on top of it all.
//
// Each piece is made along +y from its joint at the origin (hips, shoulders, elbows, knees, wrists), front on +z. Few
// colours, so that the faces merge and it reads smooth, not built.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.012;           // metres per voxel
export const TORSO = 66;          // hips to shoulders
export const NECK = 15;
export const UPPER = 53, FORE = 53, HAND = 26;     // the arms: they hang below the knee, and the hands are long
export const THIGH = 58, SHIN = 58;                // the legs: the hip is at 1.48 m
export const SHOE = 7;                             // voxels from the ankle to the floor
export const HEAD = 34;                            // voxels from the neck to the crown
/** How tall it stands, metres, straight up. */
export const STANDS = (THIGH + SHIN + SHOE + TORSO + NECK + HEAD) * S;

const SUIT = '#47433c', SUIT2 = '#3d3a34', SHIRT = '#d9d5c6', TIE = '#5d5a3c', TIE2 = '#77653f', SOCK = '#22262e', SKIN = '#d8c4b1', SKIN2 = '#cbb5a1', SKIN3 = '#bca390';
const LANYARD = '#3f7f86';

/**
 * Its skin as it gets near to full: the same flesh as the lines and Mother (cast/mother.model.js) — four reds that do not
 * agree, a bruise where three waves meet, a vein now and then — at this finer grain (0.4: the same size of blotch on it).
 * (The owner: "on the final stages the skin converts to be similar to what we used on telephone pole monster, mother etc.
 * Like it is getting engorged".)
 */
const RAW = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'], BRUISE = '#5e3540', VEIN = '#4a2a3c';
export function fleshOf(k = 0, grain = 0.4) {
  const raw = RAW.map((c) => M(c, 0)), bruise = M(BRUISE, 0), vein = M(VEIN, 0);
  return (X, Y, Z) => {
    const x = X * grain, y = Y * grain, z = Z * grain, h = Math.sin(x * 0.61 + y * 1.3 + k * 2.1) + Math.sin(z * 0.83 - y * 0.7 + k) + Math.sin((x + z) * 0.37 - k * 1.7);
    if (h > 2.15) return bruise;
    if (Math.abs(Math.sin(x * 0.9 + k * 3) * 4 + Math.sin(y * 0.5 + z * 0.4) * 3 - z * 0.6) < 0.2) return vein;
    return raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4];
  };
}
/** How much of it has turned, by face (0…3): none, none, blotches up from the neck, all of it. */
export const TURNED = Object.freeze([0, 0, 0.4, 1]);

/** A smooth solid of revolution about +y: radius r(k) at height k = 0…1 of `len`, and `depth` its front-to-back share. */
function lathe(v, len, r, color, depth = 1, x0 = 0, z0 = 0) {
  for (let y = 0; y <= len; y++) {
    const k = y / len, rx = r(k), rz = rx * depth, R = Math.ceil(rx) + 1;
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) if ((x / rx) ** 2 + (z / rz) ** 2 <= 1) v.set(x0 + x, y, z0 + z, typeof color === 'function' ? color(x, y, z, k) : color);
  }
  return v;
}

/**
 * Its body from the hips (y 0) to the shoulders (y TORSO). `full`: the same suit with far too much in it — the belly has come
 * through the shirt, the buttons have gone, and the seams have split down both sides, and what it is full of shows through
 * every split: paper.
 */
export function torsoVox(full = false) {
  const v = new Vox(), suit = M(SUIT, 0), suit2 = M(SUIT2, 0), shirt = M(SHIRT, 0), tie = M(TIE, 0), tie2 = M(TIE2, 0), skin = M(SKIN2, 0), belly = M(SKIN, 0), navel = M(SKIN3, 0), button = M('#08080a', 0);
  const strap = M(LANYARD, 0), card = M('#ece9df', 0), blank = M('#b9b4a8', 0), band = M(LANYARD, 0), clip = M('#9a9a96', 0), paper = M('#f3f0e6', 0), paper2 = M('#e2dccb', 0), flesh = fleshOf(3, 0.5);
  // thin: a waist like a wrist, a narrow chest, and the shoulders squared by the jacket. Full: round as a sack, lowest at the belly
  const w = full ? (k) => 18 + Math.sin(Math.min(1, k * 1.15) * Math.PI) * 26 + (k > 0.86 ? (k - 0.86) * 40 : 0) : (k) => 7 + k * 5 + (k > 0.84 ? (k - 0.84) * 45 : 0);
  const d = full ? 1.0 : 0.62;
  lathe(v, TORSO, w, (x, y, z, k) => {
    const rx = w(k), front = z > rx * d * 0.45;
    if (y < 3) return suit2;
    if (!full) return front && k > 0.42 && Math.abs(x) < (k - 0.42) * 22 + 1 ? shirt : Math.abs(x) > rx * 0.82 ? suit2 : suit;
    // full: the jacket open as far as it will go; between its edges the shirt, and through the shirt, low down, the belly
    const open = Math.abs(x) < 9 + k * 12, gape = k < 0.62 && Math.abs(x) < 15 - k * 12;
    // the seams down its sides have gone: paper in the splits
    if (Math.abs(Math.abs(x) - rx * 0.93) < 1.2 && Math.abs(z) < rx * 0.35 && y % 5 < 3) return y % 2 ? paper : paper2;
    if (front && gape) return y === 14 && Math.abs(x) < 2 ? navel : flesh(x, y, z);          // (the belly, engorged: raw, veined)
    if (front && open) return Math.abs(Math.abs(x) - (15 - k * 12)) < 1.5 && y % 3 === 0 ? paper : shirt;          // (and at the torn edge of the shirt)
    return Math.abs(x) > rx * 0.82 ? suit2 : suit;
  }, d);
  // full: the belly comes out further in front than the rest of it
  if (full) v.ellipsoid(0, Math.round(TORSO * 0.32), Math.round(w(0.32) * 0.75), 17, 15, 10, (x, y, z) => (z > 0 && Math.abs(x) < 15 - (y / TORSO) * 12 ? (y === 14 && Math.abs(x) < 2 ? navel : flesh(x, y, z)) : suit));
  const front = (x, y) => { let z = 90; while (z > -90 && !v.has(x, y, z)) z--; return z; };
  // the tie: narrow, from the collar down; full, it lies on top of the belly and stops well short
  const tieFrom = full ? Math.round(TORSO * 0.55) : Math.round(TORSO * 0.18);
  for (let y = tieFrom; y <= TORSO - 2; y++) { const wd = y > TORSO - 6 ? 2 : y < tieFrom + 4 ? 2 : 1; for (let x = -wd; x <= wd; x++) v.set(x, y, front(x, y) + 1, (x + y) % 5 < 2 ? tie2 : tie); }          // (a dull diagonal stripe)
  // buttons: done up when it is thin; full, one left hanging by a thread at the top of the gape
  if (full) { v.set(6, Math.round(TORSO * 0.62), front(6, Math.round(TORSO * 0.62)) + 1, button); }
  else for (const y of [16, 26]) v.set(2, y, front(2, y) + 1, button);
  // the lanyard, round its neck and down, and the badge on it, big, at the middle of its chest: its photograph is as blank
  // as its face. Full, the lanyard is pulled taut over the belly and the badge rides up on it
  const bx = full ? -5 : -4, by = full ? 46 : 30, bw = 10, bh = 14;
  for (const sx of [-1, 1]) for (let y = by + bh; y <= TORSO - 1; y++) { const x = Math.round(sx * (2 + (y - by - bh) * (full ? 0.5 : 0.18))); v.set(x, y, front(x, y) + 1, strap); }
  for (let x = bx; x <= bx + bw - 1; x++) for (let y = by; y <= by + bh - 1; y++) v.set(x, y, front(x, y) + 2, y >= by + bh - 3 ? band : x > bx + 2 && x < bx + 7 && y > by + 3 && y < by + 9 ? blank : card);
  v.set(bx + 4, by + bh, front(bx + 4, by + bh) + 2, clip); v.set(bx + 5, by + bh, front(bx + 5, by + bh) + 2, clip);
  // the jacket's shoulders: squared, sharp; full, it has ridden up on them
  for (const sx of [-1, 1]) v.ellipsoid(sx * (full ? 34 : 13), TORSO - 3, 0, full ? 9 : 6, 4, full ? 11 : 6, suit);
  return v;
}

/** Its neck and its collar: long, thin, along +y from the shoulders. */
export function neckVox(raw = false) {
  const v = new Vox(), skin = M(SKIN2, 0), shirt = M(SHIRT, 0), flesh = fleshOf(11);
  lathe(v, NECK, (k) => 3.6 - k * 0.6, raw ? flesh : skin);
  lathe(v, 5, () => 5.5, shirt);
  return v;
}

/** How fed it looks: 0 sad, 1 nothing, 2 pleased, 3 the grin (cast/middle-manager.js picks it by how fat it is). */
export const FACES = 4;

/**
 * Its head: an egg, longer than a head, narrower at the bottom, sallow and smooth, and on it a face that is barely one. Unfed:
 * two small black pupils, a mouth turned down, and the dark running from its eyes like tears. Fed, the pupils grow and run,
 * the black smearing down its cheeks, and the mouth stretches: a thin black slit, then wider than a mouth, then from one side
 * of the head nearly to the other. Fed, too, the face has slipped: a band of it is out of true, shifted sideways, as a tape
 * tears. Nothing white in its eyes and nothing red in its mouth: what is in there is dark. The neck joins underneath at the
 * origin; front on +z.
 * @param face 0…3 (FACES)
 */
export function headVox(face = 0) {
  const v = new Vox(), pale = M(SKIN, 0), mid = M(SKIN2, 0), back = M(SKIN3, 0);          // (sallow, not white: somebody's, once)
  // (fed far enough, it turns: blotches of raw flesh up from the neck, and at the last all of it, engorged)
  const flesh = fleshOf(7), turned = TURNED[face] ?? 0, turns = (x, y, z) => turned >= 1 || (turned > 0 && (1 - y / HEAD) * 1.4 + Math.sin(x * 0.7 + z * 0.5) * 0.25 + Math.sin(y * 0.9 - x * 0.3) * 0.2 > 1 - turned);
  lathe(v, HEAD, (k) => { const t = k * 2 - 1; return Math.max(0.5, Math.sqrt(Math.max(0, 1 - t * t)) * (9.5 + k * 1.8)); }, (x, y, z) => (turns(x, y, z) ? flesh(x, y, z) : z > 3 ? pale : z > -4 ? mid : back), 1.05);
  const black = M('#0b0a0a', 0), smear = M('#2a211e', 0), stain = M('#5e5149', 0);
  const front = (x, y) => { for (let z = 20; z > 0; z--) if (v.has(x, y, z)) return z; return null; };
  const dot = (x, y, c, deep = 2) => { const z = front(x, y); if (z === null) return; for (let d = 0; d < deep; d++) v.set(x, y, z - d, c); };
  const EY = 21, MY = 11, eye = [1.6, 2.0, 2.6, 3.4][face], run = [7, 4, 7, 11][face];
  for (const sx of [-1, 1]) {
    const cx = sx * 4;
    // the pupil: black, round, too big for the size of the face as it grows
    for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) if (dx * dx + dy * dy <= eye * eye) dot(cx + dx, EY + dy, black, 3);
    // and what runs from it: a smear down the cheek, narrowing, dark then stained
    for (let t = 1; t <= run; t++) { const w = Math.max(0, Math.round(eye * (1 - t / (run + 1)) * 0.8)); for (let dx = -w; dx <= w; dx++) dot(cx + dx + (t > run * 0.6 ? sx : 0), EY - Math.round(eye) - t, t < run * 0.5 ? smear : stain, 1); }
  }
  // the mouth: a thin black slit — down at the ends; flat; up; and at the last far too wide, and open a little, black inside
  const half = [3, 4, 6, 9][face], open = [0, 0, 1, 3][face];
  for (let x = -half; x <= half; x++) {
    const k = (x / half) ** 2, y = face === 0 ? MY + Math.round(2 * (1 - k)) : face === 1 ? MY : MY + Math.round((face === 3 ? 4 : 2) * k);
    for (let o = 0; o <= Math.round(open * (1 - k * 0.7)); o++) dot(x, y - o, black, 2);
  }
  if (face === 3) for (const sx of [-1, 1]) for (let t = 1; t <= 4; t++) dot(sx * (half - 1), MY + 4 - t - 1, smear, 1);          // (it runs from the corners too)
  // fed, a band of the face has slipped sideways, out of true
  if (face >= 2) {
    const band = face === 3 ? [16, 19] : [17, 18], shift = face === 3 ? 2 : 1, was = new Map();
    for (let y = band[0]; y <= band[1]; y++) for (let x = -12; x <= 12; x++) { const z = front(x, y); if (z !== null) was.set(`${x},${y}`, [z, v.get(x, y, z)]); }
    for (const [key, [z, c]] of was) { const [x, y] = key.split(',').map(Number), to = front(x + shift, y); if (to !== null) v.set(x + shift, y, to, c); }
  }
  return v;
}

/**
 * An arm's length of sleeve, along +y, `len` voxels, narrowing, with the creases a sleeve has at the elbow and a fold or two
 * between. `cuff`: the forearm. It is too short: two buttons at the cuff, a band of shirt, then the wrist; `watch`: on that
 * wrist, a cheap watch on a black strap.
 */
export function sleeveVox(len, cuff = false, wide = 4.6, watch = false) {
  const v = new Vox(), suit = M(SUIT, 0), fold = M(SUIT2, 0), shirt = M(SHIRT, 0), skin = M(SKIN2, 0), button = M('#14120f', 0), strap = M('#101012', 0), face = M('#c9c7bd', 0), rim = M('#8f8d86', 0);
  const r = (k) => (cuff && k > 0.86 ? 2.6 : wide - k * 1.3 + (!cuff && k > 0.9 ? 0.5 : 0) + (cuff && k < 0.08 ? 0.6 : 0));          // (the elbow, where the two meet)
  lathe(v, len, r, (x, y, z, k) => {
    if (cuff && y > len * 0.92) return watch && y > len * 0.93 && y < len * 0.97 ? strap : skin;
    if (cuff && y > len * 0.82) return shirt;
    // creases: across the inside of the elbow, and a fold or two down the length, a shade darker
    if (!cuff && k > 0.86 && z < 0) return fold;
    // its sides a shade darker than its front and back, so it reads round, not flat
    if (Math.abs(x) > r(k) * 0.62) return fold;
    if (Math.abs(Math.sin(k * 9 + x * 0.4)) < 0.12 && z < 1) return fold;
    return suit;
  });
  if (cuff) { const y = Math.round(len * 0.8); v.set(2, y, -3, button); v.set(2, y - 2, -3, button); }
  if (cuff && watch) { const y = Math.round(len * 0.95); for (let x = -1; x <= 1; x++) for (let dy = -1; dy <= 1; dy++) v.set(x, y + dy, 3, Math.abs(x) + Math.abs(dy) === 2 ? rim : face); }
  return v;
}

/** A hand: long, pale, the fingers apart and too long by a joint, a little curled, the knuckles standing out. Along +y from the wrist. */
export function handVox(raw = false) {
  const flesh = fleshOf(5), pale = M(SKIN2, 0), knuckle = M(raw ? BRUISE : SKIN3, 0), nail = M(raw ? '#d9cdb0' : '#e3d6c6', 0);
  const skin = (x, y, z) => (raw ? flesh(x, y, z) : pale), v = new Vox();
  lathe(v, 7, (k) => 3.2 - k * 0.4, skin, 0.55);
  for (const [x, len, curl] of [[-3, 15, 1], [-1, 19, 2], [1, 19, 2], [3, 16, 1]]) {
    for (let y = 7; y <= 7 + len; y++) { const z = Math.round(((y - 7) / len) ** 2 * curl * 2), j = (y - 7) % 7 === 0; v.set(x, y, z, j ? knuckle : y === 7 + len ? nail : skin(x, y, z)); if (j) v.set(x, y, z + 1, knuckle); }
  }
  for (let y = 0; y <= 10; y++) { const x = -4 - Math.round(y * 0.25), z = Math.round(y * 0.3); v.set(x, y + 1, z, skin(x, y + 1, z)); }         // the thumb
  return v;
}

/** A trouser leg, along +y, narrowing to the ankle; `short`: it stops short of the shoe, over a thin sock and a band of shin. */
export function trouserVox(len, wide = 5.2, short = false) {
  const v = new Vox(), suit = M(SUIT, 0), crease = M(SUIT2, 0), sock = M(SOCK, 0), skin = M(SKIN3, 0);
  lathe(v, len, (k) => (short && k > 0.84 ? 2.8 : wide - k * 1.4), (x, y, z, k) => (short && k > 0.92 ? sock : short && k > 0.84 ? skin : x === 0 && z > 0 ? crease : suit));
  return v;
}

/** A shoe: black, polished, long and narrow. The ankle is at the origin; the toe points +z; the sole is at y -SHOE. */
export function shoeVox() {
  const v = new Vox(), black = M('#0b0b0d', 0), shine = M('#2c2e34', 0);
  for (let z = -6; z <= 22; z++) { const k = (z + 6) / 28, w = 4 - Math.max(0, k - 0.7) * 6, h = SHOE - Math.round(Math.max(0, k - 0.5) * 6); for (let x = -Math.round(w); x <= Math.round(w); x++) for (let y = -SHOE; y <= -SHOE + h; y++) v.set(x, y, z, y === -SHOE + h && Math.abs(x) < 2 && k > 0.4 ? shine : black); }
  return v;
}
