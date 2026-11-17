// The Backrooms — sculpted `Vox` models for The Offsite Reserve (`forest`).
//
// Every model here is built with organic `Vox` primitives (`ellipsoid`, `rbox`,
// `tube`, `sphere`, `cyl`, `ring`, `carve` at ~2.5–3.8 cm per voxel) — never
// flat Minecraft boxes:
//   1. Claustrophobic woodland flora: `gnarledPineVox`, `gnarledBirchVox`,
//      `cypressBogTreeVox`, `fernClumpVox`, `mushroomRingVox`,
//      `fallenNurseLogVox`, `mossBoulderVox`, `cattailReedsVox`
//   2. Surreal office-forest mashups: `drownedWorkstationVox`,
//      `splitLogBenchVox`, `cellophaneFireVox`, `ancientHollowTreeVox`
//   3. Sad displaced woodland creatures: `sadFoxVox`, `sadBadgerVox`,
//      `sadOwlVox`, `sadFawnVox`
//   4. Clear-cut & forest-fire set pieces: `bulldozerVox`, `developerVox`,
//      `charredSnagVox`, `meltedCabinetVox`, `ashSproutPrinterVox`

import { Vox, M, glow } from '../vox/vox.js';

function pineBarkMat() {
  const cols = ['#4a3120', '#3b2517', '#5c3e29', '#2e1c11'].map((k) => M(k, 2));
  return (x, y, z) => {
    const sector = Math.floor(Math.atan2(z, x) * 1.92 + Math.floor(y * 0.032));
    return cols[((sector % cols.length) + cols.length) % cols.length];
  };
}

function birchBarkMat() {
  const white = M('#e6e2d6', 2), cream = M('#cfc8b6', 2), scar = M('#24221f', 2);
  return (x, y, z) => {
    const tier = Math.floor(y * 0.18);
    if (tier % 5 === 0 && (y % 6 === 0) && ((Math.abs(Math.floor(x * 0.5) + tier) % 3) === 0)) return scar;
    return tier % 3 === 0 ? cream : white;
  };
}

function needleMat() {
  const greens = ['#1d3b20', '#152b17', '#29502b', '#386936', '#457a3e'].map((k) => M(k, 2));
  return (x, y, z) => {
    // Upper surface of each bough catches cooler olive canopy highlights; undersides stay deep evergreen
    const topBias = y > 0 && (Math.floor(y) % 5 >= 3) ? 1 : 0;
    return greens[(Math.abs(Math.floor(y * 0.34) + Math.floor((x + z) * 0.18)) + topBias) % greens.length];
  };
}

function mossMat() {
  const moss = ['#355e2b', '#2b4d22', '#467336', '#53803e'].map((k) => M(k, 2));
  return (x, y, z) => moss[Math.abs(Math.floor((x + z) * 0.28) + Math.floor(y * 0.4)) % moss.length];
}

function charMat() {
  const chars = ['#171616', '#222020', '#100f10', '#2b2624'].map((k) => M(k, 3));
  return (x, y, z) => chars[Math.abs(Math.floor(y * 0.22) + Math.floor((x - z) * 0.25)) % chars.length];
}

/* ---- 1. Organic Claustrophobic Woodland Flora ----------------------------- */

/**
 * Sinuous gnarled pine (`gnarledPineVox`) with 5 snaking root buttresses, curved
 * multi-segment `tube` trunk, drooping `ellipsoid` needle bough pads, hanging
 * pinecones, amber sap scar, and stapled office asset barcode tag.
 */
export function gnarledPineVox(tallVoxels = 96, withBoughs = true) {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), needles = needleMat(), moss = mossMat();
    const sap = M('#df9b32', 1), cone = M('#52331c', 2), tag = M('#eef0ec', 1), ink = M('#1b1d1e', 1);

    // 5 snaking buttress roots gripping the moss
    for (let a = 0; a < 5; a++) {
      const th = (a / 5) * Math.PI * 2 + 0.25;
      const rx = Math.cos(th), rz = Math.sin(th);
      v.tube(rx * 12.5, 0.8, rz * 12.5, rx * 6.5, 4.5, rz * 6.5, 2.2, bark);
      v.tube(rx * 6.5, 4.5, rz * 6.5, rx * 2.5, 13, rz * 2.5, 2.9, bark);
      if (a % 2 === 0) v.ellipsoid(rx * 8.5, 2.2, rz * 8.5, 3.2, 1.4, 3.2, moss);
    }

    // Sinuous 3-stage curving trunk (`tube` segments)
    const y1 = Math.floor(tallVoxels * 0.36);
    const y2 = Math.floor(tallVoxels * 0.72);
    v.tube(0, 0, 0, 2.2, y1, -1.5, 5.9, bark);
    v.tube(2.2, y1, -1.5, -1.6, y2, 1.4, 5.1, bark);
    v.tube(-1.6, y2, 1.4, 0.6, tallVoxels, -0.4, 4.4, bark);

    // Peeled bark amber sap scar + stapled office barcode tag
    if (tallVoxels >= 52) {
      v.ellipsoid(5.2, 34, -0.5, 1.2, 4.5, 2.2, sap);
      v.rbox(-2.8, 42, 4.2, 2.8, 46.5, 5.8, 0.6, tag);
      v.box(-2.1, 43.2, 5.3, 2.1, 44.8, 6.1, ink);
    }

    if (withBoughs) {
      // Organic radiating limb boughs with drooping ellipsoid needle pads & pinecones!
      const levels = [0.38, 0.54, 0.70, 0.84];
      levels.forEach((frac, li) => {
        const by = Math.floor(tallVoxels * frac);
        if (by >= tallVoxels - 5) return;
        const cx = frac < 0.5 ? 1.4 : -0.8;
        const cz = frac < 0.5 ? -0.8 : 0.8;
        const reach = (16.5 - li * 2.4);
        const arms = li < 2 ? 4 : 3;
        for (let k = 0; k < arms; k++) {
          const ang = li * 1.15 + (k / arms) * Math.PI * 2;
          const ex = cx + Math.cos(ang) * reach;
          const ez = cz + Math.sin(ang) * reach;
          const droopY = by - 3.2;
          v.tube(cx, by + 1.5, cz, ex * 0.75, droopY + 1.2, ez * 0.75, 1.5, bark);
          v.ellipsoid(ex * 0.82, droopY + 1.4, ez * 0.82, 6.2 - li * 0.6, 2.8, 6.2 - li * 0.6, needles);
          if ((k + li) % 2 === 0) {
            v.ellipsoid(ex * 0.78, droopY - 1.8, ez * 0.78, 1.3, 2.3, 1.3, cone);
          }
        }
      });
    }
    return v;
  };
}

/**
 * Multi-stem V-forked papery white birch clump (`gnarledBirchVox`) with mossy
 * root bole, bracket polypore fungi, black lenticels, and upper catkins/leaves.
 */
export function gnarledBirchVox(tallVoxels = 92) {
  return () => {
    const v = new Vox();
    const birch = birchBarkMat(), moss = mossMat();
    const fungus = M('#cf6b24', 2), gill = M('#ead8b5', 2), leaf = M('#4b7a34', 2);

    v.ellipsoid(0, 2.5, 0, 8.2, 3.5, 8.2, moss);
    const yMid = Math.floor(tallVoxels * 0.48);
    // Primary leaning stem
    v.tube(-1.2, 0, 0, -3.6, yMid, 1.5, 4.1, birch);
    v.tube(-3.6, yMid, 1.5, -1.8, tallVoxels, -0.6, 3.5, birch);
    // Secondary diverging sister stem!
    v.tube(1.4, 0, 0.4, 4.8, Math.floor(tallVoxels * 0.44), -1.8, 3.1, birch);
    v.tube(4.8, Math.floor(tallVoxels * 0.44), -1.8, 6.2, Math.floor(tallVoxels * 0.86), 0.8, 2.5, birch);

    // Polypore shelf mushrooms stepped up the primary trunk
    for (const [fy, fx, fz, r] of [[19, -5.8, 1.2, 3.6], [24, -4.6, 3.8, 2.9], [46, -6.2, 0.5, 3.3]]) {
      if (fy >= tallVoxels - 8) continue;
      v.ellipsoid(fx, fy, fz, r, 1.3, r, fungus);
      v.ellipsoid(fx, fy - 0.6, fz, r * 0.82, 0.8, r * 0.82, gill);
    }

    // Leafy upper birch sprays
    for (const [lx, ly, lz] of [[-6.5, Math.floor(tallVoxels * 0.72), 3.2], [7.8, Math.floor(tallVoxels * 0.68), -1.5], [1.5, Math.floor(tallVoxels * 0.82), 4.2]]) {
      if (ly >= tallVoxels - 4) continue;
      v.ellipsoid(lx, ly, lz, 5.2, 2.4, 5.2, leaf);
    }
    return v;
  };
}

/**
 * Swollen fluted swamp cypress (`cypressBogTreeVox`) with 5 knobby cypress knees,
 * hanging Spanish moss curtains, and tangled grey Cat-5 ethernet vines!
 */
export function cypressBogTreeVox(tallVoxels = 96) {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), moss = M('#5f7848', 2), cat5 = M('#3c689c', 1), plug = M('#d8e2e8', 0);

    // Swollen fluted buttress base + 5 knobby knees poking out around the trunk
    v.cyl('y', 0, 0, 0, 18, 10.5, bark, 6.2);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      const kx = Math.cos(a) * 13.5, kz = Math.sin(a) * 13.5;
      v.tube(Math.cos(a) * 8, 1, Math.sin(a) * 8, kx, 2, kz, 2.2, bark);
      v.cyl('y', kx, kz, 0, 9 + (k % 3) * 3, 2.6, bark, 1.4);
      v.ellipsoid(kx, 9.5 + (k % 3) * 3, kz, 1.7, 2.0, 1.7, bark);
    }

    const yMid = Math.floor(tallVoxels * 0.52);
    v.tube(0, 16, 0, 1.8, yMid, -1.2, 5.6, bark);
    v.tube(1.8, yMid, -1.2, -0.9, tallVoxels, 0.9, 4.6, bark);

    // Gnarled swamp limbs with draping curtains of Spanish moss & Cat-5 cable!
    for (let i = 0; i < 3; i++) {
      const ly = Math.floor(tallVoxels * (0.46 + i * 0.17));
      if (ly >= tallVoxels - 6) continue;
      const a = i * 2.15 + 0.5;
      const bx = Math.cos(a) * 14, bz = Math.sin(a) * 14;
      v.tube(0, ly, 0, bx, ly + 2, bz, 1.9, bark);
      v.ellipsoid(bx, ly + 3, bz, 6.5, 2.4, 6.5, moss);
      // Draping moss & blue ethernet cable strands
      for (let s = 0; s < 3; s++) {
        const sx = bx * (0.45 + s * 0.24), sz = bz * (0.45 + s * 0.24);
        const len = 9 + ((i + s) % 3) * 5;
        v.tube(sx, ly + 1, sz, sx, ly - len, sz, 0.85, s === 1 ? cat5 : moss);
        if (s === 1) v.rbox(sx - 1, ly - len - 2, sz - 1, sx + 1, ly - len, sz + 1, 0.4, plug);
      }
    }
    return v;
  };
}

