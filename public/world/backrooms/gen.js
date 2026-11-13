// The Backrooms — the generator. Pure: no three.js, no DOM, nothing but a seed
// and a few names in, a plain description of one visit out. The same seed
// always builds the same level; a different seed builds a different one.
//
// A visit is a small maze of rectangular rooms on a one-metre grid. Six to
// nine of them are oddities dealt from the DECK below without repeats; the
// rest is the connective tissue — plain humming rooms and corridors — plus the
// room you land in and, somewhere else every time, the door that is different.
//
// Every room has a local frame: x across, z deep, centred on the room, and the
// doorway you are meant to arrive through is in the +z wall (the "front").
// `rot` quarter-turns that frame into the world, so the builders (rooms.js)
// never need to know which way a room ended up facing.

export const T = 0.2;                  // wall thickness, metres
export const WALL_H = 2.6;             // the usual ceiling
export const DOOR_H = 2.05;            // top of every doorway
export const TILE = 0.6;               // ceiling tile

/* ---- a small seeded random source ------------------------------------------- */

const fnv = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

export function makeRng(seed) {
  let a = fnv(seed) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const R = () => next();
  R.range = (lo, hi) => lo + (hi - lo) * next();
  R.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  R.chance = (p) => next() < p;
  R.pick = (list) => list[Math.floor(next() * list.length)];
  R.shuffle = (list) => { const out = list.slice(); for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  R.some = (list, n) => R.shuffle(list).slice(0, n);
  R.weighted = (list, weight) => {
    let total = 0;
    for (const item of list) total += weight(item);
    let roll = next() * total;
    for (const item of list) { roll -= weight(item); if (roll <= 0) return item; }
    return list[list.length - 1];
  };
  R.fork = (label) => makeRng(`${seed}/${label}`);
  return R;
}

/* ---- colour (hex strings, so the description stays plain data) ---------------- */

export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// wallpaper, carpet and skirting as [hue, saturation, lightness]; the yellow is the one everybody remembers
const FAMILIES = [
  { id: 'yellow', weight: 14, wall: [53, 0.50, 0.69], carpet: [50, 0.17, 0.43], trim: [31, 0.42, 0.29] },
  { id: 'mustard', weight: 2.2, wall: [44, 0.56, 0.60], carpet: [32, 0.24, 0.36], trim: [24, 0.42, 0.24] },
  { id: 'sage', weight: 2, wall: [96, 0.22, 0.67], carpet: [84, 0.14, 0.40], trim: [30, 0.30, 0.27] },
  { id: 'salmon', weight: 1.4, wall: [13, 0.46, 0.74], carpet: [22, 0.17, 0.42], trim: [14, 0.34, 0.29] },
  { id: 'blue', weight: 1.4, wall: [206, 0.20, 0.71], carpet: [216, 0.16, 0.36], trim: [216, 0.16, 0.24] },
  { id: 'beige', weight: 2, wall: [38, 0.30, 0.76], carpet: [35, 0.17, 0.47], trim: [30, 0.30, 0.31] },
  { id: 'lilac', weight: 0.6, wall: [272, 0.20, 0.74], carpet: [282, 0.12, 0.38], trim: [282, 0.16, 0.26] },
  { id: 'mint', weight: 0.8, wall: [160, 0.25, 0.71], carpet: [170, 0.14, 0.38], trim: [170, 0.20, 0.26] },
];
const PATTERNS = ['dots', 'dots', 'dots', 'diamonds', 'stripes', 'trellis', 'sprigs', 'chevrons'];
const TUBES = ['#fff6dc', '#fff6dc', '#fffbe9', '#f3ffe6', '#ffeec4', '#eef6ff'];

function rollLook(R, family, pattern) {
  const [wh, ws, wl] = family.wall, [ch, cs, cl] = family.carpet, [th, ts, tl] = family.trim;
  const dh = R.range(-5, 5), dl = R.range(-0.035, 0.035);
  const wall = hsl(wh + dh, ws + R.range(-0.05, 0.05), wl + dl);
  return {
    family: family.id, pattern,
    wall, ink: hsl(wh + dh - 4, ws + 0.08, wl + dl - R.range(0.1, 0.15)), pale: hsl(wh + dh, ws - 0.05, wl + dl + 0.07),
    carpet: hsl(ch + R.range(-6, 6), cs + R.range(-0.03, 0.03), cl + R.range(-0.03, 0.03)),
    trim: hsl(th, ts, tl + R.range(-0.02, 0.02)),
    ceil: hsl(wh, 0.14, 0.80 + R.range(-0.03, 0.02)),
    tube: R.pick(TUBES),
  };
}

/* ---- the local frame ----------------------------------------------------------- */

const COS = [1, 0, -1, 0], SIN = [0, 1, 0, -1];
export const SIDES = ['front', 'right', 'back', 'left'];          // local walls, in turning order from +z
export function toWorld(room, lx, lz) {
  const c = COS[room.rot], s = SIN[room.rot];
  return { x: room.cx + lx * c + lz * s, z: room.cz - lx * s + lz * c };
}
export function toLocal(room, x, z) {
  const c = COS[room.rot], s = SIN[room.rot], dx = x - room.cx, dz = z - room.cz;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
/** Length of a local wall: front/back run across (W), left/right run deep (D). */
export const wallLength = (room, side) => (side === 'front' || side === 'back' ? room.W : room.D);

/* ---- words ------------------------------------------------------------------- */

const fill = (text, o, R) => String(text)
  .replace(/\{name\}/g, o.name).replace(/\{NAME\}/g, o.name.toUpperCase())
  .replace(/\{agent\}/g, () => R.pick(o.agents)).replace(/\{AGENT\}/g, () => R.pick(o.agents).toUpperCase())
  .replace(/\{project\}/g, () => R.pick(o.projects)).replace(/\{PROJECT\}/g, () => R.pick(o.projects).toUpperCase());

const INTROS = [
  'You lean on the wall. The wall does not lean back.',
  'You have fallen out of the office. The carpet is damp. The lights hum in B flat.',
  'Somewhere above you, a ceiling tile settles back into place.',
  'This is not on the floor plan.',
  'It smells of warm toner and old carpet. There is no bookshelf here.',
  'The camera is already recording. You do not remember bringing a camera.',
];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/* ---- the deck ------------------------------------------------------------------
   id        what the dev page and the tests call it
   landmark  how somebody would give directions past it
   w, d      size ranges in whole metres: across the entry wall, and deep
   ports     local walls that may get one more doorway (centred), so the room can lie on a path
   lights    how the ceiling behaves: normal | dim | dark | entry | one
   roll      (R, names) → the randomised details the builder needs                       */

const STATUS = {
  404: '404. The door is not found. It is painted on, quite well.',
  403: '403. It is locked, and it knows it is you.',
  418: '418. It is a teapot. It was never a door.',
  301: '301. This door has moved permanently. A forwarding address is taped to it: this door.',
  302: '302. Found, but only temporarily. Come back when it is somewhere else.',
  500: '500. Something behind the door falls over, at length.',
  503: '503. The door is unavailable. Try again in 3,600 seconds.',
  401: '401. It wants a badge. You left yours in the office upstairs.',
  408: '408. You wait. The door waits longer.',
  410: '410. Gone. The handle comes off in your hand, and then that is gone too.',
  429: '429. Too many doors. Please slow down.',
  451: '451. Unavailable, for reasons the door is not at liberty to discuss.',
  502: '502. This door is only a front for another door, and that door is down.',
  204: '204. It opens. There is no content.',
  304: '304. Not modified. It is exactly as you left it. You have never been here.',
  402: '402. Payment required. The coin slot is also painted on.',
  409: '409. Conflict. Someone is pushing from the other side at the same moment. It is also you.',
};
const VENDING = [
  ['LUKEWARM COFFEE', '#8a5a34', 'It drops a cup. Then, after a pause, the coffee. They miss each other.'],
  ['ONE (1) AA BATTERY', '#c9893f', 'Clunk. A single battery. It is already flat.'],
  ['LOOSE STAPLES', '#8d949c', 'A handful of staples rattles into the tray. No stapler is sold on this floor.'],
  ['THE SAME SANDWICH', '#d8c58a', 'Egg and cress. It is the one you did not finish in March.'],
  ['WARM MILK', '#e8e2d0', 'A carton of warm milk. The best-before date is a phone number.'],
  ['DECAF', '#6f5a48', 'Decaf. Every slot, every row. The machine hums to itself, unbothered.'],
  ['KEY CARD (NOT YOURS)', '#3f7f9a', 'A key card. The photo is of somebody leaning on a bookshelf.'],
  ['A SMALLER VENDING MACHINE', '#b5483f', 'Clunk. A smaller vending machine. It sells the same thing.'],
  ['MEETING INVITE', '#5a6fa8', 'It prints a calendar invite. The meeting began nine years ago. You are late.'],
  ['CYAN TONER', '#3fb6c9', 'A cartridge of cyan. The printer on this floor only takes magenta.'],
  ['EXACT CHANGE', '#b9a04a', 'You put in exact change. It gives you exact change.'],
];
const PHONE = [
  'A dial tone. Then your own voice says "hello?", a moment after you do.',
  '"Please hold. Your call is important to us. You are caller number one. You have always been caller number one."',
  'Hold music. It is the hum of the lights, but in stereo.',
  '"Hi, it\'s {agent}. Did you mean to leave the meeting?" Click.',
  'Nobody. The handset is warm.',
  '"This is a courtesy call about your position on the carpet." Click.',
  '"You have… zero… new messages. First message:" — and then the hum.',
];
const CABINET = [
  '{PROJECT} — REGRETS A–M', '{PROJECT} — REGRETS N–Z', '{PROJECT} — MEETINGS THAT WERE EMAILS', '{PROJECT} — TODO (1996)',
  '{PROJECT} — FINAL', '{PROJECT} — FINAL (2)', '{PROJECT} — FINAL FINAL', '{PROJECT} — DO NOT OPEN', '{PROJECT} — ROADMAP (OLD)',
  '{AGENT} — PERMANENT RECORD', '{AGENT} — EXCUSES', '{AGENT} — SNACKS OWED', '{NAME} — UNFILED', '{NAME} — SEE ALSO: {NAME}',
  'MISC', 'MISC (MISC)', 'A–Z EXCEPT Q', 'Q', 'THINGS FOUND IN THE CARPET', 'KEYS TO THIS CABINET',
];
const CABINET_USE = [
  'You pull a drawer. Inside: a smaller filing cabinet, with the same label.',
  'Every folder holds one sheet. Every sheet says "see other folder".',
  'The drawer is full of commit messages. They all just say "fix".',
  'Locked. A note says the key is filed under K. There is no K.',
  'It slides out, and out, and out. You stop pulling when you run out of room.',
  'Empty, except for a hanging folder labelled with today\'s date.',
];
const BANNERS = [
  ['HAPPY 0TH BIRTHDAY', 'WE MISSED YOU, {NAME}'], ['WELCOME BACK, {NAME}', '(YOU NEVER LEFT)'], ['CONGRATULATIONS', 'ON YOUR INCIDENT'],
  ['GOODBYE {AGENT}', 'WE WILL REPLACE YOU'], ['HAPPY WORK ANNIVERSARY', 'DAY 1'], ['SORRY FOR', 'YOUR PROMOTION'], ['MANDATORY FUN', 'ATTENDANCE IS BEING TAKEN'],
  ['IT\'S A DEPLOY!', 'HAPPY BIRTHDAY {PROJECT}'], ['{NAME}', '1 DAY WITHOUT LEAVING'], ['THANK YOU FOR', 'YOUR SERVICE REQUEST'], ['SURPRISE', 'WE KNEW YOU WERE COMING'],
];
const CAKE = ['{NAME}', '404', 'v0.0.0', 'SORRY', 'AGAIN', 'YAY?', 'Q4'];
const PAGES = ['OUT OF PAPER', 'PAGE 1 OF 1', 'THIS PAGE INTENTIONALLY LEFT BLANK', 'TEST PAGE', '{NAME}', 'PLEASE STOP PRINTING', 'LOW TONER — THIS IS THE LAST PAGE', 'RE: RE: RE: FWD:', 'SEE ATTACHED'];
const KANBAN = ['find the exit', 'fix the thing', 'ask {agent}', 'this card', 'move this card', '{name}', 'TODO', 'done?', 'reply to {agent}', 'water the plants (ceiling)'];
const KANBAN_COLS = [['TO DO', 'TO DO', 'TO DO', 'TO DO'], ['TODO', 'DOING', 'DONE', 'UNDONE'], ['BACKLOG', 'BACKLOG (OLD)', 'BACKLOG (OLDER)', 'ICEBOX'], ['SOON', 'LATER', 'NEVER', 'DONE']];
const WET = ['CAUTION|WET FLOOR', 'CAUTION|FLOOR', 'CAUTION|DRY FLOOR', 'CAUTION|CAUTION', 'CAUTION|{NAME}', 'CUIDADO|PISO', 'CAUTION|WET SIGN', 'CAUTION|SIGNS', 'CAUTION|CARPET'];
const TINY = ['STAFF ONLY', 'MEETING ROOM 0.3', 'EXIT (SMALL)', 'MANAGEMENT', 'SUPPLIES', 'DO NOT KNOCK'];
const TINY_USE = [
  'You are too large for this door. You suspect you always were.',
  'You knock with one finger. Something very small says "occupied".',
  'The handle is the size of a drawing pin. It turns. Nothing else does.',
];
const AGENDA = ['Why are we up here', 'Gravity (carried over)', 'Action items from below', 'Who booked this room', 'Chairs: status', 'Next steps (there are no steps)', 'AOB', 'See item 1', 'Minutes: falling', 'Hard stop'];
const POOL_SIGNS = ['NO DIVING', 'NO RUNNING · NO DIVING · NO DEADLINES', 'LIFEGUARD OFF DUTY SINCE 1997', 'SHALLOW END 0.9m · DEEP END Q4', 'PLEASE SQUEEZE RESPONSIBLY'];
const FLOORS = ['9', '8', '7', '6', '5', '4', '3½', '3', 'π', '2', '1', '0', '-1', 'B', 'G', '13', 'M', '?'];
const LIFT_SIGNS = ['LIFT', 'ELEVATOR', 'LIFT (IN ORDER)', 'GOODS LIFT', 'LIFT B'];
const PLATES = ['for attendance', 'for remaining calm', 'for the incident', 'for not asking', 'for staying late (ongoing)', 'for finding the stapler', 'for replying all', 'for outstanding humming', 'for closing the ticket', 'for being here'];
const ODD_MONTHS = ['FEBRUARY', 'FEBRUARY', 'SMARCH', 'MONTH 13', 'LATE JUNE', 'THE SAME MONTH', 'NOVEMBER (AGAIN)'];
const STAIRS = ['FLOOR 1', 'FLOOR 1', 'FLOOR 1 (STILL)', 'FLOOR 1, AGAIN', 'YES, FLOOR 1', 'PLEASE STOP', 'FLOOR 1 — 5 more climbs for a free floor'];
const CORNER_THINGS = ['nothing', 'cup', 'plant', 'crt', 'sign', 'phone'];
const SLIDES = ['ANY QUESTIONS?', 'THANK YOU FOR COMING, {NAME}', 'Q & A', 'SLIDE 1 OF 1', 'AGENDA: {NAME}', 'IN SUMMARY'];
const CHAIR_COLORS = ['#4a7a6a', '#b5483f', '#3f7f9a', '#8a5a8f', '#c9893f', '#5a5a66', '#6f8a4a'];

export const DECK = [
  { id: 'cutouts', name: 'The Standees', landmark: 'the cardboard people', w: [7, 10], d: [7, 10], ports: ['back', 'left', 'right'], weight: 2.2, lights: 'normal',
    roll: (R, o) => ({ count: R.int(4, 7), who: R.shuffle(o.agents.map((_, i) => i)), formation: R.pick(['scatter', 'scatter', 'queue', 'ring', 'wall', 'crowd']),
      follower: R.chance(0.4), self: R.chance(0.35), boxes: R.int(1, 3), papers: R.int(4, 10) }) },
  { id: 'ceiling-meeting', name: 'Standing Meeting', landmark: 'the meeting on the ceiling', w: [7, 9], d: [6, 8], ports: ['back', 'left', 'right'], weight: 1.4, lights: 'normal',
    roll: (R) => ({ chairs: R.int(4, 8), color: R.pick(CHAIR_COLORS), agenda: R.some(AGENDA, R.int(3, 4)), stray: R.chance(0.6), mugs: R.int(1, 4) }) },
  { id: 'coolers', name: 'Hydration Corridor', landmark: 'the water coolers', w: [3, 4], d: [15, 19], ports: [], weight: 1.3, lights: 'entry',
    roll: (R) => { const lit = R.int(5, 7); return { lit, bubbling: R.int(1, lit - 1), both: R.chance(0.35), spacing: R.pick([1.2, 1.4, 1.6]) }; } },
  { id: 'stress-pool', name: 'The Stress Pool', landmark: 'the ball pit', w: [8, 11], d: [8, 11], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R) => ({ fill: R.pick(['balls', 'balls', 'peanuts', 'shreds']), hues: R.some([4, 28, 48, 130, 200, 265, 330], R.int(2, 5)), sign: R.pick(POOL_SIGNS), tiles: R.pick(['#9fc4c9', '#c9bfa0', '#a8b4cf', '#b9d0b0']) }) },
  { id: 'keyboard-floor', name: 'Input Device', landmark: 'the big keyboard', w: [11, 11], d: [7, 8], ports: ['left', 'right'], weight: 1.2, lights: 'dim',
    roll: (R, o) => ({ layout: R.pick(['qwerty', 'qwerty', 'qwerty', 'scrambled', 'azerty']), prompt: R.pick(['C:\\>', '$', '>>>', '>', 'READY.']), keys: R.pick(['beige', 'beige', 'dark', 'grey']),
      phosphor: R.pick(['#6fe08a', '#ffb44a', '#d8e6f0']), name: o.name }) },
  { id: 'tiny-door', name: 'Perspective', landmark: 'the corridor that gets smaller', w: [3, 3], d: [9, 12], ports: [], weight: 1.1, lights: 'normal',
    roll: (R) => ({ sign: R.pick(TINY), use: R.shuffle(TINY_USE), door: R.pick(['#7a4a2a', '#3f6a5a', '#8a3a34', '#3a4a6a']), taper: R.range(0.2, 0.3) }) },
  { id: 'many-doors', name: 'Status Codes', landmark: 'the room of doors', w: [7, 9], d: [7, 9], ports: [], doored: true, weight: 1.5, lights: 'normal',
    roll: (R) => { const side = R.pick(['back', 'left', 'right']); const per = R.int(3, 4);
      const codes = R.shuffle(Object.keys(STATUS)).slice(0, per * 3).map((code) => ({ code, say: STATUS[code] }));
      return { per, side, slot: R.int(0, per - 1), codes, color: R.pick(['#7a5a3a', '#5a6a7a', '#6a4a3a', '#4a6a5a']) }; } },
  { id: 'vending', name: 'Refreshments', landmark: 'the vending machines', w: [5, 6], d: [9, 13], ports: ['back'], weight: 1.3, lights: 'dark',
    roll: (R) => { const [item, color, say] = R.pick(VENDING); return { item, color, say, price: R.pick(['0.37', '1.00', 'EXACT', 'FREE', '9.99', '0.00']), both: R.chance(0.6), glow: R.pick(['#bfe8ff', '#ffd9a0', '#c8ffd0', '#ffc8e0']) }; } },
  { id: 'ceiling-plants', name: 'Hanging Garden', landmark: 'the plants in the ceiling', w: [6, 9], d: [6, 9], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R) => ({ count: R.int(7, 13), vines: R.int(8, 16), leaves: R.int(10, 24), can: R.chance(0.7) }) },
  { id: 'phone', name: 'It\'s For You', landmark: 'the phone on the floor', w: [9, 12], d: [9, 12], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'dim',
    roll: (R, o) => ({ color: R.pick(['#b5483f', '#d8cdb8', '#2b2b33', '#3f8a72']), lines: R.shuffle(PHONE).slice(0, 4).map((t) => fill(t, o, R)), at: [R.range(-0.2, 0.2), R.range(-0.25, 0.1)] }) },
  { id: 'party', name: 'The Party', landmark: 'the party', w: [7, 9], d: [7, 9], ports: ['left', 'right'], weight: 1.8, lights: 'normal',
    roll: (R, o) => ({ banner: R.pick(BANNERS).map((t) => fill(t, o, R)), cake: fill(R.pick(CAKE), o, R).toUpperCase().slice(0, 9), candles: R.pick([0, 1, 3, 40]), chairs: R.int(4, 6), balloons: R.int(5, 9),
      flags: R.some(['#d8493f', '#e8e2d0', '#3f8a72', '#e8b33c', '#5a6fa8', '#e87aae'], 3), hats: R.chance(0.7), guests: R.shuffle(o.agents.map((_, i) => i)).slice(0, R.int(0, 2)) }) },
  { id: 'monitor', name: 'Camera 4', landmark: 'the dark cubicles', w: [9, 11], d: [9, 11], ports: ['back'], weight: 1.3, lights: 'dark',
    roll: (R) => ({ rows: R.int(2, 3), live: R.int(0, 5), stranger: R.chance(0.7) }) },
  { id: 'chairs', name: 'Seating Plan', landmark: 'all the chairs', w: [8, 10], d: [8, 10], ports: ['left', 'right'], weight: 1.5, lights: 'normal',
    roll: (R, o) => ({ variant: R.pick(['corner', 'corner', 'arch', 'audience', 'ring']), count: R.int(18, 30), color: R.pick(CHAIR_COLORS), odd: R.chance(0.5) ? R.pick(CHAIR_COLORS) : null, corner: R.pick([-1, 1]), thing: R.pick(CORNER_THINGS), slide: fill(R.pick(SLIDES), o, R) }) },
  { id: 'cabinets', name: 'Records', landmark: 'the filing cabinets', w: [8, 10], d: [8, 11], ports: ['back'], weight: 1.5, lights: 'dim',
    roll: (R, o) => ({ labels: R.shuffle(CABINET).slice(0, 14).map((t) => fill(t, o, R)), use: R.shuffle(CABINET_USE), open: R.int(0, 9), aisles: R.int(2, 3) }) },
  { id: 'printer', name: 'Print Queue', landmark: 'the printer', w: [6, 8], d: [7, 9], ports: ['left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R, o) => ({ text: fill(R.pick(PAGES), o, R), paper: R.pick(['#f4f1e6', '#f4f1e6', '#f6e7a8', '#f2c9d2', '#cfe6c8']), sheets: R.int(140, 220) }) },
  { id: 'lift', name: 'Going Up', landmark: 'the lift', w: [5, 7], d: [4, 5], ports: [], weight: 1.2, lights: 'normal',
    roll: (R, o) => ({ sign: R.pick(LIFT_SIGNS), floors: R.shuffle(FLOORS).slice(0, 7), behind: R.shuffle(['bricks', 'bricks', 'cutout', 'poster', 'bricks']), who: R.int(0, Math.max(0, o.agents.length - 1)), doors: R.pick(['#8d949c', '#b0a58a', '#7a8a9a']) }) },
  { id: 'beige-plaza', name: 'Plaza (Draft)', landmark: 'the beige plaza', w: [16, 16], d: [9, 9], ports: ['left', 'right'], weight: 1.0, lights: 'normal',
    roll: (R) => ({ tint: R.pick(['#d9cfb4', '#d6d0c4', '#e0d2b8', '#cfc8b0']), flip: true }) },
  { id: 'kanban', name: 'The Board', landmark: 'the board with one card', w: [8, 10], d: [6, 7], ports: ['left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R, o) => ({ text: o.tasks.length && R.chance(0.6) ? R.pick(o.tasks) : fill(R.pick(KANBAN), o, R), cols: R.pick(KANBAN_COLS), cards: R.int(44, 70), spill: R.int(14, 34), notes: R.some(['#f2d45c', '#f29a8c', '#9fd6a0', '#9cc4ea', '#e6b0e0'], R.int(1, 3)) }) },
  { id: 'tall-room', name: 'Headroom', landmark: 'the room that is too tall', w: [6, 8], d: [6, 8], h: [4.2, 6.4], ports: ['back', 'left', 'right'], weight: 1.1, lights: 'normal',
    roll: (R) => ({ feature: R.pick(['cabinet', 'lamp', 'door', 'ladder']), frames: R.int(2, 4) }) },
  { id: 'carpet-walls', name: 'Wall-to-Wall', landmark: 'the carpeted walls', w: [6, 7], d: [6, 7], ports: ['back'], weight: 1.1, lights: 'normal',
    roll: (R) => ({ side: R.pick(['left', 'right']), carpet: R.pick(['#7a4a52', '#4a5a7a', '#5a6a4a', '#7a6a4a', '#5a4a6a']), color: R.pick(CHAIR_COLORS) }) },
  { id: 'wet-floor', name: 'Caution', landmark: 'the wet floor signs', w: [7, 9], d: [7, 9], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R, o) => ({ count: R.int(26, 44), pattern: R.pick(['grid', 'spiral', 'crowd', 'rows']), texts: R.shuffle(WET).slice(0, 4).map((t) => fill(t, o, R)), puddle: [R.range(-0.2, 0.2), R.range(-0.2, 0.2)] }) },
  { id: 'last-desk', name: 'The Last Desk', landmark: 'the one desk', w: [11, 13], d: [11, 13], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'one',
    roll: (R, o) => ({ who: R.shuffle(o.agents).slice(0, 3), color: R.pick(CHAIR_COLORS), phosphor: R.pick(['#6fe08a', '#ffb44a', '#d8e6f0']) }) },
  { id: 'stair-loop', name: 'Floor 1', landmark: 'the stairs', w: [7, 7], d: [6, 6], ports: [], weight: 1.0, lights: 'entry',
    roll: (R) => ({ signs: [STAIRS[0], ...R.shuffle(STAIRS.slice(1))], rail: R.pick(['#8a3a34', '#3a4a6a', '#5a5a66', '#3f6a5a']) }) },
  { id: 'hall-of-fame', name: 'Employee of the Month', landmark: 'the portraits', w: [3, 4], d: [10, 14], ports: ['back'], weight: 1.4, lights: 'normal',
    roll: (R, o) => { const n = R.int(6, 10); const month = R.pick(ODD_MONTHS);
      return { month, frames: Array.from({ length: n }, (_, i) => ({ who: i % Math.max(1, o.agents.length), plate: R.pick(PLATES) })), order: R.shuffle(o.agents.map((_, i) => i)), last: R.pick(['empty', 'you', 'mirror']), wood: R.pick(['#6a4a2a', '#2b2b33', '#b89a5a']) }; } },
];
export const ARCHETYPES = Object.fromEntries(DECK.map((a) => [a.id, a]));

/* ---- names from the real office (or stand-ins when there is nothing to borrow) ----- */

function names(opt) {
  const clean = (list, max) => [...new Set((list || []).map((s) => String(s || '').trim()).filter(Boolean))].slice(0, max);
  const projects = clean(opt.projects, 24), agents = clean(opt.agents, 40), tasks = clean(opt.tasks, 60).map((t) => t.slice(0, 44));
  return {
    name: String(opt.name || 'Lead').trim().slice(0, 18) || 'Lead',
    projects: projects.length ? projects : ['Untitled', 'New Folder (2)', 'The Project', 'Misc'],
    agents: agents.length ? agents : ['Unit 7', 'Somebody', 'The Intern', 'A Colleague'],
    tasks,
  };
}

/* ---- the layout -------------------------------------------------------------------- */

const DX = [0, 1, 0, -1], DZ = [1, 0, -1, 0];        // world sides in turning order: +z, +x, −z, −x
const MARGIN = 0.5;                                  // a doorway stays this far from a room's corner
const cellKey = (x, z) => x * 4096 + z;

function build(R, o, opt) {
  const rooms = [], links = [], taken = new Map();
  const fits = (x, z, w, d) => {
    if (Math.abs(x) > 400 || Math.abs(z) > 400) return false;
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (taken.has(cellKey(x + i, z + j))) return false;
    return true;
  };
  function addRoom(spec, x, z, w, d, rot) {
    const room = { id: rooms.length, kind: spec.kind, arch: spec.arch || null, x, z, w, d, rot, H: spec.H || WALL_H,
      cx: x + w / 2, cz: z + d / 2, W: (rot % 2 ? d : w) - T, D: (rot % 2 ? w : d) - T, doors: [], links: [] };
    rooms.push(room);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) taken.set(cellKey(x + i, z + j), room.id);
    return room;
  }
  function addLink(a, b, axis, at, from, to, extra) {
    const link = { id: links.length, a: a.id, b: b.id, axis, at, from, to, door: false, ...extra };
    links.push(link); a.links.push(link.id); b.links.push(link.id);
    return link;
  }
  /**
   * Put a new room against one wall of `anchor`, joined by a doorway.
   * spec: { kind, arch, lw, ld, dw, centred, fixed:{from,to}, H, door }
   *   centred — the doorway sits in the middle of the new room's entry wall (every oddity)
   *   fixed   — the anchor insists on where the doorway is (an oddity's port)
   */
  function attach(anchor, side, spec) {
    const rot = (side + 2) % 4;
    const w = rot % 2 ? spec.ld : spec.lw, d = rot % 2 ? spec.lw : spec.ld;
    const alongX = side % 2 === 0;
    const aLo = alongX ? anchor.x : anchor.z, aHi = aLo + (alongX ? anchor.w : anchor.d);
    const span = alongX ? w : d;
    const m = span <= 3 ? 0.3 : MARGIN;                     // a corridor's mouth is nearly as wide as the corridor
    const dw = spec.fixed ? spec.fixed.to - spec.fixed.from : Math.min(spec.dw, span - 2 * m);
    const fixed = side === 0 ? anchor.z + anchor.d : side === 2 ? anchor.z - d : side === 1 ? anchor.x + anchor.w : anchor.x - w;
    const options = [];
    for (let at = aLo - span + 1; at <= aHi - 1; at++) {
      let from, to;
      if (spec.fixed) {
        ({ from, to } = spec.fixed);
        if (from < at + m - 1e-6 || to > at + span - m + 1e-6) continue;
        if (spec.centred && Math.abs((from + to) / 2 - (at + span / 2)) > 1e-6) continue;
      } else if (spec.centred) {
        from = at + span / 2 - dw / 2; to = from + dw;
        if (from < aLo + m - 1e-6 || to > aHi - m + 1e-6) continue;
      } else {
        const lo = Math.max(aLo, at) + m, hi = Math.min(aHi, at + span) - m;
        if (hi - lo < dw - 1e-6) continue;
        from = lo + Math.round(R() * (hi - lo - dw) * 2) / 2;
        if (from + dw > hi) from = lo;
        to = from + dw;
      }
      options.push({ at, from, to });
    }
    for (const c of R.shuffle(options)) {
      const x = alongX ? c.at : fixed, z = alongX ? fixed : c.at;
      if (!fits(x, z, w, d)) continue;
      const room = addRoom(spec, x, z, w, d, spec.kind === 'plain' ? 0 : rot);
      const wall = side === 0 ? anchor.z + anchor.d : side === 2 ? anchor.z : side === 1 ? anchor.x + anchor.w : anchor.x;
      addLink(anchor, room, alongX ? 'z' : 'x', wall, c.from, c.to, spec.door ? { door: true } : null);
      return room;
    }
    return null;
  }
  /** Take back the room that was added last (it turned out nothing could hang off it). */
  function undo(room) {
    const link = links.pop();
    rooms.pop();
    for (const r of [rooms[link.a], rooms[link.b]]) if (r) r.links = r.links.filter((id) => id !== link.id);
    for (let i = 0; i < room.w; i++) for (let j = 0; j < room.d; j++) taken.delete(cellKey(room.x + i, room.z + j));
  }
  const plainSpec = () => {
    const roll = R();
    const [lw, ld] = roll < 0.22 ? [R.int(2, 3), R.int(4, 7)] : roll < 0.4 ? [R.int(5, 8), R.int(2, 3)] : roll < 0.82 ? [R.int(4, 6), R.int(4, 6)] : [R.int(7, 9), R.int(6, 8)];
    return { kind: 'plain', lw, ld, dw: R.pick([1.5, 2, 2, 2.5]) };
  };
  /** The world side (0..3) of a room that one of its local walls faces. */
  const worldSide = (room, local) => (SIDES.indexOf(local) + room.rot) % 4;
  /** Where on a local wall an oddity's extra doorway goes: a world interval. */
  function portSpan(room, local, c = 0, dw = 1.8) {
    const p = toWorld(room, local === 'left' ? -room.W / 2 : local === 'right' ? room.W / 2 : c, local === 'front' ? room.D / 2 : local === 'back' ? -room.D / 2 : c);
    const v = worldSide(room, local) % 2 === 0 ? p.x : p.z;
    return { from: v - dw / 2, to: v + dw / 2 };
  }

  /* the room you land in */
  const start = addRoom({ kind: 'start' }, -3, -3, R.int(5, 7), R.int(5, 7), 0);
  const hubs = [start];                     // plain rooms something can still hang off
  const ports = [];                         // { room, local } — unused extra walls of oddities
  const specials = [];

  /* deal the oddities */
  const want = opt.count || R.int(6, 9);
  let deck = [];
  { const pool = DECK.slice(); while (pool.length) { const pickd = R.weighted(pool, (a) => a.weight); deck.push(pickd); pool.splice(pool.indexOf(pickd), 1); } }
  if (opt.only) { const forced = [].concat(opt.only).map((id) => ARCHETYPES[id]).filter(Boolean); deck = [...forced, ...deck.filter((a) => !forced.includes(a))]; }

  const sides = () => R.shuffle([0, 1, 2, 3]);
  function connector(from) {                 // a plain room off a hub or a port
    for (let tries = 0; tries < 6; tries++) {
      const spec = plainSpec();
      if (from.local) {
        const dw = Math.min(1.8, wallLength(from.room, from.local) - 1.2);
        const made = attach(from.room, worldSide(from.room, from.local), { ...spec, dw, fixed: portSpan(from.room, from.local, 0, dw) });
        if (made) return made;
      } else for (const side of sides()) { const made = attach(from, side, spec); if (made) return made; }
    }
    return null;
  }
  function placeSpecial(arch, first) {
    const lw = R.int(arch.w[0], arch.w[1]), ld = R.int(arch.d[0], arch.d[1]);
    const spec = { kind: 'special', arch: arch.id, lw, ld, dw: arch.door || 1.8, centred: true, H: arch.h ? Math.round(R.range(arch.h[0], arch.h[1]) * 10) / 10 : WALL_H };
    for (let tries = 0; tries < 14; tries++) {
      // where to grow from: usually the newest part of the maze, sometimes an older room (a branch)
      let hub = null, fresh = false, port = null;
      const openPorts = ports.filter((p) => !p.used);
      if (first && opt.only) hub = start;
      else if (openPorts.length && R.chance(0.5)) { port = R.chance(0.7) ? openPorts[openPorts.length - 1] : R.pick(openPorts); hub = connector(port); fresh = !!hub; }
      else {
        const base = R.chance(0.55) ? hubs[hubs.length - 1] : R.pick(hubs);
        if (base !== start && base.links.length < 3 && R.chance(0.4)) hub = base;
        else { hub = connector(base); fresh = !!hub; }
      }
      if (!hub) continue;
      for (const side of sides()) {
        const room = attach(hub, side, spec);
        if (!room) continue;
        room.name = arch.name;
        if (fresh) hubs.push(hub);
        if (port) port.used = true;
        for (const local of arch.ports) if (wallLength(room, local) >= 3.2) ports.push({ room, local });
        return room;
      }
      if (fresh) undo(hub);
    }
    return null;
  }
  for (const arch of deck) {
    if (specials.length >= want) break;
    const room = placeSpecial(arch, specials.length === 0);
    if (room) specials.push(room);
  }

  /* params for each oddity — and the rooms that hide a way on behind a real door */
  for (const room of specials) {
    const arch = ARCHETYPES[room.arch];
    room.params = arch.roll(R.fork('roll:' + room.id), o);
    if (arch.doored) {
      const p = room.params;
      const len = wallLength(room, p.side), c = -len / 2 + (p.slot + 0.5) * (len / p.per);
      const beyond = attach(room, worldSide(room, p.side), { kind: 'plain', lw: R.int(3, 5), ld: R.int(3, 5), dw: 0.9, fixed: portSpan(room, p.side, c, 0.9), door: true });
      if (beyond) hubs.push(beyond); else p.blind = true;
    }
  }

  /* a few more plain rooms: dead ends, side passages, and rooms that close a loop */
  const plain = (r) => r.kind === 'plain' || r.kind === 'start';
  const touching = (a, b) => {                       // do two rooms share enough wall for a doorway?
    if (a.x + a.w === b.x || b.x + b.w === a.x) return Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z) >= 2.5;
    if (a.z + a.d === b.z || b.z + b.d === a.z) return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) >= 2.5;
    return false;
  };
  function bridge() {                                // try a handful of spots, keep the one that touches the most rooms
    let best = null;
    for (let k = 0; k < 16; k++) {
      const from = R.pick(hubs), spec = plainSpec();
      for (const side of sides()) {
        const made = attach(from, side, spec);
        if (!made) continue;
        const link = links[links.length - 1];
        const score = rooms.filter((r) => r !== made && r !== from && plain(r) && touching(made, r)).length;
        if (!best || score > best.score) best = { from, score, x: made.x, z: made.z, w: made.w, d: made.d, axis: link.axis, at: link.at, lo: link.from, hi: link.to };
        undo(made);
        break;
      }
    }
    if (!best || !best.score) return null;
    const room = addRoom({ kind: 'plain' }, best.x, best.z, best.w, best.d, 0);
    addLink(best.from, room, best.axis, best.at, best.lo, best.hi);
    return room;
  }
  let extra = R.int(2, 4) + Math.max(0, 13 - rooms.length);
  for (let guard = 0; extra > 0 && guard < 40 && rooms.length < 24; guard++) {
    const open = ports.filter((p) => !p.used);
    const from = open.length && R.chance(0.35) ? R.pick(open) : R.pick(hubs);
    const made = (!from.local && R.chance(0.7) && bridge()) || connector(from);
    if (made) { if (from.local && made.links.some((id) => links[id].a === from.room.id)) from.used = true; hubs.push(made); extra--; }
  }

  /* how far everything is from where you land */
  const neighbours = (room) => room.links.map((id) => { const l = links[id]; return rooms[l.a === room.id ? l.b : l.a]; });
  const distances = (from) => {
    const dist = new Map([[from.id, 0]]), queue = [from];
    while (queue.length) { const cur = queue.shift(); for (const n of neighbours(cur)) if (!dist.has(n.id)) { dist.set(n.id, dist.get(cur.id) + 1); queue.push(n); } }
    return dist;
  };
  let depth = distances(start);

  /* the way out: far from the start, down its own short passage */
  const exitSpec = { kind: 'exit', lw: 3, ld: R.int(3, 5), dw: 1.6, centred: true };
  let exit = null;
  const anchors = [...hubs.filter((h) => h !== start).map((room) => ({ room })), ...ports.filter((p) => !p.used)]
    .sort((p, q) => depth.get(q.room.id) - depth.get(p.room.id));
  const tryExit = (a) => {
    if (a.local) { const dw = Math.min(1.6, wallLength(a.room, a.local) - 1.2); return attach(a.room, worldSide(a.room, a.local), { ...exitSpec, dw, fixed: portSpan(a.room, a.local, 0, dw) }); }
    for (const side of sides()) { const made = attach(a.room, side, exitSpec); if (made) return made; }
    return null;
  };
  for (const a of [...R.shuffle(anchors.slice(0, 3)), ...anchors.slice(3), { room: start }]) { exit = tryExit(a); if (exit) { if (a.local) a.used = true; break; } }
  if (!exit) return null;
  exit.name = 'Way out';

  /* a couple of extra doorways between plain rooms that happen to share a wall: loops */
  const shared = [];
  for (const a of rooms) for (const b of rooms) {
    if (a.id >= b.id || !plain(a) || !plain(b) || a.links.some((id) => links[id].a === b.id || links[id].b === b.id)) continue;
    if (a.x + a.w === b.x || b.x + b.w === a.x) {
      const lo = Math.max(a.z, b.z) + MARGIN, hi = Math.min(a.z + a.d, b.z + b.d) - MARGIN;
      if (hi - lo >= 1.5) shared.push({ a, b, axis: 'x', at: a.x + a.w === b.x ? b.x : a.x, lo, hi });
    } else if (a.z + a.d === b.z || b.z + b.d === a.z) {
      const lo = Math.max(a.x, b.x) + MARGIN, hi = Math.min(a.x + a.w, b.x + b.w) - MARGIN;
      if (hi - lo >= 1.5) shared.push({ a, b, axis: 'z', at: a.z + a.d === b.z ? b.z : a.z, lo, hi });
    }
  }
  let loops = 0;
  for (const s of R.shuffle(shared)) {
    if (loops >= 3 || !R.chance(0.7)) continue;
    const dw = Math.min(R.pick([1.5, 2, 2.5]), s.hi - s.lo);
    const from = s.lo + Math.round(R() * (s.hi - s.lo - dw) * 2) / 2;
    addLink(s.a, s.b, s.axis, s.at, Math.min(from, s.hi - dw), Math.min(from, s.hi - dw) + dw);
    loops++;
  }
  // …and an oddity's spare wall that happens to back onto a plain room gets a doorway too
  for (const port of R.shuffle(ports.filter((p) => !p.used))) {
    if (loops >= 4 || !R.chance(0.6)) continue;
    const side = worldSide(port.room, port.local), dw = Math.min(1.6, wallLength(port.room, port.local) - 1.2);
    const span = portSpan(port.room, port.local, 0, dw), r = port.room;
    const wall = side === 0 ? r.z + r.d : side === 2 ? r.z : side === 1 ? r.x + r.w : r.x;
    const beyond = side === 0 ? wall : side === 2 ? wall - 1 : side === 1 ? wall : wall - 1;
    const ids = new Set();
    for (let v = Math.floor(span.from); v < Math.ceil(span.to); v++) ids.add(taken.get(side % 2 === 0 ? cellKey(v, beyond) : cellKey(beyond, v)));
    const other = ids.size === 1 ? rooms[[...ids][0]] : null;
    if (!other || !plain(other) || r.links.some((id) => links[id].a === other.id || links[id].b === other.id)) continue;
    const lo = side % 2 === 0 ? other.x : other.z, hi = lo + (side % 2 === 0 ? other.w : other.d);
    if (span.from < lo + 0.3 || span.to > hi - 0.3) continue;
    addLink(r, other, side % 2 === 0 ? 'z' : 'x', wall, span.from, span.to);
    port.used = true; loops++;
  }
  depth = distances(start);
  for (const room of rooms) room.depth = depth.get(room.id) ?? -1;
  if (rooms.some((r) => r.depth < 0)) return null;
  if (specials.length < Math.min(6, want) || (opt.only && [].concat(opt.only).some((id) => ARCHETYPES[id] && !specials.some((r) => r.arch === id)))) return null;

  /* each room's doorways, in its own frame */
  for (const link of links) for (const room of [rooms[link.a], rooms[link.b]]) {
    const mid = (link.from + link.to) / 2;
    const wx = link.axis === 'x' ? link.at : mid, wz = link.axis === 'x' ? mid : link.at;
    const p = toLocal(room, wx, wz);
    const side = Math.abs(Math.abs(p.z) - (room.D + T) / 2) < 1e-6 && Math.abs(p.x) <= room.W / 2 ? (p.z > 0 ? 'front' : 'back') : (p.x > 0 ? 'right' : 'left');
    room.doors.push({ side, c: side === 'front' || side === 'back' ? p.x : p.z, w: link.to - link.from, link: link.id, to: link.a === room.id ? link.b : link.a, door: link.door });
  }
  return { rooms, links, start, exit, specials, hubs, neighbours, distances };
}

