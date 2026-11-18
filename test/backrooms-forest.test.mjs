// Tests for The Offsite Reserve (`forest`) floor:
// pure peat-bog & dry-bracken stealth rules, notched timber felling & log
// bridges, loose bog duckboards, Coat-Rack Buck hunter, Trail Spotter, Retreat
// Facilitator, Manila Bagworm Husk, Trail Loop puzzle, carried `call` item,
// all 8 WRONG plain-room oddities, and theme/generator isolation while `dealt: false`.

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
    FOREST, makeForestWalker, stepForestWalker,
    makeTimber, stepTimber, timberBridgeAt,
    makeDuckboard, stepDuckboard,
    BUCK, makeBuck, stepBuck, snipBuck, buckGait,
    SPOTTER, makeSpotter, stepSpotter,
    FACILITATOR, makeFacilitator, stepFacilitator, snipFacilitator,
    BAGWORM, makeBagworm, stepBagworm, snipBagworm,
    makeBlazePuzzle, stepBlazePuzzle,
    SMOKE, makeSmoke, stepSmoke,
    MARSHAL, makeMarshal, stepMarshal, snipMarshal,
    DOZER, makeDozer, stepDozer,
    stepCanopyBanks, makeRippleState, pushWaterRipple,
    AUDITOR, makeAuditor, stepAuditor, snipAuditor,
    EYEBIRCH, makeEyeGrove, stepEyeGrove,
    LIGHTS_OUT, nearestTent,
  },
  { WRONG_KEYS },
  { makeCoatRackBuckRig },
  { createKit },
  { THEMES, atHome, dealtThemes },
  { DECK, isBig, generate, toWorld },
  { planVisit },
  { ITEM_DEFS, normalizeItemType },
  { buildWorld, loadCatalogue },
  { BUILDERS },
] = await Promise.all([
  import('../public/world/backrooms/forest.rule.js'),
  import('../public/world/backrooms/forest.js'),
  import('../public/world/backrooms/stag.js'),
  import('../public/world/backrooms/kit.js'),
  import('../public/world/backrooms/themes.js'),
  import('../public/world/backrooms/gen.js'),
  import('../public/world/backrooms/plan.js'),
  import('../public/world/backrooms/inventory-state.js'),
  import('../public/world/backrooms/world.js'),
  import('../public/world/backrooms/rooms.js'),
]);

const FOREST_ROOMS = [
  'lights-out',
  'trailhead',
  'timber-lot',
  'canopy-walk',
  'blaze-junction',
  'campfire-circle',
  'bog-boardwalk',
  'fire-lookout',
  'hollow-tree',
  'burn-scar',
  'clear-cut',
  'old-growth',
  'tree-farm',
  'windthrow',
  'nursery-aisles',
  'inverted-grove',
];

