// The Backrooms — water (graphics.js `water`, Medium and High), for the WebGPU renderer (?gpu=webgpu). Redone on
// three.js's nodes, not translated: the owner's word, "we can both make big gains and make it more efficient".
//
// liquid.js draws the scene in two parts (everything opaque, a copy of its colour and depth, then the water and what is
// see-through over it, by moving them to a layer of their own). Here there is one pass. The water is drawn after what
// is opaque, in the same pass, and reads what is behind it from three.js's own copies of the picture so far
// (viewportSharedTexture, viewportDepthTexture). No copy pass of ours, no layers moved, no material swapped in and out
// for the draw.
//
// What it shows is liquid.js's, from liquid.rule.js's numbers:
//   - Medium & High: stepped 5 cm cell ripples (flat far off), wake rings (feel & disturb), depth-scaled refraction,
//     Beer-Lambert absorption & scatter in the sheet's tint, 2-layer caustics, stirred light in fresh rings, Fresnel,
//     contact line, wake crest/trough light;
//   - Wave pool swell (SWELL): dense copy of the sheet raised, banded slope, face glint, dark trough, foam, break rings;
//   - Underwater underside (UNDERSIDE / seesUnderside): Snell's window looking up through ripples/swell/wake from inside
//     a facing-up pool's rim, refracting what is above with foreground depth guard and Beer-Lambert tint;
//   - High planar mirror (water 2, MIRROR): one shared ReflectorNode positioned on the nearest visible facing-up water
//     plane (pickMirror / mirrorGate / mirrorWeight), hiding sheets/noReflect/held/detail and transforming the torch
//     and its beam shadow matrix into mirror camera space; shared across all surfaces on the same horizontal plane.
import { gpu } from '../engine/gpu.js';
import { LIQUID, SWELL, UNDERSIDE, MIRROR, underwater, seesUnderside, holdStep, wakeStart, wakeStep, wakeFill,
  waterColours, wadeStep, swellRings, mirrorPlane, reflectMatrix, pickMirror, mirrorLeaves, screenCover,
  mirrorGate, mirrorWeight } from './liquid.rule.js';
import { HELD_ORDER } from './beam-shadows.rule.js';
import { collectLiquids } from './liquid.mark.js';
import { sheetTint, sheetRim, swellGeometry } from './liquid.js';

/** Shared per-pair node uniforms reused across flat / swell / mirror / underside variants of a single sheet. */
function makeOwnUniforms(rec) {
  const N = gpu.nodes, T = N.TSL;
  return {
    roomToView: T.uniform(new N.Matrix3()),
    eyeRoom: T.uniform(new N.Vector3()),
    mirrorOn: T.uniform(0),
    rings: T.uniformArray(rec.wake.u.uRings.value, 'vec4'),
    ringN: T.uniform(0, 'int').onRenderUpdate(() => rec.wake.u.uRingN.value | 0),
    phase: T.uniform(0).onRenderUpdate(() => (Number.isFinite(rec.phase?.value) ? rec.phase.value : 0)),
  };
}

/**
 * The water's node material for one sheet `old` (a kit surface) of `rec`, `toRoom` its matrix into the room's frame.
 * Variants: `swell` (wave pool raised mesh), `underside` (seen from inside the pool looking up), `mirror` (High
 * planar reflection via shared `refl` ReflectorNode; never used on underside).
 */
