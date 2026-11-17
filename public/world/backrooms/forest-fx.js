// The Backrooms — The Offsite Reserve (`forest`): 2027 AAA Dynamic Woodland
// Lighting, Canopy Shadows, Volumetric Light Shafts, 3D Return-Plenum Breaches,
// and Custom GLSL Voxel-Stepped Water with Interactive Ripples & Caustics.
//
// All non-structural visual enrichment here (`detailArch`, `detailVox`,
// `detailShafts`) tags `mesh.userData.detail = true` per `docs/BACKROOMS.md` §4
// so weak machines can drop detail batches cleanly while High renders the full
// atmospheric forest under the 250k / 500k triangle budget.

import * as THREE from 'three';
import { Batch, lin, ticks, WHITE } from './kit.js';
import { TILE } from './gen.js';
import { FLASHLIGHT_GLSL } from './flashlight.js';
import {
  stepCanopyBanks,
  makeRippleState,
  pushWaterRipple,
} from './forest.rule.js';
import { hangingCanopyDrapeVox } from './forest-models.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ---- 1. Shared Per-Room `detail: true` Collector ------------------------- */

/**
 * Lazily attach a 2-batch (`arch` + `voxEntries`) detail collector to `c.rt`
 * that bakes at room finish against the room's full lights & 4 dynamic banks,
 * producing at most 2 `mesh.userData.detail = true` meshes for the whole room!
 */
