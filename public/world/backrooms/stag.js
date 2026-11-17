// The Backrooms — The Coat-Rack Buck (`forest` centerpiece hunter).
//
// Built by an indoor simulation reconstructing a "forest stag" from office
// furniture catalogues and HR offsite clip-art ("tall wooden stand with
// branching hooks for coats, four curved legs, proud antlers, visitor tag"):
//   - Body: gaunt, elongated stag torso upholstered in stitched grey acoustic
//     cubicle-divider felt over a turned mahogany coat-stand spindle, with a
//     laminated `VISITOR` pass swinging on a green lanyard at its brisket.
//   - 4 Articulated Legs: steam-bent walnut coat-rack legs (`FL, FR, BL, BR`)
//     joined by tarnished brass ferrules and ending in twin-wheel office chair
//     castors that click and scrape like hooves. At `unfold = 0` (`rack`), the
//     body tilts upright and gathers all four legs into a tall coat-stand
//     silhouette; when woken (`unfold = 1`), it drops into a 2-metre stag
//     stance and charges at 5.7 m/s.
//   - Head & 10-Point Coat-Hook Antlers: weathered birchwood-and-bone cervine
//     skull with hollow dark eye sockets, pale tapetum glints, and a wide crown
//     of brass ball-tipped coat hooks — still carrying a beige trenchcoat
//     sleeve and a hooked black umbrella that whip in the wind as it charges.

import * as THREE from 'three';
import { Vox, M, glow } from '../vox/vox.js';
import { Batch, lamp } from './kit.js';
import { clamp } from './bits.js';
import { buckGait } from './forest.rule.js';

export const STAG_VOX_SCALE = 0.026; // 2.6 cm per voxel

function makeFelt() {
  const tones = ['#5c615e', '#4f5451', '#696e6a', '#444845'].map((k) => M(k, 2));
  const seam = M('#8e948f', 1);
  return (x, y, z) => {
    if (Math.abs(x) <= 0.6 && (Math.abs(y + z) % 3) < 1) return seam;
    const h = Math.sin(x * 0.71 + z * 0.53) + Math.cos(y * 0.89 - z * 0.44);
    return tones[Math.abs(Math.floor(h * 1.8 + 7)) % tones.length];
  };
}

function makeBentwood() {
  const woods = ['#5c3822', '#4a2b18', '#6e452b', '#3d2212'].map((k) => M(k, 1));
  return (x, y, z) => {
    const g = Math.sin(y * 0.45 + x * 0.25 + z * 0.22);
    return woods[Math.abs(Math.floor(g * 2.1 + 5)) % woods.length];
  };
}

const PAL = () => ({
  brass: M('#b8923a', 0),
  brassDark: M('#7a5d20', 1),
  steel: M('#9aa3a8', 0),
  castor: M('#1b1e22', 1),
  bone: M('#dfd8c5', 2),
  boneShade: M('#bfb69f', 2),
  socket: M('#070807', 0),
  tapetum: glow('#d9f5b8'),
  lanyard: M('#236b42', 1),
  badgeWhite: M('#eef2ee', 1),
  badgeRed: M('#b83228', 1),
  trench: M('#cbb894', 2),
  trenchShade: M('#a5926f', 2),
  umbrella: M('#181c22', 1),
  bark: M('#463222', 2),
});

function torsoVox() {
  const v = new Vox(), c = PAL(), felt = makeFelt(), wood = makeBentwood();
  // Turned mahogany coat-rack spine running from tail-post (+Z/-Z: +Z is forward)
  v.tube(0, 2, -16, 0, 3.5, 16, 2.3, wood);
  for (const rz of [-13, -5, 4, 13]) {
    v.ellipsoid(0, 2.8, rz, 3.1, 3.1, 1.5, c.brassDark);
  }

  // Deep cervine chest & tucked flank in stitched cubicle felt
  v.ellipsoid(0, 2.4, 8.5, 6.8, 7.6, 9.2, felt);
  v.ellipsoid(0, 3.0, -6.5, 5.8, 6.2, 8.8, felt);
  // Carved rib-grooves along the felt flanks + metal upholstery staples
  for (const rz of [2, 5.5, 9, 12.5]) {
    v.carve(-7.2, -1.5, rz - 0.6, -5.2, 5.2, rz + 0.6);
    v.carve(5.2, -1.5, rz - 0.6, 7.2, 5.2, rz + 0.6);
    v.box(-6.0, 2.0, rz - 0.4, -5.3, 2.8, rz + 0.4, c.steel);
    v.box(5.3, 2.0, rz - 0.4, 6.0, 2.8, rz + 0.4, c.steel);
  }
  // Stub tail made of a frayed coat-brush tuft
  v.tube(0, 5.5, -14.5, 0, 8.2, -18.5, 1.7, wood);
  v.ellipsoid(0, 8.8, -19.2, 2.1, 2.4, 2.1, c.trench);

  // Laminated VISITOR / OFFSITE badge hanging from brisket on green lanyard
  v.tube(-3.4, 6.2, 14.5, -0.5, -4.5, 16.2, 0.65, c.lanyard);
  v.tube(3.4, 6.2, 14.5, 0.5, -4.5, 16.2, 0.65, c.lanyard);
  v.rbox(-2.4, -9.2, 15.8, 2.4, -4.4, 16.8, 0.4, c.badgeWhite);
  v.box(-2.2, -5.8, 16.5, 2.2, -4.6, 17.0, c.badgeRed);
  return v;
}

