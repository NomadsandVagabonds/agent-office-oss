// The Backrooms — camcorder optical/electronic adaptation (pure, no three.js).
// Models three subtle 1990s/2000s Hi8/MiniDV behaviours when stepping between dark and lit spaces,
// crossing into differently coloured rooms, or catching a sudden tube flicker / flashlight toggle:
//   1. Auto-iris / AGC lag (exposure): briefly blooms dark -> bright, briefly crushes bright -> dark, then settles to 1.
//   2. Auto white balance (balance): lags behind the room's colour temperature (and drifts cool-slate in near darkness),
//      giving a realistic warm-fluorescent or cool-shadow cast for ~1.4 s before settling back to [1, 1, 1].
//   3. Contrast-detect autofocus hunt (defocus): a quick 2-bump optical focus breathe (~0.68 s) on sharp light or
//      room-transition shocks, with a cooldown so steady flicker never leaves the picture permanently blurred.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

export const CAMCORDER_ADAPT = Object.freeze({
  minLight: 0.014,
  fastTau: 0.11,         // s — instantaneous sensor metering
  irisCloseTau: 0.55,    // s — iris stops down dark -> bright
  irisOpenTau: 0.95,     // s — AGC boosts bright -> dark
  irisStrength: 0.46,    // stops of transient exposure lag per stop of luminance jump
  irisMin: 0.62,
  irisMax: 1.72,
  awbTau: 1.55,          // s — white-balance convergence time constant
  awbStrength: 0.68,     // transient chroma shift strength (always settles to 1, 1, 1)
  awbMin: 0.84,
  awbMax: 1.18,
  afTriggerStops: 0.36,  // luminance shock (stops) to trigger an autofocus hunt anywhere
  afRoomTrigger: 0.16,   // lower luminance shock threshold when crossing a room threshold
  afChromaTrigger: 0.10, // colour-temperature shift threshold when crossing rooms
  afDuration: 0.78,      // s — two-bump contrast-detect focus hunt
  afCooldown: 0.95,      // s — minimum gap between new hunts
  torchLight: 0.065,     // small bounce contribution when the flashlight snaps on/off
  darkTint: Object.freeze([0.84, 0.97, 1.18]),
  litFallback: Object.freeze([1.06, 1.01, 0.86]),
});

/**
 * Normalized RGB chroma that the camcorder's white-balance sensor measures for a spot.
 * In near-darkness, blends toward a cool low-light CCD bias so stepping into a warm lit
 * room creates an authentic warm-fluorescent settle (and stepping into darkness cools briefly).
 * @param {number} light
 * @param {number[]|null} [rgb]
 * @returns {[number, number, number]}
 */
export function targetChroma(light, rgb = null) {
  let r, g, b;
  if (rgb && rgb.length >= 3) {
    const l = luma(rgb[0], rgb[1], rgb[2]);
    if (l > 0.008) {
      r = clamp(rgb[0] / l, 0.65, 1.45);
      g = clamp(rgb[1] / l, 0.65, 1.45);
      b = clamp(rgb[2] / l, 0.65, 1.45);
    }
  }
  if (r === undefined) [r, g, b] = CAMCORDER_ADAPT.litFallback;
  const darkMix = smoothstep(0.24, 0.04, light);
  const dt = CAMCORDER_ADAPT.darkTint;
  const mr = r + (dt[0] - r) * darkMix;
  const mg = g + (dt[1] - g) * darkMix;
  const mb = b + (dt[2] - b) * darkMix;
  const ml = Math.max(luma(mr, mg, mb), 0.001);
  return [mr / ml, mg / ml, mb / ml];
}

/**
 * Two-bump contrast-detect autofocus curve for normalized time u in [0, 1].
 * Starts and ends smoothly at 0: main search pulse peaking around u = 0.28,
 * quick pull near sharp around u = 0.58, then a subtle confirmation pulse before locking.
 * @param {number} u
 * @returns {number}
 */
export function focusHuntCurve(u) {
  if (u <= 0 || u >= 1) return 0;
  const main = Math.exp(-Math.pow((u - 0.27) / 0.16, 2));
  const check = 0.34 * Math.exp(-Math.pow((u - 0.74) / 0.11, 2));
  const env = smoothstep(0, 0.08, u) * smoothstep(1, 0.90, u);
  return clamp((main + check) * env, 0, 1);
}

/** Create a fresh camcorder adaptation state (starts settled on the first sample). */
export function createCamcorderAdapt() {
  return {
    ready: false,
    fastLogL: Math.log2(0.3),
    irisLogL: Math.log2(0.3),
    awb: [1, 1, 1],
    roomId: null,
    afT: 0,
    afAmp: 0,
    afCool: 0,
    exposure: 1,
    balance: [1, 1, 1],
    defocus: 0,
  };
}

