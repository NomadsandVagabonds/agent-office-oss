import test from 'node:test';import assert from 'node:assert/strict';
import {chooseVisitor,seesVisitor} from '../public/world/coop/visitors.js';
import {createHealth} from '../public/world/backrooms/health-state.js';
const v=(id,x,z,yaw=0)=>({id,me:{x,z,yaw,pitch:0},health:4,healthModel:createHealth()});
const world={los:()=>true};
test('a farther staring partner arms the shadow; proximity alone does not select the inattentive host',()=>{
 const a=v('host',0,2,Math.PI),b=v('guest',0,5),at={x:0,z:0};
 assert.equal(chooseVisitor([a,b],at,'shadow',world),b);
 assert.equal(chooseVisitor([a,b],at,'pirate',world),a);
 assert.equal(seesVisitor(a,at,world),false);assert.equal(seesVisitor(b,at,world),true);
 a.me.z=.5;assert.equal(chooseVisitor([a,b],at,'shadow',world),a,'touch remains dangerous');
 a.held=true;assert.equal(chooseVisitor([a,b],at,'pirate',world),b);
 b.healthModel.damage(4);assert.equal(chooseVisitor([a,b],at,'pirate',world),null);
});
test('walls, looking away, and death exclude a partner from shadow exposure',()=>{
 const a=v('a',0,5),at={x:0,z:0};assert.equal(seesVisitor(a,at,{los:()=>false}),false);
 a.me.pitch=1.2;assert.equal(seesVisitor(a,at,world),false);a.me.pitch=0;a.health=0;assert.equal(seesVisitor(a,at,world),false);
});
