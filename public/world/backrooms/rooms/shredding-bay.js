// The Shredding Bay ("the lady with the shredder"): a records-retention room
// lined with boxed archives and overflowing confetti bins. An elderly clerk in
// spectacles whistles cheerfully as she wheels an industrial cross-cut shredder
// after you. Hand her loose memos (or a consultant's pink slip) and she feeds
// them into the rollers and trundles happily back to her corner; let her catch
// you empty-handed and into the rollers you go.
import { Vox, M } from '../../vox/vox.js';
import { lin, WHITE } from '../kit.js';
import { clamp, turnTo, card, framed, scatter } from '../bits.js';
import { placePickup, isPaper } from '../hand.js';
import { stepWalker, routeToward } from '../denizens.js';
import { SHREDDER, createShredderState, stepShredder, releaseShredder } from './shredding-bay/rule.js';
import { makeRetentionClerk } from './shredding-bay/rig.js';

function shredBinVox() {
  const v = new Vox();
  const bin = M('#2d5478', 1), rim = M('#203d59', 1), p1 = M('#efe9d8', 1), p2 = M('#f3b3c0', 1);
  v.rbox(-6, 0, -5, 6, 15, 5, 1, bin, 'xz');
  v.box(-7, 14, -6, 7, 16, 6, rim);
  v.carve(-5, 11, -4, 5, 17, 4);
  for (let x = -5; x <= 4; x++) for (let z = -4; z <= 3; z++) {
    const h = 12 + ((x * 7 + z * 11) & 3);
    v.box(x, 10, z, x + 1, h, z + 1, (x + z) & 1 ? p1 : p2);
  }
  return v;
}

