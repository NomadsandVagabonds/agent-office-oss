// The Office / BlockRooms — employee department kits (sidegrades: every kit gives something up for what it gains).
// Pure: no DOM, no Three.js, no I/O. Cosmetics (core/look.mjs) are completely
// separate from perks; visitors who walk straight in get `Standard Issue`
// (`none`), with zero upsides and zero downsides.
import { hashId } from './look.mjs';

export const DEFAULT_PERK = 'none';

const BASE = Object.freeze({
  cost: 0,
  pockets: 6,
  maxHealth: 4,
  regenSeconds: 0,
  maxSnackHealth: 4,
  cameraStart: 300,
  cameraCapacity: 400,
  cameraDrainRate: 1,
  batterySeconds: 120,
  torchDrainRate: 1,
  walkScale: 1,
  sprintScale: 1,
  crouchSpeedFloor: 0.42,
  noiseScale: 1,
  sprintAlertFar: 0,
  crouchSightScale: 1,
  crouchNoticeScale: 1,
  doorHoldScale: 1,
  fov: 62,
  shadowDrain: 0.5,
  fireSecondsPerSheet: 8,
  canMountTorch: true,
});

const def = (spec) => Object.freeze({
  ...BASE,
  ...spec,
  maxSnackHealth: spec.maxSnackHealth ?? spec.maxHealth ?? BASE.maxHealth,
  upsides: Object.freeze(spec.upsides || []),
  downsides: Object.freeze(spec.downsides || []),
});

export const PERK_LIST = Object.freeze([
  def({
    id: 'none',
    name: 'Standard Issue',
    dept: 'GENERAL STAFF',
    code: 'STD-00',
    icon: 'camcorder',
    cost: 0,
    summary: 'Unmodified visitor pass. Six pockets, four hearts, standard VHS camcorder.',
    upsides: [],
    downsides: [],
  }),
  def({
    id: 'supply-clerk',
    name: 'Supply Clerk',
    dept: 'STORES & RECEIVING',
    code: 'SUP-08',
    icon: 'floppy',
    cost: 1,
    summary: 'Deep cargo apron from the basement stores, weighed down by extra stock.',
    upsides: [
      '+2 pockets (8 total)',
      'Start with 2 random store supplies',
    ],
    downsides: [
      '-12% walk & sprint speed',
    ],
    pockets: 8,
    walkScale: 0.88,
    sprintScale: 0.88,
  }),
  def({
    id: 'senior-staff',
    name: 'Senior Staff',
    dept: 'EXECUTIVE FLOOR',
    code: 'EXE-75',
    icon: 'heart',
    cost: 1,
    summary: 'Tenured composure recovers from scrapes, paired with an older power-hungry deck.',
    upsides: [
      'Regenerate +1 heart every 75s without taking damage',
    ],
    downsides: [
      '+25% camcorder battery drain',
    ],
    regenSeconds: 75,
    cameraDrainRate: 1.25,
  }),
  def({
    id: 'it-support',
    name: 'IT Support',
    dept: 'SYSTEMS & POWER',
    code: 'SYS-50',
    icon: 'battery',
    cost: 1,
    summary: 'Squeezes extra runtime out of every cell, on a strict vending-machine diet.',
    upsides: [
      'Batteries add +50% camcorder time (+3:00)',
      'Flashlight cells drain 25% slower',
    ],
    downsides: [
      'Snacks cannot heal past 50% health (2 / 4)',
    ],
    batterySeconds: 180,
    torchDrainRate: 0.75,
    maxSnackHealth: 2,
  }),
  def({
    id: 'courier',
    name: 'Courier',
    dept: 'INTERNAL MAILROOM',
    code: 'MLR-18',
    icon: 'shoe',
    cost: 1,
    summary: 'Built for flat-out corridor sprints in loud hard-soled mailroom shoes.',
    upsides: [
      '+18% sprint speed',
    ],
    downsides: [
      '+45% footstep noise & ceiling-sonar earshot',
      'Sprinting upright within 7m alerts the Mascot',
    ],
    sprintScale: 1.18,
    noiseScale: 1.45,
    sprintAlertFar: 7,
  }),
  def({
    id: 'night-cleaner',
    name: 'Night Cleaner',
    dept: 'CUSTODIAL SHIFT',
    code: 'NGT-02',
    icon: 'moth',
    cost: 1,
    summary: 'Soft-soled and nearly unseen while stooped, with zero margin for a grab.',
    upsides: [
      'Fast crouch-walk & silent stooped footsteps',
      '-50% Mascot sight range & 2x slower notice while crouched',
    ],
    downsides: [
      '2 / 2 max hearts (one Mascot grab is fatal)',
    ],
    maxHealth: 2,
    maxSnackHealth: 2,
    crouchSpeedFloor: 0.82,
    noiseScale: 0.65,
    crouchSightScale: 0.5,
    crouchNoticeScale: 2,
  }),
  def({
    id: 'facilities',
    name: 'Facilities',
    dept: 'PLANT & MAINTENANCE',
    code: 'FAC-04',
    icon: 'torch',
    cost: 1,
    summary: 'Rigged lamp on the housing and a heavy hand on every fire-door latch.',
    upsides: [
      'Start with a taped flashlight mounted (50% charge)',
      'Fire doors you shut hold the Mascot 2x longer (10s)',
    ],
    downsides: [
      '-2 pockets (4 total)',
    ],
    pockets: 4,
    doorHoldScale: 2,
  }),
  def({
    id: 'av-tech',
    name: 'AV Tech',
    dept: 'AUDIO / VISUAL POOL',
    code: 'AVP-78',
    icon: 'cog',
    cost: 1,
    summary: '0.7x wide-angle adapter catches more of the room on a smaller battery pack.',
    upsides: [
      'Wide-angle lens (78° FOV — freezes wider view)',
    ],
    downsides: [
      '-20% camcorder battery (4:00 start / 5:20 max)',
      'Shadow flashbulb drains 70% charge',
    ],
    fov: 78,
    cameraStart: 240,
    cameraCapacity: 320,
    shadowDrain: 0.7,
  }),
  def({
    id: 'records-purge',
    name: 'Records Purge',
    dept: 'SHREDDING & ARCHIVES',
    code: 'ARC-12',
    icon: 'envelope',
    cost: 1,
    summary: 'Sent down with a lighter and dry stock; keeps the lens rail bare.',
    upsides: [
      'Start with Office Lighter + 3 sheets of paper',
      'Paper fires burn +50% longer (12s per sheet)',
    ],
    downsides: [
      'Cannot mount a flashlight to the camcorder',
      '3 / 3 max hearts',
    ],
    maxHealth: 3,
    maxSnackHealth: 3,
    fireSecondsPerSheet: 12,
    canMountTorch: false,
  }),
]);

