import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import { createWalk, BARRICADE_COST } from '../public/world/backrooms/cast/walk.js';
import { BARRICADE, heave, shown } from '../public/world/backrooms/cast/hunt.js';
import { roomRoute } from '../public/world/backrooms/cast/paths.js';

function passage() {
  const definitions = [0, 1].map(id => ({ id, W: 4, D: 4, H: 3, cx: id * 4.2, cz: 0, rot: 0,
    doors: [{ to: 1 - id, link: 0, h: 3 }] }));
  const rooms = definitions.map(def => ({ id: def.id, def }));
  const link = { id: 0, axis: 'x', at: 2.1, from: -.7, to: .7, a: 0, b: 1 };
  const item = { id: 'desk', type: 'desk', x: 1.6, z: 0, x0: 1.3, x1: 1.9, z0: -.7, z1: .7, top: .9, on: true };
  const revisions = [0, 0];
  const overlaps = (x, z, r) => item.on && Math.hypot(x - Math.max(item.x0, Math.min(x, item.x1)), z - Math.max(item.z0, Math.min(z, item.z1))) < r;
  const world = { rooms, throats: [{ link, open: true, a: 0, b: 1 }],
    roomAt: x => rooms[x < 2.1 ? 0 : 1], headroom: () => 3, floorY: () => 0, passable: () => true,
    free(x, z, r, opt = {}) {
      if (x < -2 + r || x > 6.2 - r || Math.abs(z) > 2 - r) return false;
      if (x > 2 - r && x < 2.2 + r && Math.abs(z) > .7 - r) return false;
      return opt.furniture === 'phase' || opt.furnitureY >= item.top || !overlaps(x, z, r);
    },
  };
  const env = { world, level: { rooms: definitions }, barricades: {
    version: id => revisions[id],
    blocking(a, b, r) {
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .04));
      for (let i = 0; i <= n; i++) if (overlaps(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n, r)) return item;
      return null;
    },
  } };
  const actor = { x: -.8, z: 0, r: .26, tall: 1.6, opens: true, pushes: true, speed: 1 };
  return { env, world, actor, item, revisions, walk: createWalk(env) };
}

test('barricade navigation: a blocked doorway reports its furniture; moving it clears the route without rebuilding other rooms', () => {
  const f = passage(), target = { x: 4.2, z: 0 };
  let stopped;
  for (let i = 0; i < 100; i++) { stopped = f.walk.go(f.actor, target, .05); if (stopped.obstacle) break; }
  assert.equal(stopped.obstacle, f.item);
  assert.equal(stopped.link, 0);
  assert.equal(stopped.there, false, 'a desk is not the destination');
  assert.equal(stopped.cannot, false, 'a hunter that can push is allowed to try');
  assert.ok(f.actor.x < f.item.x0 - f.actor.r + .01, 'never walks through the furniture');
  const cached = f.actor.way?.g;
  f.revisions[1]++;
  f.walk.go(f.actor, target, .05);
  assert.equal(f.actor.way?.g, cached, 'movement in another room leaves this room grid alone');
  f.item.on = false; f.revisions[0]++;
  for (let i = 0; i < 140; i++) f.walk.go(f.actor, target, .05);
  assert.ok(Math.hypot(f.actor.x - target.x, f.actor.z - target.z) < .15, 'the cleared doorway can actually be crossed');
});

test('barricade navigation: phasing ignores furniture only; flight needs actual height and still respects ceilings and lintels', () => {
  const f = passage(), target = { x: 4.2, z: 0 };
  const shadow = { ...f.actor, furniture: 'phase', pushes: false };
  assert.equal(f.walk.stand(shadow, f.item.x, 0), true);
  assert.equal(f.walk.stand(shadow, 0, 3), false, 'phasing does not erase normal room walls');
  for (let i = 0; i < 120; i++) f.walk.go(shadow, target, .05);
  assert.ok(Math.hypot(shadow.x - target.x, shadow.z) < .15);
  const moth = { ...f.actor, flightY: 1.2, tall: .4, opens: false, pushes: false };
  assert.equal(f.walk.stand(moth, f.item.x, 0), true, 'a moth really above the desktop may pass');
  moth.flightY = .6;
  assert.equal(f.walk.stand(moth, f.item.x, 0), false, 'low flight does not pass through the desktop');
  moth.flightY = 2.8;
  assert.equal(f.walk.stand(moth, 0, 0), false, 'the whole wing envelope fits below the ceiling');
  moth.flightY = 1.2; f.world.throats[0].link.h = 1.4; f.env.level.rooms[0].doors[0].h = 1.4;
  assert.equal(f.walk.cost(moth)(f.env.level.rooms[0].doors[0], 0, 1), Infinity, 'a low lintel requires descending first');
  assert.equal(f.walk.stand(moth, 2.1, 0), false);
  f.world.throats[0].link.h = 3; f.env.level.rooms[0].doors[0].h = 3;
  for (let i = 0; i < 120; i++) f.walk.go(moth, target, .05);
  assert.ok(Math.hypot(moth.x - target.x, moth.z) < .15, 'airborne route crosses the low barricade');
});

