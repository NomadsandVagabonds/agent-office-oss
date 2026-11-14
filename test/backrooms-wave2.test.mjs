// Wave 2 set-piece rooms: The Vestibule, Copy Room, Deep Work Zone, and Mailroom.
// Verifies seed determinism, multi-floor visit dealing, coin stashes, and house rules
// (100% original Agent Office names/lore, no level numbers, no Math.random).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, DECK, ARCHETYPES, STASH, coinSpots, wallPoint, fitsAt } from '../public/world/backrooms/gen.js';
import { MORE_DECK, MORE_STASH } from '../public/world/backrooms/deck2.js';
import { generateVisit } from '../public/world/backrooms/plan.js';
import { THEME_IDS } from '../public/world/backrooms/themes.js';

const WAVE2_IDS = ['vestibule', 'copiers', 'quiet-zone', 'mailroom'];
const ELEVATOR_FLOORS = ['night shift', 'after hours', 'mission control', 'scranton paper co.', 'the pasture', 'rooftop garden'];
const WIKI_BANNED = /\b(smiler|faceling|partygoer|skin[\s-]?stealer|almond\s*water|backrooms\s*wiki|level\s*-?\d+|sub[\s-]?level|entity\s*\d+|object\s*\d+)\b/i;

const office = {
  name: 'Robin',
  projects: ['Webstore', 'Mobile App', 'Infra'],
  agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'],
  tasks: ['Cache the product catalogue', 'Trim the Docker image'],
};

test('all four Wave 2 set-piece rooms are registered in MORE_DECK, DECK, and STASH', () => {
  assert.deepEqual(MORE_DECK.map((a) => a.id), WAVE2_IDS);
  for (const id of WAVE2_IDS) {
    assert.ok(ARCHETYPES[id], `${id} is in ARCHETYPES`);
    assert.equal(typeof MORE_STASH[id], 'function', `${id} has a coin stash in MORE_STASH`);
    assert.equal(STASH[id], MORE_STASH[id], `${id} stash is merged into STASH`);
  }
});

test('every Wave 2 room generates deterministically across all five floor themes with filled templates', () => {
  for (const id of WAVE2_IDS) {
    for (const theme of THEME_IDS) {
      for (const seed of ['w2-a', 'w2-b', 77, 404]) {
        const a = generate(seed, { ...office, theme, only: id });
        const b = generate(seed, { ...office, theme, only: id });
        assert.deepEqual(a, b, `${id} (${theme}, ${seed}) is deterministic`);
        const room = a.rooms.find((r) => r.arch === id);
        assert.ok(room, `${id} placed on ${theme} floor for seed ${seed}`);
        const blob = JSON.stringify(room.params);
        assert.ok(!/\{[a-z]+\}/i.test(blob), `${id} left an unfilled template in ${blob}`);
        assert.ok(!WIKI_BANNED.test(blob), `${id} params contain wiki terminology: ${blob}`);
      }
    }
  }
});

test('Copy Room rolls a single truthful route copier alongside prank xerox sheets', () => {
  for (let i = 0; i < 30; i++) {
    const level = generate(`copy-${i}`, { ...office, only: 'copiers' });
    const room = level.rooms.find((r) => r.arch === 'copiers');
    const p = room.params;
    assert.equal(p.sheets.length, p.pairs * 2);
    assert.equal(p.sheets.filter((s) => s === 'route').length, 1, 'exactly one machine prints the route slip');
    assert.equal(p.sheets[p.clue], 'route');
  }
});

test('Wave 2 rooms deal cleanly across multi-floor visits without repeating while the deck lasts', () => {
  const seen = new Map(WAVE2_IDS.map((id) => [id, 0]));
  for (let i = 0; i < 45; i++) {
    const { floors } = generateVisit(`wave2-visit-${i}`, office);
    const allPicked = floors.flatMap((f) => f.picked);
    if (allPicked.length <= DECK.length) {
      assert.equal(new Set(allPicked).size, allPicked.length, `visit ${i}: an archetype repeated before the deck ran out`);
    }
    for (const id of allPicked) if (seen.has(id)) seen.set(id, seen.get(id) + 1);
  }
  for (const id of WAVE2_IDS) {
    assert.ok(seen.get(id) >= 8, `${id} appeared only ${seen.get(id)} times across 45 multi-floor visits`);
  }
});

test('Wave 2 coin stashes stay inside walls and clear of every doorway across 40 seeds each', () => {
  for (const id of WAVE2_IDS) {
    for (let i = 0; i < 40; i++) {
      const level = generate(`stash-${id}-${i}`, { ...office, only: id });
      const room = level.rooms.find((r) => r.arch === id);
      const spots = coinSpots(room);
      assert.ok(spots.length >= 1, `${id} seed ${i}: no valid coin spot`);
      for (const { x, z } of spots) {
        assert.ok(Math.abs(x) <= room.W / 2 - 0.5 && Math.abs(z) <= room.D / 2 - 0.5 && fitsAt(room, x, z, 0.35), `${id}: coin too close to wall (${x}, ${z})`);
        for (const d of room.doors) {
          const p = wallPoint(room, d.side, d.c, 0.3);
          assert.ok(Math.hypot(x - p.x, z - p.z) >= 1.25, `${id}: coin blocks doorway ${d.side}`);
        }
      }
    }
  }
});

test('house rules: zero Math.random, zero wiki names/levels, zero elevator floor name collisions', () => {
  const dir = new URL('../public/world/backrooms/', import.meta.url);
  for (const file of ['deck2.js', 'rooms5.js', 'rooms6.js']) {
    const src = readFileSync(new URL(file, dir), 'utf8');
    assert.ok(!/Math\.random/.test(src), `${file} uses unseeded Math.random`);
    assert.ok(!WIKI_BANNED.test(src), `${file} contains banned wiki/level terminology`);
  }
  for (const arch of MORE_DECK) {
    assert.ok(!ELEVATOR_FLOORS.includes(arch.name.toLowerCase()), `${arch.name} collides with an existing elevator floor`);
    assert.ok(!WIKI_BANNED.test(`${arch.name} ${arch.landmark}`), `${arch.id} name/landmark violates house rules`);
  }
});
