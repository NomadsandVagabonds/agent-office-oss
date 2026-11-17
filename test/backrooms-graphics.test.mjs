import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAPHICS, DEFAULT_GRAPHICS, profile, bloomOn, internalSize, cost, autoStart, autoStep, AUTO, gradeOf, NEUTRAL_GRADE } from '../public/world/backrooms/graphics.js';
import { THEMES, THEME_IDS } from '../public/world/backrooms/themes.js';
import { BACKROOMS_DEFAULTS, BACKROOMS_GRAPHICS, cleanBackroomsSettings } from '../core/backrooms-settings.mjs';

// The camcorder's size as vhs.js worked it out before there was a Graphics setting (copied from it, unchanged).
function before(w, h, ratio, level) {
  const cw = w * ratio, ch = h * ratio;
  let pw = cw, ph = ch, iw, ih;
  if (level > 0) {
    pw = Math.min(cw, (ch * 4) / 3); ph = (pw * 3) / 4;
    ih = Math.round(Math.max(300, Math.min(ph, level === 2 ? 540 : 660))); iw = Math.round((ih * 4) / 3);
  } else { const k = Math.min(1, 1680 / cw); iw = Math.round(cw * k); ih = Math.round(ch * k); }
  return { cw, ch, pw, ph, iw, ih };
}

test('Classic is the level as it was: the same sizes at every Picture level, bloom as the host has it, nothing new switched on', () => {
  const p = profile('classic');
  assert.deepEqual(p, { tier: 'classic', lines: { 0: null, 1: 660, 2: 540 }, supersample: 1, sceneCap: 1680, widthCap: 1680, msaa: 4, bloom: 'host', grade: 0, haze: 0, contact: 0, bounce: 0, detail: true, beamShadows: 0, shadows: 0, doorlight: 0, fixtures: 0 });
  // (detail: true is everything drawn, as it always was: a room's detail batches are hidden only at low)
  // (beamShadows 0: the flashlight casts no shadow, no depth pass is drawn and the kit's shader is as it was: backrooms-gfx-beamshadows)
  for (const [w, h] of [[1280, 800], [1920, 1080], [390, 844], [844, 390], [2560, 1440], [800, 600], [320, 240], [3840, 2160]])
    for (const ratio of [1, 1.5, 2, 3]) for (const level of [0, 1, 2]) {
      const { sw, sh, ...size } = internalSize(w, h, ratio, level, p), was = before(w, h, ratio, level);
      assert.deepEqual(size, was, `${w}x${h}@${ratio} level ${level}`);
      assert.deepEqual([sw, sh], [was.iw, was.ih], 'the scene is drawn at the tape\'s size');
    }
  assert.deepEqual(internalSize(1280, 800, 2, 2), { ...before(1280, 800, 2, 2), sw: 720, sh: 540 }, 'no profile reads as Classic');
  assert.equal(bloomOn(p, true), true); assert.equal(bloomOn(p, false), false);
  assert.equal(DEFAULT_GRAPHICS, 'classic');
});

test('vhs.js leaves the picture alone while grade and haze are 0, and Classic leaves the composer targets as they were', () => {
  const src = readFileSync(new URL('../public/world/backrooms/vhs.js', import.meta.url), 'utf8');
  assert.match(src, /uGrade: \{ value: 0 \}, uHaze: \{ value: 0 \}/);
  assert.match(src, /if \(uHaze > 0\.0\) c = haze\(c, at\);/);
  assert.match(src, /if \(uGrade > 0\.0\) c = grade\(c\);/);
  assert.match(src, /samples: 4 \}/, 'the composer starts at 4x, which is what Classic asks for');
  assert.match(src, /const depth = p\.haze > 0;/, 'a depth texture only for haze');
  assert.match(src, /superPass\.enabled = sw > iw; renderPass\.enabled = !superPass\.enabled;/, 'the scene is drawn as it was unless a tier supersamples');
  assert.match(src, /this\.needsSwap = false; this\.enabled = false;/);
  assert.match(src, /if \(d >= 0\.99999\) return c;/, 'nothing drawn there: the void is not hazed');
});

