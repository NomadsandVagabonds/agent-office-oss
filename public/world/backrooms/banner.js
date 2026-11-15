// The Backrooms — the banner (banner.rule.js says what is on it and where it hangs; this hangs it).
//
// White vinyl on two cords, a little crooked, lettered on both faces so that it reads from either side. It is part
// of the room it is in: lit by that room's own lamps, and gone with the room. Nothing about it can be walked into (its
// lower edge is over everybody's head) and nothing happens at it.
import * as THREE from 'three';
import { Batch, WHITE } from './kit.js';
import { BANNER, bannerLines, bannerSpot } from './banner.rule.js';

const FACE = 'Arial, Helvetica, sans-serif';

/** The lettering: two lines fitted to the vinyl, the place under the award. */
function printed(kit, lines) {
  return kit.tex.custom('banner:' + lines.join('|'), 512, 104, (g, w, h) => {
    g.fillStyle = '#f1eee2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2f6f'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);                  // the stripe along each edge
    g.fillStyle = 'rgba(70, 60, 30, 0.10)'; for (let x = 64; x < w; x += 128) g.fillRect(x, 5, 1, h - 10);   // where it was folded
    for (const [x, y] of [[10, 13], [w - 10, 13], [10, h - 13], [w - 10, h - 13]]) { g.fillStyle = '#8c8f93'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (line, most, least) => {
      let px = most;
      for (; px > least; px--) { g.font = `700 ${px}px ${FACE}`; if ((g.measureText ? g.measureText(line).width : line.length * px * 0.62) <= w - 56) break; }
      g.font = `700 ${px}px ${FACE}`;
    };
    g.fillStyle = '#1d2f6f'; fit(lines[0], 34, 14); g.fillText(lines[0], w / 2, 36);
    g.fillStyle = '#b3261e'; fit(lines[1], 28, 12); g.fillText(lines[1], w / 2, 74);
  }, { clamp: true });
}

/**
 * Hang the banner in the part a visit lands in, if there is somewhere for it (banner.rule.js bannerSpot). Called once
 * the part is built. → the spot it hangs at, or null.
 */
export function hangBanner(env) {
  const { level, world, kit } = env;
  const spot = level && world && bannerSpot(level);
  const rt = spot && world.rooms[spot.room];
  if (!rt || !rt.group) return null;
  const { x, z, nx, nz, half, top } = spot, ax = nz, az = -nx;            // (ax, az): the way it runs, left to right seen from in front
  const y1 = top, y0 = top - BANNER.tall, droop = 0.035, eps = 0.004;
  const at = (s, y, out) => [x + ax * s + nx * out, y - (s > 0 ? droop : 0), z + az * s + nz * out];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const cloth = new Batch();
  cloth.quad(at(-half, y0, eps), at(half, y0, eps), at(half, y1, eps), at(-half, y1, eps), WHITE, uv);            // the face toward where one comes from
  cloth.quad(at(half, y0, -eps), at(-half, y0, -eps), at(-half, y1, -eps), at(half, y1, -eps), WHITE, uv);        // and the other, lettered the right way round too
  const cords = new Batch(), ceil = top + BANNER.under, string = [0.82, 0.8, 0.72];
  for (const s of [-half + 0.04, half - 0.04]) {
    const p = at(s, y1, 0);
    cords.box(p[0] - 0.006, p[1] - 0.02, p[2] - 0.006, p[0] + 0.006, ceil, p[2] + 0.006, string);
  }
  const add = (batch, map) => {
    const geo = kit.geometry(batch, rt.lights, rt.amb); if (!geo) return;
    const mesh = new THREE.Mesh(geo, kit.surface({ map, room: rt.u, flick: geo.userData.flick }));
    mesh.matrixAutoUpdate = false; rt.group.add(mesh);
  };
  add(cloth, printed(kit, bannerLines(env.where)));
  add(cords, kit.tex.white());
  env.banner = spot;
  return spot;
}
