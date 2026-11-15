import {SHADOW} from '../backrooms/cast/shadow.rule.js';
export function seesVisitor(v,at,world,{far=40,radius=.4,margin=.14,walls=true}={}){
 const p=v.me||v,dx=at.x-p.x,dz=at.z-p.z,d=Math.hypot(dx,dz);
 if((v.health??p.health)<=0||d>far)return false;
 if(d<.35)return true;
 if(Math.abs(p.pitch)>1.05&&d>1.2)return false;
 return (-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/d>Math.cos(Math.min(Math.PI,.62+margin+Math.atan2(radius,d)))&&(!walls||world.los(p.x,p.z,at.x,at.z));
}
export function chooseVisitor(visitors,at,id,world){
 const live=visitors.filter(v=>v.healthModel.read().current>0&&!v.held);if(!live.length)return null;
 const distance=v=>Math.hypot(v.me.x-at.x,v.me.z-at.z);
 const sorted=live.slice().sort((a,b)=>distance(a)-distance(b));
 if(id==='shadow'){
  const touching=sorted.find(v=>distance(v)<SHADOW.touch&&world.los(v.me.x,v.me.z,at.x,at.z));if(touching)return touching;
  const looking=sorted.find(v=>{const p=v.me,d=distance(v);return d<SHADOW.far&&Math.abs(p.pitch)<.7&&(-Math.sin(p.yaw)*(at.x-p.x)-Math.cos(p.yaw)*(at.z-p.z))/Math.max(.01,d)>Math.cos(SHADOW.cone+Math.atan2(.25,d))&&world.los(p.x,p.z,at.x,at.z);});if(looking)return looking;
 }
 return sorted[0];
}
