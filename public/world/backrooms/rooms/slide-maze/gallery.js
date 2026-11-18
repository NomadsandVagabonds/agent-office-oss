import {lin} from '../../kit.js';
import {buildFlume} from '../../waterpark.js';
import {evalFlume} from '../../waterpark.rule.js';
import {pipe} from '../../pool-finish.js';
import {SHELL_SIDES} from './junction.js';

const tau=Math.PI*2, cream=lin('#d4cbb1'), frame=lin('#69796e');
const terry=lin('#b56549'), dark=lin('#35473e');

// Both sightings share this model: a numbered gate and the attendant's
// striped towel. The second is seen from below the landing through the glass.
function gate(c,x,y,z,scale){
  const box=(x0,y0,z0,x1,y1,z1,col)=>c.flat.box(x+x0*scale,y+y0*scale,z+z0*scale,
    x+x1*scale,y+y1*scale,z+z1*scale,col);
  for(const dx of [-.49,.49])box(dx-.024,0,-.025,dx+.024,.94,.025,frame);
  for(const h of [.46,.9])box(-.52,h,-.031,.52,h+.042,.031,frame);
  box(-.39,.81,-.05,.16,1.29,.05,dark);
  const number=c.kit.tex.custom('flume:gate-03',96,80,g=>{
    g.fillStyle='#c8b369';g.fillRect(0,0,96,80);
    g.strokeStyle='#555e50';g.lineWidth=3;g.strokeRect(3,3,90,74);
    g.fillStyle='#34483f';g.font='bold 54px monospace';g.textAlign='center';g.fillText('03',48,60);
  },{clamp:true});
  const enamel=c.mapped('flume:gate-03',number);
  for(const side of [-1,1])c.board(enamel,x-.115*scale,y+1.05*scale,z+side*.052*scale,
    .52*scale,.45*scale,side<0?Math.PI:0);
  box(.18,.52,-.073,.44,.95,.074,terry);
  for(const side of [-1,1]){
    const zz=side*.075;
    for(const h of [.60,.65]) box(.18,h,zz-.002,.44,h+.026,zz+.002,cream);
  }
}

export function galleryMarker(c){
  gate(c,-1.70,0,2.17,1);
}

function highGallery(c,x,z,y) {
  // Forced perspective inside a light-tight housing. The actual mesh has
  // depth and occlusion from either eye; there is no second camera/render.
  const width=.74, deckY=y+.13, back=z-.91, front=z-.54;
  c.flat.box(x-width,deckY-.13,back,x+width,deckY,front,cream);
  c.flat.box(x-width,deckY-.035,front,x+width,deckY,front+.013,dark);
  for(let i=0;i<3;i++){
    const dx=x-width+.035+i*.67;
    pipe(c.flat,[dx,deckY-.28,back],[dx,deckY-.12,front],.022,frame);
  }
  for(let i=0;i<4;i++){
    const h=deckY+i*.069;
    c.flat.box(x-.71,h-.061,front-.157-i*.09,x-.41,h,front-.055-i*.09,cream);
    c.flat.box(x-.71,h,front-.091-i*.09,x-.41,h+.007,front-.055-i*.09,dark);
  }
  gate(c,x+.07,deckY,front-.10,.49);
  for (const dx of [-.69,.66]){
    c.flat.box(x+dx,deckY,front-.04,x+dx+.02,deckY+.49,front-.01,frame);
  }
  for(const h of [.24,.45]){
    for(const [left,right] of [[-.69,-.17],[.31,.68]])
      c.flat.box(x+left,deckY+h,front-.115,x+right,deckY+h+.022,front-.092,frame);
  }
  // A dark doorway and its receding surrounds sit behind the marked landing.
  // The bright ceramic wall gives the dark rail and towel a readable silhouette.
  const glazed=c.mapped('flume:glimpse-tile',c.kit.tex.custom('flume:glimpse-tile',64,64,g=>{
    g.fillStyle='#e4ddc0';g.fillRect(0,0,64,64);g.fillStyle='#a9ab99';
    for(let i=0;i<64;i+=16){g.fillRect(i,0,1,64);g.fillRect(0,i,64,1);}
    g.fillStyle='#849e97';g.fillRect(1,33,63,14);
  }));
  c.board(glazed,x-.42,deckY+.31,back,.64,.62);
  c.board(glazed,x+.52,deckY+.31,back,.44,.62);
  c.flat.box(x-.09,deckY,back+.005,x+.30,deckY+.59,back+.013,dark);
  for(const [offset,depth] of [[0,.08],[.03,.04]]){
    const shade=offset?frame:cream;
    for(const edge of [-.10+offset,.29-offset])c.flat.box(x+edge,deckY,back+depth,x+edge+.018,deckY+.58-offset,back+depth+.012,shade);
    c.flat.box(x-.10+offset,deckY+.56-offset,back+depth,x+.31-offset,deckY+.58-offset,back+depth+.012,shade);
  }
  const fittings=c.shining('flume:glimpse-lamp',c.kit.tex.panel(true),1.25,lin('#e4d9aa'));
  c.board(fittings,x+.10,deckY+.50,back+.023,.18,.023);
  c.light(x-.22,deckY+.39,front+.12,'#fff1ca',.84,{k:2.5,far:2.2});
}

