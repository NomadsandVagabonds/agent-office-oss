// Procedural textures, industrial props, and Plenum Toner rig for `drop-plenum`.
import * as THREE from 'three';
import { Vox, M, glow } from '../../../vox/vox.js';
import { Batch, drawText, lamp } from '../../kit.js';
import { makeRng } from '../../gen.js';
import { P } from '../../bits.js';

/* ---- Procedural room textures ------------------------------------------------ */

export function makePlenumTextures(c, p) {
  const { kit } = c;

  // Underside of the 2x2 suspended acoustic ceiling grid: white fissured mineral board + aluminum T-bar
  const tileUnder = kit.tex.custom('plenum:tile-under', 64, 64, (g) => {
    P(g, '#c2c5c8', 0, 0, 64, 64);               // extruded aluminum T-bar flange
    P(g, '#9fa4aa', 2, 2, 60, 1);                // shadow reveal lip
    P(g, '#9fa4aa', 2, 2, 1, 60);
    P(g, '#e7e5dc', 3, 3, 58, 58);               // white fissured acoustic tile face
    const rng = makeRng('tile-under-fissure');
    for (let i = 0; i < 95; i++) {
      const x = rng.int(4, 58), y = rng.int(4, 58);
      P(g, i % 4 === 0 ? '#b7b4a8' : '#cfccc0', x, y, rng.int(1, 3), 1);
    }
  });

  // Topside of the 2x2 ceiling tiles seen from up inside the plenum: dusty mineral-wool + lot stencil + galvanized T-bar spine
  const tileBack = kit.tex.custom('plenum:tile-back', 64, 64, (g) => {
    P(g, '#70757c', 0, 0, 64, 64);               // galvanized T-bar bulb
    P(g, '#4b4f55', 2, 2, 60, 60);
    P(g, '#8a8273', 4, 4, 56, 56);               // raw mineral-fibre board back
    const rng = makeRng('tile-back-dust');
    for (let i = 0; i < 80; i++) {
      P(g, i % 2 ? '#787062' : '#968e7e', rng.int(5, 57), rng.int(5, 57), rng.int(1, 3), rng.int(1, 2));
    }
    g.fillStyle = 'rgba(42, 38, 32, 0.42)';
    g.font = '700 6px ui-monospace, Menlo, monospace';
    g.textAlign = 'center';
    g.fillText('24x24 ACST', 32, 29);
    g.fillText('NO STEP', 32, 39);
  });

  // Water-damaged sagging fragile tile texture (warning ring + crack hairline)
  const tileFragile = kit.tex.custom('plenum:tile-fragile', 64, 64, (g) => {
    P(g, '#6a6f75', 0, 0, 64, 64);
    P(g, '#7c715e', 3, 3, 58, 58);
    g.fillStyle = 'rgba(72, 46, 22, 0.55)';
    g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(46, 28, 12, 0.52)';
    g.beginPath(); g.arc(33, 31, 13, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#241c15';
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(12, 19); g.lineTo(31, 33); g.lineTo(52, 27); g.moveTo(31, 33); g.lineTo(27, 53); g.stroke();
  });

  // Galvanized sheet-metal HVAC trunk with diagonal X cross-brake stiffening creases & bolted seams
  const duct = kit.tex.custom('plenum:duct', 64, 64, (g) => {
    P(g, '#8d949b', 0, 0, 64, 64);
    P(g, '#646b73', 0, 0, 64, 2);
    P(g, '#aeb5bd', 0, 2, 64, 1);
    P(g, '#646b73', 0, 62, 64, 2);
    P(g, '#646b73', 0, 0, 2, 64);
    P(g, '#646b73', 62, 0, 2, 64);
    // Diagonal X cross-brake creases
    g.strokeStyle = 'rgba(62, 68, 74, 0.55)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(5, 5); g.lineTo(59, 59); g.moveTo(59, 5); g.lineTo(5, 59); g.stroke();
    g.strokeStyle = 'rgba(196, 204, 212, 0.42)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(6, 4); g.lineTo(60, 58); g.moveTo(58, 4); g.lineTo(4, 58); g.stroke();
    // Corner flange bolts
    for (const [bx, by] of [[5, 5], [57, 5], [5, 57], [57, 57], [31, 3], [31, 59]]) {
      P(g, '#494f56', bx, by, 2, 2);
    }
  });

  // Raw mortared cinderblock fire-stop partition wall
  const cinder = kit.tex.custom('plenum:cinder', 64, 64, (g) => {
    P(g, '#7c7a74', 0, 0, 64, 64);
    const rows = 4, rh = 64 / rows;
    const rng = makeRng('cinder-grain');
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      P(g, '#595752', 0, y, 64, 2);
      const off = (r % 2) * 16;
      for (let x = off; x < 64; x += 32) P(g, '#595752', x, y, 2, rh);
      for (let i = 0; i < 36; i++) {
        P(g, i % 2 ? '#6f6d67' : '#898780', rng.int(0, 63), y + rng.int(2, rh - 2), 2, 1);
      }
    }
  });

  // Raw board-formed structural concrete ceiling slab at `y = H`
  const slab = kit.tex.custom('plenum:slab', 64, 64, (g) => {
    P(g, '#585a5e', 0, 0, 64, 64);
    P(g, '#45474b', 0, 0, 64, 2);
    P(g, '#45474b', 0, 32, 64, 2);
    const rng = makeRng('slab-pock');
    for (let i = 0; i < 70; i++) {
      P(g, i % 3 ? '#4d4f53' : '#66696e', rng.int(0, 62), rng.int(0, 62), rng.int(1, 3), rng.int(1, 2));
    }
  });

  // Rough timber maintenance catwalk plank
  const plank = kit.tex.custom('plenum:plank', 64, 64, (g) => {
    P(g, '#8b6d47', 0, 0, 64, 64);
    for (let y = 0; y < 64; y += 16) {
      P(g, '#554026', 0, y, 64, 2);
      P(g, '#9c7c54', 0, y + 2, 64, 1);
    }
    const rng = makeRng('plank-grain');
    for (let i = 0; i < 65; i++) {
      P(g, i % 2 ? '#785c3a' : '#9c7d55', rng.int(0, 56), rng.int(0, 63), rng.int(4, 9), 1);
    }
  });

  // Ribbed galvanized steel rolling fire shutter with bottom yellow/black hazard bar
  const shutter = kit.tex.custom('plenum:shutter', 64, 64, (g) => {
    P(g, '#7e848b', 0, 0, 64, 64);
    for (let y = 0; y < 56; y += 4) {
      P(g, '#565b61', 0, y, 64, 1);
      P(g, '#9aa1a9', 0, y + 1, 64, 1);
    }
    P(g, '#d8a61e', 0, 56, 64, 8);
    g.fillStyle = '#1f1d18';
    for (let x = -8; x < 72; x += 12) {
      g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 6, 56); g.lineTo(x + 11, 56); g.lineTo(x + 5, 64); g.fill();
    }
  }, { clamp: true });

  // Stacked Backrooms Facilities Confined-Reality placard for the cinderblock firewall bulkhead
  const dangerSign = kit.tex.custom('plenum:danger:' + p.zone, 160, 210, (g) => {
    // Upper placard: DANGER — INTER-FLOOR PLENUM
    P(g, '#dedad0', 0, 0, 160, 108);
    P(g, '#181818', 3, 3, 154, 102);
    P(g, '#dedad0', 6, 42, 148, 60);
    // Red oval inside black header
    g.fillStyle = '#c6281e';
    g.beginPath(); g.ellipse(80, 22, 64, 15, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#dedad0'; g.lineWidth = 2; g.stroke();
    drawText(g, ['DANGER'], 0, 9, 160, 26, { color: '#f7f4ec', size: 15, pad: 2, weight: '800' });
    drawText(g, [
      'INTER-FLOOR PLENUM',
      'GRAVITY PERMIT REQUIRED',
      'DO NOT WAKE UPPER TENANTS',
    ], 6, 44, 148, 56, { color: '#181818', size: 9, pad: 3, weight: '700' });

    // Gap mortar strip
    P(g, '#6c6a64', 0, 108, 160, 6);

    // Lower placard: CAUTION — NON-EUCLIDEAN DUCTWORK
    P(g, '#e3b21a', 0, 114, 160, 96);
    P(g, '#181612', 3, 117, 154, 30);
    drawText(g, ['CAUTION'], 0, 118, 160, 28, { color: '#e3b21a', size: 15, pad: 2, weight: '800' });
    drawText(g, [
      'NON-EUCLIDEAN DUCTWORK',
      'CEILINGS CONTINUE BELOW',
      'TRUST ONLY YELLOW LADDERS',
    ], 6, 150, 148, 56, { color: '#181612', size: 9, pad: 3, weight: '700' });
  }, { clamp: true });

  // Diffuser tile (air return grille in the 2x2 ceiling)
  const diffuser = kit.tex.custom('plenum:diffuser', 64, 64, (g) => {
    P(g, '#c2c5c8', 0, 0, 64, 64);
    P(g, '#dfe1dd', 3, 3, 58, 58);
    for (const inset of [9, 15, 21, 27]) {
      g.strokeStyle = '#686d73';
      g.lineWidth = 2;
      g.strokeRect(inset, inset, 64 - inset * 2, 64 - inset * 2);
    }
  });

  // Concentric impossible-depth tunnel texture inside the non-Euclidean wraparound duct mouths
  const portalGlow = kit.tex.custom('plenum:portal', 96, 96, (g) => {
    P(g, '#08040a', 0, 0, 96, 96);
    const rings = ['#26112d', '#491936', '#7a222b', '#b83c24', '#e38834', '#160814'];
    for (let i = 0; i < 12; i++) {
      const ins = i * 3.6;
      g.strokeStyle = rings[i % rings.length];
      g.lineWidth = 2;
      g.save();
      g.translate(48, 48);
      g.rotate(i * 0.055);
      g.strokeRect(-44 + ins, -44 + ins, 88 - ins * 2, 88 - ins * 2);
      g.restore();
    }
    P(g, '#050208', 40, 40, 16, 16);
  }, { clamp: true });

  return { tileUnder, tileBack, tileFragile, duct, cinder, slab, plank, shutter, dangerSign, diffuser, portalGlow };
}

