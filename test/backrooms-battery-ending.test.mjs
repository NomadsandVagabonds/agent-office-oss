import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../public/vendor/three.module.min.js';
import { BATTERY_ENDING, batteryWarning, batteryEnding } from '../public/world/backrooms/battery-ending.js';

test('battery warning counts actual remaining seconds and disappears after a recharge', () => {
  for (const value of [undefined, null, NaN, Infinity, -1, 0, 10.01, 300]) assert.equal(batteryWarning(value), null);
  assert.deepEqual([10, 9.9, 9, 1.01, 1, 0.001].map(batteryWarning), [10, 10, 9, 2, 1, 1]);
  assert.equal(batteryWarning(120.1), null);
});

test('battery ending blacks out the signal first and fades the last icon before completing', () => {
  assert.deepEqual(batteryEnding(0), { black: 0, snow: 0, iconOpacity: 1, over: false });
  let before = batteryEnding(0);
  for (let n = 1; n <= 400; n++) {
    const elapsed = n / 100, now = batteryEnding(elapsed);
    assert.ok(now.black >= before.black && now.snow >= before.snow && now.iconOpacity <= before.iconOpacity);
    assert.equal(now.over, elapsed >= BATTERY_ENDING.duration);
    before = now;
  }
  assert.equal(batteryEnding(0.6).snow, 1);
  assert.deepEqual(batteryEnding(BATTERY_ENDING.picture), { black: 1, snow: 1, iconOpacity: 1, over: false });
  assert.equal(batteryEnding(BATTERY_ENDING.icon).iconOpacity, 1);
  assert.ok(batteryEnding(3.15).iconOpacity > 0 && batteryEnding(3.15).iconOpacity < 1);
  assert.equal(batteryEnding(3.599).over, false);
  assert.deepEqual(batteryEnding(3.6), { black: 1, snow: 1, iconOpacity: 0, over: true });
  for (const invalid of [-1, NaN, undefined]) assert.deepEqual(batteryEnding(invalid), batteryEnding(0));
});

