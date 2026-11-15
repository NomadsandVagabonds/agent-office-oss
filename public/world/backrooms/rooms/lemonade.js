// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Stand
// ("the lemonade stand that is going down"). A child's lemonade stand, leaning,
// one end of it under the grass, and the child who keeps it: a girl in a
// frock, as remembered by something that got as far as her face and could not
// stop. She has a glass of lemonade for you.
//
// Her rule (pure, below). She comes after whoever is in her room, holding the
// glass out, at less than a walk. Take it (E) and it is a heart back, and she
// skips home to the stand. Keep her waiting and she starts to shake; keep her
// waiting longer and she comes at a run, and that is a heart gone. Then she
// goes home, and after a while she tries again. She never leaves the room,
// and leaving it is always allowed: outside it her patience comes back.
import * as THREE from 'three';
import { Batch } from '../kit.js';
import { P } from '../bits.js';
import { garble, lawn, daylight, beam, TIMBER, WHITEWASH } from '../suburb.js';

export const STAND = Object.freeze({ patience: 14, shakes: 0.65, walk: 1.05, run: 3.4, skip: 1.8, reach: 0.95, grab: 0.62, sulk: 9, glasses: 3 });
/**
 * One moment of her. s: { mode: 'home' | 'offer' | 'angry' | 'back', waited, sulk, glasses }
 * sense: { inside (the visitor is in her room), d (metres to them), took (they took the glass this moment), home (she is at the stand) }
 * → the same s, changed, and what happened: null | 'gave' | 'hit'. Pure.
 */
export function minds(s, dt, sense) {
  s.sulk = Math.max(0, s.sulk - dt);
  if (s.mode === 'home') { if (sense.inside && s.sulk <= 0 && s.glasses > 0) { s.mode = 'offer'; s.waited = 0; } return null; }
  if (s.mode === 'back') { if (sense.home) s.mode = 'home'; return null; }
  if (!sense.inside) { s.waited = Math.max(0, s.waited - dt * 2); if (s.mode === 'angry' || s.waited <= 0) { s.mode = 'back'; } return null; }
  if (s.mode === 'offer') {
    if (sense.took) { s.glasses -= 1; s.mode = 'back'; s.happy = true; s.sulk = STAND.sulk; return 'gave'; }
    s.waited += dt; if (s.waited >= STAND.patience) s.mode = 'angry';
    return null;
  }
  if (s.mode === 'angry' && sense.d < STAND.grab) { s.mode = 'back'; s.happy = false; s.sulk = STAND.sulk; s.waited = 0; return 'hit'; }
  return null;
}

