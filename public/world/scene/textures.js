// The Office — surfaces. Floors and walls are flat geometry wearing small
// painted textures at the same density as the voxels (40 px per metre), so a
// carpet fleck and a voxel are the same size and the place feels like one
// material. Everything is drawn in code; nothing is downloaded.
import * as THREE from 'three';

export const PPM = 40;                       // texture pixels per metre
const cache = new Map();

function hex(c) { const s = c.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
export function shade(c, amt) {
  const [r, g, b] = hex(c);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function mixHex(a, b, t) {
  const p = hex(a), q = hex(b);
  return '#' + p.map((v, i) => Math.round(v + (q[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function rnd(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export function canvasTexture(w, h, draw, opt = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  return t;
}
const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/* ---- floors (tile = sizeM metres square) ----------------------------------- */

export const FLOORS = {
  carpet: (color = '#6b5743') => cached('carpet' + color, () => ({ size: 1.6, tex: canvasTexture(64, 64, (g, w, h) => {
    R(g, color, 0, 0, w, h);
    const r = rnd(7);
    for (let y = 0; y < h; y += 2) for (let x = (y / 2) & 1 ? 1 : 0; x < w; x += 2) {
      const n = r();
      if (n > 0.66) R(g, shade(color, 0.07), x, y, 1, 1); else if (n < 0.3) R(g, shade(color, -0.09), x, y, 1, 1);
    }
  }) })),
  wood: (color = '#9a6a3c') => cached('wood' + color, () => ({ size: 2.4, tex: canvasTexture(96, 96, (g, w, h) => {
    const r = rnd(11);
    for (let row = 0; row < 8; row++) {
      const y = row * 12, offset = (row % 2) * 24 + ((row * 17) % 12);
      for (let x = -48; x < w; x += 48) {
        const tone = (r() - 0.5) * 0.16;
        R(g, shade(color, tone), x + offset, y, 48, 12);
        for (let k = 0; k < 5; k++) R(g, shade(color, tone - 0.07), x + offset + ((r() * 44) | 0), y + 2 + ((r() * 8) | 0), 3 + ((r() * 8) | 0), 1);
        R(g, shade(color, -0.3), x + offset, y, 1, 12);
      }
      R(g, shade(color, -0.26), 0, y + 11, w, 1);
    }
  }) })),
  tile: (a = '#a39c8e', b = '#8d8678') => cached('tile' + a + b, () => ({ size: 1.0, tex: canvasTexture(40, 40, (g) => {
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const c = (tx + ty) & 1 ? a : b;
      R(g, c, tx * 20, ty * 20, 20, 20);
      R(g, shade(c, 0.1), tx * 20 + 1, ty * 20 + 1, 18, 1);
      R(g, shade(c, -0.22), tx * 20, ty * 20, 20, 1); R(g, shade(c, -0.22), tx * 20, ty * 20, 1, 20);
    }
  }) })),
  raised: (color = '#454a55') => cached('raised' + color, () => ({ size: 0.6, tex: canvasTexture(24, 24, (g, w, h) => {
    R(g, color, 0, 0, w, h); R(g, shade(color, 0.1), 1, 1, w - 2, 1); R(g, shade(color, -0.3), 0, 0, w, 1); R(g, shade(color, -0.3), 0, 0, 1, h);
    for (const [x, y] of [[4, 4], [19, 4], [4, 19], [19, 19]]) R(g, shade(color, -0.4), x, y, 1, 1);
  }) })),
  concrete: (color = '#5d5a60') => cached('concrete' + color, () => ({ size: 2.0, tex: canvasTexture(80, 80, (g, w, h) => {
    R(g, color, 0, 0, w, h);
    const r = rnd(3);
    for (let i = 0; i < 260; i++) R(g, shade(color, (r() - 0.5) * 0.14), (r() * w) | 0, (r() * h) | 0, 1 + ((r() * 2) | 0), 1);
    R(g, shade(color, -0.2), 0, 0, w, 1); R(g, shade(color, -0.2), 0, 0, 1, h);
  }) })),
  pavement: () => cached('pavement', () => ({ size: 2.0, tex: canvasTexture(80, 80, (g, w, h) => {
    const c = '#3d3a45';
    R(g, c, 0, 0, w, h);
    const r = rnd(5);
    for (let i = 0; i < 200; i++) R(g, shade(c, (r() - 0.5) * 0.18), (r() * w) | 0, (r() * h) | 0, 1, 1);
    for (let k = 0; k < 2; k++) { R(g, shade(c, -0.3), 0, k * 40, w, 1); R(g, shade(c, -0.3), k * 40 + ((k * 20) % 40), 0, 1, h); }
  }) })),
  grass: () => cached('grass', () => ({ size: 2.0, tex: canvasTexture(80, 80, (g, w, h) => {
    const c = '#3f5d3a';
    R(g, c, 0, 0, w, h);
    const r = rnd(9);
    for (let i = 0; i < 700; i++) R(g, shade(c, (r() - 0.45) * 0.3), (r() * w) | 0, (r() * h) | 0, 1, 1 + ((r() * 2) | 0));
  }) })),
};

/* ---- walls: one tall strip per style, tiled along the wall ------------------- */
// Each wall texture is WALL_PX tall (the full wall height) and tiles sideways,
// so skirting and panelling line up all the way round a room.
export const WALL_H = 2.6;
const WALL_PX = Math.round(WALL_H * PPM);       // 104

function wallStrip(key, widthPx, paint) {
  return cached('wall' + key, () => ({ tile: widthPx / PPM, tex: canvasTexture(widthPx, WALL_PX, (g, w, h) => paint(g, w, h)) }));
}
const yUp = (h, metres) => h - Math.round(metres * PPM);          // canvas y for a height above the floor

export const WALLS = {
  /** Wallpaper above wood panelling — the classic office wall, in any colour. */
  office: (color = '#3f7d74') => wallStrip('office' + color, 40, (g, w, h) => {
    const wood = '#9a6a3c', rail = yUp(h, 0.94);
    R(g, color, 0, 0, w, h);
    const r = rnd(21);
    for (let y = 4; y < rail - 2; y += 8) for (let x = ((y / 8) | 0) % 2 ? 5 : 0; x < w; x += 10) {
      R(g, shade(color, 0.09), x, y, 1, 1); R(g, shade(color, 0.09), x + 1, y + 1, 1, 1);
      if (r() > 0.7) R(g, shade(color, -0.07), x + 4, y + 3, 1, 1);
    }
    R(g, shade(color, 0.16), 0, 0, w, 2);                             // picture rail highlight
    R(g, shade(wood, -0.2), 0, rail, w, h - rail);                    // backing board
    R(g, '#bd8a53', 0, rail, w, 1); R(g, '#774e29', 0, rail + 1, w, 3); R(g, '#372617', 0, rail + 4, w, 1);
    const top = rail + 7, bot = yUp(h, 0.12);
    R(g, wood, 3, top, w - 6, bot - top); R(g, '#bd8a53', 3, top, w - 6, 1);
    R(g, shade(wood, -0.24), 7, top + 4, w - 14, bot - top - 8);
    R(g, wood, 9, top + 6, w - 18, bot - top - 12); R(g, '#bd8a53', 9, top + 6, w - 18, 1);
    R(g, shade(wood, -0.3), w - 3, top, 1, bot - top);
    R(g, '#4a371f', 0, bot, w, h - bot); R(g, shade('#4a371f', 0.2), 0, bot, w, 1);
  }),
  plaster: (color = '#d8cdb8') => wallStrip('plaster' + color, 80, (g, w, h) => {
    R(g, color, 0, 0, w, h);
    const r = rnd(31);
    for (let i = 0; i < 160; i++) R(g, shade(color, (r() - 0.5) * 0.08), (r() * w) | 0, (r() * h) | 0, 2, 1);
    const bot = yUp(h, 0.14);
    R(g, '#6b4a2f', 0, bot, w, h - bot); R(g, '#8a6238', 0, bot, w, 1);
    R(g, shade(color, -0.1), 0, yUp(h, 0.94), w, 1);
  }),
  library: () => wallStrip('library', 40, (g, w, h) => {
    const wood = '#5f4126';
    R(g, '#2f4a3f', 0, 0, w, h);
    for (let y = 6; y < yUp(h, 1.2); y += 12) for (let x = ((y / 12) | 0) % 2 ? 6 : 0; x < w; x += 12) { R(g, '#3b5a4c', x, y, 2, 2); R(g, '#3b5a4c', x - 1, y + 1, 4, 1); }
    const rail = yUp(h, 1.2);
    R(g, wood, 0, rail, w, h - rail); R(g, shade(wood, 0.25), 0, rail, w, 1); R(g, shade(wood, -0.3), 0, rail + 2, w, 1);
    R(g, shade(wood, -0.18), 4, rail + 6, w - 8, h - rail - 12); R(g, shade(wood, 0.1), 4, rail + 6, w - 8, 1);
    R(g, shade(wood, -0.4), 0, h - 4, w, 4);
  }),
  kitchen: () => wallStrip('kitchen', 20, (g, w, h) => {
    R(g, '#d9d2c2', 0, 0, w, h);
    const band = yUp(h, 1.6);
    for (let y = band; y < yUp(h, 0.9); y += 10) for (let x = ((y / 10) | 0) % 2 ? 5 : 0; x < w + 10; x += 10) {
      R(g, '#3c5a52', x - 10, y, 10, 10); R(g, '#43645b', x - 9, y + 1, 8, 8); R(g, '#4f7268', x - 9, y + 1, 8, 1);
    }
    R(g, '#6b4a2f', 0, h - 5, w, 5);
  }),
  server: () => wallStrip('server', 40, (g, w, h) => {
    R(g, '#3a3f4a', 0, 0, w, h);
    R(g, '#454b58', 1, 1, w - 2, h - 2); R(g, '#2c303a', 0, 0, 1, h); R(g, '#515868', 1, 1, w - 2, 1);
    for (let y = 14; y < h; y += 26) R(g, '#2c303a', 0, y, w, 1);
    R(g, '#e0a62a', 0, h - 9, w, 3);
    for (let x = 0; x < w; x += 8) R(g, '#2a2a2a', x, h - 9, 4, 3);
    R(g, '#23262e', 0, h - 4, w, 4);
  }),
  closet: () => wallStrip('closet', 80, (g, w, h) => {
    const c = '#8d8f8a';
    R(g, c, 0, 0, w, h);
    const r = rnd(41);
    for (let i = 0; i < 120; i++) R(g, shade(c, (r() - 0.5) * 0.1), (r() * w) | 0, (r() * h) | 0, 2, 1);
    R(g, '#5a5c58', 0, h - 5, w, 5);
  }),
  backroom: () => wallStrip('backroom', 40, (g, w, h) => {
    R(g, '#2a1f3d', 0, 0, w, h);
    for (let y = 0; y < h; y += 13) for (let x = ((y / 13) | 0) % 2 ? 10 : 0; x < w; x += 20) { R(g, '#3a2a55', x, y, 10, 6); }
    R(g, '#1b1428', 0, h - 6, w, 6); R(g, '#ff5fa8', 0, h - 7, w, 1);
  }),
  steel: () => wallStrip('steel', 40, (g, w, h) => {
    R(g, '#7d8694', 0, 0, w, h); R(g, '#a7b0bc', 1, 0, 1, h); R(g, '#5a626e', 0, 0, 1, h);
    for (let y = 0; y < h; y += 26) R(g, '#5a626e', 0, y, w, 1);
  }),
  brick: () => wallStrip('brick', 40, (g, w, h) => {
    const c = '#6d4a44';
    R(g, shade(c, -0.35), 0, 0, w, h);
    const r = rnd(51);
    for (let y = 0; y < h; y += 5) for (let x = ((y / 5) | 0) % 2 ? -5 : 0; x < w; x += 10) R(g, shade(c, (r() - 0.5) * 0.2), x, y, 9, 4);
  }),
};

/* ---- signs and screens ---------------------------------------------------- */

/** A wooden plaque with text — room names, "BREAK ROOM", desk plates. */
export function signTexture(text, opt = {}) {
  const font = opt.size || 11;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${font}px ui-monospace, Menlo, Consolas, monospace`;
  const w = Math.max(opt.minWidth || 24, Math.ceil(probe.measureText(text).width) + 14), h = font + 9;
  const bg = opt.bg || '#5a3a22', fg = opt.fg || '#f4ddb4';
  const tex = canvasTexture(w, h, (g) => {
    R(g, shade(bg, -0.4), 0, 0, w, h); R(g, bg, 1, 1, w - 2, h - 2); R(g, shade(bg, 0.22), 1, 1, w - 2, 2); R(g, shade(bg, -0.25), 1, h - 3, w - 2, 2);
    if (opt.accent) R(g, opt.accent, 1, 1, 3, h - 2);
    g.fillStyle = fg; g.font = `${font}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2 + (opt.accent ? 1 : 0), h / 2 + 1);
  }, { clamp: true });
  tex.userData = { w, h, aspect: w / h };
  return tex;
}

/** The night-and-day view through a window: sky, sun or moon, a little skyline. */
export function skylineTexture(hour = 21, seed = 1) {
  const key = `sky${Math.round(hour * 2)}:${seed}`;
  return cached(key, () => canvasTexture(128, 72, (g, w, h) => {
    const night = hour < 5.5 || hour >= 20.5, dusk = !night && (hour < 7.5 || hour >= 18);
    const top = night ? '#1b1838' : dusk ? '#3a3a78' : '#5aa2dc';
    const mid = night ? '#4a3560' : dusk ? '#c0607a' : '#9cc9ea';
    const low = night ? '#b0607a' : dusk ? '#f0a25a' : '#d8ecf6';
    for (let y = 0; y < h; y++) { const k = y / h; R(g, k < 0.55 ? mixHex(top, mid, k / 0.55) : mixHex(mid, low, (k - 0.55) / 0.45), 0, y, w, 1); }
    const r = rnd(seed * 97 + 3);
    if (night) {
      for (let i = 0; i < 40; i++) R(g, 'rgba(255,255,235,.8)', (r() * w) | 0, (r() * h * 0.5) | 0, 1, 1);
      g.fillStyle = '#ffe9c4'; g.beginPath(); g.arc(w * 0.74, h * 0.24, 7, 0, 7); g.fill();
      g.fillStyle = mixHex(top, mid, 0.3); g.beginPath(); g.arc(w * 0.78, h * 0.2, 6, 0, 7); g.fill();
    } else {
      g.fillStyle = dusk ? '#ffd9a0' : '#fff6d8'; g.beginPath(); g.arc(w * 0.72, h * (dusk ? 0.6 : 0.22), 6, 0, 7); g.fill();
      for (let i = 0; i < 4; i++) { const cx = (r() * w) | 0, cy = 6 + ((r() * 20) | 0); R(g, 'rgba(255,255,255,.75)', cx, cy, 12 + ((r() * 10) | 0), 3); R(g, 'rgba(255,255,255,.75)', cx + 3, cy - 2, 8, 2); }
    }
    const city = night ? '#1c1730' : dusk ? '#3a2c4a' : '#6f7f96';
    for (let x = 2; x < w - 2; x += 12) {
      const bh = 14 + ((r() * h * 0.42) | 0), bw = 9 + ((r() * 3) | 0);
      R(g, city, x, h - bh, bw, bh); R(g, shade(city, 0.18), x, h - bh, bw, 1);
      for (let yy = h - bh + 3; yy < h - 2; yy += 5) for (let xx = x + 2; xx < x + bw - 2; xx += 3) {
        if (r() < (night ? 0.55 : dusk ? 0.35 : 0.08)) R(g, night || dusk ? '#f0b860' : '#dfeaf2', xx, yy, 2, 2);
      }
    }
  }, { clamp: true }));
}
