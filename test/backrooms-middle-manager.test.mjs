// The middle manager (cast/middle-manager.rule.js): a look in the eye brings it, every look leaves it fatter and slower,
// near you or full it goes off as far as it has grown; a jab sets it off there and then; it bends to fit under a ceiling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MANAGER as M, fresh, minds, eyed, off, popped, topSpeed, reach, blastAt, bend, crown as crownAt } from '../public/world/backrooms/cast/middle-manager.rule.js';
import * as MODEL from '../public/world/backrooms/cast/middle-manager.model.js';
import { CAST } from '../public/world/backrooms/cast.js';
import { TIER, healthOf } from '../public/world/backrooms/cast/health.rule.js';
import { WARNINGS } from '../public/world/backrooms/drawings.js';

const dt = 1 / 30;
const run = (s, secs, sense) => { for (let t = 0; t < secs - 1e-9; t += dt) s = minds(s, dt, typeof sense === 'function' ? sense(s) : sense); return s; };

test('looked in the eye it comes; looked away from, it stops; a glance across it is nothing', () => {
  let s = run(fresh(), M.takes * 0.8, { eyed: true, d: 10 });
  assert.equal(s.mode, 'stands', 'a glance');
  s = run(fresh(), 0.25, { eyed: false, d: 10 });
  assert.equal(s.mode, 'stands');
  s = run(fresh(), 1.5, { eyed: true, d: 10 });
  assert.equal(s.mode, 'comes'); assert.ok(s.speed > 2 && s.speed <= topSpeed(s.fat) + 1e-9);
  // it does not stop the instant your eye leaves it, and then it does
  s = run(s, M.lets * 0.5, { eyed: false, d: 10 }); assert.equal(s.mode, 'comes');
  s = run(s, 1, { eyed: false, d: 10 }); assert.equal(s.mode, 'stands'); assert.equal(s.speed, 0);
  // the eye: the middle of the picture, nothing between, not too far
  assert.equal(eyed(0.1, 5, true), true); assert.equal(eyed(0.1, 5, false), false); assert.equal(eyed(0.1, M.far + 1, true), false);
  assert.equal(eyed(0.6, 5, true), false, 'out of the corner of your eye');
});

test('every meeting leaves it fatter and it keeps it; fatter is slower; thin it can be outrun, only just', () => {
  assert.ok(M.quick < 3.7 && M.quick > 2.05, 'faster than a walk, slower than a hurry');
  assert.ok(topSpeed(1) < topSpeed(0.5) && topSpeed(0.5) < topSpeed(0));
  let s = fresh(), fats = [];
  for (let k = 0; k < 4; k++) { s = run(s, 0.4, { eyed: true, d: 12 }); s = run(s, 1, { eyed: false, d: 12 }); fats.push(s.fat); }
  for (let k = 1; k < fats.length; k++) assert.ok(fats[k] > fats[k - 1], 'each look adds to it');
  assert.ok(Math.abs(fats[0] - (M.meeting + M.stare * (0.4 - M.takes))) < 0.02, 'a meeting, and the seconds of it');
  const kept = run(s, 30, { eyed: false, d: 12 }); assert.equal(kept.fat, s.fat, 'it does not lose it');
});

test('near you it stops and goes off a moment later; a shove in that moment puts it off; full it goes off where it is', () => {
  let s = run(fresh(), 1, { eyed: true, d: 6 });
  s = minds(s, dt, { eyed: true, d: M.near - 0.1 }); assert.equal(s.mode, 'swells'); assert.equal(s.swelling, true); assert.equal(s.speed, 0);
  const shoved = off(s); assert.equal(shoved.mode, 'stands'); assert.equal(shoved.fat, s.fat);
  let gone = null; for (let t = 0; t < 2 && !gone; t += dt) { s = minds(s, dt, { eyed: false, d: M.near - 0.1 }); if (s.bursts) gone = t; }
  assert.ok(gone !== null && Math.abs(gone - M.swells) < 0.1, `it went off ${gone}`); assert.ok(M.swells >= 1, 'a second of warning: it is seen to swell before it goes'); assert.equal(s.mode, 'gone');
  assert.equal(minds(s, dt, { eyed: true, d: 1 }).bursts, false, 'once');
  // full: it does not need to be near
  let f = { ...fresh(), fat: 1 }; f = minds(f, dt, { eyed: false, d: 30 }); assert.equal(f.mode, 'swells');
  f = run(f, M.ripens + 0.1, { eyed: false, d: 30 }); assert.equal(f.mode, 'gone');
});

