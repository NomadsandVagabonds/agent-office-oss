// After Hours — office containment. Pure FPS rules shared with the renderer.
// x/z is the floor, y is feet height; yaw 0 looks north (-z), pitch > 0 looks down.
const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)));
const wall = (id, x0, z0, x1, z1, extra = {}) => ({ id, x0, z0, x1, z1, h: 3.1, kind: 'wall', ...extra });
export const PLAYER = Object.freeze({
  radius: .27, height: 1.8, eye: 1.55, speed: 3.25, runSpeed: 4.7,
  jumpSpeed: 5.8, gravity: 17, health: 100, damage: 20, immunity: .8,
  swingDuration: .46, swingImpact: .13, swingCooldown: .5, reach: 1.8,
});
export const LEVEL = Object.freeze({
  bounds: Object.freeze({ x0: -10, x1: 12, z0: -16, z1: 14 }),
  ceiling: 3.1,
  start: Object.freeze({ x: 0, z: 12, yaw: 0 }),
  rooms: freeze([
    { id: 'lobby', name: 'Security / Reception', x0: -5, x1: 5, z0: 8, z1: 14 },
    { id: 'bullpen', name: 'Operations', x0: -10, x1: 5, z0: -2, z1: 8 },
    { id: 'maintenance', name: 'Maintenance / Stores', x0: 5, x1: 12, z0: -9, z1: 8 },
    { id: 'servers', name: 'Server Control', x0: -10, x1: 5, z0: -16, z1: -2 },
  ]),
  walls: freeze([
    wall('lobby-south', -5, 13.9, 5, 14.1), wall('lobby-west', -5.1, 8, -4.9, 14),
    wall('lobby-east', 4.9, 8, 5.1, 14), wall('south-west', -10, 7.9, -5, 8.1),
    wall('stores-south', 5, 7.9, 12, 8.1), wall('west', -10.1, -16, -9.9, 8),
    wall('servers-north', -10, -16.1, 5, -15.9), wall('servers-east', 4.9, -16, 5.1, -9),
    wall('stores-north', 5, -9.1, 12, -8.9), wall('stores-east', 11.9, -9, 12.1, 8),
    wall('reception-west', -5, 7.9, -1.2, 8.1), wall('reception-east', 1.2, 7.9, 5, 8.1),
    wall('operations-stores-north', 4.9, -2, 5.1, 1.5), wall('operations-stores-south', 4.9, 3.7, 5.1, 8),
    wall('servers-stores-north', 4.9, -9, 5.1, -7.6), wall('servers-stores-south', 4.9, -5.4, 5.1, -2),
    wall('server-division-west', -10, -2.1, -1.2, -1.9), wall('server-division-east', 1.2, -2.1, 5, -1.9),
    wall('shortcut', -1.2, -2.1, 1.2, -1.9, { gate: true, kind: 'shutter' }),
  ]),
  obstacles: freeze([
    { id: 'reception-desk', kind: 'desk', x0: -4.35, x1: -1.9, z0: 9.2, z1: 10.2, h: .86 },
    { id: 'reception-chair', kind: 'chair', x0: -3.45, x1: -2.75, z0: 10.4, z1: 11.1, h: .9 },
    { id: 'reception-books', kind: 'bookshelf', x0: -4.7, x1: -2.05, z0: 13.2, z1: 13.75, h: 1.8 },
    { id: 'lobby-sofa', kind: 'sofa', x0: 2.35, x1: 4.35, z0: 10.5, z1: 11.4, h: .9 },
    { id: 'lobby-plant', kind: 'plant', x0: 3.8, x1: 4.55, z0: 12.4, z1: 13.2, h: 1.4 },
    { id: 'lobby-table', kind: 'cafetable', x0: 2.5, x1: 3.7, z0: 11.9, z1: 12.7, h: .5 },
    { id: 'desk-a', kind: 'desk', x0: -7.8, x1: -5.6, z0: 4.1, z1: 5.2, h: .86 },
    { id: 'desk-b', kind: 'desk', x0: -3.7, x1: -1.5, z0: 4.1, z1: 5.2, h: .86 },
    { id: 'desk-c', kind: 'desk', x0: -7.8, x1: -5.6, z0: .1, z1: 1.2, h: .86 },
    { id: 'desk-d', kind: 'desk', x0: -3.7, x1: -1.5, z0: .1, z1: 1.2, h: .86 },
    { id: 'desk-a-chair', kind: 'chair', x0: -7.05, x1: -6.35, z0: 3.2, z1: 3.9, h: .9 },
    { id: 'desk-b-chair', kind: 'chair', x0: -2.95, x1: -2.25, z0: 3.2, z1: 3.9, h: .9 },
    { id: 'desk-c-chair', kind: 'chair', x0: -7.05, x1: -6.35, z0: -.8, z1: -.1, h: .9 },
    { id: 'desk-d-chair', kind: 'chair', x0: -2.95, x1: -2.25, z0: -.8, z1: -.1, h: .9 },
    { id: 'partition-west', kind: 'partition', x0: -8.05, x1: -5.35, z0: 2.45, z1: 2.55, h: 1.25 },
    { id: 'partition-east', kind: 'partition', x0: -3.95, x1: -1.25, z0: 2.45, z1: 2.55, h: 1.25 },
    { id: 'breakroom-counter', kind: 'counter', x0: 10.7, x1: 11.7, z0: 2, z1: 6.7, h: 1.25 },
    { id: 'breakroom-fridge', kind: 'fridge', x0: 10.7, x1: 11.7, z0: 6.8, z1: 7.7, h: 1.8 },
    { id: 'breakroom-table', kind: 'cafetable', x0: 8.2, x1: 9.5, z0: 5.8, z1: 7.1, h: .8 },
    { id: 'breakroom-stool-west', kind: 'stool', x0: 7.45, x1: 8.05, z0: 6.15, z1: 6.75, h: .6 },
    { id: 'breakroom-stool-east', kind: 'stool', x0: 9.65, x1: 10.25, z0: 6.15, z1: 6.75, h: .6 },
    { id: 'shipping-crate', kind: 'crate', x0: 5.1, x1: 8.4, z0: -1.4, z1: -.55, h: .48 },
    { id: 'shipping-cabinet', kind: 'cabinet', x0: 8.4, x1: 11.9, z0: -1.4, z1: -.55, h: 1.8 },
    { id: 'spare-parts', kind: 'crate', x0: 8.2, x1: 9.6, z0: -4.4, z1: -3.5, h: .35 },
    { id: 'rack-west', kind: 'rack', x0: -9, x1: -7.6, z0: -9.5, z1: -5, h: 2.2 },
    { id: 'rack-middle', kind: 'rack', x0: -4, x1: -2.6, z0: -14, z1: -8, h: 2.2 },
    { id: 'rack-east', kind: 'rack', x0: .7, x1: 2, z0: -13.2, z1: -9.4, h: 2.2 },
    { id: 'power-cabinet', kind: 'panel', x0: -7.5, x1: -6.5, z0: -12.3, z1: -12.1, h: 1.75 },
  ]),
  interactables: freeze([
    { id: 'fuse', kind: 'fuse', x: 10, z: -6, label: 'take the power fuse' },
    { id: 'panel', kind: 'panel', x: -7, z: -12, label: 'restore server power' },
    { id: 'exit', kind: 'exit', x: 0, z: 12, label: 'return to the lift' },
    { id: 'med-operations', kind: 'medkit', x: -8, z: 5.8, label: 'use the first-aid kit' },
    { id: 'med-stores', kind: 'medkit', x: 9, z: -7.5, label: 'use the first-aid kit' },
  ]),
  spawns: freeze([
    { id: 'crab-1', room: 'bullpen', x: -6.7, z: 6.2 },
    { id: 'crab-2', room: 'bullpen', x: -6.6, z: -1.5 },
    { id: 'crab-3', room: 'bullpen', x: 2.4, z: .2 },
    { id: 'crab-4', room: 'maintenance', x: 9.7, z: 4.8 },
    { id: 'crab-5', room: 'maintenance', x: 6.9, z: -3.1 },
    { id: 'crab-6', room: 'maintenance', x: 10.8, z: -6.8 },
    { id: 'crab-7', room: 'servers', x: 2.4, z: -7 },
    { id: 'crab-8', room: 'servers', x: -5.8, z: -5.6 },
    { id: 'crab-9', room: 'servers', x: -6, z: -13.4 },
  ]),
});

