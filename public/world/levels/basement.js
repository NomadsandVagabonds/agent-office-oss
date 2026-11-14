// B · Basement — a level that is a PLACE, and the one floor of the building
// that has more of itself than the building has room for. Plant on one side
// (two air handlers, a boiler, pipes with tags on them, a sump), caged storage
// on the other (archive, dead furniture, what was left over from fitting out
// somewhere), and between them the corner where the caretaker sits, or sat:
// a kettle, a radio, a monitor, a board he keeps a count on.
//
// Nothing down here says so, but one stretch of the north wall, round the back
// of the cages where nobody has a reason to go, is not as solid as the rest.
// The damp has got into it; the tube over it is the wrong colour; loose paper
// on the floor is going under it; and somebody was wheeling boxes at it when
// they stopped. Lean on it for as long as it takes and you are through: you
// watch yourself sink into blockwork and walk on, and then the camera has a
// wall of its own to get through. Behind it there is nothing, for a long way
// down, and then the back of a ceiling that goes on further than the building
// does (leave('noclip') — levels/index.js knows what is under that ceiling,
// and brings you back out of the same wall afterwards, however it went).
import * as THREE from 'three';
import { createWorld } from './kit.js';
import { WALLS, canvasTexture } from '../scene/textures.js';
import { CRT_SCREEN, DESK_H } from '../props/office.js';
import { VOXEL } from '../vox/vox.js';
import { blockwork, screed, cageMesh, louvres, grating, stencil, damp, sackTruck, archiveBox, kettle, radio, valve, padlock, shoe, roll,
  drawCctv, drawTally, drawKeys } from './basement-props.js';

