// Rubber dies, drawn in one ink. Interior openings are cut through to the card stock.
const dies = {
  yellow: {
    // The door stands ajar on a second doorway.
    face: 'M15 34V10h20v24h-3V13H18v21z M19 15l9-3v23l-9-3z M25 22v3l2-1v-3z',
    angle: -7,
  },
  archive: {
    // File cabinet with two enamel label pulls.
    face: 'M15 10h21v24H15z M18 13v7h15v-7z M18 23v8h15v-8z M22 14h7v2h-7z M22 24h7v2h-7z',
    angle: 4,
  },
  night: {
    // The lit window beside a crescent.
    face: 'M29 9a12 12 0 1 0 5 20A13 13 0 0 1 29 9z M30 15h3v4h-3z M35 15h3v4h-3z M30 21h3v4h-3z M35 21h3v4h-3z',
    angle: -4,
  },
  fitout: {
    // Striped barricade on folding legs.
    face: 'M11 16h29v10H11z M15 18l-2 5h4l3-5z M25 18l-3 5h4l3-5z M34 18l-3 5h4l3-5z M16 26h4l-2 7h-4z M32 26h4l2 7h-4z',
    angle: 6,
  },
  exec: {
    // The top floor's attaché case, with its handle and brass latch cut out.
    face: 'M20 15v-4q0-2 2-2h8q2 0 2 2v4h5q2 0 2 2v13q0 2-2 2H14q-2 0-2-2V17q0-2 2-2z M23 12v3h6v-3z M15 19v2l8 2v2h5v-2l8-2v-2l-9 2h-3z',
    angle: -3,
  },
  suburb: {
    face: 'M11 27l8-8 9 8h-3v6h-4v-5h-4v5h-4v-6z M30 10h3v24h-3z M26 14h11v2H26z',
    line: 'M9 11q10 7 19 3m7 0q4 2 7 1',
    angle: 7,
  },
  mall: {
    // The continuous balustrade of an escalator. A little figure rides the diagonal.
    face: 'M11 27h7l12-12h9v5h-7L20 32h-9z M21 22v-4q0-3 3-3t3 3v1z M26 11a2.3 2.3 0 1 1-4.6 0 2.3 2.3 0 1 1 4.6 0z',
    angle: -5,
  },
  waterpark: {
    line: 'M12 12h11c8 0 9 8 2 8h-4c-5 0-5 6 1 6h7c4 0 6-2 8-1 M11 32q3-3 7 0t7 0t7 0t7 0',
    angle: 5,
  },
  forest: {
    // The little door opens through the base of the pine.
    face: 'M25 7l8 11h-4l7 8h-5l6 6H14l6-6h-5l7-8h-4z M23 26v6h5v-6z',
    angle: -4,
  },
};

const pads = new Map();
export function floorStamp(id) {
  if (pads.has(id)) return pads.get(id);
  const die = dies[id];
  const canvas = document.createElement('canvas');
  canvas.width = 150;
  canvas.height = 132;
  const g = canvas.getContext('2d');
  g.scale(3, 3);
  g.translate(25, 22);
  g.rotate(die.angle * Math.PI / 180);
  g.translate(-25, -22);
  g.fillStyle = g.strokeStyle = '#594471';
  g.lineJoin = g.lineCap = 'round';
  g.lineWidth = 1.65;
  g.beginPath();
  g.ellipse(25, 22, 21.8, 17.2, 0, 0, 2 * Math.PI);
  g.stroke();
  if (die.face) g.fill(new Path2D(die.face), 'evenodd');
  if (die.line) {
    g.lineWidth = id === 'suburb' ? 1.4 : 2.7;
    g.stroke(new Path2D(die.line));
  }

  // A few pinholes and a dry edge break the impression. Keep the impression stable on every reprint.
  g.globalCompositeOperation = 'destination-out';
  let state = id.charCodeAt(0) + id.length * 97;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = 0; i < 185; i++) {
    g.globalAlpha = 0.4 + random() * 0.5;
    g.fillRect(3 + random() * 44, 4 + random() * 36, 0.25 + random() * 0.75, 0.25 + random() * 0.5);
  }
  pads.set(id, canvas);
  return canvas;
}
