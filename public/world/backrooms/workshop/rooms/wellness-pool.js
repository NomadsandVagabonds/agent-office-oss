// The Backrooms — Workshop Room: Executive Wellness Suite (inspired by Level 37, The Poolrooms).
// Glazed ceramic tile walls, a sunken turquoise shallow pool you can wade through with ankle
// ripples, warm brass column sconces where a friendly Paper-Wing Desk Moth roosts, and a spa bench
// holding complimentary Almond Water that tames the moth to guide you toward the true EXIT.
import * as THREE from 'three';
import { Vox, M, tone } from '../../../vox/vox.js';
import { lin, ticks, smooth, WHITE } from '../../kit.js';
import { P, framed, card } from '../../bits.js';
import { placeAlmondWater } from '../items/almond-water.js';
import { spawnDeskMoth } from '../creatures/desk-moth.js';

function towelStackVox(accent = '#4aa6a2') {
  return () => {
    const v = new Vox();
    const white = M('#f0eee6', 3), fold = tone(white, -0.1), teal = M(accent, 3);
    v.rbox(-5, 0, -4, 5, 3, 4, 1, white, 'xz');
    v.box(-5, 1, 3, 5, 2, 4, fold);
    v.rbox(-4, 3, -3, 4, 6, 3, 1, teal, 'xz');
    v.rbox(-4, 6, -3, 3, 8, 2, 1, white, 'xz');
    return v;
  };
}

