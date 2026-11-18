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
//
// The wake: each surface that is up keeps a small pool of rings (liquid.rule.js wakeStart / wakeStep / wakeFill), timed by
// the camcorder's own clock (frame()'s `now`). A room or a creature starts one through the handle c.liquid gave it
// (`handle.disturb(x, z, strength)`, world coordinates); the visitor starts them by being in the water (feel(), which
// index.js calls once a frame). Where the tier has no water there is no view, rec.disturb is never set, and the handle's
// call does nothing.
import * as THREE from 'three';
import { LIQUID, underwater, holdStep, toLinear, waterColours, wakeStart, wakeStep, wakeFill, wadeStep, LIQUID_VERT, LIQUID_FRAG, COPY_FRAG, LIQUID_UNDER_FRAG, seesUnderside } from './liquid.rule.js';
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

/** The sheet's own colour: its picture's average times its vertex colour (aAlb), and its opacity. */
export function sheetTint(mesh) {
  const u = mesh.material?.uniforms || {}, avg = averageColour(u.map?.value) || LIQUID.fallbackTint, alb = mesh.geometry?.attributes?.aAlb;
  const a = [0, 0, 0];
  if (alb && alb.count) { for (let i = 0; i < alb.count; i++) { a[0] += alb.getX(i); a[1] += alb.getY(i); a[2] += alb.getZ(i); } a[0] /= alb.count; a[1] /= alb.count; a[2] /= alb.count; } else a.fill(1);
  return { tint: avg.map((v, i) => v * a[i]), alpha: Number.isFinite(u.uAlpha?.value) ? u.uAlpha.value : LIQUID.absorbAlpha };
}

/** The water's material for one sheet: the room's light uniforms are the sheet's own objects (its dimmer, flicker, banks). */
export function waterMaterial(old, rec, toRoom, shared) {
  const m = old.material, u = m.uniforms, defines = {};
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
      // (the wake's rings are the surface's own, not shared: liquid.js frame() sets them from its pool)
      uRings: rec.wake?.u.uRings || { value: Array.from({ length: LIQUID.rings }, () => new THREE.Vector4()) }, uRingN: rec.wake?.u.uRingN || { value: 0 },
    },
  });
  material.name = `liquid:${rec.kind}`;
  return material;
}

/** The same surface seen from below: the top's very uniforms, the underside's shader (made the first time an eye is under it). */
export function undersideMaterial(pair, rec) {
  const top = pair.material;
  const material = new THREE.ShaderMaterial({ defines: { ...top.defines }, vertexShader: LIQUID_VERT, fragmentShader: LIQUID_UNDER_FRAG,
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
  };
  let copy = null, copyMat = null, quad = null, hold = { last: -Infinity, split: false };
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const list = [], frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), inv = new THREE.Matrix4(), eye = new THREE.Vector3(), at = new THREE.Vector3();
  const box = new THREE.Box3(), mv = new THREE.Matrix4();
  const stats = { marks: 0, up: 0, inView: 0, under: 0, below: 0, split: false, draws: 0, rings: 0 };
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
    get split() { return hold.split; },
    get copy() { return copy; },
    get marks() { return list.slice(); },
    /** Once a frame, before the scene is drawn: the marks of the parts that are up, made into water where they are not yet, and whether one is in view. */
    frame(scene, camera, now) {
      list.length = 0; collectLiquids(scene, list);
      shared.uTime.value = now; clock = now;
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      eye.setFromMatrixPosition(camera.matrixWorld);
      let seen = false;
      Object.assign(stats, { marks: list.length, up: 0, inView: 0, under: 0, below: 0, rings: 0 });
      for (const rec of list) {
        if (rec.state === 'marked') upgrade(rec);
        rec.live = false; rec.under = false; rec.below = false;
        if (rec.state !== 'up') continue;
        stats.up++;
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
          box.min.y -= LIQUID.margin; box.max.y += LIQUID.margin;
          if (frustum.intersectsBox(box)) { seen = true; stats.inView++; break; }
        }
      }
      hold = holdStep(hold, now, seen, view.force);
      stats.split = hold.split;
      return hold.split;
    },
    /**
     * The scene in two parts into `target` (set and cleared by the caller), `under()` the caller's ordinary draw of it.
     * Without a depth to read there is nothing to split on: the ordinary draw, as it was.
     */
    draw(renderer, scene, camera, target, under) {
      if (!target?.depthTexture) return under();
      const was = renderer.getRenderTarget?.() ?? target, autoClear = renderer.autoClear, bg = scene.background, camMask = camera.layers.mask;
      const swapped = [], moved = [];
      try {
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
        for (const p of rec.pairs) { p.water.parent?.remove(p.water); p.material.dispose(); p.under?.dispose(); }
        rec.pairs = null; rec.state = 'marked'; rec.live = false; rec.wake = null; rec.disturb = null;
      }
      body = null;
      view.dispose();
    },
    dispose() {
      copy?.depthTexture?.dispose(); copy?.dispose(); copyMat?.dispose(); quad?.geometry.dispose();
      copy = copyMat = quad = null; hold = { last: -Infinity, split: false };
    },
  };
  return view;
}
