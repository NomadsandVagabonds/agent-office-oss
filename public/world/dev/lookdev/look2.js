// The look-dev lab, round two. The level is drawn as it now draws at a Graphics tier (High: its baked tube shadows and
// doorway light, the sculpted fittings, the grade, the haze, the tight bloom, the scene drawn twice the tape's size), and
// that is the baseline: "today" is the level's own picture through its own camcorder, untouched. Each feature below is
// switched on by itself on top of it (docs/BACKROOMS-LOOKDEV.md, "Round two"):
//
//   movers     the ceiling tubes' shadows of what moves (a figure, a dragged chair): small depth pictures of the movers
//              alone, from three points along each of the two tubes that light them most; the room's shader takes those
//              tubes' share off where the pictures say they are hidden (and the ambient that goes with it)
//   ao         ambient occlusion from the screen (horizon based, GTAO-style), at the size the scene is drawn under the
//              tape, from its depth alone; what is held in the hand is left out both ways
//   ssr        reflections from the screen on hard floors and glass: a ray marched through the depth picture
//   planar     the hard floor as a mirror: the room drawn once more, upside down, at half size, clipped at the floor
//   shafts     the air lit: a ray marched through each pixel's air, lit by the nearest tubes (out of the fittings' open
//              faces) and by the next room's lamps through a doorway's opening (only where the line passes through it)
//   bloom      a glow from what shines (the fittings' tubes and pans, signs, screens) and nothing else, in the tubes' own
//              colour, in place of the tier's bloom (which takes anything bright enough, the yellow walls included)
//   water      a pool's surface (water2.js): the room reflected in it, the floor under it through the water's colour,
//              a ripple stepped to the voxel grid, a line where it meets the walls, a wake behind somebody wading
//   materials  roughness and a highlight of the tubes (each a line, not a point) on lino, metal and glass only; the
//              reflections (ssr, planar) take their blur from it, and the bloom takes its brightest highlights
//
// Nothing here is the level's: the level is read, and drawn by the lab, never changed.
import * as THREE from 'three';
import { internalSize } from '../../backrooms/graphics.js';
import { HELD_DEPTH_SLIVER } from '../../backrooms/hand.js';
import { lightAt } from '../../backrooms/kit.js';
import { matOf } from './look.js';
import { MOVER_LAYER } from './movers.js';
import { buildWater2 } from './water2.js';

export const FEATURES2 = ['movers', 'ao', 'ssr', 'planar', 'shafts', 'bloom', 'water', 'materials'];
const MAX_LAMPS = 16, MV_TILE = 512, MV_N = 4, MAX_DOOR_LAMPS = 8;

/* ---- shared GLSL ------------------------------------------------------------------------- */
const LAMP_GLSL = `
// one lamp as kit.js bake() gathers it (its gather(), in GLSL): rgb at p facing n; L the way to it
vec3 r2Lamp(vec3 P, vec3 C, vec4 K, vec3 D, vec3 p, vec3 n, out vec3 L) {
  vec3 d = P - p; float d2 = dot(d, d) + 0.02; L = d * inversesqrt(d2);
  if (d2 > K.y) return vec3(0.0);
  float s = (dot(n, L) + K.z) / (1.0 + K.z);
  if (s <= 0.0) return vec3(0.0);
  s *= K.w + (1.0 - K.w) * max(0.0, -dot(L, D));
  float fade = 1.0 - d2 / K.y;
  return C * s * fade * fade / (1.0 + d2 / K.x);
}`;

/* ---- what the kit's shader gains (movers, materials) ---------------------------------------- */
const R2_HEAD = `
uniform mat4 uViewInv;
${LAMP_GLSL}
#ifdef R2_MOVERS
uniform sampler2D uMvDepth;
uniform mat4 uMvVP[${MV_N * 3}];
uniform vec3 uMvP[${MV_N}];
uniform vec3 uMvC[${MV_N}];
uniform vec4 uMvK[${MV_N}];
uniform vec3 uMvD[${MV_N}];
uniform int uMvN;
uniform vec3 uMvAmb;
uniform vec4 uMvRect;
uniform float uMvDebug;
float r2Vis(int j, vec3 wp) {
  vec4 sp = uMvVP[j] * vec4(wp, 1.0);
  if (sp.w <= 0.0) return 1.0;
  vec3 q = sp.xyz / sp.w;
  if (abs(q.x) > 0.995 || abs(q.y) > 0.995 || q.z > 1.0) return 1.0;
  vec2 uv = (q.xy * 0.5 + 0.5 + vec2(mod(float(j), 3.0), floor(float(j) / 3.0))) / vec2(3.0, ${MV_N}.0);
  float d = q.z * 0.5 + 0.5 - 0.0004;
  vec2 tx = 1.5 / vec2(${3 * MV_TILE}.0, ${MV_N * MV_TILE}.0);
  float v = step(d, texture2D(uMvDepth, uv + vec2(-0.5, -0.5) * tx).r) + step(d, texture2D(uMvDepth, uv + vec2(0.5, -0.5) * tx).r)
          + step(d, texture2D(uMvDepth, uv + vec2(-0.5, 0.5) * tx).r) + step(d, texture2D(uMvDepth, uv + vec2(0.5, 0.5) * tx).r);
  return v * 0.25;
}
// the movers' shadow: each of the (up to four) tubes that light them most loses its share here as far as its three points are
// hidden from this spot, and 60 % of the hidden tubes' part of the ambient goes with it (as the level's own bake does)
vec3 r2Movers(vec3 c, vec3 wp, vec3 n) {
  if (uMvDebug > 0.0 && uMvDebug < 1.5) return vec3(r2Vis(1, wp), r2Vis(4, wp), uMvN > 0 ? 0.5 : 0.0);
  if (uMvN == 0 || wp.x < uMvRect.x || wp.z < uMvRect.y || wp.x > uMvRect.z || wp.z > uMvRect.w) return c;
  vec3 lost = vec3(0.0), L;
  for (int i = 0; i < ${MV_N}; i++) {
    if (i >= uMvN) break;
    vec3 I = r2Lamp(uMvP[i], uMvC[i], uMvK[i], uMvD[i], wp, n, L);
    if (dot(I, vec3(1.0)) < 1e-5) continue;
    float v = (r2Vis(i * 3, wp) + r2Vis(i * 3 + 1, wp) + r2Vis(i * 3 + 2, wp)) / 3.0;
    lost += I * (1.0 - v);
  }
  if (uMvDebug > 1.5) return vec3(dot(lost, vec3(0.333)), dot(c, vec3(0.333)) * 0.5, dot(uMvAmb, vec3(.333)));
  // (no more than the lamps bring here: where the room's own baked shadow already hides a tube, it is not hidden twice)
  vec3 here = c / max(vAlb, vec3(0.02));
  float lamps = max(dot(here - uMvAmb, vec3(0.333)), 1e-3), ll = dot(lost, vec3(0.333));
  lost *= min(1.0, lamps / max(ll, 1e-5));
  float share = clamp(dot(lost, vec3(0.333)) / lamps, 0.0, 1.0);
  return max(c - vAlb * (lost + uMvAmb * 0.6 * share), c * 0.12);
}
#endif
#ifdef R2_SPEC
uniform vec3 uLampP[${MAX_LAMPS}];
uniform vec3 uLampC[${MAX_LAMPS}];
uniform vec4 uLampK[${MAX_LAMPS}];
uniform vec3 uLampD[${MAX_LAMPS}];
uniform vec3 uLampT[${MAX_LAMPS}];
uniform int uLampN;
uniform float uSpecFloor, uSpecGlass, uSpecMetal;
varying float vMat;
// a highlight of the room's tubes, each a line 0.9 m long (the point on it nearest the reflected ray, GGX, Schlick)
vec3 r2Spec(vec3 wp, vec3 n, vec3 alb, float rough, vec3 F0) {
  vec3 V = normalize(cameraPosition - wp), R = reflect(-V, n), sum = vec3(0.0), L;
  float a = rough * rough, nv = max(dot(n, V), 1e-3);
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (i >= uLampN) break;
    vec3 P = uLampP[i], T = uLampT[i];
    if (dot(T, T) > 1e-4) {
      // the point of the tube nearest the reflected ray
      vec3 a0 = P - T - wp, ab = 2.0 * T;
      float RdAB = dot(R, ab), t = (dot(R, a0) * RdAB - dot(a0, ab)) / max(dot(ab, ab) - RdAB * RdAB, 1e-4);
      P = P - T + ab * clamp(t, 0.0, 1.0);
    }
    vec3 I = r2Lamp(P, uLampC[i], uLampK[i], uLampD[i], wp, n, L);
    float nl = max(dot(n, L), 0.0);
    if (nl <= 0.0 || dot(I, vec3(1.0)) < 1e-5) continue;
    vec3 H = normalize(L + V); float nh = max(dot(n, H), 0.0);
    // the lamp has a size: a little more roughness the nearer it is (energy kept)
    float d = length(P - wp), aa = clamp(a + 0.04 / d, 0.0, 1.0);
    float k = nh * nh * (aa * aa - 1.0) + 1.0, D = aa * aa / (3.14159 * k * k);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    sum += I / max(nl, 0.05) * D * F * 0.25 / nv * nl * (a * a / (aa * aa) * 0.6 + 0.4);
  }
  return sum;
}
#endif
`;

