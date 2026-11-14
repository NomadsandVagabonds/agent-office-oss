// The Office — what the vending machine sells for coins (core/game.mjs). Same
// rules as every other prop (README.md in this folder): 2.5 cm voxels, floor
// at y = 0, centred on x = z = 0, front facing +z. A prize is small: it ends
// up standing on top of the machine that sold it, eight of them on a square
// metre, so about 12 wide, 14 tall and 8 deep (the back row may be taller).
//
//   PRIZE_MODELS[id]()     → Vox       the whole thing, as the machine's window shows it
//   PRIZE_PARTS[id]        → parts     the same thing in pieces, where a piece moves (scene/prizes.js)
//   PRIZE_SPOTS[id]        → [x, y, z] where it stands on the vending machine, in the machine's own voxels
import { Vox, M, glow, glass, tone } from '../vox/vox.js';

const BRASS = '#c9a24a', WOOD = '#7a5234', INK = '#17130c';
const SKIN = '#7ea04a', SKIN_D = '#56733a', BEARD = '#1e1a1c', FELT = '#4d311d', BRAID = '#b39245', COAT = '#b9923a', SHIRT = '#2c8a79';

/** Paint the first voxel met looking at the front of the model at (x, y). */
const front = (v, x, y, color) => { for (let z = 12; z >= -12; z--) if (v.has(x, y, z)) { v.set(x, y, z, color); return; } };

/* ---- the prizes ------------------------------------------------------------------------ */

/** A very small cactus: a terracotta pot, one arm, one flower. 8 × 13 × 6. */
export function cactus() {
  const v = new Vox(), pot = M('#c0663a', 1), green = M('#4f9a52', 1), dark = tone(green, -0.22);
  v.cyl('y', 0, 0, 0, 4, 2.2, pot, 3.1);
  v.cyl('y', 0, 0, 4, 5, 3.1, tone(pot, 0.14)); v.cyl('y', 0, 0, 4, 5, 2.1, M('#3a2a1e', 0));
  v.rbox(-2, 5, -2, 2, 12, 2, 1, green, 'xz');
  v.paint(-2, 5, -1, -1, 12, 1, dark); v.paint(1, 5, -1, 2, 12, 1, dark); v.paint(-1, 5, -2, 1, 12, -1, dark);   // ribs
  v.box(-1, 12, -1, 1, 13, 1, green);
  v.box(2, 7, -1, 4, 8, 1, green); v.box(3, 8, -1, 4, 10, 1, green);                                           // the arm
  v.set(0, 13, 0, M('#f07aa8', 0)); v.set(-1, 13, 0, M('#f7a8c8', 0)); v.set(0, 13, -1, M('#f7a8c8', 0));
  for (const [x, y] of [[-1, 7], [0, 9], [-1, 10], [0, 6]]) front(v, x, y, M('#e8f0c8', 0));                     // spines
  return v;
}

/** A wet floor sign for a desk: a yellow A-frame with something wrong printed on it. 8 × 12 × 8. */
export function wetfloor() {
  const v = new Vox(), yellow = M('#f2c230', 0), edge = tone(yellow, -0.2), k = M(INK, 0);
  for (let y = 0; y < 12; y++) {
    const z = Math.round(3 - y * 0.28);
    v.box(-4, y, z, 4, y + 1, z + 1, yellow); v.box(-4, y, -z - 1, 4, y + 1, -z, yellow);
    v.set(-4, y, z, edge); v.set(3, y, z, edge);
  }
  v.box(-3, 11, -1, 3, 12, 1, edge);                                                                            // the hinge along the top
  for (const x of [-2, -1, 0, 1]) front(v, x, 9, k);                                                             // a line of wording
  for (const x of [-2, -1, 1]) front(v, x, 7, k);                                                                // …and one with a letter missing
  for (const [x, y] of [[0, 4], [-1, 3], [0, 3], [1, 3], [-2, 2], [-1, 2], [0, 2], [1, 2], [-1, 1], [1, 1]]) front(v, x, y, k);   // somebody falling over
  return v;
}

