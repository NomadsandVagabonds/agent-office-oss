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

test('the numbers: further, a stagger, and the heavy ones give', () => {
  assert.equal(SHOVE.push, 1.6); assert.equal(SHOVE.stagger, 0.6);
  assert.deepEqual({ ...SHOVE.heavy }, { push: 0.8, stagger: 0.3 });
  // what keeps it a chance to run and never a weapon is what it was
  assert.equal(SHOVE.breath, 0.3); assert.equal(SHOVE.cooldown, 1.0); assert.equal(SHOVE.rest, 2.5);
  assert.deepEqual({ ...SHOVE.window }, { tourist: 0.5, 'training-wheels': 0.5, easy: 0.45, normal: 0.32, hard: 0.22 });
  assert.deepEqual(slide({ x: 0, z: 0 }, { x: 0, z: 1 }, () => true, SHOVE.heavy.push), { x: 0, z: 0.8 });
});

// The conductor with its neighbours swapped for stubs (as coop-cast.test.mjs loads it), and one of the cast that keeps a
// rule of its own: a count, a target, and a hit it tries to land every tick. Its shove is what the real ones' are.
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function floor() {
  let source = read('pursuer.js');
  const swaps = {
    './gen.js': 'export const makeRng=()=>()=>.5; export const roomDistances=()=>new Map();',
    './cast.js': `export const CAST=[{id:'walker'},{id:'boulder',heavy:true}];export const castFor=()=>CAST;export const homeFor=()=>null;`,
    './cast/index.js': `const make=c=>{const it={x:1,z:0,ticks:0,time:0,state:{mode:'counts',n:7,target:'a'},hits:[],ready(){},at:()=>({x:it.x,z:it.z}),
      update(dt){it.ticks++;it.time+=dt;it.state={...it.state,n:it.state.n+1};it.x-=dt;it.hits.push(c.hurt(1));},
      shoveTargets:()=>[{id:c.member.id,x:it.x,z:it.z,r:0.3,shove:(dir)=>{const far=c.member.heavy?0.8:1.6;it.x+=dir.x*far;it.z+=dir.z*far;c.stall(c.member.heavy?0.3:0.6);return true;}}]};return it;};
      export const MAKERS={walker:make,boulder:make};`,
    './cast/walk.js': 'export const createWalk=()=>({});',
    './doorleaf.js': 'export const hangDoors=()=>({update(){}});',
  };
  for (const [name, stub] of Object.entries(swaps)) source = source.replace(`'${name}'`, JSON.stringify(url(stub)));
  source = source.replace("'../../../core/difficulty.mjs'", JSON.stringify(new URL('../core/difficulty.mjs', import.meta.url).href));
  const { createStalkers } = await import(url(source));
  let hearts = 3;
  const env = { level: { seed: 'test', depth: 0 }, world: {}, player: { me: { id: 'a', x: 0, z: 0, yaw: -Math.PI / 2 } }, sees: () => false, clock: 0,
    health: { damage: () => { hearts--; return { ok: true, dead: false }; } } };
  createStalkers(env); for (const f of env.ready || []) f();
  return { env, p: env.pursuer, hearts: () => hearts };
}

test('shoved, one of the cast is moved, stands the stagger out landing no hit, and is then exactly what it was', async () => {
  const { env, p } = await floor(), it = p.of('walker'), dt = 0.05;
  p.update(dt); const before = { ...it.state }, x0 = it.x, hits0 = it.hits.length, landed = () => it.hits.filter((h) => h.landed).length, landed0 = landed();
  assert.equal(it.hits.at(-1).landed, true, 'unshoved, its hit lands');
  const moved = strikeShove(env.player.me, p.shoveTargets().filter((t) => t.id === 'walker'));
  assert.deepEqual(moved, ['walker']);
  assert.ok(Math.abs(it.x - (x0 + SHOVE.push)) < 1e-9, `pushed ${SHOVE.push} m (${(it.x - x0).toFixed(2)})`);
  // the stagger: one tick of no time at all (so that it is drawn where it was put), and then none
  let t = 0; const xPut = it.x;
  while (t < SHOVE.stagger - 1e-9) { p.update(dt); t += dt; }
  assert.equal(it.hits.length, hits0 + 1); assert.equal(it.hits.at(-1).landed, false); assert.equal(it.hits.at(-1).stalled, true);
  assert.equal(landed(), landed0, 'nobody is hurt by it while it stands');
  assert.ok(Math.abs(it.x - xPut) < 1e-3, 'and it has not come on');
  assert.equal(it.state.mode, before.mode); assert.equal(it.state.target, before.target); assert.equal(it.state.n, before.n + 1, 'its rule is where it was (the one settling tick aside)');
  // …and afterwards it carries on: it comes on again and its hit lands again
  p.update(dt); p.update(dt);
  assert.ok(it.x < xPut - dt, 'it comes on again'); assert.equal(it.hits.at(-1).landed, true);
  assert.equal(it.state.mode, 'counts'); assert.equal(it.state.target, 'a');
});