test('what it goes off with is what it has put on; a jab sets it off at once, and it takes one', () => {
  assert.ok(reach(0) < reach(0.5) && reach(0.5) < reach(1));
  assert.equal(blastAt(0, M.near), 1, 'thin, near: a heart'); assert.equal(blastAt(0, reach(0) + 0.1), 0);
  assert.equal(blastAt(1, 1), 2); assert.equal(blastAt(1, reach(1) * 0.75), 1); assert.equal(blastAt(1, reach(1) + 0.1), 0);
  assert.ok(blastAt(0, 1.0) >= 1, 'a jab is at arm\'s length: inside even a thin one');
  const p = popped({ ...fresh(), fat: 0.3 }); assert.equal(p.mode, 'gone'); assert.equal(p.bursts, true); assert.equal(p.fat, 0.3);
  assert.equal(TIER['middle-manager'], 'basic'); assert.equal(healthOf('middle-manager'), 1);
});

test('it is three metres and bends under a ceiling, further through a doorway, and its head is never in either', () => {
  const body = { hip: (MODEL.THIGH + MODEL.SHIN + MODEL.SHOE) * MODEL.S, torso: MODEL.TORSO * MODEL.S, neck: MODEL.NECK * MODEL.S, head: MODEL.HEAD * MODEL.S };
  assert.ok(MODEL.STANDS >= 2.8 && MODEL.STANDS <= 3.2, `it stands ${MODEL.STANDS}`);
  assert.equal(bend(MODEL.STANDS + 0.5, body), 0, 'under a high ceiling it stands straight');
  const at = (h) => bend(h, body), crown = (a) => crownAt(a, body);
  assert.ok(Math.abs(crownAt(0, body) - MODEL.STANDS) < 1e-9, 'straight up, the crown is its height');
  assert.ok(at(2.7) > 0.2 && at(2.7) < 0.75, `an ordinary ceiling: a stoop (${at(2.7).toFixed(2)})`);
  assert.ok(at(2.1) > at(2.7) && at(M.ducks) > at(2.1));
  for (const h of [3.2, 2.9, 2.7, 2.5, 2.3, 2.1, M.ducks]) assert.ok(crown(at(h)) <= h - M.clear + 1e-6, `${h}: its head is under it`);
});

test('its line: it hunts, roams, is met further down, fears fire; a drawing warns of it; its file stands in a doorway no longer than it should', () => {
  const m = CAST.find((k) => k.id === 'middle-manager');
  assert.ok(m && m.disposition === 'hunts' && m.home === 'roams' && m.deep === true && m.weight > 0 && m.fire === 'fears' && !m.heavy);
  assert.ok(WARNINGS['middle-manager'].length >= 3);
  for (const lines of WARNINGS['middle-manager']) assert.ok(!lines.join(' ').includes(m.rule.toUpperCase().slice(0, 20)));
  const src = readFileSync(new URL('../public/world/backrooms/cast/middle-manager.js', import.meta.url), 'utf8');
  // nobody keeps a doorway (doorway.rule.js): it asks, every moment it stands, and goes a room away when it is due
  assert.match(src, /kept = camps\(kept, dt, dw, c\.R\);/); assert.match(src, /if \(kept\.due && !leaving\) \{ const to = away\(dw\);/);
  // a jab sets it off before the count takes it (once it is dying it lands nothing: the burst has to come first)
  assert.match(src, /s = popped\(s\); burst\(\);\s+c\.struck\(HEALTH\.jab\);/);
  // no face: its head is three pale tones of one smooth egg and nothing else (the owner: "no hair or glasses.and no face")
  const head = MODEL.headVox(), tones = new Set(); head.each((x, y, z, c) => tones.add(c & 0xffffff));
  assert.ok(tones.size <= 3, `its head is ${tones.size} colours`);
  for (const c of tones) assert.ok(((c >> 16) & 255) > 190 && ((c >> 8) & 255) > 190 && (c & 255) > 180, 'pale, all of it');
});
