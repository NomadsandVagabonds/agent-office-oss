// The Backrooms — Workshop Room: Night Custodial (inspired by Level 4, Abandoned Office & Entity 9, Facelings).
// Dimly lit empty office floor with dark rain-streaked nocturnal windows, chairs stacked upside-down
// on desks for mopping, a neutral Night Porter Faceling endlessly mopping dry carpet beside a tippable
// yellow bucket, and a locked custodial supply locker that swings open if you help or hydrate the porter.
import { Vox, M } from '../../../vox/vox.js';
import { Batch, lin, WHITE } from '../../kit.js';
import { P, framed, card, wetSign } from '../../bits.js';
import { placeAlmondWater } from '../items/almond-water.js';
import { spawnNightPorter } from '../creatures/faceling.js';

function sprayBottleVox() {
  const v = new Vox();
  const body = M('#dce6ec', 1), label = M('#3878a8', 0), head = M('#c83e34', 0);
  v.rbox(-2, 0, -2, 2, 6, 2, 1, body, 'xz');
  v.box(-2, 2, -2, 2, 4, 2, label);
  v.box(-1, 6, -1, 1, 8, 1, body);
  v.box(-1, 8, -1, 2, 10, 2, head);
  v.box(1, 7, 1, 2, 9, 3, head);
  return v;
}

