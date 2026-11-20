// What a visitor carries. Pockets and UI last for the visit; physical
// supplies and chalk belong to the floor beneath them, including at seams.
// Reward coins/keycards still belong exclusively to loot.js. Nobody is handed
// anything: what is lying about, and where, is supplies.js (pure, by the seed).
import { createInventory as createModel, makeItem, ITEM_DEFS } from './inventory-state.js';
import { createInventoryHud } from './inventory-hud.js';
import { createInventoryWorld } from './inventory-world.js';
import { SNIP_TUNING } from './melee.js';
import { toLocal, makeRng, ARCHETYPES, STASH, wallPoint } from './gen.js';
import { planSupplies, plentyOfPaper, wantedByRooms } from './supplies.js';
import { CAST, castFor } from './cast.js';
import { difficultyOf } from '/core/difficulty.mjs';
import { starterLoadout } from '/core/perks.mjs';

const MESSAGES = {
  empty: 'Empty slot', full: 'All six slots are full', duplicate: 'Already carrying that',
  'empty-charge': 'The flashlight needs batteries', 'empty-chalk': 'No chalk left',
  'no-snip-target': 'Nothing within reach', 'broken-scissors': 'The scissors have snapped', 'empty-extinguisher': 'The extinguisher is empty',
  incompatible: 'Those items do not fit together', 'full-charge': 'Already fully charged',
  'no-mark-space': 'No dry, clear floor here', 'no-drop-space': 'No clear place to set this down',
  'no-mark': 'No dry, clear floor here', 'no-space': 'No clear place to set this down',
  'no-use': 'Nothing to use this on here', 'health-unavailable': 'Keep this for when you need it',
  'snacks-disabled': 'No snacks on this difficulty', 'full-health': 'Health is full', 'snack-cap': 'Snacks cannot restore past half health',
  dead: 'Too late', depleted: 'The camera has stopped',
  unavailable: 'Cannot do that right now',
  'missing-input': 'Choose two ingredients', 'stale-input': 'That item is no longer in the pocket',
  'duplicate-input': 'Choose two different ingredients', 'invalid-amount': 'Choose how many sheets to burn',
  insufficient: 'Not enough paper', 'no-fire-space': 'No clear, dry place for a fire',
  'fire-limit': 'Too many fires are still burning here', 'no-light': 'Select a flashlight or mount one on the camera',
  'already-prepared': 'This flashlight already has tape', 'already-mounted': 'The camera already has a flashlight',
  'mount-occupied': 'The camera already has a flashlight', 'mount-disabled': 'This kit cannot mount a flashlight',
  'not-prepared': 'Wrap the flashlight with tape first',
  'invalid-input': 'Choose an item from a pocket or the camcorder', 'invalid-item': 'Cannot use this item',
  'camera-unavailable': 'The camera is unavailable', 'invalid-fire': 'Choose one to ten sheets',
  'fire-unavailable': 'Cannot light a fire here', 'effect-failed': 'Could not combine those items',
  busy: 'Finish combining these items first',
};

/**
 * @param env  { hud, sound, health, camera }
 * @param {{canAct?:Function, onOpen?:Function, review?:boolean, perk?:object, seed?:string}} [o]  review: one of everything on the floor where you land,
 *        for looking at them (the dev page's &supplies=1). A visit has only what its seed left lying about, plus any chosen department kit.
 */
