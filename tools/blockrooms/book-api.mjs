// BlockRooms — the visitors' book, as the site answers for it (GET and POST
// /api/book: the function itself is api/book.mjs, which is three lines). The
// rules of what may be written are core/book.mjs; this is the keeping of it.
//
//   GET  /api/book                 → { ok, counter: { hits, in, out }, top: [entries], latest: [entries] }
//   POST /api/book { do: 'hit' }   somebody opened the home page     → { ok, counter }
//   POST /api/book { do: 'in', seed? }  somebody went in            → { ok, counter, ticket? } (a ticket for that building:
//                                                                     visit-ticket.mjs)
//   POST /api/book { do: 'sign', name, message?, run, ticket }  somebody got out → { ok, entry, place }
//        (the ticket must be the one this visit was given, the time it claims must have passed since, and its route
//        is checked against its building: visit-check.mjs. A route that does not fit is kept, marked, for a prize judge)
//   POST /api/book { do: 'strike', id, key }        a line comes out  → { ok, struck }
//
// A name and a short message are what a stranger types into the book. Whoever
// keeps the book can give it words it will not take in either (ctx.blocklist: on the
// host, BOOK_BLOCKLIST, separated by commas), and can strike a line out with
// a key only they hold (ctx.adminKey: BOOK_ADMIN_KEY; with none set, nothing
// can be struck).
//
// Kept (keys under br:): three counters; the hundred best visits; the last
// hundred. Nothing about who anybody is: no address of theirs is stored, only
// (for a few seconds or minutes, so that nobody counts twice or signs a
// hundred times) a salted hash of it that cannot be turned back into one.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { blocked, checkRun, cleanEntry, cleanMessage, cleanName, entryOf, shownEntry } from '../../core/book.mjs';
import { DIFFICULTIES, validDifficulty } from '../../core/difficulty.mjs';
import { KEEP, AGAIN } from './book-policy.mjs';
import { checkTicket, issueTicket, ticketKey } from './visit-ticket.mjs';
import { checkVisit } from './visit-check.mjs';

export { KEEP, AGAIN };
const MAX_BODY = 4096, MAX_SIGN = 65536;           // (a signing carries the visit's route: core/trail.mjs)
const SEED = /^[A-Za-z0-9_-]{4,40}$/;

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const counterOf = ([hits, into, out]) => ({ hits: Number(hits) || 0, in: Number(into) || 0, out: Number(out) || 0 });
const COUNTERS = ['MGET', 'br:n:hits', 'br:n:in', 'br:n:out'];
// with no store, all that anybody outside is told about why: nothing set at all, or a set that will not do
const SETTINGS = new Set(['none', 'incomplete']);

