import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../tools/blockrooms/cloudflare/worker.mjs';
import { createStore, storeTrouble } from '../tools/blockrooms/book-store.mjs';
import { handle } from '../tools/blockrooms/book-api.mjs';

const KEY = 'private-test-key-never-used-by-a-real-service', URL = 'https://book.example/book';
const run = { reason: 'exit', seed: 'a-test-building', seconds: 240, parts: { reached: 3, of: 3 },
  rooms: { explored: 31, kinds: ['party'] }, cast: { met: ['pirate'], survived: 1 }, batteries: 2,
  hearts: { left: 3, of: 4 }, edition: 'wuuhge', mascot: true, card: false };
const req = body => new Request('https://blockrooms.example/api/book', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', cookie: 'not-for-the-store' }, body: JSON.stringify(body),
});

test('book remote: keeps public validation in Vercel, sends only sanitized entries and visitor hashes to the private store', async () => {
  const calls = [], operations = [], worker = createWorker(() => ({
    read: async () => ({ counter: { hits: 2, in: 1, out: 0 }, top: [], latest: [] }),
    count: async (...args) => { operations.push(['count', ...args]); return { counted: true, counter: { hits: 3, in: 1, out: 0 } }; },
    sign: async (...args) => { operations.push(['sign', ...args]); return { ok: true, place: 1 }; },
    strike: async id => { operations.push(['strike', id]); return 1; },
  }));
  const store = createStore({ BOOK_STORE_URL: URL, BOOK_STORE_KEY: KEY }, async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body, redirect: init.redirect });
    return worker.fetch(new Request(url, init), { DB: {}, BOOK_STORE_KEY: KEY });
  });
  const ctx = { store, salt: 'a-private-salt', adminKey: 'the-keeper-has-this-key', checks: false };
  assert.equal((await handle(req({ do: 'sign', name: '<script>', run }), ctx)).status, 400);
  assert.equal(calls.length, 0, 'invalid user input never reaches the storage service');
  const signed = await handle(req({ do: 'sign', name: 'Amber Vireo', message: 'Found the stairs', run }), ctx);
  assert.equal(signed.status, 200);
  const body = await signed.json();
  assert.equal(body.place, 1);
  assert.equal(operations[0][1].name, 'Amber Vireo');
  assert.match(operations[0][2], /^[\w-]{22}$/);
  assert.match(operations[0][3], /^[\w-]{22}$/);
  assert.ok(!JSON.stringify(calls).includes('203.0.113.7'));
  assert.ok(!JSON.stringify(calls).includes('not-for-the-store'));
  assert.equal(calls[0].headers.authorization, `Bearer ${KEY}`);
  assert.equal(calls[0].redirect, 'error', 'credentials cannot follow a redirect');
  assert.equal((await handle(req({ do: 'hit' }), ctx)).status, 200);
  const read = await handle(new Request('https://blockrooms.example/api/book'), ctx);
  assert.match(read.headers.get('cache-control'), /s-maxage=10/);
  assert.deepEqual((await read.json()).counter, { hits: 2, in: 1, out: 0 });
  assert.equal((await handle(req({ do: 'strike', id: body.entry.id, key: 'the-keeper-has-this-key' }), ctx)).status, 200);
  assert.equal(operations.at(-1)[0], 'strike');
  const before = operations.length;
  const missing = await handle(req({ do: 'strike', id: '../', key: 'the-keeper-has-this-key' }), ctx);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).why, 'line');
  assert.equal(operations.length, before, 'a malformed moderation id is a missing line, not a storage failure');
});

test('book remote: duplicate and rate-limit outcomes retain the public API contract', async () => {
  for (const [why, status] of [['slow', 429], ['signed', 409]]) {
    const res = await handle(req({ do: 'sign', name: 'Amber Vireo', run }), { store: { sign: async () => ({ ok: false, why }) }, checks: false });
    assert.equal(res.status, status);
    assert.equal((await res.json()).why, why);
    if (why === 'slow') assert.equal(res.headers.get('retry-after'), '20');
  }
});

test('book remote: requires HTTPS and a private key, and fails closed on bad responses', async () => {
  for (const url of ['http://book.example/book', 'https://user:pass@book.example/book', 'https://book.example/book?key=x', 'not-a-url']) {
    assert.equal(createStore({ BOOK_STORE_URL: url, BOOK_STORE_KEY: KEY }), null);
  }
  assert.equal(createStore({ BOOK_STORE_URL: URL, BOOK_STORE_KEY: 'short' }), null);
  assert.equal(createStore({ BOOK_STORE_URL: URL, KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'x' }), null, 'an incomplete preferred store never silently uses Redis');
  for (const response of [new Response('', { status: 502 }), new Response('{}'), new Response('{')]) {
    const store = createStore({ BOOK_STORE_URL: URL, BOOK_STORE_KEY: KEY }, async () => response);
    await assert.rejects(store.read());
  }
});

