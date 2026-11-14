// The Backrooms — what follows you. In some visits there is a mascot on a
// plinth somewhere in the level: a goblin dressed as a pirate, stiff as a shop
// dummy, arms held out from its sides, with a face that did not come out right
// and is not the same face the next time you look. Once you have met it and
// turned your back it comes after you, but only ever while you are not
// looking: watch it and it is a mannequin. Walk into it while you watch and it
// was never there. Let it reach you from behind and the tape ends ('caught').
// While the office's keycard for this place has not been found (loot.js), the
// mascot is holding it: on a loop of ribbon, from one hand, held out. Walk up
// and take it — which it notices, the way it notices being looked at.
// Also here: the cardboard colleague who sometimes decides to come along.
import * as THREE from 'three';
import { Vox, M } from '../vox/vox.js';
import { keycard } from '../props/loot.js';
import { Batch, lamp, lin, drawText } from './kit.js';
import { makeRng, RISE, RUN } from './gen.js';
import { P, clamp, turnTo } from './bits.js';

const SC = 1.25, S = 0.025 * SC;                 // sculpted chunkier than the furniture: one voxel is 3.1 cm
const TALL = 1.62, PLINTH = 0.16;
const SKIN = '#7ea04a', SKIN_D = '#56733a', BEARD = '#1e1a1c', FELT = '#4d311d', BRAID = '#b39245', COAT = '#b9923a', SHIRT = '#2c8a79';
const BELT = '#221a16', GOLD = '#e2ba48', SASH = '#7f7392', BOOT = '#2b1d15', CLOTH = '#393843';
const CARD = 0.02;                               // metres to a voxel of the keycard in its hand: a size down from the office's, or it would be a placard
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

function makePirate(kit, R, first = 0) {
  const mat = kit.surface({ vox: true }), m4 = new THREE.Matrix4().makeScale(S, S, S);
  const lights = [lamp(0.25, 2.6, 0.9, [1.3, 1.3, 1.3], { k: 9, wrap: 0.45, far: 30 })], amb = [0.6, 0.6, 0.6];
  const part = (key, make) => { const b = new Batch(true); b.addVox(kit.model('pirate:' + key, make).solid, m4); return new THREE.Mesh(kit.geometry(b, lights, amb), mat); };
  const group = new THREE.Group(), head = new THREE.Group();
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
    group, head, arms, faces, mat, face: first % faces.length, pose: 0, slip: false, card: null,
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
    plumb() { if (p.card) p.card.hang.quaternion.copy(arms[p.card.side].quaternion).invert(); },
    light(rgb) { mat.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); },
  };
  p.show(); p.hold(0);
  return p;
}

/* ---- getting about when nobody is looking ---------------------------------------------- */

