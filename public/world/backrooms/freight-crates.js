// Freight keeps its history in the wood. Two shared atlases, baked into the
// room's existing batches: no new colliders, meshes per label, or live work.
import { atlas, lin } from './kit.js';

const WOOD = ['#a29372', '#8b897b', '#ac926c', '#797d70'];
const INK = ['#7d5142', '#5f6662', '#77765c', '#675346'];
const hash = (s) => { let h = 2166136261; for (const k of String(s)) h = Math.imul(h ^ k.charCodeAt(0), 16777619); return h >>> 0; };
const rng = (seed) => { let s = hash(seed); return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const shade = (hex, k) => '#' + hex.slice(1).match(/../g).map((v) => Math.max(0, Math.min(255, Math.round(parseInt(v, 16) * k))).toString(16).padStart(2, '0')).join('');

function boardTexture(g, tile, w, h, seed) {
  const R = rng(`${seed}/board/${tile}`), wood = WOOD[Math.floor(tile / 4)], tone = 0.91 + R() * 0.15;
  g.fillStyle = shade(wood, tone); g.fillRect(0, 0, w, h);
  // Long fibres, broad weather-bleached streaks, and occasional old knots.
  for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 ? 'rgba(52,46,34,.055)' : 'rgba(230,224,203,.09)'; g.fillRect(R() * w, 0, 1 + R() * 7, h); }
  for (let i = 0; i < 180; i++) {
    const x = Math.floor(R() * w), y = Math.floor(R() * h);
    g.fillStyle = R() < 0.58 ? 'rgba(44,39,28,.12)' : 'rgba(235,226,203,.16)';
    g.fillRect(x, y, R() < 0.8 ? 1 : 2, 3 + R() * 45);
  }
  if (tile % 4 !== 1) {
    const x = 10 + R() * (w - 20), y = 42 + R() * 150;
    for (let k = 4; k >= 0; k--) { g.strokeStyle = `rgba(53,42,27,${0.045 + k * 0.012})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, 2 + k * 1.5, 4 + k * 4.5, R() * 0.13, 0, Math.PI * 2); g.stroke(); }
  }
  // Checks in the grain are irregular; they stop well before becoming seams.
  for (let i = 0; i < 3; i++) {
    let x = 4 + R() * (w - 8), y = R() * h;
    g.strokeStyle = 'rgba(42,36,26,.22)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += (R() - 0.5) * 3; y += 4 + R() * 7; g.lineTo(x, y); } g.stroke();
  }
  // Several immersion lines: tide marks and damp end grain, not glossy wet paint.
  const tide = h * (0.73 + R() * 0.12);
  for (let pass = 0; pass < 3; pass++) {
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, tide + Math.sin(x * 0.16 + tile) * 3 + R() * 5 + pass * 11);
    g.lineTo(w, h); g.closePath(); g.fillStyle = pass === 0 ? 'rgba(57,63,48,.10)' : 'rgba(51,44,29,.11)'; g.fill();
  }
  const dirt = g.createLinearGradient(0, h * 0.78, 0, h); dirt.addColorStop(0, 'rgba(39,37,24,0)'); dirt.addColorStop(1, 'rgba(39,37,24,.32)');
  g.fillStyle = dirt; g.fillRect(0, h * 0.78, w, h * 0.22);
  // Rust from old fasteners, abraded corners, pale scars from previous straps.
  for (const x of [8 + R() * 7, w - 10 - R() * 7]) {
    const y = 13 + R() * 17, rust = g.createLinearGradient(0, y, 0, y + 62);
    rust.addColorStop(0, 'rgba(111,66,32,.28)'); rust.addColorStop(1, 'rgba(111,66,32,0)'); g.fillStyle = rust; g.fillRect(x, y, 2, 62);
  }
  for (let i = 0; i < 35; i++) { g.fillStyle = R() < 0.6 ? 'rgba(221,210,178,.35)' : 'rgba(42,40,28,.2)'; g.fillRect(R() < 0.5 ? R() * 3 : w - 3 - R() * 3, R() * h, 1 + R() * 2, 2 + R() * 9); }
  for (let i = 0; i < 80; i++) { g.fillStyle = 'rgba(39,43,29,.12)'; g.fillRect(R() * w, tide + R() * (h - tide), 1, 1 + R() * 2); }
}

function stamp(g, R, text, x, y, angle, color, size = 28, border = true) {
  g.save(); g.translate(x, y); g.rotate(angle); g.fillStyle = g.strokeStyle = color;
  g.font = `700 ${size}px "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 0);
  const w = Math.max(46, g.measureText(text).width + 17);
  if (border) { g.lineWidth = 2; g.strokeRect(-w / 2, -size * 0.71, w, size * 1.42); }
  g.restore();
}

function paper(g, R, x, y, angle, old = false) {
  g.save(); g.translate(x, y); g.rotate(angle);
  const w = 68 + R() * 17, h = 42 + R() * 9;
  g.fillStyle = old ? '#a79f80' : '#c4baa0';
  g.beginPath(); g.moveTo(-w / 2 + 3, -h / 2); g.lineTo(w / 2 - 11, -h / 2 + 2); g.lineTo(w / 2, -h / 2 + 13); g.lineTo(w / 2 - 2, h / 2); g.lineTo(-w / 2 + 7, h / 2 - 2); g.lineTo(-w / 2, h / 2 - 8); g.closePath(); g.fill();
  g.fillStyle = '#74715f'; g.font = '700 9px monospace'; g.textAlign = 'left'; g.fillText(`${Math.floor(10 + R() * 80)} / ${Math.floor(1000 + R() * 8000)}`, -w / 2 + 7, -h / 2 + 11);
  for (let i = 0, xx = -w / 2 + 7; i < 23; i++, xx += 2) { const width = R() < 0.3 ? 2 : 1; g.fillRect(xx, -h / 2 + 16, width, 10 + Math.floor(R() * 5)); }
  g.fillStyle = '#928c73'; g.fillRect(-w / 2 + 7, h / 2 - 8, 39, 1); g.fillRect(-w / 2 + 7, h / 2 - 5, 26, 1);
  // Dirty tape remnants cross the paper, worn opaque enough for the cutout atlas.
  g.fillStyle = '#a69c77'; g.fillRect(-w / 2 - 4, -h / 2 + 5, 9, 23); g.fillRect(w / 2 - 6, h / 2 - 18, 10, 21);
  g.restore();
}

function marksTexture(g, tile, w, h, seed) {
  const R = rng(`${seed}/marks/${tile}`), ink = INK[tile % INK.length];
  g.clearRect(0, 0, w, h);
  if (tile < 12) {
    // Ghost of the previous journey under the more recent handling mark.
    if (tile % 3 !== 2) {
      stamp(g, R, `${Math.floor(11 + R() * 78)}–${Math.floor(100 + R() * 890)}`, 102 + R() * 40, 83 + R() * 36, -0.16 + R() * 0.3, '#89816a', 16, true);
      if (tile % 2 === 0) paper(g, R, 80 + R() * 45, 159, -0.23 + R() * 0.2, true);
    }
    const words = ['易碎', '防潮', '向上', '周转箱'];
    stamp(g, R, words[tile % 4], 113 + R() * 29, 110 + R() * 28, -0.12 + R() * 0.24, ink, tile % 4 === 3 ? 30 : 39, tile % 3 !== 1);
    if (tile % 4 === 2) {
      g.strokeStyle = ink; g.lineWidth = 4;
      for (const x of [92, 157]) { g.beginPath(); g.moveTo(x, 88); g.lineTo(x, 50); g.moveTo(x - 9, 61); g.lineTo(x, 50); g.lineTo(x + 9, 61); g.stroke(); }
    }
    if (tile % 3 === 0 || tile === 7) paper(g, R, 167, 172, 0.08 + R() * 0.18);
    if (tile % 3 === 1) stamp(g, R, `LOT ${Math.floor(100 + R() * 890)}`, 147, 171, -0.08, '#74715e', 13, false);
  } else if (tile < 14) {
    // Much quieter faces: a torn shipping label and a rubbed pencil number.
    paper(g, R, 85 + R() * 65, 118 + R() * 35, -0.16 + R() * 0.3, true);
    stamp(g, R, `${Math.floor(2 + R() * 93)}`, 182, 78, -0.1, '#797968', 22, false);
  } else {
    // Rare marker scrawls. Nothing announces a puzzle, destination or exit.
    g.save(); g.translate(130, 128); g.rotate(-0.11); g.strokeStyle = tile === 14 ? '#675f55' : '#738078'; g.lineWidth = 3; g.lineCap = 'round';
    if (tile === 14) { g.beginPath(); g.moveTo(-49, 4); g.bezierCurveTo(-24, -34, 11, 28, 40, -18); g.bezierCurveTo(70, -36, 37, 34, 8, 19); g.stroke(); g.beginPath(); g.moveTo(-30, 31); g.lineTo(50, 18); g.stroke(); }
    else { g.font = 'italic 35px cursive'; g.fillStyle = '#738078'; g.fillText('ok?', -33, 8); g.beginPath(); g.moveTo(-41, 17); g.quadraticCurveTo(4, 31, 44, 10); g.stroke(); }
    g.restore();
  }
  // Printed ink is missing along fibres and scuffed away at random. Holes
  // reveal the actual board texture underneath instead of painting beige UI.
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 650; i++) { g.fillStyle = '#000'; g.fillRect(Math.floor(R() * w), Math.floor(R() * h), R() < 0.8 ? 1 : 2, 1 + Math.floor(R() * 4)); }
  for (let i = 0; i < 14; i++) { g.fillStyle = '#000'; g.fillRect(14 + R() * (w - 28), 30 + R() * (h - 60), 1, 7 + R() * 25); }
  g.globalCompositeOperation = 'source-over';
}

const crop = (sheet, tile, u0 = 0, v0 = 0, u1 = 1, v1 = 1) => {
  const q = sheet.uv(tile), a = q[0], b = q[2];
  const p = (u, v) => [a[0] + (b[0] - a[0]) * (0.007 + u * 0.986), a[1] + (b[1] - a[1]) * (0.007 + v * 0.986)];
  return [p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)];
};

