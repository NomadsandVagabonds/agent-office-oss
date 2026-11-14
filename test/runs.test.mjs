// What a visit to the place that pays was worth, and what the office keeps of
// it: the score, the best, what was met for the first time, the tapes of the
// visits that got out — and that none of it can be made up by whoever reports it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startOffice } from './helpers.mjs';
import { ENDINGS, POINTS, TAPES_KEPT, cleanRecord, cleanRun, emptyRecord, scoreRun, settleRun } from '../core/runs.mjs';

const visit = (over = {}) => ({ reason: 'exit', seed: 'tape-1', seconds: 400, parts: { reached: 3, of: 3 }, rooms: { explored: 40, kinds: ['kanban', 'party'] },
  cast: { met: ['pirate'], survived: 2 }, batteries: 3, card: true, hearts: { left: 2, of: 4 }, ...over });

test('runs: a visit is made safe to keep — whole numbers in range, ids that are ids, and nothing carried out unless it got out', () => {
  assert.deepEqual(cleanRun(visit()), visit());
  assert.deepEqual(cleanRun(), { reason: 'quit', seed: '', seconds: 0, parts: { reached: 1, of: 1 }, rooms: { explored: 0, kinds: [] }, cast: { met: [], survived: 0 }, batteries: 0, card: false, hearts: null });
  const wild = cleanRun({ reason: 'won', seed: 'a\nb\u0007' + 'x'.repeat(200), seconds: -5, parts: { reached: 99, of: 3.7 }, rooms: { explored: 1e9, kinds: ['ok', 'Not Ok', 'ok', 42, '../x', 'a'.repeat(60)] },
    cast: { met: 'pirate', survived: 1e9 }, batteries: 50, card: 'yes', hearts: { left: 9, of: 4 }, extra: { anything: true } });
  assert.deepEqual([wild.reason, wild.seed.length, /[\n\u0007]/.test(wild.seed), wild.seconds, wild.parts, wild.rooms, wild.cast, wild.batteries, wild.card, wild.hearts, 'extra' in wild],
    ['quit', 80, false, 0, { reached: 3, of: 3 }, { explored: 2000, kinds: ['ok'] }, { met: [], survived: 200 }, 0, false, { of: 4, left: 4 }, false]);
  for (const reason of ENDINGS.filter((r) => r !== 'exit')) assert.deepEqual([cleanRun(visit({ reason })).batteries, cleanRun(visit({ reason })).card], [0, false], `${reason}: nothing is carried out`);
  assert.equal(cleanRun({ rooms: { explored: 1, kinds: ['a', 'b', 'c'] } }).rooms.explored, 3, 'nobody finds more kinds of room than rooms');
});

test('runs: the score — everybody is paid for what they saw and got away from; getting out is paid for what was brought', () => {
  const out = scoreRun(cleanRun(visit()));
  assert.deepEqual(out.lines.map((l) => [l.id, l.count, l.points]), [['room', 40, 40 * POINTS.room], ['kind', 2, 2 * POINTS.kind], ['part', 3, 3 * POINTS.part], ['survived', 2, 2 * POINTS.survived],
    ['out', 1, POINTS.out], ['pace', 400, (POINTS.par * 3 - 400) * POINTS.pace], ['card', 1, POINTS.card], ['battery', 3, 3 * POINTS.battery], ['heart', 2, 2 * POINTS.heart]]);
  assert.equal(out.total, out.lines.reduce((n, l) => n + l.points, 0));
  // the same visit, caught at the end of it: only what anybody is paid for
  const caught = scoreRun(cleanRun(visit({ reason: 'caught' })));
  assert.deepEqual(caught.lines.map((l) => l.id), ['room', 'kind', 'part', 'survived']);
  assert.equal(caught.total, 40 * POINTS.room + 2 * POINTS.kind + 3 * POINTS.part + 2 * POINTS.survived);
  // speed: nothing for taking longer than the building allows, never more than the most, and a slow way out is still a way out
  assert.equal(scoreRun(cleanRun(visit({ seconds: 5000 }))).lines.find((l) => l.id === 'pace').points, 0);
  assert.equal(scoreRun(cleanRun(visit({ seconds: 0, parts: { reached: 5, of: 5 } }))).lines.find((l) => l.id === 'pace').points, POINTS.paceMost);
  assert.ok(scoreRun(cleanRun(visit({ seconds: 5000 }))).total > caught.total);
  // no health to speak of (an older level, or one with it switched off) is no line, not a line worth nothing
  assert.ok(!scoreRun(cleanRun(visit({ hearts: undefined }))).lines.some((l) => l.id === 'heart'));
});

