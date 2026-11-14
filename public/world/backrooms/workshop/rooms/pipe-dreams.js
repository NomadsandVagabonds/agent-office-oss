// The Backrooms — Workshop Room: Pipe Dreams (inspired by Level 2 & Entity 3, The Smiler).
// Narrow stained-concrete service tunnel lined with hot/chilled/synergy pipes, caged amber lamps,
// brass steam-release valves (`E`), a timed utility breaker (`E`), and a hostile Smiler lurking in
// the shadow alcove whose eyes and grin blaze in the dark and lunge if your camcorder LIGHT hits it.
import * as THREE from 'three';
import { Vox, M, tone } from '../../../vox/vox.js';
import { Batch, lin, WHITE } from '../../kit.js';
import { P, card } from '../../bits.js';
import { placeAlmondWater } from '../items/almond-water.js';
import { spawnSmiler } from '../creatures/smiler.js';

/** Cast-iron red handwheel valve on a brass stem, origin at hub so spinning about X/Z turns the wheel. */
function wheelValveVox() {
  const v = new Vox();
  const red = M('#c43b30', 0), brass = M('#c89d44', 0), dark = tone(red, -0.2);
  v.cyl('x', 0, 0, -3, 1, 1.3, brass);
  for (let a = 0; a < 24; a++) {
    const rad = (a / 24) * Math.PI * 2;
    const y = Math.round(Math.cos(rad) * 5), z = Math.round(Math.sin(rad) * 5);
    v.box(0, y, z, 2, y + 1, z + 1, (a & 1) ? red : dark);
  }
  v.box(0, -5, 0, 1, 6, 1, red);
  v.box(0, 0, -5, 1, 1, 6, red);
  v.box(1, -1, -1, 3, 2, 2, brass);
  return v;
}

