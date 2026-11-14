// Voxel rigs for The Absorbed Staff: standard upstairs Office workers —
// humans, cats, dogs, goblins, and robots (`avatar/build.js`) — who have been
// 2/3 swallowed by a Backrooms wall, carpet, or acoustic drop-ceiling tile.
//
// Visual signatures:
//   - Species-aware Backrooms horror faces (pallid damp skin/fur/oxidized steel,
//     bulging bloodshot eyes, feline slit pupils, slack fanged muzzles, hollow
//     sockets, crooked specs, shattered robot visors) warped by a wax-melt droop.
//   - 2/3 surface absorption with zero back-wall bleed: organic wallpaper,
//     carpet, or broken ceiling-tile assimilation blisters & creeping tendrils.
//   - 1.5x+ elongated 2-joint (shoulder + elbow) droopy arms ending in long
//     splayed crooked fingers that dangle, reach, and clamp around the player.
import * as THREE from 'three';
import { Vox, M, C, glow, tone, mix, toCss, rgbOf, noise3 } from '../../vox/vox.js';
import { buildCharacter, JOINT } from '../../avatar/build.js';
import { Batch, lamp } from '../kit.js';
import {
  eraseNose, eyelessBrow, carvedSmile, bulgingEye, hollowSocket,
  slippedMouth, carveCreases, crookedSpecs, slipRows, tornVox,
  jointMat, localJointMat,
} from '../uncanny.js';

const S = [0.026, 0.0275, 0.026];

const distRgb = (a, b) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return Math.hypot(ar - br, ag - bg, ab - bb);
};

/** Pull skin/fur/clothes halfway toward damp Backrooms drywall & mildew pallor. */
export function assimilateLook(rawLook, surfaceHex = '#c8be96') {
  const species = rawLook?.species || 'human';
  const baseSkin = rawLook?.skin || '#dfc0a0';
  const pallor = species === 'robot' ? 0.44 : species === 'cat' || species === 'dog' ? 0.42 : 0.48;
  const skinTint = toCss(mix('#cbc3a2', surfaceHex, 0.45));
  const clothTint = toCss(mix('#585343', surfaceHex, 0.35));
  return {
    species,
    hair: rawLook?.hair || 'short',
    hairColor: toCss(mix(rawLook?.hairColor || '#2a2018', '#4a4638', 0.32)),
    outfit: rawLook?.outfit || 'cardigan',
    outfitColor: toCss(mix(rawLook?.outfitColor || '#5a6fa8', clothTint, 0.40)),
    accessory: rawLook?.accessory || 'none',
    facial: rawLook?.facial || 'none',
    skin: toCss(mix(baseSkin, skinTint, pallor)),
  };
}

/** Mottle skin or fur across a wider RGB tolerance so animal muzzles & ears also weather. */
function mottleSpeciesHead(v, skinHex, seed, tol = 64) {
  const target = rgbOf(C(skinHex));
  const bruise = M(toCss(mix(skinHex, '#2c171a', 0.52)), 1);
  const mildew = M(toCss(mix(skinHex, '#474632', 0.45)), 1);
  v.remap((x, y, z, cur) => {
    if (distRgb(rgbOf(cur), target) > tol) return cur;
    let c = cur;
    const n = noise3(x, y, z, seed);
    if (n > 0.80) c = tone(c, 0.08);
    else if (n < 0.24) c = mix(c, mildew, 0.38);
    if (z >= 3 && Math.abs(x) >= 5 && y >= 37 && y <= 44) c = mix(c, bruise, 0.34);
    if (y <= 36 && z >= 4) c = tone(c, -0.2);
    return c;
  });
}

/**
 * Wax-melt / surreal Backrooms droop warp on a head `Vox`.
 * Shifts voxels vertically by a smooth asymmetric sag field (downward `-y` for
 * wall/floor mounts; `+y` in figure space when inverted on a ceiling so cheeks,
 * ears, and muzzles sag toward the floor under gravity), filling 1-voxel stretch gaps.
 */
function droopHeadVox(v, { side = 1, amp = 3.2, seed = 17, inverted = false } = {}) {
  const src = v.clone();
  v.map.clear();
  const grav = inverted ? 1 : -1;
  const shiftAt = (x, z) => {
    const across = Math.max(0, Math.min(1.25, (side * x + 10) / 18));
    const wave = 0.72 + 0.28 * Math.sin(z * 0.32 + (seed % 11));
    const edgeDrip = Math.abs(x) >= 6 || z >= 7 ? 1.18 : 0.88;
    return Math.round(grav * amp * across * wave * edgeDrip);
  };

  src.each((x, y, z, col) => {
    // Keep neck socket near y=35 anchored enough to meet torso while letting jaw/cheeks sag past it
    const weight = inverted
      ? Math.min(1.15, Math.max(0.25, (y - 34) / 14))
      : Math.min(1.2, Math.max(0.35, (53 - y) / 15));
    const dy = Math.round(shiftAt(x, z) * weight);
    const ny = y + dy;
    v.set(x, ny, z, col);
    // If the voxel above shifted less, bridge any 1-voxel tear so the melt reads like stretched wax
    if (src.has(x, y + 1, z)) {
      const wAbove = inverted
        ? Math.min(1.15, Math.max(0.25, (y + 1 - 34) / 14))
        : Math.min(1.2, Math.max(0.35, (53 - (y + 1)) / 15));
      const nyAbove = (y + 1) + Math.round(shiftAt(x, z) * wAbove);
      if (Math.abs(nyAbove - ny) >= 2) {
        const step = nyAbove > ny ? 1 : -1;
        for (let fy = ny + step; fy !== nyAbove; fy += step) {
          if (!v.has(x, fy, z)) v.set(x, fy, z, col);
        }
      }
    }
  });
  return v;
}

