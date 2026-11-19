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
  let target = null, size = 0;
  const patched = new Set(), depths = new Map(), list = [], swapped = [], hidden = [];
  const forget = (e) => patched.delete(e.target);
  const stats = { drawn: false, calls: 0, triangles: 0, casters: 0, receivers: 0 };

  function make(res) {
    target?.dispose(); target?.depthTexture?.dispose();
    const depth = new THREE.DepthTexture(res, res);
    depth.type = THREE.UnsignedIntType;
    depth.compareFunction = THREE.LessEqualCompare;
    depth.minFilter = depth.magFilter = THREE.LinearFilter;
    target = new THREE.WebGLRenderTarget(res, res, { format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: true, depthTexture: depth, generateMipmaps: false });
    size = res;
    uniforms.uBeamShadowMap.value = depth;
  }
  function patch(m) {
    m.defines = m.defines || {};
    m.defines.BEAM_SHADOWS = 1;
    Object.assign(m.uniforms, uniforms);
    m.needsUpdate = true;
    patched.add(m); m.addEventListener('dispose', forget);
  }
  function off() {
    for (const m of patched) { delete m.defines.BEAM_SHADOWS; m.needsUpdate = true; m.removeEventListener('dispose', forget); }
    patched.clear();
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
      d = new THREE.MeshDepthMaterial({ side: m.side, map: cut || null, alphaTest, colorWrite: false,
        polygonOffset: true, polygonOffsetFactor: BEAM_SHADOW.polygonOffset[0], polygonOffsetUnits: BEAM_SHADOW.polygonOffset[1] });
      depths.set(key, d);
    }
    return d;
  }

  /**
   * Once a frame, before the picture is drawn. res: the profile's beamShadows; camera: the visitor's; scenes: the parts
   * that are up (their world.scene); shared: the kit's beam uniforms (uTorch, uTorchOrigin, uTorchDirection, in the
   * camera's space: index.js sets them every frame).
   */
  function draw(res, camera, scenes, shared) {
    stats.drawn = false; stats.calls = stats.triangles = stats.casters = stats.receivers = 0;
    if (renderer?.isWebGPURenderer) return stats;
    res = beamShadowSize(res);
    if (!res) { if (target || patched.size) off(); return stats; }
    const frustum = beamFrustum({ origin: shared.uTorchOrigin.value.toArray(), direction: shared.uTorchDirection.value.toArray() }, res);
    if (!frustum || !(shared.uTorch.value > 0.0001)) { uniforms.uBeamShadowK.value.set(1 / res, 0); return stats; }
    if (size !== res) make(res);

    // what is in view: take the shadow (kit surfaces, once each), throw it, or neither
    list.length = 0;
    for (const s of scenes) s.traverseVisible((o) => { if (o.isMesh) list.push(o); });
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
    if (cam.fov !== frustum.fov) { cam.fov = frustum.fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
    uniforms.uBeamShadowMatrix.value.multiplyMatrices(toPicture, cam.projectionMatrix).multiply(world.copy(pose).invert());
    uniforms.uBeamShadowK.value.set(1 / res, 1);

    const was = renderer.getRenderTarget(), autoClear = renderer.autoClear, info = renderer.info, c0 = info.render.calls, t0 = info.render.triangles;
    renderer.setRenderTarget(target);
    renderer.autoClear = false;
    renderer.state.buffers.depth.setMask(true);            // (a see-through mesh drawn before may have left depth writes off)
    renderer.clear(false, true, false);
    for (const s of scenes) {
      const bg = s.background; s.background = null;
      renderer.render(s, cam);
      s.background = bg;
    }
    renderer.autoClear = autoClear;
    renderer.setRenderTarget(was);
    if (!info.autoReset) { stats.calls = info.render.calls - c0; stats.triangles = info.render.triangles - t0; }
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    for (const o of hidden) o.visible = true;
    swapped.length = hidden.length = 0;
    stats.drawn = true;
    return stats;
  }

  return { draw, uniforms, stats, get size() { return size; }, get patched() { return patched.size; }, dispose: off };
}
