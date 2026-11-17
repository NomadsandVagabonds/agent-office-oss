// The look-dev lab's proposed look. The "today" picture is the level's own kit material, untouched. The "proposed"
// picture swaps each kit mesh's material for a ShaderMaterial of the lab's own that starts from that very material's
// vertex and fragment source (read from the material at run time: kit.js does not export VERT/FRAG, and copying them
// would let the two drift) and adds terms behind #defines, one per feature. Uniforms the kit shares (torch, dimmer,
// flicker, banks) are the same objects, so the proposed side is lit by exactly what lights today's.
//
// Features (each on its own):
//   relief       procedural height maps at the texel grid (2.5 cm, one voxel) for carpet, paper, ceiling tile, lino
//   sheen        per-material response to the tubes and the torch: carpet/paper sheen, metal, plastic, lino, glass
//   reflect      one 6×128² cube picture of the room taken once at build, box-projected, blurred by mip level
//   contact      soft dark under and beside furniture (analytic boxes), and under the moving figure
//   torchshadow  one 256² depth map from the torch, furniture blocks the beam (h4)
//   tubeshadow   tube shadows baked at build: floor lightmap at 5 cm + re-baked vertices elsewhere (h1)
//   tubevert     the same bake into the existing vertices only, for comparison (h1, the cheap variant)
//   figshadow    the figure's shadow from the tubes, per pixel, analytic (h2)
//   doorlight    light through a doorway: door-shaped patch on the dark side, framed and blocked (h5)
//   water        the flooded floor and the puddle (water.js) and their wet edge, tide line and caustics
//   air          haze in the floor's colour, fog in tall rooms, dust in the light (a few hundred points)
//   grade        a colour grade before the camcorder (cold: the colder variant)
import { lightAt } from '../../backrooms/kit.js';
import { bankWeights } from '../../backrooms/lighting.js';
import { toLocal } from '../../backrooms/gen.js';
import { buildWater } from './water.js';
import { bakeTubeShadows } from './bake.js';

export const FEATURES = ['tubeshadow', 'figshadow', 'doorlight', 'torchshadow', 'relief', 'sheen', 'reflect', 'contact', 'water', 'air', 'grade'];

const MAX_LAMPS = 16, MAX_BOX = 24, MAX_DOOR_LAMPS = 8;

/* ---- GLSL added to the kit's fragment shader ---------------------------------------------- */
const LAB_HEAD = `
uniform mat4 uViewInv;
uniform vec3 uLampP[${MAX_LAMPS}];
uniform vec3 uLampC[${MAX_LAMPS}];
uniform vec4 uLampK[${MAX_LAMPS}];
uniform vec3 uLampD[${MAX_LAMPS}];
uniform vec3 uLampT[${MAX_LAMPS}];
uniform int uLampN;
uniform float uAmbLum;
uniform float uTime;
#ifdef LAB_PERVERT
varying float vMat;
#endif
// one lamp, as kit.js bake() gathers it (a copy of its gather(), lines 187-201, in GLSL); L: the way to it
vec3 labLamp(int i, vec3 p, vec3 n, vec3 at, out vec3 L) {
  vec3 d = at - p; float d2 = dot(d, d) + 0.02; L = d * inversesqrt(d2);
  vec4 K = uLampK[i];
  if (d2 > K.y) return vec3(0.0);
  float s = (dot(n, L) + K.z) / (1.0 + K.z);
  if (s <= 0.0) return vec3(0.0);
  s *= K.w + (1.0 - K.w) * max(0.0, -dot(L, uLampD[i]));
  float fade = 1.0 - d2 / K.y;
  s *= fade * fade / (1.0 + d2 / K.x);
  return uLampC[i] * s;
}
bool labSeg(vec3 o, vec3 d, vec3 c, vec3 e) {
  vec3 dd = vec3(abs(d.x) < 1e-5 ? 1e-5 : d.x, abs(d.y) < 1e-5 ? 1e-5 : d.y, abs(d.z) < 1e-5 ? 1e-5 : d.z);
  vec3 inv = 1.0 / dd, t0 = (c - e - o) * inv, t1 = (c + e - o) * inv;
  vec3 lo = min(t0, t1), hi = max(t0, t1);
  float a = max(max(lo.x, lo.y), lo.z), b = min(min(hi.x, hi.y), hi.z);
  return b > max(a, 0.0) && a < 1.0;
}
#ifdef LAB_RELIEF
uniform sampler2D uHeight;
uniform vec2 uHSize;
uniform float uHAmp;
float labH(vec2 cell) { return texture2D(uHeight, (cell + 0.5) / uHSize).r; }
#endif
#ifdef LAB_LIGHTMAP
uniform sampler2D uLm;
uniform vec4 uLmRect;
uniform mat4 uRoomInv;
#endif
#if defined(LAB_CONTACT) || defined(LAB_FIG)
uniform vec3 uBoxC[${MAX_BOX}];
uniform vec3 uBoxE[${MAX_BOX}];
uniform int uBoxN;
uniform vec3 uFigC[2];
uniform vec3 uFigE[2];
uniform int uFigN;
uniform vec4 uFigRect;
#endif
#ifdef LAB_TSHADOW
uniform sampler2D uTorchDepth;
uniform mat4 uTorchMat;
#endif
#ifdef LAB_DOOR
uniform vec3 uDoorO, uDoorU, uDoorV, uDoorN;
uniform vec3 uDLampP[${MAX_DOOR_LAMPS}];
uniform vec3 uDLampC[${MAX_DOOR_LAMPS}];
uniform vec4 uDLampK[${MAX_DOOR_LAMPS}];
uniform vec3 uDLampT[${MAX_DOOR_LAMPS}];
uniform int uDLampN;
uniform float uDoorK;
#endif
#ifdef LAB_ENV
uniform samplerCube uEnv;
uniform vec3 uEnvMin, uEnvMax, uEnvPos;
vec3 labEnv(vec3 wp, vec3 R, float rough) {
  vec3 a = (uEnvMax - wp) / R, b = (uEnvMin - wp) / R, f = max(a, b);
  float t = min(min(f.x, f.y), f.z);
  vec3 dir = wp + R * t - uEnvPos;
  return textureLod(uEnv, dir, rough * 6.0).rgb;
}
#endif
#ifdef LAB_WATERFX
uniform sampler2D uWetMap;
uniform vec4 uWetRect;
uniform mat4 uWetInv;
uniform float uWetLevel;
vec2 labWet(vec3 wp) { vec3 l = (uWetInv * vec4(wp, 1.0)).xyz; vec2 uv = (l.xz - uWetRect.xy) * uWetRect.zw; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec2(0.0); return texture2D(uWetMap, uv).rg; }
float labCaustic(vec2 p, float t) {
  p = floor(p / 0.05) * 0.05;                    // two voxels a step
  float a = sin(p.x * 9.0 + t * 1.1) + sin(p.y * 11.0 - t * 0.9) + sin((p.x + p.y) * 7.0 + t * 1.6) + sin((p.x - p.y) * 13.0 - t * 0.7);
  return pow(clamp(1.0 - abs(a) * 0.55, 0.0, 1.0), 6.0);
}
#endif
#ifdef LAB_HAZE
uniform vec3 uHazeCol;
uniform vec4 uHaze;
#endif
`;

