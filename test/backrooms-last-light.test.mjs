import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {heldInBeam, waiting, stepHall, hallLayout, LAST_LIGHT} from '../public/world/backrooms/rooms/last-light/rule.js';
import {ITEM_DEFS, makeItem} from '../public/world/backrooms/inventory-state.js';

const root=new URL('../',import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`export function resolve(s,c,next){if(s==='three')return {url:new URL('public/vendor/three.module.min.js',${JSON.stringify(root.href)}).href,shortCircuit:true};if(s.startsWith('/core/'))return {url:new URL(s.slice(1),${JSON.stringify(root.href)}).href,shortCircuit:true};return next(s,c);}`)}`,import.meta.url);
const [{createKit},{buildWorld,loadCatalogue},{generate,toWorld,toLocal},{build}]=await Promise.all([
  import('../public/world/backrooms/kit.js'),import('../public/world/backrooms/world.js'),import('../public/world/backrooms/gen.js'),import('../public/world/backrooms/rooms/last-light.js'),
]);

test('only a powered, aimed flashlight can freeze the colleague; pitch, range and walls count',()=>{
  const eye={x:0,y:1.1,z:0,yaw:0,pitch:0},target={x:0,z:-6};
  assert.equal(heldInBeam(eye,target,1),true);
  for(const power of [0,undefined,NaN])assert.equal(heldInBeam(eye,target,power),false);
  assert.equal(heldInBeam(eye,target,1,false),false);
  assert.equal(heldInBeam({...eye,yaw:Math.PI},target,1),false);
  assert.equal(heldInBeam({...eye,pitch:1.2},target,1),false);
  assert.equal(heldInBeam(eye,{x:0,z:-13},1),false);
  assert.equal(heldInBeam(eye,{x:1,z:-6},1),true,'the beam has useful aiming tolerance');
});

test('the warning starts one cue; freeze prevents contact damage; escape scores once',()=>{
  for(const fps of [30,60,144]){
    let s=waiting(), starts=0;
    const sense={inside:true,equipped:true,trigger:true};
    for(let i=0;i<fps*3;i++){s=stepHall(s,1/fps,sense);starts+=+s.start;}
    assert.equal(starts,1);assert.equal(s.phase,'hunt');
    const frozen=stepHall(s,.1,{...sense,beam:true,distance:.2,contact:true});
    assert.equal(frozen.caught,false);
    const hit=stepHall(frozen,.1,{...sense,beam:false,distance:.2,contact:true});
    assert.equal(hit.caught,true);assert.equal(hit.phase,'recover');
    assert.equal(stepHall(hit,.1,{...sense,distance:0,contact:true}).caught,false);
    const clear=stepHall(s,.1,{...sense,clear:true});
    assert.equal(clear.escaped,true);assert.equal(stepHall(clear,1,sense).escaped,false);
  }
  assert.equal(stepHall(waiting(),10,{inside:true,trigger:true,equipped:false}).phase,'idle');
});

async function hall(t, rot=0, pockets=true){
  const previous=globalThis.document;
  const draw=new Proxy({}, {get:(_,k)=>k==='measureText'?text=>({width:String(text).length*6}):/Gradient/.test(k)?()=>({addColorStop(){}}):()=>{},set:()=>true});
  globalThis.document={createElement:()=>({getContext:()=>draw})};
  t.after(()=>{globalThis.document=previous;});
  const level=generate('last-light-test',{only:['last-light']}), original=level.rooms.find(r=>r.arch==='last-light');
  assert.ok(original,'room can be forced for review');
  const w=(rot%2?original.D:original.W)+.2, d=(rot%2?original.W:original.D)+.2;
  const def={...original,id:0,rot,x:-w/2,z:-d/2,w,d,cx:0,cz:0,y:0,doors:[],links:[],wins:[]}, kit=createKit();
  let c, power=0, hits=0, scored=0, time=0;
  const me={...toWorld(def,0,def.D/2-1),yaw:rot*Math.PI/2,pitch:0,y:(def.y||0)+1.1,speed:0,moving:false};
  const env={catalogue:await loadCatalogue(kit),barricadesEnabled:true,builders:{'last-light':ctx=>{c=ctx;build(ctx);}},
    inventory:pockets?{torchPower:()=>power}:null,play(){},health:{damage(n){hits+=n;return {ok:true,dead:false};}},
    player:{RADIUS:.22,warp(x,z){me.x=x;me.z=z;}},hud:{glitch(){}},run:{met(){},survived(){scored++;}}};
  const world=await buildWorld(kit,{...level,rooms:[def],links:[],windows:[]},env);env.world=world;
  t.after(()=>{world.dispose();kit.dispose();});
  const rt=world.rooms[0], actor=rt.lastLight.actor;
  const at=(x,z)=>{Object.assign(me,toWorld(def,x,z));};
  const aim=()=>{const p=toWorld(def,actor.x,actor.z);me.yaw=Math.atan2(me.x-p.x,me.z-p.z);me.pitch=0;};
  const tick=(n=1)=>{for(let i=0;i<n;i++){time+=.05;world.update(.05,time,me);}};
  return {c,world,rt,actor,def,kit,me,at,aim,tick,set power(v){power=v;},get hits(){return hits;},get scored(){return scored;}};
}

test('authored lighting works without the ambient flag, with four ordered fixtures and a charged torch',async t=>{
  const f=await hall(t);const {rt,world,def}=f;
  assert.equal(world.env.lighting,undefined);assert.equal(world.hasLighting,true);
  assert.equal(rt.bankPanels.length,4);assert.deepEqual(rt.lightLevels,[1,1,1,1]);
  const pickup=rt.left.find(i=>i.type==='torch');
  assert.equal(makeItem('torch','entrance',pickup).charge,ITEM_DEFS.torch.maxCharge);
  assert.ok(pickup.charge>=120,'the supplied torch lasts comfortably longer than a crossing');
  assert.ok(world.furniture.every(f=>f.lightTint),'movable office props follow the authored outage');
  const layout=hallLayout(def);
  for(let z=layout.back+.6;z<layout.front-.6;z+=.2){const p=toWorld(def,.8,z);assert.ok(world.free(p.x,p.z,.22,{ghost:true}),'continuous walkable hall');}
  for(const b of rt.colliders.filter(b=>b.keep))assert.notEqual(b.on,false,'construction rescue must not remove the corridor walls');
  f.at(0,layout.trigger-.4);f.tick(26);
  assert.equal(rt.lastLight.state.phase,'hunt');
  f.tick(18);assert.ok(rt.lightLevels[0]<.02&&rt.lightLevels[1]>.9,'far fixture fails first');
  f.tick(70);assert.ok(rt.lightLevels.every(k=>k<.02));
  let meshes=0,triangles=0;world.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  assert.ok(meshes<=45,`${meshes} meshes`);assert.ok(triangles<=120000,`${triangles} triangles`);assert.ok(rt.lights.length<=16);
});

test('the actual creature advances, freezes in the beam, and resumes when power is stowed or aim leaves it',async t=>{
  const f=await hall(t,1);f.at(0,1);f.tick(30);
  const before=f.actor.z;f.tick(20);assert.ok(f.actor.z>before+.7);
  f.power=1;f.aim();f.tick();const held={x:f.actor.x,z:f.actor.z,rot:f.actor.group.rotation.y};
  f.tick(30);assert.deepEqual({x:f.actor.x,z:f.actor.z,rot:f.actor.group.rotation.y},held);
  assert.equal(f.rt.lastLight.state.frozen,true);
  f.me.pitch=1.2;f.tick(10);assert.ok(f.actor.z>held.z+.4,'looking at the ceiling releases it');
  f.aim();f.power=0;const dark=f.actor.z;f.tick(10);assert.ok(f.actor.z>dark+.4,'an off/stowed torch cannot hold it');
});

test('a physical barricade prevents both walking and contact damage through it',async t=>{
  const f=await hall(t,2);f.at(0,-3.1);f.tick(26);
  f.actor.x=0;f.actor.z=-3.65;f.actor.group.position.set(0,0,-3.65);
  const a=toWorld(f.def,-1.3,-3.48),b=toWorld(f.def,1.3,-3.42);
  const col={x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z),on:true,top:1.2,furniture:'test-desk'};
  f.rt.colliders.push(col);f.world.furnitureColliders.push(col);
  f.tick(100);assert.equal(f.hits,0);assert.ok(f.actor.z<-3.4);
});

test('a surviving grab costs one heart, returns to the foyer, and gives recovery time',async t=>{
  const f=await hall(t);f.at(0,1);f.tick(26);
  f.actor.x=0;f.actor.z=.6;f.actor.group.position.set(0,0,.6);f.tick();
  assert.equal(f.hits,1);assert.equal(f.rt.lastLight.state.phase,'recover');
  assert.ok(toLocal(f.def,f.me.x,f.me.z).z>f.rt.lastLight.layout.trigger);
  f.tick(70);assert.equal(f.hits,1);
});

test('a visitor can walk past the physical creature while keeping the beam on it, with no damage',async t=>{
  const f=await hall(t,3);f.power=1;
  const {layout}=f.rt.lastLight;
  for(let z=layout.front-1.1;z>layout.clear-.25;z-=.1){
    const at=toWorld(f.def,.86,z);
    assert.ok(f.world.free(at.x,at.z,.22),`the passing lane must stay clear at ${z.toFixed(1)}`);
    f.at(.86,z);f.aim();f.tick();
  }
  assert.equal(f.hits,0);assert.equal(f.rt.lastLight.state.phase,'done');assert.equal(f.scored,1);
});

test('reaching the far doorway ends the hunt once; no-inventory visits stay safe',async t=>{
  const f=await hall(t);f.at(0,1);f.tick(26);f.at(.8,f.rt.lastLight.layout.clear-.2);f.tick(20);
  assert.equal(f.rt.lastLight.state.phase,'done');assert.equal(f.scored,1);assert.equal(f.actor.physical,false);
  f.at(0,1);f.tick(20);assert.equal(f.scored,1);
  const safe=await hall(t,0,false);safe.at(0,1);safe.tick(100);assert.equal(safe.rt.lastLight.state.phase,'idle');assert.equal(safe.hits,0);
});
