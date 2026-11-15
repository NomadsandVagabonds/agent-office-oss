// The banner near the landing: what it says (the place on its second line), where it hangs (the seed's business, the
// same for everybody who walks a building), and that it is no part of the level's data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planVisit, floorOf } from '../public/world/backrooms/plan.js';
import { ceilAt, floorAt } from '../public/world/backrooms/gen.js';
import { BANNER, BANNER_TOP, BANNER_NOWHERE, WHERE_MAX, cleanWhere, bannerLines, bannerSpot } from '../public/world/backrooms/banner.rule.js';

const office = { name: 'Robin', projects: ['Webstore', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo', 'Ember Numbat'], tasks: [{ title: 'Cache the catalogue' }] };
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('what is lettered on it: the award, and under it of where — or, with nowhere to say, what such banners say', () => {
  assert.deepEqual(bannerLines('Portland'), ['VOTED 6TH BEST OFFICE PARK', 'OF PORTLAND']);
  assert.deepEqual(bannerLines('São Paulo'), [BANNER_TOP, 'OF SÃO PAULO']);
  assert.deepEqual(bannerLines("Coeur d'Alene"), [BANNER_TOP, "OF COEUR D'ALENE"]);
  for (const none of [undefined, null, '', '   ', 7, {}, '<b>x</b>', 'https://evil.example', 'a\nb', 'x'.repeat(WHERE_MAX + 1), '-x']) assert.deepEqual(bannerLines(none), [BANNER_TOP, BANNER_NOWHERE], String(none));
  assert.equal(cleanWhere('  New   York '), 'New York');
});

test('where it hangs: near where a visit lands, over everybody\'s head, clear of what stands there, and the same every time', () => {
  let hung = 0, landing = 0;
  for (let i = 0; i < 80; i++) {
    const seed = `banner-${i}`, visit = planVisit(seed, office), level = floorOf(visit, 0), spot = bannerSpot(level);
    assert.deepEqual(bannerSpot(floorOf(planVisit(seed, office), 0)), spot, `seed ${seed}: not the same place twice`);
    for (let k = 1; k < visit.depths; k++) assert.equal(bannerSpot(floorOf(visit, k)), null, `seed ${seed}: a banner below the part a visit lands in`);
    if (!spot) continue;
    hung++; if (spot.room === level.start.room) landing++;
    const room = level.rooms[spot.room], ax = spot.nz, az = -spot.nx;
    assert.ok(room.kind === 'start' || room.kind === 'plain', `seed ${seed}: in a ${room.arch || room.kind}`);
    assert.ok(Math.abs(spot.nx) + Math.abs(spot.nz) === 1, 'square to the room');
    assert.ok(spot.half >= BANNER.least && spot.half <= BANNER.half);
    for (const s of [-spot.half, 0, spot.half]) {
      const x = spot.x + ax * s, z = spot.z + az * s;
      assert.ok(Math.abs(x) <= room.W / 2 - 0.3 && Math.abs(z) <= room.D / 2 - 0.3, `seed ${seed}: it runs into a wall`);
      assert.ok(Math.abs(floorAt(room, x, z)) <= 0.02 && ceilAt(room, x, z) - BANNER.under - BANNER.tall >= BANNER.clear, `seed ${seed}: somebody could walk into it`);
      for (const p of room.pillars || []) assert.ok(!(Math.abs(x - p.x) < p.w / 2 && Math.abs(z - p.z) < p.d / 2) || (p.h ?? Infinity) < BANNER.clear, `seed ${seed}: it hangs through something`);
    }
    assert.ok(Math.abs(spot.top - (ceilAt(room, spot.x, spot.z) - BANNER.under)) < 1e-6);
  }
  assert.ok(hung >= 72, `a banner in ${hung} of 80 buildings`);
  assert.ok(landing >= hung * 0.8, `in the room one lands in, mostly: ${landing} of ${hung}`);
});

test('it is the same building whoever walks it: the place is the visitor\'s, the banner is not in the level\'s data', () => {
  const rule = read('../public/world/backrooms/banner.rule.js'), hang = read('../public/world/backrooms/banner.js'), conductor = read('../public/world/backrooms/index.js');
  assert.ok(!/\bwhere\b|cleanWhere/.test(rule.slice(rule.indexOf('export function bannerSpot')).replace(/\/\/.*$/gm, '')), 'where it hangs has nothing to do with where the visitor is');
  for (const f of ['gen.js', 'plan.js', 'supplies.js']) assert.ok(!/banner\.rule|bannerSpot|hangBanner|BANNER_TOP/.test(read(`../public/world/backrooms/${f}`)), `${f} knows of the banner: the generator, the plan and what is lying about know nothing of it`);
  assert.match(conductor, /where: cleanWhere\(opt\.where\),/, 'the place is cleaned once, where it comes in');
  assert.ok(conductor.indexOf('const ask = {') > 0 && !/\bwhere\b/.test(conductor.slice(conductor.indexOf('const ask = {'), conductor.indexOf('let plan = planVisit')).replace(/\/\/.*$/gm, '')), 'and is not something a building is planned from');
  assert.match(conductor, /if \(\(level\.depth \| 0\) === 0\) \(env\.ready \|\| \(env\.ready = \[\]\)\)\.push\(\(\) => \{ try \{ hangBanner\(env\); \}/, 'hung once the first part is built, and never worth an error');
  assert.match(hang, /bannerLines\(env\.where\)/);
  assert.ok(!/fetch\(|localStorage|navigator\.|https?:\/\//.test(rule + hang), 'the level asks nobody where anybody is');
});