/** Whoever this is, as something that is the same for them for a while and says nothing about them. */
function who(request, salt) {
  const ip = String(request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'nobody';
  return createHash('sha256').update(`${salt}|${ip}`).digest('base64url').slice(0, 22);
}

/**
 * Answer a request for the book.
 * @param {Request} request
 * @param {{store: object|null, settings?: string, now?: () => number, salt?: string, blocklist?: string[], adminKey?: string}} ctx
 *        store: null if nothing keeps the book · settings: with no store, whether the host was given 'none' of its settings or an 'incomplete' set
 *        blocklist: words no name may have in it · adminKey: what strikes a line out
 * @returns {Promise<Response>}
 */
export async function handle(request, ctx) {
  const { store } = ctx, now = ctx.now || (() => Date.now()), salt = ctx.salt || 'blockrooms', key = ctx.ticketKey || ticketKey({ salt });
  if (!store) return json(503, { ok: false, why: 'no-store', ...(SETTINGS.has(ctx.settings) ? { settings: ctx.settings } : {}) });
  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const difficulty = new URL(request.url).searchParams.get('difficulty') || '';
      if (difficulty && difficulty !== 'original' && (!validDifficulty(difficulty) || difficulty === 'tourist')) return json(400, { ok: false, why: 'difficulty' });
      if (store.read) {
        const { counter, top, latest } = await store.read(difficulty);
        // (a store that has not been brought up to date yet answers every mode with every score: keep to the mode asked for here as well)
        const mode = (e) => !difficulty || (e.difficulty || 'original') === difficulty;
        return json(200, { ok: true, counter, top: top.map(cleanEntry).filter(Boolean).filter(mode).map(shownEntry), latest: latest.map(cleanEntry).filter(Boolean).map(shownEntry) },
          { 'cache-control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=120' });
      }
      const [n, top, latest] = await store.pipeline([COUNTERS, ['ZREVRANGE', difficulty ? `br:top:${difficulty}` : 'br:top', 0, KEEP.showTop - 1], ['LRANGE', 'br:latest', 0, KEEP.showLatest - 1]]);
      // (a reader is shown what was there a moment ago: the edge keeps it for a few seconds, so that a busy day is one read and not thousands)
      return json(200, { ok: true, counter: counterOf(n), top: (top || []).map(cleanEntry).filter(Boolean).map(shownEntry), latest: (latest || []).map(cleanEntry).filter(Boolean).map(shownEntry) },
        { 'cache-control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=120' });
    }
    if (request.method !== 'POST') return json(405, { ok: false, why: 'method' }, { allow: 'GET, POST' });
    // only this site's own pages write in the book: a page somewhere else cannot send what this asks for without asking first
    if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return json(415, { ok: false, why: 'type' });
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return json(403, { ok: false, why: 'elsewhere' });
    const text = await request.text();
    if (text.length > MAX_SIGN || (text.length > MAX_BODY && !/^\s*\{\s*"do"\s*:\s*"sign"/.test(text))) return json(413, { ok: false, why: 'size' });
    let body; try { body = JSON.parse(text); } catch { return json(400, { ok: false, why: 'json' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, why: 'json' });
    const me = who(request, salt);

    if (body.do === 'hit' || body.do === 'in') {
      // going in, with the building's seed, is given a ticket for it whether or not it is counted (it is counted once a while)
      const ticket = body.do === 'in' && typeof body.seed === 'string' && SEED.test(body.seed) ? { ticket: issueTicket(body.seed, { key, now: now() }) } : {};
      if (store.count) return json(200, { ok: true, ...await store.count(body.do, me), ...ticket });
      const kind = body.do === 'hit' ? 'hits' : 'in';
      const [fresh] = await store.pipeline([['SET', `br:rl:${body.do}:${me}`, 1, 'NX', 'EX', AGAIN[body.do]]]);
      const [, n] = await store.pipeline([fresh ? ['INCR', `br:n:${kind}`] : ['GET', `br:n:${kind}`], COUNTERS]);
      return json(200, { ok: true, counted: !!fresh, counter: counterOf(n), ...ticket });
    }

    if (body.do === 'sign') {
      const name = cleanName(body.name);
      if (!name) return json(400, { ok: false, why: 'name', text: 'Name: 16 characters at most, letters and numbers.' });
      if (blocked(name, ctx.blocklist || [])) return json(400, { ok: false, why: 'name', text: 'Name not allowed.' });
      const message = cleanMessage(body.message);
      if (message === null) return json(400, { ok: false, why: 'message', text: 'Message: 60 characters at most, no links.' });
      if (blocked(message, ctx.blocklist || [])) return json(400, { ok: false, why: 'message', text: 'Message not allowed.' });
      const checked = checkRun(body.run);
      if (!checked.ok) return json(422, { ok: false, why: 'visit', text: checked.why });
      // the ticket it was given as it went in: this building, this long ago, once; and the route it took, against the
      // building: one that does not fit is signed, and marked (for whoever judges a prize). On for the site always
      // (api/book.mjs); only a test of the book's other rules turns them off (ctx.checks === false)
      const checks = ctx.checks !== false;
      const ticket = checks ? checkTicket(body.ticket, checked.run, { key, now: now() }) : { ok: true, nonce: `${checked.run.seed}|${name}`, started: null };
      if (!ticket.ok) return json(422, { ok: false, why: 'ticket', text: ticket.why });
      const route = checks ? await checkVisit(checked.run, body.run.trail) : { ok: true, verdict: 'ok' };
      if (!route.ok) return json(422, { ok: false, why: 'route', text: route.why });
      const check = route.verdict === 'ok' ? 'ok' : `flag: ${route.why.join('; ')}`.slice(0, 400);
      const entry = { ...entryOf({ id: randomBytes(9).toString('hex'), at: now(), name, message, look: body.look, run: checked.run, score: checked.score }), check, ...(ticket.started ? { started: ticket.started } : {}) };
      if (store.sign) {
        const duplicate = createHash('sha256').update(`ticket|${ticket.nonce}`).digest('base64url').slice(0, 22);
        const result = await store.sign(entry, me, duplicate);
        if (!result.ok) {
          if (result.why === 'slow') return json(429, { ok: false, why: 'slow' }, { 'retry-after': String(AGAIN.sign) });
          if (result.why === 'signed') return json(409, { ok: false, why: 'signed' });
          throw new Error('the store did not accept the entry');
        }
        if (check !== 'ok') console.warn(`[book] signed, and flagged: ${entry.id} ${check}`);
        return json(200, { ok: true, entry: shownEntry(entry), place: result.place });
      }
      // not line after line from the same hand…
      const [mine] = await store.pipeline([['SET', `br:rl:sign:${me}`, 1, 'NX', 'EX', AGAIN.sign]]);
      if (!mine) return json(429, { ok: false, why: 'slow' }, { 'retry-after': String(AGAIN.sign) });
      // …and one line for a building under a name, however often it is sent
      const same = `br:seen:${createHash('sha256').update(`ticket|${ticket.nonce}`).digest('base64url').slice(0, 22)}`;
      const [first] = await store.pipeline([['SET', same, 1, 'NX', 'EX', AGAIN.same]]);
      if (!first) return json(409, { ok: false, why: 'signed' });
      const line = JSON.stringify(entry);
      const modeKey = `br:top:${entry.difficulty || 'original'}`;
      let top;
      try {
        [, , , , , top] = await store.pipeline([
          ['ZADD', 'br:top', entry.score, line], ['ZREMRANGEBYRANK', 'br:top', 0, -(KEEP.top + 1)],
          ['LPUSH', 'br:latest', line], ['LTRIM', 'br:latest', 0, KEEP.latest - 1], ['INCR', 'br:n:out'], ['ZREVRANGE', 'br:top', 0, KEEP.top - 1],
          ['ZADD', modeKey, entry.score, line], ['ZREMRANGEBYRANK', modeKey, 0, -(KEEP.top + 1)],
        ]);
      } catch (err) {
        await store.pipeline([['DEL', same]]).catch(() => null);          // (it was not written: whoever it was may try again)
        throw err;
      }
      const place = (top || []).indexOf(line);
      if (check !== 'ok') console.warn(`[book] signed, and flagged: ${entry.id} ${check}`);
      return json(200, { ok: true, entry: shownEntry(entry), place: place < 0 ? null : place + 1 });
    }
    if (body.do === 'strike') {
      // whoever keeps the book takes a line out of it. Asked for with the wrong key, or with no key set, it is not said which
      const key = Buffer.from(String(body.key || '')), right = Buffer.from(String(ctx.adminKey || ''));
      if (right.length < 16 || key.length !== right.length || !timingSafeEqual(key, right)) return json(403, { ok: false, why: 'key' });
      const id = String(body.id || '');
      if (store.strike) {
        if (!/^[a-z0-9]{6,40}$/.test(id)) return json(404, { ok: false, why: 'line' });
        const struck = await store.strike(id);
        return struck ? json(200, { ok: true, struck }) : json(404, { ok: false, why: 'line' });
      }
      const modeKeys = ['br:top', 'br:top:original', ...DIFFICULTIES.filter(d => d.multiplier).map(d => `br:top:${d.id}`)];
      const lists = await store.pipeline([...modeKeys.map(key => ['ZREVRANGE', key, 0, KEEP.top - 1]), ['LRANGE', 'br:latest', 0, KEEP.latest - 1]]);
      const lines = [...new Set(lists.flat())].filter((line) => cleanEntry(line)?.id === id || (() => { try { return JSON.parse(line).id === id; } catch { return false; } })());
      if (!lines.length) return json(404, { ok: false, why: 'line' });
      await store.pipeline(lines.flatMap((line) => [...modeKeys.map(key => ['ZREM', key, line]), ['LREM', 'br:latest', 0, line]]));
      return json(200, { ok: true, struck: lines.length });
    }
    return json(400, { ok: false, why: 'do' });
  } catch (err) {
    console.error('[book]', err && err.message);
    return json(502, { ok: false, why: 'store' });
  }
}
