import test from 'node:test';
import assert from 'node:assert/strict';
import {coopVisit,floorOf} from '../public/world/coop/visit.js';
import {SHOWCASE} from '../public/world/coop/showcase.js';
import {SHOWCASE_SEED} from '../core/coop-routes.mjs';
import {ARCHETYPES,lessons,isBig,roomDistances,lessonsOf} from '../public/world/backrooms/gen.js';
import {castFor,CAST,homeFor} from '../public/world/backrooms/cast.js';
import {coopSupplies} from '../public/world/coop/supplies.js';

test('showcase guarantees its 27 discoveries, all six cast types and a quiet connected maze between them',()=>{
 const v=coopVisit('private-invite-a',{route:'showcase'}),known=new Set(['lean']),seen=new Set();
 assert.equal(v.seed,SHOWCASE_SEED);assert.equal(v.depths,5);assert.equal(v.floors[2].theme,'suburb');
 for(let i=0;i<v.depths;i++){
  const l=floorOf(v,i),special=l.rooms.filter(r=>r.arch),fromStart=roomDistances(l,l.start.room);
  assert.deepEqual(special.map(r=>r.arch).sort(),[...SHOWCASE[i].rooms].sort(),'no missing or filler features');
  assert.equal(fromStart.size,l.rooms.length,'every room is connected');
  assert.ok(fromStart.get(l.exit.room)>=8,'exit is not beside the entrance');
  const quiet=l.rooms.filter(r=>['plain','start'].includes(r.kind)).length/l.rooms.length;
  assert.ok(quiet>=.7&&quiet<=.8,`floor ${i}: quiet share ${quiet}`);
  assert.ok(special.filter(r=>isBig(ARCHETYPES[r.arch])).length<=1);
  for(const r of special){
   assert.ok(!seen.has(r.arch),'no repeated feature rooms');seen.add(r.arch);
   for(const need of lessons(ARCHETYPES[r.arch]).needs)assert.ok(known.has(need),`${r.arch} needs ${need} from an earlier floor`);
   for(const other of special)if(other!==r)assert.ok(roomDistances(l,r.id).get(other.id)>=2,'no adjacent special rooms');
  }
  assert.deepEqual(castFor(v,i).map(m=>m.id),[...SHOWCASE[i].members]);
  for(const m of castFor(v,i)){const def=CAST.find(c=>c.id===m.id);if(def.home==='room')assert.notEqual(homeFor(l,def),null,`${m.id} has an actual home`);}
  const supplies=coopSupplies(l,2,v);assert.ok(supplies.filter(s=>s.type==='battery').length>=4);assert.ok(supplies.filter(s=>s.type==='snack').length>=2);
  assert.equal(l.exit.way==='wall',i===v.depths-1);
  assert.equal(!!l.pursuer,SHOWCASE[i].members.includes('pirate'),'pirate spawn follows the authored schedule');
  if(i===0){assert.ok(special.some(r=>r.arch==='party'));assert.ok(special.some(r=>r.arch==='cutouts'));assert.ok(castFor(v,0).some(m=>m.id==='pirate'));}
  lessonsOf(l).forEach(x=>known.add(x));
 }
 assert.equal(seen.size,27);assert.deepEqual([...new Set(castFor(v).map(m=>m.id))].sort(),CAST.map(m=>m.id).sort());
});
test('separate invites produce the same showcase including Suburbia; normal visits keep their random dealer',()=>{
 const a=coopVisit('invite-a',{route:'showcase',slice:true}),b=coopVisit('invite-b',{route:'showcase'});
 for(let i=0;i<a.depths;i++)assert.deepEqual(floorOf(a,i),floorOf(b,i));
 const normal=coopVisit('ordinary',{slice:true});assert.equal(normal.depths,1);assert.equal(normal.seed,'ordinary');assert.equal(normal.company,undefined);
});
