// Battery belongs to this recording. Depletion ends it; a new visit starts fresh.
export const CAMERA_TUNING = Object.freeze({ capacity: 400, start: 300, batterySeconds: 120 });

export function createCameraBattery({
  capacity = CAMERA_TUNING.capacity,
  start = CAMERA_TUNING.start,
  batterySeconds = CAMERA_TUNING.batterySeconds,
  drainRate = 1,
} = {}) {
  const cap = Number.isFinite(capacity) && capacity > 0 ? capacity : CAMERA_TUNING.capacity;
  const initial = Number.isFinite(start) && start >= 0 ? Math.min(cap, start) : Math.min(cap, CAMERA_TUNING.start);
  const defaultRecharge = Number.isFinite(batterySeconds) && batterySeconds > 0 ? batterySeconds : CAMERA_TUNING.batterySeconds;
  const rate = Number.isFinite(drainRate) && drainRate > 0 ? drainRate : 1;
  let remaining = initial, revision = 0;
  const read = () => ({ remaining, capacity: cap,
    fraction: remaining / cap, depleted: remaining === 0, revision });

  function tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || remaining === 0) return { changed: false, depleted: false };
    remaining = Math.max(0, remaining - dt * rate);
    revision++;
    return { changed: true, depleted: remaining === 0 };
  }

  function recharge(seconds = defaultRecharge) {
    if (!Number.isFinite(seconds) || seconds <= 0) return { ok: false, reason: 'invalid-amount' };
    if (remaining === 0) return { ok: false, reason: 'depleted' };
    if (remaining === cap) return { ok: false, reason: 'full-charge' };
    const added = Math.min(seconds, cap - remaining);
    remaining += added;
    revision++;
    return { ok: true, added, remaining };
  }

  /**
   * Something has taken a share (0…1) of whatever charge is left. It cannot stop the recording by itself: a second
   * is always left, and the tape runs out on its own clock (tick), which is what ends a visit.
   */
  function drain(share) {
    if (!Number.isFinite(share) || share <= 0 || share > 1) return { ok: false, reason: 'invalid-amount' };
    if (remaining === 0) return { ok: false, reason: 'depleted' };
    const left = Math.max(Math.min(remaining, 1), remaining * (1 - share)), taken = remaining - left;
    if (taken <= 0) return { ok: false, reason: 'nothing-left' };
    remaining = left;
    revision++;
    return { ok: true, taken, remaining };
  }

  return { read, tick, recharge, drain };
}