export function build(c) {
  const { W, D, R, params: p } = c;
  c.shell();

  // Keep back corners clear where tapes may hide
  c.reserve(-W / 2 + 1.0, -D / 2 + 1.0, 0.65);
  c.reserve(W / 2 - 1.0, -D / 2 + 1.0, 0.65);

  // Archive shelving along left and right flanks where doorways allow
  for (const sx of [-1, 1]) {
    for (let z = -D / 2 + 2.2; z <= D / 2 - 2.2; z += 2.2) {
      const x = sx * (W / 2 - 0.55);
      if (!c.clear(x, z, 0.55)) continue;
      c.prop(c.hasProp('shelving') ? 'shelving' : 'filing', x, z, {
        rot: sx < 0 ? Math.PI / 2 : -Math.PI / 2,
        fallback: [0.5, 1.75, 1.1],
      });
    }
  }

  // Overflow shred bins and confetti drifts
  for (let i = 0; i < 3; i++) {
    const sp = c.spot(0.45);
    if (!sp) continue;
    c.model('shred:bin', shredBinVox, sp.x, sp.z, { rot: R.range(0, 6.28) });
    scatter(c, sp.x, sp.z, 5, 0.75, i === 1 ? '#f3b3c0' : undefined);
  }

  // Sorting table near the front side with a fresh sheaf of loose papers
  let placedPapers = false;
  for (const sx of [p.deskSide, -p.deskSide]) {
    const tx = sx * (W / 2 - 1.35), tz = clamp(D / 2 - 1.95, -0.8, D / 2 - 1.45);
    if (!c.clear(tx, tz, 0.62)) continue;
    const desk = c.prop(c.hasProp('desk') ? 'desk' : 'cafetable', tx, tz, {
      rot: sx > 0 ? -Math.PI / 2 : Math.PI / 2,
      fallback: [0.75, 0.74, 1.2],
    });
    placePickup(c, 'papers', tx, tz, desk.top, { label: 'take unfiled memos' });
    c.reserve(tx, tz, 0.72);
    placedPapers = true;
    break;
  }
  if (!placedPapers) {
    const sp = c.spot(0.5);
    if (sp) placePickup(c, 'papers', sp.x, sp.z, 0, { label: 'take unfiled memos' });
  }

  // Framed retention policy sign
  const signSpot = c.wallSpot(1.5, ['back', 'left', 'right']);
  if (signSpot) {
    const tex = card(c, 'shredsign:' + p.code, [
      'RECORDS RETENTION',
      `SCHEDULE ${p.code}`,
      'SURRENDER ALL LOOSE PAPER',
    ], { w: 176, h: 72, bg: '#f2ecda', fg: '#1e2026', edge: '#2d5478', size: 11, pad: 10 });
    framed(c, c.mapped('shredsign', tex), signSpot.side, signSpot.at, 1.5, 1.15, 0.48);
  }

  // Starting nook for The Retention Clerk toward the rear centre
  const startLx = clamp(p.clerkX, -W / 2 + 1.6, W / 2 - 1.6);
  const startLz = clamp(-D / 2 + 1.85, -D / 2 + 1.3, 0);
  const homeW = c.toWorld(startLx, startLz);

  const rig = makeRetentionClerk(c.kit);
  let rule = createShredderState();
  let offeredPaper = false, known = false;
  let hostRt = c.rt;

  const feedUse = c.use({
    x: startLx, z: startLz, r: 2.15, cone: 0.3,
    label: 'feed paper to shredder',
    when: () => rule.phase === 'following' && !!c.env.hand?.hasPaper(),
    use: () => {
      if (c.env.hand?.hasPaper()) offeredPaper = true;          // (the sheet is taken when she takes it, below: one, not two)
    },
  });

  const syncUseRoom = (wx, wz, yaw) => {
    feedUse.wx = wx + Math.sin(yaw) * 0.55;
    feedUse.wz = wz + Math.cos(yaw) * 0.55;
    const nowRt = c.world.roomAt(wx, wz);
    if (nowRt && nowRt !== hostRt) {
      const idx = hostRt.uses.indexOf(feedUse);
      if (idx >= 0) hostRt.uses.splice(idx, 1);
      nowRt.uses.push(feedUse);
      hostRt = nowRt;
    }
  };

  const roamer = c.env.denizens?.add({
    id: 'retention-clerk',
    x: homeW.x, z: homeW.z, r: 0.34, tall: 1.45, heading: 0,
    group: rig.group,
    light: (rgb) => rig.light(rgb),
    snipTarget: () => ((rule.phase === 'following' || rule.phase === 'pulling') ? { id: 'retention-clerk', r: 0.36, priority: 2 } : false),
    snip() {
      if (rule.phase !== 'following' && rule.phase !== 'pulling') return false;
      if (!known) { known = true; c.met('retention-clerk'); }
      rule = releaseShredder(rule);
      if (c.env.player?.me) c.env.player.me.pitch = 0;
      c.env.play('clack', roamer.x, roamer.z, 8);
      c.survived('retention-clerk');
      return { ok: true, target: 'retention-clerk' };
    },
    update(dt, time, me) {
      const inRoom = c.world.current() === c.rt;
      const dist = Math.hypot(me.x - roamer.x, me.z - roamer.z);
      const clearLine = c.world.los(roamer.x, roamer.z, me.x, me.z);
      const holdingPaper = !!c.env.hand?.hasPaper();
      if (!known && dist < 9 && c.env.sees(roamer.x, roamer.z, { radius: 0.5 })) { known = true; c.met('retention-clerk'); }

      const res = stepShredder(rule, {
        dt, dist, insideRoom: inRoom, holdingPaper, offeredPaper, clearLine,
      });
      offeredPaper = false;
      rule = res.state;

      if (res.whistled) c.env.play('whistle', roamer.x, roamer.z, 11);
      if (res.atePaper) {
        c.env.hand?.consume(isPaper);
        c.env.play('shred', roamer.x, roamer.z, 9);
        c.env.play('whistle', roamer.x, roamer.z, 9);
      }
      if (res.grabbed) {
        if (!known) { known = true; c.met('retention-clerk'); }          // (if you had not seen her before, you have now)
        c.env.play('shred', roamer.x, roamer.z, 9);
        c.env.play('crack', roamer.x, roamer.z, 8);
        c.env.interfere(0.85);
      }

      let moving = false;
      if (rule.phase === 'following' && res.speed > 0) {
        const nav = routeToward(c.world, roamer.x, roamer.z, me.x, me.z);
        const went = stepWalker(c.world, roamer, nav.tx, nav.tz, res.speed * dt);
        moving = went > 1e-4;
        const wantYaw = Math.atan2(nav.tx - roamer.x, nav.tz - roamer.z);
        rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 4.5, dt * 4.5);
      } else if (rule.phase === 'leaving' && res.speed > 0) {
        const dHome = Math.hypot(homeW.x - roamer.x, homeW.z - roamer.z);
        if (dHome > 0.35) {
          const nav = routeToward(c.world, roamer.x, roamer.z, homeW.x, homeW.z);
          const went = stepWalker(c.world, roamer, nav.tx, nav.tz, res.speed * dt);
          moving = went > 1e-4;
          const wantYaw = Math.atan2(nav.tx - roamer.x, nav.tz - roamer.z);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 3.8, dt * 3.8);
        }
      } else if (rule.phase === 'pulling') {
        const throatX = roamer.x + Math.sin(rig.group.rotation.y) * 0.62;
        const throatZ = roamer.z + Math.cos(rig.group.rotation.y) * 0.62;
        const nx = me.x + (throatX - me.x) * Math.min(1, dt * 6);
        const nz = me.z + (throatZ - me.z) * Math.min(1, dt * 6);
        const faceClerk = Math.atan2(me.x - roamer.x, me.z - roamer.z);
        c.env.player?.warp(nx, nz, faceClerk);
        me.pitch = -0.42 * res.pullProgress;
        me.sinkTo = 0.48 * res.pullProgress;
        c.env.interfere(0.55 + 0.45 * res.pullProgress);
        if (res.caught) {
          // through the rollers: two hearts where there are hearts — and if that was not the last of them she lets go and wheels it home
          const hit = c.hurt(SHREDDER.hurts);
          if (!hit.ended) { rule = releaseShredder(rule); me.pitch = 0; if (hit.landed) { c.env.hud.glitch(0.6); c.survived('retention-clerk'); } }
        }
      }

      syncUseRoom(roamer.x, roamer.z, rig.group.rotation.y);
      rig.animate(dt, time, moving, rule.phase === 'shredding' || rule.phase === 'pulling');
    },
    dispose() {
      const uIdx = hostRt.uses.indexOf(feedUse);
      if (uIdx >= 0) hostRt.uses.splice(uIdx, 1);
    },
  });
  rig.group.rotation.y = Math.atan2(c.room.cx - homeW.x, c.room.cz - homeW.z);
}
