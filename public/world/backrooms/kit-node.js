// The Backrooms — kit.js's one surface material, for the WebGPU renderer (?gpu=webgpu: engine/gpu.js). The same sum as
// kit.js VERT and FRAG, in three.js's node language (TSL): the light baked into the vertices (steady, flicker, the lamp
// banks) times the room's dimmer and tint; the flashlight's and the camcorder lamp's cones; a voxel's grain and the line
// where voxels meet; the texture (cut out where it says); the wet glint. Every number is kit.js's.
//
// The light maps (LIGHTMAP, TUBESHADOW, DOORLIGHT) are kit-node-light.js, the flashlight's shadows (BEAM_SHADOWS)
// are kit-node-shadow.js, and what a surface gives the glow (glow.js's twin) is its second output while the glow's
// pass draws (glow-node.js). Not here yet (docs/BLOCKROOMS-WEBGPU.md), so not drawn under ?gpu=webgpu whatever the
// tier says: the floor's sheen (SHEEN). Rooms that extend a kit surface call `m.patchNode(hook)` to plug into position,
// map UV, wet normal, final colour/alpha, or replace the fragment stage while keeping kit's baked light and uniform readers.
//
// The material keeps kit.js's `uniforms`, `defines`, `vertexShader` and `fragmentShader`, so that everything that
// reaches into one (uTint, uDim, uFlick, a room's patch) keeps working; the uniforms are read every frame. The defines
// are read when the material is built, and again whenever it is rebuilt (`m.rebuildNode()`).
import { gpu } from '../engine/gpu.js';
import { FLASHLIGHT, CAMCORDER_LAMP } from './flashlight.js';
import { lightmapNode } from './kit-node-light.js';
import { beamShadowNode } from './kit-node-shadow.js';
import { glowStrength } from './glow.rule.js';

/**
 * A kit surface as a node material. `spec`: what kit.js surface() would hand ShaderMaterial (defines, uniforms,
 * vertexShader, fragmentShader, side, transparent, depthWrite).
 */
