// The Backrooms — what the dummies are made of (cast/dummies.js): the shop's dummy, sculpted so that it can be stood as the visitor
// stood. Voxels only: no three.js here. Two poses (up, and crouched), each a head that faces the way it faces and nothing on it.
import { Vox, M } from '../../vox/vox.js';

export const S = 0.025;
const SKIN = '#d8cbb4', SEAM = '#b3a68e', CLOTH = ['#39424f', '#4a4038', '#2a2f36', '#5a4a3a'];

/** A dummy, as the visitor stood: up (mid-stride, arms down), or crouched (knees bent, one hand out to the floor). Nose to −z.
 *  Jointed fibreglass with a dark ring at every joint, in a jacket and trousers, on a chrome rod from a round foot; no face. */
export function dummyVox(crouch = false, n = 0) {
  return () => {
    const v = new Vox(), skin = M(SKIN, 0), shade = M('#c4b59c', 0), seam = M('#7d7262', 0), cloth = M(CLOTH[n % CLOTH.length], 2), dark = M('#1e2228', 2);
    const chrome = M('#b9bec4', 0), foot = M('#3a3d42', 0), shirt = M('#e9e4d6', 1);
    const limb = (x0, y0, z0, x1, y1, z1, r0, r1, m) => { const k = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0))); for (let i = 0; i <= k; i++) { const t = i / k, r = r0 + (r1 - r0) * t; v.ellipsoid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, r, r, r, m); } };
    const joint = (x, y, z, r) => { v.ellipsoid(x, y, z, r, r, r, skin); v.ring(x, y, z, r, 0.45, seam, 'y'); };
    v.cyl('y', 0, 0, 0, 1, 10, foot, 10); v.cyl('y', 0, 0, 1, 2, 9, chrome, 8); v.cyl('y', 0, 0, 2, crouch ? 8 : 14, 0.7, chrome);
    const hip = crouch ? 21 : 33, lift = hip - 33;
    for (const sx of [-1, 1]) {
      if (crouch) { const knee = [sx * 3.4, 15, -9], ankle = [sx * 3.2, 3, -4]; limb(sx * 3, hip, 0, ...knee, 2.9, 2.3, cloth); joint(...knee, 2.2); limb(...knee, ...ankle, 2.2, 1.7, cloth); v.rbox(ankle[0] - 1.8, 0, ankle[2] - 2.5, ankle[0] + 1.8, 3, ankle[2] + 4, 1, foot); }
      else { const dz = sx * 2.5; limb(sx * 3, hip, 0, sx * 3.1, 18, dz * 0.6, 2.9, 2.3, cloth); joint(sx * 3.1, 18, dz * 0.6, 2.2); limb(sx * 3.1, 18, dz * 0.6, sx * 3.1, 4, dz, 2.2, 1.7, cloth); v.rbox(sx * 3.1 - 1.8, 0, dz - 2.5, sx * 3.1 + 1.8, 3, dz + 4, 1, foot); }
    }
    const y = (k) => k + lift;
    v.ellipsoid(0, y(34), 0, 5.4, 4, 3.4, dark); limb(0, y(36), 0, 0, y(41), crouch ? -1 : 0, 4.2, 4.0, cloth); v.ellipsoid(0, y(46), crouch ? -2 : 0, 6.2, 6.4, 3.8, cloth);
    v.box(-1, y(41), 3, 1, y(52), 4, shirt); v.ellipsoid(0, y(51), crouch ? -2 : 0, 6.6, 2.6, 3.6, cloth);
    for (const sx of [-1, 1]) { const out = crouch && sx > 0, s0 = [sx * 6.6, y(50), crouch ? -2 : 0], e = [sx * 7.6, y(out ? 42 : 40), out ? -8 : 0], h = [sx * 7.8, out ? 4 : y(30), out ? -14 : 1];
      joint(...s0, 2.2); limb(...s0, ...e, 2.2, 1.8, cloth); v.ring(e[0], e[1], e[2], 1.8, 0.5, dark, 'y'); limb(...e, ...h, 1.4, 1.1, skin); v.ellipsoid(h[0], h[1] - 1, h[2], 1.3, 2.1, 1.0, skin); }
    const hz = crouch ? -3 : 0;
    v.cyl('y', 0, hz, y(52), y(56), 1.7, skin); v.ring(0, y(54), hz, 1.8, 0.4, seam, 'y');
    v.ellipsoid(0, y(61), hz, 4.1, 5.4, 4.6, skin); v.ellipsoid(0, y(62.5), hz - 3.3, 3.2, 1.0, 1.2, shade); v.box(0, y(59), hz - 5, 0, y(61), hz - 4, shade); v.ellipsoid(0, y(64.5), hz + 0.5, 4.2, 2.6, 4.4, skin);
    return v;
  };
}