/* ---- Voxel props: crooked louvered troffer, emergency bulkhead, hoist -------- */

/** Recessed 2x4 parabolic louver fluorescent troffer (hung crookedly from broken ceiling bay). */
export function louverTrofferVox() {
  const v = new Vox();
  const frame = M('#d8dad6', 0), housing = M('#6e747c', 0), louver = M('#aeb4bc', 0), bulb = glow('#e7ebd4');
  // 16 x 32 voxels (at VOX = 0.075 m -> 1.2 m x 2.4 m, scale 0.5 -> 0.60 m x 1.20 m!)
  v.box(-8, 0, -16, 8, 4, 16, housing);
  v.box(-9, 0, -17, 9, 1, 17, frame);
  v.carve(-7, 0, -15, 7, 3, 15);
  // Two glowing fluorescent tubes deep inside the troffer
  v.box(-4, 2, -14, -2, 3, 14, bulb);
  v.box(2, 2, -14, 4, 3, 14, bulb);
  // Center spine + transverse parabolic louver blades
  v.box(-1, 0, -15, 1, 2, 15, louver);
  for (let z = -13; z <= 13; z += 4) {
    v.box(-7, 0, z, 7, 2, z + 1, louver);
  }
  return v;
}

/** Caged red industrial plenum emergency bulkhead lamp. */
export function plenumBulkheadVox() {
  const v = new Vox();
  const cast = M('#2d3035', 0), ruby = glow('#ff3d1c'), cage = M('#4b4f57', 0);
  v.box(-3, -2, -5, 3, 1, 5, cast);
  v.ellipsoid(0, 1, 0, 2.5, 2.2, 4.0, ruby);
  for (const z of [-3, 0, 3]) v.box(-3, -1, z, 3, 3, z + 1, cage);
  v.box(-1, -1, -5, 1, 3, 5, cage);
  return v;
}

