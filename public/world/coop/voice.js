import {VOICE_RATE,VOICE_SAMPLES,validVoicePacket} from '/core/coop-voice.js';
export function createVoice({send,enabled=()=>false,button,status,volume}) {
 let context=null,stream=null,node=null,source=null,gain=null,talking=false,seq=0,next=0,lastSeq=-1,generation=0,starting=false;
 const scheduled=new Set();
 const say=text=>{status.textContent=text;};
 function stopTalking(){talking=false;node?.port.postMessage(false);if(stream)say('Voice ready · hold V to talk');}
 function off(){generation++;starting=false;stopTalking();stream?.getTracks().forEach(t=>t.stop());stream=null;node?.disconnect();source?.disconnect();node=source=null;
  for(const s of scheduled){try{s.stop();}catch{}}scheduled.clear();context?.close();context=null;gain=null;next=0;lastSeq=-1;button.textContent='Enable voice';say('Microphone off');}
 async function start(){if(stream){off();return;}if(starting)return;starting=true;const mine=++generation;
  try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Voice needs HTTPS (or localhost).');
   context=new AudioContext();await context.resume();gain=context.createGain();gain.gain.value=Number(volume.value);gain.connect(context.destination);
   const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(mine!==generation){mic.getTracks().forEach(t=>t.stop());return;}stream=mic;
   await context.audioWorklet.addModule('/world/coop/voice-capture.js');if(mine!==generation)return;
   node=new AudioWorkletNode(context,'coop-voice-capture');source=context.createMediaStreamSource(stream);source.connect(node);node.connect(context.destination);
   node.port.onmessage=e=>{if(!talking||!enabled())return;const bytes=new Uint8Array(e.data.buffer);let raw='';for(const b of bytes)raw+=String.fromCharCode(b);send({type:'voice',seq:seq++,pcm:btoa(raw)});};
   stream.getTracks().forEach(t=>t.onended=off);button.textContent='Disable voice';say('Voice ready · hold V to talk');
  }catch(e){if(mine===generation){off();say(e.name==='NotAllowedError'?'Microphone permission denied. Enable it in your browser to retry.':e.message);}}
  finally{if(mine===generation)starting=false;}
 }
 button.addEventListener('click',start);
 volume.addEventListener('input',()=>{if(gain)gain.gain.value=Number(volume.value);});
 const down=e=>{if(e.code!=='KeyV'||e.repeat||!stream||!node||!enabled()||/INPUT|TEXTAREA/.test(e.target.tagName))return;context.resume();talking=true;node.port.postMessage(true);say('● TRANSMITTING');};
 const up=e=>{if(e.code==='KeyV')stopTalking();};
 window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',stopTalking);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTalking();});
 window.addEventListener('pagehide',off);
 return {off,receive(m){if(!context||context.state!=='running'||!validVoicePacket(m)||m.seq<=lastSeq)return;lastSeq=m.seq;
   const raw=atob(m.pcm),buffer=context.createBuffer(1,VOICE_SAMPLES,VOICE_RATE),out=buffer.getChannelData(0);
   for(let i=0;i<VOICE_SAMPLES;i++){let n=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);if(n>32767)n-=65536;out[i]=n/32768;}
   // Bound playout delay: late audio is discarded instead of building a backlog.
   const now=context.currentTime;if(next>now+.3)return;next=Math.max(now+.06,next);
   const s=context.createBufferSource();s.buffer=buffer;s.connect(gain);scheduled.add(s);s.onended=()=>{scheduled.delete(s);s.disconnect();};s.start(next);next+=VOICE_SAMPLES/VOICE_RATE;
  }};
}
