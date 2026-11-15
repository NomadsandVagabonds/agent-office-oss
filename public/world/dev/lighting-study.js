// A local review aid, never included in the public game's entry point.
import { makeItem } from '../backrooms/inventory-state.js';
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
  const world = handle.world;
  const rooms = world.rooms.filter(r=>r.lighting).sort((a,b)=>b.def.W*b.def.D-a.def.W*a.def.D);
  const original = new Map(rooms.map(r=>[r.id,r.lighting.kind]));
  const room = field('Room',rooms.map(r=>[String(r.id),`${r.id} · ${r.def.W} × ${r.def.D} m`]));
  const mode = field('Banks',[['cycle','Seeded cycle'],['steady','Both working'],['dim','One failed']]);
  const apply = () => { for (const r of rooms) r.lighting.kind = mode.value === 'cycle' ? original.get(r.id) : mode.value; };
  const visit = () => {
    const r = rooms.find(r=>r.id===Number(room.value)); if (!r) return;
    const alongX = r.lighting.axis === 'x';
    let spot = null;
    for (const inset of [.9,1.5,2,2.5]) for (const shift of [0,-1,1,-2,2]) {
      const x = alongX ? shift : r.def.W/2-inset, z = alongX ? r.def.D/2-inset : shift;
      const p = toWorld(r.def,x,z);
      if (!spot && handle.world.roomAt(p.x,p.z) === r && handle.world.free(p.x,p.z,.24)) spot={x,z};
    }
    if (spot) handle.goto(r.id,spot.x,spot.z,alongX?0:Math.PI/2,.04);
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
  const status = document.createElement('output'); el.append(status);
  const note=document.createElement('span'); note.textContent='Compare the same room. F toggles the flashlight during play. Esc releases the mouse.'; el.append(note);
  const reading = document.createElement('output'); el.append(reading);
  const timer = setInterval(() => {
    if (handle.world !== world) {
      room.disabled=mode.disabled=torch.disabled=true;
      reading.textContent='Floor changed. Reload to restart the study.';
      return;
    }
    const r = rooms.find(r=>r.id===Number(room.value));
    reading.textContent = r ? `Bank A / B: ${r.u.banks.value.map(v=>Math.round(v*100)+'%').join(' / ')}` : 'No eligible rooms on this floor.';
  }, 300);
  document.body.append(el); visit(); apply();
  return ()=>{ clearInterval(timer); el.remove(); };
}
