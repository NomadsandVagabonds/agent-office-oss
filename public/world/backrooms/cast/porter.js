// The Backrooms — the night porter. A man in a brown warehouse coat and a flat
// cap, mopping a carpet that has never been wet, beside a yellow bucket and a
// steel locker. Whichever way you come at him, he has his back to you: he is
// not hiding anything, he is busy. Leave the bucket alone and that is all there
// is to him. Knock it over and he stops, and turns round — slowly — and has no
// face: it has run, like clay left too near the heat, down over where the
// features were and off the chin. The tubes in his room sink, and stay sunk; walk out with it still on its side and he locks up for the night:
// every pair of doors on the floor is shut behind you. Stand it up again (E)
// and he goes back to his mopping — and the first time, his locker is open.
// The rule is minds(), in porter.rule.js.
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { Batch, lamp } from '../kit.js';
import { turnTo } from '../bits.js';
import { PORTER, mopping, minds, facesYou } from './porter.rule.js';

const S = 0.03;
function man() {
  const v = new Vox(), coat = M('#6b4f33', 2), grey = M('#4a4a50', 2), skin = M('#b98a66', 1), cap = M('#3b3a36', 2);
  for (const x0 of [-5, 1]) { v.box(x0, 0, -2, x0 + 4, 3, 4, M('#1f1a17', 1)); v.box(x0, 3, -2, x0 + 4, 22, 2, grey); }
  v.rbox(-7, 18, -4, 7, 46, 4, 2, coat); v.rbox(-7, 14, -4, 7, 20, 4, 1, coat, 'xz');                    // the coat, to the knee
  v.box(-1, 14, -5, 1, 44, -4, M('#57402a', 2));                                                            // its back seam
  for (const sx of [-1, 1]) { v.rbox(sx > 0 ? 7 : -10, 28, -2, sx > 0 ? 10 : -7, 46, 3, 1, coat); v.tube(sx * 8.5, 29, 1, sx * 6, 24, 7, 1.6, coat); v.box(sx * 6 - 1, 22, 6, sx * 6 + 1, 25, 9, skin); }
  v.box(-2, 46, -2, 2, 49, 2, skin); v.ellipsoid(0, 54, 0, 5, 5.5, 5, skin);
  // the face: no features, only clay that has run. A brow that has slumped over where the eyes were, two hollows dragged down out of
  // true, runs of it down the front, each a different length, and the jaw sagged off to one side and on to his collar
  const clay = [M('#c08e68', 3), M('#8d5f41', 3), M('#d9aa84', 3), M('#6d4a33', 3)];
  v.box(-4, 44, 3, 4, 55, 4, clay[3]);                                                                        // what is under it, where it has run thin
  v.ellipsoid(-1, 56, 4, 4.6, 1.8, 2.2, clay[2]);
  v.carve(-4, 53, 4, -2, 55, 6); v.carve(1, 51, 4, 3, 54, 6);
  [8, 4, 11, 6, 13, 5, 9, 7, 12, 3].forEach((len, i) => { const x = -5 + i, tone = clay[(i * 3 + 1) % 4], z1 = 5 + (i % 3 === 0 ? 2 : 1); v.box(x, 55 - len, 3, x + 1, 55, z1, tone); v.box(x, 54 - len, 4, x + 1, 56 - len, z1 + 1, clay[2]); });
  v.ellipsoid(2, 46, 4, 4.2, 3, 2.6, clay[1]); v.tube(2, 45, 5, 3, 38, 5, 1.2, clay[0]); v.tube(-2, 46, 5, -3, 41, 5, 0.9, clay[3]); v.box(2, 35, 4, 4, 38, 6, clay[2]);
  v.ellipsoid(0, 58, 0, 6, 2.6, 6, cap); v.box(-4, 56, 4, 4, 57, 9, cap);                                   // the cap, peak forward: you will not be seeing that
  return v;
}
function mop() { const v = new Vox(); v.tube(8, 3, 20, 7, 30, 8, 0.8, M('#9a7a4a', 1)); return v; }            // held low, at his side: nothing of it in front of his face
/** The head of it: old cloth strands, gone brown, splayed on the carpet round the socket they hang from. (About its own middle: it is squashed as he pushes.) */
function mopHead() {
  const v = new Vox(), tones = ['#84704f', '#665036', '#4a3826', '#766041', '#382a1c', '#5a462f'].map((c) => M(c, 3));
  v.rbox(-3, 3, -2, 3, 6, 2, 1, M('#4c5a66', 1));                                                           // the socket the strands are clamped in
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996, far = 4 + ((i * 7) % 5), hang = 1.2 + ((i * 5) % 3) * 0.5, tone = tones[(i * 5 + (i >> 2)) % tones.length];
    const x = Math.cos(a) * far, z = Math.sin(a) * far * 0.8;
    v.tube(Math.cos(a) * 1.5, 4, Math.sin(a) * 1.5, x * 0.6, hang, z * 0.6, 0.9, tone); v.tube(x * 0.6, hang, z * 0.6, x, 0.5, z, 0.8, tone);
    if (i % 4 === 0) v.tube(x, 0.5, z, x * 1.25, 0.4, z * 1.25, 0.6, tones[4]);                              // a few have come loose and trail
  }
  return v;
}
/** What hangs off his chin: a rope of the same clay, with a bead at the end of it. (From the point it hangs by.) */
const strand = (len, tone) => () => { const v = new Vox(), k = M(tone, 3); v.tube(0, 0, 0, 0, -len, 0, 0.9, k); v.ellipsoid(0, -len - 1.5, 0, 1.4, 1.9, 1.4, M('#d9aa84', 3)); return v; };
// the runs of it that hang free: where each hangs from (in his own voxels), how long it is, and how lazily it swings
const STRANDS = [[2.5, 44, 5.5, 8, '#c08e68', 1], [-3, 45, 5.6, 5, '#8d5f41', 1.5], [4.5, 47, 5.2, 4, '#c08e68', 1.9], [-0.5, 43, 6, 6, '#a9795a', 1.25], [-4.5, 49, 5, 3, '#d9aa84', 2.3]];
function bucket() { const v = new Vox(), y = M('#d9b21c', 1); v.cyl('y', 0, 0, 0, 10, 5.5, y, 4.6); v.cyl('y', 0, 0, 0, 1, 5.5, y); v.cyl('y', 0, 0, 9, 10, 6, M('#b8960f', 1), 5); return v; }
function locker() {
  const v = new Vox(), st = M('#7d8a8c', 0);
  v.box(-7, 0, -6, 7, 62, 6, st); v.carve(-6, 1, -5, 6, 61, 6);
  v.box(-6, 30, -5, 6, 31, 5, st); v.box(-3, 31, -2, 3, 36, 3, M('#2b2b2e', 1)); v.box(-2, 36, -1, 2, 38, 2, M('#c9c6b8', 0));      // a shelf, and what he keeps on it: a battery
  return v;
}
function lockerDoor() { const v = new Vox(), st = M('#8b989a', 0); v.box(0, 1, 0, 13, 61, 1, st); for (const y of [50, 53, 56]) v.box(3, y, 1, 10, y + 1, 2, M('#55606a', 0)); v.box(10, 28, 1, 12, 34, 2, M('#2b2b2e', 0)); return v; }

