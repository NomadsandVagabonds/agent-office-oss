// The Backrooms — Borrowed Daylight ("the blind with no window behind it"). A preview (deck2.js `on: false`, the dev
// page's &preview=blinds; docs/BLOCKROOMS-PREVIEWS.md).
//
// An almost empty room. A varnished window frame on castered feet stands by itself toward one side, a crooked aluminium
// Venetian blind in it and its cord hanging; behind it is the same yellow wallpaper as everywhere. Late afternoon sun
// comes through it anyway, the wrong way, from where you came in: across the carpet in slats, and up the false wall
// opposite, except where that wall has a door-sized opening. The light goes on into the opening and picks out its far
// jamb: a recessed hall, one fitting in it and that one out, which turns along the outer wall to the way on. A paper
// cup lies on its side in the light, with a long ordinary shadow. Walk past the blind and round the jamb to leave.
//
// The light is drawn, not lit: rooms/blinds/sun.js cuts every surface the blind's opening can see into polygons once,
// at build, and a small shader over them works out, spot by spot, whether that spot's ray came through a gap between
// the slats as they are drawn here, or met a slat, a ladder tape or the cup; the edges soften with distance. It adds
// to what is under it in proportion to that surface's own colour (the blend is dst × (1 + sun)), so the carpet goes
// amber and the wallpaper gold, the same at every Graphics tier. Nothing about it moves and nothing of it is rolled
// but a few degrees of its heading, and where along it the cup lies.
import * as THREE from 'three';
import { Batch, lin } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { BLIND, SUN, HALL, TAPES, layout, slatsOf, pieces, lightAt, cupOf } from './blinds/sun.js';

const TILE = 0.6, SUN_LEVEL = 0.15, SHADE = 0.72;
const snap = (v, off = 0) => Math.round((v - off) / TILE) * TILE + off;

