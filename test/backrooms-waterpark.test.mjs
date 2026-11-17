// Tests for the Corporate Aquatics Annex (`waterpark`) floor:
// pure swimming/wading/underwater rules, wave surges & surf debris, lazy-river
// currents & Lifeguard Adult-Swim rule, 3D flume splines & fork leaning,
// ripple-hunting Pool Skimmer, Tube-Toner, Spider-Chair Lifeguard Stand,
// Shower Maze valves, Whirlpool Spa jet reversal, Diving Well grate suction,
// Lagoon Inverted-Bather floats, plain-room WRONG oddities & POOL_THINGS,
// and theme/generator isolation while `dealt: false`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const [
  {
    AQUA, makeSwimmer, stepSwimmer,
    WAVE, waveState, wavePush,
    riverCurrent, GUARD, makeLifeguard, stepLifeguard,
    evalFlume, flumeLength, sampleFlumeFrames, minSplineDistance, slideMazeSplines, stepSlideRide,
    SKIMMER, makeSkimmer, stepSkimmer,
    TUBE_TONER, makeTubeToner, stepTubeToner, snipTubeToner,
    GUARD_STAND, makeGuardStand, stepGuardStand, snipGuardStand, guardStandGait,
    SHOWER_MAZE, makeShowerMaze, turnShowerValve, stepShowerMaze,
    WHIRLPOOL_SPA, makeWhirlpoolSpa, toggleWhirlpoolJets, stepWhirlpoolSpa, whirlpoolField,
    waveDebrisPose,
    DIVING_WELL, divingWellState, makeDivingWell, stepDivingWell,
    LAGOON_FLOATS, makeLagoonFloat, stepLagoonFloat, snipLagoonFloat,
  },
  { WRONG, WRONG_KEYS, POOL_THINGS, poolroom },
  { createKit },
  { buildWorld },
  { THEMES, atHome, dealtThemes },
  { DECK, generate, toWorld },
  { planVisit, floorOf },
] = await Promise.all([
  import('../public/world/backrooms/waterpark.rule.js'),
  import('../public/world/backrooms/waterpark.js'),
  import('../public/world/backrooms/kit.js'),
  import('../public/world/backrooms/world.js'),
  import('../public/world/backrooms/themes.js'),
  import('../public/world/backrooms/gen.js'),
  import('../public/world/backrooms/plan.js'),
]);

const WATERPARK_ROOMS = [
  'channel-hall',
  'nested-thresholds',
  'return-pool',
  'bellmouth-baths',
  'hanging-changing',
  'slide-maze',
  'wave-pool',
  'lazy-river',
  'deep-end',
  'whirlpool-flume',
  'kiddie-lagoon',
  'locker-showers',
  'smiler-maze',
  'dive-tower',
  'flume-connector',
  'flooded-cubicles',
  'office-beach-day',
];

