// The Backrooms on a phone — where the thumb stick and the four buttons go on
// screens of different shapes, what a push of the stick means, and that a
// thumb walks unless it means to run. The arithmetic only (touch.rule.js) and
// the legs it drives (player.js); what it looks like is for a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THUMBS, upright, reachOf, zoneOf, inZone, stickOf, placeOf, pictureTop } from '../public/world/backrooms/touch.rule.js';
import { createPlayer } from '../public/world/backrooms/player.js';

/** A screen with the 4:3 picture where vhs.js puts it: in the middle sideways, at `top` upright. */
function screen(w, h, safe = {}) {
  const view = { w, h, safe: { top: 0, right: 0, bottom: 0, left: 0, ...safe } };
  const pw = Math.min(w, (h * 4) / 3), ph = (pw * 3) / 4, top = pictureTop(view);
  return { ...view, picture: { x: (w - pw) / 2, y: top === null ? (h - ph) / 2 : Math.min(top, h - ph), w: pw, h: ph } };
}
const SCREENS = {
  'a phone sideways': screen(844, 390),
  'a phone sideways, with a notch and a home bar': screen(844, 390, { left: 47, right: 47, bottom: 21 }),
  'a small phone sideways': screen(667, 375),
  'a very short window': screen(740, 300),
  'a tablet sideways': screen(1024, 768),
  'a phone upright': screen(390, 844),
  'a phone upright, with a notch and a home bar': screen(390, 844, { top: 47, bottom: 34 }),
  'a small phone upright': screen(360, 640),
  'a tablet upright': screen(768, 1024),
};
const circle = (c, r) => ({ x0: c.x - r, y0: c.y - r, x1: c.x + r, y1: c.y + r });
const apart = (a, ra, b, rb) => Math.hypot(a.x - b.x, a.y - b.y) - ra - rb;

test('on every screen: nothing is off it or under the phone\'s own edges, nothing is smaller than a finger, and no two things touch', () => {
  for (const [name, view] of Object.entries(SCREENS)) {
    const { stick, buttons } = placeOf(view), s = view.safe;
    assert.deepEqual(Object.keys(buttons).sort(), ['crouch', 'jump', 'light', 'use'], name);
    assert.ok(stick.r >= THUMBS.reach.least && stick.r <= THUMBS.reach.most && stick.run > stick.r, `${name}: the ring`);
    const things = [['the stick', stick, stick.r], ...Object.entries(buttons).map(([k, b]) => [k, b, b.d / 2])];
    for (const [what, c, r] of things) {
      const box = circle(c, r);
      assert.ok(box.x0 >= s.left && box.x1 <= view.w - s.right && box.y0 >= s.top && box.y1 <= view.h - s.bottom, `${name}: ${what} is at ${JSON.stringify(box)}`);
      if (what !== 'the stick') assert.ok(c.d >= 44, `${name}: ${what} is ${c.d}px across`);
    }
    for (let i = 0; i < things.length; i++) for (let j = i + 1; j < things.length; j++) {
      assert.ok(apart(things[i][1], things[i][2], things[j][1], things[j][2]) >= 8, `${name}: ${things[i][0]} and ${things[j][0]} are on top of each other`);
    }
    // the left thumb has the stick and the right thumb has the buttons
    assert.ok(stick.x < view.w / 2, name);
    for (const b of Object.values(buttons)) assert.ok(b.x > view.w / 2, name);
    // the stick starts where a finger that lands on it becomes the stick
    assert.ok(inZone(zoneOf(view), stick.x, stick.y), `${name}: the ring is drawn outside the part of the screen that is the stick`);
    for (const [k, b] of Object.entries(buttons)) assert.ok(!inZone(zoneOf(view), b.x, b.y), `${name}: ${k} is where the stick is`);
  }
});

