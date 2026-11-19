// The book's checks on a visit that says it got out (the owner, 19 Nov: prizes for those who make it through, so a
// visit must be one that happened): a ticket the server signed as it went in, time that really passed, one signing a
// ticket, and a route that fits the building it was in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrail, readTrail } from '../core/trail.mjs';
import { issueTicket, checkTicket, ticketKey, TICKET } from '../tools/blockrooms/visit-ticket.mjs';
import { checkVisit } from '../tools/blockrooms/visit-check.mjs';
import { planVisit, floorOf } from '../public/world/backrooms/plan.js';
import { handle } from '../tools/blockrooms/book-api.mjs';

const SEED = 'routecheck7', DIFF = 'easy';

/** A visit walked as a person would: room to room through the doorways that join them, about 2.5 m a second. */
function walk(seed, difficulty) {
  const plan = planVisit(seed, { difficulty }), trail = createTrail();
  let seconds = 0;
  for (let d = 0; d < plan.depths; d++) {
    const L = floorOf(plan, d), byId = new Map(L.rooms.map((r) => [r.id, r]));
    const next = new Map(L.rooms.map((r) => [r.id, []]));
    for (const l of L.links) { next.get(l.a).push([l.b, l]); next.get(l.b).push([l.a, l]); }
    // the way from where you land to the way out
    const from = new Map([[L.start.room, null]]), queue = [L.start.room];
    while (queue.length) { const at = queue.shift(); for (const [to, l] of next.get(at)) if (!from.has(to)) { from.set(to, [at, l]); queue.push(to); } }
    const rooms = [L.exit.room]; while (rooms[0] !== L.start.room) rooms.unshift(from.get(rooms[0])[0]);
    const points = [[L.start.x, L.start.z]];
    for (let i = 1; i < rooms.length; i++) {
      const l = from.get(rooms[i])[1], mid = (l.from + l.to) / 2, room = byId.get(rooms[i]);
      points.push(l.axis === 'x' ? [l.at, mid] : [mid, l.at], [room.cx, room.cz]);
    }
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i], dist = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(dist / 2.5));
      for (let k = 1; k <= steps; k++) { trail.at(d, ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps); trail.tick(1); seconds++; }
    }
  }
  return { trail: trail.encode(), seconds, of: plan.depths };
}
const runOf = (w, extra = {}) => ({ seed: SEED, difficulty: DIFF, seconds: w.seconds, parts: { reached: w.of, of: w.of }, ...extra });

test('a route written down is read back the same, to half a metre', () => {
  const t = createTrail();
  t.at(0, 1.26, -3.7); t.tick(1); t.at(0, 2.01, -3.2); t.tick(0.5); t.tick(0.5); t.at(1, -10, 4.4); t.tick(1);
  assert.deepEqual(readTrail(t.encode()), [{ d: 0, x: 1.5, z: -3.5 }, { d: 0, x: 2, z: -3 }, { d: 1, x: -10, z: 4.5 }]);
  assert.equal(readTrail('@0|1,2|<script>'), null);
  assert.equal(readTrail('1,2'), null, 'a sample before any part');
});

test('a route walked through the doorways, part by part, out by the way out, fits its building', async () => {
  const w = walk(SEED, DIFF);
  const v = await checkVisit(runOf(w), w.trail);
  assert.deepEqual(v, { ok: true, verdict: 'ok' }, JSON.stringify(v));
});

test('a route that does not fit is marked, with why: a leap, a straight line through walls, a part skipped', async () => {
  const w = walk(SEED, DIFF), plan = planVisit(SEED, { difficulty: DIFF });
  // straight from where you land to the way out on every part, through whatever is in the way
  const t = createTrail(); let s = 0;
  for (let d = 0; d < plan.depths; d++) {
    const L = floorOf(plan, d), out = L.rooms.find((r) => r.id === L.exit.room);
    for (let k = 0; k <= 10; k++) { t.at(d, L.start.x + ((out.cx - L.start.x) * k) / 10, L.start.z + ((out.cz - L.start.z) * k) / 10); t.tick(1); s++; }
  }
  const straight = await checkVisit({ ...runOf(w), seconds: s }, t.encode());
  assert.equal(straight.verdict, 'flag'); assert.ok(straight.why.some((y) => /not joined|in no room|faster/.test(y)), straight.why.join(' / '));
  // the first part only, then the last
  const skipped = readTrail(w.trail).filter((p) => p.d === 0 || p.d === plan.depths - 1);
  const t2 = createTrail(); for (const p of skipped) { t2.at(p.d, p.x, p.z); t2.tick(1); }
  const skip = await checkVisit({ ...runOf(w), seconds: skipped.length }, t2.encode());
  assert.equal(skip.verdict, 'flag'); assert.ok(skip.why.some((y) => /part 0 to part/.test(y)), skip.why.join(' / '));
  // claiming twice the time the route took
  const slow = await checkVisit({ ...runOf(w), seconds: w.seconds * 2 }, w.trail);
  assert.equal(slow.verdict, 'flag');
  // no route at all is no visit
  assert.equal((await checkVisit(runOf(w), '')).ok, false);
});

