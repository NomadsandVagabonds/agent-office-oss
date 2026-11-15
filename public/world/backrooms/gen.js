// The Backrooms — the generator. Pure: no three.js, no DOM, nothing but a seed
// and a few names in, a plain description of one visit out. The same seed
// always builds the same level; a different seed builds a different one.
//
// A floor is a small maze of rectangular rooms on a one-metre grid. Six to
// nine of them are oddities dealt from the DECK below (and deck2.js) without
// repeats; the rest is the connective tissue — plain humming rooms and
// corridors — plus the room you land in and, as far from it as the building
// goes, the fire exit: a stairwell down to the next floor, or, on the last
// floor of a visit, the door that is different. A visit is several floors,
// one under another (plan.js); this file builds one at a time.
//
// Rooms are not all boxes: one may sit a few stairs above the next, a doorway
// may be knee-high, a plain room may have a pit, a beam to duck under, a
// ceiling that slopes, stairs to nowhere (see "heights" below).
//
// Told what is still to be found down here, it also says where the coins are
// (see "what is hidden down here", near the end); told nothing, it hides
// nothing and builds exactly the level it always did.
//
// Every room has a local frame: x across, z deep, centred on the room, and the
// doorway you are meant to arrive through is in the +z wall (the "front").
// `rot` quarter-turns that frame into the world, so the builders (rooms.js)
// never need to know which way a room ended up facing.

import { T, WALL_H, DOOR_H, TILE, RISE, RUN, SIDES, toWorld, toLocal, wallLength, wallPoint, floorAt, ceilAt, headAt, stairZones, pinchHalf, fitsAt, wallSpans } from './frame.js';
import { fill, wrap } from './words.js';
import { warningFor } from './drawings.js';
import { MORE_DECK, MORE_STASH } from './deck2.js';
import { themeOf, THEMES, atHome } from './themes.js';
import { thinPlace, decoyMarks, TAPE_LABELS, PRINT_CHANCE } from './marks.js';
import { goesDown } from './seam.js';
import { vocabulary, motif, fits, pruned, sunk, NARROW, HALLS } from './quiet.js';

// the room's own frame and the shape of its floor and ceiling are frame.js's; they have always been asked for here
export { T, WALL_H, DOOR_H, TILE, RISE, RUN, SIDES, toWorld, toLocal, wallLength, wallFrame, wallPoint, floorAt, ceilAt, headAt, stairZones, pinchHalf, fitsAt, wallSpans } from './frame.js';
const r4 = (v) => Math.round(v * 10000) / 10000;


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
  // …and three that are only ever rolled on the floors that ask for them (themes.js): gloss paint over lino, bare board over screed, panelling over a deep carpet
  { id: 'records', weight: 0, wall: [70, 0.10, 0.74], carpet: [150, 0.10, 0.36], trim: [150, 0.14, 0.22], floor: 'lino' },
  { id: 'board', weight: 0, wall: [32, 0.10, 0.78], carpet: [40, 0.05, 0.46], trim: [30, 0.06, 0.52], floor: 'screed' },
  { id: 'panel', weight: 0, wall: [26, 0.44, 0.33], carpet: [152, 0.34, 0.20], trim: [24, 0.46, 0.17], floor: 'plush' },
  // …and one for the neighbourhood (themes.js `suburb`): sky-blue emulsion, and fake grass off a roll where the carpet should be
  { id: 'sky', weight: 0, wall: [203, 0.46, 0.72], carpet: [106, 0.34, 0.37], trim: [44, 0.12, 0.88], floor: 'turf' },
  // …and one for the shopping centre (themes.js `mall`): oatmeal partition fabric, terrazzo with a brass strip, brown trim
  { id: 'oatmeal', weight: 0, wall: [36, 0.2, 0.66], carpet: [28, 0.12, 0.62], trim: [22, 0.32, 0.28], floor: 'terrazzo' },
];
const PATTERNS = ['dots', 'dots', 'dots', 'diamonds', 'stripes', 'trellis', 'sprigs', 'chevrons'];
const TUBES = ['#fff6dc', '#fff6dc', '#fffbe9', '#f3ffe6', '#ffeec4', '#eef6ff'];

function rollLook(R, family, pattern, tubes = TUBES) {
  const [wh, ws, wl] = family.wall, [ch, cs, cl] = family.carpet, [th, ts, tl] = family.trim;
  const dh = R.range(-5, 5), dl = R.range(-0.035, 0.035);
  const wall = hsl(wh + dh, ws + R.range(-0.05, 0.05), wl + dl);
  return {
    family: family.id, pattern, floor: family.floor || 'carpet',
    wall, ink: hsl(wh + dh - 4, ws + 0.08, wl + dl - R.range(0.1, 0.15)), pale: hsl(wh + dh, ws - 0.05, wl + dl + 0.07),
    carpet: hsl(ch + R.range(-6, 6), cs + R.range(-0.03, 0.03), cl + R.range(-0.03, 0.03)),
    trim: hsl(th, ts, tl + R.range(-0.02, 0.02)),
    ceil: hsl(wh, 0.14, 0.80 + R.range(-0.03, 0.02)),
    tube: R.pick(tubes),
  };
}

/* ---- words ------------------------------------------------------------------- */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/* ---- the deck ------------------------------------------------------------------
   id        what the dev page and the tests call it
   landmark  how somebody would give directions past it
   w, d      size ranges in whole metres: across the entry wall, and deep
   ports     local walls that may get one more doorway (centred), so the room can lie on a path
   lights    how the ceiling behaves: normal | dim | dark | entry | one
   roll      (R, names) → the randomised details the builder needs                       */

const STATUS = { 404: 'NOT FOUND', 403: 'FORBIDDEN', 418: 'I\'M A TEAPOT', 301: 'MOVED PERMANENTLY', 302: 'FOUND (ELSEWHERE)', 500: 'INTERNAL ERROR', 503: 'UNAVAILABLE',
  401: 'UNAUTHORIZED', 408: 'TIMED OUT', 410: 'GONE', 429: 'TOO MANY DOORS', 451: 'LEGAL REASONS', 502: 'BAD GATEWAY', 204: 'NO CONTENT', 304: 'NOT MODIFIED', 402: 'PAYMENT REQUIRED', 409: 'CONFLICT' };
const VENDING = [['LUKEWARM COFFEE', '#8a5a34'], ['ONE (1) AA BATTERY', '#c9893f'], ['LOOSE STAPLES', '#8d949c'], ['THE SAME SANDWICH', '#d8c58a'], ['WARM MILK', '#e8e2d0'], ['DECAF', '#6f5a48'],
  ['KEY CARD (NOT YOURS)', '#3f7f9a'], ['A SMALLER VENDING MACHINE', '#b5483f'], ['MEETING INVITE', '#5a6fa8'], ['CYAN TONER', '#3fb6c9'], ['EXACT CHANGE', '#b9a04a']];
const BANNERS = [
  ['HAPPY 0TH BIRTHDAY', 'WE MISSED YOU, {NAME}'], ['WELCOME BACK, {NAME}', '(YOU NEVER LEFT)'], ['CONGRATULATIONS', 'ON YOUR INCIDENT'],
  ['GOODBYE {AGENT}', 'WE WILL REPLACE YOU'], ['HAPPY WORK ANNIVERSARY', 'DAY 1'], ['SORRY FOR', 'YOUR PROMOTION'], ['MANDATORY FUN', 'ATTENDANCE IS BEING TAKEN'],
  ['IT\'S A DEPLOY!', 'HAPPY BIRTHDAY {PROJECT}'], ['{NAME}', '1 DAY WITHOUT LEAVING'], ['THANK YOU FOR', 'YOUR SERVICE REQUEST'], ['SURPRISE', 'WE KNEW YOU WERE COMING'],
];
const CAKE = ['{NAME}', '404', 'v0.0.0', 'SORRY', 'AGAIN', 'YAY?', 'Q4'];
// The way out is never closer than this many doorways from where you land (and never closer than any other room).
export const MIN_EXIT_STEPS = 10;
/** How many oddities a floor is dealt, fewest and most; and the share of its rooms that are plain, least and most. */
export const MIN_ODD = 5, MAX_ODD = 8, QUIET = Object.freeze([0.7, 0.8]);
/** The most rooms a floor is ever built of. */
export const MAX_ROOMS = 44;
const KANBAN = ['find the exit', 'fix the thing', 'ask {agent}', 'this card', 'move this card', '{name}', 'TODO', 'done?', 'reply to {agent}', 'water the plants (ceiling)'];
const KANBAN_COLS = [['TO DO', 'TO DO', 'TO DO', 'TO DO'], ['TODO', 'DOING', 'DONE', 'UNDONE'], ['BACKLOG', 'BACKLOG (OLD)', 'BACKLOG (OLDER)', 'ICEBOX'], ['SOON', 'LATER', 'NEVER', 'DONE']];
const WET = ['CAUTION|WET FLOOR', 'CAUTION|FLOOR', 'CAUTION|DRY FLOOR', 'CAUTION|CAUTION', 'CAUTION|{NAME}', 'CUIDADO|PISO', 'CAUTION|WET SIGN', 'CAUTION|SIGNS', 'CAUTION|CARPET'];
const TINY = ['STAFF ONLY', 'MEETING ROOM 0.3', 'EXIT (SMALL)', 'MANAGEMENT', 'SUPPLIES', 'DO NOT KNOCK'];
const AGENDA = ['Why are we up here', 'Gravity (carried over)', 'Action items from below', 'Who booked this room', 'Chairs: status', 'Next steps (there are no steps)', 'AOB', 'See item 1', 'Minutes: falling', 'Hard stop'];
const POOL_SIGNS = ['NO DIVING', 'NO RUNNING · NO DIVING · NO DEADLINES', 'LIFEGUARD OFF DUTY SINCE 1997', 'SHALLOW END 0.9m · DEEP END Q4', 'PLEASE SQUEEZE RESPONSIBLY'];
const FLOORS = ['9', '8', '7', '6', '5', '4', '3½', '3', 'π', '2', '1', '0', '-1', 'B', 'G', '13', 'M', '?'];
const LIFT_SIGNS = ['LIFT', 'ELEVATOR', 'LIFT (IN ORDER)', 'GOODS LIFT', 'LIFT B'];
const PLATES = ['for attendance', 'for remaining calm', 'for the incident', 'for not asking', 'for staying late (ongoing)', 'for finding the stapler', 'for replying all', 'for outstanding humming', 'for closing the ticket', 'for being here'];
const ODD_MONTHS = ['FEBRUARY', 'FEBRUARY', 'SMARCH', 'MONTH 13', 'LATE JUNE', 'THE SAME MONTH', 'NOVEMBER (AGAIN)'];
const CORNER_THINGS = ['nothing', 'cup', 'plant', 'crt', 'sign', 'phone'];
const SLIDES = ['ANY QUESTIONS?', 'THANK YOU FOR COMING, {NAME}', 'Q & A', 'SLIDE 1 OF 1', 'AGENDA: {NAME}', 'IN SUMMARY'];
const EXHIBITS = [['mouse', 'MOUSE', 'ball missing since the merger'], ['keyboard', 'KEYBOARD', 'the E has gone'], ['mug', 'MUG', 'not yours'], ['desklamp', 'DESK LAMP', 'saw everything'],
  ['crt', 'MONITOR', 'still warm'], ['stapler', 'STAPLER', 'on loan from {agent}'], ['chair', 'THE GOOD CHAIR', 'do not sit'], ['plant', 'PLANT', 'watered once, by {agent}'],
  ['bin', 'RECYCLING', 'contains the roadmap'], ['empty', 'WORK-LIFE BALANCE', 'on loan'], ['empty', 'THE DEADLINE', 'removed for cleaning'], ['empty', '{PROJECT} DOCS', 'artist\'s impression'],
  ['paper', 'A PRINTED EMAIL', 'reply-all, c. 1998'], ['empty', 'INBOX ZERO', 'never exhibited']];
const WINGS = ['THE {PROJECT} WING', 'MUSEUM OF {PROJECT}', 'THE {AGENT} BEQUEST', 'GALLERY 0'];
const PHOTO = [['TEAM PHOTO', 'EVERYBODY LOOK NATURAL'], ['{PROJECT} OFFSITE', '(ON SITE)'], ['COMPANY PHOTO', 'PLEASE REMAIN STILL'], ['SMILE', 'IT IS MANDATORY'], ['TEAM PHOTO', 'RETAKE 4,112'], ['FAMILY PORTRAIT', '{PROJECT}']];
const SUBROOMS = [['{P}', '{P} (SUBCOMMITTEE)', 'TASK FORCE'], ['MEETING ROOM 1', 'MEETING ROOM 1A', '1A (i)'], ['BREAKOUT ROOM', 'BREAKOUT ROOM (SMALL)', 'PERSONAL'], ['ALL HANDS', 'SOME HANDS', 'ONE HAND']];
const CHAIR_COLORS = ['#4a7a6a', '#b5483f', '#3f7f9a', '#8a5a8f', '#c9893f', '#5a5a66', '#6f8a4a'];

