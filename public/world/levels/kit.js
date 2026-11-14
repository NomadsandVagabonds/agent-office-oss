// The Office — the level kit. What every floor of the lift has in common, so
// that writing a new one is mostly a list of what is in it:
//
//   export async function enter(office) {
//     const w = createWorld(office, { id: 'pond', bounds: { x0: -5, z0: -4, x1: 5, z1: 4 } });
//     w.floor(-5, -4, 5, 4, FLOORS.grass());
//     w.prop('bench', 0, -2, 'S');
//     w.thing({ x: 2, z: 1, label: 'the pond', use: () => ripple() });
//     w.lift(0, -4, 'S');                  // where you arrive, and the way back
//     return w.run();                      // resolves when you leave: { reason, to? }
//   }
//
// The kit owns the scene and its lights, you (your own avatar, WASD, a camera
// that follows and that you can drag round), what you may not walk through,
// the "E" hint, the chip that says where you are, Esc, and the cleaning up.
// A level adds what is there and what it does.
//
// House rule: a level does not talk over itself. No caption boxes; if there
// are words, they are IN the world — on a sign (w.sign), a screen (w.screen),
// a label, the lift's own display.
import * as THREE from 'three';
import { Avatar } from '../avatar/rig.js';
import { buildProp, hasProp, PROPS } from '../props/index.js';
import { voxObject, voxelUniforms } from '../vox/material.js';
import { VOXEL } from '../vox/vox.js';
import { WALL_H, signTexture } from '../scene/textures.js';
import { h } from '../ui/dom.js';
import { resolveLook } from '/core/look.mjs';
import { faceAngle, faceVector } from '/core/layout.mjs';
import { HOME, levelById } from '/core/levels.mjs';
import { CAR, createLiftDoor, quad } from './car.js';
import { curtain } from './curtain.js';
import { makePickup } from './loot.js';

