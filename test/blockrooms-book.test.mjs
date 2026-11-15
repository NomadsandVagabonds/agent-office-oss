// BlockRooms: the visitors' book. What may be written in it (core/book.mjs),
// and the keeping of it (tools/blockrooms/book-api.mjs) against a store that
// is only a Map. The point of nearly every line here is that nothing a
// stranger typed can end up in front of another stranger, and that a visit
// which could not have happened is not entered.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST, SECOND, LIMITS, NAME_MAX, MESSAGE_MAX, rollName, cleanName, cleanMessage, blocked, checkRun, entryOf, cleanEntry } from '../core/book.mjs';
import { scoreRun, cleanRun } from '../core/runs.mjs';
import { handle, KEEP, AGAIN } from '../tools/blockrooms/book-api.mjs';
import { createStore, memoryStore } from '../tools/blockrooms/book-store.mjs';

const visit = (over = {}) => ({ reason: 'exit', seed: 'k3j9x0qa1b', seconds: 240, parts: { reached: 3, of: 3 }, rooms: { explored: 31, kinds: ['kanban', 'party'] },
  cast: { met: ['pirate'], survived: 1 }, batteries: 2, card: false, hearts: { left: 3, of: 4 }, edition: 'wuuhge', mascot: true, ...over });
const seeded = (n = 1) => () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };

test('book: a name is what somebody signs as — short, plain, and never an address; one nobody typed is two words from two lists', () => {
  assert.equal(new Set(FIRST).size, FIRST.length); assert.equal(new Set(SECOND).size, SECOND.length);
  for (const w of [...FIRST, ...SECOND]) assert.match(w, /^[A-Z][a-z]{2,9}$/, `${w} is not a plain word`);
  const rand = seeded(7);
  for (let i = 0; i < 300; i++) { const name = rollName(rand); assert.equal(cleanName(name), name, 'a name the page hands out is a name'); }
  for (const [typed, kept] of [['Robin', 'Robin'], ['  J. R.   Hartley ', 'J. R. Hartley'], ['Zoë', 'Zoë'], ['AAA', 'AAA'], ['x_X_x', 'x_X_x'], ["O'Neil", "O'Neil"], ['Łukasz', 'Łukasz'], ['田中', '田中'], ['12345', '12345'], ['a'.repeat(NAME_MAX), 'a'.repeat(NAME_MAX)]]) assert.equal(cleanName(typed), kept);
  for (const bad of ['', '   ', '...', '-', 'a'.repeat(NAME_MAX + 1), '<b>x</b>', 'Robin <script>', 'a&b', '"quoted"', 'visit example.com', 'x.io', 'http me', 'www', 'Robin@home', 'a/b', 'line\u0000break', '🙂', null, 7, {}, ['Robin'], 'A'.repeat(5000)]) assert.equal(cleanName(bad), '', `${JSON.stringify(bad)} was taken for a name`);
  assert.equal(cleanName('two\nlines'), 'two lines', 'a line break is a space');
  // whoever keeps the book says which words it will not take; however they are spelled round, and not words too short to mean it
  assert.deepEqual([blocked('B4dW0rd Bob', ['badword']), blocked('b.a.d w-o-r-d', ['BadWord']), blocked('Robin', ['badword']), blocked('Abe', ['ab']), blocked('anything', [])], [true, true, false, false, false]);
});

test('book: a message is optional, short and plain, and never an address', () => {
  for (const [typed, kept] of [['cool page', 'cool page'], ['  Great   site!  ', 'Great site!'], ['', ''], [undefined, ''], [null, ''], ['   ', ''], ['P.S. hello (really)', 'P.S. hello (really)'], ['Nice page. Thanks', 'Nice page. Thanks'], ['x'.repeat(MESSAGE_MAX), 'x'.repeat(MESSAGE_MAX)]]) assert.equal(cleanMessage(typed), kept);
  for (const bad of ['x'.repeat(MESSAGE_MAX + 1), 'see example.com', 'http me', 'go to www now', '<b>hi</b>', 'a & b', '"quoted"', 'mail me@home', 'path/to', '🙂', 7, {}, ['hi'], 'x'.repeat(5000)]) assert.equal(cleanMessage(bad), null, `${JSON.stringify(bad).slice(0, 40)} was taken for a message`);
  assert.equal(blocked('what a b4dw0rd', ['badword']), true, 'the keeper\'s blocked words are looked for in a message as in a name');
});