// where the material is and which way it faces, in the world; then the features that change the light falling on it
const LAB_LIGHT = `
  vec3 flatN = normal;
  vec3 wp = (uViewInv * vec4(vView, 1.0)).xyz;
  vec3 lwn = normalize(mat3(uViewInv) * flatN);
  float litK = 1.0;
#ifdef LAB_RELIEF
  {
    vec2 st = vUv * uHSize, cell = floor(st), f = st - cell;
    float h0 = labH(cell), hx1 = labH(cell + vec2(1.0, 0.0)), hx0 = labH(cell - vec2(1.0, 0.0)), hy1 = labH(cell + vec2(0.0, 1.0)), hy0 = labH(cell - vec2(0.0, 1.0));
    const float bev = 0.3;
    float gx = smoothstep(1.0 - bev, 1.0, f.x) * (hx1 - h0) + smoothstep(bev, 0.0, f.x) * (h0 - hx0);
    float gy = smoothstep(1.0 - bev, 1.0, f.y) * (hy1 - h0) + smoothstep(bev, 0.0, f.y) * (h0 - hy0);
    float foot = length(fwidth(st));
    float amp = uHAmp * (1.0 - smoothstep(0.45, 1.1, foot));
    vec3 dp1 = dFdx(vView), dp2 = dFdy(vView); vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
    vec3 p2 = cross(dp2, flatN), p1 = cross(flatN, dp1);
    vec3 T = p2 * du1.x + p1 * du2.x, B = p2 * du1.y + p1 * du2.y;
    float im = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12)); T *= im; B *= im;
    normal = normalize(flatN - (T * gx + B * gy) * amp * 2.5);
    // the light's main way, as the stored light would have it: the sum of the lamps that reach this spot
    vec3 dom = vec3(0.0); vec3 L;
    for (int i = 0; i < ${MAX_LAMPS}; i++) { if (i >= uLampN) break; vec3 I = labLamp(i, wp, lwn, uLampP[i], L); dom += L * dot(I, vec3(0.333)); }
    vec3 Lv = normalize(mat3(viewMatrix) * (dom + lwn * 0.0001));
    float w0 = (dot(flatN, Lv) + 0.35) / 1.35, w1 = (dot(normal, Lv) + 0.35) / 1.35;
    float lit = clamp(w1 / max(w0, 0.05), 0.55, 1.6);
    litK *= mix(1.0, lit, smoothstep(0.0, 0.05, length(dom)));
    litK *= mix(1.0, 0.8 + 0.2 * h0, amp);           // the low places are a little darker
  }
#endif
#ifdef LAB_LIGHTMAP
  { vec3 l = (uRoomInv * vec4(wp, 1.0)).xyz; vec2 uv = (l.xz - uLmRect.xy) * uLmRect.zw;
    if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0 && lwn.y > 0.7) litK *= texture2D(uLm, uv).r; }
#endif
#ifdef LAB_FIG
  if (uFigN > 0 && wp.x > uFigRect.x && wp.z > uFigRect.y && wp.x < uFigRect.z && wp.z < uFigRect.w) {
    vec3 tot = vec3(uAmbLum), cut = vec3(0.0), L;
    vec3 o = wp + lwn * 0.02;
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      if (i >= uLampN) break;
      float hit = 0.0;
      vec3 I = labLamp(i, wp, lwn, uLampP[i], L);
      if (dot(I, vec3(1.0)) < 1e-4) continue;
      for (int k = -1; k <= 1; k++) {
        vec3 d = uLampP[i] + uLampT[i] * float(k) - o;
        for (int b = 0; b < 2; b++) { if (b >= uFigN) break; if (labSeg(o, d, uFigC[b], uFigE[b])) { hit += 1.0 / 3.0; break; } }
      }
      tot += I; cut += I * hit;
    }
    // the bounce under it goes too, in part: the kit keeps most of a room's light as ambient, and a figure that hides a tube
    // hides some of what that tube lit around it (a stand-in for occluding the bounce, at 0.8 of the tubes' share)
    float dl = dot(tot, vec3(0.333)) - uAmbLum, hid = dot(cut, vec3(0.333)) / max(dl, 1e-4);
    litK *= 1.0 - clamp((dot(cut, vec3(0.333)) + uAmbLum * 0.8 * hid) / max(dot(tot, vec3(0.333)), 1e-4), 0.0, 0.95);
  }
#endif
#ifdef LAB_CONTACT
  {
    float occ = 0.0;
    for (int b = 0; b < ${MAX_BOX + 2}; b++) {
      vec3 c, e;
      if (b < ${MAX_BOX}) { if (b >= uBoxN) continue; c = uBoxC[b]; e = uBoxE[b]; }
      else { int k = b - ${MAX_BOX}; if (k >= uFigN) continue; c = uFigC[k]; e = uFigE[k]; }
      vec3 qq = abs(wp - c) - e;
      float sd = length(max(qq, 0.0)) + min(max(qq.x, max(qq.y, qq.z)), 0.0);
      if (sd < -0.01) continue;
      vec3 toC = normalize(c - wp);
      occ += (1.0 - smoothstep(0.0, 0.32, sd)) * clamp(dot(lwn, toC) + 0.15, 0.0, 1.0) * 0.55;
    }
    litK *= 1.0 - clamp(occ, 0.0, 0.62);
  }
#endif
  vec3 c = vLit * litK;
`;

