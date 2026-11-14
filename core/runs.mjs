// The Office — what a visit to the place that pays was worth. Pure rules,
// shared by the daemon (which keeps the office's record of visits) and the
// browser (which shows the card at the end of one, and keeps a record of its
// own where there is no office to ask).
//
// A visit ends one of four ways, and however it ends somebody is handed a
// card: what they did, what it scored, what was new to this office, what the
// jar gained. Three things on it are kept:
//
//   the best    The highest score any visit has made. A card says when it
//               has been beaten.
//   what has    Every kind of room anybody has walked into, and every
//   been seen   creature anybody has come face to face with. The first time
//               is marked on the card; after that it is only counted.
//   the tapes   A visit that ended by the way out keeps its tape: the seed
//               the building was made from, so that the same building can
//               be walked again. Nobody keeps the tape of a visit that
//               ended any other way. That building is gone.
//   playing a   Walking a kept tape again is not a visit to anywhere new.
//   tape back   It is scored, and the card says what it was; but it cannot
//               beat the best, nothing is paid for it, and the tape stays
//               the tape of the first time. What is met for the first time
//               on it is still met: that only ever happens once. Which
//               visits are tapes is not for the visitor to say: a visit to
//               a building whose tape is on the shelf is one.
//
// Coins are not decided here: what was carried out is worth what
// core/game.mjs says (`payFor`), and the jar is paid what that beats the
// office's best by.

/** How a visit can end. */
export const ENDINGS = Object.freeze(['exit', 'caught', 'battery', 'quit']);

/**
 * What everything is worth, in points. The first four are earned by anybody, however it ended; the rest only by
 * getting out. `par` is the seconds allowed for each part of the building before the bonus for speed is gone, and
 * `pace` what each second under that is worth, up to `paceMost`.
 */
export const POINTS = Object.freeze({ room: 10, kind: 25, part: 100, survived: 150, out: 500, card: 300, battery: 50, heart: 100, par: 150, pace: 2, paceMost: 600 });

/** How many tapes the office keeps: when there are more, the oldest goes. */
export const TAPES_KEPT = 12;

const ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const whole = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
const ids = (list, most) => [...new Set((Array.isArray(list) ? list : []).filter((id) => typeof id === 'string' && id.length <= 40 && ID.test(id)))].slice(0, most);

/**
 * A visit as it was reported, made safe to keep: every number whole and in range, every id an id, nothing else.
 * report: { reason, seed, seconds, parts: { reached, of }, rooms: { explored, kinds: [ids] }, cast: { met: [ids], survived },
 *           batteries, card, hearts: { left, of }, edition?, mascot? }
 * Anything missing is nothing. Only a visit that ended by the way out carries anything out of it.
 */
export function cleanRun(report = {}) {
  const r = report && typeof report === 'object' ? report : {};
  const reason = ENDINGS.includes(r.reason) ? r.reason : 'quit', out = reason === 'exit';
  const of = whole(r.parts?.of, 1, 12), kinds = ids(r.rooms?.kinds, 80);
  const hearts = r.hearts && typeof r.hearts === 'object' ? { of: whole(r.hearts.of, 1, 12) } : null;
  if (hearts) hearts.left = whole(r.hearts.left, 0, hearts.of);
  return {
    reason,
    seed: typeof r.seed === 'string' || typeof r.seed === 'number' ? String(r.seed).replace(/[^\x20-\x7e]/g, '').slice(0, 80) : '',
    seconds: whole(r.seconds, 0, 86400),
    parts: { reached: whole(r.parts?.reached, 1, of), of },
    rooms: { explored: Math.max(kinds.length, whole(r.rooms?.explored, 0, 2000)), kinds },
    cast: { met: ids(r.cast?.met, 40), survived: whole(r.cast?.survived, 0, 200) },
    batteries: out ? whole(r.batteries, 0, 200) : 0,
    card: out && r.card === true,
    hearts,
    // (of the building itself, for whoever plays its tape back: which make of the place it was, and whether the mascot was in it)
    ...(edition(r.edition) ? { edition: edition(r.edition) } : {}),
    ...(typeof r.mascot === 'boolean' ? { mascot: r.mascot } : {}),
  };
}

/** Which make of the building a tape is of (plan.js: `edition`): a few letters and digits, or nothing. */
const edition = (v) => (typeof v === 'string' && /^[a-z0-9]{1,16}$/.test(v) ? v : '');

/** Is this visit a tape being played back: is the building it says it was to one whose tape the office has? */
export const isReplay = (record, run) => !!run && run.seed !== '' && (record?.tapes || []).some((t) => t.seed === run.seed);

/**
 * What a visit scored, line by line. run: what cleanRun gives.
 * → { total, lines: [{ id, count, each?, points }] } — every line that applies, in the order a card shows them,
 *   including those worth nothing (a card that leaves out what you did not do does not say what there was to do).
 */
