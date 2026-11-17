// Mandatory Fun: the office party nobody ever cleared away. A selected red
// balloon buys a dance; empty hands make all six committee members converge.
import * as THREE from 'three';
import { lin } from '../kit.js';
import { toLocal } from '../gen.js';
import { clamp, turnTo } from '../bits.js';
import { placePickup } from '../hand.js';
import { PARTY, createPartyState, stepParty, releaseParty, partyTarget } from './mandatory-fun/rule.js';
import { buildCommitteeMember } from './mandatory-fun/rig.js';
import { dressParty } from './mandatory-fun/dressing.js';
import { roomBody, moveRoomWalker, roomContact } from '../room-physics.js';

export function build(c) {
  const { W, D, H, params: p } = c;
  c.shell();

  // Keep back corners clear for stashed tapes
  c.reserve(-W / 2 + 1.0, -D / 2 + 1.0, 0.65);
  c.reserve(W / 2 - 1.0, -D / 2 + 1.0, 0.65);

  // The old foyer stripe is just decoration: sight, not crossing it, starts the approach.
  const thresholdZ = D / 2 - 2.3;
  c.lay(c.flat, 0, thresholdZ, W - 0.8, 0.07, 0, null, lin('#a34e44'), 0.009);

  // Balloon pickup tied safely on the foyer side of the red line so visitors can take one first
  const pickupSide = -p.greeterSide;
  const balloons = c.env.partySize === 2 ? 2 : 1;
  let placedBalloons = 0;
  for (const sx of [pickupSide, -pickupSide, 0]) {
    const bx = clamp(sx * 1.35, -W / 2 + 1.1, W / 2 - 1.1), bz = D / 2 - 1.15;
    if (!c.clear(bx, bz, 0.48)) continue;
    placePickup(c, 'balloon', bx, bz, 0, { label: 'take red balloon' });
    c.reserve(bx, bz, 0.55);
    if (++placedBalloons === balloons) break;
  }
  // Distinct pickups (and IDs) even in a tightly furnished foyer.
  while (placedBalloons < balloons) {
    placePickup(c, 'balloon', placedBalloons++ ? .45 : -.45, D / 2 - 1.05, 0, { label: 'take red balloon' });
  }

  // Warm overhead party tint in the middle of the room
  const ringX = 0, ringZ = clamp(-0.55, -D / 2 + 2.3, thresholdZ - 1.8);
  c.light(ringX, H - 0.25, ringZ, '#ffd4c4', 0.65, { k: 2.8, far: 8 });
  c.reserve(ringX, ringZ, 1.65);

  // Build the 6 Fun Committee members: 1 one-legged threshold greeter + 5 linked in a circle
  const members = [];
  const gx = clamp(p.greeterSide * (W / 2 - 1.45), -W / 2 + 1.1, W / 2 - 1.1);
  const gz = clamp(thresholdZ - 0.35, -D / 2 + 1.6, D / 2 - 1.6);
  c.reserve(gx, gz, 0.55);
  dressParty(c);

  const addMember = (variant, idx, hx, hz, hRot, baseAngle = 0) => {
    const m = buildCommitteeMember(c.kit, variant, idx);
    m.group.position.set(hx, 0, hz);
    m.group.rotation.y = hRot;
    m.aimHead(turnTo(hRot, Math.atan2(-hx, D / 2 - hz)), 0, 'idle');
    c.add(m.group);
    const entry = { ...m, variant, idx, hx, hz, x: hx, z: hz, rot: hRot, baseAngle };
    roomBody(c, entry);
    c.after.push(() => entry.light(c.sample(entry.x, 1.0, entry.z)));
    members.push(entry);
  };

  addMember('greeter', 0, gx, gz, Math.atan2(-gx, D / 2 - gz));
  const ringR = 1.12;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.25;
    const mx = ringX + Math.sin(a) * ringR, mz = ringZ + Math.cos(a) * ringR;
    // Face inward toward the middle of the circle so arms meet hand-in-hand
    addMember('circle', i, mx, mz, a + Math.PI, a);
  }

  let rule = createPartyState(), known = false, targetId = null;
  const welcomed = new Set();
  c.rt.partyState = () => ({ mode: rule.mode, target: targetId, welcomed: [...welcomed], members: members.map(m => ({ x: m.group.position.x, z: m.group.position.z })) });
  const seesVisitor = me => me.inside && members.some(m => {
    const a = c.toWorld(m.x, m.z), b = c.toWorld(me.x, me.z);
    return c.world.los(a.x, a.z, b.x, b.z);
  });
  // The shared room still ticks once. Select the threatened visitor before its
  // context is installed, so damage and held-item checks belong to that person.
  c.rt.chooseVisitor = people => partyTarget(people.map(p => ({ ...p, visible: seesVisitor(p) })), targetId, welcomed)?.id;
  let danceAt = null, danceAngles = [];
  const gatherAround = me => {
    danceAt = { x: me.x, z: me.z };
    // Keep their order around the visitor instead of assigning the old home
    // slots. Nobody has to cross the camera to reach the opposite side.
    const order = members.map((m, i) => ({ i, angle: Math.atan2(m.x - me.x, m.z - me.z) })).sort((a, b) => a.angle - b.angle);
    const step = Math.PI * 2 / members.length;
    const offset = Math.atan2(order.reduce((s, m, i) => s + Math.sin(m.angle - i * step), 0),
      order.reduce((s, m, i) => s + Math.cos(m.angle - i * step), 0));
    for (const [i, m] of order.entries()) danceAngles[m.i] = offset + i * step;
  };
  const danceSpot = i => {
    const a = danceAngles[i];
    return { x: clamp(danceAt.x + Math.sin(a) * PARTY.danceRadius, -W / 2 + .4, W / 2 - .4),
      z: clamp(danceAt.z + Math.cos(a) * PARTY.danceRadius, -D / 2 + .4, D / 2 - .4) };
  };

  // The building's camera, if they take the last of somebody (docs/BACKROOMS.md, "The last three seconds"): the six of
  // them close into a ring round the visitor's character, hand in hand, and it is given a hat. It does not fall down. It
  // starts, a little late, to bob with the rest of them.
  let over = false;
  c.rt.takes = (shot) => {
    over = true;
    const fig = shot.figure, at = toLocal(c.room, shot.x, shot.z), from = members.map((m) => ({ x: m.x, z: m.z }));
    let hat = null, clock = 0;
    if (fig) {
      const top = new THREE.Box3().setFromObject(fig).max.y - fig.position.y;
      hat = new THREE.Mesh(c.kit.own(new THREE.ConeGeometry(0.11, 0.3, 4)), c.kit.own(new THREE.MeshBasicMaterial({ color: 0xc8322a })));
      hat.position.y = top + 0.13; hat.visible = false; fig.add(hat);
    }
    c.env.play('partyhorn', shot.x, shot.z, 14);
    return (t, dt) => {
      clock += dt;
      const k = Math.min(1, t / 1.3), e = k * k * (3 - 2 * k), turn = clock * 0.9 * e;
      members.forEach((m, i) => {
        const a = (i / members.length) * Math.PI * 2 + turn, tx = at.x + Math.sin(a) * 0.95, tz = at.z + Math.cos(a) * 0.95;
        m.x = from[i].x + (tx - from[i].x) * e; m.z = from[i].z + (tz - from[i].z) * e;
        m.group.position.set(m.x, Math.abs(Math.sin(clock * 5 + i)) * 0.09, m.z);
        m.group.rotation.y = Math.atan2(at.x - m.x, at.z - m.z); m.group.rotation.z = Math.sin(clock * 4 + i * 1.2) * 0.12;
        try { m.aimHead(0, 0, 'party'); } catch { /* as it was */ }
      });
      if (!fig) return;
      if (t > 1.3 && hat && !hat.visible) { hat.visible = true; c.env.play('partyhorn', shot.x, shot.z, 14); }
      const joins = Math.max(0, Math.min(1, (t - 1.6) / 0.8));
      fig.position.y = shot.y + Math.abs(Math.sin(clock * 5)) * 0.08 * joins;
      fig.rotation.z = Math.sin(clock * 4) * 0.12 * joins;
      fig.rotation.y += dt * 0.9 * joins;
    };
  };

  c.tick((dt, time, me) => {
    if (over) return;
    const holdingBalloon = c.env.inventory ? c.env.inventory.held?.()?.type === 'balloon' : !!c.env.hand?.hasBalloon();
    const id = me.id ?? 'local';
    if (id !== targetId) { targetId = id; rule = { ...createPartyState(), welcomed: welcomed.has(id) }; danceAt = null; }
    const visible = seesVisitor(me);
    if (holdingBalloon && !rule.welcomed && rule.mode !== 'gathering' && rule.mode !== 'partying') gatherAround(me);
    let minDist = Infinity, contactDist = Infinity, nearest = null;
    for (const m of members) {
      const d = Math.hypot(me.x - m.x, me.z - m.z);
      if (d < minDist) { minDist = d; nearest = m; }
      if (d < PARTY.catchRadius && roomContact(c, m, me)) contactDist = Math.min(contactDist, d);
    }

    if (!known && me.inside && minDist < 9 && members.some((m) => c.seen(m.x, m.z, { radius: 0.5 }))) { known = true; c.met('fun-committee'); }
    const res = stepParty(rule, {
      dt,
      insideRoom: me.inside,
      visible,
      gathered: !!danceAt && members.every((m, i) => { const p = danceSpot(i); return Math.hypot(m.x - p.x, m.z - p.z) < .4; }),
      holdingBalloon,
      minDist,
      contactDist,
    });
    rule = res.state;
    if (rule.welcomed) welcomed.add(id); else if (visible && !holdingBalloon) welcomed.delete(id);

    const centerW = c.toWorld(ringX, ringZ);
    if (res.horn) c.env.play('partyhorn', centerW.x, centerW.z, 10);
    if (res.triggeredSwarm) {
      c.env.play('partyhorn', centerW.x, centerW.z, 12);
      c.env.play('buzz', centerW.x, centerW.z, 10);
      c.env.interfere(0.8);
    }

    if (rule.mode === 'gathering' || rule.mode === 'partying') {
      // Close around the balloon holder, sway briefly, then stay in this new circle. The
      // spaced ring leaves walking gaps; the visitor is never held in place.
      for (const [i, m] of members.entries()) {
        if (rule.mode === 'gathering') {
          const dx = m.x - danceAt.x, dz = m.z - danceAt.z, distance = Math.hypot(dx, dz);
          const from = Math.atan2(dx, dz), angle = from + clamp(turnTo(from, danceAngles[i]), -dt * 2.5, dt * 2.5);
          const radius = distance + clamp(PARTY.danceRadius - distance, -res.speed * dt, res.speed * dt);
          // Walk round the holder, not straight through them to a ring slot.
          moveRoomWalker(c, m, clamp(danceAt.x + Math.sin(angle) * radius, -W / 2 + .4, W / 2 - .4),
            clamp(danceAt.z + Math.cos(angle) * radius, -D / 2 + .4, D / 2 - .4), res.speed * dt);
        }
        const dancing = rule.mode === 'partying', want = Math.atan2(danceAt.x - m.x, danceAt.z - m.z);
        m.rot += clamp(turnTo(m.rot, want), -dt * 6, dt * 6);
        m.group.position.set(m.x, dancing ? Math.abs(Math.sin(rule.dancePhase + i)) * .065 : 0, m.z);
        m.group.rotation.y = m.rot;
        m.group.rotation.z = dancing ? Math.sin(rule.dancePhase + i * .6) * .14 : 0;
        m.aimHead(turnTo(m.rot, want), time, dancing ? 'partying' : 'swarming');
        m.light(c.sample(m.x, 1.0, m.z));
      }
    } else if (rule.mode === 'swarming') {
      // Circle breaks: all six rush the visitor
      for (const [i, m] of members.entries()) {
        const dx = me.x - m.x, dz = me.z - m.z, d = Math.hypot(dx, dz) || 0.001;
        // Close from separate angles at arm's reach. Taking a short arc near
        // the visitor avoids walking through their camera to reach a far slot.
        const approach = Math.atan2(-dx, -dz), slot = i / members.length * Math.PI * 2;
        const angle = approach + (d < 1.7 ? clamp(turnTo(approach, slot), -dt * 2.5, dt * 2.5) : 0);
        const radius = Math.max(.55, d - res.speed * dt);
        const nx = clamp(me.x + Math.sin(angle) * radius, -W / 2 + .35, W / 2 - .35);
        const nz = clamp(me.z + Math.cos(angle) * radius, -D / 2 + .35, D / 2 - .35);
        moveRoomWalker(c, m, nx, nz, res.speed * dt);
        const want = Math.atan2(me.x - m.x, me.z - m.z);
        m.rot += clamp(turnTo(m.rot, want), -dt * 9, dt * 9);
        m.group.position.set(m.x, Math.abs(Math.sin(rule.dancePhase + m.idx * 1.3)) * 0.075, m.z);
        m.group.rotation.y = m.rot;
        m.group.rotation.z = Math.sin(rule.dancePhase * 1.5 + m.idx) * 0.09;
        m.aimHead(turnTo(m.rot, want), time, rule.mode);
        m.light(c.sample(m.x, 1.0, m.z));
      }
      if (minDist < 2.6) c.env.interfere(clamp((2.6 - minDist) * 0.28, 0, 0.72));
      if (res.caught) {
        c.env.play('partyhorn', centerW.x, centerW.z, 8);
        c.env.interfere(1);
        // A hit costs a heart; survivors are still chased until they escape or show a balloon.
        if (!known) { known = true; c.met('fun-committee'); }
        const hit = c.hurt(PARTY.hurts, nearest && c.toWorld(nearest.x, nearest.z));
        if (hit.ended) { over = true; return; }
        if (!hit.ended) { rule = releaseParty(rule); if (hit.landed) { c.env.hud.glitch(0.5); c.survived('fun-committee'); } }
      }
    } else {
      // Once welcomed, keep the new circle. Only walk home after the visitor
      // leaves the room, using the same collision-aware movement as pursuit.
      for (const m of members) {
        const tx = m.variant === 'circle' ? ringX + Math.sin(m.baseAngle) * ringR : m.hx;
        const tz = m.variant === 'circle' ? ringZ + Math.cos(m.baseAngle) * ringR : m.hz;
        const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
        if (rule.mode !== 'released' && d > 0.02 && res.speed > 0) {
          moveRoomWalker(c, m, tx, tz, Math.min(d, res.speed * dt));
        }
        const want = rule.mode === 'released' && danceAt ? Math.atan2(danceAt.x - m.x, danceAt.z - m.z) : me.inside && m.variant === 'greeter'
          ? Math.atan2(me.x - m.x, me.z - m.z)
          : (m.variant === 'circle' ? m.baseAngle + Math.PI : m.rot);
        m.rot += clamp(turnTo(m.rot, want), -dt * 4, dt * 4);
        m.group.position.set(m.x, 0, m.z);
        m.group.rotation.y = m.rot;
        m.group.rotation.z = 0;
        const gaze = Math.atan2((me.inside ? me.x : 0) - m.x, (me.inside ? me.z : D / 2) - m.z);
        m.aimHead(turnTo(m.rot, gaze), time, rule.mode);
        m.light(c.sample(m.x, 1.0, m.z));
      }
    }
  });
}
