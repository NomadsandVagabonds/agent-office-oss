// The Backrooms — kit.js's surface, glowing and points materials for the WebGPU renderer (?gpu=webgpu: engine/gpu.js).
// Written in three.js's node language (TSL):
//   - baked light (steady, flicker, lamp banks) × dimmer × tint
//   - light maps (LIGHTMAP: TUBESHADOW and DOORLIGHT, Medium/High)
//   - floor sheen (SHEEN: anisotropic GGX tube streaks + environment wax, Medium/High)
//   - flashlight and camcorder-lamp cones
//   - voxel grain, seams and wet glint
//   - composable room hooks via `m.patchNode({ position?, uv?, wetNormal?, color?, replaceFragment? })`
//   - held-item depth sliver via `m.setHeldInFront(sliver)`
//   - MRT emissive output (`m.mrtNode`, used by vhs-node.js glow bloom on Medium/High without redrawing the scene)
//
// Not here yet (docs/BLOCKROOMS-WEBGPU.md): flashlight shadows (BEAM_SHADOWS, Step 6).
//
// The material keeps kit.js's `uniforms`, `defines`, `vertexShader` and `fragmentShader`, so that everything that
// reaches into one (uTint, uDim, uFlick, a room's patch, sheen.js) keeps working; uniforms are read every frame / draw.
import { gpu } from '../engine/gpu.js';
import { FLASHLIGHT, CAMCORDER_LAMP } from './flashlight.js';
import { glowStrength } from './glow.rule.js';
import { SHEEN } from './sheen.rule.js';

/**
 * A kit surface as a node material. `spec`: what kit.js surface() would hand ShaderMaterial (defines, uniforms,
 * vertexShader, fragmentShader, side, transparent, depthWrite).
 */
