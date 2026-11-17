// Construction shared by the aquatics wing. No renderer changes and no new
// floor/collision rules: structural silhouettes live in the ordinary batches;
// removable surface work is one separately named, baked detail mesh per room.
import {Batch,lin} from './kit.js';
import {slabBottom} from './rooms/hanging-changing/plan.js';

const C={ivory:lin('#c8c8ac'),edge:lin('#e0ddbd'),green:lin('#557d70'),steel:lin('#8d9e90'),
  dark:lin('#253c35'),rust:lin('#806147'),rubber:lin('#273432'),ochre:lin('#b09855')};
const box=(b,a,d,col=C.steel)=>b.box(...a,...d,col,{step:.65});
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const norm=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

// Closed faceted tube, including vertical runs. Caps prevent bright holes
// when a camera looks along an elbow. No smooth-shaded cylinders are used.
export function pipe(b,a,d,r,col=C.steel,sides=8) {
  const t=norm(d.map((v,i)=>v-a[i])),u=norm(cross(t,Math.abs(t[1])>.9?[1,0,0]:[0,1,0])),v=cross(t,u);
  const at=(p,i)=>p.map((n,k)=>n+r*(u[k]*Math.cos(i*Math.PI*2/sides)+v[k]*Math.sin(i*Math.PI*2/sides)));
  for(let i=0;i<sides;i++){
    const p=at(a,i),q=at(a,i+1),s=at(d,i),z=at(d,i+1);
    const shade=col.map(n=>n*(.88+.12*Math.cos(i*Math.PI*2/sides)));
    b.quad(p,q,z,s,shade);b.tri(a,q,p,col);b.tri(d,s,z,col);
  }
}
function ring(b,x,y,z,rx,rz,width,height,col=C.ivory,n=32) {
  for(let i=0;i<n;i++){
    const a=i*Math.PI*2/n,d=(i+1)*Math.PI*2/n;
    const p=(r,s,h)=>[x+Math.cos(s)*(rx+r),y+h,z+Math.sin(s)*(rz+r)];
    b.quad(p(width,a,0),p(width,d,0),p(0,d,0),p(0,a,0),col);
    b.quad(p(0,a,height),p(0,d,height),p(width,d,height),p(width,a,height),col);
    b.quad(p(0,a,0),p(0,d,0),p(0,d,height),p(0,a,height),col);
    b.quad(p(width,a,height),p(width,d,height),p(width,d,0),p(width,a,0),col);
  }
}
function flange(b,a,d,r=.12){
  pipe(b,mix(a,d,.47),mix(a,d,.53),r*1.6,C.rust);
  pipe(b,mix(a,d,.44),mix(a,d,.47),r*1.7,C.steel);
  pipe(b,mix(a,d,.53),mix(a,d,.56),r*1.7,C.steel);
}
function grille(b,x,y,z,w,d){
  box(b,[x-w/2,y,z-d/2],[x+w/2,y+.008,z+d/2],C.dark);
  for(let xx=x-w/2+.035;xx<x+w/2;xx+=.09)
    box(b,[xx,y+.009,z-d/2],[xx+.026,y+.026,z+d/2],C.steel);
  for(const zz of [z-d/2,z+d/2])box(b,[x-w/2,y+.008,zz-.012],[x+w/2,y+.032,zz+.012],C.steel);
}
function bolts(b,x,y,z,w,d){
  for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2])
    box(b,[x+dx-.015,y,z+dz-.015],[x+dx+.015,y+.025,z+dz+.015],C.dark);
}

export function poolDetail(c){
  if(c.rt.poolFinish)return c.rt.poolFinish;
  const b=new Batch(),group=c.dynamic(b);
  group.name='waterpark-detail';group.userData.detail=true;
  c.after.push(()=>group.traverse(o=>{o.name='waterpark-detail';o.userData.detail=true;}));
  c.rt.poolFinish={batch:b,group};return c.rt.poolFinish;
}

