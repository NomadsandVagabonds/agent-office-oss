import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DIFFICULTIES, difficultyOf, cleanDifficulty, createDifficultyRun, difficultyPerk, creatureTuning } from '../core/difficulty.mjs';
import { cleanRun, cleanRecord, emptyRecord, scoreRun, settleRun } from '../core/runs.mjs';
import { checkRun } from '../core/book.mjs';
import { planVisit, floorOf, changeVisitDifficulty } from '../public/world/backrooms/plan.js';
import { roomDistances } from '../public/world/backrooms/gen.js';
import { castFor, tonerHomes } from '../public/world/backrooms/cast.js';
import { planSupplies } from '../public/world/backrooms/supplies.js';
import { createSurvival } from '../public/world/backrooms/survival.js';
import { resolvePerk, PERK_LIST } from '../core/perks.mjs';
import { handle } from '../tools/blockrooms/book-api.mjs';
import { memoryStore } from '../tools/blockrooms/book-store.mjs';

const report = (extra = {}) => ({ seed: 'difficulty-test', reason: 'exit', seconds: 500, parts: { reached: 3, of: 3 }, rooms: { explored: 65, kinds: ['mascot'] }, cast: { met: ['pirate'], survived: 2 }, batteries: 2, hearts: { left: 3, of: 4 }, ...extra });
const mockLevel = seed => ({ seed, depth: 1, start: { room: 0 }, exit: { room: 25 }, rooms: Array.from({ length: 26 }, (_, id) => ({ id, kind: id === 0 ? 'start' : id === 25 ? 'exit' : 'plain' })) });

test('Easy is default; score ineligibility sticks after changing back, with the launch mode intact', () => {
  assert.equal(cleanDifficulty('nope'), 'easy');
  const run = createDifficultyRun('easy');
  assert.equal(run.set('easy'), false); assert.equal(run.report().ranked, true);
  assert.equal(run.set('invalid'), false); assert.equal(run.report().ranked, true);
  run.set('tourist'); run.set('easy');
  assert.deepEqual(run.report(), { difficulty: 'easy', difficultyChanged: true, ranked: false, scoring: 1 });
  assert.equal(createDifficultyRun('tourist').report().ranked, false);
});

test('weighted scores are recomputed from counts, and unscored discoveries still save', () => {
  const base = scoreRun(cleanRun(report())).total;
  for (const d of DIFFICULTIES) {
    const run = cleanRun(report(createDifficultyRun(d.id).report()));
    assert.equal(scoreRun(run).total, Math.floor(base * d.multiplier));
    if (d.id === 'hard') continue;
    assert.equal(checkRun(run).ok, d.id !== 'tourist');
  }
  const changed = createDifficultyRun('hard'); changed.set('easy'); changed.set('hard');
  const run = cleanRun(report(changed.report()));
  assert.equal(checkRun(run).ok, false); assert.equal(scoreRun(run).total, 0);
  const kept = settleRun({ ...emptyRecord(), best: 123 }, run, { at: 42 });
  assert.equal(kept.record.best, 123); assert.equal(kept.card.ranked, false);
  assert.equal(kept.record.cast.pirate, 42); assert.equal(kept.record.rooms.mascot, 42);
  assert.equal(cleanRecord(kept.record).tapes[0].difficulty, 'hard');
  assert.equal(cleanRecord(kept.record).tapes[0].ranked, false);
  assert.equal(checkRun(report({ difficulty: 'impossible' })).ok, false);
  assert.equal(checkRun(report({ difficulty: 'hard', hearts: { left: 1, of: 1 }, rooms: { explored: 110, kinds: [] } })).ok, true);
  assert.equal(checkRun(report({ difficulty: 'hard' })).ok, false);
});

test('Training Wheels preserves the frozen live supply plan, including seeded item positions', () => {
  // SHA-256 of 60 complete supply plans from live c9c3eab. This fixture also
  // works in shallow CI checkouts; it does not need that commit's Git history.
  // (the fire extinguisher came after, on a stream and rooms of its own: everything else is where it was, to the byte)
  const whole = Array.from({ length: 60 }, (_, i) => planSupplies({ ...mockLevel('balance-' + i), difficulty: 'training-wheels' }));
  const plans = whole.map(plan => plan.filter(s => s.type !== 'extinguisher'));
  assert.equal(createHash('sha256').update(JSON.stringify(plans)).digest('hex'), 'c7b3c204af209048f7879274cb182c21ffa79f4fa4b79a112baceb5fd936bc36');
  assert.ok(whole.some(plan => plan.some(s => s.type === 'extinguisher')), 'and an extinguisher in some of them');
});

