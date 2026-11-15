// Exercise the production cast conductor with tiny creatures, without WebGL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHealth} from '../public/world/backrooms/health-state.js';
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
let source=readFileSync(new URL('../public/world/backrooms/pursuer.js',import.meta.url),'utf8');
const swaps={
 './gen.js':'export const makeRng=()=>()=>.5; export const roomDistances=()=>new Map();',
 './cast.js':`export const CAST=[{id:'near'},{id:'far'}];export const castFor=()=>CAST;export const homeFor=()=>null;`,
 './cast/index.js':`const make=c=>({hits:[],at:()=>({x:c.member.id==='near'?0:20,z:0}),update(){this.hits.push({visitor:c.me().id,...c.hurt(4)});}});export const MAKERS={near:make,far:make};`,
 './cast/walk.js':'export const createWalk=()=>({});',
 './doorleaf.js':'export const hangDoors=()=>({update(){}});',
};
for(const [name,stub]of Object.entries(swaps))source=source.replace(`'${name}'`,JSON.stringify(url(stub)));
source=source.replace("'../../../core/difficulty.mjs'",JSON.stringify(new URL('../core/difficulty.mjs',import.meta.url).href));
const {createStalkers}=await import(url(source));
function setup(coop){
 const visitors=[{id:'a',x:0,z:0,health:createHealth()},{id:'b',x:20,z:0,health:createHealth()}];
 const env={level:{seed:'test',depth:0},world:{},player:{me:visitors[0]},sees:()=>false};
 env.health={damage:n=>env.player.me.health.damage(n)};
 const scope=[];
 createStalkers(env,coop?{
  members:['near','far'],hasSurvivor:()=>visitors.some(v=>!v.health.read().dead),
  withVisitor(id,at,tick){const previous=env.player;env.player={me:visitors.reduce((a,b)=>Math.abs(a.x-at.x)<=Math.abs(b.x-at.x)?a:b)};scope.push(id);try{tick();}finally{env.player=previous;}}
 }:{});
 return {env,visitors,scope};
}
test('each shared creature ticks once under its own visitor; only the last loss ends the team',()=>{
 const {env,visitors,scope}=setup(true);env.pursuer.update(.1);
 assert.deepEqual(scope,['near','far']);
 assert.deepEqual(env.pursuer.of('near').hits,[{visitor:'a',landed:true,dead:true,ended:false}]);
 assert.deepEqual(env.pursuer.of('far').hits,[{visitor:'b',landed:true,dead:true,ended:true}]);
 assert.equal(env.player.me,visitors[0]);assert.equal(env.pursuer.taker.id,'far');
});
test('without co-op adapters the conductor retains the single-player ending contract',()=>{
 const {env}=setup(false);env.pursuer.update(.1);
 assert.deepEqual(env.pursuer.of('near').hits,[{visitor:'a',landed:true,dead:true,ended:true}]);
});
