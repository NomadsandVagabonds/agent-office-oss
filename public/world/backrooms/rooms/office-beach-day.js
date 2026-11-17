import { Batch, lin, WHITE } from '../kit.js';
import { M, Vox } from '../../vox/vox.js';
import { clock, CLOCK_FACE } from '../../props/lounge.js';
import { desklamp } from '../../props/office.js';
import { beachUmbrellaVox, buildFlume, loungerVox } from '../waterpark.js';
import { evalFlume } from '../waterpark.rule.js';
import { poolTextures, tiledPlane } from './return-pool/art.js';
import { showerWater } from './locker-showers/water.js';
import { beachSpill } from './flume-connector/water.js';
import {
  beachPlan, beachFloor, BEACH_FLOOR, BEACH_BED, BEACH_WATER, TUBE_RADIUS,
} from './flume-connector/plan.js';

const CLOCK_X = -1.7, CLOCK_Y = -.56, CLOCK_SCALE = .034;
const CEILING = .10;
const CURB = lin('#788b9a'), DECK = lin('#bcad91');

function clockAtFive() {
  const v = clock(), { x, y } = CLOCK_FACE, ink = M('#282927',0), z = 2.4;
  v.tube(x,y,z,x,y+6.35,z,.48,ink);
  v.tube(x,y,z,x+2.45,y-4.21,z,.64,ink);
  return v;
}

function mural(kit, W) {
  const width = 512, height = 128;
  return kit.tex.custom('beach-day:painted-ocean',width,height,g=>{
    const sunX = Math.round((.5 + CLOCK_X / W) * width);
    const sunY = Math.round((CEILING - CLOCK_Y) / (CEILING - BEACH_FLOOR) * height);
    g.fillStyle='#617888'; g.fillRect(0,0,width,height);
    g.fillStyle='#395f74'; g.fillRect(0,59,width,69);
    g.fillStyle='#34576a'; g.fillRect(0,92,width,36);
    for(const [x,y] of [[29,37],[217,42],[364,31],[441,47]]){
      g.fillStyle='#aeb7ae';g.fillRect(x,y+6,49,4);
      g.fillRect(x+9,y+3,31,4);g.fillRect(x+15,y,18,5);
    }
    for(let i=0;i<12;i++){
      const x=(i*105)%width,y=66+(i*13)%43;
      g.fillStyle=i%3?'#72909a':'#93a7a3';
      g.fillRect(x,y,17+i%4*6,2);g.fillRect(x+5,y-2,8+i%4*6,2);
    }
    g.fillStyle='#a4ad9d';
    for(let x=0;x<width;x+=5){
      const y=99-Math.round(10*Math.sin(x*.028)+5*Math.sin(x*.066));
      g.fillRect(x,y,5,1+(x%3===0));
    }
    // The clock occupies the unpainted middle. The rays are on the wall texture.
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+.07,b=a+.09+(i%3)*.04;
      g.fillStyle=i%2?'#cea053':'#e1b75f';
      g.beginPath();g.moveTo(sunX+Math.cos(a)*18,sunY+Math.sin(a)*18);
      g.lineTo(sunX+Math.cos(b)*(31+(i*3)%9),sunY+Math.sin(b)*(32+(i*7)%8));
      g.lineTo(sunX+Math.cos(a+.21)*18,sunY+Math.sin(a+.21)*18);g.closePath();g.fill();
    }
    for(let i=0;i<140;i++){
      const x=(i*53+29)%width,y=(i*31+17)%height;
      g.fillStyle=i%3?'#44596044':'#dfdbb630';g.fillRect(x,y,1+i%5,1+(i%4===0));
    }
    for(let i=0;i<39;i++){
      const x=(i*81+47)%width;
      g.fillStyle=i%2?'#57645578':'#293f4278';g.fillRect(x,116+(i%5),2+i%4,12);
    }
  },{clamp:true});
}

function towels() {
  const v=new Vox();
  for(const [i,hex] of ['#a58f60','#ddd1af','#c2a980'].entries()){
    v.rbox(-10+i, i*3, -7, 10+i, i*3+3, 7, 1, M(hex,2));
    v.paint(-9+i,i*3,-7,-6+i,i*3+3,7,M('#be9768',2));
  }
  return v;
}