test('waterpark.rule.js stays 100% pure (no three.js, DOM, or I/O)', () => {
  const src = readFileSync(new URL('../public/world/backrooms/waterpark.rule.js', import.meta.url), 'utf8');
  assert.ok(!/^import\b/m.test(src), 'waterpark.rule.js has zero imports');
  assert.ok(!/document\.|window\.|localStorage|fetch\s*\(/i.test(src));
});

test('stepSwimmer: wading slowdown, chest-deep C-submerge, deep diving, 14s air limit, and wet-tile hydroplane', () => {
  let s = makeSwimmer();

  // Entering chest-deep basin (-0.78 m floor, -0.06 m water => 0.72 m water depth)
  let res = stepSwimmer(s, 0.1, { waterY: -0.06, floorY: -0.78, speed: 1.5, crouch: false, jump: false, pitch: 0, hurry: false });
  s = res.state;
  assert.equal(s.inWater, true);
  assert.equal(res.events.entered, true);
  assert.equal(res.events.splash, true);
  assert.equal(s.submerged, false);
  assert.ok(res.slow < 1 && res.slow >= 0.58, 'wading slows movement fairly');

  // Holding C in chest-deep water ducks head cleanly below waterY
  for (let i = 0; i < 10; i++) {
    res = stepSwimmer(s, 0.1, { waterY: -0.06, floorY: -0.78, speed: 0, crouch: true, jump: false, pitch: 0, hurry: false });
    s = res.state;
  }
  assert.equal(s.submerged, true);
  assert.ok(res.eyeY < -0.2, `expected eye below waterY (-0.06), got ${res.eyeY}`);

  // Staying submerged past airWarn (9.5s) triggers warning, and past airLimit (14.0s) triggers non-lethal gasp + grace
  let warned = false, gasped = false;
  for (let i = 0; i < 145; i++) {
    res = stepSwimmer(s, 0.1, { waterY: -0.06, floorY: -0.78, speed: 0.4, crouch: true, jump: false, pitch: 0, hurry: false });
    s = res.state;
    if (res.events.warn) warned = true;
    if (res.events.gasped) { gasped = true; break; }
  }
  assert.equal(warned, true);
  assert.equal(gasped, true);
  assert.ok(s.airUsed < AQUA.airLimit, 'airLimit grants grace window instead of instant re-trigger');

  // Deep diving well (-2.05 m floor, -0.06 m water): treads water at surface by default, dives deep on C, surfaces on Space
  s = makeSwimmer();
  res = stepSwimmer(s, 0.2, { waterY: -0.06, floorY: -2.05, speed: 0, crouch: false, jump: false, pitch: 0, hurry: false });
  s = res.state;
  assert.equal(s.submerged, false);
  assert.ok(res.eyeY > -0.06, 'treads water with head above waterY by default');

  for (let i = 0; i < 15; i++) {
    res = stepSwimmer(s, 0.1, { waterY: -0.06, floorY: -2.05, speed: 1.0, crouch: true, jump: false, pitch: -0.3, hurry: false });
    s = res.state;
  }
  assert.equal(s.submerged, true);
  assert.ok(res.eyeY < -0.95, `expected deep dive well below submerged wall (-0.78), got ${res.eyeY}`);

  for (let i = 0; i < 15; i++) {
    res = stepSwimmer(s, 0.1, { waterY: -0.06, floorY: -2.05, speed: 0.5, crouch: false, jump: true, pitch: 0.2, hurry: false });
    s = res.state;
  }
  assert.equal(s.submerged, false);

  // Leaving water leaves feet wet (`wetTimer > 0`); sprinting on wet coping triggers a brief hydroplane slip with cooldown
  res = stepSwimmer(s, 0.05, { waterY: null, floorY: 0, speed: 3.4, crouch: false, jump: false, pitch: 0, hurry: true, wetTile: true });
  assert.equal(res.events.slipped, true);
  const res2 = stepSwimmer(res.state, 0.05, { waterY: null, floorY: 0, speed: 3.4, crouch: false, jump: false, pitch: 0, hurry: true, wetTile: true });
  assert.equal(res2.events.slipped, false, 'slip respects cooldown');
});

test('waveState & wavePush: klaxon precedes surge, and diving underwater or breakwater shelter avoids push', () => {
  const klax = waveState(WAVE.klaxonAt + 0.3, -7, 7);
  assert.equal(klax.klaxon, true);
  assert.equal(klax.active, false);

  const mid = waveState(WAVE.launchAt + WAVE.sweepDur * 0.5, -7, 7);
  assert.equal(mid.active, true);
  assert.ok(Math.abs(mid.crestZ) < 0.01);
  assert.ok(mid.amp > 0.4);

  assert.ok(wavePush(mid, 0, { inWater: true, submerged: false, sheltered: false }) > 3.5);
  assert.equal(wavePush(mid, 0, { inWater: true, submerged: true, sheltered: false }), 0, 'diving under the wave avoids push');
  assert.equal(wavePush(mid, 0, { inWater: true, submerged: false, sheltered: true }), 0, 'breakwater pier shelters swimmer');
});

test('riverCurrent & stepLifeguard: current orbits canal; ducking underwater avoids Adult-Swim citation', () => {
  const cur = riverCurrent(3.6, 0, 2.2, 5.0, 1.5, 1);
  assert.equal(cur.inCanal, true);
  assert.ok(cur.vz > 1.0, 'at +x, counter-clockwise current flows toward +z');
  assert.equal(riverCurrent(1.0, 0, 2.2, 5.0, 1.5, 1).inCanal, false, 'central island is dry');

  let g = makeLifeguard();
  let whistled = false;
  for (let i = 0; i < 60; i++) {
    const step = stepLifeguard(g, 0.1, { inside: true, inCanal: true, submerged: false });
    g = step.state;
    if (step.whistle) { whistled = true; break; }
  }
  assert.equal(whistled, true);
  assert.equal(g.mode, 'whistle');

  // Advance into `scan` mode, then verify ducking underwater (`submerged: true`) never gets cited
  for (let i = 0; i < 25; i++) g = stepLifeguard(g, 0.1, { inside: true, inCanal: true, submerged: true }).state;
  assert.equal(g.mode, 'scan');
  for (let i = 0; i < 15; i++) {
    const step = stepLifeguard(g, 0.1, { inside: true, inCanal: true, submerged: true });
    g = step.state;
    assert.equal(step.cited, false, 'submerged swimmer is safe during Adult Swim');
  }

  // Standing exposed above water during `scan` triggers citation after `GUARD.citeTime`
  let cited = false;
  for (let i = 0; i < 15; i++) {
    const step = stepLifeguard(g, 0.1, { inside: true, inCanal: true, submerged: false });
    g = step.state;
    if (step.cited) { cited = true; break; }
  }
  assert.equal(cited, true);
});

test('evalFlume & stepSlideRide: smooth 3D spline and A/D lean selects left vs right fork', () => {
  const trunk = [[0, 3, 4], [0, 2.4, 2], [0, 1.8, 0]];
  const left = [[0, 1.8, 0], [-2, 1.0, -2], [-3, 0.4, -4]];
  const right = [[0, 1.8, 0], [2, 1.0, -2], [3, 0.4, -4]];
  const segs = {
    trunk: { pts: trunk, length: flumeLength(trunk), fork: { left: 'left', right: 'right', default: 'left' } },
    left: { pts: left, length: flumeLength(left) },
    right: { pts: right, length: flumeLength(right) },
  };

  let rLeft = { segId: 'trunk', u: 0, speed: 5, lean: 0 }, exitL = null;
  for (let i = 0; i < 120; i++) {
    const st = stepSlideRide(rLeft, 0.05, segs, -1);
    if (st.done) { exitL = st.exitSeg; break; }
    rLeft = st.ride;
  }
  assert.equal(exitL, 'left');

  let rRight = { segId: 'trunk', u: 0, speed: 5, lean: 0 }, exitR = null;
  for (let i = 0; i < 120; i++) {
    const st = stepSlideRide(rRight, 0.05, segs, 1);
    if (st.done) { exitR = st.exitSeg; break; }
    rRight = st.ride;
  }
  assert.equal(exitR, 'right');
});

test('sampleFlumeFrames & slideMazeSplines: parallel-transport Bishop frames never twist on vertical climbs, and slide-maze splines never clip', () => {
  // Steep vertical punch-through spline that previously caused a 180-degree gimbal flip
  const verticalLoop = [[0, 1.0, 2.0], [0, 2.5, 0.2], [0, 5.8, 0.0], [0, 3.0, -0.3], [0, 1.2, -2.0]];
  const frames = sampleFlumeFrames(verticalLoop, 40);
  assert.equal(frames.length, 41);
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    const dotU = a.ux * b.ux + a.uy * b.uy + a.uz * b.uz;
    assert.ok(dotU > 0.85, `frame U twisted abruptly between step ${i - 1} and ${i} (dot=${dotU})`);
  }

  // Pairwise 3D clearance across all splines in `slide-maze` at both min and max room dimensions
  for (const [W, D, H] of [[16, 16, 5.4], [18, 18, 6.0]]) {
    const sp = slideMazeSplines(W, D, H);
    const keys = Object.keys(sp);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = sp[keys[i]], b = sp[keys[j]];
        const dist = minSplineDistance(a.pts, b.pts, 56);
        const minAllowed = a.radius + b.radius + 0.30;
        assert.ok(dist >= minAllowed, `slide-maze tubes ${keys[i]} and ${keys[j]} clip (${dist.toFixed(2)} m < ${minAllowed.toFixed(2)} m)`);
      }
    }
  }
});

