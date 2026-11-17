// Bellmouth Baths: the room itself is a tiled drain, at municipal-pool scale.
// Review wing only. Quiet architecture, reversible routes, no forced encounter.
import {finishPoolRoom} from '../pool-finish.js';
import {lin,WHITE} from '../kit.js';
import {bellPlan,bellPoint,bellFloor,bellInside,bellHead,SECTORS} from './bellmouth/rule.js';
import {bellTextures,face,beam,bellWater} from './bellmouth/art.js';
import {officeDesk,tiledPlane} from './return-pool/art.js';

export function build(c) {
  const {rt,kit,W,D,H}=c,p=bellPlan(c.room),t=bellTextures(kit);
  rt.amb=lin('#c4ceba',.16);rt.level=.76;
  const tile=c.mapped('bell:tile',t.tile),deck=c.mapped('bell:deck',t.deck),green=c.mapped('bell:green',t.green);
  const stain=c.mapped('bell:tide',t.tide,{cutout:true}),steel=lin('#788578'),dark=lin('#263d32');
  c.shell({floor:false,ceiling:false,walls:['front','back'],panels:false,sockets:false,skirting:false,wallTex:t.tile});
  rt.floorY=(x,z)=>Math.abs(z)>p.rz?c.floorAt(x,z):bellFloor(p,x,z);
  rt.clip=(x,z,r)=>bellInside(p,x,z,r);
  rt.headY=(x,z)=>bellHead(p,x,z)-(rt.floorY(x,z)-bellFloor(p,x,z));
  const box=(b,x0,y0,z0,x1,y1,z1,color=WHITE)=>b.box(x0,y0,z0,x1,y1,z1,color,{step:.6,uv:1.6});
  const yAt=(a,r)=>bellFloor(p,...[Math.sin(a)*p.rx*r,Math.cos(a)*p.rz*r]);
  const rail=(a,b)=>{
    beam(c.flat,a.map((v,i)=>i===1?v+.92:v),b.map((v,i)=>i===1?v+.92:v),.055,steel);
    beam(c.flat,a.map((v,i)=>i===1?v+.46:v),b.map((v,i)=>i===1?v+.46:v),.035,steel);
    box(c.flat,a[0]-.035,a[1],a[2]-.035,a[0]+.035,a[1]+.94,a[2]+.035,steel);
    box(c.flat,a[0]-.09,a[1]+.006,a[2]-.09,a[0]+.09,a[1]+.025,a[2]+.09,lin('#a2a18b'));
    for(const dx of [-.06,.06])box(c.flat,a[0]+dx-.01,a[1]+.025,a[2]-.01,a[0]+dx+.01,a[1]+.04,a[2]+.01,dark);
    // Narrow segments follow the visible rail. They block bodies, not sight.
    const n=Math.ceil(Math.hypot(a[0]-b[0],a[2]-b[2])/.2);
    for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[2]+(b[2]-a[2])*k/n;c.solid(x-.035,z-.035,x+.035,z+.035,{keep:true,tall:false});}
  };
  for(let i=0;i<SECTORS;i++) {
    const a=i*Math.PI*2/SECTORS,b=(i+1)*Math.PI*2/SECTORS;
    const row=p.patches[i];
    for(let j=0;j<row.length;j++) {
      const q=row[j],k=.5+Math.min(1,p.bands[j]/.78)*.5;
      face(p.bands[j]>=.78?deck:tile,q,{color:[k,k,k]});
      // Exposed stair risers and side cheeks are geometry, not texture tricks.
      if(j && Math.abs(q[0][1]-row[j-1][1][1])>.025)face(tile,[row[j-1][1],q[0],q[3],row[j-1][2]]);
      const prev=p.patches[(i+SECTORS-1)%SECTORS][j];
      if(Math.abs(prev[2][1]-q[1][1])>.03||Math.abs(prev[3][1]-q[0][1])>.03)face(tile,[prev[3],prev[2],q[1],q[0]]);
    }
    const entrance=Math.abs(Math.sin((a+b)/2))<.10;
    const loA=yAt(a,.999),loB=yAt(b,.999);
    if(!entrance)face(tile,[bellPoint(p,b,1,loB),bellPoint(p,a,1,loA),bellPoint(p,a,1,H),bellPoint(p,b,1,H)]);
    else face(tile,[bellPoint(p,b,1,2.35),bellPoint(p,a,1,2.35),bellPoint(p,a,1,H),bellPoint(p,b,1,H)]);
    face(green,[bellPoint(p,b,.998,3.55),bellPoint(p,a,.998,3.55),bellPoint(p,a,.998,3.72),bellPoint(p,b,.998,3.72)]);
    const tide=[bellPoint(p,b,.997,2.95),bellPoint(p,a,.997,2.95),bellPoint(p,a,.997,3.45),bellPoint(p,b,.997,3.45)];
    stain.quad(...tide,WHITE,[[0,1],[1,1],[1,0],[0,0]]);
    // Narrow drainage slots track the edge of the dry mosaic path.
    if(Math.abs(Math.sin((a+b)/2))>.25) {
      const q=[bellPoint(p,a,.805,yAt(a,.805)+.012),bellPoint(p,a,.815,yAt(a,.815)+.012),bellPoint(p,b,.815,yAt(b,.815)+.012),bellPoint(p,b,.805,yAt(b,.805)+.012)];
      c.flat.quad(...q,dark);
      for(let k=0;k<5;k++){
        const th=a+(b-a)*(k+.5)/5;beam(c.flat,bellPoint(p,th,.803,yAt(th,.81)+.027),bellPoint(p,th,.817,yAt(th,.81)+.027),.025,steel);
      }
    }
    // The inner edge protects the steep bowl; the paired stairs remain open.
    if(Math.abs(Math.sin((a+b)/2))>.25 && !(Math.sin((a+b)/2)>.9&&Math.abs(Math.cos((a+b)/2)*p.rz)<2.8))
      rail(bellPoint(p,a,.79,yAt(a,.79)),bellPoint(p,b,.79,yAt(b,.79)));
    // Ceiling steps upward toward the centre, instead of a dropped office lid.
    for(const [r0,r1,y0,y1] of [[0,.5,H+2.4,H+2.4],[.5,1,H+2.4,H]]) {
      face(tile,[bellPoint(p,b,r0,y0),bellPoint(p,b,r1,y1),bellPoint(p,a,r1,y1),bellPoint(p,a,r0,y0)],{repeat:2.4,color:lin('#c1c4b4')});
    }
  }
  // Two narrow service necks retain ordinary doors, carpet and ceiling scale.
  const carpet=c.mapped('bell:office-carpet',kit.tex.floor(c.look));
  for(const side of [-1,1]) {
    const z0=side<0?-D/2:p.rz-.3,z1=side<0?-p.rz+.3:D/2;
    tiledPlane(deck,-1.3,z0,1.3,z1,0);
    box(tile,-1.45,0,z0,-1.25,2.5,z1);box(tile,1.25,0,z0,1.45,2.5,z1);
    box(c.ceil,-1.45,2.35,z0,1.45,2.5,z1);
    if(side>0)tiledPlane(carpet,-1.23,D/2-1.7,1.23,D/2-.03,.006);
    c.light(0,2.15,side*(D/2-1),'#e5dfb6',.9,{far:5,k:2});
  }
  // Generated doors may arrive above this room's datum. Preserve their actual
  // authored stair treads rather than stepping through a raised threshold.
  for(const dr of c.room.doors)if(dr.sill>.01&&(dr.side==='front'||dr.side==='back')) {
    const n=Math.round(dr.sill/.1625),side=dr.side==='front'?1:-1;
    for(let i=0;i<n-1;i++){
      const y=dr.sill-(dr.sill/n)*(i+1),z=side*(D/2-i*.28);
      box(deck,dr.c-dr.w/2,0,Math.min(z,z-side*.28),dr.c+dr.w/2,y,Math.max(z,z-side*.28));
    }
  }
  // An enormous tiled rib swallows the gallery for several metres. Its lower
  // passage has real head clearance; the pool disappears behind the inner cheek.
  const bx=p.rx*.78;
  box(tile,bx,-1.4,-2.4,bx+.18,H,2.4);c.solid(bx,-2.4,bx+.18,2.4,{keep:true,tall:true});
  box(tile,bx,1.15,-2.4,p.rx+.03,H,2.4);
  box(green,bx-.018,3.55,-2.41,bx-.006,3.72,2.41);
  c.light(p.rx*.9,.75,0,'#9aa78c',.28,{far:3,k:.8});
  // The bottom is a shallow recoverable basin. A real grille closes the dark
  // throat: the player never stands on an invisible plane over a lethal pit.
  const water=bellWater(c,t.water,p);
  box(c.flat,-1.35,-3.56,-1.65,1.35,-3.55,1.65,lin('#06100c'));
  for(let x=-1.3;x<=1.3;x+=.13)box(c.flat,x,-3.545,-1.6,x+.045,-3.5,1.6,dark);
  for(const z of [-1.55,0,1.55])box(c.flat,-1.3,-3.50,z-.035,1.35,-3.46,z+.035,steel);
  // An unstaffed attendant recess occupies the opposite gallery. The desk's
  // feet meet the almost level low point of the rim, clear of the stair returns.
  const deskX=-p.rx*.91,deskY=bellFloor(p,deskX,0);
  officeDesk(c,deskX,0,deskY,false,Math.PI/2);
  box(tile,-p.rx,deskY, -1.6,-p.rx*.84,deskY+.42,-1.3);
  box(tile,-p.rx,deskY+2.3,-1.65,-p.rx*.83,deskY+2.5,1.65);
  const hatch=lin('#8b613c');box(c.flat,-p.rx+.05,deskY+.3,.9,-p.rx+.09,deskY+1.35,1.55,hatch);
  box(c.flat,-p.rx+.09,deskY+.8,1.4,-p.rx+.14,deskY+.94,1.47,steel);
  c.light(deskX,deskY+2.1,0,'#d4d6a9',.7,{far:3.5,k:1.4});
  c.board(c.mapped('bell:depth',t.marker),1.95,.65,p.rz*.93,.5,.25,Math.PI);
  // Familiar fluorescent fittings repeated around an excessive volume.
  const lamps=c.shining('bell:lamps',kit.tex.panel(true),1.35,lin('#e5e5c5'));
  for(let i=0;i<8;i++) {
    const a=(i+.5)*Math.PI*2/8,[x,,z]=bellPoint(p,a,.96,0),y=H-.75;
    box(c.flat,x-.18,y,z-.6,x+.18,y+.12,z+.6,steel);
    c.lay(lamps,x,z,.26,1.08,0,null,WHITE,y-.01,true);
    c.light(x,y-.2,z,'#dbe5c9',2.7,{far:16,k:18,axis:[0,-1,0],floor:.12});
  }
  for(const z of [-p.rz*.8,p.rz*.8])c.light(0,3,z,'#d7dfc0',1,{far:10,k:7});
  rt.footstep='stone';
  c.tick((dt,time,me)=>{
    water.phase.value=time*.12;
    const wet=me.inside&&bellFloor(p,me.x,me.z)<p.water;
    rt.footstep=wet?'wade':'stone';
    if(wet&&me.world)me.world.slow=Math.min(me.world.slow??1,.76);
  });
  rt.bellmouth={plan:p};
  finishPoolRoom(c,'bellmouth-baths');
}
