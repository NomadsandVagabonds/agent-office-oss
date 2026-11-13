// The Office — desk items, plants and agent-authored creations. Ported from
// the 2D office's drawing code; every id an agent could ever put on a desk
// still draws exactly as it did. `g` is a Pix (see pix.js): with g.zAuto(n)
// each shape gets a sensible thickness, so the same call makes a flat icon or
// a small sculpture.
import { shade, hex2rgb } from './pix.js';
import { PAL, pxBox } from './palette.js';
import { OUTFIT_COLORS, hashId } from '/core/look.mjs';

const seedHex = (s) => OUTFIT_COLORS[hashId(String(s)) % OUTFIT_COLORS.length];

export function drawPlant(g, x, y, t = 0, s = 1) {
  g.noStroke();
  pxBox(g, x - 7 * s, y - 13 * s, 14 * s, 13 * s, PAL.pot, { l: shade(PAL.pot, 26), s: PAL.potS });
  g.fill(PAL.potS); g.rect(x - 7 * s, y - 13 * s, 14 * s, 2);
  for (let i = 0; i < 6; i++) {
    const an = -1.7 + i * 0.6 + Math.sin(t / 700 + i) * 0.08;
    const lx = x + Math.cos(an) * 9 * s, ly = y - 14 * s + Math.sin(an) * 10 * s - 3;
    g.fill(PAL.leafS); g.ellipse(lx + 1, ly + 1, 9 * s, 15 * s);
    g.fill(i & 1 ? PAL.leaf : PAL.leafH); g.ellipse(lx, ly, 8 * s, 13 * s);
    g.fill(PAL.leafH); g.ellipse(lx - 1 * s, ly - 3 * s, 2 * s, 5 * s);
  }
}

/**
 * Agent-authored creations: a declarative pixel spec rendered by a SAFE
 * whitelisted interpreter (no eval). Unknown ops are ignored, numbers are
 * clamped, colours must be #rrggbb. See CREATIONS.md.
 */
export function drawCustom(g, spec, x, y, t = 0) {
  if (!spec || !Array.isArray(spec.ops)) return;
  const C = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : '#9a9aa6');
  const N = (v, lo, hi) => { v = +v; if (!isFinite(v)) v = 0; return Math.max(lo, Math.min(hi, v)); };
  const PX = (v) => x + N(v, -48, 48), PY = (v) => y + N(v, -56, 18);
  g.noStroke();
  for (const op of spec.ops.slice(0, 48)) {
    if (!op) continue;
    if (op.o === 'rect') { g.fill(C(op.c)); g.rect(PX(op.x), PY(op.y), N(op.w, 0, 72), N(op.h, 0, 72)); }
    else if (op.o === 'box') {
      pxBox(g, PX(op.x), PY(op.y), Math.max(2, N(op.w, 0, 72)), Math.max(2, N(op.h, 0, 72)), C(op.c),
        { l: op.l ? C(op.l) : undefined, s: op.s ? C(op.s) : undefined });
    } else if (op.o === 'ellipse') { g.fill(C(op.c)); g.ellipse(PX(op.x), PY(op.y), N(op.w, 0, 72), N(op.h, 0, 72)); }
    else if (op.o === 'tri') {
      g.fill(C(op.c)); g.triangle(PX(op.x1), PY(op.y1), PX(op.x2), PY(op.y2), PX(op.x3), PY(op.y3));
    } else if (op.o === 'line') {
      g.stroke(C(op.c)); g.strokeWeight(N(op.wt, 0.5, 3));
      g.line(PX(op.x1), PY(op.y1), PX(op.x2), PY(op.y2)); g.noStroke();
    } else if (op.o === 'glow') {
      const rgb = hex2rgb(C(op.c));
      const pr = Math.abs(Math.sin(t / N(op.t, 80, 2000)));
      g.fill(rgb[0], rgb[1], rgb[2], N(op.a, 0, 90) * (t ? pr : 0.8));
      g.ellipse(PX(op.x), PY(op.y), N(op.w, 1, 72) || 10, N(op.h, 1, 72) || 10);
    }
  }
}

