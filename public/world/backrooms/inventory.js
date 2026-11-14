// What a visitor carries. Pockets and UI last for the visit; physical
// supplies and chalk belong to the floor beneath them, including at seams.
// Reward coins/keycards still belong exclusively to loot.js. Nobody is handed
// anything: what is lying about, and where, is supplies.js (pure, by the seed).
import { createInventory as createModel, makeItem, ITEM_DEFS } from './inventory-state.js';
import { createInventoryHud } from './inventory-hud.js';
import { createInventoryWorld } from './inventory-world.js';
import { toLocal, makeRng } from './gen.js';
import { planSupplies } from './supplies.js';
import { CAST, castFor } from './cast.js';

const MESSAGES = {
  empty: 'Empty slot', full: 'All six slots are full', duplicate: 'Already carrying that',
  'empty-charge': 'The flashlight needs batteries', 'empty-chalk': 'No chalk left',
  incompatible: 'Those items do not fit together', 'full-charge': 'Already fully charged',
  'no-mark-space': 'No dry, clear floor here', 'no-drop-space': 'No clear place to set this down',
  'no-mark': 'No dry, clear floor here', 'no-space': 'No clear place to set this down',
  'no-use': 'Nothing to use this on here', 'health-unavailable': 'Keep this for when you need it',
  'full-health': 'Health is full', dead: 'Too late', depleted: 'The camera has stopped',
  unavailable: 'Cannot do that right now',
};

/**
 * @param env  { hud, sound, health, camera }
 * @param {{canAct?:Function, onOpen?:Function, review?:boolean}} [o]  review: one of everything on the floor where you land,
 *        for looking at them (the dev page's &supplies=1). A visit has only what its seed left lying about.
 */
