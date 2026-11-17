// The sums behind the dev page's &perf=1 read-out and &bench=1 tour (perf.js), kept apart from the page so that Node can
// test them: no DOM, no three, nothing random. Times are milliseconds unless a name says seconds.

/** How far back the read-out looks, and how often it is redrawn. */
export const WINDOW_MS = 5000, REDRAW_MS = 250;
/** The tour's clock, in seconds: settle after each jump (not measured), then measure standing still or turning round. */
export const SETTLE_S = 1, START_HOLD_S = 2, DOOR_HOLD_S = 1.5, SPIN_S = 4;
/** The query flags that change what is drawn (or how big), and so belong with any number the tour prints. (`tape` is the
 * seed on the BlockRooms site, tools/blockrooms/site.js under ?debug.) */
export const DRAW_FLAGS = Object.freeze(['seed', 'tape', 'vhs', 'dpr', 'fx', 'lighting', 'barricades', 'inventory', 'pursuer', 'wake', 'themes',
  'depth', 'depths', 'room', 'only', 'count', 'cast', 'supplies', 'loot', 'study']);

/** The p-th percentile (0..100) of numbers already sorted ascending, by nearest rank: always one of the samples. */
export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const rank = Math.ceil((Math.max(0, Math.min(100, p)) / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

const round = (v, k = 10) => (v === null || !Number.isFinite(v) ? null : Math.round(v * k) / k);

/** Mean, p50, p95, p99 and worst (the largest) of a list of numbers; all null for an empty list. */
export function summarize(values) {
  const list = values.filter(Number.isFinite), sorted = list.slice().sort((a, b) => a - b);
  const mean = list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
  return { n: list.length, mean: round(mean), p50: round(percentile(sorted, 50)), p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)), worst: round(sorted.length ? sorted[sorted.length - 1] : null) };
}

/** Mean and largest of a count (draw calls, triangles), whole numbers. */
export function countStats(values) {
  const list = values.filter(Number.isFinite);
  return { mean: list.length ? Math.round(list.reduce((s, v) => s + v, 0) / list.length) : null, max: list.length ? Math.max(...list) : null };
}

/**
 * The tour of one generated floor (`level` as gen.js makes it: `rooms` with id, kind, arch, D): where you land, then every
 * oddity in the order the level lists them, each twice — just inside the door looking in, standing still, and from its
 * centre, turning one full circle. Positions are in the room's own frame (as the handle's goto takes them: z = D/2 is the
 * door you come in by, yaw 0 looks in), so the same seed always gives the same list.
 */
export function stations(level) {
  const out = [];
  const start = level.rooms.find((r) => r.kind === 'start');
  if (start) out.push({ room: start.id, arch: 'start', what: 'centre', x: 0, z: 0, yaw: 0, spin: 0, settle: SETTLE_S, hold: START_HOLD_S });
  for (const r of level.rooms) {
    if (r.kind !== 'special') continue;
    out.push({ room: r.id, arch: r.arch, what: 'door', x: 0, z: Math.round((r.D / 2 - 0.9) * 100) / 100, yaw: 0, spin: 0, settle: SETTLE_S, hold: DOOR_HOLD_S });
    out.push({ room: r.id, arch: r.arch, what: 'centre', x: 0, z: 0, yaw: 0, spin: Math.PI * 2, settle: SETTLE_S, hold: SPIN_S });
  }
  return out;
}

/** Seconds the tour takes, not counting the wait for the floor to be ready. */
export const tourSeconds = (list) => list.reduce((s, st) => s + st.settle + st.hold, 0);

/** Where the camera looks `t` seconds into a station's measured part: its yaw in the room's frame, turning evenly. */
export const yawAt = (st, t) => st.yaw + st.spin * Math.max(0, Math.min(1, t / st.hold));

/** The query flags from DRAW_FLAGS that a page was opened with, as strings. */
export function drawFlags(params) {
  const out = {};
  for (const k of DRAW_FLAGS) if (params.has(k)) out[k] = params.get(k);
  return out;
}

