// The lawn flamingo (the owner's play-test): one stab of its stakes, about two jabs' worth, and it stays in what it went into.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAB, strikeStab } from '../public/world/backrooms/melee.js';
import { createInventory, makeItem, ITEM_DEFS } from '../public/world/backrooms/inventory-state.js';
import { planSupplies, SUPPLY } from '../public/world/backrooms/supplies.js';
import { INVENTORY_MODELS } from '../public/world/backrooms/inventory-items.js';

const me = { x: 0, z: 0, yaw: 0 };                     // facing -z
const creature = (hp, extra = {}) => {
  const it = { hp, snips: 0 };
  it.target = { id: 'it', member: 'it', x: 0, z: -1, r: 0.3, ...extra, snip: () => { if (it.hp <= 0) return false; it.snips++; it.hp--; return { ok: true, target: 'it', killed: it.hp <= 0 }; } };
  return it;
};

test('a stab is two jabs through the creature\'s own snip: a medium one is finished, a boss is not, a basic one takes only the one', () => {
  assert.equal(STAB.hits, 2);
  const medium = creature(2), boss = creature(3), basic = creature(1);
  let r = strikeStab(me, [medium.target]); assert.ok(r.ok && r.killed); assert.equal(medium.snips, 2);
  r = strikeStab(me, [boss.target]); assert.ok(r.ok && !r.killed); assert.equal(boss.hp, 1); assert.equal(r.candidate, boss.target, 'it says what it went into');
  r = strikeStab(me, [basic.target]); assert.ok(r.ok && r.killed); assert.equal(basic.snips, 1, 'nothing stabs a dead thing twice');
  assert.equal(strikeStab(me, [creature(2, { z: 3 }).target]).ok, false, 'not behind');
  assert.equal(strikeStab(me, []).ok, false);
});

test('in the pockets: a stab that lands spends it; a miss keeps it in the hand', () => {
  assert.ok(ITEM_DEFS.flamingo && INVENTORY_MODELS.flamingo);
  const bag = createInventory(); bag.add(makeItem('flamingo', 'f'));
  assert.equal(bag.useSelected({ stab: () => ({ ok: false, reason: 'no-snip-target' }) }).ok, false);
  assert.equal(bag.read().slots[0]?.type, 'flamingo', 'missed: still in the hand');
  const r = bag.useSelected({ stab: () => ({ ok: true, target: 'intern', killed: false }) });
  assert.ok(r.ok && r.action === 'stab' && r.target === 'intern'); assert.equal(bag.read().slots[0], null, 'it stays in what it went into');
});

test('it is found on the neighbourhood\'s lawns, about a third of its parts, and nowhere else', () => {
  const part = (seed, theme) => ({ seed, depth: 1, theme, start: { room: 0 }, exit: { room: 25 }, rooms: Array.from({ length: 26 }, (_, id) => ({ id, kind: id === 0 ? 'start' : id === 25 ? 'exit' : 'plain' })) });
  let n = 0;
  for (let i = 0; i < 1000; i++) n += planSupplies(part('f' + i, 'suburb')).filter((s) => s.type === 'flamingo').length;
  assert.ok(Math.abs(n / 1000 - SUPPLY.flamingo) < 0.05, `${n / 1000} a neighbourhood part`);
  for (let i = 0; i < 200; i++) assert.equal(planSupplies(part('f' + i, 'yellow')).some((s) => s.type === 'flamingo'), false);
  // (and nothing else on a neighbourhood part moved for it)
  const a = planSupplies(part('same', 'suburb')).filter((s) => s.type !== 'flamingo'), b = planSupplies(part('same', 'yellow'));
  assert.deepEqual(a, b);
});

// the conductor with its neighbours stubbed (as backrooms-health.test.mjs loads it)
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function floor() {
  let source = readFileSync(new URL('../public/world/backrooms/pursuer.js', import.meta.url), 'utf8');
  const rule = new URL('../public/world/backrooms/cast/health.rule.js', import.meta.url).href;
  const swaps = {
    './gen.js': 'export const makeRng=()=>()=>.5; export const roomDistances=()=>new Map();',
    './cast.js': `export * from ${JSON.stringify(rule)};export const CAST=[{id:'intern'},{id:'mother'}];export const castFor=()=>CAST;export const homeFor=()=>null;`,
    './cast/index.js': `const make=c=>{const it={x:0,z:-1,ready(){},at:()=>({x:it.x,z:it.z}),update(){},snipTargets:()=>[{id:c.member.id,x:it.x,z:it.z,y:1.3,r:.3,snip:()=>{const h=c.struck(1);return h.ok?{ok:true,target:c.member.id,killed:h.killed}:false;}}]};return it;};
      export const MAKERS={intern:make,mother:make};`,
    './cast/walk.js': 'export const createWalk=()=>({});',
    './doorleaf.js': 'export const hangDoors=()=>({update(){}});',
  };
  for (const [name, stub] of Object.entries(swaps)) source = source.replace(`'${name}'`, JSON.stringify(url(stub)));
  source = source.replace("'../../../core/difficulty.mjs'", JSON.stringify(new URL('../core/difficulty.mjs', import.meta.url).href));
  const { createStalkers } = await import(url(source));
  const added = [];
  const env = { run: { survived() {}, met() {} }, level: { seed: 'test', depth: 0 }, world: { bodies: [], floorY: () => 0, scene: { add(o) { added.push(o); } } },
    player: { me: { x: 0, z: 0, yaw: 0 } }, sees: () => false, clock: 0, health: { damage: () => ({ ok: true, dead: false }) }, sound: {} };
  createStalkers(env); for (const f of env.ready || []) f();
  return { env, p: env.pursuer, added };
}
const prop = () => { const o = { removed: false, position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, rotation: { x: 0, set(x) { this.x = x; } } }; o.removeFromParent = () => { o.removed = true; }; return o; };

test('the conductor: the flamingo goes about with what it went into, and falls out when that dies', async () => {
  const { p, added } = await floor(), dt = 0.05;
  p.update(dt);
  const boss = p.snipTargets().find((t) => t.member === 'mother');
  const hit = strikeStab(me, [boss]); assert.ok(hit.ok && !hit.killed, 'a boss lives through it');
  const f = prop(); assert.equal(p.impale(hit.candidate, f, me, { hidden: STAB.handover }), true); assert.ok(added.includes(f));
  assert.equal(f.visible, false, 'hidden while the hand still has its own');
  for (let t = 0; t < STAB.handover + dt; t += dt) p.update(dt);
  assert.equal(f.visible, true, 'and shown once the hand lets go');
  const it = p.of('mother'); it.x = 2; it.z = -3; p.update(dt);
  assert.ok(Math.hypot(f.position.x - 2, f.position.z - -3) < 0.5, 'carried on it as it goes'); assert.ok(f.position.y > 1, 'about where it went in');
  // finished: it falls, lies a while, and is gone
  p.snipTargets().find((t) => t.member === 'mother').snip();
  for (let t = 0; t < 1; t += dt) p.update(dt);
  assert.ok(f.position.y < 0.2, 'fallen to the floor'); assert.equal(f.removed, false, 'and lying there');
  for (let t = 0; t < 13; t += dt) p.update(dt);
  assert.equal(f.removed, true, 'then gone');
  // into nobody of the cast: it falls where it went
  const g = prop(); p.dropped(g, { x: 1, z: 1, y: 1 });
  for (let t = 0; t < 1; t += dt) p.update(dt);
  assert.ok(g.position.y < 0.2);
  assert.equal(p.impale({ member: 'nobody', x: 0, z: 0 }, prop(), me), false);
});
