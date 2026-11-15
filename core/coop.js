// Deliberately bounded co-op simulation. Pure; the server owns all mutations.
export const VERSION = 'blockrooms-coop-1';
export const CELL = 2.4;
export const MAP = [
'#############',
'#.....#.....#',
'#.....#.....#',
'###.###.###.#',
'#...........#',
'#.###.###.#.#',
'#...#.....#.#',
'#...#.....#.#',
'#############',
];
export const spot = (x,z) => ({x:(x+.5)*CELL,z:(z+.5)*CELL});
export const EXIT = spot(11,7);
export function free(x,z,r=.23) {
  return [-r,r].every(dx => [-r,r].every(dz => MAP[Math.floor((z+dz)/CELL)]?.[Math.floor((x+dx)/CELL)] === '.'));
}
export function los(a,b) {
  const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.12);
  for(let i=1;i<=n;i++) if(!free(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,0)) return false;
  return true;
}
export function watched(p,b) {
  const dx=b.x-p.x,dz=b.z-p.z,d=Math.hypot(dx,dz);
  return p.health>0 && Math.abs(p.pitch)<.85 && d<24 && (-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/Math.max(.001,d)>.65 && los(p,b);
}
export function createSession() {
  return {version:VERSION,phase:'waiting',time:0,players:[],pirate:{...spot(9,6),yaw:0,frozen:false,target:null},items:[
    ['battery',2,2],['snack',4,2],['battery',8,2],['snack',2,7],['battery',9,7]
  ].map(([type,x,z],i)=>({id:`supply-${i}`,type,...spot(x,z),owner:null}))};
}
export function join(s,id) {
  if(s.phase!=='waiting'||s.players.length>=2||s.players.some(p=>p.id===id))return null;
  const p={id,...spot(1+s.players.length,1),yaw:Math.PI,pitch:0,health:4,battery:300,bag:[],ready:false,cooldown:0,input:{f:0,s:0},inputAge:0};
  s.players.push(p); return p;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function act(s,id,m) {
  const p=s.players.find(p=>p.id===id); if(!p||!m||typeof m!=='object')return false;
  if(m.type==='ready'&&s.phase==='waiting') {p.ready=true;if(s.players.length===2&&s.players.every(p=>p.ready))s.phase='play';return true;}
  if(s.phase!=='play'||p.health<=0)return false;
  if(m.type==='input') {
    if(![m.f,m.s,m.yaw,m.pitch].every(Number.isFinite))return false;
    p.input={f:Math.max(-1,Math.min(1,m.f)),s:Math.max(-1,Math.min(1,m.s)),run:m.run===true};
    p.yaw=m.yaw%(Math.PI*2);p.pitch=Math.max(-1.2,Math.min(1.2,m.pitch));p.inputAge=0;return true;
  }
  if(m.type==='take') {
    const item=s.items.find(i=>i.id===m.id);
    if(!item||item.owner!==null||p.bag.length>=6||distance(p,item)>1.5||!los(p,item))return false;
    item.owner=id;p.bag.push(item.id);return true;
  }
  if(m.type==='use'||m.type==='drop') {
    const i=s.items.find(i=>i.id===m.id&&i.owner===id);if(!i)return false;
    if(m.type==='drop') {i.owner=null;i.x=p.x;i.z=p.z;}
    else if(i.type==='battery'&&p.battery<400){p.battery=Math.min(400,p.battery+120);i.owner='used';}
    else if(i.type==='snack'&&p.health<4){p.health++;i.owner='used';}
    else return false;
    p.bag=p.bag.filter(id=>id!==i.id);return true;
  }
  if(m.type==='exit'&&distance(p,EXIT)<1.6) {
    const alive=s.players.filter(p=>p.health>0);
    if(alive.every(p=>distance(p,EXIT)<2.5)){s.phase='escaped';return true;}
  }
  return false;
}
function move(p,dx,dz) {
  if(free(p.x+dx,p.z))p.x+=dx;
  if(free(p.x,p.z+dz))p.z+=dz;
}
// Grid BFS only chooses a route; continuous collision still checks every step.
export function nextStep(a,b) {
  const start=[Math.floor(a.x/CELL),Math.floor(a.z/CELL)],goal=[Math.floor(b.x/CELL),Math.floor(b.z/CELL)];
  if(start.join()===goal.join())return b;
  const queue=[start],prev=new Map([[start.join(),null]]);
  for(let n=0;n<queue.length;n++) {
    const cell=queue[n];if(cell.join()===goal.join())break;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const c=[cell[0]+dx,cell[1]+dz],key=c.join();
      if(MAP[c[1]]?.[c[0]]==='.'&&!prev.has(key)){prev.set(key,cell);queue.push(c);}
    }
  }
  if(!prev.has(goal.join()))return a;
  let c=goal;while(prev.get(c.join())?.join()!==start.join())c=prev.get(c.join());
  // Reach the current cell centre before rounding a blocked corner.
  const target=spot(...c);return los(a,target)?target:spot(...start);
}
export function tick(s,dt) {
  if(s.phase!=='play')return;
  dt=Math.max(0,Math.min(.05,dt));s.time+=dt;
  for(const p of s.players) {
    p.cooldown=Math.max(0,p.cooldown-dt);if(p.health<=0)continue;
    p.battery=Math.max(0,p.battery-dt);if(!p.battery){p.health=0;continue;}
    p.inputAge+=dt;if(p.inputAge>.25)continue;
    const {f,s:side,run}=p.input,n=Math.max(1,Math.hypot(f,side)),speed=(run?3.7:2.05)*dt/n;
    move(p,(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*side)*speed,(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*side)*speed);
  }
  const alive=s.players.filter(p=>p.health>0);if(!alive.length){s.phase='dead';return;}
  const b=s.pirate,target=alive.reduce((a,p)=>distance(p,b)<distance(a,b)?p:a);
  b.target=target.id;b.frozen=alive.some(p=>watched(p,b));
  if(s.time>8&&!b.frozen) {
    const step=nextStep(b,target),d=distance(b,step),speed=Math.min(d,1.85*dt);
    if(d>.001){const dx=(step.x-b.x)/d,dz=(step.z-b.z)/d;move(b,dx*speed,dz*speed);b.yaw=Math.atan2(dx,dz);}
  }
  if(s.time>8) for(const p of alive)if(distance(p,b)<.85&&los(p,b)&&!p.cooldown){p.health=Math.max(0,p.health-2);p.cooldown=3;}
  if(s.players.every(p=>p.health<=0))s.phase='dead';
}
export const snapshot=s=>JSON.parse(JSON.stringify(s));
