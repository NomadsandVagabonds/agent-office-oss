// The Backrooms — Workshop Room: Exit Interview (inspired by Backrooms Fake Exits / Retention Loops).
// Looks heart-stoppingly identical to the real Way Out — warm spill light under a frosted wooden door
// and a glowing green sign above — except the sign reads "EXIT INTERVIEW" (or "EXIT (TRIAL)").
// Opening it reveals a cramped HR Retention Booth with a consolation Almond Water carton; rushing
// blindly inside triggers a VHS shutter glitch and warps you back into a deeper room of the maze.
import * as THREE from 'three';
import { Batch, lin, ticks, smooth, WHITE } from '../../kit.js';
import { toWorld } from '../../gen.js';
import { P, framed, card } from '../../bits.js';
import { placeAlmondWater } from '../items/almond-water.js';

export function exitInterview(c) {
  const { W, D, H, R, params: p, kit } = c;

  // Keep both coin-stash corners near +z completely clear
  for (const s of [-1, 1]) c.reserve(s * (W / 2 - 0.95), D / 2 - 1.05, 0.5);

  c.shell({ sockets: false });

  // Full-height wallpapered partition across zPart (-D/2 + 1.65 <= -2.35, well behind z = 0 side ports!)
  const zPart = -D / 2 + 1.65;
  const dw = 0.96, dh = 2.02, wallThick = 0.12;
  const trim = lin(c.look.trim), cream = lin('#e2d8bd'), wood = lin(p.wood), warm = lin('#ffd9a0');

  const partWall = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02) return;
    const rows = ticks(y1 - y0, 0.45, 0.14);
    const cols = ticks(x1 - x0);
    // Hallway-facing side (+z)
    c.wall.grid(
      [x0, y0, zPart + wallThick / 2], [1, 0, 0], [0, 1, 0], cols, rows,
      (u, v) => [(x0 + u) / 0.8, (y0 + v) / 0.8], WHITE,
      (u, v) => 0.84 + 0.16 * smooth(Math.min(y0 > 0.01 ? 9 : v, H - (y0 + v)) / 0.4),
    );
    // Booth-facing side (-z)
    c.wall.grid(
      [x1, y0, zPart - wallThick / 2], [-1, 0, 0], [0, 1, 0], cols, rows,
      (u, v) => [(x0 + u) / 0.8, (y0 + v) / 0.8], WHITE,
      () => 0.82,
    );
    if (y0 < 0.01) {
      c.flat.box(x0, 0, zPart - wallThick / 2 - 0.02, x1, 0.11, zPart + wallThick / 2 + 0.02, trim, { skip: '-y' });
    }
  };

  partWall(-W / 2, -dw / 2, 0, H);
  partWall(dw / 2, W / 2, 0, H);
  partWall(-dw / 2, dw / 2, dh, H);

  // Solid partition wings (keep: true so they are real walls); doorway collider turns off once door opens
  c.solid(-W / 2, zPart - wallThick / 2, -dw / 2, zPart + wallThick / 2, { tall: true, keep: true });
  c.solid(dw / 2, zPart - wallThick / 2, W / 2, zPart + wallThick / 2, { tall: true, keep: true });
  const doorCol = c.solid(-dw / 2, zPart - 0.06, dw / 2, zPart + 0.06, { tall: true });

  // Cream timber frame around the decoy exit doorway (both faces + jambs)
  const ft = 0.07;
  c.flat.box(-dw / 2 - ft, 0, zPart - wallThick / 2 - 0.03, -dw / 2, dh + ft, zPart + wallThick / 2 + 0.03, cream, { skip: '-y' });
  c.flat.box(dw / 2, 0, zPart - wallThick / 2 - 0.03, dw / 2 + ft, dh + ft, zPart + wallThick / 2 + 0.03, cream, { skip: '-y' });
  c.flat.box(-dw / 2, dh, zPart - wallThick / 2 - 0.03, dw / 2, dh + ft, zPart + wallThick / 2 + 0.03, cream);

  // Swinging wooden door leaf with glowing frosted glass pane & warm crack spill underneath (identical bait to `exit`!)
  const leaf = new Batch();
  const zFace = zPart + wallThick / 2;
  // Build leaf boxes directly on zFace so it matches Fable's `exit` door silhouette
  leaf.box(-0.47, 0.02, zFace - 0.02, 0.47, 2.0, zFace + 0.025, wood);
  const darkWood = wood.map((v) => v * 0.72);
  for (const px of [-0.21, 0.21]) {
    leaf.box(px - 0.15, 0.18, zFace + 0.025, px + 0.15, 0.86, zFace + 0.032, darkWood);
  }
  // Brass handle on the right
  leaf.box(0.34, 0.92, zFace + 0.025, 0.40, 0.97, zFace + 0.075, [0.76, 0.72, 0.58]);
  leaf.box(0.24, 0.93, zFace + 0.06, 0.40, 0.96, zFace + 0.078, [0.80, 0.76, 0.62]);
  // Booth-side push bar
  leaf.box(-0.34, 0.93, zFace - 0.055, 0.34, 0.97, zFace - 0.02, [0.72, 0.74, 0.76]);

  const door = c.dynamic(leaf, { pivot: [-0.47, 0, zFace] });

  const pane = new Batch();
  pane.quad([-0.22, 1.16, zFace + 0.028], [0.22, 1.16, zFace + 0.028], [0.22, 1.78, zFace + 0.028], [-0.22, 1.78, zFace + 0.028]);
  pane.quad([0.22, 1.16, zFace - 0.023], [-0.22, 1.16, zFace - 0.023], [-0.22, 1.78, zFace - 0.023], [0.22, 1.78, zFace - 0.023]);
  pane.quad([-0.47, 0, zFace + 0.022], [0.47, 0, zFace + 0.022], [0.47, 0.022, zFace + 0.022], [-0.47, 0.022, zFace + 0.022]);
  c.after.push(() => {
    const m = new THREE.Mesh(kit.plain(pane), kit.glowing(kit.tex.white(), 1.75, warm));
    m.position.set(0.47, 0, -zFace);
    door.add(m);
  });

  // Warm inviting glow spilling under the decoy door + welcome doormat
  c.light(0, 0.14, zFace + 0.28, warm, 0.95, { k: 0.5, far: 5.0, wrap: 0.6 });
  c.light(0, 1.45, zFace + 0.32, warm, 0.32, { k: 0.85, far: 4.0 });
  c.prop('doormat', 0, zFace + 0.62, { solid: false, shadow: false, fallback: [0.9, 0.02, 0.5] });

  // Lit green EXIT sign mounted above the partition frame — look closely and it reads "EXIT INTERVIEW"!
  const signTex = kit.tex.custom('exit:' + p.sign, 96, 24, (g, tw, th) => {
    P(g, '#0d3a22', 0, 0, tw, th);
    P(g, '#1f8a4e', 1, 1, tw - 2, th - 2);
    g.fillStyle = '#eafff0';
    g.font = `700 ${p.sign.length > 11 ? 9 : p.sign.length > 7 ? 11 : 14}px ui-monospace, Menlo, Consolas, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(p.sign, tw / 2, th / 2 + 1);
  }, { clamp: true });
  const sy = Math.min(H - 0.22, dh + 0.28), sw = 0.88, sh = sw * 24 / 96;
  c.board(c.shining('fakeexit' + p.sign, signTex, 1.9), 0, sy, zFace + 0.032, sw, sh, 0);
  c.flat.box(-sw / 2 - 0.02, sy - sh / 2 - 0.02, zFace, sw / 2 + 0.02, sy + sh / 2 + 0.02, zFace + 0.028, [0.1, 0.12, 0.1]);
  c.light(0, sy, zFace + 0.22, '#58e08c', 0.3, { k: 0.9, far: 4.0 });

  // Waiting-area chair + side table with subtle HR survey clipboard beside the door
  const waitX = p.chairSide * (W / 2 - 1.15), waitZ = zFace + 1.05;
  if (c.clear(waitX, waitZ, 0.65, 1.5)) {
    c.reserve(waitX, waitZ, 0.72);
    c.prop('chair', waitX, waitZ, { rot: Math.atan2(-waitX, 0.4), o: { color: '#5a5a66' } });
    const tx = waitX - p.chairSide * 0.62, tz = waitZ - 0.18;
    if (c.clear(tx, tz, 0.36, 1.2)) {
      c.reserve(tx, tz, 0.4);
      const tbl = c.prop('sidetable', tx, tz, { fallback: [0.44, 0.54, 0.44] });
      const clipTex = card(c, `exit:clip:${c.room.id}`, ['EXIT SURVEY', p.clip], {
        w: 96,
        h: 120,
        bg: '#f5f0e0',
        fg: '#201c16',
        edge: '#7c5632',
        size: 10,
        pad: 8,
      });
      c.lay(c.mapped('exitclip', clipTex), tx, tz, 0.22, 0.28, 0.25 * p.chairSide, null, WHITE, tbl.top + 0.006);
    }
  }

  // Inside the hidden HR Retention Booth (`z` between -D/2 and zPart): stark warm bulb, plaque & consolation Almond Water!
  const zBoothMid = (-D / 2 + zPart) / 2;
  c.light(0, 1.85, zBoothMid, '#ffd9a0', 0.85, { k: 1.4, far: 4.5 });
  const plaqueTex = card(c, `exit:plaque:${c.room.id}`, p.plaque, {
    w: 192,
    h: 64,
    bg: '#231f1b',
    fg: '#eadfbd',
    edge: '#c9a24a',
    size: 13,
    pad: 12,
  });
  framed(c, c.mapped('exitplaque', plaqueTex), 'back', 0, 1.52, 1.32, 0.44, null, [0.58, 0.46, 0.22]);

  // Stool + complimentary Almond Water tucked on the right side of the booth (reachable from doorway without crossing deep!)
  const stoolFoot = c.prop('stool', 0.56, -D / 2 + 0.52, { fallback: [0.36, 0.52, 0.36] });
  placeAlmondWater(c, 0.56, stoolFoot.top, -D / 2 + 0.52, { rot: -0.35, r: 1.75 });

  // Find a safe destination spot in a deeper plain room for the first-time Retention Warp
  function pickWarpDestination() {
    const candidates = c.world.rooms.filter(
      (r) => r.def.kind === 'plain' && !r.def.crawl && r.id !== c.room.id,
    );
    if (!candidates.length) return null;
    candidates.sort((a, b) => (b.def.toExit ?? 0) - (a.def.toExit ?? 0));
    const pool = candidates.slice(0, Math.min(4, candidates.length));
    const targetRt = pool[c.room.id % pool.length];
    const walk = c.world.walkable(targetRt);

    // Search outward from room center for a verified walkable spot
    for (const [lx, lz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
      if (walk.free(lx, lz)) {
        const w = toWorld(targetRt.def, lx, lz);
        return {
          rt: targetRt,
          x: w.x,
          z: w.z,
          yaw: R.range(-Math.PI, Math.PI),
        };
      }
    }
    // Fallback: 0.6 m inside targetRt's first doorway
    const dr = targetRt.def.doors[0];
    if (!dr) return null;
    const dw = c.world.doorway(targetRt.id, dr.to);
    if (!dw) return null;
    return { rt: targetRt, x: dw.x, z: dw.z, yaw: 0 };
  }

  let opening = 0, warpedYet = false;
  c.use({
    x: 0,
    z: zFace + 0.25,
    r: 1.7,
    label: 'open the door',
    when: () => !opening,
    use: () => {
      opening = 0.0001;
      const w = c.toWorld(0, zFace);
      c.env.play('door', w.x, w.z, 6);
    },
  });

  // Stepping across the threshold into the HR booth triggers a one-time Retention Relocation!
  c.zone({
    x0: -0.55,
    z0: -D / 2 + 0.05,
    x1: 0.32,
    z1: zPart - 0.32,
    enter: () => {
      if (!p.warp || warpedYet || opening < 0.4) return;
      const dest = pickWarpDestination();
      if (!dest) return;
      warpedYet = true;
      c.env.sound.play('shutter');
      c.env.interfere(1);
      c.env.hud?.glitch?.(1.0);
      c.env.player.warp(dest.x, dest.z, dest.yaw);
      c.world.enter(dest.rt);
    },
  });

  c.tick((dt) => {
    if (!opening || opening >= 1) return;
    opening = Math.min(1, opening + dt / 0.85);
    const e = opening * opening * (3 - 2 * opening);
    // Swing inward (+Y rotation around left hinge swings into -z booth, away from player)
    door.rotation.y = 1.52 * e;
    if (opening > 0.38 && doorCol.on) doorCol.on = false;
  });
}
