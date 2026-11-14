// The Audit Pod ("the consultants with the pink slips"): a crisp restructuring
// war-room with a red-crossed org-chart whiteboard and a conference table. Two
// neutral Efficiency Partners in dark suits cradle aluminium clipboards, click
// silver pens, walk briskly up to visitors, and hand out Pink Slips
// (Form HR-404: Notice of Redundancy) — which, happily, The Retention Clerk's
// industrial shredder counts as valid paper.
import * as THREE from 'three';
import { drawText } from '../kit.js';
import { P, clamp, turnTo, framed, scatter } from '../bits.js';
import { placePickup, buildItemProp, isPaper } from '../hand.js';
import { stepWalker, routeToward } from '../denizens.js';
import { createPartnerState, stepPartner } from './audit-pod/rule.js';
import { makeEfficiencyPartner } from './audit-pod/rig.js';

function orgChartBoard(c, dept, targetPct) {
  const spot = c.wallSpot(2.1, ['back', 'left', 'right']);
  if (!spot) return;
  const tex = c.kit.tex.custom('orgchart:' + dept + ':' + targetPct, 240, 128, (g, w, h) => {
    P(g, '#f7f7f4', 0, 0, w, h);
    P(g, '#1f2838', 0, 0, w, 22);
    drawText(g, [`SYNERGY REVIEW — ${dept.toUpperCase()}`], 4, 2, w - 8, 18, { color: '#eef4fa', size: 10, pad: 2 });
    // Top executive box
    P(g, '#2d4b73', 96, 30, 48, 16);
    // Connectors
    P(g, '#6a7482', 119, 46, 2, 12);
    P(g, '#6a7482', 36, 58, 168, 2);
    // Subordinate boxes — most crossed out in red ink
    for (let i = 0; i < 4; i++) {
      const bx = 20 + i * 54, by = 66;
      P(g, '#6a7482', bx + 16, 58, 2, 8);
      P(g, i === 1 ? '#dce4ec' : '#f5d6dc', bx, by, 34, 18);
      P(g, '#3d4654', bx, by, 34, 2);
      if (i !== 1) {
        g.strokeStyle = '#c42432'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(bx + 3, by + 3); g.lineTo(bx + 31, by + 15);
        g.moveTo(bx + 31, by + 3); g.lineTo(bx + 3, by + 15); g.stroke();
      }
    }
    drawText(g, [`RIGHT-SIZING TARGET: -${targetPct}%  |  ISSUE FORM HR-404`], 6, 98, w - 12, 22, { color: '#9e1f2c', size: 9, pad: 2 });
  }, { clamp: true });
  framed(c, c.mapped('orgchart', tex), spot.side, spot.at, 1.48, 1.75, 0.94, null, [0.55, 0.58, 0.62]);
}

