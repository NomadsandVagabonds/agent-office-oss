// The Backrooms — Interoffice Mail (`in-tray`: "the letter trays the size of offices"). A preview (&preview=intray on
// the dev page, docs/BLOCKROOMS-PREVIEWS.md); nothing deals it yet.
//
// A compact windowless atrium. Against its back wall, three smoked-amber desk letter trays the size of offices, one on
// another, open fronts with a thumb notch toward you, tapering ribbed sides, a lug at each front corner. In each one,
// the end of an ordinary yellow office: carpet, ceiling tiles and strip lights, one closed brown door. The middle one
// is pulled forward, and its notched lip meets a carpeted landing a short stair goes up to. On the landing, on the near
// edge of a grey metal desk, an ordinary two-tier letter tray with one sheet in it; and in its lower slot, if you look,
// a very small office with its lights on and a door.
//
// The way (layout.js): up onto the landing, through the notch into the middle office, round the back of its short
// sidewall, down the stair in the gap at the side, through the opening at the back of the lower tray's sidewall into
// the lower office, and out by its door: the room's back doorway (`ports: ['back']`). A floor that gives the room no
// back doorway leaves that door shut and the room a dead end, walked back the way you came. The top office is only
// seen. Two offices that are walked never lie over one another: the floor is one height at any spot (world.js).
//
// What stops you is what is drawn: a sidewall, a lip, the divider, the desk are colliders; a drop or a climb of more
// than a stair is stopped by the floor's own height (world.js passable). Nothing is furniture, nothing moves, nothing
// reads the seeded stream but the side the way down is on (the roll).
import { lin, WHITE } from '../kit.js';
import { woodLeaf } from '../bits.js';
import { TRAY, layout, floorIn, ceilIn } from './in-tray/layout.js';

const AMBER = lin('#b47c24'), RIB = lin('#8f5d18'), RIM = lin('#f4c862'), LUG = lin('#9c6a22');
const STEEL = lin('#8e9297'), STEEL_D = lin('#6c7075'), CREAM = lin('#e2d8bd'), DOOR = lin('#6a3d22');
const q = (v, k = 0.05) => Math.round(v / k) * k;

