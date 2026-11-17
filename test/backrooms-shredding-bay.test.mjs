// The Retention Clerk's whistle (rooms/shredding-bay/rule.js): it is how she is heard coming, and the owner found it a loop at
// 3.6 s. It is now about every 9 to 12 s while she is after you, never twice within 6 s whatever the phase, and a pleased one
// for paper never lands on the heels of the last.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHREDDER, createShredderState, stepShredder, releaseShredder } from '../public/world/backrooms/rooms/shredding-bay/rule.js';

/** Run her for `seconds`, calling `o(t, s)` for what is going on, and say when she whistled. */
function run(seconds, o, s = createShredderState(), dt = 0.1) {
  const at = [];
  for (let t = 0; t < seconds; t += dt) { const r = stepShredder(s, { dt, ...o(t, s) }); s = r.state; if (r.whistled || r.chirp) at.push(+t.toFixed(2)); }
  return { at, s };
}

test('after you, she whistles when she wakes and then only every 9 to 12 s', () => {
  const { at } = run(150, () => ({ dist: 6, insideRoom: true }));
  assert.ok(at[0] < 1, 'you hear her coming at once');
  const gaps = at.slice(1).map((t, i) => t - at[i]);
  assert.ok(gaps.length >= 10, 'and she keeps on');
  for (const g of gaps) assert.ok(g >= 8.9 && g <= 12.2, `a gap of ${g} s`);
  assert.ok(new Set(gaps.map((g) => g.toFixed(1))).size > 2, 'varied, not a metronome');
});

test('never twice within 6 s, in any phase, even when paper pleases her right after a whistle', () => {
  for (const feedAt of [0.4, 1, 3, 9.5, 10.6, 21]) {
    const { at } = run(80, (t) => ({ dist: 1.2, insideRoom: true, holdingPaper: t >= feedAt && t < feedAt + 0.2, offeredPaper: t >= feedAt && t < feedAt + 0.2 }));
    for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= SHREDDER.whistleGap - 0.11, `paper at ${feedAt}: ${at[i - 1]} then ${at[i]}`);
  }
});

test('a pleased whistle for paper comes only if she has not just whistled', () => {
  let s = createShredderState();
  const first = stepShredder(s, { dt: 0.1, dist: 6, insideRoom: true });          // wakes
  s = first.state;
  let r; for (let t = 0; t < 1; t += 0.1) { r = stepShredder(s, { dt: 0.1, dist: 6, insideRoom: true }); s = r.state; if (r.whistled) break; }
  const soon = stepShredder(s, { dt: 0.1, dist: 1.2, insideRoom: true, holdingPaper: true, offeredPaper: true });
  assert.equal(soon.atePaper, true); assert.equal(soon.chirp, false, 'she whistled a moment ago');
  const later = stepShredder({ ...s, since: 8 }, { dt: 0.1, dist: 1.2, insideRoom: true, holdingPaper: true, offeredPaper: true });
  assert.equal(later.chirp, true);
});

test('on her way back she whistles less often still, and never within the gap of the last', () => {
  let s = releaseShredder({ ...createShredderState(), phase: 'pulling', caught: true, timer: SHREDDER.pullTime, since: 0 });
  const at = []; for (let t = 0; t < SHREDDER.respite; t += 0.1) { const r = stepShredder(s, { dt: 0.1, dist: 30, insideRoom: false }); s = r.state; if (r.whistled) at.push(t); }
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= SHREDDER.whistleGap - 0.11);
  assert.ok(at.length <= 2, `${at.length} whistles in the ${SHREDDER.respite} s she spends going back`);
});

test('the numbers the owner asked for', () => {
  assert.ok(SHREDDER.whistleEvery - SHREDDER.whistleSpread >= 9 && SHREDDER.whistleEvery + SHREDDER.whistleSpread <= 12);
  assert.equal(SHREDDER.whistleGap, 6);
});
