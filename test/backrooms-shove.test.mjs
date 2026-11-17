// The Backrooms — a shove (shove.rule.js): two hands out in front. It hurts nothing; it pushes what can be pushed back a
// step, and for a moment turns aside a hit that comes from in front. It costs breath.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHOVE, shoveWindow, facing, tryShove, blocks, rankShoveTargets, strikeShove, slide } from '../public/world/backrooms/shove.rule.js';
import { CAST } from '../public/world/backrooms/cast.js';
import { DIFFICULTIES } from '../core/difficulty.mjs';

const read = (p) => fs.readFileSync(new URL(`../public/world/backrooms/${p}`, import.meta.url), 'utf8');

test('a shove costs breath, waits a second, and is not to be had out of breath', () => {
  const fresh = { wind: 1, winded: 0, shoveCool: 0 };
  const got = tryShove(fresh); assert.ok(got.ok && !got.spent); assert.ok(Math.abs(got.wind - (1 - SHOVE.breath)) < 1e-9);
  assert.equal(tryShove({ ...fresh, shoveCool: 0.4 }).ok, false, 'not straight after another');
  assert.equal(tryShove({ ...fresh, winded: 1 }).ok, false, 'not out of breath');
  assert.equal(tryShove({ ...fresh, frozen: true }).ok, false);
  const last = tryShove({ ...fresh, wind: SHOVE.breath / 2 }); assert.ok(last.ok && last.spent && last.wind === 0, 'the last of their breath goes on it, and they are winded');
  let wind = 1, n = 0; while (true) { const g = tryShove({ wind, winded: 0, shoveCool: 0 }); n++; wind = g.wind; if (g.spent) break; }
  assert.ok(n >= 3 && n <= 5, `a full breath is a handful of shoves, not a way of standing one's ground (${n})`);
  assert.ok(SHOVE.cooldown >= 0.8 && SHOVE.rest > SHOVE.cooldown, 'and no breath comes back between one and the next');
});

test('a shove turns aside a hit from in front, for a moment that is longer the easier the visit', () => {
  for (const d of DIFFICULTIES) assert.ok(shoveWindow(d.id) > 0.15 && shoveWindow(d.id) <= 0.5, d.id);
  assert.ok(shoveWindow('easy') > shoveWindow('normal') && shoveWindow('normal') > shoveWindow('hard'));
  assert.equal(shoveWindow('nonsense'), shoveWindow('easy'));
  const me = { x: 0, z: 0, yaw: 0, shoveT: 0.2 }, f = facing(0);
  assert.deepEqual([f.x, f.z].map((v) => Math.round(v)), [0, -1], 'yaw 0 looks down −z, as the player does');
  assert.ok(blocks(me, { x: 0, z: -1 }), 'in front, and near');
  assert.ok(blocks(me, { x: 0.8, z: -0.8 }), 'a little to one side');
  assert.ok(!blocks(me, { x: 0, z: 1 }), 'not from behind');
  assert.ok(!blocks(me, { x: 1.5, z: 0.4 }), 'nor from beside');
  assert.ok(!blocks(me, { x: 0, z: -(SHOVE.blockReach + 0.5) }), 'nor from across the room');
  assert.ok(!blocks({ ...me, shoveT: 0 }, { x: 0, z: -1 }), 'and not a moment late');
  assert.ok(blocks(me, null) && blocks(me, {}), 'what cannot say where it is, is decided by the moment alone');
  assert.ok(blocks(me, { x: 0.05, z: 0.05 }), 'on top of them is in front of them');
});

