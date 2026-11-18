// The kiddie lagoon's inverted bathers as a rig of their own (rooms/kiddie-lagoon/rig.js): they kick, a jab makes their
// legs fly apart, and going they fold over and go down under the water, leaving an empty float — moving only what is
// inside the group the room places, and nothing random.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`, import.meta.url);
const [{ createKit }, { makeBather }] = await Promise.all([
  import('../public/world/backrooms/kit.js'), import('../public/world/backrooms/rooms/kiddie-lagoon/rig.js'),
]);

test('a bather has two legs, and the room keeps its group to place', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const b = makeBather(kit, '#ff5c8a');
  assert.equal(b.legs.length, 2);
  b.group.position.set(1, 2, 3); b.group.rotation.z = 0.2;
  b.pose(1.5, 0.4, 1, Infinity); b.die(0.7, 2);
  assert.deepEqual([b.group.position.x, b.group.position.y, b.group.position.z, b.group.rotation.z], [1, 2, 3, 0.2], 'its own place is the room\'s');
});

test('a jab throws its legs apart; after the flinch it kicks as before', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const b = makeBather(kit, '#29b6d8');
  b.pose(3, 0, 0, Infinity); const calm = b.legs.map((l) => l.rotation.z);
  b.pose(3, 0, 0, 0.08); const hit = b.legs.map((l) => l.rotation.z);
  assert.ok(hit[0] < calm[0] - 0.1 && hit[1] > calm[1] + 0.1, 'legs flung apart');
  b.pose(3, 0, 0, 2); assert.deepEqual(b.legs.map((l) => l.rotation.z), calm);
});

test('going, its legs fold over and go down under the water, and the same moment gives the same pose', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const b = makeBather(kit, '#6fd96c');
  b.die(0.5, 1); const mid = b.legs.map((l) => [l.rotation.x, l.position.y]);
  b.die(0.5, 1); assert.deepEqual(b.legs.map((l) => [l.rotation.x, l.position.y]), mid);
  b.die(1, 1);
  for (const l of b.legs) { assert.ok(l.rotation.x > 1, 'folded over'); assert.ok(l.position.y < 0, 'gone under'); assert.equal(l.visible, false); }
  b.pose(0); for (const l of b.legs) assert.equal(l.visible, true, 'posed again, they are back (a fresh floor)');
});