/** Darken cheerful party hats or accessories so they match Backrooms grime. */
function weatherAccessory(v, seed) {
  if (!v) return null;
  const grime = M('#3b3529', 2);
  v.remap((x, y, z, cur) => {
    const n = noise3(x, y, z, seed);
    return n < 0.28 ? mix(cur, grime, 0.48) : tone(cur, -0.14);
  });
  return v;
}

function sculptHumanHorror(head, look, variant, seed) {
  eraseNose(head);
  mottleSpeciesHead(head, look.skin, seed, 50);
  const v = variant % 4;
  if (v === 0) {
    // One stark bloodshot bulging eye + one gaping carved black socket
    bulgingEye(head, -4.5, 44, 5, 5, 0, 0, look.skin, { bloodshot: true, glitch: 2 });
    hollowSocket(head, 4.2, 43.5, 5, 5, look.skin, { ember: seed % 2 === 0 });
    slippedMouth(head, 0.5, 37, 9, 3, look.skin, { curve: 0.7, slope: -0.22, teeth: true });
    carveCreases(head, look.skin, [[-7, 48, 5, 47, false], [-7, 41, -3, 36, true], [3, 41, 7, 36, true]]);
  } else if (v === 1) {
    // Jensen-echo: mismatched staring sclera behind crooked open wire rims + slipped jaw
    bulgingEye(head, -4.8, 44.5, 4, 4, 0, -1, look.skin, { bloodshot: true, glitch: -2 });
    bulgingEye(head, 4.2, 42.5, 4, 4, -1, 0, look.skin, { bloodshot: true });
    slippedMouth(head, -0.5, 36.5, 8, 3, look.skin, { curve: -0.5, slope: 0.2, teeth: true });
    carveCreases(head, look.skin, [[-6, 48, 5, 48, true], [-7, 40, -3, 38, true], [2, 39, 7, 37, true]]);
    if (look.accessory === 'none') crookedSpecs(head, { leftY: 42, rightY: 40, h: 5, z: 9, frameHex: '#1b1713' });
    slipRows(head, [[36, 38, 1, 0]]);
  } else if (v === 2) {
    // Eyeless blank upper face + stretched open groan/scream maw
    eyelessBrow(head, look.skin);
    carvedSmile(head, look.skin, { halfW: 6, yLow: 35.5, lift: 5.8, openH: 5.0, teeth: true });
    carveCreases(head, look.skin, [[-8, 41, -7, 45, true], [7, 41, 8, 45, true]]);
  } else {
    // One eye slid halfway down the cheek + slack crooked mouth
    bulgingEye(head, -4.5, 45, 4, 4, 1, 0, look.skin, { bloodshot: true });
    bulgingEye(head, 4.5, 40.5, 4, 4, -1, 1, look.skin, { bloodshot: true, glitch: 2 });
    slippedMouth(head, -1.5, 36, 8, 2, look.skin, { curve: -0.8, slope: -0.25, teeth: true });
    carveCreases(head, look.skin, [[-6, 49, 4, 47, true], [2, 45, 7, 44, true]]);
  }
}

function sculptCatHorror(head, look, variant, seed) {
  // Remove neat cartoon horizontal whiskers outside skull, replace with limp drooping strands
  head.carve(-13, 37, 7, -9, 42, 10);
  head.carve(9, 37, 7, 13, 42, 10);
  // Darken bright pink inner-ears & nose, wilt one ear sideways
  const rawEar = M('#471d22', 1), noseDark = M('#1f1012', 0);
  head.paint(-8, 51, 0, 8, 57, 3, (x, y, z, cur) => (distRgb(rgbOf(cur), 0xe8a0a0) < 45 ? rawEar : cur));
  // Wilt left ear (`x < 0`) so it droops outward & down
  head.carve(-9, 52, -3, -2, 58, 3);
  const furD = M(toCss(tone(look.skin, -0.22)), 1);
  head.tube(-5, 51, 0, -11, 47, 1, 1.8, furD);
  head.tube(-10, 47, 1, -12, 43, 2, 1.1, rawEar);

  mottleSpeciesHead(head, look.skin, seed, 74);

  // Split gaping feline maw through the muzzle (`y = 35..40, z = 7..10`) with needle fangs
  const voidCol = M('#090305', 0), gum = M('#481319', 1), fang = M('#e6ddc0', 0);
  for (let x = -3; x <= 3; x++) {
    for (let y = 35; y <= 39; y++) {
      const inMaw = Math.abs(x) <= 2 && y >= 36 && y <= 38;
      if (inMaw) {
        head.set(x, y, 10, 0);
        head.set(x, y, 9, 0);
        head.set(x, y, 8, voidCol);
        head.set(x, y, 7, voidCol);
      } else if (head.has(x, y, 9)) {
        head.set(x, y, 9, gum);
      }
    }
  }
  head.box(-1, 40, 9, 1, 41, 11, noseDark);
  // Upper & lower needle fangs
  head.set(-2, 38, 9, fang); head.set(-2, 37, 9, fang);
  head.set(2, 38, 9, fang); head.set(2, 37, 9, fang);
  head.set(-1, 36, 9, fang); head.set(1, 36, 9, fang);

  // Drooping damp whiskers
  const whisk = M('#aba493', 0);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const wx = s < 0 ? -4 - i : 4 + i;
      const wy = 39 - Math.floor(i * 0.65);
      head.set(wx, wy, 8, whisk);
    }
  }

  // Stark bulging feline eyes with razor-vertical slit pupils (or 1 slit + 1 hollow socket)
  bulgingEye(head, -4.8, 45, 5, 4, 0, 0, look.skin, { bloodshot: true });
  // Paint vertical razor slit on left eye
  for (let y = 44; y <= 46; y++) head.set(-5, y, 9, M('#050407', 0));
  if (variant % 3 === 0) {
    hollowSocket(head, 4.5, 44.5, 5, 4, look.skin, { ember: true });
  } else {
    bulgingEye(head, 4.5, 44.5, 5, 4, 0, 0, look.skin, { bloodshot: true });
    for (let y = 43; y <= 45; y++) head.set(4, y, 9, M('#050407', 0));
  }
}