/* ---- dressing: wallpaper, lights, pillars, the odd thing left in a corner ---------- */

const DRESSING = ['boxes', 'boxes', 'chair', 'plant', 'lamp', 'bin', 'wetsign', 'papers', 'papers', 'stain', 'poster', 'clock', 'frame', 'ladder', 'coat', 'fan', 'tile'];
const POSTERS = ['HANG IN THERE', 'SYNERGY', 'PERSISTENCE', 'TEAMWORK', 'THIS IS FINE', 'ALIGNMENT', 'YOU ARE DOING GREAT, {NAME}', 'DAYS SINCE LAST INCIDENT: 0'];

function layPanels(R, room, mode) {
  const { W, D } = room, panels = [];
  const nx = Math.max(1, Math.round(W / 2.7)), nz = Math.max(1, Math.round(D / 2.9));
  const snapX = (v) => (Math.round(v / TILE - 0.5) + 0.5) * TILE, snapZ = (v) => Math.round(v / TILE) * TILE;
  const seen = new Set();
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    let x = snapX(-W / 2 + (i + 0.5) * W / nx), z = snapZ(-D / 2 + (j + 0.5) * D / nz);
    while (Math.abs(x) + TILE / 2 > W / 2 - 0.05 && Math.abs(x) > 0.2) x -= Math.sign(x) * TILE;
    while (Math.abs(z) + TILE > D / 2 - 0.05 && Math.abs(z) > 0.2) z -= Math.sign(z) * TILE;
    const key = `${Math.round(x * 10)},${Math.round(z * 10)}`;
    if (seen.has(key) || Math.abs(x) + TILE / 2 > W / 2 || Math.abs(z) + TILE > D / 2) continue;
    seen.add(key);
    let state = R.chance(room.light.dead) ? 'dead' : 'on';
    if (mode === 'dark') state = 'dead';
    if (mode === 'dim' && state === 'on' && R.chance(0.45)) state = 'dead';
    if (mode === 'entry') state = z > D / 2 - 5.2 ? 'on' : 'dead';
    panels.push({ x, z, state });
  }
  if (mode === 'one') { let best = panels[0]; for (const p of panels) { p.state = 'dead'; if (Math.hypot(p.x, p.z) < Math.hypot(best.x, best.z)) best = p; } if (best) best.state = 'on'; }
  if (mode !== 'dark' && panels.length && !panels.some((p) => p.state === 'on')) R.pick(panels).state = 'on';
  const lit = panels.filter((p) => p.state === 'on');
  for (let k = 0; k < room.light.flicker && lit.length > 1; k++) R.pick(lit).state = 'flicker';
  return panels;
}

