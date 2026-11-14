// Three close relatives, repeated rather than decorated. W and D are the
// room's interior dimensions; the existing plain-room renderer supplies the
// wallpaper, full-height mass and collision for each returned pillar.
const WALL = 0.2;
const RIM = 1.5;
const HALF_LANE = 0.8;                    // 1.6 m between the two inner faces
const STAGGER = 1.1;
const MIN_SPAN = 9.8;

const rectangle = (x0, z0, x1, z1) => ({
  x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0,
});

// The same clockwise quarter-turn convention as room-local geometry.
function rotatePoint({ x, z }, turn) {
  if (turn === 1) [x, z] = [z, -x];
  if (turn === 2) [x, z] = [-x, -z];
  if (turn === 3) [x, z] = [-z, x];
  // Keep serialized study fixtures identical to the in-memory plain data.
  return { x: x === 0 ? 0 : x, z: z === 0 ? 0 : z };
}

/**
 * Ordinary partitions with a continuous 1.5 m perimeter and no sealed bays.
 * 0: staggered parallel walls; 1: outward L returns; 2: split offset walls.
 * Integer variant/turn values wrap, so a caller can repeat the small family.
 */
export function quietMazeLayout({ W, D, variant = 0, turn = 0 }) {
  if (!Number.isFinite(W) || !Number.isFinite(D) || W < MIN_SPAN || D < MIN_SPAN) {
    throw new RangeError('Quiet maze rooms need interior dimensions of at least 9.8 m.');
  }
  if (!Number.isInteger(variant) || !Number.isInteger(turn)) {
    throw new TypeError('Quiet maze variant and turn must be integers.');
  }
  variant = ((variant % 3) + 3) % 3;
  turn = ((turn % 4) + 4) % 4;
  // Use the smaller dimension: rotation never steals the outer route from a
  // rectangular room. Larger dimensions simply leave more perimeter space.
  const reach = Math.min(W, D) / 2 - RIM;
  const inner = HALF_LANE, outer = HALF_LANE + WALL;
  const leftTop = reach - STAGGER, rightBottom = -leftTop;
  const pillars = [];

  if (variant === 2) {
    // The openings are equally wide but do not face one another. Their
    // centers are only 1.4 m apart: familiar views, a different next turn.
    pillars.push(
      rectangle(-outer, -reach, -inner, -1.5),
      rectangle(-outer, 0.1, -inner, leftTop),
      rectangle(inner, rightBottom, outer, -0.1),
      rectangle(inner, 1.5, outer, reach),
    );
  } else {
    pillars.push(
      rectangle(-outer, -reach, -inner, leftTop),
      rectangle(inner, rightBottom, outer, reach),
    );
    if (variant === 1) {
      // Overlap the whole wall thickness at each elbow. A hairline gap at
      // a butt joint would look like a passage while still blocking a body.
      pillars.push(
        rectangle(-reach, leftTop - WALL, -inner, leftTop),
        rectangle(inner, rightBottom, reach, rightBottom + WALL),
      );
    }
  }

  // These sample the central aisle, both outside lanes and all four sides.
  // The split variant additionally samples each new crossing itself.
  const rim = reach + RIM / 2;
  const probes = [
    { x: 0, z: 0 }, { x: -2.4, z: 0 }, { x: 2.4, z: 0 },
    { x: 0, z: -rim }, { x: 0, z: rim },
    { x: -rim, z: 0 }, { x: rim, z: 0 },
  ];
  if (variant === 2) probes.push({ x: -0.9, z: -0.7 }, { x: 0.9, z: 0.7 });

  return {
    pillars: pillars.map(p => ({ ...rotatePoint(p, turn), w: turn % 2 ? p.d : p.w, d: turn % 2 ? p.w : p.d })),
    probes: probes.map(p => rotatePoint(p, turn)),
  };
}