function sculptDogHorror(head, look, variant, seed) {
  // Carve away cute pink tongue (`z = 11..13, y = 36..37`)
  head.carve(-2, 35, 11, 2, 38, 14);
  mottleSpeciesHead(head, look.skin, seed, 78);

  // Stretch one floppy ear raggedly downward like wet leather
  const earCol = M(toCss(tone(look.skin, -0.34)), 1);
  head.rbox(-11, 32, -3, -9, 40, 2, 1, earCol);

  // Hollow out a slack, snarling hound jaw under the snout (`z = 7..12, y = 34..39`)
  const voidCol = M('#080305', 0), gum = M('#4a141a', 1), tooth = M('#dfd5b4', 0);
  const jowl = M(toCss(tone(look.skin, -0.22)), 1);
  // Drooping flews / jowls hanging below snout on both sides
  for (const sx of [-4, 3]) head.rbox(sx, 33, 7, sx + 1, 38, 11, 0, jowl);
  // Slack lower jaw + dark throat cavity
  head.box(-3, 33, 7, 3, 35, 11, gum);
  for (let x = -3; x < 3; x++) {
    for (let z = 8; z <= 11; z++) {
      head.set(x, 36, z, 0);
      head.set(x, 37, z, 0);
      head.set(x, 38, z, z === 11 ? 0 : gum);
    }
    head.set(x, 36, 7, voidCol);
    head.set(x, 37, 7, voidCol);
    if ((x + 8) % 2 === 0) {
      head.set(x, 35, 10, tooth);
      head.set(x, 38, 10, tooth);
    }
  }

  // Deep-set bloodshot hound eyes above the snout (with eerie pale tapetum option)
  const tapetum = variant % 2 === 0;
  bulgingEye(head, -4.8, 45.5, 4, 4, 0, -1, look.skin, { bloodshot: true, glowPupil: tapetum });
  if (variant % 4 === 3) {
    hollowSocket(head, 4.5, 45, 4, 4, look.skin, { ember: true });
  } else {
    bulgingEye(head, 4.5, 45, 4, 4, -1, 0, look.skin, { bloodshot: true, glowPupil: tapetum, glitch: 1 });
  }
}

function sculptGoblinHorror(head, look, variant, seed) {
  eraseNose(head);
  mottleSpeciesHead(head, look.skin, seed, 62);
  // Wilt the pointed goblin ears downward at the tips
  const skD = M(toCss(tone(look.skin, -0.22)), 1);
  head.carve(-17, 42, -2, -11, 50, 3);
  head.carve(11, 42, -2, 17, 50, 3);
  head.tube(-9, 43, 0, -15, 38, 1, 1.5, skD);
  head.tube(9, 43, 0, 15, 36, 1, 1.5, skD);

  // Elongated crooked yellowed tusks + gouged smile
  const tusk = M('#d8cea8', 0);
  head.box(-5, 36, 8, -4, 41, 10, tusk);
  head.box(3, 35, 8, 4, 40, 10, tusk);
  carvedSmile(head, look.skin, { halfW: 6, yLow: 36, lift: 5.5, openH: 3.8, teeth: true });
  bulgingEye(head, -4.5, 44.5, 5, 4, 1, 0, look.skin, { bloodshot: true, glitch: 2 });
  if (variant % 2 === 0) hollowSocket(head, 4.2, 44, 5, 4, look.skin, { ember: true });
  else bulgingEye(head, 4.2, 43, 4, 4, -1, -1, look.skin, { bloodshot: true });
}

function sculptRobotHorror(head, variant, seed) {
  // Corrode clean steel into oxidized wallpaper-stained metal + oil streaks
  const rust = M('#4f4332', 1), oil = M('#0d0d10', 1), voidCol = M('#07090c', 0);
  head.remap((x, y, z, cur) => {
    const n = noise3(x, y, z, seed);
    if (n < 0.22) return mix(cur, rust, 0.55);
    if (n > 0.82) return tone(cur, -0.18);
    return tone(cur, -0.08);
  });
  // Bend top antenna crookedly & dim bulb
  head.carve(-2, 51, -2, 2, 57, 2);
  head.tube(0, 51, 0, 4, 55, 2, 0.85, rust);
  head.sphere(4.5, 55.5, 2, 1.3, M('#6e5528', 1));

  // Shattered visor: one jaundiced scan-slipped CRT eye + one cracked dark void + oil tears
  for (let x = -7; x <= 6; x++) {
    for (let y = 39; y <= 47; y++) {
      if (head.has(x, y, 8)) head.set(x, y, 8, voidCol);
    }
  }
  const crt = glow('#d8e29b'), crtDim = M('#7c8454', 0);
  for (let dx = -2; dx <= 1; dx++) for (let dy = -2; dy <= 1; dy++) {
    head.set(-4 + dx, 44 + dy, 8, (dx === 0 && dy === 0) ? oil : crt);
  }
  // Horizontal scan-bleed from the live CRT eye
  head.set(-1, 44, 8, crt); head.set(0, 44, 8, crtDim);
  // Cracked right socket with faint dying spark
  head.carve(2, 41, 7, 6, 46, 9);
  head.box(2, 41, 6, 6, 46, 7, oil);
  if (variant % 2 === 0) head.set(4, 43, 7, glow('#c95b3c'));
  // Oil leaks weeping down jawplate + jagged voice-grille gash
  for (const ox of [-5, -4, 3, 4]) for (let y = 35; y <= 40; y++) {
    if (head.has(ox, y, 8)) head.set(ox, y, 8, oil);
  }
  for (let x = -5; x <= 4; x++) {
    const gy = 37 + ((x + 8) % 2);
    head.set(x, gy, 8, x % 2 === 0 ? crtDim : oil);
  }
}