test('a shove reaches what is in front, near and in a clear line, and moves at most a few things', () => {
  const me = { x: 0, z: 0, y: 1.5, yaw: 0 }, log = [];
  const thing = (id, x, z, extra = {}) => ({ id, x, z, r: 0.3, shove: (dir) => { log.push([id, dir]); return true; }, ...extra });
  const all = [thing('far', 0, -3), thing('near', 0, -1), thing('nearer', 0.2, -0.7), thing('behind', 0, 1), thing('beside', 1.2, 0.2),
    thing('high', 0, -1, { y: 3.2 }), thing('walled', 0.3, -1.1), thing('stubborn', -0.2, -0.9, { shove: () => false }), { id: 'no hands for it', x: 0, z: -0.8 }];
  const los = (ax, az, bx, bz) => !(Math.abs(bx - 0.3) < 1e-9 && Math.abs(bz + 1.1) < 1e-9);
  assert.deepEqual(rankShoveTargets(me, all, los).map((c) => c.id), ['nearer', 'stubborn', 'near']);
  assert.deepEqual(strikeShove(me, all, los), ['nearer', 'near'], 'what takes no notice is not counted');
  for (const [, dir] of log) assert.deepEqual([Math.round(dir.x), Math.round(dir.z)], [0, -1], 'pushed the way they are facing');
  const crowd = Array.from({ length: 8 }, (_, i) => thing('one of ' + i, (i - 4) * 0.1, -0.8));
  assert.equal(strikeShove(me, crowd).length, SHOVE.most);
  assert.deepEqual(strikeShove(me, [thing('breaks', 0, -1, { shove: () => { throw new Error('no'); } })]), [], 'something that goes wrong being pushed is not pushed');
  assert.deepEqual(rankShoveTargets(null, all), []);
});

test('what is pushed goes as far as there is floor for, and no further', () => {
  const at = { x: 0, z: 0 }, dir = { x: 1, z: 0 };
  assert.deepEqual(slide(at, dir, () => true), { x: SHOVE.push, z: 0 });
  const wall = slide(at, dir, (x0, z0, x1) => x1 <= 0.5); assert.ok(wall && wall.x > 0 && wall.x <= 0.5, 'short of the wall');
  assert.equal(slide(at, dir, () => false), null, 'against something, it stays where it is');
});

test('what each of the cast does about it (their own rules)', async () => {
  const H = await import('../public/world/backrooms/cast/head-count.rule.js');
  const turned = H.turned(); assert.equal(turned.mode, 'recounts');
  let s = turned, t = 0; while (s.mode === 'recounts' && t < 10) { s = H.counts(s, { dt: 0.1, d: 0.5 }); assert.ok(!s.took, 'turned aside, its hand is not on anybody'); t += 0.1; }
  assert.ok(Math.abs(t - H.HEADS.turned) < 0.25, `it is ${H.HEADS.turned} s finding its hands, not the whole recount (${t.toFixed(1)})`);
  const M = await import('../public/world/backrooms/cast/standing-meeting.rule.js');
  assert.equal(M.floored({ mode: 'charges', dir: { x: 1, z: 0 } }), null, 'coming, it is not to be stopped');
  assert.equal(M.floored({ mode: 'down' }), null);
  for (const mode of ['files', 'drums']) { const d = M.floored({ mode, dir: null }); assert.equal(d.mode, 'down'); assert.equal(d.rest, M.MEETING.spent, 'over for a moment, not for long'); }
  const I = await import('../public/world/backrooms/cast/intern.rule.js');
  const p = I.pushed({ mode: 'copies', learnt: 20 }); assert.equal(p.mode, 'blank'); assert.equal(p.learnt, 10, 'and it has lost half of what it had learnt');
  assert.ok(!I.copies(p, { dt: 0.1, d: 0.2, sees: true }).took, 'blank, it has nobody');
});

