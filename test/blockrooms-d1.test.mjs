import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createD1Store } from '../tools/blockrooms/cloudflare/book-d1.mjs';
import { KEEP, AGAIN } from '../tools/blockrooms/book-policy.mjs';

// The Office still supports Node 20; these database tests need the Node 22
// SQLite builtin. They run here without downloading a database or a driver.
const { DatabaseSync } = await import('node:sqlite').catch(() => ({}));
const sqlTest = (name, fn) => test(name, { skip: !DatabaseSync && 'needs Node 22 with node:sqlite' }, fn);

const migration = readFileSync(new URL('../tools/blockrooms/cloudflare/migrations/0001_book.sql', import.meta.url), 'utf8');

// D1 serializes its transactional batches. Run the exact prepared statements
// against real SQLite, with the same all-or-nothing boundary and queued
// concurrent callers. This is SQL verification, not a Map emulating SQL.
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  db.exec(migration); // harmless if deployment retries the migration
  t.after(() => db.close());
  let clock = 1794000000000, serial = 0, queue = Promise.resolve(), fail = null;
  const binding = {
    prepare(sql) { return { bind: (...values) => ({ sql, values }) }; },
    batch(statements) {
      const job = queue.then(() => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const results = statements.map(({ sql, values }) => {
            const rows = db.prepare(sql).all(...values).map(row => ({ ...row }));
            if (fail?.(sql)) throw new Error('injected database failure');
            return { success: true, results: rows };
          });
          db.exec('COMMIT');
          return results;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      });
      queue = job.catch(() => {});
      return job;
    },
  };
  const store = createD1Store(binding, { now: () => clock, token: () => `operation-${++serial}` });
  return { db, store, now: () => clock, later: seconds => { clock += seconds * 1000; }, fault: fn => { fail = fn; } };
}

const entry = (n, score = n) => ({
  id: `entry${String(n).padStart(6, '0')}`, at: 1794000000000 + n, name: "O'Neil", message: 'Found the stairs.',
  score, seconds: 240, parts: 3, rooms: 20, batteries: 2, hearts: 3, card: false, seed: `seed-${n}`,
});

sqlTest('D1 book: concurrent counts claim their own TTL guards and increment once', async t => {
  const f = fixture(t), { store } = f;
  assert.deepEqual(await store.read(), { counter: { hits: 0, in: 0, out: 0 }, top: [], latest: [] });
  const same = await Promise.all(Array.from({ length: 24 }, () => store.count('hit', 'same-visitor')));
  assert.equal(same.filter(result => result.counted).length, 1);
  await Promise.all(Array.from({ length: 20 }, (_, n) => store.count('hit', `visitor-${n}`)));
  assert.deepEqual((await store.read()).counter, { hits: 21, in: 0, out: 0 });
  assert.equal((await store.count('in', 'same-visitor')).counted, true, 'entry and page-hit guards are independent');
  assert.equal((await store.count('in', 'same-visitor')).counted, false);
  f.later(AGAIN.in);
  assert.equal((await store.count('in', 'same-visitor')).counted, true, 'expiry is inclusive at its exact millisecond');
  assert.equal((await store.count('hit', 'same-visitor')).counted, false);
  f.later(AGAIN.hit - AGAIN.in);
  assert.equal((await store.count('hit', 'same-visitor')).counted, true);
  assert.deepEqual((await store.read()).counter, { hits: 22, in: 2, out: 0 });
  await assert.rejects(store.count('escaped', 'visitor'), /counter/);
});

sqlTest('D1 book: simultaneous signatures cannot duplicate a run or bypass the signing cooldown', async t => {
  const f = fixture(t), { store } = f;
  const signed = await Promise.all(Array.from({ length: 18 }, (_, n) => store.sign(entry(n, 100), `visitor-${n}`, 'one-name-and-seed')));
  assert.equal(signed.filter(result => result.ok).length, 1);
  assert.equal(signed.filter(result => result.why === 'signed').length, 17);
  assert.deepEqual(signed[0], { ok: true, place: 1 });
  assert.deepEqual((await store.read()).counter, { hits: 0, in: 0, out: 1 });
  assert.deepEqual(await store.sign(entry(100, 200), 'visitor-0', 'different-seed'), { ok: false, why: 'slow' });
  f.later(AGAIN.sign);
  assert.deepEqual(await store.sign(entry(100, 200), 'visitor-0', 'different-seed'), { ok: true, place: 1 });
  assert.equal((await store.read()).top[0].name, "O'Neil", 'values are bound, including apostrophes');
  f.later(AGAIN.sign);
  assert.deepEqual(await store.sign(entry(101), 'visitor-0', 'one-name-and-seed'), { ok: false, why: 'signed' });
  f.later(AGAIN.same);
  assert.equal((await store.sign(entry(102), 'visitor-0', 'one-name-and-seed')).ok, true, 'the seed/name guard lasts 90 days, not forever');
  assert.equal((await store.read()).counter.out, 3);
});

