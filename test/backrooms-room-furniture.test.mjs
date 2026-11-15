import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import { furnitureClear } from '../public/world/backrooms/furniture-rules.js';
import { createWardenState, stepWarden } from '../public/world/backrooms/rooms/safety-corridor/rule.js';
import { createCableState, stepCable } from '../public/world/backrooms/rooms/cable-drop/rule.js';
import { createShredderState, stepShredder } from '../public/world/backrooms/rooms/shredding-bay/rule.js';
import { createPartnerState, stepPartner } from '../public/world/backrooms/rooms/audit-pod/rule.js';

// Actual room update callbacks and state machines, with only the voxel rigs
// and decorative geometry replaced. Movement/contact use the real helpers.
const root = new URL('../public/world/backrooms/', import.meta.url);
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const three = new URL('../public/vendor/three.module.min.js', import.meta.url).href;
const rig = url(`import { Group } from '${three}';
  const make = () => ({ group: new Group(), light() {}, aimHead() {}, animate() {}, pose() {}, setTint() {} });
  export const buildCommitteeMember = make, buildStandIn = make, makeKeynoteSpeaker = make,
    makeRetentionClerk = make, makeFloorWarden = make, makeTrunkLine = make, makeEfficiencyPartner = make;
  export const buildAudienceKit = () => ({ stamp() {} }), auditoriumSeatVox = () => {}, lecternVox = () => {}, qaMicVox = () => {}, dormantTendrilsVox = () => {};`);
const kit = url('export class Batch { box() {} quad() {} addVox() {} } export const lin = () => [1,1,1], WHITE = [1,1,1], drawText = () => {};');
const bits = url(`export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), turnTo=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  export const P=()=>{},card=()=>({}),framed=()=>{},scatter=()=>{},wetSign=()=>{},doorFrame=()=>{};`);
const hand = url(`import { Group } from '${three}'; export const placePickup=()=>{},isPaper=x=>x==='papers'||x==='pink-slip'; export function buildItemProp(){const g=new Group();g.userData.light=()=>{};return g;}`);
const loaded = new Map();
function sourceUrl(name) {
  if (loaded.has(name)) return loaded.get(name);
  const file = new URL(name, root);
  let source = readFileSync(file, 'utf8');
  if (name === 'denizens.js') source = source.replace("import { populateAbsorbed } from './absorbed.js';", 'const populateAbsorbed=()=>{};');
  source = source.replace(/from '([^']+)'/g, (_, spec) => {
    const dest = new URL(spec, file).href;
    let target = spec === 'three' ? three : dest.endsWith('/kit.js') ? kit : dest.endsWith('/bits.js') ? bits : dest.endsWith('/hand.js') ? hand : dest.endsWith('/rig.js') ? rig : dest;
    if (dest === new URL('denizens.js', root).href) target = sourceUrl('denizens.js');
    if (dest === new URL('room-physics.js', root).href) target = sourceUrl('room-physics.js');
    return `from '${target}'`;
  });
  const result = url(source); loaded.set(name, result); return result;
}
const physical = await import(sourceUrl('room-physics.js'));
const builds = Object.fromEntries(await Promise.all(['mandatory-fun', 'blackout-bay', 'all-hands', 'shredding-bay', 'safety-corridor', 'cable-drop', 'audit-pod'].map(async name => [name, (await import(sourceUrl(`rooms/${name}.js`))).build])));