const LAB_BEAM = `
#ifdef LAB_TSHADOW
  if (beam > 0.0) {
    vec4 sp = uTorchMat * vec4(wp + lwn * 0.015, 1.0);
    vec3 s = sp.xyz / sp.w * 0.5 + 0.5;
    if (sp.w > 0.0 && s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0) {
      float v = 0.0, px = 1.0 / 256.0;
      for (int k = 0; k < 4; k++) { vec2 o = vec2(k == 1 ? px : k == 3 ? -px : 0.0, k == 0 ? px : k == 2 ? -px : 0.0) * 0.75; v += step(s.z - 0.0012, texture2D(uTorchDepth, s.xy + o).r); }
      beam *= v * 0.25;
    }
  }
#endif
  float labBeam = beam;
#ifdef LAB_DOOR
  if (dot(wp - uDoorO, uDoorN) > 0.02) {
    vec3 got = vec3(0.0), L;
    vec3 o = wp + lwn * 0.01;
    float uw = dot(uDoorU, uDoorU), vh = dot(uDoorV, uDoorV);
    for (int i = 0; i < ${MAX_DOOR_LAMPS}; i++) {
      if (i >= uDLampN) break;
      vec3 d = uDLampP[i] - wp; float d2 = dot(d, d) + 0.02; vec4 K = uDLampK[i];
      if (d2 > K.y) continue;
      float vis = 0.0;
      for (int k = -2; k <= 2; k++) {
        vec3 q = uDLampP[i] + uDLampT[i] * float(k) * 0.5, dd = q - o;
        float den = dot(dd, uDoorN); if (abs(den) < 1e-5) continue;
        float t = dot(uDoorO - o, uDoorN) / den; if (t <= 0.0 || t >= 1.0) continue;
        vec3 x = o + dd * t - uDoorO; float u = dot(x, uDoorU) / uw, v = dot(x, uDoorV) / vh;
        if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) continue;
        bool blocked = false;
#ifdef LAB_FIG
        for (int b = 0; b < 2; b++) { if (b >= uFigN) break; if (labSeg(o, dd, uFigC[b], uFigE[b])) blocked = true; }
#endif
        if (!blocked) vis += 0.2;
      }
      if (vis <= 0.0) continue;
      L = d * inversesqrt(d2);
      float s = max(dot(lwn, L), 0.0) * (K.w + (1.0 - K.w) * max(0.0, L.y));
      float fade = 1.0 - d2 / K.y;
      got += uDLampC[i] * s * fade * fade / (1.0 + d2 / K.x) * vis;
    }
    beam += dot(got, vec3(0.333)) * uDoorK;
  }
#endif
`;