sqlTest('D1 book: retains independent bounded top/latest sets without reviving evicted lines after moderation', async t => {
  const { db, store } = fixture(t);
  const results = await Promise.all(Array.from({ length: 300 }, (_, n) => store.sign(entry(n, 1000 - n), `visitor-${n}`, `seed-name-${n}`)));
  assert.ok(results.every(result => result.ok));
  assert.equal(results[299].place, null, 'a valid low score can be outside the retained best hundred');
  const sizes = () => ({ ...db.prepare('SELECT COUNT(*) AS kept, SUM(top) AS top, SUM(latest) AS latest FROM br_entries').get() });
  assert.deepEqual(sizes(), { kept: 200, top: KEEP.top, latest: KEEP.latest });
  const read = await store.read();
  assert.equal(read.top.length, KEEP.showTop);
  assert.equal(read.latest.length, KEEP.showLatest);
  assert.equal(read.counter.out, 300);
  assert.deepEqual(read.top.map(e => e.id), Array.from({ length: KEEP.showTop }, (_, n) => entry(n).id));
  assert.deepEqual(read.latest.map(e => e.id), Array.from({ length: KEEP.showLatest }, (_, n) => entry(299 - n).id));

  assert.equal(await store.strike(entry(0).id), 1);
  assert.equal(await store.strike(entry(0).id), 0);
  assert.equal(await store.strike(entry(299).id), 1);
  assert.deepEqual(sizes(), { kept: 198, top: 99, latest: 99 });
  assert.equal(db.prepare('SELECT top FROM br_entries WHERE id = ?').get(entry(200).id).top, 0, 'a latest-only line cannot fill the hole in the top list');
  assert.equal(db.prepare('SELECT latest FROM br_entries WHERE id = ?').get(entry(99).id).latest, 0, 'a top-only line cannot fill the hole in the latest list');
  assert.deepEqual(await store.sign(entry(400, 1500), 'visitor-400', 'seed-name-400'), { ok: true, place: 1 });
  assert.deepEqual(sizes(), { kept: 199, top: 100, latest: 100 });
  assert.equal((await store.read()).counter.out, 301, 'moderation never subtracts historical exits');
});

sqlTest('D1 book: equal scores keep Redis-compatible lexical ordering and strikes remove a line from both sets', async t => {
  const { store } = fixture(t);
  await store.sign(entry(1, 100), 'visitor-1', 'same-1');
  assert.deepEqual(await store.sign(entry(2, 100), 'visitor-2', 'same-2'), { ok: true, place: 1 });
  assert.deepEqual((await store.read()).top.map(e => e.id), [entry(2).id, entry(1).id]);
  assert.equal(await store.strike(entry(2).id), 1);
  const read = await store.read();
  assert.deepEqual(read.top, read.latest);
  assert.equal(read.top.length, 1);
  assert.equal(read.counter.out, 2);
});

sqlTest('D1 book: failures roll back acquired guards, entries, trimming and counters together', async t => {
  const f = fixture(t), { db, store } = f;
  f.fault(sql => sql.startsWith('UPDATE br_counters SET hits'));
  await assert.rejects(store.count('hit', 'visitor'), /injected/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM br_guards').get().n, 0);
  assert.equal((await store.read()).counter.hits, 0);
  f.fault(null);
  assert.equal((await store.count('hit', 'visitor')).counted, true, 'a failed count did not consume its guard');
  await store.sign(entry(1, 100), 'visitor-1', 'same-1');
  const before = await store.read();
  const beforeGuards = db.prepare('SELECT * FROM br_guards ORDER BY kind, hash').all();
  f.fault(sql => sql === 'DELETE FROM br_entries WHERE top = 0 AND latest = 0');
  await assert.rejects(store.sign(entry(2, 200), 'visitor-2', 'same-2'), /injected/);
  assert.deepEqual(await store.read(), before);
  assert.deepEqual(db.prepare('SELECT * FROM br_guards ORDER BY kind, hash').all(), beforeGuards);
  f.fault(null);
  assert.deepEqual(await store.sign(entry(2, 200), 'visitor-2', 'same-2'), { ok: true, place: 1 }, 'a failed sign is retryable without waiting');
  await assert.rejects(store.sign(entry(3, -1), 'visitor-3', 'same-3'), /CHECK constraint/);
  assert.equal((await store.sign(entry(3, 300), 'visitor-3', 'same-3')).ok, true, 'SQL constraint failures also roll back guards');
});

sqlTest('D1 book: indexed expiry cleanup is bounded and an expired guard yields even before cleanup reaches it', async t => {
  const f = fixture(t), { db, store } = f, put = db.prepare('INSERT INTO br_guards (kind, hash, expires, token) VALUES (?, ?, ?, ?)');
  for (let n = 0; n < 300; n++) put.run('hit', `old-${n}`, f.now() - 10, 'past');
  put.run('hit', 'last-expired', f.now() - 1, 'past');
  put.run('same', 'unexpired-run', f.now() + AGAIN.same * 1000, 'keep');
  assert.equal((await store.count('hit', 'last-expired')).counted, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM br_guards WHERE expires <= ?').get(f.now()).n, 44, 'only 256 expired rows are deleted in a write');
  assert.equal(db.prepare("SELECT token FROM br_guards WHERE kind = 'same' AND hash = 'unexpired-run'").get().token, 'keep');
  const plan = db.prepare('EXPLAIN QUERY PLAN SELECT kind, hash FROM br_guards WHERE expires <= ? ORDER BY expires LIMIT 256').all(f.now());
  assert.ok(plan.some(row => row.detail.includes('br_guards_expiry')), 'cleanup uses the expiry index instead of scanning the whole guard table');
});
