// The Backrooms — you. A camera at chibi eye height that walks, turns, and
// cannot leave the level: a position is only ever accepted if the world says a
// body fits there (world.free), tried one axis at a time so you slide along
// walls instead of sticking to them.
const RADIUS = 0.22, EYE = 1.1, WALK = 2.05, HURRY = 3.7;
const TURN = 2.1, MOUSE = 0.0023, PITCH_MAX = 1.25;

export function createPlayer(world, camera, start) {
  const me = { x: start.x, z: start.z, yaw: start.yaw, pitch: 0, vx: 0, vz: 0, moving: false, speed: 0, room: null, slow: 1, sink: 0, sinkTo: 0, y: 0, step: 0, shake: 1, drop: 0, dropV: 0, frozen: false };
  const input = { keys: new Set(), dx: 0, dy: 0 };
  let stride = 0, floor = 0, sway = 0;
  const listeners = { step: null };

  function move(dx, dz) {
    const dist = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(dist / 0.07));
    for (let i = 0; i < n; i++) {
      const sx = dx / n, sz = dz / n;
      if (world.free(me.x + sx, me.z, RADIUS)) me.x += sx; else me.vx = 0;
      if (world.free(me.x, me.z + sz, RADIUS)) me.z += sz; else me.vz = 0;
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

  function update(dt, t) {
    const k = input.keys;
    // looking
    me.yaw -= input.dx * MOUSE; me.pitch -= input.dy * MOUSE;
    input.dx = 0; input.dy = 0;
    if (!me.frozen) {
      if (k.has('ArrowLeft')) me.yaw += TURN * dt;
      if (k.has('ArrowRight')) me.yaw -= TURN * dt;
      if (k.has('PageUp')) me.pitch += 1.2 * dt;
      if (k.has('PageDown')) me.pitch -= 1.2 * dt;
    }
    me.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, me.pitch));
    // walking
    let f = 0, s = 0;
    if (!me.frozen) {
      if (k.has('w') || k.has('ArrowUp')) f += 1;
      if (k.has('s') || k.has('ArrowDown')) f -= 1;
      if (k.has('d')) s += 1;
      if (k.has('a')) s -= 1;
    }
    const len = Math.hypot(f, s) || 1, top = (k.has('Shift') ? HURRY : WALK) * me.slow;
    const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
    const wx = ((-sin * f + cos * s) / len) * top, wz = ((-cos * f - sin * s) / len) * top;
    const ease = 1 - Math.exp(-(f || s ? 9 : 12) * dt);
    me.vx += (wx - me.vx) * ease; me.vz += (wz - me.vz) * ease;
    const bx = me.x, bz = me.z;
    if (Math.abs(me.vx) + Math.abs(me.vz) > 0.002) move(me.vx * dt, me.vz * dt);
    unstick();
    const went = Math.hypot(me.x - bx, me.z - bz);
    me.speed = went / Math.max(dt, 1e-4);
    me.moving = me.speed > 0.25;
    // the bob of somebody carrying a camcorder
    stride += went * 2.6;
    const beat = Math.floor(stride / Math.PI);
    if (beat !== me.step) { me.step = beat; listeners.step?.(me); }
    sway += dt;
    const target = world.floorY(me.x, me.z);
    floor = Math.abs(target - floor) > 1.0 ? target : floor + (target - floor) * (1 - Math.exp(-14 * dt));
    // landing: a fall from the ceiling, a bounce
    if (me.drop > 0 || me.dropV !== 0) { me.dropV -= 9 * dt; me.drop += me.dropV * dt; if (me.drop <= 0) { me.drop = 0; me.dropV = me.dropV < -1.2 ? -me.dropV * 0.22 : 0; if (me.dropV > 0) me.drop = 0.001; } }
    me.sink += (me.sinkTo - me.sink) * (1 - Math.exp(-7 * dt));        // wading, stooping
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
