// The Office — the voxel material, and Vox → scene objects.
//
// One shared Lambert material renders every voxel model. On top of the baked
// ambient occlusion it adds, per fragment and for free:
//   · a little colour variation from voxel to voxel (cloth and wood look
//     woven and grained instead of airbrushed)
//   · a faint line where voxels meet, so the "pixels" stay readable even on
//     big merged faces
//   · self-illumination for voxels marked glow (screens, LEDs, lamp bulbs),
//     which the bloom pass then turns into real-looking light
import * as THREE from 'three';
import { VOXEL } from './vox.js';
import { meshVox } from './mesher.js';
import { gpu } from '../engine/gpu.js';

const shared = { uGrid: { value: 0.06 }, uGlow: { value: 1.6 }, uTime: { value: 0 } };
export const voxelUniforms = shared;

function inject(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aTex;
        attribute float aEmis;
        varying vec3 vVoxPos;
        varying float vTex;
        varying float vEmis;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vVoxPos = position - normal * 0.5;
        vTex = aTex;
        vEmis = aEmis;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uGrid;
        uniform float uGlow;
        varying vec3 vVoxPos;
        varying float vTex;
        varying float vEmis;
        float voxHash(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.x + p.y) * p.z);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 cell = floor(vVoxPos + 0.0005);
          float n = voxHash(cell);
          diffuseColor.rgb *= 1.0 + (n - 0.5) * 2.0 * vTex;
          vec3 fr = abs(fract(vVoxPos) - 0.5) * 2.0;
          float edge = smoothstep(0.80, 1.0, max(fr.x, max(fr.y, fr.z)));
          diffuseColor.rgb *= 1.0 - uGrid * edge * (0.4 + 6.0 * vTex) * (1.0 - vEmis);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * vEmis * uGlow;`);
  };
  // every voxel material shares one compiled program
  material.customProgramCacheKey = () => 'office-voxel';
  return material;
}

/**
 * The same material for the WebGPU renderer (?gpu=webgpu: engine/gpu.js), in three.js's node language: Lambert with
 * vertex colours, and on top the same three things as inject() above, with the same numbers. The uniforms are the
 * shared ones above, read before every frame (lighting.js and levels/kit.js set uGlow).
 */
function nodeVoxel(params) {
  const N = gpu.nodes, T = N.TSL;
  const { uniform, attribute, varying, positionGeometry, normalGeometry, floor, fract, dot, vec3, float, max, clamp, materialColor, diffuseColor } = T;
  const m = new N.MeshLambertNodeMaterial(params);
  const uGrid = uniform(shared.uGrid.value).onRenderUpdate(() => shared.uGrid.value);
  const uGlow = uniform(shared.uGlow.value).onRenderUpdate(() => shared.uGlow.value);
  const vox = varying(positionGeometry.sub(normalGeometry.mul(0.5)), 'vVoxPos');
  const tex = attribute('aTex', 'float'), emis = attribute('aEmis', 'float');
  const hash = (p0) => { const p = fract(p0.mul(vec3(0.1031, 0.1030, 0.0973))); const q = p.add(dot(p, p.yxz.add(33.33))); return fract(q.x.add(q.y).mul(q.z)); };
  const n = hash(floor(vox.add(0.0005)));
  const fr = fract(vox).sub(0.5).abs().mul(2);
  const t = clamp(max(fr.x, max(fr.y, fr.z)).sub(0.8).div(0.2), 0, 1), edge = t.mul(t).mul(t.mul(-2).add(3));
  const grain = n.sub(0.5).mul(2).mul(tex).add(1);
  const line = float(1).sub(uGrid.mul(edge).mul(tex.mul(6).add(0.4)).mul(emis.oneMinus()));
  m.colorNode = materialColor.mul(grain).mul(line);                       // (× the vertex colour, which the material adds)
  m.emissiveNode = diffuseColor.rgb.mul(emis).mul(uGlow);
  return m;
}

let solidMaterial = null;
let glassMaterial = null;
export function voxelMaterial() {
  if (!solidMaterial) solidMaterial = gpu.nodes ? nodeVoxel({ vertexColors: true }) : inject(new THREE.MeshLambertMaterial({ vertexColors: true }));
  return solidMaterial;
}
export function voxelGlassMaterial() {
  if (!glassMaterial) {
    const params = { vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false };
    if (gpu.nodes) return (glassMaterial = nodeVoxel(params));
    glassMaterial = inject(new THREE.MeshLambertMaterial(params));
    glassMaterial.customProgramCacheKey = () => 'office-voxel-glass';
  }
  return glassMaterial;
}

const geometryCache = new Map();

// Distant things are drawn from coarser copies of themselves (see Vox.downsample):
// beyond LOD.near metres every 2×2×2 block of voxels is one cube, beyond LOD.far
// every 4×4×4. A voxel is well under a pixel by then, so it reads the same and
// costs a fraction. Small things stop casting shadows at the coarsest level.
export const LOD = { near: 30, far: 62, minVoxels: 260 };

function levelGroup(meshed, factor, opt, small) {
  const g = new THREE.Group();
  if (meshed.solid) {
    const mesh = new THREE.Mesh(meshed.solid, voxelMaterial());
    mesh.castShadow = opt.cast !== false && !(small && factor >= 4);
    mesh.receiveShadow = opt.receive !== false;
    g.add(mesh);
  }
  if (meshed.glass) {
    const mesh = new THREE.Mesh(meshed.glass, voxelGlassMaterial());
    mesh.renderOrder = 2;
    g.add(mesh);
  }
  if (factor !== 1) g.scale.setScalar(factor);
  return g;
}

/**
 * Build a renderable object from a voxel model.
 * @param {import('./vox.js').Vox | (() => import('./vox.js').Vox)} model  a Vox, or a function that makes one
 * @param {{key?:string, origin?:[number,number,number], scale?:number, cast?:boolean, receive?:boolean, lod?:boolean}} [opt]
 *        key: cache the meshed geometry under this name (identical props share GPU buffers)
 *        lod: false to always draw the full model (default: coarser copies when far away)
 * @returns {THREE.Group}  origin at the model's origin, sized in metres. Things you add to it are in voxel units.
 */
export function voxObject(model, opt = {}) {
  let entry = opt.key ? geometryCache.get(opt.key) : null;
  if (!entry) {
    const vox = typeof model === 'function' ? model() : model;
    const full = meshVox(vox, { origin: opt.origin });
    entry = { levels: [full], voxels: vox.size };
    if (opt.lod !== false && !opt.origin && vox.size >= LOD.minVoxels) {
      for (const f of [2, 4]) {
        const coarse = meshVox(vox.downsample(f));
        if (coarse.solid || coarse.glass) entry.levels.push(coarse); else break;
      }
    }
    if (opt.key) geometryCache.set(opt.key, entry);
  }
  const meshed = entry.levels[0];
  const group = new THREE.Group();
  const b = meshed.bounds;
  const small = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0) < 34;          // under ~85 cm in every direction
  if (entry.levels.length === 1) {
    for (const child of [...levelGroup(meshed, 1, opt, false).children]) group.add(child);
  } else {
    const lod = new THREE.LOD();
    lod.addLevel(levelGroup(entry.levels[0], 1, opt, small), 0);
    if (entry.levels[1]) lod.addLevel(levelGroup(entry.levels[1], 2, opt, small), LOD.near);
    if (entry.levels[2]) lod.addLevel(levelGroup(entry.levels[2], 4, opt, small), LOD.far);
    group.add(lod);
  }
  group.scale.setScalar(opt.scale ?? VOXEL);
  group.userData.bounds = meshed.bounds;
  group.userData.quads = meshed.quads;
  group.userData.lodQuads = entry.levels.map((l) => l.quads);
  return group;
}

export function clearGeometryCache() {
  for (const e of geometryCache.values()) for (const m of e.levels) { m.solid?.dispose(); m.glass?.dispose(); }
  geometryCache.clear();
}
