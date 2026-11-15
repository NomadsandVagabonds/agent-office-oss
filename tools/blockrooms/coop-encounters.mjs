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
  check(Math.hypot(item.x-before.x,item.z-before.z)>.05,'walking drags the furniture');
  r.command(g.id,{type:'exit'});check(!g.grip.held,'second E releases');return {dragged:item.type};
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
  const toner=env.pursuer.of('toner'),at=toner.at();g.player.warp(at.x,at.z+.35,0);h.player.warp(r.start.x,r.start.z,0);
  for(let i=0;i<150&&toner.at().mode!=='puddle';i++){const p=toner.at();if(i%15===0&&toner.at().mode!=='dissolving'){g.healthModel.tick(3);g.healthModel.heal(4);g.player.warp(p.x,p.z+.35,0);toner.hurry({x:p.x,z:p.z,chase:true});}r.step(.05,sim);}
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
