// The Backrooms — water (the Graphics setting's `water`, graphics.js; the numbers and the shader are liquid.rule.js, the
// mark a room makes is liquid.mark.js).
//
// A room marks a sheet it has drawn as a liquid's surface: `c.liquid(target, { kind, phase, flow, y })` (world.js), the
// target being the mesh, the group the mesh is put in once the room is lit, or the batch it is drawn from. Marking draws
// nothing and makes nothing: once the room is built (c.after) the mark finds its mesh and measures it in the room's
// frame, and that is all, at every tier. The room keeps its sheet exactly as it was.
//
// Where the tier has water (Medium and High) the camcorder keeps a view of the marks (createLiquidView, vhs.js). The
// first frame a flat sheet's part is drawn at such a tier, a second mesh is put beside the sheet on the same geometry
// (rectangles, a fan, strips: anything flat) with the water's own material, its tint taken from the sheet's picture and
// opacity, lit by the sheet's own baked light and the room's dimmer, flicker and banks. That mesh is never visible
// outside the camcorder's own draw, so anything else that draws the scene (a room's own camera, the bloom's picture, the
// flashlight's shadows) sees the room's sheet as it always was. A sheet that is not flat is refused, quietly: it stays.
//
// The draw (vhs.js asks for it only while a surface of a part that is up has been in view in the last half second):
//   1. under: everything opaque, as the ordinary pass would have drawn it (the water, the see-through things and what is
//      held are moved to a layer of their own for the length of the draw, and the camera kept off it);
//   2. a copy of that picture and its depth into a plain pair at the scene's size (the scene's own target is
//      multisampled, and is drawn into again next);
//   3. over: the water (it writes depth: the haze and the bloom read the surface), the see-through things, then what is
//      held (hand.js holdInFront, as ever), into the same target, which is not cleared.
// Where the eye is under a surface (its plane plus 2 cm) and in its water (inside its rim, a sheet facing up), the
// surface's underside is drawn in the same place with a material of its own (LIQUID_UNDER_FRAG, the same uniforms),
// and the waterpark's veil over it as ever; under the plane anywhere else (outside the rim, or under the return pool's
// upside-down upper pool) the room's own sheet is. Everything changed for the draw is put back in a finally.
// What a room draws itself in place of what the water now draws (a mesh marked userData.liquidStandIn: the waterpark's
// pale splash ring in createBasin) is hidden for the length of that draw in each room whose surface is drawn, and put
// back in the same finally: Classic and Low, and any frame the room's surface is not drawn, keep it as it was.
//
// The wake: each surface that is up keeps a small pool of rings (liquid.rule.js wakeStart / wakeStep / wakeFill), timed by
// the camcorder's own clock (frame()'s `now`). A room or a creature starts one through the handle c.liquid gave it
// (`handle.disturb(x, z, strength)`, world coordinates); the visitor starts them by being in the water (feel(), which
// index.js calls once a frame). Where the tier has no water there is no view, rec.disturb is never set, and the handle's
// call does nothing.
//
// The mirror (water 2, High only; createLiquidView's setLevel): of the surfaces in view this frame, the one nearest the eye
// that faces up and has the eye above it (pickMirror) gets a planar reflection. Inside the camcorder's draw, before
// anything else, the scene is drawn once more by a camera of its own, mirrored about that surface's plane, with an
// oblique near plane at the water (nothing under the surface is drawn into it), into a picture at half the scene's size
// (mirrorPass). Left out of it: every marked sheet and the water, what is held in front of the camera, a room's detail
// batches, and anything a builder marked userData.noReflect (on a mesh or a group). The flashlight's beam and its shadow
// lookup are taken into the mirror camera's space so a lit wall is lit in the mirror as it is in the room; the
// camcorder's own lamp (fixed to the eye in the kit's shader) is left out of it. Everything changed for it is put back
// in a finally. Every surface on that plane samples it (LIQUID_FRAG reflection(), MIRROR defined); the rest keep the
// flat tint. At water 1 (Medium) none of it exists: no define, no picture, no pass.
//
// The swell (a wave across a surface: handle.swell, liquid.mark.js; the Surge Basin's surge). While a room asks for one,
// its surface is drawn on a denser copy of its sheet's grid (swellGeometry: SWELL.rows along the room's z, SWELL.cols
// across, the sheet's own light, picture and banks taken between its vertices) with SWELL defined on its material (and on
// its underside's): each vertex raised, the slope, the foam, the mirror weakened on raised water, the cap under the eye
// (liquid.rule.js). The rings it starts where it breaks come from swellRings. Asked for nothing (between surges, every
// other surface), the surface has its sheet's geometry and no define: exactly as it was. A sheet that is not a whole grid,
// or whose room frame is turned or tilted against its own, is not swelled (rec.swellRefused says why).
import * as THREE from 'three';
import { LIQUID, underwater, holdStep, toLinear, waterColours, pinnedTint, wakeStart, wakeStep, wakeFill, wadeStep, LIQUID_VERT, LIQUID_FRAG, COPY_FRAG, LIQUID_UNDER_FRAG, seesUnderside,
  MIRROR, mirrorPlane, reflectMatrix, planeInView, obliqueProjection, mirrorSize, pickMirror, mirrorLeaves, screenCover, mirrorGate, mirrorWeight, mirrorDue,
  SWELL, swellRings } from './liquid.rule.js';
