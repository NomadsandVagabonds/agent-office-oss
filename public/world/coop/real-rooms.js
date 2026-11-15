// Production rooms, cast, lighting and furniture; one trusted browser authority.
import * as THREE from 'three';
import {ARCHETYPES,toWorld,roomDistances} from '../backrooms/gen.js';
import {createKit} from '../backrooms/kit.js';
import {buildWorld,loadCatalogue} from '../backrooms/world.js';
import {BUILDERS} from '../backrooms/rooms.js';
import {createStalkers} from '../backrooms/pursuer.js';
import {CAST} from '../backrooms/cast.js';
import {createPlayer} from '../backrooms/player.js';
import {createHealth} from '../backrooms/health-state.js';
import {resolveLook} from '/core/look.mjs';
import {socialAct,socialTick} from './social-rules.js';
import {coopVisit,floorOf} from './visit.js';
import {createPopulation} from './population.js';
import {inventoryAct,reconcileInventory,tickInventory,heldItem,lightPower,makeItem,mutateInventory} from './inventory.js';
import {createDenizens} from '../backrooms/denizens.js';
import {createFurnitureMotion} from '../backrooms/furniture-motion.js';
import {createFurnitureGrip} from '../backrooms/furniture-grip.js';
import {strikeSnip} from '../backrooms/melee.js';
import {coopSupplies} from './supplies.js';
import {createInventoryWorld} from '../backrooms/inventory-world.js';
import {createHand,createHandView} from '../backrooms/hand.js';
import {chooseVisitor,seesVisitor} from './visitors.js';
import {inFlashlight} from '../backrooms/flashlight.js';
import {createSceneSync} from './scene-sync.js';
import {createCoopLights} from './lights.js';
const nop=()=>{},dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export async function createRealRooms(seed,host,scene,{depth=0,slice=false,route='random',planOptions={},carry=null,visit:reviewVisit=null}={}){
 const kit=createKit(),visit=reviewVisit||coopVisit(seed,{slice,route,...planOptions}),level=floorOf(visit,depth);
 const fromStart=roomDistances(level,level.start.room),threats=new Set([...CAST.filter(m=>m.disposition==='hunts').map(m=>m.id),'mother-brood']);
 const builders={...BUILDERS};
 for(const id of new Set(level.rooms.map(r=>r.arch))){const a=ARCHETYPES[id];if(a?.module){const mod=await import(new URL(a.module,new URL('../backrooms/index.js',import.meta.url)));if(typeof mod.build!=='function')throw Error('Missing room builder: '+id);builders[id]=mod.build;}}
 const cast=level.cast.map(name=>({name,look:resolveLook(name)}));
 let activeCast=null,castPoint=null,sim=null,visitors=[],active=null,acc=0,started=false;
 let soundSeq=0;const sounds=[];
 const emit=(name,extra={})=>{if(!sim)return;sounds.push({seq:++soundSeq,name,...extra});if(sounds.length>64)sounds.shift();};
 const sound={play:(name,options)=>emit(name,{options,to:active?.id}),playMascot:()=>emit('mascot'),stopMascot:()=>emit('mascot-stop'),air:k=>emit('air',{k,to:active?.id}),file:(href,options)=>emit('file',{href:String(href),options,to:active?.id})};
 const env={level,visit,kit,cast,carry,partySize:2,who:{look:resolveLook('visitor'),creations:{}},builders,coopStrict:true,barricadesEnabled:true,lighting:true,catalogue:await loadCatalogue(kit),hatches:new Map(),sound,hud:{glitch:nop,flag:nop},clock:0,
  play:(name,x,z,reach)=>emit(name,{x,z,reach}),hear:()=>({vol:1,pan:0}),interfere:k=>{if(active)active.record.interference=Math.max(active.record.interference||0,k);},
  red:k=>{if(active)active.record.red=Math.max(active.record.red||0,k);},
  hold:on=>{if(active){active.held=!!on;const rt=world.roomAt(active.me.x,active.me.z);if(rt)rt.coopHeld=on?active.id:null;}},
  takeAway(inside,key){env.pursuer.takeAway(inside,key);env.denizens.takeAway(inside,key);env.barricades.takeAway(inside,key);env.inventory?.physical.takeAway(inside,key);for(const i of sim?.items||[])if(i.owner===null&&inside(i.x,i.z))i.away=key;},
  bringBack(key){env.pursuer.bringBack(key);env.denizens.bringBack(key);env.barricades.bringBack(key);env.inventory?.physical.bringBack(key);for(const i of sim?.items||[])if(i.away===key)delete i.away;},descend:at=>{if(sim&&active&&depth<visit.depths-1&&!sim.descent)sim.descent={x:at.x,z:at.z,by:active.id,ready:[]};},run:{met:id=>{if(sim){sim.met||=[];if(!sim.met.includes(id))sim.met.push(id);}},survived:id=>{if(sim){sim.survived||=[];sim.survived.push({id,depth,time:sim.time});}}},
  end:why=>{if(!sim||!active)return;if(why==='exit'){sim.exit={x:active.me.x,z:active.me.z};sim.exitOpen=true;return;}active.healthModel.damage(4);active.health=0;},
  sees(x,z,o={}){return visitors.some(v=>seesVisitor(v,{x,z},env.world,o));},
  health:{read:()=>active?.healthModel.read(),damage:n=>active?.healthModel.damage(n),heal:n=>active?.healthModel.heal(n)},camera:{drain:share=>{const targets=activeCast==='shadow'&&castPoint?visitors.filter(v=>seesVisitor(v,castPoint,world)||v===active):[active].filter(Boolean);for(const v of targets)v.record.battery*=1-Math.max(0,Math.min(1,share));return {ok:!!targets.length};}},
 };
 createStalkers(env,{members:planOptions.members,hasSurvivor:()=>visitors.some(v=>v.healthModel.read().current>0),withVisitor:scopeNearest
 });
 env.coopBeam=(at,options={})=>visitors.some(v=>inFlashlight({...v.me,mounted:!!v.record.inventory?.mountedTorch},at,{...options,power:lightPower(v.record),los:world.los(v.me.x,v.me.z,at.x,at.z)}));
 env.withVisitor=scopeNearest;env.players=()=>visitors.map(v=>v.player);env.forEachVisitor=fn=>{for(const v of visitors)if(v.healthModel.read().current>0)withVisitor(v,()=>fn(v.me));};
 env.vhs={uniforms:{uWhite:{get value(){return active?.record.white||0;},set value(k){if(active)active.record.white=k;}}}};
 env.hasSurvivor=()=>visitors.some(v=>v.healthModel.read().current>0);
 createHand(env);createDenizens(env,{withVisitor:scopeNearest});
 const world=env.world=await buildWorld(kit,level,env,()=>new Promise(r=>setTimeout(r,0)));scene.add(world.scene);world.current=()=>env.player?world.roomAt(env.player.me.x,env.player.me.z):null;
 env.barricades=createFurnitureMotion(world);
 // Ready runs after a player exists, as in the game's normal conductor.
 const dummy=createPlayer(world,new THREE.PerspectiveCamera(),level.start);env.player=dummy;
 for(const fn of env.ready||[])fn();
 const blocked=env.doors.blocked;
 env.doors.blocked=door=>visitors.length?visitors.filter(v=>v.healthModel.read().current>0).some(v=>withVisitor(v,()=>blocked(door))):blocked(door);
 for(const rt of world.rooms){rt.group.visible=true;rt.near=true;}
 const sceneSync=createSceneSync(world.scene,kit),nodes=sceneSync.nodes;
 const pack=n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray(),n.visible?1:0];
 const initial=nodes.map(n=>JSON.stringify(pack(n)));let changed=[];
 const withVisitor=(v,fn)=>{const prev=active,player=env.player;active=v;env.player=v.player;try{return fn();}finally{active=prev;env.player=player;}};
 // A newcomer is not a hunt target until they leave the landing's adjacent
 // rooms. Remember exploration so retreating later does not erase a pursuit.
 function scopeNearest(id,at,tick){
  const point=Number.isFinite(at?.x)&&Number.isFinite(at?.z)?at:level.start;
  const room=world.roomAt(point.x,point.z),recent=room?.coopInteraction;
  const actor=['pirate','moth','shadow','porter','toner','other-door','follower','mother','mother-brood','the-lines'].includes(id);
  const candidates=threats.has(id)?visitors.filter(v=>v.explored||(fromStart.get(world.roomAt(v.me.x,v.me.z)?.id)??0)>=2):visitors;
  const target=(!actor&&recent?.until>sim?.time&&visitors.find(v=>v.id===recent.id&&v.health>0))||chooseVisitor(candidates,point,id,world);
  if(!target)return;
  const before=activeCast,spot=castPoint;activeCast=id;castPoint=point;
  try{return withVisitor(target,tick);}finally{activeCast=before;castPoint=spot;}
 }
 const population=createPopulation(world,withVisitor,{held:()=>env.inventory?.held()});
 const physical=createInventoryWorld(env,{read:()=>active?.record.inventory||{slots:[]},add:item=>active?mutateInventory(sim,active.record,m=>m.add(item)):{ok:false}}, {canAct:()=>!host||sim?.phase==='play'});
 env.inventory={physical,fire:physical.fire,held:()=>active?heldItem(active.record):null,torchPower:()=>active?lightPower(active.record):0,torchMounted:()=>!!active?.record.inventory?.mountedTorch,
  give:item=>active?mutateInventory(sim,active.record,m=>m.add(makeItem(item.type,item.id,item))):{ok:false},
  consumeHeld:(type,n)=>active?mutateInventory(sim,active.record,m=>m.consumeSelected(type,n)):{ok:false}};
 env.fires={nearest:(x,z)=>physical.fire.threatAt(x,z)};
 const lights=createCoopLights(world,kit),handScene=new THREE.Group();scene.add(handScene);let hand=null,handContext=null;
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
   const grip=createFurnitureGrip(world,env.barricades,{sound});
   const v={id:record.id,record,player,me:player.me,input,health:record.health,healthModel,age:1,grip};
   player.on('move',(dx,dz,step)=>grip.step(dx,dz,step));return v;
  });
  sim.items=sim.items.filter(i=>sim.players.some(p=>i.owner===p.id&&p.bag.includes(i.id)));
  const plan=coopSupplies(level,visitors.length,visit);
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
  const v=visitors.find(v=>v.id===id);if(!v||v.health<=0||v.held||sim.phase!=='play')return;const p=v.record;
  if(socialAct(sim,id,m,socialContext)){for(const p of sim.players)reconcileInventory(sim,p);return;}
  if(m.type==='tip'){withVisitor(v,()=>{const out=v.grip.tip();if(!out.ok)p.notice={text:({support:'Needs solid ground at both ends',occupied:'Wait until your partner is clear',blocked:'Something is in the way',clearance:'Not enough room to lower it'})[out.reason]||'Cannot move the bridge here',until:sim.time+2};});return;}
  if(withVisitor(v,()=>inventoryAct(sim,p,m,{
   canTake:i=>dist(v.me,i)<1.5&&Math.abs(world.floorY(v.me.x,v.me.z)-i.y)<1.2&&world.los(v.me.x,v.me.z,i.x,i.z),
   dropSpot:i=>{const q=physical.dropSpot(i);return q?{x:q.wx,z:q.wz,y:q.rt.def.y+q.y}:null;},
   ignite:spec=>physical.ignite(spec),mark:()=>physical.mark(),heal:n=>v.healthModel.heal(n),snip:()=>strikeSnip(v.me,[...env.pursuer.snipTargets(),...env.denizens.snipTargets()],(ax,az,bx,bz)=>world.los(ax,az,bx,bz)),
  }))){
   const i=sim.items.find(i=>i.id===m.id);if(m.type==='take'&&i?.owner!==null&&taken.has(m.id)){taken.get(m.id)(i);taken.delete(m.id);}
   return;
  }
  if(m.type==='input'&&[m.f,m.s,m.yaw,m.pitch].every(Number.isFinite)){
   v.input.keys.clear();if(m.f>0)v.input.keys.add('w');if(m.f<0)v.input.keys.add('s');if(m.s>0)v.input.keys.add('d');if(m.s<0)v.input.keys.add('a');if(m.run)v.input.keys.add('Shift');
   if(m.crouch)v.input.keys.add('c');if(m.jump)v.input.keys.add(' ');
   v.me.yaw=m.yaw%(Math.PI*2);v.me.pitch=Math.max(-1.2,Math.min(1.2,m.pitch));p.input={f:m.f,s:m.s};v.age=0;
  }else if(m.type==='exit')withVisitor(v,()=>{v.grip.update(0,v.me,true);const use=world.usable(v.me),target=v.grip.action(use);if(target){if(!visitors.some(other=>other!==v&&other.grip.held===target))v.grip.use();}else if(use){if(use.room)use.room.coopInteraction={id:v.id,until:sim.time+3};use.use();}});
 }
 function step(dt,s){
  if(!host)return null;if(!started){if(s?.phase!=='play')return null;syncPlayers(s);}
  if(sim.phase!=='play')return sim;
  dt=Math.min(.05,dt);sim.time+=dt;
  for(const v of visitors){v.healthModel.tick(dt);v.age+=dt;if(v.age>.25)v.input.keys.clear();if(v.age>.5||v.held||v.health<=0)v.grip.release();v.me.frozen=v.health<=0||v.held||!!sim.descent?.ready.includes(v.id);
   if(v.health>0){v.grip.update(dt,v.me,v.age<.5);v.record.battery=Math.max(0,v.record.battery-dt);if(!v.record.battery)v.healthModel.damage(4);withVisitor(v,()=>v.player.update(dt));if((fromStart.get(world.roomAt(v.me.x,v.me.z)?.id)??0)>=2)v.explored=true;v.me.slow=1;v.me.sinkTo=0;}
   v.record.white=0;v.record.interference=(v.record.interference||0)*Math.exp(-4*dt);v.record.red=(v.record.red||0)*Math.exp(-3.2*dt);v.health=v.healthModel.read().current;v.record.health=v.health;tickInventory(sim,v.record,dt);
  }
  const live=visitors.filter(v=>v.health>0);if(!live.length)sim.phase='dead';
  for(const f of world.furniture)f.tick?.(dt);
  world.updateLighting(sim.time);world.updateFlicker(dt);physical.update(dt);population.update(dt,sim.time,visitors);
  for(const v of live){const rt=world.roomAt(v.me.x,v.me.z),key=`${depth}:${rt?.id}`;if(rt&&!sim.visited.includes(key))sim.visited.push(key);}
  if(live.length){env.pursuer.update(dt,sim.time);env.denizens.update(dt,sim.time);}
  for(const v of visitors)withVisitor(v,()=>{const m=v.me,use=world.usable(m);Object.assign(v.record,{x:m.x,z:m.z,y:m.y,yaw:m.yaw,pitch:m.pitch,health:v.healthModel.read().current,held:v.held,gripping:!!v.grip.held,bridgeGrip:!!v.grip.held?.bridge,interaction:v.grip.action(use)?(v.grip.held?.bridge?`E · Release hoarding · R · ${v.grip.held.deployed?'Raise':'Lower'}`:`E · ${v.grip.held?'Release':'Move'} ${(v.grip.held||v.grip.target).label||(v.grip.held||v.grip.target).type}`):null,usable:use?`E · ${use.label||'Interact'}`:null,hitCooldown:v.healthModel.read().cooldown});v.health=v.record.health;});
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
  lights.refresh();sim.scene=sceneSync.read();sim.nodes=[];nodes.forEach((n,i)=>{const p=pack(n);if(JSON.stringify(p)!==initial[i])sim.nodes.push([i,...p]);});
  sim.links=world.throats.map(th=>th.open);sim.solids=world.rooms.map(rt=>rt.colliders.map(c=>c.on!==false));
  sim.roomState=world.rooms.flatMap(rt=>rt.coopRead?[[rt.id,rt.coopRead()]]:[]);
  sim.furniture=world.furniture.map(f=>({x:f.x,z:f.z,y:f.y,carried:!!f.carried,away:f.away||null,on:f.collider.on!==false,...(f.bridge?{bridge:{bounds:Object.fromEntries(['x','z','x0','x1','z0','z1','y','top'].map(k=>[k,f[k]])),deployed:f.deployed,transition:!!f.transition,support:f.support,carried:!!f.carried,hinge:{...f.hinge},offsetX:f.offsetX,offsetZ:f.offsetZ,room:f.room}}:{})}));
  sim.collision=world.rooms.map(rt=>rt.colliders.map(c=>Object.fromEntries(Object.entries(c).filter(([,v])=>typeof v==='number'||typeof v==='boolean'))));
  sim.effects=physical.report();sim.sounds=sounds.slice();sim.nodeCount=nodes.length;sim.castCarry=env.pursuer.carry();sim.pirate={...env.pursuer.at?.()};sim.creatures=env.pursuer.cast();
  sim.opacity=nodes.flatMap((n,i)=>n.material?.transparent?[[i,n.material.opacity]]:[]);
  sim.lights=world.rooms.map(rt=>rt.u.dim.value);sim.lighting=world.rooms.map(rt=>rt.lighting?{preview:rt.lighting.preview||null,cue:rt.lighting.cue||null}:null);
  sim.tints=nodes.flatMap((n,i)=>n.material?.uniforms?.uTint?[[i,...n.material.uniforms.uTint.value.toArray()]]:[]);return sim;
 }
 function apply(s){
  if(host||!s.real||s.nodeCount===undefined)return;
  for(const [id,data]of s.roomState||[])world.rooms[id]?.coopApply?.(data);
  // Effect geometry is in the authoritative scene stream, never simulated twice.
  for(const [i,f]of (s.furniture||[]).entries()){
   const item=world.furniture[i];if(!item)continue;
   if(f.bridge&&item.bridge){
    const b=f.bridge,old=world.rooms.find(r=>r.id===item.room),next=world.rooms.find(r=>r.id===b.room);
    if(old!==next&&next){const k=old?.colliders.indexOf(item.collider);if(k>=0)old.colliders.splice(k,1);next.colliders.push(item.collider);}
    Object.assign(item,b.bounds,{room:b.room,hinge:{...b.hinge},offsetX:b.offsetX,offsetZ:b.offsetZ,deployed:b.deployed,transition:b.transition?{remote:true}:null,support:b.support,carried:b.carried});
    Object.assign(item.collider,{x0:item.x0,x1:item.x1,z0:item.z0,z1:item.z1,floor:item.deployed&&!item.transition&&!!item.support?.ok,tall:!item.deployed&&item.top-item.y>1.25});
   }else{const dy=Number.isFinite(f.y)?f.y-item.y:0;if(Math.abs(f.x-item.x)+Math.abs(f.z-item.z)+Math.abs(dy)>1e-8)item.translate(f.x-item.x,f.z-item.z,dy);item.carried=!!f.carried;}
   item.away=f.away;item.collider.on=f.on;
  }
  for(const [r,cs]of (s.collision||[]).entries()){const rt=world.rooms[r];if(rt)cs.forEach((c,i)=>{if(rt.colliders[i]){for(const [k,v]of Object.entries(c)){const d=Object.getOwnPropertyDescriptor(rt.colliders[i],k);if(!d?.get||d.set)rt.colliders[i][k]=v;}}else rt.colliders.push({...c});});}
  for(const [i,l]of (s.lighting||[]).entries()){const p=world.rooms[i]?.lighting;if(p&&l){p.preview=l.preview;if(l.cue)p.cue=l.cue;else delete p.cue;}}
  world.updateLighting(s.time);
  sceneSync.apply(s.scene);lights.refresh();
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
  for(const i of changed)if(initial[i])put(nodes[i],JSON.parse(initial[i]));
  changed=(s.nodes||[]).map(row=>row[0]);
  for(const [i,...p]of s.nodes||[])if(nodes[i])put(nodes[i],p);
 }

 function renderView(camera,s,view,dt,showHand){
  lights.update(camera,s,view);
  if(!hand){handContext={...env,world:{...world,scene:handScene},vhs:{get picture(){return {w:innerWidth,h:innerHeight};}},player:{me:view},inventory:{held:()=>null}};hand=createHandView(handContext,camera);}
  // The hand has a private view context, never changes the authority's active visitor.
  const item=heldItem(view);handContext.player.me=view;handContext.inventory.held=()=>item?{...item,lit:lightPower(view)>0}:null;
  hand.update(dt,showHand&&view.health>0&&!view.gripping);
 }
 return {world,level,visit,depth,step,command,apply,renderView,inspect:()=>({sim,visitors,nodes}),start:level.start,host,dispose(){for(const v of visitors)v.grip.release();env.denizens.dispose();hand?.dispose();scene.remove(handScene);physical.dispose();env.pursuer.dispose();scene.remove(world.scene);world.dispose();kit.dispose();}};
}
