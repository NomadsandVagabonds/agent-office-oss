// The Backrooms — the deck, continued. Pure. The same contract as the DECK in
// gen.js (which deals these along with its own): an id, a landmark, a size, the
// walls that may take one more doorway, how the ceiling behaves, and `roll`,
// which decides everything the builder (rooms5.js onward) needs to know.
//
// Three things an entry here may ask for that the first deck never did:
//   halo     { back, side, lip }  metres of floor plan kept empty behind and beside the room, from `lip` metres in.
//            The room you walk in is a balcony; what you look out over is drawn inside the halo, so no other room
//            can ever be standing in the view.
//   themes   { theme id: weight multiplier }  the kinds of floor it is more (or less) at home on
//   planned  true: never dealt by chance — only on the floor the visit's plan puts it on (plan.js `must`)
import { fill } from './words.js';

const about = (x, z, hx, hz = hx) => [x - hx, z - hz, x + hx, z + hz];

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

export const MORE_DECK = [
  { id: 'vestibule', name: 'The Vestibule', landmark: 'the revolving doors', w: [9, 10], d: [9, 10], h: [3.0, 3.3],
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
  { id: 'copiers', name: 'Copy Room', landmark: 'the photocopiers', w: [7, 9], d: [10, 12],
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
  { id: 'quiet-zone', name: 'Deep Work Zone', landmark: 'the soundproof room', w: [7, 9], d: [7, 9],
    ports: ['left', 'right'], weight: 1.5, lights: 'dim', themes: { exec: 1.5, fitout: 1.4 },
    roll: (R, o) => ({
      header: fill(R.pick(QUIET_HEADERS), o, R).toUpperCase(),
      deskCard: fill(R.pick(QUIET_CARDS), o, R),
      chair: R.pick(['#3f7f9a', '#4a7a6a', '#5a5a66', '#8a5a8f']),
      foam: R.pick(['#23262c', '#262329', '#1f2628']),
      limit: R.pick([38, 40, 42]),
    }) },
  { id: 'mailroom', name: 'Mailroom', landmark: 'the brass tubes', w: [7, 9], d: [7, 9],
    ports: ['back', 'left', 'right'], weight: 1.5, lights: 'normal', themes: { archive: 1.6, fitout: 1.3, exec: 1.2 },
    roll: (R, o) => ({
      sign: R.pick(MAIL_SIGNS).map((t) => fill(t, o, R)),
      slots: MAIL_SLOTS.map((t) => fill(t, o, R).toUpperCase().slice(0, 14)),
      brass: R.pick(['#c49a45', '#b8893c', '#c9a654']),
      canisters: R.int(3, 6),
      stamp: fill('ROUTED FOR {NAME}', o, R).toUpperCase(),
    }) },
];

// Where a coin goes in each of them (see STASH in gen.js): (room, ±1) → [x0, z0, x1, z1] in the room's own frame.
export const MORE_STASH = {
  vestibule: (r, s) => about(s * (r.W / 2 - 1.15), -r.D / 2 + 1.15, 0.2),                 // a far corner behind the drums, clear of the floor well
  copiers: (r) => [-0.4, -r.D / 2 + 1.9, 0.4, -r.D / 2 + 2.7],                            // down the middle aisle, past the green glare
  'quiet-zone': (r, s) => about(s * (r.W / 2 - 1.05), -r.D / 2 + 1.05, 0.18),             // in an acoustic corner: walk softly to fetch it
  mailroom: (r, s) => about(s * (r.W / 2 - 1.05), -r.D / 2 + 1.05, 0.18),                 // behind the central manifold, under the overhead trunks
};
