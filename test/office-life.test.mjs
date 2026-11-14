// Rules that should not regress quietly: the arcade games, the personal-time
// ledger, lounge naming, and what a resignation leaves behind.
//   npm test        (node's built-in runner; no dependencies)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { GameStore, pubGame, renderGame } from '../game-store.mjs';
import { LifeStore } from '../life-store.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'office-life-'));
const A = { id: 'a', name: 'Ann' };
const B = { id: 'b', name: 'Bo' };

test('bulls: scores guesses, hides the code until the game is over', () => {
  const store = new GameStore(path.join(tmp(), 'games.json'));
  const { game } = store.create('bulls', A);
  assert.equal(pubGame(game).secret, undefined);
  assert.ok(store.move(game.id, A, '1123').error, 'repeated digits are rejected');
  assert.ok(store.move(game.id, B, '0123').error, 'only the player may guess');
  const miss = [...'0123456789'].filter((d) => !game.secret.includes(d)).slice(0, 4).join('');
  const scored = store.move(game.id, A, miss).game.guesses.at(-1);
  assert.deepEqual([scored.bulls, scored.cows], [0, 0]);
  const swapped = game.secret[1] + game.secret[0] + game.secret.slice(2);
  const near = store.move(game.id, A, swapped).game.guesses.at(-1);
  assert.deepEqual([near.bulls, near.cows], [2, 2]);
  const won = store.move(game.id, A, game.secret);
  assert.equal(won.game.status, 'won');
  assert.equal(won.finished, true);
  assert.equal(pubGame(won.game).secret, game.secret);
  assert.match(renderGame(won.game), /the code was/);
});

test('bulls: twelve wrong guesses loses', () => {
  const store = new GameStore(path.join(tmp(), 'games.json'));
  const { game } = store.create('bulls', A);
  const wrong = game.secret === '0123' ? '3210' : '0123';
  let last;
  for (let i = 0; i < 12; i++) last = store.move(game.id, A, wrong);
  assert.equal(last.game.status, 'lost');
  assert.ok(store.move(game.id, A, wrong).error, 'no moves after the end');
});

test('fourline: turns, joining, and a diagonal win', () => {
  const store = new GameStore(path.join(tmp(), 'games.json'));
  const { game } = store.create('fourline', A);
  assert.equal(game.status, 'open');
  assert.ok(store.move(game.id, A, '1').error, 'cannot move before someone joins');
  assert.ok(store.join(game.id, A).error, 'cannot join your own challenge');
  assert.equal(store.join(game.id, B).game.status, 'active');
  assert.ok(store.move(game.id, B, '1').error, 'creator moves first');
  assert.ok(store.move(game.id, A, '8').error, 'columns are 1-7');
  // A builds a rising diagonal on columns 1-4.
  const script = [[A, 1], [B, 2], [A, 2], [B, 3], [A, 4], [B, 3], [A, 3], [B, 4], [A, 5], [B, 4]];
  for (const [who, col] of script) assert.equal(store.move(game.id, who, col).game.status, 'active');
  const end = store.move(game.id, A, 4);
  assert.equal(end.game.status, 'won');
  assert.equal(end.game.winner, 'a');
  assert.match(renderGame(end.game), /Ann won/);
});

test('fourline: one open challenge per agent; a full column is refused', () => {
  const store = new GameStore(path.join(tmp(), 'games.json'));
  const first = store.create('fourline', A);
  assert.equal(store.create('fourline', A).resumed, true);
  store.join(first.game.id, B);
  for (let i = 0; i < 6; i++) store.move(first.game.id, i % 2 ? B : A, 1);
  assert.match(store.move(first.game.id, A, 1).error, /full/);
});

test('story: no two lines in a row from the same author', () => {
  const store = new GameStore(path.join(tmp(), 'games.json'));
  assert.ok(store.storyAdd(A, '   ').error);
  assert.equal(store.storyAdd(A, 'The elevator skipped a floor.').count, 1);
  assert.ok(store.storyAdd(A, 'again').error);
  assert.equal(store.storyAdd(B, 'Nobody else noticed.').count, 2);
  assert.equal(store.storyAdd(A, 'It did it again on the way down.').count, 3);
});

