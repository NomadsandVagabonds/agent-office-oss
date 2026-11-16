// The dev page's measuring tape (public/world/dev/perf.js) rests on a few sums that do not need a browser: the tour of a
// floor is fixed by its seed, the percentiles are the samples' own, and a result always has the same shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../public/world/backrooms/gen.js';
import { percentile, summarize, countStats, stations, tourSeconds, yawAt, drawFlags, benchReport, summaryText, DRAW_FLAGS, SETTLE_S, SPIN_S } from '../public/world/dev/perf-stats.js';

const office = { name: 'Robin', projects: ['Webstore', 'Infra'], agents: ['Ivory Marten', 'Amber Vireo'], tasks: ['Trim the Docker image'] };

test('the tour is fixed by the seed: the same stations for the same seed, where you land first, then each oddity at its door and its centre', () => {
  for (const seed of [7, 21, 88]) {
    const a = stations(generate(seed, office)), b = stations(generate(seed, office));
    assert.deepEqual(a, b);
    const level = generate(seed, office), odd = level.rooms.filter((r) => r.kind === 'special');
    assert.equal(a.length, 1 + 2 * odd.length);
    assert.equal(a[0].arch, 'start');
    assert.equal(a[0].room, level.rooms.find((r) => r.kind === 'start').id);
    odd.forEach((r, i) => {
      const [door, mid] = [a[1 + 2 * i], a[2 + 2 * i]];
      assert.equal(door.room, r.id); assert.equal(mid.room, r.id); assert.equal(door.arch, r.arch);
      assert.equal(door.what, 'door'); assert.equal(door.spin, 0); assert.ok(door.z > 0 && door.z < r.D / 2, 'just inside the door, in the room');
      assert.equal(mid.what, 'centre'); assert.equal(mid.x, 0); assert.equal(mid.z, 0); assert.equal(mid.spin, Math.PI * 2); assert.equal(mid.hold, SPIN_S);
    });
    assert.ok(tourSeconds(a) < 90, `seed ${seed}: the tour takes ${tourSeconds(a)} s`);
  }
  assert.notDeepEqual(stations(generate(7, office)), stations(generate(21, office)));
});

test('a station turns evenly through one circle and then holds', () => {
  const st = { yaw: 0.5, spin: Math.PI * 2, hold: 4, settle: SETTLE_S };
  assert.equal(yawAt(st, -1), 0.5);
  assert.equal(yawAt(st, 0), 0.5);
  assert.ok(Math.abs(yawAt(st, 2) - (0.5 + Math.PI)) < 1e-9);
  assert.ok(Math.abs(yawAt(st, 4) - (0.5 + Math.PI * 2)) < 1e-9);
  assert.equal(yawAt(st, 9), yawAt(st, 4));
  assert.equal(yawAt({ yaw: 0, spin: 0, hold: 1.5 }, 1), 0);
});

test('percentiles are by nearest rank, always one of the samples', () => {
  const xs = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(xs, 50), 50);
  assert.equal(percentile(xs, 95), 95);
  assert.equal(percentile(xs, 99), 99);
  assert.equal(percentile(xs, 100), 100);
  assert.equal(percentile(xs, 0), 1);
  assert.equal(percentile([7], 95), 7);
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([10, 20, 30, 40], 50), 20);
  const s = summarize([30, 10, 20, 40, NaN]);
  assert.deepEqual(s, { n: 4, mean: 25, p50: 20, p95: 40, p99: 40, worst: 40 });
  assert.deepEqual(summarize([]), { n: 0, mean: null, p50: null, p95: null, p99: null, worst: null });
  assert.deepEqual(summarize([16.66, 16.68]), { n: 2, mean: 16.7, p50: 16.7, p95: 16.7, p99: 16.7, worst: 16.7 });
  assert.deepEqual(countStats([10, 20, 31]), { mean: 20, max: 31 });
  assert.deepEqual(countStats([]), { mean: null, max: null });
});

test('only the flags that change the picture go with a result', () => {
  const flags = drawFlags(new URLSearchParams('seed=7&vhs=0&mute=1&bench=1&dpr=2&perf=1&lighting=dim'));
  assert.deepEqual(flags, { seed: '7', vhs: '0', dpr: '2', lighting: 'dim' });
  assert.ok(!DRAW_FLAGS.includes('mute') && !DRAW_FLAGS.includes('bench'));
});

test('a result has the same shape every time: per station and overall, frame times and what was drawn', () => {
  const list = stations(generate(21, office));
  const frames = list.flatMap((_, i) => [16, 17, 33].map((ms, k) => ({ ms, calls: 40 + k, tris: 1000 * (k + 1), station: i })));
  const r = benchReport({ seed: 21, flags: { seed: '21' }, ua: 'ua', gpu: 'gpu', sizes: { picture: '720x540', canvas: '1280x720', dpr: 1, devicePixelRatio: 2, vhs: 2 },
    list, frames, stood: list.map((st) => st.room), seconds: 61.24 });
  assert.deepEqual(Object.keys(r), ['bench', 'seed', 'flags', 'ua', 'gpu', 'sizes', 'seconds', 'aborted', 'stations', 'overall']);
  assert.equal(r.seed, '21'); assert.equal(r.seconds, 61.2); assert.equal(r.aborted, null);
  assert.equal(r.stations.length, list.length);
  for (const st of [...r.stations, r.overall]) {
    assert.deepEqual(Object.keys(st.ms), ['n', 'mean', 'p50', 'p95', 'p99', 'worst']);
    assert.deepEqual(Object.keys(st.calls), ['mean', 'max']);
    assert.deepEqual(Object.keys(st.tris), ['mean', 'max']);
  }
  assert.deepEqual(Object.keys(r.stations[0]), ['i', 'room', 'arch', 'what', 'stood', 'frames', 'ms', 'calls', 'tris']);
  assert.equal(r.stations[0].frames, 3);
  assert.deepEqual(r.stations[0].ms, { n: 3, mean: 22, p50: 17, p95: 33, p99: 33, worst: 33 });
  assert.deepEqual(r.overall.calls, { mean: 41, max: 42 });
  assert.equal(r.overall.frames, frames.length);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r, 'plain data: one line of JSON and back');
  const text = summaryText(r), lines = text.split('\n');
  assert.equal(lines.length, 6 + list.length);
  assert.match(lines[0], /^bench seed 21 · defaults$/);
  assert.match(text, /ALL \d+ frames · ms mean 22 p50 17 p95 33 p99 33 worst 33/);
  // a tour that was cut short still reports, and says so
  const cut = benchReport({ seed: 7, list, frames: [], aborted: 'the visit ended' });
  assert.equal(cut.overall.frames, 0); assert.equal(cut.overall.ms.mean, null);
  assert.match(summaryText(cut), /STOPPED: the visit ended/);
});
