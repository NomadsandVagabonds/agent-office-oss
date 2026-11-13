// The Office — Pix → Vox.
//
// Desk items and agent-authored creations are drawn with the 2D office's
// vocabulary (rect, ellipse, tri… see ../art/pix.js and core/creations.mjs).
// This turns such a drawing into a real voxel model, so a creation written
// years ago for the pixel office gets the same shading, shadows and glow as
// everything else in the 3D one.
import { Vox, C } from './vox.js';

/**
 * @param {import('../art/pix.js').Pix} pix
 * @param {{pivot?:{x:number,y:number}, tex?:number}} [opt]  pivot (drawing
 *        coordinates) becomes the model's origin; drawing-y is down, model-y is up.
 */
export function pixToVox(pix, opt = {}) {
  const px = opt.pivot?.x ?? 0, py = opt.pivot?.y ?? 0;
  const tex = opt.tex ?? 1;
  const v = new Vox();
  const thin = [];
  for (let j = 0; j < pix.h; j++) {
    for (let i = 0; i < pix.w; i++) {
      const cell = pix.cells[j * pix.w + i];
      if (!cell) continue;
      const x = pix.x0 + i - px, y = -(pix.y0 + j - py) - 1;
      for (const seg of cell) {
        const c = C((seg.r << 16) | (seg.g << 8) | seg.b, { tex });
        if (seg.z1 - seg.z0 < 0.5) { thin.push([x, y, seg, c]); continue; }
        const z0 = Math.round(seg.z0), z1 = Math.max(z0 + 1, Math.round(seg.z1));
        for (let z = z0; z < z1; z++) v.set(x, y, z, c);
      }
    }
  }
  // A thin repaint is a detail drawn ON something: recolour the surface it
  // sits on instead of adding a new layer.
  for (const [x, y, seg, c] of thin) {
    const z0 = Math.round(seg.z0), z1 = Math.round(seg.z1);
    if (v.has(x, y, z0 - 1) && !v.has(x, y, z0)) v.set(x, y, z0 - 1, c);
    else if (v.has(x, y, z1) && !v.has(x, y, z1 - 1)) v.set(x, y, z1, c);
    else v.set(x, y, z0, c);
  }
  return v;
}
