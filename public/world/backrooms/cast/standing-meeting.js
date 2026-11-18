// The Backrooms — the standing meeting. Nine of them under one back, nose to
// tail, on eighteen short legs in suit trousers and office shoes: nearer a
// centipede than anything that ever sat round a table. It goes about in file.
// When somebody is in front of it, it stops, drums, and comes straight, faster
// than anybody runs, and cannot turn (standing-meeting.rule.js) — and only
// ever corner to corner of the building, like a bishop: get off its diagonal,
// and it goes past and into the wall.
//
// Voxels (standing-meeting.model.js), posed every frame. Each length of it
// follows where the one in front has been, and each foot is put down on the
// floor and its knee worked out from there.
import * as THREE from 'three';
import { roomDistances } from '../gen.js';
import { Batch, lamp } from '../kit.js';
import { MEETING, filing, meets, ahead, lengths, takes } from './standing-meeting.rule.js';
import { SHOVE, slide } from '../shove.rule.js';
import { HEALTH } from './health.rule.js';
import { fitsDoor, canLeave } from './paths.js';
import { elbow } from './head-count.rule.js';
import { S, SF, THIGH, SHIN, backVox, bellyVox, fingersVox, thighVox, shinVox, tieVox } from './standing-meeting.model.js';

const TH = THIGH * S, SH = SHIN * S, SHOE = 0.1;
const REARS = 5;          // how many lengths of it, from the front, it stands up on end

