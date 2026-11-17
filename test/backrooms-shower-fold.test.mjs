import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {showerPlan,showerFloor,showerCeiling,showerCuts,foldCrossing} from '../public/world/backrooms/rooms/locker-showers/plan.js';

const root=new URL('../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`,import.meta.url);
const [{createKit},{buildWorld,loadCatalogue},{generate,DECK},{toWorld,toLocal},{createPlayer},THREE,{createPopulation}]=await Promise.all([
 import('../public/world/backrooms/kit.js'),import('../public/world/backrooms/world.js'),import('../public/world/backrooms/gen.js'),import('../public/world/backrooms/frame.js'),import('../public/world/backrooms/player.js'),import('../public/vendor/three.module.min.js'),import('../public/world/coop/population.js')]);

test('shower plan: every bench span and its lateral steps form a recoverable height field',()=>{
 for(const D of [26,28]){
  const p=showerPlan({W:18,D,H:6.6});
  for(const s of p.spans)for(let i=0;i<=20;i++){
   const x=s.x0+(s.x1-s.x0)*i/20,z=s.z0+(s.z1-s.z0)*i/20;
   assert.equal(showerFloor(p,x,z),p.bench,'bench centre remains above the water');
   assert.ok(showerCeiling(p,x,z)-p.bench>2,'the route leaves standing clearance');
  }
  for(let z=-D/2+.1;z<D/2;z+=.1)for(let x=-8.9;x<8.9;x+=.1){
   const y=showerFloor(p,x,z);
   for(const [nx,nz]of [[x+.1,z],[x,z+.1]])assert.ok(Math.abs(showerFloor(p,nx,nz)-y)<=.160001,`walkable riser at ${x},${z}`);
  }
  // The render grid must contain every height boundary, not interpolate a
  // flat picture across steps which only exist in the collision function.
  const {xs,zs}=showerCuts(p);
  for(let i=1;i<xs.length;i++)for(let j=1;j<zs.length;j++){
   const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2,y=showerFloor(p,x,z),e=1e-6;
   for(const a of [xs[i-1]+e,xs[i]-e])for(const b of [zs[j-1]+e,zs[j]-e])assert.equal(showerFloor(p,a,b),y,'one render cell has one floor height');
  }
 }
});

test('shower fold: crossing is directional, reversible and never triggered by spawning or a position jump',()=>{
 const p=showerPlan({W:18,D:26,H:6.6}),[a,b]=p.folds;
 const before={x:a.x+.2,z:a.z+.05},after={x:a.x+.2,z:a.z-.05};
 const landed=foldCrossing(a,before,after);
 assert.deepEqual(landed,{x:b.x+.2,z:after.z});
 const returned=foldCrossing(b,landed,{...landed,z:b.z+.05});
 assert.ok(Math.abs(returned.x-before.x)<1e-9);assert.equal(returned.z,before.z);
 assert.equal(foldCrossing(a,null,after),null);
 assert.equal(foldCrossing(a,after,before),null);
 assert.equal(foldCrossing(a,{x:a.x,z:a.z+.9},after),null);
 assert.equal(foldCrossing(a,{x:a.x+1,z:a.z+.05},{x:a.x+1,z:a.z-.05}),null);
 assert.equal(foldCrossing(a,before,before),null);
});

const draw=new Proxy({},{get:(_,k)=>k==='measureText'?s=>({width:String(s).length*6}):/Gradient/.test(k)?()=>({addColorStop(){}}):()=>{},set:()=>true});
const oldDocument=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>draw})};
test.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;});

