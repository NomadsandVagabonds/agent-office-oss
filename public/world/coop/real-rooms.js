// Real builders + collision + pirate controller; one trusted browser authority.
import * as THREE from 'three';
import {toWorld} from '../backrooms/gen.js';
import {createKit} from '../backrooms/kit.js';
import {buildWorld,loadCatalogue} from '../backrooms/world.js';
import {BUILDERS} from '../backrooms/rooms.js';
import {createStalkers} from '../backrooms/pursuer.js';
import {createPlayer} from '../backrooms/player.js';
import {createHealth} from '../backrooms/health-state.js';
import {resolveLook} from '/core/look.mjs';
import {socialAct,socialTick} from './social-rules.js';
import {coopVisit,floorOf} from './visit.js';
import {createPopulation} from './population.js';
import {inventoryAct,reconcileInventory,tickInventory,heldItem,lightPower,makeItem} from './inventory.js';
import {coopSupplies} from './supplies.js';
import {createInventoryWorld} from '../backrooms/inventory-world.js';
import {createHandView} from '../backrooms/hand.js';
import {createCoopLights} from './lights.js';
const nop=()=>{},dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export async function createRealRooms(seed,host,scene,{depth=0,slice=false}={}){
 const kit=createKit(),visit=coopVisit(seed,{slice}),level=floorOf(visit,depth);
 const cast=level.cast.map(name=>({name,look:resolveLook(name)}));
 let sim=null,visitors=[],active=null,acc=0,started=false,floorTime=0;
 let soundSeq=0;const sounds=[];
 const emit=(name,extra={})=>{if(!sim)return;sounds.push({seq:++soundSeq,name,...extra});if(sounds.length>64)sounds.shift();};
 const sound={play:(name,options)=>emit(name,{options,to:active?.id}),playMascot:()=>emit('mascot'),stopMascot:()=>emit('mascot-stop')};
 const env={level,visit,kit,cast,who:{look:resolveLook('visitor'),creations:{}},builders:BUILDERS,catalogue:await loadCatalogue(kit),hatches:new Map(),sound,hud:{glitch:nop,flag:nop},clock:0,
  play:(name,x,z,reach)=>emit(name,{x,z,reach}),hear:()=>({vol:1,pan:0}),interfere:nop,hold:nop,descend:at=>{if(sim&&active&&depth<visit.depths-1&&!sim.descent)sim.descent={x:at.x,z:at.z,by:active.id,ready:[]};},run:{met:nop,survived:nop},
  end:why=>{if(!sim||!active)return;if(why==='exit'){sim.exit={x:active.me.x,z:active.me.z};sim.exitOpen=true;return;}active.healthModel.damage(4);active.health=0;},
  sees(x,z,o={}){return visitors.some(v=>{if(v.health<=0)return false;const p=v.me,dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);return d<(o.far||40)&&Math.abs(p.pitch)<1.05&&(-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/Math.max(.01,d)>.6&&env.world.los(p.x,p.z,x,z);});},
  health:{damage:n=>active?.healthModel.damage(n)},camera:{drain:share=>{if(active)active.record.battery*=1-Math.max(0,Math.min(1,share));return {ok:!!active};}},
 };
 createStalkers(env,{members:['pirate','moth'],hasSurvivor:()=>visitors.some(v=>v.healthModel.read().current>0),withVisitor(id,at,tick){
  const live=visitors.filter(v=>v.healthModel.read().current>0);if(!live.length)return;
  const point=Number.isFinite(at?.x)&&Number.isFinite(at?.z)?at:level.start;
  const target=live.reduce((a,b)=>dist(a.me,point)<=dist(b.me,point)?a:b);
  withVisitor(target,tick);
 }});
 const world=env.world=await buildWorld(kit,level,env,()=>new Promise(r=>setTimeout(r,0)));scene.add(world.scene);
 // Ready runs after a player exists, as in the game's normal conductor.
 const dummy=createPlayer(world,new THREE.PerspectiveCamera(),level.start);env.player=dummy;
 for(const fn of env.ready||[])fn();
 const blocked=env.doors.blocked;
 env.doors.blocked=door=>visitors.length?visitors.filter(v=>v.healthModel.read().current>0).some(v=>withVisitor(v,()=>blocked(door))):blocked(door);
 for(const rt of world.rooms){rt.group.visible=true;rt.near=true;}
 const nodes=[];world.scene.traverse(n=>nodes.push(n));
 const pack=n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray(),n.visible?1:0];
 const initial=nodes.map(n=>JSON.stringify(pack(n)));let changed=[];
 const withVisitor=(v,fn)=>{const prev=active,player=env.player;active=v;env.player=v.player;try{return fn();}finally{active=prev;env.player=player;}};
 const population=createPopulation(world,withVisitor);
 const physical=createInventoryWorld(env,{read:()=>active?.record.inventory||{slots:[]}}, {canAct:()=>!host||sim?.phase==='play'});
 env.inventory={physical,fire:physical.fire,held:()=>active?heldItem(active.record):null,torchPower:()=>active?lightPower(active.record):0};
 const lights=createCoopLights(world,kit);let hand=null,handContext=null;
 const taken=new Map();
 const socialContext={canReach:(a,b)=>world.los(a.x,a.z,b.x,b.z),revive(id){
  const v=visitors.find(v=>v.id===id);v.healthModel=createHealth();v.healthModel.damage(3);
  v.health=1;v.me.frozen=false;v.me.vx=v.me.vz=0;v.input.keys.clear();v.age=1;
 }};
 function syncPlayers(s){
  sim=JSON.parse(JSON.stringify(s));sim.real=true;sim.depth=depth;sim.depths=visit.depths;sim.theme=level.theme;sim.visited||=[];
  visitors=sim.players.map((record,i)=>{
   const input={keys:new Set(),dx:0,dy:0,stick:{x:0,y:0},hurry:false};
   const player=createPlayer(world,new THREE.PerspectiveCamera(),level.start,input);
   player.on('step',m=>emit('step',{x:m.x,z:m.z,reach:7}));
   if(i&&world.free(player.me.x+.6,player.me.z,.23))player.me.x+=.6;
   const healthModel=createHealth();
   if(record.health<4||record.hitCooldown>0){healthModel.damage(Math.max(1,4-record.health));if(record.health===4)healthModel.heal(1);}
   if(record.health>0)healthModel.tick(Math.max(0,1.25-(record.hitCooldown||0)));
   const v={id:record.id,record,player,me:player.me,input,health:record.health,healthModel,age:1};return v;
  });
  sim.items=sim.items.filter(i=>sim.players.some(p=>i.owner===p.id&&p.bag.includes(i.id)));
  const plan=coopSupplies(level,visitors.length);
  for(const spec of plan){
   for(const room of spec.rooms){
    const rt=world.rooms.find(r=>r.id===room),pos=rt&&findSpace(rt);
    if(pos){sim.items.push({...makeItem(spec.type,`floor-${depth}-${spec.id}`,spec),...pos,y:world.floorY(pos.x,pos.z),owner:null});break;}
   }
  }
  for(const rt of world.rooms)for(const [n,left] of (rt.left||[]).entries()){
   const pos=toWorld(rt.def,left.x,left.z),id=`floor-${depth}-left-${rt.id}-${n}`;
   sim.items.push({...makeItem(left.type,id,left),...pos,y:rt.def.y+left.y,owner:null});
   if(left.taken)taken.set(id,left.taken);
  }
  for(const p of sim.players)reconcileInventory(sim,p);
  active=visitors[0];env.player=active.player;started=true;
 }
 function findSpace(rt){for(let z=-rt.def.D/2+.6;z<rt.def.D/2-.4;z+=.6)for(let x=-rt.def.W/2+.6;x<rt.def.W/2-.4;x+=.6){const p=toWorld(rt.def,x,z);if(world.free(p.x,p.z,.3)&&world.headroom(p.x,p.z)>1.3&&sim.items.every(i=>dist(i,p)>.85))return p;}return null;}
 function command(id,m){
  const v=visitors.find(v=>v.id===id);if(!v||v.health<=0||sim.phase!=='play')return;const p=v.record;
  if(socialAct(sim,id,m,socialContext)){for(const p of sim.players)reconcileInventory(sim,p);return;}
  if(withVisitor(v,()=>inventoryAct(sim,p,m,{
   canTake:i=>dist(v.me,i)<1.5&&Math.abs(world.floorY(v.me.x,v.me.z)-i.y)<1.2&&world.los(v.me.x,v.me.z,i.x,i.z),
   dropSpot:i=>{const q=physical.dropSpot(i);return q?{x:q.wx,z:q.wz,y:q.rt.def.y+q.y}:null;},
   ignite:spec=>physical.ignite(spec),mark:()=>physical.mark(),heal:n=>v.healthModel.heal(n),
  }))){
   const i=sim.items.find(i=>i.id===m.id);if(m.type==='take'&&i?.owner!==null&&taken.has(m.id)){taken.get(m.id)(i);taken.delete(m.id);}
   return;
  }
  if(m.type==='input'&&[m.f,m.s,m.yaw,m.pitch].every(Number.isFinite)){
   v.input.keys.clear();if(m.f>0)v.input.keys.add('w');if(m.f<0)v.input.keys.add('s');if(m.s>0)v.input.keys.add('d');if(m.s<0)v.input.keys.add('a');if(m.run)v.input.keys.add('Shift');
   if(m.crouch)v.input.keys.add('c');if(m.jump)v.input.keys.add(' ');
   v.me.yaw=m.yaw%(Math.PI*2);v.me.pitch=Math.max(-1.2,Math.min(1.2,m.pitch));p.input={f:m.f,s:m.s};v.age=0;
  }else if(m.type==='exit')withVisitor(v,()=>world.usable(v.me)?.use());
 }
 function step(dt,s){
  if(!host)return null;if(!started){if(s?.phase!=='play')return null;syncPlayers(s);}
  if(sim.phase!=='play')return sim;
  dt=Math.min(.05,dt);sim.time+=dt;floorTime+=dt;
  for(const v of visitors){v.healthModel.tick(dt);v.age+=dt;if(v.age>.25)v.input.keys.clear();v.me.frozen=v.health<=0||!!sim.descent?.ready.includes(v.id);
   if(v.health>0){v.record.battery=Math.max(0,v.record.battery-dt);if(!v.record.battery)v.healthModel.damage(4);v.player.update(dt);}
   v.health=v.healthModel.read().current;v.record.health=v.health;tickInventory(sim,v.record,dt);
  }
  const live=visitors.filter(v=>v.health>0);if(!live.length)sim.phase='dead';
  physical.update(dt);population.update(dt,sim.time,visitors);
  for(const v of live){const rt=world.roomAt(v.me.x,v.me.z),key=`${depth}:${rt?.id}`;if(rt&&!sim.visited.includes(key))sim.visited.push(key);}
  if(live.length){if(floorTime>8&&!env.coopAwake){env.pursuer.wake(true);env.coopAwake=true;}env.pursuer.update(dt,sim.time);}
  for(const v of visitors){const m=v.me;Object.assign(v.record,{x:m.x,z:m.z,y:m.y,yaw:m.yaw,pitch:m.pitch,health:v.healthModel.read().current,hitCooldown:v.healthModel.read().cooldown});v.health=v.record.health;}
  // Opening the real taped wall creates a shared extraction point. It stays
  // open while the second visitor catches up; entering the stairwell is not a win.
  if(!sim.exit){const ex=level.rooms[level.exit.room];sim.exit={x:ex.cx,z:ex.cz};}
  if(!visitors.some(v=>v.health>0))sim.phase='dead';
  else if(sim.exitOpen&&visitors.filter(v=>v.health>0).every(v=>dist(v.me,sim.exit)<3))sim.phase='escaped';
  if(sim.descent&&sim.phase==='play'){
   for(const v of visitors.filter(v=>v.health>0))if(dist(v.me,sim.descent)<3&&!sim.descent.ready.includes(v.id))sim.descent.ready.push(v.id);
   if(visitors.filter(v=>v.health>0).every(v=>sim.descent.ready.includes(v.id)))sim.phase='descending';
  }
  socialTick(sim,socialContext);
  acc+=dt;if(acc<.1&&sim.phase==='play')return null;acc=0;
  sim.nodes=[];nodes.forEach((n,i)=>{const p=pack(n);if(JSON.stringify(p)!==initial[i])sim.nodes.push([i,...p]);});
  sim.links=world.throats.map(th=>th.open);sim.solids=world.rooms.map(rt=>rt.colliders.map(c=>c.on!==false));
  sim.effects=physical.report();sim.sounds=sounds.slice();sim.nodeCount=nodes.length;sim.pirate={...env.pursuer.at?.()};sim.creatures=env.pursuer.cast();
  sim.opacity=nodes.flatMap((n,i)=>n.material?.transparent?[[i,n.material.opacity]]:[]);
  sim.lights=world.rooms.map(rt=>rt.u.dim.value);
  sim.tints=nodes.flatMap((n,i)=>n.material?.uniforms?.uTint?[[i,...n.material.uniforms.uTint.value.toArray()]]:[]);return sim;
 }
 function apply(s){
  if(host||!s.real||s.nodeCount===undefined)return;
  if(s.effects)physical.applyEffects(s.effects);
  if(s.nodeCount!==nodes.length)throw Error('Room build mismatch: restart both clients on the same version');
  for(let i=0;i<world.throats.length;i++)if(typeof s.links?.[i]==='boolean')world.throats[i].open=s.links[i];
  for(let r=0;r<world.rooms.length;r++)world.rooms[r].colliders.forEach((c,i)=>{
   if(typeof s.solids?.[r]?.[i]==='boolean')c.on=s.solids[r][i];
  });
  for(const [i,r,g,b]of s.tints||[])nodes[i]?.material?.uniforms?.uTint?.value.set(r,g,b);
  for(const [i,a]of s.opacity||[])if(nodes[i]?.material)nodes[i].material.opacity=a;
  for(let i=0;i<world.rooms.length;i++)if(Number.isFinite(s.lights?.[i]))world.setLights(world.rooms[i],s.lights[i]);
  // Snapshots contain all departures from the common build baseline, not
  // deltas from the last network packet. Reset nodes that returned to rest.
  const put=(n,p)=>{n.position.fromArray(p);n.quaternion.fromArray(p,3);n.scale.fromArray(p,7);n.visible=!!p[10];};
  for(const i of changed)put(nodes[i],JSON.parse(initial[i]));
  changed=(s.nodes||[]).map(row=>row[0]);
  for(const [i,...p]of s.nodes||[])if(nodes[i])put(nodes[i],p);
 }

 function renderView(camera,s,view,dt,showHand){
  lights.update(camera,s,view);
  if(!hand){handContext={...env,vhs:{get picture(){return {w:innerWidth,h:innerHeight};}},player:{me:view},inventory:{held:()=>null}};hand=createHandView(handContext,camera);}
  // The hand has a private view context, never changes the authority's active visitor.
  const item=heldItem(view);handContext.player.me=view;handContext.inventory.held=()=>item?{...item,lit:lightPower(view)>0}:null;
  hand.update(dt,showHand&&view.health>0);
 }
 return {world,level,visit,depth,step,command,apply,renderView,inspect:()=>({sim,visitors,nodes}),start:level.start,host,dispose(){hand?.dispose();physical.dispose();env.pursuer.dispose();scene.remove(world.scene);world.dispose();kit.dispose();}};
}
