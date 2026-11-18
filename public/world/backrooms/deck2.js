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
//   gate     (room) → where along a side wall the way on goes, in the room's own frame. The way out of the part is
//            through this room and nowhere else: it is not dealt with the others but put down last, off the deepest
//            room there is, and the lobby and the fire exit are hung off it (gen.js, throughGate). The two doorways are
//            written on the room for its builder: `room.gate = { in, on }`, link ids. One to a part, at most.

import { freightStash } from './rooms/dispatch/layout.js';
import { reorgStash } from './rooms/re-org/layout.js';
import { allHandsStash } from './rooms/all-hands/rule.js';
import { compactorStash } from './rooms/compactor-canyon/rule.js';
import { serverChasmStash } from './rooms/server-chasm/rule.js';
import { PLAN as HALL_PLAN, partsOf as hallParts } from './rooms/unsure-hall/rule.js';
import { homeStash } from './rooms/show-home/layout.js';
import { plenumStash } from './rooms/drop-plenum/rule.js';
import { cubicleGridStash } from './rooms/cubicle-grid/rule.js';
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

// The neighbourhood's words (themes.js `suburb`). Every one is the office's: nothing here is anybody's brand.
const HOME_NUMBERS = ['404', '127', '8080', '443', '3000', '1'];
const HOME_BOARDS = [
  ['FOR SALE', 'OPEN PLAN', '{PROJECT}'], ['TO LET', 'ENQUIRE WITHIN', 'ASK FOR {AGENT}'], ['SOLD', 'SUBJECT TO', 'CODE REVIEW'],
  ['SHOW HOME', 'PHASE 2 OF', '{PROJECT}'], ['UNDER OFFER', 'VIEWINGS BY', 'CALENDAR INVITE'],
];
const SHOP_ENDS = ['MART', '& SONS', 'DEPOT', 'OUTLET', 'EXPRESS', 'WORLD', 'DIRECT'];
const SHOP_OFFERS = ['SALE 0% OFF', 'OPEN SOON', 'CLOSING UP', 'BUY 1 GET 1', 'NOW HIRING', 'BACK IN 5'];
const RECESS_RULES = [['PLAY AREA', 'RECESS IS BLOCKED BY:'], ['PLAY AREA', 'NEXT BREAK AFTER:'], ['WELLBEING ZONE', 'OPENS WHEN THIS IS DONE:']];

