// The Backrooms — the room light maps of kit.js (LIGHTMAP, TUBESHADOW, DOORLIGHT: Medium and High), for the node
// surface (kit-node.js) under ?gpu=webgpu. The same sums as kit.js's GLSL, number for number:
//   · which part of the room's map a vertex is on (lmRegion: the floor, or one of four walls; 0 none),
//   · where in the map a spot is (lmUv: snapped to the step grid, kept inside the room),
//   · each group of the room's lamps losing what its channel says is hidden (tubeShadows),
//   · the light of the rooms next door through up to four doorways (DOORLIGHT).
// The uniforms are world.js's (uLm, uLmA, uLmB, uLmC, uDoorL), read before every frame; a map not given yet (uLmC
// comes after the material) reads as a 1 × 1 stand-in until it is.
import { gpu } from '../engine/gpu.js';

let blank = null;
/** 1 × 1 stand-ins: a map that hides nothing (white), and a doorway that lets nothing in (black). */
function stand(white) {
  const N = gpu.nodes;
  blank ??= {};
  const k = white ? 'white' : 'black';
  if (!blank[k]) { const v = white ? 255 : 0; blank[k] = new N.DataTexture(new Uint8Array([v, v, v, v]), 1, 1); blank[k].needsUpdate = true; }
  return blank[k];
}

/**
 * The light map's part of a kit surface. Called inside kit-node's fragment Fn, with the material and what it already
 * has: `D` the defines, `banks` how many banks, `aSurf` (voxel surface, or null), `uDim`, `uTint`, `uFlick`, `uBanks`,
 * `uMoreBanks` (or null where the defines leave them out), `vAlb`. → (c) => c with the map's light taken off and the
 * doorways' added, or null when the surface has no LIGHTMAP.
 */
