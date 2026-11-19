// Miniatures are drawn on a 46 × 32 grid, like the destination labels on a sheet of postage.
// Each plate uses four inks. Their silhouettes still distinguish the floors in a monochrome print.
const inks = {
  yellow: ['#3b2b29', '#96652b', '#e5b44a', '#fff0a5'],
  archive: ['#253838', '#44736b', '#84bca1', '#e7e4ba'],
  night: ['#242347', '#514670', '#a293c3', '#ffe5a5'],
  fitout: ['#463029', '#9b5740', '#e39b53', '#ffe5a8'],
  exec: ['#382839', '#754851', '#ca9172', '#ffdaa0'],
  suburb: ['#28374a', '#526e82', '#bbbd99', '#ffe1a0'],
  mall: ['#402a50', '#8b538d', '#db90aa', '#ffe8b7'],
  waterpark: ['#173951', '#287d91', '#7ad1c5', '#fff1b9'],
  forest: ['#193a39', '#396856', '#94ac6d', '#ffde9a'],
};

function plate(id) {
  const sheet = document.createElement('canvas');
  sheet.width = 46;
  sheet.height = 32;
  const g = sheet.getContext('2d'),
    [dark, mid, light, cream] = inks[id];
  const box = (x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  const line = (x, y, tx, ty, c) => {
    const dx = Math.abs(tx - x),
      dy = Math.abs(ty - y),
      sx = x < tx ? 1 : -1,
      sy = y < ty ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      box(x, y, 1, 1, c);
      if (x === tx && y === ty) break;
      const e = 2 * err;
      if (e > -dy) {
        err -= dy;
        x += sx;
      }
      if (e < dx) {
        err += dx;
        y += sy;
      }
    }
  };
  const poly = (c, ...points) => {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(...points[0]);
    for (const p of points.slice(1)) g.lineTo(...p);
    g.closePath();
    g.fill();
  };
  box(0, 0, 46, 32, dark);
  switch (id) {
    case 'yellow': {
      // A turn in the wallpapered maze, with the lights shrinking into the corner.
      box(0, 0, 46, 32, mid);
      poly(light, [0, 0], [15, 5], [15, 23], [0, 30]);
      poly(light, [46, 0], [29, 8], [29, 21], [46, 28]);
      poly(dark, [0, 32], [20, 20], [27, 20], [46, 30], [46, 32]);
      for (let i = 1; i < 15; i += 4) line(i, Math.floor(i / 3), i, 27 - Math.floor(i / 3), mid);
      box(20, 10, 7, 11, dark);
      box(21, 11, 4, 9, light);
      box(22, 13, 3, 7, dark);
      box(14, 1, 16, 2, cream);
      box(19, 5, 8, 1, cream);
      box(21, 8, 4, 1, cream);
      line(0, 31, 19, 20, cream);
      line(45, 29, 28, 21, light);
      break;
    }
    case 'archive': {
      // A bank of index drawers with enamel label holders. One drawer has been left out.
      box(0, 4, 41, 26, mid);
      for (let x = 2; x < 40; x += 13)
        for (let y = 6; y < 29; y += 8) {
          box(x, y, 12, 7, dark);
          box(x, y, 11, 6, light);
          box(x + 2, y + 1, 7, 2, cream);
          box(x + 4, y + 4, 4, 1, dark);
        }
      poly(dark, [27, 15], [38, 15], [44, 20], [44, 25], [32, 25], [27, 21]);
      poly(cream, [28, 15], [37, 15], [42, 20], [33, 20]);
      box(32, 20, 12, 5, mid);
      box(35, 21, 5, 1, cream);
      break;
    }
    case 'night': {
      // Office tower, one window still burning under the moon.
      box(30, 2, 8, 8, cream);
      box(28, 4, 11, 4, cream);
      box(34, 1, 7, 6, dark);
      for (const [x, y] of [
        [3, 3],
        [13, 5],
        [23, 2],
        [42, 12],
      ])
        box(x, y, 1, 1, light);
      box(0, 19, 10, 13, mid);
      box(9, 11, 18, 21, mid);
      box(10, 10, 16, 1, light);
      box(12, 8, 10, 2, mid);
      box(16, 6, 1, 3, light);
      box(29, 20, 17, 12, mid);
      for (let x = 11; x < 25; x += 4) for (let y = 14; y < 29; y += 5) box(x, y, 2, 2, dark);
      box(19, 19, 3, 3, cream);
      box(18, 22, 5, 1, light);
      line(0, 31, 45, 31, dark);
      break;
    }
    case 'fitout': {
      // A crane with a load dangling over unfinished steelwork.
      box(0, 23, 13, 9, mid);
      box(1, 19, 2, 5, light);
      box(10, 16, 2, 8, light);
      box(18, 6, 5, 25, mid);
      box(18, 6, 1, 25, cream);
      box(22, 6, 1, 25, light);
      for (let y = 8; y < 29; y += 5) line(19, y, 21, y + 3, light);
      line(5, 7, 19, 1, light);
      line(19, 1, 39, 7, light);
      box(3, 7, 39, 3, light);
      box(4, 9, 36, 1, mid);
      box(7, 10, 6, 3, mid);
      box(35, 10, 1, 9, cream);
      line(30, 22, 35, 18, light);
      line(40, 22, 35, 18, light);
      box(28, 22, 15, 3, cream);
      box(0, 30, 46, 2, mid);
      break;
    }
    case 'exec': {
      // High-backed leather chair under the brass strip of a boardroom lamp.
      box(0, 0, 46, 32, mid);
      for (let x = 1; x < 46; x += 7) box(x, 0, 1, 32, dark);
      box(9, 2, 27, 2, cream);
      box(11, 4, 23, 1, light);
      box(16, 8, 14, 13, dark);
      box(17, 7, 12, 1, dark);
      box(18, 9, 10, 9, light);
      box(19, 10, 8, 8, mid);
      box(20, 12, 1, 1, cream);
      box(25, 12, 1, 1, cream);
      box(13, 17, 3, 7, dark);
      box(30, 17, 3, 7, dark);
      box(16, 21, 15, 4, dark);
      box(16, 21, 15, 1, cream);
      box(22, 25, 2, 4, dark);
      line(23, 28, 15, 30, dark);
      line(23, 28, 31, 30, dark);
      break;
    }
    case 'suburb': {
      // A rooftop dwarfed by the telephone pole and its sagging wires.
      box(0, 0, 46, 32, light);
      box(1, 27, 44, 5, mid);
      box(3, 21, 17, 9, cream);
      poly(dark, [0, 22], [11, 13], [23, 22]);
      box(15, 12, 3, 5, dark);
      box(6, 23, 3, 3, mid);
      box(13, 22, 4, 8, mid);
      box(29, 5, 3, 27, dark);
      box(24, 7, 13, 2, dark);
      box(26, 5, 2, 3, mid);
      box(34, 5, 2, 3, mid);
      line(0, 3, 14, 9, mid);
      line(14, 9, 26, 7, dark);
      line(34, 7, 42, 10, dark);
      line(42, 10, 45, 10, dark);
      line(0, 7, 14, 13, mid);
      line(14, 13, 30, 11, dark);
      break;
    }
    case 'mall': {
      // Escalator with two reflecting handrails below the atrium skylight.
      box(0, 0, 46, 32, mid);
      for (let x = -4; x < 46; x += 10) {
        line(x, 0, x + 4, 5, light);
        box(x + 4, 6, 1, 8, dark);
      }
      box(0, 5, 46, 1, cream);
      box(0, 14, 46, 2, dark);
      poly(dark, [0, 25], [11, 25], [29, 10], [45, 10], [45, 17], [32, 17], [14, 32], [0, 32]);
      for (let i = 0; i < 9; i++) box(12 + i * 2, 25 - i * 2, 3, 1, cream);
      line(1, 23, 10, 23, light);
      line(10, 23, 29, 7, cream);
      box(29, 7, 16, 1, cream);
      line(14, 30, 33, 14, light);
      box(33, 14, 12, 1, light);
      break;
    }
    case 'waterpark': {
      // A waterslide curls out of an upper doorway and discharges at the pool.
      box(1, 1, 12, 8, mid);
      box(3, 2, 8, 5, dark);
      const flume = [
        [6, 3],
        [16, 3],
        [22, 6],
        [22, 10],
        [18, 13],
        [13, 13],
        [10, 16],
        [12, 19],
        [24, 20],
        [30, 17],
        [35, 17],
        [40, 22],
      ];
      for (let i = 1; i < flume.length; i++)
        for (let y = 0; y < 4; y++)
          line(
            flume[i - 1][0],
            flume[i - 1][1] + y,
            flume[i][0],
            flume[i][1] + y,
            y === 0 ? cream : y === 3 ? mid : light,
          );
      box(19, 16, 2, 4, mid);
      box(32, 21, 2, 6, mid);
      box(0, 27, 46, 5, mid);
      for (const [x, y] of [
        [1, 29],
        [12, 28],
        [22, 30],
        [37, 28],
      ])
        box(x, y, 6, 1, cream);
      line(40, 26, 42, 29, light);
      break;
    }
    case 'forest': {
      // The office exit door gives a square of tungsten light between the pines.
      box(0, 0, 46, 32, mid);
      const pine = (x, y, w, h, color) => {
        for (let i = 0; i < 3; i++) {
          const half = Math.round((w * (i + 2)) / 8),
            top = y + Math.round((i * h) / 5);
          poly(color, [x, top], [x + half + 1, top + Math.ceil(h * 0.47)], [x - half, top + Math.ceil(h * 0.47)]);
        }
        box(x - 1, y + h - 4, 3, 5, color);
      };
      pine(11, 1, 18, 28, dark);
      pine(39, 5, 17, 24, dark);
      pine(1, 6, 17, 25, light);
      box(21, 12, 10, 17, dark);
      box(22, 13, 8, 15, cream);
      box(24, 15, 5, 13, light);
      box(27, 22, 1, 1, dark);
      poly(light, [21, 29], [30, 29], [35, 32], [14, 32]);
      break;
    }
  }
  return sheet;
}

const cache = new Map();
export function floorStamp(id) {
  if (!cache.has(id)) cache.set(id, plate(id));
  return cache.get(id);
}
