// Office construction and pool equipment occupying the same space. The
// playable banks remain clear; the high flumes belong to the sealed galleries.
import * as THREE from 'three';
import {Batch,lin,WHITE} from '../../kit.js';
import {innerTubeVox,addTranslucent,buildOverheadFlumes} from '../../waterpark.js';
import {pipe,poolDetail} from '../../pool-finish.js';
import {channelFloor} from './rule.js';
const cream=lin('#cac9b4'),steel=lin('#748c80'),dark=lin('#293b35'),rust=lin('#88694e');
const box=(b,q,col=cream)=>b.box(...q,col,{step:.7,uv:1.6});

export const COLLISION_FLUMES=[
  {id:'coral',color:'#e87b68',radius:.67,pts:[[-8.65,4.15,5.7],[-6.5,4.15,5.7],[-4.5,3.45,5.9],[-1.6,3.65,5.6],[1.4,4.9,2.3],[4.5,4.2,-1.6],[8.65,4.2,-4.2]]},
  {id:'yellow',color:'#e2b448',radius:.57,pts:[[2.8,7.0,6.2],[2.8,6.25,6.2],[2.3,5.4,6.2],[.6,5.25,7.3],[-2.5,5.6,8.3],[-4.9,6.8,6.9],[-8.65,7.35,5.7]]},
];
export function cutSlab(batch,x0,x1,z0,z1,y,thickness,hole){
  const [hx0,hx1,hz0,hz1]=hole;
  for(const [a,b,d,e]of [[x0,hx0,z0,z1],[hx1,x1,z0,z1],[hx0,hx1,z0,hz0],[hx0,hx1,hz1,z1]])
    if(b>a&&e>d)box(batch,[a,y,d,b,y+thickness,e]);
}

function door(c,side,z,y,{open=false}={}){
  const x=side*8.69,b=c.flat,w=1.8,h=2.22,red=lin('#956456');
  // A recessed office door: aluminium jamb, kickplate, wired-glass inset,
  // lever and closer. These galleries cannot be reached from the ground.
  box(b,[x-.045,y,z-w/2-.08,x+.045,y+h+.08,z+w/2+.08],dark);
  for(const zz of [z-w/2,z+w/2])box(b,[x-.085,y,zz-.045,x+.085,y+h+.04,zz+.045],cream);
  box(b,[x-.09,y+h-.02,z-w/2,x+.09,y+h+.06,z+w/2],cream);
  if(!open){
    box(b,[x-side*.055-.02,y+.035,z-w/2+.04,x-side*.055+.02,y+h-.04,z+w/2-.04],red);
    box(b,[x-side*.09-.01,y+.08,z-w/2+.1,x-side*.09+.01,y+.35,z+w/2-.1],steel);
    box(b,[x-side*.09-.02,y+.82,z-.42,x-side*.09+.02,y+1.85,z+.42],cream);
    box(b,[x-side*.115-.01,y+.89,z-.35,x-side*.115+.01,y+1.78,z+.35],lin('#6f8e80'));
    for(let a=0;a<5;a++)box(b,[x-side*.13-.009,y+.9+a*.18,z-.34,x-side*.13+.009,y+.91+a*.18,z+.34],steel);
    pipe(b,[x-side*.18,y+.85,z+.59],[x-side*.18,y+.85,z+.77],.025,steel);
  }else{
    // The leaf is folded back beside the flume's occupied aperture.
    box(b,[x-side*.12-.025,y+.04,z+w/2+.09,x-side*.12+.025,y+h-.04,z+w/2+.85],red);
  }
  box(b,[x-side*.16-.04,y+h-.19,z-.6,x-side*.16+.04,y+h-.09,z-.31],steel);
  pipe(b,[x-side*.18,y+h-.14,z-.45],[x-side*.35,y+h-.14,z-.1],.014,steel);
  box(b,[x-side*.17-.02,y+h+.2,z-.28,x-side*.17+.02,y+h+.26,z+.28],cream);
}