/** The golden stapler, on the cushion it deserves. 12 × 8 × 6. */
export function stapler() {
  const v = new Vox(), gold = M('#e2ba48', 0), deep = tone(gold, -0.3), shine = glow('#ffe58f');
  v.rbox(-6, 0, -3, 6, 2, 3, 1, M('#5a2038', 3), 'xz'); v.paint(-6, 1, -3, 6, 2, 3, M('#7a2c4c', 3));           // the cushion
  v.box(-5, 2, -2, 5, 3, 2, deep);                                                                               // base
  v.box(-5, 3, -2, -3, 5, 2, deep);                                                                              // the hinge
  v.rbox(-5, 4, -2, 5, 7, 2, 1, gold, 'yz');                                                                     // the arm
  v.box(3, 3, -2, 5, 4, 2, gold);                                                                                // its nose comes down to the base
  v.paint(-4, 6, -1, 4, 7, 1, shine);
  v.paint(-5, 4, 1, 5, 5, 2, deep);
  return v;
}

/** A lava lamp. `frame` (0…2) is where the blobs have got to. 6 × 14 × 6. */
export function lavalamp(frame = 0) {
  const v = new Vox(), metal = M('#b9bec8', 0), dark = tone(metal, -0.3), wax = glow('#ff7a4a'), hot = glow('#ffb36a');
  v.cyl('y', 0, 0, 0, 3, 3, metal, 2); v.paint(-3, 0, -3, 3, 1, 3, dark);
  v.cyl('y', 0, 0, 3, 11, 2.1, glass('#7a4fd0'), 1.6);
  v.cyl('y', 0, 0, 11, 13, 1.6, metal, 1); v.set(0, 13, 0, dark); v.set(-1, 13, 0, dark); v.set(0, 13, -1, dark); v.set(-1, 13, -1, dark);
  const blobs = [[[-1, 3, 0], [0, 3, 0], [-1, 3, -1], [0, 3, -1], [0, 4, 0], [-1, 6, -1], [0, 9, 0]],
    [[-1, 3, 0], [0, 3, -1], [-1, 5, 0], [-1, 6, 0], [0, 6, -1], [0, 8, 0], [-1, 9, -1]],
    [[0, 3, 0], [-1, 3, -1], [0, 5, -1], [-1, 7, 0], [0, 7, 0], [-1, 10, -1], [0, 10, 0]]][frame % 3];
  blobs.forEach(([x, y, z], i) => v.set(x, y, z, i % 3 === 0 ? hot : wax));
  return v;
}

/** A desk goat, side on, looking at you. 11 × 12 × 4. */
export function goat() {
  const v = new Vox(), coat = M('#f1ece0', 3), shade = tone(coat, -0.14), hoof = M('#3a2f28', 0), horn = M('#b9a27a', 0), k = M(INK, 0);
  for (const [x, z] of [[-4, -2], [-4, 1], [2, -2], [2, 1]]) { v.box(x, 0, z, x + 1, 4, z + 1, shade); v.set(x, 0, z, hoof); }
  v.rbox(-5, 4, -2, 4, 8, 2, 1, coat);
  v.paint(-3, 6, -2, 0, 8, 2, M('#b98d57', 3));                                                                   // a patch
  v.box(3, 7, -1, 5, 10, 1, coat);                                                                               // neck
  v.box(4, 9, -1, 7, 11, 1, coat); v.set(6, 9, -1, shade); v.set(6, 9, 0, shade);                                // head and muzzle
  v.set(5, 10, 1, k); v.set(5, 10, -2, k);                                                                       // an eye each side
  v.set(6, 8, 0, shade); v.set(6, 7, 0, shade);                                                                  // beard
  v.set(3, 10, 1, shade); v.set(3, 10, -2, shade);                                                               // ears
  v.box(4, 11, -1, 5, 12, 0, horn); v.box(3, 12, -1, 4, 13, 0, horn); v.box(4, 11, 0, 5, 12, 1, horn); v.box(3, 12, 0, 4, 13, 1, horn);
  v.set(-6, 7, 0, coat); v.set(-6, 8, 0, coat);                                                                  // tail
  v.set(4, 6, 1, glow('#f2c64a'));                                                                               // its bell
  return v;
}

