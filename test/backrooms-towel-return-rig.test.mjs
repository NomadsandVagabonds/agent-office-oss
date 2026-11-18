// The Towel Return's figures (rooms/dive-tower/rig.js): the climber's rig, and its going — jerked up by the jab, then flat
// on its face where it stood, the grin turned to one side — moving only what is inside the group the room places, and
// nothing random.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`, import.meta.url);
const [{ createKit }, { makeTowelReturn }] = await Promise.all([
  import('../public/world/backrooms/kit.js'), import('../public/world/backrooms/rooms/dive-tower/rig.js'),
]);

test('it is still the climber, and its place is the room\'s', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const r = makeTowelReturn(kit, 1);
  for (const k of ['group', 'bodyGroup', 'head', 'armL', 'armR', 'pose', 'light', 'die']) assert.ok(r[k], k);
  r.group.position.set(1, 2, 3); r.group.rotation.y = 0.4;
  r.pose('stalking', 1); r.die(0.6, 2);
  assert.deepEqual([r.group.position.x, r.group.position.y, r.group.position.z, r.group.rotation.y], [1, 2, 3, 0.4]);
});

test('the jab throws it up and back; then it goes over onto its face, and lies there', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const r = makeTowelReturn(kit, 0);
  r.die(0.1, 1); assert.ok(r.bodyGroup.rotation.x < -0.2, 'up and back'); assert.ok(r.armL.rotation.x < -1.5, 'arms flung up');
  r.die(1, 3); assert.ok(r.bodyGroup.rotation.x > 1.4 && r.bodyGroup.rotation.x < 1.65, 'flat on its face');
  assert.ok(Math.abs(r.head.rotation.y) > 1, 'its head turned to one side');
  const lying = r.bodyGroup.rotation.toArray(); r.die(1, 9); assert.deepEqual(r.bodyGroup.rotation.toArray(), lying, 'and it stays so');
  const a = makeTowelReturn(kit, 2), b = makeTowelReturn(kit, 2); a.die(0.75, 4.2); b.die(0.75, 4.2);
  assert.deepEqual(a.head.rotation.toArray(), b.head.rotation.toArray(), 'nothing random');
});
