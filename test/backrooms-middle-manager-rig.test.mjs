// The middle manager's body (cast/middle-manager.rig.js): placed by the cast, turned and posed by the rig; fatter swaps the
// thin body for the full one; swelling lifts its arms; going off, it swells on and then is not there; nothing random.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`, import.meta.url);
const [{ createKit }, { makeMiddleManager, BODY, faceFor, turnedAt, reelAt }, { bend }, MODEL] = await Promise.all([
  import('../public/world/backrooms/kit.js'), import('../public/world/backrooms/cast/middle-manager.rig.js'), import('../public/world/backrooms/cast/middle-manager.rule.js'),
  import('../public/world/backrooms/cast/middle-manager.model.js'),
]);
const snap = (g) => g.children.map((k) => [k.visible, ...k.position.toArray().map((v) => +v.toFixed(6)), ...k.quaternion.toArray().map((v) => +v.toFixed(6))]);

test('the cast keeps its place; the rig turns it to its heading and stands it on the floor', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const m = makeMiddleManager(kit);
  m.group.position.set(3, 0.5, -2);
  m.pose({ time: 1, heading: 0.8, lean: bend(2.6, BODY), me: { x: 6, z: 1 } });
  assert.deepEqual(m.group.position.toArray(), [3, 0.5, -2]);
  assert.ok(Math.abs(m.group.rotation.y - 0.8) < 1e-9);
  let low = Infinity; m.group.children.forEach((k) => { if (k.visible) low = Math.min(low, k.position.y); });
  assert.ok(low > 0 && low < 0.15, `its lowest joint, the ankles, just off the floor: ${low}`);
});

test('fat: past half the full body is drawn instead of the thin; swelling throws its arms out from its sides', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const m = makeMiddleManager(kit), [thin, full] = m.group.children;
  m.pose({ time: 1, fat: 0.2 }); assert.ok(thin.visible && !full.visible);
  m.pose({ time: 1.1, fat: 0.7 }); assert.ok(!thin.visible && full.visible);
  const handX = () => { const xs = m.group.children.filter((k) => k.name === 'hand' && k.visible).map((k) => Math.abs(k.position.x)); return Math.min(...xs); };
  m.pose({ time: 2, fat: 0.3, mode: 'stands' }); const hang = handX();
  m.pose({ time: 2, fat: 0.3, mode: 'swells', swell: 1 }); assert.ok(handX() > hang + 0.2, 'hands out from its sides');
});

test('going off: it swells on, then nothing of it is left; posed again (a fresh one), it is whole; same moment, same pose', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const m = makeMiddleManager(kit), [thin] = m.group.children;
  m.pose({ time: 3, fat: 0.3, mode: 'swells', swell: 1 }); const before = thin.scale.x;
  m.burst(0.07, 3.1); assert.ok(thin.scale.x > before * 1.1);
  m.burst(0.5, 3.4); assert.ok(m.group.children.every((k) => !k.visible));
  m.pose({ time: 4, fat: 0.3 }); assert.ok(thin.visible);
  const a = makeMiddleManager(kit), b = makeMiddleManager(kit);
  for (const r of [a, b]) { r.pose({ time: 0 }); r.pose({ time: 0.5, speed: 1.2, fat: 0.4, mode: 'comes', lean: 0.6, heading: 1, me: { x: 2, z: 2 } }); }
  assert.deepEqual(snap(a.group), snap(b.group));
});

test('its face goes from sad to the grin as it is fed, and it grins swelling; one head shown at a time', (t) => {
  assert.deepEqual([0, 0.21, 0.22, 0.5, 0.79, 0.8, 1].map((f) => faceFor(f)), [0, 0, 1, 2, 2, 3, 3]);
  assert.equal(faceFor(0, 0.1), 3, 'swelling: the grin');
  const kit = createKit(); t.after(() => kit.dispose());
  const m = makeMiddleManager(kit), faces = MODEL.FACES ?? 1;
  for (const [fat, mode, want] of [[0, 'stands', 0], [0.3, 'comes', 1], [0.6, 'stands', 2], [0.3, 'swells', 3]]) {
    m.pose({ time: 1, fat, mode, swell: mode === 'swells' ? 0.4 : 0 });
    assert.equal(m.face, Math.min(want, faces - 1));
  }
  m.pose({ time: 1, face: 0, fat: 0.9 }); assert.equal(m.face, 0, 'the cast may say which');
});

test('fed, its head swells and near full its neck and hands turn; cut, it reels up off its stoop with its arms out, and comes back', (t) => {
  const kit = createKit(); t.after(() => kit.dispose());
  const m = makeMiddleManager(kit), head = () => m.group.children.find((k) => k.name === 'head' && k.visible);
  m.pose({ time: 1, fat: 0 }); const h0 = head().scale.x;
  m.pose({ time: 1, fat: 0.7 }); assert.ok(head().scale.x > h0 * 1.25, 'the head swells');
  assert.equal(turnedAt(0.79), false); assert.equal(turnedAt(0.8), true); assert.equal(turnedAt(0.2, 0.1), true);
  const shown = () => m.group.children.filter((k) => k.name === 'hand' && k.visible).length;
  m.pose({ time: 1, fat: 0.85 }); assert.equal(shown(), 2, 'one hand each side, the turned ones');
  assert.equal(reelAt(Infinity), 0); assert.ok(reelAt(0.1) > 0.5); assert.equal(reelAt(5), 0);
  const r = makeMiddleManager(kit);
  r.pose({ time: 0, fat: 0.3, lean: 0.8 }); const bent = r.group.children.find((k) => k.name === 'body' && k.visible).quaternion.clone();
  r.pose({ time: 0, fat: 0.3, lean: 0.8, hurt: 0.12 }); const reeled = r.group.children.find((k) => k.name === 'body' && k.visible).quaternion.clone();
  assert.ok(reeled.angleTo(bent) > 0.3, 'up and back off its stoop');
});
