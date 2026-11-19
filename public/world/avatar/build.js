// The Office — who you are, in voxels.
//
// A character is sculpted from a resolved `look` (core/look.mjs): species,
// skin, hair, outfit, accessory, facial hair. Same vocabulary the pixel office
// has always had, so an agent's identity carries straight over — but each one
// is now a real little figure: a rounded head with ears and a face that can
// change expression, hair with volume, clothes with collars and pockets,
// hands, trainers, a lanyard in their provider's colour.
//
// Units are voxels (2.5 cm). The figure stands on y = 0, faces +z, and is
// about 52 voxels (1.3 m) tall before hair and hats — big-headed on purpose.
// Every part is modelled in figure coordinates and meshed around its joint.
import { Vox, M, C, glow, glass, tone, mix, noise3 } from '../vox/vox.js';
import { hashId, wornLook } from '/core/look.mjs';

/** Joint positions, in voxels, in the figure's rest pose. */
export const JOINT = Object.freeze({
  hips: [0, 18, 0],
  head: [0, 35, 0],
  shoulderL: [-9, 33, 0], shoulderR: [9, 33, 0],
  elbowL: [-9, 25, 0], elbowR: [9, 25, 0],
  hipL: [-3.5, 18, 0], hipR: [3.5, 18, 0],
  kneeL: [-3.5, 9, 0], kneeR: [3.5, 9, 0],
  handR: [9, 17, 1],                 // where a held thing sits
  hat: [0, 52, 0],
});
export const HEIGHT = 52;

// A lanyard in the colour of whoever made you.
export const PROVIDER_COLORS = Object.freeze({
  claude: '#d97757', codex: '#3fa37c', gemini: '#4f8fe6', opencode: '#9a6fd8',
  shell: '#8a8f96', custom: '#c9a23f', unknown: '#8a8f96',
});
const PANTS = ['#2f3440', '#3b4a6b', '#4a3f35', '#39413a', '#55505a', '#2c251c'];
const SHOES = ['#d8493f', '#3f7f9a', '#e8c45a', '#6f8a4a', '#8a5a8f', '#f0ede6', '#33303a'];

const STEEL = '#8a93a8', STEEL_D = '#5a626e', STEEL_L = '#b4bcc8';
const pick = (list, n) => list[n % list.length];

/* ---- the head ------------------------------------------------------------ */

const HX = 9, HY0 = 35, HY1 = 52, HZ = 8;            // skull: 18 wide, 17 tall, 16 deep
export const hatTop = (L) => (L && L.species === 'alien' ? 57 : HY1);

function skull(v, color, r = 5) { v.rbox(-HX, HY0, -HZ, HX, HY1, HZ, r, color); }

/** Voxels in a shell around the skull where `keep(x, y, z)` is true. */
function shell(v, color, keep, { grow = 1, r = 5 } = {}) {
  const probe = new Vox();
  probe.rbox(-HX - grow, HY0 - grow, -HZ - grow, HX + grow, HY1 + grow, HZ + grow, r + grow, 1);
  const fn = typeof color === 'function' ? color : null;
  const flat = fn ? 0 : C(color);
  probe.each((x, y, z) => {
    if (v.has(x, y, z)) return;
    if (keep(x, y, z)) v.set(x, y, z, fn ? fn(x, y, z) : flat);
  });
}

/** Surface-conforming shell dilated around the sculpted alien cranium. */
function alienShell(v, cranium, color, keep, grow = 1) {
  const probe = new Vox();
  const R = grow <= 1 ? 1 : 2;
  const maxD2 = grow <= 1 ? 2 : 5;
  cranium.each((cx, cy, cz) => {
    if (cranium.has(cx + 1, cy, cz) && cranium.has(cx - 1, cy, cz)
      && cranium.has(cx, cy + 1, cz) && cranium.has(cx, cy - 1, cz)
      && cranium.has(cx, cy, cz + 1) && cranium.has(cx, cy, cz - 1)) return;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 === 0 || d2 > maxD2) continue;
          const x = cx + dx, y = cy + dy, z = cz + dz;
          if (!v.has(x, y, z) && !cranium.has(x, y, z)) probe.set(x, y, z, 1);
        }
      }
    }
  });
  const fn = typeof color === 'function' ? color : null;
  const flat = fn ? 0 : C(color);
  probe.each((x, y, z) => {
    if (!v.has(x, y, z) && keep(x, y, z)) v.set(x, y, z, fn ? fn(x, y, z) : flat);
  });
}

