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

export const MORE_DECK = [
  { id: 'mecha', name: 'MECHA Training Floor', landmark: 'the people in cages training their replacements',
    w: [24, 26], d: [24, 26], h: [5.6, 5.6], ports: ['left', 'right', 'back'], weight: 0.6,
    lights: 'dark', big: true, planned: true, module: './rooms/mecha.js',
    stash: (r) => [-3.6, r.D / 2 - 1.6, -2.6, r.D / 2 - 0.8],
    roll: (R) => ({ percentages: [97.8, 84.2, 92.6, 76.4, 99.5, 88.1, 95.2, 81.7].map(n => +(n + R.range(-0.3, 0.3)).toFixed(1)),
      batch: R.int(104, 980), variation: R.int(0, 4) }) },
];

// Where a tape goes in an entry that does not say so itself: (room, ±1) → [x0, z0, x1, z1] in the room's own frame.
export const MORE_STASH = {};