test('a ticket: written by the server, for this building, the time really passed, and nothing else will do', () => {
  const key = ticketKey({ salt: 'test-salt' }), t0 = 1_800_000_000_000;
  const ticket = issueTicket(SEED, { key, now: t0 });
  assert.equal(checkTicket(ticket, { seed: SEED, seconds: 300 }, { key, now: t0 + 301_000 }).ok, true);
  assert.equal(checkTicket(ticket, { seed: SEED, seconds: 300 }, { key, now: t0 + 60_000 }).ok, false, 'five minutes claimed in one');
  assert.equal(checkTicket(ticket, { seed: 'other', seconds: 30 }, { key, now: t0 + 60_000 }).ok, false, 'another building');
  assert.equal(checkTicket(ticket, { seed: SEED, seconds: 30 }, { key: ticketKey({ salt: 'other' }), now: t0 + 60_000 }).ok, false, 'another key');
  const [body] = ticket.split('.'), forged = `${body}.${'A'.repeat(43)}`;
  assert.equal(checkTicket(forged, { seed: SEED, seconds: 30 }, { key, now: t0 + 60_000 }).ok, false, 'a forged signature');
  assert.equal(checkTicket(ticket, { seed: SEED, seconds: 30 }, { key, now: t0 + (TICKET.keep + 10) * 1000 }).ok, false, 'too old');
  assert.equal(checkTicket(undefined, { seed: SEED, seconds: 30 }, { key, now: t0 }).ok, false, 'no ticket');
});

test('the book: going in gives a ticket; signing needs it, signs once with it, and keeps its verdict out of sight', async () => {
  const lines = []; let clock = 1_800_000_000_000;
  const store = {
    async count() { return { counted: true, counter: { hits: 0, in: 1, out: 0 } }; },
    async sign(entry, _me, duplicate) { if (lines.some((l) => l.dup === duplicate)) return { ok: false, why: 'signed' }; lines.push({ entry, dup: duplicate }); return { ok: true, place: lines.length }; },
  };
  const ctx = { store, salt: 'test-salt', now: () => clock };
  const post = (body) => handle(new Request('https://example.test/api/book', { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }, body: JSON.stringify(body) }), ctx).then((r) => r.json());
  const went = await post({ do: 'in', seed: SEED });
  assert.ok(typeof went.ticket === 'string', 'no ticket on the way in');
  const w = walk(SEED, DIFF);
  const report = { reason: 'exit', seed: SEED, difficulty: DIFF, scoring: 1, seconds: w.seconds, parts: { reached: w.of, of: w.of }, rooms: { explored: 10 * w.of, kinds: [] }, cast: { met: [], survived: 0 }, hearts: { left: 3, of: 4 }, batteries: 1, card: false, trail: w.trail };
  assert.equal((await post({ do: 'sign', name: 'Tester', run: report })).why, 'ticket', 'signed with no ticket');
  assert.equal((await post({ do: 'sign', name: 'Tester', run: report, ticket: went.ticket })).why, 'ticket', 'signed before the time it claims had passed');
  clock += (w.seconds + 5) * 1000;
  const signed = await post({ do: 'sign', name: 'Tester', run: report, ticket: went.ticket });
  assert.equal(signed.ok, true, JSON.stringify(signed));
  assert.equal(signed.entry.check, undefined, 'the verdict is shown to the visitor');
  assert.equal(lines[0].entry.check, 'ok', 'the verdict is not kept with the entry');
  assert.equal((await post({ do: 'sign', name: 'Another', run: report, ticket: went.ticket })).why, 'signed', 'one ticket signed twice');
});

test('the game writes the route down as it goes: where the visitor was, once a second of play, and nothing while not playing', async () => {
  const { createTally } = await import('../public/world/backrooms/tally.js');
  const t = createTally({ seed: SEED, of: 4 });
  t.trace(0, 1, 1); t.tick(0.6, true); t.trace(0, 2, 1); t.tick(0.6, true);   // one second of play: one sample
  t.trace(0, 9, 9); t.tick(5, false);                                          // paused: none
  t.trace(1, -3, 4); t.tick(1, true);
  assert.deepEqual(readTrail(t.report().trail), [{ d: 0, x: 2, z: 1 }, { d: 1, x: -3, z: 4 }]);
});
