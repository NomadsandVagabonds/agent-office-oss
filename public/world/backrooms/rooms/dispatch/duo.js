import { makeFreightFigure } from './figures.js';
import { createFreightBehavior, makeFreightNavigator } from './behavior.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
const turn = (now, to, amount) => now + clamp(angle(to - now), -amount, amount);

/** Two unnamed, harmless office figures. Their attention expires even if watched. */
export function installFreightDuo(c, { home, loading, pickup, bounds }) {
  const behavior = createFreightBehavior();
  const figures = ['jacket', 'dress'].map((kind, i) => {
    const rig = makeFreightFigure(c, kind), side = i === 0 ? -1 : 1;
    rig.group.position.set(home.x + side * 0.32, 0, home.z);
    rig.group.rotation.y = -side * Math.PI / 2;
    c.add(rig.group);
    return { rig, side, path: [], repath: 0, gait: i * 0.5, moving: false, arrived: true, gpuY: rig.heldGPU.position.y, gpuZ: rig.heldGPU.position.z };
  });
  let nav = null;
  const free = (x, z) => {
    if (Math.abs(x) > c.W / 2 - 0.4 || Math.abs(z) > c.D / 2 - 0.4) return false;
    const w = c.toWorld(x, z);
    return c.world.free(w.x, w.z, 0.25) && c.world.headroom(w.x, w.z) >= 1.85 && Math.abs(c.floorAt(x, z)) < 0.02;
  };
  (c.env.ready ||= []).push(() => {
    nav = makeFreightNavigator({ W: c.W, D: c.D, free });
    for (const f of figures) if (!free(f.rig.group.position.x, f.rig.group.position.z)) {
      const p = nav.nearest(f.rig.group.position); if (p) { f.rig.group.position.x = p.x; f.rig.group.position.z = p.z; }
    }
  });
  const oldEnter = c.rt.onEnter, oldLeave = c.rt.onLeave;
  c.rt.onEnter = visits => { oldEnter?.(visits); behavior.notice(); figures.forEach(f => { f.path = []; f.repath = 0; }); };
  c.rt.onLeave = () => { oldLeave?.(); behavior.leave(); figures.forEach(f => { f.path = []; f.repath = 0; }); };

  function move(f, target, speed, dt) {
    const p = f.rig.group.position;
    f.repath -= dt;
    if (Math.hypot(target.x - p.x, target.z - p.z) < 0.12) { f.path = []; f.moving = false; return; }
    if (f.repath <= 0 && nav) { f.path = nav.path(p, target); f.repath = 0.7; }
    const goal = f.path[0];
    if (!goal) { f.moving = false; return; }
    const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), step = Math.min(d, speed * dt);
    const x = p.x + dx / (d || 1) * step, z = p.z + dz / (d || 1) * step;
    if (!free(x, z)) { f.path = []; f.repath = 0; f.moving = false; return; }
    p.x = x; p.z = z; f.moving = step > 0.0001;
    f.rig.group.rotation.y = turn(f.rig.group.rotation.y, Math.atan2(dx, dz), dt * 2.4);
    if (d <= step + 0.02) f.path.shift();
  }

  const debug = { behavior, figures, home, loading, pickup, bounds, read: () => ({ ...behavior.read(),
    actors: figures.map(f => ({ x: f.rig.group.position.x, z: f.rig.group.position.z, yaw: f.rig.group.rotation.y, carrying: f.rig.heldGPU.visible, moving: f.moving })) }) };
  c.rt.dispatchDuo = debug;
  c.tick((dt, t, me) => {
    if (me.world.frozen) return;
    const state = behavior.advance(dt, { arrived: figures.every(f => f.arrived) });
    for (const f of figures) {
      const { rig, side } = f, p = rig.group.position;
      let goal = { x: home.x + side * 0.32, z: home.z }, facing = -side * Math.PI / 2;
      let speed = 0.63, watch = false;
      if (state.attention > 0 && me.inside) {
        watch = true;
        goal = { x: home.x + side * 0.85, z: home.z - 0.35 };
        if (state.phase === 'follow') {
          const dx = me.x - home.x, dz = me.z - home.z, d = Math.hypot(dx, dz), leash = Math.min(6.5, Math.max(0, d - 2.1));
          goal = { x: home.x + dx / (d || 1) * leash + side * 0.4, z: home.z + dz / (d || 1) * leash };
          speed = 0.4;
        } else if (state.phase === 'return') { watch = false; goal = { x: home.x + side * 0.65, z: home.z }; }
        facing = Math.atan2(me.x - p.x, me.z - p.z);
      } else if (['pickup', 'carry', 'load'].includes(state.phase)) {
        const q = state.phase === 'pickup' ? (pickup || home) : loading;
        goal = { x: q.x + side * 0.46, z: q.z };
        facing = q.yaw ?? Math.PI;
      }
      // No interest can pull either figure outside its own room. Following is finite,
      // slow and separated from the player; the normal packing route uses the same grid.
      if (state.phase === 'startled' && state.phaseTime < 0.6) f.moving = false;
      else move(f, goal, speed, dt);
      if (!f.moving || watch) rig.group.rotation.y = turn(rig.group.rotation.y, facing, dt * (watch ? 0.65 : 1.5));
      const close = Math.hypot(p.x - goal.x, p.z - goal.z) < 0.35;
      f.arrived = close;
      const hugging = state.phase === 'embrace' && close;
      const carrying = state.carrying && !watch;
      rig.heldGPU.visible = carrying;
      f.gait += dt * (f.moving ? 5.8 : 1.2);
      const stride = f.moving ? Math.sin(f.gait) * 0.23 : 0;
      const loadingBend = state.phase === 'load' && close ? Math.sin(clamp(state.phaseTime / 4, 0, 1) * Math.PI) : 0;
      rig.heldGPU.position.y = f.gpuY - loadingBend * 0.18;
      rig.heldGPU.position.z = f.gpuZ + loadingBend * 0.14;
      rig.torso.rotation.x = loadingBend * 0.12;
      const arm = hugging ? -1.3 : carrying ? -1.16 : state.afraid > 0.3 ? -0.35 : -loadingBend * 1.1;
      const ease = 1 - Math.exp(-dt * 5);
      rig.leftArm.rotation.x += (arm + (carrying || hugging ? 0 : stride) - rig.leftArm.rotation.x) * ease;
      rig.rightArm.rotation.x += (arm - (carrying || hugging ? 0 : stride) - rig.rightArm.rotation.x) * ease;
      rig.leftArm.rotation.z += ((hugging ? -0.22 : -0.06) - rig.leftArm.rotation.z) * ease;
      rig.rightArm.rotation.z += ((hugging ? 0.22 : 0.06) - rig.rightArm.rotation.z) * ease;
      rig.leftLeg.rotation.x = stride; rig.rightLeg.rotation.x = -stride;
      rig.head.rotation.y = watch ? clamp(angle(facing - rig.group.rotation.y), -0.8, 0.8) : Math.sin(t * 0.21 + side) * 0.035;
      rig.head.rotation.z = state.afraid * side * 0.12;
      rig.head.rotation.x = (hugging ? 0.12 : 0) + loadingBend * 0.15;
      p.y = (f.moving ? Math.abs(Math.sin(f.gait)) * 0.012 : Math.sin(t * 0.7 + side) * 0.003);
      rig.updateLight?.(p.x, p.z);
    }
  });
  return debug;
}
