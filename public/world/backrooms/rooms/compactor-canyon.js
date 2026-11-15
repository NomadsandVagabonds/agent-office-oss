// Set Piece 3: The Compactor Canyon (`compactor-canyon`)
// Five corroded, 8.6-metre-tall mobile archive monoliths pierce straight up
// through a torn black hole in the damp Backrooms ceiling on sunken floor rails.
// Something pale stares out from the pitch-black 14 cm seams between the sealed
// stacks — vanishing into the dark the moment you crank the cast-iron wheel to
// part the paper cliffs and enter the hidden crawl-nest in Slot 3.
import * as THREE from 'three';
import { Vox, M, glow } from '../../vox/vox.js';
import { Batch, lin, drawText, WHITE } from '../kit.js';
import { P, card, framed, scatter } from '../bits.js';
import { camp, tallyMark } from '../traces.js';
import { placePickup } from '../hand.js';
import {
  N_BANKS, CAMP_SLOT, SEAM_GAP,
  canyonMetrics, slotCenterX, compactorWalkable, createCompactorState, stepCompactor,
} from './compactor-canyon/rule.js';

const STEEL_DARK = [0.08, 0.08, 0.09];
const STEEL_RAIL = [0.34, 0.33, 0.30];
const RUST_TRIM = [0.24, 0.14, 0.09];

/** Tarnished cast-iron 3-spoke archive hand-crank wheel. */
function handCrankVox() {
  const v = new Vox();
  const iron = M('#1b1c1e', 0), rim = M('#2d2b28', 0), brass = M('#8f6f32', 0), rust = M('#4a2818', 0);
  v.cyl('z', -3, 0, 0, 2, 2.4, iron);
  for (let a = 0; a < 24; a++) {
    const th = (a / 24) * Math.PI * 2;
    const x = Math.round(Math.cos(th) * 8), y = Math.round(Math.sin(th) * 8);
    v.box(x - 1, y - 1, 1, x + 1, y + 1, 2, a % 5 === 0 ? rust : rim);
  }
  for (const deg of [90, 210, 330]) {
    const rad = (deg * Math.PI) / 180;
    v.tube(0, 0, 1.5, Math.cos(rad) * 7.5, Math.sin(rad) * 7.5, 1.5, 0.85, iron);
  }
  v.box(-1, 7, 2, 1, 9, 6, brass);
  return v;
}

/**
 * Uncanny pale face & long fingers wedged sideways inside a 14 cm sealed seam:
 * unblinking glowing pinprick eyes in the dark + skeletal fingers gripping the shelf lip.
 */
function seamPeekerVox() {
  const v = new Vox();
  const pallid = M('#cbc3ae', 0), shadowSkin = M('#877f6d', 0);
  const voidBlack = M('#050506', 0), iris = glow('#f0ebd0'), coat = M('#161618', 0);
  // Narrow compressed torso wedged in the 14cm slit (x ∈ [-2, 2])
  v.box(-2, 0, -4, 2, 34, 2, coat);
  // Elongated gaunt head pressed forward toward +z
  v.box(-2, 35, -3, 2, 52, 3, shadowSkin);
  v.box(-2, 37, 2, 2, 50, 4, pallid);
  // Deep sunken eye hollows + asymmetric glowing pinprick pupils staring out of the crack!
  v.box(-2, 43, 3, -1, 47, 5, voidBlack);
  v.box(1, 42, 3, 2, 46, 5, voidBlack);
  v.box(-2, 44, 5, -1, 45, 6, iris);
  v.box(1, 43, 5, 2, 44, 6, iris);
  // Dark vertical stretched mouth slit
  v.box(-1, 37, 4, 1, 40, 5, voidBlack);
  // Four long pale fingers wrapping around the left steel shelf edge (x = -4..-2, z = 5..8)
  for (const fy of [25, 27, 29, 31]) {
    v.box(-3, fy, 2, -2, fy + 1, 8, shadowSkin);
    v.box(-4, fy, 5, -2, fy + 1, 8, pallid);
  }
  return v;
}

