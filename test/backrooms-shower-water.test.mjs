import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
const root=new URL('../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){
 if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};
 return next(s,c);}`)}`,import.meta.url);
const THREE=await import('../public/vendor/three.module.min.js');
const {createKit,Batch}=await import('../public/world/backrooms/kit.js');
const {showerWater}=await import('../public/world/backrooms/rooms/locker-showers/water.js');

function fixture(t){
 const kit=createKit(),scene=new THREE.Scene(),room=new THREE.Group();
 scene.position.set(-8,10,20);room.position.set(4,6,-3);room.rotation.y=Math.PI/2;scene.add(room);
 const batch=new Batch();batch.quad([-2,-.12,2],[2,-.12,2],[2,-.12,-2],[-2,-.12,-2]);
 const ticks=[],after=[],c={kit,world:{scene},rt:{lights:[],amb:[.2,.2,.2],group:room},
  add:o=>room.add(o),tick:f=>ticks.push(f),after};
 const surface=showerWater(c,batch,new THREE.Texture());after.forEach(f=>f());
 const mesh=surface.group.children[0];scene.updateMatrixWorld(true);
 t.after(()=>kit.dispose());
 return {kit,scene,room,mesh,surface,ticks};
}
function rendererFixture(render){
 const original={name:'composer',viewport:new THREE.Vector4(0,0,720,540),scissor:new THREE.Vector4(0,0,720,540),scissorTest:false};
 const state={target:original,viewport:new THREE.Vector4(11,17,1400,900),framebufferViewport:original.viewport.clone(),
  scissor:new THREE.Vector4(1,2,650,400),scissorTest:true,framebufferScissorTest:false,face:2,mip:1,clears:0};
 const renderer={xr:{enabled:true},shadowMap:{autoUpdate:true},state:{buffers:{depth:{setMask(){}}},
   viewport:v=>state.framebufferViewport.copy(v),setScissorTest:v=>{state.framebufferScissorTest=v;}},
  getRenderTarget:()=>state.target,getActiveCubeFace:()=>state.face,getActiveMipmapLevel:()=>state.mip,
  setRenderTarget:(target,face=0,mip=0)=>{state.target=target;state.face=face;state.mip=mip;
   state.framebufferViewport.copy(target.viewport);state.framebufferScissorTest=target.scissorTest;},
  getViewport:v=>v.copy(state.viewport),getCurrentViewport:v=>v.copy(state.framebufferViewport),
  setViewport:v=>{state.viewport.copy(v);state.framebufferViewport.copy(v);},
  getScissor:v=>v.copy(state.scissor),setScissor:v=>state.scissor.copy(v),
  getScissorTest:()=>state.scissorTest,setScissorTest:v=>{state.scissorTest=v;},
  clear:()=>{state.clears++;},render};
 return {renderer,state,original};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} should equal ${b}`);
function viewCamera(){
 const camera=new THREE.PerspectiveCamera(70,1.6,.1,100);
 camera.position.set(-4,18,22);camera.lookAt(-4,15.88,17);camera.updateMatrixWorld();return camera;
}

test('water builds headlessly as one animated transparent sheet and disposes its only target',t=>{
 const {kit,mesh,surface,ticks}=fixture(t),mat=mesh.material;
 const targetTexture=mat.uniforms.uChangingReflection.value;
 assert.equal(surface.group.children.length,1);
 assert.equal(mat.transparent,true);assert.equal(mat.forceSinglePass,true);assert.equal(mat.depthWrite,false);
 assert.equal(mat.uniforms.uChangingReflectionReady.value,0);
 assert.equal(targetTexture.image.width,512);assert.equal(targetTexture.image.height,512);
 ticks[0](.016,12.5);assert.equal(surface.time.value,12.5);
 let targetDisposals=0;
 const {renderer}=rendererFixture(()=>{});
 renderer.setRenderTarget=(target)=>{if(target?.isWebGLRenderTarget)target.addEventListener('dispose',()=>{targetDisposals++;});};
 mesh.onBeforeRender(renderer,new THREE.Scene(),viewCamera());
 kit.dispose();assert.equal(targetDisposals,1);assert.equal(mat.uniforms.uChangingReflectionReady.value,0);
 mesh.onBeforeRender(null,null,null); // disposed callbacks are inert
});

test('reflection follows transformed room height and clips the underwater half-space',t=>{
 const {scene,mesh}=fixture(t),view=viewCamera();let count=0;
 const {renderer,state,original}=rendererFixture((actualScene,mirror)=>{
  count++;assert.equal(actualScene,scene,'reflect world geometry, not the incoming HUD scene');
  assert.equal(mesh.parent.visible,false,'the sheet cannot render into itself');
  close(mirror.position.y,2*15.88-view.position.y);
  close(mirror.position.x,view.position.x);close(mirror.position.z,view.position.z);
  const above=new THREE.Vector4(-4,16.5,17,1).applyMatrix4(mirror.matrixWorldInverse).applyMatrix4(mirror.projectionMatrix);
  const below=new THREE.Vector4(-4,15.2,17,1).applyMatrix4(mirror.matrixWorldInverse).applyMatrix4(mirror.projectionMatrix);
  assert.ok(above.z+above.w>0,'above-water scene remains beyond the oblique near plane');
  assert.ok(below.z+below.w<0,'submerged geometry is excluded from the reflection');
  mesh.onBeforeRender(renderer,scene,mirror); // recursion guard, even with a hostile renderer callback
 });
 mesh.onBeforeRender(renderer,new THREE.Scene(),view);
 assert.equal(count,1);assert.equal(state.clears,1);assert.equal(state.target,original);
 assert.deepEqual(state.viewport.toArray(),[11,17,1400,900],'canvas viewport remains untouched');
 assert.deepEqual(state.framebufferViewport.toArray(),[0,0,720,540],'water uses the VHS target viewport, not canvas dimensions');
 assert.deepEqual(state.scissor.toArray(),[1,2,650,400]);
 assert.equal(state.scissorTest,true);assert.equal(state.face,2);assert.equal(state.mip,1);
 assert.equal(state.framebufferScissorTest,false,'composer scissor state is restored separately from canvas settings');
 assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);
 assert.equal(mesh.parent.visible,true);assert.equal(mesh.material.uniforms.uChangingReflectionReady.value,1);
});

test('failed reflection restores renderer, lamps and visibility and releases recursion guard',t=>{
 const {mesh}=fixture(t),view=viewCamera(),mat=mesh.material;
 mat.uniforms.uTorch.value=1.4;mat.uniforms.uCameraLamp.value=.3;
 const {renderer,state,original}=rendererFixture(()=>{
  assert.equal(mat.uniforms.uTorch.value,0);assert.equal(mat.uniforms.uCameraLamp.value,0);
  throw new Error('render interrupted');
 });
 assert.throws(()=>mesh.onBeforeRender(renderer,new THREE.Scene(),view),/render interrupted/);
 assert.equal(state.target,original);assert.equal(mesh.parent.visible,true);
 assert.equal(mat.uniforms.uTorch.value,1.4);assert.equal(mat.uniforms.uCameraLamp.value,.3);
 assert.equal(mat.uniforms.uChangingReflectionReady.value,0);
 let renders=0;renderer.render=()=>{renders++;};mesh.onBeforeRender(renderer,new THREE.Scene(),view);
 assert.equal(renders,1);
 view.position.y=15.5;view.updateMatrixWorld();mesh.onBeforeRender(renderer,new THREE.Scene(),view);
 assert.equal(renders,1,'underwater views do not spend a second scene pass');
 assert.equal(mat.uniforms.uChangingReflectionReady.value,0);
});