const DECK1 = [
  { id: 'cutouts', name: 'The Standees', landmark: 'the cardboard people', w: [7, 10], d: [7, 10], ports: ['back', 'left', 'right'], weight: 2.2, lights: 'normal', teaches: 'unwatched',
    roll: (R, o) => ({ count: R.int(4, 7), who: R.shuffle(o.agents.map((_, i) => i)), formation: R.pick(['scatter', 'scatter', 'queue', 'ring', 'wall', 'crowd']),
      follower: R.chance(0.4), self: R.chance(0.35), boxes: R.int(1, 3), papers: R.int(4, 10) }) },
  { id: 'ceiling-meeting', name: 'Standing Meeting', landmark: 'the meeting on the ceiling', w: [7, 9], d: [6, 8], ports: ['back', 'left', 'right'], weight: 1.4, lights: 'normal',
    roll: (R) => ({ chairs: R.int(4, 8), color: R.pick(CHAIR_COLORS), agenda: R.some(AGENDA, 3), stray: R.chance(0.6), mugs: R.int(1, 4) }) },
  { id: 'coolers', name: 'Hydration Corridor', landmark: 'the water coolers', w: [3, 4], d: [15, 19], ports: [], weight: 1.3, lights: 'entry',
    roll: (R) => { const lit = R.int(5, 7); return { lit, bubbling: R.int(1, lit - 1), both: R.chance(0.35), spacing: R.pick([1.2, 1.4, 1.6]) }; } },
  { id: 'stress-pool', name: 'The Stress Pool', landmark: 'the ball pit', w: [8, 11], d: [8, 11], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R) => ({ fill: R.pick(['balls', 'balls', 'peanuts', 'shreds']), hues: R.some([4, 28, 48, 130, 200, 265, 330], R.int(2, 5)), sign: R.pick(POOL_SIGNS), tiles: R.pick(['#9fc4c9', '#c9bfa0', '#a8b4cf', '#b9d0b0']) }) },
  { id: 'keyboard-floor', name: 'Input Device', landmark: 'the big keyboard', w: [11, 11], d: [7, 8], ports: ['left', 'right'], weight: 1.2, lights: 'dim',
    roll: (R, o) => ({ layout: R.pick(['qwerty', 'qwerty', 'qwerty', 'scrambled', 'azerty']), prompt: R.pick(['C:\\>', '$', '>>>', '>', 'READY.']), keys: R.pick(['beige', 'beige', 'dark', 'grey']),
      phosphor: R.pick(['#6fe08a', '#ffb44a', '#d8e6f0']), name: o.name }) },
  { id: 'tiny-door', name: 'Perspective', landmark: 'the corridor that gets smaller', w: [3, 3], d: [9, 12], ports: [], weight: 1.1, lights: 'normal',
    roll: (R) => ({ sign: R.pick(TINY), door: R.pick(['#7a4a2a', '#3f6a5a', '#8a3a34', '#3a4a6a']), taper: R.range(0.2, 0.3) }) },
  { id: 'many-doors', name: 'Status Codes', landmark: 'the room of doors', w: [7, 9], d: [7, 9], ports: [], doored: true, weight: 1.5, lights: 'normal',
    roll: (R) => { const side = R.pick(['back', 'left', 'right']); const per = R.int(3, 4);
      const codes = R.shuffle(Object.keys(STATUS)).slice(0, per * 3).map((code) => ({ code, words: STATUS[code] }));
      return { per, side, slot: R.int(0, per - 1), codes, color: R.pick(['#7a5a3a', '#5a6a7a', '#6a4a3a', '#4a6a5a']) }; } },
  { id: 'vending', name: 'Refreshments', landmark: 'the vending machines', w: [5, 6], d: [9, 13], ports: ['back'], weight: 1.3, lights: 'dark',
    roll: (R) => { const [item, color] = R.pick(VENDING); return { item, color, price: R.pick(['0.37', '1.00', 'EXACT', 'FREE', '9.99', '0.00']), both: R.chance(0.6), glow: R.pick(['#bfe8ff', '#ffd9a0', '#c8ffd0', '#ffc8e0']) }; } },
  { id: 'ceiling-plants', name: 'Hanging Garden', landmark: 'the plants in the ceiling', w: [6, 9], d: [6, 9], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R) => ({ count: R.int(7, 13), vines: R.int(8, 16), leaves: R.int(10, 24), can: R.chance(0.7) }) },
  { id: 'phone', name: 'It\'s For You', landmark: 'the phone on the floor', w: [9, 12], d: [9, 12], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'dim',
    roll: (R) => ({ color: R.pick(['#b5483f', '#d8cdb8', '#2b2b33', '#3f8a72']), at: [R.range(-0.2, 0.2), R.range(-0.25, 0.1)] }) },
  { id: 'party', name: 'The Party', landmark: 'the party', w: [7, 9], d: [7, 9], ports: ['left', 'right'], weight: 2.2, lights: 'normal',
    roll: (R, o) => ({ banner: R.pick(BANNERS).map((t) => fill(t, o, R)), cake: fill(R.pick(CAKE), o, R).toUpperCase().slice(0, 9), candles: R.pick([0, 1, 3, 40]), chairs: R.int(4, 6), balloons: R.int(5, 9),
      flags: R.some(['#d8493f', '#e8e2d0', '#3f8a72', '#e8b33c', '#5a6fa8', '#e87aae'], 3), hats: R.chance(0.7), guests: R.shuffle(o.agents.map((_, i) => i)).slice(0, R.int(0, 2)) }) },
  { id: 'chairs', name: 'Seating Plan', landmark: 'all the chairs', w: [8, 10], d: [8, 10], ports: ['left', 'right'], weight: 1.5, lights: 'normal',
    roll: (R, o) => ({ variant: R.pick(['corner', 'corner', 'arch', 'audience', 'ring']), count: R.int(18, 30), color: R.pick(CHAIR_COLORS), odd: R.chance(0.5) ? R.pick(CHAIR_COLORS) : null, corner: R.pick([-1, 1]), thing: R.pick(CORNER_THINGS), slide: fill(R.pick(SLIDES), o, R) }) },
  { id: 'wet-floor', name: 'Caution', landmark: 'the wet floor signs', w: [7, 9], d: [7, 9], ports: ['back', 'left', 'right'], weight: 1.3, lights: 'normal',
    roll: (R, o) => ({ count: R.int(26, 44), pattern: R.pick(['grid', 'spiral', 'crowd', 'rows']), texts: R.shuffle(WET).slice(0, 4).map((t) => fill(t, o, R)), puddle: [R.range(-0.2, 0.2), R.range(-0.2, 0.2)] }) },
  { id: 'hall-of-fame', name: 'Employee of the Month', landmark: 'the portraits', w: [3, 4], d: [10, 14], ports: ['back'], weight: 1.4, lights: 'normal',
    roll: (R, o) => { const n = R.int(6, 10); const month = R.pick(ODD_MONTHS);
      return { month, frames: Array.from({ length: n }, (_, i) => ({ who: i % Math.max(1, o.agents.length), plate: R.pick(PLATES) })), order: R.shuffle(o.agents.map((_, i) => i)), last: R.pick(['empty', 'you', 'mirror']), wood: R.pick(['#6a4a2a', '#2b2b33', '#b89a5a']) }; } },
  { id: 'kanban', name: 'The Board', landmark: 'the board with one card', w: [8, 10], d: [6, 7], ports: ['left', 'right'], weight: 1.3, lights: 'normal',
    module: './rooms/kanban.js', stash: (r) => [-r.W / 2 + 1.2, -r.D / 2 + 0.7, -0.6, -r.D / 2 + 1.25],            // under the board, with the cards that fell off it
    roll: (R, o) => ({ text: o.tasks.length && R.chance(0.6) ? R.pick(o.tasks) : fill(R.pick(KANBAN), o, R), cols: R.pick(KANBAN_COLS), cards: R.int(44, 70), spill: R.int(14, 34), notes: R.some(['#f2d45c', '#f29a8c', '#9fd6a0', '#9cc4ea', '#e6b0e0'], R.int(1, 3)) }) },
  { id: 'lift', name: 'Going Up', landmark: 'the lift', w: [5, 7], d: [4, 5], ports: [], weight: 1.2, lights: 'normal',
    roll: (R, o) => ({ sign: R.pick(LIFT_SIGNS), floors: R.shuffle(FLOORS).slice(0, 7), behind: R.shuffle(['bricks', 'bricks', 'cutout', 'poster', 'bricks']), who: R.int(0, Math.max(0, o.agents.length - 1)), doors: R.pick(['#8d949c', '#b0a58a', '#7a8a9a']) }) },
  { id: 'museum', name: 'The Collection', landmark: 'the museum', w: [8, 9], d: [7, 8], ports: ['left', 'right'], weight: 1.6, lights: 'normal',
    roll: (R, o) => ({ wing: fill(R.pick(WINGS), o, R).toUpperCase(), rope: R.pick(['#8a2a2a', '#2a4a7a', '#6a2a6a']),
      items: R.shuffle(EXHIBITS).slice(0, 6).map(([type, title, note]) => ({ type, title: fill(title, o, R), note: fill(note, o, R) })) }) },
  { id: 'photo', name: 'Team Photo', landmark: 'the team photo', w: [7, 8], d: [7, 9], ports: ['left', 'right'], weight: 1.6, lights: 'normal',
    roll: (R, o) => ({ banner: R.pick(PHOTO).map((t) => fill(t, o, R)), who: R.shuffle(o.agents.map((_, i) => i)), back: R.int(4, 5), front: R.pick([4, 6]), drop: R.pick(['#5d7a9a', '#7a6a8a', '#6a8a7a', '#8a8478']) }) },
  { id: 'nested', name: 'Breakout Rooms', landmark: 'the room inside the room', w: [8, 9], d: [8, 9], ports: ['left', 'right', 'back'], weight: 1.5, lights: 'normal',
    roll: (R, o) => { const pr = R.pick(o.projects).toUpperCase(); return { turn: R.int(0, 3), z: R.range(-0.25, 0.1), plates: R.pick(SUBROOMS).map((t) => t.replace(/\{P\}/g, pr)) }; } },
];
// (an entry with `on: false` has been retired: it is not in the deck, and nothing else needs to know)
export const DECK = [...DECK1, ...MORE_DECK].filter((a) => a.on !== false);
export const ARCHETYPES = Object.fromEntries(DECK.map((a) => [a.id, a]));

// Nothing down here is ever explained, so the only teacher is the order things are met in. A deck entry says what its
// room is the first place to learn (`teaches`: one thing, at most) and what it takes for granted (`needs`); the visit's
// plan (plan.js) keeps count of what the floors above have taught, and a room is only dealt where all it needs is known.
const list = (v) => (v === undefined || v === null ? [] : [].concat(v));
/**
 * What there is to learn down here so far, by id. A room that is the first place to learn one says so (`teaches`), and a
 * room that takes one for granted says that (`needs`). A new lesson is a line here, and a room that teaches it.
 */
export const LESSONS = Object.freeze({
  lean: 'a stretch of wall that somebody has marked may give, if it is leaned on for as long as it takes (known from the start: it is how you got in)',
  unwatched: 'some things only move while nobody is looking at them',
  overhead: 'what hangs from the ceiling comes down on whoever walks under it',
  offering: 'somebody who is coming for you may take what you are carrying instead',
  belonging: 'carry what they are carrying and you are one of them',
  beam: 'some things stop where a light is pointed at them',
  pace: 'some things only mind how fast you are going',
  tape: 'a tape deck plays you back: where you stood, and where you were looking',
  pointed: 'something in a room may tell you which doorway is nearer the way down, if you work it',
});
/** Is this archetype a set piece — a room with a view (`halo`), or one that says so (`big`)? A floor has one at most. */
export const isBig = (arch) => !!(arch && (arch.big || arch.halo));
/** What a room of this archetype teaches, and what it needs to have been taught already: lists of lesson ids. */
export const lessons = (arch) => ({ teaches: list(arch && arch.teaches), needs: list(arch && arch.needs) });
/** May this archetype be dealt to somebody who knows `known` (a Set of lesson ids; null: a floor asked for by itself, where anything goes)? */
export const ready = (arch, known) => !known || lessons(arch).needs.every((n) => known.has(n));
/** Everything a floor's rooms teach. */
export const lessonsOf = (level) => [...new Set(level.picked.flatMap((id) => lessons(ARCHETYPES[id]).teaches))];

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
const HALO = -1;                                     // who has a cell of plan that is only being kept empty
export const EXIT_DEPTH = 7;                         // how deep the stairwell is on the plan, metres
const MARGIN = 0.5;                                  // a doorway stays this far from a room's corner
const cellKey = (x, z) => x * 4096 + z;
const inRect = (p, r, m) => p.x > r.x0 - m && p.x < r.x1 + m && p.z > r.z0 - m && p.z < r.z1 + m;
const overlaps = (a, b, m) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
const plain = (r) => r.kind === 'plain' || r.kind === 'start';

