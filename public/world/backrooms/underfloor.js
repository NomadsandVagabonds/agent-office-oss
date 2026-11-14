import { Batch, lin, WHITE } from './kit.js';
import { Vox, M } from '../vox/vox.js';
import { UNDERFLOOR, inRect, underfloorPlan, walkerAt, underfloorHead, underfloorRisk } from './underfloor-layout.js';

// Only an ankle and a shoe are ever modelled. The rest belongs to the sound.
function ankle() {
  const v = new Vox(), leather = M('#39382e', 2), sole = M('#282820', 2), cuff = M('#5f6456', 3), seam = M('#777363', 2);
  v.rbox(-9, 0, -15, 9, 3, 20, 2, sole, 'xz');
  v.rbox(-8, 3, -13, 8, 9, 18, 3, leather, 'xz');
  v.box(-6, 8, -10, 6, 55, 5, cuff);
  v.box(-7, 12, -11, 7, 16, 6, seam);
  for (let y = 17; y < 54; y += 5) v.box(-6, y, 5, 6, y + 1, 6, leather);
  for (let z = -6; z < 10; z += 3) v.box(-5, 9, z, 5, 10, z + 1, seam);
  return v;
}

export function buildUnderfloor(c) {
  const plan = underfloorPlan(c.W, c.D), wood = lin('#70604a'), pale = lin('#9c8b69'), dark = lin('#282b23');
  const state = c.rt.underfloor = { plan, time: 0, step: walkerAt(0), started: false, impacts: 0, recoveries: 0,
    safe: { ...plan.entry }, cooldown: 0, exposure: 0 };
  c.shell({ sockets: false });
  const timber = c.kit.tex.custom('underfloor:timber', 64, 64, (g) => {
    g.fillStyle = '#8d795d'; g.fillRect(0, 0, 64, 64);
    const rng = c.R.fork('timber');
    for (let i = 0; i < 180; i++) { g.fillStyle = i % 3 ? '#766448' : '#ac9874'; g.fillRect(rng.int(0, 63), rng.int(0, 63), rng.int(3, 25), 1); }
    for (const x of [3, 58]) { g.fillStyle = '#393a31'; g.fillRect(x, 8, 2, 2); g.fillRect(x, 51, 2, 2); }
  });
  const boards = c.mapped('underfloor:timber', timber);
  const brick = c.mapped('underfloor:piers', c.kit.tex.brick());
  for (const b of plan.solids) {
    brick.box(b.x0, 0, b.z0, b.x1, 1.13, b.z1, lin('#817f69'), { uv: 0.5 });
    c.solid(b.x0, b.z0, b.x1, b.z1, { tall: true, keep: true });
  }
  // Planks are individually edged. Narrow gaps expose the upper room in slivers.
  for (let z = -plan.end; z < plan.end; z += 0.28) {
    const z1 = Math.min(z + 0.255, plan.end), center = (z + z1) / 2;
    if (plan.crossings.some(b => center > b.z0 - 0.1 && center < b.z1 + 0.1)) continue;
    boards.box(-c.W / 2, 0.98, z, c.W / 2, 1.13, z1, WHITE, { uv: 0.8 });
    c.floor.box(-c.W / 2, 1.13, z, c.W / 2, 1.15, z1, WHITE, { uv: 1.6, skip: '-y' });
  }
  const pressureBoards = plan.crossings.map(b => {
    const batch = new Batch();
    for (let z = b.z0 - 0.1; z < b.z1 + 0.1; z += 0.28) {
      const z1 = Math.min(z + 0.255, b.z1 + 0.1);
      if (z > b.z - .65 && z1 < b.z + .5) {
        batch.box(-1.3, .98, z, -.5, 1.13, z1, pale, { uv: .8 });
        batch.box(.5, .98, z, 1.3, 1.13, z1, pale, { uv: .8 });
        for (let x = -.48; x < .5; x += .16) batch.box(x, .99, z, x + .025, 1.02, z1, dark);
      } else batch.box(-1.3, .98, z, 1.3, 1.13, z1, pale, { uv: .8 });
      // Fixed roof above the side alcove, outside the bending patch.
      boards.box(-c.W / 2, .98, z, -1.3, 1.13, z1, WHITE, { uv: .8 });
      boards.box(1.3, .98, z, c.W / 2, 1.13, z1, WHITE, { uv: .8 });
    }
    return c.dynamic(batch, { map: timber });
  });
  // Reinforced shoulders make the refuge pockets visibly different from the unsupported spans.
  for (const s of plan.shelters) {
    for (const z of [s.z0 + .07, s.z1 - .07]) {
      boards.box(s.x0, .86, z - .07, s.x1, 1.08, z + .07, WHITE, { uv: .5 });
      for (const x of [s.x0 + .08, s.x1 - .08]) {
        boards.box(x - .065, 0, z - .065, x + .065, .86, z + .065, WHITE, { uv: .4 });
        c.solid(x - .065, z - .065, x + .065, z + .065, { keep: true });
      }
    }
    c.blot(s.center.x, s.center.z, 1.4, 1.0, { a: .18, rgb: lin('#5d5743') });
  }
  // A torn, lifted carpet lip leads naturally into the crawl without a label.
  c.floor.quad([-1.3, .02, plan.end + .6], [1.3, .02, plan.end + .6], [1.3, .27, plan.end + .21], [-1.3, .27, plan.end + .21], WHITE, [[0,0],[1,0],[1,.4],[0,.4]]);
  for (const z of [plan.end + .1, -plan.end - .1]) {
    boards.box(-1.38, .86, z - .06, 1.38, 1.15, z + .06, WHITE, { uv: .6 });
  }
  // A glimpse of ordinary furniture upstairs establishes what the low roof is.
  if (c.hasProp('chair')) c.prop('chair', 2.3, 5.9, { y: 1.15, rot: .4, solid: false, shadow: false });
  if (c.hasProp('desk')) c.prop('desk', -2.8, -1.7, { y: 1.15, rot: Math.PI / 2, solid: false, shadow: false });
  // A few dim bare bulbs; all light uses the normal baked room system.
  for (const [x, z] of [[-.95, 6.7], [.95, 1.9], [-.95, -3], [0, -7.2]]) {
    c.flat.box(x - .025, .7, z - .025, x + .025, .98, z + .025, dark);
    c.shining('underfloor:bulbs', c.kit.tex.white(), 1.4, lin('#c6b38a')).box(x - .045, .68, z - .045, x + .045, .74, z + .045, WHITE);
    c.light(x, .67, z, '#d7c18d', .16, { far: 3.8, k: 1.2 });
  }
  // The same shoe appears along three load points. Only the active one is shown.
  const feet = plan.crossings.map((b, i) => {
    const batch = new Batch(true);
    c.model('underfloor:ankle:v1', ankle, i % 2 ? .35 : -.35, b.z, { y: 1.15, scale: [1.7, 1.65, 1.7], batch, solid: false, shadow: false });
    const obj = c.dynamic(batch); obj.visible = false; return obj;
  });
  const dust = [];
  for (let i = 0; i < 18; i++) {
    const b = new Batch(); b.box(-.013, 0, -.013, .013, .025, .013, wood);
    dust.push(c.dynamic(b));
  }
  let soundStep = -1, soundImpact = -1;
  const render = () => {
    const step = state.step;
    pressureBoards.forEach((o, i) => { o.position.y = i === step.active && state.started ? -step.pressure * .16 : 0; });
    feet.forEach((o, i) => { o.visible = state.started && i === step.active; o.position.y = step.lift - step.pressure * .16; o.rotation.z = Math.sin(step.phase * 1.1) * .025; });
    dust.forEach((o, i) => {
      o.visible = state.started && (step.warning || step.pressure > 0);
      const fall = (state.time * .8 + i * .19) % 1;
      o.position.set(Math.sin(i * 8.12) * 1.1, .94 - fall * .85, plan.crossings[step.active].z + Math.cos(i * 2.4) * .72);
    });
  };
  c.rt.headY = (x, z) => underfloorHead(plan, x, z, state.step);
  state.setTime = t => { state.time = Math.max(0, t); state.started = true; state.step = walkerAt(state.time); render(); };
  c.tick((dt, t, me) => {
    if (!me.inside || me.world.frozen) return;
    if (!state.started && me.z < plan.end + 1) state.started = true;
    if (!state.started) return;
    state.time += dt; state.cooldown = Math.max(0, state.cooldown - dt); state.step = walkerAt(state.time);
    const step = state.step, crossing = plan.crossings[step.active];
    const where = c.toWorld(0, crossing.z);
    if (step.step !== soundStep) { soundStep = step.step; c.env.play('creak', where.x, where.z, 8); c.env.play('rustle', where.x, where.z, 6); }
    if (step.pressure > .4 && soundImpact !== step.step) { soundImpact = step.step; state.impacts++; c.env.play('thunk', where.x, where.z, 10); c.env.play('rattle', where.x, where.z, 5); }
    const shelter = plan.shelters.find(s => inRect(me, s, .3));
    if (shelter) state.safe = { ...shelter.center };
    else if (Math.abs(me.z) > plan.end + .5) state.safe = { x: 0, z: me.z > 0 ? plan.entry.z : plan.exit.z };
    const risky = underfloorRisk(plan, me.x, me.z, step);
    state.exposure = risky ? state.exposure + dt : 0;
    if (risky) c.env.interfere(.18 + step.pressure * .13);
    if (state.exposure > .24 && state.cooldown === 0) {
      // A close call throws the player into their last reinforced refuge. This
      // prototype never deletes a visit or forces a restart to teach its rule.
      const safe = c.toWorld(state.safe.x, state.safe.z);
      c.env.player.warp(safe.x, safe.z); me.world.vx = me.world.vz = 0;
      state.recoveries++; state.cooldown = 2.5; state.exposure = 0;
      c.env.interfere(.65); c.env.play('thunk', where.x, where.z, 8);
    }
    render();
  });
  render();
  return state;
}
