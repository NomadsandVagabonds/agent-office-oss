import test from 'node:test';import assert from 'node:assert/strict';
import {coopVisit,floorOf} from '../public/world/coop/visit.js';
import {carryFloor,beginTransition,floorReady} from '../public/world/coop/transition.js';
const sample=()=>({phase:'descending',depth:0,depths:3,time:71,players:[{id:'a',character:'yellow-alien',health:2,battery:53,hitCooldown:.8,bag:['a-item']},{id:'b',character:'pink-cowgirl',health:0,battery:0,bag:['b-item']}],items:[{id:'a-item',owner:'a'},{id:'b-item',owner:'b'},{id:'ground',owner:null},{id:'eaten',owner:'used'}],trade:{},descent:{},exitOpen:true,nodes:[1],nodeCount:1,visited:['0:1']});
test('real visit spans four themed floors, the production deck and Suburbia and one final wall',()=>{
 for(let seed=0;seed<8;seed++){
  const v=coopVisit('run-'+seed);assert.equal(v.depths,4);
  for(let i=0;i<v.depths;i++){const l=floorOf(v,i);assert.equal(l.depth,i);assert.ok(l.rooms.length>=20);assert.equal(l.exit.way==='wall',i===v.depths-1);assert.ok(v.floors.some(f=>f.theme==='suburb'));}
 }
});
test('descent preserves wounds, empty cameras, cooldowns and both bags; ground loot does not follow',()=>{
 const s=sample(),out=carryFloor(s,1);assert.equal(out.depth,1);assert.deepEqual(out.players.map(p=>p.character),['yellow-alien','pink-cowgirl']);assert.equal(out.time,71);assert.deepEqual(out.items.map(i=>i.id),['a-item','b-item']);assert.equal(out.players[0].health,2);assert.equal(out.players[0].hitCooldown,.8);assert.equal(out.players[1].health,0);assert.equal(out.players[1].battery,0);assert.equal(out.exitOpen,undefined);assert.equal(out.trade,null);assert.equal(s.items.length,4);
});
test('both clients must finish the same floor; duplicates, stale readiness and disconnect cannot restart a run',()=>{
 const r={state:{phase:'play'},depth:0,clients:new Map([['a',{}],['b',{}]])};const s=sample();
 assert.equal(beginTransition(r,{...s,depth:1}),null);assert.equal(beginTransition(r,{...s,depths:1}),null);
 assert.equal(beginTransition(r,s).depth,1);assert.equal(beginTransition(r,s),null);
 assert.equal(floorReady(r,'a',0),null);assert.equal(floorReady(r,'intruder',1),null);assert.equal(floorReady(r,'a',1),null);assert.equal(floorReady(r,'a',1),null);
 const start=floorReady(r,'b',1);assert.equal(start.type,'floor-start');assert.equal(r.depth,1);assert.equal(r.state.phase,'play');assert.equal(floorReady(r,'b',1),null);
 beginTransition(r,{...s,depth:1});r.state.phase='disconnected';assert.equal(floorReady(r,'a',2),null);
});
