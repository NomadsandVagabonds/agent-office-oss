// Somebody a room keeps (resident.js): health from the cast's own table, a jab and a shove that find it, a death and a
// flinch drawn by the same two calls, and got-away-from counted once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RESIDENT, shoveOf, createResidents, resident } from '../public/world/backrooms/resident.js';
import { HEALTH, TIER, healthOf, UNHITTABLE } from '../public/world/backrooms/cast/health.rule.js';
import { SHOVE, strikeShove } from '../public/world/backrooms/shove.rule.js';
import { strikeSnip } from '../public/world/backrooms/melee.js';

const floor = () => { const log = []; const env = { world: { floorY: () => 0, los: () => true }, run: { met: (id) => log.push('met ' + id), survived: (id) => log.push('survived ' + id) } }; return { env, log }; };
const ME = { x: 0, z: 0, y: 0.9, yaw: 0 };          // facing −z
const jab = (env) => strikeSnip(ME, env.residents.snipTargets(), () => true);

test('every waterpark resident named has a tier, and a line for what a shove does to it', () => {
  for (const id of ['guard-stand', 'lane-keeper', 'flume-toner', 'plenum-toner', 'inverted-bathers', 'towel-return', 'pool-skimmer']) {
    assert.ok(healthOf(id) >= 1 && healthOf(id) <= 3, id);
    assert.ok(RESIDENT[id] && RESIDENT[id].stagger > 0 && RESIDENT[id].push >= 0, id);
    assert.ok(!UNHITTABLE.includes(id));
  }
  assert.equal(TIER['plenum-toner'], TIER.toner); assert.equal(TIER['flume-toner'], TIER.toner);          // a toner is a toner wherever it is kept
  for (const id of Object.keys(RESIDENT)) assert.ok(TIER[id], `${id} can be shoved and so can be hurt`);
  assert.deepEqual(shoveOf('nobody'), { push: 0, stagger: SHOVE.stagger });
  assert.ok(RESIDENT['guard-stand'].push <= SHOVE.push);
});

test('a medium resident takes two jabs: the first is what a jab always was, the second starts it dying, and then it is gone', () => {
  const { env, log } = floor(), seen = [];
  const life = resident(env, 'guard-stand', { at: () => ({ x: 0, z: -0.8 }), r: 0.4, hit: (h) => seen.push(h.killed ? 'killed' : 'hit'), dies: (k) => seen.push('dies ' + k.toFixed(2)), flinch: () => seen.push('flinch'), gone: () => seen.push('gone') });
  assert.deepEqual(life.vital, { hp: 2, max: 2, hurt: Infinity, dying: null, gone: false, takes: HEALTH.takes.medium });
  assert.deepEqual(jab(env), { ok: true, target: 'guard-stand' });
  assert.equal(life.vital.hp, 1); assert.equal(life.hurt, 0); assert.equal(life.out, false);
  assert.equal(life.stalled, true, 'with no stand-down of its own it is stood still by the hit');
  env.residents.update(0.1); assert.deepEqual(seen, ['hit'], 'one frame where it was put before the pose');
  env.residents.update(0.1); assert.deepEqual(seen, ['hit', 'flinch']);
  env.residents.update(HEALTH.flinch); assert.equal(life.stalled, false);
  jab(env);
  assert.equal(life.out, true); assert.equal(life.dying, 0);
  assert.equal(env.residents.snipTargets().length, 0, 'one that is dying is not hit again');
  assert.equal(env.residents.shoveTargets().length, 0, '…nor pushed');
  env.residents.update(HEALTH.takes.medium / 2); assert.equal(seen.at(-1), 'dies 0.50'); assert.equal(life.gone, false);
  env.residents.update(HEALTH.takes.medium); assert.equal(life.gone, true); assert.equal(seen.at(-1), 'gone');
  assert.equal(env.residents.all().length, 0);
  assert.deepEqual(log, ['met guard-stand', 'survived guard-stand'], 'met once, got away from once, however many jabs');
  const n = seen.length; env.residents.update(1); life.tick(1); assert.equal(seen.length, n, 'nothing more is asked of it');
});

test('one with a stand-down of its own is not stood still by a jab; one out of reach is not found; one with no tier cannot be hurt', () => {
  const { env } = floor(); let open = true;
  const a = resident(env, 'lane-keeper', { at: () => ({ x: 0, z: -0.8 }), recoils: true, when: () => open });
  jab(env); assert.equal(a.vital.hp, 1); assert.equal(a.stalled, false);
  open = false; assert.equal(env.residents.snipTargets().length, 0); assert.equal(env.residents.shoveTargets().length, 0);
  assert.equal(jab(env).ok, false);
  const b = resident(env, 'the-wake', { at: () => ({ x: 0, z: -0.8 }) });
  assert.equal(b.vital, null); assert.equal(env.residents.snipTargets().length, 0);
  assert.equal(env.residents.shoveTargets().length, 1, 'but hands still find it');
  assert.deepEqual(b.strike(), { ok: false, killed: false, hp: 0 });
});