export function buildAbsorbedHeadVox(spec, mount = 'wall') {
  const look = spec.assimilatedLook;
  const parts = buildCharacter(look, { seed: `abs:head:${spec.seed}`, provider: spec.provider });
  const head = parts.head;
  if (parts.accessory) {
    head.stamp(weatherAccessory(parts.accessory, spec.seed + 13));
  }

  switch (look.species) {
    case 'cat': sculptCatHorror(head, look, spec.faceVariant, spec.seed); break;
    case 'dog': sculptDogHorror(head, look, spec.faceVariant, spec.seed); break;
    case 'goblin': sculptGoblinHorror(head, look, spec.faceVariant, spec.seed); break;
    case 'robot': sculptRobotHorror(head, spec.faceVariant, spec.seed); break;
    default: sculptHumanHorror(head, look, spec.faceVariant, spec.seed); break;
  }

  droopHeadVox(head, {
    side: spec.droopSide || 1,
    amp: spec.droopAmp || 3.2,
    seed: spec.seed,
    inverted: mount === 'ceiling',
  });
  return head;
}

/**
 * 1.5x+ elongated upper arm (14 voxels from shoulder `(0,0,0)` to elbow `(0,-13.5,0)`).
 */
function buildLongUpperArmVox(look, surfaceHex, seed) {
  const v = new Vox();
  const robot = look.species === 'robot';
  const sleeveLong = look.outfit !== 'tee';
  const baseSleeve = M(look.outfit === 'vest' ? '#cfc8b4' : look.outfitColor, 2);
  const sk = M(robot ? '#7b828e' : look.skin, 1);
  const surfCol = M(surfaceHex, 2);

  // Rounded shoulder cap + stretched attenuated upper arm (`y = +2 .. -14`)
  v.rbox(-2, -9, -2, 2, 2, 2, 1, sleeveLong ? baseSleeve : sk);
  // Narrower lower half (`y = -14 .. -8`) so the 1.5x arm looks unnaturally drawn-out
  v.box(-1, -14, -2, 2, -8, 2, sleeveLong ? baseSleeve : sk);
  if (!sleeveLong) {
    v.paint(-2, -3, -2, 2, 2, 2, baseSleeve);
    v.paint(-2, -4, -2, 2, -3, 2, tone(baseSleeve, -0.2));
  }
  // Assimilation stain creeping down from the shoulder seam
  v.remap((x, y, z, cur) => {
    if (y >= -2 && noise3(x, y, z, seed) > 0.42) return mix(cur, surfCol, 0.55);
    return noise3(x, y, z, seed + 7) < 0.2 ? tone(cur, -0.14) : cur;
  });
  return v;
}

/**
 * 1.55x+ elongated forearm & 5-fingered crooked grasping hand (18.5 voxels from
 * elbow `(0,0,0)` down to fingertips `(0,-18.5,0)`).
 */
function buildLongForearmVox(look, side, seed) {
  const v = new Vox();
  const robot = look.species === 'robot';
  const sleeveLong = look.outfit !== 'tee';
  const baseSleeve = M(look.outfit === 'vest' ? '#cfc8b4' : look.outfitColor, 2);
  const sk = M(robot ? '#7b828e' : look.skin, 1);
  const skDark = M(toCss(mix(robot ? '#4b5058' : look.skin, '#2e1216', 0.56)), 1);
  const tipCol = M('#220b0e', 1);

  // Forearm shaft (`y = +1 .. -11`)
  v.box(-1, -11, -1, 2, 1, 2, sleeveLong ? baseSleeve : sk);
  if (sleeveLong) {
    // Tattered cuff giving way to bare wrist at y = -8..-11
    v.paint(-1, -8, -1, 2, -6, 2, look.outfit === 'suit' ? M('#d6d0be', 1) : tone(baseSleeve, -0.22));
    v.paint(-1, -11, -1, 2, -8, 2, sk);
  }

  // Gaunt bruised palm (`y = -14 .. -10`)
  v.box(-2, -14, -1, 3, -10, 2, sk);
  v.paint(-2, -14, -1, 3, -12, 2, skDark);

  // Thumb angling inward (`side` determines inner side toward player)
  const tx = side < 0 ? 2 : -2;
  v.box(tx, -15, 1, tx + 1, -12, 3, skDark);
  v.set(tx, -15, 3, tipCol);

  // 4 long, crooked, hooked grasping fingers (`y = -19 .. -14`) curving slightly toward +z
  for (const [fx, len] of [[-2, 4], [-1, 5], [1, 5], [2, 4]]) {
    for (let k = 0; k < len; k++) {
      const fy = -14 - k;
      const fz = k >= 2 ? (k >= 4 ? 2 : 1) : 0;
      v.set(fx, fy, fz, k >= len - 2 ? tipCol : skDark);
      if (k === 1) v.set(fx, fy, fz + 1, skDark);
    }
  }

  v.remap((x, y, z, cur) => (noise3(x, y, z, seed + 31) < 0.22 ? tone(cur, -0.12) : cur));
  return v;
}

/**
 * Build the 2/3-absorbed torso + organic surface assimilation blister/tendrils.
 * Returns `{ batch, shoulderL, shoulderR, headPos, headBaseRot, isInverted }`.
 */
