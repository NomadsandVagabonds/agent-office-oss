// Reflect the ceiling fixtures in the municipal pools. The map contains just
// the painted faces of the actual lamps; sampling it costs no second scene draw.
import * as THREE from 'three';

export function ceilingLampMap(c, fixtures, tileSize, key) {
  const map = c.kit.tex.custom('pool:ceiling:' + key, 192, 192, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const sx = w / c.W, sz = h / c.D;
    for (const [x, z] of fixtures) {
      const left = (x - tileSize / 2 + c.W / 2) * sx;
      const top = (c.D / 2 - z - tileSize) * sz;
      for (const offset of [.18, .58]) {
        g.fillStyle = '#e5efdf';
        g.fillRect(left + offset * tileSize * sx, top + .12 * tileSize * sz,
          tileSize * .25 * sx, tileSize * 1.76 * sz);
      }
    }
  }, { clamp: true });
  map.magFilter = THREE.LinearFilter;
  return map;
}

export function basinOptics(c, mat, time, waterY) {
  mat.forceSinglePass = true;
  mat.uniforms.uPoolClock = time;
  mat.uniforms.uPoolCeiling = { value: c.rt.poolLampMap };
  mat.uniforms.uPoolExtent = { value: new THREE.Vector3(c.W, c.H - waterY, c.D) };
  mat.vertexShader = 'varying vec3 vPoolRay;\nvarying vec2 vPoolPoint;\n' + mat.vertexShader.replace(
    'vView = mv.xyz;', `vView = mv.xyz;
    vPoolPoint = position.xz;
    vPoolRay = mv.xyz * mat3(modelViewMatrix);`);
  mat.fragmentShader = `uniform float uPoolClock;
uniform vec3 uPoolExtent;
uniform sampler2D uPoolCeiling;
varying vec2 vPoolPoint;
varying vec3 vPoolRay;
` + mat.fragmentShader.replace('vec4 t = texture2D(map, vUv);', `
    vec2 p = vPoolPoint;
    float t0 = uPoolClock;
    vec2 slope = vec2(
      sin(p.x*5.1 + p.y*2.3 + t0*1.2) + 0.45*sin(p.y*11.1 - t0*1.6),
      cos(p.y*6.3 - p.x*2.6 - t0*.95) + 0.45*sin(p.x*9.3 + t0*1.4)
    ) * .029;
    vec4 t = texture2D(map, vUv + slope*.55 + vec2(.009,-.005)*t0);`)
    .replace('gl_FragColor = vec4(c, uAlpha);', `
    vec3 ray = normalize(vPoolRay);
    vec3 bounce = reflect(ray, normalize(vec3(slope.x, 1., slope.y)));
    float grazing = pow(1. - abs(ray.y), 3.);
    vec2 ceiling = (p + bounce.xz * (uPoolExtent.y / max(bounce.y,.04))) / uPoolExtent.xz + .5;
    float light = texture2D(uPoolCeiling, clamp(ceiling, 0., 1.)).g;
    float roomLight = clamp(dot(vLit, vec3(.3,.5,.2)), 0., 1.);
    c += vec3(.77,.88,.82) * light * (.22 + .95*grazing) * roomLight * step(.04,bounce.y) * float(gl_FrontFacing);
    gl_FragColor = vec4(c, min(.88, uAlpha * (.72 + .76*grazing))); `);
}
