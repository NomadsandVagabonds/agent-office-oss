// Imported creature rules from Fable's 34b5c98; browser encounters cover co-op targeting.
import test from 'node:test';
import assert from 'node:assert/strict';
test('the lines: asleep until somebody is near or in its room; then it gets up, and does not stop', async () => {
  const { LINES, asleep, minds } = await import('../public/world/backrooms/cast/the-lines.rule.js');
  const far = { d: 30, sees: false, here: false, floor: true, fold: 0, bridge: false };
  let s = asleep();
  for (let i = 0; i < 600; i++) s = minds(s, 0.1, far);
  assert.equal(s.mode, 'asleep', 'a minute of nobody, and it has not stirred');
  assert.equal(minds(s, 0.1, { ...far, d: LINES.wake + 1, sees: true }).mode, 'asleep', 'seen from further off than it wakes at');
  const up = minds(s, 0.1, { ...far, d: LINES.wake - 1, sees: true });
  assert.ok(up.woke && up.mode === 'rising');
  assert.ok(minds(s, 0.1, { ...far, here: true }).woke, 'somebody in its room wakes it, seen or not');
  s = up; let t = 0; while (s.mode === 'rising' && t < 10) { s = minds(s, 0.05, far); assert.equal(s.speed, 0, 'it does not walk while it is getting up'); t += 0.05; }
  assert.equal(s.mode, 'hunt'); assert.ok(Math.abs(t - LINES.rise) < 0.11, `it took ${t} s to get up`);
  for (let i = 0; i < 600; i++) { s = minds(s, 0.1, far); assert.equal(s.mode, 'hunt', 'out of sight and far off, it is still coming'); assert.ok(s.speed > 0); }
});

test('the lines: slower folded, slower still on something laid; one heart a time, and time to get away after', async () => {
  const { LINES, asleep, minds, folded } = await import('../public/world/backrooms/cast/the-lines.rule.js');
  const hunt = { ...asleep(), mode: 'hunt', up: 1 }, at = (o) => minds(hunt, 0.05, { d: 9, sees: true, here: true, floor: true, fold: 0, bridge: false, ...o });
  assert.equal(at({}).speed, LINES.speed); assert.equal(at({ fold: 1 }).speed, LINES.tight); assert.equal(at({ bridge: true }).speed, LINES.onBridge);
  assert.ok(LINES.tight < LINES.speed && LINES.onBridge < LINES.tight && at({ fold: 0.5 }).speed < LINES.speed && at({ fold: 0.5 }).speed > LINES.tight);
  assert.ok(LINES.speed > 2.05 && LINES.speed < 3.7, 'faster than a walk in the open, slower than a hurry');
  assert.equal(folded(4.4, false), 0); assert.equal(folded(2.2, false), 1); assert.equal(folded(4.4, true), 1); assert.ok(folded(3, false) > 0 && folded(3, false) < 1);
  // within reach: one hit, then it stands, and cannot again for a while however near
  let s = minds(hunt, 0.05, { d: LINES.reach - 0.1, sees: true, here: true, floor: true, fold: 0 });
  assert.ok(s.hit && s.mode === 'stun' && s.speed === 0);
  let hits = 0, t = 0; while (t < LINES.again - 0.06) { s = minds(s, 0.05, { d: 0.5, sees: true, here: true, floor: true, fold: 0 }); if (s.hit) hits++; t += 0.05; }
  assert.equal(hits, 0, 'a second hit inside the wait');
  for (let i = 0; i < 10 && !s.hit; i++) s = minds(s, 0.05, { d: 0.5, sees: true, here: true, floor: true, fold: 0 });
  assert.ok(s.hit, 'and after the wait, another');
  assert.ok(!minds(hunt, 0.05, { d: 0.5, sees: false, here: true, floor: true, fold: 0 }).hit, 'not through a wall');
});

