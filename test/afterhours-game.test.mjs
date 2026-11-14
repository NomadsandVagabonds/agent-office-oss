import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, respawn, objective, interactable, isFree, lineClear, LEVEL, PLAYER } from '../core/afterhours-game.mjs';

const advance = (s, seconds, input = {}) => {
  for (let t = 0; t < seconds - 1e-8; t += 1 / 60) s = step(s, input, Math.min(1 / 60, seconds - t));
  return s;
};
const empty = (extra = {}) => ({ ...createGame(), enemies: [], ...extra });
const crab = (extra = {}) => ({ ...createGame().enemies[0], x: 0, z: 10.8, ...extra });
const melee = (enemy, player = {}) => advance({ ...createGame(), enemies: [enemy], ...player }, .2, { attack: true });

test('after hours: movement is immutable, yaw-relative, normalized and bounded', () => {
  const before = empty(), copy = structuredClone(before);
  const s = advance(before, .5, { forward: 1 });
  assert.deepEqual(before, copy);
  assert.equal(s.x, 0); assert.ok(s.z < 11);
  const sideways = advance(before, .5, { forward: 1, yaw: -Math.PI / 2 });
  assert.ok(sideways.x > 1); assert.ok(Math.abs(sideways.z - 12) < 1e-6);
  const diagonal = advance(before, .5, { forward: 1, strafe: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z - 12) - PLAYER.speed * .5) < 1e-6);
  assert.ok(advance(before, 10, { forward: -1 }).z < 13.9);
  assert.ok(step(before, { forward: 1 }, 100).z > 11.6, 'resuming does not teleport');
  assert.throws(() => step(before, {}, NaN), /dt/);
});

test('after hours: footprint, walls and power shortcut use the rendered geometry', () => {
  const s = empty();
  assert.equal(isFree(s, 0, 8), true, 'reception opening');
  assert.equal(isFree(s, 3, 8), false, 'reception wall');
  assert.equal(isFree(s, 8, 12), false, 'outside the nonrectangular footprint');
  assert.equal(isFree(s, 5, 2.6), true, 'maintenance entrance');
  assert.equal(isFree(s, 5, -6.5), true, 'server entrance is reachable before power');
  assert.equal(isFree(s, 0, -2), false);
  assert.equal(isFree({ ...s, power: true }, 0, -2), true);
  assert.equal(lineClear(s, { x: 3, y: 1, z: 7 }, { x: 3, y: 1, z: 9 }), false);
  assert.equal(lineClear(s, { x: 0, y: 1, z: 7 }, { x: 0, y: 1, z: 9 }), true);
});

test('after hours: the shipping barrier stops walking but a real jump lands on and crosses it', () => {
  const start = empty({ x: 6.6, z: .5 });
  const stopped = advance(start, 1.2, { forward: 1 });
  assert.ok(stopped.z > -.3);
  let jumping = step(start, { forward: 1, jump: true }, 1 / 60), peak = jumping.y, landedOnCrate = false;
  for (let i = 0; i < 85; i++) {
    jumping = step(jumping, { forward: 1, jump: true }, 1 / 60);
    peak = Math.max(peak, jumping.y); landedOnCrate ||= jumping.grounded && Math.abs(jumping.y - .48) < 1e-7;
  }
  assert.ok(peak > .9 && peak < 1.05);
  assert.ok(landedOnCrate, 'top surface is solid and walkable');
  assert.ok(jumping.z < -2);
  assert.equal(jumping.y, 0); assert.equal(jumping.grounded, true);
  assert.equal(advance(empty(), 2, { jump: true }).y, 0, 'holding jump does not bunny-hop');
  let onDesk = empty({ x: -6.7, z: 4.6, y: .86 }), high = onDesk.y;
  for (let i = 0; i < 70; i++) { onDesk = step(onDesk, { jump: true }, 1 / 60); high = Math.max(high, onDesk.y); }
  assert.ok(high + PLAYER.height <= LEVEL.ceiling + 1e-7, 'jumping from furniture cannot go through the ceiling');
  assert.equal(onDesk.y, .86);
});

