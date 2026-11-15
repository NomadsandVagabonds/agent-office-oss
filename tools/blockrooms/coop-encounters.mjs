// Executed inside the authority browser by coop-content-check.mjs. These use
// production controllers and interactions; only positioning/time are accelerated.
export async function exercise(r,id){
 const {sim,visitors}=r.inspect(),w=r.world,env=w.env,g=visitors[1],h=visitors[0];
 const {toWorld}=await import('/world/backrooms/gen.js');
 const {makeItem}=await import('/world/backrooms/inventory-state.js');
 const {mutateInventory}=await import('/world/coop/inventory.js');
 const check=(ok,message)=>{if(!ok)throw Error(id+': '+message);};
 const tick=n=>{for(let i=0;i<n;i++)r.step(.05,sim);};
 const reset=()=>{for(const v of visitors){v.healthModel.tick(5);v.healthModel.heal(4);v.record.battery=390;v.player.warp(r.start.x,r.start.z,0);}h.player.warp(r.start.x,r.start.z,Math.PI);};
 const give=(v,type,id,extra={})=>{const out=mutateInventory(sim,v.record,m=>m.add(makeItem(type,id,extra)));check(out.ok,'item added');};
 const useAt=(v,use)=>{v.me.yaw=Math.atan2(v.me.x-use.wx,v.me.z-use.wz);r.command(v.id,{type:'input',f:0,s:0,yaw:v.me.yaw,pitch:0});r.command(v.id,{type:'exit'});};
 reset();
 if(id==='bridge-gap'||id==='bridge-lines'){
  if(id==='bridge-lines')env.pursuer.takeAway(()=>true,'bridge-setup');
  const rt=w.rooms.find(rt=>rt.def.arch==='the-culvert');check(rt&&!rt.flat,'gap is real, not rescue-flattened');
  const {bridgeReachable}=await import('/world/backrooms/bridge-puzzles.js');check(bridgeReachable(w,rt),'crossing validated from every entrance');
  const plan=rt.bridgePlans[0],f=plan.item,n=f.bridge.normal,side={x:n.z,z:-n.x};
  const stand=toWorld(rt.def,plan.stand.x,plan.stand.z),end=toWorld(rt.def,plan.path.at(-1).x,plan.path.at(-1).z);
  const aim=(v,item)=>{const x=Math.max(item.x0+.015,Math.min(v.me.x,item.x1-.015)),z=Math.max(item.z0+.015,Math.min(v.me.z,item.z1-.015));v.me.yaw=Math.atan2(v.me.x-x,v.me.z-z);v.me.pitch=Math.atan2((item.deployed?item.top:(item.y+item.top)/2)-v.me.y,Math.hypot(x-v.me.x,z-v.me.z));r.command(v.id,{type:'input',f:0,s:0,yaw:v.me.yaw,pitch:v.me.pitch});r.command(v.id,{type:'exit'});};
  const input=(v,fwd,yaw)=>r.command(v.id,{type:'input',f:fwd,s:0,yaw,pitch:v.me.pitch});
  h.player.warp(1000,1000,0);g.player.warp(stand.x,stand.z,Math.atan2(-n.x,-n.z));tick(1);
  aim(g,f);check(g.grip.held===f,'guest E acquires hoarding');
  for(let i=0;i<100&&Math.hypot(f.hinge.x-end.x,f.hinge.z-end.z)>.035;i++){
   const delta=(end.x-f.hinge.x)*n.x+(end.z-f.hinge.z)*n.z;if(Math.abs(delta)<.035)break;
   input(g,Math.sign(delta),Math.atan2(-n.x,-n.z));tick(1);
  }
  input(g,0,g.me.yaw);r.command(g.id,{type:'tip'});check(f.transition,'guest R lowers hoarding '+JSON.stringify(g.record.notice));tick(12);
  check(f.deployed&&f.support.spansGap,'panel becomes a supported bridge');
  const middle={x:f.hinge.x+n.x*1.5,z:f.hinge.z+n.z*1.5};check(w.terrainY(middle.x,middle.z)<-1&&w.floorY(middle.x,middle.z)>-.1,'bridge supplies real floor');
  globalThis.review.bridgeChecks=[];
  const checkpoint=label=>{tick(3);globalThis.review.bridgeChecks.push({label,state:structuredClone(r.inspect().sim),...middle,floor:w.floorY(middle.x,middle.z)});};
  checkpoint('lowered');
  // Cross with ordinary movement, then step sideways onto the far bank.
  for(let i=0;i<200&&(g.me.x-f.hinge.x)*n.x+(g.me.z-f.hinge.z)*n.z<2.75;i++){input(g,1,Math.atan2(-n.x,-n.z));tick(1);}
  input(g,0,g.me.yaw);check((g.me.x-f.hinge.x)*n.x+(g.me.z-f.hinge.z)*n.z>2.55&&g.healthModel.read().current>0,'guest walks across bridge');
  const far={x:f.hinge.x+n.x*3.1+side.x*1.05,z:f.hinge.z+n.z*3.1+side.z*1.05};
  g.player.warp(far.x,far.z,0);tick(1);
  // A teammate standing on the bridge prevents its removal.
  h.player.warp(middle.x,middle.z,0);tick(1);aim(g,f);check(g.grip.held===f,'guest can grip the far end '+JSON.stringify({health:g.healthModel.read(),me:g.me,target:g.grip.target?.id,held:g.grip.held?.id,expected:f.id,bounds:[f.x0,f.x1,f.z0,f.z1,f.y,f.top],use:w.usable(g.me)?.label,free:w.free(g.me.x,g.me.z,.22)}));
  r.command(g.id,{type:'tip'});check(!f.transition&&f.deployed,'cannot pull bridge out from under teammate');
  h.player.warp(1000,1000,0);input(g,0,g.me.yaw);
  if(id==='bridge-lines'){
   // Bring the real creature from its lair through the generated floor. Only
   // visitor positioning is accelerated; the creature walks every step.
   g.grip.release();env.pursuer.bringBack('bridge-setup');const lines=env.pursuer.of('the-lines');let at=lines.at();
   g.player.warp(at.x,at.z+.6,0);tick(35);check(lines.at().mode!=='asleep','The Lines wakes in its lair');
   const {roomRoute}=await import('/world/backrooms/cast/paths.js');
   const path=roomRoute(r.level,w.roomAt(lines.at().x,lines.at().z).id,rt.id);
   const near={x:f.hinge.x-n.x*.8,z:f.hinge.z-n.z*.8};
   for(const rid of path.slice(1)){
    const d=r.level.rooms[rid],goal=rid===rt.id?near:{x:d.cx,z:d.cz};g.player.warp(goal.x,goal.z,0);
    for(let i=0;i<1600&&w.roomAt(lines.at().x,lines.at().z)?.id!==rid;i++){if(i%50===0){g.healthModel.heal(4);g.record.battery=390;}tick(1);}
    check(w.roomAt(lines.at().x,lines.at().z)?.id===rid,'The Lines follows through room '+rid);
   }
   g.player.warp(near.x,near.z,0);
   for(let i=0;i<1200&&Math.hypot(lines.at().x-near.x,lines.at().z-near.z)>1.65;i++){g.healthModel.heal(4);g.record.battery=390;tick(1);}
   check(Math.hypot(lines.at().x-near.x,lines.at().z-near.z)<=1.65,'The Lines reaches near bank');g.healthModel.heal(4);
   g.player.warp(far.x,far.z,0);tick(1);aim(g,f);check(g.grip.held===f,'guest waits at far end with bridge in hand');
   let on=false;
   for(let i=0;i<1200;i++){input(g,0,g.me.yaw);tick(1);at=lines.at();if(w.terrainY(at.x,at.z)<-1&&w.floorY(at.x,at.z)>-.1){on=true;break;}}
   check(on,'The Lines walks onto bridge '+JSON.stringify({at:lines.at(),g:{x:g.me.x,z:g.me.z,health:g.health,held:g.held},phase:sim.phase,floor:w.floorY(lines.at().x,lines.at().z),terrain:w.terrainY(lines.at().x,lines.at().z),middle,far,bridge:[f.x0,f.x1,f.z0,f.z1],room:w.roomAt(lines.at().x,lines.at().z)?.id}));r.command(g.id,{type:'tip'});check(f.transition,'bridge can rise under The Lines');
   checkpoint('raising-under-creature');tick(80);check(lines.at().mode==='gone','The Lines falls and disappears');
   check(sim.survived.some(e=>e.id==='the-lines'),'escape from The Lines is recorded');
  }else{
   r.command(g.id,{type:'tip'});check(f.transition,'guest raises bridge after teammate clears');checkpoint('raising');tick(12);
   check(!f.deployed&&w.floorY(middle.x,middle.z)<-1,'bridge removal restores gap');
   h.player.warp(middle.x,middle.z,0);tick(38);check(h.healthModel.read().current===0,'fall downs only the falling player');check(g.healthModel.read().current>0,'partner remains on intact bank');
   check(w.floorY(g.me.x,g.me.z)>-1,'partner floor never collapses');check(w.floorY(h.me.x,h.me.z)>-1,'downed player is reachable on bank for revive');
  }
  checkpoint('removed');return {bridge:'guest carries, lowers, crosses, raises; partner protected',creature:id==='bridge-lines'?'lured across, dropped, gone':'independent fall checked'};
 }
 if(id==='chairs'){
  let item=null;
  for(const f of w.furniture.filter(f=>f.collider.on!==false)){
   for(let a=0;a<Math.PI*2;a+=Math.PI/4){const x=f.x+Math.sin(a)*1.2,z=f.z+Math.cos(a)*1.2;if(!w.free(x,z,.23))continue;
    g.player.warp(x,z,a);g.me.pitch=Math.atan2((f.y+f.top)/2-g.me.y,1.2);r.command(g.id,{type:'input',f:0,s:0,yaw:a,pitch:g.me.pitch});r.command(g.id,{type:'exit'});
    if(g.grip.held){item=f;break;}
   }if(item)break;
  }
  check(item,'guest acquires furniture through E');const before={x:item.x,z:item.z};
  for(let i=0;i<30;i++){r.command(g.id,{type:'input',f:-1,s:0,yaw:g.me.yaw,pitch:g.me.pitch});r.step(.05,sim);}
  check(Math.hypot(item.x-before.x,item.z-before.z)>.05,'walking carries the furniture');
  check(item.carried&&item.collider.on===false,'carried prop does not block its carrier');
  // E only sets a carried prop down where the full footprint fits. Search
  // clear approaches to its original resting place, using the real controller.
  const reach=Math.min(1.8,Math.max(1.1,Math.hypot(item.x1-item.x0,item.z1-item.z0)/2+.65));
  for(let a=0;a<Math.PI*2&&g.grip.held;a+=Math.PI/8){
   const x=before.x+Math.sin(a)*reach,z=before.z+Math.cos(a)*reach;if(!w.free(x,z,.23))continue;
   g.player.warp(x,z,a);r.command(g.id,{type:'input',f:0,s:0,yaw:a,pitch:0});tick(2);r.command(g.id,{type:'exit'});
  }
  check(!g.grip.held,'E sets furniture down on a clear floor');check(!item.carried&&item.collider.on,'resting prop blocks movement again');return {carried:item.type};
 }
 if(id==='safety-corridor'){
  const d=env.denizens.all().find(d=>d.id==='floor-warden');check(d,'warden exists');g.player.warp(d.x,d.z+1.5,0);g.me.speed=4;
  h.player.warp(1000,1000,0);env.denizens.update(.05,sim.time);
  // Accelerate positioning, not the resident's chase/trip logic.
  for(let i=0;i<200&&!d.gone;i++){g.player.warp(d.x,d.z+2,0);g.me.speed=4;env.denizens.update(.05,sim.time+i*.05);}
  check(d.gone,'evaded warden falls and leaves');
  const use=w.rooms.flatMap(rt=>rt.uses).find(u=>u.inventoryItem&&u.label==='Scissors');check(use,'warden spawns physical scissors');
  let probes=[];
  for(let a=0;a<Math.PI*2&&!g.record.bag.length;a+=Math.PI/4){
   const x=use.wx+Math.sin(a)*.45,z=use.wz+Math.cos(a)*.45;if(!w.free(x,z,.22))continue;
   g.player.warp(x,z,a);tick(2);const prev=env.player;env.player=g.player;probes.push({at:{x,z},when:use.when(),chosen:w.usable(g.me)?.label});env.player=prev;useAt(g,use);
  }
  check(g.record.bag.some(id=>sim.items.find(i=>i.id===id)?.type==='scissors'),'guest picks up spawned scissors '+JSON.stringify(probes));return {warden:'evaded, dropped scissors, guest collected'};
 }
 if(id==='shredding-bay'){
  const d=env.denizens.all().find(d=>d.id==='retention-clerk');check(d,'clerk exists');give(g,'paper','guest-paper',{quantity:3});give(h,'paper','host-paper',{quantity:3});
  mutateInventory(sim,g.record,m=>m.select(0));mutateInventory(sim,h.record,m=>m.select(0));g.player.warp(d.x,d.z+.65,0);tick(5);
  check(g.record.inventory.slots[0]?.quantity===2,'clerk takes one guest sheet');check(h.record.inventory.slots[0]?.quantity===3,'host paper untouched');return {paper:'one sheet from guest'};
 }
 if(id==='cast-porter'){
  const p=env.pursuer.of('porter'),at=p.at();check(at.bucket,'porter placed');g.player.warp(at.bucket.x,at.bucket.z,0);h.player.warp(r.start.x,r.start.z,0);
  r.command(g.id,{type:'input',f:1,s:0,yaw:0,pitch:0});tick(2);check(p.at().mode!=='mop','guest knocks bucket over');
  const use=w.rooms.flatMap(rt=>rt.uses).find(u=>Math.hypot(u.wx-at.bucket.x,u.wz-at.bucket.z)<.1);check(use,'bucket use exists');
  g.player.warp(at.bucket.x,at.bucket.z+.65,0);useAt(g,use);tick(3);check(p.at().thanked,'bucket righted');check(g.record.bag.some(id=>sim.items.find(i=>i.id===id)?.type==='battery'),'guest gets reward');check(!h.record.bag.includes('porter:battery'),'host cannot steal reward');return {reward:'guest battery'};
 }
 if(id==='cast-shadow'){
  const shadow=env.pursuer.of('shadow');g.me.pitch=h.me.pitch=1.2;shadow.hurry();
  for(let i=0;i<200&&shadow.at().x===null;i++)r.step(.05,sim);
  let at=shadow.at();check(Number.isFinite(at.x),'shadow placed');
  const target=visitors.slice().reverse().find(v=>Math.hypot(v.me.x-at.x,v.me.z-at.z)<16&&w.los(v.me.x,v.me.z,at.x,at.z));check(target,'viewer can see shadow');
  target.me.yaw=Math.atan2(target.me.x-at.x,target.me.z-at.z);target.me.pitch=0;
  for(let i=0;i<30&&shadow.at().mode!=='armed';i++)r.step(.05,sim);
  check(shadow.at().mode==='armed','stare lights white fuse');const power=target.record.battery;
  target.me.pitch=1.2;tick(20);check(shadow.at().mode==='gone','turning away clears shadow');check(target.record.battery>power-2,'successful timing costs no flash drain');return {shadow:'armed then cleared'};
 }
 if(id==='cast-toner'){
  const toner=env.pursuer.of('toner'),at=toner.at();h.player.warp(1000,1000,0);
  toner.hurry({x:at.x,z:at.z,chase:true});
  // The live toner only bites during its committed leap, and stillness is
  // counterplay. Keep the test visitor noisy and in reach; do not reset the
  // wind-up every few frames as the former contact-damage fixture did.
  for(let i=0;i<4000&&toner.at().mode!=='puddle';i++){
   const p=toner.at();g.healthModel.heal(4);g.record.battery=390;
   for(let a=0;a<Math.PI*2;a+=Math.PI/4){const x=p.x+Math.sin(a)*.35,z=p.z+Math.cos(a)*.35;
    if(w.free(x,z,.22)&&w.los(x,z,p.x,p.z)){g.player.warp(x,z,a);r.command(g.id,{type:'input',f:1,s:0,yaw:a,pitch:0});break;}}
   tick(1);
  }
  r.command(g.id,{type:'input',f:0,s:0,yaw:0,pitch:0});
  check(toner.at().mode==='puddle','two actual hits create brood pool '+JSON.stringify(toner.at()));const count=toner.at().count;g.player.warp(r.start.x,r.start.z,0);toner.hurry({hatch:true});tick(10);
  check(toner.at().count>count,'brood spawned new units');return {hatched:toner.at().count-count};
 }
 if(id==='cast-mother'){
  const mother=env.pursuer.of('mother'),at=mother.at(),beforeUses=new Set(w.rooms.flatMap(rt=>rt.uses));
  h.player.warp(r.start.x,r.start.z,0);g.player.warp(at.x,at.z+.8,0);
  for(let i=0;i<100&&!mother.at().brood;i++)tick(1);
  check(mother.at().brood>=4,'Mother produces a shared brood for the guest');
  const brood=mother.at().brood;let stomped=false;
  for(let i=0;i<35&&!stomped;i++){
   tick(1);
   for(const u of w.rooms.flatMap(rt=>rt.uses).filter(u=>!beforeUses.has(u))){
    g.player.warp(u.wx,u.wz+.15,0);useAt(g,u);
    if(mother.at().brood<brood){stomped=true;break;}
   }
  }
  check(stomped,'guest E stomps a small one');
  g.healthModel.tick(5);g.healthModel.heal(4);
  const random=Math.random;Math.random=()=>.1;
  try{for(let i=0;i<150&&g.healthModel.read().current===4;i++){
   const u=w.rooms.flatMap(rt=>rt.uses).find(u=>!beforeUses.has(u)&&u.room);
   if(u)g.player.warp(u.wx,u.wz+.2,0);tick(1);
  }}finally{Math.random=random;}
  check(g.healthModel.read().current<4,'brood can hurt guest');check(h.healthModel.read().current===4,'distant host is untouched');
  check(r.inspect().nodes.some(n=>n.material?.uniforms?.uWet?.value===1),'wet brood material exists');
  g.player.warp(r.start.x,r.start.z,0);tick(740);
  check(!mother.at().brood,'spent brood disappears');
  check(w.rooms.flatMap(rt=>rt.uses).every(u=>beforeUses.has(u)),'spent brood leaves no stale E interactions');
  return {mother:'guest triggers brood, stomps with E, takes a hit; host safe; brood and interactions cleaned up'};
 }
 if(id==='cast-the-lines'){
  const lines=env.pursuer.of('the-lines'),at=lines.at();check(Number.isFinite(at.x),'The Lines has a lair');
  h.player.warp(r.start.x,r.start.z,0);g.player.warp(at.x,at.z+.45,0);g.healthModel.damage(3);g.healthModel.tick(5);
  for(let i=0;i<100&&g.healthModel.read().current>0;i++)tick(1);
  check(g.healthModel.read().current===0,'The Lines downs guest');check(h.healthModel.read().current===4,'distant host safe');
  check(lines.at().mode!=='gone','The Lines remains while a teammate lives');
  const next=lines.at();h.player.warp(next.x,next.z+.45,0);
  for(let i=0;i<100&&h.healthModel.read().current===4;i++)tick(1);
  check(h.healthModel.read().current<4,'The Lines switches to living host');
  return {lines:'wakes, downs guest, continues hunting host'};
 }
 if(id==='mecha'){
  const rt=w.rooms.find(rt=>rt.mecha),m=rt.mecha,guard=m.patrol.where(0);let p=toWorld(rt.def,guard.x,guard.z+.25);g.player.warp(p.x,p.z,0);
  for(let i=0;i<150&&!g.held;i++){const at=m.patrol.where(0),p=toWorld(rt.def,at.x,at.z+.2);g.player.warp(p.x,p.z,0);r.step(.05,sim);}
  check(g.held,'guard captures guest');check(!h.held,'host remains free');const health=h.healthModel.read().current;
  tick(215);check(!g.held,'ten-second cage releases guest');check(g.healthModel.read().current===2,'capture costs guest two hearts');check(h.healthModel.read().current===health,'host not charged for guest capture');return {capture:'guest only, released'};
 }
 if(id==='lemonade'){
  const rt=w.rooms.find(rt=>rt.def.arch==='lemonade');g.healthModel.damage(2);g.healthModel.tick(2);
  for(let i=0;i<300;i++){const use=rt.uses.find(u=>!u.when||u.when());if(use){g.player.warp(use.wx,use.wz+.5,0);useAt(g,use);}else g.player.warp(rt.def.cx,rt.def.cz,0);r.step(.05,sim);if(g.healthModel.read().current>2)break;}
  check(g.healthModel.read().current===3,'lemonade heals guest');check(h.healthModel.read().current===4,'host unchanged');return {lemonade:'guest healed'};
 }
 return {built:true};
}