function buildAbsorbedCore(kit, spec, mount, surfaceColors) {
  const look = spec.assimilatedLook;
  const sig = `${look.species}:${look.outfit}:${look.outfitColor}:${spec.faceVariant}:${spec.seed}`;
  const keyBase = `abs:core:${sig}:${mount}`;
  const parts = buildCharacter(look, { seed: keyBase, provider: spec.provider });
  const b = new Batch(true);

  const wallHex = surfaceColors?.wall || '#c8bc84';
  const carpetHex = surfaceColors?.carpet || '#7a6c4f';
  const ceilHex = surfaceColors?.ceil || '#cfccb8';
  const stainHex = '#2a2218';

  if (mount === 'wall') {
    // Slice torso below waist (`y < 19`), pitch forward +0.38 rad out of wall,
    // and clip any voxel behind the wall plane (`z < 0`) so 20 cm walls never bleed!
    const torso = parts.torso.clone();
    torso.carve(-12, 0, -12, 12, 19, 12);
    const surf = M(toCss(tone(wallHex, -0.06)), 2);
    const surfMid = M(toCss(mix(wallHex, stainHex, 0.26)), 2);
    const seep = M(toCss(mix(wallHex, stainHex, 0.54)), 2);
    const fissure = M('#16120c', 1);

    const pitchOut = 0.38;
    const anchorY = 0.58;
    const mTorso = new THREE.Matrix4()
      .makeTranslation(0, anchorY, 0.035)
      .multiply(new THREE.Matrix4().makeScale(S[0], S[1], S[2]))
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pitchOut, 0, spec.slump * 0.35, 'YXZ')))
      .multiply(new THREE.Matrix4().makeTranslation(0, -21, 0));

    const clippedTorso = new Vox();
    const v3 = new THREE.Vector3();
    torso.each((x, y, z, col) => {
      v3.set(x + 0.5, y + 0.5, z + 0.5).applyMatrix4(mTorso);
      if (v3.z >= 0.003 && v3.y >= 0.01) {
        // Blend waist/back seam voxels into damp wallpaper so clothes fuse organically into the wall
        const c = v3.z < 0.075 ? mix(col, seep, 0.62) : col;
        clippedTorso.set(x, y, z, c);
      }
    });
    if (clippedTorso.size) {
      b.addVox(kit.model(`${keyBase}:torso`, () => clippedTorso).solid, mTorso);
    }

    // Flush, taut damp-wallpaper assimilation bulge & dark drywall fissure (`z = 0..3.5` voxels)
    // wrapping organically around the emerging upper body while the lower 2/3 stays swallowed inside the wall!
    const wallVox = new Vox();
    // Outer flush stretched-wallpaper scar (`z = 0..2`)
    wallVox.ellipsoid(0, 29, -0.4, 14.0, 14.5, 2.5, surf);
    // Mid damp-ring collar & dark fissure right around the emerging ribs/shoulders (`y = 20..38`)
    wallVox.ellipsoid(0, 28.5, 0.2, 11.2, 11.2, 3.2, surfMid);
    wallVox.ellipsoid(0, 28.0, 0.8, 8.8, 8.6, 3.6, seep);
    wallVox.ellipsoid(0, 28.0, 0.5, 7.2, 7.0, 2.2, fissure);
    // Subtle flush sunken-hip relief tapering flat into the lower wall (`y = 11..22, z = 0..1.8`)
    const sideS = spec.droopSide || 1;
    wallVox.ellipsoid(sideS * 1.5, 17.5, -0.6, 7.5, 7.0, 2.3, surf);
    wallVox.ellipsoid(sideS * 1.8, 17.0, -0.2, 4.8, 5.2, 2.0, surfMid);
    // Creeping damp tendrils pulling wallpaper tight onto the torso & outward across the wall
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + (spec.seed % 5) * 0.35;
      const ox = Math.cos(ang) * 14.5, oy = 28.5 + Math.sin(ang) * 13.5;
      const ix = Math.cos(ang) * 6.2, iy = 27.5 + Math.sin(ang) * 5.8;
      wallVox.tube(ox, Math.max(8, oy), 0.2, ix, Math.max(15, iy), 3.2, 1.1, i % 2 ? surfMid : seep);
    }
    wallVox.carve(-20, -4, -10, 20, 48, 0); // strictly `z >= 0`!

    const mWall = new THREE.Matrix4()
      .makeTranslation(0, 0.01, 0.004)
      .multiply(new THREE.Matrix4().makeScale(S[0], S[1], S[2]));
    b.addVox(kit.model(`${keyBase}:blister`, () => wallVox).solid, mWall);

    const mapPt = (fx, fy, fz) => new THREE.Vector3(fx, fy, fz)
      .add(new THREE.Vector3(0, -21, 0))
      .applyEuler(new THREE.Euler(pitchOut, 0, spec.slump * 0.35, 'YXZ'))
      .multiply(new THREE.Vector3(S[0], S[1], S[2]))
      .add(new THREE.Vector3(0, anchorY, 0.035));

    return {
      batch: b,
      shoulderL: mapPt(JOINT.shoulderL[0], JOINT.shoulderL[1], JOINT.shoulderL[2] + 1.2),
      shoulderR: mapPt(JOINT.shoulderR[0], JOINT.shoulderR[1], JOINT.shoulderR[2] + 1.2),
      headPos: mapPt(JOINT.head[0], JOINT.head[1], JOINT.head[2] + 1.0),
      headBaseRot: [0.16, 0, spec.droopSide * 0.28],
    };
  }

  if (mount === 'floor') {
    // Submerged 2/3 into carpet: only upper chest (`y >= 25`) emerges out of a soggy carpet mire
    const torso = parts.torso.clone();
    torso.carve(-14, 0, -14, 14, 25, 14);
    const rug = M(carpetHex, 2), mire = M(toCss(mix(carpetHex, '#1e1912', 0.52)), 2);
    const mound = new Vox();
    mound.ellipsoid(0, 25, 0, 14, 3.2, 12, rug);
    mound.ellipsoid(0, 25.5, 0, 10.5, 3.4, 9.5, mire);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + (spec.seed % 7) * 0.4;
      mound.tube(Math.cos(a) * 11, 25, Math.sin(a) * 10, Math.cos(a) * 5.5, 29.5, Math.sin(a) * 4.5, 1.2, i % 2 ? rug : mire);
    }
    mound.carve(-18, 0, -18, 18, 25, 18);

    const leanBack = -0.16;
    const m4 = new THREE.Matrix4()
      .makeTranslation(0, 0.01, 0)
      .multiply(new THREE.Matrix4().makeScale(S[0], S[1], S[2]))
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(leanBack, 0, spec.slump * 0.45, 'YXZ')))
      .multiply(new THREE.Matrix4().makeTranslation(0, -25, 0));

    const addClippedFloor = (srcVox, subKey) => {
      const clipped = new Vox();
      const v3 = new THREE.Vector3();
      srcVox.each((x, y, z, col) => {
        v3.set(x + 0.5, y + 0.5, z + 0.5).applyMatrix4(m4);
        if (v3.y >= 0.002) clipped.set(x, y, z, col);
      });
      if (!clipped.size) return;
      const geo = kit.model(`${keyBase}:${subKey}`, () => clipped);
      if (geo?.solid) b.addVox(geo.solid, m4);
    };
    addClippedFloor(mound, 'mound');
    addClippedFloor(torso, 'torso');

    const mapPt = (fx, fy, fz) => new THREE.Vector3(fx, fy, fz)
      .add(new THREE.Vector3(0, -25, 0))
      .applyEuler(new THREE.Euler(leanBack, 0, spec.slump * 0.45, 'YXZ'))
      .multiply(new THREE.Vector3(S[0], S[1], S[2]))
      .add(new THREE.Vector3(0, 0.01, 0));

    return {
      batch: b,
      shoulderL: mapPt(JOINT.shoulderL[0], JOINT.shoulderL[1], JOINT.shoulderL[2]),
      shoulderR: mapPt(JOINT.shoulderR[0], JOINT.shoulderR[1], JOINT.shoulderR[2]),
      headPos: mapPt(JOINT.head[0], JOINT.head[1], JOINT.head[2]),
      headBaseRot: [-0.36, 0, spec.droopSide * 0.26],
    };
  }

  // mount === 'ceiling': modelled inside an inverted (`rotZ = Math.PI`) frame anchored at ceiling `y = 0`!
  // In this inverted frame, `+y` points straight DOWN toward the room floor (`z_world` stays `+z`).
  const torso = parts.torso.clone();
  torso.carve(-14, 0, -14, 14, 23, 14);
  const tileCol = M(toCss(tone(ceilHex, -0.24)), 2), plenum = M('#161412', 1), wetTile = M(toCss(mix(ceilHex, '#2e2719', 0.62)), 2);
  const blister = new Vox();
  // Cracked, sagging acoustic ceiling tile + dark plenum breach + stretched assimilation stalk (`y = 18..27`)
  blister.box(-13, 18, -13, 13, 20, 13, plenum);
  blister.ellipsoid(0, 20, 0, 13, 3.8, 12, tileCol);
  blister.ellipsoid(0, 22.5, 0, 8.5, 4.2, 7.5, wetTile);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    blister.tube(Math.cos(a) * 9.5, 19, Math.sin(a) * 9.5, Math.cos(a) * 4.5, 27, Math.sin(a) * 4.5, 1.15, i % 2 ? wetTile : plenum);
  }
  blister.carve(-16, 0, -16, 16, 18, 16);

  // Anchor `y_fig = 18` at `0` so `+y` (`18 -> 35`) hangs straight down below the ceiling
  const m4 = new THREE.Matrix4()
    .makeScale(S[0], S[1], S[2])
    .multiply(new THREE.Matrix4().makeTranslation(0, -18, 0));

  b.addVox(kit.model(`${keyBase}:blister`, () => blister).solid, m4);
  b.addVox(kit.model(`${keyBase}:torso`, () => torso).solid, m4);

  const mapPt = (fx, fy, fz) => new THREE.Vector3(fx * S[0], (fy - 18) * S[1], fz * S[2]);

  return {
    batch: b,
    shoulderL: mapPt(JOINT.shoulderL[0], JOINT.shoulderL[1], JOINT.shoulderL[2]),
    shoulderR: mapPt(JOINT.shoulderR[0], JOINT.shoulderR[1], JOINT.shoulderR[2]),
    headPos: mapPt(JOINT.head[0], JOINT.head[1], JOINT.head[2]),
    headBaseRot: [-0.22, 0, spec.droopSide * 0.24],
  };
}

