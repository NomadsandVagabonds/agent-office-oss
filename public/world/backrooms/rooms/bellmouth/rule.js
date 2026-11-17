// One height field shared by the visible facets, the player and navigation.
// No camera rides, room-wide layer switches or hidden teleport exits.
export const SECTORS = 60;
const TAU = Math.PI * 2, clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export function bellPoint(p, angle, radius=1, y=0) {
  return [Math.sin(angle)*p.rx*radius,y,Math.cos(angle)*p.rz*radius];
}
const gallery = a => -1.28*Math.sin(a)**2;
const bowl = (a,r) => r<.4 ? -3.55+clamp((r-.25)/.15,0,1)*.35
  : r<.78 ? -3.2+(gallery(a)+3.2)*(r-.4)/.38 : gallery(a);
const stairSector = i => i<2 || i>=SECTORS-2 || Math.abs(i-SECTORS/2+.5)<2;

export function bellPlan({W,D,H}) {
  const p={rx:W/2-2,rz:D/2-3,W,D,H,water:-3.08,bands:[0,.25,.4],patches:[]};
  for(let j=1;j<=20;j++)p.bands.push(.4+j*.024);
  p.bands.push(.94,1);
  for(let i=0;i<SECTORS;i++) {
    const a=i*TAU/SECTORS,b=(i+1)*TAU/SECTORS, patches=[];
    for(let j=0;j<p.bands.length-1;j++) {
      const r0=p.bands[j],r1=p.bands[j+1], stair=stairSector(i)&&r0>=.4-1e-6&&r1<=.88+1e-6;
      const y=stair ? -3.2+Math.round((r1-.4)/.024)*.16 : null;
      patches.push([bellPoint(p,a,r0,y??bowl(a,r0)),bellPoint(p,a,r1,y??bowl(a,r1)),
        bellPoint(p,b,r1,y??bowl(b,r1)),bellPoint(p,b,r0,y??bowl(b,r0))]);
    }
    p.patches.push(patches);
  }
  return p;
}
export function bellPolar(p,x,z) {
  const a=(Math.atan2(x/p.rx,z/p.rz)+TAU)%TAU,i=Math.min(SECTORS-1,Math.floor(a/TAU*SECTORS));
  const da=TAU/SECTORS,mid=(i+.5)*da;
  // Radius against the actual polygon chord, rather than an invisible ellipse.
  const r=Math.hypot(x/p.rx,z/p.rz)*Math.cos(a-mid)/Math.cos(da/2);
  return {i,r,a};
}
function height(a,b,c,x,z) {
  const det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(det)<1e-12)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;
  return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7 ? a[1]*u+b[1]*v+c[1]*(1-u-v) : null;
}
export function bellFloor(p,x,z) {
  const {i,r}=bellPolar(p,x,z);
  if(r>=1)return 0;
  if(r<.25)return -3.55;
  const j=p.bands.findIndex((v,k)=>k<p.bands.length-1 && r<p.bands[k+1]);
  const [a,b,c,d]=p.patches[i][Math.max(0,j)];
  return height(a,b,c,x,z)??height(a,c,d,x,z)??b[1];
}
export function bellInside(p,x,z,radius=0) {
  if(Math.abs(x)>p.W/2-radius||Math.abs(z)>p.D/2)return false;
  // The two ordinary service passages overlap the bowl; no seam to snag on.
  if(Math.abs(x)<1.25-radius && Math.abs(z)>p.rz-.5)return true;
  const a=bellPolar(p,x,z).r;
  return a+radius/Math.min(p.rx,p.rz)<1;
}
export function bellHead(p,x,z) {
  const floor=bellFloor(p,x,z);
  if(Math.abs(x)<1.4&&Math.abs(z)>p.rz-.5)return 2.35-floor;
  if(x>p.rx*.78&&Math.abs(z)<2.4)return 1.15-floor;
  return p.H-floor;
}