test('barricade navigation: an unshiftable doorway is avoided only until its surroundings change', () => {
  const f = passage(), d = f.env.level.rooms[0].doors[0];
  assert.equal(f.walk.cost(f.actor)(d, 0, 1), 1 + BARRICADE_COST);
  f.walk.avoid(f.actor, 0);
  assert.equal(f.walk.cost(f.actor)(d, 0, 1), Infinity);
  assert.equal(f.walk.cost(f.actor)(f.env.level.rooms[1].doors[0], 1, 0), Infinity, 'the same blockage from either side');
  f.revisions[0]++;
  assert.equal(f.walk.cost(f.actor)(d, 0, 1), 1 + BARRICADE_COST);
  f.walk.avoid(f.actor, 0);
  for (let i = 0; i < 70; i++) f.walk.go(f.actor, { x: 4.2, z: 0 }, .05);
  assert.equal(f.walk.cost(f.actor)(d, 0, 1), 1 + BARRICADE_COST, 'a temporary body obstruction is retried even without furniture moving');
  const level = { rooms: [
    { doors: [{ to: 1, link: 0, h: 3 }, { to: 2, link: 1, h: 3 }] },
    { doors: [] }, { doors: [{ to: 3, link: 2, h: 3 }] }, { doors: [{ to: 1, link: 3, h: 3 }] },
  ] };
  assert.deepEqual(roomRoute(level, 0, 1, door => door.link === 0 ? f.walk.cost(f.actor)(d, 0, 1) : 1), [0, 2, 3, 1], 'a short clear detour beats moving the desk');
});

test('barricade wind-up buys unwatched time and restarts for a different object', () => {
  const desk = { id: 'desk1', type: 'desk' };
  let s = null, pushed = 0;
  for (let i = 0; i < 20; i++) { s = heave(s, .1, desk); pushed += s.shove; }
  assert.equal(pushed, 0);
  const before = s.t;
  for (let i = 0; i < 50; i++) { s = heave(s, .1, desk, false); assert.equal(s.shove, 0); }
  assert.equal(s.t, before, 'watching and pauses do not spend the wind-up');
  for (let i = 0; i < 10; i++) { s = heave(s, .1, desk); pushed += s.shove; }
  assert.ok(Math.abs(pushed - (3 - BARRICADE.desk)) < 1e-9);
  const braced = s.t;
  s = heave(s, .1, null);
  assert.equal(s.t, braced); assert.equal(s.shove, 0, 'following the desk does not push at a distance');
  s = heave(s, .1, desk);
  assert.ok(s.shove > .09, 'contact resumes without paying the whole wind-up again');
  s = heave(s, .1, { ...desk, id: 'desk2' });
  assert.equal(s.t, .1); assert.equal(s.shove, 0);
  for (let i = 0; i < 15; i++) s = heave(s, .1, null);
  assert.equal(s, null, 'actually leaving the desk resets the brace');
});

test('barricade navigation: following a sliding desk keeps the same wind-up and eventually gets through', () => {
  const f = passage(), target = { x: 4.2, z: 0 }, dt = 1 / 30;
  let brace = null, sinceRevision = 0, shoves = 0;
  for (let i = 0; i < 600; i++) {
    const got = f.walk.go(f.actor, target, dt);
    assert.ok(f.world.free(f.actor.x, f.actor.z, f.actor.r), 'the hunter never steps through the sliding desk');
    brace = heave(brace, dt, got.obstacle);
    if (got.obstacle && brace.shove > 0) {
      const dx = brace.shove * .4;
      f.item.x += dx; f.item.x0 += dx; f.item.x1 += dx; shoves++; sinceRevision += dx;
      if (sinceRevision >= .05) { f.revisions[0]++; f.revisions[1]++; sinceRevision = 0; }
    }
  }
  assert.ok(shoves > 100, 'continuing contact does not restart the full brace after every small step');
  assert.ok(f.actor.x > 2.5, 'the hunter follows its own cleared space through the doorway');
  assert.ok(Math.hypot(f.actor.x - target.x, f.actor.z - target.z) < .15, 'once inside it can get around the desk to its target');
});

