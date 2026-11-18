// The observation office hangs across the well. Swimmers can see the far
// board through the glazing and swim under the continuous submerged sill.
import { Batch, lin, WHITE } from '../../kit.js';
import { pipe, poolDetail } from '../../pool-finish.js';
import { addTranslucent, poolTileTex } from '../../waterpark.js';

const frame = lin('#65756c'), enamel = lin('#c6c2a9'), seal = lin('#354841');
const bronze = lin('#9f8961'), steel = lin('#899f98');
const face = (x0, y0, x1, y1, z) => [[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]];

function paceClock(c) {
  const texture = c.kit.tex.custom('well:pace-clock', 168, 168, g => {
    g.fillStyle = '#d9d1af'; g.fillRect(0,0,168,168);
    g.translate(84,84);
    for (let i=0;i<60;i++) {
      g.fillStyle = '#37423e';
      g.fillRect(i%5 ? -1 : -2,-77,i%5 ? 2 : 4,i%5 ? 5 : 10);
      g.rotate(Math.PI/30);
    }
    g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      g.fillText(String(i*10).padStart(2,'0'),53*Math.sin(a),-53*Math.cos(a));
    }
    g.fillStyle='#805546'; g.fillRect(-39,-2,51,4);
    g.rotate(Math.PI*.27); g.fillStyle='#ac392b'; g.fillRect(-2,-68,4,84);
    g.fillStyle='#33443b'; g.fillRect(-4,-4,8,8);
  }, {clamp:true});
  return c.mapped('well:pace-clock',texture);
}

export function observationWall(c, x0, x1, bottom) {
  const shell=c.flat, hardware=poolDetail(c).batch, glass=new Batch();
  const tile=c.mapped('well:observation-dado',poolTileTex(c.kit,'cobalt'));
  const center=1.14, sill=.63, head=Math.min(2.40,c.H-.31);
  tile.box(x0,bottom,-.12,x1,sill,.12,WHITE,{uv:.8});
  c.wall.box(x0,head,-.12,x1,c.H,.12,WHITE,{uv:1});
  tile.box(-center,sill,-.12,center,head,.12,WHITE,{uv:.8});
  shell.box(x0,bottom-.025,-.143,x1,bottom+.045,.143,steel);
  for (const y of [sill,head]) shell.box(x0,y-.045,-.158,x1,y+.046,.158,frame);
  for (const side of [-1,1]) {
    const outer=side<0?x0:x1;
    const count=Math.max(2,Math.round((Math.abs(outer)-center)/1.35));
    for (let i=0;i<=count;i++) {
      const edge=side*center+(outer-side*center)*i/count;
      shell.box(edge-.035,sill,-.118,edge+.035,head,.118,frame);
      if(i===count) continue;
      const end=edge+(outer-side*center)/count;
      const left=Math.min(edge,end)+.037, right=Math.max(edge,end)-.037;
      glass.quad(...face(left,sill+.04,right,head-.04,.015),lin('#97c6ae'));
      shell.box(left,head-.31,-.06,right,head-.275,.06,frame);
      // Some operators left their blinds up. In two bays they still hang
      // at different heights, with real gaps and visible weighted cords.
      const slats = (i+Number(side>0))%3===1 ? 12 : i%2 ? 7 : 3;
      const top=head-.34, slatColor=(i%2 ? enamel : lin('#98a397'));
      for (let k=0;k<slats;k++) {
        const y=top-k*.082, droop=(k+1)*.0025*(i%2 ? 1 : -1);
        const backLeft=[left,y,-.065], backRight=[right,y+droop,-.065];
        const lipLeft=[left,y-.039,.027], lipRight=[right,y+droop-.039,.027];
        hardware.quad(backLeft,lipLeft,lipRight,backRight,slatColor);
        hardware.quad(backRight,lipRight,lipLeft,backLeft,frame);
        hardware.quad(lipLeft,[left,y-.054,.027],[right,y+droop-.054,.027],lipRight,slatColor);
      }
      for (const x of [left+.12,right-.12]) {
        hardware.box(x-.006,top-(slats-1)*.082-.05,-.01,x+.006,head-.3,.002,seal);
      }
    }
  }
  const clockY=(1.45+head)/2;
  pipe(shell,[0,clockY,.12],[0,clockY,.205],.325,seal,32);
  // Circular UVs keep the dial inside the metal bezel.
  const clock=paceClock(c);
  for(let i=0;i<32;i++) {
    const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
    const pt=t=>[.294*Math.cos(t),clockY+.294*Math.sin(t),.209];
    const uv=t=>[.5+.49*Math.cos(t),.5+.49*Math.sin(t)];
    clock.quad([0,clockY,.209],pt(a),pt(b),pt(b),WHITE,[[.5,.5],uv(a),uv(b),uv(b)]);
  }
  addTranslucent(c,glass,{alpha:.16,order:2});
}

export function divingBell(c, bell) {
  const shell=new Batch(), hardware=poolDetail(c).batch, y=-1.13;
  const profile=[[bell.r,y],[bell.r,y+.19],[bell.r*.96,y+.37],
    [bell.r*.79,y+.54],[bell.r*.48,y+.67],[bell.r*.20,y+.72]];
  const point=([radius,h],angle)=>[bell.x+radius*Math.cos(angle),h,bell.z+radius*Math.sin(angle)];
  const sides=32;
  for(let i=0;i<sides;i++) {
    const a=i*2*Math.PI/sides,b=(i+1)*2*Math.PI/sides;
    for(let k=1;k<profile.length;k++) {
      const low=profile[k-1], high=profile[k];
      shell.quad(point(low,a),point(high,a),point(high,b),point(low,b),lin('#aed3c0'));
      if(i%4===0) pipe(hardware,point(low,a),point(high,a),.015,bronze);
    }
    const start=point(profile[0],a),end=point(profile[0],b);
    pipe(hardware,start,end,.027,steel);
    if(i%4===0) pipe(hardware,[start[0],y-.025,start[2]],[start[0],y+.036,start[2]],.039,bronze);
  }
  const at=[bell.x,y+.72,bell.z];
  pipe(c.flat,at,[bell.x,y+.81,bell.z],bell.r*.21,bronze,20);
  pipe(c.flat,[bell.x,y+.8,bell.z],[bell.x,-.24,bell.z],.044,seal);
  pipe(c.flat,[bell.x,-.24,bell.z],[bell.x,-.24,-.11],.044,seal);
  addTranslucent(c,shell,{alpha:.24,order:3});
}