function dress(R, level, o, opt) {
  const { rooms, links, start, exit } = level;
  const family = R.weighted(FAMILIES, (f) => f.weight), pattern = R.pick(PATTERNS);
  const toExit = level.distances(exit);
  for (const room of rooms) {
    const rr = R.fork('dress:' + room.id);
    const odd = rr.chance(0.12);                                   // the wallpaper is different in here
    room.look = rollLook(rr, odd ? rr.weighted(FAMILIES, (f) => f.weight) : family, odd || rr.chance(0.12) ? rr.pick(PATTERNS) : pattern);
    const arch = room.arch ? ARCHETYPES[room.arch] : null;
    room.light = { dead: rr.range(0.06, 0.3), flicker: rr.chance(0.4) ? 1 : 0, power: rr.range(0.9, 1.1), mode: arch ? arch.lights : 'normal' };
    if (room.kind === 'exit') { room.light.dead = 0; room.light.flicker = 0; }
    if (room.kind === 'start') room.light.dead = Math.min(room.light.dead, 0.12);
    room.panels = layPanels(rr, room, room.light.mode);
    room.toExit = toExit.get(room.id);
    room.pillars = []; room.dress = []; room.sign = null;
    if (room.kind !== 'plain' && room.kind !== 'start') continue;

    // a lit arrow over the doorway that leads toward the way out — in some rooms
    if (room.doors.length >= 2 && rr.chance(0.5)) {
      const best = room.doors.slice().sort((p, q) => toExit.get(p.to) - toExit.get(q.to))[0];
      if (toExit.get(best.to) < room.toExit) room.sign = { door: room.doors.indexOf(best), text: rr.pick(['EXIT', 'EXIT', 'EXIT', 'WAY OUT', 'EXIT?', 'EXIT (PROBABLY)']) };
    }
    // free-standing pillars, clear of the doorways and of each other
    const near = (x, z, gap) => room.doors.some((dr) => {
      const dx = dr.side === 'left' ? -room.W / 2 : dr.side === 'right' ? room.W / 2 : dr.c, dz = dr.side === 'front' ? room.D / 2 : dr.side === 'back' ? -room.D / 2 : dr.c;
      return Math.hypot(x - dx, z - dz) < gap + dr.w / 2;
    });
    if (room.W >= 4.5 && room.D >= 4.5) {
      const wantPillars = rr.chance(0.55) ? rr.int(1, room.W * room.D > 40 ? 3 : 1) : 0;
      for (let tries = 0; tries < 12 && room.pillars.length < wantPillars; tries++) {
        const s = rr.pick([0.6, 0.6, 0.8, 1.0]), wide = rr.chance(0.3) ? rr.pick([1.6, 2.2]) : s, flip = rr.chance(0.5);
        const pw = flip ? wide : s, pd = flip ? s : wide;
        const x = Math.round(rr.range(-room.W / 2 + 1.5 + pw / 2, room.W / 2 - 1.5 - pw / 2) * 2) / 2, z = Math.round(rr.range(-room.D / 2 + 1.5 + pd / 2, room.D / 2 - 1.5 - pd / 2) * 2) / 2;
        if (near(x, z, 1.5) || room.pillars.some((p) => Math.abs(p.x - x) < (p.w + pw) / 2 + 1.3 && Math.abs(p.z - z) < (p.d + pd) / 2 + 1.3)) continue;
        if (room.kind === 'start' && Math.hypot(x, z) < 1.6) continue;
        room.pillars.push({ x, z, w: pw, d: pd });
      }
    }
    // one or two things somebody left behind
    const things = rr.chance(0.75) ? rr.int(1, room.W * room.D > 30 ? 3 : 2) : 0;
    for (let k = 0; k < things; k++) {
      const type = rr.pick(DRESSING);
      const item = { type, u: rr(), v: rr(), turn: rr.range(-Math.PI, Math.PI), n: rr.int(3, 9), seed: rr.int(1, 9999) };
      if (type === 'poster') item.text = fill(rr.pick(POSTERS), o, rr);
      if (type === 'frame') item.who = rr.int(0, 99);
      room.dress.push(item);
    }
  }
  // a floor plan on a wall, somewhere, with a red dot that is not where it should be
  const mapRooms = rooms.filter((r) => r.kind === 'plain' && r.depth >= 1);
  for (const room of R.shuffle(mapRooms).slice(0, R.int(1, 2))) room.dress.push({ type: 'map', u: R(), v: R(), turn: 0, n: 0, seed: R.int(1, 9999) });

  // something that follows you — in some visits. It sleeps in a plain room a little way in.
  let pursuer = null;
  const lairs = rooms.filter((r) => r.kind === 'plain' && r.depth >= 2 && r.W >= 3.5 && r.D >= 3.5);
  const wants = opt.pursuer === undefined ? R.chance(0.6) : !!opt.pursuer;
  if (wants && lairs.length) { const lair = R.pick(lairs); pursuer = { room: lair.id, corner: R.int(0, 3), face: R.int(0, 3) }; }

  // "it's past the water coolers": the oddity nearest the way out
  const near = level.specials.slice().sort((a, b) => toExit.get(a.id) - toExit.get(b.id))[0];
  const first = start.doors[0];
  const aim = first ? { x: first.side === 'left' ? -1 : first.side === 'right' ? 1 : 0, z: first.side === 'front' ? 1 : first.side === 'back' ? -1 : 0 } : { x: 0, z: -1 };
  return {
    pursuer,
    hint: near ? ARCHETYPES[near.arch].landmark : 'the plain rooms',
    start: { room: start.id, x: start.cx, z: start.cz, yaw: Math.atan2(-aim.x, -aim.z) },
    exit: { room: exit.id },
    intro: R.pick(INTROS),
    stamp: { year: R.int(1991, 1999), month: R.pick(MONTHS), day: R.int(1, 28), hour: R.int(0, 23), minute: R.int(0, 59) },
    hum: R.pick([50, 50, 60]),
  };
}