const EPS = 1e-7, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const enemyRadius = .34, enemyHeight = .46;
const enemySpeed = 1.5, leapSpeedScale = 1.2;
const boxes = (state) => [...LEVEL.walls.filter((b) => !b.gate || !state.power), ...LEVEL.obstacles];
export const roomAt = (x, z) => LEVEL.rooms.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null;

/** Circle/AABB collision plus the actual nonrectangular office footprint. */
export function isFree(state, x, z, y = 0, radius = PLAYER.radius, height = PLAYER.height) {
  for (const [dx, dz] of [[-radius, -radius], [-radius, radius], [radius, -radius], [radius, radius]]) {
    if (!roomAt(x + dx, z + dz)) return false;
  }
  for (const b of boxes(state)) {
    if (y >= b.h - EPS || y + height <= 0) continue;
    const nx = clamp(x, b.x0, b.x1), nz = clamp(z, b.z0, b.z1);
    if (Math.hypot(x - nx, z - nz) < radius - EPS) return false;
  }
  return true;
}

function rayBox(from, to, b) {
  let low = 0, high = 1;
  for (const [a, d, min, max] of [[from.x, to.x - from.x, b.x0, b.x1], [from.y, to.y - from.y, 0, b.h], [from.z, to.z - from.z, b.z0, b.z1]]) {
    if (Math.abs(d) < EPS) { if (a < min || a > max) return false; }
    else {
      const t0 = (min - a) / d, t1 = (max - a) / d;
      low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
      if (low > high) return false;
    }
  }
  return low < 1 - EPS && high > EPS;
}
export function lineClear(state, from, to) { return !boxes(state).some((b) => rayBox(from, to, b)); }
const emit = (s, type, data = {}) => s.events.push({ type, ...data });
const freshEnemy = (p, i) => ({ ...p, x: p.x, y: 0, z: p.z, vx: 0, vy: 0, vz: 0,
  heading: 0, state: 'dormant', stateT: 0, health: 2, hasHit: false,
  cooldown: .15 + i % 3 * .25, path: [], pathClock: 0, targetX: p.x, targetZ: p.z });
