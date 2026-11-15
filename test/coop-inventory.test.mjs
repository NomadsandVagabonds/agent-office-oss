import test from 'node:test';import assert from 'node:assert/strict';
import {createInventory,makeItem} from '../public/world/backrooms/inventory-state.js';
import {inventoryAct,reconcileInventory,tickInventory,lightPower} from '../public/world/coop/inventory.js';
import {carryFloor} from '../public/world/coop/transition.js';
import {socialAct} from '../public/world/coop/social-rules.js';
import {coopSupplies} from '../public/world/coop/supplies.js';
import {coopVisit,floorOf} from '../public/world/coop/visit.js';
function setup(types=[]){
 const p={id:'a',x:0,z:0,y:1.1,health:3,battery:200,bag:[]},q={...p,id:'b',bag:[]};
 const s={phase:'play',time:0,depth:0,depths:3,players:[p,q],items:types.map(([type,id,extra])=>({...makeItem(type,id,extra),owner:null,x:0,z:0,y:0}))};
 const ctx={canTake:()=>true,dropSpot:()=>({x:1,z:0,y:0}),ignite:()=>({ok:true}),mark:()=>({ok:true}),heal:n=>{p.health+=n;return {ok:true,amount:n};},canReach:()=>true,revive:()=>{}};
 const act=(m,who=p)=>inventoryAct(s,who,m,ctx);return {s,p,q,ctx,act};
}
const ref=(p,id)=>({slot:p.inventory.slots.findIndex(i=>i?.id===id),id});
test('production pockets restore holes, mounted charge and selection without retaining mutable references',()=>{
 const m=createInventory();m.add(makeItem('torch','t',{prepared:true,charge:40}));m.craft([{slot:0,id:'t'},{device:'camera'}],{camera:{read:()=>({remaining:100,capacity:400})}});m.toggleLight();
 const snapshot=m.read(),r=createInventory({initial:snapshot});snapshot.mountedTorch.charge=0;r.tick(2);
 assert.equal(r.read().mountedTorch.charge,38);assert.equal(r.torchPower(),1);assert.equal(m.read().mountedTorch.charge,40);
 assert.throws(()=>createInventory({initial:{...snapshot,slots:[makeItem('torch','t'),null,null,null,null,null]}}),/Duplicate/);
});
test('one ground stack cannot duplicate; partial paper pickup leaves only the unaccepted sheets',()=>{
 const {s,p,q,act}=setup([['paper','p1',{quantity:8}],['paper','p2',{quantity:5}],...Array.from({length:5},(_,i)=>['snack','s'+i])]);
 for(const id of ['p1','s0','s1','s2','s3','s4'])act({type:'take',id});act({type:'take',id:'p2'});
 assert.equal(p.inventory.slots[0].quantity,10);assert.equal(s.items.find(i=>i.id==='p2').quantity,3);
 act({type:'take',id:'p2'},q);act({type:'take',id:'p2'});assert.equal(q.inventory.slots[0].quantity,3);assert.equal(p.bag.length,6);
});
test('crafts revalidate ownership and identity, consume once, mount outside pockets and recharge equipment',()=>{
 const {s,p,q,act}=setup([['torch','t',{charge:20}],['tape','tape'],['battery','b1'],['battery','b2']]);
 for(const i of s.items)act({type:'take',id:i.id});
 const tape=[ref(p,'t'),ref(p,'tape')];act({type:'craft',refs:tape},q);assert.equal(p.inventory.slots[0].prepared,false);
 act({type:'craft',refs:tape});act({type:'craft',refs:tape});assert.equal(p.bag.length,3);assert.equal(p.inventory.slots[0].prepared,true);
 act({type:'craft',refs:[ref(p,'t'),{device:'camera'}]});assert.equal(p.bag.length,2);assert.equal(p.inventory.mountedTorch.id,'t');
 act({type:'toggle-light'});tickInventory(s,p,2);assert.equal(p.inventory.mountedTorch.charge,18);assert.equal(lightPower(p),1);
 act({type:'craft',refs:[ref(p,'b1'),{device:'mounted-torch',id:'t'}]});assert.equal(p.inventory.mountedTorch.charge,180);
 const refs=[ref(p,'b2'),{device:'camera'}];act({type:'craft',refs});act({type:'craft',refs});assert.equal(p.battery,320);assert.equal(p.bag.length,0);
 const carried=carryFloor(s,1);reconcileInventory(carried,carried.players[0]);assert.equal(carried.players[0].inventory.mountedTorch.charge,180);assert.equal(lightPower(carried.players[0]),1);
});
test('loose torches drain only while selected and equipped; dropped torch retains charge for the other visitor',()=>{
 const {s,p,q,act}=setup([['torch','t',{charge:90}],['snack','s']]);act({type:'take',id:'t'});act({type:'take',id:'s'});act({type:'toggle-light'});tickInventory(s,p,5);assert.equal(lightPower(p),1);
 act({type:'select',slot:1});tickInventory(s,p,10);assert.equal(lightPower(p),0);assert.equal(p.inventory.slots[0].charge,85);
 act({type:'select',slot:0});act({type:'select',slot:0,toggle:true});tickInventory(s,p,10);assert.equal(lightPower(p),0);
 act({type:'select',slot:0});act({type:'drop',id:'t'});act({type:'take',id:'t'},q);assert.equal(q.inventory.slots[0].charge,85);assert.equal(lightPower(p),0);
});
test('fire placement failure spends nothing; successful fire spends chosen sheets and retains the lighter',()=>{
 const {s,p,ctx,act}=setup([['paper','p',{quantity:5}],['lighter','l']]);for(const i of s.items)act({type:'take',id:i.id});const refs=[ref(p,'p'),ref(p,'l')];
 ctx.ignite=()=>({ok:false,reason:'no-fire-space'});act({type:'craft',refs,paperCount:3});assert.equal(p.inventory.slots[0].quantity,5);
 let seconds;ctx.ignite=spec=>{seconds=spec.duration;return {ok:true};};act({type:'craft',refs,paperCount:3});assert.equal(seconds,24);assert.equal(p.inventory.slots[0].quantity,2);assert.ok(p.bag.includes('l'));
 act({type:'craft',refs,paperCount:3});assert.equal(p.inventory.slots[0].quantity,2);
});
test('trade moves prepared gear with its remaining charge; consumed offers cancel rather than committing stale items',()=>{
 const {s,p,q,ctx,act}=setup([['torch','t',{charge:37,prepared:true}],['snack','s']]);act({type:'take',id:'t'});act({type:'take',id:'s'},q);
 socialAct(s,p.id,{type:'trade-request'},ctx);const trade=s.trade.id;
 socialAct(s,q.id,{type:'trade-answer',trade,accept:true},ctx);socialAct(s,p.id,{type:'trade-offer',trade,revision:0,item:'t'},ctx);
 socialAct(s,p.id,{type:'trade-confirm',trade,revision:1},ctx);socialAct(s,q.id,{type:'trade-confirm',trade,revision:1},ctx);
 reconcileInventory(s,p);reconcileInventory(s,q);assert.equal(p.bag.length,0);assert.equal(q.inventory.slots[1].charge,37);assert.equal(q.inventory.slots[1].prepared,true);
 s.time=10;socialAct(s,q.id,{type:'trade-request'},ctx);act({type:'use',id:'s'},q);assert.equal(s.trade,null);
});
test('supplies use deterministic production placement with two early torches and scaled refill opportunities',()=>{
 const level=floorOf(coopVisit('inventory-review'),0),one=coopSupplies(level,1),two=coopSupplies(level,2);
 assert.deepEqual(two,coopSupplies(level,2));assert.equal(two.filter(i=>i.type==='battery').length,one.filter(i=>i.type==='battery').length*2);
 assert.equal(two.filter(i=>i.type==='torch').length,2);assert.equal(two.filter(i=>i.type==='tape').length,2);assert.ok(two.some(i=>i.type==='lighter'));assert.equal(new Set(two.map(i=>i.id)).size,two.length);
});

test('room gifts and consumed offerings use the same authoritative pockets as trades',async()=>{
 const {mutateInventory,reconcileInventory}=await import('../public/world/coop/inventory.js');
 const s={phase:'play',time:0,items:[],players:[],trade:{pending:true}},p={id:'guest',x:1,z:2,y:1.1,bag:[]};s.players=[p];
 assert.equal(mutateInventory(s,p,m=>m.add(makeItem('paper','offering',{quantity:3}))).ok,true);
 assert.equal(s.trade,null);assert.deepEqual(p.bag,['offering']);
 assert.equal(mutateInventory(s,p,m=>m.consumeSelected('paper',1)).ok,true);
 assert.equal(s.items[0].quantity,2);assert.equal(reconcileInventory(s,p).read().slots[0].quantity,2);
 assert.equal(mutateInventory(s,p,m=>m.consumeSelected('balloon',1)).ok,false);
 assert.equal(s.items[0].quantity,2);
});
