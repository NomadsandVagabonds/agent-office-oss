// One floor field, shared by the mesh and the walkers. No player-dependent
// layers: two visitors can take the dry and low routes at the same time.
export function changingPlan({W,D,H}) {
  const slabs=[1,0,-1].map((n,i)=>({
    x0:i===1?-W/2+3.6:-W/2,
    x1:i===1?W/2:W/2-3.6,
    z:n*(D/2-6),slot:[-2,2,-3][i],top:[H-.8,H+2.2,H-.35][i],liftSide:i===1?-1:1,
  }));
  const unique=a=>[...new Set(a)].sort((a,b)=>a-b);
  return {W,D,H,slabs,water:-.27,
    xs:unique([-W/2,W/2,...slabs.flatMap(s=>[s.x0,s.x0+.34,s.x0+.68,s.x1-.68,s.x1-.34,s.x1])]),
    zs:unique([-D/2,D/2,...slabs.flatMap(s=>[-1.65,-1.31,-.97,.97,1.31,1.65].map(d=>s.z+d))]),
  };
}
export function changingFloor(p,x,z) {
  for(const s of p.slabs) {
    const edge=Math.min(x-s.x0,s.x1-x,1.65-Math.abs(z-s.z));
    if(edge>0)return edge<.34?-.16:edge<.68?-.32:-.48;
  }
  return 0;
}
export function changingCeiling(p,x,z) {
  for(const s of p.slabs)if(x>=s.x0&&x<=s.x1&&Math.abs(z-s.z)<.8)
    return slabBottom(s,x);
  return Math.abs(z)>p.D/2-2.8?2.65:p.H;
}
export function slabBottom(s,x) {
  if(s.liftSide>0?x>s.x1-2.4:x<s.x0+2.4)return 2.45;
  return Math.abs(x-s.slot)<=1.25?.35:.10;
}
