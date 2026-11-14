// R · Rooftop Garden — a level that is simply a place. Open air above the
// office: a deck, planters, a tree, benches, string lights, a telescope, the
// city all round, and a sky that keeps the office's clock.
//
// What is real up here: the hour (office.lighting.hour) and today's weather;
// the flue by the lift puffs when somebody downstairs makes coffee; and every
// note the agents pass each other crosses the sky as a paper plane. The rest
// is somewhere nice to sit. Nothing up here is explained: there are a few
// signs, and one note.
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { FLOORS, WALLS, canvasTexture } from '../scene/textures.js';
import { lookAt as lightAt } from '../scene/lighting.js';
import { buildDeskItem } from '../scene/deskitems.js';
import { Avatar } from '../avatar/rig.js';
import { Vox, M, glow, tone } from '../vox/vox.js';
import { telescope } from '../props/fun.js';
import { resolveLook } from '/core/look.mjs';
import { floorOfPlacement } from '/core/levels.mjs';

const DECK = { x0: -9, z0: -6.5, x1: 9, z1: 6.5 };
const STREET = -16;                          // how far down the street is
const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/* ---- the sky, by the hour -------------------------------------------------------------------- */
// top / mid / low: the colours from overhead down to the horizon · sun: the disc and its glow
// stars and lit (windows) run 0..1 · city: what colour far buildings fade to
const NIGHT = { top: '#070b24', mid: '#151b48', low: '#2f2c5c', sun: '#dfe6ff', glow: 0.3, stars: 1, lit: 0.8, cloud: '#2c2f58' };
const DAY = { top: '#3b86d0', mid: '#8cc2ec', low: '#d5e9f5', sun: '#fff6d8', glow: 0.55, stars: 0, lit: 0.02, cloud: '#ffffff' };
const SKY = [
  { h: 0, ...NIGHT }, { h: 5.2, ...NIGHT },
  { h: 6.6, top: '#27407f', mid: '#b9788f', low: '#ffb07a', sun: '#ffd9a0', glow: 1.0, stars: 0.06, lit: 0.35, cloud: '#ffc4a8' },
  { h: 8.6, ...DAY }, { h: 16.4, ...DAY },
  { h: 18.3, top: '#2b3a80', mid: '#c2617c', low: '#ffac5e', sun: '#ffcf8a', glow: 1.15, stars: 0.05, lit: 0.42, cloud: '#ff9f8a' },
  { h: 19.5, top: '#131a4c', mid: '#5a3a70', low: '#c9665a', sun: '#ffb070', glow: 0.7, stars: 0.55, lit: 0.7, cloud: '#6a4a78' },
  { h: 20.8, ...NIGHT }, { h: 24, ...NIGHT },
];
const SUNRISE = 6.2, SUNSET = 19.4;
function skyAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1].h <= h) i++;
  const a = SKY[i], b = SKY[i + 1], t = Math.max(0, Math.min(1, (h - a.h) / Math.max(1e-6, b.h - a.h)));
  const out = { h, night: h < SUNRISE || h >= SUNSET };
  for (const k of ['top', 'mid', 'low', 'sun', 'cloud']) out[k] = new THREE.Color(a[k]).lerp(new THREE.Color(b[k]), t);
  for (const k of ['glow', 'stars', 'lit']) out[k] = a[k] + (b[k] - a[k]) * t;
  // where the sun is (or, at night, the moon): up in the east, over the south, down in the west
  const day = out.night ? ((h - SUNSET + 24) % 24) / (24 - SUNSET + SUNRISE) : (h - SUNRISE) / (SUNSET - SUNRISE);
  const az = Math.PI * day, el = Math.sin(Math.PI * day) * (out.night ? 0.75 : 1.05) + 0.03;
  out.dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el) * 0.8 + 0.25).normalize();
  return out;
}

