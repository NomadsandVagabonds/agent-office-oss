// e — water, as layers, no fluid: a flat surface at a fixed level over the real floor, cut to a 5 cm grid so its edge
// is a staircase of voxels; the room reflected in it (the one cube picture, box-projected: look.js); the floor seen
// through it, darker the further the eye's path runs through the water; slow ripples and analytic rings, stepped to
// the same grid; glints of the tubes. Under it and beside it (in the kit surfaces, look.js LAB_WATERFX): caustics on
// the floor and nearby walls, a darker, shinier wet edge, a tide line on the wall.
//
// The floor of the level is flat and cannot be dug into from here, so a "pool" is a flooded patch a few centimetres
// deep; the depth that colours it is the path length through it (grazing = deep) and a shallower margin at the edge.
//
// spec: { level, pools: [{ cx, cz, rx, rz }], rings: [[x, z, start, period]], drips: [[x, z, period]] }   (room frame)
const CELL = 0.05;

export function buildWater({ THREE, rt, def, U, spec }) {
  const w = Math.ceil(def.W / CELL), h = Math.ceil(def.D / CELL), x0 = -def.W / 2, z0 = -def.D / 2;
  const depth = new Float32Array(w * h);
  const hash = (i, j) => { let s = Math.imul(i * 73856093 ^ j * 19349663, 2654435761) >>> 0; s ^= s >>> 15; return (Math.imul(s, 2246822519) >>> 0) / 4294967296; };
  for (const p of spec.pools) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL;
    const n = (hash(Math.floor(x / 0.2), Math.floor(z / 0.2)) - 0.5) * (p.rough ?? 0.22);
    const d = Math.hypot((x - p.cx) / p.rx, (z - p.cz) / p.rz);
    if (d < 1 + n && Math.abs(x) < def.W / 2 - 0.02 && Math.abs(z) < def.D / 2 - 0.02) depth[j * w + i] = 1;
  }
  // depth: how many cells from the edge (a shallow margin); wet: a band of damp floor outside it
  const inside = (i, j) => i >= 0 && j >= 0 && i < w && j < h && depth[j * w + i] > 0;
  const dist = new Float32Array(w * h).fill(99);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let best = 99;
    for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) if (inside(i + di, j + dj) !== inside(i, j)) best = Math.min(best, Math.hypot(di, dj));
    dist[j * w + i] = best;
  }
  const data = new Uint8Array(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    const i = k % w, j = (k / w) | 0;
    const inn = depth[k] > 0;
    data[k * 4] = inn ? Math.round(255 * Math.min(1, 0.25 + Math.floor(dist[k]) / 5)) : 0;
    data[k * 4 + 1] = !inn && dist[k] < 6 ? Math.round(255 * (1 - Math.floor(dist[k] - 0.5) / 6) * (0.7 + 0.3 * hash(i >> 1, j >> 1))) : 0;
    data[k * 4 + 3] = 255;
  }
  const wet = new THREE.DataTexture(data, w, h);
  wet.magFilter = wet.minFilter = THREE.NearestFilter; wet.needsUpdate = true;
  U.uWetMap.value = wet;
  U.uWetRect.value.set(x0, z0, 1 / (w * CELL), 1 / (h * CELL));
  U.uWetInv.value.copy(rt.group.matrixWorld).invert();
  U.uWetLevel.value = (def.y || 0) + spec.level;

  // the surface: a quad a cell, and a little wall where it stops (merged runs along x)
  const pos = [], dep = [], idx = [];
  const quad = (a, b, c, d, k) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); dep.push(k, k, k, k); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const Y = spec.level;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!inside(i, j)) continue;
    const k = data[(j * w + i) * 4] / 255, xa = x0 + i * CELL, xb = xa + CELL, za = z0 + j * CELL, zb = za + CELL;
    quad([xa, Y, zb], [xb, Y, zb], [xb, Y, za], [xa, Y, za], k);
    if (!inside(i, j + 1)) quad([xa, 0, zb], [xb, 0, zb], [xb, Y, zb], [xa, Y, zb], -1);
    if (!inside(i, j - 1)) quad([xb, 0, za], [xa, 0, za], [xa, Y, za], [xb, Y, za], -1);
    if (!inside(i + 1, j)) quad([xb, 0, zb], [xb, 0, za], [xb, Y, za], [xb, Y, zb], -1);
    if (!inside(i - 1, j)) quad([xa, 0, za], [xa, 0, zb], [xa, Y, zb], [xa, Y, za], -1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  g.setIndex(idx);
  const rings = (spec.rings || []).map(([x, z, s, p]) => new THREE.Vector4(x, z, s, p));
  for (const [x, z, p] of spec.drips || []) rings.push(new THREE.Vector4(x, z, 0, p));
  while (rings.length < 6) rings.push(new THREE.Vector4(0, 0, 0, 0));
  const room = (rt.amb[0] + rt.amb[1] + rt.amb[2]) / 3;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...U, uRings: { value: rings }, uRoom: { value: room }, uBody: { value: new THREE.Vector3(...(spec.body || [0.035, 0.04, 0.03])) } },
    vertexShader: `attribute float aDepth; varying float vDepth; varying vec3 vW, vL;
      void main() { vDepth = aDepth; vL = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uRoom; uniform vec4 uRings[6]; uniform vec3 uBody;
      uniform vec3 uLampP[16]; uniform vec3 uLampC[16]; uniform vec4 uLampK[16]; uniform int uLampN;
      uniform samplerCube uEnv; uniform vec3 uEnvMin, uEnvMax, uEnvPos;
      varying float vDepth; varying vec3 vW, vL;
      float H(vec2 p) {
        float h = sin(p.x * 3.1 + uTime * 0.7) * 0.5 + sin(p.y * 2.3 - uTime * 0.55) * 0.5 + sin((p.x + p.y) * 5.3 + uTime * 1.1) * 0.25;
        h *= 0.25;
        for (int i = 0; i < 6; i++) {
          vec4 R = uRings[i]; if (R.w <= 0.0) continue;
          float age = mod(uTime - R.z, R.w), r = length(p - R.xy), front = age * 0.32;
          h += sin((r - front) * 38.0) * exp(-age * 1.1) * exp(-abs(r - front) * 9.0) * (R.z < 0.0 ? 0.6 : 1.4);
        }
        return h;
      }
      void main() {
        if (vDepth < 0.0) { gl_FragColor = vec4(uBody * 3.0 * uRoom + 0.02, 0.55); return; }      // the edge of the water, seen side-on
        vec2 q = (floor(vL.xz / ${CELL}) + 0.5) * ${CELL};                         // stepped to the block grid
        float e = ${CELL};
        float hx = H(q + vec2(e, 0.0)) - H(q - vec2(e, 0.0)), hz = H(q + vec2(0.0, e)) - H(q - vec2(0.0, e));
        vec3 n = normalize(vec3(-hx * 0.55, 1.0, -hz * 0.55));
        vec3 V = normalize(cameraPosition - vW);
        float nv = max(dot(n, V), 0.0);
        float F = 0.05 + 0.95 * pow(1.0 - nv, 4.0);       // (a little more than water's own 0.02: the camcorder eats the rest)
        vec3 R = reflect(-V, n);
        vec3 a = (uEnvMax - vW) / R, b = (uEnvMin - vW) / R, f = max(a, b);
        vec3 env = textureLod(uEnv, vW + R * min(min(f.x, f.y), f.z) - uEnvPos, 0.0).rgb;
        vec3 glint = vec3(0.0);
        for (int i = 0; i < 16; i++) {
          if (i >= uLampN) break;
          vec3 d = uLampP[i] - vW; float d2 = dot(d, d); if (d2 > uLampK[i].y) continue;
          vec3 L = d * inversesqrt(d2), Hh = normalize(L + V);
          glint += uLampC[i] * pow(max(dot(n, Hh), 0.0), 600.0) * 9.0 / (1.0 + d2 / uLampK[i].x);
        }
        float path = vDepth * 0.06 / max(dot(V, vec3(0.0, 1.0, 0.0)), 0.12);
        float absorb = 1.0 - exp(-path * 14.0);
        vec3 body = uBody * (0.5 + 6.0 * uRoom);
        vec3 col = body * absorb * (1.0 - F) + (env + glint) * F;
        float alpha = clamp(absorb * (1.0 - F) + F, 0.0, 1.0);
        gl_FragColor = vec4(col / max(alpha, 0.001), alpha);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.matrixAutoUpdate = false; mesh.matrix.copy(rt.group.matrixWorld); mesh.renderOrder = 4;
  // drips: a drop falling from the ceiling stain, on its period (time pinned by t=)
  const meshes = [mesh];
  const drops = (spec.drips || []).map(([x, z, p]) => {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.55, 0.55) }));
    d.matrixAutoUpdate = false; meshes.push(d);
    return { d, x, z, p };
  });
  return {
    meshes, depth, dims: { w, h },
    update(t) {
      for (const { d, x, z, p } of drops) {
        const age = ((t % p) + p) % p, fall = p - age;            // the ring starts when it lands: it falls in the last 0.6 s of the period
        const y = fall < 0.6 ? Y + 0.5 * 9.8 * (fall) ** 2 : def.H - 0.03;
        d.visible = y < def.H;
        d.matrix.copy(rt.group.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(x, Math.min(def.H - 0.03, y), z));
      }
    },
  };
}