export function createInventory(env, { canAct = () => true, onOpen = () => {}, review = false, perk, seed, difficulty = () => 'training-wheels' } = {}) {
  const size = perk?.pockets ?? 6;
  const model = createModel({
    size,
    canMountTorch: perk?.canMountTorch,
    fireSecondsPerSheet: perk?.fireSecondsPerSheet,
    batterySeconds: perk?.batterySeconds,
    torchDrainRate: perk?.torchDrainRate,
  }), floors = new Map(), retired = new WeakSet();
  if (!review && perk) {
    for (const starter of starterLoadout(perk.id, seed)) {
      const allowed = starter.type === 'snack' && difficultyOf(difficulty()).snack === 0 ? { ...starter, type: 'paper', quantity: 3 } : starter;
      const added = model.add(allowed);
      if (added.ok && starter.mounted) model.mount(added.item.id);
    }
  }
  let disposed = false, active = null, supplied = false, snipCooldown = 0;
  const available = (floor = active) => !disposed && !!floor && floor === active && !!floor.env.player?.me && canAct();
  const unavailable = () => ({ ok: false, reason: 'unavailable' });
  const tell = value => {
    const msg = value === 'full' && size !== 6 ? `All ${size} pockets are full` : MESSAGES[value];
    view.notice(msg || value || 'Cannot use that here');
  };
  const snapshot = () => ({
    ...model.read(),
    health: env.health?.read(),
    camera: env.camera?.read(),
    ...(perk ? {
      maxSnackHealth: perk.maxSnackHealth,
      canMountTorch: perk.canMountTorch,
      fireSecondsPerSheet: perk.fireSecondsPerSheet,
      batterySeconds: perk.batterySeconds,
    } : {}),
  });
  const refresh = () => view.update(snapshot());
  const accepted = result => {
    if (!result?.ok) { tell(result?.reason); return false; }
    env.sound.play(result.action === 'heal' ? 'rustle' : 'clack', { vol: .45 }); refresh(); return true;
  };
  function select(index, options) { if (available() && model.select(index, options)) refresh(); }
  /** Whether the camcorder would take a battery pack's charge now: it is neither flat nor full. */
  function cameraTakes() {
    const c = env.camera?.read?.();
    return !!c && !c.depleted && c.remaining < c.capacity;
  }
  function snip({ quietMiss = false } = {}) {
    if (!available()) return unavailable();
    const state = model.read(), item = state.slots[state.selected];
    if (item?.type !== 'scissors' || item.uses <= 0) return { ok: false, reason: 'wrong-item' };
    if (snipCooldown > 0) return { ok: false, reason: 'cooldown' };
    snipCooldown = SNIP_TUNING.cooldown;
    active.env.handView?.jab?.();
    const result = model.useSelected({
      snip: () => active.env.snip ? active.env.snip() : { ok: false, reason: 'no-snip-target' },
    });
    active.env.handView?.landed?.({ ok: result.ok, snapped: result.snapped });       // (for the hand to show a hit, a miss and a snap differently)
    if (!result.ok) {
      env.sound.play('snip', { vol: .38 });
      if (!quietMiss) tell(result.reason);
      return result;
    }
    env.sound.play('snip', { vol: .78 });
    if (result.snapped) env.sound.play('crack', { vol: .72 });
    active.env.interfere?.(result.snapped ? 0.55 : 0.38);
    env.hud?.glitch?.(result.snapped ? 0.42 : 0.26);
    refresh();
    // (nothing is said: the crack and the empty hand are the telling, and there is no count to give)
    return result;
  }
  /** The lawn flamingo: a stab that lands twice, and the flamingo stays in what it went into (env.stab, index.js). A miss keeps it. */
  function stab({ quietMiss = false } = {}) {
    if (!available()) return unavailable();
    const state = model.read(), item = state.slots[state.selected];
    if (item?.type !== 'flamingo') return { ok: false, reason: 'wrong-item' };
    if (snipCooldown > 0) return { ok: false, reason: 'cooldown' };
    snipCooldown = SNIP_TUNING.cooldown;
    active.env.handView?.stab?.();                          // (the hand's stab, where it is drawn: hand.js)
    const result = model.useSelected({ stab: () => active.env.stab ? active.env.stab() : { ok: false, reason: 'no-snip-target' } });
    active.env.handView?.stabbed?.({ ok: result.ok });
    if (!result.ok) { env.sound.play('shuffle', { vol: .5 }); if (!quietMiss) tell(result.reason); return result; }
    env.sound.play('thunk', { vol: .9 }); env.sound.play('snip', { vol: .6 });
    active.env.interfere?.(0.45); env.hud?.glitch?.(0.3);
    refresh();
    return result;
  }
  function use() {
    if (!available()) return unavailable();
    const snapshot = model.read(), item = snapshot.slots[snapshot.selected];
    if (snapshot.holstered) { tell('Hands empty'); return { ok: false, reason: 'empty' }; }
    // A battery pack in the hand goes straight into the camcorder, whose charge is the time left on the tape. With the
    // camcorder full there is only a torch to put it in, and that is a combination: the bag opens on it, as it did.
    if (item?.type === 'battery' && cameraTakes()) return rechargeCamera(snapshot.selected);
    if (item?.type === 'scissors') return snip({ quietMiss: !view.isOpen });
    if (item?.type === 'carbon-camera') {
      if (view.isOpen) view.setOpen(false);
      return active.env.carbonCopy?.action();
    }
    if (item?.type === 'flamingo') return stab({ quietMiss: !view.isOpen });
    if (item?.type === 'extinguisher') { if (!(item.charge > 0)) { tell('empty-extinguisher'); return { ok: false, reason: 'empty-extinguisher' }; } active.env.extinguisher?.press?.(); return { ok: true, action: 'spray' }; }
    // Put the mark into the world before spending chalk. A bad floor or failed
    // placement never consumes a use. This synchronous action cannot race UI.
    if (item?.type === 'chalk' && item.uses > 0) {
      const placed = active.physical.mark();
      if (!placed.ok) { tell(placed.reason || 'no-mark-space'); return; }
    }
    const result = model.useSelected({
      heal: env.health ? amount => env.health.heal(amount, { snack: true }) : undefined,
    });
    if (!accepted(result)) return;
    if (result.action === 'combine') view.beginCombine(snapshot.selected);
    if (result.action === 'heal') tell(`+${result.amount} health`);
  }
  function drop() {
    if (!available()) return unavailable();
    if (model.read().holstered) { tell('Hands empty'); return { ok: false, reason: 'empty' }; }
    if (accepted(active.physical.dropSelected())) { view.cancelCombine(); refresh(); }
  }
  function combine(from, to) {
    if (!available()) return unavailable();
    if (accepted(model.combine(from, to))) { view.cancelCombine(); refresh(); tell('Batteries fitted'); }
  }
  function craft(refs, options = {}) {
    if (!available()) return unavailable();
    const result = model.craft(refs, {
      paperCount: options.paperCount, camera: env.camera,
      ignite: recipe => active.physical.ignite(recipe),
    });
    if (!accepted(result)) return result;
    view.cancelCombine(); refresh();
    tell(result.recipe === 'paper-fire' ? 'Paper is burning'
      : result.recipe === 'tape-torch' ? 'Flashlight taped'
      : result.recipe === 'mount-torch' ? 'Light mounted · F to switch'
      : result.recipe === 'camera-battery' ? 'Camera recharged' : 'Batteries fitted');
    return result;
  }
  function toggleLight() {
    if (!available()) return unavailable();
    const result = model.toggleLight();
    accepted(result); return result;
  }
  function rechargeCamera(from) {
    if (!available()) return unavailable();
    const item = Number.isInteger(from) ? model.read().slots[from] : null;
    if (item?.type !== 'battery' || !env.camera) { tell('incompatible'); return; }
    // Recharge and removal are synchronous. A full/depleted camera never
    // spends the pack, and a successful transfer cannot run twice.
    const result = env.camera.recharge();
    if (!result.ok) { tell(result.reason); return; }
    model.remove(item.id); view.cancelCombine(); refresh();
    const added = Math.round(result.added || 0);
    env.sound.play('clack', { vol: .45 }); tell(`Camera recharged · +${Math.floor(added / 60)}:${String(added % 60).padStart(2, '0')}`);
    return result;
  }
  // NPCs interact with the selected pocket, not any matching item somewhere
  // in the bag. Snapshots are detached; each successful handoff is explicit.
  function held() {
    if (disposed) return null;
    const state = model.read(), item = state.slots[state.selected];
    if (state.holstered) return null;
    return item?.type === 'torch' ? { ...item, lit: state.activeTorch === item.id && item.charge > 0 } : item;
  }
  const torchPower = () => disposed ? 0 : model.torchPower();
  const torchMounted = () => !disposed && model.torchMounted();
  /** How many of something are being carried, in any pocket: loose battery packs, sheets of paper, anything else by the piece. */
  function count(type) {
    if (disposed) return 0;
    return model.read().slots.reduce((n, item) => n + (item?.type === type ? (type === 'paper' ? item.quantity : 1) : 0), 0);
  }
  function give(item) {
    if (!available()) return unavailable();
    const state = model.read(), wasEmpty = !state.holstered && !state.slots[state.selected], result = model.add(item);
    if (result.ok) {
      if (wasEmpty) model.select(result.index);
      // (no name across the middle of the picture: the pocket shows what it is, and the clack says it was taken. The
      // owner, 19 Nov. A notice is kept for what went wrong: full pockets, nothing to use it on)
      refresh(); env.sound.play('clack', { vol: .45 });
    }
    return result; // The giver keeps any rejected item or paper remainder.
  }
  function consumeHeld(type, amount = 1) {
    if (!available()) return unavailable();
    const result = model.consumeSelected(type, amount);
    if (result.ok) refresh();
    return result;
  }
  const view = createInventoryHud({ size, host: env.hud.el, onSelect: select, onUse: use, onDrop: drop, onCraft: craft,
    onOpen: open => {
      if (open && !available()) { view.setOpen(false); return; }
      onOpen(open);
    },
  });
  refresh();

  /** For review only (`review`): one of everything near arrival, on reachable clear floor. Their
   * physical positions are independent of room builders and seeded geometry. */
  function seedSupplies(floor) {
    const { env, physical, id } = floor, me = env.player.me, rt = env.world.roomAt(me.x, me.z);
    if (!rt) return false;
    const start = toLocal(rt.def, me.x, me.z), yaw = me.yaw - rt.def.rot * Math.PI / 2;
    const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) }, right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const items = [makeItem('torch', id('arrival-flashlight'), { charge: 54 }), makeItem('battery', id('arrival-batteries')), makeItem('chalk', id('arrival-chalk')),
      makeItem('paper', id('arrival-paper'), { quantity: 5 }), makeItem('scissors', id('arrival-scissors')), makeItem('snack', id('arrival-snack')),
      makeItem('balloon', id('arrival-balloon')), makeItem('lighter', id('arrival-lighter')), makeItem('tape', id('arrival-tape'))];
    const walk = env.world.walkable(rt), seen = walk.flood(rt.def.doors);
    const candidates = [];
    for (let i = 0; i < seen.length; i++) if (seen[i]) {
      const p = walk.at(i); const distance = Math.hypot(p.x - start.x, p.z - start.z);
      if (distance < 2.6 && distance > .45 && walk.free(p.x, p.z)) candidates.push({ ...p, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    items.forEach((item, i) => {
      const spread = (i % 3 - 1) * .62, distance = .9 + Math.floor(i / 3) * .65;
      const desired = { x: start.x + forward.x * distance + right.x * spread, z: start.z + forward.z * distance + right.z * spread };
      if (physical.spawn(item, { room: rt.id, ...desired }).ok) return;
      for (const p of candidates) if (physical.spawn(item, { room: rt.id, x: p.x, z: p.z }).ok) return;
      console.warn('[backrooms] no reachable place for inventory supply', item.type);
    });
    return true;
  }
  // What is lying about is decided by the seed (supplies.js: which things, and which rooms each may be in, in order of
  // preference); where in a room is decided here, once the room is built. The first of its rooms with a dry, reachable,
  // clear place gets it. Never behind a collider; and a thing with nowhere to go is simply not there.
  function scatter(floor) {
    const { env, physical, id } = floor, random = makeRng(id('supplies'));
    // …for whoever is dealt to this part: the cast, and the residents of its rooms (a deck line's `items`)
    const wanted = [...castFor(env.visit, env.level.depth ?? 0).flatMap(m => CAST.find(k => k.id === m.id)?.items || []), ...wantedByRooms(env.level, ARCHETYPES)];
    for (const { id: key, type, rooms, ...made } of planSupplies(env.level, wanted)) {
      let placed = false;
      for (const roomId of rooms) {
        const rt = env.world.rooms.find(r => r.id === roomId);
        if (!rt) continue;
        // An oddity says where something may be hidden in it (its deck line's `stash`): that is where its thing goes,
        // if a thing can lie there — the place its author chose, not wherever the floor happens to be clear.
        const stash = rt.def.arch ? STASH[rt.def.arch] : null;
        if (stash) {
          try {
            const lay = stash(rt.def, random.chance(0.5) ? 1 : -1), zones = Array.isArray(lay[0]) ? lay : [lay];
            for (const z of random.shuffle(zones)) for (let k = 0; k < 6 && !placed; k++) {
              placed = physical.spawn(makeItem(type, id(key), made), { room: rt.id, x: random.range(z[0], z[2]), z: random.range(z[1], z[3]) }).ok;
            }
          } catch { /* a room's own arithmetic: the floor will do */ }
          if (placed) break;
        }
        if (rt.hide?.(makeItem(type, id(key), made))) { placed = true; break; }   // (a room's own hiding place: a filing cabinet's drawer, cabinets.js)
        const walk = env.world.walkable(rt), seen = walk.flood(rt.def.doors), cells = [];
        for (let i = 0; i < seen.length; i++) if (seen[i]) cells.push(i);
        for (const cell of random.shuffle(cells).slice(0, 256)) {
          const p = walk.at(cell);
          if (physical.spawn(makeItem(type, id(key), made), { room: rt.id, x: p.x, z: p.z }).ok) { placed = true; break; }
        }
        if (placed) break;
      }
    }
    // Paper in plenty (supplies.js plentyOfPaper), after everything else so that nothing else's place moves, and from a stream of
    // its own: on clear floor in a room's open part, never in a doorway's way and never on a coin's place (the stash zones are
    // for what a room hides, and are left alone)
    const rp = makeRng(id('paper-plenty')), coins = env.level.loot?.coins || [];
    for (const { id: key, type, rooms, plenty, ...made } of plentyOfPaper(env.level)) {
      let placed = false;
      for (const roomId of rooms) {
        const rt = env.world.rooms.find(r => r.id === roomId); if (!rt) continue;
        if (rt.hide?.(makeItem(type, id(key), made))) { placed = true; break; }
        const doors = rt.def.doors.map(dr => ({ p: wallPoint(rt.def, dr.side, dr.c, 0.6), r: 0.31 + 0.55 + dr.w / 2 + 0.15 }));
        const mine = coins.filter(k => k.room === rt.id);
        const walk = env.world.walkable(rt), seen = walk.flood(rt.def.doors), cells = [];
        for (let i = 0; i < seen.length; i++) if (seen[i]) cells.push(i);
        for (const cell of rp.shuffle(cells).slice(0, 256)) {
          const p = walk.at(cell);
          if (doors.some(d => Math.hypot(p.x - d.p.x, p.z - d.p.z) < d.r) || mine.some(k => Math.hypot(p.x - k.x, p.z - k.z) < 0.9)) continue;
          if (physical.spawn(makeItem(type, id(key), made), { room: rt.id, x: p.x, z: p.z }).ok) { placed = true; break; }
        }
        if (placed) break;
      }
    }
  }
  // What a room put down for somebody to find (c.leave: world.js): where the room said, or on the nearest clear floor to
  // it if a thing cannot lie there after all. The room is told when it is picked up.
  function leftByRooms(floor) {
    const { env, physical, id } = floor;
    for (const rt of env.world.rooms) (rt.left || []).forEach((l, i) => {
      if (l.type === 'snack' && env.level.difficulty && difficultyOf(env.level.difficulty).snack === 0) return;
      const key = id(`left:${rt.id}:${i}`), make = () => makeItem(l.type, key, { quantity: l.quantity, charge: l.charge });
      let ok = false;
      try {
        ok = physical.spawn(make(), { room: rt.id, x: l.x, z: l.z, ...(l.y ? { y: l.y } : {}) }).ok;
        for (let ring = 0; ring < 14 && !ok; ring++) for (let k = 0; k < 8 && !ok; k++) {
          const a = k * 0.785 + ring * 0.4, r = 0.3 + ring * 0.2;
          ok = physical.spawn(make(), { room: rt.id, x: l.x + Math.cos(a) * r, z: l.z + Math.sin(a) * r }).ok;
        }
      } catch { ok = false; }
      if (ok && l.taken) floor.taken.set(key, l.taken);
    });
  }

  /** Build-time ownership: the floor can be visible below us without having
   * a player yet. Its supply meshes stay in its scene when the seam moves it. */
  function hang(next) {
    if (disposed || !next?.world || !next.kit || retired.has(next)) return null;
    if (floors.has(next)) return floors.get(next).facade;
    const prefix = `inventory:${JSON.stringify([String(next.level.seed), next.level.depth ?? 0])}:`;
    const floor = { env: next, id: key => prefix + key, physical: null, facade: null, taken: new Map() };
    floor.physical = createInventoryWorld(next, model, {
      canAct: () => available(floor), onNotice: tell,
      onPickup: item => { refresh(); try { floor.taken.get(item.id)?.(item); } catch { /* a room's own affair */ } floor.taken.delete(item.id); },          // (no name across the picture on picking up: give() says why)
    });
    // NPCs keep this floor-scoped handle. A stale handle from the part above
    // cannot inspect or mutate what somebody now carries on the next floor.
    floor.facade = {
      physical: floor.physical,
      fire: { threatAt: (...point) => !disposed && active === floor ? floor.physical.fire.threatAt(...point) : null,
        burning: () => !disposed && active === floor ? floor.physical.fire.burning?.() || [] : [],
        douse: id => !disposed && active === floor && !!floor.physical.fire.douse?.(id) },
      /** The extinguisher in the hand sprays for `seconds` (inventory-state.js spray). → { ok, charge, empty } */
      spray: seconds => { if (!available(floor)) return unavailable(); const r = model.spray(seconds); if (r.ok) refresh(); return r; },
      held: () => available(floor) ? held() : null,
      torchPower: () => !disposed && active === floor ? torchPower() : 0,
      torchMounted: () => !disposed && active === floor && torchMounted(),
      give: item => available(floor) ? give(item) : unavailable(),
      consumeHeld: (type, amount = 1) => available(floor) ? consumeHeld(type, amount) : unavailable(),
      count: type => !disposed && active === floor ? count(type) : 0,
    };
    floors.set(next, floor); next.inventory = floor.facade;
    try { scatter(floor); leftByRooms(floor); }
    catch (err) { forget(next); throw err; }
    return floor.facade;
  }
  /** Called after land() creates this floor's player. Review supplies, where
   * asked for, arrive once, even when a developer starts the visit below depth zero. */
  function attend(next) {
    const floor = floors.get(next);
    if (disposed || !floor || !next.player?.me) return false;
    if (active !== floor) view.setOpen(false);
    active = floor;
    if (review && !supplied) supplied = seedSupplies(floor);
    refresh();
    return true;
  }
  /** Before its kit is disposed: remove use records and scene nodes, while
   * the plain carried item instances remain in the visit's pockets. */
  function forget(next) {
    const floor = floors.get(next);
    if (!floor) return;
    if (active === floor) { view.setOpen(false); active = null; }
    floor.physical.dispose(); floors.delete(next); retired.add(next);
    if (next.inventory === floor.facade) delete next.inventory;
  }
  return {
    model, view, use, snip, stab, drop, combine, rechargeCamera, craft, toggleLight, select, held, give, consumeHeld, count, hang, attend, forget,
    get physical() { return active?.physical || null; },
    get isOpen() { return view.isOpen; },
    owns: target => target instanceof Node && view.el.contains(target),
    close: () => view.setOpen(false),
    handleKey(e) {
      if (!available()) return false;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f') { if (!e.repeat) toggleLight(); return true; }
      if (view.handleKey(e)) return true;
      if (view.isOpen) return false; // Native focused-button activation stays native.
      const k = e.key.toLowerCase();
      if (/^[1-8]$/.test(k) && Number(k) <= size) { if (!e.repeat) select(Number(k) - 1, { toggle: true }); return true; }
      if (k === 'q' || k === 'g') { if (!e.repeat) (k === 'q' ? use : drop)(); return true; }
      return false;
    },
    update(dt, playing) {
      if (disposed) return;
      if (playing) {
        if (snipCooldown > 0) snipCooldown = Math.max(0, snipCooldown - dt);
        const { depleted } = model.tick(dt);
        if (depleted) { tell('Flashlight battery empty'); env.sound.play('clack', { vol: .3 }); }
      }
      // The part above can still be in view during a fall. Its fire keeps
      // burning until that floor is retired; the carried model still ticks once.
      for (const floor of floors.values()) floor.physical.update(playing ? dt : 0);
      view.el.inert = !available(); refresh(); view.tick(dt);
    },
    torchPower, torchMounted,
    report: () => ({ ...snapshot(), open: view.isOpen, floor: active?.env.level.depth ?? null,
      world: active?.physical.report() || { items: [], marks: [], marksMade: 0 } }),
    dispose() {
      if (disposed) return;
      disposed = true; view.destroy();
      for (const next of floors.keys()) forget(next);
      model.clear();
    },
  };
}