export const MORE_DECK = [
  // The hallway that is not sure where it leads. The room you come into, a hallway, a room at the far end of it that
  // goes nowhere; and behind your back the first room becomes a dead end, and then the room with the way out in it
  // (rooms/unsure-hall/rule.js). The way out of the part is through it (`gate`), so it is where the fire exit is: put
  // down last, by the plan and never by chance, in a part below wherever the cardboard people were.
  { id: 'unsure-hall', name: 'The Hall That Is Not Sure', landmark: 'the long hallway',
    w: [7, 8], d: [16, 18], ports: [], weight: 1, lights: 'normal', planned: true, needs: ['unwatched'], doors: 'own',
    module: './rooms/unsure-hall.js',
    gate: (r) => hallParts(r).on,
    // behind the column in the room at the back: what a walk round it finds, and the walk is what turns the room
    stash: (r) => { const col = hallParts(r).column; return [-0.5, -r.D / 2 + 0.7, 0.5, col.z - HALL_PLAN.column / 2 - 0.35]; },
    // (what the dead end and the room with the way on are papered and furnished as: two different ones, never the part's own)
    roll: (R) => ({ faces: R.shuffle(HALL_FACES.slice()).slice(0, 2) }) },
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
  // Four set pieces after Gemini's Wave 4: dark, tall, one a part at most.
  {
    id: 're-org',
    name: 'The Re-Org',
    landmark: 'the beige cubicles piled into the dark ceiling over the pit',
    w: [15, 17], d: [15, 17], h: [10, 12],
    ports: ['left', 'right'],
    doors: 'own',
    halo: { back: 17, side: 8, lip: 12 },
    weight: 1.05,
    lights: 'dark',
    themes: { yellow: 2.0, fitout: 1.4, night: 1.5 },
    module: './rooms/re-org.js',
    stash: reorgStash,
    roll: (R, o) => ({
      tierCode: R.pick(['5B-CHASM', '5A-APEX', 'T5-NORTH', '5C-LEDGE']),
      dept: o.projects.length ? R.pick(o.projects).slice(0, 14) : R.pick(['Platform', 'Back Office', 'Fulfilment']),
      swayVariant: R.int(0, 5),
    }),
  },
  {
    id: 'all-hands',
    name: 'Mandatory All-Hands',
    landmark: 'the dark slope of office chairs facing the projector',
    w: [18, 22], d: [20, 24], h: [8, 9],
    ports: ['left', 'right'],
    big: true,
    weight: 1.05,
    lights: 'dark',
    themes: { exec: 2.4, yellow: 1.4, night: 1.6 },
    module: './rooms/all-hands.js',
    stash: allHandsStash,
    roll: (R, o) => ({
      project: (o.projects.length ? R.pick(o.projects) : R.pick(['Q4 Alignment', 'Core Platform', 'Synergy 2.0'])).slice(0, 18).toUpperCase(),
      blocker: (o.tasks.length ? R.pick(o.tasks) : R.pick(['Trim the build image', 'Close Q3 headcount gap', 'Deprecate legacy auth'])).slice(0, 26).toUpperCase(),
      owner: (o.agents.length ? R.pick(o.agents) : 'UNASSIGNED').slice(0, 16).toUpperCase(),
      visitor: String(o.name || 'COLLEAGUE').slice(0, 14).toUpperCase(),
    }),
  },
  {
    id: 'compactor-canyon',
    name: 'The Compactor Canyon',
    landmark: 'the towering rolling archive stacks piercing the ceiling',
    w: [15, 18], d: [17, 20], h: [8, 10],
    ports: ['back', 'left', 'right'],
    big: true,
    weight: 1.05,
    lights: 'dark',
    themes: { archive: 2.5, yellow: 1.1, night: 1.5 },
    module: './rooms/compactor-canyon.js',
    stash: compactorStash,
    roll: (R) => ({
      initialSlot: R.pick([1, 4]),
      series: R.pick(['REC-90', 'LEDGER-B', 'ARCH-07', 'SEC-14']),
    }),
  },
  {
    id: 'server-chasm',
    name: 'The Cooling Chasm',
    landmark: 'the collapsed floor over the cable shaft',
    w: [12, 14], d: [13, 15], h: [9, 11],
    ports: [],
    halo: { back: 18, side: 9, lip: 2 },
    weight: 1.0,
    lights: 'dark',
    themes: { night: 2.2, fitout: 1.8, archive: 1.1 },
    module: './rooms/server-chasm.js',
    stash: serverChasmStash,
    roll: (R, o) => {
      const a = o.agents.length ? R.pick(o.agents) : 'NODE-01';
      const rest = o.agents.filter((x) => x !== a);
      const b = rest.length ? R.pick(rest) : 'NODE-02';
      return {
        plenum: R.pick(['04-NORTH', '09-DEEP', 'SUB-12', 'CRYO-B']),
        nodeA: a.slice(0, 12).toUpperCase(),
        nodeB: b.slice(0, 12).toUpperCase(),
      };
    },
  },
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
  // The tape rooms (docs/backrooms-lab/TAPE.md). Optional, dead ends, nobody has to work them out. Cover: a desk that
  // wants somebody at it and looking at its screen, a shutter that is up while it has that, and a deck that plays you back.
  { id: 'cover', name: 'Cover', landmark: 'the desk that wants looking at', w: [10, 11], d: [8, 9], ports: [], weight: 0.9, lights: 'normal',
    teaches: 'tape', module: './rooms/cover.js',
    stash: (r) => { const s = r.params.side, x = s * (r.W / 2 - 1.0); return [Math.min(x - 0.4, x + 0.4), r.D / 2 - 1.5, Math.max(x - 0.4, x + 0.4), r.D / 2 - 0.7]; },
    roll: (R) => ({ side: R.pick([-1, 1]), deskZ: +R.range(-0.4, 0.8).toFixed(2), seconds: R.int(9, 12) }) },
  // The neighbourhood (themes.js `suburb`). Rooms made for it, and dealt nowhere else.
  // A house, front garden and all, in a room with a suspended ceiling. From the gate it is a house. The door is a door;
  // what is behind it is the back of a set, and a desk.
  { id: 'show-home', name: 'The Show Home', landmark: 'the house with its lights on', w: [16, 18], d: [14, 16], h: [5.4, 6.2],
    ports: ['back', 'left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/show-home.js', stash: homeStash,
    roll: (R, o) => ({ number: R.pick(HOME_NUMBERS), board: R.pick(HOME_BOARDS).map((t) => fill(t, o, R).toUpperCase()), name: String(o.name || 'occupier').toUpperCase(),
      door: R.pick(['#8c2a22', '#8c2a22', '#2f5a3a', '#27406b']), tree: R.pick([-1, 1]) }) },
  // Six house fronts round a dead end, a name over each door. Yours opens. The names change places when nobody is looking.
  { id: 'the-close', name: 'The Close', landmark: 'the six houses that are the same house', w: [15, 17], d: [15, 17], h: [3.3, 4.2],
    ports: ['back', 'left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/the-close.js', stash: (r) => [r.W / 2 - 1.4, r.D / 2 - 1.4, r.W / 2 - 0.7, r.D / 2 - 0.7],
    // names[0] is the visitor's; order[i] is whose name front i has to begin with
    roll: (R, o) => ({ names: [String(o.name || 'you'), ...Array.from({ length: 5 }, (_, i) => (o.agents.length ? o.agents[i % o.agents.length] : 'occupier'))].map((n) => n.toUpperCase()), order: R.shuffle([0, 1, 2, 3, 4, 5]) }) },
  // A car park of cardboard cars and one car. (Meant to be this floor's own way down: seam.js's to wire.)
  { id: 'car-park', name: 'The Car Park', landmark: 'the car park with one car in it', w: [16, 19], d: [13, 15], h: [3.3, 4.2],
    ports: ['left', 'right'], weight: 1.2, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/car-park.js', stash: (r) => [-r.W / 2 + 0.6, -r.D / 2 + 0.6, -r.W / 2 + 1.3, -r.D / 2 + 1.3],
    roll: (R, o) => ({ real: R.int(0, 99), empty: R.some([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 3), pay: ['PAY HERE', fill(R.pick(['STORY POINTS ONLY', 'NO CHANGE GIVEN OR MADE', 'BILLED TO {PROJECT}', 'ASK {AGENT} FOR A TOKEN']), o, R).toUpperCase()] }) },
  // A back garden with a tall fence, and the neighbours looking over it.
  { id: 'back-garden', name: 'The Back Garden', landmark: 'the garden everybody is looking into', w: [11, 13], d: [10, 12], h: [3.3, 4.2],
    ports: ['back', 'left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/back-garden.js', stash: (r) => [r.W / 2 - 1.2, -r.D / 2 + 0.5, r.W / 2 - 0.55, -r.D / 2 + 1.15],
    roll: (R) => ({ who: R.shuffle([0, 1, 2, 3, 4, 5, 6, 7]) }) },
  // Three shops. Inside the middle one, three shops.
  { id: 'strip-mall', name: 'The Parade', landmark: 'the shops with the shops inside', w: [15, 18], d: [10, 12], h: [3.3, 4.2],
    ports: ['left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/strip-mall.js', stash: (r) => [-2.6, -r.D / 2 + 1.75, -1.9, -r.D / 2 + 2.6],
    roll: (R, o) => ({ shops: R.shuffle(SHOP_ENDS.slice()).slice(0, 3).map((end, i) => `${String(o.projects.length ? o.projects[(i + R.int(0, 9)) % o.projects.length] : 'shop').toUpperCase()} ${end}`), offers: R.shuffle(SHOP_OFFERS.slice()).slice(0, 3) }) },
  // A bus stop, a queue, a timetable. No bus.
  { id: 'bus-stop', name: 'The Stop', landmark: 'the bus stop with the queue', w: [9, 11], d: [6, 7],
    ports: ['left', 'right'], weight: 1.3, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/bus-stop.js', stash: (r) => [-r.W / 2 + 0.5, -r.D / 2 + 0.5, -r.W / 2 + 1.15, -r.D / 2 + 1.15],
    roll: (R, o) => ({ route: 'ROUTE ' + R.pick(HOME_NUMBERS), rows: (o.tasks.length ? R.shuffle(o.tasks.slice()) : ['TODO']).slice(0, 5).map((t) => String(t).toUpperCase().slice(0, 30)), queue: R.int(3, 6), who: R.shuffle([0, 1, 2, 3, 4, 5, 6, 7]) }) },
  // A lawn of sprinklers that hear, and a path of stones across it.
  { id: 'the-green', name: 'The Green', landmark: 'the lawn you are not to walk on', w: [10, 12], d: [9, 11], h: [2.9, 3.6],
    ports: ['back', 'left', 'right'], weight: 1.2, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/the-green.js', stash: (r) => [r.W / 2 - 1.5, -r.D / 2 + 0.8, r.W / 2 - 0.8, -r.D / 2 + 1.5], roll: () => ({}) },
  // A neighbourhood to the knee, and on a table in it the same one again.
  { id: 'model-village', name: 'The Model', landmark: 'the street that comes up to your knee', w: [11, 13], d: [8, 9], h: [2.9, 3.6],
    ports: ['left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/model-village.js', stash: (r) => [-r.W / 2 + 0.5, -r.D / 2 + 0.5, -r.W / 2 + 1.15, -r.D / 2 + 1.15], roll: (R) => ({ lit: R.int(0, 8) }) },
  // A room that is all garage doors.
  { id: 'garage-row', name: 'The Lock-ups', landmark: 'the room that is all garage doors', w: [11, 13], d: [9, 11], h: [2.9, 3.3],
    ports: ['back', 'left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/garage-row.js', stash: (r) => [r.W / 2 - 1.3, r.D / 2 - 1.3, r.W / 2 - 0.65, r.D / 2 - 0.65],
    roll: (R) => ({ nums: Array.from({ length: 8 }, () => R.pick([1, 2, 3, 4, 4, 7, 11, 12, 12, 40, 404])), empty: R.some([0, 1, 2, 3, 4, 5, 6, 7], 3) }) },
  // A lemonade stand, going down, and the child who keeps it. She has a glass for you.
  { id: 'lemonade', name: 'The Stand', landmark: 'the lemonade stand that is going down', w: [9, 11], d: [8, 10], h: [2.9, 3.6],
    ports: ['left', 'right'], weight: 1.2, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/lemonade.js', stash: (r) => [-0.3, -r.D / 2 + 0.6, 0.4, -r.D / 2 + 1.2], roll: (R) => ({ side: R.pick([-1, 1]) }) },
  // A bedroom, and a closet that goes on: a maze a body wide, drawn on in marker. Whoever is down here this visit may be in it.
  { id: 'walk-in', name: 'The Walk-in', landmark: 'the bedroom with the closet you can get lost in', w: [11, 13], d: [12, 14], h: [2.4, 2.6],
    ports: ['back'], weight: 1.3, lights: 'dim', themes: { suburb: 1, '*': 0 }, haunt: 2,
    module: './rooms/walk-in.js', stash: (r) => [r.W / 2 - 1.3, r.D / 2 - 1.3, r.W / 2 - 0.6, r.D / 2 - 0.6], roll: () => ({}) },
  // A lawn with a strip down the middle of it that was never drawn: jagged, no bottom, narrow in two places. Loose hoardings to bridge it,
  // and something on telephone poles that will come over a bridge after whoever laid it. (Its id is from when it was a storm drain.)
  // (h: it stands 3.3 m at the knee)
  { id: 'the-culvert', name: 'The Gap', landmark: 'the part of the lawn that was never drawn', w: [14, 16], d: [13, 15], h: [4.2, 4.8],
    ports: ['left', 'right'], weight: 1.2, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/the-culvert.js', stash: (r, side) => [side * (r.W / 2 - 1.3) - 0.35, -r.D / 2 + 0.5, side * (r.W / 2 - 1.3) + 0.35, -r.D / 2 + 1.1],
    roll: (R) => ({ side: R.pick([-1, 1]) }) },
  // The shopping centre (themes.js `mall`: still being built, `dealt: false`). Rooms made for it, and dealt nowhere else.
  // A warehouse bay with a shopping centre stood up in it: a gallery of shops a storey up, a flight to it, another going down into nothing, and only neon to see by.
  { id: 'the-atrium', name: 'The Atrium', landmark: 'the two floors of shops, and the way down to more', w: [16, 18], d: [14, 16], h: [7.6, 8.6],
    ports: ['left', 'right'], weight: 1.4, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/the-atrium.js', stash: (r) => [-r.W / 2 + 0.4, r.D / 2 - 1.1, -r.W / 2 + 1.0, r.D / 2 - 0.5], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A hall given over to moving stairs, which go everywhere; two of them can be ridden, and one of those only takes whoever stands still.
  { id: 'moving-stairs', name: 'Moving Stairs', landmark: 'the hall of moving stairs', w: [16, 18], d: [16, 18], h: [8.6, 9],
    ports: ['left', 'right'], weight: 1.3, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/moving-stairs.js', stash: (r) => [r.W / 2 - 1.0, r.D / 2 - 1.1, r.W / 2 - 0.4, r.D / 2 - 0.5], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A shop: a hall of photo booths, both sides and two rows up the back; walk past one and it takes your picture. The strips are pinned up everywhere.
  { id: 'photo-booths', name: 'Photo of You', landmark: 'the row of photo booths', w: [9, 11], d: [5, 6], h: [4.3, 4.6],
    ports: ['left', 'right'], weight: 1.2, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/photo-booths.js', stash: (r) => [-r.W / 2 + 0.3, -0.3, -r.W / 2 + 0.9, 0.3], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A shop that sells bags, each with a receipt in it for the bag; the tills print on, and one of them follows you round the floor.
  { id: 'receipts', name: 'The Receipt Shop', landmark: 'the shop that sells bags', w: [8, 10], d: [8, 9], h: [3.1, 3.5],
    ports: ['left', 'right'], weight: 1.2, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/receipts.js', stash: (r) => [r.W / 2 - 0.9, r.D / 2 - 0.9, r.W / 2 - 0.3, r.D / 2 - 0.3], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A shop: the key cutter's, whose every wall is doors of every size to the roof, none of which opens; the blanks hang on strings over your head.
  { id: 'keys-cut', name: 'Keys Cut', landmark: "the key cutter's, all doors", w: [6, 7], d: [6, 7], h: [3.3, 3.8],
    ports: ['left', 'right'], weight: 1.1, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/keys-cut.js', stash: (r) => [r.W / 2 - 0.9, r.D / 2 - 0.9, r.W / 2 - 0.3, r.D / 2 - 0.3], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A shop: the department store, all office clothes; the dummies are having a meeting; fitting rooms along the back, and in the glass of the last one, somebody where you stand.
  { id: 'mens-ladies', name: 'Mens Ladies', landmark: 'the department store', w: [12, 14], d: [11, 13], h: [3.4, 3.9],
    ports: ['left', 'right'], weight: 1.2, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/mens-ladies.js', stash: (r) => [-r.W / 2 + 0.3, r.D / 2 - 0.9, -r.W / 2 + 0.9, r.D / 2 - 0.3], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A grotto, in July: a cottage of plywood with snow on it, a queue folded five times to its door, a sack in the big chair, a camera that goes off, a present.
  { id: 'the-grotto', name: 'The Grotto', landmark: 'the grotto, in July', w: [10, 12], d: [9, 11], h: [3.3, 3.7],
    ports: ['left', 'right'], weight: 1.1, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/the-grotto.js', stash: (r) => [-r.W / 2 + 0.3, r.D / 2 - 0.9, -r.W / 2 + 0.9, r.D / 2 - 0.3], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A shop: the place that sells the orange drink. Orange and white, a great many oranges, and somebody serving who has one for a head.
  { id: 'the-orange', name: 'The Orange', landmark: 'the place that sells the orange drink', w: [7, 8], d: [7, 8], h: [2.9, 3.3],
    ports: ['left', 'right'], weight: 1.3, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/the-orange.js', stash: (r) => [-r.W / 2 + 0.35, r.D / 2 - 1.9, -r.W / 2 + 0.95, r.D / 2 - 1.3], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A shop of televisions: every set on demonstration, on as you pass and off behind you, all on the same channel; the big one has a camera on it, and shows the shop a little late, and somebody stood where you were.
  { id: 'the-sets', name: 'The Sets', landmark: 'the shop of televisions', w: [9, 11], d: [8, 10], h: [3.2, 3.6],
    ports: ['left', 'right'], weight: 1.2, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/the-sets.js', stash: (r) => [-r.W / 2 + 0.3, -0.3, -r.W / 2 + 0.9, 0.3], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A hall with little shops round the edge, each selling the one thing it was told about at the size it was told; tables bolted down, and another over each on the roof; the middle of the floor left out.
  { id: 'food-court', name: 'The Food Court', landmark: 'the tables round the hole', w: [16, 18], d: [15, 17], h: [7, 7.8],
    ports: ['left', 'right'], weight: 1.2, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/food-court.js', stash: (r) => [r.W / 2 - 1.0, -2.6, r.W / 2 - 0.4, -2.0], roll: (R) => ({ seed: R.int(1, 9999) }) },
  // A car park, tall, in the yellow of one: the one car a great many times (stacked to the roof, in a drift, up the wall, on the roof), and a way out that is a ramp down into nothing.
  { id: 'level-p', name: 'Level P', landmark: 'the car park of the one car', w: [16, 18], d: [16, 18], h: [7.2, 8],
    ports: ['left', 'right'], weight: 1.2, lights: 'dim', themes: { mall: 1, '*': 0 },
    module: './rooms/level-p.js', stash: (r) => [-r.W / 2 + 0.4, r.D / 2 - 1.1, -r.W / 2 + 1.0, r.D / 2 - 0.5], roll: (R) => ({ seed: R.int(1, 9999), bay: R.pick(['14', 'P14', '14B', '41']) }) },
  // A playground on fake grass. Most of it is going down into the floor, slowly, and has been for some time.
  { id: 'recess', name: 'Recess', landmark: 'the playground that is going under', w: [12, 14], d: [10, 12], h: [3.3, 4.2],
    ports: ['back', 'left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/recess.js', stash: (r) => [r.W / 2 - 1.55, -r.D / 2 + 0.45, r.W / 2 - 0.9, -r.D / 2 + 1.05],
    roll: (R, o) => ({ rules: [...R.pick(RECESS_RULES), String(o.tasks.length ? R.pick(o.tasks) : 'TODO').toUpperCase()], lean: R.pick([-1, 1]), hops: [1, 2, 3, 4, 4, 6, 7, 9], high: R.int(0, 1) }) },
  {
    id: 'drop-plenum',
    resident: 'plenum-toner', items: ['torch'], caught: 1, fire: 'fears',
    name: 'The Return Plenum',
    landmark: 'the step-ladder up into the red drop ceiling',
    w: [14, 16], d: [16, 18], h: [4.8, 5.1],
    ports: ['back', 'left', 'right'],
    big: true,
    weight: 1.0,
    lights: 'dark',
    themes: { yellow: 1.5, night: 1.4, archive: 1.2, fitout: 1.1, exec: 1.1 },
    module: './rooms/drop-plenum.js',
    stash: plenumStash,
    roll: (R, o) => ({
      zone: R.pick(['4B-RET', '7A-NORTH', 'SUB-3', 'PLM-9']),
      supervisor: (o.agents.length ? R.pick(o.agents) : 'FACILITIES').slice(0, 14).toUpperCase(),
      ductTone: R.pick([0, 1]),
    }),
  },
  // (the owner's: one to be met often. It used to take the blackout bay for granted — `needs: ['beam']` — which had to be dealt to an
  // earlier part, and so it was in one visit in a hundred; that is gone, and its weight is the most a room may have, three: about half of all visits. A part takes one big room, so the other big ones are a little rarer for it)
  { id: 'last-light', name: 'The Last Light', landmark: 'the long hall losing its lights',
    module: './rooms/last-light.js', resident: 'lamplighter', items: ['torch'], caught: 1, fire: 'ignores',
    w: [6, 7], d: [20, 22], h: [2.8, 3.0], ports: ['back'], big: true,
    weight: 3, lights: 'normal', themes: { night: 1.5, archive: 1.2 },
    stash: r => [r.W/2-1.4, -r.D*.17-.65, r.W/2-.5, -r.D*.17+.65],
    roll: R => ({face:R.int(0,7)}) },
  {
    id: 'cubicle-grid',
    resident: 'pit-clerks', items: ['paper'], caught: 2, fire: 'fears',
    doors: 'own',
    name: 'The Open-Plan Pit',
    landmark: 'the sunken cubicle grid you walk across on top',
    w: [14, 16], d: [16, 18], h: [3.2, 3.6],
    ports: ['back'],
    big: true,
    weight: 1.0,
    lights: 'normal',
    themes: { yellow: 1.5, archive: 1.4, night: 1.3, fitout: 1.3, exec: 1.2 },
    module: './rooms/cubicle-grid.js',
    stash: cubicleGridStash,
    roll: (R, o) => ({
      dept: (o.projects.length ? R.pick(o.projects) : R.pick(['RETENTION', 'BILLING', 'COMPLIANCE', 'QA'])).slice(0, 12).toUpperCase(),
      brokenSide: R.pick([-1, 1]),
    }),
  },
  // The channel hall and quiet threshold connector extend the review wing.
  { id: 'channel-hall', name: 'The Lane Archive', landmark: 'stacked shuttered offices over a sunken swimming lane',
    module: './rooms/channel-hall.js', w: [18,18], d: [26,28], h: [10.6,11], ports: ['back'],
    resident: 'lane-keeper', caught: 1, fire: 'ignores', items: [],
    big: true, weight: .85, lights: 'normal', themes: { waterpark: .85, '*': 0 },
    stash: () => [-.45,-3.2,.45,-2.4], roll: () => ({}) },
  { id: 'nested-thresholds', name: 'The Narrowing Bays', landmark: 'changing-room frames that grow smaller along a wet corridor',
    module: './rooms/nested-thresholds.js', w: [10,10], d: [18,20], h: [3.4,3.6], ports: ['back'],
    weight: 1.5, lights: 'normal', themes: { waterpark: 1.5, '*': 0 },
    stash: r => [3.3,-r.D/2+1.2,4,-r.D/2+1.9], roll: () => ({}) },
  { id: 'flume-connector', name: 'Return Tubes', landmark: 'the plastic crawlway that forks in the dark',
    module: './rooms/flume-connector.js', w: [10,10], d: [12,12], h: [2.65,2.65], ports: [],
    adjoins: [{ id: 'flooded-cubicles', side: 'left' }, { id: 'office-beach-day', side: 'right' }],
    rejoin: true, door: 1.5, weight: 1.15, lights: 'dim', themes: { waterpark: 1.15, '*': 0 },
    stash: () => [.39,4.25,.56,4.39], roll: () => ({}) },
  { id: 'flooded-cubicles', name: 'The Flooded Office', landmark: 'a flume opening behind the desks in standing water',
    module: './rooms/flooded-cubicles.js', w: [12,12], d: [8,8], h: [2.75,2.75], ports: [],
    planned: true, weight: 1, lights: 'dim', themes: { waterpark: 1, '*': 0 },
    stash: () => [1.7,-2.6,2.4,-2], roll: () => ({}) },
  { id: 'office-beach-day', name: 'Office Beach Day', landmark: 'the office clock painted into an indoor sunset',
    module: './rooms/office-beach-day.js', w: [12,12], d: [10,10], h: [2.65,2.65], ports: [],
    planned: true, weight: 1, lights: 'dim', themes: { waterpark: 1, '*': 0 },
    stash: () => [-3.95,-2.75,-3.35,-2.25], roll: () => ({}) },
  { id: 'smiler-maze', name: 'The Towel Return', landmark: 'the long tiled way to the diving tower',
    module: './rooms/smiler-maze.js', w: [12,12], d: [16,16], h: [2.65,2.65], ports: [],
    adjoins: 'dive-tower', big: true, weight: 1.25, lights: 'dim', themes: { waterpark: 1.25, '*': 0 },
    stash: r => [-1.4,r.D/2-1.6,-.9,r.D/2-1], roll: () => ({}) },
  { id: 'dive-tower', name: 'The Diving Tower', landmark: 'the diving boards over a deep blue pool',
    module: './rooms/dive-tower.js', w: [18,18], d: [26,26], h: [3.4,3.4], ports: ['back'],
    big: true, planned: true, weight: 1, lights: 'normal', themes: { waterpark: 1, '*': 0 },
    stash: r => [-2.1,r.D/2-1.7,-1.3,r.D/2-.9], roll: () => ({}) },
  // Kept out of ordinary visits until the waterpark team's integration pass.
  { id: 'hanging-changing', name: 'Hanging Changing Rooms', landmark: 'changing partitions suspended above narrow channels',
    module: './rooms/hanging-changing.js', w: [20,20], d: [26,26], h: [6.2,6.6], ports: ['back'],
    big: true, weight: 1, lights: 'normal', themes: { waterpark: 1, '*': 0 },
    stash: r => [-2, r.D/2-2.5, -1, r.D/2-1.5], roll: () => ({}) },
  { id: 'bellmouth-baths', name: 'Bellmouth Baths', landmark: 'the enormous ceramic drain with a gallery around its rim',
    module: './rooms/bellmouth-baths.js', w: [26,28], d: [28,28], h: [9,10], ports: ['back'],
    big: true, weight: 1, lights: 'normal', themes: { waterpark: 1, '*': 0 },
    stash: r => [-.8, r.D/2-2, .8, r.D/2-1.2], roll: () => ({}) },
  { id: 'return-pool', name: 'The Return Pool', landmark: 'the pool hanging above another pool',
    module: './rooms/return-pool.js', w: [14,15], d: [23,25], h: [5.8,6.2], ports: ['back'],
    big: true, weight: 1, lights: 'dim', themes: { waterpark: 1, '*': 0 },
    stash: r => [-r.W/2+.5, -r.D/2+.5, -r.W/2+1.2, -r.D/2+1.2], roll: () => ({}) },
  // Waterpark review wing: isolated from the live deck until reviewed.
  {
    id: 'slide-maze',
    name: 'The Flume Knot',
    landmark: 'the tangled translucent water slides disappearing into the ceiling',
    w: [16, 18], d: [16, 18], h: [5.4, 6.0],
    ports: ['back', 'left', 'right'],
    big: true,
    weight: 1.15,
    lights: 'normal',
    themes: { waterpark: 1.2, '*': 0 },
    module: './rooms/slide-maze.js',
    stash: (r) => [r.W / 2 - 1.5, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.5],
    roll: (R) => ({
      goodSide: R.pick([-1, 1]),
      flumeSet: R.int(0, 2),
    }),
  },
  {
    id: 'wave-pool',
    name: 'The Surge Basin',
    landmark: 'the sloping tiled beach facing the dark wave grates',
    w: [16, 18], d: [18, 20], h: [4.4, 5.0],
    ports: ['left', 'right'],
    big: true,
    weight: 1.15,
    lights: 'normal',
    themes: { waterpark: 1.2, '*': 0 },
    module: './rooms/wave-pool.js',
    stash: (r) => [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.45, -r.D / 2 + 1.45],
    roll: (R, o) => ({
      dept: (o.projects.length ? R.pick(o.projects) : R.pick(['HYDRATION', 'Q3 TIDE', 'RETENTION'])).slice(0, 14).toUpperCase(),
      bollardShift: R.pick([-0.8, 0, 0.8]),
    }),
  },
  {
    id: 'lazy-river',
    name: 'The Lazy Loop',
    landmark: 'the circular canal of yellow inner tubes around the lifeguard chair',
    w: [15, 17], d: [15, 17], h: [3.4, 4.0],
    ports: ['back', 'left', 'right'],
    weight: 1.15,
    lights: 'normal',
    themes: { waterpark: 1.2, '*': 0 },
    module: './rooms/lazy-river.js',
    stash: (r) => [-0.45, -0.45, 0.45, 0.45],
    roll: (R) => ({
      dir: R.pick([-1, 1]),
      guardYaw: +R.range(-0.4, 0.4).toFixed(2) || 0,
    }),
  },
  {
    id: 'deep-end',
    name: 'The Diving Well',
    landmark: 'the deep green pool with the office wall stopping under the water',
    w: [12, 14], d: [14, 16], h: [3.8, 4.4],
    ports: ['back'],
    weight: 1.1,
    lights: 'normal',
    themes: { waterpark: 1.1, '*': 0 },
    module: './rooms/deep-end.js',
    stash: (r) => [-r.W / 2 + 0.6, -r.D / 2 + 0.6, -r.W / 2 + 1.35, -r.D / 2 + 1.35],
    roll: (R) => ({
      boardSide: R.pick([-1, 1]),
      code: R.pick(['404 FT', '12.0 M', 'DEEP Q4', 'NO FLOOR']),
    }),
  },
  {
    id: 'whirlpool-flume',
    name: 'The Drain Spa',
    landmark: 'the sunken whirlpool spiralling into the illuminated floor drain',
    w: [12, 14], d: [12, 14], h: [3.4, 4.0],
    ports: ['left', 'right'],
    weight: 1.2,
    lights: 'normal',
    themes: { waterpark: 1.2, '*': 0 },
    module: './rooms/whirlpool-flume.js',
    stash: (r) => [r.W / 2 - 1.4, r.D / 2 - 1.4, r.W / 2 - 0.65, r.D / 2 - 0.65],
    roll: (R) => ({
      spin: R.pick([-1, 1]),
      temp: R.pick(['104 F', '39.8 C', 'LUKEWARM', 'BOILING']),
    }),
  },
  {
    id: 'kiddie-lagoon',
    name: 'The Toadstool Lagoon',
    landmark: 'the red spotted mushroom fountain and the upside-down legs in floats',
    w: [12, 14], d: [12, 14], h: [3.2, 3.8],
    ports: ['back', 'left', 'right'],
    weight: 1.05,
    lights: 'normal',
    themes: { waterpark: 1.0, '*': 0 },
    module: './rooms/kiddie-lagoon.js',
    stash: (r) => [-r.W / 2 + 0.65, r.D / 2 - 1.45, -r.W / 2 + 1.4, r.D / 2 - 0.65],
    roll: (R) => ({
      seed: R.int(1, 9999),
    }),
  },
  {
    id: 'locker-showers',
    name: 'The Other Changing Room',
    landmark: 'the pink changing bays with a corridor inside a locker',
    w: [18, 18], d: [26, 28], h: [6.6, 7.2],
    ports: ['back', 'left'],
    big: true,
    weight: 1.05,
    lights: 'normal',
    themes: { waterpark: 1.0, '*': 0 },
    module: './rooms/locker-showers.js',
    stash: (r) => [r.W / 2 - 1.4, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.4],
    roll: (R) => ({
      lockerSide: R.pick([-1, 1]),
      bayCode: R.pick(['LOCKER B', 'WET CHANGE', 'TOWEL DEPT']),
    }),
  },

  // The Offsite Reserve (themes.js `forest`: still being built, `dealt: false`). Rooms made for it, and dealt nowhere else.
  {
    id: 'trailhead',
    name: 'The Visitor Kiosk',
    landmark: 'the timber ranger booth under the ceiling tubes',
    w: [14, 17], d: [14, 17], h: [3.6, 4.4],
    ports: ['back', 'left', 'right'],
    weight: 1.2,
    lights: 'normal',
    themes: { forest: 1.25, '*': 0 },
    module: './rooms/trailhead.js',
    stash: (r) => [r.W / 2 - 1.45, r.D / 2 - 1.45, r.W / 2 - 0.65, r.D / 2 - 0.65],
    roll: (R, o) => ({
      parkName: R.pick(['SYNERGY PINES', 'Q4 TIMBER RESERVE', 'OFFSITE WOODS']),
      permit: (o.projects.length ? R.pick(o.projects) : R.pick(['TOUCH-GRASS', 'Q4-RETREAT', 'ALIGNMENT'])).slice(0, 12).toUpperCase(),
    }),
  },
  {
    id: 'timber-lot',
    name: 'The Coat-Rack Stand',
    landmark: 'the sunken peat channel and the stag among the coat-racks',
    w: [19, 22], d: [18, 21], h: [4.5, 5.2],
    ports: ['back', 'left', 'right'],
    big: true,
    weight: 1.2,
    lights: 'normal',
    themes: { forest: 1.25, '*': 0 },
    module: './rooms/timber-lot.js',
    stash: (r) => [r.W / 2 - 1.5, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.5],
    roll: (R) => ({
      buckSide: R.pick([-1, 1]),
    }),
  },
  {
    id: 'canopy-walk',
    name: 'The Rope Walk',
    landmark: 'the elevated rope bridges under the fluorescent ceiling',
    w: [18, 22], d: [18, 22], h: [5.6, 6.4],
    ports: ['back', 'left', 'right'],
    big: true,
    weight: 1.15,
    lights: 'normal',
    themes: { forest: 1.2, '*': 0 },
    module: './rooms/canopy-walk.js',
    stash: () => [2.2, -0.9, 3.2, 0.9],
    roll: (R) => ({
      seed: R.int(1, 9999),
    }),
  },
  {
    id: 'blaze-junction',
    name: 'The Trail Loop',
    landmark: 'the ring of wooden trail arrows that turn when you look away',
    w: [16, 18], d: [16, 18], h: [3.8, 4.5],
    ports: ['back', 'left', 'right'],
    weight: 1.15,
    lights: 'normal',
    themes: { forest: 1.2, '*': 0 },
    module: './rooms/blaze-junction.js',
    stash: (r) => [-r.W / 2 + 0.65, r.D / 2 - 1.45, -r.W / 2 + 1.45, r.D / 2 - 0.65],
    roll: (R) => ({
      trueIdx: R.int(0, 4),
      targetRings: R.int(3, 6),
    }),
  },
  {
    id: 'campfire-circle',
    name: 'Mandatory Offsite',
    landmark: 'the split-log benches and tents around the cellophane campfire',
    w: [16, 19], d: [16, 19], h: [3.8, 4.5],
    ports: ['back', 'left', 'right'],
    weight: 1.15,
    lights: 'normal',
    themes: { forest: 1.15, '*': 0 },
    module: './rooms/campfire-circle.js',
    stash: (r) => [r.W / 2 - 1.45, r.D / 2 - 1.45, r.W / 2 - 0.65, r.D / 2 - 0.65],
    roll: (R) => ({
      seed: R.int(1, 9999),
    }),
  },
  {
    id: 'bog-boardwalk',
    name: 'The Fen',
    landmark: 'the duckboard planks over the cypress swamp and drowned workstations',
    w: [17, 20], d: [17, 20], h: [3.8, 4.6],
    ports: ['back', 'left', 'right'],
    weight: 1.15,
    lights: 'normal',
    themes: { forest: 1.15, '*': 0 },
    module: './rooms/bog-boardwalk.js',
    stash: () => [-0.55, -0.55, 0.55, 0.55],
    roll: (R) => ({
      seed: R.int(1, 9999),
    }),
  },
  {
    id: 'fire-lookout',
    name: 'The Fire Tower',
    landmark: 'the wooden fire-lookout tower crushed into the ceiling tiles',
    w: [15, 18], d: [15, 18], h: [5.6, 6.4],
    ports: ['back', 'left', 'right'],
    weight: 1.1,
    lights: 'normal',
    themes: { forest: 1.15, '*': 0 },
    module: './rooms/fire-lookout.js',
    stash: () => [-0.85, -1.25, 0.85, 0.45],
    roll: (R) => ({
      sector: R.int(0, 3),
      towerCode: R.pick(['T-04', 'LOOKOUT B', 'FIRE-9', 'PINES-1']),
    }),
  },
  {
    id: 'hollow-tree',
    name: 'The Windfall Shaft',
    landmark: 'the colossal hollow tree trunk bursting through the office floor',
    w: [16, 19], d: [16, 19], h: [4.8, 5.8],
    ports: ['back', 'left', 'right'],
    weight: 1.15,
    lights: 'normal',
    themes: { forest: 1.2, '*': 0 },
    module: './rooms/hollow-tree.js',
    stash: (r) => [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.45, -r.D / 2 + 1.45],
    roll: (R) => ({
      seed: R.int(1, 9999),
    }),
  },
  {
    // the wood after the controlled burn the offsite scheduled for itself: charred snags, ash, a smoke layer you keep
    // your head under, and the drill's Fire Marshal still walking it
    id: 'burn-scar',
    name: 'The Burn',
    landmark: 'the charred trees standing in the smoke, and the fire drill that never ended',
    w: [16, 19], d: [16, 19], h: [3.8, 4.4],
    ports: ['back', 'left', 'right'],
    weight: 1.15,
    lights: 'dim',
    themes: { forest: 1.2, '*': 0 },
    module: './rooms/burn-scar.js',
    stash: (r) => [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.45, -r.D / 2 + 1.45],
    roll: (R) => ({
      seed: R.int(1, 9999),
      side: R.pick([-1, 1]),
    }),
  },
  {
    // what is being built where the wood was: a bulldozer clearing a lane a stretch further each pass, the developers
    // pointing at what is left, and what used to live in it, waiting at the edge with its things
    id: 'clear-cut',
    name: 'The Development',
    landmark: 'the bulldozer at the edge of the trees, and the animals watching it',
    w: [22, 26], d: [20, 24], h: [5.0, 6.0],
    ports: ['left', 'right'],
    big: true,
    weight: 1.2,
    lights: 'normal',
    themes: { forest: 1.3, '*': 0 },
    module: './rooms/clear-cut.js',
    stash: (r) => [r.W / 2 - 1.45, r.D / 2 - 1.45, r.W / 2 - 0.65, r.D / 2 - 0.65],
    roll: (R) => ({
      seed: R.int(1, 9999),
      brand: R.pick(['SYNERGY PINES', 'TIMBERLINE COMMONS', 'OLD GROWTH PLAZA', 'CANOPY CORPORATE PARK']),
    }),
  },
  {
    // wall-to-wall old-growth hemlock & birch cathedral (65+ trunks) with bioluminescent server fiber veins,
    // hanging ID-lanyard wind chimes, and the bark-mimic Timber Auditor that freezes in sight or flashlight beam
    id: 'old-growth',
    name: 'The Cathedral Stand',
    landmark: 'the dark overgrown hemlock labyrinth and the bark-mimic auditor',
    w: [20, 23], d: [20, 23], h: [5.6, 6.4],
    ports: ['back', 'left', 'right'],
    big: true,
    weight: 1.25,
    lights: 'dim',
    themes: { forest: 1.3, '*': 0 },
    module: './rooms/old-growth.js',
    stash: (r) => [r.W / 2 - 1.45, r.D / 2 - 1.45, r.W / 2 - 0.65, r.D / 2 - 0.65],
    roll: (R) => ({
      standCode: R.pick(['OG-09', 'CATHEDRAL-4', 'DEEP-STAND', 'HEMLOCK-B']),
    }),
  },
  {
    // corporate Sitka spruce pulp matrix: dense hedgerow aisles of barcoded spruces on ceiling-fed IV sap drip bags
    id: 'tree-farm',
    name: 'The Barcode Plantation',
    landmark: 'the claustrophobic aisles of barcoded spruce trees on IV sap bags',
    w: [16, 19], d: [16, 19], h: [4.0, 4.8],
    ports: ['back', 'left', 'right'],
    weight: 1.2,
    lights: 'dim',
    themes: { forest: 1.25, '*': 0 },
    module: './rooms/tree-farm.js',
    stash: (r) => [r.W / 2 - 1.45, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.45],
    roll: (R) => ({
      lotCode: R.pick(['Q4-48', 'PULP-12', 'ROW-MATRIX', 'XMAS-09']),
    }),
  },
  {
    // indoor gale blowdown: root-wall canyons of upturned carpet/screed root-plates, flooded root craters,
    // and leaning jackstraw windfalls you duck beneath
    id: 'windthrow',
    name: 'The Blowdown Tangle',
    landmark: 'the upturned carpet root-plates and leaning windfall tunnels',
    w: [16, 19], d: [16, 19], h: [4.2, 5.0],
    ports: ['back', 'left', 'right'],
    weight: 1.2,
    lights: 'dim',
    themes: { forest: 1.25, '*': 0 },
    module: './rooms/windthrow.js',
    stash: (r) => [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.45, -r.D / 2 + 1.45],
    roll: (R) => ({
      galeCode: R.pick(['W-12', 'GALE-4', 'ROOT-PIT', 'BLOWDOWN-B']),
    }),
  },
  {
    // archive-forest canyon: rusted lateral filing stacks choked with white paper-birch trunks and wet
    // amber eyes watching from horizontal bark lenticels around tight blind corners
    id: 'nursery-aisles',
    name: 'The Sapling Archive',
    landmark: 'the rusted filing stacks choked with white birch stems and eyes in their bark',
    w: [15, 18], d: [15, 18], h: [3.8, 4.4],
    ports: ['back', 'left', 'right'],
    weight: 1.2,
    lights: 'dim',
    themes: { forest: 1.25, '*': 0 },
    module: './rooms/nursery-aisles.js',
    stash: (r) => [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.45, -r.D / 2 + 1.45],
    roll: (R) => ({
      fileCode: R.pick(['REC-58', 'BIRCH-A', 'FILING-07', 'LENTICEL-3']),
    }),
  },
  {
    // two interlocking woods in opposite directions: upward trunks, eye-level upside-down ceiling crowns,
    // and hedgerow baffles hiding a central mirror pool beneath a ceiling-bolted workstation
    id: 'inverted-grove',
    name: 'The Ceiling Coppice',
    landmark: 'the interlocking floor and upside-down ceiling trees hiding the mirror pool',
    w: [16, 19], d: [16, 19], h: [4.6, 5.2],
    ports: ['back', 'left', 'right'],
    weight: 1.2,
    lights: 'dim',
    themes: { forest: 1.25, '*': 0 },
    module: './rooms/inverted-grove.js',
    stash: (r) => [r.W / 2 - 1.45, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.45],
    roll: (R) => ({
      groveCode: R.pick(['INV-04', 'MIRROR-9', 'SKYROOT-B', 'COPPICE-2']),
    }),
  },
  {
    // the overnight part of the offsite: a dark room of lit tents on office carpet, and the one beside you goes out
    id: 'lights-out',
    name: 'Lights Out',
    landmark: 'the dark room of lit tents, where the one beside you goes out',
    w: [13, 15], d: [13, 15], h: [3.4, 3.8],
    ports: ['back', 'left', 'right'],
    weight: 1.1,
    lights: 'dark',
    themes: { forest: 1.1, '*': 0 },
    module: './rooms/lights-out.js',
    stash: (r) => [r.W / 2 - 1.3, r.D / 2 - 1.3, r.W / 2 - 0.6, r.D / 2 - 0.6],
    roll: (R) => ({ seed: R.int(1, 9999) }),
  },
];

// Where a tape goes in an entry that does not say so itself: (room, ±1) → [x0, z0, x1, z1] in the room's own frame.
export const MORE_STASH = {};
