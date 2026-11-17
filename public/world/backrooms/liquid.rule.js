// The Backrooms — water (the Graphics setting's `water`, graphics.js): the numbers, the small decisions and the shader
// text of the surface that replaces a room's water sheet at Medium and High. No three.js in here: the tests read it,
// and liquid.js draws with it.
//
// A room marks a sheet it drew as a liquid's surface (world.js `c.liquid`). Where the tier has water and the sheet is
// flat, liquid.js puts a second mesh on the same geometry with this surface, and the camcorder draws the scene in two
// halves while one is in view (vhs.js): everything opaque, then a copy of that picture and its depth, then the water
// (reading the copy), then everything see-through, then what is held. The surface:
//   - what is under it, seen through it: the copy's colour, nudged by the ripple, darkened and tinted by how much water
//     the eye looks through to reach it (the copy's depth less the surface's), red going first, so a bed goes
//     blue-green with depth and what stands in it (floats, legs) shows under the surface;
//   - a pale line where the surface meets what walls it in or stands in it (the copy's depth just behind the surface);
//   - a ripple stepped to cells of the room's own frame (not the world's grid): a height worked out at the middle of a
//     cell and its neighbours, the slope between them stepped, so it moves in blocks; a room's phase drifts it;
//   - fresnel toward a flat tint of the room's light (reflection(): where the mirror's sample will go, later);
//   - lit by the room's light as the old sheet was, its own baked light with the room's dimmer, flicker and banks: a
//     pool in a room that has gone dark is dark.
// No wake yet: the rings' uniforms are there (uRings, uRingN) and none is ever set.

export const LIQUID = Object.freeze({
  flat: 0.01,         // metres: a sheet is flat if its corners span less than this, up and down, in its room's frame
  under: 0.02,        // metres: the eye below the surface plus this is under it (the room's own sheet and veil are drawn)
  hold: 0.5,          // seconds the two-part draw is kept after the last frame a surface was in view
  margin: 0.05,       // metres the surface's box is grown by, up and down, for that test (the ripple and the line)
  cell: 0.05,         // metres: the ripple's cells, in the room's frame
  ripple: 2.5,        // the slow waves' height, of the look-dev lab's
  slopeStep: 0.03,    // the ripple's slope is stepped to this
  sharp: Object.freeze([2, 6]),   // pixels a cell spans where its slope starts to show, and shows in full (smaller cells, far off, lie flat: no speckle)
  refract: 0.5,       // how far the ripple's tilt moves what is seen under it, of the picture, per metre of water
  refractMost: 0.4,   // (metres of water past which it moves no further)
  edge: 0.06,         // metres: water this thin over what is behind it is the line where it meets something (fading out from half of it)
  edgeMix: 0.85,
  edgeColor: Object.freeze([0.86, 0.95, 0.97]),
  f0: 0.02,           // the share it mirrors looking straight down
  sky: 0.1,           // the flat tint it mirrors, of the room's light at the surface
  drift: Object.freeze([0.06, 0.02]),   // metres the ripple moves for each unit of a room's phase
  absorb: 0.15,       // per metre: how fast the clearest channel goes, through a sheet as see-through as the waterpark's
  absorbAlpha: 0.52,  // (the old sheet's opacity that absorb is for: a murkier sheet absorbs much faster, as the seventh power:
  murkPower: 7,       //  the green rooms' 0.63 and 0.82 sheets stay murk, the waterpark's 0.52 and 0.56 stay clear)
  absorbSpread: 4,    // how much faster the channels the water's tint has least of go
  deep: 0.3,          // what a long way through it looks like, of the sheet's own colour (lit by the room)
  scatter: 0.3,       // the water's own colour, lit by the room, that even a little of it gives (of the sheet's colour): a pool
  scatterDepth: 4,    //  reads as coloured water over its bed, not as clear glass (per metre: e^- of how fast it comes in)
  scatterFade: 0.5,   //  and per metre it gives way again to what is behind it, so a deep pool is not a fog
  keep: 0.3,          // per metre: however much it absorbs, a clear sheet's water lets at least e^-(this × murk²) of what is
                      //  behind it through in the water's own colours (2 m of the waterpark's: 55 % in its clearest channel)
  glowKeep: 0.6,      // of what water takes off something that lights itself (brighter than the room's light there), given back
  saturate: 1.6,      // (the sheet's picture averages its pale caustic lines in: its colour is pushed back out by this)
  // the caustics: light playing on what is under the water, worked out where the eye's ray reaches it (no picture read).
  // Two layers of an iterated wave pattern at different scales, moving with the clock in different directions; where
  // their bright lines cross they are brighter. On 5 cm cells, bent by the ripple's slope, softer and wider with depth
  caustic: 1.3,       // how much brighter the brightest of it makes what it lands on (it only ever brightens, never tints)
  causticCell: 0.05,  // metres: its cells, in the room's frame
  causticScale: Object.freeze([8.3, 5.9]),   // the two layers' scales (radians per metre; never a whole multiple of each other)
  causticSpeed: Object.freeze([0.9, 0.67]),  // and how fast each changes shape with the clock
  causticBend: 1.5,   // how far the ripple's slope moves it, per metre of water over it
  causticSharp: Object.freeze([8, 3]),       // how sharp its lines are in shallow water, and at 2 m (lower is softer and wider)
  causticFade: 0.35,  // per metre of a clear sheet's water it fades by (e^-, times the murk squared: the dark pools show none)
  causticDrift: Object.freeze([0.06, 0.02]), // metres it drifts for each unit of a room's phase, as the ripple does
  rings: 8,           // (the wake's slots: none used yet)
  fallbackTint: Object.freeze([0.03, 0.24, 0.3]),  // linear, for a sheet whose picture cannot be read
});