test('stepTubeToner & snipTubeToner: quiet crawlers slip past sonar, noisy scramblers wake it, and safety scissors recoil it', () => {
  let t = makeTubeToner(0);

  // Quiet crawling inside the colored tubes keeps Toner perched upside-down (`slabK = 1`) and clicking sonar
  let clicked = false;
  for (let i = 0; i < 35; i++) {
    const res = stepTubeToner(t, { dt: 0.1, dist: 2.2, inTubes: true, audible: false });
    t = res.state;
    if (res.sonar) clicked = true;
    assert.equal(t.phase, 'perched');
    assert.equal(res.slabK, 1);
  }
  assert.equal(clicked, true);

  // Scrambling fast inside the tubes alerts -> drops -> chases upright (`slabK = 0`)
  let rattled = false, dropped = false;
  for (let i = 0; i < 20; i++) {
    const res = stepTubeToner(t, { dt: 0.1, dist: 2.4, inTubes: true, audible: true });
    t = res.state;
    if (res.rattle) rattled = true;
    if (res.droppedNow) dropped = true;
    if (t.phase === 'chasing') break;
  }
  assert.equal(rattled, true);
  assert.equal(dropped, true);
  assert.equal(t.phase, 'chasing');
  assert.ok(TUBE_TONER.chaseSpeed > 2.0);

  // Snipping with Safety Scissors sends it into recoil and climbs it back up onto the tube roof
  t = snipTubeToner(t);
  assert.equal(t.phase, 'recoil');
  for (let i = 0; i < 30; i++) {
    t = stepTubeToner(t, { dt: 0.1, dist: 2.0, inTubes: true, audible: false }).state;
  }
  assert.equal(t.phase, 'perched');
});

test('stepGuardStand & guardStandGait: disguised chair wakes on sprint or whistle, spider-stilts after exposed swimmers, loses lock when submerged, and recoils on snip', () => {
  let gs = makeGuardStand(0, -1.12);
  assert.equal(gs.mode, 'chair');
  assert.equal(gs.unfold, 0);

  // Gait kinematics stay finite, lower the pelvis into a crouch, and drive 4 independent 3-joint spider-chair legs
  const chairGait = guardStandGait(0, 0, 0, 0, 'chair');
  const spiderGait = guardStandGait(1, Math.PI * 0.5, 2.4, 1.2, 'surge');
  assert.equal(chairGait.legs.length, 4);
  assert.equal(spiderGait.legs.length, 4);
  assert.ok(chairGait.pelvisY > spiderGait.pelvisY, 'wide spider crouch lowers pelvis from upright chair height');
  assert.ok(spiderGait.legs.some((l) => l.femurZ > 0.45), 'spider femurs arch high above horizontal');
  assert.ok(spiderGait.legs.every((l) => l.tibiaZ < -0.9), 'all 4 spider knees bend sharply downward');
  assert.equal(new Set(spiderGait.legs.map((l) => l.femurZ.toFixed(3))).size, 4, 'all 4 legs move on separate phases');

  // Sprinting (`speed >= sprintTrigger`) on wet deck wakes it immediately out of `chair` with a whistle!
  let res = stepGuardStand(gs, {
    dt: 0.1, inside: true, inCanal: false, submerged: false, moving: true, speed: GUARD_STAND.sprintTrigger + 0.3,
    clearLine: true, dist: 4.5, distHome: 0, playerX: 0, playerZ: 3.6,
  });
  gs = res.state;
  assert.equal(gs.mode, 'whistle');
  assert.equal(res.whistle, true);

  // Unfolding through whistle with exposed swimmer in canal transitions to `surge`
  let unfoldedEvent = false;
  for (let i = 0; i < 20; i++) {
    res = stepGuardStand(gs, {
      dt: 0.1, inside: true, inCanal: true, submerged: false, moving: true, speed: 1.2,
      clearLine: true, dist: 3.4, distHome: 0.4, playerX: 0, playerZ: 3.4,
    });
    gs = res.state;
    if (res.unfoldedNow) unfoldedEvent = true;
    if (gs.mode === 'surge') break;
  }
  assert.equal(unfoldedEvent, true);
  assert.equal(gs.mode, 'surge');
  assert.ok(gs.unfold > 0.85);
  assert.equal(res.speed, GUARD_STAND.surgeSpeed);

  // Ducking underwater (`submerged: true`) breaks lock-on and sends it back to `return` -> `chair` without striking!
  for (let i = 0; i < 30; i++) {
    res = stepGuardStand(gs, {
      dt: 0.1, inside: true, inCanal: true, submerged: true, moving: false, speed: 0.1,
      clearLine: true, dist: 0.7, distHome: 1.8, playerX: 0, playerZ: 3.4,
    });
    gs = res.state;
    assert.equal(res.struck, false, 'submerged swimmer cannot be struck');
    if (gs.mode === 'return') break;
  }
  assert.equal(gs.mode, 'return');

  // Safety Scissors `snipGuardStand` triggers `recoil`
  gs = snipGuardStand({ ...gs, mode: 'surge', unfold: 1 });
  assert.equal(gs.mode, 'recoil');
  assert.ok(gs.recoilSec > 1.5);
});