function setup(name, { enabled = true, rotated = false } = {}) {
  const callbacks = [], denizens = [], uses = [], groups = [], bodies = [], furnitureColliders = [];
  const rt = { id: 0, group: new THREE.Group(), lights: [], uses };
  const toWorld = (x, z) => rotated ? { x: 20 - z, z: 30 + x } : { x, z };
  const toLocal = (x, z) => rotated ? { x: z - 30, z: 20 - x } : { x, z };
  const world = { bodies, furnitureColliders, furniture: [], scene: new THREE.Group(), throats: [],
    free: (x, z, r = .22, opt = {}) => {
      const p = toLocal(x, z);
      return Math.abs(p.x) < 9.7 && Math.abs(p.z) < 11.7 && furnitureClear(world, x, z, x, z, r)
        && (opt.ghost || bodies.every(b => b.on === false || b === opt.ignoreBody || Math.hypot(x - b.x, z - b.z) >= r + b.r));
    },
    headroom: () => 4, passable: () => true, los: () => true, floorY: () => 0,
    current: () => rt, roomAt: () => rt, path: () => [0], lightAt: () => [1, 1, 1], setLights() {},
  };
  let hits = 0, warps = 0, given = 0, balloon = false, flashlight = true;
  const me = { x: 8, z: 10, yaw: 0, inside: true, speed: 0, pitch: 0, sinkTo: 0 };
  const player = { me, RADIUS: .22, warp(x, z, yaw) { me.x = x; me.z = z; if (yaw !== undefined) me.yaw = yaw; warps++; } };
  const env = { barricadesEnabled: enabled, player, play() {}, interfere() {}, red() {}, sees: () => true, hud: { glitch() {} },
    hand: { hasBalloon: () => balloon, hasFlashlight: () => flashlight, hasPaper: () => false, get: () => null, has: () => false, swap() { given++; } },
    denizens: { add(d) { denizens.push(d); return d; } },
  };
  const batch = { box() {}, quad() {} }, draw = new Proxy({}, { get: () => () => {}, set: () => true });
  const tex = { image: { getContext: () => draw } };
  const c = { W: 20, D: 24, H: 4, R: { range: (a, b) => (a + b) / 2, chance: () => false },
    params: { greeterSide: 1, cartSide: 1, castOffset: 0, deskSide: 1, clerkX: 0, lane: 0, offsetZ: 0, crawlSide: 1, partnerSide: 1, partnerOffset: 0 },
    room: { id: 0, cx: 0, cz: 0, doors: [] }, rt, world, env,
    kit: { model: () => ({}), tex: { panel: () => tex, blob: () => tex, white: () => tex, live: () => tex } },
    flat: batch, floor: batch, wall: batch, ceil: batch, after: [],
    toWorld, toLocal, shell() {}, reserve() {}, spans: () => [], clear: () => true, hasProp: () => false,
    prop: () => ({ top: .7 }), model() {}, place() {}, wbox() {}, lay() {}, board() {}, hang() {}, light() {}, blot() {}, pillar() {}, exitSign() {},
    mapped: () => batch, shining: () => batch, wallSpot: () => null, spot: () => null, crate() {},
    hole: (x, z) => ({ x, z }), solid: () => ({ on: true }), sample: () => [1, 1, 1], seen: () => true, fire: () => null,
    dynamic: () => new THREE.Group(), add(g) { groups.push(g); rt.group.add(g); return g; },
    tick(fn) { callbacks.push(fn); }, use(u) { uses.push(u); return u; }, met() {}, survived() {}, hurt() { hits++; return { landed: true, ended: false }; },
  };
  builds[name](c);
  const barrier = (x0, z0, x1, z1) => {
    const a = toWorld(x0, z0), b = toWorld(x1, z1), collider = { x0: Math.min(a.x,b.x), z0: Math.min(a.z,b.z), x1: Math.max(a.x,b.x), z1: Math.max(a.z,b.z), on: true };
    furnitureColliders.push(collider); world.furniture.push({ ...collider, top: 1, collider }); return collider;
  };
  return { c, me, groups, denizens, bodies, barrier, get hits() { return hits; }, get warps() { return warps; }, get given() { return given; },
    set balloon(v) { balloon = v; }, set flashlight(v) { flashlight = v; },
    tick(dt = .1) { for (const fn of callbacks) fn(dt, 1, me); for (const d of denizens) d.update?.(dt, 1, me); },
  };
}

test('room bodies use live world coordinates, disable while hidden, clean up, and stay behind the flag', () => {
  const f = setup('mandatory-fun', { rotated: true });
  assert.equal(f.bodies.length, 6);
  const actor = { x: 2, z: 3, group: new THREE.Group() }, b = physical.roomBody(f.c, actor);
  assert.deepEqual([b.x, b.z], [17, 32]); actor.x++;
  assert.equal(b.z, 33); actor.group.visible = false; assert.equal(b.on, false);
  actor.group.userData.dispose(); assert.equal(f.bodies.length, 6);
  assert.equal(setup('mandatory-fun', { enabled: false }).bodies.length, 0);
});

test('Fun Committee contact cannot reach through a desk; party and return animations cannot cross it', () => {
  const f = setup('mandatory-fun'), greeter = f.groups[0], z = greeter.position.z;
  f.me.x = greeter.position.x; f.me.z = z - .6;
  const wall = f.barrier(-10, z - .33, 10, z - .27);
  f.tick(.1); assert.equal(f.hits, 0, 'a close member cannot catch through furniture');
  for (let i=0; i<8; i++) f.tick(.1);
  assert.ok(greeter.position.z >= wall.z1 + .22 - 1e-6);
  // Balloon celebration no longer snaps the greeter back to its home through a desk.
  wall.on = false; for (let i=0; i<8; i++) { f.me.z = z - 2; f.tick(.1); }
  const before = greeter.position.z; f.barrier(-10, before + .25, 10, before + .35); f.balloon = true;
  for (let i=0; i<10; i++) f.tick(.1);
  assert.ok(greeter.position.z < before + .04);
});

