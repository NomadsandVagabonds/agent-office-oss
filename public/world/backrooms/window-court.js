// The court is a real perimeter walk, watched by an inhabitant who never hurts
// or traps the visitor. Upper windows are scenic; the two ground routes work.
import * as THREE from 'three';
import { Batch, lin, lamp, ticks, WHITE } from './kit.js';
import { Vox, M } from '../vox/vox.js';
import { buildCharacter, JOINT } from '../avatar/build.js';
import { windowCourtLayout, createWindowCourtBehavior } from './window-court-layout.js';

function inhabitant(c) {
  const look = { species: 'human', skin: '#b3a384', hair: 'short', hairColor: '#45413a', outfit: 'cardigan', outfitColor: '#535c54', accessory: 'none', facial: 'none' };
  const parts = buildCharacter(look, { seed: 'window-court-inhabitant', provider: 'unknown' });
  for (const key of ['legLowerL', 'legLowerR']) parts[key].paint(-8, 0, -4, 8, 3, 7, M('#44483e', 1));
  const material = c.kit.surface({ vox: true, room: c.rt.u });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const combine = (...names) => { const v = new Vox(); for (const name of names) parts[name].each((x, y, z, m) => v.set(x, y, z, m)); return v; };
  const part = (name, make, origin, at, scale) => {
    const group = new THREE.Group(), b = new Batch(true);
    const matrix = new THREE.Matrix4().makeScale(...scale).multiply(new THREE.Matrix4().makeTranslation(-origin[0], -origin[1], -origin[2]));
    b.addVox(c.kit.model(`window-court:inhabitant:${name}:v1`, make).solid, matrix);
    const geometry = c.kit.geometry(b, [lamp(0.3, 3 - at[1], 1, [0.65, 0.65, 0.65], { k: 8, far: 8, wrap: 0.65 })], [0.5, 0.5, 0.5]);
    group.add(new THREE.Mesh(geometry, material)); group.position.set(...at); return group;
  };
  const torso = part('torso', () => parts.torso, JOINT.hips, [0, 0.99, 0], [0.026, 0.045, 0.026]);
  const head = part('head', () => parts.head, JOINT.head, [0, 1.77, 0], [0.03, 0.031, 0.03]);
  const arms = [-1, 1].map(side => part(`arm${side}`, () => combine(side < 0 ? 'armUpperL' : 'armUpperR', side < 0 ? 'armLowerL' : 'armLowerR'), side < 0 ? JOINT.shoulderL : JOINT.shoulderR,
    [side * 0.235, 1.665, 0], [0.026, 0.055, 0.026]));
  const legs = [-1, 1].map(side => part(`leg${side}`, () => combine(side < 0 ? 'legUpperL' : 'legUpperR', side < 0 ? 'legLowerL' : 'legLowerR'), side < 0 ? JOINT.hipL : JOINT.hipR,
    [side * 0.095, 0.99, 0], [0.027, 0.055, 0.027]));
  body.add(torso, ...arms, ...legs); root.add(head); c.add(root);
  return { root, body, head, arms, legs, material };
}

function courtWindow(c, w) {
  const edge = lin('#726f57'), frame = lin('#b4ad86'), curtain = lin(w.lit ? '#d0bd80' : '#716d58');
  const dark = lin(w.lit ? '#2e3027' : '#151c1b'), y0 = w.y - w.h / 2, y1 = w.y + w.h / 2;
  c.wbox(w.side, w.at, w.w + 0.18, y0 - 0.08, y1 + 0.09, 0.025, 0.10, edge);
  c.wbox(w.side, w.at, w.w, y0, y1, 0.10, 0.115, dark);
  const curtains = w.gap ? [[-0.5, -0.1], [0.32, 0.5]] : [[-0.5, 0.5]];
  for (const [a, b] of curtains) for (let x = a * w.w; x < b * w.w; x += 0.07) {
    const k = Math.round(x / 0.07) % 2 ? 0.77 : 1;
    c.wbox(w.side, w.at + x + 0.03, Math.min(0.064, b * w.w - x), y0 + 0.06, y1 - 0.02, 0.116, 0.14, curtain.map(v => v * k));
  }
  if (w.lit) {
    // Light behind the folds, with occasional interior silhouettes. No image
    // or borrowed photograph is used to suggest a room behind the window.
    const glowing = c.shining('court-window-glow', c.kit.tex.white(), 0.8, lin('#e0cd94'));
    const p = c.wallAt(w.side, w.at, 0.151);
    c.board(glowing, p.x, w.y, p.z, w.w - 0.07, w.h - 0.10, p.rot, null, [0.32, 0.31, 0.24]);
    for (let j = 0; j < 5; j++) c.wbox(w.side, w.at - w.w / 2 + 0.12 + j * 0.23, 0.045, y0 + 0.03, y1 - 0.03, 0.155, 0.165, edge);
    if (w.gap) c.wbox(w.side, w.at + 0.08, 0.28, y0 + 0.14, y0 + 0.53, 0.17, 0.19, dark);
  }
  c.wbox(w.side, w.at - w.w / 2, 0.055, y0, y1, 0.17, 0.23, frame);
  c.wbox(w.side, w.at + w.w / 2, 0.055, y0, y1, 0.17, 0.23, frame);
  c.wbox(w.side, w.at, w.w + 0.17, y0 - 0.05, y0 + 0.015, 0.13, 0.31, frame);
  c.wbox(w.side, w.at, w.w + 0.06, y1 - 0.025, y1 + 0.035, 0.17, 0.23, frame);
}

