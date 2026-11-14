import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, makeRng, coinFits, T, DOOR_H } from '../public/world/backrooms/gen.js';
import { WORKSHOP_DECK, WORKSHOP_STASH } from '../public/world/backrooms/workshop/deck.js';
import { getWorkshop } from '../public/world/backrooms/workshop/state.js';

const OFFICE = {
  name: 'Nomads',
  projects: ['Scranton Floor', 'Backrooms Lab', 'Control Plane'],
  agents: ['Fable', 'Ada', 'Kestrel'],
  tasks: ['Fix fluorescent hum', 'Audit sub-basement'],
};

test('workshop deck: all four candidate rooms generate cleanly, roll valid params, and leave zero unfilled tokens', () => {
  assert.deepEqual(
    WORKSHOP_DECK.map((a) => a.id),
    ['wellness-pool', 'pipe-dreams', 'night-shift', 'exit-interview'],
  );

  for (const arch of WORKSHOP_DECK) {
    assert.equal(typeof WORKSHOP_STASH[arch.id], 'function', `${arch.id} defines a coin stash spot`);

    for (const seed of [1, 7, 19, 42]) {
      const level = generate(seed, { ...OFFICE, only: arch.id, loot: { card: true, coins: [1, 2, 3, 4] } });
      const room = level.rooms.find((r) => r.arch === arch.id);
      assert.ok(room, `${arch.id} placed in seed ${seed}`);
      assert.ok(room.W >= arch.w[0] - T - 1e-6 && room.W <= arch.w[1] - T + 1e-6);
      assert.ok(room.D >= arch.d[0] - T - 1e-6 && room.D <= arch.d[1] - T + 1e-6);
      assert.ok(level.loot.coins.length === 4, `all 4 coins hidden cleanly when ${arch.id} is forced`);
    }

    for (let i = 0; i < 60; i++) {
      const rolled = arch.roll(makeRng(`ws:${arch.id}:${i}`), i % 2 ? OFFICE : { name: 'Lead', projects: ['Misc'], agents: ['Unit 7'], tasks: [] });
      const raw = JSON.stringify(rolled);
      assert.ok(!/\{[a-z]+\}/i.test(raw), `${arch.id} roll ${i} left unfilled placeholder: ${raw}`);
    }
  }
});

test('workshop stash: every stash zone clears doorways and walls across min/max room sizes and all port layouts', () => {
  for (const arch of WORKSHOP_DECK) {
    for (let w = arch.w[0]; w <= arch.w[1]; w++) {
      for (let d = arch.d[0]; d <= arch.d[1]; d++) {
        const W = w - T, D = d - T, H = arch.h ? arch.h[0] : 2.6;
        const doors = ['front', ...arch.ports].map((side) => ({
          side,
          c: 0,
          w: Math.min(1.6, (side === 'front' || side === 'back' ? W : D) - 1.2),
          sill: 0,
          h: DOOR_H,
        }));
        const fakeRoom = {
          id: 1,
          kind: 'special',
          arch: arch.id,
          W,
          D,
          H,
          doors,
          pillars: [],
          shape: null,
          params: arch.roll(makeRng(`stash:${arch.id}:${w}:${d}`), OFFICE),
        };
        for (const s of [-1, 1]) {
          const [x0, z0, x1, z1] = WORKSHOP_STASH[arch.id](fakeRoom, s);
          assert.ok(x1 > x0 && z1 > z0, `${arch.id} stash bounds valid`);
          const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
          assert.ok(coinFits(fakeRoom, cx, cz), `${arch.id} (${w}x${d}, s=${s}) centre (${cx}, ${cz}) fits coin`);
        }
      }
    }
  }
});

test('workshop state: Almond Water per-visit state is isolated by WeakMap and plays clean audio cues', () => {
  const played = [];
  const makeEnv = () => ({
    hud: null,
    play: (id, x, z, far) => played.push({ id, x, z, far }),
  });
  const envA = makeEnv(), envB = makeEnv();
  const wsA = getWorkshop(envA), wsB = getWorkshop(envB);

  assert.equal(wsA, getWorkshop(envA));
  assert.notEqual(wsA, wsB);
  assert.equal(wsA.almond, false);

  const fakeCtx = { env: envA, toWorld: (x, z) => ({ x: x + 10, z: z - 5 }) };
  assert.equal(wsA.takeAlmond(fakeCtx, 1, 2), true);
  assert.equal(wsA.almond, true);
  assert.equal(wsB.almond, false, 'visit B stays untouched');
  assert.equal(wsA.takeAlmond(fakeCtx, 1, 2), false, 'cannot carry two cartons at once');

  assert.equal(wsA.spendAlmond(fakeCtx, 3, 4, 'glug'), true);
  assert.equal(wsA.almond, false);
  assert.equal(wsA.spendAlmond(fakeCtx, 3, 4, 'glug'), false, 'cannot spend when empty');
  assert.ok(played.some((p) => p.id === 'glug'));
});

test('workshop barrel & rooms5 registration expose every room, creature, and item cleanly', () => {
  const barrel = readFileSync(new URL('../public/world/backrooms/workshop/index.js', import.meta.url), 'utf8');
  for (const sym of [
    'WORKSHOP_DECK',
    'WORKSHOP_STASH',
    'placeAlmondWater',
    'spawnDeskMoth',
    'spawnSmiler',
    'spawnNightPorter',
    'wellnessPool',
    'pipeDreams',
    'nightShift',
    'exitInterview',
  ]) {
    assert.match(barrel, new RegExp(`\\b${sym}\\b`), `workshop/index.js exports ${sym}`);
  }
});