function buildHead(L, seed) {
  const v = new Vox();
  const robot = L.species === 'robot';
  if (robot) {
    const st = M(STEEL, 0), stD = M(STEEL_D, 0), stL = M(STEEL_L, 0);
    v.rbox(-HX, HY0, -HZ, HX, HY1 - 1, HZ, 2, st);
    v.paint(-HX, HY1 - 3, -HZ, HX, HY1, HZ, stL);                    // lighter top plate
    v.paint(-HX, HY0, -HZ, HX, HY0 + 2, HZ, stD);                    // jaw line
    v.decal('+z', -7, 39, 7, 48, M('#16202a', 0));                   // visor
    v.decal('+z', -8, 38, 8, 39, stD); v.decal('+z', -8, 48, 8, 49, stD);
    for (const x of [-3, 0, 3]) v.decal('+z', x - 1, 36, x, 38, stD); // mouth grille
    for (const s of [-1, 1]) {                                        // ear bolts
      v.cyl('x', 43, 0, s < 0 ? -HX - 2 : HX, s < 0 ? -HX : HX + 2, 2.4, stD);
      v.set(s < 0 ? -HX - 2 : HX + 1, 43, 0, stL);
    }
    v.box(-1, HY1 - 1, -1, 1, HY1 + 3, 1, stD);                       // antenna
    v.sphere(-0.5, HY1 + 4, -0.5, 1.6, glow('#f3b34c'));
    return v;
  }

  const sk = M(L.skin, 1), skD = tone(sk, -0.18), skL = tone(sk, 0.14);
  if (L.species === 'alien') {
    const neckDark = M('#1b1d24', 1), tendon = tone(sk, -0.26), earDeep = tone(sk, -0.34);
    // Tall dark corded tendon neck rising into the tapered alien jaw
    v.rbox(-3, 33, -3, 3, 39, 3, 1, neckDark, 'xz');
    for (const tx of [-2, 0, 1]) for (let ty = 33; ty < 38; ty++) v.set(tx, ty, 2, tendon);
    // Tapered chiseled jaw -> high cheekbones -> sleek domed furrowed cranium (no protruding side flaps)
    const profile = [
      [37, 3.5, 2.0, 7.7],
      [38, 4.9, -1.8, 8.0],
      [39, 5.9, -4.2, 8.1],
      [40, 6.7, -5.6, 8.2],
      [41, 7.4, -6.7, 8.3],
      [42, 8.0, -7.4, 8.4],
      [43, 8.5, -8.0, 8.5],
      [44, 8.9, -8.5, 8.6],
      [45, 9.2, -8.9, 8.6],
      [46, 9.5, -9.2, 8.7],
      [47, 9.6, -9.4, 8.7],
      [48, 9.7, -9.5, 8.7],
      [49, 9.7, -9.5, 8.6],
      [50, 9.5, -9.3, 8.5],
      [51, 9.2, -9.0, 8.3],
      [52, 8.8, -8.6, 8.0],
      [53, 8.2, -8.1, 7.6],
      [54, 7.4, -7.4, 7.0],
      [55, 6.3, -6.5, 6.1],
      [56, 4.9, -5.3, 4.9],
      [57, 3.2, -3.7, 3.4],
    ];
    for (const [y, rx, z0, z1] of profile) {
      const zc = (z0 + z1) / 2, rz = (z1 - z0) / 2;
      for (let x = -10; x <= 9; x++) {
        for (let z = -10; z <= 9; z++) {
          const nx = (x + 0.5) / rx, nz = (z + 0.5 - zc) / rz;
          const r2 = nx * nx + nz * nz;
          if (r2 > 1) continue;
          let c = sk;
          if (y >= 53 && z >= -2) c = skL;
          else if (y <= 38 && z < 4) c = skD;
          // Sweeping V-shaped cranial brow & crown furrows
          if (y >= 48 && y <= 56 && z >= 3) {
            const ax = Math.abs(x + 0.5);
            const f1 = Math.abs(ax - (y - 47.4) * 1.02);
            const f2 = Math.abs(ax - (y - 50.2) * 1.15);
            if (f1 < 0.62 || f2 < 0.62) c = skD;
            else if ((f1 < 1.25 || f2 < 1.2) && y >= 49) c = skL;
          }
          // Cheekbone & jaw plate seams
          if (y >= 38 && y <= 43 && z >= 5) {
            const ax = Math.abs(x + 0.5);
            if (ax >= 3.4 && ax <= 4.3) c = skD;
            else if (y <= 39 && ax < 2.5 && z >= 6) c = skL;
          }
          // Flush recessed ear indent painted onto existing side surface (never protruding)
          if (y >= 43 && y <= 47 && z >= -3 && z <= 0 && r2 > 0.72) c = earDeep;
          // Segmented temple / occipital creases
          else if (y >= 46 && y <= 54 && r2 > 0.76 && z < 3 && ((y + Math.floor(Math.abs(z) * 0.5)) % 3 === 0)) c = skD;
          v.set(x, y, z, c);
        }
      }
    }
    // Ridged triangular nose with two dark vertical nostril slits
    v.box(-2, 41, 8, 2, 45, 9, sk);
    v.box(-1, 44, 8, 1, 45, 9, skD);
    v.box(-2, 41, 8, -1, 43, 9, M('#2b1c0a', 0));
    v.box(1, 41, 8, 2, 43, 9, M('#2b1c0a', 0));
    const cranium = new Vox();
    v.each((x, y, z, c) => { if (y >= 37) cranium.set(x, y, z, c); });
    buildHair(v, L, seed, cranium);
    buildFacialHair(v, L, cranium);
    return v;
  }

  if (L.species === 'frog') {
    v.rbox(-9, 36, -7, 9, 50, 6, 5, sk);
    v.ellipsoid(0, 47, -2.5, 7.8, 4.2, 5.5, sk);
  } else {
    skull(v, sk);
  }
  v.paint(-HX, HY0, -HZ, HX, HY0 + 2, HZ, tone(sk, -0.06));           // a little weight under the chin

  if (L.species === 'goblin') {
    for (const s of [-1, 1]) {                                        // long pointed ears
      for (let i = 0; i < 7; i++) {
        const x = s < 0 ? -HX - 1 - i : HX + i;
        const h = Math.max(1, 5 - Math.floor(i * 0.75));
        v.box(x, 42 + Math.floor(i * 0.6), -1, x + 1, 42 + Math.floor(i * 0.6) + h, 2, i < 2 ? sk : skD);
      }
    }
    v.box(-1, 41, HZ, 1, 44, HZ + 2, skD);                            // a proper nose
    v.box(-4, 37, HZ, -3, 39, HZ + 1, M('#f3ead2', 0));               // tusks
    v.box(3, 37, HZ, 4, 39, HZ + 1, M('#f3ead2', 0));
  } else if (L.species === 'frog') {
    // One continuous shovel-shaped snout under two raised eye sockets.
    v.ellipsoid(0, 39, 3, 10.8, 4.5, 7.6, mix(sk, '#f0dc99', 0.52));
    v.ellipsoid(0, 41.5, 4.5, 11.5, 3.6, 7.8, sk);
    for (const side of [-1, 1]) {
      v.ellipsoid(side * 7.3, 46.8, 4, 4.2, 5.3, 4.8, sk);
      v.ellipsoid(side * 10.2, 42, -1, 1.8, 2.1, 2.1, skD); // tympanum behind the eye
      v.decal('+z', side < 0 ? -4 : 3, 43, side < 0 ? -3 : 4, 44, skD);
      v.decal('+z', side < 0 ? -9 : 8, 42, side < 0 ? -8 : 9, 43, skL);
    }
  } else if (L.species === 'demon') {
    const root = M('#49312e', 2), horn = M('#a78967', 2), tip = M('#dfc9a2', 1);
    for (const side of [-1, 1]) {
      // Ram horns sweep out and back, then hook inward to a bone-coloured point.
      v.tube(side * 6, 49, -1, side * 10, 52, -2, 3.1, root);
      v.tube(side * 10, 52, -2, side * 11.5, 56, -3, 2.45, horn);
      v.tube(side * 11.5, 56, -3, side * 10.5, 59, -3, 1.65, horn);
      v.tube(side * 10.5, 59, -3, side * 8.5, 60, -2, 0.9, tip);
      v.tube(side * 8, 42, 0, side * 12, 45, -1, 1.5, skD);
      v.box(side < 0 ? -4 : 3, 37, 7, side < 0 ? -3 : 4, 39, 9, tip);
    }
    v.box(-1, 40, 7, 1, 43, 9, skD);
  } else if (L.species === 'bear') {
    const muzzle = mix(sk, '#edcf93', 0.6), nose = M('#302526', 0);
    for (const side of [-1, 1]) {
      v.ellipsoid(side * 8.1, 50.6, -1, 4.4, 4.7, 2.7, sk);
      v.ellipsoid(side * 8.1, 50.8, 0.9, 2.5, 2.8, 1, skD);
      v.ellipsoid(side * 7.2, 40.4, 2, 3.2, 4.1, 4.1, sk);
      v.ellipsoid(side * 2.4, 39.7, 7.7, 4, 3.3, 4.2, muzzle);
    }
    v.rbox(-3, 41, 9, 3, 44, 13, 1, nose);
    v.box(-1, 39, 11, 1, 42, 12, nose);
  } else if (L.species === 'dog') {
    const light = tone(sk, 0.22), dark = tone(sk, -0.3);
    v.rbox(-4, 36, HZ - 1, 4, 42, HZ + 4, 1, light);                  // snout
    v.box(-1, 41, HZ + 3, 1, 43, HZ + 5, M('#1f1812', 0));            // nose
    v.box(-1, 36, HZ + 4, 1, 37, HZ + 5, M('#c96a6a', 0));            // a bit of tongue
    for (const s of [-1, 1]) {                                        // floppy ears
      const x0 = s < 0 ? -HX - 2 : HX, x1 = x0 + 2;
      v.rbox(x0, 38, -4, x1, 50, 3, 1, dark);
      v.box(s < 0 ? -HX - 1 : HX - 1, 49, -3, s < 0 ? -HX + 1 : HX + 1, 52, 2, dark);
    }
  } else if (L.species === 'cat') {
    const light = tone(sk, 0.3);
    for (const s of [-1, 1]) {                                        // pointed ears
      for (let k = 0; k < 5; k++) {
        const w = 5 - k, cx = s * 5.5;
        v.box(Math.round(cx - w / 2), HY1 - 1 + k, -2 + Math.floor(k / 2), Math.round(cx + w / 2), HY1 + k, 2, k < 4 ? sk : skD);
      }
      v.box(Math.round(s * 5.5 - 1), HY1, 1, Math.round(s * 5.5 + 1), HY1 + 2, 2, M('#e8a0a0', 0));
    }
    v.rbox(-3, 37, HZ - 1, 3, 41, HZ + 2, 1, light);                  // muzzle
    v.box(-1, 40, HZ + 1, 1, 41, HZ + 2, M('#e88888', 0));            // nose
    for (const s of [-1, 1]) for (const [y, len] of [[40, 8], [38, 7]]) {
      for (let i = 0; i < len; i++) v.set(s < 0 ? -4 - i : 3 + i, y + (i > 4 ? (y === 40 ? 1 : -1) : 0), HZ, M('#f4f0e6', 0));
    }
  } else {
    for (const s of [-1, 1]) v.rbox(s < 0 ? -HX - 1 : HX, 40, -2, s < 0 ? -HX : HX + 1, 46, 2, 1, skD);  // ears
    v.box(-1, 41, HZ, 1, 43, HZ + 1, tone(sk, -0.1));                 // nose
  }

  buildHair(v, L, seed);
  buildFacialHair(v, L);
  return v;
}

