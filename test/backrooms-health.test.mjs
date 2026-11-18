// What it takes to finish one of the cast (cast/health.rule.js), and what the conductor does about a jab (pursuer.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HEALTH, TIER, UNHITTABLE, healthOf, dyingOf, fresh, struck, aged, finished } from '../public/world/backrooms/cast/health.rule.js';
import { ALL_CAST } from '../public/world/backrooms/cast.js';

const read = (p) => fs.readFileSync(new URL(`../public/world/backrooms/${p}`, import.meta.url), 'utf8');

test('the tiers are the owner\'s: basic 1, medium 2, boss 3; a jab takes 1', () => {
  assert.deepEqual([HEALTH.basic, HEALTH.medium, HEALTH.boss, HEALTH.jab], [1, 2, 3, 1]);
  const by = (tier) => Object.keys(TIER).filter((id) => TIER[id] === tier).sort();
  assert.deepEqual(by('boss'), ['carried-interest', 'head-count', 'mother', 'standing-meeting', 'the-lines']);
  assert.deepEqual(by('medium'), ['intern', 'pirate', 'toner', 'trunk-line']);
  assert.deepEqual(by('basic'), ['mother-brood', 'shadow', 'toner-brood']);
  assert.deepEqual([...UNHITTABLE].sort(), ['dummies', 'moth', 'other-door', 'porter']);
  for (const id of UNHITTABLE) { assert.equal(healthOf(id), 0); assert.equal(fresh(id), null); }
  // every one of the cast is in the table or in the list of those that cannot be hit: nobody is forgotten
  for (const m of ALL_CAST) assert.ok(healthOf(m.id) > 0 || UNHITTABLE.includes(m.id), `${m.id} has a health or is said to have none`);
});

test('a hit hurts, the last one starts it dying, and dying it goes in as long as its size takes', () => {
  let h = fresh('pirate'); assert.deepEqual(h, { hp: 2, max: 2, hurt: Infinity, dying: null, gone: false, takes: 1.6 });
  h = struck(h); assert.equal(h.hp, 1); assert.equal(h.killed, false); assert.equal(h.hurt, 0); assert.equal(finished(h), false);
  h = aged(h, 0.25); assert.equal(h.hurt, 0.25); assert.equal(h.dying, null);
  h = struck(h); assert.equal(h.hp, 0); assert.equal(h.killed, true); assert.equal(h.dying, 0); assert.equal(finished(h), true);
  const again = struck(h); assert.equal(again.killed, false, 'one that is dying is not finished twice'); assert.equal(again.hp, 0);
  h = aged(h, dyingOf('pirate') / 2); assert.ok(Math.abs(h.dying - 0.5) < 1e-9); assert.equal(h.gone, false);
  h = aged(h, dyingOf('pirate')); assert.equal(h.dying, 1); assert.equal(h.gone, true);
  assert.deepEqual([dyingOf('shadow'), dyingOf('pirate'), dyingOf('mother'), dyingOf('moth')], [1.2, 1.6, 2.4, HEALTH.dying], 'the bigger, the longer it lies there');
  let boss = fresh('mother'); for (let i = 0; i < 2; i++) { boss = struck(boss); assert.equal(boss.killed, false); } assert.equal(struck(boss).killed, true, 'three for a boss');
  assert.equal(struck(fresh('shadow')).killed, true, 'one for a basic');
  assert.equal(struck(null), null); assert.equal(aged(null, 1), null);
});

