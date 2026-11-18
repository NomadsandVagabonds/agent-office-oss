// The Backrooms — the Graphics setting, as plain data. One table says what each tier switches, for the picture
// (vhs.js: how many lines it is drawn at, how much smoothing at the edges, bloom, the grade, the haze) and for the
// bake (kit.js: how strongly corners darken and colour bounces, 0..1). No three.js in here: the tests read it.
//
//   classic   exactly what the level drew before there was a setting: bloom as the host has it, nothing new
//   low       cheaper than classic: fewer lines, less smoothing, no bloom; the grade (it is free) and the darkening
//   medium    the grade, haze, bloom, the bake's darkening and bounce; today's tape, with the scene under it drawn 1.5×
//   high      medium with the scene under the tape drawn 2× and a sharper Clean picture; the tape keeps today's lines (more
//             lines made its wobble and scan lines look thin and digital)
//   auto      medium, stepping down to low when the frames cannot keep up, and back once (autoStep, below)
// The camcorder stays the look: what a tier buys is a richer scene under the tape, not a sharper tape.

export const GRAPHICS = ['classic', 'low', 'medium', 'high', 'auto'];
export const DEFAULT_GRAPHICS = 'classic';
export const GRAPHICS_LABELS = { classic: 'Classic', low: 'Low', medium: 'Medium', high: 'High', auto: 'Auto' };

// lines: the most lines the TAPE has, by Picture level (2 Full VHS, 1 Light VHS; 0 Clean has no line cap, only
// widthCap: the most pixels across). supersample: how much larger than the tape the SCENE is drawn under it at levels
// 1 and 2, then filtered down to the tape's size: fine detail recorded onto a soft medium, the tape's own softness, smear,
// scan lines and noise untouched (1: the scene is drawn at the tape's size, as it always was). sceneCap: the most
// pixels across the scene may be drawn at. msaa: samples at the edges. bloom: true | false | 'host' (as the stage's
// post-processing is: on in the office, off on the dev page and the site). grade, haze, contact, bounce: strengths 0..1.
// shadows: the ceiling tubes' shadows, baked with each room into a small light map of its floor and walls, bank by bank
// (0 or 1; kit.js gfxOf, shadowmap.js). Not at low: a frame pays one lookup for it, but the part being walked into
// pays its bake, and that lands on the weakest machines' main thread while they walk. doorlight: the light of the room
// next door through each doorway, in the same light map, dimmed as the doorway shuts or that room's tubes fail (0 or 1).
// fixtures: each ceiling light the sculpted fitting (ceiling.model.js: a housing let into the ceiling, its tubes, a louvre
// under them) instead of the flat panel, its tile open to show it; the tubes shine and fail as the panel did (0 or 1; world.js).
const TABLE = {
  classic: { lines: { 0: null, 1: 660, 2: 540 }, supersample: 1, sceneCap: 1680, widthCap: 1680, msaa: 4, bloom: 'host', grade: 0, haze: 0, contact: 0, bounce: 0, shadows: 0, doorlight: 0, fixtures: 0 },
  low: { lines: { 0: null, 1: 600, 2: 480 }, supersample: 1, sceneCap: 1280, widthCap: 1280, msaa: 2, bloom: false, grade: 1, haze: 0, contact: 0.7, bounce: 0, shadows: 0, doorlight: 0, fixtures: 0 },
  medium: { lines: { 0: null, 1: 660, 2: 540 }, supersample: 1.5, sceneCap: 1680, widthCap: 1680, msaa: 4, bloom: true, grade: 1, haze: 1, contact: 1, bounce: 0.7, shadows: 1, doorlight: 1, fixtures: 1 },
  high: { lines: { 0: null, 1: 660, 2: 540 }, supersample: 2, sceneCap: 2560, widthCap: 2560, msaa: 4, bloom: true, grade: 1, haze: 1, contact: 1, bounce: 1, shadows: 1, doorlight: 1, fixtures: 1 },
};

