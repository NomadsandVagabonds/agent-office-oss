// The Backrooms — the ceiling tubes caught on a floor that shines (the Graphics setting's `sheen`, graphics.js): the
// numbers, the choice of lamps and the shader's half, as plain data and arithmetic. No three.js in here: the tests read
// it, and sheen.js moves the lamps into the camera's space with it each draw.
//
// A waxed corridor floor shows each tube overhead as a long soft streak toward the eye, strongest looking down the
// corridor at a low angle and nearly nothing looking straight down. That is a glossy highlight of each tube, worked out
// in the floor's own fragment shader from the lamps the room already has: no extra draw, no picture of the room. Each
// ceiling tube is a line 0.9 m long along the room's z (as the tube shadows have it, shadowmap.js), and the point on it
// nearest the floor's mirrored ray stands for it; a GGX lobe with Schlick's fresnel, at the tube's level this frame (its
// group: steady, flickering, a bank; the room's dimmer) and under its group's tube shadow where the room has a light map.
// A dead panel has no lamp, so it gives none.
import { SHEEN_FLOORS, SHEEN_STRENGTH } from './graphics.js';

export const SHEEN = Object.freeze({
  lamps: 8,            // tubes a floor pixel loops over (the nearest the eye, of the room's own)
  fade: 1.5,           // metres: the farthest of the chosen fades out over this much before the next one takes its place
  tube: 0.45,          // half a ceiling tube's length, along the room's z (shadowmap.js SHADOWS.tube's ends)
  pointFrom: 1.6,      // a lamp that is not a ceiling tube reflects as a point if it hangs at least this high (metres)
  f0: 0.04,            // the reflectance looking straight down (a dielectric: vinyl, polished stone, glazed tile)
  gain: SHEEN_STRENGTH, // how bright what is mirrored is (a lit panel is drawn at 2.5 × its colour, and blooms), times the floor's shininess (graphics.js: the one number that turns it all down)
  roughMax: 0.10,      // the lobe's roughness for a floor that barely shines; less, the more it shines
  roughSpan: 0.06,
  widen: 0.04,         // the tube's size, as roughness added at a metre (less further off)
  stretch: 6,          // how much more it is smeared along the line of sight than across it (the streak)
  env: 1.0,            // the wax as a whole (the lit ceiling mirrored, at a graze), against a tube's streak
  envFrom: 1.5,        // metres from the eye where it starts to grow…
  envTo: 7,            // …and where it is whole
  envLit: 1.5,         // the floor's own baked light, times this (to 1): an unlit strip takes less of it
  envTile: 2.5,       // the tile's own shade, times this (to 1): a dark joint takes less of it
  falloff: 0.03,       // times the bake's own falloff with distance (the lamp's k): a reflection of a lit area barely fades
  side: 0.4,           // how bright a tube is seen from its side, against straight below it
  knee: 0.32,          // what it adds is rolled off toward this (a soft shoulder, never a flat white bar)
  up: 0.95,            // only surfaces facing up this much shine
  blocky: 1,           // 1: worked out once per texel of the floor's own texture (a voxel world); 0: per pixel
});

/** The lobe for a floor of shininess s (0…1): → { strength, rough }, or null when it does not shine. */
export function sheenLobe(s) {
  const k = Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0;
  if (k <= 0) return null;
  return { strength: SHEEN.gain * k, rough: SHEEN.roughMax - SHEEN.roughSpan * k };
}
export const sheenOfKind = (kind) => sheenLobe(SHEEN_FLOORS[kind] ?? 0);

/**
 * Which group of the room's light a lamp is in, as kit.js bake() keeps them apart: 2 + its bank where the room has
 * banks (`lighting`) and the bank is one of them; else 1 if it flickers; else 0, steady.
 */
export function sheenGroup(L, lighting = null) {
  const count = lighting ? lighting.bankCount || 2 : 0;
  if (lighting && Number.isInteger(L.bank) && L.bank >= 0 && L.bank < count) return 2 + L.bank;
  return L.flick ? 1 : 0;
}

/** How much of a group's light is on this frame, from the room's own uniforms (world.js rt.u): the dimmer × its share. */
export function sheenLevel(group, u) {
  const dim = u?.dim?.value ?? 1;
  if (group === 0) return dim;
  if (group === 1) return dim * (u?.flick?.value ?? 1);
  const b = group - 2, banks = u?.banks?.value || [1, 1], more = u?.moreBanks?.value || [0, 0];
  return dim * (b < 2 ? banks[b] ?? 0 : more[b - 2] ?? 0);
}

/**
 * The room's lamps that can shine on its floor, in the room's own frame, in the order the room has them: every ceiling
 * tube (shines straight down), and any other lamp hung at least SHEEN.pointFrom up, as a point. Never the light from
 * next door (`spill`), never a lamp with no colour. Nothing is read but the lamps: no seed.
 * → [{ i, x, y, z, tube, group, rgb: [r, g, b] (its colour, brightest channel 1), k, far2 }]
 */