test('the lines: with nothing under it, it falls, and is gone for good; and where it sleeps is short of the gap', async () => {
  const { LINES, asleep, minds, sleepsIn } = await import('../public/world/backrooms/cast/the-lines.rule.js');
  const none = { d: 4, sees: true, here: true, floor: false, fold: 0, bridge: false };
  for (const mode of ['hunt', 'stun', 'rising']) { const s = minds({ ...asleep(), mode, up: 1, t: 0.5 }, 0.05, none); assert.ok(s.fell && s.mode === 'falling', `${mode}: the floor taken from under it`); }
  assert.equal(minds(asleep(), 0.05, { ...none, here: false, sees: false }).mode, 'asleep', 'asleep, it is not asked');
  let s = minds({ ...asleep(), mode: 'hunt', up: 1 }, 0.05, none), t = 0, over = 0;
  while (s.mode !== 'gone' && t < 20) { s = minds(s, 0.05, { ...none, floor: true }); assert.ok(!s.hit && s.speed === 0, 'it does nothing on the way down'); if (s.over) over++; t += 0.05; }
  assert.equal(s.mode, 'gone'); assert.equal(over, 1); assert.ok(Math.abs(t - LINES.falls) < 0.11);
  assert.equal(minds(s, 1, { d: 0.2, sees: true, here: true, floor: true, fold: 0 }).mode, 'gone');
  // where it sleeps: two to four doorways before the gap on a long way; on a short one, as far back as there is, but not the landing
  const way = [10, 11, 12, 13, 14, 15, 16], seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(sleepsIn(way, () => i / 200));
  assert.deepEqual([...seen].sort(), [12, 13, 14], 'two, three or four doorways before the last room');
  assert.equal(sleepsIn([10, 11, 12], () => 0.99), 11); assert.equal(sleepsIn([10, 11], () => 0), 11); assert.equal(sleepsIn([10], () => 0), 10); assert.equal(sleepsIn([], () => 0), null);
});

test('Mother: comes over, heaves when near, brings up four or five, and is then content until they have been away', async () => {
  const { MOTHER, WORM, swaying, sways, finds, trodden } = await import('../public/world/backrooms/cast/mother.rule.js');
  let s = swaying();
  assert.ok(!sways(s, { dt: 0.1, d: 20, sees: true }).comes, 'too far off to notice');
  assert.ok(!sways(s, { dt: 0.1, d: 6, sees: false }).comes, 'unseen, it only sways');
  assert.ok(sways(s, { dt: 0.1, d: 6, sees: true }).comes, 'seen and near enough, it comes over');
  assert.equal(sways(s, { dt: 0.1, d: 2, sees: true, fire: true }).mode, 'sway', 'not beside a fire');
  s = sways(s, { dt: 0.1, d: 2, sees: true }); assert.equal(s.mode, 'heave');
  assert.equal(sways(s, { dt: 0.1, d: 2, sees: true, fire: true }).mode, 'sway', 'a fire lit beside it: it swallows them again');
  let up = 0; for (let t = 0; t < MOTHER.heave + 0.2 && !up; t += 0.1) { s = sways(s, { dt: 0.1, d: 2, sees: true }, () => 0.99); up = s.up || 0; }
  assert.equal(up, MOTHER.brood[1]); assert.equal(s.mode, 'content');
  assert.equal(sways({ mode: 'heave', t: MOTHER.heave, rest: 0, been: true }, { dt: 0.1, d: 2, sees: true }, () => 0).up, MOTHER.brood[0]);
  // content: not again while they stay, however long
  for (let t = 0; t < MOTHER.rest + 20; t += 0.5) { s = sways(s, { dt: 0.5, d: 2, sees: true, brood: 0 }); assert.ok(!s.up && !s.comes); }
  assert.equal(s.mode, 'content', 'they never left: it only sways');
  s = sways(s, { dt: 0.5, d: MOTHER.away + 1, sees: false, brood: 0 }); assert.equal(s.mode, 'sway', 'they went away, and it has it in it again');
  assert.equal(sways(s, { dt: 0.1, d: 2, sees: true }).mode, 'heave', 'and they came back');
  // the small ones: blind
  assert.ok(!finds(WORM.reach + 0.1, () => 0), 'the face has moved: a miss whatever the dice say');
  assert.ok(finds(0.2, () => WORM.lands - 0.01) && !finds(0.2, () => WORM.lands + 0.01));
  assert.ok(WORM.lands <= 0.3 && WORM.hurts === 1 && WORM.speed > 2.05 && WORM.speed < 3.7, 'one in four, one heart, faster than a walk and slower than a run');
  // treading on them: the nearest on the floor, in front
  const me = { x: 0, z: 0, yaw: 0 };                       // (yaw 0 looks toward -z)
  assert.equal(trodden(me, [{ x: 0, z: -1 }, { x: 0, z: -0.6 }]), 1);
  assert.equal(trodden(me, [{ x: 0, z: 1 }]), -1, 'not one behind');
  assert.equal(trodden(me, [{ x: 0, z: 0.3 }]), 0, 'but one underfoot, whichever way');
  assert.equal(trodden(me, [{ x: 0, z: -0.6, air: {} }, { x: 0, z: -0.6, dead: true }, { x: 0, z: -(WORM.tread + 0.2) }]), -1, 'not in the air, not twice, not out of reach');
});
