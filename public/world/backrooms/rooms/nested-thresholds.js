// A quiet connector: a long sightline, diminishing frames, and a side loop.
// The low frame actually lowers the camera. No trap, resident or forced event.
import {lin,WHITE} from '../kit.js';
import {bellTextures} from './bellmouth/art.js';
import {tiledPlane,waterMesh} from './return-pool/art.js';
import {slattedBench} from './channel-hall/assets.js';
import {pipe,poolDetail} from '../pool-finish.js';
export function build(c){
  const {W,D,H,rt}=c,t=bellTextures(c.kit),tile=c.mapped('threshold:tile',t.tile),green=c.mapped('threshold:green',t.green);
  const dark=lin('#294b3d'),steel=lin('#819383');
  rt.amb=lin('#c5cebd',.2);rt.level=.85;
  c.shell({floorTex:t.deck,wallTex:t.tile,ceiling:false,panels:false,sockets:false,skirting:false});
  const box=(b,a,col=WHITE)=>b.box(...a,col,{step:.5,uv:1.6});
  const frames=[{z:D/2-4.5,half:1.7,top:2.35},{z:3,half:1.35,top:2.02},{z:-1,half:1.02,top:1.65},{z:-D/2+5,half:.86,top:.86}];
  // One visible side passage wraps the narrow sequence and rejoins both ends.
  // No renderer portal: apparent depth comes entirely from real proportions.
  for(const x of [-2.55,2.55]){
    box(tile,[x-.09,0,-D/2+3,x+.09,H,D/2-3]);
    c.solid(x-.09,-D/2+3,x+.09,D/2-3,{keep:true,tall:true});
    box(green,[x-.1,0,-D/2+3,x+.1,.22,D/2-3]);
  }
  for(const f of frames){
    for(const side of [-1,1]){
      const a=side<0?-2.5:f.half,b=side<0?-f.half:2.5;
      box(tile,[a,0,f.z-.28,b,2.7,f.z+.28]);c.solid(a,f.z-.28,b,f.z+.28,{keep:true,tall:true});
      box(c.flat,[side*f.half-.035,0,f.z-.31,side*f.half+.035,f.top,f.z+.31],dark);
    }
    box(tile,[-f.half,f.top,f.z-.28,f.half,2.75,f.z+.28]);
    box(c.flat,[-f.half-.04,f.top-.035,f.z-.31,f.half+.04,f.top+.035,f.z+.31],dark);
    // Hooks always have the same dimensions, even where the frame shrinks.
    for(const side of [-1,1])pipe(c.flat,[side*(f.half+.26),1.28,f.z+.29],[side*(f.half+.26),1.28,f.z+.38],.018,steel);
  }
  tiledPlane(c.ceil,-W/2,-D/2,W/2,D/2,2.7,true);
  rt.headY=(x,z)=>{
    let y=2.7;
    for(const f of frames)if(Math.abs(z-f.z)<.48&&Math.abs(x)<f.half+.2)y=Math.min(y,f.top);
    return y-c.floorAt(x,z);
  };
  slattedBench(c,-W/2+1.3,0);
  const lamp=c.shining('threshold:lamps',c.kit.tex.panel(true),1.2,lin('#e0e1c5'));
  for(const [x,z]of [[0,D/2-2],[0,-D/2+2],[0,3],[3.65,4],[3.65,-4],[-3.65,-4]]){
    box(c.flat,[x-.17,2.59,z-.55,x+.17,2.68,z+.55],steel);c.lay(lamp,x,z,.25,1,0,null,WHITE,2.58,true);
    c.light(x,2.45,z,'#dbe1c5',1.2,{far:5.5,k:2.3});
  }
  // Thin wet channels and water marks connect this quiet passage to the pools.
  const water=waterMesh(c,t.water,2.75,-D/2+3,2.94,D/2-3,.008);
  const b=poolDetail(c).batch;
  for(let z=-D/2+3;z<D/2-3;z+=.2)box(b,[2.73,.01,z,2.96,.025,z+.035],steel);
  for(const f of frames)box(b,[-f.half-.02,.004,f.z-.3,f.half+.02,.015,f.z-.22],dark);
  c.tick((dt,time)=>{water.phase.value=time*.08;});rt.thresholds={frames};
}
