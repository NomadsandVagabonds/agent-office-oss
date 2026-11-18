// The four pressure chambers share a tiled lintel. Each grille stands in
// front of a recessed shutter, with a glazed arch returning into the wall.
import { Batch, lin, WHITE } from '../../kit.js';
import { pipe, poolDetail } from '../../pool-finish.js';

export function waveCaissons(c, tile, x0, x1, z, bottom) {
  const body=c.flat, detail=poolDetail(c).batch;
  const iron=lin('#617674'), brass=lin('#ab9466'), gasket=lin('#313e40');
  const enamel=lin('#899b91'), pale=lin('#b0b8a9');
  const bay=(x1-x0)/4, r=bay*.37, front=z+.09, rear=z-.46, spring=.74;
  const tags=c.kit.tex.custom('wave:chamber-plates',512,64,(g)=>{
    for(let i=0;i<4;i++){
      const x=i*128;
      g.fillStyle='#d3c7a1';g.fillRect(x,0,128,64);
      g.strokeStyle='#46605a';g.lineWidth=2;g.strokeRect(x+3,3,122,58);
      g.fillStyle='#254540';g.textAlign='center';
      g.font='bold 39px monospace';g.fillText('0'+(i+1),x+64,47);
      for(const px of [x+10,x+118])g.fillRect(px,30,3,3);
    }
  },{clamp:true});
  const plates=c.mapped('wave:chamber-plates',tags);
  for(let i=0;i<4;i++){
    const l=x0+i*bay, cx=l+bay/2;
    tile.box(l,bottom,rear,cx-r,2.08,front,WHITE,{uv:1});
    tile.box(cx+r,bottom,rear,l+bay,2.08,front,WHITE,{uv:1});
    body.box(cx-r,bottom,rear,cx+r,2.08,rear+.04,gasket);
    for(let j=0;j<12;j++){
      const angle=j*Math.PI/12, next=(j+1)*Math.PI/12;
      const a=cx-r*Math.cos(angle), b=cx-r*Math.cos(next);
      const h=spring+.66*Math.sin(angle), k=spring+.66*Math.sin(next);
      body.quad([a,h,front],[b,k,front],[b,2.08,front],[a,2.08,front],enamel);
      body.quad([a,h,rear],[b,k,rear],[b,k,front],[a,h,front],iron);
      body.quad([a,h,front+.012],[b,k,front+.012],[b,k+.075,front+.012],[a,h+.075,front+.012],pale);
    }
    for(let j=0;j<5;j++){
      const h=.12+j*.22;
      detail.quad([cx-r+.05,h,rear+.15],[cx+r-.05,h,rear+.15],
        [cx+r-.05,h+.15,rear+.07],[cx-r+.05,h+.15,rear+.07],iron);
    }
    for(let j=-3;j<=3;j++){
      const dx=j*r/4, cap=spring+.66*Math.sqrt(1-(dx/r)**2);
      pipe(detail,[cx+dx,bottom,z-.01],[cx+dx,cap,z-.01],.026,pale);
    }
    detail.box(cx-r,.22,front-.09,cx+r,.265,front-.04,brass);
    body.box(l,1.99,rear,l+bay,2.10,front+.06,pale);
    const uv=[[i/4,0],[(i+1)/4,0],[(i+1)/4,1],[i/4,1]];
    c.board(plates,cx,1.73,front+.016,.47,.235,0,uv);
    pipe(body,[cx,2.1,z-.18],[cx,c.H-.05,z-.18],.23,enamel,12);
    for (const y of [2.18,c.H-.31]) {
      pipe(detail,[cx,y-.04,z-.18],[cx,y+.04,z-.18],.295,iron,16);
      for(let j=0;j<6;j++){
        const a=j*Math.PI/3, x=cx+.26*Math.cos(a), zz=z-.18+.26*Math.sin(a);
        detail.box(x-.018,y+.04,zz-.018,x+.018,y+.069,zz+.018,brass);
      }
    }
  }
  c.solid(x0,rear,x1,front,{keep:true,tall:true});
  // The reflector turns inside a fixed amber lens only during the warning.
  const y=2.10, cz=z-.08;
  pipe(body,[0,y,cz],[0,y+.07,cz],.22,gasket,16);
  pipe(body,[0,y+.07,cz],[0,y+.33,cz],.17,lin('#ac7439'),16);
  pipe(detail,[0,y+.33,cz],[0,y+.36,cz],.175,brass,16);
  const reflector=new Batch();
  for(let i=-2;i<2;i++){
    const a=i*Math.PI/10,b=(i+1)*Math.PI/10;
    const pt=(v,h)=>[.177*Math.sin(v),h,.177*Math.cos(v)];
    reflector.quad(pt(a,0),pt(b,0),pt(b,.23),pt(a,.23),lin('#ffd67a'));
  }
  const beacon=c.dynamic(reflector,{unlit:true});
  beacon.position.set(0,y+.085,cz);beacon.visible=false;
  return beacon;
}