/** A bug in amber, on a stand: the green kind, from the cabinet. 8 × 10 × 6. */
export function bug() {
  const v = new Vox(), wood = M(WOOD, 2), body = glow('#6fe08a'), dark = M('#2f7a4a', 0);
  v.box(-4, 0, -3, 4, 2, 3, wood); v.paint(-4, 1, -3, 4, 2, 3, tone(wood, 0.14)); v.box(-2, 1, 3, 2, 2, 4, M(BRASS, 0));
  v.rbox(-3, 2, -2, 3, 10, 2, 1, glass('#f0a030'), 'xy');
  v.box(-1, 5, -1, 1, 7, 1, body); v.set(-1, 7, 0, dark); v.set(0, 7, 0, dark);
  for (const y of [5, 6]) { v.set(-2, y, 0, dark); v.set(1, y, 0, dark); }
  v.set(-2, 4, 0, dark); v.set(1, 4, 0, dark);
  return v;
}

/** Capt. Legacy, small — everything under the neck. 9 × 7 × 6. */
export function mascotBody() {
  const v = new Vox(), coat = M(COAT, 2), boot = M('#2b1d15', 1);
  v.cyl('y', 0, 0, 0, 1, 4, M('#221a16', 0));
  v.box(-3, 1, -1, -1, 3, 2, boot); v.box(1, 1, -1, 3, 3, 2, boot);
  v.rbox(-3, 2, -2, 3, 7, 2, 1, coat, 'xz');
  v.paint(-3, 3, -2, 3, 4, 2, M('#221a16', 0)); front(v, -1, 3, M('#e2ba48', 0)); front(v, 0, 3, M('#e2ba48', 0));   // belt and buckle
  front(v, -1, 6, M(SHIRT, 2)); front(v, 0, 6, M(SHIRT, 2));
  for (const [x, y] of [[-3, 6], [-2, 5], [-1, 5], [0, 4], [1, 4], [2, 4]]) front(v, x, y, M('#7f7392', 2));      // the sash
  for (const sx of [-4, 3]) { v.box(sx, 3, -1, sx + 1, 6, 1, M(SHIRT, 2)); v.box(sx, 2, -1, sx + 1, 3, 1, M(SKIN, 1)); }
  return v;
}
/** …and its head, which turns about the origin: too big, in a three-cornered hat, with a face that came out wrong. 13 × 11 × 9. */
export function mascotHead() {
  const v = new Vox(), skin = M(SKIN, 1), beard = M(BEARD, 3), felt = M(FELT, 2), white = M('#f3f0e2', 0), k = M('#0c0a0b', 0);
  v.rbox(-4, 0, -3, 4, 7, 3, 2, skin);
  v.paint(-4, 0, -1, 4, 2, 3, beard); v.paint(-4, 2, 1, -2, 4, 3, beard); v.paint(2, 2, 1, 4, 4, 3, beard); v.box(-1, -1, 1, 1, 0, 3, beard);
  for (const sx of [-1, 1]) { const x = sx < 0 ? -6 : 4; v.box(x, 3, -1, x + 2, 5, 0, skin); v.set(sx < 0 ? -7 : 6, 5, -1, skin); }   // long ears
  v.box(-1, 2, 3, 1, 4, 4, M(SKIN_D, 1));                                                                         // nose
  for (const [x, y] of [[-3, 4], [-2, 4], [-3, 5], [-2, 5]]) front(v, x, y, white); front(v, -2, 4, k);           // one eye far too big
  front(v, 2, 5, white); front(v, 2, 4, k);                                                                       // …and one that slid
  for (const x of [-1, 0, 1, 2]) front(v, x, 1, x === 0 ? M('#e9e3c6', 0) : k);                                   // the mouth, off centre
  v.box(-6, 7, -4, 6, 8, 5, felt); v.carve(-6, 7, -4, -4, 8, -2); v.carve(4, 7, -4, 6, 8, -2);                   // the brim, a corner to the back
  v.box(-3, 8, -2, 3, 10, 3, felt);
  v.box(-6, 8, -1, -5, 9, 4, felt); v.box(5, 8, -1, 6, 9, 4, felt); v.box(-4, 8, 4, 4, 9, 5, felt);               // turned up at the sides and the front
  v.paint(-4, 8, 4, 4, 9, 5, M(BRAID, 1)); v.paint(-6, 7, 4, 6, 8, 5, M(BRAID, 1));
  return v;
}
/** The whole of it, for a picture. */
export function mascot() { return mascotBody().stamp(mascotHead(), 0, 7, 0); }

