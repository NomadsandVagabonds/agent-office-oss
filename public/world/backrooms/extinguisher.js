// The Backrooms — the fire extinguisher in use, for one part of the building: the trigger, the charge it spends, the hand
// that squeezes it, the white that comes out of it, what that white catches, the fire it puts out and the noise it makes.
// What any of it means is extinguisher.rule.js; this only does it, each moment, for whoever holds one.
//
//   env.extinguisher = { press(), update(dt, held), whiteOut(), spraying(), dispose() }
//     press   the lever is squeezed: a click, Q, a finger on the [E] (a burst, at least: EXTINGUISHER.burst)
//     update  every moment: `held` is the button still being down (the mouse), to go on spraying past the burst
//     whiteOut  how white the picture is where the visitor stands (spray.js): index.js sees() goes blind past `blind`
//     smash   the right button: the canister's foot at what is in front (SMASH: a shove twice over; hurts the smallest; may split it)
import * as THREE from 'three';
import { idle, trigger, inSpray, doseOf, tally, stoppedUntil, doused, responseOf, blinds, SMASH, smashHurts } from './extinguisher.rule.js';
import { SHOVE, shoveWindow, rankShoveTargets, facing } from './shove.rule.js';
import { TIER } from './cast/health.rule.js';
import { createSpray } from './spray.js';

/**
 * @param env     the part's env (inventory, handView, pursuer, residents, player, world, play, interfere)
 * @param camera  the camcorder's camera (where the white is, round it)
 */