/* ---- things sculpted for the roof ------------------------------------------------------------- */
const FLOWERS = ['#e87aa0', '#f2d45c', '#f6f0e0', '#9a7ad8', '#ff8a5f'];
/** A slatted planter box with something growing in it. kind: flowers | grass | lavender | tomato | hedge. 20 deep, 14 high, `len` long. */
function planter({ len = 72, kind = 'flowers', seed = 1 } = {}) {
  const v = new Vox(), r = rng(seed * 7919 + 13), hx = len / 2;
  const wood = M('#8f5f38', 2), dark = tone(wood, -0.3), soil = M('#3a2a1c', 3);
  const leaf = M('#5f9150', 2), leafL = M('#86c06a', 2), leafD = M('#3f6638', 2);
  v.box(-hx, 1, -10, hx, 14, 10, (x, y) => (y === 5 || y === 9 ? dark : wood));
  v.box(-hx, 13, -10, hx, 14, 10, tone(wood, 0.14));
  for (const x of [-hx, hx - 2]) for (const z of [-10, 8]) v.box(x, 0, z, x + 2, 15, z + 2, dark);
  v.carve(-hx + 2, 12, -8, hx - 2, 14, 8);
  v.box(-hx + 2, 11, -8, hx - 2, 13, 8, soil);
  const spots = Math.max(2, Math.round(len / 13));
  for (let i = 0; i < spots; i++) {
    const x = Math.round(-hx + 8 + (i + 0.5) * ((len - 16) / spots) + (r() - 0.5) * 3), z = Math.round((r() - 0.5) * 6);
    if (kind === 'grass') {
      for (let k = 0; k < 9; k++) { const bx = x + Math.round((r() - 0.5) * 9), bz = z + Math.round((r() - 0.5) * 8), bh = 8 + Math.floor(r() * 14); v.box(bx, 13, bz, bx + 1, 13 + bh, bz + 1, [leaf, leafL, leafD, M('#c9b86a', 2)][k % 4]); }
    } else if (kind === 'lavender') {
      v.ellipsoid(x, 16, z, 5, 4, 5, leafD);
      for (let k = 0; k < 7; k++) { const bx = x + Math.round((r() - 0.5) * 8), bz = z + Math.round((r() - 0.5) * 8); v.box(bx, 18, bz, bx + 1, 24 + Math.floor(r() * 4), bz + 1, M(k % 3 ? '#8a6fd0' : '#b49af0', 2)); }
    } else if (kind === 'tomato') {
      v.box(x, 13, z, x + 1, 40, z + 1, M('#b98d57', 2));                                  // a cane
      for (let k = 0; k < 4; k++) v.ellipsoid(x + Math.round((r() - 0.5) * 5), 18 + k * 5, z + Math.round((r() - 0.5) * 4), 4, 3, 4, k % 2 ? leaf : leafD);
      for (let k = 0; k < 4; k++) v.sphere(x + Math.round((r() - 0.5) * 8), 17 + Math.floor(r() * 16), z + 3 + Math.round(r() * 2), 1.2, M(r() < 0.75 ? '#d8392f' : '#8fb84a', 0));
    } else if (kind === 'hedge') {
      v.rbox(x - 6, 12, z - 6, x + 6, 26 + Math.floor(r() * 5), z + 6, 5, (px, py, pz) => ((px * 7 + py * 3 + pz * 5) % 11 === 0 ? leafL : leafD));
    } else {
      v.ellipsoid(x, 15, z, 5 + r() * 2, 3.4, 5, i % 2 ? leaf : leafD);
      for (let k = 0; k < 6; k++) v.set(x + Math.round((r() - 0.5) * 9), 18 + Math.round(r()), z + Math.round((r() - 0.5) * 8), M(FLOWERS[(seed + i + k) % FLOWERS.length], 1));
      if (r() < 0.6) { const fx = x + 3, c = M(FLOWERS[(seed + i) % FLOWERS.length], 1); v.box(fx, 16, z, fx + 1, 23, z + 1, leafL); v.box(fx - 1, 23, z - 1, fx + 2, 25, z + 2, c); v.set(fx, 24, z, M('#f2d45c', 1)); }
    }
  }
  if (kind === 'tomato') { v.box(hx - 7, 13, 7, hx - 6, 20, 8, M('#b98d57', 2)); v.box(hx - 9, 18, 7, hx - 4, 22, 8, M('#f1ead8', 0)); }     // a label on a stick
  return v;
}

/** The kitchen flue: a steel pipe with a rain cap. The scene puffs steam out of it when someone downstairs brews coffee. 14 × 52 × 14. */
function flue() {
  const v = new Vox(), st = M('#9aa3b0', 0), dark = tone(st, -0.32);
  v.box(-7, 0, -7, 7, 3, 7, dark);
  v.cyl('y', 0, 0, 3, 40, 4, st);
  for (const y of [14, 28]) v.cyl('y', 0, 0, y, y + 1, 4.6, dark);
  v.cyl('y', 0, 0, 40, 42, 2, dark);
  v.cyl('y', 0, 0, 44, 50, 7, st, 1);                                                      // the cap, a shallow cone
  for (const [x, z] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) v.box(x, 40, z, x + 1, 45, z + 1, dark);
  v.box(4, 8, -1, 5, 12, 1, M('#f2d45c', 0));                                              // a faded label: KITCHEN
  return v;
}

/** A pole for the string lights, with a hook. */
function pole() {
  const v = new Vox(), wood = M('#5a4024', 2);
  v.box(-3, 0, -3, 3, 2, 3, M('#3a3340', 0));
  v.box(-1, 2, -1, 1, 108, 1, wood);
  v.box(-2, 104, -2, 2, 106, 2, tone(wood, -0.2));
  return v;
}

/** A picnic blanket, as a texture. */
const gingham = () => canvasTexture(48, 48, (g) => {
  g.fillStyle = '#f1ead8'; g.fillRect(0, 0, 48, 48);
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(200,60,60,.55)'; g.fillRect(i * 8, 0, 4, 48); g.fillRect(0, i * 8, 48, 4); }
}, { clamp: true });

/** A folded paper dart, nose toward +z. */
function paperPlane() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.16, -0.11, 0.02, -0.12, 0, 0, -0.1, 0, 0, 0.16, 0, 0, -0.1, 0.11, 0.02, -0.12, 0, 0, 0.16, 0, -0.045, -0.1, 0, 0, -0.1], 3));
  g.computeVertexNormals();
  return g;
}

/* ---- the city ----------------------------------------------------------------------------------- */
const BAY = 2.8, FLOOR_H = 3.4;                      // one window, one storey; a facade tile is 4 × 4 of them
function facadeTexture(wall, glass, seed) {
  const r = rng(seed);
  return canvasTexture(32, 32, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = glass; g.fillRect(x * 8 + 2, y * 8 + 2, 5, 4);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x * 8 + 2, y * 8 + 2, 5, 1);
      if (r() < 0.2) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x * 8 + 2, y * 8 + 4, 5, 2); }       // a blind, half down
    }
    g.fillStyle = 'rgba(0,0,0,.16)'; for (let y = 0; y < 4; y++) g.fillRect(0, y * 8 + 7, 32, 1);
  });
}
function lightsTexture(seed, density) {
  const r = rng(seed);
  return canvasTexture(64, 64, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      if (r() > density) continue;
      g.fillStyle = r() < 0.8 ? ['#ffcf7a', '#ffe0a0', '#ffb860'][Math.floor(r() * 3)] : '#bfe0ff';
      g.fillRect(x * 8 + 2, y * 8 + 2, 5, 4);
    }
  });
}
function skylineTexture(seed) {
  const r = rng(seed);
  return canvasTexture(512, 64, (g, w, hgt) => {
    g.clearRect(0, 0, w, hgt);
    g.fillStyle = '#fff';
    for (let x = 0; x < w;) { const bw = 6 + Math.floor(r() * 16), bh = 8 + Math.floor(r() * r() * 50); g.fillRect(x, hgt - bh, bw, bh); if (r() < 0.2) g.fillRect(x + (bw >> 1), hgt - bh - 6, 1, 6); x += bw + (r() < 0.25 ? 2 : 0); }
  });
}