function build(R, o, opt) {
  const rooms = [], links = [], taken = new Map(), theme = themeOf(opt.theme);
  const fits = (x, z, w, d, halo) => {
    if (Math.abs(x) > 400 || Math.abs(z) > 400) return false;
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (taken.has(cellKey(x + i, z + j))) return false;
    if (halo) for (let i = halo.x0; i < halo.x1; i++) for (let j = halo.z0; j < halo.z1; j++) if (taken.has(cellKey(i, j))) return false;
    return true;
  };
  function addRoom(spec, x, z, w, d, rot, halo) {
    const room = { id: rooms.length, kind: spec.kind, arch: spec.arch || null, x, z, w, d, rot, y: 0, H: spec.H || WALL_H, crawl: !!spec.crawl,
      cx: x + w / 2, cz: z + d / 2, W: (rot % 2 ? d : w) - T, D: (rot % 2 ? w : d) - T, doors: [], links: [], pts: [], stairs: [] };
    rooms.push(room);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) taken.set(cellKey(x + i, z + j), room.id);
    // the floor plan behind a room with a view is spoken for: nothing else is ever built there (HALO: no room has that number)
    if (halo) { room.halo = halo; for (let i = halo.x0; i < halo.x1; i++) for (let j = halo.z0; j < halo.z1; j++) if (!taken.has(cellKey(i, j))) taken.set(cellKey(i, j), HALO); }
    return room;
  }
  /** The plan a room with a view keeps empty: `back` metres beyond its far wall and `side` metres either side, from `lip` metres in. */
  const haloOf = (h, side, x, z, w, d) => (side === 0 ? { x0: x - h.side, x1: x + w + h.side, z0: z + h.lip, z1: z + d + h.back }
    : side === 2 ? { x0: x - h.side, x1: x + w + h.side, z0: z - h.back, z1: z + d - h.lip }
      : side === 1 ? { x0: x + h.lip, x1: x + w + h.back, z0: z - h.side, z1: z + d + h.side }
        : { x0: x - h.back, x1: x + w - h.lip, z0: z - h.side, z1: z + d + h.side });
  /** The point a little way inside `room` from the middle of a doorway. */
  const inner = (room, link, inset) => {
    const mid = (link.from + link.to) / 2;
    if (link.axis === 'x') return { x: link.at + (room.x === link.at ? inset : -inset), z: mid };
    return { x: mid, z: link.at + (room.z === link.at ? inset : -inset) };
  };
  function addLink(a, b, axis, at, from, to, extra) {
    const link = { id: links.length, a: a.id, b: b.id, axis, at, from, to, door: false, kind: 'door', ...extra };
    links.push(link);
    for (const r of [a, b]) { r.links.push(link.id); r.pts.push({ link: link.id, ...inner(r, link, 0.7) }); }
    return link;
  }
  function dropLink() {
    const link = links.pop();
    for (const r of [rooms[link.a], rooms[link.b]]) if (r) { r.links = r.links.filter((id) => id !== link.id); r.pts = r.pts.filter((p) => p.link !== link.id); r.stairs = r.stairs.filter((s) => s.link !== link.id); }
    return link;
  }
  /**
   * Put a new room against one wall of `anchor`, joined by a doorway.
   * spec: { kind, arch, lw, ld, dw, centred, fixed:{from,to}, H, door, crawl }
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
    const wall = side === 0 ? anchor.z + anchor.d : side === 2 ? anchor.z : side === 1 ? anchor.x + anchor.w : anchor.x;
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
      // never open a doorway onto the side of somebody else's stairs
      const mid = (from + to) / 2, p = alongX ? { x: mid, z: wall - DZ[side] * 0.7 } : { x: wall - DX[side] * 0.7, z: mid };
      if (anchor.stairs.some((s) => inRect(p, s, 0.5))) continue;
      options.push({ at, from, to });
    }
    for (const c of R.shuffle(options)) {
      const x = alongX ? c.at : fixed, z = alongX ? fixed : c.at;
      // (a halo is checked with the room's own cells still free, and they lie inside it: so those are skipped)
      let halo = null;
      if (spec.halo) { halo = haloOf(spec.halo, side, x, z, w, d); let clear = true; for (let i = halo.x0; clear && i < halo.x1; i++) for (let j = halo.z0; j < halo.z1; j++) if (taken.has(cellKey(i, j))) { clear = false; break; } if (!clear) continue; }
      if (!fits(x, z, w, d)) continue;
      const room = addRoom(spec, x, z, w, d, spec.kind === 'plain' ? 0 : rot, halo);
      room.y = anchor.y;
      addLink(anchor, room, alongX ? 'z' : 'x', wall, c.from, c.to, spec.door ? { door: true } : null);
      return room;
    }
    return null;
  }
  /** Take back the room that was added last (it turned out nothing could hang off it). */
  function undo(room) {
    dropLink();
    rooms.pop();
    for (let i = 0; i < room.w; i++) for (let j = 0; j < room.d; j++) taken.delete(cellKey(room.x + i, room.z + j));
  }
  /** Could `lower` hold a flight of n stairs up to this doorway? If so, the floor space is now spoken for. */
  function flight(lower, link, n) {
    if (n <= 0) return true;
    if (!plain(lower) || lower.crawl) return false;
    const run = (n - 1) * RUN, sgn = (link.axis === 'x' ? lower.x === link.at : lower.z === link.at) ? 1 : -1;
    if ((link.axis === 'x' ? lower.w : lower.d) - T < run + 1.5) return false;
    const a = link.at, b = link.at + sgn * (T / 2 + run);
    const rect = link.axis === 'x' ? { x0: Math.min(a, b), x1: Math.max(a, b), z0: link.from, z1: link.to } : { x0: link.from, x1: link.to, z0: Math.min(a, b), z1: Math.max(a, b) };
    if (lower.pts.some((p) => p.link !== link.id && inRect(p, rect, 0.5))) return false;
    if (lower.stairs.some((s) => overlaps(s, rect, 0.3))) return false;
    lower.stairs.push({ link: link.id, ...rect });
    lower.H = Math.max(lower.H, r4(n * RISE + 1.95));
    return true;
  }
  /** Lift the room just attached n risers above its anchor (below, if n is negative) — if the stairs fit. */
  function step(anchor, room, n) {
    if (!n || anchor.crawl || room.crawl || Math.abs(anchor.y + n * RISE) > 2.7) return;
    if (flight(n > 0 ? anchor : room, links[links.length - 1], Math.abs(n))) room.y = r4(anchor.y + n * RISE);
  }
  const anyStep = () => (R.chance(0.24) ? R.pick([1, 2, 2, 4, 4, 6, 8]) * R.pick([-1, 1]) : 0);
  const cut = theme.rooms || [0.09, 0.28, 0.44, 0.84], tall = theme.heights || [[2.6, 60], [2.2, 9], [2.9, 9], [3.3, 9], [4.4, 5], [1.75, 6]];
  // The plain rooms of a floor come in a few sizes only, rolled once for the floor: two of each kind (corridor one way,
  // corridor the other, room, hall), the first far more often than the second, two ceiling heights and two widths of
  // doorway. So most of them are the same few rooms over and over, and the eye has nothing to go on (quiet.js lays them out).
  const PS = R.fork('sizes');
  const two = (f) => { const a = f(); let b = f(); for (let k = 0; k < 6 && b.join() === a.join(); k++) b = f(); return [a, b]; };
  const sizes = { crawl: two(() => [2, PS.int(3, 5)]), cx: two(() => [PS.int(2, 3), PS.int(4, 7)]), cz: two(() => [PS.int(5, 8), PS.int(2, 3)]),
    room: two(() => [PS.int(4, 6), PS.int(4, 6)]), hall: two(() => [PS.int(7, 9), PS.int(6, 8)]) };
  const heights = [PS.weighted(tall.filter((k) => k[0] >= 2.2), (k) => k[1])[0], PS.weighted(tall, (k) => k[1])[0]], widths = [PS.pick([1.5, 2, 2, 2.5]), PS.pick([1.5, 2, 2.5])];
  const plainSpec = () => {
    const roll = R(), which = R.chance(0.7) ? 0 : 1;
    if (roll < cut[0]) { const [lw, ld] = sizes.crawl[which]; return { kind: 'plain', lw, ld, dw: 1.2, H: 0.95, crawl: true }; }          // a crawl space
    const [lw, ld] = sizes[roll < cut[1] ? 'cx' : roll < cut[2] ? 'cz' : roll < cut[3] ? 'room' : 'hall'][which];
    return { kind: 'plain', lw, ld, dw: widths[R.chance(0.7) ? 0 : 1], H: heights[R.chance(0.78) ? 0 : 1] };
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
  // (a part of a visit is told exactly which oddities it has — `hand`, plan.js: a visit shows part of the deck, and no
  // room twice — and how many rooms it is to be; a floor asked for by itself deals its own, five to eight of them)
  const hand = Array.isArray(opt.hand) ? opt.hand.map((id) => ARCHETYPES[id]).filter(Boolean) : null;
  const want = hand ? Math.max(1, hand.length) : opt.count || R.int(MIN_ODD, MAX_ODD);
  let deck = [];
  // (a room that is only ever there because the visit's plan asked for it — `planned`, or one staged from the news — is
  // never dealt by chance; nor is one that takes for granted something the floors above have not taught)
  const known = opt.known ? new Set(opt.known) : null;
  // (…nor one that is not at home on this kind of floor: themes.js atHome. `able`: how many are, which on a kind of floor
  // that keeps to its own may be very few: a floor is not held to more oddities than there are for it)
  let able = Infinity;
  if (hand) deck = hand.slice();
  else { const pool = DECK.filter((a) => !a.planned && !a.headline && ready(a, known) && atHome(a, theme.id) > 0); able = pool.length; while (pool.length) { const pickd = R.weighted(pool, (a) => a.weight * atHome(a, theme.id)); deck.push(pickd); pool.splice(pool.indexOf(pickd), 1); } }
  if (opt.only) { const forced = [].concat(opt.only).map((id) => ARCHETYPES[id]).filter(Boolean); deck = [...forced, ...deck.filter((a) => !forced.includes(a))]; }
  // a floor further down keeps clear of what the floors above it had, for as long as the deck lasts…
  if (opt.avoid && opt.avoid.length) { const had = new Set(opt.avoid); deck = [...deck.filter((a) => !had.has(a.id)), ...deck.filter((a) => had.has(a.id))]; }
  // …and may insist on a room of its own, somewhere among the ones it would have had anyway
  const must = [].concat(opt.must || []).map((id) => ARCHETYPES[id]).filter(Boolean);
  if (must.length) { deck = deck.filter((a) => !must.includes(a)); for (const a of must) deck.splice(R.int(0, Math.min(want - 1, deck.length)), 0, a); }
  // A room the way out is through (`gate`: deck2.js) is not dealt with the others. It goes in last of all, with the
  // lobby and the fire exit hung off it and off nothing else, so that there is no way to them but through it.
  const gate = deck.find((a) => a.gate) || null;
  if (gate) deck = deck.filter((a) => a !== gate);
  /** Is this the room a building was asked for by name (`only`), which is put where you land? */
  const byStart = (arch) => !!opt.only && [].concat(opt.only).includes(arch.id);

  const sides = () => R.shuffle([0, 1, 2, 3]);
  function connector(from) {                 // a plain room off a hub or a port
    for (let tries = 0; tries < 6; tries++) {
      const spec = plainSpec();
      if (from.local) {
        const dw = Math.min(spec.crawl ? 1.2 : 1.8, wallLength(from.room, from.local) - 1.2);
        const made = attach(from.room, worldSide(from.room, from.local), { ...spec, dw, fixed: portSpan(from.room, from.local, 0, dw) });
        if (made) { if (R.chance(0.2)) step(from.room, made, -R.pick([2, 4])); return made; }      // sometimes the oddity is up a few stairs
      } else for (const side of sides()) { const made = attach(from, side, spec); if (made) { step(from, made, anyStep()); return made; } }
    }
    return null;
  }
  /** A run of up to n plain rooms, one opening into the next, from a hub or a port → the rooms made (none: nothing would go). */
  function run(from, n) {
    const made = [];
    for (let at = from; made.length < n;) { const r = connector(at); if (!r) break; made.push(r); at = r; }
    return made;
  }
  /** How few doorways it is from a room to the nearest oddity (up to `most`; more than that is most + 1). */
  function toOdd(room, most) {
    const seen = new Set([room.id]); let edge = [room];
    for (let d = 1; d <= most; d++) {
      const next = [];
      for (const r of edge) for (const id of r.links) { const l = links[id], o = rooms[l.a === r.id ? l.b : l.a]; if (seen.has(o.id)) continue; if (o.kind === 'special') return d; seen.add(o.id); next.push(o); }
      edge = next;
    }
    return most + 1;
  }
  // Between one oddity and the next there are usually two or three plain rooms, often more: the way from one thing to the
  // next is long enough to forget which way you came.
  const runLength = () => R.weighted([[1, 1], [2, 5], [3, 3]], (k) => k[1])[0];
  function placeSpecial(arch, first) {
    const lw = R.int(arch.w[0], arch.w[1]), ld = R.int(arch.d[0], arch.d[1]);
    const spec = { kind: 'special', arch: arch.id, lw, ld, dw: arch.door || 1.8, centred: true, H: arch.h ? Math.round(R.range(arch.h[0], arch.h[1]) * 10) / 10 : WALL_H, halo: arch.halo || null };
    for (let tries = 0; tries < 14; tries++) {
      // where to grow from: usually the newest part of the maze, sometimes an older room (a branch)
      let hub = null, fresh = [], port = null;
      const openPorts = ports.filter((p) => !p.used);
      if (first && byStart(arch)) hub = start;
      else if (openPorts.length && R.chance(0.5)) {
        port = R.chance(0.7) ? openPorts[openPorts.length - 1] : R.pick(openPorts);
        fresh = run(port, 1);
        if (fresh.length) fresh.push(...run(fresh[0], runLength() - 1));
      } else {
        const base = R.chance(0.55) ? hubs[hubs.length - 1] : R.pick(hubs.filter((h) => !h.crawl));
        // (an oddity may hang straight off an old room only where that room is a long way from every other oddity)
        if (base !== start && base.links.length < 3 && !base.crawl && R.chance(0.4) && toOdd(base, 2) > 2) hub = base;
        else fresh = run(base, runLength());
      }
      if (fresh.length) hub = fresh[fresh.length - 1];
      if (!hub) continue;
      for (const side of sides()) {
        const room = attach(hub, side, spec);
        if (!room) continue;
        room.name = arch.name;
        if (!(first && byStart(arch)) && R.chance(0.18)) step(hub, room, R.pick([2, 4, 4]));
        hubs.push(...fresh);
        if (port) port.used = true;
        for (const local of arch.ports) if (wallLength(room, local) >= 3.2) ports.push({ room, local });
        return room;
      }
      for (const r of fresh.reverse()) undo(r);
    }
    return null;
  }
  for (const arch of deck) {
    if (specials.length >= want - (gate ? 1 : 0)) break;
    if (isBig(arch) && specials.some((r) => isBig(ARCHETYPES[r.arch]))) continue;      // one set piece to a floor — a room with a view, or one that says it is `big`: it is the landmark
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
        if (!best || score > best.score) best = { from, score, spec, x: made.x, z: made.z, w: made.w, d: made.d, axis: link.axis, at: link.at, lo: link.from, hi: link.to };
        undo(made);
        break;
      }
    }
    if (!best || !best.score) return null;
    const room = addRoom(best.spec, best.x, best.z, best.w, best.d, 0);
    room.y = best.from.y;
    addLink(best.from, room, best.axis, best.at, best.lo, best.hi);
    step(best.from, room, anyStep());
    return room;
  }
  // Most of a floor is plain: between QUIET[0] and QUIET[1] of its rooms (the fire exit, which goes in last, among them).
  // What is still missing is made up with more of the same — side passages, dead ends that go on for a while, rooms that
  // close a loop and bring you back somewhere that looks like somewhere you have been.
  // (A floor asked for by itself, on a kind that keeps to its own and has fewer rooms made for it yet than a floor has
  // oddities, is still a floor's length: eighteen rooms. Nobody else's is touched: every other kind has five and more.)
  const sparse = !hand && able < MIN_ODD ? 17 : 0;
  const target = Math.min(MAX_ROOMS - 1, Math.max((opt.rooms | 0) - 1, sparse, Math.ceil(specials.length / (1 - R.range(QUIET[0] + 0.02, QUIET[1]))) - 1));
  for (let guard = 0; rooms.length < target && guard < 200; guard++) {
    const open = ports.filter((p) => !p.used);
    // (a part with few oddities in it is mostly this: it grows on from its newest room as often as not, so that it is long as well as wide)
    const from = hand && R.chance(0.5) ? hubs[hubs.length - 1] : open.length && R.chance(0.3) ? R.pick(open) : R.pick(hubs);
    let made = !from.local && R.chance(0.45) ? bridge() : null;
    if (made) { hubs.push(made); continue; }
    // (now and then a dead end that is a run of rooms, not one)
    const line = from.local ? run(from, 1) : run(from, R.chance(0.3) ? Math.min(2, target - rooms.length) : 1);
    if (!line.length) continue;
    if (from.local && line[0].links.some((id) => links[id].a === from.room.id)) from.used = true;
    hubs.push(...line);
  }

  /* how far everything is from where you land */
  const neighbours = (room) => room.links.map((id) => { const l = links[id]; return rooms[l.a === room.id ? l.b : l.a]; });
  const distances = (from) => {
    const dist = new Map([[from.id, 0]]), queue = [from];
    while (queue.length) { const cur = queue.shift(); for (const n of neighbours(cur)) if (!dist.has(n.id)) { dist.set(n.id, dist.get(cur.id) + 1); queue.push(n); } }
    return dist;
  };
  let depth = distances(start);

  /* a couple of extra doorways between plain rooms that happen to share a wall: loops */
  const sill = (link) => Math.round(Math.abs(rooms[link.a].y - rooms[link.b].y) / RISE);
  const lowerOf = (link) => (rooms[link.a].y <= rooms[link.b].y ? rooms[link.a] : rooms[link.b]);
  const shared = [];
  for (const a of rooms) for (const b of rooms) {
    if (a.id >= b.id || !plain(a) || !plain(b) || a.crawl || b.crawl || a.links.some((id) => links[id].a === b.id || links[id].b === b.id)) continue;
    if (a.x + a.w === b.x || b.x + b.w === a.x) {
      const lo = Math.max(a.z, b.z) + MARGIN, hi = Math.min(a.z + a.d, b.z + b.d) - MARGIN;
      if (hi - lo >= 1.5) shared.push({ a, b, axis: 'x', at: a.x + a.w === b.x ? b.x : a.x, lo, hi });
    } else if (a.z + a.d === b.z || b.z + b.d === a.z) {
      const lo = Math.max(a.x, b.x) + MARGIN, hi = Math.min(a.x + a.w, b.x + b.w) - MARGIN;
      if (hi - lo >= 1.5) shared.push({ a, b, axis: 'z', at: a.z + a.d === b.z ? b.z : a.z, lo, hi });
    }
  }
  let loops = 0;
  const LOOPS = 3 + Math.floor(rooms.length / 12);
  const clearOfStairs = (link) => [rooms[link.a], rooms[link.b]].every((r) => !r.stairs.some((s) => s.link !== link.id && inRect(inner(r, link, 0.7), s, 0.5)));
  for (const s of R.shuffle(shared)) {
    if (loops >= LOOPS || !R.chance(0.7)) continue;
    const dw = Math.min(R.pick([1.5, 2, 2.5]), s.hi - s.lo);
    const from = Math.min(s.lo + Math.round(R() * (s.hi - s.lo - dw) * 2) / 2, s.hi - dw);
    const link = addLink(s.a, s.b, s.axis, s.at, from, from + dw);
    if (clearOfStairs(link) && flight(lowerOf(link), link, sill(link))) loops++; else dropLink();
  }
  // …and an oddity's spare wall that happens to back onto a plain room gets a doorway too
  for (const port of R.shuffle(ports.filter((p) => !p.used))) {
    if (loops >= LOOPS + 1 || !R.chance(0.6)) continue;
    const side = worldSide(port.room, port.local), dw = Math.min(1.6, wallLength(port.room, port.local) - 1.2);
    const span = portSpan(port.room, port.local, 0, dw), r = port.room;
    const wall = side === 0 ? r.z + r.d : side === 2 ? r.z : side === 1 ? r.x + r.w : r.x;
    const beyond = side === 0 ? wall : side === 2 ? wall - 1 : side === 1 ? wall : wall - 1;
    const ids = new Set();
    for (let v = Math.floor(span.from); v < Math.ceil(span.to); v++) ids.add(taken.get(side % 2 === 0 ? cellKey(v, beyond) : cellKey(beyond, v)));
    const other = ids.size === 1 ? rooms[[...ids][0]] : null;
    if (!other || !plain(other) || other.crawl || other.y > r.y + 1e-6 || r.links.some((id) => links[id].a === other.id || links[id].b === other.id)) continue;
    const lo = side % 2 === 0 ? other.x : other.z, hi = lo + (side % 2 === 0 ? other.w : other.d);
    if (span.from < lo + 0.3 || span.to > hi - 0.3) continue;
    const link = addLink(r, other, side % 2 === 0 ? 'z' : 'x', wall, span.from, span.to);
    if (clearOfStairs(link) && flight(other, link, sill(link))) { port.used = true; loops++; } else dropLink();
  }
  /* the fire exit: the furthest room from where you land — a stairwell behind a fire door, often up a few stairs.
     On every floor of a visit but the last the stairs stop short of the next floor's ceiling, and that is the way on;
     on the last they have been papered over, and the way out is a wall (`way`: 'stairs' | 'wall' — the same room on the
     plan either way, so asking for one or the other changes nothing else; the wall is dress()'s business, and marks.js's).
     It goes in last, when every doorway there will ever be is already there, so no shortcut
     can bring it closer afterwards; and it only ever hangs off a room deep enough that nothing else in the building
     is further away. A floor that has no such spot, or whose furthest room is only a short walk off, is thrown back
     and dealt again. */
  depth = distances(start);
  const deepest = Math.max(...depth.values());
  const far = (room) => Math.hypot(room.x + room.w / 2 - (start.x + start.w / 2), room.z + room.d / 2 - (start.z + start.d / 2));
  const exitSpec = { kind: 'exit', lw: 3, ld: EXIT_DEPTH, dw: 1.2, centred: true, door: true };
  const anchors = [...hubs.filter((h) => h !== start && !h.crawl).map((room) => ({ room })), ...ports.filter((p) => !p.used)]
    .filter((p) => depth.get(p.room.id) + 1 >= Math.max(deepest, MIN_EXIT_STEPS))
    .sort((p, q) => depth.get(q.room.id) - depth.get(p.room.id) || far(q.room) - far(p.room));
  const tryExit = (a) => {
    if (a.local) { const dw = Math.min(1.2, wallLength(a.room, a.local) - 1.2); return attach(a.room, worldSide(a.room, a.local), { ...exitSpec, dw, fixed: portSpan(a.room, a.local, a.c || 0, dw) }); }
    for (const side of sides()) { const made = attach(a.room, side, exitSpec); if (made) { if (R.chance(0.45)) step(a.room, made, R.pick([2, 4, 6])); return made; } }
    return null;
  };
  // The room before it is a plain one too, put down last of all at the edge of the building: a room, not a corridor,
  // with outside walls — the stairwell's signs lead here, and on the last floor this is where the wall is looked for.
  const viaLobby = (a) => {
    for (let k = 0; k < 4; k++) {
      const [lw, ld] = sizes[k % 2 ? 'hall' : 'room'][R.chance(0.7) ? 0 : 1], spec = { kind: 'plain', lw, ld, dw: widths[0], H: heights[0] >= 2.3 ? heights[0] : WALL_H };
      let lobby = null;
      if (a.local) { const dw = Math.min(1.8, wallLength(a.room, a.local) - 1.2); lobby = attach(a.room, worldSide(a.room, a.local), { ...spec, dw, fixed: portSpan(a.room, a.local, a.c || 0, dw) }); }
      else for (const side of sides()) { lobby = attach(a.room, side, spec); if (lobby) break; }
      if (!lobby) continue;
      for (const side of sides()) { const made = attach(lobby, side, exitSpec); if (made) { if (R.chance(0.45)) step(lobby, made, R.pick([2, 4, 6])); return made; } }
      undo(lobby);
    }
    return null;
  };
  /**
   * The way out, through a gate: a run of plain rooms off the anchor (it is an oddity like any other, and keeps its
   * distance from the rest), the gate off the last of them, and the lobby and the fire exit off the side of the gate's
   * far room (`gate.gate(room)`: where along that wall). The doorway it is entered by and the one the way out is
   * beyond are written on it (`room.gate`: link ids) for the room that builds it. → the exit, or null: nothing went.
   */
  const throughGate = (a) => {
    const near = byStart(gate), fresh = near ? [] : run(a.local ? a : a.room, runLength());
    const hub = fresh.length ? fresh[fresh.length - 1] : near ? a.room : null;
    if (hub) for (const side of sides()) {
      const lw = R.int(gate.w[0], gate.w[1]), ld = R.int(gate.d[0], gate.d[1]);
      const room = attach(hub, side, { kind: 'special', arch: gate.id, lw, ld, dw: gate.door || 1.8, centred: true, H: gate.h ? Math.round(R.range(gate.h[0], gate.h[1]) * 10) / 10 : WALL_H });
      if (!room) continue;
      const enter = links[links.length - 1].id;
      for (const local of R.shuffle(['left', 'right'])) {
        const on = { room, local, c: gate.gate(room) }, made = viaLobby(on) || tryExit(on);
        if (!made) continue;
        const beyond = links.filter((l) => l.a === room.id || l.b === room.id).pop();          // (its newest doorway: the one just made)
        room.name = gate.name; room.gate = { in: enter, on: beyond.id };
        room.params = gate.roll(R.fork('roll:' + room.id), o);
        hubs.push(...fresh); specials.push(room);
        return made;
      }
      undo(room);
    }
    for (const r of fresh.reverse()) undo(r);
    return null;
  };
  let exit = null;
  if (gate) { for (const a of (byStart(gate) ? [{ room: start }] : anchors)) { exit = throughGate(a); if (exit) { if (a.local) a.used = true; break; } } }
  else for (const a of anchors) { exit = viaLobby(a) || tryExit(a); if (exit) { if (a.local) a.used = true; break; } }
  if (!exit) return null;
  exit.way = goesDown(opt.way) ? opt.way : 'wall';
  exit.name = 'Fire exit';

  depth = distances(start);
  for (const room of rooms) room.depth = depth.get(room.id) ?? -1;
  if (rooms.some((r) => r.depth < 0)) return null;
  if (specials.length < (hand ? Math.max(hand.length ? 1 : 0, hand.length - 1) : Math.min(MIN_ODD, want, able)) || (opt.only && [].concat(opt.only).some((id) => ARCHETYPES[id] && !specials.some((r) => r.arch === id)))) return null;
  if (must.some((a) => !specials.some((r) => r.arch === a.id))) return null;
  if (1 - specials.length / rooms.length < QUIET[0]) return null;              // (a floor that could not be made quiet enough is dealt again)

  /* what kind of hole each doorway is: most are doorways; some you crawl through, some are arches, a few are slits */
  const narrow = (link, w) => { if (link.to - link.from > w) { const mid = (link.from + link.to) / 2; link.from = r4(mid - w / 2); link.to = r4(mid + w / 2); } };
  for (const link of links) {
    const a = rooms[link.a], b = rooms[link.b];
    if (link.door) continue;
    if (a.crawl || b.crawl) { link.kind = 'crawl'; narrow(link, 1.2); continue; }
    if (!plain(a) || !plain(b) || a.y !== b.y) continue;
    const roll = R();
    if (roll < 0.13) { link.kind = 'crawl'; narrow(link, R.pick([0.9, 1.1])); }
    else if (roll < 0.26) link.kind = 'arch';
    else if (roll < 0.31) { link.kind = 'slit'; narrow(link, 0.62); }
  }

  /* each room's doorways, in its own frame */
  for (const link of links) for (const room of [rooms[link.a], rooms[link.b]]) {
    const mid = (link.from + link.to) / 2;
    const wx = link.axis === 'x' ? link.at : mid, wz = link.axis === 'x' ? mid : link.at;
    const p = toLocal(room, wx, wz);
    const side = Math.abs(Math.abs(p.z) - (room.D + T) / 2) < 1e-6 && Math.abs(p.x) <= room.W / 2 ? (p.z > 0 ? 'front' : 'back') : (p.x > 0 ? 'right' : 'left');
    link.y = Math.max(rooms[link.a].y, rooms[link.b].y);
    room.doors.push({ side, c: side === 'front' || side === 'back' ? p.x : p.z, w: r4(link.to - link.from), link: link.id, to: link.a === room.id ? link.b : link.a, door: link.door, kind: link.kind,
      sill: r4(link.y - room.y), h: DOOR_H });
  }
  return { rooms, links, start, exit, specials, hubs, neighbours, distances };
}