test('a heavy one gives 0.8 m and stands 0.3 s; its hit is still not turned aside by the window', async () => {
  const { env, p } = await floor(), it = p.of('boulder'), dt = 0.05;
  p.update(dt); const x0 = it.x;
  strikeShove(env.player.me, p.shoveTargets().filter((t) => t.id === 'boulder'));
  assert.ok(Math.abs(it.x - (x0 + SHOVE.heavy.push)) < 1e-9);
  const n = it.hits.length; let t = 0;
  while (t < SHOVE.heavy.stagger - 1e-9) { p.update(dt); t += dt; }
  assert.equal(it.hits.length, n + 1); assert.equal(it.hits.at(-1).stalled, true);
  // the window is open (a shove a moment ago), the hit comes from in front, and it lands all the same: heavy
  env.blocked = () => true; p.update(dt); p.update(dt);
  assert.equal(it.hits.at(-1).landed, true, 'heavy: not turned aside');
  const light = p.of('walker'); assert.equal(light.hits.at(-1).blocked, true, 'where a light one\'s is');
});

test('every one of the cast answers a shove, or cannot be reached by one', () => {
  assert.deepEqual(CAST.filter((m) => m.heavy).map((m) => m.id).sort(), ['carried-interest', 'standing-meeting']);
  const body = (id) => { const src = read(`cast/${id}.js`), at = src.indexOf('    shoveTargets()'); assert.ok(at > 0, `${id} says what a shove does to it`); return src.slice(at, src.indexOf('\n    },\n', at)); };
  // moved the full push and stood the full stagger, with nothing of their rule put back
  for (const id of ['pirate', 'head-count', 'intern']) {
    const b = body(id);
    assert.match(b, /clear\((p|walker), x0, z0, x1, z1\)\);/, `${id} goes the whole push (no shorter distance is asked for)`);
    assert.match(b, /c\.stall\(SHOVE\.stagger\)/, `${id} stands the stagger`);
    assert.ok(!/\bs = /.test(b), `${id}'s rule is not put back`);
  }
  // the heavy ones, and Mother herself: half a step and a short stand, whatever they are doing
  for (const id of ['standing-meeting', 'carried-interest', 'mother']) {
    const b = body(id);
    assert.match(b, /slide\(walker, dir, [^\n]*SHOVE\.heavy\.push\)/, `${id} gives 0.8 m`);
    assert.match(b, /c\.stall\(SHOVE\.heavy\.stagger\)/, `${id} stands 0.3 s`);
    assert.ok(!/\bs = /.test(b), `${id}'s rule is not put back`);
    assert.ok(!/s\.mode [!=]==/.test(b.split('shove:')[0]), `${id} gives in any mode`);
  }
  // where there is no floor behind it, it is still stood: the stall does not wait on the slide
  for (const id of ['pirate', 'head-count', 'intern', 'standing-meeting', 'carried-interest', 'mother']) assert.ok(!/if \(!to\) return false/.test(body(id)), `${id} with its back to a wall is still stalled`);
  // the ones that are many bodies answer body by body: a toner coming is batted aside (its own recoil), a small one is batted away and dazed, a dummy is slid
  assert.match(body('toner'), /strikeToner\(u\.s, \{ landed: false \}\)/); assert.match(body('mother'), /w\.dazed = WORM\.dazed \* 1\.6/); assert.match(body('dummies'), /slide\(o, dir,/);
  // and those a pair of hands cannot reach say nothing: a figure with no body, a thing on wires in a culvert, a door, a moth, a porter who is not there to be pushed
  for (const id of ['shadow', 'the-lines', 'other-door', 'moth', 'porter']) assert.ok(!/shoveTargets/.test(read(`cast/${id}.js`)), `${id} offers nothing to push`);
  // nothing dies of a shove
  for (const id of ['pirate', 'toner', 'mother', 'head-count', 'standing-meeting', 'carried-interest', 'intern', 'dummies']) assert.ok(!/c\.hurt|\.dead = true|dissolv|env\.end/.test(body(id)), `a shove ends nothing of ${id}`);
  // the hit of one that is stood is refused before anything else is asked; then the window, for all but the heavy
  const conductor = read('pursuer.js');
  assert.match(conductor, /hurt\(n = 1, from = null\) \{\s+if \(k\.stall > 0\) return \{ landed: false, dead: false, ended: false, stalled: true \};/);
  assert.match(conductor, /if \(!member\.heavy && env\.blocked\) \{\s+const at = from \|\| k\.it\?\.at\?\.\(\) \|\| null;\s+if \(env\.blocked\(at\)\) \{[^\n]*return \{ landed: false, dead: false, ended: false, blocked: true \}; \}/);
  assert.match(read('index.js'), /blocked: \(from\) => blocks\(env\.player\?\.me \?\? f\.player\?\.me, from\),/);
  assert.match(read('cast/toner.js'), /c\.hurt\(TONER\.hitDamage, walker\)/); assert.match(read('cast/mother.js'), /c\.hurt\(WORM\.hurts, \{ x: a\.fx, z: a\.fz \}\)/);
});

test('a click is the scissors if they are in the hand and a shove if not; a thumb\'s hand shoves when there is nothing to use', () => {
  const index = read('index.js'), input = read('input.js'), player = read('player.js');
  assert.match(index, /if \(inventory\?\.held\(\)\?\.type === 'scissors'\) \{ inventory\.snip\(\{ quietMiss: true \}\); return; \}\s+if \(inventory\?\.held\(\)\?\.type === 'extinguisher'\) \{ cur\?\.env\.extinguisher\?\.press\(\); return; \}[^\n]*\s+if \(inventory\?\.held\(\)\?\.type === 'flamingo'\) \{ inventory\.stab\(\{ quietMiss: true \}\); return; \}[^\n]*\s+cur\?\.env\.shove\?\.\(\);/, '(and the extinguisher sprays, and the flamingo stabs)');
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
