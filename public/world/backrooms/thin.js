// The Backrooms — the wall that gives, and the walls that do not. Somebody
// marked walls in tape down here, looking for the way out. People's marks are
// by hand and mostly right; the place prints its own. One real door is at the bottom of the last fire stairs,
// where the building has been papered over: a door in painter's tape, a
// tally, a camp on the landing. That one gives if it is leaned on for as
// long as the one upstairs took. The rest are only walls.
//
// There is no door, no sign and no [E]. What tells the one from the others
// is small and is never said: its loose ends of tape will not hang still, a
// sheet of paper in front of it keeps lifting, there is a hair of daylight
// where it meets the floor, and the camcorder does not like standing near
// it. And whichever kind it is, a wall that is leaned on answers (marks.js:
// `answer`): this one lets the daylight in round the tape from the first
// instant; the others knock back like the solid things they are, shed a
// little dust, and leave the picture perfectly steady.
import * as THREE from 'three';
import { Batch, WHITE } from './kit.js';
import { makeRng, wallFrame } from './gen.js';
import { MARK_W, THIN_W, LEAN, lean, pressing, answer } from './marks.js';
import { tapeMark } from './traces.js';

/** A wall of the room's four, as the marks want it: where along it, how far proud, and how a body stands to it. */
const ofRoom = (c, side) => ({
  y: 0,
  at: (at, off = 0) => c.wallAt(side, at, off),
  to: (me) => { const f = wallFrame(c.room, side, me.x, me.z); return { d: f.d, c: f.c }; },
});
/** The way into the room from a wall, in the world. */
function inward(c, p) {
  const here = c.toWorld(p.x, p.z), o = c.toWorld(p.x + p.n[0], p.z + p.n[2]);
  return { here, nw: [o.x - here.x, o.z - here.z] };
}
/** Is whoever is in the room leaning on the stretch `w` wide about `at`? → pressed, and how they stand to the wall. */
function leaning(c, wall, at, w, nw, me) {
  const f = wall.to(me), push = me.world.wishX * nw[0] + me.world.wishZ * nw[1];              // < 0: into the wall
  return { d: f.d, off: Math.abs(f.c - at), pressed: pressing(f.d, f.c - at, w, -push, me.speed) };
}

/**
 * The wall the plan would have called thin, in a plain room near the fire exit. On some floors (`thin.print`) the
 * place has put a taped door on it — its own idea of one: printed into the wallpaper, flat, every outline exactly
 * like the last, and again one repeat along, and again. No loose ends, no roll, no draught. It is only a wall.
 */
export function thinWall(c, thin) {
  if (!thin.print) return;
  const { kit } = c, pitch = 1.6, spans = c.spans(thin.side, 0.2, 0);
  const fits = (at) => spans.some(([a, b]) => at - 0.5 >= a && at + 0.5 <= b);
  const copies = [-2, -1, 0, 1, 2].map((k) => thin.at + k * pitch).filter(fits);
  if (copies.length < 2) return;                                               // (one would not read as print: better nothing)
  const ink = '#5f7fae', tex = kit.tex.custom('printdoor', 64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = ink;
    g.fillRect(3, 2, 3, h - 3); g.fillRect(3, 2, w - 6, 3); g.fillRect(w - 6, 2, 3, 58);           // the left side, the top, and the right as far as it "let go": the same on every one
    g.fillRect(w - 6, 96, 3, h - 97);
    g.globalAlpha = 0.5; for (let y = 6; y < h; y += 8) g.fillRect(3, y, 3, 1);                     // a halftone, where tape would have a weave
  }, { clamp: true });
  const batch = c.mapped('printdoor', tex, { cutout: true });
  c.keepWall(thin.side, Math.min(...copies) - 0.6, Math.max(...copies) + 0.6);
  for (const at of copies) c.hang(batch, thin.side, at, 1.0, 0.92, 2.0, null, [0.86, 0.86, 0.8], 0.003);
  const p = c.wallAt(thin.side, thin.at, 0);
  c.reserve(p.x + p.n[0] * 0.7, p.z + p.n[2] * 0.7, 1.0);
  for (const at of copies) refuses(c, thin.side, at, null);
}

/**
 * A marked wall that is only a wall. Lean on it and it says so: a thump with nothing behind it, the loose tape
 * jumping, dust off the top of the wall — and, now and then, a moment later, somebody knocking back.
 * wall: one of the room's four ('back' | …) or a surface of the builder's own ({ at, to, y }); mark: what tapeMark gave (or nothing).
 */
