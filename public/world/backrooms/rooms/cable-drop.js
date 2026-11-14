// The Trunk Drop ("the cables hanging from the ceiling"): an IT plenum bay
// whose patch cords have come down through the tiles. Walk around the drop and
// nothing stirs; step or sprint under the hanging leads and The Trunk Line
// drops out of the ceiling, squeezes under crawl headers, and hunts you until
// you shut a fire door in its face.
import { Batch, lin, WHITE } from '../kit.js';
import { TILE } from '../gen.js';
import { clamp, turnTo, card, framed, doorFrame } from '../bits.js';
import { placePickup } from '../hand.js';
import { stepWalker, routeToward } from '../denizens.js';
import { CABLE, createCableState, stepCable, releaseCable } from './cable-drop/rule.js';
import { dormantTendrilsVox, makeTrunkLine } from './cable-drop/rig.js';

function hangFireDoor(c, dr) {
  const { W, D } = c;
  const dw = Math.min(dr.w - 0.06, 1.18), dh = Math.min(dr.h - 0.03, 2.02);
  doorFrame(c, dr.side, dr.c, dw, dh, lin('#4a5058'), 0.05, 0.065);
  const p = c.wallAt(dr.side, dr.c, 0.03), U = p.U, n = p.n;
  const hx = p.x - U[0] * (dw / 2), hz = p.z - U[2] * (dw / 2);

  // Build door leaf in room coordinates, hinged at (hx, 0, hz)
  const leafB = new Batch();
  const steel = lin('#6a332d'), trim = lin('#d8d2c2'), barCol = [0.76, 0.74, 0.68];
  const x0 = Math.min(hx, hx + U[0] * dw) - Math.abs(n[0]) * 0.024;
  const x1 = Math.max(hx, hx + U[0] * dw) + Math.abs(n[0]) * 0.024;
  const z0 = Math.min(hz, hz + U[2] * dw) - Math.abs(n[2]) * 0.024;
  const z1 = Math.max(hz, hz + U[2] * dw) + Math.abs(n[2]) * 0.024;
  leafB.box(x0, 0.02, z0, x1, dh, z1, steel);
  // Push-bar across waist height on both faces
  const bx0 = Math.min(hx + U[0] * 0.14, hx + U[0] * (dw - 0.14)) - Math.abs(n[0]) * 0.05;
  const bx1 = Math.max(hx + U[0] * 0.14, hx + U[0] * (dw - 0.14)) + Math.abs(n[0]) * 0.05;
  const bz0 = Math.min(hz + U[2] * 0.14, hz + U[2] * (dw - 0.14)) - Math.abs(n[2]) * 0.05;
  const bz1 = Math.max(hz + U[2] * 0.14, hz + U[2] * (dw - 0.14)) + Math.abs(n[2]) * 0.05;
  leafB.box(bx0, 0.94, bz0, bx1, 1.0, bz1, barCol);
  leafB.box(
    Math.min(hx + U[0] * (dw * 0.35), hx + U[0] * (dw * 0.65)) - Math.abs(n[0]) * 0.028, 1.35,
    Math.min(hz + U[2] * (dw * 0.35), hz + U[2] * (dw * 0.65)) - Math.abs(n[2]) * 0.028,
    Math.max(hx + U[0] * (dw * 0.35), hx + U[0] * (dw * 0.65)) + Math.abs(n[0]) * 0.028, 1.62,
    Math.max(hz + U[2] * (dw * 0.35), hz + U[2] * (dw * 0.65)) + Math.abs(n[2]) * 0.028, trim,
  );
  const door = c.dynamic(leafB, { pivot: [hx, 0, hz] });

  // Collider across the doorway opening, inactive while swung open
  const cx = p.x, cz = p.z;
  const bar = c.solid(
    cx - Math.abs(U[0]) * (dw / 2) - Math.abs(n[0]) * 0.12,
    cz - Math.abs(U[2]) * (dw / 2) - Math.abs(n[2]) * 0.12,
    cx + Math.abs(U[0]) * (dw / 2) + Math.abs(n[0]) * 0.12,
    cz + Math.abs(U[2]) * (dw / 2) + Math.abs(n[2]) * 0.12,
    { tall: true, on: false },
  );

  // Swing inward without hitting adjacent walls
  const openAngle = -1.42;
  let isOpen = true, anim = 1;
  door.rotation.y = openAngle;
  const th = c.world.throats[dr.link];
  if (th) th.open = true;

  const wPos = c.toWorld(cx, cz);
  c.use({
    x: cx, z: cz, r: 1.65, cone: 0.2,
    label: 'shut fire door',
    use: () => {
      isOpen = !isOpen;
      bar.on = !isOpen;
      if (th) th.open = isOpen;
      c.env.play(isOpen ? 'door' : 'thunk', wPos.x, wPos.z, 6);
    },
  });
  c.tick((dt) => {
    const want = isOpen ? 1 : 0;
    if (Math.abs(anim - want) < 0.002) return;
    anim += (want - anim) * Math.min(1, dt * 9);
    door.rotation.y = openAngle * anim;
  });
  // Reserve hinge sweep so furniture never blocks the leaf
  c.reserve( clamp(cx + n[0] * 0.6, -W / 2 + 0.5, W / 2 - 0.5), clamp(cz + n[2] * 0.6, -D / 2 + 0.5, D / 2 - 0.5), 0.75 );
  return { bar, wPos, isShut: () => !isOpen };
}