/** Lush 7-frond arching woodland fern rosette (`fernClumpVox`) + curled fiddlehead. */
export function fernClumpVox() {
  return () => {
    const v = new Vox();
    const stem = M('#2d5422', 2), leaf = M('#3f7830', 2), tip = M('#5c9642', 2);
    v.ellipsoid(0, 1.8, 0, 3.5, 2.0, 3.5, stem);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.2;
      const cx = Math.cos(a), cz = Math.sin(a);
      v.tube(0, 2, 0, cx * 8.5, 9.5, cz * 8.5, 0.9, stem);
      v.tube(cx * 8.5, 9.5, cz * 8.5, cx * 15.5, 5.2, cz * 15.5, 0.8, tip);
      for (let p = 1; p <= 4; p++) {
        const f = p / 4.5;
        const px = cx * (15 * f), pz = cz * (15 * f);
        const py = 2 + Math.sin(f * Math.PI) * 7.2;
        const w = (1 - Math.abs(f - 0.55)) * 3.8;
        v.ellipsoid(px - cz * w, py, pz + cx * w, 1.8, 0.7, 1.8, p > 2 ? tip : leaf);
        v.ellipsoid(px + cz * w, py, pz - cx * w, 1.8, 0.7, 1.8, p > 2 ? tip : leaf);
      }
    }
    // Central curled green fiddlehead shoot
    v.tube(0, 2, 0, 0.8, 12, 0.4, 0.95, tip);
    v.ring(1.2, 12.5, 0.4, 1.8, 0.8, tip, 'x');
    return v;
  };
}

/**
 * Spotted *Amanita* toadstools & glowing amber mycena caps growing out of a
 * moss-overgrown beige office keyboard (`mushroomRingVox`)!
 */
export function mushroomRingVox() {
  return () => {
    const v = new Vox();
    const beige = M('#b8b29e', 2), key = M('#7c786a', 2), moss = mossMat();
    const stalk = M('#efe8d5', 2), red = M('#c92a22', 1), dot = M('#f7f4eb', 1), lit = glow('#ffbe42');

    // Half-buried tilted beige mechanical keyboard under cushion moss
    v.rbox(-11, 0, -5, 11, 2.6, 5, 0.8, beige);
    for (let kx = -9; kx <= 7; kx += 3) {
      v.box(kx, 2.4, -3.5, kx + 2, 3.4, 3.5, key);
    }
    v.ellipsoid(-4, 2.2, 1, 6.5, 2.2, 5.2, moss);

    // 3 spotted red Amanita toadstools
    for (const [mx, mz, h, r] of [[-5, 0, 11, 5.2], [5.5, -1.5, 8.5, 4.0], [1.5, 4.2, 6.5, 3.2]]) {
      v.tube(mx, 1, mz, mx * 1.08, h, mz * 1.08, 1.35, stalk);
      v.ellipsoid(mx * 1.08, h + 1.2, mz * 1.08, r, r * 0.52, r, red);
      v.ellipsoid(mx * 1.08, h + 0.3, mz * 1.08, r * 0.84, 0.8, r * 0.84, stalk);
      for (const [dx, dz] of [[0, 0], [r * 0.45, 0], [-r * 0.4, r * 0.35], [r * 0.2, -r * 0.45]]) {
        v.sphere(mx * 1.08 + dx, h + 2.2, mz * 1.08 + dz, 0.95, dot);
      }
    }
    // Tiny bioluminescent amber mycena cluster
    for (const [gx, gz, gh] of [[-9.5, -3.5, 5.5], [-8.0, -4.5, 4.2], [9.0, 3.0, 5.0]]) {
      v.tube(gx, 1, gz, gx, gh, gz, 0.65, stalk);
      v.ellipsoid(gx, gh + 0.8, gz, 1.8, 1.2, 1.8, lit);
    }
    return v;
  };
}

/**
 * Hollow moss-draped fallen cedar nurse log (`fallenNurseLogVox`) sprouting
 * bracket mushrooms, a fern spray, and a red Swingline office stapler!
 */
export function fallenNurseLogVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), heart = M('#b88b54', 2), moss = mossMat();
    const fungus = M('#cf6b24', 2), stapler = M('#b5241e', 0), chrome = M('#cfd6da', 0);

    // Horizontal hollow log along Z (`-24..24` = 1.44 m at 3 cm)
    v.cyl('z', 0, 6.5, -24, 24, 6.8, bark);
    v.cyl('z', 0, 6.5, -24.2, 24.2, 5.2, heart);
    v.carve(-3.6, 3.2, -25, 3.6, 9.5, 25);
    // Moss blanket along top ridge
    for (const mz of [-15, -4, 8, 17]) {
      v.ellipsoid((mz % 3) * 0.6, 12.8, mz, 5.2, 2.1, 6.8, moss);
    }
    // Shelf fungi on flank
    for (const [fz, fy] of [[-10, 7.5], [-5, 9.0], [11, 6.8]]) {
      v.ellipsoid(6.8, fy, fz, 3.2, 1.1, 3.2, fungus);
    }
    // Red office stapler left sitting on the mossy log!
    v.rbox(-2.2, 13.5, 1.0, 2.2, 14.6, 7.5, 0.4, chrome);
    v.rbox(-2.4, 14.5, 1.0, 2.4, 16.4, 7.8, 0.6, stapler);
    return v;
  };
}

/** Multi-ellipsoid sculpted granite boulder draped in cushion moss + brass inventory plate. */
export function mossBoulderVox() {
  return () => {
    const v = new Vox();
    const stone = M('#5e635f', 2), dark = M('#454a46', 2), moss = mossMat(), brass = M('#c79c3a', 0);
    v.ellipsoid(0, 5.5, 0, 12.5, 7.2, 10.5, stone);
    v.ellipsoid(-5.5, 4.2, 3.5, 8.2, 5.6, 7.5, dark);
    v.ellipsoid(6.0, 3.8, -3.0, 7.5, 4.8, 7.2, stone);
    v.ellipsoid(-1.5, 10.8, -1.0, 8.8, 3.2, 7.4, moss);
    // Tiny riveted brass asset tag (`ASSET: BOULDER`)
    v.rbox(-3.0, 5.0, 9.2, 3.0, 7.6, 10.8, 0.4, brass);
    return v;
  };
}

/** Swamp cattail reed clump (`cattailReedsVox`) with velvety seed spikes & lily-pad. */
export function cattailReedsVox() {
  return () => {
    const v = new Vox();
    const reed = M('#3c6e2f', 2), head = M('#4d2e18', 2), pad = M('#2f6329', 2), bloom = M('#f4e8f0', 1);
    // Floating notched lily-pad + pale lotus bud at base
    v.cyl('y', 4.5, 4.0, 0, 1.2, 6.5, pad);
    v.carve(4.5, -1, 4.0, 12, 2, 7.5);
    v.ellipsoid(3.5, 2.0, 3.2, 1.8, 1.6, 1.8, bloom);

    const stalks = [[-3, -2, 28, -1.5, 1], [1.5, -1, 33, 2.2, -1], [-0.5, 2.5, 25, 0.5, 2.8], [3.5, 1.5, 22, 5.5, 2.5], [-4.5, 1.5, 20, -6.5, 3.0]];
    stalks.forEach(([x0, z0, h, x1, z1], idx) => {
      v.tube(x0, 0, z0, x1, h, z1, 0.75, reed);
      if (idx < 3) {
        const mx = x0 + (x1 - x0) * 0.78, mz = z0 + (z1 - z0) * 0.78;
        v.cyl('y', mx, mz, h * 0.68, h * 0.88, 1.65, head);
      }
    });
    return v;
  };
}

/* ---- 2. Surreal Office-Forest Mashups ------------------------------------ */

/**
 * Half-submerged curved beige CRT monitor (`aEmis = 1` green phosphor screen),
 * mossy ergonomic office swivel chair, and waterlogged cubicle corner!
 */
export function drownedWorkstationVox() {
  return () => {
    const v = new Vox();
    const beige = M('#b8b19d', 2), darkBeige = M('#8c8573', 2), crt = glow('#3dff78'), hdd = glow('#ff9c2a');
    const fabric = M('#3c524c', 2), black = M('#1e2022', 1), cord = M('#2d3236', 1), moss = mossMat();
    const reed = M('#3b6e2e', 2);

    // Drowned laminate desk slab + waterlogged beige mini-tower PC with glowing amber HDD LED!
    v.rbox(-13, 0, -10, 12, 4.2, 10, 1.0, darkBeige);
    v.rbox(-12.5, 4.0, -8.5, -8.0, 15.0, 2.5, 0.8, beige);
    v.box(-11.8, 11.5, 2.0, -8.8, 13.0, 2.8, darkBeige); // 3.5" floppy drive bay
    v.set(-9.2, 9.5, 2.6, hdd);

    // Curved 1990s CRT monitor tilted slightly upward on a swivel pedestal
    v.cyl('y', 0, -1.5, 3.8, 6.2, 3.4, darkBeige);
    v.rbox(-7.5, 5.5, -6.5, 7.5, 18.2, 4.8, 1.8, beige);
    v.rbox(-5.5, 7.0, -11.8, 5.5, 16.0, -5.5, 2.0, darkBeige); // rear cathode neck
    v.carve(-6.0, 7.2, 3.4, 6.0, 16.4, 5.2);
    v.ellipsoid(0, 11.8, 3.4, 5.9, 4.5, 1.2, crt); // glowing curved phosphor screen!
    v.ellipsoid(-3.2, 18.5, -1.0, 5.5, 2.0, 4.4, moss);

    // Submerged mechanical keyboard + coiled PS/2 cord + floating 2-button ball mouse
    v.rbox(-6.5, 4.1, 5.2, 5.5, 5.8, 9.4, 0.5, beige);
    for (let kx = -5.5; kx <= 4.5; kx += 2.2) v.box(kx, 5.6, 5.8, kx + 1.4, 6.4, 8.8, darkBeige);
    v.tube(5.2, 4.8, 6.0, 8.5, 4.8, 7.5, 0.55, cord);
    v.ellipsoid(9.2, 5.0, 8.0, 1.6, 1.1, 2.2, beige);

    // Half-sunken swivel chair back & armrests + swamp reed sprouting behind it
    v.cyl('y', 14, 2.5, 0, 7.5, 1.2, black);
    v.rbox(9.5, 6.8, -2.0, 18.5, 9.4, 7.2, 1.2, fabric);
    v.rbox(9.5, 9.8, -3.0, 18.5, 20.2, -0.2, 1.6, fabric);
    v.ellipsoid(14, 20.5, -1.5, 4.6, 1.7, 2.2, moss);
    v.tube(-11.5, 2, -7.5, -13.0, 22, -8.5, 0.7, reed);
    return v;
  };
}

