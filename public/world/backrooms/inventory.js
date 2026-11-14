// Optional workshop supplies. The visit owns the model, world objects and UI;
// reward coins/keycards still belong exclusively to loot.js.
import { createInventory as createModel, makeItem, ITEM_DEFS } from './inventory-state.js';
import { createInventoryHud } from './inventory-hud.js';
import { createInventoryWorld } from './inventory-world.js';
import { toLocal, makeRng } from './gen.js';

const MESSAGES = {
  empty: 'Empty slot', full: 'All six slots are full', duplicate: 'Already carrying that',
  'empty-charge': 'The flashlight needs batteries', 'empty-chalk': 'No chalk left',
  incompatible: 'Those items do not fit together', 'full-charge': 'Already fully charged',
  'no-mark-space': 'No dry, clear floor here', 'no-drop-space': 'No clear place to set this down',
  'no-mark': 'No dry, clear floor here', 'no-space': 'No clear place to set this down',
  'no-use': 'Nothing to use this on here', 'health-unavailable': 'Keep this for when you need it',
  'full-health': 'Health is full', dead: 'Too late', depleted: 'The camera has stopped',
};
const BATTERY_ROOM_INTERVAL = 4; // Starting point for supply-density playtests.

export function createInventory(env, { canAct = () => true, onOpen = () => {} } = {}) {
  const model = createModel();
  let disposed = false;
  const tell = value => view.notice(MESSAGES[value] || value || 'Cannot use that here');
  const snapshot = () => ({ ...model.read(), health: env.health?.read(), camera: env.camera?.read() });
  const refresh = () => view.update(snapshot());
  const accepted = result => {
    if (!result?.ok) { tell(result?.reason); return false; }
    env.sound.play(result.action === 'heal' ? 'rustle' : 'clack', { vol: .45 }); refresh(); return true;
  };
  const physical = createInventoryWorld(env, model, {
    onNotice: tell,
    onPickup: item => { refresh(); tell(item.type === 'paper' ? `Paper +${item.quantity}` : ITEM_DEFS[item.type]?.name || 'Picked up'); },
  });
  function select(index) { if (canAct() && model.select(index)) refresh(); }
  function use() {
    if (!canAct()) return;
    const snapshot = model.read(), item = snapshot.slots[snapshot.selected];
    // Put the mark into the world before spending chalk. A bad floor or failed
    // placement never consumes a use. This synchronous action cannot race UI.
    if (item?.type === 'chalk' && item.uses > 0) {
      const placed = physical.mark();
      if (!placed.ok) { tell(placed.reason || 'no-mark-space'); return; }
    }
    const result = model.useSelected({ heal: env.health?.heal });
    if (!accepted(result)) return;
    if (result.action === 'combine') view.beginCombine(snapshot.selected);
    if (result.action === 'heal') tell(`+${result.amount} health`);
  }
  function drop() {
    if (!canAct()) return;
    if (accepted(physical.dropSelected())) { view.cancelCombine(); refresh(); }
  }
  function combine(from, to) {
    if (!canAct()) return;
    if (accepted(model.combine(from, to))) { view.cancelCombine(); refresh(); tell('Batteries fitted'); }
  }
  function rechargeCamera(from) {
    if (disposed || !canAct()) return;
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
  function give(item) {
    if (disposed || !canAct()) return { ok: false, reason: 'unavailable' };
    const wasEmpty = !held(), result = model.add(item);
    if (result.ok) {
      if (wasEmpty) model.select(result.index);
      refresh(); env.sound.play('clack', { vol: .45 });
      tell(result.item.type === 'paper' ? `Paper +${result.accepted}` : ITEM_DEFS[result.item.type].name);
    }
    return result; // The giver keeps any rejected item or paper remainder.
  }
  function consumeHeld(type, amount = 1) {
    if (disposed || !canAct()) return { ok: false, reason: 'unavailable' };
    const result = model.consumeSelected(type, amount);
    if (result.ok) refresh();
    return result;
  }
  const view = createInventoryHud({ host: env.hud.el, onSelect: select, onUse: use, onDrop: drop, onCombine: combine, onRecharge: rechargeCamera,
    onOpen: open => {
      if (open && !canAct()) { view.setOpen(false); return; }
      onOpen(open);
    },
  });
  refresh();

  /** Place a few review supplies near arrival, on reachable clear floor. Their
   * physical positions are independent of room builders and seeded geometry. */
  function seedSupplies() {
    const me = env.player.me, rt = env.world.roomAt(me.x, me.z);
    if (!rt) return;
    const start = toLocal(rt.def, me.x, me.z), yaw = me.yaw - rt.def.rot * Math.PI / 2;
    const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) }, right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    const items = [makeItem('torch', 'arrival-flashlight', { charge: 54 }), makeItem('battery', 'arrival-batteries'), makeItem('chalk', 'arrival-chalk'),
      makeItem('paper', 'arrival-paper', { quantity: 5 }), makeItem('scissors', 'arrival-scissors'), makeItem('snack', 'arrival-snack'),
      makeItem('balloon', 'arrival-balloon')];
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
  }
  seedSupplies();
  // Scattered packs are deterministic and separate from the room generator.
  // Pick one room per small group, then fall back within that group if its
  // floor has no dry, reachable place. Never put a pack behind a collider.
  const random = makeRng(`inventory-batteries:${env.level.seed}`);
  const rooms = env.world.rooms.filter(rt => rt.id !== env.level.start.room && rt.def.kind !== 'exit');
  for (let start = 0; start < rooms.length; start += BATTERY_ROOM_INTERVAL) {
    let placed = false;
    for (const rt of random.shuffle(rooms.slice(start, start + BATTERY_ROOM_INTERVAL))) {
      const walk = env.world.walkable(rt), seen = walk.flood(rt.def.doors), cells = [];
      for (let i = 0; i < seen.length; i++) if (seen[i]) cells.push(i);
      for (const cell of random.shuffle(cells).slice(0, 256)) {
        const p = walk.at(cell);
        if (physical.spawn(makeItem('battery', `scattered-battery-${rt.id}`), { room: rt.id, x: p.x, z: p.z }).ok) { placed = true; break; }
      }
      if (placed) break;
    }
  }
  return {
    model, physical, view, use, drop, combine, rechargeCamera, select, held, give, consumeHeld,
    get isOpen() { return view.isOpen; },
    owns: target => target instanceof Node && view.el.contains(target),
    close: () => view.setOpen(false),
    handleKey(e) {
      if (!canAct()) return false;
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
      view.el.inert = !canAct(); physical.update(dt); refresh(); view.tick(dt);
    },
    torchPower() { return model.read().activeTorch ? 1 : 0; },
    report: () => ({ ...snapshot(), open: view.isOpen, world: physical.report() }),
    dispose() { if (disposed) return; disposed = true; view.destroy(); physical.dispose(); model.clear(); },
  };
}
