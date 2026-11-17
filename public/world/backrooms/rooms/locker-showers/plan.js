// Construction and navigation share the same bench, steps and flooded floor.
export function showerPlan({W,D,H}) {
  const end=D/2-3;
  const path=[[0,end],[0,6],[1.65,6],[1.65,1],[-1.25,1],[-1.25,-4],[.8,-4],[.8,-end]];
  const spans=path.slice(1).map((b,i)=>{const a=path[i];return {x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1])};});
  const seam = { z0: -6.95, z1: -4.65, half: .54, head: .89 };
  const locker = { x: 7, min: 5.49, max: W / 2 };
  // Leave the perimeter lane clear for a generated doorway in the left wall.
  const shower = { x: -7.45, min: -W / 2 + .65, max: -6.55 };
  const cells = [
    ...[
      [3.15, 4.65, -.10, 1.18, 2.32],
      [1.40, 3.15, .13, .95, 1.98],
      [-.50, 1.40, -.09, .77, 1.62],
      [-2.35, -.50, .07, .66, 1.33],
      [seam.z1, -2.35, -.04, .59, 1.13],
    ].map(([z0, z1, offset, half, head]) => ({
      ...locker, x: locker.x + offset, z0, z1, half, head,
    })),
    { ...locker, ...seam },
    { ...shower, ...seam },
    { ...shower, z0: -8.72, z1: seam.z0, half: .73, head: 1.31 },
  ];
  return {W,D,H,end,path,spans,wetLeft:-3.35,wetRight:3.9,water:-.12,depth:.32,bench:.16,half:.7,
    cells, folds: [
      { x: locker.x, z: -5.8, dir: -1, to: shower.x, half: seam.half, head: seam.head },
      { x: shower.x, z: -5.8, dir: 1, to: locker.x, half: seam.half, head: seam.head },
    ]};
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
  if(x>4.8||x< -6.55) {
    const cell = p.cells.find(a => x >= a.x - a.half && x <= a.x + a.half && z >= a.z0 && z < a.z1);
    return cell?.head ?? 2.65;
  }
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
  if(!previous||Math.abs(current.x-fold.x)>fold.half||Math.abs(previous.x-fold.x)>fold.half)return null;
  if(Math.hypot(current.x-previous.x,current.z-previous.z)>.65)return null;
  const crossed=fold.dir<0?previous.z>=fold.z&&current.z<fold.z:previous.z<=fold.z&&current.z>fold.z;
  return crossed?{x:current.x+fold.to-fold.x,z:current.z}:null;
}