/** Sculpted half-round bark-on split cedar log bench on notched saddle logs (`splitLogBenchVox`). */
export function splitLogBenchVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), cedar = M('#c79358', 2), grain = M('#a6733c', 2), moss = mossMat();
    // Two notched transverse saddle logs (`x = -18`, `x = 18`)
    for (const sx of [-18, 18]) {
      v.cyl('z', sx, 4.2, -8.5, 8.5, 4.2, bark);
      v.cyl('z', sx, 4.2, -8.7, 8.7, 3.1, cedar);
      v.ellipsoid(sx, 2.0, 7.5, 3.0, 1.8, 2.5, moss);
    }
    // Split half-cylinder cedar slab (`x = -26..26` = 1.56 m long, `y = 6..13`)
    v.cyl('x', 12.5, 0, -26, 26, 6.8, bark);
    v.cyl('x', 12.5, 0, -26.2, 26.2, 5.5, cedar);
    // Carve top half flat so the sawn woodgrain seat faces upward at `y = 13`!
    v.carve(-27, 13.0, -8, 27, 21, 8);
    v.box(-25.8, 12.2, -5.2, 25.8, 13.0, 5.2, cedar);
    v.box(-25.8, 12.3, -1.4, 25.8, 13.05, 1.4, grain);
    return v;
  };
}

/**
 * Sculpted river-cobble campfire ring with charred birch logs, oscillating desk
 * fan beneath, and twisting multi-tongued amber/crimson cellophane flames!
 */
export function cellophaneFireVox() {
  return () => {
    const v = new Vox();
    const stone1 = M('#6c706d', 2), stone2 = M('#505452', 2), ash = M('#262524', 3);
    const birch = birchBarkMat(), fan = M('#cfd4d6', 0), cage = M('#383e42', 0);
    const amber = glow('#ff9d24'), crimson = glow('#eb3b1c'), gold = glow('#ffe869');

    v.cyl('y', 0, 0, 0, 2.2, 13.5, ash);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      v.ellipsoid(Math.cos(a) * 13.5, 2.8, Math.sin(a) * 13.5, 3.8, 2.8, 3.4, i % 2 ? stone1 : stone2);
    }
    // Office desk-fan laid face-up in the ashes blowing the fake flames!
    v.cyl('y', 0, 0, 1.8, 4.8, 6.2, cage);
    v.cyl('y', 0, 0, 4.5, 5.2, 4.8, fan);
    // Crossed birch logs
    v.tube(-9, 3, -4, 9, 7, 5, 2.4, birch);
    v.tube(-8, 3, 6, 8, 7.5, -5, 2.3, birch);
    // Twisting cellophane flame tongues (`aEmis = 1`)
    v.tube(-2.5, 5, -1, -1.0, 21, 1.5, 2.8, crimson);
    v.tube(2.2, 5, 1.5, 0.8, 24, -1.0, 2.5, amber);
    v.tube(0, 6, 0, 0, 27, 0, 1.8, gold);
    v.ellipsoid(-3.5, 14, 2.2, 2.2, 5.0, 1.6, amber);
    v.ellipsoid(3.2, 16, -2.0, 1.8, 4.8, 2.2, crimson);
    return v;
  };
}

/**
 * Monumental sculpted ancient hollow redwood (`ancientHollowTreeVox`, `scale = 0.055`):
 * Gnarled fluted trunk, arched root buttresses, cavernous carved `+Z` hollow
 * doorway, giant shelf fungi, embedded steel filing drawers & galvanized HVAC duct!
 */
export function ancientHollowTreeVox(tallVoxels = 96) {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), heart = M('#8f592c', 2), sapLit = glow('#ff9b2e');
    const moss = mossMat(), fungus = M('#cf6b24', 2), gill = M('#eddab4', 2);
    const duct = M('#9aa3a8', 0), cab = M('#6e7573', 1), handle = M('#d8dde0', 0);

    // 7 massive snaking buttress roots heaving outward
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.65; // avoids +Z (`Math.PI/2`? Wait: +Z is `sin=1, cos=0` -> `1.57`, so skip near `1.57`!)
      if (Math.cos(a - Math.PI / 2) > 0.72) continue;
      const rx = Math.cos(a), rz = Math.sin(a);
      v.tube(rx * 38, 1.5, rz * 38, rx * 27, 14, rz * 27, 4.6, bark);
      v.ellipsoid(rx * 34, 3.2, rz * 34, 5.5, 2.4, 5.5, moss);
    }

    // Fluted organic outer bole + hollow heartwood interior
    v.cyl('y', 0, 0, 0, tallVoxels, 29.5, bark, 25.5);
    for (let f = 0; f < 9; f++) {
      const a = (f / 9) * Math.PI * 2;
      if (Math.cos(a - Math.PI / 2) > 0.68) continue;
      v.tube(Math.cos(a) * 28, 0, Math.sin(a) * 28, Math.cos(a + 0.18) * 24.5, tallVoxels, Math.sin(a + 0.18) * 24.5, 4.2, bark);
    }
    v.cyl('y', 0, 0, 2, tallVoxels, 21.5, heart, 19.5);
    v.carve(-18.5, 2, -18.5, 18.5, tallVoxels + 1, 18.5);

    // Cavernous organic arched `+Z` entry portal (`z = 12..34, y = 0..42`)
    for (let y = 0; y <= 40; y++) {
      const archHw = y < 26 ? 12.5 : Math.max(2.0, 12.5 * Math.sqrt(Math.max(0, 1 - ((y - 26) / 15) ** 2)));
      v.carve(-archHw, y, 12, archHw, y + 1.5, 35);
    }
    // Glowing amber sap pool & spiral heartwood ribs inside the hollow!
    v.cyl('y', 0, 0, 0, 2.2, 18.2, sapLit);
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      v.ellipsoid(Math.cos(a) * 17.5, 8 + s * 5, Math.sin(a) * 17.5, 2.6, 1.8, 2.6, sapLit);
    }

    // Giant bracket polypore fungi shelves on `-X` and `+X` bark
    for (const [fx, fy, fz, r] of [[-28, 24, 6, 7.5], [-26, 31, -4, 5.8], [27, 38, 8, 6.8]]) {
      if (fy < tallVoxels - 6) {
        v.ellipsoid(fx, fy, fz, r, 2.2, r, fungus);
        v.ellipsoid(fx, fy - 1.1, fz, r * 0.85, 1.2, r * 0.85, gill);
      }
    }

    // Galvanized HVAC elbow & wedged grey filing-cabinet drawers fused into the redwood bark!
    v.rbox(-35, 32, -8, -23, 46, 6, 1.2, duct);
    v.rbox(-35, 44, -8, -27, Math.min(tallVoxels, 78), 6, 1.2, duct);
    v.rbox(22, 10, -10, 34, 30, 6, 1.0, cab);
    v.rbox(26, 19, -8, 38, 27, 4, 0.8, cab); // half-pulled drawer!
    v.box(37.5, 22, -4, 39, 24, 0, handle);

    return v;
  };
}

/* ---- 3. Sad Displaced Woodland Creatures (2.5 cm `Vox` sculpts) ----------- */

/** Slumped Red Fox (`sadFoxVox`) with drooping ears, bushy white-tipped tail, and bindle stick! */
export function sadFoxVox() {
  return () => {
    const v = new Vox();
    const rust = M('#c9561e', 2), darkRust = M('#963b12', 2), cream = M('#f2ece1', 2);
    const black = M('#1b1918', 1), eye = M('#121316', 0), tear = glow('#9be4ff');
    const stick = M('#6e4b2a', 2), cloth = M('#d93838', 2), dot = M('#ffffff', 1);

    // Hunched sitting body + white chest bib + tucked paws
    v.ellipsoid(0, 7.5, 0, 5.6, 6.8, 6.2, rust);
    v.ellipsoid(0, 8.2, 4.2, 3.6, 5.0, 2.4, cream);
    for (const sx of [-2.6, 2.6]) {
      v.ellipsoid(sx, 2.0, 4.2, 1.8, 2.0, 2.8, black);
      v.ellipsoid(sx * 1.3, 3.2, -1.5, 2.2, 3.0, 3.2, darkRust);
    }
    // Curled bushy tail wrapping round right flank with cream tip
    v.tube(0, 3.2, -5.5, 6.8, 3.0, -2.5, 2.8, rust);
    v.tube(6.8, 3.0, -2.5, 7.2, 3.6, 4.5, 3.1, rust);
    v.ellipsoid(6.5, 3.8, 7.2, 2.6, 2.4, 3.2, cream);

    // Drooping head + pointed snout + sad flattened ears + watery eyes
    v.ellipsoid(0, 15.2, 2.2, 5.2, 4.6, 5.0, rust);
    v.ellipsoid(0, 13.8, 4.2, 4.2, 2.6, 3.2, cream);
    v.tube(0, 14.5, 4.5, 0, 13.2, 9.8, 2.1, rust);
    v.sphere(0, 13.2, 10.6, 1.2, black);
    for (const sx of [-1, 1]) {
      // Sad sideways-drooping fox ears!
      v.tube(sx * 3.5, 18.2, 1.5, sx * 8.5, 16.0, 0.5, 1.8, darkRust);
      v.ellipsoid(sx * 8.8, 15.8, 0.5, 1.4, 1.0, 1.4, black);
      v.sphere(sx * 2.4, 15.8, 6.4, 1.05, eye);
      v.set(sx * 2.4, 14.4, 6.8, tear);
    }

    // Tiny hobo bindle stick resting over shoulder!
    v.tube(3.2, 8.0, 5.5, -5.5, 21.5, -6.5, 0.65, stick);
    v.ellipsoid(-6.2, 18.2, -7.2, 3.4, 3.2, 3.4, cloth);
    v.set(-6.2, 19.5, -4.2, dot);
    v.set(-8.5, 17.5, -6.5, dot);
    return v;
  };
}

/** Slumped European Badger (`sadBadgerVox`) with black-and-white facial stripes & eviction notice! */
export function sadBadgerVox() {
  return () => {
    const v = new Vox();
    const grey = M('#6e706c', 2), dark = M('#222423', 2), white = M('#f0eee8', 2);
    const pink = M('#cfa593', 1), paper = M('#f5e6a8', 1), red = M('#b82820', 1);

    // Pudgy hunched badger body
    v.ellipsoid(0, 6.8, -1.0, 7.2, 6.4, 8.2, grey);
    for (const sx of [-3.8, 3.8]) {
      v.ellipsoid(sx, 2.0, 5.2, 2.2, 1.8, 3.2, dark);
    }
    // Slumped striped head + long snout
    v.ellipsoid(0, 11.2, 5.5, 4.8, 4.2, 5.4, white);
    v.tube(0, 11.0, 7.0, 0, 9.2, 12.2, 2.4, white);
    for (const sx of [-2.3, 2.3]) {
      v.tube(sx, 13.5, 2.5, sx * 0.85, 10.2, 10.5, 1.35, dark); // classic black badger eye-stripes!
      v.ellipsoid(sx * 1.5, 14.2, 4.0, 1.5, 1.4, 1.2, dark);
    }
    v.sphere(0, 9.0, 13.2, 1.3, dark);
    // Crumpled yellow EVICTION NOTICE held between front paws
    v.rbox(-3.2, 3.5, 6.8, 3.2, 8.2, 8.0, 0.4, paper);
    v.box(-2.2, 6.5, 7.8, 2.2, 7.5, 8.3, red);
    void pink;
    return v;
  };
}

