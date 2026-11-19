// High-detail 3D Backrooms props, photographed once for the camcorder's inventory.
// Only a fixed set of small PNGs survives this pass; no renderer is kept alive.
import * as THREE from 'three';
import { ICON_MODELS, buildItemGeometry } from './inventory-items.js';

const SIZE = 160, FILL = 0.86;
const ICON_YAW = Object.freeze({
  torch: 0.24,
  'torch-prepared': 0.28,
  battery: 0.18,
  chalk: 0.25,
  paper: 0.12,
  'pink-slip': 0.14,
  scissors: 0.22,
  snack: 0.28,
  balloon: -0.35,
  lighter: 0.36,
  tape: 0.22,
  opener: 0.22,
  extinguisher: 0.5,
  flamingo: -0.4,
  camera: -0.32,
});

// Bounded by ICON_MODELS, independent of IDs, charge, stack count or visit count.
const images = Object.create(null);
let attempted = false;

function fitCamera(view, mesh) {
  const box = new THREE.Box3().setFromObject(mesh), center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()), extent = Math.max(size.x, size.y, size.z) * 0.82;
  if (!Number.isFinite(extent) || extent <= 0) return false;
  view.left = view.bottom = -extent; view.right = view.top = extent;
  view.updateProjectionMatrix();
  view.position.copy(center).add(new THREE.Vector3(2, 2.7, -3)); view.lookAt(center); view.updateMatrixWorld();
  // Fit the projected bounds, so a flat paper pile and a long torch fill the
  // same useful area without stretching either object's native proportions.
  let projected = 0;
  const point = new THREE.Vector3();
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    point.set(x, y, z).project(view);
    projected = Math.max(projected, Math.abs(point.x), Math.abs(point.y));
  }
  const fit = extent * projected / FILL;
  if (!Number.isFinite(fit) || fit <= 0) return false;
  view.left = view.bottom = -fit; view.right = view.top = fit; view.updateProjectionMatrix();
  return true;
}

function renderImages() {
  if (attempted || typeof document === 'undefined') return;
  attempted = true;
  let canvas, context, renderer, material;
  try {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    let attributes = { alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' };
    // Preflight before constructing Three's renderer: a denied/lost WebGL
    // context uses the SVG fallback without Three logging a creation error.
    context = canvas.getContext('webgl2', attributes);
    if (!context) {
      attributes = { ...attributes, antialias: false };
      context = canvas.getContext('webgl2', attributes);
    }
    if (!context || context.isContextLost()) return;
    renderer = new THREE.WebGLRenderer({ canvas, context, ...attributes });
    let shaderFailed = false;
    renderer.debug.onShaderError = () => { shaderFailed = true; };
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff6df', '#4d5248', 1.9));
    const key = new THREE.DirectionalLight('#fff4d8', 2.7); key.position.set(-3.2, 6.2, -4.2); scene.add(key);
    const rim = new THREE.DirectionalLight('#cfe2ff', 1.15); rim.position.set(3.5, 2.5, 3.8); scene.add(rim);
    const view = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 20);
    material = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const type of Object.keys(ICON_MODELS)) {
      let geometry, mesh;
      try {
        if (context.isContextLost() || shaderFailed) break;
        geometry = buildItemGeometry(THREE, type, { grounded: false, icon: true });
        if (!geometry) continue;
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.y = ICON_YAW[type] ?? 0.18;
        scene.add(mesh);
        if (!fitCamera(view, mesh)) continue;
        renderer.render(scene, view);
        if (context.isContextLost() || shaderFailed) break;
        const url = canvas.toDataURL('image/png');
        if (url.startsWith('data:image/png;base64,')) images[type] = url;
      } catch {
        // A single unsupported prop can fall back without hiding the others.
      } finally {
        if (mesh) scene.remove(mesh);
        geometry?.dispose();
      }
    }
    scene.clear();
  } catch {
    // The inventory remains usable when rendering or image readback is denied.
  } finally {
    material?.dispose();
    // Release GPU allocations even after a failed render or readback. URLs
    // deliberately remain cached across visits; they do not own GPU resources.
    try { renderer?.dispose(); } catch { /* cleanup must not replace fallback */ }
    try { context?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already lost */ }
    if (canvas) canvas.width = canvas.height = 1;
  }
}

/** Each call returns a fresh image node; factories share the bounded PNG cache. */
export function createInventoryIcons() {
  let disposed = false;
  return {
    icon(type, item) {
      if (disposed || typeof document === 'undefined' || typeof type !== 'string' || !Object.hasOwn(ICON_MODELS, type)) return null;
      const key = type === 'torch' && item?.prepared ? 'torch-prepared' : type;
      renderImages();
      if (!images[key]) return null;
      const img = document.createElement('img');
      img.className = 'br-inv-icon'; img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.draggable = false;
      img.width = img.height = SIZE; img.src = images[key];
      return img;
    },
    dispose() { disposed = true; },
  };
}
