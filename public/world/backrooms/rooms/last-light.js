// An ordinary hall that loses its lights from the far end toward you. The
// colleague at the far end needs the real flashlight beam to hold it still.
import { lin, WHITE } from '../kit.js';
import { planLighting } from '../lighting.js';
import { hallLayout, heldInBeam, waiting, stepHall, LAST_LIGHT } from './last-light/rule.js';
import { buildStandIn } from './blackout-bay/rig.js';
import { roomBody, moveRoomWalker, roomContact, roomReturn } from '../room-physics.js';
import { ITEM_DEFS } from '../inventory-state.js';

export function build(c) {
  const { room, rt, env, W, D, H }=c, layout=hallLayout(room);
  // Explicit authored opt-in, before the bake. Four fixtures, one per bank;
  // the ambient prototype flag does not gate this room's central mechanic.
  room.panels=layout.panels;
  rt.lighting={...planLighting({...room,kind:'plain',light:{mode:'normal'}},c.level.seed,'travel'),reverse:false,preview:'working'};
  rt.amb=lin(c.look.tube).map(v=>v*.13); rt.level=.2; rt.noTorch=true;
  c.shell();
  // Doorway spill stays at the thresholds. The corridor must really go dark.
  for (const light of rt.lights) if (light.bank===undefined) {light.far2=Math.min(light.far2,3.2**2);light.k=1;}
  for (const block of layout.blocks) c.pillar(block.x,block.z,block.w,block.d);
  // Identical frames repeat into the distance; the two recesses interrupt it.
  const trim=lin(c.look.trim), paint=lin('#d8cfab');
  for(const panel of layout.panels) {
    for(const side of [-1,1]) c.flat.box(side*layout.half-.035,0,panel.z-.055,side*layout.half+.035,H,panel.z+.055,trim);
    c.flat.box(-layout.half,H-.08,panel.z-.055,layout.half,H-.01,panel.z+.055,paint);
  }
  // A charged torch is an actual pickup beside ordinary office furniture, not a
  // scripted possession check. A full bag can drop an item to make room.
  const tx=-W/2+.85, tz=layout.front-1.5;
  const table=c.prop('trolley',tx,tz,{fallback:[.65,.72,.6]});
  c.leave('torch',tx+table.w/2+.35,tz+.4,{charge:ITEM_DEFS.torch.maxCharge});
  c.light(tx,H-.3,tz,'#ffe5ae',.22,{k:1.2,far:3.2});
  c.hang(c.shining('last-light:foyer',c.kit.tex.white(),1.2,lin('#ffe5ae')),'front',tx,H-.4,.26,.12,null,WHITE,.03);
  // An office chair can be dragged out of a recess to make a real barricade.
  const pocket=layout.pockets[0];
  c.prop('chair',pocket.side*(W/2-.6),pocket.z,{rot:.4,fallback:[.55,.9,.55]});
  // Four useless switches, no signage.
  for(const panel of layout.panels) c.flat.box(layout.half-.035,1.02,panel.z+.24,layout.half+.015,1.2,panel.z+.35,paint);

  const roster=env.cast?.length?env.cast:[{name:'Night staff',look:{species:'human',outfit:'cardigan',outfitColor:'#54564b',hair:'side',hairColor:'#322b24',skin:'#b5b29a'}}];
  const figure=buildStandIn(c.kit,roster[(c.params.face||0)%roster.length],3);
  const actor={...figure,...layout.home,gone:false,step:0};
  actor.group.scale.set(.88,1.32,.88); actor.group.position.set(actor.x,0,actor.z);
  c.add(actor.group); roomBody(c,actor,{r:.27,tall:2.15});
  let state=waiting(), known=false, clicks=0;
  const lightActor=()=>{const w=c.toWorld(actor.x,actor.z);actor.light(c.world.lightAt?.(w.x,w.z,1.3)||c.sample(actor.x,1.3,actor.z));};
  c.after.push(lightActor);
  const resetLights=()=>{c.world.clearLightingCue(rt);rt.lighting.preview='working';clicks=0;};
  c.tick((dt,time,me)=>{
    const w=c.toWorld(actor.x,actor.z), pw=c.toWorld(me.x,me.z);
    const localEye=(me.world?.y ?? ((room.y||0)+1.1))-(room.y||0);
    const beam=heldInBeam({x:me.x,y:localEye,z:me.z,yaw:me.yaw,pitch:me.world?.pitch||0},actor,env.inventory?.torchPower?.()||0,c.world.los(pw.x,pw.z,w.x,w.z));
    const distance=Math.hypot(me.x-actor.x,me.z-actor.z), previous=state.phase;
    state=stepHall(state,dt,{inside:me.inside,equipped:!!env.inventory,trigger:me.z<layout.trigger,clear:me.z<layout.clear,beam,distance,contact:roomContact(c,actor,me)});
    if(state.start){rt.lighting.preview=null;c.world.startLightingCue(rt,{from:'low',hold:true});}
    if(state.phase==='hunt') {
      // Same visit-clock cadence as the banks, with a positional relay click.
      const cue=rt.lighting.cue, elapsed=time-(cue?.start??time), count=Math.min(4,Math.floor(elapsed/1.35)+1);
      while(clicks<count){const p=c.toWorld(0,layout.panels[clicks].z);env.play?.('click',p.x,p.z,18);clicks++;}
      if(!beam && me.z<layout.trigger+.2) {
        const moved=moveRoomWalker(c,actor,me.x,Math.min(layout.trigger-.6,me.z),LAST_LIGHT.speed*dt);
        if(moved>.001){
          actor.group.rotation.y=Math.atan2(me.x-actor.x,me.z-actor.z);
          actor.group.position.set(actor.x,Math.abs(Math.sin(time*7))*.025,actor.z);
          actor.step+=moved;
          if(actor.step>.7){actor.step=0;const p=c.toWorld(actor.x,actor.z);env.play?.('step',p.x,p.z,12);}
        }
      }
    } else if(state.phase==='idle' || state.phase==='recover') {
      if(previous==='hunt' || previous==='warning') resetLights();
      if(!beam){moveRoomWalker(c,actor,layout.home.x,layout.home.z,1.5*dt);actor.group.position.set(actor.x,0,actor.z);}
    }
    if(!known && me.inside && beam && distance<10){known=true;c.met('lamplighter');}
    if(state.escaped){c.met('lamplighter');c.survived('lamplighter');actor.physical=false;}
    if(state.caught){
      c.met('lamplighter'); const hit=c.hurt(LAST_LIGHT.damage);
      if(!hit.ended){
        const at=roomReturn(c,0,layout.front-1.15);if(at)env.player?.warp(at.x,at.z);
        env.hud?.glitch?.(.35); env.play?.('buzz',pw.x,pw.z,7);
      }
    }
    lightActor();
  });
  // Read-only diagnostics for the dev study and actual-world tests.
  rt.lastLight={get state(){return {...state};},actor,layout};
}