test('stepSkimmer: ignores still waders and dry-deck walkers, surges on ripples, and recoils after a bite', () => {
  const bounds = { x0: -2.2, z0: -2.2, x1: 2.2, z1: 2.2 };
  let sk = makeSkimmer(0, 0);

  // Standing still in basin -> remains in calm `glide`
  let res = stepSkimmer(sk, 0.2, { inBasin: true, speed: 0.05, px: 1.0, pz: 1.0, bounds });
  assert.equal(res.state.mode, 'glide');
  assert.equal(res.alerted, false);

  // Running on dry deck outside basin -> remains in calm `glide`
  res = stepSkimmer(res.state, 0.2, { inBasin: false, speed: 3.2, px: 1.0, pz: 1.0, bounds });
  assert.equal(res.state.mode, 'glide');

  // Splashing in basin (`speed >= SKIMMER.rippleSpeedMin`) -> alerts & surges, eventually biting once then recoiling
  sk = res.state;
  let alerted = false, bit = false;
  for (let i = 0; i < 40; i++) {
    res = stepSkimmer(sk, 0.1, { inBasin: true, speed: 1.6, px: 0.8, pz: 0.8, bounds });
    sk = res.state;
    if (res.alerted) alerted = true;
    if (res.bit) { bit = true; break; }
  }
  assert.equal(alerted, true);
  assert.equal(bit, true);
  assert.equal(sk.mode, 'recoil');
});

test('waterpark theme isolation & generation: undealt by default, strictly isolated, deals all review rooms when requested', () => {
  assert.equal(THEMES.waterpark.own, true);
  assert.equal(THEMES.waterpark.dealt, false);
  assert.ok(!dealtThemes().includes('waterpark'), 'waterpark stays out of normal visits while dealt: false');

  // Every waterpark room belongs exclusively to waterpark (`*`: 0), and no regular room leaks onto waterpark (`own: true`)
  for (const id of WATERPARK_ROOMS) {
    const entry = DECK.find((d) => d.id === id);
    assert.ok(entry, `missing deck entry for ${id}`);
    assert.ok(atHome(entry, 'waterpark') > 0);
    for (const other of ['yellow', 'archive', 'night', 'fitout', 'exec', 'suburb']) {
      assert.equal(atHome(entry, other), 0, `${id} must not deal onto ${other}`);
    }
  }
  for (const entry of DECK) {
    if (!WATERPARK_ROOMS.includes(entry.id) && !entry.planned) {
      assert.equal(atHome(entry, 'waterpark'), 0, `non-waterpark room ${entry.id} leaked onto waterpark`);
    }
  }

  // Explicit waterpark levels deal the review rooms across seeds; ordinary visits cannot.
  const seenSpecials = new Set();
  const seenMotifs = new Set();
  for (let s = 1; s <= 24; s++) {
    const visit = planVisit(`wp-visit-${s}`, { themes: ['waterpark', 'waterpark', 'waterpark'] });
    for (const f of visit.floors) {
      if (f.theme === 'waterpark') {
        for (const id of f.hand) {
          if (id === 'dispatch' || id === 'mecha') continue; // headline story placed by plan.js
          assert.ok(WATERPARK_ROOMS.includes(id), `unexpected special ${id} on waterpark floor`);
          seenSpecials.add(id);
        }
        if (f.hand.includes('smiler-maze') || f.hand.includes('flume-connector')) {
          for (const id of floorOf(visit, f.depth).picked) seenSpecials.add(id);
        }
      }
    }
    const lvl = generate(`wp-gen-${s}`, { theme: 'waterpark' });
    for (const r of lvl.rooms) {
      if (r.quiet) seenMotifs.add(r.quiet.kind);
      if (r.kind === 'plain') assert.equal(r.look.floor, 'pooltile');
    }
  }
  for (const id of WATERPARK_ROOMS) {
    assert.ok(seenSpecials.has(id), `expected ${id} to be dealt on waterpark visits`);
  }
  assert.ok(seenMotifs.has('cabanas'), 'expected cabanas motif in plain poolrooms');
});

test('showerMaze: scalding steam gates burn on contact with cooldown, and shutting 2 valves vents all gates & swings open the sanctum locker', () => {
  let m = makeShowerMaze([
    { x: 0, z: -2.88, axis: 'z' },
    { x: 0, z: 2.88, axis: 'z' },
    { x: 1.15, z: -1.95, axis: 'x' },
  ]);
  assert.equal(m.sanctumOpen, false);

  // Walking into Gate 0 triggers a single scalding burn and starts cooldown
  let s1 = stepShowerMaze(m, { dt: 0.1, inside: true, px: 0.1, pz: -2.8 });
  assert.equal(s1.burned, true);
  assert.equal(s1.activeGates, 3);
  m = s1.state;
  assert.ok(m.burnCooldown > 2.0);
  assert.equal(stepShowerMaze(m, { dt: 0.1, inside: true, px: 0.1, pz: -2.8 }).burned, false);

  // Turning Valve 0 shuts Gate 0 and boosts upward water pressure
  let v0 = turnShowerValve(m, 0);
  assert.equal(v0.changed, true);
  assert.equal(v0.unlockedNow, false);
  m = v0.state;
  assert.ok(m.upwardSurge > 1.2);

  // Turning Valve 1 reaches SHOWER_MAZE.valvesToUnlock (2), unlocking the sanctum & venting all gates!
  let v1 = turnShowerValve(m, 1);
  assert.equal(v1.unlockedNow, true);
  m = v1.state;
  assert.equal(m.sanctumOpen, true);
  for (let i = 0; i < 10; i++) {
    m = stepShowerMaze(m, { dt: 0.1, inside: true, px: 1.15, pz: -1.95 }).state;
  }
  assert.ok(m.doorAngle > 1.4, 'sanctum locker door swings wide open');
  assert.equal(stepShowerMaze(m, { dt: 0.1, inside: true, px: 1.15, pz: -1.95 }).activeGates, 0);
  assert.ok(SHOWER_MAZE.valvesToUnlock === 2);
});

