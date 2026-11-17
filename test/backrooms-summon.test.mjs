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