/** The flat test: the lowest and highest a sheet's corners sit in its room's frame. → { flat, y, height } */
export function flatness(minY, maxY, k = LIQUID) {
  const height = maxY - minY;
  return { flat: Number.isFinite(height) && height < k.flat, y: (minY + maxY) / 2, height };
}

/** Is the eye (its height in the surface's room frame) under a surface at planeY? */
export const underwater = (eyeY, planeY, k = LIQUID) => eyeY < planeY + k.under;

/**
 * The two-part draw's hold: `seen` this frame or not, at time `now` (seconds of the camcorder's own clock). → the next
 * state { last, split }: split while a surface has been in view within the last `hold` seconds, so the draw does not
 * flicker between the two ways at the edge of the picture. `force`: 'split' or 'single' (the dev page's, for checking).
 */
export function holdStep(state, now, seen, force = null, k = LIQUID) {
  const last = seen ? now : state?.last ?? -Infinity;
  const split = force === 'split' ? true : force === 'single' ? false : now - last < k.hold;
  return { last, split };
}

/** sRGB (0…1) to linear, as the picture's texture is read. */
export const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * The water's own colours, from the sheet it replaces: `tint` its picture's average (linear) times its vertex colour,
 * `alpha` its opacity. → { deep, absorb }: deep is what a long way through it looks like (lit by the room), absorb how
 * fast each channel goes per metre (the channels the tint has least of first, and all faster in a murkier sheet).
 */
export function waterColours(tint, alpha = LIQUID.absorbAlpha, k = LIQUID) {
  const t = Array.isArray(tint) && tint.length === 3 && tint.every((v) => Number.isFinite(v) && v >= 0) && Math.max(...tint) > 0 ? tint : k.fallbackTint;
  const grey = 0.299 * t[0] + 0.587 * t[1] + 0.114 * t[2];
  const c = t.map((v) => Math.max(0, grey + (v - grey) * k.saturate));
  const top = Math.max(...c, 1e-6), murk = Math.pow(Math.max(0.2, Math.min(1, alpha)) / k.absorbAlpha, k.murkPower);
  return { deep: c.map((v) => v * k.deep), scatter: c.map((v) => v * k.scatter), keep: c.map((v) => v / top), keepRate: k.keep * murk * murk, absorb: c.map((v) => k.absorb * murk * (1 + k.absorbSpread * (1 - v / top))) };
}

const f = (n) => Number(n).toFixed(6);
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;