test('a phone held sideways has them in the bars beside the picture, not on it', () => {
  for (const name of ['a phone sideways', 'a phone sideways, with a notch and a home bar']) {
    const view = SCREENS[name], p = view.picture, { stick, buttons } = placeOf(view);
    assert.ok(stick.x + stick.r <= p.x, `${name}: the ring is on the picture`);
    for (const [k, b] of Object.entries(buttons)) assert.ok(b.x - b.d / 2 >= p.x + p.w, `${name}: ${k} is on the picture`);
  }
  // with the whole bar to use: two across, two down. What is in front of you and ducking are under the thumb, the light and a hop above them
  const { buttons } = placeOf(SCREENS['a phone sideways']);
  assert.equal(buttons.use.y, buttons.crouch.y); assert.equal(buttons.light.y, buttons.jump.y);
  assert.equal(buttons.use.x, buttons.light.x); assert.equal(buttons.crouch.x, buttons.jump.x);
  assert.ok(buttons.use.y > buttons.light.y && buttons.use.x < buttons.crouch.x);
  // with a notch's worth of it kept by the phone, there is room for one across: a column, in what is left of the bar
  const notched = SCREENS['a phone sideways, with a notch and a home bar'], column = placeOf(notched).buttons;
  assert.equal(new Set(Object.values(column).map((b) => b.x)).size, 1);
  assert.ok(Object.values(column).every((b) => b.x + b.d / 2 <= notched.w - notched.safe.right));
});

test('where the bar is too narrow for two across they are one column in it; where there is no bar they are over the picture\'s corners, above the pockets', () => {
  const small = SCREENS['a small phone sideways'], sp = small.picture, a = placeOf(small);
  const xs = new Set(Object.values(a.buttons).map((b) => b.x));
  assert.equal(xs.size, 1, 'one column');
  for (const [k, b] of Object.entries(a.buttons)) assert.ok(b.x - b.d / 2 >= sp.x + sp.w - 2, `${k} is on the picture`);
  assert.deepEqual(Object.entries(a.buttons).sort((p, q) => q[1].y - p[1].y).map(([k]) => k), ['crouch', 'use', 'jump', 'light'], 'from the bottom up');
  assert.ok(a.stick.x + a.stick.r - sp.x < a.stick.r, 'the ring is against the edge: most of it is off the picture');
  const tablet = SCREENS['a tablet sideways'], tp = tablet.picture, b = placeOf(tablet), shelf = tp.y + tp.h * THUMBS.pockets;
  assert.equal(tp.w, tablet.w, 'the picture is the whole screen');
  for (const [k, c] of [['the ring', { y: b.stick.y, d: b.stick.r * 2 }], ...Object.entries(b.buttons)]) assert.ok(c.y + c.d / 2 <= shelf, `${k} is over the pockets`);
});

test('a phone held upright has the picture at the top and everything else under it', () => {
  assert.equal(pictureTop(SCREENS['a phone sideways']), null, 'sideways, the picture stays in the middle');
  assert.equal(pictureTop(SCREENS['a tablet sideways']), null);
  for (const name of ['a phone upright', 'a phone upright, with a notch and a home bar', 'a small phone upright', 'a tablet upright']) {
    const view = SCREENS[name], p = view.picture, top = pictureTop(view);
    assert.ok(upright(view), name);
    assert.ok(top >= view.safe.top && top <= view.safe.top + 14, `${name}: ${top}`);
    assert.equal(p.y, top);
    const { stick, buttons } = placeOf(view), under = p.y + p.h;
    assert.ok(stick.y - stick.r >= under, `${name}: the ring is on the picture`);
    for (const [k, b] of Object.entries(buttons)) assert.ok(b.y - b.d / 2 >= under, `${name}: ${k} is on the picture`);
    const zone = zoneOf(view);
    assert.equal(zone.y0, under, 'the stick is anything under the picture, on the left');
    assert.ok(!inZone(zone, 10, p.y + p.h / 2) && inZone(zone, 10, under + 5) && !inZone(zone, view.w * 0.6, under + 5));
  }
});