/** Gritty 128x128 corroded dark-putty steel end-cap with rust streaks & hand smudges. */
function makeEndCapTex(kit) {
  return kit.tex.custom('cc:endcap', 128, 128, (g, w, h) => {
    P(g, '#35342e', 0, 0, w, h);
    let s = 31337;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    // Mottled oxidised institutional putty-grey steel grain
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const v = r();
        if (v < 0.25) P(g, '#2b2a25', x, y, 2, 2);
        else if (v > 0.82) P(g, '#3f3d36', x, y, 2, 2);
      }
    }
    // Welded horizontal panel seam & dark vertical edge pilasters
    P(g, '#1c1b18', 0, 62, w, 2);
    P(g, '#47443c', 0, 64, w, 1);
    P(g, '#1f1e1b', 0, 0, 5, h);
    P(g, '#1f1e1b', w - 5, 0, 5, h);
    // Long brownish-rust water drips streaking down from the ceiling hole
    for (const rx of [16, 44, 79, 106]) {
      const rw = 2 + ((r() * 4) | 0);
      const rh = 38 + ((r() * 70) | 0);
      P(g, 'rgba(68, 34, 16, 0.45)', rx, 0, rw, rh);
      P(g, 'rgba(42, 20, 10, 0.35)', rx + 1, 0, Math.max(1, rw - 1), (rh * 0.65) | 0);
    }
    // Grimy dark oil/soot band along the bottom carriage skirt
    P(g, 'rgba(14, 12, 10, 0.55)', 0, h - 18, w, 18);
  });
}

/** Mouldering 128x128 cliff of sagging rusted shelves, water-warped boxes & dark gaps. */
function makeArchiveCliffTex(kit) {
  return kit.tex.custom('cc:cliff', 128, 128, (g, w, h) => {
    P(g, '#070708', 0, 0, w, h);
    let s = 49157;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let row = 0; row < 4; row++) {
      const yShelf = row * 32 + 29;
      P(g, '#2e2d29', 0, yShelf, w, 3);
      P(g, '#3d2417', 14 + row * 19, yShelf, 22, 2); // rust patch on shelf lip
      P(g, '#181816', 0, yShelf + 2, w, 1);
      P(g, '#22211e', 0, row * 32, 3, 32);
      P(g, '#22211e', 63, row * 32, 3, 32);

      for (const bayX of [4, 67]) {
        const roll = r();
        if (roll < 0.14) {
          // Eerie empty black void bay where files were dragged inward!
          P(g, '#040405', bayX, row * 32 + 4, 56, 25);
          P(g, '#8c836c', bayX + 8, yShelf - 3, 16, 3); // lone spilled folder
        } else if (roll < 0.66) {
          // Crushed, damp-stained 1990s archival banker's boxes
          for (const dx of [0, 28]) {
            const bx = bayX + dx, bw = 26, bh = 17 + ((r() * 5) | 0);
            const by = yShelf - bh;
            const tone = r() < 0.38 ? '#8f8468' : r() < 0.76 ? '#a3987c' : '#736952';
            P(g, tone, bx, by, bw, bh);
            P(g, '#5e5541', bx - 1, by, bw + 2, 4); // warped lid
            // Damp rot soaking up from bottom of box
            if (r() < 0.55) P(g, 'rgba(36, 24, 14, 0.52)', bx, yShelf - 6, bw, 6);
            P(g, '#cfc7b0', bx + 6, by + 6, 14, 7); // yellowed label
            P(g, '#5c1914', bx + 8, by + 8, 10, 2); // dried-blood red stamp
          }
        } else {
          // Leaning mouldy ledgers & black personnel binders
          let x = bayX;
          while (x < bayX + 52) {
            const bw = 4 + ((r() * 4) | 0);
            const bh = 19 + ((r() * 6) | 0);
            const col = r() < 0.28 ? '#3d1614' : r() < 0.56 ? '#1b1d20' : r() < 0.80 ? '#2b2923' : '#7d7156';
            P(g, col, x, yShelf - bh, bw, bh);
            P(g, '#aba38c', x + 1, yShelf - bh + 4, Math.max(1, bw - 2), 3);
            P(g, '#09090a', x + 1, yShelf - 5, Math.max(1, bw - 2), 2);
            x += bw + 1;
          }
        }
      }
    }
    // Vertical water-damage streak across all 4 shelves
    P(g, 'rgba(20, 14, 8, 0.34)', 38, 0, 14, h);
  });
}

