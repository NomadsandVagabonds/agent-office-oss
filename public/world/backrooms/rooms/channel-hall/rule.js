// Room-local height field and water resident. No rendering or player ownership.
export const LANE_KEEPER = Object.freeze({ notice: 1.35, forget: 1.6, speed: 1.8, drift: .38, reach: .68, recovery: 2.8, pump: 12, cooldown: 16 });
export function channelPlan({W,D,H}) {
  return {W,D,H,half:4.2,end:D/2-4,water:-.48,depth:1.12,step:.16,tread:.3,
    island:{x:0,z:-2.8,half:.65},pump:{x:-7.2,z:D/2-5.2},outlet:{x:-1.6,z:D/2-6.6}};
}
export function channelFloor(p,x,z) {
  const edge=Math.min(p.half-Math.abs(x),p.end-Math.abs(z));
  if(edge<=0)return 0;
  const basin=-Math.min(p.depth,(1+Math.floor(edge/p.tread))*p.step);
  const d=Math.max(Math.abs(x-p.island.x),Math.abs(z-p.island.z));
  const island=-.32-Math.max(0,Math.ceil((d-p.island.half)/p.tread))*p.step;
  return Math.max(basin,island);
}
export const channelWet=(p,x,z)=>channelFloor(p,x,z)<p.water-.17;
export function channelCuts(p) {
  const xs=[-p.W/2,p.W/2],zs=[-p.D/2,p.D/2];
  for(let i=0;i<=7;i++){const a=p.half-i*p.tread,b=p.end-i*p.tread;xs.push(-a,a);zs.push(-b,b);}
  for(let i=0;i<=5;i++){const r=p.island.half+i*p.tread;xs.push(p.island.x-r,p.island.x+r);zs.push(p.island.z-r,p.island.z+r);}
  const clean=a=>[...new Set(a.map(v=>+v.toFixed(5)))].sort((a,b)=>a-b);
  return {xs:clean(xs),zs:clean(zs)};
}
export const keeperState=p=>({x:1.5,z:p.end-3,yaw:0,phase:'drift',notice:0,quiet:0,recovery:0,pump:0,cooldown:0,lap:0,hit:false,warn:false,escaped:false,previous:null});
export function startPump(s){if(s.cooldown>0)return false;s.pump=LANE_KEEPER.pump;s.cooldown=LANE_KEEPER.cooldown;return true;}
export function stepKeeper(s,dt,me,p,{clear=()=>true,pace=1}={}) {
  dt=Math.max(0,Math.min(.1,dt));s.hit=false;s.warn=false;s.escaped=false;
  for(const k of ['recovery','pump','cooldown'])s[k]=Math.max(0,s[k]-dt);
  const prev=s.previous,wet=me.inside&&channelWet(p,me.x,me.z)&&me.grounded!==false;
  // Do not mistake a warp, a visitor swap or a first sample for splashing.
  const delta=prev&&prev.key===me.key&&prev.inside&&me.inside?Math.hypot(me.x-prev.x,me.z-prev.z):0;
  const moving=wet&&delta>.12*dt&&delta<Math.max(.4,dt*8);
  s.previous={x:me.x,z:me.z,inside:me.inside,key:me.key};
  const old=s.phase;
  if(s.pump>0){s.phase='lured';s.notice=0;s.quiet=0;}
  else if(s.recovery>0){s.phase='recover';s.notice=0;}
  else if(moving){s.quiet=0;s.notice=Math.min(LANE_KEEPER.notice,s.notice+dt);s.phase=s.notice>=LANE_KEEPER.notice?'hunt':'listen';}
  else {
    s.quiet+=dt;
    if(!wet||s.quiet>=LANE_KEEPER.forget){s.phase='drift';s.notice=Math.max(0,s.notice-dt*2);}
  }
  if(s.phase==='hunt'&&old!=='hunt')s.warn=true;
  if(old==='hunt'&&s.phase!=='hunt'&&s.phase!=='recover')s.escaped=true;
  const patrol=[[-1.6,p.end-3],[1.6,p.end-3],[2,p.island.z],[1.6,-p.end+2.4],[-1.6,-p.end+2.4],[-2,p.island.z]];
  let target=s.phase==='hunt'?me:s.phase==='lured'?p.outlet:{x:patrol[s.lap][0],z:patrol[s.lap][1]};
  if(s.phase==='drift'&&Math.hypot(s.x-target.x,s.z-target.z)<.3)s.lap=(s.lap+1)%patrol.length;
  const speed=s.phase==='hunt'?LANE_KEEPER.speed*pace:s.phase==='lured'?2.2:s.phase==='listen'?0:LANE_KEEPER.drift;
  const dx=target.x-s.x,dz=target.z-s.z,d=Math.hypot(dx,dz),dist=Math.min(d,speed*dt);
  if(d>.03&&dist>0)for(const a of [0,.5,-.5,1,-1,1.6,-1.6]) {
    const ux=(dx*Math.cos(a)-dz*Math.sin(a))/d,uz=(dx*Math.sin(a)+dz*Math.cos(a))/d,nx=s.x+ux*dist,nz=s.z+uz*dist;
    if(channelWet(p,nx,nz)&&clear(s.x,s.z,nx,nz,.25)) {s.x=nx;s.z=nz;s.yaw=Math.atan2(ux,uz);break;}
  }
  if(s.phase==='hunt'&&wet&&Math.hypot(me.x-s.x,me.z-s.z)<LANE_KEEPER.reach&&clear(s.x,s.z,me.x,me.z,.08)) {
    s.hit=true;s.recovery=LANE_KEEPER.recovery;s.phase='recover';s.notice=0;
  }
  return s;
}