/** A single painter per room. Face quads are flush to the existing boards;
 * their gaps clip the marks, and the real braces remain on top of the ink. */
export function createFreightWear(c) {
  const seed = `${c.level.seed}/${c.params.layoutSeed}/freight-wear-v1`;
  const boards = atlas(c.kit, `freight-boards:${seed}`, 64, 256, 16, (g, i, w, h) => boardTexture(g, i, w, h, seed));
  const marks = atlas(c.kit, `freight-marks:${seed}`, 256, 256, 16, (g, i, w, h) => marksTexture(g, i, w, h, seed));
  const timber = c.mapped('freight-aged-timber', boards.texture), printed = c.mapped('freight-old-handling', marks.texture, { cutout: true });
  const identity = (s) => hash(`${seed}/${s.x.toFixed(3)}/${s.z.toFixed(3)}/${s.tone || 0}`);
  return {
    wood: (s) => lin(WOOD[identity(s) % 4]),
    face(s, side, lo, hi, n, opt = {}) {
      const id = identity(s), R = rng(`${id}/${side}/${lo}`), family = id % 4;
      const heavy = side === '+z' ? 0.82 : side === '-z' ? 0.38 : 0.28;
      const hasMark = !opt.portal && R() < heavy;
      const mark = R() < 0.075 ? 14 + Math.floor(R() * 2) : Math.floor(R() * 14);
      const width = side.endsWith('z') ? s.w : s.d;
      const point = (u, y, out = 0.014) => side === '+z' ? [s.x - s.w / 2 + u, y, s.z + s.d / 2 + out]
        : side === '-z' ? [s.x + s.w / 2 - u, y, s.z - s.d / 2 - out]
        : side === '+x' ? [s.x + s.w / 2 + out, y, s.z + s.d / 2 - u]
        : [s.x - s.w / 2 - out, y, s.z - s.d / 2 + u];
      for (let i = 0; i < n; i++) {
        // A salvaged replacement board occasionally interrupts the family.
        const repaired = id % 5 === 0 && i === (id >>> 3) % n;
        const tile = (repaired ? (family + 1) % 4 : family) * 4 + (i + (id >>> 5)) % 4;
        const u0 = i * width / n + 0.012, u1 = (i + 1) * width / n - 0.012, y0 = lo + 0.025, y1 = hi - 0.025;
        timber.quad(point(u0, y0), point(u1, y0), point(u1, y1), point(u0, y1), [1, 1, 1], crop(boards, tile));
        if (hasMark) printed.quad(point(u0, y0, 0.016), point(u1, y0, 0.016), point(u1, y1, 0.016), point(u0, y1, 0.016), [1, 1, 1], crop(marks, mark, u0 / width, 0, u1 / width, 1));
      }
      // Braces have their own grain and old strap rubs, with nails still proud.
      for (const yy of [lo + 0.08, hi - 0.17]) {
        const uv = crop(boards, family * 4 + 1, 0.15, 0.12, 0.82, 0.88);
        timber.quad(point(-0.025, yy, 0.036), point(width + 0.025, yy, 0.036), point(width + 0.025, yy + 0.12, 0.036), point(-0.025, yy + 0.12, 0.036), [0.88, 0.88, 0.88], [uv[1], uv[2], uv[3], uv[0]]);
      }
    },
    lid(s, y) {
      const id = identity(s), family = id % 4, n = Math.max(4, Math.round(s.w / 0.28));
      for (let i = 0; i < n; i++) {
        const x0 = s.x - s.w / 2 + i * s.w / n + 0.008, x1 = s.x - s.w / 2 + (i + 1) * s.w / n - 0.008;
        timber.quad([x0, y, s.z + s.d / 2], [x1, y, s.z + s.d / 2], [x1, y, s.z - s.d / 2], [x0, y, s.z - s.d / 2], [0.9, 0.9, 0.9], crop(boards, family * 4 + (i + id) % 4));
      }
    },
  };
}