function upperLegVox(isFront) {
  const v = new Vox(), c = PAL(), wood = makeBentwood(), felt = makeFelt();
  // Descends from hip (0,0,0) down to brass knee ferrule at (0, -17, 0)
  v.ellipsoid(0, -1.5, 0, 2.8, 3.2, 2.8, isFront ? felt : wood);
  const N = 5;
  for (let i = 0; i < N; i++) {
    const t0 = i / N, t1 = (i + 1) / N;
    const z0 = Math.sin(t0 * Math.PI) * (isFront ? -1.4 : 1.8);
    const z1 = Math.sin(t1 * Math.PI) * (isFront ? -1.4 : 1.8);
    v.tube(0, -t0 * 17, z0, 0, -t1 * 17, z1, 2.15 - t0 * 0.45, wood);
  }
  // Tarnished brass coat-stand joint collar at knee
  v.cyl('y', 0, 0, -18.2, -15.6, 2.1, c.brass);
  return v;
}

function lowerLegVox() {
  const v = new Vox(), c = PAL(), wood = makeBentwood();
  // Descends from knee (0,0,0) to twin-wheel office chair castor hoof at (0, -19, 0)
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5, t1 = (i + 1) / 5;
    const z0 = Math.sin(t0 * Math.PI) * 1.2, z1 = Math.sin(t1 * Math.PI) * 1.2;
    v.tube(0, -t0 * 16.5, z0, 0, -t1 * 16.5, z1, 1.55 - t0 * 0.25, wood);
  }
  // Brass ankle socket + cloven twin-wheel office chair castor ("hoof")
  v.cyl('y', 0, 0, -17.6, -15.8, 1.75, c.brassDark);
  v.rbox(-2.0, -19.2, -1.6, 2.0, -17.2, 2.0, 0.5, c.steel);
  v.cyl('x', 0, 0.2, -2.3, -0.7, 2.0, c.castor);
  v.cyl('x', 0, 0.2, 0.7, 2.3, 2.0, c.castor);
  return v;
}

function neckSkullAntlersVox() {
  const v = new Vox(), c = PAL(), wood = makeBentwood(), felt = makeFelt();
  // Upright turned coat-stand neck rising from (0,0,0) to skull base (0, 15, 4)
  v.tube(0, 0, 0, 0, 14.5, 3.8, 2.8, felt);
  v.tube(0, 2, -1.2, 0, 15.5, 2.4, 2.0, wood);
  v.cyl('y', 0, 3.0, 11.5, 13.5, 3.1, c.brass);

  // Elongated birch-and-bone stag skull reaching forward (+Z)
  v.ellipsoid(0, 16.8, 6.2, 4.2, 4.0, 5.6, c.bone);
  v.tube(0, 16.2, 8.5, 0, 14.4, 18.2, 2.7, c.bone);
  v.tube(0, 13.6, 8.0, 0, 12.5, 16.8, 1.7, c.boneShade);
  // Dark nasal cavity & parted jaw seam
  v.carve(-1.4, 13.8, 16.5, 1.4, 15.2, 19.2);
  // Sunken hollow eye sockets + glowing pale-green tapetum glints
  for (const sx of [-1, 1]) {
    v.carve(sx * 4.6, 15.6, 5.2, sx * 2.6, 18.2, 8.2);
    v.ellipsoid(sx * 3.2, 16.9, 6.7, 1.2, 1.2, 1.2, c.socket);
    v.set(Math.round(sx * 3.5), 17, 7, c.tapetum);
    // Stitched felt ear-tags pinned sideways like coat loops
    v.tube(sx * 3.5, 18.2, 3.8, sx * 8.2, 20.4, 1.8, 1.15, felt);
  }

  // Magnificent 10-Point Bentwood & Brass Coat-Hook Antler Crown!
  for (const sx of [-1, 1]) {
    // Main sweeping antler beam rising, spreading wide, and curving forward
    const b0 = [sx * 2.4, 19.2, 4.2];
    const b1 = [sx * 8.5, 25.5, 2.2];
    const b2 = [sx * 14.8, 32.0, 5.0];
    const b3 = [sx * 17.5, 38.5, 10.5];
    v.tube(...b0, ...b1, 1.45, wood);
    v.tube(...b1, ...b2, 1.3, wood);
    v.tube(...b2, ...b3, 1.1, wood);
    v.ellipsoid(...b3, 1.65, 1.65, 1.65, c.brass);

    // 4 curved brass double coat-hook tines per side + brow goring tine!
    const tines = [
      // Brow tine (projects straight forward like a coat-hook lance)
      [sx * 5.6, 22.8, 3.2, sx * 6.8, 24.5, 12.2],
      // Bay tine
      [sx * 10.6, 27.6, 3.0, sx * 12.5, 34.2, 9.6],
      // Tray tine (sweeps high)
      [sx * 14.2, 31.5, 4.8, sx * 13.0, 40.5, 5.2],
      // Rear coat-scroll hook
      [sx * 11.8, 29.0, 3.5, sx * 14.5, 26.5, -2.8],
    ];
    for (const [x0, y0, z0, x1, y1, z1] of tines) {
      v.tube(x0, y0, z0, x1, y1, z1, 0.95, c.brassDark);
      v.ellipsoid(x1, y1, z1, 1.45, 1.45, 1.45, c.brass);
    }
  }
  return v;
}

