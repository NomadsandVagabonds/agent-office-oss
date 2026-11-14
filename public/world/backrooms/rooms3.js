// The Backrooms — the rooms, part three: scenes somebody clearly went to some
// trouble over. Nothing here is explained; the signs and the furniture do
// the talking. Same contract as rooms.js.
import * as THREE from 'three';
import { Batch, lin, atlas, drawText, WHITE } from './kit.js';
import { P, card, framed, standee } from './bits.js';
import { cutoutArt } from './cutout.js';

const wrap = (text, width) => { const out = ['']; for (const word of String(text).split(/\s+/)) { if ((out[out.length - 1] + ' ' + word).trim().length > width && out[out.length - 1]) out.push(word); else out[out.length - 1] = (out[out.length - 1] + ' ' + word).trim(); } return out; };

/** A planning board the size of a wall. Every card on it is the same card. */
function kanban(c) {
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

/** A lift lobby. The doors open. */
function lift(c) {
  const { W, D, R, params: p } = c, kit = c.kit;
  c.shell({ sockets: false });
  const steel = lin(p.doors), dark = steel.map((v) => v * 0.55), OW = 1.5, OH = 2.02;
  // the surround: three slabs of brushed steel with a hole in the middle
  c.wbox('back', -(OW / 2 + 0.45), 0.9, 0, OH + 0.34, 0, 0.11, steel);
  c.wbox('back', OW / 2 + 0.45, 0.9, 0, OH + 0.34, 0, 0.11, steel);
  c.wbox('back', 0, OW, OH, OH + 0.34, 0, 0.11, steel);
  c.wbox('back', 0, OW, 0, 0.02, 0, 0.11, dark);
  // what is behind the doors
  c.hang(c.mapped('brick', kit.tex.brick()), 'back', 0, OH / 2, OW, OH, [[0, 0], [OW / 1.0, 0], [OW / 1.0, OH / 1.0], [0, OH / 1.0]], WHITE, 0.012);
  const who = c.env.cast[p.who % Math.max(1, c.env.cast.length)];
  const extras = {};
  if (who) {
    const art = cutoutArt(kit, 'lift:' + who.name, who.look, { creations: c.env.who.creations, name: who.name }), b = new Batch();
    c.hang(b, 'back', 0, art.h / 2, art.w, art.h, null, WHITE, 0.02);
    extras.cutout = c.dynamic(b, { map: art.front, cutout: true });
  }
  { const tex = card(c, 'liftposter', ['OUT OF ORDER', 'PLEASE USE', 'THE OTHER LIFT'], { w: 96, h: 64, bg: '#f4f1e6', fg: '#b5281c', size: 12, pad: 10 }), b = new Batch();
    c.hang(b, 'back', 0, 1.25, 0.75, 0.5, null, WHITE, 0.02);
    extras.poster = c.dynamic(b, { map: tex }); }
  for (const k of Object.keys(extras)) extras[k].visible = false;
  // the doors themselves: two leaves that slide away behind the surround
  const leaf = (sx) => { const b = new Batch(); c.wbox('back', sx * OW / 4, OW / 2, 0.02, OH, 0.05, 0.075, steel, { batch: b }); c.wbox('back', sx * (OW / 2 - 0.02), 0.012, 0.02, OH, 0.075, 0.08, dark, { batch: b }); c.wbox('back', sx * OW / 4, OW / 2 - 0.16, 0.25, OH - 0.25, 0.075, 0.078, steel.map((v) => v * 0.9), { batch: b }); return c.dynamic(b); };
  const left = leaf(-1), right = leaf(1);
  // the sign, the floor indicator, the button
  c.hang(c.mapped('liftsign', card(c, 'lift' + p.sign, [p.sign], { w: 112, h: 22, bg: '#2a2d34', fg: '#e8e2d0', size: 12 })), 'back', 0, OH + 0.24, 0.9, 0.18, null, WHITE, 0.113);
  const dial = kit.tex.live(48, 24), g = dial.image.getContext('2d');
  const show = (text) => { g.fillStyle = '#120806'; g.fillRect(0, 0, 48, 24); g.fillStyle = '#ff6a2a'; g.font = '700 17px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 24, 13); dial.needsUpdate = true; };
  show(p.floors[0]);
  { const b = new Batch(); c.hang(b, 'back', 0, OH + 0.09, 0.26, 0.13, null, WHITE, 0.113); c.add(new THREE.Mesh(kit.plain(b), kit.glowing(dial, 1.5))); }
  const bx = OW / 2 + 0.3, btn = new Batch();
  c.wbox('back', bx, 0.12, 0.92, 1.16, 0.11, 0.118, dark);
  c.hang(btn, 'back', bx, 1.04, 0.05, 0.05, null, WHITE, 0.12);
  const light = c.add(new THREE.Mesh(kit.plain(btn), kit.glowing(kit.tex.white(), 1, [0.45, 0.4, 0.3])));
  const lit = new THREE.Color().setRGB(2.2, 1.5, 0.5), unlit = light.material.color.clone();
  if (c.clear(-W / 2 + 0.6, -D / 2 + 0.5, 0.4)) c.prop('planttall', -W / 2 + 0.6, -D / 2 + 0.5, { o: { variant: 1 } });
  if (c.clear(W / 2 - 0.6, -D / 2 + 0.5, 0.35)) c.prop('bin', W / 2 - 0.6, -D / 2 + 0.5, {});
  c.prop('doormat', 0, -D / 2 + 0.75, { solid: false, shadow: false, fallback: [0.9, 0.02, 0.5] });
  // press the button: it thinks about floors, it arrives, it opens, and there you are
  let phase = 'idle', t0 = 0, visit = 0, open = 0;
  const here = c.toWorld(0, -D / 2 + 0.3);
  c.use({ x: bx, z: -D / 2 + 0.4, r: 1.5, label: 'call the lift', when: () => phase === 'idle', use: () => { phase = 'coming'; t0 = 0; light.material.color.copy(lit); c.env.play('click', here.x, here.z, 5); } });
  c.tick((dt) => {
    if (phase === 'idle') return;
    t0 += dt;
    if (phase === 'coming') {
      const i = Math.floor(t0 / 0.42);
      if (i < p.floors.length) show(p.floors[i]);
      else { phase = 'opening'; t0 = 0; c.env.play('ding', here.x, here.z, 8); c.env.play('slide', here.x, here.z, 6); const what = p.behind[visit % p.behind.length]; for (const k of Object.keys(extras)) extras[k].visible = k === what; }
    } else if (phase === 'opening') { open = Math.min(1, t0 / 1.1); if (open >= 1) { phase = 'open'; t0 = 0; } }
    else if (phase === 'open') { if (t0 > 4) { phase = 'closing'; t0 = 0; c.env.play('slide', here.x, here.z, 6); } }
    else if (phase === 'closing') { open = Math.max(0, 1 - t0 / 1.1); if (open <= 0) { phase = 'idle'; visit++; light.material.color.copy(unlit); show(p.floors[(visit * 3) % p.floors.length]); } }
    const k = open * open * (3 - 2 * open) * (OW / 2 - 0.03);
    left.position.x = -k; right.position.x = k;
  });
  void R; void framed; void standee;
}

export const MORE2 = { kanban, lift };
