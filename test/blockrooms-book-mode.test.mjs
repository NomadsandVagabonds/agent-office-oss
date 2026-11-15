// BlockRooms: the score API keeps to the mode it was asked for, whatever the store behind it answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../tools/blockrooms/book-api.mjs';

const entry = (id, more = {}) => ({ id, at: 1, name: 'Olive Heron', message: '', score: 100, seconds: 300, parts: 3, rooms: 30, batteries: 1, hearts: 2, card: false, seed: 'abc123', ...more });
// a store from before modes: it ignores what it is asked for and answers with everything
const old = { read: async () => ({ counter: { hits: 1, in: 1, out: 1 }, top: [entry('aaaaaa1'), entry('aaaaaa2', { difficulty: 'hard', scoring: 1 }), entry('aaaaaa3', { difficulty: 'easy', scoring: 1 })], latest: [] }) };
const ask = async (q) => (await handle(new Request('https://example.test/api/book' + q), { store: old })).json();

test('a table for one mode holds that mode only, even from a store that answers with every score', async () => {
  assert.equal((await ask('')).top.length, 3, 'the combined table has them all');
  assert.deepEqual((await ask('?difficulty=hard')).top.map((e) => e.id), ['aaaaaa2']);
  assert.deepEqual((await ask('?difficulty=easy')).top.map((e) => e.id), ['aaaaaa3']);
  assert.deepEqual((await ask('?difficulty=original')).top.map((e) => e.id), ['aaaaaa1'], 'a score from before modes is an original');
  assert.deepEqual((await ask('?difficulty=normal')).top, []);
});
