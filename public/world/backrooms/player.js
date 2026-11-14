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

export function createPlayer(world, camera, start, input = { keys: new Set(), dx: 0, dy: 0, stick: { x: 0, y: 0 } }) {
  const me = { x: start.x, z: start.z, yaw: start.yaw, pitch: 0, vx: 0, vz: 0, wishX: 0, wishZ: 0, moving: false, speed: 0, slow: 1, sink: 0, sinkTo: 0, duck: 0, y: 0, step: 0, shake: 1, drop: 0, dropV: 0, frozen: false };
  // `input`: keys held, mouse movement since last frame, and a thumb stick (x: right, y: forward, each −1…1) — the visit's own
  // (input.js), so that what is held on one floor is still held on the next
  let stride = 0, floor = world.floorY(start.x, start.z), sway = 0, duck = 0, hopHeld = false;
  const listeners = { step: null };

  /** Is there room to be at (x, z)? If the only thing wrong is that you are standing too tall, start ducking. */
  function fits(x, z) {
    if (!world.free(x, z, RADIUS) || !world.passable(me.x, me.z, x, z)) return false;
    const head = world.headroom(x, z);
    if (EYE - me.sink > head - 0.1) { duck = Math.max(duck, EYE - (head - 0.2)); return false; }
    return true;
  }
  function move(dx, dz) {
    const dist = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(dist / 0.06));
    for (let i = 0; i < n; i++) {
      const sx = dx / n, sz = dz / n;
      if (fits(me.x + sx, me.z)) me.x += sx; else me.vx *= 0.5;
      if (fits(me.x, me.z + sz)) me.z += sz; else me.vz *= 0.5;
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
    const eyeNow = EYE - me.sink, crouch = clamp((eyeNow - 0.45) / (EYE - 0.45), 0, 1);
    const top = (k.has('Shift') || Math.hypot(input.stick.x, input.stick.y) > 0.92 ? HURRY : WALK) * me.slow * (0.42 + 0.58 * crouch);
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
    const want = Math.min(EYE - 0.42, Math.max(me.sinkTo, duck, !me.frozen && k.has('c') ? CROUCH : 0));
    me.sink += (want - me.sink) * (1 - Math.exp(-(want > me.sink ? 12 : 6) * dt));        // wading, stooping, crawling
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
    /** Put the player somewhere else, as is (used by rooms that fold space). */
    warp(x, z, yaw) { me.x = x; me.z = z; if (yaw !== undefined) me.yaw = yaw; floor = world.floorY(x, z); },
  };
}
