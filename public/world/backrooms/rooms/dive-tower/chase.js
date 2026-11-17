import * as THREE from 'three';
import { Batch } from '../../kit.js';
import { M, Vox, VOXEL, glow } from '../../../vox/vox.js';
import { flightAt, TOWER } from './plan.js';

const COUNT = 6;
const SKIN = M('#302c2b');

function faceAndBody() {
  const v = new Vox();
  v.rbox(-5,30,-3,5,54,4,2,SKIN);
  v.rbox(-8,50,-4,8,56,4,2,SKIN);
  v.tube(0,53,0,0,61,2,2,SKIN);
  v.ellipsoid(0,67,3,6.5,7.3,5,SKIN);
  v.tube(-7,52,0,-9,34,3,2,SKIN);
  v.tube(-9,34,3,-12,25,8,1.35,SKIN);
  v.tube(7,52,0,11,35,2,2,SKIN);
  v.tube(11,35,2,9,21,6,1.45,SKIN);
  const ivory = glow('#e1d9bb');
  const socket = M('#0c0b0b', 0);
  for(let x=-6; x<=6; x++){
    const rise = Math.round(x*x/16);
    const z = 9-Math.round(x*x/19);
    v.box(x,62+rise,z,x+1,65+rise,z+1,socket);
    v.set(x,64+rise,z+1,ivory);
    if(x%2===0)v.set(x,62+rise,z+1,ivory);
  }
  v.box(-5,69,7,-2,70,8,ivory);
  v.box(2,69,7,5,70,8,ivory);
  return v;
}

function shin() {
  const v = new Vox();
  v.tube(0,0,0,0,-17,-1,2,SKIN);
  v.tube(0,-17,-1,0,-32,1,1.45,SKIN);
  v.rbox(-2,-33,0,2,-30,6,1,SKIN);
  return v;
}

function buildPack(c) {
  const geometry = (name, make) => {
    const batch = new Batch(true);
    batch.addVox(c.kit.model(name,make).solid,new THREE.Matrix4().makeScale(VOXEL,VOXEL,VOXEL));
    return c.kit.geometry(batch,[],[.28,.28,.31]);
  };
  const body=geometry('smiler:grin',faceAndBody), leg=geometry('smiler:leg',shin);
  const material=c.kit.surface({vox:true});
  return Array.from({length:COUNT}, (_,i)=>{
    const group=new THREE.Group();
    group.name='dive-smiler';
    group.visible=false;
    group.add(new THREE.Mesh(body,material));
    const feet=[-1,1].map(side=>{
      const mesh=new THREE.Mesh(leg,material);
      mesh.position.set(side*.075,.825,0);
      group.add(mesh);
      return mesh;
    });
    c.world.scene.add(group);
    return { group, feet, position:-i*1.14, lane:(i%3-1)*.31, pace:1.93-(i%3)*.035 };
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
    c.met('smilers');
  }
  function escape(body){
    if(safe.has(body))return;
    safe.add(body);
    if(started)c.survived('smilers');
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
      actor.group.position.set(pose.x,pose.y,pose.z);
      const moving=next>before+.001;
      const stride=now*8.3+i*1.3;
      const lean=moving ? .07 : across ? .22 : 0;
      actor.group.rotation.set(lean,pose.segment.yaw,moving?Math.sin(stride*.5)*.09:0,'YXZ');
      actor.feet.forEach((foot,k)=>{foot.rotation.x=moving?Math.sin(stride+k*Math.PI)*.51:0;});
    }
  }
  return { addTower,start,catchVisitor,update,escape,riding,pack,
    get started(){return started;}, get length(){return length;} };
}
