// Blackout Bay ("the dark room with the staff"): a dead-circuit open-plan bay
// whose ceiling panels are out and whose emergency lamp reaches only the entry
// mat. Step into the pitch dark without the yellow facilities flashlight and
// the picture floods solid crimson and ends the visit. Carry the flashlight and
// its beam reveals elongated fake colleagues — The Stand-Ins — who freeze dead
// whenever your light is on them and creep closer whenever you look away.
import { lin, WHITE } from '../kit.js';
import { clamp, turnTo, card, framed } from '../bits.js';
import { placePickup } from '../hand.js';
import { BLACKOUT, createBlackoutState, stepBlackout, releaseBlackout } from './blackout-bay/rule.js';
import { buildStandIn } from './blackout-bay/rig.js';
import { roomBody, moveRoomWalker, roomContact, roomReturn } from '../room-physics.js';

export function build(c) {
  const { W, D, H, R, params: p } = c;
  // Suppress the camcorder's tiny auto-lamp here: only the held flashlight cuts this dark
  c.rt.noTorch = true;
  c.rt.amb = [0.003, 0.003, 0.004];
  c.shell({ panels: false });
  // Keep doorway spill tight to the thresholds so the middle of the bay stays pitch dark
  for (const L of c.rt.lights) { L.far2 = 3.2 ** 2; L.k = 1.1; }

  // Keep back corners clear for stashed tapes
  c.reserve(-W / 2 + 1.0, -D / 2 + 1.0, 0.65);
  c.reserve(W / 2 - 1.0, -D / 2 + 1.0, 0.65);

  // Amber emergency bulkhead light right inside the front entrance
  const safeZ = D / 2 - 2.25;
  c.light(0, H - 0.28, D / 2 - 0.85, '#ffaa44', 0.92, { k: 4.8, far: 4.3 });
  const bulbTex = c.kit.tex.panel(true);
  c.hang(c.shining('embulb', bulbTex, 2.2, lin('#ffaa44')), 'front', 0, H - 0.32, 0.48, 0.16, null, WHITE, 0.03);

  // Hazard threshold line marking the edge of the emergency light
  c.lay(c.flat, 0, safeZ, W - 0.7, 0.08, 0, null, lin('#dfb226'), 0.009);

  // Far exit sign beacon over the onward doorway across the dark
  const onwardDoor = c.room.doors.find((d) => d.side !== 'front');
  if (onwardDoor) c.exitSign(onwardDoor, 'EXIT');

  // Maintenance cart in the lit foyer carrying the yellow facilities flashlight
  let placedTorch = false;
  for (const sx of [p.cartSide, -p.cartSide, 0]) {
    const tx = clamp(sx * 1.25, -W / 2 + 1.05, W / 2 - 1.05), tz = D / 2 - 1.15;
    if (!c.clear(tx, tz, 0.52)) continue;
    const cart = c.prop(c.hasProp('cafetable') ? 'cafetable' : 'desk', tx, tz, {
      rot: 0,
      fallback: [0.65, 0.75, 0.65],
    });
    placePickup(c, 'flashlight', tx, tz, cart.top, { label: 'take facilities flashlight' });
    c.reserve(tx, tz, 0.62);
    placedTorch = true;
    break;
  }
  if (!placedTorch) placePickup(c, 'flashlight', 0, D / 2 - 1.1, 0, { label: 'take facilities flashlight' });

  // Warning placard illuminated in the foyer
  const signSpot = c.wallSpot(1.5, ['front', 'left', 'right']);
  if (signSpot) {
    const tex = card(c, 'outagesign:' + p.circuit, [
      `CIRCUIT ${p.circuit} DEAD`,
      'TORCH MANDATORY BEYOND LINE',
      'KEEP BEAM ON PERSONNEL',
    ], { w: 192, h: 72, bg: '#f4e6c2', fg: '#1c1812', edge: '#c43028', size: 10, pad: 9 });
    framed(c, c.mapped('outagesign', tex), signSpot.side, signSpot.at, 1.52, 1.22, 0.46);
  }

  // Sparse dark workstations along the outer walls so aisles stay clear
  for (const sx of [-1, 1]) {
    for (const zOff of [-2.2, 1.1]) {
      const dx = sx * (W / 2 - 1.05), dz = clamp(zOff, -D / 2 + 2.3, safeZ - 1.6);
      if (!c.clear(dx, dz, 0.75)) continue;
      c.prop('desk', dx, dz, { rot: sx < 0 ? Math.PI / 2 : -Math.PI / 2, fallback: [0.75, 0.74, 1.3] });
    }
  }

  // An uncanny Stand-In, assembled from the real office's cast
  const roster = c.env.cast?.length ? c.env.cast : [{ name: c.env.who?.name || 'Staff', look: c.env.who?.look }];
  const standIns = [];
  // One of them, well into the room and off to one side of the way across (the owner: four was too many, and too quick)
  const anchors = [
    [(p.cartSide || 1) * W * 0.25, safeZ - 4.4],
  ];
  for (let i = 0; i < anchors.length; i++) {
    const who = roster[(i + p.castOffset) % roster.length];
    const [ax, az] = anchors[i];
    const sx = clamp(ax + R.range(-0.35, 0.35), -W / 2 + 1.1, W / 2 - 1.1);
    const sz = clamp(az + R.range(-0.35, 0.35), -D / 2 + 1.8, safeZ - 1.4);
    const fig = buildStandIn(c.kit, who, i);
    const rot = Math.atan2(-sx, safeZ - sz);
    fig.group.position.set(sx, 0, sz);
    fig.group.rotation.y = rot;
    c.add(fig.group);
    const entry = { ...fig, hx: sx, hz: sz, x: sx, z: sz, rot, stepTimer: 0.4 + i * 0.25 };
    roomBody(c, entry);
    c.after.push(() => entry.light(c.sample(entry.x, 1.0, entry.z)));
    standIns.push(entry);
  }

  let rule = createBlackoutState(standIns.length);
  let wasRed = false, known = false;

  c.tick((dt, time, me) => {
    const nearOtherDoor = c.room.doors.some((dr) => {
      if (dr.side === 'front') return false;
      const dp = c.doorPoint(dr, 0.35);
      return Math.hypot(me.x - dp.x, me.z - dp.z) < 1.55;
    });
    const inDark = me.inside && me.z < safeZ && !nearOtherDoor;
    const hasFlashlight = !!c.env.hand?.hasFlashlight();
    const meW = c.toWorld(me.x, me.z);

    const targets = standIns.map((s) => {
      const sw = c.toWorld(s.x, s.z);
      return { x: s.x, z: s.z, los: c.world.los(meW.x, meW.z, sw.x, sw.z), contact: roomContact(c, s, me), fire: !!c.fire(s.x, s.z) };          // sight over a low desk still freezes it; reaching through that desk does not
    });

    const res = stepBlackout(rule, {
      dt,
      inDark,
      hasFlashlight,
      byFire: !!c.fire(me.x, me.z),          // paper burning within sight is light enough to stand in
      px: me.x,
      pz: me.z,
      yaw: me.yaw,
      targets,
    });
    rule = res.state;
    // (really seen: held still in the beam, near enough to make out)
    if (!known && res.frozen.some((f, i) => f && Math.hypot(standIns[i].x - me.x, standIns[i].z - me.z) < 8)) { known = true; c.met('stand-ins'); }

    if (res.red > 0) {
      c.env.red(res.red);
      c.env.interfere(res.red * 0.72);
      if (!wasRed) c.env.play('buzz', meW.x, meW.z, 6);
      wasRed = true;
    } else {
      wasRed = false;
    }

    for (let i = 0; i < standIns.length; i++) {
      const s = standIns[i];
      const spd = res.speeds[i] || 0;
      if (!me.inside || rule.grace > 0) {
        // Drift back toward starting stations if visitor backs out of the room
        const dx = s.hx - s.x, dz = s.hz - s.z, d = Math.hypot(dx, dz);
        if (d > 0.05) {
          moveRoomWalker(c, s, s.hx, s.hz, Math.min(d, 1.2 * dt));
        }
        s.group.position.set(s.x, 0, s.z);
      } else if (spd > 0) {
        const dx = me.x - s.x, dz = me.z - s.z, d = Math.hypot(dx, dz) || 0.001;
        const step = Math.min(d, spd * dt);
        const nx = clamp(s.x + (dx / d) * step, -W / 2 + 0.35, W / 2 - 0.35);
        const nz = clamp(s.z + (dz / d) * step, -D / 2 + 0.35, safeZ - 0.45);
        moveRoomWalker(c, s, nx, nz, step);
        const want = Math.atan2(me.x - s.x, me.z - s.z);
        s.rot += clamp(turnTo(s.rot, want), -dt * 7, dt * 7);
        s.group.rotation.y = s.rot;
        s.group.position.set(s.x, Math.abs(Math.sin(time * 8 + i)) * 0.04, s.z);
        s.stepTimer -= dt;
        if (s.stepTimer <= 0) {
          s.stepTimer = 0.48;
          const sw = c.toWorld(s.x, s.z);
          c.env.play('step', sw.x, sw.z, 6);
        }
      }
      // When frozen in the beam (`spd === 0`), they stay dead still in whatever posture they held
      s.light(c.sample(s.x, 1.0, s.z));
    }

    if (res.caught) {
      c.env.red(1);
      c.env.interfere(1);
      c.env.play('buzz', meW.x, meW.z, 8);
      // the dark has you: two hearts where there are hearts — and if that was not the last of them, you are back at the door you came
      // in by, they are back where they stood, and there is a moment to think about a light
      if (!known) { known = true; c.met('stand-ins'); }
      const hit = c.hurt(BLACKOUT.hurts);
      if (!hit.ended) {
        rule = releaseBlackout(rule);
        const front = c.room.doors.find((dr) => dr.side === 'front') || c.room.doors[0], at = front ? c.doorPoint(front, 0.7) : { x: 0, z: D / 2 - 0.7 }, w = roomReturn(c, at.x, at.z);
        if (w) c.env.player?.warp(w.x, w.z);
        // They return during the grace period, walking round anything moved
        // into their old station instead of appearing inside it.
        if (hit.landed) { c.env.hud.glitch(0.7); c.survived('stand-ins'); }
      }
    }
  });
}