function wetGlass(c){
  return c.kit.tex.custom('channel:wet-glass',128,256,g=>{
    g.clearRect(0,0,128,256);
    for(let i=0;i<92;i++){
      const x=(i*43)%128,y=(i*67)%256;
      g.fillStyle=i%3?'#bed6bbad':'#7c9b8bc4';g.fillRect(x,y,1+i%2,3+i%23);
      if(i%4===0){g.fillStyle='#d6dfc3bb';g.fillRect(x-1,y,3,2);}
    }
    g.fillStyle='#718674ac';for(let x=0;x<128;x+=3)g.fillRect(x,231-(x*13)%16,3,25+(x*13)%16);
  });
}

function officeEnclosure(c,t){
  const b=c.flat,wall=c.mapped('channel:office-dado',t.tile),pane=new Batch();
  const streaks=c.mapped('channel:glass-streaks',wetGlass(c),{cutout:true,side:THREE.DoubleSide});
  const x=5.94,z0=2.2,z1=6.35;
  box(wall,[x-.08,0,z0,x+.08,.8,z1]);c.solid(x-.08,z0,x+.08,z1,{keep:true,tall:true});
  box(wall,[x,0,z0-.08,8.75,.8,z0+.08]);c.solid(x,z0-.08,8.75,z0+.08,{keep:true,tall:true});
  const glassFace=q=>{pane.quad(...q,lin('#82b6a0'));streaks.quad(...q.map(a=>[a[0]-.004,a[1],a[2]+.004]));};
  for(let z=z0;z<z1-.1;z+=1.38){
    const end=Math.min(z1,z+1.38);
    glassFace([[x,.84,z+.045],[x,.84,end-.045],[x,2.56,end-.045],[x,2.56,z+.045]]);
    box(b,[x-.055,.78,z-.04,x+.055,2.67,z+.04]);
  }
  for(const y of [.79,2.6])box(b,[x-.065,y,z0,x+.065,y+.065,z1]);
  glassFace([[x+.06,.84,z0],[8.67,.84,z0],[8.67,2.56,z0],[x+.06,2.56,z0]]);
  for(const y of [.79,2.6])box(b,[x,y,z0-.055,8.75,y+.065,z0+.055]);
  for(const xx of [7.25,8.72])box(b,[xx-.035,.8,z0-.05,xx+.035,2.66,z0+.05]);
  addTranslucent(c,pane,{alpha:.13,order:3});
  // A proper desk from the office catalogue; the scene's loose furniture
  // and everything on it keep the ordinary grab/attachment contract.
  const dx=7.08,dz=4.55,rot=Math.PI/2;
  c.prop('desk',dx,dz,{rot,shadow:false});
  c.prop('crt',dx+.14,dz,{rot:-Math.PI/2,y:.65,solid:false,shadow:false});
  c.prop('keyboard',dx-.26,dz,{rot,y:.65,solid:false,shadow:false});
  c.prop('mouse',dx-.26,dz-.34,{rot,y:.65,solid:false,shadow:false});
  c.prop('desklamp',dx+.12,dz+.6,{y:.65,solid:false,shadow:false});
  c.prop('chair',8.05,4.55,{rot:-Math.PI/2,shadow:false});
  c.prop('cabinet',8.25,2.85,{rot:-Math.PI/2,shadow:false});
  c.prop('plant',8.25,5.8,{shadow:false});
  const screen=c.kit.tex.custom('channel:terminal',128,96,g=>{
    g.fillStyle='#101f19';g.fillRect(0,0,128,96);g.fillStyle='#8bb995';
    for(let row=0;row<11;row++)for(let k=0;k<15;k++)if((row*13+k*7)%11<7)g.fillRect(7+k*7,7+row*7,4,2);
    g.fillRect(9,86,7,3);
  });
  c.board(c.shining('channel:terminal',screen,.8,lin('#a7c6a4')),dx+.14-.204,.65+.3125,dz,.35,.275,-Math.PI/2);
  c.light(dx-.3,1.05,dz+.65,'#ead3a0',.45,{far:3.8,k:1.5});
  // Crooked paper stacks and damp folders stay part of the office.
  for(let i=0;i<4;i++)box(b,[dx-.15+i*.015,.65+i*.014,dz-.67,dx+.2+i*.015,.664+i*.014,dz-.44],lin(i%2?'#c7c5a7':'#d5d0b6'));
  for(let i=0;i<4;i++){
    const zz=2.5+i*.13;box(b,[8.05,1.26,zz,8.39,1.73,zz+.09],lin(i%2?'#85738b':'#b7b5a1'));
    box(b,[8.03,1.33,zz+.02,8.05,1.45,zz+.065],cream);
  }
  // Pool rings left where a visitor's chair would normally stand.
  for(let i=0;i<2;i++)c.model('channel:office-ring:'+i,innerTubeVox(i?'#9c83a6':'#d0af4f',false),6.72,6.95,{y:i*.19,scale:1.12,solid:false,shadow:false});
  c.solid(6.21,6.46,7.23,7.44,{keep:true,top:.5});
}

