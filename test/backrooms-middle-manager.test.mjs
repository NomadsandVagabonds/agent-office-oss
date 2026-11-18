// The middle manager (cast/middle-manager.rule.js): a look in the eye brings it, every look leaves it fatter and slower,
// near you or full it goes off as far as it has grown; a jab sets it off there and then; it bends to fit under a ceiling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MANAGER as M, GOES, CUT, fresh, minds, eyed, off, popped, cut, bloat, topSpeed, reach, blastAt, bend, crown as crownAt } from '../public/world/backrooms/cast/middle-manager.rule.js';
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

test('what it goes off with is what it has put on; it takes two jabs: the first cuts it, the second sets it off', () => {
  assert.ok(reach(0) < reach(0.5) && reach(0.5) < reach(1));
  assert.equal(blastAt(0, M.near), 1, 'thin, near: a heart'); assert.equal(blastAt(0, reach(0) + 0.1), 0);
  assert.equal(blastAt(1, 1), 2); assert.equal(blastAt(1, reach(1) * 0.75), 1); assert.equal(blastAt(1, reach(1) + 0.1), 0);
  assert.ok(blastAt(0, 1.0) >= 1, 'a jab is at arm\'s length: inside even a thin one');
  const p = popped({ ...fresh(), fat: 0.3 }); assert.equal(p.mode, 'gone'); assert.equal(p.bursts, true); assert.equal(p.fat, 0.3);
  assert.equal(TIER['middle-manager'], 'medium'); assert.equal(healthOf('middle-manager'), 2);
  // cut: it lets some of it out, stands, and is put off swelling; it keeps the rest
  const c1 = cut({ ...fresh(), fat: 0.6, mode: 'swells', swell: 0.5 }); assert.equal(c1.mode, 'stands'); assert.ok(Math.abs(c1.fat - (0.6 - CUT.lets)) < 1e-9); assert.equal(c1.swell, 0);
  assert.equal(cut({ ...fresh(), fat: 0.05 }).fat, 0); assert.equal(cut({ ...fresh(), mode: 'gone' }).mode, 'gone');
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
  // its face, as fed as it is (the owner: "starts as Sad face upside down u with tears and as it gets fed it goes from sad to
  // neutral to happy to creepily huge grin and big eyes"): four heads, each different, the egg itself sallow skin, not white
  assert.equal(MODEL.FACES, 4);
  const heads = [0, 1, 2, 3].map((f) => { const m = new Map(); MODEL.headVox(f).each((x, y, z, c) => m.set(`${x},${y},${z}`, c & 0xffffff)); return m; });
  for (let f = 1; f < 4; f++) assert.ok([...heads[f]].some(([k, c]) => heads[f - 1].get(k) !== c), `face ${f} is not face ${f - 1}`);
  const has = (f, hex) => [...heads[f].values()].includes(parseInt(hex.slice(1), 16));
  // the owner, after the first faces: "too cartoony … more glitch/horror/bakcrooms … smeared growing black pupils instead of cartoon white … ones"
  const black = heads.map((m) => [...m.values()].filter((c) => c === 0x0b0a0a).length);
  for (let f = 1; f < 4; f++) assert.ok(black[f] > black[f - 1] * 1.3, `the black grows: ${black}`);
  for (let f = 0; f < 4; f++) for (const c of heads[f].values()) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; assert.ok(!(r > 225 && g > 225 && b > 215), 'nothing white in its face'); if (f < 2) assert.ok(!(r > g + 60), 'unfed, nothing raw'); }
  // fed near to full it turns (the owner: "the skin converts to be similar to what we used on telephone pole monster, mother etc. Like it is getting engorged"):
  // Mother's own reds — some of the head on the smile, nearly all of it on the grin
  const RAW = [0xb4756a, 0xa5645b, 0xc48a7d, 0x8f5148, 0x5e3540, 0x4a2a3c], rawShare = (f) => [...heads[f].values()].filter((c) => RAW.includes(c)).length / heads[f].size;
  assert.equal(rawShare(1), 0); assert.ok(rawShare(2) > 0.05 && rawShare(2) < 0.6, `the smile: blotches (${rawShare(2).toFixed(2)})`); assert.ok(rawShare(3) > 0.7, `the grin: engorged (${rawShare(3).toFixed(2)})`);
  const mother = readFileSync(new URL('../public/world/backrooms/cast/mother.model.js', import.meta.url), 'utf8');
  assert.match(mother, /const RAW = \['#b4756a', '#a5645b', '#c48a7d', '#8f5148'\], BRUISE = '#5e3540'/, 'the same flesh as Mother');
  assert.match(readFileSync(new URL('../public/world/backrooms/cast/middle-manager.rig.js', import.meta.url), 'utf8'), /export const turnedAt = \(fat = 0, swell = 0\) => swell > 0 \|\| fat >= 0\.8;/, 'its neck and hands turn with it');
  assert.ok(has(0, '#2a211e'), 'the dark runs from its eyes, unfed');
  const tones = new Map(); for (const c of heads[1].values()) tones.set(c, (tones.get(c) || 0) + 1);
  const skin = [...tones].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
  for (const c of skin) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; assert.ok(r > 170 && g > 145 && b > 125, 'pale'); assert.ok(r - b > 25, 'skin, not white'); }
  // (drawn by the animation session's rig now: it picks the face, the same thresholds)
  const rig = readFileSync(new URL('../public/world/backrooms/cast/middle-manager.rig.js', import.meta.url), 'utf8');
  assert.match(rig, /export const faceFor = \(fat = 0, swell = 0\) => \(swell > 0 \|\| fat >= 0\.8 \? 3 : fat >= 0\.5 \? 2 : fat >= 0\.22 \? 1 : 0\);/);
  // its tell is its body: nothing of the picture comes from looking at it or being near it, and nothing grows out of it
  const model = readFileSync(new URL('../public/world/backrooms/cast/middle-manager.model.js', import.meta.url), 'utf8');
  assert.ok(!/interfere/.test(src), 'no static from it'); assert.ok(!/tendril|tentacle/i.test(src + model), 'nothing out of its back');
  assert.match(model, /a size too short/);
});