// Segmented ceramic bullnose, drainage slots and screw-fastened grate returns.
// All projections are under 4 cm; they never replace a walking surface.
export function basinFinish(c,{x0,z0,x1,z1}){
  const b=poolDetail(c).batch;
  for(const [a,d] of [[[x0,0,z0],[x1,0,z0]],[[x0,0,z1],[x1,0,z1]],[[x0,0,z0],[x0,0,z1]],[[x1,0,z0],[x1,0,z1]]]){
    const alongX=a[0]!==d[0],len=Math.hypot(d[0]-a[0],d[2]-a[2]),n=Math.ceil(len/.32);
    const outward=alongX?(a[2]===z0?-1:1):(a[0]===x0?-1:1);
    for(let i=0;i<n;i++){
      const p=mix(a,d,(i+.5)/n),extent=len/n*.45;
      const x=p[0]+(alongX?0:outward*.10),z=p[2]+(alongX?outward*.10:0);
      box(b,[x-(alongX?extent:.085),.046,z-(alongX?.085:extent)],
        [x+(alongX?extent:.085),.064,z+(alongX?.085:extent)],i%13===4?C.ivory:C.edge);
      // Flush transverse joints catch the rake of a flashlight.
      if(i%3===0){
        const gx=p[0]+(alongX?0:outward*.36),gz=p[2]+(alongX?outward*.36:0);
        grille(b,gx,.012,gz,alongX?.20:.14,alongX?.14:.20);
      }
    }
  }
}

function services(c,b){
  const {W,D,H}=c;
  // A ribbed ventilation trunk follows one wall, suspended on split saddles.
  const x=-W/2+.38,y=H-.30;
  box(c.flat,[x-.19,y-.18,-D/2+.35],[x+.19,y+.14,D/2-.35],C.ivory);
  for(let z=-D/2+.6;z<D/2-.35;z+=.8){
    box(b,[x-.205,y-.195,z-.025],[x+.205,y+.155,z+.025],C.steel);
    pipe(b,[x-.22,y-.2,z],[x-.22,H,z],.018);
    pipe(b,[x+.22,y-.2,z],[x+.22,H,z],.018);
    bolts(b,x,y+.16,z,.32,.035);
  }
  // Only high wall relief: cannot close a generated doorway or touch a stash.
  for(const side of ['left','right']) {
    const span=D-.7,y0=Math.max(2.5,H-.8);
    c.wbox(side,0,span,y0,y0+.13,.01,.10,C.green);
    for(let z=-D/2+.6;z<D/2-.4;z+=.65){
      const p=c.wallAt(side,z,.12);
      box(b,[p.x-.024,y0-.13,p.z-.23],[p.x+.024,y0-.015,p.z+.23],C.ivory);
    }
  }
}
function overheadRibs(c,b,zs,low,color=C.ivory){
  const {W,H}=c;
  for(const z of zs){
    // Stepped haunches widen toward the wall, leaving the centre clear.
    for(const s of [-1,1])for(let i=0;i<6;i++){
      const x=s*(W/2-.1-i*.32),y=low+(5-i)*.11;
      box(c.flat,[x-.16,y,z-.16],[x+.16,H-.12,z+.16],color);
      box(b,[x-.175,y-.018,z-.18],[x+.175,y+.035,z+.18],C.edge);
    }
    pipe(c.flat,[-W/2+1.85,low,z],[W/2-1.85,low,z],.065,C.steel);
    for(let x=-W/2+2;x<W/2-1.8;x+=.65){
      pipe(b,[x,low,z],[x+.32,H-.16,z],.017,C.dark);
      box(b,[x-.1,H-.18,z-.12],[x+.1,H-.14,z+.12],C.steel);
    }
  }
}

