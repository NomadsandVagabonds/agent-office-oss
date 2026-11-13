// The Backrooms — the world: turns a generated level (gen.js) into rooms you
// can stand in. For every room it builds the shell (carpet, wallpaper with
// holes for the doorways, a drop ceiling with its tube panels), hands a
// builder (rooms.js) a small toolbox to furnish it, bakes the light, and keeps
// what the game needs afterwards: where you can walk, what you can use, what
// moves.
import * as THREE from 'three';
import { T, DOOR_H, TILE, toWorld, toLocal, wallLength, makeRng, roomDistances, roomPath } from './gen.js';
import { Batch, lamp, lightAt, lin, ticks, smooth, WHITE } from './kit.js';

// each local wall: the way it faces, the direction it runs (U = up × normal), where it starts,
// and how far along it a local coordinate c is (c is x on the front/back walls, z on the side walls)
const WALLS = {
  back: { n: [0, 0, 1], U: [1, 0, 0], o: (W, D) => [-W / 2, 0, -D / 2], s: (c, W) => c + W / 2 },
  front: { n: [0, 0, -1], U: [-1, 0, 0], o: (W, D) => [W / 2, 0, D / 2], s: (c, W) => W / 2 - c },
  left: { n: [1, 0, 0], U: [0, 0, -1], o: (W, D) => [-W / 2, 0, D / 2], s: (c, W, D) => D / 2 - c },
  right: { n: [-1, 0, 0], U: [0, 0, 1], o: (W, D) => [W / 2, 0, -D / 2], s: (c, W, D) => c + D / 2 },
};
const UP = [0, 1, 0];
const PAPER = [0.93, 0.91, 0.84];

/** Vertex positions across a ceiling so that every tile seam has a row of vertices. */
function tileTicks(len) {
  const out = [0];
  for (let p = Math.ceil((-len / 2 + 0.05) / TILE) * TILE; p < len / 2 - 0.05; p += TILE) out.push(p + len / 2);
  out.push(len);
  return out;
}

/**
 * The office's furniture catalogue, if it will load (other people are still writing it).
 * Only the recipes are borrowed: each thing is meshed here, for this level, and thrown away with it.
 */
export async function loadCatalogue(kit) {
  try {
    const mod = await import('../props/index.js');
    const PROPS = mod.PROPS || {}, failed = new Set();
    return {
      has: (type) => !!PROPS[type] && !failed.has(type),
      entry: (type) => PROPS[type] || null,
      geo(type, o = {}) {
        const entry = PROPS[type];
        if (!entry || failed.has(type)) return null;
        const spec = { id: `${type}:${o.variant ?? 'backrooms'}`, type, ...o };
        try { return kit.model(`prop:${type}:${entry.variant ? entry.variant(spec) : ''}`, () => entry.make(spec)); }
        catch (err) { failed.add(type); console.warn('[backrooms] prop', type, err); return null; }
      },
    };
  } catch (err) {
    console.warn('[backrooms] no furniture catalogue', err);
    return { has: () => false, entry: () => null, geo: () => null };
  }
}

/**
 * @param kit    from createKit()
 * @param level  from generate()
 * @param env    { catalogue, builders, say, cast, … } — what rooms may call on
 * @param tick   awaited between rooms, so the loading picture keeps moving
 */
