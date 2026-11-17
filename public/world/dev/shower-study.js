// Dev-only camera positions. This is not imported by the public game.
export function showerStudy(handle){
 const rt=handle.world.rooms.find(r=>r.showerFold);if(!rt)return()=>{};
 const el=document.createElement('aside');el.dataset.lightingStudy='';el.style.cssText='position:fixed;left:10px;top:10px;z-index:100;background:#26252be8;color:#efe3d4;padding:12px;font:12px monospace;width:205px';
 const title=document.createElement('b');title.textContent='THE OTHER CHANGING ROOM';el.append(title);
 const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='display:block;width:100%;margin:7px 0;font:inherit';b.onclick=fn;el.append(b);};
 const go=(...a)=>handle.goto(rt.id,...a);
 for(const [name,args]of [['Entrance',[0,10.6,0,.04]],['Across the changing room',[2.8,9.8,.45,.18]],['Bench route',[.1,8.8,-.08,.02]],['Showers and ceiling',[-2.4,7.1,.9,.3]],['Locker passage',[3.3,6.0,-1.4,.02]],['Inside the locker',[7,3.7,0,0]],['Fold approach',[7,-4.95,0,0]],['Other shower',[-7.45,-7.0,0,0]],['Reverse sightline',[0,-9.4,Math.PI,.05]]])button(name,()=>go(...args));
 button('Hide panel',()=>el.hidden=true);
 const state=document.createElement('p');el.append(state);document.body.append(el);
 const timer=setInterval(()=>{state.textContent=`Crossings ${rt.showerFold.folds} · blocked ${rt.showerFold.blocked}\nWalk into the locker and follow the cold corridor. H shows this panel.`;},200);
 const hide=e=>{if(e.code==='KeyH')el.hidden=!el.hidden;};window.addEventListener('keydown',hide);go(0,10.6,0,.04);
 return()=>{clearInterval(timer);el.remove();window.removeEventListener('keydown',hide);};
}
