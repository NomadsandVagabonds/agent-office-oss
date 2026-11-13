// The Backrooms — cardboard people. The office's classic flat pixel characters
// (art/character.js), printed on board with a white border, stood up on a
// fold-out strut. Plain cardboard from behind. Also: the same faces as framed
// portraits.
import * as THREE from 'three';
import { paintFlatCharacter } from '../art/character.js';
import { Batch } from './kit.js';

const PXM = 0.044;                    // metres per sprite pixel: a 30 px figure stands 1.3 m
const S = 6, PAD = 3;                 // canvas pixels per sprite pixel; border, in sprite pixels
const CARD = '#b08a5c', CARD_DARK = '#8f6d45';

function sprite(look, opt) {
  const pix = paintFlatCharacter(look, opt);
  const e = pix.extent() || { x0: -8, y0: -30, x1: 8, y1: 1 };
  return { canvas: pix.toCanvas(S), e, sx: (e.x0 - pix.x0) * S, sy: (e.y0 - pix.y0) * S, sw: (e.x1 - e.x0) * S, sh: (e.y1 - e.y0) * S };
}

/** Front and back textures for one standee, and its size in metres. */
export function cutoutArt(kit, key, look, opt = {}) {
  const sp = sprite(look, { pose: opt.pose || 'idle', creations: opt.creations, blink: opt.blink });
  const w = sp.sw + PAD * 2 * S, h = sp.sh + PAD * S;
  const mask = (g, fill) => {             // the silhouette, fattened into a border, in one colour
    const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    const t = tmp.getContext('2d'); t.imageSmoothingEnabled = false;
    for (let a = 0; a < 16; a++) { const r = PAD * S * 0.72; t.drawImage(sp.canvas, sp.sx, sp.sy, sp.sw, sp.sh, PAD * S + Math.round(Math.cos(a * 0.3927) * r), PAD * S + Math.round(Math.sin(a * 0.3927) * r), sp.sw, sp.sh); }
    t.drawImage(sp.canvas, sp.sx, sp.sy, sp.sw, sp.sh, PAD * S, PAD * S, sp.sw, sp.sh);
    t.fillStyle = '#000'; t.fillRect(PAD * S * 0.6, h - PAD * S, w - PAD * S * 1.2, PAD * S);       // a straight foot to stand on
    t.globalCompositeOperation = 'source-in'; t.fillStyle = fill; t.fillRect(0, 0, w, h);
    g.drawImage(tmp, 0, 0);
  };
  const front = kit.tex.custom(`cut:${key}:f`, w, h, (g) => {
    mask(g, '#efe9d8');
    g.drawImage(sp.canvas, sp.sx, sp.sy, sp.sw, sp.sh, PAD * S, PAD * S, sp.sw, sp.sh);
  }, { clamp: true });
  const back = kit.tex.custom(`cut:${key}:b`, w, h, (g) => {
    g.save(); g.translate(w, 0); g.scale(-1, 1); mask(g, CARD); g.restore();      // seen from behind, the outline is mirrored
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = CARD_DARK;
    g.globalAlpha = 0.35; for (let y = 3; y < h; y += 9) g.fillRect(0, y, w, 1); g.globalAlpha = 1;      // corrugation
    g.fillStyle = '#c9a877'; g.fillRect(w * 0.2, h * 0.34, w * 0.6, S * 2);        // a strip of tape
    g.fillStyle = '#5a4026'; g.font = `700 ${S * 2}px ui-monospace, Menlo, Consolas, monospace`; g.textAlign = 'center';
    g.fillText('THIS SIDE', w / 2, h * 0.56); g.fillText('BACK', w / 2, h * 0.56 + S * 2.6);
  }, { clamp: true });
  return { front, back, w: (w / S) * PXM, h: (h / S) * PXM };
}

/**
 * A standee that can be moved about: a group at floor level facing +z.
 * `light(rgb)` sets how brightly it is lit where it now stands.
 */
export function makeCutout(kit, key, look, opt = {}) {
  const art = cutoutArt(kit, key, look, opt);
  const { w, h } = art;
  const face = new Batch(), rear = new Batch(), card = new Batch();
  face.quad([-w / 2, 0, 0.004], [w / 2, 0, 0.004], [w / 2, h, 0.004], [-w / 2, h, 0.004]);
  rear.quad([w / 2, 0, -0.004], [-w / 2, 0, -0.004], [-w / 2, h, -0.004], [w / 2, h, -0.004]);
  // the strut: a strip of board folded out behind, and the foot it ends in
  const brown = [0.3, 0.21, 0.11], top = h * 0.6, reach = 0.3, sw = 0.09;
  card.quad([-sw, top, -0.006], [sw, top, -0.006], [sw, 0, -reach], [-sw, 0, -reach], brown);
  card.quad([sw, top, -0.006], [-sw, top, -0.006], [-sw, 0, -reach], [sw, 0, -reach], brown);
  card.box(-0.16, 0, -reach - 0.03, 0.16, 0.012, -reach + 0.05, brown, { skip: '-y' });
  const group = new THREE.Group(), mats = [];
  const add = (batch, map, cutout) => {
    const m = kit.surface({ map, cutout });
    mats.push(m);
    group.add(new THREE.Mesh(kit.geometry(batch, [], [1.25, 1.25, 1.25]), m));      // lit flat; the room's light arrives as a tint
  };
  add(face, art.front, true); add(rear, art.back, true); add(card, kit.tex.white(), false);
  group.userData.light = (rgb) => { for (const m of mats) m.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); };
  group.userData.size = { w, h };
  return group;
}

/** Head and shoulders, drawn into a w×h box of a canvas: for frames, badges and monitors. */
export function drawPortrait(g, look, x, y, w, h, opt = {}) {
  const pix = paintFlatCharacter(look, { blink: opt.blink, creations: opt.creations, back: opt.back });
  const src = pix.toCanvas(2);
  g.imageSmoothingEnabled = false;
  if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(x, y, w, h); }
  // sprite pixel (−13, −40) … (13, −14) is the head and shoulders
  g.drawImage(src, (-13 - pix.x0) * 2, (-40 - pix.y0) * 2, 52, 52, x, y, w, h);
}
