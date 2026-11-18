// A sticky note's body (cast/sticky-notes.model.js): one sheet glued at the top that bends by its own vertices, a pose
// for each of the cast's modes, nothing drawn while it is on the lens or gone with the hand, and nothing random.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`, import.meta.url);
const [{ createKit }, { makeStickyNote, notePose, bentAt, NOTE_SIZE }] = await Promise.all([
  import('../public/world/backrooms/kit.js'), import('../public/world/backrooms/cast/sticky-notes.model.js'),
]);

test('bent, the sheet keeps its length and curls off the wall; the glued edge does not move', () => {
  assert.deepEqual(bentAt(0, 20), [-0, 0]);
  const [y, z] = bentAt(NOTE_SIZE, 20), from = NOTE_SIZE * 0.22;
  assert.ok(z > 0.01, 'off the wall');
  assert.ok(Math.abs(y) < NOTE_SIZE, 'shorter than flat, as a curl is');
  const [y2, z2] = bentAt(NOTE_SIZE, 1e-9); assert.ok(Math.abs(y2 + NOTE_SIZE) < 1e-9 && z2 === 0);
  // the arc's length: walking the bent sheet adds up to the flat one
  let len = 0, prev = bentAt(from, 20); for (let i = 1; i <= 200; i++) { const s = from + (NOTE_SIZE - from) * i / 200, p = bentAt(s, 20); len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
  assert.ok(Math.abs(len - (NOTE_SIZE - from)) < 1e-4);
});

test('one mesh a note; every mode poses; on the lens or wiped, nothing is drawn here; the cast keeps its group', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const n = makeStickyNote(kit, '#ff7eb6', 2);
  let meshes = 0; n.group.traverse((o) => { if (o.isMesh) meshes++; }); assert.equal(meshes, 1);
  n.group.position.set(1, 2, 3); n.group.rotation.y = 0.4;
  for (const mode of ['wall', 'peel', 'flutter', 'dive', 'knocked']) { n.pose({ mode, t: 0.3, time: 2, heading: 1 }); assert.equal(n.mesh.parent.visible, true, mode); }
  for (const mode of ['stuck', 'wiped']) { n.pose({ mode, t: 0.1, time: 2 }); assert.equal(n.mesh.parent.visible, false, mode); }
  assert.deepEqual([n.group.position.x, n.group.position.y, n.group.position.z, n.group.rotation.y], [1, 2, 3, 0.4]);
});

test('knocked, it comes to rest lying flat; the same moment is the same pose', () => {
  const rest = notePose({ mode: 'knocked', t: 2, time: 5 }, 1);
  assert.ok(Math.abs(rest.pitch + Math.PI / 2) < 1e-9 && Math.abs(rest.k) < 1e-9);
  for (const mode of ['wall', 'peel', 'flutter', 'dive', 'knocked']) assert.deepEqual(notePose({ mode, t: 0.2, time: 3.3, heading: 0.5 }, 3), notePose({ mode, t: 0.2, time: 3.3, heading: 0.5 }, 3));
});

test('it has writing on it: scribble in front of the sheet, ending somewhere else on each note of a room', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const ink = (n) => { const a = n.mesh.geometry.attributes, out = []; for (let i = 0; i < a.position.count; i++) if (a.aAlb.getX(i) < 0.1 && a.aAlb.getZ(i) < 0.2) out.push([a.position.getX(i), a.position.getY(i), a.position.getZ(i)]); return out; };
  const a = makeStickyNote(kit, '#f4e04d', 0), b = makeStickyNote(kit, '#f4e04d', 1);
  a.pose({ mode: 'wall', time: 0 });
  const wa = ink(a);
  assert.ok(wa.length >= 3 * 4 * 4, 'three lines of it');
  assert.ok(wa.every((p) => p[2] > 0.002), 'in front of the paper');
  assert.notDeepEqual(wa.map((p) => p[0]).sort(), ink(b).map((p) => p[0]).sort(), 'another note, other words');
  a.pose({ mode: 'peel', t: 0.5, time: 1 });
  assert.ok(Math.max(...ink(a).map((p) => p[2])) > 0.01, 'and it curls with the sheet');
});