import { HELD_ORDER } from './beam-shadows.rule.js';
import { collectLiquids } from './liquid.mark.js';

export { markLiquid, settleLiquid, liquidMeshes, collectLiquids } from './liquid.mark.js';

/** The layer what is drawn after the copy is on, for the length of the camcorder's draw only. */
export const OVER_LAYER = 31;
const OVER = 1 << OVER_LAYER;

const textureTints = new WeakMap();
/** The average colour of a picture (linear), from its canvas; null where it cannot be read. */
export function averageColour(tex) {
  if (!tex) return null;
  if (textureTints.has(tex)) return textureTints.get(tex);
  let out = null;
  try {
    const img = tex.image, g = img?.getContext?.('2d'), d = g?.getImageData?.(0, 0, img.width, img.height)?.data;
    if (d && d.length >= 4) {
      const s = [0, 0, 0];
      let n = 0;
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; s[0] += toLinear(d[i] / 255) * a; s[1] += toLinear(d[i + 1] / 255) * a; s[2] += toLinear(d[i + 2] / 255) * a; n += a; }
      if (n > 0) out = s.map((x) => x / n);
    }
  } catch { out = null; }
  textureTints.set(tex, out);
  return out;
}

/**
 * The sheet's own colour: its picture's average times its vertex colour (aAlb), and its opacity. (A picture that was
 * changed for Classic after its water was approved stands for the colour it was approved with: SHEET_TINTS.)
 */
export function sheetTint(mesh) {
  const u = mesh.material?.uniforms || {}, avg = pinnedTint(averageColour(u.map?.value)) || LIQUID.fallbackTint, alb = mesh.geometry?.attributes?.aAlb;
  const a = [0, 0, 0];
  if (alb && alb.count) { for (let i = 0; i < alb.count; i++) { a[0] += alb.getX(i); a[1] += alb.getY(i); a[2] += alb.getZ(i); } a[0] /= alb.count; a[1] /= alb.count; a[2] /= alb.count; } else a.fill(1);
  return { tint: avg.map((v, i) => v * a[i]), alpha: Number.isFinite(u.uAlpha?.value) ? u.uAlpha.value : LIQUID.absorbAlpha };
}

/** The water's material for one sheet: the room's light uniforms are the sheet's own objects (its dimmer, flicker, banks). */
export function waterMaterial(old, rec, toRoom, shared) {
  const m = old.material, u = m.uniforms, defines = {};
  // (MIRROR is set by the view itself at water 2: liquid.js frame)
  if (m.defines?.FLICK) defines.FLICK = m.defines.FLICK;
  if (m.defines?.BANKS) defines.BANKS = m.defines.BANKS;
  const { tint, alpha } = sheetTint(old), col = waterColours(tint, alpha);
  const material = new THREE.ShaderMaterial({
    defines, vertexShader: LIQUID_VERT, fragmentShader: LIQUID_FRAG, side: THREE.DoubleSide, transparent: false, depthWrite: true, depthTest: true,
    uniforms: {
      ...shared,
      uFlick: u.uFlick || { value: 1 }, uDim: u.uDim || { value: 1 }, uBanks: u.uBanks || { value: [1, 1] }, uMoreBanks: u.uMoreBanks || { value: [0, 0] },
      uTint: u.uTint || { value: new THREE.Vector3(1, 1, 1) },
      uPhase: rec.phase || { value: 0 },
      uToRoom: { value: new THREE.Matrix4().fromArray(toRoom) }, uRoomToView: { value: new THREE.Matrix3() },
      uDeep: { value: new THREE.Vector3(...col.deep) }, uAbsorb: { value: new THREE.Vector3(...col.absorb) }, uScatter: { value: new THREE.Vector3(...col.scatter) },
      uKeep: { value: new THREE.Vector4(...col.keep, col.keepRate) },
      uEyeRoom: { value: new THREE.Vector3() },
      uMirrorOn: { value: 0 },                            // (1 only inside the camcorder's draw, on the water level that has the mirror)
      // (the wake's rings are the surface's own, not shared: liquid.js frame() sets them from its pool)
      uRings: rec.wake?.u.uRings || { value: Array.from({ length: LIQUID.rings }, () => new THREE.Vector4()) }, uRingN: rec.wake?.u.uRingN || { value: 0 },
      // (the swell's, the surface's own: read only where SWELL is defined)
      uSwell: rec.swellU?.uSwell || { value: new THREE.Vector4() }, uSwellBox: rec.swellU?.uSwellBox || { value: new THREE.Vector4() },
    },
  });
  material.name = `liquid:${rec.kind}`;
  return material;
}

/**
 * The swell's copy of a sheet's geometry: the sheet must be a whole grid (every column at every row; its corners at the
 * same height); → a geometry of the same attributes on rows `rowStep` apart along z and columns `colStep` apart along x
 * (each attribute taken bilinearly between the sheet's own vertices: its baked light, banks, picture and colour), facing
 * the way the sheet's first triangle does; or null (with why) for anything else.
 */
