import * as THREE from 'three';
import { Batch, lin, WHITE } from '../kit.js';
import { pipe } from '../pool-finish.js';
import { tiledPlane } from './return-pool/art.js';
import { buildOverheadFlumes } from '../waterpark.js';
import { showerWater } from './locker-showers/water.js';
import { divePlan, towerSupport, inPool, flightAt, MAZE } from './dive-tower/plan.js';

const steel=lin('#aab7b0'), dark=lin('#35494b'), mustard=lin('#978152');
const box=(batch,bounds,color=WHITE,step=.75)=>batch.box(...bounds,color,{uv:1.6,step});

function towerTile(kit){
  return kit.tex.custom('diving-tower:blue-ceramic',256,256,g=>{
    g.fillStyle='#35474a';g.fillRect(0,0,256,256);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const tone=(x*17+y*29+x*y*7)%5;
      g.fillStyle=['#68868b','#6d8a8d','#779598','#608087','#728e90'][tone];
      g.fillRect(32*x+1,32*y+1,31,31);
      g.fillStyle='#bfd1c748';g.fillRect(32*x+2,32*y+2,29,1);
      g.fillStyle='#233b3c46';g.fillRect(32*x+29,32*y+4,2,26);
      if(tone===0){g.fillStyle='#43594c82';g.fillRect(32*x+2,32*y+14,3,13);}
    }
  });
}

function rail(c, ax,az,bx,bz,y,endY=y){
  for(const h of [.42,.82])pipe(c.flat,[ax,y+h,az],[bx,endY+h,bz],.025,steel,8);
  const posts=Math.ceil(Math.hypot(bx-ax,bz-az)/.82);
  for(let i=0;i<=posts;i++){
    const x=ax+(bx-ax)*i/posts,z=az+(bz-az)*i/posts,base=y+(endY-y)*i/posts;
    pipe(c.flat,[x,base+.015,z],[x,base+.84,z],.024,steel,8);
    box(c.flat,[x-.065,base+.004,z-.065,x+.065,base+.025,z+.065],dark);
  }
}