function waterNode(old, rec, toRoom, shared, own, { swell = false, underside = false, mirror = false, refl = null } = {}) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec2, vec3, vec4, float, int, uniform, texture, attribute, varying, positionGeometry, positionView, screenUV, screenSize,
    viewportSharedTexture, viewportDepthTexture, floor, fract, sin, cos, exp, exp2, log2, ceil, sqrt, inverseSqrt, pow, dot, length, distance,
    normalize, mix, clamp, max, min, step, select, fwidth, reflect, Loop, If } = T;
  const read = (k) => old.material.uniforms?.[k]?.value;
  const num = (k, d) => uniform(d).onRenderUpdate(() => { const v = read(k); return typeof v === 'number' ? v : d; });
  const vec2u = (k, d) => { const n = uniform(new N.Vector2(...d)); return n.onRenderUpdate(() => { const v = read(k); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector2) n.value.copy(v); }); };
  const vec3u = (k) => { const n = uniform(new N.Vector3(1, 1, 1)); return n.onRenderUpdate(() => { const v = read(k); if (v?.isVector3) n.value.copy(v); else if (Array.isArray(v)) n.value.fromArray(v); }); };
  const D = old.material.defines || {};
  const { tint, alpha } = sheetTint(old), col = waterColours(tint, alpha);
  const deep = vec3(...col.deep), absorb = vec3(...col.absorb), scatter = vec3(...col.scatter), keep = vec4(...col.keep, col.keepRate);
  const toRoomU = uniform(new N.Matrix4().fromArray(toRoom));
  const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(float(e1).sub(e0)), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };
  const luma = (c) => dot(c, vec3(0.299, 0.587, 0.114));
  const { uTime, near, far } = shared;

  // (VERT, as LIQUID_VERT: the sheet's baked light with the room's dimmer, flicker, banks and tint; where it is in the room)
  let lit = attribute('aLit', 'vec3');
  const banks = D.BANKS ? Number(D.BANKS) || 2 : 0;
  if (banks) {
    const b = vec2u('uBanks', [1, 1]);
    lit = lit.add(attribute('aBank0', 'vec3').mul(b.x)).add(attribute('aBank1', 'vec3').mul(b.y));
    if (banks > 2) { const m = vec2u('uMoreBanks', [0, 0]); lit = lit.add(attribute('aBank2', 'vec3').mul(m.x)); if (banks > 3) lit = lit.add(attribute('aBank3', 'vec3').mul(m.y)); }
  }
  if (D.FLICK) lit = lit.add(attribute('aFlk', 'vec3').mul(num('uFlick', 1)));
  const vLit = varying(lit.mul(num('uDim', 1)).mul(vec3u('uTint')), 'vWaterLit');
  // (the swell: the sheet's own y raised by it, which is its room's y: liquid.js swells only such a sheet)
  const SW = swell ? {
    s: uniform(new N.Vector4()).onRenderUpdate(function () { if (rec.swellU) this.value.copy(rec.swellU.uSwell.value); }),
    box: uniform(new N.Vector4()).onRenderUpdate(function () { if (rec.swellU) this.value.copy(rec.swellU.uSwellBox.value); }),
  } : null;
  const swellD = (p) => p.y.sub(SW.s.x.add(sin(p.x.mul(SWELL.sweep[1])).mul(SWELL.sweep[0])).add(sin(p.x.mul(SWELL.sweep[3]).add(SWELL.sweep[4])).mul(SWELL.sweep[2])));
  const swellUnit = (d) => {
    const ahead = d.greaterThan(0);
    const fa = d.div(SWELL.face), ba = d.div(SWELL.back), q = d.div(0.6), e = d.add(SWELL.troughAt).div(SWELL.troughW);
    const face = select(ahead, exp(fa.mul(fa).negate()), exp(ba.mul(ba).negate()));
    const fore = select(ahead, exp(d.negate().div(SWELL.foreLen)).mul(exp(q.mul(q).negate()).oneMinus()).mul(SWELL.fore), 0);
    return face.add(fore).sub(exp(e.mul(e).negate()).mul(SWELL.trough));
  };
  const swellAt = (p) => {
    const b = SW.box, a = SW.s.y.mul(sin(p.x.mul(SWELL.vary[1]).add(SWELL.vary[2])).mul(SWELL.vary[0]).add(1));
    const fade = ss(b.x, b.x.add(SWELL.wall), p.x).mul(ss(b.z.sub(SWELL.wall), b.z, p.x).oneMinus())
      .mul(ss(b.y, b.y.add(SWELL.ends[0]), p.y)).mul(ss(b.w.sub(SWELL.ends[1]), b.w, p.y).oneMinus());
    const h = a.mul(swellUnit(swellD(p))).mul(fade);
    const room = max(own.eyeRoom.y.sub(SW.s.z).sub(SWELL.eyeClear), 0), nearE = ss(SWELL.eyeNear, SWELL.eyeFar, distance(p, own.eyeRoom.xz));
    return select(own.eyeRoom.y.greaterThan(SW.s.z), mix(min(h, room), h, nearE), h);
  };
  const raised = swell ? positionGeometry.add(vec3(0, swellAt(toRoomU.mul(vec4(positionGeometry, 1)).xz), 0)) : positionGeometry;
  const vRoom = varying(toRoomU.mul(vec4(raised, 1)).xyz, 'vWaterRoom');

  const height = (p) => {
    const q = p.sub(vec2(...LIQUID.drift).mul(own.phase));
    return sin(q.x.mul(3.1).add(uTime.mul(1.3))).mul(0.006).add(sin(q.y.mul(2.3).sub(uTime.mul(1.1))).mul(0.005))
      .add(sin(q.x.add(q.y).mul(5.7).add(uTime.mul(2.1))).mul(0.003)).mul(LIQUID.ripple);
  };
  const wakeRing = (p, w, base, rc) => {
    const q = floor(w.w.div(4)), s = w.w.sub(q.mul(4)), waves = q.div(16).add(1);
    const age = w.z, r = length(p.sub(w.xy));
    const front = float(LIQUID.wakeFrom).add(age.mul(LIQUID.wakeSpeed)).add(base.mul(LIQUID.wakeWobble));
    const d = r.sub(front), lambda = max(float(LIQUID.wakeWave), rc.mul(3));
    const width = lambda.mul(waves).mul(0.5).mul(age.mul(LIQUID.wakeWiden).add(1)), e = d.add(width.mul(0.4));
    const t = clamp(age.div(LIQUID.wakeLife).oneMinus(), 0, 1);
    const a = s.mul(exp(age.mul(-LIQUID.wakeDamp))).mul(t).mul(t).mul(inverseSqrt(r.mul(LIQUID.wakeSpread).add(1)));
    const env = a.mul(exp(e.mul(e).negate().div(width.mul(width)))).mul(ss(lambda.mul(0.25), lambda.mul(0.5), d).oneMinus());
    const wave = cos(d.mul(6.2831853).div(lambda));
    return vec4(env.mul(wave).mul(LIQUID.wakeHeight),
      env.mul(ss(0.6, 0.95, wave)).mul(ss(lambda.mul(-0.5), lambda.mul(-0.25), d)),
      env.mul(ss(0.6, 0.95, wave.negate())).mul(ss(lambda.negate(), lambda.mul(-0.75), d)),
      s.mul(ss(0, LIQUID.wakeStirTime, age).oneMinus()).mul(ss(front.sub(0.05), front, r).oneMinus()));
  };
  const causticLayer = (q, s, sharp) => {
    const w = q.add(vec2(sin(q.y.mul(1.3).add(s)), sin(q.x.mul(1.1).sub(s.mul(0.8)))).mul(0.9));
    const g = sin(w.x).add(sin(w.y));
    return exp(g.mul(g).negate().mul(sharp));
  };
  const caustic = (p, slope, thick) => {
    const q0 = p.add(slope.mul(LIQUID.causticBend).mul(thick)).sub(vec2(...LIQUID.causticDrift).mul(own.phase));
    const q = floor(q0.div(LIQUID.causticCell)).add(0.5).mul(LIQUID.causticCell);
    const e = mix(float(LIQUID.causticSharp[0]), float(LIQUID.causticSharp[1]), clamp(thick.mul(0.5), 0, 1));
    const qa = vec2(q.x.mul(0.8).add(q.y.mul(0.6)), q.x.mul(-0.6).add(q.y.mul(0.8))).mul(LIQUID.causticScale[0]);
    const qb = vec2(q.x.mul(0.28).sub(q.y.mul(0.96)), q.x.mul(0.96).add(q.y.mul(0.28))).mul(LIQUID.causticScale[1]).add(vec2(13.7, 5.1));
    const a = causticLayer(qa, uTime.mul(LIQUID.causticSpeed[0]), e), b = causticLayer(qb, uTime.mul(LIQUID.causticSpeed[1]).add(2.3), e);
    return clamp(a.add(b).mul(0.35).add(a.mul(b)), 0, 1);
  };
  const linear = (d) => near.mul(far).div(far.sub(d.mul(far.sub(near))));

  const m = new N.NodeMaterial();
  m.fragmentNode = Fn((builder) => {
    // Register the shared ReflectorBaseNode once per render when High's mirror is enabled on this material.
    if (mirror && refl && !underside && builder && !builder.object?.isQuadMesh) refl.reflector.build(builder);

    const cell = LIQUID.cell;
    const c = floor(vRoom.xz.div(cell)).add(0.5).mul(cell);
    const h0 = height(c), hx = height(c.add(vec2(cell, 0))), hz = height(c.add(vec2(0, cell)));
    const slope = floor(vec2(hx.sub(h0), hz.sub(h0)).div(cell).div(LIQUID.slopeStep).add(0.5)).mul(LIQUID.slopeStep).toVar();
    const fw = fwidth(vRoom.xz);
    slope.mulAssign(clamp(float(cell).div(max(max(fw.x, fw.y), 1e-5)).sub(LIQUID.sharp[0]).div(LIQUID.sharp[1] - LIQUID.sharp[0]), 0, 1));
    // the swell: its slope on the ripple's own cells, stepped coarser (the face in broad bands), never flattened far off
    let sw0 = null, swd = null, sws = null;
    if (swell) {
      sw0 = swellAt(c); swd = swellD(c);
      sws = vec2(swellAt(c.add(vec2(cell, 0))).sub(sw0), swellAt(c.add(vec2(0, cell))).sub(sw0)).div(cell);
      slope.addAssign(floor(sws.div(SWELL.slopeStep).add(0.5)).mul(SWELL.slopeStep));
    }
    // the wake: its own slope on cells that widen far off, gentler right under the eye
    const wk = vec4(0).toVar(), wx = float(0).toVar(), wz = float(0).toVar();
    const rc = float(cell).mul(exp2(clamp(ceil(log2(sqrt(max(fw.x.mul(fw.y), 1e-10)).mul(LIQUID.wakePixels).div(cell))), 0, 2)));
    const rp = floor(vRoom.xz.div(rc)).add(0.5).mul(rc);
    const g = mix(float(LIQUID.wakeNear[2]), float(1), ss(LIQUID.wakeNear[0], LIQUID.wakeNear[1], distance(vec3(rp.x, vRoom.y, rp.y), own.eyeRoom)));
    If(own.ringN.greaterThan(int(0)), () => {
      Loop({ start: int(0), end: own.ringN, type: 'int', condition: '<' }, ({ i }) => {
        const w = own.rings.element(i);
        wk.addAssign(wakeRing(rp, w, h0, rc));
        wx.addAssign(wakeRing(rp.add(vec2(rc, 0)), w, h0, rc).x);
        wz.addAssign(wakeRing(rp.add(vec2(0, rc)), w, h0, rc).x);
      });
      slope.addAssign(floor(vec2(wx.sub(wk.x), wz.sub(wk.x)).mul(g).div(rc).div(LIQUID.wakeSlopeStep).add(0.5)).mul(LIQUID.wakeSlopeStep));
      if (!underside) {
        const scatterCell = fract(sin(dot(floor(vRoom.xz.div(rc)), vec2(127.1, 311.7))).mul(43758.5453));
        wk.y.mulAssign(g.mul(step(LIQUID.wakeCrestCells, scatterCell)));
        wk.z.mulAssign(g);
      }
    });
    const R = own.roomToView;
    const up = normalize(R.mul(vec3(0, 1, 0)));
    const n = normalize(R.mul(normalize(vec3(slope.x.negate(), 1, slope.y.negate()))));
    const bend = n.sub(up).xy;
    const uv = screenUV;
    const half = vec2(0.5).div(screenSize);
    const zw = positionView.z.negate();
    const light = vLit;

    // ---- underside (the eye in the water, looking up: LIQUID_UNDER_FRAG / UNDERSIDE) ----
    if (underside) {
      const rayUp = normalize(positionView);
      const cosUp = dot(rayUp, n);
      const d = length(positionView);
      const Tu = max(exp(absorb.negate().mul(d)), keep.rgb.mul(exp(keep.w.negate().mul(d))));
      const ownCol = deep.mul(light);
      const nudgedU = clamp(uv.add(vec2(bend.x, bend.y.negate()).mul(UNDERSIDE.bend)), half, vec2(1).sub(half));
      const rdLinU = linear(viewportDepthTexture(nudgedU).x);
      const ruvU = select(rdLinU.lessThan(zw), uv, nudgedU);
      const above = viewportSharedTexture(ruvU).rgb.mul(UNDERSIDE.through);
      const inside = above.mul(Tu).add(ownCol.mul(vec3(1).sub(Tu)))
        .add(scatter.mul(light).mul(exp(d.mul(-LIQUID.scatterDepth)).oneMinus()).mul(exp(d.mul(-LIQUID.scatterFade))));
      const outside = ownCol.mul(UNDERSIDE.own);
      const win = ss(UNDERSIDE.window - UNDERSIDE.windowSoft, UNDERSIDE.window + UNDERSIDE.windowSoft, cosUp);
      return vec4(mix(outside, inside, win), 1);
    }

    // ---- top surface (the eye above the water: LIQUID_FRAG) ----
    const v = normalize(positionView.negate());
    const ray = length(positionView).div(max(zw, 1e-4));
    const behind = max(linear(viewportDepthTexture(uv).x).sub(zw), 0).mul(ray);
    // (screenUV counts down the picture, view space up: the tilt's y the other way)
    const nudged = clamp(uv.add(vec2(bend.x, bend.y.negate()).mul(LIQUID.refract).mul(min(behind, LIQUID.refractMost))), half, vec2(1).sub(half));
    const rdLin = linear(viewportDepthTexture(nudged).x);
    // (the ripple never fetches what is above the water: where the nudged pixel is in front of the surface, it is not nudged)
    const ok = rdLin.greaterThanEqual(zw);
    const ruv = select(ok, nudged, uv), thick = select(ok, max(rdLin.sub(zw), 0).mul(ray), behind);
    const under = viewportSharedTexture(ruv).rgb.toVar();
    const litR = luma(under).div(max(luma(light), 0.05));
    const dir = normalize(vRoom.sub(own.eyeRoom));
    const k = caustic(vRoom.xz.add(dir.xz.mul(thick)), slope, thick).mul(exp(thick.mul(keep.w).mul(-LIQUID.causticFade / LIQUID.keep)));
    const bare = vec3(under);
    under.mulAssign(k.mul(shared.uCaustic).add(1));
    under.mulAssign(min(1, max(luma(bare), luma(light)).div(max(luma(under), 1e-5))));
    under.mulAssign(min(wk.w, 1.5).mul(k.add(0.35)).mul(LIQUID.wakeStir).add(1));     // (inside a fresh ring: the light stirred)
    const T0 = max(exp(absorb.negate().mul(thick)), keep.rgb.mul(exp(keep.w.negate().mul(thick))));
    const Tm = mix(T0, vec3(1).sub(vec3(1).sub(T0).mul(1 - LIQUID.glowKeep)), ss(0.9, 1.6, litR));
    const colour = under.mul(Tm).add(deep.mul(light).mul(vec3(1).sub(Tm)))
      .add(scatter.mul(light).mul(exp(thick.mul(-LIQUID.scatterDepth)).oneMinus()).mul(exp(thick.mul(-LIQUID.scatterFade)))).toVar();
    const F = pow(max(dot(n, v), 0).oneMinus(), 5).mul(1 - LIQUID.f0).add(LIQUID.f0);
    const flatTint = light.mul(LIQUID.sky);
    if (mirror && refl) {
      let mOn = own.mirrorOn;
      if (swell) mOn = mOn.mul(ss(SWELL.mirrorFrom, SWELL.mirrorGone, sw0).oneMinus());
      // Sample shared reflector texture directly (avoids r180 ReflectorNode.clone() bug while keeping isRenderTargetTexture).
      const q = clamp(screenUV.flipX().add(vec2(bend.x.negate(), bend.y.negate()).mul(MIRROR.wobble)), vec2(0.002), vec2(0.998));
      const r0 = texture(refl.value, q).onRenderUpdate(() => refl.value).rgb;
      const rl = luma(r0), cap = max(luma(light).mul(MIRROR.cap), MIRROR.capLeast);
      const r = r0.mul(min(1, cap.div(max(rl, 1e-5)))).mul(MIRROR.dim).mul(mix(vec3(1), keep.rgb, MIRROR.tint));
      colour.assign(mix(colour, mix(flatTint, r, mOn), F));
    } else {
      colour.assign(mix(colour, flatTint, F));
    }
    const edge = ss(LIQUID.edge * 0.5, LIQUID.edge, behind).oneMinus();
    const seen = clamp(dot(light, vec3(0.333)).mul(0.7).add(dot(under, vec3(0.4)).mul(0.5)), 0, 1.5);
    colour.assign(mix(colour, vec3(...LIQUID.edgeColor).mul(seen), edge.mul(LIQUID.edgeMix)));
    colour.mulAssign(clamp(wk.y.mul(LIQUID.wakeCrest), 0, 0.9).sub(clamp(wk.z.mul(LIQUID.wakeTrough), 0, 0.35)).mul(edge.oneMinus()).add(1));
    if (swell) {
      // the swell's light: the steep face catches the ceiling in bands, the trough behind it darkens; then the foam
      const sh = sw0.div(max(SW.s.y, 1e-3)), steep = clamp(length(sws).div(1.2), 0, 1);
      colour.addAssign(light.mul(SWELL.glint).mul(ss(0.88, 0.99, dot(reflect(v.negate(), n), up))).mul(ss(0.15, 0.6, steep)).mul(edge.oneMinus()));
      colour.mulAssign(clamp(sh.negate().div(SWELL.trough), 0, 1).mul(-SWELL.troughDark).add(1));
      const fcs = float(SWELL.foamCell).mul(exp2(clamp(ceil(log2(float(SWELL.foamCell).div(max(max(fw.x, fw.y), 1e-5).mul(SWELL.foamPx)))), 0, 3).negate()));
      const fc = floor(vRoom.xz.div(fcs));
      const hz2 = fract(sin(dot(fc, vec2(127.1, 311.7))).mul(43758.5453)), ph = fract(sin(dot(fc, vec2(269.5, 183.3))).mul(43758.5453));
      const tall = clamp(SW.s.y.div(SWELL.tallAt), 0, 1);
      const tr = swd.add(0.7).div(0.45);
      const want = ss(0.8, 0.97, sh).mul(ss(0, 0.3, swd.negate()).oneMinus()).mul(SWELL.foamCrest).mul(tall.mul(-SWELL.foamTall).add(1))
        .add(SW.s.w.mul(ss(0.25, 0.75, sh).mul(step(0, swd)).mul(SWELL.foamFace).add(exp(tr.mul(tr).negate()).mul(SWELL.foamTrail))));
      const foam = step(clamp(want, 0, 0.9).oneMinus(), hz2).mul(ss(-0.3, 0.7, sin(uTime.mul(SWELL.churn).add(ph.mul(6.2831853)))));
      colour.assign(mix(colour, vec3(...LIQUID.edgeColor).mul(SWELL.foamTone).mul(seen), foam.mul(SWELL.foamMix).mul(edge.oneMinus())));
    }
    return vec4(colour, 1);
  })();
  // (drawn after everything opaque, so that three.js's copy of the picture has all of it; opaque itself, writing its depth)
  Object.assign(m, { transparent: true, blending: N.NoBlending, depthWrite: true, depthTest: true, side: N.DoubleSide });
  if (swell) m.positionNode = raised;
  m.name = underside ? `liquid:${rec.kind}:underside` : `liquid:${rec.kind}`;
  return m;
}

