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
//   headline true: the place has half-remembered something from the news and staged it wrongly. Which stories become
//            rooms is the owner's choice, nobody else's; the plan puts at most one in a visit, never on its first floor.

import { freightStash } from './rooms/dispatch/layout.js';

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
    roll: (R) => ({ layoutSeed: R.int(1, 0x7fffffff), wood: R.pick(['#9b7950', '#8b7350', '#a0875d']) }) },
];

// Where a tape goes in an entry that does not say so itself: (room, ±1) → [x0, z0, x1, z1] in the room's own frame.
export const MORE_STASH = {};