// Exercise the actual pirate controller. Only geometry baking and the movement service are replaced;
// the scene graph, hunting/fear rules, watched state and wind-up are the same as in the game.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const pirateUrl = new URL('../public/world/backrooms/cast/pirate.js', import.meta.url);
const kitUrl = moduleUrl('export class Batch { addVox() {} } export const lamp = () => ({}), lin = () => [1,1,1], drawText = () => {};');
const bitsUrl = moduleUrl(readFileSync(new URL('../public/world/backrooms/bits.js', import.meta.url), 'utf8').split('\n').filter(line => /^export const (P|clamp|turnTo) =/.test(line)).join('\n'));
const source = readFileSync(pirateUrl, 'utf8').replace(/from '([^']+)'/g, (_, spec) => `from '${spec === 'three' ? new URL('../public/vendor/three.module.min.js', import.meta.url).href : spec === '../kit.js' ? kitUrl : spec === '../bits.js' ? bitsUrl : new URL(spec, pirateUrl).href}'`);
const { create } = await import(moduleUrl(source));

function hunter(t) {
  const def = { id: 0, cx: 0, cz: 0, W: 20, D: 20, H: 3, rot: 0, doors: [] }, room = { id: 0, def, group: { visible: true }, uses: [] };
  const level = { seed: 'barricade-controller', depth: 0, pursuer: { room: 0, face: 0 }, rooms: [def], links: [], start: { x: 8, z: 0 }, exit: { room: 0 } };
  const geometry = new THREE.BoxGeometry(.1, .1, .1), materials = [];
  const kit = { own: v => v, tex: { blob: () => null }, model: () => ({ solid: {} }), geometry: () => geometry,
    surface() { const m = new THREE.ShaderMaterial({ uniforms: { uTint: { value: new THREE.Vector3(1, 1, 1) } } }); materials.push(m); return m; } };
  let visible = false, fire = false, movable = true, calls = 0, avoided = 0, hits = 0;
  const item = { id: 'desk', type: 'desk', x: .8, z: 0 };
  const world = { scene: new THREE.Group(), rooms: [room], throats: [], bodies: [], roomAt: () => room, floorY: () => 0,
    lightAt: () => [.4, .4, .4], los: () => true, passable: () => true, free: () => true };
  const walk = { stand: () => true, spotIn: () => ({ x: 0, z: 0 }), exits: () => [], forget() {},
    go: () => ({ went: 0, obstacle: item, link: 0, there: false, cannot: false }), avoid() { avoided++; } };
  const env = { level, world, kit, clock: 0, player: { me: { x: 8, z: 0, yaw: 0, pitch: 0, frozen: false } },
    sees: () => visible, play() {}, interfere() {}, hud: { glitch() {} }, sound: { play() {} },
    barricades: { shove(i, actor, dt) { calls++; if (movable) i.x += dt * .5; return { moved: movable }; } } };
  const pirate = create({ env, walk, hidden: () => !visible, drawn: () => true, fire: () => fire ? { x: pirate.figure.x + 1, z: pirate.figure.z, remaining: 5 } : null,
    met() {}, survived() {}, hurt: () => { hits++; return { landed: false }; } });
  pirate.ready(); const p = pirate.figure; p.state = 'awake'; p.plinth = false; p.know = shown({ x: 8, z: 0, room: 0 });
  t.after(() => { pirate.dispose(); geometry.dispose(); for (const material of materials) material.dispose(); });
  return { env, pirate, p, item, get calls() { return calls; }, get avoided() { return avoided; }, get hits() { return hits; },
    seen(value) { visible = value; }, fire(value) { fire = value; }, blocked() { movable = false; },
    tick(seconds) { for (let i = 0; i < Math.ceil(seconds * 30); i++) { env.clock += 1 / 30; pirate.update(1 / 30); } } };
}

test('pirate barricades: bracing precedes gradual movement; watching, frozen player, spent state and fire stop shoving', t => {
  const f = hunter(t);
  f.tick(2.5); assert.equal(f.calls, 0, 'the desk buys time before moving');
  f.tick(.8); assert.ok(f.calls > 0); assert.ok(f.item.x > .8 && f.item.x < 1.1, 'small gradual movement, not an instant unblock');
  let before = f.calls;
  f.seen(true); f.tick(3); assert.equal(f.calls, before, 'watching the mascot stops it');
  f.seen(false); f.env.player.me.frozen = true; f.tick(3); assert.equal(f.calls, before, 'a frozen visitor cannot have furniture pushed onto them');
  f.env.player.me.frozen = false; f.p.know.spent = 10; f.tick(3); assert.equal(f.calls, before, 'a hunter resting after a grab does not shove');
  f.p.know.spent = 0; f.fire(true); f.tick(3); assert.equal(f.calls, before, 'fear of fire takes precedence');
});