/** Her, a metre and a bit of her, facing +z: boxes, and a face that goes on round the side of her head. */
function girl(c) {
  const kit = c.kit, body = new Batch(), face = new Batch(), skin = [0.86, 0.66, 0.54], frock = [0.55, 0.72, 0.82], hair = [0.5, 0.1, 0.06];
  body.box(-0.11, 0, -0.05, -0.03, 0.34, 0.05, skin); body.box(0.03, 0, -0.05, 0.11, 0.34, 0.05, skin);
  body.box(-0.12, 0, -0.06, -0.02, 0.07, 0.09, [0.1, 0.08, 0.08]); body.box(0.02, 0, -0.06, 0.12, 0.07, 0.09, [0.1, 0.08, 0.08]);
  body.box(-0.22, 0.3, -0.16, 0.22, 0.42, 0.16, frock); body.box(-0.18, 0.42, -0.13, 0.18, 0.54, 0.13, frock); body.box(-0.14, 0.54, -0.1, 0.14, 0.78, 0.1, frock); body.box(-0.15, 0.6, -0.105, 0.15, 0.63, 0.105, WHITEWASH);
  body.box(-0.2, 0.5, -0.04, -0.14, 0.76, 0.04, skin); body.box(0.14, 0.62, -0.04, 0.2, 0.76, 0.3, skin);                   // one arm down, one held out
  body.box(0.13, 0.76, 0.24, 0.21, 0.88, 0.32, [0.95, 0.85, 0.3]);                                                       // the glass
  body.box(-0.15, 0.8, -0.14, 0.15, 1.1, 0.14, skin);
  body.box(-0.17, 1.02, -0.16, 0.17, 1.14, 0.15, hair); body.box(-0.17, 0.74, -0.16, 0.17, 1.1, -0.13, hair); body.box(-0.19, 0.7, -0.15, -0.15, 1.08, 0.1, hair); body.box(0.15, 0.86, -0.15, 0.19, 1.08, 0.02, hair);
  body.box(-0.06, 1.14, -0.04, 0.06, 1.19, 0.04, [0.85, 0.2, 0.25]);                                                     // a bow
  // the face: a face, and then more of it, sliding round to where her ear should be
  const tex = kit.tex.custom('stand:face', 48, 24, (g) => {
    P(g, '#dba98a', 0, 0, 48, 24);
    const eye = (x, y, s) => { P(g, '#f4f1e4', x, y, 4 * s, 3 * s); P(g, '#5f7f8a', x + s, y, 2 * s, 3 * s); P(g, '#1a1412', x + 1.5 * s, y + s, s, s); };
    eye(5, 7, 1);
    for (let i = 0; i < 5; i++) { const x = 14 + i * 7, y = 7 + i * 0.6; if (i) eye(x + 1, y - 1 + (i % 2), 0.75 - i * 0.08); P(g, '#c48b6e', x, y + 2, 2, 6); P(g, '#b0745a', x - 1, y + 7, 4, 1); }
    for (let i = 0; i < 4; i++) { P(g, '#a8473f', 6 + i * 9, 17 + i * 0.7, 12, 1.5); P(g, '#8a332e', 6 + i * 9, 18.5 + i * 0.7, 12, 1); P(g, '#c48b6e', 8 + i * 9, 20.5 + i * 0.7, 9, 1); }
    for (let x = 22; x < 48; x += 3) P(g, '#c9977a', x, 3 + ((x * 7) % 5), 1, 16);
  }, { clamp: true });
  const z = 0.142, x1 = 0.152;
  face.quad([-0.15, 0.8, z], [0.15, 0.8, z], [0.15, 1.1, z], [-0.15, 1.1, z], [1, 1, 1], [[0, 0], [0.74, 0], [0.74, 1], [0, 1]]);
  face.quad([x1, 0.8, 0.14], [x1, 0.8, -0.13], [x1, 1.1, -0.13], [x1, 1.1, 0.14], [1, 1, 1], [[0.5, 0], [1, 0], [1, 1], [0.5, 1]]);
  const g = new THREE.Group(), mats = [kit.surface({}), kit.surface({ map: tex })];
  g.add(new THREE.Mesh(kit.geometry(body, [], [1.25, 1.25, 1.25]), mats[0])); g.add(new THREE.Mesh(kit.geometry(face, [], [1.25, 1.25, 1.25]), mats[1]));
  g.userData.light = (rgb) => { for (const m of mats) m.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]); };
  return g;
}

