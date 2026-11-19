// The Backrooms — Carpet Allowance ("the carpet that was cut too long"). An empty supply room whose wall-to-wall carpet
// was cut several metres too long: the excess has risen in one great pleat down the length of the room, as high as a
// shoulder, its cut edges showing the tan backing in coarse voxel steps, the floor under it bare screed where the
// carpet came up. Two ways on: the short blind way under the fold (you duck at its sides; the visitor's automatic duck
// does it), or round its edge on the open side. A normal stapler on the floor by the way in, for scale; three bright
// snags at the skirting where the carpet pulled free of the wall. Nothing moves and nothing here can hurt anybody.
//
// Where everything goes, and the shape of the fold, is rooms/carpet-mound/layout.js; this file only draws it.
// It reads nothing of the room's seeded stream beyond what the shell itself reads (its sockets).
import { Vox, M } from '../../vox/vox.js';
import { lin, ticks } from '../kit.js';
import { MOUND, layout, outer, slope, inner, columns, jag, headroom, flanks, reachIn, hash, smooth } from './carpet-mound/layout.js';

/** The stapler: a plain beige desk stapler, a little scuffed, lying where somebody let go of it. VOX is 2.5 cm. */
const staplerVox = () => {
  const v = new Vox(), beige = M('#d6ccb2', 0), band = M('#b8ad92', 0), base = M('#4a4842', 0), steel = M('#9aa0a6', 0);
  v.box(-6, 0, -2, 6, 1, 2, base);                 // the base plate
  v.box(-6, 1, -2, -3, 2, 2, band);                // the hinge block
  v.box(-6, 2, -2, 5, 4, 2, beige);                // the arm
  v.box(4, 1, -1, 6, 2, 1, steel);                 // the anvil at the nose
  v.box(-6, 3, -2, -4, 4, 2, band);
  for (const [x, z] of [[2, -2], [-1, 1], [3, 1]]) v.set(x, 3, z, M('#a69c82', 0));   // scuffs
  return v;
};
/** A snag: the bright cream threads of the backing, pulled loose where the carpet came off its gripper at the wall. */
const snagVox = (k) => () => {
  const v = new Vox(), cream = M('#f1e8cb', 0), pale = M('#e2d6b0', 0), n = 5 + (k % 2);
  v.box(-2, 0, -1, 2, 1, 1, M('#c8b58a', 0));
  for (let i = 0; i < n; i++) {
    const h = 8 + Math.floor(hash(k, i) * 7), lean = (i - (n - 1) / 2) * 0.35, z = Math.round((hash(i, k, 3) - 0.5) * 2);
    for (let y = 1; y < h; y++) v.set(Math.round(lean * (y / h) * 3), y, z, y > h - 3 ? pale : cream);
  }
  return v;
};

