// The Office — the visitors' book: who got out of the place that pays, kept
// where anybody can read it. Pure rules, shared by the page that shows the
// book, the page the level is played on, and whatever keeps the book.
//
//   a name    Typed by whoever signs. With the message, it is all of the
//             book that a stranger wrote, so it is kept short and plain: sixteen
//             characters, letters and figures and a little punctuation,
//             nothing that could be an address. It is only ever put on a page
//             as text, and whoever keeps the book may have a list of words it
//             will not take (`blocked`: the list is theirs, not this file's).
//             Somebody who types nothing gets a made-up name (two words from
//             two lists, as the office names an agent it knows nothing about).
//   a message Optional, typed, and short: sixty characters, the same plain
//             characters as a name and a little more punctuation, no
//             addresses, the same blocked words. Text only, like the name.
//   a visit   Only a visit that got out is entered. What it reports is scored
//             again here (core/runs.mjs) and checked against what a building
//             allows. That catches mistakes and casual tampering, not a
//             determined cheat: the level runs in the visitor's own browser.
import { validDifficulty, scoreEligible, cleanDifficulty } from './difficulty.mjs';
import { cleanRun, scoreRun } from './runs.mjs';

/* ---- names --------------------------------------------------------------------------------------- */

// (the office's own two lists are the first sixteen of each: server/profiles.mjs)
export const FIRST = Object.freeze(['Quiet', 'Brisk', 'Amber', 'Velvet', 'Iron', 'Pewter', 'Saffron', 'Cobalt', 'Hollow', 'Drift', 'Ember', 'Slate', 'Marble', 'Russet', 'Onyx', 'Ivory',
  'Ashen', 'Beige', 'Chalk', 'Coral', 'Damp', 'Drab', 'Dusty', 'Faded', 'Khaki', 'Lilac', 'Mild', 'Mossy', 'Muted', 'Navy', 'Olive', 'Pale', 'Plain', 'Sage', 'Sandy', 'Stale', 'Tawny', 'Teal', 'Tepid', 'Umber']);
export const SECOND = Object.freeze(['Heron', 'Marten', 'Civet', 'Lynx', 'Vireo', 'Tapir', 'Shrike', 'Caracal', 'Fennec', 'Quokka', 'Saiga', 'Margay', 'Genet', 'Serval', 'Numbat', 'Pika',
  'Agouti', 'Bittern', 'Bongo', 'Coati', 'Curlew', 'Dormouse', 'Dunlin', 'Egret', 'Finch', 'Gecko', 'Godwit', 'Ibis', 'Jerboa', 'Kestrel', 'Lemur', 'Loris', 'Marmot', 'Moth', 'Newt', 'Nuthatch',
  'Okapi', 'Otter', 'Pangolin', 'Plover', 'Potoo', 'Quoll', 'Shrew', 'Skink', 'Stoat', 'Tern', 'Vole', 'Wren']);

const pick = (list, rand) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
/** A name for somebody who has not said what theirs is. rand: () → [0, 1). */
export const rollName = (rand = Math.random) => `${pick(FIRST, rand)} ${pick(SECOND, rand)}`;

/** How long a name may be, in characters. */
export const NAME_MAX = 16;
/**
 * A name as somebody typed it, made fit to keep: spaces closed up, and then itself — or nothing, if it is too long,
 * has nothing in it to read, has anything in it but letters, figures, spaces and . - _ ' , or could be an address.
 */