export function ensureForestDetail(c) {
  if (c.rt._forestDetail) return c.rt._forestDetail;
  const arch = new Batch(false);
  const voxEntries = [];
  const state = {
    arch,
    voxEntries,
    voxTris: 0,
    totalTris() {
      return arch.idx.length / 3 + state.voxTris + 450;
    },
    pushVox(entry) {
      const flat = entry.ao === false;
      const model = c.kit.model(flat ? `${entry.key}:flat` : entry.key, entry.make, flat ? { ao: false } : undefined);
      const cost = model?.solid ? (model.solid.index ? model.solid.index.count : model.solid.attributes.position.count) / 3 : 0;
      state.voxTris += cost;
      c.rt._pendingDetTris = state.totalTris();
      voxEntries.push(entry);
    },
  };
  c.rt._forestDetail = state;

  c.after.push(() => {
    // 1. Detail architectural geometry (3D plenum cavities, HVAC ducts, wall conduits, skirting)
    if (arch.verts > 0) {
      const geo = c.kit.geometry(arch, c.rt.lights, c.rt.amb, c.rt.lighting);
      if (geo) {
        const mat = c.kit.surface({
          map: c.kit.tex.white(),
          room: c.rt.u,
          flick: geo.userData.flick,
          banks: geo.userData.banks,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `forest:detail-arch:${c.room.id}`;
        mesh.userData.detail = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        c.rt.group.add(mesh);
      }
    }

    // 2. Detail voxel scatter (ferns, mushrooms, reeds, forest litter, ceiling root drapes)
    if (voxEntries.length > 0) {
      const q = new Batch(true);
      const m4 = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();

      for (const e of voxEntries) {
        const s = e.scale ?? 0.028;
        euler.set(e.tilt ? e.tilt[0] : 0, e.rot || 0, e.tilt ? e.tilt[1] : 0, 'YXZ');
        quat.setFromEuler(euler);
        pos.set(e.x, e.y ?? 0, e.z);
        scl.set(s, s, s);
        m4.compose(pos, quat, scl);
        const flat = e.ao === false;
        const model = c.kit.model(flat ? `${e.key}:flat` : e.key, e.make, flat ? { ao: false } : undefined);
        q.addVox(model.solid, m4, e.tint ? { tint: e.tint } : undefined);
      }
      const geo = c.kit.geometry(q, c.rt.lights, c.rt.amb, c.rt.lighting);
      if (geo) {
        const mat = c.kit.surface({
          vox: true,
          room: c.rt.u,
          flick: geo.userData.flick,
          banks: geo.userData.banks,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `forest:detail-vox:${c.room.id}`;
        mesh.userData.detail = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        c.rt.group.add(mesh);
      }
    }
  });

  return state;
}

/* ---- 2. Dynamic 4-Bank Woodland Canopy Lighting & Volumetric Shafts ------ */

/**
 * Install high-contrast 4-bank dynamic woodland ceiling lighting (`rt.lighting`):
 *   - Banks `0..2`: live fluorescent ceiling troffers grouped across the room,
 *     interspersed with dead/root-choked troffers (`kit.tex.panel(false)`) so
 *     bright woodland clearings alternate with deep shadowed tree-lines!
 *   - Bank `3`: reserved for warm campfire / glowing ember / underwater CRT /
 *     bulldozer headlight bounce lights (`c.light(..., { bank: 3 })`).
 *   - Spawns slanted volumetric god-ray light shafts & drifting lit pollen motes
 *     (`mesh.userData.detail = true`) under live ceiling troffers!
 */
export function woodlandDynamicLight(c, opt = {}) {
  const { W, D, H, kit, room } = c;
  const cols = opt.cols ?? (W >= 20 ? 4 : 3);
  const rows = opt.rows ?? 3;
  const power = opt.power ?? 1.05;
  const mode = opt.mode || 'canopy';
  const deadRatio = opt.deadRatio ?? (mode === 'ember' ? 0.42 : mode === 'islands' ? 0.45 : mode === 'swamp' ? 0.30 : 0.24);
  const seed = (room.id || 1) * 37 + Math.round(W * 7 + D * 13);

  // Configure 4-bank room lighting + deep dark survival-horror woodland shadow ambient BEFORE any `c.light` calls!
  c.rt.amb = opt.amb || (mode === 'ember' ? [0.055, 0.042, 0.036] : [0.052, 0.074, 0.046]);
  c.rt.lighting = {
    kind: 'steady',
    bankCount: 4,
    ceilingBanks: 3,
    ambientShare: opt.ambientShare ?? 0.82,
  };
  c.rt.lightLevels = [1, 1, 1, 1];
  c.rt.u.banks.value = [1, 1];
  c.rt.u.moreBanks.value = [1, 1];

  const tube = lin(opt.tubeHex || '#dcf596');
  const warmOfficeTube = lin('#ffbe66');
  const deadBatch = c.mapped('forest:dead-panel', kit.tex.panel(false));
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const head = clamp(H / 2.8, 0.55, 2.25);

  const liveSpots = [];
  let liveCount = 0;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = (Math.round((-W / 2 + (i + 0.5) * (W / cols)) / TILE - 0.5) + 0.5) * TILE;
      const z = (Math.round((-D / 2 + (j + 0.5) * (D / rows)) / TILE)) * TILE;
      const y = H - 0.006;
      const q = [
        [x - TILE / 2, y, z - TILE],
        [x + TILE / 2, y, z - TILE],
        [x + TILE / 2, y, z + TILE],
        [x - TILE / 2, y, z + TILE],
      ];

      // Keep at least two well-separated panels live; turn selected others into dead root-choked fixtures
      const hVal = hash(seed + i * 19 + j * 43);
      const centerKeep = (i === Math.floor(cols / 2) && j === Math.floor(rows / 2)) || (i === 0 && j === rows - 1);
      const isDead = !centerKeep && hVal < deadRatio;

      if (isDead || liveCount >= (opt.maxCeilingLights ?? 10)) {
        deadBatch.quad(...q, WHITE, uv);
        c.blot(x, z, 1.45, 2.15, { rgb: [0.02, 0.03, 0.02], a: 0.52, y: H - 0.008, down: true });
      } else {
        const bank = (i + j) % 3;
        // Occasional warm golden-amber office fixture in a corner bay for uncanny office-vs-forest color contrast!
        const isWarmBay = mode !== 'ember' && liveCount === 1 && cols >= 3;
        const pCol = isWarmBay ? warmOfficeTube : tube;
        const on = c.shining(`panel-bank-${bank}${isWarmBay ? '-warm' : ''}`, kit.tex.panel(true), 2.35, pCol);
        on.quad(...q, WHITE, uv);
        // Tighter downward cone (`floor: 0.14, k: 2.35`) carves bright chartreuse pools & deep shadowed corridors!
        c.light(x, H - 0.14, z, pCol, power * 1.12 * Math.pow(head, 1.28), {
          bank,
          axis: [0, -1, 0],
          floor: opt.floorLeak ?? 0.14,
          k: 2.35 * head,
          far: 12.6 * head,
        });
        liveSpots.push({ x, z, bank });
        liveCount++;
      }
    }
  }

  // Sprinkler heads, recessed frames & lush green voxel vines draping directly around live fluorescent troffers!
  const det = ensureForestDetail(c);
  for (let s = 0; s < Math.min(4, liveSpots.length); s++) {
    const sp = liveSpots[s];
    if ((c.rt._pendingDetTris || 0) < 185000) {
      det.pushVox({
        key: 'forest:detail:ceildrape',
        make: hangingCanopyDrapeVox(),
        x: sp.x + (s % 2 ? 0.36 : -0.36),
        y: H + 0.02,
        z: sp.z + (s < 2 ? 0.48 : -0.48),
        rot: s * 1.65,
        scale: 0.032,
      });
    }
  }
  for (let x = -W / 2 + 2.1; x < W / 2 - 1.2; x += 3.6) {
    for (let z = -D / 2 + 2.1; z < D / 2 - 1.2; z += 3.6) {
      const topY = c.ceilAt(x, z);
      det.arch.box(x - 0.028, topY - 0.055, z - 0.028, x + 0.028, topY, z + 0.028, [0.70, 0.56, 0.25], { skip: '+y' });
      det.arch.box(x - 0.052, topY - 0.068, z - 0.052, x + 0.052, topY - 0.055, z + 0.052, [0.58, 0.46, 0.20]);
    }
  }

  // Slanted volumetric god-ray shafts & drifting lit forest pollen under up to 5 live troffers!
  // (off unless a room asks, `shafts: true`: they were drawn under every live panel whether or not anything was in the
  // air, fell on nothing, and through the camcorder only added grey. None of the fifteen rooms asks. docs/FOREST-REVIEW.md §2)
  if (opt.shafts === true && liveSpots.length > 0 && H >= 3.2) {
    addLightShafts(c, liveSpots.slice(0, opt.maxShafts ?? 5), {
      tint: opt.shaftTint || (mode === 'ember' ? [1.0, 0.72, 0.38] : [0.76, 0.96, 0.74]),
      strength: opt.shaftStrength ?? (mode === 'ember' ? 0.11 : 0.13),
    });
  }

  // Animate the 4 lighting banks on the visit clock (`world.updateLighting` runs before `c.tick`, so our write wins cleanly!)
  c.tick((_dt, t) => {
    const effect = c.rt.lightsK ?? 1;
    if (effect !== 1) return; // let creature blackouts/flashes own the ceiling untouched
    const steady = !!c.env.steadyLighting?.();
    const levels = stepCanopyBanks(mode, t, { steady, effect, seed });
    c.rt.lightLevels = levels;
    c.rt.u.banks.value[0] = levels[0];
    c.rt.u.banks.value[1] = levels[1];
    c.rt.u.moreBanks.value[0] = levels[2];
    c.rt.u.moreBanks.value[1] = levels[3];
    for (const mesh of c.rt.bankPanels) {
      const lv = levels[mesh.userData.bank] ?? 1;
      mesh.material.color.copy(mesh.userData.on).multiplyScalar(Math.max(0.01, lv));
    }
  });

  return { liveSpots };
}

/* ---- 3. Volumetric God-Ray Light Shafts & Drifting Woodland Spores ------- */

const SHAFT_VERT = `
attribute vec2 aPhase;
varying vec2 vUv;
varying vec2 vPhase;
varying vec3 vView;
uniform float uShaftTime;
void main() {
  vUv = uv;
  vPhase = aPhase;
  vec3 p = position;
  if (aPhase.y > 0.5) {
    // Drifting suspended forest spore/pollen mote!
    float t = uShaftTime * 0.42 + aPhase.x * 6.28318;
    p.x += sin(t * 1.3) * 0.16;
    p.z += cos(t * 1.1 + aPhase.x) * 0.16;
    p.y += sin(t * 0.85 + aPhase.x * 3.1) * 0.22;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const SHAFT_FRAG = `
uniform vec3 uShaftColor;
uniform float uShaftStrength;
uniform float uShaftTime;
uniform float uDim;
uniform vec2 uBanks;
uniform vec2 uMoreBanks;
varying vec2 vUv;
varying vec2 vPhase;
varying vec3 vView;
void main() {
  float bankIdx = floor(vPhase.x * 3.0 + 0.001);
  float bankLv = bankIdx < 0.5 ? uBanks.x : (bankIdx < 1.5 ? uBanks.y : uMoreBanks.x);
  float distFade = smoothstep(0.65, 2.2, length(vView));
  if (vPhase.y > 0.5) {
    // Soft circular glowing pollen mote
    vec2 d = vUv - vec2(0.5);
    float r = dot(d, d) * 4.0;
    if (r > 1.0) discard;
    float tw = 0.55 + 0.45 * sin(uShaftTime * 2.4 + vPhase.x * 19.0);
    float a = (1.0 - r) * (1.0 - r) * uShaftStrength * 3.4 * tw * bankLv * uDim * distFade;
    gl_FragColor = vec4(uShaftColor * a, a);
    return;
  }
  // Slanted volumetric god-ray cone with subtle canopy-leaf striation bands
  float across = sin(vUv.x * 3.14159265);
  float along = pow(1.0 - vUv.y, 1.25) * smoothstep(0.0, 0.10, vUv.y);
  float rays = 0.72 + 0.28 * sin(vUv.x * 15.0 + uShaftTime * 0.35 + vPhase.x * 9.0);
  float a = across * across * along * rays * uShaftStrength * bankLv * uDim * distFade;
  if (a < 0.0015) discard;
  gl_FragColor = vec4(uShaftColor * a, a);
}`;

export function addLightShafts(c, spots, opt = {}) {
  if (!spots?.length) return null;
  const { H, kit } = c;
  const pos = [], uv = [], phase = [], idx = [];
  const slantX = opt.slantX ?? 0.34, slantZ = opt.slantZ ?? 0.22;

  const pushQuad = (a, b, d, e, ph0, isMote) => {
    const base = pos.length / 3;
    for (const [p, u, v] of [[a, 0, 0], [b, 1, 0], [d, 1, 1], [e, 0, 1]]) {
      pos.push(p[0], p[1], p[2]);
      uv.push(u, v);
      phase.push(ph0, isMote ? 1 : 0);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  spots.forEach((sp, si) => {
    const topY = c.ceilAt(sp.x, sp.z) - 0.05;
    const botY = Math.max(0.12, c.floorAt(sp.x, sp.z) + 0.12);
    if (topY - botY < 1.6) return;
    const phBank = ((sp.bank ?? 0) % 3) / 3 + 0.05;

    // Two crossed slanted light-curtain planes per live ceiling troffer
    for (const ang of [0.38, 1.95]) {
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const wTop = 0.44, wBot = 0.98;
      const bx = sp.x + slantX, bz = sp.z + slantZ;
      pushQuad(
        [sp.x - cs * wTop, topY, sp.z - sn * wTop],
        [sp.x + cs * wTop, topY, sp.z + sn * wTop],
        [bx + cs * wBot, botY, bz + sn * wBot],
        [bx - cs * wBot, botY, bz - sn * wBot],
        phBank,
        false
      );
    }

    // 10 suspended lit pollen/spore motes drifting inside each shaft!
    for (let m = 0; m < 10; m++) {
      const h1 = hash(si * 31 + m * 7 + 3), h2 = hash(si * 17 + m * 13 + 9), h3 = hash(si * 23 + m * 19 + 5);
      const frac = 0.15 + h1 * 0.72;
      const mx = sp.x + slantX * frac + (h2 - 0.5) * 1.25;
      const mz = sp.z + slantZ * frac + (h3 - 0.5) * 1.25;
      const my = topY - (topY - botY) * frac;
      const r = 0.022 + (m % 3) * 0.008;
      // Crossed mini-billboard quads so spores read from any yaw
      pushQuad([mx - r, my + r, mz], [mx + r, my + r, mz], [mx + r, my - r, mz], [mx - r, my - r, mz], phBank + h1 * 0.25, true);
      pushQuad([mx, my + r, mz - r], [mx, my + r, mz + r], [mx, my - r, mz + r], [mx, my - r, mz - r], phBank + h1 * 0.25, true);
    }
  });

  if (!idx.length) return null;
  const uTime = { value: 0 };
  const tint = opt.tint || [0.76, 0.96, 0.74];

  c.after.push(() => {
    const geo = kit.own(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();

    const mat = kit.own(new THREE.ShaderMaterial({
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uShaftColor: { value: new THREE.Vector3(tint[0], tint[1], tint[2]) },
        uShaftStrength: { value: opt.strength ?? 0.13 },
        uShaftTime: uTime,
        uDim: c.rt.u.dim,
        uBanks: c.rt.u.banks,
        uMoreBanks: c.rt.u.moreBanks,
      },
    }));

    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `forest:detail-shafts:${c.room.id}`;
    mesh.userData.detail = true;
    mesh.renderOrder = 4;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    c.rt.group.add(mesh);
  });

  c.tick((_dt, t) => { uTime.value = t; });
  return { uTime };
}

/* ---- 4. Dappled Canopy Shadows & 3D Return-Plenum Architecture ----------- */

/**
 * Project a directional trunk shadow + dappled multi-lobed bough shadow onto
 * the woodland floor away from the room centre / nearest ceiling troffer.
 */
export function castCanopyShadow(c, x, z, radius = 1.45, seed = 1) {
  const { W, D } = c;
  // Base trunk contact AO
  c.blot(x, z, radius * 0.88, radius * 0.88, { rgb: [0.03, 0.04, 0.02], a: 0.52 });
  // Directional dappled bough shadow lobes cast onto nearby moss
  const len = Math.hypot(x, z) || 1;
  const dx = (x / len) * 0.55, dz = (z / len) * 0.55;
  for (let k = 0; k < 2; k++) {
    const ang = seed * 1.7 + k * 2.1;
    const sx = x + dx + Math.cos(ang) * radius * 0.42;
    const sz = z + dz + Math.sin(ang) * radius * 0.42;
    if (Math.abs(sx) > W / 2 - 0.25 || Math.abs(sz) > D / 2 - 0.25) continue;
    c.blot(sx, sz, radius * (0.95 - k * 0.18), radius * (0.72 + k * 0.16), {
      rgb: [0.04, 0.06, 0.03],
      a: 0.28 - k * 0.06,
      y: 0.006 + k * 0.0005,
    });
  }
}

/**
 * Pop ceiling tile(s) at `(x, z)` AND build a real 3D Return-Plenum Cavity above
 * `H` inside `detailArch` (`mesh.userData.detail = true`): dark structural deck,
 * bent T-bar grid runners, galvanized sheet-metal HVAC ducting, red sprinkler
 * pipe, and gnarly tree roots / Cat-5 cables crossing the void!
 */
export function plenumBreach(c, x, z, tilesCount = 1, seed = 1) {
  const hole = c.hole(x, z, tilesCount);
  if (!hole) return null;
  const det = ensureForestDetail(c).arch;
  const y0 = hole.y - 0.01;
  const yTop = hole.y + 0.52;
  const hw = (tilesCount * TILE) * 0.52;
  const hd = (tilesCount * TILE) * 0.52;

  // Dark recessed concrete deck & shadow skirt around the popped tile opening
  const darkDeck = [0.04, 0.045, 0.04];
  const galv = [0.52, 0.56, 0.59];
  const flange = [0.64, 0.68, 0.71];
  const sprinklerRed = [0.58, 0.13, 0.11];
  const rootWood = [0.26, 0.17, 0.10];
  const tBar = [0.76, 0.78, 0.76];

  det.quad([x - hw, yTop, z - hd], [x + hw, yTop, z - hd], [x + hw, yTop, z + hd], [x - hw, yTop, z + hd], darkDeck);
  // Four inner plenum cavity walls facing inward
  det.quad([x - hw, y0, z - hd], [x + hw, y0, z - hd], [x + hw, yTop, z - hd], [x - hw, yTop, z - hd], darkDeck);
  det.quad([x + hw, y0, z + hd], [x - hw, y0, z + hd], [x - hw, yTop, z + hd], [x + hw, yTop, z + hd], darkDeck);
  det.quad([x - hw, y0, z + hd], [x - hw, y0, z - hd], [x - hw, yTop, z - hd], [x - hw, yTop, z + hd], darkDeck);
  det.quad([x + hw, y0, z - hd], [x + hw, y0, z + hd], [x + hw, yTop, z + hd], [x + hw, yTop, z - hd], darkDeck);

  // Galvanized rectangular HVAC supply duct + flanged collar running across the plenum void!
  const alongX = (seed & 1) === 0;
  if (alongX) {
    det.box(x - hw, y0 + 0.18, z - 0.13, x + hw, y0 + 0.36, z + 0.13, galv, { skip: '+y' });
    det.box(x - 0.02, y0 + 0.165, z - 0.145, x + 0.02, y0 + 0.375, z + 0.145, flange, { skip: '+y' });
    det.box(x - hw, y0 + 0.10, z + 0.18, x + hw, y0 + 0.135, z + 0.215, sprinklerRed, { skip: '+y' });
  } else {
    det.box(x - 0.13, y0 + 0.18, z - hd, x + 0.13, y0 + 0.36, z + hd, galv, { skip: '+y' });
    det.box(x - 0.145, y0 + 0.165, z - 0.02, x + 0.145, y0 + 0.375, z + 0.02, flange, { skip: '+y' });
    det.box(x + 0.18, y0 + 0.10, z - hd, x + 0.215, y0 + 0.135, z + hd, sprinklerRed, { skip: '+y' });
  }

  // Bent white T-bar ceiling runner & wooden root wedged across the breach
  det.box(x - hw, y0 - 0.04, z - 0.015, x + hw * 0.45, y0 - 0.01, z + 0.015, tBar);
  det.box(x - hw * 0.7, y0 + 0.04, z - hd * 0.6, x + hw * 0.6, y0 + 0.09, z - hd * 0.52, rootWood);

  return hole;
}

/**
 * Add 3D Office-vs-Forest Wall Relief (`detailArch`, `mesh.userData.detail = true`):
 * vertical galvanized EMT electrical conduits leading down to wall junction boxes,
 * cedar/beige skirting rails along the torn carpet margin, and damp stain marks.
 */
export function dressForestWalls(c, seed = 1) {
  const det = ensureForestDetail(c).arch;
  const conduit = [0.62, 0.65, 0.66];
  const boxCol = [0.50, 0.53, 0.55];
  const strap = [0.74, 0.76, 0.78];

  let idx = 0;
  for (const side of ['left', 'right', 'back', 'front']) {
    const sp = c.wallSpot(1.1, [side], 0.45, 2.2);
    if (!sp) continue;
    const topY = c.ceilAt(0, 0);
    const at = sp.at + (hash(seed + idx * 17) - 0.5) * 0.35;
    const p = c.wallAt(side, at, 0.018);
    const hw = 0.014;
    // Vertical EMT conduit pipe from ceiling down to junction box at `y = 0.38`
    det.box(p.x - hw, 0.38, p.z - hw, p.x + hw, topY, p.z + hw, conduit, { skip: '+y-y' });
    for (const sy of [0.85, 1.65, 2.45]) {
      if (sy < topY - 0.2) det.box(p.x - 0.032, sy, p.z - 0.032, p.x + 0.032, sy + 0.022, p.z + 0.032, strap);
    }
    // Steel 4x4 electrical junction box
    det.box(p.x - 0.065, 0.28, p.z - 0.065, p.x + 0.065, 0.41, p.z + 0.065, boxCol);
    idx++;
  }
}

/* ---- 5. 2027 AAA Custom GLSL Forest Water, Interactive Ripples & Caustics - */

const WATER_VERT = `
attribute vec3 aLit;
attribute vec3 aAlb;
#ifdef BANKS
attribute vec3 aBank0;
attribute vec3 aBank1;
uniform vec2 uBanks;
#if BANKS > 2
attribute vec3 aBank2;
uniform vec2 uMoreBanks;
#endif
#if BANKS > 3
attribute vec3 aBank3;
#endif
#endif
#ifdef FLICK
attribute vec3 aFlk;
#endif
uniform float uFlick;
uniform float uDim;
uniform vec3 uTint;
uniform float uWaterTime;
varying vec3 vLit;
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vView;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vec3 p = position;
  float depth = uv.x;
  // Subtle capillary surface heave in deeper water, pinned at shoreline (depth -> 0)
  float bob = sin(p.x * 2.3 + uWaterTime * 1.45) * cos(p.z * 1.9 - uWaterTime * 1.15) * 0.010 * depth;
  p.y += bob;
  vLocal = p;

  vec3 lit = aLit;
  #ifdef BANKS
  lit += aBank0 * uBanks.x + aBank1 * uBanks.y;
  #if BANKS > 2
  lit += aBank2 * uMoreBanks.x;
  #endif
  #if BANKS > 3
  lit += aBank3 * uMoreBanks.y;
  #endif
  #endif
  #ifdef FLICK
  lit += aFlk * uFlick;
  #endif
  vLit = lit * uDim * uTint;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  vNormal = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

const WATER_FRAG = `
uniform sampler2D map;
uniform float uTorch;
uniform float uAlpha;
uniform float uWaterTime;
uniform vec3 uShallowCol;
uniform vec3 uDeepCol;
uniform vec3 uFoamCol;
uniform vec4 uRipples[6];
varying vec3 vLit;
varying vec2 vUv;
varying vec3 vLocal;
varying vec3 vView;
varying vec3 vNormal;
${FLASHLIGHT_GLSL}

void main() {
  float depth = clamp(vUv.x, 0.0, 1.0);
  float shoreDist = vUv.y;
  if (shoreDist < 0.0) discard;

  // Voxel-quantized 3.5 cm micro-cells blended with continuous coordinates for modern AAA voxel water!
  vec2 cellXz = floor(vLocal.xz / 0.035) * 0.035;
  vec2 p = mix(cellXz, vLocal.xz, 0.24);
  float t = uWaterTime;

  // 3 crossed traveling capillary wave trains
  float w1 = sin(p.x * 5.2 + p.y * 2.4 + t * 1.85);
  float w2 = cos(p.x * -3.4 + p.y * 5.8 - t * 1.42);
  float w3 = sin((p.x + p.y) * 9.5 - t * 2.65) * 0.45;
  vec2 grad = vec2(
    cos(p.x * 5.2 + p.y * 2.4 + t * 1.85) * 0.16 + sin(p.x * -3.4 + p.y * 5.8 - t * 1.42) * 0.11,
    cos(p.x * 5.2 + p.y * 2.4 + t * 1.85) * 0.08 - sin(p.x * -3.4 + p.y * 5.8 - t * 1.42) * 0.18
  );
  float crest = (w1 + w2 + w3) * 0.33;

  // Interactive expanding concentric voxel ripple rings (player footsteps & ceiling drips!)
  float ringFoam = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 rp = uRipples[i];
    float age = t - rp.z;
    if (age > 0.0 && age < 3.4 && rp.w > 0.01) {
      vec2 d = cellXz - rp.xy;
      float dist = length(d) + 0.0001;
      float front = age * 1.32;
      float env = exp(-abs(dist - front) * 5.8) * exp(-age * 0.82) * rp.w;
      float ph = (dist - front) * 26.0;
      grad += (d / dist) * cos(ph) * env * 0.95;
      ringFoam += max(0.0, sin(ph)) * env * 0.48;
    }
  }

  vec3 baseN = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 wn = normalize(baseN + vec3(grad.x * 0.56, 0.0, grad.y * 0.56));
  vec3 V = normalize(-vView);

  // Beer-Lambert depth absorption: translucent amber-olive shallows -> rich dark tannin mirror deep
  vec3 absorb = mix(uShallowCol, uDeepCol, smoothstep(0.04, 0.85, depth));
  vec3 texSample = texture2D(map, p / 1.45 + grad * 0.05).rgb;
  vec3 waterBody = mix(absorb, absorb * texSample * 2.35, 0.44);

  // True dark glassy reflection: deep dark body at steep & horizontal angles, crisp glints on wave crests & ripples!
  vec3 reflLit = min(vLit, vec3(0.82));
  float ndv = max(dot(V, wn), 0.0);
  float fresnel = pow(1.0 - ndv, 5.4);
  float facetGlint = smoothstep(0.42, 0.88, crest) * 0.62 + ringFoam * 1.25;
  vec3 envReflect = reflLit * (0.025 + 0.30 * fresnel + 0.75 * facetGlint);

  // Dynamic Flashlight / Camcorder Beam Specular Glint on wet ripples!
  float beam = uTorch * flashlightBeam(vView, wn);
  vec3 offset = vView - uTorchOrigin;
  vec3 ray = normalize(offset);
  vec3 Hvec = normalize(-ray + V);
  float spec = uTorch * pow(max(dot(wn, Hvec), 0.0), 32.0) * smoothstep(0.75, 0.98, dot(ray, uTorchDirection)) / (1.0 + dot(offset, offset) * 0.14);

  // Shoreline meniscus & duckweed/foam rim around banks and central islands
  float meniscus = (1.0 - smoothstep(0.0, 0.13, shoreDist)) * (0.45 + 0.55 * sin(p.x * 14.0 + p.y * 11.0 + t * 1.6));
  float foam = clamp(meniscus * 0.48 + ringFoam * 0.90, 0.0, 1.0);

  vec3 col = waterBody * (vLit * 0.88 + vec3(0.014, 0.024, 0.016)) + envReflect * 0.50;
  col = mix(col, uFoamCol * (vLit * 0.85 + vec3(0.10)), foam * 0.52);
  col += (waterBody * 0.9 + vec3(0.42, 0.48, 0.40)) * beam + vec3(0.95, 0.98, 0.90) * spec * 0.90;

  float edgeFeather = smoothstep(0.0, 0.06, shoreDist);
  float outAlpha = clamp(mix(0.48, 0.88, smoothstep(0.0, 0.78, depth)) + fresnel * 0.18 + facetGlint * 0.15 + spec * 0.25, 0.36, 0.95) * edgeFeather * uAlpha;
  gl_FragColor = vec4(col, outAlpha);
}`;

const CAUSTIC_FRAG = `
uniform float uWaterTime;
uniform float uDim;
varying vec3 vLit;
varying vec2 vUv;
void main() {
  vec2 p = floor(vUv / 0.045) * 0.045;
  float t = uWaterTime * 1.25;
  float c1 = sin(p.x * 7.5 + sin(p.y * 5.2 + t) * 1.4 - t * 0.8);
  float c2 = cos(p.y * 8.1 + cos(p.x * 4.8 - t * 0.9) * 1.4 + t * 0.7);
  float web = pow(max(0.0, (c1 + c2) * 0.5), 4.0);
  float a = web * 0.24 * uDim;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vLit * vec3(0.65, 0.92, 0.62) * web * 0.55, a);
}`;

/**
 * Build a 2027 AAA multi-layer animated forest water surface + submerged caustic
 * light projection + interactive footstep/ceiling-drip ripple rings!
 *
 * `basins`: `[{ x0, z0, x1, z1, depth?, waterY?, islands?: [[ix0, iz0, ix1, iz1], ...] }]`
 */
export function buildForestWater(c, basins, opt = {}) {
  if (!basins?.length) return null;
  const { kit, H } = c;
  const waterBatch = new Batch(false);
  const causticBatch = new Batch(false);
  const islands = opt.islands || [];

  const shoreDistAt = (b, x, z) => {
    const dp = b.depth ?? 0.38;
    if (dp < 0.16) {
      // Shallow surface puddles get an organic scalloped elliptical shoreline (`< 0` outside puddle -> discarded!)
      const mx = (b.x0 + b.x1) * 0.5, mz = (b.z0 + b.z1) * 0.5;
      const rx = Math.max(0.2, (b.x1 - b.x0) * 0.5), rz = Math.max(0.2, (b.z1 - b.z0) * 0.5);
      const ang = Math.atan2(z - mz, x - mx);
      const wobble = 0.10 * Math.sin(ang * 3.0 + mx) + 0.06 * Math.cos(ang * 5.0 - mz);
      const normR = Math.hypot((x - mx) / rx, (z - mz) / rz) + wobble;
      return (1.0 - normR) * Math.min(rx, rz);
    }
    let d = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
    for (const [ix0, iz0, ix1, iz1] of [...(b.islands || []), ...islands]) {
      const dx = Math.max(ix0 - x, 0, x - ix1);
      const dz = Math.max(iz0 - z, 0, z - iz1);
      const id = Math.hypot(dx, dz);
      if (id < d) d = id;
    }
    return Math.max(0, d);
  };

  for (const b of basins) {
    const wy = b.waterY ?? -0.06;
    const dp = b.depth ?? 0.38;
    // Surface pools (`wy > 0`, uncarved floor) get a rich dark submerged peat-bed stain underneath so water reads deep & glassy!
    if (wy > -0.01) {
      c.blot((b.x0 + b.x1) * 0.5, (b.z0 + b.z1) * 0.5, (b.x1 - b.x0) * 1.02, (b.z1 - b.z0) * 1.02, {
        rgb: [0.012, 0.024, 0.018],
        a: 0.88,
        y: 0.005,
      });
    }
    const step = opt.step ?? 0.28;
    const us = ticks(b.z1 - b.z0, step, 0.08);
    const vs = ticks(b.x1 - b.x0, step, 0.08);

    waterBatch.grid(
      [b.x0, wy, b.z0],
      [0, 0, 1],
      [1, 0, 0],
      us,
      vs,
      (u, v) => {
        const x = b.x0 + v, z = b.z0 + u;
        const sd = shoreDistAt(b, x, z);
        const depth01 = clamp(sd / 0.85, 0.04, 1.0) * clamp(dp / 0.38, 0.35, 1.0);
        return [depth01, sd];
      },
      WHITE
    );

    if (dp >= 0.14 && opt.caustics !== false) {
      causticBatch.grid(
        [b.x0 + 0.05, -dp + 0.009, b.z0 + 0.05],
        [0, 0, 1],
        [1, 0, 0],
        ticks(b.z1 - b.z0 - 0.1, 0.65, 0),
        ticks(b.x1 - b.x0 - 0.1, 0.65, 0),
        (u, v) => [b.x0 + v, b.z0 + u],
        WHITE
      );
    }

    // Glossy damp tide-rim darkening around the shoreline banks
    if (dp >= 0.16) {
      const wetBank = [0.07, 0.09, 0.05];
      c.flat.box(b.x0 - 0.12, -dp, b.z0 - 0.12, b.x1 + 0.12, 0.019, b.z0, wetBank);
      c.flat.box(b.x0 - 0.12, -dp, b.z1, b.x1 + 0.12, 0.019, b.z1 + 0.12, wetBank);
      c.flat.box(b.x0 - 0.12, -dp, b.z0, b.x0, 0.019, b.z1, wetBank);
      c.flat.box(b.x1, -dp, b.z0, b.x1 + 0.12, 0.019, b.z1, wetBank);
    }
  }

  const uWaterTime = { value: 0 };
  const rippleVecs = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0));
  let rippleState = makeRippleState(6);

  const shallowRgb = lin(opt.shallowHex || (opt.deep ? '#2c3d22' : '#3a4a28'));
  const deepRgb = lin(opt.deepHex || (opt.deep ? '#07120d' : '#0d1a12'));
  const foamRgb = lin(opt.foamHex || '#7d9458');

  const holder = new THREE.Group();
  c.add(holder);

  c.after.push(() => {
    const geo = kit.geometry(waterBatch, c.rt.lights, c.rt.amb, c.rt.lighting);
    if (!geo) return;
    const baseMat = kit.surface({
      map: opt.map || kit.tex.white(),
      room: c.rt.u,
      flick: geo.userData.flick,
      banks: geo.userData.banks,
      alpha: opt.alpha ?? 0.92,
      side: THREE.DoubleSide,
    });
    baseMat.vertexShader = WATER_VERT;
    baseMat.fragmentShader = WATER_FRAG;
    baseMat.uniforms.uWaterTime = uWaterTime;
    baseMat.uniforms.uShallowCol = { value: new THREE.Vector3(...shallowRgb) };
    baseMat.uniforms.uDeepCol = { value: new THREE.Vector3(...deepRgb) };
    baseMat.uniforms.uFoamCol = { value: new THREE.Vector3(...foamRgb) };
    baseMat.uniforms.uRipples = { value: rippleVecs };

    const waterMesh = new THREE.Mesh(geo, baseMat);
    waterMesh.name = `forest:water:${c.room.id}`;
    waterMesh.renderOrder = 3;
    waterMesh.matrixAutoUpdate = false;
    waterMesh.updateMatrix();
    holder.add(waterMesh);

    // Submerged animated caustic web (`detail: true` so low settings can skip it!)
    if (causticBatch.verts > 0) {
      const cGeo = kit.geometry(causticBatch, c.rt.lights, c.rt.amb, c.rt.lighting);
      if (cGeo) {
        const cMat = kit.surface({
          map: kit.tex.white(),
          room: c.rt.u,
          flick: cGeo.userData.flick,
          banks: cGeo.userData.banks,
          alpha: 0.35,
        });
        cMat.fragmentShader = CAUSTIC_FRAG;
        cMat.transparent = true;
        cMat.depthWrite = false;
        cMat.blending = THREE.AdditiveBlending;
        cMat.uniforms.uWaterTime = uWaterTime;
        const cMesh = new THREE.Mesh(cGeo, cMat);
        cMesh.name = `forest:detail-caustics:${c.room.id}`;
        cMesh.userData.detail = true;
        cMesh.renderOrder = 2;
        cMesh.matrixAutoUpdate = false;
        cMesh.updateMatrix();
        holder.add(cMesh);
      }
    }
  });

  const syncRipples = () => {
    for (let i = 0; i < 6; i++) {
      const r = rippleState.ripples[i];
      rippleVecs[i].set(r[0], r[1], r[2], r[3]);
    }
  };

  const spawnRipple = (x, z, strength = 1.0) => {
    rippleState = pushWaterRipple(rippleState, x, z, uWaterTime.value, strength);
    syncRipples();
  };

  // Optional periodic ceiling-leak water droplets falling into the first basin!
  const b0 = basins[0];
  let dripMesh = null;
  const dripSpots = opt.drips !== false && (b0.x1 - b0.x0) > 1.8
    ? [
        [(b0.x0 + b0.x1) * 0.5 + 0.65, (b0.z0 + b0.z1) * 0.5 - 0.55],
        [b0.x0 + (b0.x1 - b0.x0) * 0.28, b0.z0 + (b0.z1 - b0.z0) * 0.72],
      ]
    : [];
  if (dripSpots.length) {
    const db = new Batch();
    db.box(-0.012, -0.045, -0.012, 0.012, 0.045, 0.012, [0.76, 0.92, 0.86]);
    dripMesh = c.dynamic(db, { unlit: true });
  }

  let dripTimer = 1.3;
  let dripIdx = 0;
  let dropY = -99;
  let stepAccum = 0;

  c.tick((dt, t, me) => {
    uWaterTime.value = t;

    // 1. Falling ceiling water droplet -> concentric ripple ring on impact!
    if (dripSpots.length && dripMesh) {
      const [dx, dz] = dripSpots[dripIdx % dripSpots.length];
      const wy = b0.waterY ?? -0.06;
      if (dropY > wy) {
        dropY -= dt * 6.4;
        dripMesh.visible = true;
        dripMesh.position.set(dx, Math.max(wy, dropY), dz);
        if (dropY <= wy) {
          dripMesh.visible = false;
          spawnRipple(dx, dz, 0.72);
          if (me.inside) {
            const w = c.toWorld(dx, dz);
            c.env.play?.('drip', w.x, w.z, 6.5);
          }
        }
      } else {
        dripMesh.visible = false;
        dripTimer -= dt;
        if (dripTimer <= 0) {
          dripIdx++;
          dripTimer = 2.1 + (dripIdx % 3) * 0.85;
          dropY = H - 0.08;
        }
      }
    }

    // 2. Player footsteps / wading ripples when moving through a basin!
    if (me.inside && me.speed > 0.22) {
      const inBasin = basins.some((b) => me.x >= b.x0 && me.x <= b.x1 && me.z >= b.z0 && me.z <= b.z1);
      const bridged = opt.isBridged ? opt.isBridged(me.x, me.z) : false;
      if (inBasin && !bridged) {
        stepAccum += dt * me.speed;
        if (stepAccum >= 0.58) {
          stepAccum = 0;
          spawnRipple(me.x, me.z, clamp(0.65 + me.speed * 0.18, 0.65, 1.35));
        }
      } else {
        stepAccum = 0;
      }
    }
  });

  return {
    spawnRipple,
    get rippleState() { return rippleState; },
  };
}