export function createGame() {
  return { ...LEVEL.start, y: 0, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: true,
    health: PLAYER.health, hurtUntil: 0, time: 0, stage: 'playing', kills: 0, retries: 0,
    hasCrowbar: true, hasFuse: false, power: false, usedMedkits: [],
    swing: null, attackCooldown: 0, jumpHeld: false, interactHeld: false,
    enemies: LEVEL.spawns.map(freshEnemy), events: [],
    message: 'Find the spare fuse in Maintenance. Keep your crowbar close.',
    checkpoint: { ...LEVEL.start, hasFuse: false, power: false, deadIds: [], usedMedkits: [] },
  };
}

export function objective(s) {
  if (s.stage === 'dead') return 'Containment failed. R: retry from the last checkpoint.';
  if (s.stage === 'won') return 'Containment complete. Your overtime request was denied.';
  if (s.power) return 'Power restored. Take the open shortcut back to the lift.';
  if (!s.hasFuse) return 'Find the power fuse in Maintenance. Jump the shipping crates.';
  const left = s.enemies.filter((e) => e.room === 'servers' && e.state !== 'dead').length;
  return left ? `Reach Server Control and clear ${left} remaining headcrab${left === 1 ? '' : 's'}.` : 'Use the fuse at the Server Control panel.';
}

