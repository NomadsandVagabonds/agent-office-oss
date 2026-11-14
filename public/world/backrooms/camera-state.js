// Battery belongs to this recording. Depletion ends it; a new visit starts fresh.
export const CAMERA_TUNING = Object.freeze({ capacity: 400, start: 300, batterySeconds: 120 });

export function createCameraBattery() {
  let remaining = CAMERA_TUNING.start, revision = 0;
  const read = () => ({ remaining, capacity: CAMERA_TUNING.capacity,
    fraction: remaining / CAMERA_TUNING.capacity, depleted: remaining === 0, revision });

  function tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || remaining === 0) return { changed: false, depleted: false };
    remaining = Math.max(0, remaining - dt);
    revision++;
    return { changed: true, depleted: remaining === 0 };
  }

  function recharge(seconds = CAMERA_TUNING.batterySeconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return { ok: false, reason: 'invalid-amount' };
    if (remaining === 0) return { ok: false, reason: 'depleted' };
    if (remaining === CAMERA_TUNING.capacity) return { ok: false, reason: 'full-charge' };
    const added = Math.min(seconds, CAMERA_TUNING.capacity - remaining);
    remaining += added;
    revision++;
    return { ok: true, added, remaining };
  }

  return { read, tick, recharge };
}
