// The Backrooms — somebody a room keeps. No three.js, nothing of the page.
//
// The cast is dealt by the conductor (pursuer.js), which keeps each one's health, stands it still when it is shoved and
// takes it off the floor when it has gone. A room's own resident — the lifeguard's chair, the Lane Keeper, a flume's
// toner — is made by its room and nobody keeps anything for it. This does, the same way, so that no room has to
// invent it: a resident made here
//
//   · can be found by a jab and by a shove (index.js asks env.residents, beside the conductor and the denizens);
//   · has a `vital` from the same table as the cast (cast/health.rule.js `TIER`), read the same way:
//     `hurt` seconds since the last hit, `dying` null or 0…1, `gone`;
//   · is drawn dying and flinching by the same two calls the conductor makes: `dies(progress, dt)`, `flinch(hurt, dt)`;
//   · is counted as got away from once a floor, however many jabs or hits it took.
//
// What the room still owns is the room: what the thing does, what a jab that does not finish it does to it, and what
// its going does to the room. Two things a death must never do: shut anybody in (the room is still left the way it
// was), and open what the room keeps shut.
//
// In a room (c is the room's toolbox; three or four lines):
//
//   const life = resident(c.env, 'guard-stand', {
//     of: roamer,                                                // its denizen (or at: () => ({ x, z }) in the world's coordinates)
//     r: 0.48,
//     when: () => rule.mode !== 'chair',                         // may a hand reach it now?
//     hit: ({ killed }) => { rule = snipGuardStand(rule); },     // what a jab does to it, as it always did
//     move: (to) => { roamer.x = to.x; roamer.z = to.z; },       // a shove may slide it (leave out: it is only stood still)
//     dies: (k, dt) => rig.dies(k, dt), flinch: (hurt, dt) => rig.flinch(hurt, dt),
//     gone: () => { roamer.gone = true; },
//   });
//   …and in its update:   if (life.out || life.stalled) return;      // dying, gone or shoved: it does nothing, lands nothing
//   …where it lands a hit that is survived:   life.escaped();

import { HEALTH, fresh, struck, aged, finished } from './cast/health.rule.js';
import { SHOVE, slide } from './shove.rule.js';

/**
 * What a shove does to each: `push` metres it is slid back (0: it is not moved — a thing in water, on a chair or on a
 * stair is stood still where it is and no more), `stagger` seconds it then does nothing and lands nothing.
 * One that is not listed is stood still for SHOVE.stagger and not moved.
 */
export const RESIDENT = Object.freeze({
  'guard-stand': Object.freeze({ push: SHOVE.heavy.push, stagger: 0.5 }),      // a chair on four legs, on the deck: it gives a little
  'lane-keeper': Object.freeze({ push: 0, stagger: SHOVE.stagger }),           // in its lane, in the water
  'flume-toner': Object.freeze({ push: 0, stagger: SHOVE.stagger }),           // a toner lets go and backs off by its own rule (as the cast's does)
  'plenum-toner': Object.freeze({ push: 0, stagger: SHOVE.stagger }),
  'inverted-bathers': Object.freeze({ push: 0, stagger: SHOVE.stagger }),      // hanging in the water
  'towel-return': Object.freeze({ push: 0, stagger: 0.5 }),                    // on the tower's stairs: nothing is pushed off a stair
  'pool-skimmer': Object.freeze({ push: 0, stagger: SHOVE.stagger }),          // afloat
});

/** What a shove does to this one: { push, stagger }. */
export const shoveOf = (id) => RESIDENT[id] ?? { push: 0, stagger: SHOVE.stagger };

/**
 * A floor's residents (index.js makes one beside the denizens; resident() makes one if nobody has).
 * → { add, all, snipTargets, shoveTargets, update(dt), vital(id), counted }
 */
export function createResidents(env) {
  if (env?.residents) return env.residents;          // (a room built before the floor asked for one has already made it)
  const list = [], counted = new Set();
  const residents = {
    all: () => list,
    /** Those of them got away from on this floor: once each, by id. */
    counted,
    add(r) { list.push(r); return r; },
    remove(r) { const i = list.indexOf(r); if (i >= 0) list.splice(i, 1); },
    /** What a jab could reach (melee.js): [{ id, x, z, y, r, priority, snip }]. */
    snipTargets() { const out = []; for (const r of list) { const t = r.snipTarget(); if (t) out.push(t); } return out; },
    /** What a shove could reach (shove.rule.js): [{ id, x, z, y, r, shove(dir) }]. */
    shoveTargets() { const out = []; for (const r of list) { const t = r.shoveTarget(); if (t) out.push(t); } return out; },
    /** Time passes for all of them: marks age, the dying go, the shoved stand. Once a frame, by whoever ticks the floor. */
    update(dt) { for (const r of [...list]) r.tick(dt); },
    /** The health of the first of that name still here — or null. */
    vital(id) { const r = list.find((k) => k.id === id && !k.gone) ?? list.find((k) => k.id === id); return r ? r.vital : null; },
  };
  if (env) env.residents = residents;
  return residents;
}

