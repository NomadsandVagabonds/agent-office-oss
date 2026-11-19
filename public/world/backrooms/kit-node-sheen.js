// The Backrooms — the ceiling tubes caught on a floor that shines (SHEEN: Medium and High, sheen.rule.js / sheen.js),
// for the node surface (kit-node.js) under ?gpu=webgpu. The same sum as SHEEN_GLSL, number for number:
//   · blocky texel-centre snapping via textureSize + screen-space Jacobian (dFdx/dFdy) when uSheenK.z > 0.5;
//   · floor tube-shadow attenuation from the room's light map (kit-node-light.js floorShade);
//   · anisotropic GGX tube streaks + Fresnel + reach fade for up to SHEEN.lamps tubes;
//   · environment wax reflection tinted by the room's mean tube colour, tile albedo, and local light;
//   · soft-knee compression.
//
// Uniforms (uSheenP, uSheenT, uSheenC, uSheenK, uSheenUp, uSheenE) are read per draw via onObjectUpdate so sheen.js's
// mesh.onBeforeRender (which transforms the room's tubes into whichever camera is drawing) is picked up for every draw.
// Derivatives and light-map samples execute in uniform control flow before branching so WGSL validation passes.
import { gpu } from '../engine/gpu.js';
import { SHEEN } from './sheen.rule.js';

/**
 * The floor sheen's part of a kit surface. Called inside kit-node's fragment Fn.
 * Returns `(normal) => vec3` (additive highlight), or null when SHEEN is not defined.
 */
