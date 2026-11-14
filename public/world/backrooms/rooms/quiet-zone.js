// The Backrooms — the Deep Work Zone ("the soundproof room") (after Gemini's Wave 2, brought onto the room contract:
// its line in the deck is in deck2.js, and this file is the whole of it).
// Acoustic wedges on every wall, one hot-desk, and a decibel meter that minds how fast you move.
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { Batch, lin, drawText, smooth, WHITE } from '../kit.js';
import { P, clamp, card } from '../bits.js';

const tentVox = (color = '#f1ecdc') => () => {
  const v = new Vox(), paper = M(color, 0), ink = M('#2a2a30', 0);
  for (let y = 0; y < 4; y++) {
    v.box(-4, y, -3 + y, 4, y + 1, -2 + y, paper);
    v.box(-4, y, 2 - y, 4, y + 1, 3 - y, paper);
  }
  v.box(-3, 2, -2, 3, 3, -1, ink);
  v.box(-3, 2, 1, 3, 3, 2, ink);
  return v;
};

/** Acoustic wedges on every wall, one hot-desk, and a decibel meter that shuts the doors when you rush. */
export function build(c) {
  const { W, D, H, R, params: p, kit } = c;
  c.shell({ sockets: false });
  c.rt.noTorch = true;
  c.rt.footstep = 'shuffle';

  const base = lin(p.foam), ridgeA = base.map((v) => Math.min(1, v * 1.32 + 0.012)), ridgeB = base.map((v) => v * 0.78);
  const frameCol = [0.11, 0.12, 0.14], warm = lin('#ffd59a');

  // place the live LED decibel meter centred on the back wall whenever free, recessed into the charcoal foam
  const backSpans = c.spans('back', 0.35, 2.2);
  const backMid = backSpans.find(([a, b]) => a <= -1.1 && b >= 1.1);
  const meterSpot = backMid ? { side: 'back', at: 0 } : (c.wallSpot(2.2, ['back', 'left', 'right'], 0.35, 2.2) || c.wallSpot(1.8, undefined, 0.3, 2.1));
  const mw = 1.84, mh = mw * (84 / 256), my = 1.66;

  // charcoal acoustic studio wedges tiled across every wall stretch (recessed flat behind the LED meter)
  for (const side of ['back', 'left', 'right', 'front']) {
    for (const [a, b] of c.spans(side, 0.22, 2.15)) {
      const len = b - a, cols = Math.max(1, Math.floor(len / 0.56)), cw = len / cols;
      c.wbox(side, (a + b) / 2, len - 0.04, 0.2, 2.26, 0.006, 0.032, ridgeB);
      for (let i = 0; i < cols; i++) {
        const u = a + (i + 0.5) * cw;
        for (let row = 0; row < 4; row++) {
          const y0 = 0.24 + row * 0.5, y1 = y0 + 0.46, horiz = (i + row) % 2 === 0;
          if (meterSpot && side === meterSpot.side && Math.abs(u - meterSpot.at) < mw / 2 + cw * 0.5 + 0.06 && y1 > my - mh / 2 - 0.08 && y0 < my + mh / 2 + 0.08) continue;
          if (horiz) {
            for (let k = 0; k < 3; k++) {
              const sy = y0 + k * 0.15;
              c.wbox(side, u, cw - 0.05, sy, sy + 0.09, 0.032, 0.078, ridgeA);
              c.wbox(side, u, cw - 0.05, sy + 0.09, sy + 0.14, 0.032, 0.052, base);
            }
          } else {
            const sw = (cw - 0.06) / 3;
            for (let k = 0; k < 3; k++) {
              const su = u - (cw - 0.06) / 2 + (k + 0.5) * sw;
              c.wbox(side, su - sw * 0.15, sw * 0.58, y0, y1, 0.032, 0.078, ridgeA);
              c.wbox(side, su + sw * 0.25, sw * 0.34, y0, y1, 0.032, 0.05, base);
            }
          }
        }
      }
    }
  }

  // hushed studio sconces in the four corners so the foam edges catch warm directional light
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * (W / 2 - 0.55), lz = sz * (D / 2 - 0.55);
    c.flat.box(lx - 0.09, 2.02, lz - 0.09, lx + 0.09, 2.1, lz + 0.09, frameCol);
    c.shining('sconce', kit.tex.white(), 1.8, warm).box(lx - 0.06, 1.98, lz - 0.06, lx + 0.06, 2.02, lz + 0.06, WHITE, { skip: '+y' });
    c.light(lx, 1.9, lz, '#ffd59a', 0.42, { k: 2.2, far: 5.8, wrap: 0.45 });
  }

  // the lone hot-desk in the middle of the pod
  const dz = -0.15, oak = lin('#8a6b48'), leg = [0.16, 0.17, 0.19];
  c.reserve(0, dz, 1.15);
  c.flat.box(-0.72, 0.72, dz - 0.38, 0.72, 0.76, dz + 0.38, oak);
  for (const [lx, lz] of [[-0.64, dz - 0.3], [0.64, dz - 0.3], [-0.64, dz + 0.3], [0.64, dz + 0.3]]) {
    c.flat.box(lx - 0.025, 0, lz - 0.025, lx + 0.025, 0.72, lz + 0.025, leg, { skip: '-y' });
  }
  c.solid(-0.72, dz - 0.38, 0.72, dz + 0.38, { tall: false });
  c.shadow(0, dz, 1.44, 0.76, 0.48);
  c.prop('chair', 0, dz + 0.62, { rot: Math.PI + R.range(-0.14, 0.14), o: { color: p.chair } });
  c.model('quiet-tent', tentVox(), -0.34, dz - 0.1, { y: 0.76, rot: 0.18, solid: false, shadow: false });
  const deskNote = card(c, 'qcard:' + p.deskCard, [p.deskCard], { w: 192, h: 36, bg: '#f1ecdc', fg: '#1d1c18', edge: '#b5aa90', size: 11, pad: 8 });
  c.lay(c.mapped('qcard:' + c.room.id, deskNote), 0.2, dz + 0.06, 0.48, 0.09, -0.05, null, WHITE, 0.764);

  // the live wall-mounted LED decibel meter
  const meterTex = kit.tex.live(256, 84, () => {}, { clamp: true });
  const mg = meterTex.image.getContext('2d');
  let lastShown = -999, lastState = -1;
  const drawMeter = (db, state) => {
    const shown = Math.round(db);
    if (shown === lastShown && state === lastState) return;
    lastShown = shown; lastState = state;
    P(mg, '#111317', 0, 0, 256, 84);
    P(mg, state === 2 ? '#8a221c' : '#262b33', 2, 2, 252, 80);
    P(mg, '#0b0d10', 5, 5, 246, 74);
    drawText(mg, [p.header], 0, 7, 256, 17, { color: '#d8dee8', size: 12, pad: 12 });
    const bars = 20, litBars = clamp(Math.round(((db - 20) / 60) * bars), 1, bars);
    for (let i = 0; i < bars; i++) {
      const col = i < 11 ? '#3ddc78' : i < 15 ? '#f0b23a' : '#eb3b30';
      const dim = i < 11 ? '#12291c' : i < 15 ? '#2b2210' : '#2d1212';
      P(mg, i < litBars ? col : dim, 14 + i * 11.5, 29, 9, 24);
    }
    const status = state === 2 ? `${shown} dB  ·  NOISE VIOLATION  ·  SEALED`
      : state === 1 ? `${shown} dB  ·  SETTLING…  ·  LIMIT ${p.limit} dB`
      : `${shown} dB  ·  COMPLIANT  ·  LIMIT ${p.limit} dB`;
    const col = state === 2 ? '#ff6a5e' : state === 1 ? '#f5c258' : '#6be898';
    drawText(mg, [status], 0, 56, 256, 18, { color: col, size: 10, pad: 10 });
    meterTex.needsUpdate = true;
  };
  drawMeter(26, 0);

  if (meterSpot) {
    c.keepWall(meterSpot.side, meterSpot.at - mw / 2 - 0.1, meterSpot.at + mw / 2 + 0.1);
    c.wbox(meterSpot.side, meterSpot.at, mw + 0.1, my - mh / 2 - 0.05, my + mh / 2 + 0.05, 0, 0.048, frameCol);
    c.hang(c.shining('qmeter:' + c.room.id, meterTex, 1.35), meterSpot.side, meterSpot.at, my, mw, mh, null, WHITE, 0.052);
    const mp = c.wallAt(meterSpot.side, meterSpot.at, 0.25);
    c.light(mp.x, my, mp.z, '#6be898', 0.25, { k: 1.1, far: 3.6 });
  }

  // motorized acoustic isolation shutters tucked above each doorway: open at rest so every path builds free
  const warnTex = card(c, 'qshut', ['QUIET PLEASE', 'POD SEALED'], { w: 128, h: 44, bg: '#20232a', fg: '#f2c318', edge: '#f2c318', size: 13, pad: 8 });
  const shutters = c.room.doors.map((dr) => {
    const w = dr.w + 0.08, h = dr.h + 0.04;
    // overhead lintel cassette housing
    c.wbox(dr.side, dr.c, w + 0.12, h, Math.min(H - 0.04, h + 0.22), 0, 0.11, frameCol);
    const slab = new Batch(), labelB = new Batch();
    c.wbox(dr.side, dr.c, w, 0.02, h, 0.018, 0.072, base, { batch: slab });
    c.wbox(dr.side, dr.c, w, 0.02, 0.11, 0.015, 0.08, lin('#d9a81e'), { batch: slab });
    for (let k = 0; k < 4; k++) {
      const y0 = 0.22 + k * 0.42;
      if (y0 + 0.28 < h) c.wbox(dr.side, dr.c, w - 0.1, y0, y0 + 0.24, 0.072, 0.095, ridgeA, { batch: slab });
    }
    c.hang(labelB, dr.side, dr.c, Math.min(1.32, h * 0.64), Math.min(0.68, w * 0.62), 0.22, null, WHITE, 0.1);
    const p0 = c.wallAt(dr.side, dr.c, 0.04), pivot = [p0.x, h, p0.z];
    const holder = c.dynamic(slab, { pivot });
    c.after.push(() => {
      const geo = kit.geometry(labelB, c.rt.lights, c.rt.amb);
      if (!geo) return;
      const m = new THREE.Mesh(geo, kit.surface({ map: warnTex, room: c.rt.u, flick: geo.userData.flick }));
      m.position.set(-pivot[0], -pivot[1], -pivot[2]);
      holder.add(m);
    });
    holder.position.y = pivot[1];
    holder.scale.y = 0.02;                     // rolled tight inside the lintel cassette until tripped!
    const a = c.wallAt(dr.side, dr.c - w / 2, 0.01), b = c.wallAt(dr.side, dr.c + w / 2, 0.14);
    const col = c.solid(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), { tall: true, on: false });
    return { holder, col, dr };
  });

  let db = 26, sealed = false, calm = 0, shut = 0;
  c.rt.onLeave = () => {
    sealed = false; calm = 0; shut = 0;
    for (const s of shutters) { s.col.on = false; s.holder.scale.y = 0.02; }
    drawMeter(26, 0);
  };

  c.tick((dt, t, me) => {
    if (!me.inside) {
      if (shut > 0) {
        shut = Math.max(0, shut - dt * 3);
        for (const s of shutters) { s.col.on = false; s.holder.scale.y = 0.02 + 0.98 * smooth(shut); }
      }
      return;
    }
    const rushing = me.speed > 2.32 || me.world.drop > 0.06;
    const target = rushing ? 76 + Math.sin(t * 17) * 4 : me.moving ? 29 + (me.speed / 2.32) * (p.limit - 31) : 24 + Math.sin(t * 2.1) * 1.2;
    db += (target - db) * (1 - Math.exp(-(rushing ? 11 : 3.4) * dt));

    // only seal once the visitor is clear of every doorway throat so no shutter ever pins them in a wall
    const nearDoor = c.room.doors.some((dr) => { const dp = c.doorPoint(dr, 0.15); return Math.hypot(me.x - dp.x, me.z - dp.z) < 0.65; });
    if (!sealed && db > p.limit + 12 && !nearDoor) {
      sealed = true; calm = 0;
      c.env.sound.play('beep', { freq: 620, vol: 0.9 });
      c.env.sound.play('slide', { vol: 0.85 });
      for (const s of shutters) s.col.on = true;
    } else if (sealed) {
      if (!rushing && db <= p.limit + 2) {
        calm += dt;
        if (calm >= 1.15) {
          sealed = false; calm = 0;
          c.env.sound.play('ding', { vol: 0.7 });
          c.env.sound.play('slide', { vol: 0.6 });
          for (const s of shutters) s.col.on = false;
        }
      } else calm = 0;
    }

    const want = sealed ? 1 : 0;
    if (Math.abs(shut - want) > 1e-4) {
      shut += Math.sign(want - shut) * Math.min(Math.abs(want - shut), dt / (sealed ? 0.34 : 0.55));
      const k = 0.02 + 0.98 * smooth(shut);
      for (const s of shutters) s.holder.scale.y = k;
    }
    drawMeter(db, sealed ? (calm > 0.15 ? 1 : 2) : 0);
  });
}
