// Visit-local health. Only supplied simulation time advances the hit cooldown.
const MAX_HEALTH = 4;
const HIT_COOLDOWN = 1.25;
const validAmount = amount => Number.isSafeInteger(amount) && amount > 0;

export function createHealth({ max = MAX_HEALTH, regenSeconds = 0, maxSnackHealth = max } = {}) {
  if (!Number.isSafeInteger(max) || max < 1 || max > MAX_HEALTH) throw new RangeError('Max health must be one to four.');
  const snackCap = Number.isSafeInteger(maxSnackHealth) ? Math.max(1, Math.min(max, maxSnackHealth)) : max;
  const regenPeriod = Number.isFinite(regenSeconds) && regenSeconds > 0 ? regenSeconds : 0;
  let current = max, cooldown = 0, regenElapsed = 0, revision = 0;
  const fail = reason => ({ ok: false, reason });
  const read = () => ({ current, max, dead: current === 0,
    invulnerable: current > 0 && cooldown > 0, cooldown, revision });

  function damage(amount = 1) {
    if (!validAmount(amount)) return fail('invalid-amount');
    if (current === 0) return fail('dead');
    if (cooldown > 0) return fail('invulnerable');
    const taken = Math.min(current, amount);
    current -= taken;
    cooldown = current > 0 ? HIT_COOLDOWN : 0;
    regenElapsed = 0;
    revision++;
    return { ok: true, amount: taken, dead: current === 0, health: read() };
  }

  function heal(amount = 1, { snack = false } = {}) {
    if (!validAmount(amount)) return fail('invalid-amount');
    if (current === 0) return fail('dead');
    if (current === max) return fail('full-health');
    if (snack && current >= snackCap) return fail('snack-cap');
    const cap = snack ? snackCap : max;
    const restored = Math.min(cap - current, amount);
    current += restored;
    if (current === max) regenElapsed = 0;
    revision++;
    return { ok: true, amount: restored, dead: false, health: read() };
  }

  function tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return { changed: false };
    let changed = false;
    if (cooldown > 0) {
      cooldown = Math.max(0, cooldown - dt);
      changed = true;
    }
    if (regenPeriod > 0 && current > 0 && current < max) {
      regenElapsed += dt;
      while (regenElapsed >= regenPeriod && current < max) {
        regenElapsed -= regenPeriod;
        current++;
        changed = true;
      }
      if (current === max) regenElapsed = 0;
    }
    if (!changed) return { changed: false };
    revision++;
    return { changed: true };
  }

  return { read, damage, heal, tick };
}
