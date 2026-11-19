// One append-only stream per device/owner, like the visit counters in archive.mjs.
// Keep lifetime totals as the plot window rolls over. A point is [end time, encounters, optional newly seen room IDs].
const WINDOW = 1024;
const count = (value) => Math.min(1e9, Math.max(0, Math.floor(Number(value) || 0)));
const textOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function mergeFieldwork(left = {}, right = {}) {
  const streams = {};
  const dates = [];
  for (const key of [...new Set([...Object.keys(left || {}), ...Object.keys(right || {})])].sort()) {
    if (!/^[\w:-]{1,100}$/.test(key) || Object.hasOwn(Object.prototype, key)) continue;
    const candidates = [left?.[key], right?.[key]].filter((s) => s && count(s.n) && Array.isArray(s.points));
    if (!candidates.length) continue;
    // A newer writer snapshot contains the entire retained suffix. For equal versions keep the fuller copy.
    candidates.sort(
      (a, b) =>
        count(b.n) - count(a.n) ||
        b.points.length - a.points.length ||
        textOrder(JSON.stringify(a), JSON.stringify(b)),
    );
    const s = candidates[0],
      n = count(s.n);
    const points = s.points
      .slice(-Math.min(n, WINDOW))
      .filter((p) => Array.isArray(p) && Number.isSafeInteger(p[0]) && p[0] > 0)
      .map((p) => {
        const fresh = Array.isArray(p[2])
          ? [
              ...new Set(p[2].filter((id) => typeof id === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(id))),
            ].slice(0, 80)
          : [];
        return fresh.length ? [p[0], count(p[1]), fresh] : [p[0], count(p[1])];
      });
    streams[key] = {
      n,
      since: Number.isSafeInteger(s.since) && s.since > 0 ? s.since : points[0]?.[0] || 1,
      replays: Math.min(n, count(s.replays)),
      total: Math.max(
        count(s.total),
        points.reduce((sum, p) => sum + p[1], 0),
      ),
      points,
    };
    for (const [at] of points) dates.push({ key, at });
  }
  if (dates.length > WINDOW) {
    dates.sort((a, b) => a.at - b.at || textOrder(a.key, b.key));
    const remove = new Map();
    for (const { key } of dates.slice(0, -WINDOW)) remove.set(key, (remove.get(key) || 0) + 1);
    for (const [key, skip] of remove) streams[key].points = streams[key].points.slice(skip);
  }
  return streams;
}

export function logFieldwork(streams, writer, at, encounters, replay, fresh) {
  const s = streams[writer] || { n: 0, replays: 0, total: 0, points: [] };
  const end = at;
  const point = fresh.length ? [end, encounters, fresh] : [end, encounters];
  return {
    ...streams,
    [writer]: {
      n: s.n + 1,
      since: s.since || end,
      replays: s.replays + Number(!!replay),
      total: s.total + encounters,
      points: [...s.points, point],
    },
  };
}