/** Wall-mounted manual chain-hoist gearbox & red release lever for the jammed fire shutter. */
export function shutterHoistVox() {
  const v = new Vox();
  const red = M('#b82d24', 0), steel = M('#7c838c', 0), dark = M('#25282c', 0), grip = M('#e3b21a', 0);
  v.box(-3, 0, -2, 3, 7, 2, red);
  v.cyl('z', 0, 4, 2, 2, 2.2, steel);
  // Pull-lever arm + yellow handle grip
  v.box(2, 3, 1, 4, 11, 3, dark);
  v.box(2, 9, 0, 4, 12, 4, grip);
  // Hanging chain loops
  v.box(-2, -8, 1, -1, 0, 2, steel);
  v.box(1, -8, 1, 2, 0, 2, steel);
  return v;
}

/** Jagged broken white acoustic ceiling tile fragment lying on the office carpet below. */
export function brokenTileShardVox() {
  const v = new Vox();
  const face = M('#dfddd3', 0), core = M('#8d8474', 0);
  v.box(-4, 0, -3, 4, 1, 3, core);
  v.box(-3, 1, -3, 3, 2, 2, face);
  v.carve(1, 0, 1, 4, 2, 3);
  return v;
}

/** Weightless popped 2x2 acoustic ceiling tile with aluminum rim, fissured white face & mineral-wool back. */
export function floatingTileVox() {
  const v = new Vox();
  const rim = M('#b8bec6', 0), white = M('#e7e5dc', 0), dot = M('#b5b1a4', 0), wool = M('#8a8171', 0);
  v.box(-7, 0, -7, 7, 1, 7, rim);
  v.box(-6, 0, -6, 6, 0, 6, white);
  v.box(-6, 1, -6, 6, 1, 6, wool);
  for (const [x, z] of [[-4, -3], [-1, 2], [3, -4], [4, 3], [-3, 4], [1, -1]]) {
    v.set(x, 0, z, dot);
  }
  return v;
}

