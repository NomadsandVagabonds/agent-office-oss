// The Other Changing Room. The bench route is real; the locker corridor folds
// behind an occluded, repeated throat. No flattened navigation or fake portal.
import * as THREE from 'three';
import {showerWater} from './locker-showers/water.js';
import {showerGlaze} from './locker-showers/glaze.js';
import {lockerTunnel} from './locker-showers/locker-tunnel.js';
import {showerFigure} from './locker-showers/figures.js';
import {Batch,lin,WHITE} from '../kit.js';
import {pipe} from '../pool-finish.js';
import {innerTubeVox,buildOverheadFlumes} from '../waterpark.js';
import {face} from './bellmouth/art.js';
import {tiledPlane} from './return-pool/art.js';
import {towelCart} from './return-pool/dressing.js';
import {cutSlab} from './channel-hall/collision-art.js';
import {showerPlan,showerFloor,showerCeiling,showerCuts,foldCrossing} from './locker-showers/plan.js';
import {showerTextures,lockerBank,officeDoor,shower,hangingTowel,wetBenchSegment} from './locker-showers/assets.js';

const steel=lin('#a4aaa3'),dark=lin('#354744'),cream=lin('#d4c7b6'),rust=lin('#845e4b');
const box=(b,q,col=WHITE)=>b.box(...q,col,{step:.8,uv:1.6});

