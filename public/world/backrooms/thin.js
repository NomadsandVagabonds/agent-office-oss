// The Backrooms — the wall that gives. One stretch of wall on every floor is
// where the building would be thin (marks.js chose it), and somebody has
// marked it in tape. On every floor but the last that is all it is. On the
// last, leaning on it for as long as it took to get in gets you out.
//
// There is no door, no sign and no [E]. What tells this wall from the others
// that carry the same marks is small and is never said: the loose ends of the
// tape will not hang still, a sheet of paper on the carpet in front of it
// keeps lifting, there is a hair of daylight where the wall meets the floor,
// and the camcorder does not like standing near it.
import { Batch, WHITE } from './kit.js';
import { makeRng, wallFrame } from './gen.js';
import { MARK_W, LEAN, lean, pressing } from './marks.js';
import { tapeMark } from './traces.js';

export function thinWall(c, thin, real) {
  const { side, at, w } = thin, { kit, env } = c, p = c.wallAt(side, at, 0), n = p.n, U = p.U;
  const R = makeRng(`${c.level.seed}/thin`);
  c.keepWall(side, at - MARK_W / 2 - 0.2, at + MARK_W / 2 + 0.2);
  c.reserve(p.x + n[0] * 0.7, p.z + n[2] * 0.7, 1.0);                          // nothing gets left in front of it
  const mark = tapeMark(c, side, at, R, { stir: real, roll: true });
  if (!real) return;

  // a hair of daylight along the skirting, and what little of it reaches the carpet
  const day = [0.92, 0.97, 1.0], glow = c.shining('daylight', kit.tex.white(), 1.25, day);
  const a = c.wallAt(side, at - w / 2 + 0.06, 0.024), b = c.wallAt(side, at + w / 2 - 0.06, 0.024);
  const quad = [[a.x, 0.001, a.z], [b.x, 0.001, b.z], [b.x, 0.007, b.z], [a.x, 0.007, a.z]];
  glow.quad(quad[0], quad[1], quad[2], quad[3]);
  c.light(p.x + n[0] * 0.2, 0.05, p.z + n[2] * 0.2, day, 0.16, { k: 0.12, far: 1.6, wrap: 0.7 });
  // a sheet of paper that will not lie still
  const sheet = new Batch(), sx = p.x + U[0] * 0.2 + n[0] * 0.42, sz = p.z + U[2] * 0.2 + n[2] * 0.42;
  c.lay(sheet, sx, sz, 0.21, 0.297, 0.5, null, WHITE, 0.012);
  const paper = c.dynamic(sheet, { map: kit.tex.paper(), pivot: [sx - n[0] * 0.14, 0.01, sz - n[2] * 0.14] });
  const flap = side === 'front' || side === 'back' ? 'x' : 'z', lift = (side === 'front' || side === 'left' ? 1 : -1);

  const here = c.toWorld(p.x, p.z), nw = (() => { const o = c.toWorld(p.x + n[0], p.z + n[2]); return [o.x - here.x, o.z - here.z]; })();      // the wall, and the way into the room, in the world
  let held = 0, through = false, gust = 0;
  c.rt.onLeave = () => { env.sound.air?.(0); held = 0; };
  c.tick((dt, t, me) => {
    // the draught: never the same twice, and stronger while somebody is leaning on the wall
    gust += dt * (0.8 + Math.sin(t * 0.37) * 0.3);
    const blow = 0.55 + 0.45 * Math.sin(gust * 1.7) * Math.sin(gust * 0.63 + 1) + held * 0.8;
    for (const k of mark.loose) k.node.rotation[k.axis] = k.spin * (Math.sin(t * (2.3 + k.len) + k.phase) * 0.05 + Math.sin(t * 5.1 + k.phase * 2) * 0.018) * blow;
    paper.rotation[flap] = lift * Math.max(0, Math.sin(gust * 2.9) * 0.16 + Math.sin(gust * 7.7) * 0.05) * blow;
    if (through || !me.inside) return;                                         // (once it has given, the rest is the camcorder's: leaving.js)
    const f = wallFrame(c.room, side, me.x, me.z), d = f.d, off = Math.abs(f.c - at);
    // the camcorder does not like it here: the nearer the wall, the worse the picture
    const near = Math.max(0, 1 - d / 3.4) * Math.max(0, 1 - Math.max(0, off - w / 2) / 2.2);
    if (near > 0.02) env.interfere(0.5 * near * near);
    env.sound.air?.(near);
    // leaning: against the stretch, still pushing, getting nowhere
    const push = me.world.wishX * nw[0] + me.world.wishZ * nw[1];              // < 0: into the wall
    held = lean(held, dt, pressing(d, f.c - at, w, -push, me.speed));
    if (held > 0.05) { env.interfere(0.45 + 0.55 * Math.min(1, held / LEAN)); env.hud.glitch(0.2); }
    if (held >= LEAN) {
      through = true;
      env.sound.play('static', { dur: 1.4, vol: 0.8 }); env.sound.play('thunk');
      env.end('exit', { nx: -nw[0], nz: -nw[1] });
    }
  });
}
