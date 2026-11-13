// The lift: its floors are well formed, the hidden one keeps to its rule,
// every floor has a module behind it, and the daemon tells agents about the
// same floors the panel shows humans.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LEVELS, LEVEL_KINDS, HOME, levelById, findLevel, isVisible, visibleLevels, levelContext } from '../core/levels.mjs';
import { buildLayout } from '../core/layout.mjs';
import { createNav } from '../core/nav.mjs';
import { SECRETS } from '../core/secrets.mjs';
import { ROOT, startOffice } from './helpers.mjs';

test('levels: the registry is well formed', () => {
  assert.ok(LEVELS.length >= 4);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length, 'ids are unique');
  assert.equal(new Set(LEVELS.map((l) => l.floor)).size, LEVELS.length, 'button labels are unique');
  assert.equal(new Set(LEVELS.map((l) => l.storey)).size, LEVELS.length, 'no two floors share a storey');
  for (const l of LEVELS) {
    assert.match(l.id, /^[a-z][a-z0-9-]*$/, `${l.id}: an id is a plain word`);
    assert.ok(l.floor && l.floor.length <= 2, `${l.id}: the label fits on a button`);
    assert.ok(l.name && l.name.length > 2, `${l.id} has a name`);
    assert.ok(l.blurb && l.blurb.length > 10, `${l.id} has a blurb`);
    assert.ok(LEVEL_KINDS.includes(l.kind), `${l.id}: kind is one of ${LEVEL_KINDS.join(', ')}`);
    assert.ok(Number.isInteger(l.storey), `${l.id} stops at a storey`);
    assert.ok(l.hidden === undefined || typeof l.hidden === 'function', `${l.id}: hidden is a rule or absent`);
    assert.ok(Object.isFrozen(l), 'pure data: nobody edits a floor at runtime');
  }
  const home = levelById(HOME);
  assert.ok(home && home.kind === 'office' && home.storey === 0 && !home.hidden, 'the lobby is the office, and is always there');
  assert.equal(LEVELS.filter((l) => l.kind === 'office').length, 1);
  assert.deepEqual(['L', 'R', 'A', 'M', '13'].filter((f) => !LEVELS.some((l) => l.floor === f)), [], 'the floors the lift was built for');
});

test('levels: floors are found by id or by what is on the button', () => {
  assert.equal(findLevel('roof').floor, 'R');
  assert.equal(findLevel('R').id, 'roof');
  assert.equal(findLevel(' m ').id, 'mission');
  assert.equal(findLevel('13').id, 'thirteen');
  assert.equal(findLevel(''), null);
  assert.equal(findLevel('penthouse'), null);
  assert.equal(levelById('nope'), null);
});

test('levels: the thirteenth floor is only there on a Friday the 13th, or once someone has fallen out of the office', () => {
  const thirteen = findLevel('13');
  assert.equal(typeof thirteen.hidden, 'function');
  const floors = (ctx) => visibleLevels(ctx).map((l) => l.floor);
  assert.ok(!floors().includes('13'), 'hidden when nothing is known');
  assert.ok(!floors({ quirks: [], found: [] }).includes('13'), 'hidden on an ordinary day');
  assert.ok(!floors({ quirks: ['friday', 'winter'], found: ['red-book', 'duck'] }).includes('13'), 'other quirks and discoveries do not count');
  assert.ok(floors({ quirks: ['friday-13'], found: [] }).includes('13'), 'there on a Friday the 13th');
  assert.ok(floors({ quirks: [], found: ['noclip'] }).includes('13'), 'there once the noclip secret has been found');
  assert.equal(isVisible(thirteen, { quirks: new Set(['friday-13']) }), true, 'any iterable will do');
  assert.ok(SECRETS.some((s) => s.id === 'noclip'), 'the rule names a discovery that exists');
  // everything else is always on the panel, in the same order
  const always = LEVELS.filter((l) => !l.hidden).map((l) => l.floor);
  assert.deepEqual(floors({}), always);
  assert.deepEqual(floors({ quirks: ['friday-13'] }).filter((f) => f !== '13'), always);
  // the rule is pure: asking does not change the answer
  const ctx = { quirks: ['friday-13'], found: [] };
  visibleLevels(ctx); visibleLevels(ctx);
  assert.deepEqual(ctx, { quirks: ['friday-13'], found: [] });
  // and it reads straight off a world snapshot
  assert.deepEqual(levelContext({ today: { quirks: ['friday-13'] }, discoveries: { noclip: { byName: 'Robin' } } }), { quirks: ['friday-13'], found: ['noclip'] });
  assert.deepEqual(levelContext(null), { quirks: [], found: [] });
});

