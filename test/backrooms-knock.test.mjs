// Out of Office: being hit throws you (player.js KNOCK). A blow that lands and is survived knocks the visitor back from
// whatever dealt it, so that one bite is not three in a row and there is a moment to get away in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlayer, KNOCK } from '../public/world/backrooms/player.js';

const open = { free: () => true, passable: () => true, floorY: () => 0, headroom: () => 2.6 };
const cam = () => ({ position: { set() {} }, rotation: { set() {} } });
const visitor = (keys = [], world = open, start = { x: 0, z: 0, yaw: 0 }) => {
  const input = { keys: new Set(keys), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false };
  return { input, p: createPlayer(world, cam(), start, input) };
};
const run = (p, seconds, each) => { for (let t = 0; t < seconds; t += 1 / 60) { p.update(1 / 60, t); each?.(p.me, t); } };
const reach = KNOCK.speed / KNOCK.fade;

test('a blow shoves you straight back from whatever dealt it, about speed / fade metres, most of it at once, feet on the floor', () => {
  const { p } = visitor();
  assert.equal(p.knock({ x: 0, z: -1 }), true);                     // in front of you (yaw 0 looks toward −z)
  let lifted = 0;
  run(p, 0.5, (me) => { lifted = Math.max(lifted, me.drop, Math.abs(me.dropV)); });
  const early = p.me.z;
  run(p, 2, (me) => { lifted = Math.max(lifted, me.drop, Math.abs(me.dropV)); });
  assert.equal(lifted, 0, 'no hop: never off the floor');
  assert.ok(Math.abs(p.me.x) < 1e-9, 'straight back, not sideways');
  assert.ok(p.me.z > reach * 0.95 && p.me.z < reach * 1.15, `about ${reach.toFixed(2)} m (${p.me.z.toFixed(2)})`);
  assert.ok(early > p.me.z * 0.85, `most of it in the first half second (${early.toFixed(2)} of ${p.me.z.toFixed(2)})`);
  assert.equal(p.me.kx, 0); assert.equal(p.me.kz, 0);
});

test('it is a bounce even while you are walking into it: your legs have little say for a moment', () => {
  const { p } = visitor(['w']);
  run(p, 1);                                                         // walking toward −z, into whatever is there
  const z0 = p.me.z;
  p.knock({ x: 0, z: z0 - 0.6 });
  let furthest = -Infinity;
  run(p, 0.6, (me) => { furthest = Math.max(furthest, me.z - z0); });
  assert.ok(furthest > reach * 0.6, `thrown back ${furthest.toFixed(2)} m with W held (of ${reach.toFixed(2)})`);
});

test('a wall stops it as it stops a walk, and you slide along it', () => {
  const wall = { ...open, free: (x, z) => z < 0.4 };
  const { p } = visitor([], wall);
  p.knock({ x: -1, z: -1 });                                         // thrown toward +x and +z: the wall is at +z
  run(p, 2);
  assert.ok(p.me.z < 0.4, `not through the wall (${p.me.z.toFixed(2)})`);
  assert.ok(p.me.x > reach * 0.6, `along it (${p.me.x.toFixed(2)})`);
});

test('nobody said where from, or said nothing usable, or it is on top of you: straight back from where you are looking', () => {
  for (const from of [undefined, null, { x: null, z: null }, { x: NaN, z: 0 }, { x: 0, z: 0 }]) {
    const { p } = visitor([], open, { x: 0, z: 0, yaw: Math.PI / 2 });     // looking toward −x
    p.knock(from);
    run(p, 2);
    assert.ok(p.me.x > reach * 0.95 && Math.abs(p.me.z) < 1e-6, `${JSON.stringify(from)}: back toward +x (${p.me.x.toFixed(2)}, ${p.me.z.toFixed(2)})`);
  }
});

test('not while something has hold of you, and a warp leaves it behind', () => {
  const held = visitor();
  held.p.me.frozen = true;
  assert.equal(held.p.knock({ x: 0, z: -1 }), false);
  run(held.p, 1);
  assert.equal(held.p.me.z, 0);

  const warped = visitor();
  warped.p.knock({ x: 0, z: -1 });
  warped.p.update(1 / 60);
  warped.p.warp(10, 10);
  run(warped.p, 1);
  assert.ok(Math.hypot(warped.p.me.x - 10, warped.p.me.z - 10) < 1e-6, 'it stops where the warp put you');

  const caught = visitor();
  caught.p.knock({ x: 0, z: -1 });
  caught.p.update(1 / 60);
  caught.p.me.frozen = true;                                         // got hold of mid-throw
  const z = caught.p.me.z;
  run(caught.p, 1);
  assert.equal(caught.p.me.z, z, 'and being got hold of mid-throw stops it');
});

