// Two carried objects, or an object and camcorder equipment. Planning is
// pure; the inventory performs the accepted effect before spending anything.
import { CAMERA_TUNING } from './camera-state.js';

export const CAMERA_INPUT = Object.freeze({ device: 'camera' });
export const FIRE_SECONDS_PER_SHEET = 8;
export const CRAFTING_TUNING = Object.freeze({ torchCharge: 180, maxPaper: 10, fireSecondsPerSheet: FIRE_SECONDS_PER_SHEET });
export const RECIPES = Object.freeze({
  'torch-battery': Object.freeze({ label: 'Fit battery', description: 'Fit a fresh pack into the flashlight.' }),
  'camera-battery': Object.freeze({ label: 'Recharge camera', description: 'Add up to two minutes of recording time.' }),
  'paper-fire': Object.freeze({ label: 'Light paper', description: 'Burn a few sheets on the floor. Keep the lighter.' }),
  'tape-torch': Object.freeze({ label: 'Prepare flashlight', description: 'Wrap the flashlight with tape so it can attach to the camera.' }),
  'mount-torch': Object.freeze({ label: 'Mount flashlight', description: 'Attach the prepared flashlight to the camera and free your hand.' }),
});

const DESCRIPTIONS = Object.freeze({
  'missing-input': 'Choose two objects to combine.',
  'invalid-input': 'Choose an object from a pocket or the camera equipment.',
  'stale-input': 'That object is no longer here. Choose it again.',
  'duplicate-input': 'Choose two different objects.',
  incompatible: 'These objects do not combine.',
  'invalid-amount': 'Choose between one and ten sheets.',
  insufficient: 'There are not that many sheets in the selected stack.',
  'invalid-item': 'This object cannot be used.',
  'camera-unavailable': 'The camcorder is unavailable.',
  'full-charge': 'Already fully charged.',
  depleted: 'This recording has already stopped.',
  'already-prepared': 'This flashlight is already prepared.',
  'not-prepared': 'Prepare the flashlight with tape first.',
  'already-mounted': 'This flashlight is already on the camera.',
  'mount-occupied': 'The camera already has a flashlight.',
});
const failure = (reason, plan = {}) => ({ ...plan, ok: false, reason, description: DESCRIPTIONS[reason] || 'Cannot combine these objects.' });

/** Resolve identity as well as slot position; never substitute a new occupant. */
export function resolveCraftInput(snapshot, ref) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return failure('invalid-input');
  if (Object.hasOwn(ref, 'device')) {
    if (ref.device === 'mounted-torch') {
      if (Object.hasOwn(ref, 'slot') || typeof ref.id !== 'string' || !ref.id.trim()) return failure('invalid-input');
      const torch = snapshot?.mountedTorch;
      if (torch?.id !== ref.id || torch.type !== 'torch') return failure('stale-input');
      return { ok: true, ref: { device: 'mounted-torch', id: torch.id }, type: 'torch', item: { ...torch } };
    }
    if (ref.device !== 'camera' || Object.hasOwn(ref, 'slot') || Object.hasOwn(ref, 'id')) return failure('invalid-input');
    const camera = snapshot?.camera;
    if (!camera || !Number.isFinite(camera.remaining) || !Number.isFinite(camera.capacity)
      || camera.capacity <= 0 || camera.remaining < 0 || camera.remaining > camera.capacity) return failure('camera-unavailable');
    return { ok: true, ref: { ...CAMERA_INPUT }, type: 'camera', item: null, camera: { ...camera } };
  }
  if (!Number.isInteger(ref.slot) || ref.slot < 0 || !Array.isArray(snapshot?.slots) || ref.slot >= snapshot.slots.length
    || typeof ref.id !== 'string' || !ref.id.trim()) return failure('invalid-input');
  const item = snapshot.slots[ref.slot];
  if (!item || item.id !== ref.id) return failure('stale-input');
  return { ok: true, ref: { slot: ref.slot, id: ref.id }, type: item.type, item: { ...item } };
}

/** Order-independent recipe preview. No records or services are mutated. */
export function previewCraft(snapshot, refs, { paperCount = 1 } = {}) {
  if (!Array.isArray(refs) || refs.length !== 2 || refs.some(ref => !ref)) return failure('missing-input');
  const inputs = refs.map(ref => resolveCraftInput(snapshot, ref));
  const invalid = inputs.find(input => !input.ok);
  if (invalid) return invalid;
  const [a, b] = inputs;
  if ((a.type === 'camera' && b.type === 'camera') || (a.item && b.item && a.item.id === b.item.id)) return failure('duplicate-input');
  const of = type => inputs.find(input => input.type === type);
  const plan = recipe => ({ ok: true, recipe, ...RECIPES[recipe], inputs });
  if (of('battery') && of('torch')) {
    const out = plan('torch-battery'), charge = of('torch').item.charge;
    if (!Number.isFinite(charge) || charge < 0 || charge > CRAFTING_TUNING.torchCharge) return failure('invalid-item', out);
    return charge === CRAFTING_TUNING.torchCharge ? failure('full-charge', out) : out;
  }
  if (of('battery') && of('camera')) {
    const out = { ...plan('camera-battery'), seconds: CAMERA_TUNING.batterySeconds }, camera = of('camera').camera;
    if (camera.depleted || camera.remaining === 0) return failure('depleted', out);
    return camera.remaining === camera.capacity ? failure('full-charge', out) : out;
  }
  if (of('paper') && of('lighter')) {
    const quantity = of('paper').item.quantity;
    const out = { ...plan('paper-fire'), paperCount, maxPaper: quantity,
      duration: Number.isSafeInteger(paperCount) ? paperCount * FIRE_SECONDS_PER_SHEET : 0 };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > CRAFTING_TUNING.maxPaper) return failure('invalid-item', out);
    if (!Number.isSafeInteger(paperCount) || paperCount < 1 || paperCount > CRAFTING_TUNING.maxPaper) return failure('invalid-amount', out);
    return paperCount > quantity ? failure('insufficient', out) : out;
  }
  if (of('tape') && of('torch')) {
    const out = plan('tape-torch');
    return of('torch').item.prepared ? failure('already-prepared', out) : out;
  }
  if (of('torch') && of('camera')) {
    const out = plan('mount-torch'), torch = of('torch').item, camera = of('camera').camera;
    if (camera.depleted || camera.remaining === 0) return failure('depleted', out);
    if (!torch.prepared) return failure('not-prepared', out);
    if (snapshot.mountedTorch?.id === torch.id) return failure('already-mounted', out);
    if (snapshot.mountedTorch) return failure('mount-occupied', out);
    return out;
  }
  return failure('incompatible');
}
