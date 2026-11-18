// The Backrooms — the mascot: what follows you. In every visit there is a mascot on a
// plinth somewhere in the level (cast.js: he is the one who is always down
// here): a goblin dressed as a pirate, stiff as a shop dummy, arms held out
// from its sides, with a face that did not come out right and is not the same
// face the next time you look. On the first floor, once you have met it and
// turned your back it comes after you. Below that floor it is already roaming
// after a short arrival grace, whether or not you found its plinth. It moves
// only ever while you are not looking: watch it and it is
// a mannequin. Across a room. It has a body, and nobody walks through it; and
// the camcorder cannot hold a picture inside arm's reach of it. There the tape
// tears, and it moves in the torn frames (reach.js): run past and you lose a
// frame, stand beside it and it has you, watched or not. Let it reach you from
// behind and the tape ends ('caught').
//
// It hunts by what it sees (cast/hunt.js). While it has a line of sight to you
// it knows where you are; lose it — a corner, something tall, a pair of doors
// pulled shut (doors.js) — and it goes to where it last saw you, looks, and
// then walks the floor a room at a time with nothing to go on. The tape feels
// it knowing: static while it has you, a clean picture once it has not. A shut
// door it can open, slowly, and you hear it at the handle; but that is moving,
// so not while you watch the door. And it walks (cast/walk.js): it cannot get
// through anything it could not stand up in. Crawl away from it and, some of
// the time, once your back is turned, it is flat on the carpet with its face
// in the hole.
//
// While the office's keycard for this place has not been found (loot.js), the
// mascot is holding it: on a loop of ribbon, from one hand, held out. Walk up
// and take it — from inside its reach, so be quick — which it notices, the
// way it notices being looked at.
// Going down is no way of losing it. On the next floor it is somewhere in
// the maze, keeping its face and whatever card was still in its hand
// (env.carry). It starts without knowing where you landed.
// With a health system (env.health) a grab costs two points of four and it
// lets go, and keeps away a while; without one a grab is the end of the tape.
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { keycard } from '../../props/loot.js';
import { Batch, lamp, lin, drawText } from '../kit.js';
import { makeRng, toWorld, roomDistances } from '../gen.js';
import { P, clamp, turnTo } from '../bits.js';
import { REACH, calm, beside } from '../reach.js';
import { furnitureClear } from '../furniture-rules.js';
import { HUNT, BARRICADE, heave, knows, lost, shown, spent, handle, atHandle, willPeek, getsDown, lying } from './hunt.js';
import { SHOVE, slide } from '../shove.rule.js';
import { FIRE_FEAR, calm as unafraid, afraid, tooNear } from './fire.rule.js';
import { ROAMING, roamsThisFloor, roamingRooms, roamingSpots } from './roaming.rule.js';
import { HEALTH } from './health.rule.js';

const SC = 1.25, S = 0.025 * SC;                 // sculpted chunkier than the furniture: one voxel is 3.1 cm
const TALL = ROAMING.tall, PLINTH = 0.16, BODY = 0.3; // BODY: how much floor it takes up, as a radius (with yours, that is REACH.touch)
const SKIN = '#7ea04a', SKIN_D = '#56733a', BEARD = '#1e1a1c', FELT = '#4d311d', BRAID = '#b39245', COAT = '#b9923a', SHIRT = '#2c8a79';
const BELT = '#221a16', GOLD = '#e2ba48', SASH = '#7f7392', BOOT = '#2b1d15', CLOTH = '#393843';
const CARD = 0.02;                               // metres to a voxel of the keycard in its hand: a size down from the office's, or it would be a placard
const FACE = 1.4;                                // how much bigger its face is when it is pressed to a hole (it is never the same face twice)
const HELD = 1.3;                                // …and the arm that holds it is never lower than this (radians out from its side): the card hangs clear of its coat

/* ---- the figure ------------------------------------------------------------------------ */

const front = (v, x, y, color) => { for (let z = 16; z >= -16; z--) if (v.has(x, y, z)) { v.set(x, y, z, color); return; } };
const behind = (v, x, y, color) => { for (let z = -16; z <= 16; z++) if (v.has(x, y, z)) { v.set(x, y, z, color); return; } };

function bodyVox() {
  const v = new Vox(), coat = M(COAT, 2), belt = M(BELT, 0), gold = M(GOLD, 0), sash = M(SASH, 2);
  for (const x0 of [-6, 1]) {
    v.box(x0, 0, -3, x0 + 5, 3, 5, M(BOOT, 1)); v.box(x0, 3, -3, x0 + 5, 8, 3, M(BOOT, 1));
    v.box(x0 - 1, 7, -4, x0 + 6, 9, 4, M('#3f2b1e', 1));                 // the turned-down top of a boot
    v.box(x0, 9, -3, x0 + 5, 14, 2, M(CLOTH, 2));
  }
  v.rbox(-8, 13, -5, 8, 30, 5, 2, coat);                                  // the long waistcoat
  v.rbox(-9, 11, -5, 9, 17, 6, 2, coat, 'xz');                            // …its skirts
  v.carve(-1, 11, 3, 1, 15, 6);
  v.rbox(-4, 28, -3, 4, 31, 5, 1, M(SHIRT, 2));                           // shirt, where the waistcoat is open at the neck
  v.box(-2, 30, -2, 2, 33, 2, M(SKIN, 1));
  // a sash over one shoulder and down to the other hip, front and back
  for (let x = -8; x < 8; x++) { const yc = 20.5 + (x + 8) * 0.56; for (let y = Math.floor(yc - 1.5); y < yc + 1.5; y++) { front(v, x, y, sash); behind(v, x, y, sash); } }
  v.rbox(-9, 15, -6, 9, 19, 6, 2, belt, 'xz');                            // a wide belt and its square buckle
  v.box(-3, 14, 6, 3, 20, 7, gold); v.box(-1, 16, 6, 1, 18, 7, belt);
  for (const y of [12, 21, 24, 27]) { front(v, 1, y, M('#4a2f18', 0)); front(v, 2, y, M('#4a2f18', 0)); front(v, 1, y + 1, M('#6b4826', 0)); front(v, 2, y + 1, M('#6b4826', 0)); }   // a row of buttons
  v.box(-11, 17, -1, -8, 22, 3, sash); v.box(-11, 9, 0, -9, 18, 2, sash); v.box(-10, 6, 1, -8, 13, 3, M('#6a5f7e', 2));   // the knot, the tails
  return v;
}

/** One arm, hanging straight down from the shoulder it turns about. */
function armVox() {
  const v = new Vox();
  v.rbox(-3, -10, -3, 3, 2, 3, 2, M(SHIRT, 2)); v.rbox(-3, -14, -3, 3, -8, 3, 1, M('#27796b', 2));
  v.box(-3, -15, -3, 3, -13, 3, M('#d7dac6', 1));
  v.rbox(-2, -19, -2, 2, -15, 2, 1, M(SKIN, 1));
  for (const fx of [-2, 0, 1]) v.box(fx, -21, -1, fx + 1, -19, 1, M(SKIN_D, 1));
  return v;
}

/** The loop of ribbon the keycard hangs by: over the wrist and down to the clip. In the card's own voxels, the wrist at the origin. */
function strapVox() {
  const v = new Vox(), red = M('#a8322b', 3);
  v.box(-1, 4, -5, 1, 5, 5, red);
  for (const z of [-5, 4]) v.box(-1, -2, z, 1, 4, z + 1, red);
  v.tube(0, -2, -4, 0, -6, 0, 0.75, red); v.tube(0, -2, 4, 0, -6, 0, 0.75, red);
  return v;
}