/** Plump heart-faced Barn Owl (`sadOwlVox`) with drooping ear-tufts perched on an office briefcase! */
export function sadOwlVox() {
  return () => {
    const v = new Vox();
    const tawny = M('#b5834c', 2), wing = M('#7d5630', 2), cream = M('#f2eadc', 2);
    const beak = M('#d9a438', 1), eye = M('#141418', 0), leather = M('#4a2d1b', 1), brass = M('#cfa23c', 0);

    // Battered leather office briefcase lying flat under the owl
    v.rbox(-8.5, 0, -5.5, 8.5, 4.2, 5.5, 0.9, leather);
    v.rbox(-2.5, 1.2, 5.2, 2.5, 3.2, 6.4, 0.4, brass);

    // Plump teardrop owl body + folded wings
    v.ellipsoid(0, 10.8, 0, 5.8, 7.2, 5.6, cream);
    v.ellipsoid(0, 11.2, -1.2, 6.0, 6.8, 5.2, tawny);
    for (const sx of [-1, 1]) {
      v.ellipsoid(sx * 5.2, 10.4, 0.4, 1.8, 5.6, 4.2, wing);
      v.ellipsoid(sx * 2.2, 4.4, 2.2, 1.6, 0.9, 2.2, beak);
    }
    // Heart-shaped cream facial disc + huge sad glossy eyes + drooping ear-tufts
    v.ellipsoid(0, 17.8, 0.8, 5.4, 4.8, 4.8, tawny);
    for (const sx of [-1.8, 1.8]) {
      v.ellipsoid(sx, 17.8, 3.8, 2.8, 3.0, 1.6, cream);
      v.sphere(sx * 1.15, 17.8, 5.0, 1.25, eye);
      v.tube(sx * 2.4, 21.2, 1.0, sx * 4.8, 19.8, -0.5, 1.1, wing);
    }
    v.ellipsoid(0, 16.4, 5.2, 0.9, 1.5, 1.4, beak);
    return v;
  };
}

/** Trembling curled Spotted Fawn (`sadFawnVox`) with big drooping ears & plastic parcel tag! */
export function sadFawnVox() {
  return () => {
    const v = new Vox();
    const coat = M('#b8733c', 2), belly = M('#ede2cf', 2), spot = M('#f7f2e6', 2);
    const hoof = M('#29231e', 1), tag = M('#eb6b1c', 1);

    // Curled resting fawn torso + folded legs
    v.ellipsoid(0, 5.5, 0, 8.2, 4.8, 5.8, coat);
    v.ellipsoid(0, 3.6, 0.8, 7.0, 2.6, 4.8, belly);
    for (const [sx, sy, sz] of [[-4, 8.5, 2], [2, 9.2, -2], [5, 7.8, 2.5], [-2, 8.0, -3.5], [0, 9.6, 0.5]]) {
      v.sphere(sx, sy, sz, 1.15, spot);
    }
    v.tube(-4.5, 2.0, 3.5, 2.5, 1.8, 5.2, 1.4, hoof);
    // Slender neck + head + oversized drooping ears + orange parcel tag
    v.tube(-4.8, 7.2, 1.2, -7.2, 14.8, 2.8, 2.2, coat);
    v.ellipsoid(-7.8, 16.2, 3.6, 3.6, 3.2, 4.2, coat);
    v.tube(-7.8, 15.6, 6.2, -7.8, 14.8, 9.6, 1.7, coat);
    v.sphere(-7.8, 14.8, 10.4, 1.0, hoof);
    for (const side of [-1, 1]) {
      v.sphere(-7.8 + side * 2.2, 16.6, 6.2, 0.95, hoof);
      v.tube(-7.8 + side * 2.6, 18.0, 2.8, -7.8 + side * 7.2, 16.2, 1.2, 1.3, coat);
    }
    // Plastic orange zoning ear-tag (`PARCEL B`)!
    v.rbox(-7.8 + 5.2, 13.5, 1.2, -7.8 + 7.2, 16.0, 2.2, 0.3, tag);
    v.ellipsoid(8.2, 6.5, -0.5, 1.8, 2.4, 1.6, belly); // white tail tuft
    return v;
  };
}

/* ---- 4. Clear-Cut Bulldozers, Developers & Burn-Scar Models --------------- */

/**
 * Heavy Caterpillar Office-Bulldozer (`bulldozerVox`, `scale = 0.038` -> ~3.3 m long):
 * Curved steel dozer blade heaped with splintered birch logs & keyboards, hydraulic
 * rams, twin oval crawler tracks with sprockets & bogie wheels, louvered diesel
 * hood with tall soot-puffing exhaust stack, yellow roll-cage cab, and a giant
 * glowing green CRT-headed Corporate Driver in a hard-hat fused into the seat!
 */
export function bulldozerVox() {
  return () => {
    const v = new Vox();
    const catYellow = M('#e0a01b', 1), catDark = M('#ad7710', 1), steel = M('#5e666b', 0);
    const tread = M('#232629', 1), wheel = M('#3e4347', 1), chrome = M('#dce3e8', 0);
    const soot = M('#1b1a1a', 3), crt = glow('#4aff86'), beige = M('#bfb8a4', 2);
    const birch = birchBarkMat(), lampGlow = glow('#fff4b8');

    // Twin oval caterpillar crawler tracks (`x = -21..-13`, `x = 13..21`, `z = -28..22`)
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -21 : 13, x1 = sx < 0 ? -13 : 21;
      v.rbox(x0, 0, -28, x1, 14, 22, 4.5, tread);
      v.rbox(x0 + 1.2, 2.2, -25, x1 - 1.2, 11.8, 19, 3.0, catDark);
      for (const wz of [-21, -11, -1, 9, 16]) {
        v.cyl('x', 5.5, wz, x0 - 0.6, x1 + 0.6, 3.6, wheel);
      }
      // Track grouser cleats along top
      for (let gz = -24; gz <= 18; gz += 5) {
        v.box(x0 - 0.4, 13.5, gz, x1 + 0.4, 14.8, gz + 2, steel);
      }
      // Hydraulic lift & tilt rams reaching forward to the curved blade (`z = 20..34`)
      v.tube(sx * 12, 8, 12, sx * 14, 6, 33, 2.0, catYellow);
      v.tube(sx * 11, 16, 16, sx * 12, 13, 33, 1.3, chrome);
    }

    // Main armored chassis & louvered engine hood (`z = -26..22, y = 7..25`)
    v.rbox(-13, 6, -26, 13, 24, 22, 2.2, catYellow);
    for (let lz = 4; lz <= 18; lz += 4) {
      v.box(-13.4, 13, lz, 13.4, 21, lz + 1.8, tread);
    }
    // Twin forward floodlights on engine brow
    for (const sx of [-8.5, 8.5]) {
      v.rbox(sx - 2.4, 22, 19, sx + 2.4, 26, 23, 0.8, tread);
      v.box(sx - 1.8, 22.6, 22.5, sx + 1.8, 25.4, 23.6, lampGlow);
    }
    // Tall curved diesel exhaust stack belching voxel soot clouds!
    v.cyl('y', -8.5, 12, 24, 44, 1.8, tread);
    v.tube(-8.5, 43, 12, -8.5, 47, 8, 1.8, tread);
    v.ellipsoid(-8.5, 50, 5, 4.2, 3.2, 4.2, soot);
    v.ellipsoid(-9.5, 54, 1, 5.6, 3.8, 5.4, soot);

    // Curved concave steel bulldozer blade (`z = 32..39, x = -25..25, y = 0..21`)!
    for (let by = 0; by <= 20; by += 2) {
      const curveZ = 35.5 - Math.sin((by / 20) * Math.PI) * 3.4;
      v.rbox(-25, by, curveZ - 1.8, 25, by + 2.4, curveZ + 1.8, 0.8, by < 3 ? tread : steel);
      if (by === 0) {
        // Paper-shredder teeth along bottom cutting edge!
        for (let tx = -22; tx <= 22; tx += 4) v.box(tx, 0, curveZ + 1.5, tx + 2, 2.5, curveZ + 4.2, chrome);
      }
    }
    // Splintered birch log caught across the front of the blade!
    v.tube(-19, 4.5, 38.5, 18, 8.5, 39.5, 3.2, birch);

    // Roll-cage ROPS cab (`z = -24..2, y = 24..48`) + Rear red hydraulic shutoff valve!
    for (const [px, pz] of [[-11, -22], [11, -22], [-11, 0], [11, 0]]) {
      v.cyl('y', px, pz, 24, 47, 1.35, tread);
    }
    v.rbox(-12.5, 46.5, -24, 12.5, 49, 2, 1.0, catYellow);
    v.rbox(-5, 13, -29.5, 5, 20, -25.5, 1.0, M('#c9241e', 0)); // rear emergency shutoff box!

    // Surreal Operator: Suit shoulders + Giant Glowing CRT Head wearing a yellow Hard-Hat!
    v.rbox(-7.5, 24, -16, 7.5, 33, -7, 2.0, M('#252a34', 2));
    v.rbox(-6.8, 33, -16, 6.8, 42.5, -5.5, 1.6, beige);
    v.ellipsoid(0, 37.8, -5.2, 5.2, 3.6, 1.0, crt);
    v.ellipsoid(0, 44.2, -11, 7.4, 2.8, 7.8, catYellow);
    return v;
  };
}

/**
 * Faceless Corporate Land Developer (`developerVox`, 2.8 cm `Vox`) in pinstripe
 * trousers, neon high-vis vest, yellow hard-hat, melted clay grin, and blueprints!
 */
export function developerVox() {
  return () => {
    const v = new Vox();
    const suit = M('#232833', 2), shirt = M('#eef2f5', 1), tie = M('#b82424', 1);
    const hivis = M('#cbe823', 1), stripe = M('#d8e2e6', 0), hat = M('#f0b418', 1);
    const clay = M('#cfa07a', 2), clayDark = M('#966847', 2), tubePaper = M('#f5f3ea', 1);

    for (const sx of [-3.5, 3.5]) {
      v.rbox(sx - 2.0, 0, -2.5, sx + 2.0, 3.5, 4.5, 0.8, M('#181616', 1));
      v.cyl('y', sx, 0, 3.5, 24, 2.3, suit);
    }
    v.rbox(-7.2, 23, -4.2, 7.2, 46, 4.2, 2.2, hivis);
    v.box(-7.4, 29, -4.4, 7.4, 31.5, 4.4, stripe);
    v.box(-2.2, 34, 3.6, 2.2, 46, 4.6, shirt);
    v.box(-0.9, 35, 4.2, 0.9, 45, 5.0, tie);

    // Left arm pointing proudly at the clear-cut; right arm tucking rolled white blueprints
    v.tube(-7.5, 43, 0, -14.5, 47, 9.5, 2.1, suit);
    v.sphere(-15.0, 47.2, 10.2, 1.9, clay);
    v.tube(7.5, 43, 0, 9.5, 33, 4.5, 2.1, suit);
    v.cyl('z', 9.2, 32.5, -6, 15, 2.2, tubePaper);

    // Eyeless slumped clay head (`porter.js` kin) under bright yellow hard-hat
    v.ellipsoid(0, 52, 0, 4.8, 5.6, 4.8, clay);
    v.carve(-3.8, 49.5, 3.4, 3.8, 51.8, 5.5); // unsettling too-wide hollow grin!
    v.ellipsoid(0, 53.8, 4.0, 4.2, 1.5, 2.0, clayDark); // heavy eyeless brow ridge
    v.ellipsoid(0, 57.5, 0, 6.2, 3.4, 6.6, hat);
    v.rbox(-5.5, 55.8, 3.5, 5.5, 57.0, 8.8, 0.6, hat);
    return v;
  };
}

