// Tall, review-only aquatics hall. The upper galleries are shuttered scenery;
// every playable surface is a single, actor-independent height field.
import {Batch,lin,WHITE} from '../kit.js';
import {bellTextures,face} from './bellmouth/art.js';
import {tiledPlane,waterMesh} from './return-pool/art.js';
import {towelCart} from './return-pool/dressing.js';
import {pipe,poolDetail} from '../pool-finish.js';
import {furnitureClear} from '../furniture-rules.js';
import {channelPlan,channelFloor,channelCuts,channelWet,keeperState,stepKeeper,startPump} from './channel-hall/rule.js';
import {slattedBench,pumpAssembly,officeWindow,keeperRig,laneFloatVox} from './channel-hall/assets.js';
import {collideOfficeAndPool,cutSlab} from './channel-hall/collision-art.js';

export function build(c) {
  const {W,D,H,rt,env}=c,p=channelPlan(c.room),t=bellTextures(c.kit),s=keeperState(p);
  rt.amb=lin('#becabc',.24);rt.level=.83;
  c.shell({floor:false,ceiling:false,panels:false,sockets:false,skirting:false,wallTex:t.tile});
  const tile=c.mapped('channel:ivory',t.tile),green=c.mapped('channel:green',t.green),deck=c.mapped('channel:deck',t.deck);
  const steel=lin('#74867b'),dark=lin('#2d473b'),ivory=lin('#cbcbb2'),red=lin('#875146');
  const box=(b,a,col=WHITE)=>b.box(...a,col,{step:.7,uv:1.6});
  // Distant masonry needs fewer light-sampling subdivisions than the walking
  // surfaces. This changes tessellation, not its silhouette or tile scale.
  const masonry=(b,a,col=WHITE)=>b.box(...a,col,{step:1.4,uv:1.6});
  rt.floorY=(x,z)=>Math.abs(z)>D/2-.9?c.floorAt(x,z):channelFloor(p,x,z);
  rt.headY=(x,z)=>(Math.abs(z)>D/2-3?2.55:Math.abs(x)>5.6?2.9:H)-rt.floorY(x,z);
  // Exact same grid feeds visible treads and the floor query. All banks have
  // 16cm steps; no jump, swimming toggle, teleport or moving floor is required.
  const {xs,zs}=channelCuts(p);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],x=(x0+x1)/2,z=(z0+z1)/2,y=channelFloor(p,x,z);
    tiledPlane(y<-.01?green:deck,x0,z0,x1,z1,y);
    for(const [nx,nz,a,b]of [[x1+.0001,z,[x1,y,z1],[x1,y,z0]],[x,z1+.0001,[x0,y,z1],[x1,y,z1]]]){
      const other=channelFloor(p,nx,nz);if(Math.abs(other-y)>.001)face(green,[[a[0],other,a[2]],[b[0],other,b[2]],b,a]);
    }
  }
  // Water is cut around the dry inspection plinth, rather than drawn through
  // it. The plinth is an optional supply location, not a locked route.
  const h=.95,a=p.island.z-h,b=p.island.z+h;
  const waters=[[-3.3,-p.end+.9,3.3,a],[-3.3,b,3.3,p.end-.9],[-3.3,a,-h,b],[h,a,3.3,b]]
    .map(q=>waterMesh(c,t.water,...q,p.water));
  const tide=c.mapped('channel:tide',t.tide,{cutout:true});
  for(const side of [-1,1]){
    // A gallery arcade: heavy offset pillars, deep soffits, ordinary windows
    // and an absurd repetition of upper shuttered rooms. No painted doors.
    for(const y of [2.9,6.1,9.3].filter(y=>y<H-.5)){
      const x=side*5.7;
      if(side>0&&y===2.9)cutSlab(tile,x,W/2,-D/2+3,D/2-3,y,.26,[6.4,7.6,4.7,5.9]);
      else masonry(tile,[side<0?-W/2:x,y,-D/2+3,side<0?x:W/2,y+.26,D/2-3]);
      masonry(green,[x-.16,y-.2,-D/2+3,x+.16,y+.12,D/2-3]);
      pipe(c.flat,[x,y+1.02,-D/2+3.2],[x,y+1.02,D/2-3.2],.035,steel);
      for(let z=-D/2+3.3;z<D/2-3;z+=1.05)pipe(c.flat,[x,y+.15,z],[x,y+1.02,z],.022,steel);
      for(const z of [-7,-2,3,8]){
        officeWindow(c,c.flat,side*(W/2-.15),z,y+.55,2.3);
      }
    }
    // Full-height piers are built once, rather than once per gallery.
    for(const z of [-7,-2,3,8])masonry(tile,[side*8.68-.19,0,z-.26,side*8.68+.19,H,z+.26]);
    for(const z of [-6,1,7]){
      const x=side*5.65;box(tile,[x-.22,0,z-.32,x+.22,3.1,z+.32]);
      c.solid(x-.22,z-.32,x+.22,z+.32,{keep:true,tall:true});
      // Chunky chamfered corbels, with distinct layers rather than a cube.
      for(let j=0;j<4;j++)box(tile,[x-.24-j*.12,2.3+j*.16,z-.34,x+.24+j*.12,2.46+j*.16,z+.34]);
    }
    for(const z of [-4,4])officeWindow(c,c.flat,side*(W/2-.15),z,.83,2.5);
    c.board(tide,side*3.32,-.46,0,2,.2,side>0?-Math.PI/2:Math.PI/2);
  }
  // Cross-beams land on staggered galleries, apparently joining incompatible
  // storeys. The central void remains open all the way to the tiled roof.
  for(const [z,y]of [[-7,6.1],[.5,9.3],[8.7,6.1]]){
    masonry(tile,[-5.7,y-.28,z-.47,5.7,y,z+.47]);
    masonry(c.flat,[-5.7,y-.3,z-.49,5.7,y-.26,z-.43],dark);
  }
  // A stair joins two sealed upper galleries across the void. It makes the
  // repeated storeys disagree visibly; there is no reachable stair entrance
  // or player floor on it in this single-height-field prototype.
  const stairZ=-2.2,n=20;
  for(let i=0;i<n;i++){
    const x=-5.7+i*11.4/n,y=2.9+(i+1)*.16;
    box(tile,[x,y-.22,stairZ-.7,x+11.4/n,y,stairZ+.7]);
    box(c.flat,[x,y+.005,stairZ-.7,x+.045,y+.025,stairZ+.7],steel);
    for(const side of [-1,1])pipe(c.flat,[x,y,stairZ+side*.66],[x,y+.94,stairZ+side*.66],.02,steel);
  }
  for(const side of [-1,1])pipe(c.flat,[-5.7,4.0,stairZ+side*.66],[5.7,7.04,stairZ+side*.66],.035,steel);
  tiledPlane(c.ceil,-W/2,-D/2,W/2,D/2,H,true);
  for(const side of [-1,1]){
    const z0=side<0?-D/2:D/2-3,z1=side<0?-D/2+3:D/2;
    box(c.ceil,[-W/2,2.55,z0,W/2,2.75,z1]);
  }
  // Sparse, recognisable office furniture anchors scale. Loose chairs retain
  // the office's usual grab behaviour; fixed benches have visible floor bolts.
  slattedBench(c,-7.4,3.3);slattedBench(c,7.4,-3.5);
  c.prop('desk',-7.3,-7.2,{rot:.1,fallback:[1.2,.8,.6]});
  const officeCollision=collideOfficeAndPool(c,t,p);
  const cartX=7.2,cartZ=.4,cartBatch=new Batch(true),foot=c.model('return-pool:towel-cart:0',()=>towelCart(0),cartX,cartZ,{batch:cartBatch,solid:false,shadow:false});
  const cart=c.movable(c.dynamic(cartBatch,{pivot:[cartX,0,cartZ]}),{foot,type:'trolley',label:'Towel cart'});
  // The pump is used from dry ground. A visible submerged outlet provides
  // both the decoy's destination and its sound source.
  const lever=pumpAssembly(c,p.pump.x,p.pump.z);
  pipe(c.flat,[p.pump.x+.9,.7,p.pump.z],[p.pump.x+.9,-.3,p.pump.z],.14,steel);
  pipe(c.flat,[p.pump.x+.9,-.3,p.pump.z],[p.outlet.x,-.7,p.outlet.z],.14,steel);
  const pump=c.use({x:p.pump.x,z:p.pump.z+.75,r:1.2,label:'run circulation pump',when:()=>s.cooldown===0,use:()=>{
    if(!startPump(s))return;const q=c.toWorld(p.outlet.x,p.outlet.z);env.play?.('rattle',q.x,q.z,14);
  }});
  const bubbles=[];for(let i=0;i<3;i++){
    const batch=new Batch();for(let j=0;j<12;j++){
      const a=j*Math.PI/6;box(batch,[Math.cos(a)*.48-.025,0,Math.sin(a)*.48-.025,Math.cos(a)*.48+.025,.025,Math.sin(a)*.48+.025],lin('#c6d0ad'));
    }bubbles.push(c.dynamic(batch));
  }
  // A rack of apparently ordinary lane equipment foreshadows the resident.
  for(let i=0;i<11;i++)c.model('channel:float:'+i%2,()=>laneFloatVox(i%2===0),-7.8+i%3*.32,5.0,{y:.2+Math.floor(i/3)*.24,scale:1.1,rot:i*.7,solid:false,shadow:false});
  for(const z of [4.65,5.45])pipe(c.flat,[-8.05,.12,z],[-6.8,.12,z],.04,steel);
  // Lighting keeps the lowest water dark, with alternate high window bays
  // glowing quietly. Ten overhead sources plus the desk lamp leave room for
  // generated door lamps.
  const lamps=c.shining('channel:lamps',c.kit.tex.panel(true),1.3,lin('#e0dec2'));
  const fitting=(x,y,z,power,far)=>{
    box(c.flat,[x-.17,y,z-.58,x+.17,y+.09,z+.58],steel);c.lay(lamps,x,z,.25,1,0,null,WHITE,y-.008,true);
    c.light(x,y-.13,z,'#d6dfc2',power,{far,k:2.2,axis:[0,-1,0],floor:.18});
  };
  for(const x of [-6.6,6.6])for(const z of [-7,0,7])fitting(x,2.8,z,1.35,6.8);
  for(const z of [-6,5])fitting(-3.9,6,z,2.5,10);
  fitting(0,2.5,D/2-1.3,1.3,5);fitting(0,2.5,-D/2+1.3,1.3,5);
  const detail=poolDetail(c).batch;
  for(const side of [-1,1]){
    for(let z=-p.end;z<p.end;z+=.18)box(detail,[side*4.35-.09,.006,z,side*4.35+.09,.025,z+.055],steel);
    pipe(detail,[side*8.5,2.7,-D/2+3],[side*8.5,2.7,D/2-3],.06,steel);
    for(const z of [-8,-4,0,4,8]){
      box(detail,[side*8.5-.14,2.62,z-.035,side*8.5+.14,2.78,z+.035],dark);
      for(let i=0;i<3;i++)box(detail,[side*8.5-.02,2.6-i*.12,z-.01,side*8.5+.02,2.63-i*.12,z+.02],red);
    }
  }
  const rig=keeperRig(c,p);rig.update(s,0);let known=false,sound=0;
  const clear=(ax,az,bx,bz,r)=>{
    const a=c.toWorld(ax,az),b=c.toWorld(bx,bz);return furnitureClear(c.world,a.x,a.z,b.x,b.z,r);
  };
  c.tick((dt,time,me)=>{
    const wet=me.inside&&channelWet(p,me.x,me.z);
    if(wet&&me.world)me.world.slow=Math.min(me.world.slow??1,.66);
    rt.footstep=wet?'wade':'stone';
    stepKeeper(s,dt,{...me,key:me.world,grounded:!(me.world?.drop>.12)},p,{clear});rig.update(s,time);
    if(!known&&me.inside&&c.seen(s.x,s.z,{height:.35})){known=true;c.met('lane-keeper');}
    if(s.escaped)c.survived('lane-keeper');
    if(s.hit){const hit=c.hurt(1,c.toWorld(s.x,s.z));if(hit.landed)env.interfere?.(.12);}
    if(s.warn){const q=c.toWorld(s.x,s.z);env.play?.('wade',q.x,q.z,12);}
    waters.forEach(w=>{w.phase.value=time*.16;});lever.rotation.x=s.pump>0?-.72:0;
    bubbles.forEach((g,i)=>{g.visible=s.pump>0;const k=.4+((time*.65+i/3)%1);g.scale.set(k,1,k);g.position.set(p.outlet.x,p.water+.018,p.outlet.z);});
    sound-=dt;if(s.pump>0&&sound<=0){sound=.8;const q=c.toWorld(p.outlet.x,p.outlet.z);env.play?.('wade',q.x,q.z,10);}
  });
  rt.channelHall={plan:p,state:s,pump,cart,rig,officeCollision};
}
