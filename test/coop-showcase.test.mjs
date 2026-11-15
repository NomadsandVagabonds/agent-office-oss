import test from 'node:test';
import assert from 'node:assert/strict';
import {coopVisit} from '../public/world/coop/visit.js';
import {SHOWCASE} from '../public/world/coop/showcase.js';
import {previewFloor,floorOf} from '../public/world/coop/showcase-preview.js';
import {ARCHETYPES,lessons,isBig,roomDistances,generate} from '../public/world/backrooms/gen.js';
import {castFor,homeFor,CAST} from '../public/world/backrooms/cast.js';

test('waterpark is reserved at 4; combined night finale is 5; opening keeps pirate, cake and moving cutouts',()=>{
 assert.equal(SHOWCASE.length,5);assert.equal(SHOWCASE[3].theme,'waterpark');assert.equal(SHOWCASE[3].pending,true);
 assert.ok(SHOWCASE[0].rooms.includes('party'));assert.ok(SHOWCASE[0].rooms.includes('cutouts'));assert.ok(SHOWCASE[0].members.includes('pirate'));
 assert.equal(SHOWCASE[4].theme,'night');assert.deepEqual(SHOWCASE[4].members,['other-door','shadow']);
 assert.throws(()=>coopVisit('invite',{route:'showcase'}),/waterpark/);assert.throws(()=>previewFloor(3),/not ready/);
 assert.equal(coopVisit('ordinary',{slice:true}).depths,1);
});
test('combined finale has both landmarks, earlier lessons, 70–80% quiet maze, connected exits and room for each creature',()=>{
 const v=previewFloor(4),l=floorOf(v,0),special=l.rooms.filter(r=>r.arch),seen=new Set(),fromStart=roomDistances(l,l.start.room);
 assert.deepEqual(special.map(r=>r.arch).sort(),[...SHOWCASE[4].rooms].sort());assert.equal(fromStart.size,l.rooms.length);
 const quiet=l.rooms.filter(r=>['plain','start'].includes(r.kind)).length/l.rooms.length;assert.ok(quiet>=.7&&quiet<=.8);
 assert.equal(special.filter(r=>isBig(ARCHETYPES[r.arch])).length,2);
 const mecha=special.find(r=>r.arch==='mecha'),lastLight=special.find(r=>r.arch==='last-light');
 assert.ok(roomDistances(l,mecha.id).get(lastLight.id)>=3,'at least two ordinary rooms between landmarks');
 const known=new Set(SHOWCASE.slice(0,3).flatMap(f=>f.rooms.flatMap(id=>lessons(ARCHETYPES[id]).teaches)));
 for(const r of special){for(const n of lessons(ARCHETYPES[r.arch]).needs)assert.ok(known.has(n));for(const t of special)if(t!==r)assert.ok(roomDistances(l,r.id).get(t.id)>=2);}
 for(const f of SHOWCASE)for(const id of f.rooms){assert.ok(!seen.has(id));seen.add(id);}
 assert.deepEqual(castFor(v,0).map(m=>m.id),['other-door','shadow']);assert.notEqual(homeFor(l,CAST.find(m=>m.id==='other-door')),null);
 assert.equal(l.exit.way,'wall');assert.ok(fromStart.get(l.exit.room)>=8);
 assert.deepEqual(l,floorOf(previewFloor(4),0));
});
test('ordinary floors still enforce one large set piece even when two are requested',()=>{
 assert.throws(()=>generate('ordinary-landmark-rule',{only:['mecha','last-light'],known:['beam'],count:5}),/no layout/);
 const l=generate('ordinary-landmark-rule',{only:'mecha',count:5});
 assert.equal(l.rooms.filter(r=>r.arch&&isBig(ARCHETYPES[r.arch])).length,1);
});