function patchKit(frag, vert, defs) {
  let f = frag.replace('void main() {', R2_HEAD + '\nvoid main() {');
  const nline = '  vec3 normal = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);\n';
  if (!f.includes(nline)) throw new Error('[lab] the kit shader changed: no normal line (look2.js)');
  f = f.replace(nline, nline + `  vec3 r2wp = (uViewInv * vec4(vView, 1.0)).xyz; vec3 r2n = normalize(mat3(uViewInv) * normal);
#ifdef R2_MOVERS
  c = r2Movers(c, r2wp, r2n);
#endif
`);
  const end = '  gl_FragColor = vec4(c, uAlpha);';
  if (!f.includes(end)) throw new Error('[lab] the kit shader changed: no gl_FragColor line (look2.js)');
  f = f.replace(end, `#ifdef R2_SPEC
  {
    vec3 alb = vAlb;
#ifdef MAPPED
    alb *= t.rgb;
#endif
    float kind = float(R2_SPEC);
    if (kind == 2.0 && uSpecFloor > 0.0) c += r2Spec(r2wp, r2n, alb, 0.2, vec3(0.05)) * uSpecFloor;
    else if (kind == 7.0 && uSpecGlass > 0.0) c += r2Spec(r2wp, r2n, alb, 0.06, vec3(0.05)) * uSpecGlass;
    else if (vMat > 1.5 && uSpecMetal > 0.0) c += r2Spec(r2wp, r2n, alb, 0.32, alb * 0.9 + 0.05) * uSpecMetal;
  }
#endif
` + end);
  let v = vert;
  if (defs.R2_SPEC) v = v.replace('void main() {', `#ifdef R2_PERVERT\nattribute float aMat;\n#endif\nvarying float vMat;\nvoid main() {\n#ifdef R2_PERVERT\n  vMat = aMat;\n#else\n  vMat = 0.0;\n#endif`);
  return { frag: f, vert: v };
}