test('book: a visit is counted again here, and held to what a building allows', () => {
  const ok = checkRun(visit());
  assert.deepEqual([ok.ok, ok.score], [true, scoreRun(cleanRun(visit())).total]);
  assert.equal(checkRun({ ...visit(), score: 999999, total: 999999 }).score, ok.score, 'what a visit says it scored is not asked');
  const refused = (over, why) => { const r = checkRun(visit(over)); assert.equal(r.ok, false, `${JSON.stringify(over)} was entered`); assert.match(r.why, why); };
  refused({ reason: 'caught' }, /did not get out/); refused({ reason: 'quit' }, /did not get out/); refused({ reason: 'battery' }, /did not get out/);
  refused({ seed: '' }, /seed/); refused({ seed: 'a b' }, /seed/); refused({ seed: '<x>' }, /seed/); refused({ seed: 'x'.repeat(60) }, /seed/);
  refused({ parts: { reached: 1, of: 1 } }, /parts/); refused({ parts: { reached: 2, of: 3 } }, /parts/); refused({ parts: { reached: 9, of: 9 } }, /parts/);
  refused({ rooms: { explored: 3, kinds: [] } }, /rooms/); refused({ rooms: { explored: 500, kinds: [] } }, /rooms/);
  refused({ rooms: { explored: 40, kinds: Array.from({ length: 30 }, (_, i) => `room-${i}`) } }, /room kinds/);
  refused({ seconds: 5 }, /time/); refused({ seconds: 90000 }, /time/);
  refused({ batteries: 150 }, /batteries/);
  refused({ hearts: { left: 0, of: 4 } }, /hearts/); refused({ hearts: { left: 9, of: 9 } }, /hearts/); refused({ hearts: undefined }, /hearts/);
  refused({ hearts: { left: 1, of: 1 } }, /hearts/); refused({ hearts: { left: 5, of: 5 } }, /hearts/); refused({ hearts: { left: 0, of: 2 } }, /hearts/);
  assert.equal(checkRun(visit({ hearts: { left: 2, of: 2 } })).ok, true, 'Night Cleaner (2/2 max hearts) can sign the book');
  assert.equal(checkRun(visit({ hearts: { left: 3, of: 3 } })).ok, true, 'Records Purge (3/3 max hearts) can sign the book');
  refused({ cast: { met: [], survived: 190 } }, /encounters/);
  for (const bad of [null, 'a visit', [visit()], 7]) assert.equal(checkRun(bad).ok, false);
  // the most a visit inside the limits can come to is a number, not anything anybody likes
  const most = checkRun(visit({ seconds: LIMITS.secondsPerPart * 5, parts: { reached: 5, of: 5 }, rooms: { explored: 140, kinds: Array.from({ length: 40 }, (_, i) => `room-${i}`) }, cast: { met: ['pirate'], survived: 20 }, batteries: 30, card: true, hearts: { left: 4, of: 4 } }));
  assert.ok(most.ok && most.score < 10000, `the best there could be is ${most.score}`);
});

