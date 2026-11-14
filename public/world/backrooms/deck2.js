// The Backrooms — the deck, continued. Pure. The same contract as the DECK in
// gen.js (which deals these along with its own): an id, a landmark, a size, the
// walls that may take one more doorway, how the ceiling behaves, and `roll`,
// which decides everything the builder (rooms5.js onward) needs to know.
//
// What an entry here may carry that the first deck never did (docs/BACKROOMS.md, "Adding a room", has every field):
//   module   './rooms/<id>.js' — the file its builder is in (`export function build(c)`), fetched the first time a
//            floor has the room on it. A room is then its own files and one line here.
//   stash    (room, ±1) → [x0, z0, x1, z1]: where a tape may hang, in the room's own frame (see STASH in gen.js)
//   on       false: retired. It is out of the deck, and nothing else has to change.
//   halo     { back, side, lip }  metres of floor plan kept empty behind and beside the room, from `lip` metres in.
//            The room you walk in is a balcony; what you look out over is drawn inside the halo, so no other room
//            can ever be standing in the view.
//   themes   { theme id: weight multiplier }  the kinds of floor it is more (or less) at home on
//   planned  true: never dealt by chance — only on the floor the visit's plan puts it on (plan.js `must`)
//   resident the id of whoever lives in the room, if somebody does (one such room to a part of the building, at most)
//   items    what that resident cares about that a visitor might be carrying (inventory item types)
//   caught   how many hearts it costs to be got by them
//   fire     what a fire lit by the visitor is to them, where it is anything: 'fears' | 'drawn' (cast/fire.rule.js; the room's rule does it, with c.fire)
//   doors    'own': the room hangs doors of its own on its doorways, so the floor's fire doors (doors.js) keep off them
//   headline true: the place has half-remembered something from the news and staged it wrongly. Which stories become
//            rooms is the owner's choice, nobody else's; the plan puts at most one in a visit, never on its first floor.

import { freightStash } from './rooms/dispatch/layout.js';
import { fill } from './words.js';

const cornerStash = (r, side) => (side < 0
  ? [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.35, -r.D / 2 + 1.35]
  : [r.W / 2 - 1.35, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.35]);

const about = (x, z, hx, hz = hx) => [x - hx, z - hz, x + hx, z + hz];

// Words for the four rooms after Gemini's Wave 2 (vestibule, copiers, quiet-zone, mailroom).
const VESTIBULE_SIGNS = [
  ['CLIMATE LOCK VESTIBULE', 'PLEASE KEEP REVOLVING  ·  DO NOT PROP'],
  ['{PROJECT} LOBBY AIRLOCK', 'OUTSIDE WEATHER: UNAVAILABLE'],
  ['MAIN ENTRANCE (INTERNAL)', 'ALL VISITORS MUST REVOLVE'],
  ['DRAFT EXCLUSION ZONE', 'DO NOT SHARE A QUADRANT WITH {AGENT}'],
];
const PANE_WORDS = ['PUSH SLOWLY', 'AUTOMATIC', 'KEEP MOVING', 'CLIMATE LOCK'];
const MAT_WORDS = ['WELCOME BACK, {NAME}', 'ARRIVALS', 'LOBBY', 'THANK YOU FOR VISITING'];

const COPIER_SIGNS = [
  ['REPROGRAPHICS', 'PERSONAL COPIES BILLED TO {PROJECT}'],
  ['COPY ROOM', 'DO NOT LOOK DIRECTLY AT THE GREEN BAR'],
  ['MULTIFUNCTION DEVICES', 'LAST CLEARED BY {AGENT}'],
  ['SHARED PRINT QUEUE', '4,812 JOBS AHEAD OF YOURS'],
];
const COPIER_SHEETS = ['ceiling', 'black', 'jam', 'memo', 'hand', 'ceiling'];

const QUIET_HEADERS = ['DEEP WORK ZONE', 'ACOUSTIC FOCUS POD', 'QUIET HOURS (PERMANENT)', '{PROJECT} SILENT ZONE'];
const QUIET_CARDS = [
  'RESERVED: {AGENT}  ·  DO NOT DISTURB',
  'HOT DESK  ·  NO TYPING ABOVE 40 dB',
  'FOCUS BLOCK (ONGOING)  ·  {NAME}',
  'QUIET DESK  ·  PLEASE HOLD ALL SIGHS',
];