export function refuses(c, wall, at, mark = null) {
  const { env } = c, face = typeof wall === 'string' ? ofRoom(c, wall) : wall, p = face.at(at, 0), { here, nw } = inward(c, p);
  const top = Math.min(c.H ?? 2.6, 2.6) - 0.04, base = face.y || 0;
  // a pinch of dust, kept out of sight until it is wanted
  const specks = new Batch(), RD = makeRng(`${c.level.seed}/dust/${c.room.id}/${at}`), q = face.at(at, 0.03);
  for (let i = 0; i < 30; i++) {                                               // (some of it well clear of the wall: it comes down past the lens of somebody with their nose against it)
    const u = RD.range(-0.45, 0.45), v = RD.range(0, 0.7), s = RD.range(0.005, 0.014), out = RD.range(0, 0.16), x = q.x + p.U[0] * u + p.n[0] * out, z = q.z + p.U[2] * u + p.n[2] * out;
    specks.quad([x - p.U[0] * s, v - s, z - p.U[2] * s], [x + p.U[0] * s, v - s, z + p.U[2] * s], [x + p.U[0] * s, v + s, z + p.U[2] * s], [x - p.U[0] * s, v + s, z - p.U[2] * s], [0.82, 0.8, 0.74]);
  }
  const dust = c.dynamic(specks, { pivot: [0, 0, 0], side: THREE.DoubleSide });
  dust.visible = false;
  let held = 0, said = false, fall = -1, jolt = 0, back = -1;
  c.tick((dt, t, me) => {
    if (jolt > 0.001 && mark) { jolt *= Math.exp(-3.2 * dt); for (const k of mark.loose) k.node.rotation[k.axis] = Math.sin(t * (9 + k.len * 3) + k.phase) * 0.5 * jolt; }
    if (fall >= 0) {                                                             // the dust comes down, and is gone
      fall += dt; dust.position.y = base + top - 0.5 - 1.1 * fall * fall - 0.25 * fall;
      if (dust.position.y < base - 0.5) { fall = -1; dust.visible = false; }
    }
    if (back >= 0 && (back -= dt) < 0) env.play('knock', here.x - nw[0] * 0.3, here.z - nw[1] * 0.3, 5);
    if (!me.inside) { held = 0; said = false; return; }
    held = lean(held, dt, leaning(c, face, at, THIN_W, nw, me).pressed);
    const a = answer(false, held, said);
    said = a.said;
    if (!a.knock) return;
    env.play('thunk', here.x, here.z, 4); env.play('rustle', here.x, here.z, 3);
    jolt = 1; fall = 0; dust.visible = true;
    me.world.vx += nw[0] * 2.4; me.world.vz += nw[1] * 2.4;                     // it does not give: you come off it a little
    if (Math.random() < 0.18) back = 0.9 + Math.random() * 0.8;
  });
}

/**
 * The wall that gives. wall: as for refuses(); mark: what tapeMark gave, with `stir` (its loose ends are ours to
 * move); o.light: (x, y, z, rgb, power, opt) to add a little daylight to the bake.
 */
