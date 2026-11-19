// Visit-owned health and camera power.
// Models use simulated time. The visit controls actions and clocks separately:
// a fall can keep recording while its rider cannot be hurt or use supplies.
import { difficultyOf, difficultyPerk } from '../../../core/difficulty.mjs';
import { createHealth } from './health-state.js';
import { createCameraBattery } from './camera-state.js';

// dev: under ?debug only (index.js), { god, stopClock }: nothing hurts, and the battery does not run down. Never in a visit
// that can be scored: a debug visit never signs the book.
export function createSurvival(env, { canAct, onEnd, perk, difficulty = () => 'training-wheels', dev = null }) {
  const basePerk = perk;
  perk = difficultyPerk(perk, difficulty());
  const healthState = createHealth({
    max: perk?.maxHealth,
    regenSeconds: perk?.regenSeconds,
    maxSnackHealth: perk?.maxSnackHealth,
  });
  const cameraState = createCameraBattery({
    capacity: perk?.cameraCapacity,
    start: perk?.cameraStart,
    batterySeconds: perk?.batterySeconds,
    drainRate: perk?.cameraDrainRate,
  });
  let disposed = false, ended = false;
  const unavailable = () => disposed || ended || !canAct();
  const finish = reason => {
    if (disposed || ended) return;
    ended = true;
    onEnd(reason);
  };
  const healthFailure = reason => ({ ok: false, reason, dead: healthState.read().dead, health: healthState.read() });
  const health = {
    read: () => healthState.read(),
    damage(amount = 1) {
      if (unavailable()) return healthFailure('unavailable');
      if (difficultyOf(difficulty()).immune) return healthFailure('tourist');
      if (dev?.god) return healthFailure('god');
      const result = healthState.damage(amount);
      if (result.ok) {
        env.sound.play('thunk', { vol: .55 }); env.interfere(.55); env.hud.glitch(.18);
        env.red?.(.48);
        if (result.dead) finish('caught');
      }
      return result;
    },
    heal(amount = 1, opt) {
      if (unavailable()) return healthFailure('unavailable');
      if (opt?.snack && difficultyOf(difficulty()).snack === 0) return healthFailure('snacks-disabled');
      return healthState.heal(amount, opt);
    },
  };
  const camera = {
    read: () => cameraState.read(),
    recharge(seconds) {
      if (unavailable()) return { ok: false, reason: 'unavailable' };
      const result = cameraState.recharge(seconds);
      if (result.ok) env.hud.battery(cameraState.read());
      return result;
    },
    /** Something down here has taken a share (0…1) of the charge that is left. → { ok, taken?, remaining? } */
    drain(share) {
      if (unavailable()) return { ok: false, reason: 'unavailable' };
      if (difficultyOf(difficulty()).immune) return { ok: false, reason: 'tourist' };
      if (dev?.god || dev?.stopClock) return { ok: false, reason: 'god' };
      const result = cameraState.drain(share);
      if (result.ok) env.hud.battery(cameraState.read());
      return result;
    },
  };
  env.hud.battery(cameraState.read());
  return {
    health, camera,
    setDifficulty() {
      const next = difficultyPerk(basePerk, difficulty());
      healthState.configure({ max: next.maxHealth, regenSeconds: next.regenSeconds, maxSnackHealth: next.maxSnackHealth });
    },
    update(dt, running) {
      if (disposed) return;
      if (running && !ended) {
        healthState.tick(dt);
        if (!difficultyOf(difficulty()).immune && !dev?.stopClock && cameraState.tick(dt).depleted) finish('battery');
      }
      env.hud.battery(cameraState.read());
    },
    dispose() { disposed = true; },
  };
}