const MAIL_SIGNS = [
  ['PNEUMATIC DISPATCH', 'INTER-OFFICE VACUUM POST'],
  ['CENTRAL TUBE EXCHANGE', 'DO NOT SEND LIQUIDS OR {AGENT}'],
  ['INTERNAL MAILROOM', 'ALL ENQUIRIES BY CANISTER'],
];
const MAIL_SLOTS = ['INBOX', 'OUTBOX', 'ESCALATIONS', '{PROJECT}', 'UNASSIGNED', 'UNDELIVERABLE'];

const HALL_FACES = ['break', 'waiting', 'store', 'lounge'];        // (as rooms/unsure-hall.js builds them)

export const MORE_DECK = [
  // The hallway that is not sure where it leads: turn your back on the room at the end of it and it is another room.
  // Never dealt by chance: the visit's plan puts one or two in, below wherever the cardboard people were (plan.js).
  { id: 'unsure-hall', name: 'The Hall That Is Not Sure', landmark: 'the long hallway, whichever room it ends in',
    w: [7, 8], d: [13, 15], ports: ['back'], weight: 1, lights: 'normal', planned: true, needs: ['unwatched'],
    module: './rooms/unsure-hall.js',
    stash: (r) => { const zM = -r.D / 2 + Math.min(7.5, r.D * 0.48); return [-0.5, zM - 2.4, 0.5, zM - 1.4]; },
    roll: (R) => ({ faces: R.shuffle(HALL_FACES.slice()).slice(0, R.int(1, 3)) }) },
  // Four rooms after Gemini's Wave 2, each in a file of its own.
  { id: 'vestibule', module: './rooms/vestibule.js', stash: (r, s) => about(s * (r.W / 2 - 1.15), -r.D / 2 + 1.15, 0.2), name: 'The Vestibule', landmark: 'the revolving doors', w: [9, 10], d: [9, 10], h: [3.0, 3.3],
    ports: ['back'], weight: 1.6, lights: 'normal', themes: { exec: 1.6, night: 1.3 },
    roll: (R, o) => ({
      plaque: R.pick(VESTIBULE_SIGNS).map((t) => fill(t, o, R)),
      decal: R.pick(PANE_WORDS),
      mat: fill(R.pick(MAT_WORDS), o, R).toUpperCase(),
      jamSide: R.pick([-1, 1]),
      dropSide: R.pick([-1, 1]),
      metal: R.pick(['brass', 'brass', 'steel']),
      tint: R.pick(['#8ec5c0', '#96bfd4', '#a8c8b0']),
      wallDrum: R.chance(0.85),
    }) },
  { id: 'copiers', teaches: 'pointed', module: './rooms/copiers.js', stash: (r) => [-0.4, -r.D / 2 + 1.9, 0.4, -r.D / 2 + 2.7], name: 'Copy Room', landmark: 'the photocopiers', w: [7, 9], d: [10, 12],
    ports: ['back'], weight: 1.5, lights: 'dim', themes: { archive: 1.7, night: 1.4 },
    roll: (R, o) => {
      const pairs = R.int(3, 4), total = pairs * 2;
      const sheets = Array.from({ length: total }, () => R.pick(COPIER_SHEETS));
      const clue = R.int(0, total - 1);
      sheets[clue] = 'route';
      return {
        pairs, clue, sheets,
        sign: R.pick(COPIER_SIGNS).map((t) => fill(t, o, R)),
        memo: fill('CONFIDENTIAL  ·  {PROJECT}  ·  BURN BEFORE READING', o, R),
        lids: Array.from({ length: total }, () => R.pick([0.52, 0.68, 0.78, 0.12])),
      };
    } },
  { id: 'quiet-zone', teaches: 'pace', module: './rooms/quiet-zone.js', stash: (r, s) => about(s * (r.W / 2 - 1.05), -r.D / 2 + 1.05, 0.18), name: 'Deep Work Zone', landmark: 'the soundproof room', w: [7, 9], d: [7, 9],
    ports: ['left', 'right'], weight: 1.5, lights: 'dim', themes: { exec: 1.5, fitout: 1.4 },
    roll: (R, o) => ({
      header: fill(R.pick(QUIET_HEADERS), o, R).toUpperCase(),
      deskCard: fill(R.pick(QUIET_CARDS), o, R),
      chair: R.pick(['#3f7f9a', '#4a7a6a', '#5a5a66', '#8a5a8f']),
      foam: R.pick(['#23262c', '#262329', '#1f2628']),
      limit: R.pick([38, 40, 42]),
    }) },
  { id: 'mailroom', teaches: 'pointed', module: './rooms/mailroom.js', stash: (r, s) => about(s * (r.W / 2 - 1.05), -r.D / 2 + 1.05, 0.18), name: 'Mailroom', landmark: 'the brass tubes', w: [7, 9], d: [7, 9],
    ports: ['back', 'left', 'right'], weight: 1.5, lights: 'normal', themes: { archive: 1.6, fitout: 1.3, exec: 1.2 },
    roll: (R, o) => ({
      sign: R.pick(MAIL_SIGNS).map((t) => fill(t, o, R)),
      slots: MAIL_SLOTS.map((t) => fill(t, o, R).toUpperCase().slice(0, 14)),
      brass: R.pick(['#c49a45', '#b8893c', '#c9a654']),
      canisters: R.int(3, 6),
      stamp: fill('ROUTED FOR {NAME}', o, R).toUpperCase(),
    }) },
  // Dispatch (after Codex's): the first room from the news. Wordless and unnamed (as such a room is, unless the owner has said what is written in it). One a visit at most, where the plan puts it.
  { id: 'dispatch', name: 'Dispatch', landmark: 'the wooden shipping crates', w: [18, 20], d: [20, 20], h: [5, 6], ports: [], weight: 0.45, lights: 'dim',
    headline: true, big: true, module: './rooms/dispatch.js', stash: (r) => freightStash(r),
    roll: (R) => ({ layoutSeed: R.int(1, 0x7fffffff), wood: R.pick(['#9b7950', '#8b7350', '#a0875d']) }) },
  // MECHA (Codex's training floor): the second room from the news, and the one whose words the owner has written. Its
  // wardens stay in it (resident), and ten seconds in its empty cage cost two hearts. docs/MECHA.md has the room.
  { id: 'mecha', name: 'MECHA Training Floor', landmark: 'the people in cages training their replacements',
    w: [24, 26], d: [24, 26], h: [5.6, 5.6], ports: ['left', 'right', 'back'], weight: 0.6,
    lights: 'dark', headline: true, big: true, module: './rooms/mecha.js', resident: 'mecha-warden', caught: 2, items: [],
    stash: (r) => [-3.6, r.D / 2 - 1.6, -2.6, r.D / 2 - 0.8],
    roll: (R) => ({ percentages: [97.8, 84.2, 92.6, 76.4, 99.5, 88.1, 95.2, 81.7].map(n => +(n + R.range(-0.3, 0.3)).toFixed(1)),
      batch: R.int(104, 980), variation: R.int(0, 4) }) },  // Rooms with somebody living in them (after Gemini's third pack). A part of the building gets one of these at most
  // (plan.js). resident: who it is, for the count of a visit · items: what they care about that a visitor might carry
  // (supplies.js leaves such things about on that part) · caught: the hearts it costs to be got by them.
  {
    id: 'cable-drop',
    resident: 'trunk-line', items: [], teaches: 'overhead', caught: 1, doors: 'own',
    name: 'The Trunk Drop',
    landmark: 'the patch cables hanging from the ceiling',
    w: [8, 10], d: [8, 10],
    ports: ['back', 'left', 'right'],
    weight: 1.0,
    lights: 'dim',
    themes: { fitout: 1.8, archive: 1.2, night: 1.2 },
    module: './rooms/cable-drop.js',
    stash: cornerStash,
    roll: (R, o) => ({
      offsetZ: +R.range(-0.8, 0.8).toFixed(3),
      crawlSide: R.pick([-1, 1]),
      notice: o.projects.length ? `TRUNK: ${R.pick(o.projects).slice(0, 14).toUpperCase()}` : R.pick(['PATCH BAY 04', 'RISER PLENUM B', 'DO NOT UNPLUG']),
    }),
  },
  {
    id: 'shredding-bay',
    resident: 'retention-clerk', items: ['paper', 'pink-slip'], teaches: 'offering', caught: 2,
    name: 'The Shredding Bay',
    landmark: 'the whistling lady with the shredder',
    w: [8, 10], d: [8, 10],
    ports: ['back', 'right'],
    weight: 1.0,
    lights: 'normal',
    themes: { archive: 1.8, yellow: 1.1, exec: 1.1 },
    module: './rooms/shredding-bay.js',
    stash: cornerStash,
    roll: (R) => ({
      deskSide: R.pick([-1, 1]),
      clerkX: +R.range(-1.3, 1.3).toFixed(3),
      code: R.pick(['RR-7B', 'DOC-99', 'PURGE-4', 'RET-12']),
    }),
  },
  {
    id: 'mandatory-fun',
    resident: 'fun-committee', items: ['balloon'], teaches: 'belonging', caught: 1,
    name: 'Mandatory Fun',
    landmark: 'the staff in party hats with red balloons',
    w: [9, 11], d: [9, 11],
    ports: ['left', 'right'],
    weight: 0.95,
    lights: 'dim',
    themes: { yellow: 1.3, exec: 1.3, night: 1.1 },
    module: './rooms/mandatory-fun.js',
    stash: cornerStash,
    roll: (R, o) => ({
      greeterSide: R.pick([-1, 1]),
      occasion: o.projects.length ? `${R.pick(o.projects).slice(0, 12).toUpperCase()} LAUNCH` : R.pick(['Q3 MORALE SYNC', 'CULTURE HOUR', 'TEAM SPIRIT DAY']),
    }),
  },
  {
    id: 'blackout-bay',
    resident: 'stand-ins', items: ['torch'], teaches: 'beam', caught: 2, fire: 'fears',
    name: 'Blackout Bay',
    landmark: 'the pitch-dark room with the flashlight',
    w: [8, 10], d: [10, 12],
    ports: ['back'],
    weight: 0.95,
    lights: 'dark',
    themes: { night: 2.0, fitout: 1.4 },
    module: './rooms/blackout-bay.js',
    stash: cornerStash,
    roll: (R) => ({
      cartSide: R.pick([-1, 1]),
      circuit: R.pick(['4B', '11A', '7C', 'SUB-9']),
      castOffset: R.int(0, 7),
    }),
  },
  {
    id: 'safety-corridor',
    resident: 'floor-warden', items: [], teaches: 'pace', caught: 2,
    name: 'The Safety Corridor',
    landmark: 'the safety marshall with the giant scissors',
    w: [7, 9], d: [10, 12],
    ports: ['back', 'left'],
    weight: 1.0,
    lights: 'normal',
    themes: { yellow: 1.3, fitout: 1.5, archive: 1.1 },
    module: './rooms/safety-corridor.js',
    stash: cornerStash,
    roll: (R) => ({
      lane: R.pick([-1, 0, 1]),
      days: R.int(0, 3),
    }),
  },
  {
    id: 'audit-pod',
    resident: 'efficiency-partners', items: ['pink-slip'], caught: 0,
    name: 'The Audit Pod',
    landmark: 'the consultants handing out pink slips',
    w: [8, 9], d: [8, 9],
    ports: [],
    weight: 1.0,
    lights: 'normal',
    themes: { exec: 2.0, yellow: 1.1 },
    module: './rooms/audit-pod.js',
    stash: cornerStash,
    roll: (R, o) => ({
      dept: o.projects.length ? R.pick(o.projects).slice(0, 16) : R.pick(['Operations', 'Platform', 'Back Office', 'Fulfilment']),
      reduction: R.pick([18, 24, 32, 45]),
      tableSide: R.pick([-1, 1]),
    }),
  },
];

// Where a tape goes in an entry that does not say so itself: (room, ±1) → [x0, z0, x1, z1] in the room's own frame.
export const MORE_STASH = {};