/* ---- the screen passes ------------------------------------------------------------------- */
const QUAD_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const VIEWPOS = `
uniform mat4 uInvProj, uProj;
vec3 viewAt(vec2 uv, float d) { vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
vec2 toUv(vec3 p) { vec4 c = uProj * vec4(p, 1.0); return c.xy / c.w * 0.5 + 0.5; }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

// horizon-based ambient occlusion (the GTAO integral), from the depth alone: four directions, eight steps each way
const AO_F = `
uniform sampler2D tDepth; uniform vec2 uSize; uniform float uRadius, uSliver, uProjScale;
varying vec2 vUv;
${VIEWPOS}
const float PI = 3.14159265;
void main() {
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999 || d < uSliver) { gl_FragColor = vec4(1.0); return; }
  vec2 px = 1.0 / uSize;
  vec3 P = viewAt(vUv, d);
  // the face's own normal: of each pair of neighbours, the one on the same face (the nearer in depth)
  vec3 r = viewAt(vUv + vec2(px.x, 0.0), texture2D(tDepth, vUv + vec2(px.x, 0.0)).x) - P;
  vec3 l = P - viewAt(vUv - vec2(px.x, 0.0), texture2D(tDepth, vUv - vec2(px.x, 0.0)).x);
  vec3 u = viewAt(vUv + vec2(0.0, px.y), texture2D(tDepth, vUv + vec2(0.0, px.y)).x) - P;
  vec3 b = P - viewAt(vUv - vec2(0.0, px.y), texture2D(tDepth, vUv - vec2(0.0, px.y)).x);
  vec3 N = normalize(cross(abs(r.z) < abs(l.z) ? r : l, abs(u.z) < abs(b.z) ? u : b));
  vec3 V = normalize(-P);
  if (dot(N, V) < 0.0) N = -N;
  float rpx = uRadius * uProjScale / -P.z;
  if (rpx < 2.0) { gl_FragColor = vec4(1.0); return; }
  rpx = min(rpx, 140.0);
  float a0 = ign(gl_FragCoord.xy) * PI / 4.0, jit = ign(gl_FragCoord.xy + vec2(13.0, 71.0));
  float vis = 0.0, R2 = uRadius * uRadius;
  for (int s = 0; s < 4; s++) {
    float a = a0 + PI * float(s) / 4.0;
    vec2 dir = vec2(cos(a), sin(a));
    vec3 dir3 = vec3(dir, 0.0);
    vec3 axis = normalize(cross(dir3, V)), ortho = dir3 - dot(dir3, V) * V;
    vec3 pn = N - axis * dot(N, axis); float pl = length(pn);
    float cn = clamp(dot(pn, V) / max(pl, 1e-4), 0.0, 1.0);
    float n = sign(dot(ortho, pn)) * acos(cn);
    float c0 = -1.0, c1 = -1.0;
    for (int i = 0; i < 8; i++) {
      float st = (float(i) + jit) / 8.0; st = st * st;
      vec2 off = dir * max(st * rpx, float(i) + 1.0) * px;
      for (int k = 0; k < 2; k++) {
        vec2 q = k == 0 ? vUv + off : vUv - off;
        if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) continue;
        float dq = texture2D(tDepth, q).x;
        if (dq < uSliver || dq >= 0.99999) continue;          // what is held, and the void, hide nothing
        vec3 S = viewAt(q, dq) - P; float L2 = dot(S, S);
        float cs = mix(-1.0, dot(S, V) * inversesqrt(L2 + 1e-6), clamp(1.0 - L2 / R2, 0.0, 1.0));
        if (k == 0) c1 = max(c1, cs); else c0 = max(c0, cs);
      }
    }
    float h0 = n + max(-acos(clamp(c0, -1.0, 1.0)) - n, -PI / 2.0), h1 = n + min(acos(clamp(c1, -1.0, 1.0)) - n, PI / 2.0);
    vis += pl * 0.25 * ((-cos(2.0 * h0 - n) + cn + 2.0 * h0 * sin(n)) + (-cos(2.0 * h1 - n) + cn + 2.0 * h1 * sin(n)));
  }
  gl_FragColor = vec4(vec3(clamp(vis / 4.0, 0.0, 1.0)), 1.0);
}`;
// 4 × 4, weighted by depth, so no face's darkening crosses onto another face
const AO_BLUR_F = `
uniform sampler2D tAO, tDepth; uniform vec2 uSize; uniform float uSliver;
varying vec2 vUv;
${VIEWPOS}
void main() {
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999 || d < uSliver) { gl_FragColor = vec4(1.0); return; }
  float z = viewAt(vUv, d).z, sum = 0.0, w = 0.0;
  for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
    vec2 q = vUv + (vec2(float(x), float(y)) + 0.5) / uSize;
    float dq = texture2D(tDepth, q).x;
    float wq = dq < uSliver ? 0.0 : 1.0 / (1.0 + abs(viewAt(q, dq).z - z) * 40.0 / max(-z * 0.05, 0.02));
    sum += texture2D(tAO, q).r * wq; w += wq;
  }
  gl_FragColor = vec4(vec3(w > 0.0 ? sum / w : 1.0), 1.0);
}`;

// reflections from the screen: hard floors (code 1) and glass (code 3) of the material picture
const SSR_F = `
uniform sampler2D tG, tGDepth, tDepth, tColor; uniform vec2 uSize; uniform float uSliver, uFloor, uGlass;
varying vec2 vUv;
${VIEWPOS}
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec4 g = texture2D(tG, vUv); float code = floor(g.a + 0.001), rough = fract(g.a + 0.001);
  float on = code == 1.0 ? uFloor : code == 3.0 ? uGlass : 0.0;
  if (on <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float d = texture2D(tGDepth, vUv).x;
  vec3 P = viewAt(vUv, d), N = normalize(g.xyz), V = normalize(P);
  vec3 Rr = reflect(V, N);
  vec3 jit = vec3(hash(gl_FragCoord.xy), hash(gl_FragCoord.yx + 7.0), hash(gl_FragCoord.xy * 1.7 + 3.0)) - 0.5;
  vec3 R = normalize(Rr + jit * rough * 0.25);
  if (dot(R, N) < 0.02) R = Rr;
  vec3 col = vec3(0.0); float got = 0.0;
  float t = 0.03 + 0.03 * hash(gl_FragCoord.xy + 11.0), tPrev = 0.0;
  vec3 O = P + N * 0.01;
  for (int i = 0; i < 56; i++) {
    vec3 Q = O + R * t; vec2 q = toUv(Q);
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 || Q.z > -0.06) break;
    float sd = texture2D(tDepth, q).x;
    if (sd >= uSliver) {
      float sz = sd >= 0.99999 ? -1e5 : viewAt(q, sd).z;
      float dz = sz - Q.z;
      if (dz > 0.0 && dz < 0.12 + t * 0.06) {
        // refine between the last step and this one
        float lo = tPrev, hi = t;
        for (int k = 0; k < 5; k++) { float m = 0.5 * (lo + hi); vec3 M = O + R * m; vec2 mq = toUv(M); float md = texture2D(tDepth, mq).x; if (viewAt(mq, md).z - M.z > 0.0) hi = m; else lo = m; }
        q = toUv(O + R * hi);
        vec2 e = smoothstep(0.0, 0.08, q) * smoothstep(0.0, 0.08, 1.0 - q);
        got = e.x * e.y * (1.0 - smoothstep(6.0, 11.0, hi));
        col = texture2D(tColor, q).rgb;
        break;
      }
    }
    tPrev = t; t = t * 1.085 + 0.025;
  }
  float nv = max(dot(-V, N), 0.0), F = 0.05 + 0.95 * pow(1.0 - nv, 5.0);
  gl_FragColor = vec4(col * got * F * on, got * F * on);
}`;

// the light of the air: a ray through each pixel's air, lit by the nearest tubes and by the lamps next door through a doorway
const SHAFT_F = `
uniform sampler2D tDepth; uniform vec2 uSize; uniform float uSliver, uDens, uTubeK, uDoorK, uFar;
uniform mat4 uViewInv;
uniform vec3 uLampP[${MAX_LAMPS}];
uniform vec3 uLampC[${MAX_LAMPS}];
uniform vec3 uLampT[${MAX_LAMPS}];
uniform int uLampN;
uniform vec3 uDoorO, uDoorU, uDoorV, uDoorN;
uniform vec3 uDLampP[${MAX_DOOR_LAMPS}];
uniform vec3 uDLampC[${MAX_DOOR_LAMPS}];
uniform vec3 uDLampT[${MAX_DOOR_LAMPS}];
uniform int uDLampN;
varying vec2 vUv;
${VIEWPOS}
// a tube in its fitting lights the air below it: only downward (the pan and the trim hide the rest), most straight
// down, falling off with distance; the air near a tube's own line is not lit brighter than the tube
vec3 tubeAir(int i, vec3 x) {
  vec3 P = uLampP[i], T = uLampT[i];
  vec3 a0 = x - (P - T), ab = 2.0 * T;
  float h = dot(T, T) > 1e-4 ? clamp(dot(a0, ab) / dot(ab, ab), 0.0, 1.0) : 0.5;
  vec3 d = (P - T + ab * h) - x; float d2 = dot(d, d) + 0.25;
  float down = d.y * inversesqrt(d2);
  float lobe = smoothstep(0.2, 0.75, down);
  return uLampC[i] * lobe * down / (d2 * (1.0 + d2 * 0.08));
}
vec3 doorAir(vec3 x) {
  if (dot(x - uDoorO, uDoorN) < 0.02) return vec3(0.0);
  vec3 got = vec3(0.0);
  float uw = dot(uDoorU, uDoorU), vh = dot(uDoorV, uDoorV);
  for (int i = 0; i < ${MAX_DOOR_LAMPS}; i++) {
    if (i >= uDLampN) break;
    float vis = 0.0;
    for (int k = -1; k <= 1; k++) {
      vec3 q = uDLampP[i] + uDLampT[i] * float(k), dd = q - x;
      float den = dot(dd, uDoorN); if (abs(den) < 1e-5) continue;
      float t = dot(uDoorO - x, uDoorN) / den; if (t <= 0.0 || t >= 1.0) continue;
      vec3 y = x + dd * t - uDoorO; float u = dot(y, uDoorU) / uw, v = dot(y, uDoorV) / vh;
      if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) continue;
      vis += 1.0 / 3.0;
    }
    if (vis <= 0.0) continue;
    vec3 d = uDLampP[i] - x; float d2 = dot(d, d) + 0.3;
    got += uDLampC[i] * vis / (d2 * (1.0 + d2 * 0.05));
  }
  return got;
}
void main() {
  float d = texture2D(tDepth, vUv).x;
  vec3 P = d < uSliver ? viewAt(vUv, 0.999) : viewAt(vUv, min(d, 0.999999));
  float len = min(length(P), uFar);
  vec3 dir = normalize(P);
  vec3 o = (uViewInv * vec4(0.0, 0.0, 0.0, 1.0)).xyz, wd = normalize(mat3(uViewInv) * dir);
  float j = ign(gl_FragCoord.xy), dt = len / 28.0;
  vec3 sum = vec3(0.0);
  for (int s = 0; s < 28; s++) {
    vec3 x = o + wd * (float(s) + j) * dt;
    vec3 L = vec3(0.0);
    for (int i = 0; i < 8; i++) { if (i >= uLampN) break; L += tubeAir(i, x) * uTubeK; }
    if (uDLampN > 0) L += doorAir(x) * uDoorK;
    sum += L * dt;
  }
  gl_FragColor = vec4(sum * uDens, 1.0);
}`;
const BLUR4_F = `uniform sampler2D tSrc; uniform vec2 uStep; varying vec2 vUv;
void main() { gl_FragColor = 0.25 * (texture2D(tSrc, vUv + vec2(uStep.x, uStep.y)) + texture2D(tSrc, vUv + vec2(-uStep.x, uStep.y)) + texture2D(tSrc, vUv + vec2(uStep.x, -uStep.y)) + texture2D(tSrc, vUv + vec2(-uStep.x, -uStep.y))); }`;
// bloom: what shines (the emissive picture) and only the brightest of the rest (the highlights), down and up a chain
const BRIGHT_F = `uniform sampler2D tEmit, tColor; uniform float uKnee, uFrom; varying vec2 vUv;
void main() {
  vec3 e = texture2D(tEmit, vUv).rgb, c = texture2D(tColor, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = clamp((l - uFrom) / uKnee, 0.0, 1.0);
  gl_FragColor = vec4(e + c * k * k * (uFrom > 50.0 ? 0.0 : 1.0), 1.0);
}`;
const DOWN_F = `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() { vec2 h = uTexel;
  vec4 s = texture2D(tSrc, vUv) * 4.0 + texture2D(tSrc, vUv + vec2(-h.x, -h.y)) + texture2D(tSrc, vUv + vec2(h.x, -h.y)) + texture2D(tSrc, vUv + vec2(-h.x, h.y)) + texture2D(tSrc, vUv + vec2(h.x, h.y));
  gl_FragColor = s / 8.0; }`;
const UP_F = `uniform sampler2D tSrc, tBase; uniform vec2 uTexel; uniform float uMix; varying vec2 vUv;
void main() { vec2 h = uTexel;
  vec4 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)) + texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)) + texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)) + texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0))
         + (texture2D(tSrc, vUv + vec2(-h.x, -h.y)) + texture2D(tSrc, vUv + vec2(h.x, -h.y)) + texture2D(tSrc, vUv + vec2(-h.x, h.y)) + texture2D(tSrc, vUv + vec2(h.x, h.y))) * 2.0;
  gl_FragColor = texture2D(tBase, vUv) + s / 12.0 * uMix; }`;

// the picture as it goes to the camcorder: the scene and what the passes made of it; the depth stays the scene's (the haze reads it)
const COMPOSE_F = `
uniform sampler2D tColor, tDepth, tAO, tSSR, tPlanar, tG, tShaft, tBloom, tWater;
uniform vec2 uSize; uniform float uAO, uSSR, uPlanar, uShaft, uBloom, uWater, uSliver, uPlaneY, uRoughK;
uniform vec3 uBloomTint;
uniform mat4 uViewInv, uMirrorVP;
varying vec2 vUv;
${VIEWPOS}
void main() {
  float d = texture2D(tDepth, vUv).x;
  vec3 c = texture2D(tColor, vUv).rgb;
  if (uAO > 0.0) c *= mix(1.0, texture2D(tAO, vUv).r, uAO);
  if (uSSR > 0.0 || uPlanar > 0.0) {
    vec4 g = texture2D(tG, vUv); float code = floor(g.a + 0.001), rough = fract(g.a + 0.001) * uRoughK;
    if (uSSR > 0.0) {
      // (the reflection picture is half size; its blur widens with roughness)
      vec2 s = (1.0 + rough * 10.0) / uSize;
      vec4 r = texture2D(tSSR, vUv) * 0.4 + 0.15 * (texture2D(tSSR, vUv + vec2(s.x, 0.0)) + texture2D(tSSR, vUv - vec2(s.x, 0.0)) + texture2D(tSSR, vUv + vec2(0.0, s.y)) + texture2D(tSSR, vUv - vec2(0.0, s.y)));
      c += r.rgb * uSSR * step(0.5, code) * step(code, 3.5);
    }
    if (uPlanar > 0.0 && code == 1.0 && d < 0.99999) {
      vec3 wp = (uViewInv * vec4(viewAt(vUv, d), 1.0)).xyz, wn = normalize(mat3(uViewInv) * g.xyz);
      if (wn.y > 0.9 && abs(wp.y - uPlaneY) < 0.03) {
        vec4 m = uMirrorVP * vec4(wp, 1.0); vec2 q = m.xy / m.w * 0.5 + 0.5;
        vec2 s = (0.6 + rough * 14.0) / uSize;
        vec3 r = texture2D(tPlanar, q).rgb * 0.36;
        r += 0.16 * (texture2D(tPlanar, q + vec2(s.x, s.y)).rgb + texture2D(tPlanar, q + vec2(-s.x, s.y)).rgb + texture2D(tPlanar, q + vec2(s.x, -s.y)).rgb + texture2D(tPlanar, q + vec2(-s.x, -s.y)).rgb);
        vec3 V = normalize((uViewInv * vec4(0.0, 0.0, 0.0, 1.0)).xyz - wp);
        float F = 0.05 + 0.95 * pow(1.0 - max(V.y, 0.0), 5.0);
        c += r * F * uPlanar;
      }
    }
  }
  if (uWater > 0.0) { vec4 w = texture2D(tWater, vUv); c = mix(c, w.rgb, w.a); }
  if (uShaft > 0.0) c += texture2D(tShaft, vUv).rgb * uShaft;
  if (uBloom > 0.0) c += texture2D(tBloom, vUv).rgb * uBloomTint * uBloom;
  gl_FragColor = vec4(c, 1.0);
  gl_FragDepth = d;
}`;

/* ---- the lab's round-two look ------------------------------------------------------------- */
export async function createLook2(o) {
  const { renderer, root, camera, world, rt, def, kit, spec, vhs, size, tier, vhsLevel } = o;
  const U = {
    uViewInv: { value: camera.matrixWorld },
    uLampP: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampC: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampK: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4(1, 1, 0, 1)) },
    uLampD: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampT: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampN: { value: 0 },
    uSpecFloor: { value: 1 }, uSpecGlass: { value: 1 }, uSpecMetal: { value: 1 },
    uMvDepth: { value: null }, uMvVP: { value: Array.from({ length: MV_N * 3 }, () => new THREE.Matrix4()) },
    uMvP: { value: Array.from({ length: MV_N }, () => new THREE.Vector3()) }, uMvC: { value: Array.from({ length: MV_N }, () => new THREE.Vector3()) },
    uMvK: { value: Array.from({ length: MV_N }, () => new THREE.Vector4(1, 1, 0, 1)) }, uMvD: { value: Array.from({ length: MV_N }, () => new THREE.Vector3()) },
    uMvN: { value: 0 }, uMvDebug: { value: 0 }, uMvAmb: { value: new THREE.Vector3() }, uMvRect: { value: new THREE.Vector4() },
    // (the doorway: the names rooms.js setupDoor fills in)
    uDoorO: { value: new THREE.Vector3() }, uDoorU: { value: new THREE.Vector3() }, uDoorV: { value: new THREE.Vector3() }, uDoorN: { value: new THREE.Vector3() },
    uDLampP: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector3()) },
    uDLampC: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector3()) },
    uDLampK: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector4(1, 1, 0, 1)) },
    uDLampT: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector3()) },
    uDLampN: { value: 0 }, uFigC: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uFigE: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uFigN: { value: 0 }, uFigRect: { value: new THREE.Vector4() },
  };
  const lab = { U, rt, kit, root, world, occluders: [], baked: { stats: null }, extras: [], movers: [], blots: [], door: null, water: null, held: null, stats: {} };

  /* -- every mesh of the building, and what it is -- */
  const kinds = new Map();
  for (const r of world.rooms) {
    const lk = r.def.look; if (!lk) continue;
    kinds.set(kit.tex.floor(lk), lk.floor === 'lino' || lk.floor === 'terrazzo' || lk.floor === 'screed' || spec.hardFloor ? 2 : 1);
  }
  const white = kit.tex.white();
  const meshes = [];
  const collect = () => {
    const have = new Set(meshes.map((x) => x.mesh));
    root.traverse((m) => {
      if (!(m.isMesh || m.isPoints || m.isLine || m.isSprite) || have.has(m)) return;
      const mat = m.material;
      const isKit = !!(mat?.isShaderMaterial && mat.fragmentShader?.includes('flashlightBeam(vView'));
      let kind = 0;
      if (isKit) {
        const map = mat.uniforms.map?.value, vox = !!mat.defines.VOXEL;
        if (vox) kind = mat.uniforms.uAlpha.value < 1 ? 7 : 6;
        else if (map === white) kind = 5;
        else if (kinds.has(map)) kind = kinds.get(map);
        if ((kind === 5 || kind === 6) && !m.geometry.attributes.aMat && m.geometry.attributes.aAlb) {
          const a = m.geometry.attributes.aAlb, n = a.count, out = new Float32Array(n), sf = m.geometry.attributes.aSurf;
          for (let i = 0; i < n; i++) out[i] = sf && sf.getY(i) > 0.5 ? 0 : kind === 5 ? (matOf(a.getX(i), a.getY(i), a.getZ(i)) === 2 ? 2 : 0) : matOf(a.getX(i), a.getY(i), a.getZ(i));
          m.geometry.setAttribute('aMat', new THREE.BufferAttribute(out, 1));
        }
      }
      let room = null; for (let p = m; p && !room; p = p.parent) room = world.rooms.find((r) => r.group === p) || null;
      const held = !!m.userData.held || m.renderOrder >= 10000;
      meshes.push({ mesh: m, today: mat, isKit, kind, room, held, mover: m.layers.isEnabled(MOVER_LAYER), cache: new Map() });
    });
  };

  /* -- the lamps: the strongest that reach what the camera sees, in the world, at their bank's level -- */
  const allLamps = [];
  for (const r of world.rooms) {
    r.group.updateMatrixWorld(true);
    for (const L of r.lights) {
      const p = new THREE.Vector3(L.x, L.y, L.z).applyMatrix4(r.group.matrixWorld);
      const ax = new THREE.Vector3(L.ax, L.ay, L.az).transformDirection(r.group.matrixWorld);
      const tube = L.lobe && L.ay < -0.9 ? new THREE.Vector3(0, 0, 0.5).transformDirection(r.group.matrixWorld).multiplyScalar(0.45) : new THREE.Vector3();
      allLamps.push({ L, room: r, p, ax: L.lobe ? ax : new THREE.Vector3(), tube });
    }
  }
  const levelOf = (l) => {
    const r = l.room, L = l.L;
    let k = r.u.dim.value * (L.flick ? r.u.flick.value : 1);
    if (r.lighting && Number.isInteger(L.bank)) { const b = L.bank; k *= b === 0 ? r.u.banks.value[0] : b === 1 ? r.u.banks.value[1] : b === 2 ? r.u.moreBanks.value[0] : r.u.moreBanks.value[1]; }
    return k;
  };
  const camPos = new THREE.Vector3();
  function pickLamps() {
    camPos.copy(camera.position);
    const vis = new Set(world.rooms.filter((r) => r.group.visible));
    const list = allLamps.filter((l) => vis.has(l.room)).map((l) => ({ l, w: (l.L.r + l.L.g + l.L.b) * levelOf(l) / (1 + l.p.distanceToSquared(camPos) * 0.08) }))
      .filter((x) => x.w > 1e-4).sort((a, b) => b.w - a.w).slice(0, MAX_LAMPS);
    U.uLampN.value = list.length;
    list.forEach(({ l }, i) => {
      const k = levelOf(l);
      U.uLampP.value[i].copy(l.p); U.uLampC.value[i].set(l.L.r * k, l.L.g * k, l.L.b * k);
      U.uLampK.value[i].set(l.L.k, l.L.far2, l.L.wrap, l.L.lobe ? l.L.floor : 1);
      U.uLampD.value[i].copy(l.ax); U.uLampT.value[i].copy(l.tube);
    });
    // (the shafts take the ceiling tubes of the room the camera is in: the first eight by the same order)
    const tubes = list.filter(({ l }) => l.tube.lengthSq() > 0 && l.room === rt).slice(0, 8);      // (the air of this room only: walls are not in the march)
    shaftU.uLampN.value = tubes.length;
    tubes.forEach(({ l }, i) => { const k = levelOf(l); shaftU.uLampP.value[i].copy(l.p); shaftU.uLampC.value[i].set(l.L.r * k, l.L.g * k, l.L.b * k); shaftU.uLampT.value[i].copy(l.tube); });
  }

  /* -- the movers' shadows: up to four tubes, three points each, a 512² depth picture of the movers alone from each -- */
  const mvRT = new THREE.WebGLRenderTarget(3 * MV_TILE, MV_N * MV_TILE, { depthBuffer: true });
  mvRT.depthTexture = new THREE.DepthTexture(3 * MV_TILE, MV_N * MV_TILE); mvRT.depthTexture.type = THREE.UnsignedIntType;
  U.uMvDepth.value = mvRT.depthTexture;
  const mvCams = Array.from({ length: MV_N * 3 }, () => { const c = new THREE.PerspectiveCamera(130, 1, 0.05, 6); c.layers.set(MOVER_LAYER); return c; });
  const depthMat = new THREE.MeshDepthMaterial();
  function moverShadows() {
    const movers = lab.movers.filter((m) => m.group.visible);
    if (!movers.length) { U.uMvN.value = 0; return; }
    // where they are, and how far their shadow can reach
    const box = new THREE.Box3(); for (const m of movers) box.expandByObject(m.group);
    const c = box.getCenter(new THREE.Vector3());
    // the tubes that light them most (spec.moverTubes, default 4), from the lamps of the room they are in
    const ranked = allLamps.filter((l) => l.room === rt && l.tube.lengthSq() > 0).map((l) => {
      const v = lightAt([l.L], [0, 0, 0], ...new THREE.Vector3().copy(c).applyMatrix4(new THREE.Matrix4().copy(rt.group.matrixWorld).invert()).toArray());
      return { l, w: (v[0] + v[1] + v[2]) * levelOf(l) };
    }).filter((x) => x.w > 1e-4).sort((a, b) => b.w - a.w).slice(0, Math.min(MV_N, spec.moverTubes ?? MV_N));
    U.uMvN.value = ranked.length;
    ranked.forEach(({ l }, i) => {
      const k = levelOf(l);
      U.uMvP.value[i].copy(l.p); U.uMvC.value[i].set(l.L.r * k, l.L.g * k, l.L.b * k);
      U.uMvK.value[i].set(l.L.k, l.L.far2, l.L.wrap, l.L.floor); U.uMvD.value[i].copy(l.ax);
      for (let j = 0; j < 3; j++) {
        const cam = mvCams[i * 3 + j];
        cam.position.copy(l.p).addScaledVector(l.tube, j - 1); cam.position.y -= 0.03;
        cam.up.copy(l.tube).normalize(); cam.lookAt(cam.position.x, cam.position.y - 1, cam.position.z); cam.updateMatrixWorld(true);
        U.uMvVP.value[i * 3 + j].multiplyScalar(0).multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      }
    });
    lab.stats.moverTubes = ranked.map((x) => x.l.p.toArray().map((v) => +v.toFixed(2)));
    // the ambient as the kit has it, in the room's units (bank rooms: most of it belongs to the banks)
    const a = rt.amb, sh = rt.lighting ? rt.lighting.ambientShare : 0, b = rt.u.banks.value;
    U.uMvAmb.value.set(a[0], a[1], a[2]).multiplyScalar(rt.u.dim.value * ((1 - sh) + sh * (b[0] + b[1]) / 2));
    U.uMvRect.value.set(c.x - 4, c.z - 4, c.x + 4, c.z + 4);
    const was = root.overrideMaterial, bg = root.background;
    root.overrideMaterial = depthMat; root.background = null;
    renderer.setRenderTarget(mvRT); renderer.setClearColor(0x000000, 1); renderer.clear();
    for (let j = 0; j < ranked.length * 3; j++) {
      const x = (j % 3) * MV_TILE, y = Math.floor(j / 3) * MV_TILE;
      mvRT.viewport.set(x, y, MV_TILE, MV_TILE); mvRT.scissor.set(x, y, MV_TILE, MV_TILE); mvRT.scissorTest = true;
      renderer.setRenderTarget(mvRT); renderer.render(root, mvCams[j]);
    }
    mvRT.viewport.set(0, 0, 3 * MV_TILE, MV_N * MV_TILE); mvRT.scissorTest = false;
    renderer.setRenderTarget(null);
    root.overrideMaterial = was; root.background = bg;
  }

  /* -- the kit's material with the round's terms (movers, materials) for one mesh -- */
  function proposed(x, f) {
    const defines = { ...x.today.defines };
    if (f.has('movers') && x.room === rt && !x.mover && !x.held) defines.R2_MOVERS = 1;
    if (f.has('materials') && (x.kind === 2 || x.kind === 7 || x.kind === 5 || x.kind === 6) && !x.held) { defines.R2_SPEC = x.kind; if (x.kind === 5 || x.kind === 6) defines.R2_PERVERT = 1; }
    if (!defines.R2_MOVERS && !defines.R2_SPEC) return x.today;
    const key = JSON.stringify(defines);
    if (x.cache.has(key)) return x.cache.get(key);
    const { frag, vert } = patchKit(x.today.fragmentShader, x.today.vertexShader, defines);
    const m = new THREE.ShaderMaterial({ defines, uniforms: { ...x.today.uniforms, ...U }, vertexShader: vert, fragmentShader: frag, side: x.today.side, transparent: x.today.transparent, depthWrite: x.today.depthWrite });
    x.cache.set(key, m);
    return m;
  }

  /* -- the material picture (normals and what is shiny) and the emissive picture: a material per mesh per pass -- */
  const G_V = `