export function create(c) {
  const env = c.env, level = c.level, M = MEETING;
  const walker = { x: 0, z: 0, r: M.r, tall: M.tall, opens: false };
  let s = filing(), group = null, mat = null, backs = [], legs = [], hung = [], trail = [], at = [];
  let dying = null, hit = null, clock = 0, yaw = 0, high = 0.56, goal = null, goalT = 0, known = false, over = false, shake = 0, drag = null, rear = 0;
  const vx = new THREE.Vector3(), vy = new THREE.Vector3(), vz = new THREE.Vector3(), basis = new THREE.Matrix4();

  const LIGHTS = [lamp(0.6, 3.2, 1.4, [1.1, 1.05, 1.0], { k: 9, wrap: 0.45, far: 40 })];
  const geo = (key, make, k = S) => { const b = new Batch(true); b.addVox(env.kit.model(key, make).solid, new THREE.Matrix4().makeScale(k, k, k)); return env.kit.geometry(b, LIGHTS, [0.4, 0.38, 0.38]); };
  const part = (g) => { const k = new THREE.Mesh(g, mat); group.add(k); return k; };
  /** Turn a length of limb (made along +y) to run along `dy`, with its front (+z) as near `fz` as that allows. */
  const aim = (mesh, dx, dy, dz, fx, fz, len, made) => {
    vy.set(dx, dy, dz).normalize(); vz.set(fx, 0, fz); vx.crossVectors(vy, vz);
    if (vx.lengthSq() < 1e-6) vx.set(1, 0, 0); vx.normalize(); vz.crossVectors(vx, vy).normalize();
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(vx, vy, vz)); mesh.scale.set(1, len / made, 1);
  };

  function startRoom() {
    const dist = roomDistances(level, level.start.room), fits = (r) => !r.crawl && r.H >= 1.4 && r.kind !== 'start' && r.kind !== 'exit' && (dist.get(r.id) ?? 0) >= 2 && canLeave(r, walker.tall);
    const long = level.rooms.filter((r) => fits(r) && r.kind === 'plain' && Math.max(r.W, r.D) >= 6 && (dist.get(r.id) ?? 0) >= 3), plain = level.rooms.filter((r) => fits(r) && r.kind === 'plain'), far = level.rooms.filter(fits);
    const pool = long.length ? long : plain.length ? plain : far.length ? far : level.rooms.filter((r) => r.kind !== 'start');
    const pick = pool.length ? c.R.pick(pool) : level.rooms[0];
    if (c.haunt != null && level.rooms[c.haunt] && fits(level.rooms[c.haunt])) { const sp = c.walk.spotIn(walker, c.haunt); if (c.walk.stand(walker, sp.x, sp.z)) return c.haunt; }
    return pick.id;
  }

  function ready() {
    const spot = c.walk.spotIn(walker, startRoom());
    walker.x = spot.x; walker.z = spot.z; yaw = c.R.range(0, Math.PI * 2);
    trail = [{ x: walker.x, z: walker.z }, { x: walker.x - Math.sin(yaw) * 0.01, z: walker.z - Math.cos(yaw) * 0.01 }];
    mat = env.kit.surface({ vox: true, wet: 0.6 });
    group = new THREE.Group();
    const back = [0, 1, 2, 3, 4].map((k) => geo('meeting:hips:' + k, () => backVox(k))), belly = [0, 1, 2].map((k) => geo('meeting:belly:' + k, () => bellyVox(k))), fingers = [0, 1, 2].map((k) => geo('meeting:fingers2:' + k, () => fingersVox(k), SF));
    const thigh = [0, 1, 2, 3].map((k) => geo('meeting:thigh2:' + k, () => thighVox(k))), shin = [0, 1, 2, 3].map((k) => geo('meeting:shin2:' + k, () => shinVox(k))), tie = [0, 1, 2, 3].map((k) => geo('meeting:tie:' + k, () => tieVox(k)));
    for (let i = 0; i < M.parts; i++) {
      // (each length is held together in one frame: its hips, what is under them, and the fingers down either side of that)
      const g = new THREE.Group(); group.add(g);
      const m = new THREE.Mesh(back[(i * 2 + 1) % 5], mat); m.rotation.y = i % 2 ? Math.PI : 0; g.add(m);
      g.add(new THREE.Mesh(belly[i % 3], mat));
      const rows = [-1, 1].map((side) => { const f = new THREE.Mesh(fingers[(i + (side > 0 ? 1 : 0)) % 3], mat); f.position.set(side * 0.13, -0.29, 0); f.rotation.y = side > 0 ? 0 : Math.PI; g.add(f); return { f, side }; });
      backs.push({ m: g, rows, roll: 0 });
      // a pair of legs to every pair of hips, out to the sides; and off each end of it, two more, because it has no end
      const pairs = [[-1, 0], [1, 0]]; if (i === 0) pairs.push([-1, 1.05], [1, 1.05]); if (i === M.parts - 1) pairs.push([-1, -1.05], [1, -1.05]);
      for (const [side, fan] of pairs) legs.push({ i, side, fan, thigh: part(thigh[(i + (side > 0 ? 1 : 0)) % 4]), shin: part(shin[(i + (side > 0 ? 1 : 0)) % 4]), x: 0, z: 0, fx: 0, fz: 0, tx: 0, tz: 0, k: 1, lift: 0, placed: false });
    }
    // ties, still on, hanging from under it
    for (const i of [1, 3, 4, 6, 7]) hung.push({ i, m: part(tie[i % 4]), swing: 0, v: 0 });
    c.add(group);
    c.body({ get x() { return walker.x; }, get z() { return walker.z; }, r: M.r });
    pose(0, false);
  }

  /** Stand it where it is: every length of its back along the way it has come, and every leg from its shoe to its hip. */
  function pose(dt, moving) {
    // (dying: down for good — flat, its legs going, and then still, a length at a time from the front: dies())
    const charging = s.mode === 'charges' && dying === null, drumming = s.mode === 'drums' && dying === null, down = s.mode === 'down' || dying !== null;
    const want = dying !== null ? 0.09 : down ? 0.2 : charging ? 0.46 : 0.56;
    // seeing somebody, it stands the front of itself up on end, and shows them what is underneath; and comes down going
    rear += ((drumming ? 1 : 0) - rear) * Math.min(1, dt * (drumming ? 5 : 9));
    high += (want - high) * Math.min(1, dt * (down ? 9 : 5));
    shake = Math.max(0, shake - dt);
    at = lengths(trail, M.parts, M.gap);
    at.forEach((p, i) => {
      const b = backs[i], floor = env.world.floorY(p.x, p.z);
      const still = dying === null ? 0 : Math.max(0, Math.min(1, (dying - 0.12 - 0.55 * i / at.length) / 0.2)); b.still = still;
      // a wave goes down the length of it as it walks; drumming, every length of it trembles; down, it lies as it fell
      const wave = (moving ? Math.sin(clock * (charging ? 26 : 9) - i * 0.9) * (charging ? 0.03 : 0.022) : Math.sin(clock * 1.6 - i * 0.7) * 0.012) * (1 - still);
      const jit = ((drumming ? 0.012 : 0) + shake * 0.03) * (1 - still);
      b.roll += ((down ? (i % 2 ? 0.5 + 0.8 * still : -0.4 - 0.8 * still) : Math.sin(clock * 2.2 - i * 0.8) * 0.07) - b.roll) * Math.min(1, dt * 6);
      p.y = floor + high + wave + (hit ? hit.e * 0.1 * Math.max(0, Math.sin(i * 0.8 - hit.t * 26)) : 0); p.pitch = 0; p.jit = jit;
    });
    if (rear > 0.01 && at.length > REARS) {
      // (stood up, it faces whoever it has seen, whichever way the rest of it happens to be lying)
      const base = at[REARS], face = base.yaw + Math.atan2(Math.sin(yaw - base.yaw), Math.cos(yaw - base.yaw)) * Math.min(1, rear * 1.5), fx = Math.sin(face), fz = Math.cos(face);
      for (let i = REARS - 1; i >= 0; i--) {
        const prev = at[i + 1], a = rear * (Math.PI / 2) * Math.min(1, (REARS - i) / 1.6) * (1 + Math.sin(clock * 2.1 + i) * 0.05), p = at[i];
        p.x = prev.x + fx * Math.cos(a) * M.gap; p.z = prev.z + fz * Math.cos(a) * M.gap; p.y = prev.y + Math.sin(a) * M.gap; p.yaw = face; p.pitch = a;
      }
    }
    at.forEach((p, i) => {
      const b = backs[i];
      b.m.position.set(p.x + (Math.random() - 0.5) * p.jit, p.y, p.z + (Math.random() - 0.5) * p.jit);
      b.m.rotation.set(-p.pitch, p.yaw, p.pitch > 0.2 ? 0 : b.roll, 'YXZ');
      b.m.scale.set(1, 1 + Math.sin(clock * 2.6 - i) * 0.04, 1.3);
      // the fingers either side of the seam are never still; shown, they open out and work
      const live = 1 - (b.still || 0);
      for (const r of b.rows) { r.f.rotation.z = (r.side > 0 ? -1 : 1) * (0.25 * Math.min(1, p.pitch) + Math.sin(clock * (5 + (i % 3)) + i * 1.7 + r.side) * (0.1 + 0.22 * Math.min(1, p.pitch)) * live + 0.5 * (1 - live)); r.f.rotation.x = Math.sin(clock * 3.3 + i + r.side * 2) * 0.12 * live; }
    });
    // its legs: each foot is put down where its hip is going, and the back ones never wait for the front ones
    const stride = charging ? 0.5 : 0.26, quick = charging ? 0.05 : 0.14, most = charging ? 14 : 7;
    let stepping = legs.filter((l) => l.k < 1).length;
    // (a thigh goes straight out from the hip, sideways — or, off the ends of it, out along the way it lies — and the knee is the wrong way up)
    const rest = (l) => { const p = at[l.i], out = l.fan ? p.yaw + (l.fan > 0 ? 0 : Math.PI) + l.side * 0.55 : p.yaw + l.side * Math.PI / 2, sx = Math.sin(out), sz = Math.cos(out), px = Math.cos(p.yaw) * l.side, pz = -Math.sin(p.yaw) * l.side, lead = moving ? (charging ? 0.3 : 0.12) : 0, far = down ? 1.0 - 0.55 * (backs[l.i].still || 0) : 0.66; return { hx: p.x + px * 0.2 + (l.fan ? sx * 0.12 : 0), hz: p.z + pz * 0.2 + (l.fan ? sz * 0.12 : 0), x: p.x + px * 0.2 + sx * far + Math.sin(p.yaw) * lead, z: p.z + pz * 0.2 + sz * far + Math.cos(p.yaw) * lead, sx, sz }; };
    const due = legs.map((l, n) => { if (!l.placed || l.k < 1) return [0, n]; const r = rest(l); return [Math.hypot(r.x - l.x, r.z - l.z), n]; }).filter(([d]) => d > stride).sort((a, b) => b[0] - a[0]).slice(0, Math.max(0, most - stepping));
    const turn = new Set(due.map(([, n]) => n));
    legs.forEach((l, n) => {
      const p = at[l.i], r = rest(l);
      if (p.pitch > 0.25) {
        // off the floor: the legs of what is stood up go out to the sides and forward, and work in the air
        const px = Math.cos(p.yaw) * l.side, pz = -Math.sin(p.yaw) * l.side, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), w = Math.sin(clock * 6 + n * 1.3);
        const hip = { x: p.x + px * 0.2, y: p.y, z: p.z + pz * 0.2 }, ankle = { x: hip.x + px * (0.62 + w * 0.06) + fx * (0.38 + w * 0.1), y: hip.y + 0.05 + Math.cos(clock * 5 + n) * 0.12, z: hip.z + pz * (0.62 + w * 0.06) + fz * (0.38 + w * 0.1) };
        const e = elbow(hip, ankle, TH, SH, { x: px * 2.4, z: pz * 2.4 });
        l.thigh.position.set(hip.x, hip.y, hip.z); aim(l.thigh, e.x - hip.x, e.y - hip.y, e.z - hip.z, fx, fz, Math.hypot(e.x - hip.x, e.y - hip.y, e.z - hip.z), TH);
        l.shin.position.set(e.x, e.y, e.z); aim(l.shin, ankle.x - e.x, ankle.y - e.y, ankle.z - e.z, fx, fz, Math.hypot(ankle.x - e.x, ankle.y - e.y, ankle.z - e.z), SH);
        l.placed = false; l.k = 1; return;
      }
      if (!l.placed || Math.hypot(r.x - l.x, r.z - l.z) > 0.9) { l.x = r.x; l.z = r.z; l.k = 1; l.placed = true; }
      if (l.k >= 1 && turn.has(n)) { l.fx = l.x; l.fz = l.z; l.tx = r.x; l.tz = r.z; l.k = 0; }
      if (l.k < 1) {
        l.k = Math.min(1, l.k + dt / quick); l.x = l.fx + (l.tx - l.fx) * l.k; l.z = l.fz + (l.tz - l.fz) * l.k; l.lift = Math.sin(l.k * Math.PI) * (charging ? 0.1 : 0.16);
        if (l.k >= 1) { l.lift = 0; if (charging ? n % 3 === 0 : n % 2 === 0) c.play(charging ? 'thunk' : 'step', l.x, l.z, charging ? 18 : 8); }
      }
      // drumming: every foot of it, on the spot, out of time with the next. Down: they are in the air, and going
      const drum = drumming ? Math.abs(Math.sin(clock * 34 + n * 1.9)) * 0.06 : down ? (0.25 + Math.abs(Math.sin(clock * 17 + n * 2.3)) * 0.3) * (1 - 0.6 * (backs[l.i].still || 0)) : 0;
      const fy = env.world.floorY(l.x, l.z) + l.lift + drum, hip = { x: r.hx, y: p.y - 0.05, z: r.hz }, ankle = { x: l.x, y: fy + SHOE, z: l.z };
      const e = elbow(hip, ankle, TH, SH, { x: r.sx * 2.4, z: r.sz * 2.4 });
      const fwx = r.sx, fwz = r.sz;          // (the shoes point the way the legs go: out)
      l.thigh.position.set(hip.x, hip.y, hip.z); aim(l.thigh, e.x - hip.x, e.y - hip.y, e.z - hip.z, fwx, fwz, Math.hypot(e.x - hip.x, e.y - hip.y, e.z - hip.z), TH);
      l.shin.position.set(e.x, e.y, e.z); aim(l.shin, ankle.x - e.x, ankle.y - e.y, ankle.z - e.z, fwx, fwz, Math.hypot(ankle.x - e.x, ankle.y - e.y, ankle.z - e.z), SH);
    });
    for (const h of hung) {
      const p = at[h.i];
      h.v += (-h.swing * 20 - h.v * 2 + (moving ? Math.sin(clock * (charging ? 30 : 10) + h.i) * (charging ? 14 : 5) : 0)) * dt; h.swing += h.v * dt;
      h.m.position.set(p.x + Math.cos(p.yaw) * 0.27 * (h.i % 2 ? 1 : -1), p.y + 0.03, p.z - Math.sin(p.yaw) * 0.27 * (h.i % 2 ? 1 : -1)); h.m.rotation.set(Math.PI + h.swing * 0.5, p.yaw + Math.PI / 2, h.swing * 0.4, 'YXZ'); h.m.scale.setScalar(0.75);
    }
  }

  /** Somewhere to go on to, in file: the middle of a room next to the one it is in. */
  function wander() {
    const here = level.rooms[c.room(walker.x, walker.z) ?? -1], ways = (here?.doors || []).filter((d) => fitsDoor(d, walker.tall)).map((d) => level.rooms[d.to]).filter((r) => r && !r.crawl && r.H >= 1.4 && r.kind !== 'start');
    const to = ways.length ? ways[Math.floor(Math.random() * ways.length)] : here;
    if (!to) return null;
    const sp = c.walk.spotIn(walker, to.id); return { x: sp.x + (Math.random() - 0.5) * 2, z: sp.z + (Math.random() - 0.5) * 2 };
  }
  /** It has no front: what was the last of it is the first, and it goes the other way without turning round. */
  function about() {
    if (!at.length) return;
    const pts = at.slice().reverse().map((p) => ({ x: p.x, z: p.z })), end = pts[0];
    if (!c.walk.stand(walker, end.x, end.z)) return;
    const dense = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 8; k++) dense.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * (k / 8), z: pts[i].z + (pts[i + 1].z - pts[i].z) * (k / 8) });
    dense.push(pts[pts.length - 1]); trail = dense; walker.x = end.x; walker.z = end.z;
    yaw = Math.atan2(pts[0].x - pts[1].x, pts[0].z - pts[1].z); goal = null;
    legs.forEach((l) => { l.i = M.parts - 1 - l.i; l.side = -l.side; l.fan = -l.fan; });
    backs.reverse();
  }
  /** The diagonal it would take from a spot for somebody: one it has floor to start along (standing-meeting.rule.js takes()). */
  const lineFor = (p, m) => {
    const d = Math.hypot(m.x - p.x, m.z - p.z); if (d < 0.3) return null;
    return takes({ x: (m.x - p.x) / d, z: (m.z - p.z) / d }, (dir) => c.walk.clear(walker, p.x, p.z, p.x + dir.x * 1.2, p.z + dir.z * 1.2));
  };
  const moved = (x, z) => { if (Math.hypot(x - trail[0].x, z - trail[0].z) > 0.04) { trail.unshift({ x, z }); if (trail.length > 140) trail.length = 140; } };

  return {
    ready,
    /**
     * Its dying (cast/health.rule.js; the conductor calls this and nothing else of it). It goes down flat with every leg
     * in the air and going, and then it goes still a length at a time, from the front to the back: each length rolls
     * over onto its side, its fingers open and stop, its legs fold in. Its clock of dying only, slowing as it goes.
     */
    /**
     * A jab that did not finish it (the conductor, while it stands stalled after one: hurt, seconds since it). A hump runs
     * back down the length of it from the front, as from a blow. After a shove (hurt large, or none) it holds.
     */
    flinch(hurt, dt = 0) {
      if (!group || hurt == null || !(hurt < HEALTH.flinch)) return;
      hit = { e: Math.exp(-hurt * 3) * (1 - hurt / HEALTH.flinch), t: hurt };
      clock += dt; pose(dt, false); hit = null;
    },
    dies(progress, dt = 0) {
      if (!group) return;
      dying = Math.max(0, Math.min(1, progress));
      clock += dt * (1 - 0.8 * dying);
      pose(dt, false);
    },
    update(dt) {
      if (!group || over) return;
      clock += dt; dt = Math.min(dt, 0.08);
      const m = c.me(), d = Math.hypot(m.x - walker.x, m.z - walker.z);
      const fire = c.fire(walker.x, walker.z), nearFire = !!fire && Math.hypot(fire.x - walker.x, fire.z - walker.z) < M.fire;
      if (!known && d < 12 && c.los(walker.x, walker.z, m.x, m.z) && !c.hidden(walker.x, walker.z, 0.6)) { known = true; c.met(); }
      // it sees from either end of itself: if it is the other end that has seen somebody, that end is the front now
      const tail = at[at.length - 1];
      if (s.mode === 'files' && tail && !(ahead(walker, yaw, m) && c.los(walker.x, walker.z, m.x, m.z)) && ahead(tail, tail.yaw + Math.PI, m) && c.los(tail.x, tail.z, m.x, m.z)) about();
      const d2 = Math.hypot(m.x - walker.x, m.z - walker.z);
      const seen = d2 > 0.3 && ahead(walker, yaw, m) && c.los(walker.x, walker.z, m.x, m.z), to = seen ? lineFor(walker, m) : null;
      // down, it is finding them again, with whichever end of it is nearer: getting up, that end is the front, and takes the line
      let again = null, turns = false;
      if (s.mode === 'down') {
        const ends = [[walker, false], [tail, true]].filter(([p]) => p && Math.hypot(m.x - p.x, m.z - p.z) <= M.sees && c.los(p.x, p.z, m.x, m.z))
          .sort((a, b) => Math.hypot(m.x - a[0].x, m.z - a[0].z) - Math.hypot(m.x - b[0].x, m.z - b[0].z));
        for (const [p, isTail] of ends) { const line = lineFor(p, m); if (line) { again = line; turns = isTail; break; } }
      }
      // charging: straight on, as far as there is floor to go straight on over
      let went = 0, blocked = false, touched = false, was = { x: walker.x, z: walker.z };
      if (s.mode === 'charges' && s.dir) {
        let left = M.charge * (c.speedScale ?? 1) * dt;
        while (left > 1e-4) {
          const step = Math.min(0.12, left), nx = walker.x + s.dir.x * step, nz = walker.z + s.dir.z * step;
          if (!c.walk.clear(walker, walker.x, walker.z, nx, nz)) { blocked = true; break; }
          walker.x = nx; walker.z = nz; went += step; left -= step; moved(nx, nz);
        }
        touched = at.slice(0, 6).some((p) => Math.hypot(p.x - m.x, p.z - m.z) < M.wide) || Math.hypot(walker.x - m.x, walker.z - m.z) < M.wide + 0.1;
      }
      const before = s.mode;
      s = meets(s, { dt, seen, to, went, blocked, touched, fire: nearFire, again });
      // up again: and off the way it came, which is as good a way as the other — or, with somebody to go for, whichever end found them leads
      if (before === 'down' && (s.mode === 'files' || (s.mode === 'drums' && turns))) about();
      if (s.drums) { c.play('creak', walker.x, walker.z, 18); c.play('rattle', walker.x, walker.z, 18); env.interfere?.(0.3); }
      if (s.goes) { c.play('whir', walker.x, walker.z, 18); }
      if (s.struck) { c.play('crack', walker.x, walker.z, 20); c.play('thunk', walker.x, walker.z, 20); env.interfere?.(0.5); shake = 0.8; }
      if (s.took) {
        const hit = c.hurt(M.hurts);
        if (hit.ended) { over = true; return; }
        if (hit.landed) { env.hud?.glitch?.(0.9); env.interfere?.(1); c.play('thunk', m.x, m.z, 16); c.survived(); }
      }
      if (s.mode === 'drums' && s.dir) { const want = Math.atan2(s.dir.x, s.dir.z), da = Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)); yaw += da * Math.min(1, dt * 6); }
      if (s.mode === 'charges' && s.dir) yaw = Math.atan2(s.dir.x, s.dir.z);
      if (s.mode === 'files') {
        goalT -= dt;
        if (!goal || goalT <= 0 || Math.hypot(goal.x - walker.x, goal.z - walker.z) < 0.9) { goal = wander(); goalT = 16 + Math.random() * 10; }
        const dest = nearFire ? { x: walker.x * 2 - fire.x, z: walker.z * 2 - fire.z } : goal;
        if (dest) { const got = c.walk.go(walker, dest, M.files * (c.speedScale ?? 1) * dt, 0.2); if (got && got.went < 1e-4) goalT = Math.min(goalT, 1.5); }
        const mx = walker.x - was.x, mz = walker.z - was.z;
        if (Math.hypot(mx, mz) > 1e-4) { const da = Math.atan2(Math.sin(Math.atan2(mx, mz) - yaw), Math.cos(Math.atan2(mx, mz) - yaw)); yaw += da * Math.min(1, dt * 3); moved(walker.x, walker.z); }
      }
      group.visible = c.drawn(walker) || at.some((p) => c.drawn(p));
      const L = c.light(walker.x, walker.z, 1.0); mat.uniforms.uTint.value.set(L[0] * 1.5 + 0.05, L[1] * 1.5 + 0.05, L[2] * 1.5 + 0.05);
      pose(dt, Math.hypot(walker.x - was.x, walker.z - was.z) > 1e-4);
    },
    /** The building's camera: it stands up over the visitor's character, shows it what is underneath, and comes down on it. */
    takes(shot) {
      over = true;
      const fig = shot.figure, d0 = Math.hypot(shot.x - walker.x, shot.z - walker.z) || 1, dir = { x: (shot.x - walker.x) / d0, z: (shot.z - walker.z) / d0 };
      yaw = Math.atan2(dir.x, dir.z); s = { ...s, mode: 'drums', dir };
      const go = (dist) => { const nx = walker.x + dir.x * dist, nz = walker.z + dir.z * dist; if (c.walk.clear(walker, walker.x, walker.z, nx, nz)) { walker.x = nx; walker.z = nz; moved(nx, nz); return true; } return false; };
      let fell = false;
      return (t, dt) => {
        clock += dt;
        const gap = Math.hypot(shot.x - walker.x, shot.z - walker.z);
        if (t < 1.5) { if (gap > 1.5) go(Math.min(gap - 1.5, 2.2 * dt)); }
        else { if (s.mode !== 'charges') { s = { ...s, mode: 'charges' }; c.play('thunk', shot.x, shot.z, 18); c.play('squish', shot.x, shot.z, 14); } if (!fell && !go(Math.min(4 * dt, 1.9 - (t - 1.5) * 2))) fell = true; if (t > 2) fell = true; }
        pose(dt, t < 1.5 ? gap > 1.5 : !fell);
        if (fig) { const k = Math.max(0, Math.min(1, (t - 1.5) / 0.2)); fig.rotation.x = -1.5 * k; fig.position.y = shot.y - 0.05 * k; fig.rotation.z = t < 1.5 ? Math.sin(t * 21) * 0.05 : 0; }
      };
    },
    /** …filmed from the side, low: the whole length of it going over them. */
    films(shot) {
      const dir = s.dir || { x: Math.sin(yaw), z: Math.cos(yaw) }, cx = shot.x + dir.x * 1.2, cz = shot.z + dir.z * 1.2;
      for (const far of [4.6, 3.4, 2.4]) for (const side of [1, -1]) {
        const x = cx + dir.z * side * far, z = cz - dir.x * side * far;
        if (c.room(x, z) !== null && c.room(x, z) === c.room(shot.x, shot.z) && c.los(x, z, shot.x, shot.z)) return { x, y: shot.y + 1.2, z, at: { x: cx, y: shot.y + 0.35, z: cz } };
      }
      return null;
    },
    /** A shove (shove.rule.js): too heavy to turn aside, but it gives: half a step back, and a shorter moment stood. Whatever it was doing it goes on doing. */
    shoveTargets() {
      if (!group || over) return [];
      return [{ id: 'standing-meeting', x: walker.x, z: walker.z, y: env.world.floorY(walker.x, walker.z) + 0.5, r: 0.5, shove: (dir) => {
        const to = slide(walker, dir, (x0, z0, x1, z1) => c.walk.clear(walker, x0, z0, x1, z1), SHOVE.heavy.push);
        if (to) { walker.x = to.x; walker.z = to.z; }
        shake = 0.6; c.stall(SHOVE.heavy.stagger); c.play('thunk', walker.x, walker.z, 14); c.play('creak', walker.x, walker.z, 12);
        return true;
      } }];
    },
    /** A jab (melee.js): it takes one (cast/health.rule.js). Not finished by it, it flinches: it stands a moment and lands nothing. */
    snipTargets() {
      if (!group || over) return [];
      return [{ id: 'standing-meeting', x: walker.x, z: walker.z, y: env.world.floorY(walker.x, walker.z) + 0.5, r: 0.5, priority: 2, snip: () => {
        const hit = c.struck(HEALTH.jab); if (!hit.ok) return false;
        if (!known) { known = true; c.met(); }
        if (!hit.killed) c.stall(HEALTH.flinch); shake = 0.6;
        c.play('thunk', walker.x, walker.z, 12); c.survived();
        return { ok: true, target: 'standing-meeting' };
      } }];
    },
    at: () => ({ x: walker.x, z: walker.z, mode: s.mode, yaw }),
    dispose() { group?.removeFromParent(); group = null; },
  };
}
