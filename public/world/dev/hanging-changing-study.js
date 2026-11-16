// Local review only; the public entry point never imports this panel.
export function changingStudy(handle) {
  const rt=handle.world.rooms.find(r=>r.def.arch==='hanging-changing');
  if(!rt?.changing)return()=>{};
  const p=rt.changing.plan,el=document.createElement('aside');el.dataset.lightingStudy='';
  el.style.cssText='position:fixed;top:10px;left:10px;z-index:100;background:#16201de8;color:#e3e3ca;padding:12px;font:12px monospace;width:220px';
  el.innerHTML='<b>HANGING CHANGING · STUDY</b>';
  const go=(x,z,yaw=0,pitch=0)=>handle.goto(rt.id,x,z,yaw,pitch);
  for(const [name,args] of [
    ['First changing bay',[-4,p.D/2-1.7,-.7,0]],
    ['Hanging wall reveal',[8.3,9.5,.8,.22]],
    ['Shallow shortcut',[-2,8.5,0,-.1]],
    ['Repeated middle bay',[7.8,3.3,.9,.1]],
    ['Under the wall',[-2,7,0,0]],
    ['Far changing bay',[0,-p.D/2+2.1,0,0]],
  ]) {const b=document.createElement('button');b.textContent=name;b.style.cssText='display:block;width:100%;margin:7px 0;font:inherit';b.onclick=()=>go(...args);el.append(b);}
  const note=document.createElement('p');note.textContent='Walk around each wall, or duck through its wider slot. Every channel has shallow return steps. Grab the towel cart normally. No encounter in this room. H hides these controls.';el.append(note);document.body.append(el);
  const hide=e=>{if(e.code==='KeyH')el.hidden=!el.hidden;};window.addEventListener('keydown',hide);
  go(-4,p.D/2-1.7,-.7,0);
  return()=>{el.remove();window.removeEventListener('keydown',hide);};
}