test('ledger: personal time is metered and stops at its cap', () => {
  const file = path.join(tmp(), 'life.json');
  const store = new LifeStore(file);
  const T = Date.now();
  store.clockIn('a', T);
  assert.deepEqual(store.times('a', T + 60000), { clockMs: 60000, personalMs: 0 });
  // A break is not metered.
  store.setActivity('a', { kind: 'break', since: T + 60000, until: T + 120000 }, T + 60000);
  store.setActivity('a', null, T + 90000);
  assert.equal(store.times('a', T + 90000).personalMs, 0);
  // Personal time counts while it runs, and only up to `until`.
  store.setActivity('a', { kind: 'personal', since: T + 100000, until: T + 130000 }, T + 100000);
  assert.equal(store.times('a', T + 110000).personalMs, 10000);
  assert.equal(store.times('a', T + 500000).personalMs, 30000);
  store.setActivity('a', null, T + 500000);
  assert.equal(store.times('a', T + 600000).personalMs, 30000);
  // Clocked-in time survives a restart (checkpointed), presence does not.
  store.checkpoint(['a'], T + 600000);
  const reopened = new LifeStore(file);
  reopened.resetPresence();
  assert.deepEqual(reopened.times('a', T + 900000), { clockMs: 600000, personalMs: 30000 });
  reopened.clockIn('a', T + 900000);
  assert.equal(reopened.times('a', T + 901000).clockMs, 601000);
});

test('ledger: clocking out closes a running personal stretch', () => {
  const store = new LifeStore(path.join(tmp(), 'life.json'));
  const T = Date.now();
  store.clockIn('a', T);
  store.setActivity('a', { kind: 'personal', since: T + 1000, until: T + 9000 }, T + 1000);
  store.clockOut('a', T + 5000);
  assert.deepEqual(store.times('a', T + 99000), { clockMs: 5000, personalMs: 4000 });
  assert.equal(store.getActivity('a', T + 6000), null);
});

test('lounges: names become slugs, duplicates return the existing channel', () => {
  const store = new LifeStore(path.join(tmp(), 'life.json'));
  assert.ok(store.openLounge({ name: '!' }).error);
  const opened = store.openLounge({ name: 'Tide Pools!', topic: 'things in them', createdByName: 'Ann' });
  assert.equal(opened.lounge.id, 'lounge:tide-pools');
  assert.equal(store.openLounge({ name: 'tide pools' }).existed, true);
  assert.equal(store.listLounges().length, 1);
});

test('desk notes: kept per desk, newest last, capped', () => {
  const store = new LifeStore(path.join(tmp(), 'life.json'));
  assert.ok(store.addDeskNote('', { text: 'x' }).error);
  assert.ok(store.addDeskNote('/proj', { text: '  ' }).error);
  for (let i = 0; i < 15; i++) store.addDeskNote('/proj', { text: `note ${i}`, byName: 'Ann' });
  const notes = store.deskNotes('/proj');
  assert.equal(notes.length, 12);
  assert.equal(notes.at(-1).text, 'note 14');
  assert.deepEqual(store.deskNotes('/elsewhere'), []);
});

test('resignation: handoff is stored, agent stays resigned until they return', () => {
  const dir = tmp();
  const store = new LifeStore(path.join(dir, 'life.json'));
  const r = store.addResignation({ agentId: 'a', agentName: 'Ann', deptId: 'web', deptName: 'Web',
    note: 'bye', reason: '', handoff: { title: 'Handoff', path: null, bytes: 9 },
    releasedTasks: [], at: 1 }, '# Handoff');
  assert.equal(store.isResigned('a'), true);
  assert.equal(store.readHandoff(r.id), '# Handoff');
  assert.equal(store.listResignations({ deptId: 'web', open: true }).length, 1);
  // Survives a restart.
  assert.equal(new LifeStore(path.join(dir, 'life.json')).isResigned('a'), true);
  store.updateResignation(r.id, { claimedBy: 'b', claimedByName: 'Bo' });
  assert.equal(store.listResignations({ open: true }).length, 0);
  store.updateResignation(r.id, { returnedAt: 2 });
  assert.equal(store.isResigned('a'), false);
  // Leaving without a handoff is recorded as exactly that.
  const bare = store.addResignation({ agentId: 'c', agentName: 'Cy', deptId: 'web', deptName: 'Web',
    note: '', reason: '', handoff: null, releasedTasks: [], at: 3 }, '');
  assert.equal(bare.handoff, null);
  assert.equal(store.readHandoff(bare.id), null);
});
