import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Resolve the browser's two aliases while keeping the real world builder,
// catalogue, voxel models, collision and room controller. Only Canvas draws
// are inert; this test needs neither a browser nor a WebGL context.
const root = new URL('../', import.meta.url), three = new URL('public/vendor/three.module.min.js', root);
const loader = `export async function resolve(s,c,next){
  if(s==='three')return {url:${JSON.stringify(three.href)},shortCircuit:true};
  if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
  return next(s,c);
}`;
register(`data:text/javascript;base64,${Buffer.from(loader).toString('base64')}`, import.meta.url);
const [{ buildWorld }, { createKit }, { generate }, { build }, makers] = await Promise.all([
  import('../public/world/backrooms/world.js'), import('../public/world/backrooms/kit.js'),
  import('../public/world/backrooms/gen.js'), import('../public/world/backrooms/rooms/all-hands.js'), import('../public/world/props/office.js'),
]);

async function auditorium(t, blocked = false) {
  const draw = new Proxy({}, { get: (_, name) => name === 'measureText' ? text => ({ width: String(text).length * 6 })
    : /Gradient/.test(name) ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => draw }) };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const level = generate('all-hands-actual-review', { only: ['all-hands'] });
  const def = { ...level.rooms.find(r => r.arch === 'all-hands'), id: 0, doors: [], links: [] }, kit = createKit();
  let c, me, setbacks = 0;
  const env = { barricadesEnabled: true, ready: [], catalogue: {
    has: type => typeof makers[type] === 'function', geo: type => makers[type] ? kit.model(type, makers[type]) : null,
  }, builders: { 'all-hands': context => { c = context; build(c); } },
  play() {}, interfere() {}, sees: () => false, run: { met() {}, survived() {} }, inventory: { fire: { threatAt: () => null } },
  player: { RADIUS: .22, warp(x, z) { Object.assign(me, c.toLocal(x, z)); setbacks++; } } };
  const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, env);
  env.world = world;
  t.after(() => { world.dispose(); kit.dispose(); });
  const stageZ = -c.D / 2 + 5.2, body = world.bodies[0], local = () => c.toLocal(body.x, body.z);
  if (blocked) {
    const a = c.toWorld(-1.5, stageZ - .12), b = c.toWorld(1.5, stageZ + .12);
    world.furnitureColliders.push({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z),
      top: (def.y || 0) + .9, on: true, tall: false, furniture: 'stage-barricade' });
  }
  for (let i = 0; i < 3; i++) c.rt.uses.find(use => use.label === 'advance transparency').use();
  me = { x: 0, z: stageZ + 4, inside: true, yaw: 0, speed: 0, world: { frozen: false } };
  let time = 0;
  return { c, world, body, local, stageZ, get setbacks() { return setbacks; }, tick() { time += .1; for (const fn of c.rt.ticks) fn(.1, time, me); } };
}

test('All-Hands: the real speaker descends the authored stage and keeps advancing into the aisle', async t => {
  const f = await auditorium(t), start = f.local();
  assert.ok(start.z < f.stageZ);
  let furthest = start.z;
  for (let i = 0; i < 120; i++) { f.tick(); furthest = Math.max(furthest, f.local().z); }
  assert.ok(furthest > f.stageZ + 2, 'the speaker must leave the stage rather than oscillate at the .66m lip');
  assert.ok(f.setbacks > 0, 'the encounter can still reach a visitor in the aisle');
  assert.ok(Math.hypot(f.local().x - start.x, f.local().z - start.z) < .1, 'after a setback it can return to its original place on the stage');
  const a = f.c.toWorld(0, f.stageZ - .01), b = f.c.toWorld(0, f.stageZ + .01);
  assert.equal(f.world.passable(a.x, a.z, b.x, b.z), false, 'the visitor still needs the side stairs');
});

test('All-Hands: its special stage descent cannot cross furniture placed on the stage lip', async t => {
  const f = await auditorium(t, true);
  let previous = f.local();
  for (let i = 0; i < 120; i++) {
    f.tick();
    const current = f.local();
    assert.equal(f.world.free(f.body.x, f.body.z, f.body.r, { ghost: true }), true, 'speaker body remains outside the barricade');
    if (previous.z < f.stageZ && current.z > f.stageZ) assert.ok(Math.abs(current.x) > 1.5 + f.body.r, 'any descent goes around the desk');
    previous = current;
  }
  assert.ok(f.local().z < f.stageZ, 'the centered barricade interrupts its initial straight advance');
});
