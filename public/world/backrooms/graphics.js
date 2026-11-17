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

export const cleanGraphics = (v) => (GRAPHICS.includes(v) ? v : DEFAULT_GRAPHICS);

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
  return px * (0.55 + 0.1 * p.msaa) + tape * ((p.bloom === true ? 0.35 : 0) + 0.04 * p.grade + 0.12 * (p.haze > 0 ? 1 : 0)) + (sw > iw ? 0.1 * tape : 0);
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

// A grade that changes nothing, for a kind of floor that has none of its own.
export const NEUTRAL_GRADE = Object.freeze({ lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1, haze: [0.8, 0.78, 0.72] });
/** A theme's grade (themes.js `grade`), every number present. */
export function gradeOf(theme) {
  const g = (theme && theme.grade) || {};
  const tri = (v, d) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v.slice() : d.slice());
  return { lift: tri(g.lift, NEUTRAL_GRADE.lift), gamma: tri(g.gamma, NEUTRAL_GRADE.gamma), gain: tri(g.gain, NEUTRAL_GRADE.gain),
    sat: Number.isFinite(g.sat) ? g.sat : 1, haze: tri(g.haze, NEUTRAL_GRADE.haze) };
}
