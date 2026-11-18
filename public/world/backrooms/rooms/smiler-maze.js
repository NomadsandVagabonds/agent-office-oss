import { lin, WHITE } from '../kit.js';
import { terryCloth } from './locker-showers/textures.js';
import { pipe } from '../pool-finish.js';
import { poolTextures } from './return-pool/art.js';
import { mazePlan } from './dive-tower/plan.js';
import { createChase } from './dive-tower/chase.js';

// Two linen drops share a tiled chase wall. The front skin is cut away at
// each opening; the tiled back and the wall's movement bounds run through.
function linenDrops(c, tile, textures, bounds) {
  const [left, back, right, face] = bounds, lip = .93, lintel = 1.68;
  const metal=lin('#a5b3a9'), edge=lin('#c8cbaf'), shadow=lin('#273636');
  const enamel=lin('#50736b'), canvas=lin('#cbbea0'), hem=lin('#98726a');
  const centers=[-1.15,.31], half=.52, slots=c.flat;
  const panel=(x0,y0,x1,y1)=>tile.box(x0,y0,back,x1,y1,face,WHITE,{uv:1.6,step:.65});
  panel(left,0,right,lip); panel(left,lintel,right,c.H);
  panel(left,lip,centers[0]-half,lintel);panel(centers[0]+half,lip,centers[1]-half,lintel);
  panel(centers[1]+half,lip,right,lintel);
  tile.box(left,lip,back,right,lintel,back+.025,WHITE,{uv:1.6,step:.65});
  const title=c.mapped('linen:sign',textures.sign('linen-return','TOWEL RETURN','#c9c9aa','#325953'));
  slots.box(-2.02,1.88,face,1.35,2.39,face+.034,enamel);
  c.board(title,-.335,2.135,face+.037,3.23,.43);
  const clothBatch=c.mapped('linen:cloth',terryCloth(c.kit));
  for(const [i,x] of centers.entries()) {
    const lo=x-half,hi=x+half;
    slots.box(lo,lip,back+.026,hi,lintel,back+.04,shadow);
    // A bank of black rubber flaps recedes behind the chamfered chute mouth.
    for(let n=0;n<8;n++){
      const x0=lo+n*.13, sway=(i===0 && n>2 && n<6) ? .075 : .014*(n%3);
      slots.quad([x0,lip+.21+sway,back+.09],[x0+.123,lip+.21+sway,back+.09],
        [x0+.123,lintel-.045,face-.045],[x0,lintel-.045,face-.045],lin(n%2?'#344344':'#414c49'));
    }
    for(const at of [lo,hi])slots.box(at-.033,lip-.055,face-.02,at+.033,lintel+.045,face+.035,metal);
    slots.box(lo-.045,lintel-.025,face-.025,hi+.045,lintel+.055,face+.055,edge);
    slots.quad([lo,lip+.015,face+.09],[hi,lip+.015,face+.09],[hi,lip+.11,back+.05],[lo,lip+.11,back+.05],metal);
    pipe(slots,[lo-.025,lip+.01,face+.09],[hi+.025,lip+.01,face+.09],.028,edge);
    // The mechanical laundry counters disagree by one towel.
    const counterKey = 'linen:counter:'+i;
    const counterTex = c.kit.tex.custom(counterKey,256,48,g=>{
      g.fillStyle='#807e68';g.fillRect(0,0,256,48);
      g.fillStyle='#e5dec0';g.font='bold 19px monospace';g.textAlign='center';g.fillText(i?'RETURNED':'ISSUED',66,31);
      const digits=i?'0492':'0491';
      for(let j=0;j<digits.length;j++){
        const left=135+j*27;
        g.fillStyle='#303431';g.fillRect(left,6,25,36);
        g.fillStyle='#dedcc4';g.font='bold 29px monospace';g.fillText(digits[j],left+12,34);
        g.fillStyle='#464842';g.fillRect(left,24,25,1);
      }
    },{clamp:true});
    c.board(c.mapped(counterKey,counterTex),x,1.80,face+.024,.71,.133);
    // A damp towel has been drawn partly under the left flap. The striping
    // follows each fold around the sill and the loose hem hangs unevenly.
    if(i===0){
      const folds=12, width=.53, start=x-width*.5;
      const rows=[[lip+.16,face-.12],[lip+.066,face+.03],[lip+.04,face+.122],[lip-.30,face+.112],[lip-.34,face+.11],[lip-.365,face+.11],[lip-.40,face+.109]];
      function cloth(k,j) {
        const [y,z]=rows[j], u=k/folds, pleat=Math.cos(u*Math.PI*6+.36);
        return [start+u*width+.028*j/rows.length, y+(j<3?.012:.04)*pleat-.02*u, z+.018*pleat];
      }
      for(let j=0;j<rows.length-1;j++)for(let k=0;k<folds;k++){
        const lower=rows[j+1][0]*2, upper=rows[j][0]*2;
        clothBatch.quad(cloth(k,j+1),cloth(k+1,j+1),cloth(k+1,j),cloth(k,j),j===4?hem:canvas,
          [[k/folds,lower],[(k+1)/folds,lower],[(k+1)/folds,upper],[k/folds,upper]]);
      }
      for(let k=0;k<folds;k++){
        const [xx,y,zz]=cloth(k,rows.length-1);
        slots.box(xx-.004,y-.018-.014*(k%3),zz-.004,xx+.005,y+.004,zz+.004,canvas);
      }
    }
  }
}

export function build(c) {
  const { W,D,H,rt }=c;
  const plan=mazePlan(c.room);
  const texture=poolTextures(c.kit);
  const tile=c.mapped('towel-return:dividers',texture.tile,{wet:.38});
  const block=(batch, bounds, color=WHITE)=>batch.box(...bounds,color,{uv:1.6,step:.65});
  c.shell({floorTex:texture.tile,wallTex:texture.tile,panels:false,sockets:false,skirting:false});
  rt.amb=lin('#a8c1b8',.20);
  const stripe=lin('#447776'), rubber=lin('#273739');
  for(const [index,wall] of plan.walls.entries()){
    const [x0,z0,x1,z1]=wall;
    if (index===0) {
      linenDrops(c,tile,texture,wall);
      block(tile,[x0-.005,.69,z0-.005,x1+.005,.88,z1+.005],stripe);
    } else {
      block(tile,[x0,0,z0,x1,H,z1]);
      block(tile,[x0-.005,.76,z0-.005,x1+.005,1.04,z1+.005],stripe);
    }
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

  const chase=createChase(c);
  rt.smilerChase=chase;
  c.zone({x0:-W/2,x1:W/2,z0:-D/2,z1:D/2,stay(_dt,me){
    if(me.z < D/2-2.2 && !me.world.frozen) chase.start();
    chase.catchVisitor(c,me);
  }});
  c.tick(chase.update);
}
