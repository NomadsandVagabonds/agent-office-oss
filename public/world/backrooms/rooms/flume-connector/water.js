import * as THREE from 'three';
import { Batch, lin } from '../../kit.js';
import { sampleFlumeFrames } from '../../waterpark.rule.js';
import { AXIS_Y, BEACH_WATER, TUBE_RADIUS } from './plan.js';

const WATER = lin('#73afa9');
const TREAD_FILM = .018;

// Put flow distance in the UVs so the highlights follow bends at a steady rate.
function ribbon(batch, path) {
  let distance = 0;
  const edges = path.map((p, i) => {
    const before = path[Math.max(0, i - 1)], after = path[Math.min(path.length - 1, i + 1)];
    const dx = after.x - before.x, dz = after.z - before.z;
    const across = p.halfWidth / (Math.hypot(dx, dz) || 1);
    if (i > 0) distance += Math.hypot(p.x - before.x, p.y - before.y, p.z - before.z);
    return {
      left: [p.x - dz * across, p.y, p.z + dx * across],
      right: [p.x + dz * across, p.y, p.z - dx * across],
      distance,
    };
  });
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1], b = edges[i];
    batch.quad(a.left, a.right, b.right, b.left, WATER, [[0, a.distance], [1, a.distance], [1, b.distance], [0, b.distance]]);
  }
}

function flowing(c, name, batch) {
  const time = { value: 0 };
  c.tick((_dt, t) => { time.value = t; });
  c.after.push(() => {
    const geo = c.kit.geometry(batch, c.rt.lights, c.rt.amb, c.rt.lighting);
    const mat = c.kit.surface({
      room: c.rt.u, alpha: .64, side: THREE.DoubleSide,
      flick: geo.userData.flick, banks: geo.userData.banks,
    });
    mat.forceSinglePass = true;
    mat.uniforms.uFlowTime = time;
    mat.fragmentShader = 'uniform float uFlowTime;\n' + mat.fragmentShader.replace(
      'gl_FragColor = vec4(c, uAlpha);', `
  float run = vUv.y * 4.9 - uFlowTime * 2.8;
  float drift = sin(run * 2.4 + vUv.y * 2.7) * 0.045;
  float across = vUv.x + drift;
  float edge = 1.0 - abs(across * 2.0 - 1.0);
  float film = smoothstep(0.0, 0.28, edge);
  float current = sin(run * 6.283 + across * 11.0)
                + sin(run * 3.18 - across * 15.0) * 0.48;
  float thread = pow(0.5 + 0.5 * sin(across * 23.0 + sin(run * 0.8)), 6.0);
  float glint = smoothstep(0.58, 1.4, current) * mix(0.2, 1.0, thread);
  gl_FragColor = vec4(c + vec3(0.16, 0.24, 0.25) * (0.48 + glint),
                      uAlpha * film * (0.38 + thread * 0.16 + glint * 0.46));`);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.renderOrder = 5;
    c.add(mesh);
  });
}

export function tubeRunnels(c, runs) {
  const batch = new Batch();
  for (const [index, run] of runs.entries()) {
    ribbon(batch, run.map((p, i) => ({
      x: p.x, y: p.y - AXIS_Y + TREAD_FILM + index * .001, z: p.z,
      halfWidth: (index === 1 ? .056 : .104) + Math.sin(i * .39) * .012,
    })));
  }
  flowing(c, 'return-tube-runnels', batch);
}

export function officeRunnel(c, front) {
  const batch = new Batch();
  ribbon(batch, [
    { x: 0, y: TREAD_FILM, z: front + .11, halfWidth: .056 },
    { x: 0, y: TREAD_FILM, z: front - .15, halfWidth: .052 },
    { x: -.024, y: TREAD_FILM, z: front - .46, halfWidth: .07 },
    { x: -.038, y: TREAD_FILM, z: front - .65, halfWidth: .004 },
  ]);
  flowing(c, 'flooded-office-runnel', batch);
}

export function beachSpill(c, { drop, entry }) {
  const batch = new Batch();
  const tread = sampleFlumeFrames(drop, 20).map((p) => {
    const inset = TUBE_RADIUS - .092;
    if (p.u < .5) {
      return { x: p.x, y: TREAD_FILM, z: Math.max(p.z, entry.z0 - .012), halfWidth: .104 };
    }
    return {
      x: p.x - p.vx * inset, y: p.y - p.vy * inset, z: p.z - p.vz * inset,
      halfWidth: .103 - (p.u - .5) * .038,
    };
  });
  const lip = tread.at(-1), height = BEACH_WATER - lip.y;
  for (let i = 1; i <= 18; i++) {
    const t = i / 18;
    tread.push({
      x: lip.x + .016 * t, y: lip.y + height * t * (.62 + .38 * t), z: lip.z - .48 * t,
      halfWidth: lip.halfWidth - .029 * Math.sin(t * Math.PI * .85),
    });
  }
  ribbon(batch, tread);
  flowing(c, 'beach-ceiling-spill', batch);

  const impact = tread.at(-1);
  const ring = c.kit.own(new THREE.RingGeometry(.87, 1, 18).rotateX(-Math.PI / 2));
  const ripples = [0, .5].map((offset) => {
    const mat = c.kit.own(new THREE.MeshBasicMaterial({
      color: '#9bcdc4', transparent: true, opacity: 0, depthWrite: false,
    }));
    const mesh = new THREE.Mesh(ring, mat);
    mesh.name = 'beach-spill-ripple';
    mesh.position.set(impact.x, BEACH_WATER + .007, impact.z);
    mesh.renderOrder = 6;
    c.add(mesh);
    return { mesh, mat, offset };
  });
  const source = c.toWorld(impact.x, impact.z);
  let hush = 0;
  c.tick((dt, time, me) => {
    for (const { mesh, mat, offset } of ripples) {
      const age = (time * .86 + offset) % 1;
      mesh.scale.set(.055 + age * .35, 1, .05 + age * .30);
      mat.opacity = .42 * (1 - age) ** 2;
    }
    hush -= dt;
    if (me.inside && hush <= 0) {
      hush = .70;
      c.env.play?.('changingShower', source.x, source.z, 4.5);
    }
  });
}
