// The long game: keycards that light the lift's dark buttons, the office's
// coin jar, and the vending machine that takes what is in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startOffice, tempDir, sleep } from './helpers.mjs';
import { HIDEOUTS, PRIZES, COINS_HIDDEN, STAMP_COINS, BATTERY_COINS, VISIT_PAYS_MOST, cardFloors, dealOrder, findPrize, jarOf, openFloors, payFor } from '../core/game.mjs';
import { LEVELS, levelContext, panelLevels, isOpen, levelById } from '../core/levels.mjs';
import { SECRETS } from '../core/secrets.mjs';

test('game: the rules — what is hidden where, how floors open, what a jar holds', () => {
  const floors = cardFloors();
  assert.ok(floors.length >= 2, 'there is something to open');
  for (const h of HIDEOUTS) assert.ok(h.coins >= 2 && h.coins <= 4, `${h.id} hides ${h.coins} coins: two to four`);
  assert.deepEqual(HIDEOUTS.filter((h) => h.lift).map((h) => h.id), LEVELS.filter((l) => l.card).map((l) => l.id));
  assert.ok(HIDEOUTS.some((h) => !h.lift), 'and one place the lift does not go');
  for (const id of ['roof', 'mission', 'office']) assert.ok(!levelById(id).card, `${id} is never locked`);

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
  assert.ok(panel.levels.some((l) => l.id === 'roof') && panel.levels.some((l) => l.id === 'office'));
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
  assert.deepEqual(start.coins, { have: 0, found: 0, earned: 0, stamps: 0, spent: 0 });

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

  assert.deepEqual((await coin('pasture', 1)).data.coins, { have: 1, found: 1, earned: 0, stamps: 0, spent: 0 });
  assert.deepEqual([(await coin('pasture', 1)).data.taken, (await game()).coins.have], [false, 1], 'the same coin twice is one coin');
  for (const bad of [0, pasture.coins + 1, 'two', -1, 1.5 + pasture.coins]) assert.equal((await coin('pasture', bad)).status, 400, `coin ${bad}`);
  for (let n = 2; n <= pasture.coins; n++) await coin('pasture', n);
  assert.deepEqual((await game()).loot.pasture, { card: false, of: pasture.coins, coins: Array.from({ length: pasture.coins }, (_, i) => i + 1) });

  // a stamp in the passport is a coin in the jar, whoever earned it
  const ada = (await office.post('/api/agents/join', { provider: 'claude', name: 'Ada', cwd: '/tmp/proj/demo' })).data.agent.id;
  // (arriving can itself earn a stamp — somebody at a desk in the small hours, say — so count from here)
  const stamped = async () => Object.keys((await office.get('/api/world')).data.discoveries).length;
  const had = await stamped();
  // (a browser is listening: its copy of the jar is the one the vending machine reads)
  const ws = new WebSocket(`ws://127.0.0.1:${office.port}`), heard = [];
  t.after(() => ws.close());
  ws.addEventListener('message', (m) => { try { const e = JSON.parse(m.data); if (e.type === 'world') heard.push(e.world.game.coins.have); } catch { /* not for us */ } });
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', () => reject(new Error('websocket failed'))); });
  await office.post('/api/world/discover', { secret: 'ding', agent: ada });
  await office.post('/api/world/discover', { secret: 'guest', name: 'Lead' });
  await sleep(120);
  const told = heard.length;
  await office.post('/api/world/discover', { secret: 'ding', name: 'Lead' });          // already found: no second coin
  await sleep(120);
  assert.equal(await stamped(), had + 2);
  const jar = (await game()).coins;
  assert.deepEqual(jar, { have: pasture.coins + (had + 2) * STAMP_COINS, found: pasture.coins, earned: 0, stamps: (had + 2) * STAMP_COINS, spent: 0 });
  assert.equal(heard[told - 1], jar.have, 'each new stamp is heard by every browser as a fuller jar');
  assert.ok(told >= 2 && heard.length === told, 'and a stamp somebody already had changes nothing, so nothing is sent');

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

  // an agent that is asked how the game is going can say — how much, never where, and nothing of a place nobody has been
  const words = (await game()).text;
  assert.match(words, new RegExp(`The Pasture: keycard still hidden · ${pasture.coins} of ${pasture.coins} coins found`));
  assert.match(words, new RegExp(`The jar: ${jar.have - cheap.price} coins? \\(${pasture.coins} picked up`));
  assert.match(words, new RegExp(`${cheap.slot}  ${cheap.name.replace(/[()]/g, '\\$&')} — bought by Lead`));
  assert.match(words, new RegExp(`${dear.slot}  .+ — ${dear.price} coins`));
  const unseen = HIDEOUTS.filter((h) => h.id !== 'pasture' && !(got.open || []).includes(h.id));
  for (const h of unseen) assert.ok(!words.includes(h.name), `${h.name} has not been found, so it is not named`);
  assert.match(words, new RegExp(`and ${unseen.length} places? nobody has found anything in yet`));
  // and what was bought stands where an agent can see it
  const machine = (await office.get(`/api/world/look?agent=${ada}&at=vending`)).data.text;
  assert.match(machine, /Standing on top of the machine: /);
  assert.ok(machine.includes(cheap.name.replace(/^A |^The /, (m) => m.toLowerCase())), machine);
});