export function pipeDreams(c) {
  const { W, D, H, R, params: p, kit, rt } = c;

  // Reserve coin-stash bays near the +z entry corners
  for (const s of [-1, 1]) c.reserve(s * (W / 2 - 1.05), D / 2 - 1.15, 0.55);

  const wallTex = kit.tex.custom(`pipes:wall:${c.room.id}`, 128, 128, (g) => {
    P(g, '#4a4d4f', 0, 0, 128, 128);
    // Concrete formwork seams & tie-rod dimples
    P(g, '#3b3e40', 0, 63, 128, 2);
    P(g, '#3b3e40', 63, 0, 2, 128);
    for (const [x, y] of [[16, 20], [48, 20], [80, 20], [112, 20], [16, 84], [48, 84], [80, 84], [112, 84]]) {
      P(g, '#2d2f31', x - 2, y - 2, 4, 4);
    }
    // Damp mineral streaks
    for (let i = 0; i < 18; i++) {
      g.fillStyle = i % 2 ? 'rgba(28,32,30,0.22)' : 'rgba(95,88,72,0.14)';
      g.fillRect((i * 23) % 124, (i * 17) % 90, 3 + (i % 5), 24 + (i % 30));
    }
  });

  const floorTex = kit.tex.custom('pipes:floor', 64, 64, (g) => {
    P(g, '#2e3134', 0, 0, 64, 64);
    for (let i = 0; i < 24; i++) {
      P(g, i % 3 ? '#26292c' : '#383632', (i * 19) % 60, (i * 31) % 60, 5, 4);
    }
  });

  const ceilTex = kit.tex.custom('pipes:ceil', 64, 64, (g) => {
    P(g, '#242629', 0, 0, 64, 64);
    for (let x = 0; x < 64; x += 16) P(g, '#1c1e20', x, 0, 3, 64);
  });

  c.shell({ wallTex, floorTex, ceilTex, skirting: false, panels: false });

  const iron = [0.24, 0.25, 0.27], rust = [0.42, 0.24, 0.16], copper = [0.58, 0.36, 0.22], lagging = [0.58, 0.6, 0.58];

  // Continuous overhead pipe runs along both walls (above doorway height so headroom & doors stay 100% clear)
  for (const sx of [-1, 1]) {
    const px = sx * (W / 2 - 0.22);
    c.flat.box(px - 0.09, 2.22, -D / 2 + 0.1, px + 0.09, 2.40, D / 2 - 0.1, lagging);
    c.flat.box(px - 0.06, 2.46, -D / 2 + 0.1, px + 0.06, 2.58, D / 2 - 0.1, copper);
  }
  // Overhead cross-headers & vertical stanchions away from doorways
  for (const hz of [-D / 2 + 2.5, D / 2 - 2.65]) {
    c.flat.box(-W / 2 + 0.15, 2.34, hz - 0.07, W / 2 - 0.15, 2.48, hz + 0.07, iron);
  }

  // Waist/chest pipe banks split into near (+z) and far (-z) halves, leaving side doorways (z ~ 0) & stash corners open
  const zNear0 = 1.45, zNear1 = D / 2 - 1.85;
  const zFar0 = -D / 2 + 0.45, zFar1 = -1.45;
  let labelIdx = 0;
  for (const sx of [-1, 1]) {
    const wallX = sx * (W / 2 - 0.16);
    for (const [za, zb] of [[zFar0, zFar1], [zNear0, zNear1]]) {
      if (zb - za < 1.1) continue;
      c.flat.box(wallX - 0.08, 0.52, za, wallX + 0.08, 0.68, zb, rust);
      c.flat.box(wallX - 0.09, 1.02, za, wallX + 0.09, 1.20, zb, lagging);
      c.flat.box(wallX - 0.06, 1.48, za, wallX + 0.06, 1.60, zb, copper);
      // Riser elbows into floor & ceiling at bank ends + solid guard rail collider hugs wall tightly (0.28 m deep)
      for (const ze of [za + 0.12, zb - 0.12]) {
        c.flat.box(wallX - 0.07, 0, ze - 0.07, wallX + 0.07, H, ze + 0.07, iron, { skip: '-y+y' });
      }
      c.solid(Math.min(wallX - 0.14, sx * W / 2), za, Math.max(wallX + 0.14, sx * W / 2), zb, { tall: true });

      // Stenciled pipe label plate
      const txt = p.labels[labelIdx++ % p.labels.length];
      const ltex = card(c, `pipe:lbl:${c.room.id}:${labelIdx}`, [txt], {
        w: 112,
        h: 32,
        bg: '#d8cfb8',
        fg: '#1d1c18',
        edge: '#7c3228',
        size: 13,
        pad: 6,
      });
      const midZ = (za + zb) / 2;
      const rot = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
      c.board(c.mapped(`pipelbl${labelIdx}`, ltex), wallX - sx * 0.105, 1.11, midZ, 0.48, 0.14, rot);
    }
  }

  // Two dim amber/red bulkhead cage lamps near entry and far end; baked overhead worklights start dimmed (0.28)
  const cageTint = lin(p.lampTint);
  for (const [sx, lz] of [[-p.smilerSide, D / 2 - 2.3], [-p.smilerSide, -D / 2 + 1.6]]) {
    const side = sx < 0 ? 'left' : 'right';
    c.wbox(side, lz, 0.18, 1.92, 2.16, 0, 0.1, iron);
    c.hang(c.shining('bulkhead', kit.tex.white(), 2.2, cageTint), side, lz, 2.04, 0.12, 0.18, null, WHITE, 0.105);
    c.light(sx * (W / 2 - 0.45), 2.04, lz, p.lampTint, 0.55, { k: 2.2, far: 5.5, wrap: 0.4 });
  }

  // Overhead Emergency Worklamps (baked into vertex lighting so flipping the Utility Breaker illuminates the whole tunnel!)
  const workColor = '#fff0cc', workLin = lin(workColor);
  const workGroup = c.add(new THREE.Group());
  const workShining = new Batch();
  for (const wz of [-D / 4, 0, D / 4]) {
    c.flat.box(-0.18, H - 0.08, wz - 0.35, 0.18, H, wz + 0.35, iron, { skip: '+y' });
    c.light(0, H - 0.18, wz, workColor, 0.95, { k: 2.1, far: 9.5, axis: [0, -1, 0], floor: 0.28 });
    workShining.quad([-0.14, H - 0.085, wz - 0.3], [0.14, H - 0.085, wz - 0.3], [0.14, H - 0.085, wz + 0.3], [-0.14, H - 0.085, wz + 0.3]);
  }
  const workGeo = kit.plain(workShining);
  if (workGeo) workGroup.add(new THREE.Mesh(workGeo, kit.glowing(kit.tex.white(), 2.6, workLin)));
  workGroup.visible = false;

  let breakerTimer = 0, darkLevel = 0.04;
  c.after.push(() => {
    darkLevel = Math.min(rt.level, 0.045);
    rt.level = darkLevel;
    rt.u.dim.value = 0.28;
  });

  // Yellow Utility Breaker Box near the +z entrance wall
  const bSide = p.breakerSide < 0 ? 'left' : 'right';
  const bAt = D / 2 - 2.35;
  const bp = c.wallAt(bSide, bAt, 0.08);
  c.wbox(bSide, bAt, 0.34, 1.18, 1.62, 0, 0.11, lin('#d6a428'));
  c.wbox(bSide, bAt, 0.28, 1.22, 1.58, 0.11, 0.125, [0.18, 0.19, 0.2]);
  const handleB = new Batch();
  c.wbox(bSide, bAt, 0.06, 1.38, 1.50, 0.125, 0.20, lin('#c43b30'), { batch: handleB });
  const breakerHandle = c.dynamic(handleB, { pivot: [bp.x, 1.38, bp.z] });

  c.use({
    x: bp.x,
    z: bp.z,
    r: 1.65,
    cone: 0.4,
    label: 'throw utility breaker',
    when: () => breakerTimer <= 0,
    use: () => {
      breakerTimer = 18.0;
      workGroup.visible = true;
      rt.level = 0.26;
      rt.u.dim.value = 1.38;
      const w = c.toWorld(bp.x, bp.z);
      c.env.play('clunk', w.x, w.z, 7);
    },
  });

  // Two Interactive Steam Release Valves (`E`) + animated billowing steam clouds
  const valves = [];
  const puffGeo = kit.own(new THREE.SphereGeometry(0.28, 8, 6));
  const puffMat = kit.own(new THREE.MeshBasicMaterial({ color: 0xdfe6e8, transparent: true, opacity: 0.34, depthWrite: false }));

  for (const [sx, vz] of [[-p.smilerSide, Math.min(2.1, zNear1 - 0.35)], [p.smilerSide, Math.max(-2.1, zFar1 - 0.45)]]) {
    const vx = sx * (W / 2 - 0.28);
    const wheelB = new Batch(true);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sx < 0 ? 0 : Math.PI);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(vx, 1.12, vz), q, new THREE.Vector3(0.025, 0.025, 0.025));
    wheelB.addVox(kit.model('workshop:valve', wheelValveVox).solid, m);
    const wheel = c.dynamic(wheelB, { pivot: [vx, 1.12, vz] });

    const puffs = Array.from({ length: 7 }, (_, i) => {
      const mesh = c.add(new THREE.Mesh(puffGeo, puffMat));
      mesh.visible = false;
      mesh.renderOrder = 3;
      return { mesh, phase: i / 7 };
    });

    const vState = { vx, vz, sx, wheel, puffs, timer: 0, spin: 0 };
    valves.push(vState);

    c.use({
      x: vx - sx * 0.2,
      z: vz,
      r: 1.65,
      cone: 0.4,
      label: 'open steam valve',
      when: () => vState.timer <= 0.5,
      use: () => {
        vState.timer = 6.5;
        const w = c.toWorld(vx, vz);
        c.env.play('clack', w.x, w.z, 6);
        c.env.play('slide', w.x, w.z, 8);
      },
    });
  }

  // Optional Almond Water carton resting on a pipe-fitter's crate
  if (p.almond) {
    const cx = -p.smilerSide * (W / 2 - 0.95), cz = -2.35;
    if (c.clear(cx, cz, 0.48, 1.4)) {
      c.reserve(cx, cz, 0.52);
      const cr = c.crate(cx, cz, 0.54, 0.52, 0.54, 0.2, [0.44, 0.35, 0.24], { tall: false });
      placeAlmondWater(c, cx, cr.top, cz, { rot: -0.5, r: 1.6 });
    }
  }

  // Missing ceiling tile + dangling black phone cords above the Smiler's shadow alcove
  const homeX = p.smilerSide * (W / 2 - 1.28);
  const homeZ = -D / 2 + 2.35;
  const hole = c.hole(homeX, homeZ, 1);
  for (const [dx, dz, len] of [[-0.18, 0.12, 0.48], [0.15, -0.14, 0.36], [0.04, 0.22, 0.62]]) {
    c.flat.box(hole.x + dx - 0.01, hole.y - len, hole.z + dz - 0.01, hole.x + dx + 0.01, hole.y, hole.z + dz + 0.01, [0.03, 0.03, 0.04]);
  }
  c.blot(homeX, homeZ, 1.4, 1.4, { rgb: [0.02, 0.02, 0.03], a: 0.55 });

  spawnSmiler(c, {
    home: { x: homeX, z: homeZ, rot: Math.atan2(-homeX, D / 2 - homeZ) },
    ceilingY: hole.y,
    isLit: () => breakerTimer > 0,
    isSteamed: (sx, sz) => valves.some((v) => v.timer > 0 && Math.hypot((v.vx - v.sx * 1.4) - sx, v.vz - sz) < 3.6),
  });

  c.tick((dt, t) => {
    // Breaker countdown & warning flicker before tripping back off
    if (breakerTimer > 0) {
      breakerTimer -= dt;
      breakerHandle.rotation.x = Math.min(0.65, breakerHandle.rotation.x + dt * 5);
      if (breakerTimer <= 0) {
        breakerTimer = 0;
        workGroup.visible = false;
        rt.level = darkLevel;
        rt.u.dim.value = 0.28;
        const w = c.toWorld(bp.x, bp.z);
        c.env.play('clunk', w.x, w.z, 7);
      } else if (breakerTimer < 2.6) {
        const flick = Math.sin(t * 26) > -0.2 ? 1.35 : 0.42;
        rt.u.dim.value = flick;
        workGroup.visible = flick > 0.8;
      }
    } else if (breakerHandle.rotation.x > 0) {
      breakerHandle.rotation.x = Math.max(0, breakerHandle.rotation.x - dt * 5);
    }

    // Animate spinning valve wheels & billowing steam jets across the tunnel
    for (const v of valves) {
      if (v.timer > 0) {
        v.timer = Math.max(0, v.timer - dt);
        v.spin += dt * 9;
        v.wheel.rotation.x = v.spin;
        for (const pf of v.puffs) {
          pf.phase = (pf.phase + dt * 1.35) % 1;
          const k = pf.phase;
          pf.mesh.visible = true;
          pf.mesh.position.set(
            v.vx - v.sx * (0.25 + k * 2.6),
            1.12 + k * 0.48 + Math.sin(t * 6 + k * 5) * 0.08,
            v.vz + Math.sin(t * 4 + k * 9) * 0.38 * k,
          );
          const sc = (0.45 + k * 1.65) * Math.min(1, v.timer * 1.2);
          pf.mesh.scale.set(sc, sc * 0.85, sc);
        }
      } else if (v.puffs[0].mesh.visible) {
        for (const pf of v.puffs) pf.mesh.visible = false;
      }
    }
  });
}
