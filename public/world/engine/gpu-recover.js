// The Office — what the stage does when the WebGPU renderer loses its device (?gpu=webgpu: engine/gpu.js).
//
// A device can be lost at the start (a driver, or a software adapter, that cannot show a picture on the page) or at
// any time after (a driver reset, the GPU process restarting, the laptop switching GPUs). Either way the visit goes on:
// the stage stops drawing, tries the next thing in RECOVERY_STEPS, and draws again as soon as one of them gives it a
// device that holds. The renderer, its materials and the visit are the same throughout (engine/stage.js swaps only the
// renderer's backend), so nothing the game holds is let go.
//
// This file is only the order and the bookkeeping, with no three.js and no page, so a test can drive it.

/**
 * After a loss: a fresh WebGPU device on the same canvas; then the WebGL 2 backend on a canvas of its own; once more,
 * if that canvas is lost too. Nothing after that: a stage that cannot keep any device says so (`failed`).
 */
export const RECOVERY_STEPS = Object.freeze(['webgpu', 'webgl2', 'webgl2']);

/**
 * @param {{attempt:(kind:string)=>Promise<boolean>, onChange?:(state:string, info?:object)=>void, steps?:readonly string[]}} o
 *        attempt(kind): put that backend in and show one frame with it → whether it took. A loss reported (lost())
 *        while an attempt is running fails that attempt, however it ends.
 * @returns {{lost(info?:object):Promise<string|null>, readonly state:string, readonly drawing:boolean, readonly settled:Promise<string|null>}}
 *          state: 'ok' (as it started), 'recovering', a step that took ('webgpu' | 'webgl2'), or 'failed'
 */
export function createRecovery({ attempt, onChange = () => {}, steps = RECOVERY_STEPS }) {
  let state = 'ok', tried = 0, running = null, lostDuring = false, last = null;
  async function run(info) {
    state = 'recovering'; onChange(state, info);
    while (tried < steps.length) {
      const kind = steps[tried++];
      lostDuring = false;
      let took = false;
      try { took = !!(await attempt(kind)); } catch { took = false; }
      if (took && !lostDuring) { state = kind; onChange(state); return kind; }
    }
    state = 'failed'; onChange(state);
    return null;
  }
  return {
    /** The renderer says its device is gone. A second word while recovering fails the attempt under way, no more. */
    lost(info) {
      if (running) { lostDuring = true; return running; }
      running = last = run(info).finally(() => { running = null; });
      return running;
    },
    get state() { return state; },
    /** Whether the stage may draw: not while recovering, and not once nothing is left to try. */
    get drawing() { return state !== 'recovering' && state !== 'failed'; },
    get settled() { return running || last || Promise.resolve(state); },
  };
}
