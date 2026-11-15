import * as THREE from 'three';
import {lightPower} from './inventory.js';
// Reuse the production camera cone. One additional shader cone shows the
// partner's beam on the baked surfaces without adding shadow-map passes.
export function createCoopLights(world,kit){
 const power={value:0},position={value:new THREE.Vector3()},direction={value:new THREE.Vector3(0,0,-1)};
 const patched=new WeakSet();
 world.scene.traverse(n=>{for(const m of [n.material].flat().filter(Boolean)){
  if(!m.uniforms?.uTorch||patched.has(m))continue;patched.add(m);
  Object.assign(m.uniforms,{uCoopLight:power,uCoopPosition:position,uCoopDirection:direction});
  m.fragmentShader=m.fragmentShader.replace('uniform float uTorch;', 'uniform float uTorch;\nuniform float uCoopLight;\nuniform vec3 uCoopPosition;\nuniform vec3 uCoopDirection;');
  m.fragmentShader=m.fragmentShader.replace('  #ifdef VOXEL\n  c += torch',`  vec3 ray = vView - uCoopPosition;
  float reach = length(ray);
  float beam = smoothstep(.90, .985, dot(normalize(ray + vec3(.00001)), uCoopDirection));
  torch += vAlb * uCoopLight * beam / (1.0 + reach * reach * .2);
  #ifdef VOXEL
  c += torch`);m.needsUpdate=true;
 }});
 return {update(camera,s,view){
  kit.shared.uTorch.value=lightPower(view)*1.5;
  const other=s.players.find(p=>p.id!==view.id);power.value=other?lightPower(other)*1.5:0;
  if(!power.value)return;
  camera.updateMatrixWorld();
  position.value.set(other.x,(other.y??1.1)-.12,other.z).applyMatrix4(camera.matrixWorldInverse);
  direction.value.set(-Math.sin(other.yaw)*Math.cos(other.pitch),Math.sin(other.pitch),-Math.cos(other.yaw)*Math.cos(other.pitch)).transformDirection(camera.matrixWorldInverse);
 }};
}