export function build(c) {
  const { W, D, H, kit, look } = c, L = layout(W, D, H, c.params), s = L.s, T = TRAY.T;
  const X = (u) => s * u, trim = lin(look.trim);
  c.shell({ panels: false });
  const spills = c.rt.lights.length;                     // (the light spilling in at the doorways, the shell's)

  /* ---- drawing in u: x = s · u, so the way down is always on +u ------------------------------------------------- */
  const flip = (skip = '') => (s > 0 ? skip.replace(/u/g, 'x') : skip.replace(/[+-]u/g, (m) => (m[0] === '+' ? '-x' : '+x')));
  const B = (batch, u0, y0, z0, u1, y1, z1, rgb = WHITE, o = {}) => {
    const a = X(u0), b = X(u1);
    if (y1 - y0 > 1e-4 && z1 - z0 > 1e-4 && Math.abs(b - a) > 1e-4) batch.box(Math.min(a, b), y0, z0, Math.max(a, b), y1, z1, rgb, { ...o, skip: flip(o.skip) });
  };
  const paper = (u0, y0, z0, u1, y1, z1, skip = '') => B(c.wall, u0, y0, z0, u1, y1, z1, WHITE, { uv: 0.8, step: 0.5, skip });
  const carpet = (u0, y, z0, u1, z1) => B(c.floor, u0, y - 0.02, z0, u1, y, z1, WHITE, { uv: 1.6, step: 0.5, skip: '-y+u-u+z-z' });
  const tiles = (u0, y, z0, u1, z1, uv = 0.6) => B(c.ceil, u0, y - 0.004, z0, u1, y + 0.016, z1, WHITE, { uv, step: 0.6, skip: '+y+u-u+z-z' });
  const solid = (u0, z0, u1, z1, tall = true) => { const a = X(u0), b = X(u1); c.solid(Math.min(a, b), z0, Math.max(a, b), z1, { tall }); };
  const blot = (u0, z0, u1, z1, y, a = 0.35, o = {}) => { const xa = X(u0), xb = X(u1); c.blot((xa + xb) / 2, (z0 + z1) / 2, Math.abs(xb - xa), z1 - z0, { y: y + 0.006, a, ...o }); };
  const skirt = (u0, y, z0, u1, z1) => B(c.flat, u0, y, z0, u1, y + 0.11, z1, trim, { skip: '-y' });

  /** A ribbed amber panel standing on y over [a0, a1] along z (at u from uFace outward by `out`) or along u (at z). */
  const ribs = (along, a0, a1, at, out, y, hOf, gaps = [], bt = c.flat) => {
    for (let a = a0; a < a1 - 1e-6; a += 0.1) {
      const b = Math.min(a1, a + 0.1), m = (a + b) / 2;
      if (gaps.some(([g0, g1]) => m > g0 && m < g1)) continue;
      const h = Math.max(0.03, q(hOf(m))), k = Math.round(a / 0.1) % 2 === 0, d = k ? 0.035 : 0.022;
      if (along === 'z') {
        const u0 = Math.min(at, at + out * d), u1 = Math.max(at, at + out * d);
        B(bt, u0, y, a, u1, y + h - 0.03, b, k ? AMBER : RIB, { skip: '-y' });
        B(c.flat, Math.min(at, at + out * 0.04), y + h - 0.03, a, Math.max(at, at + out * 0.04), y + h, b, RIM, { skip: '-y' });
      } else {
        B(bt, a, y, Math.min(at, at + out * d), b, y + h - 0.03, Math.max(at, at + out * d), k ? AMBER : RIB, { skip: '-y' });
        B(c.flat, a, y + h - 0.03, Math.min(at, at + out * 0.04), b, y + h, Math.max(at, at + out * 0.04), RIM, { skip: '-y' });
      }
    }
  };
  /** Inside a tray, against each sidewall, the front of the tray's own smoked side: tall, then stepping down to its lip.
   * (Behind it, the office's paper. In the glass batch: the paper shows through it.) */
  const cheeks = (zf, y, tall, low, a = uo, b = us, from = -Infinity) => {
    const hOf = (z) => (z < zf - 2.3 ? tall : z > zf - 0.45 ? low : tall + (low - tall) * (z - (zf - 2.3)) / 1.85);
    ribs('z', zf - 2.9, zf - T, a, 1, y, hOf, [], c.glass); ribs('z', Math.max(zf - 2.9, from), zf - T, b, -1, y, hOf, [], c.glass);
  };
  /** A sidewall's profile: tall at the back, stepping down toward the front to the lip's height. */
  const taper = (zf, tall, low) => (z) => { const t = Math.max(0, Math.min(1, (z - (zf - 2.9)) / 2.4)); return Math.round((tall + (low - tall) * t) / 0.1) * 0.1; };
  /** A lip's profile: `hi` either side, a stepped thumb notch down to `lo` over [n0, n1]. */
  const notch = (n0, n1, hi, lo, slope = 0.6) => (u) => {
    const d = u < n0 ? n0 - u : u > n1 ? u - n1 : 0;
    return Math.round((lo + (hi - lo) * Math.min(1, d / slope)) / 0.1) * 0.1 || lo;
  };
  /** A tray's floor plate, amber at its edges: [u0, u1] × [z0, z1], from y0 to y1. */
  const plate = (u0, u1, z0, z1, y0, y1) => {
    B(c.flat, u0, y0, z0, u1, y1, z1, AMBER, { skip: '+y' });
    B(c.flat, u0, y1 - 0.025, z1 - 0.02, u1, y1 + 0.005, z1 + 0.012, RIM);          // the polished front edge
  };
  /** A stacking lug: a stepped block at a front corner, standing on y. */
  const lug = (u, z, y, h) => { B(c.flat, u - 0.14, y, z - 0.3, u + 0.14, y + h, z, LUG); B(c.flat, u - 0.1, y + h, z - 0.24, u + 0.1, y + h + 0.06, z - 0.04, RIM); };
  /** One closed brown door on a wall facing +z at z, its foot at y, its middle at u; with its cream frame. */
  const door = (u, y, z, w = 0.9, h = 2.05) => {
    const x = X(u);
    woodLeaf(c, c.vox, [x, y, z + 0.004], [1, 0, 0], [0, 1, 0], [0, 0, 1], w, h, 0.04, DOOR);
    for (const dx of [-1, 1]) c.flat.box(x + dx * (w / 2 + 0.035) - 0.035, y, z, x + dx * (w / 2 + 0.035) + 0.035, y + h + 0.07, z + 0.05, CREAM, { skip: '-y-z' });
    c.flat.box(x - w / 2 - 0.07, y + h, z, x + w / 2 + 0.07, y + h + 0.07, z + 0.05, CREAM, { skip: '-z' });
    c.blot(x, z + 0.25, w + 0.2, 0.5, { y: y + 0.006, a: 0.3 });                     // where feet have stood
  };

  /* ---- the lower tray: the room's own floor, its back wall the room's ------------------------------------------- */
  const { zb, zl, zm, zt, zd, us, uo, uc, CL, CM, Y1, Y2 } = L;
  {
    const top = CL;
    paper(uo - T, 0, zb, uo, top, zl - T);                                                       // the far sidewall
    // the near one (the gap's side), with the opening at its back you come in by
    paper(us, 0, zb, us + T, top, L.hole.z0); paper(us, 0, L.hole.z1, us + T, top, zl - T);
    paper(us, L.hole.h, L.hole.z0, us + T, top, L.hole.z1);
    for (const [a, b] of [[zb, zl - T]]) { skirt(uo, 0, a, uo + 0.022, b); }
    skirt(us - 0.022, 0, zb, us, L.hole.z0); skirt(us - 0.022, 0, L.hole.z1, us, zd);
    tiles(uo, top, zb, us, zl - T);
    // the divider across it, under the middle office's back wall: what you look over at the rest of it
    ribs('u', uo, us, zd, -1, 0, () => 1.05); ribs('u', uo, us, zd, 1, 0, () => 1.05);
    solid(uo, zd - 0.06, us, zd + 0.04, false);
    // its lip: low, a thumb notch nearly to the carpet
    ribs('u', uo - T, us + T, zl - 0.04, 1, 0, notch(uc - 1.3, uc + 1.3, 0.6, 0.05));
    // the amber outside its sidewalls (not where the opening is)
    ribs('z', zb, zl, us + T, 1, 0, taper(zl, CL, 0.6), [[L.hole.z0 - 0.05, L.hole.z1 + 0.05]]);
    ribs('z', zb, zl, uo - T, -1, 0, taper(zl, CL, 0.6));
    solid(uo - T, zb, uo + 0.04, zm); solid(us - 0.04, L.hole.z1, us + T, zd); solid(us - 0.04, zb, us + T, L.hole.z0);
    cheeks(zl, 0, CL, 0.6);
    // the room's back doorway is its door: or, where the floor gave none, a door that stays shut
    const back = c.room.doors.find((dr) => dr.side === 'back');
    if (!back) door(0, 0, zb);
    else { const xc = back.c, w = back.w; for (const dx of [-1, 1]) c.flat.box(xc + dx * (w / 2 + 0.035) - 0.035, back.sill, zb, xc + dx * (w / 2 + 0.035) + 0.035, back.sill + back.h + 0.07, zb + 0.05, CREAM, { skip: '-y-z' }); }
    // wear: the carpet darker along its walls, a stain on its ceiling, the walked line to the door
    blot(uo, zb, uo + 0.35, zd, 0, 0.3); blot(us - 0.35, L.hole.z1, us, zd, 0, 0.3); blot(uo, zb, us, zb + 0.3, 0, 0.25);
    blot(uo, zd - 0.4, us, zd, 0, 0.3); blot(uo, zd, us, zl, 0, 0.18);
    blot(us - 1.6, zb + 0.4, us - 0.2, zb + 1.2, 0, 0.12);
    blot(uc + 1.1, zd + 0.6, uc + 2.2, zd + 1.5, top, 0.28, { down: true, y: top - 0.009, rgb: [0.32, 0.22, 0.08] });
  }

  /* ---- the middle tray: the way in ---------------------------------------------------------------------------------- */
  {
    plate(uo - T - 0.03, us + T + 0.03, zb, zm, CL, Y1);
    carpet(uo, Y1, zd, us, zm - T);
    paper(uo - T, Y1, zd, uo, CM, zm - T);                                                        // the far sidewall
    paper(us, Y1, L.turn.z1, us + T, CM, zm - T);                                                 // the short one
    paper(us, Y1 + L.turn.h, L.turn.z0, us + T, CM, L.turn.z1);                                   // over where you round it
    paper(uo - T, Y1, zd - T, us + T, CM, zd, '-z');                                              // its back wall
    skirt(uo, Y1, zd, uo + 0.022, zm - T); skirt(us - 0.022, Y1, L.turn.z1, us, zm - T); skirt(uo, Y1, zd, us, zd + 0.022);
    door(uc, Y1, zd);
    tiles(uo, CM, zd, us, zm - T);
    B(c.flat, uo - T - 0.03, CM, zt, us + T + 0.03, CM + 0.06, zm, AMBER);                        // its own roof, out past the top tray
    // the lip, the notch at the landing's height
    ribs('u', uo - T, us + T, zm - 0.04, 1, Y1, notch(L.notch.u0, L.notch.u1, TRAY.lip, 0.03));
    solid(uo - T, zm - T, L.notch.u0, zm, false); solid(L.notch.u1, zm - T, us + T, zm, false);
    ribs('z', zd, zm, us + T, 1, Y1, taper(zm, CM - Y1, TRAY.lip), [[L.turn.z0 - 0.05, L.turn.z1 + 0.05]]);
    ribs('z', zb, zm, uo - T, -1, Y1, taper(zm, CM - Y1, TRAY.lip));
    solid(us - 0.04, L.turn.z1, us + T, zm);
    cheeks(zm, Y1, CM - Y1, TRAY.lip, uo, us, L.turn.z1 + 0.05);
    { const u = uo - T - 0.1; lug(u, zm, CL - 0.3, 0.3); lug(u, zm, Y1, 0.22); }            // (the near side's would stand on the ledge)
    blot(uo, zd, uo + 0.35, zm, Y1, 0.3); blot(us - 0.35, L.turn.z1, us, zm, Y1, 0.3); blot(uo, zd, us, zd + 0.35, Y1, 0.3);
    blot(L.notch.u0 + 0.2, zm - 1.4, L.notch.u1 - 0.2, zm, Y1, 0.16);                            // where everybody comes in
    blot(us - 1.2, zd + 0.2, us, zd + 1.4, Y1, 0.2);                                              // and turns
    blot(uo + 0.6, zd + 1.2, uo + 1.5, zd + 2.0, CM, 0.3, { down: true, y: CM - 0.009, rgb: [0.3, 0.2, 0.07] });
  }

  /* ---- the top tray: only seen. Its back wall is the room's, its ceiling the room's own -------------------------------- */
  const tp = L.top;
  {
    plate(tp.uo - T - 0.03, tp.us + T + 0.03, zb, zt, CM, Y2);
    carpet(tp.uo, Y2, zb, tp.us, zt - T);
    paper(tp.uo - T, Y2, zb, tp.uo, H, zt - T); paper(tp.us, Y2, zb, tp.us + T, H, zt - T);
    skirt(tp.uo, Y2, zb, tp.uo + 0.022, zt - T); skirt(tp.us - 0.022, Y2, zb, tp.us, zt - T); skirt(tp.uo, Y2, zb, tp.us, zb + 0.022);
    door((tp.uo + tp.us) / 2 + 0.8, Y2, zb);
    ribs('u', tp.uo - T, tp.us + T, zt - 0.04, 1, Y2, notch((tp.uo + tp.us) / 2 - 1.2, (tp.uo + tp.us) / 2 + 1.2, 0.9, 0.12));
    ribs('z', zb, zt, tp.us + T, 1, Y2, taper(zt, H - Y2 - 0.35, 0.9));
    ribs('z', zb, zt, tp.uo - T, -1, Y2, taper(zt, H - Y2 - 0.35, 0.9));
    for (const u of [tp.uo - T - 0.1, tp.us + T + 0.1]) lug(u, zt, CM - 0.26, 0.26);
    cheeks(zt, Y2, H - Y2 - 0.35, 0.9, tp.uo, tp.us);
    blot(tp.uo, zb, tp.uo + 0.35, zt, Y2, 0.3); blot(tp.us - 0.35, zb, tp.us, zt, Y2, 0.3);
  }

  /* ---- the landing, the stair up to it, the gap and the stair down it ------------------------------------------------ */
  {
    const m = L.mezz;
    paper(m.u0, 0, m.z0, m.u1, Y1 - 0.02, m.z1, '-y+y-z');
    carpet(m.u0, Y1, m.z0, m.u1, m.z1);
    B(c.flat, m.u0 - 0.015, Y1 - 0.05, m.z1 - 0.015, m.u1 + 0.015, Y1 + 0.005, m.z1 + 0.015, trim, { skip: '-y' });   // its nosing
    skirt(m.u0 - 0.022, 0, m.z0, m.u0, m.z1); skirt(m.u1, 0, m.z0, m.u1 + 0.022, m.z1);
    skirt(m.u0, 0, m.z1, L.up.u0, m.z1 + 0.022); skirt(L.up.u1, 0, m.z1, m.u1, m.z1 + 0.022);
    blot(m.u0 - 0.3, m.z0, m.u1 + 0.3, m.z1 + 0.35, 0, 0.32);
    const up = L.up, run = TRAY.upRun;
    for (let i = 0; i < TRAY.steps - 1; i++) {
      const z0 = up.z0 + i * run, h = Y1 - (i + 1) * TRAY.rise;
      B(c.floor, up.u0, 0, z0, up.u1, h, z0 + run, WHITE, { uv: 1.6, skip: '-y-z', step: 0.5 });
      B(c.flat, up.u0, h - 0.025, z0 + run - 0.02, up.u1, h + 0.004, z0 + run + 0.008, trim);
    }
    blot(up.u0 - 0.25, up.z0, up.u1 + 0.25, up.z1 + 0.3, 0, 0.3);
    const dn = L.down, ledge = L.ledge;
    paper(ledge.u0, 0, ledge.z0, ledge.u1, Y1 - 0.02, ledge.z1, '-y+y-u+u-z');
    carpet(ledge.u0, Y1, ledge.z0, ledge.u1, ledge.z1);
    B(c.flat, ledge.u0, Y1 - 0.05, ledge.z1 - 0.015, ledge.u1, Y1 + 0.005, ledge.z1 + 0.015, trim, { skip: '-y' });
    skirt(ledge.u0, 0, ledge.z1, ledge.u1, ledge.z1 + 0.022);
    ribs('u', ledge.u0, ledge.u1, ledge.z1 - 0.06, -1, Y1, () => 0.95);                           // a rail across its open end
    solid(ledge.u0, ledge.z1 - 0.08, ledge.u1, ledge.z1, false);
    for (let i = 0; i < TRAY.steps - 1; i++) {
      const z1 = dn.z1 - i * TRAY.downRun, h = Y1 - (i + 1) * TRAY.rise;
      B(c.floor, dn.u0, 0, z1 - TRAY.downRun, dn.u1, h, z1, WHITE, { uv: 1.6, skip: '-y+z+u-u', step: 0.5 });
      B(c.flat, dn.u0, h - 0.025, z1 - TRAY.downRun - 0.008, dn.u1, h + 0.004, z1 - TRAY.downRun + 0.02, trim);
    }
    blot(dn.u0, zb, dn.u1, dn.z0, 0, 0.25);
    blot(ledge.u0 - 0.2, ledge.z1, ledge.u1, ledge.z1 + 0.4, 0, 0.3);
  }

  /* ---- the desk on the landing, and the letter tray on its near edge --------------------------------------------- */
  {
    const k = L.desk, y = Y1, ty = y + 0.74;
    B(c.flat, k.u0, ty - 0.035, k.z0, k.u1, ty, k.z1, lin('#9a9ea3'));                             // its top
    B(c.flat, k.u1 - 0.44, y + 0.02, k.z0 + 0.03, k.u1 - 0.03, ty - 0.035, k.z1 - 0.03, STEEL);     // the drawers
    for (let i = 0; i < 3; i++) {
      const y0 = y + 0.06 + i * 0.21;
      B(c.flat, k.u1 - 0.42, y0, k.z1 - 0.03, k.u1 - 0.05, y0 + 0.19, k.z1 - 0.018, lin('#a2a6ab'));
      B(c.flat, k.u1 - 0.3, y0 + 0.13, k.z1 - 0.018, k.u1 - 0.17, y0 + 0.15, k.z1 - 0.005, STEEL_D);
    }
    B(c.flat, k.u0 + 0.03, y, k.z0 + 0.03, k.u0 + 0.07, ty - 0.035, k.z1 - 0.03, STEEL);           // its legs, a modesty panel
    B(c.flat, k.u0 + 0.07, y + 0.3, k.z0 + 0.05, k.u1 - 0.44, ty - 0.035, k.z0 + 0.07, STEEL_D);
    solid(k.u0, k.z0, k.u1, k.z1, false);
    blot(k.u0 - 0.1, k.z0 - 0.1, k.u1 + 0.1, k.z1 + 0.1, y, 0.42);
    blot(k.u1 - 0.6, k.z1 + 0.05, k.u1 + 0.1, k.z1 + 0.75, y, 0.14);                              // the scuffed patch where a chair was
    miniature(c, X, B, k.u1 - 0.2, ty, (k.z0 + k.z1) / 2);
  }

  /* ---- the lights: each office its own strips, the room's panels for the top office and the atrium --------------------- */
  {
    // (the shell's lamp for a ceiling `clear` metres over the floor under it; c.fitting would work it out from the room's
    // one floor, which the middle office is not on)
    const lampFor = (clear) => { const head = Math.max(0.3, Math.min(2.5, clear / 2.6)), pw = 1.05 * c.room.light.power * Math.pow(head, 1.5); return { power: pw, k: 3.4 * (head < 1 ? head * head : head), far: 14 * Math.max(0.5, head) }; };
    const snapX = (u) => { const x = X(u); return (Math.round(x / 0.6 - 0.5) + 0.5) * 0.6; }, snapZ = (z) => Math.round(z / 0.6) * 0.6;
    let budget = 15 - spills;
    const fit = (u, z, y, clear, o = {}) => { const lamp = budget > 0 && o.lamp !== false; if (lamp) budget--; c.fitting(snapX(u), snapZ(z), { y, light: lamp ? lampFor(clear) : false, ...o }); };
    for (const du of [-1.5, 1.5]) fit(uc + du, zb + 1.8, CL, CL);                                     // the lower office, walked
    fit(uc - 1.5, zl - 1.4, CL, CL); fit(uc + 1.5, zl - 1.4, CL, CL, { lamp: false });               // …and the part under the middle one
    for (const [du, z] of [[-1.5, zd + 1.2], [1.5, zd + 1.2], [-1.5, zm - 1.0], [1.5, zm - 1.0]]) fit(uc + du, z, CM, CM - Y1);
    // the room's own panels, as the floor rolled them: in the top office (its ceiling), and over the atrium
    const tw = (u) => Math.abs(u - tp.uo) < 0.45 || Math.abs(u - tp.us) < 0.45;
    const ps = c.room.panels.filter((p) => !(p.z < zt + 0.7 && tw(s * p.x)));
    const inTop = (p) => p.z < zt && s * p.x > tp.uo && s * p.x < tp.us;
    for (const p of [...ps.filter(inTop), ...ps.filter((p) => !inTop(p))]) {
      const lamp = p.state !== 'dead' && budget > 0;
      if (lamp) budget--;
      c.fitting(p.x, p.z, { dead: p.state === 'dead', flick: p.state === 'flicker', light: lamp ? lampFor(inTop(p) ? H - Y2 : H) : false });
    }
  }

  /* ---- walking it ------------------------------------------------------------------------------------------------------ */
  c.rt.floorY = (x, z) => floorIn(L, s * x, z, c.floorAt(x, z));
  c.rt.headY = (x, z) => { const f = c.rt.floorY(x, z); return ceilIn(L, s * x, z, f) - f; };
  c.rt.inTray = L;                                       // (for the dev page and the test)
}

