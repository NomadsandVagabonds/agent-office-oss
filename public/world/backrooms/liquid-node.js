// The Backrooms — water (graphics.js `water`, Medium and High), for the WebGPU renderer (?gpu=webgpu). Redone on
// three.js's nodes, not translated: the owner's word, "we can both make big gains and make it more efficient".
//
// liquid.js draws the scene in two parts (everything opaque, a copy of its colour and depth, then the water and what is
// see-through over it, by moving them to a layer of their own). Here there is one pass. The water is drawn after what
// is opaque, in the same pass, and reads what is behind it from three.js's own copies of the picture so far
// (viewportSharedTexture, viewportDepthTexture). No copy pass of ours, no layers moved, no material swapped in and out
// for the draw.
//
// What it shows is liquid.js's, from liquid.rule.js's numbers: the ripple on 5 cm cells of the room's frame, its slope
// stepped, lying flat far off; the wake's rings (the same pool and fill, liquid.rule.js); what is under it bent by the
// ripple, as far as the water is deep; its colour taken off with depth (the sheet's own tint, waterColours), the water's
// own colour scattered in, the caustics on the bed where the eye's ray reaches it, the stirred light in a fresh ring;
// the Fresnel share of the room's light as a flat tint; the line where it meets what walls it in; the crest and trough
// of a ring. The visitor's wake (feel) and a room's disturb() are liquid.js's.
//
// The wave pool's swell is here too (liquid.rule.js SWELL: the dense copy of the sheet, raised; its slope in bands, the
// light down its face, the dark trough, the foam; the rings where it breaks), on a material of its own that a sheet
// takes only while a room asks for a swell. Not here yet: the underside seen from in the water (the room's own sheet
// is drawn then, as liquid.js does outside a rim), and High's mirror (High draws the flat tint, as Medium does).
import { gpu } from '../engine/gpu.js';
import { LIQUID, SWELL, underwater, holdStep, wakeStart, wakeStep, wakeFill, waterColours, wadeStep, swellRings } from './liquid.rule.js';
import { collectLiquids } from './liquid.mark.js';
import { sheetTint, sheetRim, swellGeometry } from './liquid.js';

/**
 * The water's node material for one sheet `old` (a kit surface) of `rec`, toRoom its matrix into the room's frame;
 * `swell`: the wave pool's version (raised, banded, foam), for while its room asks for a swell.
 */
