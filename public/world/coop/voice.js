import {VOICE_RATE,VOICE_SAMPLES,validVoicePacket} from '/core/coop-voice.js';
export function createVoice({send,enabled=()=>false,button,status,volume,indicator=null,mode=null,mute=null}) {
 let context=null,stream=null,node=null,source=null,gain=null,talking=false,seq=0,next=0,lastSeq=-1,generation=0,starting=false;
 let held=false,muted=false,focused=true;
 const scheduled=new Set();let receiving=false,receiveTimer=null;
 const open=()=>mode?.value==='open';
 function activity(){
  if(!indicator)return;
  const persistent=!!stream&&open();
  const hidden=!talking&&!receiving&&!persistent;
  const text=talking?(open()?'● MIC ON · V MUTE':'● TALKING · V'):persistent?(muted?'MIC MUTED · V UNMUTE':'MIC PAUSED · RETURN TO GAME'):'● FRIEND TALKING';
  if(indicator.hidden!==hidden)indicator.hidden=hidden;
  if(indicator.textContent!==text)indicator.textContent=text;
 }
 const say=text=>{if(status.textContent!==text)status.textContent=text;};
 function sync(){
  const nextTalking=!!(stream&&node&&enabled()&&focused&&!document.hidden&&!muted&&(open()||held));
  if(talking!==nextTalking){talking=nextTalking;node?.port.postMessage(talking);}
  for(const track of stream?.getAudioTracks()||[])track.enabled=talking;
  if(mute){mute.disabled=!stream;mute.textContent=muted?'Unmute microphone':'Mute microphone';mute.setAttribute('aria-pressed',String(muted));}
  if(stream)say(muted?'Microphone muted':talking?(open()?'Open mic · V to mute':'● TRANSMITTING'):!focused||document.hidden?'Microphone paused · return to this tab':open()?'Open mic ready':'Voice ready · hold V to talk');
  activity();
 }
 function stopTalking(){held=false;sync();}
 function off(){
  receiving=false;clearTimeout(receiveTimer);generation++;starting=false;held=false;muted=false;talking=false;node?.port.postMessage(false);
  stream?.getTracks().forEach(t=>t.stop());stream=null;node?.disconnect();source?.disconnect();node=source=null;
  for(const s of scheduled){try{s.stop();}catch{}}scheduled.clear();context?.close();context=null;gain=null;next=0;lastSeq=-1;
  button.textContent='Enable voice';say('Microphone off');sync();
 }
 async function start(){if(stream){off();return;}if(starting)return;starting=true;const mine=++generation;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Voice needs HTTPS (or localhost).');
   context=new AudioContext();await context.resume();gain=context.createGain();gain.gain.value=Number(volume.value);gain.connect(context.destination);
   const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   if(mine!==generation){mic.getTracks().forEach(t=>t.stop());return;}stream=mic;
   await context.audioWorklet.addModule('/world/coop/voice-capture.js');if(mine!==generation)return;
   node=new AudioWorkletNode(context,'coop-voice-capture');source=context.createMediaStreamSource(stream);source.connect(node);node.connect(context.destination);
   node.port.onmessage=e=>{if(!talking||!enabled()||document.hidden||!focused||muted)return;const bytes=new Uint8Array(e.data.buffer);let raw='';for(const b of bytes)raw+=String.fromCharCode(b);send({type:'voice',seq:seq++,pcm:btoa(raw)});};
   stream.getTracks().forEach(t=>t.onended=off);button.textContent='Disable voice';sync();
  }catch(e){if(mine===generation){off();say(e.name==='NotAllowedError'?'Microphone permission denied. Enable it in your browser to retry.':e.message);}}
  finally{if(mine===generation)starting=false;}
 }
 const toggleMute=()=>{if(!stream)return;muted=!muted;held=false;context?.resume().catch(()=>{});sync();};
 button.addEventListener('click',start);mute?.addEventListener('click',toggleMute);
 mode?.addEventListener('change',()=>{held=false;sync();});
 volume.addEventListener('input',()=>{if(gain)gain.gain.value=Number(volume.value);});
 const down=e=>{if(e.code!=='KeyV'||e.repeat||!stream||!node||!enabled()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(open()){toggleMute();return;}context.resume().catch(()=>{});held=true;sync();};
 const up=e=>{if(e.code==='KeyV'&&!open())stopTalking();};
 window.addEventListener('keydown',down);window.addEventListener('keyup',up);
 window.addEventListener('blur',()=>{focused=false;stopTalking();});
 window.addEventListener('focus',()=>{focused=true;context?.resume().catch(()=>{});sync();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)held=false;sync();});
 window.addEventListener('pagehide',off);
 return {off,receive(m){if(!context||context.state!=='running'||!validVoicePacket(m)||m.seq<=lastSeq)return;lastSeq=m.seq;
   receiving=true;activity();clearTimeout(receiveTimer);receiveTimer=setTimeout(()=>{receiving=false;activity();},250);
   const raw=atob(m.pcm),buffer=context.createBuffer(1,VOICE_SAMPLES,VOICE_RATE),out=buffer.getChannelData(0);
   for(let i=0;i<VOICE_SAMPLES;i++){let n=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);if(n>32767)n-=65536;out[i]=n/32768;}
   // Bound playout delay: late audio is discarded instead of building a backlog.
   const now=context.currentTime;if(next>now+.3)return;next=Math.max(now+.06,next);
   const s=context.createBufferSource();s.buffer=buffer;s.connect(gain);scheduled.add(s);s.onended=()=>{scheduled.delete(s);s.disconnect();};s.start(next);next+=VOICE_SAMPLES/VOICE_RATE;
  }};
}