export function build(c) {
  const { W, D, H, params: p, kit } = c;
  c.shell({ panels: false });
  daylight(c, 3, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.4, cloudTop: H - 0.7, neighbour: 0 });

  /* the stand: a crate of a counter, two uprights, a board across; one end of it going down */
  const sx = p.side * 0.6, sz = -D / 2 + 2.4, b = new Batch();
  b.box(sx - 0.8, 0, sz - 0.3, sx + 0.8, 0.8, sz + 0.3, TIMBER); b.box(sx - 0.85, 0.8, sz - 0.34, sx + 0.85, 0.84, sz + 0.34, WHITEWASH);
  for (const k of [-1, 1]) beam(b, [sx + k * 0.78, 0.84, sz - 0.2], [sx + k * 0.78, 1.9, sz - 0.2], 0.05, TIMBER);
  b.box(sx - 0.85, 1.55, sz - 0.23, sx + 0.85, 1.92, sz - 0.19, WHITEWASH);
  b.box(sx - 0.5, 0.84, sz - 0.1, sx - 0.3, 1.08, sz + 0.1, [0.95, 0.85, 0.3]); b.box(sx - 0.52, 1.08, sz - 0.12, sx - 0.28, 1.1, sz + 0.12, [0.8, 0.9, 0.95]);
  for (let i = 0; i < 4; i++) b.box(sx + 0.05 + i * 0.16, 0.84, sz - 0.04, sx + 0.13 + i * 0.16, 0.96, sz + 0.04, [0.95, 0.85, 0.3]);
  const sign = new Batch(); sign.quad([sx - 0.82, 1.57, sz - 0.185], [sx + 0.82, 1.57, sz - 0.185], [sx + 0.82, 1.9, sz - 0.185], [sx - 0.82, 1.9, sz - 0.185]);
  const signTex = kit.tex.custom('stand:sign', 128, 26, (g, w, h) => { P(g, '#f4f1e4', 0, 0, w, h); garble(g, 'LEMONADE', 2, 0, 92, h, { color: '#b3261e', size: 18, mess: 0.4 }, 11); garble(g, '5c', 94, 0, 32, h, { color: '#1f6b3a', size: 18, mess: 0.5 }, 3); }, { clamp: true });
  for (const [batch, opt] of [[b, {}], [sign, { map: signTex }]]) { const g = c.dynamic(batch, { pivot: [sx, 0, sz], ...opt }); g.rotation.set(0.05, 0, -p.side * 0.2); g.position.y -= 0.34; }
  c.solid(sx - 0.9, sz - 0.4, sx + 0.9, sz + 0.4); c.blot(sx + p.side * 0.5, sz, 2.6, 1.6, { a: 0.45 }); c.reserve(sx, sz, 1.4);

  /* her */
  const fig = girl(c), home = { x: sx - p.side * 1.25, z: sz + 0.5 }, me0 = { x: home.x, z: home.z, rot: 0 };
  c.add(fig); c.reserve(home.x, home.z, 0.5);
  const s = { mode: 'home', waited: 0, sulk: 0, glasses: STAND.glasses, happy: false };
  let took = false, clock = 0;
  c.rt.vendor = s;                                        // (for the dev page and for scripts: what she is doing)
  const put = (bob = 0, shake = 0) => { fig.position.set(me0.x + shake * (Math.random() - 0.5), bob, me0.z + shake * (Math.random() - 0.5)); fig.rotation.y = me0.rot; };
  c.after.push(() => { fig.userData.light(c.sample(home.x, 0.8, home.z)); put(); });
  const free = (x, z) => Math.abs(x) < W / 2 - 0.4 && Math.abs(z) < D / 2 - 0.4 && (() => { const w = c.toWorld(x, z); return c.world.free(w.x, w.z, 0.2); })();
  const go = (tx, tz, speed, dt, keep = 0) => {
    const dx = tx - me0.x, dz = tz - me0.z, d = Math.hypot(dx, dz); if (d <= keep + 0.02) return true;
    const step = Math.min(speed * dt, d - keep);
    for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) { const cs = Math.cos(turn), sn = Math.sin(turn), nx = me0.x + ((dx * cs - dz * sn) / d) * step, nz = me0.z + ((dx * sn + dz * cs) / d) * step; if (free(nx, nz)) { me0.x = nx; me0.z = nz; break; } }
    me0.rot = Math.atan2(dx, dz); return false;
  };
  c.use({ x: home.x, z: home.z, r: 1.4, label: 'take the lemonade', when: () => s.mode === 'offer' && Math.hypot(me0.x - c.rt.vendorMe?.x, me0.z - c.rt.vendorMe?.z) < 1.5, use: () => { took = true; } });
  const use = c.rt.uses[c.rt.uses.length - 1];
  c.tick((dt, t, me) => {
    clock += dt; c.rt.vendorMe = { x: me.x, z: me.z };
    const d = Math.hypot(me.x - me0.x, me.z - me0.z), atHome = Math.hypot(home.x - me0.x, home.z - me0.z) < 0.1;
    const did = minds(s, dt, { inside: me.inside, d, took, home: atHome }); took = false;
    if (did === 'gave') { c.env.health?.heal?.(1); const w = c.toWorld(me0.x, me0.z); c.env.play?.('click', w.x, w.z, 5); }
    if (did === 'hit') { c.hurt(1); c.env.interfere?.(1); c.env.hud?.glitch?.(0.5); }
    let bob = 0, shake = 0;
    if (s.mode === 'offer') { go(me.x, me.z, STAND.walk, dt, STAND.reach); if (s.waited > STAND.patience * STAND.shakes) shake = 0.03 * (s.waited / STAND.patience); }
    else if (s.mode === 'angry') { go(me.x, me.z, STAND.run, dt, 0.3); shake = 0.05; }
    else if (s.mode === 'back') { go(home.x, home.z, s.happy ? STAND.skip : STAND.walk, dt); if (s.happy) bob = Math.abs(Math.sin(clock * 9)) * 0.12; }
    else me0.rot = Math.atan2(me.x - me0.x, me.z - me0.z) * (me.inside ? 1 : 0);
    put(bob, shake);
    const w = c.toWorld(me0.x, me0.z); use.wx = w.x; use.wz = w.z;                                    // E is wherever she is
    if (c.rt.group.visible && Math.floor(clock * 2) !== Math.floor((clock - dt) * 2)) fig.userData.light(c.sample(me0.x, 0.8, me0.z));
  });
}
