// The Backrooms — bloom from what shines (glow.js, graphics.js `glow`): the numbers and the shader text that let the
// emissive picture draw only what shines and take its hiding from the scene's own depth. No three.js in here: the
// tests read it, kit.js inserts the shader text into its fragment shader (only compiled where EMISSIVE_BLOOM and
// EMISSIVE_BLOOM_DEPTH are both defined, which only glow.js's stand-ins have), and glow.js puts the same text into the
// stand-ins of what shines.
//
// At Medium and High the camcorder keeps a depth texture of the scene it has just drawn (vhs.js, for the haze; held
// things are written into its nearest sliver: hand.js holdInFront). A fragment of something that shines is left out of
// the emissive picture when the scene's depth at its pixel is nearer than it by more than a little: a wall, a copier, a
// hand or a door frame in front of a tube hides it without being drawn again. The emissive picture is half the scene's
// size (and the scene may be drawn larger still and smoothed), so the scene's depth is read at four points a quarter of
// one of its pixels from the middle, and the nearest kept; and the margin grows with distance, so that a ceiling seen
// at a slant does not hide its own tubes.

export const GLOW_DEPTH = Object.freeze({
  share: 0.01,        // of the fragment's own distance: what it may be behind the scene's depth and still shine
  metres: 0.02,       // and this much more, at any distance
  tap: 0.25,          // the four reads, in pixels of the emissive picture from its middle
});

/**
 * How much of the bloom one shining batch makes (kit.glowing's and c.shining's option `bloom`, carried as the material's
 * userData.bloom next to userData.glow): a number, 1 unless given, held to 0…3; anything that is not a number is 1.
 * glow.js scales what that batch draws into the emissive picture by it, on top of its class's own share (a picture's
 * `over`), and never how the batch is drawn in the scene. 0: it adds nothing to the bloom.
 */
export const GLOW_STRENGTH = Object.freeze({ fallback: 1, min: 0, max: 3 });
export const glowStrength = (v, k = GLOW_STRENGTH) =>
  (typeof v === 'number' && !Number.isNaN(v) ? Math.min(k.max, Math.max(k.min, v)) : k.fallback);

/** Does a fragment at linear distance z shine, against the nearest of the scene's depths read at its pixel (zs)? */
export const glowVisible = (z, zs, k = GLOW_DEPTH) => !(z > zs + z * k.share + k.metres);

/** A depth of the depth picture (0…1) as a distance, for a camera's near and far: as vhs.js's haze does. */
export const glowLinear = (d, near, far) => (near * far) / (far - d * (far - near));

const gl = (n) => Number(n).toFixed(6);
export const GLOW_DEPTH_GLSL = `#if defined(EMISSIVE_BLOOM) && defined(EMISSIVE_BLOOM_DEPTH)
uniform sampler2D tGlowDepth;
uniform vec4 uGlowDepth;
float glowLinear(float d) { return uGlowDepth.z * uGlowDepth.w / (uGlowDepth.w - d * (uGlowDepth.w - uGlowDepth.z)); }
// uGlowDepth: 1 / the emissive picture's size (x, y); the camera's near (z) and far (w)
bool glowHidden() {
  vec2 uv = gl_FragCoord.xy * uGlowDepth.xy, q = uGlowDepth.xy * ${gl(GLOW_DEPTH.tap)};
  float d = min(min(texture2D(tGlowDepth, uv + vec2(-q.x, -q.y)).x, texture2D(tGlowDepth, uv + vec2(q.x, -q.y)).x),
                min(texture2D(tGlowDepth, uv + vec2(-q.x, q.y)).x, texture2D(tGlowDepth, uv + vec2(q.x, q.y)).x));
  float z = glowLinear(gl_FragCoord.z);
  return z > glowLinear(d) + z * ${gl(GLOW_DEPTH.share)} + ${gl(GLOW_DEPTH.metres)};
}
#endif`;