async function fixture(rot=0){
 const {build}=await import('../public/world/backrooms/rooms/locker-showers.js'),entry=DECK.find(a=>a.id==='locker-showers');
 const kit=createKit(),g=generate('shower-fold-tests',{themes:['waterpark']}),W=entry.w[rot%2],D=entry.d[rot%2],H=entry.h[rot%2];
 const def={...g.rooms[0],id:0,kind:'special',arch:entry.id,rot,cx:0,cz:0,x:-(rot%2?D:W)/2-.1,z:-(rot%2?W:D)/2-.1,w:(rot%2?D:W)+.2,d:(rot%2?W:D)+.2,W,D,H,y:1.7,shape:null,panels:[],wins:[],params:{},
  doors:['front',...entry.ports].map(side=>({side,c:0,w:1.4,h:2.05,sill:0,to:0}))};
 const level={...g,theme:'waterpark',rooms:[def],links:[],windows:[],start:{room:0,x:0,z:0},exit:{...g.exit,way:'wall'}};
 const hits=[],env={kit,catalogue:await loadCatalogue(kit),level,hatches:new Map(),barricadesEnabled:true,play(){},interfere(){},sees:()=>true,hear:()=>({vol:1,pan:0}),health:{damage:n=>{hits.push(n);return {ok:true,dead:false};}},camera:{drain:()=>({ok:true})},hud:{flag(){},glitch(){}},run:{met(){},survived(){}},builders:{'locker-showers':build}};
 const warnings=[],warn=console.warn;console.warn=(...a)=>warnings.push(a.map(v=>v?.stack||v).join(' '));let world;
 try{world=await buildWorld(kit,level,env);}finally{console.warn=warn;}
 env.world=world;
 const addPlayer=(x=0,z=D/2-1)=>{
  const at=toWorld(def,x,z),input={keys:new Set(),dx:0,dy:0,stick:{x:0,y:0}},camera=new THREE.PerspectiveCamera();
  return {player:createPlayer(world,camera,{...at,yaw:rot*Math.PI/2},input),input};
 };
 const {player,input}=addPlayer();env.player=player;world.enter(world.rooms[0]);let time=0;
 const tick=(n=1)=>{for(let i=0;i<n;i++){player.update(1/60);player.me.slow=1;player.me.sinkTo=0;time+=1/60;world.update(1/60,time,player.me);}};
 return {world,kit,env,player,input,def,hits,tick,warnings,addPlayer,rt:world.rooms[0],dispose(){world.dispose();kit.dispose();}};
}
async function walkTo(f,x,z){
 const p=toWorld(f.def,x,z);f.input.keys.add('w');
 for(let i=0;i<1400&&Math.hypot(f.player.me.x-p.x,f.player.me.z-p.z)>.1;i++){
  f.player.me.yaw=Math.atan2(p.x-f.player.me.x,p.z-f.player.me.z)+Math.PI;f.tick();
 }
 f.input.keys.clear();f.player.me.vx=0;f.player.me.vz=0;
 assert.ok(Math.hypot(f.player.me.x-p.x,f.player.me.z-p.z)<.16,`reached ${x},${z}; at ${JSON.stringify(toLocal(f.def,f.player.me.x,f.player.me.z))}`);
}
const local=f=>toLocal(f.def,f.player.me.x,f.player.me.z);
function warpLocal(f,x,z){const p=toWorld(f.def,x,z);f.player.warp(p.x,p.z);f.tick(3);}

for(const rot of [0,1,2,3])test(`showers: actual bench route, wet recovery and ordinary exits (${rot})`,async t=>{
 const f=await fixture(rot);t.after(()=>f.dispose());assert.deepEqual(f.warnings,[]);assert.ok(!f.rt.flat);
 const p=f.rt.showerFold.plan;
 for(const [x,z]of p.path){await walkTo(f,x,z);assert.ok(f.player.me.duck<.05,'walkway does not force crouching');}
 await walkTo(f,0,-f.def.D/2+1);
 // A complete bank route returns to the entrance without requiring a fold.
 for(const q of [[-3.8,-p.end-.8],[-3.8,0],[-3.8,p.end+.8],[0,f.def.D/2-1]])await walkTo(f,...q);
 for(const q of [[4.15,p.end+.8],[4.15,0],[4.15,-p.end-.8],[0,-f.def.D/2+1]])await walkTo(f,...q);
 // The left generated doorway also remains an ordinary route.
 for(const q of [[-3.8,-p.end-.8],[-3.8,0],[-f.def.W/2+.6,0]])await walkTo(f,...q);
 warpLocal(f,1.65,3);await walkTo(f,3.3,3);f.tick(30);
 assert.ok(f.world.floorY(f.player.me.x,f.player.me.z)<f.def.y-.3,'visitor can step off into shallow water');
 await walkTo(f,1.65,3);f.tick(30);
 assert.ok(Math.abs(f.world.floorY(f.player.me.x,f.player.me.z)-(f.def.y+p.bench))<.001,'small visible steps recover the bench');
 f.world.scene.updateMatrixWorld(true);
 for(const [x,z]of [[0,8.13],[1.65,3.13],[-1.25,-2.13],[3.3,3.13]]){
  // Twelve-millimetre slat gaps are intentional; a sole must still find
  // visible support within three centimetres of the navigation sample.
  const at=toWorld(f.def,x,z),hit=[0,.03,-.03].map(dz=>{
   const q=toWorld(f.def,x,z+dz),ray=new THREE.Raycaster(new THREE.Vector3(q.x,f.def.y+1.3,q.z),new THREE.Vector3(0,-1,0),.001,2);
   return ray.intersectObject(f.rt.group,true).find(h=>!h.object.material?.transparent);
  }).find(Boolean);
  assert.ok(hit,`walking route has real opaque support geometry at ${x},${z}`);
  assert.ok(Math.abs(hit.point.y-f.world.floorY(at.x,at.z))<.025,'rendered floor and navigation floor agree');
 }
 assert.equal(f.hits.length,0,'quiet architecture does not add hidden damage');
});

