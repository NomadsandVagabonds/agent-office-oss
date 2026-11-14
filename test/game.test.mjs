// The long game: keycards that light the lift's dark buttons, the office's
// coin jar, and the vending machine that takes what is in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startOffice, tempDir } from './helpers.mjs';
import { HIDEOUTS, PRIZES, COINS_HIDDEN, STAMP_COINS, cardFloors, dealOrder, findPrize, jarOf, openFloors } from '../core/game.mjs';
import { LEVELS, levelContext, panelLevels, isOpen, levelById } from '../core/levels.mjs';
import { SECRETS } from '../core/secrets.mjs';

test('game: the rules — what is hidden where, how floors open, what a jar holds', () => {
  const floors = cardFloors();
  assert.ok(floors.length >= 2, 'there is something to open');
  for (const h of HIDEOUTS) assert.ok(h.coins >= 2 && h.coins <= 4, `${h.id} hides ${h.coins} coins: two to four`);
  assert.deepEqual(HIDEOUTS.filter((h) => h.lift).map((h) => h.id), LEVELS.filter((l) => l.card).map((l) => l.id));
  assert.ok(HIDEOUTS.some((h) => !h.lift), 'and one place the lift does not go');
  for (const id of ['roof', 'mission', 'lobby']) assert.ok(!levelById(id).card, `${id} is never locked`);

  // an order is every card floor once; an office keeps the order it was dealt, and a new floor joins the end
  const seq = [0.9, 0.1, 0.5, 0.3, 0.7, 0.2]; let i = 0; const rand = () => seq[i++ % seq.length];
  const order = dealOrder([], rand);
  assert.deepEqual([...order].sort(), [...floors].sort());
  assert.deepEqual(dealOrder(order, rand), order);
  const known = [floors[1], 'a-floor-that-was-removed', floors[0], floors[1]];
  const again = dealOrder(known, rand);
  assert.deepEqual(again.slice(0, 2), [floors[1], floors[0]], 'what was dealt stays in front, once');
  assert.deepEqual([...again].sort(), [...floors].sort());

  // open floors = one more than the keycards found
  assert.deepEqual(openFloors(order, 0), order.slice(0, 1));
  assert.deepEqual(openFloors(order, 2), order.slice(0, 3));
  assert.deepEqual(openFloors(order, 99), order);
  assert.deepEqual(openFloors(order, -3), order.slice(0, 1));
  // so there is always a card within reach: every open floor hides one, and each opens another
  assert.ok(HIDEOUTS.length > floors.length - 1, 'more keycards exist than there are dark buttons');

  assert.equal(jarOf({ coins: 4, stamps: 6, spent: 3 }), 4 + 6 * STAMP_COINS - 3);
  assert.equal(jarOf({ coins: 0, stamps: 0, spent: 5 }), 0);
  // the machine: every slot is its own, and everything can be afforded by somebody who finds everything
  assert.equal(new Set(PRIZES.map((p) => p.slot)).size, PRIZES.length);
  assert.equal(findPrize('b2'), findPrize(findPrize('B2').id));
  assert.equal(findPrize('Z9'), null);
  assert.ok(PRIZES.reduce((n, p) => n + p.price, 0) <= COINS_HIDDEN + SECRETS.length * STAMP_COINS);

  // the panel: what the lift shows of all this
  const ctx = levelContext({ game: { open: [order[0]], fresh: [order[0]] } });
  const panel = panelLevels(ctx);
  assert.equal(panel.dark, floors.length - 1);
  assert.ok(panel.levels.some((l) => l.id === order[0]) && !panel.levels.some((l) => l.id === order[1]));
  assert.ok(panel.levels.some((l) => l.id === 'roof') && panel.levels.some((l) => l.id === 'lobby'));
  assert.ok(isOpen(levelById(order[1]), {}), 'an office that says nothing about the game holds nothing back');
  assert.equal(panelLevels(levelContext({})).dark, 0);
});

