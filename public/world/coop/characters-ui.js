import {GUEST_PRESETS,guestPreset} from '/core/guest-presets.mjs';
import {resolveLook} from '/core/look.mjs';
import {paintFlatCharacter} from '../art/character.js';
export function createCharacterPicker({root,help,send}){
 const cards=GUEST_PRESETS.map((preset,slot)=>{
  const card=document.createElement('div');card.className='character-card';
  const canvas=document.createElement('canvas'),label=document.createElement('label'),select=document.createElement('select');
  select.id=`character-${slot}`;label.htmlFor=select.id;
  for(const p of GUEST_PRESETS){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;select.append(option);}
  select.value=preset.id;select.disabled=true;select.addEventListener('change',()=>send({type:'character',slot,character:select.value}));
  card.append(canvas,label,select);root.append(card);return {canvas,label,select,painted:null};
 });
 return {update(state,id,host,choices){
  cards.forEach((c,slot)=>{const player=state?.players[slot],preset=guestPreset(player?.character||choices[slot])||GUEST_PRESETS[slot];
   c.label.textContent=player?.id===id?'You':slot===0?'Host':'Friend';c.select.value=preset.id;
   c.select.disabled=state?.phase!=='waiting'||(!host&&player?.id!==id);
   if(c.painted!==preset.id){c.painted=preset.id;const pix=paintFlatCharacter(resolveLook(preset.id,preset.look));const full=pix.toCanvas(3);c.canvas.width=96;c.canvas.height=138;c.canvas.getContext('2d').drawImage(full,0,54,96,138,0,0,96,138);c.canvas.setAttribute('aria-label',preset.label);}
  });
  help.textContent=!state?'Start or join a game to choose. The host can choose for both players.':state.phase==='waiting'?(host?'Choose for yourself or your friend. Either player can change their own character.':'Choose your character, then click Ready.'):'Characters are set for this visit.';
 }};
}
