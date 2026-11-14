// The Backrooms — the desk moth's rule (cast/moth.js is the creature). Pure.
// It goes round the nearest tube that is lit. Come up to it and it is off to
// the next room's tube, and waits there, going round, until you come up to it
// again — and the rooms it chooses are the ones on the way to the way down.
// It is a moth: a lit torch in your hand is the best light in the building,
// and while you hold one it goes round you instead and leads nowhere.
// And a fire is a better light than either. It goes to one it can see, round
// it, lower each time — and that is the end of the moth, for this visit.

export const MOTH = Object.freeze({
  near: 4.2,        // come this close, having seen it, and it is off to the next light
  seen: 0.35,       // seconds it must have been on your screen first: it does not lead somebody who has not noticed it
  speed: 3.4,       // metres a second, on its way
  round: 0.55,      // the radius it goes round a tube at, metres
  far: 3,           // how many rooms ahead of where you land it starts
  burn: 2.4,        // seconds it goes round a fire, once it has got to it, before it goes into it
});

export function resting() { return { mode: 'round', seen: 0, moved: false }; }

/**
 * One moment of it.
 * @param s      what resting() or the last call gave
 * @param sense  { d: how far off you are · seen: it is on your screen · torch: you are holding a lit torch ·
 *                 next: there is a room further along for it to go to · there: (flying) it has got to the next light }
 *                 fire: there is a fire it can see · atFire: it has got to that fire }
 * @returns { mode: 'round' | 'fly' | 'pester' | 'flame' | 'gone', seen, moved: it set off this moment, burnt: it went into the fire this moment }
 */
export function flits(s, dt, sense) {
  const n = { ...s, moved: false, burnt: false };
  if (s.mode === 'gone') return n;
  if (sense.fire) {
    n.mode = 'flame'; n.heat = sense.atFire ? (s.mode === 'flame' ? s.heat || 0 : 0) + dt : 0;
    if (n.heat >= MOTH.burn) { n.mode = 'gone'; n.burnt = true; }
    return n;
  }
  if (s.mode === 'flame') { n.mode = 'round'; n.seen = 0; n.heat = 0; return n; }          // the fire went out first: it goes round wherever it has got to
  if (sense.torch && sense.d < 9) { n.mode = 'pester'; return n; }
  if (s.mode === 'pester') { n.mode = 'round'; n.seen = 0; return n; }
  if (s.mode === 'fly') { if (sense.there) { n.mode = 'round'; n.seen = 0; } return n; }
  n.seen = sense.seen ? s.seen + dt : s.seen;
  if (sense.next && n.seen >= MOTH.seen && sense.d <= MOTH.near) { n.mode = 'fly'; n.moved = true; }
  return n;
}