/* ---- dressing: wallpaper, lights, the shape of each plain room, the odd thing left in a corner ---------- */

const DRESSING = ['boxes', 'boxes', 'chair', 'plant', 'lamp', 'bin', 'wetsign', 'papers', 'papers', 'stain', 'poster', 'clock', 'frame', 'ladder', 'coat', 'fan', 'tile', 'highdoor', 'highdoor', 'highdoor'];
// what the plain-room builder (rooms.js) knows how to put down, of everything a theme may ask for; and how many plain rooms have anything
const KNOWN_THINGS = new Set(['boxes', 'chair', 'plant', 'lamp', 'bin', 'wetsign', 'papers', 'stain', 'poster', 'clock', 'frame', 'ladder', 'coat', 'fan', 'tile', 'highdoor', 'cabinet', 'shelving', 'armchair', 'globe',
  'mailbox', 'flamingo', 'hose']);                                        // (the neighbourhood's: suburb.js builds them)
export const THING_CHANCE = 0.06;
/** What an earlier visitor may have left in a plain room (traces.js builds them): a floor has two or three, each a different one. */
export const TRACES = Object.freeze(['camp', 'arrows', 'note', 'measure', 'map', 'queue', 'drawing']);
// Notes that stop. Nobody finishes a sentence down here: something always comes up.
const NOTES = [
  ['IF YOU FIND THIS:', 'THE WAY OUT IS', 'DEFINITELY PAST THE'],
  ['DAY 3. I HAVE WORKED', 'OUT WHAT THE HUM IS.', 'IT IS'],
  ['{AGENT} — GONE TO', 'LOOK FOR THE STAIRS.', 'BACK IN'],
  ['DO NOT, WHATEVER', 'YOU DO, TURN YOUR', 'BACK ON THE'],
  ['TO WHOEVER TOOK MY', 'STAPLER: I KNOW IT', 'WAS YOU, AND I'],
  ['MINUTES OF THE', '{PROJECT} STAND-UP.', 'PRESENT: ME. ITEM 1:'],
];
const POSTERS = ['HANG IN THERE', 'SYNERGY', 'PERSISTENCE', 'TEAMWORK', 'THIS IS FINE', 'ALIGNMENT', 'YOU ARE DOING GREAT, {NAME}', 'DAYS SINCE LAST INCIDENT: 0'];