test('pirate barricades: a shove rejected by the collision service requests a different route', t => {
  const f = hunter(t); f.blocked(); f.tick(5);
  assert.ok(f.calls > 0 && f.avoided > 0);
  assert.equal(f.item.x, .8, 'a failed shove never moves the desk anyway');
});

test('pirate barricades: proximity and crawl grabs cannot reach through a low desk', t => {
  const f = hunter(t), w = f.env.world;
  assert.ok(w.bodies.includes(f.p.body), 'the mascot is solid before its first AI tick');
  f.env.health = {}; f.env.player.me.x = .6;
  const desk = { x0: .22, x1: .38, z0: -.4, z1: .4, on: true };
  w.furnitureColliders = [desk];
  f.seen(true); f.tick(3);
  assert.equal(f.hits, 0); assert.equal(f.p.near.tears, 0, 'touch pressure does not build through a barricade');
  f.seen(false); f.tick(1);
  assert.equal(f.hits, 0, 'unwatched proximity still cannot grab through it');
  f.p.down = { l: { t: 0, seen: 0, away: 0 }, head: { x: 0, z: 0 }, feet: { x: 0, z: 0 }, yaw: 0 };
  f.tick(.1); assert.equal(f.hits, 0, 'a head under a crawl hole cannot attack through the desk either');
  desk.on = false; f.tick(.1);
  assert.ok(f.hits > 0, 'an unobstructed close encounter still attacks');
});

test('pirate barricades: stepping off a plinth cannot jump a barricade, including while fleeing fire', t => {
  const f = hunter(t);
  f.p.plinth = true;
  f.env.world.furnitureColliders = [
    { x0: .34, x1: .45, z0: -.5, z1: .5 }, { x0: -.45, x1: -.34, z0: -.5, z1: .5 },
    { x0: -.5, x1: .5, z0: .34, z1: .45 }, { x0: -.5, x1: .5, z0: -.45, z1: -.34 },
  ];
  f.tick(1);
  assert.equal(f.p.plinth, true); assert.deepEqual([f.p.x, f.p.z], [0, 0], 'a free endpoint beyond the desk is not a clear step off the plinth');
  f.fire(true); f.tick(1);
  assert.equal(f.p.plinth, true); assert.deepEqual([f.p.x, f.p.z], [0, 0], 'fire does not grant a movement bypass');
  f.fire(false); f.env.world.furnitureColliders = []; f.tick(2);
  assert.equal(f.p.plinth, false, 'a clear departure still works');
});

test('pirate barricades: the scripted crawl head cannot appear beyond furniture or attack through its own blocked prone body', t => {
  const f = hunter(t), w = f.env.world;
  f.env.health = {}; f.env.player.me.x = 3;
  f.p.cross = { way: { x: 1.2, z: 0 }, t: 0, turned: 1, will: true, room: true,
    near: { x: 0, z: 0 }, feet: { x: -.46, z: 0 }, head: { x: .42, z: 0 }, yaw: Math.PI / 2 };
  const desk = { x0: .22, x1: .38, z0: -.4, z1: .4, on: true };
  w.furnitureColliders = [desk];
  f.tick(1);
  assert.equal(f.p.down, null, 'clear feet and head endpoints do not permit the pose across a desk');
  desk.on = false; f.tick(.1);
  assert.ok(f.p.down, 'the unobstructed crawl encounter still plays');
  assert.ok(f.p.body.x + f.p.body.r >= f.p.down.head.x + .2, 'the registered body covers the extended head');
  f.env.player.me.x = .9; desk.on = true;
  f.tick(.1);
  assert.equal(f.hits, 0, 'even a clear head-to-player ray cannot bypass a desk across the prone body');
  desk.on = false; f.tick(.1);
  assert.ok(f.hits > 0, 'the clear crawl grab remains dangerous');
  f.env.player.me.x = 8; f.p.down.l.t = 8; f.tick(.1);
  assert.equal(f.p.down, null); assert.equal(f.p.body.r, .3, 'standing again restores the usual body radius');
});
