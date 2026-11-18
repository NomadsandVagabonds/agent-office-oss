// A junction is made of pipe bores meeting at their common saddle. At a
// three-way the two neighbouring skins share the same bisector, so there is
// no wall across either branch when the camera is inside.
import { lin } from '../../kit.js';
import { pipe } from '../../pool-finish.js';

export const JOINT_LENGTH = .76;
export const FORK_ARM_LENGTH = 1.40;
export const SHELL_SIDES=20;
const TAU=Math.PI*2;
const directions={e:0,n:Math.PI/2,w:Math.PI,s:3*Math.PI/2};
const steel=lin('#71827b'), underside=lin('#899483'), stripe=lin('#d9c398');
const angles=Array.from({length:SHELL_SIDES+1},(_,i)=>TAU*i/SHELL_SIDES);

function hoop(center,heading,r) {
  return angles.map(a=>[center[0]-Math.sin(heading)*r*Math.sin(a),
    center[1]-r*Math.cos(a),center[2]+Math.cos(heading)*r*Math.sin(a)]);
}

function skin(batch,start,end,color,inside=false,paintStripe=false) {
  for(let i=0;i<SHELL_SIDES;i++) {
    const col=paintStripe && (i===4||i===15) ? stripe : color;
    if(inside) batch.quad(start[i],start[i+1],end[i+1],end[i],col);
    else batch.quad(start[i],end[i],end[i+1],start[i+1],col);
  }
}

export function moldedJunction(c,batch,h,floorY,axisY,r,first) {
  const body=lin(h.color), inner=body.map(v=>v*.72+.10);
  const origin=[h.x,axisY,h.z];
  const arms=Object.keys(directions).filter(key=>h.open[key]).map(key=>{
    const heading=directions[key];
    // Ease the fork out on either side of the original walk line. Both
    // branches return tangent to their straight crawl segments at the cuffs.
    const angle=heading+(first&&key==='e'?-.29:first&&key==='s'?-.33:0);
    let length = JOINT_LENGTH;
    if (first) length = key === 'n' ? .80 : FORK_ARM_LENGTH;
    return {key,heading,angle,length};
  }).sort((a,b)=>a.angle-b.angle);
  const along=(heading,d)=>[h.x+Math.cos(heading)*d,axisY,h.z+Math.sin(heading)*d];
  const centerAt=(arm,u)=>{
    const p=along(arm.heading,arm.length*u);
    const ease=arm.length*u*(1-u)**2;
    p[0]+=ease*(Math.cos(arm.angle)-Math.cos(arm.heading));
    p[2]+=ease*(Math.sin(arm.angle)-Math.sin(arm.heading));
    return p;
  };

  for(const [i,arm] of arms.entries()){
    const prev=arms[(i+arms.length-1)%arms.length],next=arms[(i+1)%arms.length];
    const leftGap=(arm.angle-prev.angle+TAU)%TAU,rightGap=(next.angle-arm.angle+TAU)%TAU;
    for(const inside of [false,true]){
      const radius=r*(inside?.95:1);
      const start=hoop(origin,arm.angle,radius).map((p,k)=>{
        const offset=radius*Math.sin(angles[k]);
        const d=Math.abs(offset)/Math.tan((offset>=0?rightGap:leftGap)/2);
        return [p[0]+Math.cos(arm.angle)*d,p[1],p[2]+Math.sin(arm.angle)*d];
      });
      let last=start;
      const end=hoop(along(arm.heading,arm.length),arm.heading,radius);
      for(let step=1;step<=5;step++){
        const u=step/5, center=centerAt(arm,u), chord=along(arm.heading,arm.length*u);
        const ring=start.map((v,k)=>v.map((value,d)=>value+(end[k][d]-value)*u+center[d]-chord[d]));
        skin(batch,last,ring,inside?inner:body,inside,!inside);last=ring;
      }
    }
    const cuffA=along(arm.heading,arm.length-.075),cuffB=along(arm.heading,arm.length-.016);
    const a=hoop(cuffA,arm.heading,r*1.055),b=hoop(cuffB,arm.heading,r*1.055);
    skin(batch,hoop(cuffA,arm.heading,r),a,steel);
    skin(batch,a,b,body);
    skin(batch,b,hoop(cuffB,arm.heading,r),steel);
    if(first && arm.key==='n')skin(batch,hoop(cuffB,arm.heading,r),hoop(cuffB,arm.heading,r*.95),stripe);
    const end=along(arm.heading,arm.length);
    const alongZ = arm.key === 'n' || arm.key === 's';
    const halfX = alongZ ? .31 : 0, halfZ = alongZ ? 0 : .31;
    c.flat.box(Math.min(h.x,end[0])-halfX, floorY-.036, Math.min(h.z,end[2])-halfZ,
      Math.max(h.x,end[0])+halfX, floorY+.01, Math.max(h.z,end[2])+halfZ, underside);
  }
  pipe(c.flat,[h.x,-1.44,h.z],[h.x,axisY-r,h.z],.085,steel);
}
