// Review harness only: no imports from the live game page.
export function waterparkStudy(handle) {
  const el=document.createElement('aside');el.dataset.lightingStudy='';
  el.style.cssText='position:fixed;left:10px;top:10px;z-index:100;background:#122523ed;color:#e8f4da;padding:12px;font:13px monospace;width:215px;border:1px solid #9fb9af';
  const title=document.createElement('b');title.textContent='WATERPARK · WORKING TOUR';el.append(title);
  const links=document.createElement('div');el.append(links);
  const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='display:block;width:100%;font:inherit;margin:6px 0';b.onclick=fn;links.append(b);};
  let shown;
  function refresh(){
    shown=handle.level;links.replaceChildren();
    button('Start exploring',()=>handle.goto(handle.level.start.room));
    for(const rt of handle.world.rooms.filter(r=>r.def.kind==='special')){
      button(rt.def.title || rt.def.arch,()=>handle.goto(rt.id,0,rt.def.D/2-1.4,0,-.12));
      if(rt.flumeMaze){
        const b=rt.flumeMaze.bounds;
        button('Slide: boarding steps',()=>handle.goto(rt.id,-3,b.bz1+1.8,0,-.1));
        button('Slide: inside tube',()=>handle.goto(rt.id,-3,1.25,-Math.PI/2,0));
        button('Slide: far gallery',()=>handle.goto(rt.id,3,b.bz0-1.5,Math.PI,-.12));
        button('Slide: plunge platform',()=>handle.goto(rt.id,4.65,b.bz1+.4,0,-.22));
      }
    }
    button('Next part (review)',()=>handle.descend());
    button('Hide tour controls',()=>el.remove());
  }
  refresh();
  const note=document.createElement('p');note.textContent='WASD walk · mouse look · E use/move · C dive · Space surface. Health and battery run normally. Esc releases the mouse.';el.append(note);
  const status=document.createElement('p');el.append(status);document.body.append(el);
  const timer=setInterval(()=>{if(shown!==handle.level)refresh();const rt=handle.world.current();status.textContent=`${handle.level.rooms.length} rooms · ${rt?.def.arch || 'tiled corridors'}\n${rt?.flat?'ERROR: flattened geometry':'Geometry intact'}`;status.style.whiteSpace='pre-line';},300);
  return()=>{clearInterval(timer);el.remove();};
}
