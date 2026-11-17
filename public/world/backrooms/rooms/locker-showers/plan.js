// Construction and navigation share the same bench, steps and flooded floor.
export function showerPlan({W,D,H}) {
  const end=D/2-3;
  const path=[[0,end],[0,6],[1.65,6],[1.65,1],[-1.25,1],[-1.25,-4],[.8,-4],[.8,-end]];
  const spans=path.slice(1).map((b,i)=>{const a=path[i];return {x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1])};});
  return {W,D,H,end,path,spans,wetLeft:-3.35,wetRight:3.9,water:-.12,depth:.32,bench:.16,half:.7,
    folds:[{x:7,z:-5.8,dir:-1,to:-7.45},{x:-7.45,z:-5.8,dir:1,to:7}]};
}
export function benchDistance(p,x,z) {
  return Math.min(...p.spans.map(a=>Math.max(a.x0-x,x-a.x1,a.z0-z,z-a.z1,0)));
}
export function showerFloor(p,x,z) {
  if(x<=p.wetLeft||x>=p.wetRight||Math.abs(z)>=p.end+.8)return 0;
  const bank=Math.min(x-p.wetLeft,p.wetRight-x,p.end+.8-Math.abs(z));
  const d=benchDistance(p,x,z);
  return Math.max(bank<.3?-.16:-p.depth,d<=p.half?p.bench:d<=p.half+.23?0:d<=p.half+.46?-.16:-p.depth);
}
export function showerCeiling(p,x,z) {
  if(Math.abs(z)>p.D/2-2)return 2.65;
  if(x>4.8||x< -6.55)return 2.65;
  if(x< -4.2)return p.H;
  return z>6?4.8:z>2?4.45:z> -2?4.1:z> -6?3.7:3.1;
}
export function showerCuts(p) {
  const xs=[-p.W/2,p.W/2,p.wetLeft,p.wetLeft+.3,p.wetRight-.3,p.wetRight],zs=[-p.D/2,p.D/2,-p.end-.8,-p.end-.5,p.end+.5,p.end+.8];
  for(const a of p.spans)for(const r of [p.half,p.half+.23,p.half+.46]) {
    xs.push(a.x0-r,a.x1+r);zs.push(a.z0-r,a.z1+r);
  }
  const clean=a=>[...new Set(a.map(v=>+v.toFixed(5)))].sort((a,b)=>a-b);
  return {xs:clean(xs),zs:clean(zs)};
}
export function foldCrossing(fold,previous,current) {
  if(!previous||Math.abs(current.x-fold.x)>.83||Math.abs(previous.x-fold.x)>1.1)return null;
  if(Math.hypot(current.x-previous.x,current.z-previous.z)>.65)return null;
  const crossed=fold.dir<0?previous.z>=fold.z&&current.z<fold.z:previous.z<=fold.z&&current.z>fold.z;
  return crossed?{x:current.x+fold.to-fold.x,z:current.z}:null;
}
