// The Office — the lift's floors. Pure data, shared by the daemon (which tells
// agents what the lift serves) and the browser (which takes humans there; it
// loads this very file from /core/levels.mjs).
//
// A level is anywhere the lift can open its doors: more office, a place to
// sit, a game, a work surface. This file only NAMES the floors. What a level
// *is* — an ES module exporting `enter(office, opt)` — lives with the client:
// public/world/levels/index.js maps each id to its module. See "Levels" in
// WORLD.md for how to add one.
//
//   id      stable name: the client finds the module by it, links use it (/?level=roof)
//   floor   what is engraved on the button
//   name    what the announcer says when the doors open
//   blurb   one line, for the panel and for agents
//   kind    'office' | 'place' | 'game' | 'work'
//   storey  where the car stops, counted from the lobby (0); the ride counts through these
//   hidden  optional rule: a pure function of { quirks, found } that returns true
//           while the button should not exist. `quirks` is today's calendar
//           (dayQuirks in secrets.mjs), `found` the ids of discoveries anyone has made.
//   card    this floor is one of the games: its button stays dark until a keycard opens it
//           (one of them, drawn by lot, is open from the start — see core/game.mjs), and it
//           hides a keycard of its own, which opens another
//   coins   how many coins are hidden there (they do not come back once taken)
//   unmarked  the button has no engraving and the plate beside it is blank
//   car     [x, z] — set on floors an AGENT can ride to (they need a text side too:
//           server/world/floors.mjs). It is the tile of the lift car the agent stands
//           on while it is away, so that anyone reading the floor plan — the 3D
//           client, for one — can tell which button was pressed.

export const LEVEL_KINDS = Object.freeze(['office', 'place', 'game', 'work']);

/** The floor everyone starts on, and the one Esc brings you back to. */
export const HOME = 'lobby';

// In the order they appear on the panel: top of the building first.
export const LEVELS = Object.freeze([
  { id: 'nightshift', floor: 'N', storey: 4, kind: 'game', name: 'Night Shift', card: true, coins: 2,
    blurb: 'The office in black and white. Stay out of the security lights. Clock out.' },
  { id: 'scranton', floor: 'S', storey: 3, kind: 'game', name: 'Scranton Paper Co.', card: true, coins: 3,
    blurb: 'A very ordinary paper company. Reception has a memo about a very ordinary stapler.' },
  { id: 'roof', floor: 'R', storey: 2, kind: 'place', name: 'Rooftop Garden',
    blurb: 'Open air above the office: planters, benches, a telescope, and the skyline all round.' },
  { id: 'mission', floor: 'M', storey: 1, kind: 'work', name: 'Mission Control',
    blurb: 'A dim room of live wall screens: who is waiting on the human, every board, who is on what.' },
  { id: 'lobby', floor: 'L', storey: 0, kind: 'office', name: 'Lobby',
    blurb: 'The office itself: project rooms, the plaza, the kitchen, the library.' },
  { id: 'pasture', floor: 'P', storey: -1, kind: 'place', name: 'The Pasture', car: [-1, -10], card: true, coins: 3,
    blurb: 'Lower ground, where the car park would be. Mind the goats.' },
  { id: 'afterhours', floor: 'A', storey: -2, kind: 'game', name: 'After Hours', car: [0, -10], card: true, coins: 3,
    blurb: 'The office at night with the build broken, and the bugs out of their cabinet. Take the mallet.' },
  { id: 'thirteen', floor: '13', storey: 13, kind: 'place', name: 'Floor Thirteen',
    blurb: 'Not on the plans. The button was not there yesterday.', unmarked: true,
    hidden: ({ quirks = [], found = [] } = {}) => !(quirks.includes('friday-13') || found.includes('noclip')) },
].map((level) => Object.freeze({ ...level, car: level.car ? Object.freeze(level.car) : undefined })));

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));
export const levelById = (id) => BY_ID.get(id) || null;

/** A level by its id or by what is written on its button ("roof", "R", "13"). */
export function findLevel(ref) {
  const text = String(ref ?? '').trim().toLowerCase();
  if (!text) return null;
  return LEVELS.find((l) => l.id === text || l.floor.toLowerCase() === text) || null;
}

/** Does the button for this level exist right now? */
export function isVisible(level, ctx = {}) {
  if (!level) return false;
  if (typeof level.hidden !== 'function') return true;
  return !level.hidden({ quirks: [...(ctx.quirks || [])], found: [...(ctx.found || [])] });
}

/** The buttons on the panel right now, top floor first. */
export const visibleLevels = (ctx = {}) => LEVELS.filter((l) => isVisible(l, ctx));

/**
 * Has this floor's button been lit? Floors that need no keycard always are. `ctx.open` is the list of card
 * floors the office has opened; where nobody has said (an older daemon, a page still loading) nothing is held back.
 */
export function isOpen(level, ctx = {}) {
  if (!level) return false;
  return !level.card || !Array.isArray(ctx.open) || ctx.open.includes(level.id);
}

/** What the panel shows: the floors you can ride to, and how many buttons are still dark. */
export function panelLevels(ctx = {}) {
  const all = visibleLevels(ctx);
  return { levels: all.filter((l) => isOpen(l, ctx)), dark: all.filter((l) => !isOpen(l, ctx)).length };
}

/** Which floor an agent's placement says it has ridden to (see `car`), or null if it is simply in the office. */
export function floorOfPlacement(place) {
  if (!place || place.room !== 'elevator' || place.leaving) return null;
  return LEVELS.find((l) => l.car && l.car[0] === Math.floor(place.x) && l.car[1] === Math.floor(place.z)) || null;
}

/** What the hidden rules look at, read from a world snapshot (GET /api/world, or the `world` event). */
export function levelContext(world) {
  const game = Array.isArray(world?.game?.open) ? world.game : null;
  return { quirks: world?.today?.quirks || [], found: Object.keys(world?.discoveries || {}),
    // which card floors are lit, and which of those nobody has ridden to yet (core/game.mjs) — where the office keeps score at all
    ...(game ? { open: game.open, fresh: Array.isArray(game.fresh) ? game.fresh : [] } : {}) };
}