test('whirlpoolSpa: default vortex pulls inward + tangentially in spin direction, jet toggle flips spin & calms suction, and stepWhirlpoolSpa decays back to normal', () => {
  const hs = 3.2;
  const x = 1.6, z = 1.2;
  const r = Math.hypot(x, z); // 2.0, cleanly inside (0.24, hs - 0.18)

  // Decompose velocity field into inward radial component (toward origin) and CCW tangential component
  const decompose = (f) => ({
    inward: -(f.vx * (x / r) + f.vz * (z / r)),
    tang: f.vx * (-z / r) + f.vz * (x / r),
  });

  // Eye center and outer coping lie outside the active vortex ring
  const spaPos = makeWhirlpoolSpa(1);
  assert.equal(spaPos.spin, 1);
  assert.equal(spaPos.calmSec, 0);
  assert.equal(spaPos.siphonSurge, 1.0);
  assert.deepEqual(whirlpoolField(spaPos, 0.1, 0.05, hs), { inVortex: false, vx: 0, vz: 0 });
  assert.deepEqual(whirlpoolField(spaPos, hs - 0.05, 0, hs), { inVortex: false, vx: 0, vz: 0 });

  // Default vortex pulls inward (> 0) and tangentially in direction `spin` (+1 vs -1)
  const fPos = whirlpoolField(spaPos, x, z, hs);
  assert.equal(fPos.inVortex, true);
  const dPos = decompose(fPos);
  assert.ok(Math.abs(dPos.inward - WHIRLPOOL_SPA.vortexInward) < 1e-9 && dPos.inward > 0, 'pulls inward toward central drain');
  assert.ok(Math.abs(dPos.tang - WHIRLPOOL_SPA.vortexTangential) < 1e-9 && dPos.tang > 0, 'spins in +1 tangential direction');

  const spaNeg = makeWhirlpoolSpa(-1);
  assert.equal(spaNeg.spin, -1);
  const dNeg = decompose(whirlpoolField(spaNeg, x, z, hs));
  assert.ok(Math.abs(dNeg.inward - WHIRLPOOL_SPA.vortexInward) < 1e-9);
  assert.ok(Math.abs(dNeg.tang + WHIRLPOOL_SPA.vortexTangential) < 1e-9 && dNeg.tang < 0, 'spins in -1 tangential direction');

  // Toggling jets flips spin, boosts siphonSurge > 1.6, sets calmSec = calmDur, and removes inward suction (`inward <= 0`)
  let spa = toggleWhirlpoolJets(spaPos);
  assert.equal(spa.spin, -1);
  assert.equal(spa.toggles, 1);
  assert.ok(spa.siphonSurge > 1.6, `expected siphonSurge > 1.6, got ${spa.siphonSurge}`);
  assert.equal(spa.calmSec, WHIRLPOOL_SPA.calmDur);

  const fCalm = whirlpoolField(spa, x, z, hs);
  assert.equal(fCalm.inVortex, true);
  const dCalm = decompose(fCalm);
  assert.ok(dCalm.inward <= 0, `expected inward suction <= 0 during calm window, got ${dCalm.inward}`);
  assert.ok(Math.abs(dCalm.tang - (-WHIRLPOOL_SPA.calmTangential)) < 1e-9, 'calm window slows tangential flow in flipped spin direction');

  // Stepping partway through the calm window keeps calmSec > 0 and inward <= 0
  spa = stepWhirlpoolSpa(spa, 2.5);
  assert.ok(spa.calmSec > 0 && spa.calmSec < WHIRLPOOL_SPA.calmDur);
  assert.ok(decompose(whirlpoolField(spa, x, z, hs)).inward <= 0);

  // Stepping past calmDur decays calmSec to 0, siphonSurge back to ~1.0, and restores inward suction in flipped spin
  for (let i = 0; i < 20; i++) {
    spa = stepWhirlpoolSpa(spa, 0.5);
  }
  assert.equal(spa.calmSec, 0);
  assert.ok(Math.abs(spa.siphonSurge - 1.0) < 0.01, `expected siphonSurge decayed back to ~1.0, got ${spa.siphonSurge}`);
  const dAfter = decompose(whirlpoolField(spa, x, z, hs));
  assert.ok(Math.abs(dAfter.inward - WHIRLPOOL_SPA.vortexInward) < 1e-9 && dAfter.inward > 0, 'inward suction restored after calm window');
  assert.ok(Math.abs(dAfter.tang + WHIRLPOOL_SPA.vortexTangential) < 1e-9, 'tangential vortex remains in flipped spin direction');
});