// The conductor with its neighbours swapped for stubs (as coop-cast.test.mjs loads it); the health rule is the real one.
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function floor() {
  let source = read('pursuer.js');
  const rule = new URL('../public/world/backrooms/cast/health.rule.js', import.meta.url).href;
  const swaps = {
    './gen.js': 'export const makeRng=()=>()=>.5; export const roomDistances=()=>new Map();',
    './cast.js': `export * from ${JSON.stringify(rule)};export const CAST=[{id:'pirate',music:'mascot'},{id:'mother'},{id:'moth'}];export const castFor=()=>CAST;export const homeFor=()=>null;`,
    './cast/index.js': `const make=c=>{const it={x:1,z:0,ticks:0,hits:[],died:[],disposed:false,keeps:c.member.id==='pirate',ready(){c.add({removeFromParent(){it.removed=true;}});c.body(it.body={x:1,z:0,r:.3});},at:()=>({x:it.x,z:it.z}),
      update(dt){it.ticks++;it.hits.push(c.hurt(1));it.vital=c.vital;},dies(p){it.died.push(p);},fell(){return it.keeps;},dispose(){it.disposed=true;},
      snipTargets:()=>[{id:c.member.id,x:it.x,z:it.z,r:.3,snip:()=>{const hit=c.struck(1);if(!hit.ok)return false;if(!hit.killed)c.stall(0.6);return{ok:true,target:c.member.id};}}],
      shoveTargets:()=>[{id:c.member.id,x:it.x,z:it.z,r:.3,shove:()=>true}]};return it;};
      export const MAKERS={pirate:make,mother:make,moth:make};`,
    './cast/walk.js': 'export const createWalk=()=>({});',
    './doorleaf.js': 'export const hangDoors=()=>({update(){}});',
  };
  for (const [name, stub] of Object.entries(swaps)) source = source.replace(`'${name}'`, JSON.stringify(url(stub)));
  source = source.replace("'../../../core/difficulty.mjs'", JSON.stringify(new URL('../core/difficulty.mjs', import.meta.url).href));
  const { createStalkers } = await import(url(source));
  const stopped = [], bodies = [];
  const env = { level: { seed: 'test', depth: 0 }, world: { bodies, scene: { add() {} } }, player: { me: { id: 'a', x: 0, z: 0, yaw: -Math.PI / 2 } }, sees: () => false, clock: 0,
    health: { damage: () => ({ ok: true, dead: false }) }, sound: { stopMascot: () => stopped.push(1) } };
  createStalkers(env); for (const f of env.ready || []) f();
  return { env, p: env.pursuer, stopped, bodies };
}
const jab = (p, id) => p.snipTargets().find((t) => t.id === id)?.snip() ?? false;

test('the mascot: the first jab hurts it and it stands a moment; the second finishes it, and it falls where it stood', async () => {
  const { p, stopped, bodies } = await floor(), it = p.of('pirate'), dt = 0.05;
  p.update(dt); { const v = p.vital('pirate'); assert.deepEqual([v.hp, v.max, v.hurt, v.dying, v.gone], [2, 2, Infinity, null, false], 'never hit: whole'); }
  assert.deepEqual(jab(p, 'pirate'), { ok: true, target: 'pirate' });
  assert.equal(p.vital('pirate').hp, 1); assert.equal(p.vital('pirate').hurt, 0); assert.equal(stopped.length, 0);
  const n = it.hits.length; for (let t = 0; t < 0.6 - 1e-9; t += dt) p.update(dt);
  assert.equal(it.hits.length, n + 1, 'a hit that does not finish it still buys a moment'); assert.equal(it.hits.at(-1).stalled, true);
  p.update(dt); p.update(dt); assert.equal(it.hits.at(-1).landed, true, 'and then it is itself again');
  assert.ok(p.vital('pirate').hurt > 0.6, 'the mark of the hit ages, for the picture to read');
  // the second
  const ticks = it.ticks; assert.deepEqual(jab(p, 'pirate'), { ok: true, target: 'pirate' });
  assert.equal(p.vital('pirate').dying, 0); assert.equal(stopped.length, 1, 'its music goes with it');
  assert.equal(p.snipTargets().some((t) => t.id === 'pirate'), false, 'dying, it is not jabbed again'); assert.equal(p.shoveTargets().some((t) => t.id === 'pirate'), false, 'nor pushed');
  let t = 0; while (t < dyingOf('pirate') + 2 * dt) { p.update(dt); t += dt; }
  assert.equal(it.ticks, ticks, 'dying, it is not ticked: it lands nothing'); assert.ok(it.died.length > 10 && it.died.at(-1) === 1, 'its dying is handed to it, 0 to 1, for whoever draws it');
  assert.equal(p.vital('pirate').gone, true);
  assert.equal(it.removed, undefined, 'the mascot says its body stays (fell): what it holds is still there to be taken'); assert.equal(it.disposed, false);
  assert.equal(bodies.includes(it.body), false, 'but nobody walks into it');
  p.update(dt); assert.equal(it.ticks, ticks, 'and it is gone for this floor');
});