test('book: a line of the book is what is kept of a visit, and one that comes back damaged is no line', () => {
  const { run, score } = checkRun(visit());
  const entry = entryOf({ id: 'abc123def456', at: 1794000000000, name: 'Amber Vireo', message: 'cool page', run, score });
  assert.deepEqual(entry, { id: 'abc123def456', at: 1794000000000, name: 'Amber Vireo', message: 'cool page', score, seconds: 240, parts: 3, rooms: 31, batteries: 2, hearts: 3, card: false, seed: 'k3j9x0qa1b', edition: 'wuuhge' });
  assert.equal(entryOf({ id: 'abc123def456', at: 1, name: 'Robin', run, score }).message, '', 'a message is optional');
  assert.deepEqual(cleanEntry(JSON.stringify(entry)), entry);
  assert.deepEqual(cleanEntry(entry), entry);
  for (const bad of ['', 'not json', '[]', JSON.stringify({ ...entry, name: 'Robin <script>' }), JSON.stringify({ ...entry, name: 'see example.com' }), JSON.stringify({ ...entry, seed: 'a b' }), JSON.stringify({ ...entry, id: '../x' }), null, 4]) assert.equal(cleanEntry(bad), null);
  // a message in a stored line that could not have been kept is dropped, not shown; numbers are made whole and kept in range
  const odd = cleanEntry({ ...entry, message: '<img src=x onerror=alert(1)>', score: '12.9', hearts: 99, extra: 'x' });
  assert.deepEqual([odd.message, odd.score, odd.hearts, 'extra' in odd], ['', 12, 12, false]);
});

/* ---- the keeping of it ---------------------------------------------------------------------------- */

