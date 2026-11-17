import * as THREE from 'three';
import {FLASHLIGHT_POSES,flashlightRay} from '../backrooms/flashlight.js';
import {lightPower} from './inventory.js';
// Reuse the production camera cone. One additional shader cone shows the
// partner's beam on the baked surfaces without adding shadow-map passes.
// What it adds to the kit's main() has names of its own (coop…): the kit declares `beam` there itself, and two of a
// name in one scope does not compile, which leaves every surface the patch touches undrawn.
export function createCoopLights(world,kit){
 const power={value:0},position={value:new THREE.Vector3()},direction={value:new THREE.Vector3(0,0,-1)};
 const patched=new WeakSet();
 const refresh=()=>world.scene.traverse(n=>{for(const m of [n.material].flat().filter(Boolean)){
  if(!m.uniforms?.uTorch||patched.has(m))continue;patched.add(m);
  Object.assign(m.uniforms,{uCoopLight:power,uCoopPosition:position,uCoopDirection:direction});
  if(!m.fragmentShader.includes('uniform float uCoopLight;')){
  m.fragmentShader=m.fragmentShader.replace('uniform float uTorch;', 'uniform float uTorch;\nuniform float uCoopLight;\nuniform vec3 uCoopPosition;\nuniform vec3 uCoopDirection;');
  m.fragmentShader=m.fragmentShader.replace('  #ifdef VOXEL\n  c += torch',`  vec3 coopRay = vView - uCoopPosition;
  float coopReach = length(coopRay);
  float coopBeam = smoothstep(.90, .985, dot(normalize(coopRay + vec3(.00001)), uCoopDirection));
  torch += vAlb * uCoopLight * coopBeam / (1.0 + coopReach * coopReach * .2);
  #ifdef VOXEL
  c += torch`);m.needsUpdate=true;}
 }});
 refresh();
 return {refresh,update(camera,s,view){
  const pose=view.inventory?.mountedTorch?FLASHLIGHT_POSES.mounted:FLASHLIGHT_POSES.hand;kit.shared.uTorchOrigin.value.fromArray(pose.origin);kit.shared.uTorchDirection.value.fromArray(pose.direction);kit.shared.uTorch.value=lightPower(view)*1.5;
  const other=s.players.find(p=>p.id!==view.id);power.value=other?lightPower(other)*1.5:0;
  if(!power.value)return;
  camera.updateMatrixWorld();
  const ray=flashlightRay({...other,mounted:!!other.inventory?.mountedTorch});
  position.value.fromArray(ray.origin).applyMatrix4(camera.matrixWorldInverse);
  direction.value.fromArray(ray.direction).transformDirection(camera.matrixWorldInverse);
 }};
}