/** Surreal zero-gravity office mug with dark coffee stream & droplets floating upward toward the ceiling carpet. */
export function antiGravMugVox() {
  const v = new Vox();
  const mug = M('#eae6d8', 0), stripe = M('#c63628', 0), coffee = M('#22140c', 0);
  v.cyl('y', 0, 0, 0, 5, 2.5, mug);
  v.cyl('y', 0, 2, 0, 3, 2.6, stripe);
  v.box(2, 1, 0, 4, 4, 1, mug);
  // Upward-rising zero-gravity coffee ribbon & suspended droplets
  v.box(0, 5, 0, 1, 11, 1, coffee);
  v.box(-1, 13, 0, 0, 15, 1, coffee);
  v.box(0, 17, -1, 1, 19, 0, coffee);
  v.ellipsoid(0, 22, 0, 1.6, 1.6, 1.6, coffee);
  return v;
}

/* ---- Plenum Toner rig (compact crawlspace Waste Toner with upside-down slab cling) ---- */

const S = 0.020;
const VOID = '#050609', TAR = '#0d1018', OIL = '#171c29', SHEEN = '#262e42', STATIC = '#9ab0cc';

function tornVox(src, R) {
  const out = new Vox(), b = src.bounds(), shift = new Map();
  for (let y = b.y0 + R.int(0, 2); y < b.y1; y += R.int(1, 4)) {
    const h = R.int(1, 2), dx = R.pick([-5, -3, -2, 2, 3, 5]), dz = R.pick([-2, -1, 1, 2]);
    for (let k = 0; k < h; k++) shift.set(y + k, [dx, dz]);
    y += h;
  }
  const spark = glow(STATIC), edge = M('#4c5c7a', 0);
  src.each((x, y, z, c) => {
    const sh = shift.get(y);
    const pick = sh && R.chance(0.04) ? (R.chance(0.4) ? spark : edge) : c;
    out.set(x + (sh ? sh[0] : 0), y, z + (sh ? sh[1] : 0), pick);
  });
  return out;
}

function plenumCoreVox(variant, R) {
  const v = new Vox(), voidM = M(VOID, 1), tar = M(TAR, 1), oil = M(OIL, 0), sheen = M(SHEEN, 0);
  v.ellipsoid(0, 9, 0, 6.0, 4.2, 7.6, voidM);
  v.ellipsoid(-2 + (variant % 2) * 3, 10, 3, 4.4, 3.4, 4.8, tar);
  v.ellipsoid(2 - (variant % 2) * 3, 8.5, -3, 4.8, 3.2, 4.6, tar);
  v.tube(0, 8.5, 4.5, (variant % 3) - 1, 7.8, 10.5, 2.2, voidM);
  v.carve(-1, 7, 8, 1, 10, 12);
  const spikes = [
    [[-3, 11, 2, -6, 17, -3], [3, 11, 0, 6, 16, -5], [0, 12, -3, -2, 18, -8]],
    [[-2, 12, 3, -6, 18, 0], [3, 11, -2, 7, 16, -6], [-1, 11, -4, 3, 17, -9]],
    [[0, 12, 3, 4, 18, -1], [-3, 11, -1, -6, 16, -5], [2, 11, -4, -1, 17, -9]],
  ][variant % 3];
  for (const [x0, y0, z0, x1, y1, z1] of spikes) {
    const mx = (x0 + x1) / 2 + R.range(-1, 1), my = (y0 + y1) / 2 + 1.2, mz = (z0 + z1) / 2;
    v.tube(x0, y0, z0, mx, my, mz, 1.35, tar);
    v.tube(mx, my, mz, x1, y1, z1, 0.8, oil);
  }
  v.each((x, y, z) => {
    if (y >= 11 && v.exposed(x, y, z, 0, 1, 0) && ((x * 3 + z * 5 + variant) & 7) === 0) v.set(x, y, z, sheen);
  });
  return v;
}