export function interactable(s) {
  if (s.stage !== 'playing') return null;
  const nearby = LEVEL.interactables.filter((p) => Math.hypot(s.x - p.x, s.z - p.z) < 1.55
    && lineClear(s, { x: s.x, y: s.y + .9, z: s.z }, { x: p.x, y: .9, z: p.z })
    && !(p.kind === 'fuse' && s.hasFuse) && !(p.kind === 'medkit' && s.usedMedkits.includes(p.id)))
    .sort((a, b) => Math.hypot(s.x - a.x, s.z - a.z) - Math.hypot(s.x - b.x, s.z - b.z));
  const near = nearby[0]; if (!near) return null;
  let label = near.label;
  if (near.kind === 'panel') label = !s.hasFuse ? 'power fuse required' : s.enemies.some((e) => e.room === 'servers' && e.state !== 'dead') ? 'clear the server room first' : s.power ? 'server power is online' : near.label;
  if (near.kind === 'exit' && !s.power) label = 'restore power before leaving';
  return { ...near, label };
}
function saveCheckpoint(s, point) {
  s.health = PLAYER.health; s.hurtUntil = s.time + 1.5;
  s.checkpoint = { ...point, hasFuse: s.hasFuse, power: s.power,
    deadIds: s.enemies.filter((e) => e.state === 'dead').map((e) => e.id), usedMedkits: [...s.usedMedkits] };
  emit(s, 'checkpoint', { x: point.x, z: point.z });
}
function interact(s) {
  const near = interactable(s); if (!near) return;
  if (near.kind === 'fuse') {
    s.hasFuse = true; s.message = 'Fuse recovered. Checkpoint saved; reach Server Control.';
    emit(s, 'pickup', { id: near.id, x: near.x, z: near.z }); saveCheckpoint(s, { x: 10, z: -6.1, yaw: Math.PI / 2 });
  } else if (near.kind === 'medkit') {
    if (s.health === PLAYER.health) { s.message = 'You are already fit for unnecessary overtime.'; return; }
    s.usedMedkits.push(near.id); s.health = Math.min(PLAYER.health, s.health + 45);
    emit(s, 'pickup', { id: near.id, value: 45, x: near.x, z: near.z }); s.message = 'First aid applied.';
  } else if (near.kind === 'panel') {
    if (!s.hasFuse || s.enemies.some((e) => e.room === 'servers' && e.state !== 'dead') || s.power) { s.message = near.label; return; }
    s.power = true; s.message = 'Power restored. The Operations shortcut is open.';
    emit(s, 'power'); saveCheckpoint(s, { x: -7, z: -11.5, yaw: Math.PI });
  } else if (near.kind === 'exit') {
    if (!s.power) { s.message = near.label; return; }
    s.stage = 'won'; s.finishedAt = s.time; s.vx = s.vz = 0; s.message = 'Containment complete. Clock out.'; emit(s, 'win');
  }
}

/** Retry restores the last earned mission checkpoint, not a live-enemy snapshot. */
export function respawn(previous) {
  const s = createGame(), cp = previous.checkpoint;
  Object.assign(s, { x: cp.x, z: cp.z, yaw: cp.yaw, hasFuse: cp.hasFuse, power: cp.power,
    usedMedkits: [...cp.usedMedkits], checkpoint: { ...cp, deadIds: [...cp.deadIds], usedMedkits: [...cp.usedMedkits] },
    retries: previous.retries + 1, time: previous.time, hurtUntil: previous.time + 1.5 });
  s.enemies = s.enemies.map((e) => cp.deadIds.includes(e.id) ? { ...e, state: 'dead', health: 0 } : e);
  s.kills = cp.deadIds.length; emit(s, 'respawn'); s.message = cp.hasFuse ? 'Checkpoint restored. The fuse is still yours.' : 'A fresh start. Watch for the crouch before a headcrab jumps.';
  return s;
}