/**
 * Post-fire blackened charcoal snag (`charredSnagVox`) with forked skeletal limbs
 * and glowing orange internal heartwood ember fissures (`aEmis = 1`)!
 */
export function charredSnagVox(tallVoxels = 88) {
  return () => {
    const v = new Vox();
    const char = charMat(), ash = M('#8e8c88', 3), ember = glow('#ff5912'), gold = glow('#ffb82e');

    // Ash mound & charred root claws
    v.ellipsoid(0, 2.0, 0, 10.5, 2.8, 10.5, ash);
    for (let a = 0; a < 5; a++) {
      const th = (a / 5) * Math.PI * 2 + 0.4;
      v.tube(Math.cos(th) * 11, 0.8, Math.sin(th) * 11, Math.cos(th) * 3, 10, Math.sin(th) * 3, 2.1, char);
    }

    // Hollow jagged trunk with glowing ember core showing through bark cracks!
    const top = Math.floor(tallVoxels * 0.78);
    v.tube(0, 0, 0, 1.6, Math.floor(top * 0.5), -1.0, 5.6, char);
    v.tube(1.6, Math.floor(top * 0.5), -1.0, -1.2, top, 0.8, 4.6, char);
    v.cyl('y', 0.4, -0.2, 8, Math.min(46, top - 6), 2.8, ember);
    v.carve(-1.8, 14, 2.2, 2.2, 34, 7.0); // vertical burn fissure revealing glowing ember heart!
    v.cyl('y', 0.3, 0.5, 15, 33, 1.9, ember);
    v.sphere(0.4, 23, 2.2, 1.5, gold);

    // Jagged broken charcoal crown limbs
    v.tube(-1.2, top - 6, 0.8, -9.5, Math.min(tallVoxels, top + 14), 4.5, 2.0, char);
    v.tube(-0.5, top - 12, 0.2, 8.8, top + 6, -5.2, 1.8, char);
    v.sphere(-9.5, Math.min(tallVoxels, top + 14), 4.5, 1.3, ember);
    return v;
  };
}

/** Heat-warped sagging steel office filing cabinet (`meltedCabinetVox`) spilling glowing ember files! */
export function meltedCabinetVox() {
  return () => {
    const v = new Vox();
    const soot = charMat(), sag = M('#3a3638', 1), ember = glow('#ff6418'), ash = M('#9c9992', 3);
    v.ellipsoid(0, 1.8, 3.0, 12, 2.2, 13, ash);
    // Warped leaning steel carcass (`tube`/slanted tiers drooping forward!)
    v.rbox(-8, 0, -7, 8, 16, 6, 1.2, soot);
    v.rbox(-8.5, 15, -5, 7.5, 29, 8.5, 1.6, sag);
    v.rbox(-9.5, 27, -2, 6.5, 38, 11.5, 2.2, soot);
    // Burst-open middle drawer spilling glowing orange ember folders down the front!
    v.rbox(-6.5, 17, 6, 5.5, 24, 15.5, 0.8, sag);
    v.ellipsoid(-0.5, 24.5, 11.5, 5.0, 2.2, 3.6, ember);
    v.tube(0, 18, 14, 1.5, 2.5, 17, 2.4, ember);
    return v;
  };
}

/** Soot-blackened burned laser printer (`ashSproutPrinterVox`) with a single green fern sprout! */
export function ashSproutPrinterVox() {
  return () => {
    const v = new Vox();
    const soot = charMat(), tray = M('#383536', 2), ash = M('#a3a098', 3);
    const green = M('#4ad648', 1), leaf = M('#2fa832', 2);
    v.ellipsoid(0, 1.5, 0, 11, 2.0, 11, ash);
    v.rbox(-8.5, 1.5, -7.5, 8.5, 10.5, 7.5, 1.4, soot);
    v.rbox(-5.5, 9.5, -4.5, 5.5, 12.2, 5.5, 0.8, tray);
    // Single resilient bright green fern shoot unfurling out of the charred paper feed!
    v.tube(0, 11, 0, 0.8, 21, 1.2, 1.0, green);
    v.ellipsoid(-2.4, 16.5, 0.8, 2.6, 0.9, 1.4, leaf);
    v.ellipsoid(2.8, 18.2, 1.2, 2.6, 0.9, 1.4, leaf);
    v.ring(1.2, 21.8, 1.2, 1.8, 0.85, green, 'x');
    return v;
  };
}

/**
 * The Fire Marshal (`burn-scar`, 2.6 cm `Vox`): whoever ran the drill, still running it. Work boots, trousers gone to
 * tar at the cuffs, a hi-vis vest melted into drips down the front with its reflective bands still bright, a white
 * hard hat with a red band, a red extinguisher in the right hand with its hose looped — and where the face should be,
 * a ceiling smoke detector: a white dome with a vent grille and a test button. (Its LED is a separate part, so that it
 * can blink: `marshalLedVox`.) Faces +z.
 */
export function fireMarshalVox() {
  return () => {
    const v = new Vox();
    const boot = M('#1d1a17', 1), tar = M('#1a1716', 3), trouser = M('#2e3338', 2);
    const vest = M('#f06a12', 2), vestDrip = M('#b8460c', 2), band = M('#e8eef0', 0), shirt = M('#5d6a73', 2);
    const glove = M('#b5a27a', 2), hat = M('#efeee8', 1), hatBand = M('#c4231b', 1);
    const red = M('#c8241c', 1), redDark = M('#8f1712', 1), black = M('#151515', 1), steel = M('#c9d0d4', 0);
    const plastic = M('#f2f0ea', 1), grille = M('#c9c6bc', 1);

    // boots and legs, tarred at the cuff
    for (const sx of [-3.6, 3.6]) {
      v.rbox(sx - 2.2, 0, -2.6, sx + 2.2, 3.4, 5.0, 1.0, boot);
      v.cyl('y', sx, 0.5, 3.2, 9, 2.5, tar, 2.3);
      v.cyl('y', sx, 0.3, 9, 25, 2.4, trouser, 2.6);
    }
    // torso: grey work shirt under the melted vest
    v.rbox(-7.5, 24, -4.2, 7.5, 47, 4.4, 2.6, shirt);
    v.rbox(-7.9, 25, -4.6, 7.9, 45, 4.8, 2.4, vest);
    for (const by of [30, 36]) v.box(-8.0, by, -4.7, 8.0, by + 1.6, 4.9, band);
    // where the vest ran in the heat: drips down over the belt and onto the thighs
    for (const [dx, len, r] of [[-5.5, 7, 1.1], [-2, 10, 0.9], [1.5, 5, 1.2], [4.8, 12, 0.85], [6.4, 6, 1.0]]) {
      v.tube(dx, 26, 4.6, dx * 1.04, 26 - len, 4.9, r, vestDrip);
      v.sphere(dx * 1.04, 25.4 - len, 4.9, r * 1.3, vestDrip);
    }
    // left arm hangs; right arm holds the extinguisher out, a little forward
    v.tube(-8.4, 44, 0, -10.2, 31, 1.2, 2.1, shirt); v.ellipsoid(-10.4, 29.6, 1.4, 2.0, 2.3, 2.0, glove);
    v.tube(8.4, 44, 0, 10.6, 33, 4.5, 2.1, shirt); v.ellipsoid(10.8, 31.6, 5.2, 2.0, 2.2, 2.0, glove);
    // the extinguisher: cylinder, handle, gauge, looped black hose and a steel horn
    v.cyl('y', 11, 7.5, 16, 31, 3.1, red); v.ellipsoid(11, 31, 7.5, 3.1, 1.6, 3.1, redDark);
    v.box(10, 32, 6.5, 12, 34.5, 8.5, steel); v.tube(9.8, 34, 7.5, 13.4, 34.6, 6.6, 0.7, black);
    v.cyl('z', 11, 25, 10.4, 11.2, 1.1, plastic);
    v.tube(12.6, 33, 8.5, 15.8, 24, 10.2, 0.75, black); v.tube(15.8, 24, 10.2, 14.4, 18, 11.5, 0.75, black);
    v.cyl('y', 14.4, 11.5, 13.5, 18, 0.9, steel, 1.6);
    // the neck, and then the head: a smoke detector, dome forward, as big as a head
    v.cyl('y', 0, 0, 46, 49.5, 2.4, shirt);
    v.ellipsoid(0, 54.5, 0.4, 5.4, 5.6, 5.0, plastic);              // the detector body (the back of the head)
    v.cyl('z', 0, 54.5, 3.0, 6.4, 5.0, plastic, 3.6);             // its dome, where a face would be
    for (const r of [1.6, 2.9, 4.1]) v.ring(0, 54.5, 6.2, r, 0.35, grille, 'z'); // the vent grille, in rings
    v.cyl('z', -2.6, 51.4, 6.0, 7.0, 0.8, grille);                 // TEST
    // the hard hat, brim all round, red band, a ridge over the crown
    v.ellipsoid(0, 60.2, 0.2, 6.3, 3.8, 6.4, hat);
    v.cyl('y', 0, 0.6, 57.4, 58.4, 7.6, hat);
    v.cyl('y', 0, 0.2, 58.3, 59.4, 6.25, hatBand);
    v.box(-0.8, 59.5, -5.6, 0.8, 64.2, 5.8, hat);
    return v;
  };
}

/** The Fire Marshal's detector LED: a small red light, shown and hidden to blink. */
export function marshalLedVox() {
  return () => { const v = new Vox(); v.sphere(0, 0, 0, 1.1, glow('#ff2a1a')); return v; };
}

/* ---- 5. 2027 AAA High-Density Forest-Office Detail Clutter & Drapes ------- */

/**
 * Rotting laminate office desk heaved and cracked in half by an erupting cedar
 * root (`overgrownDeskVox`), colonized by cushion moss, bracket fungi, a fern
 * shoot, and a tilted ceramic "SYNERGY" coffee mug!
 */
