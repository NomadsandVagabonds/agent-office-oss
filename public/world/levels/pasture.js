// P · The Pasture — where the car park would be. A very large, windowless
// office room: white wall panels, a low grid ceiling of light panels going
// off into the distance — and, wall to wall, a meadow. Hills you can walk
// over, scrub, a herd of small goats getting on with it, and on the far
// hilltop a large dark one that does nothing but watch. Nobody explains it.
//
// Things to do: pet a goat (E), rattle the feed bucket, read the headcount on
// the clipboard (it is one short — the one it misses is somewhere), try the
// very small door. Agents can come down here too (`office use lift pasture`,
// see server/world/text.mjs): whoever has is standing in the grass.
//
// What is hidden here (core/game.mjs): the bucket gives you three handfuls,
// and a goat you feed leaves something behind a little later. What is in it
// is for whoever looks: a coin in the first; and by the third goat, the
// keycard one of them ate (LANYARDS MUST BE WORN AT ALL TIMES). A second coin
// lies behind the one on the hill, and the very small door gives up a third
// to anybody who keeps trying it.
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { WALLS, canvasTexture } from '../scene/textures.js';
import { Avatar } from '../avatar/rig.js';
import { Vox, M, glow, tone, noise3, VOXEL } from '../vox/vox.js';
import { meshVox } from '../vox/mesher.js';
import { voxelMaterial } from '../vox/material.js';
import { resolveLook, hashId } from '/core/look.mjs';
import { floorOfPlacement } from '/core/levels.mjs';

const ROOM = { x0: -22, z0: -16, x1: 22, z1: 16, h: 4.6 };
const DOOR = { x: ROOM.x0, z: 6 };                    // the lift, in the west wall
const HERD = 20;                                      // what the clipboard says. There is one more.
const TAU = Math.PI * 2;
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const turnTo = (from, to) => { let d = (to - from) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

/* ---- the lie of the land ------------------------------------------------------------------------ */
// [x, z, height, radius] — the first is the hill the big one sits on
const HILLS = [[6, -7, 2.3, 7], [-9, -4, 1.3, 6], [15, 3, 1.1, 5.5], [-2, 9, 0.7, 5], [-16, -10, 1.0, 5], [17, -10, 0.9, 5], [-14, 12, 0.6, 4.5]];
/** How high the grass is at (x, z). Level in front of the lift; the walk, the goats and the mesh all ask this. */
export function ground(x, z) {
  let y = 0.07 * (Math.sin(x * 0.7 + 1.3) * Math.cos(z * 0.9) + 1);
  for (const [hx, hz, hh, r] of HILLS) {
    const d = ((x - hx) ** 2 + (z - hz) ** 2) / (r * r);
    if (d < 4) y += hh * Math.exp(-d * 2.4);
  }
  return y * smooth((Math.hypot(x - DOOR.x, z - DOOR.z) - 2.4) / 3.5);
}

/* ---- surfaces -------------------------------------------------------------------------------------- */
const meadow = () => canvasTexture(80, 80, (g, w, h) => {
  const r = rng(9);
  g.fillStyle = '#5a9645'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1100; i++) {
    g.fillStyle = ['#63a24c', '#528b3f', '#69a850', '#578f43', '#5f9d49'][Math.floor(r() * 5)];
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1 + Math.floor(r() * 2));
  }
  for (let i = 0; i < 5; i++) { g.fillStyle = r() < 0.5 ? '#e6dc98' : '#eef0e4'; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1); }     // the odd daisy
});
/** White wall panels: a seam every 1.2 m, a reveal two thirds of the way up, a grey skirting. */
const panels = () => ({ tile: 2.4, tex: canvasTexture(96, 104, (g, w, h) => {
  const r = rng(4);
  g.fillStyle = '#e9e8e1'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.035)'; g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 1); }
  g.fillStyle = '#c4c3bb'; g.fillRect(0, 0, 1, h); g.fillRect(48, 0, 1, h); g.fillRect(0, 34, w, 1);
  g.fillStyle = '#f6f5f0'; g.fillRect(1, 0, 1, h); g.fillRect(49, 0, 1, h);
  g.fillStyle = '#9b9a93'; g.fillRect(0, h - 4, w, 4); g.fillStyle = '#b4b3ab'; g.fillRect(0, h - 4, w, 1);
}) });
/** A suspended ceiling: 60 cm tiles on a grid, a light panel here and there. Returns [what it looks like, what glows]. */
function ceilingTextures() {
  const lit = (x, y) => (x === 1 && y === 0) || (x === 3 && y === 2);
  const tiles = canvasTexture(96, 96, (g) => {
    const r = rng(6);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = lit(x, y) ? '#f4f8ff' : '#d9d8d0'; g.fillRect(x * 24, y * 24, 24, 24);
      if (!lit(x, y)) for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x * 24 + 2 + Math.floor(r() * 20), y * 24 + 2 + Math.floor(r() * 20), 1, 1); }
      else { g.fillStyle = 'rgba(190,205,225,.5)'; for (let i = 4; i < 24; i += 5) g.fillRect(x * 24 + i, y * 24 + 2, 1, 20); }
    }
    g.fillStyle = '#a9a8a0'; for (let i = 0; i < 4; i++) { g.fillRect(i * 24, 0, 1, 96); g.fillRect(0, i * 24, 96, 1); }
  });
  const lights = canvasTexture(96, 96, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#fff'; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (lit(x, y)) g.fillRect(x * 24 + 2, y * 24 + 2, 21, 21);
  });
  return [tiles, lights];
}