export async function enter(office) {
  const w = createWorld(office, {
    id: 'roof', bounds: DECK, far: 1200, shadows: 17,
    camera: { fov: 42, pitch: 0.13, dist: 9, yaw: -0.4, minPitch: 0.03, maxPitch: 1.2, maxDist: 16, height: 1.0 },
    fog: { color: '#d5e9f5', near: 45, far: 300 },
    grade: { tilt: 0.18 },
  });
  const { scene } = w;
  const R = rng(20261113);
  const weather = office.net.state.world?.today?.weather || 'clear';
  const overcast = { clear: 0, cloudy: 0.5, rain: 0.7, storm: 0.85, snow: 0.6, fog: 0.55 }[weather] ?? 0;

  /* ---- the deck -------------------------------------------------------------------------------- */
  w.floor(DECK.x0, DECK.z0, DECK.x1, DECK.z1, FLOORS.concrete('#6f6a66'));
  w.floor(-3.6, -3.3, 7.6, 4.9, FLOORS.wood('#9a7450'), { y: 0.012 });
  w.floor(-8.4, 0.4, -4.6, 5.8, FLOORS.grass(), { y: 0.012 });
  for (const [x, z] of [[-4.2, 1.2], [-4.0, 2.3], [-4.25, 3.4]]) w.box(x - 0.28, 0, z - 0.22, x + 0.28, 0.03, z + 0.22, '#8d8678', { cast: false });   // stepping stones
  // the parapet, with a lighter coping
  for (const [x0, z0, x1, z1] of [[DECK.x0 - 0.3, DECK.z0 - 0.3, DECK.x1 + 0.3, DECK.z0], [DECK.x0 - 0.3, DECK.z1, DECK.x1 + 0.3, DECK.z1 + 0.3],
    [DECK.x0 - 0.3, DECK.z0, DECK.x0, DECK.z1], [DECK.x1, DECK.z0, DECK.x1 + 0.3, DECK.z1]]) {
    w.box(x0, -0.3, z0, x1, 0.56, z1, '#7a6a62');
    w.box(x0 - 0.04, 0.56, z0 - 0.04, x1 + 0.04, 0.64, z1 + 0.04, '#b9b0a2');
  }

  /* ---- the lift, in its brick headhouse ----------------------------------------------------------- */
  const LIFT = { x: -5.6, z: -3.5 };
  w.lift(LIFT.x, LIFT.z, 'S', { shell: WALLS.brick() });
  w.prop('doormat', LIFT.x, LIFT.z + 0.75, 'S', { solid: false });
  w.add(w.sign('ROOF GARDEN', { height: 0.3, accent: '#6f8a4a' }), LIFT.x - 1.212, LIFT.z - 0.95, 'W', 1.55);
  w.add(w.sign('KITCHEN FLUE', { height: 0.16, bg: '#4a4a50', fg: '#d8d2c2' }), -2.9, DECK.z0 + 0.012, 'S', 0.3);
  // a rubber duck for a weathervane
  const vane = new THREE.Group();
  const duck = buildDeskItem('duck', 'office-duck');
  duck.scale.multiplyScalar(2.6);
  duck.position.y = 0.52;
  vane.add(duck);
  const stick = new THREE.Mesh(w.own(new THREE.BoxGeometry(0.04, 0.6, 0.04)), w.own(new THREE.MeshLambertMaterial({ color: '#3a3340' })));
  stick.position.y = 0.25;
  vane.add(stick);
  w.add(vane, LIFT.x - 0.7, LIFT.z - 1.5, 0, 2.95);

  /* ---- roof clutter: the plant that keeps the office cool, and the kitchen's flue ------------------- */
  w.prop('acunit', -8.2, -5.7, 'S');
  w.prop('acunit', -7.3, -5.75, 'E', { id: 'roof:ac2' });
  const FLUE = { x: -2.9, z: -5.7 };
  w.vox(flue, FLUE.x, FLUE.z, 'S', { solid: true });
  w.prop('ladder', -3.75, -4.6, 'E', { solid: false });

  /* ---- the garden --------------------------------------------------------------------------------- */
  const beds = [
    [-1.0, -5.9, 'S', 80, 'tomato', 3], [1.3, -5.9, 'S', 72, 'flowers', 5], [3.4, -5.9, 'S', 72, 'lavender', 7], [5.5, -5.9, 'S', 72, 'grass', 9],
    [8.45, -1.4, 'W', 88, 'flowers', 11], [8.45, 3.3, 'W', 72, 'hedge', 13],
    [-2.0, 5.95, 'N', 72, 'lavender', 15], [5.6, 5.95, 'N', 96, 'flowers', 17],
    [-8.45, -1.2, 'E', 80, 'grass', 19], [-3.55, 0.2, 'E', 64, 'hedge', 21],
  ];
  for (const [x, z, face, len, kind, seed] of beds) w.vox(() => planter({ len, kind, seed }), x, z, face, { solid: true });
  w.prop('tree', 2.2, 0.6, 'S', { o: { stage: 4 }, footprint: [1.45, 1.45] });
  w.prop('tree', -7.6, 5.0, 'S', { o: { stage: 2 }, footprint: [1.45, 1.45], id: 'roof:tree2' });
  w.prop('planttall', -3.2, -2.9, 'S'); w.prop('planttall', 7.2, 4.5, 'S', { id: 'roof:pt2' }); w.prop('plant', 7.2, -2.9, 'S'); w.prop('plant', -4.0, 5.9, 'S', { id: 'roof:p2' });

  /* ---- somewhere to sit ----------------------------------------------------------------------------- */
  w.seat(w.prop('bench', -8.3, 2.6, 'W'), 'the sunset bench', { dx: 0.35 });
  w.seat(w.prop('bench', 8.3, 1.0, 'E', { id: 'roof:bench2' }), 'the sunrise bench', { dx: 0.35 });
  w.seat(w.prop('bench', 1.6, 5.9, 'S', { id: 'roof:bench3' }), 'a bench', { dx: 0.35 });
  w.prop('cafetable', 5.4, 2.6, 'S');
  w.seat(w.prop('stool', 4.6, 2.6, 'E'), 'a stool');
  w.seat(w.prop('stool', 6.2, 2.6, 'W', { id: 'roof:stool2' }), 'a stool');
  const blanket = new THREE.Mesh(w.own(new THREE.PlaneGeometry(1.9, 1.5)), w.own(new THREE.MeshLambertMaterial({ map: w.own(gingham()) })));
  blanket.rotation.x = -Math.PI / 2; blanket.rotation.z = 0.2; blanket.receiveShadow = true;
  w.add(blanket, -6.5, 2.4, 0, 0.03).rotation.set(-Math.PI / 2, 0, 0.2);
  w.seat(w.prop('beanbag', -6.9, 3.9, 'E'), 'a beanbag');
  w.seat(w.prop('beanbag', -5.6, 1.5, 'S', { id: 'roof:bb2' }), 'a beanbag');

  /* ---- string lights ---------------------------------------------------------------------------------- */
  const POLES = [[-3.5, -3.2], [7.5, -3.2], [7.5, 4.8], [-3.5, 4.8]];
  for (const [x, z] of POLES) w.vox(pole, x, z, 'S', { solid: true });
  const TOP = 2.62, runs = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
  const bulbAt = [], segs = [];
  for (const [a, b] of runs) {                                 // each run hangs in a shallow curve; a bulb every half metre
    const [ax, az] = POLES[a], [bx, bz] = POLES[b], len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.5);
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = [ax + (bx - ax) * t, TOP - 0.5 * (len / 11) * 4 * t * (1 - t), az + (bz - az) * t];
      if (prev) segs.push(...prev, ...p);
      if (i > 0 && i < n) bulbAt.push(p);
      prev = p;
    }
  }
  const wireGeo = w.own(new THREE.BufferGeometry());
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3));
  scene.add(new THREE.LineSegments(wireGeo, w.own(new THREE.LineBasicMaterial({ color: '#2b2430' }))));
  const bulbMat = w.own(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  const bulbs = new THREE.InstancedMesh(w.own(new THREE.SphereGeometry(0.038, 6, 5)), bulbMat, bulbAt.length);
  const m4 = new THREE.Matrix4(), tint = new THREE.Color();
  bulbAt.forEach((p, i) => { m4.makeTranslation(p[0], p[1] - 0.045, p[2]); bulbs.setMatrixAt(i, m4); bulbs.setColorAt(i, tint.set(['#ffc880', '#ffd9a0', '#ffb870', '#ffa890'][i % 4])); });
  bulbs.frustumCulled = false;
  scene.add(bulbs);
  const lamps = [[2, -3.0], [7.2, 0.8], [2, 4.6], [-3.2, 0.8], [2.2, 0.8]].map(([x, z]) => w.lamp(x, 2.2, z, '#ffc98a', 0, 9));

  /* ---- the telescope, and who is at the other end of it ------------------------------------------------- */
  const SCOPE = { x: 7.9, z: -5.3 };
  const scope = w.prop('telescope', SCOPE.x, SCOPE.z, 'S');
  const FRIEND = { x: 24, y: 2.4, z: -37 };                                              // the roof across the way
  const friend = new Avatar(resolveLook('rooftop-neighbour', { accessory: 'beanie' }), { seed: 'rooftop-neighbour', provider: 'custom' });
  friend.root.position.set(FRIEND.x + 0.7, FRIEND.y, FRIEND.z + 0.2);
  friend.root.rotation.y = Math.atan2(SCOPE.x - FRIEND.x, SCOPE.z - FRIEND.z);
  scene.add(friend.root);
  w.own(friend);
  const theirs = w.vox(telescope, FRIEND.x, FRIEND.z, Math.atan2(SCOPE.x - FRIEND.x, SCOPE.z - FRIEND.z) + Math.PI, { y: FRIEND.y });
  const mask = document.createElement('div');
  Object.assign(mask.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', transition: 'opacity .5s',
    background: 'radial-gradient(circle at 50% 50%, transparent 0, transparent 36vh, rgba(0,0,0,.92) 37.5vh, #000 40vh)' });
  w.root.append(mask);
  w.thing({ x: SCOPE.x, z: SCOPE.z + 0.4, label: 'the telescope', object: scope, reach: 1.5,
    use() {
      mask.style.opacity = '1';
      friend.setPose('wave'); friend.setExpression('happy');
      w.focus([SCOPE.x + 0.3, 1.5, DECK.z0 - 0.5], [FRIEND.x + 0.35, FRIEND.y + 0.7, FRIEND.z], { fov: 5.2, alone: true, onLeave: () => { mask.style.opacity = '0'; friend.setPose('stand'); friend.setExpression('neutral'); } });
    } });

  /* ---- one small thing: a note that never arrived ---------------------------------------------------------- */
  const planeGeo = w.own(paperPlane());
  const paper = w.own(new THREE.MeshLambertMaterial({ color: '#fbf7ea', side: THREE.DoubleSide, emissive: '#3a3628' }));
  const lost = new THREE.Mesh(planeGeo, paper);
  lost.castShadow = true; lost.scale.setScalar(1.5);
  w.add(lost, 8.72, 5.3, 0, 0.07).rotation.set(0.12, -0.9, 0.5);
  const noteTex = w.own(canvasTexture(320, 200, (g, cw, ch) => {
    g.fillStyle = '#fbf7ea'; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = 'rgba(120,110,90,.35)'; g.lineWidth = 1;                              // where it was folded
    for (const [x0, y0, x1, y1] of [[cw / 2, 0, cw / 2, ch], [0, 0, cw / 2, ch * 0.6], [cw, 0, cw / 2, ch * 0.6], [0, ch * 0.6, cw, ch * 0.6]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
    g.fillStyle = '#2a3a6a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 25px Georgia, "Times New Roman", serif';
    g.fillText('whoever finds this —', cw / 2, 62); g.fillText('you are doing fine.', cw / 2, 100);
    g.font = 'italic 17px Georgia, "Times New Roman", serif'; g.textAlign = 'right';
    g.fillText('— a previous session', cw - 30, 152);
  }, { clamp: true }));
  noteTex.magFilter = THREE.LinearFilter;
  const noteMat = w.own(new THREE.MeshBasicMaterial({ map: noteTex, toneMapped: false }));        // unlit: it has to be readable at any hour
  const note = new THREE.Mesh(w.own(new THREE.PlaneGeometry(0.6, 0.375)), noteMat);
  note.visible = false;
  w.add(note, 8.3, 5.55, 0, 0.022).rotation.set(-Math.PI / 2, 0, 0.06);
  const letter = w.thing({ x: 8.5, z: 5.2, label: 'a paper plane', object: lost, reach: 1.15,
    use() {                                                     // it unfolds; what it says is written on it
      if (!note.visible) {
        note.visible = true; lost.visible = false;
        letter.label = 'the note'; letter.object = note;
        office.net.api('/api/world/discover', { method: 'POST', body: { secret: 'air-mail', name: office.walk?.me?.name || 'Lead' } }).catch(() => null);
      }
      w.focus([8.3, 0.95, 5.95], [8.3, 0, 5.52], { fov: 34, alone: true });
    } });

  /* ---- the city ------------------------------------------------------------------------------------------------ */
  const roofMat = w.own(new THREE.MeshLambertMaterial({ color: '#3a3844' }));
  const facades = [['#77808f', '#2c3848'], ['#8a6a5c', '#2a2f3c'], ['#5a6478', '#1f2a3a'], ['#9a9488', '#34404e']].map(([wall, glass], i) => w.own(facadeTexture(wall, glass, 31 + i)));
  const lights = [0.3, 0.45, 0.6].map((d, i) => w.own(lightsTexture(97 + i * 13, d)));
  const sides = [];
  for (const map of facades) for (const emissiveMap of lights) sides.push(w.own(new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0 })));
  function tower(x, z, wide, deep, top, pickMat = Math.floor(R() * sides.length)) {
    const hgt = top - STREET, geo = w.own(new THREE.BoxGeometry(wide, hgt, deep));
    const uv = geo.attributes.uv, ox = Math.floor(R() * 4) / 4, oy = Math.floor(R() * 4) / 4;
    for (let i = 0; i < uv.count; i++) {                         // faces come +x −x +y −y +z −z, four corners each
      const face = Math.floor(i / 4), across = face < 2 ? deep : wide;
      uv.setXY(i, uv.getX(i) * (across / (BAY * 4)) + ox, uv.getY(i) * (hgt / (FLOOR_H * 4)) + oy);
    }
    const side = sides[pickMat % sides.length];
    const mesh = new THREE.Mesh(geo, [side, side, roofMat, roofMat, side, side]);
    mesh.position.set(x, STREET + hgt / 2, z);
    scene.add(mesh);
    return mesh;
  }
  tower(0, 0, DECK.x1 - DECK.x0 + 0.56, DECK.z1 - DECK.z0 + 0.56, -0.31, 1);                // the office itself, under your feet
  const beacons = [];
  const tankMat = w.own(new THREE.MeshLambertMaterial({ color: '#6b4a2f' })), beaconMat = w.own(new THREE.MeshBasicMaterial({ color: '#ff3a2a', toneMapped: false }));
  const tankGeo = w.own(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10)), capGeo = w.own(new THREE.ConeGeometry(1.75, 1.1, 10)), legGeo = w.own(new THREE.BoxGeometry(0.16, 2.2, 0.16));
  const beaconGeo = w.own(new THREE.BoxGeometry(0.5, 0.5, 0.5)), mastGeo = w.own(new THREE.BoxGeometry(0.25, 7, 0.25)), hutGeo = w.own(new THREE.BoxGeometry(1, 1, 1));
  function dress(x, z, top, wide, deep, tall) {
    const k = R();
    if (k < 0.45) {                                               // a water tower on legs
      const g = new THREE.Group();
      const tank = new THREE.Mesh(tankGeo, tankMat); tank.position.y = 3.5;
      const cap = new THREE.Mesh(capGeo, tankMat); cap.position.y = 5.35;
      g.add(tank, cap);
      for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const leg = new THREE.Mesh(legGeo, roofMat); leg.position.set(lx, 1.1, lz); g.add(leg); }
      g.position.set(x + (R() - 0.5) * wide * 0.4, top, z + (R() - 0.5) * deep * 0.4);
      scene.add(g);
    } else if (k < 0.8) {                                         // a stair hut
      const hut = new THREE.Mesh(hutGeo, roofMat); hut.scale.set(3 + R() * 3, 2.4 + R() * 1.5, 3 + R() * 2);
      hut.position.set(x + (R() - 0.5) * wide * 0.4, top + hut.scale.y / 2, z + (R() - 0.5) * deep * 0.4);
      scene.add(hut);
    }
    if (tall) {                                                   // a mast, and a red light for the aeroplanes
      const mast = new THREE.Mesh(mastGeo, roofMat); mast.position.set(x, top + 3.5, z);
      const lamp = new THREE.Mesh(beaconGeo, beaconMat.clone()); w.own(lamp.material); lamp.position.set(x, top + 7.2, z);
      scene.add(mast, lamp); beacons.push(lamp);
    }
  }
  // three rings: neighbours, the middle distance, and towers
  const rings = [[9, 34, 52, -9, 4, 10, 18], [15, 62, 108, -2, 26, 12, 22], [24, 116, 190, 8, 78, 14, 26]];
  for (const [count, r0, r1, top0, top1, w0, w1] of rings) {
    for (let i = 0; i < count; i++) {
      const a = ((i + R() * 0.7) / count) * Math.PI * 2, d = r0 + R() * (r1 - r0);
      const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.92, top = top0 + R() * R() * (top1 - top0) + (R() < 0.3 ? (top1 - top0) * 0.3 : 0);
      const wide = w0 + R() * (w1 - w0), deep = w0 + R() * (w1 - w0);
      if (Math.hypot(x - FRIEND.x, z - FRIEND.z) < 22) continue;                             // keep the neighbour's roof in the clear
      tower(x, z, wide, deep, top);
      if (d < 100) dress(x, z, top, wide, deep, top > 30);
      else if (top > 55) dress(x, z, top, wide, deep, true);
    }
  }
  tower(FRIEND.x + 2, FRIEND.z - 4.5, 15, 13, FRIEND.y, 4);
  const street = new THREE.Mesh(w.own(new THREE.PlaneGeometry(900, 900)), w.own(new THREE.MeshLambertMaterial({ color: '#2a2a33' })));
  street.rotation.x = -Math.PI / 2; street.position.y = STREET;
  scene.add(street);
  // beyond the fog: the rest of the city as a cut-out, twice round
  const far = w.own(skylineTexture(5)); far.repeat.set(3, 1);
  const farMat = w.own(new THREE.MeshBasicMaterial({ map: far, transparent: true, fog: false, side: THREE.BackSide, depthWrite: false, toneMapped: false }));
  const horizon = new THREE.Mesh(w.own(new THREE.CylinderGeometry(330, 330, 110, 64, 1, true)), farMat);
  horizon.position.y = STREET + 55 - 4; horizon.renderOrder = -8;
  scene.add(horizon);

  /* ---- the sky ------------------------------------------------------------------------------------------------------ */
  const domeGeo = w.own(new THREE.SphereGeometry(700, 48, 24));
  domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(domeGeo.attributes.position.count * 3), 3));
  const dome = new THREE.Mesh(domeGeo, w.own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })));
  dome.renderOrder = -10; dome.frustumCulled = false;
  scene.add(dome);
  const starGeo = w.own(new THREE.BufferGeometry()), starPos = [];
  for (let i = 0; i < 420; i++) { const a = R() * Math.PI * 2, e = Math.asin(0.06 + R() * 0.94); starPos.push(Math.cos(a) * Math.cos(e) * 640, Math.sin(e) * 640, Math.sin(a) * Math.cos(e) * 640); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = w.own(new THREE.PointsMaterial({ color: '#ffffff', size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false }));
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -9; stars.frustumCulled = false;
  scene.add(stars);
  const discTex = w.own(canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 5, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.2, 'rgba(255,255,255,1)'); grad.addColorStop(0.3, 'rgba(255,255,255,.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  }, { clamp: true }));
  discTex.magFilter = THREE.LinearFilter;
  const moonTex = w.own(canvasTexture(32, 32, (g) => {
    g.clearRect(0, 0, 32, 32);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 11, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(21, 13, 10, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  }, { clamp: true }));
  const sunMat = w.own(new THREE.SpriteMaterial({ map: discTex, transparent: true, fog: false, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  const sunDisc = new THREE.Sprite(sunMat);
  sunDisc.renderOrder = -7;
  scene.add(sunDisc);
  // a few clouds, drifting
  const cloudTex = [3, 8].map((seed) => w.own(canvasTexture(64, 24, (g) => {
    const r = rng(seed);
    g.clearRect(0, 0, 64, 24);
    g.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) { const x = 8 + r() * 46, wd = 8 + r() * 14, hh = 3 + r() * 5; g.fillRect(Math.round(x - wd / 2), Math.round(15 - hh), Math.round(wd), Math.round(hh + 3)); }
    g.fillRect(6, 15, 52, 4);
  }, { clamp: true })));
  const clouds = new THREE.Group();
  const cloudMats = cloudTex.map((map) => w.own(new THREE.MeshBasicMaterial({ map, transparent: true, fog: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })));
  const cloudGeo = w.own(new THREE.PlaneGeometry(1, 1));
  const cloudCount = Math.round(7 + overcast * 16);
  for (let i = 0; i < cloudCount; i++) {
    const c = new THREE.Mesh(cloudGeo, cloudMats[i % 2]);
    const a = (i / cloudCount) * Math.PI * 2 + R(), d = 360 + R() * 160, y = 70 + R() * 150;
    c.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    c.scale.set(110 + R() * 120, 34 + R() * 26, 1);
    c.lookAt(0, y * 0.4, 0);
    clouds.add(c);
  }
  clouds.renderOrder = -6;
  scene.add(clouds);
  // rain or snow, if that is what today is like
  let fall = null;
  if (weather === 'rain' || weather === 'storm' || weather === 'snow') {
    const n = weather === 'snow' ? 500 : 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (R() - 0.5) * 34; pos[i * 3 + 1] = R() * 14; pos[i * 3 + 2] = (R() - 0.5) * 30; }
    const geo = w.own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = w.own(new THREE.PointsMaterial({ color: weather === 'snow' ? '#ffffff' : '#bcd0e8', size: weather === 'snow' ? 0.09 : 0.05, transparent: true, opacity: weather === 'snow' ? 0.9 : 0.55, depthWrite: false }));
    fall = { pts: new THREE.Points(geo, mat), pos, speed: weather === 'snow' ? 1.4 : 11 };
    fall.pts.frustumCulled = false;
    scene.add(fall.pts);
  }

  /* ---- the hour: light, sky, windows, bulbs ------------------------------------------------------------------------ */
  let sky = skyAt(office.lighting?.hour ?? 14), shownHour = -99;
  const tmp = new THREE.Color(), tmp2 = new THREE.Color(), grey = new THREE.Color('#8a909c'), d3 = new THREE.Vector3(), flat = new THREE.Vector3();
  function applyHour(hour) {
    shownHour = hour;
    sky = skyAt(hour);
    const L = lightAt(hour);
    if (overcast) for (const k of ['top', 'mid', 'low']) sky[k].lerp(tmp.copy(grey).multiplyScalar(sky.night ? 0.16 : 0.9), overcast * 0.6);
    // the dome: a gradient from the horizon up, warmer toward the sun, with a glow round it
    const pos = domeGeo.attributes.position, col = domeGeo.attributes.color;
    flat.set(sky.dir.x, 0, sky.dir.z).normalize();
    const farLow = tmp2.copy(sky.low).lerp(sky.mid, 0.62);
    for (let i = 0; i < pos.count; i++) {
      d3.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const e = d3.y, toward = 0.5 + 0.5 * (d3.x * flat.x + d3.z * flat.z);
      tmp.copy(farLow).lerp(sky.low, toward * toward);
      if (e > 0) tmp.lerp(sky.mid, smooth(e / 0.24)).lerp(sky.top, smooth((e - 0.16) / 0.62));
      else tmp.multiplyScalar(0.9);
      const g = Math.max(0, d3.dot(sky.dir));
      const halo = (Math.pow(g, 40) * 0.8 + Math.pow(g, 5) * 0.28) * sky.glow * (1 - overcast * 0.7);
      col.setXYZ(i, tmp.r + sky.sun.r * halo, tmp.g + sky.sun.g * halo, tmp.b + sky.sun.b * halo);
    }
    col.needsUpdate = true;
    const haze = tmp.copy(sky.low).lerp(sky.mid, 0.35);
    scene.fog.color.copy(haze); scene.background.copy(haze);
    if (weather === 'fog') { scene.fog.near = 8; scene.fog.far = 70; }
    farMat.color.copy(haze).lerp(tmp2.set(sky.night ? '#05060f' : '#3a3550'), sky.night ? 0.55 : 0.4);
    for (const m of cloudMats) { m.color.copy(sky.cloud).lerp(grey, overcast * 0.5); m.opacity = 0.5 + overcast * 0.35 + (sky.night ? -0.2 : 0.15); }
    starMat.opacity = sky.stars * (1 - overcast);
    sunDisc.material.map = sky.night ? moonTex : discTex;
    sunDisc.material.blending = sky.night ? THREE.NormalBlending : THREE.AdditiveBlending;
    sunDisc.material.color.copy(sky.sun).multiplyScalar(sky.night ? 1.1 : 1.6);
    sunDisc.material.opacity = 1 - overcast * 0.8;
    sunDisc.material.needsUpdate = true;
    sunDisc.position.copy(sky.dir).multiplyScalar(600);
    sunDisc.scale.setScalar(sky.night ? 46 : 120);
    // the same light the office has at this hour, from where this sky's sun is
    const el = Math.max(0.16, sky.dir.y);
    w.light({ sky: L.sky, ground: L.ground, hemi: L.hemi * (1 - overcast * 0.2), sun: L.sun, power: L.power * (1 - overcast * 0.55), dir: [sky.dir.x, el, sky.dir.z] });
    w.grade.glow = L.glow; w.grade.bloom = L.bloom + sky.lit * 0.12;
    for (const m of sides) m.emissiveIntensity = sky.lit * 1.5;
    const on = Math.max(L.lamp, overcast > 0.6 ? 0.5 : 0);
    bulbMat.color.setScalar(on > 0.05 ? 1.0 + on * 0.5 : 0.4);
    for (const l of lamps) l.intensity = 4.2 * on;
    for (const b of beacons) b.visible = sky.lit > 0.2;
    noteMat.color.setScalar(sky.night ? 0.5 : 0.78);
  }
  applyHour(office.lighting?.hour ?? 14);

  /* ---- what is alive ------------------------------------------------------------------------------------------------- */
  // steam from the flue whenever someone downstairs really does make coffee
  const puffGeo = w.own(new THREE.SphereGeometry(0.16, 6, 5));
  const puffs = Array.from({ length: 12 }, () => {
    const m = new THREE.Mesh(puffGeo, w.own(new THREE.MeshBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0, depthWrite: false })));
    m.visible = false; m.userData.life = 0;
    scene.add(m);
    return m;
  });
  /* ---- colleagues who came up (agents: `office rooftop`, or `office use lift roof`) ------------------- */
  // An agent up here is taking a moment (server/life.mjs holds its mail). So that is what you find: someone
  // sitting on the deck with their eyes closed, facing out. There is nothing to do with them but let them be.
  const SPOTS = [[-6.6, 2.5], [-1.6, 2.6], [0.4, 3.7], [3.8, -1.7], [-1.0, -1.6], [6.3, -0.8]];
  const guests = new Map();
  function syncGuests() {
    const here = new Set(), net = office.net;
    for (const [id, place] of net.state.places) {
      const agent = net.state.agents.get(id);
      // where they stand in the car says which button they pressed (core/levels.mjs): this floor's
      if (!agent || floorOfPlacement(place)?.id !== 'roof' || net.now() < place.eta) continue;
      here.add(id);
      if (guests.has(id)) continue;
      const taken = new Set([...guests.values()].map((g) => g.spot));
      const spot = SPOTS.findIndex((_, i) => !taken.has(i));
      if (spot < 0) continue;                                  // a full roof: the rest are simply out of sight
      const [x, z] = SPOTS[spot];
      const avatar = new Avatar(agent.profile?.character || resolveLook(agent.persona || agent.id), { seed: agent.persona || agent.id, provider: agent.provider || 'unknown' });
      avatar.seatHeight = 4;                                   // on the boards, not on a chair
      avatar.snap('sit'); avatar.setExpression('sleep');
      avatar.root.position.set(x, 0, z);
      avatar.root.rotation.y = Math.atan2(x - 1.5, z - 0.8);   // facing out, away from the middle of the deck
      scene.add(avatar.root);
      const thing = w.thing({ x, z, label: `${agent.name}, taking a moment`, reach: 1.2, use() { /* leave them be */ } });
      guests.set(id, { avatar, spot, thing });
    }
    for (const [id, guest] of guests) {
      if (here.has(id)) continue;
      scene.remove(guest.avatar.root); guest.avatar.dispose(); guest.thing.hidden = () => true;
      guests.delete(id);
    }
  }
  for (const event of ['place', 'remove', 'world']) w.on(event, syncGuests);
  syncGuests();

  let brewing = 0, nextPuff = 0, guestsAt = 0;
  w.on('fx', (fx) => { if (fx.kind === 'coffee') brewing = Math.min(4.5, brewing + 2.6); });
  // every note between agents goes over as a paper plane
  const flights = [];
  w.on('fx', (fx) => {
    if (fx.kind !== 'plane' || flights.length > 7) return;
    const a = Math.random() * Math.PI * 2, mesh = new THREE.Mesh(planeGeo, paper);
    mesh.scale.setScalar(1.6);
    scene.add(mesh);
    flights.push({ mesh, t: 0, from: [Math.cos(a) * 15, 2.4 + Math.random() * 2, Math.sin(a) * 12], to: [-Math.cos(a) * 15 + (Math.random() - 0.5) * 8, 2.6 + Math.random() * 2, -Math.sin(a) * 12], lift: 2 + Math.random() * 2.5, wob: Math.random() * 6 });
  });
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  const along = (f, t, out) => out.set(f.from[0] + (f.to[0] - f.from[0]) * t, f.from[1] + (f.to[1] - f.from[1]) * t + Math.sin(t * Math.PI) * f.lift, f.from[2] + (f.to[2] - f.from[2]) * t);

  let checked = 0;
  w.onFrame((dt, t) => {
    if (t - checked > 1.5) { checked = t; const hour = office.lighting?.hour ?? 14; if (Math.abs(hour - shownHour) > 0.02) applyHour(hour); }
    vane.rotation.y = Math.sin(t * 0.23) * 1.1 + Math.sin(t * 0.71) * 0.25 + 0.6;
    clouds.rotation.y += dt * 0.004;
    stars.rotation.y += dt * 0.0015;
    for (const b of beacons) b.material.color.setScalar(Math.sin(t * 2.2 + b.position.x) > 0.55 ? 1.6 : 0.35).multiply(tmp.set('#ff3a2a'));
    friend.update(dt);
    if (t - guestsAt > 2) { guestsAt = t; syncGuests(); }       // someone still walking to the lift arrives in their own time
    for (const guest of guests.values()) guest.avatar.update(dt);
    if (brewing > 0) {
      brewing -= dt;
      if (t > nextPuff) {
        nextPuff = t + 0.22;
        const p = puffs.find((x) => !x.visible);
        if (p) { p.visible = true; p.userData.life = 0; p.position.set(FLUE.x + (Math.random() - 0.5) * 0.12, 1.28, FLUE.z + (Math.random() - 0.5) * 0.12); p.userData.drift = (Math.random() - 0.5) * 0.3; }
      }
    }
    for (const p of puffs) {
      if (!p.visible) continue;
      p.userData.life += dt / 3.2;
      const k = p.userData.life;
      if (k >= 1) { p.visible = false; continue; }
      p.position.y += dt * (0.9 - k * 0.5); p.position.x += dt * (0.35 + p.userData.drift); p.position.z += dt * 0.08;
      p.scale.setScalar(0.7 + k * 2.6);
      p.material.opacity = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k) * 0.55;
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt / 4.5;
      if (f.t >= 1) { scene.remove(f.mesh); flights.splice(i, 1); continue; }
      along(f, f.t, p0); along(f, Math.min(1, f.t + 0.02), p1);
      f.mesh.position.copy(p0); f.mesh.lookAt(p1); f.mesh.rotateZ(Math.sin(f.wob + f.t * 9) * 0.25);
    }
    if (fall) {
      const { pos, speed } = fall;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 1] -= speed * dt * (0.8 + ((i * 7) % 5) * 0.1);
        if (weather === 'snow') pos[i] += Math.sin(t * 0.8 + i) * dt * 0.3;
        if (pos[i + 1] < 0) pos[i + 1] += 14;
      }
      fall.pts.geometry.attributes.position.needsUpdate = true;
      fall.pts.position.set(w.me.x, 0, w.me.z);
    }
  });

  w.music('rooftop-lofi', { volume: 0.4 });
  return w.run();
}
