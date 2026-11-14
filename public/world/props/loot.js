// The Office — what there is to find: a coin and a keycard. Every floor that
// hides them uses these two models, so that you know one when you see one.
// Both are sculpted standing up, facing +z, centred on x and z with their
// lowest voxel at y = 0, and are meant to turn slowly a little above the
// ground (see levels/loot.js, and the level kit's w.loot()).
import { Vox, M, glow, tone } from '../vox/vox.js';

/** An office token: a thick gold disc with a square hole, like the ones the arcade cabinet takes. 9 × 9 × 2. */
export function coin() {
  const v = new Vox();
  const gold = glow('#f2c64a'), rim = M('#b98a1e', 0), pale = glow('#ffe58f');
  v.cyl('z', 0, 4.5, -1, 1, 4.6, rim);                 // the rim
  v.cyl('z', 0, 4.5, -1, 1, 3.7, gold);                // the face
  v.carve(-1, 3, -1, 1, 6, 1);                         // the hole a string would go through
  v.box(-3, 6, -1, -2, 7, 1, pale); v.box(-2, 7, -1, 0, 8, 1, pale);   // a highlight where the light catches it
  return v;
}

/** A staff keycard on its lanyard clip: cream plastic, a coloured band, a photo nobody would recognise. 9 × 15 × 2. */
export function keycard() {
  const v = new Vox();
  const card = M('#f3eedd', 0), edge = tone(card, -0.16), band = glow('#3f8fd0'), ink = M('#2b2f3a', 0), clip = M('#9aa0aa', 0);
  v.rbox(-4, 0, -1, 5, 12, 1, 1, card, 'xy');
  v.box(-4, 0, -1, 5, 1, 1, edge);
  v.box(-4, 8, -1, 5, 11, 1, band);                    // the band across the top
  v.box(-3, 3, 0, 0, 7, 1, tone(card, -0.3)); v.box(-2, 5, 0, -1, 6, 1, ink); v.box(-3, 3, 0, 0, 4, 1, ink);   // the photo: a head, shoulders
  v.box(1, 5, 0, 4, 6, 1, ink); v.box(1, 3, 0, 3, 4, 1, ink);                                               // two lines of name
  v.box(-1, 12, -1, 2, 13, 1, clip); v.box(0, 13, -1, 1, 15, 1, clip);                                       // the clip
  return v;
}

export const CATALOGUE = {};