export function sheenLamps(lights, lighting = null) {
  const out = [];
  (lights || []).forEach((L, i) => {
    if (!L || L.spill || !(L.r + L.g + L.b > 1e-6)) return;
    const tube = !!(L.lobe && L.ay < -0.9);
    if (!tube && !(L.y >= SHEEN.pointFrom)) return;
    // (what the floor mirrors is the tube as it is drawn, as bright as any lit panel, in its colour: not how much light the
    // lamp throws, which is a share of the room's level. So its colour, brightest channel 1)
    const top = Math.max(L.r, L.g, L.b);
    out.push({ i, x: L.x, y: L.y, z: L.z, tube, group: sheenGroup(L, lighting), rgb: [L.r / top, L.g / top, L.b / top], k: L.k, far2: L.far2 });
  });
  return out;
}

/**
 * The lamps this draw loops over, for an eye at (ex, ey, ez) in the room's frame: the n nearest (ties: the earlier in
 * the room's list), each with a weight 1, but fading to 0 as it nears the distance of the first lamp left out, so that
 * one lamp handing its place to another as the eye walks is never seen. → [{ lamp, w }], nearest first.
 */
export function pickSheen(lamps, ex, ey, ez, n = SHEEN.lamps, fade = SHEEN.fade) {
  const d = lamps.map((l, j) => ({ l, j, d: Math.hypot(l.x - ex, l.y - ey, l.z - ez) }));
  d.sort((a, b) => a.d - b.d || a.j - b.j);
  const next = d.length > n ? d[n].d : Infinity;
  return d.slice(0, n).map(({ l, d: di }) => ({ lamp: l, w: Number.isFinite(next) ? Math.max(0, Math.min(1, (next - di) / fade)) : 1 }));
}

const gl = (n) => Number(n).toFixed(8);
/**
 * The shader's half (kit.js FRAG), put in only for a surface given `sheen` (kit.surface): in the camera's space, as the
 * beams are. uSheenP[i]: the tube's middle, w its group; uSheenT[i]: half the tube (0: a point), w the lamp's k (the
 * bake's falloff); uSheenC[i]: its colour at this frame's level × its weight (0: none), w the square of its reach;
 * uSheenK: x strength, y roughness, z 1 if blocky; uSheenUp: the room's up; uSheenE: the mean of the room's tubes at
 * their level (what the wax as a whole mirrors). `normal` is main()'s.
 */