// detail: whether what rooms mark as detail (world.js `c.detail`, or `detail: true` to c.mapped and c.shining) is drawn.
// Only low leaves it out; classic draws everything, as it always did (and before the option existed nothing was marked).
for (const [t, on] of Object.entries({ classic: true, low: false, medium: true, high: true })) TABLE[t].detail = on;
/**
 * Show or hide what rooms marked as detail (mesh.userData.detail) under `object`, for a profile: hidden only where the
 * profile says detail: false. Nothing collidable, readable or usable is ever in a detail batch, so this is only
 * `visible`. → how many meshes it changed.
 */
export function showDetail(object, p) {
  const on = p?.detail !== false;
  let changed = 0;
  object?.traverse?.((o) => { if (o.userData?.detail && o.visible !== on) { o.visible = on; changed++; } });
  return changed;
}

// beamShadows: the flashlight casts shadows (beam-shadows.js): the size of its square depth picture, 0 for off (nothing of
// it is made or drawn, and the kit's shader is as it was). Its own lines, so that the table above stays as it is.
const BEAM_SHADOWS = { classic: 0, low: 0, medium: 0, high: 1024 };
for (const t of Object.keys(TABLE)) TABLE[t].beamShadows = BEAM_SHADOWS[t];

// glow: the bloom made only from what shines by itself (glow.js: the tubes and lit pans, signs and every shining batch,
// self-lit voxels), in place of the tier's bloom, which takes anything bright enough, a lit yellow wall included (0 or 1).
// At 0 the camcorder's chain is the one it was: no pass, no picture, no material made. Its own lines, as beamShadows'.
const GLOW = { classic: 0, low: 0, medium: 1, high: 1 };
for (const t of Object.keys(TABLE)) TABLE[t].glow = GLOW[t];

// water: the surface of what a room marked as a liquid (world.js `c.liquid`, liquid.js): depth-tinted, rippled in steps,
// a pale line where it meets things, drawn over a copy of the scene so far (vhs.js splits the scene's draw while one is in
// view). 0 is off: nothing is made, the scene is drawn in one pass, and each room's own sheet is drawn as it was. 2 is
// for the mirror (to come); today 1 and 2 draw the same. Its own lines, as glow's.
const WATER = { classic: 0, low: 0, medium: 1, high: 2 };
for (const t of Object.keys(TABLE)) TABLE[t].water = WATER[t];

// sheen: the ceiling tubes caught as soft streaks on the floors that shine (lino, terrazzo, a pool deck's tile; never
// carpet), worked out in the floor's own shader from the room's own lamps (sheen.rule.js, sheen.js; world.js gives it to
// the batches SHEEN_FLOORS says shine). 0 is off: no define, no uniform, every floor's shader and every baked number as it
// was. Its own lines, as water's.
const SHEEN = { classic: 0, low: 0, medium: 1, high: 1 };
for (const t of Object.keys(TABLE)) TABLE[t].sheen = SHEEN[t];
/**
 * How much each kind of floor shines (0…1), the one place it is said. The kind is what kit.js T.floor draws for a look
 * (floorKind, below: the same choice), or what a room's own batch is (sheenOf). 0: nothing of the sheen is given to it.
 * Carpet of every sort, moss, turf and bare screed do not shine; Records' vinyl and a shopping centre's terrazzo are
 * waxed; a pool deck's glazed tile, always a little wet, most.
 */