/** Room-specific silhouette and construction pass; no generated RNG consumed. */
export function finishPoolRoom(c,kind){
  const {W,D,H}=c,b=poolDetail(c).batch;
  if(!['bellmouth-baths','hanging-changing'].includes(kind))services(c,b);
  if(kind==='wave-pool'){
    overheadRibs(c,b,[-D*.28,0,D*.28],H-.95);
    const z=-D/2+2.05,w=(W-4.9)/4;
    for(let i=0;i<4;i++){
      const x=-W/2+2.45+(i+.5)*w;
      // Big pressure necks terminate in the caisson housing. Rings and flange
      // bolts make the grille wall read as equipment, not painted rectangles.
      pipe(c.flat,[x,1.5,z],[x,H-.12,z],.24,C.green,12);
      flange(b,[x,1.6,z],[x,2.65,z],.24);
      for(let yy=.05;yy<1.5;yy+=.3)box(b,[x-w*.38,yy,z+.37],[x+w*.38,yy+.032,z+.405],C.steel);
      for(const xx of [-.32,.32])bolts(b,x+xx,2.13,z,.045,.50);
    }
  }else if(kind==='lazy-river'){
    // A low circular coffer floats over the canal; one offset inner ring makes
    // the lifeguard seem to stand off-centre in a badly repeated institution.
    const r=Math.min(4.95,Math.min(W,D)/2-2.05);
    ring(c.flat,0,H-.48,0,r-.45,r-.45,.48,.26,C.ivory,40);
    ring(c.flat,.28,H-.25,-.18,2.45,2.45,.25,.22,C.green,32);
    for(let i=0;i<36;i++){
      const a=i*Math.PI*2/36,x=Math.cos(a),z=Math.sin(a);
      pipe(b,[x*(r-.42),H-.50,z*(r-.42)],[x*r,H-.50,z*r],.025,C.steel);
      if(i%3===0)pipe(b,[x*r,H-.22,z*r],[x*r,H,z*r],.025);
    }
  }else if(kind==='deep-end'){
    overheadRibs(c,b,[-D*.28,D*.28],H-.65);
    // The submerged partition is a bolted pressure bulkhead with a double
    // seam and drain mouths, rather than one plain wall stopping in water.
    for(const sign of [-1,1])for(let x=-W/2+1.8;x<W/2-1.7;x+=.55){
      const spans=sign>0&&Math.abs(x)<1.08?[[-.76,.50],[1.44,H-.05]]:[[-.76,H-.05]];
      for(const [lo,hi] of spans)box(b,[x-.016,lo,sign*.15-.012],[x+.016,hi,sign*.15+.012],C.steel);
      for(const y of [-.62,.25,1.65])box(b,[x-.038,y,sign*.17-.02],[x+.038,y+.07,sign*.17+.02],C.dark);
    }
    for(const side of [-1,1]){
      const x=side*(W/2-1.72);
      pipe(c.flat,[x,-1.75,-D/2+2],[x,-1.75,D/2-2],.10,C.green);
      for(const z of [-D*.24,D*.24])flange(b,[x,-1.75,z-.5],[x,-1.75,z+.5],.1);
    }
  }else if(kind==='kiddie-lagoon'){
    // Scalloped, nested canopy: playground colours without cartoon murals
    // covering every surface. The small mushroom stays the scale reference.
    for(let i=0;i<3;i++)ring(c.flat,.32*i,H-.35+i*.10,0,1.8+i*.8,1.6+i*.8,.32,.16,
      i===1?lin('#b89b59'):C.ivory,24);
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,x=Math.cos(a)*3.65,z=Math.sin(a)*3.45;
      pipe(b,[x,H-.10,z],[x*.55,H-.41,z*.55],.035,C.rust);
    }
  }else if(kind==='whirlpool-flume'){
    // A square compression coffer above a circular drain. Corners appear to
    // bear down on the room, while the existing overhead flumes cut across it.
    for(const s of [-1,1])for(let i=0;i<5;i++){
      const y=H-.15-i*.085,half=2.9-i*.18;
      box(c.flat,[-half,y,s*half-.16],[half,y+.085,s*half+.16],i%2?C.green:C.ivory);
      box(c.flat,[s*half-.16,y,-half],[s*half+.16,y+.085,half],i%2?C.green:C.ivory);
    }
    for(const x of [-1.25,1.25]){
      pipe(b,[x,H-.45,-2.4],[x,H-.45,2.4],.07,C.steel);
      for(const z of [-1.8,0,1.8])flange(b,[x,H-.45,z-.4],[x,H-.45,z+.4],.07);
    }
  }else if(kind==='locker-showers'){
    for(const z of [-2.88,0,2.88]){
      pipe(c.flat,[-3.7,2.38,z],[3.7,2.38,z],.08,C.green);
      for(const x of [-3,-1.5,0,1.5,3]){
        flange(b,[x-.4,2.38,z],[x+.4,2.38,z],.08);
        pipe(b,[x,2.38,z],[x,H,z],.018);
      }
    }
    for(const x of [-2.78,2.78])for(const z of [-2.8,0,2.8])grille(b,x,.055,z,.58,.38);
  }else if(kind==='slide-maze'){
    overheadRibs(c,b,[-D*.32,D*.32],H-.5,C.green);
    for(const side of [-1,1]){
      const x=side*(W/2-.65);
      pipe(c.flat,[x,2.8,-D/2+.3],[x,2.8,D/2-.3],.115,C.ochre);
      for(let z=-D/2+1;z<D/2;z+=1.8){
        flange(b,[x,2.8,z-.4],[x,2.8,z+.4],.115);
        pipe(b,[x,2.8,z],[side*(W/2-.03),2.8,z],.045,C.steel);
      }
    }
  }else if(kind==='return-pool'){
    const {roof}=c.rt.returnPool.plan;
    // Rim panels with exposed underside vents make the inverted pool look
    // built, with identical hardware on the wrong side of the water.
    for(const side of [-1,1])for(let z=-D/2+4;z<D/2-3;z+=1.2){
      const x=side*2.90;
      box(b,[x-.035,roof-.12,z-.42],[x+.035,roof+.12,z+.42],C.steel);
      for(let k=0;k<6;k++)box(b,[x-.045,roof-.11+k*.038,z-.33],[x+.045,roof-.095+k*.038,z+.33],C.dark);
    }
    overheadRibs(c,b,[-D*.34,D*.34],H-.60);
  }else if(kind==='hanging-changing'){
    for(const s of c.rt.changing.plan.slabs){
      for(const z of [s.z-.825,s.z+.825]){
        for(let x=s.x0+.18;x<s.x1-.18;x+=.40){
          const trim=slabBottom(s,x)>2?3.15:1.70;
          box(b,[x-.18,trim,z-.016],[x+.18,trim+.07,z+.016],C.edge);
        }
        for(let x=s.x0+.5;x<s.x1;x+=2.4){
          pipe(b,[x,3.35,z],[x,H-.12,z],.034,C.steel);
          for(const y of [3.6,H-.25])box(b,[x-.07,y,z-.025],[x+.07,y+.04,z+.025],C.rust);
        }
      }
    }
  }else if(kind==='bellmouth-baths'){
    const p=c.rt.bellmouth.plan;
    // Radial rib caps in the high vault, well above the paths. Concentric
    // courses reinforce the room-sized funnel instead of adding loose clutter.
    for(let i=0;i<24;i++){
      const a=(i+.5)*Math.PI/12,x=Math.sin(a),z=Math.cos(a);
      pipe(c.flat,[x*p.rx*.51,H+2.32,z*p.rz*.51],[x*p.rx*.98,H-.1,z*p.rz*.98],.065,C.green);
      for(const r of [.6,.72,.84,.96])box(b,[x*p.rx*r-.07,H+2.4*(1-r)*2-.16,z*p.rz*r-.07],
        [x*p.rx*r+.07,H+2.4*(1-r)*2-.12,z*p.rz*r+.07],C.steel);
    }
    ring(b,0,H+2.29,0,p.rx*.49,p.rz*.49,.15,.06,C.edge,48);
  }
  c.rt.poolFinish.kind=kind;
}
