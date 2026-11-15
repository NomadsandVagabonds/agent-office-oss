// The camcorder's last moments. Pure timing: warning time is real battery
// time, never a grace period added after the recording has already died.
export const BATTERY_ENDING = Object.freeze({ warning: 10, picture: 2.2, icon: 2.7, duration: 3.6 });
const unit = n => Math.max(0, Math.min(1, n));
const smooth = n => { const k = unit(n); return k * k * (3 - 2 * k); };

/** The remaining whole second to show, or null when no urgent warning belongs on screen. */
export function batteryWarning(remaining) {
  return Number.isFinite(remaining) && remaining > 0 && remaining <= BATTERY_ENDING.warning ? Math.ceil(remaining) : null;
}

/** Picture/static die first; the empty battery is the last thing to leave the black screen. */
export function batteryEnding(elapsed) {
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  return {
    black: smooth(t / BATTERY_ENDING.picture),
    snow: smooth(t / 0.6),
    iconOpacity: 1 - smooth((t - BATTERY_ENDING.icon) / (BATTERY_ENDING.duration - BATTERY_ENDING.icon)),
    over: t >= BATTERY_ENDING.duration,
  };
}
