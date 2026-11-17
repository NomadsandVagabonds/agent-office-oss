// A repeatable art review, deliberately outside the shipped entry point.
const ROOMS=['hanging-changing','bellmouth-baths','slide-maze','return-pool','wave-pool','lazy-river','deep-end','whirlpool-flume','kiddie-lagoon','locker-showers'];
export function poolFinishStudy(handle){
  const id=new URLSearchParams(location.search).get('room'),rt=handle.world.rooms.find(r=>r.def.arch===id);
  if(!rt?.poolFinish)return()=>{};
  const {W,D}=rt.def,el=document.createElement('aside');el.dataset.lightingStudy='';
  el.style.cssText='position:fixed;top:10px;left:10px;z-index:100;background:#16201de8;color:#e3e3ca;padding:12px;font:12px monospace;width:214px';
  const title=document.createElement('b');title.textContent='AQUATICS · CONSTRUCTION PASS';el.append(title);
  const select=document.createElement('select');select.style.cssText='display:block;width:100%;margin:10px 0;font:inherit';
  for(const room of ROOMS){const o=document.createElement('option');o.value=room;o.textContent=room;o.selected=room===id;select.append(o);}
  select.onchange=()=>{const q=new URLSearchParams(location.search);q.set('room',select.value);q.set('only',select.value);location.search=q.toString();};el.append(select);
  const go=(x,z,yaw=0,pitch=0)=>handle.goto(rt.id,x,z,yaw,pitch);
  const views=id==='bellmouth-baths'?[[0,D/2-1,0,.12],[rt.bellmouth.plan.rx*.8,4,Math.PI/2,.22],[-rt.bellmouth.plan.rx*.8,-4,-Math.PI/2,.18]]:
    id==='hanging-changing'?[[-4,D/2-1.7,-.7,0],[8.3,9.5,.8,.22],[7.8,3.3,.9,.1]]:
    id==='return-pool'?[[0,D/2-2,0,.1],[-W/2+1.4,5.6,-.7,.12],[W/2-1.2,-D/2+2,2.5,.12]]:
    id==='locker-showers'?[[2.75*(rt.def.params?.lockerSide||1),4.65,0,.12],[-W/2+1,D/2-1,-.55,.12],[0,0,-.6,.05]]:
    id==='slide-maze'?[[0,D/2-1.1,0,.08],[-W/2+2.1,D/2-2,-.55,.12],[W/2-1.1,-D/2+1.1,2.6,.08]]:
    [[0,D/2-1.1,0,.08],[-W/2+1.1,D/2-1.1,-.55,.12],[W/2-1.1,-D/2+1.1,2.6,.08]];
  for(const [i,name]of ['Entrance','Poolside','Reverse view'].entries()){
    const b=document.createElement('button');b.textContent=name;b.style.cssText='display:block;width:100%;margin:7px 0;font:inherit';b.onclick=()=>go(...views[i]);el.append(b);
  }
  const bathers=[];rt.group.traverse(g=>{if(g.name==='inverted-bather')bathers.push(g);});
  if(bathers.length){
    const b=document.createElement('button');b.textContent='Bather close-up';b.style.cssText='display:block;width:100%;margin:7px 0;font:inherit';
    b.onclick=()=>{const g=bathers.reduce((a,b)=>a.position.z>b.position.z?a:b);go(g.position.x,g.position.z+1.5,0,-.27);};el.append(b);
  }
  const toggle=document.createElement('button');toggle.textContent='Detail: on';toggle.style.cssText='display:block;width:100%;margin:7px 0;font:inherit';
  toggle.onclick=()=>{rt.poolFinish.group.visible=!rt.poolFinish.group.visible;toggle.textContent='Detail: '+(rt.poolFinish.group.visible?'on':'off');};el.append(toggle);
  const cost={base:0,detail:0,meshes:0};rt.group.traverse(o=>{if(o.isMesh){cost[o.userData.detail?'detail':'base']+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;cost.meshes++;}});
  const note=document.createElement('p');note.textContent=`${cost.base.toLocaleString()} base + ${cost.detail.toLocaleString()} detail triangles · ${cost.meshes} meshes · ${rt.lights.length} lights. H hides controls. Walk normally to inspect. Water/renderer upgrades pending.`;el.append(note);document.body.append(el);
  const hide=e=>{if(e.code==='KeyH')el.hidden=!el.hidden;};window.addEventListener('keydown',hide);go(...views[0]);
  return()=>{el.remove();window.removeEventListener('keydown',hide);};
}
