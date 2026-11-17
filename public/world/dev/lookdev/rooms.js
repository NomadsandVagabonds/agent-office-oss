// The lab's test rooms. Each is a real floor of the level (seed, kind of floor, rooms dealt), a room on it to stand in,
// and a few named cameras in that room's own frame: [x, z, yaw, pitch] (z = D/2 is the door you came in by; yaw 0 looks in).
// `extras` adds what the level does not have yet, from kit primitives, and says so.
import { Batch, lin } from '../../backrooms/kit.js';

/** A mop bucket, from kit boxes (the wet-floor room has one in a corner; this one stands in the water). */
function bucket(kit, rt, x, z) {
  const b = new Batch();
  b.box(x - 0.16, 0, z - 0.16, x + 0.16, 0.3, z + 0.16, lin('#d8b21c'));
  b.box(x - 0.018, 0, z + 0.17, x + 0.018, 1.25, z + 0.205, lin('#8c6a40'));
  b.box(x - 0.15, 0, z + 0.12, x + 0.15, 0.1, z + 0.28, lin('#cfc8b4'));
  return b;
}

/** Hand-built office furniture from kit boxes, lit by the kit's own bake (banks included), with today's round blot under each. */
function furnish(THREE, kit, rt, items) {
  const b = new Batch(), occ = [], top = lin('#b9ad8f'), leg = lin('#3b3a37'), steel = lin('#8d9196'), seat = lin('#39424e');
  const blots = [];
  for (const it of items) {
    const { x, z } = it;
    if (it.t === 'desk') {
      const w = 1.4, d = 0.7;
      b.box(x - w / 2, 0.72, z - d / 2, x + w / 2, 0.76, z + d / 2, top);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(x + sx * (w / 2 - 0.05) - 0.02, 0, z + sz * (d / 2 - 0.05) - 0.02, x + sx * (w / 2 - 0.05) + 0.02, 0.72, z + sz * (d / 2 - 0.05) + 0.02, leg);
      b.box(x - w / 2 + 0.05, 0.3, z - d / 2 + 0.02, x + w / 2 - 0.05, 0.72, z - d / 2 + 0.04, top);
      b.box(x - 0.25, 0.76, z - 0.2, x + 0.25, 1.1, z - 0.14, lin('#2d2f33'));         // a monitor, from the back
      b.box(x - 0.05, 0.76, z - 0.15, x + 0.05, 0.9, z - 0.1, lin('#2d2f33'));
      occ.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: 0.72, y1: 0.76 }, { x0: x - w / 2 + 0.05, x1: x + w / 2 - 0.05, z0: z - d / 2 + 0.02, z1: z - d / 2 + 0.04, y0: 0.3, y1: 0.72 }, { x0: x - 0.25, x1: x + 0.25, z0: z - 0.2, z1: z - 0.14, y0: 0.76, y1: 1.1 });
      blots.push([x, z, w + 0.24, d + 0.24]);
    } else if (it.t === 'chair') {
      b.box(x - 0.24, 0.42, z - 0.24, x + 0.24, 0.5, z + 0.24, seat);
      b.box(x - 0.24, 0.5, z + 0.18, x + 0.24, 1.0, z + 0.25, seat);
      b.box(x - 0.03, 0, z - 0.03, x + 0.03, 0.42, z + 0.03, leg);
      b.box(x - 0.26, 0, z - 0.03, x + 0.26, 0.04, z + 0.03, leg); b.box(x - 0.03, 0, z - 0.26, x + 0.03, 0.04, z + 0.26, leg);
      occ.push({ x0: x - 0.24, x1: x + 0.24, z0: z - 0.24, z1: z + 0.24, y0: 0.42, y1: 0.5 }, { x0: x - 0.24, x1: x + 0.24, z0: z + 0.18, z1: z + 0.25, y0: 0.5, y1: 1.0 });
      blots.push([x, z, 0.6, 0.6]);
    } else if (it.t === 'cabinet') {
      b.box(x - 0.25, 0, z - 0.3, x + 0.25, 1.32, z + 0.3, steel);
      for (const y of [0.35, 0.68, 1.0]) b.box(x + 0.25, y - 0.01, z - 0.25, x + 0.26, y + 0.01, z + 0.25, lin('#5d6166'));
      occ.push({ x0: x - 0.25, x1: x + 0.25, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 1.32 });
      blots.push([x, z, 0.74, 0.84]);
    }
  }
  const geo = kit.geometry(b, rt.lights, rt.amb, rt.lighting);
  const mesh = new THREE.Mesh(geo, kit.surface({ map: kit.tex.white(), room: rt.u, flick: geo.userData.flick, banks: geo.userData.banks }));
  rt.group.add(mesh); mesh.updateMatrixWorld(true);
  // today's shadow: a round blot (world.js c.shadow: a dark soft patch 0.24 m larger than the thing, strength 0.5)
  const blob = new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false });
  for (const [x, z, w, d] of blots) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blob); q.rotation.x = -Math.PI / 2; q.position.set(x, 0.006, z); q.renderOrder = 1; rt.group.add(q); q.updateMatrixWorld(true);
  }
  return occ;
}