const ROOM = { x0: -12, z0: -9, x1: 12, z1: 6, h: 3.0 };
const CAGE = { x0: 3.0, x1: 11.4, z0: -7.5, z1: -3.5, h: 2.3, cuts: [5.8, 8.6] };
/** The stretch of the north wall that gives, and how long it has to be leaned on (the corner upstairs takes as long). */
export const SOFT = Object.freeze({ x0: 9.05, x1: 10.45, lean: 1.15 });
const TAU = Math.PI * 2;
const turnTo = (from, to) => { let d = (to - from) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// what the board over the desk has on it before you add to it: he has been keeping count for some time
const BEFORE = { in: 37, out: 2 };
const trips = {
  load() { try { const t = JSON.parse(localStorage.getItem('office.basement') || '{}') || {}; return { in: Math.max(0, t.in | 0), out: Math.max(0, t.out | 0) }; } catch { return { in: 0, out: 0 }; } },
  save(t) { try { localStorage.setItem('office.basement', JSON.stringify(t)); } catch { /* private mode: he loses count */ } },
};

export async function enter(office, opt = {}) {
  const back = opt.back || null;                       // 'exit' | 'caught' | 'quit': you have just come back out of the wall
  let drop = 0;                                        // how far whoever is behind the wall has fallen
  const w = createWorld(office, {
    id: 'basement', background: '#050507', shadows: 15, arrive: !back,
    camera: { yaw: 0, pitch: 0.68, dist: 9.5, minDist: 4, maxDist: 15, minPitch: 0.3, inside: { x0: ROOM.x0 + 0.4, z0: ROOM.z0 + 0.4, x1: ROOM.x1 - 0.4, z1: ROOM.z1 - 0.4 } },
    grade: { tilt: 0.2, bloom: 0.5, glow: 1.5 },
    floorY: (x, z) => (z < ROOM.z0 - 0.25 ? drop : 0),
  });
  const { scene } = w, who = office.walk?.me?.name || 'Lead';
  const projects = (office.net?.state?.world?.plan?.rooms || []).map((r) => r && r.name).filter(Boolean);
  const count = trips.load();
  if (back === 'exit') { count.out++; trips.save(count); }

  /* ---- small helpers: this floor is mostly boxes ---------------------------------------------------- */
  const lam = (color, extra) => w.own(new THREE.MeshLambertMaterial({ color, ...extra }));
  const lit = (color) => w.own(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const pic = (tex, extra) => w.own(new THREE.MeshLambertMaterial({ map: w.own(tex), ...extra }));
  /** A flat picture wd × hg metres, its middle at (x, y, z), facing `face`. */
  const hang = (material, wd, hg, x, y, z, face = 'S') => { const m = new THREE.Mesh(w.own(new THREE.PlaneGeometry(wd, hg)), material); m.receiveShadow = true; return w.add(m, x, z, face, y); };
  /** Something painted on with a stencil: `hgt` metres tall. */
  const paint = (text, x, y, z, face, hgt = 0.26, color) => { const tex = stencil(text, color); return hang(pic(tex, { transparent: true, alphaTest: 0.35 }), hgt * tex.userData.aspect, hgt, x, y, z, face); };
  /** A paper tag on a string: what somebody wanted the next person to know. */
  const tag = (text, x, y, z, face = 'S') => w.add(w.sign(text, { height: 0.085, bg: '#efe9d8', fg: '#2a2620', size: 9 }), x, z, face, y);
  /** A round pipe between two points. */
  const up = new THREE.Vector3(0, 1, 0);
  const pipe = (a, b, r, material) => {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    const m = new THREE.Mesh(w.own(new THREE.CylinderGeometry(r, r, len, 8)), material);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(up, d.normalize());
    m.castShadow = true; scene.add(m);
    return m;
  };
  const galv = lam('#9aa3a8'), flange = lam('#6f777d');
  /** A length of duct, with a flange every so often along whichever way it runs. */
  const duct = (x0, y0, z0, x1, y1, z1) => {
    w.box(x0, y0, z0, x1, y1, z1, galv);
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, k = 0.03;
    if (dx >= dy && dx >= dz) for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.2) w.box(x - 0.02, y0 - k, z0 - k, x + 0.02, y1 + k, z1 + k, flange, { cast: false });
    else if (dz >= dy) for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.2) w.box(x0 - k, y0 - k, z - 0.02, x1 + k, y1 + k, z + 0.02, flange, { cast: false });
    else for (let y = y0 + 0.5; y < y1 - 0.2; y += 1.0) w.box(x0 - k, y - 0.02, z0 - k, x1 + k, y + 0.02, z1 + k, flange, { cast: false });
  };
  /**
   * A strip light on chains: a bare tube in a batten (this floor is looked at from over its walls, so what you see of a
   * light is its top — and a tube with a reflector over it would be a black bar), and the light it gives.
   * → { tube (its material), lamp, color }
   */
  const tubeLight = (x, z, color = '#e4ecff', power = 15, along = 'x') => {
    const tube = lit(color), a = along === 'x' ? [0.62, 0.035] : [0.035, 0.62];
    w.box(x - a[0], 2.62, z - a[1], x + a[0], 2.69, z + a[1], tube, { cast: false });
    for (const s of [-1, 1]) {
      const ex = along === 'x' ? s * 0.64 : 0, ez = along === 'x' ? 0 : s * 0.64;
      w.box(x + ex - 0.05, 2.6, z + ez - 0.05, x + ex + 0.05, 2.71, z + ez + 0.05, '#3a3d44', { cast: false });
      w.box(x + ex - 0.006, 2.71, z + ez - 0.006, x + ex + 0.006, ROOM.h + 0.5, z + ez + 0.006, '#1c1c20', { cast: false });
    }
    return { tube, lamp: w.lamp(x, 2.45, z, color, power, 11), color: new THREE.Color(color) };
  };

  /* ---- the room -------------------------------------------------------------------------------------- */
  w.room({ ...ROOM, wall: blockwork(), floor: screed(), lift: { side: 'S', at: 0 }, shaft: WALLS.steel(), slab: '#1c1a1e' });
  w.light({ sky: '#9aa3b8', ground: '#33333a', hemi: 0.85, sun: '#b8c4d8', power: 0.3, dir: [0.15, 1, 0.2] });
  // a lane painted on the floor from the lift to the plant, and a box nothing is to be left in
  const yellow = lam('#b99a2a');
  for (const [x0, z0, x1, z1] of [[-1.3, -1.6, -1.2, 4.6], [1.2, -1.6, 1.3, 4.6], [-8.6, -1.7, -1.2, -1.6], [-8.6, -0.5, -1.3, -0.4]]) w.box(x0, 0.004, z0, x1, 0.008, z1, yellow, { cast: false });
  for (let i = 0; i < 6; i++) w.box(-11.6 + i * 0.32, 0.004, 2.9, -11.5 + i * 0.32, 0.008, 4.7, yellow, { cast: false }).rotation.y = 0.5;
  paint('B', -1.9, 2.0, ROOM.z1 - 0.012, 'N', 0.7, '#22241f');

  tubeLight(-7.6, -4.4); tubeLight(-8.2, 2.4); tubeLight(0, 1.6, '#e4ecff', 15, 'z'); tubeLight(6.4, 1.8); tubeLight(7.2, -5.5, '#e4ecff', 11); tubeLight(-3.6, -5.4, '#e4ecff', 9);

  /* ---- plant: the west end ---------------------------------------------------------------------------- */
  const louvre = pic(louvres()), casing = lam('#aab2b6');
  [[-8.2, -5.8, 'AHU 1'], [-4.8, -2.4, 'AHU 2']].forEach(([z0, z1, name], i) => {
    w.box(ROOM.x0 + 0.3, 0.1, z0, -9.9, 2.0, z1, casing, { solid: true });
    w.box(ROOM.x0 + 0.25, 0, z0 - 0.05, -9.85, 0.1, z1 + 0.05, '#3a3d44', { cast: false });
    hang(louvre, 1.9, 1.2, -9.888, 1.25, (z0 + z1) / 2, 'E');
    paint(name, -9.885, 0.42, (z0 + z1) / 2, 'E', 0.2);
    w.box(-9.9, 0.9, z1 - 0.5, -9.78, 1.5, z1 - 0.1, '#5a626e', { cast: false });               // its controls, and the one lamp that says it is running
    w.box(-9.78, 1.36, z1 - 0.36, -9.77, 1.4, z1 - 0.32, lit(i ? '#3a1410' : '#58e08c'), { cast: false });
    duct(-11.1, 2.0, (z0 + z1) / 2 - 0.3, -10.4, 2.75, (z0 + z1) / 2 + 0.3);
  });
  duct(-11.1, 2.3, -7.3, -3.2, 2.75, -6.7);                 // the trunk off the first, east along the plant…
  duct(-3.8, 2.3, -9.0, -3.2, 2.75, -7.3);                  // …and out through the north wall, as ducts do
  duct(-11.4, 2.3, -3.3, -10.8, 2.75, 5.4);                 // the second goes the length of the west wall and stops, open, over nothing
  w.box(-11.44, 2.26, 5.4, -10.76, 2.79, 5.46, '#2b2f33', { cast: false });
  // the boiler, and the cylinder it keeps hot
  const iron = lam('#5a3a34'), lagging = lam('#d8d2bc');
  const boiler = new THREE.Mesh(w.own(new THREE.CylinderGeometry(0.66, 0.66, 1.9, 18)), iron);
  boiler.position.set(-6.3, 1.05, -7.7); boiler.castShadow = true; scene.add(boiler);
  w.box(-6.75, 0, -8.15, -5.85, 0.1, -7.25, '#2a2a2e', { cast: false });
  w.box(-6.62, 0.25, -7.12, -5.98, 0.85, -6.9, '#3a3d44');                                            // the burner
  w.box(-6.38, 0.5, -6.9, -6.22, 0.6, -6.89, lit('#ff9a3a'), { cast: false });                        // and what can be seen of the flame
  w.lamp(-6.3, 0.6, -6.5, '#ff9a4a', 1.6, 3.5);
  pipe([-6.3, 2.0, -7.7], [-6.3, ROOM.h + 0.5, -7.7], 0.14, galv);
  w.block(-6.3, -7.7, 0.72);
  const tank = new THREE.Mesh(w.own(new THREE.CylinderGeometry(0.46, 0.46, 1.6, 14)), lagging);
  tank.position.set(-4.7, 0.9, -8.2); tank.castShadow = true; scene.add(tank);
  for (const y of [0.5, 1.2]) pipe([-4.7, y - 0.02, -8.2], [-4.7, y + 0.02, -8.2], 0.475, flange);                                     // the bands that hold its jacket on
  w.block(-4.7, -8.2, 0.5);
  // pipes along the north wall, each a colour somebody once had a chart for
  const runs = [['#a8322b', 2.25], ['#3a5a8a', 2.05], ['#4a7a52', 1.85]];
  runs.forEach(([color, y], i) => {
    const m = lam(color);
    pipe([ROOM.x0 + 0.1, y, ROOM.z0 + 0.14 + i * 0.01], [-7.2, y, ROOM.z0 + 0.14 + i * 0.01], 0.045, m);
    pipe([-7.2, y, ROOM.z0 + 0.14], [-7.2, y, -8.0 - i * 0.12], 0.045, m);
    pipe([-7.2, y, -8.0 - i * 0.12], [-6.6 - i * 0.04, y - 0.5, -7.9], 0.045, m);
  });
  [[-10.4, 2.25, '#a8322b', 'DO NOT CLOSE'], [-9.2, 2.05, '#3a5a8a', 'CLOSE THIS ONE'], [-8.2, 1.85, '#4a7a52', `ASK ${(projects[0] || 'UPSTAIRS').toUpperCase()}`]].forEach(([x, y, color, text]) => {
    w.vox(() => valve(color), x, ROOM.z0 + 0.14, 'S', { y: y - 0.06, cast: false });
    tag(text, x + 0.02, y - 0.24, ROOM.z0 + 0.2);
  });
  paint('PLANT', -9.4, 1.25, ROOM.z0 + 0.012, 'S', 0.3);
  // the sump: a grating, black water a long way under it, and a float that has not moved
  hang(pic(grating()), 1.4, 1.4, -9.9, 0.012, 1.3, 'S').rotation.x = -Math.PI / 2;
  w.box(-10.7, 0, 0.5, -9.1, 0.01, 2.1, '#33363c', { cast: false });
  w.box(-10.62, 0.01, 0.58, -9.18, 0.02, 2.02, '#0a0b0d', { cast: false });
  w.box(-9.0, 0, 1.0, -8.6, 0.42, 1.6, '#4a6a8a', { solid: true });
  pipe([-8.8, 0.42, 1.3], [-8.8, 0.9, 1.3], 0.03, galv); pipe([-8.8, 0.9, 1.3], [ROOM.x0 + 0.1, 0.9, 1.3], 0.03, galv);
  paint('SUMP', ROOM.x0 + 0.012, 1.3, 1.3, 'E', 0.26);
  // the board the building's power comes through, and the tag somebody hung on it
  w.box(ROOM.x0, 0.6, 3.1, ROOM.x0 + 0.24, 2.1, 4.5, '#7d8694');
  w.box(ROOM.x0 + 0.24, 1.2, 3.72, ROOM.x0 + 0.26, 1.46, 3.88, '#22242a', { cast: false });
  w.add(w.sign('DO NOT SWITCH ON', { height: 0.11, bg: '#b5281c', fg: '#fff3e0', size: 10 }), ROOM.x0 + 0.265, 3.8, 'E', 1.06);
  tag('MAN WORKING ON LINE · 1994', ROOM.x0 + 0.265, 0.92, 3.8, 'E');

  /* ---- the caretaker's corner --------------------------------------------------------------------------- */
  w.box(-2.9, 0.004, ROOM.z0 + 0.1, 2.2, 0.014, -6.2, '#5a2f2a', { cast: false });                    // a rug, to say where it starts
  w.box(-2.75, 0.014, ROOM.z0 + 0.25, 2.05, 0.016, -6.35, '#7a4a3a', { cast: false });
  const DX = -0.9, DZ = -8.25;
  w.prop('desk', DX, DZ, 'N');
  const crt = w.prop('crt', DX + 3 * VOXEL, DZ - 5 * VOXEL, 'S', { y: DESK_H * VOXEL, solid: false });
  w.prop('keyboard', DX + 3 * VOXEL, DZ + 10 * VOXEL, 'S', { y: DESK_H * VOXEL, solid: false });
  w.prop('chair', DX + 0.1, DZ + 0.8, 'N', { o: { color: '#5a5a66' }, footprint: [0.5, 0.5] });
  w.prop('desklamp', DX - 0.62, DZ - 0.1, 'S', { y: DESK_H * VOXEL, solid: false, o: { color: '#3f8a5a' } });
  w.lamp(DX - 0.5, 1.15, DZ + 0.2, '#ffca82', 5, 5);
  w.vox(kettle, DX + 0.72, DZ - 0.12, 'S', { y: DESK_H * VOXEL });
  w.vox(radio, DX + 0.78, DZ + 0.22, 'W', { y: DESK_H * VOXEL });
  w.add(w.sign('BACK IN 5 MINS', { height: 0.085, bg: '#efe9d8', fg: '#2a2620', size: 9 }), DX - 0.2, DZ + 0.36, 'S', DESK_H * VOXEL + 0.05).rotation.x = -0.5;
  // what his monitor shows is not in this building
  const cctv = w.own(new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 96, height: 72 })));
  cctv.colorSpace = THREE.SRGBColorSpace; cctv.magFilter = THREE.NearestFilter;
  const screen = new THREE.Mesh(w.own(new THREE.PlaneGeometry(CRT_SCREEN.w, CRT_SCREEN.h)), w.own(new THREE.MeshBasicMaterial({ map: cctv, toneMapped: false })));
  screen.position.set(CRT_SCREEN.x, CRT_SCREEN.y, CRT_SCREEN.z);
  crt.children[0].add(screen);
  w.thing({ x: DX + 0.1, z: DZ + 0.75, label: 'the monitor', reach: 1.1, use: () => w.focus([DX + 0.08, 1.02, DZ + 0.42], [DX + 0.08, 0.95, DZ - 0.3], { fov: 30, alone: true }) });
  // an armchair for the afternoons, a lamp, the paper
  w.prop('armchair', 1.25, -8.2, 'S');
  w.prop('floorlamp', 1.95, -8.62, 'S');
  w.lamp(1.9, 1.5, -8.4, '#ffca82', 5, 6);
  w.prop('sidetable', 0.45, -8.45, 'S');
  // the board: two columns, kept up to date
  const board = w.own(new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 160, height: 96 })));
  board.colorSpace = THREE.SRGBColorSpace;
  const chalk = () => { drawTally(board.image.getContext('2d'), 160, 96, BEFORE.in + count.in, BEFORE.out + count.out); board.needsUpdate = true; };
  chalk();
  hang(w.own(new THREE.MeshLambertMaterial({ map: board })), 1.1, 0.66, DX + 0.1, 1.86, ROOM.z0 + 0.03, 'S');
  w.thing({ x: DX + 1.5, z: DZ + 0.9, label: 'the board', reach: 0.9, use: () => w.focus([DX + 0.1, 1.8, ROOM.z0 + 1.9], [DX + 0.1, 1.86, ROOM.z0], { fov: 32, alone: true }) });
  // every key in the building, on its hook. Nearly every key
  const keys = canvasTexture(128, 64, (g, kw, kh) => drawKeys(g, kw, kh, [{ text: 'PLANT' }, { text: 'CAGE A' }, { text: 'CAGE B' }, { text: 'CAGE C' }, { text: 'ROOF' }, { text: '11' }, { text: '9' }, { text: '7' }, { text: '13', key: false }, { text: 'P' }]), { clamp: true });
  hang(pic(keys), 0.9, 0.45, -2.25, 1.5, ROOM.z0 + 0.03, 'S');
  // lanyards, on a rail. One hook is empty, and has a name over it
  w.box(0.3, 1.62, ROOM.z0 + 0.02, 2.5, 1.66, ROOM.z0 + 0.05, '#6a4a2a', { cast: false });
  const strap = lam('#a8322b'), badge = lam('#efe9d8');
  for (let i = 0; i < 10; i++) {
    const x = 0.42 + i * 0.22;
    w.box(x - 0.012, 1.6, ROOM.z0 + 0.05, x + 0.012, 1.63, ROOM.z0 + 0.075, '#c9a24a', { cast: false });
    if (i === 9) { tag(who.toUpperCase(), x, 1.74, ROOM.z0 + 0.03); continue; }
    w.box(x - 0.012, 1.22 + (i % 3) * 0.03, ROOM.z0 + 0.052, x + 0.012, 1.6, ROOM.z0 + 0.062, strap, { cast: false });
    w.box(x - 0.04, 1.1 + (i % 3) * 0.03, ROOM.z0 + 0.05, x + 0.04, 1.22 + (i % 3) * 0.03, ROOM.z0 + 0.058, badge, { cast: false });
  }
  // lost property: he keeps what comes back
  w.box(2.35, 0, -6.9, 2.95, 0.34, -6.3, '#8a6a44', { solid: true });
  w.box(2.39, 0.3, -6.86, 2.91, 0.32, -6.34, '#3a2a1a', { cast: false });
  for (let i = 0; i < 7; i++) w.vox(() => shoe(i), 2.47 + (i % 3) * 0.17, -6.78 + Math.floor(i / 3) * 0.16, i * 1.3, { y: 0.3 + (i % 2) * 0.03, cast: false });
  w.add(w.sign('LOST PROPERTY', { height: 0.1, size: 10 }), 2.65, -6.295, 'S', 0.2);

  /* ---- the cages: the north-east --------------------------------------------------------------------- */
  const wire = cageMesh(), post = lam('#6f777d');
  wire.magFilter = THREE.LinearFilter;                      // (soft, so that from across the room it is a haze over what is behind it and not a pattern in front)
  const mesh = (x0, z0, x1, z1) => {                        // one upright panel of mesh from (x0, z0) to (x1, z1)
    const len = Math.hypot(x1 - x0, z1 - z0), t = w.own(wire.clone());
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 0.2, CAGE.h / 0.2); t.needsUpdate = true;
    const m = new THREE.Mesh(w.own(new THREE.PlaneGeometry(len, CAGE.h)), w.own(new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
    m.renderOrder = 2;
    m.position.set((x0 + x1) / 2, CAGE.h / 2, (z0 + z1) / 2); m.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    scene.add(m);
    w.box(Math.min(x0, x1) - 0.02, CAGE.h - 0.02, Math.min(z0, z1) - 0.02, Math.max(x0, x1) + 0.02, CAGE.h + 0.02, Math.max(z0, z1) + 0.02, post, { cast: false });
  };
  const xs = [CAGE.x0, ...CAGE.cuts, CAGE.x1];
  mesh(CAGE.x0, CAGE.z0, CAGE.x1, CAGE.z0); mesh(CAGE.x0, CAGE.z1, CAGE.x1, CAGE.z1);
  for (const x of xs) { mesh(x, CAGE.z0, x, CAGE.z1); for (const z of [CAGE.z0, CAGE.z1]) w.box(x - 0.03, 0, z - 0.03, x + 0.03, CAGE.h, z + 0.03, post); }
  w.block(CAGE.x0 - 0.05, CAGE.z0 - 0.05, CAGE.x1 + 0.05, CAGE.z1 + 0.05);
  w.block(CAGE.x1, CAGE.z0, ROOM.x1, CAGE.z1);              // (nobody squeezes round the far end)
  const labels = ['ARCHIVE 1987 –', 'FURNITURE (DEAD)', 'FIT-OUT · DO NOT ISSUE'];
  for (let i = 0; i < 3; i++) {
    const mid = (xs[i] + xs[i + 1]) / 2;
    for (const s of [-0.48, 0.48]) w.box(mid + s - 0.025, 0, CAGE.z1 - 0.01, mid + s + 0.025, 2.05, CAGE.z1 + 0.04, post, { cast: false });           // a gate in the front of each
    w.box(mid - 0.5, 2.03, CAGE.z1 - 0.01, mid + 0.5, 2.08, CAGE.z1 + 0.04, post, { cast: false });
    w.vox(padlock, mid + 0.44, CAGE.z1 + 0.05, 'S', { y: 1.0, cast: false });
    w.add(w.sign(labels[i], { height: 0.12, bg: '#2a2d34', fg: '#e8e2d0', size: 10 }), mid, CAGE.z1 + 0.05, 'S', 2.2);
  }
  // A: boxes, as far back as they go
  for (const [x, z, f] of [[3.6, -7.0, 'S'], [5.2, -7.0, 'S'], [3.6, -5.2, 'E'], [5.2, -5.4, 'W']]) w.prop('shelving', x, z, f, { solid: false });
  for (let i = 0; i < 9; i++) w.vox(() => archiveBox(i), 3.5 + (i % 4) * 0.52, -4.1 - Math.floor(i / 4) * 0.5, i * 0.3, { y: Math.floor(i / 8) * 0.28 });
  tag(`${(projects[1] || 'PAYROLL').toUpperCase()} — DO NOT OPEN`, 4.4, 0.34, -3.78);
  // B: what was sat at, and on, and looked at
  w.prop('desk', 6.6, -6.6, 'S', { solid: false });
  const upturned = w.prop('desk', 6.6, -6.6, 'S', { solid: false, y: DESK_H * VOXEL * 2 }); upturned.rotation.z = Math.PI;
  for (let i = 0; i < 4; i++) { const c = w.prop('chair', 7.9 + (i % 2) * 0.3, -6.7 + Math.floor(i / 2) * 0.5, i, { solid: false, o: { color: ['#4a7a6a', '#b5483f', '#5a5a66', '#3f7f9a'][i] }, y: i > 1 ? 0.78 : 0 }); if (i > 1) c.rotation.z = Math.PI; }
  for (let i = 0; i < 5; i++) w.prop('crt', 6.2 + i * 0.5, -4.2 - (i % 2) * 0.35, 'N', { solid: false, y: i === 2 ? 0.34 : 0 });
  w.prop('planttall', 8.2, -4.1, 'S', { solid: false });
  // C: what was left over from fitting out somewhere. Not here: nothing down here is that colour
  w.vox(() => roll('carpet'), 9.9, -6.9, 0.05, { cast: true });
  w.vox(() => roll('carpet'), 9.9, -6.55, -0.04, { y: 0.02 });
  w.vox(() => roll('carpet'), 9.85, -6.72, 0.02, { y: 0.24 });
  for (let i = 0; i < 6; i++) w.vox(() => roll('paper'), 9.3 + (i % 3) * 0.12, -4.3 - Math.floor(i / 3) * 0.14, Math.PI / 2 + i * 0.07, { y: Math.floor(i / 3) * 0.125, cast: false });
  w.box(10.4, 0, -4.9, 11.1, 0.5, -4.2, '#d9d4c0', { cast: true });                                   // a stack of ceiling tiles
  for (let y = 0.05; y < 0.5; y += 0.05) w.box(10.39, y, -4.91, 11.11, y + 0.006, -4.19, '#8a8676', { cast: false });
  w.add(w.sign('EXIT', { height: 0.2, bg: '#1f8a4e', fg: '#eafff0', size: 14 }), 10.9, -7.3, 'S', 0.12).rotation.x = -0.25;      // and a sign, for the door there is not

  /* ---- everything else that ends up in a basement ---------------------------------------------------- */
  for (const [x, z, f, i] of [[5.0, 2.6, 'S', 0], [6.1, 2.7, 'W', 1], [5.1, 3.7, 'E', 2], [6.2, 3.8, 'S', 3], [9.6, 4.9, 'N', 4]]) w.prop('boxes', x, z, f, { id: `basement:boxes${i}`, o: { variant: i % 3 } });
  paint('TO BE SORTED', 5.6, 0.4, ROOM.z1 - 0.012, 'N', 0.2);
  w.prop('printer', 8.6, 5.2, 'N'); w.prop('vending', 10.9, 3.6, 'W');
  w.prop('ladder', 11.2, 0.6, 'W'); w.prop('shelving', 11.5, -1.6, 'W'); w.prop('cooler', -3.6, 5.3, 'N'); w.prop('cooler', -4.3, 5.3, 'N');
  w.prop('bin', -5.2, 5.4, 'N'); w.prop('bin', 3.2, 5.4, 'N');
  for (let i = 0; i < 4; i++) w.prop('chair', -7.2 + (i % 2) * 0.12, 4.9, 'N', { solid: i === 0, y: i * 0.22, o: { color: '#5a5a66' }, footprint: [0.55, 0.55] });
  paint('NO STORAGE IN THIS AREA', 7.6, 1.5, ROOM.z1 - 0.012, 'N', 0.18, '#7a2a22');

  /* ---- the back of the cages, and the wall there ----------------------------------------------------- */
  const zN = ROOM.z0, mid = (SOFT.x0 + SOFT.x1) / 2;
  hang(pic(damp(), { transparent: true }), 1.5, 1.88, mid + 0.05, 0.96, zN + 0.012, 'S');
  const odd = tubeLight(mid, zN + 0.75, '#fff0a8', 9);                                                 // the tube over it is not the one the others are
  // somebody was moving boxes when they stopped. The boxes did not
  const truck = w.vox(sackTruck, 11.05, zN + 0.3, 'N'); truck.rotation.x = 0.16;
  w.vox(() => archiveBox(1), 11.05, zN + 0.04, 0.02, { y: 0.05 });
  w.vox(() => archiveBox(2), 11.03, zN - 0.02, -0.05, { y: 0.33 });
  w.vox(() => archiveBox(0), 11.08, zN - 0.11, 0.09, { y: 0.61 });
  w.block(10.7, zN, 11.5, zN + 0.62);
  // barrier tape, tied to the mesh and never still: there is a draught down here, and it is going somewhere
  const tapes = [];
  for (let i = 0; i < 9; i++) { const m = w.box(-0.07, -0.022, -0.002, 0.07, 0.022, 0.002, i % 2 ? '#e8e2d0' : '#b5281c', { cast: false }); tapes.push(m); }
  const tie = new THREE.Vector3(mid - 0.5, 1.32, CAGE.z0 - 0.02), pull = new THREE.Vector3(0.42, -0.2, -0.88).normalize();
  // …and the paper that goes with it. Under the wall, in the end
  const sheet = hang(w.own(new THREE.MeshLambertMaterial({ color: '#efe9d8', side: THREE.DoubleSide })), 0.21, 0.297, 0, 0.014, 0, 'S');
  sheet.rotation.x = -Math.PI / 2;
  let slide = 2.5, from = [mid - 0.4, CAGE.z0 - 0.15, 0.3];
  for (const [dx, dz, r] of [[-0.3, 0.1, 0.4], [0.45, 0.07, 1.2], [0.1, 0.16, 2.6]]) { const p = hang(sheet.material, 0.21, 0.297, mid + dx, 0.012, zN + dz, 'S'); p.rotation.x = -Math.PI / 2; p.rotation.z = r; }

  /* ---- what is behind it ------------------------------------------------------------------------------ */
  // Nothing, for a long way down — and then the back of somebody else's ceiling: far more of it than there is building
  // over it, its tubes leaking up through the gaps, and one tile that is not there. Nobody sees any of this who has not
  // gone through the wall: it is not drawn until then (from in here, the dark round a basement is only dark).
  const DEEP = -27, under = new THREE.Group();
  under.visible = false; scene.add(under);
  const gap = new THREE.Mesh(w.own(new THREE.PlaneGeometry(0.6, 0.6).rotateX(-Math.PI / 2)), w.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.3, 1.2), toneMapped: false })));
  under.add(gap);
  const upGlow = w.lamp(mid, -9, zN - 2.6, '#ffe2a0', 0, 24);          // what comes up from it, on whoever is on the way down (there from the start, at nothing: a light that arrives late is a stall)
  {
    const tiles = w.own(canvasTexture(16, 16, (g) => { g.fillStyle = '#6b6658'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#8d8777'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); }));
    tiles.repeat.set(320 / 0.6, 320 / 0.6);
    // (dimmer with distance, by hand, tile backs and tubes alike: it is the fading that makes it look as if it goes on)
    const sheet = w.own(new THREE.PlaneGeometry(320, 320, 40, 40).rotateX(-Math.PI / 2)), at = sheet.attributes.position, tint = new Float32Array(at.count * 3);
    for (let i = 0; i < at.count; i++) { const k = 0.16 / (1 + (Math.hypot(at.getX(i), at.getZ(i)) / 38) ** 2); tint.set([k, k * 0.96, k * 0.8], i * 3); }
    sheet.setAttribute('color', new THREE.BufferAttribute(tint, 3));
    const backs = new THREE.Mesh(sheet, w.own(new THREE.MeshBasicMaterial({ map: tiles, vertexColors: true, toneMapped: false })));
    backs.position.set(mid, DEEP, zN); under.add(backs);
    // the tubes: a grid of them, in rooms — a row missing where a wall would be, a room here and there with its lights off
    const h2 = (a, b) => { let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const mod = (a, n) => ((a % n) + n) % n, spots = [];
    for (let i = -46; i <= 46; i++) for (let j = -46; j <= 46; j++) {
      const bi = Math.floor(i / 5), bj = Math.floor(j / 4);
      if (h2(bi, bj) < 0.2 || (mod(i, 5) === 0 && h2(bi, bj + 77) < 0.75) || (mod(j, 4) === 0 && h2(bi + 77, bj) < 0.75) || h2(i, j) < 0.1) continue;
      spots.push([i * 3.0 + (h2(bi, bj + 5) - 0.5) * 0.6, j * 2.4, h2(bi, bj + 9)]);
    }
    const tubes = new THREE.InstancedMesh(w.own(new THREE.PlaneGeometry(0.6, 1.2).rotateX(-Math.PI / 2)), w.own(new THREE.MeshBasicMaterial({ toneMapped: false })), spots.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    spots.forEach(([x, z, room], i) => {
      tubes.setMatrixAt(i, m4.makeTranslation(mid + x, DEEP + 0.02, zN + z));
      const k = 1.3 / (1 + (Math.hypot(x, z) / 44) ** 2);
      tubes.setColorAt(i, col.setRGB(k, k * (0.84 + room * 0.08), k * (0.42 + room * 0.2)));
    });
    tubes.frustumCulled = false;
    w.own(tubes); under.add(tubes);
  }

  /* ---- time -------------------------------------------------------------------------------------------- */
  // the hum that is not the plant's. It belongs to somewhere else, and it is loudest at the wall
  w.bed('backrooms-hum', { volume: 0.012 });
  let hum = null, humAt = -1, shown = -1, figure = 0, figureAt = 14 + Math.random() * 20;
  try { hum = office.sound?.ambience?.('backrooms-hum', { volume: 0.012 }) ?? null; } catch { hum = null; }
  let held = 0, last = { x: 0, z: 0 }, lookBack = null;
  let going = null;                                     // { x, t, v }: where the wall took you, how long ago, how fast you are falling
  const ctx = cctv.image.getContext('2d'), chip = w.root.querySelector('.level-chip');
  const eased = (k) => { const q = Math.max(0, Math.min(1, k)); return q * q * (3 - 2 * q); };
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  // What happens once the wall gives, in seconds from then. You walk on into it, and for a moment that is all (you
  // have been watching yourself go under for as long as you leaned) · the camera comes after you, through a stretch
  // of wall of its own, and finds you some way out over nothing and still walking · you stop, and look down · and then
  // down is where you go.
  const IN = 0.55, OUT = 1.85, DROP = OUT + 0.4, GONE = DROP + 1.6;
  const SUNK = 0.275;                                  // how far into the wall leaning gets you before it gives, metres (you stay that far ahead of yourself afterwards)

  function through() {
    going = { x: w.me.x, t: 0, v: 0 };
    count.in++; trips.save(count); chalk();
    gap.position.set(going.x, DEEP + 0.03, zN - 2.3 - SUNK);
    upGlow.position.x = going.x;
    w.sfx('noclip');
    w.walkTo(going.x, zN - 0.75, 0.6).then(() => w.walkTo(going.x, zN - 2.3, OUT - 0.6));
  }
  /** Where the camera is and what it looks at, `t` seconds after the wall gave at x → [position, target, fov]. */
  function shot(x, t) {
    // just through, and off to one side: you in the near half of the picture, and the whole of it out to where it stops being lit
    const brink = [[x + 2.2, 1.7, zN - 0.6], [x - 18.8, -8.8, zN - 30.6]];
    // …and then down, after whoever is falling into it — and, at the last, after them
    const d = eased((t - DROP) / 0.9), tip = Math.max(0, t - GONE + 0.5);
    return [[brink[0][0], brink[0][1] - tip * tip * 9, brink[0][2] - tip * 0.8], mix(brink[1], [x - 0.3, DEEP, zN - 3.6], d), 54];
  }

  w.onFrame((dt, t) => {
    // lights: the ordinary ones are ordinary; the one over the wall cannot settle
    const k = Math.sin(t * 13.7) * Math.sin(t * 3.1 + 1) > 0.62 ? 0.25 : Math.sin(t * 31) > 0.96 ? 0.6 : 1;
    // (…until the wall has somebody: then it has done what it was for, and goes out)
    const lit = going ? (going.t < 0.5 ? (Math.sin(going.t * 80) > 0 ? 1.4 : 0.15) : 0.03) : k * (1 + held * 0.4);
    odd.tube.color.copy(odd.color).multiplyScalar(lit); odd.lamp.intensity = 9 * lit;
    // the draught
    const gust = 0.6 + 0.4 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 2) + held * 0.9;
    tapes.forEach((m, i) => {
      const s = (i + 0.5) * 0.14, wave = Math.sin(t * (5.2 + i * 0.3) - i * 0.9) * 0.012 * i * gust;
      m.position.set(tie.x + pull.x * s, tie.y + pull.y * s * (1.6 - gust * 0.5) - s * s * 0.12 + wave, tie.z + pull.z * s + Math.cos(t * 4.1 - i) * 0.008 * i * gust);
      m.rotation.set(Math.sin(t * 6 - i * 0.8) * 0.5 * gust, Math.atan2(pull.x, pull.z) + Math.PI / 2 + wave * 6, 0);
    });
    slide += dt * (0.16 + 0.1 * gust);
    if (slide > 1.9) { slide = 0; from = [mid - 0.5 + Math.random() * 0.7, CAGE.z0 - 0.1, Math.random() * 3]; }
    const q = Math.min(1, slide), ease = q * q * (3 - 2 * q);
    sheet.position.set(from[0] + (mid + 0.15 - from[0]) * ease, 0.014 + Math.sin(q * 9) * 0.004, from[1] + (zN - 0.2 - from[1]) * ease);
    sheet.rotation.z = from[2] + q * 0.8;
    // his monitor
    if (Math.floor(t * 4) !== shown) {
      shown = Math.floor(t * 4);
      figureAt -= 0.25;
      if (figureAt < 0) { figure = figure ? 0 : 1; figureAt = figure ? 1.5 + Math.random() * 2 : 16 + Math.random() * 30; }      // now and then somebody is standing in that doorway. Then nobody is
      drawCctv(ctx, 96, 72, t, figure); cctv.needsUpdate = true;
    }
    // the wall
    const me = w.me, near = Math.max(0, 1 - Math.hypot(me.x - mid, me.z - zN) / 7);
    if (hum && Math.abs(near - humAt) > 0.03) { humAt = near; hum.volume(0.012 + 0.3 * near * near, 0.6); }
    if (going) {
      const g = going;
      g.t += dt;
      w.avatar.figure.visible = g.t > 0.3 || Math.sin(t * 61) > -0.5;
      if (g.t > OUT) w.avatar.head.rotation.x += 0.8 * eased((g.t - OUT) / 0.22);                // you look down. There is a lot of down
      if (g.t > DROP) { g.v += 11 * dt; drop -= g.v * dt; w.avatar.root.rotation.x += dt * 2.2; w.avatar.root.rotation.z += dt * 0.9; }
      if (g.t > IN) {
        if (!under.visible) { under.visible = true; upGlow.intensity = 80; if (chip) { chip.style.transition = 'opacity .5s'; chip.style.opacity = '0'; } }     // (it is not the basement, out there)
        // (asked for again every frame: a key still held down would otherwise hand the camera back to you)
        const [pos, look, fov] = shot(g.x, g.t);
        w.focus(pos, look, { fov });
      }
      if (g.t > GONE) w.leave('noclip', { walk: false });
      return;
    }
    if (lookBack !== null) { if (me.moving) lookBack = null; else me.heading += turnTo(me.heading, lookBack) * Math.min(1, dt * 5); }
    const still = Math.hypot(me.x - last.x, me.z - last.z) < 0.6 * dt;                      // trying to walk, and getting nowhere
    last = { x: me.x, z: me.z };
    // (within a stride of it: on a machine that is struggling a stride is long, and you stop that far short of a wall)
    const pressing = !me.script && me.moving && still && me.z < zN + 0.56 && me.x > SOFT.x0 && me.x < SOFT.x1 && Math.abs(turnTo(me.heading, Math.PI)) < 0.85;
    held = pressing ? held + dt : Math.max(0, held - dt * 2);
    // the first sign that it is working is that less of you is on this side of it
    w.avatar.figure.position.z = Math.min(1, held / SOFT.lean) * SUNK;
    w.avatar.figure.visible = held < SOFT.lean * 0.45 || Math.sin(t * 61) > -0.5;
    if (held >= SOFT.lean) through();
  });

  // back out of the wall you went into: nothing is said about where you have been
  if (back) {
    w.me.x = mid; w.me.z = zN - 0.75; w.me.heading = 0;
    w.cam.yaw = 0; w.cam.pitch = 0.6; w.cam.dist = 7.5;
    // by the way out, you walk out of it and are pleased with yourself; any other way, you are put out of it, and look round at it
    if (back === 'exit') w.walkTo(mid - 0.1, zN + 1.5, 0.9).then(() => { w.me.hop = 1; });
    else w.walkTo(mid + 0.15, zN + 1.1, 0.45).then(() => { lookBack = Math.PI * 0.94; });
  }
  return w.run();
}