export function scoreRun(run) {
  const out = run.reason === 'exit', lines = [];
  const line = (id, count, each) => lines.push({ id, count, each, points: count * each });
  line('room', run.rooms.explored, POINTS.room);
  line('kind', run.rooms.kinds.length, POINTS.kind);
  line('part', run.parts.reached, POINTS.part);
  line('survived', run.cast.survived, POINTS.survived);
  if (out) {
    line('out', 1, POINTS.out);
    const under = Math.max(0, POINTS.par * run.parts.of - run.seconds);
    lines.push({ id: 'pace', count: run.seconds, points: Math.min(POINTS.paceMost, under * POINTS.pace) });
    line('card', run.card ? 1 : 0, POINTS.card);
    line('battery', run.batteries, POINTS.battery);
    if (run.hearts) line('heart', run.hearts.left, POINTS.heart);
  }
  return { total: lines.reduce((n, l) => n + l.points, 0), lines };
}

/**
 * A record with nothing in it yet. A tape in one: { seed, at, by, score, seconds } of the visit that kept it, and
 * plays (times played back since), edition, mascot (what the building was: see cleanRun) where they are known.
 */
export const emptyRecord = () => ({ runs: 0, out: 0, best: 0, rooms: {}, cast: {}, tapes: [] });

/** A record as it was stored, made safe to use: one that is damaged or from somewhere else becomes an empty one. */
export function cleanRecord(record) {
  const r = record && typeof record === 'object' ? record : {};
  const seen = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([id, at]) => ID.test(id) && id.length <= 40 && Number.isFinite(at)).slice(0, 400));
  return {
    runs: whole(r.runs, 0, 1e9), out: whole(r.out, 0, 1e9), best: whole(r.best, 0, 1e9), rooms: seen(r.rooms), cast: seen(r.cast),
    tapes: (Array.isArray(r.tapes) ? r.tapes : []).filter((t) => t && typeof t.seed === 'string' && t.seed).slice(0, TAPES_KEPT)
      .map((t) => ({ seed: t.seed.slice(0, 80), at: Number(t.at) || 0, by: String(t.by || '').slice(0, 60), score: whole(t.score, 0, 1e9), seconds: whole(t.seconds, 0, 86400),
        ...(whole(t.plays, 0, 999) ? { plays: whole(t.plays, 0, 999) } : {}), ...(edition(t.edition) ? { edition: edition(t.edition) } : {}),
        ...(typeof t.mascot === 'boolean' ? { mascot: t.mascot } : {}) })),
  };
}

/**
 * Enter a visit in the record.
 * @param record  what cleanRecord (or emptyRecord) gives; it is not changed
 * @param run     what cleanRun gives
 * @param {{at:number, by?:string}} when
 * @returns {{record, card}}  the record as it is now · what the card says:
 *   card: { reason, score, lines, seconds, best: { score, was, beaten }, fresh: { rooms: [ids], cast: [ids] },
 *           seen: { rooms, cast } (how many kinds this office has ever met), tape: { kept, seed? }, runs: { n, out },
 *           replay?: true (a kept tape played back: `tape` is the one on the shelf, with `plays`, and nothing else of
 *           the record but what was met for the first time has changed) }
 */
export function settleRun(record, run, { at, by = '' } = {}) {
  const { total, lines } = scoreRun(run), out = run.reason === 'exit';
  const fresh = { rooms: run.rooms.kinds.filter((id) => !record.rooms[id]), cast: run.cast.met.filter((id) => !record.cast[id]) };
  const mark = (seen, list) => ({ ...seen, ...Object.fromEntries(list.map((id) => [id, at])) });
  const seen = { rooms: mark(record.rooms, fresh.rooms), cast: mark(record.cast, fresh.cast) };
  const count = (r) => ({ rooms: Object.keys(r.rooms).length, cast: Object.keys(r.cast).length });
  if (isReplay(record, run)) {
    // a tape played back: counted on the tape, and nowhere else
    const tapes = record.tapes.map((t) => (t.seed === run.seed ? { ...t, plays: Math.min(999, (t.plays || 0) + 1) } : t));
    const next = { ...record, ...seen, tapes }, tape = tapes.find((t) => t.seed === run.seed);
    return {
      record: next,
      card: {
        reason: run.reason, score: total, lines, seconds: run.seconds, replay: true,
        best: { score: record.best, was: record.best, beaten: false },
        fresh, seen: count(next), tape: { kept: true, seed: run.seed, plays: tape.plays, first: { at: tape.at, by: tape.by, score: tape.score } },
        runs: { n: record.runs, out: record.out },
      },
    };
  }
  const keep = out && run.seed !== '';
  const next = {
    runs: record.runs + 1, out: record.out + (out ? 1 : 0), best: Math.max(record.best, total), ...seen,
    tapes: keep ? [{ seed: run.seed, at, by: String(by).slice(0, 60), score: total, seconds: run.seconds, ...(run.edition ? { edition: run.edition } : {}), ...(typeof run.mascot === 'boolean' ? { mascot: run.mascot } : {}) }, ...record.tapes].slice(0, TAPES_KEPT) : record.tapes,
  };
  return {
    record: next,
    card: {
      reason: run.reason, score: total, lines, seconds: run.seconds,
      best: { score: next.best, was: record.best, beaten: total > record.best },
      fresh, seen: count(next),
      tape: keep ? { kept: true, seed: run.seed } : { kept: false },
      runs: { n: next.runs, out: next.out },
    },
  };
}