const RADIUS = 0.24, WALK = 2.3, RUN = 4.4, REACH = 1.35, TAU = Math.PI * 2;
const STUB = 0.42, WALL_T = 0.14;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k, dt) => 1 - Math.exp(-k * dt);
const turnTo = (from, to) => { let d = (to - from) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const angleOf = (face) => (typeof face === 'number' ? face : faceAngle(face));

/**
 * @param {object} office   window.office
 * @param {object} spec
 *   id          the level's id in core/levels.mjs (the chip reads its floor and name from there)
 *   bounds      { x0, z0, x1, z1 } — where the floor is; you cannot walk off it
 *   floorY      (x, z) → height of the ground there, for a level with hills (default: flat, 0)
 *   start       { x, z, heading } — where you appear, if there is no lift() (heading 0 faces +z)
 *   camera      { yaw, pitch, dist, minDist, maxDist, minPitch, maxPitch, fov, height,
 *                 anchor: { x, z, pull } — keep the view centred near a point (a room) instead of on you; pull 0..1
 *                 ceiling: y — never rise above this · inside: { x0, z0, x1, z1 } — never leave this rectangle
 *                 first: true — see through your own eyes instead (drag to look; `height` is then eye height) }
 *   background  scene colour · fog { color, near, far }
 *   grade       { tilt: 0..1 soft focus, bloom, glow } — how the office's post-processing treats this place
 */
export function createWorld(office, spec = {}) {
  const level = levelById(spec.id) || { id: spec.id || 'somewhere', floor: spec.floor || '?', name: spec.name || 'Somewhere' };
  const stage = office.stage, net = office.net;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(spec.background || '#15121c');
  if (spec.fog) scene.fog = new THREE.Fog(spec.fog.color || spec.background || '#15121c', spec.fog.near ?? 30, spec.fog.far ?? 120);
  const cam = { yaw: 0, pitch: 0.42, dist: 8.5, minDist: 3, maxDist: 16, minPitch: 0.08, maxPitch: 1.35, fov: 36, height: 0.9, ...(spec.camera || {}) };
  const camera = new THREE.PerspectiveCamera(cam.fov, stage.size.w / stage.size.h, 0.2, spec.far || 900);
  const grade = { tilt: 0.25, bloom: null, glow: null, ...(spec.grade || {}) };
  const floorY = typeof spec.floorY === 'function' ? spec.floorY : () => 0;

  /* ---- light: a sky, a sun with shadows that follows you ----------------------------------- */
  const hemi = new THREE.HemisphereLight('#e3ecff', '#8a7560', 1.3);
  const sun = new THREE.DirectionalLight('#fff3df', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  const reach = spec.shadows ?? 16;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 140 });
  sun.shadow.camera.updateProjectionMatrix();
  const sunDir = new THREE.Vector3(0.5, 1, 0.6).normalize();
  scene.add(hemi, sun, sun.target, camera);              // the camera is in the scene so a level can hang things on it

  /* ---- keeping house -------------------------------------------------------------------- */
  const trash = [];                      // things to dispose() when the level closes
  const own = (x) => { if (x && !trash.includes(x)) trash.push(x); return x; };
  const frames = [];                     // the level's own per-frame functions
  const subs = [];                       // unsubscribe functions
  const sounds = [];
  let done = null, closing = false, running = false, offFrame = null, modal = 0, t = 0;

  /* ---- where you may stand ---------------------------------------------------------------- */
  let bounds = spec.bounds || { x0: -6, z0: -6, x1: 6, z1: 6 };
  const blocks = [];
  function free(x, z) {
    if (x < bounds.x0 + RADIUS || x > bounds.x1 - RADIUS || z < bounds.z0 + RADIUS || z > bounds.z1 - RADIUS) return false;
    for (const b of blocks) {
      if (b.r !== undefined) { if (Math.hypot(x - b.x, z - b.z) < b.r + RADIUS) return false; } else if (x > b.x0 - RADIUS && x < b.x1 + RADIUS && z > b.z0 - RADIUS && z < b.z1 + RADIUS) return false;
    }
    return spec.walkable ? !!spec.walkable(x, z) : true;
  }
  /** Nobody walks through this rectangle (x0, z0, x1, z1), or this circle (x, z, r). */
  function block(a, b, c, d) {
    if (d === undefined) blocks.push({ x: a, z: b, r: c });
    else blocks.push({ x0: Math.min(a, c), z0: Math.min(b, d), x1: Math.max(a, c), z1: Math.max(b, d) });
  }
  /** Block the footprint of something placed at (x, z) and turned by `angle`: [lx0, lz0, lx1, lz1] in its own frame. */
  function blockLocal(x, z, angle, [lx0, lz0, lx1, lz1]) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const xs = [], zs = [];
    for (const [lx, lz] of [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]]) { xs.push(x + lx * c + lz * s); zs.push(z - lx * s + lz * c); }
    block(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
  }

  /* ---- building blocks -------------------------------------------------------------------- */
  const lambert = (style, extra) => own(new THREE.MeshLambertMaterial(typeof style === 'string' ? { color: style, ...extra } : { map: style.tex, ...extra }));
  function add(object, x = 0, z = 0, face = 'S', y = 0) {
    object.position.set(x, y, z);
    object.rotation.y = angleOf(face);
    scene.add(object);
    return object;
  }
  /** A flat piece of floor. `style` is one of FLOORS.*() from scene/textures.js, or a colour. */
  function floor(x0, z0, x1, z1, style, opt = {}) {
    const s = style.size || 1, y = opt.y || 0;
    const mesh = quad(lambert(style), [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / s, -z1 / s, x1 / s, -z0 / s]);
    own(mesh.geometry);
    scene.add(mesh);
    return mesh;
  }
  /**
   * An upright wall from (ax, az) to (bx, bz), seen from the left of that
   * direction — so walk a room's corners anticlockwise on the map and every
   * wall faces in. It is one-sided: from behind you look straight through it,
   * the way the office's near walls step aside. `style` is WALLS.*() or a colour.
   */
  function wall(ax, az, bx, bz, style, opt = {}) {
    const hgt = opt.h ?? WALL_H, y = opt.y || 0, len = Math.hypot(bx - ax, bz - az);
    const tile = style.tile || 1, u0 = opt.u ?? 0, total = Math.max(WALL_H, y + hgt);     // taller than the paper: it stretches
    const mesh = quad(opt.material || lambert(style), [bx, y, bz], [ax, y, az], [ax, y + hgt, az], [bx, y + hgt, bz],
      [-(u0 + len / tile), y / total, -u0, (y + hgt) / total]);
    own(mesh.geometry);
    scene.add(mesh);
    return mesh;
  }
  /** A plain block, x0..x1 × y0..y1 × z0..z1, in a colour (or a material). */
  function box(x0, y0, z0, x1, y1, z1, color = '#6d7582', opt = {}) {
    const mesh = new THREE.Mesh(own(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))), color.isMaterial ? color : lambert(color, opt.material));
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.castShadow = opt.cast !== false; mesh.receiveShadow = true;
    scene.add(mesh);
    if (opt.solid) block(x0, z0, x1, z1);
    return mesh;
  }
  /**
   * Something from the office's furniture catalogue (props/index.js): 'bench',
   * 'tree', 'arcade'… placed at (x, z) facing `face` ('S' 'N' 'E' 'W' or radians).
   * opt: o (fields for the prop's make(o), e.g. { stage: 4 }) · id (which variant) · y · scale
   *      solid: false to walk through it · footprint: [w, d] metres, when its own outline is too generous
   */
  function prop(type, x, z, face = 'S', opt = {}) {
    if (!hasProp(type)) { console.warn(`[level ${level.id}] no prop called "${type}"`); return null; }
    const node = buildProp(type, { id: opt.id || `${level.id}:${type}:${x},${z}`, type, ...(opt.o || {}) });
    const holder = new THREE.Group();
    holder.add(node);
    if (opt.scale) holder.scale.setScalar(opt.scale);
    add(holder, x, z, face, (opt.y ?? PROPS[type].y ?? 0) + floorY(x, z));
    holder.userData.type = type;
    if (opt.solid !== false && !PROPS[type].wall) {
      const b = node.userData.bounds, k = VOXEL * (opt.scale || 1);
      const fp = opt.footprint ? [-opt.footprint[0] / 2, -opt.footprint[1] / 2, opt.footprint[0] / 2, opt.footprint[1] / 2] : [b.x0 * k, b.z0 * k, b.x1 * k, b.z1 * k];
      if (fp[2] - fp[0] > 0.05 && fp[3] - fp[1] > 0.05) blockLocal(x, z, angleOf(face), fp);
    }
    return holder;
  }
  /** Something you sculpt yourself: a function returning a Vox (see props/README.md). */
  function vox(model, x, z, face = 'S', opt = {}) {
    const node = voxObject(model, { lod: false, cast: opt.cast, receive: opt.receive });
    node.traverse((o) => { if (o.geometry) own(o.geometry); });
    const holder = new THREE.Group();
    holder.add(node);
    add(holder, x, z, face, (opt.y || 0) + floorY(x, z));
    if (opt.solid) { const b = node.userData.bounds; blockLocal(x, z, angleOf(face), [b.x0 * VOXEL, b.z0 * VOXEL, b.x1 * VOXEL, b.z1 * VOXEL]); }
    return holder;
  }
  /**
   * Words, in the world: a small painted plaque. Returns a mesh `height` metres
   * tall facing +z — hang it with w.add(sign, x, z, face, y).
   * opt: height (0.22) · bg · fg · accent · size (the font, in texture pixels)
   */
  function sign(text, opt = {}) {
    const tex = own(signTexture(String(text), { size: opt.size || 11, bg: opt.bg, fg: opt.fg, accent: opt.accent }));
    const hgt = opt.height || 0.22;
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(hgt * tex.userData.aspect, hgt)), own(new THREE.MeshLambertMaterial({ map: tex })));
    mesh.receiveShadow = true;
    return mesh;
  }
  /**
   * A live picture: a canvas on a glowing panel, redrawn when you ask.
   * Returns { mesh, canvas, g, w, h, redraw(), dirty() } — put the mesh where you want it.
   */
  function screen(metresW, metresH, draw, opt = {}) {
    const ppm = opt.ppm || 160;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(metresW * ppm); canvas.height = Math.round(metresH * ppm);
    const g = canvas.getContext('2d');
    const tex = own(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const material = own(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    material.color.setScalar(opt.gain ?? 1.1);
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(metresW, metresH)), material);
    const s = { mesh, canvas, g, w: canvas.width, h: canvas.height, material, stale: true,
      redraw() { s.stale = false; draw(g, canvas.width, canvas.height, s); tex.needsUpdate = true; },
      dirty() { s.stale = true; } };
    s.redraw();
    return s;
  }
  /** A point of light: a lamp, a neon tube, a screen's spill. */
  function lamp(x, y, z, color = '#ffc98a', power = 4, distance = 8) {
    const l = new THREE.PointLight(color, power, distance, 1.5);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  }
  /** Set the sky and the sun: any of { sky, ground, hemi, sun, power, dir: Vector3|[x,y,z], background, fog }. */
  function light(o = {}) {
    if (o.sky) hemi.color.set(o.sky);
    if (o.ground) hemi.groundColor.set(o.ground);
    if (o.hemi !== undefined) hemi.intensity = o.hemi;
    if (o.sun) sun.color.set(o.sun);
    if (o.power !== undefined) sun.intensity = o.power;
    if (o.dir) { if (o.dir.isVector3) sunDir.copy(o.dir); else sunDir.set(...o.dir); sunDir.normalize(); }
    if (o.background) scene.background.set(o.background);
    if (o.fog && scene.fog) scene.fog.color.set(o.fog);
  }

  /**
   * Four walls and a floor on a slab, like a room of the office lifted out:
   * low stubs you can always see over, upper walls that are only there from
   * the inside. opt: { x0, z0, x1, z1, h, wall, floor, lift: { side: 'N'|'S'|'E'|'W', at } }
   * — `lift` cuts a doorway in that wall and stands the lift in it.
   */
  function room(o) {
    const { x0, z0, x1, z1 } = o, hgt = o.h ?? WALL_H;
    bounds = { x0, z0, x1, z1 };
    if (o.floor) floor(x0, z0, x1, z1, o.floor);
    box(x0 - 0.3, -0.5, z0 - 0.3, x1 + 0.3, -0.012, z1 + 0.3, o.slab || '#2c2530', { cast: false });
    const material = lambert(o.wall);
    const stub = lambert(o.outside || '#3a3340'), trim = lambert('#3b2a1c');
    // each side: from → to walking anticlockwise on the map (so the wall faces in), and which way is out
    const sides = { N: [x1, z0, x0, z0, 0, -1], W: [x0, z0, x0, z1, -1, 0], S: [x0, z1, x1, z1, 0, 1], E: [x1, z1, x1, z0, 1, 0] };
    let made = null;
    for (const [name, [ax, az, bx, bz, ox, oz]] of Object.entries(sides)) {
      const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
      const at = (d) => [ax + dx * d, az + dz * d];
      const gap = o.lift && o.lift.side === name ? o.lift : null;
      // where along this wall the doorway's middle is: `at` is the x (N/S walls) or z (E/W walls) of it
      const mid = gap ? Math.abs((dx ? gap.at - ax : gap.at - az)) : 0;
      const spans = gap ? [[0, mid - CAR.door / 2, 0], [mid + CAR.door / 2, len, 0], [mid - CAR.door / 2, mid + CAR.door / 2, CAR.doorH]] : [[0, len, 0]];
      for (const [from, to, y] of spans) {
        const [fx, fz] = at(from), [tx, tz] = at(to);
        wall(fx, fz, tx, tz, o.wall, { h: hgt - y, y, material, u: from / (o.wall.tile || 1) });
      }
      // the stub and its cap sit just outside the wall line, so the paper inside runs to the floor
      for (const [from, to] of gap ? [[-WALL_T, mid - CAR.w / 2], [mid + CAR.w / 2, len + WALL_T]] : [[-WALL_T, len + WALL_T]]) {
        const [fx, fz] = at(from), [tx, tz] = at(to);
        const px = ox * 0.004, pz = oz * 0.004, qx = ox * WALL_T, qz = oz * WALL_T;
        box(Math.min(fx + px, tx + qx), -0.012, Math.min(fz + pz, tz + qz), Math.max(fx + px, tx + qx), STUB, Math.max(fz + pz, tz + qz), stub, { cast: false });
        box(Math.min(fx + px, tx + qx) - 0.01, STUB, Math.min(fz + pz, tz + qz) - 0.01, Math.max(fx + px, tx + qx) + 0.01, STUB + 0.02, Math.max(fz + pz, tz + qz) + 0.01, trim, { cast: false });
      }
      if (gap) {
        const [gx, gz] = at(mid);
        made = lift(gx, gz, { N: 'S', S: 'N', E: 'W', W: 'E' }[name], { front: false, shell: o.shaft });
      }
    }
    return { lift: made };
  }

  /* ---- you -------------------------------------------------------------------------------- */
  const who = office.walk?.me || { id: 'guest', name: 'Lead', look: null };
  const avatar = new Avatar(resolveLook('lead:' + who.id, who.look || { accessory: 'crown' }), { seed: 'lead:' + who.id, provider: 'custom' });
  scene.add(avatar.root);
  const me = { x: spec.start?.x ?? 0, z: spec.start?.z ?? 0, heading: spec.start?.heading ?? 0, moving: false, hop: 0, seat: null, frozen: false, script: null };
  const held = new Set();
  const goal = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  const eye = new THREE.Vector3(me.x, cam.height, me.z);       // what the camera looks at: a point at chest height that follows you
  let shot = null, shotLast = null, shotMix = 0;        // { pos, look, fov } while the camera holds a fixed shot
  let stride = 0;                                        // how far you have walked, for the bob of a first-person view

  /* ---- things you can use ----------------------------------------------------------------- */
  const things = [];
  let near = null;
  /**
   * Something to press E at (or click).
   *   { x, z, label, use(world, thing), reach?, object?: what to click, hidden?: () => boolean }
   * `label` is the only caption there is ("E the telescope"); what happens next is up to use().
   */
  function thing(spec2) {
    const entry = { reach: REACH, ...spec2 };
    things.push(entry);
    return entry;
  }
  /** A prop you can sit on: E sits you down, any step stands you up again. */
  function seat(holder, label, opt = {}) {
    const type = holder.userData.type, top = opt.top ?? PROPS[type]?.seat ?? 16;
    return thing({ x: holder.position.x, z: holder.position.z, label, object: holder, reach: opt.reach ?? 1.5,
      use() {
        const a = holder.rotation.y, dx = opt.dx || 0;
        me.seat = { x: holder.position.x + Math.cos(a) * dx, z: holder.position.z - Math.sin(a) * dx, y: holder.position.y, heading: a + (opt.turn || 0), top };
        opt.onSit?.();
      } });
  }
  function use(entry = near) {
    if (!entry || me.script || closing) return;
    if (!me.seat && !shot) me.heading = Math.atan2(entry.x - me.x, entry.z - me.z) || me.heading;
    try { entry.use?.(api, entry); } catch (err) { console.error(`[level ${level.id}]`, err); }
  }

  /* ---- things to find (core/game.mjs): a coin or the keycard, lying where you put it -------------- */
  const pickups = [];
  /**
   * Hide a coin or this floor's keycard here. It turns in the air until somebody walks into it; then it is
   * theirs, the office is told, and it never comes back. Returns null if it has already been taken — so a
   * floor can simply call this for everything it hides, every visit.
   *   { item: 'coin'|'card', n: which coin (1…), x, z, y?: above the ground, reach?: 0.75,
   *     hidden?: () => boolean (not there yet), light?: true on a dark floor, onTake?: (answer) => void }
   * The handle: { group, taken, moveTo(x, z, y?), take() — give it to them now, wherever they are }.
   */
  function loot(o) {
    const item = o.item === 'card' ? 'card' : 'coin', n = item === 'coin' ? Math.floor(o.n) : 0;
    const still = office.game?.left(level.id);
    if (!still || (item === 'card' ? !still.card : !still.coins.includes(n))) return null;
    const p = makePickup(item, { light: o.light, hover: o.hover, scale: o.scale });
    const entry = { p, x: o.x, z: o.z, y: o.y || 0, reach: o.reach ?? 0.75, hidden: o.hidden || null, onTake: o.onTake || null, item, n };
    scene.add(p.group);
    const handle = {
      group: p.group, get taken() { return p.taken; },
      moveTo(x, z, y) { entry.x = x; entry.z = z; if (y !== undefined) entry.y = y; },
      take() {
        if (p.taken) return;
        p.take();
        Promise.resolve(office.game?.take(level.id, item, n)).then((answer) => { try { entry.onTake?.(answer); } catch (err) { console.error(`[level ${level.id}]`, err); } });
      },
    };
    entry.handle = handle;
    pickups.push(entry);
    return handle;
  }
  function lootStep(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const e = pickups[i], away = !!e.hidden?.();
      e.p.group.visible = !away && !e.p.gone;
      e.p.group.position.set(e.x, floorY(e.x, e.z) + e.y, e.z);
      if (!away && !e.p.taken && !closing && Math.hypot(e.x - me.x, e.z - me.z) < e.reach) e.handle.take();
      if (!e.p.update(dt, t + i * 1.7)) { e.p.dispose(); pickups.splice(i, 1); }
    }
  }

  /* ---- sound ------------------------------------------------------------------------------ */
  const sfx = (name, opt) => { try { return office.sound?.play?.(name, opt) ?? null; } catch { return null; } };
  /** Start a loop of music; it stops by itself when the level closes. */
  function music(name, opt = {}) {
    let handle = null;
    try { handle = office.sound?.music?.(name, { loop: true, volume: 0.45, ...opt }) ?? null; } catch { handle = null; }
    if (handle) sounds.push(handle);
    return handle;
  }
  /** The room tone of this place (the office's own stops while a level has the screen); gone again when the level closes. */
  let hasBed = false;
  function bed(name, opt = {}) {
    try { office.sound?.ambience?.(name, { volume: 0.4, fade: 1.2, ...opt }); hasBed = true; } catch { /* only sound */ }
  }

  /* ---- the lift: where you arrive, and the way back ------------------------------------------ */
  let liftHere = null;
  /**
   * Stand the lift at (x, z) with its doors facing `face`. You step out of it
   * when the level opens; E at it (or a click) opens the floor panel.
   */
  function lift(x, z, face = 'S', opt = {}) {
    const door = createLiftDoor({ floor: level.floor, shell: opt.shell, front: opt.front });
    add(door.group, x, z, face);
    own(door);
    const a = angleOf(face), [fx, fz] = [Math.sin(a), Math.cos(a)];
    blockLocal(x, z, a, door.footprint);
    liftHere = { door, x, z, a, fx, fz, open: 0, want: 0, holdUntil: 0 };
    me.x = x + fx * 1.25; me.z = z + fz * 1.25; me.heading = a;
    if (spec.camera?.yaw === undefined) { cam.yaw = goal.yaw = a; }
    thing({ x: x + fx * 0.3, z: z + fz * 0.3, label: 'the lift', object: door.group, reach: 1.5, use: () => { openPanel(); } });
    return door;
  }
  async function openPanel() {
    if (modal || closing) return;
    modal++;
    if (liftHere) { liftHere.want = 1; liftHere.holdUntil = Infinity; sfx('lift-doors'); }
    let picked = null;
    try {
      const { openFloorPanel } = await import('../ui/elevator.js');
      picked = await openFloorPanel(office, { current: level.id, parent: root });
    } catch (err) { console.error('[level] floor panel', err); }
    modal--;
    if (picked && picked.id !== level.id) leave('lift', { to: picked.id });
    else if (liftHere) liftHere.holdUntil = t + 0.8;
  }

  /* ---- what is on screen besides the world ---------------------------------------------------- */
  const ui = document.getElementById('ui') || document.body;
  const needs = h('div.level-needs.glass.hidden', { title: 'Back to the office, to whoever is waiting (N)', onclick: () => leave('needs') });
  const hint = h('div.usehint.glass.hidden');
  const chip = h('div.level-chip.glass',
    h('b.floor', level.unmarked ? '' : level.floor), h('span.name', level.unmarked ? '' : level.name),
    h('button.btn.small', { title: 'Back to the office', onclick: () => leave('esc') }, 'Esc'));
  const root = h('div.level', chip, needs, hint);
  function showNeeds() {
    const n = (net.state.prompts || []).filter((p) => p.status === 'pending' && p.kind !== 'idle').length;
    needs.classList.toggle('hidden', !n);
    needs.replaceChildren(h('i.dot.blocked'), n === 1 ? '1 agent needs you' : `${n} agents need you`, h('kbd', 'N'));
  }

  /* ---- input ---------------------------------------------------------------------------------- */
  const KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift']);
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
  // something of the level's own has the keyboard (a game, the floor panel): the kit stays out of it
  const busy = () => modal > 0 || !!root.querySelector('.arcade, .liftpanel, [data-modal]');
  function keydown(e) {
    if (typing(e) || busy()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) { e.stopPropagation(); return; }
    e.stopPropagation();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape') { if (shot) unfocus(); else if (me.seat) stand(); else leave('esc'); return; }
    if (k === 'Tab') { e.preventDefault(); return; }
    if (me.script || closing) return;
    if (KEYS.has(k)) { held.add(k); e.preventDefault(); if (k !== 'Shift' && k !== 'ArrowLeft' && k !== 'ArrowRight') { if (shot) unfocus(); if (me.seat) stand(); } return; }
    if (k === 'e' || k === 'Enter') { e.preventDefault(); if (shot) unfocus(); else if (near || !cam.first) use(); else for (const fn of keyFns) fn(k, e); return; }
    if (k === ' ' && !cam.first) { e.preventDefault(); if (!me.seat) me.hop = 1; return; }
    if (k === ' ') e.preventDefault();
    if (k === 'n') { if (!needs.classList.contains('hidden')) leave('needs'); return; }
    for (const fn of keyFns) fn(k, e);
  }
  function keyup(e) { held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (!typing(e) && !busy()) e.stopPropagation(); }
  const keyFns = [], clickFns = [];
  const blur = () => held.clear();

  // the pointer: drag to look round, wheel to lean in, click a thing to use it
  let drag = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), box3 = new THREE.Box3(), hit3 = new THREE.Vector3();
  function pick(e) {
    const r = root.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null, bestT = Infinity;
    for (const entry of things) {
      if (!entry.object || entry.hidden?.()) continue;
      box3.setFromObject(entry.object);
      if (box3.isEmpty() || !ray.ray.intersectBox(box3.expandByScalar(0.05), hit3)) continue;
      const d = hit3.distanceTo(ray.ray.origin);
      if (d < bestT) { bestT = d; best = entry; }
    }
    return best;
  }
  function pointerdown(e) {
    if (e.target !== root || busy()) return;
    root.setPointerCapture?.(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, moved: 0 };
  }
  function pointermove(e) {
    if (!drag) { if (e.target === root && !busy()) root.style.cursor = pick(e) ? 'pointer' : ''; return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (shot) return;
    goal.yaw -= dx * (cam.first ? 0.004 : 0.006);
    goal.pitch = clamp(goal.pitch + dy * (cam.first ? 0.003 : 0.005), cam.minPitch, cam.maxPitch);
  }
  function pointerup(e) {
    if (!drag) return;
    const click = drag.moved < 5;
    drag = null;
    if (!click || me.script || closing) return;
    if (shot) { unfocus(); return; }
    const entry = pick(e);
    if (entry) use(entry); else for (const fn of clickFns) fn(e);
  }
  function wheel(e) {
    if (busy()) return;
    e.preventDefault();
    if (shot) return;
    goal.dist = clamp(goal.dist * Math.exp(clamp(e.deltaY, -240, 240) * 0.0014), cam.minDist, cam.maxDist);
  }

  /* ---- the camera: follows you, or holds a shot ------------------------------------------------ */
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  /**
   * Fly the camera to a fixed shot — to read a screen, to look through a telescope. Any step, E or Esc lets go.
   * opt: fov · alone: true to leave yourself out of the picture · onLeave()
   */
  function focus(pos, lookAt, opt = {}) {
    shot = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...lookAt), fov: opt.fov || cam.fov, alone: !!opt.alone, onLeave: opt.onLeave || null };
  }
  function unfocus() { const s = shot; shot = null; s?.onLeave?.(); }
  function stand() { me.seat = null; }
  /**
   * Stand somewhere and point the camera, at once — for taking a picture.
   * Any of { x, z, yaw, pitch, dist, fov, heading }: where you are, then the camera
   * round you (yaw 0 looks north, pitch is how far it looks down, in radians).
   * The same thing from the address bar: /?level=<id>&cam=x,z,dist,yaw,pitch
   */
  function look(o = {}) {
    if (me.script) { const s = me.script; me.script = null; s.resolve(); }
    me.seat = null; shot = null; shotMix = 0; me.moving = false;
    if (liftHere) { liftHere.want = 0; liftHere.open = 0; liftHere.holdUntil = 0; }
    if (Number.isFinite(o.x)) me.x = o.x;
    if (Number.isFinite(o.z)) me.z = o.z;
    if (Number.isFinite(o.heading)) me.heading = o.heading;
    for (const k of ['yaw', 'pitch', 'dist']) if (Number.isFinite(o[k])) { goal[k] = o[k]; cam[k] = o[k]; }
    if (Number.isFinite(o.fov)) cam.fov = o.fov;
    eye.set(me.x, cam.height + floorY(me.x, me.z), me.z);
    if (cam.anchor) { eye.x += (cam.anchor.x - eye.x) * (cam.anchor.pull ?? 0.6); eye.z += (cam.anchor.z - eye.z) * (cam.anchor.pull ?? 0.6); }
    placeCamera(0, true);
    return api;
  }

  function placeCamera(dt, instant) {
    const k = instant ? 1 : ease(cam.first ? 18 : 7, dt);
    cam.yaw += (goal.yaw - cam.yaw) * k; cam.pitch += (goal.pitch - cam.pitch) * k;
    if (cam.first && !shot && shotMix < 0.002) {                // through your own eyes
      eye.set(me.x, cam.height + floorY(me.x, me.z) + Math.sin(stride) * 0.018 * avatar.walking, me.z);
      camera.position.copy(eye);
      camera.rotation.set(-cam.pitch, cam.yaw, 0, 'YXZ');
      if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
      avatar.root.visible = false;
      return;
    }
    cam.dist *= Math.exp(Math.log(goal.dist / cam.dist) * k);
    const at = me.seat || me, pull = cam.anchor ? cam.anchor.pull ?? 0.6 : 0;
    const tx = at.x + ((cam.anchor?.x ?? 0) - at.x) * pull, tz = at.z + ((cam.anchor?.z ?? 0) - at.z) * pull;
    eye.x += (tx - eye.x) * k; eye.z += (tz - eye.z) * k;
    eye.y += (cam.height + floorY(at.x, at.z) - eye.y) * (instant ? 1 : ease(5, dt));
    const cp = Math.cos(cam.pitch);
    if (cam.first) {
      // a level seen through your own eyes holds a shot too (w.focus): it leaves from where you stand and comes back
      // to it, looking the way you were looking — not by way of a camera on a pole eight metres behind you
      camPos.copy(eye);
      camLook.set(eye.x - Math.sin(cam.yaw) * cp, eye.y - Math.sin(cam.pitch), eye.z - Math.cos(cam.yaw) * cp);
    } else {
      camPos.set(eye.x + Math.sin(cam.yaw) * cp * cam.dist, eye.y + Math.sin(cam.pitch) * cam.dist, eye.z + Math.cos(cam.yaw) * cp * cam.dist);
      if (cam.inside) { camPos.x = clamp(camPos.x, cam.inside.x0, cam.inside.x1); camPos.z = clamp(camPos.z, cam.inside.z0, cam.inside.z1); }
      camPos.y = Math.max(camPos.y, floorY(camPos.x, camPos.z) + 0.35);        // never under a hill
      if (cam.ceiling) camPos.y = Math.min(camPos.y, cam.ceiling);
      camLook.copy(eye);
    }
    let fov = cam.fov;
    if (shot) shotLast = shot;
    shotMix = instant ? (shot ? 1 : 0) : shotMix + ((shot ? 1 : 0) - shotMix) * ease(4.5, dt);
    if (shotLast && shotMix > 0.002) {                       // glide to the shot, and back from it
      const m = shotMix * shotMix * (3 - 2 * shotMix);
      camPos.lerp(shotLast.pos, m); camLook.lerp(shotLast.look, m);
      fov += (shotLast.fov - fov) * m;
    }
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // through your own eyes you are not in the picture until the camera has stepped back from where your head is
    avatar.root.visible = cam.first ? !shot?.alone && camPos.distanceTo(eye) > 0.8 : !(shot?.alone && shotMix > 0.35);
  }

  /* ---- every frame ------------------------------------------------------------------------------ */
  function walkStep(dt) {
    let fx = 0, fz = 0;
    if (held.has('w') || held.has('ArrowUp')) fz -= 1;
    if (held.has('s') || held.has('ArrowDown')) fz += 1;
    if (held.has('a')) fx -= 1;
    if (held.has('d')) fx += 1;
    if (held.has('ArrowLeft')) goal.yaw += 1.7 * dt;
    if (held.has('ArrowRight')) goal.yaw -= 1.7 * dt;
    const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
    let vx = fx * c + fz * s, vz = -fx * s + fz * c;
    const len = Math.hypot(vx, vz);
    me.moving = len > 0.01 && !me.seat && !shot;
    if (!me.moving) return;
    const speed = held.has('Shift') ? RUN : WALK;
    vx = (vx / len) * speed * dt; vz = (vz / len) * speed * dt;
    if (free(me.x + vx, me.z)) me.x += vx;                    // slide along whatever is in the way
    if (free(me.x, me.z + vz)) me.z += vz;
    stride += speed * dt * 3.2;
    me.heading += turnTo(me.heading, Math.atan2(vx, vz)) * ease(14, dt);
    avatar.speed = speed / 1.5;
  }
  /** Walk yourself somewhere in a straight line, through anything (stepping out of the lift, stepping back in). */
  function walkTo(x, z, seconds) {
    return new Promise((resolve) => { me.script = { x0: me.x, z0: me.z, x, z, t: 0, seconds, resolve }; });
  }
  function scriptStep(dt) {
    const s = me.script;
    s.t = Math.min(1, s.t + dt / s.seconds);
    me.x = s.x0 + (s.x - s.x0) * s.t; me.z = s.z0 + (s.z - s.z0) * s.t;
    me.moving = true; avatar.speed = 1.2;
    me.heading += turnTo(me.heading, Math.atan2(s.x - s.x0, s.z - s.z0)) * ease(14, dt);
    if (s.t >= 1) { me.script = null; me.moving = false; s.resolve(); }
  }
  function nearest() {
    let best = null, bestD = Infinity;
    for (const entry of things) {
      if (entry.hidden?.()) continue;
      const d = Math.hypot(entry.x - me.x, entry.z - me.z);
      if (d < entry.reach && d < bestD) { bestD = d; best = entry; }
    }
    return best;
  }
  function frame(dt) {
    t += dt;
    if (me.script) scriptStep(dt); else if (!closing) walkStep(dt); else me.moving = false;
    // the body
    avatar.walking += ((me.moving ? 1 : 0) - avatar.walking) * ease(12, dt);
    if (me.hop > 0) { me.hop = Math.max(0, me.hop - dt * 2.2); avatar.bounce = Math.sin(me.hop * Math.PI); } else avatar.bounce = 0;
    if (me.seat) {
      if (avatar.poseName !== 'lounge') { avatar.seatHeight = me.seat.top + 3; avatar.setPose('lounge'); }
      avatar.root.position.set(me.seat.x, me.seat.y || 0, me.seat.z);
      me.heading += turnTo(me.heading, me.seat.heading) * ease(10, dt);
    } else {
      if (avatar.poseName !== 'stand') avatar.setPose('stand');
      avatar.root.position.set(me.x, floorY(me.x, me.z), me.z);
    }
    avatar.root.rotation.y = me.heading;
    avatar.update(dt);
    // the lift's doors
    if (liftHere) {
      const L = liftHere;
      if (L.want && t > L.holdUntil) L.want = 0;
      L.open += (L.want - L.open) * ease(L.want ? 7 : 4, dt);
      L.door.setOpen(L.open);
    }
    // what is within reach
    const n = me.script || closing || shot || me.seat ? null : nearest();
    if (n !== near) {
      near = n;
      if (n) { hint.replaceChildren(h('kbd', 'E'), ' ', n.label); hint.classList.remove('hidden'); } else hint.classList.add('hidden');
    }
    for (const fn of frames) fn(dt, t);
    if (pickups.length) lootStep(dt);
    placeCamera(dt);
    // the sun follows you, so its shadows stay sharp where you are
    sun.target.position.set(eye.x, eye.y - cam.height, eye.z);
    sun.position.set(eye.x + sunDir.x * 60, eye.y + sunDir.y * 60, eye.z + sunDir.z * 60);
    // this place's share of the office's post-processing (the office sets its own again when you leave)
    stage.setTilt(grade.tilt, 0.5, 0.3);
    if (stage.bloom && grade.bloom !== null) stage.bloom.strength = grade.bloom;
    if (grade.glow !== null) voxelUniforms.uGlow.value = grade.glow;
    stage.renderer.shadowMap.needsUpdate = true;
  }

  /* ---- arriving and leaving ------------------------------------------------------------------- */
  const before = { bloom: stage.bloom?.strength, glow: voxelUniforms.uGlow.value };
  /** Take the screen. Resolves with { reason, … } when you leave — which is what enter() returns. */
  function run() {
    if (running) return Promise.reject(new Error('this level is already open'));
    running = true;
    return new Promise((resolve) => {
      done = resolve;
      ui.append(root);
      window.addEventListener('keydown', keydown, true);
      window.addEventListener('keyup', keyup, true);
      window.addEventListener('blur', blur);
      root.addEventListener('pointerdown', pointerdown);
      root.addEventListener('pointermove', pointermove);
      root.addEventListener('pointerup', pointerup);
      root.addEventListener('pointercancel', pointerup);
      root.addEventListener('wheel', wheel, { passive: false });
      root.addEventListener('contextmenu', (e) => e.preventDefault());
      subs.push(net.on('prompts', showNeeds));
      showNeeds();
      if (liftHere && spec.arrive !== false) {               // step out of the car; the doors close behind you
        const L = liftHere, tx = me.x, tz = me.z;
        me.x = L.x - L.fx * 0.7; me.z = L.z - L.fz * 0.7;
        L.open = L.want = 1; L.holdUntil = 1.5;
        walkTo(tx, tz, 0.95);
      }
      eye.set(me.x, cam.height + floorY(me.x, me.z), me.z);
      if (cam.anchor) { eye.x += (cam.anchor.x - eye.x) * (cam.anchor.pull ?? 0.6); eye.z += (cam.anchor.z - eye.z) * (cam.anchor.pull ?? 0.6); }
      avatar.root.position.set(me.x, floorY(me.x, me.z), me.z); avatar.root.rotation.y = me.heading;
      // the daemon hears which floor this person is on, so agents can tell (text.mjs reads it)
      net.send({ type: 'focus', id: who.id, name: who.name, focus: { kind: 'level', id: level.id } });
      placeCamera(0, true);
      offFrame = stage.onFrame(frame);
      stage.setView({ scene, camera });
      office.level = api;                                    // for the console, and for the curious
      // /?level=<this one>&cam=x,z,dist,yaw,pitch — arrive already standing there, looking that way (the office's own ?cam, one floor along)
      const recipe = office.q?.get('cam'), asked = office.q?.get('level');
      if (recipe && asked && !office.camUsed && (asked === level.id || asked.toLowerCase() === String(level.floor).toLowerCase())) {
        office.camUsed = true;
        const [x, z, dist, yaw, pitch] = recipe.split(',').map(Number);
        look({ x, z, dist, yaw, pitch });
      }
    });
  }
  /**
   * Leave. reason: 'esc' (take me home) · 'lift' with { to: level id } · anything of your own.
   * Whatever else you pass is handed back to whoever called enter().
   */
  async function leave(reason = 'exit', extra = {}) {
    if (closing || !running) return;
    closing = true;
    held.clear(); shot = null; me.seat = null;
    hint.classList.add('hidden');
    for (const s of sounds) { try { s.stop?.(0.5); } catch { /* it was only music */ } }
    if (liftHere && reason !== 'esc' && reason !== 'needs' && extra.walk !== false) {           // walk back into the car (unless you left some other way)
      const L = liftHere;
      L.want = 1; L.holdUntil = Infinity;
      await walkTo(L.x + L.fx * 0.9, L.z + L.fz * 0.9, Math.min(0.8, Math.hypot(me.x - L.x, me.z - L.z) / 4 + 0.15));
      await walkTo(L.x - L.fx * 0.7, L.z - L.fz * 0.7, 0.55);
    }
    await curtain.close(reason === 'esc' ? 180 : 260);
    close();
    done({ reason, level: level.id, ...extra });
  }
  function close() {
    offFrame?.();
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('keyup', keyup, true);
    window.removeEventListener('blur', blur);
    for (const off of subs) { try { off(); } catch { /* already gone */ } }
    for (const s of sounds) { try { s.stop?.(0); } catch { /* fine */ } }
    if (hasBed) { try { office.sound?.ambience?.(null, { fade: 0.6 }); } catch { /* fine */ } }
    net.send({ type: 'focus', id: who.id, name: who.name, focus: null });
    if (office.level === api) office.level = null;
    root.remove();
    stage.setView(null);
    if (stage.bloom && before.bloom !== undefined) stage.bloom.strength = before.bloom;
    voxelUniforms.uGlow.value = before.glow;
    avatar.dispose();
    for (const e of pickups.splice(0)) e.p.dispose();
    for (const x of trash) { try { x.dispose?.(); } catch { /* best effort */ } }
    scene.traverse((o) => { if (o.isLight && o.shadow?.map) o.shadow.map.dispose(); });
  }

  const api = {
    office, level, scene, camera, root, me, cam: goal, grade, look, avatar, hemi, sun, floorY,
    get time() { return t; },
    /** This floor's lift doorway (see car.js), once lift() or room({ lift }) has stood it somewhere. */
    get liftDoor() { return liftHere?.door || null; },
    add, floor, wall, box, room, prop, vox, sign, screen, lamp, light, lift,
    block, free, thing, seat, use, sfx, music, bed, own, focus, unfocus, walkTo, loot,
    /** Is the camera holding a fixed shot (see focus)? */
    get focused() { return !!shot; },
    /** Is the person hurrying (Shift held)? */
    get hurrying() { return held.has('Shift'); },
    /** Run fn(dt, t) every frame while the level is open. */
    onFrame(fn) { frames.push(fn); return () => { const i = frames.indexOf(fn); if (i >= 0) frames.splice(i, 1); }; },
    /** Listen to the daemon (office.net events: 'agent', 'prompts', 'tasks', 'activity', 'fx', …) until the level closes. */
    on(event, fn) { const off = net.on(event, fn); subs.push(off); return off; },
    /** Keys the kit does not use itself: fn(key, event). */
    onKey(fn) { keyFns.push(fn); },
    /** A click on nothing in particular: fn(event). */
    onClick(fn) { clickFns.push(fn); },
    /** Hand the keyboard to something of your own (a game, a dialog) for as long as the promise takes. */
    async hold(promise) { modal++; held.clear(); try { return await promise; } finally { modal--; } },
    run, leave,
  };
  return api;
}

export { HOME, RADIUS };
