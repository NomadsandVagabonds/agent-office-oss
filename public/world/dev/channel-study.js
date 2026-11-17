// Dev only: the public game never imports the room inspection controls.
export function channelStudy(handle){
 const rt=handle.world.rooms.find(r=>r.channelHall||r.thresholds);if(!rt)return()=>{};
 const el=document.createElement('aside');el.dataset.lightingStudy='';el.style.cssText='position:fixed;top:10px;left:10px;z-index:100;background:#16201ded;color:#e2e1c9;padding:12px;font:12px monospace;width:222px';
 const title=document.createElement('b');title.textContent=rt.channelHall?'THE LANE ARCHIVE':'THE NARROWING BAYS';el.append(title);
 const button=(name,fn)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='display:block;width:100%;margin:7px 0;font:inherit';b.onclick=fn;el.append(b);};
 const go=(x,z,yaw=0,pitch=0)=>handle.goto(rt.id,x,z,yaw,pitch),{D}=rt.def;
 const views=rt.channelHall?[['Entrance',0,D/2-3.4,0,.15],['Stacked galleries',-4.9,5,-.55,.46],['Pump',-7.2,D/2-3.8,0,-.24],['Wet crossing',0,2,0,-.12],['Supply plinth',0,-2.8,Math.PI,-.08]]:
  [['Entrance',0,D/2-2.9,0,-.04],['Low frame',0,-D/2+6.2,0,-.2],['Side passage',3.6,D/2-2,0,0],['Reverse view',0,-D/2+1.5,Math.PI,0]];
 views.forEach(([name,...v])=>button(name,()=>go(...v)));
 if(rt.channelHall)button('Inspect swimmer',()=>{const s=rt.channelHall.state;go(s.x,s.z+1.7,0,-.18);});
 button(rt.channelHall?'Open quiet connector':'Open channel hall',()=>{const q=new URLSearchParams(location.search),id=rt.channelHall?'nested-thresholds':'channel-hall';q.set('room',id);q.set('only',id);location.search=q.toString();});
 const note=document.createElement('p');note.textContent=rt.channelHall?'Walk normally; E at the pump. Splashing attracts the swimmer. Stand still to settle it, or stay on the dry banks. The plinth holds the seeded supply.':'Repeated frames grow lower. The side passage rejoins at both ends. No resident or trigger.';el.append(note);
 const status=document.createElement('p');el.append(status);document.body.append(el);
 const timer=setInterval(()=>{const s=rt.channelHall?.state;status.textContent=s?`${s.phase} · pump ${Math.ceil(s.pump)}s · reset ${Math.ceil(s.cooldown)}s\nHealth ${handle.health?.read().current??'off'} · H hides controls`:'H hides controls';},150);
 const hide=e=>{if(e.code==='KeyH')el.hidden=!el.hidden;};window.addEventListener('keydown',hide);go(...views[0].slice(1));
 return()=>{clearInterval(timer);el.remove();window.removeEventListener('keydown',hide);};
}