function buildHair(v, L, seed, cranium = null) {
  const style = L.hair;
  const animal = L.species === 'dog' || L.species === 'cat';
  const alien = L.species === 'alien' && cranium !== null;
  if (style === 'bald') return;
  if (animal && !['cap', 'beanie', 'mohawk', 'bun', 'braids'].includes(style)) return;       // fur is the hairdo
  const oc = L.outfitColor;
  const streak = (x, y, z) => {
    const base = M(L.hairColor, 2);
    const n = noise3(x >> 1, 0, z >> 1, seed);
    return n > 0.82 ? tone(base, 0.16) : n < 0.18 ? tone(base, -0.14) : base;
  };

  if (style === 'cap') {
    const cap = M(oc, 2);
    if (alien) {
      alienShell(v, cranium, cap, (x, y) => y >= 50, 1);
      const brim = new Vox();
      brim.rbox(-8, 50, 7, 8, 52, 14, 2, tone(cap, -0.18), 'xz');
      brim.each((x, y, z, c) => { if (!v.has(x, y, z)) v.set(x, y, z, c); });
      v.box(-1, 58, -1, 1, 60, 1, tone(cap, 0.2));
      alienShell(v, cranium, streak, (x, y, z) => y >= 42 && y < 50 && z <= -5, 1);
      return;
    }
    shell(v, cap, (x, y) => y >= 47, { grow: 1 });
    v.rbox(-7, 47, HZ, 7, 49, HZ + 6, 2, tone(cap, -0.18), 'xz');     // the brim
    v.box(-1, HY1 + 1, -1, 1, HY1 + 2, 1, tone(cap, 0.2));
    shell(v, streak, (x, y, z) => y >= 40 && y < 47 && z <= -4, { grow: 1 });     // hair below the cap, at the back
    return;
  }
  if (style === 'beanie') {
    const knit = M(oc, 3);
    if (alien) {
      alienShell(v, cranium, knit, (x, y) => y >= 49, 1);
      alienShell(v, cranium, tone(knit, -0.2), (x, y) => y >= 48 && y < 52, 2);
      v.sphere(-0.5, 60, -0.5, 2.4, tone(knit, 0.25));
      return;
    }
    shell(v, knit, (x, y) => y >= 46, { grow: 1 });
    shell(v, tone(knit, -0.2), (x, y) => y >= 45 && y < 48, { grow: 2 });           // folded rim
    v.sphere(-0.5, HY1 + 3, -0.5, 2.4, tone(knit, 0.25));
    return;
  }
  if (style === 'mohawk') {
    if (alien) {
      for (let z = -9; z <= 7; z++) {
        let surfY = -1;
        for (let y = 57; y >= 46; y--) { if (cranium.has(-1, y, z) || cranium.has(0, y, z)) { surfY = y; break; } }
        if (surfY < 0) continue;
        const h = 4 + Math.round(3 * Math.sin(((z + 9) / 17) * Math.PI)) + (noise3(0, 0, z, seed) > 0.6 ? 1 : 0);
        for (let y = surfY + 1; y <= surfY + h; y++) for (let x = -1; x < 1; x++) v.set(x, y, z, streak(x, y, z));
      }
      alienShell(v, cranium, tone(M(L.hairColor, 2), -0.1), (x, y, z) => y >= 49 && y < 56 && Math.abs(x) <= 7 && z <= 3 && noise3(x, y, z, seed) > 0.58, 1);
      return;
    }
    for (let z = -HZ - 1; z <= HZ; z++) {
      const h = 4 + Math.round(3 * Math.sin(((z + HZ + 1) / (2 * HZ + 1)) * Math.PI)) + (noise3(0, 0, z, seed) > 0.6 ? 1 : 0);
      for (let y = HY1 - 2; y < HY1 + h; y++) for (let x = -1; x < 1; x++) v.set(x, y, z, streak(x, y, z));
    }
    shell(v, tone(M(L.hairColor, 2), -0.1), (x, y, z) => y >= 44 && Math.abs(x) <= 6 && z <= 2 && y < 50 && noise3(x, y, z, seed) > 0.55, { grow: 0 });
    return;
  }

  if (alien) {
    const backTo = (style === 'long' || style === 'braids') ? 37 : 40;
    const closedHat = ['partyhat', 'tophat', 'propeller', 'cowboy'].includes(L.accessory);
    const hatCeiling = L.accessory === 'cowboy' ? 54 : L.accessory === 'partyhat' ? 56 : 55;
    alienShell(v, cranium, streak, (x, y, z) => {
      if (closedHat && y >= hatCeiling) return false;
      if (L.accessory === 'crown' && y >= 55 && Math.hypot(x + 0.5, z + 0.25) >= 6.8) return false;
      if (L.accessory === 'headphones' && z >= -4 && z <= 4 && (y >= 58 || Math.abs(x + 0.5) >= 10.2)) return false;
      if (y >= 51) return z <= 6 || y >= 53;
      if (z <= -5) return y >= backTo;
      if (Math.abs(x) >= 8 && z <= 2) return y >= ((style === 'long' || style === 'braids') ? 38 : 45);
      return false;
    }, 1);
    if (style === 'long' || style === 'braids') {
      alienShell(v, cranium, streak, (x, y, z) => y < 52 && ((z <= -5 && y >= backTo) || (Math.abs(x) >= 8 && z <= 2 && y >= 38)), 2);
    }
    if (style === 'long') {
      const sheet = new Vox();
      sheet.rbox(-11, 26, -11, 11, 43, -4, 3, streak, 'xz');
      for (const s of [-1, 1]) sheet.rbox(s < 0 ? -12 : 10, 28, -4, s < 0 ? -10 : 12, 47, 3, 1, streak);
      sheet.each((x, y, z, c) => { if (!cranium.has(x, y, z)) v.set(x, y, z, c); });
    } else if (style === 'braids') {
      const baseHair = M(L.hairColor, 2), bandC = tone(baseHair, -0.28), hiHair = tone(baseHair, 0.16);
      const casc = new Vox();
      casc.rbox(-11, 26, -11, 11, 44, -4, 3, streak, 'xz');
      casc.rbox(10, 29, -6, 14, 49, 0, 2, streak);
      casc.tube(11, 35, -2, 14, 27, 0, 2.2, streak);
      casc.rbox(-14, 39, -3, -10, 51, 5, 2, streak);
      casc.rbox(-14, 33, -5, -11, 41, 0, 2, streak);
      casc.box(-15, 42, 2, -13, 45, 5, M('#e2bd5a', 0));
      casc.tube(-12, 35, -1, -14, 28, 1.5, 2.9, streak);
      casc.cyl('y', -14, 1.5, 27, 29, 3.2, bandC);
      casc.tube(-14, 27, 1.5, -16, 21, 2.5, 2.5, streak);
      casc.sphere(-16.2, 20.5, 2.7, 1.9, hiHair);
      casc.each((x, y, z, c) => { if (!cranium.has(x, y, z)) v.set(x, y, z, c); });
    }
    for (let x = -9; x <= 8; x++) {
      let drop;
      if (style === 'side') drop = 2 + Math.round((x + 9) / 5);
      else if (style === 'long') drop = Math.abs(x + 0.5) > 5.5 ? 5 : 2;
      else if (style === 'braids') drop = x < -5 ? 5 : x > 4 ? 4 : 1;
      else if (style === 'bun') drop = 2;
      else drop = 2 + (noise3(x, 0, 0, seed) > 0.5 ? 1 : 0);
      for (let y = Math.max(49, 54 - drop); y < 54; y++) {
        for (let z = 9; z >= 4; z--) {
          if (cranium.has(x, y, z - 1)) {
            if (!v.has(x, y, z)) v.set(x, y, z, streak(x, y, z));
            break;
          }
        }
      }
    }
    if (style === 'bun') {
      v.sphere(-0.5, 59.5, -5.5, 4.2, streak);
      v.ring(-0.5, 56.5, -5.5, 3.8, 0.9, M('#e0705f', 0), 'y');
    }
    return;
  }

  // a cap of hair: top, back, sides; then a fringe that depends on the style
  const backTo = (style === 'long' || style === 'braids') ? 26 : 39;
  shell(v, streak, (x, y, z) => {
    if (y >= 48) return z <= 6 || y >= 50;                             // crown
    if (z <= -5) return y >= backTo;                                   // back of the head
    if (Math.abs(x) >= 8 && z <= 2) return y >= ((style === 'long' || style === 'braids') ? 27 : 43);      // sides
    return false;
  }, { grow: (style === 'long' || style === 'braids') ? 2 : 1 });
  if (style === 'long') {                                              // falls past the shoulders
    v.rbox(-HX - 2, 26, -HZ - 2, HX + 2, 40, -3, 3, streak, 'xz');
    for (const s of [-1, 1]) v.rbox(s < 0 ? -HX - 2 : HX, 28, -4, s < 0 ? -HX : HX + 2, 44, 3, 1, streak);
  } else if (style === 'braids') {                                     // wavy cascade + banded side-tail & gold clip
    const baseHair = M(L.hairColor, 2), bandC = tone(baseHair, -0.28), hiHair = tone(baseHair, 0.16);
    v.rbox(-HX - 2, 26, -HZ - 2, HX + 2, 41, -3, 3, streak, 'xz');
    // right-side flowing shoulder waves (leaves right ear & hoop clear)
    v.rbox(HX, 29, -6, HX + 4, 47, 0, 2, streak);
    v.tube(HX + 1, 35, -2, HX + 4, 27, 0, 2.2, streak);
    // left-side outer wave + square gold hair clip + thick banded side-tail
    v.rbox(-HX - 4, 39, -3, -HX, 49, 5, 2, streak);
    v.rbox(-HX - 4, 33, -5, -HX - 1, 41, 0, 2, streak);
    v.box(-HX - 5, 41, 2, -HX - 3, 44, 5, M('#e2bd5a', 0));            // square gold hair clasp on outer wave
    v.tube(-11, 35, -1, -13, 28, 1.5, 2.9, streak);
    v.cyl('y', -13, 1.5, 27, 29, 3.2, bandC);                          // hair wrap band
    v.tube(-13, 27, 1.5, -15, 21, 2.5, 2.5, streak);
    v.sphere(-15.2, 20.5, 2.7, 1.9, hiHair);
  }
  // fringe on the forehead (front face of the head)
  for (let x = -HX; x < HX; x++) {
    let drop;
    if (style === 'side') drop = 2 + Math.round((x + HX) / 4.5);       // swept across
    else if (style === 'long') drop = Math.abs(x) > 5 ? 6 : 2;         // curtains
    else if (style === 'braids') drop = x < -5 ? 5 : x > 5 ? 4 : 1;    // parted waves, clear brow
    else if (style === 'bun') drop = 2;
    else drop = 2 + (noise3(x, 0, 0, seed) > 0.5 ? 1 : 0);             // short, a little uneven
    for (let y = HY1 - drop; y < HY1; y++) {
      for (let z = HZ; z >= 4; z--) { if (v.has(x, y, z - 1) || z === 4) { if (!v.has(x, y, z)) v.set(x, y, z, streak(x, y, z)); break; } }
    }
  }
  if (style === 'bun') {
    v.sphere(-0.5, HY1 + 2, -5.5, 4.2, streak);
    v.ring(-0.5, HY1 - 1, -5.5, 3.6, 0.9, M('#e0705f', 0), 'y');
  }
}