/**
 * One visit.
 * @param {string|number} seed
 * @param {{name?:string, projects?:string[], agents?:string[], tasks?:string[], only?:string|string[], count?:number, pursuer?:boolean}} [opt]
 * @returns {{seed, rooms, links, start, exit, pursuer, picked, hint, intro, stamp, hum}}
 */
export function generate(seed, opt = {}) {
  const o = names(opt);
  for (let attempt = 0; attempt < 40; attempt++) {
    const R = makeRng(`backrooms:${seed}:${attempt}`);
    const level = build(R, o, opt);
    if (!level) continue;
    const extra = dress(R.fork('dress'), level, o, opt);
    const rooms = level.rooms.map((r) => { const { links: _l, ...rest } = r; return rest; });
    return { seed: String(seed), name: o.name, cast: o.agents, projects: o.projects, rooms, links: level.links, picked: level.specials.map((r) => r.arch), ...extra };
  }
  throw new Error(`backrooms: no layout for seed ${seed}`);
}

/** The rooms each room opens onto. */
export function neighboursOf(level, id) { return level.rooms[id].doors.map((d) => d.to); }

/** Steps from one room to every other, through doorways. */
export function roomDistances(level, from) {
  const dist = new Map([[from, 0]]), queue = [from];
  while (queue.length) { const cur = queue.shift(); for (const n of neighboursOf(level, cur)) if (!dist.has(n)) { dist.set(n, dist.get(cur) + 1); queue.push(n); } }
  return dist;
}