/* ---- who throws: the conductor's c.hurt ------------------------------------------------------- */

const dir = new URL('../public/world/backrooms/', import.meta.url);
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function load(file, swaps) {
  let source = readFileSync(new URL(file, dir), 'utf8');
  for (const [from, to] of Object.entries(swaps)) { assert.ok(source.includes(`'${from}'`), `${file} no longer imports ${from}`); source = source.replace(`'${from}'`, JSON.stringify(to)); }
  source = source.replace(/from '(\.[^']+)'/g, (_, name) => `from '${new URL(name, new URL(file, dir)).href}'`);
  return import(moduleUrl(source));
}
globalThis.__knockMakers = {
  biter: (c) => { globalThis.__knockBiter = c; return { at: () => ({ x: 1, z: 2 }), update() {} }; },
  liar: (c) => { globalThis.__knockLiar = c; return { at() { throw Error('nowhere'); }, update() {} }; },
};
const { createStalkers } = await load('pursuer.js', {
  './gen.js': moduleUrl('export const makeRng = () => () => 0.5; export const roomDistances = () => new Map();'),
  './cast.js': moduleUrl('export const CAST = ["biter", "liar"].map((id) => ({ id, disposition: "hunts" })); export const castFor = () => CAST.map((m) => ({ id: m.id })); export const homeFor = () => null;'),
  './cast/index.js': moduleUrl('export const MAKERS = globalThis.__knockMakers;'),
  './cast/walk.js': moduleUrl('export const createWalk = () => ({ go() {} });'),
  './doorleaf.js': moduleUrl('export const hangDoors = () => ({ update() {} });'),
});

function floor(result) {
  const knocks = [], room = { uses: [], group: { visible: true, remove() {} } };
  const env = {
    level: { seed: 'knock', depth: 0 }, visit: {},
    player: { me: { x: 5, z: 5 }, knock: (from) => { knocks.push(from); return true; } },
    health: { damage: () => result },
    world: { bodies: [], scene: { add() {} }, roomAt: () => room, floorY: () => 0, lightAt: () => [1, 1, 1] }, sees: () => false, play() {},
  };
  createStalkers(env);
  for (const fn of env.ready) fn();
  return { knocks, biter: globalThis.__knockBiter, liar: globalThis.__knockLiar };
}

test('a hit that lands and is survived throws the visitor from where the creature says it is, or from where the blow came', () => {
  const survived = { ok: true, dead: false };
  let f = floor(survived);
  assert.deepEqual(f.biter.hurt(1), { landed: true, dead: false, ended: false });
  assert.deepEqual(f.knocks, [{ x: 1, z: 2 }], 'from its at()');
  f.biter.hurt(1, { x: 7, z: 7 });
  assert.deepEqual(f.knocks[1], { x: 7, z: 7 }, 'from what it said');
  f = floor(survived);
  assert.doesNotThrow(() => f.liar.hurt(1));
  assert.deepEqual(f.knocks, [null], 'an at() that fails still throws them: straight back');
});

test('no throw for a hit that did not count, or that was the last of them', () => {
  let f = floor({ ok: false, reason: 'invulnerable' });
  assert.equal(f.biter.hurt(1).landed, false);
  f = floor({ ok: true, dead: true });
  assert.equal(f.biter.hurt(1).dead, true);
  assert.deepEqual(f.knocks, []);
});

test('the residents of rooms say where the blow came from, in world coordinates', () => {
  const src = (f) => readFileSync(new URL(f, dir), 'utf8');
  for (const [file, call] of [
    ['rooms/cable-drop.js', 'c.hurt(CABLE.hurts, roamer)'], ['rooms/shredding-bay.js', 'c.hurt(SHREDDER.hurts, roamer)'],
    ['rooms/safety-corridor.js', 'c.hurt(WARDEN.hurts, roamer)'], ['rooms/drop-plenum.js', 'c.hurt(PLENUM.hurt, denizen)'],
    ['rooms/mandatory-fun.js', 'c.hurt(PARTY.hurts, nearest && c.toWorld(nearest.x, nearest.z))'], ['rooms/lemonade.js', 'c.hurt(1, c.toWorld(me0.x, me0.z))'],
    ['rooms/cubicle-grid.js', 'c.env.player?.knock?.(denizen)'], ['cast/toner.js', 'c.hurt(TONER.hitDamage, walker)'],
    ['cast/mother.js', 'c.hurt(WORM.hurts, { x: a.fx, z: a.fz })'], ['world.js', 'env.player?.knock?.(from)'],
  ]) assert.ok(src(file).includes(call), `${file}: ${call}`);
});