export function overgrownDeskVox() {
  return () => {
    const v = new Vox();
    const veneer = M('#7c5a38', 2), steel = M('#454a4f', 1), moss = mossMat(), bark = pineBarkMat();
    const fungus = M('#d46b24', 2), mug = M('#eae6da', 1), leaf = M('#498236', 2);

    // Steel side pedestals + cracked tilted desktop halves
    v.rbox(-21, 0, -10, -14, 21, 10, 0.8, steel);
    v.rbox(14, 0, -10, 21, 18, 10, 0.8, steel);
    v.tube(-22, 22, 0, -2, 25, 0.5, 2.2, veneer);
    v.rbox(-22, 20.5, -11, -1.5, 23.5, 11, 0.8, veneer);
    v.rbox(1.5, 17.5, -11, 22, 20.5, 11, 0.8, veneer);

    // Gnarled cedar root bursting straight up through the middle of the desk!
    v.tube(-2, 0, -4, 0.5, 29, 2, 3.6, bark);
    v.tube(0.5, 27, 2, 7.5, 34, -3, 2.1, bark);
    v.ellipsoid(-6, 24.5, 1, 7.5, 2.4, 6.2, moss);
    v.ellipsoid(9, 21.0, -2, 6.2, 2.0, 5.4, moss);

    // Shelf fungi on steel leg + ceramic coffee mug & sprouting fern
    v.ellipsoid(-13.5, 11, 8, 3.2, 1.1, 3.0, fungus);
    v.cyl('y', 14, 4, 20.5, 24.5, 1.9, mug);
    v.tube(1.2, 24, 3, 3.5, 33, 5.5, 0.8, leaf);
    v.ellipsoid(4.2, 32, 6.2, 2.8, 0.9, 1.8, leaf);
    return v;
  };
}

/**
 * Toppled stack of waterlogged 3-ring HR offsite binders & manila folders
 * (`rottingBinderPileVox`) overgrown with moss and glowing amber mycena!
 */
export function rottingBinderPileVox() {
  return () => {
    const v = new Vox();
    const navy = M('#263d54', 2), maroon = M('#5e2629', 2), manila = M('#cbb37c', 2);
    const paper = M('#dfd9c8', 2), moss = mossMat(), lit = glow('#ffbe44'), stalk = M('#ede5d0', 2);

    v.rbox(-9, 0, -7, 8, 3.4, 7, 0.6, navy);
    v.rbox(-8.2, 0.6, -6.2, 7.2, 2.8, 6.4, 0.3, paper);
    v.rbox(-7, 3.2, -6, 9, 6.6, 6.5, 0.6, maroon);
    v.rbox(-6.2, 3.8, -5.4, 8.4, 6.0, 5.8, 0.3, paper);
    // Spilled manila sheet & moss cushion
    v.rbox(3, 0, 4, 14, 1.2, 12, 0.3, manila);
    v.ellipsoid(-2, 7.0, 0, 6.4, 2.0, 5.2, moss);
    for (const [mx, mz, mh] of [[-4, 2, 11.5], [-1.5, -2, 9.8]]) {
      v.tube(mx, 6.5, mz, mx * 1.1, mh, mz, 0.65, stalk);
      v.ellipsoid(mx * 1.1, mh + 0.8, mz, 2.0, 1.2, 2.0, lit);
    }
    return v;
  };
}

/**
 * Fine woodland floor scatter (`forestLitterVox`): fallen pinecones, mossy bark
 * slabs, twigs, acorns, and a damp curled white office memo!
 */
export function forestLitterVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), cone = M('#4f3019', 2), moss = mossMat();
    const leaf = M('#8a5c28', 2), memo = M('#e3dfd2', 2), ink = M('#2d3336', 1);

    // Mossy bark slab & twig
    v.rbox(-10, 0, -4, 4, 2.2, 3.5, 0.8, bark);
    v.ellipsoid(-4, 2.4, -0.5, 4.5, 1.3, 2.8, moss);
    v.tube(-8, 0.8, 6, 11, 1.4, -5, 0.85, bark);
    // Two pinecones & dead autumn leaves
    for (const [cx, cz, r] of [[6.5, 4.5, 2.1], [-7.5, -6.5, 1.8]]) {
      v.ellipsoid(cx, 1.8, cz, r, 1.5, r * 1.35, cone);
    }
    v.ellipsoid(2.5, 0.6, 7.5, 2.8, 0.5, 1.9, leaf);
    // Damp curled office memo corner
    v.rbox(5, 0.2, -8.5, 12.5, 1.1, -2.5, 0.3, memo);
    v.box(6.5, 0.9, -7.2, 11.0, 1.3, -6.2, ink);
    return v;
  };
}

/**
 * Ceiling-hung curtain (`hangingCanopyDrapeVox`, origin at `y = 0` ceiling face,
 * hanging down to `y = -28`) of tangled cedar roots, evergreen boughs, Spanish
 * moss strands, and a blue Cat-5 patch cable with RJ45 plug!
 */
export function hangingCanopyDrapeVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), needles = needleMat(), moss = M('#597542', 2);
    const cat5 = M('#356499', 1), plug = M('#dde5eb', 0);

    // Tangled ceiling root collar + drooping bough pad
    v.ellipsoid(0, -2.5, 0, 9.5, 3.2, 8.5, needles);
    v.tube(-6, 0, -3, 2, -14, 2, 1.8, bark);
    v.tube(5, 0, 4, -3, -19, -1, 1.4, bark);
    // Hanging Spanish-moss curtains & Cat-5 cable
    for (const [sx, sz, len] of [[-5.5, 3.5, 22], [4.5, -3.0, 26], [0.5, 5.0, 17]]) {
      v.tube(sx, -2, sz, sx * 0.9, -len, sz * 0.9, 0.95, moss);
    }
    v.tube(2.5, 0, -2.5, 3.5, -25, -1.5, 0.75, cat5);
    v.rbox(2.5, -27.2, -2.5, 4.5, -24.8, -0.5, 0.3, plug);
    return v;
  };
}

/**
 * Tangled cedar root & yellow Romex cable arch (`rootArchVox`) heaving out of
 * the damp moss floor and diving back down!
 */
export function rootArchVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), moss = mossMat(), romex = M('#d9b026', 1);
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI, a1 = ((i + 1) / 12) * Math.PI;
      v.tube(-Math.cos(a0) * 16, Math.sin(a0) * 14, 0, -Math.cos(a1) * 16, Math.sin(a1) * 14, (i % 2 ? 1.2 : -1.2), 2.3, bark);
      if (i >= 2 && i <= 9) {
        v.tube(-Math.cos(a0) * 14.5, Math.sin(a0) * 12.2, 1.8, -Math.cos(a1) * 14.5, Math.sin(a1) * 12.2, 1.8, 0.7, romex);
      }
    }
    v.ellipsoid(-15.5, 2.0, 0, 4.5, 2.2, 4.5, moss);
    v.ellipsoid(15.5, 2.0, 0, 4.5, 2.2, 4.5, moss);
    v.ellipsoid(0, 15.2, 0, 5.2, 1.8, 3.4, moss);
    return v;
  };
}

/**
 * Half-collapsed olive-canvas & aluminum offsite camp cot (`campCotVox`) with
 * rolled foam pad and moss creeping up one corner!
 */
export function campCotVox() {
  return () => {
    const v = new Vox();
    const alum = M('#aeb6bd', 0), canvas = M('#455939', 2), pad = M('#c97a2b', 2), moss = mossMat();
    // Scissor X-legs (one end collapsed lower into the moss!)
    for (const zx of [-19, 0, 19]) {
      const topY = zx > 10 ? 7.5 : 10.5;
      v.tube(zx, 0, -8.5, zx, topY, 8.5, 0.85, alum);
      v.tube(zx, 0, 8.5, zx, topY, -8.5, 0.85, alum);
    }
    // Side rails & sagging olive canvas bed
    v.tube(-23, 10.8, -8.8, 23, 7.6, -8.8, 1.0, alum);
    v.tube(-23, 10.8, 8.8, 23, 7.6, 8.8, 1.0, alum);
    for (let ix = -21; ix <= 19; ix += 4) {
      const y = 9.8 - ((ix + 21) / 40) * 2.8;
      v.rbox(ix, y - 0.8, -8.4, ix + 4.2, y + 0.6, 8.4, 0.4, canvas);
    }
    // Rolled orange foam sleeping pad at head of cot + moss patch at collapsed foot
    v.cyl('z', -17, 13.0, -7.5, 7.5, 2.8, pad);
    v.ellipsoid(18, 8.2, 4.5, 5.5, 2.0, 4.8, moss);
    return v;
  };
}

/* ---- 6. Ultra-Dense Stand Trunks, Root Plates & Bark-Mimic Entities ------- */

/**
 * Slender old-growth hemlock/cedar column (`denseHemlockVox`, ~2.8k tris w/ AO)
 * designed so 50–75 collidable full-AO trunks can pack shoulder-to-shoulder in
 * a single room! Optional `fiberGlow` weaves bioluminescent cyan-green server
 * fiber-lichen up the bark fissures.
 */
export function denseHemlockVox(tallVoxels = 96, fiberGlow = false) {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), moss = mossMat();
    const crownCols = [M('#19361d', 2), M('#264f2a', 2), M('#366835', 2)];
    const crownMat = (x, y, z) => crownCols[(Math.abs(Math.floor(y * 0.5)) + (x * x + z * z > 24 ? 1 : 0)) % 3];
    const fungus = M('#cf6b24', 2), tag = M('#eef0ec', 1), ink = M('#1b1d1e', 1);
    const fiber = glow('#3dffab');

    // Compact mossy root-flare base + 4 greedy-mesh buttress fins
    v.ellipsoid(0, 1.8, 0, 5.6, 2.2, 5.6, moss);
    v.rbox(-7.5, 0, -1.6, 7.5, 5.5, 1.6, 0.6, bark);
    v.rbox(-1.6, 0, -7.5, 1.6, 5.5, 7.5, 0.6, bark);

    // 3-tier greedy-mesh-friendly fluted column (`cyl` constant radius per tier -> 3x more trees per room!)
    const y1 = Math.floor(tallVoxels * 0.38), y2 = Math.floor(tallVoxels * 0.72);
    v.cyl('y', 0, 0, 0, y1, 4.4, bark);
    v.cyl('y', 0, 0, y1, y2, 3.9, bark);
    v.cyl('y', 0, 0, y2, tallVoxels, 3.4, bark);

    // Shelf polypore + stapled asset tag
    if (tallVoxels >= 52) {
      v.ellipsoid(4.3, 24, 1.0, 2.6, 1.0, 2.6, fungus);
      v.rbox(-2.2, 40, 3.4, 2.2, 44, 4.5, 0.5, tag);
      v.box(-1.6, 41.2, 4.2, 1.6, 42.6, 4.8, ink);
    }

    // Optional bioluminescent server fiber-optic lichen vein climbing the bark!
    if (fiberGlow && tallVoxels >= 60) {
      for (let fy = 14; fy < tallVoxels - 16; fy += 16) {
        const fa = fy * 0.16;
        v.box(Math.cos(fa) * 3.8 - 0.6, fy, Math.sin(fa) * 3.8 - 0.6, Math.cos(fa) * 3.8 + 0.6, fy + 4, Math.sin(fa) * 3.8 + 0.6, fiber);
      }
    }

    // High shadowed evergreen crown collar just below the ceiling tiles
    const cy = Math.max(48, tallVoxels - 10);
    v.ellipsoid(0, cy, 0, 7.2, 2.0, 7.2, crownMat);
    return v;
  };
}