#ifdef HAS_MAT
attribute float aMat;
#endif
varying vec3 vN; varying float vM; varying vec2 vUv;
void main() {
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  vec4 mv = modelViewMatrix * p; gl_Position = projectionMatrix * mv;
#ifdef HAS_NORMAL
  vN = normalMatrix * normal;
#else
  vN = vec3(0.0, 0.0, 1.0);
#endif
#ifdef HAS_MAT
  vM = aMat;
#else
  vM = 0.0;
#endif
  vUv = uv;
}`;
  const G_F = `
uniform float uCode;
#ifdef CUTOUT
uniform sampler2D map;
#endif
varying vec3 vN; varying float vM; varying vec2 vUv;
void main() {
#ifdef CUTOUT
  if (texture2D(map, vUv).a < 0.5) discard;
#endif
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  float code = uCode;
  if (code == 0.0 && vM > 1.5) code = 2.3;              // metal: rough 0.3
  gl_FragColor = vec4(n, code);
}`;
  const E_V = `
attribute vec3 aLit;
#ifdef VOXEL
attribute vec2 aSurf;
#endif
uniform float uDim;
varying vec3 vE;
void main() {
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
  vE = vec3(0.0);
#ifdef VOXEL
  vE = aLit * aSurf.y * uDim;
#endif
}`;
  const gCode = (x) => (x.held ? 4 : x.kind === 2 ? 1.18 : x.kind === 7 ? 3.04 : !x.isKit && x.today?.isMeshBasicMaterial ? 5 : 0);
  function passMaterial(x, pass) {
    const key = pass;
    if (x.cache.has(key)) return x.cache.get(key);
    const geo = x.mesh.geometry, t = x.today;
    let m = null;
    if (pass === 'g') {
      const defines = {};
      if (geo.attributes.normal) defines.HAS_NORMAL = 1;
      if (geo.attributes.aMat) defines.HAS_MAT = 1;
      if (x.isKit && t.defines.CUTOUT) defines.CUTOUT = 1;
      m = new THREE.ShaderMaterial({ defines, vertexShader: G_V, fragmentShader: G_F, side: t.side ?? THREE.FrontSide,
        uniforms: { uCode: { value: gCode(x) }, map: { value: x.isKit ? t.uniforms.map?.value : null } } });
    } else if (pass === 'e') {
      if (x.isKit) {
        const defines = {}; if (t.defines.VOXEL && geo.attributes.aSurf) defines.VOXEL = 1;
        m = new THREE.ShaderMaterial({ defines, vertexShader: E_V, fragmentShader: 'varying vec3 vE; void main(){ gl_FragColor = vec4(vE, 1.0); }', side: t.side, uniforms: { uDim: t.uniforms.uDim } });
      } else if (t?.isMeshBasicMaterial) m = t;
      else m = new THREE.MeshBasicMaterial({ color: 0x000000, side: t?.side ?? THREE.FrontSide });
    }
    x.cache.set(key, m);
    return m;
  }
  // draw the building once in a pass of its own: what writes no depth is left out (but glass goes into the material
  // picture, and what is held is drawn as it is, in front)
  function drawPass(pass, target, hideExtra = []) {
    const saved = [];
    for (const x of meshes) {
      const m = x.mesh, mat = x.today;
      saved.push([m, m.material, m.visible]);
      if (!m.visible) continue;
      if (!m.isMesh) { m.visible = false; continue; }
      const glass = x.kind === 7;
      if (mat && mat.depthWrite === false && !(pass === 'g' && glass) && !x.held) { m.visible = false; continue; }
      if (pass === 'e' && glass) { m.visible = false; continue; }
      m.material = passMaterial(x, pass);
    }
    for (const h of hideExtra) h.visible = false;
    const bg = root.background; root.background = null;
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(root, camera);
    root.background = bg;
    for (const [m, mat, vis] of saved) { m.material = mat; m.visible = vis; }
    for (const h of hideExtra) h.visible = true;
  }

  /* -- the targets, at the size the scene is drawn under the tape -- */
  const prof = vhs.profile;
  const mk = (o2 = {}) => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, ...o2 });
  const S = mk({ samples: prof.msaa || 4 }); S.depthTexture = new THREE.DepthTexture(4, 4);
  const G = mk(); G.depthTexture = new THREE.DepthTexture(4, 4);
  const AO = mk(), AO2 = mk(), SSR = mk(), PL = mk({ samples: 4 }), SH = mk(), SH2 = mk(), EM = mk(), WA = mk();
  WA.depthTexture = null;
  const BL = Array.from({ length: 6 }, () => mk()), BU = Array.from({ length: 6 }, () => mk());
  let W = 4, H = 4;
  function sizeAll() {
    const ratio = renderer.getPixelRatio();
    const s = internalSize(size.w, size.h, ratio, vhsLevel, prof);
    const w = s.sw, h = s.sh;
    if (w === W && h === H) return;
    W = w; H = h;
    for (const t of [S, G, AO, AO2]) t.setSize(w, h);
    for (const t of [SSR, PL, SH, SH2, EM]) t.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    WA.setSize(w, h);
    let bw = Math.ceil(w / 2), bh = Math.ceil(h / 2);
    for (let i = 0; i < BL.length; i++) { bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2)); BL[i].setSize(bw, bh); BU[i].setSize(bw, bh); }
    for (const t of [S, G]) if (t.depthTexture) Object.assign(t.depthTexture.image, { width: w, height: h });
    lab.stats.scene = `${w}×${h}`;
  }
  const quadScene = new THREE.Scene(), quadCam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
  const pass = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra });
  const view = { uInvProj: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() } };
  const sliver = { value: HELD_DEPTH_SLIVER * 0.999 };
  const aoMat = pass(AO_F, { ...view, tDepth: { value: S.depthTexture }, uSize: { value: new THREE.Vector2() }, uRadius: { value: spec.aoRadius ?? 0.42 }, uSliver: sliver, uProjScale: { value: 1 } });
  const aoBlur = pass(AO_BLUR_F, { ...view, tAO: { value: AO.texture }, tDepth: { value: S.depthTexture }, uSize: aoMat.uniforms.uSize, uSliver: sliver });
  const ssrMat = pass(SSR_F, { ...view, tG: { value: G.texture }, tGDepth: { value: G.depthTexture }, tDepth: { value: S.depthTexture }, tColor: { value: S.texture }, uSize: { value: new THREE.Vector2() }, uSliver: sliver, uFloor: { value: 1 }, uGlass: { value: 1 } });
  const shaftU = {
    ...view, tDepth: { value: S.depthTexture }, uSize: { value: new THREE.Vector2() }, uSliver: sliver, uDens: { value: spec.shaftDens ?? 0.02 }, uTubeK: { value: spec.tubeAirK ?? 0.4 }, uDoorK: { value: spec.doorAirK ?? 3 }, uFar: { value: 16 },
    uViewInv: U.uViewInv, uLampP: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) }, uLampC: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) }, uLampT: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) }, uLampN: { value: 0 },
    uDoorO: U.uDoorO, uDoorU: U.uDoorU, uDoorV: U.uDoorV, uDoorN: U.uDoorN, uDLampP: U.uDLampP, uDLampC: U.uDLampC, uDLampT: U.uDLampT, uDLampN: U.uDLampN,
  };
  const shaftMat = pass(SHAFT_F, shaftU);
  const blur4 = pass(BLUR4_F, { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } });
  const brightMat = pass(BRIGHT_F, { tEmit: { value: EM.texture }, tColor: { value: S.texture }, uKnee: { value: 1.2 }, uFrom: { value: spec.bloomFrom ?? 2.2 } });
  const downMat = pass(DOWN_F, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const upMat = pass(UP_F, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
  const mirrorVP = new THREE.Matrix4();
  const compose = pass(COMPOSE_F, {
    ...view, tColor: { value: S.texture }, tDepth: { value: S.depthTexture }, tAO: { value: AO2.texture }, tSSR: { value: SSR.texture }, tPlanar: { value: PL.texture }, tG: { value: G.texture },
    tShaft: { value: SH2.texture }, tBloom: { value: BU[0].texture }, tWater: { value: WA.texture },
    uSize: { value: new THREE.Vector2() }, uAO: { value: 0 }, uSSR: { value: 0 }, uPlanar: { value: 0 }, uShaft: { value: 0 }, uBloom: { value: 0 }, uWater: { value: 0 }, uSliver: sliver,
    uPlaneY: { value: 0 }, uRoughK: { value: 1 }, uBloomTint: { value: new THREE.Vector3(1, 0.97, 0.9) }, uViewInv: U.uViewInv, uMirrorVP: { value: mirrorVP },
  }, { depthTest: true, depthWrite: true });
  const present = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compose); present.frustumCulled = false;
  const presentScene = new THREE.Scene(); presentScene.add(present);
  const run = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };

  /* -- the floor as a mirror: the room drawn from below the floor, clipped at it (an oblique near plane) -- */
  const mirrorCam = new THREE.PerspectiveCamera();
  const floorY = spec.planeY ?? new THREE.Vector3().applyMatrix4(rt.group.matrixWorld).y;
  function planar(planeY, hide) {
    camera.updateMatrixWorld(true);
    const N = new THREE.Vector3(0, 1, 0), C = new THREE.Vector3(0, planeY, 0);
    const eye = camera.getWorldPosition(new THREE.Vector3()), look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())).add(eye);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
    const refl = (v) => v.clone().setY(2 * planeY - v.y);
    mirrorCam.copy(camera); mirrorCam.position.copy(refl(eye)); mirrorCam.up.copy(up.clone().setY(-up.y)); mirrorCam.lookAt(refl(look));
    mirrorCam.updateMatrixWorld(true); mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    // (oblique clip: nothing under the floor is drawn into its reflection)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(N, C).applyMatrix4(mirrorCam.matrixWorldInverse);
    const cp = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant), P = mirrorCam.projectionMatrix.elements;
    const q = new THREE.Vector4((Math.sign(cp.x) + P[8]) / P[0], (Math.sign(cp.y) + P[9]) / P[5], -1, (1 + P[10]) / P[14]);
    cp.multiplyScalar(2 / cp.dot(q));
    P[2] = cp.x; P[6] = cp.y; P[10] = cp.z + 1; P[14] = cp.w;
    mirrorCam.projectionMatrixInverse.copy(mirrorCam.projectionMatrix).invert();
    mirrorVP.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
    for (const h of hide) h.visible = false;
    renderer.setRenderTarget(PL); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(root, mirrorCam);
    for (const h of hide) h.visible = true;
  }

  /* -- the bloom chain -- */
  function bloomChain() {
    run(brightMat, SH);                                       // (SH is free here: half size)
    let src = SH;
    for (let i = 0; i < BL.length; i++) { downMat.uniforms.tSrc.value = src.texture; downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); run(downMat, BL[i]); src = BL[i]; }
    const mix = spec.bloomMix || [1, 1, 0.9, 0.8, 0.7, 0.6];
    for (let i = BL.length - 2; i >= 0; i--) {
      upMat.uniforms.tSrc.value = (i === BL.length - 2 ? BL[i + 1] : BU[i + 1]).texture; upMat.uniforms.tBase.value = BL[i].texture;
      upMat.uniforms.uTexel.value.set(1 / BL[i + 1].width, 1 / BL[i + 1].height); upMat.uniforms.uMix.value = mix[i + 1];
      run(upMat, BU[i]);
    }
  }

  /* -- water (water2.js) -- */
  if (spec.water2) lab.water = buildWater2({ THREE, rt, def, kit, root, camera, spec: spec.water2, world, lab, renderer });

  collect();
  lab.collect = collect;

  lab.apply = (f) => {
    collect();
    for (const x of meshes) if (x.isKit) x.mesh.material = proposed(x, f);
    if (lab.water) lab.water.setOn(f.has('water'));
    // (a mover that throws a real shadow has no need of the round blot the level gives what is dragged)
    for (const b of lab.blots) b.visible = !f.has('movers');
  };
  lab.update = (t, f) => {
    camera.updateMatrixWorld(true);
    if (spec.update) spec.update(t, lab, f);
    pickLamps();
    if (lab.water) lab.water.update(t, lab.wake || []);
  };
  const post = (f) => ['ao', 'ssr', 'planar', 'shafts', 'bloom', 'water'].some((k) => f.has(k));
  const clear = new THREE.Color();
  lab.draw = (f, drawVhs) => {
    renderer.getClearColor(clear); const clearA = renderer.getClearAlpha();
    try { draw(f, drawVhs); } finally { renderer.setClearColor(clear, clearA); renderer.setRenderTarget(null); }
    if (lab.debug) {
      // (a pass by itself, in place of the picture: ?dbg=mv|ao|ssr|planar|shafts|bloom|g|water)
      const t = { mv: mvRT.depthTexture, ao: AO2.texture, ssr: SSR.texture, planar: PL.texture, shafts: SH2.texture, bloom: BU[0].texture, g: G.texture, water: WA.texture, emit: EM.texture }[lab.debug];
      dbgMat.uniforms.tSrc.value = t; dbgMat.uniforms.uK.value = lab.debugK ?? 1; quad.material = dbgMat; renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    }
  };
  const dbgMat = pass('uniform sampler2D tSrc; uniform float uK; varying vec2 vUv; void main(){ vec4 c = texture2D(tSrc, vUv); gl_FragColor = vec4(abs(c.rgb) * uK, 1.0); }', { tSrc: { value: null }, uK: { value: 1 } });
  function draw(f, drawVhs) {
    if (f.has('movers')) moverShadows(); else U.uMvN.value = 0;
    U.uSpecFloor.value = f.has('planar') || f.has('ssr') ? 0 : 1;      // (a reflection of the tubes is their highlight: never both)
    U.uSpecGlass.value = f.has('ssr') ? 0.5 : 1;
    if (!post(f)) { drawVhs(); return; }
    sizeAll();
    camera.updateMatrixWorld(true);
    view.uProj.value.copy(camera.projectionMatrix); view.uInvProj.value.copy(camera.projectionMatrixInverse);
    const half = new THREE.Vector2(Math.ceil(W / 2), Math.ceil(H / 2)), full = new THREE.Vector2(W, H);
    // the scene, as the camcorder would have drawn it (the water's surface after, over it)
    const waterMeshes = lab.water ? lab.water.meshes : [];
    for (const m of waterMeshes) m.visible = false;
    renderer.setRenderTarget(S); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(root, camera);
    const needG = f.has('ssr') || f.has('planar');
    if (needG) drawPass('g', G, waterMeshes);
    if (f.has('ao')) {
      aoMat.uniforms.uSize.value.copy(full); aoMat.uniforms.uProjScale.value = camera.projectionMatrix.elements[5] * H * 0.5;
      run(aoMat, AO); run(aoBlur, AO2);
    }
    // (with the floor a mirror, the screen's reflections are left to the glass)
    if (f.has('ssr')) { ssrMat.uniforms.uSize.value.copy(half); ssrMat.uniforms.uFloor.value = f.has('planar') ? 0 : 1; run(ssrMat, SSR); }
    if (f.has('planar')) planar(floorY, [...meshes.filter((x) => x.held).map((x) => x.mesh), ...waterMeshes]);
    if (lab.water && f.has('water')) lab.water.draw({ renderer, camera, S, target: WA, mirror: (y) => planar(y, meshes.filter((x) => x.held).map((x) => x.mesh)), mirrorVP, mirrorTex: PL.texture, view, size: full, sliver: sliver.value });
    if (f.has('shafts')) {
      shaftU.uSize.value.copy(half);
      shaftU.uDoorK.value = lab.door ? (spec.doorAirK ?? 3) : 0; if (!lab.door) U.uDLampN.value = U.uDLampN.value; // (no doorway: nothing comes through)
      run(shaftMat, SH);
      blur4.uniforms.tSrc.value = SH.texture; blur4.uniforms.uStep.value.set(1 / half.x, 1 / half.y); run(blur4, SH2);
    }
    if (f.has('bloom')) {
      drawPass('e', EM);
      brightMat.uniforms.uFrom.value = f.has('materials') ? (spec.bloomFrom ?? 2.2) : 99;
      bloomChain();
    }
    const c = compose.uniforms;
    c.uSize.value.copy(full);
    c.uAO.value = f.has('ao') ? (spec.aoK ?? 0.85) : 0;
    c.uSSR.value = f.has('ssr') ? (spec.reflK ?? 1) : 0;
    c.uPlanar.value = f.has('planar') ? (spec.reflK ?? 1) : 0;
    c.uRoughK.value = f.has('materials') ? 1 : 0.6;
    c.uPlaneY.value = floorY;
    c.uShaft.value = f.has('shafts') ? 1 : 0;
    c.uBloom.value = f.has('bloom') ? (spec.bloomK ?? 0.5) : 0;
    c.uWater.value = lab.water && f.has('water') ? 1 : 0;
    renderer.setRenderTarget(null);
    const bloomWas = vhs.bloom.enabled;
    if (f.has('bloom')) vhs.bloom.enabled = false;           // (in place of the tier's own)
    vhs.setScene(presentScene); drawVhs(); vhs.setScene(root);
    vhs.bloom.enabled = bloomWas;
  }
  lab.meshes = meshes;
  lab.targets = { S, G, AO2, SSR, PL, SH2, BU, EM, WA };
  /** a debug view: one of the lab's own pictures in place of the scene (for looking at a pass by itself) */
  lab.debugView = null;
  return lab;
}
