// The Backrooms — the shadow. Something long and thin and very dark that
// stands where you are about to look: in the next doorway, in the corner you
// have not checked. It does nothing. You can hear it — a faint hiss of static,
// from wherever it is — and you can see it perfectly well out of the corner of
// your eye. Hold it in the middle of the picture until it turns white: its
// fuse is lit. Turn away before it goes off and it burns out for this floor.
// Keep it in the picture and the flash takes half the camcorder's remaining
// charge, blacks out the room, and leaves it free to return later. A glance
// only warms it; looking back before the white fuse ends still costs you.
//
// The rule is watched(), in shadow.rule.js: pure, and tested against a made-up clock.
import * as THREE from 'three';
import { Vox, M } from '../../vox/vox.js';
import { Batch, lamp } from '../kit.js';
import { SHADOW, away, watched } from './shadow.rule.js';

/* ---- the figure: too tall, too thin, arms to its knees, and no face at all -------------------------------- */

const S = 0.03, TALL = 2.3;
function figure() {
  const v = new Vox(), k = M('#8a8a92', 1);
  for (const sx of [-1, 1]) { v.box(sx > 0 ? 1 : -3, 0, -1, sx > 0 ? 3 : -1, 38, 1, k); v.box(sx > 0 ? 1 : -3, 0, -1, sx > 0 ? 3 : -1, 2, 3, k); }      // legs, feet
  v.rbox(-4, 38, -2, 4, 60, 2, 1, k);                                                                                                            // a narrow trunk
  v.rbox(-5, 58, -2, 5, 62, 2, 1, k);                                                                                                            // shoulders
  for (const sx of [-1, 1]) { v.tube(sx * 5, 60, 0, sx * 6, 40, 1, 1.0, k); v.tube(sx * 6, 40, 1, sx * 6, 22, 2, 0.9, k); v.box(sx * 6 - 1, 17, 1, sx * 6 + 1, 22, 3, k); }   // arms, to the knees
  v.tube(0, 62, 0, 0, 66, 1, 1.2, k);                                                                                                            // a neck, craned
  v.ellipsoid(0, 71, 2, 3.2, 5, 3.4, k);                                                                                                         // a head
  return v;
}