function buildHoopEarrings(v, color = '#e58ea6', glint = '#ffdbe6', alien = false) {
  const ring = M(color, 0), shine = M(glint, 0);
  const y0 = alien ? 39 : 33, y1 = alien ? 46 : 40, yc = alien ? 42.5 : 36.5;
  const z0 = alien ? -2 : 0, z1 = alien ? 4 : 6, zc = alien ? 1.0 : 3.0;
  for (const s of [-1, 1]) {
    const x = alien ? (s < 0 ? -10 : 9) : (s < 0 ? -HX - 1 : HX);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        const dy = (y - yc) / 3.3, dz = (z - zc) / 2.7;
        const d2 = dy * dy + dz * dz;
        if (d2 >= 0.44 && d2 <= 1.12) v.set(x, y, z, z >= z1 - 1 && y >= yc - 0.5 ? shine : ring);
      }
    }
  }
}

function buildFacialHair(v, L, cranium = null) {
  if (L.species === 'robot' || !L.facial || L.facial === 'none') return;
  const hc = M(L.hairColor, 2);
  if ((L.species === 'frog' || L.species === 'bear') && (L.facial === 'beard' || L.facial === 'mustache')) {
    // Paint on the projecting muzzle; the usual human moustache would sit inside it.
    const y = L.species === 'frog' ? 41 : 40;
    v.decal('+z', -4, y, 4, y + 1, hc);
    for (const x of [-5, 3]) v.decal('+z', x, y - 1, x + 2, y, hc);
    if (L.facial === 'beard') {
      v.decal('+z', -5, 36, 5, 38, hc);
      for (const x of [-6, 4]) v.decal('+z', x, 37, x + 2, y, hc);
    }
    return;
  }
  if (L.species === 'alien' && cranium) {
    if (L.facial === 'mustache') {
      for (let x = -5; x <= 4; x++) {
        const yLo = (x <= -4 || x >= 3) ? 39 : 40;
        const yHi = (x <= -4 || x >= 3) ? 40 : 41;
        for (let y = yLo; y <= yHi; y++) {
          for (let z = 9; z >= 5; z--) {
            if (cranium.has(x, y, z - 1)) { v.set(x, y, z, hc); break; }
          }
        }
      }
    } else if (L.facial === 'beard') {
      alienShell(v, cranium, hc, (x, y, z) => y >= 37 && y <= 42 && z >= -1 && (Math.abs(x + 0.5) >= 3.5 || y <= 39), 1);
      for (let x = -4; x <= 3; x++) {
        for (let z = 9; z >= 6; z--) {
          if (cranium.has(x, 40, z - 1)) { v.set(x, 40, z, hc); break; }
        }
      }
    } else if (L.facial === 'lashes') {
      buildHoopEarrings(v, '#e58ea6', '#ffdbe6', true);
    }
    return;
  }
  if (L.facial === 'mustache') {
    v.box(-4, 39, HZ, 4, 41, HZ + 1, hc);
    v.box(-5, 38, HZ, -3, 40, HZ + 1, hc); v.box(3, 38, HZ, 5, 40, HZ + 1, hc);
  } else if (L.facial === 'beard') {
    shell(v, hc, (x, y, z) => y <= 41 && z >= -2 && (Math.abs(x) >= 5 || y <= 38), { grow: 1 });
    v.box(-4, 40, HZ, 4, 41, HZ + 1, hc);
  } else if (L.facial === 'lashes') {
    buildHoopEarrings(v);
  }
}

/* ---- faces: thin decals laid on the front of the head ----------------------- */

const INK = '#2a211a';
/**
 * Pixels for an expression, in head coordinates (x across, y up).
 * Each is {x, y, c, glow?}. Robots draw theirs in light on the visor.
 */
