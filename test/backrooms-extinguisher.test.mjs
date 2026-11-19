// The fire extinguisher (extinguisher.rule.js, extinguisher.js): what it does, to whom, for how long, and what it costs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXTINGUISHER, foundCharge, idle, trigger, inSpray, doseOf, tally, stoppedUntil, doused, puffAt, whiteOut, blinds, RESPONSES, responseOf } from '../public/world/backrooms/extinguisher.rule.js';
import { HOLD, holdPose, leverAt } from '../public/world/backrooms/hand-extinguisher.rule.js';
import { createInventory, makeItem, ITEM_DEFS } from '../public/world/backrooms/inventory-state.js';
import { NOTES, noteStep, wetted, fallen } from '../public/world/backrooms/cast/sticky-notes.rule.js';
import { CAST } from '../public/world/backrooms/cast.js';
import { TIER } from '../public/world/backrooms/cast/health.rule.js';

const E = EXTINGUISHER;
const run = (s, seconds, input, dt = 1 / 60) => { let used = 0, n = Math.round(seconds / dt); for (let i = 0; i < n; i++) { s = trigger(s, dt, input(i)); used += s.sprayed; } return { s, used }; };

test('the trigger: a press is a burst at least; held, it goes on; let go, it stops; dry, it stops for good', () => {
  // a tap: one press, then nothing held: it sprays the burst and stops
  let r = run(idle(), 1, (i) => ({ pressed: i === 0, held: false, charge: 8 }));
  assert.ok(Math.abs(r.used - E.burst) < 0.03, `a tap is a burst (${r.used.toFixed(3)} s)`); assert.equal(r.s.on, false);
  // held: as long as it is held
  r = run(idle(), 2, (i) => ({ pressed: i === 0, held: true, charge: 8 }));
  assert.ok(Math.abs(r.used - 2) < 0.03 && r.s.on, 'held two seconds: two seconds of it');
  // nothing in it: nothing happens
  r = run(idle(), 0.5, () => ({ pressed: true, held: true, charge: 0 }));
  assert.equal(r.used, 0); assert.equal(r.s.on, false);
  // runs out under the hand: it says so, once, and stops
  let s = trigger(idle(), 1 / 60, { pressed: true, held: true, charge: 0.05 }), empties = 0, charge = 0.05;
  for (let i = 0; i < 30; i++) { charge -= s.sprayed; if (s.empty) empties++; s = trigger(s, 1 / 60, { held: true, charge }); }
  assert.equal(empties, 1); assert.equal(s.on, false); assert.ok(charge >= -1e-9);
  // found: never empty, never more than a full one
  for (const u of [0, 0.5, 1]) assert.ok(foundCharge(u) > 0 && foundCharge(u) <= E.charge);
});

test('the spray reaches what is in front, near and at about head height; a wide one is easier to catch', () => {
  const me = { x: 0, z: 0, y: 1.5, yaw: 0 };                 // facing -z
  assert.ok(inSpray(me, { x: 0, z: -2, r: 0.3 }) >= 0);
  assert.equal(inSpray(me, { x: 0, z: 2, r: 0.3 }), -1, 'not behind');
  assert.equal(inSpray(me, { x: 0, z: -(E.reach + 0.5), r: 0.3 }), -1, 'not far');
  assert.equal(inSpray(me, { x: 2, z: -2, r: 0.3 }), -1, 'not well off to the side');
  assert.equal(inSpray(me, { x: 0, z: -2, y: 1.5 + E.verticalReach + 0.2, r: 0.3 }), -1, 'not up in the ceiling');
  assert.ok(inSpray(me, { x: 0.75, z: -2, r: 0.6 }) >= 0 && inSpray(me, { x: 0.75, z: -2, r: 0.1 }) === -1, 'its own width counts');
});