/**
 * Construct a complete 2/3-absorbed Office worker rig with 1.5x+ 2-joint arms.
 * @param {object} kit
 * @param {object} spec           rolled entry from `rollAbsorbedRoster`
 * @param {'wall'|'floor'|'ceiling'} mount
 * @param {{wall?:string, carpet?:string, ceil?:string, ceilH?:number}} [surface]
 */
export function makeAbsorbedWorker(kit, spec, mount = 'wall', surface = {}) {
  const surfHex = mount === 'wall'
    ? (surface.wall || '#c8bc84')
    : mount === 'floor'
      ? (surface.carpet || '#7a6c4f')
      : (surface.ceil || '#cfccb8');

  const enriched = {
    ...spec,
    assimilatedLook: assimilateLook(spec.look, surfHex),
  };

  const lights = [
    lamp(0.25, 2.4, 1.1, [1.32, 1.32, 1.32], { k: 9, wrap: 0.52, far: 28 }),
    lamp(-0.35, 0.6, 0.9, [0.42, 0.40, 0.36], { k: 5, wrap: 0.6, far: 16 }),
  ];
  const amb = [0.64, 0.64, 0.64];
  const mat = kit.surface({ vox: true });

  const core = buildAbsorbedCore(kit, enriched, mount, surface);
  const coreMesh = new THREE.Mesh(kit.geometry(core.batch, lights, amb), mat);

  // Head + intermittent bad-frame VHS head tear
  const sig = `${enriched.assimilatedLook.species}:${enriched.assimilatedLook.outfit}:${enriched.assimilatedLook.outfitColor}:${enriched.assimilatedLook.accessory}:${enriched.faceVariant}:${enriched.seed}`;
  const head = new THREE.Group();
  head.position.copy(core.headPos);
  const headM4 = localJointMat(S, JOINT.head);
  const headKey = `abs:head:${sig}:${mount}`;
  const bWhole = new Batch(true);
  bWhole.addVox(kit.model(headKey, () => buildAbsorbedHeadVox(enriched, mount)).solid, headM4);
  const bTorn = new Batch(true);
  bTorn.addVox(
    kit.model(`${headKey}:torn`, () => tornVox(buildAbsorbedHeadVox(enriched, mount), 53 + (enriched.seed % 97))).solid,
    headM4,
  );
  const headWhole = new THREE.Mesh(kit.geometry(bWhole, lights, amb), mat);
  const headTorn = new THREE.Mesh(kit.geometry(bTorn, lights, amb), mat);
  headTorn.visible = false;
  head.add(headWhole, headTorn);

  // 1.5x+ 2-joint arms (`shoulder -> upperArm + elbow -> forearm/hand`)
  const makeArm = (side, pos) => {
    const tag = side < 0 ? 'L' : 'R';
    const shoulder = new THREE.Group();
    shoulder.position.copy(pos);

    const scaleM4 = new THREE.Matrix4().makeScale(S[0], S[1], S[2]);
    const upperB = new Batch(true);
    upperB.addVox(
      kit.model(`abs:armU:${sig}:${mount}:${tag}`, () => buildLongUpperArmVox(enriched.assimilatedLook, surfHex, enriched.seed + side)).solid,
      scaleM4,
    );
    shoulder.add(new THREE.Mesh(kit.geometry(upperB, lights, amb), mat));

    const elbow = new THREE.Group();
    elbow.position.set(0, -13.5 * S[1], 0);
    const lowerB = new Batch(true);
    lowerB.addVox(
      kit.model(`abs:armL:${sig}:${mount}:${tag}`, () => buildLongForearmVox(enriched.assimilatedLook, side, enriched.seed + side * 3)).solid,
      scaleM4,
    );
    elbow.add(new THREE.Mesh(kit.geometry(lowerB, lights, amb), mat));
    shoulder.add(elbow);
    return { shoulder, elbow };
  };

  const armL = makeArm(-1, core.shoulderL);
  const armR = makeArm(1, core.shoulderR);

  const group = new THREE.Group();
  const ceilH = surface.ceilH ?? 2.6;
  let ceilingCarrier = null;

  if (mount === 'ceiling') {
    ceilingCarrier = new THREE.Group();
    ceilingCarrier.position.set(0, ceilH, 0);
    // Flip 180° around Z so `+y` hangs downward toward the floor while `+z` still faces forward
    const inverted = new THREE.Group();
    inverted.rotation.z = Math.PI;
    inverted.add(coreMesh, head, armL.shoulder, armR.shoulder);
    ceilingCarrier.add(inverted);
    group.add(ceilingCarrier);

    // Subtle dark damp stain on the ceiling around the breach + a drip tell on the carpet directly below!
    const ceilStain = new THREE.Mesh(
      kit.own(new THREE.PlaneGeometry(1.18, 1.18)),
      kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x090806, transparent: true, opacity: 0.56, depthWrite: false })),
    );
    ceilStain.rotation.x = Math.PI / 2;
    ceilStain.position.set(0, ceilH - 0.008, 0);
    ceilStain.renderOrder = 1;
    group.add(ceilStain);

    const floorDrip = new THREE.Mesh(
      kit.own(new THREE.PlaneGeometry(0.78, 0.78)),
      kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x120f08, transparent: true, opacity: 0.34, depthWrite: false })),
    );
    floorDrip.rotation.x = -Math.PI / 2;
    floorDrip.position.set(0, 0.01, 0);
    floorDrip.renderOrder = 1;
    group.add(floorDrip);
  } else if (mount === 'floor') {
    group.add(coreMesh, head, armL.shoulder, armR.shoulder);
    const mireStain = new THREE.Mesh(
      kit.own(new THREE.PlaneGeometry(1.32, 1.32)),
      kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x0b0906, transparent: true, opacity: 0.52, depthWrite: false })),
    );
    mireStain.rotation.x = -Math.PI / 2;
    mireStain.position.set(0, 0.011, 0);
    mireStain.renderOrder = 1;
    group.add(mireStain);
  } else {
    // wall
    group.add(coreMesh, head, armL.shoulder, armR.shoulder);
    const wallSeep = new THREE.Mesh(
      kit.own(new THREE.PlaneGeometry(1.22, 1.48)),
      kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x120e08, transparent: true, opacity: 0.44, depthWrite: false })),
    );
    wallSeep.position.set(0, 0.86, 0.012);
    wallSeep.renderOrder = 1;
    group.add(wallSeep);

    const footShadow = new THREE.Mesh(
      kit.own(new THREE.PlaneGeometry(0.88, 0.62)),
      kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false })),
    );
    footShadow.rotation.x = -Math.PI / 2;
    footShadow.position.set(0, 0.01, 0.24);
    footShadow.renderOrder = 1;
    group.add(footShadow);
  }

  const [bx, , bz] = core.headBaseRot;
  const phaseOff = (enriched.seed % 37) * 0.27;

  return {
    group,
    head,
    armL,
    armR,
    species: enriched.assimilatedLook.species,
    mount,
    /**
     * Animate head tracking, VHS bad-frame tears, and 2-joint 1.5x arm reach/grab.
     * @param {number} time
     * @param {{reachBlend:number, grabBlend:number, relYaw:number, phase:string}} st
     */
    pose(time, { reachBlend = 0, grabBlend = 0, relYaw = 0, phase = 'idle' } = {}) {
      const t = time + phaseOff;
      const clampedYaw = Math.max(-1.35, Math.min(1.35, relYaw));
      const grabbing = phase === 'grabbing' || grabBlend > 0.35;

      // Bad-frame VHS head slip: occasional in idle, frantic while grabbing
      const cyc = (t * 1.1) % 3.6;
      const torn = grabbing ? (Math.floor(t * 16) % 3 === 0) : cyc > 3.47;
      headWhole.visible = !torn;
      headTorn.visible = torn;

      const trackK = 0.22 + 0.78 * reachBlend;
      const headTremor = grabbing ? Math.sin(t * 24) * 0.08 : Math.sin(t * 1.4) * 0.035;
      const yawSigned = mount === 'ceiling' ? -clampedYaw * trackK : clampedYaw * trackK;
      head.rotation.set(
        bx + (grabbing ? -0.10 : Math.sin(t * 1.1) * 0.04),
        yawSigned,
        bz + (torn ? -bz * 1.35 : headTremor),
      );

      const shakeL = grabbing ? Math.sin(t * 27) * 0.07 : 0;
      const shakeR = grabbing ? Math.cos(t * 25) * 0.07 : 0;

      if (mount === 'wall') {
        // Idle: heavy limp dangle down the wall -> Reach: stretch 1.5x straight out (+z) -> Grab: clamp inward
        const idleRxL = -0.16 + Math.sin(t * 1.3) * 0.06;
        const idleRxR = -0.20 + Math.cos(t * 1.15 + 1) * 0.06;
        const reachRx = -1.46;
        const rxL = idleRxL + (reachRx - idleRxL) * reachBlend + shakeL;
        const rxR = idleRxR + (reachRx - idleRxR) * reachBlend + shakeR;
        const aimY = clampedYaw * 0.65 * reachBlend;
        const clampIn = grabBlend * 0.38;

        armL.shoulder.rotation.set(rxL, aimY - 0.14 * reachBlend + clampIn, -0.15 * (1 - reachBlend) - 0.08 * grabBlend);
        armR.shoulder.rotation.set(rxR, aimY + 0.14 * reachBlend - clampIn, 0.15 * (1 - reachBlend) + 0.08 * grabBlend);

        armL.elbow.rotation.set(-0.34 * (1 - reachBlend) - 0.36 * grabBlend, 0.55 * grabBlend, 0.08 + 0.42 * grabBlend);
        armR.elbow.rotation.set(-0.30 * (1 - reachBlend) - 0.36 * grabBlend, -0.55 * grabBlend, -0.08 - 0.42 * grabBlend);
      } else if (mount === 'floor') {
        // Idle: sprawled flat across carpet -> Reach: rear upward toward player -> Grab: lunge & hook shins/waist
        const idleRx = -1.46;
        const reachRx = -1.96;
        const rxL = idleRx + (reachRx - idleRx) * reachBlend + Math.sin(t * 1.6) * 0.04 + shakeL;
        const rxR = idleRx + (reachRx - idleRx) * reachBlend + Math.cos(t * 1.45 + 0.8) * 0.04 + shakeR;
        const splay = 0.52 * (1 - reachBlend * 0.65) - 0.30 * grabBlend;
        const aimY = clampedYaw * 0.72 * reachBlend;

        armL.shoulder.rotation.set(rxL, aimY + splay, -0.24 * (1 - reachBlend));
        armR.shoulder.rotation.set(rxR, aimY - splay, 0.24 * (1 - reachBlend));

        const twitchL = Math.sin(t * 2.7) * 0.08 * (1 - reachBlend);
        const twitchR = Math.cos(t * 2.3 + 1.4) * 0.08 * (1 - reachBlend);
        armL.elbow.rotation.set(-0.14 + twitchL - 0.38 * grabBlend, 0.50 * grabBlend, 0.38 * grabBlend);
        armR.elbow.rotation.set(-0.14 + twitchR - 0.38 * grabBlend, -0.50 * grabBlend, -0.38 * grabBlend);
      } else {
        // mount === 'ceiling': inside `inverted` (`rotZ = Math.PI`), `rx = -Math.PI` hangs straight DOWN toward floor!
        if (ceilingCarrier) {
          // Sag & lunge downward out of the wet ceiling breach when reaching/grabbing
          ceilingCarrier.position.y = ceilH - (0.08 * reachBlend + 0.18 * grabBlend);
        }
        const swayL = Math.sin(t * 1.35) * 0.075 * (1 - grabBlend);
        const swayR = Math.sin(t * 1.35 + 0.9) * 0.075 * (1 - grabBlend);
        // Pitching forward from `-Math.PI` toward `-Math.PI + 0.46` swings the dangling hands forward (+z) toward the player
        const fwd = 0.44 * reachBlend + 0.14 * grabBlend;
        const aimY = -clampedYaw * 0.58 * reachBlend;
        const clampZ = 0.34 * grabBlend;

        armL.shoulder.rotation.set(-Math.PI + fwd + swayL + shakeL, aimY, -0.10 + clampZ + Math.cos(t * 1.1) * 0.04);
        armR.shoulder.rotation.set(-Math.PI + fwd + swayR + shakeR, aimY, 0.10 - clampZ - Math.cos(t * 1.1) * 0.04);

        armL.elbow.rotation.set(0.24 + 0.42 * grabBlend, 0.45 * grabBlend, -0.34 * grabBlend);
        armR.elbow.rotation.set(0.22 + 0.42 * grabBlend, -0.45 * grabBlend, 0.34 * grabBlend);
      }
    },
    light(rgb) {
      mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
    },
  };
}