// Faces that did not come out right. eyes: [x, y, w, h, pupil dx, dy]…; mouth: [x, y, w, h, curve]; then how the print slipped.
const FACES = [
  { eyes: [[-4, 10, 4, 4, 0, 0], [4, 9, 2, 2, 0, 0]], mouth: [0, 4, 9, 2, 1] },                              // one eye far too big
  { eyes: [[-4, 10, 5, 5, -1, 1], [4, 10, 5, 5, 1, -1]], mouth: [0, 4, 13, 3, 2] },                          // everything too wide
  { eyes: [[-3, 10, 3, 3, 0, 0], [5, 6, 3, 3, 0, -1]], mouth: [-2, 3, 8, 2, -1], slope: 0.35 },              // one eye has slid
  { eyes: [[-4, 12, 3, 3, 0, 0], [-4, 7, 3, 3, 0, 0]], mouth: [4, 8, 2, 7, 0] },                             // both eyes on one side, the mouth on end
  { eyes: [[-4, 10, 3, 3, 0, 0], [3, 10, 3, 3, 0, 0]], mouth: [0, 4, 8, 2, 1], smear: [8, 12, 5] },          // dragged sideways while wet
  { eyes: [[-3, 9, 3, 7, 0, 2], [3, 9, 3, 7, 0, 2]], mouth: [0, 3, 4, 6, 0] },                               // stretched
  { eyes: [[-5, 10, 3, 3, 0, 0], [0, 11, 4, 4, 0, 0], [5, 10, 3, 3, 0, 0]], mouth: [0, 5, 5, 1, 0] },        // one too many
  { eyes: [[-2, 5, 3, 3, 0, 0], [3, 4, 3, 3, 0, 0]], mouth: [0, 12, 10, 2, -2] },                            // the right things in the wrong order
];

function paintFace(v, f, R) {
  const px = new Map(), put = (x, y, c) => px.set(x + ',' + y, [x, y, c]);
  const white = M('#f3f0e2', 0), dark = M('#0c0a0b', 0), tooth = M('#e9e3c6', 0), lid = M(SKIN_D, 1);
  for (const [ex, ey, w, h, pdx, pdy] of f.eyes) {
    const x0 = ex - Math.floor(w / 2), y0 = ey - Math.floor(h / 2);
    for (let x = x0 - 1; x <= x0 + w; x++) for (let y = y0 - 1; y <= y0 + h; y++) put(x, y, x < x0 || x >= x0 + w || y < y0 || y >= y0 + h ? lid : white);
    const cx = x0 + Math.floor((w - 1) / 2) + pdx, cy = y0 + Math.floor((h - 1) / 2) + pdy;
    put(cx, cy, dark); if (w > 4) { put(cx + 1, cy, dark); put(cx, cy + 1, dark); put(cx + 1, cy + 1, dark); }
  }
  const [mx, my, mw, mh, curve] = f.mouth, m0 = mx - Math.floor(mw / 2);
  for (let i = 0; i < mw; i++) {
    const t = mw > 1 ? (i / (mw - 1)) * 2 - 1 : 0, lift = Math.round(curve * t * t + (f.slope || 0) * (i - mw / 2));
    for (let j = 0; j < mh; j++) put(m0 + i, my + j + lift, (mh > mw ? i === 0 && j % 2 : j === mh - 1 && i % 2) ? tooth : dark);
  }
  const list = [...px.values()];
  if (f.smear) { const [ya, yb, n] = f.smear; for (const [x, y, c] of list.slice()) if (y >= ya && y <= yb && c !== lid) for (let k = 1; k <= n; k++) if (!px.has(`${x + k},${y}`)) list.push([x + k, y, c]); }
  const jx = R.int(-1, 1), jy = R.int(-1, 0);
  for (const [x, y, c] of list) front(v, x + jx, y + jy, c);
}

/** A wide three-cornered hat: a triangle of felt, one corner to the back, each side folded up against the crown. */
function hat(v, y0) {
  const felt = M(FELT, 2), braid = M(BRAID, 1), A = [0, -15], B = [16, 7], C = [-16, 7];
  const edge = (p, q, x, z) => {                                       // how far inside this edge, and how near its middle (0 at the corners, 1 half way)
    const ex = q[0] - p[0], ez = q[1] - p[1], len = Math.hypot(ex, ez), t = ((x - p[0]) * ex + (z - p[1]) * ez) / (len * len);
    return [(ex * (z - p[1]) - ez * (x - p[0])) / len, 1 - Math.abs(2 * clamp(t, 0, 1) - 1)];
  };
  v.cyl('y', 0, -1, y0, y0 + 6, 6.6, felt, 5.8);
  for (let x = -17; x <= 17; x++) for (let z = -11; z <= 16; z++) {
    let d = 99, mid = 0;
    for (const [p, q] of [[A, B], [B, C], [C, A]]) { const [di, mi] = edge(p, q, x + 0.5, z + 0.5); if (di < d) { d = di; mid = mi; } }
    if (d < 0) continue;
    const up = d < 5 ? Math.round((5 - d) * (0.25 + 0.85 * mid)) : 0;
    for (let y = y0; y <= y0 + up + 1; y++) v.set(x, y, z, d < 1.2 && y === y0 + up + 1 ? braid : felt);
  }
}

function headVox(f, R) {
  const v = new Vox(), skin = M(SKIN, 1), beard = M(BEARD, 3);
  v.ellipsoid(0, 8, 0, 8, 7.5, 7.5, skin);
  v.remap((x, y, z, c) => (z > -3 && (y < 5 || (y < 9 && Math.abs(x) >= 6)) ? beard : c));
  for (const sx of [-1, 1]) { v.tube(sx * 7, 8, -1, sx * 11, 9, -2, 2.1, skin); v.tube(sx * 10, 9, -2, sx * 15, 13, -3, 1.2, skin); }   // ears, long and pointed
  v.ellipsoid(0, 2, 4, 6, 4, 4, beard); v.tube(0, 0, 5, 0, -5, 6, 1.9, beard);
  v.tube(0, 8, 7, 0, 6, 11, 1.4, M(SKIN_D, 1));                            // the nose
  paintFace(v, f, R);
  hat(v, 12);
  return v;
}

/** The same head as a bad frame of tape shows it: some of its rows slipped sideways. */
function torn(src, R) {
  const out = new Vox(), b = src.bounds(), shift = new Map();
  for (let y = b.y0 + R.int(1, 4); y < b.y1; y += R.int(2, 6)) { const h = R.int(1, 3), dx = R.pick([-5, -3, -2, 2, 3, 4, 6]); for (let k = 0; k < h; k++) shift.set(y + k, dx); y += h; }
  src.each((x, y, z, c) => out.set(x + (shift.get(y) || 0), y, z, c));
  return out;
}

// how it holds itself: each arm out from its side (l, r) and forward (fl, fr), the head tipped
const POSES = [
  { l: 0.55, r: 0.55 }, { l: 0.55, r: 0.55, tilt: 0.3 }, { l: 0.3, r: 0.8, tilt: -0.22 }, { l: 1.45, r: 0.5 },
  { l: 0.5, r: 2.5, tilt: 0.15 }, { l: 1.5, r: 1.5 }, { l: 0.45, r: 0.6, tilt: -0.4 },
  { l: 0.25, r: 0.25, fl: 1.35, fr: 1.35 }, { l: 0.3, r: 0.3, fl: 1.5, fr: 0.25, tilt: 0.35 },          // the last two reach for you
];