test('game: one floor is open to begin with, and each keycard opens exactly one more', async (t) => {
  const dir = tempDir('office-game-');
  let office = await startOffice({ dir });
  t.after(() => office.stop());
  const game = async () => (await office.get('/api/world/game')).data;
  const pick = (hideout, item, n) => office.post('/api/world/game/collect', { hideout, item, n, name: 'Lead' });
  const floors = cardFloors();

  const start = await game();
  assert.equal(start.open.length, 1);
  assert.ok(floors.includes(start.open[0]));
  assert.deepEqual([start.dark, start.cards, start.spare, start.fresh], [floors.length - 1, [], 0, start.open]);
  assert.deepEqual((await office.get('/api/world')).data.game.open, start.open, 'and the world everyone is sent says the same');
  assert.deepEqual(start.coins, { have: 0, found: 0, stamps: 0, spent: 0 });

  // the card hidden on the open floor lights one more button — once
  const first = (await pick(start.open[0], 'card')).data;
  assert.deepEqual([first.taken, first.open.length, first.dark], [true, 2, floors.length - 2]);
  assert.equal(first.opened.id, first.open[1]);
  assert.equal(first.opened.name, levelById(first.open[1]).name);
  const again = (await pick(start.open[0], 'card')).data;
  assert.deepEqual([again.taken, again.open.length, again.opened], [false, 2, undefined]);
  // the place the lift does not go has a card too
  const behind = (await pick('backrooms', 'card')).data;
  assert.deepEqual([behind.taken, behind.open.length], [true, 3]);
  assert.equal((await pick('nowhere', 'card')).status, 404);
  assert.equal((await pick(start.open[0], 'biscuit')).status, 400);

  // riding to a newly lit floor makes it old news
  assert.deepEqual((await game()).fresh, behind.open);
  await office.post('/api/world/game/visit', { floor: behind.open[1] });
  assert.deepEqual((await game()).fresh, [behind.open[0], behind.open[2]]);
  assert.equal((await office.post('/api/world/game/visit', { floor: 'roof' })).data.first, false);

  // the same after a restart: nothing that was open goes dark, and the order is the one this office was dealt
  await office.stop();
  office = await startOffice({ dir });
  const back = await game();
  assert.deepEqual(back.open, behind.open);
  assert.deepEqual(back.cards.sort(), ['backrooms', start.open[0]].sort());

  // every remaining card: every button lit, and the cards left over are kept, not lost
  for (const id of [...floors]) await pick(id, 'card');
  const all = await game();
  assert.deepEqual([all.open.length, all.dark, all.spare], [floors.length, 0, 2]);
  const feed = (await office.get('/api/activity?limit=60')).data;
  const lines = (feed.items || feed.activity || feed).filter((e) => e.kind === 'loot').map((e) => e.text);
  assert.equal(lines.length, floors.length + 1, 'one line in the feed per keycard, none for a second look');
  assert.match(lines[0], /^Lead found a keycard in /);
});

test('game: coins do not come back, the passport pays into the same jar, and the machine takes what is in it', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const game = async () => (await office.get('/api/world/game')).data;
  const coin = (hideout, n) => office.post('/api/world/game/collect', { hideout, item: 'coin', n, name: 'Lead' });
  const buy = (prize) => office.post('/api/world/game/buy', { prize, name: 'Lead' });
  const pasture = HIDEOUTS.find((h) => h.id === 'pasture');

  assert.deepEqual((await coin('pasture', 1)).data.coins, { have: 1, found: 1, stamps: 0, spent: 0 });
  assert.deepEqual([(await coin('pasture', 1)).data.taken, (await game()).coins.have], [false, 1], 'the same coin twice is one coin');
  for (const bad of [0, pasture.coins + 1, 'two', -1, 1.5 + pasture.coins]) assert.equal((await coin('pasture', bad)).status, 400, `coin ${bad}`);
  for (let n = 2; n <= pasture.coins; n++) await coin('pasture', n);
  assert.deepEqual((await game()).loot.pasture, { card: false, of: pasture.coins, coins: Array.from({ length: pasture.coins }, (_, i) => i + 1) });

  // a stamp in the passport is a coin in the jar, whoever earned it
  const ada = (await office.post('/api/agents/join', { provider: 'claude', name: 'Ada', cwd: '/tmp/proj/demo' })).data.agent.id;
  // (arriving can itself earn a stamp — somebody at a desk in the small hours, say — so count from here)
  const stamped = async () => Object.keys((await office.get('/api/world')).data.discoveries).length;
  const had = await stamped();
  await office.post('/api/world/discover', { secret: 'ding', agent: ada });
  await office.post('/api/world/discover', { secret: 'guest', name: 'Lead' });
  await office.post('/api/world/discover', { secret: 'ding', name: 'Lead' });          // already found: no second coin
  assert.equal(await stamped(), had + 2);
  const jar = (await game()).coins;
  assert.deepEqual(jar, { have: pasture.coins + (had + 2) * STAMP_COINS, found: pasture.coins, stamps: (had + 2) * STAMP_COINS, spent: 0 });

  // the machine
  const cheap = PRIZES.find((p) => p.price <= jar.have), dear = PRIZES.find((p) => p.price > jar.have);
  const shelf = (await game()).shelf;
  assert.deepEqual(shelf.map((p) => [p.slot, p.sold]), PRIZES.map((p) => [p.slot, false]));
  const no = await buy(dear.slot);
  assert.equal(no.status, 402);
  assert.match(no.data.error, new RegExp(`costs ${dear.price}; the jar has ${jar.have}`));
  assert.equal((await buy('Z9')).status, 404);
  const got = (await buy(cheap.slot.toLowerCase())).data;
  assert.deepEqual([got.prize.id, got.coins.have, got.coins.spent, got.prizes], [cheap.id, jar.have - cheap.price, cheap.price, [cheap.id]]);
  assert.equal((await buy(cheap.id)).status, 409, 'a slot that has been emptied stays empty');
  assert.deepEqual((await office.get('/api/world')).data.game.prizes, [cheap.id]);
  assert.equal((await game()).shelf.find((p) => p.id === cheap.id).by, 'Lead');
  const feed = (await office.get('/api/activity?limit=40')).data;
  assert.ok((feed.items || feed.activity || feed).some((e) => e.kind === 'prize' && /^Lead bought .+ from the vending machine$/.test(e.text)));
});
