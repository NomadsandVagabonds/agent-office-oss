// The Backrooms — The Vestibule ("the revolving doors") (after Gemini's Wave 2, brought onto the room contract:
// its line in the deck is in deck2.js, and this file is the whole of it).
// Corporate lobby revolving doors on two axes: upright drums that carry (or refuse) whoever steps into a quadrant,
// and a sideways rotor sunk flush in the floor that drops you out of its twin in the ceiling.
import * as THREE from 'three';
import { Batch, lin, drawText, smooth, WHITE } from '../kit.js';
import { P, clamp, card, framed } from '../bits.js';

/** Add a baked mesh layer (such as translucent glass or stencil decals) onto a dynamic group. */
function addLayer(c, holder, pivot, batch, surfaceOpt, order = 0) {
  c.after.push(() => {
    const geo = c.kit.geometry(batch, c.rt.lights, c.rt.amb);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, c.kit.surface({ room: c.rt.u, flick: geo.userData.flick, ...surfaceOpt }));
    mesh.renderOrder = order;
    mesh.position.set(-pivot[0], -pivot[1], -pivot[2]);
    holder.add(mesh);
  });
}

/** Crisp white vinyl stencil text on a transparent background, for sticking straight onto glass panes. */
function glassStencil(c, key, lines, accent = '#ffffff') {
  return c.kit.tex.custom('gst:' + key, 160, 48, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    P(g, accent, 8, 4, w - 16, 2);
    P(g, accent, 8, h - 6, w - 16, 2);
    drawText(g, lines, 0, 7, w, h - 14, { color: '#f6f8fa', size: lines.length > 1 ? 11 : 14, pad: 14 });
  }, { clamp: true });
}

/**
 * Corporate lobby revolving doors on two axes: upright drums that carry (or
 * refuse) whoever steps into a quadrant, and a sideways rotor sunk flush in the
 * floor that drops you out of its twin in the ceiling.
 */