test('every tier says everything it switches, in range, and the cost only goes up from low to medium to high', () => {
  for (const tier of GRAPHICS) {
    const p = profile(tier);
    for (const k of ['grade', 'haze', 'contact', 'bounce', 'shadows', 'doorlight']) assert.ok(p[k] >= 0 && p[k] <= 1, `${tier}.${k}`);
    assert.ok([true, false, 'host'].includes(p.bloom)); assert.ok([0, 1, 2, 4, 8].includes(p.msaa));
    assert.ok(p.lines[1] >= 300 && p.lines[2] >= 300 && p.lines[0] === null && p.widthCap >= 640 && p.supersample >= 1 && p.supersample <= 2);
  }
  assert.equal(profile('auto').tier, 'medium', 'auto starts at medium');
  assert.equal(profile('nonsense').tier, 'classic');
  assert.notEqual(profile('low').lines, profile('low').lines, 'a fresh object every time');
  const [low, medium, high, classic] = ['low', 'medium', 'high', 'classic'].map(profile);
  for (const [a, b] of [[low, medium], [medium, high]]) {
    for (const lv of [1, 2]) assert.ok(a.lines[lv] <= b.lines[lv]);
    assert.ok(a.widthCap <= b.widthCap && a.msaa <= b.msaa && +a.bloom <= +b.bloom);
    for (const k of ['grade', 'haze', 'contact', 'bounce', 'shadows', 'doorlight']) assert.ok(a[k] <= b[k], k);
    for (const lv of [0, 1, 2]) for (const [w, h, r] of [[1280, 800, 2], [1920, 1080, 1], [390, 844, 3]]) assert.ok(cost(a, lv, w, h, r) <= cost(b, lv, w, h, r));
  }
  for (const lv of [0, 1, 2]) for (const [w, h, r] of [[1280, 800, 2], [1920, 1080, 1], [390, 844, 3]])
    assert.ok(cost(low, lv, w, h, r) <= cost(classic, lv, w, h, r), `low costs no more than classic at level ${lv}`);
  assert.equal(low.bloom, false, 'low never pays for bloom, whatever the host');
  for (const [a, b] of [[low, medium], [medium, high]]) assert.ok(a.supersample <= b.supersample && a.sceneCap <= b.sceneCap);
  assert.equal(low.supersample, 1);
  // the tape and the scene under it are two sizes: medium keeps today's tape and draws the scene larger
  const m = internalSize(1280, 800, 2, 2, medium), hi = internalSize(1280, 800, 2, 2, high);
  assert.deepEqual([m.iw, m.ih, m.sw, m.sh], [720, 540, 1080, 810]);
  assert.deepEqual([hi.iw, hi.ih, hi.sw, hi.sh], [720, 540, 1440, 1080]);
  assert.deepEqual(internalSize(1280, 800, 2, 0, high).sw, internalSize(1280, 800, 2, 0, high).iw, 'the Clean picture is not supersampled');
  assert.ok(internalSize(3840, 2160, 2, 1, high).sw <= high.sceneCap);
});

test('every kind of floor has a grade, gentle, with a neutral one for a floor that has none', () => {
  for (const id of THEME_IDS) {
    const g = THEMES[id].grade;
    assert.ok(g, `${id} has a grade`);
    const c = gradeOf(THEMES[id]);
    for (const v of c.lift) assert.ok(Math.abs(v) <= 0.03, `${id} lift`);
    for (const v of [...c.gamma, ...c.gain]) assert.ok(v >= 0.85 && v <= 1.15, `${id} gamma/gain`);
    assert.ok(c.sat >= 0.8 && c.sat <= 1.15, `${id} sat`);
    // no crushed blacks: what the lift takes off a shadow is a hair at most
    assert.ok(c.lift.reduce((a, b) => a + b, 0) >= -0.005, `${id} does not darken the shadows`);
    for (const v of c.haze) assert.ok(v >= 0 && v <= 1);
  }
  assert.deepEqual(gradeOf(undefined), { ...NEUTRAL_GRADE, lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], haze: [...NEUTRAL_GRADE.haze] });
  assert.deepEqual(gradeOf({ grade: { lift: [1, 2], sat: 'x' } }).lift, [0, 0, 0]);
});

test('the Graphics preference is cleaned and defaulted like the others, from the same list as graphics.js', () => {
  assert.deepEqual(BACKROOMS_GRAPHICS, GRAPHICS);
  assert.equal(BACKROOMS_DEFAULTS.graphics, 'classic');
  assert.equal(cleanBackroomsSettings({}).graphics, 'classic');
  assert.equal(cleanBackroomsSettings({ vhs: 1, mute: true }).graphics, 'classic', 'an old save reads as Classic');
  for (const g of GRAPHICS) assert.equal(cleanBackroomsSettings({ graphics: g }).graphics, g);
  for (const bad of ['ultra', 'HIGH', 2, null, true, ['high']]) assert.equal(cleanBackroomsSettings({ graphics: bad }).graphics, 'classic');
});

