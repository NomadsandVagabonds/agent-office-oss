// The Backrooms — what the dummies are made of (cast/dummies.js): the shop's dummy, sculpted so that it can be stood as the visitor
// stood. Voxels only: no three.js here. Two poses (up, and crouched), each a head that faces the way it faces and nothing on it.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.025;
const SKIN = '#d8cbb4', SEAM = '#b3a68e', CLOTH = ['#39424f', '#4a4038', '#2a2f36', '#5a4a3a'];

/** A dummy, as the visitor stood: up (a stride, arms down, head turned a little), or crouched (knees bent, one hand out). Nose to −z. */
export function dummyVox(crouch = false, n = 0) {
  return () => {
    const v = new Vox(), skin = M(SKIN, 0), seam = M(SEAM, 0), cloth = M(CLOTH[n % CLOTH.length], 2), base = M('#8d949c', 0);
    v.cyl('y', 0, 0, 0, 1, 9, base); v.cyl('y', 0, 0, 1, crouch ? 22 : 34, 0.8, base);                                                  // the stand, up its back
    const hip = crouch ? 22 : 34, chest = hip + 20;
    if (crouch) { for (const sx of [-1, 1]) { v.tube(sx * 3, hip, 0, sx * 3.5, hip - 6, -10, 1.8, cloth); v.tube(sx * 3.5, hip - 6, -10, sx * 3.5, 2, -6, 1.5, skin); v.rbox(sx * 3.5 - 2, 0, -9, sx * 3.5 + 2, 2, -3, 1, skin); } }
    else { for (const [sx, dz] of [[-1, 4], [1, -5]]) { v.tube(sx * 3, hip, 0, sx * 3, 16, dz * 0.5, 1.8, cloth); v.tube(sx * 3, 16, dz * 0.5, sx * 3, 2, dz, 1.5, skin); v.rbox(sx * 3 - 2, 0, dz - 3, sx * 3 + 2, 2, dz + 3, 1, skin); } }   // mid-stride
    v.rbox(-5, hip, -3, 5, chest, 3, 2, cloth); v.box(-5, hip + 10, -3, 5, hip + 10, 3, seam);
    for (const sx of [-1, 1]) { const out = crouch && sx > 0; v.tube(sx * 5.5, chest - 2, 0, sx * 7, chest - 12, out ? -8 : 0, 1.5, cloth); v.tube(sx * 7, chest - 12, out ? -8 : 0, sx * 7, chest - (out ? 14 : 22), out ? -16 : 1, 1.3, skin); v.ellipsoid(sx * 7, chest - (out ? 14 : 23), out ? -17 : 1, 1.6, 2, 1.6, skin); }
    v.cyl('y', 0, 0, chest, chest + 3, 1.6, skin); v.ellipsoid(0, chest + 8, -1, 4.2, 5.2, 4.6, skin); v.box(-4, chest + 8, -6, 4, chest + 8, 4, seam);   // a head, with the join round it and nothing on it
    return v;
  };
}