test('sideways, the stick is the left of the screen below the top strip, and nothing else is', () => {
  const view = SCREENS['a phone sideways'], zone = zoneOf(view);
  assert.ok(inZone(zone, 20, 380) && inZone(zone, 340, 200));
  assert.ok(!inZone(zone, 20, 40), 'the top strip');
  assert.ok(!inZone(zone, 400, 300) && !inZone(zone, 800, 300), 'the right is for looking');
});

test('a push of the stick: nothing at rest, a walk as fast as it is far, a full walk at the ring, a run only well past it', () => {
  const R = 50;
  assert.deepEqual(stickOf(0, 0, R), { x: 0, y: 0, run: false, nub: { x: 0, y: 0 } });
  assert.deepEqual(stickOf(0, 0, 0), { x: 0, y: 0, run: false, nub: { x: 0, y: 0 } });
  const rest = stickOf(3, -4, R);
  assert.deepEqual([rest.x, rest.y, rest.run], [0, 0, false], 'a thumb resting is not a step');
  assert.ok(Math.hypot(rest.nub.x, rest.nub.y) > 4, '(but the thumb is drawn where it is)');
  const half = stickOf(0, -25, R), full = stickOf(0, -50, R), past = stickOf(0, -60, R);
  assert.ok(half.y > 0.3 && half.y < 0.5 && half.x === 0, 'up the screen is forward');
  assert.deepEqual([full.y, full.run], [1, false]);
  assert.deepEqual([past.y, past.run, past.nub.y], [1, false, -50], 'a little past the ring is still a walk, and the thumb is drawn at the ring');
  assert.equal(stickOf(40, 0, R).y, 0); assert.ok(stickOf(40, 0, R).x > 0.7, 'right is right');
  assert.ok(stickOf(0, 40, R).y < -0.7, 'down the screen is backwards');
  const diagonal = stickOf(200, -200, R);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9, 'never longer than 1, whichever way');
  // running: pushed past THUMBS.run of the reach; and then it lasts until the thumb is back inside THUMBS.walk
  assert.ok(THUMBS.run > THUMBS.walk && THUMBS.walk > 1, 'both lines are outside the ring, the run line further out');
  assert.equal(stickOf(0, -(R * THUMBS.run + 1), R).run, true);
  assert.equal(stickOf(0, -(R * THUMBS.run - 1), R).run, false);
  assert.equal(stickOf(0, -(R * THUMBS.run - 1), R, true).run, true, 'already running: easing back a little is not stopping');
  assert.equal(stickOf(0, -(R * THUMBS.walk - 1), R, true).run, false);
  assert.equal(stickOf(R * THUMBS.run + 1, 0, R).run, true, 'in any direction');
});

test('the ring is a size a thumb can use on any screen', () => {
  assert.equal(reachOf({ w: 320, h: 240 }), THUMBS.reach.least);
  assert.equal(reachOf({ w: 2000, h: 1400 }), THUMBS.reach.most);
  const r = reachOf({ w: 844, h: 390 });
  assert.ok(r > THUMBS.reach.least && r < THUMBS.reach.most);
});

/** Legs, on an open floor, pushed by a stick for a second. → how fast they end up going, m/s */
function speedWith(stick, hurry, keys = []) {
  const world = { floorY: () => 0, free: () => true, passable: () => true, headroom: () => 3 };
  const camera = { position: { set() {} }, rotation: { set() {} } };
  const input = { keys: new Set(keys), dx: 0, dy: 0, stick, hurry };
  const player = createPlayer(world, camera, { x: 0, z: 0, yaw: 0 }, input);
  for (let i = 0; i < 60; i++) player.update(1 / 60);
  return player.me.speed;
}