export function swellGeometry(geo, rowStep = SWELL.rows, colStep = SWELL.cols) {
  const pos = geo?.attributes?.position;
  if (!pos || pos.count < 4) return { geometry: null, why: 'nothing drawn' };
  const key = (v) => Math.round(v * 1e4);
  const xs = [...new Set(Array.from({ length: pos.count }, (_, i) => key(pos.getX(i))))].sort((a, b) => a - b);
  const zs = [...new Set(Array.from({ length: pos.count }, (_, i) => key(pos.getZ(i))))].sort((a, b) => a - b);
  if (xs.length < 2 || zs.length < 2 || xs.length * zs.length !== pos.count) return { geometry: null, why: 'not a grid' };
  const at = new Map();
  for (let i = 0; i < pos.count; i++) at.set(key(pos.getX(i)) + ',' + key(pos.getZ(i)), i);
  if (at.size !== pos.count) return { geometry: null, why: 'not a grid' };
  const X = xs.map((v) => v / 1e4), Z = zs.map((v) => v / 1e4), y = pos.getY(0);
  const x0 = X[0], x1 = X[X.length - 1], z0 = Z[0], z1 = Z[Z.length - 1];
  const cols = Math.max(2, Math.round((x1 - x0) / colStep) + 1), rows = Math.max(2, Math.round((z1 - z0) / rowStep) + 1);
  const names = Object.keys(geo.attributes), out = new THREE.BufferGeometry(), arrs = {};
  for (const k of names) arrs[k] = new Float32Array(cols * rows * geo.attributes[k].itemSize);
  const seg = (a, v) => { let i = 0; while (i < a.length - 2 && a[i + 1] < v) i++; return [i, Math.min(1, Math.max(0, (v - a[i]) / (a[i + 1] - a[i])))]; };
  for (let r = 0; r < rows; r++) {
    const zz = z0 + (z1 - z0) * r / (rows - 1), [iz, fz] = seg(Z, zz);
    for (let q = 0; q < cols; q++) {
      const xx = x0 + (x1 - x0) * q / (cols - 1), [ix, fx] = seg(X, xx), vi = r * cols + q;
      const c00 = at.get(xs[ix] + ',' + zs[iz]), c10 = at.get(xs[ix + 1] + ',' + zs[iz]), c01 = at.get(xs[ix] + ',' + zs[iz + 1]), c11 = at.get(xs[ix + 1] + ',' + zs[iz + 1]);
      for (const k of names) {
        const A = geo.attributes[k], n = A.itemSize, src = A.array;
        for (let j = 0; j < n; j++) arrs[k][vi * n + j] = (src[c00 * n + j] * (1 - fx) + src[c10 * n + j] * fx) * (1 - fz) + (src[c01 * n + j] * (1 - fx) + src[c11 * n + j] * fx) * fz;
      }
      arrs.position[vi * 3] = xx; arrs.position[vi * 3 + 1] = y; arrs.position[vi * 3 + 2] = zz;
    }
  }
  for (const k of names) out.setAttribute(k, new THREE.BufferAttribute(arrs[k], geo.attributes[k].itemSize));
  // facing as the sheet's first triangle does
  const idx = geo.index, a0 = idx ? idx.getX(0) : 0, a1 = idx ? idx.getX(1) : 1, a2 = idx ? idx.getX(2) : 2;
  const ux = pos.getX(a1) - pos.getX(a0), uz = pos.getZ(a1) - pos.getZ(a0), wx = pos.getX(a2) - pos.getX(a0), wz = pos.getZ(a2) - pos.getZ(a0);
  const up = uz * wx - ux * wz > 0, I = [];
  for (let r = 0; r < rows - 1; r++) for (let q = 0; q < cols - 1; q++) {
    const a = r * cols + q, b = a + 1, c = a + cols, d = c + 1;
    if (up) I.push(a, c, b, b, c, d); else I.push(a, b, c, b, d, c);
  }
  out.setIndex(I);
  out.computeBoundingBox();
  out.boundingBox.max.y += 1; out.boundingBox.min.y -= 0.25;     // (as high as a swell stands, and its trough)
  out.boundingSphere = out.boundingBox.getBoundingSphere(new THREE.Sphere());
  return { geometry: out, cols, rows, triangles: I.length / 3 };
}

/** The same surface seen from below: the top's very uniforms, the underside's shader (made the first time an eye is under it). */
export function undersideMaterial(pair, rec) {
  const top = pair.material;
  const { MIRROR: _mirror, ...defines } = top.defines || {};    // (no mirror seen from below)
  const material = new THREE.ShaderMaterial({ defines, vertexShader: LIQUID_VERT, fragmentShader: LIQUID_UNDER_FRAG,
    uniforms: top.uniforms, side: THREE.DoubleSide, transparent: false, depthWrite: true, depthTest: true });
  material.name = `liquid:${rec.kind}:underside`;
  rec.kit?.own?.(material);
  return material;
}

/**
 * A flat mark's rim and which way it faces, in its room's frame (for the eye under it): → { rim: { x0, z0, x1, z1 },
 * facesUp } — facesUp when the sheet's first triangle turns its front to the ceiling (a pool, its water below it; the
 * return pool's upside-down upper pool faces down).
 */