function architecture(c,p){
  const {W,D,H}=c, left=-W/2,right=W/2,front=D/2,back=-D/2;
  const {pool, deckY, water, bottom}=p;
  const tile=towerTile(c.kit);
  c.shell({floor:false,wallTex:tile,panels:false,sockets:false,skirting:false});
  const wall=c.mapped('tower:wet-wall',tile,{wet:.74});
  const stair=c.mapped('tower:steps',tile,{wet:.24});
  const floor=c.mapped('tower:floor',tile,{wet:.5});
  const railTop=c.shining('tower:lit-lip',c.kit.tex.white(),1.15,lin('#d8b573'));
  const light=c.shining('tower:tubes',c.kit.tex.panel(true),2,lin('#cae4e6'));

  for(const [x0,z0,x1,z1] of [[left,back,left+.12,front],[right-.12,back,right,front],
    [left,front-.12,right,front],[left,back,right,back+.12]]){
    box(wall,[x0,deckY-.04,z0,x1,0,z1],WHITE,1);
    // The bands stand 1.5 cm proud of the wall: flush, they shared its face and fought it (black dashes at every tier).
    for (const y of [-5.24,-10.55]) box(wall,[x0===left?x0:x0-.015,y,z0===back?z0:z0-.015,x1===right?x1:x1+.015,y+.24,z1===front?z1:z1+.015],lin('#57757d'));
  }
  const {x0,x1,z0,z1}=pool;
  for(const [ax,az,bx,bz] of [[left,back,right,z0],[left,z1,right,front],
    [left,z0,x0,z1],[x1,z0,right,z1]]){
    tiledPlane(floor,ax,az,bx,bz,deckY);
  }
  tiledPlane(floor,x0,z0,x1,z1,bottom);
  for (const bounds of [[x0-.14,bottom,z0,x0,deckY,z1],
    [x1,bottom,z0,x1+.14,deckY,z1],[x0,bottom,z0-.14,x1,deckY,z0],
    [x0,bottom,z1,x1,deckY,z1+.14]]){
    box(wall,bounds,lin('#718e99'));
    box(stair,[bounds[0],deckY,bounds[2],bounds[3],deckY+.018,bounds[5]],lin('#a7bdbb'));
  }
  box(wall,[left,-.24,p.platforms[0].nose,right,0,front]);
  for (const landing of p.landings) {
    box(stair,[landing.x0,landing.y-.24,landing.z0,landing.x1,landing.y,landing.z1]);
  }
  for(const {x0,x1,z0,z1,y,axis,lip} of [...p.treads,...p.poolSteps]){
    box(stair,[x0,y-.25,z0,x1,y,z1],WHITE,1.4);
    const edge=axis==='x'?[lip-.016,y+.004,z0+.07,lip+.016,y+.019,z1-.07]
      :[x0+.07,y+.004,lip-.016,x1-.07,y+.019,lip+.016];
    box(c.flat,edge,dark,1.4);
  }
  // At water level the sign marks the submerged steps and the first return flight.
  for(const x of [-1.63,1.63]) {
    box(wall,[x-.1,deckY,z0-.18,x+.1,deckY+1.96,z0]);
  }
  box(wall,[-1.73,deckY+1.65,z0-.18,1.73,deckY+1.96,z0]);
  const exitLettering=c.kit.tex.custom('tower:pool-exit',128,24,g=>{
    g.fillStyle='#235749';g.fillRect(0,0,128,24);
    g.fillStyle='#c6e6ba';g.font='bold 16px monospace';g.textAlign='center';
    g.fillText('POOL EXIT',64,18);
  });
  c.board(c.shining('tower:exit',exitLettering,1.1),0,deckY+1.80,z0+.011,1.42,.266,0);
  c.lay(railTop,0,z0-.08,2.18,.105,0,null,WHITE,deckY+1.645,true);
  c.light(-.45,deckY+1.26,z0+.3,'#f3cc85',1.65,{far:6,k:3.4});
  c.light(-7.5,deckY/2+1.3,-9.65,'#d8ddd2',1.4,{far:7,k:3.1});
  c.light(-.2,1.8,-11.72,'#e0cfaf',1.25,{far:6,k:3.6});
  rail(c,5.96,-9.8,5.96,p.platforms[0].nose,deckY,0);
  rail(c,0,-7.56,-7.65,-7.56,deckY,deckY/2);
  rail(c,-7.65,-10.40,-.95,-10.40,deckY/2,0);
  // An edge stripe is visible from the corridor. Railings frame the launch
  // and the much broader landing on the far side of each short gap.
  rail(c,left+.17,p.platforms[0].nose+.08,-2.28,p.platforms[0].nose+.08,0);
  rail(c,2.28,p.platforms[0].nose+.08,5.83,p.platforms[0].nose+.08,0);
  for(const board of p.platforms){
    const {x,half,nose,rear,y}=board;
    if(y<0){
      box(wall,[x-half,y-.34,nose,x+half,y,rear]);
      for(const dx of [-.67,.67]){
        box(wall,[x+dx-.13,y-.72,nose+.46,x+dx+.13,y-.33,rear-.34],dark);
        box(c.flat,[x+dx-.10,y-.73,nose+.45,x+dx+.10,y-.68,rear-.34],steel);
      }
      for(const side of [-1,1])rail(c,x+side*(half-.045),nose+.10,x+side*(half-.045),rear-.1,y);
      box(wall,[x-half,y-.28,rear-.06,x+half,y-.035,rear],lin('#506565'));
    }
    box(c.flat,[x-half+.04,y+.004,nose+.03,x+half-.04,y+.027,nose+.18],mustard);
    c.lay(railTop,x,nose+.075,1.65,.042,0,null,WHITE,y+.029);
    c.light(x,y+1.32,nose+.43,'#e9cd91',.63,{far:3.8,k:2});
  }
  // Additional access balconies rise into the wrong ceiling. The far
  // yellow flume terminates over the void, high above the landing pool.
  for(const [y,z] of [[-.38,4.4],[-2.04,1.22],[-3.67,-2.1]]){
    box(wall,[left,y-.29,z-1.42,left+2.35,y,z+1.42]);
    rail(c,left+2.28,z-1.39,left+2.28,z+1.39,y);
    box(wall,[left+.09,y-.8,z-.33,left+.92,y-.27,z+.33],lin('#738389'));
  }
  // An office door opens onto a landing with no stairs or diving board.
  const landingY=-.95, ledgeX=3.72, ledgeZ=back+1.45;
  box(wall,[ledgeX-1.02,landingY-.29,back,ledgeX+1.02,landingY,ledgeZ]);
  box(wall,[ledgeX-.37,landingY-.84,back,ledgeX+.37,landingY-.29,back+.77],dark);
  rail(c,ledgeX-1,ledgeZ-.02,ledgeX+1,ledgeZ-.02,landingY);
  box(c.flat,[ledgeX-.53,landingY,back+.12,ledgeX+.53,landingY+2.12,back+.18],lin('#5e4336'));
  box(c.flat,[ledgeX-.445,landingY+.045,back+.18,ledgeX+.445,landingY+2.02,back+.25],lin('#927a64'));
  box(c.flat,[ledgeX-.24,landingY+1.39,back+.25,ledgeX+.24,landingY+1.83,back+.26],dark);
  box(c.flat,[ledgeX-.38,landingY+.91,back+.25,ledgeX-.19,landingY+.97,back+.30],steel);
  c.lay(railTop,ledgeX,back+.29,1.17,.07,0,null,WHITE,landingY+2.24,true);
  c.light(ledgeX,landingY+1.98,back+.73,'#f3bd79',1.2,{far:4.3,k:2.6});
  const flume={id:'tower:yellow-flume',color:'#bea254',radius:.49,
    pts:[[right-.06,2.75,5.05],[6,2.67,4.5],[4.1,2.21,3.9],[2.75,1.71,3.05],[1.64,.97,2.06]]};
  buildOverheadFlumes(c,[flume]);
  for(const [x,z] of [[5.2,4.25],[3.2,3.2]])pipe(c.flat,[x,2.7,z],[x,H,z],.038,steel);
  for(const [x,z] of [[0,9],[0,4],[4.8,-2.0],[-4.85,-4.55]]){
    box(c.flat,[x-.21,H-.13,z-.79,x+.21,H,z+.79],dark);
    c.lay(light,x,z,.25,1.36,0,null,WHITE,H-.134,true);
    c.light(x,H-.22,z,'#c3dce1',1.85,{far:11,k:12,axis:[0,-1,0],floor:.38});
  }
  for(const [x,z] of [[-6.52,-4.55],[3.5,-6.7]]){
    c.light(x,water-.32,z,'#75d6dd',1.8,{far:7,k:4.4});
    box(wall,[x-.34,bottom,z-.34,x+.34,bottom+.52,z+.34],lin('#617f7d'));
    c.lay(light,x,z,.39,.38,0,null,WHITE,bottom+.524);
  }
  c.light(4.55,water+2.7,-3.45,'#85c7d5',1.75,{far:7.4,k:5.8,axis:[0,-1,0],floor:.36});
  const ladderX=x1-.11;
  for(const z of [-3.58,-2.84])pipe(c.flat,[ladderX,bottom+.72,z],[ladderX,deckY+1.09,z],.026,steel,8);
  for(let i=0;i<10;i++)pipe(c.flat,[ladderX,bottom+.83+i*.268,-3.58],[ladderX,bottom+.83+i*.268,-2.84],.022,steel,8);

  const basin=new Batch();
  tiledPlane(basin,x0,z0,x1,z1,water);
  const ripple=c.kit.tex.custom('tower:water',128,128,g=>{
    g.fillStyle='#246572';g.fillRect(0,0,128,128);
    for(let z=0;z<128;z++)for(let x=0;x<128;x++){
      const a=Math.sin(x*Math.PI/16+1.5*Math.sin(z*Math.PI/32));
      const b=Math.sin(z*Math.PI/16+1.3*Math.sin(x*Math.PI/32));
      g.fillStyle=`rgba(144,220,220,${.02+.39*Math.max(0,1-Math.abs(a+b)*5)**3})`;
      g.fillRect(x,z,1,1);
    }
  });
  showerWater(c,basin,ripple);
}