function shagCarpet(kit) {
  return kit.tex.custom('beach:shag', 64, 64, (g, w, h) => {
    g.fillStyle = '#c3a253';
    g.fillRect(0, 0, w, h);
    const tufts = ['#a28443', '#b1924d', '#c8a759', '#d9b969', '#e3c779'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const grain = ((x * 619) ^ (y * 977) ^ (x * y * 131)) >>> 0;
      if (grain % 7 > 2) continue;
      g.fillStyle = '#95783d';
      g.fillRect(x, (y + 1) % h, 1, 1);
      g.fillStyle = tufts[(grain >>> 4) % tufts.length];
      g.fillRect(x, y, 1, 1 + (grain % 3 === 0));
    }
  });
}

function pelicanCutout() {
  const bird = new Vox(), cream = M('#e0d7b6', 1), chalk = M('#f2e7bd', 1);
  const bill = M('#e7a952', 1), pouch = M('#b37242', 1), eye = M('#302a23', 1);
  const wing = M('#8a8b80', 1), cardboard = M('#a27c4f', 2);
  const oval = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  for (let y = 0; y < 22; y++) for (let x = -29; x < 29; x++) {
    const end = Math.abs(x + .5);
    const neckLift = x < 0 ? 1 : 0;
    const headY = 15 + neckLift;
    let ink;
    if (oval(x, y, 0, 6, 17.5, 6)) ink = y < 3 ? cardboard : cream;
    if (oval(x, y, 0, 8, 11.6, 3.5)) ink = y < 7 ? wing : chalk;
    if (oval(end, y, 13, 10 + neckLift, 3.7, 6.5)) ink = cream;
    if (oval(end, y, 15, headY, 5.1, 4.6)) ink = chalk;
    const pouchBottom = headY - 5 + Math.floor(((end - 19) / 4) ** 2);
    if (end >= 17 && end < 28 && y >= pouchBottom && y < headY + 2) {
      ink = y < headY ? pouch : bill;
    }
    if (end > 15 && end < 17.5 && y === headY + 2) ink = eye;
    if (ink) bird.box(x, y, 0, x + 1, y + 1, 1, ink);
  }
  return bird;
}

function hangPelican(c) {
  const x = -2.03, z = 1.40, y = CEILING - .96;
  const pivot = [x, CEILING - .017, z];
  const bird = new Batch(true), string = new Batch();
  c.model('beach:cardboard-pelican', pelicanCutout, x, z, {
    y, scale: [1, 1, .42], solid: false, shadow: false, batch: bird,
  });
  string.box(x - .004, y + .225, z - .004, x + .004, pivot[1], z + .004, lin('#c5b896'));
  c.flat.box(x - .032, pivot[1], z - .026, x + .032, CEILING + .006, z + .026, lin('#ad9364'));
  const hanger = c.dynamic(string, { pivot });
  const cutout = c.dynamic(bird, { pivot });
  hanger.name = 'beach:pelican-mobile';
  hanger.add(cutout);
  cutout.position.set(0, 0, 0);
  c.tick((_dt, time) => {
    hanger.rotation.set(.055 * Math.sin(time * .97), -.44 + .38 * Math.sin(time * .72), .095 * Math.sin(time * 1.23));
  });
}