function movePlayer(s, input, dt) {
  const f = clamp(Number(input.forward) || 0, -1, 1), r = clamp(Number(input.strafe) || 0, -1, 1);
  const norm = Math.max(1, Math.hypot(f, r)), speed = input.sprint ? PLAYER.runSpeed : PLAYER.speed;
  s.vx = (-Math.sin(s.yaw) * f + Math.cos(s.yaw) * r) * speed / norm;
  s.vz = (-Math.cos(s.yaw) * f - Math.sin(s.yaw) * r) * speed / norm;
  const x = s.x + s.vx * dt, z = s.z + s.vz * dt;
  if (isFree(s, x, s.z, s.y)) s.x = x;
  if (isFree(s, s.x, z, s.y)) s.z = z;
  const before = s.y; s.vy -= PLAYER.gravity * dt; let y = s.y + s.vy * dt, floor = 0;
  for (const b of boxes(s)) {
    if (s.x + PLAYER.radius > b.x0 && s.x - PLAYER.radius < b.x1 && s.z + PLAYER.radius > b.z0 && s.z - PLAYER.radius < b.z1
      && before >= b.h - EPS && y <= b.h) floor = Math.max(floor, b.h);
  }
  s.grounded = y <= floor && s.vy <= 0;
  if (s.grounded) { y = floor; s.vy = 0; }
  if (y + PLAYER.height > LEVEL.ceiling) { y = LEVEL.ceiling - PLAYER.height; s.vy = Math.min(0, s.vy); }
  s.y = Math.max(0, y);
}

function enemyFloor(s, e, before, next) {
  let floor = 0;
  for (const b of boxes(s)) {
    if (e.x + enemyRadius > b.x0 && e.x - enemyRadius < b.x1 && e.z + enemyRadius > b.z0 && e.z - enemyRadius < b.z1
      && before >= b.h - EPS && next <= b.h) floor = Math.max(floor, b.h);
  }
  return floor;
}

function strike(s) {
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), hits = [];
  for (const e of s.enemies) {
    if (e.state === 'dead') continue;
    const dx = e.x - s.x, dz = e.z - s.z, d = Math.hypot(dx, dz), dy = e.y + .26 - (s.y + 1.1);
    if (d > PLAYER.reach || Math.abs(dy) > 1.8) continue;
    if (d > .45 && (dx * fx + dz * fz) / d < .5) continue;
    if (d > .6 && Math.abs(Math.atan2(dy, d) + s.pitch) > 1.12) continue;
    if (!lineClear(s, { x: s.x, y: s.y + .85, z: s.z }, { x: e.x, y: e.y + .25, z: e.z })) continue;
    hits.push({ e, d });
  }
  hits.sort((a, b) => a.d - b.d);
  if (!hits.length) { emit(s, 'miss'); return; }
  const { e, d } = hits[0]; e.health = Math.max(0, e.health - 1);
  if (e.health === 0) {
    e.state = 'dead'; e.vx = e.vy = e.vz = 0; s.kills++;
  } else {
    // The first hit interrupts even an airborne attack and physically shoves
    // the crab away. This state cannot deal damage, including after landing.
    const dx = d > EPS ? (e.x - s.x) / d : fx, dz = d > EPS ? (e.z - s.z) / d : fz;
    e.state = 'knockback'; e.stateT = 0; e.hasHit = true;
    e.vx = dx * 4.4; e.vz = dz * 4.4; e.vy = 3.4;
    e.path = []; e.pathClock = 0; e.cooldown = .45;
  }
  emit(s, 'hit', { id: e.id, x: e.x, y: e.y + .25, z: e.z, health: e.health, killed: e.health === 0 });
}