test('levels: every floor has a module behind it that can be entered', () => {
  const dir = path.join(ROOT, 'public', 'world', 'levels');
  const index = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
  for (const l of LEVELS) {
    const entry = new RegExp(`\\b${l.id}:\\s*\\(\\)\\s*=>\\s*import\\('\\./([\\w./-]+)'\\)`).exec(index);
    if (!entry) {
      assert.ok(l.id === HOME || new RegExp(`['"]${l.id}['"]`).test(index), `${l.id} has neither a module nor a special case in levels/index.js`);
      continue;
    }
    const file = path.join(dir, entry[1]);
    assert.ok(fs.existsSync(file), `${l.id} → ${entry[1]} exists`);
    assert.match(fs.readFileSync(file, 'utf8'), /export\s+(async\s+)?function\s+enter\s*\(/, `${entry[1]} exports enter(office, opt)`);
  }
});

test('levels: the landing has something to call the lift with, and you can walk up to it', () => {
  const layout = buildLayout({ rooms: [{ slot: 0, deptId: 'atlas', name: 'Atlas' }] });
  const lifts = [...layout.pois.values()].filter((p) => p.kind === 'elevator');
  assert.equal(lifts.length, 1, 'one lift');
  const lift = lifts[0];
  assert.equal(lift.room, 'landing');
  assert.ok(layout.walkable(Math.floor(lift.stand.x), Math.floor(lift.stand.z)), 'you can stand at it');
  assert.ok(createNav(layout).findPath(layout.desk('dept:atlas#1').seat, lift.stand), 'and get there from a desk');
  assert.ok(layout.walkable(Math.floor(layout.spots.landing.x), Math.floor(layout.spots.landing.z)), 'the call panel does not block the way out of the lift');
  assert.ok(createNav(layout).findPath(layout.spots.elevator, layout.desk('dept:atlas#1').seat), 'arrivals still reach their desks');
});

test('levels: the daemon tells agents which floors the lift serves, and that riding is for humans', async (t) => {
  const office = await startOffice();
  t.after(() => office.stop());
  const joined = await office.post('/api/agents/join', { provider: 'gemini', name: 'Ada', cwd: '/tmp/proj/atlas' });
  const agent = joined.data.agent.id;
  const expected = async () => visibleLevels(levelContext((await office.get('/api/world')).data));
  const lists = (text, levels) => {
    for (const l of levels) {
      assert.ok(new RegExp(`^\\s*${l.floor}\\s+·`, 'm').test(text), `floor ${l.floor} is on the panel:\n${text}`);
      if (!l.unmarked) assert.ok(text.includes(l.name), `${l.name} is named`);
    }
    assert.equal(text.split('\n').filter((line) => /^\s+\S+\s+·/.test(line)).length, levels.length, `exactly the visible floors:\n${text}`);
  };

  const before = await expected();
  assert.ok(before.length >= 4);
  const today = (await office.get('/api/world')).data.today.quirks;
  assert.equal(before.some((l) => l.floor === '13'), today.includes('friday-13'), 'nobody has found anything yet, so 13 is down to the calendar');

  for (const name of ['elevator', 'lift', 'the lift']) {
    const look = await office.get(`/api/world/look?agent=${agent}&at=${encodeURIComponent(name)}`);
    assert.equal(look.status, 200, `look ${name}`);
    lists(look.data.text, before);
    assert.match(look.data.text, /humans only/);
    assert.match(look.data.text, /you are here/);
  }

  const use = await office.post('/api/world/use', { agent, thing: 'elevator' });
  assert.equal(use.status, 200);
  lists(use.data.text, before);
  assert.match(use.data.text, /humans only/);
  const where = await office.get(`/api/world/look?agent=${agent}`);
  assert.equal(where.data.room, 'landing', 'using the lift walks you to it, like anything else');
  assert.match(where.data.text, new RegExp(`the lift \\(${before.length} floors\\)`));

  // a human pressing the button through the API gets the same panel
  const lead = await office.post('/api/world/lead/use', { id: 'tester', name: 'Robin', thing: 'lift' });
  assert.equal(lead.status, 200);
  lists(lead.data.text, before);

  // once someone has fallen out of the office, there is one more button
  const found = await office.post('/api/world/discover', { secret: 'noclip', name: 'Robin' });
  assert.equal(found.status, 200);
  const after = await expected();
  assert.ok(after.some((l) => l.floor === '13'));
  const again = await office.get(`/api/world/look?agent=${agent}&at=lift`);
  lists(again.data.text, after);
  assert.match(again.data.text, /^\s*13\s+·.*no label/m, 'and it has no name');

  const map = await office.get(`/api/world/map?agent=${agent}`);
  assert.match(map.data.text, /The lift .*Rooftop Garden.*Mission Control/);
});