function sandTrail(c) {
  const atlas = c.kit.tex.custom('beach:sand-trail', 64, 64, g => {
    const shape = (ox, oy, color, points) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(ox + points[0][0], oy + points[0][1]);
      for (const [x, y] of points.slice(1)) g.lineTo(ox + x, oy + y);
      g.closePath();
      g.fill();
    };
    // Bare heel, sole and toes, with enough shag showing through to look damp.
    const wet = '#4d4931';
    shape(0, 0, wet, [[12, 10], [20, 9], [23, 12], [20, 19], [17, 22], [17, 25],
      [14, 29], [9, 28], [8, 24], [11, 19], [10, 15]]);
    g.fillStyle = wet;
    for (const [x, y, w, h] of [[11, 3, 4, 5], [16, 3, 3, 4], [20, 5, 2, 3], [23, 7, 2, 3], [25, 10, 2, 2]]) {
      g.fillRect(x, y, w, h);
    }
    g.fillStyle = '#777047';
    for (const [x, y] of [[14, 12], [19, 11], [15, 16], [11, 24], [13, 27]]) g.fillRect(x, y, 1, 2);

    shape(32, 0, '#673527', [[8, 13], [11, 10], [16, 11], [18, 8], [22, 10], [24, 15],
      [21, 20], [16, 21], [14, 23], [8, 21], [7, 17]]);
    shape(0, 32, '#642d23', [[8, 6], [13, 7], [17, 4], [19, 8], [25, 10], [24, 15],
      [28, 19], [24, 23], [17, 26], [12, 25], [6, 27], [7, 22], [4, 17], [9, 13]]);
    shape(32, 32, '#43312b', [[5, 9], [11, 8], [13, 5], [18, 7], [22, 6], [26, 10],
      [25, 15], [29, 19], [26, 24], [22, 25], [21, 29], [14, 27], [9, 23], [3, 22], [6, 17]]);
    shape(32, 32, '#352a28', [[7, 13], [14, 9], [18, 11], [22, 9], [21, 15], [25, 19],
      [23, 23], [17, 25], [11, 21], [7, 21], [10, 17]]);
    g.fillStyle = '#774131';
    for (const [x, y] of [[55, 6], [40, 24], [60, 22], [8, 36], [24, 38], [9, 60], [60, 57]]) {
      g.fillRect(x, y, 2, 1);
    }
  }, { clamp: true });
  const trail = c.mapped('beach:footprints-on-carpet', atlas, { cutout: true });
  const mark = (tile, x, z, w, d, yaw, mirror = false) => {
    const u = (tile % 2) * .5, v = (.5 - Math.floor(tile / 2) * .5);
    const left = mirror ? u + .5 : u, right = mirror ? u : u + .5;
    c.lay(trail, x, z, w, d, yaw, [[left, v], [right, v], [right, v + .5], [left, v + .5]],
      WHITE, BEACH_FLOOR + .008);
  };
  // Two wet feet, two limping steps with their missing prints, then just a stain.
  mark(0, .20, .76, .23, .34, -.25);
  mark(0, .55, .62, .23, .34, -.43, true);
  mark(0, .54, .21, .23, .34, -.28);
  mark(1, .93, .15, .28, .28, -.41);
  mark(0, .78, -.34, .22, .32, -.37);
  mark(2, 1.17, -.44, .37, .38, -.20);
  mark(3, 1.26, -1.03, .60, .53, -.53);
}

function sheet(batch, rect, gaps, y, down=false) {
  const xs=[...new Set([rect.x0,rect.x1,...gaps.flatMap(q=>[Math.max(rect.x0,q.x0),Math.min(rect.x1,q.x1)])])].sort((a,b)=>a-b);
  const zs=[...new Set([rect.z0,rect.z1,...gaps.flatMap(q=>[Math.max(rect.z0,q.z0),Math.min(rect.z1,q.z1)])])].sort((a,b)=>a-b);
  for(let m=1;m<xs.length;m++)for(let n=1;n<zs.length;n++){
    const x0=xs[m-1],x1=xs[m],z0=zs[n-1],z1=zs[n];
    const x=(x0+x1)*.5,z=(z0+z1)*.5;
    if(x<rect.x0||x>rect.x1||z<rect.z0||z>rect.z1)continue;
    if(!gaps.some(q=>x>q.x0&&x<q.x1&&z>q.z0&&z<q.z1))tiledPlane(batch,x0,z0,x1,z1,y,down);
  }
}

