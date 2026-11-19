// Small paper fires owned by one floor. Nothing spreads or damages a body;
// hostile actors may ask about the light, and decide how to respond themselves.
import * as THREE from 'three';
import { Vox, M, glow } from '../vox/vox.js';
import { gpu } from '../engine/gpu.js';
import { Batch, lightAt } from './kit.js';
import { FIRE_SECONDS_PER_SHEET, CRAFTING_TUNING } from './crafting.js';

export const FIRE = Object.freeze({ limit: 4, footprint: .45, height: 1.1, radius: 6 });
const FLAME_HEIGHTS = [.7, 1.03, .56, .8, 1.15];

function paperBed() {
  const v = new Vox(), char = M('#62584a', 2), edge = M('#b49b6b', 2), paper = M('#e7d8b5', 1);
  v.box(-10, 0, -6, 8, 1, 7, char);
  v.carve(-10, 0, -6, -7, 1, -3); v.carve(6, 0, 5, 8, 1, 7);
  v.box(-8, 1, -9, 7, 2, 8, edge); v.box(-6, 2, -8, 8, 3, 7, paper);
  v.paint(-3, 2, -4, 4, 3, 4, char);
  for (const [x, z] of [[-7, 3], [4, -7], [5, 4]]) {
    v.box(x, 2, z, x + 3, 3, z + 3, edge);
    v.box(x + 1, 3, z + 1, x + 3, 4, z + 3, paper);
  }
  for (const [x, z] of [[-5, 0], [2, -4], [3, 3], [-2, 4]]) v.box(x, 3, z, x + 2, 4, z + 1, glow('#cf5420'));
  return v;
}
function tongue(bend) {
  const v = new Vox(), orange = glow('#e9ae68'), red = glow('#b87543'), gold = glow('#f1d293'), core = glow('#f4e6ba');
  for (let y = 0; y < 23; y++) {
    const width = y < 10 ? 2 : 1, depth = y < 12 ? 2 : 1, shift = Math.floor(y / 9) * bend;
    v.box(shift - width, y, -depth, shift + width, y + 1, depth, y < 2 ? red : y < 6 ? gold : orange);
    if (y < 13) v.box(shift - 1, y, -depth, shift + 1, y + 1, depth, y < 8 ? core : gold);
  }
  return v;
}

// Named factory lets co-op rebuild this effect without accepting shader code
// from the network. The same material is used by single-player paper fires.
export function createFireSpillMaterial(){
  if (gpu.nodes) {
    const N = gpu.nodes, T = N.TSL;
    const { Fn, vec3, vec4, float, uniform, uv, length, clamp, mrt } = T;
    const ss = (e0, e1, x) => { const t = clamp(float(x).sub(e0).div(e1 - e0), 0, 1); return t.mul(t).mul(t.mul(-2).add(3)); };
    const material = new N.NodeMaterial();
    material.colorNode = vec3(1, 1, 1); material.opacityNode = float(1);
    material.transparent = true; material.depthWrite = false; material.blending = THREE.AdditiveBlending;
    material.uniforms = { strength: { value: .6 } };
    const uStrength = uniform(.6).onRenderUpdate(() => material.uniforms.strength.value);
    material.outputNode = Fn(() => {
      const r = length(uv().sub(.5)).mul(2);
      const a = float(1).sub(ss(.08, 1.0, r)).mul(uStrength);
      return vec4(vec3(.9, .29, .055), a);
    })();
    material.userData.coopEffect = 'paper-fire-spill';
    return material;
  }
  const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { strength: { value: .6 } },
      vertexShader: 'varying vec2 uvFire; void main(){uvFire=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'varying vec2 uvFire; uniform float strength; void main(){float r=length(uvFire-.5)*2.0;float a=(1.0-smoothstep(.08,1.0,r))*strength;gl_FragColor=vec4(.9,.29,.055,a);}',
  });
  material.userData.coopEffect='paper-fire-spill';return material;
}