test('waveDebrisPose: returns finite clamped pose and lifts y + surges z shoreward when active wave crest passes hz', () => {
  const zMin = -6, zMax = 6;
  const hx = -1.4, hz = 0.6, t = 1.8, phase = 0.5;

  const calmPose = waveDebrisPose(hx, hz, { active: false, crestZ: 0.6, amp: 0.55 }, t, phase, zMin, zMax);
  for (const k of ['x', 'y', 'z', 'pitch', 'roll']) {
    assert.ok(Number.isFinite(calmPose[k]), `calmPose.${k} must be finite`);
  }
  assert.ok(calmPose.z > zMin && calmPose.z < zMax, 'calm debris z stays within (zMin, zMax)');

  // Passing wave crest (`ws.crestZ === hz`) lifts debris upward (+y) and surges it shoreward (+z)
  const crestPose = waveDebrisPose(hx, hz, { active: true, crestZ: hz, amp: 0.55 }, t, phase, zMin, zMax);
  for (const k of ['x', 'y', 'z', 'pitch', 'roll']) {
    assert.ok(Number.isFinite(crestPose[k]), `crestPose.${k} must be finite`);
  }
  assert.ok(crestPose.y > calmPose.y + 0.25, `expected wave crest lift > calm y (${crestPose.y} vs ${calmPose.y})`);
  assert.ok(crestPose.z > calmPose.z + 0.50, `expected shoreward surge > calm z (${crestPose.z} vs ${calmPose.z})`);

  // Approaching crest (`crestZ < hz`) pitches bow up/back relative to receding crest (`crestZ > hz`)
  const approachPose = waveDebrisPose(hx, hz, { active: true, crestZ: hz - 0.9, amp: 0.55 }, t, phase, zMin, zMax);
  const recedePose = waveDebrisPose(hx, hz, { active: true, crestZ: hz + 0.9, amp: 0.55 }, t, phase, zMin, zMax);
  assert.notEqual(approachPose.pitch, recedePose.pitch);

  // Extreme home positions near basin walls clamp cleanly inside `(zMin, zMax)` even during peak wave surge
  const nearShore = waveDebrisPose(0, zMax - 0.1, { active: true, crestZ: zMax - 0.1, amp: 0.8 }, t, 0, zMin, zMax);
  const nearNozzle = waveDebrisPose(0, zMin + 0.1, null, Math.PI / 1.1, 0, zMin, zMax);
  assert.ok(nearShore.z > zMin && nearShore.z < zMax && nearShore.z <= zMax - 0.55, `clamped upper z=${nearShore.z}`);
  assert.ok(nearNozzle.z > zMin && nearNozzle.z < zMax && nearNozzle.z >= zMin + 0.55, `clamped lower z=${nearNozzle.z}`);
});

test('divingWell: cycles calm/warn/pull, spares surface & Air Bell swimmers, and pulls/grates exposed divers with drainCooldown', () => {
  // Phase cycle across period (8.0s): calm -> warn -> pull -> calm (and periodic wrap)
  const sCalm = divingWellState(1.2);
  assert.equal(sCalm.phase, 'calm');
  assert.equal(sCalm.strength, 0);

  const sWarn = divingWellState(DIVING_WELL.warnAt + 0.5);
  assert.equal(sWarn.phase, 'warn');
  assert.ok(sWarn.strength > 0 && sWarn.strength < 0.55);

  const tPullMid = (DIVING_WELL.pullAt + DIVING_WELL.pullEnd) * 0.5;
  const sPull = divingWellState(tPullMid);
  assert.equal(sPull.phase, 'pull');
  assert.ok(sPull.strength > 0.95, `expected peak pull strength near 1.0, got ${sPull.strength}`);

  assert.equal(divingWellState(DIVING_WELL.pullEnd + 0.15).phase, 'calm');
  assert.equal(divingWellState(DIVING_WELL.period + DIVING_WELL.warnAt + 0.2).phase, 'warn');

  let dw = makeDivingWell();
  assert.equal(dw.cooldown, 0);

  // Surface swimmers (`submerged: false`) and swimmers inside the Underwater Air Bell (`inAirBell: true`) stay completely unpulled & ungrated even right over the grate during `pull`
  const surf = stepDivingWell(dw, {
    dt: 0.1, t: tPullMid, inside: true, submerged: false, inAirBell: false,
    px: DIVING_WELL.grateX + 0.2, pz: DIVING_WELL.grateZ - 0.1,
  });
  assert.equal(surf.well.phase, 'pull');
  assert.equal(surf.pullX, 0);
  assert.equal(surf.pullZ, 0);
  assert.equal(surf.grated, false);

  const bell = stepDivingWell(dw, {
    dt: 0.1, t: tPullMid, inside: true, submerged: true, inAirBell: true,
    px: DIVING_WELL.grateX + 0.2, pz: DIVING_WELL.grateZ - 0.1,
  });
  assert.equal(bell.well.phase, 'pull');
  assert.equal(bell.pullX, 0);
  assert.equal(bell.pullZ, 0);
  assert.equal(bell.grated, false);

  // Submerged swimmer outside the Air Bell within pullRadius (but outside hitRadius) is pulled toward (grateX, grateZ) without grating
  const pullStep = stepDivingWell(dw, {
    dt: 0.1, t: tPullMid, inside: true, submerged: true, inAirBell: false,
    px: DIVING_WELL.grateX + 1.5, pz: DIVING_WELL.grateZ - 1.2,
  });
  const toGrateX = DIVING_WELL.grateX - (DIVING_WELL.grateX + 1.5);
  const toGrateZ = DIVING_WELL.grateZ - (DIVING_WELL.grateZ - 1.2);
  assert.ok(pullStep.pullX < 0 && pullStep.pullZ > 0, 'pull vector points toward central floor grate');
  assert.ok(pullStep.pullX * toGrateX + pullStep.pullZ * toGrateZ > 0);
  assert.equal(pullStep.grated, false);

  // Submerged swimmer within hitRadius triggers `grated === true` once and respects `drainCooldown`
  const hit1 = stepDivingWell(pullStep.state, {
    dt: 0.1, t: tPullMid, inside: true, submerged: true, inAirBell: false,
    px: DIVING_WELL.grateX + 0.25, pz: DIVING_WELL.grateZ - 0.2,
  });
  assert.equal(hit1.grated, true);
  assert.equal(hit1.state.cooldown, DIVING_WELL.drainCooldown);

  const hitCooldown = stepDivingWell(hit1.state, {
    dt: 0.1, t: tPullMid, inside: true, submerged: true, inAirBell: false,
    px: DIVING_WELL.grateX + 0.25, pz: DIVING_WELL.grateZ - 0.2,
  });
  assert.equal(hitCooldown.grated, false, 'grate hit respects drainCooldown');
  assert.ok(hitCooldown.state.cooldown > 0);

  // Once drainCooldown expires, entering hitRadius during pull grates again
  const hitRecovered = stepDivingWell(hitCooldown.state, {
    dt: DIVING_WELL.drainCooldown, t: tPullMid, inside: true, submerged: true, inAirBell: false,
    px: DIVING_WELL.grateX + 0.2, pz: DIVING_WELL.grateZ + 0.1,
  });
  assert.equal(hitRecovered.grated, true);
});