test('forest.rule.js stays 100% pure (zero imports, no three.js, DOM, or I/O)', () => {
  const src = readFileSync(new URL('../public/world/backrooms/forest.rule.js', import.meta.url), 'utf8');
  assert.ok(!/^import\b/m.test(src), 'forest.rule.js must have zero imports');
  assert.ok(!/document\.|window\.|localStorage|fetch\s*\(/i.test(src));
});

test('the Trail Call is cut: no such item, and nothing registers for one', () => {
  assert.equal(ITEM_DEFS.call, undefined, 'the item is gone');
  assert.equal(normalizeItemType('call'), null, 'and is not a type a room may leave');
});

test('stepForestWalker: peat-bog drag/sink, felled bridge support, wet-stone slip, and C-crouch bracken stealth', () => {
  let s = makeForestWalker();

  // Wading into peat bog slows movement to 0.54x and sinks eye
  let res = stepForestWalker(s, 0.1, { inBog: true, onBridge: false, inBracken: false, speed: 1.4, crouch: false, hurry: false });
  s = res.state;
  assert.equal(s.inBog, true);
  assert.equal(res.events.enteredBog, true);
  assert.equal(res.events.splash, true);
  assert.equal(res.slow, FOREST.bogDrag);
  assert.equal(res.sink, FOREST.bogSink);

  // Walking on a felled log bridge over the same bog stays completely dry and full speed
  res = stepForestWalker(s, 0.1, { inBog: true, onBridge: true, inBracken: false, speed: 3.1, crouch: false, hurry: true });
  assert.equal(res.slow < 0.6 && res.events.slipped, true, 'sprinting straight out of bog onto wet surface slips once');
  const resAfterSlip = stepForestWalker(res.state, 0.6, { inBog: true, onBridge: true, inBracken: false, speed: 1.5, crouch: false, hurry: false });
  assert.equal(resAfterSlip.slow, 1);
  assert.equal(resAfterSlip.sink, 0);

  // Crouching (`crouch: true`) in dry bracken makes zero noise; walking upright fast crunches loudly
  let stealth = makeForestWalker();
  for (let i = 0; i < 8; i++) {
    const step = stepForestWalker(stealth, 0.1, { inBog: false, onBridge: false, inBracken: true, speed: 2.0, crouch: true, hurry: false });
    stealth = step.state;
    assert.equal(step.events.rustled, false, 'crouching in bracken is silent');
    assert.equal(stealth.rustleAlert, 0);
  }
  const loud = stepForestWalker(stealth, 0.1, { inBog: false, onBridge: false, inBracken: true, speed: 2.0, crouch: false, hurry: false });
  assert.equal(loud.events.rustled, true);
  assert.ok(loud.state.rustleAlert > 1.0);
});

test('makeTimber, stepTimber & timberBridgeAt: wrong side shudders, orange-blaze lean fells trunk into walkable bridge', () => {
  let tb = makeTimber({ x: 0, z: 2.0, dirX: 0, dirZ: -1, length: 3.8, radius: 0.25, bridgeY: 0.12 });
  assert.equal(timberBridgeAt(tb, 0, 0).on, false);

  const wrong = stepTimber(tb, 0.1, { leanedWrongSide: true });
  assert.equal(wrong.refused, true);
  assert.equal(wrong.state.mode, 'standing');

  let cracked = false, slammed = false;
  let cur = wrong.state;
  for (let i = 0; i < 20; i++) {
    const step = stepTimber(cur, 0.1, { leanedRightSide: i === 0 });
    cur = step.state;
    if (step.cracked) cracked = true;
    if (step.slammed) slammed = true;
  }
  assert.equal(cracked, true);
  assert.equal(slammed, true);
  assert.equal(cur.mode, 'felled');
  assert.equal(timberBridgeAt(cur, 0, 0.2).on, true);
  assert.equal(timberBridgeAt(cur, 0, 0.2).y, 0.12);
  assert.equal(timberBridgeAt(cur, 1.5, 0.2).on, false);
});

test('stepDuckboard: creaks early, plunges under water at 0.85s if lingered on, and rises when stepped off', () => {
  let d = makeDuckboard(3);
  let creaked = false, plunged = false;
  for (let i = 0; i < 12; i++) {
    const r = stepDuckboard(d, 0.1, 1);
    d = r.state;
    if (r.creakedIdx === 1) creaked = true;
    if (r.plungedIdx === 1) plunged = true;
  }
  assert.equal(creaked, true);
  assert.equal(plunged, true);
  assert.equal(stepDuckboard(d, 0.01, 1).sunkMask[1], true);

  for (let i = 0; i < 15; i++) d = stepDuckboard(d, 0.1, -1).state;
  assert.equal(d.loads[1], 0);
});

test('Coat-Rack Buck (`stepBuck`, `snipBuck`, `buckGait`, `stag.js`): wakes on beam/bracken, telegraphs scrape, wedges on trunk collision, lures on Trail Call, and builds rig', () => {
  let b = makeBuck(0, -2.5);
  assert.equal(b.mode, 'rack');

  // Quiet dark walker stays ignored
  let res = stepBuck(b, { dt: 0.2, inside: true, dist: 5.5, clearLine: true, beamOnBuck: false, rustled: false, running: false });
  assert.equal(res.state.mode, 'rack');

  // Trail Call whistle lures disguised Buck into `decoy` investigation
  const lured = stepBuck(b, { dt: 0.1, inside: true, dist: 7.0, heardCall: true, callX: 4.5, callZ: 2.0 });
  assert.equal(lured.state.mode, 'decoy');
  assert.equal(lured.rattled, true);

  // Shining torch beam directly at the Buck triggers `scrape` telegraph -> `charge`
  res = stepBuck(b, { dt: 0.1, inside: true, dist: 6.0, clearLine: true, beamOnBuck: true, buckX: 0, buckZ: -2.5, playerX: 0, playerZ: 3.5 });
  b = res.state;
  assert.equal(b.mode, 'scrape');
  assert.equal(res.rattled, true);

  for (let i = 0; i < 12; i++) {
    res = stepBuck(b, { dt: 0.1, inside: true, dist: 5.5, clearLine: true, beamOnBuck: false, buckX: 0, buckZ: -2.5, playerX: 0, playerZ: 3.5 });
    b = res.state;
    if (b.mode === 'charge' && res.speed > 0) break;
  }
  assert.equal(b.mode, 'charge');
  assert.equal(res.speed, BUCK.chargeSpeed);

  // Slamming into a tree trunk (`blockedMove: true` after advancing > 0.35 m) wedges its coat-hook antlers for 3.4s!
  b = stepBuck(b, { dt: 0.1, inside: true, dist: 4.0, buckX: 0, buckZ: -1.8, playerX: 2.0, playerZ: 3.5, blockedMove: false }).state;
  const wedged = stepBuck(b, { dt: 0.1, inside: true, dist: 3.6, buckX: 0, buckZ: -1.2, playerX: 2.0, playerZ: 3.5, blockedMove: true });
  assert.equal(wedged.wedgedNow, true);
  assert.equal(wedged.state.mode, 'wedged');
  assert.equal(wedged.state.timer, BUCK.wedgedTime);

  // Safety Scissors `snipBuck` recoils it
  const snipped = snipBuck(wedged.state);
  assert.equal(snipped.mode, 'recoil');

  // Gait & 3D Vox rig sanity check
  const g0 = buckGait(0, 0, 'rack');
  const g1 = buckGait(1.2, 1, 'charge');
  assert.equal(g0.legs.length, 4);
  assert.ok(g1.headPitch > g0.headPitch);

  const prevDoc = globalThis.document;
  const draw = new Proxy({}, {
    get: (_, k) => k === 'measureText' ? (txt) => ({ width: String(txt).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ getContext: () => draw, width: 64, height: 64 }) };
  try {
    const kit = createKit();
    const rig = makeCoatRackBuckRig(kit, 'test');
    rig.pose({ unfold: 1, stride: 1.4, speed: 5.7, time: 0.5, mode: 'charge', headYaw: 0.2, dt: 0.016 });
    assert.ok(rig.group.children.length > 0);
    kit.dispose();
  } finally {
    globalThis.document = prevDoc;
  }
});

test('Trail Spotter, Retreat Facilitator & Manila Bagworm Husk follow fair, readable rules', () => {
  // 1. Trail Spotter: resets charge when watched; flashes off-trail visitor when unwatched, then relocates
  let sp = makeSpotter(0);
  for (let i = 0; i < 6; i++) sp = stepSpotter(sp, 0.1, { inside: true, offTrail: true, clearLine: true, watched: false, unseen: true }).state;
  assert.ok(sp.charge > 0.4);
  sp = stepSpotter(sp, 0.25, { inside: true, offTrail: true, clearLine: true, watched: true, unseen: false }).state;
  assert.ok(sp.charge < 0.2, 'watching the Spotter resets its shutter wind-up');
  let flashed = false;
  for (let i = 0; i < 12; i++) {
    const r = stepSpotter(sp, 0.1, { inside: true, offTrail: true, clearLine: true, watched: false, unseen: true });
    sp = r.state;
    if (r.flashed) { flashed = true; break; }
  }
  assert.equal(flashed, true);
  assert.equal(SPOTTER.drainShare, 0.16);
  const rel = stepSpotter(sp, 0.1, { inside: true, offTrail: false, clearLine: true, watched: false, unseen: true });
  assert.equal(rel.relocated, true);

  // 2. Retreat Facilitator: heals on polite `[E]` accept, snaps if back is turned within 4.5 m
  let fac = makeFacilitator();
  fac = stepFacilitator(fac, 0.1, { inside: true, dist: 3.0, atHome: true }).state;
  assert.equal(fac.mode, 'offer');
  const healed = stepFacilitator(fac, 0.1, { inside: true, dist: 1.2, took: true });
  assert.equal(healed.event, 'healed');
  assert.equal(healed.state.rations, FACILITATOR.rations - 1);

  let fac2 = stepFacilitator(makeFacilitator(), 0.1, { inside: true, dist: 2.5, atHome: true }).state;
  let snapped = false;
  for (let i = 0; i < 20; i++) {
    const r = stepFacilitator(fac2, 0.1, { inside: true, dist: 2.5, turnedBack: true });
    fac2 = r.state;
    if (r.event === 'snapped') { snapped = true; break; }
  }
  assert.equal(snapped, true);
  assert.equal(fac2.mode, 'lunge');
  assert.equal(snipFacilitator(fac2).mode, 'recoil');

  // 3. Manila Bagworm Husk: ignores crouched walker, warns & drops on loud walker, calms on Trail Call or snip
  let bw = makeBagworm(0, 0, 5.0, 1.4);
  for (let i = 0; i < 10; i++) {
    bw = stepBagworm(bw, 0.1, { horizDist: 0.6, playerY: 0, speed: 2.2, crouch: true, heardCall: false }).state;
    assert.equal(bw.mode, 'perched', 'crouching underneath never wakes Bagworm');
  }
  const warn = stepBagworm(bw, 0.1, { horizDist: 0.8, playerY: 0, speed: 2.4, crouch: false, heardCall: false });
  assert.equal(warn.warned, true);
  assert.equal(warn.state.mode, 'windup');
  const calmed = stepBagworm(warn.state, 0.1, { horizDist: 0.8, playerY: 0, speed: 2.4, crouch: false, heardCall: true });
  assert.equal(calmed.state.mode, 'calmed');
  assert.equal(snipBagworm(warn.state).mode, 'calmed');
});

test('Trail Loop (`makeBlazePuzzle` & `stepBlazePuzzle`): unwatched decoy arrows shift, Trail Call echoes true post, true latch solves', () => {
  let pz = makeBlazePuzzle(5, 3, 5);
  assert.equal(pz.rings[3], 5);
  assert.ok(pz.rings.every((r, idx) => idx === 3 || r !== 5), 'only the true stump has targetRings');

  // Looking away from decoy post 0 rotates its arrow; looking away from true post 3 never rotates it
  const prev0 = pz.pointTo[0];
  const shuf = stepBlazePuzzle(pz, { seenMask: [false, true, true, false, true] });
  pz = shuf.state;
  assert.equal(shuf.shuffled, true);
  assert.notEqual(pz.pointTo[0], prev0);
  assert.equal(pz.pointTo[3], 3);

  // Trail Call echoes from `trueIdx` (3)
  assert.equal(stepBlazePuzzle(pz, { rangCall: true }).chimedIdx, 3);

  // Wrong latch shocks; true latch solves and locks every arrow onto post 3
  const bad = stepBlazePuzzle(pz, { triedIdx: 1 });
  assert.equal(bad.shocked, true);
  assert.equal(bad.state.solved, false);

  const win = stepBlazePuzzle(bad.state, { triedIdx: 3 });
  assert.equal(win.opened, true);
  assert.equal(win.state.solved, true);
  assert.deepEqual(win.state.pointTo, [3, 3, 3, 3, 3]);
});

test('forest theme isolation, generation, and WRONG table: dealt, strictly isolated, deals all 8 rooms when requested', () => {
  assert.equal(THEMES.forest.own, true);
  assert.notEqual(THEMES.forest.dealt, false);
  assert.ok(dealtThemes().includes('forest'), 'the forest is dealt to ordinary visits (the owner, 18 Nov)');
  assert.equal(WRONG_KEYS.length, 8, 'all 8 plain-room forest wrongnesses exist');

  for (const id of FOREST_ROOMS) {
    const entry = DECK.find((d) => d.id === id);
    assert.ok(entry, `missing deck entry for ${id}`);
    assert.ok(atHome(entry, 'forest') > 0);
    for (const other of ['yellow', 'archive', 'night', 'fitout', 'exec', 'suburb', 'waterpark']) {
      assert.equal(atHome(entry, other), 0, `${id} must not deal onto ${other}`);
    }
  }
  for (const entry of DECK) {
    if (!FOREST_ROOMS.includes(entry.id)) {
      assert.equal(atHome(entry, 'forest'), 0, `non-forest room ${entry.id} leaked onto forest`);
    }
  }

  const seenSpecials = new Set();
  const seenMotifs = new Set();
  for (let s = 1; s <= 60; s++) {
    const visit = planVisit(`forest-visit-${s}`, { themes: ['forest', 'forest', 'forest'] });
    for (const f of visit.floors) {
      if (f.theme === 'forest') {
        for (const id of f.hand) {
          if (id === 'dispatch' || id === 'mecha') continue;
          assert.ok(FOREST_ROOMS.includes(id), `unexpected special ${id} on forest floor`);
          seenSpecials.add(id);
        }
      }
    }
    const lvl = generate(`forest-gen-${s}`, { theme: 'forest' });
    for (const r of lvl.rooms) {
      if (r.quiet) seenMotifs.add(r.quiet.kind);
      if (r.kind === 'plain') assert.equal(r.look.floor, 'moss');
    }
  }
  for (const id of FOREST_ROOMS) {
    assert.ok(seenSpecials.has(id), `expected ${id} to be dealt on forest visits`);
  }
  assert.ok(seenMotifs.has('thicket'), 'expected thicket motif in plain forest rooms');
});

test('Burn Scar (`stepSmoke`, `stepMarshal`, `snipMarshal`) & Development (`stepDozer`) rules are pure, readable, and fair', () => {
  // 1. Smoke layer: standing eye (1.1 m) fogs & drains camcorder periodically; crouched eye (0.6 m) stays completely clear!
  let sm = makeSmoke();
  for (let i = 0; i < 15; i++) {
    const r = stepSmoke(sm, 0.2, { inSmoke: true, eyeY: 0.6 });
    sm = r.state;
    assert.equal(sm.exposed, false, 'crouched visitor stays below SMOKE.under');
    assert.equal(r.drain, 0);
  }
  let drained = 0;
  for (let i = 0; i < 15; i++) {
    const r = stepSmoke(sm, 0.2, { inSmoke: true, eyeY: 1.1 });
    sm = r.state;
    drained += r.drain;
  }
  assert.equal(sm.exposed, true);
  assert.ok(drained >= SMOKE.share, 'standing in smoke drains camcorder battery over time');

  // 2. Fire Marshal: chirps on exposed visitor, pursues, loses lock when crouched under smoke, and stands down on snip!
  let mr = makeMarshal();
  let stepM = stepMarshal(mr, 0.1, { inside: true, exposed: true, dist: 5.0, clearLine: true });
  mr = stepM.state;
  assert.equal(stepM.event, 'chirp');
  assert.equal(mr.mode, 'chirp');
  for (let i = 0; i < 12; i++) mr = stepMarshal(mr, 0.1, { inside: true, exposed: true, dist: 4.5, clearLine: true }).state;
  assert.equal(mr.mode, 'pursue');
  let lost = false;
  for (let i = 0; i < 15; i++) {
    const r = stepMarshal(mr, 0.1, { inside: true, exposed: false, dist: 4.0, clearLine: true });
    mr = r.state;
    if (r.event === 'lost') lost = true;
  }
  assert.equal(lost, true);
  assert.equal(mr.mode, 'patrol');
  assert.equal(snipMarshal({ ...mr, mode: 'pursue' }).mode, 'cool');
  assert.ok(MARSHAL.pursue > MARSHAL.walk);

  // 3. Bulldozer: wakes when visitor enters, advances forward, pauses, reverses with beep, advances to farther pass, and stops on shutoff!
  let dz = makeDozer(-6, [-1, 3, 7]);
  assert.equal(dz.mode, 'idle');
  let sDz = stepDozer(dz, 0.1, { inside: true });
  dz = sDz.state;
  assert.equal(sDz.started, true);
  assert.equal(dz.mode, 'forward');
  let sawBeep = false;
  for (let i = 0; i < 140; i++) {
    sDz = stepDozer(dz, 0.1, { inside: true });
    dz = sDz.state;
    if (sDz.beep) sawBeep = true;
  }
  assert.equal(sawBeep, true, 'bulldozer sounds backup beep during reverse pass');
  assert.ok(dz.pass >= 1, 'bulldozer advances to next longer pass after completing reverse');
  const halted = stepDozer(dz, 0.1, { inside: true, shutoff: true });
  assert.equal(halted.stopped, true);
  assert.equal(halted.state.mode, 'stopped');
  assert.equal(stepDozer(halted.state, 0.5, { inside: true }).dir, 0);
  assert.ok(DOZER.speed > 0);
});

test('Dynamic 4-bank woodland lighting (`stepCanopyBanks`) & interactive water ripple ring (`pushWaterRipple`) are pure and deterministic', () => {
  for (const mode of ['canopy', 'swamp', 'ember', 'islands', 'clearcut']) {
    const steady = stepCanopyBanks(mode, 12.5, { steady: true });
    assert.equal(steady.length, 4);
    assert.deepEqual(steady, stepCanopyBanks(mode, 99.2, { steady: true }), `${mode}: steady accessibility mode never animates`);
    const a = stepCanopyBanks(mode, 1.0, { seed: 7 });
    const b = stepCanopyBanks(mode, 3.4, { seed: 7 });
    // (the ceiling's three banks hold still; only what the room lights itself with moves, and a lantern does not)
    assert.deepEqual(a.slice(0, 3), b.slice(0, 3), `${mode}: the ceiling's banks do not move`);
    assert.deepEqual(a.slice(0, 3), steady.slice(0, 3), `${mode}: and are the steady levels`);
    if (mode === 'canopy') assert.equal(a[3], b[3], 'a lantern is steady');
    else assert.notEqual(a[3], b[3], `${mode}: the room's own light moves`);
    assert.ok(a.every((v) => v > 0 && v <= 1.35));
    assert.deepEqual(stepCanopyBanks(mode, 4.0, { effect: 0.2 }), [1, 1, 1, 0], 'creature blackouts bypass canopy modulation cleanly');
  }

  let ring = makeRippleState(6);
  for (let i = 0; i < 8; i++) {
    ring = pushWaterRipple(ring, i * 0.5, -i * 0.25, i * 0.5, 2.5);
  }
  assert.equal(ring.cursor, 2, '6-slot ripple ring wraps cleanly');
  assert.deepEqual(ring.ripples[1], [3.5, -1.75, 3.5, 1.6], 'clamps strength to 1.6 and stores latest wrapped entry');
});

test('Timber Auditor (`stepAuditor`, `snipAuditor`) & Eye-Scar Birches (`stepEyeGrove`) follow fair, readable rules', () => {
  // 1. Timber Auditor: freezes when watched or lit by flashlight beam, stalks when unseen, speeds toward rung chime, cools on strike/snip
  let au = makeAuditor(-2, -3);
  assert.equal(au.mode, 'mimic');

  // Watched or in beam -> speed 0, stays mimic
  assert.equal(stepAuditor(au, 0.2, { inside: true, px: 2, pz: 2, ax: -2, az: -3, watched: true, inBeam: false }).speed, 0);

  // Unseen -> creaks once and stalks at walkSpeed (boosted in dark banks)
  const st1 = stepAuditor(au, 0.2, { inside: true, px: 2, pz: 2, ax: -2, az: -3, watched: false, inBeam: false, bankLevel: 0.4 });
  au = st1.state;
  assert.equal(st1.event, 'creak');
  assert.equal(au.mode, 'stalk');
  assert.equal(st1.speed, AUDITOR.walkSpeed * AUDITOR.darkBoost);

  // Shining torch beam immediately freezes it back into a tree trunk
  const frozen = stepAuditor(au, 0.2, { inside: true, px: 2, pz: 2, ax: -1.5, az: -2.5, watched: false, inBeam: true });
  assert.equal(frozen.speed, 0);
  assert.equal(frozen.state.mode, 'mimic');

  // Brushing an ID-lanyard chime lures it at chimeSpeed toward the chime
  const lured = stepAuditor(frozen.state, 0.2, { inside: true, px: 2, pz: 2, ax: -1.5, az: -2.5, watched: false, inBeam: false, chimePos: { x: 4, z: -4 }, bankLevel: 1.0 });
  assert.equal(lured.state.mode, 'lured');
  assert.equal(lured.speed, AUDITOR.chimeSpeed);

  // Strike reach triggers `struck` + `cool`, and Safety Scissors snips into `cool`
  const hit = stepAuditor(makeAuditor(0, 0), 0.1, { inside: true, px: 0.3, pz: 0.2, ax: 0, az: 0, watched: false, inBeam: false });
  assert.equal(hit.event, 'struck');
  assert.equal(hit.state.mode, 'cool');
  assert.equal(snipAuditor(st1.state).mode, 'cool');

  // 2. Eye-Scar Birches: C-crouch stays below eye level, torch beam shuts eyes for 5s, upright closeness whispers & drains 10% battery
  let eg = makeEyeGrove(3);
  for (let i = 0; i < 10; i++) {
    const r = stepEyeGrove(eg, 0.1, { inside: true, crouch: true, dists: [1.2, 5.0, 5.0], litMask: [false, false, false] });
    eg = r.state;
    assert.equal(r.drained, 0, 'crouching visitor stays below birch eye-scars');
  }
  const shutRes = stepEyeGrove(eg, 0.1, { inside: true, crouch: false, dists: [1.2, 5.0, 5.0], litMask: [true, false, false] });
  assert.equal(shutRes.blinkedShut, true);
  assert.equal(shutRes.state.shut[0], EYEBIRCH.shutTime);
  assert.equal(shutRes.drained, 0, 'torch-shut eye-birch cannot drain battery');

  let eg2 = makeEyeGrove(2);
  let whispered = false, drained = 0;
  for (let i = 0; i < 10; i++) {
    const r = stepEyeGrove(eg2, 0.1, { inside: true, crouch: false, dists: [1.4, 6.0], litMask: [false, false] });
    eg2 = r.state;
    if (r.whispered) whispered = true;
    drained += r.drained;
  }
  assert.equal(whispered, true);
  assert.equal(drained, EYEBIRCH.drainShare);
});

test('buildWorld builds all 15 forest deck rooms and all 8 forced WRONG oddities within two-tier 250k/500k budgets and with zero doorway warnings', async (t) => {
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
    globalThis.document = prevDoc;
    console.warn = prevWarn;
    delete globalThis.__forestWrong;
  });

  const kit = createKit();
  t.after(() => kit.dispose());
  const catalogue = await loadCatalogue(kit);

  const roomModules = Object.fromEntries(
    await Promise.all(
      FOREST_ROOMS.map(async (id) => [id, (await import(`../public/world/backrooms/rooms/${id}.js`)).build]),
    ),
  );
  const builders = { ...BUILDERS, ...roomModules };

  function makeEnv() {
    const denizens = new Map();
    return {
      catalogue,
      builders,
      hatches: new Map(),
      creations: {},
      cast: [{ name: 'Ivory Marten', look: {} }, { name: 'Amber Vireo', look: {} }],
      sound: new Proxy({}, { get: () => () => {} }),
      denizens: {
        add(id, spec) { denizens.set(id, spec); },
        remove(id) { denizens.delete(id); },
        get map() { return denizens; },
      },
      inventory: {
        held: () => null,
        torchPower: () => 0,
        drainBattery: () => {},
      },
      health: { damage: () => ({ ok: true, dead: false }), heal: () => true },
      hud: { glitch() {}, flash() {} },
      run: { met() {}, survived() {}, itemFound() {} },
      player: { RADIUS: 0.22, crouch: false, hurry: false, lean: { side: 0, dx: 0, dz: 0 }, warp() {}, addImpulse() {}, addDrag() {}, setFloorSink() {} },
      sees: () => false,
      play() {},
      hold: () => () => {},
      descend: () => {},
    };
  }

  // 1. Every special room in FOREST_ROOMS builds, passes doorway flood-fill without warnings, fits budgets, and ticks cleanly
  for (const id of FOREST_ROOMS) {
    warnings.length = 0;
    const arch = DECK.find((a) => a.id === id);
    const level = generate(`forest-room-${id}`, { theme: 'forest', only: [id] });
    const rawDef = level.rooms.find((r) => r.arch === id);
    assert.ok(rawDef, `generated room ${id}`);
    const def = { ...rawDef, id: 0, doors: rawDef.doors.map((d) => ({ ...d, to: 0 })), links: [], wins: [] };
    const env = makeEnv();
    const world = await buildWorld(kit, { ...level, rooms: [def], links: [], windows: [] }, env);
    env.world = world;
    try {
      assert.deepEqual(warnings, [], `${id}: unexpected world.walkable / collider warnings: ${warnings.join('; ')}`);
      const rt = world.rooms[0];
      let ordMeshes = 0, detMeshes = 0, ordTris = 0, detTris = 0;
      rt.group.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        if (o.userData?.detail) { detMeshes++; detTris += tris; }
        else { ordMeshes++; ordTris += tris; }
      });
      const totalTris = ordTris + detTris;
      const maxOrdTris = isBig(arch) ? 240000 : 120000;
      const maxTotalTris = isBig(arch) ? 500000 : 250000;
      assert.ok(rt.lights.length <= 16, `${id}: lights ${rt.lights.length} > 16`);
      // (lights-out is the one forest room with no ceiling light and no planting: a dark room of tents on bare carpet)
      if (id !== 'lights-out') assert.equal(rt.lighting?.bankCount, 4, `${id}: expected 4-bank dynamic woodland lighting`);
      assert.ok(ordMeshes <= 45, `${id}: ordinary meshes ${ordMeshes} > 45`);
      assert.ok(detMeshes <= 12, `${id}: detail meshes ${detMeshes} > 12`);
      if (id !== 'lights-out') assert.ok(detTris > 0, `${id}: expected detail: true meshes to carry woodland detail`);
      assert.ok(ordTris <= maxOrdTris, `${id}: ordinary triangles ${Math.round(ordTris)} > ${maxOrdTris}`);
      assert.ok(totalTris <= maxTotalTris, `${id}: total triangles ${Math.round(totalTris)} > ${maxTotalTris}`);
      if (['old-growth', 'tree-farm', 'windthrow', 'nursery-aisles', 'inverted-grove'].includes(id)) {
        assert.ok((rt.treeCount || 0) >= 28, `${id}: expected high tree density, got ${rt.treeCount}`);
      }
      if (['trailhead', 'old-growth', 'timber-lot', 'fire-lookout', 'clear-cut', 'tree-farm'].includes(id)) {
        assert.equal(typeof rt.pnwTopAt, 'function', `${id}: expected Pacific Northwest stepped terrain height sampler`);
      }
      for (const leftItem of rt.left || []) {
        assert.notEqual(normalizeItemType(leftItem.type), null, `${id}: invalid c.leave item type '${leftItem.type}'`);
      }

      const me = { ...toWorld(def, 0, def.D / 2 - 0.9), y: (def.y || 0) + 1.65, yaw: 0, pitch: 0, speed: 1.2, moving: true, inside: true };
      for (let step = 0; step < 6; step++) {
        world.update(0.05, step * 0.05 + 0.05, me);
      }
    } finally {
      world.dispose();
    }
  }

  // 2. Every single WRONG plain-room oddity builds and ticks cleanly when forced by name
  const plainLevel = generate('forest-plain-oddities', { theme: 'forest' });
  const rawPlain = plainLevel.rooms.find((r) => r.kind === 'plain' && !r.shape && !r.pillars?.length && r.W >= 5 && r.D >= 5)
    || plainLevel.rooms.find((r) => r.kind === 'plain' && !r.shape && r.W >= 4 && r.D >= 4)
    || { ...plainLevel.rooms.find((r) => r.kind === 'plain'), shape: null, pillars: [], lows: [] };
  assert.ok(rawPlain, 'found plain forest room');
  const plainDef = { ...rawPlain, id: 0, doors: rawPlain.doors.map((d) => ({ ...d, to: 0 })), links: [], wins: [] };

  for (const wrongKey of WRONG_KEYS) {
    warnings.length = 0;
    globalThis.__forestWrong = wrongKey;
    const env = makeEnv();
    const world = await buildWorld(kit, { ...plainLevel, rooms: [plainDef], links: [], windows: [] }, env);
    env.world = world;
    try {
      assert.deepEqual(warnings, [], `WRONG.${wrongKey}: unexpected warnings: ${warnings.join('; ')}`);
      const rt = world.rooms[0];
      assert.equal(rt.weird, wrongKey, `WRONG.${wrongKey} asked for by name was not built (got ${rt.weird})`);
      assert.ok(rt.lights.length <= 16, `WRONG.${wrongKey}: lights ${rt.lights.length} > 16`);
      let ordM = 0, detM = 0, ordT = 0, detT = 0;
      rt.group.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        if (o.userData?.detail) { detM++; detT += tris; }
        else { ordM++; ordT += tris; }
      });
      assert.ok(ordM <= 45 && detM <= 12, `WRONG.${wrongKey}: meshes ord=${ordM} det=${detM}`);
      assert.ok(ordT <= 120000 && ordT + detT <= 250000, `WRONG.${wrongKey}: tris ord=${ordT} tot=${ordT + detT}`);
      const me = { ...toWorld(plainDef, 0, 0), y: (plainDef.y || 0) + 1.65, yaw: 0, pitch: 0, speed: 1.0, moving: true, inside: true };
      world.update(0.05, 0.1, me);
    } finally {
      world.dispose();
    }
  }
  delete globalThis.__forestWrong;
});