test('a face full: about four seconds and two backing off the first time, less each time after, half for the big ones', () => {
  const first = doseOf(0), second = doseOf(1), later = doseOf(5);
  assert.ok(first.stop + first.back >= 4 && first.stop + first.back <= 6.5, 'the owner: "pause and or run away for ~4-6 seconds"');
  assert.ok(second.stop < first.stop && later.stop < second.stop && later.stop > 0, 'it works less each time, never not at all');
  assert.deepEqual(doseOf(0, { tier: 'boss' }), { stop: first.stop * E.heavy, back: 0 });
  assert.deepEqual(doseOf(0, { heavy: true }), { stop: first.stop * E.heavy, back: 0 });
  // the tally: a lick of it is not a face full; stopped, more is wasted on it; after a while it is fresh again
  let m, now = 0, dosed = 0;
  for (let i = 0; i < 6; i++) { const r = tally(m, 0.02, now += 0.02, true); m = r.m; if (r.dosed) dosed++; }
  assert.equal(dosed, 0, `${E.takes} s before it counts`);
  for (let i = 0; i < 10; i++) { const r = tally(m, 0.02, now += 0.02, true); m = r.m; if (r.dosed) { dosed++; m = stoppedUntil(m, now, doseOf(m.times - 1)); } }
  assert.equal(dosed, 1); assert.equal(m.times, 1);
  for (let i = 0; i < 50; i++) { const r = tally(m, 0.1, now += 0.1, true); m = r.m; if (r.dosed) dosed++; }
  assert.equal(dosed, 1, 'stopped, it is not dosed again until it is moving');
  now += 2; for (let i = 0; i < 10; i++) { const r = tally(m, 0.02, now += 0.02, true); m = r.m; if (r.dosed) { dosed++; m = stoppedUntil(m, now, doseOf(m.times - 1)); } }
  assert.equal(m.times, 2, 'the second time is counted as the second');
  m = tally(m, 0.1, now + E.forgets + 10, false).m; assert.equal(m.times, 0, 'left alone long enough, it is fresh');
  assert.equal(doused(E.douses - 0.01), false); assert.equal(doused(E.douses), true);
});

test('every one of the cast has a line for it, and the ones that do not care are the ones a jab does nothing to', () => {
  for (const m of CAST) assert.ok(RESPONSES[m.id], `${m.id} has a line`);
  for (const [id, line] of Object.entries(RESPONSES)) assert.match(line, /^(stops|backs|own|nothing): /, id);
  for (const id of ['moth', 'porter', 'other-door', 'dummies']) assert.equal(responseOf(id), 'nothing');
  for (const id of Object.keys(TIER).filter((id) => TIER[id] === 'boss')) assert.notEqual(responseOf(id), 'backs', `${id} is a part of the building: it does not back off`);
  assert.equal(responseOf('somebody new'), 'backs', 'anybody without a line is put back');
});

test('the cloud: it leaves fast and slows, grows, thins and is gone; standing in it, the picture goes white, never wholly', () => {
  let last = -1;
  for (let t = 0; t < E.cloud.life; t += 0.1) { const p = puffAt(t); assert.ok(p.dist >= last && p.size > 0 && p.alpha >= 0 && p.alpha <= 1); last = p.dist; }
  assert.equal(puffAt(E.cloud.life + 0.01), null);
  assert.ok(puffAt(E.cloud.life * 0.9).alpha < puffAt(0.3).alpha, 'it thins');
  assert.ok(last > 1.5 && last < E.reach + 1, `it carries about as far as it reaches (${last.toFixed(2)} m)`);
  assert.equal(whiteOut(0), 0); assert.ok(whiteOut(100) <= E.cloud.thick + 1e-9 && whiteOut(100) > E.cloud.thick * 0.95);
  assert.equal(blinds(whiteOut(0.05)), false); assert.equal(blinds(whiteOut(5)), true);
});

test('in the pockets: it sprays from its charge, says how much is left, and goes once it is empty', () => {
  assert.equal(ITEM_DEFS.extinguisher.maxCharge, E.charge);
  assert.throws(() => makeItem('extinguisher', 'x', { charge: E.charge + 1 }));
  const bag = createInventory(); bag.add(makeItem('extinguisher', 'x', { charge: 1 }));
  let r = bag.spray(0.4); assert.ok(r.ok && Math.abs(r.charge - 0.6) < 1e-9 && !r.empty);
  r = bag.spray(5); assert.ok(r.ok && r.empty && r.charge === 0); assert.equal(bag.read().slots[0], null, 'an empty one is only a red tin: it goes');
  assert.equal(bag.spray(0.1).reason, 'wrong-item');
  bag.add(makeItem('chalk', 'c')); assert.equal(bag.spray(0.1).reason, 'wrong-item');
  assert.equal(bag.useSelected().ok, true, 'and nothing else is changed by it');
});

