import test from 'node:test';
import assert from 'node:assert/strict';
import {socialAct,socialTick,supplyPlan} from '../public/world/coop/social-rules.js';
function fixture(){
 const s={phase:'play',time:1,players:['a','b'].map(id=>({id,x:0,z:0,y:1,health:4,battery:100,bag:[]})),items:[]};
 const revived=[];const ctx={canReach:()=>true,revive:id=>revived.push(id)};
 const add=(owner,type='snack')=>{const id='i'+s.items.length;s.items.push({id,type,owner});s.players.find(p=>p.id===owner)?.bag.push(id);return id;};
 const act=(id,type,extra={})=>socialAct(s,id,{type,trade:s.trade?.id,revision:s.trade?.revision,...extra},ctx);
 const open=()=>{act('a','trade-request');act('b','trade-answer',{accept:true});};
 return {s,ctx,revived,add,act,open};
}
test('two visitors get twice the floor supplies, including six batteries and six snacks',()=>{
 assert.equal(supplyPlan(1).length,6);assert.equal(supplyPlan(2).length,12);
 assert.equal(supplyPlan(2).filter(i=>i==='battery').length,6);
});
test('snack revives once, with one heart; no eating another owner’s item or reviving through a wall',()=>{
 const {s,ctx,add,act,revived}=fixture(),snack=add('a');s.players[1].health=0;
 ctx.canReach=()=>false;act('a','revive',{item:snack});assert.equal(s.players[1].health,0);assert.equal(s.items[0].owner,'a');
 ctx.canReach=()=>true;act('a','revive',{item:snack});act('a','revive',{item:snack});
 assert.equal(s.players[1].health,1);assert.deepEqual(revived,['b']);assert.equal(s.items[0].owner,'used');assert.deepEqual(s.players[0].bag,[]);
});
test('flat camera revive requires and consumes a spare battery atomically',()=>{
 const {s,add,act}=fixture(),snack=add('a');s.players[1].health=0;s.players[1].battery=0;
 act('a','revive',{item:snack});assert.equal(s.items[0].owner,'a');assert.equal(s.players[1].health,0);
 const battery=add('a','battery');act('a','revive',{item:snack});assert.equal(s.players[1].battery,120);assert.equal(s.players[1].health,1);assert.equal(s.items.find(i=>i.id===battery).owner,'used');
});
test('trade requires invitation consent and both confirmations; an empty offer permits gifting',()=>{
 const {s,add,act}=fixture(),item=add('a');act('a','trade-request');act('a','trade-answer',{accept:true});assert.equal(s.trade.status,'pending');
 act('a','trade-offer',{item});assert.deepEqual(s.trade.offers.a,[]);
 act('b','trade-answer',{accept:true});act('a','trade-offer',{item});act('a','trade-confirm');assert.equal(s.items[0].owner,'a');
 const previous=s.trade.id;act('b','trade-confirm');assert.equal(s.items[0].owner,'b');assert.equal(s.trade,null);assert.deepEqual(s.players[1].bag,[item]);
 act('b','trade-confirm',{trade:previous,revision:1});assert.deepEqual(s.players[1].bag,[item]);
});
test('changing an offer resets consent; stale confirmations and foreign items cannot transfer',()=>{
 const {s,add,act,open}=fixture(),a=add('a'),b=add('b','battery');open();act('a','trade-offer',{item:a});act('a','trade-confirm');const rev=s.trade.revision;
 act('b','trade-offer',{item:b});assert.deepEqual(s.trade.confirmed,[]);act('a','trade-confirm',{revision:rev});assert.deepEqual(s.trade.confirmed,[]);
 act('a','trade-offer',{item:b});assert.deepEqual(s.trade.offers.a,[a]);act('a','trade-confirm');act('b','trade-confirm');assert.deepEqual(s.players.map(p=>p.bag),[[b],[a]]);
});
test('full pockets can swap but cannot receive extra items; no partial commits',()=>{
 const {s,add,act,open}=fixture();for(let i=0;i<6;i++){add('a');add('b','battery');}const a=s.players[0].bag[0],b=s.players[1].bag[0];open();act('a','trade-offer',{item:a});act('a','trade-confirm');act('b','trade-confirm');assert.equal(s.trade.status,'open');assert.equal(s.items.find(i=>i.id===a).owner,'a');
 act('b','trade-offer',{item:b});act('a','trade-confirm');act('b','trade-confirm');assert.equal(s.trade,null);assert.ok(s.players[1].bag.includes(a));assert.equal(s.players[0].bag.length,6);
});
test('separation, death, wall, expiry, decline or losing an offered item cancel without transfer',()=>{
 for(const kind of ['distance','height','dead','wall','expiry','decline','lost']){
  const {s,ctx,add,act,open}=fixture(),item=add('a');open();act('a','trade-offer',{item});
  if(kind==='distance')s.players[1].x=5;if(kind==='height')s.players[1].y=3;
  if(kind==='dead')s.players[1].health=0;if(kind==='wall')ctx.canReach=()=>false;
  if(kind==='expiry')s.time=100;if(kind==='decline')act('b','trade-cancel');
  if(kind==='lost')s.players[0].bag=[];
  socialTick(s,ctx);assert.equal(s.trade,null,kind);assert.equal(s.items[0].owner,'a',kind);
 }
});
test('emotes are shared, short-lived and rate limited; dead players cannot emit them',()=>{
 const {s,act}=fixture();act('a','emote',{kind:'wave'});assert.equal(s.players[0].emote.until,4);
 act('a','emote',{kind:'dance'});assert.equal(s.players[0].emote.kind,'wave');s.time=2;act('a','emote',{kind:'heart'});assert.equal(s.players[0].emote.kind,'heart');
 s.players[1].health=0;act('b','emote',{kind:'help'});assert.equal(s.players[1].emote,undefined);
});
