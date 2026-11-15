// The Backrooms — the last three seconds, on the building's own camera. Pure.
//
// The picture of a visit is the visitor's camcorder. When the last heart goes,
// the camcorder is not what records it: the tape cuts to a fixed camera high
// in a corner of that room, and what it shows is the visitor's own office
// character where they stood and whatever took them. Then static, then the
// card. (The owner: "Zooming out to see our cute voxel character wrapped in
// static tentacles and pulled into another dimension would sell it more than
// a FPS black screen", and of this way of doing it, "security camera works
// great!") It is only for a visit that ends by being caught: a flat battery,
// giving up and the way out end as they always did, and a hit that is
// survived stays in first person.
//
// What happens in those seconds is the taker's to say (cast: `takes(shot)`,
// docs/BACKROOMS.md). With nothing said, the character goes down where it is.
// So is where it is filmed from, if the corner would not show it (`films(shot)`:
// the owner, "let rooms choose where the ending is filmed from").

export const SHOT = Object.freeze({
  seconds: 3,        // how long the building's camera has the picture
  step: 0.1,         // it is not a good camera: what it sees moves ten times a second
  inset: 0.45,       // metres in from the corner
  drop: 0.32,        // …and down from the ceiling
  least: 1.8,        // a corner nearer the visitor than this shows the top of a head
  most: 9,           // …and one further than this shows a dot
});

/**
 * Where the camera is and which way it looks.
 * @param room  { x0, z0, x1, z1, y, H } the room the visitor is in (its floor area, floor height, ceiling height), or null
 * @param spot  { x, y, z, yaw } where they stood (y: the floor), and which way they faced
 * @param sees  (x, z) => is there a line of sight from there to the spot?
 * @returns {{x:number, y:number, z:number, yaw:number, pitch:number}}  as the level's camera is turned (yaw 0 looks toward -z; pitch up is positive)
 */
export function cameraFor(room, spot, sees = () => true) {
  const chest = spot.y + 0.9, top = room ? room.y + room.H - 0.08 : spot.y + 2.3;
  const at = (x, y, z) => { const dx = spot.x - x, dz = spot.z - z, flat = Math.hypot(dx, dz) || 1e-6; return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(chest - y, flat) }; };
  if (room) {
    const k = SHOT.inset, y = Math.min(top, Math.max(spot.y + 1.2, room.y + room.H - SHOT.drop));
    const corners = [[room.x0 + k, room.z0 + k], [room.x1 - k, room.z0 + k], [room.x0 + k, room.z1 - k], [room.x1 - k, room.z1 - k]]
      .map(([x, z]) => ({ x, z, d: Math.hypot(x - spot.x, z - spot.z) }))
      .filter((c) => c.d >= SHOT.least && sees(c.x, c.z)).sort((a, b) => b.d - a.d);
    // the furthest corner that is not too far to see anything from; failing that, the nearest of the far ones
    const pick = corners.find((c) => c.d <= SHOT.most) || corners[corners.length - 1];
    if (pick) return at(pick.x, y, pick.z);
  }
  // nowhere to hang one (a doorway, a room too small, a pillar in every line): over their shoulder, as high as there is
  for (const back of [2.4, 1.6, 0.9]) {
    const x = spot.x + Math.sin(spot.yaw) * back, z = spot.z + Math.cos(spot.yaw) * back;
    if (sees(x, z)) return at(x, Math.min(top, spot.y + 2.1), z);
  }
  return at(spot.x + 0.01, Math.min(top, spot.y + 2.3), spot.z + 0.01);
}

/**
 * A camera where the taker asked for one (cast and rooms: `films(shot)`), looking at what it asked to have looked at.
 * @param from  { x, y, z, at?: { x, y, z } } where it hangs, and what it is trained on (else the visitor's chest)
 * @param spot  { x, y, z } where the visitor stood (y: the floor)
 * @returns the same as cameraFor, or null if what was asked for is no place at all (or is on top of what it looks at)
 */
export function cameraFrom(from, spot) {
  const to = from?.at ?? { x: spot.x, y: spot.y + 0.9, z: spot.z };
  if (![from?.x, from?.y, from?.z, to.x, to.y, to.z].every(Number.isFinite)) return null;
  const dx = to.x - from.x, dz = to.z - from.z, flat = Math.hypot(dx, dz);
  if (flat < 0.5) return null;
  return { x: from.x, y: from.y, z: from.z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(to.y - from.y, flat) };
}

/** With nobody to say otherwise: how far over the character has gone, 0 (standing) to 1 (down), `t` seconds in. */
export function slumps(t) {
  const k = Math.max(0, Math.min(1, (t - 0.55) / 0.7));
  return k * k * (3 - 2 * k);
}