/** Snap back to neutral on the next sample (floor changes, teleports, preset loads). */
export function resetCamcorderAdapt(state) {
  state.ready = false;
  state.afT = 0;
  state.afAmp = 0;
  state.afCool = 0;
  state.exposure = 1;
  state.balance[0] = 1;
  state.balance[1] = 1;
  state.balance[2] = 1;
  state.defocus = 0;
  return state;
}

/**
 * Advance the camcorder adaptation state by `dt` seconds.
 * @param {ReturnType<typeof createCamcorderAdapt>} state
 * @param {{ light?: number, rgb?: number[]|null, roomId?: string|number|null, torch?: number }} sample
 * @param {number} dt
 */
export function stepCamcorderAdapt(state, sample, dt) {
  const C = CAMCORDER_ADAPT;
  const rawLight = Number.isFinite(sample?.light) ? sample.light : 0.3;
  const torch = Number.isFinite(sample?.torch) ? clamp(sample.torch, 0, 1) : 0;
  const effLight = Math.max(C.minLight, rawLight + torch * C.torchLight);
  const logL = Math.log2(effLight);
  // Use ambient room light (before flashlight fill) for dark CCD cool bias so carrying a torch
  // in a dark room still produces an authentic white-balance shift when entering a lit room.
  const sceneC = targetChroma(Math.max(C.minLight, rawLight), sample?.rgb || null);

  if (!state.ready) {
    state.fastLogL = logL;
    state.irisLogL = logL;
    state.awb[0] = sceneC[0];
    state.awb[1] = sceneC[1];
    state.awb[2] = sceneC[2];
    state.roomId = sample?.roomId ?? null;
    state.ready = true;
    state.afT = 0;
    state.afAmp = 0;
    state.afCool = 0;
    state.exposure = 1;
    state.balance[0] = 1;
    state.balance[1] = 1;
    state.balance[2] = 1;
    state.defocus = 0;
    return state;
  }

  const h = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.15);
  if (h <= 0) return state;

  // 1. Auto-iris / AGC lag
  state.fastLogL += (logL - state.fastLogL) * (1 - Math.exp(-h / C.fastTau));
  const irisTau = state.fastLogL > state.irisLogL ? C.irisCloseTau : C.irisOpenTau;
  state.irisLogL += (state.fastLogL - state.irisLogL) * (1 - Math.exp(-h / irisTau));
  const deltaLog = state.fastLogL - state.irisLogL;
  state.exposure = clamp(Math.pow(2, deltaLog * C.irisStrength), C.irisMin, C.irisMax);

  // 2. Auto white-balance drift & settle (luminance-neutral so it never fights exposure)
  const ka = 1 - Math.exp(-h / C.awbTau);
  for (let i = 0; i < 3; i++) state.awb[i] += (sceneC[i] - state.awb[i]) * ka;
  const r0 = sceneC[0] / Math.max(state.awb[0], 0.35);
  const r1 = sceneC[1] / Math.max(state.awb[1], 0.35);
  const r2 = sceneC[2] / Math.max(state.awb[2], 0.35);
  const rL = Math.max(luma(r0, r1, r2), 0.001);
  state.balance[0] = clamp(1 + (r0 / rL - 1) * C.awbStrength, C.awbMin, C.awbMax);
  state.balance[1] = clamp(1 + (r1 / rL - 1) * C.awbStrength, C.awbMin, C.awbMax);
  state.balance[2] = clamp(1 + (r2 / rL - 1) * C.awbStrength, C.awbMin, C.awbMax);

  // 3. Contrast-detect autofocus hunt on luminance or room-transition shock
  const chromaDelta = Math.abs(sceneC[0] - state.awb[0]) + Math.abs(sceneC[2] - state.awb[2]);
  const roomChanged = sample?.roomId != null && state.roomId != null && sample.roomId !== state.roomId;
  if (sample?.roomId != null) state.roomId = sample.roomId;
  const shock = Math.abs(deltaLog);
  if (state.afCool > 0) state.afCool = Math.max(0, state.afCool - h);

  const triggered = state.afCool <= 0 && (
    shock >= C.afTriggerStops ||
    (roomChanged && (shock >= C.afRoomTrigger || chromaDelta >= C.afChromaTrigger))
  );
  if (triggered) {
    const amp = clamp((Math.max(shock, chromaDelta * 1.45) - 0.12) / 1.35, 0.42, 1.0);
    if (state.afT > 0 && state.afT < C.afDuration) {
      state.afAmp = Math.max(state.afAmp, amp);
    } else {
      state.afT = 0.0001;
      state.afAmp = amp;
      state.afCool = C.afCooldown;
    }
  }

  if (state.afT > 0) {
    state.afT += h;
    if (state.afT >= C.afDuration) {
      state.afT = 0;
      state.afAmp = 0;
      state.defocus = 0;
    } else {
      state.defocus = state.afAmp * focusHuntCurve(state.afT / C.afDuration);
    }
  } else {
    state.defocus = 0;
  }

  return state;
}
