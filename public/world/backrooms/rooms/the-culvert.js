// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Gap
// ("the part of the lawn that was never drawn"; its id is still `the-culvert`,
// which is what it was). A lawn, and down the middle of it a strip that
// whoever made this place forgot: no grass, no floor, no bottom, the edge of
// it broken off square by square, wide in most places and in two places
// narrow. The squares next to it never got their grass either. It is a real
// hole (rt.floorY) and nothing is in the way of it: whoever walks to the
// very edge goes in, and that is the end of the visit.
//
// Something lives on the bank the visitor comes in on: flesh, slung between
// six telephone poles it walks on. Until it is woken it is a stand of poles
// in the corner. It cannot cross the gap. It can cross a bridge.
//
// The way over: the hoardings stood near the narrow places are loose
// (movable-cutout.js: E to take hold, R to let one down), and a tall one let
// down across a narrow place is a bridge, for anybody. So: over, and then
// the bridge up again before it has come after. One that is taken up from
// under it, and it goes where everything else here goes. (The owner: "take a
// cutout, go across before they are torn apart and remove it before the
// creature comes over… trapping it on the other side. High suspense!")
//
// The side doorways are on opposite banks, so the way on may be across.
// Every flat in this room is the loose kind: none goes over when leant on.
import * as THREE from 'three';
import { ticks, Batch, lamp } from '../kit.js';
import { Vox, M } from '../../vox/vox.js';
import { P } from '../bits.js';
import { lawn, daylight, sheet } from '../suburb.js';
import { movableCutout } from '../movable-cutout.js';

// slab: the gap is made of strips this deep · neck: how wide it is where it can be bridged · deep: how far down, to whoever walks
// brink: how close to the edge the lawn gives way · falls: seconds of going down · panel: a tall hoarding · redraw: seconds stranded before one is drawn again
export const GAP = Object.freeze({ slab: 0.5, neck: 2.0, deep: 40, seen: 12, brink: 0.25, falls: 1.7, panel: 3.1, redraw: 5 });
// the resident. wake: how near wakes it · late: or this long in the room · speed, and on a bridge · reach, and how long between
// two of those · stun: how long it stands after one · pole: a leg · spread: how far out it puts its feet · high: its body off the floor
export const LINES = Object.freeze({ wake: 7.5, late: 16, speed: 2.3, onBridge: 1.25, reach: 1.55, again: 1.7, stun: 1.0, pole: 3.3, spread: 2.2, high: 1.75, stride: 1.15, step: 0.24, legs: 6 });
const S = 0.03;

/**
 * Where the gap is, strip by strip from the back wall: [from, to] in x. Narrow and straight at two necks, anything between.
 * It keeps clear of the side doorways (at z = 0) and comes to the front wall well to one side of the doorway there (side).
 */
export function gapOf(W, D, side, R) {
  const n = Math.round(D / GAP.slab), sl = D / n, snap = (v) => Math.round(v * 2) / 2, lim = W / 2 - 2.6;
  const necks = [-D / 4 + R.range(-0.4, 0.4), D / 4 + R.range(-0.6, 0.2)], from = R.range(-1.5, 1.5), wob = [];
  let w = 0; for (let j = 0; j < n; j++) { w = Math.max(-1, Math.min(1, w + R.pick([-0.5, 0, 0, 0.5]))); wob.push(w); }
  const mid = (z) => { const t = (z + D / 2) / D, k = t * t * (3 - 2 * t); return from + (3.4 - from) * k; };
  const out = [];
  for (let j = 0; j < n; j++) {
    const z = -D / 2 + (j + 0.5) * sl, neck = necks.find((q) => Math.abs(z - q) < 1.45);
    const wide = neck !== undefined ? GAP.neck : R.pick([3, 3.5, 4, 4.5, 5]), c0 = neck !== undefined ? snap(mid(neck)) : snap(mid(z) + wob[j]);
    let a = Math.max(-lim, snap(c0 - wide / 2)), b = a + wide; if (b > lim) { b = lim; a = Math.min(a, b - GAP.neck); }
    out.push(side > 0 ? [a, b] : [-b, -a]);
  }
  return { strips: out, sl, n, necks, at: (z) => out[Math.max(0, Math.min(n - 1, Math.floor((z + D / 2) / sl)))] };
}