/** The one number that turns the whole effect up or down: how bright what a floor mirrors is, times every kind's shininess. */
export const SHEEN_STRENGTH = 4;
export const SHEEN_FLOORS = Object.freeze({ carpet: 0, plush: 0, moss: 0, turf: 0, screed: 0, lino: 0.5, terrazzo: 0.6, pooltile: 0.85 });
/** What kit.js T.floor(look) draws, as a kind of floor: the kinds it knows, anything else carpet (as T.floor does). */
export const floorKind = (look) => (['moss', 'terrazzo', 'turf', 'lino', 'screed', 'plush'].includes(look?.floor) ? look.floor : 'carpet');
// batches a room draws itself that are a kind of floor, by the start of their key: the waterpark's dry deck round a basin
// (waterpark.js createBasin; the basin's bed and walls are under water and keys of their own). A room may instead say it of
// a batch: c.mapped(key, texture, { sheen: 'lino' }) or { sheen: 0.4 } (world.js), which wins over both.
export const SHEEN_KEYS = Object.freeze([Object.freeze(['wp:btile:', 'pooltile'])]);
/**
 * How much a room's mapped batch shines (0…1): opt.sheen (a kind, or a number) if the room said; the theme's floor if
 * the batch is drawn with the floor's own texture (isFloorTexture); a key SHEEN_KEYS knows; else 0.
 */
export function sheenOf(key, isFloorTexture, look, opt = {}) {
  const v = opt?.sheen;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  if (typeof v === 'string') return SHEEN_FLOORS[v] ?? 0;
  if (isFloorTexture) return SHEEN_FLOORS[floorKind(look)] ?? 0;
  const hit = SHEEN_KEYS.find(([prefix]) => String(key).startsWith(prefix));
  return hit ? SHEEN_FLOORS[hit[1]] ?? 0 : 0;
}

export const cleanGraphics =(v) => (GRAPHICS.includes(v) ? v : DEFAULT_GRAPHICS);

/** Everything a tier switches, as a fresh plain object. 'auto' reads as where it starts (medium); anything else as classic. */
export function profile(tier) {
  const t = tier === 'auto' ? 'medium' : TABLE[tier] ? tier : DEFAULT_GRAPHICS;
  const p = TABLE[t];
  return { tier: t, ...p, lines: { ...p.lines } };
}

/** Is bloom on, for a profile, in a host whose own post-processing is (hostBloom) or is not. */
export const bloomOn = (p, hostBloom) => (p.bloom === 'host' ? !!hostBloom : !!p.bloom);

/**
 * The size the camcorder draws the level at, and the picture's size in the window (device pixels), for a window of
 * w × h CSS pixels at `ratio` device pixels to one. Level 2 and 1: a 4:3 picture of at most `lines` lines (never fewer
 * than 300); level 0: the whole window, at most widthCap across. sw × sh: the size the scene is drawn at under the tape
 * (iw × ih unless the profile supersamples, and then never smaller and at most sceneCap across).
 */
export function internalSize(w, h, ratio, level, p = profile(DEFAULT_GRAPHICS)) {
  const cw = w * ratio, ch = h * ratio;
  let pw = cw, ph = ch, iw, ih;
  if (level > 0) {
    pw = Math.min(cw, (ch * 4) / 3); ph = (pw * 3) / 4;
    ih = Math.round(Math.max(300, Math.min(ph, p.lines[level === 2 ? 2 : 1]))); iw = Math.round((ih * 4) / 3);
  } else { const k = Math.min(1, p.widthCap / cw); iw = Math.round(cw * k); ih = Math.round(ch * k); }
  let sw = iw, sh = ih;
  if (level > 0 && p.supersample > 1) { sw = Math.max(iw, Math.min(Math.round(iw * p.supersample), p.sceneCap)); sh = Math.round((sw * ih) / iw); }
  return { cw, ch, pw, ph, iw, ih, sw, sh };
}

