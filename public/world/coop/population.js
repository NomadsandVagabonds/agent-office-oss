// One room clock, per-visitor zone occupancy. Separate from camera visibility.
import {toLocal} from '../backrooms/gen.js';
export function createPopulation(world, withVisitor, { held = () => null } = {}) {
 const occupants=new Map(),zones=new WeakMap();
 return {update(dt,time,visitors){
  const living=visitors.filter(v=>v.health>0),located=living.map(v=>({v,room:world.roomAt(v.me.x,v.me.z)}));
  const nearby=new Set();for(const {room}of located)if(room)for(const [id,d]of world.distances(room.id))if(d<=1)nearby.add(id);
  for(const rt of world.rooms){
   rt.group.visible=true;rt.near=nearby.has(rt.id)||!!rt.coopHeld;
   const here=located.filter(p=>p.room===rt).map(p=>p.v),before=occupants.get(rt.id)||[];
   if(!before.length&&here.length)withVisitor(here[0],()=>{rt.visits=(rt.visits||0)+1;rt.onEnter?.(rt.visits);});
   if(before.length&&!here.length)withVisitor(before[0],()=>rt.onLeave?.());occupants.set(rt.id,here);
   const local=v=>{const p=toLocal(rt.def,v.me.x,v.me.z);return {...p,id:v.id,inside:here.includes(v),yaw:v.me.yaw-rt.def.rot*Math.PI/2,moving:v.me.moving,speed:v.me.speed,world:v.me};};
   for(const zone of rt.zones){const old=zones.get(zone)||new Map(),next=new Map();
    for(const v of here){const p=local(v);if(p.x>=zone.x0&&p.x<=zone.x1&&p.z>=zone.z0&&p.z<=zone.z1){next.set(v.id,v);withVisitor(v,()=>{if(!old.has(v.id))zone.enter?.(p);zone.stay?.(dt,p);});}}
    for(const [id,v]of old)if(!next.has(id))withVisitor(v,()=>zone.leave?.(local(v)));
    zones.set(zone,next);
   }
   if(!rt.near||!living.length)continue;
   // Room clocks stay singular, but a guest pressing a wall must not be
   // masked by an idle host standing in the same room.
   const focus=rt.coopFocus?.()||[],distance=v=>Math.min(...focus.map(p=>{const q=local(v);return Math.hypot(q.x-p.x,q.z-p.z);}));
   const focused=focus.length&&here.length?here.reduce((a,b)=>distance(a)<=distance(b)?a:b):null;
   const chosen=rt.chooseVisitor?.(here.map(v=>({...local(v),holdingBalloon:withVisitor(v,()=>held()?.type==='balloon')})));
   const target=visitors.find(v=>v.id===rt.coopHeld)||here.find(v=>v.id===rt.coopInteraction?.id&&rt.coopInteraction.until>time)||here.find(v=>v.id===chosen)||focused||here.find(v=>v.me.moving||Math.hypot(v.me.wishX||0,v.me.wishZ||0)>.01)||here[0]||living.reduce((a,b)=>Math.hypot(a.me.x-rt.def.cx,a.me.z-rt.def.cz)<Math.hypot(b.me.x-rt.def.cx,b.me.z-rt.def.cz)?a:b);
   withVisitor(target,()=>{const p=local(target);for(const fn of rt.ticks)fn(dt,time,p);});
  }
 }};
}
