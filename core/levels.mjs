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
//   unmarked  the button has no engraving and the plate beside it is blank

export const LEVEL_KINDS = Object.freeze(['office', 'place', 'game', 'work']);

/** The floor everyone starts on, and the one Esc brings you back to. */
export const HOME = 'lobby';

// In the order they appear on the panel: top of the building first.
export const LEVELS = Object.freeze([
  { id: 'roof', floor: 'R', storey: 2, kind: 'place', name: 'Rooftop Garden',
    blurb: 'Open air above the office: planters, benches, a telescope, and the skyline all round.' },
  { id: 'mission', floor: 'M', storey: 1, kind: 'work', name: 'Mission Control',
    blurb: 'A dim room of live wall screens: who is waiting on the human, every board, who is on what.' },
  { id: 'lobby', floor: 'L', storey: 0, kind: 'office', name: 'Lobby',
    blurb: 'The office itself: project rooms, the plaza, the kitchen, the library.' },
  { id: 'pasture', floor: 'P', storey: -1, kind: 'place', name: 'The Pasture',
    blurb: 'Lower ground, where the car park would be. Mind the goats.' },
  { id: 'arcade', floor: 'A', storey: -2, kind: 'game', name: 'Arcade',
    blurb: 'The basement: a row of cabinets and a wall of high scores.' },
  { id: 'thirteen', floor: '13', storey: 13, kind: 'place', name: 'Floor Thirteen',
    blurb: 'Not on the plans. The button was not there yesterday.', unmarked: true,
    hidden: ({ quirks = [], found = [] } = {}) => !(quirks.includes('friday-13') || found.includes('noclip')) },
].map((level) => Object.freeze(level)));

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

/** What the hidden rules look at, read from a world snapshot (GET /api/world, or the `world` event). */
export function levelContext(world) {
  return { quirks: world?.today?.quirks || [], found: Object.keys(world?.discoveries || {}) };
}