/** A rough cost of drawing one frame at a Picture level, in units of a classic Full VHS frame; for comparing tiers. */
export function cost(p, level = 2, w = 1280, h = 800, ratio = 2) {
  const { iw, ih, sw, sh } = internalSize(w, h, ratio, level, p), base = internalSize(w, h, ratio, 2, TABLE.classic);
  const px = (sw * sh) / (base.iw * base.ih), tape = (iw * ih) / (base.iw * base.ih);
  // (glow: its chain costs about what the tier's bloom does, and its picture is only what shines drawn once more, at a
  // quarter of the pixels: about a sixth of the scene's draws, glow.js)
  return px * (0.55 + 0.1 * p.msaa) + tape * ((p.bloom === true || p.glow > 0 ? 0.35 : 0) + 0.04 * p.grade + 0.12 * (p.haze > 0 ? 1 : 0)) + (sw > iw ? 0.1 * tape : 0)
    + (p.glow > 0 ? (px * 0.25 * 0.55) / 6 : 0);
}

// 'auto': start at medium; step down to low once frames have stayed slow, back up once if they stay quick.
export const AUTO = { slowMs: 24, slowFor: 3, quickMs: 13, quickFor: 10, gap: 15, most: 3, ups: 1 };

/** Where 'auto' starts. */
export const autoStart = () => ({ tier: 'medium', changes: 0, ups: 0, lastChange: -Infinity, slowSince: null, quickSince: null });

/**
 * One look at the frame time. `now` in seconds, `frameMs` the stage's smoothed milliseconds a frame; `busy` while the
 * level is building something (the next part) and its frames say nothing about the picture. Pure: returns the next
 * state; `changed` when its tier is not the one it was. Never more than `most` changes a visit, never two within `gap`
 * seconds, never back up more than `ups` times; never below low or above medium. The Picture level is not its to touch.
 */
export function autoStep(s, now, frameMs, busy = false, k = AUTO) {
  const n = { ...s };
  if (busy || !Number.isFinite(frameMs)) { n.slowSince = n.quickSince = null; return { ...n, changed: false }; }
  n.slowSince = frameMs > k.slowMs ? (n.slowSince ?? now) : null;
  n.quickSince = frameMs < k.quickMs ? (n.quickSince ?? now) : null;
  const may = n.changes < k.most && now - n.lastChange >= k.gap;
  let next = n.tier;
  if (may && n.tier === 'medium' && n.slowSince !== null && now - n.slowSince >= k.slowFor) next = 'low';
  else if (may && n.tier === 'low' && n.ups < k.ups && n.quickSince !== null && now - n.quickSince >= k.quickFor) next = 'medium';
  if (next === n.tier) return { ...n, changed: false };
  return { ...n, tier: next, changes: n.changes + 1, ups: n.ups + (next === 'medium' ? 1 : 0), lastChange: now, slowSince: null, quickSince: null, changed: true };
}

// A grade that changes nothing, for a kind of floor that has none of its own. hazeK: times the tier's haze strength;
// hazeFrom: metres from the eye before the haze begins (vhs.js; 8 is where it has always begun)
export const NEUTRAL_GRADE = Object.freeze({ lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1, haze: [0.8, 0.78, 0.72], hazeK: 1, hazeFrom: 8 });
// how far a kind of floor may move its haze: none to twice the tier's; from the eye out to 30 m
export const HAZE_K_RANGE = Object.freeze([0, 2]);
export const HAZE_FROM_RANGE = Object.freeze([0, 30]);
/** A theme's grade (themes.js `grade`), every number present. */
export function gradeOf(theme) {
  const g = (theme && theme.grade) || {};
  const tri = (v, d) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v.slice() : d.slice());
  const num = (v, d, [lo, hi]) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  return { lift: tri(g.lift, NEUTRAL_GRADE.lift), gamma: tri(g.gamma, NEUTRAL_GRADE.gamma), gain: tri(g.gain, NEUTRAL_GRADE.gain),
    sat: Number.isFinite(g.sat) ? g.sat : 1, haze: tri(g.haze, NEUTRAL_GRADE.haze),
    hazeK: num(g.hazeK, NEUTRAL_GRADE.hazeK, HAZE_K_RANGE), hazeFrom: num(g.hazeFrom, NEUTRAL_GRADE.hazeFrom, HAZE_FROM_RANGE) };
}
