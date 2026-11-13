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
import { hashId } from '/core/look.mjs';

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

  const sk = M(L.skin, 1), skD = tone(sk, -0.16), skL = tone(sk, 0.12);
  skull(v, sk);
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

function buildHair(v, L, seed) {
  const style = L.hair;
  const animal = L.species === 'dog' || L.species === 'cat';
  if (style === 'bald') return;
  if (animal && !['cap', 'beanie', 'mohawk', 'bun'].includes(style)) return;       // fur is the hairdo
  const oc = L.outfitColor;
  const streak = (x, y, z) => {
    const base = M(L.hairColor, 2);
    const n = noise3(x >> 1, 0, z >> 1, seed);
    return n > 0.82 ? tone(base, 0.16) : n < 0.18 ? tone(base, -0.14) : base;
  };

  if (style === 'cap') {
    const cap = M(oc, 2);
    shell(v, cap, (x, y) => y >= 47, { grow: 1 });
    v.rbox(-7, 47, HZ, 7, 49, HZ + 6, 2, tone(cap, -0.18), 'xz');     // the brim
    v.box(-1, HY1 + 1, -1, 1, HY1 + 2, 1, tone(cap, 0.2));
    shell(v, streak, (x, y, z) => y >= 40 && y < 47 && z <= -4, { grow: 1 });     // hair below the cap, at the back
    return;
  }
  if (style === 'beanie') {
    const knit = M(oc, 3);
    shell(v, knit, (x, y) => y >= 46, { grow: 1 });
    shell(v, tone(knit, -0.2), (x, y) => y >= 45 && y < 48, { grow: 2 });           // folded rim
    v.sphere(-0.5, HY1 + 3, -0.5, 2.4, tone(knit, 0.25));
    return;
  }
  if (style === 'mohawk') {
    for (let z = -HZ - 1; z <= HZ; z++) {
      const h = 4 + Math.round(3 * Math.sin(((z + HZ + 1) / (2 * HZ + 1)) * Math.PI)) + (noise3(0, 0, z, seed) > 0.6 ? 1 : 0);
      for (let y = HY1 - 2; y < HY1 + h; y++) for (let x = -1; x < 1; x++) v.set(x, y, z, streak(x, y, z));
    }
    shell(v, tone(M(L.hairColor, 2), -0.1), (x, y, z) => y >= 44 && Math.abs(x) <= 6 && z <= 2 && y < 50 && noise3(x, y, z, seed) > 0.55, { grow: 0 });
    return;
  }

  // a cap of hair: top, back, sides; then a fringe that depends on the style
  const backTo = style === 'long' ? 26 : 39;
  shell(v, streak, (x, y, z) => {
    if (y >= 48) return z <= 6 || y >= 50;                             // crown
    if (z <= -5) return y >= backTo;                                   // back of the head
    if (Math.abs(x) >= 8 && z <= 2) return y >= (style === 'long' ? 26 : 43);      // sides
    return false;
  }, { grow: style === 'long' ? 2 : 1 });
  if (style === 'long') {                                              // falls past the shoulders
    v.rbox(-HX - 2, 26, -HZ - 2, HX + 2, 40, -3, 3, streak, 'xz');
    for (const s of [-1, 1]) v.rbox(s < 0 ? -HX - 2 : HX, 28, -4, s < 0 ? -HX : HX + 2, 44, 3, 1, streak);
  }
  // fringe on the forehead (front face of the head)
  for (let x = -HX; x < HX; x++) {
    let drop;
    if (style === 'side') drop = 2 + Math.round((x + HX) / 4.5);       // swept across
    else if (style === 'long') drop = Math.abs(x) > 5 ? 6 : 2;         // curtains
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

function buildFacialHair(v, L) {
  if (L.species === 'robot' || !L.facial || L.facial === 'none') return;
  const hc = M(L.hairColor, 2);
  if (L.facial === 'mustache') {
    v.box(-4, 39, HZ, 4, 41, HZ + 1, hc);
    v.box(-5, 38, HZ, -3, 40, HZ + 1, hc); v.box(3, 38, HZ, 5, 40, HZ + 1, hc);
  } else if (L.facial === 'beard') {
    shell(v, hc, (x, y, z) => y <= 41 && z >= -2 && (Math.abs(x) >= 5 || y <= 38), { grow: 1 });
    v.box(-4, 40, HZ, 4, 41, HZ + 1, hc);
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
  const animal = L.species === 'dog' || L.species === 'cat';
  const ey = animal ? 45 : 43;                       // eye line
  const ex = animal ? 5 : 5;                         // eye centre offset
  const eyeC = robot ? (expression === 'worried' ? '#f3b34c' : '#86e0a8') : INK;
  const put = (x, y, c, g) => px.push({ x, y, c, glow: !!g });
  const mirror = (fn) => { fn(-1); fn(1); };

  mirror((s) => {
    const cx = s * ex + (s < 0 ? -1 : 0);            // left eye spans cx-1..cx+1
    const cell = (dx, dy, c = eyeC) => put(cx + dx, ey + dy, c, robot);
    if (expression === 'blink' || expression === 'sleep') { for (let d = -1; d <= 1; d++) cell(d, 0); return; }
    if (expression === 'happy') { cell(-1, 0); cell(0, 1); cell(1, 0); return; }                  // ^ ^
    if (expression === 'dizzy') { cell(-1, -1); cell(1, 1); cell(0, 0); cell(-1, 1); cell(1, -1); return; }   // x x
    const tall = expression === 'focus' ? 3 : 4;
    for (let dy = 0; dy < tall; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!robot && tall === 4 && (dy === 0 || dy === 3) && dx !== 0 && false) continue;
      cell(dx, dy - 1);
    }
    if (!robot) put(cx - 1, ey + tall - 2, '#ffffff');                 // the sparkle that makes it alive
    if (!robot && expression === 'worried') {                          // brows tilted up in the middle
      put(cx - s, ey + 5, INK); put(cx, ey + 4, INK); put(cx + s, ey + 4, INK);
    } else if (!robot && expression === 'focus') {
      for (let d = -1; d <= 1; d++) put(cx + d, ey + 3, INK);
    }
  });

  if (!robot && !animal) {                                             // blush + mouth
    if (expression !== 'focus') mirror((s) => { put(s * 7 + (s < 0 ? -1 : 0), 40, '#e8a0a0'); put(s * 7 + (s < 0 ? 0 : -1), 40, '#e8a0a0'); });
    const my = 38;
    if (expression === 'happy') { for (let x = -3; x < 3; x++) put(x, my, INK); put(-3, my + 1, INK); put(2, my + 1, INK); for (let x = -2; x < 2; x++) put(x, my - 1, '#c96a6a'); }
    else if (expression === 'worried' || expression === 'talk') { for (let x = -1; x < 1; x++) for (let y = 0; y < 2; y++) put(x, my + y - 1, INK); }
    else if (expression === 'focus') { for (let x = -2; x < 2; x++) put(x, my, INK); }
    else if (expression === 'sleep') { put(-1, my, INK); put(0, my, INK); }
    else { for (let x = -2; x < 2; x++) put(x, my, INK); put(-3, my + 1, INK); put(2, my + 1, INK); }     // a small smile
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
  const top = HY1;
  switch (acc) {
    case 'glasses': case 'shades': {
      const frame = M(acc === 'shades' ? '#141414' : '#1c1812', 0);
      const lens = acc === 'shades' ? M('#1d2a33', 0) : glass('#bcd6e6');
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
      v.box(2, 40, HZ, 8, 47, HZ + 1, gold);
      v.box(3, 41, HZ, 7, 46, HZ + 1, glass('#dff0f7'));
      for (let i = 0; i < 6; i++) v.set(7 + (i > 2 ? 1 : 0), 39 - i, HZ, M('#caa24a', 0));
      break;
    }
    case 'eyepatch': {
      const k = M('#161616', 1);
      v.box(2, 41, HZ, 8, 47, HZ + 1, k);
      const probe = new Vox(); probe.rbox(-HX - 1, 46, -HZ - 1, HX + 1, 48, HZ + 1, 6, 1, 'xz');
      probe.each((x, y, z) => { if (Math.abs(x) >= HX || Math.abs(z) >= HZ - 1 || z >= HZ - 1 || z <= -HZ) v.set(x, y, z, k); });
      break;
    }
    case 'headphones': {
      const k = M('#33303a', 0), pad = M('#4a4654', 2);
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
      v.ring(-0.5, top + 6, -0.5, 6.5, 1.0, glow('#ffd27a'), 'y');
      break;
    case 'partyhat': {
      for (let y = 0; y < 13; y++) {
        const r = 6.2 * (1 - y / 13.5);
        const band = Math.floor((y + 1) / 3) % 2 === 0;
        v.cyl('y', -0.5, -0.5, top - 1 + y, top + y, r, M(band ? '#e0705f' : '#f0d24b', 1));
      }
      v.sphere(-0.5, top + 13, -0.5, 1.8, M('#ffffff', 2));
      break;
    }
    case 'crown': {
      const gold = M('#e8c45a', 0);
      v.cyl('y', -0.5, -0.5, top - 1, top + 3, 7.6, gold);
      v.cyl('y', -0.5, -0.5, top - 1, top + 6, 6.4, 0);
      const probe = new Vox(); probe.cyl('y', -0.5, -0.5, top + 3, top + 4, 7.6, 1); probe.cyl('y', -0.5, -0.5, top + 3, top + 4, 6.4, 0);
      probe.each((x, y, z) => {
        const a = Math.atan2(z + 0.5, x + 0.5);
        const spike = Math.max(0, Math.round(3 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3)));
        for (let k = 0; k < spike; k++) v.set(x, y + k, z, gold);
      });
      v.paint(-8, top, -8, 8, top + 1, 8, (x, y, z, cur) => ((x + z + 99) % 5 === 0 ? M('#e0705f', 0) : cur));
      break;
    }
    case 'tophat': {
      const k = M('#1c1c22', 2);
      v.cyl('y', -0.5, -0.5, top - 1, top + 1, 10.4, k);
      v.cyl('y', -0.5, -0.5, top + 1, top + 12, 7.2, k);
      v.paint(-9, top + 1, -9, 9, top + 4, 9, M('#8a3a4a', 1));
      break;
    }
    case 'flower': {
      const petal = M('#e87aae', 1);
      for (const [dy, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) v.sphere(HX + 1, 47 + dy, 1 + dz, 1.3, petal);
      v.box(HX + 1, 46, 0, HX + 3, 48, 2, M('#f0d24b', 0));
      break;
    }
    case 'propeller': {
      for (let y = 0; y < 5; y++) v.cyl('y', -0.5, -0.5, top - 1 + y, top + y, 7.2 - y * 1.3, M(y % 2 ? '#3f7f9a' : '#d8493f', 1));
      v.box(-1, top + 4, -1, 1, top + 7, 1, M('#5a5a66', 0));
      spin = new Vox();
      spin.rbox(-7, 0, -1, 7, 1, 1, 1, M('#e8c45a', 0), 'xz');
      spin.box(-1, 0, -1, 1, 2, 1, M('#5a5a66', 0));
      break;
    }
    default:
      return { model: null, spin: null };
  }
  return { model: v, spin };
}

/* ---- body ---------------------------------------------------------------- */

function buildTorso(L, opt) {
  const v = new Vox();
  const oc = M(L.outfitColor, 2), ocD = tone(oc, -0.2), ocL = tone(oc, 0.16);
  const robot = L.species === 'robot';
  const sk = robot ? M(STEEL, 0) : M(L.skin, 1);
  const shirt = M('#ece5d4', 2);
  const outfit = L.outfit;
  v.rbox(-7, 18, -4, 7, 35, 4, 2, outfit === 'vest' ? shirt : oc);
  v.paint(-7, 18, -4, 7, 20, 4, ocD);                                  // hem
  v.box(-2, 34, -2, 2, 36, 2, sk);                                     // neck

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
  }

  // a lanyard and badge in the colour of the provider behind this agent
  const badge = PROVIDER_COLORS[opt.provider] || null;
  if (badge && outfit !== 'suit') {
    const cord = M(badge, 0);
    for (let y = 27; y < 35; y++) { v.decal('+z', -4 + Math.round((34 - y) / 4), y, -3 + Math.round((34 - y) / 4), y + 1, cord); }
    v.box(-4, 22, 4, 0, 27, 5, M('#f4f0e6', 0));
    v.box(-4, 26, 4, 0, 27, 5, cord);
    v.set(-3, 24, 4, M('#9aa0a6', 0)); v.set(-2, 24, 4, M('#9aa0a6', 0));
  }

  if (L.species === 'dog' || L.species === 'cat') {                    // a tail
    const fur = M(L.skin, 2);
    if (L.species === 'dog') { v.tube(0, 20, -4, 0, 24, -8, 1.3, fur); v.tube(0, 24, -8, 0, 29, -9, 1.2, fur); }
    else { v.tube(0, 20, -4, 0, 21, -10, 1.1, fur); v.tube(0, 21, -10, 0, 28, -12, 1.1, fur); v.tube(0, 28, -12, 0, 31, -10, 1.0, tone(fur, 0.25)); }
  }
  return v;
}

function buildArm(L, side, part) {
  // side: -1 left, +1 right. part: 'upper' | 'lower'
  const v = new Vox();
  const robot = L.species === 'robot';
  const oc = M(L.outfitColor, 2), ocD = tone(oc, -0.2);
  const sk = robot ? M(STEEL, 0) : M(L.skin, 1);
  const sleeveLong = L.outfit !== 'tee';
  const sleeve = L.outfit === 'vest' ? M('#ece5d4', 2) : oc;
  const x0 = side < 0 ? -11 : 7, x1 = x0 + 4;
  if (part === 'upper') {
    v.rbox(x0, 25, -2, x1, 34, 2, 1, sleeve, 'xz');
    v.rbox(x0, 31, -2, x1, 35, 2, 2, sleeve);                          // rounded shoulder
    if (!sleeveLong) v.paint(x0, 25, -2, x1, 28, 2, sk);               // short sleeve ends above the elbow
    if (!sleeveLong) v.paint(x0, 28, -2, x1, 29, 2, ocD);
  } else {
    v.rbox(x0, 18, -2, x1, 26, 2, 1, sleeveLong ? sleeve : sk, 'xz');
    if (sleeveLong) v.paint(x0, 18, -2, x1, 20, 2, L.outfit === 'suit' ? M('#f4eee0', 0) : ocD);                 // cuff
    v.rbox(x0, 14, -2, x1, 19, 3, 2, sk);                              // hand
    if (robot) v.paint(x0, 18, -2, x1, 19, 3, M(STEEL_D, 0));
  }
  return v;
}

function buildLeg(L, side, part, seed) {
  const v = new Vox();
  const robot = L.species === 'robot';
  const h = hashId(String(seed));
  const pants = robot ? M(STEEL_D, 0) : M(pick(PANTS, h >>> 5), 2);
  const shoe = M(pick(SHOES, h >>> 9), 1);
  const x0 = side < 0 ? -6 : 1, x1 = x0 + 5;
  if (part === 'upper') {
    v.rbox(x0, 9, -3, x1, 19, 3, 1, pants, 'xz');
  } else {
    v.rbox(x0, 2, -3, x1, 10, 3, 1, pants, 'xz');
    if (robot) v.paint(x0, 8, -3, x1, 9, 3, M(STEEL_L, 0));
    v.rbox(x0, 0, -3, x1, 3, 6, 1, shoe, 'xz');                        // the shoe sticks out in front
    v.paint(x0, 0, -3, x1, 1, 6, M('#f4f0e6', 0));                     // sole
    v.decal('+y', x0 + 1, 2, x1 - 1, 5, M('#f4f0e6', 0));              // laces
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
