// BlockRooms — the visitors' book, as the site answers for it (GET and POST
// /api/book: the function itself is api/book.mjs, which is three lines). The
// rules of what may be written are core/book.mjs; this is the keeping of it.
//
//   GET  /api/book                 → { ok, counter: { hits, in, out }, top: [entries], latest: [entries] }
//   POST /api/book { do: 'hit' }   somebody opened the home page     → { ok, counter }
//   POST /api/book { do: 'in' }    somebody went in                  → { ok, counter }
//   POST /api/book { do: 'sign', name, message?, run }  somebody got out → { ok, entry, place }
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
import { blocked, checkRun, cleanEntry, cleanMessage, cleanName, entryOf } from '../../core/book.mjs';

/** How many of the best are kept, and of the latest; how many of each a reader is shown. */
export const KEEP = Object.freeze({ top: 100, latest: 100, showTop: 25, showLatest: 30 });
/** Seconds before the same visitor counts again: as a hit on the page, as somebody going in, as somebody signing. */
export const AGAIN = Object.freeze({ hit: 1800, in: 15, sign: 20, same: 90 * 86400 });
const MAX_BODY = 4096;

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const counterOf = ([hits, into, out]) => ({ hits: Number(hits) || 0, in: Number(into) || 0, out: Number(out) || 0 });
const COUNTERS = ['MGET', 'br:n:hits', 'br:n:in', 'br:n:out'];

/** Whoever this is, as something that is the same for them for a while and says nothing about them. */
function who(request, salt) {
  const ip = String(request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'nobody';
  return createHash('sha256').update(`${salt}|${ip}`).digest('base64url').slice(0, 22);
}

/**
 * Answer a request for the book.
 * @param {Request} request
 * @param {{store: {pipeline: Function}|null, now?: () => number, salt?: string, blocklist?: string[], adminKey?: string}} ctx
 *        store: null if nothing keeps the book · blocklist: words no name may have in it · adminKey: what strikes a line out
 * @returns {Promise<Response>}
 */
export async function handle(request, ctx) {
  const { store } = ctx, now = ctx.now || (() => Date.now()), salt = ctx.salt || 'blockrooms';
  if (!store) return json(503, { ok: false, why: 'no-store' });
  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const [n, top, latest] = await store.pipeline([COUNTERS, ['ZREVRANGE', 'br:top', 0, KEEP.showTop - 1], ['LRANGE', 'br:latest', 0, KEEP.showLatest - 1]]);
      // (a reader is shown what was there a moment ago: the edge keeps it for a few seconds, so that a busy day is one read and not thousands)
      return json(200, { ok: true, counter: counterOf(n), top: (top || []).map(cleanEntry).filter(Boolean), latest: (latest || []).map(cleanEntry).filter(Boolean) },
        { 'cache-control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=120' });
    }
    if (request.method !== 'POST') return json(405, { ok: false, why: 'method' }, { allow: 'GET, POST' });
    // only this site's own pages write in the book: a page somewhere else cannot send what this asks for without asking first
    if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return json(415, { ok: false, why: 'type' });
    const site = request.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin') return json(403, { ok: false, why: 'elsewhere' });
    const text = await request.text();
    if (text.length > MAX_BODY) return json(413, { ok: false, why: 'size' });
    let body; try { body = JSON.parse(text); } catch { return json(400, { ok: false, why: 'json' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, why: 'json' });
    const me = who(request, salt);

    if (body.do === 'hit' || body.do === 'in') {
      const kind = body.do === 'hit' ? 'hits' : 'in';
      const [fresh] = await store.pipeline([['SET', `br:rl:${body.do}:${me}`, 1, 'NX', 'EX', AGAIN[body.do]]]);
      const [, n] = await store.pipeline([fresh ? ['INCR', `br:n:${kind}`] : ['GET', `br:n:${kind}`], COUNTERS]);
      return json(200, { ok: true, counted: !!fresh, counter: counterOf(n) });
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
      // not line after line from the same hand…
      const [mine] = await store.pipeline([['SET', `br:rl:sign:${me}`, 1, 'NX', 'EX', AGAIN.sign]]);
      if (!mine) return json(429, { ok: false, why: 'slow' }, { 'retry-after': String(AGAIN.sign) });
      // …and one line for a building under a name, however often it is sent
      const same = `br:seen:${createHash('sha256').update(`${checked.run.seed}|${name}`).digest('base64url').slice(0, 22)}`;
      const [first] = await store.pipeline([['SET', same, 1, 'NX', 'EX', AGAIN.same]]);
      if (!first) return json(409, { ok: false, why: 'signed' });
      const entry = entryOf({ id: randomBytes(9).toString('hex'), at: now(), name, message, run: checked.run, score: checked.score }), line = JSON.stringify(entry);
      let top;
      try {
        [, , , , , top] = await store.pipeline([
          ['ZADD', 'br:top', entry.score, line], ['ZREMRANGEBYRANK', 'br:top', 0, -(KEEP.top + 1)],
          ['LPUSH', 'br:latest', line], ['LTRIM', 'br:latest', 0, KEEP.latest - 1], ['INCR', 'br:n:out'], ['ZREVRANGE', 'br:top', 0, KEEP.top - 1],
        ]);
      } catch (err) {
        await store.pipeline([['DEL', same]]).catch(() => null);          // (it was not written: whoever it was may try again)
        throw err;
      }
      const place = (top || []).indexOf(line);
      return json(200, { ok: true, entry, place: place < 0 ? null : place + 1 });
    }
    if (body.do === 'strike') {
      // whoever keeps the book takes a line out of it. Asked for with the wrong key, or with no key set, it is not said which
      const key = Buffer.from(String(body.key || '')), right = Buffer.from(String(ctx.adminKey || ''));
      if (right.length < 16 || key.length !== right.length || !timingSafeEqual(key, right)) return json(403, { ok: false, why: 'key' });
      const id = String(body.id || '');
      const [top, latest] = await store.pipeline([['ZREVRANGE', 'br:top', 0, KEEP.top - 1], ['LRANGE', 'br:latest', 0, KEEP.latest - 1]]);
      const lines = [...new Set([...(top || []), ...(latest || [])])].filter((line) => cleanEntry(line)?.id === id || (() => { try { return JSON.parse(line).id === id; } catch { return false; } })());
      if (!lines.length) return json(404, { ok: false, why: 'line' });
      await store.pipeline(lines.flatMap((line) => [['ZREM', 'br:top', line], ['LREM', 'br:latest', 0, line]]));
      return json(200, { ok: true, struck: lines.length });
    }
    return json(400, { ok: false, why: 'do' });
  } catch (err) {
    console.error('[book]', err && err.message);
    return json(502, { ok: false, why: 'store' });
  }
}