test('in the hand: it comes up to aim and the lever goes down; let go, it settles; the needle reads the charge', () => {
  const rest = holdPose({}), aimed = holdPose({ on: true, since: 1, share: 1 }), settled = holdPose({ off: 5, share: 0.5 });
  assert.equal(rest.squeeze, 0); assert.ok(aimed.squeeze > 0.99, 'squeezed');
  assert.ok(aimed.y > rest.y && aimed.x < rest.x, 'up and in toward the middle');
  assert.ok(Math.abs(settled.y) < 1e-9 && settled.squeeze === 0, 'settled back');
  assert.ok(holdPose({ share: 0 }).needle < holdPose({ share: 1 }).needle, 'empty to the left, full to the right');
  assert.equal(leverAt(0), HOLD.lever[0]); assert.equal(leverAt(1), HOLD.lever[1]);
  const pumped = [0.1, 0.2, 0.3, 0.4, 0.5].map((dry) => holdPose({ dry, off: dry }).squeeze);
  assert.ok(Math.max(...pumped) > 0.8 && Math.min(...pumped) < 0.5, 'run dry, it is pumped on nothing');
  assert.ok(holdPose({ dry: 5, off: 5 }).y < rest.y, 'and sags');
});

test('the sticky notes: what the spray catches comes down wet, and lies a long while', () => {
  let n = { ...fallen({ mode: 'flutter', t: 0 }) }; let w = wetted({ mode: 'flutter', t: 0 });
  assert.equal(w.mode, 'down'); assert.equal(w.wet, true);
  for (let t = 0; t < NOTES.knocked + 0.5; t += 0.1) { n = noteStep(n, 0.1, {}); w = noteStep(w, 0.1, {}); }
  assert.equal(n.mode, 'flutter', 'knocked, it lifts'); assert.equal(w.mode, 'down', 'wet, it does not');
  for (let t = 0; t < NOTES.wet - NOTES.knocked; t += 0.1) w = noteStep(w, 0.1, {});
  assert.equal(w.mode, 'flutter'); assert.equal(w.wet, false, 'and once it has, it is dry');
});

// the conductor with its neighbours stubbed (as backrooms-health.test.mjs loads it): sprayTargets and the default stand-still
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const read = (path) => readFileSync(new URL(`../public/world/backrooms/${path}`, import.meta.url), 'utf8');
async function floor() {
  let source = read('pursuer.js');
  const rule = new URL('../public/world/backrooms/cast/health.rule.js', import.meta.url).href;
  const swaps = {
    './gen.js': 'export const makeRng=()=>()=>.5; export const roomDistances=()=>new Map();',
    './cast.js': `export * from ${JSON.stringify(rule)};export const CAST=[{id:'pirate'},{id:'mother'},{id:'moth'},{id:'middle-manager'}];export const castFor=()=>CAST;export const homeFor=()=>null;`,
    './cast/index.js': `const make=c=>{const it={x:0,z:-2,ticks:0,hits:[],got:[],ready(){},at:()=>({x:it.x,z:it.z}),update(){it.ticks++;it.hits.push(c.hurt(1));}};
      if(c.member.id==='middle-manager')it.doused=(d)=>{it.got.push(d);return true;};return it;};
      export const MAKERS={pirate:make,mother:make,moth:make,'middle-manager':make};`,
    './cast/walk.js': 'export const createWalk=()=>({});',
    './doorleaf.js': 'export const hangDoors=()=>({update(){}});',
  };
  for (const [name, stub] of Object.entries(swaps)) source = source.replace(`'${name}'`, JSON.stringify(url(stub)));
  source = source.replace("'../../../core/difficulty.mjs'", JSON.stringify(new URL('../core/difficulty.mjs', import.meta.url).href));
  const { createStalkers } = await import(url(source));
  const env = { run: { survived() {}, met() {} }, level: { seed: 'test', depth: 0 }, world: { bodies: [], scene: { add() {} } }, player: { me: { x: 0, z: 0, yaw: 0 } }, sees: () => false, clock: 0,
    health: { damage: () => ({ ok: true, dead: false }) }, sound: {} };
  createStalkers(env); for (const f of env.ready || []) f();
  return { env, p: env.pursuer };
}

