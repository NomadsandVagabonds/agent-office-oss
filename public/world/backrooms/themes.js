// The Backrooms — what each floor is like. Pure data. A visit goes down
// through several floors, and no two of them are the same kind of place: the
// yellow one everybody remembers is only where you land. A theme changes what
// the generator rolls, never how it works: which wallpapers are likely, how
// the ceiling behaves, how the plain rooms are proportioned, what gets left
// lying about, and how the mains sounds.
//
//   families   wallpaper family → weight (gen.js FAMILIES); missing: that family's own weight
//   patterns   what the paper is printed with (kit.js draws them); null: the usual motifs
//   tubes      the colour of the light
//   light      dead: [lo, hi] share of panels that are out · flicker: chance a room has a tube that cannot decide
//              modes: [[mode, weight]…] how a plain room's ceiling behaves (normal | dim | dark | one)
//   rooms      where a plain room's proportions are cut: [crawl, corridor one way, corridor the other, ordinary] (the rest are halls)
//   heights    [[ceiling height, weight]…] for plain rooms
//   dressing   what somebody left behind, most likely first (the generator's own list if null)
//   hum        mains hum, Hz (null: rolled)
//   own        true: only rooms made for it are dealt here. A line of the deck that does not name this kind of floor is not
//              at home on it, whatever it says of the others (atHome, below). The rest of the building still comes:
//              doorways, the ways down, the cast
//   dealt      false: still being built. It is in nobody's visit until this line goes: only ever a floor that was asked
//              for by name (plan.js `themes`; the dev page's &themes=), which is how a new kind of floor is made in the
//              open, a room at a time. Taking the line out is also what holds it to the tests of a finished one