test('lagoonFloats: empty & calm/crouched waders stay safe, splashing wakes lunge & strike with cooldown, and snipLagoonFloat deflates until deflatedSec expires', () => {
  // 1. Empty floats (`occupied: false`) never wake or strike even when splashed beside, and ignore snip
  let empty = makeLagoonFloat(0, 0, false, 0.3);
  assert.equal(empty.occupied, false);
  assert.equal(snipLagoonFloat(empty), empty);
  for (let i = 0; i < 15; i++) {
    const res = stepLagoonFloat(empty, {
      dt: 0.1, t: i * 0.1, inside: true, inBasin: true, crouch: false,
      speed: LAGOON_FLOATS.splashSpeed + 1.1, px: 0.2, pz: 0.1,
    });
    empty = res.state;
    assert.equal(res.wokeNow, false);
    assert.equal(res.struck, false);
    assert.equal(empty.mode, 'bob');
  }

  // 2. Occupied floats stay in `'bob'` and never strike when walked past calmly (`speed <= splashSpeed`) or crouch-waded (`crouch: true`)
  let occ = makeLagoonFloat(0, 0, true, 0);
  for (let i = 0; i < 12; i++) {
    const calmRes = stepLagoonFloat(occ, {
      dt: 0.1, t: i * 0.1, inside: true, inBasin: true, crouch: false,
      speed: LAGOON_FLOATS.splashSpeed, px: 0.35, pz: 0.2,
    });
    occ = calmRes.state;
    assert.equal(calmRes.wokeNow, false);
    assert.equal(calmRes.struck, false);
    assert.equal(occ.mode, 'bob');
  }
  for (let i = 0; i < 12; i++) {
    const crouchRes = stepLagoonFloat(occ, {
      dt: 0.1, t: 2 + i * 0.1, inside: true, inBasin: true, crouch: true,
      speed: LAGOON_FLOATS.splashSpeed + 1.4, px: 0.35, pz: 0.2,
    });
    occ = crouchRes.state;
    assert.equal(crouchRes.wokeNow, false);
    assert.equal(crouchRes.struck, false);
    assert.equal(occ.mode, 'bob');
  }

  // 3. Splashing fast (`speed > splashSpeed && !crouch`) within `wakeDist` wakes occupied float to `'lunge'` and strikes on close contact with cooldown
  occ = makeLagoonFloat(0, 0, true, 0);
  const wakeRes = stepLagoonFloat(occ, {
    dt: 0.05, t: 3.0, inside: true, inBasin: true, crouch: false,
    speed: LAGOON_FLOATS.splashSpeed + 0.6, px: 1.35, pz: 0,
  });
  occ = wakeRes.state;
  assert.equal(wakeRes.wokeNow, true);
  assert.equal(occ.mode, 'lunge');
  assert.equal(wakeRes.struck, false);
  assert.ok(occ.x > 0, 'lunging float advances toward splashing wader');

  let struckOnce = false;
  for (let i = 0; i < 20; i++) {
    const step = stepLagoonFloat(occ, {
      dt: 0.06, t: 3.1 + i * 0.06, inside: true, inBasin: true, crouch: false,
      speed: LAGOON_FLOATS.splashSpeed + 0.6, px: 1.35, pz: 0,
    });
    occ = step.state;
    if (step.struck) {
      struckOnce = true;
      break;
    }
  }
  assert.equal(struckOnce, true);
  assert.equal(occ.mode, 'bob');
  assert.equal(occ.cooldown, LAGOON_FLOATS.cooldownDur);

  // Cooldown prevents immediate re-wake or second strike
  const duringCooldown = stepLagoonFloat(occ, {
    dt: 0.1, t: 4.5, inside: true, inBasin: true, crouch: false,
    speed: LAGOON_FLOATS.splashSpeed + 0.8, px: occ.x + 0.1, pz: occ.z,
  });
  assert.equal(duringCooldown.wokeNow, false);
  assert.equal(duringCooldown.struck, false);
  assert.equal(duringCooldown.state.mode, 'bob');

  // 4. `snipLagoonFloat` deflates an occupied float (`mode: 'deflated'`), preventing lunges until `deflatedSec` expires
  let snipped = snipLagoonFloat(makeLagoonFloat(0, 0, true, 0));
  assert.equal(snipped.mode, 'deflated');
  assert.equal(snipped.deflatedSec, LAGOON_FLOATS.deflatedDur);

  // Splashing fast beside a deflated float cannot wake or trigger a strike while deflatedSec > 0
  for (let i = 0; i < 20; i++) {
    const step = stepLagoonFloat(snipped, {
      dt: 0.3, t: 5.0 + i * 0.3, inside: true, inBasin: true, crouch: false,
      speed: LAGOON_FLOATS.splashSpeed + 1.0, px: 0.3, pz: 0.1,
    });
    snipped = step.state;
    assert.equal(step.wokeNow, false);
    assert.equal(step.struck, false);
    assert.equal(snipped.mode, 'deflated');
  }
  assert.ok(snipped.deflatedSec > 0);

  // Advancing past the remaining deflatedSec restores `'bob'`, after which splashing wakes it again
  for (let i = 0; i < 10; i++) {
    snipped = stepLagoonFloat(snipped, {
      dt: 0.3, t: 12.0 + i * 0.3, inside: true, inBasin: true, crouch: true,
      speed: 0.2, px: 2.5, pz: 2.5,
    }).state;
  }
  assert.equal(snipped.deflatedSec, 0);
  assert.equal(snipped.mode, 'bob');

  const reWake = stepLagoonFloat(snipped, {
    dt: 0.05, t: 16.0, inside: true, inBasin: true, crouch: false,
    speed: LAGOON_FLOATS.splashSpeed + 0.7, px: snipped.x + 1.1, pz: snipped.z,
  });
  assert.equal(reWake.wokeNow, true);
  assert.equal(reWake.state.mode, 'lunge');
});