export function surfaceNode(spec) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec2, vec3, vec4, float, uniform, texture, textureSize, uv, attribute, varying, fract, floor, dot, cross, length,
    sqrt, exp, max, min, abs, mix, clamp, pow, normalize, reflect, step, select, If, Discard, mrt, dFdx, dFdy,
    positionGeometry, positionLocal, positionView, normalGeometry, normalViewGeometry, faceDirection,
    modelWorldMatrixInverse, cameraPosition, cameraNear, cameraFar, viewZToPerspectiveDepth } = T;
  const m = new N.NodeMaterial();
  Object.assign(m, { side: spec.side, transparent: spec.transparent, depthWrite: spec.depthWrite });
  m.colorNode = vec3(1, 1, 1); m.opacityNode = float(1);
  m.uniforms = spec.uniforms; m.defines = spec.defines;
  m.vertexShader = spec.vertexShader; m.fragmentShader = spec.fragmentShader;            // (for whoever patches them; not drawn)
  m.isKitSurface = true;

  // each uniform as kit.js holds it, read before every frame (a holder may be shared by a room: uFlick, uDim, uBanks)
  const read = (key) => m.uniforms[key]?.value;
  const f = (key, d = 0) => uniform(d).onRenderUpdate(() => { const v = read(key); return typeof v === 'number' ? v : d; });
  const v2 = (key) => { const n = uniform(new N.Vector2()); return n.onRenderUpdate(() => { const v = read(key); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector2) n.value.copy(v); }); };
  const v3 = (key) => { const n = uniform(new N.Vector3(1, 1, 1)); return n.onRenderUpdate(() => { const v = read(key); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector3) n.value.copy(v); else if (v?.isColor) n.value.set(v.r, v.g, v.b); }); };
  const v4 = (key) => { const n = uniform(new N.Vector4()); return n.onRenderUpdate(() => { const v = read(key); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector4) n.value.copy(v); }); };
  // per-object flat-array uniform readers for sheen.js (updated inside mesh.onBeforeRender just before draw)
  const v3Obj = (key, def = [0, 0, 0]) => { const n = uniform(new N.Vector3(...def)); return n.onObjectUpdate(() => { const v = read(key); if (v && v.length >= 3) n.value.set(v[0], v[1], v[2]); else if (v?.isVector3) n.value.copy(v); }); };
  const v4ObjAt = (key, idx) => { const n = uniform(new N.Vector4()); const off = idx * 4; return n.onObjectUpdate(() => { const v = read(key); if (v && v.length >= off + 4) n.value.set(v[off], v[off + 1], v[off + 2], v[off + 3]); }); };
  const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };
  const voxHash = (p0) => { const p = fract(p0.mul(vec3(0.1031, 0.1030, 0.0973))); const q = p.add(dot(p, p.yxz.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); };
  const surfaceBeam = (view, normal, origin, direction, coneCos, reach, att) => {
    const offset = view.sub(origin), d = length(offset), ray = offset.div(max(d, 0.0001));
    const cone = ss(coneCos[0], coneCos[1], dot(ray, direction));
    const fade = float(1).sub(ss(reach[0], reach[1], d));
    const incidence = max(dot(normal, ray.negate()), 0);
    return cone.mul(fade).mul(incidence).div(d.mul(d).mul(att).add(1));
  };

  const hooks = [];

  function rebuild() {
    const posHooks = hooks.filter((h) => h.position);
    if (posHooks.length) {
      m.positionNode = Fn(() => {
        let pos = positionGeometry;
        const baseUv = uv();
        for (const h of posHooks) pos = h.position({ T, N, m, pos, uv: baseUv, read, f, v2, v3, v4, ss });
        return pos;
      })();
    } else {
      m.positionNode = null;
    }

    const D = m.defines || {};
    const replaceHook = hooks.findLast((h) => h.replaceFragment);

    m.outputNode = Fn(() => {
      const def = m.defines || {};
      const banks = def.BANKS ? Number(def.BANKS) || 2 : 0;
      const uDim = f('uDim', 1), uTint = v3('uTint'), uAlpha = f('uAlpha', 1);
      const uFlick = def.FLICK ? f('uFlick', 1) : float(1);
      const uBanks = banks ? v2('uBanks') : null;
      const uMoreBanks = banks > 2 ? v2('uMoreBanks') : null;
      // (VERT: the light at the vertex)
      const aLit = attribute('aLit', 'vec3');
      let lit = aLit;
      if (banks) {
        lit = lit.add(attribute('aBank0', 'vec3').mul(uBanks.x)).add(attribute('aBank1', 'vec3').mul(uBanks.y));
        if (banks > 2) { lit = lit.add(attribute('aBank2', 'vec3').mul(uMoreBanks.x)); if (banks > 3) lit = lit.add(attribute('aBank3', 'vec3').mul(uMoreBanks.y)); }
      }
      if (def.FLICK) lit = lit.add(attribute('aFlk', 'vec3').mul(uFlick));
      lit = lit.mul(uDim);
      const aSurf = def.VOXEL ? attribute('aSurf', 'vec2') : null;
      if (def.VOXEL) lit = mix(lit, aLit, aSurf.y);
      const vLit = varying(lit.mul(uTint), 'vKitLit');
      const vAlb = attribute('aAlb', 'vec3');
      // (FRAG)
      const normal = normalViewGeometry.mul(faceDirection);
      const uTorch = f('uTorch'), uLamp = f('uCameraLamp'), uTorchOrigin = v3('uTorchOrigin'), uTorchDirection = v3('uTorchDirection');
      const baseUv = uv();
      const shared = {};
      let _localPos = null, _localNormal = null, _viewRayLocal = null;
      const localPos = () => _localPos || (_localPos = varying(positionLocal, 'vKitLocal'));
      const localNormal = () => _localNormal || (_localNormal = varying(normalGeometry, 'vKitNormal'));
      // Rigid-transform inverse of `mv.xyz * mat3(modelViewMatrix)` (object-space vector from camera to vertex)
      const viewRayLocal = () => _viewRayLocal || (_viewRayLocal = varying(positionLocal.sub(modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz), 'vKitPoolRay'));

      if (replaceHook) {
        return replaceHook.replaceFragment({
          T, N, m, uv: baseUv, vLit, vAlb, normal, viewPos: positionView,
          frontFacing: faceDirection.greaterThan(0), localPos, localNormal, viewRayLocal,
          uDim, uTint, uAlpha, uTorch, uLamp, uTorchOrigin, uTorchDirection,
          read, f, v2, v3, v4, ss, surfaceBeam, shared,
        });
      }

      const c = vec3(vLit).toVar();
      const alpha = float(uAlpha).toVar();

      // --- tube shadows & doorway light (LIGHTMAP: Medium / High) ---
      let lmRegionVar = null, lmUvFn = null, lmTexA = null, lmTexB = null;
      if (def.LIGHTMAP) {
        const uLm = Array.from({ length: 6 }, (_, i) => {
          const u = uniform(new N.Vector4());
          return u.onRenderUpdate(() => { const arr = read('uLm'); if (arr?.[i]) u.value.copy(arr[i]); });
        });
        const lp = positionLocal, ln = normalGeometry;
        const outOfBounds = abs(lp.x).greaterThan(uLm[5].x.add(0.002)).or(abs(lp.z).greaterThan(uLm[5].y.add(0.002)));
        let reg = float(0);
        reg = select(uLm[4].x.greaterThan(0).and(ln.x.lessThan(-0.7)).and(abs(lp.x.sub(uLm[5].x)).lessThan(0.04)), float(5), reg);
        reg = select(uLm[3].x.greaterThan(0).and(ln.x.greaterThan(0.7)).and(abs(lp.x.add(uLm[5].x)).lessThan(0.04)), float(4), reg);
        reg = select(uLm[2].x.greaterThan(0).and(ln.z.lessThan(-0.7)).and(abs(lp.z.sub(uLm[5].y)).lessThan(0.04)), float(3), reg);
        reg = select(uLm[1].x.greaterThan(0).and(ln.z.greaterThan(0.7)).and(abs(lp.z.add(uLm[5].y)).lessThan(0.04)), float(2), reg);
        reg = select(abs(ln.y).greaterThanEqual(0.3), float(0), reg);
        reg = select(uLm[0].x.greaterThan(0).and(ln.y.greaterThan(0.7)).and(abs(lp.y).lessThan(0.04)), float(1), reg);
        reg = select(outOfBounds, float(0), reg);
        let lmOwn = float(1);
        if (def.TUBESHADOW && def.VOXEL) {
          const selfLit = aSurf.y.greaterThan(0.5);
          reg = select(selfLit, float(0), reg);
          lmOwn = select(selfLit, float(0), float(1));
        }
        const vLmPos = localPos();
        lmRegionVar = varying(reg, 'vKitLmReg').setInterpolation('flat');
        lmUvFn = (k) => {
          const isFloor = k.lessThan(1.5), isBF = k.lessThan(3.5);
          const q = select(isFloor, vLmPos.xz, select(isBF, vLmPos.xy, vLmPos.zy));
          const mv = select(isFloor, uLm[0], select(isBF, select(k.lessThan(2.5), uLm[1], uLm[2]), select(k.lessThan(4.5), uLm[3], uLm[4])));
          const o = select(isFloor, vec2(uLm[5].x.negate(), uLm[5].y.negate()), select(isBF, vec2(uLm[5].x.negate(), 0), vec2(uLm[5].y.negate(), 0)));
          const hi = select(isFloor, uLm[5].xy, select(isBF, vec2(uLm[5].x, 1e4), vec2(uLm[5].y, 1e4)));
          const snapped = clamp(floor(q.sub(o).div(uLm[5].z)).add(0.5).mul(uLm[5].z).add(o), o, hi);
          return snapped.mul(mv.xy).add(mv.zw);
        };
        const lmScale = uDim.mul(uTint).mul(lmOwn);
        const vLmF = (def.TUBESHADOW && def.FLICK) ? varying(attribute('aFlk', 'vec3').mul(uFlick).mul(lmScale), 'vKitLmF') : null;
        const vLmB0 = (def.TUBESHADOW && banks) ? varying(attribute('aBank0', 'vec3').mul(uBanks.x).mul(lmScale), 'vKitLmB0') : null;
        const vLmB1 = (def.TUBESHADOW && banks) ? varying(attribute('aBank1', 'vec3').mul(uBanks.y).mul(lmScale), 'vKitLmB1') : null;
        const vLmB2 = (def.TUBESHADOW && banks > 2) ? varying(attribute('aBank2', 'vec3').mul(uMoreBanks.x).mul(lmScale), 'vKitLmB2') : null;
        const vLmB3 = (def.TUBESHADOW && banks > 3) ? varying(attribute('aBank3', 'vec3').mul(uMoreBanks.y).mul(lmScale), 'vKitLmB3') : null;
        if (def.TUBESHADOW) {
          lmTexA = texture(read('uLmA')).onRenderUpdate(() => read('uLmA'));
          if (banks > 2) lmTexB = texture(read('uLmB')).onRenderUpdate(() => read('uLmB'));
        }
        const lmTexC = def.DOORLIGHT ? texture(read('uLmC')).onRenderUpdate(() => read('uLmC')) : null;
        const uDoorL = def.DOORLIGHT ? Array.from({ length: 4 }, (_, i) => {
          const u = uniform(new N.Vector3());
          return u.onRenderUpdate(() => { const arr = read('uDoorL'); if (arr?.[i]) u.value.copy(arr[i]); });
        }) : null;
        const k = floor(lmRegionVar.add(0.5));
        If(k.greaterThanEqual(0.5), () => {
          const luv = lmUvFn(k);
          if (def.TUBESHADOW) {
            const a = lmTexA.sample(luv);
            const rest = vec3(c).toVar(), lost = vec3(0).toVar();
            if (vLmF) { rest.subAssign(vLmF); lost.addAssign(vLmF.mul(a.g.oneMinus())); }
            if (vLmB0) {
              rest.subAssign(vLmB0.add(vLmB1));
              lost.addAssign(vLmB0.mul(a.b.oneMinus()).add(vLmB1.mul(a.a.oneMinus())));
              if (vLmB2) {
                const b = lmTexB.sample(luv);
                rest.subAssign(vLmB2); lost.addAssign(vLmB2.mul(b.r.oneMinus()));
                if (vLmB3) { rest.subAssign(vLmB3); lost.addAssign(vLmB3.mul(b.g.oneMinus())); }
              }
            }
            c.assign(c.sub(lost).sub(max(rest, vec3(0)).mul(a.r.oneMinus())));
          }
          if (def.DOORLIGHT) {
            const d0 = lmTexC.sample(luv), d = d0.mul(d0);
            const spill = uDoorL[0].mul(d.r).add(uDoorL[1].mul(d.g)).add(uDoorL[2].mul(d.b)).add(uDoorL[3].mul(d.a));
            c.addAssign(vAlb.mul(spill));
          }
        });
      }
      // --- end tube shadows ---

      const torchBeam = surfaceBeam(positionView, normal, uTorchOrigin, uTorchDirection, [FLASHLIGHT.edgeCos, FLASHLIGHT.coreCos], [FLASHLIGHT.fadeFrom, FLASHLIGHT.range], FLASHLIGHT.attenuation);
      const lampBeam = surfaceBeam(positionView, normal, vec3(...CAMCORDER_LAMP.origin), vec3(...CAMCORDER_LAMP.direction), [CAMCORDER_LAMP.edgeCos, CAMCORDER_LAMP.coreCos], [CAMCORDER_LAMP.fadeFrom, CAMCORDER_LAMP.range], CAMCORDER_LAMP.attenuation);
      const beam = select(uTorch.greaterThan(0.0001), uTorch.mul(torchBeam), 0).add(select(uLamp.greaterThan(0.0001), uLamp.mul(lampBeam), 0));
      const torch = vAlb.mul(beam);
      let cell = null;
      if (def.VOXEL) {
        const vVox = attribute('aVox', 'vec3');
        c.addAssign(torch.mul(aSurf.y.oneMinus()));
        cell = floor(vVox.add(0.0005));
        c.mulAssign(voxHash(cell).sub(0.5).mul(2).mul(aSurf.x).add(1));
        const fr = fract(vVox).sub(0.5).abs().mul(2);
        const edge = ss(0.8, 1.0, max(fr.x, max(fr.y, fr.z)));
        c.mulAssign(float(1).sub(edge.mul(0.06).mul(aSurf.x.mul(6).add(0.4)).mul(aSurf.y.oneMinus())));
      } else c.addAssign(torch);
      let mapTex = null, mapSample = null;
      if (def.MAPPED) {
        let mapUv = baseUv;
        for (const h of hooks) {
          if (h.uv) mapUv = h.uv({ T, N, m, mapUv, uv: baseUv, localPos, localNormal, viewRayLocal, read, f, v2, v3, v4, ss, shared });
        }
        mapTex = texture(read('map')).onRenderUpdate(() => read('map'));
        mapSample = mapTex.sample(mapUv);
        if (def.CUTOUT) If(mapSample.a.lessThan(0.5), () => { Discard(); });
        c.mulAssign(mapSample.rgb);
      }
      const uWet = def.WET ? f('uWet') : float(0);
      if (def.WET) {
        let wn = normal;
        if (def.VOXEL) wn = normalize(wn.add(vec3(voxHash(cell), voxHash(cell.add(17)), voxHash(cell.add(31))).sub(0.5).mul(0.55)));
        for (const h of hooks) {
          if (h.wetNormal) wn = h.wetNormal({ T, N, m, wn, normal, uv: baseUv, localPos, localNormal, viewPos: positionView, read, f, v2, v3, v4, ss, shared });
        }
        const wv = normalize(positionView.negate());
        const glint = pow(max(dot(wn, normalize(wv.add(vec3(0.2, 0.85, 0.35)))), 0), 34);
        const rim = pow(max(float(1).sub(max(dot(wn, wv), 0)), 0), 3);
        const room = dot(vLit, vec3(0.333));
        c.addAssign(vec3(1.0, 0.97, 0.94).mul(glint.mul(1.1).add(rim.mul(0.22)).mul(uWet).mul(room.add(0.12))));
      }

      // --- floor sheen (SHEEN: Medium / High) ---
      if (def.SHEEN) {
        const count = Number(def.SHEEN) || SHEEN.lamps;
        const uSheenP = Array.from({ length: count }, (_, i) => v4ObjAt('uSheenP', i));
        const uSheenT = Array.from({ length: count }, (_, i) => v4ObjAt('uSheenT', i));
        const uSheenC = Array.from({ length: count }, (_, i) => v4ObjAt('uSheenC', i));
        const uSheenK = v4ObjAt('uSheenK', 0);
        const uSheenUp = v3Obj('uSheenUp', [0, 1, 0]);
        const uSheenE = v3Obj('uSheenE', [0, 0, 0]);
        const sheenShade = (g, sa, sb) => select(g.lessThan(0.5), sa.r, select(g.lessThan(1.5), sa.g, select(g.lessThan(2.5), sa.b, select(g.lessThan(3.5), sa.a, select(g.lessThan(4.5), sb.r, sb.g)))));
        If(dot(normal, uSheenUp).greaterThanEqual(SHEEN.up), () => {
          const P = vec3(positionView).toVar();
          if (def.MAPPED && mapTex) {
            If(uSheenK.z.greaterThan(0.5), () => {
              const ts = vec2(textureSize(mapTex, 0));
              const uq = floor(baseUv.mul(ts)).add(0.5).div(ts);
              const px = dFdx(positionView), py = dFdy(positionView);
              const ux = dFdx(baseUv), uy = dFdy(baseUv);
              const det = ux.x.mul(uy.y).sub(uy.x.mul(ux.y));
              If(abs(det).greaterThan(1e-14), () => {
                const du = uq.sub(baseUv);
                P.addAssign(px.mul(uy.y).sub(py.mul(ux.y)).mul(du.x).add(py.mul(ux.x).sub(px.mul(uy.x)).mul(du.y)).div(det));
              });
            });
          }
          const sa = vec4(1, 1, 1, 1).toVar(), sb = vec2(1, 1).toVar();
          if (def.LIGHTMAP && def.TUBESHADOW && lmRegionVar && lmUvFn && lmTexA) {
            If(floor(lmRegionVar.add(0.5)).equal(1.0), () => {
              const luv = lmUvFn(float(1));
              sa.assign(lmTexA.sample(luv));
              if (lmTexB) sb.assign(lmTexB.sample(luv).rg);
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
          const tile = (def.MAPPED && mapSample) ? clamp(dot(mapSample.rgb, vec3(0.3333)).mul(SHEEN.envTile), 0, 1) : float(1);
          const litAmt = clamp(dot(vLit, vec3(0.3333)).mul(SHEEN.envLit), 0, 1);
          sum.addAssign(uSheenE.mul(float(SHEEN.env).mul(fe).mul(far.mul(0.9).add(0.1)).mul(tile).mul(litAmt).mul(sa.r.mul(0.5).add(0.5))));
          sum.mulAssign(uSheenK.x);
          const l = dot(sum, vec3(0.3333));
          If(l.greaterThan(1e-6), () => {
            c.addAssign(sum.mul(float(SHEEN.knee).mul(float(1).sub(exp(l.negate().div(SHEEN.knee)))).div(l)));
          });
        });
      }
      // --- end floor sheen ---

      for (const h of hooks) {
        if (h.color) {
          h.color({
            T, N, m, c, alpha, uv: baseUv, vLit, vAlb, normal, viewPos: positionView,
            frontFacing: faceDirection.greaterThan(0), localPos, localNormal, viewRayLocal,
            uDim, uTint, uAlpha, uWet, uTorch, uLamp, uTorchOrigin, uTorchDirection,
            read, f, v2, v3, v4, ss, surfaceBeam, shared,
          });
        }
      }
      return vec4(c, alpha);
    })();

    // --- MRT emissive descriptor (read by vhs-node.js EmissiveMrtNode ONLY while MRT glow is active) ---
    if (m.transparent && !m.depthWrite) {
      m.userData.emissiveMrt = vec4(0, 0, 0, 0);
    } else if (D.VOXEL && !replaceHook) {
      const uGlowScale = uniform(1).onObjectUpdate(() => glowStrength(m.userData.bloom));
      m.userData.emissiveMrt = Fn(() => {
        const def = m.defines || {};
        const aSurf = attribute('aSurf', 'vec2');
        const aLit = attribute('aLit', 'vec3');
        const uTint = v3('uTint');
        const selfLit = step(0.5, aSurf.y);
        let emitted = varying(aLit.mul(uTint), 'vKitEmisLit').mul(selfLit).mul(uGlowScale);
        if (def.MAPPED) {
          const map = texture(read('map')).onRenderUpdate(() => read('map'));
          emitted = emitted.mul(map.sample(uv()).rgb);
        }
        return vec4(emitted, float(1).sub(selfLit));
      })();
    } else {
      delete m.userData.emissiveMrt;
    }
  }

  rebuild();

  /** Attach a TSL hook ({ init?, position?, uv?, wetNormal?, color?, replaceFragment? }) to this kit surface. */
  m.patchNode = (hook) => {
    hook.init?.({ T, N, m });
    hooks.push(hook);
    rebuild();
    m.needsUpdate = true;
    return m;
  };

  /** Draw a held first-person surface into the nearest depth sliver [0, sliver] without clearing room depth. */
  m.setHeldInFront = (sliver = 0.002) => {
    m.depthNode = sliver > 0 ? clamp(viewZToPerspectiveDepth(positionView.z, cameraNear, cameraFar), 0, 1).mul(sliver) : null;
    m.needsUpdate = true;
    return m;
  };

  return m;
}

/**
 * Something that shines by itself (kit.glowing), for WebGPURenderer: MeshBasicNodeMaterial with an MRT emissive output
 * so Medium/High glow bloom reads lamps, signs and screens directly from the scene pass without redrawing the scene.
 */
export function glowingNode(map, power, rgb, opt = {}) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec3, vec4, float, uniform, texture, uv } = T;
  const m = new N.MeshBasicNodeMaterial({
    map,
    transparent: !!opt.transparent,
    alphaTest: opt.alphaTest || 0,
    side: opt.side || N.FrontSide,
    depthWrite: opt.depthWrite !== false,
  });
  m.color.setRGB(rgb[0] * power, rgb[1] * power, rgb[2] * power);
  if (m.transparent && m.depthWrite === false) {
    // Painted pool of light or halo: does not feed bloom (matches glow.js glowRole === 'skip').
    m.userData.emissiveMrt = vec4(0, 0, 0, 0);
  } else {
    const uCol = uniform(new N.Vector3(m.color.r, m.color.g, m.color.b)).onObjectUpdate(() => { uCol.value.set(m.color.r, m.color.g, m.color.b); });
    const uScale = uniform(1).onObjectUpdate(() => glowStrength(m.userData.bloom));
    m.userData.emissiveMrt = Fn(() => {
      const pictureMark = (m.userData.glow === 'picture' && !m.transparent) ? 0.25 : 1.0;
      const texRgb = map ? texture(map, uv()).rgb : vec3(1, 1, 1);
      return vec4(uCol.mul(texRgb).mul(uScale), float(pictureMark));
    })();
  }
  return m;
}

const PACKED = /^a(Lit|Flk|Bank\d|Vox|Surf)$/;
/**
 * WebGPU lets a draw read from 8 vertex buffers at most, and a kit geometry with four lamp banks has up to 12. Under
 * the flag, kit.js geometry() hands its own float attributes (the baked light, flicker, banks, voxel position and
 * surface) to this, which puts them into one interleaved buffer: position, normal, uv, the pack and the albedo, 5 in
 * all. Nothing outside kit.js reads these on the CPU. → the geometry.
 */
export function packSurfaceAttributes(geo) {
  const N = gpu.nodes;
  const names = Object.keys(geo.attributes).filter((n) => PACKED.test(n) && geo.attributes[n].array instanceof Float32Array && !geo.attributes[n].normalized);
  if (names.length < 2) return geo;
  const count = geo.attributes[names[0]].count, stride = names.reduce((s, n) => s + geo.attributes[n].itemSize, 0);
  const data = new Float32Array(count * stride);
  let offset = 0;
  const placed = names.map((n) => {
    const a = geo.attributes[n], size = a.itemSize, src = a.array;
    for (let i = 0; i < count; i++) for (let k = 0; k < size; k++) data[i * stride + offset + k] = src[i * size + k];
    const at = { n, size, offset }; offset += size; return at;
  });
  const buffer = new N.InterleavedBuffer(data, stride);
  for (const { n, size, offset: o } of placed) geo.setAttribute(n, new N.InterleavedBufferAttribute(buffer, size, o));
  return geo;
}

/**
 * World-sized points for WebGPU (which draws primitive points at 1 px): an instanced pool of camera-facing quads of
 * `size` metres, sharing the caller's Float32Array `positions`. → { object, attribute }.
 */
export function pointsNode(positions, { size = 0.05, map = null, alphaTest = 0.5, color = [1, 1, 1] } = {}, own = (x) => x) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec3, vec4, float, uv, attribute, texture, positionGeometry, modelViewMatrix, cameraProjectionMatrix, If, Discard } = T;
  const count = Math.floor(positions.length / 3);
  const quad = own(new N.PlaneGeometry(size, size));
  const geo = own(new N.InstancedBufferGeometry());
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const posAttr = new N.InstancedBufferAttribute(positions, 3);
  posAttr.setUsage(N.DynamicDrawUsage);
  geo.setAttribute('aPos', posAttr);
  geo.instanceCount = count;
  const col = color?.isColor ? [color.r, color.g, color.b] : Array.isArray(color) ? color : [1, 1, 1];
  const mat = own(new N.NodeMaterial());
  mat.colorNode = vec3(1, 1, 1); mat.opacityNode = float(1);
  mat.vertexNode = Fn(() => {
    const mv = modelViewMatrix.mul(vec4(attribute('aPos', 'vec3'), 1)).toVar();
    mv.xy.addAssign(positionGeometry.xy);
    return cameraProjectionMatrix.mul(mv);
  })();
  mat.outputNode = Fn(() => {
    const tint = vec3(col[0], col[1], col[2]);
    if (map) {
      const t = texture(map, uv());
      if (alphaTest > 0) If(t.a.lessThan(alphaTest), () => { Discard(); });
      return vec4(t.rgb.mul(tint), 1);
    }
    return vec4(tint, 1);
  })();
  const object = new N.Mesh(geo, mat);
  return { object, attribute: posAttr };
}