// Run the actual conductor, player, survival and tally. Only rendering,
// room construction, sound and DOM widgets are replaced. These regressions
// exercise the real ending/scorecard routing, rather than another state
// machine that merely resembles index.js.
const directory = new URL('../public/world/backrooms/', import.meta.url);
let serial = 0;
const flush = () => new Promise(resolve => setImmediate(resolve));
async function visit(t, options = {}) {
  const key = `__batteryEndingTest${++serial}`, noop = () => {};
  let onFrame, ready, menuActions, worldStep = noop;
  const warnings = [], icons = [], cards = [], disposedFloors = [], uniforms = Object.fromEntries(
    ['uSnow', 'uBlack', 'uWhite', 'uRed', 'uTrack', 'uGain', 'uRoll', 'uStaticDark'].map(name => [name, { value: 0 }]));
  const hud = {
    el: {}, warnings, icons, ending: false, removed: false,
    setClean: noop, layout: noop, hint: noop, flag: noop, recording: noop, setStamp: noop, setPaused: noop, update: noop, glitch: noop,
    battery: noop, tipHint: noop,
    batteryWarning(value) { if (!this.ending) warnings.push(value); },
    batteryEnding({ opacity }) { this.ending = true; icons.push(opacity); },
    remove() { this.removed = true; },
  };
  const vhs = { uniforms, level: 2, layout: () => ({ x: 0, y: 0, w: 800, h: 600 }), render: noop, setScene: noop, setLevel: noop, setProfile: noop, setGrade: noop, setAmbient: noop, dispose: noop };
  const sound = { play: noop, setHum: noop, setMains: noop, setPaused: noop, setMute: noop, setMusicVolume: noop, setSfxVolume: noop, stop: noop };
  const input = { state: { keys: new Set(), stick: { x: 0, y: 0 }, dx: 0, dy: 0 }, clear: noop, release: noop, capture: noop, dispose: noop };
  let bagActions;
  const bag = { isOpen: false, view: { el: {} }, hang: noop, attend: noop, forget: noop, update: noop, dispose: noop,
    owns: () => false, handleKey: () => false, torchPower: () => 0, torchMounted: () => false, count: () => 0,
    close() { if (this.isOpen) { this.isOpen = false; bagActions.onOpen(false); } },
  };
  const def = { id: 0, kind: 'start', W: 8, D: 8, H: 3, cx: 0, cz: 0, rot: 0, y: 0, way: 'hole' };
  const level = depth => ({ seed: 'battery-regression', cast: [], depth, rooms: [{ ...def }], start: { x: 0, z: 0, yaw: 0, room: 0 }, exit: { room: 0, way: depth ? 'wall' : 'hole' }, hum: 50, stamp: {} });
  const fixtures = {
    resolveLook: () => ({}),
    sketch: noop, toWorld: (r, x, z) => ({ x, z }), toLocal: (r, x, z) => ({ x, z }), DECK: [], ARCHETYPES: {},
    planVisit: (_seed, opt) => ({ depths: 2, difficulty: opt.difficulty }), floorOf: (plan, depth) => ({ ...level(depth), difficulty: plan.difficulty }), edition: () => 'test',
    changeVisitDifficulty(plan, id) { plan.difficulty = id; },
    createKit: () => ({ shared: { uTorch: { value: 0 }, uCameraLamp: { value: 0 }, uTorchOrigin: { value: new THREE.Vector3() }, uTorchDirection: { value: new THREE.Vector3() } }, dispose: noop }), BUILDERS: {}, loadCatalogue: async () => ({}),
    async buildWorld(kit, level, env) {
      const room = { id: 0, def: level.rooms[0], group: { visible: true }, level: 0.3, u: { dim: { value: 1 } }, flickers: [], visits: 0 };
      let current = null;
      return { scene: new THREE.Scene(), rooms: [room], floorY: () => 0, headroom: () => 3, free: () => true, passable: () => true,
        current: () => current, roomAt: () => room, enter(rt) { current = rt; rt.visits++; }, update() { worldStep(env); },
        glimpse: noop, lightAt: () => [0.3, 0.3, 0.3], usable: () => null, dispose() { disposedFloors.push(level); },
      };
    },
    createVhs: () => vhs, createHud: () => hud, createSound: () => sound, createInput: () => input,
    createStalkers(env) { env.pursuer = { update: noop, dispose: noop, carry: () => null }; },
    createHand: noop, createHandView(env) { env.handView = { update: noop, hide: noop, dispose: noop }; },
    createDenizens(env) { env.denizens = { update: noop, sync: noop, dispose: noop }; },
    hangBanner: noop,                                    // (the banner near the landing is drawn, and nothing here draws)
    createLoot: noop, lootLeft: () => null, leaving: noop, middle: () => ({ x: 0, z: 0 }), THIN_BEHIND: 4,
    createInventory(env, options) { bagActions = options; return bag; },
    createMenu(options) { menuActions = options; return { el: {}, owns: () => false, handleKey: () => false, setOpen: noop, update: noop, dispose: noop }; },
    showScorecard(options) { cards.push(options); return { shown: true }; },
  };
  globalThis[key] = fixtures;
  const beforeDocument = globalThis.document;
  globalThis.document = { activeElement: null };
  t.after(() => { delete globalThis[key]; if (beforeDocument === undefined) delete globalThis.document; else globalThis.document = beforeDocument; });
  const real = new Set(['./player.js', './survival.js', './tally.js', './seam.js', './battery-ending.js', './banner.rule.js', './flashlight.js', './graphics.js', './themes.js']);
  let source = readFileSync(new URL('index.js', directory), 'utf8').replace(/^import (.+) from '([^']+)';$/gm, (_, names, path) => {
    if (path === 'three') return `import ${names} from ${JSON.stringify(new URL('../public/vendor/three.module.min.js', import.meta.url).href)};`;
    if (path === '/core/backrooms-settings.mjs') return `import ${names} from ${JSON.stringify(new URL('../core/backrooms-settings.mjs', import.meta.url).href)};`;
    if (path === '/core/difficulty.mjs') return `import ${names} from ${JSON.stringify(new URL('../core/difficulty.mjs', import.meta.url).href)};`;
    if (path === '/core/perks.mjs') return `import ${names} from ${JSON.stringify(new URL('../core/perks.mjs', import.meta.url).href)};`;
    if (real.has(path)) return `import ${names} from ${JSON.stringify(new URL(path, directory).href)};`;
    return `const ${names} = globalThis[${JSON.stringify(key)}];`;
  });
  source = source.replace("import('./scorecard.js')", `Promise.resolve({ showScorecard: globalThis[${JSON.stringify(key)}].showScorecard })`);
  const { enterBackrooms } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const prepared = new Promise(resolve => { ready = resolve; });
  const finished = enterBackrooms({ stage: { renderer: { domElement: {}, setRenderTarget: noop }, quality: {}, size: { w: 800, h: 600 },
    setView: noop, onFrame(fn) { onFrame = fn; return () => { onFrame = null; }; },
  // (the floor here is a stand-in with no furniture in it: nothing to drag, so that is left out)
  } }, { name: 'Test', seed: 'battery-regression', barricades: false, ...options, onReady: ready });
  const handle = await prepared;
  const tick = dt => onFrame?.(dt);
  tick(1.3);
  assert.equal(handle.state, 'play');
  return { handle, tick, finished, hud, uniforms, cards, bag, disposedFloors,
    pause: () => menuActions.onRequestOpen(), resume: () => menuActions.onResume(), hazard: fn => { worldStep = fn; },
  };
}

