// The Backrooms — a room in a file of its own: The Board ("the board with one
// card"). It is also the worked example for docs/BACKROOMS.md, "Adding a
// room": read it beside that section. Everything a room is lives in two places —
//
//   its line in the deck (gen.js, or deck2.js for rooms written since), which is
//   pure data: how big it may be, which walls may take another doorway, what it
//   rolls from the seed (`roll` → c.params), where a tape may hide in it
//   (`stash`), and `module`, the path to this file;
//
//   and this file, which exports build(c). `c` is the toolbox (world.js,
//   roomContext): everything is in the room's own frame, metres, x across and
//   z deep, the door you came in by at z = +D/2 and the far wall at z = −D/2.
//
// The file is only fetched when a floor has the room on it. What it draws is
// decided by c.params and c.R (seeded) and by nothing else: the same seed is
// the same room. Math.random is for what happens later, while somebody is in it.
import * as THREE from 'three';
import { lin, atlas, drawText, WHITE } from '../kit.js';
import { P } from '../bits.js';

const wrap = (text, width) => { const out = ['']; for (const word of String(text).split(/\s+/)) { if ((out[out.length - 1] + ' ' + word).trim().length > width && out[out.length - 1]) out.push(word); else out[out.length - 1] = (out[out.length - 1] + ' ' + word).trim(); } return out; };

/** A planning board the size of a wall. Every card on it is the same card. */
export function build(c) {
  const { W, D, H, R, params: p } = c, kit = c.kit;
  c.shell();
  const bw = W - 1.4, y0 = 0.5, y1 = 2.2, colW = bw / 4, N = 0.25;
  c.wbox('back', 0, bw + 0.12, y0 - 0.06, y1 + 0.3, 0, 0.02, [0.3, 0.3, 0.32]);
  c.wbox('back', 0, bw, y0, y1 + 0.24, 0.02, 0.028, [0.93, 0.93, 0.9]);
  for (let i = 1; i < 4; i++) c.wbox('back', -bw / 2 + i * colW, 0.012, y0, y1 + 0.24, 0.028, 0.031, [0.25, 0.25, 0.28]);
  c.wbox('back', 0, bw, y1 - 0.004, y1 + 0.004, 0.028, 0.031, [0.25, 0.25, 0.28]);
  const heads = atlas(kit, 'kanbanhead' + c.room.id, 96, 20, 4, (g, i, w, h) => { P(g, '#edece6', 0, 0, w, h); drawText(g, [p.cols[i]], 0, 0, w, h, { color: '#23262e', size: 12, pad: 6 }); });
  const headB = c.mapped('kanbanhead', heads.texture);
  for (let i = 0; i < 4; i++) c.hang(headB, 'back', -bw / 2 + (i + 0.5) * colW, y1 + 0.12, Math.min(colW - 0.1, 1.1), 0.2, heads.uv(i), WHITE, 0.032);
  // the card
  const lines = wrap(p.text, 11).slice(0, 5);
  const noteTex = p.notes.map((hex) => kit.tex.custom(`note${hex}${p.text}`, 56, 56, (g, w, h) => {
    P(g, hex, 0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h - 3, w, 3); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, 6);
    drawText(g, lines, 2, 6, w - 4, h - 10, { color: '#2a2620', size: lines.length > 3 ? 8 : 10, pad: 4, weight: 600, leading: 1.15 });
  }, { clamp: true }));
  const notes = noteTex.map((tex, i) => c.mapped('note' + i, tex));
  const share = [0.42, 0.3, 0.22, 0.06], per = Math.floor((colW - 0.1) / (N + 0.03)), rowsMax = Math.floor((y1 - y0 - 0.1) / (N + 0.03));
  let k = 0;
  for (let col = 0; col < 4; col++) {
    const n = Math.min(per * rowsMax, Math.max(1, Math.round(p.cards * share[col])));
    for (let i = 0; i < n; i++, k++) {
      const x = -bw / 2 + col * colW + 0.07 + (i % per + 0.5) * ((colW - 0.14) / per) + R.range(-0.012, 0.012), y = y1 - 0.08 - (Math.floor(i / per) + 0.5) * (N + 0.03) + R.range(-0.012, 0.012);
      c.hang(notes[k % notes.length], 'back', x, y, N, N, null, WHITE, 0.033 + (k % 3) * 0.001);
    }
  }
  // …and then they ran out of board
  for (let i = 0; i < p.spill; i++, k++) {
    const b = notes[k % notes.length], where = i % 4;
    if (where === 0) c.lay(b, R.range(-bw / 2, bw / 2), -D / 2 + R.range(0.15, 1.5), N, N, R.range(-0.5, 0.5), null, WHITE, 0.007 + (i % 5) * 0.001);
    else if (where === 1) c.lay(b, R.range(-bw / 2, bw / 2), -D / 2 + R.range(0.15, 1.1), N, N, R.range(-0.4, 0.4), null, WHITE, H - 0.008, true);
    else { const side = where === 2 ? 'left' : 'right', spans = c.spans(side, 0.3).filter(([a]) => a < -D / 2 + 2.2); if (!spans.length) continue; c.hang(b, side, R.range(spans[0][0] + 0.15, Math.min(spans[0][1], -D / 2 + 2.4) - 0.15), R.range(0.4, 2.3), N, N, null, WHITE, 0.012); }
  }
  // a stool, a pad of the same note, a pen
  const tz = -D / 2 + 2.3;
  const top = c.prop(c.hasProp('cafetable') ? 'cafetable' : 'pedestal', 0.9, tz, { fallback: [0.6, 0.8, 0.6] }).top;
  c.flat.box(0.82, top, tz - 0.08, 0.98, top + 0.06, tz + 0.08, lin(p.notes[0]));
  c.flat.box(1.02, top, tz - 0.07, 1.035, top + 0.012, tz + 0.06, [0.1, 0.1, 0.12]);
  c.prop('chair', 0, tz + 0.5, { rot: Math.PI + R.range(-0.2, 0.2), o: { color: '#5a5a66' } });
  // E adds another one. Of course it does.
  let added = 0;
  const noteGeo = kit.own(new THREE.PlaneGeometry(N, N)), mats = noteTex.map((map) => kit.own(new THREE.MeshBasicMaterial({ map })));
  c.after.push(() => { const L = c.sample(0, 0.4, -D / 2 + 0.3, 0, 0, 1); for (const m of mats) m.color.setRGB(L[0], L[1], L[2]); });
  c.use({ x: 0.9, z: tz + 0.4, r: 1.3, label: 'add a card', when: () => added < 36, use: () => {
    const m = new THREE.Mesh(noteGeo, mats[added % mats.length]);
    m.position.set(-bw / 2 + 0.1 + (added % 12) * ((bw - 0.2) / 11), y0 - 0.2 - Math.floor(added / 12) * 0.13 + Math.random() * 0.03, -D / 2 + 0.036 + added * 0.0004);
    m.rotation.z = (Math.random() - 0.5) * 0.3;
    c.add(m); added++;
    c.env.sound.play('rustle');
  } });
}
