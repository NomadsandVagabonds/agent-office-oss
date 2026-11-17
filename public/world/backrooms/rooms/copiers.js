// The Backrooms — the Copy Room ("the photocopiers") (after Gemini's Wave 2, brought onto the room contract:
// its line in the deck is in deck2.js, and this file is the whole of it).
// A dim reprographics hall whose copiers scan the empty air as you walk past. One of them has printed the way on.
import * as THREE from 'three';
import { COPIER, copierVox, lidVox } from './copiers/model.js';
import { Batch, lin, drawText, smooth, WHITE } from '../kit.js';
import { roomDistances } from '../gen.js';
import { P, clamp, card, framed, scatter } from '../bits.js';

/** Photocopiers with their lids propped open; pass one and its green lamp scans the dark and spits out a page. */
export function build(c) {
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
      const variant = idx % COPIER.variants;                 // (the machine and its lid are sculpted: copiers/model.js)
      c.model('copier:' + variant, () => copierVox(variant), cx, cz, { rot, tall: false, scale: COPIER.scale });

      // hinged document-feeder lid propped open toward the ceiling so the green scan bar glares into the room
      const lidAngle = p.lids[idx % p.lids.length], hingeX = cx - faceDir * 0.28, lidW = 0.52, lidZ = 0.72;
      c.model('copier-lid', lidVox, hingeX, cz, { rot, y: 0.8875, tilt: [0, lidAngle], scale: COPIER.scale, solid: false, shadow: false });
      // one green lamp to a pair, on alternate sides, and never past what a room may light (16)
      if ((row + s) % 2 === 0 && c.rt.lights.length < 16) c.light(cx + faceDir * 0.1, 0.96, cz, '#54ff98', 0.22, { k: 0.85, far: 3.4 });

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
