// The Office — the lift, as built on every floor: a doorway with two sliding
// leaves, a floor display over it, a call plate beside it, and enough of the
// car behind to believe in. The kit (kit.js) stands one of these in each
// level; the ride (ride.js) borrows the same pieces to show the car from
// inside.
import * as THREE from 'three';
import { buildProp } from '../props/index.js';
import { LIFT, LIFT_DISPLAY } from '../props/lift.js';
import { VOXEL } from '../vox/vox.js';
import { FLOORS, WALLS, canvasTexture } from '../scene/textures.js';
import { HOME, levelById } from '/core/levels.mjs';

/** Sizes in metres. The doorway is LIFT.open × LIFT.height voxels; the car is wider than its door, so the leaves have somewhere to go. */
export const CAR = Object.freeze({
  door: LIFT.open * VOXEL, doorH: LIFT.height * VOXEL, leaf: LIFT.leaf * VOXEL,
  w: 2.4, d: 1.8, h: 2.3, shellH: 2.8,
});

const AMBER = '#ffb44a';

/** One textured quad: corners counter-clockwise seen from the side it faces. */
export function quad(material, a, b, c, d, uv = [0, 0, 1, 1]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * A small LED display: a letter or two in amber on black, with an arrow when
 * the car is moving. Returns { texture, material, set(text, arrow, color) }.
 */
export function ledDisplay(w = 64, h = 36) {
  let shown = null;
  const texture = canvasTexture(w, h, () => {}, { clamp: true });
  texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
  const g = texture.image.getContext('2d');
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  material.color.setScalar(1.25);
  function set(text, arrow = 0, color = AMBER) {
    const key = `${text}|${arrow}|${color}`;
    if (key === shown) return;
    shown = key;
    g.fillStyle = '#0b0a0e'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(h * 0.78)}px ui-monospace, Menlo, Consolas, monospace`;
    g.fillText(String(text), w / 2 + (arrow ? h * 0.22 : 0), h / 2 + 1);
    if (arrow) {                                               // ▲ or ▼, left of the letter
      const x = h * 0.36, y = h / 2, r = h * 0.2;
      g.beginPath(); g.moveTo(x - r, y + r * arrow); g.lineTo(x + r, y + r * arrow); g.lineTo(x, y - r * arrow); g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);     // the gaps between the LEDs
    texture.needsUpdate = true;
  }
  set('');
  return { texture, material, set, dispose() { texture.dispose(); material.dispose(); } };
}

/**
 * A lift doorway for a level.
 *
 * The group's origin is the middle of the threshold, on the floor; the doors
 * face +z and the car lies behind them (toward −z).
 *
 * @param {{floor?:string, shell?:object, front?:boolean}} [opt]
 *        floor: what the display shows · shell: a WALLS style for the outside of the shaft
 *        front: false when the level's own wall has the doorway in it (the shaft then has no face of its own)
 */
export function createLiftDoor(opt = {}) {
  const group = new THREE.Group();
  const trash = [];
  const own = (x) => { trash.push(x); return x; };
  const add = (mesh) => { own(mesh.geometry); group.add(mesh); return mesh; };
  const W = CAR.w / 2, D = CAR.d, H = CAR.h, SH = CAR.shellH, half = CAR.door / 2;

  group.add(buildProp('liftframe', { id: 'liftframe' }));
  const leaves = [-1, 1].map((side) => {
    const leaf = buildProp('liftleaf', { id: 'liftleaf' });
    leaf.position.z = -0.06;
    group.add(leaf);
    return leaf;
  });
  const plate = buildProp('callplate', { id: 'callplate' });
  plate.position.set(half + 0.36, 0.7, 0);
  group.add(plate);
  // the plate is sculpted showing the office's own floor (it hangs there too); here its little window shows this floor
  const here = ledDisplay(28, 32);
  const window_ = new THREE.Mesh(own(new THREE.PlaneGeometry(6 * VOXEL, 7 * VOXEL)), here.material);
  window_.position.set(half + 0.36, 0.7 + 18.5 * VOXEL, 1.06 * VOXEL);
  group.add(window_);
  here.set(opt.floor || levelById(HOME).floor);
  own(here);

  const display = ledDisplay();
  const screen = new THREE.Mesh(own(new THREE.PlaneGeometry(LIFT_DISPLAY.w * VOXEL, LIFT_DISPLAY.h * VOXEL)), display.material);
  screen.position.set(LIFT_DISPLAY.x * VOXEL, LIFT_DISPLAY.y * VOXEL, LIFT_DISPLAY.z * VOXEL);
  group.add(screen);
  display.set(opt.floor || levelById(HOME).floor);

  // the car you can see into while the doors are open
  const steel = WALLS.steel(), tile = FLOORS.tile('#8a8f98', '#7d828b');
  const wallMat = own(new THREE.MeshLambertMaterial({ map: steel.tex }));
  const u = (m) => m / steel.tile;
  add(quad(own(new THREE.MeshLambertMaterial({ map: tile.tex })), [-W + 0.05, 0.004, -0.02], [W - 0.05, 0.004, -0.02], [W - 0.05, 0.004, -D], [-W + 0.05, 0.004, -D], [0, 0, CAR.w, D]));
  add(quad(wallMat, [-W + 0.05, 0, -D], [W - 0.05, 0, -D], [W - 0.05, H, -D], [-W + 0.05, H, -D], [0, 0, u(CAR.w), H / 2.6]));
  add(quad(wallMat, [-W + 0.05, 0, -0.02], [-W + 0.05, 0, -D], [-W + 0.05, H, -D], [-W + 0.05, H, -0.02], [0, 0, u(D), H / 2.6]));
  add(quad(wallMat, [W - 0.05, 0, -D], [W - 0.05, 0, -0.02], [W - 0.05, H, -0.02], [W - 0.05, H, -D], [0, 0, u(D), H / 2.6]));
  add(quad(own(new THREE.MeshLambertMaterial({ color: '#c9ccd2' })), [-W, H, -D], [W, H, -D], [W, H, -0.02], [-W, H, -0.02]));
  const lampMat = own(new THREE.MeshBasicMaterial({ color: '#fff1d6', toneMapped: false }));
  lampMat.color.multiplyScalar(1.5);
  const lamp = add(quad(lampMat, [-0.7, H - 0.01, -D + 0.3], [0.7, H - 0.01, -D + 0.3], [0.7, H - 0.01, -0.5], [-0.7, H - 0.01, -0.5]));
  lamp.receiveShadow = false;
  const rail = new THREE.Mesh(own(new THREE.BoxGeometry(CAR.w - 0.3, 0.05, 0.05)), own(new THREE.MeshLambertMaterial({ color: '#9a6a3c' })));
  rail.position.set(0, 0.82, -D + 0.07);
  group.add(rail);
  const light = new THREE.PointLight('#ffe2b8', 0, 6, 1.6);
  light.position.set(0, H - 0.4, -D / 2);
  group.add(light);

  // the shaft it rides in, from outside
  const shell = opt.shell || WALLS.brick();
  const shellMat = own(new THREE.MeshLambertMaterial({ map: shell.tex }));
  const su = (m) => m / shell.tile, sv = SH / 2.6;
  add(quad(shellMat, [W, 0, -D - 0.1], [-W, 0, -D - 0.1], [-W, SH, -D - 0.1], [W, SH, -D - 0.1], [0, 0, su(CAR.w), sv]));
  add(quad(shellMat, [-W, 0, -D - 0.1], [-W, 0, 0], [-W, SH, 0], [-W, SH, -D - 0.1], [0, 0, su(D), sv]));
  add(quad(shellMat, [W, 0, 0], [W, 0, -D - 0.1], [W, SH, -D - 0.1], [W, SH, 0], [0, 0, su(D), sv]));
  if (opt.front !== false) {
    add(quad(shellMat, [-W, 0, 0], [-half, 0, 0], [-half, SH, 0], [-W, SH, 0], [0, 0, su(W - half), sv]));
    add(quad(shellMat, [half, 0, 0], [W, 0, 0], [W, SH, 0], [half, SH, 0], [su(W + half), 0, su(CAR.w), sv]));
    add(quad(shellMat, [-half, CAR.doorH, 0], [half, CAR.doorH, 0], [half, SH, 0], [-half, SH, 0], [su(W - half), CAR.doorH / 2.6, su(W + half), sv]));
  }
  const capMat = own(new THREE.MeshLambertMaterial({ color: '#5a626e' }));
  const eave = opt.front === false ? 0 : 0.08;                  // set into a wall, the shaft's roof stops at the wall
  const cap = new THREE.Mesh(own(new THREE.BoxGeometry(CAR.w + 0.16, 0.14, D + 0.18 + eave)), capMat);
  cap.position.set(0, SH + 0.07, -(D + 0.18 - eave) / 2 - 0.01 * (eave ? 0 : 1)); cap.castShadow = true;
  const motor = new THREE.Mesh(own(new THREE.BoxGeometry(1.1, 0.45, 1.0)), own(new THREE.MeshLambertMaterial({ color: '#6d7582' })));
  motor.position.set(0.2, SH + 0.36, -D / 2); motor.castShadow = true;
  group.add(cap, motor);
  for (const m of group.children) if (m.isMesh && m.material === shellMat) m.castShadow = true;

  let open = 0;
  function setOpen(k) {
    open = Math.max(0, Math.min(1, k));
    leaves[0].position.x = -CAR.leaf / 2 - CAR.leaf * open;
    leaves[1].position.x = CAR.leaf / 2 + CAR.leaf * open;
    light.intensity = 5 * Math.min(1, open * 3);
  }
  setOpen(0);

  return {
    group, display, light,
    get open() { return open; },
    setOpen,
    setFloor: (text, arrow, color) => display.set(text, arrow, color),
    /** The shaft's footprint, for whoever keeps people from walking through it: [x0, z0, x1, z1] in the group's own frame. */
    footprint: [-W, -D - 0.1, W, 0.06],
    dispose() { for (const t of trash) t.dispose?.(); display.dispose(); },
  };
}