test('battery lifecycle: warning allows pausing/recharge; expiry completes automatically with its icon last and its reason locked', async t => {
  const v = await visit(t), { handle, tick, hud, uniforms, cards, bag } = v;
  tick(289);
  assert.equal(hud.warnings.at(-1), null);
  tick(1);
  assert.equal(hud.warnings.at(-1), 10);
  v.pause(); tick(60);
  assert.equal(handle.camera.read().remaining, 10, 'the pause menu holds the real battery clock');
  assert.equal(handle.paused, true);
  v.resume();
  bag.isOpen = true;
  v.hazard(env => env.health.damage());
  tick(1);
  assert.equal(hud.warnings.at(-1), 9);
  assert.equal(handle.health.read().current, 3, 'the open bag does not pause room hazards');
  assert.equal(bag.isOpen, true);
  v.hazard(() => {});
  assert.equal(handle.camera.recharge().ok, true);
  tick(0.01);
  assert.equal(hud.warnings.at(-1), null, 'a replenished camera cancels the urgent warning');
  handle.camera.drain(1);
  tick(0.1);
  assert.equal(hud.warnings.at(-1), 1);
  tick(2); // longer than the remaining charge: this frame is not ending time
  assert.equal(handle.camera.read().remaining, 0);
  assert.equal(handle.state, 'ending');
  assert.equal(bag.isOpen, false);
  assert.equal(hud.icons.at(-1), 1);
  assert.equal(uniforms.uBlack.value, 0);
  assert.equal(cards.length, 0);
  handle.finish('quit'); handle.finish('caught'); handle.env.end('exit'); v.pause();
  assert.equal(handle.paused, false, 'an exhausted camera cannot be paused forever');
  assert.equal(handle.health.damage(4).ok, false);
  assert.equal(handle.camera.recharge().ok, false);
  tick(2.2);
  assert.equal(uniforms.uBlack.value, 1);
  assert.equal(uniforms.uStaticDark.value, 1);
  assert.equal(uniforms.uRed.value, 0);
  assert.equal(hud.icons.at(-1), 1, 'empty battery remains over the black picture');
  assert.equal(cards.length, 0);
  tick(0.5); tick(0.45);
  assert.ok(hud.icons.at(-1) > 0 && hud.icons.at(-1) < 1);
  tick(0.449);
  assert.equal(handle.state, 'ending');
  assert.equal(cards.length, 0, 'no score page before the final icon finishes fading');
  tick(0.002);
  const result = await v.finished;
  assert.equal(handle.state, 'done');
  assert.equal(hud.icons.at(-1), 0);
  assert.equal(hud.removed, true);
  assert.equal(cards.length, 1);
  assert.equal(result.reason, 'battery', 'late room/quit callbacks cannot replace the ending');
  assert.equal(cards[0].reason, 'battery');
  tick(50);
  assert.equal(cards.length, 1);
});