test('Stand-In sees torch over low furniture but cannot reach or reset through it', () => {
  const f = setup('blackout-bay'), s = f.groups[0], z = s.position.z;
  f.me.x = s.position.x; f.me.z = z + .6; f.me.yaw = Math.PI;
  const wall = f.barrier(-10, z + .27, 10, z + .33);
  f.tick(.1); assert.equal(f.hits, 0);
  f.me.yaw = 0; const before = s.position.clone(); f.tick(.2);
  assert.equal(s.position.z, before.z, 'torch still freezes the figure across furniture');
  wall.on = false; f.me.yaw = Math.PI; f.me.z = z + 2; for(let i=0;i<7;i++) f.tick(.1);
  const advanced = s.position.z; f.barrier(-10, advanced - .35, 10, advanced - .25); f.me.inside = false;
  for(let i=0;i<12;i++) f.tick(.1);
  assert.ok(s.position.z > advanced - .04, 'returning to the station obeys the new barrier');
});

test('All-Hands shutter steps use actual physical position and cannot catch across a barricade', () => {
  const f = setup('all-hands'), speaker = f.groups[0], z = speaker.position.z;
  f.barrier(-10, z + .4, 10, z + .5);
  f.me.x = 0; f.me.z = z + .8;
  for(let i=0;i<6;i++) f.tick(.4);
  assert.equal(f.warps, 0, 'close scripted progress must not catch across the desk');
  assert.ok(speaker.position.z < z + .11, 'blackout advance stays on the near side');
});

test('Retention Clerk, Floor Warden and Trunk Line cannot attack through low furniture', () => {
  for (const name of ['shredding-bay', 'safety-corridor', 'cable-drop']) {
    const f = setup(name), d = f.denizens[0];
    f.me.x = d.x; f.me.z = d.z + .6; f.me.speed = 4;
    f.barrier(-10, d.z + .28, 10, d.z + .32);
    for(let i=0;i<15;i++) f.tick(.1);
    assert.equal(f.hits, 0, name); assert.equal(f.warps, 0, name);
  }
});

test('a desk moved under a falling Trunk Line prevents it landing inside the desk', () => {
  const f = setup('cable-drop'), d = f.denizens[0];
  f.me.x = d.x; f.me.z = d.z + 1;
  const desk = f.barrier(d.x - .6, d.z - .6, d.x + .6, d.z + .6);
  for(let i=0;i<12;i++) f.tick(.1);
  assert.equal(d.physical, false); assert.ok(d.lift >= 1); assert.equal(f.hits, 0);
  desk.on = false; f.tick(.1); f.tick(.1);
  assert.equal(d.physical, true); assert.equal(d.lift, 0);
});

test('a barrier introduced during the clerk grab releases it without a warp or delayed damage', () => {
  const f = setup('shredding-bay'), d = f.denizens[0];
  f.me.x = d.x; f.me.z = d.z + .6;
  f.tick(.1); f.tick(.1); // following, then pulling
  const warps = f.warps;
  f.barrier(-10, d.z + .25, 10, d.z + .35);
  for(let i=0;i<15;i++) f.tick(.1);
  assert.equal(f.warps, warps); assert.equal(f.hits, 0); assert.equal(f.me.sinkTo, 0);
});

test('continuous player pulls stop at a desk even when the frame target lies beyond it', () => {
  const f = setup('mandatory-fun'); f.me.x = 0; f.me.z = 0;
  f.barrier(-1, .45, 1, .55);
  assert.equal(physical.pullPlayer(f.c.world, f.c.env.player, 0, 2, 0), false);
  assert.ok(f.me.z < .24 && f.me.z > 0);
});

test('physical attacks still land without an intervening barricade', () => {
  for (const name of ['mandatory-fun', 'blackout-bay', 'shredding-bay', 'safety-corridor', 'cable-drop']) {
    const f = setup(name), d = f.denizens[0] || f.groups[0].position;
    f.me.x = d.x; f.me.z = d.z + (name === 'mandatory-fun' ? -.6 : .6); f.me.speed = 4; f.me.yaw = Math.PI;
    for(let i=0;i<20;i++) f.tick(.1);
    assert.ok(f.hits > 0, name);
  }
  const f = setup('all-hands'); f.me.x = 0; f.me.z = f.groups[0].position.z + .8;
  f.tick(.1); assert.ok(f.warps > 0);
});

