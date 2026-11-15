import test from 'node:test';
import assert from 'node:assert/strict';
import { TONER, perched, stepToner, strikeToner, snipToner, planTonerLunge, tonerWallGoal } from '../public/world/backrooms/cast/toner.rule.js';
const rnd=()=>.5, dt=1/60;
const sense={d:3,los:true,audible:true,moving:true,speed:3.4,sink:0};
test('stalking has no contact damage and a full warning before a jump',()=>{
 let s={...perched(rnd),mode:'chase',attackT:TONER.stalkTime};
 for(let t=0;t<TONER.stalkTime-.1;t+=dt){s=stepToner(s,dt,{...sense,d:.1},rnd);assert.equal(s.mode,'chase');assert.equal(s.bite,false);}
 while(s.mode==='chase')s=stepToner(s,dt,sense,rnd);
 assert.equal(s.mode,'windup');
 for(let t=0;t<TONER.windupTime-.05;t+=dt){s=stepToner(s,dt,sense,rnd);assert.equal(s.mode,'windup');assert.equal(s.bite,false);}
 while(s.mode==='windup')s=stepToner(s,dt,sense,rnd);
 assert.equal(s.mode,'lunge');assert.equal(s.bite,false);
});
test('exactly a quarter of stratified aim rolls target the locked player position',()=>{
 const from={x:0,z:0},player={x:0,z:5};let accurate=0;
 for(let i=0;i<100;i++){let n=0;const p=planTonerLunge(from,player,()=>n++===0?(i+.5)/100:.9);accurate+=p.accurate?1:0;
 if(!p.accurate)assert.equal(Math.abs(p.x),TONER.missWidth);
 player.x=10;assert.notEqual(p.x,10,'aim is a value, not a live player reference');player.x=0;}
 assert.equal(accurate,25);
});
test('leaps need actual contact and cannot hit through cover, above the player, or during pack recovery',()=>{
 const s={...perched(rnd),mode:'lunge',t:.4};
 assert.equal(stepToner(s,dt,{...sense,d:.3,inReach:true},rnd).bite,true);
 for(const x of [{d:2},{los:false},{inReach:false},{attackBlocked:true},{blockedByDoor:true},{cannot:true},{fleeingFire:true}])
 assert.equal(stepToner(s,dt,{...sense,d:.3,...x},rnd).bite,false);
 for(const mode of ['windup','lunge']) assert.equal(snipToner({...s,mode},rnd).mode,'recoil');
});
test('every miss retreats; a landed hit cannot repeat in fifteen seconds',()=>{
 let s=stepToner({...perched(rnd),mode:'lunge',t:.01},dt,sense,rnd);
 assert.equal(s.mode,'recoil');assert.equal(s.hits,0);assert.ok(s.t>=10);
 s=strikeToner({...perched(rnd),mode:'lunge'},{landed:true},()=>0);
 for(let t=0;t<15;t+=dt){s=stepToner(s,dt,{...sense,d:.1},rnd);assert.equal(s.mode,'recoil');assert.equal(s.bite,false);}
});
test('wall circuits visit all sides rather than following a target into the middle',()=>{
 const rect={x0:-4,x1:4,z0:-4,z1:4};
 for(const flip of [-1,1]){const goals=Array.from({length:4},(_,i)=>tonerWallGoal(rect,i,flip));
 assert.equal(new Set(goals.map(g=>JSON.stringify(g))).size,4);
 for(const g of goals)assert.ok(Math.abs(g.x)>3.5&&Math.abs(g.z)>3.5);}
});
