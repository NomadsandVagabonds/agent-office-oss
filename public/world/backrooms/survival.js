// Visit-owned health and camera power for the optional inventory prototype.
// Models use simulated time; the visit alone decides whether that time runs.
import { createHealth } from './health-state.js';
import { createCameraBattery } from './camera-state.js';

export function createSurvival(env, { canAct, isPaused, onEnd }) {
  const healthState = createHealth(), cameraState = createCameraBattery();
  let disposed = false;
  const unavailable = () => disposed || !canAct();
  const healthFailure = reason => ({ ok: false, reason, dead: healthState.read().dead, health: healthState.read() });
  const health = {
    read: () => healthState.read(),
    damage(amount = 1) {
      if (unavailable()) return healthFailure('unavailable');
      if (isPaused()) return healthFailure('paused');
      const result = healthState.damage(amount);
      if (result.ok) {
        env.sound.play('thunk', { vol: .55 }); env.interfere(.55); env.hud.glitch(.18);
        if (result.dead) onEnd('caught');
      }
      return result;
    },
    heal(amount = 1) {
      // Inspecting pauses threats, but eating in the panel is still an action.
      if (unavailable()) return healthFailure('unavailable');
      return healthState.heal(amount);
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
  };
  env.hud.battery(cameraState.read());
  return {
    health, camera,
    update(dt, playing) {
      if (disposed) return;
      if (playing && !unavailable() && !isPaused()) {
        healthState.tick(dt);
        if (cameraState.tick(dt).depleted) onEnd('battery');
      }
      env.hud.battery(cameraState.read());
    },
    dispose() { disposed = true; },
  };
}
