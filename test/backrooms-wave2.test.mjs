// Four rooms after Gemini's second wave — the Vestibule, the Copy Room, the Deep Work Zone and the Mailroom —
// brought onto the room contract (each a file under rooms/, its line in deck2.js). What every room owes is held in
// backrooms-rooms.test.mjs; this holds what is these four's own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate, ARCHETYPES, STASH, coinSpots, wallPoint, fitsAt } from '../public/world/backrooms/gen.js';
import { dealtThemes } from '../public/world/backrooms/themes.js';

const IDS = ['vestibule', 'copiers', 'quiet-zone', 'mailroom'];
const office = {
  name: 'Robin',
  projects: ['Webstore', 'Mobile App', 'Infra'],
  agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'],
  tasks: ['Cache the product catalogue', 'Trim the Docker image'],
};
const dir = new URL('../public/world/backrooms/', import.meta.url);

test('wave two: each of the four is in the deck, in a file of its own, with a hiding place on its own line', () => {
  for (const id of IDS) {
    const a = ARCHETYPES[id];
    assert.ok(a, `${id} is in the deck`);
    assert.equal(a.module, `./rooms/${id}.js`);
    assert.equal(typeof a.stash, 'function');
    assert.equal(STASH[id], a.stash);
    assert.ok(!a.big && !a.planned && !a.headline, `${id} is an ordinary room, dealt by chance`);
    const src = readFileSync(new URL(`rooms/${id}.js`, dir), 'utf8');
    assert.match(src, /export function build\(c\)/);
    assert.ok(!/Math\.random/.test(src), `${id}: nothing in it is left to chance that the seed did not decide`);
  }
});

test('wave two: the same seed rolls the same room on every kind of floor, with every blank filled in', () => {
  for (const id of IDS) for (const theme of dealtThemes()) for (const seed of ['w2-a', 77]) {
    const a = generate(seed, { ...office, theme, only: id }), b = generate(seed, { ...office, theme, only: id });
    const room = a.rooms.find((r) => r.arch === id);
    assert.ok(room, `${id} is on a ${theme} floor asked for by itself (${seed})`);
    assert.deepEqual(room.params, b.rooms.find((r) => r.arch === id).params);
    assert.ok(!/\{[a-z]+\}/i.test(JSON.stringify(room.params)), `${id} left a blank unfilled`);
  }
});

test('wave two: one copier in the copy room prints the way on, and only one', () => {
  for (let i = 0; i < 30; i++) {
    const p = generate(`copy-${i}`, { ...office, only: 'copiers' }).rooms.find((r) => r.arch === 'copiers').params;
    assert.equal(p.sheets.length, p.pairs * 2);
    assert.equal(p.sheets.filter((s) => s === 'route').length, 1);
    assert.equal(p.sheets[p.clue], 'route');
  }
});

test('wave two: a tape hidden in any of the four is inside the walls and out of every doorway', () => {
  for (const id of IDS) for (let i = 0; i < 40; i++) {
    const room = generate(`stash-${id}-${i}`, { ...office, only: id }).rooms.find((r) => r.arch === id);
    const spots = coinSpots(room);
    assert.ok(spots.length >= 1, `${id} (${i}): nowhere to hide a tape`);
    for (const { x, z } of spots) {
      assert.ok(Math.abs(x) <= room.W / 2 - 0.5 && Math.abs(z) <= room.D / 2 - 0.5 && fitsAt(room, x, z, 0.35), `${id}: a tape in the wall (${x}, ${z})`);
      for (const d of room.doors) { const p = wallPoint(room, d.side, d.c, 0.3); assert.ok(Math.hypot(x - p.x, z - p.z) >= 1.25, `${id}: a tape in the ${d.side} doorway`); }
    }
  }
});

test('wave two: the two rooms that point the way on ask the floor where it is, and the quiet room never shuts a door for good', () => {
  for (const id of ['copiers', 'mailroom']) {
    const src = readFileSync(new URL(`rooms/${id}.js`, dir), 'utf8');
    assert.match(src, /roomDistances\(c\.level, c\.level\.exit\.room\)/, `${id} works out which doorway is nearer the way down`);
  }
  const quiet = readFileSync(new URL('rooms/quiet-zone.js', dir), 'utf8');
  assert.match(quiet, /on: false/, 'its shutters are open when the room is built, so every path through it exists');
  assert.match(quiet, /c\.rt\.onLeave/, 'and whatever state it was in is undone when the room is left');
  const jam = readFileSync(new URL('rooms/vestibule.js', dir), 'utf8');
  assert.match(jam, /if \(jammed\) c\.solid\(/, 'the jammed drum is really in the way');
});
