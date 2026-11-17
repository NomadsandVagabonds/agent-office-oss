// Visit-local supplies. Reward coins and the escape keycard remain in loot.js.
// No rendering, world effects, storage or clocks live in this model.
import { CRAFTING_TUNING, previewCraft } from './crafting.js';

export const ITEM_DEFS = Object.freeze({
  torch: Object.freeze({ name: 'Flashlight', description: 'A worn hand torch. Its narrow beam reaches into the unlit corners.', useLabel: 'Switch on', maxCharge: CRAFTING_TUNING.torchCharge }),
  battery: Object.freeze({ name: 'Battery pack', description: 'A pair of heavy cells wrapped together. Fits the camera or flashlight.', useLabel: 'Fit batteries' }),
  chalk: Object.freeze({ name: 'Chalk', description: 'A short piece of white chalk. Leave a mark to recognize a place again.', useLabel: 'Mark floor', maxUses: 6 }),
  paper: Object.freeze({ name: 'Paper', description: 'Blank office paper, warm from a printer you cannot hear.', useLabel: 'Combine', maxStack: CRAFTING_TUNING.maxPaper }),
  lighter: Object.freeze({ name: 'Lighter', description: 'A scratched metal lighter. The wheel catches on the second turn.', useLabel: 'Combine' }),
  tape: Object.freeze({ name: 'Adhesive tape', description: 'A half-used roll of grey tape. The torn end is folded back.', useLabel: 'Combine' }),
  scissors: Object.freeze({ name: 'Scissors', description: 'Heavy steel scissors with chipped red handles. Good for three desperate jabs at close range before the stiff pivot snaps.', useLabel: 'Snip', maxUses: 3 }),
  snack: Object.freeze({ name: 'Wrapped snack', description: 'A sealed oat bar. The wrapper has no date.', useLabel: 'Eat', healAmount: 1 }),
  'pink-slip': Object.freeze({ name: 'Pink slip', description: 'FORM HR-404, Notice of Redundancy. The name on it is yours; the date is last week.', useLabel: 'Use' }),
  opener: Object.freeze({ name: 'Remote', description: 'A grey remote with one button. Nothing on it says what it is for.', useLabel: 'Use' }),
  call: Object.freeze({ name: 'Trail call', description: 'A tarnished brass bird-call in a birch sleeve, hung on a green lanyard. Something in the trees answers it.', useLabel: 'Use' }),
  balloon: Object.freeze({ name: 'Red balloon', description: 'A red balloon on a curling string. It tugs upward without a breeze.', useLabel: 'Use' }),
});
const ITEM_ALIASES = Object.freeze({
  'loose-papers': 'paper', 'red-balloon': 'balloon', 'facilities-flashlight': 'torch',
});

/** Explicit room-authoring names share the same small set of carried types. */
export function normalizeItemType(type) {
  if (typeof type !== 'string') return null;
  if (Object.hasOwn(ITEM_ALIASES, type)) return ITEM_ALIASES[type];
  return Object.hasOwn(ITEM_DEFS, type) ? type : null;
}

const slotNumber = (n, size) => Number.isInteger(n) && n >= 0 && n < size;
const copy = item => item ? { ...item } : null;

