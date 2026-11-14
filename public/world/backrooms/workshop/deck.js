// The Backrooms — workshop deck & coin hiding spots (pure data: no three.js, no DOM).
// Imported into gen.js so Fable can cherry-pick individual archetypes or the whole slate cleanly.

const about = (x, z, hx, hz = hx) => [x - hx, z - hz, x + hx, z + hz];

const fill = (text, o, R) => String(text)
  .replace(/\{name\}/g, o.name).replace(/\{NAME\}/g, o.name.toUpperCase())
  .replace(/\{agent\}/g, () => R.pick(o.agents)).replace(/\{AGENT\}/g, () => R.pick(o.agents).toUpperCase())
  .replace(/\{project\}/g, () => R.pick(o.projects)).replace(/\{PROJECT\}/g, () => R.pick(o.projects).toUpperCase());

const WELLNESS_SIGNS = [
  ['EXECUTIVE WELLNESS SUITE', 'CHLORINE: NOMINAL · DEPTH: Q4'],
  ['SILENT LAP LANE', 'PLEASE SHOWER BEFORE MERGER'],
  ['THERAPY POOL 37B', 'NO RUNNING · NO DIVING · NO SYNCING'],
  ['HYDRATION & SUBLIMITY', 'LIFEGUARD REASSIGNED TO {PROJECT}'],
];

const PIPE_LABELS = [
  ['HOT', 'COLD', 'DECAF', 'PROD TRAFFIC'],
  ['STEAM', 'CHILLED', 'LIQUID SYNERGY', 'DO NOT VENT'],
  ['RETURN', 'SUPPLY', '{PROJECT} LOGS', 'OVERFLOW'],
  ['GREY WATER', 'ALMOND LINE', 'PRESSURE: FINE', 'TICKET #0002'],
];

const CUSTODIAL_MEMOS = [
  ['NIGHT CUSTODIAL LOG', 'CARPET MOPPED: 4,812 TIMES · STILL DRY'],
  ['FACILITIES NOTICE', 'DO NOT STARTLE THE NIGHT PORTER'],
  ['SUB-LEVEL 4 SCHEDULE', 'CLEANING ASSIGNED TO: {AGENT}'],
  ['SUPPLY INVENTORY', '1x MOP · 1x BUCKET · 0x WINDOWS'],
];

const EXIT_BAIT = [
  { sign: 'EXIT INTERVIEW', plaque: ['YOUR REQUEST TO LEAVE', 'HAS BEEN ESCALATED TO Q5'], clip: 'REASON FOR LEAVING: GRAVITY' },
  { sign: 'RETENTION', plaque: ['THANK YOU FOR STAYING,', '{NAME}'], clip: 'COUNTER-OFFER: MORE CARPET' },
  { sign: 'EXIT (TRIAL)', plaque: ['FREE TRIAL OF OUTSIDE', 'HAS EXPIRED'], clip: 'SEE {AGENT} FOR FULL EXIT' },
  { sign: 'ALMOST EXIT', plaque: ['PLEASE COMPLETE SURVEY', 'BEFORE DEPARTING REALITY'], clip: 'WOULD YOU RECOMMEND THIS FLOOR?' },
];

export const WORKSHOP_DECK = [
  {
    id: 'wellness-pool',
    name: 'Wellness Suite',
    landmark: 'the tiled pool',
    w: [9, 11],
    d: [10, 12],
    h: [3.2, 3.6],
    ports: ['back', 'left', 'right'],
    weight: 1.8,
    lights: 'dim',
    roll: (R, o) => ({
      sign: R.pick(WELLNESS_SIGNS).map((t) => fill(t, o, R)),
      grout: R.pick(['#8fb0ab', '#8ba4b5', '#9ab09e']),
      tile: R.pick(['#ddebe8', '#e2e9ee', '#e4ece2']),
      water: R.pick(['#3bc4be', '#36b2cc', '#46c8b0']),
      benchSide: R.pick([-1, 1]),
      mothCorner: R.int(0, 3),
      towels: R.int(2, 4),
    }),
  },
  {
    id: 'pipe-dreams',
    name: 'Pipe Dreams',
    landmark: 'the steam pipes',
    w: [7, 9],
    d: [11, 14],
    ports: ['back', 'left', 'right'],
    weight: 1.8,
    lights: 'dark',
    roll: (R, o) => ({
      labels: R.pick(PIPE_LABELS).map((t) => fill(t, o, R)),
      smilerSide: R.pick([-1, 1]),
      breakerSide: R.pick([-1, 1]),
      lampTint: R.pick(['#ff9c4a', '#ff6b4a', '#ffd06b']),
      almond: R.chance(0.55),
    }),
  },
  {
    id: 'night-shift',
    name: 'Night Custodial',
    landmark: 'the janitor',
    w: [8, 10],
    d: [8, 10],
    ports: ['back', 'left', 'right'],
    weight: 1.8,
    lights: 'dim',
    roll: (R, o) => ({
      memo: R.pick(CUSTODIAL_MEMOS).map((t) => fill(t, o, R)),
      porterSide: R.pick([-1, 1]),
      desks: R.int(2, 3),
      chairColor: R.pick(['#4a7a6a', '#3f7f9a', '#5a5a66', '#b5483f']),
      cartAlmond: R.chance(0.75),
    }),
  },
  {
    id: 'exit-interview',
    name: 'Exit Interview',
    landmark: 'the other exit',
    w: [6, 8],
    d: [8, 10],
    ports: ['left', 'right'],
    weight: 1.6,
    lights: 'normal',
    roll: (R, o) => {
      const b = R.pick(EXIT_BAIT);
      return {
        sign: b.sign,
        plaque: b.plaque.map((t) => fill(t, o, R)),
        clip: fill(b.clip, o, R),
        warp: R.chance(0.85),
        chairSide: R.pick([-1, 1]),
        wood: R.pick(['#8f5d34', '#7a5230', '#6e4c30']),
      };
    },
  },
];

export const WORKSHOP_STASH = {
  // Dry far-corner promenade of the tiled pool suite, clear of all four centred ports and columns.
  'wellness-pool': (r, s) => about(s * (r.W / 2 - 1.05), -r.D / 2 + 1.05, 0.2),
  // Entry-end side bay behind the pipe stanchion, well clear of front/side doorways and valves.
  'pipe-dreams': (r, s) => about(s * (r.W / 2 - 1.05), r.D / 2 - 1.15, 0.18),
  // Far corner of the custodial office, explicitly reserved before desks or lockers are placed.
  'night-shift': (r, s) => about(s * (r.W / 2 - 1.05), -r.D / 2 + 1.05, 0.2),
  // Front corner beside the entrance of the decoy exit hall, clear of front/left/right doors.
  'exit-interview': (r, s) => about(s * (r.W / 2 - 0.95), r.D / 2 - 1.05, 0.15),
};