// Small deterministic grid navigation routes stalking enemies around desks and racks.
function pathTo(s, enemy, tx, tz) {
  const stride = .5, x0 = LEVEL.bounds.x0 + .25, z0 = LEVEL.bounds.z0 + .25;
  const cols = 44, rows = 60, point = (i) => ({ x: x0 + (i % cols) * stride, z: z0 + Math.floor(i / cols) * stride });
  const nearest = (x, z) => {
    const cx = Math.round((x - x0) / stride), cz = Math.round((z - z0) / stride); let best = -1, dist = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const a = cx + dx, b = cz + dz; if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
      const i = b * cols + a, p = point(i), d = Math.hypot(p.x - x, p.z - z);
      if (d < dist && isFree(s, p.x, p.z, 0, enemyRadius, enemyHeight)) { best = i; dist = d; }
    }
    return best;
  };
  const start = nearest(enemy.x, enemy.z), end = nearest(tx, tz); if (start < 0 || end < 0) return [];
  const visited = new Int32Array(cols * rows).fill(-2), queue = [start]; visited[start] = -1;
  for (let at = 0; at < queue.length; at++) {
    const i = queue[at]; if (i === end) break;
    for (const j of [i - cols, i + cols, ...(i % cols ? [i - 1] : []), ...(i % cols < cols - 1 ? [i + 1] : [])]) {
      if (j < 0 || j >= visited.length || visited[j] !== -2) continue;
      const p = point(j); if (!isFree(s, p.x, p.z, 0, enemyRadius, enemyHeight)) continue;
      visited[j] = i; queue.push(j);
    }
  }
  if (visited[end] === -2) return [];
  const path = []; for (let i = end; i >= 0; i = visited[i]) path.push(point(i));
  path.reverse(); return path.slice(1);
}
function enemyStep(s, e, dt) {
  if (e.state === 'dead') return;
  e.cooldown = Math.max(0, e.cooldown - dt); e.stateT = Math.max(0, e.stateT - dt);
  const distance = Math.hypot(s.x - e.x, s.z - e.z);
  const visible = lineClear(s, { x: e.x, y: e.y + .3, z: e.z }, { x: s.x, y: s.y + 1, z: s.z });
  if (e.state === 'dormant') {
    if (distance < 7.5 && visible && roomAt(s.x, s.z)?.id !== 'lobby') e.state = 'stalk';
    else return;
  }
  if (e.state === 'windup') {
    if (e.stateT <= EPS) {
      e.state = 'leap'; e.vy = 6.4; e.hasHit = false;
      const dx = e.targetX - e.x, dz = e.targetZ - e.z, norm = Math.max(1, Math.hypot(dx, dz) / 3.6);
      e.vx = dx / .75 / norm * leapSpeedScale; e.vz = dz / .75 / norm * leapSpeedScale;
      emit(s, 'leap', { id: e.id, x: e.x, z: e.z });
    }
    return;
  }
  if (e.state === 'leap' || e.state === 'knockback') {
    const knockedBack = e.state === 'knockback';
    const before = e.y;
    e.vy -= 17 * dt; let y = Math.max(0, e.y + e.vy * dt);
    if (y + enemyHeight > LEVEL.ceiling) { y = LEVEL.ceiling - enemyHeight; e.vy = Math.min(0, e.vy); }
    const nx = e.x + e.vx * dt, nz = e.z + e.vz * dt;
    if (isFree(s, nx, nz, y, enemyRadius, enemyHeight)) { e.x = nx; e.z = nz; }
    else { e.vx = e.vz = 0; }
    const floor = enemyFloor(s, e, before, y); e.y = Math.max(floor, y);
    if (knockedBack) { const drag = Math.exp(-2.2 * dt); e.vx *= drag; e.vz *= drag; }
    if (!knockedBack && !e.hasHit && s.time >= s.hurtUntil && Math.hypot(s.x - e.x, s.z - e.z) < PLAYER.radius + .35
      && e.y + .4 > s.y + .05 && e.y < s.y + PLAYER.height
      && lineClear(s, { x: e.x, y: e.y + .3, z: e.z }, { x: s.x, y: s.y + .8, z: s.z })) {
      e.hasHit = true; s.health = Math.max(0, s.health - PLAYER.damage); s.hurtUntil = s.time + PLAYER.immunity;
      emit(s, 'hurt', { id: e.id, value: PLAYER.damage, x: e.x, z: e.z });
      if (!s.health) { s.stage = 'dead'; emit(s, 'dead'); return; }
    }
    if (e.y <= floor + EPS && e.vy < 0) { e.state = 'recover'; e.stateT = knockedBack ? .35 : .85; e.vx = e.vy = e.vz = 0; }
    return;
  }
  if (e.state === 'recover') { if (e.stateT <= EPS) { e.state = 'stalk'; e.cooldown = .25; } return; }
  if (distance < 3.2 && visible && e.cooldown <= 0) {
    e.state = 'windup'; e.stateT = .65; e.targetX = s.x; e.targetZ = s.z;
    e.heading = Math.atan2(s.x - e.x, s.z - e.z); emit(s, 'windup', { id: e.id, x: e.x, z: e.z }); return;
  }
  e.pathClock -= dt;
  if (e.pathClock <= 0) { e.path = pathTo(s, e, s.x, s.z); e.pathClock = .8; }
  while (e.path.length && Math.hypot(e.path[0].x - e.x, e.path[0].z - e.z) < .15) e.path.shift();
  let target = e.path[0];
  if (!target && visible) target = { x: s.x, z: s.z };
  if (!target) return;
  const dx = target.x - e.x, dz = target.z - e.z, length = Math.hypot(dx, dz); if (length < .05) return;
  const speed = Math.min(length / dt, enemySpeed), vx = dx / length * speed * dt, vz = dz / length * speed * dt;
  if (isFree(s, e.x + vx, e.z, e.y, enemyRadius, enemyHeight)) e.x += vx;
  if (isFree(s, e.x, e.z + vz, e.y, enemyRadius, enemyHeight)) e.z += vz;
  if (e.y > 0) {
    const before = e.y; e.vy -= 17 * dt; const next = Math.max(0, e.y + e.vy * dt), floor = enemyFloor(s, e, before, next);
    e.y = Math.max(floor, next); if (e.y <= floor + EPS) e.vy = 0;
  }
  e.heading = Math.atan2(dx, dz);
}

