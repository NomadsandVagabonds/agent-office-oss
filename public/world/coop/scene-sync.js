// Authority-owned scene changes, including spawned meshes, reparenting and
// mutable screens. Initial resources are rebuilt locally; only additions and
// departures from that baseline travel. No guest behaviour clocks run here.
import * as THREE from 'three';
import {createFireSpillMaterial} from '../backrooms/inventory-fire.js';
const props=['opacity','transparent','visible','depthWrite','depthTest','side','alphaTest'];
const uniforms=['uTint','uDim','uFlick','uBanks','uMoreBanks','uWhite','uRed','uAlpha','strength'];
const encode=v=>v?.toArray?v.toArray():Array.isArray(v)?v.slice():v;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createSceneSync(root,kit){
 const nodes=[],nodeIds=new Map(),geometries=[],geoIds=new Map(),materials=[],matIds=new Map(),textures=[],texIds=new Map();
 const added=[],newGeo=[],newMat=[],newTex=[],canvasUpdates=new Map(),versions=new Map(),applied=new Map();
 let baseNodes=0,baseGeo=0,baseMat=0,baseTex=0,initialized=false;
 const texture=t=>{if(!t)return null;if(texIds.has(t))return texIds.get(t);const id=textures.length;texIds.set(t,id);textures.push(t);versions.set(id,t.version);if(initialized){const canvas=t.image;if(!canvas?.toDataURL)throw Error('Unsupported runtime texture');newTex.push({id,data:canvas.toDataURL(),wrapS:t.wrapS,wrapT:t.wrapT,flipY:t.flipY,colorSpace:t.colorSpace});}return id;};
 const material=m=>{if(!m)return null;if(matIds.has(m))return matIds.get(m);const id=materials.length;matIds.set(m,id);materials.push(m);texture(m.map);for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)texture(u.value);
  if(initialized){const base=materials.findIndex((a,i)=>i<id&&a.type===m.type&&a.vertexShader===m.vertexShader&&a.fragmentShader===m.fragmentShader&&equal(a.defines,m.defines));if(base<0&&!['MeshBasicMaterial','MeshLambertMaterial','MeshStandardMaterial'].includes(m.type)&&!m.uniforms?.uTorch&&m.userData.coopEffect!=='paper-fire-spill')throw Error('Unsupported runtime material '+m.type);newMat.push({id,base,type:m.type,effect:m.userData.coopEffect||null,surface:m.uniforms?.uTorch?{vox:!!m.defines?.VOXEL,cutout:!!m.defines?.CUTOUT,flick:!!m.defines?.FLICK,banks:m.defines?.BANKS,side:m.side,alpha:m.uniforms.uAlpha.value}:null,map:texture(m.map),textures:Object.fromEntries(Object.entries(m.uniforms||{}).filter(([,u])=>u.value?.isTexture).map(([k,u])=>[k,texture(u.value)]))});}
  return id;};
 const geometry=g=>{if(!g)return null;if(geoIds.has(g))return geoIds.get(g);const id=geometries.length;geoIds.set(g,id);geometries.push(g);if(initialized)newGeo.push({id,data:g.toJSON()});return id;};
 const visit=n=>{if(nodeIds.has(n))return;const id=nodes.length;nodeIds.set(n,id);nodes.push(n);const g=geometry(n.geometry),m=Array.isArray(n.material)?n.material.map(material):material(n.material);if(initialized)added.push({id,mesh:!!n.isMesh,geometry:g,material:m,name:n.name});};
 root.traverse(visit);baseNodes=nodes.length;baseGeo=geometries.length;baseMat=materials.length;baseTex=textures.length;
 const appearance=m=>({props:Object.fromEntries(props.map(k=>[k,m[k]]).filter(([,v])=>v!==undefined)),color:m.color?.toArray(),emissive:m.emissive?.toArray(),map:texture(m.map),uniforms:Object.fromEntries(uniforms.filter(k=>m.uniforms?.[k]).map(k=>[k,encode(m.uniforms[k].value)]))});
 const originalMaterials=materials.map(appearance),parents=nodes.map(n=>nodeIds.get(n.parent)??-1),bindings=nodes.map(n=>[geometry(n.geometry),Array.isArray(n.material)?n.material.map(material):material(n.material)]);
 initialized=true;
 function read(){
  root.traverse(visit);
  const bindingChanges=[];
  nodes.forEach((n,id)=>{const b=[geometry(n.geometry),Array.isArray(n.material)?n.material.map(material):material(n.material)];if(id>=baseNodes||!equal(b,bindings[id]))bindingChanges.push([id,...b]);});
  const looks=materials.flatMap((m,id)=>{const a=appearance(m);return id>=baseMat||!equal(a,originalMaterials[id])?[[id,a]]:[];});
  textures.forEach((t,id)=>{if(t.version!==versions.get(id)&&t.image?.toDataURL){versions.set(id,t.version);canvasUpdates.set(id,{id,version:t.version,data:t.image.toDataURL()});}});
  return {baseNodes,added,geometries:newGeo,materials:newMat,textures:newTex,parents:nodes.flatMap((n,id)=>{const p=nodeIds.get(n.parent)??-1;return id>=baseNodes||p!==parents[id]?[[id,p]]:[];}),bindings:bindingChanges,appearance:looks,canvases:[...canvasUpdates.values()]};
 }
 function paint(t,id,data,version){if(applied.get(id)===version)return;applied.set(id,version);const img=new Image();img.onload=()=>{if(applied.get(id)!==version)return;const c=t.image;if(c?.getContext){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);}else t.image=img;t.needsUpdate=true;};img.src=data;}
 function apply(s){
  if(!s)return;if(s.baseNodes!==baseNodes)throw Error('Room scene baseline differs between players');
  for(const d of s.textures)if(!textures[d.id]){const t=kit.own(new THREE.Texture());Object.assign(t,{wrapS:d.wrapS,wrapT:d.wrapT,flipY:d.flipY,colorSpace:d.colorSpace});textures[d.id]=t;paint(t,d.id,d.data,0);}
  for(const d of s.geometries)if(!geometries[d.id])geometries[d.id]=kit.own(new THREE.ObjectLoader().parseGeometries([d.data])[d.data.uuid]);
  for(const d of s.materials)if(!materials[d.id]){const m=kit.own(d.base>=0?materials[d.base].clone():d.effect==='paper-fire-spill'?createFireSpillMaterial():d.surface?kit.surface({...d.surface,map:textures[d.textures.map]}):new THREE[d.type]());if(d.map!==null)m.map=textures[d.map];for(const [k,id]of Object.entries(d.textures)){if(m.uniforms?.[k])m.uniforms[k].value=textures[id];}for(const [k,u]of Object.entries(kit.shared))if(m.uniforms?.[k])m.uniforms[k]=u;materials[d.id]=m;}
  for(const d of s.added)if(!nodes[d.id]){const n=d.mesh?new THREE.Mesh():new THREE.Group();n.name=d.name;nodes[d.id]=n;nodeIds.set(n,d.id);}
  for(const [id,g,m]of s.bindings){const n=nodes[id];if(g!==null)n.geometry=geometries[g];if(m!==null)n.material=Array.isArray(m)?m.map(i=>materials[i]):materials[m];}
  const altered=new Map(s.parents);for(let id=1;id<nodes.length;id++){const p=altered.has(id)?altered.get(id):parents[id];if(p===-1)nodes[id].removeFromParent();else if(p!==undefined&&nodes[id].parent!==nodes[p])nodes[p].add(nodes[id]);}
  const changed=new Map(s.appearance);materials.forEach((m,id)=>{const a=changed.get(id)||originalMaterials[id];if(!a)return;Object.assign(m,a.props);if(a.color)m.color?.fromArray(a.color);if(a.emissive)m.emissive?.fromArray(a.emissive);if(a.map!==null&&a.map!==undefined&&m.map!==textures[a.map]){m.map=textures[a.map];m.needsUpdate=true;}for(const [k,v]of Object.entries(a.uniforms)){const u=m.uniforms?.[k];if(!u)continue;if(u.value?.fromArray)u.value.fromArray(v);else u.value=Array.isArray(v)?v.slice():v;}});
  for(const c of s.canvases)paint(textures[c.id],c.id,c.data,c.version);
 }
 return {nodes,read,apply,baseNodes};
}