test('Normal has about 30% fewer packs than Easy, no snacks, and always an early refill', () => {
  let easy = 0, normal = 0;
  for (let i = 0; i < 400; i++) {
    const level = mockLevel('supplies-' + i);
    const e = planSupplies({ ...level, difficulty: 'easy' }), n = planSupplies({ ...level, difficulty: 'normal' });
    easy += e.filter(p => p.type === 'battery').length; normal += n.filter(p => p.type === 'battery').length;
    assert.ok(n.some(p => p.id === 'battery-0' && p.rooms.every(id => id <= 4)));
    assert.ok(!n.some(p => p.type === 'snack'));
    assert.deepEqual(n.filter(p => !['battery', 'snack'].includes(p.type)), e.filter(p => !['battery', 'snack'].includes(p.type)));
  }
  assert.ok(normal / easy > .65 && normal / easy < .75, normal / easy);
});

test('future parts can change without rewriting the current level; Hard adds 25% room targets', () => {
  const visit = planVisit('difficulty-seam', { difficulty: 'easy' });
  const first = floorOf(visit, 0), next = floorOf(visit, 1);
  changeVisitDifficulty(visit, 'hard', 1);
  assert.equal(floorOf(visit, 0), first);
  assert.notEqual(floorOf(visit, 1), next);
  assert.equal(floorOf(visit, 1).difficulty, 'hard');
  assert.equal(first.difficulty, 'easy');
  for (const f of visit.floors.slice(1)) assert.equal(f.rooms, Math.round(f.baseRooms * 1.25));
  changeVisitDifficulty(visit, 'easy', 1);
  assert.deepEqual(floorOf(visit, 1), next);
});

test('each new preset deals a mobile threat per part without deleting friendly cast; Training Wheels stays sparse', () => {
  for (let i = 0; i < 40; i++) {
    const seed = 'cast-' + i, legacy = planVisit(seed), training = planVisit(seed, { difficulty: 'training-wheels' });
    assert.deepEqual(castFor(training), castFor(legacy));
    for (const mode of ['easy', 'normal', 'hard']) {
      const visit = planVisit(seed, { difficulty: mode });
      for (let d = 0; d < visit.depths; d++) {
        assert.equal(castFor(visit, d).filter(c => c.id === 'toner').length, 1);
        for (const member of castFor(legacy, d)) assert.ok(castFor(visit, d).some(c => c.id === member.id));
      }
    }
  }
});

function survival(mode, perk = resolvePerk('none')) {
  let id = mode;
  const endings = [], env = { hud: { battery() {}, glitch() {} }, sound: { play() {} }, interfere() {} };
  const s = createSurvival(env, { canAct: () => true, onEnd: r => endings.push(r), perk, difficulty: () => id });
  return { s, endings, mode(next) { id = next; s.setDifficulty(); } };
}
test('Tourist ignores hits, battery drain and time; switching modes never heals or refills', () => {
  const v = survival('easy'); v.s.health.damage(2); v.s.update(50, true);
  v.mode('tourist'); const before = v.s.camera.read().remaining;
  assert.equal(v.s.health.damage(20).ok, false); assert.equal(v.s.camera.drain(1).ok, false);
  v.s.update(10000, true); assert.equal(v.s.camera.read().remaining, before); assert.deepEqual(v.endings, []);
  v.mode('easy'); assert.equal(v.s.health.read().current, 2); assert.equal(v.s.camera.read().remaining, before);
  v.mode('hard'); assert.equal(v.s.health.read().current, 1); v.s.update(3, true);
  v.s.health.damage(); assert.deepEqual(v.endings, ['caught']);
});
test('Hard caps every kit at one heart with no regen, keeps kit battery perks and takes 25% off starting charge', () => {
  for (const kit of PERK_LIST) {
    const perk = resolvePerk(kit.id), tuned = difficultyPerk(perk, 'hard'), v = survival('hard', perk);
    assert.equal(tuned.maxHealth, 1); assert.equal(tuned.regenSeconds, 0);
    assert.equal(v.s.health.read().max, 1); assert.equal(v.s.camera.read().remaining, perk.cameraStart * .75);
    assert.equal(tuned.batterySeconds, perk.batterySeconds);
  }
  assert.equal(creatureTuning('normal', 'pirate').damage, 3);
  assert.equal(creatureTuning('normal', 'toner').damage, 1);
  assert.equal(creatureTuning('hard', 'toner').speed, 1.12);
  // the big ones further down: slower and a heart a hit below Normal, and as they are written from Normal up
  for (const id of ['head-count', 'standing-meeting', 'carried-interest']) {
    for (const mode of ['tourist', 'training-wheels', 'easy']) assert.deepEqual(creatureTuning(mode, id), { speed: .85, damage: 1 }, mode + ' ' + id);
    for (const mode of ['normal', 'hard']) assert.deepEqual(creatureTuning(mode, id), {}, mode + ' ' + id);
  }
  for (const id of ['intern', 'mother']) { assert.deepEqual(creatureTuning('easy', id), { speed: .85 }); assert.deepEqual(creatureTuning('hard', id), {}); }
});