export function create(c) {
  const env = c.env, kit = env.kit;
  let s = mopping(), parts = null, at = null, b = null, righted = false, over = 0, yaw = 0, sweep = 0, open = 0, known = false, home = null, lit = [1, 1, 1];

  function ready() {
    if (c.home === null) return;                                    // no room on this floor would do: he is not in tonight
    home = env.world.rooms[c.home];
    const walker = { r: 0.3, tall: 1.9 }, p = c.walk.spotIn(walker, c.home);
    // the bucket a pace from him, the locker a little further, wherever there is floor for them
    const free = (r0, r1, need) => { for (let k = 0; k < 40; k++) { const a = c.R.range(0, 6.28), r = c.R.range(r0, r1), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (c.room(x, z) === c.home && c.walk.stand({ r: need, tall: 1.9 }, x, z)) return { x, z }; } return null; };
    b = free(0.85, 1.2, 0.3); const l = free(1.6, 2.6, 0.45);
    if (!b || !l) { home = null; return; }
    const mat = kit.surface({ vox: true }), m4 = new THREE.Matrix4().makeScale(S, S, S), lights = [lamp(0.3, 2.6, 0.8, [1.2, 1.2, 1.2], { k: 9, wrap: 0.45, far: 30 })];
    const mesh = (key, make) => { const q = new Batch(true); q.addVox(kit.model('porter6:' + key, make).solid, m4); return new THREE.Mesh(kit.geometry(q, lights, [0.6, 0.6, 0.6]), mat); };
    const y = env.world.floorY(p.x, p.z), g = (x, z, ...kids) => { const o = new THREE.Group(); o.position.set(x, y, z); o.add(...kids); return c.add(o); };
    const mopM = new THREE.Group(), headM = mesh('mophead', mopHead), doorM = mesh('door', lockerDoor), hinge = new THREE.Group();
    headM.position.set(8 * S, 0, 20 * S); mopM.add(mesh('mop', mop), headM);
    const drips = STRANDS.map(([x, y, z, len, tone, quick], i) => { const m = mesh('strand' + i, strand(len, tone)); m.position.set(x * S, y * S, z * S); return { m, quick, a: 0, v: 0, off: i * 1.7 }; });
    hinge.position.set(-6.5 * S, 0, 6 * S); hinge.add(doorM);
    parts = { mat, man: g(p.x, p.z, mesh('man', man), mopM, ...drips.map((k) => k.m)), mop: mopM, head: headM, drips, bucket: g(b.x, b.z, mesh('bucket', bucket)), locker: g(l.x, l.z, mesh('locker', locker), hinge), hinge };
    parts.locker.rotation.y = Math.atan2(p.x - l.x, p.z - l.z);
    at = p; yaw = c.R.range(-3, 3);
    c.body({ x: p.x, z: p.z, r: 0.3 }); c.body({ x: l.x, z: l.z, r: 0.34 });
    lit = c.light(p.x, p.z).map((v) => v * 1.5 + 0.05); mat.uniforms.uTint.value.set(lit[0], lit[1], lit[2]);
    // E, at the bucket, once it is on its side
    c.use({ x: b.x, z: b.z, r: 1.1, when: () => s.mode !== 'mop', use: () => { righted = true; } });
  }

  return {
    ready,
    update(dt) {
      if (!home || !parts) return;
      const m = c.me(), d = Math.hypot(m.x - at.x, m.z - at.z), inRoom = c.room(m.x, m.z) === c.home;
      parts.man.visible = parts.bucket.visible = parts.locker.visible = home.group.visible;
      if (!known && inRoom && d < 9 && !c.hidden(at.x, at.z, 0.4)) { known = true; c.met(); }
      s = minds(s, dt, { bucket: Math.hypot(m.x - b.x, m.z - b.z), moving: m.moving, righted, inRoom });
      righted = false;
      if (s.knocked) { c.play('clack', b.x, b.z, 8); c.play('thunk', b.x, b.z, 8); env.interfere(0.4); }
      if (s.righted) { c.play('click', b.x, b.z, 6); env.world.setLights(home, 1); }
      if (s.gift) { c.play('door', parts.locker.position.x, parts.locker.position.z, 8); c.give({ id: 'porter:battery', type: 'battery', quantity: 1 }); }
      if (s.lockUp) { for (const door of env.doors?.list || []) env.doors.shut(door, 'porter'); c.play('thunk', at.x, at.z, 14); }
      if (s.mode !== 'mop') env.world.setLights(home, PORTER.dim + (Math.random() < 0.04 ? 0.3 : 0));
      // the bucket goes over, and comes back up
      over += ((s.mode === 'mop' ? 0 : 1) - over) * (1 - Math.exp(-9 * dt));
      parts.bucket.rotation.z = over * 1.5; parts.bucket.position.y = env.world.floorY(b.x, b.z) + over * 0.16;
      open += ((s.thanked ? 1 : 0) - open) * (1 - Math.exp(-3 * dt)); parts.hinge.rotation.y = -open * 1.9;
      // his back to you, always; and while there is nothing the matter, the mop goes to and fro
      // …and with the bucket on its side he turns round, at his own pace, and keeps what he has for a face on you
      const front = facesYou(s), want = front ? Math.atan2(m.x - at.x, m.z - at.z) : Math.atan2(at.x - m.x, at.z - m.z), rate = front ? PORTER.round : PORTER.turn;
      if (!front && c.hidden(at.x, at.z, 0.5)) yaw = want;             // (unwatched, he simply has his back to you already)
      else if (d < 14) yaw += Math.max(-rate * dt, Math.min(rate * dt, turnTo(yaw, want)));
      // what hangs off his chin is slow to follow when he turns, and swings on after he has stopped
      const turned = turnTo(parts.man.rotation.y, yaw) / Math.max(dt, 1e-3);
      for (const k of parts.drips) {                                    // (the short ones are quicker about it than the long one)
        k.v += (-PORTER.sway * k.quick * k.a - PORTER.damp * k.v - turned * PORTER.fling) * dt; k.a = Math.max(-1.3, Math.min(1.3, k.a + k.v * dt));
        k.m.rotation.z = k.a + Math.sin(sweep * 2.4 * k.quick + k.off) * PORTER.idle; k.m.rotation.x = Math.sin(sweep * 1.7 * k.quick + k.off) * PORTER.idle * 0.6;
      }
      parts.man.rotation.y = yaw;
      if (s.mode === 'mop') { sweep += dt; if (Math.floor(sweep / 1.3) !== Math.floor((sweep - dt) / 1.3) && d < 9) c.play('shuffle', at.x, at.z, 5); }
      const push = Math.sin(sweep * 2.4);
      parts.mop.position.z = push * 0.12; parts.mop.rotation.y = push * 0.12;
      // the old cloth spreads as he leans on it and gathers as he draws it back
      parts.head.scale.set(1 + 0.16 * push, 1 - 0.22 * Math.max(0, push), 1 + 0.2 * push); parts.head.rotation.y = push * 0.35;
    },
    at: () => (home ? { x: at.x, z: at.z, room: c.home, mode: s.mode, thanked: s.thanked, bucket: b, yaw } : { room: null }),
    dispose() { if (home) env.world?.setLights(home, 1); for (const k of ['man', 'bucket', 'locker']) parts?.[k].removeFromParent(); },
  };
}
