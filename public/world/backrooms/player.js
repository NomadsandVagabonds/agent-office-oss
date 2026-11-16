// The Backrooms — you. A camera at chibi eye height that walks, turns, climbs
// stairs, ducks under whatever is low, and cannot leave the level: a step is
// only ever taken if the world says a body fits there (world.free), the floor
// does not jump by more than a stair (world.passable), and you are already
// stooped low enough for the ceiling ahead. Tried one axis at a time, so you
// slide along walls instead of sticking to them.
//
// Space is a small hop and C (held) a crouch. Neither is needed to get
// anywhere: you still duck by yourself under anything low, and a hop clears
// nothing a step would not. They are there because hands expect them.
const RADIUS = 0.22, EYE = 1.1, WALK = 2.05, HURRY = 3.7;
const HOP = 2.75, GRAVITY = 9, CROUCH = 0.5;      // take-off speed (m/s: about 0.4 m of air), and how far a held crouch lowers the eye
const TURN = 2.1, MOUSE = 0.0023, PITCH_MAX = 1.25;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/**
 * Breath. A run is paid for: `run` seconds of it from fresh, and then you are out of breath: for `spent` seconds there is no
 * running at all and a walk is `slow` of a walk. It comes back in `still` seconds standing, `back` seconds on the move.
 * Nothing on the screen says how much is left; you hear it when it is gone (index.js plays the panting).
 */
export const WIND = Object.freeze({ run: 8, back: 9, still: 5, spent: 3.4, slow: 0.5 });
/**
 * Being hit. A blow that lands throws you back from whatever dealt it: `speed` m/s to begin with, losing it at `fade` a
 * second (about speed / fade metres in all, most of it in the first half second), with a small `hop` off the floor; and for
 * `stagger` seconds your own legs have only `legs` of their say. A wall stops it as it stops a walk, and you slide along it.
 * With the health's moment of grace after a hit (health-state.js), it is the room there is to get away in.
 */
export const KNOCK = Object.freeze({ speed: 7, fade: 5.5, hop: 1.3, stagger: 0.3, legs: 0.25 });