const SITE = 'https://example.app';
function book() {
  let clock = 1794000000000;
  const store = memoryStore(() => clock), ctx = { store, now: () => clock, salt: 'test', blocklist: ['badword'], adminKey: 'a-key-only-the-keeper-has' };
  const ask = async (method, body, { ip = '203.0.113.7', headers = {} } = {}) => {
    const res = await handle(new Request(`${SITE}/api/book`, { method, headers: { 'x-forwarded-for': ip, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), ctx);
    return { status: res.status, headers: res.headers, data: await res.json() };
  };
  return { store, ctx, ask, read: () => ask('GET'), post: (body, opt) => ask('POST', body, opt), later: (seconds) => { clock += seconds * 1000; } };
}
const message = 'cool page';

test('book api: an empty book reads as an empty book, and a page somebody opens is counted once for a while', async () => {
  const b = book();
  const empty = await b.read();
  assert.deepEqual([empty.status, empty.data], [200, { ok: true, counter: { hits: 0, in: 0, out: 0 }, top: [], latest: [] }]);
  assert.match(empty.headers.get('cache-control'), /s-maxage=10/, 'readers share one reading for a few seconds');
  assert.deepEqual((await b.post({ do: 'hit' })).data, { ok: true, counted: true, counter: { hits: 1, in: 0, out: 0 } });
  assert.deepEqual((await b.post({ do: 'hit' })).data, { ok: true, counted: false, counter: { hits: 1, in: 0, out: 0 } }, 'the same visitor, a moment later, is the same visit');
  assert.equal((await b.post({ do: 'hit' }, { ip: '198.51.100.9' })).data.counter.hits, 2, 'somebody else is somebody else');
  b.later(AGAIN.hit + 1);
  assert.equal((await b.post({ do: 'hit' })).data.counter.hits, 3, 'and the same visitor much later is another visit');
  assert.deepEqual((await b.post({ do: 'in' })).data.counter, { hits: 3, in: 1, out: 0 });
  assert.equal((await b.post({ do: 'in' })).data.counted, false);
  // nobody's address is kept: only a hash of it, with a salt, for as long as it takes not to count them twice
  const keys = [...b.store.data.keys()];
  assert.ok(keys.every((k) => !/203\.0\.113|198\.51\.100/.test(k)), keys.join(' '));
});

test('book api: somebody who got out signs once; the line is what the rules make of what they sent', async () => {
  const b = book();
  const signed = await b.post({ do: 'sign', name: 'Amber Vireo', run: visit(), message });
  assert.deepEqual([signed.status, signed.data.ok, signed.data.place], [200, true, 1]);
  const { entry } = signed.data;
  assert.deepEqual([entry.name, entry.score, entry.seed, entry.message, entry.at], ['Amber Vireo', checkRun(visit()).score, 'k3j9x0qa1b', 'cool page', 1794000000000]);
  assert.match(entry.id, /^[a-z0-9]{18}$/);
  const read = (await b.read()).data;
  assert.deepEqual([read.counter.out, read.top, read.latest], [1, [entry], [entry]]);
  // the same building under the same name is already in the book, whoever sends it and whenever
  b.later(AGAIN.sign + 1);
  assert.deepEqual([(await b.post({ do: 'sign', name: 'Amber Vireo', run: visit({ batteries: 9 }), message }, { ip: '198.51.100.9' })).status, (await b.read()).data.top.length], [409, 1]);
  // somebody else got out of that building too: that is another line (and a better one goes above)
  b.later(AGAIN.sign + 1);
  const other = await b.post({ do: 'sign', name: 'Slate Okapi', run: visit({ batteries: 6, hearts: { left: 4, of: 4 } }) }, { ip: '198.51.100.9' });
  assert.deepEqual([other.status, other.data.place], [200, 1]);
  const after = (await b.read()).data;
  assert.deepEqual([after.top.map((e) => e.name), after.latest.map((e) => e.name), after.counter.out], [['Slate Okapi', 'Amber Vireo'], ['Slate Okapi', 'Amber Vireo'], 2]);
  // line after line from the same hand: the second waits
  const fast = await b.post({ do: 'sign', name: 'Mossy Quoll', run: visit({ seed: 'another-one' }), message }, { ip: '198.51.100.9' });
  assert.deepEqual([fast.status, fast.headers.get('retry-after')], [429, String(AGAIN.sign)]);
  b.later(AGAIN.sign + 1);
  assert.equal((await b.post({ do: 'sign', name: 'Mossy Quoll', run: visit({ seed: 'another-one' }), message }, { ip: '198.51.100.9' })).status, 200, 'and is not held against the visit: it was never written');
});

test('book api: what is not a name, a message or a visit is refused, and so is anything that did not come from this site\'s own pages', async () => {
  const b = book();
  const sign = (over, opt) => b.post({ do: 'sign', name: 'Amber Vireo', run: visit(), message, ...over }, opt);
  assert.deepEqual([(await sign({ name: '<b>Amber</b> Vireo' })).status, (await sign({ name: 'buy at example.com' })).status, (await sign({ name: 'x'.repeat(40) })).status, (await sign({ name: '' })).status], [400, 400, 400, 400]);
  const rude = await sign({ name: 'B4dw0rd Bob' });
  assert.deepEqual([rude.status, rude.data.why, rude.data.text], [400, 'name', 'Name not allowed.'], 'a word the keeper has said the book will not take, however it is spelled');
  assert.deepEqual([(await sign({ message: 'buy cheap batteries at example.com' })).status, (await sign({ message: 7 })).status, (await sign({ message: 'x'.repeat(200) })).status, (await sign({ message: 'what a b4dw0rd' })).data.why], [400, 400, 400, 'message']);
  for (const run of [visit({ reason: 'caught' }), visit({ seconds: 3 }), visit({ batteries: 199 }), visit({ parts: { reached: 1, of: 1 } }), null, 'x']) assert.equal((await sign({ run })).status, 422);
  assert.deepEqual((await b.read()).data.top, [], 'none of it is in the book');
  assert.equal((await b.ask('POST', JSON.stringify({ do: 'hit' }), { headers: { 'content-type': 'text/plain' } })).status, 415, 'a form on somebody else\'s page can only send plain text: that is not taken');
  assert.equal((await b.post({ do: 'hit' }, { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await b.post({ do: 'hit' }, { headers: { 'sec-fetch-site': 'same-origin' } })).status, 200);
  assert.equal((await b.post('{ not json')).status, 400);
  assert.equal((await b.post([1, 2])).status, 400);
  assert.equal((await b.post({ do: 'erase' })).status, 400);
  assert.equal((await b.post({ do: 'sign', name: 'Amber Vireo', run: visit(), message, pad: 'x'.repeat(5000) })).status, 413);
  assert.equal((await b.ask('DELETE')).status, 405);
});

test('book api: somebody signs with the name they typed; whoever keeps the book can strike a line out, and nobody else can', async () => {
  const b = book();
  const robin = (await b.post({ do: 'sign', name: '  Robin   of Stores ', run: visit(), message: '  great   site ' })).data;
  assert.deepEqual([robin.ok, robin.entry.name, robin.entry.message], [true, 'Robin of Stores', 'great site']);
  b.later(AGAIN.sign + 1);
  const other = (await b.post({ do: 'sign', name: 'ZZZ', run: visit({ seed: 'second-tape' }) })).data;
  assert.deepEqual((await b.read()).data.top.map((e) => e.name).sort(), ['Robin of Stores', 'ZZZ']);
  for (const key of [undefined, '', 'wrong', 'a-key-only-the-keeper-haz', 'a-key-only-the-keeper-has-and-more']) assert.equal((await b.post({ do: 'strike', id: robin.entry.id, key })).status, 403);
  assert.equal((await b.post({ do: 'strike', id: 'nosuchline000', key: 'a-key-only-the-keeper-has' })).status, 404);
  assert.deepEqual((await b.post({ do: 'strike', id: robin.entry.id, key: 'a-key-only-the-keeper-has' })).data, { ok: true, struck: 1 });
  const after = (await b.read()).data;
  assert.deepEqual([after.top.map((e) => e.id), after.latest.map((e) => e.id)], [[other.entry.id], [other.entry.id]]);
  // with no key set on the host, nothing can be struck by anybody
  const open = await handle(new Request(`${SITE}/api/book`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'strike', id: other.entry.id, key: '' }) }), { store: b.store });
  assert.equal(open.status, 403);
});

test('book api: the book keeps its hundred best and its last hundred, and shows the top of each', async () => {
  const b = book();
  for (let i = 0; i < KEEP.top + 12; i++) {
    b.later(AGAIN.sign + 1);
    const r = await b.post({ do: 'sign', name: `${FIRST[i % FIRST.length]} ${SECOND[(i * 7) % SECOND.length]}`, run: visit({ seed: `tape-${1000 + i}`, batteries: i % 20, rooms: { explored: 20 + (i % 60), kinds: [] } }) });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  const read = (await b.read()).data;
  assert.deepEqual([read.top.length, read.latest.length, read.counter.out], [KEEP.showTop, KEEP.showLatest, KEEP.top + 12]);
  assert.ok(read.top.every((e, i) => i === 0 || read.top[i - 1].score >= e.score), 'best first');
  assert.equal(read.latest[0].seed, `tape-${1000 + KEEP.top + 11}`, 'newest first');
  assert.equal(b.store.data.get('br:top').size, KEEP.top); assert.equal(b.store.data.get('br:latest').length, KEEP.latest);
});

test('book api: with nowhere to keep it there is no book, and the site is told so plainly; a store that fails is not a crash', async () => {
  const none = await handle(new Request(`${SITE}/api/book`), { store: null });
  assert.deepEqual([none.status, (await none.json()).why], [503, 'no-store']);
  assert.equal(createStore({}), null);
  assert.equal(createStore({ KV_REST_API_URL: 'http://not-https.example', KV_REST_API_TOKEN: 't' }), null);
  const broken = await handle(new Request(`${SITE}/api/book`), { store: { pipeline: async () => { throw new Error('down'); } } });
  assert.deepEqual([broken.status, (await broken.json()).why], [502, 'store']);
  // the real store speaks to its address over fetch, with the token, one request for a list of commands
  const calls = [];
  const store = createStore({ UPSTASH_REDIS_REST_URL: 'https://store.example/', UPSTASH_REDIS_REST_TOKEN: 'secret' }, async (url, init) => { calls.push([url, init.method, init.headers.authorization, init.body]); return new Response(JSON.stringify([{ result: 1 }, { result: 'x' }])); });
  assert.deepEqual(await store.pipeline([['INCR', 'k'], ['GET', 'k']]), [1, 'x']);
  assert.deepEqual(calls, [['https://store.example/pipeline', 'POST', 'Bearer secret', '[["INCR","k"],["GET","k"]]']]);
  const refuses = createStore({ KV_REST_API_URL: 'https://store.example', KV_REST_API_TOKEN: 't' }, async () => new Response(JSON.stringify([{ error: 'ERR wrong kind' }])));
  await assert.rejects(refuses.pipeline([['INCR', 'k']]), /refused/);
});