function waterNode(old, rec, toRoom, shared, swell = false) {
  const N = gpu.nodes, T = N.TSL;
  const { Fn, vec2, vec3, vec4, float, int, uniform, uniformArray, attribute, varying, positionGeometry, positionView, screenUV, screenSize,
    viewportSharedTexture, viewportDepthTexture, floor, fract, sin, cos, exp, exp2, log2, ceil, sqrt, inverseSqrt, pow, abs, dot, length, distance,
    normalize, mix, clamp, max, min, step, select, fwidth, reflect, Loop, If } = T;
  const u = old.material.uniforms || {};
  const read = (k) => old.material.uniforms?.[k]?.value;
  const num = (k, d) => uniform(d).onRenderUpdate(() => { const v = read(k); return typeof v === 'number' ? v : d; });
  const vec2u = (k, d) => { const n = uniform(new N.Vector2(...d)); return n.onRenderUpdate(() => { const v = read(k); if (Array.isArray(v)) n.value.fromArray(v); else if (v?.isVector2) n.value.copy(v); }); };
  const vec3u = (k) => { const n = uniform(new N.Vector3(1, 1, 1)); return n.onRenderUpdate(() => { const v = read(k); if (v?.isVector3) n.value.copy(v); else if (Array.isArray(v)) n.value.fromArray(v); }); };
  const D = old.material.defines || {};
  const { tint, alpha } = sheetTint(old), col = waterColours(tint, alpha);
  const own = {
    roomToView: uniform(new N.Matrix3()), eyeRoom: uniform(new N.Vector3()),
    rings: uniformArray(rec.wake.u.uRings.value, 'vec4'), ringN: uniform(0, 'int').onRenderUpdate(() => rec.wake.u.uRingN.value | 0),
    phase: uniform(0).onRenderUpdate(() => (Number.isFinite(rec.phase?.value) ? rec.phase.value : 0)),
  };
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
    const room = max(own.eyeRoom.y.sub(SW.s.z).sub(SWELL.eyeClear), 0), near = ss(SWELL.eyeNear, SWELL.eyeFar, distance(p, own.eyeRoom.xz));
    return select(own.eyeRoom.y.greaterThan(SW.s.z), mix(min(h, room), h, near), h);
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
  m.fragmentNode = Fn(() => {
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
      const scatterCell = fract(sin(dot(floor(vRoom.xz.div(rc)), vec2(127.1, 311.7))).mul(43758.5453));
      wk.y.mulAssign(g.mul(step(LIQUID.wakeCrestCells, scatterCell)));
      wk.z.mulAssign(g);
    });
    const R = own.roomToView;
    const up = normalize(R.mul(vec3(0, 1, 0)));
    const n = normalize(R.mul(normalize(vec3(slope.x.negate(), 1, slope.y.negate()))));
    const v = normalize(positionView.negate());
    const bend = n.sub(up).xy;
    // how much water the eye looks through to what is under it, from three.js's copy of the depth drawn so far
    const zw = positionView.z.negate(), ray = length(positionView).div(max(zw, 1e-4));
    const uv = screenUV;
    const behind = max(linear(viewportDepthTexture(uv).x).sub(zw), 0).mul(ray);
    const half = vec2(0.5).div(screenSize);
    // (screenUV counts down the picture, view space up: the tilt's y the other way)
    const nudged = clamp(uv.add(vec2(bend.x, bend.y.negate()).mul(LIQUID.refract).mul(min(behind, LIQUID.refractMost))), half, vec2(1).sub(half));
    const rdLin = linear(viewportDepthTexture(nudged).x);
    // (the ripple never fetches what is above the water: where the nudged pixel is in front of the surface, it is not nudged)
    const ok = rdLin.greaterThanEqual(zw);
    const ruv = select(ok, nudged, uv), thick = select(ok, max(rdLin.sub(zw), 0).mul(ray), behind);
    const under = viewportSharedTexture(ruv).rgb.toVar();
    const light = vLit;
    const lit = luma(under).div(max(luma(light), 0.05));
    const dir = normalize(vRoom.sub(own.eyeRoom));
    const k = caustic(vRoom.xz.add(dir.xz.mul(thick)), slope, thick).mul(exp(thick.mul(keep.w).mul(-LIQUID.causticFade / LIQUID.keep)));
    const bare = vec3(under);
    under.mulAssign(k.mul(shared.uCaustic).add(1));
    under.mulAssign(min(1, max(luma(bare), luma(light)).div(max(luma(under), 1e-5))));
    under.mulAssign(min(wk.w, 1.5).mul(k.add(0.35)).mul(LIQUID.wakeStir).add(1));     // (inside a fresh ring: the light stirred)
    const T0 = max(exp(absorb.negate().mul(thick)), keep.rgb.mul(exp(keep.w.negate().mul(thick))));
    const Tm = mix(T0, vec3(1).sub(vec3(1).sub(T0).mul(1 - LIQUID.glowKeep)), ss(0.9, 1.6, lit));
    const colour = under.mul(Tm).add(deep.mul(light).mul(vec3(1).sub(Tm)))
      .add(scatter.mul(light).mul(exp(thick.mul(-LIQUID.scatterDepth)).oneMinus()).mul(exp(thick.mul(-LIQUID.scatterFade)))).toVar();
    const F = pow(max(dot(n, v), 0).oneMinus(), 5).mul(1 - LIQUID.f0).add(LIQUID.f0);
    colour.assign(mix(colour, light.mul(LIQUID.sky), F));                                 // (the flat tint: Medium; the mirror is High's, not here yet)
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
  m.name = `liquid:${rec.kind}`;
  return { material: m, own };
}