export function facePixels(L, expression = 'neutral') {
  const px = [];
  const robot = L.species === 'robot';
  const alien = L.species === 'alien';
  const frog = L.species === 'frog', demon = L.species === 'demon';
  const animal = L.species === 'dog' || L.species === 'cat' || L.species === 'bear';
  const ey = frog ? 47 : animal || alien ? 45 : 43;
  const ex = frog ? 7 : 5;
  const eyeC = robot ? (expression === 'worried' ? '#f3b34c' : '#86e0a8') : alien ? '#10131a' : INK;
  const put = (x, y, c, g) => px.push({ x, y, c, glow: !!g });
  const mirror = (fn) => { fn(-1); fn(1); };

  mirror((s) => {
    const cx = s * ex + (s < 0 ? -1 : 0);            // left eye spans cx-1..cx+1
    const cell = (dx, dy, c = eyeC) => put(cx + dx, ey + dy, c, robot);
    if (expression === 'blink' || expression === 'sleep') { for (let d = -1; d <= 1; d++) cell(d, 0); return; }
    if (expression === 'happy') { cell(-1, 0); cell(0, 1); cell(1, 0); return; }                  // ^ ^
    if (expression === 'dizzy') { cell(-1, -1); cell(1, 1); cell(0, 0); cell(-1, 1); cell(1, -1); return; }   // x x
    if (frog) {
      for (let dx = -2; dx <= 2; dx++) {
        cell(dx, 0);
        cell(dx, 1, '#ebc776');
        if (Math.abs(dx) < 2) cell(dx, -1, '#b28a48');
      }
      cell(-1, 1, '#fff4d9');
      return;
    }
    if (demon) {
      for (let dx = -2; dx <= 2; dx++) {
        const tilt = s * dx > 0 ? 1 : 0;
        cell(dx, tilt + 2, '#542c31');
        cell(dx, tilt + 1, dx === 0 ? '#352028' : '#f6c068');
        cell(dx, tilt, dx === 0 ? '#352028' : '#d58b48');
      }
      if (expression === 'worried' || expression === 'talk') cell(0, -1, '#d58b48');
      return;
    }
    const tall = expression === 'focus' ? 3 : 4;
    for (let dy = 0; dy < tall; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!robot && tall === 4 && (dy === 0 || dy === 3) && dx !== 0 && false) continue;
      cell(dx, dy - 1);
    }
    if (!robot) put(cx - 1, ey + tall - 2, alien ? '#dfe8f4' : '#ffffff'); // the sparkle that makes it alive
    if (!robot && !animal && L.facial === 'lashes') {                  // smoky blue-grey iris + winged lashes + arched brows
      put(cx, ey - 1, '#5e768f');
      put(cx + s * 2, ey + 2, INK);
      put(cx + s * 2, ey + 1, INK);
      if (expression !== 'worried' && expression !== 'focus') {
        put(cx - s, ey + 4, '#5a3836'); put(cx, ey + 5, '#5a3836'); put(cx + s, ey + 4, '#5a3836');
      }
    } else if (!robot && !animal && !alien && L.gender === 'female') {  // subtle corner lash + soft arched brow
      put(cx + s * 2, ey + 2, INK);
      if (expression !== 'worried' && expression !== 'focus') {
        put(cx - s, ey + 4, '#5a3d38'); put(cx, ey + 5, '#5a3d38'); put(cx + s, ey + 4, '#5a3d38');
      }
    }
    if (!robot && expression === 'worried') {                          // brows tilted up in the middle
      put(cx - s, ey + 5, INK); put(cx, ey + 4, INK); put(cx + s, ey + 4, INK);
    } else if (!robot && expression === 'focus') {
      for (let d = -1; d <= 1; d++) put(cx + d, ey + 3, INK);
    }
  });

  if (frog) {
    const open = expression === 'worried' || expression === 'talk';
    for (let x = -9; x < 9; x++) {
      const y = Math.abs(x + 0.5) > 6 ? 41 : 40;
      put(x, y, '#454334');
      if (open && Math.abs(x + 0.5) < 4) put(x, y - 1, '#994f4a');
    }
  } else if (alien) {
    const seam = '#6b4918';
    if (expression === 'happy') {
      for (let x = -2; x < 2; x++) put(x, 39, seam);
      put(-3, 40, seam); put(2, 40, seam);
    } else if (expression === 'worried' || expression === 'talk') {
      for (let x = -1; x < 1; x++) for (let y = 38; y < 40; y++) put(x, y, seam);
    } else {
      for (let x = -2; x < 2; x++) put(x, 39, seam);
    }
  } else if (!robot && !animal) {                                      // blush + mouth
    const glam = L.facial === 'lashes';
    const fem = L.gender === 'female';
    if (expression !== 'focus') mirror((s) => { put(s * 7 + (s < 0 ? -1 : 0), 40, '#e8a0a0'); put(s * 7 + (s < 0 ? 0 : -1), 40, '#e8a0a0'); });
    const my = 38;
    const lip = glam ? '#c95266' : fem ? '#b85c6e' : INK;
    if (expression === 'happy') { for (let x = -3; x < 3; x++) put(x, my, lip); put(-3, my + 1, lip); put(2, my + 1, lip); for (let x = -2; x < 2; x++) put(x, my - 1, glam ? '#e6788c' : '#c96a6a'); }
    else if (expression === 'worried' || expression === 'talk') { for (let x = -1; x < 1; x++) for (let y = 0; y < 2; y++) put(x, my + y - 1, lip); }
    else if (expression === 'focus') { for (let x = -2; x < 2; x++) put(x, my, lip); }
    else if (expression === 'sleep') { put(-1, my, lip); put(0, my, lip); }
    else {
      for (let x = -2; x < 2; x++) put(x, my, lip);
      put(-3, my + 1, lip); put(2, my + 1, lip);
      if (glam) { put(-1, my - 1, '#e6788c'); put(0, my - 1, '#e6788c'); }
    }
    if (expression === 'worried') { put(8, 47, '#8fd0f0'); put(8, 46, '#8fd0f0'); put(8, 45, '#bfe6fa'); }      // sweat drop
  } else if (animal) {
    if (expression === 'happy' || expression === 'talk') { put(-1, 37, INK); put(0, 37, INK); }
  } else {
    // robot mouth: a row of lights
    const lit = expression === 'happy' ? [-3, -2, -1, 0, 1, 2] : expression === 'worried' ? [-1, 0] : [-2, -1, 0, 1];
    for (const x of lit) put(x, 41, eyeC, true);
    if (expression === 'happy') { put(-4, 42, eyeC, true); put(3, 42, eyeC, true); }
  }
  return px;
}

/* ---- things worn on the head -------------------------------------------- */