test('the bloat: from nothing to bursting it more than doubles, head and arms and all; near full it heaves; swelling it pulses', () => {
  const thin = bloat(0), full = bloat(1), going = bloat(1, 1, 0.3);
  assert.deepEqual([thin.body, thin.head, thin.arm, thin.hand, thin.leg, thin.neck, thin.tall], [1, 1, 1, 1, 1, 1, 1]);
  assert.ok(full.arm > 2 && full.leg > 2.5 && full.neck > 2 && bloat(0.5).arm < 1.4 && full.head >= 1.4, 'fed, every part of it swells');
  assert.ok(going.body >= 1.6 && going.head > full.head, 'about to go, more still');
  const heave = [0, 0.5, 1, 1.5].map((t) => bloat(1, 0, t).body), still = [0, 0.5, 1, 1.5].map((t) => bloat(0.4, 0, t).body);
  assert.ok(Math.max(...heave) - Math.min(...heave) > 0.04, 'full, it breathes'); assert.ok(still.every((b) => b === 1), 'thin, it does not');
  const pulse = [0, 0.05, 0.1, 0.15].map((t) => bloat(0.5, 1, t).body); assert.ok(Math.max(...pulse) - Math.min(...pulse) > 0.08, 'swelling, it pulses');
  const src = readFileSync(new URL('../public/world/backrooms/cast/middle-manager.js', import.meta.url), 'utf8');
  // the rig is what draws it, from this rule's bloat(), and the creature hands it the state each frame
  const rig = readFileSync(new URL('../public/world/backrooms/cast/middle-manager.rig.js', import.meta.url), 'utf8');
  assert.match(rig, /import \{[^}]*\bbloat\b[^}]*\} from '\.\/middle-manager\.rule\.js'/);
  assert.match(src, /rig = makeMiddleManager\(env\.kit\); group = rig\.group; mat = rig\.mat;/);
  assert.match(src, /rig\.pose\(\{ time: clock, speed: dt > 0 \? moved \/ dt : 0, fat: s\.fat, swell:/);
  // its buttons go a third of the way to going off; cut, a puff of paper comes out of it
  assert.match(src, /s\.swell > Mg\.swells \* 0\.35\) \{ popped2 = true;/); assert.match(src, /count: CUT\.puff/);
});

test('where it may go, and where not: one list, and each line is kept', () => {
  assert.deepEqual(Object.keys(GOES).sort(), ['crawls', 'doors', 'doorways', 'fire', 'firstFloor', 'headroom', 'visitor', 'wayDown']);
  const src = readFileSync(new URL('../public/world/backrooms/cast/middle-manager.js', import.meta.url), 'utf8'), walk = readFileSync(new URL('../public/world/backrooms/cast/walk.js', import.meta.url), 'utf8');
  assert.match(src, /const walker = \{ x: 0, z: 0, r: Mg\.r, tall: Mg\.ducks, opens: false \};/, 'doors: it opens none · headroom and crawls: its walker is as tall as it can fold');
  assert.match(walk, /rt\.def\.crawl && !a\.crawls && !flies\(a\)\) \|\| rt\.def\.H < a\.tall \+ 0\.05/, 'the walker keeps it out of crawls and rooms too low');
  assert.match(walk, /if \(door\?\.isShut \? !a\.opens : !th\.open\) return Infinity;/, '…and behind shut doors');
  assert.match(src, /kept = camps\(kept, dt, dw, c\.R\);/, 'doorways');
  assert.match(src, /level\.rooms\[rid\]\?\.kind === 'exit' \|\| level\.rooms\[rid\]\?\.crawl\) continue;/, 'never out of a doorway into the way down');
  assert.match(src, /fear = afraid\(fear, dt,/, 'fire');
  assert.equal(CAST.find((k) => k.id === 'middle-manager').deep, true, 'not the first floor');
  assert.match(src, /\(roomPath\(level, here\.id, rid\) \|\| \[\]\)\.slice\(1\)\.includes\(mine\)\) continue;/, 'nor through the visitor\'s room');
});
