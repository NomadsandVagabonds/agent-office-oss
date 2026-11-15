// The Safety Corridor ("the safety marshall with the giant scissors"): a long
// safety-striped thoroughfare patrolled by The Floor Warden in a hard-hat and
// neon high-vis vest. Walk past him and he merely watches; press Shift to run
// and he blows his pea-whistle and sprints after you at 3.18 m/s, snipping a
// pair of three-foot chrome office scissors. Keep ahead of him for 6.5 seconds
// — or slam a fire door in his face — and he trips headlong onto his own
// blades, vanishing and leaving a pair of heavy office scissors on the carpet.
import { lin } from '../kit.js';
import { toLocal } from '../gen.js';
import { clamp, turnTo, card, framed, wetSign } from '../bits.js';
import { buildItemProp } from '../hand.js';
import { makeItem, ITEM_DEFS } from '../inventory-state.js';
import { stepWalker, routeToward } from '../denizens.js';
import { furnitureClear } from '../furniture-rules.js';
import { WARDEN, createWardenState, stepWarden, releaseWarden, parryWarden } from './safety-corridor/rule.js';
import { makeFloorWarden, makeFallenHardHat } from './safety-corridor/rig.js';

export function build(c) {
  const { W, D, params: p } = c;
  c.shell();

  // Keep back corners clear for stashed tapes
  c.reserve(-W / 2 + 1.0, -D / 2 + 1.0, 0.65);
  c.reserve(W / 2 - 1.0, -D / 2 + 1.0, 0.65);

  // Yellow safety lane stripes down both sides of the corridor
  const safetyYel = lin('#dfb224'), safetyBlk = lin('#232220');
  for (const sx of [-1, 1]) {
    c.lay(c.flat, sx * (W / 2 - 1.05), 0, 0.08, D - 1.2, 0, null, safetyYel, 0.008);
  }
  for (let z = -D / 2 + 1.4; z <= D / 2 - 1.4; z += 1.6) {
    c.lay(c.flat, 0, z, 0.12, 0.55, 0, null, safetyYel, 0.008);
  }

  // Two kiting pillars down the spine (only where clear of every doorway approach)
  for (const pz of [-D * 0.22, D * 0.22]) {
    if (c.clear(0, pz, 1.35)) {
      c.pillar(0, pz, 0.72, 0.72);
      c.crate(0, pz, 0.76, 0.24, 0.76, 0, safetyYel, { y: 0.95, solid: false, shadow: false });
      c.crate(0, pz, 0.77, 0.08, 0.77, 0, safetyBlk, { y: 1.03, solid: false, shadow: false });
    }
  }

  // Yellow A-frame floor signs warning against running
  for (const [sx, sz] of [[-W / 2 + 0.85, D / 2 - 1.8], [W / 2 - 0.85, -D / 2 + 2.1]]) {
    if (c.clear(sx, sz, 0.45)) {
      wetSign(c, sx, sz, sx < 0 ? 0.35 : -0.35, ['NO RUNNING', 'WALK ONLY']);
      c.reserve(sx, sz, 0.45);
    }
  }

  // Framed safety scoreboard on a free wall
  const signSpot = c.wallSpot(1.7, ['left', 'right', 'back']);
  if (signSpot) {
    const tex = card(c, 'wardensign:' + p.days, [
      'CORRIDOR SAFETY BOARD',
      'ABSOLUTELY NO RUNNING',
      `${p.days} DAYS SINCE SCISSOR MISHAP`,
    ], { w: 204, h: 76, bg: '#f5f0dc', fg: '#1c1d22', edge: '#d98a16', size: 10, pad: 9 });
    framed(c, c.mapped('wardensign', tex), signSpot.side, signSpot.at, 1.54, 1.3, 0.5);
  }

  // Patrol endpoints in world coordinates
  const wpA = c.toWorld(clamp(p.lane * 0.9, -W / 2 + 1.4, W / 2 - 1.4), -D / 2 + 2.0);
  const wpB = c.toWorld(clamp(p.lane * 0.9, -W / 2 + 1.4, W / 2 - 1.4), D / 2 - 2.2);

  const rig = makeFloorWarden(c.kit);
  let rule = createWardenState();
  let patrolToB = true;

  // Knocked-off hard-hat (and fallback scissors prop when visiting without pockets) left where he crashes
  const hatRemnant = makeFallenHardHat(c.kit);
  hatRemnant.visible = false;
  const fallbackScissors = buildItemProp(c.kit, 'scissors');
  fallbackScissors.visible = false;

  function dropWardenScissors(wx, wz, yaw) {
    const hatX = wx - Math.sin(yaw) * 0.28, hatZ = wz - Math.cos(yaw) * 0.28;
    const hatRt = c.world.roomAt(hatX, hatZ);
    const fx = hatRt ? hatX : wx, fz = hatRt ? hatZ : wz;
    if (!hatRemnant.parent) c.world.scene.add(hatRemnant);
    hatRemnant.position.set(fx, c.world.floorY(fx, fz), fz);
    hatRemnant.rotation.y = yaw + 0.5;
    hatRemnant.userData.light(c.world.lightAt(fx, fz, 0.5));
    hatRemnant.visible = true;

    const bladeX = wx + Math.sin(yaw) * 0.24, bladeZ = wz + Math.cos(yaw) * 0.24;
    const physical = c.env.inventory?.physical;
    if (physical) {
      const item = makeItem('scissors', `warden-scissors:${c.rt.id}:${Math.round(wx * 100)}:${Math.round(wz * 100)}`, {
        uses: ITEM_DEFS.scissors.maxUses,
      });
      const tryAt = (px, pz) => {
        const dropRt = c.world.roomAt(px, pz);
        if (!dropRt) return false;
        const loc = toLocal(dropRt.def, px, pz);
        return physical.spawn(item, { room: dropRt.id, x: loc.x, z: loc.z }).ok;
      };
      if (tryAt(bladeX, bladeZ) || tryAt(wx, wz)) return;
      for (const r of [0.2, 0.36, 0.54, 0.74, 0.96, 1.2, 1.45]) {
        for (let k = 0; k < 12; k++) {
          const a = yaw + (k / 12) * Math.PI * 2;
          if (tryAt(wx + Math.sin(a) * r, wz + Math.cos(a) * r)) return;
        }
      }
      const hostRt = c.world.roomAt(wx, wz) || c.rt;
      const walk = c.world.walkable(hostRt), seen = walk.flood(hostRt.def.doors), near = [];
      const targetLoc = toLocal(hostRt.def, wx, wz);
      for (let i = 0; i < seen.length; i++) if (seen[i]) {
        const pt = walk.at(i);
        near.push({ ...pt, d: Math.hypot(pt.x - targetLoc.x, pt.z - targetLoc.z) });
      }
      near.sort((a, b) => a.d - b.d);
      for (const pt of near) if (physical.spawn(item, { room: hostRt.id, x: pt.x, z: pt.z }).ok) return;
      return;
    }

    if (!fallbackScissors.parent) c.world.scene.add(fallbackScissors);
    fallbackScissors.position.set(bladeX, c.world.floorY(bladeX, bladeZ) + 0.01, bladeZ);
    fallbackScissors.rotation.y = yaw - 0.3;
    fallbackScissors.userData.light(c.world.lightAt(bladeX, bladeZ, 0.5));
    fallbackScissors.visible = true;
  }

  let known = false;
  const roamer = c.env.denizens?.add({
    id: 'floor-warden',
    x: wpA.x, z: wpA.z, r: 0.26, tall: 1.45, heading: 0,
    group: rig.group,
    light: (rgb) => rig.light(rgb),
    snipTarget: () => (rule.phase === 'chasing' ? { id: 'floor-warden', r: 0.34, priority: 2 } : false),
    snip() {
      if (rule.phase !== 'chasing') return false;
      rule = parryWarden(rule);
      c.env.play('clack', roamer.x, roamer.z, 9);
      c.survived('floor-warden');
      return { ok: true, target: 'floor-warden' };
    },
    update(dt, time, me) {
      const inRoom = c.world.current() === c.rt;
      const dist = Math.hypot(me.x - roamer.x, me.z - roamer.z);
      const clearLine = c.world.los(roamer.x, roamer.z, me.x, me.z);
      const contactClear = furnitureClear(c.world, roamer.x, roamer.z, me.x, me.z, .035);
      if (!known && dist < 9 && c.env.sees(roamer.x, roamer.z, { radius: 0.5 })) { known = true; c.met('floor-warden'); }

      const nav = rule.phase === 'chasing' ? routeToward(c.world, roamer.x, roamer.z, me.x, me.z, { needsOpenDoor: true }) : null;
      const res = stepWarden(rule, {
        dt,
        dist,
        playerSpeed: me.speed,
        insideRoom: inRoom,
        clearLine,
        contactClear,
        doorBlocked: !!nav?.doorBlocked,
      });
      rule = res.state;

      if (res.blewWhistle) {
        c.env.play('peawhistle', roamer.x, roamer.z, 14);
        c.env.interfere(0.45);
      }
      if (res.snipped) c.env.play('snip', roamer.x, roamer.z, 9);
      if (res.trippedNow) {
        c.survived('floor-warden');                                   // (outrun for as long as it takes: that is getting away from him)
        c.env.play('snip', roamer.x, roamer.z, 10);
        c.env.play('crack', roamer.x, roamer.z, 10);
        c.env.play('thunk', roamer.x, roamer.z, 10);
        c.env.interfere(0.65);
      }
      if (res.despawned) {
        roamer.gone = true;
        c.env.interfere(0.45);
        dropWardenScissors(roamer.x, roamer.z, rig.group.rotation.y);
        return;
      }

      let went = 0;
      if (rule.phase === 'patrol' && res.speed > 0) {
        const goal = patrolToB ? wpB : wpA;
        if (Math.hypot(goal.x - roamer.x, goal.z - roamer.z) < 0.45) patrolToB = !patrolToB;
        const nextGoal = patrolToB ? wpB : wpA;
        went = stepWalker(c.world, roamer, nextGoal.x, nextGoal.z, res.speed * dt);
        if (went < 1e-4) patrolToB = !patrolToB;
        const wantYaw = Math.atan2(nextGoal.x - roamer.x, nextGoal.z - roamer.z);
        rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 5, dt * 5);
      } else if (rule.phase === 'chasing' && res.speed > 0) {
        // (the way is found before the rule is stepped, for the door it may be shut out by; on the moment the chase begins
        // there is none yet, and he does not stand a moment waiting for one)
        const way = nav || routeToward(c.world, roamer.x, roamer.z, me.x, me.z, { needsOpenDoor: true });
        went = stepWalker(c.world, roamer, way.tx, way.tz, res.speed * dt, { closedDoor: way.closedDoor });
        const wantYaw = Math.atan2(way.tx - roamer.x, way.tz - roamer.z);
        rig.group.rotation.y += clamp(turnTo(rig.group.rotation.y, wantYaw), -dt * 9.5, dt * 9.5);
        if (dist < 2.6 && clearLine) c.env.interfere(clamp((2.6 - dist) * 0.25, 0, 0.68));
      }

      rig.pose(time, rule.phase, went / Math.max(dt, 1e-3), res.tripProgress);

      if (res.caught) {
        c.env.play('snip', roamer.x, roamer.z, 8);
        c.env.interfere(1);
        // the scissors: two hearts where there are hearts — and if that was not the last of them, he has made his point and goes back to his rounds
        if (!known) { known = true; c.met('floor-warden'); }
        const hit = c.hurt(WARDEN.hurts);
        if (!hit.ended) { rule = releaseWarden(rule); if (hit.landed) { c.env.hud.glitch(0.6); c.survived('floor-warden'); } }
      }
    },
    dispose() {
      hatRemnant.removeFromParent();
      fallbackScissors.removeFromParent();
    },
  });
}