/** A suspended window cannot advance more than 100 ms; callers pause by skipping step. */
export function step(previous, input = {}, dt = 0) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('FPS dt must be finite and non-negative.');
  if (previous.stage !== 'playing') return previous;
  const s = { ...previous, swing: previous.swing ? { ...previous.swing } : null,
    enemies: previous.enemies.map((e) => ({ ...e, path: e.path.map((p) => ({ ...p })) })), usedMedkits: [...previous.usedMedkits], events: [] };
  if (Number.isFinite(input.yaw)) s.yaw = input.yaw;
  if (Number.isFinite(input.pitch)) s.pitch = clamp(input.pitch, -1.25, 1.25);
  if (input.jump && !previous.jumpHeld && s.grounded) { s.vy = PLAYER.jumpSpeed; s.grounded = false; }
  s.jumpHeld = !!input.jump;
  if (input.interact && !previous.interactHeld) interact(s);
  s.interactHeld = !!input.interact;
  if (s.stage === 'won') return s;
  let left = Math.min(dt, .1);
  while (left > EPS && s.stage === 'playing') {
    const tick = Math.min(left, 1 / 120); left -= tick; s.time += tick;
    s.attackCooldown = Math.max(0, s.attackCooldown - tick);
    if (input.attack && !s.swing && s.attackCooldown <= 0) { s.swing = { age: 0, hit: false }; s.attackCooldown = PLAYER.swingCooldown; emit(s, 'swing'); }
    movePlayer(s, input, tick);
    if (s.swing) {
      s.swing.age += tick;
      if (!s.swing.hit && s.swing.age >= PLAYER.swingImpact) { s.swing.hit = true; strike(s); }
      if (s.swing.age >= PLAYER.swingDuration) s.swing = null;
    }
    for (const e of s.enemies) { enemyStep(s, e, tick); if (s.stage !== 'playing') break; }
  }
  return s;
}