export function sheetRim(rec) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, facesUp = null;
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  rec.meshes.forEach((mesh, i) => {
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) return;
    m.fromArray(rec.toRoom[i]);
    for (let j = 0; j < pos.count; j++) {
      p.fromBufferAttribute(pos, j).applyMatrix4(m);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    if (facesUp !== null || pos.count < 3) return;
    const idx = mesh.geometry.index, at = (k) => (idx ? idx.getX(k) : k);
    p.fromBufferAttribute(pos, at(0)).applyMatrix4(m);
    a.fromBufferAttribute(pos, at(1)).applyMatrix4(m).sub(p);
    b.fromBufferAttribute(pos, at(2)).applyMatrix4(m).sub(p);
    facesUp = a.cross(b).y > 0;
  });
  return { rim: Number.isFinite(x0) ? { x0, z0, x1, z1 } : null, facesUp: !!facesUp };
}

/**
 * The camcorder's view of the marks (vhs.js makes one only while a tier's water is on). frame() once a frame before the
 * scene is drawn: → whether to draw it in two parts. draw() does that, into a target the caller has set and cleared,
 * `under` being the caller's own ordinary draw of the scene. release() puts every part back as Classic has it.
 */
export function createLiquidView() {
  const shared = {
    tScene: { value: null }, tDepth: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uClip: { value: new THREE.Vector2(0.06, 170) },
    uTime: { value: 0 }, uCaustic: { value: LIQUID.caustic },
    tMirror: { value: null }, uMirror: { value: new THREE.Matrix4() },   // (the mirror's picture and the way into it: water 2 only)
  };
  let copy = null, copyMat = null, quad = null, hold = { last: -Infinity, split: false };
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const list = [], frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), inv = new THREE.Matrix4(), eye = new THREE.Vector3(), at = new THREE.Vector3();
  const box = new THREE.Box3(), mv = new THREE.Matrix4();
  const stats = { marks: 0, up: 0, inView: 0, under: 0, below: 0, split: false, draws: 0, rings: 0,
    mirror: { on: false, surfaces: 0, size: null, calls: 0, triangles: 0, left: { noReflect: 0, liquid: 0, held: 0, detail: 0, sheet: 0 }, drawn: 0 } };
  // --- the mirror (water 2) ---
  let level = 1, mirrorRec = null, mirrorTarget = null;
  // (the surface chosen for the mirror, whether the pass is on for it (its cover's hysteresis), and its weight on the water)
  let chosen = null, gateOn = false, weight = 0;
  // (every other frame, MIRROR.every 2: the picture it holds and the world-to-picture matrix it was drawn with; the
  // camcorder's frame count; null whenever no surface has the mirror, so the first frame one comes into view draws)
  let held = null, frameNo = 0;
  const heldVP = new THREE.Matrix4();
  const corner = new THREE.Vector3();
  // the share of the picture a surface's rim covers (its sheet's extent in its room frame, at its plane)
  const coverOf = (rec) => {
    const { rim } = rec.edge ||= sheetRim(rec);
    if (!rim) return 0;
    const g = rec.rt.group.matrixWorld, y = rec.plane.y;
    return screenCover([[rim.x0, rim.z0], [rim.x1, rim.z0], [rim.x1, rim.z1], [rim.x0, rim.z1]].map(([x, z]) => corner.set(x, y, z).applyMatrix4(g).toArray()), pv.elements);
  };
  const mirrorCam = new THREE.PerspectiveCamera();
  mirrorCam.matrixAutoUpdate = false; mirrorCam.matrixWorldAutoUpdate = false;
  const cands = [], FLIP = new THREE.Matrix4().makeScale(-1, 1, 1), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mT = new THREE.Matrix4(), mTi = new THREE.Matrix4();
  const pPoint = new THREE.Vector3(), pNormal = new THREE.Vector3();
  const worldPlane = (rec) => {
    const g = rec.rt.group.matrixWorld;
    pPoint.set(0, rec.plane.y, 0).applyMatrix4(g); pNormal.set(0, 1, 0).transformDirection(g);
    return mirrorPlane(pNormal.toArray(), pPoint.toArray());
  };
  /**
   * The room mirrored about `rec`'s plane, into the mirror's picture (half the size of `target`, the scene's). Puts back,
   * in a finally, everything it changes: what it hid, the beam's uniforms, the renderer's target, clear colour, autoClear
   * and shadow maps, the scene's background. The visitor's own camera is never touched: the mirror has its own.
   */
  function mirrorPass(renderer, scene, camera, target, rec) {
    const [w, h] = mirrorSize(target.width, target.height);
    if (!mirrorTarget) mirrorTarget = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
    else if (mirrorTarget.width !== w || mirrorTarget.height !== h) mirrorTarget.setSize(w, h);
    const ms = stats.mirror;
    ms.size = [w, h]; for (const k of Object.keys(ms.left)) ms.left[k] = 0;
    // the mirror's camera: the eye's, mirrored about the plane, and turned over side to side so it is a camera again
    // (matrixWorld = R · C · F); its near plane moved onto the water
    const plane = worldPlane(rec);
    camera.updateMatrixWorld();
    mirrorCam.matrix.fromArray(reflectMatrix(plane)).multiply(camera.matrixWorld).multiply(FLIP);
    mirrorCam.matrixWorld.copy(mirrorCam.matrix); mirrorCam.matrixWorldInverse.copy(mirrorCam.matrixWorld).invert();
    mirrorCam.projectionMatrix.fromArray(obliqueProjection(camera.projectionMatrix.toArray(), planeInView(plane, mirrorCam.matrixWorldInverse.toArray())));
    mirrorCam.projectionMatrixInverse.copy(mirrorCam.projectionMatrix).invert();
    mirrorCam.near = camera.near; mirrorCam.far = camera.far;
    mirrorCam.layers.mask = camera.layers.mask & ~OVER;
    // from the eye's view space to the mirror's (T), for the beam; and to the mirror's picture, for the surface
    mT.multiplyMatrices(mirrorCam.matrixWorldInverse, camera.matrixWorld); mTi.copy(mT).invert();
    const sheets = new Set();
    for (const r of list) for (const m of r.meshes || []) sheets.add(m);
    const hidden = [], origins = new Map(), aims = new Map(), lamps = new Map(), shadows = new Map();
    const was = renderer.getRenderTarget?.() ?? null, autoClear = renderer.autoClear, bg = scene.background;
    const shadowAuto = renderer.shadowMap?.autoUpdate, clear = new THREE.Color(), clearAlpha = renderer.getClearAlpha?.() ?? 1;
    renderer.getClearColor?.(clear);
    const info = renderer.info, c0 = info?.render?.calls ?? 0, t0 = info?.render?.triangles ?? 0;
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
      // the beam where it is, seen from the mirror (its origin and direction live in the eye's view space); its shadow
      // looked up from there; the camcorder's own lamp is fixed to the eye in the kit's shader, and is left out
      for (const [v, orig] of origins) v.copy(orig).applyMatrix4(mT);
      for (const [v, orig] of aims) v.copy(orig).transformDirection(mT);
      for (const u of lamps.keys()) u.value = 0;
      for (const [m, orig] of shadows) m.copy(orig).multiply(mTi);
      scene.background = null;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = false;
      renderer.setRenderTarget(mirrorTarget);
      renderer.setClearColor?.(0x000000, 1);
      renderer.state?.buffers?.depth?.setMask?.(true);
      renderer.clear(true, true, false);
      renderer.render(scene, mirrorCam);
      shared.tMirror.value = mirrorTarget.texture;
      shared.uMirror.value.multiplyMatrices(mirrorCam.projectionMatrix, mT);
      heldVP.multiplyMatrices(mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse);
      held = { rec, frame: frameNo, w, h };
      ms.drawn++;
    } finally {
      for (const o of hidden) o.visible = true;
      for (const [v, orig] of origins) v.copy(orig);
      for (const [v, orig] of aims) v.copy(orig);
      for (const [u, orig] of lamps) u.value = orig;
      for (const [m, orig] of shadows) m.copy(orig);
      scene.background = bg;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = shadowAuto;
      renderer.setClearColor?.(clear, clearAlpha);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(was);
      if (info && !info.autoReset) { ms.calls = info.render.calls - c0; ms.triangles = info.render.triangles - t0; }
    }
  }
  // --- end the mirror ---
  let clock = 0, body = null;                             // (the camcorder's clock as of the last frame; the visitor's wade)
  const toPart = new THREE.Matrix4(), pt = new THREE.Vector3();
  // a point in the part's coordinates (the world's, as c.toWorld gives them) in a surface's room frame
  const inRoom = (rec, x, y, z) => pt.set(x, y, z).applyMatrix4(toPart.copy(rec.rt.group.matrix).invert());

  // the wake of a surface that is up: its pool, its uniforms, where it is (its room frame), and the call that starts a ring
  function wakeOf(rec) {
    const box = new THREE.Box3(), part = new THREE.Box3(), m = new THREE.Matrix4();
    rec.meshes.forEach((old, i) => {
      if (!old.geometry?.attributes?.position) return;
      if (!old.geometry.boundingBox) old.geometry.computeBoundingBox();
      box.union(part.copy(old.geometry.boundingBox).applyMatrix4(m.fromArray(rec.toRoom[i])));
    });
    rec.wake = { pool: [], box, u: { uRings: { value: Array.from({ length: LIQUID.rings }, () => new THREE.Vector4()) }, uRingN: { value: 0 } } };
    rec.disturb = (x, z, strength = 1) => {
      if (!rec.wake || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      const p = inRoom(rec, x, rec.plane.y, z);
      return wakeStart(rec.wake.pool, p.x, p.z, strength, clock);
    };
  }

  function upgrade(rec) {
    rec.pairs = [];
    wakeOf(rec);
    rec.swellU = { uSwell: { value: new THREE.Vector4() }, uSwellBox: { value: new THREE.Vector4() } };
    rec.swellOn = false; rec.swellLast = null; rec.swellState = {};
    rec.meshes.forEach((old, i) => {
      const m = old.material;
      if (!old.parent || !old.geometry?.attributes?.aLit || !m?.isShaderMaterial || !m.uniforms) return;
      const material = waterMaterial(old, rec, rec.toRoom[i], shared);
      rec.kit?.own?.(material);
      const water = new THREE.Mesh(old.geometry, material);
      water.name = 'liquid:surface';
      water.position.copy(old.position); water.quaternion.copy(old.quaternion); water.scale.copy(old.scale);
      water.matrixAutoUpdate = old.matrixAutoUpdate; water.matrix.copy(old.matrix); water.matrixWorld.copy(old.matrixWorld);
      water.renderOrder = old.renderOrder; water.frustumCulled = old.frustumCulled;
      water.visible = false;                              // (only ever on inside the camcorder's own draw)
      water.userData.noBeamShadow = true; water.userData.liquid = rec;
      old.parent.add(water);
      if (!old.geometry.boundingBox) old.geometry.computeBoundingBox();
      rec.pairs.push({ old, water, material, rec });
    });
    if (rec.pairs.length) rec.state = 'up'; else { rec.state = 'refused'; rec.reason = 'not a kit sheet'; rec.pairs = null; rec.wake = null; rec.disturb = null; }
  }
  // the swell, once a frame for a surface that is up: its geometry and define on while one is asked for, off (the sheet's
  // own, no define: as it was) while none is; its uniforms; the rings where it breaks
  const ROOM_UP = (m) => { const e = m; return Math.abs(e[4]) < 1e-6 && Math.abs(e[5] - 1) < 1e-6 && Math.abs(e[6]) < 1e-6 && Math.abs(e[1]) < 1e-6 && Math.abs(e[9]) < 1e-6 && Math.abs(e[10] - 1) < 1e-6; };
  function setSwellDefine(p, on) {
    for (const m of [p.material, p.under]) {
      if (!m || !!m.defines.SWELL === on) continue;
      if (on) m.defines.SWELL = 1; else delete m.defines.SWELL;
      m.needsUpdate = true;
    }
  }
  function swellFrame(rec, now) {
    // (asked for each tick: an ask nobody has repeated for a few frames, its room no longer ticking, is let go)
    rec.swellStale = rec.swellFresh ? 0 : (rec.swellStale || 0) + 1; rec.swellFresh = false;
    const ask = rec.swellStale > 10 ? null : rec.swell;
    let on = !!ask && !rec.swellRefused;
    if (on) for (const p of rec.pairs) {
      if (p.dense === undefined) {
        const i = rec.meshes.indexOf(p.old);
        if (!ROOM_UP(rec.toRoom[i] || [])) { p.dense = null; rec.swellRefused = 'turned in its room'; }
        else { const g = swellGeometry(p.old.geometry); p.dense = g.geometry; if (!g.geometry) rec.swellRefused = g.why; else rec.swellCost = { cols: g.cols, rows: g.rows, triangles: g.triangles }; }
      }
      if (!p.dense) on = false;
    }
    for (const p of rec.pairs) {
      const g = on ? p.dense : p.old.geometry;
      if (p.water.geometry !== g) p.water.geometry = g;
      setSwellDefine(p, on);
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
  // (shown: the sheet and everything it hangs from are visible, up to the top; a room may hide its own sheet)
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

  function ensureCopy(w, h) {
    if (!copy) {
      copy = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h) });
      copyMat = new THREE.ShaderMaterial({ uniforms: { tColor: { value: null }, tDepth: { value: null } }, depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: COPY_FRAG });
      quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat); quad.frustumCulled = false;
    } else if (copy.width !== w || copy.height !== h) { copy.setSize(w, h); Object.assign(copy.depthTexture.image, { width: w, height: h }); }
  }

  const view = {
    /** 'split' | 'single' | null: the dev page's, to see the two ways side by side. */
    force: null, stats, shared,
    /** The tier's water (graphics.js): 2 has the mirror; under 2 its picture is let go and no surface compiles it. */
    setLevel(n) {
      level = Number(n) || 0;
      if (level < 2) { mirrorRec = chosen = null; gateOn = false; weight = 0; held = null; stats.mirror.on = false; mirrorTarget?.dispose(); mirrorTarget = null; shared.tMirror.value = null; }
    },
    get level() { return level; },
    /** How often the mirror's pass runs (MIRROR.every unless set here: 1, 2 or 3), e.g. `__backrooms.vhs.liquids.mirrorEvery = 2` on the dev page. */
    mirrorEvery: MIRROR.every,
    /** The surface that has the mirror this frame (null for none), and the mirror's picture and camera, for the dev page and the tests. */
    get mirror() { return mirrorRec ? { rec: mirrorRec, target: mirrorTarget, camera: mirrorCam } : null; },
    get split() { return hold.split; },
    get copy() { return copy; },
    get marks() { return list.slice(); },
    /** Once a frame, before the scene is drawn: the marks of the parts that are up, made into water where they are not yet, and whether one is in view. */
    frame(scene, camera, now) {
      frameNo++;
      list.length = 0; collectLiquids(scene, list);
      shared.uTime.value = now; clock = now;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      eye.setFromMatrixPosition(camera.matrixWorld);
      let seen = false;
      Object.assign(stats, { marks: list.length, up: 0, inView: 0, under: 0, below: 0, rings: 0 });
      cands.length = 0;
      const mirrors = level >= 2;
      for (const rec of list) {
        if (rec.state === 'marked') upgrade(rec);
        // (the mirror's define on the top, only at water 2: Medium's surfaces compile exactly the shader they had)
        if (rec.state === 'up') for (const p of rec.pairs) if (!!p.material.defines.MIRROR !== mirrors) {
          if (mirrors) p.material.defines.MIRROR = 1; else delete p.material.defines.MIRROR;
          p.material.needsUpdate = true;
        }
        rec.live = false; rec.under = false; rec.below = false;
        if (rec.state !== 'up') continue;
        stats.up++;
        swellFrame(rec, now);
        // the wake: what has faded let go, the rest handed to the shader (none: uRingN 0, and the surface is as it was)
        const w = rec.wake;
        w.u.uRingN.value = wakeFill(wakeStep(w.pool, now), now, w.u.uRings.value);
        stats.rings += w.u.uRingN.value;
        if (!rec.pairs.some((p) => shown(p.old))) continue;
        rec.live = true;
        at.copy(eye).applyMatrix4(inv.copy(rec.rt.group.matrixWorld).invert());
        if ((rec.under = underwater(at.y, rec.plane.y))) {
          stats.under++;
          // (in the water, inside its rim, under a pool's surface: its underside is drawn; anywhere else under the plane,
          // the room's own sheet, as before)
          rec.edge ||= sheetRim(rec);
          if (!(rec.below = seesUnderside(at, rec.plane.y, rec.edge.rim, rec.edge.facesUp))) continue;
          stats.below++;
        }
        for (const p of rec.pairs) {
          if (!shown(p.old)) continue;
          box.copy(p.old.geometry.boundingBox).applyMatrix4(p.old.matrixWorld);
          box.min.y -= LIQUID.margin; box.max.y += LIQUID.margin + (rec.swellOn ? rec.swell.height : 0);
          if (frustum.intersectsBox(box)) {
            seen = true; stats.inView++;
            // (a candidate for the mirror: in view, facing up, the eye well over it; how far the eye is from it)
            if (mirrors && !rec.under && at.y > rec.plane.y + MIRROR.above && (rec.edge ||= sheetRim(rec)).facesUp) cands.push({ rec, dist: box.distanceToPoint(eye) });
            break;
          }
        }
      }
      hold = holdStep(hold, now, seen, view.force);
      stats.split = hold.split;
      const pick = mirrors && hold.split ? pickMirror(cands, chosen) : null;
      // (a sliver of water is not worth the room drawn again: the pass is on while the surface covers enough of the
      // picture, with a margin either way; its weight fades in above that, so the switch is never seen)
      if (pick !== chosen) gateOn = false;
      chosen = pick;
      const cover = pick ? coverOf(pick) : 0;
      gateOn = !!pick && mirrorGate(gateOn, cover);
      weight = gateOn ? mirrorWeight(cover) : 0;
      mirrorRec = gateOn && weight > 0 ? pick : null;
      if (!mirrorRec) held = null;
      Object.assign(stats.mirror, { on: !!mirrorRec, chosen: !!pick, cover, weight });
      return hold.split;
    },
    /**
     * The scene in two parts into `target` (set and cleared by the caller), `under()` the caller's ordinary draw of it.
     * Without a depth to read there is nothing to split on: the ordinary draw, as it was.
     */
    draw(renderer, scene, camera, target, under) {
      if (!target?.depthTexture) return under();
      const was = renderer.getRenderTarget?.() ?? target, autoClear = renderer.autoClear, bg = scene.background, camMask = camera.layers.mask;
      const swapped = [], moved = [], lit = [], stood = [];
      try {
        // what a room draws itself in place of what the water now does (userData.liquidStandIn: the waterpark's pale splash
        // ring), hidden in each room whose surface is drawn this frame, before anything is drawn (the mirror too)
        const rooms = new Set();
        for (const rec of list) if (rec.live && (!rec.under || rec.below) && rec.pairs?.some((p) => shown(p.old))) rooms.add(rec.rt.group);
        for (const g of rooms) g.traverse((o) => { if (o.userData?.liquidStandIn && o.visible) { o.visible = false; stood.push(o); } });
        // the mirror first (water 2, a surface chosen this frame): into its own picture, everything it changed put back
        stats.mirror.surfaces = 0;
        if (mirrorRec && level >= 2) {
          const [w, h] = mirrorSize(target.width, target.height);
          stats.mirror.fresh = mirrorDue(held, { rec: mirrorRec, frame: frameNo, w, h }, view.mirrorEvery);
          if (stats.mirror.fresh) mirrorPass(renderer, scene, camera, target, mirrorRec);
          else {
            // (a frame in between: the last picture, looked up through the matrix it was drawn with, from where the eye is
            // now: the reflection is of the room as seen from where the eye was then, but it does not slide)
            camera.updateMatrixWorld();
            shared.uMirror.value.multiplyMatrices(heldVP, camera.matrixWorld);
            stats.mirror.skipped = (stats.mirror.skipped || 0) + 1;
          }
          const y = worldPlane(mirrorRec);
          for (const rec of list) {
            if (!rec.live || rec.under || !rec.pairs) continue;
            const o = worldPlane(rec);
            if (Math.abs(o[3] - y[3]) > MIRROR.samePlane || o[1] < 0.999) continue;
            for (const p of rec.pairs) { p.material.uniforms.uMirrorOn.value = weight; lit.push(p); }
            stats.mirror.surfaces++;
          }
        }
        // the water on, the room's sheet off, where the sheet is shown and the eye is above it
        for (const rec of list) {
          if (!rec.live || (rec.under && !rec.below)) continue;
          for (const p of rec.pairs) if (shown(p.old)) {
            if (rec.below) p.water.material = p.under ||= undersideMaterial(p, rec);
            p.water.visible = true; p.old.visible = false; swapped.push(p);
          }
        }
        // what is drawn after the copy: the water, everything see-through, what is held
        scene.traverseVisible((o) => {
          if (!o.material) return;
          const see = Array.isArray(o.material) ? o.material.some((x) => x.transparent) : o.material.transparent;
          if (o.userData.liquid || see || (o.renderOrder || 0) >= HELD_ORDER) { moved.push(o, o.layers.mask); o.layers.mask = OVER; }
        });
        camera.layers.mask = camMask & ~OVER;
        under();
        // the copy, of the opaque picture as it stands
        ensureCopy(target.width, target.height);
        copyMat.uniforms.tColor.value = target.texture; copyMat.uniforms.tDepth.value = target.depthTexture;
        renderer.setRenderTarget(copy); renderer.render(quad, quadCam);
        shared.tScene.value = copy.texture; shared.tDepth.value = copy.depthTexture;
        shared.uSize.value.set(target.width, target.height); shared.uClip.value.set(camera.near, camera.far);
        // (the ripple is worked out in the room's frame: its normal turned into the camera's)
        for (const p of swapped) {
          p.material.uniforms.uRoomToView.value.setFromMatrix4(mv.multiplyMatrices(camera.matrixWorldInverse, p.rec.rt.group.matrixWorld));
          p.material.uniforms.uEyeRoom.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(mv.copy(p.rec.rt.group.matrixWorld).invert());
        }
        // the rest, over it
        scene.background = null; renderer.autoClear = false; camera.layers.mask = OVER;
        renderer.setRenderTarget(target); renderer.render(scene, camera);
        stats.draws++;
      } finally {
        for (const o of stood) o.visible = true;
        for (const p of lit) p.material.uniforms.uMirrorOn.value = 0;
        for (let i = 0; i < moved.length; i += 2) moved[i].layers.mask = moved[i + 1];
        for (const p of swapped) { p.water.visible = false; p.old.visible = true; p.water.material = p.material; }
        camera.layers.mask = camMask; scene.background = bg; renderer.autoClear = autoClear;
        renderer.setRenderTarget(was);
      }
    },
    /**
     * The visitor, once a frame (index.js): in the part `part` (its scene; null for any), at x, z, their feet at `foot`
     * and the eye at `eye` (heights in the part's coordinates; feet in the air over it are not in it: a jump in starts
     * its ring as they reach the water), going at `speed` m/s. In a surface's water (over it, the feet under its plane,
     * the eye not too far under it) leaves a ring as they go in, then one every wadeEvery metres moved
     * through it (liquid.rule.js wadeStep), by the camcorder's clock. → the strength of the ring started, or 0.
     */
    feel(part, x, z, foot, eye, speed) {
      if (![x, z, foot, eye].every(Number.isFinite)) return 0;
      let hit = null, at = null;
      for (const rec of list) {
        if (rec.state !== 'up' || !rec.wake || (part && rec.rt.group.parent !== part)) continue;
        const p = inRoom(rec, x, foot, z), b = rec.wake.box, y = rec.plane.y;
        if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) continue;
        if (!(p.y < y - LIQUID.under) || p.y + (eye - foot) < y - LIQUID.wadeDeep) continue;
        hit = rec; at = { x: p.x, z: p.z }; break;
      }
      const step = wadeStep(body, { wet: !!hit, speed, now: clock });
      body = step.state;
      if (hit && step.ring > 0 && wakeStart(hit.wake.pool, at.x, at.z, step.ring, clock)) return step.ring;
      return 0;
    },
    /** Every part under `scene` back as Classic has it: the water's meshes taken out and let go, and the copy. */
    release(scene) {
      for (const rec of collectLiquids(scene)) {
        if (rec.state !== 'up') continue;
        for (const p of rec.pairs) { p.water.parent?.remove(p.water); p.material.dispose(); p.under?.dispose(); p.dense?.dispose(); }
        rec.pairs = null; rec.state = 'marked'; rec.live = false; rec.wake = null; rec.disturb = null;
        rec.swellU = null; rec.swellOn = false; rec.swellLast = null; rec.swellRefused = undefined;
      }
      body = null;
      view.dispose();
    },
    dispose() {
      copy?.depthTexture?.dispose(); copy?.dispose(); copyMat?.dispose(); quad?.geometry.dispose();
      copy = copyMat = quad = null; hold = { last: -Infinity, split: false };
      mirrorTarget?.dispose(); mirrorTarget = null; mirrorRec = chosen = null; gateOn = false; weight = 0; held = null; shared.tMirror.value = null;
    },
  };
  return view;
}
