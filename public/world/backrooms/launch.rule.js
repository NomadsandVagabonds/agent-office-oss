// The Backrooms — the graphics screen at launch (launch.js), as plain rules: what it offers, when a machine holds a
// tier, which tier Auto picks from what it measured, and what is remembered of the choice. No DOM, no three.js: the
// tests read it.
//
// The owner, 20 Nov: "graphics are important enough that maybe it is a screen right at launch... static and then the
// graphics selector with auto choosing what it thinks is best. I really want more people to experience high if possible
// because it is sooooo much more immersive." So Auto measures, it does not guess: the level itself is drawn behind the
// static at the top tier (High, or Ultra once there is one), then each lower one only while none has held, and the first
// that holds is the pick. What is left is Low.
import { GRAPHICS } from './graphics.js';

// (Ultra, once graphics.js has it, is offered and measured with the rest, first of all: nothing more to change here)
const ULTRA = GRAPHICS.includes('ultra') ? ['ultra'] : [];
/** The tiers the screen offers, lowest first, after Auto. Classic stays in Settings. */
export const LAUNCH_TIERS = Object.freeze(['low', 'medium', 'high', ...ULTRA]);
/** Where the choice is remembered: once there is one, the screen is not shown again until Settings asks for it. */
export const LAUNCH_KEY = 'blockrooms:graphics';
/** Tried top down; the first that holds is Auto's. Low is never measured: it is what is left. */
export const BENCH_ORDER = Object.freeze([...ULTRA, 'high', 'medium']);

/**
 * The benchmark. tape: the building drawn behind the static (a fixed one, so that the walk is the same on any machine;
 * Floor 1 of tape 7 is the yellow office the shots in docs/webgpu are of). landMs: how long it may take to be built and
 * landed in before Auto gives up on it and says Low (a machine that takes this long to build one floor is not one for
 * High). settleS: drawn and not counted, after a tier is put on (its shaders are made then, and the first frames say
 * nothing). measureS: counted. sweepS: one turn of the view, so that the whole room is drawn, not one wall.
 * A tier holds when half its frames take at most medianMs (40 a second) and nine in ten at most p90Ms (25 a second): a
 * smooth frame rate, and on the generous side of one, since the owner wants as many people on High as can be.
 */
export const BENCH = Object.freeze({ tape: '7', landMs: 20000, settleS: 0.8, measureS: 2, sweepS: 5, medianMs: 25, p90Ms: 40, minFrames: 20 });

/** The time between frames, in milliseconds, summed up. → { frames, median, p90, fps } (null numbers for no frames). */
export function frameStats(ms) {
  const list = (Array.isArray(ms) ? ms : []).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!list.length) return { frames: 0, median: null, p90: null, fps: null };
  const at = (q) => list[Math.min(list.length - 1, Math.floor(q * list.length))];
  const mean = list.reduce((a, b) => a + b, 0) / list.length;
  const r = (v) => Math.round(v * 10) / 10;
  return { frames: list.length, median: r(at(0.5)), p90: r(at(0.9)), fps: r(1000 / mean) };
}

/** Does a tier's measurement hold a smooth frame rate. */
export const holds = (stats, k = BENCH) => !!stats && stats.frames >= k.minFrames && stats.median <= k.medianMs && stats.p90 <= k.p90Ms;

/**
 * Auto's pick from what was measured, `results` [{ tier, stats }] in BENCH_ORDER: the first tier that holds, else Low.
 * With nothing measured at all (the benchmark could not be run: no frames, an error) it is 'auto', the in-game setting
 * that starts at Medium and steps down to Low when the frames cannot keep up (graphics.js autoStep).
 */
export function autoPick(results) {
  const list = Array.isArray(results) ? results.filter((r) => r && r.stats?.frames > 0) : [];
  if (!list.length) return 'auto';
  for (const tier of BENCH_ORDER) { const r = list.find((x) => x.tier === tier); if (r && holds(r.stats)) return tier; }
  return 'low';
}

/** What the screen remembers, cleaned: { tier, auto, picked } or null. tier: what was chosen (a Graphics setting);
 * auto: whether it was Auto's; picked: what Auto picked, if it measured. */
export function cleanLaunchRecord(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || !GRAPHICS.includes(v.tier)) return null;
  return { tier: v.tier, auto: v.auto === true, picked: GRAPHICS.includes(v.picked) ? v.picked : null };
}
