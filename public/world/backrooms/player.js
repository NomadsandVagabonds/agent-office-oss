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
import { SHOVE, tryShove } from './shove.rule.js';
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

export function createPlayer(world, camera, start, input = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 }, hurry: false }, perk = null) {
  const walkSpeed = WALK * (perk?.walkScale ?? 1);
  const hurrySpeed = HURRY * (perk?.sprintScale ?? 1);
  const crouchFloor = perk?.crouchSpeedFloor ?? 0.42;
  const baseNoise = perk?.noiseScale ?? 1;
  const me = { x: start.x, z: start.z, yaw: start.yaw, pitch: 0, vx: 0, vz: 0, wishX: 0, wishZ: 0, moving: false, speed: 0, slow: 1, sink: 0, sinkTo: 0, duck: 0, y: 0, step: 0, shake: 1, drop: 0, dropV: 0, frozen: false, crouching: false, sprinting: false, noise: baseNoise, wind: 1, winded: 0, shoveT: 0, shoveCool: 0, shoveRest: 0, punch: 0 };
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
      if (sx && !step(sx, 0)) me.vx *= 0.5;
      if (sz && !step(0, sz)) me.vz *= 0.5;
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
    me.vx += (wx - me.vx) * ease; me.vz += (wz - me.vz) * ease;
    const bx = me.x, bz = me.z;
    // how low the ceiling is here, and a pace ahead: duck before you get there
    duck = Math.max(0, EYE - (world.headroom(me.x, me.z) - 0.2));
    if (push) { const ax = me.x + (wx / top) * 0.32, az = me.z + (wz / top) * 0.32; if (world.free(ax, az, RADIUS * 0.6)) duck = Math.max(duck, EYE - (world.headroom(ax, az) - 0.2)); }
    if (Math.abs(me.vx) + Math.abs(me.vz) > 0.002) move(me.vx * dt, me.vz * dt);
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
    // a shove (shove.rule.js): the moment it turns a hit aside, the wait for the next, and the lurch of the camcorder
    if (me.shoveT > 0) me.shoveT = Math.max(0, me.shoveT - dt);
    if (me.shoveCool > 0) me.shoveCool = Math.max(0, me.shoveCool - dt);
    if (me.shoveRest > 0) me.shoveRest = Math.max(0, me.shoveRest - dt);
    if (me.punch > 0) me.punch = Math.max(0, me.punch - dt / 0.3);
    if (me.sprinting) { me.wind = Math.max(0, me.wind - dt / windRun); if (me.wind <= 0) { me.winded = WIND.spent; listeners.winded?.(me); } }
    else if (!(me.shoveRest > 0)) me.wind = Math.min(1, me.wind + dt / (me.moving ? WIND.back : WIND.still));
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
    const lurch = me.punch > 0 ? Math.sin(me.punch * Math.PI) : 0;          // (both hands go out, and the camcorder goes with them)
    camera.position.set(me.x - Math.sin(me.yaw) * lurch * 0.07, me.y - lurch * 0.02, me.z - Math.cos(me.yaw) * lurch * 0.07);
    const hand = me.shake * 0.5;
    camera.rotation.set(
      me.pitch - lurch * 0.035 + Math.sin(sway * 1.3 + 1) * 0.004 * hand,
      me.yaw + Math.sin(sway * 0.9) * 0.005 * hand,
      Math.sin(stride) * 0.006 * Math.min(1, me.speed / WALK) * me.shake + Math.sin(sway * 0.7 + 2) * 0.003 * hand, 'YXZ');
  }

  return {
    me, input, update, RADIUS, EYE,
    on(event, fn) { listeners[event] = fn; },
    /**
     * Both hands out (shove.rule.js). It costs breath, and there is none to be had out of breath or straight after another.
     * @param window  seconds for which a hit from in front will not land
     * @returns whether they shoved
     */
    shove(window = 0.3) {
      const got = tryShove(me);
      if (!got.ok) return false;
      me.wind = got.wind; me.shoveT = window; me.shoveCool = SHOVE.cooldown; me.shoveRest = SHOVE.rest; me.punch = 1;
      if (got.spent) { me.winded = WIND.spent; listeners.winded?.(me); }
      return true;
    },
    /** Put the player somewhere else, as is (used by rooms that fold space). */
    warp(x, z, yaw) { me.x = x; me.z = z; if (yaw !== undefined) me.yaw = yaw; floor = world.floorY(x, z); },
  };
}
