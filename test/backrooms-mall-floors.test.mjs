// Whole mall floors (themes.js `mall`), not one room at a time: nothing may wall a doorway off. On the dev page's
// mall floor for seed 5 (with The Orange asked for), a plain room's MALL_WRONG `ride` stood 0.7 m off its right
// wall beside a back doorway in that corner. The walk in was shut, and the level's safety net switched the room's
// collision off ("a doorway of plain #15 could not be reached"). The ride now asks `c.clear` for its spot, as the
// trolleys, the family and the rail do. This builds that floor and three plain-generated ones, and asserts no
// such warning.

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const root = new URL('../', import.meta.url);
register(
  `data:text/javascript,${encodeURIComponent(
    `export function resolve(s,c,next){` +
      `if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};` +
      `if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};` +
      `return next(s,c);` +
    `}`,
  )}`,
  import.meta.url,
);

const [{ createKit }, { DECK, generate }, { planVisit, floorOf }, { buildWorld, loadCatalogue }, { BUILDERS }] = await Promise.all([
  import('../public/world/backrooms/kit.js'),
  import('../public/world/backrooms/gen.js'),
  import('../public/world/backrooms/plan.js'),
  import('../public/world/backrooms/world.js'),
  import('../public/world/backrooms/rooms.js'),
]);

test('whole mall floors build with every doorway of every room reachable (no "could not be reached")', async (t) => {
  const prevDoc = globalThis.document, prevWarn = console.warn, said = [];
  const draw = new Proxy({}, {
    get: (_, k) => k === 'measureText' ? (txt) => ({ width: String(txt).length * 6 })
      : /Gradient|Pattern/.test(k) ? () => ({ addColorStop() {} })
      : /^(get|create)ImageData$/.test(k) ? (a, b, w, h) => ({ data: new Uint8ClampedArray((w ?? a) * (h ?? b) * 4) })
      : () => {},
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ getContext: () => draw, width: 128, height: 128 }) };
  console.warn = (...args) => { said.push(args.join(' ')); };
  t.after(() => { globalThis.document = prevDoc; console.warn = prevWarn; });
  const kit = createKit();
  t.after(() => kit.dispose());
  const catalogue = await loadCatalogue(kit);
  const ids = DECK.filter((a) => a.themes?.mall && a.module).map((a) => a.id);
  const builders = { ...BUILDERS, ...Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await import(`../public/world/backrooms/rooms/${id}.js`)).build]))) };
  const floors = [
    ['dev page, seed 5, The Orange asked for', () => floorOf(planVisit(5, { only: ['the-orange'], themes: ['mall'], pursuer: false, name: 'Robin' }), 0)],
    ...['3', '8', '19'].map((tape) => [`tape ${tape}`, () => generate(tape, { theme: 'mall' })]),
  ];
  for (const [what, make] of floors) {
    said.length = 0;
    const level = make();
    const env = {
      catalogue, builders, hatches: new Map(), creations: {}, cast: [], sound: new Proxy({}, { get: () => () => {} }),
      denizens: { add() {}, remove() {} }, inventory: { held: () => null, torchPower: () => 0 },
      health: { damage: () => ({ ok: true, dead: false }), heal: () => true }, hud: { glitch() {}, flash() {} },
      run: { met() {}, survived() {}, itemFound() {} }, player: { RADIUS: 0.22, warp() {} },
      sees: () => false, play() {}, hold: () => () => {}, descend: () => {},
    };
    const world = await buildWorld(kit, level, env);
    try {
      assert.ok(level.rooms.some((r) => r.theme === 'mall' || r.def?.theme === 'mall' || ids.includes(r.arch)), `${what}: a mall floor`);
      assert.deepEqual(said.filter((w) => /could not be reached|nor even then|would not build/.test(w)), [], `${what}: ${level.rooms.length} rooms`);
    } finally { world.dispose(); }
  }
});