/** @returns {{model:Vox|null, spin:Vox|null}} `spin` is a separate piece that rotates (the propeller) */
export function buildAccessory(L) {
  const acc = L.accessory;
  if (!acc || acc === 'none') return { model: null, spin: null };
  const v = new Vox();
  let spin = null;
  const alien = L.species === 'alien';
  const top = hatTop(L);
  switch (acc) {
    case 'glasses': case 'shades': {
      const frame = M(acc === 'shades' ? '#141414' : '#1c1812', 0);
      const lens = acc === 'shades' ? M('#1d2a33', 0) : glass('#bcd6e6');
      if (alien) {
        for (const s of [-1, 1]) {
          const x0 = s < 0 ? -9 : 2;
          v.box(x0, 42, 9, x0 + 7, 49, 10, frame);
          v.box(x0 + 1, 43, 9, x0 + 6, 48, 10, lens);
          const armX = s < 0 ? -11 : 10;
          for (let z = -1; z <= 9; z++) v.set(armX, 46, z, frame);
          v.set(s < 0 ? -10 : 9, 46, 9, frame);
        }
        v.box(-2, 46, 9, 2, 47, 10, frame);
        if (acc === 'shades') { v.set(-7, 47, 9, M('#3a5a6a', 0)); v.set(4, 47, 9, M('#3a5a6a', 0)); }
        break;
      }
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -8 : 2;
        v.box(x0, 40, HZ, x0 + 6, 47, HZ + 1, frame);
        v.box(x0 + 1, 41, HZ, x0 + 5, 46, HZ + 1, lens);
        for (let z = 0; z < HZ; z++) v.set(s < 0 ? -HX - 1 : HX, 45, z, frame);       // arms back to the ears
        v.set(s < 0 ? -HX - 1 : HX, 45, HZ, frame);
      }
      v.box(-2, 44, HZ, 2, 45, HZ + 1, frame);
      if (acc === 'shades') { v.set(-6, 45, HZ, M('#3a5a6a', 0)); v.set(4, 45, HZ, M('#3a5a6a', 0)); }
      break;
    }
    case 'monocle': {
      const gold = M('#e8c45a', 0);
      if (alien) {
        v.box(2, 42, 9, 9, 49, 10, gold);
        v.box(3, 43, 9, 8, 48, 10, glass('#dff0f7'));
        for (let i = 0; i < 6; i++) v.set(8 + (i > 2 ? 1 : 0), 41 - i, 9, M('#caa24a', 0));
        break;
      }
      v.box(2, 40, HZ, 8, 47, HZ + 1, gold);
      v.box(3, 41, HZ, 7, 46, HZ + 1, glass('#dff0f7'));
      for (let i = 0; i < 6; i++) v.set(7 + (i > 2 ? 1 : 0), 39 - i, HZ, M('#caa24a', 0));
      break;
    }
    case 'eyepatch': {
      const k = M('#161616', 1);
      if (alien) {
        v.box(2, 43, 9, 8, 49, 10, k);
        for (let y = 47; y <= 48; y++) {
          for (let x = -11; x <= 10; x++) {
            for (let z = -11; z <= 10; z++) {
              const r = Math.hypot((x + 0.5) / 10.5, (z + 0.5 + 0.4) / 9.9);
              if (r >= 0.96 && r <= 1.07) v.set(x, y, z, k);
            }
          }
        }
        break;
      }
      v.box(2, 41, HZ, 8, 47, HZ + 1, k);
      const probe = new Vox(); probe.rbox(-HX - 1, 46, -HZ - 1, HX + 1, 48, HZ + 1, 6, 1, 'xz');
      probe.each((x, y, z) => { if (Math.abs(x) >= HX || Math.abs(z) >= HZ - 1 || z >= HZ - 1 || z <= -HZ) v.set(x, y, z, k); });
      break;
    }
    case 'headphones': {
      const k = M('#33303a', 0), pad = M('#4a4654', 2);
      if (alien) {
        for (let y = 48; y <= 60; y++) {
          for (let x = -13; x <= 12; x++) {
            const r = Math.hypot((x + 0.5) / 11.7, (y - 47.5) / 12.2);
            if (r >= 0.90 && r <= 1.03) {
              for (let z = -2; z <= 1; z++) v.set(x, y, z, k);
            }
          }
        }
        for (const s of [-1, 1]) {
          const x0 = s < 0 ? -14 : 11;
          v.rbox(x0, 40, -4, x0 + 3, 50, 4, 2, k);
          v.rbox(s < 0 ? -11 : 10, 41, -3, s < 0 ? -10 : 11, 49, 3, 1, pad);
          v.set(s < 0 ? -14 : 13, 45, 0, glow('#86e0a8'));
        }
        break;
      }
      v.ring(-0.5, 43, -0.5, 10.6, 1.1, k, 'z');
      v.carve(-14, 30, -3, 14, 44, 3);                                 // keep only the arc over the top
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -HX - 3 : HX;
        v.rbox(x0, 38, -4, x0 + 3, 48, 4, 2, k);
        v.rbox(s < 0 ? -HX - 1 : HX, 39, -3, s < 0 ? -HX : HX + 1, 47, 3, 1, pad);
        v.set(s < 0 ? -HX - 3 : HX + 2, 43, 0, glow('#86e0a8'));
      }
      break;
    }
    case 'halo':
      v.ring(-0.5, top + 6, -0.5, alien ? 7.0 : 6.5, 1.0, glow('#ffd27a'), 'y');
      break;
    case 'partyhat': {
      const baseR = alien ? 7.2 : 6.2;
      for (let y = 0; y < 13; y++) {
        const r = baseR * (1 - y / 13.5);
        const band = Math.floor((y + 1) / 3) % 2 === 0;
        v.cyl('y', -0.5, -0.5, top - 1 + y, top + y, r, M(band ? '#e0705f' : '#f0d24b', 1));
      }
      v.sphere(-0.5, top + 13, -0.5, 1.8, M('#ffffff', 2));
      break;
    }
    case 'crown': {
      const gold = M('#e8c45a', 0);
      const cBase = alien ? 55 : top - 1;
      const rOut = alien ? 8.2 : 7.6;
      const rIn = alien ? 6.9 : 6.4;
      const zCenter = alien ? -0.25 : -0.5;
      v.cyl('y', -0.5, zCenter, cBase, cBase + 4, rOut, gold);
      v.cyl('y', -0.5, zCenter, cBase, cBase + 7, rIn, 0);
      const probe = new Vox();
      probe.cyl('y', -0.5, zCenter, cBase + 4, cBase + 5, rOut, 1);
      probe.cyl('y', -0.5, zCenter, cBase + 4, cBase + 5, rIn, 0);
      probe.each((x, y, z) => {
        const a = Math.atan2(z - zCenter, x + 0.5);
        const spike = Math.max(0, Math.round(3 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3)));
        for (let k = 0; k < spike; k++) v.set(x, y + k, z, gold);
      });
      v.paint(-9, cBase + 1, -9, 9, cBase + 2, 9, (x, y, z, cur) => ((x + z + 99) % 5 === 0 ? M('#e0705f', 0) : cur));
      break;
    }
    case 'tophat': {
      const k = M('#1c1c22', 2);
      const tBase = alien ? 55 : top - 1;
      const brimR = alien ? 10.8 : 10.4;
      const cylR = alien ? 7.6 : 7.2;
      v.cyl('y', -0.5, -0.5, tBase, tBase + 2, brimR, k);
      v.cyl('y', -0.5, -0.5, tBase + 2, tBase + 13, cylR, k);
      v.paint(-9, tBase + 2, -9, 9, tBase + 5, 9, M('#8a3a4a', 1));
      break;
    }
    case 'flower': {
      const petal = M('#e87aae', 1);
      const fx = alien ? HX + 2 : HX + 1;
      const fy = alien ? 50 : 47;
      for (const [dy, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) v.sphere(fx, fy + dy, 1 + dz, 1.3, petal);
      v.box(fx, fy - 1, 0, fx + 2, fy + 1, 2, M('#f0d24b', 0));
      break;
    }
    case 'propeller': {
      if (alien) {
        for (let y = 0; y < 5; y++) v.cyl('y', -0.5, -0.5, 55 + y, 56 + y, 8.2 - y * 1.25, M(y % 2 ? '#3f7f9a' : '#d8493f', 1));
        v.box(-1, 60, -1, 1, 64, 1, M('#5a5a66', 0));
      } else {
        for (let y = 0; y < 5; y++) v.cyl('y', -0.5, -0.5, top - 1 + y, top + y, 7.2 - y * 1.3, M(y % 2 ? '#3f7f9a' : '#d8493f', 1));
        v.box(-1, top + 4, -1, 1, top + 7, 1, M('#5a5a66', 0));
      }
      spin = new Vox();
      spin.rbox(-7, 0, -1, 7, 1, 1, 1, M('#e8c45a', 0), 'xz');
      spin.box(-1, 0, -1, 1, 2, 1, M('#5a5a66', 0));
      break;
    }
    case 'cowboy': {
      const felt = M('#bfa77a', 2), feltHi = tone(felt, 0.14), feltSh = tone(felt, -0.18);
      const band = M('#b53f38', 1), buckle = M('#ddb65c', 0);
      const cTop = alien ? 55 : top;
      const brimRx = alien ? 17.4 : 16.6, brimRz = alien ? 15.6 : 14.8;
      // Wide Stetson brim with upturned side wings & subtle front dip
      for (let x = -18; x <= 17; x++) {
        for (let z = -16; z <= 16; z++) {
          const nx = (x + 0.5) / brimRx, nz = (z + 0.5) / brimRz;
          const r2 = nx * nx + nz * nz;
          if (r2 > 1) continue;
          const sideCurl = Math.round(Math.max(0, (Math.abs(x + 0.5) - (alien ? 9.4 : 8.8)) / 1.75));
          const frontDip = z >= (alien ? 10 : 9) && Math.abs(x + 0.5) < 6.5 ? -1 : 0;
          const by = cTop - 2 + sideCurl + frontDip;
          v.set(x, by, z, r2 > 0.78 ? feltHi : feltSh);
          v.set(x, by + 1, z, sideCurl >= 2 ? feltHi : felt);
        }
      }
      // Tapered cattleman crown with center pinch crease
      for (let dy = 0; dy < 11; dy++) {
        const t = dy / 10;
        const rx = (alien ? 9.0 : 8.6) - t * 2.2, rz = (alien ? 9.5 : 9.2) - t * 1.7;
        for (let x = -10; x <= 9; x++) {
          for (let z = -10; z <= 9; z++) {
            const nx = (x + 0.5) / rx, nz = (z + 0.5) / rz;
            if (nx * nx + nz * nz > 1) continue;
            if (dy >= 9 && Math.abs(x + 0.5) < 1.3 && Math.abs(z + 0.5) < 4.5) continue; // center crease
            const isBand = dy >= 1 && dy <= 2;
            const c = isBand ? band : dy >= 8 ? feltHi : felt;
            v.set(x, cTop + dy, z, c);
          }
        }
      }
      // Small side ribbon clasp on the hatband
      const bx = alien ? 8 : 7;
      v.box(bx, cTop + 1, 1, bx + 2, cTop + 3, 3, buckle);
      break;
    }
    case 'hoops': {
      buildHoopEarrings(v, '#e8c45a', '#fff3c0', alien);
      break;
    }
    case 'goggles': {
      // Round brushed-silver goggle housings with deep convex obsidian lenses & temple straps
      const rim = M('#8f96a3', 0), rimHi = M('#c5ccd9', 0), rimSh = M('#59606c', 0);
      const lens = M('#111318', 0), glint1 = M('#dfe8f4', 0), glint2 = M('#5d6f86', 0);
      const cy = alien ? 46.0 : 45.0;
      const yMin = alien ? 41 : 40, yMax = alien ? 50 : 49;
      const zShift = alien ? 1 : 0;
      for (const s of [-1, 1]) {
        const cx = s * (alien ? 4.8 : 4.6);
        for (let x = -10; x <= 9; x++) {
          for (let y = yMin; y <= yMax; y++) {
            const dx = (x + 0.5) - cx, dy = (y + 0.5) - cy;
            const r = Math.hypot(dx, dy);
            if (r > 4.15) continue;
            if (r >= 2.75) {
              const rc = dy > 1.2 ? rimHi : dy < -1.4 ? rimSh : rim;
              const zBack = alien
                ? (Math.abs(x + 0.5) >= 7.6 ? 7 : 9)
                : (Math.abs(x + 0.5) >= 6.8 ? 5 : 7);
              for (let z = zBack; z <= 9 + zShift; z++) v.set(x, y, z, rc);
            } else {
              if (!alien) v.set(x, y, 7, lens);
              v.set(x, y, 8 + zShift, lens);
              if (r < 2.05) {
                const isGlint1 = dx >= -1.7 && dx <= -0.4 && dy >= 0.4 && dy <= 1.7;
                const isGlint2 = !isGlint1 && dx >= -2.0 && dx <= 0.2 && dy >= 0.0 && dy <= 2.0 && (dx + dy > -0.6);
                v.set(x, y, 9 + zShift, isGlint1 ? glint1 : isGlint2 ? glint2 : lens);
              }
            }
          }
        }
        // Flush silver side strap hugging the temple
        const sx = alien ? (s < 0 ? -10 : 9) : (s < 0 ? -9 : 8);
        const sy = Math.round(cy);
        for (let z = alien ? 1 : 0; z <= (alien ? 7 : 6); z++) {
          v.set(sx, sy, z, rimHi);
          v.set(sx, sy - 1, z, rimSh);
        }
        if (alien) {
          v.set(s < 0 ? -11 : 10, sy, 0, rimHi);
          v.set(s < 0 ? -11 : 10, sy - 1, 0, rimSh);
          v.set(s < 0 ? -9 : 8, sy, 8, rimHi);
          v.set(s < 0 ? -9 : 8, sy - 1, 8, rimSh);
        }
      }
      // Sculpted silver bridge between lenses
      const by = Math.round(cy);
      v.box(-2, by, 8 + zShift, 2, by + 2, 10 + zShift, rim);
      v.box(-2, by + 1, 8 + zShift, 2, by + 2, 10 + zShift, rimHi);
      break;
    }
    default:
      return { model: null, spin: null };
  }
  if (L.species === 'frog' && ['glasses', 'shades', 'monocle', 'eyepatch', 'goggles'].includes(acc)) {
    // Fit the frame across the raised, wide-set sockets. Stretch its bridge along with the lenses.
    const fitted = new Vox(), lift = acc === 'goggles' ? 2 : 4;
    v.each((x, y, z, c) => {
      const left = Math.round(x * 1.3), right = Math.round((x + 1) * 1.3);
      for (let xx = left; xx < right; xx++) fitted.set(xx, y + lift, z + 1, c);
    });
    return { model: fitted, spin };
  }
  return { model: v, spin };
}

