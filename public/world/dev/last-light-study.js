// Dev-only rehearsal controls. All behavior still runs through the room,
// inventory, lighting and collision code used by a normal visit.
import {makeItem} from '../backrooms/inventory-state.js';
import {toLocal} from '../backrooms/gen.js';
export function lastLightStudy(handle){
  const world=handle.world, rt=world.rooms.find(r=>r.lastLight);
  if(!rt)return ()=>{};
  const {actor,layout}=rt.lastLight, el=document.createElement('aside');el.dataset.lightingStudy='';
  Object.assign(el.style,{position:'fixed',left:'12px',top:'12px',zIndex:'100',background:'#101412e8',color:'#e8ebd8',padding:'14px',display:'grid',gap:'8px',font:'12px monospace',width:'210px'});
  const title=document.createElement('strong');title.textContent='LAST LIGHT · LOCAL STUDY';el.append(title);
  const button=(name,action)=>{const b=document.createElement('button');b.textContent=name;b.onclick=action;el.append(b);};
  button('Entrance',()=>handle.goto(rt.id,0,layout.front-1.1,0));
  button('Enter corridor',()=>handle.goto(rt.id,0,layout.trigger-.6,0));
  button('Face creature',()=>{
    const me=handle.player.me,p=toLocal(rt.def,me.x,me.z);
    handle.goto(rt.id,p.x,p.z,Math.atan2(p.x-actor.x,p.z-actor.z),0);
  });
  button('Look away',()=>{handle.player.me.yaw+=Math.PI;});
  button('Aim at ceiling',()=>{handle.player.me.pitch=1.2;});
  button('Flashlight on / off',()=>{
    const bag=handle.inventory;if(!bag)return;
    let i=bag.model.read().slots.findIndex(item=>item?.type==='torch');
    if(i<0){const added=bag.give(makeItem('torch','last-light-study'));if(!added.ok)return;i=added.index;}
    bag.select(i);bag.toggleLight();
  });
  // Three views of the same wall, outside the encounter trigger. The wall's
  // pattern provides a world-scale reference for the beam footprint.
  const wall=(distance,yaw=Math.PI/2)=>{
    handle.goto(rt.id,-rt.def.W/2+distance,layout.front-2.2,yaw,0);
    rt.lighting.preview='outage';
  };
  button('Beam · near wall',()=>wall(.55));
  button('Beam · far wall',()=>wall(rt.def.W-1));
  button('Beam · grazing wall',()=>wall(.9,.35));
  const read=document.createElement('output');el.append(read);
  const note=document.createElement('span');note.textContent='The entrance has a real charged torch. These controls are only for review. Reload for a fresh encounter.';el.append(note);
  const timer=setInterval(()=>{
    if(handle.world!==world){read.textContent='Floor changed. Reload for this study.';for(const b of el.querySelectorAll('button'))b.disabled=true;return;}
    const s=rt.lastLight.state,p=toLocal(rt.def,handle.player.me.x,handle.player.me.z);
    read.textContent=`${s.phase} · ${s.frozen?'held in beam':'not in beam'}\nDistance ${Math.hypot(p.x-actor.x,p.z-actor.z).toFixed(1)} m\nYou ${p.x.toFixed(1)}, ${p.z.toFixed(1)} · it ${actor.x.toFixed(1)}, ${actor.z.toFixed(1)}\nBanks ${rt.lightLevels.map(k=>Math.round(k*100)+'%').join(' / ')}`;
    read.style.whiteSpace='pre-line';
  },200);
  document.body.append(el);handle.goto(rt.id,0,layout.front-1.1,0);
  return ()=>{clearInterval(timer);el.remove();};
}
