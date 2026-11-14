// The Backrooms — the rooms, part three: scenes somebody clearly went to some
// trouble over. Nothing here is explained; the signs and the furniture do
// the talking. Same contract as rooms.js.
import * as THREE from 'three';
import { Batch, lin, WHITE } from './kit.js';
import { card } from './bits.js';
import { cutoutArt } from './cutout.js';
import { MORE3 } from './rooms4.js';

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
}

export const MORE2 = { lift, ...MORE3 };