function architecture(c,p) {
  const {H,W}=c,{front,left,right,back,entry,hole,exitStairs,sideStairs,basin}=p;
  const tex=poolTextures(c.kit), box=(b,coords,col=WHITE)=>b.box(...coords,col,{uv:1.6,step:.75});
  const wall=c.mapped('beach:painted-plaster',tex.tile,{wet:.22});
  const carpet=c.mapped('beach:carpet',shagCarpet(c.kit));
  const serviceDeck=c.mapped('beach:service-deck',c.kit.tex.screed('#766e62'));
  const tile=c.mapped('beach:pool-tile',tex.deep,{wet:.67});
  const ceiling=c.mapped('beach:ceiling',c.kit.tex.ceiling(c.look.ceil));
  c.shell({floor:false,ceiling:false,panels:false,skirting:false,sockets:false,wallAlb:lin('#766962')});
  const bounds={x0:left,x1:right,z0:back,z1:front};
  sheet(carpet,bounds,[...basin,entry,exitStairs,sideStairs],BEACH_FLOOR);
  sheet(ceiling,bounds,[entry,hole,exitStairs,sideStairs],CEILING,true);
  tiledPlane(ceiling,left,back,right,front,H,true);
  const stage = { ...entry, z1:front };
  box(serviceDeck,[stage.x0,-.20,stage.z0,stage.x1,0,stage.z1],DECK);
  for(const t of p.treads)box(wall,[t.x0,t.y-.18,t.z0,t.x1,t.y,t.z1],DECK);
  for(const b of [[left-.10,BEACH_FLOOR,back,left,0,front],
    [right,BEACH_FLOOR,back,right+.10,0,front],[left,BEACH_FLOOR,front,right,0,front+.10],
    [left,BEACH_FLOOR,back-.10,right,0,back]])box(wall,b,lin('#737d7a'));
  c.board(c.mapped('beach:wall-mural',mural(c.kit,W)),0,(BEACH_FLOOR+CEILING)/2,back+.013,W,CEILING-BEACH_FLOOR,0);
  c.model('beach:clock-at-five',clockAtFive,CLOCK_X,back+.03,{
    y:CLOCK_Y-CLOCK_FACE.y*CLOCK_SCALE,scale:CLOCK_SCALE/.025,solid:false,shadow:false,
  });

  const water=new Batch();
  for(const [i,q] of basin.entries()){
    tiledPlane(tile,q.x0,q.z0,q.x1,q.z1,BEACH_BED);
    tiledPlane(water,q.x0,q.z0,q.x1,q.z1,BEACH_WATER);
    for(const x of [q.x0,q.x1])box(tile,[x-.047,BEACH_BED,q.z0,x+.047,BEACH_FLOOR+.053,q.z1],CURB);
    if(i===0)box(tile,[q.x0,BEACH_BED,q.z0-.07,q.x1,BEACH_FLOOR+.053,q.z0+.04],CURB);
    if(i===basin.length-1)box(tile,[q.x0,BEACH_BED,q.z1-.04,q.x1,BEACH_FLOOR+.053,q.z1+.07],CURB);
    if(i<basin.length-1){
      const n=basin[i+1];
      for(const [x0,x1] of [[Math.min(q.x0,n.x0),Math.max(q.x0,n.x0)],[Math.min(q.x1,n.x1),Math.max(q.x1,n.x1)]])
        box(tile,[x0,BEACH_BED,q.z1-.05,x1,BEACH_FLOOR+.053,q.z1+.05],CURB);
    }
  }
  showerWater(c,water,tex.water);
  buildFlume(c,'beach:ceiling-feed',p.drop,{radius:TUBE_RADIUS,color:'#b76555',interior:true,alpha:1,steps:20});
  beachSpill(c, p);
  const rim=lin('#687170');
  for(const x of [hole.x0-.025,hole.x1+.025])box(c.flat,[x-.03,CEILING-.075,hole.z0-.03,x+.03,CEILING+.12,hole.z1],rim);
  box(c.flat,[hole.x0,CEILING-.075,hole.z0-.045,hole.x1,CEILING+.12,hole.z0+.03],rim);
  for(const x of [-.74,.73]){
    box(c.flat,[x-.018,CEILING+.18,hole.z0+.2,x+.018,H,hole.z0+.238],rim);
  }

  const tube=c.shining('beach:last-fluorescent',c.kit.tex.panel(true),1.17,lin('#d5ded9'));
  for(const [x,z,lit] of [[-2.74,2.12,true],[2.58,1.35,false],[-2.34,-2.52,false]]){
    box(c.flat,[x-.25,CEILING-.121,z-.74,x+.25,CEILING-.006,z+.74],lin('#545953'));
    if(lit)c.lay(tube,x,z,.34,1.42,0,null,WHITE,CEILING-.126,true);
  }
  c.light(-2.74,CEILING-.24,2.12,'#c9d8dc',1.11,{far:7.3,k:4.2});
  c.light(CLOCK_X,CEILING-.14,back+.68,'#e7c48d',.72,{far:3.6,k:2.1});
  c.light(4.02,BEACH_FLOOR+1.55,-2.75,'#ffc78c',1.58,{far:6.3,k:4.1,axis:[-.46,-.72,.23],floor:.31});
  c.light(1.65,CEILING-.21,.35,'#e4d7af',.77,{far:5.2,k:3.4,axis:[-.19,-.91,.37],floor:.26});
  c.light(left+.22,1.53,.25,'#dfd6ba',1.03,{far:6,k:2.8});
  c.light(.24,.59,front-.7,'#e3ab8c',.58,{far:3,k:1.8});

  c.model('beach:umbrella',beachUmbrellaVox('#c98956'),3.3,-2.82,{
    y:BEACH_FLOOR,scale:1.54,rot:.30,solid:false,shadow:false,
  });
  for(const [i,x,z,rot] of [[0,2.75,-1.95,Math.PI+.32],[1,1.60,-2.39,Math.PI+.10],[2,.60,-2.98,Math.PI-.14]]){
    c.model('beach:lounger:'+i,loungerVox(i===0?'#c6ae90':'#b9b3a6'),x,z,{
      y:BEACH_FLOOR+.005,rot,scale:i===0?1.25:1.14,solid:true,shadow:false,
    });
    c.blot(x,z,.86,1.62,{y:BEACH_FLOOR+.012,a:.41});
  }
  const cabinet=c.prop('cabinet',4.05,-3.0,{y:BEACH_FLOOR,rot:-.21,shadow:false});
  c.model('beach:desklamp',()=>desklamp({color:'#b67958'}),4.02,-2.75,{
    y:cabinet.top-.012,rot:-.84,solid:false,shadow:false,
  });
  c.model('beach:towels',towels,-2.96,-3.20,{y:BEACH_FLOOR,solid:false,shadow:false});
  hangPelican(c);
  c.prop('bin',4.67,-3.58,{y:BEACH_FLOOR,shadow:false});
  sandTrail(c);
}

