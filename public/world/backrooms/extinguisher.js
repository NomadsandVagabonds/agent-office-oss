// The Backrooms — the fire extinguisher in use, for one part of the building: the trigger, the charge it spends, the hand
// that squeezes it, the white that comes out of it, what that white catches, the fire it puts out and the noise it makes.
// What any of it means is extinguisher.rule.js; this only does it, each moment, for whoever holds one.
//
//   env.extinguisher = { press(), update(dt, held), whiteOut(), spraying(), dispose() }
//     press   the lever is squeezed: a click, Q, a finger on the [E] (a burst, at least: EXTINGUISHER.burst)
//     update  every moment: `held` is the button still being down (the mouse), to go on spraying past the burst
//     whiteOut  how white the picture is where the visitor stands (spray.js): index.js sees() goes blind past `blind`
import * as THREE from 'three';
import { idle, trigger, inSpray, doseOf, tally, stoppedUntil, doused, responseOf, blinds } from './extinguisher.rule.js';
import { TIER } from './cast/health.rule.js';
import { createSpray } from './spray.js';

/**
 * @param env     the part's env (inventory, handView, pursuer, residents, player, world, play, interfere)
 * @param camera  the camcorder's camera (where the white is, round it)
 */
export function createExtinguisher(env, camera) {
  let s = idle(), pressed = false, spray = null, clock = 0, hissT = 0, wasOn = false;
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
    update(dt, down = false) {
      if (!(dt > 0)) return;
      clock += dt;
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