/** The doorway the light comes through: its opening in world space, and the lamps of the lit room behind it. */
function setupDoor(THREE, look, world, rt, def, dr) {
  const U = look.U, m = rt.group.matrixWorld;
  const W = def.W, D = def.D, sill = dr.sill || 0, h = dr.h || 2.05;
  const walls = { back: { n: [0, 0, 1], U: [1, 0, 0], o: [-W / 2, 0, -D / 2], s: dr.c + W / 2 }, front: { n: [0, 0, -1], U: [-1, 0, 0], o: [W / 2, 0, D / 2], s: W / 2 - dr.c },
    left: { n: [1, 0, 0], U: [0, 0, -1], o: [-W / 2, 0, D / 2], s: D / 2 - dr.c }, right: { n: [-1, 0, 0], U: [0, 0, 1], o: [W / 2, 0, -D / 2], s: dr.c + D / 2 } };
  const w = walls[dr.side];      // (world.js WALLS, copied: it is exported, but this keeps the lab to what it reads)
  const at = (s, y) => new THREE.Vector3(w.o[0] + w.U[0] * s, y, w.o[2] + w.U[2] * s);
  const o = at(w.s - dr.w / 2, sill).applyMatrix4(m), u = at(w.s + dr.w / 2, sill).applyMatrix4(m).sub(o);
  U.uDoorO.value.copy(o); U.uDoorU.value.copy(u); U.uDoorV.value.set(0, h, 0);
  U.uDoorN.value.set(...w.n).transformDirection(m);
  const lit = world.rooms[dr.to];
  const lamps = lit.lights.filter((L) => !(L.lobe && Math.abs(L.ay) < 0.5 && L.floor <= 0.11)).map((L) => ({ L, p: new THREE.Vector3(L.x, L.y, L.z).applyMatrix4(lit.group.matrixWorld) }))
    .sort((a, b) => a.p.distanceTo(o) - b.p.distanceTo(o)).slice(0, 8);
  lamps.forEach(({ L, p }, i) => {
    U.uDLampP.value[i].copy(p); U.uDLampC.value[i].set(L.r, L.g, L.b).multiplyScalar(lit.u.dim.value);
    U.uDLampK.value[i].set(L.k, L.far2, L.wrap, L.floor);
    U.uDLampT.value[i].set(0, 0, 0.5).transformDirection(lit.group.matrixWorld).multiplyScalar(0.45);
  });
  U.uDLampN.value = lamps.length;
  look.door = { dr, lit, centre: o.clone().addScaledVector(u, 0.5), n: U.uDoorN.value.clone(), along: u.clone().normalize() };
  return look.door;
}

/** The block figure, in the world (not a room's own frame), its light sampled where it stands. */
function figureAt(THREE, kit, look, root, rtLit) {
  const b = new Batch(), grey = lin('#4a4846');
  b.box(-0.17, 0.0, -0.1, 0.17, 1.2, 0.1, grey);
  b.box(-0.12, 1.22, -0.11, 0.12, 1.48, 0.11, lin('#5a5652'));
  const geo = kit.geometry(b, [], [0.35, 0.35, 0.35]);
  const mesh = new THREE.Mesh(geo, kit.surface({ map: kit.tex.white(), room: rtLit.u }));
  const group = new THREE.Group(); group.add(mesh); root.add(group);
  look.figure = group;
  const boxes = [[0, 0.6, 0, 0.17, 0.6, 0.1], [0, 1.35, 0, 0.12, 0.13, 0.11]];
  return {
    group,
    /** stand it at world (x, z), facing along `yaw` */
    place(x, y, z) {
      group.position.set(x, y, z); group.updateMatrixWorld(true);
      boxes.forEach(([cx, cy, cz, ex, ey, ez], i) => { look.U.uFigC.value[i].set(x + cx, y + cy, z + cz); look.U.uFigE.value[i].set(ex, ey, ez); });
      look.U.uFigN.value = 2;
    },
  };
}

