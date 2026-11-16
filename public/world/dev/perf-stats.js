// The sums behind the dev page's &perf=1 read-out and &bench=1 tour (perf.js), kept apart from the page so that Node can
// test them: no DOM, no three, nothing random. Times are milliseconds unless a name says seconds.

/** How far back the read-out looks, and how often it is redrawn. */
export const WINDOW_MS = 5000, REDRAW_MS = 250;
/** The tour's clock, in seconds: settle after each jump (not measured), then measure standing still or turning round. */
export const SETTLE_S = 1, START_HOLD_S = 2, DOOR_HOLD_S = 1.5, SPIN_S = 4;
/** The query flags that change what is drawn (or how big), and so belong with any number the tour prints. */
export const DRAW_FLAGS = Object.freeze(['seed', 'vhs', 'dpr', 'fx', 'lighting', 'barricades', 'inventory', 'pursuer', 'wake', 'themes',
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
export function benchReport({ seed, flags = {}, ua = '', gpu = null, sizes = {}, list = [], frames = [], stood = [], seconds = null, aborted = null }) {
  const of = (fs) => ({ frames: fs.length, ms: summarize(fs.map((f) => f.ms)), calls: countStats(fs.map((f) => f.calls)), tris: countStats(fs.map((f) => f.tris)) });
  return {
    bench: 1, seed: String(seed), flags, ua, gpu, sizes, seconds: round(seconds), aborted,
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
    `bench seed ${r.seed}${r.aborted ? ` · STOPPED: ${r.aborted}` : ''} · ${Object.entries(r.flags).filter(([key]) => key !== 'seed').map(([key, v]) => `${key}=${v}`).join(' ') || 'defaults'}`,
    `${r.gpu || 'renderer unknown'}`,
    `picture ${s.picture || '?'} · canvas ${s.canvas || '?'} · dpr ${s.dpr ?? '?'} (device ${s.devicePixelRatio ?? '?'}) · vhs ${s.vhs ?? '?'}`,
    `ALL ${o.frames} frames · ms mean ${o.ms.mean} p50 ${o.ms.p50} p95 ${o.ms.p95} p99 ${o.ms.p99} worst ${o.ms.worst}`,
    `    draws ${k(o.calls.mean)}/${k(o.calls.max)} · tris ${k(o.tris.mean)}/${k(o.tris.max)} (mean/max)`,
    'station          ms mean/p95/worst  draws  tris',
    ...r.stations.map((st) => `${`${st.i} ${st.arch} ${st.what === 'door' ? 'door' : 'mid'}`.slice(0, 16).padEnd(16)} ${ms(st.ms).padEnd(18)} ${String(k(st.calls.max)).padEnd(6)} ${k(st.tris.max)}`),
  ];
  return lines.join('\n');
}
