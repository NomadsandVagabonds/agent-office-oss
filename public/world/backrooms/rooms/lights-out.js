// The Backrooms — a room of the Offsite Reserve (`forest`): Lights Out (`lights-out` — "the dark room of lit tents,
// where the one beside you goes out").
//
// The overnight part of the offsite. A dozen ridge tents pitched on office carpet under a ceiling whose lights are all
// off, each tent lit from inside, its door half down, nobody in any of them. The tent you are nearest goes dark, and
// comes back on when you have moved away: so the room is crossed in a patch of dark that moves with you, between lit
// tents you never get to see into from close by.
//
// Nothing here can be used and nothing here hurts. The rule is `nearestTent` in forest.rule.js (pure): the nearest tent
// within reach is the dark one, one at a time. The room reads the visitor's place and nothing else; the seed decides
// where the tents stand and what colour they are.
import * as THREE from 'three';
import { Batch, WHITE } from '../kit.js';
import { makeVoxGroup, tentVox, trailSign, OFFICE_CARPET } from '../forest.js';
import { LIGHTS_OUT, nearestTent } from '../forest.rule.js';

const NYLON = ['#d47a28', '#2b6e58', '#8a5a2b', '#3d5f8a', '#a03b34', '#c9a13a'];
const LAMP = [2.1, 1.62, 0.98];          // the light inside a tent, on its own nylon
const POOL = [0.95, 0.62, 0.30];          // and what of it reaches the carpet round it

export function build(c) {
  const { W, D, H, R, kit } = c;
  c.shell({ panels: false, floorTex: kit.tex.carpet(OFFICE_CARPET) });
  // the office's own ceiling, every light of it out, and next to nothing to see by: the tents are the light
  c.rt.amb = [0.03, 0.032, 0.036];
  // (The room reports one light for each doorway and none else. Those are the shell's own: the light that falls in
  // through a doorway from next door, 1.4 m up at the threshold (`spill`). They are meant to be here. A dark room with
  // its doorways lit from outside is how the rest of the building does a dark room; with the camcorder's own lamp,
  // which comes on in the dark, they are why the walls here read grey and not black.)
  for (const [fx, fz] of [[-W / 4, -D / 4], [W / 4, -D / 4], [-W / 4, D / 4], [W / 4, D / 4]]) c.fitting(Math.round(fx / 0.6) * 0.6 + 0.3, Math.round(fz / 0.6) * 0.6, { dead: true });

  // a dozen pitches, in rows that somebody paced out and nobody checked: a grid, each tent a little off its mark
  const cols = 4, rows = 3, tents = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const gx = (i - (cols - 1) / 2) * ((W - 4.2) / (cols - 1)), gz = (j - (rows - 1) / 2) * ((D - 4.6) / (rows - 1));
    const rot = R.pick([0, Math.PI]) + R.range(-0.3, 0.3), colour = R.pick(NYLON);
    // (its mark, or the nearest free ground toward the middle of the room if a doorway's approach has the mark)
    let x = gx + R.range(-0.35, 0.35), z = gz + R.range(-0.35, 0.35), ok = c.clear(x, z, 0.95);
    for (let k = 1; !ok && k <= 5; k++) { x = gx * (1 - k * 0.14); z = gz * (1 - k * 0.14); ok = c.clear(x, z, 0.95); }
    if (!ok) continue;
    c.reserve(x, z, 1.15);
    // (its footprint, turned: 1.1 m across the ridge, 1.6 m along it)
    const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)), hx = 0.55 * cs + 0.8 * sn, hz = 0.55 * sn + 0.8 * cs;
    c.solid(x - hx, z - hz, x + hx, z + hz);
    const g = makeVoxGroup(kit, `forest:camp:tent:${colour}:0`, tentVox(colour, false), 0.03, { room: c.rt.u, ao: false });   // (flat faces: a tenth of the triangles, and its light is one colour anyway)
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    c.add(g);
    tents.push({ x, z, g, on: 1, dim: [0.05, 0.05, 0.05], pool: null });
  }

  // what each lit tent throws on the carpet: a soft warm patch of its own, so that it can go out with its tent
  c.after.push(() => {
    for (const t of tents) {
      t.dim = c.sample(t.x, 0.6, t.z).map((v) => Math.max(0.035, v));
      const b = new Batch(), r = 1.7, y = 0.012;
      b.quad([t.x - r, y, t.z + r], [t.x + r, y, t.z + r], [t.x + r, y, t.z - r], [t.x - r, y, t.z - r], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const mat = kit.glowing(kit.tex.blob(), 1, POOL, { transparent: true, depthWrite: false, bloom: 0 });
      mat.opacity = LIGHTS_OUT.pool;
      t.pool = new THREE.Mesh(kit.plain(b), mat);
      t.pool.renderOrder = 2;
      t.pool.matrixAutoUpdate = false;
      t.pool.updateMatrix();
      c.rt.group.add(t.pool);
      t.g.userData.light(LAMP);
    }
  });

  let dark = -1;
  c.rt.lightsOut = { tents, get dark() { return dark; } };
  c.tick((dt, _t, me) => {
    const now = me.inside ? nearestTent(tents, me.x, me.z) : -1;
    if (now !== dark) {
      // (a lamp being switched off, heard from where it was)
      if (now >= 0) { const w = c.toWorld(tents[now].x, tents[now].z); c.env.play?.('clack', w.x, w.z, 6); }
      dark = now;
    }
    for (let i = 0; i < tents.length; i++) {
      const t = tents[i], want = i === dark ? 0 : 1;
      if (t.on === want) continue;
      // out at once, as a lamp goes; back on slowly, as if whoever it is were making sure
      t.on = want < t.on ? Math.max(want, t.on - dt / LIGHTS_OUT.off) : Math.min(want, t.on + dt / LIGHTS_OUT.on);
      const k = t.on;
      t.g.userData.light([t.dim[0] + (LAMP[0] - t.dim[0]) * k, t.dim[1] + (LAMP[1] - t.dim[1]) * k, t.dim[2] + (LAMP[2] - t.dim[2]) * k]);
      if (t.pool) { t.pool.material.opacity = LIGHTS_OUT.pool * k; t.pool.visible = k > 0.01; }
    }
  });

  const sign = c.wallSpot(1.5, ['front', 'left', 'right'], 0.35, 2.0);
  if (sign) trailSign(c, sign.side, sign.at, 1.5, ['OVERNIGHT COMPONENT', 'QUIET HOURS ARE IN EFFECT'], { seed: 313, warn: true });
}
