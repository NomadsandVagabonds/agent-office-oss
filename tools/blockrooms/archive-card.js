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
export function drawPersonnelCard(canvas, { name, look, best, escapes, rooms, entities, clearances = [] }, portrait) {
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
  const display = (size) => `${size}px 'HR Bitmap', Verdana, sans-serif`;
  const rule = (x, y, w) => {
    rect(x, y, w, 1, '#a1a3a4');
    rect(x, y + 1, w, 1, '#fffdf1');
  };
  rect(0, 0, 600, 360, '#101d49');
  rect(2, 2, 596, 356, paper);
  rect(4, 4, 592, 57, blue);

  // The header carries an optical security pattern: corridors disappear into an offset door.
  g.save();
  g.beginPath();
  g.rect(302, 4, 294, 57);
  g.clip();
  const vanX = 468,
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
  if (!wordmark) {
    wordmark = document.createElement('canvas');
    drawLogo(wordmark, ['BLOCKROOMS'])();
  }
  g.drawImage(wordmark, 14, 14, 246, 33);
  type('PERSONNEL  /  ACCESS CONTROL', 16, 56, mono(7), '#c3d6ee');
  rect(476, 11, 109, 44, '#101f50');
  rect(480, 15, 2, 36, '#efbc39');
  type('PHOTO ID', 489, 33, display(19), '#fff6cf');
  type('1997 SERIES', 490, 46, mono(8), '#a9c1e0');
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
  let size = 45;
  g.font = display(size);
  while (size > 13 && g.measureText(name).width > 433) g.font = display(--size);
  type(name, 146, 127, display(size));
  rule(148, 138, 435);
  const fields = [
    ['ESCAPES', escapes],
    ['BEST SCORE', best],
    ['ROOM TYPES', rooms],
    ['ENTITIES SEEN', entities],
  ];
  fields.forEach(([label, value], i) => {
    const x = 148 + i * 110;
    if (i) rect(x - 6, 151, 1, 42, '#c1bfaf');
    type(label, x, 158, mono(8), gray);
    const digits = Number(value).toLocaleString('en-US');
    let fontSize = 27;
    g.font = display(fontSize);
    while (fontSize > 10 && g.measureText(digits).width > 102) g.font = display(--fontSize);
    type(digits, x, 187, display(fontSize), blue);
  });

  const floors = Object.entries(CLEARANCE_FLOORS),
    earned = new Set(clearances);
  rect(12, 211, 576, 21, blue);
  type('FLOOR CLEARANCE', 19, 227, display(17), '#fff6d9');
  type(
    `${String(earned.size).padStart(2, '0')} / ${String(floors.length).padStart(2, '0')}`,
    580,
    226,
    mono(11),
    '#fff6d9',
    'right',
  );
  floors.forEach(([id, label], index) => {
    const x = 14 + index * 64,
      y = 240,
      w = 56,
      h = 50,
      active = earned.has(id);
    if (active) {
      const pic = floorStamp(id);
      // Scalloped paper, printed registration number and coloured plate are one collectible stamp.
      rect(x + 1, y + 2, w, h, '#a6a39a');
      rect(x, y, w, h, '#fff7d6');
      rect(x + 2, y + 2, w - 4, h - 4, '#384057');
      rect(x + 3, y + 3, w - 6, h - 6, '#fff3cd');
      g.drawImage(pic, x + 5, y + 5, 46, 32);
      type('BR', x + 5, y + 45, mono(7), ink);
      for (let k = 0; k < 4; k++) rect(x + 19 + k * 3, y + 41, 2, 1, gray);
      type(String(index + 1).padStart(2, '0'), x + w - 5, y + 45, mono(7), ink, 'right');
      for (let k = 3; k < w - 1; k += 6) {
        rect(x + k, y, 2, 2, paper);
        rect(x + k, y + h - 1, 2, 3, paper);
      }
      for (let k = 4; k < h - 1; k += 6) {
        rect(x, y + k, 2, 2, paper);
        rect(x + w - 1, y + k, 3, 2, paper);
      }
    } else {
      g.strokeStyle = '#a5a497';
      g.lineWidth = 1;
      g.setLineDash([2, 2]);
      g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      g.setLineDash([]);
      type(String(index + 1).padStart(2, '0'), x + w / 2, y + 30, display(17), '#94968e', 'center');
    }
    const words = label.toUpperCase().split(' ');
    words.forEach((word, line) => type(word, x + w / 2, 303 + line * 9, mono(8.5), active ? ink : gray, 'center'));
  });

  rule(12, 320, 576);
  type('blockrooms.app', 14, 346, display(22), blue);
  type('HR  /  FORM 97-C', 586, 345, mono(9), gray, 'right');
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