test('the conductor: everybody can be reached where they say they are; with nothing of its own to do, one stands for the dose', async () => {
  const { p } = await floor(), dt = 0.05;
  p.update(dt);
  const targets = p.sprayTargets();
  assert.deepEqual(targets.map((t) => t.member).sort(), ['middle-manager', 'mother', 'moth', 'pirate'].sort());
  const pirate = targets.find((t) => t.member === 'pirate'), it = p.of('pirate'), before = it.ticks;
  assert.equal(pirate.douse({ stop: 1, back: 0.5 }), true);
  for (let t = 0; t < 1.4; t += dt) p.update(dt);
  assert.equal(it.ticks, before + 1, 'stood for the stop and the backing off together (after the one tick of no time that draws it where it is): nothing more');
  assert.equal(it.hits.at(-1).stalled, true, 'and nothing of it landed');
  for (let t = 0; t < 0.3; t += dt) p.update(dt);
  assert.ok(it.ticks > before, 'and then it is itself again');
  const mm = targets.find((t) => t.member === 'middle-manager');
  assert.equal(mm.douse({ stop: 2, back: 1 }), true); assert.deepEqual(p.of('middle-manager').got.at(-1), { stop: 2, back: 1 }, 'one with its own doused() is handed the dose');
});

test('the controller: a press sprays, spends the charge, doses what is in front once, leaves alone what does not care, and puts a fire out', async () => {
  const swaps = {
    './extinguisher.rule.js': new URL('../public/world/backrooms/extinguisher.rule.js', import.meta.url).href,
    './cast/health.rule.js': new URL('../public/world/backrooms/cast/health.rule.js', import.meta.url).href,
    './spray.js': url('export const createSpray=()=>({emit(){globalThis.__emitted=(globalThis.__emitted||0)+1;},update(){},whiteOut:()=>0,dispose(){}});'),
    three: new URL('../public/vendor/three.module.min.js', import.meta.url).href,
  };
  let source = read('extinguisher.js');
  for (const [name, to] of Object.entries(swaps)) source = source.replace(`'${name}'`, JSON.stringify(to));
  const { createExtinguisher } = await import(url(source));
  let item = { type: 'extinguisher', charge: 3 }, doses = [], hand = [], put = [];
  const target = (member, x, z) => ({ id: member, member, x, z, r: 0.4, douse: (d) => { doses.push([member, d]); return true; } });
  const env = {
    player: { me: { x: 0, z: 0, yaw: 0 } }, world: { los: () => true },
    inventory: { held: () => item, spray: (sec) => { item.charge = Math.max(0, +(item.charge - sec).toFixed(6)); return { ok: true, charge: item.charge, empty: item.charge === 0 }; },
      fire: { burning: () => (put.length ? [] : [{ id: 7, wx: 0, wz: -1.5 }]), douse: (id) => put.push(id) } },
    handView: { spraying: (on) => hand.push(on), dried: () => hand.push('dry'), nozzle: () => null },
    pursuer: { sprayTargets: () => [target('pirate', 0, -2), target('moth', 0, -1), target('intern', 0, 2)] },
    play() {},
  };
  const camera = { position: { x: 0, y: 1.5, z: 0 }, getWorldPosition: (v) => v.set(0, 1.5, 0), getWorldDirection: (v) => v.set(0, 0, -1) };
  const x = createExtinguisher(env, camera);
  assert.equal(env.extinguisher, x);
  x.press(); for (let i = 0; i < 60; i++) x.update(1 / 60, true);
  assert.equal(hand[0], true, 'the lever goes down'); assert.ok(x.spraying());
  assert.ok(Math.abs(item.charge - 2) < 0.05, `a second held is a second of charge (${item.charge.toFixed(3)} left)`);
  assert.deepEqual(doses.map(([m]) => m), ['pirate'], 'the one in front, once; not the moth (it does not care), not the one behind');
  assert.deepEqual(doses[0][1], doseOf(0, { tier: 'medium' }));
  assert.deepEqual(put, [7], 'and the fire in front is out');
  for (let i = 0; i < 10; i++) x.update(1 / 60, false);
  assert.equal(x.spraying(), false); assert.equal(hand.at(-1), false, 'let go');
  // held to the end: it runs dry
  x.press(); for (let i = 0; i < 200; i++) x.update(1 / 60, true);
  assert.equal(item.charge, 0); assert.ok(hand.includes('dry')); assert.equal(x.spraying(), false);
  assert.ok(globalThis.__emitted > 100, 'and the white comes out of it all the while');
  x.dispose();
});

test('the drawing: no dice in the spray, and nothing in the hand over a note on the lens', () => {
  const spray = read('spray.js'), hand = read('hand-extinguisher.js');
  assert.equal(/Math\.random\(/.test(spray), false, 'the same squeeze looks the same on any page');
  for (const m of hand.matchAll(/renderOrder = (\d+)/g)) assert.ok(Number(m[1]) <= 10000, 'stuck notes (10001) stay on top');
});
