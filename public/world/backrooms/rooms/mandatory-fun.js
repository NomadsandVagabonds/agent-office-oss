// Mandatory Fun ("the balloon party"): an HR breakroom decked out in garish
// blue panelling, bunting, and a unattended sheet cake. One Culture Crew
// greeter balances on one leg near the threshold holding a red balloon while
// five more stand hand-in-hand in a ring. Hold a red balloon and they dance
// and honk party horns for you; step past the foyer tape empty-handed and all
// six break ranks to swarm.
import { Vox, M } from '../../vox/vox.js';
import * as THREE from 'three';
import { lin } from '../kit.js';
import { toLocal } from '../gen.js';
import { clamp, turnTo, card, framed } from '../bits.js';
import { placePickup } from '../hand.js';
import { PARTY, createPartyState, stepParty, releaseParty } from './mandatory-fun/rule.js';
import { buildCommitteeMember } from './mandatory-fun/rig.js';
import { roomBody, moveRoomWalker, roomContact } from '../room-physics.js';

function cakeVox() {
  const v = new Vox();
  const plate = M('#e6e2d6', 1), icing = M('#f7f2ea', 1), trim = M('#e36474', 1), candle = M('#6bb4de', 0);
  v.rbox(-8, 0, -6, 8, 1, 6, 1, plate, 'xz');
  v.rbox(-7, 1, -5, 7, 6, 5, 1, icing, 'xz');
  for (let x = -7; x <= 6; x += 2) { v.set(x, 6, 5, trim); v.set(x, 6, -5, trim); }
  for (let z = -5; z <= 4; z += 2) { v.set(-7, 6, z, trim); v.set(7, 6, z, trim); }
  for (const [cx, cz] of [[-3, 0], [0, 0], [3, 0]]) {
    v.box(cx, 6, cz, cx + 1, 9, cz + 1, candle);
    v.set(cx, 9, cz, M('#f4b43a', 0));
  }
  return v;
}

