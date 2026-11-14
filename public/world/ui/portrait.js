// The Office — somebody's photo: head and shoulders from their 2D likeness,
// for the card that says who they are and the slip that says what they want.
import { h } from './dom.js';
import { paintFlatCharacter } from '../art/character.js';

export function mugshot(look, cls = 'mug') {
  const canvas = h(`canvas.${cls}`, { width: 52, height: 52 });
  try {
    const sprite = paintFlatCharacter(look || {}, {}).toCanvas(2);       // x −16..16, y −62..2 → 64 × 128
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(sprite, 6, 44, 52, 52, 0, 0, 52, 52);
  } catch { /* a blank photo is fine */ }
  return canvas;
}