export const SHEEN_GLSL = `
uniform vec4 uSheenP[SHEEN];
uniform vec4 uSheenT[SHEEN];
uniform vec4 uSheenC[SHEEN];
uniform vec4 uSheenK;
uniform vec3 uSheenUp;
uniform vec3 uSheenE;
float sheenShade(float g, vec4 a, vec2 b) { return g < 0.5 ? a.r : g < 1.5 ? a.g : g < 2.5 ? a.b : g < 3.5 ? a.a : g < 4.5 ? b.r : b.g; }
vec3 floorSheen(vec3 n) {
  if (dot(n, uSheenUp) < ${gl(SHEEN.up)}) return vec3(0.0);
  vec3 P = vView;
  #ifdef MAPPED
  if (uSheenK.z > 0.5) {
    // (worked out once per texel of the floor's own picture: its middle, by the screen's own derivatives of where and uv)
    vec2 ts = vec2(textureSize(map, 0)), uq = (floor(vUv * ts) + 0.5) / ts;
    vec3 px = dFdx(vView), py = dFdy(vView); vec2 ux = dFdx(vUv), uy = dFdy(vUv);
    float det = ux.x * uy.y - uy.x * ux.y;
    if (abs(det) > 1e-14) P += ((px * uy.y - py * ux.y) * (uq.x - vUv.x) + (py * ux.x - px * uy.x) * (uq.y - vUv.y)) / det;
  }
  #endif
  vec4 sa = vec4(1.0); vec2 sb = vec2(1.0);
  #if defined(LIGHTMAP) && defined(TUBESHADOW)
  if (floor(vLmRegion + 0.5) == 1.0) {
    vec2 luv = lmUv(1.0); sa = texture2D(uLmA, luv);
    #if defined(BANKS) && BANKS > 2
    sb = texture2D(uLmB, luv).rg;
    #endif
  }
  #endif
  vec3 V = normalize(-P), R = reflect(-V, n), sum = vec3(0.0);
  float a = uSheenK.y;
  // the floor's own frame: along the line of sight (st), across it (sb2)
  vec3 st = V - n * dot(V, n);
  st = dot(st, st) > 1e-8 ? normalize(st) : normalize(cross(n, vec3(1.0, 0.0, 0.0)));
  vec3 sb2 = cross(n, st);
  for (int i = 0; i < SHEEN; i++) {
    vec4 C = uSheenC[i];
    if (C.r + C.g + C.b <= 0.0) continue;
    vec3 T = uSheenT[i].xyz, a0 = uSheenP[i].xyz - T - P, ab = 2.0 * T;
    float rab = dot(R, ab), den = dot(ab, ab) - rab * rab;
    vec3 Ld = a0 + ab * (den > 1e-5 ? clamp((dot(R, a0) * rab - dot(a0, ab)) / den, 0.0, 1.0) : 0.5);
    float d2 = dot(Ld, Ld) + 0.02;
    if (d2 >= C.w) continue;
    float d = sqrt(d2); vec3 L = Ld / d;
    float nl = dot(n, L);
    if (nl <= 0.0) continue;
    // (a tube is a lit area, not a point: what is seen of it in the floor does not fall off as its light on the floor does,
    // it only gets smaller (the lobe, below). Its own reach still ends it, and a tube seen from the side is a little dimmer)
    float fade = 1.0 - d2 / C.w, s = fade * fade / (1.0 + d2 * ${gl(SHEEN.falloff)} / max(uSheenT[i].w, 0.01));
    if (dot(T, T) > 1e-6) s *= ${gl(SHEEN.side)} + ${gl(1 - SHEEN.side)} * nl;
    // (the GGX lobe as a share of its own peak: 1 where the floor mirrors the tube exactly, falling away as the reflected
    // ray misses it; a near tube is a larger patch of ceiling, so its lobe is wider. Times fresnel: what a waxed floor
    // reflects of what it mirrors, nearly nothing looking straight down, most at a graze)
    // (anisotropic: a waxed floor is buffed in every direction, but what it mirrors is smeared most along the line of sight,
    // which is what draws a tube out into a long streak toward the eye; across it the streak keeps the tube's width)
    vec3 H = normalize(L + V);
    float nh = max(dot(n, H), 1e-3), ax = min(1.0, a + ${gl(SHEEN.widen)} / d), ay = min(1.0, ax * ${gl(SHEEN.stretch)});
    float ht = dot(H, st), hb = dot(H, sb2), x = (ht * ht / (ay * ay) + hb * hb / (ax * ax)) / (nh * nh);
    float lobe = 1.0 / ((1.0 + x) * (1.0 + x));
    float F = ${gl(SHEEN.f0)} + ${gl(1 - SHEEN.f0)} * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    sum += C.rgb * (s * lobe * F * sheenShade(uSheenP[i].w, sa, sb));
  }
  // (the wax as a whole: the floor mirrors the lit ceiling and the far end of the room, a little looking down and much at a
  // graze, and more the further off it is (the line of sight is flatter there). The room's tubes' colour at this frame's
  // level; under the tile's own shade, so the joints and scuffs stay dark and the wax lies on the tiles, not in the air)
  float fe = ${gl(SHEEN.f0)} + ${gl(1 - SHEEN.f0)} * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  float far = smoothstep(${gl(SHEEN.envFrom)}, ${gl(SHEEN.envTo)}, length(P));
  float tile = 1.0;
  #ifdef MAPPED
  tile = clamp(dot(texture2D(map, vUv).rgb, vec3(0.3333)) * ${gl(SHEEN.envTile)}, 0.0, 1.0);
  #endif
  // (and only as lit as the floor is there: a doorway's strip or a dark corner mirrors the dark, not the ceiling)
  float lit = clamp(dot(vLit, vec3(0.3333)) * ${gl(SHEEN.envLit)}, 0.0, 1.0);
  sum += uSheenE * (${gl(SHEEN.env)} * fe * (0.1 + 0.9 * far) * tile * lit * (0.5 + 0.5 * sa.r));
  sum *= uSheenK.x;
  float l = dot(sum, vec3(0.3333));
  return l > 1e-6 ? sum * (${gl(SHEEN.knee)} * (1.0 - exp(-l / ${gl(SHEEN.knee)})) / l) : vec3(0.0);
}`;

// where it goes in the kit's fragment shader: its half before main(), its one line just before the colour is written
export const SHEEN_MARK = '// --- floor sheen ---', SHEEN_END = '// --- end floor sheen ---';
const MAIN = 'void main() {', OUT = '  gl_FragColor = vec4(c, uAlpha);\n}';
/**
 * The kit's fragment shader with the sheen put in: SHEEN_GLSL before the last `void main() {`, and `c += floorSheen(normal);`
 * before the last line, each between SHEEN_MARK and SHEEN_END. Taking both blocks out gives back `frag` exactly. Throws
 * if the shader no longer has either place (the kit's shader changed under it).
 */
export function withSheen(frag) {
  const m = frag.lastIndexOf(MAIN), o = frag.lastIndexOf(OUT);
  if (m < 0 || o < 0 || o < m) throw new Error('[sheen] the kit shader changed: no main() or no last line');
  return frag.slice(0, m) + `${SHEEN_MARK}${SHEEN_GLSL}\n${SHEEN_END}\n` + frag.slice(m, o)
    + `  ${SHEEN_MARK}\n  c += floorSheen(normal);\n  ${SHEEN_END}\n` + frag.slice(o);
}
/** The shader with the sheen's blocks taken out (what withSheen put in), for the tests. */
export const withoutSheen = (frag) => frag.replace(/\/\/ --- floor sheen ---[\s\S]*?\/\/ --- end floor sheen ---\n/, '')
  .replace(/ {2}\/\/ --- floor sheen ---\n[\s\S]*? {2}\/\/ --- end floor sheen ---\n/, '');