/** Create the small serializable record carried into, out of, and around a slot. */
export function makeItem(type, id, overrides = {}) {
  type = normalizeItemType(type);
  if (type === null || typeof id !== 'string' || !id.trim()) {
    throw new TypeError('An inventory item needs a known type and a nonempty string id.');
  }
  const item = { id, type }, definition = ITEM_DEFS[type];
  if (type === 'torch') {
    const charge = overrides.charge ?? definition.maxCharge;
    if (!Number.isFinite(charge) || charge < 0 || charge > definition.maxCharge) throw new RangeError('Invalid flashlight charge.');
    item.charge = charge;
    const prepared = overrides.prepared === undefined ? false : overrides.prepared;
    if (typeof prepared !== 'boolean') throw new TypeError('Invalid flashlight preparation.');
    item.prepared = prepared;
  } else if (type === 'chalk') {
    const uses = overrides.uses ?? definition.maxUses;
    if (!Number.isInteger(uses) || uses < 0 || uses > definition.maxUses) throw new RangeError('Invalid chalk uses.');
    item.uses = uses;
  } else if (type === 'scissors') {
    const uses = overrides.uses === undefined ? definition.maxUses : overrides.uses;
    if (!Number.isInteger(uses) || uses < 0 || uses > definition.maxUses) throw new RangeError('Invalid scissors uses.');
    item.uses = uses;
  } else if (type === 'paper') {
    const quantity = overrides.quantity === undefined ? 1 : overrides.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > definition.maxStack) throw new RangeError('Invalid paper quantity.');
    item.quantity = quantity;
  }
  return item;
}

/**
 * Paper shares a slot up to ten sheets; other objects occupy one slot each.
 * Mutations never leak references. Drops retain charge, uses and quantities.
 */
