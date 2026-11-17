import test from 'node:test';
import assert from 'node:assert/strict';
import {channelPlan,channelFloor,channelWet,keeperState,stepKeeper,startPump,LANE_KEEPER} from '../public/world/backrooms/rooms/channel-hall/rule.js';
const p=channelPlan({W:18,D:26,H:10.6});
const me=(x=1.2,z=2)=>({x,z,inside:true,key:'a'});
function advance(s,n,at,options){for(let i=0;i<n;i++)stepKeeper(s,.02,typeof at==='function'?at(i):at,p,options);}
test('lane keeper needs sustained splashing; a still visitor never arms it',()=>{
 const s=keeperState(p);advance(s,200,me());assert.equal(s.phase,'drift');assert.equal(s.notice,0);
 advance(s,40,i=>me(1.2,2-i*.01));assert.equal(s.phase,'listen');assert.ok(s.notice<LANE_KEEPER.notice);
 advance(s,40,i=>me(1.2,1.6-i*.01));assert.equal(s.phase,'hunt');
});
test('stillness, a dry bank and a started pump each break the hunt',()=>{
 for(const way of ['still','bank','pump']){
  const s=keeperState(p);s.phase='hunt';s.notice=LANE_KEEPER.notice;s.x=-1.8;s.z=-6;
  if(way==='pump')assert.ok(startPump(s));
  advance(s,90,way==='bank'?me(5,2):me());
  assert.equal(s.phase,way==='pump'?'lured':'drift');
 }
});
test('pump is repeatable after cooldown, never spammable, and does not warp the creature',()=>{
 const s=keeperState(p),before={x:s.x,z:s.z};assert.ok(startPump(s));assert.equal(startPump(s),false);
 stepKeeper(s,.02,me(),p);assert.ok(Math.hypot(s.x-before.x,s.z-before.z)<=.045);assert.equal(s.phase,'lured');
 advance(s,810,me(5,2));assert.ok(startPump(s));
});
test('real contact is one hit followed by recovery; dry and airborne visitors are safe',()=>{
 for(const kind of ['wet','dry','air']){
  const s=keeperState(p);s.phase='hunt';s.notice=LANE_KEEPER.notice;s.x=1.2;s.z=2;
  const v=kind==='dry'?me(4.6,2):{...me(),grounded:kind!=='air'};
  stepKeeper(s,.02,v,p);assert.equal(s.hit,kind==='wet');
  if(kind==='wet'){assert.equal(s.phase,'recover');advance(s,100,v);assert.equal(s.hit,false);}
 }
});
test('a physical barricade blocks movement and contact damage',()=>{
 const s=keeperState(p);s.phase='hunt';s.notice=LANE_KEEPER.notice;s.x=1.2;s.z=2;
 stepKeeper(s,.02,me(1.3,2),p,{clear:()=>false});assert.equal(s.hit,false);assert.equal(s.x,1.2);assert.equal(s.z,2);
});
test('a visitor swap or teleport does not create a splash',()=>{
 const s=keeperState(p);stepKeeper(s,.02,me(),p);stepKeeper(s,.02,{...me(-1.2,-5),key:'b'},p);assert.equal(s.notice,0);
 stepKeeper(s,.02,{...me(1.2,4),key:'b'},p);assert.equal(s.notice,0);
});
test('the creature stays in the water while following a decoy or a visitor around the island',()=>{
 const s=keeperState(p);startPump(s);
 for(let i=0;i<3000;i++){
  const a=i*.02,v=me(Math.sin(a)*1.8,-2.8+Math.cos(a)*2.4);stepKeeper(s,.02,v,p);
  assert.ok(channelWet(p,s.x,s.z));assert.ok(Number.isFinite(s.yaw));
 }
});
test('all banks and the supply plinth can be climbed with 16cm risers',()=>{
 for(const [a,b]of [[[5,1],[0,1]],[[0,10],[0,4]],[[0,-10],[0,-4]],[[3,-2.8],[0,-2.8]]]){
  let old=channelFloor(p,...a);for(let i=1;i<=200;i++){
   const at=a.map((v,j)=>v+(b[j]-v)*i/200),y=channelFloor(p,...at);assert.ok(Math.abs(y-old)<=.16001);old=y;
  }
 }
 assert.equal(channelFloor(p,0,-2.8),-.32);assert.ok(channelFloor(p,0,-2.8)>p.water);
});
