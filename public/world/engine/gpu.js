// The Office — which renderer the stage draws with, and what code that has two
// ways of drawing reads to pick one.
//
// WebGL (three.js WebGLRenderer) is what everything is written for, and it is
// what the stage makes unless somebody asks for the other one. WebGPU (three.js
// WebGPURenderer, with node materials) is opt-in while the port is under way
// (docs/BLOCKROOMS-WEBGPU.md):
//
//   ?gpu=webgpu          on the play page's address (site.js; the dev page and the office do not ask yet)
//   ?gpu=webgl           the old renderer, whatever is stored
//   localStorage['blockrooms.renderer'] = 'webgpu'
//                        the stored choice, for a shell (the Steam build) to set
//                        before the page loads; the address wins over it
//
// WebGPURenderer falls back to its own WebGL 2 backend where there is no WebGPU
// adapter, so 'webgpu' always means node materials, and `gpu.backend` says which
// backend they ended up on.
//
// Nothing here imports three.js: on the default path this module is a few bytes
// and the WebGPU build is never fetched.

/** The renderers there are, by name. */
export const RENDERERS = Object.freeze(['webgl', 'webgpu']);
export const DEFAULT_RENDERER = 'webgl';
export const RENDERER_KEY = 'blockrooms.renderer';

/**
 * The renderer asked for. `query`: the page's search params (or anything with get/has) · `stored`: what a shell left
 * in storage under RENDERER_KEY. The address wins; anything not in RENDERERS is the default.
 * @returns {'webgl'|'webgpu'}
 */
export function rendererChoice(query, stored) {
  const asked = query?.get?.('gpu');
  if (RENDERERS.includes(asked)) return asked;
  return RENDERERS.includes(stored) ? stored : DEFAULT_RENDERER;
}

/** What the page asked for, from its own address and storage. Never throws (private windows, no window). */
export function pageRendererChoice() {
  let query = null, stored = null;
  try { query = new URLSearchParams(globalThis.location?.search || ''); } catch { /* no page */ }
  try { stored = globalThis.localStorage?.getItem(RENDERER_KEY) ?? null; } catch { /* no storage */ }
  return rendererChoice(query, stored);
}

/**
 * The stage's renderer, once it has one. `nodes` is the three.js WebGPU build (its classes and its `TSL`) while the
 * stage draws with WebGPURenderer, else null: code with a node path checks `gpu.nodes` and otherwise does exactly what
 * it did before. `backend`: 'webgl' (WebGLRenderer), 'webgpu' or 'webgl2' (WebGPURenderer on its WebGPU or its WebGL 2
 * backend).
 */
export const gpu = { renderer: 'webgl', backend: 'webgl', nodes: null };

/** For the stage only: say what it made. */
export function setGpu(next) { Object.assign(gpu, next); }
