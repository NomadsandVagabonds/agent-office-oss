// Developer-only repeatable encounter. Not imported by the production entry point.
import * as THREE from 'three';
import { createStalkers } from '../backrooms/pursuer.js';
export function tonerStudy(handle) {
  const rt=handle.world.current();
  handle.setSetting('difficulty','tourist');
  handle.env.pursuer?.dispose();
  createStalkers(handle.env,{members:['toner']});
  const toner=handle.env.pursuer.of('toner');toner.ready();
  const el=document.createElement('aside');el.dataset.lightingStudy='';
  el.style.cssText='position:fixed;left:10px;top:10px;z-index:100;background:#111e;color:#eee;padding:14px;font:13px monospace;max-width:290px';
  el.innerHTML='<b>TONER · STALKING STUDY</b><p>Damage OFF. Watch the wall circuit, pause and jump. WASD / mouse to evade.</p>';
  const status=document.createElement('pre');
  const modes=new Set();let starts=0;
  const button=(text,fn)=>{const b=document.createElement('button');b.textContent=text;b.onclick=fn;b.style.cssText='display:block;margin:8px 0';el.append(b);};
  button('Start stalking encounter',()=>{
    handle.goto(rt.id,0,rt.def.D/2-1.5,0,-.15);
    const pos=rt.group.localToWorld(new THREE.Vector3(-rt.def.W/2+.6,0,-rt.def.D/2+1));
    toner.hurry({x:pos.x,z:pos.z,chase:true});modes.clear();starts++;
  });
  let damage=false;
  button('Toggle damage',()=>{damage=!damage;handle.setSetting('difficulty',damage?'easy':'tourist');});
  el.append(status);document.body.append(el);
  const timer=setInterval(()=>{const a=toner.at();if(a)modes.add(a.mode);status.textContent=JSON.stringify({damage,starts,modes:[...modes],toner:a?{mode:a.mode,x:a.x,y:a.y,z:a.z,hits:a.hits}:null},null,2);},200);
  return ()=>{clearInterval(timer);el.remove();};
}