/**
 * One bench result from what the tour recorded. `frames` are `{ ms, calls, tris, station }`: the interval from one frame to
 * the next, what the scene pass drew in it, and which station it was measured at (an index into `list`). `stood` is the id of
 * the room the camera was really in at each station (the handle's where()), to catch a jump that did not land.
 */
export function benchReport({ seed, flags = {}, ua = '', gpu = null, sizes = {}, list = [], frames = [], stood = [], seconds = null, aborted = null, stress = null }) {
  const of = (fs) => ({ frames: fs.length, ms: summarize(fs.map((f) => f.ms)), calls: countStats(fs.map((f) => f.calls)), tris: countStats(fs.map((f) => f.tris)) });
  return {
    bench: 1, seed: String(seed), flags, ua, gpu, sizes, seconds: round(seconds), aborted, stress,
    stations: list.map((st, i) => ({ i, room: st.room, arch: st.arch, what: st.what, stood: stood[i] ?? null, ...of(frames.filter((f) => f.station === i)) })),
    overall: of(frames),
  };
}

const ms = (s) => (s.mean === null ? '–' : `${s.mean}/${s.p95}/${s.worst}`);
const k = (n) => (n === null ? '–' : n >= 10000 ? `${Math.round(n / 1000)}k` : String(n));

/** A few short lines of a bench result, for the read-out: small enough to screenshot on a phone and still read. */
export function summaryText(r) {
  const o = r.overall, s = r.sizes || {};
  const lines = [
    `bench seed ${r.seed}${r.aborted ? ` · STOPPED: ${r.aborted}` : ''} · ${Object.entries(r.flags).filter(([key]) => key !== 'seed' && key !== 'tape').map(([key, v]) => `${key}=${v}`).join(' ') || 'defaults'}`,
    `${r.gpu || 'renderer unknown'}`,
    `picture ${s.picture || '?'} · canvas ${s.canvas || '?'} · dpr ${s.dpr ?? '?'} (device ${s.devicePixelRatio ?? '?'}) · vhs ${s.vhs ?? '?'}`,
    `ALL ${o.frames} frames · ms mean ${o.ms.mean} p50 ${o.ms.p50} p95 ${o.ms.p95} p99 ${o.ms.p99} worst ${o.ms.worst}`,
    `    draws ${k(o.calls.mean)}/${k(o.calls.max)} · tris ${k(o.tris.mean)}/${k(o.tris.max)} (mean/max)`,
    'station          ms mean/p95/worst  draws  tris',
    ...r.stations.map((st) => `${`${st.i} ${st.arch} ${st.what === 'door' ? 'door' : 'mid'}`.slice(0, 16).padEnd(16)} ${ms(st.ms).padEnd(18)} ${String(k(st.calls.max)).padEnd(6)} ${k(st.tris.max)}`),
    ...stressLines(r.stress),
  ];
  return lines.join('\n');
}

/* ---- &stress=<n> | auto ------------------------------------------------------------------------------------------------
 * With &stress=n every frame draws the level's scene n times (n − 1 extra renders of the same scene and camera, into the
 * same target, cleared again before the real one), so the scene pass's GPU and draw-call cost goes up about n times while
 * the picture stays as it was. It is for a machine so fast that the tour reads the display's refresh interval at every
 * station (8.3 ms at 120 Hz): that says there is headroom, not how much. What it does NOT do: it multiplies today's scene,
 * so it says nothing about what a feature that is not built yet will cost; it does not raise the internal resolution (the
 * camcorder's line count, which is fixed inside vhs.js); and the camcorder's own passes after the scene are drawn once.
 * &stress=auto finds the multiple at the first station before the tour (stressStep), then tours unstressed. */

/** The multiples &stress=auto steps through, how long it holds each (a short settle, not measured, then the measure), when a
 * step counts as having fallen off the unstressed frame time, and when it still counts as holding it. */
