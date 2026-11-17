import { lin, WHITE } from '../kit.js';
import { poolTextures } from './return-pool/art.js';
import { mazePlan } from './dive-tower/plan.js';
import { createChase } from './dive-tower/chase.js';

export function build(c) {
  const { W,D,H,rt }=c;
  const plan=mazePlan(c.room);
  const texture=poolTextures(c.kit);
  const tile=c.mapped('towel-return:dividers',texture.tile,{wet:.38});
  const block=(batch, bounds, color=WHITE)=>batch.box(...bounds,color,{uv:1.6,step:.65});
  c.shell({floorTex:texture.tile,wallTex:texture.tile,panels:false,sockets:false,skirting:false});
  rt.amb=lin('#a8c1b8',.20);
  const stripe=lin('#447776'), rubber=lin('#273739');
  for(const [x0,z0,x1,z1] of plan.walls){
    block(tile,[x0,0,z0,x1,H,z1]);
    block(tile,[x0-.005,.76,z0-.005,x1+.005,1.04,z1+.005],stripe);
    block(c.flat,[x0-.01,0,z0-.01,x1+.01,.11,z1+.01],rubber);
    c.solid(x0,z0,x1,z1,{keep:true,tall:true,top:H});
  }
  const tubes=c.shining('panel',c.kit.tex.panel(true),1.8,lin('#d6efe5'));
  const emergency=c.shining('towel-return:way',c.kit.tex.white(),.85,lin('#e9af69'));
  const cheek=lin('#b0b7aa');
  for(const [x,z] of [[0,D/2-1.6],[4.2,4.5],[1.7,2.25],[-3.9,.96],[-.65,-2.1],[4.2,-3.75],[1.1,-6.15]]){
    const direction=x>3.8||x<-3.8?0:Math.PI/2;
    c.lay(tubes,x,z,.26,1.42,direction,null,WHITE,H-.065,true);
    c.light(x,H-.24,z,'#c5e1d7',1.15,{far:3.8,k:2.8,axis:[0,-1,0],floor:.2});
  }
  // Light at floor level shows which side of each divider is open after
  // the tubes dim. The blind recesses past the towel bins stay unlit.
  for(const [x,z,rot] of [[4.9,3.95,Math.PI],[-4.95,-.25,0],[4.9,-4.07,Math.PI],[0,-D/2+.015,0]]){
    c.board(emergency,x,.31,z,.25,.065,rot);
    c.light(x,.46,z,'#e99b55',.27,{far:2.4,k:1.1});
  }
  for(const [x,z,rot] of [[-4.7,5.3,0],[1.1,-1.25,Math.PI],[W/2-.55,-6.7,-Math.PI/2]]){
    c.prop('trolley',x,z,{rot,fallback:[.58,.84,.55]});
  }
  block(c.flat,[-W/2+.09,1.7,-D/2+.065,-W/2+.16,2.17,-D/2+.7],cheek);

  const chase=createChase(c,plan);
  rt.smilerChase=chase;
  c.zone({x0:-W/2,x1:W/2,z0:-D/2,z1:D/2,stay(_dt,me){
    if(me.z < D/2-2.2 && !me.world.frozen) chase.start();
    chase.catchVisitor(c,me);
  }});
  c.tick(chase.update);
}