export function lightmapNode(m, D, k) {
  if (!D.LIGHTMAP) return null;
  const N = gpu.nodes, T = N.TSL;
  const { uniform, texture, attribute, varying, positionGeometry, normalGeometry, vec2, vec3, float, abs, floor, clamp, max, select } = T;
  const read = (key) => m.uniforms[key]?.value;
  // uLm: six vec4 (shadowmap.js layoutUniforms), copied before every frame
  const L = [0, 1, 2, 3, 4, 5].map((i) => { const n = uniform(new N.Vector4()); return n.onRenderUpdate(() => { const v = read('uLm')?.[i]; if (v) n.value.copy(v); }); });
  const tex = (key, white) => texture(read(key) || stand(white)).onRenderUpdate(() => read(key) || stand(white));

  // (VERT) which part of the map, from where the vertex is and which way it faces; inside the room only
  const p = positionGeometry, n = normalGeometry, L5 = L[5];
  const near = (a) => abs(a).lessThan(0.04);
  const wall = select(L[1].x.greaterThan(0).and(n.z.greaterThan(0.7)).and(near(p.z.add(L5.y))), 2,
    select(L[2].x.greaterThan(0).and(n.z.lessThan(-0.7)).and(near(p.z.sub(L5.y))), 3,
      select(L[3].x.greaterThan(0).and(n.x.greaterThan(0.7)).and(near(p.x.add(L5.x))), 4,
        select(L[4].x.greaterThan(0).and(n.x.lessThan(-0.7)).and(near(p.x.sub(L5.x))), 5, 0))));
  const floorOrWall = select(L[0].x.greaterThan(0).and(n.y.greaterThan(0.7)).and(near(p.y)), 1, select(abs(n.y).greaterThanEqual(0.3), 0, wall));
  const inside = abs(p.x).lessThanEqual(L5.x.add(0.002)).and(abs(p.z).lessThanEqual(L5.y.add(0.002)));
  let region = select(inside, floorOrWall, 0);
  let own = float(1);
  if (D.TUBESHADOW && D.VOXEL) { const self = k.aSurf.y.greaterThan(0.5); region = select(self, 0, region); own = select(self, 0, 1); }
  const vRegion = varying(float(region), 'vLmRegion');
  const vPos = varying(p, 'vLmPos');
  const share = (a) => varying(a.mul(k.uDim).mul(k.uTint).mul(own), undefined);
  const vF = D.TUBESHADOW && D.FLICK ? share(attribute('aFlk', 'vec3').mul(k.uFlick)) : null;
  const vB = D.TUBESHADOW && k.banks ? [
    share(attribute('aBank0', 'vec3').mul(k.uBanks.x)), share(attribute('aBank1', 'vec3').mul(k.uBanks.y)),
    k.banks > 2 ? share(attribute('aBank2', 'vec3').mul(k.uMoreBanks.x)) : null,
    k.banks > 3 ? share(attribute('aBank3', 'vec3').mul(k.uMoreBanks.y)) : null,
  ] : null;

  // (FRAG) where in the map: snapped to the step grid and kept inside the room
  const lmUv = (r) => {
    const floorQ = vPos.xz, wallQ = vPos.xy, sideQ = vPos.zy;
    const q = select(r.lessThan(1.5), floorQ, select(r.lessThan(3.5), wallQ, sideQ));
    const mm = select(r.lessThan(1.5), L[0], select(r.lessThan(2.5), L[1], select(r.lessThan(3.5), L[2], select(r.lessThan(4.5), L[3], L[4]))));
    const o = select(r.lessThan(1.5), L5.xy.negate(), select(r.lessThan(3.5), vec2(L5.x.negate(), 0), vec2(L5.y.negate(), 0)));
    const hi = select(r.lessThan(1.5), L5.xy, select(r.lessThan(3.5), vec2(L5.x, 1e4), vec2(L5.y, 1e4)));
    const snapped = clamp(floor(q.sub(o).div(L5.z)).add(0.5).mul(L5.z).add(o), o, hi);
    return snapped.mul(mm.xy).add(mm.zw);
  };
  const A = D.TUBESHADOW ? tex('uLmA', true) : null;
  const B = D.TUBESHADOW && k.banks > 2 ? tex('uLmB', true) : null;
  const C = D.DOORLIGHT ? tex('uLmC', false) : null;
  const doors = D.DOORLIGHT ? [0, 1, 2, 3].map((i) => { const u = uniform(new N.Vector3()); return u.onRenderUpdate(() => { const v = read('uDoorL')?.[i]; if (v) u.value.copy(v); }); }) : null;

  const apply = (c) => {
    const r = floor(vRegion.add(0.5));
    const uv = lmUv(r);
    let out = c;
    if (A) {
      const a = A.sample(uv);
      let rest = out, lost = vec3(0);
      if (vF) { rest = rest.sub(vF); lost = lost.add(vF.mul(a.g.oneMinus())); }
      if (vB) {
        rest = rest.sub(vB[0].add(vB[1])); lost = lost.add(vB[0].mul(a.b.oneMinus())).add(vB[1].mul(a.a.oneMinus()));
        if (vB[2]) { const b = B.sample(uv); rest = rest.sub(vB[2]); lost = lost.add(vB[2].mul(b.r.oneMinus()));
          if (vB[3]) { rest = rest.sub(vB[3]); lost = lost.add(vB[3].mul(b.g.oneMinus())); } }
      }
      out = out.sub(lost).sub(max(rest, 0).mul(a.r.oneMinus()));
    }
    if (C) {
      const d0 = C.sample(uv), d = d0.mul(d0);
      out = out.add(k.vAlb.mul(doors[0].mul(d.r).add(doors[1].mul(d.g)).add(doors[2].mul(d.b)).add(doors[3].mul(d.a))));
    }
    return select(r.lessThan(0.5), c, out);
  };
  /** Floor tube-shadow channels for kit-node-sheen.js, sampled in uniform control flow. */
  apply.floorShade = () => {
    if (!A) return { sa: T.vec4(1, 1, 1, 1), sb: vec2(1, 1) };
    const isFloor = floor(vRegion.add(0.5)).equal(1.0);
    const luv = lmUv(float(1));
    const sa = select(isFloor, A.sample(luv), T.vec4(1, 1, 1, 1));
    const sb = B ? select(isFloor, B.sample(luv).rg, vec2(1, 1)) : vec2(1, 1);
    return { sa, sb };
  };
  return apply;
}
