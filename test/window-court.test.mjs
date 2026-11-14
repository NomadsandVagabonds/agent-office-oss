import test from 'node:test';
import assert from 'node:assert/strict';
import { windowCourtLayout, createWindowCourtBehavior, windowCourtFree } from '../public/world/backrooms/window-court-layout.js';

function routeFree(plan, route, open) {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.08);
    for (let j = 0; j <= n; j++) if (!windowCourtFree(plan, a.x + (b.x - a.x) * j / n, a.z + (b.z - a.z) * j / n, 0.225, open)) return false;
  }
  return true;
}

test('Window Court: the ordinary detour stays open before the offer; the shutter only gates the alternate path', () => {
  for (const [W, D, H] of [[20, 24, 10], [23.8, 27.8, 12], [28, 32, 14]]) {
    const plan = windowCourtLayout({ W, D, H });
    assert.ok(plan.windows.every(w => w.y + w.h / 2 < H));
    assert.ok(routeFree(plan, plan.leftRoute, false));
    assert.ok(routeFree(plan, plan.leftRoute, true));
    assert.equal(routeFree(plan, plan.rightRoute, false), false);
    assert.ok(routeFree(plan, plan.rightRoute, true));
    assert.equal(windowCourtFree(plan, 0, 0, 0.225, true), false, 'the retaining rail encloses the actual drop');
    for (const p of [plan.start, plan.holding]) assert.ok(windowCourtFree(plan, p.x, p.z, 0.3, true));
  }
});

test('Window Court: layout is deterministic, leaves real doorway openings, and rejects undersized shells', () => {
  const plan = windowCourtLayout();
  assert.deepEqual(plan, windowCourtLayout());
  assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
  assert.ok(plan.windows.length > 100);
  for (const w of plan.windows) {
    const length = ['front', 'back'].includes(w.side) ? plan.W : plan.D;
    assert.ok(Math.abs(w.at) + w.w / 2 + 0.1 < length / 2);
    assert.ok(w.y + w.h / 2 < plan.H);
    if (w.row === 0 && ['front', 'back'].includes(w.side)) assert.ok(Math.abs(w.at) > 1.7);
  }
  assert.throws(() => windowCourtLayout({ W: 15, D: 28, H: 12 }), RangeError);
});

test('Window Court: waiting causes a finite offer and the guide never crosses a closed shutter', () => {
  const plan = windowCourtLayout(), behavior = createWindowCourtBehavior(plan);
  let moved = false, phaseCount = new Set();
  for (let i = 0; i < 700; i++) {
    const s = behavior.advance(0.1, { inside: true, speed: 0, x: -plan.laneX, z: 6 });
    phaseCount.add(s.phase); moved ||= s.moving;
    assert.equal(s.headYaw, Math.PI / 2, 'head keeps facing the outer wall');
    if (s.gate < 1) assert.ok(s.z >= plan.gateZ + 0.6, 'guide stays before shutter until it is fully open');
    assert.ok(windowCourtFree(plan, s.x, s.z, 0.25, s.gate === 1));
  }
  const s = behavior.read();
  assert.ok(moved); assert.deepEqual([...phaseCount], ['mirror', 'lead', 'open', 'aside', 'hold']);
  assert.equal(s.gate, 1); assert.equal(s.arrived, true); assert.equal(s.phase, 'hold');
  assert.ok(Math.hypot(s.x - plan.holding.x, s.z - plan.holding.z) < 0.03);
});

test('Window Court: approaching the gate offers passage without needing to discover the waiting rule', () => {
  const plan = windowCourtLayout(), behavior = createWindowCourtBehavior(plan);
  const s = behavior.advance(0.1, { inside: true, speed: 2, x: plan.laneX, z: plan.gateZ + 1 });
  assert.equal(s.phase, 'lead'); assert.equal(s.offered, true);
});

test('Window Court: inactive/frozen visits pause; passage remains open on reentry and actor never pursues', () => {
  const plan = windowCourtLayout(), behavior = createWindowCourtBehavior(plan);
  const before = behavior.read();
  for (let i = 0; i < 20; i++) behavior.advance(0.1, { inside: false, x: -999, z: -999 });
  assert.deepEqual(behavior.read(), before);
  behavior.advance(0.1, { inside: true, frozen: true });
  assert.deepEqual(behavior.read(), before);
  for (let i = 0; i < 700; i++) behavior.advance(0.1, { inside: true, speed: 0, x: -plan.laneX, z: 6 });
  const held = behavior.read();
  for (let i = 0; i < 20; i++) behavior.advance(0.1, { inside: false });
  for (let i = 0; i < 50; i++) behavior.advance(0.1, { inside: true, speed: 3, x: -plan.laneX, z: plan.D / 2 - 1 });
  assert.equal(behavior.read().gate, 1);
  assert.equal(behavior.read().x, held.x); assert.equal(behavior.read().z, held.z);
  assert.equal(behavior.read().phase, 'hold');
});
