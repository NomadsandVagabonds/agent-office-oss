// The Backrooms — the rooms, part five: a lobby vestibule of upright and
// sideways revolving glass doors, and a dim reprographics hall whose copiers
// scan the empty air as you walk past.
import * as THREE from 'three';
import { Vox, M } from '../vox/vox.js';
import { Batch, lin, drawText, smooth, WHITE } from './kit.js';
import { roomDistances } from './gen.js';
import { P, clamp, card, framed, scatter } from './bits.js';
import { MORE5 } from './rooms6.js';

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

/* ---- the vestibule -------------------------------------------------------------------- */

/**
 * Corporate lobby revolving doors on two axes: upright drums that carry (or
 * refuse) whoever steps into a quadrant, and a sideways rotor sunk flush in the
 * floor that drops you out of its twin in the ceiling.
 */
function vestibule(c) {
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
  c.light(fx, 0.35, fz, p.tint, 0.36, { k: 1.2, far: 3.4 });

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

/* ---- the copy room -------------------------------------------------------------------- */

const copierVox = () => {
  const v = new Vox();
  const body = M('#d6cfbc', 0), shade = M('#b8b09c', 0), dark = M('#282b30', 0), tray = M('#8f8979', 0);
  const glass = M('#173b2c', 0), led = M('#49e882', 0, { glow: true });
  // main pedestal cabinet (local voxel x across depth, z along aisle: 28 × 35 × 36 -> 0.70m × 0.88m × 0.90m)
  v.box(-14, 0, -18, 14, 34, 18, body);
  v.box(-14, 0, -18, 14, 3, 18, dark);
  // three paper cassette drawers on the aisle-facing (+x) front
  for (const [y0, y1] of [[5, 12], [13, 20], [21, 28]]) {
    v.box(13, y0, -15, 15, y1, 15, shade);
    v.box(14, y0 + 2, -4, 15, y1 - 2, 4, dark);
  }
  // recessed dark scan platen on top + angled control strip with ready LED
  v.box(-12, 34, -16, 10, 35, 16, dark);
  v.box(-10, 34, -14, 8, 35, 14, glass);
  v.box(10, 33, -16, 15, 36, 16, shade);
  v.box(12, 35, 8, 14, 37, 12, led);
  // side output catch tray extending into the aisle
  v.box(14, 24, -12, 25, 26, 12, tray);
  v.box(24, 25, -12, 25, 27, 12, tray);
  return v;
};

/** Photocopiers with their lids propped open; pass one and its green lamp scans the dark and spits out a page. */
function copiers(c) {
  const { W, D, R, params: p, kit } = c;
  c.shell();

  const beige = lin('#d6cfbc'), dark = [0.14, 0.15, 0.17], green = lin('#54ff98');

  // reprographics wall notice
  const signSpot = c.wallSpot(2.1, ['back', 'left', 'right'], 0.35, 2.2);
  if (signSpot) {
    const sign = card(c, 'copysign:' + c.room.id, p.sign, { w: 256, h: 58, bg: '#f1ecdc', fg: '#1e1d19', edge: '#5a564c', size: 14, pad: 12 });
    framed(c, c.mapped('copysign', sign), signSpot.side, signSpot.at, 1.72, 1.65, 0.38, null, [0.22, 0.2, 0.18]);
  }

  // which doorway of Copy Room actually takes you closer to the floor's stairs
  const toExit = roomDistances(c.level, c.level.exit.room);
  let bestDoor = c.room.doors[0], bestDist = Infinity;
  for (const dr of c.room.doors) {
    const d = toExit.get(dr.to) ?? 999;
    if (d < bestDist) { bestDist = d; bestDoor = dr; }
  }
  const onwardBack = bestDoor && bestDoor.side === 'back';

  // distinct xerox output textures for what slides onto each machine's tray
  const makeSheet = (kind) => kit.tex.custom(`xsheet:${c.room.id}:${kind}:${onwardBack ? 1 : 0}`, 96, 128, (g, w, h) => {
    P(g, '#efece2', 0, 0, w, h);
    if (kind === 'black') {
      P(g, '#141517', 5, 6, w - 10, h - 16);
      drawText(g, ['TONER TEST 100%'], 0, h - 10, w, 9, { color: '#2b2b2b', size: 7 });
    } else if (kind === 'ceiling') {
      P(g, '#2a2b2e', 6, 6, w - 12, h - 12);
      P(g, '#3d3f44', 6, 62, w - 12, 2); P(g, '#3d3f44', 47, 6, 2, h - 12);
      P(g, '#f2f5f0', 28, 20, 40, 86);
      P(g, '#bfc5be', 46, 22, 4, 82);
    } else if (kind === 'jam') {
      P(g, '#1c1d20', 8, 18, w - 16, 22);
      drawText(g, ['ERROR 41'], 8, 19, w - 16, 20, { color: '#efece2', size: 12 });
      drawText(g, ['PAPER IN TRAY', 'IS ALREADY', 'A COPY'], 6, 48, w - 12, 54, { color: '#1c1d20', size: 10 });
    } else if (kind === 'memo') {
      drawText(g, p.memo.split('  ·  '), 6, 10, w - 12, 34, { color: '#191919', size: 8 });
      for (const y of [52, 64, 76, 88, 100]) P(g, '#18181a', 10, y, y % 24 === 0 ? 54 : 74, 7);
    } else if (kind === 'hand') {
      P(g, '#1e2024', 6, 6, w - 12, h - 12);
      P(g, '#dcd9ce', 30, 56, 36, 44);
      for (const [fx, fy, fh] of [[28, 28, 30], [38, 20, 38], [49, 22, 36], [60, 30, 28], [20, 60, 22]]) P(g, '#dcd9ce', fx, fy, 7, fh);
    } else {
      // 'route': high-contrast floor route slip pointing toward whichever doorway leads onward
      P(g, '#1b1c1f', 8, 8, w - 16, 18);
      drawText(g, ['FLOOR ROUTE'], 8, 9, w - 16, 16, { color: '#f4f2e8', size: 10 });
      g.fillStyle = '#18191c';
      g.beginPath();
      if (onwardBack) { g.moveTo(48, 34); g.lineTo(72, 66); g.lineTo(56, 66); g.lineTo(56, 96); g.lineTo(40, 96); g.lineTo(40, 66); g.lineTo(24, 66); }
      else { g.moveTo(48, 96); g.lineTo(72, 64); g.lineTo(56, 64); g.lineTo(56, 34); g.lineTo(40, 34); g.lineTo(40, 64); g.lineTo(24, 64); }
      g.closePath(); g.fill();
      drawText(g, [onwardBack ? 'FAR DOOR' : 'TURN BACK'], 6, 102, w - 12, 18, { color: '#18191c', size: 11 });
    }
  }, { clamp: true });

  const spanZ = D - 4.2, stepZ = p.pairs > 1 ? spanZ / (p.pairs - 1) : 0;
  const units = [];

  for (let row = 0; row < p.pairs; row++) {
    const cz = D / 2 - 2.1 - row * stepZ;
    for (let s = 0; s < 2; s++) {
      const idx = row * 2 + s, sx = s === 0 ? -1 : 1;
      const cx = sx * (W / 2 - 0.68), faceDir = -sx;                 // left row faces +x, right row faces -x
      const rot = sx < 0 ? 0 : Math.PI;
      c.reserve(cx, cz, 0.85);
      c.model('copier', copierVox, cx, cz, { rot, tall: false });

      // hinged document-feeder lid propped open toward the ceiling so the green scan bar glares into the room
      const lidAngle = p.lids[idx % p.lids.length], hingeX = cx - faceDir * 0.28, lidW = 0.52, lidZ = 0.72;
      const dx = faceDir * Math.cos(lidAngle) * lidW, dy = Math.sin(lidAngle) * lidW;
      const lidTop = [hingeX + dx, 0.88 + dy, cz];
      // underside (white feeder mat) + top shell
      const h0 = [hingeX, 0.88, cz - lidZ / 2], h1 = [hingeX, 0.88, cz + lidZ / 2];
      const t0 = [lidTop[0], lidTop[1], cz - lidZ / 2], t1 = [lidTop[0], lidTop[1], cz + lidZ / 2];
      if (faceDir > 0) {
        c.flat.quad(h0, t0, t1, h1, [0.92, 0.92, 0.9]);
        c.flat.quad(h1, t1, t0, h0, beige);
      } else {
        c.flat.quad(h1, t1, t0, h0, [0.92, 0.92, 0.9]);
        c.flat.quad(h0, t0, t1, h1, beige);
      }
      c.light(cx + faceDir * 0.1, 0.96, cz, '#54ff98', 0.15, { k: 0.85, far: 2.8 });

      // glowing emerald scanner bar under the platen glass
      const barPivot = [cx - faceDir * 0.04, 0.882, cz];
      const barB = new Batch();
      barB.box(barPivot[0] - 0.22, 0.878, cz - 0.022, barPivot[0] + 0.22, 0.892, cz + 0.022, WHITE);
      const barHolder = new THREE.Group();
      barHolder.position.set(barPivot[0], barPivot[1], barPivot[2]);
      c.rt.group.add(barHolder);
      const trayX = cx + faceDir * 0.48;
      const unit = { cx, cz, faceDir, barPivot, barHolder, barMat: null, trayX, sheetHolder: null, active: 0, cool: (idx % 3) * 0.25, printed: false, worldPos: c.toWorld(cx, cz) };
      c.after.push(() => {
        const geo = kit.plain(barB);
        if (!geo) return;
        unit.barMat = kit.glowing(kit.tex.white(), 0.55, green);
        const m = new THREE.Mesh(geo, unit.barMat);
        m.position.set(-barPivot[0], -barPivot[1], -barPivot[2]);
        barHolder.add(m);
      });

      // printed A4 sheet that slides out onto the catch tray once a scan finishes
      const kind = p.sheets[idx % p.sheets.length], tex = makeSheet(kind);
      const sheetPivot = [trayX, 0.655, cz];
      const sheetB = new Batch();
      // orient UV so 'route' arrow aligns with room -z ('FAR DOOR') or +z ('TURN BACK') regardless of left/right wall
      c.lay(sheetB, trayX, cz, 0.21, 0.29, 0, null, WHITE, 0.656);
      const sheetHolder = c.dynamic(sheetB, { pivot: sheetPivot, map: tex });
      sheetHolder.position.x = trayX - faceDir * 0.22;
      sheetHolder.visible = false;
      unit.sheetHolder = sheetHolder;

      if (idx === 1) {
        c.blot(cx + faceDir * 0.62, cz + 0.25, 0.75, 0.55, { rgb: [0.02, 0.02, 0.025], a: 0.55 });
        scatter(c, cx + faceDir * 0.68, cz - 0.2, 4, 0.45);
      }

      units.push(unit);
    }
  }

  // stacked wrapped paper reams in a front corner
  const corner = c.corner(0.65, 0, 1.4);
  if (corner) {
    for (let k = 0; k < 4; k++) {
      c.flat.box(corner.x - 0.16, k * 0.14, corner.z - 0.22, corner.x + 0.16, k * 0.14 + 0.13, corner.z + 0.22, k % 2 ? [0.88, 0.86, 0.8] : [0.82, 0.84, 0.88], { skip: '-y' });
      c.flat.box(corner.x - 0.165, k * 0.14 + 0.04, corner.z - 0.04, corner.x + 0.165, k * 0.14 + 0.09, corner.z + 0.04, dark);
    }
    c.solid(corner.x - 0.18, corner.z - 0.24, corner.x + 0.18, corner.z + 0.24, { tall: false });
  }

  c.tick((dt, t, me) => {
    for (const u of units) {
      if (u.cool > 0) u.cool = Math.max(0, u.cool - dt);
      if (!u.active && me.inside && u.cool <= 0 && Math.abs(me.z - u.cz) < 1.15 && Math.abs(me.x - u.cx) < W * 0.55) {
        u.active = 0.0001;
        u.printed = false;
        c.env.play('whir', u.worldPos.x, u.worldPos.z, 5.5);
        c.env.play('seek', u.worldPos.x, u.worldPos.z, 5);
      }
      if (!u.active) continue;
      u.active += dt;
      if (u.active < 1.25) {
        const phase = u.active / 1.25;
        const sweep = phase < 0.65 ? smooth(phase / 0.65) : 1 - smooth((phase - 0.65) / 0.35);
        u.barHolder.position.z = u.barPivot[2] - 0.28 + sweep * 0.56;
        if (u.barMat) u.barMat.color.setRGB(green[0] * 3.1, green[1] * 3.1, green[2] * 3.1);
        if (me.inside && Math.hypot(me.x - u.cx, me.z - u.cz) < 2.2) c.env.interfere(0.12);
      } else if (u.active < 1.7) {
        if (!u.printed) {
          u.printed = true;
          u.sheetHolder.visible = true;
          if (u.barMat) u.barMat.color.setRGB(green[0] * 0.55, green[1] * 0.55, green[2] * 0.55);
          u.barHolder.position.z = u.barPivot[2] - 0.28;
          c.env.play('clack', u.worldPos.x, u.worldPos.z, 5.5);
        }
        const slideK = smooth((u.active - 1.25) / 0.45);
        u.sheetHolder.position.x = u.trayX - u.faceDir * 0.22 * (1 - slideK);
      } else {
        u.sheetHolder.position.x = u.trayX;
        u.active = 0;
        u.cool = 6.5;
      }
    }
  });
}

export const MORE4 = { vestibule, copiers, ...MORE5 };
