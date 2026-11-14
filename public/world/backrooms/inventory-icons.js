// Native Office props, photographed once for the camcorder's inventory.
// Only a fixed set of small PNGs survives this pass; no renderer is kept alive.
import * as THREE from 'three';
import { voxObject } from '../vox/material.js';
import { Vox, M } from '../vox/vox.js';
import { INVENTORY_MODELS } from './inventory-items.js';

const SIZE = 144, FILL = .85;

function preparedTorch() {
  // Modify a fresh model, not the shared world prop or its material. The
  // raised grey wrap and folded end remain readable at pocket-icon size.
  const v = INVENTORY_MODELS.torch();
  const tape = M('#929b96', 1), edge = M('#c5c8b8', 1), fold = M('#737e78', 1);
  v.box(-4, 0, 2, 4, 7, 5, tape);
  v.box(-4, 6, 2, 4, 7, 3, edge);
  v.box(3, 2, 3, 5, 6, 6, fold);
  v.box(4, 4, 4, 5, 6, 6, edge);
  return v;
}

function camcorder() {
  const v = new Vox(), plastic = M('#444c43', 2), edge = M('#72786b', 1), black = M('#1f2926', 1);
  v.rbox(-6, 1, -6, 6, 9, 8, 1, plastic); v.box(-5, 2, 7, 5, 8, 9, edge);
  v.rbox(-4, 2, -11, 4, 8, -6, 1, black); v.box(-3, 3, -12, 3, 7, -11, M('#8b998e', 0));
  v.box(-2, 9, -2, 3, 11, 7, black); v.box(-8, 4, -2, -6, 7, 6, edge);
  v.box(-8, 5, -1, -7, 6, 5, M('#c5c8ac', 0));
  return v;
}

const MODELS = Object.freeze({ ...INVENTORY_MODELS, 'torch-prepared': preparedTorch, camera: camcorder });
// Bounded by MODELS, independent of IDs, charge, stack count or visit count.
const images = Object.create(null);
let attempted = false;

function fitCamera(view, mesh) {
  const box = new THREE.Box3().setFromObject(mesh), center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()), extent = Math.max(size.x, size.y, size.z) * .82;
  if (!Number.isFinite(extent) || extent <= 0) return false;
  view.left = view.bottom = -extent; view.right = view.top = extent;
  view.updateProjectionMatrix();
  view.position.copy(center).add(new THREE.Vector3(2, 3, -3)); view.lookAt(center); view.updateMatrixWorld();
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
  let canvas, context, renderer;
  try {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const attributes = { alpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' };
    // Preflight before constructing Three's renderer: a denied/lost WebGL
    // context uses the SVG fallback without Three logging a creation error.
    context = canvas.getContext('webgl2', attributes);
    if (!context || context.isContextLost()) return;
    renderer = new THREE.WebGLRenderer({ canvas, context, ...attributes });
    let shaderFailed = false;
    renderer.debug.onShaderError = () => { shaderFailed = true; };
    renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffedc7', '#73765c', 2));
    const key = new THREE.DirectionalLight('#fff0cd', 3); key.position.set(-3, 6, -4); scene.add(key);
    const view = new THREE.OrthographicCamera(-.5, .5, .5, -.5, .01, 20);
    for (const [type, model] of Object.entries(MODELS)) {
      let mesh;
      try {
        if (context.isContextLost() || shaderFailed) break;
        // No cache key: these geometries belong solely to this render pass.
        mesh = voxObject(model, { lod: false }); mesh.rotation.y = .15; scene.add(mesh);
        if (!fitCamera(view, mesh)) continue;
        renderer.render(scene, view);
        if (context.isContextLost() || shaderFailed) break;
        const url = canvas.toDataURL('image/png');
        if (url.startsWith('data:image/png;base64,')) images[type] = url;
      } catch {
        // A single unsupported prop can fall back without hiding the others.
      } finally {
        if (mesh) {
          scene.remove(mesh);
          const owned = new Set();
          mesh.traverse(object => { if (object.geometry) owned.add(object.geometry); });
          for (const geometry of owned) geometry.dispose();
          // voxObject uses the office's shared materials: never dispose them.
        }
      }
    }
    scene.clear();
  } catch {
    // The inventory remains usable when rendering or image readback is denied.
  } finally {
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
      if (disposed || typeof document === 'undefined' || typeof type !== 'string' || !Object.hasOwn(MODELS, type)) return null;
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
