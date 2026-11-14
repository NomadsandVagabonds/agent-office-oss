// An optional response to the inventory's floor fires. Cast owners can use
// the same threat query for other hostile walkers; friendly cutouts ignore it.
export const FIRE_FEAR = Object.freeze({ speed: 2.7, memory: 1.5 });
const TURNS = [0, .55, -.55, 1.05, -1.05, 1.5, -1.5];

/** Move away from a visible fire, including while watched. Returns whether
 * this frame belongs to fear, so normal pursuit/reaching must not also run. */
export function retreatFromFire(env, actor, dt, { stand, stride }) {
  if (!Number.isFinite(dt) || dt <= 0 || actor.state === 'caught' || env.player?.me.frozen) return false;
  const world = env.world, fire = env.inventory?.fire?.threatAt(actor.x, actor.z, world.floorY(actor.x, actor.z));
  if (fire) actor.fireFear = { x: fire.x, z: fire.z, left: FIRE_FEAR.memory };
  else if (actor.fireFear) actor.fireFear.left = Math.max(0, actor.fireFear.left - dt);
  if (!actor.fireFear?.left) { actor.fireFear = null; return false; }

  const from = actor.fireFear, dx = actor.x - from.x, dz = actor.z - from.z;
  // A fire placed exactly under a future spawn still has a deterministic way
  // out, rather than an undefined heading or a teleport toward the player.
  const angle = Math.hypot(dx, dz) > .001 ? Math.atan2(dx, dz) : actor.yaw + Math.PI;
  actor.state = 'awake'; actor.to = actor.leg = null; actor.idle = 0;
  actor.unseen = 0; actor.rolled = false; actor.chase = 0;
  const safe = (x, z) => stand(actor, x, z)
    && Math.abs(world.floorY(x, z) - world.floorY(actor.x, actor.z)) < .6;
  if (actor.plinth) {
    // The mascot's existing plinth is solid. Step off on the fire's far side
    // using the same short step its ordinary wake-up already uses.
    for (const turn of TURNS) {
      const yaw = angle + turn, x = actor.x + Math.sin(yaw) * .95, z = actor.z + Math.cos(yaw) * .95;
      const edgeX = actor.x + Math.sin(yaw) * .8, edgeZ = actor.z + Math.cos(yaw) * .8;
      if (!safe(x, z) || !world.passable(edgeX, edgeZ, x, z)) continue;
      actor.x = x; actor.z = z; actor.plinth = false; break;
    }
  }
  const beforeX = actor.x, beforeZ = actor.z;
  if (!actor.plinth) {
    const distance = FIRE_FEAR.speed * Math.min(dt, .1);
    for (const turn of TURNS) {
      const yaw = angle + turn, x = actor.x + Math.sin(yaw) * distance, z = actor.z + Math.cos(yaw) * distance;
      if (!safe(x, z) || !world.passable(actor.x, actor.z, x, z)) continue;
      stride(actor, x, z, distance); break;
    }
  }
  const went = Math.hypot(actor.x - beforeX, actor.z - beforeZ);
  actor.yaw = went > .001 ? Math.atan2(actor.x - beforeX, actor.z - beforeZ) : angle;
  actor.hold?.(5); // both arms up, head facing its escape route
  if (went > 0) {
    actor.noise -= went;
    if (actor.noise <= 0) { actor.noise = .65; env.play?.('creak', actor.x, actor.z, 7); }
  }
  return true;
}