for(const rot of [0,1,2,3])test(`showers: walk through locker, preserve height and bearing, walk back through fold (${rot})`,async t=>{
 const f=await fixture(rot);t.after(()=>f.dispose());assert.deepEqual(f.warnings,[]);const [a,b]=f.rt.showerFold.plan.folds;
 for(const q of [[3.8,f.def.D/2-2],[3.8,5.5],[4.45,5.5],[5.8,5.5],[7,5.5],[7,.55]])await walkTo(f,...q);
 assert.ok(!f.player.me.crouching,'the first frames let the visitor stand');
 await walkTo(f,7,a.z+.4);
 assert.ok(f.player.me.crouching,'the repeated frames lead into a real crawl without holding a key');
 f.world.scene.updateMatrixWorld(true);
 const body = f.player.me;
 const overhead = new THREE.Raycaster(new THREE.Vector3(body.x, body.y, body.z), new THREE.Vector3(0,1,0));
 const ceiling = overhead.intersectObject(f.rt.group,true).find(hit => !hit.object.material?.transparent);
 assert.ok(ceiling,'the low tiled ceiling exists above the camera');
 assert.ok(Math.abs(ceiling.point.y-f.world.ceilingY(body.x,body.z))<.025,'rendered clearance matches the player controller');
 const yaw=rot*Math.PI/2;f.player.me.yaw=yaw;f.input.keys.add('w');
 const y=f.world.floorY(f.player.me.x,f.player.me.z);
 for(let i=0;i<150&&local(f).x>0;i++)f.tick();
 f.input.keys.clear();const landed=local(f);
 assert.ok(Math.abs(landed.x-b.x)<.2&&landed.z<a.z,'the locker corridor returns through the other side of the room');
 assert.equal(f.player.me.yaw,yaw,'fold preserves world bearing in rotated rooms');
 assert.ok(Math.abs(f.world.floorY(f.player.me.x,f.player.me.z)-y)<.001,'fold preserves floor height');
 assert.ok(f.world.free(f.player.me.x,f.player.me.z,f.player.RADIUS),'visitor never lands inside solid geometry');
 for(const q of [[b.x,-9.2],[-3.8,-9.2]])await walkTo(f,...q);
 f.tick(45);
 assert.ok(!f.player.me.crouching,'the visitor stands again on returning to the pool');
 for(const q of [[b.x,-9.2],[b.x,a.z-.5]])await walkTo(f,...q);
 f.tick(120);
 f.player.me.yaw=yaw+Math.PI;f.input.keys.add('w');
 for(let i=0;i<150&&local(f).x<0;i++)f.tick();
 f.input.keys.clear();assert.ok(Math.abs(local(f).x-a.x)<.2,'retracing the threshold returns to the locker passage');
});

test('shower fold refuses a barricaded landing and leaves room to retreat',async t=>{
 const f=await fixture();t.after(()=>f.dispose());const [a,b]=f.rt.showerFold.plan.folds;
 // The ordinary runtime collider contract is also what dropped furniture uses.
 const p0=toWorld(f.def,b.x-1,b.z-.5),p1=toWorld(f.def,b.x+1,b.z+.5);
 const block={x0:Math.min(p0.x,p1.x),x1:Math.max(p0.x,p1.x),z0:Math.min(p0.z,p1.z),z1:Math.max(p0.z,p1.z),tall:true,top:f.def.y+2,on:true,furniture:'test-barricade'};
 f.rt.colliders.push(block);f.world.furnitureColliders.push(block);
 warpLocal(f,a.x,a.z+.25);f.player.me.yaw=0;f.input.keys.add('w');f.tick(18);f.input.keys.clear();
 assert.ok(local(f).x>0,'blocked destination never receives the visitor');
 assert.ok(f.world.free(f.player.me.x,f.player.me.z,f.player.RADIUS));
 await walkTo(f,a.x,a.z+.5);
});

