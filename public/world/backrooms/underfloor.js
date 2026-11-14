import { inRect, underfloorPlan, underfloorHead } from './underfloor-layout.js';
import { buildUnderfloorShell } from './underfloor-shell.js';
import { buildUnderfloorCreature } from './underfloor-creature.js';
import { createShadowState, updateShadow, shadowPose } from './underfloor-shadow-behavior.js';

// A real upstairs inhabitant. Only the holes in the deck give it sight or
// reach into the crawl; the reinforced side pockets remain safe.
export function buildUnderfloor(c) {
  const plan = underfloorPlan(c.W, c.D), shell = buildUnderfloorShell(c, plan);
  const actor = buildUnderfloorCreature(c);
  const state = c.rt.underfloor = {
    plan, shell, actor, shadow: createShadowState(plan), time: 0, started: false,
    step: { active: 0, pressure: 0 }, recoveries: 0, attempts: 0,
    safe: { ...plan.entry }, pending: null,
  };
  let lastFoot = -1;
  const sound = (name, x, z, reach) => {
    const p = c.toWorld(x, z); c.env.play(name, p.x, p.z, reach);
  };
  const render = () => {
    const pose = shadowPose(state.shadow, plan);
    const pressure = pose.pressure;
    state.step = { active: pose.grate, pressure };
    shell.pressureBoards.forEach((o, i) => { o.position.y = i === pose.grate ? -pressure * .16 : 0; });
    actor.update({ ...pose, deckDrop: pressure * .16 });
    (shell.dust || []).forEach((o, i) => {
      o.visible = pressure > .2 && i < 10;
      const fall = (state.time * .9 + i * .19) % 1;
      o.position.set(Math.sin(i * 8.12) * .95, .93 - fall * .85, plan.crossings[pose.grate].z + Math.cos(i * 2.4) * .7);
    });
    state.pose = pose;
  };
  c.rt.headY = (x, z) => underfloorHead(plan, x, z, state.step);
  // Authoring reset also clears a pending grab: no stale delayed warp after
  // moving the preview camera or restarting an encounter.
  state.reset = () => {
    state.shadow = createShadowState(plan); state.started = false; state.time = 0;
    state.pending = null; state.safe = { ...plan.entry }; lastFoot = -1; render();
  };
  state.read = () => ({ time: state.time, started: state.started, phase: state.pose.phase,
    grate: state.pose.grate, attention: state.pose.attention, reach: state.pose.reach,
    recoveries: state.recoveries, attempts: state.attempts, safe: { ...state.safe }, pending: !!state.pending });
  c.rt.onLeave = () => { state.pending = null; };
  c.tick((dt, t, me) => {
    if (!me.inside || me.world.frozen) return;
    if (!state.started && me.z < plan.end + 1) state.started = true;
    if (!state.started) return;
    state.time += dt;
    const shelter = plan.shelters.find(s => inRect(me, s, .3));
    if (shelter) state.safe = { ...shelter.center };
    else if (Math.abs(me.z) > plan.end + .5) state.safe = { x: 0, z: me.z > 0 ? plan.entry.z : plan.exit.z };
    const events = updateShadow(state.shadow, dt, { x: me.x, z: me.z, y: me.world.y - (c.room.y || 0) }, plan);
    for (const e of events) {
      if (e.type === 'notice') { sound('creak', e.x, e.z, 8); sound('rustle', e.x, e.z, 6); }
      if (e.type === 'windup') sound('rattle', e.x, e.z, 7);
      if (e.type === 'reach') { state.attempts++; sound('thunk', e.x, e.z, 7); }
      if (e.type === 'release') sound('shuffle', e.x, e.z, 6);
      if (e.type === 'caught' && !state.pending) {
        // Leave the hand on screen briefly before the recoil. Retreating
        // during the warning/reach can avoid this contact altogether.
        state.pending = { remaining: .28, safe: { ...state.safe } };
        sound('rattle', e.x, e.z, 8);
      }
    }
    render();
    const pose = state.pose;
    if (pose.phase === 'patrol') {
      const foot = Math.floor(pose.stride / Math.PI);
      if (foot !== lastFoot) { lastFoot = foot; sound('shuffle', pose.x, pose.z, 9); sound('creak', pose.x, pose.z, 7); }
    }
    if (pose.attention > .05 && Math.abs(me.x) < .65 && Math.abs(me.z - plan.crossings[pose.grate].z) < .7) {
      c.env.interfere(.07 + pose.attention * .13);
    }
    if (state.pending) {
      me.world.slow = .2; c.env.interfere(.48);
      state.pending.remaining -= dt;
      if (state.pending.remaining <= 0) {
        const hit = c.env.health?.damage(1);
        if (hit && (!hit.ok || hit.dead)) {
          state.pending = null;
          if (!hit.dead) me.world.slow = 1;
          return;
        }
        const safe = c.toWorld(state.pending.safe.x, state.pending.safe.z);
        c.env.player.warp(safe.x, safe.z); me.world.vx = me.world.vz = 0;
        state.recoveries++; state.pending = null;
        c.env.interfere(.65); sound('thunk', me.x, me.z, 8);
      }
    }
  });
  render();
  return state;
}
