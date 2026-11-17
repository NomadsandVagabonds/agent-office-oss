// An empty, reversible connector. Giant changing partitions hang over shallow
// channels; repeated ordinary furniture is the player's unreliable landmark.
import {finishPoolRoom} from '../pool-finish.js';
import {Batch,lin,WHITE} from '../kit.js';
import {changingPlan,changingFloor,changingCeiling,slabBottom} from './hanging-changing/plan.js';
import {bellTextures,face} from './bellmouth/art.js';
import {tiledPlane,waterMesh} from './return-pool/art.js';
import {towelCart} from './return-pool/dressing.js';

export function build(c) {
  const {W,D,H,rt}=c,p=changingPlan(c.room),t=bellTextures(c.kit);
  rt.amb=lin('#c8cfba',.22);rt.level=.92;
  const tile=c.mapped('changing:ivory',t.tile),green=c.mapped('changing:green',t.green),deck=c.mapped('changing:mosaic',t.deck);
  const tide=c.mapped('changing:tide',t.tide,{cutout:true});
  const steel=lin('#7c8c80'),dark=lin('#273f38'),cream=lin('#d1cdb2'),wood=lin('#8e7650');
  const box=(b,x0,y0,z0,x1,y1,z1,col=WHITE)=>b.box(x0,y0,z0,x1,y1,z1,col,{step:.5,uv:1.6});
  c.shell({floor:false,ceiling:false,panels:false,sockets:false,skirting:false,wallTex:t.tile});
  rt.floorY=(x,z)=>Math.abs(z)>D/2-1?c.floorAt(x,z):changingFloor(p,x,z);
  rt.headY=(x,z)=>changingCeiling(p,x,z)-rt.floorY(x,z);
  // The rendered tread heights are the same values used by navigation. The
  // 16cm risers wrap the channel ends as well, so every wet edge is recoverable.
  for(let i=0;i<p.xs.length-1;i++)for(let j=0;j<p.zs.length-1;j++) {
    const x0=p.xs[i],x1=p.xs[i+1],z0=p.zs[j],z1=p.zs[j+1],x=(x0+x1)/2,z=(z0+z1)/2,y=changingFloor(p,x,z);
    tiledPlane(y<0?green:deck,x0,z0,x1,z1,y);
    for(const [nx,nz,a,b] of [[x1+.001,z,[x1,y,z1],[x1,y,z0]],[x,z1+.001,[x0,y,z1],[x1,y,z1]]]) {
      const other=changingFloor(p,nx,nz);
      if(Math.abs(other-y)>.01) {
        const q=[a,b,[b[0],other,b[2]],[a[0],other,a[2]]];
        face(green,q.reverse());
      }
    }
  }
  const water=[];
  const lamp=c.shining('changing:lamps',c.kit.tex.panel(true),1.15,lin('#e6e4bf'));
  const fitting=(x,z,y,power=1.2)=>{
    box(c.flat,x-.16,y,z-.58,x+.16,y+.09,z+.58,steel);
    c.lay(lamp,x,z,.23,1.04,0,null,WHITE,y-.008,true);
    c.light(x,y-.15,z,'#d9dfc4',power,{far:8,k:5,axis:[0,-1,0],floor:.18});
  };
  // Ceiling panels stop at the channels. Above them, narrow tiled light wells
  // reveal that one wall keeps going through the nominal ceiling.
  let previous=-D/2;
  for(const s of [...p.slabs].reverse()) {
    tiledPlane(c.ceil,-W/2,previous,W/2,s.z-1.15,H,true);
    for(const side of [-1,1])box(tile,-W/2,H,s.z+side*1.15-.06,W/2,H+2.8,s.z+side*1.15+.06);
    tiledPlane(tile,-W/2,s.z-1.15,W/2,s.z+1.15,H+2.8,true);
    fitting(s.liftSide*(W/2-2),s.z,H+2.55,2.6);
    previous=s.z+1.15;
  }
  tiledPlane(c.ceil,-W/2,previous,W/2,D/2,H,true);
  for(const side of [-1,1]) {
    const a=side<0?-D/2:D/2-2.8,b=side<0?-D/2+2.8:D/2;
    box(c.ceil,-W/2,2.65,a,W/2,2.8,b);
    fitting(0,side*(D/2-1.4),2.6,1.1);
  }
  for(const [i,s] of p.slabs.entries()) {
    // A low continuous slot, interrupted by a clearly larger crouch passage.
    // Keep colliders OUT of that passage: a 2D solid cannot represent its lid.
    const cuts=[s.x0,s.slot-1.25,s.slot+1.25,s.liftSide>0?s.x1-2.4:s.x0+2.4,s.x1].sort((a,b)=>a-b);
    for(let j=0;j<cuts.length-1;j++) {
      const x0=cuts[j],x1=cuts[j+1],bottom=slabBottom(s,(x0+x1)/2),trim=bottom>2?3.15:1.7;
      box(tile,x0,trim,s.z-.8,x1,s.top,s.z+.8);
      box(green,x0,bottom,s.z-.8,x1,trim,s.z+.8);
      if(bottom<.2)c.solid(x0,s.z-.8,x1,s.z+.8,{keep:true,tall:true});
    }
    // Bottle-green glaze wraps the exposed underside; a thin tile course
    // catches the light at its impossible hovering edge.
    for(let j=0;j<cuts.length-1;j++) {
      const bottom=slabBottom(s,(cuts[j]+cuts[j+1])/2);
      box(green,cuts[j],bottom,s.z-.81,cuts[j+1],bottom+.06,s.z+.81);
    }
    water.push(waterMesh(c,t.water,s.x0+.34,s.z-1.31,s.x1-.34,s.z+1.31,p.water));
    for(const side of [-1,1]) {
      const z=s.z+side*.807,rot=side<0?Math.PI:0;
      for(let j=0;j<cuts.length-1;j++)if(slabBottom(s,(cuts[j]+cuts[j+1])/2)<.2)
        c.board(tide,(cuts[j]+cuts[j+1])/2,.18,z,cuts[j+1]-cuts[j],.16,rot);
      // Sparse repair patches, not noise painted over every surface.
      box(green,s.slot+1.5,1.8,z-.004,s.slot+2.1,2.4,z+.004,lin('#b2bca4'));
      for(const x of [s.slot-1.21,s.slot+1.21])box(c.flat,x-.02,.30,z-.012,x+.02,.34,z+.012,steel);
    }
    c.light(s.slot,.49,s.z-.95,'#d6e2bd',.66,{far:3.8,k:1.1});
    const end=i===1?s.x0:s.x1;
    c.light(end+(i===1?-1.6:1.6),2.6,s.z,'#d8dfcb',1.25,{far:7,k:5});
    // A bright sliver from the next bay reveals the underside; it is a local
    // pool of light rather than an emissive water plane.
    if(i===1)c.light(end+1.2,1.8,s.z-.95,'#dbe3c6',.85,{far:4,k:2.4});
  }
  // Ordinary fixed benches: timber slats, cast feet and visible anchor bolts.
  const bench=(x,z)=>{
    for(let i=0;i<4;i++)box(c.flat,x-1.1,.43,z-.25+i*.14,x+1.1,.49,z-.14+i*.14,wood);
    for(const dx of [-.85,.85]) {
      box(c.flat,x+dx-.04,.03,z-.16,x+dx+.04,.43,z+.16,steel);
      box(c.flat,x+dx-.14,.005,z-.22,x+dx+.14,.035,z+.22,steel);
      for(const dz of [-.18,.18])box(c.flat,x+dx-.022,.035,z+dz-.022,x+dx+.022,.06,z+dz+.022,dark);
    }
    c.solid(x-1.1,z-.25,x+1.1,z+.31,{keep:true,top:.49});
  };
  const hooks=(x,z,y=1.7)=>{
    box(c.flat,x-1.3,y-.08,z-.03,x+1.3,y+.08,z+.03,cream);
    for(let j=-2;j<=2;j++) {
      box(c.flat,x+j*.48-.025,y-.015,z+.02,x+j*.48+.025,y+.025,z+.14,steel);
      box(c.flat,x+j*.48-.025,y+.015,z+.11,x+j*.48+.025,y+.10,z+.15,steel);
    }
  };
  // Repeated freestanding divider and bench islands make loops, rather than
  // three unrelated gallery views. Both sides are open and wide enough to pass.
  for(const z of [D/2-1.05,3.5,-3.5,-D/2+1.05]) {
    const x=z>0?2.0:-2.0;
    box(tile,x-1.7,0,z-.18,x+1.7,2.35,z+.18);
    box(green,x-1.71,0,z-.19,x+1.71,.62,z+.19);
    c.solid(x-1.71,z-.19,x+1.71,z+.19,{keep:true,tall:true});
    hooks(x,z+.23);bench(x,z+.84);
    if(Math.abs(z)<D/2-2)fitting(x-2.7,z+.7,3.45,.9);
    // The low fitting really hangs from a stem instead of levitating itself.
    if(Math.abs(z)<D/2-2)box(c.flat,x-2.72,3.54,z+.68,x-2.68,H,z+.72,steel);
  }
  // Teal enamel lockers retain normal dimensions. Identical small dents and
  // the same half-open door recur on opposite sides of the changing maze.
  for(const [x,z,side] of [[-W/2+.32,9.9,1],[W/2-.32,-3.6,-1],[-W/2+.32,-10.0,1]]) {
    for(let j=0;j<4;j++) {
      const zz=z+(j-1.5)*.5,front=x+side*.29;
      box(c.flat,x-.29,0,zz-.235,x+.29,1.92,zz+.235,dark);
      box(c.flat,front-.018,.06,zz-.22,front+.018,1.88,zz+.22,lin(j===2?'#557e73':'#73968b'));
      for(let k=0;k<4;k++)box(c.flat,front+side*.021-.004,1.6+k*.045,zz-.14,front+side*.021+.004,1.612+k*.045,zz+.14,dark);
      box(c.flat,front+side*.025-.015,.95,zz+.12,front+side*.025+.015,1.10,zz+.15,steel);
      box(c.flat,front+side*.027-.005,1.45,zz-.035,front+side*.027+.005,1.5,zz+.035,cream);
      if(j===2)box(c.flat,Math.min(front,front+side*.3),.06,zz-.22,Math.max(front,front+side*.3),1.88,zz-.19,lin('#557e73'));
    }
    c.solid(x-.35,z-1.02,x+.35,z+1.02,{keep:true,tall:true});
  }
  // A towel and hooks belong to an unreachable changing bay above the water.
  // No floor beneath it, no route marker pretending the bay is a destination.
  const s=p.slabs[1];hooks(-3,s.z+.85,3.1);
  box(c.flat,-3.5,2.2,s.z+.91,-2.98,3.13,s.z+.95,cream);
  box(c.flat,-3.49,2.35,s.z+.952,-2.99,2.43,s.z+.962,lin('#81927b'));
  // Pipes disagree with the wall's thickness. The shower is fixed here, so
  // going around the divider locates its sound rather than moving the source.
  box(c.flat,4.6,1.6,s.z+.84,4.66,3.35,s.z+.90,steel);
  box(c.flat,4.6,3.30,s.z+.84,4.66,3.36,s.z+1.20,steel);
  box(c.flat,4.48,3.25,s.z+1.10,4.78,3.30,s.z+1.30,cream);
  box(c.flat,5.65,.0,s.z-.05,5.71,.86,s.z+.02,steel);
  const spray=new Batch();
  for(let i=0;i<8;i++)for(let j=0;j<3;j++) {
    const x=4.53+j*.075,y=.10+i*.42+j*.025;
    box(spray,x,y,s.z+1.17,x+.012,y+.075,s.z+1.19,lin('#c5d7c5',.8));
  }
  const drops=c.dynamic(spray);
  const batch=new Batch(true),cartX=W/2-1.8,cartZ=D/2-2.3;
  const foot=c.model('return-pool:towel-cart:0',()=>towelCart(0),cartX,cartZ,{batch,solid:false,shadow:false});
  const cart=c.movable(c.dynamic(batch,{pivot:[cartX,0,cartZ]}),{foot,type:'trolley',label:'Towel cart'});
  // Keep authored doorway stairs where a generated neighbour has a raised sill.
  for(const dr of c.room.doors)if(dr.sill>.01) {
    const n=Math.round(dr.sill/.1625),side=dr.side==='front'?1:-1;
    for(let i=0;i<n-1;i++) {
      const z=side*(D/2-i*.28),y=dr.sill-(dr.sill/n)*(i+1);
      box(deck,dr.c-dr.w/2,0,Math.min(z,z-side*.28),dr.c+dr.w/2,y,Math.max(z,z-side*.28));
    }
  }
  const source=c.toWorld(4.6,s.z+1.2);let shower=0;
  rt.footstep='stone';
  c.tick((dt,time,me)=>{
    for(const w of water)w.phase.value=time*.15;
    drops.position.y=-(time*1.9%.42);
    const wet=me.inside&&changingFloor(p,me.x,me.z)<p.water;
    rt.footstep=wet?'wade':'stone';
    if(wet&&me.world)me.world.slow=Math.min(me.world.slow??1,.76);
    shower-=dt;
    if(me.inside&&shower<=0) {shower=.65;c.env.play?.('changingShower',source.x,source.z,8);}
  });
  rt.changing={plan:p,cart};
  finishPoolRoom(c,'hanging-changing');
}
