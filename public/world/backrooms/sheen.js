// The Backrooms — the ceiling tubes caught on a floor that shines (graphics.js `sheen`; the rules in sheen.rule.js). One
// per room that has such a floor (world.js): the room's tubes, chosen once when it is built, and the uniforms its shining
// floors share. Before each draw of one of them (the mesh's onBeforeRender: the scene's draw, and any other draw of it,
// such as the water's mirror, with that draw's camera) the nearest few tubes to the eye are moved into that camera's space
// at their level this frame (the room's own dimmer, flicker and banks), so a tube that fails takes its streak with it.
// Nothing is drawn, and nothing is made but a few small arrays. Plain arithmetic on the matrices' elements (a room is only
// ever moved and turned, never scaled), so this file needs no three.js of its own.
import { SHEEN, sheenLamps, pickSheen, sheenLevel, sheenLobe } from './sheen.rule.js';

/** a × b, 4 × 4, column-major (three.js Matrix4.elements) */
function mul(a, b, out) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}

/**
 * rt: the room (its lights, lighting and uniforms `u`). → null when the room has nothing that can shine on its floor;
 * else { lamps, uniforms (shared by its floors: flat Float32Arrays, as three.js takes them), material(s), frame }.
 * uSheenP / uSheenT / uSheenC: SHEEN.lamps × 4 numbers each (sheen.rule.js SHEEN_GLSL); uSheenUp: 3.
 */
export function createSheen(rt) {
  const lamps = sheenLamps(rt.lights, rt.lighting);
  if (!lamps.length) return null;
  const N = SHEEN.lamps, P = new Float32Array(N * 4), T = new Float32Array(N * 4), C = new Float32Array(N * 4), up = new Float32Array([0, 1, 0]);
  const E = new Float32Array(3);
  const uniforms = { uSheenP: { value: P }, uSheenT: { value: T }, uSheenC: { value: C }, uSheenUp: { value: up }, uSheenE: { value: E } };
  const mv = new Float64Array(16);
  /** Before a draw of a floor of this room: `this` is the mesh, as three.js calls it. */
  function frame(renderer, scene, camera) {
    const w = this.matrixWorld.elements, m = mul(camera.matrixWorldInverse.elements, w, mv), e = camera.matrixWorld.elements;
    // the eye in the room's frame: the turn's transpose of (eye - where the room is)
    const dx = e[12] - w[12], dy = e[13] - w[13], dz = e[14] - w[14];
    const ex = w[0] * dx + w[1] * dy + w[2] * dz, ey = w[4] * dx + w[5] * dy + w[6] * dz, ez = w[8] * dx + w[9] * dy + w[10] * dz;
    const ul = Math.hypot(m[4], m[5], m[6]) || 1;
    up[0] = m[4] / ul; up[1] = m[5] / ul; up[2] = m[6] / ul;
    // (the wax as a whole mirrors the room's ceiling: the mean of all its tubes' colours at their level this frame)
    E[0] = E[1] = E[2] = 0;
    for (const L of lamps) { const k = sheenLevel(L.group, rt.u) / lamps.length; E[0] += L.rgb[0] * k; E[1] += L.rgb[1] * k; E[2] += L.rgb[2] * k; }
    const picked = pickSheen(lamps, ex, ey, ez, N);
    for (let i = 0; i < N; i++) {
      const j = i * 4, p = picked[i];
      if (!p || p.w <= 0) { C[j] = C[j + 1] = C[j + 2] = 0; C[j + 3] = 1; continue; }
      const L = p.lamp, k = sheenLevel(L.group, rt.u) * p.w;
      P[j] = m[0] * L.x + m[4] * L.y + m[8] * L.z + m[12]; P[j + 1] = m[1] * L.x + m[5] * L.y + m[9] * L.z + m[13];
      P[j + 2] = m[2] * L.x + m[6] * L.y + m[10] * L.z + m[14]; P[j + 3] = L.group;
      const h = L.tube ? SHEEN.tube : 0;          // (half the tube, along the room's z)
      T[j] = m[8] * h; T[j + 1] = m[9] * h; T[j + 2] = m[10] * h; T[j + 3] = L.k;
      C[j] = L.rgb[0] * k; C[j + 1] = L.rgb[1] * k; C[j + 2] = L.rgb[2] * k; C[j + 3] = L.far2;
    }
  }
  return {
    lamps, uniforms, frame,
    /** The uniforms for one floor of shininess s (graphics.js sheenOf), or null when it does not shine. */
    material(s, blocky = SHEEN.blocky) {
      const lobe = sheenLobe(s);
      return lobe ? { uniforms: { ...uniforms, uSheenK: { value: new Float32Array([lobe.strength, lobe.rough, blocky ? 1 : 0, 0]) } } } : null;
    },
  };
}
