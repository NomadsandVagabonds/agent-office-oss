import {createSound} from '../backrooms/sound.js';
// Each browser hears the authoritative event at its own listening position.
export function createCoopAudio(makeSound=createSound){
 let sound=null,depth=-1,last=0;
 return {
  start(){sound?.start();},
  floor(level,next){if(!sound)sound=makeSound(level);else{sound.stopMascot();sound.setMains(level.hum);}depth=next;last=0;},
  pause(value){sound?.setPaused(value);},
  mute(){sound?.setMute(!sound.muted);return sound?.muted;},
  update(s,id){
   if(!sound||s.depth!==depth)return;
   const mine=s.players.find(p=>p.id===id),me=mine?.health>0?mine:s.players.find(p=>p.health>0)||mine;if(!me)return;
   for(const e of s.sounds||[]){
    if(e.seq<=last)continue;last=e.seq;
    if(e.to&&e.to!==id)continue;
    if(e.name==='mascot'){sound.playMascot();continue;}
    if(e.name==='mascot-stop'){sound.stopMascot();continue;}
    const o={...e.options};
    if(Number.isFinite(e.x)&&Number.isFinite(e.z)){
     const dx=e.x-me.x,dz=e.z-me.z,d=Math.hypot(dx,dz),reach=e.reach||10;
     if(d>=reach)continue;o.vol=(o.vol??1)*(1-d/reach);o.pan=Math.max(-1,Math.min(1,(Math.cos(me.yaw)*dx-Math.sin(me.yaw)*dz)/Math.max(1,d)));
    }
    sound.play(e.name,o);
   }
  },
  stop(){sound?.stop();sound=null;},
 };
}