test('book worker: the internet cannot read or write the private database; malformed actions never touch it', async () => {
  let touched = 0;
  const worker = createWorker(() => { touched++; return {}; }), env = { DB: {}, BOOK_STORE_KEY: KEY };
  const request = (body, over = {}) => new Request(URL, {
    method: 'POST', headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body), ...over,
  });
  assert.equal((await worker.fetch(request({ action: 'read' }, { headers: {} }), env)).status, 401);
  assert.equal((await worker.fetch(request({ action: 'read' }, { headers: { authorization: `Bearer ${KEY}x` } }), env)).status, 401);
  assert.equal((await worker.fetch(request({ action: 'read' }), { DB: {} })).status, 503);
  assert.equal((await worker.fetch(new Request(URL), env)).status, 405);
  assert.equal((await worker.fetch(request('x'.repeat(9000)), env)).status, 413);
  assert.equal((await worker.fetch(request('{invalid'), env)).status, 400);
  assert.equal(touched, 0);
  assert.equal((await worker.fetch(request({ action: 'count', kind: 'erase', visitor: 'x'.repeat(22) }), env)).status, 400);
  assert.equal((await worker.fetch(request({ action: 'sign', entry: {}, visitor: 'x'.repeat(22), duplicate: 'y'.repeat(22) }), env)).status, 400);
  assert.equal((await worker.fetch(request({ action: 'strike', id: '../' }), env)).status, 400);
});

test('book store: with no store, the host is told which setting is wrong and nobody is told what it is set to', async () => {
  const redis = { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'a-token-that-is-nobodys-business' };
  const cases = [
    [{}, 'none', /no store settings reach this deployment/],
    [{ BOOK_STORE_URL: URL }, 'incomplete', /^BOOK_STORE_KEY is not set$/],
    [{ BOOK_STORE_KEY: KEY }, 'incomplete', /^BOOK_STORE_URL is not set$/],
    [{ BOOK_STORE_URL: URL, BOOK_STORE_KEY: 'a-key-that-is-too-short' }, 'incomplete', /^BOOK_STORE_KEY is shorter than 32 characters$/],
    [{ BOOK_STORE_URL: 'http://book.example/book', BOOK_STORE_KEY: KEY }, 'incomplete', /^BOOK_STORE_URL is not an https address$/],
    [{ BOOK_STORE_URL: 'https://book.example/book?key=a-secret-in-the-address', BOOK_STORE_KEY: KEY }, 'incomplete', /^BOOK_STORE_URL has a name, a query or a fragment in it$/],
    [{ BOOK_STORE_URL: 'not-a-url', BOOK_STORE_KEY: KEY }, 'incomplete', /^BOOK_STORE_URL is not an address$/],
    [{ BOOK_STORE_URL: URL, ...redis }, 'incomplete', /^BOOK_STORE_KEY is not set$/],   // (the preferred store, half set: Redis is not quietly used instead)
    [{ KV_REST_API_TOKEN: redis.KV_REST_API_TOKEN }, 'incomplete', /address is not/],
    [{ KV_REST_API_URL: 'http://redis.example', KV_REST_API_TOKEN: redis.KV_REST_API_TOKEN }, 'incomplete', /not an https address/],
    [{ UPSTASH_REDIS_REST_URL: 'https://redis.example' }, 'incomplete', /token is not/],
    [{ BOOK_STORE_URL: URL, BOOK_STORE_KEY: KEY }, null],
    [redis, null],
  ];
  for (const [env, settings, says] of cases) {
    const trouble = storeTrouble(env), store = createStore(env, async () => new Response('{}'));
    assert.equal(trouble === null, store !== null, `the reason and the store agree about ${JSON.stringify(Object.keys(env))}`);
    if (settings === null) { assert.equal(trouble, null); continue; }
    assert.equal(trouble.settings, settings);
    assert.match(trouble.says, says);
    for (const value of Object.values(env)) assert.ok(!trouble.says.includes(value), 'a setting is named and never repeated');
    // what anybody outside is told is one word of the two, beside the answer the page already understands
    const res = await handle(new Request('https://blockrooms.example/api/book'), { store, settings: trouble.settings });
    assert.deepEqual([res.status, await res.json()], [503, { ok: false, why: 'no-store', settings }]);
    assert.equal(res.headers.get('cache-control'), 'no-store', 'so the first answer after it is connected is not an old one');
  }
  // and nothing but those two words gets out that way
  for (const settings of [undefined, '', 'BOOK_STORE_KEY is shorter than 32 characters', { says: 'x' }]) {
    const res = await handle(new Request('https://blockrooms.example/api/book'), { store: null, settings });
    assert.deepEqual(await res.json(), { ok: false, why: 'no-store' });
  }
});

test('book function: says why it has no store once, in the log, when it starts', async () => {
  const fn = (await import('node:fs')).readFileSync(new globalThis.URL('../api/book.mjs', import.meta.url), 'utf8');
  assert.match(fn, /const trouble = storeTrouble\(\);\nif \(trouble\) console\.warn\(`\[book\] no store: \$\{trouble\.says\}`\);/);
  assert.match(fn, /settings: trouble \? trouble\.settings : '',/);
  assert.equal(fn.match(/console\./g).length, 1, 'and that is all it ever writes there');
});
