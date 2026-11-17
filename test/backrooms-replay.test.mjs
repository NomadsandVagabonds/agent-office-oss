// A kept tape played back: the seed of a visit that got out gives the same
// building again — rooms, doors, who is in it, what is lying about — with
// nothing of the office's hidden in it; and a tape says which make of the
// building it was shot in, because the same seed in a later make is not the
// same building. (What a tape played back scores, and that it is paid nothing,
// is test/runs.test.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planVisit, floorOf, edition } from '../public/world/backrooms/plan.js';
import { ARCHETYPES } from '../public/world/backrooms/gen.js';
import { planSupplies, wantedByRooms } from '../public/world/backrooms/supplies.js';

const office = { name: 'Robin', projects: ['Webstore', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat'], tasks: [{ title: 'Cache the catalogue' }] };
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
/** Everything about a part of the building but what the office had hidden in it. */
const building = (level) => JSON.stringify({ rooms: level.rooms, links: level.links, start: level.start, exit: level.exit, pursuer: level.pursuer, stamp: level.stamp }, (k, v) => (k === 'loot' ? undefined : v));
const lying = (level) => JSON.stringify(planSupplies(level, wantedByRooms(level, ARCHETYPES)));

test('a kept seed is the same building played back: every part, whoever hunts in it, and everything lying about', () => {
  let withMascot = 0;
  for (let i = 0; i < 14; i++) {
    const seed = 1794000000000 + i * 7919;
    // the visit as it was walked: the office's keycard still to be found, so the mascot was holding it
    const walked = planVisit(seed, { ...office, loot: { card: i % 2 === 0, coins: [] } });
    // …and as it is played back: told only whether the mascot was in it (which is what the tape says), nothing hidden
    const played = planVisit(seed, { ...office, pursuer: walked.mascot !== null });
    assert.deepEqual([played.depths, played.mascot, played.hand, played.headline], [walked.depths, walked.mascot, walked.hand, walked.headline], `seed ${seed}: the plan`);
    for (let k = 0; k < walked.depths; k++) {
      const a = floorOf(walked, k), b = floorOf(played, k);
      assert.equal(building(b), building(a), `seed ${seed}, part ${k}: not the same building`);
      assert.equal(lying(b), lying(a), `seed ${seed}, part ${k}: not the same things lying about`);
      assert.ok(!b.loot || !b.loot.card, `seed ${seed}, part ${k}: a keycard in a tape played back`);
    }
    if (walked.mascot !== null) withMascot++;
  }
  assert.ok(withMascot >= 3, `the mascot was in ${withMascot} of these visits`);
  // (a visit he was kept out of — the dev page can — is played back without him too)
  const quiet = planVisit(7, { ...office, pursuer: false }), again = planVisit(7, { ...office, pursuer: false });
  assert.deepEqual([quiet.mascot, building(floorOf(again, 0))], [null, building(floorOf(quiet, 0))]);
});

test('a tape says which make of the building it was shot in: a few letters that only change when a seed would give a different building', () => {
  const make = edition();
  assert.match(make, /^[a-z0-9]{4,8}$/, 'short enough to keep on a tape (core/runs.mjs keeps sixteen letters and digits at most)');
  assert.equal(edition(), make, 'and the same every time it is asked');
  // …or the same building with somebody else in it: who there is to be dealt is part of the make (a seed deals a
  // different two of the others the day there is one more of them)
  assert.match(read('../public/world/backrooms/plan.js'), /const company = CAST\.map\(\(m\) => \[m\.id, m\.weight, m\.needs \|\| \[\], m\.themes \|\| null, \.\.\.\(m\.deep \? \['deep'\] : \[\]\)\]\);\s+const text = JSON\.stringify\(\[[^\n]*parts, company\]\);/);
});

test('the conductor plays a tape back with nothing of the office\'s in it, the picture says PLAY, and the tape of a visit that got out says what it was', () => {
  const src = read('../public/world/backrooms/index.js');
  assert.match(src, /const left = opt\.replay \? null : lootLeft\(office\);/, 'nothing is hidden in a tape played back');
  assert.match(src, /const rec = \(\) => \{ if \(!opt\.replay\) hud\.recording\(\); \};/, 'REC is for a visit; a tape goes on saying PLAY');
  assert.ok(!/hud\.recording\(\);\s*\}/.test(src.replace(/const rec = .*\n/, '')), 'every place the picture is told it is recording asks first whether this is a tape');
  assert.match(src, /if \(why === 'exit'\) \{ run\.mascot = plan\.mascot !== null; try \{ run\.edition = edition\(\); \}/);
  // the office's side of it: a tape is not a wall, pays nothing by the back way either, and earns no stamp
  const eggs = read('../public/world/eggs.js');
  assert.match(eggs, /replay: true, pursuer: typeof tape\.mascot === 'boolean' \? tape\.mascot : undefined/);
  assert.match(eggs, /const paid = !tape && /);
  assert.match(eggs, /const stamps = tape \? \[\] : /);
});
