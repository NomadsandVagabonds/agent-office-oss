import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSession,join,act,tick,spot,free,los,watched,nextStep,EXIT} from '../core/coop.js';
const session=()=>{const s=createSession();join(s,'a');join(s,'b');act(s,'a',{type:'ready'});act(s,'b',{type:'ready'});return s;};
test('two slots, ready barrier, no joining a running match',()=>{const s=createSession();join(s,'a');act(s,'a',{type:'ready'});assert.equal(s.phase,'waiting');join(s,'b');assert.equal(join(s,'c'),null);act(s,'b',{type:'ready'});assert.equal(s.phase,'play');assert.equal(join(s,'c'),null);});
test('contested battery has exactly one owner and cannot be used by the loser',()=>{const s=session();for(const p of s.players)Object.assign(p,spot(2,2));assert.equal(act(s,'a',{type:'take',id:'supply-0'}),true);assert.equal(act(s,'b',{type:'take',id:'supply-0'}),false);assert.equal(act(s,'b',{type:'use',id:'supply-0'}),false);s.players[0].battery=200;act(s,'a',{type:'use',id:'supply-0'});assert.equal(s.players[0].battery,320);assert.equal(act(s,'a',{type:'use',id:'supply-0'}),false);});
test('range, wall and bag limits reject pickups; drop transfers possession',()=>{const s=session(),p=s.players[0],i=s.items[0];assert.equal(act(s,'a',{type:'take',id:i.id}),false);Object.assign(p,i);p.id='a';p.bag=Array(6).fill('full');assert.equal(act(s,'a',{type:'take',id:i.id}),false);p.bag=[];assert.ok(act(s,'a',{type:'take',id:i.id}));assert.ok(act(s,'a',{type:'drop',id:i.id}));Object.assign(s.players[1],{x:p.x,z:p.z});assert.ok(act(s,'b',{type:'take',id:i.id}));});
test('invalid movement ignored; speed bounded, walls solid, stale input stops',()=>{const s=session(),p=s.players[0],x=p.x;assert.equal(act(s,'a',{type:'input',f:NaN,s:0,yaw:0,pitch:0}),false);act(s,'a',{type:'input',f:1000,s:1000,yaw:0,pitch:0});tick(s,.05);assert.ok(Math.hypot(p.x-x,p.z-spot(1,1).z)<=2.05*.05+.001);for(let n=0;n<100;n++)tick(s,.05);const before=p.x;tick(s,.05);assert.equal(p.x,before);assert.ok(free(p.x,p.z));});
test('either living player can freeze pirate; walls and looking away break gaze',()=>{const s=session(),b=s.pirate;Object.assign(b,spot(3,2));Object.assign(s.players[0],{...spot(2,2),yaw:-Math.PI/2});Object.assign(s.players[1],{...spot(4,2),yaw:-Math.PI/2});s.time=9;assert.ok(watched(s.players[0],b));tick(s,.05);assert.equal(b.frozen,true);s.players[0].health=0;tick(s,.05);assert.equal(b.frozen,false);assert.equal(los(spot(5,2),spot(7,2)),false);});
test('pirate routes around walls and damages either player with cooldown',()=>{const s=session(),b=s.pirate;Object.assign(b,spot(8,2));Object.assign(s.players[1],{...spot(8,2),yaw:0});s.time=9;tick(s,.05);assert.equal(s.players[1].health,2);tick(s,.05);assert.equal(s.players[1].health,2);assert.equal(s.players[0].health,4);const step=nextStep(spot(5,2),spot(7,2));assert.ok(free(step.x,step.z));assert.notDeepEqual(step,spot(7,2));});
test('dead players cannot act; survivor continues and can escape',()=>{const s=session();s.players[0].battery=.01;tick(s,.05);assert.equal(s.players[0].health,0);assert.equal(s.phase,'play');assert.equal(act(s,'a',{type:'input',f:1,s:0,yaw:0,pitch:0}),false);Object.assign(s.players[1],EXIT);assert.ok(act(s,'b',{type:'exit'}));assert.equal(s.phase,'escaped');});
test('exit requires both living visitors; two empty batteries end run',()=>{const s=session();Object.assign(s.players[0],EXIT);assert.equal(act(s,'a',{type:'exit'}),false);s.players.forEach(p=>p.battery=.01);tick(s,.05);assert.equal(s.phase,'dead');});
test('all open tiles reachable by pirate pathfinder',()=>{for(let z=1;z<8;z++)for(let x=1;x<12;x++){const target=spot(x,z);if(!free(target.x,target.z))continue;let a=spot(1,1);for(let n=0;n<80&&Math.hypot(a.x-target.x,a.z-target.z)>.1;n++)a=nextStep(a,target);assert.deepEqual(a,target);}});

test('pirate starts on carpet and can physically reach every open tile',()=>{
 for(let z=1;z<8;z++)for(let x=1;x<12;x++){
  const target=spot(x,z);if(!free(target.x,target.z))continue;
  const s=session();assert.ok(free(s.pirate.x,s.pirate.z));s.players[1].health=0;
  Object.assign(s.players[0],target,{pitch:1.2,battery:400});s.time=9;
  for(let n=0;n<3500&&s.players[0].health===4;n++)tick(s,.05);
  assert.ok(s.players[0].health<4,`unreachable ${x},${z}`);
 }
});