function layPanels(R, room, mode) {
  const { W, D } = room, panels = [], s = room.shape;
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
    // not inside a filled-in corner, not straddling a step in the ceiling
    if (s && s.kind === 'ell' && Math.abs(x - s.x) < s.w / 2 + 0.4 && Math.abs(z - s.z) < s.d / 2 + 0.7) continue;
    if (s && s.kind === 'stepceil' && Math.abs((s.axis === 'x' ? x : z) - s.at) < (s.axis === 'x' ? 0.4 : 0.7)) continue;
    if (s && s.kind === 'soffit' && Math.abs(Math.abs((s.axis === 'x' ? z : x) - s.at) - s.t / 2) < (s.axis === 'x' ? 0.7 : 0.4)) continue;
    if (s && s.kind === 'pinch' && Math.abs(s.axis === 'x' ? z : x) + 0.35 > pinchHalf(room, s.axis === 'x' ? x : z)) continue;
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

/** The shapes a plain room could take, given where its doorways are. */
function shapesFor(R, room) {
  const { W, D, H, doors } = room, out = [];
  const raised = doors.some((d) => d.sill > 0.01);
  const pts = doors.map((d) => wallPoint(room, d.side, d.c, 0.8));
  const clearOf = (x0, z0, x1, z1, m) => pts.every((p) => p.x < x0 - m || p.x > x1 + m || p.z < z0 - m || p.z > z1 + m);
  const half = (v) => Math.round(v * 2) / 2;
  const long = W >= D ? 'x' : 'z', len = Math.max(W, D), wid = Math.min(W, D);
  const ends = long === 'x' ? ['left', 'right'] : ['front', 'back'];
  // the lowest a ceiling may be over each doorway: an ordinary one needs to stay a doorway
  const need = (d) => d.sill + (d.kind === 'crawl' ? 0.95 : 1.75);
  const ceilOK = (shape) => { const probe = { ...room, shape }; return doors.every((d) => { for (let k = -0.5; k <= 0.501; k += 0.1) for (const off of [0.05, 0.5, 0.95]) { const p = wallPoint(room, d.side, d.c + k * (d.w + 0.5), off); if (ceilAt(probe, p.x, p.z) < need(d)) return false; } return true; }); };

  if (W >= 3.8 && D >= 3.8 && !raised) for (let t = 0; t < 4; t++) {                 // a corner filled in: the room turns a corner
    const sx = R.pick([-1, 1]), sz = R.pick([-1, 1]), bw = half(R.range(0.3, 0.56) * W), bd = half(R.range(0.3, 0.56) * D);
    const x = sx * (W / 2 - bw / 2), z = sz * (D / 2 - bd / 2);
    if (W - bw >= 1.6 && D - bd >= 1.6 && clearOf(x - bw / 2, z - bd / 2, x + bw / 2, z + bd / 2, 0.55)) { out.push({ kind: 'ell', x, z, w: bw, d: bd, weight: 3.5 }); break; }
  }
  if (len >= 4.6 && wid >= 1.7 && wid <= 4 && !raised && doors.every((d) => ends.includes(d.side)))        // a waist, for no reason
    out.push({ kind: 'pinch', axis: long, waist: r4(R.range(0.78, 1.05)), at: r4(R.range(-0.12, 0.12) * len), span: r4(len * R.range(0.22, 0.34)), weight: 4 });
  if (W >= 4.6 && D >= 4.6 && !raised) out.push({ kind: 'forest', step: R.pick([1.5, 1.8, 2.1]), size: R.pick([0.3, 0.4, 0.5]), jitter: R.chance(0.3), weight: 2.5 });
  if (len >= 3.6) {                                                                   // the ceiling takes a step up or down part way along
    const h2 = r4(H + R.pick([-0.75, -0.55, 0.6, 0.9, 1.4])), shape = { kind: 'stepceil', axis: long, at: r4(R.range(-0.2, 0.2) * len), dir: R.pick([-1, 1]), h1: H, h2, weight: 0.7 };
    if (h2 >= 1.5 && ceilOK(shape)) out.push(shape);
  }
  if (len >= 4) {                                                                     // …or slopes
    const lo = r4(R.range(1.5, 2.0)), hi = r4(Math.max(H, R.range(2.9, 3.8))), flip = R.chance(0.5);
    const shape = { kind: 'slopeceil', axis: long, h0: flip ? hi : lo, h1: flip ? lo : hi, weight: 2 };
    if (ceilOK(shape)) out.push(shape);
  }
  if (W >= 4.2 && D >= 4.2 && !raised) for (const kind of ['pit', 'dais']) {              // a sunken square, or a raised one, with steps all round
    const n = kind === 'pit' ? R.int(2, 3) : R.int(1, 3), w = half(R.range(0.5, 0.7) * W), d = half(R.range(0.5, 0.7) * D);
    const x = half(R.range(-0.5, 0.5) * (W - w - 1.8)), z = half(R.range(-0.5, 0.5) * (D - d - 1.8));
    if (Math.min(w, d) - 0.6 * n >= 1.0 && clearOf(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.02) && H - n * RISE >= 1.9) out.push({ kind, x, z, w, d, n, weight: 3 });
  }
  if (len >= 3.8 && !raised) {                                                        // a beam across the room, low enough to make you duck
    const t = r4(R.range(0.5, 1.5)), at = r4(R.range(-0.25, 0.25) * len), axis = long === 'x' ? 'z' : 'x';
    const shape = { kind: 'soffit', axis, at, t, clear: R.pick([0.8, 0.95, 1.15, 1.3]), weight: 2.5 };
    const lo = at - t / 2, hi = at + t / 2;
    if (pts.every((p) => { const v = axis === 'x' ? p.z : p.x; return v < lo - 0.7 || v > hi + 0.7; }) && ceilOK(shape)) out.push(shape);
  }
  if (W >= 3.6 && D >= 3.6) for (const side of R.shuffle(['back', 'left', 'right', 'front'])) {        // stairs that climb to the ceiling and stop
    const span = wallLength(room, side), deep = side === 'front' || side === 'back' ? D : W;
    const n = Math.min(12, Math.floor((H - 0.62) / RISE), Math.floor((deep - 1.5) / RUN));
    const w = r4(Math.min(R.pick([1.1, 1.4, 1.8]), span - 1.2)), c = r4(R.range(-0.5, 0.5) * (span - w - 0.6));
    if (n < 5 || w < 0.9) continue;
    const a = wallPoint(room, side, c - w / 2, 0), b = wallPoint(room, side, c + w / 2, n * RUN);
    if (!clearOf(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), 0.6)) continue;
    if (doors.some((d) => d.sill > 0.01 && d.side === side)) continue;
    // …and never across the foot of the real stairs, the ones that go up to a doorway
    if (stairZones(room, 1.0).some((q) => Math.min(a.x, b.x) < q.x1 + 0.3 && Math.max(a.x, b.x) > q.x0 - 0.3 && Math.min(a.z, b.z) < q.z1 + 0.3 && Math.max(a.z, b.z) > q.z0 - 0.3)) continue;
    out.push({ kind: 'stairs', side, c, w, n, top: R.pick(['door', 'door', 'wall', 'hole']), weight: 3 });
    break;
  }
  return out;
}

/** The wallpaper family and what it is printed with, for a kind of place and a seed: what a whole part is hung with. */
function paperOf(theme, seed) {
  const t = themeOf(theme), R = makeRng(`paper:${seed}`);
  return [R.weighted(FAMILIES, (f) => (t.families ? t.families[f.id] || 0 : f.weight)), R.pick(t.patterns || PATTERNS)];
}