test('game: getting out of the place that pays turns spare batteries into coins — a fixed most a visit, and only there', async (t) => {
  // the rule
  assert.deepEqual([0, 1, 5, VISIT_PAYS_MOST, VISIT_PAYS_MOST + 30].map((n) => payFor({ batteries: n })), [0, BATTERY_COINS, 5 * BATTERY_COINS, VISIT_PAYS_MOST, VISIT_PAYS_MOST], 'a coin a battery, up to the most a visit pays');
  assert.deepEqual([-1, 2.9, 'three', null, undefined, NaN, Infinity].map((n) => payFor({ batteries: n })), [0, 2 * BATTERY_COINS, 0, 0, 0, 0, 0], 'whole batteries only');
  assert.equal(payFor(), 0);
  assert.equal(jarOf({ coins: 2, earned: 3, stamps: 1, spent: 4 }), 2 + 3 + STAMP_COINS - 4);
  assert.deepEqual(HIDEOUTS.filter((h) => h.pays).map((h) => h.id), ['backrooms'], 'one place pays, and the lift does not go there');

  const office = await startOffice();
  t.after(() => office.stop());
  const game = async () => (await office.get('/api/world/game')).data;
  const earn = (hideout, batteries, name = 'Lead') => office.post('/api/world/game/earn', { hideout, batteries, name });
  const stamps = (await game()).coins.stamps;

  // nothing carried out is nothing paid, and no record of a visit
  const none = (await earn('backrooms', 0)).data;
  assert.deepEqual([none.ok, none.paid, none.coins.earned], [true, 0, 0]);
  for (const bad of [-1, 'lots', null]) assert.equal((await earn('backrooms', bad)).status, 400, `batteries: ${bad}`);
  assert.equal((await earn('pasture', 3)).status, 400, 'a floor of the lift pays nothing for what is carried off it');
  assert.equal((await earn('nowhere', 3)).status, 404);

  const paid = (await earn('backrooms', 3)).data;
  assert.deepEqual([paid.paid, paid.batteries, paid.coins], [3 * BATTERY_COINS, 3, { have: 3 * BATTERY_COINS + stamps, found: 0, earned: 3 * BATTERY_COINS, stamps, spent: 0 }]);
  // told twice (a page reloaded as it left, a script): one visit is paid once
  const again = await earn('backrooms', 3);
  assert.equal(again.status, 429);
  assert.equal((await game()).coins.earned, 3 * BATTERY_COINS);
  // it is the same jar: the machine takes what a visit paid
  const cheap = PRIZES.find((p) => p.price <= paid.coins.have);
  if (cheap) assert.equal((await office.post('/api/world/game/buy', { prize: cheap.id, name: 'Lead' })).data.coins.have, paid.coins.have - cheap.price);
  // everybody hears about it, in words that do not say where anything is
  const feed = (await office.get('/api/activity?limit=40')).data;
  assert.ok((feed.items || feed.activity || feed).some((e) => e.kind === 'loot' && /^Lead got out of the Backrooms with 3 spare batteries: 3 coins for the jar$/.test(e.text)));
  assert.match((await game()).text, /3 paid for what was carried out of the Backrooms/);
  // and it outlives the daemon, like the rest of the record
  assert.equal((await office.get('/api/world')).data.game.coins.earned, 3 * BATTERY_COINS);
});

test('game: everything the machine sells has a shape, and a place of its own on top of the machine', async () => {
  const { PRIZE_MODELS, PRIZE_PARTS, PRIZE_SPOTS } = await import('../public/world/props/prizes.js');
  const codes = new Set(PRIZES.map((p) => p.slot));
  assert.equal(codes.size, PRIZES.length, 'no two prizes share a place behind the glass');
  assert.ok(PRIZES.every((p) => /^[A-C][1-3]$/.test(p.slot)) && !codes.has('C3'), 'three rows of three, and the last place is what it gives away');
  assert.equal(typeof PRIZE_MODELS.snack, 'function');
  const boxes = [];
  for (const p of PRIZES) {
    assert.equal(typeof PRIZE_MODELS[p.id], 'function', `${p.id} has a model`);
    const vox = PRIZE_MODELS[p.id](), b = vox.bounds(), at = PRIZE_SPOTS[p.id];
    assert.ok(vox.size > 20 && b.y0 === 0, `${p.id} stands on the ground it is given`);
    assert.ok(Array.isArray(at) && at.length === 3, `${p.id} has a place`);
    assert.equal(at[1], 70, 'on top of the machine, which is 70 voxels tall');
    const box = { id: p.id, x0: b.x0 + at[0], x1: b.x1 + at[0], z0: b.z0 + at[2], z1: b.z1 + at[2] };
    assert.ok(box.x0 >= -22 && box.x1 <= 22 && box.z0 >= -16 && box.z1 <= 15, `${p.id} is on the machine, give or take a nose (${JSON.stringify(box)})`);
    for (const o of boxes) assert.ok(box.x1 <= o.x0 || o.x1 <= box.x0 || box.z1 <= o.z0 || o.z1 <= box.z0, `${p.id} and ${o.id} do not stand in each other`);
    boxes.push(box);
    // a prize that comes in pieces is the same prize
    if (PRIZE_PARTS[p.id]) for (const part of PRIZE_PARTS[p.id]) assert.ok(part.make().size > 0 && ['still', 'head', 'frame'].includes(part.role));
  }
});
