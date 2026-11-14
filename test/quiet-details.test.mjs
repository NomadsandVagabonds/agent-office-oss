import test from 'node:test';
import assert from 'node:assert/strict';
import { planQuietDetails } from '../public/world/backrooms/quiet-details.js';
import { buildQuietRoom } from '../public/world/backrooms/quiet-room.js';
import { quietMazeLayout } from '../public/world/backrooms/quiet-maze-layout.js';
import * as office from '../public/world/props/office.js';
import { VOXEL } from '../public/world/vox/vox.js';

const EPS = 1e-8;
const near = (a, b) => assert.ok(Math.abs(a - b) < EPS, `${a} != ${b}`);
const box = p => ({ x0: p.x - p.w / 2, z0: p.z - p.d / 2, x1: p.x + p.w / 2, z1: p.z + p.d / 2 });
const overlaps = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;
function rotate(p, turn) {
  for (let i = 0; i < turn; i++) p = { ...p, x: p.z, z: -p.x };
  return p;
}
function room(detail, turn = 0, size = 11.8) {
  const variant = detail === 'sunken' ? 1 : 0, W = size, D = size;
  return { W, D, H: 2.6, doors: [], shape: null, quietStudy: { variant, turn, detail }, pillars: quietMazeLayout({ W, D, variant, turn }).pillars };
}
const solidAt = (plan, x, y, z) => [...plan.basePillars.map(p => ({ ...p, y0: 0, h: 2.6 })), ...plan.fragments].some(p => {
  const b = box(p);
  return x > b.x0 + EPS && x < b.x1 - EPS && z > b.z0 + EPS && z < b.z1 - EPS && y > p.y0 + EPS && y < p.h - EPS;
});

test('apertures remove precisely two rectangles from one wall, across all rotations', () => {
  for (const size of [9.8, 11.8, 13.8]) for (let turn = 0; turn < 4; turn++) {
    const r = room('apertures', turn, size), plan = planQuietDetails(r);
    assert.equal(plan.basePillars.length, 1);
    assert.equal(plan.fragments.length, 6);
    assert.equal(plan.openings.length, 2);
    const reach = size / 2 - 1.5;
    // Independent volume sampling catches a leftover whole wall or a missing
    // sill/lintel. Only the two requested holes may differ from the old wall.
    for (let z = -reach + .037; z < reach - 1.1; z += .071) for (let y = .031; y < 2.6; y += .073) {
      if ([-2.2, -1, .4, 1.6].some(edge => Math.abs(z - edge) < EPS) || [.85, 1.7, 2.3].some(edge => Math.abs(y - edge) < EPS)) continue;
      const p = rotate({ x: -.9, z }, turn);
      const opening = (z > -2.2 && z < -1 && y < .85) || (z > .4 && z < 1.6 && y > 1.7 && y < 2.3);
      assert.equal(solidAt(plan, p.x, y, p.z), !opening, `${size}/${turn}, y${y}, z${z}`);
    }
    const low = rotate({ x: -.9, z: -1.6 }, turn), b = plan.headClearance[0];
    assert.ok(low.x >= b.x0 && low.x <= b.x1 && low.z >= b.z0 && low.z <= b.z1);
    near(b.height, .85);
    near(turn % 2 ? b.z1 - b.z0 : b.x1 - b.x0, .65);
    near(turn % 2 ? b.x1 - b.x0 : b.z1 - b.z0, 1.2);
    assert.ok(!solidAt(plan, low.x, .6, low.z));
    assert.ok(solidAt(plan, low.x, 1.1, low.z));
  }
});

test('sunken desk uses native dimensions, anchors and facing without scaling', () => {
  for (let turn = 0; turn < 4; turn++) {
    const plan = planQuietDetails(room('sunken', turn));
    assert.deepEqual(plan.props.map(p => p.type), ['desk', 'chair', 'crt', 'keyboard', 'mouse']);
    const desk = plan.props[0], chair = plan.props[1];
    near(desk.y, -.4); near(desk.bounds.top, .25); near(chair.bounds.top, .575);
    for (const p of plan.props) {
      const b = office[p.type]().bounds(), corners = [];
      const turns = Math.round(p.rot / (Math.PI / 2));
      for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) corners.push(rotate({ x: x * VOXEL, z: z * VOXEL }, turns));
      near(p.bounds.x0, p.x + Math.min(...corners.map(q => q.x)));
      near(p.bounds.x1, p.x + Math.max(...corners.map(q => q.x)));
      near(p.bounds.z0, p.z + Math.min(...corners.map(q => q.z)));
      near(p.bounds.z1, p.z + Math.max(...corners.map(q => q.z)));
      near(p.bounds.top, p.y + b.y1 * VOXEL);
      assert.equal(p.scale, undefined);
    }
    for (const [type, anchor, flip] of [['crt', office.DESK.monitor, 2], ['keyboard', office.DESK.keyboard, 2], ['mouse', office.DESK.mouse, 0]]) {
      const p = plan.props.find(p => p.type === type), offset = rotate({ x: anchor[0] * VOXEL, z: anchor[2] * VOXEL }, (turn + 1) % 4);
      near(p.x, desk.x + offset.x); near(p.z, desk.z + offset.z);
      near(p.y, desk.y + anchor[1] * VOXEL);
      near(p.rot, ((turn + 1 + flip) % 4) * Math.PI / 2);
      assert.equal(p.host, 'desk');
    }
  }
});

