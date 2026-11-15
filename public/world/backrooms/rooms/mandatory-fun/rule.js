// One committee, one visitor at a time. A balloon protects only its holder.
export const PARTY = Object.freeze({
  notice: 1.25, swarmSpeed: 3.35, returnSpeed: 2.1, catchRadius: .65,
  gatherTime: 3, danceTime: 2.4, danceRadius: 1.3, hurts: 1, hitEvery: 1.3,
});
export const createPartyState = () => ({
  mode: 'idle', timer: 0, dancePhase: 0, caught: false, welcomed: false, cooldown: 0,
});
// A nonfatal hit does not send them home. The visitor still has to get away.
export function releaseParty(s) { return { ...s, caught: false, cooldown: PARTY.hitEvery }; }
export function stepParty(s, { dt, insideRoom = false, visible = insideRoom,
  holdingBalloon = false, gathered = false, minDist = Infinity, contactDist = minDist }) {
  const state = { ...s, caught: false, cooldown: Math.max(0, s.cooldown - dt) };
  let horn = false, triggeredSwarm = false, speed = 0;
  const result = () => ({ state, horn, triggeredSwarm, caught: state.caught, speed });
  if (!insideRoom) {
    state.mode = 'idle'; state.timer = 0; speed = PARTY.returnSpeed; return result();
  }
  if (holdingBalloon) {
    if (state.welcomed) {
      state.mode = 'released'; return result();
    }
    if (state.mode !== 'gathering' && state.mode !== 'partying') {
      if (!visible) { state.mode = 'idle'; return result(); }
      state.mode = 'gathering'; state.timer = 0;
    }
    state.timer += dt;
    if (state.mode === 'gathering') {
      speed = PARTY.swarmSpeed;
      if (gathered || state.timer >= PARTY.gatherTime) {
        state.mode = 'partying'; state.timer = 0; horn = true; speed = 0;
      }
    } else if (state.timer >= PARTY.danceTime) {
      state.mode = 'released'; state.welcomed = true; state.timer = 0;
    }
    state.dancePhase += dt * 4.6;
    return result();
  }
  // Seeing the balloon put away revokes the welcome. Merely carrying one in
  // another pocket never protects somebody whose hands are empty.
  if (visible) state.welcomed = false;
  if (state.mode !== 'swarming') {
    if (!visible) { state.mode = 'idle'; state.timer = 0; return result(); }
    if (state.mode !== 'watching') { state.mode = 'watching'; state.timer = 0; }
    state.timer += dt;
    if (state.timer < PARTY.notice) return result();
    state.mode = 'swarming'; triggeredSwarm = true;
  }
  state.dancePhase += dt * 9.5; speed = PARTY.swarmSpeed;
  state.caught = !state.cooldown && contactDist < PARTY.catchRadius;
  return result();
}

/** Prefer an unprotected visible visitor; keep the current target within that group. */
export function partyTarget(people, current, welcomed) {
  const visible = people.filter(p => p.visible);
  for (const p of visible) if (!p.holdingBalloon) welcomed.delete(p.id);
  const threats = visible.filter(p => !p.holdingBalloon);
  const waiting = visible.filter(p => !welcomed.has(p.id));
  const choices = threats.length ? threats : waiting.length ? waiting : visible;
  return choices.find(p => p.id === current) || choices[0];
}