test('book API rejects changed/tourist scores and filters each difficulty from its own retained board', async () => {
  const store = memoryStore(), ctx = { store, salt: 'test' };
  const post = (run, ip) => handle(new Request('http://test/api/book', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body: JSON.stringify({ do: 'sign', name: 'Test', run }) }), ctx);
  for (const d of ['training-wheels', 'easy', 'normal', 'hard']) {
    const response = await post(report({ difficulty: d, seed: `test-${d}`, ...(d === 'hard' ? { hearts: { left: 1, of: 1 } } : {}) }), d);
    assert.equal(response.status, 200, await response.text());
    const book = await (await handle(new Request(`http://test/api/book?difficulty=${d}`), ctx)).json();
    assert.equal(book.top.length, 1); assert.equal(book.top[0].difficulty, d);
  }
  for (const extra of [{ difficulty: 'tourist' }, { difficulty: 'easy', difficultyChanged: true }]) assert.equal((await post(report(extra), 'bad')).status, 422);
  assert.equal((await handle(new Request('http://test/api/book?difficulty=bad'), ctx)).status, 400);
});

test('toner territories keep four doorways from the landing and each other; blocked spots do not consume the quota', () => {
  for (let i = 0; i < 40; i++) {
    const visit = planVisit('territory-' + i, { difficulty: 'hard' });
    const level = floorOf(visit, 0), homes = tonerHomes(level, 3), dist = roomDistances(level, level.start.room);
    assert.ok(homes.length >= 1 && homes.length <= 3);
    assert.deepEqual(tonerHomes(level, 3), homes);
    for (const id of homes) {
      assert.ok(dist.get(id) >= 4);
      for (const other of homes) if (id !== other) assert.ok(roomDistances(level, id).get(other) >= 4);
    }
    assert.deepEqual(tonerHomes(level, 3, { usable: () => false }), []);
    const replacement = tonerHomes(level, 3, { usable: id => id !== homes[0] });
    assert.ok(!replacement.includes(homes[0]));
  }
});

test('the creature conductor applies per-species damage and live movement scales without speeding its clocks', async () => {
  const { readFileSync } = await import('node:fs');
  const data = s => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
  let source = readFileSync(new URL('../public/world/backrooms/pursuer.js', import.meta.url), 'utf8');
  const stubs = {
    './gen.js': 'export const makeRng=()=>()=>.5; export const roomDistances=()=>new Map();',
    './cast.js': `export const CAST=[{id:'pirate'},{id:'toner'}]; export const castFor=()=>CAST; export const homeFor=()=>null;`,
    './cast/index.js': `const make=c=>({samples:[], update(dt){this.samples.push({dt,speed:c.speedScale,...c.hurt(1)});}}); export const MAKERS={pirate:make,toner:make};`,
    './cast/walk.js': 'export const createWalk=()=>({});',
    './doorleaf.js': 'export const hangDoors=()=>({update(){}});',
  };
  for (const [name, stub] of Object.entries(stubs)) source = source.replace(`'${name}'`, JSON.stringify(data(stub)));
  source = source.replace("'../../../core/difficulty.mjs'", JSON.stringify(new URL('../core/difficulty.mjs', import.meta.url).href));
  const { createStalkers } = await import(data(source));
  let mode = 'normal'; const amounts = [];
  const env = { level:{seed:'tuning',depth:0}, world:{}, player:{me:{}}, difficulty:()=>mode,
    health:{damage(n){amounts.push(n);return {ok:true,dead:false};}} };
  createStalkers(env);
  env.pursuer.update(.1);
  assert.deepEqual(amounts, [3,1]);
  assert.equal(env.pursuer.of('pirate').samples[0].speed, 1.12);
  assert.equal(env.pursuer.of('toner').samples[0].speed, 1.08);
  mode = 'training-wheels'; env.pursuer.update(.1);
  assert.deepEqual(amounts, [3,1,1,1]);
  for (const id of ['pirate','toner']) {
    assert.equal(env.pursuer.of(id).samples[1].speed, 1);
    assert.deepEqual(env.pursuer.of(id).samples.map(s=>s.dt), [.1,.1]);
  }
});