export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell();

  // Hinged steel fire doors on every doorway: open at first, E slams them shut
  const doors = c.room.doors.filter((dr) => dr.sill < 0.05 && dr.h > 1.7).map((dr) => hangFireDoor(c, dr));

  // Central plenum breach: 2×2 popped ceiling tiles and fallen acoustic boards
  const dropX = 0, dropZ = clamp(p.offsetZ, -D / 2 + 2.6, D / 2 - 2.6);
  const hole = c.hole(dropX - TILE * 0.5, dropZ - TILE * 0.5, 2);
  c.blot(hole.x, hole.z, 2.3, 2.3, { rgb: [0.05, 0.05, 0.06], a: 0.45 });
  for (const [dx, dz, rot] of [[-0.55, 0.35, 0.4], [0.48, -0.42, 1.9]]) {
    c.lay(c.ceil, hole.x + dx, hole.z + dz, TILE, TILE, rot, [[0, 0], [1, 0], [1, 1], [0, 1]], WHITE, 0.012);
  }
  // Yellow/black floor hazard box around the hanging leads so observant visitors walk clear
  const tape = lin('#d6a428');
  for (const s of [-1, 1]) {
    c.lay(c.flat, hole.x, hole.z + s * 1.22, 2.44, 0.06, 0, null, tape, 0.01);
    c.lay(c.flat, hole.x + s * 1.22, hole.z, 0.06, 2.44, 0, null, tape, 0.01);
  }

  // Dormant tendrils dangling from the plenum hole
  const tendrilBatch = new Batch(true);
  const tm = c.kit.model('trunk:tendrils', dormantTendrilsVox);
  c.place(tm, hole.x, hole.z, { y: H + 0.06, scale: 1.15, solid: false, shadow: false, batch: tendrilBatch });
  const tendrils = c.dynamic(tendrilBatch, { pivot: [hole.x, H, hole.z] });

  // Crawl header partition along one flank: 0.82 m clearance — the Trunk Line slips straight under it
  const crawlSide = p.crawlSide, px0 = crawlSide > 0 ? 1.55 : -(W / 2 - 0.15), px1 = crawlSide > 0 ? (W / 2 - 0.15) : -1.55;
  if (px1 - px0 > 1.15) {
    c.pillar((px0 + px1) / 2, dropZ, px1 - px0, 0.28, { y0: 0.84, solid: false, skirting: false });
    const prevHead = c.rt.headY;
    c.rt.headY = (x, z) => {
      const base = prevHead ? prevHead(x, z) : H;
      return (x >= px0 - 0.1 && x <= px1 + 0.1 && Math.abs(z - dropZ) <= 0.26) ? Math.min(base, 0.84) : base;
    };
  }

  // Opposite flank: open telecom rack, warning plaque, and a sheaf of loose memos on a cart
  const safeSide = -crawlSide;
  const sx = safeSide * (W / 2 - 0.72), sz = clamp(dropZ + 1.4, -D / 2 + 1.5, D / 2 - 1.5);
  if (c.clear(sx, sz, 0.48)) {
    const desk = c.prop(c.hasProp('cafetable') ? 'cafetable' : 'desk', sx, sz, { rot: safeSide > 0 ? -Math.PI / 2 : Math.PI / 2, fallback: [0.65, 0.76, 0.65] });
    placePickup(c, 'papers', sx, sz, desk.top, { label: 'take loose memos' });
  }
  const signSpot = c.wallSpot(1.6, ['left', 'right', 'back']);
  if (signSpot) {
    const tex = card(c, 'plenum:' + p.notice, ['IT INFRASTRUCTURE', p.notice, 'KEEP FIRE DOORS SHUT'], { w: 176, h: 72, bg: '#f2ead4', fg: '#1d222a', edge: '#b8382c', size: 11, pad: 10 });
    framed(c, c.mapped('plenumsign', tex), signSpot.side, signSpot.at, 1.52, 1.15, 0.48);
  }

  // The Trunk Line itself — hidden in the ceiling until woken, then registered on the floor
  const rig = makeTrunkLine(c.kit);
  const startW = c.toWorld(hole.x, hole.z);
  let rule = createCableState(), known = false;

  const roamer = c.env.denizens?.add({
    x: startW.x, z: startW.z, r: 0.24, tall: 0.62, heading: 0,
    group: rig.group, visible: false, lift: H - 0.2,
    light: (rgb) => rig.light(rgb),
    update(dt, time, me) {
      tendrils.rotation.z = Math.sin(time * 1.9) * 0.035;
      tendrils.rotation.x = Math.cos(time * 1.5) * 0.03;

      const inRoom = c.world.current() === c.rt;
      const distDrop = Math.hypot(me.x - startW.x, me.z - startW.z);
      const distMe = Math.hypot(me.x - roamer.x, me.z - roamer.z);
      const nav = routeToward(c.world, roamer.x, roamer.z, me.x, me.z, { needsOpenDoor: true });
      const shutDoorNear = doors.some((d) => d.isShut() && Math.hypot(d.wPos.x - roamer.x, d.wPos.z - roamer.z) < 1.1 && !c.world.los(roamer.x, roamer.z, me.x, me.z));
      const doorBlocked = nav.doorBlocked || shutDoorNear;
      const clearLine = !doorBlocked && c.world.los(roamer.x, roamer.z, me.x, me.z);

      const res = stepCable(rule, {
        dt, distToDrop: distDrop, distToCreature: distMe,
        playerSpeed: me.speed, insideRoom: inRoom, doorBlocked, clearLine,
      });
      rule = res.state;

      if (res.woke) {
        tendrils.visible = false;
        roamer.visible = true;
        c.env.play('crack', startW.x, startW.z, 9);
        c.env.play('buzz', startW.x, startW.z, 9);
        c.env.interfere(0.75);
      }

      if (rule.phase === 'dropping') {
        const k = rule.dropProgress;
        roamer.lift = (1 - k * k) * (H - 0.55);
        rig.pose(time, 0.5, 0.55 + 0.45 * k);
        rig.group.rotation.y = Math.atan2(me.x - roamer.x, me.z - roamer.z);
      } else if (rule.phase === 'hunting' || rule.phase === 'recoiling') {
        if (!known && distMe < 9 && c.env.sees(roamer.x, roamer.z, { radius: 0.5 })) { known = true; c.met('trunk-line'); }
        roamer.lift = 0;
        if (res.rattled) {
          const rx = nav.door?.x ?? roamer.x, rz = nav.door?.z ?? roamer.z;
          c.env.play('rattle', rx, rz, 7);
          c.env.interfere(0.22);
        }
        let went = 0;
        if (res.speed > 0) {
          went = stepWalker(c.world, roamer, nav.tx, nav.tz, res.speed * dt, { closedDoor: nav.closedDoor });
        }
        const headRoom = c.world.headroom(roamer.x, roamer.z);
        const crouch = clamp((headRoom - 0.5) / 1.15, 0.46, 1);
        rig.pose(time, went / Math.max(dt, 1e-3), crouch);
        const wantYaw = Math.atan2(nav.tx - roamer.x, nav.tz - roamer.z);
        rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 8, dt * 8);
        if (distMe < 2.6 && clearLine) c.env.interfere(clamp((2.6 - distMe) * 0.24, 0, 0.65));
        if (res.caught) {
          // round your neck: a heart where there are hearts, and if that was not the last of them it lets go and hangs back
          c.env.play('buzz', roamer.x, roamer.z, 6);
          c.env.interfere(1);
          const hit = c.hurt(CABLE.hurts);
          if (!hit.ended) { rule = releaseCable(rule); if (hit.landed) { c.env.hud.glitch(0.5); c.survived('trunk-line'); } }
        }
      }
    },
  });
}
