// h1 — tube shadows, baked once when the room is built (the lab does it after the level's own bake, and re-weights
// what the level stored rather than re-lighting from nothing, so everything but the shadow stays exactly the kit's).
//
// For every vertex of the room's lit meshes, and for every cell of a 5 cm floor lightmap, each lamp's share is cut by
// how much of the lamp can be seen past the room's solids (occluders: look.js). A tube is five points along its 1.2 m,
// so a shadow has a soft edge in five steps. Kept per bank (aLit / aFlk / aBank0..3), so a bank that goes out takes its
// shadows with it: the kit's own uniforms still weight the banks.
//
//   vertex   the shadow goes into the vertices the level already has (floors are cut every 0.5 m: too coarse to hold
//            the edge of a chair's shadow, so the floor shows smears) — no new data, no new lookups
//   lightmap the floor carries its shadow in a small texture instead (one per room, 5 cm cells, nearest: the edge is a
//            staircase of voxel-sized steps); walls and furniture use the re-weighted vertices
//
// The lamp maths is a copy of kit.js bake()'s gather() (kit.js lines 187-201), here per lamp rather than summed.
import { bankWeights } from '../../backrooms/lighting.js';

export function bakeTubeShadows({ THREE, rt, def, meshes, occluders }) {
  const lighting = rt.lighting, share = lighting ? lighting.ambientShare : 0;
  const count = lighting ? lighting.bankCount || 2 : 0;
  const groupOf = (L) => (lighting && Number.isInteger(L.bank) && L.bank >= 0 && L.bank < count ? `aBank${L.bank}` : L.flick ? 'aFlk' : 'aLit');
  const lamps = rt.lights.map((L) => {
    const tube = L.lobe && L.ay < -0.9;
    const doorway = L.lobe && Math.abs(L.ay) < 0.5 && L.floor <= 0.11;        // the level's light-from-next-door: not a real lamp, never shadowed
    const samples = tube ? [-0.5, -0.25, 0, 0.25, 0.5].map((dz) => [L.x, L.y, L.z + dz]) : [[L.x, L.y, L.z]];
    return { L, group: groupOf(L), samples, doorway };
  });
  const boxes = occluders.map((b) => [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1]);
  const hits = (ox, oy, oz, dx, dy, dz) => {
    for (const b of boxes) {
      // a point inside a solid is part of it (a copier's lid, the voxels of its own body): it does not shadow itself
      if (ox > b[0] && ox < b[3] && oy > b[1] && oy < b[4] && oz > b[2] && oz < b[5]) continue;
      let t0 = 0, t1 = 1;
      const ax = [[ox, dx, b[0], b[3]], [oy, dy, b[1], b[4]], [oz, dz, b[2], b[5]]];
      let out = false;
      for (const [o, d, lo, hi] of ax) {
        if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { out = true; break; } continue; }
        let a = (lo - o) / d, c = (hi - o) / d; if (a > c) [a, c] = [c, a];
        if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) { out = true; break; }
      }
      if (!out) return true;
    }
    return false;
  };
  /** lamp L's light at p facing n (per channel, as kit.js gathers it) and how much of the lamp p can see. */
  const one = (l, px, py, pz, nx, ny, nz, out) => {
    const L = l.L, dx = L.x - px, dy = L.y - py, dz = L.z - pz, d2 = dx * dx + dy * dy + dz * dz + 0.02;
    if (d2 > L.far2) return 0;
    const inv = 1 / Math.sqrt(d2);
    let s = ((nx * dx + ny * dy + nz * dz) * inv + L.wrap) / (1 + L.wrap);
    if (s <= 0) return 0;
    if (L.lobe) s *= L.floor + (1 - L.floor) * Math.max(0, -(dx * L.ax + dy * L.ay + dz * L.az) * inv);
    const fade = 1 - d2 / L.far2;
    s *= fade * fade / (1 + d2 / L.k);
    out[0] = L.r * s; out[1] = L.g * s; out[2] = L.b * s;
    if (l.doorway) return 1;
    const ox = px + nx * 0.03, oy = py + ny * 0.03, oz = pz + nz * 0.03;
    let seen = 0;
    for (const [sx, sy, sz] of l.samples) if (!hits(ox, oy, oz, sx - ox, sy - oy, sz - oz)) seen++;
    return seen / l.samples.length;
  };
  const amb = rt.amb, I = [0, 0, 0];
  const tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
  const inv = new THREE.Matrix4().copy(rt.group.matrixWorld).invert();
  const t0 = performance.now();

  /* -- vertices -- */
  const jobs = [];
  for (const x of meshes) {
    const geo = x.mesh.geometry, P = geo.attributes.position, N = geo.attributes.normal;
    if (!P || !N || !geo.attributes.aLit) continue;
    x.mesh.updateMatrixWorld(true);
    const m = new THREE.Matrix4().multiplyMatrices(inv, x.mesh.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(m);
    const names = ['aLit', 'aFlk', 'aBank0', 'aBank1', 'aBank2', 'aBank3'].filter((k) => geo.attributes[k]);
    const orig = Object.fromEntries(names.map((k) => [k, geo.attributes[k].array.slice()]));
    const shad = Object.fromEntries(names.map((k) => [k, geo.attributes[k].array.slice()]));
    for (let i = 0; i < P.count; i++) {
      tmp.fromBufferAttribute(P, i).applyMatrix4(m); nrm.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      const su = {}, ss = {};
      for (const k of names) { su[k] = [0, 0, 0]; ss[k] = [0, 0, 0]; }
      for (const l of lamps) {
        if (!su[l.group]) continue;
        const v = one(l, tmp.x, tmp.y, tmp.z, nrm.x, nrm.y, nrm.z, I);
        if (!v && !(I[0] + I[1] + I[2])) continue;
        for (let c = 0; c < 3; c++) { su[l.group][c] += I[c]; ss[l.group][c] += I[c] * v; }
        I[0] = I[1] = I[2] = 0;
      }
      const hemi = 0.8 + 0.2 * nrm.y;
      for (const k of names) {
        let a = 0;
        if (k === 'aLit') a = 1 - share;
        else if (k.startsWith('aBank') && lighting) { const w = bankWeights(rt.lights, tmp.x, tmp.z, count, lighting.ceilingBanks || count); a = share * w[Number(k.at(-1))]; }
        for (let c = 0; c < 3; c++) {
          // (the ambient is the tubes' bounce: what hides a share of the tubes hides 0.8 of that share of it too)
          const seen = su[k][c] > 1e-6 ? ss[k][c] / su[k][c] : 1, A = amb[c] * hemi * a, den = A + su[k][c];
          if (den > 1e-6) shad[k][i * 3 + c] = orig[k][i * 3 + c] * (A * (1 - 0.8 * (1 - seen)) + ss[k][c]) / den;
        }
      }
    }
    jobs.push({ x, geo, names, orig, shad, floor: x.kind === 1 || x.kind === 2 });
  }
  const vertexMs = performance.now() - t0;

  /* -- the floor's lightmap: per cell, per group, the light with and without the solids -- */
  const cell = 0.05, w = Math.ceil(def.W / cell), h = Math.ceil(def.D / cell), x0 = -def.W / 2, z0 = -def.D / 2;
  const groups = [...new Set(lamps.map((l) => l.group))];
  const SU = groups.map(() => new Float32Array(w * h)), SS = groups.map(() => new Float32Array(w * h));
  const t1 = performance.now();
  const fy = 0.0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const px = x0 + (i + 0.5) * cell, pz = z0 + (j + 0.5) * cell, k = j * w + i;
    for (const l of lamps) {
      const v = one(l, px, fy, pz, 0, 1, 0, I);
      const lum = (I[0] + I[1] + I[2]) / 3; if (!lum) continue;
      const g = groups.indexOf(l.group);
      SU[g][k] += lum; SS[g][k] += lum * v;
      I[0] = I[1] = I[2] = 0;
    }
  }
  const lightmapMs = performance.now() - t1;
  const data = new Uint8Array(w * h * 4).fill(255);
  const tex = new THREE.DataTexture(data, w, h);
  tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const ambLum = (amb[0] + amb[1] + amb[2]) / 3;
  let lastKey = '';
  function refresh() {
    const lv = groups.map((g) => g === 'aLit' ? 1 : g === 'aFlk' ? rt.u.flick.value : g === 'aBank0' ? rt.u.banks.value[0] : g === 'aBank1' ? rt.u.banks.value[1] : g === 'aBank2' ? rt.u.moreBanks.value[0] : rt.u.moreBanks.value[1]);
    const key = lv.join(',');
    if (key === lastKey) return;
    lastKey = key;
    const A = ambLum * (lighting ? (1 - share) + share * lv.filter((_, i) => groups[i].startsWith('aBank')).reduce((a, b) => a + b, 0) / Math.max(1, groups.filter((g) => g.startsWith('aBank')).length) : 1);
    for (let k = 0; k < w * h; k++) {
      let u = 0, s = 0;
      for (let g = 0; g < groups.length; g++) { u += SU[g][k] * lv[g]; s += SS[g][k] * lv[g]; }
      const r = u + A > 1e-6 ? (s + A * (1 - 0.8 * (1 - (u > 1e-6 ? s / u : 1)))) / (u + A) : 1;
      data[k * 4] = Math.round(Math.max(0, Math.min(1, r)) * 255);
    }
    tex.needsUpdate = true;
  }
  refresh();
  let mode = 'none';
  return {
    lightmap: tex,
    uniforms: { uLm: { value: tex }, uLmRect: { value: new THREE.Vector4(x0, z0, 1 / (w * cell), 1 / (h * cell)) }, uRoomInv: { value: inv } },
    stats: { vertices: jobs.reduce((n, j) => n + j.geo.attributes.position.count, 0), vertexMs: Math.round(vertexMs), lightmap: `${w}×${h}`, lightmapMs: Math.round(lightmapMs), lamps: lamps.length, occluders: boxes.length },
    refresh,
    use(next) {
      if (next === mode) return;
      mode = next;
      for (const j of jobs) for (const k of j.names) {
        const shadowed = mode === 'vertex' || (mode === 'lightmap' && !j.floor);
        j.geo.attributes[k].array.set(shadowed ? j.shad[k] : j.orig[k]);
        j.geo.attributes[k].needsUpdate = true;
      }
    },
  };
}
