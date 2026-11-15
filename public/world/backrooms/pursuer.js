// The Backrooms — the cast, on one floor. Who is down here is cast.js; what
// each of them is and does is a file of its own under cast/ (cast/index.js
// lists them; docs/BACKROOMS.md, "Adding a creature", is the contract). This
// file is the conductor: for each floor it makes whoever is on it, hands each
// a small toolbox (the shared walker, what can and cannot be seen, what being
// caught costs), runs them every frame, and takes down the stairs whatever
// they want remembered. It also hangs the floor's doors (doorleaf.js), since
// doors are what stand between the cast and you.
// Also here: the cardboard colleague who sometimes decides to come along, and
// who cannot open a door.
import { creatureTuning, difficultyOf } from '../../../core/difficulty.mjs';
import { makeRng } from './gen.js';
import * as castList from './cast.js';              // (the whole of it, so that hauntsFor is asked for only where it is used: a stand-in cast list need not have it)
const { CAST, castFor, homeFor } = castList;
import { MAKERS } from './cast/index.js';
import { createWalk } from './cast/walk.js';
import { hangDoors } from './doorleaf.js';

// Optional private co-op adapters: a bounded review cast, and a visitor scope per tick.
// Single-player callers keep the seeded cast and their existing env.player.
export function createStalkers(env, options = {}) {
  const level = env.level;
  const W = () => env.world;
  const walk = createWalk(env);
  const hiddenAt = (x, z, r = 0.6) => !env.sees(x, z, { radius: r, margin: 0.2, far: 40 });
  const drawn = (a) => { const rt = W().roomAt(a.x, a.z); return !!rt && rt.group.visible; };
  let follower = null, taker = null;                    // (taker: whoever's hit was the last heart — index.js asks, for the last shot)

  /* ---- who is on this floor ---------------------------------------------------------------- */

  /** What a creature is handed (the contract). Everything it may need of the level is here or on c.env. (k: the conductor's own note of it.) */
  const toolbox = (k, home, haunt = null, lair = null, member = k.member) => ({
    env, level, member, walk, home,
    get speedScale() { return creatureTuning(env.difficulty?.() ?? 'training-wheels', member.id).speed ?? 1; },
    get population() { return Math.max(1, level.difficulty ? difficultyOf(level.difficulty).toner : 1); },
    /** A room that asked for company and got this one (cast.js hauntsFor): its id, or null. What it does about it is its own. */
    haunt,
    /** For one that comes with a room (a cast line with `withRoom`, cast.js lairFor): the room it lies up in, a few doorways before its own — id, or null. */
    lair,
    /** Seeded: for what the creature is (which room, which face). What happens while somebody is playing may use Math.random. */
    R: makeRng(`${level.seed}/cast/${member.id}`),
    /** What it left for itself on the floor above (its own carry()), or null. */
    get carried() { return member.id === 'pirate' ? env.carry : env.carry?.others?.[member.id] ?? null; },
    /** Is this spot off the visitor's screen, or behind a wall? · Is the room this thing stands in being drawn at all? */
    hidden: hiddenAt, drawn,
    /** The visitor: { x, z, yaw, pitch, speed, moving … } (player.js), and which room they are in. */
    me: () => env.player.me,
    room: (x, z) => W().roomAt(x, z)?.id ?? null,
    /** Is there a line of sight between two spots? (walls, tall furniture and shut doors are in the way; a visitor's facing is not) */
    los: (ax, az, bx, bz) => W().los(ax, az, bx, bz),
    /** The light falling on a spot: [r, g, b] to tint a model with. */
    light: (x, z, y = 1) => W().lightAt(x, z, y),
    /** A sound from a spot (sound.js voices), heard as far as `reach` metres. */
    play: (name, x, z, reach) => env.play(name, x, z, reach),
    /** Put something in the level (a THREE object, in world coordinates) · and give it a body nobody walks through: { x, z, r }, kept up to date by you. */
    add: (object) => { W().scene.add(object); k.things.push(object); return object; },
    body: (b) => { if (!W().bodies.includes(b)) W().bodies.push(b); if (!k.bodies.includes(b)) k.bodies.push(b); return b; },
    /**
     * It has got the visitor. With a health system (env.health, when there is one) this costs `n` points and says what happened:
     * { landed: the hit counted (false: they were hit a moment ago), dead: it was the last of them — the visit is ending, do nothing more }.
     * Without one, a creature that hunts ends the visit ('caught') and anything else does nothing: { landed: false, ended }.
     */
    hurt(n = 1) {
      // (who it was is noted before the hit is made: the visit begins to end inside it, and asks)
      const before = taker; taker = k;
      const hit = env.health?.damage(creatureTuning(env.difficulty?.() ?? 'training-wheels', member.id).damage ?? n);
      if (hit) {
        const ended = !!hit.dead && !options.hasSurvivor?.();
        if (!ended) taker = before;
        return { landed: !!hit.ok, dead: !!hit.dead, ended };
      }
      if (member.disposition === 'hunts') { env.end('caught'); return { landed: true, dead: true, ended: true }; }
      taker = before;
      return { landed: false, dead: false, ended: false };
    },
    /** Something E does, at a spot of the world: { x, z, r, when?(), use() }. It has to look as though it can be used: nothing says so. */
    // (…and nothing of somebody who is not there can be used: see takeAway)
    use(spec) { const rt = W().roomAt(spec.x, spec.z); const u = { r: 1.2, ...spec, wx: spec.x, wz: spec.z, room: rt, when: () => !k.away && (spec.when ? spec.when() : true) }; rt?.uses.push(u); return u; },
    /** For the count kept of a visit: the visitor has really seen it, for the first time (say so once) · it had them, and they got away (each time). */
    // (a member of the cast with music of its own — `music` on its line of cast.js — has it begin here: each part's is
    // met once, so it is once a part, and a piece already playing is not begun again)
    met: () => { env.run?.met?.(member.id); if (member.music === 'mascot') env.sound?.playMascot?.(); },
    survived: () => env.run?.survived?.(member.id),
    /** Take a share (0…1) of whatever charge the camcorder's battery has left, where it has one. → { ok } */
    drain: (share) => env.camera?.drain?.(share) ?? { ok: false },
    /** What the visitor is holding (inventory, when there is one): { type, … } or null · take n of it: → whether that was done. */
    held: () => env.inventory?.held?.() ?? null,
    take: (type, n = 1) => !!env.inventory?.consumeHeld?.(type, n)?.ok,
    give: (item) => env.inventory?.give?.(item) ?? { ok: false },
    /**
     * The fire a spot is within sight and reach of (paper the visitor has lit: inventory-fire.js): { x, z, remaining: seconds it will
     * burn } — or null: none, or a visit without pockets. What a creature does about one is its own rule (cast/fire.rule.js).
     */
    fire(x, z) { const f = env.inventory?.fire?.threatAt?.(x, z, W().floorY(x, z)); return f ? { x: f.x, z: f.z, remaining: f.remaining } : null; },
  });
  const live = [], dealt = options.members?.map(id => ({ id })) ?? castFor(env.visit, level.depth);
  // …and whoever comes with a room this floor has (cast.js withRoomFor: extra, in nobody's place)
  if (!options.members) { try { for (const id of castList.withRoomFor?.(level) ?? []) if (!dealt.some((k) => k.id === id)) dealt.push({ id }); } catch (err) { console.warn('[backrooms] nobody came with a room on this floor', err); } }
  let haunts = new Map();
  try { haunts = castList.hauntsFor?.(level, dealt.map((k) => k.id)) ?? haunts; } catch (err) { console.warn('[backrooms] nobody keeps a room company on this floor', err); }
  for (const cast of dealt) {
    const member = CAST.find((m) => m.id === cast.id), make = MAKERS[cast.id];
    if (!member || !make) continue;
    // (things: what it has put in the level · bodies: what of it nobody walks through · away: the room it is standing in has gone, and it with it)
    const k = { id: member.id, member, it: null, things: [], bodies: [], away: null, shown: null };
    try { k.it = make(toolbox(k, homeFor(level, member), haunts.get(member.id) ?? null, castList.lairFor?.(level, member) ?? null)); live.push(k); }
    catch (err) { console.warn(`[backrooms] ${member.id} would not be made — the floor does without`, err); }
  }
  const pirate = live.find((k) => k.id === 'pirate')?.it || null;
  // once the floor is up and somebody is standing on it: its doors are hung, and everybody takes their places
  (env.ready ||= []).push(() => {
    env.doors = hangDoors(env);
    for (const k of live) { try { k.it.ready?.(); } catch (err) { console.warn(`[backrooms] ${k.id} would not take its place`, err); k.dead = true; } }
  });

  /* ---- the colleague who comes along --------------------------------------------------- */

  /** A cutout from the room of cutouts asks to follow you out of it. (k: { g, x, z, rot } in that room's frame.) */
  env.adopt = (c, k) => {
    if (follower || !env.player) return false;
    const at = c.toWorld(k.x, k.z);
    c.rt.group.remove(k.g); c.world.scene.add(k.g);
    follower = { g: k.g, x: at.x, z: at.z, r: 0.2, tall: 1.3, opens: false, speed: 2.7, wait: 0, unseen: 0, body: { x: at.x, z: at.z, r: 0.2 } };
    W().bodies.push(follower.body);
    k.g.position.set(at.x, c.room.y, at.z);
    return true;
  };
  function tag(f, dt) {
    const w = W(), me = env.player.me;
    f.g.visible = drawn(f);
    f.wait += dt; if (f.wait < 0.2) return;
    const step = f.wait; f.wait = 0;
    if (!hiddenAt(f.x, f.z, 0.55)) { f.unseen = 0; return; }
    f.unseen += step; if (f.unseen < 0.7) return;
    const bx = f.x, bz = f.z;
    walk.go(f, me, f.speed * step, 1.7);                                 // cardboard cannot work a door handle, or get down and crawl: shut a door on it and it waits
    if (!hiddenAt(f.x, f.z, f.r + 0.3)) { f.x = bx; f.z = bz; }
    f.body.x = f.x; f.body.z = f.z;
    const went = Math.hypot(f.x - bx, f.z - bz);
    f.g.position.set(f.x, w.floorY(f.x, f.z), f.z);
    f.g.rotation.y = Math.atan2(me.x - f.x, me.z - f.z);
    f.g.userData.light?.(w.lightAt(f.x, f.z, 1.0));
    if (went > 0.05 && Math.random() < 0.3) env.play('shuffle', f.x, f.z, 4);
  }


  env.clock = 0;
  env.pursuer = {
    update(dt, t) {
      if (!env.player || !env.world) return;
      env.clock += dt;
      env.doors?.update(dt);
      if (follower && !follower.away) tag(follower, dt);
      for (const k of live) {
        if (k.dead || k.away) continue;                                    // (somebody who is not here does nothing here)
        try {
          const tick = () => k.it.update?.(dt, env.clock);
          if (options.withVisitor) options.withVisitor(k.id, k.it.at?.(), tick);
          else tick();
        } catch (err) { console.warn(`[backrooms] ${k.id} has stopped`, err); k.dead = true; if (k.member.music === 'mascot') env.sound?.stopMascot?.(); }
      }
    },
    /** What goes down the stairs with you: the mascot's (as ever: { awake, face, card, lost }), and under `others` whatever anybody else wants kept. */
    carry() {
      const mine = pirate?.carry?.() || null, others = {};
      for (const k of live) if (k.it !== pirate && !k.dead) { const c = k.it.carry?.(); if (c) others[k.id] = c; }
      return mine || Object.keys(others).length ? { ...(mine || {}), others } : null;
    },
    wake: (force) => pirate?.wake(force),
    /** Whoever took the last heart, if it was one of the cast: { id, it } (it.takes(shot), where it has one, is what the building's camera shows). */
    get taker() { return taker && !taker.dead ? { id: taker.id, it: taker.it } : null; },
    /**
     * A room has gone, and taken whoever was standing in it. (There are rooms that change the building: the hallway
     * that is not sure where it leads. The place does not wait for anybody to step out first.) `inside(x, z)` says
     * where the room was, in the world; `key` is the room's own name for itself. Whoever was there is not seen, not
     * walked into, not heard from and does nothing until bringBack(key): they are standing in a room that is
     * somewhere else, exactly as they were. → who went.
     */
    takeAway(inside, key) {
      const w = W(), gone = [];
      for (const k of live) {
        if (k.dead || k.away) continue;
        // somebody who is more than one body, in more than one place (the waste toner and what it leaves), puts its own
        // away: only those of it that were in the room go, and the rest of it carries on
        if (k.it.takeAway) { if (k.it.takeAway(inside, key)) gone.push(k.id); continue; }
        const at = k.it.at?.();
        if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z) || !inside(at.x, at.z)) continue;
        // what there is of it to put away: whatever it added to the level, and (the mascot, which builds itself) its figure
        const figure = k.it.figure, things = [...k.things, figure?.group].filter(Boolean), bodies = [...k.bodies, figure?.body].filter(Boolean);
        k.away = key; k.shown = things.map((o) => [o, o.visible]); k.out = bodies.filter((b) => w.bodies.includes(b));
        for (const o of things) o.visible = false;
        for (const b of k.out) w.bodies.splice(w.bodies.indexOf(b), 1);
        gone.push(k.id);
      }
      if (follower && !follower.away && inside(follower.x, follower.z)) {
        follower.away = key; follower.g.visible = false;
        const i = w.bodies.indexOf(follower.body); if (i >= 0) w.bodies.splice(i, 1);
        gone.push('follower');
      }
      return gone;
    },
    /** That room is back, and so is whoever was in it: where they stood, as they were. → who came back. */
    bringBack(key) {
      const w = W(), back = [];
      for (const k of live) {
        if (k.it.bringBack) { if (!k.dead && k.it.bringBack(key)) back.push(k.id); continue; }
        if (k.away !== key) continue;
        k.away = null;
        for (const [o, visible] of k.shown || []) o.visible = visible;
        for (const b of k.out || []) if (!w.bodies.includes(b)) w.bodies.push(b);
        k.shown = k.out = null; back.push(k.id);
      }
      if (follower && follower.away === key) {
        follower.away = null; follower.g.visible = drawn(follower);
        if (!w.bodies.includes(follower.body)) w.bodies.push(follower.body);
        back.push('follower');
      }
      return back;
    },
    /** Who is away with a room, and which (for the dev page and the tests): { id: key }. */
    get away() { const with_ = (k) => k.away || (!k.dead && k.it.awayWith?.()) || null; return Object.fromEntries([...live.filter(with_).map((k) => [k.id, with_(k)]), ...(follower?.away ? [['follower', follower.away]] : [])]); },
    /** Where the mascot is and what it is doing (for the dev page) · everybody on this floor: { id: at() }. */
    at: () => pirate?.at() ?? null,
    cast: () => Object.fromEntries(live.map((k) => [k.id, k.dead ? null : k.it.at?.() ?? {}])),
    get follower() { return follower ? { x: follower.x, z: follower.z } : null; },
    get figure() { return pirate?.figure ?? null; },
    of: (id) => live.find((k) => k.id === id)?.it ?? null,
    snipTargets() {
      const out = [];
      for (const k of live) {
        if (k.dead || k.away) continue;                                    // (somebody who is away with a room cannot be reached either)
        const list = k.it.snipTargets?.();
        if (Array.isArray(list)) out.push(...list);
      }
      return out;
    },
    dispose() {
      for (const k of live) { try { k.it.dispose?.(); } catch { /* it is going anyway */ } }
      if (follower) { const i = W().bodies.indexOf(follower.body); if (i >= 0) W().bodies.splice(i, 1); follower.g.removeFromParent(); }
      follower = null;
    },
  };
}
