import { paintFlatCharacter } from './world/art/character.js';
import { drawLogo } from './art.js';

let wordmark;

// The displayed canvas is also the print master. Only these public-facing fields reach the PNG.
export function drawPersonnelCard(canvas, { name, look, best, escapes, rooms, entities }, portrait) {
  const g = canvas.getContext('2d'),
    W = canvas.width,
    H = canvas.height;
  const ink = '#163e3b',
    green = '#125b51',
    gold = '#eec66d',
    paper = '#f2e9ca',
    muted = '#4f5e4f';
  const rect = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const text = (value, x, y, font, color = ink, maxWidth) => {
    g.fillStyle = color;
    g.font = font;
    if (maxWidth) g.fillText(value, x, y, maxWidth);
    else g.fillText(value, x, y);
  };
  const mono = (size) => 'bold ' + size + 'px "Courier New", monospace';
  const sans = (size) => 'bold ' + size + 'px Arial, sans-serif';
  g.save();
  g.imageSmoothingEnabled = false;
  rect(0, 0, W, H, ink);
  rect(10, 10, W - 20, H - 20, paper);
  // The holes and tear lines are printed continuously, like tractor-feed stationery.
  for (const x of [33, W - 33]) {
    rect(x + (x < 50 ? 17 : -19), 12, 2, H - 24, '#bfb599');
    for (let y = 32; y < H - 16; y += 40) {
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fillStyle = '#aca58b';
      g.fill();
      rect(x - 3, y - 2, 6, 4, '#89856e');
    }
  }
  rect(55, 14, 1090, 122, ink);
  // A plan of cubicles across the ink band doubles as the department letterhead.
  g.save();
  g.beginPath();
  g.rect(650, 14, 495, 122);
  g.clip();
  for (let x = 647; x < 1175; x += 59)
    for (let y = 9; y < 139; y += 46) {
      rect(x, y, 42, 3, '#2b5149');
      rect(x, y, 3, 31, '#2b5149');
      rect(x + 26, y + 20, 33, 3, '#2b5149');
      rect(x + 56, y + 20, 3, 27, '#2b5149');
    }
  g.restore();
  rect(82, 40, 53, 65, gold);
  rect(91, 48, 35, 49, ink);
  rect(113, 71, 5, 5, gold);
  if (!wordmark) {
    wordmark = document.createElement('canvas');
    const stopAnimation = drawLogo(wordmark, ['BLOCKROOMS']);
    stopAnimation();
  }
  g.drawImage(wordmark, 154, 40, 497, 67);
  text('PERSONNEL DEPT.', 846, 68, mono(26), '#fcf4d7');
  text('FORM HR–31', 846, 101, mono(20), gold);
  rect(55, 136, 1090, 7, gold);
  // The photo has the same wallpaper, skirting board and low ceiling as the front door.
  const x = 83,
    y = 176,
    w = 282,
    h = 373;
  rect(x - 5, y - 5, w + 10, h + 10, ink);
  rect(x, y, w, h, '#d3bc72');
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  for (let col = x + 7; col < x + w; col += 21) {
    rect(col, y, 3, h, '#c1a963');
    for (let row = y + 10; row < y + h - 32; row += 38) {
      g.strokeStyle = '#b39a59';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(col + 9, row);
      g.lineTo(col + 12, row + 5);
      g.lineTo(col + 9, row + 10);
      g.lineTo(col + 6, row + 5);
      g.closePath();
      g.stroke();
    }
  }
  rect(x, y, w, 12, '#c6bca1');
  rect(x, y + 12, w, 3, '#655e4c');
  rect(x + 76, y + 1, 131, 8, '#fff6cf');
  rect(x, y + h - 42, w, 42, '#8d8060');
  rect(x, y + h - 47, w, 6, '#655e4c');
  if (portrait) g.drawImage(portrait, x + 11, y + 21, w - 22, h - 32);
  else {
    const pix = paintFlatCharacter(look, { pose: 'idle' }),
      bounds = pix.extent();
    if (bounds) {
      const pw = bounds.x1 - bounds.x0,
        ph = bounds.y1 - bounds.y0;
      const scale = Math.max(1, Math.floor(Math.min((w - 40) / pw, (h - 60) / ph)));
      g.drawImage(
        pix.toCanvas(),
        bounds.x0 - pix.x0,
        bounds.y0 - pix.y0,
        pw,
        ph,
        x + Math.round((w - pw * scale) / 2),
        y + h - 18 - ph * scale,
        pw * scale,
        ph * scale,
      );
    }
  }
  g.restore();
  text('PHOTO ON FILE', 88, 594, mono(25), muted);
  text('PERSONNEL IDENTIFICATION', 410, 199, mono(30), green);
  text(name, 408, 292, 'bold 82px Georgia, serif', ink, 700);
  rect(410, 324, 693, 3, ink);
  rect(410, 334, 693, 1, '#a29e83');
  const fields = [
    ['ESCAPES', escapes],
    ['BEST SCORE', best],
    ['ROOM TYPES', rooms],
    ['ENTITIES SEEN', entities],
  ];
  for (const [i, [title, value]] of fields.entries()) {
    const dx = 410 + (i % 2) * 359,
      dy = 375 + Math.floor(i / 2) * 129;
    text(title, dx, dy, mono(23), muted);
    text(value.toLocaleString('en-US'), dx, dy + 62, sans(58), ink, 325);
  }
  rect(78, 628, 1041, 3, ink);
  text('BLOCKROOMS.APP', 82, 686, mono(39), ink);
  g.save();
  g.translate(906, 673);
  g.rotate(-0.045);
  g.strokeStyle = '#964537';
  g.lineWidth = 3;
  g.strokeRect(-142, -27, 303, 45);
  text('EMPLOYEE COPY', -122, 6, mono(32), '#964537');
  g.restore();
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
