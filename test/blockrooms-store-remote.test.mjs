import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../tools/blockrooms/cloudflare/worker.mjs';
import { createStore } from '../tools/blockrooms/book-store.mjs';
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
  const ctx = { store, salt: 'a-private-salt', adminKey: 'the-keeper-has-this-key' };
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
    const res = await handle(req({ do: 'sign', name: 'Amber Vireo', run }), { store: { sign: async () => ({ ok: false, why }) } });
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
