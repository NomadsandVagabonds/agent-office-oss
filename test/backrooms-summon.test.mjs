import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIFFICULTIES, difficultyOf } from '../core/difficulty.mjs';

// (the conductor with its neighbours swapped for stubs, as coop-cast.test.mjs loads it: summon() is asked for real)
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let source = readFileSync(new URL('../public/world/backrooms/pursuer.js', import.meta.url), 'utf8');
const swaps = {
  './gen.js': 'export const makeRng=()=>()=>.5; export const roomDistances=()=>new Map();',
  './cast.js': `export const CAST=[{id:'pirate'},{id:'toner'},{id:'shadow'},{id:'head-count'}];export const castFor=()=>[];export const homeFor=()=>null;`,
  './cast/index.js': `const make=c=>({made:c.summoned===true,n:0,ready(){},appear(s){this.n++;return true;},update(){}});export const MAKERS={toner:make,shadow:make,'head-count':make};`,
  './cast/walk.js': 'export const createWalk=()=>({});',
  './doorleaf.js': 'export const hangDoors=()=>({update(){}});',
};
for (const [name, stub] of Object.entries(swaps)) source = source.replace(`'${name}'`, JSON.stringify(url(stub)));
source = source.replace("'../../../core/difficulty.mjs'", JSON.stringify(new URL('../core/difficulty.mjs', import.meta.url).href));
const { createStalkers, SUMMONABLE, maySummon } = await import(url(source));

const floor = (difficulty) => {
  const env = { level: { seed: 'test', depth: 0, difficulty }, world: { roomAt: (x) => (Math.abs(x) < 50 ? { id: 0 } : null) }, player: { me: { id: 'a', x: 0, z: 0 } }, sees: () => false };
  createStalkers(env); return env.pursuer;
};

test('only those who can turn up somewhere are called up', () => {
  assert.deepEqual([...SUMMONABLE].sort(), ['shadow', 'toner']);
  const p = floor('normal');
  assert.equal(p.summon('head-count', { x: 0, z: 0 }), null);
  assert.equal(p.summon('toner', null), null);
  assert.equal(p.summon('toner', { x: 999, z: 0 }), null, 'a spot in no room');
  assert.equal(p.of('toner'), null, 'and nobody was made for a call that failed');
  const t = p.summon('toner', { x: 1, z: 2 });
  assert.ok(t && t.made, 'made outside the deal, and told so');
  assert.equal(p.summon('toner', { x: 3, z: 2 }), t, 'a second call is one more appearance of the same creature');
  assert.equal(t.n, 2);
  assert.ok(p.summon('shadow', { x: 1, z: 2 }));
});

test('no toner is called up on a visit whose difficulty has none', () => {
  const modes = DIFFICULTIES.map((d) => d.id);
  assert.ok(modes.includes('tourist') && modes.includes('training-wheels'));
  for (const mode of modes) {
    const has = !!difficultyOf(mode).toner, p = floor(mode);
    assert.equal(maySummon('toner', mode), has, mode);
    assert.equal(!!p.summon('toner', { x: 0, z: 0 }), has, mode);
    assert.ok(p.summon('shadow', { x: 0, z: 0 }), mode);
  }
  assert.equal(difficultyOf('tourist').toner, 0);
  assert.equal(difficultyOf('training-wheels').toner, 0);
});

test('for whoever is looking: `beside` puts the visitor a step and a half from the one named, facing it, once it is somewhere', () => {
  const warps = [], me = { id: 'a', x: 0, z: 0 };
  const env = { level: { seed: 'test', depth: 0, difficulty: 'normal' }, world: { roomAt: (x) => (Math.abs(x) < 50 ? { id: 0 } : null), free: (x, z) => z > 4.9, los: () => true },
    player: { me, warp: (x, z, yaw) => warps.push([x, z, yaw]) }, sees: () => false, clock: 0 };
  createStalkers(env, { beside: 'toner' });
  const p = env.pursuer;
  p.update(0.05); assert.equal(warps.length, 0, 'nobody of that name is on the floor yet');
  const t = p.summon('toner', { x: 10, z: 5 }); t.at = () => ({ x: 10, z: 5 });
  p.update(0.05); assert.equal(warps.length, 1);
  const [x, z, yaw] = warps[0];
  assert.ok(Math.abs(Math.hypot(x - 10, z - 5) - 1.5) < 1e-9, 'a step and a half off'); assert.ok(z > 4.9, 'on a spot that is free');
  assert.ok(Math.abs(-Math.sin(yaw) * (10 - x) + -Math.cos(yaw) * (5 - z) - 1.5) < 1e-9, 'facing it');
  p.update(0.05); p.update(0.05); assert.equal(warps.length, 1, 'once: after that the visitor is their own');
  // and without the switch nobody is moved
  const quiet = []; const env2 = { ...env, player: { me, warp: (...a) => quiet.push(a) }, pursuer: null, ready: [] };
  createStalkers(env2); env2.pursuer.summon('toner', { x: 10, z: 5 }); env2.pursuer.update(0.05); assert.equal(quiet.length, 0);
});

test('the dev page\'s beside: one with nowhere to stand yet is called up first, and one that goes off when stared at is looked at aside', async () => {
  const { readFileSync } = await import('node:fs');
  const src = (p) => readFileSync(new URL(`../public/world/backrooms/${p}`, import.meta.url), 'utf8');
  const conductor = src('pursuer.js'), shadow = src('cast/shadow.js');
  // (the shadow only takes a place out of the picture: from somebody standing still it may find none, and beside had nothing to stand by)
  assert.match(conductor, /!staged\.called && env\.clock > 0\.5 && !Number\.isFinite\(who\.it\.at\?\.\(\)\?\.x\) && typeof who\.it\.appear === 'function'/);
  assert.match(conductor, /\+ \(Number\(who\.it\.aside\) \|\| 0\)\); staged\.beside = true;/);
  // its stare at a step and a half (SHADOW.cone + its own width) is less than the aside, and the aside is well inside a jab
  const { SHADOW } = await import('../public/world/backrooms/cast/shadow.rule.js');
  const { SNIP_TUNING } = await import('../public/world/backrooms/melee.js');
  const aside = Number(/aside: ([\d.]+),/.exec(shadow)[1]);
  assert.ok(aside > SHADOW.cone + Math.atan2(0.25, 1.5), 'not a stare');
  assert.ok(aside < Math.acos(SNIP_TUNING.minDot), 'within a jab');
});