/** The rooms to walk through from a to b, both included (or null). */
export function roomPath(level, a, b) {
  const prev = new Map([[a, -1]]), queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === b) { const path = []; for (let r = b; r !== -1; r = prev.get(r)) path.unshift(r); return path; }
    for (const n of neighboursOf(level, cur)) if (!prev.has(n)) { prev.set(n, cur); queue.push(n); }
  }
  return null;
}

/** A map in characters, for the console and the tests: S start, X exit, letters for oddities. */
export function sketch(level) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of level.rooms) { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); }
  const rows = Array.from({ length: z1 - z0 }, () => new Array(x1 - x0).fill(' '));
  const legend = [];
  for (const r of level.rooms) {
    const ch = r.kind === 'start' ? 'S' : r.kind === 'exit' ? 'X' : r.kind === 'plain' ? '.' : String.fromCharCode(97 + level.picked.indexOf(r.arch));
    if (r.kind === 'special') legend.push(`${ch} ${r.arch}`);
    for (let i = 0; i < r.w; i++) for (let j = 0; j < r.d; j++) rows[r.z - z0 + j][r.x - x0 + i] = (i === 0 || j === 0) && r.kind === 'plain' ? ',' : ch;
  }
  return rows.map((row) => row.join('')).join('\n') + '\n' + legend.join('  ');
}