export const STRESS_LADDER = Object.freeze([1, 2, 3, 4, 6, 8, 12, 16, 24, 32]);
export const STRESS_MAX = 32, STRESS_SETTLE_S = 0.25, STRESS_HOLD_S = 1.5, STRESS_FELL = 1.25, STRESS_HELD = 1.1;

/** What an address's &stress= asks for: a whole number 1…32, 'auto', or null (not asked, or nonsense). */
export function stressOf(v) {
  if (v === null || v === undefined || v === '') return null;
  if (String(v).toLowerCase() === 'auto') return 'auto';
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? Math.min(STRESS_MAX, n) : null;
}

/** The largest n of a stress table (rows in the order stepped) up to which every step held the unstressed (first) mean
 * within STRESS_HELD; 1 if even the second step did not; null for an empty table. */
export function headroomOf(table) {
  const base = table[0]?.mean;
  if (!Number.isFinite(base)) return null;
  let k = table[0].n;
  for (const row of table.slice(1)) { if (Number.isFinite(row.mean) && row.mean <= STRESS_HELD * base) k = row.n; else break; }
  return k;
}

/** &stress=auto begins: at multiple 1, settling. `now` in ms (performance.now, or a fake clock). */
export const stressBegin = (now) => ({ i: 0, n: STRESS_LADDER[0], phase: 'settle', at: now, ms: [], table: [], done: false, why: null, headroom: null });

/**
 * One frame of &stress=auto: `ms` is the interval that ended at this frame. Returns the next state (the one given is not
 * changed); its `n` is the multiple to draw the next frame at. Each step settles STRESS_SETTLE_S (not measured: the frame
 * the multiple changed in is not one or the other), then measures STRESS_HOLD_S. It stops (done, n back to 1) when a step's
 * mean is over STRESS_FELL × the first step's (the machine has fallen off its refresh rate) — why 'fell' — or the ladder's
 * top has been measured — why 'top'. `headroom` is then headroomOf(table).
 */
export function stressStep(s, now, ms) {
  if (s.done) return s;
  const t = (now - s.at) / 1000;
  if (s.phase === 'settle') return t >= STRESS_SETTLE_S ? { ...s, phase: 'hold', at: now, ms: [] } : s;
  const list = Number.isFinite(ms) ? [...s.ms, ms] : s.ms;
  if (t < STRESS_HOLD_S) return { ...s, ms: list };
  const sum = summarize(list), table = [...s.table, { n: s.n, frames: sum.n, mean: sum.mean, p95: sum.p95 }];
  const base = table[0].mean, fell = table.length > 1 && Number.isFinite(base) && Number.isFinite(sum.mean) && sum.mean > STRESS_FELL * base;
  if (fell || s.i + 1 >= STRESS_LADDER.length) return { ...s, n: 1, phase: 'done', at: now, ms: [], table, done: true, why: fell ? 'fell' : 'top', headroom: headroomOf(table) };
  return { ...s, i: s.i + 1, n: STRESS_LADDER[s.i + 1], phase: 'settle', at: now, ms: [], table };
}

/** What a bench result says about stress, for the summary: nothing without it. */
export function stressLines(st) {
  if (!st) return [];
  const note = 'stress multiplies today\'s scene pass: not features not built yet, not the internal resolution';
  if (st.asked !== 'auto') return [`stress ×${st.n}: the scene drawn ${st.n} times a frame, same picture (${note})`];
  const rows = (st.table || []).map((r) => `×${r.n} ${r.mean ?? '–'}`).join(' · ');
  const top = st.why === 'top' && st.headroom === STRESS_MAX ? `≥ ${STRESS_MAX}× (never fell off)` : `≈ ${st.headroom ?? '?'}×`;
  return [`stress auto at station 0, ms mean: ${rows || 'not measured'}`,
    `headroom ${top}${st.why === 'fell' ? ` · fell off at ×${st.table[st.table.length - 1].n}` : ''} · tour then unstressed`, `(${note})`];
}
