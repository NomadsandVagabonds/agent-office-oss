// Review controls only. Production never imports this module.
import { toLocal } from '../backrooms/frame.js';
export function returnPoolStudy(handle) {
  const rt=handle.world.rooms.find(r=>r.def.arch==='return-pool');
  if(!rt?.returnPool)return()=>{};
  const p=rt.returnPool.plan, el=document.createElement('aside');el.dataset.lightingStudy='';
  el.style.cssText='position:fixed;top:10px;left:10px;z-index:100;background:#101d19e8;color:#dce8cc;padding:14px;font:13px monospace;width:240px;border:1px solid #7b9580';
  const title=document.createElement('b');title.textContent='THE RETURN POOL · STUDY';el.append(title);
  const button=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='display:block;margin:7px 0;width:100%;font:inherit';b.onclick=action;el.append(b);};
  const go=(x,z,yaw=0,pitch=0)=>handle.goto(rt.id,x,z,yaw,pitch);
  button('Entrance view',()=>go(-1.7,rt.def.D/2-2.6,0,.12));
  button('Look up at the other pool',()=>go(3.7,3.7,.7,.65));
  button('Walk through return tunnel',()=>go(p.fold.x,p.fold.z+.85,0,0));
  button('Stand by circulation valve',()=>go(p.valve.x+.5,p.valve.z+.8,.55,-.15));
  button('Turn valve (same as E)',()=>{
    const me=handle.player.me, local=toLocal(rt.def,me.x,me.z);
    if(local && Math.hypot(local.x-p.valve.x,local.z-p.valve.z-.35)<1.1)rt.returnPool.valve.use();
  });
  button('Stand on dry refuge',()=>go(0,p.island.z,0,-.1));
  button('Enter water / test attack',()=>go(.65,-.5,0,-.35));
  button('Restart',()=>location.reload());
  const note=document.createElement('p');note.textContent='Walk with WASD. E turns the wheel. The water follows you; the tiled edges are safe. Damage is real. Three turns break the return.';el.append(note);
  const status=document.createElement('p');el.append(status);document.body.append(el);
  go(-1.7,rt.def.D/2-2.6,0,.12);
  const timer=setInterval(()=>{
    const s=rt.returnPool.state;status.textContent=`Valve ${s.turns}/3 · ${s.turns===3?'RETURN OPEN':'LOOPING'} · laps ${s.laps}\nWater ${s.phase} · hearts ${handle.health?.read().current}\n${rt.flat?'ERROR: room flattened':'Geometry intact'}`;
    status.style.whiteSpace='pre-line';
  },150);
  return()=>{clearInterval(timer);el.remove();};
}