export function gives(c, wall, at, mark, o = {}) {
  const { kit, env } = c, face = typeof wall === 'string' ? ofRoom(c, wall) : wall, w = THIN_W, base = face.y || 0;
  const p = face.at(at, 0), n = p.n, U = p.U, { here, nw } = inward(c, p);
  // a hair of daylight along the skirting, and what little of it reaches the carpet
  const day = [0.92, 0.97, 1.0], glow = c.shining('daylight', kit.tex.white(), 1.25, day);
  const a = face.at(at - w / 2 + 0.06, 0.037), b = face.at(at + w / 2 - 0.06, 0.037);
  glow.quad([a.x, base + 0.001, a.z], [b.x, base + 0.001, b.z], [b.x, base + 0.011, b.z], [a.x, base + 0.011, a.z]);
  c.light(p.x + n[0] * 0.2, base + 0.05, p.z + n[2] * 0.2, day, 0.16, { k: 0.12, far: 1.6, wrap: 0.7 });
  // a sheet of paper that will not lie still
  const sheet = new Batch(), sx = p.x + U[0] * 0.2 + n[0] * 0.42, sz = p.z + U[2] * 0.2 + n[2] * 0.42;
  c.lay(sheet, sx, sz, 0.21, 0.297, 0.5, null, WHITE, base + 0.012);
  const paper = c.dynamic(sheet, { map: kit.tex.paper(), pivot: [sx - n[0] * 0.14, base + 0.01, sz - n[2] * 0.14] });
  const flap = Math.abs(n[2]) > 0.5 ? 'x' : 'z', lift = (n[2] > 0.5 || n[0] > 0.5 ? -1 : 1);
  // where the tape is, the wall is not joined to the rest of the wall: lean, and the day gets in round the door
  const mw = mark.w, mh = mark.h, cracks = [];
  const crack = (u0, y0, u1, y1) => {
    const bt = new Batch(), q0 = face.at(at + u0, 0.009), q1 = face.at(at + u1, 0.009), upright = Math.abs(u1 - u0) < 1e-6, t = 0.5;
    // drawn a metre thick about its own line, and squeezed to nothing: how wide it is, is how hard somebody is leaning
    if (upright) bt.quad([q0.x - U[0] * t, base + y0, q0.z - U[2] * t], [q0.x + U[0] * t, base + y0, q0.z + U[2] * t], [q0.x + U[0] * t, base + y1, q0.z + U[2] * t], [q0.x - U[0] * t, base + y1, q0.z - U[2] * t]);
    else bt.quad([q0.x, base + y0 - t, q0.z], [q1.x, base + y0 - t, q1.z], [q1.x, base + y0 + t, q1.z], [q0.x, base + y0 + t, q0.z]);
    const mesh = new THREE.Mesh(kit.plain(bt), kit.glowing(kit.tex.white(), 2.2, day, { side: THREE.DoubleSide })), holder = new THREE.Group();
    const pv = upright ? [q0.x, 0, q0.z] : [0, base + y0, 0];
    holder.position.set(pv[0], pv[1], pv[2]); mesh.position.set(-pv[0], -pv[1], -pv[2]); holder.add(mesh); holder.visible = false;
    c.add(holder);
    cracks.push({ holder, axis: upright ? (Math.abs(U[0]) > 0.5 ? 'x' : 'z') : 'y' });
  };
  crack(-mw / 2, 0.02, -mw / 2, mh); crack(mw / 2, 0.02, mw / 2, mh); crack(-mw / 2, mh, mw / 2, mh);
  // …and through the paper itself, which is all there is of the wall inside the tape: with your nose against it, that is what you see
  const pane = new Batch(), l0 = face.at(at - mw / 2, 0.007), l1 = face.at(at + mw / 2, 0.007);
  pane.quad([l0.x, base + 0.02, l0.z], [l1.x, base + 0.02, l1.z], [l1.x, base + mh, l1.z], [l0.x, base + mh, l0.z]);
  const shine = c.add(new THREE.Mesh(kit.plain(pane), kit.glowing(kit.tex.white(), 1.5, day, { transparent: true, depthWrite: false })));
  shine.material.opacity = 0; shine.visible = false; shine.renderOrder = 2;

  let held = 0, through = false, gust = 0, opened = 0;
  c.rt.onLeave = () => { env.sound.air?.(0); held = 0; };
  c.tick((dt, t, me) => {
    // the draught: never the same twice, and stronger while somebody is leaning on the wall
    gust += dt * (0.8 + Math.sin(t * 0.37) * 0.3);
    const blow = 0.55 + 0.45 * Math.sin(gust * 1.7) * Math.sin(gust * 0.63 + 1) + opened * 2.2;
    for (const k of mark.loose) k.node.rotation[k.axis] = (k.spin || 1) * (Math.sin(t * (2.3 + k.len) + k.phase) * 0.05 + Math.sin(t * 5.1 + k.phase * 2) * 0.018) * blow;
    paper.rotation[flap] = lift * Math.max(0, Math.sin(gust * 2.9) * 0.16 + Math.sin(gust * 7.7) * 0.05) * blow;
    for (const k of cracks) { k.holder.visible = opened > 0.004; k.holder.scale[k.axis] = Math.max(0.0005, opened * opened * 0.05 * (0.85 + 0.15 * Math.sin(t * 31 + k.holder.position.x))); }
    shine.visible = opened > 0.004; shine.material.opacity = Math.min(0.9, opened * opened * 0.85) * (0.9 + 0.1 * Math.sin(t * 23));
    if (through || !me.inside) { if (!through) opened *= Math.exp(-6 * dt); return; }       // (once it has given, the rest is the camcorder's: leaving.js)
    const l = leaning(c, face, at, w, nw, me);
    // the camcorder does not like it here: the nearer the wall, the worse the picture
    const near = Math.max(0, 1 - l.d / 3.4) * Math.max(0, 1 - Math.max(0, l.off - w / 2) / 2.2);
    if (near > 0.02) env.interfere(0.5 * near * near);
    env.sound.air?.(Math.min(1, near + opened));
    // leaning: against the stretch, still pushing, getting nowhere — and the wall answers at once
    const was = held;
    held = lean(held, dt, l.pressed);
    const ans = answer(true, held);
    opened += (ans.open - opened) * (1 - Math.exp(-(ans.open > opened ? 30 : 7) * dt));
    if (held > 0 && was === 0) { env.play('creak', here.x, here.z, 4); env.play('rustle', here.x, here.z, 4); }
    if (held > 0.05) { env.interfere(0.45 + 0.55 * Math.min(1, held / LEAN)); env.hud.glitch(0.2); }
    if (ans.through) {
      through = true; opened = 1;
      env.sound.play('static', { dur: 1.4, vol: 0.8 }); env.sound.play('thunk');
      env.end('exit', { nx: -nw[0], nz: -nw[1] });
    }
  });
}
