// The Office — what is on everybody's monitor.
//
// A handful of tiny animated canvases, shared by every screen showing the same
// thing. A monitor tells you at a glance what its owner is up to: code
// scrolling by, a thinking cursor, an amber "?" when they need you, a
// screensaver once they have wandered off.
import * as THREE from 'three';

const W = 28, H = 22;                         // two texture pixels per voxel of screen

function makeScreen(draw, fps = 8, boost = 1.35) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d'); g.imageSmoothingEnabled = false;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  material.color.setScalar(boost);            // push the bright pixels into the bloom
  const screen = { canvas, g, tex, material, draw, fps, last: -1, users: 0 };
  draw(g, 0, 0); tex.needsUpdate = true;
  return screen;
}

const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
function hash(n) { let h = Math.imul(n | 0, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822519); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; }

/** Lines of "code": indents and coloured tokens, scrolling upward. */
function code(palette, speed) {
  return (g, t, frame) => {
    R(g, palette.bg, 0, 0, W, H);
    const row = Math.floor(t * speed);
    for (let y = 0; y < 7; y++) {
      const n = row + y, indent = Math.floor(hash(n * 7) * 4) * 2;
      let x = 1 + indent;
      if (hash(n * 13) < 0.14) continue;                       // a blank line
      for (let k = 0; k < 4 && x < W - 2; k++) {
        const len = 2 + Math.floor(hash(n * 31 + k) * 6);
        R(g, palette.ink[Math.floor(hash(n * 17 + k * 5) * palette.ink.length)], x, 1 + y * 3, Math.min(len, W - 1 - x), 1);
        x += len + 1;
      }
    }
    if (frame % 2 === 0) R(g, palette.cursor, 1 + Math.floor(hash(row) * 14), 19, 2, 1);
  };
}

const KINDS = {
  off: () => makeScreen((g) => { R(g, '#0b100e', 0, 0, W, H); R(g, '#141c19', 2, 2, 9, 1); R(g, '#141c19', 2, 4, 5, 1); }, 0, 1),
  code0: () => makeScreen(code({ bg: '#0c1a14', ink: ['#5fe08a', '#9ff0b8', '#3fa37c', '#e8e39a'], cursor: '#d8ffe4' }, 5)),
  code1: () => makeScreen(code({ bg: '#111528', ink: ['#7fb2ff', '#c9a2ff', '#ff9a8a', '#e8e6f0', '#6fe0c8'], cursor: '#ffffff' }, 4)),
  code2: () => makeScreen(code({ bg: '#1c1410', ink: ['#ffb45a', '#ffd9a0', '#e8845a', '#f0e6d0'], cursor: '#fff2dc' }, 6)),
  think: () => makeScreen((g, t, frame) => {
    R(g, '#101624', 0, 0, W, H);
    R(g, '#5a6a90', 3, 4, 14, 1); R(g, '#5a6a90', 3, 7, 19, 1); R(g, '#5a6a90', 3, 10, 9, 1);
    for (let i = 0; i < 3; i++) R(g, (frame + i) % 3 === 0 ? '#e8f0ff' : '#44506c', 10 + i * 4, 15, 2, 2);
  }, 3),
  blocked: () => makeScreen((g, t, frame) => {
    const on = frame % 2 === 0;
    R(g, on ? '#3a2408' : '#2a1a06', 0, 0, W, H);
    const c = on ? '#ffd24a' : '#c99a2a';
    R(g, c, 11, 3, 6, 2); R(g, c, 15, 5, 3, 3); R(g, c, 12, 8, 4, 2); R(g, c, 12, 10, 3, 3); R(g, c, 12, 15, 3, 3);   // "?"
    R(g, c, 0, 0, W, 1); R(g, c, 0, H - 1, W, 1);
  }, 2, 1.5),
  alert: () => makeScreen((g, t, frame) => {
    const on = frame % 2 === 0;
    R(g, on ? '#3a0c0c' : '#260808', 0, 0, W, H);
    const c = on ? '#ff6a5a' : '#c9443a';
    R(g, c, 12, 3, 4, 10); R(g, c, 12, 15, 4, 3);                                                                         // "!"
    R(g, c, 0, 0, W, 1); R(g, c, 0, H - 1, W, 1);
  }, 3, 1.5),
  done: () => makeScreen((g) => {
    R(g, '#0c2014', 0, 0, W, H);
    const c = '#6fe08a';
    for (let i = 0; i < 4; i++) R(g, c, 7 + i, 10 + i, 2, 2);
    for (let i = 0; i < 9; i++) R(g, c, 11 + i, 13 - i, 2, 2);
  }, 0),
  // nobody home: a little square bounces around, changing colour when it hits an edge
  idle: () => makeScreen((g, t) => {
    R(g, '#07080f', 0, 0, W, H);
    const px = Math.abs(((t * 5) % (2 * (W - 6))) - (W - 6)), py = Math.abs(((t * 3.1) % (2 * (H - 4))) - (H - 4));
    const bounces = Math.floor((t * 5) / (W - 6)) + Math.floor((t * 3.1) / (H - 4));
    R(g, ['#ff7a9a', '#7ad0ff', '#ffe27a', '#9aff9a', '#d09aff'][bounces % 5], Math.round(px), Math.round(py), 6, 4);
  }, 10),
};

export function createScreens() {
  const live = new Map();
  let frame = 0;
  return {
    size: { w: W, h: H },
    /** The shared material for a kind of screen (see KINDS). */
    material(kind) {
      const k = KINDS[kind] ? kind : 'off';
      if (!live.has(k)) live.set(k, KINDS[k]());
      return live.get(k).material;
    },
    /** Which code theme someone gets — stable per person. */
    codeKind(seed) { return 'code' + (Math.abs(seed | 0) % 3); },
    update(t) {
      frame++;
      for (const s of live.values()) {
        if (!s.fps) continue;
        const f = Math.floor(t * s.fps);
        if (f === s.last) continue;
        s.last = f;
        s.draw(s.g, t, f);
        s.tex.needsUpdate = true;
      }
    },
  };
}