export const THEMES = {
  // the one everybody remembers: mono-yellow, humming, slightly damp
  yellow: { id: 'yellow', families: null, patterns: null, tubes: null, light: { dead: [0.06, 0.3], flicker: 0.4, modes: [['normal', 1]] },
    rooms: null, heights: null, dressing: null, hum: null },

  // Records. Painted blockwork, lino, long narrow rooms, a tube in every one that is on its way out
  archive: { id: 'archive', families: { records: 12, beige: 3, sage: 2, mint: 1 }, patterns: ['blocks', 'blocks', 'blocks', 'stripes'], tubes: ['#eef6ff', '#f3ffe6', '#eef6ff', '#fffbe9'],
    light: { dead: [0.22, 0.5], flicker: 0.75, modes: [['normal', 5], ['dim', 4], ['one', 1]] },
    rooms: [0.07, 0.42, 0.62, 0.9], heights: [[2.6, 40], [2.2, 30], [2.9, 6], [1.75, 10]],
    dressing: ['boxes', 'boxes', 'boxes', 'cabinet', 'cabinet', 'cabinet', 'papers', 'papers', 'shelving', 'shelving', 'bin', 'clock', 'stain', 'ladder', 'fan', 'tile', 'highdoor', 'trolley'],
    hum: 50 },

  // Out of hours. The same building with the lights off: a panel here and there left on for the cleaners
  night: { id: 'night', families: { blue: 6, yellow: 5, lilac: 2, mint: 2 }, patterns: null, tubes: ['#dfe9ff', '#eef6ff', '#e6f0ff'],
    light: { dead: [0.3, 0.6], flicker: 0.5, modes: [['dark', 9], ['one', 7], ['dim', 3]] },
    rooms: null, heights: null,
    dressing: ['wetsign', 'wetsign', 'bin', 'bin', 'chair', 'plant', 'lamp', 'lamp', 'lamp', 'papers', 'coat', 'fan', 'clock', 'trolley', 'trolley', 'highdoor', 'tile'],
    hum: 60 },

  // Being refurbished, and has been for some time: bare board with the joints taped, screed underfoot, half the ceiling still to go in
  fitout: { id: 'fitout', families: { board: 14 }, patterns: ['board'], tubes: ['#fffbe9', '#fff6dc', '#f3ffe6'],
    light: { dead: [0.35, 0.6], flicker: 0.3, modes: [['normal', 6], ['dim', 3], ['one', 1]] },
    rooms: [0.05, 0.2, 0.34, 0.7], heights: [[2.6, 30], [2.9, 20], [3.3, 20], [4.4, 12]],
    dressing: ['ladder', 'ladder', 'ladder', 'tile', 'tile', 'tile', 'boxes', 'boxes', 'rolls', 'rolls', 'rolls', 'trestle', 'trestle', 'bin', 'wetsign', 'worklamp', 'worklamp', 'papers', 'highdoor'],
    hum: 50 },

  // The top floor, which is down here as well: panelling, a deep carpet, lamps instead of tubes wherever they could manage it
  exec: { id: 'exec', families: { panel: 12, lilac: 1 }, patterns: ['panel'], tubes: ['#ffeec4', '#fff6dc', '#ffe9b8'],
    light: { dead: [0.15, 0.4], flicker: 0.15, modes: [['normal', 4], ['dim', 5], ['one', 1]] },
    rooms: [0.03, 0.16, 0.3, 0.62], heights: [[2.9, 30], [3.3, 30], [2.6, 20], [4.4, 8]],
    dressing: ['lamp', 'lamp', 'lamp', 'plant', 'plant', 'chair', 'clock', 'clock', 'frame', 'frame', 'frame', 'poster', 'coat', 'coat', 'globe', 'armchair', 'armchair', 'highdoor'],
    hum: 50 },

  // A neighbourhood, as an office remembered one and built it indoors: sky-blue emulsion, fake grass cut short of the walls
  // so that the carpet shows, every tube working because it is always the middle of the day (suburb.js)
  suburb: { id: 'suburb', own: true, featured: true, families: { sky: 12 }, patterns: ['sky'], tubes: ['#fffbe9', '#f3ffe6', '#eef6ff'],
    light: { dead: [0.03, 0.16], flicker: 0.2, modes: [['normal', 1]] },
    // (mostly passages: a neighbourhood is got about by alleys, between fences and the backs of things. A lawn is where one comes out)
    rooms: [0.1, 0.36, 0.6, 0.9], heights: [[2.6, 34], [2.2, 22], [2.9, 16], [3.3, 10], [1.75, 10], [4.4, 6]],
    dressing: ['mailbox', 'mailbox', 'flamingo', 'flamingo', 'hose', 'hose', 'wetsign', 'ladder', 'boxes'],
    hum: 60 },

  // A shopping centre at closing time, as a 1980s office park remembered one and built it out of itself: partition walls for
  // shopfronts, terrazzo where the carpet tile ran out, half the tubes already off. Mostly passages. Still being built (mall.js)
  mall: { id: 'mall', own: true, dealt: false, families: { oatmeal: 12 }, patterns: ['mall'], tubes: ['#ffe9c2', '#ffdcae', '#fff0d6'],
    light: { dead: [0.3, 0.55], flicker: 0.3, modes: [['dim', 5], ['normal', 2], ['one', 1]] },
    rooms: [0.1, 0.38, 0.62, 0.9], heights: [[2.6, 40], [2.2, 24], [2.9, 16], [3.3, 10], [1.75, 6], [4.4, 4]],
    dressing: ['plant', 'plant', 'plant', 'wetsign', 'wetsign', 'bin', 'boxes', 'chair', 'clock', 'ladder'],
    hum: 50 },
  // An indoor waterpark and Poolrooms annex, built inside the office by something that had only ever had swimming,
  // recreation and hydration described to it: grouted ceramic tile stopping short of the damp carpet, chlorinated basins
  // under a suspended acoustic ceiling. Still being built (waterpark.js)
  waterpark: { id: 'waterpark', own: true, dealt: false, families: { pool: 12, seafoam: 6 }, patterns: ['tiles'], tubes: ['#e8fbff', '#eef6ff', '#f3ffe6'],
    light: { dead: [0.04, 0.18], flicker: 0.22, modes: [['normal', 1]] },
    rooms: [0.02, 0.12, 0.22, 0.56], heights: [[2.9, 24], [3.3, 34], [3.8, 22], [4.4, 14]],
    dressing: ['floatring', 'floatring', 'noodle', 'noodle', 'lounger', 'wetsign', 'ladder'],
    hum: 60 },


};

export const THEME_IDS = Object.keys(THEMES);
/**
 * How much at home a line of the deck is on a kind of floor: a multiplier on how often it is dealt there, and 0 is never.
 * What its `themes` says of that floor; failing that, 0 on a floor that keeps to its own (`own`); failing that, what it
 * says of every floor it does not name (`'*'`: a room made for one kind of floor says `{ thatFloor: 1, '*': 0 }`), or 1.
 */
export const atHome = (line, id, themes = THEMES) => (line.themes && line.themes[id]) ?? (themes[id] && themes[id].own ? 0 : (line.themes && line.themes['*']) ?? 1);
/** The kinds of floor a visit may be dealt: every one that is not still being built (`dealt: false`). */
/**
 * The kinds of floor that are not an office (`featured: true`): every visit has one of them, on a middle part (plan.js), so
 * that no visit is offices all the way down. One for now; the day there are more, a visit is dealt one of them.
 */
export const featuredThemes = (themes = THEMES) => Object.keys(themes).filter((id) => themes[id].featured && themes[id].dealt !== false);
export const dealtThemes = (themes = THEMES) => Object.keys(themes).filter((id) => themes[id].dealt !== false);
/** A theme by id, or the yellow one. */
export const themeOf = (id) => (id && typeof id === 'object' ? id : THEMES[id] || THEMES.yellow);