// A fake clock: feed autoStep a frame time every 1/60 s from `from` to `to`.
function run(s, from, to, ms, busy = false, log = []) {
  for (let t = from; t < to; t += 1 / 60) { s = autoStep(s, t, typeof ms === 'function' ? ms(t) : ms, busy); if (s.changed) log.push([+t.toFixed(2), s.tier]); }
  return s;
}

test('auto starts at medium and steps down after about 3 s of slow frames, not on a moment of them', () => {
  let s = autoStart(); assert.equal(s.tier, 'medium');
  const log = [];
  s = run(s, 0, 20, (t) => (t % 2 < 1.5 ? 30 : 16), false, log);
  assert.deepEqual(log, [], 'slow for 1.5 s at a time is not slow enough');
  s = run(s, 20, 30, 30, false, log);
  assert.equal(log.length, 1); assert.equal(log[0][1], 'low'); assert.ok(Math.abs(log[0][0] - 23) < 0.1, `stepped at ${log[0][0]}`);
});

test('auto steps back up once after 10 s of quick frames, never within 15 s of the last change, at most three changes', () => {
  const log = [];
  let s = run(autoStart(), 0, 4, 30, false, log);           // down at 3 s
  s = run(s, 4, 18, 8, false, log);                         // quick, but too soon after the change
  assert.deepEqual(log.map((e) => e[1]), ['low']);
  s = run(s, 18, 40, 8, false, log);                        // quick since 4 s; 15 s after the change at 3 s is 18 s
  assert.deepEqual(log.map((e) => e[1]), ['low', 'medium']); assert.ok(Math.abs(log[1][0] - 18) < 0.1);
  s = run(s, 40, 60, 30, false, log);                       // slow again: down a second time
  assert.deepEqual(log.map((e) => e[1]), ['low', 'medium', 'low']);
  s = run(s, 60, 200, 8, false, log);                       // quick for ever: it already went up once
  s = run(s, 200, 260, 30, false, log);
  assert.equal(log.length, 3); assert.equal(s.tier, 'low');
  assert.equal(s.changes, 3);
});

test('auto never thrashes, stays between low and medium, and says nothing while the level is busy building', () => {
  const log = [];
  let s = run(autoStart(), 0, 30, 40, true, log);
  assert.deepEqual(log, [], 'building the next part is not a slow picture');
  s = run(s, 30, 300, (t) => (Math.floor(t / 4) % 2 ? 40 : 6), false, log);
  for (let i = 1; i < log.length; i++) assert.ok(log[i][0] - log[i - 1][0] >= AUTO.gap - 1e-9);
  assert.ok(log.length <= AUTO.most);
  for (const [, tier] of log) assert.ok(['low', 'medium'].includes(tier));
  assert.deepEqual(autoStep(autoStart(), 0, NaN), { ...autoStart(), changed: false });
});

test('index.js hands the tier to the kit, the grade to the camcorder on every landing, and auto the frame time', () => {
  const index = readFileSync(new URL('../public/world/backrooms/index.js', import.meta.url), 'utf8');
  // (the dev page's own &gfx= comes first; otherwise the kit gets what the level of quality says)
  assert.match(index, /createKit\(\{ gfx: opt\.dev\?\.gfx \|\| opt\.gfx \|\| \{ contact: gfx\(\)\.contact, bounce: gfx\(\)\.bounce, shadows: gfx\(\)\.shadows, doorlight: gfx\(\)\.doorlight, fixtures: gfx\(\)\.fixtures \} \}\)/);
  assert.match(index, /vhs\.setGrade\(gradeOf\(themeOf\(f\.level\.theme\)\)\)/);
  assert.match(index, /autoStep\(gfxAuto, time, stage\.frameMs/);
  assert.match(index, /graphics: opt\.graphics \?\? saved\.graphics/);
  const dev = readFileSync(new URL('../public/world/dev/backrooms.js', import.meta.url), 'utf8');
  assert.match(dev, /graphics: q\.get\('graphics'\) \|\| undefined/);
});

test('the Graphics row is offered only to a visit made for looking at the level, until the owner says otherwise', async () => {
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(`../public/world/backrooms/${p}`, import.meta.url), 'utf8');
  assert.match(read('index.js'), /furniture: opt\.barricades !== false, graphics: !!opt\.debug, onRequestOpen/);
  const menu = read('menu.js');
  assert.match(menu, /graphics: offerGraphics = true,/, 'offered unless told not to (the dev page, the tests)');
  assert.match(menu, /if \(offerGraphics\) settingsPage\.append\(h\('div\.br-menu-setting', h\('label', \{ htmlFor: graphics\.id \}, 'Graphics'\), graphics\)\);/);
  assert.match(menu, /fields\.set\('graphics', \{ input: graphics \}\);/, 'and kept and obeyed either way');
});