export function createInventoryFire(env, { canAct = () => true, clearRay, isDry = () => true } = {}) {
  const { kit, world } = env, pool = [];
  let disposed = false, resources = null, serial = 0;
  const fail = reason => ({ ok: false, reason });
  const lineOfSight = clearRay || ((ax, az, bx, bz) => {
    const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / .055));
    for (let i = 1; i <= steps; i++) if (!world.free(ax + (bx - ax) * i / steps, az + (bz - az) * i / steps, .025, { tall: true, ghost: true })) return false;
    return true;
  });
  const request = (spec = {}) => {
    if (disposed || !canAct()) return fail('unavailable');
    const secondsPerSheet = env.perk?.fireSecondsPerSheet ?? FIRE_SECONDS_PER_SHEET;
    const paperCount = spec?.paperCount, duration = spec?.duration === undefined ? paperCount * secondsPerSheet : spec.duration;
    if (!Number.isInteger(paperCount) || paperCount < 1 || paperCount > CRAFTING_TUNING.maxPaper
      || !Number.isFinite(duration) || duration !== paperCount * secondsPerSheet) return fail('invalid-fire');
    if (pool.filter(f => f.remaining > 0).length >= FIRE.limit) return fail('fire-limit');
    return { ok: true, paperCount, duration };
  };
  function assets() {
    if (resources) return resources;
    const mesh = (key, make) => {
      const b = new Batch(true), s = kit.VOXEL;
      b.addVox(kit.model(`inventory-fire:${key}`, make).solid, new THREE.Matrix4().makeScale(s, s, s));
      return kit.geometry(b, [], [.85, .85, .85]);
    };
    resources = {
      bed: mesh('paper', paperBed), flames: [mesh('left', () => tongue(-1)), mesh('right', () => tongue(1))],
      cube: kit.own(new THREE.BoxGeometry(1, 1, 1)), pool: kit.own(new THREE.PlaneGeometry(.84, .84)),
    };
    return resources;
  }
  function rig() {
    const a = assets(), group = new THREE.Group(), bedMaterial = kit.surface({ vox: true }), flameMaterial = kit.surface({ vox: true });
    const bed = new THREE.Mesh(a.bed, bedMaterial); group.add(bed);
    const flames = [[-.13, -.07], [.12, -.08], [-.1, .12], [.14, .1], [0, 0]].map(([x, z], i) => {
      const mesh = new THREE.Mesh(a.flames[i % 2], flameMaterial);
      mesh.position.set(x, .065, z); mesh.rotation.y = i * 1.7; group.add(mesh); return mesh;
    });
    // A soft warm patch on the carpet. Point lights cannot illuminate the
    // building's baked shader, so the spill is an additive floor surface.
    const spillMaterial = kit.own(createFireSpillMaterial());
    const spill = new THREE.Mesh(a.pool, spillMaterial); spill.rotation.x = -Math.PI / 2; spill.position.y = -.006; spill.renderOrder = 1; group.add(spill);
    const smoke = Array.from({ length: 3 }, () => {
      const material = kit.own(new THREE.MeshBasicMaterial({ color: '#807866', transparent: true, opacity: .12, depthWrite: false }));
      const mesh = new THREE.Mesh(a.cube, material); group.add(mesh); return mesh;
    });
    const emberMaterial = kit.own(new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(1.8, .48, .055), toneMapped: false }));
    const embers = Array.from({ length: 4 }, () => { const mesh = new THREE.Mesh(a.cube, emberMaterial); group.add(mesh); return mesh; });
    const f = { group, bedMaterial, flameMaterial, flames, spill, smoke, embers, remaining: 0 };
    pool.push(f); return f;
  }
  function draw(f) {
    if (f.remaining <= 0) { f.group.visible = false; return; }
    const age = f.duration - f.remaining, fade = Math.min(1, f.remaining), flicker = .86 + Math.sin(age * 13.7) * .09 + Math.sin(age * 23.1 + 1) * .05;
    const warmth = Math.min(1, .4 + age * 4) * fade;
    f.flameMaterial.uniforms.uTint.value.setScalar((.4 + .12 * flicker) * warmth);
    f.spill.material.uniforms.strength.value = (.45 + flicker * .24) * warmth;
    for (let i = 0; i < f.flames.length; i++) {
      const mesh = f.flames[i], phase = age * (7.1 + i * .8) + i * 2.3;
      const height = (FLAME_HEIGHTS[i] + .10 * Math.sin(phase)) * (.5 + warmth * .5);
      // Three-voxel steps preserve the block silhouette as the tongues rise.
      mesh.scale.set(1, Math.round(height * 12) / 12, 1);
      mesh.rotation.z = Math.sin(phase * .6) * .08;
    }
    for (let i = 0; i < f.smoke.length; i++) {
      const mesh = f.smoke[i], t = (age * .34 + i / 3) % 1;
      mesh.position.set(Math.sin(t * 4 + i) * .12, .35 + t * .6, Math.cos(t * 3 + i * 2) * .10);
      mesh.scale.setScalar(.045 + t * .075); mesh.rotation.set(t * .5, i + t, t * .3);
      mesh.material.opacity = Math.sin(t * Math.PI) * .15 * warmth;
    }
    for (let i = 0; i < f.embers.length; i++) {
      const mesh = f.embers[i], t = (age * (.65 + i * .06) + i * .27) % 1;
      mesh.visible = t < .82 && warmth > .05;
      mesh.position.set(Math.sin(i * 8.7 + t * 2) * .15 * t, .16 + t * .72, Math.cos(i * 4.3 + t * 3) * .16 * t);
      mesh.scale.setScalar(.022 * (1 - t * .55));
    }
  }
  const snapshot = f => ({ id: f.id, room: f.rt.id, x: f.x, z: f.z, y: f.y, wx: f.wx, wz: f.wz, wy: f.wy,
    paperCount: f.paperCount, duration: f.duration, remaining: f.remaining, radius: FIRE.radius });
  function ignite(p, spec) {
    const checked = request(spec);
    if (!checked.ok) return checked;
    let f = pool.find(fire => fire.remaining <= 0);
    try { f ||= rig(); } catch { return fail('fire-unavailable'); }
    Object.assign(f, { ...p, id: ++serial, paperCount: checked.paperCount, duration: checked.duration, remaining: checked.duration, wy: p.rt.def.y + p.y });
    f.group.name = `inventory-fire-${f.id}`; f.group.visible = true;
    p.rt.group.add(f.group); f.group.position.set(p.x, p.y + .013, p.z); f.group.rotation.y = p.yaw || 0;
    const rgb = lightAt(p.rt.lights, p.rt.amb, p.x, p.y + .12, p.z);
    f.bedMaterial.uniforms.uTint.value.set(Math.max(.92, rgb[0]), Math.max(.78, rgb[1]), Math.max(.6, rgb[2]));
    f.bedMaterial.uniforms.uDim = p.rt.u.dim; f.bedMaterial.uniforms.uFlick = p.rt.u.flick;
    draw(f);
    return { ok: true, ...snapshot(f) };
  }
  return {
    request, ignite,
    sync(records) {
      for (const f of pool) if (!records.some(r => r.id === f.id)) { f.remaining = 0; draw(f); }
      for (const r of records) {
        let f = pool.find(f => f.id === r.id && f.remaining > 0);
        if (!f) {
          const rt = world.rooms.find(rt => rt.id === r.room); if (!rt) continue;
          const result = ignite({ ...r, rt }, r); if (!result.ok) continue;
          f = pool.find(f => f.id === result.id); f.id = r.id; serial = Math.max(serial, r.id);
        }
        f.remaining = Math.max(0, Math.min(f.duration, r.remaining)); draw(f);
      }
    },
    occupied(x, z, radius, y) {
      return !disposed && pool.some(f => f.remaining > 0 && !f.away && Math.abs(f.wy - y) < .8 && Math.hypot(f.wx - x, f.wz - z) < FIRE.footprint + radius);
    },
    threatAt(x, z, y) {
      if (disposed || !canAct() || !Number.isFinite(x) || !Number.isFinite(z) || !world.roomAt(x, z)) return null;
      const floor = world.floorY(x, z), height = y === undefined ? floor : y;
      if (!Number.isFinite(height)) return null;
      let nearest = null, distance = FIRE.radius + 1e-8;
      for (const f of pool) {
        if (f.remaining <= 0 || f.away || Math.abs(f.wy - floor) >= .8 || Math.abs(f.wy - height) >= .8) continue;
        const d = Math.hypot(f.wx - x, f.wz - z);
        if (d > distance || !lineOfSight(x, z, f.wx, f.wz)) continue;
        nearest = f; distance = d;
      }
      return nearest ? { x: nearest.wx, z: nearest.wz, y: nearest.wy, radius: FIRE.radius, remaining: nearest.remaining } : null;
    },
    /** Sprayed out (extinguisher.rule.js): it goes as one in the wet does, over its last moment. → whether there was one to put out. */
    douse(id) {
      const f = pool.find(fire => fire.id === id && fire.remaining > 0 && !fire.away);
      if (!f || disposed) return false;
      f.remaining = Math.min(f.remaining, 0.6); draw(f); return true;
    },
    update(dt) {
      if (disposed || !Number.isFinite(dt) || dt <= 0) return;
      for (const f of pool) if (f.remaining > 0 && !f.away) {
        f.remaining = isDry(f) ? Math.max(0, f.remaining - dt) : 0;
        draw(f);
      }
    },
    // A fire burning in a room that has gone is burning there, not here: it is no light, no heat and no threat to
    // anything until the room is back, and then it has as long left as it had (inventory-world.js, takeAway).
    takeAway(inside, key) { const gone = pool.filter(f => f.remaining > 0 && !f.away && inside(f.wx, f.wz)); for (const f of gone) { f.away = key; f.group.visible = false; } return gone.length; },
    bringBack(key) { const back = pool.filter(f => f.away === key); for (const f of back) { f.away = null; f.group.visible = true; draw(f); } return back.length; },
    report: () => pool.filter(f => f.remaining > 0 && !f.away).map(snapshot),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const f of pool) { f.remaining = 0; f.group.removeFromParent(); }
      pool.length = 0; resources = null; // kit owns GPU disposal with the floor
    },
  };
}