test('battery lifecycle: exhaustion during a connected-floor drop still advances to its scorecard', async t => {
  const v = await visit(t), { handle, tick, hud } = v;
  tick(291);
  assert.equal(handle.descend(), true);
  await flush();
  assert.ok(handle.ahead);
  tick(0.01); tick(0.01);
  assert.equal(handle.state, 'drop');
  assert.equal(hud.warnings.at(-1), 9);
  tick(20);
  assert.equal(handle.state, 'ending', 'a depletion interrupts the fall');
  assert.equal(v.cards.length, 0);
  tick(BATTERY_ENDING.duration);
  const result = await v.finished;
  assert.equal(result.reason, 'battery');
  assert.equal(v.cards.length, 1);
});


test('difficulty lifecycle: changing modes discards an in-flight next part and stays unscored after changing back', async t => {
  const v = await visit(t, { difficulty: 'easy' }), { handle, tick } = v;
  tick(4.1); // the next floor is building asynchronously
  handle.setSetting('difficulty', 'hard');
  await flush();
  assert.equal(handle.ahead, null);
  assert.ok(v.disposedFloors.some(f => f.depth === 1 && f.difficulty === 'easy'));
  assert.equal(handle.level.difficulty, 'easy', 'the occupied floor is never regenerated');
  assert.equal(handle.health.read().max, 1, 'survival changes immediately');
  tick(.01); await flush();
  assert.equal(handle.ahead.level.difficulty, 'hard');
  handle.setSetting('difficulty', 'easy');
  assert.equal(handle.ahead, null, 'a completed prebuild is discarded too');
  assert.ok(v.disposedFloors.some(f => f.depth === 1 && f.difficulty === 'hard'));
  assert.equal(handle.health.read().current, 1, 'changing back does not heal');
  handle.finish('quit'); tick(10);
  const result = await v.finished;
  assert.equal(result.run.difficulty, 'easy');
  assert.equal(result.run.difficultyChanged, true); assert.equal(result.run.ranked, false);
});

test('Tourist returns from an authored fatal pit without ending the visit or keeping fall momentum', async t => {
  const v = await visit(t, { difficulty: 'tourist' }), { handle, tick } = v;
  Object.assign(handle.player.me, { x: 5, z: 7, dropV: -8, vx: 2, pitch: .9 });
  handle.env.end('caught');
  assert.equal(handle.state, 'play');
  assert.equal(handle.player.me.x, handle.level.start.x);
  assert.equal(handle.player.me.z, handle.level.start.z);
  assert.equal(handle.player.me.dropV, 0); assert.equal(handle.player.me.vx, 0);
  tick(1000);
  assert.equal(handle.health.read().current, 4); assert.equal(handle.camera.read().remaining, 300);
  assert.equal(v.cards.length, 0);
  handle.finish('quit'); tick(10);
  const result = await v.finished;
  assert.equal(result.run.ranked, false);
});

test('the conductor keeps camera illumination separate from inventory power and respects authored darkness',async t=>{
  const v=await visit(t), room=v.handle.world.rooms[0], shared=v.handle.env.kit.shared;
  room.level=.002;
  for(let i=0;i<40;i++)v.tick(.1);
  assert.ok(shared.uCameraLamp.value>.08,'the camera reveals nearby surfaces in a dark room');
  assert.equal(shared.uTorch.value,0,'camera illumination cannot masquerade as a powered flashlight');
  assert.equal(v.bag.torchPower(),0);
  room.noTorch=true;v.tick(.1);
  assert.equal(shared.uCameraLamp.value,0,'an authored no-lamp encounter takes effect immediately');
  v.bag.torchPower=()=>1;
  for(let i=0;i<20;i++)v.tick(.1);
  assert.ok(shared.uTorch.value>1.4,'the real flashlight still works inside the encounter');
  room.noTorch=false;room.level=.3;v.bag.torchPower=()=>0;
  for(let i=0;i<40;i++)v.tick(.1);
  assert.ok(shared.uCameraLamp.value<.001);
  assert.ok(shared.uTorch.value<.001);
  v.tick(301);v.tick(BATTERY_ENDING.duration);await v.finished;
});
