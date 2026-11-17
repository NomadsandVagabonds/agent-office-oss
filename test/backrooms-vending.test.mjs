// The vending machines as a shop: prices, recipes, the two vends of a floor, seeded goods, and where a floor's one machine goes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRICE, VENDS_PER_FLOOR, GOODS, SLOTS, accepts, recipeFor, feed, outputs, vend, vendingSites, SITE_SHORTLIST } from '../public/world/backrooms/vending.rule.js';
import { makeRng } from '../public/world/backrooms/gen.js';

test('the prices the owner gave, as plain numbers', () => {
  assert.deepEqual({ ...PRICE }, { papers: 3, commons: 2, kinds: 3 });
  assert.equal(VENDS_PER_FLOOR, 2); assert.equal(SLOTS, 3);
});

test('batteries are neither taken nor given; every good is a real thing', () => {
  assert.equal(accepts('battery'), false); assert.equal(GOODS.some((g) => g.type === 'battery'), false);
  for (const t of ['snack', 'chalk', 'tape', 'lighter', 'paper', 'scissors', 'torch']) assert.equal(accepts(t), true, t);
  for (const t of ['pink-slip', 'balloon', 'opener', 'call']) assert.equal(accepts(t), false, t);
});

test('recipes: three papers → a common; two other commons → a common; three kinds → a rare; nothing else', () => {
  assert.deepEqual(recipeFor(['paper', 'paper', 'paper']), { tier: 'common', by: 'papers' });
  assert.deepEqual(recipeFor(['chalk', 'tape']), { tier: 'common', by: 'commons' });
  assert.deepEqual(recipeFor(['chalk', 'chalk']), { tier: 'common', by: 'commons' });
  assert.deepEqual(recipeFor(['paper', 'chalk', 'scissors']), { tier: 'rare', by: 'kinds' });
  assert.deepEqual(recipeFor(['snack', 'torch', 'scissors']), { tier: 'rare', by: 'kinds' });
  for (const bad of [[], ['paper'], ['paper', 'paper'], ['paper', 'chalk'], ['chalk', 'chalk', 'chalk'], ['paper', 'paper', 'chalk'], ['scissors', 'torch'], ['chalk', 'chalk', 'tape']]) assert.equal(recipeFor(bad), null, bad.join());
});

test('feeding takes accepted things up to the slots and no more', () => {
  let held = [];
  for (const t of ['paper', 'chalk', 'tape']) held = feed(held, t);
  assert.deepEqual(held, ['paper', 'chalk', 'tape']);
  assert.equal(feed(held, 'snack'), null); assert.equal(feed([], 'battery'), null);
});

test('what comes out: never paper, never a battery, never a thing put in if another will do; the rare tier is scissors or a torch', () => {
  assert.deepEqual(outputs({ tier: 'common' }, ['paper', 'paper', 'paper']).sort(), ['chalk', 'lighter', 'snack', 'tape']);
  assert.ok(!outputs({ tier: 'common' }, ['chalk', 'tape']).includes('chalk'));
  assert.deepEqual(outputs({ tier: 'rare' }, ['snack', 'chalk', 'tape']).sort(), ['scissors', 'torch']);
  assert.deepEqual(outputs({ tier: 'rare' }, ['paper', 'scissors', 'tape']), ['torch']);
  assert.deepEqual(outputs({ tier: 'rare' }, ['scissors', 'torch', 'tape']).sort(), ['scissors', 'torch']);       // (both put in: either)
  assert.deepEqual(outputs({ tier: 'common' }, ['paper', 'paper', 'paper'], { exclude: ['snack'] }).sort(), ['chalk', 'lighter', 'tape']);
});

test('a floor has two vends, in all; then every machine says spent', () => {
  const floor = { done: 0 }, rng = makeRng('vend-a/0');
  for (let i = 0; i < VENDS_PER_FLOOR; i++) { const r = vend(['paper', 'paper', 'paper'], floor, rng); assert.equal(r.ok, true); floor.done++; }
  assert.deepEqual(vend(['paper', 'paper', 'paper'], floor, rng), { ok: false, reason: 'spent' });
  assert.deepEqual(vend(['paper'], { done: 0 }, rng), { ok: false, reason: 'nothing' });
});

test('the same seed and the same vends give the same goods, whichever machine; the stream is the floor\'s own', () => {
  const run = (seed) => { const floor = { done: 0 }, out = []; for (let i = 0; i < 2; i++) { out.push(vend(['paper', 'paper', 'paper'], floor, makeRng(`${seed}/vend/${floor.done}`)).out); floor.done++; } return out; };
  assert.deepEqual(run('s1'), run('s1'));
  const seen = new Set(); for (let i = 0; i < 40; i++) run('s' + i).forEach((x) => seen.add(x));
  assert.ok(seen.size >= 3);
});

const level = (over = {}) => ({
  start: { room: 0 }, exit: { room: 9 }, links: [{ a: 8, b: 9 }, { a: 0, b: 1 }],
  rooms: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ id, kind: id === 9 ? 'exit' : 'plain', w: 5, d: 5, dress: [] })), ...over });

test('a floor with no Refreshments room shortlists plain rooms that are none of the ones it should not be', () => {
  const lv = level({ pursuer: { room: 3 }, thin: { room: 4 } });
  lv.rooms[5].crawl = true; lv.rooms[6].shape = { kind: 'pinch' }; lv.rooms[7].dress = [{ type: 'trace' }]; lv.rooms[2].w = 2;
  for (let i = 0; i < 80; i++) assert.deepEqual(vendingSites(lv, makeRng('site' + i)), [1]);      // (0 start, 8 beside the way down, 9 the way down, 2 cramped, 3 lair, 4 thin, 5 crawl, 6 shaped, 7 traced)
});

test('the shortlist is capped, seeded, and the same for the same seed', () => {
  const big = level({ rooms: Array.from({ length: 30 }, (_, id) => ({ id, kind: id === 29 ? 'exit' : 'plain', w: 5, d: 5, dress: [] })), exit: { room: 29 }, links: [] });
  const a = vendingSites(big, makeRng('same')), b = vendingSites(big, makeRng('same'));
  assert.equal(a.length, SITE_SHORTLIST); assert.deepEqual(a, b); assert.ok(!a.includes(0) && !a.includes(29));
  const seen = new Set(); for (let i = 0; i < 30; i++) vendingSites(big, makeRng('v' + i)).forEach((x) => seen.add(x));
  assert.ok(seen.size > SITE_SHORTLIST);
});

test('where there is a Refreshments room no extra machine is stood; with nowhere fit, none', () => {
  const lv = level(); lv.rooms[3].arch = 'vending';
  assert.deepEqual(vendingSites(lv, makeRng('x')), []);
  const bare = level({ rooms: [{ id: 0, kind: 'plain', w: 5, d: 5, dress: [] }, { id: 1, kind: 'exit', w: 5, d: 5, dress: [] }], start: { room: 0 }, exit: { room: 1 }, links: [] });
  assert.deepEqual(vendingSites(bare, makeRng('x')), []);
});