export function wellnessPool(c) {
  const { W, D, H, R, params: p, kit } = c;

  // Keep both potential coin-stash corners completely clear of furniture
  for (const s of [-1, 1]) c.reserve(s * (W / 2 - 1.05), -D / 2 + 1.05, 0.55);

  // Glazed ceramic wall & promenade floor tiles
  const wallTex = kit.tex.custom(`wellness:wall:${p.tile}:${p.grout}`, 64, 64, (g) => {
    P(g, p.grout, 0, 0, 64, 64);
    for (let y = 0; y < 64; y += 16) {
      for (let x = 0; x < 64; x += 16) {
        P(g, p.tile, x + 1, y + 1, 14, 14);
        P(g, 'rgba(255,255,255,0.42)', x + 1, y + 1, 13, 2);
        P(g, 'rgba(255,255,255,0.25)', x + 1, y + 3, 2, 11);
        P(g, 'rgba(0,0,0,0.06)', x + 2, y + 13, 13, 2);
      }
    }
  });

  const floorTex = kit.tex.custom(`wellness:floor:${p.tile}:${p.grout}`, 64, 64, (g) => {
    P(g, p.grout, 0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        P(g, (x + y) % 16 === 0 ? p.tile : '#d4e2df', x + 1, y + 1, 6, 6);
      }
    }
  });

  c.shell({ floor: false, wallTex, skirting: false, sockets: false });

  // Wide 1.95 m dry tiled promenade around all four sides so every doorway & stash corner connects cleanly
  const prom = 1.95;
  const x0 = -W / 2 + prom, x1 = W / 2 - prom;
  const z0 = -D / 2 + prom, z1 = D / 2 - prom;
  const deep = 0.34;

  const floorB = c.mapped('poolfloor', floorTex);
  const strip = (ax, az, bx, bz) => floorB.grid(
    [ax, 0, az], [0, 0, 1], [1, 0, 0],
    ticks(bz - az), ticks(bx - ax),
    (u, v) => [(ax + v) / 0.8, (az + u) / 0.8],
    WHITE,
    (u, v) => 0.8 + 0.2 * smooth(Math.min(ax + v + W / 2, W / 2 - ax - v, az + u + D / 2, D / 2 - az - u) / 0.45),
  );
  strip(-W / 2, -D / 2, W / 2, z0);
  strip(-W / 2, z1, W / 2, D / 2);
  strip(-W / 2, z0, x0, z1);
  strip(x1, z0, W / 2, z1);

  // Sunken turquoise ceramic basin + lap-lane stripe down the middle
  const basinTex = kit.tex.custom(`wellness:basin:${p.water}`, 64, 64, (g) => {
    P(g, '#7cc9c4', 0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        P(g, (x + y) % 16 ? '#b8ebe6' : '#a4dfd9', x + 1, y + 1, 6, 6);
      }
    }
  });
  const tb = c.mapped('basintile', basinTex);
  const uvt = (u, v) => [u / 0.45, v / 0.45];
  const zz = ticks(z1 - z0, 0.8, 0), xx = ticks(x1 - x0, 0.8, 0), sideShade = () => 0.76;
  tb.grid([x0, -deep, z1], [0, 0, -1], [0, 1, 0], zz, [0, deep], uvt, WHITE, sideShade);
  tb.grid([x1, -deep, z0], [0, 0, 1], [0, 1, 0], zz, [0, deep], uvt, WHITE, sideShade);
  tb.grid([x0, -deep, z0], [1, 0, 0], [0, 1, 0], xx, [0, deep], uvt, WHITE, sideShade);
  tb.grid([x1, -deep, z1], [-1, 0, 0], [0, 1, 0], xx, [0, deep], uvt, WHITE, sideShade);
  tb.grid([x0, -deep, z0], [0, 0, 1], [1, 0, 0], zz, xx, uvt, WHITE, () => 0.88);

  // Cobalt lap-lane marker on the pool bed ("SILENT LAP LANE")
  const lane = lin('#1e4f6e');
  c.flat.box(-0.11, -deep + 0.002, z0 + 0.55, 0.11, -deep + 0.008, z1 - 0.55, lane, { skip: '-y' });
  for (const lz of [z0 + 0.55, z1 - 0.55]) {
    c.flat.box(-0.36, -deep + 0.002, lz - 0.08, 0.36, -deep + 0.008, lz + 0.08, lane, { skip: '-y' });
  }

  // Coping stones framing the pool rim + chrome entry handrail on the near (+z) end
  const stone = lin('#e4e1d6'), chrome = [0.76, 0.79, 0.83];
  for (const [a, b, e, f] of [
    [x0 - 0.14, z0 - 0.14, x1 + 0.14, z0],
    [x0 - 0.14, z1, x1 + 0.14, z1 + 0.14],
    [x0 - 0.14, z0, x0, z1],
    [x1, z0, x1 + 0.14, z1],
  ]) {
    c.flat.box(a, 0, b, e, 0.026, f, stone, { skip: '-y' });
  }
  for (const hx of [-0.42, 0.42]) {
    c.flat.box(hx - 0.018, 0, z1 + 0.24, hx + 0.018, 0.78, z1 + 0.28, chrome);
    c.flat.box(hx - 0.018, 0.74, z1 - 0.32, hx + 0.018, 0.78, z1 + 0.28, chrome);
    c.flat.box(hx - 0.018, -deep, z1 - 0.36, hx + 0.018, 0.78, z1 - 0.32, chrome);
  }

  // Underwater cyan pool lamps casting serene caustics up onto the tiled walls & ceiling
  const waterGlow = lin(p.water);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * (x1 - 0.45), lz = sz * (z1 - 0.45);
    c.light(lx, 0.18, lz, p.water, 0.62, { k: 1.7, far: 6.8, wrap: 0.55 });
    const gz = sz > 0 ? z1 - 0.008 : z0 + 0.008;
    const gx0 = lx - 0.14, gx1 = lx + 0.14;
    if (sz > 0) {
      c.shining('poollamp', kit.tex.white(), 2.2, waterGlow).quad(
        [gx1, -0.22, gz], [gx0, -0.22, gz], [gx0, -0.10, gz], [gx1, -0.10, gz],
      );
    } else {
      c.shining('poollamp', kit.tex.white(), 2.2, waterGlow).quad(
        [gx0, -0.22, gz], [gx1, -0.22, gz], [gx1, -0.10, gz], [gx0, -0.10, gz],
      );
    }
  }

  // Four tiled natatorium columns at the basin corners, each with a warm brass sconce & Desk Moth perch
  const wallB = c.mapped('wall', wallTex);
  const brass = [0.76, 0.62, 0.32], warm = lin('#ffe0a6');
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const perches = [];
  corners.forEach(([sx, sz], idx) => {
    const cx = sx * x1, cz = sz * z1, pw = 0.42;
    c.pillar(cx, cz, pw, pw, { batch: wallB, skirting: false });
    // Mount sconce on the promenade-facing side (`sz` toward front/back walkway)
    const faceZ = cz + sz * (pw / 2 + 0.02);
    c.flat.box(cx - 0.09, 1.82, Math.min(faceZ, cz + sz * (pw / 2 + 0.09)), cx + 0.09, 1.98, Math.max(faceZ, cz + sz * (pw / 2 + 0.09)), brass);
    const lquadZ = cz + sz * (pw / 2 + 0.095);
    if (sz > 0) {
      c.shining('sconce', kit.tex.white(), 2.4, warm).quad([cx - 0.07, 1.85, lquadZ], [cx + 0.07, 1.85, lquadZ], [cx + 0.07, 1.96, lquadZ], [cx - 0.07, 1.96, lquadZ]);
    } else {
      c.shining('sconce', kit.tex.white(), 2.4, warm).quad([cx + 0.07, 1.85, lquadZ], [cx - 0.07, 1.85, lquadZ], [cx - 0.07, 1.96, lquadZ], [cx + 0.07, 1.96, lquadZ]);
    }
    c.light(cx, 1.92, cz + sz * 0.42, '#ffe0a6', 0.42, { k: 1.6, far: 5.2, wrap: 0.45 });
    perches.push({
      x: cx,
      y: 2.0,
      z: cz + sz * (pw / 2 + 0.08),
      rot: sz > 0 ? 0 : Math.PI,
      idx,
    });
  });
  // Rotate perches so the rolled `p.mothCorner` is where the Desk Moth starts
  const orderedPerches = perches.slice(p.mothCorner).concat(perches.slice(0, p.mothCorner));

  // Shimmering translucent caustic water sheet + ankle ripple ring
  const waterTex = kit.tex.custom(`wellness:water:${p.water}`, 64, 64, (g) => {
    P(g, p.water, 0, 0, 64, 64);
    g.strokeStyle = 'rgba(240,255,252,0.45)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse((i * 19) % 64, (i * 29) % 64, 10 + (i % 5) * 2, 6 + (i % 4) * 2, i * 0.5, 0, Math.PI * 2);
      g.stroke();
    }
  });
  waterTex.repeat.set((x1 - x0) / 1.8, (z1 - z0) / 1.8);
  const waterGeo = kit.own(new THREE.PlaneGeometry(x1 - x0, z1 - z0));
  const waterMat = kit.own(new THREE.MeshBasicMaterial({
    map: waterTex,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  }));
  const waterMesh = c.add(new THREE.Mesh(waterGeo, waterMat));
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set((x0 + x1) / 2, -0.055, (z0 + z1) / 2);
  waterMesh.renderOrder = 2;

  const rippleGeo = kit.own(new THREE.RingGeometry(0.16, 0.22, 24));
  const rippleMat = kit.own(new THREE.MeshBasicMaterial({
    color: 0xe8fffd,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  const ripple = c.add(new THREE.Mesh(rippleGeo, rippleMat));
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = -0.048;
  ripple.renderOrder = 3;

  // Spa bench along a clear stretch of the side promenade + folded towels + complimentary Almond Water
  const sideName = p.benchSide < 0 ? 'left' : 'right';
  const sideSpans = c.spans(sideName, 0.55, 2.0).filter(([a, b]) => b - a >= 1.45);
  // Prefer a span away from z = 0 doorway and away from the z = -D/2 + 1.05 stash corner (e.g. near +z half)
  sideSpans.sort((u, v) => ((v[0] + v[1]) / 2) - ((u[0] + u[1]) / 2));
  const benchAt = sideSpans.length ? Math.min(sideSpans[0][1] - 0.72, Math.max(sideSpans[0][0] + 0.72, D / 2 - 2.4)) : D / 2 - 2.4;
  const bp = c.wallAt(sideName, benchAt, 0.34);
  c.reserve(bp.x, bp.z, 0.85);
  c.crate(bp.x, bp.z, 1.28, 0.44, 0.46, bp.rot, stone, { tall: false });
  // Bench legs recess visual
  c.model('workshop:towels', towelStackVox(p.water), bp.x + bp.U[0] * 0.32, bp.z + bp.U[2] * 0.32, {
    y: 0.44,
    rot: bp.rot + 0.12,
    solid: false,
    shadow: false,
  });
  if (p.towels >= 3) {
    c.model('workshop:towels2', towelStackVox('#5c8fa8'), bp.x, bp.z, {
      y: 0.44,
      rot: bp.rot - 0.2,
      scale: 0.85,
      solid: false,
      shadow: false,
    });
  }

  const ax = bp.x - bp.U[0] * 0.36, az = bp.z - bp.U[2] * 0.36;
  const almond = placeAlmondWater(c, ax, 0.44, az, { rot: bp.rot + 0.4, r: 1.65 });

  // Enamel wellness rules board
  const signSpot = c.wallSpot(2.1, ['back', 'left', 'right'], 0.5, 2.1);
  if (signSpot) {
    const tex = card(c, `wellness:sign:${c.room.id}`, p.sign, {
      w: 192,
      h: 64,
      bg: '#f2f7f6',
      fg: '#174854',
      edge: '#3a8c88',
      size: 14,
      pad: 12,
    });
    framed(c, c.mapped('wellnesssign', tex), signSpot.side, signSpot.at, 1.66, 1.56, 0.52, null, [0.74, 0.78, 0.78]);
  }

  // Spawn the friendly Paper-Wing Desk Moth on the warm column sconces
  spawnDeskMoth(c, {
    perches: orderedPerches,
    almondSpot: { x: ax, y: 0.44, z: az, isTaken: () => almond.taken },
  });

  // Shallow pool wading physics & gentle caustic/ripple animation
  let wasInPool = false, ripPhase = 1;
  c.tick((dt, t, me) => {
    waterTex.offset.x = (t * 0.035) % 1;
    waterTex.offset.y = Math.sin(t * 0.45) * 0.08;

    const inPool = me.inside && me.x > x0 + 0.08 && me.x < x1 - 0.08 && me.z > z0 + 0.08 && me.z < z1 - 0.08;
    if (inPool) {
      me.world.slow = 0.68;
      me.world.sinkTo = 0.24;
      if (!wasInPool || (me.moving && ripPhase > 0.72)) {
        ripPhase = 0;
        ripple.position.x = me.x;
        ripple.position.z = me.z;
        if (!wasInPool) {
          const w = c.toWorld(me.x, me.z);
          c.env.play('wade', w.x, w.z, 5);
        }
      }
    }
    wasInPool = inPool;
    if (me.inside) c.rt.footstep = inPool ? 'wade' : 'step';

    if (ripPhase < 1) {
      ripPhase = Math.min(1, ripPhase + dt * 1.35);
      const s = 0.8 + ripPhase * 2.6;
      ripple.scale.set(s, s, 1);
      rippleMat.opacity = (1 - ripPhase) * 0.42;
    } else if (rippleMat.opacity > 0) {
      rippleMat.opacity = 0;
    }
  });
}
