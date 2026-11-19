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
import { makeRng, roomDistances } from './gen.js';
import * as castList from './cast.js';              // (the whole of it, so that hauntsFor is asked for only where it is used: a stand-in cast list need not have it)
const { CAST, castFor, homeFor } = castList;
import { MAKERS } from './cast/index.js';
import { createWalk } from './cast/walk.js';
import { hangDoors } from './doorleaf.js';

// Optional private co-op adapters: a bounded review cast, and a visitor scope per tick.
// Single-player callers keep the seeded cast and their existing env.player.
/** Who can be called up at a spot after the floor is built (summon()): those with an `appear` of their own. */
export const SUMMONABLE = new Set(['toner', 'shadow']);
/**
 * May this one be called up on a visit of this difficulty? Only those who can turn up somewhere at all; and no toner on a
 * visit whose difficulty has none (core/difficulty.mjs `toner: 0`): whatever asks, such a visit stays without one.
 */
export const maySummon = (id, difficulty) => SUMMONABLE.has(id) && !(id === 'toner' && difficulty && !difficultyOf(difficulty).toner);

export function createStalkers(env, options = {}) {
  const level = env.level;
  const W = () => env.world;
  const fromStart = roomDistances(level, level.start?.room);
  const walk = createWalk(env);
  const hiddenAt = (x, z, r = 0.6) => !env.sees(x, z, { radius: r, margin: 0.2, far: 40 });
  const drawn = (a) => { const rt = W().roomAt(a.x, a.z); return !!rt && rt.group.visible; };
  let follower = null, taker = null;                    // (taker: whoever's hit was the last heart — index.js asks, for the last shot)
  /** A blow that takes `n` off one's health through the conductor (the extinguisher's smash: extinguisher.js). → { ok, killed, hp } */
  const strikeOf = (k) => (n) => {
    if (!(n > 0) || !k.vital || castList.finished?.(k.vital)) return { ok: false, killed: false };
    k.vital = castList.struck(k.vital, n); k.settle = true;                   // (the health rule's own struck, as a jab's: c.struck)
    if (!k.vital.killed) k.stall = Math.max(k.stall || 0, castList.HEALTH?.flinch ?? 0.6);      // (it flinches, as from a jab)
    if (!k.escaped) { k.escaped = true; env.run?.survived?.(k.member.id); }                       // (got away from, as a jab counts it: c.survived)
    return { ok: true, killed: !!k.vital.killed, hp: k.vital.hp };
  };
  /** Where a member of the cast says it is (its at(): for which way a blow of its throws the visitor), or null. */
  const whereIs = (k) => { try { return k.it?.at?.() ?? null; } catch { return null; } };

  /* ---- who is on this floor ---------------------------------------------------------------- */

  /** What a creature is handed (the contract). Everything it may need of the level is here or on c.env. (k: the conductor's own note of it.) */
  const toolbox = (k, home, haunt = null, lair = null, member = k.member) => ({
    env, level, member, walk, home,
    /** Hostile placements must leave the landing and its adjacent rooms empty. */
    spawnAllowed: id => fromStart.has(id) && fromStart.get(id) >= 2,
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
    /**
     * A shove has reached it (its own shoveTargets() says so): for this many seconds it is not ticked and no hit of its
     * lands. Nothing of its rule is touched, so afterwards it is exactly what it was, with the same thing in mind.
     */
    stall: (seconds) => { if (seconds > 0) { k.stall = Math.max(k.stall || 0, seconds); k.settle = true; } },
    get stalled() { return (k.stall || 0) > 0; },
    /**
     * Its health (cast/health.rule.js): { hp, max, hurt: seconds since it was last hit, dying: null or 0…1, gone } — or null:
     * it has none, and cannot be hit. For the picture to read: a flinch from `hurt`, a death from `dying`.
     */
    get vital() { return k.vital ? { ...k.vital } : null; },
    /**
     * A jab has reached it (its own snipTargets() says so): it takes `n`. → { ok, killed, hp }. Killed, it is dying from
     * now: the conductor does not tick it, it lands nothing, and when it has gone it is gone from this floor.
     */
    struck: (n) => {
      if (!k.vital || castList.finished?.(k.vital)) return { ok: false, killed: false, hp: k.vital?.hp ?? 0 };
      k.vital = castList.struck(k.vital, n); k.settle = true;
      if (k.vital.killed && k.member.music === 'mascot') env.sound?.stopMascot?.();
      return { ok: true, killed: !!k.vital.killed, hp: k.vital.hp };
    },
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
     * A hit that comes from in front in the moment after a shove does not land (shove.rule.js): { landed: false, blocked: true } —
     * unless it is one of the heavy ones (`heavy` on its line of cast.js). `from`: where the hit is coming from, for one that
     * is more than one body; otherwise it is wherever the creature says it is (at()).
     * A hit that does land and is survived throws the visitor back from the same place (player.js knock).
     */
    hurt(n = 1, from = null) {
      if (k.stall > 0) return { landed: false, dead: false, ended: false, stalled: true };
      if (castList.finished?.(k.vital)) return { landed: false, dead: false, ended: false, dying: true };       // (it is going: its hand is not on anybody)            // (shoved a moment ago: its hand is not on anybody)
      // (env.blocked is the level's: index.js. A floor without it — a test's, a review's — has no shove, and every hit lands)
      if (!member.heavy && env.blocked) {
        const at = from || k.it?.at?.() || null;
        if (env.blocked(at)) { env.play?.('thunk', at?.x, at?.z, 8); env.interfere?.(0.25); return { landed: false, dead: false, ended: false, blocked: true }; }
      }
      // (who it was is noted before the hit is made: the visit begins to end inside it, and asks)
      const before = taker; taker = k;
      const hit = env.health?.damage(creatureTuning(env.difficulty?.() ?? 'training-wheels', member.id).damage ?? n);
      if (hit) {
        const ended = !!hit.dead && !options.hasSurvivor?.();
        if (!ended) taker = before;
        if (hit.ok && !hit.dead) env.player?.knock?.(from ?? whereIs(k));
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
    // (once a creature a floor: got away from is an escape, not a count of jabs — a boss jabbed three times is one)
    survived: () => { if (k.escaped) return; k.escaped = true; env.run?.survived?.(member.id); },
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
  const staged = { woke: false, beside: false, called: false };
  const mascotDead = !!env.carry?.dead;               // (the mascot was finished on a part above: it is in no part below)
  const live = [], dealt = (options.members?.map(id => ({ id })) ?? castFor(env.visit, level.depth)).filter((k) => !(mascotDead && CAST.find((m) => m.id === k.id)?.music === 'mascot'));
  // …and whoever comes with a room this floor has (cast.js withRoomFor: extra, in nobody's place)
  if (!options.members) { try { for (const id of castList.withRoomFor?.(level) ?? []) if (!dealt.some((k) => k.id === id)) dealt.push({ id }); } catch (err) { console.warn('[backrooms] nobody came with a room on this floor', err); } }
  let haunts = new Map();
  try { haunts = castList.hauntsFor?.(level, dealt.map((k) => k.id)) ?? haunts; } catch (err) { console.warn('[backrooms] nobody keeps a room company on this floor', err); }
  for (const cast of dealt) {
    const member = CAST.find((m) => m.id === cast.id), make = MAKERS[cast.id];
    if (!member || !make) continue;
    // (things: what it has put in the level · bodies: what of it nobody walks through · away: the room it is standing in has gone, and it with it)
    const k = { id: member.id, member, it: null, things: [], bodies: [], away: null, shown: null, vital: castList.fresh?.(member.id) ?? null };
    try { k.it = make(toolbox(k, homeFor(level, member), haunts.get(member.id) ?? null, castList.lairFor?.(level, member) ?? null)); live.push(k); }
    catch (err) { if(env.coopStrict)throw err;console.warn(`[backrooms] ${member.id} would not be made — the floor does without`, err); }
  }
  const pirate = live.find((k) => k.id === 'pirate')?.it || null;
  // once the floor is up and somebody is standing on it: its doors are hung, and everybody takes their places
  (env.ready ||= []).push(() => {
    env.doors = hangDoors(env);
    for (const k of live) { try { k.it.ready?.(); } catch (err) { if(env.coopStrict)throw err;console.warn(`[backrooms] ${k.id} would not take its place`, err); k.dead = true; } }
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
      // (for whoever is looking, never in a visit that counts — index.js hands these over under ?debug only:
      //  `wake`: the mascot, once it is on this floor, is awake and knows where the visitor is;
      //  `beside`: the visitor is put a step and a half from the one named, facing it, as soon as it is somewhere to be put beside)
      if (options.wake && !staged.woke && pirate?.at?.()) { staged.woke = true; try { pirate.wake(true); } catch { /* it will wake by itself */ } }
      if (options.beside && !staged.beside) {
        const who = live.find((k) => k.id === options.beside && !k.dead && !k.away);
        // (one that has nowhere to stand yet and can be called up — the shadow, which only takes a place out of the picture,
        // and from somebody standing still may find none — is put in plain sight a few steps off first: once, after a moment)
        if (who && !staged.called && env.clock > 0.5 && !Number.isFinite(who.it.at?.()?.x) && typeof who.it.appear === 'function') {
          staged.called = true; const m = env.player.me, w = W();
          for (let i = 0; i < 16; i++) {
            const ang = m.yaw + (i * Math.PI) / 8, x = m.x - Math.sin(ang) * 2.5, z = m.z - Math.cos(ang) * 2.5;
            if (!w.roomAt(x, z) || !w.free(x, z, 0.3) || !w.los(m.x, m.z, x, z)) continue;
            try { if (who.it.appear({ x, z })) break; } catch { break; }
          }
        }
        const a = who?.it.at?.();
        if (a && Number.isFinite(a.x) && Number.isFinite(a.z)) {
          const w = W();
          for (let i = 0; i < 16 && !staged.beside; i++) {
            const ang = (i * Math.PI) / 8, apart = Number(who.it.apart) || 1.5, x = a.x + Math.cos(ang) * apart, z = a.z + Math.sin(ang) * apart;          // (apart: one that goes off when you are near says how far)
            if (!w.roomAt(x, z) || !w.free(x, z, 0.3) || !w.los(x, z, a.x, a.z)) continue;
            env.player.warp?.(x, z, Math.atan2(-(a.x - x), -(a.z - z)) + (Number(who.it.aside) || 0)); staged.beside = true;          // (aside: one that goes off when stared at says how far off it to look)
          }
        }
      }
      env.doors?.update(dt);
      if (follower && !follower.away) {if(options.withVisitor)options.withVisitor('follower',follower,()=>tag(follower,dt));else tag(follower, dt);}
      for (const k of live) {
        if (k.dead || k.away) continue;                                    // (somebody who is not here does nothing here)
        // (its health: the mark of the last hit ages; one that is dying is not ticked, and when it has gone it is taken off
        // the floor — unless it says its body stays where it fell: its own fell(), as the mascot's does, for what it holds)
        if (k.vital) {
          k.vital = castList.aged(k.vital, dt);
          if (k.vital.dying !== null) {
            try { k.it.dies?.(k.vital.dying, dt); } catch { /* it is going anyway */ }
            if (k.vital.gone) {
              k.dead = true; let stays = false;
              try { stays = !!k.it.fell?.(); } catch { stays = false; }
              k.fallen = stays;                                             // (its body is still in the level: a room that goes takes it too — takeAway)
              const figure = k.it.figure;
              for (const b of [...k.bodies, figure?.body].filter(Boolean)) { const i = W().bodies.indexOf(b); if (i >= 0) W().bodies.splice(i, 1); }
              if (!stays) { try { k.it.dispose?.(); } catch { /* it is going anyway */ } for (const o of k.things) o.removeFromParent?.(); }
            }
            continue;
          }
        }
        // (shoved: it stands where it was put, c.stall. One tick of no time at all first, so that it is drawn where it was put)
        const settle = !!k.settle; k.settle = false;
        // (…and while it stands there it may draw being hit, as `dies` draws a death: a pose only, nothing moved, nothing landed)
        if (k.stall > 0) { k.stall = Math.max(0, k.stall - dt); if (!settle) { try { k.it.flinch?.(k.vital ? k.vital.hurt : null, dt); } catch { /* a pose that failed is not a reason to stop the floor */ } continue; } }
        const step = settle ? 1e-4 : dt;
        try {
          const tick = () => k.it.update?.(step, env.clock);
          if (options.withVisitor) options.withVisitor(k.id, k.it.at?.(), tick);
          else tick();
        } catch (err) { if(env.coopStrict)throw err;console.warn(`[backrooms] ${k.id} has stopped`, err); k.dead = true; if (k.member.music === 'mascot') env.sound?.stopMascot?.();
          // (and it is nobody's to walk round: a body left standing where it stopped would be an invisible wall, in a doorway as like as not)
          for (const b of [...k.bodies, k.it.figure?.body].filter(Boolean)) { const i = W().bodies.indexOf(b); if (i >= 0) W().bodies.splice(i, 1); } }
      }
    },
    /** What goes down the stairs with you: the mascot's (as ever: { awake, face, card, lost }), and under `others` whatever anybody else wants kept. */
    carry() {
      // (a mascot that has been finished is dead for the visit: nothing of it goes down the stairs but the fact, and no
      // part below has one — `mascotDead` above. One that was only put off follows as it always did)
      const mk = live.find((k) => k.it === pirate), finishedHere = !!mk && (!!castList.finished?.(mk.vital) || !!mk.fallen);
      const mine = mascotDead || finishedHere ? { dead: true } : pirate?.carry?.() || null, others = {};
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
        if ((k.dead && !k.fallen) || k.away) continue;                     // (one that is finished but lies where it fell goes with the room it lies in)
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
    /** Somebody's health, for whoever draws them or asks: { hp, max, hurt, dying, gone } — or null: not here, or cannot be hit. */
    vital: (id) => { const k = live.find((q) => q.id === id); return k?.vital ? { ...k.vital } : null; },
    /**
     * Something on the floor has one of the cast in it (a lift car, say): put them at this spot now. spot: { x, z, yaw? }, world.
     * If they are on the floor already this is one more appearance of theirs; if they were not dealt, they are made here, outside
     * the deal (castFor and homeFor are not asked and nobody else moves), and go with the floor like the rest. Only those who know
     * how to turn up somewhere (an `appear` of their own: SUMMONABLE). Whoever calls must decide by the seed, never by chance, or
     * two visitors on one floor see different things. Each call for the toner is one more toner: whoever calls keeps its own count.
     * No toner comes to a visit whose difficulty has none (maySummon). Returns the creature, or null: nobody came.
     */
    summon(id, spot) {
      if (!maySummon(id, level.difficulty || env.difficulty?.()) || !spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.z) || !W()?.roomAt(spot.x, spot.z)) return null;
      let k = live.find((q) => q.id === id), fresh = false;
      if (k && (k.dead || k.away)) return null;
      try {
        if (!k) {
          const member = CAST.find((m) => m.id === id), make = MAKERS[id];
          if (!member || !make) return null;
          k = { id, member, it: null, things: [], bodies: [], away: null, shown: null, summoned: true, vital: castList.fresh?.(id) ?? null }; fresh = true;
          k.it = make(Object.assign(toolbox(k, null), { summoned: true }));
          k.it.ready?.();
        }
        if (!k.it.appear?.(spot)) { if (fresh) { try { k.it.dispose?.(); } catch { /* it never arrived */ } } return null; }
        if (fresh) live.push(k);
        return k.it;
      } catch (err) { if (env.coopStrict) throw err; console.warn(`[backrooms] ${id} would not be called up`, err); if (fresh) { try { k.it?.dispose?.(); } catch { /* it never arrived */ } } return null; }
    },
    snipTargets() {
      const out = [];
      for (const k of live) {
        if (k.dead || k.away || castList.finished?.(k.vital)) continue;                                    // (somebody who is away with a room cannot be reached either)
        const list = k.it.snipTargets?.();
        if (Array.isArray(list)) for (const t of list) out.push({ member: k.member.id, tier: castList.TIER?.[k.member.id] ?? null, ...t, smash: t.smash || strikeOf(k) });
      }
      return out;
    },
    /**
     * What the extinguisher could reach (extinguisher.js, extinguisher.rule.js): whatever each of them offers (its own
     * sprayTargets()), or else itself, where it says it is (at()). Each says who it is (`member`, `heavy`) so that what
     * it does about a face full can be looked up; `douse(dose, from)` does it: its own doused(), if it has one, or it is
     * stood where it is (c.stall) for the stop and the backing off together. → [{ id, member, heavy, x, z, y?, r, douse }]
     */
    sprayTargets() {
      const out = [];
      for (const k of live) {
        if (k.dead || k.away || castList.finished?.(k.vital)) continue;
        const who = { member: k.member.id, heavy: !!k.member.heavy };
        const own = k.it.sprayTargets?.();
        if (Array.isArray(own)) { for (const t of own) out.push({ ...who, ...t }); continue; }
        const at = whereIs(k);
        if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) continue;
        out.push({ id: k.id, ...who, x: at.x, z: at.z, y: Number.isFinite(at.y) ? at.y : undefined, r: at.r ?? 0.4,
          douse: (dose, from) => {
            if (typeof k.it.doused === 'function') return k.it.doused(dose, from) !== false;
            const s = (dose.stop || 0) + (dose.back || 0); if (s > 0) { k.stall = Math.max(k.stall || 0, s); k.settle = true; }
            return true;
          } });
      }
      return out;
    },
    /** What a shove could move (shove.rule.js): whatever each of them offers — [{ id, x, z, y?, r, shove(dir) }]. */
    // (each says who it is, `member`, and how a smash with the extinguisher's foot hurts it, `smash(n)`: its own, if it has
    // one, or else the conductor takes `n` off its health, as a jab does. Whether `n` is anything at all is the smash's
    // business: extinguisher.rule.js smashHurts)
    shoveTargets() {
      const out = [];
      for (const k of live) {
        if (k.dead || k.away || castList.finished?.(k.vital)) continue;
        const list = k.it.shoveTargets?.();
        if (!Array.isArray(list)) continue;
        for (const t of list) out.push({ member: k.member.id, tier: castList.TIER?.[k.member.id] ?? null, ...t, smash: t.smash || strikeOf(k) });
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