export function gallerySleeve(c,batch,spec,axisY,radius){
  const cx=(spec.x0+spec.x1)/2, cz=spec.z0, half=(spec.x1-spec.x0)/2;
  const viewAngle=4.15, aperture=.385, color=lin(spec.color), lining=lin('#708f85');
  function point(x,angle,r){return [cx+x,axisY-r*Math.cos(angle),cz+r*Math.sin(angle)];}
  const slices=[-half,...Array.from({length:25},(_,i)=>-aperture*Math.cos(i*Math.PI/24)),half];
  // At each station the sleeve covers the complement of the circular opening.
  for(const inside of [false,true]){
    const r=radius*(inside?.95:1), col=inside?lining:color;
    const ring=x=>{
      const gap=Math.sqrt(Math.max(0,aperture**2-x**2))/radius;
      return Array.from({length:SHELL_SIDES+1},(_,i)=>point(x,viewAngle+gap+(tau-2*gap)*i/SHELL_SIDES,r));
    };
    let prev=ring(slices[0]);
    for(const x of slices.slice(1)){
      const next=ring(x);
      for(let i=0;i<SHELL_SIDES;i++){
        if(inside)batch.quad(prev[i],prev[i+1],next[i+1],next[i],col);
        else batch.quad(prev[i],next[i],next[i+1],prev[i+1],col);
      }
      prev=next;
    }
  }
  // A sealed round port, shaped to the curvature of the tube wall.
  const rim=(i,size,r)=>{const a=tau*i/48;
    return point(size*Math.cos(a),viewAngle-size*Math.sin(a)/radius,r);};
  const y=axisY-radius*Math.cos(viewAngle), z=cz+radius*Math.sin(viewAngle);
  const cap=i=>{const a=tau*i/48, cs=Math.cos(a),sn=Math.sin(a);
    const m=Math.max(Math.abs(cs),Math.abs(sn));
    return [cx+.81*cs/m,y+.38+.56*sn/m,z-.96];};
  const housing=lin('#526d64'), outside=lin('#809085');
  for(let i=0;i<48;i++){
    const a=rim(i,aperture-.024,radius*.91),b=rim(i+1,aperture-.024,radius*.91);
    const d=rim(i,aperture+.048,radius*.91),e=rim(i+1,aperture+.048,radius*.91);
    c.flat.quad(a,d,e,b,cream);c.flat.quad(b,e,d,a,cream);
    const outer=rim(i,aperture,radius),next=rim(i+1,aperture,radius);
    c.flat.quad(b,a,outer,next,frame);c.flat.quad(next,outer,a,b,frame);
    const l=cap(i),r=cap(i+1);
    batch.quad(outer,next,r,l,housing);batch.quad(l,r,next,outer,outside);
    const mid=[cx,y+.38,z-.96];
    batch.tri(mid,l,r,frame);batch.tri(mid,r,l,housing);
    if(i%6===0){
      const [x0,y0,z0]=rim(i,aperture+.016,radius*.904);
      c.flat.box(x0-.013,y0-.013,z0-.013,x0+.013,y0+.013,z0+.013,dark);
    }
  }
  highGallery(c,cx,z,y);
}

export function lowerCrossing(c,batch,left,front,floorY) {
  // The visible return line bends under the fork then penetrates the basin
  // wall. Its clearance is also used by the lower hall's crouch controller.
  const radius=.30, points=[[left-.15,-.34,-.52],[left+.54,-.27,-.50],
    [-3.65,.07,.45],[-2.53,.14,.80],[-1.35,.025,1.20],[-.86,-.34,front+.15]];
  buildFlume(c,'knot:low-return',points,{batch,radius,molded:true,color:'#568f83'});
  const path=Array.from({length:25},(_,i)=>evalFlume(points,i/24));
  return (x,z)=>{
    let clearance=Infinity;
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
      const d2=(x-a.x-t*dx)**2+(z-a.z-t*dz)**2;
      if(d2<radius**2)clearance=Math.min(clearance,a.y+t*(b.y-a.y)-Math.sqrt(radius**2-d2)-floorY);
    }
    return clearance;
  };
}