export function create(c) {
  const env = c.env, R = c.R, me = c.me, walker = { x: 0, z: 0, r: 0.2, tall: 2.2, opens: false, furniture: 'phase' };
  let s = away(R, true), mesh = null, at = null, hiss = 0, dark = [], seenT = 0, known = false, close = false, haunted = false;

  function ready() {
    const b = new Batch(true);
    b.addVox(env.kit.model('shadow', figure).solid, new THREE.Matrix4().makeScale(S, S, S));
    mesh = new THREE.Mesh(env.kit.geometry(b, [lamp(0.3, 2.6, 0.8, [1, 1, 1], { k: 9, wrap: 0.5, far: 30 })], [0.5, 0.5, 0.5]), env.kit.surface({ vox: true }));
    mesh.visible = false;
    c.add(mesh);
  }
  /** Somewhere to stand: just inside the next room through one of this room's doorways, or in a corner of this one — off the picture, in line of sight, not too near. */
  function place() {
    const m = me(), w = env.world, here = w.roomAt(m.x, m.z); if (!here) return false;
    const spots = [];
    for (const d of here.def.doors) { const th = w.throats[d.link]; if (th && th.open && d.h >= walker.tall) spots.push(c.walk.spotBeyond(here.id, d.to, 1.1)); }
    const r = here.rect; for (const [x, z] of [[r.x0 + 0.7, r.z0 + 0.7], [r.x1 - 0.7, r.z0 + 0.7], [r.x0 + 0.7, r.z1 - 0.7], [r.x1 - 0.7, r.z1 - 0.7]]) spots.push({ x, z });
    const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
    let best = null;
    for (const p of spots) {
      if (!p) continue;
      const d = Math.hypot(p.x - m.x, p.z - m.z);
      if (d < SHADOW.near[0] || d > SHADOW.near[1] || !c.walk.stand(walker, p.x, p.z) || !c.hidden(p.x, p.z, 0.6) || !c.los(p.x, p.z, m.x, m.z)) continue;
      // it likes to be just off the edge of the picture, on the way you are going: not behind you
      const score = ((p.x - m.x) * fx + (p.z - m.z) * fz) / d + Math.random() * 0.6;
      if (!best || score > best.score) best = { x: p.x, z: p.z, score };
    }
    if (!best) return false;
    at = { x: best.x, z: best.z }; walker.x = at.x; walker.z = at.z;
    mesh.position.set(at.x, w.floorY(at.x, at.z), at.z);
    mesh.rotation.y = Math.atan2(m.x - at.x, m.z - at.z);
    return true;
  }
  function burst() {
    const w = env.world, m = me();
    env.interfere(1); env.hud.glitch(0.9); env.sound.play('crack'); env.sound.play('static', { dur: 0.7 });
    const rooms = new Set([w.roomAt(m.x, m.z), at && w.roomAt(at.x, at.z)].filter(Boolean));
    dark = [...rooms].map((rt) => ({ rt, t: 0 }));
    c.drain(env.perk?.shadowDrain ?? SHADOW.drain);
    at = null; mesh.visible = false; close = false;
  }
  function clear() {
    // A small sound behind you is the confirmation. No screen flash, lost
    // battery or blackout for getting the timing right, and no respawn.
    if (at) c.play('static', at.x, at.z, 4);
    at = null; mesh.visible = false; close = false;
    c.survived();
  }

  return {
    ready,
    update(dt) {
      if (!mesh) return;
      const m = me(), w = env.world;
      // a room that asked for company: the first time the visitor is in it, it does not keep them waiting
      if (c.haunt != null && !haunted && w.roomAt(m.x, m.z)?.id === c.haunt) { haunted = true; if (s.mode === 'away') s = { ...s, t: Math.min(s.t, SHADOW.haunt) }; }
      let looked = false, exposed = false, d = Infinity;
      if (at) {
        const dx = at.x - m.x, dz = at.z - m.z; d = Math.hypot(dx, dz);
        mesh.visible = c.drawn(at);
        const cos = (-Math.sin(m.yaw) * dx - Math.cos(m.yaw) * dz) / Math.max(d, 0.01);
        const sight = mesh.visible && c.los(m.x, m.z, at.x, at.z);
        looked = sight && cos > Math.cos(SHADOW.cone + Math.atan2(0.25, d)) && Math.abs(m.pitch) < 0.7;
        exposed = sight && !c.hidden(at.x, at.z, 0.4);
      }
      s = watched(s, dt, { placed: !!at, looked, exposed, d });
      if (s.armed && at) c.play('click', at.x, at.z, 8);
      if (s.burst) burst();
      else if (s.cleared) clear();
      else if (s.shift && (!at || c.hidden(at.x, at.z, 0.7))) { const was = at; if (!place() && s.mode === 'away') at = was; }
      if (at && (s.mode === 'lurk' || s.mode === 'armed')) {
        // Grey while charging; a clear jump to white means the fuse is lit.
        // It remains white even after the gaze leaves it, until it burns out.
        const h = s.mode === 'armed' ? 1 : s.heat * 0.65;
        const L = c.light(at.x, at.z).map((v) => v * 0.012 * (1 - h) + h * h * h * 4);
        mesh.material.uniforms.uTint.value.set(L[0], L[1], L[2]);
        if (h > 0) env.interfere(0.25 + 0.6 * h);
        // …and you can always hear where it is
        hiss -= dt;
        if (hiss <= 0 && d < 12) { hiss = 0.55 + Math.random() * 0.3; c.play('static', at.x, at.z, 3.2 + 4 * h); }
        if (!c.hidden(at.x, at.z, 0.4)) { seenT += dt; if (!known && seenT > 0.5 && d < 12) { known = true; c.met(); } }
      } else if (mesh) mesh.visible = false;
      // the tubes, after it has gone off: a flash, a stutter, and then a long while of nothing
      for (const k of dark) {
        k.t += dt;
        if (Math.random() < dt * 5) k.on = !k.on;                               // (they try, now and then, and give up again)
        w.setLights(k.rt, k.t < 0.1 ? 3 : k.t < 1.6 ? (Math.random() < 0.5 ? 0.05 : 0.9) : k.t < SHADOW.dark ? (k.on && Math.random() < 0.8 ? 0.4 : 0.05) : 1);
      }
      dark = dark.filter((k) => k.t < SHADOW.dark);
    },
    at: () => ({ ...(at || { x: null, z: null }), mode: s.mode, heat: +s.heat.toFixed(2), wait: +s.t.toFixed(1), seen: +seenT.toFixed(1) }),
    snipTargets() {
      if (!mesh || !at || s.mode !== 'lurk') return [];
      const floorY = env.world?.floorY(at.x, at.z) ?? 0;
      return [{
        id: 'shadow',
        x: at.x,
        z: at.z,
        y: floorY + 1.05,
        r: 0.28,
        priority: 2,
        snip: () => {
          if (!at || s.mode !== 'lurk') return false;
          if (!known) { known = true; c.met(); }
          c.play('static', at.x, at.z, 6);
          s = away(R, false);
          at = null; mesh.visible = false; close = false;
          c.survived();
          return { ok: true, target: 'shadow' };
        },
      }];
    },
    /** For the dev page: have it turn up now. */
    hurry() { if (s.mode === 'away') s = { ...s, t: 0 }; },
    dispose() { for (const k of dark) env.world?.setLights(k.rt, 1); mesh?.removeFromParent(); },
  };
}
