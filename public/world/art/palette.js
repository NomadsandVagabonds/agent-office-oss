// The Office — the palette. These are the exact colours of the pixel office;
// everything in the 3D world is painted from this set so it stays one place.
import { shade } from './pix.js';

export const PAL = Object.freeze({
  wall: '#3f7d74', wallSh: '#316159', wallHi: '#5a9c90', skirt: '#4a371f',
  floor: '#7c5838', floorSh: '#634428', floorHi: '#946a40', floorLine: '#4e371f',
  carpet: '#6b5743',
  rug: '#8d3b3b', rugEdge: '#5e2828', rugInk: '#e7c79a',
  woodB: '#9a6a3c', woodS: '#774e29', woodH: '#bd8a53', woodO: '#4f3318',
  steel: '#7d8694', steelS: '#5a626e', steelH: '#a7b0bc',
  crt: '#322c27', crtS: '#221d19', crtH: '#4a423a',
  ink: '#f4ddb4', dim: '#c7a878', sign: '#5a3a22', signE: '#39230f',
  good: '#86e0a8', warn: '#f3b34c', bad: '#e0705f',
  skyT: '#2b2550', skyM: '#7c4f6d', skyL: '#e0935a', moon: '#ffe9c4',
  city: '#241c33', leaf: '#5f9150', leafH: '#86c06a', leafS: '#3f6638',
  pot: '#a5552f', potS: '#7c3d20', paper: '#efe2c4', paperE: '#c9b88e',
});

export const DEPT_TINT = Object.freeze(['#7d5836', '#5a6a7d', '#6f7d5a', '#7d5a6a', '#5a7d72',
  '#7d6f5a', '#6a5a7d', '#7d5a5a']);

export const STATUS_INK = Object.freeze({
  working: PAL.good, done: PAL.good, blocked: PAL.warn,
  thinking: PAL.dim, arriving: '#c9893f', leaving: PAL.dim,
});

/**
 * The office's signature shaded block: base colour, a lighter top band, a
 * darker right/bottom edge and (for flat sprites) a dark outline.
 * In voxel mode the outline is left off — real edges and real light do that job.
 */
export function pxBox(g, x, y, w, h, base, opt = {}) {
  const o = opt.o || shade(base, -58), s = opt.s || shade(base, -30), l = opt.l || shade(base, 28);
  const iw = w - Math.max(2, w * 0.18), ih = h - Math.max(2, h * 0.2);
  if (g.voxel) {
    g.fill(base); g.rect(x, y, w, h);
    g.fill(s); g.rect(x + iw, y, w - iw, h); g.rect(x, y + ih, w, h - ih);
    g.fill(l); g.rect(x, y, iw, Math.max(2, h * 0.22));
    return;
  }
  g.noStroke();
  g.fill(o); g.rect(x - 1, y - 1, w + 2, h + 2);
  g.fill(s); g.rect(x, y, w, h);
  g.fill(base); g.rect(x, y, iw, ih);
  g.fill(l); g.rect(x, y, iw, Math.max(2, h * 0.22));
}
