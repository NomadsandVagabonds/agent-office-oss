// The Office — the camera: a model-maker's view.
//
// You look at a point on the floor from an angle, like leaning over a
// diorama. Drag to slide the floor under you, right-drag (or shift-drag) to
// walk around it, scroll to lean in. Everything eases, and `flyTo` glides the
// camera to a person or a room.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * @param {object} stage   from createStage()
 * @param {{bounds:{x0:number,z0:number,x1:number,z1:number}}} opt
 */
export function createCameraRig(stage, opt = {}) {
  const { camera, renderer } = stage;
  const el = renderer.domElement;
  let bounds = opt.bounds || { x0: -30, z0: -12, x1: 30, z1: 12 };
  const LIMIT = { minDist: 3.2, maxDist: 150, minPitch: 0.16, maxPitch: 1.5 };

  // where the camera is (cur) and where it is heading (goal)
  const cur = { x: 0, z: 2, yaw: 0, pitch: 0.82, dist: 46, y: 0.6 };
  const goal = { ...cur };
  let follow = null;                       // () => {x, z} | null
  let moved = false;
  const listeners = new Set();

  function fitDistance(width, depth) {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const byWidth = (width / 2) / Math.tan(hfov / 2);
    const byDepth = (depth / 2) / Math.tan(vfov / 2) * 1.25;
    return clamp(Math.max(byWidth, byDepth) * 1.08, LIMIT.minDist, LIMIT.maxDist);
  }

  function place() {
    const cp = Math.cos(cur.pitch), sp = Math.sin(cur.pitch);
    camera.position.set(cur.x + Math.sin(cur.yaw) * cp * cur.dist, cur.y + sp * cur.dist, cur.z + Math.cos(cur.yaw) * cp * cur.dist);
    camera.lookAt(cur.x, cur.y, cur.z);
  }

  function clampGoal() {
    goal.dist = clamp(goal.dist, LIMIT.minDist, LIMIT.maxDist);
    goal.pitch = clamp(goal.pitch, LIMIT.minPitch, LIMIT.maxPitch);
    goal.x = clamp(goal.x, bounds.x0 - 4, bounds.x1 + 4);
    goal.z = clamp(goal.z, bounds.z0 - 4, bounds.z1 + 4);
  }

  /* ---- pointer ----------------------------------------------------------- */
  const ray = new THREE.Raycaster();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function floorPoint(clientX, clientY) {
    const r = el.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
    return ray.ray.intersectPlane(floor, hit) ? hit.clone() : null;
  }

  const pointers = new Map();
  let drag = null;
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rotate = e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey;
    drag = { mode: rotate ? 'rotate' : 'pan', x: e.clientX, y: e.clientY, travelled: 0, grab: rotate ? null : floorPoint(e.clientX, e.clientY), pinch: 0 };
  });
  el.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId) || !drag) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {                                   // pinch to zoom, twist to turn
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (drag.pinch) { goal.dist *= drag.pinch / Math.max(1, d); goal.yaw -= ang - drag.twist; }
      drag.pinch = d; drag.twist = ang; drag.travelled += 10;
      clampGoal(); follow = null;
      return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.travelled += Math.abs(dx) + Math.abs(dy);
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.mode === 'rotate') {
      goal.yaw -= dx * 0.006; goal.pitch += dy * 0.005;
    } else if (drag.grab) {
      // keep the grabbed point of floor under the cursor
      const now = floorPoint(e.clientX, e.clientY);
      if (now) { goal.x += drag.grab.x - now.x; goal.z += drag.grab.z - now.z; cur.x = goal.x; cur.z = goal.z; place(); }
    }
    if (drag.travelled > 4) follow = null;
    clampGoal();
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (drag && drag.travelled < 5 && e.type === 'pointerup') for (const fn of listeners) fn({ type: 'click', x: e.clientX, y: e.clientY, button: e.button, event: e });
    if (!pointers.size) drag = null; else if (drag) drag.pinch = 0;
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.shiftKey) { goal.yaw += e.deltaY * 0.0022; return; }
    const before = floorPoint(e.clientX, e.clientY);
    const k = Math.exp(clamp(e.deltaY, -240, 240) * 0.0014);
    const next = clamp(goal.dist * k, LIMIT.minDist, LIMIT.maxDist);
    if (before && !follow) {                                       // zoom toward what is under the cursor
      const f = 1 - next / goal.dist;
      goal.x += (before.x - goal.x) * f; goal.z += (before.z - goal.z) * f;
    }
    goal.dist = next;
    clampGoal();
  }, { passive: false });

  return {
    cur, goal, LIMIT,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    setBounds(b) { bounds = b; },
    floorPoint,
    /** Frame the whole building. */
    overview(instant = false) {
      follow = null;
      Object.assign(goal, { x: (bounds.x0 + bounds.x1) / 2, z: (bounds.z0 + bounds.z1) / 2 + 1.5, yaw: 0, pitch: 0.86,
        dist: fitDistance(bounds.x1 - bounds.x0 + 4, (bounds.z1 - bounds.z0) * 0.9) });
      if (instant) { Object.assign(cur, goal); place(); }
    },
    /** Glide to a spot. Any of x, z, dist, yaw, pitch; `follow` keeps tracking a moving thing. */
    flyTo(to = {}, o = {}) {
      for (const k of ['x', 'z', 'dist', 'yaw', 'pitch']) if (Number.isFinite(to[k])) goal[k] = to[k];
      follow = typeof o.follow === 'function' ? o.follow : null;
      clampGoal();
      if (o.instant) { Object.assign(cur, goal); place(); }
    },
    /** Fit a rectangle of floor (a room) in view. */
    frame(rect, o = {}) {
      this.flyTo({ x: rect.x + rect.w / 2, z: rect.z + rect.d / 2 + 0.6, dist: fitDistance(rect.w + 1.5, rect.d + 1.5), pitch: o.pitch ?? 0.9, yaw: o.yaw ?? 0 }, o);
    },
    get following() { return !!follow; },
    stopFollowing() { follow = null; },
    update(dt) {
      if (follow) { const p = follow(); if (p) { goal.x = p.x; goal.z = p.z; } else follow = null; }
      const k = 1 - Math.exp(-7.5 * dt);
      // turn the short way round
      let dyaw = goal.yaw - cur.yaw;
      if (Math.abs(dyaw) > Math.PI * 2) { goal.yaw = cur.yaw + (dyaw % (Math.PI * 2)); dyaw = goal.yaw - cur.yaw; }
      cur.x += (goal.x - cur.x) * k; cur.z += (goal.z - cur.z) * k;
      cur.yaw += dyaw * k; cur.pitch += (goal.pitch - cur.pitch) * k;
      cur.dist *= Math.exp(Math.log(goal.dist / cur.dist) * k);
      cur.y = 0.5 + Math.min(0.5, cur.dist * 0.01);
      place();
      moved = Math.abs(goal.x - cur.x) + Math.abs(goal.z - cur.z) + Math.abs(dyaw) + Math.abs(goal.dist - cur.dist) > 0.002;
      return moved;
    },
  };
}
