// The handheld/mounted flashlight and the camcorder's small navigation lamp.
// Only the real flashlight supplies the beam-sensitive creatures' power.
const cos = degrees => Math.cos(degrees * Math.PI / 180);
export const FLASHLIGHT = Object.freeze({
  coreCos: cos(5), edgeCos: cos(18), holdCos: cos(12),
  fadeFrom: 10, range: 14, holdRange: 12, attenuation: .2,
});
export const CAMCORDER_LAMP = Object.freeze({
  coreCos: cos(2), edgeCos: cos(30), fadeFrom: .9, range: 2.2,
  attenuation: .65, power: .09,
  // Slightly below the sight line, so a level camera catches nearby carpet.
  origin: Object.freeze([0, -.04, -.04]),
  direction: Object.freeze([0, -Math.sin(Math.PI / 18), -cos(10)]),
});

/** The automatic lamp eases in as room light falls. Authored no-lamp rooms
 * remain in charge; this is never inventory power or a free monster defense. */
export function camcorderLampPower(light, blocked = false) {
  if (blocked || !Number.isFinite(light)) return 0;
  const t = Math.max(0, Math.min(1, (light - .035) / (.14 - .035)));
  return CAMCORDER_LAMP.power * (1 - t * t * (3 - 2 * t));
}

// Camera-space emitters, aimed to meet the sight line four metres ahead.
// Kept inside the player's collision radius, so pressing against a wall does
// not put the light source through it. The held model can extend farther.
function emitter(origin) {
  const direction = [-origin[0], -origin[1], -4 - origin[2]];
  const length = Math.hypot(...direction);
  return Object.freeze({ origin: Object.freeze(origin), direction: Object.freeze(direction.map(n => n / length)) });
}
export const FLASHLIGHT_POSES = Object.freeze({
  hand: emitter([.15, -.12, -.10]),
  mounted: emitter([.06, -.04, -.08]),
  camera: emitter([0, 0, 0]),
});

const gl = n => n.toFixed(8);
const vec = a => `vec3(${a.map(gl).join(', ')})`;
export const FLASHLIGHT_GLSL = `
uniform vec3 uTorchOrigin;
uniform vec3 uTorchDirection;
float surfaceBeam(vec3 viewPosition, vec3 viewNormal, vec3 origin, vec3 direction, vec2 coneCos, vec2 reach, float attenuation) {
  vec3 offset = viewPosition - origin;
  float d = length(offset);
  vec3 ray = offset / max(d, 0.0001);
  float aim = dot(ray, direction);
  float cone = smoothstep(coneCos.x, coneCos.y, aim);
  float fade = 1.0 - smoothstep(reach.x, reach.y, d);
  float incidence = max(dot(viewNormal, -ray), 0.0);
  return cone * fade * incidence / (1.0 + d * d * attenuation);
}
float flashlightBeam(vec3 viewPosition, vec3 viewNormal) {
  return surfaceBeam(viewPosition, viewNormal, uTorchOrigin, uTorchDirection,
    vec2(${gl(FLASHLIGHT.edgeCos)}, ${gl(FLASHLIGHT.coreCos)}),
    vec2(${gl(FLASHLIGHT.fadeFrom)}, ${gl(FLASHLIGHT.range)}), ${gl(FLASHLIGHT.attenuation)});
}
float camcorderBeam(vec3 viewPosition, vec3 viewNormal) {
  return surfaceBeam(viewPosition, viewNormal, ${vec(CAMCORDER_LAMP.origin)}, ${vec(CAMCORDER_LAMP.direction)},
    vec2(${gl(CAMCORDER_LAMP.edgeCos)}, ${gl(CAMCORDER_LAMP.coreCos)}),
    vec2(${gl(CAMCORDER_LAMP.fadeFrom)}, ${gl(CAMCORDER_LAMP.range)}), ${gl(CAMCORDER_LAMP.attenuation)});
}`;

/** The shader's emitter transformed into the room's coordinates. */
export function flashlightRay({x, y=1.1, z, yaw=0, pitch=0, mounted=false}) {
  const pose = mounted ? FLASHLIGHT_POSES.mounted : FLASHLIGHT_POSES.hand;
  const sy=Math.sin(yaw), cy=Math.cos(yaw), sp=Math.sin(pitch), cp=Math.cos(pitch);
  const turn=([a,b,c])=>[cy*a+sy*sp*b+sy*cp*c, cp*b-sp*c, -sy*a+cy*sp*b+cy*cp*c];
  const o=turn(pose.origin), direction=turn(pose.direction);
  return {origin:[x+o[0],y+o[1],z+o[2]],direction};
}

/** Test the well-lit portion of the beam, not its nearly invisible outer rim.
 * Targets supply a continuous body-height interval; crouching and pitch count.
 * Power and line of sight are supplied by the visit's actual inventory/world. */
export function inFlashlight(eye, target, {power=0, los=true, bottom=.8, top=1.9, radius=.16, range=FLASHLIGHT.holdRange}={}) {
  if (!(power > .05) || !los) return false;
  const {origin:[x,y,z],direction:[fx,fy,fz]}=flashlightRay(eye);
  const dx=target.x-x,dz=target.z-z,h2=dx*dx+dz*dz,along=dx*fx+dz*fz;
  const low=(target.y||0)+bottom-y,high=(target.y||0)+top-y;
  // Height with the smallest angle to the beam, clamped to the body. Sparse
  // samples leave invisible gaps when passing close to a frozen creature.
  const ideal=along>0?fy*h2/along:fy>=0?high:low;
  const dy=Math.max(low,Math.min(high,ideal)),d=Math.hypot(dx,dy,dz);
  const dot=along+dy*fy;
  // A lit sliver of the torso counts, including when the offset emitter is
  // alongside the figure. Never count something behind the light.
  const angle=Math.acos(Math.max(-1,Math.min(1,dot/Math.max(d,.001))));
  return d>.001 && d<=range && dot>0 && angle<=Math.acos(FLASHLIGHT.holdCos)+Math.asin(Math.min(1,radius/d));
}