export function build(c) {
  const { W, D, H, params: p, kit } = c;
  c.shell();

  const metal = p.metal === 'steel' ? lin('#8b939c') : lin('#c49b48');
  const darkMetal = metal.map((v) => v * 0.58);
  const rubber = [0.09, 0.095, 0.105], voidBlack = [0.005, 0.006, 0.008];
  const glassCol = lin(p.tint);
  const staticGlass = new Batch();

  // framed lobby climate-lock plaque on a clear wall
  const signSpot = c.wallSpot(2.4, ['back', 'left', 'right'], 0.4, 2.3);
  if (signSpot) {
    c.keepWall(signSpot.side, signSpot.at - 1.3, signSpot.at + 1.3);
    const plaque = card(c, 'vest:' + c.room.id, p.plaque, { w: 256, h: 60, bg: '#181c20', fg: '#efe4c6', edge: p.metal === 'steel' ? '#8b939c' : '#c49b48', size: 15, pad: 14 });
    framed(c, c.mapped('vestplaque', plaque), signSpot.side, signSpot.at, 1.78, 1.85, 0.43, null, darkMetal);
  }

  // walk-off mat just inside the front door
  c.flat.box(-0.95, 0.004, D / 2 - 1.35, 0.95, 0.012, D / 2 - 0.35, [0.14, 0.14, 0.15], { skip: '-y' });

  const pushTex = glassStencil(c, 'push:' + p.decal, [p.decal]);
  const jamTex = glassStencil(c, 'jam', ['PLEASE USE', 'OTHER DOOR'], '#e85848');
  const stepTex = glassStencil(c, 'step', ['AUTOMATIC', 'WATCH STEP']);

  // build an 8-sided ring of metal around (cx, cz) from y0 to y1, radius r0..r1
  const octRing = (cx, cz, r0, r1, y0, y1, col) => {
    const rm = (r0 + r1) / 2, rw = (r1 - r0) / 2, segLen = 2 * rm * Math.tan(Math.PI / 8) + 0.02;
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) * (Math.PI / 4), px = cx + Math.sin(a) * rm, pz = cz + Math.cos(a) * rm;
      const sx = Math.abs(Math.cos(a)) * (segLen / 2) + Math.abs(Math.sin(a)) * rw;
      const sz = Math.abs(Math.sin(a)) * (segLen / 2) + Math.abs(Math.cos(a)) * rw;
      c.flat.box(px - sx, y0, pz - sz, px + sx, y1, pz + sz, col);
    }
  };

  // build a pair of upright revolving drums flanking the lobby approach
  const R_DRUM = 0.88, H_DRUM = 2.22, drumZ = 1.45;
  const uprightDrums = [-1, 1].map((sx) => {
    const dx = sx * 1.92, dz = drumZ, jammed = sx === p.jamSide;
    c.reserve(dx, dz, R_DRUM + 0.25);

    // circular rubber mat, crown ring, and recessed drum light
    c.blot(dx, dz, R_DRUM * 2.05, R_DRUM * 2.05, { rgb: [0.04, 0.04, 0.05], a: 0.55, y: 0.005 });
    octRing(dx, dz, R_DRUM - 0.06, R_DRUM + 0.03, 0, 0.035, darkMetal);
    octRing(dx, dz, R_DRUM - 0.07, R_DRUM + 0.04, H_DRUM - 0.16, H_DRUM, metal);
    c.flat.box(dx - 0.58, H_DRUM - 0.03, dz - 0.58, dx + 0.58, H_DRUM + 0.01, dz + 0.58, darkMetal);
    const crownCol = jammed ? '#ff6e48' : '#72e8a0';
    c.shining('crown:' + sx, kit.tex.white(), 1.8, lin(crownCol))
      .box(dx - 0.26, H_DRUM - 0.17, dz + R_DRUM - 0.04, dx + 0.26, H_DRUM - 0.13, dz + R_DRUM + 0.05, WHITE);
    c.shining('crown:' + sx, kit.tex.white(), 1.8, lin(crownCol))
      .box(dx - 0.26, H_DRUM - 0.17, dz - R_DRUM - 0.05, dx + 0.26, H_DRUM - 0.13, dz - R_DRUM + 0.04, WHITE);
    c.light(dx, H_DRUM - 0.18, dz, jammed ? '#ffbe94' : '#fff0cc', 0.52, { k: 1.5, far: 4.2, axis: [0, -1, 0], floor: 0.32 });

    // curved stationary glass shroud walls on the left and right flanks (open at +z and -z)
    for (const sideSign of [-1, 1]) {
      const steps = 4, a0 = 0.66, a1 = Math.PI - 0.66;
      for (let k = 0; k < steps; k++) {
        const t0 = a0 + ((a1 - a0) * k) / steps, t1 = a0 + ((a1 - a0) * (k + 1)) / steps;
        const x0 = dx + sideSign * Math.sin(t0) * R_DRUM, z0 = dz + Math.cos(t0) * R_DRUM;
        const x1 = dx + sideSign * Math.sin(t1) * R_DRUM, z1 = dz + Math.cos(t1) * R_DRUM;
        staticGlass.quad([x0, 0.035, z0], [x1, 0.035, z1], [x1, H_DRUM - 0.16, z1], [x0, H_DRUM - 0.16, z0], glassCol);
      }
      for (const tPost of [a0, a1]) {
        const px = dx + sideSign * Math.sin(tPost) * R_DRUM, pz = dz + Math.cos(tPost) * R_DRUM;
        c.flat.box(px - 0.028, 0, pz - 0.028, px + 0.028, H_DRUM, pz + 0.028, metal, { skip: '-y' });
      }
      c.solid(dx + sideSign * (R_DRUM - 0.1) - 0.1, dz - 0.56, dx + sideSign * (R_DRUM - 0.1) + 0.1, dz + 0.56, { tall: false });
    }

    // the jammed one does not let anybody through: it gives a little, rattles, and puts them back where they came in
    if (jammed) c.solid(dx - 0.6, dz - 0.08, dx + 0.6, dz + 0.08, { tall: false });

    // 4-winged rotating glass rotor inside the drum
    const pivot = [dx, 0, dz], frameB = new Batch(), wingGlass = new Batch(), decalB = new Batch();
    frameB.box(dx - 0.045, 0.03, dz - 0.045, dx + 0.045, H_DRUM - 0.15, dz + 0.045, metal);
    const rIn = 0.055, rOut = R_DRUM - 0.075, yBot = 0.05, yTop = H_DRUM - 0.19;
    for (let w = 0; w < 4; w++) {
      const ang = (w * Math.PI) / 2, sn = Math.sin(ang), cs = Math.cos(ang);
      const ax = dx + sn * rIn, az = dz + cs * rIn, bx = dx + sn * rOut, bz = dz + cs * rOut;
      const xLo = Math.min(ax, bx) - 0.016, xHi = Math.max(ax, bx) + 0.016;
      const zLo = Math.min(az, bz) - 0.016, zHi = Math.max(az, bz) + 0.016;
      frameB.box(xLo, yBot, zLo, xHi, yBot + 0.045, zHi, metal);
      frameB.box(xLo, yTop - 0.045, zLo, xHi, yTop, zHi, metal);
      frameB.box(xLo, 0.98, zLo, xHi, 1.025, zHi, metal);
      frameB.box(bx - 0.02, yBot, bz - 0.02, bx + 0.02, yTop, bz + 0.02, rubber);
      wingGlass.quad([ax, yBot + 0.045, az], [bx, yBot + 0.045, bz], [bx, yTop - 0.045, bz], [ax, yTop - 0.045, az], glassCol);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, nx = cs * 0.014, nz = -sn * 0.014;
      const hw = 0.27;
      decalB.quad([mx - sn * hw + nx, 1.28, mz - cs * hw + nz], [mx + sn * hw + nx, 1.28, mz + cs * hw + nz],
        [mx + sn * hw + nx, 1.44, mz + cs * hw + nz], [mx - sn * hw + nx, 1.44, mz - cs * hw + nz], WHITE);
      decalB.quad([mx + sn * hw - nx, 1.28, mz + cs * hw - nz], [mx - sn * hw - nx, 1.28, mz - cs * hw - nz],
        [mx - sn * hw - nx, 1.44, mz - cs * hw - nz], [mx + sn * hw - nx, 1.44, mz + cs * hw - nz], WHITE);
    }
    const holder = c.dynamic(frameB, { pivot });
    addLayer(c, holder, pivot, wingGlass, { map: kit.tex.white(), alpha: 0.36, side: THREE.DoubleSide }, 3);
    addLayer(c, holder, pivot, decalB, { map: jammed ? jamTex : pushTex, cutout: true }, 2);
    holder.rotation.y = jammed ? 0.38 : 0.785;
    return { dx, dz, jammed, holder, baseAngle: holder.rotation.y, ride: null, cool: 0, rattled: false };
  });

  // horizontal glass rotor sunk flush into the floor — and its twin overhead in the ceiling
  const R_WELL = 0.86, fx = -p.dropSide * 1.65, fz = -1.35, cx = p.dropSide * 1.85, cz = -1.35;
  c.reserve(fx, fz, R_WELL + 0.28);
  c.reserve(cx, cz, R_WELL + 0.28);

  // floor shaft: brass curb, abyssal void quad at y = 0.006 (depth-clips the lower half of the turning glass paddles!)
  octRing(fx, fz, R_WELL - 0.05, R_WELL + 0.05, 0, 0.042, metal);
  const fw = R_WELL - 0.04;
  c.flat.quad([fx - fw, 0.006, fz + fw], [fx + fw, 0.006, fz + fw], [fx + fw, 0.006, fz - fw], [fx - fw, 0.006, fz - fw], voidBlack);
  c.shining('wellrim', kit.tex.white(), 1.35, glassCol).box(fx - fw + 0.04, 0.007, fz - fw + 0.04, fx + fw - 0.04, 0.018, fz - fw + 0.07, WHITE);
  c.shining('wellrim', kit.tex.white(), 1.35, glassCol).box(fx - fw + 0.04, 0.007, fz + fw - 0.07, fx + fw - 0.04, 0.018, fz + fw - 0.04, WHITE);
  if (c.rt.lights.length < 15) c.light(fx, 0.35, fz, p.tint, 0.36, { k: 1.2, far: 3.4 });                 // the least of its lamps: it goes first where the ceiling is already full (16 to a room)

  // ceiling shaft + arrivals mat directly underneath
  octRing(cx, cz, R_WELL - 0.05, R_WELL + 0.05, H - 0.045, H, metal);
  c.flat.quad([cx - fw, H - 0.006, cz - fw], [cx + fw, H - 0.006, cz - fw], [cx + fw, H - 0.006, cz + fw], [cx - fw, H - 0.006, cz + fw], voidBlack);
  c.light(cx, H - 0.32, cz, '#ffe6b8', 0.48, { k: 1.6, far: 4.2, axis: [0, -1, 0], floor: 0.3 });

  const matTex = card(c, 'vmat:' + p.mat, [p.mat], { w: 192, h: 56, bg: '#222428', fg: '#e8dec2', edge: '#b89242', size: 14, pad: 12 });
  c.lay(c.mapped('vmat:' + c.room.id, matTex), cx, cz, 1.36, 0.44, 0, null, WHITE, 0.009);

  // build a horizontal 4-winged glass rotor turning about a brass X-spindle at (rx, ry, rz)
  const makeHorizontalRotor = (rx, ry, rz, radius) => {
    const pivot = [rx, ry, rz], fb = new Batch(), gb = new Batch(), db = new Batch();
    const halfSpan = 0.56;
    fb.box(rx - halfSpan - 0.04, ry - 0.032, rz - 0.032, rx + halfSpan + 0.04, ry + 0.032, rz + 0.032, metal);
    for (let w = 0; w < 4; w++) {
      const ang = (w * Math.PI) / 2, sy = Math.sin(ang), sz = Math.cos(ang);
      const y1 = ry + sy * radius, z1 = rz + sz * radius, y0 = ry + sy * 0.05, z0 = rz + sz * 0.05;
      for (const sx of [-halfSpan, halfSpan]) {
        fb.box(rx + sx - 0.018, Math.min(y0, y1) - 0.016, Math.min(z0, z1) - 0.016,
          rx + sx + 0.018, Math.max(y0, y1) + 0.016, Math.max(z0, z1) + 0.016, metal);
      }
      const ym = (y0 + y1) / 2, zm = (z0 + z1) / 2;
      fb.box(rx - halfSpan, ym - 0.016, zm - 0.016, rx + halfSpan, ym + 0.016, zm + 0.016, metal);
      fb.box(rx - halfSpan, y1 - 0.018, z1 - 0.018, rx + halfSpan, y1 + 0.018, z1 + 0.018, rubber);
      gb.quad([rx - halfSpan, y0, z0], [rx + halfSpan, y0, z0], [rx + halfSpan, y1, z1], [rx - halfSpan, y1, z1], glassCol);
      const ny = sz * 0.012, nz = -sy * 0.012;
      db.quad([rx - 0.28, ym - sy * 0.08 + ny, zm - sz * 0.08 + nz], [rx + 0.28, ym - sy * 0.08 + ny, zm - sz * 0.08 + nz],
        [rx + 0.28, ym + sy * 0.08 + ny, zm + sz * 0.08 + nz], [rx - 0.28, ym + sy * 0.08 + ny, zm + sz * 0.08 + nz], WHITE);
      db.quad([rx + 0.28, ym - sy * 0.08 - ny, zm - sz * 0.08 - nz], [rx - 0.28, ym - sy * 0.08 - ny, zm - sz * 0.08 - nz],
        [rx - 0.28, ym + sy * 0.08 - ny, zm + sz * 0.08 - nz], [rx + 0.28, ym + sy * 0.08 - ny, zm + sz * 0.08 - nz], WHITE);
    }
    const holder = c.dynamic(fb, { pivot });
    addLayer(c, holder, pivot, gb, { map: kit.tex.white(), alpha: 0.38, side: THREE.DoubleSide }, 3);
    addLayer(c, holder, pivot, db, { map: stepTex, cutout: true }, 2);
    return holder;
  };

  const floorRotor = makeHorizontalRotor(fx, 0.02, fz, 0.48);
  const ceilRotor = makeHorizontalRotor(cx, H - 0.02, cz, 0.48);

  // architectural glitch: a half-submerged revolving drum jutting sideways out of a free stretch of wall
  let wallRotor = null;
  if (p.wallDrum) {
    const ws = c.wallSpot(2.0, ['back', 'left', 'right'], 0.65, 2.35);
    if (ws) {
      const wp = c.wallAt(ws.side, ws.at, 0.02), wy = 1.24;
      c.wbox(ws.side, ws.at, 1.38, wy - 0.66, wy + 0.66, 0, 0.045, metal);
      c.wbox(ws.side, ws.at, 1.24, wy - 0.58, wy + 0.58, 0.045, 0.052, voidBlack);
      const pivot = [wp.x, wy, wp.z], fb = new Batch(), gb = new Batch();
      const alongX = ws.side === 'front' || ws.side === 'back';
      for (let w = 0; w < 4; w++) {
        const ang = (w * Math.PI) / 2, c1 = Math.cos(ang) * 0.44, s1 = Math.sin(ang) * 0.44;
        if (alongX) {
          gb.quad([wp.x - 0.48, wy, wp.z], [wp.x + 0.48, wy, wp.z], [wp.x + 0.48, wy + s1, wp.z + c1], [wp.x - 0.48, wy + s1, wp.z + c1], glassCol);
          fb.box(wp.x - 0.48, wy + s1 - 0.015, wp.z + c1 - 0.015, wp.x + 0.48, wy + s1 + 0.015, wp.z + c1 + 0.015, metal);
        } else {
          gb.quad([wp.x, wy, wp.z - 0.48], [wp.x, wy, wp.z + 0.48], [wp.x + c1, wy + s1, wp.z + 0.48], [wp.x + c1, wy + s1, wp.z - 0.48], glassCol);
          fb.box(wp.x + c1 - 0.015, wy + s1 - 0.015, wp.z - 0.48, wp.x + c1 + 0.015, wy + s1 + 0.015, wp.z + 0.48, metal);
        }
      }
      wallRotor = { holder: c.dynamic(fb, { pivot }), axis: alongX ? 'x' : 'z' };
      addLayer(c, wallRotor.holder, pivot, gb, { map: kit.tex.white(), alpha: 0.36, side: THREE.DoubleSide }, 3);
      const bump = c.wallAt(ws.side, ws.at, 0.24);
      c.solid(bump.x - 0.36, bump.z - 0.36, bump.x + 0.36, bump.z + 0.36, { tall: false });
    }
  }

  c.after.push(() => {
    const geo = kit.geometry(staticGlass, c.rt.lights, c.rt.amb);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, kit.surface({ map: kit.tex.white(), room: c.rt.u, flick: geo.userData.flick, alpha: 0.32, side: THREE.DoubleSide }));
    mesh.renderOrder = 3;
    c.rt.group.add(mesh);
  });

  let floorAngle = 0.3, ceilAngle = 0.9, floorBurst = 0, ceilBurst = 0, falling = 0, fallCool = 0;

  c.tick((dt, t, me) => {
    // idle + burst rotation on the sideways floor, ceiling, and wall rotors
    floorBurst = Math.max(0, floorBurst - dt * 7);
    ceilBurst = Math.max(0, ceilBurst - dt * 5.5);
    floorAngle += dt * (0.55 + floorBurst);
    ceilAngle -= dt * (0.5 + ceilBurst);
    floorRotor.rotation.x = floorAngle;
    ceilRotor.rotation.x = ceilAngle;
    if (wallRotor) wallRotor.holder.rotation[wallRotor.axis] = t * 0.42;

    if (fallCool > 0) fallCool = Math.max(0, fallCool - dt);

    // upright drums: step into a pocket to be revolved across (or politely turned back by the jammed one)
    for (const d of uprightDrums) {
      if (d.cool > 0) d.cool = Math.max(0, d.cool - dt);
      if (!d.ride) {
        d.holder.rotation.y = d.jammed ? d.baseAngle + Math.sin(t * 2.4) * 0.025 : d.baseAngle + t * 0.28;
        if (me.inside && !falling && d.cool <= 0 && Math.hypot(me.x - d.dx, me.z - d.dz) < 0.58) {
          const dir = me.z >= d.dz ? 1 : -1;
          d.ride = { dir, t: 0, startAngle: d.holder.rotation.y };
          d.rattled = false;
          const dw = c.toWorld(d.dx, d.dz);
          c.env.play('slide', dw.x, dw.z, 5);
          if (!d.jammed) c.env.play('squeak', dw.x, dw.z, 4);
        }
        continue;
      }
      d.ride.t += dt;
      const dur = d.jammed ? 0.78 : 0.86, u = clamp(d.ride.t / dur, 0, 1);
      if (d.jammed) {
        const arc = u < 0.45 ? smooth(u / 0.45) : 1 - smooth((u - 0.45) / 0.55);
        if (u >= 0.45 && !d.rattled) {
          d.rattled = true;
          const dw = c.toWorld(d.dx, d.dz);
          c.env.play('rattle', dw.x, dw.z, 5);
          c.env.play('beep', dw.x, dw.z, 4);
        }
        d.holder.rotation.y = d.ride.startAngle + d.ride.dir * arc * 0.52;
        const ang = (d.ride.dir > 0 ? 0 : Math.PI) + arc * 0.52;
        const rad = 0.46 + (u > 0.75 ? ((u - 0.75) / 0.25) * 0.56 : 0);
        const pw = c.toWorld(d.dx + Math.sin(ang) * 0.34 * arc, d.dz + Math.cos(ang) * rad);
        c.env.player.warp(pw.x, pw.z);
      } else {
        const s = smooth(u);
        d.holder.rotation.y = d.ride.startAngle + s * Math.PI;
        const ang = (d.ride.dir > 0 ? 0 : Math.PI) + s * Math.PI;
        const outBoost = u > 0.8 ? ((u - 0.8) / 0.2) * 0.52 : 0;
        const pw = c.toWorld(d.dx + Math.sin(ang) * 0.38, d.dz + Math.cos(ang) * (0.54 + outBoost));
        c.env.player.warp(pw.x, pw.z);
      }
      if (u >= 1) {
        d.baseAngle = d.holder.rotation.y - (d.jammed ? 0 : t * 0.28);
        d.ride = null;
        d.cool = 0.7;
      }
    }

    // horizontal floor rotor: step onto its glass blades and they fold beneath you, dropping you from the ceiling rotor
    if (!me.inside) { falling = 0; return; }
    if (!falling && fallCool <= 0 && me.world.drop < 0.06 && Math.hypot(me.x - fx, me.z - fz) < 0.66) {
      falling = 0.0001;
      floorBurst = 9.5;
      const fw2 = c.toWorld(fx, fz);
      c.env.play('door', fw2.x, fw2.z, 6);
      c.env.interfere(0.75);
    }
    if (falling > 0) {
      falling += dt;
      c.env.player.me.sinkTo = Math.min(0.45, falling * 2.6);
      c.env.interfere(0.85);
      if (falling >= 0.17) {
        falling = 0;
        fallCool = 1.35;
        ceilBurst = 10.5;
        const outW = c.toWorld(cx, cz), pl = c.env.player;
        pl.warp(outW.x, outW.z);
        pl.me.sink = 0; pl.me.sinkTo = 0;
        pl.me.drop = Math.max(0.55, H - pl.EYE - 0.28);
        pl.me.dropV = -0.85;
        c.env.interfere(1.0);
        c.env.sound.play('thunk');
        c.env.play('slide', outW.x, outW.z, 6);
      }
    }
  });
}