function plenumLimbVox(sx, sz) {
  const v = new Vox(), voidM = M(VOID, 1), tar = M(TAR, 1), sheen = M(SHEEN, 0);
  const kx = sx * 8.0, ky = 10.5, kz = sz * 6.0;
  const ax = sx * 11.8, ay = 0.5, az = sz * 8.8;
  const fx = sx * 13.5, fy = -9, fz = sz * 10.5;
  v.tube(0, 0, 0, kx, ky, kz, 1.75, voidM);
  v.tube(kx, ky, kz, ax, ay, az, 1.35, tar);
  v.tube(ax, ay, az, fx, fy, fz, 0.95, voidM);
  v.tube(kx, ky, kz, kx + sx * 2, ky + 4, kz - sz * 1.4, 0.85, sheen);
  v.tube(fx, fy, fz, fx + sx * 1.8, fy, fz + sz * 2.2, 0.7, sheen);
  return v;
}

function dropletVox() {
  const v = new Vox();
  v.box(0, 0, 0, 1, 3, 1, M(VOID, 0));
  v.set(0, 1, 0, M(OIL, 0));
  return v;
}

export function makePlenumTonerRig(kit, seedKey = '0') {
  const m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0.3, 2.4, 0.8, [1.5, 1.45, 1.45], { k: 9, wrap: 0.58, far: 28 })];
  const amb = [0.72, 0.68, 0.7];
  const bake = (key, fn) => {
    const b = new Batch(true);
    b.addVox(kit.model('plenum-toner:' + key, fn).solid, m4);
    return kit.geometry(b, lights, amb);
  };

  const mat = kit.surface({ vox: true });
  const group = new THREE.Group();
  const orient = new THREE.Group();
  const body = new THREE.Group();
  group.rotation.order = 'YXZ';
  orient.rotation.order = 'ZYX';
  group.add(orient);
  orient.add(body);

  const cores = [0, 1, 2].map((k) => {
    const whole = new THREE.Mesh(bake('core' + k, () => plenumCoreVox(k, makeRng('pt-core-' + k))), mat);
    const torn = new THREE.Mesh(bake('coreT' + k, () => tornVox(plenumCoreVox(k, makeRng('pt-core-' + k)), makeRng('pt-tear-' + k))), mat);
    whole.visible = torn.visible = false;
    body.add(whole, torn);
    return { whole, torn };
  });

  const sockets = [[-1, 1, 'fl'], [1, 1, 'fr'], [-1, -1, 'bl'], [1, -1, 'br']];
  const limbs = sockets.map(([sx, sz, tag], i) => {
    const g = new THREE.Group();
    g.position.set(sx * 4.4 * S, 9 * S, sz * 4.8 * S);
    const whole = new THREE.Mesh(bake('limb:' + tag, () => plenumLimbVox(sx, sz)), mat);
    const torn = new THREE.Mesh(bake('limbT:' + tag, () => tornVox(plenumLimbVox(sx, sz), makeRng('pt-lt-' + tag))), mat);
    torn.visible = false;
    g.add(whole, torn);
    body.add(g);
    return { g, sx, sz, i, whole, torn };
  });

  const drop = new THREE.Mesh(bake('drop', dropletVox), mat);
  group.add(drop);

  const phaseSeed = (seedKey.charCodeAt(0) || 1) * 1.37;
  let dyingFrom = null;                                                           // (where it was turned when its dying began: die())

  return {
    group,
    light(rgb) {
      mat.uniforms.uTint.value.set(
        Math.max(0.24, rgb[0] * 1.25),
        Math.max(0.14, rgb[1] * 1.15),
        Math.max(0.14, rgb[2] * 1.15),
      );
    },
    /**
     * Its dying, 0 → 1 (cast/health.rule.js), wherever the room has it: it comes off the slab the right way up, its legs
     * flailing, then splays, its legs draw in and twitch, and it melts flat. (How far it falls is the room's: its height.)
     */
    die(progress, time = 0) {
      const k = Math.max(0, Math.min(1, progress)), sec = k * 1.2, ease = (v) => { const u = Math.max(0, Math.min(1, v)); return u * u * (3 - 2 * u); };
      const torn = sec < 0.25 && Math.floor(sec * 26) % 2 === 0;
      cores.forEach((c, idx) => { c.whole.visible = idx === 0 && !torn; c.torn.visible = idx === 0 && torn; });
      if (dyingFrom === null) dyingFrom = orient.rotation.z;
      const up = ease(k / 0.3), target = dyingFrom > Math.PI ? 2 * Math.PI : 0;
      orient.rotation.z = dyingFrom + (target - dyingFrom) * up; orient.position.y = 0;
      const melt = ease((k - 0.5) / 0.5);
      body.scale.set(1 + 0.55 * melt, Math.max(0.06, 1 - 0.92 * melt), 1 + 0.55 * melt); body.position.x = 0;
      limbs.forEach((L, idx) => {
        if (k < 0.3) { L.g.rotation.set(Math.sin(sec * 34 + idx * 1.7) * 0.55, 0, L.sx * 0.5); }
        else { const curl = ease((k - 0.35) / 0.35), tw = Math.sin(sec * 41 + idx * 2.3) * Math.exp(-sec * 3) * 0.3; L.g.rotation.set(0.25 * curl + tw, 0, L.sx * (0.7 * (1 - curl) - 0.9 * curl) * (1 - 0.6 * melt)); }
        L.whole.visible = true; L.torn.visible = false;
      });
      drop.visible = false;
    },
    pose(time, phase, slabK, speed, bank = 0, hurt = Infinity) {
      dyingFrom = null; body.scale.set(1, 1, 1);
      const t = time + phaseSeed;
      const glitching = phase === 'recoil' || phase === 'dropping' || (phase === 'chasing' && Math.sin(t * 19.3) > 0.62) || Math.sin(t * 7.1) > 0.92;
      const cIdx = Math.floor(t * (glitching ? 18 : 5.5)) % cores.length;
      cores.forEach((c, idx) => {
        c.whole.visible = idx === cIdx && !glitching;
        c.torn.visible = idx === cIdx && glitching;
      });

      // Upside-down on concrete slab when slabK = 1; flips upright when dropping onto HVAC trunk (slabK = 0)
      orient.rotation.z = slabK * Math.PI + (1 - slabK) * bank * 0.45;
      orient.position.y = slabK * -0.04 + (1 - slabK) * Math.abs(Math.sin(t * 14)) * Math.min(1, speed / 2.5) * 0.045;
      body.position.x = glitching ? Math.sin(t * 43) * 0.035 : 0;

      const gait = t * (speed > 0.2 ? 15.5 : 2.6);
      limbs.forEach((L, idx) => {
        const ph = gait + (idx === 0 ? 0 : idx === 3 ? 0.55 : idx === 1 ? Math.PI : Math.PI + 0.55);
        const swing = speed > 0.15 ? Math.sin(ph) * 0.52 : Math.sin(ph) * 0.09;
        const lift = speed > 0.15 ? Math.max(0, Math.cos(ph)) * 0.34 : 0;
        L.g.rotation.x = swing + (phase === 'dropping' ? -0.45 : 0);
        L.g.rotation.z = L.sx * (lift + (phase === 'alert' ? 0.18 : 0));
        L.whole.visible = !glitching || (idx % 2 === 0);
        L.torn.visible = glitching && (idx % 2 === 1);
      });
      // a jab (hurt: seconds since one landed): it jerks, legs flung out, torn
      if (hurt < 0.6) {
        const e = Math.exp(-hurt * 7) * Math.min(1, hurt * 30) * (1 - hurt / 0.6);
        body.position.x = Math.sin(hurt * 60) * 0.04 * e;
        limbs.forEach((L) => { L.g.rotation.z += L.sx * 0.6 * e; L.whole.visible = e < 0.3; L.torn.visible = e >= 0.3; });
      }

      // Dripping black toner droplet while clinging upside down to the concrete slab
      if (slabK > 0.85 && (phase === 'perched' || phase === 'alert')) {
        const fall = (t * 0.68) % 1;
        drop.visible = fall < 0.82;
        drop.position.set(Math.sin(phaseSeed) * 0.04, -0.18 - fall * fall * 1.65, Math.cos(phaseSeed) * 0.04);
      } else {
        drop.visible = false;
      }
    },
  };
}
