// Local authoring controls, never imported by the public game's entry point.
export function bellmouthStudy(handle) {
  const rt=handle.world.rooms.find(r=>r.def.arch==='bellmouth-baths');
  if(!rt?.bellmouth)return()=>{};
  const p=rt.bellmouth.plan,el=document.createElement('aside');el.dataset.lightingStudy='';
  el.style.cssText='position:fixed;top:10px;left:10px;z-index:100;background:#16201de8;color:#e3e3ca;padding:12px;font:12px monospace;width:220px';
  el.innerHTML='<b>BELLMOUTH BATHS · STUDY</b>';
  const go=(x,z,yaw=0,pitch=0)=>handle.goto(rt.id,x,z,yaw,pitch);
  for(const [name,args] of [
    ['Entry threshold',[0,p.rz-.65,0,-.14]],
    ['Crescent gallery',[p.rx*.88,p.rz*.22,.9,-.12]],
    ['Under the buttress',[p.rx*.89,0,0,0]],
    ['Water / return stairs',[0,p.rz*.34,Math.PI,-.1]],
    ['Far doorway',[0,-p.rz+.7,Math.PI,-.16]],
  ]){const b=document.createElement('button');b.textContent=name;b.style.cssText='display:block;width:100%;margin:7px 0;font:inherit';b.onclick=()=>go(...args);el.append(b);}
  const note=document.createElement('p');note.textContent='Empty by design. Walk the rim in either direction. Both wide stairs return from the shallow basin. H hides this study panel.';el.append(note);document.body.append(el);
  const hide=e=>{if(e.code==='KeyH')el.hidden=!el.hidden;};window.addEventListener('keydown',hide);
  go(0,p.rz-.65,0,-.14);
  return()=>{el.remove();window.removeEventListener('keydown',hide);};
}