export function build(c) {
  const { W, D, H, kit, look, params: p } = c, L = layout(W, D, p), { ro, t, v } = MOUND;
  c.shell();
  // (the shell gives every lit panel a lamp, and each doorway a brighter room spills through another: at the room's largest,
  // 10 × 12 m, sixteen panels and three doorways, that can come to seventeen. Past the sixteen a room may have, the nearest
  // two of the ceiling's become one, weighted by power, as a lit batch keeps its own: shining-lights.rule.js lampSet)
  const lamps = c.rt.lights, power = (q) => q.r + q.g + q.b;
  while (lamps.length > 16) {
    let bi = -1, bj = -1, best = Infinity;
    for (let i = 0; i < lamps.length; i++) for (let j = i + 1; j < lamps.length; j++) {
      const a = lamps[i], b = lamps[j];
      if (a.spill !== undefined || b.spill !== undefined || a.flick !== b.flick || a.bank !== b.bank) continue;
      const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
      if (d < best) { best = d; bi = i; bj = j; }
    }
    if (bi < 0) break;
    const a = lamps[bi], b = lamps[bj], wa = power(a), wb = power(b), w = wa + wb || 1;
    a.x = (a.x * wa + b.x * wb) / w; a.y = (a.y * wa + b.y * wb) / w; a.z = (a.z * wa + b.z * wb) / w;
    a.r += b.r; a.g += b.g; a.b += b.b;
    lamps.splice(bj, 1);
  }
  c.reserve(L.stapler.x, L.stapler.z, 0.5); c.reserve(L.reward.x, L.reward.z, 0.6);

  const pile = c.mapped('mound:pile', kit.tex.floor(look)), screed = c.mapped('mound:screed', kit.tex.screed('#7a766c'));
  const carpet = lin(look.carpet), worn = carpet.map((k) => Math.min(1, k * 1.32 + 0.03)), tan = lin('#bfa57a'), tan2 = lin('#a98f66');

  // ---- the fold's two smooth sheets: the carpet's face outside, its backing underneath (the batch's grid with the
  // normals each vertex really has, so the flanks shade as they turn from the tubes)
  const xs = [], zs = ticks(L.len, 0.25, 0).map((u) => L.z0 + u);
  for (let d = -ro; d <= ro + 1e-9; d += v / 2) xs.push(Math.min(ro, d));
  const arc = [0]; for (let i = 1; i < xs.length; i++) arc.push(arc[i - 1] + Math.hypot(xs[i] - xs[i - 1], outer(L, xs[i], 0) - outer(L, xs[i - 1], 0)));
  const sheet = (under) => {
    const b = pile, start = b.verts;
    // up: U along z, V across (as the shell's floor); under: the other way round, facing down
    if (!under) b.grid([L.xc - ro, 0, L.z0], [0, 0, 1], [1, 0, 0], zs.map((z) => z - L.z0), xs.map((d) => d + ro), (u, w) => [(arc[Math.round((w) / (v / 2))] ?? 0) / 1.6, (L.z0 + u + c.room.cz) / 1.6]);
    else b.grid([L.xc - ro, 0, L.z0], [1, 0, 0], [0, 0, 1], xs.map((d) => d + ro), zs.map((z) => z - L.z0), (w, u) => [(arc[Math.round(w / (v / 2))] ?? 0) / 1.6, (L.z0 + u + c.room.cz) / 1.6]);
    for (let i = start; i < b.verts; i++) {
      const x = b.pos[i * 3], z = b.pos[i * 3 + 2], d = x - L.xc, k = slope(L, d, z);
      const y = under ? inner(L, d, z) : outer(L, d, z);
      b.pos[i * 3 + 1] = under ? Math.max(0.003, y) : Math.max(0.004, y);
      const n = Math.hypot(k, 1);
      if (under) { b.nor[i * 3] = k / n; b.nor[i * 3 + 1] = -1 / n; b.nor[i * 3 + 2] = 0; }
      else { b.nor[i * 3] = -k / n; b.nor[i * 3 + 1] = 1 / n; b.nor[i * 3 + 2] = 0; }
      if (under) {
        // what light gets under it: from the mouths, and less down in the creases at its feet
        const a = reachIn(L, z) * (0.45 + 0.55 * smooth(y / 0.5));
        for (let q = 0; q < 3; q++) b.alb[i * 3 + q] = tan2[q] * 0.75;
        b.ao[i] = a;
      } else {
        // the worn runner stripe, a little ragged at its edges; darker in the crease where the foot meets the floor
        const e = Math.abs(d - (L.stripe - L.xc)), ragged = 0.11 + 0.035 * (hash(Math.round(z / v), 3) - 0.5);
        const col = e < ragged ? worn : carpet;
        for (let q = 0; q < 3; q++) b.alb[i * 3 + q] = col[q] / carpet[q];
        b.ao[i] = 0.62 + 0.38 * smooth(y / 0.75);
      }
    }
  };
  sheet(false); sheet(true);

  // ---- the two cut edges: the sheet's section in voxel cubes of backing (MOUND.v), each standing one or two steps proud
  // of the cut, so that its outline steps and its face is a weave of cubes. Faces only where they show, as quads:
  // nothing of it stands in the room for the tubes' shadows, which it would cut into slivers
  const f = c.flat;
  for (const [end, zc, dir] of [[0, L.z0, -1], [1, L.z1, 1]]) {
    const cells = new Map(), key = (i, j) => i * 1000 + j;
    columns(L, zc).forEach((col) => {
      const i = Math.round((col.x0 + ro) / v);
      for (let j = Math.round(col.y0 / v); j < Math.round(col.y1 / v); j++) cells.set(key(i, j), { i, j, n: jag(i * 31 + j, end) });
    });
    const back = zc - dir * v * 0.5, far = (n) => zc + dir * v * n;
    for (const q of cells.values()) {
      const x0 = L.xc - ro + q.i * v, x1 = x0 + v, y0 = q.j * v, y1 = y0 + v, zf = far(q.n);
      const shade = (q.i + q.j) % 2 ? tan : tan2, k = 0.92 + 0.16 * hash(q.i, q.j, end);
      const rgb = shade.map((u) => Math.min(1, u * k));
      // the face at the cut, and the four sides, each only past where its neighbour (if any) already reaches
      const [zl, zh] = dir > 0 ? [back, zf] : [zf, back];
      if (dir > 0) f.quad([x0, y0, zh], [x1, y0, zh], [x1, y1, zh], [x0, y1, zh], rgb, null, 0.96);
      else f.quad([x1, y0, zl], [x0, y0, zl], [x0, y1, zl], [x1, y1, zl], rgb, null, 0.96);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = cells.get(key(q.i + di, q.j + dj)), from = nb ? far(nb.n) : back;
        if (nb && nb.n >= q.n) continue;
        const [a, b] = dir > 0 ? [from, zf] : [zf, from], ao = dj > 0 ? 1 : dj < 0 ? 0.62 : 0.84, top = dj > 0 ? rgb.map((u) => Math.min(1, u * 1.06)) : rgb;
        if (di > 0) f.quad([x1, y0, b], [x1, y0, a], [x1, y1, a], [x1, y1, b], top, null, ao);
        else if (di < 0) f.quad([x0, y0, a], [x0, y0, b], [x0, y1, b], [x0, y1, a], top, null, ao);
        else if (dj > 0) f.quad([x0, y1, b], [x1, y1, b], [x1, y1, a], [x0, y1, a], top, null, ao);
        else if (y0 > 0.001) f.quad([x0, y0, a], [x1, y0, a], [x1, y0, b], [x0, y0, b], top, null, ao);
      }
    }
    // (a step further out, now and then, a loose cube of backing on the floor)
    for (const q of cells.values()) if (q.j === 0 && hash(q.i, end, 11) > 0.9) {
      const x0 = L.xc - ro + q.i * v, z = far(q.n) + dir * v * (1.3 + hash(q.i, 2) * 2);
      f.box(x0, 0, Math.min(z, z + dir * v), x0 + v, v, Math.max(z, z + dir * v), tan2, { skip: '-y' });
    }
  }

  // ---- the floor under it: bare screed where the carpet came up, darker the further in; a little of it shows past
  // each mouth, where the floor's carpet tore along a ragged line; the cut edge of the floor's carpet a tan lip
  const gap = Math.max(...[L.z0, L.z1].map((z) => { let d = 0; while (d < ro && inner(L, d, z) > 0.002) d += 0.01; return d; }));
  { const x0 = L.xc - gap, x1 = L.xc + gap, za = L.z0 - 0.18, zb = L.z1 + 0.18, w = x1 - x0, start = screed.verts;
    screed.grid([x0, 0.0035, za], [0, 0, 1], [1, 0, 0], ticks(zb - za, 0.25, 0), ticks(w, 0.1, 0), (u, s) => [(x0 + s) / 1.6, (za + u) / 1.6]);
    for (let i = start; i < screed.verts; i++) {
      const x = screed.pos[i * 3], z = screed.pos[i * 3 + 2], h = inner(L, x - L.xc, Math.max(L.z0, Math.min(L.z1, z)));
      screed.ao[i] = (z < L.z0 || z > L.z1 ? 0.8 : 0.62 * reachIn(L, z)) * (0.45 + 0.55 * smooth(h / 0.45));
    }
    for (const [zc, dir] of [[za, -1], [zb, 1]]) for (let x = x0; x < x1 - 1e-6; x += v) {
      const k = (hash(x, dir, 5) * 3) | 0, z = zc + dir * k * 0.02;
      f.box(x, 0, Math.min(z, z + dir * 0.02), Math.min(x1, x + v), 0.012, Math.max(z, z + dir * 0.02), tan2, { skip: '-y' });
    }
  }

  // ---- the runner stripe goes on in the flat carpet, from each mouth to the wall, as it was laid
  { const hw = 0.11, x = L.stripe, lay = (za, zb) => { if (zb - za > 0.05) c.lay(pile, x, (za + zb) / 2, hw * 2, zb - za, 0, [[x - hw, zb], [x + hw, zb], [x + hw, za], [x - hw, za]].map(([a, b]) => [(a + c.room.cx) / 1.6, (b + c.room.cz) / 1.6]), worn.map((k, i) => k / carpet[i]), 0.0025); };
    lay(-D / 2 + 0.02, L.z0 - 0.2); lay(L.z1 + 0.2, D / 2 - 0.02); }

  // ---- what stops a body: the flanks, from where the gap under it is too low to stand in out to its foot; and the
  // headroom under it, for the visitor's automatic duck (and anybody else who goes under)
  for (const q of flanks(L)) c.solid(q.x0, q.z0, q.x1, q.z1, { tall: true, top: MOUND.crown });
  const base = c.rt.headY;
  c.rt.headY = (x, z) => { const h = headroom(L, x, z); const was = base ? base(x, z) : c.ceilAt(x, z); return h === null ? was : Math.min(was, h); };

  // ---- the stapler at the way in, the snags at the skirting, and the soft dark at the fold's feet
  c.model('carpet-mound:stapler', staplerVox, L.stapler.x, L.stapler.z, { rot: L.stapler.rot, scale: 1.25, solid: false, shadow: 0.5 });
  c.blot(L.stapler.x - Math.sin(L.stapler.rot) * 0.32, L.stapler.z - Math.cos(L.stapler.rot) * 0.32, 0.07, 0.4, { a: 0.1, rgb: [0.85, 0.8, 0.62] });   // where it skidded
  L.snags.forEach((s, i) => c.model(`carpet-mound:snag${i}`, snagVox(i), s.x - L.s * 0.04, s.z, { rot: L.s * Math.PI / 2 + (hash(i, 9) - 0.5) * 0.6, solid: false, shadow: false }));
  { const side = L.s > 0 ? 'right' : 'left', z0 = L.snags[0].z - 0.35, z1 = L.snags[2].z + 0.35;
    // the carpet pulled back off its gripper there: a dark line along the skirting
    c.blot(L.s * (W / 2 - 0.035), (z0 + z1) / 2, 0.05, z1 - z0, { a: 0.55, rgb: [0.06, 0.05, 0.03], y: 0.007 });
    const zm = (z0 + z1) / 2, at = Math.abs(c.wallAt(side, zm).z - zm) < 1e-6 ? zm : -zm;
    c.blot(at, 0.15, z1 - z0 + 0.2, 0.08, { wall: side, a: 0.14 }); }
  for (const k of [-1, 1]) {
    let foot = ro; while (foot > 0 && outer(L, foot, L.z0) < 0.06) foot -= 0.01;
    c.blot(L.xc + k * (foot + 0.1), (L.z0 + L.z1) / 2, 0.7, L.len + 0.3, { a: 0.4 });
  }
  for (const [zc, dir] of [[L.z0, -1], [L.z1, 1]]) c.blot(L.xc, zc + dir * 0.12, gap * 1.6, 0.3, { a: 0.22 });
  c.blot(L.xc + L.s * 0.5, (L.z0 + L.z1) / 2 + 0.6, 1.1, 0.8, { down: true, y: H - 0.005, a: 0.16, rgb: [0.32, 0.22, 0.08] });   // a stain on the tiles over it

  c.rt.mound = { layout: L };                           // (for the dev page and for scripts)
}