test('after hours: crowbar hits at impact time, only nearest in range and in front', () => {
  const enemy = crab(), before = { ...createGame(), enemies: [enemy] };
  let s = advance(before, .1, { attack: true });
  assert.equal(s.kills, 0); assert.equal(s.enemies[0].health, 1);
  s = advance(s, .05, { attack: true });
  assert.equal(s.kills, 1); assert.equal(s.enemies[0].state, 'dead');
  assert.equal(before.enemies[0].state, 'dormant');
  assert.equal(melee(crab({ z: 9 })).kills, 0, 'outside reach');
  assert.equal(melee(crab({ z: 13.2 })).kills, 0, 'behind the player');
  const two = advance({ ...createGame(), enemies: [crab(), crab({ id: 'second', z: 10.5 })] }, .2, { attack: true });
  assert.equal(two.kills, 1); assert.equal(two.enemies[1].health, 1);
});

test('after hours: melee respects walls, height and cooldown, including airborne targets', () => {
  const acrossWall = melee(crab({ x: 3, z: 7.4 }), { x: 3, z: 8.7 });
  assert.equal(acrossWall.kills, 0);
  assert.equal(melee(crab({ y: 1.2, state: 'recover', stateT: 10 })).kills, 1, 'a leaping headcrab can be struck');
  assert.equal(melee(crab({ y: 4, state: 'recover', stateT: 10 })).kills, 0);
  let s = advance({ ...createGame(), enemies: [crab(), crab({ id: 'second', z: 10.5 })] }, .4, { attack: true });
  assert.equal(s.kills, 1);
  s = advance(s, .3, { attack: true }); assert.equal(s.kills, 2);
});

test('after hours: headcrabs telegraph, leap ballistically, can be dodged and recover', () => {
  let s = empty({ x: 1, z: 5.8, enemies: [crab({ x: 1, z: 3.1, state: 'stalk', cooldown: 0 })] });
  s = step(s, {}, 1 / 60); assert.equal(s.enemies[0].state, 'windup');
  const target = { x: s.enemies[0].targetX, z: s.enemies[0].targetZ };
  s = advance(s, .5, { strafe: 1 });
  assert.equal(s.enemies[0].state, 'windup'); assert.equal(s.health, 100);
  s = advance(s, .2, { strafe: 1 });
  assert.equal(s.enemies[0].state, 'leap'); assert.ok(s.enemies[0].y > 0);
  assert.equal(s.enemies[0].targetX, target.x, 'windup locks the target before the leap');
  s = advance(s, .7);
  assert.equal(s.enemies[0].state, 'recover'); assert.equal(s.health, 100, 'side stepping the locked jump avoids damage');
});

test('after hours: walls stop enemy jumps and one leap cannot drain all health', () => {
  const e = crab({ x: 3, z: 7.1, y: .4, state: 'leap', vx: 0, vy: 3, vz: 4, hasHit: false });
  const wall = advance(empty({ x: 3, z: 8.7, enemies: [e] }), .8);
  assert.ok(wall.enemies[0].z < 7.9); assert.equal(wall.health, 100);
  const hit = advance(empty({ x: 1, z: 6, enemies: [crab({ x: 1, z: 6, y: .4, state: 'leap', vx: 0, vy: 4, vz: 0, hasHit: false })] }), .6);
  assert.equal(hit.health, 80, 'the enemy damages once per leap');
  const simultaneous = step(empty({ x: 1, z: 6, enemies: [0, 1].map((i) => crab({ id: `hit-${i}`, x: 1, z: 6, y: .4, state: 'leap', vx: 0, vy: 4, vz: 0, hasHit: false })) }), {}, 1 / 60);
  assert.equal(simultaneous.health, 80, 'damage immunity prevents a same-frame dogpile');
});

test('after hours: fuse, clearing the server room, power and extraction are ordered', () => {
  const panel = { ...createGame(), x: -7, z: -12 };
  assert.equal(step(panel, { interact: true }, 0).power, false);
  let s = step({ ...createGame(), x: 10, z: -6 }, { interact: true }, 0);
  assert.equal(s.hasFuse, true); assert.equal(s.health, 100); assert.ok(s.events.some((e) => e.type === 'checkpoint'));
  s = step({ ...s, x: -7, z: -12, interactHeld: false }, { interact: true }, 0);
  assert.equal(s.power, false, 'server hostiles must be cleared');
  s = { ...s, enemies: s.enemies.map((e) => e.room === 'servers' ? { ...e, state: 'dead', health: 0 } : e), interactHeld: false };
  s = step(s, { interact: true }, 0); assert.equal(s.power, true); assert.match(objective(s), /shortcut/);
  s = step({ ...s, x: 0, z: 12, interactHeld: false }, { interact: true }, 0);
  assert.equal(s.stage, 'won'); assert.equal(step(s, { forward: 1 }, 1), s);
});