/* ---- goats, sculpted --------------------------------------------------------------------------------- */
const COATS = {
  white: { base: '#efe9dc', under: '#f7f3ea', patch: null },
  tan: { base: '#b58a58', under: '#e6d6b8', patch: null },
  patched: { base: '#efe9dc', under: '#f7f3ea', patch: '#2b2730' },
};
/** Where each moving part hinges, in voxels: the neck at the shoulders, each pair of legs at the hip. */
const JOINT = { head: [0, 13, 6], front: [0, 8, 5], hind: [0, 8, -5] };
/**
 * A small goat in four pieces — body, head-and-neck, front legs, hind legs — facing +z, standing on y = 0.
 * 8 × 23 × 26 with its head up. coat: white | tan | patched · kid: no horns, no beard · lanyard: it has been issued one.
 */
function goat({ coat = 'white', kid = false, lanyard = false, seed = 1 } = {}) {
  const c = COATS[coat], base = M(c.base, 3), under = M(c.under, 3), patch = c.patch ? M(c.patch, 3) : null;
  const fur = (x, y, z) => (patch && noise3(Math.floor((x + 24) / 4), Math.floor(y / 5), Math.floor((z + 24) / 5), seed) > 0.56 ? patch : y < 9 ? under : base);
  const hoof = M('#3a332c', 0), k = M('#241f22', 0), horn = M('#cdbf9f', 1);
  const body = new Vox(), head = new Vox(), front = new Vox(), hind = new Vox();
  body.rbox(-4, 7, -7, 4, 15, 7, 3, fur);
  body.box(-1, 14, -9, 1, 16, -7, fur); body.box(-1, 16, -9, 1, 18, -8, fur);                // a tail that stands up
  if (lanyard) {
    const strap = M('#e8743a', 0);
    body.box(-4, 15, 4, 4, 16, 6, strap); body.box(-4, 11, 5, -3, 15, 6, strap); body.box(3, 11, 5, 4, 15, 6, strap);
    body.box(-1, 10, 7, 1, 15, 8, strap);
    body.box(-2, 6, 7, 2, 10, 8, M('#f7f3ea', 0)); body.box(-1, 8, 8, 0, 9, 9, M('#3f7f9a', 0)); body.set(0, 7, 8, k); body.set(1, 7, 8, k);     // the pass: a photo, a name
  }
  for (const [part, z] of [[front, 4], [hind, -6]]) for (const x of [-4, 2]) {
    part.box(x, 0, z, x + 2, 9, z + 2, fur); part.paint(x, 0, z, x + 2, 1, z + 2, hoof);
  }
  head.tube(0, 13, 6, 0, 19, 9, 2.4, fur);
  head.rbox(-3, 17, 8, 3, 23, 14, 2, fur);
  head.rbox(-2, 16, 12, 2, 20, 17, 1, under);
  head.box(-1, 18, 16, 1, 19, 17, M('#4a3a3a', 0));
  head.set(-3, 21, 12, k); head.set(2, 21, 12, k);
  for (const s of [-1, 1]) { head.box(s > 0 ? 3 : -6, 20, 9, s > 0 ? 6 : -3, 21, 12, fur); head.box(s > 0 ? 5 : -6, 19, 9, s > 0 ? 6 : -5, 20, 12, fur); }     // ears, out to the side
  if (!kid) {
    for (const x of [-2, 1]) { head.box(x, 23, 9, x + 1, 25, 10, horn); head.box(x, 25, 8, x + 1, 27, 9, horn); }
    head.box(-1, 13, 13, 1, 16, 14, under);                                                 // a beard
  }
  return { body, head, front, hind };
}
/** The one on the hill: twice the goat, dark, lying down, horns that sweep back like a ram's. In two pieces, body and head. */
function elder() {
  const coat = M('#2a2420', 3), shag = M('#3b332d', 3), horn = M('#8a7a62', 1), hornD = M('#5f5343', 1), k = M('#16131a', 0);
  const fur = (x, y, z) => (noise3(x >> 1, y >> 2, z >> 1, 5) > 0.62 ? shag : coat);
  const body = new Vox(), head = new Vox();
  body.rbox(-6, 0, -11, 6, 12, 7, 4, fur);                                                   // lying, legs folded under
  body.rbox(-5, 3, 1, 5, 15, 9, 3, fur);
  for (const x of [-5, 2]) { body.box(x, 0, 6, x + 3, 3, 13, fur); body.paint(x, 0, 12, x + 3, 2, 13, k); }
  body.box(-1, 10, -13, 1, 13, -11, fur);
  head.tube(0, 13, 6, 0, 23, 9, 3.4, fur);
  head.rbox(-4, 21, 7, 4, 30, 15, 2, fur);
  head.rbox(-3, 20, 13, 3, 25, 19, 1, shag);
  head.box(-1, 23, 18, 1, 24, 19, k);
  head.box(-1, 11, 14, 1, 21, 16, shag); head.box(-1, 9, 14, 1, 11, 15, shag);                // the beard
  head.set(-4, 27, 12, glow('#ffc24a')); head.set(3, 27, 12, glow('#ffc24a'));               // it is looking at you
  for (const s of [-1, 1]) {
    head.box(s > 0 ? 4 : -7, 25, 8, s > 0 ? 7 : -4, 26, 11, fur);
    const path = [[2, 30, 9, 1.9], [4, 37, 6, 1.8], [7, 42, 0, 1.6], [9, 42, -7, 1.4], [9, 38, -12, 1.1], [7, 33, -13, 0.8]];
    for (let i = 1; i < path.length; i++) {
      const [ax, ay, az, ar] = path[i - 1], [bx, by, bz] = path[i];
      head.tube(s * ax, ay, az, s * bx, by, bz, ar, (x, y, z) => ((x + y + z) % 4 === 0 ? hornD : horn));
    }
  }
  return { body, head };
}
function bush(seed = 1) {
  const v = new Vox(), r = rng(seed * 31 + 7);
  const leaf = M('#3f6f3a', 2), leafL = M('#5a8f46', 2), leafD = M('#2f5530', 2), twig = M('#6b4a2f', 2);
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU, d = r() * 9, rad = 6 + r() * 6;
    v.ellipsoid(Math.round(Math.cos(a) * d), Math.round(rad * 0.7 + r() * 4), Math.round(Math.sin(a) * d), rad, rad * 0.75, rad, [leaf, leafD, leafL][i % 3]);
  }
  for (let i = 0; i < 5; i++) { const a = r() * TAU; v.tube(0, 2, 0, Math.cos(a) * 12, 16 + r() * 8, Math.sin(a) * 12, 0.7, twig); }
  return v;
}
function bucket() {
  const v = new Vox(), blue = M('#3f7f9a', 0);
  v.cyl('y', 0, 0, 0, 12, 5, blue, 6.4);
  v.cyl('y', 0, 0, 11, 12, 5.4, 0, 5.4); v.cyl('y', 0, 0, 10, 11, 5.2, M('#c9a86a', 3));     // feed
  v.cyl('y', 0, 0, 11, 12, 6.4, tone(blue, 0.2)); v.cyl('y', 0, 0, 11, 12, 5.6, 0); v.cyl('y', 0, 0, 10, 12, 5.2, M('#c9a86a', 3));
  for (let i = 0; i < 9; i++) { const a = i * 0.39 - 1.57; v.set(Math.round(Math.sin(a) * 7), Math.round(11 + Math.cos(a) * 5), 0, M('#8a8f96', 0)); }      // the handle
  return v;
}
function saltLick() {
  const v = new Vox(), wood = M('#8f5f38', 2);
  v.box(-2, 0, -2, 2, 22, 2, wood); v.box(-4, 20, -4, 4, 22, 4, tone(wood, -0.2));
  v.rbox(-4, 22, -4, 4, 29, 4, 2, M('#f0d2cc', 1)); v.carve(-1, 27, -4, 3, 29, 1);          // licked into a hollow
  return v;
}
/** A post with a clipboard on it; the page is laid over it by the scene. */
function clipboardPost() {
  const v = new Vox(), wood = M('#8f5f38', 2);
  v.box(-2, 0, -2, 2, 40, 2, wood);
  v.box(-8, 30, 2, 8, 52, 4, M('#7a5836', 1)); v.box(-3, 50, 3, 3, 53, 5, M('#9aa3b0', 0));
  return v;
}
const PAGE = Object.freeze({ x: 0, y: 40, z: 4.08, w: 14, h: 18 });
/** A door for somebody much smaller, and the sign over it. Hangs on a wall: back at z = 0. 14 × 30 × 2. */
function smallDoor() {
  const v = new Vox(), frame = M('#b9b8b0', 0), leaf = M('#7d8ea0', 1);
  v.box(-7, 0, 0, 7, 22, 1, frame);
  v.box(-5, 0, 0, 5, 20, 2, leaf); v.paint(-5, 0, 1, 5, 3, 2, tone(leaf, -0.25));
  v.paint(-3, 6, 1, 3, 17, 2, tone(leaf, 0.12));
  v.set(3, 10, 2, M('#c9a24a', 0));
  v.box(-5, 25, 0, 5, 30, 1, M('#23303a', 0)); v.paint(-4, 26, 0, 4, 29, 1, glow('#3fd68a'));
  return v;
}
/** A square hatch low in the wall, with a rubber flap. Hangs on a wall. 24 × 24 × 2. */
function hatch() {
  const v = new Vox(), frame = M('#9aa3b0', 0);
  v.box(-12, 0, 0, 12, 24, 2, frame);
  v.carve(-10, 2, 1, 10, 22, 2); v.paint(-10, 2, 0, 10, 22, 1, M('#101216', 0));
  v.box(-10, 13, 1, 10, 22, 2, M('#3a3f4a', 0));                                              // the flap, half lifted
  for (const x of [-11, 10]) for (const y of [1, 22]) v.set(x, y, 1, tone(frame, -0.3));
  return v;
}
/** What a goat leaves behind: a few pellets — and, once, the corner of something it should not have eaten. 9 × 6 × 9. */
function droppings(card = false) {
  const v = new Vox(), dark = M('#3b2c1e', 1), mid = tone(dark, 0.14);
  [[0, 0, 2.2], [3, 1, 1.7], [-3, 1, 1.6], [1, -3, 1.6], [-2, -2, 1.5], [0, 2, 1.4], [2, -1, 1.3]].forEach(([x, z, r], i) => v.sphere(x, Math.round(r * 0.8), z, r, i % 2 ? mid : dark));
  if (card) { const cream = M('#f3eedd', 0); v.box(-1, 2, -1, 4, 6, 0, cream); v.box(-1, 5, -1, 4, 6, 0, glow('#3f8fd0')); v.box(3, 2, -1, 4, 6, 0, tone(cream, -0.18)); }
  return v;
}
function heart() {
  const v = new Vox(), c = M('#ff7a9a', 0);
  for (const [y, x0, x1] of [[5, -3, -1], [5, 1, 3], [4, -4, 4], [3, -4, 4], [2, -3, 3], [1, -2, 2], [0, -1, 1]]) v.box(x0, y, 0, x1, y + 1, 1, c);
  return v;
}