/* ---- body ---------------------------------------------------------------- */

function buildTorso(L, opt) {
  const v = new Vox();
  const oc = M(L.outfitColor, 2), ocD = tone(oc, -0.2), ocL = tone(oc, 0.16);
  const robot = L.species === 'robot';
  const alien = L.species === 'alien';
  const sk = robot ? M(STEEL, 0) : M(L.skin, 1);
  const shirt = M('#ece5d4', 2);
  const outfit = L.outfit;
  v.rbox(-7, 18, -4, 7, 35, 4, 2, outfit === 'vest' ? shirt : oc);
  v.paint(-7, 18, -4, 7, 20, 4, ocD);                                  // hem
  if (alien) {
    v.carve(-3, 33, -2, 3, 36, 4);
    v.rbox(-3, 32, -2, 3, 36, 2, M('#22242a', 1), 'xz');                // dark corded alien neck
    for (const tx of [-2, 0, 1]) for (let ty = 32; ty < 36; ty++) v.set(tx, ty, 1, tone(sk, -0.32));
  } else {
    v.box(-2, 34, -2, 2, 36, 2, sk);                                   // neck
  }

  if (outfit === 'tee') {
    v.decal('+z', -3, 32, 3, 35, tone(oc, -0.12));                     // collar
    v.decal('+z', -2, 33, 2, 35, sk);
  } else if (outfit === 'hoodie') {
    v.rbox(-6, 31, -7, 6, 37, -3, 2, ocD);                             // the hood, down
    v.decal('+z', -3, 32, 3, 35, ocD);
    for (const x of [-2, 1]) for (let y = 27; y < 33; y++) v.decal('+z', x, y, x + 1, y + 1, M('#f4eee0', 0));     // drawstrings
    v.decal('+z', -5, 21, 5, 26, ocD);                                 // pocket
    v.decal('+z', -4, 22, 4, 26, tone(oc, -0.08));
  } else if (outfit === 'suit') {
    for (let y = 26; y < 35; y++) { const w = Math.max(1, Math.round((y - 25) / 2.4)); v.decal('+z', -w, y, w, y + 1, shirt); }
    for (let y = 26; y < 34; y++) v.decal('+z', -1, y, 1, y + 1, M(y > 31 ? '#8a2f2f' : '#b5483f', 1));          // tie
    for (let y = 27; y < 35; y++) { const w = Math.max(1, Math.round((y - 25) / 2.4)); v.decal('+z', -w - 1, y, -w, y + 1, ocD); v.decal('+z', w, y, w + 1, y + 1, ocD); }
    v.decal('+z', 0, 22, 1, 23, ocD); v.decal('+z', 0, 24, 1, 25, ocD);                                         // buttons
    v.decal('+z', -6, 29, -3, 30, M('#f4eee0', 0));                    // pocket square
  } else if (outfit === 'vest') {
    for (const s of [-1, 1]) v.decal('+z', s < 0 ? -7 : 2, 19, s < 0 ? -2 : 7, 33, oc);
    v.decal('-z', -7, 19, 7, 33, oc);
    for (const s of [-1, 1]) for (let y = 19; y < 33; y++) for (let z = -4; z < 4; z++) { const x = s < 0 ? -7 : 6; if (v.has(x, y, z)) v.set(x, y, z, oc); }
    for (let y = 21; y < 31; y += 3) v.decal('+z', 2, y, 3, y + 1, ocD);
    v.decal('+z', -2, 33, 2, 35, shirt);
  } else if (outfit === 'cardigan') {
    v.decal('+z', -2, 19, 2, 35, mix(oc, '#f4eee0', 0.72));            // the top underneath
    for (let y = 20; y < 31; y += 3) v.decal('+z', 2, y, 3, y + 1, ocL);
    v.decal('+z', -3, 19, -2, 34, ocD); v.decal('+z', 2, 19, 3, 34, ocD);
  } else if (outfit === 'tunic') {
    // Wholesome structured halter-neck tunic: full bodice coverage, vertical princess seams, waist sash & glossy choker
    v.paint(-7, 31, -4, 7, 35, 4, sk);                                  // collarbone & upper shoulders
    for (const s of [-1, 1]) {                                          // wide modest shoulder straps front-to-back
      const sx0 = s < 0 ? -5 : 3, sx1 = s < 0 ? -3 : 5;
      v.paint(sx0, 31, -4, sx1, 35, 4, oc);
    }
    v.decal('+z', -5, 30, 5, 31, ocL);                                  // crisp straight upper bodice trim
    for (let y = 20; y < 30; y++) {                                     // tailored vertical panel seams
      v.decal('+z', -3, y, -2, y + 1, ocD);
      v.decal('+z', 2, y, 3, y + 1, ocD);
    }
    v.paint(-7, 18, -4, 7, 20, 4, ocD);                                 // structured waist band
    v.decal('+z', -1, 19, 1, 20, ocL);
    // Glossy metallic-rose choker collar standing proud under the chin
    const choker = M(mix(oc, '#c96886', 0.45), 0), chokerHi = M('#f9dce8', 0);
    v.rbox(-3, 33, -4, 3, 35, 5, 1, choker, 'xz');
    v.box(-2, 34, 4, 1, 35, 5, chokerHi);
    v.set(-1, 34, 4, M('#ffffff', 0));
  } else if (outfit === 'consul') {
    // Tailored Consul blazer: striped slate-blue shirt, patterned gold/slate silk tie, notched lapels & chest vent badge
    const shA = M('#688198', 2), shB = M('#93acc2', 2), shCollar = M('#a7bfd4', 1);
    const tieGold = M('#d4a138', 1), tieDark = M('#3c4654', 1), tieKnot = M('#b58424', 1);
    for (let y = 23; y < 35; y++) {
      const w = Math.max(1, Math.round((y - 22) / 2.2));
      for (let x = -w; x < w; x++) {
        if (alien && y >= 33 && x >= -1 && x < 1) continue;
        v.decal('+z', x, y, x + 1, y + 1, (x + y) % 2 === 0 ? shB : shA);
      }
    }
    // Pointed slate-blue spread shirt collar wings
    v.decal('+z', -4, 32, -1, 35, shCollar);
    v.decal('+z', 1, 32, 4, 35, shCollar);
    // Patterned gold-and-slate silk tie with center medallion
    for (let y = 23; y < 33; y++) {
      for (let x = -1; x < 1; x++) {
        const isKnot = y >= 31;
        const isMedallion = y >= 27 && y <= 28;
        const isStripe = (x + y) % 3 === 0;
        const tc = isKnot ? tieKnot : isMedallion ? tieDark : isStripe ? tieDark : tieGold;
        v.decal('+z', x, y, x + 1, y + 1, tc);
      }
    }
    v.decal('+z', 0, 27, 1, 28, tieGold);
    // Sharp notched lapels
    for (let y = 23; y < 35; y++) {
      const w = Math.max(1, Math.round((y - 22) / 2.2));
      const lc = y === 31 ? ocD : ocL;
      v.decal('+z', -w - 2, y, -w, y + 1, lc);
      v.decal('+z', w, y, w + 2, y + 1, lc);
      v.decal('+z', -w - 1, y, -w, y + 1, ocD);
      v.decal('+z', w, y, w + 1, y + 1, ocD);
    }
    // Welt breast pocket on left chest (+x)
    v.decal('+z', 2, 26, 6, 27, ocD);
    v.decal('+z', 2, 25, 6, 26, ocL);
    // Circular silver-rimmed dark louvered vent emblem below pocket
    const vRim = M('#9aa2b0', 0), vGrille = M('#1b1e24', 0), vSlit = M('#454c59', 0);
    for (let x = 2; x <= 5; x++) {
      for (let y = 19; y <= 22; y++) {
        const dx = x - 3.5, dy = y - 20.5;
        const d2 = dx * dx + dy * dy;
        if (d2 > 3.2) continue;
        v.set(x, y, 4, d2 >= 1.6 ? vRim : (y % 2 === 0 ? vGrille : vSlit));
      }
    }
  }

  // a lanyard and badge in the colour of the provider behind this agent
  const badge = PROVIDER_COLORS[opt.provider] || null;
  if (badge && outfit !== 'suit' && outfit !== 'consul' && outfit !== 'tunic') {
    const cord = M(badge, 0);
    for (let y = 27; y < 35; y++) { v.decal('+z', -4 + Math.round((34 - y) / 4), y, -3 + Math.round((34 - y) / 4), y + 1, cord); }
    v.box(-4, 22, 4, 0, 27, 5, M('#f4f0e6', 0));
    v.box(-4, 26, 4, 0, 27, 5, cord);
    v.set(-3, 24, 4, M('#9aa0a6', 0)); v.set(-2, 24, 4, M('#9aa0a6', 0));
  }

  if (L.gender === 'female' && !robot) {                              // gentle 1-voxel waist taper
    v.carve(-7, 21, -4, -6, 26, 4);
    v.carve(6, 21, -4, 7, 26, 4);
    const sideC = outfit === 'vest' ? oc : ocD;
    for (let y = 21; y < 26; y++) {
      for (let z = -3; z < 3; z++) {
        if (v.has(-6, y, z)) v.set(-6, y, z, sideC);
        if (v.has(5, y, z)) v.set(5, y, z, sideC);
      }
    }
  }

  if (L.species === 'dog' || L.species === 'cat') {                    // a tail
    const fur = M(L.skin, 2);
    if (L.species === 'dog') { v.tube(0, 20, -4, 0, 24, -8, 1.3, fur); v.tube(0, 24, -8, 0, 29, -9, 1.2, fur); }
    else { v.tube(0, 20, -4, 0, 21, -10, 1.1, fur); v.tube(0, 21, -10, 0, 28, -12, 1.1, fur); v.tube(0, 28, -12, 0, 31, -10, 1.0, tone(fur, 0.25)); }
  }
  if (L.species === 'bear') v.sphere(0, 18.5, -6, 3.1, M(L.skin, 2));
  if (L.species === 'demon') {
    const tail = M(L.skin, 1);
    v.tube(0, 20, -3, 2, 16, -9, 1.7, tail);
    v.tube(2, 16, -9, 7, 17, -12, 1.4, tail);
    v.tube(7, 17, -12, 9, 23, -11, 1.2, tail);
    v.cyl('y', 9, -11, 22, 27, 2.6, tone(tail, -0.18), 0.6);
  }
  return v;
}