/** A lift of your own. One button. It is lit. 10 × 15 × 5. */
export function lift() {
  const v = new Vox(), steel = M('#8a919c', 0), dark = tone(steel, -0.34), door = M('#2f7f78', 0);
  v.box(-5, 0, -2, 5, 15, 2, steel); v.paint(-5, 0, -2, 5, 1, 2, dark); v.paint(-5, 14, -2, 5, 15, 2, dark);
  v.box(-3, 1, 2, 0, 12, 3, door); v.box(0, 1, 2, 3, 12, 3, tone(door, -0.12));                                    // two doors
  v.paint(-1, 1, 2, 0, 12, 3, tone(door, -0.3));
  v.box(-3, 12, 2, 3, 13, 3, dark); v.box(-1, 13, 2, 1, 14, 3, glow('#ffb44a'));                                   // where it says which floor
  v.set(4, 6, 2, glow('#ffd27a')); v.set(4, 7, 2, dark); v.set(4, 5, 2, dark);                                    // the button
  return v;
}

/** What the machine gives away: a bar of something. 7 × 3 × 3. */
export function snack() {
  const v = new Vox();
  v.box(-3, 0, -1, 4, 3, 2, M('#6b3f2a', 0)); v.box(-1, 0, -1, 2, 3, 2, M('#c0463a', 0)); v.paint(-1, 1, 1, 2, 2, 2, M('#f1ead8', 0));
  return v;
}

export const PRIZE_MODELS = { cactus, wetfloor, stapler, lavalamp, goat, bug, mascot, lift, snack };
/** Prizes that are more than one piece: [{ make, at: [x, y, z] voxels, role }]. */
export const PRIZE_PARTS = {
  lavalamp: [0, 1, 2].map((f) => ({ make: () => lavalamp(f), at: [0, 0, 0], role: 'frame' })),
  mascot: [{ make: mascotBody, at: [0, 0, 0], role: 'still' }, { make: mascotHead, at: [0, 7, 0], role: 'head' }],
};

/* ---- where they end up ------------------------------------------------------------------ */

const TOP = 70;                                    // the top of the vending machine (props/kitchen.js), voxels
/** On top of the machine, where everybody can see them: the tall ones at the back, one goat looking over the edge. */
export const PRIZE_SPOTS = Object.freeze({
  cactus: [-15, TOP, -9], lavalamp: [-8, TOP, -9], lift: [0, TOP, -10], mascot: [13, TOP, -8],
  wetfloor: [-15, TOP, 6], stapler: [-5, TOP, 6], bug: [5, TOP, 6], goat: [15, TOP, 7],
});

// The prizes are not furniture: scene/prizes.js stands them on the machine. This list is for the studio
// (/world/dev/studio.html?from=prizes), where you look at them while you sculpt.
export const CATALOGUE = {
  'prize-cactus': { make: () => cactus() }, 'prize-wetfloor': { make: () => wetfloor() }, 'prize-stapler': { make: () => stapler() },
  'prize-lavalamp': { make: () => lavalamp() }, 'prize-goat': { make: () => goat() }, 'prize-bug': { make: () => bug() },
  'prize-mascot': { make: () => mascot() }, 'prize-lift': { make: () => lift() },
};