test('a thumb walks: a stick pushed all the way is a walk, and only its `hurry` (or Shift) is a run', () => {
  const walk = speedWith({ x: 0, y: 1 }, false), run = speedWith({ x: 0, y: 1 }, true), shift = speedWith({ x: 0, y: 0 }, false, ['w', 'Shift']), keys = speedWith({ x: 0, y: 0 }, false, ['w']);
  assert.ok(Math.abs(walk - keys) < 0.02, `a full push is W: ${walk} against ${keys}`);
  assert.ok(Math.abs(run - shift) < 0.02, `past the ring is Shift: ${run} against ${shift}`);
  assert.ok(run > walk * 1.5);
  const stroll = speedWith({ x: 0, y: 0.5 }, false);
  assert.ok(Math.abs(stroll - walk / 2) < 0.05, `half a push is half a walk: ${stroll}`);
  // (there are rooms that notice running: 2.32 m/s in the quiet zone, 2.6 by the cables. A walk has to stay under them)
  assert.ok(walk < 2.32, `a walk is ${walk} m/s`);
});

test('the pieces are wired the way they are described: the stick\'s numbers come from one place, and a finger gets no keyboard hints', () => {
  const read = (f) => fs.readFileSync(new URL(`../public/world/backrooms/${f}`, import.meta.url), 'utf8');
  const input = read('input.js'), player = read('player.js'), touch = read('touch.js'), hud = read('hud.js'), index = read('index.js');
  assert.match(input, /import \{ THUMBS, stickOf, inZone \} from '\.\/touch\.rule\.js';/);
  assert.ok(!/stick\.x, input\.stick\.y\) > 0\.9/.test(player) && /const sprintingInput = k\.has\('Shift'\) \|\| input\.hurry;/.test(player), 'the old stick ran whenever it was pushed all the way');
  assert.match(touch, /import \{ placeOf, zoneOf, pictureTop \} from '\.\/touch\.rule\.js';/);
  // no words on them, and nothing a phone would turn into a picture of its own
  assert.ok(!/[←-⇿☀-➿\u{1f300}-\u{1faff}]/u.test(touch.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'a symbol a phone may draw its own way');
  for (const name of ['use', 'light', 'jump', 'crouch']) assert.ok(new RegExp(`\\b${name}: \\[`).test(touch), `${name} has no picture`);
  assert.match(touch, /\.backrooms\.touch \.br-use \{ display: none; \}/, 'the [E] is a key\'s');
  assert.match(touch, /\.backrooms\.is-paused \.br-thumbs, \.backrooms:has\(\.br-inventory\.is-open\) \.br-thumbs \{ visibility: hidden; \}/);
  assert.match(hud, /if \(on && !thumbs\) \{ thumbs = createThumbs\(el\);/, 'nothing is made for a finger until there is one');
  assert.match(index, /vhs\.layout\(stage\.size\.w, stage\.size\.h, hud\.pictureTop\?\.\(stage\.size\)\)/);
  assert.match(index, /light: thumbLight,/);
});

test('on the smallest phones held upright the stick sits clear of the camcorder\'s battery marks; on the others it is where it was', () => {
  const view = (w, h) => ({ w, h, picture: { x: 0, y: 12, w, h: Math.round(w * 0.75) }, safe: { top: 0, right: 0, bottom: 0, left: 0 } });
  const small = placeOf(view(320, 568)).stick, floor = 568 - THUMBS.gap;
  assert.ok(Math.abs((small.y + small.r) - (floor - THUMBS.lift)) < 1e-6, 'the ring ends THUMBS.lift above the bottom');
  assert.ok(small.y + small.r <= 568 - 100, `the ring's bottom is at ${(small.y + small.r).toFixed(0)}: the battery marks are at about 470 there`);
  for (const [w, h] of [[390, 844], [430, 932], [412, 915]]) { const s = placeOf(view(w, h)).stick; assert.ok(Math.abs((s.y + s.r) - (h - THUMBS.gap - h * 0.12)) < 1e-6, `${w}×${h} moved`); }
});