test('room setbacks choose a clear landing when the doorway spot is barricaded', () => {
  const f = setup('blackout-bay'); f.barrier(-.5, 10.9, .5, 11.6);
  const at = physical.roomReturn(f.c, 0, 11.3);
  assert.ok(at && f.c.world.free(at.x, at.z, .22));
  assert.ok(Math.hypot(at.x, at.z - 11.3) > .5);
});

test('Efficiency Partners cannot hand a slip through a barricade', () => {
  const f = setup('audit-pod'), d = f.denizens[0];
  f.me.x = d.x; f.me.z = d.z + .8;
  const desk = f.barrier(-10, d.z + .3, 10, d.z + .5);
  for(let i=0;i<8;i++) f.tick(.1);
  assert.equal(f.given, 0);
  desk.on = false;
  for(let i=0;i<8;i++) f.tick(.1);
  assert.ok(f.given > 0);
});

test('room-local walkers cannot sidestep through an open doorway into another room', () => {
  const f = setup('mandatory-fun', { rotated: true }), a = { x: 9.5, z: 0, r: .22, group: new THREE.Group() };
  f.c.world.free = () => true; // an open doorway and clear neighbouring floor
  f.c.world.roomAt = (x, z) => f.c.toLocal(x, z).x < 10 ? f.c.rt : { id: 1 };
  physical.moveRoomWalker(f.c, a, 12, 0, 5);
  assert.ok(a.x <= 9.78 && Math.abs(a.z) < 11.78);
  const start = { x: a.x, z: a.z }; a.away = 'face-a';
  assert.equal(physical.moveRoomWalker(f.c, a, 0, 0, 4), 0);
  assert.deepEqual({ x: a.x, z: a.z }, start);
});

test('the clerk body does not make a side/back grab harmless, but other bodies still stop the pull', () => {
  const f = setup('shredding-bay'), d = f.denizens[0];
  d.body = { get x() { return d.x; }, get z() { return d.z; }, r: d.r };
  f.bodies.push(d.body);
  f.me.x = d.x; f.me.z = d.z - .6;
  for(let i=0;i<15;i++) f.tick(.1);
  assert.ok(f.hits > 0, 'an established grab may enter the attacker body');
  f.me.x = 4; f.me.z = 0;
  f.bodies.push({ x: 4, z: .6, r: .25 });
  assert.equal(physical.pullPlayer(f.c.world, f.c.env.player, 4, 2, 0, d.body), false);
  assert.ok(f.me.z < .14, 'the exception does not ignore an unrelated resident');
});

test('the Warden notices and pursues a visible runner across low furniture outside its home room', () => {
  const f = setup('safety-corridor'), d = f.denizens[0], start = { x: d.x, z: d.z }, sounds = [];
  f.c.world.current = () => ({ id: 1 }); // perception cannot rely on insideRoom
  f.c.env.play = name => sounds.push(name);
  f.me.x = d.x; f.me.z = d.z + 1.8; f.me.speed = 4;
  f.barrier(-10, d.z + .8, 10, d.z + .85);
  f.tick(.1);
  assert.ok(sounds.includes('peawhistle'), 'sees running over the desk and starts a chase');
  assert.ok(Math.hypot(d.x - start.x, d.z - start.z) > .2, 'approaches at chase speed');
  f.me.z = start.z + .9;
  for(let i=0;i<10;i++) f.tick(.1);
  assert.equal(f.hits, 0, 'near enough to snip, but the desk still blocks contact');
});

test('contact clearance stops physical catches and handoffs without stopping pursuit', () => {
  const inputs = { dt: .1, dist: .3, clearLine: true, contactClear: false };
  const warden = stepWarden({ ...createWardenState(), phase: 'chasing' }, inputs);
  assert.equal(warden.state.phase, 'chasing'); assert.equal(warden.caught, false); assert.ok(warden.speed > 0);
  const cable = stepCable({ ...createCableState(), phase: 'hunting' }, { ...inputs, distToCreature: .3, distToDrop: 2 });
  assert.equal(cable.state.phase, 'hunting'); assert.equal(cable.caught, false); assert.ok(cable.speed > 0);
  const clerk = stepShredder({ ...createShredderState(), phase: 'following' }, { ...inputs, holdingPaper: true, offeredPaper: true });
  assert.equal(clerk.state.phase, 'following'); assert.equal(clerk.grabbed, false); assert.equal(clerk.atePaper, false); assert.ok(clerk.speed > 0);
  const partner = stepPartner({ ...createPartnerState(), phase: 'approaching' }, { ...inputs, handEmpty: true });
  assert.equal(partner.state.phase, 'approaching'); assert.equal(partner.gaveSlip, false); assert.ok(partner.speed > 0);
});