/** What it is slung from them: a body of flesh the size of a car bonnet, with what it has grown round still in it. */
function bodyVox() {
  const v = new Vox(), raw = ['#b4756a', '#a5645b', '#c48a7d', '#8f5148'].map((k) => M(k, 2)), bruise = M('#5e3540', 2), wood = M('#4a3626', 3), glass = M('#9fc7c2', 0), wire = M('#17171a', 0);
  const skin = (x, y, z) => { const h = Math.sin(x * 0.61 + y * 1.3) + Math.sin(z * 0.83 - y * 0.7) + Math.sin((x + z) * 0.37); return h > 1.5 ? bruise : raw[Math.abs(Math.floor(h * 1.4 + 8)) % 4]; };
  v.ellipsoid(0, 0, 0, 24, 15, 19, skin); v.ellipsoid(-13, 7, 5, 12, 10, 11, skin); v.ellipsoid(12, 8, -6, 13, 9, 12, skin); v.ellipsoid(3, -10, 2, 15, 9, 13, skin); v.ellipsoid(-6, 12, -9, 8, 7, 8, skin);
  // a crossarm it grew round, insulators and all, and another through the back of it
  v.box(-34, 6, -2, 34, 9, 1, wood); for (const x of [-31, -22, 22, 31]) { v.cyl('y', x, -0.5, 9, 13, 1.6, glass); v.cyl('y', x, -0.5, 13, 14, 2.2, glass); }
  v.box(-3, 10, -30, 0, 13, 28, wood); for (const z of [-27, 25]) v.cyl('y', -1.5, z, 13, 17, 1.6, glass);
  // the line, still on it: down, and trailing
  for (const [x, z, n] of [[-31, 0, 30], [31, 0, 22], [-1, -27, 34], [-1, 25, 18], [14, 12, 26]]) v.tube(x, 6, z, x + (x > 0 ? 3 : -3), 6 - n, z + 2, 0.7, wire);
  // underneath, where it opens: lengthways, and too many teeth
  for (let x = -14; x <= 14; x++) { const g = Math.round(3.2 - Math.abs(x) * 0.2); v.carve(x, -19, -g, x, -13, g); if (x % 2 === 0) { v.box(x, -15, -g, x, -13, -g, M('#efe7d2', 0)); v.box(x, -15, g, x, -13, g, M('#efe7d2', 0)); } }
  v.ellipsoid(0, -12, 0, 13, 2, 3, M('#3a1418', 0));
  return v;
}
/** A leg: a telephone pole, foot at the bottom, its two crossarms at the top, where the knee is. Along +y. */
function poleVox() {
  const v = new Vox(), n = Math.round(LINES.pole / S), wood = M('#4a3626', 3), dark = M('#35261b', 3), glass = M('#9fc7c2', 0), raw = M('#a5645b', 2);
  v.cyl('y', 0, 0, 0, n, 2.6, (x, y) => ((x * 7 + y) % 11 < 2 ? dark : wood), 2.1);
  for (const [y, half] of [[n - 9, 17], [n - 22, 13]]) { v.box(-half, y, -1, half, y + 3, 1.5, wood); for (const x of [-half + 2, -half + 9, half - 9, half - 2]) { v.cyl('y', x, 0.3, y + 3, y + 6, 1.4, glass); v.cyl('y', x, 0.3, y + 6, y + 7, 2, glass); } v.tube(-half + 4, y, 0, 0, y - 8, 0, 0.6, wood); v.tube(half - 4, y, 0, 0, y - 8, 0, 0.6, wood); }
  v.ellipsoid(0, n - 2, 0, 4.5, 5, 4.5, raw); v.cyl('y', 0, 0, 0, 5, 3.4, dark, 2.6);                  // where it is joined on; and a foot worn round
  for (let y = 12; y < n - 30; y += 9) v.box(2, y, -0.5, 4, y + 1, 0.5, M('#8d949c', 0));              // the rungs somebody used to climb
  return v;
}
/** What holds a leg on: a rope of the same flesh, a metre of it (it is stretched to fit). Along +y. */
function sinewVox() { const v = new Vox(), n = Math.round(1 / S); v.cyl('y', 0, 0, 0, n, 2.4, (x, y) => M(['#a5645b', '#8f5148', '#b4756a'][(y >> 2) % 3], 2), 3.2); v.tube(1.5, 0, 0, -1.5, n, 1, 0.8, M('#17171a', 0)); return v; }

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = GAP, s = p.side;
  const gap = gapOf(W, D, s, R), { sl, n } = gap;
  c.shell({ floor: false, panels: false });
  daylight(c, 3, 3, 1, 1);
  // the hole, as whoever walks here has it. (While somebody is going down it, the whole room is as deep as they have got: cubicle-grid's way.)
  let fall = null;
  const inGap = (x, z) => { if (Math.abs(z) >= D / 2) return false; const [a, b] = gap.at(z); return x > a && x < b; };
  c.rt.floorY = (x, z) => (fall ? fall.y : inGap(x, z) ? -K.deep : 0);
  c.rt.headY = (x, z) => H - c.rt.floorY(x, z);

  /* the lawn, either side; the squares along the break, which never got their grass; under all of it, nothing */
  const turf = c.floor, grey = [[0.66, 0.67, 0.7], [0.5, 0.51, 0.55]];
  const grass = (x0, x1, z0) => { if (x1 - x0 > 0.01) turf.grid([x0, 0, z0], [0, 0, 1], [1, 0, 0], ticks(sl, sl, 0), ticks(x1 - x0), (u, v) => [(x0 + v + c.room.cx) / 1.6, (z0 + u + c.room.cz) / 1.6]); };
  const blank = (x, z0, j) => { const k = (Math.round(x * 2) + j) & 1; c.flat.box(x, -0.012, z0, x + 0.5, 0.004, z0 + sl, grey[k], { skip: '-y' }); };
  gap.strips.forEach(([a, b], j) => {
    const z0 = -D / 2 + j * sl, pa = j ? gap.strips[j - 1] : [a, b], nx = j < n - 1 ? gap.strips[j + 1] : [a, b];
    const la = Math.min(a, pa[0], nx[0]) - 0.5, rb = Math.max(b, pa[1], nx[1]) + 0.5;                    // (a square is blank if the break is beside it or in front of it)
    grass(-W / 2, la, z0); grass(rb, W / 2, z0);
    for (let x = la; x < a - 0.01; x += 0.5) blank(x, z0, j); for (let x = b; x < rb - 0.01; x += 0.5) blank(x, z0, j);
  });
  { // under the lawn: a box with nothing in it, black. The lawn is as thick as a sheet of paper from in there, and it shows.
    const dark = c.mapped('gap:void', kit.tex.custom('gap:void', 4, 4, (g) => P(g, '#000', 0, 0, 4, 4))), k = [0, 0, 0], y = -K.seen, x = W / 2, z = D / 2;
    sheet(dark, [-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z], 1, 1, null, k);
    sheet(dark, [-x, y, -z], [x, y, -z], [x, 0, -z], [-x, 0, -z], 1, 1, null, k); sheet(dark, [x, y, z], [-x, y, z], [-x, 0, z], [x, 0, z], 1, 1, null, k);
    sheet(dark, [-x, y, z], [-x, y, -z], [-x, 0, -z], [-x, 0, z], 1, 1, null, k); sheet(dark, [x, y, -z], [x, y, z], [x, 0, z], [x, 0, -z], 1, 1, null, k);
  }
  // squares that came away, and have not finished falling: some grey, some with their grass
  for (let i = 0; i < 16; i++) {
    const j = R.int(1, n - 2), [a, b] = gap.strips[j]; if (b - a < 2.6) continue;
    const x = a + 0.5 * R.int(1, Math.round((b - a) / 0.5) - 2), z0 = -D / 2 + j * sl, y = -R.range(0.12, 3.2), q = 0.5 - R.range(0, 0.12);
    c.flat.box(x, y - 0.016, z0, x + q, y, z0 + q, R.chance(0.35) ? [0.3, 0.52, 0.26] : grey[i & 1]);
  }
  lawn(c, { wrong: 0, paint: 'corn', width: 0.4, cloudTop: H - 0.7, neighbour: 0, border: false });

  /* the hoardings, at the necks: a tall one on either bank at each, stood back so that it has to be carried up; and one sawn short */
  // (eitherEnd: one that is down may be taken up from the far end of it too, and stands up where it stood: across the gap from whoever did it)
  const back = 1.1, edge = 0.5, talls = [], spots = { '-1': [], 1: [] };
  gap.necks.forEach((zn, i) => {
    const [a, b] = gap.at(zn);
    for (const [side, x0, facing, front] of [[-1, a, 1, i ? 'streetB' : 'streetC'], [1, b, 3, i ? 'streetC' : 'streetB']]) {
      const x = x0 + side * back, z = zn + side * (i ? 0.2 : -0.2);
      const it = movableCutout(c, { x, z, height: K.panel, facing, front, label: 'Hoarding', eitherEnd: true });
      if (it) { c.bridgeRoute(it, { stand: { x: x + side * 0.75, z }, path: [{ x: x0 + side * edge, z }] }); talls.push(it); spots[side].push({ x, z }); }
    }
  });
  { const [a] = gap.at(gap.necks[1]); movableCutout(c, { x: a - s * 0.0 - 2.4, z: gap.necks[1] + 1.6, height: 1.3, facing: 1, front: 'streetA', label: 'Hoarding, sawn short' }); }
  // what is over there
  c.leave('opener', s * (W / 2 - 2.0), -D / 2 + 2.0, { y: 0 });

  /* the resident */
  const L = LINES, env = c.env, UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  const mat = kit.surface({ vox: true }), fig = new THREE.Group();
  const meshOf = (key, make) => { const q = new Batch(true); q.addVox(kit.model(key, make).solid, new THREE.Matrix4().makeScale(S, S, S)); return kit.geometry(q, [lamp(0.6, 3.2, 1.4, [1.1, 1.1, 1.05], { k: 9, wrap: 0.45, far: 40 })], [0.5, 0.5, 0.5]); };
  const body = new THREE.Mesh(meshOf('gap:body', bodyVox), mat), poleGeo = meshOf('gap:pole', poleVox), sinewGeo = meshOf('gap:sinew', sinewVox);
  fig.add(body); fig.userData.light = (rgb) => mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  const home = { x: -s * (W / 2 - 1.9), z: -D / 2 + 2.2 };
  const it = { x: home.x, z: home.z, y: 0.55, rot: R.range(0, 6.28), state: 'asleep', t: 0, wait: 0, again: 0, inside: 0, up: 0, via: null, stage: 0, drop: 0 };
  const legs = Array.from({ length: L.legs }, (_, i) => {
    const a = (i < 3 ? 1 : -1) * (0.55 + (i % 3) * 1.02), pole = new THREE.Mesh(poleGeo, mat), sinew = new THREE.Mesh(sinewGeo, mat); fig.add(pole, sinew);
    return { a, pole, sinew, x: it.x + Math.sin(it.rot + a) * 0.75, z: it.z + Math.cos(it.rot + a) * 0.75, fx: 0, fz: 0, tx: 0, tz: 0, k: 1, lift: 0 };
  });
  c.add(fig); c.reserve(home.x, home.z, 1.6);
  c.rt.lines = it;                                                              // (for whoever is looking: where it is and what it is doing)
  const open = (x, z) => { const q = c.toWorld(x, z); return env.world.floorY(q.x, q.z) < -1; };
  const bankOf = (x, z) => { const [a, b] = gap.at(z); return x <= a ? -1 : x >= b ? 1 : 0; };
  const ok = (x, z) => Math.abs(x) < W / 2 - 0.9 && Math.abs(z) < D / 2 - 0.9 && !open(x, z);
  /** The hoardings that are down, as this room has them: { x0, x1, z } — the two ends, and where across. */
  const bridges = () => (env.world.furniture || []).filter((f) => f.authored && f.room === c.rt.id && f.bridge && f.deployed && !f.transition && !f.away).map((f) => {
    const q0 = c.toLocal(f.collider.x0, f.collider.z0), q1 = c.toLocal(f.collider.x1, f.collider.z1); return { x0: Math.min(q0.x, q1.x), x1: Math.max(q0.x, q1.x), z: (q0.z + q1.z) / 2 };
  });
  const pose = (dt, moving) => {
    const up = it.up, spread = 0.75 + (L.spread - 0.75) * up, lead = moving ? 0.55 : 0;
    it.y = 0.55 + (L.high - 0.55) * up + (up > 0.9 ? Math.sin(it.t * 2.1) * 0.05 : 0) - it.drop;
    let stepping = legs.filter((l) => l.k < 1).length;
    legs.forEach((l, i) => {
      const rx = it.x + Math.sin(it.rot + l.a) * spread + Math.sin(it.rot) * lead, rz = it.z + Math.cos(it.rot + l.a) * spread + Math.cos(it.rot) * lead;
      if (l.k >= 1 && stepping < 3 && Math.hypot(rx - l.x, rz - l.z) > (up < 1 ? 0.2 : L.stride) && !it.drop) { l.fx = l.x; l.fz = l.z; l.tx = rx; l.tz = rz; l.k = 0; stepping++; }
      if (l.k < 1) {
        l.k = Math.min(1, l.k + dt / L.step); l.x = l.fx + (l.tx - l.fx) * l.k; l.z = l.fz + (l.tz - l.fz) * l.k; l.lift = Math.sin(l.k * Math.PI) * 0.55;
        if (l.k >= 1 && up >= 1 && i % 2 === 0) { const w = c.toWorld(l.x, l.z); env.play?.('thunk', w.x, w.z, 14); }
      }
      if (it.drop) { l.x += (it.x - l.x) * dt * 0.8; l.z += (it.z - l.z) * dt * 0.8; }
      const fy = l.lift - it.drop * (0.7 + 0.1 * i), dx = (it.x - l.x) * 0.3, dz = (it.z - l.z) * 0.3, flat = Math.hypot(dx, dz), ky = Math.sqrt(Math.max(0.2, L.pole * L.pole - flat * flat));
      l.pole.position.set(l.x, fy, l.z); dir.set(dx, ky, dz).normalize(); l.pole.quaternion.setFromUnitVectors(UP, dir);
      const kx = l.x + dx, kz = l.z + dz, kyy = fy + ky, hx = it.x + Math.sin(it.rot + l.a) * 0.45, hz = it.z + Math.cos(it.rot + l.a) * 0.45;
      dir.set(hx - kx, it.y + 0.2 - kyy, hz - kz); const len = dir.length(); l.sinew.position.set(kx, kyy, kz); l.sinew.quaternion.setFromUnitVectors(UP, dir.normalize()); l.sinew.scale.set(1, len, 1);
    });
    body.position.set(it.x, it.y, it.z); body.rotation.set(Math.sin(it.t * 1.3) * 0.05 * up, it.rot, Math.sin(it.t * 0.9) * 0.06 * up);
  };
  pose(0, false);
  // the last picture, if it was this that ended the visit: from the lawn beside it, looking up at what it is slung from
  c.rt.films = (shot) => {
    for (const a of [0.9, -0.9, 2.4, -2.4]) { const x = it.x + Math.sin(it.rot + a) * 4.2, z = it.z + Math.cos(it.rot + a) * 4.2; if (ok(x, z)) { const q = c.toWorld(x, z), at = c.toWorld(it.x, it.z); return { x: q.x, y: shot.y + 0.7, z: q.z, at: { x: at.x, y: shot.y + it.y, z: at.z } }; } }
    return null;
  };
  // Nobody is left on a bank with no way off it. A hoarding that has been carried off, or stood up on the wrong side, is drawn
  // again where one was first drawn, on the bank of whoever needs it: the room forgets things, and it forgets that it forgot.
  let stuck = 0;
  const redraw = (dt, me) => {
    const bank = bankOf(me.x, me.z); if (!bank || bridges().length) { stuck = 0; return; }
    const free = talls.filter((f) => !f.away && !f.deployed && !f.transition && !f.carried), here = free.some((f) => { const q = c.toLocal(f.x, f.z); return f.room === c.rt.id && Math.abs(q.x) < W / 2 && Math.abs(q.z) < D / 2 && bankOf(q.x, q.z) === bank; });
    if (here || talls.some((f) => f.carried)) { stuck = 0; return; }
    if ((stuck += dt) < GAP.redraw) return;
    stuck = 0;
    for (const f of free) for (const sp of spots[bank]) { const q = c.toWorld(sp.x, sp.z); if (env.barricades?.place?.(f, q.x, q.z)) { env.interfere?.(0.7); env.play?.('rattle', q.x, q.z, 10); return; } }
  };
  /** A step toward (gx, gz) at speed v, sliding along what it cannot go through. → whether it moved. */
  const go = (gx, gz, v, dt) => {
    const dx = gx - it.x, dz = gz - it.z, d = Math.hypot(dx, dz); if (d < 0.05) return false;
    const st = Math.min(d, v * dt), mx = (dx / d) * st, mz = (dz / d) * st, want = Math.atan2(dx, dz);
    let da = want - it.rot; da = Math.atan2(Math.sin(da), Math.cos(da)); it.rot += da * Math.min(1, dt * 3.2);
    if (ok(it.x + mx, it.z + mz)) { it.x += mx; it.z += mz; return true; }
    if (Math.abs(mz) > 1e-4 && ok(it.x, it.z + Math.sign(mz) * st)) { it.z += Math.sign(mz) * st; return true; }
    if (Math.abs(mx) > 1e-4 && ok(it.x + Math.sign(mx) * st, it.z)) { it.x += Math.sign(mx) * st; return true; }
    return false;
  };

  c.tick((dt, t, me) => {
    it.t += dt;
    /* the visitor, going in */
    if (fall) {
      fall.t += dt; fall.y = Math.max(-80, -0.5 * 9.8 * fall.t * fall.t);
      const q = c.toWorld(fall.x, fall.z); env.player?.warp?.(q.x, q.z);
      const eye = env.player?.me; if (eye) eye.pitch = Math.min(0.95, eye.pitch + dt * 1.3);          // the strip of ceiling, getting narrower
      env.red?.(Math.min(0.9, fall.t * 0.5)); env.interfere?.(0.3 + 0.5 * Math.min(1, fall.t / K.falls));
      if (fall.t >= K.falls && !fall.over) { fall.over = true; env.hold?.(false); env.end?.('caught'); if (env.difficulty?.() === 'tourist') fall = null; }
      pose(dt, false); return;
    }
    const playing = me.inside && !env.player?.me?.frozen;
    // the lawn ends where it ends: within a step of the break with nothing let down there, and it is not there to stand on.
    // (The floor as the building has it now is what counts: a hoarding that is down is floor, and has an edge either side.)
    if (playing) for (let a = 0; a < 8; a++) if (open(me.x + Math.sin(a * 0.7854) * K.brink, me.z + Math.cos(a * 0.7854) * K.brink)) {
      const [ga, gb] = gap.at(me.z); fall = { x: Math.max(ga + 0.4, Math.min(gb - 0.4, me.x)), z: me.z, y: 0, t: 0 }; env.hold?.(true); env.run?.met?.('the-culvert');
      const q = c.toWorld(me.x, me.z); env.play?.('rattle', q.x, q.z, 6); pose(dt, false); return;
    }

    if (playing) redraw(dt, me);

    /* the resident */
    if (it.state === 'gone') return;
    if (it.state === 'falling') {
      it.wait += dt; it.drop = 0.5 * 9.8 * it.wait * it.wait; it.rot += dt * 0.9; pose(dt, false);
      if (it.drop > K.seen + 6) { it.state = 'gone'; fig.visible = false; env.run?.survived?.('the-lines'); }
      return;
    }
    const d = Math.hypot(me.x - it.x, me.z - it.z);
    if (it.state === 'asleep') {
      if (me.inside) it.inside += dt;
      const carrying = (env.world.furniture || []).some((f) => f.carried && f.room === c.rt.id);
      if (playing && (d < L.wake || it.inside > L.late || (carrying && it.inside > 1))) { it.state = 'rising'; env.run?.met?.('the-lines'); const w = c.toWorld(it.x, it.z); env.play?.('rattle', w.x, w.z, 18); env.interfere?.(0.35); }
      pose(dt, false); return;
    }
    if (it.state === 'rising') { it.up = Math.min(1, it.up + dt / 1.5); if (it.up >= 1) it.state = 'hunt'; pose(dt, false); return; }
    if (open(it.x, it.z)) { it.state = 'falling'; it.wait = 0; const w = c.toWorld(it.x, it.z); env.play?.('rattle', w.x, w.z, 20); env.interfere?.(0.6); pose(dt, false); return; }   // the bridge, taken up from under it
    it.again = Math.max(0, it.again - dt);
    if (it.wait > 0) { it.wait -= dt; pose(dt, false); return; }
    if (!me.inside) { pose(dt, false); return; }                                                           // (it does not leave the room, and does not go home)
    const mine = bankOf(it.x, it.z), theirs = bankOf(me.x, me.z), onBridge = mine === 0;
    let gx = me.x, gz = me.z;
    if (mine !== 0 && theirs !== 0 && mine !== theirs) {
      // the nearest hoarding that is down: to this end of it, then over. With none: along the edge, level with them
      const all = bridges().sort((q, r) => Math.abs(q.z - it.z) - Math.abs(r.z - it.z)), br = all[0];
      if (br) { const near = mine < 0 ? br.x0 + 0.2 : br.x1 - 0.2; if (Math.abs(it.z - br.z) > 0.25 && Math.abs(it.x - near) > 0.3) { gx = near; gz = br.z; } else { gx = mine < 0 ? br.x1 + 0.6 : br.x0 - 0.6; gz = br.z; } }
      else { const [a, b] = gap.at(me.z); gx = mine < 0 ? a - 1.5 : b + 1.5; gz = me.z; }
    } else if (onBridge && theirs !== 0) { const br = bridges().sort((q, r) => Math.abs(q.z - it.z) - Math.abs(r.z - it.z))[0]; if (br) { gz = br.z; gx = theirs < 0 ? br.x0 - 0.6 : br.x1 + 0.6; } }
    const moved = d > L.reach * 0.7 ? go(gx, gz, onBridge ? L.onBridge : L.speed, dt) : false;
    if (playing && d < L.reach && it.again <= 0) {
      it.again = L.again; it.wait = L.stun; const hit = c.hurt(1); env.interfere?.(1); env.hud?.glitch?.(0.6);
      const w = c.toWorld(it.x, it.z); env.play?.('thunk', w.x, w.z, 16); if (hit && hit.ended) it.state = 'gone';
    }
    pose(dt, moved);
  });
}
