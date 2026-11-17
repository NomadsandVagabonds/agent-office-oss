import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';

const root=new URL('../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){
 if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};
 if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};
 return next(s,c);}`)}`,import.meta.url);
const [{createKit,Batch},{buildWorld},{generate}]=await Promise.all([
 import('../public/world/backrooms/kit.js'),import('../public/world/backrooms/world.js'),import('../public/world/backrooms/gen.js')]);

test('room material options reach wet mapped and dynamic surfaces without changing dry defaults',async t=>{
 const draw=new Proxy({},{get:(_,k)=>k==='measureText'?s=>({width:String(s).length*6}):/Gradient/.test(k)?()=>({addColorStop(){}}):()=>{},set:()=>true});
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>draw})};
 t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 const kit=createKit(),level=generate('wet-surfaces'),def={...level.rooms[0],id:0,kind:'special',arch:'wet-study',shape:null,doors:[]};
 const wetMap=kit.tex.custom('wet-test',2,2,()=>{}),dryMap=kit.tex.custom('dry-test',2,2,()=>{});
 const env={catalogue:{has:()=>false,geo:()=>null},builders:{'wet-study':c=>{
  c.shell({panels:false});
  c.mapped('wet-study',wetMap,{wet:.8}).box(-1,0,0,0,1,1);
  c.mapped('dry-study',dryMap).box(1,0,0,2,1,1);
  const wetBatch=new Batch(),dryBatch=new Batch();
  wetBatch.box(-1,1,0,0,2,1);dryBatch.box(1,1,0,2,2,1);
  c.rt.wetStudy={wet:c.dynamic(wetBatch,{wet:.65}),dry:c.dynamic(dryBatch)};
 }}};
 const world=await buildWorld(kit,{...level,rooms:[def],links:[],windows:[]},env);
 t.after(()=>{world.dispose();kit.dispose();});
 const room=world.rooms[0],materials=[];room.group.traverse(o=>{if(o.material)materials.push(o.material);});
 const wetMapped=materials.find(m=>m.uniforms?.map?.value===wetMap),dryMapped=materials.find(m=>m.uniforms?.map?.value===dryMap);
 for(const [material,amount]of [[wetMapped,.8],[room.wetStudy.wet.userData.mesh.material,.65]]){
  assert.equal(material.defines.WET,1,'wet shader branch is enabled on the finished mesh');
  assert.equal(material.uniforms.uWet.value,amount,'the authored wetness reaches the shader');
  assert.equal(material.transparent,false,'wet sheen does not make solid geometry transparent');
 }
 for(const material of [dryMapped,room.wetStudy.dry.userData.mesh.material]){
  assert.equal(material.defines.WET,undefined,'ordinary surfaces retain the original shader');
  assert.equal(material.uniforms.uWet,undefined,'ordinary surfaces allocate no wetness uniform');
 }
});