/** The vertex shader: the sheet's own baked light (kit.js VERT's sum, the same attributes and uniforms), where it is in its room. */
export const LIQUID_VERT = `
attribute vec3 aLit;
#ifdef BANKS
attribute vec3 aBank0;
attribute vec3 aBank1;
uniform vec2 uBanks;
#if BANKS > 2
attribute vec3 aBank2;
uniform vec2 uMoreBanks;
#endif
#if BANKS > 3
attribute vec3 aBank3;
#endif
#endif
#ifdef FLICK
attribute vec3 aFlk;
#endif
uniform float uFlick;
uniform float uDim;
uniform vec3 uTint;
uniform mat4 uToRoom;
varying vec3 vLit;
varying vec3 vRoom;
varying vec3 vView;
void main() {
  vec3 lit = aLit;
  #ifdef BANKS
  lit += aBank0 * uBanks.x + aBank1 * uBanks.y;
  #if BANKS > 2
  lit += aBank2 * uMoreBanks.x;
  #endif
  #if BANKS > 3
  lit += aBank3 * uMoreBanks.y;
  #endif
  #endif
  #ifdef FLICK
  lit += aFlk * uFlick;
  #endif
  vLit = lit * uDim * uTint;
  vRoom = (uToRoom * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

/** The fragment shader. tScene and tDepth: the copy of the scene drawn so far (everything opaque), at its size uSize. */
export const LIQUID_FRAG = `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform vec2 uSize;
uniform vec2 uClip;
uniform float uTime;
uniform float uPhase;
uniform mat3 uRoomToView;
uniform vec3 uDeep;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform vec4 uKeep;
uniform float uCaustic;
uniform vec3 uEyeRoom;
uniform vec4 uRings[${LIQUID.rings}];
uniform int uRingN;
varying vec3 vLit;
varying vec3 vRoom;
varying vec3 vView;
float liquidDepth(float d) { return uClip.x * uClip.y / (uClip.y - d * (uClip.y - uClip.x)); }
// the surface's height at p (the room's frame, metres): a few slow waves, drifted by the room's phase
float liquidHeight(vec2 p) {
  vec2 q = p - vec2(${f(LIQUID.drift[0])}, ${f(LIQUID.drift[1])}) * uPhase;
  float h = ${f(LIQUID.ripple)} * (0.006 * sin(q.x * 3.1 + uTime * 1.3) + 0.005 * sin(q.y * 2.3 - uTime * 1.1) + 0.003 * sin((q.x + q.y) * 5.7 + uTime * 2.1));
  // (the wake's rings, x, z, age, strength: none is set yet)
  for (int i = 0; i < ${LIQUID.rings}; i++) {
    if (i >= uRingN) break;
    vec4 w = uRings[i];
    float r = length(p - w.xy), front = w.z * 0.55;
    h += 0.05 * exp(-pow((r - front) * 9.0, 2.0)) * w.w * exp(-w.z * 1.1) / (1.0 + r * 2.0) * sin((r - front) * 40.0);
  }
  return h;
}
// what the surface mirrors, for a normal and the way to the eye (view space), at this pixel: for now a flat tint of the
// room's light where it is (the mirror's sample takes its place later)
vec3 reflection(vec3 n, vec3 v, vec2 uv, vec3 light) { return light * ${f(LIQUID.sky)}; }
// one layer of the caustics at q (radians), at s: a net of wavy lines (where a warped sum of two waves is near nought)
// whose warp moves with s, so its lines bend, meet and part and never hold one shape. 1 on a line, falling to 0 off it
float causticLayer(vec2 q, float s, float sharp) {
  vec2 w = q + 0.9 * vec2(sin(q.y * 1.3 + s), sin(q.x * 1.1 - s * 0.8));
  float f = sin(w.x) + sin(w.y);
  return exp(-f * f * sharp);
}
// the caustics where the ray reaches what is under the water (p: the room's frame), 0…1, after thick metres of water
// whose ripple has that slope there: two layers, turned against each other and at scales that never line up, brighter
// where their lines cross
float caustic(vec2 p, vec2 slope, float thick) {
  vec2 q = p + slope * ${f(LIQUID.causticBend)} * thick - vec2(${f(LIQUID.causticDrift[0])}, ${f(LIQUID.causticDrift[1])}) * uPhase;
  q = (floor(q / ${f(LIQUID.causticCell)}) + 0.5) * ${f(LIQUID.causticCell)};
  float e = mix(${f(LIQUID.causticSharp[0])}, ${f(LIQUID.causticSharp[1])}, clamp(thick * 0.5, 0.0, 1.0));
  float a = causticLayer(mat2(0.8, -0.6, 0.6, 0.8) * q * ${f(LIQUID.causticScale[0])}, uTime * ${f(LIQUID.causticSpeed[0])}, e);
  float b = causticLayer(mat2(0.28, 0.96, -0.96, 0.28) * q * ${f(LIQUID.causticScale[1])} + vec2(13.7, 5.1), uTime * ${f(LIQUID.causticSpeed[1])} + 2.3, e);
  return clamp(0.35 * (a + b) + a * b, 0.0, 1.0);
}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  // the ripple, on cells of the room's own frame: the slope between this cell and its neighbours, stepped
  const float cell = ${f(LIQUID.cell)};
  vec2 c = (floor(vRoom.xz / cell) + 0.5) * cell;
  float h0 = liquidHeight(c), hx = liquidHeight(c + vec2(cell, 0.0)), hz = liquidHeight(c + vec2(0.0, cell));
  vec2 slope = floor(vec2(hx - h0, hz - h0) / cell / ${f(LIQUID.slopeStep)} + 0.5) * ${f(LIQUID.slopeStep)};
  // (far off, where a cell is a pixel or two, the steps would only be speckle: there it lies flat)
  vec2 fw = fwidth(vRoom.xz);
  slope *= clamp((cell / max(max(fw.x, fw.y), 1e-5) - ${f(LIQUID.sharp[0])}) / ${f(LIQUID.sharp[1] - LIQUID.sharp[0])}, 0.0, 1.0);
  vec3 up = normalize(uRoomToView * vec3(0.0, 1.0, 0.0));
  vec3 n = normalize(uRoomToView * normalize(vec3(-slope.x, 1.0, -slope.y)));
  vec3 v = normalize(-vView);
  vec2 bend = (n - up).xy;                                   // (only the ripple's tilt moves what is under it)
  // how much water the eye looks through to what is under it: along the ray, from the surface to the copy's depth
  float zw = -vView.z, ray = length(vView) / max(zw, 1e-4);
  float behind = max(liquidDepth(texture2D(tDepth, uv).x) - zw, 0.0) * ray;
  vec2 ruv = clamp(uv + bend * ${f(LIQUID.refract)} * min(behind, ${f(LIQUID.refractMost)}), vec2(0.5) / uSize, vec2(1.0) - vec2(0.5) / uSize);
  float rd = texture2D(tDepth, ruv).x, thick = behind;
  // (the ripple never fetches what is above the water: where the nudged pixel is in front of the surface, it is not nudged)
  if (rd < gl_FragCoord.z) ruv = uv;
  else thick = max(liquidDepth(rd) - zw, 0.0) * ray;
  vec3 under = texture2D(tScene, ruv).rgb;
  vec3 light = vLit;
  // (something that lights itself, a drowned screen: brighter than the room's light here, before the net is laid on)
  float lit = dot(under, vec3(0.299, 0.587, 0.114)) / max(dot(light, vec3(0.299, 0.587, 0.114)), 0.05);
  // light playing on the bed where the ray reaches it, fading with the water over it (and far faster in a murky one).
  // It only brightens what it lands on: what is under keeps its own colour
  vec3 dir = normalize(vRoom - uEyeRoom);
  float k = caustic(vRoom.xz + dir.xz * thick, slope, thick) * exp(-${f(LIQUID.causticFade / LIQUID.keep)} * uKeep.w * thick);
  under *= 1.0 + uCaustic * k;
  // (uKeep: the water's own colours, scaled to its clearest, and how fast what it lets through at least falls)
  vec3 T = max(exp(-uAbsorb * thick), uKeep.rgb * exp(-uKeep.w * thick));
  // (and keeps more of its light than the water would leave it)
  T = mix(T, vec3(1.0) - (vec3(1.0) - T) * ${f(1 - LIQUID.glowKeep)}, smoothstep(0.9, 1.6, lit));
  vec3 col = under * T + uDeep * light * (1.0 - T)
    + uScatter * light * (1.0 - exp(-${f(LIQUID.scatterDepth)} * thick)) * exp(-${f(LIQUID.scatterFade)} * thick);
  float F = ${f(LIQUID.f0)} + ${f(1 - LIQUID.f0)} * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  col = mix(col, reflection(n, v, uv, light), F);
  // the line where it meets what walls it in or stands in it, as bright as the room and what is under it
  float edge = 1.0 - smoothstep(${f(LIQUID.edge * 0.5)}, ${f(LIQUID.edge)}, behind);
  float seen = clamp(0.7 * dot(light, vec3(0.333)) + 0.5 * dot(under, vec3(0.4)), 0.0, 1.5);
  col = mix(col, ${v3(LIQUID.edgeColor)} * seen, edge * ${f(LIQUID.edgeMix)});
  gl_FragColor = vec4(col, 1.0);
}`;

/** The copy: the scene's colour and depth as they are, into a plain pair at the same size. */
export const COPY_FRAG = `
uniform sampler2D tColor;
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(tColor, vUv);
  gl_FragDepthEXT = texture2D(tDepth, vUv).x;
}`;