export function build(c) {
  const p=beachPlan(c.room),{rt,env}=c;
  rt.amb=lin('#b7a995',.12);
  rt.floorY=(x,z)=>beachFloor(p,x,z);
  rt.headY=(x,z)=>{
    const inRect=q=>x>=q.x0&&x<=q.x1&&z>=q.z0&&z<=q.z1;
    return (inRect(p.entry)||inRect(p.exitStairs)||inRect(p.sideStairs)||inRect(p.hole)?c.H:CEILING)-rt.floorY(x,z);
  };
  architecture(c,p);
  const rides=new WeakMap();
  rt.beachDay={plan:p,sunHour:5,ride:body=>rides.get(body)};
  const toWorld=(x,z)=>c.toWorld(x,z);
  const set=(player,x,y,z,pitch,yaw)=>{
    player.setRidePose({...toWorld(x,z),y:c.room.y+y,yaw,pitch});
  };
  const ceilingMouth=evalFlume(p.drop,1);
  c.zone({ x0:-c.W/2,x1:c.W/2,z0:-c.D/2,z1:c.D/2,stay(dt,me){
    const player=env.player,actor=me.world;
    if(!player||player.me!==actor||actor.frozen)return;
    const ride=rides.get(actor);
    const yaw=c.room.rot*Math.PI/2;
    if(ride){
      ride.elapsed+=dt;
      if(ride.elapsed<.78){
        const u=Math.min(1,ride.elapsed/.78);
        const f=evalFlume(p.drop,.19+.81*u);
        const mix=Math.min(1,u*4);
        set(player,ride.x+(f.x-ride.x)*mix,ride.y+(f.y-ride.y)*mix,ride.z+(f.z-ride.z)*mix,f.pitch,yaw);
      }else{
        const t=Math.min(1,(ride.elapsed-.78)/.55),sink=t*t;
        const landingY=BEACH_BED+player.EYE;
        set(player,ceilingMouth.x+(p.landing.x-ceilingMouth.x)*t,ceilingMouth.y+(landingY-ceilingMouth.y)*sink,
          ceilingMouth.z+(p.landing.z-ceilingMouth.z)*t,-.65*(1-t),yaw);
        if(t>=1){
          const at=toWorld(p.landing.x,p.landing.z);
          player.setRidePose(null);
          player.warp(at.x,at.z,yaw);
          env.play?.('wade',at.x,at.z,7);
          env.interfere?.(.26);
          rides.delete(actor);
        }
      }
      return;
    }
    if(actor.y-c.room.y<.43||Math.abs(me.x)>.47||me.z>p.front-.42||me.z<p.front-.96)return;
    const step=c.toLocal(actor.x+actor.wishX,actor.z+actor.wishZ);
    if(step.z>me.z-.25)return;
    if(env.grip?.held)env.grip.release();
    rides.set(actor,{elapsed:0,x:me.x,y:actor.y-c.room.y,z:me.z});
    env.play?.('rattle',actor.x,actor.z,5);
    set(player,me.x,actor.y-c.room.y,me.z,actor.pitch,actor.yaw);
  }});
}