/**
 * Arrow-straight corporate plantation Sitka spruce (`plantationSpruceVox`) in a
 * cut office floor-tile collar, with conical needle tiers, Q4 barcode plate, and
 * a translucent ceiling-fed IV toner-sap bag (`greenDrip` lights it bright green!).
 */
export function plantationSpruceVox(tallVoxels = 92, greenDrip = false) {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat();
    const spGreens = [M('#18361c', 2), M('#244d28', 2), M('#336634', 2)];
    const crownMat = (_x, y, _z) => spGreens[Math.abs(Math.floor(y * 0.55)) % 3];
    const collar = M('#6c706b', 1), tag = M('#f2f0e6', 1), ink = M('#1b1d1e', 1);
    const bag = greenDrip ? glow('#48ff82') : M('#6e8c78', 0), tubeLine = M('#9bb5a5', 0);

    // Square metal floor-planter grommet cut into the carpet/moss + 2-tier straight bole
    v.rbox(-5.5, 0, -5.5, 5.5, 1.8, 5.5, 0.5, collar);
    const yMid = Math.floor(tallVoxels * 0.55);
    v.cyl('y', 0, 0, 0, yMid, 3.6, bark);
    v.cyl('y', 0, 0, yMid, tallVoxels, 3.0, bark);

    // Prominent Q4 inventory barcode plaque at eye height
    v.rbox(-2.4, 39, 2.9, 2.4, 44.5, 4.2, 0.5, tag);
    v.box(-1.8, 40.2, 3.9, 1.8, 42.2, 4.5, ink);

    // Hanging IV sap-drip pouch & vertical feed tube!
    v.rbox(4.0, 49, -1.4, 7.0, 56, 1.4, 0.5, bag);
    v.box(3.2, 44, -0.5, 5.6, 49.5, 0.5, tubeLine);
    v.box(5.2, 56, -0.4, 6.0, Math.min(tallVoxels, 88), 0.4, tubeLine);

    // Dense eye-level spruce skirts (`y = 0.85 m .. 3.6 m`) so rows block horizontal sightlines completely!
    for (const [frac, rad] of [[0.22, 8.8], [0.40, 8.0], [0.58, 7.0], [0.76, 5.8], [0.90, 4.2]]) {
      const sy = Math.floor(tallVoxels * frac);
      if (sy >= tallVoxels - 3) continue;
      v.ellipsoid(0, sy, 0, rad, 2.2, rad, crownMat);
    }
    return v;
  };
}

/**
 * Heavy eye-level sightline-blocking forest conifer (`sweepingConiferVox`):
 * Wide, dark, layered hemlock/fir bough skirts sweeping from knee height (`y = 13`)
 * right across human eye level (`y = 28..64`) up into the ceiling so you cannot
 * see past a single tree! Greedy-mesh optimized with full `ao: true`.
 */
export function sweepingConiferVox(tallVoxels = 96) {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), moss = mossMat();
    const cols = [M('#142b17', 2), M('#1f4023', 2), M('#2c572e', 2)];
    const boughMat = (_x, y, _z) => cols[Math.abs(Math.floor(y * 0.5)) % 3];

    v.ellipsoid(0, 1.8, 0, 6.2, 2.2, 6.2, moss);
    const yMid = Math.floor(tallVoxels * 0.55);
    v.cyl('y', 0, 0, 0, yMid, 4.0, bark);
    v.cyl('y', 0, 0, yMid, tallVoxels, 3.2, bark);

    // Wide drooping evergreen tiers across knee, waist, chest, eye, and overhead levels!
    for (const [vy, rx, rz] of [
      [14, 13.5, 12.5],
      [27, 12.5, 13.5],
      [41, 11.5, 11.0],
      [55, 10.0, 10.5],
      [70, 8.2, 8.2],
    ]) {
      if (vy >= tallVoxels - 5) continue;
      v.ellipsoid(0, vy, 0, rx, 2.5, rz, boughMat);
    }
    if (tallVoxels >= 84) {
      v.ellipsoid(0, tallVoxels - 9, 0, 6.8, 2.1, 6.8, boughMat);
    }
    return v;
  };
}

/* ---- 7. Stage-Set Forest Props: Shrubs, Drywall Canopy Caps, Cardboard Birds & Ceiling Logs ---- */

/**
 * Lush waist-to-chest-high 3D voxel woodland bush (`bushShrubVox`) with chunky
 * multi-tone olive/emerald leaf clusters & dark interior crevice AO!
 */
export function bushShrubVox() {
  return () => {
    const v = new Vox();
    const g0 = M('#1b3b1a', 2), g1 = M('#2d5926', 2), g2 = M('#457834', 2), stem = M('#3b2617', 2);
    const leaf = (_x, y, _z) => (y > 16 ? g2 : y > 9 ? g1 : g0);
    v.cyl('y', 0, 0, 0, 9, 2.4, stem);
    for (const [cx, cy, cz, rx, ry, rz] of [
      [0, 11, 0, 10.5, 7.5, 9.5],
      [-6.5, 8.5, 3.5, 6.5, 5.8, 6.2],
      [6.8, 9.0, -3.0, 6.8, 6.0, 6.0],
      [-3.5, 16.5, -2.5, 6.2, 5.2, 5.8],
      [4.2, 17.5, 2.8, 5.8, 5.0, 5.5],
    ]) {
      v.ellipsoid(cx, cy, cz, rx, ry, rz, leaf);
    }
    return v;
  };
}

/**
 * 3D voxel green foliage cap (`drywallCanopyCapVox`) that erupts out of the top
 * edge of a painted pixel-tree drywall partition so the 2D painted tree turns 3D!
 */
export function drywallCanopyCapVox() {
  return () => {
    const v = new Vox();
    const g0 = M('#1e401d', 2), g1 = M('#32632b', 2), g2 = M('#4c8539', 2);
    const leaf = (_x, y, _z) => (y > 8 ? g2 : y > 3 ? g1 : g0);
    for (const [cx, cy, cz, rx, ry, rz] of [
      [0, 5, 0, 15, 5.5, 6.5],
      [-9, 3, 1.5, 8.5, 4.8, 5.8],
      [9.5, 4, -1.5, 8.5, 5.0, 5.8],
      [0, 10.5, 0, 9.5, 4.2, 5.2],
    ]) {
      v.ellipsoid(cx, cy, cz, rx, ry, rz, leaf);
    }
    return v;
  };
}

/**
 * Corrugated-cardboard voxel bird (`cardboardBirdVox`) suspended in mid-glide
 * on ceiling string: layered kraft-brown cardboard wings, tail fan, and beak!
 */
export function cardboardBirdVox() {
  return () => {
    const v = new Vox();
    const kraft = M('#9c7548', 2), darkFlute = M('#6e4e2c', 2), tape = M('#bfa06f', 1);
    // Fuselage & head
    v.rbox(-2.2, -1.5, -8.5, 2.2, 2.0, 6.5, 0.6, kraft);
    v.rbox(-1.8, 1.0, 5.0, 1.8, 4.5, 9.2, 0.5, kraft);
    v.box(-0.8, 2.0, 9.0, 0.8, 3.2, 11.5, darkFlute); // cardboard beak
    v.box(-2.3, -0.5, -2.0, 2.3, 2.2, 1.5, tape);     // packing tape band!
    // Swept stepped cardboard wings
    for (const sx of [-1, 1]) {
      v.rbox(sx * 2, 0.5, -2.5, sx * 9, 2.2, 3.5, 0.4, kraft);
      v.rbox(sx * 8, 2.0, -4.0, sx * 15, 3.6, 2.0, 0.4, kraft);
      v.box(sx * 14.5, 2.2, -3.8, sx * 15.6, 3.4, 1.8, darkFlute);
    }
    // Fanned cardboard tail
    v.rbox(-4.2, 0.5, -13.0, 4.2, 1.8, -8.0, 0.3, kraft);
    return v;
  };
}

/**
 * Surreal Backrooms ceiling oddity (`sidewaysCeilingLogVox`): a horizontal brown
 * bark trunk bolted sideways to the ceiling tiles with 3D green voxel foliage
 * tufts growing out of BOTH ends like an overgrown dumbbell!
 */
export function sidewaysCeilingLogVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), bracket = M('#585e5c', 1);
    const g0 = M('#1c3d1b', 2), g1 = M('#32632b', 2), g2 = M('#4c8539', 2);
    const leaf = (_x, y, _z) => (y > -4 ? g2 : y > -8 ? g1 : g0);

    // Ceiling mounting brackets + horizontal fluted log (`x = -18..18, y = -6`)
    for (const bx of [-10, 10]) {
      v.box(bx - 1.5, -5.5, -1.5, bx + 1.5, 0, 1.5, bracket);
    }
    v.cyl('x', -6, 0, -18, 18, 3.2, bark);
    // Double-ended 3D voxel foliage balls!
    for (const ex of [-19, 19]) {
      v.ellipsoid(ex, -6, 0, 6.2, 5.8, 6.2, leaf);
    }
    return v;
  };
}

/**
 * Sculpted stepped grey concrete/limestone voxel rock pile (`steppedGreyRockVox`)
 * with bright green moss pads & loose voxel cubes at its base!
 */
export function steppedGreyRockVox() {
  return () => {
    const v = new Vox();
    const s0 = M('#565b59', 2), s1 = M('#6c7270', 2), s2 = M('#434746', 2), moss = M('#3d6e30', 2);
    const stone = (x, y, _z) => (y > 10 ? s1 : x > 0 ? s0 : s2);
    v.rbox(-12, 0, -10, 12, 6, 10, 0.8, stone);
    v.rbox(-9, 6, -7.5, 8, 11.5, 7.5, 0.8, stone);
    v.rbox(-5, 11.5, -4.5, 4.5, 16, 4.5, 0.6, stone);
    v.box(-8.5, 6.0, -7.0, -3.5, 7.2, -1.5, moss);
    v.box(-4.5, 16.0, -3.5, 2.5, 17.2, 2.5, moss);
    v.box(10, 0, 7, 13.5, 2.8, 10.5, s1);
    return v;
  };
}

/**
 * Slender white paper-birch pole (`denseBirchStemVox`) with black horizontal
 * lenticel eye-scars — greedy-mesh optimized so 60–90 stems fit in one room!
 */
export function denseBirchStemVox(tallVoxels = 92) {
  return () => {
    const v = new Vox();
    const birch = birchBarkMat(), moss = mossMat(), leaf = M('#4c7d34', 2);
    v.ellipsoid(0, 1.5, 0, 4.6, 1.8, 4.6, moss);
    const yMid = Math.floor(tallVoxels * 0.52);
    v.cyl('y', 0, 0, 0, yMid, 3.0, birch);
    v.cyl('y', 0, 0, yMid, tallVoxels, 2.5, birch);
    if (tallVoxels >= 60) {
      const ly = tallVoxels - 9;
      v.ellipsoid(-3.8, ly, 1.8, 4.0, 1.7, 4.0, leaf);
      v.ellipsoid(3.6, ly + 2.5, -1.6, 3.6, 1.6, 3.6, leaf);
    }
    return v;
  };
}

