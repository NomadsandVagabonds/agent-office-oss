// The Show Home — where the house stands in its room. Pure: the deck (deck2.js, for the hiding place) and the builder
// (rooms/show-home.js) both ask, so that they agree. Everything in the room's own frame, metres.

/** The house: how wide, how deep, how high its walls and how much higher its ridge; how thick a wall; the door. */
export const HOME = Object.freeze({ w: 7.2, d: 4.4, wall: 2.7, rise: 1.5, t: 0.14, eave: 0.4, behind: 2.3, yard: 4.0, side: 1.3, door: Object.freeze({ at: -1.3, w: 1.0, h: 2.05 }) });

/** → the house's corners (x0, x1, back, front), its ridge, and the fence round the grass in front of it (fx0, fx1, fenceZ). */
export function homePlan(r) {
  const back = -r.D / 2 + HOME.behind, front = back + HOME.d;
  return { x0: -HOME.w / 2, x1: HOME.w / 2, back, front, mid: (back + front) / 2, ridge: HOME.wall + HOME.rise, slope: HOME.rise / (HOME.d / 2),
    fx0: -HOME.w / 2 - HOME.side, fx1: HOME.w / 2 + HOME.side, fenceZ: front + HOME.yard, doorX: HOME.door.at };
}
/** Inside the house, in the corner furthest from its front door: it has to be gone into. */
export const homeStash = (r) => { const p = homePlan(r); return [p.x1 - 1.35, p.back + 0.45, p.x1 - 0.55, p.back + 1.25]; };