function dress(R, level, o, opt, keeper = false) {
  const { rooms, links, start, exit } = level, theme = themeOf(opt.theme), lit = theme.light || {};
  // which wallpapers this floor is hung with, what they are printed with, and how its ceilings behave (themes.js)
  const weightOf = (f) => (theme.families ? theme.families[f.id] || 0 : f.weight), patterns = theme.patterns || PATTERNS, tubes = theme.tubes || TUBES;
  const dead = lit.dead || [0.06, 0.3], modes = lit.modes || [['normal', 1]], things = theme.dressing || DRESSING;
  // (a part of a visit is told which paper it is hung with — `paper`, a seed of its own — so that the parts either side
  // of it can be told too, and have a little of it: see the seams, below. Rolled as ever first, so nothing else moves.)
  const asRolled = [R.weighted(FAMILIES, weightOf), R.pick(patterns)];
  const [family, pattern] = opt.paper ? paperOf(theme, opt.paper) : asRolled;
  const toExit = level.distances(exit);
  // something that follows you — in some visits. It stands in a plain room a little way in.
  let pursuer = null;
  const lairs = rooms.filter((r) => r.kind === 'plain' && !r.crawl && r.depth >= 2 && r.W >= 3.5 && r.D >= 3.5 && r.H >= 2.5 && r.H <= 3.4);
  // (always rolled the same way, so that asking for it — or for none — changes nothing else about the level)
  const pickLair = (r) => (lairs.length ? { room: r.pick(lairs).id, corner: r.int(0, 3), face: r.int(0, 9) } : null);
  const rolled = R.chance(0.62) ? pickLair(R) : null;
  if (opt.pursuer === undefined) pursuer = rolled;
  else if (opt.pursuer) pursuer = rolled || pickLair(R.fork('pursuer'));
  // …and while it is holding the keycard there has to be one, even in a building with no room it would have chosen
  // (likewise when the visit's plan has said it stands on this part — `mascot`: a part with no room of the height it likes still has it)
  if (!pursuer && (keeper || opt.mascot === true)) {
    const plainer = rooms.filter((r) => r.kind === 'plain' && !r.crawl), roomy = plainer.filter((r) => r.depth >= 1 && r.W >= 2.8 && r.D >= 2.8 && r.H >= 2.2);
    const r = R.fork('keeper'), anywhere = roomy.length ? roomy : plainer;
    if (anywhere.length) pursuer = { room: r.pick(anywhere).id, corner: r.int(0, 3), face: r.int(0, 9) };
  }

  // what this floor's plain rooms are made of: a few motifs, the same few things left about, the same wrongnesses (quiet.js)
  const vocab = vocabulary(R.fork('quiet'), theme.id), mix = vocab.mix;
  const RT = R.fork('things'), known = things.filter((t) => KNOWN_THINGS.has(t)), kept = [];
  for (let k = 0; k < 3 && known.length; k++) {
    const type = RT.pick(known), item = { type, turn: RT.range(-Math.PI, Math.PI), n: RT.int(3, 9), seed: RT.int(1, 9999) };
    if (type === 'poster') item.text = fill(RT.pick(POSTERS), o, RT);
    if (type === 'frame') item.who = RT.int(0, 99);
    kept.push(item);
  }
  const footprint = (r) => `${Math.min(r.w, r.d)}x${Math.max(r.w, r.d)}`;

  for (const room of rooms) {
    const rr = R.fork('dress:' + room.id);
    const quiet = room.kind === 'plain' || room.kind === 'start';
    // the wallpaper is different in here: now and then in an oddity, hardly ever in a plain room
    const odd = rr.chance(quiet ? 0.03 : 0.12);
    room.look = rollLook(rr, odd ? rr.weighted(FAMILIES, weightOf) : family, odd || rr.chance(quiet ? 0.03 : 0.12) ? rr.pick(patterns) : pattern, tubes);
    const arch = room.arch ? ARCHETYPES[room.arch] : null;
    room.light = { dead: rr.range(dead[0], dead[1]), flicker: rr.chance(lit.flicker ?? 0.4) ? 1 : 0, power: rr.range(0.9, 1.1), mode: arch ? arch.lights : rr.weighted(modes, (m) => m[1])[0] };
    // on a dark floor an oddity is not always the one room with its lights on
    if (arch && arch.lights === 'normal' && lit.odd) room.light.mode = rr.weighted(lit.odd, (m) => m[1])[0];
    if (room.kind === 'exit') { room.light.dead = 0; room.light.flicker = 0; room.light.mode = 'normal'; }
    if (room.kind === 'start') { room.light.dead = Math.min(room.light.dead, 0.12); room.light.mode = 'normal'; }    // wherever you land, you can see where you are
    room.toExit = toExit.get(room.id);
    room.pillars = []; room.dress = []; room.sign = null; room.shape = null; room.wins = []; room.quiet = null;
    // Rooms the same size are laid out the same way: what a plain room is made of is rolled from its footprint (and one of
    // two ways to a footprint), not from the room. Only which way round it is, and what the doorways leave room for, differ.
    const rl = quiet ? R.fork(`layout:${footprint(room)}:${rr.int(0, 1)}`) : rr;

    if (room.kind === 'plain' && !room.crawl) {
      const lair = pursuer && pursuer.room === room.id;
      // (near the fire exit a room keeps its walls bare and its floor level: it is where the wall that gives is looked for)
      const byExit = room.toExit <= 2;
      let way = lair ? 'shape' : rl.weighted([['bare', mix.bare], ['motif', mix.motif], ['shape', mix.shape]], (k) => k[1])[0];
      if (byExit && way === 'shape') way = 'bare';
      const free = vocab.motifs.filter((k) => !byExit || k.kind === 'parallel' || k.kind === 'colonnade' || k.kind === 'return');
      const narrow = Math.min(room.W, room.D) < NARROW;
      const lay = (m) => {
        // turned to lie along the room (either way round), or any way at all if the room is square
        const along = room.W > room.D ? 1 : 0, flip = rr.chance(0.5) ? 2 : 0;
        const turns = Math.abs(room.W - room.D) < 0.01 ? [0, 1, 2, 3].map((k) => (k + flip) % 4) : [(along + flip) % 4, (along + flip + 2) % 4];
        for (const t of turns) {
          const whole = motif(room, m, t), plan = whole && (m.kind === 'nibs' || m.kind === 'bays' || m.kind === 'colonnade' || m.kind === 'baffle') ? pruned(room, whole, m.kind === 'baffle' ? 2 : 3) : whole;
          if (!plan || !fits(room, plan)) continue;
          room.pillars.push(...plan.pillars);
          room.quiet = { kind: m.kind, turn: t };
          return true;
        }
        return false;
      };
      if (narrow) {
        // a corridor: lined the way this floor's corridors are, or not at all (never at the last door: that wall is looked at)
        if (way === 'motif' && vocab.hall && !byExit) lay(vocab.hall);
      } else if (way === 'motif' && free.length) {
        // one of the floor's motifs — and if the one it rolled will not go in a room this size with these doorways, the next
        const first = rl.weighted(free, (k) => k.weight);
        for (const m of [first, ...free.filter((k) => k !== first)]) if (lay(m)) break;
      }
      // the shape of the room itself — the same few kinds over a floor, rolled the same way for rooms the same size
      const options = way === 'shape' ? shapesFor(rl, room).filter((s) => (lair ? s.kind === 'stepceil' : vocab.shapes.includes(s.kind))) : [];
      if (options.length && (!lair || rr.chance(0.3))) {
        const { weight: _w, ...shape } = rl.weighted(options, (s) => s.weight);
        room.shape = shape;
        if (shape.kind === 'slopeceil') room.H = Math.max(shape.h0, shape.h1);
        if (shape.kind === 'stepceil') room.H = Math.max(shape.h1, shape.h2);
        // the solid parts of a shape are just pillars, large or many
        const byDoor = (x, z, gap) => room.doors.some((dr) => { const p = wallPoint(room, dr.side, dr.c, 0); return Math.hypot(x - p.x, z - p.z) < gap + dr.w / 2; });
        if (shape.kind === 'ell') room.pillars.push({ x: shape.x, z: shape.z, w: shape.w, d: shape.d, fill: true });
        if (shape.kind === 'forest') {
          const nx = Math.floor((room.W - 1.6) / shape.step) + 1, nz = Math.floor((room.D - 1.6) / shape.step) + 1;
          for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
            const x = r4((i - (nx - 1) / 2) * shape.step + (shape.jitter ? rl.range(-0.25, 0.25) : 0)), z = r4((j - (nz - 1) / 2) * shape.step + (shape.jitter ? rl.range(-0.25, 0.25) : 0));
            if (!byDoor(x, z, 1.0)) room.pillars.push({ x, z, w: shape.size, d: shape.size });
          }
        }
      }
    }
    room.panels = layPanels(rr, room, room.light.mode);
    if (!quiet) continue;

    // a lit arrow over the doorway that leads toward the way out — in a few rooms (and always in the one before it)
    if (room.doors.length >= 2 && !room.crawl && (rr.chance(0.22) || room.toExit === 1)) {
      const best = room.doors.slice().sort((p, q) => toExit.get(p.to) - toExit.get(q.to))[0];
      if (toExit.get(best.to) < room.toExit && best.kind !== 'crawl') room.sign = { door: room.doors.indexOf(best), text: rr.pick(['EXIT', 'EXIT', 'EXIT', 'WAY OUT', 'EXIT?', 'EXIT (PROBABLY)']) };
    }
    if (room.crawl) { if (rr.chance(0.2)) room.dress.push({ type: 'papers', u: rr(), v: rr(), turn: 0, n: rr.int(2, 5), seed: kept.length ? kept[0].seed : 1 }); continue; }
    // pillars: free-standing, or squarely in front of a doorway — in a bare room, and the same in every bare room its size
    const near = (x, z, gap) => room.doors.some((dr) => { const p = wallPoint(room, dr.side, dr.c, 0); return Math.hypot(x - p.x, z - p.z) < gap + dr.w / 2; });
    if (!room.quiet && (!room.shape || room.shape.kind === 'stepceil' || room.shape.kind === 'slopeceil')) {
      if (room.W >= 4.5 && room.D >= 4.5) {
        const wantPillars = rl.chance(0.4) ? rl.int(1, room.W * room.D > 40 ? 2 : 1) : 0;
        for (let tries = 0; tries < 12 && room.pillars.length < wantPillars; tries++) {
          const s = rl.pick([0.6, 0.6, 0.8]), x = Math.round(rl.range(-room.W / 2 + 1.5 + s / 2, room.W / 2 - 1.5 - s / 2) * 2) / 2, z = Math.round(rl.range(-room.D / 2 + 1.5 + s / 2, room.D / 2 - 1.5 - s / 2) * 2) / 2;
          if (near(x, z, 1.5) || room.pillars.some((p) => Math.abs(p.x - x) < (p.w + s) / 2 + 1.3 && Math.abs(p.z - z) < (p.d + s) / 2 + 1.3)) continue;
          if (stairZones(room).some((s2) => inRect({ x, z }, s2, s / 2 + 0.3))) continue;
          if (room.kind === 'start' && Math.hypot(x, z) < 1.6) continue;
          if (!fits(room, { pillars: [{ x, z, w: s, d: s }] })) continue;       // (never where it would cut a doorway off: with a flight of steps beside it, it can)
          room.pillars.push({ x, z, w: s, d: s });
        }
      }
      if (room.kind === 'plain' && rr.chance(0.16)) {                // …the wrong place for a pillar
        const dr = rr.pick(room.doors), deep = dr.side === 'front' || dr.side === 'back' ? room.D : room.W, span = wallLength(room, dr.side);
        const pw = Math.min(dr.w + 0.3, span - 1.9);
        // (…and not at all in a room that has steps in it: a pier before one doorway and another doorway's steps beside it
        // left the far half of a room, and once the wall that gives, with no way to it. `fits` below did not see it.)
        if (!room.doors.some((d2) => d2.sill > 0.01) && deep >= 3.2 && pw >= 0.6 && dr.kind !== 'crawl') {
          const p = wallPoint(room, dr.side, dr.c, 1.35), along = dr.side === 'front' || dr.side === 'back';
          // (in the way, but never in the way of everything: a pier that would wall a doorway off — it can, with another
          // doorway's steps beside it — is not built. Found on one seed in sixty once the deck had grown.)
          const pier = { x: p.x, z: p.z, w: along ? pw : 0.5, d: along ? 0.5 : pw };
          if (!room.pillars.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1.6) && room.doors.every((d2) => d2 === dr || Math.hypot(wallPoint(room, d2.side, d2.c, 0.7).x - p.x, wallPoint(room, d2.side, d2.c, 0.7).z - p.z) > pw / 2 + 0.9)
            && fits(room, { pillars: [pier] }))
            room.pillars.push(pier);
        }
      }
    }
    // Something somebody left behind — in a few rooms, and always one of the same few things: most plain rooms have nothing
    if (kept.length && rr.chance(THING_CHANCE)) room.dress.push({ ...rr.weighted(kept, (k) => 3 - kept.indexOf(k)), u: rr(), v: rr() });
  }

  // The static wrongnesses: the wall with two holes in it, the workstation down in the carpet. Never in one room only:
  // on a floor that has one at all, it is in two rooms at least, and if there are not two rooms that can take it, in none.
  for (const kind of vocab.wrong) {
    const RW = R.fork('wrong:' + kind), able = [];
    for (const room of rooms) {
      if (room.kind !== 'plain' || room.crawl || room.shape || (pursuer && pursuer.room === room.id)) continue;
      if (kind === 'apertures') {
        // in place of a partition this floor already has (a parallel wall, or the long side of a return) — or, in a
        // room with nothing in it at all, as the one wall it has
        const was = room.quiet && (room.quiet.kind === 'parallel' || room.quiet.kind === 'return') ? room.quiet : null;
        const empty = !room.quiet && !room.pillars.length && room.toExit > 2 && Math.min(room.W, room.D) >= 3.4;
        if (was || empty) {
          const like = vocab.motifs.find((k) => k.kind === (was ? was.kind : 'parallel')) || vocab.motifs.find((k) => k.kind === 'parallel') || {};
          const m = { off: like.off, gap: like.gap, kind: 'apertures', ...vocab.ap };
          for (const t of was ? [was.turn] : [room.W > room.D ? 1 : 0, room.W > room.D ? 3 : 2]) {
            const plan = motif(room, m, t);
            if (plan && fits({ ...room, pillars: [] }, plan)) { able.push({ room, plan, turn: t }); break; }
          }
        }
      }
      if (kind === 'sunk' && (!room.quiet || room.quiet.kind === 'dogleg' || room.quiet.kind === 'colonnade') && room.W >= 4 && room.D >= 4) {
        // the same spot in every room it is in: a little off the middle, toward the back, lying across the room
        const at = vocab.sunk.at, q = room.W >= room.D ? 0 : 1;
        for (const [x, z] of [[-room.W * at * 0.5, -room.D * at], [room.W * at * 0.5, -room.D * at], [0, room.D * at], [0, 0]]) {
          const plan = { pillars: [], ...sunk(r4(x), r4(z), q) };
          if (room.pillars.some((p) => plan.blocks.some((b) => b.x0 < p.x + p.w / 2 + 0.3 && b.x1 > p.x - p.w / 2 - 0.3 && b.z0 < p.z + p.d / 2 + 0.3 && b.z1 > p.z - p.d / 2 - 0.3))) continue;
          if (plan.blocks.some((b) => Math.abs(b.x0) > room.W / 2 - 0.6 || Math.abs(b.x1) > room.W / 2 - 0.6 || Math.abs(b.z0) > room.D / 2 - 0.6 || Math.abs(b.z1) > room.D / 2 - 0.6)) continue;
          if (fits(room, plan)) { able.push({ room, plan }); break; }
        }
      }
    }
    const chosen = able.filter(() => RW.chance(vocab.wrongChance));
    for (const extra of RW.shuffle(able)) { if (chosen.length >= 2) break; if (!chosen.includes(extra)) chosen.push(extra); }
    if (chosen.length < 2) continue;
    for (const { room, plan, turn } of chosen) {
      if (kind === 'apertures') { room.pillars = plan.pillars; room.lows = plan.lows; room.quiet = { kind: 'apertures', turn }; }
      else { room.blocks = plan.blocks; room.props = plan.props; room.quiet = { ...(room.quiet || { kind: 'bare', turn: 0 }), sunk: true }; }
    }
  }
  // What earlier visitors left (traces.js): you are not the first, and most of the others did not get out. Two or
  // three to a floor at most, each a different thing, in plain rooms with nothing else in them — off the way from the
  // landing to the way down for choice, never next door to an oddity (an event needs empty rooms round it), never in a room
  // with anything else in it (what is placed after this keeps out of these rooms: the plan on the wall, the doors in
  // the floor, the marked walls, the wall the plan calls thin), never
  // within three doorways of another (out of each other's sight), never the first room or the last. All of it from a source of its own.
  {
    const RTr = R.fork('traces'), onWay = new Set(roomPath({ rooms, links }, start.id, exit.id) || []);
    const next = (r) => r.doors.map((d) => rooms[d.to]);
    const able = RTr.shuffle(rooms.filter((r) => r.kind === 'plain' && !r.crawl && !r.shape && !r.dress.length && !(r.blocks && r.blocks.length) && !(r.quiet && r.quiet.kind === 'apertures')
      && r.depth >= 1 && r.toExit >= 2 && r.H >= 2.4 && Math.min(r.W, r.D) >= 2.6 && Math.max(r.W, r.D) >= 3.6 && !(pursuer && pursuer.room === r.id) && next(r).every((n) => n.kind !== 'special')));
    able.sort((p, q) => (onWay.has(p.id) ? 1 : 0) - (onWay.has(q.id) ? 1 : 0));
    const kinds = RTr.shuffle(TRACES.filter((k) => k !== 'drawing')), placed = [], want = RTr.int(2, 3);
    // a drawing of something that is down here — only ever of something that is (`drawn`: who, from the visit's plan:
    // whoever is on this part or the one below it). On most parts that have anybody to draw, it is the first thing placed.
    const drawn = (Array.isArray(opt.drawn) ? opt.drawn : []).filter((id) => typeof id === 'string' && id);
    if (drawn.length && RTr.fork('drawing').chance(0.6)) kinds.unshift('drawing');
    for (const room of able) {
      if (placed.length >= want) break;
      const dist = level.distances(room);
      if (placed.some((q) => (dist.get(q.id) ?? 99) < 3)) continue;
      const kind = kinds[placed.length % kinds.length], item = { type: 'trace', kind, seed: RTr.int(1, 9999), turn: 0, n: RTr.int(3, 5) };
      if (kind === 'note') item.text = RTr.pick(NOTES).flatMap((line) => wrap(fill(line, o, RTr), 22));        // (a long name takes a line to itself)
      if (kind === 'queue' && Math.min(room.W, room.D) < 3.4) continue;
      if (kind === 'drawing') { const RD = RTr.fork('drawing:' + room.id); item.of = RD.pick(drawn); item.text = warningFor(item.of, RD); }
      room.dress.push(item); placed.push(room);
    }
  }
  const traced = (r) => r.dress.some((d) => d.type === 'trace');

  // a floor plan on a wall, somewhere, with a red dot that is not where it should be
  const mapRooms = rooms.filter((r) => r.kind === 'plain' && !r.crawl && r.depth >= 1 && !traced(r));
  for (const room of R.shuffle(mapRooms).slice(0, R.int(1, 2))) room.dress.push({ type: 'map', u: R(), v: R(), turn: 0, n: 0, seed: R.int(1, 9999) });

  // a door in the floor of one room is a door in the ceiling of another
  const hatchRooms = R.shuffle(rooms.filter((r) => r.kind === 'plain' && !r.crawl && r.W >= 3.4 && r.D >= 3.4 && r.H >= 2.4 && !traced(r)));
  for (let k = 0, pairs = R.pick([0, 1, 1, 2]); k < pairs && hatchRooms.length >= 2; k++) {
    const a = hatchRooms.pop(), b = hatchRooms.pop();
    a.dress.unshift({ type: 'floordoor', to: b.id, turn: 0, n: 0, seed: R.int(1, 9999) });
    b.dress.unshift({ type: 'ceildoor', from: a.id, turn: 0, n: 0, seed: R.int(1, 9999) });
  }

  // how tall each doorway ends up, now that the ceilings are known
  for (const link of links) {
    const pair = [rooms[link.a], rooms[link.b]].map((r) => [r, r.doors.find((d) => d.link === link.id)]);
    let h = link.kind === 'crawl' ? 0.8 : link.kind === 'arch' ? 9 : DOOR_H;
    for (const [r, d] of pair) for (let k = -0.5; k <= 0.501; k += 0.1) { const p = wallPoint(r, d.side, d.c + k * d.w, 0.05); h = Math.min(h, ceilAt(r, p.x, p.z) - d.sill - (link.kind === 'arch' ? 0.02 : 0.12)); }
    link.h = r4(Math.max(0.62, h));
    for (const [, d] of pair) d.h = link.h;
  }

  // windows: a hole at chest height between two plain rooms that share a wall
  const windows = [], cand = [];
  for (const a of rooms) for (const b of rooms) {
    if (a.id >= b.id || !plain(a) || !plain(b) || a.crawl || b.crawl) continue;
    let axis = null, at = 0, lo = 0, hi = 0;
    if (a.x + a.w === b.x || b.x + b.w === a.x) { axis = 'x'; at = a.x + a.w === b.x ? b.x : a.x; lo = Math.max(a.z, b.z) + 0.6; hi = Math.min(a.z + a.d, b.z + b.d) - 0.6; }
    else if (a.z + a.d === b.z || b.z + b.d === a.z) { axis = 'z'; at = a.z + a.d === b.z ? b.z : a.z; lo = Math.max(a.x, b.x) + 0.6; hi = Math.min(a.x + a.w, b.x + b.w) - 0.6; }
    if (!axis) continue;
    // the longest stretch of that wall with no doorway in it
    const cuts = links.filter((l) => l.axis === axis && l.at === at && ((l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id))).map((l) => [l.from - 0.5, l.to + 0.5]).sort((p, q) => p[0] - q[0]);
    let best = null, from = lo;
    for (const [c0, c1] of [...cuts, [hi, hi]]) { if (c0 - from > (best ? best[1] - best[0] : 1.3)) best = [from, Math.min(c0, hi)]; from = Math.max(from, c1); }
    if (best && best[1] - best[0] >= 1.3) cand.push({ a, b, axis, at, lo: best[0], hi: best[1] });
  }
  for (const c of R.shuffle(cand)) {
    if (windows.length >= 3) continue;
    const w = Math.min(R.pick([1.2, 1.6, 2.2]), c.hi - c.lo), from = r4(c.lo + R() * (c.hi - c.lo - w)), y0 = r4(Math.max(c.a.y, c.b.y) + R.pick([0.8, 0.95, 1.1])), y1 = r4(y0 + R.pick([0.7, 0.9, 1.1]));
    const win = { id: windows.length, a: c.a.id, b: c.b.id, axis: c.axis, at: c.at, from, to: r4(from + w), y0, y1 };
    const sides = [c.a, c.b].map((r) => {
      const mid = from + w / 2, p = toLocal(r, c.axis === 'x' ? c.at : mid, c.axis === 'x' ? mid : c.at);
      const side = Math.abs(Math.abs(p.z) - (r.D + T) / 2) < 1e-6 && Math.abs(p.x) <= r.W / 2 ? (p.z > 0 ? 'front' : 'back') : (p.x > 0 ? 'right' : 'left');
      return { r, rec: { side, c: side === 'front' || side === 'back' ? p.x : p.z, w, y0: r4(y0 - r.y), y1: r4(y1 - r.y), to: r === c.a ? c.b.id : c.a.id, win: win.id } };
    });
    // only where both rooms have plain wall, enough ceiling, and floor at floor level
    const fine = sides.every(({ r, rec }) => [-0.5, 0, 0.5].every((k) => {
      const p = wallPoint(r, rec.side, rec.c + k * rec.w, 0.3);
      if (ceilAt(r, p.x, p.z) < rec.y1 + 0.2 || Math.abs(floorAt(r, p.x, p.z)) > 0.01 || !fitsAt(r, p.x, p.z, 0.1)) return false;
      const s = r.shape;
      return !(s && s.kind === 'ell' && Math.abs(p.x - s.x) < s.w / 2 + 0.1 && Math.abs(p.z - s.z) < s.d / 2 + 0.1);
    }) && !r.pillars.some((q) => { const p = wallPoint(r, rec.side, rec.c, 0.4); return Math.abs(q.x - p.x) < q.w / 2 + rec.w / 2 && Math.abs(q.z - p.z) < q.d / 2 + 0.5; }));
    if (!fine) continue;
    windows.push(win);
    for (const { r, rec } of sides) r.wins.push(rec);
  }

  // the thin place — on every floor, though only the last floor's gives — and the other walls somebody tried
  const thin = thinPlace(rooms, R.fork('thin'), traced);
  if (!thin) return null;
  thin.print = R.fork('print').chance(PRINT_CHANCE);                  // (on some floors the place has faked a taped door there, in print)
  for (const mark of decoyMarks(rooms, R.fork('marks'), thin, traced)) { const { room: id, ...item } = mark; rooms[id].dress.push({ ...item, turn: 0, n: 0 }); }

  // Near a seam the parts run into each other: it is one building, and it changes as you go. The last rooms before
  // the way down have the next part's carpet (and, right at the door, its wallpaper); the room you land in and the
  // ones round it still have the ceiling and some of the paper of the part above. Rolled from a source of its own,
  // and nothing but looks: asking for it moves no wall.
  const bleed = opt.bleed || {}, RB = R.fork('bleed');
  const lookOf = (b, rr) => { const t = themeOf(b.theme), [fam, pat] = paperOf(t, b.paper ?? `${b.theme}`); return rollLook(rr, fam, pat, t.tubes || TUBES); };
  let shaft = null;
  if (bleed.next && THEMES[bleed.next.theme]) {
    const into = lookOf(bleed.next, RB.fork('next'));
    shaft = into;
    // (the room at the door: the nearest plain one, which is a step further off where an oddity stands at the way down)
    const door = Math.max(1, Math.min(...rooms.filter((r) => r.kind === 'plain' && r.toExit <= 2).map((r) => r.toExit)));
    for (const room of rooms) {
      if (room.kind !== 'plain' || !(room.toExit <= 2)) continue;
      room.look = { ...room.look, carpet: into.carpet, floor: into.floor, trim: room.toExit <= door ? into.trim : room.look.trim,
        ...(room.toExit <= door ? { family: into.family, pattern: into.pattern, wall: into.wall, ink: into.ink, pale: into.pale } : {}) };
      room.bleed = 'next';
    }
  }
  if (bleed.prev && THEMES[bleed.prev.theme]) {
    const from = lookOf(bleed.prev, RB.fork('prev'));
    for (const room of rooms) {
      if ((room.kind !== 'plain' && room.kind !== 'start') || room.depth > 1 || room.bleed) continue;
      room.look = { ...room.look, ceil: from.ceil, ...(room.depth === 0 ? { family: from.family, pattern: from.pattern, wall: from.wall, ink: from.ink, pale: from.pale, trim: from.trim } : {}) };
      room.bleed = 'prev';
    }
  }

  // "it's past the water coolers": the oddity nearest the way out
  const near = level.specials.slice().sort((a, b) => toExit.get(a.id) - toExit.get(b.id))[0];
  const first = start.doors[0];
  const aim = first ? { x: first.side === 'left' ? -1 : first.side === 'right' ? 1 : 0, z: first.side === 'front' ? 1 : first.side === 'back' ? -1 : 0 } : { x: 0, z: -1 };
  return {
    pursuer, windows,
    hint: near ? ARCHETYPES[near.arch].landmark : 'the plain rooms',
    start: { room: start.id, x: start.cx, z: start.cz, yaw: Math.atan2(-aim.x, -aim.z) },
    exit: { room: exit.id, way: exit.way }, thin, shaft,
    stamp: { year: R.int(1991, 1999), month: R.pick(MONTHS), day: R.int(1, 28), hour: R.int(0, 23), minute: R.int(0, 59) },
    hum: theme.hum || R.pick([50, 50, 60]),
  };
}