export function createInventory(env, { canAct = () => true, onOpen = () => {}, review = false } = {}) {
  const model = createModel(), floors = new Map(), retired = new WeakSet();
  let disposed = false, active = null, supplied = false;
  const available = (floor = active) => !disposed && !!floor && floor === active && !!floor.env.player?.me && canAct();
  const unavailable = () => ({ ok: false, reason: 'unavailable' });
  const tell = value => view.notice(MESSAGES[value] || value || 'Cannot use that here');
  const snapshot = () => ({ ...model.read(), health: env.health?.read(), camera: env.camera?.read() });
  const refresh = () => view.update(snapshot());
  const accepted = result => {
    if (!result?.ok) { tell(result?.reason); return false; }
    env.sound.play(result.action === 'heal' ? 'rustle' : 'clack', { vol: .45 }); refresh(); return true;
  };
  function select(index) { if (available() && model.select(index)) refresh(); }
  function use() {
    if (!available()) return unavailable();
    const snapshot = model.read(), item = snapshot.slots[snapshot.selected];
    // Put the mark into the world before spending chalk. A bad floor or failed
    // placement never consumes a use. This synchronous action cannot race UI.
    if (item?.type === 'chalk' && item.uses > 0) {
      const placed = active.physical.mark();
      if (!placed.ok) { tell(placed.reason || 'no-mark-space'); return; }
    }
    const result = model.useSelected({ heal: env.health?.heal });
    if (!accepted(result)) return;
    if (result.action === 'combine') view.beginCombine(snapshot.selected);
    if (result.action === 'heal') tell(`+${result.amount} health`);
  }
  function drop() {
    if (!available()) return unavailable();
    if (accepted(active.physical.dropSelected())) { view.cancelCombine(); refresh(); }
  }
  function combine(from, to) {
    if (!available()) return unavailable();
    if (accepted(model.combine(from, to))) { view.cancelCombine(); refresh(); tell('Batteries fitted'); }
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
    env.sound.play('clack', { vol: .45 }); tell('Camera recharged');
  }
  // NPCs interact with the selected pocket, not any matching item somewhere
  // in the bag. Snapshots are detached; each successful handoff is explicit.
  function held() {
    if (disposed) return null;
    const state = model.read(), item = state.slots[state.selected];
    return item?.type === 'torch' ? { ...item, lit: state.activeTorch === item.id && item.charge > 0 } : item;
  }
  const torchPower = () => !disposed && model.read().activeTorch ? 1 : 0;
  /** How many of something are being carried, in any pocket: loose battery packs, sheets of paper, anything else by the piece. */
  function count(type) {
    if (disposed) return 0;
    return model.read().slots.reduce((n, item) => n + (item?.type === type ? (type === 'paper' ? item.quantity : 1) : 0), 0);
  }
  function give(item) {
    if (!available()) return unavailable();
    const wasEmpty = !held(), result = model.add(item);
    if (result.ok) {
      if (wasEmpty) model.select(result.index);
      refresh(); env.sound.play('clack', { vol: .45 });
      tell(result.item.type === 'paper' ? `Paper +${result.accepted}` : ITEM_DEFS[result.item.type].name);
    }
    return result; // The giver keeps any rejected item or paper remainder.
  }
  function consumeHeld(type, amount = 1) {
    if (!available()) return unavailable();
    const result = model.consumeSelected(type, amount);
    if (result.ok) refresh();
    return result;
  }
  const view = createInventoryHud({ host: env.hud.el, onSelect: select, onUse: use, onDrop: drop, onCombine: combine, onRecharge: rechargeCamera,
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
      makeItem('balloon', id('arrival-balloon'))];
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
    const wanted = castFor(env.visit, env.level.depth ?? 0).flatMap(m => CAST.find(k => k.id === m.id)?.items || []);
    for (const { id: key, type, rooms, ...made } of planSupplies(env.level, wanted)) {
      let placed = false;
      for (const roomId of rooms) {
        const rt = env.world.rooms.find(r => r.id === roomId);
        if (!rt) continue;
        const walk = env.world.walkable(rt), seen = walk.flood(rt.def.doors), cells = [];
        for (let i = 0; i < seen.length; i++) if (seen[i]) cells.push(i);
        for (const cell of random.shuffle(cells).slice(0, 256)) {
          const p = walk.at(cell);
          if (physical.spawn(makeItem(type, id(key), made), { room: rt.id, x: p.x, z: p.z }).ok) { placed = true; break; }
        }
        if (placed) break;
      }
    }
  }

  /** Build-time ownership: the floor can be visible below us without having
   * a player yet. Its supply meshes stay in its scene when the seam moves it. */
  function hang(next) {
    if (disposed || !next?.world || !next.kit || retired.has(next)) return null;
    if (floors.has(next)) return floors.get(next).facade;
    const prefix = `inventory:${JSON.stringify([String(next.level.seed), next.level.depth ?? 0])}:`;
    const floor = { env: next, id: key => prefix + key, physical: null, facade: null };
    floor.physical = createInventoryWorld(next, model, {
      canAct: () => available(floor), onNotice: tell,
      onPickup: item => { refresh(); tell(item.type === 'paper' ? `Paper +${item.quantity}` : ITEM_DEFS[item.type]?.name || 'Picked up'); },
    });
    // NPCs keep this floor-scoped handle. A stale handle from the part above
    // cannot inspect or mutate what somebody now carries on the next floor.
    floor.facade = {
      physical: floor.physical,
      held: () => available(floor) ? held() : null,
      torchPower: () => !disposed && active === floor ? torchPower() : 0,
      give: item => available(floor) ? give(item) : unavailable(),
      consumeHeld: (type, amount = 1) => available(floor) ? consumeHeld(type, amount) : unavailable(),
      count: type => !disposed && active === floor ? count(type) : 0,
    };
    floors.set(next, floor); next.inventory = floor.facade;
    try { scatter(floor); }
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
    model, view, use, drop, combine, rechargeCamera, select, held, give, consumeHeld, count, hang, attend, forget,
    get physical() { return active?.physical || null; },
    get isOpen() { return view.isOpen; },
    owns: target => target instanceof Node && view.el.contains(target),
    close: () => view.setOpen(false),
    handleKey(e) {
      if (!available()) return false;
      if (view.handleKey(e)) return true;
      if (view.isOpen) return false; // Native focused-button activation stays native.
      const k = e.key.toLowerCase();
      if (/^[1-6]$/.test(k)) { if (!e.repeat) select(Number(k) - 1); return true; }
      if (k === 'q' || k === 'g') { if (!e.repeat) (k === 'q' ? use : drop)(); return true; }
      return false;
    },
    update(dt, playing) {
      if (disposed) return;
      if (playing) {
        const { depleted } = model.tick(dt);
        if (depleted) { tell('Flashlight battery empty'); env.sound.play('clack', { vol: .3 }); }
      }
      view.el.inert = !available(); active?.physical.update(dt); refresh(); view.tick(dt);
    },
    torchPower,
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
