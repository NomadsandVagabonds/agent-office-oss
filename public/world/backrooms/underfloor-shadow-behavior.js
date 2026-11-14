// The thing upstairs can only see and reach through the three real openings.
// Kept free of renderer state so warning time, cover and catches stay testable.
export const SHADOW = Object.freeze({
  aperture: .56, slot: .14, targetDepth: .46, catchRadius: .34,
  speed: .72, firstWatch: 5.8, watch: 2.6,
  notice: 1.05, forget: .45, windup: .65, reach: .8, extend: .35,
  hitStart: .38, hitEnd: .68, retract: .9, cooldown: 3.5,
});
const STEP = 1 / 120;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };

export function underGrate(plan, grate, player) {
  const b = plan.crossings[grate];
  return !!b && Number.isFinite(player?.x) && Number.isFinite(player?.z)
    && Math.abs(player.x) < SHADOW.aperture && Math.abs(player.z - b.z) < SHADOW.aperture
    && (!Number.isFinite(player.y) || player.y <= .98);
}

export function createShadowState(plan) {
  return {
    time: 0, accumulator: 0, phase: 'patrol', phaseTime: 0,
    x: 0, z: plan.crossings[0].z, yaw: Math.PI, grate: 0,
    direction: 1, destination: 0, moving: false, dwell: SHADOW.firstWatch,
    stride: 0, awareness: 0, cooldown: 0, caught: false,
    target: { x: 0, z: plan.crossings[0].z },
    retractLean: 0, retractReach: 0, events: [],
  };
}

function event(s, type) {
  s.events.push({ type, grate: s.grate, x: s.target.x, z: s.target.z });
}
function enter(s, phase) { s.phase = phase; s.phaseTime = 0; }
function retract(s, reason) {
  s.retractLean = s.phase === 'notice' ? .15 + .7 * s.awareness : 1;
  s.retractReach = s.phase === 'reach' ? 1 : 0;
  enter(s, 'retract');
  event(s, reason);
}

function advance(s, dt, player, plan) {
  s.time += dt;
  s.phaseTime += dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  const visible = underGrate(plan, s.grate, player);

  if (s.phase === 'patrol') {
    if (s.moving) {
      const to = plan.crossings[s.destination].z, delta = to - s.z;
      const distance = Math.min(Math.abs(delta), SHADOW.speed * dt);
      s.z += Math.sign(delta) * distance;
      s.stride += distance * 5;
      if (Math.abs(to - s.z) < 1e-8) {
        s.z = to; s.grate = s.destination; s.moving = false;
        s.dwell = SHADOW.watch;
        s.target = { x: 0, z: to };
        event(s, 'arrive');
      }
    } else if (visible && s.cooldown <= 0) {
      s.awareness = 0; s.caught = false;
      s.target = { x: 0, z: plan.crossings[s.grate].z };
      enter(s, 'notice'); event(s, 'notice');
    } else {
      s.dwell -= dt;
      if (s.dwell <= 0) {
        if (s.grate === plan.crossings.length - 1) s.direction = -1;
        if (s.grate === 0) s.direction = 1;
        s.destination = s.grate + s.direction;
        s.moving = true;
        s.yaw = plan.crossings[s.destination].z > s.z ? 0 : Math.PI;
        event(s, 'depart');
      }
    }
  } else if (s.phase === 'notice') {
    s.awareness = clamp(s.awareness + dt * (visible ? 1 / SHADOW.notice : -1 / SHADOW.forget), 0, 1);
    if (!visible && s.awareness <= 0) retract(s, 'lost');
    else if (s.awareness >= 1) {
      // The wrist is committed before the lunge. The player can escape either
      // sideways onto covered boards or lengthways past the opening.
      const z = plan.crossings[s.grate].z;
      s.target = { x: clamp(player.x, -SHADOW.slot, SHADOW.slot), z: clamp(player.z, z - SHADOW.targetDepth, z + SHADOW.targetDepth) };
      enter(s, 'windup'); event(s, 'windup');
    }
  } else if (s.phase === 'windup') {
    if (s.phaseTime >= SHADOW.windup) { enter(s, 'reach'); event(s, 'reach'); }
  } else if (s.phase === 'reach') {
    if (!s.caught && visible && s.phaseTime >= SHADOW.hitStart && s.phaseTime <= SHADOW.hitEnd
      && Math.hypot(player.x - s.target.x, player.z - s.target.z) <= SHADOW.catchRadius) {
      s.caught = true;
      event(s, 'caught');
    }
    if (s.phaseTime >= SHADOW.reach) retract(s, 'release');
  } else if (s.phase === 'retract' && s.phaseTime >= SHADOW.retract) {
    s.cooldown = SHADOW.cooldown;
    s.dwell = .45;
    s.awareness = 0;
    s.caught = false;
    enter(s, 'patrol');
  }
}

/** Call only while this room is active. A long browser stall cannot skip the warning. */
export function updateShadow(s, dt, player, plan) {
  s.events = [];
  if (!Number.isFinite(dt) || dt <= 0) return s.events;
  s.accumulator += Math.min(dt, .25);
  while (s.accumulator + 1e-10 >= STEP) {
    s.accumulator -= STEP;
    advance(s, STEP, player, plan);
  }
  return s.events;
}

export function shadowPose(s, plan) {
  let lean = s.moving ? 0 : .12, reach = 0;
  if (s.phase === 'notice') lean = .15 + .7 * s.awareness;
  if (s.phase === 'windup') lean = .85 + .15 * ease(s.phaseTime / SHADOW.windup);
  if (s.phase === 'reach') { lean = 1; reach = ease(s.phaseTime / SHADOW.extend); }
  if (s.phase === 'retract') {
    const rest = 1 - ease(s.phaseTime / SHADOW.retract);
    lean = s.retractLean * rest; reach = s.retractReach * rest;
  }
  return {
    x: s.x, z: s.z, yaw: s.yaw, lean, reach, target: { ...s.target },
    stride: s.stride, moving: s.moving, phase: s.phase, grate: s.grate,
    attention: s.awareness, caught: s.caught,
    // The same pose drives the deck flex and the figure's planted feet.
    pressure: s.moving ? 0 : lean * .55 + reach * .45,
  };
}