export async function buildWorld(kit, level, env, tick) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const rooms = level.rooms.map((def) => ({
    def, id: def.id, group: new THREE.Group(), u: { flick: { value: 1 }, dim: { value: 1 } },
    lights: [], amb: [0, 0, 0], level: 0, colliders: [], uses: [], zones: [], ticks: [], flickers: [],
    clip: null, floorY: null, onEnter: null, slow: null,
    rect: { x0: def.x + T / 2, z0: def.z + T / 2, x1: def.x + def.w - T / 2, z1: def.z + def.d - T / 2 },
  }));
  const throats = level.links.map((link) => ({ link, open: !link.door, a: link.a, b: link.b }));
  const world = { scene, level, rooms, throats, kit, env };

  /* ---- how bright each room is, before anything is built ------------------------- */
  for (const rt of rooms) {
    const { def } = rt, tube = lin(def.look.tube), wall = lin(def.look.wall), top = Math.max(...wall);
    const lit = def.panels.filter((p) => p.state !== 'dead').length;
    rt.level = 0.03 + Math.min(0.4, (2.5 * lit * def.light.power) / (def.W * def.D));
    rt.amb = tube.map((c, i) => c * rt.level * (0.55 + 0.45 * wall[i] / top));
    rt.group.position.set(def.cx, 0, def.cz);
    rt.group.rotation.y = (def.rot * Math.PI) / 2;
    scene.add(rt.group);
  }

  /* ---- can a circle stand here? --------------------------------------------------- */
  const hits = (c, x, z, r) => {
    if (c.on === false) return false;
    if (c.r !== undefined) return (x - c.x) ** 2 + (z - c.z) ** 2 < (r + c.r) ** 2;
    const dx = x - Math.max(c.x0, Math.min(x, c.x1)), dz = z - Math.max(c.z0, Math.min(z, c.z1));
    return dx * dx + dz * dz < r * r;
  };
  world.inThroat = (x, z, r) => {
    for (const th of throats) {
      if (!th.open) continue;
      const l = th.link, reach = T / 2 + r + 0.06;
      if (l.axis === 'x' ? (Math.abs(x - l.at) <= reach && z >= l.from + r && z <= l.to - r) : (Math.abs(z - l.at) <= reach && x >= l.from + r && x <= l.to - r)) return true;
    }
    return false;
  };
  world.free = (x, z, r = 0.22, opt = {}) => {
    let inside = false;
    for (const rt of rooms) {
      const b = rt.rect;
      if (x < b.x0 + r || x > b.x1 - r || z < b.z0 + r || z > b.z1 - r) continue;
      if (rt.clip) { const p = toLocal(rt.def, x, z); if (!rt.clip(p.x, p.z, r)) continue; }
      inside = true; break;
    }
    if (!inside && !world.inThroat(x, z, r)) return false;
    if (opt.walls) return true;
    for (const rt of rooms) {
      const b = rt.rect;
      if (x < b.x0 - 1 || x > b.x1 + 1 || z < b.z0 - 1 || z > b.z1 + 1) continue;
      for (const c of rt.colliders) if ((!opt.tall || c.tall) && hits(c, x, z, r)) return false;
    }
    return true;
  };
  world.roomAt = (x, z) => {
    for (const rt of rooms) { const d = rt.def; if (x >= d.x && x < d.x + d.w && z >= d.z && z < d.z + d.d) return rt; }
    return null;
  };
  /** Can one point see another? Walls and tall furniture block; chairs do not. */
  world.los = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / 0.25));
    for (let i = 1; i < n; i++) { const t = i / n; if (!world.free(ax + (bx - ax) * t, az + (bz - az) * t, 0.02, { tall: true })) return false; }
    return true;
  };
  world.openLink = (id) => { throats[id].open = true; };
  world.path = (a, b) => roomPath(level, a, b);
  world.distances = (from) => roomDistances(level, from);
  /** The middle of the doorway between two neighbouring rooms, in the world. */
  world.doorway = (a, b) => {
    const th = throats.find((t) => (t.a === a && t.b === b) || (t.a === b && t.b === a));
    if (!th) return null;
    const l = th.link, mid = (l.from + l.to) / 2;
    return l.axis === 'x' ? { x: l.at, z: mid, open: th.open, nx: 1, nz: 0 } : { x: mid, z: l.at, open: th.open, nx: 0, nz: 1 };
  };

  /* ---- build ---------------------------------------------------------------------- */
  for (const rt of rooms) {
    const builder = env.builders[rt.def.kind === 'special' ? rt.def.arch : rt.def.kind] || env.builders.plain;
    let ctx = roomContext(world, rt);
    try { builder(ctx); }
    catch (err) {
      console.warn(`[backrooms] ${rt.def.arch || rt.def.kind} would not build — leaving it plain`, err);
      rt.group.clear(); rt.colliders.length = 0; rt.uses.length = 0; rt.zones.length = 0; rt.ticks.length = 0; rt.flickers.length = 0; rt.lights.length = 0;
      rt.clip = null; rt.floorY = null; rt.slow = null;
      ctx = roomContext(world, rt); ctx.shell();
    }
    ctx.finish();
    if (tick) await tick(rt.id + 1, rooms.length);
  }

  // furniture must never wall a doorway off: if it does, that room's furniture stops being solid
  for (const rt of rooms) {
    const { def } = rt;
    if (def.doors.length < 2 || !rt.colliders.length) continue;
    const inner = (dr) => {
      const w = WALLS[dr.side], o = w.o(def.W, def.D), s = w.s(dr.c, def.W, def.D);
      return toWorld(def, o[0] + w.U[0] * s + w.n[0] * 0.5, o[2] + w.U[2] * s + w.n[2] * 0.5);
    };
    const cell = 0.25, b = rt.rect, nx = Math.ceil((b.x1 - b.x0) / cell), nz = Math.ceil((b.z1 - b.z0) / cell);
    const key = (p) => Math.floor((p.x - b.x0) / cell) + nx * Math.floor((p.z - b.z0) / cell);
    const seen = new Set(), queue = [];
    const from = inner(def.doors[0]);
    seen.add(key(from)); queue.push(key(from));
    while (queue.length) {
      const k = queue.pop(), i = k % nx, j = Math.floor(k / nx);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj, kk = ii + nx * jj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen.has(kk)) continue;
        if (!world.free(b.x0 + (ii + 0.5) * cell, b.z0 + (jj + 0.5) * cell, 0.23)) continue;
        seen.add(kk); queue.push(kk);
      }
    }
    if (def.doors.some((dr) => !seen.has(key(inner(dr))))) {
      console.warn(`[backrooms] furniture blocked a doorway in ${def.arch || def.kind} — made it soft`);
      for (const c of rt.colliders) if (!c.keep) c.on = false;
    }
  }

  /* ---- while you play ------------------------------------------------------------- */
  let current = null, shown = new Set();
  world.current = () => current;
  /** Which rooms are drawn and which are alive, given where the player is. */
  world.enter = (rt) => {
    if (!rt || rt === current) return;
    const before = current;
    current = rt;
    const dist = world.distances(rt.id);
    shown = new Set();
    for (const r of rooms) { const d = dist.get(r.id); r.group.visible = d <= 3; r.near = d <= 1; if (r.group.visible) shown.add(r.id); }
    before?.onLeave?.();
    rt.visits = (rt.visits || 0) + 1;
    rt.onEnter?.(rt.visits);
  };
  world.update = (dt, t, me) => {
    const here = world.roomAt(me.x, me.z);
    if (here) world.enter(here);
    for (const rt of rooms) {
      // tubes that cannot make their minds up
      if (rt.flickers.length && rt.group.visible) {
        rt.phase = (rt.phase ?? rt.id * 7.3) + dt;
        const p = rt.phase;
        let k = 1;
        const slow = Math.sin(p * 1.7) + Math.sin(p * 2.9 + 1.3);
        if (slow > 1.15) k = Math.random() < 0.5 ? 0.15 : 0.9;
        else if (Math.random() < 0.012) k = 0.3;
        rt.flickerNow = k;
        rt.u.flick.value += (k - rt.u.flick.value) * 0.6;
        for (const f of rt.flickers) f.material.color.copy(f.userData.on).multiplyScalar((0.12 + 0.88 * rt.u.flick.value) * (rt.lightsK ?? 1));
      }
      if (!rt.near) continue;
      const p = toLocal(rt.def, me.x, me.z);
      const local = { x: p.x, z: p.z, inside: rt === current, yaw: me.yaw - (rt.def.rot * Math.PI) / 2, moving: me.moving, speed: me.speed, world: me };
      for (const zone of rt.zones) {
        const inZone = rt === current && p.x >= zone.x0 && p.x <= zone.x1 && p.z >= zone.z0 && p.z <= zone.z1;
        if (inZone && !zone.in) { zone.in = true; zone.enter?.(local); }
        else if (!inZone && zone.in) { zone.in = false; zone.leave?.(local); }
        if (inZone) zone.stay?.(dt, local);
      }
      for (const fn of rt.ticks) fn(dt, t, local);
    }
  };
  /** The nearest usable thing the player is facing, or null. */
  world.usable = (me) => {
    let best = null, bestScore = Infinity;
    const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
    for (const rt of rooms) {
      if (!rt.near) continue;
      for (const use of rt.uses) {
        if (use.when && !use.when()) continue;
        const dx = use.wx - me.x, dz = use.wz - me.z, d = Math.hypot(dx, dz);
        if (d > use.r) continue;
        const facing = d < 0.45 ? 1 : (dx * fx + dz * fz) / d;
        if (facing < (use.cone ?? 0.55)) continue;
        const score = d * (1.6 - facing);
        if (score < bestScore && (d < 0.6 || world.los(me.x, me.z, use.wx - (dx / d) * 0.3, use.wz - (dz / d) * 0.3))) { best = use; bestScore = score; }
      }
    }
    return best;
  };
  world.floorY = (x, z) => {
    const rt = world.roomAt(x, z);
    if (!rt || !rt.floorY) return 0;
    const p = toLocal(rt.def, x, z);
    return rt.floorY(p.x, p.z);
  };
  /** Turn a room's ceiling up or down (0 = out, 1 = as built): the tubes, and everything they light. */
  world.setLights = (rt, k) => {
    rt.lightsK = k; rt.u.dim.value = Math.max(0.03, k);
    if (rt.panelMesh) rt.panelMesh.material.color.copy(rt.panelOn).multiplyScalar(Math.max(0.02, k));
  };
  world.dispose = () => { scene.traverse((o) => { if (o.userData.dispose) o.userData.dispose(); }); scene.clear(); };
  return world;
}