/** The same interface as liquid.js createLiquidView, for vhs-node.js. */
export function createLiquidViewNode() {
  const N = gpu.nodes, T = N.TSL;
  const shared = { uTime: T.uniform(0), uCaustic: T.uniform(LIQUID.caustic), near: T.cameraNear, far: T.cameraFar };
  const list = [], frustum = new N.Frustum(), pv = new N.Matrix4(), inv = new N.Matrix4(), eye = new N.Vector3(), at = new N.Vector3(), box = new N.Box3(), mv = new N.Matrix4();
  const stats = { marks: 0, up: 0, inView: 0, under: 0, below: 0, split: false, draws: 0, rings: 0, nodes: true,
    mirror: { on: false, chosen: false, cover: 0, weight: 0, surfaces: 0, drawn: 0, left: { noReflect: 0, liquid: 0, held: 0, detail: 0, sheet: 0 } } };
  let level = 1, clock = 0, body = null, hold = { last: -Infinity, split: false };
  const swapped = [], stood = [];
  const toPart = new N.Matrix4(), pt = new N.Vector3();
  const inRoom = (rec, x, y, z) => pt.set(x, y, z).applyMatrix4(toPart.copy(rec.rt.group.matrix).invert());
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

  // --- High planar mirror (water 2, shared ReflectorNode) ---
  let refl = null, mirrorRec = null, chosen = null, gateOn = false, weight = 0, reflecting = false;
  const cands = [], corner = new N.Vector3(), pPoint = new N.Vector3(), pNormal = new N.Vector3(), Z_AXIS = new N.Vector3(0, 0, 1);
  const FLIP = new N.Matrix4().makeScale(-1, 1, 1), mRefl = new N.Matrix4(), mT = new N.Matrix4(), mTi = new N.Matrix4();
  const worldPlane = (rec) => {
    const g = rec.rt.group.matrixWorld;
    pPoint.set(0, rec.plane.y, 0).applyMatrix4(g); pNormal.set(0, 1, 0).transformDirection(g);
    return mirrorPlane(pNormal.toArray(), pPoint.toArray());
  };
  const coverOf = (rec) => {
    const { rim } = rec.edge ||= sheetRim(rec);
    if (!rim) return 0;
    const g = rec.rt.group.matrixWorld, y = rec.plane.y;
    return screenCover([[rim.x0, rim.z0], [rim.x1, rim.z0], [rim.x1, rim.z1], [rim.x0, rim.z1]].map(([x, z]) => corner.set(x, y, z).applyMatrix4(g).toArray()), pv.elements);
  };
  function ensureReflector() {
    if (refl) return refl;
    refl = T.reflector({ resolutionScale: MIRROR.scale, bounces: false });
    const base = refl.reflector, origUpdate = base.updateBefore.bind(base);
    base.updateBefore = (frame) => {
      if (!mirrorRec || level < 2 || reflecting) return false;
      const { scene, camera } = frame;
      const ms = stats.mirror;
      for (const k of Object.keys(ms.left)) ms.left[k] = 0;
      const plane = worldPlane(mirrorRec);
      // Match ReflectorBaseNode's virtualCamera transform (R · C · F) so flashlight & beam shadows stay in place in the mirror.
      camera.updateMatrixWorld();
      mRefl.fromArray(reflectMatrix(plane)).multiply(camera.matrixWorld).multiply(FLIP);
      mT.copy(mRefl).invert().multiply(camera.matrixWorld);
      mTi.copy(mT).invert();
      const sheets = new Set();
      for (const r of list) for (const m of r.meshes || []) sheets.add(m);
      const hidden = [], origins = new Map(), aims = new Map(), lamps = new Map(), shadows = new Map();
      const bg = scene.background;
      reflecting = true;
      try {
        scene.traverseVisible((o) => {
          const why = sheets.has(o) ? 'sheet' : mirrorLeaves(o, HELD_ORDER);
          if (why) { ms.left[why]++; hidden.push(o); o.visible = false; return; }
          if (!o.material) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            const u = m?.uniforms;
            if (!u) continue;
            if (u.uTorchOrigin?.value?.isVector3 && !origins.has(u.uTorchOrigin.value)) origins.set(u.uTorchOrigin.value, u.uTorchOrigin.value.clone());
            if (u.uTorchDirection?.value?.isVector3 && !aims.has(u.uTorchDirection.value)) aims.set(u.uTorchDirection.value, u.uTorchDirection.value.clone());
            if (u.uCameraLamp && !lamps.has(u.uCameraLamp)) lamps.set(u.uCameraLamp, u.uCameraLamp.value);
            if (u.uBeamShadowMatrix?.value?.isMatrix4 && !shadows.has(u.uBeamShadowMatrix.value)) shadows.set(u.uBeamShadowMatrix.value, u.uBeamShadowMatrix.value.clone());
          }
        });
        for (const [v, orig] of origins) v.copy(orig).applyMatrix4(mT);
        for (const [v, orig] of aims) v.copy(orig).transformDirection(mT);
        for (const u of lamps.keys()) u.value = 0;
        for (const [m, orig] of shadows) m.copy(orig).multiply(mTi);
        scene.background = null;
        const res = origUpdate(frame);
        if (base.hasOutput) ms.drawn++;
        return res;
      } finally {
        for (const o of hidden) o.visible = true;
        for (const [v, orig] of origins) v.copy(orig);
        for (const [v, orig] of aims) v.copy(orig);
        for (const [u, orig] of lamps) u.value = orig;
        for (const [m, orig] of shadows) m.copy(orig);
        scene.background = bg;
        reflecting = false;
      }
    };
    return refl;
  }
  function disposeMirror() {
    refl?.dispose?.(); refl = null;
    mirrorRec = chosen = null; gateOn = false; weight = 0;
    Object.assign(stats.mirror, { on: false, chosen: false, cover: 0, weight: 0, surfaces: 0 });
    for (const rec of list) if (rec.pairs) for (const p of rec.pairs) {
      p.mirrorMaterial?.dispose(); p.mirrorMaterial = null;
      p.swellMirrorMaterial?.dispose(); p.swellMirrorMaterial = null;
      p.own.mirrorOn.value = 0;
    }
  }
  // --- end High planar mirror ---

  function upgrade(rec) {
    const wbox = new N.Box3(), part = new N.Box3(), m4 = new N.Matrix4();
    rec.meshes.forEach((old, i) => {
      if (!old.geometry?.attributes?.position) return;
      if (!old.geometry.boundingBox) old.geometry.computeBoundingBox();
      wbox.union(part.copy(old.geometry.boundingBox).applyMatrix4(m4.fromArray(rec.toRoom[i])));
    });
    rec.wake = { pool: [], box: wbox, u: { uRings: { value: Array.from({ length: LIQUID.rings }, () => new N.Vector4()) }, uRingN: { value: 0 } } };
    rec.disturb = (x, z, strength = 1) => {
      if (!rec.wake || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      const p = inRoom(rec, x, rec.plane.y, z);
      return wakeStart(rec.wake.pool, p.x, p.z, strength, clock);
    };
    rec.pairs = [];
    rec.swellU = { uSwell: { value: new N.Vector4() }, uSwellBox: { value: new N.Vector4() } };
    rec.swellOn = false; rec.swellLast = null; rec.swellState = {};
    rec.meshes.forEach((old, i) => {
      if (!old.parent || !old.geometry?.attributes?.aLit || !old.material?.isKitSurface) return;
      const own = makeOwnUniforms(rec);
      const material = waterNode(old, rec, rec.toRoom[i], shared, own);
      rec.kit?.own?.(material);
      const water = new N.Mesh(old.geometry, material);
      water.name = 'liquid:surface';
      water.position.copy(old.position); water.quaternion.copy(old.quaternion); water.scale.copy(old.scale);
      water.matrixAutoUpdate = old.matrixAutoUpdate; water.matrix.copy(old.matrix); water.matrixWorld.copy(old.matrixWorld);
      // Draw first in the transparent pass (after all opaques, before every translucent mesh such as room glass or
      // deep-end's diving bell dome at order 2–3) so NoBlending + depthWrite never overwrites translucent objects.
      water.renderOrder = -1; water.frustumCulled = old.frustumCulled;
      water.visible = false; water.userData.noBeamShadow = true; water.userData.liquid = rec;
      old.parent.add(water);
      rec.pairs.push({ old, water, material, own, rec, index: i, under: null, swellMaterial: null, swellUnder: null, mirrorMaterial: null, swellMirrorMaterial: null });
    });
    if (rec.pairs.length) rec.state = 'up'; else { rec.state = 'refused'; rec.reason = 'not a kit sheet'; rec.pairs = null; rec.wake = null; rec.disturb = null; }
  }

  /** Lazily build and return the right variant material for pair `p` this frame. */
  function materialFor(p, rec, { below, swell, mirror }) {
    const toRoom = rec.toRoom[p.index];
    if (below) {
      if (swell) return p.swellUnder ||= rec.kit?.own?.(waterNode(p.old, rec, toRoom, shared, p.own, { swell: true, underside: true })) || waterNode(p.old, rec, toRoom, shared, p.own, { swell: true, underside: true });
      return p.under ||= rec.kit?.own?.(waterNode(p.old, rec, toRoom, shared, p.own, { underside: true })) || waterNode(p.old, rec, toRoom, shared, p.own, { underside: true });
    }
    if (mirror) {
      const r = ensureReflector();
      if (swell) return p.swellMirrorMaterial ||= rec.kit?.own?.(waterNode(p.old, rec, toRoom, shared, p.own, { swell: true, mirror: true, refl: r })) || waterNode(p.old, rec, toRoom, shared, p.own, { swell: true, mirror: true, refl: r });
      return p.mirrorMaterial ||= rec.kit?.own?.(waterNode(p.old, rec, toRoom, shared, p.own, { mirror: true, refl: r })) || waterNode(p.old, rec, toRoom, shared, p.own, { mirror: true, refl: r });
    }
    if (swell) return p.swellMaterial ||= rec.kit?.own?.(waterNode(p.old, rec, toRoom, shared, p.own, { swell: true })) || waterNode(p.old, rec, toRoom, shared, p.own, { swell: true });
    return p.material;
  }

  // the swell, once a frame for a surface that is up (liquid.js swellFrame): the dense copy on while a room asks for
  // one, the sheet's own geometry while none does; its uniforms; the rings where it breaks
  const ROOM_UP = (e) => Math.abs(e[4]) < 1e-6 && Math.abs(e[5] - 1) < 1e-6 && Math.abs(e[6]) < 1e-6 && Math.abs(e[1]) < 1e-6 && Math.abs(e[9]) < 1e-6 && Math.abs(e[10] - 1) < 1e-6;
  function swellFrame(rec, now) {
    rec.swellStale = rec.swellFresh ? 0 : (rec.swellStale || 0) + 1; rec.swellFresh = false;
    const ask = rec.swellStale > 10 ? null : rec.swell;
    let on = !!ask && !rec.swellRefused;
    if (on) for (const p of rec.pairs) {
      if (p.dense === undefined) {
        if (!ROOM_UP(rec.toRoom[p.index] || [])) { p.dense = null; rec.swellRefused = 'turned in its room'; }
        else { const g = swellGeometry(p.old.geometry); p.dense = g.geometry; if (!g.geometry) rec.swellRefused = g.why; }
      }
      if (!p.dense) on = false;
    }
    for (const p of rec.pairs) {
      const g = on ? p.dense : p.old.geometry;
      if (p.water.geometry !== g) p.water.geometry = g;
    }
    rec.swellOn = on;
    if (!on) { rec.swellLast = null; return; }
    rec.edge ||= sheetRim(rec);
    const r = rec.edge.rim;
    rec.swellU.uSwell.value.set(ask.at, ask.height, rec.plane.y, ask.breaking);
    rec.swellU.uSwellBox.value.set(r.x0, r.z0, r.x1, r.z1);
    for (const ring of swellRings(rec.swellLast, ask.at, ask.breaking, rec.swellBreaks, rec.swellBeach, now, rec.swellState)) wakeStart(rec.wake.pool, ring.x, ring.z, ring.strength, now);
    rec.swellLast = ask.at;
  }

  const view = {
    force: null, stats,
    setLevel(n) {
      level = Number(n) || 0;
      if (level < 2) disposeMirror();
    },
    get level() { return level; },
    get mirror() { return mirrorRec && refl ? { rec: mirrorRec, reflector: refl } : null; },
    get split() { return hold.split; },
    get marks() { return list.slice(); },
    /** Once a frame before the scene is drawn: water (top or underside) where a surface is shown. → false (one pass). */
    frame(scene, camera, now) {
      view.after();
      list.length = 0; collectLiquids(scene, list);
      shared.uTime.value = now; clock = now;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      eye.setFromMatrixPosition(camera.matrixWorld);
      let seen = false;
      Object.assign(stats, { marks: list.length, up: 0, inView: 0, under: 0, below: 0, rings: 0 });
      cands.length = 0;
      const mirrors = level >= 2;
      const rooms = new Set();
      for (const rec of list) {
        if (rec.state === 'marked') upgrade(rec);
        rec.live = false; rec.under = false; rec.below = false;
        if (rec.state !== 'up') continue;
        stats.up++;
        swellFrame(rec, now);
        const w = rec.wake;
        w.u.uRingN.value = wakeFill(wakeStep(w.pool, now), now, w.u.uRings.value);
        stats.rings += w.u.uRingN.value;
        if (!rec.pairs.some((p) => shown(p.old))) continue;
        rec.live = true;
        at.copy(eye).applyMatrix4(inv.copy(rec.rt.group.matrixWorld).invert());
        if ((rec.under = underwater(at.y, rec.plane.y))) {
          stats.under++;
          rec.edge ||= sheetRim(rec);
          if (!(rec.below = seesUnderside(at, rec.plane.y, rec.edge.rim, rec.edge.facesUp))) continue;
          stats.below++;
        }
        mv.multiplyMatrices(camera.matrixWorldInverse, rec.rt.group.matrixWorld);
        let recInView = false;
        for (const p of rec.pairs) {
          if (!shown(p.old)) continue;
          p.own.roomToView.value.setFromMatrix4(mv);
          p.own.eyeRoom.value.copy(at);
          p.own.mirrorOn.value = 0;
          p.water.visible = true; p.old.visible = false; swapped.push(p);
          box.copy(p.old.geometry.boundingBox).applyMatrix4(p.old.matrixWorld);
          box.min.y -= LIQUID.margin; box.max.y += LIQUID.margin + (rec.swellOn ? rec.swell.height : 0);
          if (frustum.intersectsBox(box)) { seen = true; recInView = true; stats.inView++; }
        }
        if (recInView && mirrors && !rec.under && at.y > rec.plane.y + MIRROR.above && (rec.edge ||= sheetRim(rec)).facesUp) {
          cands.push({ rec, dist: box.distanceToPoint(eye) });
        }
        rooms.add(rec.rt.group);
      }
      hold = holdStep(hold, now, seen, view.force);
      stats.split = false;

      // High planar mirror selection (pickMirror + cover hysteresis) and per-plane assignment
      const pick = mirrors && seen ? pickMirror(cands, chosen) : null;
      if (pick !== chosen) gateOn = false;
      chosen = pick;
      const cover = pick ? coverOf(pick) : 0;
      gateOn = !!pick && mirrorGate(gateOn, cover);
      weight = gateOn ? mirrorWeight(cover) : 0;
      mirrorRec = gateOn && weight > 0 ? pick : null;
      let mirSurfaces = 0;
      if (mirrorRec && mirrors) {
        const r = ensureReflector();
        const y = worldPlane(mirrorRec);
        r.target.position.copy(pPoint);
        r.target.quaternion.setFromUnitVectors(Z_AXIS, pNormal);
        r.target.updateMatrixWorld(true);
        for (const rec of list) {
          if (!rec.live || rec.under || !rec.pairs) continue;
          const o = worldPlane(rec);
          if (Math.abs(o[3] - y[3]) > MIRROR.samePlane || o[1] < 0.999) continue;
          for (const p of rec.pairs) p.own.mirrorOn.value = weight;
          mirSurfaces++;
        }
      }
      Object.assign(stats.mirror, { on: !!mirrorRec, chosen: !!pick, cover, weight, surfaces: mirSurfaces });

      // Bind the active variant material (flat / swell / mirror / underside) for every visible water pair
      for (const p of swapped) {
        const rec = p.rec;
        const mat = materialFor(p, rec, { below: rec.below, swell: rec.swellOn, mirror: mirrors && !rec.below && p.own.mirrorOn.value > 0 });
        if (p.water.material !== mat) p.water.material = mat;
      }

      // (what a room draws itself in place of what the water now does: hidden while the water is drawn)
      for (const g of rooms) g.traverse((o) => { if (o.userData?.liquidStandIn && o.visible) { o.visible = false; stood.push(o); } });
      if (seen) stats.draws++;
      return false;
    },
    /** After the scene is drawn: every sheet and stand-in as the room left it. */
    after() {
      for (const p of swapped) { p.water.visible = false; p.old.visible = true; p.own.mirrorOn.value = 0; }
      for (const o of stood) o.visible = true;
      swapped.length = 0; stood.length = 0;
    },
    /** liquid.js feel: the visitor's wake. */
    feel(part, x, z, foot, eyeY, speed) {
      if (![x, z, foot, eyeY].every(Number.isFinite)) return 0;
      let hit = null, hitAt = null;
      for (const rec of list) {
        if (rec.state !== 'up' || !rec.wake || (part && rec.rt.group.parent !== part)) continue;
        const p = inRoom(rec, x, foot, z), b = rec.wake.box, y = rec.plane.y;
        if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) continue;
        if (!(p.y < y - LIQUID.under) || p.y + (eyeY - foot) < y - LIQUID.wadeDeep) continue;
        hit = rec; hitAt = { x: p.x, z: p.z }; break;
      }
      const s = wadeStep(body, { wet: !!hit, speed, now: clock });
      body = s.state;
      if (hit && s.ring > 0 && wakeStart(hit.wake.pool, hitAt.x, hitAt.z, s.ring, clock)) return s.ring;
      return 0;
    },
    release(scene) {
      view.after();
      disposeMirror();
      for (const rec of collectLiquids(scene)) {
        if (rec.state !== 'up') continue;
        for (const p of rec.pairs) {
          p.water.parent?.remove(p.water);
          p.material.dispose(); p.under?.dispose(); p.swellMaterial?.dispose(); p.swellUnder?.dispose();
          p.mirrorMaterial?.dispose(); p.swellMirrorMaterial?.dispose(); p.dense?.dispose();
        }
        rec.pairs = null; rec.state = 'marked'; rec.live = false; rec.wake = null; rec.disturb = null;
        rec.swellU = null; rec.swellOn = false; rec.swellLast = null; rec.swellRefused = undefined;
      }
      body = null;
    },
    dispose() { view.after(); disposeMirror(); },
  };
  return view;
}