test('after hours: checkpoint retry preserves earned fuse and defeated enemies, restores health', () => {
  let s = createGame(); s.enemies[0].state = 'dead'; s.enemies[0].health = 0; s.kills = 1;
  s = step({ ...s, x: 10, z: -6, health: 40 }, { interact: true }, 0);
  s = { ...s, stage: 'dead', health: 0 };
  const retry = respawn(s);
  assert.equal(retry.hasFuse, true); assert.equal(retry.health, 100); assert.equal(retry.enemies[0].state, 'dead');
  assert.equal(retry.x, 10); assert.equal(retry.z, -6.1); assert.equal(retry.retries, 1);
  assert.equal(s.health, 0); assert.equal(s.stage, 'dead');
});

test('after hours: medkits are one use, and cannot be used through walls', () => {
  let s = empty({ x: -8, z: 5.8, health: 20 });
  assert.equal(interactable(s).id, 'med-operations');
  s = step(s, { interact: true }, 0); assert.equal(s.health, 65); assert.deepEqual(s.usedMedkits, ['med-operations']);
  s = step(s, {}, 0); s = step(s, { interact: true }, 0); assert.equal(s.health, 65);
  const full = step(empty({ x: -8, z: 5.8 }), { interact: true }, 0); assert.deepEqual(full.usedMedkits, []);
});

test('after hours: authored route reaches the fuse, panel and return lift with real movement and one jump', () => {
  let s = empty();
  const walk = (x, z, jump = false) => {
    for (let i = 0; i < 900 && Math.hypot(s.x - x, s.z - z) > .08; i++) {
      const yaw = Math.atan2(-(x - s.x), -(z - s.z));
      s = step(s, { yaw, forward: 1, jump: jump && i === 0 }, Math.min(1 / 60, Math.hypot(s.x - x, s.z - z) / PLAYER.speed));
      if (i === 899) assert.fail(`Route blocked near ${s.x.toFixed(2)},${s.z.toFixed(2)} toward ${x},${z}`);
    }
  };
  for (const p of [[0, 6.6], [3.8, 6.6], [3.8, 2.6], [6.6, 2.6], [6.6, .5]]) walk(...p);
  walk(6.6, -2.3, true); walk(7.3, -6); walk(10, -6);
  s = step(s, { interact: true }, 0); assert.equal(s.hasFuse, true);
  for (const p of [[5.8, -6.5], [4.2, -6.5], [-6.5, -6.5], [-6.5, -12], [-7, -12]]) walk(...p);
  s = step(s, { interact: true }, 0); assert.equal(s.power, true);
  for (const p of [[-6.5, -12], [-6.5, -6.5], [0, -6.5], [0, 12]]) walk(...p);
  s = step(s, { interact: true }, 0); assert.equal(s.stage, 'won'); assert.equal(s.health, 100);
});

test('after hours: every authored spawn and interaction has a usable floor position', () => {
  const s = createGame();
  for (const e of LEVEL.spawns) assert.equal(isFree(s, e.x, e.z, 0, .34, .46), true, e.id);
  for (const p of LEVEL.interactables) assert.equal(isFree(s, p.x, p.z), true, p.id);
});

test('after hours: stalking routes around server racks and landing enemies stay on solid furniture', () => {
  let s = empty({ x: -1, z: -11, enemies: [crab({ x: -6, z: -11, state: 'stalk', cooldown: 20 })] });
  for (let i = 0; i < 60 * 9; i++) {
    s = step(s, {}, 1 / 60); const e = s.enemies[0];
    assert.equal(isFree(s, e.x, e.z, e.y, .34, .46), true, 'enemy body never cuts through rack corners');
  }
  assert.ok(s.enemies[0].x > -2.3 && s.enemies[0].z < -9, 'the enemy finds the aisle around the obstructing rack');
  const onTable = advance(empty({ enemies: [crab({ x: -6.7, z: 4.6, y: 1.1, state: 'leap', vx: 0, vz: 0, vy: -1, hasHit: true })] }), .2);
  assert.equal(onTable.enemies[0].y, .86);
  assert.equal(onTable.enemies[0].state, 'recover');
});