function coatSleeveVox() {
  const v = new Vox(), c = PAL();
  // Crumpled beige trenchcoat sleeve & collar hanging down from the left antler tine
  v.ellipsoid(0, -1.5, 0, 3.2, 2.2, 2.6, c.trenchShade);
  v.tube(0, -2, 0, -1.2, -11, 0.8, 2.4, c.trench);
  v.tube(-1.2, -11, 0.8, -0.4, -19.5, -0.5, 2.1, c.trench);
  v.cyl('y', -0.4, -0.5, -20.5, -18.5, 2.3, c.trenchShade);
  v.box(-2.6, -15, -1.6, 1.2, -13.8, 2.0, c.brassDark); // cuff buckle
  return v;
}

function umbrellaVox() {
  const v = new Vox(), c = PAL(), wood = makeBentwood();
  // Hooked black office umbrella dangling by its J-handle from the right antler tine
  v.tube(0, 0, 0, 0, 2.2, 2.2, 0.75, wood);
  v.tube(0, 2.2, 2.2, 0, -1.2, 3.2, 0.75, wood);
  v.cyl('y', 0, 0, -18, 0.2, 0.65, c.steel);
  v.cyl('y', 0, 0, -17.5, -4.5, 2.3, c.umbrella, 0.8);
  v.cyl('y', 0, 0, -21.0, -17.5, 0.75, c.steel, 0.35);
  return v;
}

/**
 * Build the articulated Coat-Rack Buck rig sharing a single `vox` surface material (8 meshes total).
 */
