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
//   headline true: the place has half-remembered something from the news and staged it wrongly. Which stories become
//            rooms is the owner's choice, nobody else's; the plan puts at most one in a visit, never on its first floor.

import { freightStash } from './rooms/dispatch/layout.js';

const cornerStash = (r, side) => (side < 0
  ? [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.35, -r.D / 2 + 1.35]
  : [r.W / 2 - 1.35, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.35]);


const HALL_FACES = ['break', 'waiting', 'store', 'lounge'];        // (as rooms/unsure-hall.js builds them)

export const MORE_DECK = [
  // The hallway that is not sure where it leads: turn your back on the room at the end of it and it is another room.
  // Never dealt by chance: the visit's plan puts one or two in, below wherever the cardboard people were (plan.js).
  { id: 'unsure-hall', name: 'The Hall That Is Not Sure', landmark: 'the long hallway, whichever room it ends in',
    w: [7, 8], d: [13, 15], ports: ['back'], weight: 1, lights: 'normal', planned: true, needs: ['unwatched'],
    module: './rooms/unsure-hall.js',
    stash: (r) => { const zM = -r.D / 2 + Math.min(7.5, r.D * 0.48); return [-0.5, zM - 2.4, 0.5, zM - 1.4]; },
    roll: (R) => ({ faces: R.shuffle(HALL_FACES.slice()).slice(0, R.int(1, 3)) }) },
  // Dispatch (after Codex's): the first room from the news. Wordless and unnamed. One a visit at most, where the plan puts it.
  { id: 'dispatch', name: 'Dispatch', landmark: 'the wooden shipping crates', w: [18, 20], d: [20, 20], h: [5, 6], ports: [], weight: 0.45, lights: 'dim',
    headline: true, big: true, module: './rooms/dispatch.js', stash: (r) => freightStash(r),
    roll: (R) => ({ layoutSeed: R.int(1, 0x7fffffff), wood: R.pick(['#9b7950', '#8b7350', '#a0875d']) }) },  // Rooms with somebody living in them (after Gemini's third pack). A part of the building gets one of these at most
  // (plan.js). resident: who it is, for the count of a visit · items: what they care about that a visitor might carry
  // (supplies.js leaves such things about on that part) · caught: the hearts it costs to be got by them.
  {
    id: 'cable-drop',
    resident: 'trunk-line', items: [], teaches: 'overhead', caught: 1,
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
    resident: 'stand-ins', items: ['torch'], teaches: 'beam', caught: 2,
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