export async function enter(office) {
  const net = office.net;
  const w = createWorld(office, {
    id: 'pasture', bounds: ROOM, floorY: ground, background: '#e4e6de', far: 300, shadows: 20,
    fog: { color: '#e4e6de', near: 26, far: 105 },
    camera: { fov: 50, yaw: 1.0, pitch: 0.09, dist: 7.5, minPitch: -0.04, maxPitch: 0.5, minDist: 3, maxDist: 12, height: 1.05,
      ceiling: ROOM.h - 0.35, inside: { x0: ROOM.x0 + 0.5, z0: ROOM.z0 + 0.5, x1: ROOM.x1 - 0.5, z1: ROOM.z1 - 0.5 } },
    grade: { tilt: 0.1, bloom: 0.3, glow: 1.5 },
  });
  const { scene } = w;
  const R = rng(1113);
  // office light: flat, from everywhere above, and green coming back up off the grass
  w.light({ sky: '#f6f8ff', ground: '#c2d6b0', hemi: 2.0, sun: '#ffffff', power: 0.95, dir: [0.1, 1, 0.07] });

  /* ---- the room ------------------------------------------------------------------------------------ */
  const panel = panels();
  w.own(panel.tex);
  w.room({ ...ROOM, wall: panel, lift: { side: 'W', at: DOOR.z }, shaft: WALLS.steel() });
  const grass = w.own(meadow());
  const land = w.own(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0, 110, 80));
  land.rotateX(-Math.PI / 2);
  {
    const pos = land.attributes.position, uv = land.attributes.uv, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = ground(x, z);
      pos.setY(i, y);
      uv.setXY(i, x / 2, -z / 2);
      const k = 0.86 + 0.22 * noise3(Math.round(x * 0.6), 3, Math.round(z * 0.6), 2) + Math.min(0.16, y * 0.07);      // patchy, paler up top
      col[i * 3] = k * 1.02; col[i * 3 + 1] = k; col[i * 3 + 2] = k * 0.92;
    }
    land.setAttribute('color', new THREE.BufferAttribute(col, 3));
    land.computeVertexNormals();
  }
  const field = new THREE.Mesh(land, w.own(new THREE.MeshLambertMaterial({ map: grass, vertexColors: true })));
  field.receiveShadow = true;
  scene.add(field);
  const [tiles, lights] = ceilingTextures().map((t) => w.own(t));
  for (const t of [tiles, lights]) t.repeat.set((ROOM.x1 - ROOM.x0) / 2.4, (ROOM.z1 - ROOM.z0) / 2.4);
  const ceiling = new THREE.Mesh(w.own(new THREE.PlaneGeometry(ROOM.x1 - ROOM.x0, ROOM.z1 - ROOM.z0)),
    w.own(new THREE.MeshLambertMaterial({ map: tiles, emissiveMap: lights, emissive: '#ffffff', emissiveIntensity: 1.25 })));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = ROOM.h;
  scene.add(ceiling);

  /* ---- signs: all the explanation there is ----------------------------------------------------------- */
  const board = { bg: '#f1f0ea', fg: '#3a3f4a' };
  w.add(w.sign('P · PASTURE', { height: 0.34, ...board, accent: '#5c9a46' }), ROOM.x0 + 0.012, DOOR.z - 2.45, 'E', 2.0);
  w.add(w.sign('formerly parking', { height: 0.16, ...board }), ROOM.x0 + 0.012, DOOR.z - 2.45, 'E', 1.68);
  w.add(w.sign('LANYARDS MUST BE WORN AT ALL TIMES', { height: 0.42, ...board, accent: '#e8743a' }), 1.5, ROOM.z0 + 0.012, 'S', 3.1);
  w.add(w.sign('PLEASE DO NOT BRIEF THE GOATS', { height: 0.3, ...board }), ROOM.x1 - 0.012, 4, 'W', 2.6);

  /* ---- scrub, and the few things people have left down here -------------------------------------------- */
  const BUSHES = [[-13, 0.5], [-6, -9.5], [3.4, 2.6], [11, 9.5], [-1, -13.4], [18.5, 6.5], [10.9, -12.3], [-18.2, -13.2], [0.5, 12.8], [19.5, -3]];
  BUSHES.forEach(([x, z], i) => { w.vox(() => bush(i + 1), x, z, i * 1.3); w.block(x, z, 0.55); });
  const pail = w.vox(bucket, -19.4, 3.3, 0.4); w.block(-19.4, 3.3, 0.2);
  w.vox(saltLick, -7.4, 6.6, 0); w.block(-7.4, 6.6, 0.15);
  const post = w.vox(clipboardPost, -19.6, 8.9, 0.9); w.block(-19.6, 8.9, 0.12);
  const little = w.vox(smallDoor, -4, ROOM.z0 + 0.012, 'S');
  w.vox(hatch, 10, ROOM.z0 + 0.012, 'S', { y: 0.1 }); w.vox(hatch, 13.6, ROOM.z0 + 0.012, 'S', { y: 0.1 });

  // the headcount: a page on the clipboard, written on by hand
  let found = !!(net.state.world?.discoveries || {}).headcount;
  const page = w.screen(PAGE.w * VOXEL, PAGE.h * VOXEL, (g, cw, ch) => {
    g.fillStyle = '#f7f4ea'; g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#2a3a6a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(ch * 0.085)}px ui-monospace, Menlo, Consolas, monospace`; g.fillText('HEADCOUNT', cw / 2, ch * 0.11);
    g.fillStyle = '#c4c0b2'; g.fillRect(cw * 0.1, ch * 0.18, cw * 0.8, 2);
    g.strokeStyle = '#2a3a6a'; g.lineWidth = Math.max(2, cw * 0.012);
    for (let i = 0; i < HERD; i++) {                                                             // five-bar gates
      const gate = Math.floor(i / 5), n = i % 5, gx = cw * (0.16 + (gate % 2) * 0.4), gy = ch * (0.27 + Math.floor(gate / 2) * 0.17);
      g.beginPath();
      if (n < 4) { g.moveTo(gx + n * cw * 0.055, gy); g.lineTo(gx + n * cw * 0.055 + 2, gy + ch * 0.11); } else { g.moveTo(gx - cw * 0.03, gy + ch * 0.09); g.lineTo(gx + cw * 0.21, gy + ch * 0.02); }
      g.stroke();
    }
    g.fillStyle = '#2a3a6a'; g.font = `700 ${Math.round(ch * 0.2)}px ui-monospace, Menlo, Consolas, monospace`; g.fillText(String(HERD), cw / 2, ch * 0.72);
    g.font = `italic ${Math.round(ch * 0.06)}px Georgia, serif`; g.fillStyle = '#5a6a9a'; g.fillText('counted twice', cw / 2, ch * 0.88);
    if (found) { g.fillStyle = '#b5483f'; g.font = `italic 700 ${Math.round(ch * 0.1)}px Georgia, serif`; g.save(); g.translate(cw * 0.78, ch * 0.66); g.rotate(-0.2); g.fillText(`${HERD + 1}?`, 0, 0); g.restore(); }
  }, { ppm: 1100, gain: 0.82 });
  page.mesh.position.set(PAGE.x, PAGE.y, PAGE.z);
  page.mesh.scale.setScalar(1 / VOXEL);
  post.children[0].add(page.mesh);                                                                // the post's own group is in voxel units
  w.thing({ x: -19.6, z: 8.9, label: 'the headcount', object: post, reach: 1.4,
    use() {
      const a = post.rotation.y, y = ground(-19.6, 8.9);
      w.focus([-19.6 + Math.sin(a) * 1.15, y + 1.05, 8.9 + Math.cos(a) * 1.15], [-19.6, y + 1.0, 8.9], { fov: 34, alone: true });
    } });
  let rattle = 0, jiggle = 0;
  /* what is hidden down here (core/game.mjs): see the top of this file */
  let feed = 0, fed = 0, tries = 0, cardLeft = false;
  const piles = [];
  w.thing({ x: -19.4, z: 3.3, label: 'the feed bucket', object: pail, reach: 1.3, use() { rattle = 8; jiggle = 0.6; call(3); feed = 3; } });
  w.thing({ x: -4, z: ROOM.z0 + 0.5, label: 'a very small door', object: little, reach: 1.3,
    use() {
      little.userData.shake = 0.5;
      if (++tries === 3) w.loot({ item: 'coin', n: 3, x: -4, z: ROOM.z0 + 0.95 });       // somebody on the other side has had enough
    } });
  w.loot({ item: 'coin', n: 2, x: HILLS[0][0] + 1.2, z: HILLS[0][1] - 0.55 });           // behind the one on the hill, where the door cannot see

  /* ---- the herd ---------------------------------------------------------------------------------------- */
  const flesh = voxelMaterial();
  const kits = new Map();                                // one set of meshes per kind of goat; every goat of that kind shares it
  function partsFor(spec) {
    const key = `${spec.coat}|${spec.kid ? 1 : 0}|${spec.lanyard ? 1 : 0}|${spec.seed}`;
    if (!kits.has(key)) {
      const v = goat(spec), geo = {};
      for (const name of ['body', 'head', 'front', 'hind']) geo[name] = w.own(meshVox(v[name], { origin: JOINT[name] || [0, 0, 0] }).solid);
      kits.set(key, geo);
    }
    return kits.get(key);
  }
  const part = (geo, at, parent) => {
    const hinge = new THREE.Group();
    hinge.position.set(...at);
    const mesh = new THREE.Mesh(geo, flesh);
    mesh.castShadow = true; mesh.receiveShadow = true;
    hinge.add(mesh); parent.add(hinge);
    return hinge;
  };
  const goats = [];
  function addGoat(spec, x, z, home) {
    const geo = partsFor(spec), size = spec.kid ? 0.62 : 0.92 + R() * 0.16;
    const root = new THREE.Group(), figure = new THREE.Group();
    figure.scale.setScalar(VOXEL * size);
    root.add(figure);
    part(geo.body, [0, 0, 0], figure);
    const g = { ...spec, root, figure, size, x, z, home, heading: R() * TAU, state: 'graze', t: 1 + R() * 6, speed: 0, phase: R() * 6, nod: 1, look: 0, tx: x, tz: z,
      head: part(geo.head, JOINT.head, figure), front: part(geo.front, JOINT.front, figure), hind: part(geo.hind, JOINT.hind, figure),
      friendly: false, hop: 0 };
    if (spec.kid) g.head.scale.setScalar(1.18);
    scene.add(root);
    g.thing = w.thing({ x, z, label: spec.lanyard ? 'a goat with a lanyard' : spec.kid ? 'a kid' : 'a goat', reach: 1.2, hidden: () => g.state === 'trot' || g.state === 'hide',
      use: () => (feed > 0 && !g.fed ? give(g) : pet(g)) });
    goats.push(g);
    return g;
  }
  const HOMES = [{ x: -10, z: 3.5, r: 6 }, { x: 8.5, z: 6, r: 5.5 }, { x: -13, z: -8, r: 4.5 }, { x: 14, z: -3, r: 4.5 }];
  const ROSTER = ['white', 'tan', 'patched', 'white', 'tan', 'white', 'patched', 'tan', 'white', 'patched', 'tan', 'white', 'patched', 'white', 'tan', 'patched'];
  ROSTER.forEach((coat, i) => {
    const home = HOMES[i < 7 ? 0 : i < 12 ? 1 : i < 14 ? 2 : 3], a = R() * TAU, d = Math.sqrt(R()) * home.r;
    addGoat({ coat, kid: false, lanyard: i === 4, seed: 1 + (i % 3) }, home.x + Math.cos(a) * d, home.z + Math.sin(a) * d, home);
  });
  ['white', 'tan', 'patched', 'white'].forEach((coat, i) => {
    const home = HOMES[i % 2], a = R() * TAU;
    addGoat({ coat, kid: true, lanyard: false, seed: 4 }, home.x + Math.cos(a) * 2.5, home.z + Math.sin(a) * 2.5, home);
  });
  for (const i of [1, 5, 8, 12, 17]) goats[i].friendly = true;                               // these ones come over, if you give them a minute
  // …and the one the clipboard does not know about, keeping out of sight behind the big hill
  const stray = addGoat({ coat: 'patched', kid: true, lanyard: false, seed: 4 }, 10.2, -13.1, HOMES[3]);
  stray.state = found ? 'graze' : 'hide'; stray.heading = -2.2;

  // the one on the hill
  const HILL = { x: HILLS[0][0], z: HILLS[0][1] };
  const old = (() => {
    const v = elder(), root = new THREE.Group(), figure = new THREE.Group();
    figure.scale.setScalar(VOXEL * 1.55);
    root.add(figure);
    for (const m of [meshVox(v.body).solid]) { const mesh = new THREE.Mesh(w.own(m), flesh); mesh.castShadow = true; figure.add(mesh); }
    const head = part(w.own(meshVox(v.head, { origin: JOINT.head }).solid), JOINT.head, figure);
    root.position.set(HILL.x, ground(HILL.x, HILL.z) - 0.02, HILL.z);
    scene.add(root);
    w.block(HILL.x, HILL.z, 0.55);
    return { root, head, heading: Math.atan2(DOOR.x - HILL.x, DOOR.z - HILL.z), turn: 0 };
  })();

  const heartGeo = w.own(meshVox(heart()).solid);
  const hearts = [];
  function love(x, y, z) {
    const m = new THREE.Mesh(heartGeo, flesh);
    m.scale.setScalar(VOXEL * 1.6); m.position.set(x, y, z);
    scene.add(m); hearts.push({ m, t: 0 });
  }
  const bleat = (volume = 0.6) => w.sfx(`goat-${1 + Math.floor(Math.random() * 3)}`, { volume });
  function pet(g) {
    g.state = 'pet'; g.t = 2.4; g.hop = 1;
    love(g.x, ground(g.x, g.z) + 0.75 * g.size, g.z);
    bleat(0.7);
  }
  /** A handful from the bucket: it eats, it is pleased, and in a little while it will have left something. */
  function give(g) {
    feed--; fed++;
    g.fed = fed; g.state = 'eat'; g.t = 2.8; g.hop = 1;
    g.leaveAt = w.time + 6 + R() * 4;
    love(g.x, ground(g.x, g.z) + 0.75 * g.size, g.z);
    bleat(0.75);
  }
  /** It stops, it thinks about something else, it walks on. What it left can be looked through (E). */
  function leave(g) {
    g.leaveAt = 0; g.hop = 1;
    const still = office.game?.left('pasture') || { card: false, coins: [] };
    const x = g.x - Math.sin(g.heading) * 0.42 * g.size, z = g.z - Math.cos(g.heading) * 0.42 * g.size;
    // the first goat fed leaves a coin; by the third, the card that one of them ate has worked its way through
    const holds = g.fed >= 3 && still.card && !cardLeft ? 'card' : g.fed === 1 && still.coins.includes(1) ? 'coin' : null;
    if (holds === 'card') cardLeft = true;
    const pile = { x, z, holds, done: false, squash: 0, node: w.vox(() => droppings(holds === 'card'), x, z, R() * TAU) };
    pile.thing = w.thing({ x, z, label: 'what the goat left', object: pile.node, reach: 1.0, hidden: () => pile.done,
      use() {
        pile.done = true; pile.squash = 0.35;
        w.sfx('sticky');
        if (pile.holds) w.loot({ item: pile.holds, n: 1, x: pile.x, z: pile.z, reach: 0 })?.take();
      } });
    piles.push(pile);
  }
  /** Some of them answer: n goats nearby look up and say so. */
  function call(n) {
    for (let i = 0; i < n; i++) setTimeout(() => bleat(0.45), 250 + i * 520 + Math.random() * 300);
  }
  function choose(g) {
    const k = R();
    if (k < 0.52) { g.state = 'graze'; g.t = 3 + R() * 7; } else if (k < 0.7) { g.state = 'look'; g.t = 1.4 + R() * 2.4; g.look = (R() - 0.5) * 1.6; } else {
      const lick = R() < 0.1, a = R() * TAU, d = Math.sqrt(R()) * g.home.r;
      g.state = 'wander'; g.t = 14;
      g.tx = lick ? -7.4 + (R() - 0.5) : g.home.x + Math.cos(a) * d; g.tz = lick ? 7.3 + R() * 0.5 : g.home.z + Math.sin(a) * d;
    }
  }

  /* ---- colleagues who took the lift down (agents: `office use lift pasture`) ------------------------------ */
  const guests = new Map();
  function syncGuests() {
    const here = new Set();
    for (const [id, place] of net.state.places) {
      const agent = net.state.agents.get(id);
      // where they stand in the car says which button they pressed (core/levels.mjs): this floor's
      if (!agent || floorOfPlacement(place)?.id !== 'pasture' || net.now() < place.eta) continue;
      here.add(id);
      if (guests.has(id)) continue;
      const h = hashId(id), x = -17.5 + (h % 5) * 1.25, z = 2.2 + ((h >>> 4) % 6) * 1.2;
      const avatar = new Avatar(agent.profile?.character || resolveLook(agent.persona || agent.id), { seed: agent.persona || agent.id, provider: agent.provider || 'unknown' });
      avatar.root.position.set(x, ground(x, z), z);
      avatar.root.rotation.y = 0.9 + (h % 7) * 0.3;
      scene.add(avatar.root);
      const guest = { id, avatar, x, z, wave: 0 };
      guest.thing = w.thing({ x, z, label: `${agent.name} (${agent.provider || 'agent'})`, reach: 1.3, use() { guest.wave = 2.6; avatar.setPose('wave'); avatar.setExpression('happy'); } });
      guests.set(id, guest);
    }
    for (const [id, guest] of guests) {
      if (here.has(id)) continue;
      scene.remove(guest.avatar.root); guest.avatar.dispose(); guest.thing.hidden = () => true;
      guests.delete(id);
    }
  }
  for (const event of ['place', 'remove', 'world']) w.on(event, syncGuests);
  w.on('fx', (fx) => {                                           // an agent petted one (text.mjs says so)
    if (fx.kind !== 'goat') return;
    const guest = guests.get(fx.by);
    if (!guest) return;
    guest.wave = 2.2; guest.avatar.setPose('bow'); guest.avatar.setExpression('happy');
    love(guest.x + 0.4, ground(guest.x, guest.z) + 0.9, guest.z + 0.3);
    bleat(0.5);
  });
  w.on('discovery', (m) => { if (m?.secret?.id === 'headcount' && !found) { found = true; page.redraw(); } });

  /* ---- every frame ------------------------------------------------------------------------------------------ */
  let idle = 0, nextBleat = 5, guestsAt = 0;
  const me = w.me;
  w.onFrame((dt, t) => {
    idle = me.moving ? 0 : idle + dt;
    rattle = Math.max(0, rattle - dt);
    if (jiggle > 0) { jiggle = Math.max(0, jiggle - dt); pail.rotation.z = Math.sin(t * 40) * 0.16 * (jiggle / 0.6); }
    if (little.userData.shake > 0) { little.userData.shake -= dt; little.position.x = -4 + Math.sin(t * 60) * 0.006 * Math.max(0, little.userData.shake * 2); }
    if (t > nextBleat) { nextBleat = t + 7 + Math.random() * 11; bleat(0.28); }
    if (t - guestsAt > 2) { guestsAt = t; syncGuests(); }
    const hurrying = me.moving && w.hurrying;

    for (const g of goats) {
      const dx = me.x - g.x, dz = me.z - g.z, dist = Math.hypot(dx, dz) || 1e-3;
      g.t -= dt;
      if (g.state === 'hide') {                                  // found: it gives itself up and goes to join the others
        if (dist < 2.3) {
          g.state = 'trot'; g.t = 2.2; g.tx = g.x - dx / dist * 5; g.tz = g.z - dz / dist * 5 + 3; g.hop = 1;
          bleat(0.8);
          if (!found) {
            found = true; page.redraw();
            net.api('/api/world/discover', { method: 'POST', body: { secret: 'headcount', name: office.walk?.me?.name || 'Lead' } }).catch(() => null);
          }
        }
      } else if (g.state !== 'trot' && g.state !== 'pet' && g.state !== 'eat' && ((hurrying && dist < 4) || (me.moving && dist < 0.95 && !g.friendly))) {
        g.state = 'trot'; g.t = 1.2 + R() * 1.4;                 // too fast, too close: off it goes
        g.tx = g.x - (dx / dist) * 6 + (R() - 0.5) * 3; g.tz = g.z - (dz / dist) * 6 + (R() - 0.5) * 3;
        if (R() < 0.3) bleat(0.4);
      } else if ((g.state === 'graze' || g.state === 'look' || g.state === 'wander') && ((rattle > 0 && dist < 15) || (g.friendly && idle > 2.5 && dist < 9))) {
        g.state = 'follow'; g.t = rattle > 0 ? 8 + R() * 4 : 18;
      }
      let want = 0, nod = 0.1, face = null;
      if (g.state === 'graze') { nod = 1.05; if (g.t <= 0) choose(g); } else if (g.state === 'look') {
        nod = -0.2; face = dist < 8 ? Math.atan2(dx, dz) : g.heading + g.look;
        if (g.t <= 0) choose(g);
      } else if (g.state === 'pet') { nod = -0.35; face = Math.atan2(dx, dz); if (g.t <= 0) { g.state = 'look'; g.t = 2; } } else if (g.state === 'eat') {
        if (g.t <= 0) { g.state = 'look'; g.t = 2.5; }                                         // head down in your hand, and not to be hurried
      } else if (g.state === 'follow') {
        g.tx = me.x; g.tz = me.z; face = Math.atan2(dx, dz); nod = dist < 2 ? -0.3 : 0;
        want = dist > 1.35 ? (rattle > 0 ? 1.7 : 0.85) : 0;
        if (g.t <= 0 || dist > 16) choose(g);
      } else if (g.state === 'wander' || g.state === 'trot') {
        const ex = g.tx - g.x, ez = g.tz - g.z, left = Math.hypot(ex, ez);
        face = Math.atan2(ex, ez); want = g.state === 'trot' ? 2.5 : 0.55; nod = g.state === 'trot' ? -0.1 : 0.15;
        if (left < 0.3 || g.t <= 0) { g.state = g.state === 'trot' ? 'look' : 'graze'; g.t = 2 + R() * 4; want = 0; }
      }
      if (face !== null) g.heading += turnTo(g.heading, face) * (1 - Math.exp(-(want > 1 ? 9 : 4) * dt));
      g.speed += (want - g.speed) * (1 - Math.exp(-6 * dt));
      if (g.leaveAt && t > g.leaveAt && g.state !== 'eat' && g.state !== 'pet' && g.state !== 'trot') leave(g);
      if (g.speed > 0.02) {
        const nx = g.x + Math.sin(g.heading) * g.speed * dt, nz = g.z + Math.cos(g.heading) * g.speed * dt;
        if (w.free(nx, nz)) { g.x = nx; g.z = nz; } else if (g.state !== 'follow') { g.state = 'look'; g.t = 1; }
      }
    }
    // nobody stands in anybody: goats give way to each other, and to you
    for (let i = 0; i < goats.length; i++) {
      const a = goats[i];
      for (let j = i + 1; j < goats.length; j++) {
        const b = goats[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.36 * (a.size + b.size);
        if (d >= min || d < 1e-4) continue;
        const push = (min - d) / 2, ux = dx / d, uz = dz / d;
        if (a.state !== 'hide') { a.x -= ux * push; a.z -= uz * push; }
        if (b.state !== 'hide') { b.x += ux * push; b.z += uz * push; }
      }
      const dx = a.x - me.x, dz = a.z - me.z, d = Math.hypot(dx, dz);
      if (d < 0.62 && d > 1e-4 && a.state !== 'hide') { a.x = me.x + (dx / d) * 0.62; a.z = me.z + (dz / d) * 0.62; }
      const ox = a.x - HILL.x, oz = a.z - HILL.z, od = Math.hypot(ox, oz);
      if (od < 1.6 && od > 1e-4) { a.x = HILL.x + (ox / od) * 1.6; a.z = HILL.z + (oz / od) * 1.6; }       // nobody gets close to that one
      a.x = Math.max(ROOM.x0 + 0.6, Math.min(ROOM.x1 - 0.6, a.x)); a.z = Math.max(ROOM.z0 + 0.6, Math.min(ROOM.z1 - 0.6, a.z));
    }
    for (const g of goats) {
      const y = ground(g.x, g.z), ahead = ground(g.x + Math.sin(g.heading) * 0.3, g.z + Math.cos(g.heading) * 0.3);
      if (g.hop > 0) g.hop = Math.max(0, g.hop - dt * 2.4);
      g.root.position.set(g.x, y + Math.sin(g.hop * Math.PI) * 0.16, g.z);
      g.root.rotation.set(0, g.heading, 0);
      g.figure.rotation.x = -Math.atan2(ahead - y, 0.3) * 0.8;                                            // nose up the slope
      g.phase += dt * (4 + g.speed * 7);
      const stride = Math.min(1, g.speed / 0.5) * 0.55;
      g.front.rotation.x = Math.sin(g.phase) * stride; g.hind.rotation.x = -Math.sin(g.phase) * stride;
      const goalNod = g.state === 'graze' ? 1.05 + Math.sin(t * 5 + g.phase) * 0.05 : g.state === 'eat' ? 0.55 + Math.sin(t * 15) * 0.14
        : g.state === 'look' || g.state === 'pet' ? -0.25 : g.state === 'follow' ? -0.2 : 0.1;
      g.nod += (goalNod - g.nod) * (1 - Math.exp(-5 * dt));
      g.head.rotation.x = g.nod;
      g.thing.x = g.x; g.thing.z = g.z;
    }
    // it only ever watches
    const toMe = Math.atan2(me.x - HILL.x, me.z - HILL.z), off = turnTo(old.heading, toMe);
    if (Math.abs(off) > 0.9) old.heading += Math.sign(off) * Math.min(Math.abs(off) - 0.9, 0.35 * dt);
    old.turn += (turnTo(old.heading, toMe) - old.turn) * (1 - Math.exp(-2.2 * dt));
    old.root.rotation.y = old.heading;
    old.head.rotation.y = Math.max(-1.1, Math.min(1.1, old.turn));
    for (const guest of guests.values()) {
      if (guest.wave > 0) { guest.wave -= dt; if (guest.wave <= 0) { guest.avatar.setPose('stand'); guest.avatar.setExpression('neutral'); } }
      guest.avatar.update(dt);
    }
    for (const pile of piles) if (pile.squash > 0) { pile.squash = Math.max(0, pile.squash - dt); pile.node.scale.y = 0.45 + 0.55 * (pile.squash / 0.35); }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const hrt = hearts[i];
      hrt.t += dt / 1.3;
      hrt.m.position.y += dt * 0.55; hrt.m.rotation.y = w.cam.yaw;
      hrt.m.scale.setScalar(VOXEL * 1.6 * Math.sin(Math.min(1, hrt.t * 3) * Math.PI / 2) * (1 - Math.max(0, hrt.t - 0.6) / 0.4));
      if (hrt.t >= 1) { scene.remove(hrt.m); hearts.splice(i, 1); }
    }
  });

  syncGuests();
  w.goats = goats; w.piles = piles;                             // for the console, and for the curious
  w.bed('pasture-bed', { volume: 0.5 });
  return w.run();
}