/**
 * The ordinary two-tier letter tray on the desk, its open end toward the landing's walkway (+u), so whoever comes up
 * the stair looks straight into it: one sheet in the top tier, and in the lower one a very small office. Drawn in its
 * own frame (d: deep, + toward its open end; w: across), centred on (u, z), standing on y.
 */
function miniature(c, X, B, u, y, z) {
  const { kit } = c, w = 0.27, d = 0.36, tier = 0.085, th = 0.005, k = 1 / 30, hw = w / 2, hd = d / 2, sg = Math.sign(X(1));
  const M = (batch, d0, y0, w0, d1, y1, w1, rgb = WHITE, o = {}) => B(batch, u + d0, y0, z + w0, u + d1, y1, z + w1, rgb, o);
  for (let t = 0; t < 2; t++) {
    const yb = y + 0.008 + t * tier;
    M(c.flat, -hd, yb - th, -hw, hd, yb, hw, AMBER);                                                             // its floor
    for (const sw of [-1, 1]) for (let i = 0; i < 9; i++) {                                                      // tapering ribbed sides
      const a = -hd + (i * d) / 9, b = a + d / 9, h = Math.max(0.025, 0.075 - Math.max(0, (a + hd) / d - 0.35) * 0.08);
      M(c.flat, a, yb, sw * hw - (sw > 0 ? th : 0), b - 0.002, yb + Math.round(h / 0.01) * 0.01, sw * hw + (sw < 0 ? th : 0), i % 2 ? RIB : AMBER);
    }
    M(c.flat, -hd, yb, -hw, -hd + th, yb + 0.075, hw, AMBER);                                                    // its back
    for (const [a, b, h] of [[-hw, -0.06, 0.03], [-0.06, 0.06, 0.012], [0.06, hw, 0.03]]) M(c.flat, hd - th, yb, a, hd, yb + h, b, RIM);   // the notched lip
    if (t === 0) for (const sw of [-1, 1]) for (const dd of [-hd + 0.01, hd - 0.02]) M(c.flat, dd, yb + 0.075, sw * (hw - 0.012) - 0.006, dd + 0.01, yb + tier - th, sw * (hw - 0.012) + 0.006, LUG);
  }
  // the very small office: carpet, paper, tiles, two strips lit, a door at the end of it
  const yb = y + 0.008, top = yb + 0.072, iw = hw - th - 0.004;
  M(c.floor, -hd + th, yb, -iw, hd - 0.012, yb + 0.002, iw, WHITE, { uv: 1.6 * k, skip: '-y' });
  for (const sw of [-1, 1]) M(c.wall, -hd + th, yb, sw * iw - 0.002, hd - 0.03, top, sw * iw + 0.002, WHITE, { uv: 0.8 * k });
  M(c.wall, -hd + th, yb, -iw, -hd + th + 0.003, top, iw, WHITE, { uv: 0.8 * k });
  M(c.ceil, -hd + th, top, -iw, hd - 0.012, top + 0.002, iw, WHITE, { uv: 0.6 * k, skip: '+y' });
  const lit = c.shining('mini-panel', kit.tex.panel(true), 2.5, lin(c.look.tube)), yl = top - 0.0005;
  for (const dd of [0.09, 0.2]) {
    const xa = X(u - hd + dd - 0.02), xb = X(u - hd + dd + 0.02), x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    lit.quad([x0, yl, z - 0.011], [x1, yl, z - 0.011], [x1, yl, z + 0.011], [x0, yl, z + 0.011]);
  }
  woodLeaf(c, c.vox, [X(u - hd + th + 0.003), yb + 0.002, z], [0, 0, -sg], [0, 1, 0], [sg, 0, 0], 0.03, 0.068, 0.002, DOOR);
  // and one sheet in the top one
  c.lay(c.mapped('paper', kit.tex.paper()), X(u), z, 0.21, 0.297, Math.PI / 2 + 0.03, null, WHITE, y + 0.008 + tier + 0.002);
}
