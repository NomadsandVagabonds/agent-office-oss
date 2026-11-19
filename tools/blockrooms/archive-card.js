import { paintFlatCharacter } from './world/art/character.js';
import { drawLogo } from './art.js';
import { CLEARANCE_FLOORS } from './core/archive.mjs';
import { floorStamp } from './archive-stamps.js';

const blue = '#1b3071',
  ink = '#182946',
  paper = '#ede9d8',
  gray = '#626777';
let wordmark;

// Lay out in coarse printer dots. Typeset directly on the export canvas so even the small legends print cleanly.
export function drawPersonnelCard(canvas, { name, look, best, escapes, rooms, entities, clearances = [], visited = clearances }, portrait) {
  const g = canvas.getContext('2d');
  g.save();
  g.scale(canvas.width / 600, canvas.height / 360);
  g.imageSmoothingEnabled = false;
  const rect = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const type = (value, x, y, font, color = ink, align = 'left') => {
    g.fillStyle = color;
    g.font = font;
    g.textAlign = align;
    g.fillText(value, x, y);
    g.textAlign = 'left';
  };
  const mono = (size) => `600 ${size}px 'HR Mono', 'Courier New', monospace`;
  const labelFont = (size) => `700 ${size}px "Helvetica Neue", Arial, sans-serif`;
  const display = (size, italic = false) =>
    `${italic ? 'italic ' : ''}900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  const band = (x, y, width, height, rake, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x + rake, y);
    g.lineTo(x + rake + width, y);
    g.lineTo(x + width, y + height);
    g.lineTo(x, y + height);
    g.closePath();
    g.fill();
  };
  rect(0, 0, 600, 360, '#101d49');
  rect(2, 2, 596, 356, paper);
  rect(4, 4, 592, 57, blue);

  // The header carries an optical security pattern: corridors disappear into an offset door.
  g.save();
  g.beginPath();
  g.rect(302, 4, 294, 57);
  g.clip();
  const vanX = 426,
    vanY = 33;
  for (let t = 1; t <= 22; t++) {
    const d = t * t * 0.82,
      x = Math.round(vanX - d * 0.68),
      y = Math.round(vanY - d * 0.43);
    const w = Math.round(1.56 * d),
      h = Math.round(0.91 * d);
    rect(x, y, w, 1, '#36538b');
    rect(x, y, 1, h, '#42608f');
    rect(x + w, y, 1, h, '#2b4680');
    rect(x, y + h, w, 1, '#325382');
  }
  g.restore();
  // Six offset inks echo the diagonal die-cut at the other end of the pass.
  const spectrum = ['#db6264', '#ef9759', '#f3ce68', '#78bc92', '#68b1cf', '#a48bca'];
  spectrum.forEach((color, i) => band(502 + i * 11, 4, 8.5, 57, 24, color));
  if (!wordmark) {
    wordmark = document.createElement('canvas');
    drawLogo(wordmark, ['BLOCKROOMS'])();
  }
  g.drawImage(wordmark, 14, 14, 246, 33);
  type('PERSONNEL  /  ACCESS CONTROL', 16, 56, mono(7), '#c3d6ee');
  rect(4, 61, 592, 3, '#c4a147');

  // Crop the actual rig as a badge photograph. Older GPUs can still print the game's flat avatar.
  const px = 14,
    py = 74,
    pw = 118,
    ph = 114;
  rect(px - 2, py - 2, pw + 4, ph + 4, ink);
  rect(px, py, pw, ph, '#759493');
  g.save();
  g.beginPath();
  g.rect(px, py, pw, ph);
  g.clip();
  for (let y = py; y < py + ph; y += 2) {
    for (let x = px + ((y - py) % 4 ? 1 : 0); x < px + pw; x += 2) rect(x, y, 1, 1, '#87a29c');
  }
  // The photographer's pull-down blind.
  for (let x = px + 4; x < px + pw; x += 11) rect(x, py, 1, ph, '#6a898c');
  if (portrait) {
    const cropH = Math.round(portrait.height * 0.64),
      cropW = Math.min(portrait.width, Math.round((cropH * pw) / ph));
    g.drawImage(
      portrait,
      Math.floor((portrait.width - cropW) / 2),
      Math.round(portrait.height * 0.074),
      cropW,
      cropH,
      px,
      py,
      pw,
      ph,
    );
  } else {
    const pix = paintFlatCharacter(look, { pose: 'idle' }),
      b = pix.extent();
    if (b) {
      const w = b.x1 - b.x0,
        h = b.y1 - b.y0,
        scale = Math.min((pw - 8) / w, ph / (h * 0.73));
      g.drawImage(
        pix.toCanvas(),
        b.x0 - pix.x0,
        b.y0 - pix.y0,
        w,
        h,
        px + Math.round((pw - w * scale) / 2),
        py + 5,
        Math.round(w * scale),
        Math.round(h * scale),
      );
    }
  }
  for (const dx of [px + 3, px + pw - 8])
    for (const dy of [py + 3, py + ph - 4]) {
      rect(dx, dy, 5, 1, '#d4ded0');
      rect(dx === px + 3 ? dx : dx + 4, dy === py + 3 ? dy : dy - 3, 1, 4, '#d4ded0');
    }
  g.restore();
  rect(px - 2, py + ph + 2, pw + 4, 13, ink);
  type('VISITOR PHOTOGRAPH', px + pw / 2, py + ph + 11, mono(8), '#f6f1d9', 'center');

  type('NAME ON FILE', 148, 83, mono(9), blue);
  let size = 48;
  g.font = display(size, true);
  while (g.measureText(name).width > 430 && size > 12) g.font = display(--size, true);
  type(name, 146, 125, display(size, true), blue);
  rect(148, 138, 437, 2, blue);
  const fields = [
    ['ESCAPES', escapes],
    ['BEST SCORE', best],
    ['ROOM TYPES', rooms],
    ['ENTITIES SEEN', entities],
  ];
  fields.forEach(([label, value], i) => {
    const x = 148 + i * 110;
    if (i) rect(x - 6, 152, 0.85, 43, '#7e88a2');
    type(label, x, 160, labelFont(10.8), blue);
    const digits = Number(value).toLocaleString('en-US');
    let fontSize = 32;
    g.font = display(fontSize);
    while (fontSize > 10 && g.measureText(digits).width > 102) g.font = display(--fontSize);
    type(digits, x, 192, display(fontSize), blue);
  });

  const floors = Object.entries(CLEARANCE_FLOORS),
    earned = new Set(clearances);
  band(12, 209, 524, 25, 10, blue);
  band(541, 209, 10, 25, 10, blue);
  band(557, 209, 8, 25, 10, blue);
  band(571, 209, 7, 25, 10, blue);
  type('FLOOR CLEARANCE', 26, 228, display(20, true), paper);
  type(`${visited.length}/${floors.length} SEEN  ·  ${earned.size} CLEARED`, 523, 226, display(13, true), paper, 'right');

  // A single ruled strip leaves the paper visible between all nine ink impressions.
  g.strokeStyle = '#8490a6';
  g.lineWidth = 0.8;
  g.strokeRect(12, 239, 576, 78);
  floors.forEach(([id, label], index) => {
    const left = 12 + index * 64, center = left + 32, active = earned.has(id);
    if (index) rect(left, 239, 0.7, 78, '#a0a6ae');
    if (active) {
      g.drawImage(floorStamp(id), center - 27, 241, 54, 47.5);
    } else if (visited.includes(id)) {
      type('VISITED', center, 271, labelFont(9.2), blue, 'center');
    } else {
      rect(center - 9, 273, 18, 0.8, '#b8b7a9');
    }
    const words = label.toUpperCase().split(' ');
    words.forEach((word, line) => type(word, center, 302 + line * 10, labelFont(9.2), active ? ink : gray, 'center'));
  });

  const website = 'blockrooms.app', addressFont = display(18, true);
  g.font = addressFont;
  const rulesEnd = 586 - g.measureText(website).width - 12;
  for (let i = 0; i < 4; i++) {
    // The four strokes meet the same diagonal cut as the slash on the lettering.
    rect(12, 331 + i * 3.5, rulesEnd - 12 - i * 1.4, 1.6, blue);
  }
  type(website, 585, 343, addressFont, blue, 'right');
  g.restore();
}

// Cache the encoded image before offering the native share sheet. Some phones require
// navigator.share() to be called in the click itself, before any asynchronous encoding.
export function cardExporter(canvas, save, share, status) {
  let generation = 0,
    file;
  save.addEventListener('click', () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  share.addEventListener('click', async () => {
    if (!file) return;
    const current = generation;
    try {
      await navigator.share({ files: [file], title: 'BlockRooms personnel ID' });
    } catch (error) {
      if (current === generation && error.name !== 'AbortError')
        status.textContent = 'Use Save ID as PNG to keep a copy.';
    }
  });
  return () => {
    const current = ++generation;
    file = null;
    save.disabled = true;
    share.hidden = true;
    status.textContent = '';
    canvas.toBlob((blob) => {
      if (current !== generation) return;
      if (!blob) {
        status.textContent = 'The ID could not be printed.';
        return;
      }
      file = new File([blob], 'BlockRooms-HR-File.png', { type: 'image/png' });
      save.disabled = false;
      share.hidden = !(navigator.share && navigator.canShare?.({ files: [file] }));
    }, 'image/png');
  };
}
