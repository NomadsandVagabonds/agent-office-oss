// The Backrooms — the rooms, part six: a focus pod that seals itself against
// hurry, and a pneumatic mail exchange whose canisters rattle overhead along
// whichever pipe leads toward the stairs.
import * as THREE from 'three';
import { Vox, M } from '../vox/vox.js';
import { Batch, lin, drawText, smooth, WHITE } from './kit.js';
import { roomDistances } from './gen.js';
import { P, clamp, card, framed } from './bits.js';

/* ---- the deep work zone --------------------------------------------------------------- */

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
function quietZone(c) {
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

/* ---- the pneumatic mailroom ----------------------------------------------------------- */

const canisterVox = (band = '#b5342c') => () => {
  const v = new Vox(), brass = M('#d4a74a', 0), tube = M('#e4decb', 0), cap = M('#3a352e', 0), stripe = M(band, 0);
  v.cyl('y', 0, 0, 0, 2, 2.0, brass);
  v.cyl('y', 0, 2, 0, 8, 1.8, tube);
  v.cyl('y', 0, 4, 0, 6, 1.95, stripe);
  v.cyl('y', 0, 8, 0, 10, 2.0, brass);
  v.cyl('y', 0, 10, 0, 11, 1.1, cap);
  return v;
};

/** Brass tubes across the ceiling to every doorway; feed a canister into the breech and listen to which pipe takes it. */
function mailroom(c) {
  const { H, R, params: p, kit } = c;
  c.shell();

  const brass = lin(p.brass), darkBrass = brass.map((v) => v * 0.62), enamel = lin('#243830'), dark = [0.13, 0.13, 0.15];
  const glassTint = lin('#d8efe8');

  // wall-mounted pigeonhole sorting rack for incoming / undeliverable canisters
  const rackSpot = c.wallSpot(2.1, ['back', 'left', 'right'], 0.4, 2.25);
  if (rackSpot) {
    const rw = 1.92, ry0 = 0.78, ry1 = 1.92;
    c.keepWall(rackSpot.side, rackSpot.at - rw / 2 - 0.1, rackSpot.at + rw / 2 + 0.1);
    c.wbox(rackSpot.side, rackSpot.at, rw, ry0, ry1, 0, 0.28, enamel);
    c.wbox(rackSpot.side, rackSpot.at, rw + 0.06, ry1, ry1 + 0.05, 0, 0.31, brass);
    c.wbox(rackSpot.side, rackSpot.at, rw + 0.06, ry0 - 0.04, ry0, 0, 0.31, brass);
    for (let i = 1; i < 3; i++) c.wbox(rackSpot.side, rackSpot.at - rw / 2 + (rw * i) / 3, 0.03, ry0, ry1, 0.02, 0.29, brass);
    c.wbox(rackSpot.side, rackSpot.at, rw - 0.04, (ry0 + ry1) / 2 - 0.015, (ry0 + ry1) / 2 + 0.015, 0.02, 0.29, brass);
    for (let idx = 0; idx < 6; idx++) {
      const col = idx % 3, row = Math.floor(idx / 3);
      const u = rackSpot.at - rw / 2 + (col + 0.5) * (rw / 3);
      const ly = (row === 0 ? ry1 : (ry0 + ry1) / 2) - 0.055;
      const tag = card(c, `slot:${c.room.id}:${idx}`, [p.slots[idx]], { w: 96, h: 20, bg: '#1b1915', fg: '#ead9ab', edge: '#b8893c', size: 10, pad: 4 });
      c.hang(c.mapped(`slot:${idx}`, tag), rackSpot.side, u, ly, rw / 3 - 0.08, 0.095, null, WHITE, 0.295);
    }
    const rp = c.wallAt(rackSpot.side, rackSpot.at, 0.22);
    c.solid(rp.x - 0.32, rp.z - 0.32, rp.x + 0.32, rp.z + 0.32, { tall: true });
    c.reserve(rp.x, rp.z, 0.7);
  }

  const signSpot = c.wallSpot(1.8, ['back', 'left', 'right'], 0.35, 2.2);
  if (signSpot) {
    const plaque = card(c, 'mail:' + c.room.id, p.sign, { w: 240, h: 56, bg: '#1d2b25', fg: '#f0e2bc', edge: '#c49a45', size: 15, pad: 12 });
    framed(c, c.mapped('mailplaque', plaque), signSpot.side, signSpot.at, 1.72, 1.5, 0.35, null, darkBrass);
  }

  // central dispatch pedestal + clear vertical vacuum sight-tube up to the ceiling manifold
  const mx = 0, mz = -0.15, topY = H - 0.22;
  c.reserve(mx, mz, 1.15);
  c.flat.box(mx - 0.56, 0, mz - 0.44, mx + 0.56, 0.88, mz + 0.44, enamel, { skip: '-y' });
  c.flat.box(mx - 0.6, 0.86, mz - 0.48, mx + 0.6, 0.92, mz + 0.48, brass);
  c.flat.box(mx - 0.6, 0, mz - 0.48, mx + 0.6, 0.09, mz + 0.48, darkBrass, { skip: '-y' });
  c.solid(mx - 0.58, mz - 0.46, mx + 0.58, mz + 0.46, { tall: false });
  c.shadow(mx, mz, 1.2, 0.96, 0.5);

  // pressure dial & instruction plate on the front of the dispatch desk
  const dial = kit.tex.custom('dial:' + c.room.id, 144, 64, (g) => {
    P(g, '#1c2420', 0, 0, 144, 64);
    P(g, '#c49a45', 2, 2, 140, 1); P(g, '#c49a45', 2, 61, 140, 1);
    g.fillStyle = '#f4efe0'; g.beginPath(); g.arc(28, 32, 19, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#b8893c'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#b5342c'; g.lineWidth = 2; g.beginPath(); g.moveTo(28, 32); g.lineTo(39, 21); g.stroke();
    drawText(g, ['VACUUM READY', p.stamp], 52, 12, 86, 40, { color: '#ead9ab', size: 10, pad: 4 });
  }, { clamp: true });
  c.board(c.mapped('dial', dial), mx, 0.52, mz + 0.446, 0.66, 0.29, 0);

  // open brass dispatch funnel on the +z lip + spare canisters in a wire side-basket
  const bx = mx, bz = mz + 0.2;
  c.flat.box(bx - 0.13, 0.92, bz - 0.13, bx + 0.13, 1.06, bz + 0.13, brass);
  c.flat.box(bx - 0.09, 1.05, bz - 0.09, bx + 0.09, 1.07, bz + 0.09, dark);
  // clear acrylic vertical riser from breech (1.06) to ceiling diverter box (topY)
  for (const [rx, rz] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) {
    c.flat.box(bx + rx - 0.012, 1.04, bz + rz - 0.012, bx + rx + 0.012, topY, bz + rz + 0.012, brass);
  }
  const sightGlass = new Batch();
  sightGlass.box(bx - 0.085, 1.06, bz - 0.085, bx + 0.085, topY - 0.06, bz + 0.085, glassTint, { skip: '+y-y' });
  c.after.push(() => {
    const geo = kit.geometry(sightGlass, c.rt.lights, c.rt.amb);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, kit.surface({ map: kit.tex.white(), room: c.rt.u, flick: geo.userData.flick, alpha: 0.3, side: THREE.DoubleSide }));
    mesh.renderOrder = 3;
    c.rt.group.add(mesh);
  });

  // spare canisters waiting on the counter beside the funnel
  const bands = ['#b5342c', '#2f6f8f', '#c9893f', '#3f7a52'];
  for (let i = 0; i < p.canisters; i++) {
    const cx = mx - 0.36 + (i % 2) * 0.16, cz = mz - 0.18 + Math.floor(i / 2) * 0.17;
    c.model('can:' + bands[i % bands.length], canisterVox(bands[i % bands.length]), cx, cz, { y: 0.92, rot: R.range(-0.5, 0.5), solid: false, shadow: false });
  }

  // ceiling diverter chamber + overhead brass trunk pipes out to every doorway
  c.flat.box(bx - 0.24, topY - 0.12, bz - 0.24, bx + 0.24, H, bz + 0.24, brass, { skip: '+y' });
  c.light(bx, 1.65, bz + 0.25, '#ffe2a8', 0.45, { k: 1.8, far: 4.5 });

  const toExit = roomDistances(c.level, c.level.exit.room);
  let bestIdx = 0, bestDist = Infinity;
  c.room.doors.forEach((dr, i) => {
    const d = toExit.get(dr.to) ?? 999;
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  });

  const letters = ['A', 'B', 'C', 'D'];
  const routes = c.room.doors.map((dr, i) => {
    const end = c.wallAt(dr.side, dr.c, 0.12);
    const code = `ROUTE ${letters[i % letters.length]}`;
    // elbow pipe along X then Z at y = topY - 0.04 so pipes stay crisp and rectilinear on the ceiling grid
    const elbow = [end.x, bz], y0 = topY - 0.08, y1 = topY;
    const seg = (ax, az, qx, qz) => {
      if (Math.hypot(qx - ax, qz - az) < 0.04) return;
      c.flat.box(Math.min(ax, qx) - 0.055, y0, Math.min(az, qz) - 0.055, Math.max(ax, qx) + 0.055, y1, Math.max(az, qz) + 0.055, brass);
      const midX = (ax + qx) / 2, midZ = (az + qz) / 2;
      c.flat.box(midX - 0.075, y0 - 0.015, midZ - 0.075, midX + 0.075, H, midZ + 0.075, darkBrass, { skip: '+y' });
    };
    seg(bx, bz, elbow[0], elbow[1]);
    seg(elbow[0], elbow[1], end.x, end.z);

    // doorway collar, route plate, and status lamp above the lintel
    const ly = Math.min(H - 0.34, dr.h + 0.22);
    c.wbox(dr.side, dr.c, 0.56, ly - 0.11, ly + 0.11, 0, 0.09, darkBrass);
    const tag = card(c, `rt:${c.room.id}:${i}`, [code], { w: 96, h: 24, bg: '#181a18', fg: '#f0e2bc', edge: '#c49a45', size: 12, pad: 6 });
    c.hang(c.mapped(`rt:${i}`, tag), dr.side, dr.c - 0.07, ly, 0.36, 0.09, null, WHITE, 0.095);

    // dynamic indicator lamp beside the route tag (dark until a canister exits this trunk)
    const lampBatch = new Batch();
    c.wbox(dr.side, dr.c + 0.18, 0.08, ly - 0.04, ly + 0.04, 0.085, 0.115, WHITE, { batch: lampBatch });
    const lp = c.wallAt(dr.side, dr.c + 0.18, 0.1);
    const lampHolder = new THREE.Group();
    c.rt.group.add(lampHolder);
    let lampMat = null;
    c.after.push(() => {
      const geo = kit.plain(lampBatch);
      if (!geo) return;
      lampMat = kit.glowing(kit.tex.white(), 0.25, [0.25, 0.28, 0.25]);
      lampHolder.add(new THREE.Mesh(geo, lampMat));
    });

    const pts = [[bx, topY - 0.04, bz], [elbow[0], topY - 0.04, elbow[1]], [end.x, topY - 0.04, end.z]];
    const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][2] - pts[0][2]);
    const l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][2] - pts[1][2]);
    return { dr, pts, l1, l2, total: Math.max(0.01, l1 + l2), setLamp: (on) => { if (lampMat) lampMat.color.setRGB(on ? 0.35 : 0.06, on ? 1.9 : 0.07, on ? 0.55 : 0.06); }, endW: c.toWorld(lp.x, lp.z) };
  });

  // the travelling brass canister (visible climbing the glass riser)
  const podPivot = [bx, 1.45, bz], podBatch = new Batch();
  podBatch.box(bx - 0.048, 1.45, bz - 0.048, bx + 0.048, 1.49, bz + 0.048, brass);
  podBatch.box(bx - 0.042, 1.49, bz - 0.042, bx + 0.042, 1.66, bz + 0.042, lin('#ede6d2'));
  podBatch.box(bx - 0.046, 1.54, bz - 0.046, bx + 0.046, 1.61, bz + 0.046, lin('#d83428'));
  podBatch.box(bx - 0.048, 1.66, bz - 0.048, bx + 0.048, 1.70, bz + 0.048, brass);
  const pod = c.dynamic(podBatch, { pivot: podPivot });
  pod.visible = false;

  let flight = 0, nextThump = 0, glowHold = 0;
  const hereW = c.toWorld(bx, bz);
  c.use({
    x: bx, z: bz + 0.28, r: 1.7, cone: 0.35, label: 'dispatch',
    when: () => flight === 0,
    use: () => {
      flight = 0.0001; nextThump = 0.62; glowHold = 0;
      for (const r of routes) r.setLamp(false);
      pod.visible = true;
      pod.position.set(bx, 1.08, bz);
      pod.rotation.set(0, 0, 0);
      c.env.play('thunk', hereW.x, hereW.z, 6);
      c.env.play('slide', hereW.x, hereW.z, 6);
    },
  });

  c.tick((dt) => {
    if (glowHold > 0) {
      glowHold = Math.max(0, glowHold - dt);
      if (glowHold === 0) routes[bestIdx]?.setLamp(false);
    }
    if (!flight) return;
    flight += dt;
    const rt = routes[bestIdx];
    if (flight < 0.65) {
      const k = smooth(flight / 0.65);
      pod.position.set(bx, 1.08 + (topY - 0.16 - 1.08) * k, bz);
      pod.rotation.y = flight * 9;
    } else if (flight < 0.78) {
      if (nextThump < 0.85) { nextThump = 0.88; c.env.play('clack', hereW.x, hereW.z, 6); }
      pod.visible = false;
    } else if (flight < 1.72) {
      const u = clamp((flight - 0.78) / 0.94, 0, 1), dist = u * rt.total;
      let px = rt.pts[1][0], pz = rt.pts[1][2];
      if (dist <= rt.l1 && rt.l1 > 0.01) {
        const s = dist / rt.l1;
        px = rt.pts[0][0] + (rt.pts[1][0] - rt.pts[0][0]) * s;
        pz = rt.pts[0][2] + (rt.pts[1][2] - rt.pts[0][2]) * s;
      } else if (rt.l2 > 0.01) {
        const s = (dist - rt.l1) / rt.l2;
        px = rt.pts[1][0] + (rt.pts[2][0] - rt.pts[1][0]) * s;
        pz = rt.pts[1][2] + (rt.pts[2][2] - rt.pts[1][2]) * s;
      }
      if (flight >= nextThump) {
        nextThump += 0.22;
        const pw = c.toWorld(px, pz);
        c.env.play('rattle', pw.x, pw.z, 7);
      }
    } else {
      flight = 0;
      pod.visible = false;
      rt.setLamp(true);
      glowHold = 4.5;
      c.env.play('ding', rt.endW.x, rt.endW.z, 8);
    }
  });
}

export const MORE5 = { 'quiet-zone': quietZone, mailroom };