function brokenCeiling(c){
  const b=c.flat,ceiling=c.ceil;
  // A suspended office ceiling has been hung halfway up the hall. Its opening
  // is actual missing geometry, with grid ends and services in the plenum.
  const hole=[1.8,3.85,5.15,7.3];
  cutSlab(ceiling,-4,4.4,3.9,8.9,6.02,.1,hole);
  for(let x=-4;x<4.4;x+=.6)for(const [a,d]of [[3.9,5.15],[7.3,8.9]])box(b,[x-.015,5.985,a,x+.015,6.02,d],steel);
  for(const z of [5.15,7.3])box(b,[1.8,5.965,z-.025,3.85,6.05,z+.025],steel);
  for(const x of [1.8,3.85])box(b,[x-.025,5.965,5.15,x+.025,6.05,7.3],steel);
  for(const z of [5.4,6.85])pipe(b,[1.8,6.38,z],[3.85,6.38,z],.035,rust);
  // A detached panel hangs down beside the hole, rather than a dark decal
  // pretending the tube can pass through an intact roof.
  const panel=new Batch();box(panel,[0,0,0,.85,.055,.61]);
  const broken=c.dynamic(panel,{map:c.kit.tex.ceiling(c.look.ceil)});broken.position.set(1.35,5.93,5.05);broken.rotation.set(.47,0,-.28);
  // The low office roof has a smaller opened maintenance bay.
  box(b,[6.38,3.3,4.68,7.62,3.36,5.92],dark);
  for(const x of [6.55,7.03,7.45])pipe(b,[x,3.14,4.7],[x,3.14,5.9],.025,rust);
  for(const z of [4.7,5.9])box(b,[6.4,2.87,z-.025,7.6,2.95,z+.025],steel);
}

export function collideOfficeAndPool(c,t,p){
  officeEnclosure(c,t);brokenCeiling(c);
  for(const side of [-1,1])for(const y of [3.16,6.36]){
    door(c,side,0,y);door(c,side,5.7,y,{open:side<0});
  }
  door(c,1,-4.2,3.16,{open:true});
  const flumes=buildOverheadFlumes(c,COLLISION_FLUMES);flumes.name='office-collision-flumes';
  const detail=poolDetail(c).batch;
  for(const [x,y,z]of [[-6,4.7,5.7],[-.4,4.1,5.4],[4.5,4.9,-1.6]]){
    pipe(detail,[x,y,z],[x,6,z],.026,steel);
    box(detail,[x-.22,y-.04,z-.18,x+.22,y+.04,z+.18],rust);
  }
  // Stranded files stand on the measured pool floor. They are separated from
  // the clear bank, supply plinth and pump outlet.
  const x=-2.55,z=6.9,y=channelFloor(p,x,z);
  c.prop('cabinet',x,z,{y,rot:.16,shadow:false});
  for(let i=0;i<5;i++)c.lay(c.flat,x+.55+i*.19,z-.2-(i%2)*.3,.19,.26,i*.7,null,lin('#b7b79b'),p.water+.016);
  // Damp carpet is caught under the tiles at the entrance to the office.
  const carpet=c.mapped('channel:carpet-remnant',c.kit.tex.carpet('#827d65'));
  c.lay(carpet,7.8,7.8,1.3,1.8,.04,null,WHITE,.008);
  return {flumes,office:{x:7.3,z:4.6},ceilingHole:{x:2.8,y:6.02,z:6.2}};
}