/* ---- what is hidden down here: a keycard and a few coins (core/game.mjs) --------------------------------
   Only when asked — generate(seed, { loot: { card, coins: [the numbers not found yet] } }) — and decided last,
   from a random source of its own: a visit with nothing left to find is the visit it always was.
   The keycard is not put anywhere: the mascot is holding it (pursuer.js), so asking for it makes sure there is
   a mascot. Coins go where exploring pays: rooms that are on no shortest way from the landing to the way out,
   dead ends and oddities for preference, one to a room and spread over the building. Never where you land,
   never the way out, never anywhere you have to crawl.                                                        */

export const COIN_R = 0.35;                          // the floor a coin keeps to itself, metres
const cm = (v) => Math.round(v * 100) / 100;
const about = (x, z, hx, hz = hx) => [x - hx, z - hz, x + hx, z + hz];

// Where a coin goes in each oddity: (room, ±1) → [x0, z0, x1, z1] in the room's own frame, or several to try in
// turn. The generator cannot see furniture — rooms*.js puts that in — so these are the places each builder is known
// to leave clear; loot.js still checks, once the room stands, that the spot can be walked to (and moves the coin if not).
const STASH1 = {
  cutouts: (r, s) => about(s * (r.W / 2 - 1), r.D / 2 - 1.05, 0.3),                              // a corner beside the door you came in by: behind you, with all of them watching
  'ceiling-meeting': () => [-1.5, -0.5, -0.9, 0.2],                                             // on the carpet, under one end of the table
  coolers: (r) => [-0.3, r.D / 2 - 9, 0.3, r.D / 2 - 6.6],                                      // a little way into the dark, before the corridor starts again
  'stress-pool': (r) => [-r.W / 2 + 2.6, -r.D / 2 + 2.4, r.W / 2 - 2.6, r.D / 2 - 2.9],         // out in the pool: wade in
  'keyboard-floor': (r) => [-3, -r.D / 2 + 0.75, 3, -r.D / 2 + 1.15],                           // under the screen: you type your way there
  'tiny-door': (r) => [-0.25, r.D * 0.08, 0.25, r.D * 0.24],                                    // where the corridor has begun to shrink, not yet to a crawl
  'many-doors': () => [-1, -1.2, 1, 0.2],                                                       // nothing in here but doors
  vending: (r) => [[-0.9, -r.D / 2 + 0.75, 0.9, -r.D / 2 + 1.3], [-0.9, -r.D / 2 + 2.4, 0.9, -r.D / 2 + 3]],   // the dark end, past the last machine
  'ceiling-plants': (r) => [-r.W / 2 + 0.8, -r.D / 2 + 0.8, r.W / 2 - 0.8, -0.6],               // the far half: the floor is the one thing they left alone
  phone: (r) => [-r.W / 2 + 0.8, -r.D / 2 + 0.8, r.W / 2 - 0.8, -r.D / 2 + 1.8],                // along the far wall, past the telephone
  party: (r) => [-1.6, -r.D / 2 + 0.7, 1.6, -r.D / 2 + 1.35],                                   // behind the table, under the banner
  chairs: (r, s) => (r.params.variant === 'corner' ? about(r.params.corner * (r.W / 2 - 1.1), -r.D / 2 + 1.1, 0.1)   // in the corner they are all facing
    : r.params.variant === 'arch' ? [-0.3, -0.55, 0.3, -0.05]                                   // under the arch
    : r.params.variant === 'audience' ? [0.6, -r.D / 2 + 0.8, r.W / 2 - 0.9, -r.D / 2 + 1.6]    // up at the front, by the slide
    : about(s * (r.W / 2 - 0.95), -r.D / 2 + 0.95, 0.2)),                                       // (a ring) outside it, in a far corner
  'wet-floor': (r) => about(r.params.puddle[0] * r.W, r.params.puddle[1] * r.D, 0.25),          // in the one wet patch
  'hall-of-fame': (r) => (r.doors.some((d) => d.side === 'back') ? [-0.3, -r.D / 2 + 3.2, 0.3, -r.D / 2 + 4.4] : [-0.3, -r.D / 2 + 1.6, 0.3, -r.D / 2 + 2.6]),   // the far end, by the last frame
  lift: (r) => [-0.3, -r.D / 2 + 0.75, 0.3, -r.D / 2 + 1],                                      // on the mat, waiting for the lift
  museum: (r, s) => (s > 0 ? [2.1, 2.35, r.W / 2 - 0.7, r.D / 2 - 0.7] : [-r.W / 2 + 0.7, 2.35, -2.1, r.D / 2 - 0.7]),   // a corner by the door: behind you while you look at the exhibits
  photo: (r) => about(0, -r.D / 2 + 1.3, 0.08),                                                 // on the cross of tape: your place in the photograph
  nested: (r, s) => { const d = [[0, 1], [1, 0], [0, -1], [-1, 0]][(r.params.turn + 2) % 4];     // in the room inside the room, round the side its own little room opens on
    return about(d[0] * 1.62 + d[1] * s * 1.2, r.params.z + d[1] * 1.62 + d[0] * s * 1.2, 0.05); },
};