const LAB_FINISH = `
  {
    vec3 alb = vAlb;
#ifdef MAPPED
    alb *= texture2D(map, vUv).rgb;
#endif
    float kind = float(LAB_KIND);
#ifdef LAB_PERVERT
    float mk = vMat;                  // 0 matte · 1 plastic · 2 metal (from the colour: see look.js)
#else
    float mk = -1.0;
#endif
    vec3 bn = normalize(mat3(uViewInv) * normal);
    vec3 V = normalize(cameraPosition - wp);
    float nv = max(dot(bn, V), 0.0);
    // what this surface is made of: [highlight strength, tightness, sheen, reflection]
    vec4 M = vec4(0.0);
    vec3 tint = vec3(1.0);
    float rough = 0.6;
    if (kind == 1.0) { M = vec4(0.0, 1.0, 0.55, 0.0); }                       // carpet: sheen at a glancing angle, no shine
    else if (kind == 2.0) { M = vec4(0.5, 90.0, 0.0, 0.32); rough = 0.22; }     // lino, tile: a hard shine, a blurred reflection
    else if (kind == 3.0) { M = vec4(0.05, 10.0, 0.22, 0.0); }                  // wallpaper: satin
    else if (kind == 7.0) { M = vec4(1.6, 260.0, 0.0, 1.0); rough = 0.03; }     // glass
    else if (mk > 1.5) { M = vec4(1.1, 110.0, 0.0, 0.55); tint = alb * 1.6 + 0.08; rough = 0.16; }   // metal: tight, coloured
    else if (mk > 0.5) { M = vec4(0.16, 14.0, 0.0, 0.06); rough = 0.55; }      // plastic: broad and dull
    vec3 add = vec3(0.0);
#ifdef LAB_SHEEN
    vec3 L;
    for (int i = 0; i < ${MAX_LAMPS}; i++) {
      if (i >= uLampN) break;
      vec3 I = labLamp(i, wp, bn, uLampP[i], L);
      if (dot(I, vec3(1.0)) < 1e-5) continue;
      vec3 H = normalize(L + V); float nh = max(dot(bn, H), 0.0);
      add += I * tint * M.x * pow(nh, M.y) * (M.y + 8.0) / 25.0;
      add += I * alb * M.z * pow(1.0 - nv, 4.0) * 1.6;
    }
    // the torch: a highlight where its beam lands (it has no colour of its own here)
    if (labBeam > 0.0) {
      vec3 to = normalize((uViewInv * vec4(uTorchOrigin, 1.0)).xyz - wp);
      vec3 H = normalize(to + V); float nh = max(dot(bn, H), 0.0);
      add += labBeam * (tint * M.x * pow(nh, M.y) * (M.y + 8.0) / 25.0 + alb * M.z * pow(1.0 - nv, 4.0) * 1.2);
    }
#endif
#ifdef LAB_ENV
    if (M.w > 0.0) {
      vec3 R = reflect(-V, bn);
      float fr = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
      float k = kind == 7.0 ? fr : mk > 1.5 ? 0.5 + 0.5 * fr : fr;
      add += labEnv(wp, R, rough) * tint * M.w * k;
    }
#endif
#ifdef LAB_WATERFX
    {
      vec2 w = labWet(wp);
      if (lwn.y > 0.7) {
        // under the water: darker, the light through it in bright moving lines; around it: darker, shinier carpet
        float under = step(0.01, w.r), edge = w.g * (1.0 - under);
        c *= 1.0 - 0.38 * under - 0.3 * edge;
        add += alb * labCaustic(wp.xz, uTime) * under * 0.35 * dot(vLit, vec3(0.333)) * 3.0;
        vec3 L; vec3 sp = vec3(0.0);
        for (int i = 0; i < ${MAX_LAMPS}; i++) { if (i >= uLampN) break; vec3 I = labLamp(i, wp, lwn, uLampP[i], L); sp += I * pow(max(dot(lwn, normalize(L + V)), 0.0), 40.0); }
        add += sp * edge * 0.5;
      } else if (abs(lwn.y) < 0.3) {
        // a wall by the water: a tide line, the paper darker under it, and the light off the water on it
        vec2 w2 = labWet(wp + lwn * 0.12), w3 = labWet(wp + lwn * 0.45);
        float near = max(step(0.01, w2.r), w2.g);
        float h = wp.y - uWetLevel;
        float line = near * (smoothstep(0.035, 0.05, h) - smoothstep(0.07, 0.085, h));
        c *= 1.0 - line * 0.45 - near * step(h, 0.05) * 0.25;
        float lit = max(step(0.01, w3.r), step(0.01, w2.r));
        add += alb * labCaustic(vec2(dot(wp.xz, vec2(lwn.z, -lwn.x)) * 0.7, wp.y * 1.6), uTime * 0.8) * lit * (1.0 - smoothstep(0.0, 0.9, h)) * 0.22 * dot(vLit, vec3(0.333)) * 3.0;
      }
    }
#endif
    c += add;
  }
#ifdef LAB_HAZE
  {
    float d = length(vView);
    float f = 1.0 - exp(-d * uHaze.x);
    f *= mix(1.0, exp(-max(wp.y - uHaze.z, 0.0) * uHaze.y), step(0.0001, uHaze.y));
    c = mix(c, uHazeCol, clamp(f, 0.0, uHaze.w));
  }
#endif
`;

function patch(frag, vert, defs) {
  const f0 = frag;
  let f = frag.replace('void main() {', LAB_HEAD + '\nvoid main() {');
  f = f.replace('  vec3 c = vLit;\n', '');
  f = f.replace(/(vec3 normal = normalize\(vNormal\)[^;]*;)/, `$1\n${LAB_LIGHT}`);
  f = f.replace('  vec3 torch = vAlb * beam;', LAB_BEAM + '  vec3 torch = vAlb * beam;');
  f = f.replace('  gl_FragColor = vec4(c, uAlpha);', LAB_FINISH + '  gl_FragColor = vec4(c, labAlpha(uAlpha, flatN));');
  f = f.replace('void main() {', `float labAlpha(float a, vec3 n) {\n#if LAB_KIND == 7\n  return mix(a, 0.85, pow(1.0 - abs(normalize(n).z), 3.0) * float(LAB_GLASSEDGE));\n#else\n  return a;\n#endif\n}\nvoid main() {`);
  for (const must of ['vec3 flatN', 'labBeam', 'labAlpha(uAlpha']) if (!f.includes(must)) throw new Error(`[lab] the kit shader changed: could not place ${must} (look.js patch)`);
  if (f === f0) throw new Error('[lab] patch did nothing');
  let v = vert;
  if (defs.LAB_PERVERT) v = v.replace('void main() {', 'attribute float aMat;\nvarying float vMat;\nvoid main() {\n  vMat = aMat;');
  return { frag: f, vert: v };
}

