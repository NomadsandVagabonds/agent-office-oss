// The Backrooms — close-quarters scissor defense. Pure: no three.js, no DOM.
// A desperate jab only reaches what is right in front of the camcorder with a
// clear line of sight; swinging into empty air never spends a blade.

export const SNIP_TUNING = Object.freeze({
  reach: 1.72,          // metres from player to target edge: close enough to be dangerous
  minDot: 0.36,         // forward view cone (~69° half-angle before target-radius allowance)
  cooldown: 0.52,       // seconds between scissor jabs
  verticalReach: 1.38,  // vertical reach from camcorder eye height (keeps high ceilings out of reach until a creature drops)
});

const BASE_HALF_CONE = Math.acos(SNIP_TUNING.minDot);

/**
 * Rank snippable targets within forward reach and line of sight.
 * @param me          { x, z, y?, yaw }
 * @param candidates  Array<{ id?:string, x:number, z:number, y?:number, r?:number, reach?:number, verticalReach?:number, priority?:number, snip:Function }>
 * @param los         (ax, az, bx, bz) => boolean
 */
export function rankSnipTargets(me, candidates = [], los = () => true) {
  if (!me || !Number.isFinite(me.x) || !Number.isFinite(me.z) || !Array.isArray(candidates)) return [];
  const yaw = me.yaw || 0, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const hits = [];
  for (const c of candidates) {
    if (!c || typeof c.snip !== 'function' || !Number.isFinite(c.x) || !Number.isFinite(c.z)) continue;
    const r = Math.max(0, c.r ?? 0.3);
    const dx = c.x - me.x, dz = c.z - me.z, dist = Math.hypot(dx, dz);
    const edgeDist = Math.max(0, dist - r);
    if (edgeDist > (c.reach ?? SNIP_TUNING.reach)) continue;
    if (c.y !== undefined && Number.isFinite(me.y) && Math.abs(c.y - me.y) > (c.verticalReach ?? SNIP_TUNING.verticalReach)) continue;
    if (dist > 0.28) {
      const dot = (fx * dx + fz * dz) / dist;
      const allow = Math.min(Math.PI * 0.85, BASE_HALF_CONE + Math.atan2(r + 0.12, dist));
      if (dot < Math.cos(allow)) continue;
    }
    if (!los(me.x, me.z, c.x, c.z)) continue;
    hits.push({ candidate: c, edgeDist, priority: c.priority ?? 1 });
  }
  hits.sort((a, b) => (b.priority - a.priority) || (a.edgeDist - b.edgeDist));
  return hits.map((h) => h.candidate);
}

/**
 * Attempt a close-quarters scissor jab against the nearest valid threat in front of `me`.
 * Returns `{ ok: true, target }` only when a target actually took the hit.
 */
export function strikeSnip(me, candidates = [], los = () => true) {
  for (const c of rankSnipTargets(me, candidates, los)) {
    const outcome = c.snip();
    if (outcome === true || outcome?.ok === true) {
      return { ok: true, target: outcome?.target || c.id || 'entity' };
    }
  }
  return { ok: false, reason: 'no-snip-target' };
}

/** The lawn flamingo's stakes (the owner: "~2 damage"): a jab of the scissors' reach, that lands twice. */
export const STAB = Object.freeze({
  hits: 2,
  handover: 0.19,       // seconds from the click until the hand lets go of it (hand-flamingo.rule.js STAB.draw + STAB.drive): the one left in the creature shows from then
});

/**
 * A stab with the flamingo: the nearest thing in front a jab could reach takes STAB.hits jabs, through its own snip()
 * (each of the cast does what a jab does to it, twice: a medium one is finished, a boss is not). → { ok, target,
 * candidate: what it went into (for where the flamingo is left), killed } or { ok: false }.
 */
export function strikeStab(me, candidates = [], los = () => true) {
  for (const c of rankSnipTargets(me, candidates, los)) {
    let first; try { first = c.snip(); } catch { first = null; }
    if (!(first === true || first?.ok === true)) continue;
    let killed = !!first?.killed;
    for (let i = 1; i < STAB.hits && !killed; i++) {
      let more; try { more = c.snip(); } catch { more = null; }
      if (!(more === true || more?.ok === true)) break;
      killed = !!more?.killed;
    }
    return { ok: true, target: first?.target || c.id || 'entity', candidate: c, killed };
  }
  return { ok: false, reason: 'no-snip-target' };
}
