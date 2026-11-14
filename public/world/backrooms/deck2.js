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

const cornerStash = (r, side) => (side < 0
  ? [-r.W / 2 + 0.65, -r.D / 2 + 0.65, -r.W / 2 + 1.35, -r.D / 2 + 1.35]
  : [r.W / 2 - 1.35, -r.D / 2 + 0.65, r.W / 2 - 0.65, -r.D / 2 + 1.35]);

export const MORE_DECK = [
  {
    id: 'cable-drop',
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