/* ---- height maps from the level's own textures --------------------------------------------- */
function heightFrom(THREE, texture, kind) {
  const img = texture.image, w = img.width, h = img.height;
  const g = img.getContext('2d'), px = g.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.55 + px[i * 4 + 2] * 0.15) / 255;
  const sorted = Float32Array.from(lum).sort(), med = sorted[sorted.length >> 1];
  const hash = (x, y) => { let s = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0; s ^= s >>> 13; return (Math.imul(s, 1274126177) >>> 0) / 4294967296; };
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, d = lum[i] - med;
    let v;
    if (kind === 1) v = 0.5 + d * 5 + (hash(x >> 1, y >> 1) - 0.5) * 0.12;   // carpet: the speckle is the pile, a little uneven
    else if (kind === 3) v = Math.abs(d) > 0.04 ? 0.85 : 0.35 + (hash(x, y) - 0.5) * 0.08;  // paper: the print stands up
    else if (kind === 4) v = d < -0.05 ? 0.05 : 0.7 + (hash(x, y) - 0.5) * 0.25;  // ceiling: pits, and the T-bar sunk
    else v = d < -0.09 ? 0.1 : 0.8;                                         // lino: the seams are low
    v = Math.max(0, Math.min(1, v));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = Math.round(v * 255); out[i * 4 + 3] = 255;
  }
  // (canvas rows run downward, texture v upward; the kit's CanvasTexture has flipY, so match it)
  const flipped = new Uint8Array(out.length);
  for (let y = 0; y < h; y++) flipped.set(out.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4);
  const t = new THREE.DataTexture(flipped, w, h);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true;
  return { texture: t, size: [w, h] };
}

/* ---- what a vertex is made of, guessed from its colour (the room contract says nothing yet) -- */
export function matOf(r, g, b) {
  // linear → roughly sRGB
  const s = (v) => Math.pow(Math.max(0, v), 1 / 2.2);
  const R = s(r), G = s(g), B = s(b), mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0;
  let hue = 0;
  if (mx > mn) { if (mx === R) hue = ((G - B) / (mx - mn)) * 60; else if (mx === G) hue = (2 + (B - R) / (mx - mn)) * 60; else hue = (4 + (R - G) / (mx - mn)) * 60; if (hue < 0) hue += 360; }
  if (hue > 30 && hue < 55 && sat > 0.38 && mx > 0.55) return 2;          // brass, gold
  if (sat < 0.1 && mx > 0.45 && mx < 0.8) return 2;                       // steel, aluminium
  return 1;
}