export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell();

  // Keep back corners clear for stashed tapes
  c.reserve(-W / 2 + 1.0, -D / 2 + 1.0, 0.65);
  c.reserve(W / 2 - 1.0, -D / 2 + 1.0, 0.65);

  // Garish corporate party-blue feature panels on free stretches of wall
  const partyBlue = lin('#2e5584'), festRed = lin('#c93030'), festGold = lin('#dfb838');
  for (const side of ['back', 'left', 'right']) {
    for (const [a, b] of c.spans(side, 0.45, 2.1)) {
      if (b - a < 1.5) continue;
      const w = Math.min(b - a - 0.2, 3.6), mid = (a + b) / 2;
      c.wbox(side, mid, w, 0.12, H - 0.18, 0, 0.016, partyBlue);
      // Bunting triangles / colour blocks along top of panel
      const nFlags = Math.floor(w / 0.36);
      for (let i = 0; i < nFlags; i++) {
        const fx = mid - w / 2 + (i + 0.5) * (w / nFlags);
        c.wbox(side, fx, 0.2, H - 0.38, H - 0.22, 0.016, 0.026, i % 2 === 0 ? festRed : festGold);
      }
    }
  }

  // Safe foyer threshold stripe across the front entrance
  const thresholdZ = D / 2 - 2.3;
  c.lay(c.flat, 0, thresholdZ, W - 0.8, 0.07, 0, null, festRed, 0.009);

  // Balloon pickup tied safely on the foyer side of the red line so visitors can take one first
  const pickupSide = -p.greeterSide;
  let placedBalloon = false;
  for (const sx of [pickupSide, -pickupSide, 0]) {
    const bx = clamp(sx * 1.35, -W / 2 + 1.1, W / 2 - 1.1), bz = D / 2 - 1.15;
    if (!c.clear(bx, bz, 0.48)) continue;
    placePickup(c, 'balloon', bx, bz, 0, { label: 'take red balloon' });
    c.reserve(bx, bz, 0.55);
    placedBalloon = true;
    break;
  }
  if (!placedBalloon) placePickup(c, 'balloon', 0, D / 2 - 1.05, 0, { label: 'take red balloon' });

  // Refreshment table with Q3 morale cake off to one side
  const tableSide = pickupSide || 1;
  const tx = tableSide * (W / 2 - 0.95), tz = clamp(0.9, -D / 2 + 2.0, thresholdZ - 0.9);
  if (c.clear(tx, tz, 0.65)) {
    const tbl = c.prop(c.hasProp('cafetable') ? 'cafetable' : 'desk', tx, tz, {
      rot: tableSide > 0 ? -Math.PI / 2 : Math.PI / 2,
      fallback: [0.7, 0.74, 1.15],
    });
    c.model('fun:cake', cakeVox, tx, tz, { y: tbl.top, solid: false, shadow: false });
  }

  // Banner explaining the rule in corporate HR language
  const signSpot = c.wallSpot(1.7, ['back', 'left', 'right']);
  if (signSpot) {
    const tex = card(c, 'funbanner:' + p.occasion, [
      'MANDATORY FUN',
      p.occasion,
      'HOLD YOUR RED BALLOON',
    ], { w: 192, h: 72, bg: '#fff6e4', fg: '#1d222c', edge: '#cf1d1d', size: 11, pad: 10 });
    framed(c, c.mapped('funbanner', tex), signSpot.side, signSpot.at, 1.58, 1.28, 0.48);
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

  let rule = createPartyState(), known = false;

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
    const holdingBalloon = !!c.env.hand?.hasBalloon();
    const pastThreshold = me.inside && me.z < thresholdZ;
    let minDist = Infinity, contactDist = Infinity;
    for (const m of members) {
      const d = Math.hypot(me.x - m.x, me.z - m.z);
      if (d < minDist) minDist = d;
      if (d < PARTY.catchRadius && roomContact(c, m, me)) contactDist = Math.min(contactDist, d);
    }

    if (!known && me.inside && minDist < 9 && members.some((m) => c.seen(m.x, m.z, { radius: 0.5 }))) { known = true; c.met('fun-committee'); }
    const res = stepParty(rule, {
      dt,
      insideRoom: me.inside,
      pastThreshold,
      holdingBalloon,
      minDist,
      contactDist,
    });
    rule = res.state;

    const centerW = c.toWorld(ringX, ringZ);
    if (res.horn) c.env.play('partyhorn', centerW.x, centerW.z, 10);
    if (res.triggeredSwarm) {
      c.env.play('partyhorn', centerW.x, centerW.z, 12);
      c.env.play('buzz', centerW.x, centerW.z, 10);
      c.env.interfere(0.8);
    }

    if (rule.mode === 'partying') {
      // Joyful celebration: the circle revolves hand-in-hand while the greeter bobs and waves
      for (const m of members) {
        if (m.variant === 'circle') {
          const a = m.baseAngle + rule.dancePhase * 0.52;
          moveRoomWalker(c, m, ringX + Math.sin(a) * ringR, ringZ + Math.cos(a) * ringR, PARTY.swarmSpeed * dt);
          m.rot = a + Math.PI;
          m.group.position.set(m.x, Math.abs(Math.sin(rule.dancePhase * 1.8 + m.idx)) * 0.085, m.z);
          m.group.rotation.y = m.rot;
          m.group.rotation.z = Math.sin(rule.dancePhase + m.idx * 1.2) * 0.11;
        } else {
          moveRoomWalker(c, m, m.hx, m.hz, PARTY.returnSpeed * dt);
          m.group.position.set(m.x, Math.abs(Math.sin(rule.dancePhase * 1.8)) * 0.09, m.z);
          const want = Math.atan2(me.x - m.x, me.z - m.z);
          m.rot += clamp(turnTo(m.rot, want), -dt * 4, dt * 4);
          m.group.rotation.y = m.rot;
          m.group.rotation.z = Math.sin(rule.dancePhase * 1.4) * 0.13;
        }
        m.aimHead(turnTo(m.rot, Math.atan2(me.x - m.x, me.z - m.z)), time, rule.mode);
        m.light(c.sample(m.x, 1.0, m.z));
      }
    } else if (rule.mode === 'swarming') {
      // Circle breaks: all six rush the visitor
      for (const m of members) {
        const dx = me.x - m.x, dz = me.z - m.z, d = Math.hypot(dx, dz) || 0.001;
        const step = Math.min(d, res.speed * dt);
        const nx = clamp(m.x + (dx / d) * step, -W / 2 + 0.35, W / 2 - 0.35);
        const nz = clamp(m.z + (dz / d) * step, -D / 2 + 0.35, D / 2 - 0.35);
        moveRoomWalker(c, m, nx, nz, step);
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
        // made to join in: a heart where there are hearts — and if that was not the last, they form up again and leave you be a while
        if (!known) { known = true; c.met('fun-committee'); }
        const hit = c.hurt(PARTY.hurts);
        if (hit.ended) { over = true; return; }
        if (!hit.ended) { rule = releaseParty(rule); if (hit.landed) { c.env.hud.glitch(0.5); c.survived('fun-committee'); } }
      }
    } else {
      // Idle or resetting: bodies hold the circle while every neck twists toward the threshold/visitor
      for (const m of members) {
        const tx = m.variant === 'circle' ? ringX + Math.sin(m.baseAngle) * ringR : m.hx;
        const tz = m.variant === 'circle' ? ringZ + Math.cos(m.baseAngle) * ringR : m.hz;
        const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz);
        if (d > 0.02 && res.speed > 0) {
          moveRoomWalker(c, m, tx, tz, Math.min(d, res.speed * dt));
        }
        const want = me.inside && m.variant === 'greeter'
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