export function makeCoatRackBuckRig(kit, tag = 'buck') {
  const S = STAG_VOX_SCALE;
  const mat = kit.surface({ vox: true });
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [
    lamp(0.5, 3.2, 1.3, [1.18, 1.22, 1.16], { k: 10, wrap: 0.48, far: 32 }),
    lamp(-0.7, -0.6, 0.5, [0.42, 0.58, 0.40], { k: 4.5, wrap: 0.55, far: 18 }),
  ];

  const geoCache = new Map();
  const makePart = (partKey, fn) => {
    let geo = geoCache.get(partKey);
    if (!geo) {
      const q = new Batch(true);
      q.addVox(kit.model(`forest:stag:${tag}:${partKey}`, fn).solid, m4);
      geo = kit.geometry(q, lights, [0.58, 0.60, 0.56]);
      geoCache.set(partKey, geo);
    }
    return new THREE.Mesh(geo, mat);
  };

  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 0.94, 0);
  bodyPivot.add(makePart('torso', torsoVox));
  group.add(bodyPivot);

  const legDefs = [
    { key: 'fl', sx: -1, sz: 1, x: -4.8, y: 0.5, z: 10.5 },
    { key: 'fr', sx: 1, sz: 1, x: 4.8, y: 0.5, z: 10.5 },
    { key: 'bl', sx: -1, sz: -1, x: -4.4, y: 1.0, z: -9.5 },
    { key: 'br', sx: 1, sz: -1, x: 4.4, y: 1.0, z: -9.5 },
  ];

  const legs = legDefs.map((d) => {
    const hip = new THREE.Group();
    hip.position.set(d.x * S, d.y * S, d.z * S);
    hip.add(makePart(d.sz > 0 ? 'upperF' : 'upperB', () => upperLegVox(d.sz > 0)));

    const knee = new THREE.Group();
    knee.position.set(0, -17 * S, 0);
    knee.add(makePart('lower', lowerLegVox));
    hip.add(knee);

    bodyPivot.add(hip);
    return { ...d, hip, knee };
  });

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 5.2 * S, 13.5 * S);
  headPivot.add(makePart('head', neckSkullAntlersVox));
  bodyPivot.add(headPivot);

  const sleevePivot = new THREE.Group();
  sleevePivot.position.set(-12.5 * S, 33.8 * S, 9.2 * S);
  sleevePivot.add(makePart('sleeve', coatSleeveVox));
  headPivot.add(sleevePivot);

  const umbrellaPivot = new THREE.Group();
  umbrellaPivot.position.set(14.2 * S, 26.5 * S, -2.5 * S);
  umbrellaPivot.add(makePart('umbrella', umbrellaVox));
  headPivot.add(umbrellaPivot);

  const springs = [
    { g: sleevePivot, aX: 0, vX: 0, aZ: 0, vZ: 0, phase: 0 },
    { g: umbrellaPivot, aX: 0, vX: 0, aZ: 0, vZ: 0, phase: 1.9 },
  ];

  function pose({ unfold = 0, stride = 0, speed = 0, time = 0, mode = 'rack', headYaw = 0, dt = 0.016, turnRate = 0 }) {
    const u = clamp(unfold, 0, 1);
    const gait = buckGait(stride, u, mode);

    // At `unfold = 0` (`rack`), the torso tilts nearly vertical (-1.22 rad) like a tall coat-stand spindle!
    const rackPitch = -1.22 * (1 - u);
    const gallopBob = Math.abs(Math.sin(stride)) * 0.065 * u * clamp(speed / 3.5, 0.2, 1.4);
    bodyPivot.position.y = 0.88 + 0.06 * u + gallopBob + (1 - u) * 0.34;
    bodyPivot.rotation.set(
      rackPitch + (mode === 'charge' ? 0.08 : mode === 'wedged' ? 0.22 : 0) * u,
      0,
      Math.sin(stride) * 0.045 * u,
      'YXZ'
    );

    for (let i = 0; i < legs.length; i++) {
      const lg = legs[i], gl = gait.legs[i];
      // Compensate for upright torso pitch when disguised as a coat-rack so legs point downward to the floor
      lg.hip.rotation.x = gl.hipPitch * u - rackPitch;
      lg.hip.rotation.z = gl.hipSplay;
      lg.knee.rotation.x = gl.kneePitch;
    }

    const wedgedShake = mode === 'wedged' ? Math.sin(time * 28) * 0.14 : 0;
    const scrapeNod = mode === 'scrape' ? Math.sin(time * 22) * 0.10 : 0;
    headPivot.rotation.x = (-rackPitch * 0.92) + gait.headPitch * u + scrapeNod;
    headPivot.rotation.y = clamp(headYaw, -0.75, 0.75) * u + wedgedShake;
    headPivot.rotation.z = wedgedShake * 0.6;

    // Secondary cloth/umbrella pendulum springs on the antlers
    const stepDt = clamp(dt, 0.001, 0.05);
    const windBack = clamp(speed / 4.5, 0, 1.3) * 0.65;
    for (const sp of springs) {
      const targetX = -headPivot.rotation.x - bodyPivot.rotation.x - windBack;
      const targetZ = -turnRate * 0.12 - headPivot.rotation.z;
      sp.vX += (22 * (targetX - sp.aX) - 4.2 * sp.vX) * stepDt;
      sp.vZ += (22 * (targetZ - sp.aZ) - 4.2 * sp.vZ) * stepDt;
      sp.aX = clamp(sp.aX + sp.vX * stepDt, -1.35, 1.35);
      sp.aZ = clamp(sp.aZ + sp.vZ * stepDt, -0.95, 0.95);
      const sway = Math.sin(time * 3.4 + stride + sp.phase) * (0.02 + 0.14 * clamp(speed / 3, 0, 1) + (mode === 'scrape' ? 0.12 : 0));
      sp.g.rotation.x = sp.aX + sway;
      sp.g.rotation.z = sp.aZ + sway * 0.6;
    }
  }

  pose({ unfold: 0, stride: 0, speed: 0, time: 0, mode: 'rack' });

  return {
    group,
    bodyPivot,
    headPivot,
    legs,
    pose,
    light(rgb) {
      mat.uniforms.uTint.value.set(
        rgb[0] * 1.34 + 0.06,
        rgb[1] * 1.34 + 0.06,
        rgb[2] * 1.34 + 0.06
      );
    },
  };
}
