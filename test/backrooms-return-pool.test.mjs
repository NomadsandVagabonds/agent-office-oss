import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { poolPlan, poolFloor, poolState, stepPool, turnValve } from '../public/world/backrooms/rooms/return-pool/rule.js';
const root=new URL('../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`,import.meta.url);
const [{ createKit }, { buildWorld, loadCatalogue }, { generate }, { toWorld, wallPoint }, { createPlayer }, THREE, {build}]=await Promise.all([
  import('../public/world/backrooms/kit.js'),import('../public/world/backrooms/world.js'),import('../public/world/backrooms/gen.js'),
  import('../public/world/backrooms/frame.js'),import('../public/world/backrooms/player.js'),import('../public/vendor/three.module.min.js'),import('../public/world/backrooms/rooms/return-pool.js')]);
const previousDocument=globalThis.document;
const draw=new Proxy({}, {get:(_,k)=>k==='measureText'?s=>({width:String(s).length*6}):/Gradient/.test(k)?()=>({addColorStop(){}}):()=>{},set:()=>true});
globalThis.document={createElement:()=>({getContext:()=>draw})};
test.after(()=>{globalThis.document=previousDocument;});
const plan=poolPlan({W:14,D:24,H:6});
test('return folds only a forward crossing, preserves offset and stops after three cranks',()=>{
  const s=poolState(), me={inside:true,x:plan.fold.x+.2,z:plan.fold.z+.1};
  stepPool(s,.02,me,plan); assert.equal(s.warp,null);
  me.z-=.2;stepPool(s,.02,me,plan);
  assert.equal(s.laps,1);assert.equal(s.warp.x,me.x);assert.ok(Math.abs(s.warp.z-(plan.fold.toZ-.1))<1e-9);
  for(let i=0;i<3;i++) {assert.ok(turnValve(s));assert.equal(turnValve(s),false);for(let j=0;j<20;j++)stepPool(s,.1,{...me,inside:false},plan);}
  me.z=plan.fold.z+.1;stepPool(s,.02,me,plan);me.z-=.2;stepPool(s,.02,me,plan);assert.equal(s.warp,null);
  assert.equal(turnValve(s),false);
  const back=poolState();stepPool(back,.02,{...me,z:plan.fold.z-.1},plan);stepPool(back,.02,{...me,z:plan.fold.z+.1},plan);assert.equal(back.warp,null);
});
test('wake warns before pursuing, cannot hurt a dry visitor and spaces repeat hits',()=>{
  const s=poolState(), wet={inside:true,x:.7,z:-.7}, events=[];
  let warned=false;
  for(let i=0;i<1400;i++) {
    stepPool(s,.02,wet,plan);warned ||= s.warning;
    if(s.hit){assert.ok(warned);events.push(i*.02);}
  }
  assert.ok(events.length>=2);assert.ok(events[0]>2.3);for(let i=1;i<events.length;i++)assert.ok(events[i]-events[i-1]>2.5);
  for(let i=0;i<400;i++){stepPool(s,.02,{inside:true,x:3.7,z:0},plan);assert.equal(s.hit,false);assert.equal(s.phase,'quiet');}
  assert.equal(poolFloor(plan,0,plan.island.z),0);
  for(let i=0;i<400;i++){stepPool(s,.02,{inside:true,x:0,z:plan.island.z},plan);assert.equal(s.hit,false);}
});

for(const [W,D,H,rot] of [[14,23,5.8,0],[15,25,6.2,1],[14,24,6,2],[15,23,5.8,3]])test(`real room navigation, stepped pool and fold at ${W}x${D}, rotation ${rot}`,async t=>{
  const kit=createKit(), generated=generate('return-pool-test');
  const def={...generated.rooms[0],id:0,kind:'plain',arch:'return-pool',rot,cx:0,cz:0,x:-(rot%2?D:W)/2-.1,z:-(rot%2?W:D)/2-.1,w:(rot%2?D:W)+.2,d:(rot%2?W:D)+.2,W,D,H,y:1.7,shape:null,panels:[],wins:[],
    doors:['front','back'].map(side=>({side,c:0,w:1.4,h:2.05,sill:0,to:0}))};
  const level={...generated,rooms:[def],links:[],windows:[],start:{room:0,x:0,z:0}};
  const catalogue=rot%2?await loadCatalogue(kit):{has:()=>false,geo:()=>null};
  if(rot%2)assert.ok(catalogue.has('desk'),'exercise the real office furniture too');
  const hits=[],warps=[],env={catalogue,level,play(){},interfere(){},health:{damage:n=>{hits.push(n);return {ok:true,dead:false};}},player:{warp:(...v)=>warps.push(v)},builders:{plain:build}};
  const world=await buildWorld(kit,level,env);t.after(()=>{world.dispose();kit.dispose();});
  const rt=world.rooms[0];assert.ok(rt.returnPool,'builder did not fall back');assert.ok(!rt.flat);assert.ok(rt.colliders.every(v=>v.on!==false),'no navigation repairs');
  const p=rt.returnPool.plan,walk=world.walkable(rt),reachable=walk.flood([def.doors[0]]);
  for(const dr of def.doors)assert.ok(reachable[walk.key(wallPoint(def,dr.side,dr.c,.5))],'both doorways are reachable');
  for(const point of [{x:p.valve.x+.5,z:p.valve.z+.6},{x:0,z:p.island.z},{x:p.fold.x,z:p.fold.toZ}])assert.ok(reachable[walk.key(point)],'valve, refuge and return landing are reachable');
  // Rehearse a real controller stepping into the basin and climbing out of it.
  const at=(x,z)=>toWorld(def,x,z),camera=new THREE.PerspectiveCamera(),input={keys:new Set(['w']),dx:0,dy:0,stick:{x:0,y:0}};
  const start=at(3.65,0), player=createPlayer(world,camera,{...start,yaw:rot*Math.PI/2+Math.PI/2},input);
  for(let i=0;i<90;i++)player.update(1/60);
  assert.ok(world.floorY(player.me.x,player.me.z)<def.y-.4,'walks down the visible steps');
  player.me.yaw+=Math.PI;for(let i=0;i<120;i++)player.update(1/60);
  assert.ok(Math.abs(world.floorY(player.me.x,player.me.z)-def.y)<.01,'climbs back onto dry floor');
  const me={inside:true,x:p.fold.x,z:p.fold.z+.05,world:{yaw:rot*Math.PI/2,slow:1}};
  for(const fn of rt.ticks)fn(.02,0,me);me.z-=.1;for(const fn of rt.ticks)fn(.02,.02,me);
  assert.equal(warps.length,1);const dest=at(p.fold.x,p.fold.toZ-.05);assert.ok(Math.hypot(warps[0][0]-dest.x,warps[0][1]-dest.z)<1e-8);assert.equal(warps[0][2],me.world.yaw);
  me.x=.7;me.z=-.7;for(let i=0;i<800;i++)for(const fn of rt.ticks)fn(.02,.04+i*.02,me);
  assert.ok(hits.length>0,'actual room invokes health damage');
});