export function buildWindowCourt(c) {
  const plan = windowCourtLayout(c.room), behavior = createWindowCourtBehavior(plan), { pit, shutter } = plan;
  c.shell({ floor: false, panels: false, sockets: false, skirting: false });
  const concrete = lin('#8a896f'), edge = lin('#bbb699'), iron = lin('#4e554b'), dark = lin('#202a28');
  const floor = (x0, z0, x1, z1, y = 0, alb = WHITE) => c.floor.grid([x0, y, z1], [1, 0, 0], [0, 0, -1], ticks(x1 - x0), ticks(z1 - z0), (x, z) => [x / 1.6, z / 1.6], alb);
  floor(-c.W / 2, -c.D / 2, pit.x0, c.D / 2);
  floor(pit.x1, -c.D / 2, c.W / 2, c.D / 2);
  floor(pit.x0, -c.D / 2, pit.x1, pit.z0);
  floor(pit.x0, pit.z1, pit.x1, c.D / 2);
  floor(pit.x0, pit.z0, pit.x1, pit.z1, -1.15, [0.24, 0.28, 0.25]);
  c.flat.box(pit.x0, -1.2, pit.z0, pit.x1, -1.15, pit.z1, dark);
  c.solid(pit.x0, pit.z0, pit.x1, pit.z1, { tall: false, keep: true });
  // Retaining walls and a low continuous rail make the forbidden drop visible.
  for (const side of ['front', 'back', 'left', 'right']) {
    const xSide = side === 'left' || side === 'right', a = xSide ? pit.z0 : pit.x0, b = xSide ? pit.z1 : pit.x1;
    const fixed = side === 'front' ? pit.z1 : side === 'back' ? pit.z0 : side === 'left' ? pit.x0 : pit.x1;
    const slab = (lo, hi, y0, y1, thick, rgb) => xSide ? c.flat.box(fixed - thick / 2, y0, lo, fixed + thick / 2, y1, hi, rgb) : c.flat.box(lo, y0, fixed - thick / 2, hi, y1, fixed + thick / 2, rgb);
    slab(a, b, -1.15, 0.12, 0.20, concrete); slab(a, b, 0.62, 0.68, 0.09, iron);
    for (let at = a + 0.12; at < b; at += 0.85) slab(at, at + 0.045, 0.12, 0.65, 0.06, iron);
  }
  // A few old drains and damp seams give the floor an unoccupied, exterior
  // character even though the tiled ceiling is still far above it.
  for (let z = pit.z0 + 1.8; z < pit.z1; z += 3.2) {
    c.flat.box(-0.34, -1.14, z - 0.23, 0.34, -1.12, z + 0.23, iron);
    for (let x = -0.27; x < 0.3; x += 0.09) c.flat.box(x, -1.11, z - 0.20, x + 0.035, -1.105, z + 0.20, dark);
  }
  for (const side of ['front', 'back', 'left', 'right']) {
    const along = side === 'front' || side === 'back' ? c.W : c.D;
    for (const y of [2.65, 5.3, 7.95, 10.6].filter(y => y < c.H - 0.2)) c.wbox(side, 0, along, y, y + 0.12, 0.01, 0.22, concrete);
    for (let at = -along / 2 + 0.5; at < along / 2; at += 5.3) c.wbox(side, at, 0.16, 0, c.H, 0.01, 0.12, edge.map(v => v * 0.7));
  }
  for (const w of plan.windows) courtWindow(c, w);
  // Deliberately sparse light pools rather than a uniformly lit giant box.
  for (const z of [-c.D / 2 + 2.3, 0, c.D / 2 - 2.3]) for (const sx of [-1, 1]) {
    const x = sx * (c.W / 2 - 0.4);
    c.light(x, 2.5, z, '#e9d8a1', 0.55, { k: 3, far: 12, wrap: 0.45 });
    c.flat.box(x - 0.12, 2.22, z - 0.23, x + 0.12, 2.65, z + 0.23, iron);
    const g = c.shining('court-sconce', c.kit.tex.white(), 1.15, lin('#eeddb0'));
    g.box(x - 0.125, 2.3, z - 0.17, x + 0.125, 2.56, z + 0.17, [0.8, 0.8, 0.7]);
  }
  c.light(0, c.H - 0.5, 0, '#8b9b94', 0.25, { k: 18, far: 32, wrap: 0.2 });

  // A shutter divides only the optional right-hand route. Its windowed
  // transom exposes the continuation before the inhabitant opens it.
  const doorBatch = new Batch();
  for (let y = 0; y < shutter.h; y += 0.105) doorBatch.box(shutter.x0, y, shutter.z0, shutter.x1, y + 0.095, shutter.z1, lin(y % 0.21 < 0.105 ? '#6b7061' : '#777a69'));
  const door = c.dynamic(doorBatch);
  c.flat.box(shutter.x0 - 0.04, 0, shutter.z0 - 0.08, shutter.x0 + 0.10, shutter.h + 0.25, shutter.z1 + 0.08, iron);
  c.solid(shutter.x0 - 0.04, shutter.z0 - 0.08, shutter.x0 + 0.10, shutter.z1 + 0.08, { tall: true, keep: true });
  c.flat.box(shutter.x0, shutter.h, shutter.z0 - 0.04, shutter.x1, shutter.h + 0.25, shutter.z1 + 0.04, iron);
  const gateCollider = c.solid(shutter.x0, shutter.z0, shutter.x1, shutter.z1, { tall: true, keep: true });
  const priorHead = c.rt.headY;
  c.rt.headY = (x, z) => {
    const base = priorHead ? priorHead(x, z) : c.H;
    return x >= shutter.x0 - 0.23 && x <= shutter.x1 + 0.23 && z >= shutter.z0 - 0.23 && z <= shutter.z1 + 0.23 ? Math.min(base, door.position.y) : base;
  };
  const actor = inhabitant(c);
  actor.root.position.set(plan.start.x, 0, plan.start.z); actor.head.rotation.y = Math.PI / 2;
  const state = c.rt.windowCourt = { plan, behavior, actor, door, gateCollider, validation: null,
    read: () => ({ ...behavior.read(), traversable: gateCollider.on === false }) };
  let step = 0, lastPhase = 'mirror';
  c.tick((dt, t, me) => {
    const s = behavior.advance(dt, { inside: me.inside, frozen: me.world.frozen, speed: me.speed, x: me.x, z: me.z });
    actor.root.position.set(s.x, 0, s.z); actor.body.rotation.y = s.yaw;
    // Head orientation is absolute: it keeps facing the same outer wall even
    // as the torso walks parallel to it. No facial expression or attack state.
    actor.head.rotation.y = s.headYaw;
    step += s.moving ? dt * 4.2 : 0;
    const gait = s.moving ? Math.sin(step) * 0.19 : 0;
    actor.legs[0].rotation.x = gait; actor.legs[1].rotation.x = -gait;
    actor.arms[0].rotation.x = -gait * 0.35; actor.arms[1].rotation.x = gait * 0.35;
    actor.arms[1].rotation.z = s.phase === 'hold' || s.phase === 'open' ? -0.55 : 0.035;
    door.position.y = s.gate * 2.9; gateCollider.on = door.position.y < 0.64;
    const tint = c.sample(s.x, 1.4, s.z); actor.material.uniforms.uTint.value.set(...tint);
    if (s.phase !== lastPhase && s.phase === 'open' && me.inside) { const p = c.toWorld(plan.laneX, plan.gateZ); c.env.play('slide', p.x, p.z, 12); }
    lastPhase = s.phase;
  });
  (c.env.ready ||= []).push(() => {
    const walk = c.world.walkable(c.rt), reached = walk.flood(c.room.doors.slice(0, 1));
    const missing = plan.leftRoute.filter(p => !walk.free(p.x, p.z) || !reached[walk.key(p)]);
    state.validation = { reachable: missing.length === 0, missing, windows: plan.windows.length };
    if (missing.length) console.warn('[backrooms] Window Court detour is blocked', missing);
  });
  return state;
}
