// Private cross-device record. Pure merge rules; never a source of public scores.
import { cleanRecord, cleanRun, settleRun, TAPES_KEPT } from './runs.mjs';
import { resolveLook, ACCESSORY } from './look.mjs';
import { mergeFieldwork, logFieldwork } from './fieldwork.mjs';
import { cleanName } from './book.mjs';
const n = v => Math.max(0, Math.min(1e9, Math.floor(Number(v) || 0)));
const stamp = v => Math.max(0, Math.min(8640000000000000, Number(v) || 0));
const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const key = s => typeof s === 'string' && /^[a-zA-Z0-9:_-]{1,100}$/.test(s);
export const archiveLook = v => resolveLook('blockrooms-player', { ...object(v), accessory: ACCESSORY.includes(v?.accessory) ? v.accessory : 'none' });
const field = (v, clean) => v && typeof v === 'object' && key(v.writer) ? { value: clean(v.value), at: stamp(v.at), writer: v.writer } : null;
// The printed pass has a fixed position for each floor, independent of the order played.
export const CLEARANCE_FLOORS = Object.freeze({
  yellow: 'Yellow Office', archive: 'Records', night: 'After Hours', fitout: 'Fit-Out', exec: 'Executive',
  suburb: 'Suburbia', mall: 'Mall', waterpark: 'Waterpark', forest: 'Forest',
});
export function cleanArchive(v) {
  const a = object(v), r = cleanRecord(a);
  return { v: 1, baseline: { runs: n(a.baseline?.runs), out: n(a.baseline?.out) },
    counts: Object.fromEntries(Object.entries(object(a.counts)).filter(([k]) => key(k)).map(([k, c]) => [k, { runs: n(c?.runs), out: n(c?.out) }])),
    clearances: Object.keys(CLEARANCE_FLOORS).filter(id => Array.isArray(a.clearances) && a.clearances.includes(id)),
    activity: { floors: Object.keys(CLEARANCE_FLOORS).filter(id => Array.isArray(a.activity?.floors) && a.activity.floors.includes(id)),
      streams: mergeFieldwork(a.activity?.streams) },
    best: r.best, rooms: r.rooms, cast: r.cast, tapes: r.tapes,
    name: field(a.name, v => cleanName(v) || 'Visitor'), character: field(a.character, archiveLook) };
}
export function importArchive(record, { name, character, writer = 'legacy' } = {}) {
  const r = cleanRecord(record);
  return cleanArchive({ ...r, baseline: { runs: r.runs, out: r.out },
    name: name ? { value: name, at: 0, writer } : null,
    character: character ? { value: character, at: 0, writer } : null });
}
const latest = (a, b) => !a ? b : !b ? a : a.at !== b.at ? (a.at > b.at ? a : b) :
  (JSON.stringify(a) >= JSON.stringify(b) ? a : b);
const seen = (a, b) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map(k =>
  [k, a[k] === undefined ? b[k] : b[k] === undefined ? a[k] : Math.min(a[k], b[k])]));
export function mergeArchive(left, right) {
  const a = cleanArchive(left), b = cleanArchive(right), counts = Object.create(null);
  for (const id of [...new Set([...Object.keys(a.counts), ...Object.keys(b.counts)])].sort()) counts[id] = {
    runs: Math.max(a.counts[id]?.runs || 0, b.counts[id]?.runs || 0), out: Math.max(a.counts[id]?.out || 0, b.counts[id]?.out || 0) };
  const tapes = new Map();
  for (const t of [...a.tapes, ...b.tapes]) {
    const id = JSON.stringify([t.seed, t.edition || '']), old = tapes.get(id);
    const first = !old || t.at < old.at || (t.at === old.at && JSON.stringify(t) < JSON.stringify(old)) ? t : old;
    tapes.set(id, { ...first, ...(Math.max(old?.plays || 0, t.plays || 0) ? { plays: Math.max(old?.plays || 0, t.plays || 0) } : {}) });
  }
  return cleanArchive({ v: 1, baseline: { runs: Math.max(a.baseline.runs, b.baseline.runs), out: Math.max(a.baseline.out, b.baseline.out) }, counts,
    clearances: [...a.clearances, ...b.clearances],
    activity: { floors: [...a.activity.floors, ...b.activity.floors], streams: mergeFieldwork(a.activity.streams,b.activity.streams) },
    best: Math.max(a.best, b.best), rooms: seen(a.rooms, b.rooms), cast: seen(a.cast, b.cast),
    tapes: [...tapes.values()].sort((x, y) => y.at - x.at || JSON.stringify(x).localeCompare(JSON.stringify(y))).slice(0, TAPES_KEPT),
    name: latest(a.name, b.name), character: latest(a.character, b.character) });
}
export function archiveRecord(value) {
  const a = cleanArchive(value), c = Object.values(a.counts);
  return cleanRecord({ ...a, runs: a.baseline.runs + c.reduce((s, v) => s + v.runs, 0), out: a.baseline.out + c.reduce((s, v) => s + v.out, 0) });
}
export function archiveRun(value, report, { writer, at = Date.now(), by = '' } = {}) {
  if (!key(writer) || Object.hasOwn(Object.prototype,writer)) throw new Error('A visit needs its device writer.');
  const a = cleanArchive(value), run = cleanRun(report);
  const end = Math.max(stamp(at), (a.activity.streams[writer]?.points?.at(-1)?.[0] || 0) + 1);
  const result = settleRun(archiveRecord(a), run, { at:end, by });
  a.activity.streams = logFieldwork(a.activity.streams, writer, end, run.cast.encounters ?? run.cast.met.length, result.card.replay, result.card.fresh.rooms);
  if (!result.card.replay) a.counts[writer] = { runs: (a.counts[writer]?.runs || 0) + 1, out: (a.counts[writer]?.out || 0) + (result.card.reason === 'exit' ? 1 : 0) };
  return { document: cleanArchive({ ...a, ...result.record }), card: result.card };
}
export function editArchive(value, patch, writer, at = Date.now()) {
  const a = cleanArchive(value);
  if (!key(writer)) throw new Error('A change needs its device writer.');
  for (const k of ['name', 'character']) if (Object.hasOwn(patch, k)) a[k] = { value: patch[k], at: Math.max(at, (a[k]?.at || 0) + 1), writer };
  return cleanArchive(a);
}