export function surfaceNode(spec) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec3, vec4, float, uniform, texture, uv, attribute, varying, fract, floor, dot, length, max, mix, clamp, pow, normalize,
    select, If, Discard, positionGeometry, positionLocal, positionView, normalGeometry, normalViewGeometry, faceDirection,
    modelWorldMatrixInverse, cameraPosition, cameraNear, cameraFar, viewZToPerspectiveDepth, mrt, step } = T;
  const m = new N.NodeMaterial();
  Object.assign(m, { side: spec.side, transparent: spec.transparent, depthWrite: spec.depthWrite });
  m.uniforms = spec.uniforms; m.defines = spec.defines;
  m.vertexShader = spec.vertexShader; m.fragmentShader = spec.fragmentShader;            // (for whoever patches them; not drawn)
  m.isKitSurface = true;

  // each uniform as kit.js holds it, read before every frame (a holder may be shared by a room: uFlick, uDim, uBanks)
  const read = (key) => m.uniforms[key]?.value;
  const f = (key, d = 0) => uniform(d).onRenderUpdate(() => { const v = read(key); return typeof v === 'number' ? v : d; });
  const v2 = (key) => { const n = uniform(new N.Vector2()); return n.onRenderUpdate(() => { const v = read(key); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector2) n.value.copy(v); }); };
  const v3 = (key) => { const n = uniform(new N.Vector3(1, 1, 1)); return n.onRenderUpdate(() => { const v = read(key); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector3) n.value.copy(v); else if (v?.isColor) n.value.set(v.r, v.g, v.b); }); };
  const v4 = (key) => { const n = uniform(new N.Vector4()); return n.onRenderUpdate(() => { const v = read(key); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector4) n.value.copy(v); }); };
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

    m.fragmentNode = Fn((builder) => {
      glowOut = null;
      const D = m.defines || {};
      const banks = D.BANKS ? Number(D.BANKS) || 2 : 0;
      const uDim = f('uDim', 1), uTint = v3('uTint'), uAlpha = f('uAlpha', 1);
      // (VERT: the light at the vertex)
      const aLit = attribute('aLit', 'vec3');
      let lit = aLit;
      const uBanks = banks ? v2('uBanks') : null, uMoreBanks = banks > 2 ? v2('uMoreBanks') : null, uFlick = D.FLICK ? f('uFlick', 1) : null;
      if (banks) {
        lit = lit.add(attribute('aBank0', 'vec3').mul(uBanks.x)).add(attribute('aBank1', 'vec3').mul(uBanks.y));
        if (banks > 2) { lit = lit.add(attribute('aBank2', 'vec3').mul(uMoreBanks.x)); if (banks > 3) lit = lit.add(attribute('aBank3', 'vec3').mul(uMoreBanks.y)); }
      }
      if (D.FLICK) lit = lit.add(attribute('aFlk', 'vec3').mul(uFlick));
      lit = lit.mul(uDim);
      const aSurf = D.VOXEL ? attribute('aSurf', 'vec2') : null;
      if (D.VOXEL) lit = mix(lit, aLit, aSurf.y);
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

      const replaceHook = hooks.findLast((h) => h.replaceFragment);
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
      // (Medium, High: the room's light map, kit-node-light.js)
      const lightmapped = lightmapNode(m, D, { banks, aSurf, uDim, uTint, uFlick, uBanks, uMoreBanks, vAlb });
      if (lightmapped) c.assign(lightmapped(c));
      const torchBeam = surfaceBeam(positionView, normal, uTorchOrigin, uTorchDirection, [FLASHLIGHT.edgeCos, FLASHLIGHT.coreCos], [FLASHLIGHT.fadeFrom, FLASHLIGHT.range], FLASHLIGHT.attenuation);
      const lampBeam = surfaceBeam(positionView, normal, vec3(...CAMCORDER_LAMP.origin), vec3(...CAMCORDER_LAMP.direction), [CAMCORDER_LAMP.edgeCos, CAMCORDER_LAMP.coreCos], [CAMCORDER_LAMP.fadeFrom, CAMCORDER_LAMP.range], CAMCORDER_LAMP.attenuation);
      let torchPart = select(uTorch.greaterThan(0.0001), uTorch.mul(torchBeam), 0);
      // (High: the flashlight's shadow, kit-node-shadow.js; only the torch's share is shadowed, never the camcorder lamp)
      const shadowed = beamShadowNode(m, D, uTorchOrigin);
      if (shadowed) torchPart = select(torchPart.greaterThan(0), torchPart.mul(shadowed(positionView, normal)), torchPart);
      const beam = torchPart.add(select(uLamp.greaterThan(0.0001), uLamp.mul(lampBeam), 0));
      const torch = vAlb.mul(beam);
      let cell = null;
      if (D.VOXEL) {
        const vVox = attribute('aVox', 'vec3');
        c.addAssign(torch.mul(aSurf.y.oneMinus()));
        cell = floor(vVox.add(0.0005));
        c.mulAssign(voxHash(cell).sub(0.5).mul(2).mul(aSurf.x).add(1));
        const fr = fract(vVox).sub(0.5).abs().mul(2);
        const edge = ss(0.8, 1.0, max(fr.x, max(fr.y, fr.z)));
        c.mulAssign(float(1).sub(edge.mul(0.06).mul(aSurf.x.mul(6).add(0.4)).mul(aSurf.y.oneMinus())));
      } else c.addAssign(torch);
      let t = null;
      if (D.MAPPED) {
        let mapUv = baseUv;
        for (const h of hooks) {
          if (h.uv) mapUv = h.uv({ T, N, m, mapUv, uv: baseUv, localPos, localNormal, viewRayLocal, read, f, v2, v3, v4, ss, shared });
        }
        const map = texture(read('map')).onRenderUpdate(() => read('map'));
        t = map.sample(mapUv);
        if (D.CUTOUT) If(t.a.lessThan(0.5), () => { Discard(); });
        c.mulAssign(t.rgb);
      }
      const uWet = D.WET ? f('uWet') : float(0);
      if (D.WET) {
        let wn = normal;
        if (D.VOXEL) wn = normalize(wn.add(vec3(voxHash(cell), voxHash(cell.add(17)), voxHash(cell.add(31))).sub(0.5).mul(0.55)));
        for (const h of hooks) {
          if (h.wetNormal) wn = h.wetNormal({ T, N, m, wn, normal, uv: baseUv, localPos, localNormal, viewPos: positionView, read, f, v2, v3, v4, ss, shared });
        }
        const wv = normalize(positionView.negate());
        const glint = pow(max(dot(wn, normalize(wv.add(vec3(0.2, 0.85, 0.35)))), 0), 34);
        const rim = pow(max(float(1).sub(max(dot(wn, wv), 0)), 0), 3);
        const room = dot(vLit, vec3(0.333));
        c.addAssign(vec3(1.0, 0.97, 0.94).mul(glint.mul(1.1).add(rim.mul(0.22)).mul(uWet).mul(room.add(0.12))));
      }
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
      // (Medium, High: the scene pass also writes what shines, glow-node.js. glow.js's twin: a self-lit voxel gives its
      // light, × the texture, × the surface's own bloom; the rest is black and hides; the alpha is the mark. Made here,
      // where its parts are, and handed over by glowEmissive below)
      if (builder?.renderer?.getMRT?.()?.has?.('emissive')) {
        let emitted = vec3(0), plainly = float(1);
        if (D.VOXEL) { const on = step(0.5, aSurf.y); emitted = vLit.mul(on); plainly = on.oneMinus(); }
        if (t) emitted = emitted.mul(t.rgb);
        const strength = uniform(1).onRenderUpdate(() => glowStrength(m.userData.bloom));
        glowOut = m.transparent && m.depthWrite === false ? vec4(0) : vec4(emitted.mul(strength), plainly);
      }
      return vec4(c, alpha);
    })();
  }

  // (what it gives the glow while the glow's pass is drawn: glow-node.js puts it beside the colour; a room's replaced
  // fragment gives black, which hides)
  let glowOut = null;
  // (deferred: it is read when the output is built, after the fragment above has made it)
  m.glowEmissive = () => Fn(() => glowOut ?? vec4(0, 0, 0, 1))();

  rebuild();

  /** Rebuild the node graph after runtime define changes (e.g. BEAM_SHADOWS) so WebGPURenderer sees a fresh cache key. */
  m.rebuildNode = () => {
    rebuild();
    m.needsUpdate = true;
    return m;
  };

  /** Attach a TSL hook ({ position?, uv?, wetNormal?, color?, replaceFragment? }) to this kit surface. */
  m.patchNode = (hook) => {
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
  const { Fn, vec3, vec4, uv, attribute, texture, positionGeometry, modelViewMatrix, cameraProjectionMatrix, If, Discard } = T;
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
  mat.vertexNode = Fn(() => {
    const mv = modelViewMatrix.mul(vec4(attribute('aPos', 'vec3'), 1)).toVar();
    mv.xy.addAssign(positionGeometry.xy);
    return cameraProjectionMatrix.mul(mv);
  })();
  mat.fragmentNode = Fn(() => {
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