/** Where a room's floor is in the world, as a rectangle (for "this shadow belongs to this room"). */
function rectOf(THREE, r) {
  const a = new THREE.Vector3(-r.def.W / 2, 0, -r.def.D / 2).applyMatrix4(r.group.matrixWorld), b = new THREE.Vector3(r.def.W / 2, 0, r.def.D / 2).applyMatrix4(r.group.matrixWorld);
  return [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)];
}

export const ROOMS = {
  // (1) a lit ordinary room with furniture: the copier room of seed 7's yellow floor, everything in it the level's own.
  // The block figure (hand-built) walks across it, for the moving shadow (d, h2).
  office: {
    seed: 7, themes: ['yellow'], goto: 11,
    cams: { a: [0, 5, 0, -0.15], side: [-2.4, 3.2, -0.55, -0.22] },
    extras({ THREE, kit, look, root, rt }) {
      const fig = figureAt(THREE, kit, look, root, rt);
      look.U.uFigRect.value.set(...rectOf(THREE, rt));
      look.figHandle = fig;
    },
    update(t, look) {
      const p = new THREE_V(0.9 - 0.3 * Math.sin(t * 0.5), 0, 0.6 - 0.25 * t).applyMatrix4(look.rt.group.matrixWorld);
      look.figHandle.place(p.x, p.y, p.z);
    },
  },
  // (1b, h1, h3) a plain room of the same floor in the fluorescent-bank mode (lighting.js), so that a bank can go out. The
  // room is the level's; the desks, chairs and cabinet in it are hand-built from kit boxes (plain rooms are mostly empty).
  // bank=all|out|red (red needs lighting=emergency, the level's own emergency mode, which adds the red wall lamps)
  bank: {
    seed: 7, themes: ['yellow'], goto: 24, lighting: 'failing',
    // corner: the partition across the room (the level's) hides the figure; its shadow lies across the gap in it
    cams: { a: [1.2, 3.3, 0.3, -0.3], corner: [-1.5, 0.8, -0.55, -0.4] },
    banks: { all: [1, 1], out: [1, 0.0025], red: [0.0025, 0.0025, 0.8] },
    build({ THREE, kit, rt }) {
      return { occluders: furnish(THREE, kit, rt, [
        { t: 'desk', x: -0.2, z: -0.9 }, { t: 'chair', x: -0.2, z: -0.25 }, { t: 'desk', x: 2.0, z: -1.5 }, { t: 'chair', x: 2.1, z: -0.8 },
        { t: 'cabinet', x: 3.55, z: -2.9 }, { t: 'cabinet', x: 3.55, z: -2.3 }, { t: 'chair', x: 0.9, z: 1.1 },
      ]) };
    },
    extras({ THREE, kit, look, root, rt }) {
      if (this.camName !== 'corner') return;                // (the figure is only in the corner picture: behind you, out of frame)
      look.figHandle = figureAt(THREE, kit, look, root, rt);
      look.U.uFigRect.value.set(...rectOf(THREE, rt));
    },
    update(t, look) {
      if (!look.figHandle) return;
      const p = new THREE_V(0.8, 0, 1.8 - 0.1 * t).applyMatrix4(look.rt.group.matrixWorld);
      look.figHandle.place(p.x, p.y, p.z);
    },
  },
  // (2, h4) dim, the torch the main light: the copier room again with its lights out (the kit's per-room dimmer at 6%, as
  // the level's black-outs use it), the torch on and pointed past the copiers at the wall
  torch: {
    // (the block figure stands in the beam, 2.5 m ahead, in the picture `figure`: what the torch throws on the wall)
    seed: 7, themes: ['yellow'], goto: 11, torch: true, dim: 0.04, gain: 1.6, torchAim: [-0.035, 0.0, -1],
    cams: { a: [0.2, 4.9, -0.55, -0.06], figure: [2.3, -1.9, -0.1, -0.08] },
    extras({ THREE, kit, look, root, rt, camera }) {
      if (this.camName !== 'figure') return;
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; f.normalize();
      const p = camera.position.clone().addScaledVector(f, 2.5);
      look.figHandle = figureAt(THREE, kit, look, root, rt);
      look.figHandle.place(p.x, rt.group.position.y, p.z);
    },
  },
  // (h5, h2) a dark room of seed 7's night floor looking through a doorway into a lit one (the mailroom). The block figure
  // stands in the mailroom out of sight behind the wall; its shadow comes through the doorway first.
  door: {
    seed: 7, themes: ['night'], only: ['vending', 'mailroom', 'all-hands'], goto: 3, gain: 1.4, dim: 0.06, doorK: 8,
    cams: { a: [-1.0, -1.6, 2.52, -0.4], b: [-0.3, -1.65, 2.3, -0.35], front: [2.5, -0.3, 1.5, -0.3] },
    extras({ THREE, kit, look, root, rt, world, def }) {
      const dr = def.doors.find((d) => d.side === 'left');
      setupDoor(THREE, look, world, rt, def, dr);
      look.figHandle = figureAt(THREE, kit, look, root, world.rooms[dr.to]);
      look.U.uFigRect.value.set(...rectOf(THREE, world.rooms[dr.to]));
    },
    update(t, look) {
      const d = look.door, along = -1.55 + 0.1 * t;         // walking toward the doorway's edge, behind the wall
      const p = d.centre.clone().addScaledVector(d.n, -0.4).addScaledVector(d.along, along);
      look.figHandle.place(p.x, 0, p.z);
    },
  },
  // (3) hard and shiny: lino (Records' floor), brass, the glass of the pneumatic tube: the mailroom on seed 7's archive floor
  shiny: {
    seed: 7, themes: ['archive'], only: ['mailroom'], goto: 'mailroom',
    cams: { a: [0, 3, 0, -0.12], low: [-1.5, 1.6, 0.3, -0.25] },
  },
  // (4) wet: the wet-floor room of seed 7's yellow floor. The flooded patch, the bucket standing in it and the drip are
  // hand-built (the level has no water); the puddle sits on the level's own puddle blot under its own ceiling stain.
  wet: {
    seed: 7, themes: ['yellow'], goto: 'wet-floor',
    cams: { a: [0.7, 0.2, 0.62, -0.38], puddle: [0, 2.5, 0, -0.3] },
    build({ THREE, kit, rt, def }) {
      const b = bucket(kit, rt, -1.1, -2.2);
      const geo = kit.geometry(b, rt.lights, rt.amb);
      const mesh = new THREE.Mesh(geo, kit.surface({ map: kit.tex.white(), room: rt.u })); rt.group.add(mesh); mesh.updateMatrixWorld(true);
      const pz = def.params.puddle;
      const water = {
        level: 0.06,
        pools: [{ cx: -1.4, cz: -2.4, rx: 1.9, rz: 1.1 }, { cx: pz[0] * def.W, cz: pz[1] * def.D, rx: 0.55, rz: 0.45, rough: 0.35 }],
        rings: [[-1.1, -2.2, -0.3, 2.3]],
        drips: [[pz[0] * def.W + 0.1, pz[1] * def.D, 1.7]],
      };
      return { water, occluders: [{ x0: -1.26, x1: -0.94, z0: -2.36, z1: -2.04, y0: 0, y1: 0.3 }] };
    },
  },
  // (5) tall: the all-hands of seed 7's yellow floor (8.3 m), for depth, haze and fog
  tall: {
    seed: 7, themes: ['yellow'], only: ['all-hands'], goto: 'all-hands',
    cams: { a: [0, 10, 0, 0.05] },
    haze: { den: 0.075, fall: 0.12, max: 0.55, light: 3.5 },
  },
};
const THREE_V = class { constructor(x, y, z) { this.v = [x, y, z]; } applyMatrix4(m) { const [x, y, z] = this.v, e = m.elements; return { x: e[0] * x + e[4] * y + e[8] * z + e[12], y: e[1] * x + e[5] * y + e[9] * z + e[13], z: e[2] * x + e[6] * y + e[10] * z + e[14] }; } };
export { bucket, furnish, setupDoor, figureAt };
