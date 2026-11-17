import { Batch, lin, WHITE } from '../kit.js';
import { pipe } from '../pool-finish.js';
import { tiledPlane } from './return-pool/art.js';
import { collisionFlumeVox, FLUME_CELL } from './channel-hall/collision-art.js';
import { showerWater } from './locker-showers/water.js';
import { divePlan, towerFloor, inPool, flightAt, MAZE } from './dive-tower/plan.js';

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

function rail(c, ax,az,bx,bz,y){
  for(const h of [.42,.82])pipe(c.flat,[ax,y+h,az],[bx,y+h,bz],.025,steel,8);
  const posts=Math.ceil(Math.hypot(bx-ax,bz-az)/.82);
  for(let i=0;i<=posts;i++){
    const x=ax+(bx-ax)*i/posts,z=az+(bz-az)*i/posts;
    pipe(c.flat,[x,y+.015,z],[x,y+.84,z],.024,steel,8);
    box(c.flat,[x-.065,y+.004,z-.065,x+.065,y+.025,z+.065],dark);
  }
}

function architecture(c,p){
  const {W,D,H}=c, left=-W/2,right=W/2,front=D/2,back=-D/2;
  const tile=towerTile(c.kit);
  c.shell({floor:false,wallTex:tile,panels:false,sockets:false,skirting:false});
  const wall=c.mapped('tower:wet-wall',tile,{wet:.74});
  const stair=c.mapped('tower:steps',tile,{wet:.24});
  const floor=c.mapped('tower:floor',tile,{wet:.5});
  const railTop=c.shining('tower:lit-lip',c.kit.tex.white(),1.15,lin('#d8b573'));
  const light=c.shining('tower:tubes',c.kit.tex.panel(true),2,lin('#cae4e6'));

  for(const [x0,z0,x1,z1] of [[left,back,left+.12,front],[right-.12,back,right,front],
    [left,front-.12,right,front],[left,back,right,back+.12]]){
    box(wall,[x0,p.bottom-.04,z0,x1,0,z1],WHITE,1);
    box(wall,[x0,-5.26,z0,x1,-4.96,z1],lin('#57757d'));
  }
  tiledPlane(floor,left,back,right,front,p.bottom);
  box(wall,[left,-.24,p.platforms[0].nose,right,0,front]);
  const {rim}=p;
  box(stair,[rim.x0,-.22,rim.z0,rim.x1,0,rim.z1]);
  for(const [index,tread] of p.treads.entries()){
    const {x0,x1,z0,z1,y}=tread;
    box(stair,[x0,p.bottom-.06,z0,x1,y,z1],index%37%4===0? lin('#adb4a8'):WHITE,1.4);
    const lip=index<37?z0:z1;
    box(c.flat,[x0+.07,y+.004,lip-.014,x1-.07,y+.02,lip+.014],dark,1.4);
  }
  // Hide the return stair behind tiled wings. From the boards all you
  // see below is a lit low opening above the water.
  for(const [x0,x1] of [[-1.74,-1.48],[1.48,1.74]]){
    box(wall,[x0,p.bottom,-D/2+1.65,x1,1.1,-4.90],lin('#7d9b9e'),1);
    c.solid(x0,-D/2+1.65,x1,-4.9,{keep:true,tall:true});
  }
  box(wall,[-1.48,p.bottom+1.61,-5.04,1.48,p.bottom+1.94,-4.9]);
  const exitLettering=c.kit.tex.custom('tower:pool-exit',128,24,g=>{
    g.fillStyle='#235749';g.fillRect(0,0,128,24);
    g.fillStyle='#c6e6ba';g.font='bold 16px monospace';g.textAlign='center';
    g.fillText('POOL EXIT',64,18);
  });
  c.board(c.shining('tower:exit',exitLettering,1.1),0,p.bottom+1.78,-4.889,1.42,.266,0);
  c.lay(railTop,0,-4.92,2.18,.105,0,null,WHITE,p.bottom+1.605,true);
  c.light(-.6,p.bottom+1.26,-4.60,'#f3cc85',1.65,{far:5.8,k:3.2});
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
  const flume={color:'#bea254',radius:.49,
    pts:[[right-.06,2.75,5.05],[6,2.67,4.5],[4.1,2.21,3.9],[2.75,1.71,3.05],[1.64,.97,2.06]]};
  c.model('tower:yellow-flume',()=>collisionFlumeVox(flume),0,0,{scale:FLUME_CELL/.025,solid:false,shadow:false});
  for(const [x,z] of [[5.2,4.25],[3.2,3.2]])pipe(c.flat,[x,2.7,z],[x,H,z],.038,steel);
  for(const [x,z] of [[0,9],[0,4],[4.8,-2.0],[-4.85,-4.55]]){
    box(c.flat,[x-.21,H-.13,z-.79,x+.21,H,z+.79],dark);
    c.lay(light,x,z,.25,1.36,0,null,WHITE,H-.134,true);
    c.light(x,H-.22,z,'#c3dce1',1.85,{far:11,k:12,axis:[0,-1,0],floor:.38});
  }
  for(const [x,z] of [[-5.9,-4.55],[3.5,-6.7]]){
    c.light(x,p.bottom+.92,z,'#7fc8c5',1.3,{far:5.2,k:2.25});
    box(wall,[x-.34,p.bottom,z-.34,x+.34,p.bottom+.52,z+.34],lin('#617f7d'));
    c.lay(light,x,z,.39,.38,0,null,WHITE,p.bottom+.524);
  }
  const ladderX=right-.17;
  for(const z of [-2.35,-1.61])pipe(c.flat,[ladderX,p.bottom+.22,z],[ladderX,p.bottom+3.15,z],.026,steel,8);
  for(let i=0;i<10;i++)pipe(c.flat,[ladderX,p.bottom+.29+i*.268,-2.35],[ladderX,p.bottom+.29+i*.268,-1.61],.022,steel,8);

  const basin=new Batch(), q=p.pool;
  tiledPlane(basin,q.x0,q.z0,-1.74,q.z1,p.water);
  tiledPlane(basin,1.74,q.z0,q.x1,q.z1,p.water);
  tiledPlane(basin,-1.74,-4.90,1.74,q.z1,p.water);
  const ripple=c.kit.tex.custom('tower:water',128,128,g=>{
    g.fillStyle='#294845';g.fillRect(0,0,128,128);
    for(let z=0;z<128;z++)for(let x=0;x<128;x++){
      const a=Math.sin(x*Math.PI/16+1.5*Math.sin(z*Math.PI/32));
      const b=Math.sin(z*Math.PI/16+1.3*Math.sin(x*Math.PI/32));
      g.fillStyle=`rgba(124,190,174,${.02+.22*Math.max(0,1-Math.abs(a+b)*5)**3})`;
      g.fillRect(x,z,1,1);
    }
  });
  showerWater(c,basin,ripple);
}