export function makePirate(kit, R, first = 0) {
  const mat = kit.surface({ vox: true }), m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0.25, 2.6, 0.9, [1.3, 1.3, 1.3], { k: 9, wrap: 0.45, far: 30 })], amb = [0.6, 0.6, 0.6];
  const part = (key, make) => { const b = new Batch(true); b.addVox(kit.model('pirate:' + key, make).solid, m4); return new THREE.Mesh(kit.geometry(b, lights, amb), mat); };
  const group = new THREE.Group(), head = new THREE.Group(), flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  group.rotation.order = 'YXZ';
  group.add(part('body', bodyVox));
  const arms = [-1, 1].map((sx) => { const g = new THREE.Group(); g.position.set(sx * 9.5 * S, 28 * S, 0); g.add(part('arm', armVox)); group.add(g); return g; });
  head.position.set(0, 31 * S, 0); group.add(head);
  const order = R.shuffle(FACES.map((f, i) => i)).slice(0, 6);
  const faces = order.map((i, k) => {
    const whole = part('head' + k, () => headVox(FACES[i], R.fork ? R.fork('face' + k) : R));
    const slipped = part('torn' + k, () => torn(headVox(FACES[i], makeRng('same' + k)), makeRng('tear' + k + R.int(0, 99))));
    whole.visible = slipped.visible = false; head.add(whole, slipped);
    return { whole, slipped };
  });
  // the patch of dark it stands on
  const shadow = new THREE.Mesh(kit.own(new THREE.PlaneGeometry(1.05, 1.05)), kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.blob(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1; group.add(shadow);
  const p = {
    group, head, arms, faces, mat, shadow, face: first % faces.length, pose: 0, slip: false, card: null,
    show() { faces.forEach((f, k) => { f.whole.visible = k === p.face && !p.slip; f.slipped.visible = k === p.face && p.slip; }); },
    hold(k, look = 0) {
      const q = POSES[k], out = [q.l, q.r]; p.pose = k;
      if (p.card && p.card.held && !q.fl && !q.fr) out[p.card.side] = Math.max(out[p.card.side], HELD);       // whatever else it is doing, it holds the card out
      arms[0].rotation.set(-(q.fl || 0), 0, -out[0]); arms[1].rotation.set(-(q.fr || 0), 0, out[1]);
      head.rotation.set(0, look, q.tilt || 0);
      p.plumb();
    },
    /** Hang the office's keycard from one wrist (0 or 1). It is a thing on a ribbon: however the arm is held, it hangs straight down. */
    give(side) {
      const b = new Batch(true), m = new THREE.Matrix4(), hang = new THREE.Group();
      b.addVox(kit.model('pirate:strap', strapVox).solid, m.makeScale(CARD, CARD, CARD));
      b.addVox(kit.model('loot:card', keycard).solid, m.makeScale(CARD, CARD, CARD).setPosition(0, -21 * CARD, 0));
      hang.add(new THREE.Mesh(kit.geometry(b, lights, amb), mat));
      hang.position.set(0, -17 * S, 0); arms[side].add(hang);
      p.card = { side, hang, held: true };
      p.hold(p.pose, head.rotation.y);
    },
    plumb() { if (!p.card) return; const q = p.card.hang.quaternion.copy(arms[p.card.side].quaternion).invert(); if (Math.abs(group.rotation.x) > 0.1) q.multiply(flat); },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
  p.show(); p.hold(0);
  return p;
}

/* ---- getting about when nobody is looking ---------------------------------------------- */

/** The openings of a floor that it could not stand up in: crawl-height doorways, and the low holes in the partitions of plain rooms. */
function lowWays(world) {
  const out = [];
  for (const th of world.throats) {
    const l = th.link; if (!(l.h < TALL)) continue;
    const mid = (l.from + l.to) / 2, x = l.axis === 'x';
    out.push({ x: x ? l.at : mid, z: x ? mid : l.at, nx: x ? 1 : 0, nz: x ? 0 : 1, w: l.to - l.from, th, last: 0 });
  }
  for (const rt of world.rooms) for (const lo of rt.def.lows || []) {
    if (!(lo.h < TALL)) continue;
    const thinX = lo.x1 - lo.x0 < lo.z1 - lo.z0, c = toWorld(rt.def, (lo.x0 + lo.x1) / 2, (lo.z0 + lo.z1) / 2), n = toWorld(rt.def, (lo.x0 + lo.x1) / 2 + (thinX ? 1 : 0), (lo.z0 + lo.z1) / 2 + (thinX ? 0 : 1));
    out.push({ x: c.x, z: c.z, nx: n.x - c.x, nz: n.z - c.z, w: thinX ? lo.z1 - lo.z0 : lo.x1 - lo.x0, th: null, last: 0 });
  }
  return out;
}

/**
 * The mascot, for one floor (the creature contract: docs/BACKROOMS.md, "Adding a creature"). He is made for every floor of every visit:
 * on the one the plan puts him on he has a plinth; below the first floor he takes a safe roaming start in the maze.
 */
export function create(c) {
  const env = c.env, level = env.level, R = makeRng(`${level.seed}/pursuer`);
  const W = () => env.world, walk = c.walk, stand = walk.stand, hiddenAt = c.hidden, drawn = c.drawn;
  let pirate = null, ways = [];

  /* ---- the mascot ------------------------------------------------------------------------ */

  function mascot(x, z, yaw, onPlinth) {
    pirate = Object.assign(makePirate(env.kit, R, level.pursuer?.face || 0), {
      x, z, yaw, r: 0.26, tall: TALL, opens: true, pushes: true, speed: 1.9, state: 'still', know: lost(), got: null, handle: null, shove: null, cross: null, down: null, spot: null, plinth: onPlinth, home: { x, z, yaw },
      met: 0, unseen: 0, rolled: false, noise: 0.5, tearIn: 2 + R() * 3, tearFor: 0, lit: 0,
      patience: R.range(2.2, 4.5), wakeAt: R.range(150, 260), catchT: 0,
      near: calm(), body: { x, z, r: BODY },
    });
    pirate.group.position.set(x, onPlinth ? PLINTH : 0, z); pirate.group.rotation.y = yaw;
    if (W()?.bodies && !W().bodies.includes(pirate.body)) W().bodies.push(pirate.body);
    return pirate;
  }

  /** Where it lives: a plinth, a name plate, tape on the carpet. Called by the plain room the level chose for it. */
  env.lair = (c) => {
    const k = c.corner(1.1, level.pursuer.corner, 2.0) || c.spot(0.85, { head: 2.0 }) || { x: 0, z: 0 };
    const yaw = Math.hypot(k.x, k.z) > 0.5 ? Math.atan2(-k.x, -k.z) : 0, fx = Math.sin(yaw), fz = Math.cos(yaw);
    c.flat.box(k.x - 0.5, 0, k.z - 0.5, k.x + 0.5, PLINTH, k.z + 0.5, lin('#3e2c1f'), { skip: '-y' });
    c.flat.box(k.x - 0.46, PLINTH, k.z - 0.46, k.x + 0.46, PLINTH + 0.004, k.z + 0.46, lin('#6b2f33'));
    c.solid(k.x - 0.5, k.z - 0.5, k.x + 0.5, k.z + 0.5, { keep: true });
    c.shadow(k.x, k.z, 1.0, 1.0, 0.4);
    // hazard tape on the carpet, a pace out
    const tape = c.mapped('hazard', c.kit.tex.custom('hazard', 16, 8, (g) => { P(g, '#e6b90f', 0, 0, 16, 8); g.fillStyle = '#17140c'; for (const x of [0, 8]) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 4, 8); g.lineTo(x + 8, 0); g.lineTo(x + 4, 0); g.fill(); } }));
    for (const [dx, dz, rot] of [[0, 0.95, 0], [0, -0.95, 0], [0.95, 0, Math.PI / 2], [-0.95, 0, Math.PI / 2]]) {
      const x = k.x + dx, z = k.z + dz;
      if (Math.abs(x) < c.W / 2 - 0.1 && Math.abs(z) < c.D / 2 - 0.1) c.lay(tape, x, z, 1.96, 0.055, rot, [[0, 0], [12, 0], [12, 1], [0, 1]], [1, 1, 1], 0.007);
    }
    // its name, on a post beside it — and nothing about how it behaves: that is for you to find out
    const sx = k.x + fz * 0.78 + fx * 0.62, sz = k.z - fx * 0.78 + fz * 0.62;
    const tex = c.kit.tex.custom('mascot', 128, 48, (g) => {
      P(g, '#1b1a17', 0, 0, 128, 48); P(g, '#c9a24a', 2, 2, 124, 44); P(g, '#f0e7cf', 4, 4, 120, 40);
      drawText(g, ['CAPT. LEGACY'], 4, 6, 120, 24, { size: 15 });
      drawText(g, [`TEAM MASCOT  ·  EST. ${level.stamp.year}`], 4, 30, 120, 12, { size: 7, weight: 400 });
    }, { clamp: true });
    c.board(c.mapped('mascot', tex), sx + fx * 0.012, 0.875, sz + fz * 0.012, 0.6, 0.225, yaw);
    c.board(c.flat, sx - fx * 0.012, 0.875, sz - fz * 0.012, 0.64, 0.265, yaw + Math.PI, null, [0.1, 0.1, 0.1]);
    c.flat.box(sx - 0.02, 0, sz - 0.02, sx + 0.02, 0.76, sz + 0.02, [0.55, 0.5, 0.36], { skip: '-y' });
    c.flat.box(sx - 0.14, 0, sz - 0.14, sx + 0.14, 0.025, sz + 0.14, [0.3, 0.28, 0.22], { skip: '-y' });
    c.solid(sx - 0.06, sz - 0.06, sx + 0.06, sz + 0.06);
    c.reserve(sx, sz, 0.3);
    const at = c.toWorld(k.x, k.z), p = mascot(at.x, at.z, yaw + (c.room.rot * Math.PI) / 2, true);
    p.group.position.y += c.room.y;
    c.world.scene.add(p.group);
    if (!c.world.bodies.includes(p.body)) c.world.bodies.push(p.body);
    // the keycard, if it still has it: in the hand on the side its name plate is not, unless that would put the card in the wall
    if (level.loot?.card) {
      const room = (sx) => Math.min(c.W / 2 - Math.abs(k.x + sx * 0.85 * fz), c.D / 2 - Math.abs(k.z - sx * 0.85 * fx));
      p.give(room(-1) >= 0.2 || room(-1) >= room(1) ? 0 : 1);
    }
  };
  function ready() {
    ways = lowWays(W());
    if (level.pursuer && !pirate) {                                   // the room it was meant for was never built: it stands in the middle of it
      const def = level.rooms[level.pursuer.room], p = mascot(def.cx, def.cz, 0, false);
      p.group.position.y = def.y; W().scene.add(p.group);
      if (level.loot?.card) p.give(level.pursuer.face % 2);
    }
    if (!level.pursuer && !pirate && env.visit?.floors?.[level.depth]?.mascot) {
      // the floor had no corner for a plinth (a few in a hundred have not): he is in every visit all the same, standing in a plain room
      // a good way in, with nothing to stand on and no name plate
      const far = roomDistances(level, level.start.room), able = level.rooms.filter((r) => r.kind === 'plain' && !r.crawl && r.H >= 2.2 && !r.shape && (far.get(r.id) || 0) >= 3);
      if (able.length) {
        const def = R.pick(able), at = walk.spotIn({ r: 0.26, tall: TALL }, def.id), p = mascot(at.x, at.z, R.range(-3, 3), false);
        p.group.position.y = def.y; W().scene.add(p.group);
      }
    }
    // Below the first floor there is always a real roamer. It is already in
    // the maze, beyond any low entrance, rather than waiting on an unseen
    // plinth for several minutes or never being made until a later floor.
    const roaming = roamsThisFloor(level, env.visit) && takeTheFloor();
    if (pirate && !W().bodies.includes(pirate.body)) W().bodies.push(pirate.body);
    if (pirate?.card) offer(pirate);
    // it was after you on the floor above: give it time to find the hole
    if (!roaming && !pirate && env.carry?.awake) arriving = { wait: env.carry.wait ?? (env.carry.lost ? R.range(45, 80) : R.range(16, 28)), face: env.carry.face || 0, card: !!env.carry.card, lost: !!env.carry.lost };
  }

  /** Start well away from the landing, without knowing where the visitor is. No second body or second keycard. */
  function takeTheFloor() {
    const body = { r: 0.26, tall: TALL, opens: true }, start = level.start;
    for (const id of roamingRooms(level, walk.cost(body))) {
      const at = [walk.spotIn(body, id), ...roamingSpots(level, id)].find(p => stand(body, p.x, p.z) && Math.hypot(p.x - start.x, p.z - start.z) >= ROAMING.near);
      if (!at) continue;
      const p = pirate || mascot(at.x, at.z, R.range(-3, 3), false), carried = env.carry?.awake ? env.carry : null;
      p.x = at.x; p.z = at.z; p.plinth = false; p.home = { x: at.x, z: at.z, yaw: p.yaw };
      p.body.x = p.x; p.body.z = p.z;
      p.state = 'awake'; p.know = lost(); p.entryGrace = ROAMING.grace;
      if (carried) { p.face = (carried.face || 0) % p.faces.length; p.show(); if (carried.card && !p.card) p.give(p.face % 2); }
      p.group.position.set(p.x, W().floorY(p.x, p.z), p.z); p.group.visible = drawn(p);
      p.light(W().lightAt(p.x, p.z, 1.0)); W().scene.add(p.group);
      return true;
    }
    return false;
  }

  /** It followed downstairs, but finds a distant unseen room rather than appearing on the landing. */
  let arriving = null;
  function arrive(dt) {
    arriving.wait -= dt;
    if (arriving.wait > 0) return;
    const body = { r: 0.26, tall: TALL, opens: true }, me = env.player.me;
    let at = null;
    for (const id of roamingRooms(level, walk.cost(body))) {
      at = [walk.spotIn(body, id), ...roamingSpots(level, id)].find(p => p && stand(body, p.x, p.z) && Math.hypot(me.x - p.x, me.z - p.z) >= 5 && hiddenAt(p.x, p.z, 1.2));
      if (at) break;
    }
    if (!at) return;
    const p = mascot(at.x, at.z, Math.atan2(me.x - at.x, me.z - at.z), false);
    p.face = arriving.face % p.faces.length; p.show();
    p.state = 'awake'; p.met = 1;
    // If it was after you upstairs, it remembers which way you went; otherwise it searches.
    p.know = arriving.lost ? lost() : { ...shown(here()), mode: 'search' };
    W().scene.add(p.group);
    if (arriving.card) { p.give(p.face % 2); offer(p); }
    env.play('thunk', at.x, at.z, 14);
    arriving = null;
  }

  /* ---- the card in its hand ---------------------------------------------------------------- */

  const hand = new THREE.Vector3();
  /** Something to press E at: the card, wherever the hand holding it has got to. Taking it is noticed. */
  function offer(p) {
    p.card.use = { r: 0.85, wx: p.x, wz: p.z, room: null, when: () => p.card.held && p.state !== 'caught' && p.group.visible,
      use: () => {
        p.card.held = false; p.card.hang.visible = false;             // (the arm stays where it was: it is being watched)
        env.loot?.pocket('card');
        env.interfere(0.55); env.hud.glitch(0.35);
        wake();
      } };
    reach(p);
  }
  /** Keep the [E] where the card is. */
  function reach(p) {
    const use = p.card.use, rt = W().roomAt(p.x, p.z);
    if (rt && rt !== use.room) { const i = use.room ? use.room.uses.indexOf(use) : -1; if (i >= 0) use.room.uses.splice(i, 1); rt.uses.push(use); use.room = rt; }
    p.card.hang.getWorldPosition(hand);
    use.wx = hand.x; use.wz = hand.z;
  }

  const here = () => { const me = env.player.me; return { x: me.x, z: me.z, room: W().roomAt(me.x, me.z)?.id ?? null }; };
  /** It stops being a shop dummy. shownYou: it knows where you are (you touched it, or turned your back within its reach); otherwise it has to see you first. */
  function awaken(p, shownYou) { p.state = 'awake'; p.met = Math.max(p.met, 1); p.know = shownYou ? shown(here()) : lost(); p.got = null; }
  function wake(force) {
    const p = pirate; if (!p || p.state === 'caught') return false;
    if (force && env.player) {
      const me = env.player.me, here = W().roomAt(me.x, me.z);
      let best = null;
      for (let i = 0; i < 120 && here; i++) {
        const x = here.rect.x0 + Math.random() * (here.rect.x1 - here.rect.x0), z = here.rect.z0 + Math.random() * (here.rect.z1 - here.rect.z0), d = Math.hypot(x - me.x, z - me.z);
        if (d < 2 || d > 6 || !stand(p, x, z)) continue;
        const score = (hiddenAt(x, z) ? 10 : 0) - Math.abs(d - 3.2);
        if (!best || score > best.score) best = { x, z, score };
      }
      if (best) { p.x = best.x; p.z = best.z; p.plinth = false; walk.forget(p); }
    }
    p.body.x = p.x; p.body.z = p.z;
    awaken(p, true);
    return true;
  }
  /** It has you: face to face, its card back in its hand if you had taken it, and the tape ends. */
  function seize(p) {
    const w = W(), me = env.player.me, now = Math.hypot(me.x - p.x, me.z - p.z);
    const k = REACH.touch / Math.max(now, 0.05);
    const nx = me.x - (me.x - p.x) * k, nz = me.z - (me.z - p.z) * k;
    const from = p.down?.head || p;
    if (p.know.spent > 0 || !w.los(from.x, from.z, me.x, me.z) || !furnitureClear(w, from.x, from.z, me.x, me.z, 0.08)
      || p.down && !furnitureClear(w, p.down.feet.x, p.down.feet.z, from.x, from.z, 0.2)) return;
    // where there is health to take, a grab takes some of it (cast/hunt.js) — and if that was not the last of it, it lets go
    const hit = env.health ? c.hurt(HUNT.grab) : null;
    if (hit && !hit.landed) return;
    // In co-op, losing one visitor does not finish the surviving visitor's hunt.
    if (hit && (!hit.dead || hit.ended === false)) { breakOff(p); return; }
    const end = () => { if (!hit) env.end('caught'); };            // (a last point taken ends the visit by itself)
    p.state = 'caught'; p.catchT = 0;
    if (p.down) { env.sound.play('thunk'); end(); return; }          // from the hole: it does not get up for this
    if (w.free(nx, nz, 0.1, { ghost: true }) && w.los(p.x, p.z, nx, nz) && furnitureClear(w, p.x, p.z, nx, nz, p.r)) { p.x = nx; p.z = nz; }
    p.plinth = false;
    p.yaw = Math.atan2(me.x - p.x, me.z - p.z);
    p.hold(7);
    if (p.card && !p.card.held && env.loot?.carried.card) {       // …and it has its card back: held up between you, where the tape cannot miss it
      p.card.held = p.card.back = true; p.card.hang.visible = true; env.loot.forfeit();
      p.arms[p.card.side].rotation.set(-2.5, 0, p.card.side ? -0.35 : 0.35); p.plumb();
    }
    p.group.position.set(p.x, w.floorY(p.x, p.z), p.z); p.group.rotation.y = p.yaw;
    env.sound.play('thunk');
    end();
  }
  /** It has had you and you are still standing: a torn frame, and it is not there. Somewhere out of sight, not interested, for a while. */
  function breakOff(p) {
    env.interfere(1); env.hud.glitch(0.7); env.sound.play('static', { dur: 0.5 }); env.sound.play('thunk');
    p.down = null; p.cross = null; p.near = calm(); p.handle = null; p.shove = null; p.got = null; p.plinth = false; walk.forget(p);
    p.know = spent(); p.hunted = false; c.survived();
    for (const e of walk.exits(p).sort(() => Math.random() - 0.5)) {
      const at = walk.spotIn(p, e.room);
      if (hiddenAt(at.x, at.z, 0.8) && stand(p, at.x, at.z)) { p.x = at.x; p.z = at.z; break; }
    }
    p.hold(0);
  }

  /* ---- what it knows, and where that takes it ---------------------------------------------- */

  /** You have gone through a hole it cannot: if it was after you, and near, it may come and look. */
  function crossings(p) {
    const me = env.player.me;
    for (const way of ways) {
      if (way.th && !way.th.open) { way.last = 0; continue; }
      const s = (me.x - way.x) * way.nx + (me.z - way.z) * way.nz, across = (me.x - way.x) * way.nz - (me.z - way.z) * way.nx;
      if (Math.abs(across) > way.w / 2 + 0.15 || Math.abs(s) > 0.9) { way.last = 0; continue; }
      const side = s > 0 ? 1 : -1, was = way.last; way.last = side;
      if (!was || was === side) continue;
      if (p.cross && p.cross.way === way) { p.cross = null; continue; }                            // …and come back
      const its = (p.x - way.x) * way.nx + (p.z - way.z) * way.nz, k = p.know.mode;
      if (p.state !== 'awake' || p.down || (k !== 'chase' && k !== 'search') || its * side > 0 || Math.hypot(p.x - way.x, p.z - way.z) > 10) continue;
      const mx = -side * way.nx, mz = -side * way.nz, at = (k2) => ({ x: way.x + mx * k2, z: way.z + mz * k2 });
      const feet = at(1.26), mid = at(0.8);
      p.cross = { way, side, t: 0, turned: 0, will: willPeek(), near: mid, feet, head: at(0.38), yaw: Math.atan2(-mx, -mz),
        room: W().free(feet.x, feet.z, 0.2, { ghost: true }) && W().free(mid.x, mid.z, 0.2, { ghost: true }) };
    }
  }

  function think(p, dt, los, d) {
    const w = W(), me = env.player.me, k0 = p.know, got = p.got || {};
    const choosing = k0.mode === 'wander' && (k0.room === null || got.cannot);
    const perk = env.perk, crouched = !!me.crouching;
    const far = HUNT.far * (crouched ? (perk?.crouchSightScale ?? 1) : 1);
    const noticeScale = crouched ? (perk?.crouchNoticeScale ?? 1) : 1;
    const alertFar = perk?.sprintAlertFar ?? 0;
    const heard = alertFar > 0 && !!me.sprinting && !crouched && d <= alertFar && walk.steps(p, me) <= 2;
    const k = p.know = knows(k0, dt, { los, d, far, noticeScale, heard, me: { x: me.x, z: me.z, room: w.roomAt(me.x, me.z)?.id ?? null }, room: w.roomAt(p.x, p.z)?.id ?? null,
      at: !!got.there, cannot: !!got.cannot, exits: choosing ? walk.exits(p) : null });
    if (k.mode !== k0.mode || k.room !== k0.room) { p.got = null; p.handle = null; p.shove = null; }
    if (k.mode === 'chase') p.hunted = true;
    if (k.gaveUp && p.hunted) { p.hunted = false; c.survived(); }                                  // it was after you, and it has lost you
    if (k.found) { env.interfere(0.6); env.hud.glitch(0.25); env.play('seek', p.x, p.z, 10); }      // it has seen you: the tape knows before you do
    if (p.cross) {
      const c = p.cross;
      c.t += dt; c.turned = env.sees(c.way.x, c.way.z, { radius: 0.5, margin: 0.1, far: 20 }) ? 0 : c.turned + dt;
      if (c.t > HUNT.peekWithin + 4 || !c.will || !c.room) p.cross = null;
    }
  }

  /** Where it is making for this moment, and how near that it stops: { x, z, keep } — or null: it stands where it is. */
  function goal(p) {
    const k = p.know, me = env.player.me;
    if (p.cross) return { x: p.cross.near.x, z: p.cross.near.z, keep: 0 };
    if (k.mode === 'chase') return { x: me.x, z: me.z, keep: 0.5 };
    if (k.mode === 'search' && k.last) return { x: k.last.x, z: k.last.z, keep: 0 };
    if (k.mode === 'wander' && k.room !== null) {
      if (!p.spot || p.spot.room !== k.room) p.spot = { room: k.room, ...walk.spotIn(p, k.room) };
      return { x: p.spot.x, z: p.spot.z, keep: 0.3 };
    }
    return null;
  }

  /** Some of the way to wherever it is going, in `step` seconds. Never where it could be seen arriving. → how far it went. */
  function advance(p, step) {
    const to = goal(p), bx = p.x, bz = p.z;
    if (!to) { p.shove = null; return 0; }
    const got = p.got = walk.go(p, to, p.speed * (c.speedScale ?? 1) * step, to.keep);
    if (!hiddenAt(p.x, p.z, p.r + 0.3)) { p.x = bx; p.z = bz; return 0; }          // it would have walked into view: it waits instead
    // a fire it can see is as far as it goes that way (cast/fire.rule.js): it stands off, and to hunt.js that is a way it cannot get by
    if (tooNear(p, c.fire(p.x, p.z))) { p.x = bx; p.z = bz; p.got = { went: 0, there: false, cannot: true, door: null }; p.handle = null; p.shove = null; return 0; }
    if (got.door) {
      // a shut door: it works the handle, and you can hear it — unless you are watching the door (cast/hunt.js)
      const holdTime = HUNT.door * (got.door.by === 'you' ? (env.perk?.doorHoldScale ?? 1) : 1);
      const h = p.handle = handle(p.handle || atHandle(), step, env.doors.watched(got.door), holdTime);
      if (h.rattle) env.play('rattle', got.door.x, got.door.z, 9);
      if (h.open) { env.doors.open(got.door, 'it'); p.handle = null; }
    } else p.handle = null;
    // A desk across its path is time bought, not a stopped brain. The walker tries a detour first; at a real
    // blockage it braces, rattles it, then slides it in small collision-checked steps. Looking at the mascot
    // never enters advance(), and a frozen visitor, a spent hunter or fire cannot advance this clock either.
    const item = got.obstacle;
    p.shove = heave(p.shove, step, item, !env.player.me.frozen && !(p.know.spent > 0) && !p.fear?.flee);
    if (item && p.shove && env.barricades) {
      if (p.shove.knock) { env.play('creak', item.x, item.z, 9); p.hold(5); }
      if (p.shove.shove > 0) {
        const moved = env.barricades.shove(item, p, p.shove.shove)?.moved;
        p.shove.stuck = moved ? 0 : p.shove.stuck + step;
        if (moved && p.shove.t >= (p.shove.scrape || 0)) {
          env.play(item.type === 'trolley' || item.type === 'chair' ? 'furnitureRoll' : 'furnitureScrape', item.x, item.z, 7);
          p.shove.scrape = p.shove.t + 0.3;
        }
        p.yaw = Math.atan2(item.x - p.x, item.z - p.z);
        if (p.shove.stuck >= BARRICADE.stuck) {
          got.cannot = true;
          if (got.link !== null) walk.avoid(p, got.link);             // a wall/player behind it: another route, never a shove through them
        }
      }
    }
    return Math.hypot(p.x - bx, p.z - bz);
  }

  /** Away from a fire: off its plinth if it is on one, and as far as this moment allows, whoever is looking. */
  function flee(p, fear, seen, d, dt) {
    if (p.state !== 'awake') awaken(p, false);
    if (seen && d < 12) { p.met += dt; if (!p.known && p.met > 0.4) { p.known = true; c.met(); } }
    p.down = null; p.cross = null; p.got = null; p.handle = null; p.shove = null; p.unseen = 0; p.rolled = false;
    const far = (x, z) => stand(p, x, z) && furnitureClear(W(), p.x, p.z, x, z, p.r) && Math.abs(W().floorY(x, z) - W().floorY(p.x, p.z)) < 0.6;
    if (p.plinth) for (const turn of FIRE_FEAR.turns) {
      const x = p.home.x + Math.sin(fear.away + turn) * 0.95, z = p.home.z + Math.cos(fear.away + turn) * 0.95;
      if (far(x, z)) { p.x = x; p.z = z; p.plinth = false; break; }
    }
    const bx = p.x, bz = p.z;
    if (!p.plinth) for (const turn of FIRE_FEAR.turns) {
      const x = p.x + Math.sin(fear.away + turn) * fear.step, z = p.z + Math.cos(fear.away + turn) * fear.step;
      if (!far(x, z) || !W().passable(p.x, p.z, x, z)) continue;
      p.x = x; p.z = z; break;
    }
    const went = Math.hypot(p.x - bx, p.z - bz);
    // it goes backwards: it does not take its eyes off the fire
    p.yaw = Math.atan2(fear.from.x - p.x, fear.from.z - p.z);
    if (p.pose !== 5) p.hold(5);                                        // both arms up
    if (went > 0) { p.noise -= went; if (p.noise <= 0) { p.noise = 0.65; env.play('creak', p.x, p.z, 7); } }
    if (seen) env.interfere(0.25);
  }

  function haunt(p, dt) {
    const w = W(), me = env.player.me;
    // its eyes are where its head is: at the hole, when it has got down to look through one
    const ex = p.down ? p.down.head.x : p.x, ez = p.down ? p.down.head.z : p.z;
    const dx = me.x - ex, dz = me.z - ez, d = Math.hypot(dx, dz);
    p.group.visible = drawn(p);
    if (!w.bodies.includes(p.body)) w.bodies.push(p.body);            // it has a body: nobody walks through it
    // Let somebody find their feet after each descent. The arrival/fall does
    // not spend this grace, and there is no attack or pursuit during it.
    if (p.entryGrace > 0) { if (!me.frozen) p.entryGrace = Math.max(0, p.entryGrace - dt); return; }
    if (p.state === 'caught') {                                       // the last thing on the tape
      p.catchT += dt;
      me.yaw += turnTo(me.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-16 * dt));
      me.pitch += ((p.down ? -Math.atan2(0.75, Math.max(0.3, d)) : p.card?.back ? 0.08 : 0.27) - me.pitch) * (1 - Math.exp(-12 * dt));
      p.slip = Math.random() < 0.3; p.show();
      env.interfere(1);
      return;
    }
    const seen = p.group.visible && env.sees(ex, ez, { radius: 0.6, margin: 0.18, far: 40 });
    const toMe = Math.atan2(dx, dz);
    if (p.state === 'awake') {
      crossings(p);
      think(p, dt, d < HUNT.far && Math.abs(w.floorY(p.x, p.z) - w.floorY(me.x, me.z)) < 1.6 && w.los(ex, ez, me.x, me.z), d);
    }
    if (p.down) {                                                     // lying at the hole (cast/hunt.js): it gets up only when you are not looking
      const l = p.down.l = lying(p.down.l, dt, seen);
      if (l.shock) { env.interfere(0.8); env.hud.glitch(0.4); env.sound.play('thunk', { vol: 0.5 }); }
      if (l.up) { p.down = null; p.cross = null; p.hold(0); }
    }
    // a fire beside it: it backs off, watched or not, and this moment is for nothing else (cast/fire.rule.js)
    const fear = p.fear = afraid(p.fear || unafraid(), dt, p, me.frozen ? null : c.fire(p.x, p.z));
    if (fear.flee) flee(p, fear, seen, d, dt);
    else if (seen) {
      p.unseen = 0; p.rolled = false;
      if (d < 12) { p.met += dt; if (!p.known && p.met > 0.4) { p.known = true; c.met(); } }
      // a bad frame now and then: for an instant the head is not where it was
      p.tearIn -= dt;
      if (p.tearIn < 0 && d < 9) { p.tearIn = 1.2 + Math.random() * 4.5; p.tearFor = 0.06 + Math.random() * 0.1; env.interfere(0.3); }
      // inside arm's reach the tape will not hold: it tears, and it moves in the torn frames (reach.js)
      const touchable = w.los(ex, ez, me.x, me.z) && furnitureClear(w, ex, ez, me.x, me.z, 0.08);
      const n = p.near = beside(p.near, dt, touchable ? d : Infinity);
      if (d < REACH.arm + 1.4) env.interfere(Math.max(n.noise * 0.75, 0.3 * (1 - (d - REACH.arm) / 1.4)));
      if (n.tear) {
        env.interfere(1); env.hud.glitch(0.5); env.sound.play('static', { dur: 0.22, vol: 0.8 }); env.play('creak', ex, ez, 4);
        p.tearFor = 0.16; p.tearIn = 1.5;
        p.face = (p.face + 1 + Math.floor(Math.random() * (p.faces.length - 1))) % p.faces.length;
        if (p.state !== 'awake') awaken(p, true);                                           // it has noticed
        if (!p.down) {
          // a little nearer, an arm a little higher
          if (p.plinth && n.tears >= 2) {
            const x = p.home.x + (dx / d) * 0.8, z = p.home.z + (dz / d) * 0.8;
            if (stand(p, x, z) && furnitureClear(w, p.x, p.z, x, z, p.r) && Math.hypot(me.x - x, me.z - z) > REACH.touch) { p.x = x; p.z = z; p.plinth = false; }
          } else if (!p.plinth && d > REACH.touch + 0.04) {
            const sx = p.x, sz = p.z;
            walk.stride(p, me.x, me.z, Math.min(0.3, d - REACH.touch - 0.02));
            if (tooNear(p, c.fire(p.x, p.z))) { p.x = sx; p.z = sz; }      // (not toward a fire, even in the torn frames)
          }
          if (!p.plinth) p.yaw = Math.atan2(me.x - p.x, me.z - p.z);
          p.hold(n.tears <= 1 ? 3 + Math.floor(Math.random() * 2) : n.tears === 2 ? 5 : 7 + Math.floor(Math.random() * 2), p.plinth ? clamp(turnTo(p.yaw, toMe), -1.3, 1.3) : 0);
        }
        if (n.grab) seize(p);
      }
    } else {
      p.near = beside(p.near, dt, Infinity);                            // (unwatched it needs no torn frames to move in)
      if (d < REACH.arm && p.state !== 'awake' && p.group.visible) awaken(p, true);         // …and a back turned this close is all the invitation it needs
      p.unseen += dt;
      if (p.unseen > 0.3 && !p.rolled) {                              // every time you look back: another face, another way of standing
        p.rolled = true;
        p.face = (p.face + 1 + Math.floor(Math.random() * (p.faces.length - 1))) % p.faces.length;
        const near = p.state === 'awake' && p.know.mode === 'chase' && d < 2.6;
        if (!p.down) p.hold(near ? 7 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 7), p.plinth ? clamp(turnTo(p.yaw, toMe), -1.3, 1.3) : 0);
      }
      if (p.state === 'still') {
        if (!p.plinth) p.yaw = toMe; else p.head.rotation.y = clamp(turnTo(p.yaw, toMe), -1.3, 1.3);
        const far = d > 2.4 || w.roomAt(me.x, me.z) !== w.roomAt(p.x, p.z);
        if ((p.met > 0.6 && p.unseen > p.patience && far) || env.clock > p.wakeAt) awaken(p, false);
      } else if (p.state === 'awake' && p.down) {
        if (d < 0.9) seize(p);                                          // crawl back to it and it has you
      } else if (p.state === 'awake') {
        const k = p.know.mode;
        p.speed = k === 'chase' ? (d > 5.5 ? 1.85 : 1.05) : k === 'search' ? 1.6 : 1.15;        // it hurries only while it is far behind
        if (p.plinth && p.unseen > 0.45) {                              // down off its plinth, on whichever side is free
          for (const turn of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
            const x = p.home.x + Math.sin(p.home.yaw + turn) * 0.95, z = p.home.z + Math.cos(p.home.yaw + turn) * 0.95;
            if (stand(p, x, z) && furnitureClear(w, p.x, p.z, x, z, p.r) && hiddenAt(x, z)) { p.x = x; p.z = z; p.plinth = false; break; }
          }
        }
        const bx = p.x, bz = p.z, went = p.unseen > 0.45 && !p.plinth ? advance(p, dt) : 0;
        if (went > 0) {
          p.yaw = k === 'chase' ? Math.atan2(me.x - p.x, me.z - p.z) : Math.atan2(p.x - bx, p.z - bz);
          p.noise -= went;
          if (p.noise < 0) { p.noise = 1.0 + Math.random() * 1.4; env.play('creak', p.x, p.z, 5); }
          if (k === 'chase' && Math.hypot(me.x - p.x, me.z - p.z) < 2.6 && p.pose < 7) p.hold(7 + Math.floor(Math.random() * 2));
        } else if (k === 'look' && p.unseen > 0.45 && Math.random() < dt * 1.2) p.yaw += (Math.random() - 0.5) * 2.4;          // it looks about
        const now = Math.hypot(me.x - p.x, me.z - p.z);
        // the tape feels it: plainly while it knows where you are, hardly at all while it does not
        if (k === 'chase' ? now < 6.5 : now < 3) env.interfere(k === 'chase' ? 0.42 * (1 - now / 6.5) : 0.16 * (1 - now / 3));
        // at the hole you crawled through, with your back turned: down on the carpet, its face in the hole
        const c = p.cross;
        if (c && p.unseen > 0.45 && getsDown({ since: c.t, d: Math.hypot(me.x - c.way.x, me.z - c.way.z), turned: c.turned, room: c.room,
          there: Math.hypot(p.x - c.near.x, p.z - c.near.z) < 0.5 || !!p.got?.there }) && hiddenAt(c.head.x, c.head.z, 0.7)
          && furnitureClear(w, p.x, p.z, c.head.x, c.head.z, 0.2) && furnitureClear(w, c.feet.x, c.feet.z, c.head.x, c.head.z, 0.2)) {
          p.down = { l: { t: 0, seen: 0, away: 0 }, head: c.head, feet: c.feet, yaw: c.yaw };
          p.arms[0].rotation.set(0, 0, -1.5); p.arms[1].rotation.set(0, 0, 1.5); p.plumb();
          env.play('shuffle', c.head.x, c.head.z, 6);
        } else if (now < 0.9 && Math.abs(w.floorY(p.x, p.z) - w.floorY(me.x, me.z)) < 0.6 && w.los(p.x, p.z, me.x, me.z)) seize(p);          // got you
      }
    }
    if (p.tearFor > 0) p.tearFor -= dt;
    const slip = p.tearFor > 0;
    if (slip !== p.slip || !seen) { p.slip = slip; p.show(); }
    if (p.down) {
      // stiff as ever: flat on its front, its head tipped back to look along the carpet
      p.group.position.set(p.down.feet.x, w.floorY(p.down.feet.x, p.down.feet.z) + 0.17, p.down.feet.z);
      p.group.rotation.set(Math.PI / 2, p.down.yaw, 0);
      p.head.rotation.set(-Math.PI / 2 - 0.25, 0, 0); p.head.scale.setScalar(FACE);
      p.shadow.visible = false;
    } else {
      p.group.position.set(p.x, w.floorY(p.x, p.z) + (p.plinth ? PLINTH : 0), p.z);
      p.group.rotation.set(0, p.yaw, 0);
      if (p.head.scale.x !== 1) { p.head.scale.setScalar(1); p.shadow.visible = true; }
    }
    // The prone pose extends beyond the standing centre. Its conservative
    // body covers feet to head, so a desk cannot slide through that extension.
    if (p.down) {
      p.body.x = (p.down.feet.x + p.down.head.x) / 2; p.body.z = (p.down.feet.z + p.down.head.z) / 2;
      p.body.r = BODY + Math.hypot(p.down.head.x - p.down.feet.x, p.down.head.z - p.down.feet.z) / 2;
    } else { p.body.x = p.x; p.body.z = p.z; p.body.r = BODY; }
    if (p.card?.use && p.card.held) { p.plumb(); reach(p); }
    p.lit -= dt;
    if (p.lit < 0 && p.group.visible) { p.lit = 0.2; p.light(w.lightAt(ex, ez, 1.0)); }
  }

  return {
    ready,
    update(dt) { if (arriving) arrive(dt); if (pirate) haunt(pirate, dt); },
    /** What it takes down the stairs after you, if it is after you at all: { awake, face, card, lost } — or null. */
    carry() {
      if (arriving) return { awake: true, face: arriving.face, card: arriving.card, lost: arriving.lost, wait: Math.max(6, arriving.wait) };
      if (!pirate || pirate.state !== 'awake') return null;
      // it comes down after you either way; but if it had lost you, it is a long while about it, and lands knowing nothing
      return { awake: true, face: pirate.face, card: !!(pirate.card && pirate.card.held), lost: pirate.know.mode === 'wander' || pirate.know.mode === 'look' };
    },
    wake,
    /**
     * The building's camera, for the three seconds after it has taken the last of somebody (docs/BACKROOMS.md). The camera
     * is no visitor: nobody is looking, so it moves — but a recording is frames, and it is only ever seen between them. Each
     * half second it is nearer, another face, its arms further out; the visitor's character backs off a step and goes down,
     * and the last frame is it standing over them.
     */
    takes(shot) {
      const p = pirate; if (!p) return undefined;
      const fig = shot.figure, W0 = W();
      // from wherever it had them: a stride and a half off, on its own side of them
      let dx = p.x - shot.x, dz = p.z - shot.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { dx = Math.sin(shot.yaw); dz = Math.cos(shot.yaw); d = 1; }
      dx /= d; dz /= d;
      const beats = [1.25, 1.0, 0.8, 0.62, 0.5, 0.42], poses = [3, 5, 7, 8, 7, 5];
      let beat = -1;
      p.down = null; p.plinth = false; p.group.visible = true; p.shadow.visible = true; p.head.scale.setScalar(1);
      const stand = (k) => {
        const off = beats[Math.min(k, beats.length - 1)];
        p.x = shot.x + dx * off; p.z = shot.z + dz * off; p.yaw = Math.atan2(-dx, -dz);
        p.face = (p.face + 1 + Math.floor(Math.random() * (p.faces.length - 1))) % p.faces.length;
        p.hold(poses[Math.min(k, poses.length - 1)]); p.slip = false; p.show();
        p.group.position.set(p.x, W0.floorY(p.x, p.z), p.z); p.group.rotation.set(0, p.yaw, 0);
        p.light(W0.lightAt(p.x, p.z, 1.0));
        if (k > 0) c.play('creak', p.x, p.z, 9);
      };
      stand(0);
      return (t) => {
        const k = Math.min(beats.length - 1, Math.floor(t / 0.5));
        if (k !== beat) { beat = k; stand(k); }
        if (!fig) return;
        // the visitor: a step back from it, and then down on their back, away from it
        const back = Math.min(1, t / 0.9) * 0.35, fall = Math.max(0, Math.min(1, (t - 0.9) / 0.7)), e = fall * fall * (3 - 2 * fall);
        fig.position.x = shot.x - dx * back; fig.position.z = shot.z - dz * back;
        fig.rotation.y = Math.atan2(dx, dz);                // facing it
        fig.rotation.x = -1.45 * e;
      };
    },
    /** A shove (shove.rule.js): awake and on its feet, it slides back and stands a moment — it is still there, and still looking. Against a wall it only stands. */
    shoveTargets() {
      const p = pirate;
      if (!p || p.state !== 'awake' || p.down) return [];
      return [{ id: 'pirate', x: p.x, z: p.z, y: (W()?.floorY(p.x, p.z) ?? 0) + 1.0, r: 0.32, shove: (dir) => {
        if (pirate !== p || p.state !== 'awake' || p.down) return false;
        const to = slide(p, dir, (x0, z0, x1, z1) => walk.clear(p, x0, z0, x1, z1));
        if (!p.known) { p.known = true; c.met(); }
        if (to) { p.x = to.x; p.z = to.z; p.plinth = false; p.handle = null; walk.forget(p); p.body.x = p.x; p.body.z = p.z; }
        c.stall(SHOVE.stagger);
        return true;
      } }];
    },
    snipTargets() {
      if (!pirate || pirate.state === 'caught' || (pirate.know?.spent > 0 && !c.vital)) return [];
      const ex = pirate.down ? pirate.down.head.x : pirate.x, ez = pirate.down ? pirate.down.head.z : pirate.z;
      const floorY = W()?.floorY(ex, ez) ?? 0;
      return [{
        id: 'pirate',
        x: ex,
        z: ez,
        y: floorY + (pirate.down ? 0.32 : 1.0),
        r: 0.32,
        priority: 2,
        snip: () => {
          if (!pirate || pirate.state === 'caught' || pirate.know?.spent > 0) return false;
          const hit = c.struck?.(1);                                  // (cast/health.rule.js: medium, two)
          if (hit && !hit.ok) return false;
          if (!pirate.known) { pirate.known = true; c.met(); }
          if (hit?.killed) { env.interfere(1); env.hud.glitch(0.7); env.sound.play('thunk'); pirate.hunted = false; c.survived(); return { ok: true, target: 'pirate' }; }
          if (pirate.state !== 'awake') awaken(pirate, false);
          breakOff(pirate);
          return { ok: true, target: 'pirate' };
        },
      }];
    },
    /** Where it is and what it is doing (for the dev page). */
    at() { return pirate ? { x: pirate.x, z: pirate.z, state: pirate.state, know: pirate.know.mode, making: pirate.know.room, down: !!pirate.down, handle: pirate.handle ? pirate.handle.t : null, barricade: pirate.shove ? { id: pirate.shove.id, time: pirate.shove.t } : null, room: W()?.roomAt(pirate.x, pirate.z)?.id ?? null, face: pirate.face, pose: pirate.pose, card: pirate.card ? pirate.card.held : null } : null; },
    get figure() { return pirate; },
    /**
     * It has been finished (the conductor, when its dying is over): the body stays where it fell, because of what it may
     * be holding — the keycard is still on its wrist, and is taken from it there as it was taken from it standing.
     */
    fell() { return !!pirate; },
    /**
     * Its dying (cast/health.rule.js: 0 → 1 over HEALTH.dying seconds; the conductor calls this and nothing else of it).
     * Standing: its face tears, its head snaps back, its arms fly out — and then, stiff as it always is, it goes over
     * backwards from the feet like a mannequin pushed, hits the carpet, rocks once and lies on its back with its arms out
     * to the sides, the keycard's wrist on the floor beside it where it can be taken. Already down on its front at a
     * hole: it shudders, its face goes down into the carpet and its arms twitch out flat. Nothing random: the clock of
     * its dying only.
     */
    dies(progress) {
      const p = pirate; if (!p) return;
      const k = Math.max(0, Math.min(1, progress)), sec = k * (c.vital?.takes || HEALTH.dying);          // (seconds: the rest of a longer dying is it lying there)
      if (!p.death) {
        const floor = W()?.floorY(p.x, p.z) ?? p.group.position.y;
        p.death = { y0: p.group.position.y, floor, yaw: p.group.rotation.y, down: !!p.down, lean: p.head.rotation.z };
      }
      const d = p.death, shake = Math.exp(-sec * 9) * Math.min(1, sec * 30);
      // the tear: its face slips, frame on frame, for the first of it, and then it is the face it had
      const slip = sec < 0.3 && Math.floor(sec * 24) % 2 === 0;
      if (slip !== p.slip) { p.slip = slip; p.show(); }
      if (d.down) {
        const drop = Math.min(1, Math.max(0, (sec - 0.15) / 0.4)), drop2 = drop * drop * (3 - 2 * drop), tw = Math.sin(sec * 31) * Math.exp(-sec * 3.5) * 0.22;
        p.head.rotation.set(-Math.PI / 2 - 0.25 + 0.65 * drop2 + shake * 0.2, 0, 0.3 * drop2);
        p.arms[0].rotation.set(0, 0, -1.5 - tw); p.arms[1].rotation.set(0, 0, 1.5 - tw * 0.7);
      } else {
        // stiff for a moment, then over from the feet, faster as it goes (it does not bend)
        const u = Math.min(1, Math.max(0, (sec - 0.16) / 0.5)), after = sec - 0.66;
        let a = -(Math.PI / 2) * u * u;
        if (after > 0) a += 0.16 * Math.exp(-after * 7) * Math.abs(Math.sin(after * 16));          // it hits, and rocks on its back
        const lie = Math.sin(-a);                                                                // (0 standing … 1 flat)
        p.group.position.y = d.y0 + (d.floor - d.y0) * Math.min(1, u * u * 1.4) + 0.12 * lie;   // (off its plinth if it was on one)
        p.group.rotation.set(a, d.yaw, 0);
        // arms: flung out with the blow, then lying out to its sides on the floor
        const fling = Math.min(1, sec / 0.12), out = 1.55 * fling - 0.2 * Math.max(0, Math.min(1, (sec - 0.7) / 0.3));
        const flop = after > 0 ? Math.sin(after * 14) * Math.exp(-after * 6) * 0.25 : 0;
        p.arms[0].rotation.set(-0.15 * lie + flop, 0, -out); p.arms[1].rotation.set(-0.15 * lie - flop, 0, out);
        // the head: back with the blow, and at the end it rolls to one side
        const roll = Math.max(0, Math.min(1, (sec - 0.72) / 0.35));
        p.head.rotation.set(-0.55 * shake + 0.25 * lie, 0, d.lean + (d.lean >= 0 ? 0.55 : -0.55) * roll * roll * (3 - 2 * roll));
        p.shadow.visible = lie < 0.5;
      }
      if (p.card) {
        // the card on its ribbon goes down along the arm and lies on the carpet beyond the hand
        if (d.down || p.group.rotation.x < -0.6) p.card.hang.quaternion.identity(); else p.plumb();
        if (p.card.use && p.card.held) reach(p);
      }
    },
    dispose() { if (pirate) { const i = W()?.bodies.indexOf(pirate.body); if (i >= 0) W().bodies.splice(i, 1); } pirate?.group.removeFromParent(); pirate = null; },
  };
}