export function build(c) {
  const { W, D, H, params: p, room } = c;
  const door = room.doors.find((d) => d.side === 'right') || null;
  const L = layout(W, D, H, { side: 1, az: p.az }, door ? { c: door.c, w: door.w } : null), s = L.s;
  c.shell({ panels: false });

  // ---- the false wall and the recessed hall behind it: blocks of wall, papered and skirted like the shell's
  const block = (x0, x1, z0, z1, opt) => { if (Math.abs(x1 - x0) > 0.01 && z1 - z0 > 0.01) c.pillar((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), z1 - z0, opt); };
  block(L.xf, s * W / 2, -D / 2, L.zm0);                                        // beyond the mouth, toward the back: its jamb faces the light
  block(L.xf, L.xo, L.zm1, D / 2);                                              // between the room and the leg along the outer wall
  if (L.zd < D / 2 - 0.05) block(L.xo, s * W / 2, L.zd, D / 2);                 // past the doorway, the end of that leg
  block(L.xf, L.xf + s * HALL.lintel, L.zm0, L.zm1, { y0: HALL.head });         // over the mouth

  // ---- the light: one fitting lit in the room, on the ceiling's grid; one out, in the hall
  c.fitting(snap((-s * W / 2 + L.xf) / 2 + s * 0.6, 0.3), snap(-0.6), {});
  c.fitting(s * (W / 2 - HALL.wide / 2), (L.zm0 + Math.min(L.zd, D / 2)) / 2, { dead: true });

  // ---- the blind, in its own frame: across (u), out of its light side (n), up
  const { B, u, n } = L, up = [0, 1, 0];
  const at = (a, y, b) => [B[0] + u[0] * a + n[0] * b, y, B[2] + u[2] * a + n[2] * b];
  const wood = lin('#7a4a26'), woodDark = lin('#5e3619'), alu = lin('#d8d4c8'), aluDark = lin('#a9a69c'), rubber = lin('#26262a'), cord = lin('#e8e2d2');
  const f = c.flat;
  /** A box turned with the blind: centre (a, y, b) in its frame, half-sizes along its own three axes (each [a, y, b]). */
  const obox = (batch, ctr, ea, ey, eb, rgb) => {
    const C = at(ctr[0], ctr[1], ctr[2]), E = [ea, ey, eb].map((e) => [u[0] * e[0] + n[0] * e[2], e[1], u[2] * e[0] + n[2] * e[2]]);
    for (let i = 0; i < 3; i++) for (const sg of [1, -1]) {
      let P = E[(i + 1) % 3], Q = E[(i + 2) % 3];
      const N = E[i].map((v) => v * sg), cr = [P[1] * Q[2] - P[2] * Q[1], P[2] * Q[0] - P[0] * Q[2], P[0] * Q[1] - P[1] * Q[0]];
      if (cr[0] * N[0] + cr[1] * N[1] + cr[2] * N[2] < 0) [P, Q] = [Q, P];
      const F = [C[0] + N[0], C[1] + N[1], C[2] + N[2]], m = (k1, k2) => [F[0] + P[0] * k1 + Q[0] * k2, F[1] + P[1] * k1 + Q[1] * k2, F[2] + P[2] * k1 + Q[2] * k2];
      batch.quad(m(-1, -1), m(1, -1), m(1, 1), m(-1, 1), rgb);
    }
  };
  const A = BLIND.across / 2, po = BLIND.post / 2, rl = BLIND.rail, topY = BLIND.top + rl;
  for (const sx of [-1, 1]) {
    const a = sx * (A + po);
    obox(f, [a, (0.11 + topY) / 2, 0], [po, 0, 0], [0, (topY - 0.11) / 2, 0], [0, 0, po], wood);                       // the posts
    obox(f, [a, 0.085, 0], [0.035, 0, 0], [0, 0.03, 0], [0, 0, BLIND.foot / 2], woodDark);                                // the feet
    for (const b of [-1, 1]) obox(f, [a, 0.028, b * (BLIND.foot / 2 - 0.03)], [0.026, 0, 0], [0, 0.026, 0], [0, 0, 0.026], rubber);   // the casters
  }
  obox(f, [0, BLIND.top + rl / 2, 0], [A + 2 * po, 0, 0], [0, rl / 2, 0], [0, 0, po + 0.004], wood);                        // the head
  obox(f, [0, BLIND.sill - rl / 2, 0], [A, 0, 0], [0, rl / 2, 0], [0, 0, po], wood);                                         // the sill rail
  obox(f, [0, BLIND.y1 + 0.024, 0], [A - 0.01, 0, 0], [0, 0.024, 0], [0, 0, 0.028], alu);                                  // the blind's head rail
  const slats = slatsOf();
  for (const sl of slats) {
    // a slat: across the opening (drooping by sl.droop a metre), its width turned by its tilt about its long axis
    const ea = [A - 0.012, (A - 0.012) * sl.droop, 0];
    const ew = [0, Math.sin(sl.tilt) * BLIND.depth / 2, Math.cos(sl.tilt) * BLIND.depth / 2], et = [0, Math.cos(sl.tilt) * 0.0018, -Math.sin(sl.tilt) * 0.0018];
    obox(f, [0, sl.y, 0], ea, ew, et, alu);
  }
  { const bot = slats[0]; obox(f, [0, BLIND.y0 - 0.012, 0], [A - 0.012, (A - 0.012) * (bot.droop + 0.02), 0], [0, 0.012, 0], [0, 0, 0.026], aluDark); }   // the bottom bar, hanging crooked with them
  for (const tx of TAPES) for (const b of [-1, 1]) obox(f, [tx * A, (BLIND.y0 + BLIND.y1) / 2, b * 0.024], [0.006, 0, 0], [0, (BLIND.y1 - BLIND.y0) / 2, 0], [0, 0, 0.0012], cord);
  obox(f, [A - 0.06, (BLIND.y1 + 1.06) / 2, 0.034], [0.003, 0, 0], [0, (BLIND.y1 - 1.06) / 2, 0], [0, 0, 0.003], cord);   // the cord, and its pull
  obox(f, [A - 0.06, 1.03, 0.034], [0.009, 0, 0], [0, 0.03, 0], [0, 0, 0.009], cord);
  // solid all along it (in short boxes, it is turned), and its shadow on the carpet
  for (let k = -4; k <= 4; k++) {
    const P = at(k * (A + 2 * po) / 4, 0, 0), r = k === -4 || k === 4 ? 0.3 : 0.11;
    c.solid(P[0] - r, P[2] - r, P[0] + r, P[2] + r, { tall: false });
  }
  for (const sx of [-1, 1]) for (let k = -2; k <= 2; k++) { const P = at(sx * (A + po), 0, k * BLIND.foot / 5); c.shadow(P[0], P[2], 0.06, 0.06, 0.32); }
  c.reserve(B[0], B[2], 1.1);
  // the casters' tracks: it was wheeled here from the wall, two flattened lines in the carpet
  for (const sx of [-1, 1]) for (let k = 1; k <= 14; k++) {
    const P = at(sx * (A + po), 0, 0), q = [P[0] - s * 0.22 * k, P[2] + 0.05 * k];
    if (Math.abs(q[0]) < W / 2 - 0.3) c.blot(q[0], q[1], 0.2, 0.05, { a: 0.05 + 0.04 * (1 - k / 14), y: 0.004 });
  }

  // ---- the cup, lying on its side in the light: along the light's middle ray, in the first gap past `along`
  const mid = at(0, (BLIND.y0 + BLIND.y1) / 2, 0);
  const floorHit = (() => { const d = [mid[0] - L.S[0], mid[1] - L.S[1], mid[2] - L.S[2]], k = -L.S[1] / d[1]; return [L.S[0] + d[0] * k, L.S[2] + d[2] * k]; })();
  let cx = floorHit[0], cz = floorHit[1];
  {
    const a = [B[0] + n[0] * 1.2, B[2] + n[2] * 1.2], b = floorHit, from = 0.25 + 0.5 * (p.along ?? 0.5);
    for (let k = 0; k <= 60; k++) {
      const f2 = Math.min(0.98, from + k * 0.01), x = a[0] + (b[0] - a[0]) * f2, z = a[1] + (b[1] - a[1]) * f2;
      if (Math.abs(x - L.xf) > 0.6 && lightAt(L, [x, 0.02, z], slats) > 0.8 && lightAt(L, [x + 0.12, 0.02, z], slats) > 0.5) { cx = x; cz = z; break; }
    }
  }
  const cup = cupOf(+cx.toFixed(3), +cz.toFixed(3), p.cup ?? 0.8);
  c.place(c.kit.model('blinds-cup', cupVox), cup.x, cup.z, { rot: cup.rot, scale: 0.5, shadow: 0.3 });
  c.reserve(cup.x, cup.z, 0.3);

  // ---- wear: a faint stain or two in the carpet, one on the false wall low down
  c.blot(-s * (W / 2 - 1.2), D / 2 - 2.4, 0.9, 0.6, { a: 0.12, y: 0.004 });
  c.blot(L.xf - s * 1.6, -D / 2 + 1.1, 0.7, 0.5, { a: 0.1, y: 0.004 });

  // ---- and the sun on all of it
  const parts = pieces(L), pos = [];
  for (const pc of parts) for (let i = 1; i + 1 < pc.pts.length; i++) pos.push(...pc.pts[0], ...pc.pts[i], ...pc.pts[i + 1]);
  const geo = c.kit.own(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const mat = c.kit.own(new THREE.ShaderMaterial({
    uniforms: {
      uS: { value: v3(L.S) }, uB: { value: v3(L.B) }, uN: { value: v3(L.n) }, uU: { value: v3(L.u) },
      uBox: { value: new THREE.Vector4(BLIND.across / 2, BLIND.y0, BLIND.y1, BLIND.depth / 2) },
      uSlat: { value: slats.map((sl) => new THREE.Vector3(sl.y, sl.tilt, sl.droop)) },
      uTape: { value: new THREE.Vector2(TAPES[0], TAPES[1]) },
      uCupA: { value: v3(cup.a) }, uCupB: { value: v3(cup.b) }, uCupR: { value: new THREE.Vector2(cup.r0, cup.r1) },
      uSoft: { value: SUN.size / SUN.far }, uColor: { value: new THREE.Vector3(...SUN.color) }, uOn: { value: 1 },
    },
    vertexShader: SUN_VERT, fragmentShader: SUN_FRAG.replace(/SLATS/g, String(slats.length)),
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor,
  }));
  const sun = new THREE.Mesh(geo, mat);
  sun.renderOrder = 2; sun.userData.noReflect = true; sun.frustumCulled = false;
  c.add(sun);
  // a little of it thrown back up off the carpet: warm, low, no more than a bounce
  c.light(floorHit[0] * 0.7 + B[0] * 0.3, 0.35, floorHit[1] * 0.7 + B[2] * 0.3, [1.0, 0.62, 0.28], 0.22);
  // (the camcorder sees a room with the sun in it, not one lit by a single tube: it keeps its gain down, and the shade stays shade)
  // (and the shade a little deeper than a one-tube room's, so that the light is the brightest thing in it)
  c.rt.level = Math.max(c.rt.level, SUN_LEVEL);
  c.rt.amb = c.rt.amb.map((v) => v * SHADE);
  c.rt.blinds = { layout: L, pieces: parts, cup, slats, sun };          // (for the dev page and the tests)
}

/** A paper cup, lying on its side: half-size voxels, narrow end at −x, mouth at +x, a little rolled rim. */
function cupVox() {
  const v = new Vox(), paper = M('#efeae0', 0), shade = M('#d9d2c4', 0), rim = M('#f7f4ec', 0);
  v.cyl('x', 3, 0, -4, 4, 2.3, paper, 3.3);
  v.cyl('x', 3, 0, -1, 4, 1.4, 0, 2.4);                 // (hollow from the mouth in)
  v.paint(-4, 0, -4, -3, 7, 4, shade);                  // the base
  v.cyl('x', 3, 0, 3, 4, 3.4, rim, 3.4); v.cyl('x', 3, 0, 3, 4, 2.4, 0, 2.4);
  return v;
}

const SUN_VERT = /* glsl */ `
varying vec3 vP;
void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// (the same lines as sun.js lightAt and cupShade: what reaches a spot from the point behind the blind)
const SUN_FRAG = /* glsl */ `
uniform vec3 uS, uB, uN, uU, uColor, uCupA, uCupB;
uniform vec4 uBox;
uniform vec3 uSlat[SLATS];
uniform vec2 uTape, uCupR;
uniform float uSoft, uOn;
varying vec3 vP;
float ss(float a, float b, float x) { return smoothstep(a, b, x); }
void main() {
  vec3 r = vP - uS; float len = length(r); vec3 dir = r / len;
  float dn = dot(dir, uN); if (dn <= 0.0) discard;
  float k = dot(uB - uS, uN) / dn; vec3 A = uS + dir * k; float t = len - k; if (t <= 0.0) discard;
  float fx = dot(A - uB, uU), fy = A.y, soft = 0.002 + t * uSoft, hw = uBox.x;
  float lit = ss(-soft, soft, fx + hw) * ss(-soft, soft, hw - fx) * ss(-soft, soft, fy - uBox.y) * ss(-soft, soft, uBox.z - fy);
  float tau = dir.y / dn;
  for (int i = 0; i < SLATS; i++) {
    vec3 sl = uSlat[i]; float yc = sl.x + sl.z * fx, hh = uBox.w * abs(sin(sl.y) - cos(sl.y) * tau) + 0.0025;
    lit *= ss(hh - soft, hh + soft, abs(fy - yc));
  }
  lit *= 1.0 - 0.55 * (1.0 - ss(0.004 - soft, 0.004 + soft, abs(fx - uTape.x * hw)));
  lit *= 1.0 - 0.55 * (1.0 - ss(0.004 - soft, 0.004 + soft, abs(fx - uTape.y * hw)));
  float best = 1e9;
  for (int j = 0; j <= 6; j++) {
    float f = float(j) / 6.0; vec3 P = mix(uCupA, uCupB, f); float rr = mix(uCupR.x, uCupR.y, f);
    vec3 w = P - vP; float back = -dot(w, dir);
    if (back > 0.0) best = min(best, (length(w + dir * back) - rr) / (0.003 + back * uSoft));
  }
  lit *= ss(-1.0, 1.0, best);
  if (lit < 0.002) discard;
  gl_FragColor = vec4(uColor * lit * uOn, 1.0);
}`;
