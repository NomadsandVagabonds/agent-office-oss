// The Office — which renderer the stage draws with, and what code that has two
// ways of drawing reads to pick one.
//
// WebGPU (three.js WebGPURenderer, with node materials) is what the stage makes unless somebody asks for the other
// one: the owner, 20 Nov, "I would rather some percentage of people not be able to play than to lower the experience
// for those that do". Where there is no WebGPU adapter, WebGPURenderer draws on its own WebGL 2 backend; where there is
// neither, the play page says so (backrooms/launch.js cantRun). WebGL (three.js WebGLRenderer) is what everything was
// first written for, and stays as the escape hatch (docs/BLOCKROOMS-WEBGPU.md):
//
//   ?gpu=webgl           the old renderer, whatever is stored
//   ?gpu=webgpu          the new one, whatever is stored
//   localStorage['blockrooms.renderer'] = 'webgl' | 'webgpu'
//                        the stored choice, for a shell (the Steam build) to set
//                        before the page loads; the address wins over it
//
// 'webgpu' always means node materials, and `gpu.backend` says which backend they ended up on.
//
// Nothing here imports three.js: the stage fetches the build it is asked for.

/** The renderers there are, by name. */
export const RENDERERS = Object.freeze(['webgl', 'webgpu']);
export const DEFAULT_RENDERER = 'webgpu';
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
