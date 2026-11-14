import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JsonFile, Journal } from '../server/persist.mjs';
import { tempDir } from './helpers.mjs';

test('JsonFile writes atomically and reloads what it wrote', () => {
  const file = path.join(tempDir(), 'a.json');
  const store = new JsonFile(file, { defaults: () => ({ n: 0 }), debounceMs: 0 });
  store.data.n = 7; store.save();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).n, 7);
  assert.equal(new JsonFile(file, { defaults: () => ({ n: 0 }) }).data.n, 7);
  assert.deepEqual(fs.readdirSync(path.dirname(file)).filter((f) => f.endsWith('.tmp')), []);
});

test('JsonFile falls back to the backup when the primary is corrupt', () => {
  const file = path.join(tempDir(), 'b.json');
  const store = new JsonFile(file, { defaults: () => ({ n: 0 }), debounceMs: 0, backupEveryMs: 0 });
  store.data.n = 1; store.save();
  store.data.n = 2; store.save();             // this save copies n:1 into .bak first
  fs.writeFileSync(file, '{"n": 2, tru');     // a torn write
  const again = new JsonFile(file, { defaults: () => ({ n: 0 }) });
  assert.equal(again.recoveredFrom, 'backup');
  assert.equal(again.data.n, 1);
  assert.ok(fs.readdirSync(path.dirname(file)).some((f) => f.includes('.corrupt-')), 'keeps the evidence');
});

test('JsonFile uses defaults when nothing usable exists', () => {
  const file = path.join(tempDir(), 'c.json');
  fs.writeFileSync(file, 'not json');
  const store = new JsonFile(file, { defaults: () => ({ fresh: true }) });
  assert.equal(store.recoveredFrom, 'defaults');
  assert.equal(store.data.fresh, true);
});

test('Journal appends, tails, answers "since", and rotates', () => {
  const file = path.join(tempDir(), 'j.jsonl');
  const j = new Journal(file, { maxBytes: 400, tail: 5 });
  for (let i = 0; i < 12; i++) j.append({ kind: 'x', text: 'line ' + i });
  j.flush();
  assert.equal(j.recent(3).length, 3);
  assert.equal(j.recent(99).length, 5, 'tail is bounded');
  const cut = j.recent(5)[2].t;
  assert.ok(j.since(cut - 1).length >= 1);
  for (let i = 0; i < 30; i++) j.append({ kind: 'y', text: 'more ' + i });
  j.flush();
  assert.ok(fs.existsSync(file + '.1'), 'rotated');
  const reopened = new Journal(file, { tail: 5 });
  assert.ok(reopened.recent(5).length > 0, 'primes its tail from disk');
});
