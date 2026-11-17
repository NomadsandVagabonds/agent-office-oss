// The camcorder's saved settings. Pure rules, shared with tests; storage stays
// with the visit. Older saves only have vhs and mute, and still read as before.
import { cleanDifficulty, DEFAULT_DIFFICULTY } from './difficulty.mjs';
// (the same list as public/world/backrooms/graphics.js GRAPHICS, which says what each one switches; a test holds them equal)
export const BACKROOMS_GRAPHICS = Object.freeze(['classic', 'low', 'medium', 'high', 'auto']);
export const BACKROOMS_DEFAULTS = Object.freeze({
  difficulty: DEFAULT_DIFFICULTY, vhs: 2, mute: false, musicVolume: 1, sfxVolume: 1, sensitivity: 1, invertY: false, steadyLighting: false, graphics: 'classic',
});

export function cleanBackroomsSettings(value) {
  const p = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const number = (key, low, high) => typeof p[key] === 'number' && Number.isFinite(p[key])
    ? Math.max(low, Math.min(high, p[key])) : BACKROOMS_DEFAULTS[key];
  return {
    difficulty: cleanDifficulty(p.difficulty),
    vhs: [0, 1, 2].includes(p.vhs) ? p.vhs : BACKROOMS_DEFAULTS.vhs,
    mute: p.mute === true,
    musicVolume: number('musicVolume', 0, 1), sfxVolume: number('sfxVolume', 0, 1),
    sensitivity: number('sensitivity', .25, 2), invertY: p.invertY === true, steadyLighting: p.steadyLighting === true,
    graphics: BACKROOMS_GRAPHICS.includes(p.graphics) ? p.graphics : BACKROOMS_DEFAULTS.graphics,
  };
}
