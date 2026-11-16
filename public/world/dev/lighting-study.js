// A local review aid, never included in the public game's entry point.
import { makeItem } from '../backrooms/inventory-state.js';
import { LIGHTING_MODES } from '../backrooms/lighting.js';
import { toWorld } from '../backrooms/gen.js';

export function lightingStudy(handle) {
  const el = document.createElement('aside');
  el.dataset.lightingStudy = '';
  el.setAttribute('aria-label', 'Lighting study');
  Object.assign(el.style, {position:'fixed',left:'12px',top:'12px',zIndex:'100',background:'#101412e8',color:'#e8ebd8',padding:'14px',display:'grid',gap:'8px',font:'12px monospace',maxWidth:'230px'});
  const title = document.createElement('strong'); title.textContent = 'LIGHTING STUDY · LOCAL'; el.append(title);
  const field = (name, values) => {
    const label = document.createElement('label'), select = document.createElement('select');
    label.textContent = name + ' '; select.setAttribute('aria-label',name);
    for (const [value,text] of values) { const option=document.createElement('option'); option.value=value; option.textContent=text; select.append(option); }
    label.append(select); el.append(label); return select;
  };
  const profile = field('Profile', [['1','Mixed'], ...LIGHTING_MODES.map(k => [k,k])]);
  profile.value = new URL(location.href).searchParams.get('lighting') || '1';
  profile.onchange = () => { const url = new URL(location.href); url.searchParams.set('lighting',profile.value); location.assign(url); };
  const world = handle.world;
  const rooms = world.rooms.filter(r=>r.lighting).sort((a,b)=>b.def.W*b.def.D-a.def.W*a.def.D);
  const room = field('Room',rooms.map(r=>[String(r.id),`${r.id} · ${r.lighting.kind} · ${r.def.W} × ${r.def.D} m`]));
  const mode = field('Banks',[['cycle','Seeded cycle'],['working','All ceiling on'],['outage','Ceiling off']]);
  const apply = () => { for (const r of rooms) r.lighting.preview = mode.value === 'cycle' ? null : mode.value; };
  const visit = () => {
    const r = rooms.find(r=>r.id===Number(room.value)); if (!r) return;
    const alongZ = r.def.D >= r.def.W;
    let spot = null;
    for (const inset of [.9,1.5,2,2.5]) for (const shift of [0,-1,1,-2,2]) {
      const x = alongZ ? shift : r.def.W/2-inset, z = alongZ ? r.def.D/2-inset : shift;
      const p = toWorld(r.def,x,z);
      if (!spot && handle.world.roomAt(p.x,p.z) === r && handle.world.free(p.x,p.z,.24)) spot={x,z};
    }
    if (spot) handle.goto(r.id,spot.x,spot.z,alongZ?0:Math.PI/2,.04);
  };
  room.onchange = visit; mode.onchange = apply;
  const torch = document.createElement('button'); torch.textContent='Flashlight on / off';
  torch.onclick = () => {
    const bag = handle.inventory; if (!bag || handle.paused) { status.textContent = 'Resume play to test the flashlight.'; return; }
    let i = bag.model.read().slots.findIndex(item=>item?.type==='torch');
    if(i<0) { const added=bag.give(makeItem('torch','lighting-study-torch')); if(!added.ok){status.textContent=`Flashlight: ${added.reason}`;return;} i=added.index; }
    bag.select(i); bag.toggleLight();
    status.textContent = `Flashlight ${bag.torchPower()>0 ? 'on' : 'off'}`;
  };
  el.append(torch);
  const near = document.createElement('button'); near.textContent='Near wall · camera beam';
  near.onclick=()=>{
    const r=rooms.find(r=>r.id===Number(room.value));if(!r)return;
    for(const z of [0,-1,1,-2,2]) {
      const x=r.def.W/2-.75,p=toWorld(r.def,x,z);
      if(!world.free(p.x,p.z,.24))continue;
      handle.goto(r.id,x,z,-Math.PI/2,0);break;
    }
    mode.value='outage';apply();
    if(handle.inventory?.torchPower()>0)handle.inventory.toggleLight();
  };
  const across=document.createElement('button');across.textContent='Across room';across.onclick=visit;
  const down=document.createElement('button');down.textContent='Look at carpet';down.onclick=()=>{handle.player.me.pitch=-.55;};
  el.append(near,across,down);
  const replay = document.createElement('button'); replay.textContent = 'Replay cue';
  replay.onclick = () => { mode.value='cycle'; apply(); for (const r of rooms) { world.clearLightingCue(r); r.lighting.offset=-(world.lightingTime||0); } };
  el.append(replay);
  const blackout=document.createElement('button'); blackout.textContent='Hallway blackout';
  blackout.onclick=()=>{ const r=rooms.find(r=>r.id===Number(room.value)); mode.value='cycle'; apply(); world.startLightingCue(r,{from:'low',hold:true}); };
  if (rooms.some(r=>r.lighting.kind==='travel')) el.append(blackout);
  const label = document.createElement('label'), steady = document.createElement('input');
  steady.type='checkbox'; steady.checked=handle.settings().steadyLighting;
  steady.onchange=()=>handle.setSetting('steadyLighting',steady.checked);
  label.append(steady, document.createTextNode(' Steady ambient lights')); el.append(label);
  const status = document.createElement('output'); el.append(status);
  const note=document.createElement('span'); note.textContent='Compare the same room. F toggles the flashlight during play. Esc releases the mouse.'; el.append(note);
  const reading = document.createElement('output'); el.append(reading);
  const timer = setInterval(() => {
    if (handle.world !== world) {
      room.disabled=mode.disabled=torch.disabled=replay.disabled=blackout.disabled=near.disabled=across.disabled=down.disabled=true;
      reading.textContent='Floor changed. Reload to restart the study.';
      return;
    }
    const r = rooms.find(r=>r.id===Number(room.value));
    const shared=handle.env.kit.shared;
    reading.textContent = r ? `Banks: ${r.lightLevels.map(v=>Math.round(v*100)+'%').join(' / ')} · Camera lamp ${shared.uCameraLamp.value.toFixed(3)} · Torch ${shared.uTorch.value.toFixed(2)}` : 'No eligible rooms on this floor.';
  }, 300);
  document.body.append(el); visit(); apply();
  return ()=>{ clearInterval(timer); el.remove(); };
}