export function createPlayer(world, camera, start, input = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false }, perk = null) {
  const walkSpeed = WALK * (perk?.walkScale ?? 1);
  const hurrySpeed = HURRY * (perk?.sprintScale ?? 1);
  const crouchFloor = perk?.crouchSpeedFloor ?? 0.42;
  const baseNoise = perk?.noiseScale ?? 1;
  const me = { x: start.x, z: start.z, yaw: start.yaw, pitch: 0, vx: 0, vz: 0, wishX: 0, wishZ: 0, moving: false, speed: 0, slow: 1, sink: 0, sinkTo: 0, duck: 0, y: 0, step: 0, shake: 1, drop: 0, dropV: 0, frozen: false, crouching: false, sprinting: false, noise: baseNoise, wind: 1, winded: 0, kx: 0, kz: 0, staggered: 0 };
  // `input`: keys held, mouse movement since last frame, and a thumb stick (x: right, y: forward, each −1…1; hurry: pushed
  // past its ring, which is what Shift is) — the visit's own (input.js), so that what is held on one floor is still held on the next
  let stride = 0, floor = world.floorY(start.x, start.z), sway = 0, duck = 0, hopHeld = false;
  const listeners = { step: null, move: null, winded: null };
  const windRun = WIND.run * (perk?.windScale ?? 1);

  /** Is there room to be at (x, z)? If the only thing wrong is that you are standing too tall, start ducking. */
  function fits(x, z) {
    if (!world.free(x, z, RADIUS) || !world.passable(me.x, me.z, x, z)) return false;
    const head = world.headroom(x, z);
    if (EYE - me.sink > head - 0.1) { duck = Math.max(duck, EYE - (head - 0.2)); return false; }
    return true;
  }
  function move(dx, dz) {
    const step = (sx, sz) => {
      const apply = (x, z) => {
        if (!fits(me.x + x, me.z + z)) return false;
        me.x += x; me.z += z; return true;
      };
      return listeners.move ? listeners.move(sx, sz, apply) : apply(sx, sz);
    };
    const dist = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(dist / 0.06));
    for (let i = 0; i < n; i++) {
      const sx = dx / n, sz = dz / n;
      if (sx && !step(sx, 0)) { me.vx *= 0.5; me.kx = 0; }
      if (sz && !step(0, sz)) { me.vz *= 0.5; me.kz = 0; }
    }
  }
  /** If something closed around you (a teleport, a door), step out to the nearest free spot. */
  function unstick() {
    if (world.free(me.x, me.z, RADIUS)) return;
    for (let r = 0.1; r < 2.5; r += 0.1) for (let a = 0; a < 12; a++) {
      const x = me.x + Math.cos(a * 0.5236) * r, z = me.z + Math.sin(a * 0.5236) * r;
      if (world.free(x, z, RADIUS)) { me.x = x; me.z = z; return; }
    }
  }

  function update(dt) {
    const k = input.keys;
    // looking
    const sensitivity = input.sensitivity ?? 1;
    me.yaw -= input.dx * MOUSE * sensitivity;
    me.pitch -= input.dy * MOUSE * sensitivity * (input.invertY ? -1 : 1);
    input.dx = 0; input.dy = 0;
    if (!me.frozen) {
      if (k.has('ArrowLeft')) me.yaw += TURN * dt;
      if (k.has('ArrowRight')) me.yaw -= TURN * dt;
      if (k.has('PageUp')) me.pitch += 1.2 * dt;
      if (k.has('PageDown')) me.pitch -= 1.2 * dt;
    }
    me.pitch = clamp(me.pitch, -PITCH_MAX, PITCH_MAX);
    // a hop: one per press, from the ground, and not while stooped under something
    const hop = !me.frozen && k.has(' ');
    if (hop && !hopHeld && me.drop === 0 && me.dropV === 0 && me.sink < 0.12 && me.sinkTo < 0.05) { me.dropV = HOP; me.drop = 0.001; listeners.step?.(me); }
    hopHeld = hop;
    // walking
    let f = 0, s = 0;
    if (!me.frozen) {
      if (k.has('w') || k.has('ArrowUp')) f += 1;
      if (k.has('s') || k.has('ArrowDown')) f -= 1;
      if (k.has('d')) s += 1;
      if (k.has('a')) s -= 1;
      f += input.stick.y; s += input.stick.x;
    }
    const push = Math.hypot(f, s), len = Math.max(1, push);
    // (a thumb walks unless it is pushed past the ring on purpose: there are rooms where running is noticed)
    // (a thumb walks unless it is pushed past the ring on purpose, which is `hurry` — input.js: a full push is not a run.
    // There are creatures that hear running, and on a phone a full push is simply how a thumb walks.)
    const sprintingInput = k.has('Shift') || input.hurry;
    const running = sprintingInput && !(me.winded > 0);          // out of breath: Shift does nothing until it is back
    const eyeNow = EYE - me.sink, crouch = clamp((eyeNow - 0.45) / (EYE - 0.45), 0, 1);
    const top = Math.min(running ? hurrySpeed : walkSpeed, me.gripSpeed ?? Infinity) * me.slow * (me.winded > 0 ? WIND.slow : 1) * (crouchFloor + (1 - crouchFloor) * crouch);
    const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
    const wx = ((-sin * f + cos * s) / len) * top, wz = ((-cos * f - sin * s) / len) * top;
    me.wishX = push ? wx / top : 0; me.wishZ = push ? wz / top : 0;          // which way you are trying to go (a wall may have other ideas)
    const ease = 1 - Math.exp(-(push ? 9 : 12) * dt);
    // (just hit: your legs have little say for a moment, and whatever threw you has the rest — KNOCK)
    if (me.frozen) { me.kx = 0; me.kz = 0; me.staggered = 0; }
    const legs = me.staggered > 0 ? KNOCK.legs : 1;
    me.vx += (wx * legs - me.vx) * ease; me.vz += (wz * legs - me.vz) * ease;
    const bx = me.x, bz = me.z;
    // how low the ceiling is here, and a pace ahead: duck before you get there
    duck = Math.max(0, EYE - (world.headroom(me.x, me.z) - 0.2));
    if (push) { const ax = me.x + (wx / top) * 0.32, az = me.z + (wz / top) * 0.32; if (world.free(ax, az, RADIUS * 0.6)) duck = Math.max(duck, EYE - (world.headroom(ax, az) - 0.2)); }
    const gx = me.vx + me.kx, gz = me.vz + me.kz;
    if (Math.abs(gx) + Math.abs(gz) > 0.002) move(gx * dt, gz * dt);
    if (me.kx || me.kz) {
      const fade = Math.exp(-KNOCK.fade * dt);
      me.kx *= fade; me.kz *= fade;
      if (Math.hypot(me.kx, me.kz) < 0.05) { me.kx = 0; me.kz = 0; }
    }
    if (me.staggered > 0) me.staggered = Math.max(0, me.staggered - dt);
    unstick();
    me.duck = duck;
    const went = Math.hypot(me.x - bx, me.z - bz);
    me.speed = went / Math.max(dt, 1e-4);
    me.moving = me.speed > 0.25;
    const want = Math.min(EYE - 0.42, Math.max(me.sinkTo, duck, !me.frozen && k.has('c') ? CROUCH : 0));
    me.sink += (want - me.sink) * (1 - Math.exp(-(want > me.sink ? 12 : 6) * dt));        // wading, stooping, crawling
    me.crouching = me.sink >= 0.26;
    me.sprinting = push > 0 && running && me.sink < 0.2 && me.moving;
    if (me.winded > 0) me.winded = Math.max(0, me.winded - dt);
    if (me.sprinting) { me.wind = Math.max(0, me.wind - dt / windRun); if (me.wind <= 0) { me.winded = WIND.spent; listeners.winded?.(me); } }
    else me.wind = Math.min(1, me.wind + dt / (me.moving ? WIND.back : WIND.still));
    me.noise = me.crouching && perk?.id === 'night-cleaner' ? 0 : baseNoise;
    // the bob of somebody carrying a camcorder
    stride += went * 2.6;
    const beat = Math.floor(stride / Math.PI);
    if (beat !== me.step) { me.step = beat; listeners.step?.(me); }
    sway += dt;
    const target = world.floorY(me.x, me.z);
    floor = Math.abs(target - floor) > 1.0 ? target : floor + (target - floor) * (1 - Math.exp(-13 * dt));
    // landing: a fall from the ceiling, a bounce
    if (me.drop > 0 || me.dropV !== 0) {
      me.dropV -= GRAVITY * dt; me.drop += me.dropV * dt;
      // a ceiling stops a hop short
      const room = world.headroom(me.x, me.z) - 0.12 - (EYE - me.sink);
      if (me.dropV > 0 && me.drop > room) { me.drop = Math.max(0, room); me.dropV = 0; }
      if (me.drop <= 0) { const hit = me.dropV; me.drop = 0; me.dropV = hit < -1.2 ? Math.min(1.15, -hit * 0.22) : 0; if (me.dropV > 0) me.drop = 0.001; if (hit < -2) listeners.step?.(me); }
    }
    const bob = Math.sin(stride * 2) * 0.016 * Math.min(1, me.speed / WALK) * me.shake;
    me.y = floor + EYE - me.sink + bob + me.drop;
    camera.position.set(me.x, me.y, me.z);
    const hand = me.shake * 0.5;
    camera.rotation.set(
      me.pitch + Math.sin(sway * 1.3 + 1) * 0.004 * hand,
      me.yaw + Math.sin(sway * 0.9) * 0.005 * hand,
      Math.sin(stride) * 0.006 * Math.min(1, me.speed / WALK) * me.shake + Math.sin(sway * 0.7 + 2) * 0.003 * hand, 'YXZ');
  }

  return {
    me, input, update, RADIUS, EYE,
    on(event, fn) { listeners[event] = fn; },
    /** Put the player somewhere else, as is (used by rooms that fold space). Whatever was throwing you does not come along. */
    warp(x, z, yaw) { me.x = x; me.z = z; if (yaw !== undefined) me.yaw = yaw; floor = world.floorY(x, z); me.kx = 0; me.kz = 0; },
    /**
     * A blow has landed: be thrown back from `from` ({ x, z }, world coordinates: where whatever dealt it is). Nobody said
     * where, or it is on top of you: straight back from where you are looking. Not while something has hold of you (frozen).
     * → whether you were thrown.
     */
    knock(from) {
      if (me.frozen) return false;
      const said = Number.isFinite(from?.x) && Number.isFinite(from?.z);
      let dx = said ? me.x - from.x : 0, dz = said ? me.z - from.z : 0, d = Math.hypot(dx, dz);
      if (!(d > 0.05)) { dx = Math.sin(me.yaw); dz = Math.cos(me.yaw); d = 1; }
      me.kx = (dx / d) * KNOCK.speed; me.kz = (dz / d) * KNOCK.speed;
      me.vx = 0; me.vz = 0; me.staggered = KNOCK.stagger;
      if (me.drop === 0 && me.dropV === 0 && me.sink < 0.12) { me.dropV = KNOCK.hop; me.drop = 0.001; }
      return true;
    },
  };
}