function buildArm(L, side, part) {
  // side: -1 left, +1 right. part: 'upper' | 'lower'
  const v = new Vox();
  const robot = L.species === 'robot';
  const oc = M(L.outfitColor, 2), ocD = tone(oc, -0.2), ocL = tone(oc, 0.16);
  const sk = robot ? M(STEEL, 0) : M(L.skin, 1);
  const sleeveless = L.outfit === 'tunic';
  const sleeveLong = L.outfit !== 'tee' && !sleeveless;
  const sleeve = L.outfit === 'vest' ? M('#ece5d4', 2) : oc;
  const x0 = side < 0 ? -11 : 7, x1 = x0 + 4;
  if (part === 'upper') {
    v.rbox(x0, 25, -2, x1, 34, 2, 1, sleeveless ? sk : sleeve, 'xz');
    v.rbox(x0, 31, -2, x1, 35, 2, 2, sleeveless ? sk : sleeve);         // rounded shoulder
    if (!sleeveLong && !sleeveless) v.paint(x0, 25, -2, x1, 28, 2, sk); // short sleeve ends above the elbow
    if (!sleeveLong && !sleeveless) v.paint(x0, 28, -2, x1, 29, 2, ocD);
  } else {
    v.rbox(x0, 18, -2, x1, 26, 2, 1, sleeveLong ? sleeve : sk, 'xz');
    if (sleeveLong) {
      const cuffC = L.outfit === 'suit' ? M('#f4eee0', 0) : L.outfit === 'consul' ? M('#8ca5bb', 0) : ocD;
      v.paint(x0, 18, -2, x1, 20, 2, cuffC);                           // cuff
    }
    if (sleeveless) {                                                   // wrist bracers / cuffs
      v.paint(x0, 19, -2, x1, 23, 2, oc);
      v.paint(x0, 22, -2, x1, 23, 2, ocL);
    }
    v.rbox(x0, 14, -2, x1, 19, 3, 2, sk);                              // hand
    if (L.species === 'frog') {
      for (const offset of [-2, 0, 2]) v.sphere(x0 + 2 + offset, 14.3, 2, 1.2, tone(sk, 0.18));
    }
    if (robot) v.paint(x0, 18, -2, x1, 19, 3, M(STEEL_D, 0));
  }
  return v;
}

function buildLeg(L, side, part, seed) {
  const v = new Vox();
  const robot = L.species === 'robot';
  const h = hashId(String(seed));
  const pants = robot ? M(STEEL_D, 0) : L.outfit === 'tunic' ? M('#37334a', 2) : L.outfit === 'consul' ? M('#272b34', 2) : M(pick(PANTS, h >>> 5), 2);
  const shoe = L.outfit === 'tunic' ? M('#a8895e', 1) : L.outfit === 'consul' ? M('#1b1e24', 1) : M(pick(SHOES, h >>> 9), 1);
  const x0 = side < 0 ? -6 : 1, x1 = x0 + 5;
  if (part === 'upper') {
    v.rbox(x0, 9, -3, x1, 19, 3, 1, pants, 'xz');
  } else {
    v.rbox(x0, 2, -3, x1, 10, 3, 1, pants, 'xz');
    if (robot) v.paint(x0, 8, -3, x1, 9, 3, M(STEEL_L, 0));
    const dressShoe = L.outfit === 'consul';
    v.rbox(x0, 0, -3, x1, 3, 6, 1, shoe, 'xz');                        // the shoe sticks out in front
    v.paint(x0, 0, -3, x1, 1, 6, M(dressShoe ? '#2e333e' : '#f4f0e6', 0)); // sole
    v.decal('+y', x0 + 1, 2, x1 - 1, 5, M(dressShoe ? '#3a404d' : '#f4f0e6', 0)); // laces
  }
  return v;
}

/**
 * Sculpt every part of a character.
 * @param {object} look      resolved look
 * @param {{seed?:string, provider?:string}} [opt]
 * @returns {object} { head, torso, armUpperL/R, armLowerL/R, legUpperL/R, legLowerL/R, accessory, spin }
 */
export function buildCharacter(look, opt = {}) {
  look = wornLook(look);                           // a cap or beanie is headwear, drawn over the head like the old hair styles
  const seed = hashId(String(opt.seed || 'x'));
  const { model: accessory, spin } = buildAccessory(look);
  return {
    head: buildHead(look, seed),
    torso: buildTorso(look, opt),
    armUpperL: buildArm(look, -1, 'upper'), armUpperR: buildArm(look, 1, 'upper'),
    armLowerL: buildArm(look, -1, 'lower'), armLowerR: buildArm(look, 1, 'lower'),
    legUpperL: buildLeg(look, -1, 'upper', opt.seed), legUpperR: buildLeg(look, 1, 'upper', opt.seed),
    legLowerL: buildLeg(look, -1, 'lower', opt.seed), legLowerR: buildLeg(look, 1, 'lower', opt.seed),
    accessory, spin,
  };
}

/** A mug, to hold. */
export function buildMug(color = '#cf6b4b') {
  const v = new Vox();
  const c = M(color, 0);
  v.cyl('y', -0.5, -0.5, 0, 6, 2.6, c);
  v.cyl('y', -0.5, -0.5, 1, 6, 1.7, 0);
  v.cyl('y', -0.5, -0.5, 1, 5, 1.7, M('#3a2414', 0));                  // coffee
  v.box(2, 1, -1, 4, 5, 0, c); v.carve(2, 2, -1, 3, 4, 0);
  v.paint(-3, 5, -3, 3, 6, 3, tone(c, 0.25));
  return v;
}
