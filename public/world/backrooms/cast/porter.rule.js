// The Backrooms — the night porter's rule (cast/porter.js is the creature).
// Pure. He mops a dry carpet beside a bucket, and whichever way you come at
// him he has his back to you. Leave the bucket alone and that is all he does.
// Knock it over and he stops, and turns round, slowly, and that is the first
// you see of his face: there is not one, only what a face would be if it had
// been clay and left by a radiator. The room goes dim, and stays so; walk out
// leaving it on its side and he locks up — every door on the floor is shut
// behind you. Stand it up again and he goes back to his mopping, and the first
// time anybody does that, his locker is open.

export const PORTER = Object.freeze({
  knock: 0.42,      // walk within this of the bucket and it goes over, metres
  dim: 0.22,        // what the room's tubes drop to while it lies there
  turn: 9,          // how fast he turns his back, radians a second: faster than anybody can get round him
  sway: 26, damp: 2.2,  // the strand off his chin: how hard it is pulled back to hanging straight, and how soon it settles
  round: 1.1,       // …and how slowly he turns to face you, once there is something the matter
});

/** Which way he has to you: his back while he mops, his face for as long as the bucket is on its side. */
export const facesYou = (s) => s.mode !== 'mop';

export function mopping() { return { mode: 'mop', thanked: false, knocked: false, righted: false, lockUp: false, gift: false }; }

/**
 * One moment of him.
 * @param sense  { bucket: how far you are from the bucket, metres · moving: you are walking · righted: you have just stood it up (E) · inRoom: you are in his room }
 * @returns { mode: 'mop' | 'upset' | 'shut', thanked, knocked: it went over this moment, righted: it was stood up this moment,
 *            lockUp: he locks up this moment, gift: his locker opens this moment }
 */
export function minds(s, dt, sense) {
  const n = { ...s, knocked: false, righted: false, lockUp: false, gift: false };
  if (s.mode === 'mop') {
    if (sense.moving && sense.bucket < PORTER.knock) { n.mode = 'upset'; n.knocked = true; }
    return n;
  }
  if (sense.righted) { n.mode = 'mop'; n.righted = true; n.gift = !s.thanked; n.thanked = true; return n; }
  if (s.mode === 'upset' && !sense.inRoom) { n.mode = 'shut'; n.lockUp = true; }
  return n;
}
