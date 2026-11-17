// The Backrooms — a room of the shopping centre (themes.js `mall`): Moving
// Stairs ("the hall of moving stairs"). Somebody was told that in a shopping
// centre the stairs move, and that they go everywhere. So a hall was given
// over to them, eight or nine metres of it, and they do go everywhere: over
// the hall in a loop, along it in a corkscrew, round a column of nothing in a
// banked helix, up the wall on their sides, through the roof. Most of them
// cannot be got onto.
//
// Down one side the floor stops. Past the edge is a shaft, its walls doors:
// office doors, each with its little lamp, all the way up to the roof and all
// the way down to where the lamps are too small to see. One of the stairs goes
// down into it. It stops at a landing with a door that can be reached; then it
// goes on down. Stay on, and it takes you.
//
// Three more can be got onto, as before. One goes up to the floor above
// through a covered way, and whoever walks in it is given the same stretch
// again (stand, and it takes you). One comes down. Between them the floor is
// belts, each going its own way, fast, to a slot with nothing in it.
//
// Its look is the shopping centre's (rooms/mens-ladies.js PAL): mauve carpet,
// walls the colour of plaster gone pink, beige for the shaft.
import { ticks } from '../kit.js';
import { P } from '../bits.js';
import { Vox, M } from '../../vox/vox.js';
import { upright, sheet } from '../suburb.js';
import { mallNeon, voidIn, dummyVox, MALL_TEX } from '../mall.js';
import { PAL, jacketVox } from './mens-ladies.js';
import { canLeave } from '../cast/paths.js';

// floor: the one above · run: a flight's length · half: half its width · speed: how fast a stair carries · cover, again, near: the covered way
// belts, belt, slot, fast: the belts · shaft: how wide · deep: how far down its walls are drawn · dive: the stair into it (where it levels
// off for the landing, how deep, how long the landing is, and how far the floor holds you either side of it)
export const STAIRS = Object.freeze({ floor: 3.4, deep: 3.0, run: 9, half: 0.6, speed: 1.25, cover: 1.2, again: 3.2, near: 1.5, tread: 0.4, belts: 5, belt: 1.1, slot: 0.8, fast: 2.6,
  shaft: 3.4, down: 16, ledge: -3.2, landing: 2.2, hold: 0.28, bottom: -14 });