/**
 * Archive-Forest hybrid (`eyebirchVox`): a slender white birch trunk erupting
 * out of a rusted lateral steel file drawer, with wet glowing amber eyeballs
 * watching from carved black bark lenticels!
 */
export function eyebirchVox(tallVoxels = 92) {
  return () => {
    const v = new Vox();
    const birch = birchBarkMat(), cab = M('#5f6664', 1), folder = M('#d4be84', 2), moss = mossMat();
    const sclera = glow('#ffbe3b'), pupil = M('#141010', 0), lid = M('#24211e', 2);

    // Open steel filing-cabinet drawer planter at base
    v.rbox(-8.5, 0, -7.5, 8.5, 9.5, 7.5, 0.8, cab);
    v.rbox(-7.0, 8.5, -5.5, 7.0, 11.2, 5.5, 0.4, folder);
    v.ellipsoid(0, 11.0, 0, 5.5, 2.0, 5.0, moss);

    // Birch stem rising from the folders
    v.cyl('y', 0, 0, 9, tallVoxels, 3.4, birch, 2.8);

    // Three lenticel eye-scars (`y = 38, 46, 53`) facing +Z with glowing amber irises!
    for (const [ey, ox] of [[38, -0.8], [46, 0.6], [53, -0.4]]) {
      if (ey >= tallVoxels - 8) continue;
      v.ellipsoid(ox, ey, 2.8, 2.5, 1.3, 1.2, lid);
      v.ellipsoid(ox, ey, 3.3, 1.8, 0.95, 0.9, sclera);
      v.box(ox - 0.35, ey - 0.8, 3.9, ox + 0.35, ey + 0.8, 4.4, pupil);
    }
    return v;
  };
}

/**
 * The Bark-Mimic (`timberAuditorVox`, 2.8 cm `Vox`) for `old-growth`:
 * Nearly indistinguishable from a mossy barcoded hemlock trunk until it moves —
 * root-clawed feet, fissured hemlock-bark torso, stapled `AUDITOR` barcode badge,
 * branch-like bark arms holding a clipboard polypore shelf, and a hollow knot
 * face with two dim amber sap pinpricks.
 */
export function timberAuditorVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), moss = mossMat(), needles = needleMat();
    const fungus = M('#cf6b24', 2), page = M('#e8e2ce', 2), tag = M('#eef0ec', 1), ink = M('#181a1b', 1);
    const eye = glow('#ffb030');

    // Root-splayed stilt legs that merge visually into a single trunk silhouette!
    for (const sx of [-2.4, 2.4]) {
      v.tube(sx * 1.6, 0.8, 3.8, sx, 5.5, 0, 1.9, bark);
      v.tube(sx * 1.5, 0.8, -3.5, sx, 5.5, 0, 1.8, bark);
      v.cyl('y', sx, 0, 4, 28, 2.5, bark);
    }
    v.ellipsoid(0, 2.2, 0, 6.2, 2.4, 6.0, moss);

    // Fluted hemlock-bark torso (`y = 26..64`) + stapled white barcode tag
    v.cyl('y', 0, 0, 26, 66, 4.9, bark, 4.3);
    v.ellipsoid(-2.5, 48, 2.0, 4.2, 2.0, 3.8, moss);
    v.rbox(-2.6, 41, 4.2, 2.6, 45.5, 5.4, 0.5, tag);
    v.box(-2.0, 42.2, 5.1, 2.0, 43.8, 5.7, ink);

    // Gnarled branch arms cradling an orange polypore "clipboard" with tally sheet
    v.tube(-5.0, 50, 0, -4.2, 37, 5.5, 1.8, bark);
    v.tube(5.0, 50, 0, 3.8, 37, 5.5, 1.8, bark);
    v.ellipsoid(0, 36.5, 6.8, 5.2, 1.2, 4.2, fungus);
    v.rbox(-3.2, 37.4, 4.4, 3.2, 38.2, 9.0, 0.3, page);

    // Hollow bark-knot face (`y = 56`) + high evergreen crown tuft above head!
    v.carve(-2.8, 53.5, 2.6, 2.8, 58.5, 6.0);
    v.sphere(-1.2, 56.2, 2.6, 0.75, eye);
    v.sphere(1.2, 56.2, 2.6, 0.75, eye);
    v.cyl('y', 0, 0, 65, 82, 4.1, bark, 3.6);
    v.ellipsoid(0, 78, 0, 7.8, 2.6, 7.8, needles);
    return v;
  };
}

/**
 * Giant vertical upturned root-plate (`uprootedPlateVox`) for `windthrow`:
 * A `2.1 m` disc of ripped-up office carpet backing, concrete screed slabs, peat
 * clods, dangling yellow Romex electrical cable, and gnarled radiating roots!
 */
export function uprootedPlateVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), peat = M('#2e2115', 3), carpet = M('#7c745c', 2);
    const screed = M('#6e706d', 2), moss = mossMat(), romex = M('#e0b624', 1);

    // Thick vertical disc of torn peat & roots (`x = -24..24, y = 0..42, z = -5..5`)
    v.ellipsoid(0, 20, 0, 23, 21, 4.8, peat);
    // Torn square of beige office carpet & grey floor screed peeled up on the `-Z` underside!
    v.rbox(-16, 4, -6.2, 15, 31, -3.8, 0.8, screed);
    v.rbox(-14, 6, -7.0, 13, 28, -5.5, 0.6, carpet);
    v.ellipsoid(0, 38, 1.0, 12, 3.5, 5.2, moss);

    // Radiating gnarled cedar roots & dangling Romex floor wire
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rx = Math.cos(a) * 26, ry = 20 + Math.sin(a) * 20;
      if (ry < 2) continue;
      v.tube(0, 19, 3.5, rx, ry, 2.5, 2.1, bark);
    }
    // Broken horizontal trunk stub jutting forward (`+Z`) from center of root ball
    v.cyl('z', 0, 16, 2, 18, 5.8, bark);
    v.tube(-6, 26, -6.5, -8, 8, -8.5, 0.75, romex);
    return v;
  };
}

/**
 * Giant Pacific Northwest Sword-Fern Rosette (`pnwSwordFernClusterVox`):
 * 8 wide arching *Polystichum munitum* fronds (`~1.1 m` span at `0.032` scale)
 * with dark-to-chartreuse pinnae and coiled brown fiddleheads at the crown!
 */
export function pnwSwordFernClusterVox() {
  return () => {
    const v = new Vox();
    const crown = M('#382415', 2), stalk = M('#23451e', 2);
    const frondDark = M('#1b3d18', 2), frondMid = M('#2d5e24', 2), frondTip = M('#478034', 2);

    v.ellipsoid(0, 1.8, 0, 4.2, 2.2, 4.2, crown);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.22;
      const ca = Math.cos(a), sa = Math.sin(a);
      const reach = i % 2 === 0 ? 17.5 : 14.5;
      const peakY = i % 2 === 0 ? 11.5 : 14.0;
      v.tube(ca * 1.8, 2.0, sa * 1.8, ca * (reach * 0.55), peakY, sa * (reach * 0.55), 1.0, stalk);
      v.tube(ca * (reach * 0.55), peakY, sa * (reach * 0.55), ca * reach, peakY * 0.42, sa * reach, 0.85, frondMid);
      // Compound pinnae blades along the arching rachis
      for (let s = 1; s <= 4; s++) {
        const f = s / 4.4;
        const px = ca * reach * f, pz = sa * reach * f;
        const py = 2.0 + Math.sin(f * Math.PI * 0.82) * peakY;
        const w = (1.15 - f * 0.65) * 3.4;
        const mat = s === 1 ? frondDark : s < 4 ? frondMid : frondTip;
        v.ellipsoid(px, py, pz, w, 0.85, w, mat);
      }
    }
    // Coiled brown fiddlehead crosiers rising in the middle
    for (const [fx, fz] of [[-1.2, 0.8], [1.1, -0.9]]) {
      v.tube(fx * 0.5, 2.2, fz * 0.5, fx, 8.5, fz, 0.75, crown);
      v.ellipsoid(fx * 1.2, 9.2, fz * 1.2, 1.4, 1.4, 1.4, crown);
    }
    return v;
  };
}

/**
 * Iconic Pacific Northwest Nurse Stump (`pnwMossyStumpNurseVox`):
 * A wide, buttressed cedar stump draped in thick emerald moss cushions, red-belted
 * shelf conks, old logger springboard notches, a rusted office cabinet pull, and
 * a young Western hemlock sapling sprouting out of its decaying heartwood top!
 */
export function pnwMossyStumpNurseVox() {
  return () => {
    const v = new Vox();
    const bark = pineBarkMat(), wood = M('#6e4929', 2), moss = mossMat();
    const conk = M('#b84d21', 2), conkLip = M('#e3d6be', 2), needles = needleMat();
    const chrome = M('#8d9699', 0);

    // Flared root buttresses + wide fluted cedar stump (`r = 12 -> 9`, `y = 0..22`)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      v.tube(Math.cos(a) * 15, 1.2, Math.sin(a) * 15, Math.cos(a) * 7.5, 11, Math.sin(a) * 7.5, 2.8, bark);
    }
    v.cyl('y', 0, 0, 0, 21, 10.5, bark, 8.8);
    v.cyl('y', 0, 0, 19, 22, 7.6, wood);
    // Springboard notch + mossy shoulder pads
    v.carve(6.2, 9, -3.5, 12, 13, 3.5);
    v.ellipsoid(-3.5, 22.2, 2.0, 6.2, 2.2, 5.4, moss);
    v.ellipsoid(4.2, 21.8, -2.5, 5.0, 2.0, 4.8, moss);
    v.ellipsoid(-8.5, 6.5, -4.0, 4.8, 2.4, 4.2, moss);

    // Red-belted polypore conks on side + rusted office drawer handle swallowed by bark
    v.ellipsoid(-9.2, 13.5, 3.0, 3.4, 1.2, 3.2, conkLip);
    v.ellipsoid(-8.8, 14.2, 3.0, 2.9, 1.0, 2.7, conk);
    v.rbox(7.8, 5.5, -2.2, 9.8, 7.2, 2.2, 0.4, chrome);

    // Young hemlock nurse-sapling growing right out of the mossy top!
    v.tube(0.5, 21, 0, -0.5, 42, 0.5, 1.35, bark);
    v.ellipsoid(0, 30, 0, 6.8, 2.0, 6.5, needles);
    v.ellipsoid(-0.4, 36.5, 0.4, 5.0, 1.8, 4.8, needles);
    v.ellipsoid(-0.5, 42, 0.5, 3.2, 1.6, 3.2, needles);
    return v;
  };
}