/** The same interface as liquid.js createLiquidView, for vhs-node.js. */
export function createLiquidViewNode() {
  const N = gpu.nodes, T = N.TSL;
  const shared = { uTime: T.uniform(0), uCaustic: T.uniform(LIQUID.caustic), near: T.cameraNear, far: T.cameraFar };
  const list = [], frustum = new N.Frustum(), pv = new N.Matrix4(), inv = new N.Matrix4(), eye = new N.Vector3(), at = new N.Vector3(), box = new N.Box3(), mv = new N.Matrix4();
  const stats = { marks: 0, up: 0, inView: 0, under: 0, below: 0, split: false, draws: 0, rings: 0, nodes: true, mirror: { on: false } };
  let level = 1, clock = 0, body = null, hold = { last: -Infinity, split: false };
  const swapped = [], stood = [];
  const toPart = new N.Matrix4(), pt = new N.Vector3();
  const inRoom = (rec, x, y, z) => pt.set(x, y, z).applyMatrix4(toPart.copy(rec.rt.group.matrix).invert());
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

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
      const { material, own } = waterNode(old, rec, rec.toRoom[i], shared);
      rec.kit?.own?.(material);
      const water = new N.Mesh(old.geometry, material);
      water.name = 'liquid:surface';
      water.position.copy(old.position); water.quaternion.copy(old.quaternion); water.scale.copy(old.scale);
      water.matrixAutoUpdate = old.matrixAutoUpdate; water.matrix.copy(old.matrix); water.matrixWorld.copy(old.matrixWorld);
      water.renderOrder = old.renderOrder; water.frustumCulled = old.frustumCulled;
      water.visible = false; water.userData.noBeamShadow = true; water.userData.liquid = rec;
      old.parent.add(water);
      rec.pairs.push({ old, water, material, own, rec, index: i });
    });
    if (rec.pairs.length) rec.state = 'up'; else { rec.state = 'refused'; rec.reason = 'not a kit sheet'; rec.pairs = null; rec.wake = null; rec.disturb = null; }
  }

  // the swell, once a frame for a surface that is up (liquid.js swellFrame): the dense copy and the swell's material on
  // while a room asks for one, the sheet's own geometry and the flat material while none does; its uniforms; the rings
  // where it breaks
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
      if (on && !p.swellMaterial) { p.swellMaterial = waterNode(p.old, rec, rec.toRoom[p.index], shared, true); rec.kit?.own?.(p.swellMaterial.material); }
      const g = on ? p.dense : p.old.geometry, mat = on ? p.swellMaterial.material : p.material;
      if (p.water.geometry !== g) p.water.geometry = g;
      if (p.water.material !== mat) p.water.material = mat;
      p.live = on ? p.swellMaterial.own : p.own;
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
    setLevel(n) { level = Number(n) || 0; },
    get level() { return level; },
    get mirror() { return null; },
    get split() { return hold.split; },
    get marks() { return list.slice(); },
    /** Once a frame before the scene is drawn: water where a surface that is up is shown and the eye is over it. → false (one pass). */
    frame(scene, camera, now) {
      view.after();
      list.length = 0; collectLiquids(scene, list);
      shared.uTime.value = now; clock = now;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      eye.setFromMatrixPosition(camera.matrixWorld);
      let seen = false;
      Object.assign(stats, { marks: list.length, up: 0, inView: 0, under: 0, below: 0, rings: 0 });
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
        // (in the water: the room's own sheet, as liquid.js draws it outside a rim; the underside is not here yet)
        if ((rec.under = underwater(at.y, rec.plane.y))) { stats.under++; continue; }
        mv.multiplyMatrices(camera.matrixWorldInverse, rec.rt.group.matrixWorld);
        for (const p of rec.pairs) {
          if (!shown(p.old)) continue;
          const u = p.live || p.own;
          u.roomToView.value.setFromMatrix4(mv);
          u.eyeRoom.value.copy(at);
          p.water.visible = true; p.old.visible = false; swapped.push(p);
          box.copy(p.old.geometry.boundingBox).applyMatrix4(p.old.matrixWorld);
          box.min.y -= LIQUID.margin; box.max.y += LIQUID.margin + (rec.swellOn ? rec.swell.height : 0);
          if (frustum.intersectsBox(box)) { seen = true; stats.inView++; }
        }
        rooms.add(rec.rt.group);
      }
      // (what a room draws itself in place of what the water now does: hidden while the water is drawn)
      for (const g of rooms) g.traverse((o) => { if (o.userData?.liquidStandIn && o.visible) { o.visible = false; stood.push(o); } });
      hold = holdStep(hold, now, seen, view.force);
      stats.split = false;
      if (seen) stats.draws++;
      return false;
    },
    /** After the scene is drawn: every sheet and stand-in as the room left it. */
    after() {
      for (const p of swapped) { p.water.visible = false; p.old.visible = true; }
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
      for (const rec of collectLiquids(scene)) {
        if (rec.state !== 'up') continue;
        for (const p of rec.pairs) { p.water.parent?.remove(p.water); p.material.dispose(); p.swellMaterial?.material.dispose(); p.dense?.dispose(); }
        rec.pairs = null; rec.state = 'marked'; rec.live = false; rec.wake = null; rec.disturb = null;
        rec.swellU = null; rec.swellOn = false; rec.swellLast = null; rec.swellRefused = undefined;
      }
      body = null;
    },
    dispose() { view.after(); },
  };
  return view;
}