export function sheenNode(m, D, { baseUv, mapTex, mapSample, vLit, lightmapped }) {
  if (!D.SHEEN) return null;
  const N = gpu.nodes, T = N.TSL;
  const { vec2, vec3, vec4, float, uniform, textureSize, floor, dot, cross, length, sqrt, exp, max, min, abs, clamp,
    pow, normalize, reflect, select, If, dFdx, dFdy, positionView } = T;

  const count = Number(D.SHEEN) || SHEEN.lamps;
  const read = (key) => m.uniforms[key]?.value;
  const v3Obj = (key, def = [0, 0, 0]) => {
    const n = uniform(new N.Vector3(...def));
    return n.onObjectUpdate(() => {
      const v = read(key);
      if (v && v.length >= 3) n.value.set(v[0], v[1], v[2]);
      else if (v?.isVector3) n.value.copy(v);
    });
  };
  const v4ObjAt = (key, idx) => {
    const n = uniform(new N.Vector4());
    const off = idx * 4;
    return n.onObjectUpdate(() => {
      const v = read(key);
      if (v && v.length >= off + 4) n.value.set(v[off], v[off + 1], v[off + 2], v[off + 3]);
    });
  };
  const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };
  const sheenShade = (g, sa, sb) => select(g.lessThan(0.5), sa.r,
    select(g.lessThan(1.5), sa.g,
      select(g.lessThan(2.5), sa.b,
        select(g.lessThan(3.5), sa.a,
          select(g.lessThan(4.5), sb.r, sb.g)))));

  const uSheenP = Array.from({ length: count }, (_, i) => v4ObjAt('uSheenP', i));
  const uSheenT = Array.from({ length: count }, (_, i) => v4ObjAt('uSheenT', i));
  const uSheenC = Array.from({ length: count }, (_, i) => v4ObjAt('uSheenC', i));
  const uSheenK = v4ObjAt('uSheenK', 0);
  const uSheenUp = v3Obj('uSheenUp', [0, 1, 0]);
  const uSheenE = v3Obj('uSheenE', [0, 0, 0]);

  return (normal) => {
    // Evaluate derivatives and light-map samples in uniform control flow before any non-uniform branch (WGSL rule).
    const px = D.MAPPED && mapTex ? dFdx(positionView) : null;
    const py = D.MAPPED && mapTex ? dFdy(positionView) : null;
    const ux = D.MAPPED && mapTex ? dFdx(baseUv) : null;
    const uy = D.MAPPED && mapTex ? dFdy(baseUv) : null;
    const { sa, sb } = lightmapped?.floorShade ? lightmapped.floorShade() : { sa: vec4(1, 1, 1, 1), sb: vec2(1, 1) };

    const out = vec3(0).toVar();
    If(dot(normal, uSheenUp).greaterThanEqual(SHEEN.up), () => {
      const P = vec3(positionView).toVar();
      if (D.MAPPED && mapTex) {
        If(uSheenK.z.greaterThan(0.5), () => {
          const ts = vec2(textureSize(mapTex, 0));
          const uq = floor(baseUv.mul(ts)).add(0.5).div(ts);
          const det = ux.x.mul(uy.y).sub(uy.x.mul(ux.y));
          If(abs(det).greaterThan(1e-14), () => {
            const du = uq.sub(baseUv);
            P.addAssign(px.mul(uy.y).sub(py.mul(ux.y)).mul(du.x).add(py.mul(ux.x).sub(px.mul(uy.x)).mul(du.y)).div(det));
          });
        });
      }
      const V = normalize(P.negate()), R = reflect(V.negate(), normal), sum = vec3(0).toVar();
      const a = uSheenK.y;
      const st0 = V.sub(normal.mul(dot(V, normal)));
      const st = select(dot(st0, st0).greaterThan(1e-8), normalize(st0), normalize(cross(normal, vec3(1, 0, 0))));
      const sb2 = cross(normal, st);
      for (let i = 0; i < count; i++) {
        const C = uSheenC[i];
        If(C.r.add(C.g).add(C.b).greaterThan(0), () => {
          const Tv = uSheenT[i].xyz, a0 = uSheenP[i].xyz.sub(Tv).sub(P), ab = Tv.mul(2);
          const rab = dot(R, ab), den = dot(ab, ab).sub(rab.mul(rab));
          const frac = select(den.greaterThan(1e-5), clamp(dot(R, a0).mul(rab).sub(dot(a0, ab)).div(den), 0, 1), float(0.5));
          const Ld = a0.add(ab.mul(frac));
          const d2 = dot(Ld, Ld).add(0.02);
          If(d2.lessThan(C.w), () => {
            const d = sqrt(d2), L = Ld.div(d), nl = dot(normal, L);
            If(nl.greaterThan(0), () => {
              const fade = float(1).sub(d2.div(C.w));
              const s0 = fade.mul(fade).div(d2.mul(SHEEN.falloff).div(max(uSheenT[i].w, 0.01)).add(1));
              const s = select(dot(Tv, Tv).greaterThan(1e-6), s0.mul(nl.mul(1 - SHEEN.side).add(SHEEN.side)), s0);
              const H = normalize(L.add(V));
              const nh = max(dot(normal, H), 1e-3);
              const ax = min(1.0, a.add(float(SHEEN.widen).div(d)));
              const ay = min(1.0, ax.mul(SHEEN.stretch));
              const ht = dot(H, st), hb = dot(H, sb2);
              const x = ht.mul(ht).div(ay.mul(ay)).add(hb.mul(hb).div(ax.mul(ax))).div(nh.mul(nh));
              const lobe = float(1).div(x.add(1).mul(x.add(1)));
              const F = float(SHEEN.f0).add(pow(max(float(1).sub(max(dot(H, V), 0)), 0), 5).mul(1 - SHEEN.f0));
              sum.addAssign(C.rgb.mul(s.mul(lobe).mul(F).mul(sheenShade(uSheenP[i].w, sa, sb))));
            });
          });
        });
      }
      const fe = float(SHEEN.f0).add(pow(max(float(1).sub(max(dot(normal, V), 0)), 0), 5).mul(1 - SHEEN.f0));
      const far = ss(SHEEN.envFrom, SHEEN.envTo, length(P));
      const tile = (D.MAPPED && mapSample) ? clamp(dot(mapSample.rgb, vec3(0.3333)).mul(SHEEN.envTile), 0, 1) : float(1);
      const litAmt = clamp(dot(vLit, vec3(0.3333)).mul(SHEEN.envLit), 0, 1);
      sum.addAssign(uSheenE.mul(float(SHEEN.env).mul(fe).mul(far.mul(0.9).add(0.1)).mul(tile).mul(litAmt).mul(sa.r.mul(0.5).add(0.5))));
      sum.mulAssign(uSheenK.x);
      const l = dot(sum, vec3(0.3333));
      If(l.greaterThan(1e-6), () => {
        out.assign(sum.mul(float(SHEEN.knee).mul(float(1).sub(exp(l.negate().div(SHEEN.knee)))).div(l)));
      });
    });
    return out;
  };
}