export function createExtinguisher(env, camera) {
  let s = idle(), pressed = false, spray = null, clock = 0, hissT = 0, wasOn = false, smashCool = 0, burstT = 0;
  const marks = new Map(), soaked = new Map(), from = new THREE.Vector3(), dir = new THREE.Vector3(), ahead = new THREE.Vector3();
  const held = () => { const item = env.inventory?.held?.(); return item?.type === 'extinguisher' ? item : null; };

  /** What the spray reaches this moment, and what it does to each: tallied, and a face full is a face full (doseOf). */
  function reach(dt, me) {
    const targets = [...(env.pursuer?.sprayTargets?.() || []), ...(env.residents?.sprayTargets?.() || [])];
    const los = (ax, az, bx, bz) => env.world?.los ? env.world.los(ax, az, bx, bz) : true;
    const seen = new Set();
    for (const t of targets) {
      if (!t || typeof t.douse !== 'function') continue;
      const id = t.id ?? t.member, kind = responseOf(t.member ?? id);
      if (kind === 'nothing') continue;
      const hit = inSpray(me, t) >= 0 && los(me.x, me.z, t.x, t.z);
      seen.add(id);
      const r = tally(marks.get(id), dt, clock, hit);
      if (!r.dosed) { marks.set(id, r.m); continue; }
      const dose = doseOf(r.m.times - 1, { heavy: t.heavy, tier: TIER[t.member ?? id] });
      if (kind === 'stops') dose.back = 0;
      let took = false;
      try { took = t.douse(dose, { x: me.x, z: me.z }) !== false; } catch { took = false; }
      marks.set(id, took ? stoppedUntil(r.m, clock, dose) : { ...r.m, times: r.m.times - 1 });
      if (took) env.play?.('shuffle', t.x, t.z, 6);
    }
    for (const id of marks.keys()) if (!seen.has(id)) marks.set(id, tally(marks.get(id), dt, clock, false).m);
    // and a fire in front: put out, given a moment of it (your own, too)
    const fire = env.inventory?.fire;
    for (const f of fire?.burning?.() || []) {
      const hit = inSpray(me, { x: f.wx, z: f.wz, r: 0.3 }) >= 0;
      const k = hit ? (soaked.get(f.id) || 0) + dt : 0;
      soaked.set(f.id, k);
      if (hit && doused(k)) { fire.douse?.(f.id); soaked.delete(f.id); env.play?.('hiss', f.wx, f.wz, 6); }
    }
  }

  const api = {
    press() { pressed = true; },
    /**
     * The canister's foot, swung at what is in front (SMASH). It is a shove — it costs the same breath, and for a moment a
     * hit from in front is turned aside — but each thing it reaches is pushed twice; a basic one takes SMASH.hurts of its
     * health; and when it has landed on something, it may split. → { ok, landed: how many it reached, broke }
     */
    smash() {
      const me = env.player?.me, item = held();
      if (!me || !item || env.grip?.held || smashCool > 0 || s.on) return { ok: false, reason: 'unavailable' };
      if (!env.player.shove?.(shoveWindow(env.difficulty?.()))) return { ok: false, reason: 'no-breath' };
      smashCool = SMASH.cooldown;
      const los = (ax, az, bx, bz) => env.world?.los ? env.world.los(ax, az, bx, bz) : true;
      const dir = facing(me.yaw), targets = rankShoveTargets(me, [...(env.pursuer?.shoveTargets?.() || []), ...(env.residents?.shoveTargets?.() || [])], los);
      let landed = 0, killed = 0;
      for (const t of targets) {
        if (landed >= SHOVE.most) break;
        let did = false;
        try { did = !!t.shove(dir); for (let i = 1; did && i < SMASH.pushes; i++) t.shove(dir); } catch { /* it took what it took */ }
        if (!did) continue;
        landed++;
        const n = smashHurts(t.tier);
        if (n > 0 && typeof t.smash === 'function') { try { if (t.smash(n)?.killed) killed++; } catch { /* the push landed whatever the hurt did */ } }
      }
      // and the small ones a shove passes through (a shadow): what a jab could reach, if it is close enough for a swing
      const swung = new Set(targets.slice(0, landed).map((t) => t.member ?? t.id));
      const near = (t) => { const d = Math.hypot(t.x - me.x, t.z - me.z) - (t.r ?? 0.3); return d <= SHOVE.reach; };
      for (const t of rankShoveTargets(me, [...(env.pursuer?.snipTargets?.() || []), ...(env.residents?.snipTargets?.() || [])].map((t) => ({ ...t, shove: () => true })), los)) {
        const n = smashHurts(t.tier);
        if (!(n > 0) || typeof t.smash !== 'function' || !near(t) || swung.has(t.member ?? t.id)) continue;
        let hit = null; try { hit = t.smash(n); } catch { hit = null; }
        if (hit?.ok) { landed++; swung.add(t.member ?? t.id); if (hit.killed) killed++; }
      }
      const broke = landed > 0 && Math.random() < SMASH.breaks;          // (like the scissors' snap: the page's own roll, nobody told how near it was)
      env.handView?.smashed?.(broke);
      env.play?.(landed ? 'thunk' : 'shuffle');
      if (killed) env.play?.('crack');
      if (broke) {
        // it splits: a last gout of white out of the crack, and it is gone from the pocket
        env.play?.('crack'); env.play?.('hiss'); env.interfere?.(0.4);
        env.inventory?.consumeHeld?.('extinguisher', 1);
        burstT = 0.35;
      }
      return { ok: true, landed, killed, broke };
    },
    update(dt, down = false) {
      if (!(dt > 0)) return;
      clock += dt; if (smashCool > 0) smashCool = Math.max(0, smashCool - dt);
      // split by a smash: what was left in it comes out of the crack all at once, toward whatever it hit
      if (burstT > 0 && env.player?.me) {
        burstT -= dt; if (!spray) spray = createSpray(env);
        camera.getWorldDirection(ahead); camera.getWorldPosition(from); from.y -= 0.25; from.addScaledVector(ahead, 0.55);
        spray.emit(dt * 2.5, from, ahead);
      }
      const item = held(), me = env.player?.me;
      s = trigger(s, dt, { pressed: pressed && !!item, held: !!down && !!item, charge: item ? item.charge : 0 });
      pressed = false;
      if (s.began) env.handView?.spraying?.(true);
      if (s.sprayed > 0) {                              // (the last of it, too: the moment it runs dry it is still spraying)
        const used = env.inventory?.spray?.(s.sprayed);
        if (used?.ok && used.empty) s = { ...s, on: false, ended: true, empty: true };
        else if (used && !used.ok) s = { ...s, on: false, ended: true };
      }
      if (s.on && me) {
        if (!spray) spray = createSpray(env);
        // the white leaves the horn's mouth along its line (hand-extinguisher.js), or, with no hand drawn, from just below the lens
        camera.getWorldDirection(ahead);
        if (!env.handView?.nozzle?.(from, dir)) { camera.getWorldPosition(from); dir.copy(ahead); from.y -= 0.15; from.addScaledVector(dir, 0.4); }
        // (out of the horn, but where the camcorder points: what it is seen to cover is what it reaches, inSpray)
        dir.multiplyScalar(0.3).addScaledVector(ahead, 0.7).normalize();
        spray.emit(dt, from, dir);
        reach(dt, { x: me.x, z: me.z, y: camera.position.y, yaw: me.yaw });
        hissT -= dt; if (hissT <= 0) { env.play?.('hiss'); hissT = 0.24; }
      }
      if (s.ended) { env.handView?.spraying?.(false); hissT = 0; }
      if (s.empty) { env.handView?.dried?.(); env.play?.('sputter'); }
      else if (wasOn && !s.on && !item) env.handView?.spraying?.(false);
      wasOn = s.on;
      spray?.update(dt, camera);
    },
    /** Spraying now. */
    spraying: () => s.on,
    /** How white the picture is, standing where the visitor is: 0…EXTINGUISHER.cloud.thick. */
    whiteOut: () => (spray ? spray.whiteOut() : 0),
    /** So white that nothing a little way off can be seen through it (index.js sees). */
    blinds: () => !!spray && blinds(spray.whiteOut()),
    dispose() { spray?.dispose(); spray = null; marks.clear(); soaked.clear(); },
  };
  env.extinguisher = api;
  return api;
}