export function build(c){
  const plan=divePlan(c.room),{rt,env}=c;
  rt.amb=lin('#8faeb1',.24);
  rt.floorY=(x,z)=>towerFloor(plan,x,z);
  rt.headY=(x,z)=>c.H-rt.floorY(x,z);
  architecture(c,plan);
  const lead=rt.def.doors.map(d=>c.world.rooms[d.to]).find(r=>r?.def.arch===MAZE);
  const chase=lead?.smilerChase;
  chase?.addTower(c,plan);
  const rides=new WeakMap(), riding=chase?.riding??new WeakSet();
  rt.diving={plan,chase,getRide:actor=>rides.get(actor)};

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
      let tilt=pitch-(hop.plunge?Math.sin(u*Math.PI)*.27:0);
      if(hop.plunge&&u>=1){
        if(!ride.splash){
          ride.splash=true;
          const at=c.toWorld(hop.x,hop.z);
          env.play?.('towerSplash',at.x,at.z,9);
          env.interfere?.(.42);
          chase?.escape(actor);
        }
        const rise=Math.min(1,(ride.time-hop.seconds)/.46);
        p={...p,y:plan.water-.22+(hop.y+player.EYE-plan.water+.22)*rise};
        tilt=pitch*(.45+.55*rise);
      }
      place(p,yaw,tilt,player);
      if(u>=1&&(!hop.plunge||ride.time>=hop.seconds+.46)){
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
    const to={x:hop.x,z:hop.z,y:hop.plunge?plan.water-.22:hop.y+player.EYE};
    riding.add(actor);
    rides.set(actor,{from,to,hop,time:0,yaw:actor.yaw,pitch:actor.pitch,splash:false});
    place(from,actor.yaw,actor.pitch,player);
  }});
  c.tick((_dt,_time,me)=>{
    const wet=me.inside&&inPool(plan,me.x,me.z)&&!riding.has(me.world);
    rt.footstep=wet?'wade':'stone';
    if(wet){
      me.world.slow=Math.min(me.world.slow??1,.68);
      chase?.escape(me.world);
    }
  });
}
