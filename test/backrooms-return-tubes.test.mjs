import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { generate } from '../public/world/backrooms/gen.js';
import { toLocal, toWorld, wallPoint } from '../public/world/backrooms/frame.js';
import { CONNECTOR, OFFICE, BEACH, flumePlan, tubeSamples, BEACH_BED } from '../public/world/backrooms/rooms/flume-connector/plan.js';

test('forcing either endpoint places one complete fork and its shared return corridor', () => {
  const rotations = new Set();
  for (let i = 0; i < 36; i++) {
    const only = [CONNECTOR, OFFICE, BEACH, [CONNECTOR, OFFICE, BEACH]][i % 4];
    const level = generate('return-tubes:' + i, { theme: 'waterpark', only, rooms: 25 });
    const [fork, office, beach] = [CONNECTOR, OFFICE, BEACH].map(arch => {
      const rooms = level.rooms.filter(r => r.arch === arch);
      assert.equal(rooms.length, 1, arch);
      return rooms[0];
    });
    rotations.add(fork.rot);
    const left = fork.doors.find(d => d.side === 'left'), right = fork.doors.find(d => d.side === 'right');
    assert.equal(left.to, office.id);
    assert.equal(right.to, beach.id);
    assert.equal(office.doors.find(d => d.link === left.link).side, 'front');
    assert.equal(beach.doors.find(d => d.link === right.link).side, 'front');
    const hall = office.doors.find(d => d.to !== fork.id);
    assert.ok(beach.doors.some(d => d.to === hall.to), 'both dry returns rejoin in the same corridor');
    assert.equal(level.rooms[hall.to].kind, 'plain');
  }
  assert.equal(rotations.size, 4);
});

const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){
  if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};
  if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
  return next(s,c);
}`)}`, import.meta.url);

test('ordinary movement follows both tubes, catches the ceiling drop, and reaches the dry return from both ends', async t => {
  const canvas = new Proxy({}, {
    get: (_, k) => k === 'measureText' ? s => ({ width: String(s).length * 6 })
      : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {}, set: () => true,
  });
  const old = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => canvas }) };
  t.after(() => { globalThis.document = old; });

  const [{ createKit }, { buildWorld, loadCatalogue }, { createPlayer }, { PerspectiveCamera }, { BUILDERS }, ...mods] = await Promise.all([
    import('../public/world/backrooms/kit.js'), import('../public/world/backrooms/world.js'),
    import('../public/world/backrooms/player.js'), import('../public/vendor/three.module.min.js'),
    import('../public/world/backrooms/rooms.js'),
    import('../public/world/backrooms/rooms/flume-connector.js'), import('../public/world/backrooms/rooms/flooded-cubicles.js'),
    import('../public/world/backrooms/rooms/office-beach-day.js'),
  ]);
  const level = generate('beach-traversal', { theme: 'waterpark', only: CONNECTOR, hand: [CONNECTOR], rooms: 24, pursuer: false });
  const rooms = [CONNECTOR, OFFICE, BEACH].map(arch => level.rooms.find(r => r.arch === arch));
  const [fork, office, beach] = rooms;
  const builders = { ...BUILDERS, ...Object.fromEntries(rooms.map((r, i) => [r.arch, mods[i].build])) };
  const kit = createKit(), sounds = [];
  const env = { kit, level, builders, catalogue: await loadCatalogue(kit), hatches: new Map(), coopStrict: true,
    play(name) { sounds.push(name); }, interfere() {} };
  const world = await buildWorld(kit, level, env);
  t.after(() => { world.dispose(); kit.dispose(); });
  for (const r of rooms) {
    const runtime = world.rooms[r.id];
    assert.equal(runtime.flat, false, r.arch);
    let triangles = 0;
    runtime.group.traverse(node => {
      if (node.isMesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    });
    t.diagnostic(`${r.arch}: ${triangles} triangles`);
    assert.ok(triangles <= 120_000, `${r.arch} fits the ordinary room budget`);
  }

  const input = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const spawn = toWorld(fork, 0, fork.D / 2 + .84);
  const start = () => env.player = createPlayer(world, new PerspectiveCamera(), { ...spawn, yaw: fork.rot * Math.PI / 2 }, input);
  let player = start(), time = 0, duck = 0;
  function tick() {
    player.update(1 / 60);
    world.update(1 / 60, time += 1 / 60, player.me);
    duck = Math.max(duck, player.me.sink);
  }
  function walk(room, x, z, until) {
    const goal = toWorld(room, x, z), me = player.me;
    const remaining = () => Math.hypot(goal.x - me.x, goal.z - me.z);
    input.keys.add('w');
    for (let i = 0; i < 600 && remaining() > .068 && !until?.(); i++) {
      me.yaw = Math.atan2(me.x - goal.x, me.z - goal.z);
      tick();
    }
    input.keys.clear();
    me.vx = me.vz = 0;
    assert.ok(remaining() < .1 || until?.(), `walk to ${room.arch} ${x},${z}, at ${JSON.stringify(toLocal(room, me.x, me.z))}`);
  }
  const runs = flumePlan(fork).map(pts => tubeSamples(pts, 12));
  const traverse = run => run.forEach(({ x, z }) => walk(fork, x, z));
  const roomId = () => world.roomAt(player.me.x, player.me.z)?.id;
  function onward(room) {
    const out = room.doors.find(d => d.to !== fork.id);
    for (const off of [1, -.55]) {
      const point = wallPoint(room, out.side, out.c, off);
      walk(room, point.x, point.z);
    }
    return out.to;
  }
  traverse(runs[0]);
  traverse(runs[1]);
  assert.ok(duck > .24, 'the tunnel uses the normal crouch controller');
  walk(office, 0, office.D / 2 - 1);
  assert.equal(roomId(), office.id);
  walk(office, 0, 0);
  const hall = onward(office);
  assert.equal(roomId(), hall);

  player = start();
  traverse(runs[0]);
  traverse(runs[2]);
  const runtime = world.rooms[beach.id].beachDay;
  assert.equal(runtime.sunHour, 5);
  const riding = () => !!runtime.ride(player.me);
  walk(beach, 0, beach.D / 2 - .80, riding);
  assert.ok(riding(), 'ordinary forward input starts the terminal chute');
  for (let i = 0; i < 140 && riding(); i++) tick();
  assert.ok(!riding(), 'the drop hands back controls');
  assert.equal(roomId(), beach.id);
  assert.ok(Math.abs(player.me.y - beach.y - BEACH_BED - player.EYE) < .02);
  assert.equal(sounds.filter(s => s === 'wade').length, 1);
  walk(beach, 0, 0);
  assert.equal(onward(beach), hall);
  assert.equal(roomId(), hall);
});