export function createStalkers(env) {
  const level = env.level, R = makeRng(`${level.seed}/pursuer`);
  const W = () => env.world;
  const hiddenAt = (x, z, r = 0.6) => !env.sees(x, z, { radius: r, margin: 0.2, far: 40 });
  const stand = (a, x, z) => W().free(x, z, a.r) && W().headroom(x, z) >= a.tall;
  const shy = (rt) => !rt || rt.fold || !!rt.clip || rt.def.crawl || rt.def.H < 1.7;      // rooms it will not stop in
  const run = (d) => (d && d.sill > 0.01 ? (Math.round(d.sill / RISE) - 1) * RUN : 0);
  let pirate = null, follower = null;

  /** Some strides toward a point, sliding round what is in the way. → how far it got. */
  function stride(a, tx, tz, dist) {
    let went = 0;
    while (dist > 1e-3) {
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      if (d < 0.02) break;
      const s = Math.min(dist, d, 0.09);
      let moved = false;
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
        const cs = Math.cos(turn), sn = Math.sin(turn), nx = a.x + ((dx * cs - dz * sn) / d) * s, nz = a.z + ((dx * sn + dz * cs) / d) * s;
        if (stand(a, nx, nz) && W().passable(a.x, a.z, nx, nz)) { a.x = nx; a.z = nz; moved = true; break; }
      }
      if (!moved) break;
      went += s; dist -= s;
    }
    return went;
  }
  /** The way from where it stands to the player: the same room, or a doorway to line up with (A), its far side (B), or a place to be next (hop). */
  function route(a, me) {
    const w = W(), here = w.roomAt(a.x, a.z), there = w.roomAt(me.x, me.z);
    if (!here || !there) return null;
    if (here === there) return { same: true };
    const path = w.path(here.id, there.id);
    if (!path || path.length < 2) return null;
    const inside = (from, to, off) => {                              // a spot in room `to`, just past the door it shares with `from`
      const d = w.doorway(from.id, to.id), mine = to.def.doors.find((x) => x.to === from.id);
      if (!d || !d.open) return null;
      const s = Math.sign((to.def.cx - d.x) * d.nx + (to.def.cz - d.z) * d.nz) || 1, k = off + run(mine);
      return { x: d.x + d.nx * s * k, z: d.z + d.nz * s * k, h: mine ? mine.h : 2 };
    };
    const next = w.rooms[path[1]], A = inside(next, here, 0.55), B = inside(here, next, 0.55);
    if (!A || !B) return null;
    const r = { key: here.id + '>' + next.id, A, B, hop: null, wait: false };
    // doors too low to walk through and rooms it cannot stand in are crossed in one go, when nobody is looking — or not at all
    if (A.h < a.tall || shy(next)) {
      r.wait = true;
      for (let i = 1; i < path.length; i++) {
        const spot = inside(w.rooms[path[i - 1]], w.rooms[path[i]], 0.6);
        if (!spot) return null;
        if (!shy(w.rooms[path[i]])) { r.hop = spot; r.wait = false; break; }
      }
    }
    return r;
  }
  /** Carry on along a route for `dist` metres. → how far it got. */
  function travel(a, r, dist) {
    if (a.to) { const went = stride(a, a.to.x, a.to.z, dist); if (Math.hypot(a.to.x - a.x, a.to.z - a.z) < 0.1) a.to = null; return went; }
    if (a.leg !== r.key) { if (Math.hypot(r.A.x - a.x, r.A.z - a.z) > 0.12) return stride(a, r.A.x, r.A.z, dist); a.leg = r.key; }
    if (r.wait) return dist;
    if (r.hop) {
      if (!hiddenAt(r.hop.x, r.hop.z) || !stand(a, r.hop.x, r.hop.z)) return dist;
      a.x = r.hop.x; a.z = r.hop.z; a.leg = null;
      return dist;
    }
    a.to = r.B; a.leg = null;
    return stride(a, r.B.x, r.B.z, dist);
  }
  /** Move a walker toward the player for `step` seconds, stopping `keep` short. Never where it could be seen arriving. → how far it went. */
  function approach(a, step, keep) {
    const me = env.player.me, bx = a.x, bz = a.z, r = route(a, me), want = a.speed * step;
    if (!r) return 0;
    let went = 0;
    if (r.same && !a.to) { const d = Math.hypot(me.x - a.x, me.z - a.z); went = d > keep + 0.05 ? stride(a, me.x, me.z, Math.min(want, d - keep)) : want; }
    else went = travel(a, r.same ? { key: '' } : r, want);
    // stuck behind something: nobody is looking, so it is simply further on
    a.idle = went < want * 0.25 ? (a.idle || 0) + step : 0;
    if (a.idle > 1.2) {
      let t = a.to || (r.same ? null : a.leg === r.key ? r.B : r.A);
      if (!t) { const d = Math.hypot(me.x - a.x, me.z - a.z), k = Math.min(1.4, d - keep - 0.6) / d; if (k > 0) t = { x: a.x + (me.x - a.x) * k, z: a.z + (me.z - a.z) * k }; }
      a.idle = 0;
      if (t && stand(a, t.x, t.z) && hiddenAt(t.x, t.z)) { a.x = t.x; a.z = t.z; a.to = null; went = want; }
    }
    if (!hiddenAt(a.x, a.z, a.r + 0.3)) { a.x = bx; a.z = bz; return 0; }          // it would have walked into view: it waits instead
    return Math.hypot(a.x - bx, a.z - bz);
  }
  const drawn = (a) => { const rt = W().roomAt(a.x, a.z); return !!rt && rt.group.visible; };

  /* ---- the mascot ------------------------------------------------------------------------ */

  function mascot(x, z, yaw, onPlinth) {
    pirate = Object.assign(makePirate(env.kit, R, level.pursuer?.face || 0), {
      x, z, yaw, r: 0.26, tall: TALL, speed: 1.9, state: 'still', plinth: onPlinth, home: { x, z, yaw, plinth: onPlinth },
      met: 0, unseen: 0, rolled: false, chase: 0, rest: 0, noise: 0.5, tearIn: 2 + R() * 3, tearFor: 0, lit: 0,
      patience: R.range(2.2, 4.5), wakeAt: R.range(150, 260), stamina: R.range(60, 95), catchT: 0,
    });
    pirate.group.position.set(x, onPlinth ? PLINTH : 0, z); pirate.group.rotation.y = yaw;
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
    // the keycard, if it still has it: in the hand on the side its name plate is not, unless that would put the card in the wall
    if (level.loot?.card) {
      const room = (sx) => Math.min(c.W / 2 - Math.abs(k.x + sx * 0.85 * fz), c.D / 2 - Math.abs(k.z - sx * 0.85 * fx));
      p.give(room(-1) >= 0.2 || room(-1) >= room(1) ? 0 : 1);
    }
  };
  (env.ready ||= []).push(() => {
    if (level.pursuer && !pirate) {                                   // the room it was meant for was never built: it stands in the middle of it
      const def = level.rooms[level.pursuer.room], p = mascot(def.cx, def.cz, 0, false);
      p.group.position.y = def.y; W().scene.add(p.group);
      if (level.loot?.card) p.give(level.pursuer.face % 2);
    }
    if (pirate?.card) offer(pirate);
  });

  /* ---- the card in its hand ---------------------------------------------------------------- */

  const hand = new THREE.Vector3();
  /** Something to press E at: the card, wherever the hand holding it has got to. Taking it is noticed. */
  function offer(p) {
    p.card.use = { r: 1.2, wx: p.x, wz: p.z, room: null, when: () => p.card.held && p.state !== 'caught' && p.group.visible,
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
      if (best) { p.x = best.x; p.z = best.z; p.plinth = false; p.to = null; p.leg = null; }
    }
    p.state = 'awake'; p.chase = 0; p.met = 1;
    return true;
  }
  /** Somewhere else entirely, out of sight. */
  function elsewhere(p) {
    const me = env.player.me, here = W().roomAt(me.x, me.z), dist = W().distances(here.id);
    const rooms = W().rooms.filter((rt) => !shy(rt) && (dist.get(rt.id) ?? 9) >= 2);
    for (let i = 0; i < 60 && rooms.length; i++) {
      const rt = rooms[Math.floor(Math.random() * rooms.length)], x = rt.rect.x0 + 0.6 + Math.random() * (rt.rect.x1 - rt.rect.x0 - 1.2), z = rt.rect.z0 + 0.6 + Math.random() * (rt.rect.z1 - rt.rect.z0 - 1.2);
      if (stand(p, x, z) && hiddenAt(x, z, 1)) { p.x = x; p.z = z; p.plinth = false; p.to = null; p.leg = null; return true; }
    }
    return false;
  }

  function haunt(p, dt) {
    const w = W(), me = env.player.me, dx = me.x - p.x, dz = me.z - p.z, d = Math.hypot(dx, dz);
    p.group.visible = drawn(p);
    if (p.state === 'caught') {                                       // the last thing on the tape
      p.catchT += dt;
      me.yaw += turnTo(me.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-16 * dt));
      me.pitch += ((p.card?.back ? 0.08 : 0.27) - me.pitch) * (1 - Math.exp(-12 * dt));
      p.slip = Math.random() < 0.3; p.show();
      env.interfere(1);
      return;
    }
    const seen = p.group.visible && env.sees(p.x, p.z, { radius: 0.6, margin: 0.18, far: 40 });
    const toMe = Math.atan2(dx, dz);
    if (seen) {
      p.unseen = 0; p.rolled = false;
      if (d < 12) p.met += dt;
      // a bad frame now and then: for an instant the head is not where it was
      p.tearIn -= dt;
      if (p.tearIn < 0 && d < 9) { p.tearIn = 1.2 + Math.random() * 4.5; p.tearFor = 0.06 + Math.random() * 0.1; env.interfere(0.3); }
      // walk into it with your eyes open and it was never there
      if (p.state === 'awake' && d < 0.62) {
        env.interfere(1); env.hud.glitch(0.8); env.sound.play('static', { dur: 0.3, vol: 0.7 });
        if (!elsewhere(p)) { p.x = p.home.x; p.z = p.home.z; }
        p.state = 'rest'; p.rest = 14 + Math.random() * 10; p.tearFor = 0;
      }
    } else {
      p.unseen += dt;
      const step = dt;
      if (p.unseen > 0.3 && !p.rolled) {                              // every time you look back: another face, another way of standing
        p.rolled = true;
        p.face = (p.face + 1 + Math.floor(Math.random() * (p.faces.length - 1))) % p.faces.length;
        const near = p.state === 'awake' && d < 2.6;
        p.hold(near ? 7 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 7), p.plinth ? clamp(turnTo(p.yaw, toMe), -1.3, 1.3) : 0);
      }
      if (p.state === 'still' || p.state === 'rest') {
        if (!p.plinth) p.yaw = toMe; else p.head.rotation.y = clamp(turnTo(p.yaw, toMe), -1.3, 1.3);
        p.rest -= dt;
        const far = d > 2.4 || w.roomAt(me.x, me.z) !== w.roomAt(p.x, p.z);
        if (p.state === 'still' ? (p.met > 0.6 && p.unseen > p.patience && far) || env.clock > p.wakeAt : p.rest < 0) { p.state = 'awake'; p.chase = 0; }
      } else if (p.state === 'awake') {
        p.chase += dt;
        p.speed = d > 5.5 ? 1.85 : 1.05;                                // it hurries only while it is far behind
        if (p.plinth && p.unseen > 0.45) {                              // down off its plinth, on whichever side is free
          for (const turn of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI]) {
            const x = p.home.x + Math.sin(p.home.yaw + turn) * 0.95, z = p.home.z + Math.cos(p.home.yaw + turn) * 0.95;
            if (stand(p, x, z) && hiddenAt(x, z)) { p.x = x; p.z = z; p.plinth = false; break; }
          }
        }
        const went = p.unseen > 0.45 && !p.plinth ? approach(p, step, 0.5) : 0;
        if (went > 0) {
          p.yaw = Math.atan2(me.x - p.x, me.z - p.z);
          p.noise -= went;
          if (p.noise < 0) { p.noise = 1.0 + Math.random() * 1.4; env.play('creak', p.x, p.z, 5); }
          if (Math.hypot(me.x - p.x, me.z - p.z) < 2.6 && p.pose < 7) p.hold(7 + Math.floor(Math.random() * 2));
        }
        const now = Math.hypot(me.x - p.x, me.z - p.z);
        if (now < 6.5) env.interfere(0.42 * (1 - now / 6.5));
        if (now < 0.9 && Math.abs(w.floorY(p.x, p.z) - w.floorY(me.x, me.z)) < 0.6) {          // got you
          const hit = env.health?.damage(1);
          if (hit?.ok && !hit.dead) {
            // A surviving encounter breaks its pursuit. The player keeps
            // control, and the mascot cannot hit again during this retreat.
            if (!elsewhere(p)) { p.x = p.home.x; p.z = p.home.z; p.yaw = p.home.yaw; p.plinth = p.home.plinth; }
            p.state = 'rest'; p.rest = 14 + Math.random() * 10; p.chase = p.catchT = p.idle = p.tearFor = p.unseen = 0;
            p.to = p.leg = null; p.rolled = false; p.hold(0);
            env.interfere(.85); env.hud.glitch(.6); env.sound.play('thunk');
          } else if (!hit || hit.ok) {
            const k = 0.62 / Math.max(now, 0.05);
            const nx = me.x - (me.x - p.x) * k, nz = me.z - (me.z - p.z) * k;
            if (w.free(nx, nz, 0.1)) { p.x = nx; p.z = nz; }
            p.yaw = Math.atan2(me.x - p.x, me.z - p.z); p.state = 'caught'; p.catchT = 0;
            p.hold(7);
            if (p.card && !p.card.held && env.loot?.carried.card) {       // …and it has its card back: held up between you, where the tape cannot miss it
              p.card.held = p.card.back = true; p.card.hang.visible = true; env.loot.forfeit();
              p.arms[p.card.side].rotation.set(-2.5, 0, p.card.side ? -0.35 : 0.35); p.plumb();
            }
            env.sound.play('thunk');
            if (!hit) env.end('caught');                           // optional health already ended a fatal hit
          }
        } else if (p.chase > p.stamina && now > 8) { p.state = 'rest'; p.rest = 28 + Math.random() * 25; p.stamina = 45 + Math.random() * 40; }
      }
    }
    if (p.tearFor > 0) p.tearFor -= dt;
    const slip = p.tearFor > 0;
    if (slip !== p.slip || !seen) { p.slip = slip; p.show(); }
    p.group.position.set(p.x, w.floorY(p.x, p.z) + (p.plinth ? PLINTH : 0), p.z);
    p.group.rotation.y = p.yaw;
    if (p.card?.use && p.card.held) reach(p);
    p.lit -= dt;
    if (p.lit < 0 && p.group.visible) { p.lit = 0.2; p.light(w.lightAt(p.x, p.z, 1.0)); }
  }

  /* ---- the colleague who comes along --------------------------------------------------- */

  /** A cutout from the room of cutouts asks to follow you out of it. (k: { g, x, z, rot } in that room's frame.) */
  env.adopt = (c, k) => {
    if (follower || !env.player) return false;
    const at = c.toWorld(k.x, k.z);
    c.rt.group.remove(k.g); c.world.scene.add(k.g);
    follower = { g: k.g, x: at.x, z: at.z, r: 0.2, tall: 1.3, speed: 2.7, wait: 0, unseen: 0 };
    k.g.position.set(at.x, c.room.y, at.z);
    return true;
  };
  function tag(f, dt) {
    const w = W(), me = env.player.me;
    f.g.visible = drawn(f);
    f.wait += dt; if (f.wait < 0.2) return;
    const step = f.wait; f.wait = 0;
    if (!hiddenAt(f.x, f.z, 0.55)) { f.unseen = 0; return; }
    f.unseen += step; if (f.unseen < 0.7) return;
    const went = approach(f, step, 1.7);
    f.g.position.set(f.x, w.floorY(f.x, f.z), f.z);
    f.g.rotation.y = Math.atan2(me.x - f.x, me.z - f.z);
    f.g.userData.light?.(w.lightAt(f.x, f.z, 1.0));
    if (went > 0.05 && Math.random() < 0.3) env.play('shuffle', f.x, f.z, 4);
  }

  env.clock = 0;
  env.pursuer = {
    update(dt) {
      if (!env.player || !env.world) return;
      env.clock += dt;
      if (follower) tag(follower, dt);
      if (pirate) haunt(pirate, dt);
    },
    wake,
    /** Where it is and what it is doing (for the dev page). */
    at() { return pirate ? { x: pirate.x, z: pirate.z, state: pirate.state, room: W()?.roomAt(pirate.x, pirate.z)?.id ?? null, face: pirate.face, pose: pirate.pose, card: pirate.card ? pirate.card.held : null } : null; },
    get follower() { return follower ? { x: follower.x, z: follower.z } : null; },
    get figure() { return pirate; },
    dispose() { pirate?.group.removeFromParent(); follower?.g.removeFromParent(); pirate = null; follower = null; },
  };
}
