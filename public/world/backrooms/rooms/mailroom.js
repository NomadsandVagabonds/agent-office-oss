// The Backrooms — the Mailroom ("the brass tubes") (after Gemini's Wave 2, brought onto the room contract:
// its line in the deck is in deck2.js, and this file is the whole of it).
// A pneumatic mail exchange whose canisters rattle overhead along whichever pipe leads toward the way down.
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { Batch, lin, drawText, smooth, WHITE } from '../kit.js';
import { roomDistances } from '../gen.js';
import { P, clamp, card, framed } from '../bits.js';

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
export function build(c) {
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
    c.wbox(dr.side, dr.c + 0.2, 0.12, ly - 0.06, ly + 0.06, 0.085, 0.125, WHITE, { batch: lampBatch });
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