test('the heavy ones are not moved and not turned aside; nothing dies of a shove', () => {
  assert.deepEqual(CAST.filter((m) => m.heavy).map((m) => m.id).sort(), ['carried-interest', 'standing-meeting']);
  const conductor = read('pursuer.js');
  // the hit is turned aside before anything is noted of who took the last heart, and before any health is asked for
  assert.match(conductor, /hurt\(n = 1, from = null\) \{\s+\/\/[^\n]*\n\s+if \(!member\.heavy && env\.blocked\) \{\s+const at = from \|\| k\.it\?\.at\?\.\(\) \|\| null;\s+if \(env\.blocked\(at\)\) \{[^\n]*return \{ landed: false, dead: false, ended: false, blocked: true \}; \}\s+\}\s+\/\/[^\n]*\n\s+const before = taker; taker = k;/);
  assert.match(read('index.js'), /blocked: \(from\) => blocks\(env\.player\?\.me \?\? f\.player\?\.me, from\),/);
  assert.match(conductor, /shoveTargets\(\) \{\s+const out = \[\];\s+for \(const k of live\) \{\s+if \(k\.dead \|\| k\.away\) continue;/);
  assert.ok(!/shoveTargets/.test(read('cast/carried-interest.js')), 'carried interest offers nothing to push');
  for (const id of ['pirate', 'toner', 'mother', 'head-count', 'standing-meeting', 'intern']) {
    const src = read(`cast/${id}.js`), at = src.indexOf('shoveTargets()');
    assert.ok(at > 0, `${id} says what a shove does to it`);
    const body = src.slice(at, src.indexOf('\n    },\n', at));
    assert.ok(!/c\.hurt|\.dead = true|dissolv|env\.end/.test(body), `a shove ends nothing of ${id}`);
  }
  // the more-than-one-bodied say where the hit is coming from
  assert.match(read('cast/toner.js'), /c\.hurt\(TONER\.hitDamage, walker\)/); assert.match(read('cast/mother.js'), /c\.hurt\(WORM\.hurts, \{ x: a\.fx, z: a\.fz \}\)/);
});

test('a click is the scissors if they are in the hand and a shove if not; a thumb\'s hand shoves when there is nothing to use', () => {
  const index = read('index.js'), input = read('input.js'), player = read('player.js');
  assert.match(index, /if \(inventory\?\.held\(\)\?\.type === 'scissors'\) \{ inventory\.snip\(\{ quietMiss: true \}\); return; \}\s+cur\?\.env\.shove\?\.\(\);/);
  assert.match(index, /if \(currentUse\) \{[^\n]*return; \}\s+if \(how\?\.finger\) clickIt\(\);/);
  assert.match(index, /if \(!me \|\| !f\.world \|\| !f\.player\.shove \|\| env\.grip\?\.held\) return \{ ok: false, reason: 'unavailable' \};/, 'no hands for it with something carried');
  assert.match(index, /f\.player\.shove\(shoveWindow\(env\.difficulty\?\.\(\)\)\)/);
  assert.equal((input.match(/o\.use\(\{ finger: true \}\)/g) || []).length, 2);
  assert.match(input, /if \(k === 'e' \|\| k === 'Enter'\) o\.use\(\);/, 'E does not shove');
  assert.match(player, /me\.wind = got\.wind; me\.shoveT = window; me\.shoveCool = SHOVE\.cooldown; me\.shoveRest = SHOVE\.rest; me\.punch = 1;\s+if \(got\.spent\) \{ me\.winded = WIND\.spent; listeners\.winded\?\.\(me\); \}/);
});

test('the visitor themselves: shove after shove runs them out of breath, and standing still between does not pay for the next', async () => {
  const { createPlayer } = await import('../public/world/backrooms/player.js');
  const world = { free: () => true, passable: () => true, floorY: () => 0, headroom: () => 2.6 }, cam = { position: { set() {} }, rotation: { set() {} } };
  const input = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false }, p = createPlayer(world, cam, { x: 0, z: 0, yaw: 0 }, input);
  const run = (seconds) => { for (let t = 0; t < seconds; t += 1 / 60) p.update(1 / 60, t); };
  let told = 0; p.on('winded', () => { told++; });
  assert.equal(p.shove(0.3), true); assert.ok(p.me.shoveT > 0 && p.me.punch > 0);
  assert.equal(p.shove(0.3), false, 'not twice in the same moment');
  run(0.35); assert.equal(p.me.shoveT, 0, 'the moment is over');
  let n = 1; for (let i = 0; i < 8 && !(p.me.winded > 0); i++) { run(SHOVE.cooldown + 0.02); if (p.shove(0.3)) n++; }
  assert.ok(n >= 3 && n <= 5 && p.me.winded > 0 && told === 1, `as fast as they can be had, ${n} of them and they are winded`);
  assert.equal(p.shove(0.3), false, 'and out of breath there is none');
  run(12); assert.equal(p.me.wind, 1); assert.equal(p.shove(0.3), true, 'breath back, and hands with it');
});
