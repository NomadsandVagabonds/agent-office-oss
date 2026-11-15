// Small, rigid scenery panels. No stacking, balance solver or rigid-body engine.
// The floor underneath a bridge is always queried without movable surfaces:
// two floating panels cannot support one another.
export const BRIDGE = Object.freeze({ bearing: .22, sample: .10, thickness: .08, width: .72, max: 4, tipSeconds: .45 });
const EPS = .015;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const pointIn = (b, x, z, pad = 0) => x >= b.x0 + pad && x <= b.x1 - pad && z >= b.z0 + pad && z <= b.z1 - pad;
export const bodyOver = (b, a) => (a.x - clamp(a.x, b.x0, b.x1)) ** 2 + (a.z - clamp(a.z, b.z0, b.z1)) ** 2 < (a.r ?? .22) ** 2;

/** A panel's eight corners as it tips onto its front. Facing is a quarter turn,
 * 0 toward +z. The hinge is at (x,y,z); bottom/top are room-local heights. */
export function cutoutBounds({ x, z, y = 0, width, height, thickness = BRIDGE.thickness, facing = 0 }, angle = 0) {
  const cs = Math.cos(facing * Math.PI / 2), sn = Math.sin(facing * Math.PI / 2), ca = Math.cos(angle), sa = Math.sin(angle);
  const b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity, bottom: Infinity, top: -Infinity };
  for (const u of [-width / 2, width / 2]) for (const v of [0, height]) for (const w of [-thickness / 2, thickness / 2]) {
    const forward = v * sa + w * ca, up = v * ca - w * sa + thickness / 2;
    const px = x + cs * u + sn * forward, pz = z - sn * u + cs * forward;
    b.x0 = Math.min(b.x0, px); b.x1 = Math.max(b.x1, px); b.z0 = Math.min(b.z0, pz); b.z1 = Math.max(b.z1, pz);
    b.bottom = Math.min(b.bottom, y + up); b.top = Math.max(b.top, y + up);
  }
  return { ...b, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
}

/** Both full-width end strips must rest on real, level ground. The middle may
 * be over a pit, but may not cut into higher ground or a room boundary. */
export function bridgeSupport(world, box, axis = 'z', bearing = BRIDGE.bearing) {
  if (!['x', 'z'].includes(axis) || !Number.isFinite(bearing) || bearing < BRIDGE.bearing) return { ok: false };
  const width = axis === 'z' ? box.x1 - box.x0 : box.z1 - box.z0;
  const length = axis === 'z' ? box.z1 - box.z0 : box.x1 - box.x0;
  if (![width, length, box.y, box.top].every(Number.isFinite) || width < BRIDGE.width || length < bearing * 2 || Math.max(width, length) > BRIDGE.max + EPS || box.top - box.y > .18) return { ok: false };
  const floorAt = world.terrainY || world.floorY;
  const nw = Math.ceil(width / BRIDGE.sample), nl = Math.ceil(length / BRIDGE.sample);
  let spansGap = false, roomId;
  for (let i = 0; i <= nl; i++) for (let j = 0; j <= nw; j++) {
    const u = length * i / nl, v = width * j / nw;
    const x = box.x0 + (axis === 'x' ? u : v), z = box.z0 + (axis === 'x' ? v : u);
    const room = world.roomAt(x, z), floor = floorAt(x, z);
    if (!room || room.fold || room.flat || room.def?.way || room.def?.kind === 'exit' || !Number.isFinite(floor)) return { ok: false };
    roomId ??= room.id;
    if (room.id !== roomId || floor > box.y + EPS) return { ok: false };
    const ceiling = world.ceilingY ? world.ceilingY(x, z) : world.floorY(x, z) + world.headroom(x, z);
    if (!Number.isFinite(ceiling) || ceiling < box.top + .62) return { ok: false };
    // At least 'bearing' metres, including its inner edge, on BOTH banks.
    if ((u <= bearing + BRIDGE.sample || u >= length - bearing - BRIDGE.sample) && Math.abs(floor - box.y) > EPS) return { ok: false };
    spansGap ||= floor < box.y - .26;
  }
  return { ok: true, spansGap };
}

export function surfaceAt(items, x, z, floor) {
  for (const item of items || []) if (!item.away && item.deployed && !item.transition && item.collider?.on !== false && item.support?.ok && pointIn(item, x, z, .015)) floor = Math.max(floor, item.top);
  return floor;
}

/** Full swept volume, including the high point midway through a tip. Bodies
 * are checked too; raising a bridge cannot drop a visitor or a resident. */
export function canTip(world, item, { actor, bodies = true } = {}) {
  if (!item?.bridge || item.away || item.transition || typeof item.pose !== 'function') return { ok: false, reason: 'fixed' };
  const down = !item.deployed, target = item.pose(down ? Math.PI / 2 : 0);
  const support = bridgeSupport(world, item.pose(Math.PI / 2), item.bridge.axis, item.bridge.bearing);
  if (!support.ok) return { ok: false, reason: 'support' };
  // Retrieve it from its hinge bank. From the far bank, walk back first;
  // lifting there would leave the only movable on the inaccessible bank.
  // (A room that has a way on from both banks may say `eitherEnd` of a cutout:
  // then whoever has crossed may raise it behind them. It still stands up on
  // its hinge bank, which is then the other side of the gap from them.)
  if (actor && item.deployed && !item.bridge.eitherEnd) {
    const hinge = item.hinge, n = item.bridge.normal;
    if ((actor.x - hinge.x) * n.x + (actor.z - hinge.z) * n.z > -.12) return { ok: false, reason: 'hinge' };
  }
  const boxes = [];
  for (let i = 0; i <= 24; i++) {
    const b = item.pose(Math.PI / 2 * i / 24); boxes.push(b);
    // Sampled angular steps are padded for the arc between samples.
    const pad = .14, volume = { ...b, x0: b.x0 - pad, x1: b.x1 + pad, z0: b.z0 - pad, z1: b.z1 + pad };
    if (!world.free(b.x, b.z, 0, { bounds: volume, bottom: b.y, top: b.top + pad, ignoreCollider: item.collider, ghost: !bodies })) return { ok: false, reason: 'blocked' };
    const nx = Math.max(1, Math.ceil((volume.x1 - volume.x0) / .15)), nz = Math.max(1, Math.ceil((volume.z1 - volume.z0) / .15));
    for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
      const x = volume.x0 + (volume.x1 - volume.x0) * ix / nx, z = volume.z0 + (volume.z1 - volume.z0) * iz / nz;
      const floor = (world.terrainY || world.floorY)(x, z);
      const ceiling = world.ceilingY ? world.ceilingY(x, z) : world.floorY(x, z) + world.headroom(x, z);
      if (floor > b.y + EPS || ceiling < b.top + .05) return { ok: false, reason: 'clearance' };
    }
    for (const me of [actor, bodies && world.env?.player?.me]) {
      if (me && bodyOver(volume, { ...me, r: world.env?.player?.RADIUS || .22 })) return { ok: false, reason: 'occupied' };
    }
  }
  const sweep = { ...target, x0: Math.min(...boxes.map(b => b.x0)) - .14, x1: Math.max(...boxes.map(b => b.x1)) + .14,
    z0: Math.min(...boxes.map(b => b.z0)) - .14, z1: Math.max(...boxes.map(b => b.z1)) + .14, top: Math.max(...boxes.map(b => b.top)) + .14 };
  return { ok: true, down, target, support, sweep };
}