/* ---- the toolbox a room is built with ------------------------------------------------ */

function roomContext(world, rt) {
  const { kit, env, level } = world, { def } = rt, { W, D } = def, H = def.H, look = def.look;
  const R = makeRng(`${level.seed}/build/${def.id}`);
  const mapped = new Map(), shining = new Map();
  const reserved = [];                                    // floor already spoken for: [x, z, radius]
  const mat = new THREE.Matrix4(), quat = new THREE.Quaternion(), eul = new THREE.Euler(), vec = new THREE.Vector3(), scl = new THREE.Vector3();
  const doorPoint = (dr, off = 0) => { const w = WALLS[dr.side], o = w.o(W, D), s = w.s(dr.c, W, D); return { x: o[0] + w.U[0] * s + w.n[0] * off, z: o[2] + w.U[2] * s + w.n[2] * off }; };

  const c = {
    world, kit, env, level, room: def, rt, R, W, D, H, look, params: def.params || {},
    vox: new Batch(true), glass: new Batch(true),
    decals: { pos: [], uv: [], col: [], idx: [] },

    /** A batch drawn with `texture` and lit by the bake. One mesh per key. */
    mapped(key, texture, opt = {}) {
      if (!mapped.has(key)) mapped.set(key, { batch: new Batch(), texture, ...opt });
      return mapped.get(key).batch;
    },
    /** A batch that shines by itself (unlit): lit panels, screens, signs. */
    shining(key, texture, power = 1, rgb = WHITE, opt = {}) {
      if (!shining.has(key)) shining.set(key, { batch: new Batch(), texture, power, rgb, opt });
      return shining.get(key).batch;
    },
    get flat() { return c.mapped('flat', kit.tex.white()); },
    get wall() { return c.mapped('wall', kit.tex.wallpaper(look)); },
    get floor() { return c.mapped('floor', kit.tex.carpet(look.carpet)); },
    get ceil() { return c.mapped('ceil', kit.tex.ceiling(look.ceil)); },

    toWorld: (x, z) => toWorld(def, x, z),
    toLocal: (x, z) => toLocal(def, x, z),

    /** A baked light. power 1 ≈ one ceiling panel. */
    light(x, y, z, color, power = 1, opt = {}) {
      const rgb = typeof color === 'string' ? lin(color) : color;
      const l = lamp(x, y, z, rgb.map((v) => v * power), opt);
      rt.lights.push(l);
      return l;
    },
    /** The light at a spot, for things that are added after the bake. Call from finish hooks or ticks. */
    sample: (x, y, z, nx = 0, ny = 1, nz = 0) => lightAt(rt.lights, rt.amb, x, y, z, nx, ny, nz),

    /* ---- where things can go ---------------------------------------------------- */
    /** A point on a wall, `off` metres into the room, and the turn that makes a thing there face the room. */
    wallAt(side, at, off = 0) {
      const w = WALLS[side], o = w.o(W, D), s = w.s(at, W, D);
      return { x: o[0] + w.U[0] * s + w.n[0] * off, z: o[2] + w.U[2] * s + w.n[2] * off, rot: Math.atan2(w.n[0], w.n[2]), n: w.n, U: w.U };
    },
    /** The stretches of a wall with no doorway in them: [[from, to], …] along the wall's coordinate. */
    spans(side, margin = 0.3) {
      const half = wallLength(def, side) / 2;
      const holes = def.doors.filter((d) => d.side === side).map((d) => [d.c - d.w / 2 - margin, d.c + d.w / 2 + margin]).sort((a, b) => a[0] - b[0]);
      const out = []; let at = -half + margin;
      for (const [a, b] of holes) { if (a - at > 0.05) out.push([at, a]); at = Math.max(at, b); }
      if (half - margin - at > 0.05) out.push([at, half - margin]);
      return out;
    },
    /** A random stretch of free wall at least `need` long → { side, at } (its middle), or null. */
    wallSpot(need, sides = ['back', 'left', 'right', 'front'], margin = 0.35) {
      const options = [];
      for (const side of sides) for (const [a, b] of c.spans(side, margin)) if (b - a >= need) options.push({ side, a, b });
      if (!options.length) return null;
      const o = R.pick(options);
      return { side: o.side, at: R.range(o.a + need / 2, o.b - need / 2) };
    },
    reserve(x, z, r) { reserved.push([x, z, r]); },
    /** Is this bit of floor free — clear of doorways' approaches and of what was put down before? */
    clear(x, z, r = 0.4) {
      if (Math.abs(x) > W / 2 - r || Math.abs(z) > D / 2 - r) return false;
      for (const dr of def.doors) { const p = doorPoint(dr, 0.6); if (Math.hypot(x - p.x, z - p.z) < r + 0.55 + dr.w / 2) return false; }
      for (const [px, pz, pr] of reserved) if (Math.hypot(x - px, z - pz) < r + pr) return false;
      return true;
    },
    /** A random free spot for something of radius r (and reserve it), or null. */
    spot(r = 0.4, opt = {}) {
      const pad = opt.pad ?? 0.15;
      for (let tries = 0; tries < (opt.tries || 40); tries++) {
        const x = R.range(-W / 2 + r + pad, W / 2 - r - pad), z = R.range(-D / 2 + r + pad, D / 2 - r - pad);
        if (opt.near && Math.hypot(x - opt.near[0], z - opt.near[1]) > opt.near[2]) continue;
        if (!c.clear(x, z, r)) continue;
        reserved.push([x, z, r]);
        return { x, z };
      }
      return null;
    },
    /** A corner with no doorway crowding it → { x, z, sx, sz } (sx, sz: which corner), or null. */
    corner(inset = 0.6, pick) {
      const all = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ sx, sz, x: sx * (W / 2 - inset), z: sz * (D / 2 - inset) })).filter((k) => c.clear(k.x, k.z, inset * 0.7));
      if (!all.length) return null;
      const k = pick !== undefined ? all[pick % all.length] : R.pick(all);
      reserved.push([k.x, k.z, inset]);
      return k;
    },
    doorPoint,

    /* ---- solid things -------------------------------------------------------------- */
    /** Something you cannot walk through, in room coordinates. tall: also blocks the view. */
    solid(x0, z0, x1, z1, opt = {}) {
      const a = toWorld(def, x0, z0), b = toWorld(def, x1, z1);
      const col = { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), tall: !!opt.tall, keep: !!opt.keep, on: opt.on !== false };
      rt.colliders.push(col);
      return col;
    },
    /** A dark soft patch on the floor under something. */
    shadow(x, z, w, d, strength = 0.5, y = 0.006) { c.blot(x, z, w + 0.24, d + 0.24, { a: strength, y }); },
    /** A soft-edged stain: on the floor, or (down: true) on the underside of the ceiling. */
    blot(x, z, w, d, o = {}) {
      const q = c.decals, base = q.pos.length / 3, hw = w / 2, hd = d / 2, y = o.y ?? 0.006, rgb = o.rgb || [0, 0, 0];
      if (o.down) q.pos.push(x - hw, y, z - hd, x + hw, y, z - hd, x + hw, y, z + hd, x - hw, y, z + hd);
      else q.pos.push(x - hw, y, z + hd, x + hw, y, z + hd, x + hw, y, z - hd, x - hw, y, z - hd);
      q.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      for (let i = 0; i < 4; i++) q.col.push(rgb[0], rgb[1], rgb[2], o.a ?? 0.5);
      q.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    },
    /**
     * Put a meshed voxel model down. opt: rot (about y), y, flip (hang it from height y, upside down),
     * scale (number or [x,y,z]), tint, mono, solid, shadow, tall, tilt:[rx,rz], mirror, batch.
     * → its footprint { x0, z0, x1, z1, top, w, d, h } in room coordinates.
     */
    place(geo, x, z, opt = {}) {
      if (!geo) return null;
      const s = Array.isArray(opt.scale) ? opt.scale : [opt.scale || 1, opt.scale || 1, opt.scale || 1];
      if (opt.quat) quat.copy(opt.quat);
      else { eul.set(opt.tilt ? opt.tilt[0] : 0, opt.rot || 0, (opt.flip ? Math.PI : 0) + (opt.tilt ? opt.tilt[1] : 0), 'YXZ'); quat.setFromEuler(eul); }
      scl.set(VOX * s[0] * (opt.mirror ? -1 : 1), VOX * s[1], VOX * s[2]);
      mat.compose(vec.set(x, opt.y || 0, z), quat, scl);
      (opt.batch || c.vox).addVox(geo.solid, mat, opt);
      if (geo.glass) c.glass.addVox(geo.glass, mat, opt);
      const b = geo.bounds;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const bx of [b.x0, b.x1]) for (const by of [b.y0, b.y1]) for (const bz of [b.z0, b.z1]) {
        vec.set(bx, by, bz).applyMatrix4(mat);
        x0 = Math.min(x0, vec.x); x1 = Math.max(x1, vec.x); z0 = Math.min(z0, vec.z); z1 = Math.max(z1, vec.z); y0 = Math.min(y0, vec.y); y1 = Math.max(y1, vec.y);
      }
      const foot = { x0, z0, x1, z1, top: y1, bottom: y0, w: x1 - x0, d: z1 - z0, h: y1 - y0, x, z };
      const grounded = y0 < 0.3;
      if (opt.solid !== false && y0 < 1.0 && y1 > 0.25) c.solid(x0 + 0.03, z0 + 0.03, x1 - 0.03, z1 - 0.03, { tall: opt.tall ?? y1 > 1.25 });
      if (opt.shadow !== false && grounded) c.shadow((x0 + x1) / 2, (z0 + z1) / 2, foot.w, foot.d, opt.shadow || 0.45);
      return foot;
    },
    /** Something from the office's catalogue (desk, chair, cooler…), or a plain crate if it is not there. */
    prop(type, x, z, opt = {}) {
      const geo = env.catalogue.geo(type, opt.o);
      if (geo) return c.place(geo, x, z, opt);
      const [w, h, d] = opt.fallback || [0.6, 0.8, 0.6];
      return c.crate(x, z, w, h, d, opt.rot || 0, [0.6, 0.55, 0.45], opt);
    },
    hasProp: (type) => env.catalogue.has(type),
    /** A voxel model sculpted for this level: `make()` → Vox, meshed once per key. */
    model(key, make, x, z, opt = {}) { return c.place(kit.model(key, make), x, z, opt); },
    /** A plain painted block standing on the floor (or at opt.y), turned by rot. */
    crate(x, z, w, h, d, rot = 0, rgb = [0.6, 0.55, 0.45], opt = {}) {
      const y = opt.y || 0, turned = Math.abs(Math.sin(rot)) > 0.7, ww = turned ? d : w, dd = turned ? w : d;
      (opt.batch || c.flat).box(x - ww / 2, y, z - dd / 2, x + ww / 2, y + h, z + dd / 2, rgb, { skip: y ? '' : '-y' });
      if (opt.solid !== false && y < 1 && h > 0.25) c.solid(x - ww / 2, z - dd / 2, x + ww / 2, z + dd / 2, { tall: opt.tall ?? y + h > 1.25 });
      if (opt.shadow !== false && y < 0.3) c.shadow(x, z, ww, dd, 0.45);
      return { x0: x - ww / 2, z0: z - dd / 2, x1: x + ww / 2, z1: z + dd / 2, top: y + h, bottom: y, w: ww, d: dd, h, x, z };
    },
    /** A flat picture on a wall: batch decides the texture, uv picks the part of it. */
    hang(batch, side, at, y, w, h, uv = null, alb = WHITE, off = 0.012) {
      const p = c.wallAt(side, at, off), U = p.U, hw = w / 2, hh = h / 2;
      batch.quad([p.x - U[0] * hw, y - hh, p.z - U[2] * hw], [p.x + U[0] * hw, y - hh, p.z + U[2] * hw], [p.x + U[0] * hw, y + hh, p.z + U[2] * hw], [p.x - U[0] * hw, y + hh, p.z - U[2] * hw], alb, uv);
      return p;
    },
    /** A flat picture lying on the floor (or at height y), turned by rot. */
    lay(batch, x, z, w, d, rot = 0, uv = null, alb = WHITE, y = 0.008, down = false) {
      const cs = Math.cos(rot), sn = Math.sin(rot), hw = w / 2, hd = d / 2;
      const pt = (lx, lz) => [x + lx * cs + lz * sn, y, z - lx * sn + lz * cs];
      if (down) batch.quad(pt(hw, hd), pt(-hw, hd), pt(-hw, -hd), pt(hw, -hd), alb, uv);
      else batch.quad(pt(-hw, hd), pt(hw, hd), pt(hw, -hd), pt(-hw, -hd), alb, uv);
    },
    /** A box against a wall: `w` wide around `at`, from y0 to y1, standing d0…d1 out from the wall. */
    wbox(side, at, w, y0, y1, d0, d1, rgb = WHITE, opt = {}) {
      const a = c.wallAt(side, at - w / 2, d0), b = c.wallAt(side, at + w / 2, d1);
      (opt.batch || c.flat).box(Math.min(a.x, b.x), y0, Math.min(a.z, b.z), Math.max(a.x, b.x), y1, Math.max(a.z, b.z), rgb, opt);
      return a;
    },
    /** Something from the catalogue that hangs on a wall (a clock, a painting). */
    wallProp(type, side, at, opt = {}) {
      const p = c.wallAt(side, at, 0.005), entry = env.catalogue.entry(type);
      return c.prop(type, p.x, p.z, { rot: p.rot, y: opt.y ?? entry?.y ?? 1.4, solid: false, shadow: false, fallback: [0.4, 0.4, 0.05], ...opt });
    },
    /** A missing ceiling tile: a black square where one should be (x, z snapped to the tile grid). */
    hole(x, z, tiles = 1) {
      const sx = Math.round(x / TILE - 0.5) * TILE, sz = Math.round(z / TILE - 0.5) * TILE, k = TILE * tiles;
      c.flat.quad([sx, H - 0.004, sz], [sx + k, H - 0.004, sz], [sx + k, H - 0.004, sz + k], [sx, H - 0.004, sz + k], [0.004, 0.004, 0.004]);
      return { x: sx + k / 2, z: sz + k / 2 };
    },
    /**
     * Something that will move: its own mesh, lit by this room's bake. Author the batch in room
     * coordinates; `pivot` is the point it turns about. → a Group to move and turn.
     */
    dynamic(batch, opt = {}) {
      const holder = new THREE.Group(), pv = opt.pivot || [0, 0, 0];
      holder.position.set(pv[0], pv[1], pv[2]);
      rt.group.add(holder);
      c.after.push(() => {
        const geo = kit.geometry(batch, opt.unlit ? [] : rt.lights, opt.unlit ? [1.25, 1.25, 1.25] : rt.amb);
        if (!geo) return;
        const mesh = new THREE.Mesh(geo, kit.surface({ map: opt.map || (batch.vox ? null : kit.tex.white()), vox: batch.vox, room: rt.u, cutout: opt.cutout, flick: geo.userData.flick, side: opt.side }));
        mesh.position.set(-pv[0], -pv[1], -pv[2]);
        holder.add(mesh); holder.userData.mesh = mesh;
      });
      return holder;
    },
    /** A sheet of paper on the floor. */
    paper(x, z, rot = R.range(-3, 3), color) { c.lay(c.mapped('paper' + (color || ''), kit.tex.paper(color)), x, z, 0.21, 0.297, rot, null, WHITE, 0.006 + R() * 0.004); },
    /** A free-standing upright picture facing `rot` (0 = toward +z), seen from both sides. */
    board(batch, x, y, z, w, h, rot = 0, uv = null, alb = WHITE) {
      const cs = Math.cos(rot), sn = Math.sin(rot), hw = w / 2, hh = h / 2;
      const a = [x - cs * hw, y - hh, z + sn * hw], b = [x + cs * hw, y - hh, z - sn * hw], cc = [x + cs * hw, y + hh, z - sn * hw], d = [x - cs * hw, y + hh, z + sn * hw];
      batch.quad(a, b, cc, d, alb, uv);
    },

    /* ---- things that happen -------------------------------------------------------- */
    add(object) { rt.group.add(object); return object; },
    /** Something E can be pressed at. { x, z, r?, label, use(), when?() } in room coordinates. */
    use(spec) {
      const p = toWorld(def, spec.x, spec.z);
      const u = { r: 1.5, ...spec, wx: p.x, wz: p.z, room: rt };
      rt.uses.push(u);
      return u;
    },
    /** A patch of floor that notices you: { x0, z0, x1, z1, enter?, leave?, stay? }. */
    zone(spec) { rt.zones.push({ in: false, ...spec }); return spec; },
    /** Runs every frame while you are in this room or next door: fn(dt, t, me) with me in room coordinates. */
    tick(fn) { rt.ticks.push(fn); },
    say: (text, opt) => env.say(text, opt),
    /** Is a point of this room on the player's screen right now? */
    seen(x, z, opt) { const p = toWorld(def, x, z); return env.sees(p.x, p.z, opt); },

    /* ---- the shell ------------------------------------------------------------------- */
    /**
     * Floor, ceiling with its panels, four walls with their doorways, skirting, sockets.
     * opt: { H, floor:false, ceiling:false, walls:false|[sides], wallTex, floorTex, ceilTex, panels:false, skirting:false, sockets:false, floorAlb, wallAlb }
     */
    shell(opt = {}) {
      const h = opt.H ?? H;
      const wallB = opt.wallTex ? c.mapped('wall', opt.wallTex) : c.wall;
      const floorB = opt.floorTex ? c.mapped('floor', opt.floorTex) : c.floor;
      const ceilB = opt.ceilTex ? c.mapped('ceil', opt.ceilTex) : c.ceil;
      const edge = (a, la, b, lb) => 0.76 + 0.24 * smooth(Math.min(a, la - a, b, lb - b) / 0.45);
      const trim = opt.trim || lin(look.trim);
      if (opt.floor !== false) floorB.grid([-W / 2, 0, -D / 2], [0, 0, 1], [1, 0, 0], ticks(D), ticks(W), (u, v) => [(v + def.cx) / 1.6, (u + def.cz) / 1.6], opt.floorAlb || WHITE, (u, v) => edge(u, D, v, W));
      if (opt.ceiling !== false) ceilB.grid([-W / 2, h, -D / 2], [1, 0, 0], [0, 0, 1], tileTicks(W), tileTicks(D), (u, v) => [(u - W / 2) / TILE, (v - D / 2) / TILE], opt.ceilAlb || WHITE, (u, v) => edge(u, W, v, D));

      const sides = opt.walls === false ? [] : (opt.walls || ['back', 'front', 'left', 'right']);
      let run = 0;
      for (const side of ['back', 'right', 'front', 'left']) {
        const w = WALLS[side], len = wallLength(def, side), o = w.o(W, D), U = w.U, n = w.n;
        const at = (s, y = 0, out = 0) => [o[0] + U[0] * s - n[0] * out, y, o[2] + U[2] * s - n[2] * out];
        const doors = def.doors.filter((d) => d.side === side).map((d) => ({ a: w.s(d.c, W, D) - d.w / 2, b: w.s(d.c, W, D) + d.w / 2 })).sort((p, q) => p.a - q.a);
        const start = run; run += len;
        if (!sides.includes(side)) continue;
        const uvw = (s0) => (u, v) => [(start + s0 + u) / 0.8, v / 0.8];
        const crease = (s0) => (u, v) => (0.8 + 0.2 * smooth(Math.min(v, h - v) / 0.4)) * (0.86 + 0.14 * smooth(Math.min(s0 + u, len - s0 - u) / 0.4));
        let from = 0;
        const stretch = (a, b) => {
          if (b - a < 0.01) return;
          wallB.grid(at(a), U, UP, ticks(b - a), ticks(h, 0.45), uvw(a), opt.wallAlb || WHITE, crease(a));
          if (opt.skirting !== false) {
            const p = at(a), q = at(b), k = 0.022;
            c.flat.box(Math.min(p[0], q[0] + n[0] * k), 0, Math.min(p[2], q[2] + n[2] * k), Math.max(p[0], q[0] + n[0] * k), 0.11, Math.max(p[2], q[2] + n[2] * k), trim, { skip: '-y' });
          }
        };
        for (const d of doors) {
          stretch(from, d.a);
          // above the doorway, the two cheeks of the opening, its underside, and the strip of floor between rooms
          wallB.grid(at(d.a, DOOR_H), U, UP, ticks(d.b - d.a), ticks(h - DOOR_H, 0.45, 0.1), (u, v) => [(start + d.a + u) / 0.8, (DOOR_H + v) / 0.8], opt.wallAlb || WHITE, (u, v) => 0.84 + 0.16 * smooth((h - DOOR_H - v) / 0.3));
          const cheek = ticks(DOOR_H, 0.5), depth = [0, T / 2];
          wallB.grid(at(d.a), [-n[0], 0, -n[2]], UP, depth, cheek, (u, v) => [(start + d.a + u) / 0.8, v / 0.8], opt.wallAlb || WHITE, (u, v) => 0.82 + 0.1 * smooth(v / 0.4));
          wallB.grid(at(d.b, 0, T / 2), n, UP, depth, cheek, (u, v) => [(start + d.b - T / 2 + u) / 0.8, v / 0.8], opt.wallAlb || WHITE, (u, v) => 0.82 + 0.1 * smooth(v / 0.4));
          wallB.grid(at(d.a, DOOR_H, T / 2), U, n, ticks(d.b - d.a), depth, (u, v) => [(start + d.a + u) / 0.8, (DOOR_H + v) / 0.8], opt.wallAlb || WHITE, () => 0.7);
          floorB.grid(at(d.a, 0, T / 2), n, U, depth, ticks(d.b - d.a), (u, v) => [(u + def.cx) / 1.6, (v + def.cz) / 1.6], opt.floorAlb || WHITE, () => 0.86);
          if (opt.skirting !== false) for (const [s, dir] of [[d.a, 1], [d.b, -1]]) {
            const p = at(s), q = at(s, 0, T / 2), k = 0.022 * dir;
            c.flat.box(Math.min(p[0], q[0] + U[0] * k), 0, Math.min(p[2], q[2] + U[2] * k), Math.max(p[0], q[0] + U[0] * k), 0.11, Math.max(p[2], q[2] + U[2] * k), trim, { skip: '-y' });
          }
          from = d.b;
        }
        stretch(from, len);
      }

      // the tubes: lit ones shine and light the room, dead ones are just grey, a few cannot decide
      if (opt.panels !== false) {
        const tube = lin(look.tube), on = c.shining('panel', kit.tex.panel(true), 2.5, tube), dead = c.mapped('dead', kit.tex.panel(false));
        const boost = def.light.power * (h > 3 ? (h / 2.6) ** 1.5 : 1);
        for (const p of def.panels) {
          const o = [p.x - TILE / 2, h - 0.006, p.z - TILE], uv = (u, v) => [u / TILE, v / (TILE * 2)];
          if (p.state === 'dead') { dead.grid(o, [1, 0, 0], [0, 0, 1], [0, TILE], [0, TILE * 2], uv); continue; }
          rt.lights.push(lamp(p.x, h - 0.14, p.z, tube.map((v) => v * 1.05 * boost), { axis: [0, -1, 0], floor: 0.24, flick: p.state === 'flicker', k: 3.4 * (h > 3 ? h / 2.6 : 1), far: 14 * (h > 3 ? h / 2.6 : 1) }));
          if (p.state === 'on') { on.grid(o, [1, 0, 0], [0, 0, 1], [0, TILE], [0, TILE * 2], uv); continue; }
          const b = new Batch(); b.grid(o, [1, 0, 0], [0, 0, 1], [0, TILE], [0, TILE * 2], uv);
          const mesh = new THREE.Mesh(kit.plain(b), kit.glowing(kit.tex.panel(true), 2.5, tube));
          mesh.userData.on = mesh.material.color.clone();
          rt.flickers.push(mesh); rt.group.add(mesh);
        }
      }
      // light spilling in from a brighter room next door
      for (const dr of def.doors) {
        const other = world.rooms[dr.to], gap = other.level - rt.level;
        if (gap < 0.05) continue;
        const p = doorPoint(dr, -0.3), n = WALLS[dr.side].n;
        rt.lights.push(lamp(p.x, 1.45, p.z, lin(other.def.look.tube).map((v) => v * gap * 5.5 * (dr.w / 1.8)), { axis: n, floor: 0.1, k: 3.2, wrap: 0.4 }));
      }
      // wall sockets, low down, here and there
      if (opt.sockets !== false) for (let i = 0, nSock = R.int(1, 3); i < nSock; i++) {
        const spot = c.wallSpot(0.5); if (!spot) break;
        c.socket(spot.side, spot.at);
      }
      return c;
    },
    /** A wall socket: a cream plate with two slots. */
    socket(side, at, y = 0.3) {
      const p = c.wallAt(side, at, 0), n = p.n, U = p.U;
      const part = (du, dy, w, h, k, rgb) => {
        const cx = p.x + U[0] * du + n[0] * k / 2, cz = p.z + U[2] * du + n[2] * k / 2, hw = Math.abs(U[0]) * w / 2 + Math.abs(n[0]) * k / 2, hd = Math.abs(U[2]) * w / 2 + Math.abs(n[2]) * k / 2;
        c.flat.box(cx - hw, y + dy - h / 2, cz - hd, cx + hw, y + dy + h / 2, cz + hd, rgb);
      };
      part(0, 0, 0.075, 0.115, 0.008, [0.82, 0.78, 0.66]);
      part(-0.012, 0.022, 0.008, 0.026, 0.011, [0.12, 0.11, 0.1]); part(0.012, 0.022, 0.008, 0.026, 0.011, [0.12, 0.11, 0.1]);
      part(-0.012, -0.026, 0.008, 0.026, 0.011, [0.12, 0.11, 0.1]); part(0.012, -0.026, 0.008, 0.026, 0.011, [0.12, 0.11, 0.1]);
    },
    /** A full-height block of wall standing in the room (wallpapered, skirted, solid). */
    pillar(x, z, w, d, opt = {}) {
      const h = opt.h ?? H, wb = opt.batch || c.wall, trim = lin(look.trim);
      const faces = [[[x - w / 2, 0, z + d / 2], [1, 0, 0], w], [[x + w / 2, 0, z + d / 2], [0, 0, -1], d], [[x + w / 2, 0, z - d / 2], [-1, 0, 0], w], [[x - w / 2, 0, z - d / 2], [0, 0, 1], d]];
      let run = 0;
      for (const [o, U, len] of faces) {
        const start = run; run += len;
        wb.grid(o, U, UP, ticks(len, 0.5, 0.1), ticks(h, 0.45), (u, v) => [(start + u) / 0.8, v / 0.8], opt.alb || WHITE, (u, v) => 0.82 + 0.18 * smooth(Math.min(v, h - v) / 0.4));
      }
      if (h < H - 0.01) c.flat.box(x - w / 2, h - 0.001, z - d / 2, x + w / 2, h, z + d / 2, opt.cap || [0.5, 0.45, 0.36], { skip: '-y' });
      if (opt.skirting !== false) c.flat.box(x - w / 2 - 0.02, 0, z - d / 2 - 0.02, x + w / 2 + 0.02, 0.11, z + d / 2 + 0.02, trim, { skip: '-y' });
      if (opt.solid !== false) c.solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2, { tall: h > 1.25, keep: true });
      reserved.push([x, z, Math.max(w, d) / 2 + 0.2]);
    },
    /** A lit green sign over a doorway. */
    exitSign(dr, text = 'EXIT') {
      const tex = kit.tex.custom('exit' + text, 64, 20, (g, w, h) => {
        P(g, '#0d3a22', 0, 0, w, h); P(g, '#1f8a4e', 1, 1, w - 2, h - 2);
        g.fillStyle = '#eafff0'; g.font = `700 ${text.length > 8 ? 9 : text.length > 5 ? 11 : 14}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2 + 1);
      }, { clamp: true });
      const y = Math.min(H - 0.2, DOOR_H + 0.26), w = Math.min(dr.w - 0.2, 0.82);
      const p = c.hang(c.shining('exit' + text, tex, 1.9), dr.side, dr.c, y, w, w * 20 / 64, null, WHITE, 0.035);
      c.light(p.x + p.n[0] * 0.2, y, p.z + p.n[2] * 0.2, '#58e08c', 0.3, { k: 0.9, far: 4 });
      const hw = w / 2 + 0.02, U = p.U, n = p.n, cx = p.x - n[0] * 0.02, cz = p.z - n[2] * 0.02;
      c.flat.box(cx - Math.abs(U[0]) * hw - Math.abs(n[0]) * 0.015, y - w * 0.18, cz - Math.abs(U[2]) * hw - Math.abs(n[2]) * 0.015, cx + Math.abs(U[0]) * hw + Math.abs(n[0]) * 0.015, y + w * 0.18, cz + Math.abs(U[2]) * hw + Math.abs(n[2]) * 0.015, [0.1, 0.12, 0.1]);
    },

    /* ---- done: bake and hand the meshes over ----------------------------------------- */
    finish() {
      const add = (mesh, order = 0) => { mesh.renderOrder = order; mesh.matrixAutoUpdate = false; rt.group.add(mesh); return mesh; };
      for (const [, m] of mapped) {
        const geo = kit.geometry(m.batch, rt.lights, rt.amb);
        if (geo) add(new THREE.Mesh(geo, kit.surface({ map: m.texture, room: rt.u, flick: geo.userData.flick, cutout: m.cutout, side: m.side })));
      }
      const vg = kit.geometry(c.vox, rt.lights, rt.amb);
      if (vg) add(new THREE.Mesh(vg, kit.surface({ vox: true, room: rt.u, flick: vg.userData.flick })));
      const gg = kit.geometry(c.glass, rt.lights, rt.amb);
      if (gg) add(new THREE.Mesh(gg, kit.surface({ vox: true, room: rt.u, flick: gg.userData.flick, alpha: 0.42 })), 3);
      for (const [key, m] of shining) {
        const geo = kit.plain(m.batch); if (!geo) continue;
        const mesh = add(new THREE.Mesh(geo, kit.glowing(m.texture, m.power, m.rgb, m.opt)));
        if (key === 'panel') { rt.panelMesh = mesh; rt.panelOn = mesh.material.color.clone(); }
      }
      if (c.decals.idx.length) {
        const q = c.decals, geo = kit.own(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.Float32BufferAttribute(q.pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(q.uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(q.col, 4));
        geo.setIndex(q.idx);
        add(new THREE.Mesh(geo, kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), vertexColors: true, transparent: true, depthWrite: false }))), 1);
      }
      rt.group.updateMatrixWorld(true);
      for (const fn of c.after) fn();
    },
    /** Hooks run once the light is baked (so moving things can ask how bright their spot is). */
    after: [],
  };
  return c;
}

const VOX = 0.025;
const P = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
export { WALLS, PAPER };
