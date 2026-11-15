import test from 'node:test';
import assert from 'node:assert/strict';
import {coopVisit} from '../public/world/coop/visit.js';
import {SHOWCASE} from '../public/world/coop/showcase.js';
import {previewFloor,floorOf} from '../public/world/coop/showcase-preview.js';
import {ARCHETYPES,lessons,isBig,roomDistances,generate} from '../public/world/backrooms/gen.js';
import {castFor,homeFor,CAST} from '../public/world/backrooms/cast.js';

test('four-floor tour keeps the opening encounters and includes Mother and The Lines',()=>{
 assert.equal(SHOWCASE.length,4);assert.deepEqual(SHOWCASE.map(f=>f.theme),['yellow','fitout','suburb','night']);
 assert.ok(SHOWCASE[0].rooms.includes('party'));assert.ok(SHOWCASE[0].rooms.includes('cutouts'));assert.ok(SHOWCASE[0].members.includes('pirate'));
 assert.ok(SHOWCASE[1].members.includes('mother'));assert.ok(SHOWCASE[2].members.includes('the-lines'));assert.ok(SHOWCASE[2].rooms.includes('the-culvert'));
 const v=coopVisit('invite',{route:'showcase'});assert.equal(v.depths,4);
 for(let i=0;i<v.depths;i++){
  const l=floorOf(v,i),spec=SHOWCASE[i];
  assert.deepEqual(l.rooms.filter(r=>r.arch).map(r=>r.arch).sort(),[...spec.rooms].sort());
  assert.deepEqual(castFor(v,i).map(m=>m.id),spec.members);
  assert.equal(roomDistances(l,l.start.room).size,l.rooms.length);
  const quiet=l.rooms.filter(r=>['plain','start'].includes(r.kind)).length/l.rooms.length;
  assert.ok(quiet>=.65&&quiet<=.82,`floor ${i+1} quiet ratio ${quiet}`);
  if(i===3)assert.equal(l.exit.way,'wall');else assert.notEqual(l.exit.way,'wall');
 }
 assert.equal(coopVisit('ordinary',{slice:true}).depths,1);
});
test('combined finale has both landmarks, earlier lessons, 70–80% quiet maze, connected exits and room for each creature',()=>{
 const v=previewFloor(3),l=floorOf(v,0),special=l.rooms.filter(r=>r.arch),seen=new Set(),fromStart=roomDistances(l,l.start.room);
 assert.deepEqual(special.map(r=>r.arch).sort(),[...SHOWCASE[3].rooms].sort());assert.equal(fromStart.size,l.rooms.length);
 const quiet=l.rooms.filter(r=>['plain','start'].includes(r.kind)).length/l.rooms.length;assert.ok(quiet>=.7&&quiet<=.8);
 assert.equal(special.filter(r=>isBig(ARCHETYPES[r.arch])).length,2);
 const mecha=special.find(r=>r.arch==='mecha'),lastLight=special.find(r=>r.arch==='last-light');
 assert.ok(roomDistances(l,mecha.id).get(lastLight.id)>=3,'at least two ordinary rooms between landmarks');
 const known=new Set(SHOWCASE.slice(0,3).flatMap(f=>f.rooms.flatMap(id=>lessons(ARCHETYPES[id]).teaches)));
 for(const r of special){for(const n of lessons(ARCHETYPES[r.arch]).needs)assert.ok(known.has(n));for(const t of special)if(t!==r)assert.ok(roomDistances(l,r.id).get(t.id)>=2);}
 for(const f of SHOWCASE)for(const id of f.rooms){assert.ok(!seen.has(id));seen.add(id);}
 assert.deepEqual(castFor(v,0).map(m=>m.id),['other-door','shadow']);assert.notEqual(homeFor(l,CAST.find(m=>m.id==='other-door')),null);
 assert.equal(l.exit.way,'wall');assert.ok(fromStart.get(l.exit.room)>=8);
 assert.deepEqual(l,floorOf(previewFloor(3),0));
});
test('ordinary floors still enforce one large set piece even when two are requested',()=>{
 assert.throws(()=>generate('ordinary-landmark-rule',{only:['mecha','last-light'],known:['beam'],count:5}),/no layout/);
 const l=generate('ordinary-landmark-rule',{only:'mecha',count:5});
 assert.equal(l.rooms.filter(r=>r.arch&&isBig(ARCHETYPES[r.arch])).length,1);
});