export function createInventory({
  size = 6,
  initial = null,
  canMountTorch = true,
  fireSecondsPerSheet = CRAFTING_TUNING.fireSecondsPerSheet,
  batterySeconds,
  torchDrainRate = 1,
} = {}) {
  if (!Number.isInteger(size) || size < 1 || size > 8) throw new RangeError('Inventory has one to eight slots.');
  const rate = Number.isFinite(torchDrainRate) && torchDrainRate > 0 ? torchDrainRate : 1;
  const slots = Array(size).fill(null);
  let selected = 0, holstered = false, activeTorch = null, mountedTorch = null, revision = 0, crafting = false;
  // Restore a detached authoritative bag, including empty pockets and mounted equipment.
  if (initial) {
    if (!Array.isArray(initial.slots) || initial.slots.length !== size) throw new TypeError('Invalid inventory slots.');
    initial.slots.forEach((item, i) => { if (item) slots[i] = makeItem(item.type, item.id, item); });
    if (initial.mountedTorch) {
      mountedTorch = makeItem(initial.mountedTorch.type, initial.mountedTorch.id, initial.mountedTorch);
      if (mountedTorch.type !== 'torch' || !mountedTorch.prepared) throw new TypeError('Invalid mounted flashlight.');
    }
    const ids = [...slots.filter(Boolean), mountedTorch].filter(Boolean).map(i => i.id);
    if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate inventory identity.');
    if (!slotNumber(initial.selected, size)) throw new TypeError('Invalid selected pocket.');
    selected = initial.selected; holstered = !!initial.holstered;
    const light = [...slots, mountedTorch].find(i => i?.id === initial.activeTorch);
    activeTorch = light?.type === 'torch' && light.charge > 0 ? light.id : null;
    revision = Number.isSafeInteger(initial.revision) && initial.revision >= 0 ? initial.revision : 0;
  }
  const fail = reason => ({ ok: false, reason });
  const read = () => ({ slots: slots.map(copy), selected, holstered, activeTorch, mountedTorch: copy(mountedTorch), revision });
  const activeLight = () => mountedTorch?.id === activeTorch ? mountedTorch : slots.find(item => item?.id === activeTorch);
  const torchPower = () => {
    const torch = activeLight();
    return torch?.type === 'torch' && torch.charge > 0 && (activeTorch === mountedTorch?.id || (!holstered && slots[selected]?.id === activeTorch)) ? 1 : 0;
  };

  function add(value) {
    if (crafting) return fail('busy');
    let item;
    try { item = makeItem(value?.type, value?.id, value); }
    catch { return fail('invalid-item'); }
    if (mountedTorch?.id === item.id || slots.some(other => other?.id === item.id)) return fail('duplicate');
    const emptyIndex = slots.indexOf(null);
    if (item.type === 'paper') {
      // Transfer only what fits. The ground record keeps its identity if some
      // sheets remain; that id enters the bag only when a new stack is needed.
      let remaining = item.quantity, index = -1;
      for (let i = 0; i < slots.length && remaining > 0; i++) {
        const stack = slots[i];
        if (stack?.type !== 'paper' || stack.quantity >= ITEM_DEFS.paper.maxStack) continue;
        const moved = Math.min(remaining, ITEM_DEFS.paper.maxStack - stack.quantity);
        stack.quantity += moved; remaining -= moved;
        if (index < 0) index = i;
      }
      if (remaining > 0 && emptyIndex >= 0) {
        slots[emptyIndex] = { ...item, quantity: remaining }; remaining = 0;
        if (index < 0) index = emptyIndex;
      }
      const accepted = item.quantity - remaining;
      if (accepted === 0) return fail('full');
      revision++;
      return { ok: true, index, item: copy(slots[index]), accepted,
        remainder: remaining > 0 ? { ...item, quantity: remaining } : null };
    }
    if (emptyIndex < 0) return fail('full');
    slots[emptyIndex] = item; revision++;
    return { ok: true, index: emptyIndex, item: copy(item), accepted: 1, remainder: null };
  }

  function remove(id) {
    if (crafting) return null;
    if (typeof id !== 'string' || !id.trim()) return null;
    const index = slots.findIndex(item => item?.id === id);
    if (index < 0) return null;
    const item = slots[index]; slots[index] = null;
    if (activeTorch === id) activeTorch = null;
    revision++;
    return copy(item);
  }
  // Number keys can put an item away without changing its pocket. Clicking
  // a pocket still equips it, even when that pocket was stowed.
  function select(index, { toggle = false } = {}) {
    if (crafting) return false;
    if (!slotNumber(index, size)) return false;
    const stow = toggle && selected === index && !!slots[index] && !holstered;
    if (selected !== index || holstered !== stow) { selected = index; holstered = stow; revision++; }
    return true;
  }
  function useSelected({ canMark = true, heal, snip } = {}) {
    if (crafting) return fail('busy');
    const item = slots[selected];
    if (holstered || !item) return fail('empty');
    if (['battery', 'paper', 'lighter', 'tape'].includes(item.type)) return { ok: true, action: 'combine', item: copy(item), index: selected };
    if (item.type === 'torch') {
      if (activeTorch === item.id) {
        activeTorch = null; revision++;
        return { ok: true, action: 'torch-off', item: copy(item), index: selected };
      }
      if (item.charge <= 0) return fail('empty-charge');
      activeTorch = item.id; revision++;
      return { ok: true, action: 'torch-on', item: copy(item), index: selected };
    }
    if (item.type === 'chalk') {
      if (item.uses <= 0) return fail('empty-chalk');
      if (!canMark) return fail('no-mark-space');
      item.uses--;
      const used = copy(item);
      if (item.uses === 0) slots[selected] = null;
      revision++;
      return { ok: true, action: 'mark', item: used, index: selected };
    }
    if (item.type === 'scissors') {
      if (item.uses <= 0) return fail('broken-scissors');
      if (typeof snip !== 'function') return fail('no-snip-target');
      const index = selected;
      const result = snip(copy(item));
      if (result?.ok !== true) return fail(result?.reason || 'no-snip-target');
      if (slots[index]?.id !== item.id) return fail('stale-input');
      item.uses--;
      const used = copy(item);
      const snapped = item.uses === 0;
      if (snapped) slots[index] = null;
      revision++;
      return { ok: true, action: 'snip', snapped, target: result.target || null, item: used, index };
    }
    if (item.type === 'snack') {
      if (typeof heal !== 'function') return fail('health-unavailable');
      const index = selected;
      const result = heal(ITEM_DEFS.snack.healAmount);
      if (result?.ok !== true || !Number.isSafeInteger(result.amount) || result.amount <= 0) {
        return fail(result?.reason || 'health-unavailable');
      }
      slots[index] = null;
      revision++;
      return { ok: true, action: 'heal', amount: result.amount, item: copy(item), index };
    }
    return fail('no-use');
  }

  /** F uses the mounted light first, otherwise the flashlight in hand. */
  function toggleLight() {
    if (crafting) return fail('busy');
    if (holstered && !mountedTorch) return fail('no-light');
    const index = mountedTorch ? null : selected;
    const item = mountedTorch || slots[index];
    if (item?.type !== 'torch') return fail('no-light');
    if (activeTorch === item.id) {
      activeTorch = null; revision++;
      return { ok: true, action: 'torch-off', item: copy(item), index };
    }
    if (item.charge <= 0) return fail('empty-charge');
    activeTorch = item.id; revision++;
    return { ok: true, action: 'torch-on', item: copy(item), index };
  }

  /** Give only the currently held object or sheets, never search other pockets. */
  function consumeSelected(type, amount = 1) {
    if (crafting) return fail('busy');
    type = normalizeItemType(type);
    if (type === null) return fail('invalid-item');
    if (!Number.isSafeInteger(amount) || amount <= 0) return fail('invalid-amount');
    const item = slots[selected];
    if (holstered || !item) return fail('empty');
    if (item.type !== type) return fail('wrong-item');
    const available = item.type === 'paper' ? item.quantity : 1;
    if (amount > available) return fail('insufficient');
    const consumed = copy(item);
    if (item.type === 'paper') consumed.quantity = amount;
    if (amount === available) {
      slots[selected] = null;
      if (activeTorch === item.id) activeTorch = null;
    } else item.quantity -= amount;
    revision++;
    return { ok: true, action: 'consume', item: consumed, index: selected };
  }

  function combine(fromIndex, toIndex) {
    if (crafting) return fail('busy');
    if (!slotNumber(fromIndex, size) || !slotNumber(toIndex, size)) return fail('invalid-slot');
    const source = slots[fromIndex], target = slots[toIndex];
    if (fromIndex === toIndex || source?.type !== 'battery' || target?.type !== 'torch') return fail('incompatible');
    if (target.charge >= ITEM_DEFS.torch.maxCharge) return fail('full-charge');
    target.charge = ITEM_DEFS.torch.maxCharge;
    slots[fromIndex] = null;
    if (selected === fromIndex) selected = toIndex;
    revision++;
    return { ok: true, action: 'recharge', index: toIndex, item: copy(target), consumed: copy(source) };
  }
  /** Revalidate both identities before calling a synchronous external effect.
   * While that effect runs, callbacks cannot reenter and spend the same input. */
  function craft(refs, { paperCount = 1, camera, ignite } = {}) {
    if (crafting) return fail('busy');
    let cameraSnapshot;
    try { if (Array.isArray(refs) && refs.some(ref => ref?.device === 'camera') && typeof camera?.read === 'function') cameraSnapshot = camera.read(); }
    catch { return fail('camera-unavailable'); }
    const plan = previewCraft({ ...read(), camera: cameraSnapshot }, refs, {
      paperCount, canMountTorch, fireSecondsPerSheet, batterySeconds,
    });
    if (!plan.ok) return plan;
    const of = type => plan.inputs.find(input => input.type === type);
    if (plan.recipe === 'torch-battery') {
      if (of('torch').ref.device === 'mounted-torch') {
        const source = of('battery');
        mountedTorch.charge = ITEM_DEFS.torch.maxCharge;
        slots[source.ref.slot] = null; revision++;
        return { ok: true, recipe: plan.recipe, action: 'recharge', index: null, item: copy(mountedTorch),
          consumed: [copy(source.item)], result: { item: copy(mountedTorch) } };
      }
      const result = combine(of('battery').ref.slot, of('torch').ref.slot);
      return { ...result, recipe: plan.recipe, consumed: [copy(result.consumed)], result: { item: copy(result.item) } };
    }
    if (plan.recipe === 'tape-torch') {
      const source = of('tape'), target = of('torch');
      slots[target.ref.slot].prepared = true;
      slots[source.ref.slot] = null;
      revision++;
      return { ok: true, recipe: plan.recipe, action: 'prepare-torch', consumed: [copy(source.item)],
        item: copy(slots[target.ref.slot]), result: { prepared: true } };
    }
    if (plan.recipe === 'mount-torch') {
      const source = of('torch');
      // Equipment keeps its own charge and identity, but occupies no pocket.
      // Leave selection in place: mounting the held torch leaves empty hands.
      mountedTorch = slots[source.ref.slot];
      slots[source.ref.slot] = null;
      revision++;
      return { ok: true, recipe: plan.recipe, action: 'mount-torch', consumed: [],
        item: copy(mountedTorch), result: { mountedTorch: copy(mountedTorch) } };
    }
    const action = plan.recipe === 'camera-battery' ? 'recharge-camera' : 'ignite';
    const effect = plan.recipe === 'camera-battery'
      ? (typeof camera?.recharge === 'function' ? () => camera.recharge(plan.seconds) : null)
      : (typeof ignite === 'function' ? () => ignite({ paperCount: plan.paperCount, duration: plan.duration,
        paper: copy(of('paper').item), lighter: copy(of('lighter').item) }) : null);
    const missing = plan.recipe === 'camera-battery' ? 'camera-unavailable' : 'fire-unavailable';
    if (!effect) return fail(missing);
    let result;
    crafting = true;
    try { result = effect(); }
    catch { return fail('effect-failed'); }
    finally { crafting = false; }
    if (result?.ok !== true) return fail(result?.reason || missing);
    if (plan.recipe === 'camera-battery' && (!Number.isFinite(result.added) || result.added <= 0)) return fail('camera-unavailable');
    const source = of(plan.recipe === 'camera-battery' ? 'battery' : 'paper');
    const consumed = copy(source.item);
    if (consumed.type === 'paper') {
      consumed.quantity = plan.paperCount;
      slots[source.ref.slot].quantity -= plan.paperCount;
      if (slots[source.ref.slot].quantity === 0) slots[source.ref.slot] = null;
    } else slots[source.ref.slot] = null;
    revision++;
    return { ok: true, recipe: plan.recipe, action, consumed: [consumed], result,
      ...(plan.recipe === 'paper-fire' ? { paperCount: plan.paperCount, duration: plan.duration } : {}) };
  }
  function mount(id) {
    if (crafting) return fail('busy');
    if (canMountTorch === false) return fail('mount-disabled');
    if (typeof id !== 'string' || !id.trim()) return fail('invalid-input');
    const index = slots.findIndex(other => other?.id === id);
    const item = index >= 0 ? slots[index] : null;
    if (!item || item.type !== 'torch') return fail('invalid-item');
    if (!item.prepared) return fail('not-prepared');
    if (mountedTorch?.id === id) return fail('already-mounted');
    if (mountedTorch) return fail('mount-occupied');
    mountedTorch = item;
    slots[index] = null;
    revision++;
    return { ok: true, mountedTorch: copy(mountedTorch) };
  }
  function tick(dt) {
    if (crafting || !Number.isFinite(dt) || dt <= 0 || !torchPower()) return { changed: false, depleted: false };
    const item = activeLight();
    if (!item) { activeTorch = null; revision++; return { changed: true, depleted: false }; }
    item.charge = Math.max(0, item.charge - dt * rate);
    const depleted = item.charge === 0;
    if (depleted) activeTorch = null;
    revision++;
    return { changed: true, depleted };
  }
  function clear() {
    if (crafting) return;
    if (!slots.some(Boolean) && selected === 0 && !holstered && activeTorch === null && mountedTorch === null) return;
    slots.fill(null); selected = 0; holstered = false; activeTorch = null; mountedTorch = null; revision++;
  }
  return {
    add, remove, select, useSelected, consumeSelected, combine, craft, mount, toggleLight, torchPower, tick, clear, read,
    torchMounted: () => !!mountedTorch && activeTorch === mountedTorch.id,
  };
}