export const STASH = { ...STASH1, ...MORE_STASH };
for (const a of DECK) if (typeof a.stash === 'function') STASH[a.id] = a.stash;       // a room written since keeps its hiding place in its own deck entry

const AROUND = [0, 0, 1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];     // a spot, and the eight points round it
/** What a coin in this room keeps clear of besides walls and pillars: the floor just inside each doorway, and every flight of stairs with its landing. */
const coinClear = (room) => ({ doors: room.doors.map((d) => wallPoint(room, d.side, d.c, 0.3)), stairs: stairZones(room, 0.9) });
/**
 * Could a coin hang here, as far as the generator can tell? Level carpet all round it and room to stand up, clear
 * of walls, pillars and every flight of stairs, and a good pace in from any doorway. (Furniture is the builders' business.)
 * `at` is coinClear(room), for whoever asks about many spots in one room.
 */
export function coinFits(room, x, z, r = COIN_R, at = coinClear(room)) {
  if (Math.abs(x) > room.W / 2 - r - 0.2 || Math.abs(z) > room.D / 2 - r - 0.2 || !fitsAt(room, x, z, r + 0.1)) return false;
  for (const p of at.doors) if (Math.hypot(x - p.x, z - p.z) < 1.25) return false;
  for (const q of room.pillars || []) if (Math.abs(x - q.x) < q.w / 2 + r + 0.1 && Math.abs(z - q.z) < q.d / 2 + r + 0.1) return false;
  for (const b of room.blocks || []) if (x > b.x0 - r - 0.1 && x < b.x1 + r + 0.1 && z > b.z0 - r - 0.1 && z < b.z1 + r + 0.1) return false;
  for (const s of at.stairs) if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return false;
  for (let k = 0; k < 18; k += 2) if (floorAt(room, x + AROUND[k] * r, z + AROUND[k + 1] * r) !== 0 || headAt(room, x + AROUND[k] * r, z + AROUND[k + 1] * r) < 1.5) return false;
  return true;
}

/** Every place a coin could hang in a room (see coinFits), on the 12.5 cm grid the level is walked on. None: the room hides nothing. */
export function coinSpots(room) {
  const out = [], step = 0.125, nx = Math.floor((room.W - 1.1) / step), nz = Math.floor((room.D - 1.1) / step), at = coinClear(room);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) { const x = (i - nx / 2) * step, z = (j - nz / 2) * step; if (coinFits(room, x, z, COIN_R, at)) out.push({ x, z }); }
  return out;
}

/** A place for a coin in this room, clear of any already in it — or null. */
function coinSpot(room, R, others = []) {
  const lay = room.arch && STASH[room.arch] ? STASH[room.arch](room, R.pick([-1, 1])) : null;
  const zones = !lay ? [] : Array.isArray(lay[0]) ? lay : [lay];
  const inner = room.doors.map((d) => wallPoint(room, d.side, d.c, 0.3));
  const behind = (p, x, z) => {                          // is there a pillar between this doorway and the spot?
    const n = Math.ceil(Math.hypot(x - p.x, z - p.z) / 0.12);
    return room.pillars.some((q) => { for (let i = 1; i < n; i++) if (Math.abs(p.x + ((x - p.x) * i) / n - q.x) < q.w / 2 && Math.abs(p.z + ((z - p.z) * i) / n - q.z) < q.d / 2) return true; return false; });
  };
  let all = null;
  for (const gap of [1.6, 0.9]) {
    const apart = (x, z) => others.every((o) => Math.hypot(o.x - x, o.z - z) >= gap);
    // an oddity has a place of its own for one
    for (const [x0, z0, x1, z1] of zones) for (let tries = 0; tries < 12; tries++) {
      const x = cm(R.range(x0, x1)), z = cm(R.range(z0, z1));
      if (apart(x, z) && coinFits(room, x, z)) return { x, z };
    }
    // anywhere else: the further from every doorway the better, and better still where none of them can see it
    all ||= coinSpots(room);
    const hides = room.pillars.length > 0 && inner.length > 0;
    const options = all.filter((k) => apart(k.x, k.z)).map((k) => ({ x: k.x, z: k.z,
      w: Math.min(9, ...inner.map((p) => Math.hypot(k.x - p.x, k.z - p.z))) ** 2 * (hides && inner.every((p) => behind(p, k.x, k.z)) ? 4 : 1) }));
    if (!options.length) continue;
    const o = R.weighted(options, (k) => k.w);
    return { x: o.x, z: o.z };
  }
  return null;
}

/** What generate() was asked to hide, tidied — or null for nothing. */
function wanted(loot) {
  if (!loot || typeof loot !== 'object') return null;
  const coins = [...new Set((Array.isArray(loot.coins) ? loot.coins : []).map((n) => Math.floor(Number(n))).filter((n) => n >= 1))].sort((a, b) => a - b);
  // (`tapes`: what the words on the cassettes are rolled from — the visit's seed, so that a tape says the same thing whichever floor it is on)
  return loot.card || coins.length ? { card: !!loot.card, coins, tapes: loot.tapes } : null;
}

/** Hide it. → { card, coins: [{ n, room, x, z }] }: each coin in a room, at a spot in that room's own frame. */
function stash(level, want, R) {
  const loot = { card: !!(want.card && level.pursuer), coins: [] };
  if (!want.coins.length) return loot;
  const fromStart = roomDistances(level, level.start.room), toExit = roomDistances(level, level.exit.room), way = fromStart.get(level.exit.room);
  // (a room the way out is through has a dead end of its own inside it — the room at the back of its hallway, where its
  // hiding place is — and that is off the way out, whatever the plan of doorways says)
  const detour = (r) => (r.arch && ARCHETYPES[r.arch] && ARCHETYPES[r.arch].gate ? 2 : fromStart.get(r.id) + toExit.get(r.id) - way);        // 0 on a shortest way out, 2 for a room one doorway off it…
  const able = level.rooms.filter((r) => r.kind !== 'start' && r.kind !== 'exit' && !r.crawl && fromStart.has(r.id));
  // how likely a room is to be picked: a dead end, an oddity, a long way off the route — and hardly ever the mascot's own room
  const entry = (r) => ({ room: r, R: R.fork('room:' + r.id), spots: [], dist: null, dud: false,
    worth: (r.doors.length === 1 ? 3 : 1) * (r.kind === 'special' ? 2 : 1) * (0.5 + 0.5 * Math.max(1, Math.min(3, Math.ceil(detour(r) / 2)))) * (level.pursuer && level.pursuer.room === r.id ? 0.02 : 1) });
  const slots = [], chosen = [];
  // rooms off the way out; only a building with none of those (or no floor left in them) hides anything on it
  for (const pool of [able.filter((r) => detour(r) > 0).map(entry), able.filter((r) => detour(r) <= 0).map(entry)]) {
    // one coin to a room; a room beside one already chosen is much less likely, so they end up spread over the building
    while (slots.length < want.coins.length) {
      const open = pool.filter((k) => !k.spots.length && !k.dud);
      if (!open.length) break;
      const k = R.weighted(open, (q) => chosen.reduce((w, c) => { const d = c.dist.get(q.room.id); return w * (d === 1 ? 0.2 : d === 2 ? 0.6 : 1); }, q.worth));
      const spot = coinSpot(k.room, k.R);
      if (!spot) { k.dud = true; continue; }
      k.spots.push(spot); k.dist = roomDistances(level, k.room.id); chosen.push(k);
      slots.push({ room: k.room.id, ...spot });
    }
    // fewer such rooms than coins: the rest double up, as far apart as their room allows
    const mine = chosen.filter((k) => pool.includes(k));
    for (let i = 0, misses = 0; mine.length && slots.length < want.coins.length && misses < mine.length; i++) {
      const k = mine[i % mine.length], spot = coinSpot(k.room, k.R, k.spots);
      if (spot) { k.spots.push(spot); slots.push({ room: k.room.id, ...spot }); misses = 0; } else misses++;
    }
    if (slots.length >= want.coins.length) break;
  }
  // the coins still to be found take the hiding places in the order they were chosen. Down here a coin is a video
  // cassette (loot.js), and somebody has written on each: the same words on the same coin, whichever others are left.
  const names = { name: level.name, agents: level.cast, projects: level.projects };
  loot.coins = slots.map((s, i) => { const n = want.coins[i], rl = makeRng(`${want.tapes ?? level.seed}/tape/${n}`); return { n, room: s.room, x: s.x, z: s.z, label: rl.pick(TAPE_LABELS).map((t) => fill(t, names, rl)) }; });
  return loot;
}

/**
 * One visit.
 * @param {string|number} seed
 * @param {{name?:string, projects?:string[], agents?:string[], tasks?:string[], only?:string|string[], count?:number, pursuer?:boolean,
 *          loot?:{card?:boolean, coins?:number[]}}} [opt]  loot: what is still to be found down here (see above); leave it out and nothing is hidden
 * @returns {{seed, rooms, links, windows, start, exit, pursuer, picked, hint, stamp, hum, cast, projects, loot?}}
 */
export function generate(seed, opt = {}) {
  const o = names(opt), want = wanted(opt.loot);
  const keeper = !!(want && want.card);                  // the keycard is in the mascot's hand: this visit has a mascot
  for (let attempt = 0; attempt < 80; attempt++) {
    const R = makeRng(`backrooms:${seed}:${attempt}`);
    const level = build(R, o, opt);
    if (!level) continue;
    const extra = dress(R.fork('dress'), level, o, keeper ? { ...opt, pursuer: true } : opt, keeper);
    if (!extra) continue;                                   // (a floor with no wall that could be the thin one is dealt again)
    const rooms = level.rooms.map((r) => { const { links: _l, pts: _p, stairs: _s, ...rest } = r; return rest; });
    const out = { seed: String(seed), name: o.name, theme: themeOf(opt.theme).id, cast: o.agents, projects: o.projects, rooms, links: level.links, picked: level.specials.map((r) => r.arch), ...extra };
    if (want) out.loot = stash(out, want, R.fork('loot'));
    return out;
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

/** A map in characters, for the console and the tests: S start, X exit, letters for oddities, digits for plain rooms off the level. */
export function sketch(level) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of level.rooms) { x0 = Math.min(x0, r.x); z0 = Math.min(z0, r.z); x1 = Math.max(x1, r.x + r.w); z1 = Math.max(z1, r.z + r.d); }
  const rows = Array.from({ length: z1 - z0 }, () => new Array(x1 - x0).fill(' '));
  const legend = [];
  for (const r of level.rooms) {
    const ch = r.kind === 'start' ? 'S' : r.kind === 'exit' ? 'X' : r.kind === 'plain' ? (r.crawl ? '~' : r.y > 0.01 ? '+' : r.y < -0.01 ? '-' : '.') : String.fromCharCode(97 + level.picked.indexOf(r.arch));
    if (r.kind === 'special') legend.push(`${ch} ${r.arch}`);
    for (let i = 0; i < r.w; i++) for (let j = 0; j < r.d; j++) rows[r.z - z0 + j][r.x - x0 + i] = (i === 0 || j === 0) && r.kind === 'plain' ? ',' : ch;
  }
  return rows.map((row) => row.join('')).join('\n') + '\n' + legend.join('  ');
}
