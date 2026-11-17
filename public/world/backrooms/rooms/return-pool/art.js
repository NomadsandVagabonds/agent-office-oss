import * as THREE from 'three';
import { Batch, lin, ticks, WHITE } from '../../kit.js';
import { Vox, M } from '../../../vox/vox.js';

export function poolTextures(kit) {
  const tile = (key, colors) => kit.tex.custom('return-pool:' + key, 128, 128, g => {
    g.fillStyle = '#666f67'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const n = (x * 31 + y * 17 + x * y * 7) % colors.length;
      g.fillStyle = colors[n]; g.fillRect(x * 8 + 1, y * 8 + 1, 7, 7);
      g.fillStyle = '#d7e6c52b'; g.fillRect(x * 8 + 1, y * 8 + 1, 6, 1);
      if ((x * 13 + y * 19) % 43 === 0) { g.fillStyle = '#53675c'; g.fillRect(x * 8 + 3, y * 8 + 4, 4, 1); }
    }
  });
  const water = kit.tex.custom('return-pool:water', 128, 128, g => {
    g.fillStyle = '#256a60'; g.fillRect(0, 0, 128, 128);
    // Tileable interference, not a photo or a screen-space overlay.
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const a = Math.sin(x * Math.PI / 16 + 1.7 * Math.sin(y * Math.PI / 32));
      const b = Math.sin(y * Math.PI / 16 + 1.7 * Math.sin(x * Math.PI / 32));
      const n = Math.pow(Math.max(0, 1 - Math.abs(a + b) * 3), 3);
      g.fillStyle = `rgba(165,230,187,${.08 + n * .48})`; g.fillRect(x, y, 1, 1);
    }
  });
  const sign = (key, text, bg = '#d3d8ba', ink = '#294e43') => kit.tex.custom('return-pool:sign:' + key, 512, 128, g => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128); g.strokeStyle = ink; g.lineWidth = 5; g.strokeRect(8, 8, 496, 112);
    g.fillStyle = ink; g.font = 'bold 58px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  }, { clamp: true });
  return { tile: tile('ivory', ['#c2d1bd', '#b5c9b9', '#cdd8bc', '#adbfab', '#d7ddc8']),
    deep: tile('deep', ['#466d67', '#638e80', '#749c8a', '#3c6d65', '#99b5a0']),
    water, sign };
}

export function tiledPlane(batch, x0, z0, x1, z1, y, down = false) {
  const z = down ? z0 : z1, dz = down ? 1 : -1;
  batch.grid([x0, y, z], [1, 0, 0], [0, 0, dz], ticks(x1 - x0), ticks(z1 - z0), (u, v) => [u / 1.6, v / 1.6], WHITE);
}

export function waterMesh(c, tex, x0, z0, x1, z1, y, down = false) {
  const batch = new Batch(); tiledPlane(batch, x0, z0, x1, z1, y, down);
  const group = new THREE.Group(); c.add(group);
  const phase = { value: 0 };
  c.after.push(() => {
    const material = c.kit.surface({ map: tex, room: c.rt.u, alpha: .63, side: THREE.DoubleSide });
    material.uniforms.uPoolTime = phase;
    material.fragmentShader = 'uniform float uPoolTime;\n' + material.fragmentShader.replace('texture2D(map, vUv)',
      'texture2D(map, vUv + vec2(uPoolTime * 0.018, sin(uPoolTime * 0.22) * 0.035))');
    const mesh = new THREE.Mesh(c.kit.geometry(batch, c.rt.lights, c.rt.amb), material);
    mesh.renderOrder = 4; group.add(mesh);
  });
  return { group, phase };
}

export function valveVox() {
  const v = new Vox(), red = M('#a95235', 0), dark = M('#4f5c51', 0), metal = M('#a7b5a4', 0);
  v.ring(0, 0, 0, 13, 2, red, 'z'); v.cyl('z', 0, 0, -3, 7, 3, dark);
  v.box(-12, -1, -1, 12, 1, 1, metal); v.box(-1, -12, -1, 1, 12, 1, metal);
  return v;
}

// Little voxel furniture built at full office scale, used only when the live
// catalogue is absent (tests and standalone samples).
export function deskVox() {
  const v = new Vox(), wood = M('#a6a785', 0), steel = M('#5e716a', 0), caseM = M('#c4c1a3', 0), screen = M('#172d27', 0);
  v.box(-26, 27, -15, 26, 30, 15, wood);
  for (const x of [-23, 21]) for (const z of [-12, 10]) v.box(x, 0, z, x + 2, 27, z + 2, steel);
  v.box(-8, 30, -9, 8, 44, 4, caseM); v.box(-6, 33, 4, 6, 42, 5, screen);
  v.box(-9, 30, 7, 9, 31, 12, caseM); return v;
}

export function officeDesk(c, x, z, y, flip = false, rot = 0) {
  const opt = { y, flip, rot, solid: !flip, shadow: false, batch: c.vox };
  if (c.hasProp('desk')) {
    c.prop('desk', x, z, opt);
    if (c.hasProp('crt')) c.prop('crt', x, z, { ...opt, y: y + (flip ? -.76 : .76) });
  } else c.model('return-pool:desk', deskVox, x, z, opt);
}

export function wakeRig(c) {
  const group = new THREE.Group(), dark = lin('#102d25'), cream = lin('#c6e4c7'); c.add(group);
  const rings = [], fins = [];
  // Three broken, angular ripples; no visible creature gives away its shape.
  for (let i = 0; i < 3; i++) {
    const b = new Batch();
    for (let k = 0; k < 16; k++) {
      if ((k + i) % 5 === 0) continue;
      const a = k * Math.PI / 8, next = a + .3, r = .38 + i * .22;
      b.quad([Math.cos(a)*r,0,Math.sin(a)*r],[Math.cos(next)*r,0,Math.sin(next)*r],
        [Math.cos(next)*(r+.025),0,Math.sin(next)*(r+.025)],[Math.cos(a)*(r+.025),0,Math.sin(a)*(r+.025)], cream);
    }
    const holder = c.dynamic(b, { side: THREE.DoubleSide }); group.add(holder); rings.push(holder);
  }
  const b = new Batch();
  // A suggestion of a long hand, glimpsed below the wake. The five fingers
  // are uneven and jointed; the visitor never gets a full body to identify.
  b.box(-.12,-.16,-.85,.12,-.08,-.1,dark);b.box(-.23,-.13,-.18,.23,-.065,.2,dark);
  for(let i=0;i<5;i++) {
    const x=-.25+i*.115, length=.25+(i%3)*.13;
    b.box(x,-.12,.12,x+.065,-.075,.12+length,dark);
    b.box(x+.025,-.14,.1+length,x+.09,-.09,.26+length,dark);
  }
  const fin = c.dynamic(b); group.add(fin); fins.push(fin); group.visible = false;
  return { group, rings, fins };
}