export function cleanName(v) {
  if (typeof v !== 'string' || v.length > 200) return '';
  const name = v.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!name || [...name].length > NAME_MAX) return '';
  if (!/^[\p{L}\p{M}\p{N} ._'’-]+$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) return '';
  if (/\.\p{L}{2,}/u.test(name) || /^(https?|www)\b/i.test(name)) return '';
  return name;
}
/** How long a message may be, in characters. */
export const MESSAGE_MAX = 60;
/**
 * A message as somebody typed it, made fit to keep: '' if they said nothing, the message itself if it is short and
 * plain (letters, figures, spaces and . , ! ? ' : ; ( ) _ -) and is not an address — or null if it cannot be kept.
 */
export function cleanMessage(v) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' || v.length > 400) return null;
  const text = v.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if ([...text].length > MESSAGE_MAX) return null;
  if (!/^[\p{L}\p{M}\p{N} .,!?'’:;()_-]+$/u.test(text)) return null;
  if (/\.\p{L}{2,}/u.test(text) || /\b(https?|www)\b/i.test(text)) return null;
  return text;
}
// (how somebody spells a word they have been told they cannot use)
const PLAIN = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };
const plain = (text) => String(text).normalize('NFKD').toLowerCase().replace(/[0134578]/g, (d) => PLAIN[d]).replace(/[^a-z]/g, '');
/**
 * Is this name (or message) one the book will not take? `words`: whoever keeps the book says which (their list, not
 * this file's); it is refused if it has one of them in it, however it has been spelled round. Words under three
 * letters are not looked for: they are in too many names.
 */
export function blocked(name, words = []) {
  const said = plain(name);
  return words.map(plain).filter((w) => w.length >= 3).some((w) => said.includes(w));
}

/* ---- visits -------------------------------------------------------------------------------------- */

/**
 * What a building allows. A visit that says more than this of itself was not a visit to one.
 * parts: how many a building has · roomsPerPart: how many rooms a part has, and the fewest anybody walks into on the
 * way through one · kindsPerPart: the most oddities a part is dealt · secondsPerPart: nobody is through a part faster,
 * however well they know it · seconds: the most a tape runs, with every battery pack there could be · batteries: the
 * most anybody could carry out · hearts: what a visitor has · survivedPerPart: how often anybody is got and gets away
 * in one part · met: how many kinds of thing there are to meet.
 */
export const LIMITS = Object.freeze({ parts: [3, 5], roomsPerPart: [2, 28], kindsPerPart: 8, secondsPerPart: 12, seconds: 3600, batteries: 30, hearts: [2, 4], survivedPerPart: 4, met: 16 });

const SEED = /^[A-Za-z0-9_-]{4,40}$/;

/**
 * A visit, as whoever made it reports it (what scorecard.js sends: core/runs.mjs `cleanRun`), held to what the
 * building allows. → { ok: true, run, score } — the visit made safe to keep, and what it scored, counted here ·
 * or { ok: false, why } (a few words, for whoever is being refused).
 */
export function checkRun(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return { ok: false, why: 'not a visit' };
  const run = cleanRun(report), L = LIMITS, of = run.parts.of;
  if (report.difficulty !== undefined && !validDifficulty(report.difficulty)) return { ok: false, why: 'unknown difficulty' };
  if (report.scoring !== undefined && report.scoring !== 1) return { ok: false, why: 'unknown scoring edition' };
  if (!scoreEligible(run)) return { ok: false, why: 'unscored recording' };
  if (run.reason !== 'exit') return { ok: false, why: 'did not get out' };
  if (!SEED.test(run.seed)) return { ok: false, why: 'no seed' };
  if (of < L.parts[0] || of > L.parts[1] || run.parts.reached !== of) return { ok: false, why: 'parts out of range' };
  if (run.rooms.explored < L.roomsPerPart[0] * of || run.rooms.explored > (run.difficulty ? 44 : L.roomsPerPart[1]) * of) return { ok: false, why: 'rooms out of range' };
  if (run.rooms.kinds.length > L.kindsPerPart * of) return { ok: false, why: 'room kinds out of range' };
  if (run.seconds < L.secondsPerPart * of || run.seconds > L.seconds) return { ok: false, why: 'time out of range' };
  if (run.batteries > L.batteries) return { ok: false, why: 'batteries out of range' };
  if (!run.hearts || run.hearts.of < (run.difficulty === 'hard' ? 1 : L.hearts[0]) || run.hearts.of > L.hearts[1] || run.hearts.left < 1 || run.hearts.left > run.hearts.of) return { ok: false, why: 'hearts out of range' };
  if (run.difficulty === 'hard' && run.hearts.of !== 1) return { ok: false, why: 'hard needs one heart' };
  if (run.cast.survived > (run.difficulty ? 12 : L.survivedPerPart) * of || run.cast.met.length > L.met) return { ok: false, why: 'encounters out of range' };
  return { ok: true, run, score: scoreRun(run).total };
}

/**
 * A line of the book: what is kept of a visit, and nothing that says who made it but the name they signed with.
 * { id, at, name, message, score, seconds, parts, rooms, batteries, hearts, card, seed, edition? }
 */
export function entryOf({ id, at, name, message = '', run, score }) {
  return {
    ...(run.difficulty ? { difficulty: run.difficulty, scoring: 1 } : {}),
    id: String(id), at: Math.floor(Number(at)) || 0, name, message, score, seconds: run.seconds, parts: run.parts.of, rooms: run.rooms.explored,
    batteries: run.batteries, hearts: run.hearts.left, card: run.card, seed: run.seed, ...(run.edition ? { edition: run.edition } : {}),
  };
}

const whole = (v, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
/** A line as it came back from wherever the book is kept: the same line if it is one, or null. Nothing in it is trusted to be what was put there. */
export function cleanEntry(raw) {
  let e = raw;
  if (typeof e === 'string') { try { e = JSON.parse(e); } catch { return null; } }
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (e.difficulty !== undefined && (!validDifficulty(e.difficulty) || e.difficulty === 'tourist')) return null;
  const name = cleanName(e.name);
  if (!name || typeof e.seed !== 'string' || !SEED.test(e.seed) || typeof e.id !== 'string' || !/^[a-z0-9]{6,24}$/.test(e.id)) return null;
  return {
    ...(e.difficulty ? { difficulty: cleanDifficulty(e.difficulty, 'training-wheels'), scoring: 1 } : {}),
    id: e.id, at: whole(e.at, 0, 4e12), name, message: cleanMessage(e.message) || '', score: whole(e.score, 0, 1e6), seconds: whole(e.seconds, 0, 86400), parts: whole(e.parts, 1, 12), rooms: whole(e.rooms, 0, 2000),
    batteries: whole(e.batteries, 0, 200), hearts: whole(e.hearts, 0, 12), card: e.card === true, seed: e.seed,
    ...(typeof e.edition === 'string' && /^[a-z0-9]{1,16}$/.test(e.edition) ? { edition: e.edition } : {}),
    // (the book's own look at the visit, kept with it for whoever judges a prize, and never shown: `shownEntry`)
    ...(typeof e.check === 'string' && e.check.length <= 400 ? { check: e.check.replace(/[^\w .,:;()%/-]/g, '') } : {}),
    ...(Number.isFinite(e.started) ? { started: whole(e.started, 0, 4e12) } : {}),
  };
}
/** A line as a reader is shown it: the book's own notes on the visit taken off. */
export function shownEntry(e) {
  if (!e) return null;
  const { check, started, ...shown } = e;
  return shown;
}