export function build(c) {
  const { W, D, H, R, kit, params: p } = c;
  // Build damp Backrooms shell WITHOUT auto ceiling panels so we control the claustrophobic dark lighting
  c.shell({ panels: false });

  const { bankW, bankD, halfSpan, halfD } = canyonMetrics(W, D);
  // Monoliths pierce straight UP through the torn acoustic ceiling (`H + 0.32`)!
  const bankH = H + 0.32;
  const initialSlot = p.initialSlot ?? 1;

  // 1. Torn Black Ceiling Chasm Where the 5 Archive Cliffs Punch Through Upper Floors
  for (let hx = -halfSpan + 0.3; hx <= halfSpan - 0.3; hx += 1.2) {
    for (let hz = -halfD + 0.4; hz <= halfD - 0.4; hz += 1.2) {
      c.hole(hx, hz, 2);
    }
  }
  c.blot(0, 0, halfSpan * 2.05, halfD * 1.95, {
    rgb: [0.06, 0.04, 0.02], a: 0.65, y: H - 0.005, down: true,
  });
  // Hanging snapped ceiling grid T-bars & cables dangling along the torn ceiling rim
  for (const sx of [-halfSpan + 0.2, 0, halfSpan - 0.2]) {
    c.flat.box(sx - 0.02, H - 0.55, halfD - 0.15, sx + 0.02, H, halfD - 0.11, STEEL_DARK);
    c.flat.box(sx - 0.02, H - 0.65, -halfD + 0.11, sx + 0.02, H, -halfD + 0.15, STEEL_DARK);
  }

  // 2. Sunken Corroded Steel Floor Rails & Viscous Dark Seepage Pooling on the Carpet
  const railZs = [-halfD + 0.85, -halfD * 0.33, halfD * 0.33, halfD - 0.85];
  for (const rz of railZs) {
    c.flat.box(-halfSpan - 0.35, 0.001, rz - 0.09, halfSpan + 0.35, 0.012, rz + 0.09, STEEL_DARK, { step: 4 });
    c.flat.box(-halfSpan - 0.32, 0.012, rz - 0.025, halfSpan + 0.32, 0.024, rz + 0.025, STEEL_RAIL, { step: 4 });
  }
  // Scuffed faded rust-brown warning line along the track trench
  for (const zLine of [-halfD - 0.26, halfD + 0.26]) {
    for (let x = -halfSpan - 0.2; x < halfSpan + 0.1; x += 0.88) {
      c.flat.box(x, 0.003, zLine - 0.035, Math.min(halfSpan + 0.2, x + 0.44), 0.008, zLine + 0.035, RUST_TRIM);
    }
  }

  // Dark viscous stains oozing out from beneath sealed Slot 3 (`CAMP_SLOT`) onto both walkways!
  const campX = slotCenterX(W, CAMP_SLOT);
  const closedSeam3X = statePreviewSeamX(W, initialSlot, CAMP_SLOT);
  c.blot(closedSeam3X, halfD + 0.32, 1.45, 1.35, { rgb: [0.03, 0.015, 0.01], a: 0.72 });
  c.blot(closedSeam3X, -halfD - 0.28, 1.30, 1.15, { rgb: [0.03, 0.015, 0.01], a: 0.66 });
  c.blot(-halfSpan - 0.6, 1.4, 2.1, 2.8, { rgb: [0.05, 0.04, 0.02], a: 0.48 });
  scatter(c, closedSeam3X, halfD + 0.75, 6, 0.85, '#cfc5a8');

  // Abandoned overturned chair & spilled archive boxes in the dim outer perimeter aisle
  c.prop('chair', -W / 2 + 0.95, 1.8, {
    y: 0.28, rot: 0.9, tilt: [Math.PI / 2, 0.2], solid: false, shadow: false,
  });
  c.prop('boxes', W / 2 - 0.95, -2.1, { rot: 0.4, solid: true });

  // 3. Concealed Crawl-Nest & Retention Papers inside `CAMP_SLOT` (Slot 3 — sealed at t = 0!)
  camp(c, campX, 0.15, Math.PI / 2, { narrow: true });
  placePickup(c, 'papers', campX, -1.25, 0, { label: 'take archived retention files' });
  // Eerie blood-amber emergency bulb trapped deep inside sealed Slot 3, knifing through the 14cm crack
  c.light(campX, 1.15, 0.2, '#d95424', 1.55, { far: 5.8, k: 1.7 });

  // Desperate scratched tally marks on the back wall aligned with Slot 3 & on the front side wall
  tallyMark(c, 'back', campX, R, 1.42);
  tallyMark(c, 'left', 1.2, R, 1.28);

  // Grimy yellowed warning placard near the entrance
  const signSpot = c.wallSpot(1.5, ['front', 'left', 'right']);
  if (signSpot) {
    const tex = card(c, `cc:sign:${p.series}`, [
      `SUB-ARCHIVE ${p.series} · CONDEMNED`,
      'DO NOT ROLL RANGES IF',
      'MOVEMENT HEARD IN SEAM',
    ], { w: 196, h: 74, bg: '#cfc5a8', fg: '#1a1612', edge: '#5e2118', size: 9, pad: 8 });
    framed(c, c.mapped('cc:sign', tex), signSpot.side, signSpot.at, 1.48, 1.24, 0.46, null, [0.16, 0.12, 0.09]);
  }

  // Corroded range index placards (`A-01` .. `E-05`)
  const rangeCodes = ['A-01', 'B-02', 'C-03', 'D-04', 'E-05'];
  const rangeTex = kit.tex.custom(`cc:ranges:${p.series}`, 256, 48, (g) => {
    for (let i = 0; i < N_BANKS; i++) {
      const ox = i * 51;
      P(g, '#c9bfa4', ox, 0, 50, 48);
      P(g, '#1c1a17', ox, 0, 50, 15);
      drawText(g, [rangeCodes[i]], ox, 1, 50, 13, { color: '#dfd6be', size: 9 });
      drawText(g, [p.series, i === 2 ? 'SEALED' : `${1986 + i * 2}`], ox, 17, 50, 28, {
        color: i === 2 ? '#6e1b14' : '#242019', size: 8,
      });
      P(g, 'rgba(52,30,16,0.28)', ox, 36, 50, 12);
    }
  }, { clamp: true });

  // 4. Five Towering 8.6-Metre Corroded Shelving Monoliths
  let state = createCompactorState(W, initialSlot);
  c.rt.coopRead=()=>structuredClone(state);c.rt.coopApply=value=>{state=structuredClone(value);};
  c.rt.clip = (x, z, r) => compactorWalkable(x, z, r, W, D, state);
  const cliffTex = makeArchiveCliffTex(kit);
  const endCapTex = makeEndCapTex(kit);
  const crankGeo = kit.model('cc:crank', handCrankVox);
  const bankNodes = [];

  for (let i = 0; i < N_BANKS; i++) {
    const initX = state.banks[i].x;
    const x0 = initX - bankW / 2, x1 = initX + bankW / 2;
    const z0 = -halfD, z1 = halfD;

    const shelfB = new Batch();
    const frameB = new Batch();
    const placardB = new Batch();
    const crankB = new Batch(true);

    const uScale = 2.2, vScale = 2.2;
    shelfB.grid([x0 + 0.03, 0.16, z0 + 0.10], [0, 0, 1], [0, 1, 0], [0, bankD - 0.20], [0, bankH - 0.18],
      (u, v) => [(u + i * 0.7) / uScale, v / vScale], WHITE);
    shelfB.grid([x1 - 0.03, 0.16, z1 - 0.10], [0, 0, -1], [0, 1, 0], [0, bankD - 0.20], [0, bankH - 0.18],
      (u, v) => [(u + i * 1.3) / uScale, v / vScale], WHITE);

    // Heavy rusted rail carriage + towering front/back stained steel end-cap walls piercing the ceiling!
    frameB.box(x0 + 0.03, 0.02, z0 + 0.03, x1 - 0.03, 0.16, z1 - 0.03, [0.35, 0.34, 0.32], { uv: 1.2, step: 3.5 });
    frameB.box(x0, 0.14, z1 - 0.12, x1, bankH, z1, WHITE, { uv: 1.5, step: 3.5 });
    frameB.box(x0, 0.14, z0, x1, bankH, z0 + 0.12, WHITE, { uv: 1.5, step: 3.5 });
    for (const sx of [x0, x1 - 0.07]) {
      frameB.box(sx, 0.14, z1 - 0.14, sx + 0.07, bankH, z1 + 0.02, [0.52, 0.50, 0.48], { uv: 1.5, step: 3.5 });
      frameB.box(sx, 0.14, z0 - 0.02, sx + 0.07, bankH, z0 + 0.14, [0.52, 0.50, 0.48], { uv: 1.5, step: 3.5 });
    }

    const u0 = (i * 51) / 256, u1 = (i * 51 + 50) / 256;
    const uv = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
    placardB.quad([initX - 0.24, 1.50, z1 + 0.018], [initX + 0.24, 1.50, z1 + 0.018], [initX + 0.24, 1.92, z1 + 0.018], [initX - 0.24, 1.92, z1 + 0.018], WHITE, uv);
    placardB.quad([initX + 0.24, 1.50, z0 - 0.018], [initX - 0.24, 1.50, z0 - 0.018], [initX - 0.24, 1.92, z0 - 0.018], [initX + 0.24, 1.92, z0 - 0.018], WHITE, uv);

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(0.026, 0.026, 0.026);
    q.identity();
    m4.compose(pos.set(initX, 1.06, z1 + 0.04), q, scl);
    crankB.addVox(crankGeo.solid, m4);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    m4.compose(pos.set(initX, 1.06, z0 - 0.04), q, scl);
    crankB.addVox(crankGeo.solid, m4);

    const shelfHolder = c.dynamic(shelfB, { map: cliffTex, pivot: [initX, 0, 0] });
    const frameHolder = c.dynamic(frameB, { map: endCapTex, pivot: [initX, 0, 0] });
    const placardHolder = c.dynamic(placardB, { map: rangeTex, pivot: [initX, 0, 0] });
    const crankHolder = c.dynamic(crankB, { pivot: [initX, 1.06, 0] });

    const inEndCorridor = () => {
      const me = c.env.player?.me;
      if (!me || state.anyMoving) return false;
      const loc = c.toLocal(me.x, me.z);
      return Math.abs(loc.z) >= halfD - 0.05;
    };

    const useFront = c.use({
      x: initX,
      z: z1 + 0.26,
      r: 1.85,
      when: inEndCorridor,
      label: `turn range ${rangeCodes[i]} hand-crank`,
      use: () => triggerCrank(i, z1),
    });
    const useBack = c.use({
      x: initX,
      z: z0 - 0.26,
      r: 1.85,
      when: inEndCorridor,
      label: `turn range ${rangeCodes[i]} hand-crank`,
      use: () => triggerCrank(i, z0),
    });

    bankNodes.push({ i, shelfHolder, frameHolder, placardHolder, crankHolder, useFront, useBack });
  }

  // 5. Uncanny Seam Watchers: Pale Fingers & Glowing Pinprick Eyes Wedged in the 14cm Slits!
  const peekerGeo = kit.model('cc:peeker', seamPeekerVox);
  const peekerB = new Batch(true);
  {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(0.022, 0.028, 0.022);
    // Front walkway watcher wedged inside the sealed 14cm crack between Bank 2 & Bank 3 (`CAMP_SLOT`)!
    const seamFrontX = (state.banks[2].x + bankW / 2 + state.banks[3].x - bankW / 2) * 0.5;
    q.identity();
    m4.compose(pos.set(seamFrontX, 0.36, halfD - 0.14), q, scl);
    peekerB.addVox(peekerGeo.solid, m4);

    // Second watcher wedged in a back-walkway seam (between Bank 0 & Bank 1 if closed, else Bank 3 & Bank 4)
    const pairIdx = initialSlot <= 1 ? 3 : 0;
    const seamBackX = (state.banks[pairIdx].x + bankW / 2 + state.banks[pairIdx + 1].x - bankW / 2) * 0.5;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    m4.compose(pos.set(seamBackX, 0.36, -halfD + 0.14), q, scl);
    peekerB.addVox(peekerGeo.solid, m4);
  }
  const peekerHolder = c.dynamic(peekerB);

  // Approaching the sealed front seam triggers a hollow metallic knock from inside the stack
  let seamWhispered = false;
  c.zone({
    x0: closedSeam3X - 1.5,
    z0: halfD - 0.1,
    x1: closedSeam3X + 1.5,
    z1: halfD + 2.0,
    enter: () => {
      if (seamWhispered || !peekerHolder.visible) return;
      seamWhispered = true;
      const wp = c.toWorld(closedSeam3X, halfD - 0.2);
      c.env.play('knock', wp.x, wp.z, 9);
      c.env.play('rustle', wp.x, wp.z, 7);
    },
  });

  function vanishPeekers() {
    if (!peekerHolder.visible) return;
    peekerHolder.visible = false;
    const wp = c.toWorld(closedSeam3X, halfD - 0.5);
    c.env.play('rustle', wp.x, wp.z, 12);
  }

  function syncBankWorld(node, bx) {
    node.shelfHolder.position.x = bx;
    node.frameHolder.position.x = bx;
    node.placardHolder.position.x = bx;
    node.crankHolder.position.x = bx;

    const uf = c.toWorld(bx, halfD + 0.26);
    node.useFront.wx = uf.x; node.useFront.wz = uf.z;
    const ub = c.toWorld(bx, -halfD - 0.26);
    node.useBack.wx = ub.x; node.useBack.wz = ub.z;
  }

  function triggerCrank(bankIdx, endZ) {
    const res = stepCompactor(state, { crankedBank: bankIdx });
    state = res.state;
    const wp = c.toWorld(state.banks[bankIdx].x, endZ);
    if (res.startedRoll) {
      vanishPeekers();
      c.env.play('squeak', wp.x, wp.z, 12);
      c.env.play('slide', wp.x, wp.z, 16);
    } else {
      c.env.play('clack', wp.x, wp.z, 8);
    }
  }

  for (const dr of c.room.doors) {
    if (dr.side !== 'front') c.exitSign(dr, 'EXIT');
  }

  // 6. Oppressive Flickering Backrooms Lighting (`<= 8` lights total, leaving upper cliffs in deep murk)
  const deadPanelB = c.mapped('dead', kit.tex.panel(false));
  for (const [dx, dz] of [[-halfSpan * 0.65, halfD + 1.2], [halfSpan * 0.65, -halfD - 1.2], [-W / 2 + 1.1, 0], [W / 2 - 1.1, 0]]) {
    deadPanelB.quad([dx - 0.3, H - 0.006, dz - 0.6], [dx + 0.3, H - 0.006, dz - 0.6], [dx + 0.3, H - 0.006, dz + 0.6], [dx - 0.3, H - 0.006, dz + 0.6], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  // One real flickering fluorescent strip over the front crank corridor (drives `rt.u.flick`!)
  {
    const fx = 0.6, fz = halfD + 1.15;
    const fb = new Batch();
    fb.quad([fx - 0.3, H - 0.006, fz - 0.6], [fx + 0.3, H - 0.006, fz - 0.6], [fx + 0.3, H - 0.006, fz + 0.6], [fx - 0.3, H - 0.006, fz + 0.6], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const fMesh = new THREE.Mesh(kit.plain(fb), kit.glowing(kit.tex.panel(true), 2.1, lin('#d4df9e')));
    fMesh.userData.on = fMesh.material.color.clone();
    c.rt.flickers.push(fMesh);
    c.rt.group.add(fMesh);
    c.light(fx, 3.1, fz, '#cfd99a', 1.35, { far: 10.5, flick: true, k: 1.8 });
  }
  // One dim sickly strip over the far back walkway
  const onPanelB = c.shining('panel', kit.tex.panel(true), 1.8, lin('#cbd696'));
  onPanelB.quad([-1.2 - 0.3, H - 0.006, -halfD - 1.15 - 0.6], [-1.2 + 0.3, H - 0.006, -halfD - 1.15 - 0.6], [-1.2 + 0.3, H - 0.006, -halfD - 1.15 + 0.6], [-1.2 - 0.3, H - 0.006, -halfD - 1.15 + 0.6], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  c.light(-1.2, 3.1, -halfD - 1.15, '#c8d494', 1.10, { far: 9.5, k: 1.8 });

  let rumbleTimer = 0;
  c.tick((dt) => {
    if (!state.anyMoving) return;
    if (peekerHolder.visible) vanishPeekers();

    const res = stepCompactor(state, { dt });
    state = res.state;

    for (let i = 0; i < N_BANKS; i++) {
      const b = state.banks[i];
      const node = bankNodes[i];
      syncBankWorld(node, b.x);
      node.crankHolder.rotation.z = b.wheelAngle;
    }

    rumbleTimer -= dt;
    if (rumbleTimer <= 0 && state.anyMoving) {
      rumbleTimer = 0.55;
      const midW = c.toWorld(0, 0);
      c.env.play('rattle', midW.x, midW.z, 14);
    }
    if (res.settled) {
      const midW = c.toWorld(slotCenterX(W, state.openSlot), 0);
      c.env.play('thunk', midW.x, midW.z, 16);
    }
  });
}

function statePreviewSeamX(W, initialSlot, seamIdx) {
  const st = createCompactorState(W, initialSlot);
  const { bankW } = canyonMetrics(W, 18);
  const leftEdge = st.banks[seamIdx - 1].x + bankW / 2;
  const rightEdge = st.banks[seamIdx].x - bankW / 2;
  return (leftEdge + rightEdge) * 0.5 || (leftEdge + SEAM_GAP * 0.5);
}
