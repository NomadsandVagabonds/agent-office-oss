// The Backrooms — the flashlight casting shadows: the depth pass, and the switch on the kit's surfaces
// (beam-shadows.rule.js has the numbers and the rules; graphics.js `beamShadows` says the size, 0 for off).
//
// With the switch at 0 nothing here runs: no target is made, no pass is drawn, and no material is touched, so every
// surface compiles the kit's shader exactly as it was. With it on, each frame the flashlight is on:
//   - every kit surface in view that takes the beam (and is not held in the hand) gets BEAM_SHADOWS defined, once;
//   - the opaque geometry of the parts that are up (the rooms the world has visible, and only what the shadow
//     camera's frustum holds) is drawn depth only from the emitter, with cut-outs still cut out;
//   - the matrix from the camera's space to the picture is handed to the shader.
// The emitter is fixed to the camera (flashlight.js FLASHLIGHT_POSES), so that matrix only changes with the pose.
import * as THREE from 'three';
import { gpu } from '../engine/gpu.js';
import { BEAM_SHADOW, beamFrustum, beamShadowSize, castsBeamShadow, receivesBeamShadow } from './beam-shadows.rule.js';

export function createBeamShadows(renderer) {
  const uniforms = {
    uBeamShadowMap: { value: null },
    uBeamShadowMatrix: { value: new THREE.Matrix4() },
    uBeamShadowK: { value: new THREE.Vector2(0, 0) },
  };
  const cam = new THREE.PerspectiveCamera(36, 1, BEAM_SHADOW.near, BEAM_SHADOW.far);
  const pose = new THREE.Matrix4(), world = new THREE.Matrix4(), scale = new THREE.Vector3();
  const eye = new THREE.Vector3(), aim = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const toPicture = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  // WebGPU clip-space z is already [0, 1] (vs WebGL [-1, 1]), so only x and y are biased into [0, 1].
  const toPictureGPU = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 1, 0, 0, 0, 0, 1);
  const isNode = () => !!(renderer?.isWebGPURenderer && gpu.nodes);
  let target = null, size = 0;
  const patched = new Set(), depths = new Map(), depthCleanups = new Map(), list = [], swapped = [], hidden = [];
  const origin = [0, 0, 0], direction = [0, 0, 0], poseScratch = { origin, direction };
  const forget = (e) => patched.delete(e.target);
  const stats = { drawn: false, calls: 0, triangles: 0, casters: 0, receivers: 0 };

  function make(res) {
    target?.dispose(); target?.depthTexture?.dispose();
    if (isNode()) {
      const N = gpu.nodes;
      const depth = new N.DepthTexture(res, res);
      depth.type = N.UnsignedIntType;
      depth.compareFunction = N.LessEqualCompare;
      depth.minFilter = depth.magFilter = N.LinearFilter;
      target = new N.RenderTarget(res, res, { format: N.RedFormat, type: N.UnsignedByteType, depthBuffer: true, depthTexture: depth, generateMipmaps: false });
      size = res;
      uniforms.uBeamShadowMap.value = depth;
      return;
    }
    const depth = new THREE.DepthTexture(res, res);
    depth.type = THREE.UnsignedIntType;
    depth.compareFunction = THREE.LessEqualCompare;
    depth.minFilter = depth.magFilter = THREE.LinearFilter;
    target = new THREE.WebGLRenderTarget(res, res, { format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: true, depthTexture: depth, generateMipmaps: false });
    size = res;
    uniforms.uBeamShadowMap.value = depth;
    // Allocate the WebGL2 depth attachment immediately so sampler2DShadow has a valid
    // COMPARE_REF_TO_TEXTURE backing store even when warm() patches materials while the torch is off.
    if (renderer?.setRenderTarget) {
      const was = renderer.getRenderTarget?.() ?? null;
      const autoClear = renderer.autoClear;
      try {
        renderer.setRenderTarget(target);
        renderer.autoClear = false;
        renderer.state?.buffers?.depth?.setMask?.(true);
        renderer.clear?.(false, true, false);
      } finally {
        renderer.autoClear = autoClear;
        renderer.setRenderTarget(was);
      }
    }
  }
  function patch(m) {
    m.defines = m.defines || {};
    m.defines.BEAM_SHADOWS = 1;
    Object.assign(m.uniforms, uniforms);
    m.rebuildNode?.();
    m.needsUpdate = true;
    patched.add(m); m.addEventListener('dispose', forget);
  }
  function off() {
    for (const m of patched) { delete m.defines.BEAM_SHADOWS; m.rebuildNode?.(); m.needsUpdate = true; m.removeEventListener('dispose', forget); }
    patched.clear();
    for (const { cut, onDispose } of depthCleanups.values()) cut.removeEventListener?.('dispose', onDispose);
    depthCleanups.clear();
    for (const m of depths.values()) m.dispose();
    depths.clear();
    target?.dispose(); target?.depthTexture?.dispose(); target = null; size = 0;
    uniforms.uBeamShadowMap.value = null; uniforms.uBeamShadowK.value.set(0, 0);
  }
  /** The depth material standing in for one of a thing's: by side, and by the cut-out picture if it has one. */
  function depthFor(m) {
    const cut = m.defines?.CUTOUT ? m.uniforms?.map?.value : m.alphaTest > 0 ? m.map : null;
    const alphaTest = cut ? (m.defines?.CUTOUT ? 0.5 : m.alphaTest) : 0;
    const key = `${m.side}|${cut ? cut.uuid : ''}|${alphaTest}`;
    let d = depths.get(key);
    if (!d) {
      if (isNode()) {
        const N = gpu.nodes;
        d = new N.MeshBasicNodeMaterial({ side: m.side, map: cut || null, alphaTest, colorWrite: false,
          polygonOffset: true, polygonOffsetFactor: BEAM_SHADOW.polygonOffset[0], polygonOffsetUnits: BEAM_SHADOW.polygonOffset[1] });
      } else {
        d = new THREE.MeshDepthMaterial({ side: m.side, map: cut || null, alphaTest, colorWrite: false,
          polygonOffset: true, polygonOffsetFactor: BEAM_SHADOW.polygonOffset[0], polygonOffsetUnits: BEAM_SHADOW.polygonOffset[1] });
      }
      depths.set(key, d);
      if (cut?.addEventListener) {
        const onDispose = () => {
          cut.removeEventListener('dispose', onDispose);
          depthCleanups.delete(key);
          const dm = depths.get(key);
          if (dm) { depths.delete(key); dm.dispose(); }
        };
        cut.addEventListener('dispose', onDispose);
        depthCleanups.set(key, { cut, onDispose });
      }
    }
    return d;
  }

  /**
   * Once a frame, before the picture is drawn. res: the profile's beamShadows; camera: the visitor's; scenes: the parts
   * that are up (their world.scene); shared: the kit's beam uniforms (uTorch, uTorchOrigin, uTorchDirection, in the
   * camera's space: index.js sets them every frame).
   */
  function draw(res, camera, scenes, shared) {
    res = beamShadowSize(res);
    stats.drawn = false; stats.calls = stats.triangles = stats.casters = stats.receivers = 0;
    if (!res) { if (target || patched.size) off(); return stats; }
    shared.uTorchOrigin.value.toArray(origin);
    shared.uTorchDirection.value.toArray(direction);
    const frustum = beamFrustum(poseScratch, res);
    if (!frustum || !(shared.uTorch.value > 0.0001)) { uniforms.uBeamShadowK.value.set(1 / res, 0); return stats; }
    if (size !== res) make(res);

    // what is in view: take the shadow (kit surfaces, once each), throw it, or neither
    list.length = 0;
    for (const s of scenes) { if (!s || !s.visible) continue; s.traverseVisible((o) => { if (o.isMesh) list.push(o); }); }
    for (const o of list) {
      if (receivesBeamShadow(o)) { stats.receivers++; if (!patched.has(o.material)) patch(o.material); }
      if (castsBeamShadow(o)) { swapped.push(o, o.material); o.material = Array.isArray(o.material) ? o.material.map(depthFor) : depthFor(o.material); stats.casters++; }
      else { hidden.push(o); o.visible = false; }
    }

    // the emitter, in the camera's space and then in the world's
    eye.fromArray(frustum.origin); aim.fromArray(frustum.direction).add(eye);
    pose.lookAt(eye, aim, up).setPosition(eye);
    camera.updateMatrixWorld();
    world.multiplyMatrices(camera.matrixWorld, pose).decompose(cam.position, cam.quaternion, scale);
    const coord = renderer.coordinateSystem;
    let projDirty = false;
    if (coord && cam.coordinateSystem !== coord) { cam.coordinateSystem = coord; projDirty = true; }
    if (cam.fov !== frustum.fov) { cam.fov = frustum.fov; projDirty = true; }
    if (projDirty) cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const toPic = coord === THREE.WebGPUCoordinateSystem ? toPictureGPU : toPicture;
    uniforms.uBeamShadowMatrix.value.multiplyMatrices(toPic, cam.projectionMatrix).multiply(world.copy(pose).invert());
    uniforms.uBeamShadowK.value.set(1 / res, 1);

    const was = renderer.getRenderTarget(), autoClear = renderer.autoClear, info = renderer.info, c0 = info.render.calls, t0 = info.render.triangles;
    const wasMrt = renderer.getMRT?.() ?? null;
    try {
      if (wasMrt) renderer.setMRT(null);
      renderer.setRenderTarget(target);
      renderer.autoClear = false;
      renderer.state?.buffers?.depth?.setMask?.(true);       // (a see-through mesh drawn before may have left depth writes off)
      renderer.clear(false, true, false);
      for (const s of scenes) {
        if (!s || !s.visible) continue;
        const bg = s.background; s.background = null;
        try { renderer.render(s, cam); } finally { s.background = bg; }
      }
      if (!info.autoReset) { stats.calls = info.render.calls - c0; stats.triangles = info.render.triangles - t0; }
      stats.drawn = true;
    } finally {
      if (wasMrt) renderer.setMRT(wasMrt);
      renderer.autoClear = autoClear;
      renderer.setRenderTarget(was);
      for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
      for (const o of hidden) o.visible = true;
      swapped.length = hidden.length = 0;
    }
    return stats;
  }

  /** Pre-patch receiving surfaces and pre-create caster depth materials during floor build so crossing doorways never stalls. */
  function warm(res, scene) {
    res = beamShadowSize(res);
    if (!res || !scene) return;
    if (size !== res) make(res);
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (receivesBeamShadow(o) && !patched.has(o.material)) patch(o.material);
      if (castsBeamShadow(o)) {
        if (Array.isArray(o.material)) { for (const mat of o.material) depthFor(mat); }
        else depthFor(o.material);
      }
    });
  }

  return { draw, warm, uniforms, stats, get size() { return size; }, get patched() { return patched.size; }, dispose: off };
}