export function build(c) {
  const { W, D, params: p } = c;
  c.shell();

  // Keep back corners clear for stashed tapes
  c.reserve(-W / 2 + 1.0, -D / 2 + 1.0, 0.65);
  c.reserve(W / 2 - 1.0, -D / 2 + 1.0, 0.65);

  orgChartBoard(c, p.dept, p.reduction);

  // War-room table off-centre so all doorways remain completely open
  let tableSlot = null;
  for (const sx of [p.tableSide, -p.tableSide, 0]) {
    const tx = clamp(sx * 1.15, -W / 2 + 1.5, W / 2 - 1.5);
    const tz = clamp(-0.35, -D / 2 + 2.0, D / 2 - 2.2);
    if (!c.clear(tx, tz, 0.85)) continue;
    const tbl = c.prop(c.hasProp('desk') ? 'desk' : 'cafetable', tx, tz, {
      rot: 0,
      fallback: [1.3, 0.74, 0.75],
    });
    tableSlot = placePickup(c, 'pink-slip', tx, tz, tbl.top, { label: 'take pink slip' });
    scatter(c, tx, tz, 6, 0.95, '#f3b3c0');
    c.reserve(tx, tz, 0.95);
    break;
  }
  if (!tableSlot) {
    tableSlot = placePickup(c, 'pink-slip', 0, 0, 0, { label: 'take pink slip' });
  }

  // Spawn two polite, eerie Efficiency Partners
  const posts = [
    [-W / 2 + 1.55, -D / 2 + 2.1],
    [W / 2 - 1.55, D / 2 - 2.3],
  ];

  let known = false;
  posts.forEach(([lx, lz], idx) => {
    const home = c.toWorld(clamp(lx, -W / 2 + 1.2, W / 2 - 1.2), clamp(lz, -D / 2 + 1.4, D / 2 - 1.4));
    const rig = makeEfficiencyPartner(c.kit, idx);
    let rule = createPartnerState(idx * 1.4);
    let acceptedViaUse = false;
    let hostRt = c.rt;

    const dropped = [];
    const dropPrevOnFloor = (prevKind, wx, wz) => {
      if (!prevKind) return;
      if (tableSlot && tableSlot.get() === null) { tableSlot.set(prevKind); return; }
      let slot = prevKind;
      const holder = new THREE.Group();
      holder.position.set(wx, c.world.floorY(wx, wz), wz);
      c.world.scene.add(holder);
      const m = buildItemProp(c.kit, slot, { view: false });
      m.userData.light(c.world.lightAt(wx, wz, 0.5));
      holder.add(m);
      const here = c.world.roomAt(wx, wz) || c.rt;
      const u = {
        wx, wz, r: 1.45, cone: 0.45, label: `take ${slot}`,
        when: () => slot !== null && !!c.env.hand,
        use: () => {
          if (!c.env.hand || !slot) return;
          const taking = slot;
          slot = c.env.hand.swap(taking);
          holder.clear();
          if (slot) {
            const nextM = buildItemProp(c.kit, slot, { view: false });
            nextM.userData.light(c.world.lightAt(wx, wz, 0.5));
            holder.add(nextM);
          }
          c.env.play(isPaper(taking) ? 'rustle' : taking === 'flashlight' ? 'click' : 'squeak', wx, wz, 4);
        },
      };
      here.uses.push(u);
      dropped.push({ holder, here, u });
    };

    const offerUse = c.use({
      x: lx, z: lz, r: 1.85, cone: 0.35,
      label: 'accept pink slip',
      when: () => rule.phase === 'offering' && !!c.env.hand && !c.env.hand.has('pink-slip'),
      use: () => { acceptedViaUse = true; },
    });

    const syncOfferRoom = (wx, wz) => {
      offerUse.wx = wx; offerUse.wz = wz;
      const nowRt = c.world.roomAt(wx, wz);
      if (nowRt && nowRt !== hostRt) {
        const i = hostRt.uses.indexOf(offerUse);
        if (i >= 0) hostRt.uses.splice(i, 1);
        nowRt.uses.push(offerUse);
        hostRt = nowRt;
      }
    };

    const roamer = c.env.denizens?.add({
      x: home.x, z: home.z, r: 0.24, tall: 1.45, heading: 0,
      group: rig.group,
      light: (rgb) => rig.light(rgb),
      update(dt, time, me) {
        if (!known && Math.hypot(me.x - roamer.x, me.z - roamer.z) < 8 && c.env.sees(roamer.x, roamer.z, { radius: 0.5 })) { known = true; c.met('efficiency-partners'); }
        const inRoom = c.world.current() === c.rt;
        const dist = Math.hypot(me.x - roamer.x, me.z - roamer.z);
        const handEmpty = !c.env.hand?.get();

        const res = stepPartner(rule, {
          dt,
          dist,
          insideRoom: inRoom,
          handEmpty,
          acceptedViaUse,
        });
        const usedSwap = acceptedViaUse;
        acceptedViaUse = false;
        rule = res.state;

        if (res.clickedPen) c.env.play('penclick', roamer.x, roamer.z, 7);
        if (res.gaveSlip && c.env.hand) {
          const prev = c.env.hand.swap('pink-slip');
          if (usedSwap && prev) dropPrevOnFloor(prev, roamer.x, roamer.z);
          c.env.play('rustle', roamer.x, roamer.z, 6);
          c.env.play('penclick', roamer.x, roamer.z, 6);
        }

        let moving = false;
        if (rule.phase === 'approaching' && res.speed > 0) {
          const nav = routeToward(c.world, roamer.x, roamer.z, me.x, me.z);
          const went = stepWalker(c.world, roamer, nav.tx, nav.tz, res.speed * dt);
          moving = went > 1e-4;
          const wantYaw = Math.atan2(nav.tx - roamer.x, nav.tz - roamer.z);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 6, dt * 6);
        } else if (rule.phase === 'offering') {
          const wantYaw = Math.atan2(me.x - roamer.x, me.z - roamer.z);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 6, dt * 6);
        } else if (rule.phase === 'departing' && res.speed > 0) {
          const dHome = Math.hypot(home.x - roamer.x, home.z - roamer.z);
          if (dHome > 0.35) {
            const nav = routeToward(c.world, roamer.x, roamer.z, home.x, home.z);
            const went = stepWalker(c.world, roamer, nav.tx, nav.tz, res.speed * dt);
            moving = went > 1e-4;
            const wantYaw = Math.atan2(nav.tx - roamer.x, nav.tz - roamer.z);
            rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 5, dt * 5);
          } else {
            const wantYaw = Math.atan2(c.room.cx - roamer.x, c.room.cz - roamer.z);
            rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 4, dt * 4);
          }
        } else {
          const wantYaw = Math.atan2(me.x - roamer.x, me.z - roamer.z);
          rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 3, dt * 3);
        }

        syncOfferRoom(roamer.x, roamer.z);
        rig.pose(time, rule.phase, moving);
      },
      dispose() {
        const uIdx = hostRt.uses.indexOf(offerUse);
        if (uIdx >= 0) hostRt.uses.splice(uIdx, 1);
        for (const d of dropped) {
          d.holder.removeFromParent();
          const di = d.here.uses.indexOf(d.u);
          if (di >= 0) d.here.uses.splice(di, 1);
        }
      },
    });
  });
}