const TREAD = [0.42, 0.4, 0.42], DARK = [0.26, 0.25, 0.28], EDGE = [0.85, 0.66, 0.12], SKIRT = [0.78, 0.7, 0.68], RAIL = [0.52, 0.42, 0.5];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** A bench to wait on: a frame of wood, three seats in mauve. Faces +z. */
function benchVox() { const v = new Vox(), wd = M('#b89a78', 2), up = M('#8a6070', 2);
  for (const x of [-34, 32]) { v.box(x, 0, -8, x + 3, 18, 10, wd); v.box(x, 18, -10, x + 3, 20, 10, wd); }
  for (let k = 0; k < 3; k++) { const x0 = -31 + k * 21; v.rbox(x0, 10, -8, x0 + 20, 15, 9, 1, up); v.rbox(x0, 15, -10, x0 + 20, 33, -6, 1, up); }
  v.box(-31, 8, -6, 32, 10, 8, wd); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = STAIRS, G = K.floor, env = c.env;
  const zT = -D / 2 + K.deep, zB = zT + K.run, xA = -W / 5, xB = W / 5, yOf = (z) => G * Math.max(0, Math.min(1, (zB - z) / K.run));
  const onA = (x, z) => Math.abs(x - xA) < K.half && z >= zT && z <= zB, onB = (x, z) => Math.abs(x - xB) < K.half && z >= zT && z <= zB;
  const wallT = MALL_TEX.panel(kit, 'stairs:wall:64', '#94767c');
  const ceilT = MALL_TEX.tile(kit, 'mall:tile:64', PAL.tile, PAL.grid);
  const carpetT = MALL_TEX.carpet(kit, 'mall:carpet:64', PAL.carpet, PAL.fleck);
  c.shell({ floor: false, panels: false, skirting: false, wallTex: wallT, ceilTex: ceilT });
  const flat = c.flat, det = c.detail, carpet = c.mapped('stairs:carpet', carpetT);

  /* where the floor is, and where it is not: the belts' slots, and the shaft down the right-hand side */
  // (the shaft runs the length of the right-hand wall, but stops short of any doorway in it: the longest stretch clear of them)
  const xS = W / 2 - K.shaft, cuts = (c.room.doors || []).filter((d) => d.side === 'right').map((d) => { const z = c.wallAt('right', d.c).z; return [z - d.w / 2 - 1.3, z + d.w / 2 + 1.3]; });
  let zs0 = zT, zs1 = D / 2; { let parts = [[zT, D / 2]]; for (const [a, b] of cuts) parts = parts.flatMap(([p0, p1]) => [[p0, Math.min(p1, a)], [Math.max(p0, b), p1]]).filter(([p0, p1]) => p1 - p0 > 0.5); const best = parts.sort((u, v) => (v[1] - v[0]) - (u[1] - u[0]))[0] || [zT, zT]; [zs0, zs1] = best; }
  const inShaft = (x, z) => x > xS && z > zs0 && z < zs1;
  const sOut = Math.min(2.7, xB - K.half - 0.2), sIn = sOut - K.slot, zL0 = zT + 1.6, zL1 = zL0 + K.belts * K.belt;
  const lane = (z) => (z > zL0 && z < zL1 ? Math.floor((z - zL0) / K.belt) : -1), inSlot = (x, z) => z > zL0 && z < zL1 && Math.abs(x) > sIn && Math.abs(x) < sOut;
  const way = R.shuffle([1, 1, -1, -1, 1]).map((d, i) => d * (i === 2 ? 1.25 : 1) * K.fast);
  // the stair into the shaft: down its near side, close to the edge; it goes the way of the hall's length, from the front to the back.
  // Level for a step at the top, down to the landing, level across it, then down again, steeper, to where it stops
  const dx = xS + K.half, z0d = zs1 - 0.4;
  // (where the shaft is short — a doorway in that wall — the landing is put at the stair's foot, shallower, and the stair stops at it;
  //  where there is the length, it goes on past it, down, to its end, and off that is the drop)
  let zl0 = z0d - 1.0 - (-K.ledge) / 0.62, ledgeY = K.ledge;
  if (zl0 - K.landing < zs0 + 0.3) { zl0 = zs0 + 0.3 + K.landing; ledgeY = -(z0d - 1.0 - zl0) * 0.62; }
  const zl1 = zl0 - K.landing, hasLanding = ledgeY < -1.2 && zl0 < z0d - 1.2, goesOn = hasLanding && zl1 - zs0 > 1.5, zEnd = goesOn ? zs0 + 0.6 : zl1;
  const diveY = (z) => z > z0d - 1.0 ? 0 : z > zl0 ? -(z0d - 1.0 - z) * 0.62 : z > zl1 || !goesOn ? ledgeY : Math.max(K.bottom, ledgeY - (zl1 - z) * 0.9);
  const onDive = (x, z) => hasLanding && Math.abs(x - dx) < K.half + K.hold && z <= z0d + 0.3 && z >= zEnd, onLanding = (x, z) => hasLanding && z <= zl0 && z >= zl1 && x > xS - 0.1;
  const ground = (x, z) => (z < zT ? G : onA(x, z) || onB(x, z) ? yOf(z) : inShaft(x, z) ? (onLanding(x, z) ? ledgeY : diveY(z)) : 0);
  voidIn(c, (x, z) => inSlot(x, z) || (inShaft(x, z) && !onDive(x, z) && !onLanding(x, z)), { floor: ground, relative: true });
  // the floor: carpet, but for the slots and the shaft; the floor above at the back
  const rect = (xa, xb, za, zb, y) => { if (xb - xa > 0.01 && zb - za > 0.01) carpet.grid([xa, y, za], [0, 0, 1], [1, 0, 0], ticks(zb - za), ticks(xb - xa), (u, v) => [(xa + v + c.room.cx) / 1.6, (za + u + c.room.cz) / 1.6]); };
  rect(-W / 2, xS, zL1, D / 2, 0); rect(-W / 2, xS, zT, zL0, 0); rect(-W / 2, -sOut, zL0, zL1, 0); rect(sOut, xS, zL0, zL1, 0); rect(xS, W / 2, zT, zs0, 0); rect(xS, W / 2, zs1, D / 2, 0); rect(-W / 2, W / 2, -D / 2, zT, G);
  flat.box(-W / 2, G - 0.22, zT - 0.02, W / 2, G, zT + 0.06, rgb(PAL.wood));
  sheet(flat, [-W / 2, 0, zT], [W / 2, 0, zT], [W / 2, G - 0.22, zT], [-W / 2, G - 0.22, zT], 8, 2, null, rgb('#7e6268'));
  const two = (batch, a, b, cc, d, alb) => { sheet(batch, a, b, cc, d, 1, 1, null, alb || [1, 1, 1]); sheet(batch, a, d, cc, b, 1, 1, null, alb || [1, 1, 1]); };
  const pink = c.shining('stairs:pink', kit.tex.white(), 1.8, [1, 0.5, 0.72]), warm = c.shining('stairs:warm', kit.tex.white(), 1.7, [1, 0.82, 0.55]), lilac = c.shining('stairs:lilac', kit.tex.white(), 1.7, [0.86, 0.72, 1]);

  /* the shaft: its walls drawn down to the bottom, panelled, darker as they go; doors on them at every height, each with its lamp */
  { const shaftT = c.mapped('stairs:shaft', MALL_TEX.panel(kit, 'stairs:shaft:64', '#b8aa96'));
    const bands = [0, -2, -4.5, -7.5, -11, K.bottom], shade = (y) => Math.max(0.3, 1 + y / 22);
    for (let i = 0; i + 1 < bands.length; i++) { const y1 = bands[i], y0 = bands[i + 1], a = shade((y0 + y1) / 2), al = [a, a, a * 0.97], uv = (s, t) => [s * 4, t * (y1 - y0) / 1.6];
      sheet(shaftT, [W / 2, y0, zs0], [W / 2, y0, zs1], [W / 2, y1, zs1], [W / 2, y1, zs0], 6, 2, uv, al);                    // the far wall
      sheet(shaftT, [xS, y0, zs1], [xS, y0, zs0], [xS, y1, zs0], [xS, y1, zs1], 6, 2, uv, al);                                // the near wall, under the hall's edge
      sheet(shaftT, [W / 2, y0, zs1], [xS, y0, zs1], [xS, y1, zs1], [W / 2, y1, zs1], 2, 2, uv, al);                    // the ends
      sheet(shaftT, [xS, y0, zs0], [W / 2, y0, zs0], [W / 2, y1, zs0], [xS, y1, zs0], 2, 2, uv, al); }
    flat.box(xS, K.bottom - 0.1, zs0, W / 2, K.bottom, zs1, [0.02, 0.02, 0.02]);
    flat.box(xS - 0.04, -0.12, zs0, xS + 0.02, 0.02, zs1, rgb(PAL.wood)); for (const z of [zs0, zs1]) if (z > zT + 0.01 && z < D / 2 - 0.01) flat.box(xS, -0.12, z - 0.03, W / 2, 0.02, z + 0.03, rgb(PAL.wood));                                                       // the edge, in wood
    // doors: on the far wall from the bottom to near the roof, on the near wall from the bottom to the hall's floor
    const door = (wall, z, y) => {                                                                                               // wall: 'far' (x = W/2, faces −x) or 'near' (x = xS, faces +x)
      const x = wall === 'far' ? W / 2 : xS, n = wall === 'far' ? -1 : 1, a = shade(y + 1), tone = (col) => rgb(col).map((v) => v * (0.35 + 0.65 * a));
      det.box(Math.min(x, x + n * 0.06), y - 0.05, z - 0.5, Math.max(x, x + n * 0.06), y + 2.08, z + 0.5, tone('#d8ccb8'));                   // the frame
      det.box(Math.min(x, x + n * 0.075), y, z - 0.44, Math.max(x, x + n * 0.075), y + 2.0, z + 0.44, tone(R.pick(['#7a5232', '#6e4a2a', '#86603c'])));   // the door
      det.box(Math.min(x, x + n * 0.1), y + 0.95, z + n * 0.3 - 0.03, Math.max(x, x + n * 0.1), y + 1.0, z + n * 0.3 + 0.03, tone('#c9a43a'));       // the handle
      det.box(Math.min(x, x + n * 0.14), y + 2.24, z - 0.17, Math.max(x, x + n * 0.14), y + 2.32, z + 0.17, tone('#c8c0b0'));                         // the lamp over it
      warm.box(Math.min(x + n * 0.02, x + n * 0.13), y + 2.19, z - 0.15, Math.max(x + n * 0.02, x + n * 0.13), y + 2.24, z + 0.15, [1, 1, 1]); };
    const rows = (wall, yLo, yHi) => { for (let y = yLo; y < yHi; y += R.range(2.4, 3.3)) for (let z = zs0 + R.range(0.7, 1.6); z < zs1 - 0.6; z += R.range(1.4, 2.8)) if (!(wall === 'far' && y > -1.5 && cuts.some(([a, b]) => z > a + 0.6 && z < b - 0.6))) door(wall, z, y); };
    rows('far', K.bottom + 0.5, H - 2.6); rows('near', K.bottom + 0.5, -2.4);
    // the landing: a bridge across the shaft at the stair's turn, and in the far wall at it, a door that can be reached
    if (hasLanding) { flat.box(xS, ledgeY - 0.18, zl1, W / 2, ledgeY, zl0, rgb('#8a7f78')); carpet.grid([xS, ledgeY + 0.003, zl1], [0, 0, 1], [1, 0, 0], ticks(zl0 - zl1), ticks(K.shaft), (u, v) => [(xS + v) / 1.6, (zl1 + u) / 1.6]);
    for (const z of goesOn ? [zl0, zl1] : [zl0]) { const x0 = xS + 2 * K.half + 0.1; flat.box(x0, ledgeY + 0.95, z - 0.03, W / 2, ledgeY + 1.0, z + 0.03, rgb(PAL.wood)); flat.box(x0, ledgeY + 0.5, z - 0.015, W / 2, ledgeY + 0.53, z + 0.015, rgb('#c9ccd0')); for (let x = x0; x <= W / 2 + 1e-6; x += (W / 2 - x0) / 3) flat.box(x - 0.02, ledgeY, z - 0.02, x + 0.02, ledgeY + 0.95, z + 0.02, rgb('#c9ccd0')); c.solid(x0, z - 0.05, W / 2, z + 0.05, { tall: true }); }   // (a rail, open: the way on down is seen through it)
    const dz = (zl0 + zl1) / 2; door('far', dz, ledgeY);
    // the one that can be reached is a way out: through it is somewhere else on this floor. Where, is chosen when the room is built, from
    // the seed: a plain room (not the start, not the exit, not a special room — the lift is one), one a creature of the mascot's size can
    // leave, and in it a few spots, tried in turn when the door is used, the first that is floor and free. Only whoever uses it goes through
    // (in a visit with others, the others stay where they are)
    const lvl = env.level || c.level, outs = lvl ? R.shuffle(lvl.rooms.filter((r) => r.id !== c.room.id && r.kind === 'plain' && !r.crawl && canLeave(r, 1.62)).map((r) => r.id)).slice(0, 4) : [];
    const tries = outs.map((id) => ({ id, at: Array.from({ length: 5 }, () => [R.range(-0.5, 0.5), R.range(-0.5, 0.5)]) }));
    c.use({ x: W / 2 - 0.6, z: dz, r: 1.3, label: 'go through the door', when: () => !!env.player?.warp && tries.length > 0, use: () => {
      const w = env.world, me = c.toWorld(W / 2 - 0.6, dz);
      for (const t of tries) { const r = lvl.rooms[t.id], e = Math.max(0, Math.min(r.W, r.D) - 1.6);
        for (const [u, v] of t.at) { const x = r.cx + u * e, z = r.cz + v * e;
          if (w.free?.(x, z, 0.3) === false || Math.abs(w.floorY(x, z) - (r.y || 0)) > 0.05) continue;
          env.play?.('door', me.x, me.z, 8); env.hud?.glitch?.(0.5); env.interfere?.(0.6); env.player.warp(x, z); env.play?.('door', x, z, 8); return; } }
      env.play?.('knock', me.x, me.z, 8); } });                                                                                       // (nowhere: it is locked, and somebody knocks back)
    c.leave('battery', W / 2 - 0.7, dz - 0.6, { y: ledgeY }); c.leave('snack', W / 2 - 0.7, dz + 0.6, { y: ledgeY }); }
    for (const y of [-2.5, -7.5]) c.light(xS + K.shaft / 2, y, (zs0 + zs1) / 2, '#ffd9a0', 0.5, { k: 1.4, far: 6 });
    // the edge of the hall along the shaft: a balustrade, but where the stair goes over
    // (where the shaft stops short of the front, the stair is got onto from the front, and the side is railed all along; else the side is open by the stair's top)
    const front = zs1 < D / 2 - 0.5, gap0 = front || !hasLanding ? zs1 : z0d - 1.5;
    // (glass, so the shaft can be looked down into over it; a wood rail on posts; a kick of plaster at the foot)
    const pane = c.mapped('stairs:pane', kit.tex.custom('stairs:pane', 16, 32, (g, w, h) => { g.clearRect(0, 0, w, h); P(g, '#c9ccd0', 0, 0, w, 1); }, { clamp: true }), { cutout: true });   // (clear, as the shopfronts' glass is: only its top edge is drawn)
    const bal = (x0, z0, x1, z1) => { const alongZ = z1 - z0 > x1 - x0, mxx = (x0 + x1) / 2, mzz = (z0 + z1) / 2, L = alongZ ? z1 - z0 : x1 - x0;
      flat.box(x0, 0, z0, x1, 0.12, z1, rgb('#c8b8b0')); flat.box(x0 - 0.03, 1.0, z0 - 0.03, x1 + 0.03, 1.06, z1 + 0.03, rgb(PAL.wood));
      for (let k = 0; k <= Math.round(L / 1.2); k++) { const f = k / Math.max(1, Math.round(L / 1.2)), px = alongZ ? mxx : x0 + (x1 - x0) * f, pz = alongZ ? z0 + (z1 - z0) * f : mzz; flat.box(px - 0.025, 0.12, pz - 0.025, px + 0.025, 1.0, pz + 0.025, rgb('#c9ccd0')); }
      if (alongZ) { upright(pane, mxx, z0, mxx, z1, 0.12, 1.0, [0, 0, Math.round(L / 1.2), 1]); upright(pane, mxx, z1, mxx, z0, 0.12, 1.0, [0, 0, Math.round(L / 1.2), 1]); }
      else { upright(pane, x0, mzz, x1, mzz, 0.12, 1.0, [0, 0, Math.round(L / 1.2), 1]); upright(pane, x1, mzz, x0, mzz, 0.12, 1.0, [0, 0, Math.round(L / 1.2), 1]); }
      c.solid(x0 - 0.04, z0 - 0.04, x1 + 0.04, z1 + 0.04, { tall: true }); };
    bal(xS - 0.06, zs0, xS + 0.02, gap0);
    if (front) bal(hasLanding ? dx + K.half + 0.12 : xS, zs1 - 0.02, W / 2, zs1 + 0.04);
    if (zs0 > zT + 0.3) bal(xS, zs0 - 0.04, W / 2, zs0 + 0.02); }

  /* the stair into the shaft: treads, its sides, a rail in tube; it moves down */
  if (hasLanding) { const n = Math.round((z0d - zEnd) / K.tread), w = K.half;
    for (let i = 0; i < n; i++) { const za = z0d - (i + 1) * K.tread, zb = za + K.tread, ya = diveY(za), yb = diveY(zb);
      two(flat, [dx - w, yb, zb], [dx + w, yb, zb], [dx + w, ya, za], [dx - w, ya, za], i % 2 ? TREAD : DARK);
      flat.box(dx - w, Math.min(ya, yb) - 0.35, za, dx + w, Math.min(ya, yb) - 0.05, zb, [0.3, 0.27, 0.3]);
      for (const s of [-1, 1]) { const xs = dx + s * (w + 0.05); two(flat, [xs, yb - 0.3, zb], [xs, ya - 0.3, za], [xs, ya + 0.9, za], [xs, yb + 0.9, zb], SKIRT); two(pink, [xs - 0.03, yb + 0.92, zb], [xs - 0.03, ya + 0.92, za], [xs + 0.03, ya + 0.92, za], [xs + 0.03, yb + 0.92, zb], null); } }
    upright(flat, dx - w - 0.1, z0d + 0.02, dx + w + 0.1, z0d + 0.02, -0.4, 0, null, [0.3, 0.27, 0.3]); }

  /* the belts, and the slots at the ends of them */
  { const black = c.mapped('stairs:void', kit.tex.custom('stairs:void', 4, 4, (g) => P(g, '#000', 0, 0, 4, 4))), k0 = [0, 0, 0];
    for (const s of [-1, 1]) { const xa = s * sIn, xb = s * sOut, lo = Math.min(xa, xb), hi = Math.max(xa, xb), y = -9;
      two(black, [lo, y, zL0], [lo, y, zL1], [lo, 0, zL1], [lo, 0, zL0], k0); two(black, [hi, y, zL0], [hi, y, zL1], [hi, 0, zL1], [hi, 0, zL0], k0); two(black, [lo, y, zL0], [hi, y, zL0], [hi, 0, zL0], [lo, 0, zL0], k0); two(black, [lo, y, zL1], [hi, y, zL1], [hi, 0, zL1], [lo, 0, zL1], k0); }
    // a rail along the outside of each slot: walking across the hall does not put anyone in one; only a belt does
    for (const s of [-1, 1]) { const x = s * (sOut + 0.04); flat.box(x - 0.025, 0, zL0, x + 0.025, 0.95, zL1, rgb('#c9ccd0')); flat.box(x - 0.035, 0.95, zL0 - 0.03, x + 0.035, 1.0, zL1 + 0.03, rgb(PAL.wood)); c.solid(x - 0.06, zL0, x + 0.06, zL1, { tall: true }); }
    for (let i = 0; i < K.belts; i++) { const za = zL0 + i * K.belt, dir = Math.sign(way[i]);
      flat.box(-sIn, -0.06, za + 0.03, sIn, 0.012, za + K.belt - 0.03, [0.2, 0.18, 0.2]); flat.box(-sIn, -0.06, za, sIn, 0.016, za + 0.03, EDGE); flat.box(-sIn, -0.06, za + K.belt - 0.03, sIn, 0.016, za + K.belt, EDGE);
      for (let x = -sIn + 0.5; x < sIn - 0.4; x += 0.9) for (let k = 0; k < 3; k++) flat.box(x + dir * k * 0.09 - 0.03, 0.012, za + 0.2 + k * 0.12, x + dir * k * 0.09 + 0.03, 0.018, za + K.belt - 0.2 - k * 0.12, Math.abs(way[i]) > K.fast ? [0.9, 0.3, 0.2] : [0.8, 0.7, 0.4]); }
    c.light(0, 1.6, zT + 0.8, '#ffe2a8', 0.7, { k: 1.4, far: 4.5 }); c.leave('battery', R.range(-1.2, 1.2), zT + 0.7, { y: 0 }); }

  /* the two flights that go to the floor above: treads, sides, a rail in tube; the covered way over the one that goes up */
  const flight = (x, rail) => {
    const n = Math.round(K.run / K.tread);
    for (let i = 0; i < n; i++) { const za = zT + i * K.tread, y = yOf(za + K.tread / 2) + 0.06; flat.box(x - K.half, 0, za, x + K.half, y, za + K.tread, i % 2 ? TREAD : DARK); flat.box(x - K.half, y - 0.01, za + K.tread - 0.04, x + K.half, y + 0.004, za + K.tread, EDGE); }
    for (const s of [-1, 1]) { const xs = x + s * (K.half + 0.05); two(flat, [xs, -0.05, zB], [xs, G - 0.05, zT], [xs, G + 0.9, zT], [xs, 0.9, zB], SKIRT); two(rail, [xs - 0.03, 0.92, zB], [xs - 0.03, G + 0.92, zT], [xs + 0.03, G + 0.92, zT], [xs + 0.03, 0.92, zB], null); }
  };
  flight(xA, pink); flight(xB, lilac);
  const zc0 = zT + K.cover, zc1 = zB - K.cover, wide = K.half + 0.12, tall = 2.35;
  { const lining = c.mapped('stairs:lining', kit.tex.custom('stairs:lining', 64, 64, (g, w, h) => { P(g, '#5a4650', 0, 0, w, h); for (let x = 0; x < w; x += 32) { P(g, '#7a6470', x + 2, 6, 28, 44); P(g, '#e8a0b8', x + 4, 8, 24, 2); P(g, '#b8a0e8', x + 4, 46, 24, 2); for (let k = 0; k < 4; k++) P(g, '#8a7480', x + 6, 16 + k * 7, 20, 3); } }));
    const rep = (s, t) => [(s * (zc1 - zc0)) / (K.again / 2), t];
    for (const sgn of [-1, 1]) { const xs = xA + sgn * wide; sheet(lining, [xs, yOf(zc1), zc1], [xs, yOf(zc0), zc0], [xs, yOf(zc0) + tall, zc0], [xs, yOf(zc1) + tall, zc1], 8, 1, rep); sheet(lining, [xs, yOf(zc0), zc0], [xs, yOf(zc1), zc1], [xs, yOf(zc1) + tall, zc1], [xs, yOf(zc0) + tall, zc0], 8, 1, rep);
      two(flat, [xs + sgn * 0.04, yOf(zc1), zc1], [xs + sgn * 0.04, yOf(zc0), zc0], [xs + sgn * 0.04, yOf(zc0) + tall, zc0], [xs + sgn * 0.04, yOf(zc1) + tall, zc1], rgb('#a08890')); }
    two(flat, [xA - wide, yOf(zc1) + tall, zc1], [xA - wide, yOf(zc0) + tall, zc0], [xA + wide, yOf(zc0) + tall, zc0], [xA + wide, yOf(zc1) + tall, zc1], rgb('#8a7078'));
    const strip = c.mapped('stairs:strip', kit.tex.custom('stairs:strip', 32, 32, (g, w, h) => { P(g, '#3a2a32', 0, 0, w, h); for (let x = 0; x < w; x += 4) P(g, '#4a3a42', x, 0, 3, h); }));
    for (const z of [zc0, zc1]) { upright(strip, xA - wide, z, xA + wide, z, yOf(z), yOf(z) + tall, [0, 0, 3, 1]); upright(strip, xA + wide, z, xA - wide, z, yOf(z), yOf(z) + tall, [0, 0, 3, 1]); }
    c.light(xA, yOf((zc0 + zc1) / 2) + 1.9, (zc0 + zc1) / 2, '#ff9ac0', 0.5, { k: 1.6, far: 3.2 }); }
  /* the floor above: a rail, open where the two come up */
  for (const [xa, xb] of [[-W / 2, xA - K.half - 0.1], [xA + K.half + 0.1, xB - K.half - 0.1], [xB + K.half + 0.1, W / 2]]) { for (const y of [1.0, 0.5]) flat.box(xa, G + y - 0.03, zT + 0.08, xb, G + y + 0.03, zT + 0.14, rgb(PAL.wood)); for (let x = xa + 0.2; x < xb; x += 1.2) flat.box(x - 0.03, G, zT + 0.08, x + 0.03, G + 1.0, zT + 0.14, rgb(PAL.wood)); c.solid(xa, zT + 0.04, xb, zT + 0.18, { tall: true }); }
  c.leave('snack', R.pick([-1, 1]) * (W / 2 - 1.4), -D / 2 + 1.4, { y: G });

  /* the hall's own floor, by the left wall: benches to wait on, a shop window with the office behind it, a column of frames in frames */
  { // benches, in a row along the left, facing in
    for (let k = 0; k < 2; k++) { const x = -W / 2 + 1.2, z = zB + 0.8 + k * 2.3; if (z > D / 2 - 1.0 || !c.clear(x, z, 0.55)) continue; c.model('stairs:bench', benchVox, x, z, { rot: Math.PI / 2, solid: false }); c.solid(x - 0.35, z - 0.95, x + 0.35, z + 0.95, { tall: false }); c.reserve(x, z, 1.0); }
    // a shop window: a bay out from the left wall, glass to the front, dummies and a rail inside, and behind them a desk, a set, a partition
    const bz = (zL0 + zL1) / 2, bw = 1.6, bd = 1.3, x0 = -W / 2, x1 = x0 + bd, fr = rgb('#c4a0a8');
    if ([bz - bw, bz, bz + bw].every((z) => c.clear(x1 + 0.3, z, 0.3))) {
      flat.box(x0, 0, bz - bw - 0.12, x1 + 0.12, 2.8, bz - bw, fr); flat.box(x0, 0, bz + bw, x1 + 0.12, 2.8, bz + bw + 0.12, fr); flat.box(x0, 2.5, bz - bw, x1 + 0.12, 2.8, bz + bw, fr); flat.box(x0, 0, bz - bw, x1 + 0.12, 0.35, bz + bw, fr);
      for (let k = 0; k < 5; k++) det.box(x1 + 0.12, 2.52 + k * 0.05, bz - bw - 0.12, x1 + 0.13, 2.54 + k * 0.05, bz + bw + 0.12, rgb(PAL.pink));
      const glass = c.shining('stairs:glass', kit.tex.custom('stairs:glass', 8, 32, (g, w, h) => { g.clearRect(0, 0, w, h); P(g, 'rgba(230,220,240,0.12)', 0, 0, w, h); P(g, 'rgba(255,255,255,0.35)', 2, 4, 1, 10); }, { clamp: true }), 0.5, [0.9, 0.9, 1], { cutout: true });
      upright(glass, x1 + 0.06, bz + bw, x1 + 0.06, bz - bw, 0.35, 2.5, [0, 0, 3, 1]);
      c.mapped('stairs:bay:floor', kit.tex.white()).box(x0, 0.35, bz - bw, x1, 0.37, bz + bw, rgb('#d8ccb8'));
      c.model('stairs:dummy:0', dummyVox(1, PAL.cloth[0]), x0 + 0.85, bz - 0.7, { y: 0.37, rot: Math.PI / 2, solid: false }); c.model('stairs:dummy:1', dummyVox(2, PAL.cloth[2]), x0 + 0.8, bz + 0.15, { y: 0.37, rot: Math.PI / 2 - 0.3, solid: false });
      det.box(x0 + 0.5, 1.75, bz + 0.6, x0 + 0.53, 1.78, bz + 1.45, [0.78, 0.78, 0.8]); for (let k = 0; k < 6; k++) c.model('stairs:jacket:' + (k % 3), jacketVox(PAL.cloth[(k * 2) % PAL.cloth.length]), x0 + 0.5, bz + 0.68 + k * 0.13, { y: 0.95, rot: Math.PI / 2, solid: false, shadow: false });
      det.box(x0 + 0.02, 0.37, bz - 1.5, x0 + 0.3, 1.6, bz - 0.95, rgb('#6c7684')); det.box(x0 + 0.05, 1.0, bz - 1.45, x0 + 0.45, 1.03, bz - 1.0, rgb('#b0a28c')); det.box(x0 + 0.1, 1.03, bz - 1.35, x0 + 0.38, 1.3, bz - 1.1, rgb('#d6ceb8')); det.box(x0 + 0.38, 1.07, bz - 1.32, x0 + 0.385, 1.26, bz - 1.13, rgb('#3a4a44'));
      c.solid(x0, bz - bw - 0.12, x1 + 0.12, bz + bw + 0.12, { tall: true }); c.light(x0 + 0.7, 2.2, bz, '#ffe9c2', 0.5, { k: 1.6, far: 3 }); }
    // the column: square, plastered pink; on each face a frame in a frame in a frame, going in
    const px = -W / 2 + 3.4, pz = D / 2 - 2.6, r = 0.75;
    if (c.clear(px, pz, r + 0.3)) {
      flat.box(px - r, 0, pz - r, px + r, H, pz + r, rgb('#b48a94')); flat.box(px - r - 0.06, 0, pz - r - 0.06, px + r + 0.06, 0.18, pz + r + 0.06, rgb('#8a6470'));
      const cols = [rgb('#d8c4b4'), rgb('#9aa890'), rgb('#c48a9a'), rgb('#e0d0c0')];
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 0; k < 7; k++) { const h0 = 0.8 + k * 0.1, h1 = 2.6 - k * 0.1, half = 0.62 - k * 0.08, d = 0.02 + k * 0.012, col = cols[k % 4];
        if (half < 0.08) break;
        const ax = nx ? px + nx * (r + d) : px - half, bx = nx ? px + nx * (r + d - 0.02) : px + half, az = nz ? pz + nz * (r + d) : pz - half, bz2 = nz ? pz + nz * (r + d - 0.02) : pz + half;
        det.box(Math.min(ax, bx), h0, Math.min(az, bz2), Math.max(ax, bx), h1, Math.max(az, bz2), col); }
      c.solid(px - r - 0.06, pz - r - 0.06, px + r + 0.06, pz + r + 0.06, { tall: true }); c.reserve(px, pz, 1.1); } }

  /* the ones that go everywhere, as a ride does: a band of treads along a line through the hall, a rail either side, kept level the way a
     carriage is (each length turned from the last only as much as the line turns), and twisted where it says */
  const band = (at, n, rail, o = {}) => {
    const w = o.w ?? 0.55, twist = o.twist || (() => 0), e = 1e-3, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const tan = (t) => norm(sub(at(Math.min(1, t + e)), at(Math.max(0, t - e))));
    let T = tan(0), U = norm(sub(o.up || [0, 1, 0], T.map((v) => v * dot(o.up || [0, 1, 0], T))));
    if (Math.hypot(...U) < 0.5) U = [1, 0, 0];
    const frames = [];
    for (let i = 0; i <= n; i++) { const t = i / n; T = tan(t); U = norm(sub(U, T.map((v) => v * dot(U, T)))); const S = cross(T, U), a = twist(t), cs = Math.cos(a), sn = Math.sin(a);
      frames.push({ q: at(t), S: [S[0] * cs + U[0] * sn, S[1] * cs + U[1] * sn, S[2] * cs + U[2] * sn], U: [U[0] * cs - S[0] * sn, U[1] * cs - S[1] * sn, U[2] * cs - S[2] * sn] }); }
    const pt = (f, s, u) => [f.q[0] + f.S[0] * s + f.U[0] * u, f.q[1] + f.S[1] * s + f.U[1] * u, f.q[2] + f.S[2] * s + f.U[2] * u];
    for (let i = 1; i <= n; i++) { const f0 = frames[i - 1], f1 = frames[i];
      two(flat, pt(f0, -w, 0), pt(f1, -w, 0), pt(f1, w, 0), pt(f0, w, 0), i % 2 ? TREAD : DARK);
      two(flat, pt(f0, -w, -0.22), pt(f1, -w, -0.22), pt(f1, w, -0.22), pt(f0, w, -0.22), rgb('#7e6870'));
      for (const s of [-1, 1]) { two(flat, pt(f0, s * w, -0.22), pt(f1, s * w, -0.22), pt(f1, s * w, 0.34), pt(f0, s * w, 0.34), SKIRT); two(rail, pt(f0, s * w - 0.03, 0.36), pt(f1, s * w - 0.03, 0.36), pt(f1, s * w + 0.03, 0.36), pt(f0, s * w + 0.03, 0.36), null); } }   // (low sides, as a ride's: the line reads, not the trough)
  };
  const T2 = Math.PI * 2, top = H - 0.5, mx = (-W / 2 + xS) / 2;
  // a loop, over the middle of the hall, the way a ride loops: in along the hall, up and over, out the other way, a little to the side
  { const lz = (zL1 + D / 2) / 2 + 0.6, ly = 2.7, r = 2.3, xl = -1.0;
    band((t) => { const a = t * T2; if (t < 0.12) return [xl - 0.4 * (t / 0.12), ly, lz - 4.2 + (t / 0.12) * 4.2 - 0.0]; const u = (t - 0.12) / 0.76; if (t <= 0.88) { const aa = u * T2; return [xl - 0.4 - u * 0.8, ly + r - Math.cos(aa) * r, lz + Math.sin(aa) * r]; } const v = (t - 0.88) / 0.12; return [xl - 1.2 - v * 0.4, ly, lz + v * 4.2]; void a; }, 110, pink, { w: 0.5 }); }
  // a corkscrew, along the length of the hall up high, the band turning over and over as it goes
  band((t) => [mx + Math.cos(t * T2 * 2.5) * 0.9, top - 1.6 + Math.sin(t * T2 * 2.5) * 0.9, D / 2 - 1.2 - t * (D - 2.4)], 140, lilac, { w: 0.45 });
  // a helix, banked, round a column of nothing in the shaft, from the roof down to where the lamps stop
  band((t) => [xS + K.shaft / 2 + Math.cos(t * T2 * 3) * 0.95, top - 0.3 - t * (top + 9), zs0 + 2.0 + Math.sin(t * T2 * 3) * 0.95], 160, warm, { w: 0.4, twist: () => -0.5 });
  // out of a hood in the roof at the front, a drop over the edge of the shaft and down into it
  { const hx = xS - 1.6, hz = Math.min(D / 2 - 1.6, zs1 - 0.4); flat.box(hx - 1.1, H - 1.3, hz - 1.0, xS + 0.6, H, hz + 1.0, rgb('#b48a94')); det.box(hx - 1.12, H - 1.32, hz - 1.02, xS + 0.62, H - 1.28, hz + 1.02, rgb('#8a6470'));
    band((t) => [hx + t * 3.4 * Math.min(1, t * 3), H - 1.35 - (t < 0.25 ? t * 0.6 : 0.15 + (t - 0.25) ** 1.6 * 14), hz - t * 6.5], 80, pink, { w: 0.5 }); }
  // on its side, up the left wall and over onto the roof
  band((t) => [-W / 2 + 0.75, 3.0 + t * (top - 3.0), zT + 1.0 + t * 6], 40, lilac, { twist: () => -Math.PI / 2 });
  // two, plaited, rising into the roof by the floor above
  for (const k of [0, 1]) band((t) => [xA - 2.4 + Math.cos(t * T2 * 1.5 + k * Math.PI) * 0.8, G + 1.2 + t * (top - G - 1.0), zT + 0.6 + t * 4 + Math.sin(t * T2 * 1.5 + k * Math.PI) * 0.8], 60, k ? pink : warm, { w: 0.38 });
  for (const [x, y, z, col] of [[0, 5.2, (zL1 + D / 2) / 2, '#ff9ac0'], [mx, top - 1.6, 0, '#c8a8ff'], [xB, 2.4, zB + 1, '#c8a8ff'], [xA, 2.4, zB + 1, '#ff9ac0'], [0, G + 2, -D / 2 + 1.4, '#ffe2c0']]) c.light(x, y, z, col, 0.75, { k: 1.3, far: 7 });

  /* overhead: the roof's own lights, as geometry; what it says, in tube */
  { const tube = c.shining('stairs:panels', kit.tex.white(), 1.1, [0.95, 0.88, 1]);
    for (let x = -W / 2 + 1.8; x < xS - 0.8; x += 3.2) for (let z = zT + 1.5; z < D / 2 - 0.8; z += 3.2) { det.box(x - 0.62, H - 0.03, z - 0.32, x + 0.62, H - 0.005, z + 0.32, rgb('#c8b8c4')); tube.box(x - 0.56, H - 0.035, z - 0.26, x + 0.56, H - 0.03, z + 0.26, [1, 1, 1]); }
    for (let z = zs0 + 1.2; z < zs1 - 0.6; z += 2.2) { det.box(xS + 1.0, H - 0.03, z - 0.3, W / 2 - 0.4, H - 0.005, z + 0.3, rgb('#c8b8c4')); tube.box(xS + 1.06, H - 0.035, z - 0.24, W / 2 - 0.46, H - 0.03, z + 0.24, [1, 1, 1]); } }
  const neon = mallNeon(kit, 'stairs:' + p.seed, ['UP', 'ALSO UP', 'TO ALL FLOORS', 'STAND STILL', 'KEEP WALKING', 'DOWN IS UP', 'THIS WAY UP', 'DOWN'], p.seed), lit = c.shining('mall:neon:stairs:' + p.seed, neon.texture, 2.2, undefined, { bloom: 2 });
  for (const [x, i] of [[xA, 3], [xB, 5]]) { upright(lit, x + 1.0, zB + 0.35, x - 1.0, zB + 0.35, 2.3, 2.8, neon.uv(i)); upright(lit, x - 1.0, zB + 0.35, x + 1.0, zB + 0.35, 2.3, 2.8, neon.uv((i + 1) % 8)); for (const s of [-1, 1]) flat.box(x + s - 0.02, 2.8, zB + 0.33, x + s + 0.02, H, zB + 0.37, [0.2, 0.18, 0.2]); }
  upright(lit, dx + 0.9, zs1 + 0.02, dx - 0.9, zs1 + 0.02, 2.3, 2.75, neon.uv(7)); upright(lit, dx - 0.9, zs1 + 0.01, dx + 0.9, zs1 + 0.01, 2.3, 2.75, neon.uv(7));

  /* they move: whoever is on one is carried. On the way up, under cover, whoever walks is given the same stretch again. On the way down into
     the shaft, whoever stands is taken down, past the landing, to the end of it */
  c.tick((dt, t, me) => {
    if (!me.inside || env.player?.me?.frozen) return;
    const li = Math.abs(me.x) < sIn + 0.3 ? lane(me.z) : -1;
    if (li >= 0) { const q = c.toWorld(me.x + way[li] * dt, me.z); env.player?.warp?.(q.x, q.z); return; }
    if (inShaft(me.x, me.z) || (Math.abs(me.x - dx) < K.half && me.z > z0d - 0.2 && me.z < z0d + 0.3)) {
      if (onLanding(me.x, me.z) || !onDive(me.x, me.z)) return;
      const z = Math.max(zEnd - 0.4, me.z - K.speed * dt), q = c.toWorld(me.x, z); env.player?.warp?.(q.x, q.z); return; }
    const a = onA(me.x, me.z), b = !a && onB(me.x, me.z); if (!a && !b) return;
    let z = me.z + (a ? -1 : 1) * K.speed * dt;
    if (a && me.moving && me.z > zc0 && me.z < zc0 + K.near) { z += K.again; env.interfere?.(0.55); env.hud?.glitch?.(0.12); }
    z = Math.max(zT - 0.3, Math.min(zB + 0.3, z));
    const q = c.toWorld(me.x, z); env.player?.warp?.(q.x, q.z);
  });
}