/* ---- the lab's look ------------------------------------------------------------------------- */
export async function createLook(o) {
  const { THREE, renderer, root, camera, world, rt, def, kit, level, spec } = o;
  const U = {
    uViewInv: { value: camera.matrixWorld },
    uLampP: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampC: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampK: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4(1, 1, 0, 1)) },
    uLampD: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampT: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector3()) },
    uLampN: { value: 0 }, uAmbLum: { value: 0.02 }, uTime: { value: 0 },
    uBoxC: { value: Array.from({ length: MAX_BOX }, () => new THREE.Vector3()) },
    uBoxE: { value: Array.from({ length: MAX_BOX }, () => new THREE.Vector3()) },
    uBoxN: { value: 0 },
    uFigC: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uFigE: { value: [new THREE.Vector3(), new THREE.Vector3()] }, uFigN: { value: 0 },
    uFigRect: { value: new THREE.Vector4() },
    uTorchDepth: { value: null }, uTorchMat: { value: new THREE.Matrix4() },
    uDoorO: { value: new THREE.Vector3() }, uDoorU: { value: new THREE.Vector3() }, uDoorV: { value: new THREE.Vector3() }, uDoorN: { value: new THREE.Vector3() },
    uDLampP: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector3()) },
    uDLampC: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector3()) },
    uDLampK: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector4(1, 1, 0, 1)) },
    uDLampT: { value: Array.from({ length: MAX_DOOR_LAMPS }, () => new THREE.Vector3()) },
    uDLampN: { value: 0 }, uDoorK: { value: 4 },
    uEnv: { value: null }, uEnvMin: { value: new THREE.Vector3() }, uEnvMax: { value: new THREE.Vector3() }, uEnvPos: { value: new THREE.Vector3() },
    uWetMap: { value: null }, uWetRect: { value: new THREE.Vector4() }, uWetInv: { value: new THREE.Matrix4() }, uWetLevel: { value: 0 },
    uHazeCol: { value: new THREE.Vector3() }, uHaze: { value: new THREE.Vector4() },
  };
  const lab = { U, rt, extras: [], figure: null, door: null, water: null };

  /* -- every kit mesh, and what it is -- */
  const kinds = new Map();                        // texture → kind
  for (const r of world.rooms) {
    const lk = r.def.look; if (!lk) continue;
    const fl = kit.tex.floor(lk);
    kinds.set(fl, lk.floor === 'lino' || lk.floor === 'terrazzo' || lk.floor === 'screed' ? 2 : 1);
    kinds.set(kit.tex.wallpaper(lk), 3);
    kinds.set(kit.tex.ceiling(lk.ceil), 4);
  }
  if (spec.hardFloor) for (const [t, k] of kinds) if (k === 1 && spec.hardFloor === 'all') kinds.set(t, 2);
  const white = kit.tex.white();
  const meshes = [];
  root.traverse((m) => {
    if (!m.isMesh || !m.material?.isShaderMaterial || !m.material.fragmentShader.includes('flashlightBeam(vView')) return;
    const mat = m.material, map = mat.uniforms.map?.value, vox = !!mat.defines.VOXEL;
    let kind = 0;
    if (vox) kind = mat.uniforms.uAlpha.value < 1 ? 7 : 6;
    else if (map === white) kind = 5;
    else if (kinds.has(map)) kind = kinds.get(map);
    if ((kind === 5 || kind === 6) && !m.geometry.attributes.aMat) {
      const a = m.geometry.attributes.aAlb, n = a.count, out = new Float32Array(n);
      const sf = m.geometry.attributes.aSurf;
      for (let i = 0; i < n; i++) out[i] = sf && sf.getY(i) > 0.5 ? 0 : kind === 5 ? (matOf(a.getX(i), a.getY(i), a.getZ(i)) === 2 ? 2 : 0) : matOf(a.getX(i), a.getY(i), a.getZ(i));
      m.geometry.setAttribute('aMat', new THREE.BufferAttribute(out, 1));
    }
    meshes.push({ mesh: m, today: mat, kind, cache: new Map(), room: world.rooms.find((r) => { let p = m; while (p) { if (p === r.group) return true; p = p.parent; } return false; }) });
  });
  const heights = new Map();
  const heightOf = (map, kind) => { if (!heights.has(map)) heights.set(map, heightFrom(THREE, map, kind)); return heights.get(map); };

  /* -- lamps: the strongest few that reach what the camera sees, in world space, at their bank's level -- */
  const tmp = new THREE.Vector3();
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
  const camPos = camera.position.clone();
  const levelOf = (l) => {
    const r = l.room, L = l.L;
    let k = r.u.dim.value * (L.flick ? r.u.flick.value : 1);
    if (r.lighting && Number.isInteger(L.bank)) { const b = L.bank; k *= b === 0 ? r.u.banks.value[0] : b === 1 ? r.u.banks.value[1] : b === 2 ? r.u.moreBanks.value[0] : r.u.moreBanks.value[1]; }
    return k;
  };
  const visibleRooms = () => world.rooms.filter((r) => r.group.visible);
  function pickLamps() {
    const vis = new Set(visibleRooms());
    const list = allLamps.filter((l) => vis.has(l.room)).map((l) => ({ l, w: (l.L.r + l.L.g + l.L.b) * levelOf(l) / (1 + l.p.distanceToSquared(camPos) * 0.08) }))
      .filter((x) => x.w > 1e-4).sort((a, b) => b.w - a.w).slice(0, MAX_LAMPS);
    U.uLampN.value = list.length;
    list.forEach(({ l }, i) => {
      const k = levelOf(l);
      U.uLampP.value[i].copy(l.p); U.uLampC.value[i].set(l.L.r * k, l.L.g * k, l.L.b * k);
      U.uLampK.value[i].set(l.L.k, l.L.far2, l.L.wrap, l.L.lobe ? l.L.floor : 1);
      U.uLampD.value[i].copy(l.ax); U.uLampT.value[i].copy(l.tube);
    });
    // the ambient as the kit has it now: in the bank modes nearly all of it belongs to the ceiling banks, and goes out with them
    const a = rt.amb, sh = rt.lighting ? rt.lighting.ambientShare : 0, b = rt.u.banks.value;
    U.uAmbLum.value = (a[0] + a[1] + a[2]) / 3 * rt.u.dim.value * ((1 - sh) + sh * (b[0] + b[1]) / 2);
  }

  /* -- occluders: the room's solids, as tall as what was built on them -- */
  const occluders = [];
  {
    const inv = new THREE.Matrix4().copy(rt.group.matrixWorld).invert();
    const pts = [];
    for (const x of meshes) if (x.room === rt && (x.kind === 5 || x.kind === 6)) {
      const p = x.mesh.geometry.attributes.position; x.mesh.updateMatrixWorld(true);
      const m = new THREE.Matrix4().multiplyMatrices(inv, x.mesh.matrixWorld);
      for (let i = 0; i < p.count; i++) { tmp.fromBufferAttribute(p, i).applyMatrix4(m); pts.push(tmp.x, tmp.y, tmp.z); }
    }
    for (const col of rt.colliders) {
      if (col.on === false) continue;
      const a = toLocal(def, col.x0, col.z0), b = toLocal(def, col.x1, col.z1);
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
      if ((x1 - x0) * (z1 - z0) > 6 || x1 - x0 > 4.5 || z1 - z0 > 4.5) continue;
      let top = -1, bot = 99;
      for (let i = 0; i < pts.length; i += 3) { const x = pts[i], y = pts[i + 1], z = pts[i + 2]; if (x > x0 + 0.02 && x < x1 - 0.02 && z > z0 + 0.02 && z < z1 - 0.02 && y > 0.02) { if (y > top) top = y; if (y < bot) bot = y; } }
      if (top < 0.1) continue;
      occluders.push({ x0, x1, z0, z1, y0: 0, y1: Math.min(top, def.H - 0.05) });
    }
    for (const b of spec.occluders || []) occluders.push(b);
    occluders.splice(MAX_BOX);
    const m = rt.group.matrixWorld;
    occluders.forEach((b, i) => {
      const c = new THREE.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2).applyMatrix4(m);
      const e = new THREE.Vector3((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2);
      if (def.rot % 2) [e.x, e.z] = [e.z, e.x];
      U.uBoxC.value[i].copy(c); U.uBoxE.value[i].copy(e);
    });
    U.uBoxN.value = occluders.length;
  }
  lab.occluders = occluders;

  /* -- h1: tube shadows, baked (bake.js) -- */
  const baked = bakeTubeShadows({ THREE, rt, def, meshes: meshes.filter((x) => x.room === rt), occluders, extraRooms: [] });
  lab.baked = baked;

  /* -- reflections: one cube picture, taken once -- */
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(0.05, 60, cubeRT);
  {
    const lo = new THREE.Vector3(-def.W / 2, 0, -def.D / 2), hi = new THREE.Vector3(def.W / 2, def.H, def.D / 2);
    const a = lo.clone().applyMatrix4(rt.group.matrixWorld), b = hi.clone().applyMatrix4(rt.group.matrixWorld);
    U.uEnvMin.value.set(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
    U.uEnvMax.value.set(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));
    const at = spec.envAt ? new THREE.Vector3(spec.envAt[0], spec.envAt[1], spec.envAt[2]).applyMatrix4(rt.group.matrixWorld) : new THREE.Vector3(0, 1.1, 0).applyMatrix4(rt.group.matrixWorld);
    U.uEnvPos.value.copy(at); cubeCam.position.copy(at);
  }
  let cubeTaken = false;
  const takeCube = () => {
    for (const e of lab.extras) e.visible = false;
    kit.shared.uTorch.value = 0;
    cubeCam.update(renderer, root);
    for (const e of lab.extras) e.visible = true;
    U.uEnv.value = cubeRT.texture; cubeTaken = true;
  };

  /* -- h4 / d: the torch's own depth picture -- */
  const torchRT = new THREE.WebGLRenderTarget(256, 256, { depthBuffer: true });
  torchRT.depthTexture = new THREE.DepthTexture(256, 256); torchRT.depthTexture.type = THREE.UnsignedIntType;
  const torchCam = new THREE.PerspectiveCamera(42, 1, 0.08, 16);
  const depthMat = new THREE.MeshDepthMaterial();
  U.uTorchDepth.value = torchRT.depthTexture;
  function torchShadow() {
    const o = new THREE.Vector3().copy(kit.shared.uTorchOrigin.value).applyMatrix4(camera.matrixWorld);
    const d = new THREE.Vector3().copy(kit.shared.uTorchDirection.value).transformDirection(camera.matrixWorld);
    torchCam.position.copy(o); torchCam.lookAt(o.clone().add(d)); torchCam.updateMatrixWorld(true);
    U.uTorchMat.value.multiplyMatrices(torchCam.projectionMatrix, torchCam.matrixWorldInverse);
    const hidden = lab.extras.filter((e) => e.userData.noShadow); hidden.forEach((e) => (e.visible = false));
    root.overrideMaterial = depthMat;
    renderer.setRenderTarget(torchRT); renderer.clear(); renderer.render(root, torchCam); renderer.setRenderTarget(null);
    root.overrideMaterial = null;
    hidden.forEach((e) => (e.visible = true));
  }

  /* -- haze: the colour of the floor, as lit -- */
  {
    const lk = def.look, col = new THREE.Color(lk.carpet || '#887755').convertSRGBToLinear();
    const l = (rt.amb[0] + rt.amb[1] + rt.amb[2]) / 3 + 0.02;
    const k = spec.haze || { den: 0.03, fall: 0, max: 0.4, light: 2.2 };
    U.uHazeCol.value.set(col.r, col.g, col.b).multiplyScalar(l * (k.light ?? 2.2));
    if (k.col) U.uHazeCol.value.set(...k.col);
    U.uHaze.value.set(k.den, k.fall || 0, def.y || 0, k.max);
  }

  /* -- water (water.js): surfaces of its own, and a wet map the kit surfaces read -- */
  if (spec.doorK) U.uDoorK.value = spec.doorK;
  if (spec.water) {
    lab.water = buildWater({ THREE, rt, def, kit, U, spec: spec.water, world });
    for (const m of lab.water.meshes) { root.add(m); lab.extras.push(m); m.userData.noShadow = true; }
  }

  /* -- dust in the light (air): a few hundred square points, lit by being in a tube's light or the beam -- */
  const dust = makeDust(THREE, { def, rt, U, kit, spec, allLamps: allLamps.filter((l) => l.room === rt) });
  dust.visible = false; dust.userData.noShadow = true; root.add(dust); lab.extras.push(dust);

  /* -- grade: the picture through a pass of its own before the camcorder has it -- */
  const gradeRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const gradeMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: gradeRT.texture }, uCold: { value: 0 } }, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tScene; uniform float uCold; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tScene, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // a gentle toe and a shoulder, in log space around mid grey
        float lg = log2(max(l, 1e-5) / 0.18);
        float lc = 0.18 * exp2(lg * 1.12) ;
        c *= lc / max(l, 1e-5);
        l = lc;
        float sh = 1.0 - smoothstep(0.0, 0.22, l), hi = smoothstep(0.25, 1.2, l);
        vec3 warm = vec3(1.05, 1.0, 0.86), teal = vec3(0.86, 1.0, 1.04), green = vec3(0.9, 1.04, 0.98), blue = vec3(0.84, 0.97, 1.1);
        vec3 shT = mix(teal, blue, uCold), hiT = mix(warm, green, uCold);
        c *= mix(vec3(1.0), shT, sh * 0.9) * mix(vec3(1.0), hiT, hi);
        c = mix(vec3(l), c, mix(0.86, 0.62, uCold));         // a little less saturated: the yellow is old, not loud
        c += vec3(0.006, 0.007, 0.005) * (1.0 + uCold);          // the blacks are never black under these tubes
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const gradeScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gradeMat); quad.frustumCulled = false; gradeScene.add(quad);

  /* -- the proposed material for one mesh under one set of features -- */
  function proposed(x, f) {
    const want = (k) => f.has(k);
    const defines = { ...x.today.defines, LAB_KIND: x.kind, LAB_GLASSEDGE: want('sheen') ? 1 : 0 };
    if (x.kind === 5 || x.kind === 6) defines.LAB_PERVERT = 1;
    if (want('relief') && x.kind >= 1 && x.kind <= 4) defines.LAB_RELIEF = 1;
    if (want('tubeshadow') && x.room === rt && (x.kind === 1 || x.kind === 2) && baked.lightmap) defines.LAB_LIGHTMAP = 1;
    if (want('figshadow') && lab.figure) defines.LAB_FIG = 1;
    if (want('contact')) defines.LAB_CONTACT = 1;
    if ((want('torchshadow')) && spec.torch) defines.LAB_TSHADOW = 1;
    if (want('doorlight') && lab.door) defines.LAB_DOOR = 1;
    if (want('sheen')) defines.LAB_SHEEN = 1;
    if (want('reflect') || (want('water') && spec.water)) defines.LAB_ENV = 1;
    if (want('water') && lab.water) defines.LAB_WATERFX = 1;
    if (want('air')) defines.LAB_HAZE = 1;
    const key = JSON.stringify(defines);
    if (x.cache.has(key)) return x.cache.get(key);
    const { frag, vert } = patch(x.today.fragmentShader, x.today.vertexShader, defines);
    const uniforms = { ...x.today.uniforms, ...U };
    if (defines.LAB_RELIEF) {
      const hm = heightOf(x.today.uniforms.map.value, x.kind);
      uniforms.uHeight = { value: hm.texture }; uniforms.uHSize = { value: new THREE.Vector2(...hm.size) };
      uniforms.uHAmp = { value: x.kind === 1 ? 0.55 : x.kind === 3 ? 0.7 : x.kind === 4 ? 0.8 : 0.6 };
    }
    if (defines.LAB_LIGHTMAP) Object.assign(uniforms, baked.uniforms);
    const m = new THREE.ShaderMaterial({ defines, uniforms, vertexShader: vert, fragmentShader: frag, side: x.today.side, transparent: x.today.transparent, depthWrite: x.today.depthWrite });
    m.extensions = { derivatives: true };
    x.cache.set(key, m);
    return m;
  }

  lab.apply = (f) => {
    const on = f.size > 0;
    baked.use(f.has('tubeshadow') ? 'lightmap' : f.has('tubevert') ? 'vertex' : 'none');
    for (const x of meshes) {
      const lit = new Set([...f].filter((k) => k !== 'grade' && k !== 'cold' && k !== 'tubevert' && k !== 'shadowmap'));
      x.mesh.material = on && lit.size ? proposed(x, f) : x.today;
    }
    dust.visible = f.has('air');
    if (lab.water) for (const m of lab.water.meshes) m.visible = f.has('water');
    if (lab.figure) lab.figure.visible = true;
  };
  lab.update = (t, f) => {
    U.uTime.value = t;
    camera.updateMatrixWorld(true);
    if (spec.update) spec.update(t, lab, f);
    pickLamps();
    baked.refresh?.();
    dust.material.uniforms.uTime.value = t;
    if (lab.water) lab.water.update(t);
  };
  lab.draw = (f, drawVhs) => {
    if ((f.has('reflect') || f.has('water')) && !cubeTaken) {
      const saved = meshes.map((x) => x.mesh.material); meshes.forEach((x) => (x.mesh.material = x.today));
      const was = kit.shared.uTorch.value; takeCube(); kit.shared.uTorch.value = was;
      meshes.forEach((x, i) => (x.mesh.material = saved[i]));
    }
    if (f.has('torchshadow') && spec.torch) torchShadow();
    if (f.has('grade') || f.has('cold')) {
      const res = o.vhs.uniforms.uRes.value;
      if (gradeRT.width !== res.x || gradeRT.height !== res.y) gradeRT.setSize(res.x, res.y);
      gradeMat.uniforms.uCold.value = f.has('cold') ? 1 : 0;
      renderer.setRenderTarget(gradeRT); renderer.clear(); renderer.render(root, camera); renderer.setRenderTarget(null);
      o.vhs.setScene(gradeScene); drawVhs(); o.vhs.setScene(root);
    } else drawVhs();
  };
  lab.lightAt = (x, y, z) => lightAt(rt.lights, rt.amb, x, y, z);
  lab.meshes = meshes;
  lab.bankWeights = bankWeights;
  return lab;
}