/** Every glow op in a creation, so the 3D world can put a real light there. */
export function creationGlows(spec) {
  if (!spec || !Array.isArray(spec.ops)) return [];
  return spec.ops.filter((op) => op && op.o === 'glow' && /^#[0-9a-f]{6}$/i.test(op.c || ''))
    .map((op) => ({ x: +op.x || 0, y: +op.y || 0, w: +op.w || 10, h: +op.h || 10, c: op.c, a: +op.a || 40, t: +op.t || 300 }));
}

export function drawDeskItem(g, id, x, y, t = 0, seed = '', creations = null) {
  g.noStroke();
  switch (id) {
    case 'monstera': pxBox(g, x - 4, y - 7, 9, 7, PAL.pot, { l: shade(PAL.pot, 24) });
      g.fill(PAL.leafS); g.ellipse(x + 1, y - 13, 15, 18);
      g.fill(PAL.leaf); g.ellipse(x, y - 14, 13, 16);
      g.fill(PAL.leafH); g.ellipse(x - 2, y - 17, 4, 6); break;
    case 'succulent': pxBox(g, x - 4, y - 5, 9, 5, '#7a5a3a', { l: '#9a774f' });
      g.fill('#5f8a5a'); g.ellipse(x, y - 9, 10, 9);
      g.fill('#86bf7e'); g.ellipse(x - 1, y - 11, 4, 5); break;
    case 'cactus': pxBox(g, x - 4, y - 6, 9, 6, '#b5703f', { l: '#cd8a55' });
      g.fill('#3f7a44'); g.rect(x - 2, y - 18, 5, 13); g.rect(x - 7, y - 13, 4, 3);
      g.fill('#5aa05e'); g.rect(x - 2, y - 18, 2, 12);
      g.fill('#f3b34c'); g.rect(x - 1, y - 20, 2, 2); break;
    case 'bonsai': pxBox(g, x - 6, y - 4, 13, 5, '#6b4a2f', { l: '#8a6238' });
      g.fill('#5a3f28'); g.rect(x - 1, y - 13, 2, 9);
      g.fill(PAL.leafS); g.ellipse(x + 1, y - 15, 17, 11);
      g.fill(PAL.leaf); g.ellipse(x, y - 16, 15, 9);
      g.fill(PAL.leafH); g.ellipse(x - 3, y - 18, 5, 4); break;
    case 'mug': { const c = seedHex(seed);
      pxBox(g, x - 4, y - 8, 9, 9, c, { l: shade(c, 28), s: shade(c, -30) });
      g.fill('#f4eee0'); g.rect(x - 4, y - 8, 9, 2);
      g.stroke(c); g.strokeWeight(2); g.noFill(); g.ellipse(x + 7, y - 4, 5, 5); g.noStroke();
      if (((t / 600) | 0) % 2 === 0) { g.fill(255, 255, 255, 90); g.ellipse(x, y - 11 + Math.sin(t / 200), 3, 4); }
      break; }
    case 'figdragon': pxBox(g, x - 4, y - 9, 7, 9, '#5f7a3f', { l: '#86bf6a' });
      g.fill('#86bf6a'); g.triangle(x - 4, y - 9, x + 3, y - 9, x, y - 15);
      g.fill('#b5483f'); g.rect(x + 3, y - 7, 3, 2);
      g.fill('#fff'); g.rect(x - 2, y - 7, 1, 1); break;
    case 'figrobot': pxBox(g, x - 4, y - 10, 9, 10, PAL.steel, { l: PAL.steelH, s: PAL.steelS });
      g.fill(PAL.good); g.rect(x - 2, y - 8, 5, 3);
      g.fill(PAL.steelS); g.rect(x, y - 15, 2, 5);
      g.fill(PAL.warn); g.rect(x, y - 16, 2, 2); break;
    case 'duck': g.fill('#d99a2a'); g.ellipse(x + 1, y - 3, 12, 9);
      g.fill('#f0c64b'); g.ellipse(x, y - 4, 11, 8);
      g.fill('#f0c64b'); g.ellipse(x + 3, y - 9, 6, 6);
      g.fill('#d98a3a'); g.rect(x + 7, y - 9, 3, 2);
      g.fill('#2a211a'); g.rect(x + 4, y - 10, 2, 2); break;
    case 'books': ['#b5483f', '#3f8a72', '#5a6fa8', '#c9893f'].forEach((c, i) => {
      pxBox(g, x - 6 + i * 4, y - 11 + i * 2, 4, 11 - i * 2, c, { l: shade(c, 26), s: shade(c, -28) });
      g.fill('#f4e0c0'); g.rect(x - 6 + i * 4, y - 10 + i * 2, 4, 1); }); break;
    case 'globe': pxBox(g, x - 2, y - 2, 5, 3, '#5a3f28');
      g.fill('#2c5a72'); g.ellipse(x, y - 9, 14, 14);
      g.fill('#3f7f9a'); g.ellipse(x, y - 9, 12, 12);
      g.fill('#6f9a4a'); g.ellipse(x - 2, y - 11, 5, 4); g.ellipse(x + 3, y - 7, 4, 3);
      g.fill('#bcd6e6'); g.rect(x - 3, y - 12, 2, 2); break;
    case 'stickies': pxBox(g, x - 5, y - 8, 10, 9, '#f0d24b', { l: '#f8e47a', s: '#cdab2c' });
      g.fill('#7a6a2a'); g.rect(x - 3, y - 6, 6, 1); g.rect(x - 3, y - 3, 5, 1); break;
    case 'trophy': pxBox(g, x - 3, y - 3, 7, 3, '#caa24a', { l: '#e8c45a' });
      g.fill('#e8c45a'); g.ellipse(x, y - 9, 11, 11);
      g.fill('#f6dd92'); g.ellipse(x - 2, y - 11, 3, 4);
      g.fill('#caa24a'); g.rect(x - 6, y - 11, 2, 6); g.rect(x + 4, y - 11, 2, 6); break;
    case 'lavalamp': pxBox(g, x - 4, y - 2, 9, 3, '#3a3a44', { l: '#55555f' });
      g.fill('#241f26'); g.rect(x - 3, y - 15, 7, 13);
      g.fill('#ff7a4a'); g.ellipse(x, y - 8 + Math.sin(t / 300) * 3, 4, 5);
      g.fill('#ffb070'); g.ellipse(x + 1, y - 12 - Math.sin(t / 250) * 3, 3, 4);
      g.fill('#5a5a66'); g.rect(x - 4, y - 16, 9, 2); break;
    case 'rubiks': g.fill('#141414'); g.rect(x - 6, y - 14, 13, 13);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        g.fill(['#d83b3b', '#3b80d8', '#3bd86a', '#f0d24b', '#e88a3a', '#f4f4f4'][(r * 3 + c + hashId(String(seed))) % 6]);
        g.rect(x - 5 + c * 4, y - 13 + r * 4, 3, 3); } break;
    case 'gameboy': pxBox(g, x - 5, y - 15, 12, 15, '#c9c2b0', { l: '#e2dcc9', s: '#988f7b' });
      g.fill('#4f5f44'); g.rect(x - 3, y - 13, 8, 6);
      g.fill('#8fc06a'); g.rect(x - 2, y - 12, 6, 4);
      g.fill('#7a3a6a'); g.ellipse(x, y - 4, 2, 2);
      g.fill('#3a3a3a'); g.rect(x + 2, y - 4, 3, 1); break;
    case 'd20': g.fill('#4a3478'); g.beginShape(); g.vertex(x, y - 15); g.vertex(x + 6, y - 10);
      g.vertex(x + 5, y - 3); g.vertex(x - 5, y - 3); g.vertex(x - 6, y - 10); g.endShape();
      g.fill('#6f57a8'); g.triangle(x, y - 15, x + 6, y - 10, x - 6, y - 10);
      g.fill('#a98fd8'); g.triangle(x, y - 15, x, y - 9, x - 6, y - 10);
      g.fill('#efeaff'); g.rect(x - 1, y - 10, 2, 2); break;
    case 'fishbowl': { g.fill('#bfe2ef'); g.ellipse(x, y - 7, 16, 15);
      g.fill('#84bcd8'); g.ellipse(x, y - 5, 14, 10);
      const fx = Math.sin(t / 420) * 4; g.fill('#f0a23c');
      g.ellipse(x + fx, y - 6, 5, 3); g.triangle(x + fx - 2, y - 6, x + fx - 5, y - 8, x + fx - 5, y - 4);
      g.fill('#dff0f7'); g.ellipse(x - 4, y - 11, 3, 2);
      g.fill('#9a5236'); g.rect(x - 8, y - 1, 16, 2); break; }
    case 'newton': { g.fill('#5a4a32'); g.rect(x - 9, y - 16, 18, 2);
      g.stroke('#9a9a9a'); g.strokeWeight(0.5);
      for (let i = 0; i < 5; i++) g.line(x - 7 + i * 3.5, y - 15, x - 7 + i * 3.5, y - 5);
      g.noStroke(); const s = Math.sin(t / 240) * 3; g.fill('#aab0b6');
      for (let i = 1; i < 4; i++) g.ellipse(x - 7 + i * 3.5, y - 3, 3, 3);
      g.ellipse(x - 7 + (s > 0 ? s : 0), y - 3, 3, 3); g.ellipse(x + 7 + (s < 0 ? s : 0), y - 3, 3, 3); break; }
    case 'hourglass': g.fill('#7a5836'); g.rect(x - 5, y - 15, 11, 2); g.rect(x - 5, y - 1, 11, 2);
      g.fill('#d4e2ea'); g.triangle(x - 4, y - 13, x + 5, y - 13, x, y - 7); g.triangle(x - 4, y - 3, x + 5, y - 3, x, y - 7);
      g.fill('#e8c45a'); g.triangle(x - 3, y - 13, x + 4, y - 13, x, y - 9);
      g.rect(x, y - 7, 1, ((t / 120) % 4));
      g.triangle(x - 2, y - 3, x + 3, y - 3, x, y - 5); break;
    case 'snowglobe': g.fill('#6b4a2f'); g.rect(x - 7, y - 3, 15, 3);
      g.fill('#c2dceb'); g.ellipse(x, y - 9, 17, 16);
      g.fill('#3f6638'); g.triangle(x - 3, y - 4, x + 3, y - 4, x, y - 13);
      for (let i = 0; i < 6; i++) { g.fill('#fff'); g.rect(x - 6 + (((i * 7 + t / 110) | 0) % 13), y - 14 + (((i * 5 + t / 80) | 0) % 11), 1, 1); }
      break;
    case 'candle': g.fill('#9a5236'); g.rect(x - 3, y - 3, 8, 3);
      g.fill('#f2e6ca'); g.rect(x - 2, y - 12, 5, 9);
      g.fill('#f3b34c'); g.ellipse(x, y - 14 + Math.sin(t / 110) * 0.7, 3, 5);
      g.fill('#fff0a8'); g.ellipse(x, y - 14, 1.5, 3); break;
    case 'fan': { g.fill('#3a3a3a'); g.rect(x - 1, y - 3, 3, 3);
      g.fill('#5a5a5a'); g.rect(x - 1, y - 9, 3, 6);
      const fr = t / 45; g.fill('#9aa6b0');
      for (let i = 0; i < 3; i++) { const an = fr + i * 2.09; g.ellipse(x + 0.5 + Math.cos(an) * 5, y - 13 + Math.sin(an) * 5, 5, 2); }
      g.fill('#5f646b'); g.ellipse(x + 0.5, y - 13, 3, 3); break; }
    case 'bobblehead': { g.fill('#5a4a32'); g.rect(x - 3, y - 2, 7, 2);
      g.fill('#3f6f8a'); g.rect(x - 3, y - 7, 7, 5);
      const bb = Math.sin(t / 210) * 2; g.fill('#f1c9a5'); g.ellipse(x + bb * 0.5, y - 12, 8, 7);
      g.fill('#3a2410'); g.rect(x - 3 + bb * 0.5, y - 16, 7, 4);
      g.fill('#2a211a'); g.rect(x - 2 + bb * 0.5, y - 12, 1, 1); g.rect(x + 2 + bb * 0.5, y - 12, 1, 1); break; }
    case 'magic8': g.fill('#141414'); g.ellipse(x, y - 7, 15, 15);
      g.fill('#3a3a3a'); g.ellipse(x - 3, y - 10, 3, 2);
      g.fill('#f4f4f4'); g.ellipse(x, y - 4, 6, 6);
      g.fill('#274088'); g.triangle(x - 2, y - 3, x + 2, y - 3, x, y - 6); break;
    case 'catclock': { g.fill('#161616'); g.ellipse(x, y - 9, 13, 13);
      g.fill('#f4f4f4'); g.ellipse(x, y - 9, 10, 10);
      const ce = Math.sin(t / 500); g.fill('#161616'); g.rect(x - 3 + ce, y - 11, 2, 3); g.rect(x + 2 + ce, y - 11, 2, 3);
      g.fill('#f3a23c'); g.triangle(x - 2, y - 6, x + 2, y - 6, x, y - 4);
      g.fill('#161616'); g.rect(x - 1 + Math.sin(t / 300) * 2, y - 1, 2, 4); break; }
    case 'donut': g.fill('#c69a52'); g.ellipse(x, y - 5, 13, 9);
      g.fill('#ec8fb6'); g.ellipse(x, y - 6, 13, 8);
      g.fill('#6b4a2f'); g.ellipse(x, y - 5, 4, 3);
      ['#fff', '#86e0a8', '#f3b34c', '#e0705f'].forEach((c, i) => { g.fill(c); g.rect(x - 4 + i * 3, y - 9 + ((i * 5) % 3), 2, 1); });
      break;
    case 'ramen': pxBox(g, x - 5, y - 10, 12, 11, '#d8493f', { l: '#e87a6a', s: '#9a322a' });
      g.fill('#f2e6ca'); g.ellipse(x, y - 10, 11, 4);
      g.fill('#e8c45a'); g.rect(x - 3, y - 11, 7, 1);
      if (((t / 600) | 0) % 2 === 0) { g.fill(255, 255, 255, 80); g.ellipse(x, y - 13 + Math.sin(t / 200), 3, 4); }
      break;
    case 'plushie': g.fill('#b07a4a'); g.ellipse(x, y - 5, 12, 11);
      g.ellipse(x - 4, y - 12, 4, 4); g.ellipse(x + 5, y - 12, 4, 4);
      g.fill('#cba27c'); g.ellipse(x, y - 4, 7, 5);
      g.fill('#2a211a'); g.rect(x - 3, y - 8, 2, 2); g.rect(x + 2, y - 8, 2, 2); g.rect(x - 1, y - 4, 2, 1); break;
    case 'floppy': ['#3a5a8a', '#8a3a4a', '#3a7a5a'].forEach((c, i) => {
      pxBox(g, x - 6 + i, y - 10 + i * 2, 13, 11, c, { l: shade(c, 26), s: shade(c, -26) }); });
      g.fill('#cfd2d6'); g.rect(x - 1, y - 10, 5, 4);
      g.fill('#2f2f2f'); g.rect(x - 4, y - 2, 9, 2); break;
    case 'cassette': pxBox(g, x - 7, y - 9, 15, 10, '#2f2a26', { l: '#48423a', s: '#1b1714' });
      g.fill('#caa05a'); g.rect(x - 5, y - 7, 12, 4);
      g.fill('#161616'); g.ellipse(x - 2, y - 3, 3, 3); g.ellipse(x + 4, y - 3, 3, 3); break;
    case 'crystal': g.fill('#6b4a2f'); g.rect(x - 4, y - 2, 10, 2);
      g.fill('#6f57a8'); g.triangle(x - 3, y - 2, x, y - 14, x + 1, y - 2);
      g.fill('#9a7fd0'); g.triangle(x + 1, y - 2, x + 4, y - 9, x + 5, y - 2);
      g.fill('#d8c8f0'); g.triangle(x - 3, y - 3, x - 2, y - 9, x - 1, y - 3); break;
    case 'skull': g.fill('#e9e3d4'); g.ellipse(x, y - 8, 12, 11); g.rect(x - 3, y - 5, 8, 4);
      g.fill('#161616'); g.ellipse(x - 3, y - 8, 3, 3); g.ellipse(x + 4, y - 8, 3, 3); g.rect(x, y - 5, 1, 2);
      g.fill('#cfc7b4'); g.rect(x - 3, y - 1, 2, 2); g.rect(x + 2, y - 1, 2, 2); break;
    case 'paperplane': g.fill('#5a4a32'); g.rect(x - 1, y - 2, 3, 2);
      g.fill('#f0f0f0'); g.triangle(x - 8, y - 7, x + 8, y - 9, x - 1, y - 3);
      g.fill('#d2d2d2'); g.triangle(x - 8, y - 7, x - 1, y - 3, x + 1, y - 9);
      g.fill('#bcd6e6'); g.rect(x - 1, y - 5, 1, 1); break;
    case 'zen': pxBox(g, x - 8, y - 5, 16, 6, '#8a7250', { l: '#a89070', s: '#5c4830' });
      g.fill('#e7ddc2'); g.rect(x - 7, y - 4, 14, 4);
      g.stroke('#cabd98'); g.strokeWeight(0.5); g.line(x - 7, y - 3, x + 7, y - 3); g.line(x - 7, y - 2, x + 7, y - 2); g.noStroke();
      g.fill('#7d8088'); g.ellipse(x + 3, y - 3, 3, 2);
      g.fill('#5a4a32'); g.rect(x - 8, y - 9, 1, 5); g.rect(x - 9, y - 9, 4, 1); break;
    case 'toycar': g.fill('#d83b3b'); g.rect(x - 7, y - 5, 15, 4);
      g.fill('#ec5a5a'); g.rect(x - 3, y - 8, 8, 3);
      g.fill('#bcd6e6'); g.rect(x - 2, y - 7, 5, 2);
      g.fill('#161616'); g.ellipse(x - 4, y - 1, 4, 4); g.ellipse(x + 4, y - 1, 4, 4);
      g.fill('#888888'); g.ellipse(x - 4, y - 1, 2, 2); g.ellipse(x + 4, y - 1, 2, 2); break;
    case 'discoball': g.fill('#5a5a66'); g.rect(x - 1, y - 16, 2, 4);
      g.fill('#9aa6b0'); g.ellipse(x, y - 9, 13, 13);
      for (let i = 0; i < 7; i++) { g.fill(['#fff', '#cfe6ef', '#a9c0d8'][i % 3]); g.rect(x - 4 + ((i * 5) % 9), y - 13 + ((i * 7) % 9), 3, 3); }
      break;
    case 'terrarium': g.fill('#cfe6ef'); g.ellipse(x, y - 8, 14, 15);
      g.fill('#bcd6e6'); g.arc(x, y - 8, 14, 15, 3.4, 6.1);
      g.fill('#6b4a2f'); g.rect(x - 5, y - 3, 11, 3);
      g.fill('#5f9150'); g.ellipse(x - 1, y - 6, 5, 6);
      g.fill('#86c06a'); g.ellipse(x + 2, y - 8, 3, 4);
      g.fill('#9aa6b0'); g.ellipse(x, y - 15, 12, 3); break;
    case 'pizza': g.fill('#e0b25a'); g.triangle(x - 7, y - 2, x + 7, y - 2, x, y - 13);
      g.fill('#d8493f'); g.ellipse(x - 2, y - 6, 3, 3); g.ellipse(x + 2, y - 9, 3, 3);
      g.fill('#caa05a'); g.rect(x - 7, y - 2, 14, 1); break;
    case 'banana': g.fill('#f0d24b'); g.beginShape(); g.vertex(x - 7, y - 3); g.vertex(x + 6, y - 9);
      g.vertex(x + 7, y - 6); g.vertex(x - 5, y - 1); g.endShape();
      g.fill('#3a2f12'); g.rect(x + 6, y - 10, 2, 2);
      g.fill('#caa83a'); g.rect(x - 5, y - 3, 9, 1); break;
    case 'trophy2': case 'medal': g.fill('#d8493f'); g.rect(x - 3, y - 12, 3, 7); g.rect(x + 1, y - 12, 3, 7);
      g.fill('#e8c45a'); g.ellipse(x, y - 3, 9, 9);
      g.fill('#f6dd92'); g.ellipse(x - 1, y - 4, 3, 3); break;
    default: if (creations && creations[id]) drawCustom(g, creations[id], x, y, t);
  }
}