// Whole floors, not one room at a time: a plain forest room is planted by the thicket round its own baffles and
// partitions (quiet.js), and on tapes 3, 4 and 19 that used to wall a doorway off, after which the level's safety net
// switched the room's collision off and its trunks could be walked through (found by the lead on a default tape).
test('whole forest floors build with every doorway of every room reachable (no "could not be reached")', async (t) => {
  const prevDoc = globalThis.document, prevWarn = console.warn, said = [];
  const draw = new Proxy({}, {
    get: (_, k) => k === 'measureText' ? (txt) => ({ width: String(txt).length * 6 }) : /Gradient/.test(k) ? () => ({ addColorStop() {} }) : () => {},
    set: () => true,
  });
  globalThis.document = { createElement: () => ({ getContext: () => draw, width: 128, height: 128 }) };
  console.warn = (...args) => { said.push(args.join(' ')); };
  t.after(() => { globalThis.document = prevDoc; console.warn = prevWarn; });
  const kit = createKit();
  t.after(() => kit.dispose());
  const catalogue = await loadCatalogue(kit);
  const ids = DECK.filter((a) => a.themes?.forest && a.module).map((a) => a.id);
  const builders = { ...BUILDERS, ...Object.fromEntries(await Promise.all(ids.map(async (id) => [id, (await import(`../public/world/backrooms/rooms/${id}.js`)).build]))) };
  for (const tape of ['3', '4', '19', '8']) {
    said.length = 0;
    const level = generate(tape, { theme: 'forest' });
    const env = {
      catalogue, builders, hatches: new Map(), creations: {}, cast: [], sound: new Proxy({}, { get: () => () => {} }),
      denizens: { add() {}, remove() {} }, inventory: { held: () => null, torchPower: () => 0 },
      health: { damage: () => ({ ok: true, dead: false }), heal: () => true }, hud: { glitch() {}, flash() {} },
      run: { met() {}, survived() {}, itemFound() {} }, player: { RADIUS: 0.22, warp() {} },
      sees: () => false, play() {}, hold: () => () => {}, descend: () => {},
    };
    const world = await buildWorld(kit, level, env);
    try {
      assert.deepEqual(said.filter((w) => /could not be reached|nor even then|would not build/.test(w)), [], `tape ${tape}: ${level.rooms.length} rooms`);
    } finally { world.dispose(); }
  }
});

test('Lights Out (`nearestTent`): the nearest tent within reach is the dark one, one at a time, and none with nobody near', () => {
  const tents = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 0, z: 5 }];
  assert.equal(nearestTent(tents, 20, 20), -1, 'nobody near: every tent lit');
  assert.equal(nearestTent(tents, 0.5, 0.5), 0);
  assert.equal(nearestTent(tents, 2.4, 0), 1, 'between two, the nearer');
  assert.equal(nearestTent(tents, 0, LIGHTS_OUT.reach + 0.5 + 5), -1, 'just out of reach of the last');
  assert.equal(nearestTent(tents, 0, 5 + LIGHTS_OUT.reach - 0.1), 2);
  assert.equal(nearestTent([], 0, 0), -1);
  assert.ok(LIGHTS_OUT.off < LIGHTS_OUT.on, 'it goes out faster than it comes back');
  const line = DECK.find((a) => a.id === 'lights-out');
  assert.ok(line, 'the room is in the deck');
  assert.equal(line.lights, 'dark');
  assert.equal(atHome(line, 'forest') > 0 && atHome(line, 'yellow') === 0, true, 'and is dealt in the forest and nowhere else');
});
