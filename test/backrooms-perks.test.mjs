// BlockRooms: employee department kits (core/perks.mjs) and their sidegrade
// hooks across survival, inventory, crafting, movement, cast rules, and character art.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { DEFAULT_PERK, PERK_IDS, PERK_LIST, PERKS, cleanPerk, resolvePerk, starterLoadout } from '../core/perks.mjs';
import { SPECIES, HAIR, OUTFIT, ACCESSORY, FACIAL, resolveLook, sanitizeLookPatch } from '../core/look.mjs';
import { createSurvival } from '../public/world/backrooms/survival.js';
import { createInventory } from '../public/world/backrooms/inventory-state.js';
import { previewCraft } from '../public/world/backrooms/crafting.js';
import { createPlayer } from '../public/world/backrooms/player.js';
import { HUNT, atHandle, knows, lost, handle, noticeTime } from '../public/world/backrooms/cast/hunt.js';
import { drained } from '../public/world/backrooms/cast/shadow.rule.js';
import { perched, stepToner } from '../public/world/backrooms/cast/toner.rule.js';

const rootHref = new URL('../', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(
  `export function resolve(spec, ctx, next) { if (spec.startsWith('/core/')) return next(${JSON.stringify(rootHref)} + spec.slice(1), ctx); return next(spec, ctx); }`,
)}`);
const { paintFlatCharacter } = await import('../public/world/art/character.js');

const openWorld = () => ({
  free: () => true,
  passable: () => true,
  floorY: () => 0,
  headroom: () => 2.6,
});

const mockCam = () => ({
  position: { set() {} },
  rotation: { set() {} },
});

const makeSurvival = (perk) => {
  const ended = [];
  const env = {
    sound: { play() {} },
    interfere() {},
    hud: { glitch() {}, battery() {} },
  };
  const surv = createSurvival(env, {
    canAct: () => true,
    onEnd: (reason) => ended.push(reason),
    perk,
  });
  return { surv, ended };
};

const stepPlayer = (player, secs, dt = 1 / 60) => {
  for (let t = 0; t < secs - 1e-9; t += dt) player.update(dt);
  return player.me;
};

test('perks catalog: Standard Issue is zero-cost/zero-tradeoff, every other kit costs 1 PT with upsides & downsides, and no kit ever grants weapons', () => {
  assert.equal(DEFAULT_PERK, 'none');
  assert.equal(cleanPerk('unknown-kit'), 'none');
  assert.equal(cleanPerk(null), 'none');
  for (const id of PERK_IDS) {
    assert.equal(cleanPerk(id), id);
    const p = resolvePerk(id);
    assert.equal(p, PERKS[id]);
    if (id === 'none') {
      assert.equal(p.cost, 0);
      assert.deepEqual(p.upsides, []);
      assert.deepEqual(p.downsides, []);
    } else {
      assert.equal(p.cost, 1, `${id} should cost 1 perk point`);
      assert.ok(p.upsides.length >= 1, `${id} needs at least one upside`);
      assert.ok(p.downsides.length >= 1, `${id} needs at least one downside`);
    }
    for (let s = 0; s < 40; s++) {
      const items = starterLoadout(id, `seed-${s}`);
      for (const it of items) {
        assert.notEqual(it.type, 'scissors', `${id} must never start with scissors`);
      }
    }
  }
  assert.equal(PERK_LIST.length, 9);
});

test('Supply Clerk: 8 pockets, 2 deterministic store items per seed, and -12% walk & sprint speed', () => {
  const perk = resolvePerk('supply-clerk');
  assert.equal(perk.pockets, 8);
  const a1 = starterLoadout('supply-clerk', 'tape-alpha');
  const a2 = starterLoadout('supply-clerk', 'tape-alpha');
  const b1 = starterLoadout('supply-clerk', 'tape-bravo');
  assert.equal(a1.length, 2);
  assert.deepEqual(a1, a2, 'same seed deals identical starting supplies');
  assert.notEqual(a1[0].type, a1[1].type, 'two distinct supply types');
  assert.equal(b1.length, 2);

  const inv = createInventory({ size: perk.pockets });
  for (const item of a1) assert.equal(inv.add(item).ok, true);
  assert.equal(inv.read().slots.length, 8);
  assert.equal(inv.read().slots.filter(Boolean).length, 2);

  const baseInput = { keys: new Set(['w']), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const clerkInput = { keys: new Set(['w']), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const baseP = createPlayer(openWorld(), mockCam(), { x: 0, z: 0, yaw: 0 }, baseInput, resolvePerk('none'));
  const clerkP = createPlayer(openWorld(), mockCam(), { x: 0, z: 0, yaw: 0 }, clerkInput, perk);
  stepPlayer(baseP, 2);
  stepPlayer(clerkP, 2);
  assert.ok(Math.abs(clerkP.me.speed / baseP.me.speed - 0.88) < 0.015, `expected ~0.88x walk speed, got ${clerkP.me.speed / baseP.me.speed}`);
});

test('Senior Staff: regenerates +1 heart every 75s without taking damage, resets on hit, and drains camera 25% faster', () => {
  const perk = resolvePerk('senior-staff');
  const { surv } = makeSurvival(perk);
  assert.equal(surv.health.damage(2).health.current, 2);
  surv.update(50, true);
  assert.equal(surv.health.read().current, 2);
  // Taking damage resets the 75s composure clock
  assert.equal(surv.health.damage(1).health.current, 1);
  surv.update(50, true);
  assert.equal(surv.health.read().current, 1, 'regen clock reset on damage');
  surv.update(26, true);
  assert.equal(surv.health.read().current, 2, 'regenerated +1 heart after 75s clean');

  // 126s total elapsed at 1.25x drain = 157.5s drained from 300s -> 142.5s remaining
  assert.ok(Math.abs(surv.camera.read().remaining - (300 - 126 * 1.25)) < 0.01);
});

test('IT Support: +180s per battery, 25% slower torch drain, and snacks capped at 50% health (2/4)', () => {
  const perk = resolvePerk('it-support');
  const { surv } = makeSurvival(perk);
  surv.update(200, true);
  assert.equal(surv.camera.read().remaining, 100);
  const recharged = surv.camera.recharge();
  assert.equal(recharged.ok, true);
  assert.equal(recharged.added, 180);
  assert.equal(surv.camera.read().remaining, 280);

  // Drop to 1/4 hearts: first snack heals to 2/4, second snack hits 50% cap!
  surv.health.damage(3);
  assert.equal(surv.health.read().current, 1);
  assert.equal(surv.health.heal(1, { snack: true }).ok, true);
  assert.equal(surv.health.read().current, 2);
  const blockedSnack = surv.health.heal(1, { snack: true });
  assert.deepEqual({ ok: blockedSnack.ok, reason: blockedSnack.reason, current: surv.health.read().current }, { ok: false, reason: 'snack-cap', current: 2 });

  // Torch drains 25% slower, and crafting battery + camera adds 180s
  const inv = createInventory({ size: perk.pockets, batterySeconds: perk.batterySeconds, torchDrainRate: perk.torchDrainRate });
  inv.add({ type: 'torch', id: 't1', charge: 100 });
  inv.toggleLight();
  inv.tick(40);
  assert.ok(Math.abs(inv.read().slots[0].charge - 70) < 0.01, '40s at 0.75x drain costs 30s charge');
  const addedBatt = inv.add({ type: 'battery', id: 'b1' });
  const craftRes = inv.craft([{ slot: 1, id: addedBatt.item.id }, { device: 'camera' }], {
    camera: surv.camera,
  });
  assert.equal(craftRes.ok, true);
  assert.equal(craftRes.result.added, 120, '280 -> 400 cap adds remaining 120s room');
});

test('Courier: +18% sprint speed, +45% noise & Toner earshot, and upright sprinting within 7m alerts the Mascot', () => {
  const perk = resolvePerk('courier');
  const baseInput = { keys: new Set(['w', 'Shift']), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const courierInput = { keys: new Set(['w', 'Shift']), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const baseP = createPlayer(openWorld(), mockCam(), { x: 0, z: 0, yaw: 0 }, baseInput, resolvePerk('none'));
  const courierP = createPlayer(openWorld(), mockCam(), { x: 0, z: 0, yaw: 0 }, courierInput, perk);
  stepPlayer(baseP, 2);
  stepPlayer(courierP, 2);
  assert.ok(Math.abs(courierP.me.speed / baseP.me.speed - 1.18) < 0.015);
  assert.equal(courierP.me.sprinting, true);
  assert.equal(courierP.me.noise, 1.45);

  // Mascot hears upright Courier sprint through walls into search mode
  const heardState = knows(lost(), 1 / 30, { los: false, d: 6.2, me: { x: 8, z: 2, room: 4 }, room: 2, heard: { x: 8, z: 2, room: 4 } });
  assert.equal(heardState.mode, 'search');
  assert.deepEqual(heardState.last, { x: 8, z: 2, room: 4 });

  // Toner hears Courier from beyond normal 11m earshot (up to 11 * 1.45 = 15.95m)
  const tonerAt14m = stepToner(perched(), 0.2, { d: 14, audible: true, moving: true, speed: 3.0, sink: 0, noiseScale: perk.noiseScale });
  assert.ok(tonerAt14m.alert > 0, 'Courier is heard by Toner at 14m');
  const standardAt14m = stepToner(perched(), 0.2, { d: 14, audible: true, moving: true, speed: 3.0, sink: 0, noiseScale: 1 });
  assert.equal(standardAt14m.alert, 0, 'Standard visitor is outside Toner earshot at 14m');
});

test('Night Cleaner: 2/2 max hearts, fast silent crouch-walk, and -50% Mascot sight / 2x notice time while crouched', () => {
  const perk = resolvePerk('night-cleaner');
  const { surv, ended } = makeSurvival(perk);
  assert.deepEqual({ current: surv.health.read().current, max: surv.health.read().max }, { current: 2, max: 2 });
  const grab = surv.health.damage(2);
  assert.equal(grab.dead, true, 'one 2-heart Mascot grab is fatal');
  assert.deepEqual(ended, ['caught']);

  const input = { keys: new Set(['w', 'c']), dx: 0, dy: 0, stick: { x: 0, y: 0 } };
  const cleaner = createPlayer(openWorld(), mockCam(), { x: 0, z: 0, yaw: 0 }, input, perk);
  stepPlayer(cleaner, 2);
  assert.equal(cleaner.me.crouching, true);
  assert.equal(cleaner.me.noise, 0, 'silent footsteps while crouched');
  assert.ok(cleaner.me.speed > 1.55, `fast crouch speed expected (>1.55 m/s), got ${cleaner.me.speed}`);

  // Toner hears nothing when noiseScale === 0
  const quietToner = stepToner(perched(), 0.5, { d: 1.5, audible: true, moving: true, speed: cleaner.me.speed, sink: 0.1, noiseScale: cleaner.me.noise });
  assert.equal(quietToner.alert, 0);

  // Mascot sight range halved (12m instead of 24m) and notice time doubled while crouched
  const unseenAt15m = knows(lost(), 2, { los: true, d: 15, far: HUNT.far * perk.crouchSightScale, noticeScale: perk.crouchNoticeScale, me: { x: 0, z: 0, room: 1 }, room: 1 });
  assert.equal(unseenAt15m.mode, 'wander', 'unseen at 15m while crouched');

  const halfFar = HUNT.far * perk.crouchSightScale;
  const crouchedNotice = noticeTime(6, halfFar) * perk.crouchNoticeScale;
  const standingNotice = noticeTime(6, HUNT.far);
  assert.ok(crouchedNotice > standingNotice * 2, 'crouched notice time is >2x standing notice time');
  let s = lost();
  const dt = 1 / 60;
  for (let t = 0; t < standingNotice + 0.05; t += dt) {
    s = knows(s, dt, { los: true, d: 6, far: halfFar, noticeScale: perk.crouchNoticeScale, me: { x: 0, z: 0, room: 1 }, room: 1 });
  }
  assert.equal(s.mode, 'wander', 'still unnoticed after normal standing noticeTime');
  for (let t = 0; t < crouchedNotice; t += dt) {
    s = knows(s, dt, { los: true, d: 6, far: halfFar, noticeScale: perk.crouchNoticeScale, me: { x: 0, z: 0, room: 1 }, room: 1 });
  }
  assert.equal(s.mode, 'chase', 'noticed once full crouched noticeTime elapses');
});

test('Facilities: 4 pockets, pre-mounted 50% flashlight, and 2x Mascot hold time on player-shut doors', () => {
  const perk = resolvePerk('facilities');
  assert.equal(perk.pockets, 4);
  const starter = starterLoadout('facilities', 'any');
  assert.equal(starter.length, 1);
  assert.equal(starter[0].charge, 90);
  assert.equal(starter[0].mounted, true);

  const inv = createInventory({ size: perk.pockets });
  const took = inv.add(starter[0]);
  assert.equal(took.ok, true);
  assert.equal(inv.mount(took.item.id).ok, true);
  assert.equal(inv.read().mountedTorch?.id, took.item.id);
  assert.equal(inv.read().slots.every((slot) => slot === null), true);
  assert.equal(inv.read().slots.length, 4);

  // Player-shut door holds Mascot 2x longer (10s instead of 5s)
  const holdTime = HUNT.door * perk.doorHoldScale;
  let h = atHandle();
  for (let t = 0; t < 7.5; t += 0.5) h = handle(h, 0.5, false, holdTime);
  assert.equal(h.open, false, 'still holding at 7.5s on a 10s latched door');
  for (let t = 0; t < 3.0; t += 0.5) h = handle(h, 0.5, false, holdTime);
  assert.equal(h.open, true, 'opens once 10s hold expires');
});

test('AV Tech: 78° wide-angle FOV, 240s/320s battery, and 70% Shadow flashbulb drain', () => {
  const perk = resolvePerk('av-tech');
  assert.equal(perk.fov, 78);
  const { surv } = makeSurvival(perk);
  assert.deepEqual({ remaining: surv.camera.read().remaining, capacity: surv.camera.read().capacity }, { remaining: 240, capacity: 320 });
  const added = surv.camera.recharge();
  assert.equal(added.added, 80, 'capped at 320s capacity');
  assert.ok(Math.abs(drained(200, perk.shadowDrain) - 60) < 1e-9, '70% Shadow drain leaves 30% of 200s = 60s');
  const drainRes = surv.camera.drain(perk.shadowDrain);
  assert.equal(drainRes.ok, true);
  assert.ok(Math.abs(surv.camera.read().remaining - 320 * 0.3) < 1e-9);
});

test('Records Purge: 3/3 max hearts, starter lighter + 3 paper, 12s/sheet fires, and no mounting torch to camera', () => {
  const perk = resolvePerk('records-purge');
  const { surv } = makeSurvival(perk);
  assert.deepEqual({ current: surv.health.read().current, max: surv.health.read().max }, { current: 3, max: 3 });

  const inv = createInventory({
    size: perk.pockets,
    canMountTorch: perk.canMountTorch,
    fireSecondsPerSheet: perk.fireSecondsPerSheet,
  });
  for (const it of starterLoadout('records-purge', 'seed')) assert.equal(inv.add(it).ok, true);
  assert.equal(inv.read().slots.filter(Boolean).length, 2);

  const s0 = inv.read().slots[0], s1 = inv.read().slots[1];
  // Paper + lighter burns at 12s per sheet (3 sheets = 36s)
  let ignited = null;
  const fireCraft = inv.craft([{ slot: 0, id: s0.id }, { slot: 1, id: s1.id }], {
    paperCount: 3,
    ignite: (spec) => { ignited = spec; return { ok: true }; },
  });
  assert.equal(fireCraft.ok, true);
  assert.equal(fireCraft.duration, 36);
  assert.equal(ignited.duration, 36);

  // Taped torch cannot mount to camera
  const addedTorch = inv.add({ type: 'torch', id: 't1', charge: 120, prepared: true });
  const snap = { ...inv.read(), camera: surv.camera.read() };
  const blockedMount = previewCraft(snap, [{ slot: addedTorch.index, id: addedTorch.item.id }, { device: 'camera' }], {
    canMountTorch: perk.canMountTorch,
    fireSecondsPerSheet: perk.fireSecondsPerSheet,
  });
  assert.equal(blockedMount.ok, false);
  assert.equal(blockedMount.reason, 'mount-disabled');
});

test('character creator looks: all species, hairstyles, outfits, facial hair & accessories paint cleanly front and back while decoupled from perks', async () => {
  for (const species of SPECIES) {
    const patch = sanitizeLookPatch({
      species,
      skin: '#7fa35a',
      hair: HAIR[0],
      hairColor: '#3bd6ff',
      facial: FACIAL[1],
      outfit: OUTFIT[2],
      outfitColor: '#8a5a8f',
      accessory: ACCESSORY[6],
    });
    assert.deepEqual(patch.errors, []);
    const look = resolveLook('creator-test', patch.look);
    const front = paintFlatCharacter(look, { back: false, pose: 'idle' });
    const back = paintFlatCharacter(look, { back: true, pose: 'idle' });
    assert.ok(front.extent() && back.extent(), `${species} renders front and back`);
  }
  for (const hair of HAIR) {
    const look = resolveLook('hair-test', { species: 'human', hair, hairColor: '#db7093' });
    assert.ok(paintFlatCharacter(look, { back: false }).extent() && paintFlatCharacter(look, { back: true }).extent(), `hair ${hair} renders`);
  }
  for (const outfit of OUTFIT) {
    const look = resolveLook('outfit-test', { species: 'human', outfit, outfitColor: '#e88fb0' });
    assert.ok(paintFlatCharacter(look, { back: false }).extent() && paintFlatCharacter(look, { back: true }).extent(), `outfit ${outfit} renders`);
  }
  for (const accessory of ACCESSORY) {
    const look = resolveLook('acc-test', { species: 'human', accessory });
    assert.ok(paintFlatCharacter(look, { back: false }).extent() && paintFlatCharacter(look, { back: true }).extent(), `accessory ${accessory} renders`);
  }
  for (const facial of FACIAL) {
    const look = resolveLook('facial-test', { species: 'human', facial });
    assert.ok(paintFlatCharacter(look, { back: false }).extent(), `facial ${facial} renders`);
  }

  // Verify 3D voxel sculptor (avatar/build.js) builds the Pink Cowgirl co-op look cleanly
  const { buildCharacter, facePixels } = await import('../public/world/avatar/build.js');
  const cowgirlPatch = sanitizeLookPatch({
    species: 'human',
    skin: '#e3aa84',
    hair: 'braids',
    hairColor: '#db7093',
    facial: 'lashes',
    outfit: 'tunic',
    outfitColor: '#e88fb0',
    accessory: 'cowboy',
  });
  assert.deepEqual(cowgirlPatch.errors, []);
  const cowgirlLook = resolveLook('friend-coop', cowgirlPatch.look);
  const sculpted = buildCharacter(cowgirlLook, { seed: 'friend-coop' });
  assert.ok(sculpted.head.map.size > 1000 && sculpted.torso.map.size > 500 && sculpted.accessory.map.size > 400);
  assert.ok(facePixels(cowgirlLook, 'neutral').length > 25);

  // Verify 3D voxel sculptor builds the Yellow Alien co-op look cleanly
  const alienPatch = sanitizeLookPatch({
    species: 'alien',
    skin: '#e0a638',
    hair: 'bald',
    hairColor: '#241608',
    facial: 'none',
    outfit: 'consul',
    outfitColor: '#dfa22e',
    accessory: 'goggles',
  });
  assert.deepEqual(alienPatch.errors, []);
  const alienLook = resolveLook('user-alien', alienPatch.look);
  const sculptedAlien = buildCharacter(alienLook, { seed: 'user-alien' });
  assert.ok(sculptedAlien.head.map.size > 1500 && sculptedAlien.torso.map.size > 500 && sculptedAlien.accessory.map.size > 150);
  assert.ok(facePixels(alienLook, 'neutral').length > 10);
});