test('runs: the record — the best, what was met for the first time, and a tape only for a visit that got out', () => {
  let record = emptyRecord();
  const enter = (over, at = 1) => { const s = settleRun(record, cleanRun(visit(over)), { at, by: 'Lead' }); record = s.record; return s.card; };
  const first = enter({ reason: 'caught', seed: 'lost-1' });
  assert.deepEqual([first.best, first.fresh, first.seen, first.tape, first.runs], [{ score: first.score, was: 0, beaten: true }, { rooms: ['kanban', 'party'], cast: ['pirate'] }, { rooms: 2, cast: 1 }, { kept: false }, { n: 1, out: 0 }]);
  assert.deepEqual(record.tapes, [], 'the tape of a visit that did not get out is not kept');
  // the same rooms again are not new; a better score is the best; getting out keeps the tape
  const second = enter({ seed: 'tape-A', rooms: { explored: 50, kinds: ['kanban', 'vending'] } }, 2);
  assert.deepEqual([second.fresh, second.seen, second.best.beaten, second.best.was, second.tape, second.runs], [{ rooms: ['vending'], cast: [] }, { rooms: 3, cast: 1 }, true, first.score, { kept: true, seed: 'tape-A' }, { n: 2, out: 1 }]);
  const worse = enter({ reason: 'quit', seed: 'lost-2', rooms: { explored: 1, kinds: [] }, cast: { met: [], survived: 0 }, parts: { reached: 1, of: 3 } }, 3);
  assert.deepEqual([worse.best, worse.tape.kept, record.best], [{ score: second.score, was: second.score, beaten: false }, false, second.score]);
  // the office keeps so many tapes, newest first; walking the same building again keeps one tape of it
  for (let i = 0; i < TAPES_KEPT + 3; i++) enter({ seed: `tape-${i}` }, 10 + i);
  enter({ seed: 'tape-5' }, 99);
  assert.equal(record.tapes.length, TAPES_KEPT);
  assert.deepEqual([record.tapes[0].seed, record.tapes[0].at, record.tapes.filter((t) => t.seed === 'tape-5').length, record.tapes.some((t) => t.seed === 'tape-A')], ['tape-5', 99, 1, false]);
  assert.ok(!cleanRun(visit({ seed: '' })).seed && settleRun(record, cleanRun(visit({ seed: '' })), { at: 5 }).card.tape.kept === false, 'a visit that does not say which building it was has no tape to keep');
  // settling changes nothing it was given, and a record that has been through storage is the same record
  const before = JSON.stringify(record);
  settleRun(record, cleanRun(visit({ seed: 'another' })), { at: 100, by: 'Lead' });
  assert.equal(JSON.stringify(record), before);
  assert.deepEqual(cleanRecord(JSON.parse(before)), record);
  assert.deepEqual(cleanRecord({ runs: 'many', best: -4, rooms: { 'Bad Id': 1, ok: 'yesterday', fine: 3 }, cast: null, tapes: [{ seed: '' }, { nothing: 1 }, { seed: 'x', score: 2.9 }] }),
    { runs: 0, out: 0, best: 0, rooms: { fine: 3 }, cast: {}, tapes: [{ seed: 'x', at: 0, by: '', score: 2, seconds: 0 }] });
});

test('runs: the office keeps the record, pays the jar only for beating its best, and says so on the card', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const run = (r, name = 'Lead', hideout = 'backrooms') => office.post('/api/world/game/run', { hideout, run: r, name });
  assert.equal((await run(visit(), 'Lead', 'pasture')).status, 400, 'no record is kept of a floor of the lift');
  assert.equal((await run(visit(), 'Lead', 'nowhere')).status, 404);
  for (const bad of [null, 'a visit', [1, 2]]) assert.equal((await run(bad)).status, 400);

  const caught = (await run(visit({ reason: 'caught', seed: 'gone' }))).data;
  assert.deepEqual([caught.ok, caught.card.reason, caught.card.coins, caught.card.tape, caught.visits.n, caught.visits.out, caught.visits.tapes], [true, 'caught', { carried: 0, worth: 0, paid: 0, best: 0 }, { kept: false }, 1, 0, []]);
  const out = (await run(visit({ seed: 'tape-1' }))).data;
  assert.deepEqual([out.card.coins, out.card.tape, out.card.best.beaten, out.coins.earned, out.visits.best, out.visits.seen], [{ carried: 3, worth: 3, paid: 3, best: 3 }, { kept: true, seed: 'tape-1' }, true, 3, out.card.score, { rooms: 2, cast: 1 }]);
  assert.deepEqual(out.visits.tapes.map((t) => [t.seed, t.by, t.score]), [['tape-1', 'Lead', out.card.score]]);
  // the same again is worth the same points and no more coins; one more battery is one more coin
  const again = (await run(visit({ seed: 'tape-2' }), 'Robin')).data;
  assert.deepEqual([again.card.coins, again.card.best.beaten, again.card.fresh], [{ carried: 3, worth: 3, paid: 0, best: 3 }, false, { rooms: [], cast: [] }]);
  assert.deepEqual((await run(visit({ seed: 'tape-3', batteries: 4 }))).data.card.coins, { carried: 4, worth: 4, paid: 1, best: 4 });
  // whoever is told about the office is told this too, and it is still there after a restart of the page
  const world = (await office.get('/api/world')).data.game;
  assert.deepEqual([world.visits.n, world.visits.out, world.visits.tapes.map((t) => t.seed), world.coins.earned], [4, 3, ['tape-3', 'tape-2', 'tape-1'], 4]);
  const feed = (await office.get('/api/activity?limit=60')).data, said = (feed.items || feed.activity || feed).map((e) => e.text);
  assert.ok(said.some((s) => new RegExp(`^Lead is back from Out of Office: ${out.card.score} points, the best yet$`).test(s)), said.join(' / '));
  assert.ok(said.some((s) => /^Robin is back from Out of Office: \d+ points$/.test(s)));
  assert.ok(!said.some((s) => /caught|gone/.test(s)), 'a visit that did not get out is nobody else\'s business');
});

test('the card is put on the page itself, not inside the office\'s interface, which is out of sight while somebody is out of the building', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../public/world/backrooms/scorecard.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../public/world/ui/ui.css', import.meta.url), 'utf8');
  // (ui.css hides everything in #ui but the level's own picture while the office has stepped aside: a card in there is never seen)
  assert.match(css, /body\.noclip #ui > \*:not\(/);
  assert.ok(!/getElementById\(['"]ui['"]\)/.test(src), 'scorecard.js reaches for #ui');
  assert.match(src, /const root = document\.body;/);
});