test('a boss takes three; gone, it is taken off the floor; what cannot be hit has no health', async () => {
  const { p, bodies } = await floor(), it = p.of('mother'), dt = 0.05;
  p.update(dt);
  for (let i = 0; i < 2; i++) { assert.ok(jab(p, 'mother')); assert.equal(p.vital('mother').dying, null); for (let t = 0; t < 0.7; t += dt) p.update(dt); }
  assert.ok(jab(p, 'mother')); assert.equal(p.vital('mother').dying, 0);
  for (let t = 0; t < dyingOf('mother') + 0.1; t += dt) p.update(dt);
  assert.equal(it.removed, true); assert.equal(it.disposed, true); assert.equal(bodies.includes(it.body), false);
  assert.equal(p.vital('moth'), null); assert.equal(jab(p, 'moth'), false, 'a jab at a moth is a jab at the air');
  assert.equal(p.of('moth').hits.at(-1).landed, true, 'and it is as it was');
});

test('every one of the cast that can be hit offers a target and takes health; nothing else does', () => {
  const body = (path) => { const src = read(path), at = src.indexOf('    snipTargets()'); assert.ok(at > 0, `${path} offers a target`); return src.slice(at, src.indexOf('\n    },\n', at)); };
  for (const id of ['pirate', 'shadow', 'head-count', 'intern', 'standing-meeting', 'carried-interest', 'mother', 'the-lines']) assert.match(body(`cast/${id}.js`), /c\.struck\??\.?\((HEALTH\.jab|1)\)/, `${id} takes a jab`);
  // those with no stand-down of their own flinch instead: they stand, and land nothing
  for (const id of ['head-count', 'intern', 'standing-meeting', 'carried-interest', 'mother', 'the-lines']) assert.match(body(`cast/${id}.js`), /if \(!hit\.killed\) c\.stall\(HEALTH\.flinch\)/, `${id} flinches`);
  // the mascot keeps its break-off on the hit that does not finish it, and falls with what it holds
  const pirate = read('cast/pirate.js');
  assert.match(body('cast/pirate.js'), /if \(hit\?\.killed\) \{[^\n]*return \{ ok: true, target: 'pirate' \}; \}\s+if \(pirate\.state !== 'awake'\) awaken\(pirate, false\);\s+breakOff\(pirate\);/);
  assert.match(pirate, /fell\(\) \{ return !!pirate; \}/);
  // the many-bodied keep their own: a toner two and its hatchling one, finished into a spent crust; a small one of Mother's goes at one jab
  const toner = read('cast/toner.js');
  assert.match(toner, /unit\.vital = fresh\('toner'\);/); assert.match(toner, /young\.vital = fresh\('toner-brood'\);/);
  assert.match(toner, /u\.vital = struck\(u\.vital\);[\s\S]{0,200}u\.s = u\.vital\?\.killed \? \{ \.\.\.next, mode: 'spent'/);
  assert.match(toner, /if \(unit\.vital\) unit\.vital = aged\(unit\.vital, dt\);/);
  assert.match(body('cast/mother.js'), /id: 'mother-brood'[\s\S]*w\.dead = true; w\.flat = 0\.001;/);
  // the trunk line: wide and tall enough to be hit on its way down, while recoiling too, and two jabs
  const cable = read('rooms/cable-drop.js');
  assert.match(cable, /vital = fresh\('trunk-line'\)/);
  assert.match(cable, /snipTarget: \(\) => \(rule\.phase !== 'dormant' && !finished\(vital\) \? \{ id: 'trunk-line', r: 0\.55, verticalReach: 2\.4, priority: 2 \} : false\),/);
  // (dying and after: it is nobody's to hit or walk into; once gone its heap of cable stays drawn where it fell — the lead's call)
  assert.match(cable, /if \(vital\.dying !== null\) \{ roamer\.physical = false; return; \}/);
  // the lines can be reached at all: a target where there was none, tall enough for a thing overhead
  assert.match(body('cast/the-lines.js'), /r: 0\.75, verticalReach: 2\.2/);
  for (const id of ['moth', 'porter', 'other-door', 'dummies']) assert.ok(!/snipTargets/.test(read(`cast/${id}.js`)), `${id} offers nothing to jab`);
});
