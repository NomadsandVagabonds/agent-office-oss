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
  // The neighbourhood (themes.js `suburb`: still being built, `dealt: false`). Rooms made for it, and dealt nowhere else.
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
  // A playground on fake grass. Most of it is going down into the floor, slowly, and has been for some time.
  { id: 'recess', name: 'Recess', landmark: 'the playground that is going under', w: [12, 14], d: [10, 12], h: [3.3, 4.2],
    ports: ['back', 'left', 'right'], weight: 1, lights: 'normal', themes: { suburb: 1, '*': 0 },
    module: './rooms/recess.js', stash: (r) => [r.W / 2 - 1.55, -r.D / 2 + 0.45, r.W / 2 - 0.9, -r.D / 2 + 1.05],
    roll: (R, o) => ({ rules: [...R.pick(RECESS_RULES), String(o.tasks.length ? R.pick(o.tasks) : 'TODO').toUpperCase()], lean: R.pick([-1, 1]), hops: [1, 2, 3, 4, 4, 6, 7, 9], high: R.int(0, 1) }) },
];

// Where a tape goes in an entry that does not say so itself: (room, ±1) → [x0, z0, x1, z1] in the room's own frame.
export const MORE_STASH = {};
