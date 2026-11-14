// Visit-local health. Only supplied simulation time advances the hit cooldown.
const MAX_HEALTH = 4;
const HIT_COOLDOWN = 1.25;
const validAmount = amount => Number.isSafeInteger(amount) && amount > 0;

export function createHealth() {
  let current = MAX_HEALTH, cooldown = 0, revision = 0;
  const fail = reason => ({ ok: false, reason });
  const read = () => ({ current, max: MAX_HEALTH, dead: current === 0,
    invulnerable: current > 0 && cooldown > 0, cooldown, revision });

  function damage(amount = 1) {
    if (!validAmount(amount)) return fail('invalid-amount');
    if (current === 0) return fail('dead');
    if (cooldown > 0) return fail('invulnerable');
    const taken = Math.min(current, amount);
    current -= taken;
    cooldown = current > 0 ? HIT_COOLDOWN : 0;
    revision++;
    return { ok: true, amount: taken, dead: current === 0, health: read() };
  }

  function heal(amount = 1) {
    if (!validAmount(amount)) return fail('invalid-amount');
    if (current === 0) return fail('dead');
    if (current === MAX_HEALTH) return fail('full-health');
    const restored = Math.min(MAX_HEALTH - current, amount);
    current += restored;
    revision++;
    return { ok: true, amount: restored, dead: false, health: read() };
  }

  function tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || cooldown === 0) return { changed: false };
    cooldown = Math.max(0, cooldown - dt);
    revision++;
    return { changed: true };
  }

  return { read, damage, heal, tick };
}