test('WRONG_KEYS & POOL_THINGS export integrity and forced plain-room oddities build cleanly', async (t) => {
  const expectedWrongKeys = [
    'ceilingPool',
    'ceilingLadder',
    'floatPile',
    'alienWallMural',
    'deadSlide',
    'lowBoard',
    'upwardPuddleStream',
    'ceilingLoungerRow',
  ];
  const expectedPoolThings = ['floatring', 'noodle', 'lounger'];

  assert.equal(Object.isFrozen(WRONG_KEYS), true, 'WRONG_KEYS should be frozen');
  assert.deepEqual([...WRONG_KEYS], expectedWrongKeys);
  for (const key of expectedWrongKeys) {
    assert.equal(typeof WRONG[key], 'function', `WRONG.${key} must be a function`);
  }

  assert.deepEqual(Object.keys(POOL_THINGS), expectedPoolThings);
  for (const key of expectedPoolThings) {
    assert.equal(typeof POOL_THINGS[key], 'function', `POOL_THINGS.${key} must be a function`);
  }

  // Verify every forced WRONG oddity and POOL_THINGS builder executes cleanly inside a plain waterpark room
  const prevDoc = globalThis.document;
  const prevWarn = console.warn;
  const warnings = [];
  const draw = new Proxy({}, {
    get: (_, k) => k === 'measureText' ? (txt) => ({ width: String(txt).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ getContext: () => draw, width: 128, height: 128 }) };
  console.warn = (...args) => { warnings.push(args.join(' ')); };
  t.after(() => {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    console.warn = prevWarn;
    delete globalThis.__waterparkWrong;
  });

  const kit = createKit();
  t.after(() => kit.dispose());

  const plainLevel = generate('wp-plain-oddities', { theme: 'waterpark' });
  const rawPlain = plainLevel.rooms.find((r) => r.kind === 'plain' && !r.crawl && !r.shape && r.W >= 7 && r.D >= 7)
    || plainLevel.rooms.find((r) => r.kind === 'plain' && !r.crawl);
  assert.ok(rawPlain, 'found plain waterpark room');
  const plainDef = { ...rawPlain, id: 0, doors: rawPlain.doors.map((d) => ({ ...d, to: 0 })), links: [], wins: [] };

  const makePlainEnv = (extraBuild) => ({
    catalogue: { has: () => false, geo: () => null },
    builders: {
      plain: (c) => {
        c.shell();
        extraBuild?.(c);
        poolroom(c);
      },
    },
    cast: [],
    sound: new Proxy({}, { get: () => () => {} }),
    inventory: { held: () => null, torchPower: () => 0, drainBattery: () => {}, fire: { threatAt: () => null } },
    health: { damage: () => ({ ok: true, dead: false }), heal: () => true },
    hud: { glitch() {}, flash() {}, flag() {} },
    run: { met() {}, survived() {}, itemFound() {} },
    player: { RADIUS: 0.22, warp() {} },
    sees: () => false,
    play() {},
    interfere() {},
  });

  for (const wrongKey of expectedWrongKeys) {
    warnings.length = 0;
    globalThis.__waterparkWrong = wrongKey;
    const env = makePlainEnv();
    const world = await buildWorld(kit, { ...plainLevel, rooms: [plainDef], links: [], windows: [] }, env);
    env.world = world;
    try {
      assert.deepEqual(warnings, [], `WRONG.${wrongKey}: unexpected warnings: ${warnings.join('; ')}`);
      const rt = world.rooms[0];
      assert.ok(rt.lights.length <= 16, `WRONG.${wrongKey}: lights ${rt.lights.length} > 16`);
      const me = { ...toWorld(plainDef, 0, 0), y: (plainDef.y || 0) + 1.65, yaw: 0, pitch: 0, speed: 1.0, moving: true, inside: true };
      world.update(0.05, 0.1, me);
    } finally {
      world.dispose();
    }
  }
  delete globalThis.__waterparkWrong;

  warnings.length = 0;
  const thingsEnv = makePlainEnv((c) => {
    expectedPoolThings.forEach((kind, idx) => {
      POOL_THINGS[kind](c, { type: kind, seed: idx + 1, turn: idx * 0.9 });
    });
  });
  const thingsWorld = await buildWorld(kit, { ...plainLevel, rooms: [plainDef], links: [], windows: [] }, thingsEnv);
  try {
    assert.deepEqual(warnings, [], `POOL_THINGS: unexpected warnings: ${warnings.join('; ')}`);
  } finally {
    thingsWorld.dispose();
  }
});
