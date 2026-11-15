import {test} from 'node:test';import assert from 'node:assert/strict';
import {createPopulation} from '../public/world/coop/population.js';
const visitor=(id,x)=>({id,health:4,me:{x,z:0,yaw:0,moving:false,speed:0}});
function fixture(){let acting;const events=[];const rooms=[0,1,2,3].map(id=>({id,def:{cx:id*10,cz:0,x:id*10-2,z:-2,w:4,d:4,W:4,D:4,rot:0},group:{visible:false},zones:[{x0:-2,x1:2,z0:-2,z1:2,enter:()=>events.push(['enter',id,acting.id]),leave:()=>events.push(['leave',id,acting.id]),stay:()=>events.push(['stay',id,acting.id])}],ticks:[()=>events.push(['tick',id,acting.id])]}));const world={rooms,roomAt:(x)=>rooms.find(r=>Math.abs(r.def.cx-x)<2),distances:id=>new Map(rooms.map(r=>[r.id,Math.abs(r.id-id)]))};return {rooms,events,pop:createPopulation(world,(v,fn)=>{acting=v;fn();})};}
test('room clocks tick once even with two occupants; zones track both visitors',()=>{const {pop,events}=fixture(),a=visitor('a',0),b=visitor('b',.5);pop.update(.05,0,[a,b]);assert.equal(events.filter(e=>e[0]==='tick'&&e[1]===0).length,1);assert.deepEqual(events.filter(e=>e[0]==='enter').map(e=>e[2]),['a','b']);events.length=0;a.me.x=10;pop.update(.05,.05,[a,b]);assert.ok(events.some(e=>e[0]==='leave'&&e[1]===0&&e[2]==='a'));assert.ok(!events.some(e=>e[0]==='leave'&&e[1]===0&&e[2]==='b'));});
test('guest room stays active when host is elsewhere, and dead visitors leave zones',()=>{const {pop,rooms,events}=fixture(),a=visitor('a',0),b=visitor('b',30);pop.update(.05,0,[a,b]);assert.ok(rooms[3].near);assert.ok(events.some(e=>e[0]==='tick'&&e[1]===3&&e[2]==='b'));events.length=0;b.health=0;pop.update(.05,.05,[a,b]);assert.equal(rooms[3].near,false);assert.ok(events.some(e=>e[0]==='leave'&&e[1]===3&&e[2]==='b'));});

test('a guest leaning on a shared room wall is not masked by its idle host',()=>{const {pop,events}=fixture(),a=visitor('a',0),b=visitor('b',.5);b.me.wishZ=1;pop.update(.05,0,[a,b]);assert.deepEqual(events.filter(e=>e[0]==='tick'&&e[1]===0),[['tick',0,'b']]);});

test('capture stays scoped to its guest while another player moves, and danger focus can select an idle guest',()=>{
 const {pop,rooms,events}=fixture(),a=visitor('a',0),b=visitor('b',.5);a.me.moving=true;rooms[0].coopHeld='b';pop.update(.05,0,[a,b]);
 assert.deepEqual(events.filter(e=>e[0]==='tick'&&e[1]===0),[['tick',0,'b']]);events.length=0;
 rooms[0].coopHeld=null;rooms[0].coopFocus=()=>[{x:.5,z:0}];pop.update(.05,.05,[a,b]);assert.deepEqual(events.filter(e=>e[0]==='tick'&&e[1]===0),[['tick',0,'b']]);
});