test('sunken furniture clears partitions, door approaches and other unstacked pieces', () => {
  for (const size of [9.8, 11.8, 13.8]) for (let turn = 0; turn < 4; turn++) {
    const r = room('sunken', turn, size), plan = planQuietDetails(r);
    for (const p of plan.props) {
      const b = p.bounds;
      assert.ok(b.x0 > -r.W / 2 && b.x1 < r.W / 2 && b.z0 > -r.D / 2 && b.z1 < r.D / 2);
      for (const wall of plan.basePillars) assert.ok(!overlaps(b, box(wall)), `${p.type} intersects partition`);
      for (const offset of [-2.4, 2.4]) for (const across of [-.6, 0, .6]) for (const inset of [.3, .6, .9, 1.2]) {
        for (const q of [{ x: offset + across, z: -size / 2 + inset }, { x: offset + across, z: size / 2 - inset }, { x: -size / 2 + inset, z: offset + across }, { x: size / 2 - inset, z: offset + across }]) {
          const dx = Math.max(0, b.x0 - q.x, q.x - b.x1), dz = Math.max(0, b.z0 - q.z, q.z - b.z1);
          assert.ok(dx * dx + dz * dz >= .22 ** 2 - EPS, `${size}/${turn}: ${p.type} blocks approach`);
        }
      }
    }
    for (let i = 0; i < plan.props.length; i++) for (const b of plan.props.slice(i + 1)) {
      const a = plan.props[i];
      if (a.id === b.host || b.id === a.host) continue; // deliberate desk-top stack
      assert.ok(!overlaps(a.bounds, b.bounds), `${a.type}/${b.type} overlap`);
    }
  }
});

test('plans are fresh serializable data and leave source room geometry untouched', () => {
  for (const detail of [null, 'apertures', 'sunken']) for (let turn = 0; turn < 4; turn++) {
    const r = room(detail, turn), before = structuredClone(r), plan = planQuietDetails(r);
    assert.deepEqual(r, before);
    assert.deepEqual(plan, planQuietDetails(r));
    assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
    plan.basePillars[0].x = 999;
    assert.deepEqual(r, before);
    if (detail === null) { assert.equal(plan.fragments.length, 0); assert.equal(plan.props.length, 0); assert.equal(plan.headClearance.length, 0); }
  }
});

test('builder leaves crawl floor open, composes headroom and never substitutes crates', () => {
  function context(r, missing = []) {
    const plan = planQuietDetails(r), calls = { pillars: [], solids: [], props: [] };
    return {
      room: r, rt: { headY: () => 2.4 }, calls, shell() {},
      pillar(...a) { calls.pillars.push(a); }, solid(...a) { calls.solids.push(a); },
      hasProp: type => !missing.includes(type), env: { catalogue: { geo: type => !missing.includes(type) && {} } },
      prop(type, x, z, opt) { calls.props.push({ type, x, z, opt }); return { ...plan.props.find(p => p.type === type).bounds }; },
    };
  }
  for (let turn = 0; turn < 4; turn++) {
    const c = context(room('apertures', turn)), state = buildQuietRoom(c), low = state.openings[0];
    near(c.rt.headY(low.x, low.z), .85);
    near(c.rt.headY(4.5, 4.5), 2.4);
    for (const [x0, z0, x1, z1] of c.calls.solids) assert.ok(!(low.x > x0 && low.x < x1 && low.z > z0 && low.z < z1));
    for (const args of c.calls.pillars.slice(state.basePillars.length)) assert.equal(args[4].solid, false);
  }
  const c = context(room('sunken'), ['desk']);
  const state = buildQuietRoom(c);
  assert.deepEqual(c.calls.props.map(p => p.type), ['chair']);
  assert.deepEqual(state.skippedProps, ['desk', 'crt', 'keyboard', 'mouse']);
  const full = context(room('sunken'));
  buildQuietRoom(full);
  assert.equal(full.calls.solids.length, 5, 'the .25m desk still collides');
  for (const p of full.calls.props) { assert.equal(p.opt.solid, false); assert.equal(p.opt.shadow, false); }
});