test('two visitors carry independent fold history through the co-op zone dispatcher',async t=>{
 const f=await fixture();t.after(()=>f.dispose());const [a,b]=f.rt.showerFold.plan.folds;
 const second=f.addPlayer(a.x,a.z+.3),v1={id:'one',health:4,me:f.player.me,player:f.player},v2={id:'two',health:4,me:second.player.me,player:second.player};
 const population=createPopulation(f.world,(v,fn)=>{const previous=f.env.player;f.env.player=v.player;try{return fn();}finally{f.env.player=previous;}});
 const position=(v,x,z)=>{const p=toWorld(f.def,x,z);v.player.warp(p.x,p.z);};
 position(v1,a.x,a.z+.1);position(v2,a.x,a.z+.3);population.update(1/60,0,[v1,v2]);
 position(v1,a.x,a.z-.05);population.update(1/60,1/60,[v1,v2]);
 assert.ok(Math.abs(toLocal(f.def,v1.me.x,v1.me.z).x-b.x)<.01,'first visitor crosses');
 assert.ok(Math.abs(toLocal(f.def,v2.me.x,v2.me.z).x-a.x)<.01,'second visitor is not dragged along');
 position(v2,a.x,a.z-.05);population.update(1/60,2/60,[v1,v2]);
 assert.ok(Math.abs(toLocal(f.def,v2.me.x,v2.me.z).x-b.x)<.01,'second visitor crosses using their own previous sample');
});

test('a carried trolley crosses with its visitor, while a laid prop is not pulled through the fold',async t=>{
 const f=await fixture();t.after(()=>f.dispose());const [a,b]=f.rt.showerFold.plan.folds,cart=f.rt.showerFold.cart;
 warpLocal(f,a.x,a.z+.08);
 const source=toWorld(f.def,a.x,a.z+.08);
 cart.carried=true;cart.collider.on=false;cart.translate(source.x-cart.x+.35,source.z-cart.z+.5,0);f.env.grip={held:cart};
 const before={x:cart.x,z:cart.z},dx=toWorld(f.def,b.x,b.z).x-toWorld(f.def,a.x,a.z).x;
 f.player.me.yaw=0;f.input.keys.add('w');
 for(let i=0;i<20&&local(f).x>0;i++)f.tick();
 f.input.keys.clear();assert.ok(local(f).x<0);
 assert.ok(Math.abs(cart.x-before.x-dx)<1e-8,'held object receives exactly the visitor translation');
 assert.ok(Math.abs(cart.z-before.z)<1e-8,'horizontal fold preserves the held depth offset');
 cart.carried=false;f.env.grip={held:cart};
 warpLocal(f,a.x,a.z+.08);f.player.me.yaw=0;f.input.keys.add('w');f.tick(15);f.input.keys.clear();
 assert.ok(local(f).x>0,'a prop which is still laid is never dragged out from under another visitor');
});

test('a visitor can immediately reverse a fold without a cooldown swallowing the crossing',async t=>{
 const f=await fixture();t.after(()=>f.dispose());const [a,b]=f.rt.showerFold.plan.folds;
 const visitor={id:'one',health:4,me:f.player.me,player:f.player};
 const population=createPopulation(f.world,(v,fn)=>fn());
 const position=(x,z)=>{const p=toWorld(f.def,x,z);f.player.warp(p.x,p.z);};
 position(a.x,a.z+.04);population.update(1/60,0,[visitor]);
 position(a.x,a.z-.01);population.update(1/60,1/60,[visitor]);
 assert.ok(Math.abs(local(f).x-b.x)<.01);
 position(b.x,b.z+.03);population.update(1/60,2/60,[visitor]);
 assert.ok(Math.abs(local(f).x-a.x)<.01,'turning back is allowed immediately; standing still still cannot ping-pong');
 population.update(1/60,3/60,[visitor]);assert.ok(Math.abs(local(f).x-a.x)<.01);
});

test('a shower figure sways in place and only turns toward a visitor it can see', async t => {
 const f = await fixture(1);
 t.after(() => f.dispose());
 const body = f.rt.group.getObjectByName('shower-figure');
 const head = body.getObjectByName('shower-figure-head');
 const anchor = body.position.clone();

 warpLocal(f, -3.82, 6.8);
 f.tick(120);
 assert.ok(head.rotation.y > .12, 'the head angles toward a visitor at the stall opening');
 const leaning = body.rotation.x;
 f.tick(180);
 assert.ok(Math.abs(body.rotation.x - leaning) > .005, 'the torso continues its slow sway');
 assert.ok(Math.abs(head.rotation.y) <= .28, 'it never turns enough to follow a visitor all the way around');

 warpLocal(f, -5.45, 6);
 f.tick(240);
 assert.ok(Math.abs(head.rotation.y) < .01, 'the dividing wall cuts its view');
 assert.ok(body.position.equals(anchor), 'its base never moves from the shower');
 assert.equal(f.hits.length, 0);
});
