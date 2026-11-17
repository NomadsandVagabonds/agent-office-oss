import { buildSmilingClimber } from '../cubicle-grid/rig.js';
import { flightAt, TOWER } from './plan.js';

const COUNT = 6;
const RESIDENT = 'pit-clerks';

function buildPack(c) {
  return Array.from({ length: COUNT }, (_, i) => {
    const rig = buildSmilingClimber(c.kit, i, { swimTrunks: true });
    const { group } = rig;
    group.name = 'dive-smiler';
    group.visible = false;
    c.world.scene.add(group);
    return { group, rig, position: -i * 1.14, lane: (i % 3 - 1) * .31, pace: 1.93 - (i % 3) * .035 };
  });
}

// One measured course for the whole horde. Its tower segments use the same
// launch and landing data as the player's jumps, with no reset at the doorway.
export function createChase(c, maze) {
  const letThrough = c.room.doors.find(d=>c.level.rooms[d.to]?.arch===TOWER);
  const pack=buildPack(c), course=[], safe=new WeakSet(), riding=new WeakSet(), hitAt=new WeakMap();
  const point=(ctx,x,z,y)=>({...ctx.toWorld(x,z),y:(ctx.room.y||0)+y});
  let started=false, lightsOut=false, length=0, time=0, last;
  function line(next, airborne=false){
    if(last){
      const distance=Math.hypot(next.x-last.x,next.z-last.z);
      if(distance>.001){
        course.push({ a:last,b:next,start:length,length:distance,airborne,
          yaw:Math.atan2(next.x-last.x,next.z-last.z) });
        length+=distance;
      }
    }
    last=next;
  }
  maze.route.forEach(([x,z])=>line(point(c,x,z,0)));
  function addTower(tower, plan){
    const center=plan.platforms[0];
    line(point(tower,0,tower.D/2-.3,center.y));
    for(const hop of plan.flights){
      line(point(tower,hop.from.x,hop.from.nose+.32,hop.from.y));
      if(!hop.plunge)line(point(tower,hop.x,hop.z,hop.y),true);
    }
  }
  function sample(actor) {
    const segment=course.find(p=>actor.position<=p.start+p.length)||course.at(-1);
    const t=(actor.position-segment.start)/segment.length;
    const pose=flightAt(segment.a,segment.b,t);
    // Ordinary walking segments have no airborne arc.
    if(!segment.airborne)pose.y=segment.a.y+(segment.b.y-segment.a.y)*Math.min(1,Math.max(0,t));
    pose.x+=Math.cos(segment.yaw)*actor.lane;
    pose.z-=Math.sin(segment.yaw)*actor.lane;
    return { ...pose, segment };
  }
  function nearestProgress(body){
    let best=Infinity, along=0;
    for(const s of course){
      const dx=s.b.x-s.a.x, dz=s.b.z-s.a.z;
      const t=Math.max(0,Math.min(1,((body.x-s.a.x)*dx+(body.z-s.a.z)*dz)/(s.length*s.length)));
      const y=s.a.y+(s.b.y-s.a.y)*t;
      const d=Math.hypot(s.a.x+dx*t-body.x,s.a.z+dz*t-body.z,y+1.1-body.y);
      if(d<best){best=d;along=s.start+s.length*t;}
    }
    return along;
  }
  function start(){
    if(started||!letThrough)return;
    started=true;
    const a=course[0].a;
    c.env.play?.('rattle',a.x,a.z,6);
    c.met(RESIDENT);
  }
  function escape(body){
    if(safe.has(body))return;
    safe.add(body);
    if(started)c.survived(RESIDENT);
  }
  function catchVisitor(context, visitor){
    const body=visitor.world;
    if(!started||body.frozen||safe.has(body)||riding.has(body)||(hitAt.get(body)??-Infinity)>time)return;
    for(const {group} of pack){
      const a=group.position;
      if(!group.visible||Math.hypot(body.x-a.x,body.z-a.z)>.57||Math.abs(body.y-1.1-a.y)>.54)continue;
      if(!c.world.los(a.x,a.z,body.x,body.z))continue;
      context.hurt(1,a);
      hitAt.set(body,time+1.6);
      break;
    }
  }
  function update(dt, now, visitor){
    time=now;
    if(!started)return;
    if(!lightsOut){ lightsOut=true; c.world.setLights(c.rt,.43); }
    const here=c.world.roomAt(visitor.world.x,visitor.world.z);
    const inEncounter=here?.id===c.rt.id||here?.id===letThrough.to;
    if(!inEncounter)return;
    const across=safe.has(visitor.world);
    const along=across?length:nearestProgress(visitor.world);
    const lead=Math.min(length,along+.35);
    const spacing=across ? .27 : .62;
    for(const [i,actor] of pack.entries()){
      const before=actor.position;
      const rush=along-before>5? .24 : 0;
      const next=Math.min(before+dt*(actor.pace+rush), Math.max(before,lead-i*spacing));
      actor.position=next;
      const pose=sample(actor);
      if(next>=0&&!pose.segment.airborne&&!c.world.free(pose.x,pose.z,.13)){
        actor.position=before;
        continue;
      }
      actor.group.visible=next>=0;
      if (!actor.group.visible) continue;
      actor.group.position.set(pose.x,pose.y,pose.z);
      actor.group.rotation.y = pose.segment.yaw;
      actor.rig.pose(pose.segment.airborne ? 'falling' : 'stalking', now + i * .23);
      if (across && next - before < .001 && length - next < .6) actor.rig.head.rotation.x = .32;
      const room = c.world.roomAt(pose.x, pose.z);
      actor.rig.light(c.world.lightAt(pose.x, pose.z, pose.y - (room?.def.y ?? 0) + 1.05));
    }
  }
  return { addTower,start,catchVisitor,update,escape,riding,pack,
    get started(){return started;}, get length(){return length;} };
}