export function build(c){
  const {W,D,H,rt,env}=c,p=showerPlan(c.room),t=showerTextures(c.kit);
  rt.amb=lin('#c8b2b0',.13);rt.level=.96;
  c.shell({floor:false,ceiling:false,panels:false,sockets:false,skirting:false,wallTex:t.pink});
  const pink=c.mapped('showers:pink',t.pink,{wet:.8}),floor=c.mapped('showers:floor',t.floor,{wet:.88});
  const ceiling=c.mapped('showers:ceiling',t.ceiling),wood=c.mapped('showers:walkway',t.wood,{wet:.85});
  const mauve=c.mapped('showers:mauve',t.mauve,{wet:.65}),grime=c.mapped('showers:grime',t.grime,{cutout:true,side:THREE.DoubleSide});
  rt.floorY=(x,z)=>Math.abs(z)>D/2-.9?c.floorAt(x,z):showerFloor(p,x,z);
  rt.headY=(x,z)=>showerCeiling(p,x,z)-rt.floorY(x,z);
  const {xs,zs}=showerCuts(p),water=new Batch();
  // The floor grid includes every edge of the zigzag and all its shallow
  // recovery steps. Slats are short rectangular pieces, never an invisible ramp.
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1],x=(x0+x1)/2,z=(z0+z1)/2,y=showerFloor(p,x,z);
    if(y===p.bench){
      const n=Math.max(1,Math.ceil((z1-z0)/.18));
      for(let k=0;k<n;k++){
        const a=z0+k*(z1-z0)/n,b=z0+(k+1)*(z1-z0)/n;
        box(wood,[x0,y-.075,a+.006,x1,y,b-.006]);
      }
    }else tiledPlane(floor,x0,z0,x1,z1,y);
    if(y<p.water)tiledPlane(water,x0,z0,x1,z1,p.water);
    for(const [nx,nz,a,b]of [[x1+.00001,z,[x1,y,z1],[x1,y,z0]],[x,z1+.00001,[x0,y,z1],[x1,y,z1]]]){
      const other=showerFloor(p,nx,nz);if(Math.abs(other-y)>.001)face(y===p.bench?wood:floor,[[a[0],other,a[2]],[b[0],other,b[2]],b,a]);
    }
  }
  for(const a of p.spans){
    const length=Math.hypot(a.x1-a.x0,a.z1-a.z0),n=Math.max(1,Math.ceil(length/.8));
    for(let i=0;i<=n;i++){
      const x=a.x0+(a.x1-a.x0)*i/n,z=a.z0+(a.z1-a.z0)*i/n;
      for(const side of [-1,1]){
        const px=x+(a.x1===a.x0?side*.52:0),pz=z+(a.z1===a.z0?side*.52:0);
        box(wood,[px-.055,-p.depth,pz-.055,px+.055,p.bench-.075,pz+.055],lin('#9a7662'));
        box(c.flat,[px-.016,p.bench+.002,pz-.018,px+.016,p.bench+.008,pz+.018],steel);
      }
    }
  }
  const waterTex=c.kit.tex.custom('showers:water',128,128,g=>{
    g.fillStyle='#405d59';g.fillRect(0,0,128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const a=Math.sin(x*Math.PI/16+Math.sin(y*Math.PI/32)),b=Math.sin(y*Math.PI/16+Math.sin(x*Math.PI/32));
      const v=Math.pow(Math.max(0,1-Math.abs(a+b)*4),3);
      g.fillStyle=`rgba(203,218,198,${.02+v*.3})`;g.fillRect(x,y,1,1);
    }
  });
  const surface=showerWater(c,water,waterTex);
  const solid=(x0,z0,x1,z1,top=2.6)=>c.solid(x0,z0,x1,z1,{keep:true,top,tall:top>1.8});
  const wall=(x0,z0,x1,z1,y0=0,y1=2.65,color=WHITE)=>{box(pink,[x0,y0,z0,x1,y1,z1],color);if(y0<.3)solid(x0,z0,x1,z1,y1);};

  // Lockers form one wall, but an over-wide locker opening exposes a long
  // cyan service passage behind their normal half-metre depth.
  for(const [z,count,open]of [[8.55,6,1],[1.8,7,4],[-3.1,7,-1],[-8.0,7,2]]){
    const foot=lockerBank(c,{x:4.98,z,count,rot:-Math.PI/2,openIndex:open});
    solid(foot.x0,foot.z0,foot.x1,foot.z1,2.1);
  }
  // Structural partition, interrupted at the actual walk-through locker.
  wall(5.35,-p.end-.3,5.49,4.65,0,2.75);wall(5.35,6.35,5.49,p.end+.3,0,2.75);
  box(mauve,[4.58,2.1,-p.end-.3,5.48,2.75,p.end+.3]);
  box(mauve,[4.57,0,4.57,4.75,2.7,4.69]);box(mauve,[4.57,0,6.31,4.75,2.7,6.43]);
  // A detached locker leaf hangs open into the room; aperture stays clear.
  box(mauve,[4.62,.09,6.38,4.68,2.65,7.18]);solid(4.60,6.38,4.70,7.18,2.65);
  for(const y of [.48,2.1])for(let j=0;j<4;j++)box(c.flat,[4.60,y+j*.08,6.53,4.615,y+j*.08+.026,7.0],dark);
  box(c.flat,[4.57,1.1,7.05,4.62,1.34,7.12],steel);

  // Left shower cells remain recognisably ordinary at walking height. Their
  // second storey is displaced above a corridor too small to contain it.
  for(const [i,z]of [7.8,4.3,-2.9,-6.3].entries()){
    wall(-6.58,z-1.35,-6.43,z+1.35,0,2.68);
    for(const zz of [z-1.35,z+1.35])wall(-6.58,zz-.06,-4.2,zz+.06,0,2.55);
    officeDoor(c,{x:-4.37,z:z+.45,rot:Math.PI/2,open:1.57});
    // The leaf opens into the bay; its jambs and leaf agree with the artwork.
    for(const zz of [z-.10,z+1.0])solid(-4.45,zz-.055,-4.28,zz+.055,2.22);
    solid(-5.39,z+.91,-4.33,z+1.02,2.1);
    const occupied=i===0||i===2;
    const spray=shower(c,{x:-6.39,z:z-.45,rot:Math.PI/2,run:i!==3,occupied});
    if(occupied)showerFigure(c,spray,i/2);
    hangingTowel(c,{x:-4.16,y:1.93,z:z-1.15,rot:Math.PI/2});
    for(const yy of [.10,1.15])c.board(grime,-4.13,yy,z-1.27,.32,.55,Math.PI/2);
  }
  // The service passage behind these cells is entered from the last bay.
  wall(-W/2+.65,-4.8,-6.55,-4.65,0,2.65);
  wall(5.49,-7.55,8.85,-7.4,0,2.65);
  lockerTunnel(c,p,{pink,ceiling,wall,box});

  // Stepped roof presses the sightline down as you approach the distant door.
  const invertedBay = { left: -3.98, right: -.23, front: -2.55, back: -5.94, floor: 4.43 };
  const bayOpening = [invertedBay.left,invertedBay.right,invertedBay.back,invertedBay.front];
  const levels=[[6,p.end+.8,4.8],[2,6,4.45],[-2,2,4.1],[-6,-2,3.7],[-p.end-.8,-6,3.1]];
  for(const [z0,z1,y]of levels){
    if(z1<=z0)continue;
    if(z0===6)cutSlab(ceiling,-4.2,4.6,z0,z1,y,.18,[-3.5,-1.65,7.1,8.65]);
    else if(z0===-6)cutSlab(ceiling,-4.2,4.6,z0,z1,y,.18,bayOpening);
    else box(ceiling,[-4.2,y,z0,4.6,y+.18,z1]);
    box(pink,[-4.2,y,z0-.09,4.6,H,z0+.09]);
    for(let x=-3.8;x<4.5;x+=.6){
      const spans = z0===-6 && x<invertedBay.right ? [[z0,invertedBay.back],[invertedBay.front,z1]] : [[z0,z1]];
      for (const [a,b] of spans) box(c.flat,[x-.012,y-.017,a,x+.012,y,b],steel);
    }
    for(let z=z0+.55;z<z1;z+=.6){
      const spans = z0===-6 && z>invertedBay.back && z<invertedBay.front
        ? [[-4.2,invertedBay.left],[invertedBay.right,4.6]] : [[-4.2,4.6]];
      for (const [a,b] of spans) box(c.flat,[a,y-.016,z,b,y,z+.018],steel);
    }
  }
  box(ceiling,[-W/2,H,-D/2,W/2,H+.12,D/2]);
  for(const side of [-1,1]){
    const x0=side<0?-W/2:5.49,x1=side<0?-6.55:W/2;
    box(ceiling,[x0,2.65,-p.end-.8,x1,2.82,p.end+.8]);
  }
  for(const z of [-D/2,D/2-2.2])box(ceiling,[-W/2,2.65,z,W/2,2.83,z+2.2]);
  // Two upper shower landings, one startlingly ordinary door hanging in the
  // ceiling grid, and a flume forced through a high office window.
  for(const [z,y]of [[7.8,2.85],[3.4,3.2]]){
    box(pink,[-6.55,y-.22,z-1.28,-3.85,y,z+1.28]);
    for(const zz of [z-1.28,z+1.28])box(pink,[-6.55,y,zz-.07,-4.15,y+2.45,zz+.07]);
    officeDoor(c,{x:-6.38,y,z:z+.35,rot:Math.PI/2,open:.5});
    shower(c,{x:-5.9,y,z:z-.65,rot:Math.PI/2,run:true});
    pipe(c.flat,[-3.93,y+.95,z-1.25],[-3.93,y+.95,z+1.25],.026,steel);
    for(const zz of [z-1.2,z,z+1.2])pipe(c.flat,[-3.93,y,zz],[-3.93,y+.95,zz],.025,steel);
  }
  officeDoor(c,{x:1.8,y:4.7,z:8.6,tilt:Math.PI/2,open:.12});
  // Another bay has turned over inside the ceiling. Its fittings keep
  // their own gravity: water rises from the lowest point into its drain.
  const invertedFloor=invertedBay.floor;
  box(pink,[invertedBay.left,invertedFloor,invertedBay.back,invertedBay.right,invertedFloor+.19,invertedBay.front]);
  box(pink,[invertedBay.left,2.19,-5.42,-1.73,invertedFloor,-5.25]);
  box(pink,[-.65,2.19,-5.42,invertedBay.right,invertedFloor,-5.25]);
  // Solid returns and an unlit recess behind the upside-down door.
  box(pink,[-1.74,2.19,invertedBay.back,-.64,2.30,-5.25]);
  for(const x of [-1.74,-.66])box(pink,[x,2.30,invertedBay.back,x+.022,invertedFloor,-5.25],lin('#816e70'));
  box(pink,[-1.74,2.30,invertedBay.back,-.64,invertedFloor,invertedBay.back+.035],lin('#413840'));
  box(pink,[-3.98,2.52,-5.25,-3.77,invertedFloor,-2.55]);
  box(pink,[-.47,3.07,-5.25,-.23,invertedFloor,-2.55]);
  for(const [left,right,bottom] of [[-3.98,-2.92,2.68],[-2.92,-1.67,2.91],[-1.67,-.23,3.14]]){
    box(pink,[left,bottom,-2.67,right,3.72,-2.55]);
  }
  officeDoor(c,{x:-1.19,y:invertedFloor,z:-5.18,roll:Math.PI,open:-.72});
  shower(c,{x:-2.74,y:invertedFloor-.018,z:-5.19,roll:Math.PI});
  const spec={id:'cyan-shower',color:'#5d9d9b',radius:.59,pts:[[-8.8,3.55,7.4],[-6.3,3.55,7.4],[-3.0,3.58,7.5],[-2.3,5.2,7.8],[-4.5,5.65,4.5],[-8.8,5.4,3.5]]};
  buildOverheadFlumes(c,[spec]);
  for(const x of [-3.4,-1.72])box(c.flat,[x-.025,4.76,7.08,x+.025,4.84,8.68],steel);
  for(const z of [7.1,8.65])box(c.flat,[-3.52,4.76,z-.025,-1.63,4.84,z+.025],steel);
  for(const z of [7.4,8.3])pipe(c.flat,[-3.5,5.03,z],[-1.65,5.03,z],.025,rust);

  // Office clerestory windows: blue water is visible above a dry passage.
  const windowTex=c.kit.tex.custom('showers:clerestory',128,64,g=>{
    g.fillStyle='#3a7776';g.fillRect(0,0,128,64);
    for(let i=0;i<150;i++){g.fillStyle=i%5?'#9bc4b87a':'#c5dfc5bb';g.fillRect(i*37%128,i*23%64,1+i%3,1+i%7);}
  });
  const glow=c.shining('showers:windows',windowTex,.7,lin('#9ccac1'));
  for(const z of [8,4,0,-4,-8]){
    box(mauve,[4.68,2.75,z-1.8,4.9,3.62,z+1.8]);
    c.board(glow,4.665,3.18,z,3.48,.68,-Math.PI/2);
    for(const zz of [z-1.8,z,z+1.8])box(c.flat,[4.62,2.75,zz-.035,4.78,3.63,zz+.035],steel);
    for(const y of [2.8,3.58])box(c.flat,[4.62,y,z-1.8,4.78,y+.05,z+1.8],steel);
  }
  // Salt-stained benches and towels: recognisable objects, not arbitrary cubes.
  wetBenchSegment(c,[-4.55,8.8],[-4.55,6.7],{width:.62,y:.46,bottom:-.32});
  solid(-4.86,6.65,-4.24,8.85,.46);
  wetBenchSegment(c,[-4.55,2.3],[-4.55,.8],{width:.62,y:.46,bottom:-.32});
  solid(-4.86,.75,-4.24,2.35,.46);
  c.model('showers:lost-ring',innerTubeVox('#c07b8e'),-4.53,7.6,{y:-.25,scale:.9,solid:false,shadow:false});
  const cartBatch=new Batch(true),cartX=3.25,cartZ=-8.6;
  const cartFoot=c.model('return-pool:towel-cart:0',()=>towelCart(0),cartX,cartZ,{batch:cartBatch,solid:false,shadow:false});
  const cart=c.movable(c.dynamic(cartBatch,{pivot:[cartX,0,cartZ]}),{foot:cartFoot,type:'trolley',label:'Towel cart'});

  // White-pink fluorescents, a warm running shower, and the cold locker throat.
  const lamp=c.shining('showers:fluorescent',c.kit.tex.panel(true),1.75,lin('#ffe0db'));
  const fitting=(x,y,z,color,power=1.3,far=6)=>{
    box(c.flat,[x-.19,y,z-.7,x+.19,y+.09,z+.7],cream);
    if (!power) {
      box(c.flat,[x-.145,y-.014,z-.62,x+.145,y,z+.62],dark);
      return;
    }
    for(const dx of [-.105,.105])c.lay(lamp,x+dx,z,.07,1.26,0,null,WHITE,y-.012,true);
    c.light(x,y-.12,z,color,power,{far,k:7.5,axis:[0,-1,0],floor:.32});
  };
  fitting(.1,4.7,8.9,'#f8cbd0',3.0,7.3);
  fitting(.1,4.35,4.4,'#f8cbd0',1.5,6.4);
  fitting(.1,4,.5,'#efbbc3',2.5,6.5);
  fitting(.1,3.6,-3.8,'#f8cbd0',0);
  fitting(.1,3,-8.4,'#d3e5db',1.65,5.6);
  c.lay(lamp,-2.2,-3.22,1.05,.14,0,null,WHITE,invertedFloor-.022,true);
  c.light(-2.2,4.12,-3.22,'#e79e73',1.6,{far:3.7,k:3.4});
  c.light(-4.6,4.45,7.8,'#efb96f',2.5,{far:5.2,k:5.0});
  c.light(-5.37,1.68,7.75,'#efd9bd',.59,{far:2.7,k:1.2});
  c.light(-5.42,1.64,-3.68,'#c0d3c6',.31,{far:2.5,k:1.2});
  fitting(0,2.5,D/2-1,'#e3d6c6',1.0,4);fitting(0,2.5,-D/2+1,'#e3d6c6',1.0,4);

  const visits=new WeakMap(),runtime={plan:p,folds:0,blocked:0,cart,surface};
  c.zone({x0:-8.8,z0:-7.1,x1:8.8,z1:-4.9,stay(_dt,me){
    const actor=me.world;if(!actor||env.player?.me!==actor||actor.frozen)return;
    for(const fold of p.folds){
      const target=foldCrossing(fold,visits.get(actor),me);if(!target)continue;
      const at=c.toWorld(target.x,target.z),r=env.player.RADIUS||.22;
      const clear=c.world.roomAt(at.x,at.z)===rt&&c.world.free(at.x,at.z,r)&&Math.abs(c.world.floorY(at.x,at.z)-c.world.floorY(actor.x,actor.z))<.05;
      if(clear){
        // Held props travel with their carrier; an already laid bridge cannot
        // be folded out from underneath somebody else.
        const held=env.grip?.held;if(held&&!held.carried){runtime.blocked++;break;}
        held?.translate(at.x-actor.x,at.z-actor.z,0);
        env.player.warp(at.x,at.z,actor.yaw);runtime.folds++;
        visits.set(actor,target);return;
      }
      runtime.blocked++;
    }
    visits.set(actor,{x:me.x,z:me.z});
  },leave(me){if(me.world)visits.delete(me.world);}});

  // Once per approach, three taps come from behind the player in the
  // passage. The emitter is close, but its short reach keeps it out of the pool.
  for (const fold of p.folds) {
    const source = c.toWorld(fold.x, fold.z - fold.dir * .95);
    const near = fold.z - fold.dir * .42, far = fold.z - fold.dir * .62;
    c.zone({ x0: fold.x - fold.half, x1: fold.x + fold.half,
      z0: Math.min(near, far), z1: Math.max(near, far),
      enter(me) {
        if (!me.world?.frozen) env.play?.('knock', source.x, source.z, .65);
      },
    });
  }
  const upsideDownDrain = c.toWorld(-2.74,-4.81);
  let hush = 0;
  c.tick((dt,time,me)=>{
    const wet=me.inside&&showerFloor(p,me.x,me.z)<p.water;
    if(wet&&me.world)me.world.slow=Math.min(me.world.slow??1,.8);
    rt.footstep=wet?'wade':'stone';
    hush -= dt;
    if (me.inside && hush <= 0 && Math.hypot(me.x+2.74,me.z+4.81) < 5.5) {
      hush = .81;
      env.play?.('changingShower', upsideDownDrain.x, upsideDownDrain.z, 2.0);
    }
  });
  rt.showerFold=runtime;
  showerGlaze(c);
}
