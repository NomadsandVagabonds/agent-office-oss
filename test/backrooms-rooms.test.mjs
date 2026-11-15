// The Backrooms — what a room has to be to go in the deck. These are the rules
// docs/BACKROOMS.md gives to whoever writes one ("Adding a room"), held to here so that
// a room from anybody — a helper, another agent, somebody who has never seen
// the rest of the code — either fits or says exactly why it does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DECK, ARCHETYPES, STASH, LESSONS, lessons, isBig, generate } from '../public/world/backrooms/gen.js';
import { MORE_DECK } from '../public/world/backrooms/deck2.js';
import { planVisit, floorOf, KNOWN_AT_START } from '../public/world/backrooms/plan.js';
import { THEME_IDS } from '../public/world/backrooms/themes.js';

const dir = new URL('../public/world/backrooms/', import.meta.url);
const office = { name: 'Robin', projects: ['Webstore', 'Mobile App', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat', 'Olive Heron'], tasks: ['Cache the product catalogue'] };
// (a retired room — `on: false` — is out of the deck, but what it says must still make sense: it may come back)
const EVERY = [...DECK, ...MORE_DECK.filter((a) => a.on === false)];

test('a deck entry says what the generator needs to know, and none of it is out of range', () => {
  assert.equal(new Set(EVERY.map((a) => a.id)).size, EVERY.length, 'no two rooms share an id');
  for (const a of EVERY) {
    const say = (what) => `${a.id}: ${what}`;
    assert.match(a.id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, say('an id is lower-case words joined by hyphens'));
    for (const key of ['name', 'landmark']) assert.ok(typeof a[key] === 'string' && a[key].trim().length > 1, say(`it has a ${key}`));
    // (a set piece — `big`, or a room with a view — may be larger than anything else: it is the only one on its floor)
    const most = isBig(a) ? 28 : 20, tallest = isBig(a) ? 12 : 9;
    for (const key of ['w', 'd']) {
      assert.ok(Array.isArray(a[key]) && a[key].length === 2 && a[key].every(Number.isInteger), say(`${key} is [fewest, most] whole metres`));
      assert.ok(a[key][0] >= 3 && a[key][0] <= a[key][1] && a[key][1] <= most, say(`${key} is between 3 and ${most} metres, smaller first`));
    }
    if (a.h !== undefined) assert.ok(Array.isArray(a.h) && a.h.length === 2 && a.h[0] >= 2.3 && a.h[0] <= a.h[1] && a.h[1] <= tallest, say(`h is [lowest, highest] ceiling: 2.3 to ${tallest} metres`));
    assert.ok(Array.isArray(a.ports) && a.ports.every((p) => ['back', 'left', 'right'].includes(p)) && new Set(a.ports).size === a.ports.length, say('ports are walls that may take one more doorway: back, left, right (never front: that is the way in)'));
    assert.ok(Number.isFinite(a.weight) && a.weight > 0 && a.weight <= 3, say('weight is how often it is dealt: above 0, 3 at most'));
    assert.ok(['normal', 'entry', 'dim', 'dark', 'one'].includes(a.lights), say('lights is normal, entry, dim, dark or one'));
    assert.equal(typeof a.roll, 'function', say('roll(R, o) decides its details from the seed'));
    if (a.themes !== undefined) for (const [id, k] of Object.entries(a.themes)) assert.ok((id === '*' || THEME_IDS.includes(id)) && Number.isFinite(k) && k >= 0, say(`themes: ${id} is not a kind of floor, or its weight is not a number`));
    for (const key of ['planned', 'headline', 'big', 'doored', 'on']) if (a[key] !== undefined) assert.equal(typeof a[key], 'boolean', say(`${key} is true or false`));
    if (a.headline) assert.ok(!a.teaches, say('a room staged from the news teaches nothing: nobody may depend on having seen it'));
  }
});

test('what a room rolls is decided by the seed and by nothing else', () => {
  for (const a of DECK) {
    const params = (seed) => generate(seed, { ...office, only: a.id }).rooms.find((r) => r.arch === a.id).params;
    for (const seed of [11, 'again']) {
      const first = params(seed);
      assert.equal(Object.prototype.toString.call(first), '[object Object]', `${a.id}: roll returns its details as an object`);
      assert.deepEqual(first, params(seed), `${a.id}: the same seed rolled it differently the second time`);
      assert.deepEqual(JSON.parse(JSON.stringify(first)), first, `${a.id}: what it rolls is plain data — numbers, strings, lists — and nothing that cannot be written down`);
    }
  }
});

test('a room in a file of its own: the file is named for it, exports build(c), brings its hiding place, and reaches for nothing outside', () => {
  const files = existsSync(new URL('rooms/', dir)) ? readdirSync(new URL('rooms/', dir)).filter((f) => f.endsWith('.js')) : [];
  const named = new Map(EVERY.filter((a) => a.module).map((a) => [a.module, a]));
  for (const [module, a] of named) {
    assert.equal(module, `./rooms/${a.id}.js`, `${a.id}: its file is rooms/${a.id}.js`);
    assert.ok(files.includes(`${a.id}.js`), `${a.id}: ${module} is not there`);
    const src = readFileSync(new URL(module, dir), 'utf8');
    assert.match(src, /^export function build\s*\(\s*c\s*\)/m, `${module} exports build(c)`);
    assert.equal(typeof a.stash, 'function', `${a.id}: a room in its own file says where a tape may hide in it (stash) in its own deck entry`);
    // offline first, and nothing kept: a room draws what its seed says, and remembers nothing
    for (const [what, re] of [['the network', /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\//], ['storage', /localStorage|sessionStorage|indexedDB|document\.cookie/], ['code from somewhere else', /\bimport\s*\(|\beval\s*\(|new Function\b/]]) {
      assert.ok(!re.test(src), `${module} reaches for ${what}`);
    }
    // what it imports is the level's own modules, the voxel kit, and three
    for (const [, from] of src.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      assert.ok(from === 'three' || /^\.\.\/(?!\.\.\/)[\w./-]+\.js$/.test(from) || /^\.\.\/\.\.\/(vox|props|avatar)\/[\w./-]+\.js$/.test(from) || /^\.\/[\w./-]+\.js$/.test(from), `${module} imports ${from}: a room uses three, the level's own modules (../), the voxel kit (../../vox/), the office's props (../../props/) and its people (../../avatar/)`);
    }
  }
  for (const f of files) assert.ok(named.has(`./rooms/${f}`), `rooms/${f} is nobody's: no deck entry names it`);
});

test('every room has a place of its own for a tape, inside its walls, whichever side it is asked for', () => {
  for (const a of DECK) {
    assert.equal(typeof STASH[a.id], 'function', `${a.id} has no hiding place (stash)`);
    for (const seed of [2, 19, 'z']) {
      const r = generate(seed, { ...office, only: a.id }).rooms.find((room) => room.arch === a.id);
      for (const side of [-1, 1]) {
        const lay = STASH[a.id](r, side), zones = Array.isArray(lay[0]) ? lay : [lay];
        for (const z of zones) assert.ok(z.length === 4 && z.every(Number.isFinite) && z[0] <= z[2] && z[1] <= z[3] && z[0] > -r.W / 2 && z[2] < r.W / 2 && z[1] > -r.D / 2 && z[3] < r.D / 2, `${a.id} (${r.W} × ${r.D}): [${z}] is not a patch of its own floor`);
      }
    }
  }
});

test('lessons: every lesson on the list, and nothing taken for granted that no room teaches (a room may teach more than one thing: the owner dropped the limit)', () => {
  const ids = Object.keys(LESSONS);
  for (const id of ids) assert.ok(/^[a-z][a-z0-9-]*$/.test(id) && typeof LESSONS[id] === 'string' && LESSONS[id].length > 10, `lesson ${id}: an id, and a line saying what is learned`);
  for (const id of KNOWN_AT_START) assert.ok(ids.includes(id), `${id} is known from the start but is not on the list of lessons`);
  const taught = new Set(KNOWN_AT_START);
  for (const a of DECK) for (const t of lessons(a).teaches) taught.add(t);
  for (const a of EVERY) {
    const { teaches, needs } = lessons(a);
    assert.equal(new Set(teaches).size, teaches.length, `${a.id} says it teaches the same thing twice`);
    for (const id of [...teaches, ...needs]) assert.ok(ids.includes(id), `${a.id}: "${id}" is not on the list of lessons (LESSONS in gen.js)`);
    for (const id of needs) {
      assert.ok(!teaches.includes(id), `${a.id} cannot take for granted the thing it is there to teach (${id})`);
      if (a.on !== false) assert.ok(taught.has(id), `${a.id} needs "${id}", which no room in the deck teaches: it would never be dealt`);
    }
    // (on the floor you land on, only what everybody knows already can be needed: a room that needs more is for further down)
  }
  // a lesson nobody teaches and nobody is born knowing is a line that should not be on the list
  for (const id of ids) assert.ok(taught.has(id) || EVERY.some((a) => a.on === false && lessons(a).teaches.includes(id)), `lesson ${id} is on the list, but no room teaches it`);
});

test('pacing: two rooms in three are plain on every floor, no doorway from one oddity straight into another, one set piece to a floor', () => {
  let floors = 0, least = 1;
  for (let seed = 1; seed <= 40; seed++) {
    const visit = planVisit(`pace-${seed}`, office);
    for (let i = 0; i < visit.depths; i++) {
      const level = floorOf(visit, i), odd = level.rooms.filter((r) => r.kind === 'special');
      floors++;
      const quiet = 1 - odd.length / level.rooms.length;
      least = Math.min(least, quiet);
      assert.ok(quiet >= 0.65, `seed pace-${seed}, floor ${i}: only ${Math.round(quiet * 100)}% of its rooms are plain`);
      for (const r of odd) for (const d of r.doors) assert.notEqual(level.rooms[d.to].kind, 'special', `seed pace-${seed}, floor ${i}: ${r.arch} opens straight into ${level.rooms[d.to].arch}`);
      assert.ok(odd.filter((r) => isBig(ARCHETYPES[r.arch])).length <= 1, `seed pace-${seed}, floor ${i}: more than one set piece`);
    }
  }
  assert.ok(floors > 100 && least < 1);
});

test('somebody lives in a room: it says who, what a catch costs and what they care about, and a part of the building has one such room at most', () => {
  const ITEM_TYPES = ['torch', 'battery', 'chalk', 'paper', 'pink-slip', 'scissors', 'snack', 'balloon'];
  const lived = EVERY.filter((a) => a.resident !== undefined);
  assert.equal(new Set(lived.map((a) => a.resident)).size, lived.length, 'no two rooms have the same resident');
  for (const a of lived) {
    assert.match(a.resident, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, `${a.id}: resident is the id of whoever lives there`);
    assert.ok(Number.isInteger(a.caught) && a.caught >= 0 && a.caught <= 2, `${a.id}: caught is the hearts a catch costs, 0 to 2: nothing down here takes all four at once`);
    assert.ok(Array.isArray(a.items) && a.items.every((t) => ITEM_TYPES.includes(t)), `${a.id}: items are things a visitor can carry`);
  }
  let parts = 0, withOne = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const visit = planVisit(`lived-${seed}`, office);
    for (let i = 0; i < visit.depths; i++) {
      const here = floorOf(visit, i).rooms.filter((r) => r.arch && ARCHETYPES[r.arch].resident);
      parts++; if (here.length) withOne++;
      assert.ok(here.length <= 1, `seed lived-${seed}, part ${i}: ${here.map((r) => r.arch).join(' and ')} on one part`);
    }
  }
  if (lived.length) assert.ok(withOne > 0 && withOne < parts, `rooms with residents are dealt, and not to every part (${withOne} of ${parts})`);
});