export const PERKS = Object.freeze(Object.fromEntries(PERK_LIST.map((p) => [p.id, p])));
export const PERK_IDS = Object.freeze(PERK_LIST.map((p) => p.id));

/** Return a valid perk id, falling back to `none`. */
export function cleanPerk(id) {
  return typeof id === 'string' && Object.hasOwn(PERKS, id) ? id : DEFAULT_PERK;
}

/** Return the frozen perk definition for `id` (defaults to Standard Issue). */
export function resolvePerk(id) {
  return PERKS[cleanPerk(id)];
}

// Non-weapon store pool for Supply Clerk's two seeded starting items.
const STORE_POOL = Object.freeze([
  Object.freeze({ type: 'battery' }),
  Object.freeze({ type: 'snack' }),
  Object.freeze({ type: 'chalk' }),
  Object.freeze({ type: 'tape' }),
  Object.freeze({ type: 'torch', charge: 120 }),
  Object.freeze({ type: 'paper', quantity: 3 }),
]);

/**
 * Deterministic starting pocket items for `(perkId, seed)`.
 * Shared `?tape=<seed>` runs receive the exact same Supply Clerk roll.
 */
export function starterLoadout(perkId, seed = '') {
  const id = cleanPerk(perkId);
  if (id === 'facilities') {
    return [{ type: 'torch', id: 'perk:facilities:torch', charge: 90, prepared: true, mounted: true }];
  }
  if (id === 'records-purge') {
    return [
      { type: 'lighter', id: 'perk:records-purge:lighter' },
      { type: 'paper', id: 'perk:records-purge:paper', quantity: 3 },
    ];
  }
  if (id === 'supply-clerk') {
    let s = hashId(`perk:supply-clerk:${String(seed)}`) || 1;
    const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s; };
    const pool = STORE_POOL.slice();
    const out = [];
    for (let i = 0; i < 2 && pool.length; i++) {
      const idx = next() % pool.length;
      const picked = pool.splice(idx, 1)[0];
      out.push({ ...picked, id: `perk:supply-clerk:${i}:${picked.type}` });
    }
    return out;
  }
  return [];
}