export function build(c){
  const plan=divePlan(c.room),{rt,env}=c;
  rt.amb=lin('#8faeb1',.24);
  rt.floorY=(x,z)=>towerSupport(plan,x,z);
  rt.headY=(x,z)=>c.H-rt.floorY(x,z);
  architecture(c,plan);
  const lead=rt.def.doors.map(d=>c.world.rooms[d.to]).find(r=>r?.def.arch===MAZE);
  const chase=lead?.smilerChase;
  chase?.addTower(c,plan);
  const rides=new WeakMap(), riding=chase?.riding??new WeakSet();
  rt.diving={plan,chase,getRide:actor=>rides.get(actor)};
  const rippleGeometry=c.kit.own(new THREE.RingGeometry(.28,.42,36).rotateX(-Math.PI/2));
  const rippleMaterial=c.kit.own(new THREE.MeshBasicMaterial({
    color:0xd6faff,transparent:true,depthWrite:false,opacity:0,
  }));
  const ripple=new THREE.Mesh(rippleGeometry,rippleMaterial);
  ripple.visible=false;ripple.renderOrder=5;c.add(ripple);
  let rippleAge=Infinity;
  const veil=new THREE.Mesh(c.kit.own(new THREE.BoxGeometry(.42,.42,.42)),
    c.kit.own(new THREE.MeshBasicMaterial({
      color:0x0d6178,transparent:true,opacity:.38,depthTest:false,depthWrite:false,side:THREE.BackSide,
    })));
  veil.visible=false;veil.renderOrder=999;c.add(veil);

  const place=(p,yaw,pitch,player)=>{
    const xy=c.toWorld(p.x,p.z);
    player.setRidePose({...xy,y:(c.room.y||0)+p.y,yaw,pitch});
  };
  c.zone({x0:-c.W/2,x1:c.W/2,z0:-c.D/2,z1:c.D/2,stay(dt,me){
    const actor=me.world, player=env.player;
    if(player?.me!==actor || actor.frozen)return;
    const ride=rides.get(actor);
    if(ride){
      ride.time+=dt;
      const {hop,yaw,pitch}=ride;
      const u=Math.min(1,ride.time/hop.seconds);
      let p=flightAt(ride.from,ride.to,u,hop.plunge);
      let tilt=hop.plunge ? Math.max(-1.22,pitch-Math.sin(u*Math.PI)*.85) : pitch;
      if(hop.plunge && p.y<=plan.water && !ride.splash){
        ride.splash=true;
        const at=c.toWorld(hop.x,hop.z);
        env.play?.('towerSplash',at.x,at.z,9);
        env.interfere?.(.42);
        ripple.position.set(hop.x,plan.water+.014,hop.z);
        rippleAge=0;
        chase?.escape(actor);
      }
      if(hop.plunge&&u>=1){
        const rise=Math.min(1,(ride.time-hop.seconds)/.68);
        p={...p,y:ride.to.y+(hop.y+player.EYE-ride.to.y)*rise};
        tilt=pitch*(.45+.55*rise);
      }
      place(p,yaw,tilt,player);
      if(u>=1&&(!hop.plunge||ride.time>=hop.seconds+.68)){
        const at=c.toWorld(hop.x,hop.z);
        player.setRidePose(null);
        player.warp(at.x,at.z,yaw);
        riding.delete(actor);rides.delete(actor);
      }
      return;
    }
    chase?.catchVisitor(c,me);
    const ahead=c.toLocal(actor.x+actor.wishX,actor.z+actor.wishZ);
    if(ahead.z>=me.z-.12)return;
    const hop=plan.flights.find(({from})=>me.z>=from.nose-.015&&me.z<=from.nose+.36
      && Math.abs(me.x-from.x)<from.half-.06);
    if(!hop)return;
    if(env.grip?.held)env.grip.release();
    const from={x:me.x,z:me.z,y:actor.y-(c.room.y||0)};
    const to={x:hop.x,z:hop.z,y:hop.plunge?plan.water-.94:hop.y+player.EYE};
    riding.add(actor);
    rides.set(actor,{from,to,hop,time:0,yaw:actor.yaw,pitch:actor.pitch,splash:false});
    place(from,actor.yaw,actor.pitch,player);
  }});
  c.tick((dt,_time,me)=>{
    rippleAge+=dt;
    ripple.visible=rippleAge<1.08;
    if(ripple.visible){
      ripple.scale.setScalar(1+rippleAge*6);
      rippleMaterial.opacity=.72*(1-rippleAge/1.08);
    }
    const eye=me.world.y-(c.room.y||0);
    veil.visible=me.inside&&eye<plan.water&&inPool(plan,me.x,me.z);
    if(veil.visible)veil.position.set(me.x,eye,me.z);
    const wet=me.inside&&inPool(plan,me.x,me.z)&&!riding.has(me.world);
    rt.footstep=wet?'wade':'stone';
    if(wet){
      me.world.slow=Math.min(me.world.slow??1,.68);
      chase?.escape(me.world);
    }
  });
}