function makeDust(THREE, { def, rt, U, kit, spec }) {
  let s = 12345; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const n = spec.dust ?? 700, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rnd() - 0.5) * def.W * 0.95; pos[i * 3 + 1] = rnd() * (def.H - 0.1); pos[i * 3 + 2] = (rnd() - 0.5) * def.D * 0.95; ph[i] = rnd() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { ...U, uTime: { value: 0 }, uTorch: kit.shared.uTorch, uTorchOrigin: kit.shared.uTorchOrigin, uTorchDirection: kit.shared.uTorchDirection, uPx: { value: 900 } },
    vertexShader: `attribute float aPh; uniform float uTime, uTorch, uPx; uniform vec3 uTorchOrigin, uTorchDirection;
      uniform vec3 uLampP[${MAX_LAMPS}]; uniform vec3 uLampC[${MAX_LAMPS}]; uniform int uLampN;
      varying float vB;
      void main() {
        vec3 p = position + vec3(sin(uTime * 0.21 + aPh) * 0.08, sin(uTime * 0.13 + aPh * 2.0) * 0.06 - mod(uTime * 0.01 + aPh, 0.3), cos(uTime * 0.17 + aPh) * 0.08);
        vec4 wp = modelMatrix * vec4(p, 1.0);
        float b = 0.0;
        for (int i = 0; i < ${MAX_LAMPS}; i++) { if (i >= uLampN) break; vec3 d = uLampP[i] - wp.xyz; float r = length(d.xz); if (d.y > 0.0) b += dot(uLampC[i], vec3(0.333)) * (1.0 - smoothstep(0.25, 0.7, r)) * smoothstep(2.6, 0.2, d.y) * 0.5; }
        vec4 mv = viewMatrix * wp;
        vec3 off = mv.xyz - uTorchOrigin; float dd = length(off);
        b += uTorch * smoothstep(${Math.cos(18 * Math.PI / 180).toFixed(5)}, ${Math.cos(6 * Math.PI / 180).toFixed(5)}, dot(off / dd, uTorchDirection)) * (1.0 - smoothstep(3.0, 9.0, dd)) * 1.6;
        vB = b * (0.6 + 0.4 * sin(aPh * 7.0));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPx * 0.008 / -mv.z, 1.5, 4.0);
      }`,
    fragmentShader: 'varying float vB; void main(){ gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * vB * 0.8, 1.0); }',
  });
  const pts = new THREE.Points(g, m);
  pts.matrixAutoUpdate = false; pts.matrix.copy(rt.group.matrixWorld); pts.frustumCulled = false; pts.renderOrder = 5;
  return pts;
}
