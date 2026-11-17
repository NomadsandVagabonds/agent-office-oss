export function diveStudy(handle) {
  const tower=handle.world.rooms.find(room=>room.diving);
  const maze=handle.world.rooms.find(room=>room.smilerChase);
  if(!tower||!maze)return ()=>{};
  const panel=document.createElement('aside');
  panel.dataset.lightingStudy='';
  panel.style.cssText='position:fixed;top:12px;left:12px;z-index:100;padding:12px;background:#151d1bee;color:#f3e6cd;font:13px monospace;max-width:18em';
  const title=document.createElement('b');
  title.textContent='THE DIVING TOWER';
  panel.append(title);
  const button=(text,action)=>{
    const el=document.createElement('button');
    el.textContent=text;
    el.style.cssText='display:block;margin:8px 0;font:inherit';
    el.onclick=action;
    panel.append(el);
  };
  const go=(room,...args)=>{if(!tower.diving.getRide(handle.player.me))handle.goto(room.id,...args);};
  const {plan}=tower.diving;
  button('Towel return entrance',()=>go(maze,0,maze.def.D/2-1,0,0));
  button('Tower entrance',()=>go(tower,0,tower.def.D/2-1,0,-.18));
  button('Final platform',()=>go(tower,-1.62,-1.27,0,-1.14));
  button('Pool landing',()=>go(tower,plan.landing.x,plan.landing.z,-.70,.10));
  button('Hide controls',()=>{panel.hidden=true;});
  const note=document.createElement('p');
  note.textContent='Walk or run toward the lit edge to jump. H shows this panel.';
  panel.append(note);
  document.body.append(panel);
  const toggle=event=>{if(event.code==='KeyH')panel.hidden=!panel.hidden;};
  window.addEventListener('keydown',toggle);
  return()=>{panel.remove();window.removeEventListener('keydown',toggle);};
}