export function nightShift(c) {
  const { W, D, R, params: p, kit } = c;

  // Keep both coin-stash corners near -z completely clear
  for (const s of [-1, 1]) c.reserve(s * (W / 2 - 1.05), -D / 2 + 1.05, 0.55);

  c.shell();

  // Rain-streaked dark nocturnal office windows (impossible underground night sky)
  const rainTex = kit.tex.custom(`night:win:${c.room.id}`, 96, 128, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#0d1522');
    grad.addColorStop(0.65, '#17263b');
    grad.addColorStop(1, '#243852');
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 128);

    // Distant out-of-focus city horizon dots that have no business existing down here
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 3 === 0 ? 'rgba(255,214,150,0.28)' : 'rgba(165,205,255,0.22)';
      g.fillRect((i * 19 + 7) % 88, 78 + (i * 11) % 34, 3 + (i % 3), 2 + (i % 2));
    }
    // Diagonal rain streaks on glass
    g.strokeStyle = 'rgba(185,215,245,0.24)';
    g.lineWidth = 1;
    for (let i = 0; i < 34; i++) {
      const x = (i * 17) % 94, y = (i * 29) % 116;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 3, y + 12);
      g.stroke();
    }
  }, { clamp: true });

  const frameCol = [0.16, 0.18, 0.21];
  for (const side of ['back', 'left', 'right']) {
    for (const [a, b] of c.spans(side, 0.65, 2.35)) {
      if (b - a < 1.7) continue;
      const mid = (a + b) / 2, ww = Math.min(1.85, b - a - 0.25), wh = 1.22, wy = 1.56;
      c.wbox(side, mid, ww + 0.12, wy - wh / 2 - 0.06, wy + wh / 2 + 0.06, 0, 0.035, frameCol);
      c.wbox(side, mid, 0.04, wy - wh / 2, wy + wh / 2, 0.035, 0.055, frameCol);
      c.wbox(side, mid, ww + 0.18, wy - wh / 2 - 0.08, wy - wh / 2 - 0.02, 0, 0.09, [0.24, 0.26, 0.29]);
      const wp = c.hang(c.shining('nightwin', rainTex, 1.35), side, mid, wy, ww, wh, null, WHITE, 0.038);
      c.light(wp.x + wp.n[0] * 0.45, wy, wp.z + wp.n[2] * 0.45, '#5a82ad', 0.36, { k: 1.6, far: 5.5, wrap: 0.45 });
      break; // at most one nocturnal window per wall so rooms keep a realistic layout
    }
  }

  // Reserve space for the Night Porter & tippable mop bucket first so desks never crowd them
  const porterHome = {
    x: p.porterSide * (W / 2 - 1.85),
    z: 1.35,
    rot: Math.atan2(-p.porterSide, -0.35),
  };
  const bucketPos = {
    x: p.porterSide * (W / 2 - 2.42),
    z: 0.88,
  };
  c.reserve(porterHome.x, porterHome.z, 0.85);
  c.reserve(bucketPos.x, bucketPos.z, 0.65);

  // Custodial Supply Locker on the opposite side wall (`-p.porterSide`), unlocked when porter is thanked/helped
  const lockerSide = p.porterSide < 0 ? 'right' : 'left';
  const lSpans = c.spans(lockerSide, 0.55, 2.15).filter(([a, b]) => b - a >= 1.05);
  // Pick a span away from doorways and stash corners
  lSpans.sort((u, v) => Math.abs((u[0] + u[1]) / 2 + 1.4) - Math.abs((v[0] + v[1]) / 2 + 1.4));
  const lAt = lSpans.length ? Math.max(lSpans[0][0] + 0.48, Math.min(lSpans[0][1] - 0.48, -1.55)) : -1.55;
  const lp = c.wallAt(lockerSide, lAt, 0.25);
  c.reserve(lp.x, lp.z, 0.85);

  const steel = lin('#56636a'), darkSteel = lin('#394348'), shelfCol = lin('#7a848a'), brass = [0.78, 0.64, 0.28];
  const lw = 0.76, lh = 1.92, ld = 0.46;
  // Hollow steel cabinet body: left/right sides, top, bottom, back, and middle shelf
  c.wbox(lockerSide, lAt - lw / 2 + 0.02, 0.04, 0, lh, 0.02, ld, steel);
  c.wbox(lockerSide, lAt + lw / 2 - 0.02, 0.04, 0, lh, 0.02, ld, steel);
  c.wbox(lockerSide, lAt, lw, 0, 0.06, 0.02, ld, darkSteel);
  c.wbox(lockerSide, lAt, lw, lh - 0.05, lh, 0.02, ld, steel);
  c.wbox(lockerSide, lAt, lw - 0.08, 0.06, lh - 0.05, 0.02, 0.06, darkSteel);
  c.wbox(lockerSide, lAt, lw - 0.08, 0.96, 1.0, 0.06, ld - 0.04, shelfCol);
  // Solid footprint for the cabinet box itself
  const la = c.wallAt(lockerSide, lAt - lw / 2, 0.02), lb = c.wallAt(lockerSide, lAt + lw / 2, ld);
  c.solid(Math.min(la.x, lb.x), Math.min(la.z, lb.z), Math.max(la.x, lb.x), Math.max(la.z, lb.z), { tall: true });

  // Evacuation hint card taped inside the back of the locker + interior Almond Water reward!
  const pathToExit = c.world.path(c.room.id, c.level.exit.room) || [];
  const distSteps = Math.max(1, pathToExit.length - 1);
  const hintTex = card(c, `night:hint:${c.room.id}`, [
    `WAY OUT: ${distSteps} ${distSteps === 1 ? 'ROOM' : 'ROOMS'}`,
    `PAST ${c.level.hint.toUpperCase()}`,
  ], { w: 144, h: 52, bg: '#f4eed8', fg: '#1e2830', edge: '#b54238', size: 12, pad: 8 });
  c.hang(c.mapped('lockerhint', hintTex), lockerSide, lAt, 1.42, 0.56, 0.21, null, WHITE, 0.072);
  c.light(lp.x + lp.n[0] * 0.15, 1.52, lp.z + lp.n[2] * 0.15, '#ffe3a8', 0.28, { k: 1.8, far: 3.0 });

  let lockerOpen = false, lockerAnim = 0;
  const inShelf = c.wallAt(lockerSide, lAt + 0.12, 0.26);
  placeAlmondWater(c, inShelf.x, 1.0, inShelf.z, {
    rot: inShelf.rot,
    r: 1.65,
    when: () => lockerOpen,
  });

  // Hinged steel locker door (`c.dynamic`), hinged at `lAt - lw/2 + 0.03` so it swings cleanly into the room
  const doorB = new Batch();
  c.wbox(lockerSide, lAt, lw - 0.06, 0.06, lh - 0.06, ld, ld + 0.03, steel, { batch: doorB });
  for (const ly of [1.56, 1.62, 1.68, 0.34, 0.40]) {
    c.wbox(lockerSide, lAt, lw * 0.55, ly, ly + 0.022, ld + 0.03, ld + 0.04, darkSteel, { batch: doorB });
  }
  c.wbox(lockerSide, lAt + lw * 0.32, 0.05, 1.02, 1.14, ld + 0.03, ld + 0.07, brass, { batch: doorB });
  const hingePt = c.wallAt(lockerSide, lAt - lw / 2 + 0.03, ld + 0.015);
  const lockerDoor = c.dynamic(doorB, { pivot: [hingePt.x, 0, hingePt.z] });

  // Trying the locked supply locker before earning the porter's trust rattles the latch
  const frontLocker = c.wallAt(lockerSide, lAt, ld + 0.12);
  c.use({
    x: frontLocker.x,
    z: frontLocker.z,
    r: 1.5,
    cone: 0.45,
    label: 'try supply locker',
    when: () => !lockerOpen,
    use: () => {
      const w = c.toWorld(frontLocker.x, frontLocker.z);
      c.env.play('rattle', w.x, w.z, 5);
    },
  });

  // Custodial utility cart on `p.porterSide` near +z with spray bottle, wet-floor sign & optional Almond Water
  const cartX = p.porterSide * (W / 2 - 0.78), cartZ = D / 2 - 1.85;
  if (c.clear(cartX, cartZ, 0.52, 1.5)) {
    c.reserve(cartX, cartZ, 0.58);
    const cartCol = lin('#3a424a');
    c.crate(cartX, cartZ, 0.52, 0.78, 0.84, 0, cartCol, { tall: false });
    c.model('workshop:spray', sprayBottleVox, cartX - 0.12, cartZ - 0.22, { y: 0.78, rot: 0.5, solid: false, shadow: false });
    if (p.cartAlmond) {
      placeAlmondWater(c, cartX + 0.1, 0.78, cartZ + 0.18, { rot: -0.35, r: 1.65 });
    }
  }

  wetSign(c, porterHome.x - p.porterSide * 0.45, porterHome.z + 0.92, 0.35 * p.porterSide, ['CAUTION', 'DRY FLOOR']);

  // Late-night desks with office chairs stacked upside-down on top so the floor underneath can be mopped
  const chairGeo = c.env.catalogue.geo('chair', { color: p.chairColor });
  const chairH = chairGeo ? (chairGeo.bounds.y1 - chairGeo.bounds.y0) * 0.025 : 0.85;
  const candidateDesks = [
    [-p.porterSide * 1.35, -1.25, 0],
    [p.porterSide * 1.15, -1.55, Math.PI],
    [-p.porterSide * 1.35, 1.45, Math.PI],
  ];
  let placedDesks = 0;
  for (const [dx, dz, drot] of candidateDesks) {
    if (placedDesks >= p.desks) break;
    if (!c.clear(dx, dz, 0.88, 1.9)) continue;
    c.reserve(dx, dz, 0.95);
    const deskFoot = c.prop('desk', dx, dz, { rot: drot, fallback: [1.3, 0.74, 0.7] });
    c.prop('chair', dx + R.range(-0.12, 0.12), dz + R.range(-0.08, 0.08), {
      y: deskFoot.top + chairH,
      rot: drot + R.range(-0.4, 0.4),
      flip: true,
      solid: false,
      shadow: false,
      o: { color: p.chairColor },
    });
    placedDesks++;
  }

  // Framed Night Custodial Memo on a free wall span
  const memoSpot = c.wallSpot(1.6, ['back', 'front', 'left', 'right'], 0.45, 2.0);
  if (memoSpot) {
    const mtex = card(c, `night:memo:${c.room.id}`, p.memo, {
      w: 176,
      h: 60,
      bg: '#efe9d6',
      fg: '#221e18',
      edge: '#5a6670',
      size: 13,
      pad: 10,
    });
    framed(c, c.mapped('nightmemo', mtex), memoSpot.side, memoSpot.at, 1.52, 1.24, 0.42);
  }

  // Spawn the neutral Night Porter Faceling + tippable yellow mop bucket
  spawnNightPorter(c, {
    home: porterHome,
    bucket: bucketPos,
    onReward: () => {
      lockerOpen = true;
      const w = c.toWorld(frontLocker.x, frontLocker.z);
      c.env.play('clunk', w.x, w.z, 6);
      c.env.play('door', w.x, w.z, 6);
    },
  });

  // Swing the locker door into the room once unlocked (+yaw on left wall, -yaw on right wall)
  const openDir = lockerSide === 'left' ? 1 : -1;
  c.tick((dt) => {
    if (!lockerOpen || lockerAnim >= 1) return;
    lockerAnim = Math.min(1, lockerAnim + dt / 0.75);
    const e = lockerAnim * lockerAnim * (3 - 2 * lockerAnim);
    lockerDoor.rotation.y = openDir * 1.85 * e;
  });
}