/**
 * Somebody a room keeps, brought into health and within reach of a shove.
 * @param env   the floor's (a room's c.env)
 * @param id    its name, as the room gives it to c.met — and as cast/health.rule.js TIER has it (not there: it cannot be hurt,
 *              and can only be shoved)
 * @param spec  at(): { x, z, y? } where it is, world coordinates (y: where a hand finds it; default the floor there + 0.75)
 *              of: its denizen (denizens.js), if it has one — then at() may be left out, and one that is gone, away with its
 *                room or not shown cannot be reached. (Its denizen then offers no snip of its own: one target, not two)
 *              r, verticalReach, priority: of the target (as denizens.js)
 *              when(): may it be reached at all now? (default: yes)
 *              hit({ killed, hp }): a jab has landed — what the room always did when it was jabbed
 *              recoils: true — it has a stand-down of its own after a jab (default: it is stood still for HEALTH.flinch)
 *              shoved(dir): a shove has landed, and the room does all of it itself → true if it did anything
 *              move({ x, z }): put it there (a shove slides it, if RESIDENT gives it a push); clear(x0, z0, x1, z1): may it go?
 *              shove: false — hands do nothing to it
 *              dies(progress, dt), flinch(hurt, dt): the picture, called as the conductor calls the cast's
 *              gone(): it has finished going. What that does to the room is the room's: but it shuts nobody in and opens nothing
 * @returns {{ id, vital, out, dying, gone, hurt, stalled, stall(seconds), strike(n), escaped(), met(), remove() }}
 */
export function resident(env, id, spec = {}) {
  const residents = env?.residents ?? createResidents(env), how = shoveOf(id);
  let vital = fresh(id), stall = 0, settle = false, known = false, ended = false;
  const of = spec.of, here = () => !of || (!of.gone && !of.away && of.visible !== false);          // (its denizen, if it has one: gone with a room, it is nobody's target)
  const reachable = () => !ended && !finished(vital) && here() && (spec.when ? !!spec.when() : true);
  const where = () => {
    const p = spec.at ? spec.at() : of; if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
    return { x: p.x, z: p.z, y: Number.isFinite(p.y) ? p.y : (env?.world?.floorY?.(p.x, p.z) || 0) + 0.75 };
  };
  const me = {
    id,
    /** { hp, max, hurt, dying, gone, takes } — or null: it has no health. A copy. */
    get vital() { return vital ? { ...vital } : null; },
    /** Dying or gone: it lands nothing and is not to be ticked. */
    get out() { return ended || finished(vital); },
    get dying() { return vital ? vital.dying : null; },
    get gone() { return ended || !!vital?.gone; },
    /** Seconds since it was last hit (Infinity: never). */
    get hurt() { return vital ? vital.hurt : Infinity; },
    /** Shoved, or flinching from a jab: it stands where it is and lands nothing. */
    get stalled() { return stall > 0; },
    stall(seconds) { if (seconds > 0) { stall = Math.max(stall, seconds); settle = true; } },
    /** It has been seen for what it is: once (c.met). */
    met() { if (known) return; known = true; env?.run?.met?.(id); },
    /** Got away from: once a floor for all of that name, however it happened (c.survived). */
    escaped() { if (residents.counted.has(id)) return; residents.counted.add(id); env?.run?.survived?.(id); },
    /** It takes `n` (a jab is HEALTH.jab). → { ok, killed, hp } */
    strike(n = HEALTH.jab) {
      if (!vital || me.out) return { ok: false, killed: false, hp: vital?.hp ?? 0 };
      vital = struck(vital, n);
      const killed = !!vital.killed;
      if (!killed && !spec.recoils) me.stall(HEALTH.flinch);
      return { ok: true, killed, hp: vital.hp };
    },
    snipTarget() {
      if (!vital || !reachable()) return null;
      const p = where(); if (!p) return null;
      return {
        id, x: p.x, z: p.z, y: p.y, r: spec.r ?? 0.3, priority: spec.priority ?? 2,
        ...(spec.verticalReach !== undefined ? { verticalReach: spec.verticalReach } : {}),
        snip: () => {
          if (!reachable()) return false;
          const hit = me.strike(); if (!hit.ok) return false;
          me.met();
          try { spec.hit?.({ killed: hit.killed, hp: hit.hp }); } catch { /* the jab landed whatever the room made of it */ }
          me.escaped();
          return { ok: true, target: id, killed: hit.killed };
        },
      };
    },
    shoveTarget() {
      if (spec.shove === false || !reachable()) return null;
      const p = where(); if (!p) return null;
      return {
        id, x: p.x, z: p.z, y: p.y, r: spec.r ?? 0.3,
        shove: (dir) => {
          if (!reachable()) return false;
          if (spec.shoved) return !!spec.shoved(dir);
          if (how.push > 0 && spec.move && dir) {
            const clear = spec.clear ?? ((x0, z0, x1, z1) => env?.world?.los?.(x0, z0, x1, z1) ?? true);
            const to = slide(p, dir, clear, how.push);
            if (to) spec.move(to);
          }
          me.stall(how.stagger);
          return true;
        },
      };
    },
    tick(dt) {
      if (ended || !(dt > 0)) return;
      if (vital) {
        vital = aged(vital, dt);
        if (vital.dying !== null) {
          try { spec.dies?.(vital.dying, dt); } catch { /* it is going anyway */ }
          if (vital.gone) { ended = true; stall = 0; try { spec.gone?.(); } catch { /* it has gone whatever the room made of it */ } residents.remove(me); }
          return;
        }
      }
      // (one frame of standing where it was put before the pose: as the conductor does)
      const first = settle; settle = false;
      if (stall > 0) { stall = Math.max(0, stall - dt); if (!first) { try { spec.flinch?.(vital ? vital.hurt : null, dt); } catch { /* a pose that failed is not a reason to stop the floor */ } } }
    },
    /** The room has gone, or has no more use for it: it is nobody's target and nothing more is asked of it. */
    remove() { ended = true; residents.remove(me); },
  };
  return residents.add(me);
}
