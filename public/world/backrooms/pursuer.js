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
import { makeRng } from './gen.js';
import { CAST, castFor, homeFor } from './cast.js';
import { MAKERS } from './cast/index.js';
import { createWalk } from './cast/walk.js';
import { hangDoors } from './doorleaf.js';

export function createStalkers(env) {
  const level = env.level;
  const W = () => env.world;
  const walk = createWalk(env);
  const hiddenAt = (x, z, r = 0.6) => !env.sees(x, z, { radius: r, margin: 0.2, far: 40 });
  const drawn = (a) => { const rt = W().roomAt(a.x, a.z); return !!rt && rt.group.visible; };
  let follower = null;

  /* ---- who is on this floor ---------------------------------------------------------------- */

  /** What a creature is handed (the contract). Everything it may need of the level is here or on c.env. */
  const toolbox = (member, home) => ({
    env, level, member, walk, home,
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
    add: (object) => { W().scene.add(object); return object; },
    body: (b) => { if (!W().bodies.includes(b)) W().bodies.push(b); return b; },
    /**
     * It has got the visitor. With a health system (env.health, when there is one) this costs `n` points and says what happened:
     * { landed: the hit counted (false: they were hit a moment ago), dead: it was the last of them — the visit is ending, do nothing more }.
     * Without one, a creature that hunts ends the visit ('caught') and anything else does nothing: { landed: false, ended }.
     */
    hurt(n = 1) {
      const hit = env.health?.damage(n);
      if (hit) return { landed: !!hit.ok, dead: !!hit.dead, ended: !!hit.dead };
      if (member.disposition === 'hunts') { env.end('caught'); return { landed: true, dead: true, ended: true }; }
      return { landed: false, dead: false, ended: false };
    },
    /** Something E does, at a spot of the world: { x, z, r, when?(), use() }. It has to look as though it can be used: nothing says so. */
    use(spec) { const rt = W().roomAt(spec.x, spec.z); const u = { r: 1.2, ...spec, wx: spec.x, wz: spec.z, room: rt }; rt?.uses.push(u); return u; },
    /** For the count kept of a visit: the visitor has really seen it, for the first time (say so once) · it had them, and they got away (each time). */
    met: () => env.run?.met?.(member.id),
    survived: () => env.run?.survived?.(member.id),
    /** Take a share (0…1) of whatever charge the camcorder's battery has left, where it has one. → { ok } */
    drain: (share) => env.camera?.drain?.(share) ?? { ok: false },
    /** What the visitor is holding (inventory, when there is one): { type, … } or null · take n of it: → whether that was done. */
    held: () => env.inventory?.held?.() ?? null,
    take: (type, n = 1) => !!env.inventory?.consumeHeld?.(type, n)?.ok,
    give: (item) => env.inventory?.give?.(item) ?? { ok: false },
  });
  const live = [];
  for (const cast of castFor(env.visit, level.depth)) {
    const member = CAST.find((m) => m.id === cast.id), make = MAKERS[cast.id];
    if (!member || !make) continue;
    try { live.push({ id: member.id, member, it: make(toolbox(member, homeFor(level, member))) }); }
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
    follower = { g: k.g, x: at.x, z: at.z, r: 0.2, tall: 1.3, opens: false, speed: 2.7, wait: 0, unseen: 0 };
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
      if (follower) tag(follower, dt);
      for (const k of live) {
        if (k.dead) continue;
        try { k.it.update?.(dt, env.clock); } catch (err) { console.warn(`[backrooms] ${k.id} has stopped`, err); k.dead = true; }
      }
    },
    /** What goes down the stairs with you: the mascot's (as ever: { awake, face, card, lost }), and under `others` whatever anybody else wants kept. */
    carry() {
      const mine = pirate?.carry?.() || null, others = {};
      for (const k of live) if (k.it !== pirate && !k.dead) { const c = k.it.carry?.(); if (c) others[k.id] = c; }
      return mine || Object.keys(others).length ? { ...(mine || {}), others } : null;
    },
    wake: (force) => pirate?.wake(force),
    /** Where the mascot is and what it is doing (for the dev page) · everybody on this floor: { id: at() }. */
    at: () => pirate?.at() ?? null,
    cast: () => Object.fromEntries(live.map((k) => [k.id, k.dead ? null : k.it.at?.() ?? {}])),
    get follower() { return follower ? { x: follower.x, z: follower.z } : null; },
    get figure() { return pirate?.figure ?? null; },
    of: (id) => live.find((k) => k.id === id)?.it ?? null,
    dispose() { for (const k of live) { try { k.it.dispose?.(); } catch { /* it is going anyway */ } } follower?.g.removeFromParent(); follower = null; },
  };
}
