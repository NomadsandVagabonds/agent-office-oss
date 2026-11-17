import {Batch,lin} from '../../kit.js';
import {Vox,M} from '../../../vox/vox.js';
import {pipe} from '../../pool-finish.js';
const steel=lin('#73867b'),dark=lin('#263d34'),cream=lin('#d0cbb0');
const box=(b,a,col=steel)=>b.box(...a,col,{step:.8,uv:1.6});
// Bolted seating, deliberately fixed. A loose catalogue chair is still movable.
export function slattedBench(c,x,z,rot=0) {
  const b=new Batch(),wood=lin('#91896a');
  for(let j=0;j<5;j++)box(b,[-1.1,.43,-.31+j*.14,1.1,.49,-.2+j*.14],wood);
  for(const a of [-.82,.82]){
    box(b,[a-.045,.035,-.22,a+.045,.43,.27]);box(b,[a-.14,.005,-.28,a+.14,.035,.33]);
    for(const zz of [-.23,.28])box(b,[a-.025,.035,zz-.025,a+.025,.06,zz+.025],dark);
  }
  const g=c.dynamic(b);g.position.set(x,0,z);g.rotation.y=rot;
  c.solid(x-1.13,z-.32,x+1.13,z+.4,{keep:true,top:.49});return g;
}
// One molded float. Chamfered plastic, ribs, split line and the rope bore.
export function laneFloatVox(red=false) {
  const v=new Vox(),paint=M(red?'#8b493d':'#c7c6a6',0),edge=M(red?'#b36a51':'#e0d8b9',0),rubber=M('#34473b',0);
  for(let z=-8;z<=8;z++){
    const r=Math.abs(z)>6?3:Math.abs(z)>4?4:5;
    for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)if(Math.abs(x)+Math.abs(y)<=r*1.5&&!(Math.abs(x)<2&&Math.abs(y)<2))v.set(x,y,z,Math.abs(z)%3===0?edge:paint);
  }
  v.box(-1,-1,-10,1,1,10,rubber);return v;
}
export function keeperRig(c,p) {
  const parts=[];
  for(let i=0;i<8;i++) {
    const b=new Batch(true);c.model('channel:float:'+i%2,()=>laneFloatVox(i%2===0),0,0,{batch:b,solid:false,shadow:false,scale:1.35});
    const g=c.dynamic(b);g.name='lane-keeper-float';parts.push(g);
  }
  // A cap over a blank, long face: the goggle strap carries on around nothing.
  const v=new Vox(),skin=M('#a7b69b',0),cap=M('#823f34',0),black=M('#21352c',0),rim=M('#bec4a6',0);
  v.box(-4,-5,-4,4,6,4,skin);v.box(-5,5,-5,5,10,4,cap);v.box(-4,10,-4,4,11,3,cap);
  v.box(-5,2,-4,5,3,5,black);v.box(-4,0,4,-1,4,6,rim);v.box(1,0,4,4,4,6,rim);
  v.box(-3,1,6,-2,3,7,black);v.box(2,1,6,3,3,7,black);v.box(-1,-3,4,1,-2,5,black);v.box(-3,-8,-3,3,-5,3,skin);
  v.box(-2,11,-3,2,12,2,cap);v.box(-5,5,-2,-4,8,3,rim);v.box(4,5,-2,5,8,3,rim);
  const b=new Batch(true);c.model('channel:keeper-head',()=>v,0,0,{batch:b,solid:false,shadow:false,scale:2.2});const head=c.dynamic(b);head.name='lane-keeper';
  const hands=[];
  for(const side of [-1,1]){
    const b=new Batch();pipe(b,[side*.2,-.16,-.1],[side*.63,-.07,.25],.045,lin('#879d84'));
    pipe(b,[side*.63,-.07,.25],[side*.5,-.02,.58],.034,lin('#a7b69b'));
    for(let i=0;i<4;i++)box(b,[side*.5-.09+i*.046,-.04,.52,side*.5-.06+i*.046,.015,.78+(i%2)*.05],lin('#a7b69b'));
    hands.push(c.dynamic(b));
  }
  const history=[];
  return {head,parts,hands,update(s,time){
    // Sample the travelled path every 5cm, not once per frame. Float spacing
    // must stay the same while drifting, hunting and on slower machines.
    if(!history.length)for(let i=0;i<110;i++)history.push({x:s.x-Math.sin(s.yaw)*i*.05,z:s.z-Math.cos(s.yaw)*i*.05,yaw:s.yaw});
    let dx=s.x-history[0].x,dz=s.z-history[0].z,d=Math.hypot(dx,dz);
    while(d>=.05){
      const last=history[0];history.unshift({x:last.x+dx/d*.05,z:last.z+dz/d*.05,yaw:Math.atan2(dx,dz)});history.length=110;
      dx=s.x-history[0].x;dz=s.z-history[0].z;d=Math.hypot(dx,dz);
    }
    head.position.set(s.x,p.water+.07+(s.phase==='listen'?.1:0),s.z);head.rotation.set(.08*Math.sin(time),s.yaw,0);
    parts.forEach((g,i)=>{const a=history[Math.min(history.length-1,(i+1)*12)];g.position.set(a.x,p.water-.02+Math.sin(time*2-i*.8)*.035,a.z);g.rotation.set(Math.sin(time*2-i)*.08,a.yaw,Math.sin(time-i)*.09);});
    hands.forEach((g,i)=>{g.position.copy(head.position);g.rotation.set(0,s.yaw,Math.sin(time*3+i*Math.PI)*.18);});
  }};
}
export function pumpAssembly(c,x,z) {
  const b=c.flat,red=lin('#864838');
  box(b,[x-.65,0,z-.5,x+.65,.14,z+.5],dark);
  box(b,[x-.52,.14,z-.35,x+.52,.64,z+.36],steel);
  for(let i=0;i<9;i++)box(b,[x-.46+i*.105,.28,z+.36,x-.43+i*.105,.55,z+.4],dark);
  pipe(b,[x,.65,z],[x,1.6,z],.10,steel);
  pipe(b,[x,.7,z],[x+.9,.7,z],.14,steel);
  for(const yy of [.85,1.25]){
    box(b,[x-.18,yy-.04,z-.18,x+.18,yy+.04,z+.18],dark);
    for(const a of [-.13,.13])box(b,[x+a-.025,yy+.04,z+.13,x+a+.025,yy+.08,z+.19],cream);
  }
  const lever=new Batch();pipe(lever,[x,1.2,z+.2],[x,1.7,z+.35],.035,steel);box(lever,[x-.15,1.65,z+.29,x+.15,1.75,z+.4],red);
  const handle=c.dynamic(lever,{pivot:[x,1.2,z+.2]});
  const g=c.mapped('channel:gauge',c.kit.tex.custom('channel:gauge',128,128,g=>{
    g.fillStyle='#d5cfb0';g.fillRect(0,0,128,128);g.strokeStyle='#354c3c';g.lineWidth=5;g.strokeRect(5,5,118,118);
    for(let i=0;i<9;i++){const a=Math.PI*.8+i*Math.PI*1.4/8;g.fillStyle=i>6?'#954c3c':'#354c3c';g.fillRect(62+Math.cos(a)*43,62+Math.sin(a)*43,4,9);}
    g.fillStyle='#354c3c';g.fillRect(61,28,4,40);g.font='12px monospace';g.textAlign='center';g.fillText('RETURN',64,99);
  },{clamp:true}));c.board(g,x,1.08,z+.205,.28,.28);
  c.solid(x-.65,z-.5,x+.65,z+.5,{keep:true,top:.72});return handle;
}
export function officeWindow(c,b,x,z,y,width=2.2) {
  // Glass stays opaque and lit: there is no fake passage behind the grille.
  box(b,[x-.035,y,z-width/2,x+.035,y+1.55,z+width/2],lin('#5c7767'));
  for(const zz of [z-width/2,z,z+width/2])box(c.flat,[x-.065,y-.06,zz-.035,x+.065,y+1.61,zz+.035],cream);
  for(const yy of [y,y+1.55])box(c.flat,[x-.075,yy-.035,z-width/2-.06,x+.075,yy+.035,z+width/2+.06],cream);
  for(let k=0;k<8;k++)box(c.flat,[x-.08,y+.12+k*.17,z-width/2,x+.08,y+.15+k*.17,z+width/2],lin('#7c917d'));
}
