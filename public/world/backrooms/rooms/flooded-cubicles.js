import { Batch, lin, WHITE } from '../kit.js';
import { CRT_SCREEN } from '../../props/office.js';
import { poolTextures, tiledPlane } from './return-pool/art.js';
import { showerWater } from './locker-showers/water.js';
import { buildFlume } from '../waterpark.js';
import { AXIS_Y, TUBE_RADIUS } from './flume-connector/plan.js';
import { officeRunnel } from './flume-connector/water.js';

export function build(c) {
  const { W, D, H } = c, front = D / 2, back = -front, left = -W / 2, right = -left;
  const bed = -.20, water = -.045, halfDeck = 1.22;
  const material = poolTextures(c.kit);
  c.shell({ floor: false, panels: false, skirting: false, wallTex: material.tile, wallAlb: lin('#b8b3a4') });
  c.rt.amb = lin('#bccebf', .20);
  const flooded = (x,z) => Math.abs(x) > halfDeck && z > back + .75 && z < front - .75;
  c.rt.floorY = (x,z) => flooded(x,z) ? bed : 0;
  const carpet = c.mapped('flooded-office:carpet', c.kit.tex.carpet('#5f6056'));
  const tile = c.mapped('flooded-office:tile', material.deep, { wet: .84 });
  tiledPlane(carpet, -halfDeck, back, halfDeck, front, 0);
  for (const [x0,x1] of [[left,-halfDeck],[halfDeck,right]]) {
    tiledPlane(carpet,x0,back,x1,back+.75,0);
    tiledPlane(carpet,x0,front-.75,x1,front,0);
    tiledPlane(tile,x0,back+.75,x1,front-.75,bed);
    c.flat.box(x0,bed,back+.74,x1,0,back+.75,lin('#3e5653'));
    c.flat.box(x0,bed,front-.75,x1,0,front-.74,lin('#3e5653'));
    for (const x of [x0, x1]) c.flat.box(x-.01,bed,back+.75,x+.01,0,front-.75,lin('#3e5653'));
  }
  const basin = new Batch();
  tiledPlane(basin,left,back+.75,-halfDeck,front-.75,water);
  tiledPlane(basin,halfDeck,back+.75,right,front-.75,water);
  showerWater(c,basin,material.water);
  buildFlume(c,'office-mouth',[[0,AXIS_Y,front+.10],[0,AXIS_Y,front-.05],[0,AXIS_Y,front-.64]],
    { radius: TUBE_RADIUS, color: '#6d9e91', interior: true, alpha: 1, steps: 5 });
  tiledPlane(tile,-.52,front-.68,.52,front+.08,0.008);
  officeRunnel(c, front);

  const dividers = c.mapped('flooded-office:partitions',c.kit.tex.carpet('#637676'),{wet:.32});
  const phosphor = c.kit.tex.custom('flooded-office:phosphor',64,48,g=>{
    g.fillStyle='#102f26';g.fillRect(0,0,64,48);
    g.fillStyle='#7ec889';g.fillRect(6,8,40,2);
    for(let i=0;i<6;i++)g.fillRect(7,15+i*4,14+(i*17)%38,1);
  },{clamp:true});
  const screen = c.shining('flooded-office:monitor',phosphor,1.22);
  for (const [x,z] of [[-2.42,1.18],[-2.42,-1.55],[2.55,-1.50]]) {
    const edge = x < 0 ? -.73 : .73;
    dividers.box(x-1.01,bed,z+edge-.065,x+1.01,1.03,z+edge+.065,WHITE,{uv:1.6});
    c.solid(x-1.01,z+edge-.065,x+1.01,z+edge+.065,{keep:true,tall:true});
    c.prop('desk',x,z,{ y:bed, solid:true });
    c.prop('crt',x+.18,z-.03,{ y:bed+.766, solid:false });
    if(z>0)c.board(screen,x+.18,bed+.766+CRT_SCREEN.y*.025,z-.03+CRT_SCREEN.z*.025,CRT_SCREEN.w*.025,CRT_SCREEN.h*.025,0);
  }
  c.prop('cabinet',3.66,1.43,{ y:bed, rot:Math.PI/2 });
  c.prop('chair',2.44,.60,{ y:bed, rot:1.32 });
  const tube = c.shining('flooded-office:troffer',c.kit.tex.panel(true),1.4,lin('#b9e6d5'));
  c.lay(tube,-2.4,.8,.34,1.52,0,null,WHITE,H-.035,true);
  c.light(-2.4,H-.16,.8,'#bee5d4',1.21,{far:7,k:3.8});
  c.light(-2.40,1.05,1.15,'#83ce9d',.85,{far:4.4,k:2.3});
  c.light(2.0,2.10,-2.54,'#c5e4d4',.58,{far:5,k:1.5});
  c.tick((_dt,_time,me)=>{
    if(me.inside && flooded(me.x,me.z)) me.world.slow=Math.min(me.world.slow??1,.75);
  });
}
