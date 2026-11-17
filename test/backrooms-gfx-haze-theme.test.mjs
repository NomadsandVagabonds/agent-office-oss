import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { GRAPHICS, profile, gradeOf, NEUTRAL_GRADE, HAZE_K_RANGE, HAZE_FROM_RANGE } from '../public/world/backrooms/graphics.js';
import { THEMES, THEME_IDS } from '../public/world/backrooms/themes.js';

// A kind of floor's share of the haze (themes.js grade.hazeK: times the tier's strength) and where it begins
// (grade.hazeFrom, metres). Absent, every floor's picture is the one it was: the tier's strength times 1, from 8 m.
const pub = new URL('../public/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export function resolve(s,c,next) {
  if (s === 'three') return {url:${JSON.stringify(pub + 'vendor/three.module.min.js')},shortCircuit:true};
  if (s.startsWith('/vendor/')) return {url:${JSON.stringify(pub.slice(0, -1))}+s,shortCircuit:true};
  return next(s,c);
}`), import.meta.url);
const THREE = await import('three');
const { createVhs } = await import('../public/world/backrooms/vhs.js');

const fakeRenderer = () => ({
  autoClear: true, shadowMap: { autoUpdate: true }, state: { buffers: { depth: { setMask() {} } } },
  getPixelRatio: () => 1, getSize: (v) => v.set(1280, 800), getClearAlpha: () => 1, getClearColor: (c) => c.set(0), setClearColor() {},
  getRenderTarget: () => null, setRenderTarget() {}, clear() {}, getContext: () => ({}), render() {},
});

test('absent, a kind of floor keeps the tier\'s haze and the 8 m it has always begun at', () => {
  assert.equal(NEUTRAL_GRADE.hazeK, 1); assert.equal(NEUTRAL_GRADE.hazeFrom, 8);
  for (const id of THEME_IDS) {
    const g = THEMES[id].grade, c = gradeOf(THEMES[id]);
    if (!('hazeK' in g)) assert.equal(c.hazeK, 1, `${id} hazeK`);
    if (!('hazeFrom' in g)) assert.equal(c.hazeFrom, 8, `${id} hazeFrom`);
    assert.ok(c.hazeK >= 0 && c.hazeK <= 2 && c.hazeFrom >= 0 && c.hazeFrom <= 30, id);
  }
  // only the forest sets them today
  assert.deepEqual(THEME_IDS.filter((id) => 'hazeK' in THEMES[id].grade || 'hazeFrom' in THEMES[id].grade), ['forest']);
  assert.deepEqual([gradeOf(undefined).hazeK, gradeOf(undefined).hazeFrom, gradeOf({}).hazeK, gradeOf({ grade: {} }).hazeFrom], [1, 8, 1, 8]);
});

test('clamped: hazeK 0..2, hazeFrom 0..30 m; anything not a number is the default', () => {
  assert.deepEqual([...HAZE_K_RANGE], [0, 2]); assert.deepEqual([...HAZE_FROM_RANGE], [0, 30]);
  const of = (grade) => { const c = gradeOf({ grade }); return [c.hazeK, c.hazeFrom]; };
  assert.deepEqual(of({ hazeK: -1, hazeFrom: -5 }), [0, 0]);
  assert.deepEqual(of({ hazeK: 9, hazeFrom: 400 }), [2, 30]);
  assert.deepEqual(of({ hazeK: 0.25, hazeFrom: 12.5 }), [0.25, 12.5]);
  assert.deepEqual(of({ hazeK: 'x', hazeFrom: NaN }), [1, 8]);
  assert.deepEqual(of({ hazeK: Infinity, hazeFrom: null }), [1, 8]);
});

test('the forest: half the haze or less, a neutral grey colour, beginning further out than 8 m', () => {
  const c = gradeOf(THEMES.forest);
  assert.deepEqual([c.hazeK, c.hazeFrom], [0.5, 12]);
  assert.deepEqual(c.haze, [0.78, 0.78, 0.78], 'grey: no green in the air');
  // the rest of its grade is as the lead set it
  assert.deepEqual([c.lift, c.gamma, c.gain, c.sat], [[0, 0.005, 0.002], [1.01, 1, 1.01], [0.97, 1.01, 0.96], 0.94]);
});

test('vhs.js hands the shader the tier\'s strength times the floor\'s, and where it begins, in either order', () => {
  const vhs = createVhs(fakeRenderer(), new THREE.PerspectiveCamera(), { bloom: true, level: 2, profile: profile('classic') });
  const u = vhs.uniforms;
  assert.deepEqual([u.uHaze.value, u.uHazeFrom.value], [0, 8], 'before anything is said: none, from 8 m');
  for (const tier of GRAPHICS) {
    vhs.setProfile(profile(tier));
    for (const id of THEME_IDS) {
      vhs.setGrade(gradeOf(THEMES[id]));
      const c = gradeOf(THEMES[id]);
      assert.equal(u.uHaze.value, profile(tier).haze * c.hazeK, `${tier}/${id}`);
      assert.equal(u.uHazeFrom.value, c.hazeFrom);
      if (id !== 'forest') assert.deepEqual([u.uHaze.value, u.uHazeFrom.value], [profile(tier).haze, 8], `${tier}/${id}: as before`);
    }
  }
  // the grade first, then the tier (a landing, then the menu): the floor's share is kept
  vhs.setGrade(gradeOf(THEMES.forest)); vhs.setProfile(profile('high'));
  assert.deepEqual([u.uHaze.value, u.uHazeFrom.value], [0.5, 12]);
  vhs.setProfile(profile('medium')); assert.equal(u.uHaze.value, 0.5);
  vhs.setGrade(gradeOf(THEMES.yellow)); assert.deepEqual([u.uHaze.value, u.uHazeFrom.value], [1, 8], 'back on an office floor: all of it, from 8 m');
  // a grade from somewhere else, without the two numbers (the look-dev lab's own): the tier's, from 8 m
  vhs.setGrade(gradeOf(THEMES.forest)); vhs.setGrade({ lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1, haze: [1, 1, 1] });
  assert.deepEqual([u.uHaze.value, u.uHazeFrom.value], [1, 8]);
  vhs.dispose();
});

test('Classic (and Low) are unaffected: no haze, and the depth texture is asked for by the tier alone, whatever the floor says', () => {
  const vhs = createVhs(fakeRenderer(), new THREE.PerspectiveCamera(), { bloom: true, level: 2, profile: profile('classic') });
  for (const id of THEME_IDS) {
    vhs.setGrade(gradeOf(THEMES[id]));
    for (const tier of ['classic', 'low']) {
      vhs.setProfile(profile(tier));
      assert.equal(vhs.uniforms.uHaze.value, 0, `${tier}/${id}`);
    }
    assert.equal(vhs.uniforms.uGrade.value, 1, 'Low grades; Classic does not');
    vhs.setProfile(profile('classic')); assert.equal(vhs.uniforms.uGrade.value, 0);
  }
  vhs.dispose();
  // (the depth texture is still asked for only by the tier: setProfile's `const depth = p.haze > 0`)
  const src = readFileSync(new URL('../public/world/backrooms/vhs.js', import.meta.url), 'utf8');
  assert.match(src, /const depth = p\.haze > 0;/);
  assert.match(src, /if \(uHaze > 0\.0\) c = haze\(c, at\);/, 'no haze at all where the strength is 0');
});

test('the shader: where the haze begins is the one uniform, 8 m by default, in the place the constant was', () => {
  const src = readFileSync(new URL('../public/world/backrooms/vhs.js', import.meta.url), 'utf8');
  assert.match(src, /float k = \(1\.0 - exp\(-max\(z - uHazeFrom, 0\.0\) \* 0\.05\)\) \* 0\.5 \* uHaze;/);
  assert.match(src, /uHazeFrom: \{ value: 8 \}/);
  assert.doesNotMatch(src, /z - 8\.0/);
});
