// What is held in the hand is drawn over the room. With the Graphics setting's haze on, the room's depth is read after
// the picture is drawn (vhs.js): a held thing must leave it there, and must itself read as too near to be hazed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
const root = new URL('../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`, import.meta.url);
const { holdInFront, letGoOfFront, HELD_DEPTH_SLIVER } = await import('../public/world/backrooms/hand.js');
const { profile, GRAPHICS } = await import('../public/world/backrooms/graphics.js');

/** A renderer that only writes down what was asked of it. target: what getRenderTarget() returns. */
function fakeRenderer(target) {
  const calls = [];
  return {
    calls,
    getRenderTarget: () => target,
    getContext: () => ({ depthRange: (a, b) => calls.push(['depthRange', a, b]) }),
    state: { buffers: { depth: { setMask: (on) => calls.push(['setMask', on]) } } },
    clearDepth: () => calls.push(['clearDepth']),
  };
}

test('with nothing reading the depth (classic: no depth texture), a held thing clears the room\'s depth as it always did', () => {
  for (const target of [null, { depthTexture: null }]) {
    const r = fakeRenderer(target);
    assert.equal(holdInFront(r), 'cleared');
    letGoOfFront(r);
    assert.deepEqual(r.calls, [['setMask', true], ['clearDepth']], 'the depth range is never touched');
    const part = fakeRenderer(target);
    assert.equal(holdInFront(part, false), 'as-drawn');
    letGoOfFront(part);
    assert.deepEqual(part.calls, [], 'a part of it (the balloon\'s glove) is drawn exactly as before');
  }
});

test('with the haze reading the depth, a held thing keeps the room\'s depth and draws into a near sliver, then puts the range back', () => {
  for (const first of [true, false]) {
    const r = fakeRenderer({ depthTexture: {} });
    assert.equal(holdInFront(r, first), 'sliver');
    letGoOfFront(r);
    assert.deepEqual(r.calls, [['depthRange', 0, HELD_DEPTH_SLIVER], ['depthRange', 0, 1]], 'no clearDepth: the haze still has the room');
    letGoOfFront(r);
    assert.equal(r.calls.length, 2, 'putting it back is done once');
  }
});

test('the sliver reads, to the haze, as nearer than where the haze begins (8 m), for any camera the level uses', () => {
  // vhs.js: z = near·far / (far − d·(far − near)); haze is 0 below 8 m. The level's camera: near 0.06, far 170.
  for (const [near, far] of [[0.06, 170], [0.05, 400], [0.1, 1000]]) {
    const z = (near * far) / (far - HELD_DEPTH_SLIVER * (far - near));
    assert.ok(z < near * 1.01 && z < 8, `${near}/${far}: ${z}`);
  }
});

test('the depth texture the sliver is for exists only on tiers with haze; classic has none', () => {
  // vhs.js setProfile: a depth texture on the camcorder's targets exactly when p.haze > 0
  assert.equal(profile('classic').haze, 0);
  for (const g of GRAPHICS) assert.equal(profile(g).haze > 0, ['medium', 'high', 'auto'].includes(g), g);
});