test('a shove: one that gives is slid back as far as there is floor for and stands; one in the water only stands', () => {
  const { env } = floor(); const at = { x: 0, z: -0.8 };
  const chair = resident(env, 'guard-stand', { at: () => at, move: (to) => { at.x = to.x; at.z = to.z; } });
  assert.deepEqual(strikeShove(ME, env.residents.shoveTargets(), () => true), ['guard-stand']);
  assert.ok(Math.abs(at.z - (-0.8 - RESIDENT['guard-stand'].push)) < 1e-9 && at.x === 0, 'straight back, the way the hands went');
  assert.equal(chair.stalled, true); assert.equal(chair.vital.hp, 2, 'a shove hurts nothing');
  env.residents.update(0.01); env.residents.update(RESIDENT['guard-stand'].stagger); assert.equal(chair.stalled, false);
  // against a wall it is not moved, and still stands
  env.world.los = () => false; const z = at.z; at.z = -0.8;
  strikeShove(ME, env.residents.shoveTargets(), () => true); assert.equal(at.z, -0.8); assert.equal(chair.stalled, true); at.z = z;
  env.world.los = () => true;
  const sw = { x: 0.2, z: -0.9 }, keeper = resident(env, 'lane-keeper', { at: () => sw, move: () => assert.fail('nothing in the water is slid') });
  chair.remove();
  assert.deepEqual(strikeShove(ME, env.residents.shoveTargets(), () => true), ['lane-keeper']);
  assert.equal(keeper.stalled, true);
  // a room that does all of a shove itself (a toner: it lets go by its own rule)
  keeper.remove(); let did = 0;
  const toner = resident(env, 'flume-toner', { at: () => sw, shoved: () => { did++; return true; } });
  strikeShove(ME, env.residents.shoveTargets(), () => true); assert.equal(did, 1); assert.equal(toner.stalled, false);
  toner.remove(); resident(env, 'pool-skimmer', { at: () => sw, shove: false });
  assert.equal(env.residents.shoveTargets().length, 0);
});

test('several of one name are each their own, and are got away from once between them', () => {
  const { env, log } = floor();
  const a = resident(env, 'towel-return', { at: () => ({ x: -0.2, z: -0.7 }) }), b = resident(env, 'towel-return', { at: () => ({ x: 0.3, z: -1.0 }) });
  jab(env); assert.equal(a.out, true); assert.equal(b.out, false, 'basic: one jab, and only the one it reached');
  a.escaped(); b.escaped(); jab(env); assert.equal(b.out, true);
  assert.deepEqual(log.filter((l) => l.startsWith('survived')), ['survived towel-return']);
  assert.equal(env.residents.vital('towel-return').dying, 0);
});

test('one that has a denizen goes where its denizen goes: gone, away with its room or not shown, it is nobody\'s target', () => {
  const { env } = floor(), d = { x: 0, z: -0.8 };
  resident(env, 'pool-skimmer', { of: d });
  assert.equal(env.residents.snipTargets()[0].z, -0.8);
  for (const k of ['gone', 'away']) { d[k] = true; assert.equal(env.residents.snipTargets().length, 0, k); d[k] = false; }
  d.visible = false; assert.equal(env.residents.shoveTargets().length, 0); d.visible = true;
  assert.equal(env.residents.snipTargets().length, 1);
});

test('a floor has one list, whoever asks first; and the floor asks it for a jab, for a shove and for time', () => {
  const env = {}; const life = resident(env, 'guard-stand', { at: () => ({ x: 0, z: 0 }) });
  assert.equal(createResidents(env), env.residents); assert.equal(env.residents.all()[0], life);
  const index = readFileSync(new URL('../public/world/backrooms/index.js', import.meta.url), 'utf8');
  assert.match(index, /createDenizens\(env\); createResidents\(env\);/);
  assert.match(index, /strikeShove\(me, \[\.\.\.\(env\.pursuer\?\.shoveTargets\?\.\(\) \|\| \[\]\), \.\.\.\(env\.residents\?\.shoveTargets\?\.\(\) \|\| \[\]\)\]/);
  assert.match(index, /\.\.\.\(env\.residents\?\.snipTargets\?\.\(\) \|\| \[\]\)/);
  assert.match(index, /env\.denizens\?\.update\(dt, time\); env\.residents\?\.update\(dt\);/);
  // no three.js, nothing of the page: a room's rule may import it, and so may a test
  const src = readFileSync(new URL('../public/world/backrooms/resident.js', import.meta.url), 'utf8');
  assert.deepEqual([...src.matchAll(/^import .* from '(.*)';$/gm)].map((m) => m[1]), ['./cast/health.rule.js', './shove.rule.js']);
});
