// Local first-session checks with a generated test tone, fake microphone and
// 100ms outbound WebSocket delay per peer. Never uses the real microphone.
// Run: node tools/blockrooms/coop-preflight-check.mjs (CHROME may override).
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
import {createCoopServer} from './coop-server.mjs';
const app=createCoopServer({alphaKey:''});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${app.server.address().port}`;
// Optional reproducible visit, without changing the server's production seed policy.
if(process.env.COOP_TEST_SEED){const put=app.rooms.set;app.rooms.set=function(code,room){room.seed=process.env.COOP_TEST_SEED;return put.call(this,code,room);};}

const profile=fs.mkdtempSync(os.tmpdir()+'/coop-review-');let cdp;
// Generate a WAV for Chrome's fake microphone inside its disposable profile.
const samples=48000*4,tone=Buffer.alloc(44+samples*2),tonePath=profile+'/microphone.wav';
tone.write('RIFF');tone.writeUInt32LE(tone.length-8,4);tone.write('WAVEfmt ',8);tone.writeUInt32LE(16,16);tone.writeUInt16LE(1,20);tone.writeUInt16LE(1,22);tone.writeUInt32LE(48000,24);tone.writeUInt32LE(96000,28);tone.writeUInt16LE(2,32);tone.writeUInt16LE(16,34);tone.write('data',36);tone.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++)tone.writeInt16LE(Math.round(3500*Math.sin(2*Math.PI*440*i/48000)),44+i*2);
fs.writeFileSync(tonePath,tone);
const chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture='+tonePath,'--disable-background-timer-throttling','--disable-renderer-backgrounding','--no-sandbox','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
const errors=[];const sessions=[];
async function tab(url){const t=await(await fetch(cdp+'/json/new?'+encodeURIComponent('about:blank'),{method:'PUT'})).json();const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m.result);pending.delete(m.id);}else if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry.text);else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};const cmd=(method,params={})=>new Promise(resolve=>{pending.set(++id,resolve);ws.send(JSON.stringify({id,method,params}));});await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Log.enable');await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.voicePlayback={count:0,peak:0};const startAudio=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.length===640&&this.buffer.sampleRate===16000){voicePlayback.count++;for(const x of this.buffer.getChannelData(0))voicePlayback.peak=Math.max(voicePlayback.peak,Math.abs(x));}return startAudio.apply(this,args);};window.WebSocket=class extends WebSocket {send(data){setTimeout(()=>{if(this.readyState===1)super.send(data)},100);}constructor(...args){super(...args);window.testSocket=this;this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='state')window.testState=m.state;if(m.type==='welcome')window.testId=m.id;});}}`});await cmd('Page.navigate',{url});const ev=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};const s={cmd,ev,ws};sessions.push(s);return s;}
const until=async(fn,label)=>{for(let n=0;n<120;n++){if(await fn())return;await sleep(250);}throw Error('Timed out: '+label);};
const click=async(t,id)=>{const p=await t.ev(`(()=>{const b=document.getElementById(${JSON.stringify(id)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);for(const type of ['mousePressed','mouseReleased'])await t.cmd('Input.dispatchMouseEvent',{type,...p,button:'left',clickCount:1});};
const key=async(t,type)=>t.cmd('Input.dispatchKeyEvent',{type,key:'v',code:'KeyV',windowsVirtualKeyCode:86});
try{
 for(let n=0;n<80;n++){try{cdp='http://127.0.0.1:'+fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0];await fetch(cdp+'/json');break;}catch{await sleep(250);}}
 const a=await tab(origin+'/rooms?debug=1&slice=1');await sleep(2000);
 await a.ev('window.savedFetch=fetch;window.fetch=()=>Promise.reject(new TypeError("offline"));document.getElementById("create").click()');await sleep(300);
 assert.match(await a.ev('document.getElementById("status").textContent'),/Check your connection/);assert.equal(await a.ev('document.getElementById("create").disabled'),false);
 await a.ev('window.fetch=savedFetch;for(let i=0;i<10;i++)document.getElementById("create").click()');
 await until(()=>a.ev('document.getElementById("invite").value.includes("room=")'),'host invite');assert.equal(app.rooms.size,1,'rapid clicks create only one room');
 await a.ev('Object.defineProperty(navigator.clipboard,"writeText",{value:()=>Promise.reject(new Error("denied"))});document.getElementById("copy").click()');await sleep(200);
 assert.match(await a.ev('document.getElementById("copy").textContent'),/Link selected/);
 const invite=await a.ev('document.getElementById("invite").value'),b=await tab(invite);
 for(const t of [a,b])await until(()=>t.ev('testState?.players?.length===2&&!document.getElementById("ready").disabled').catch(()=>false),'floor loading');
 // Exact studio presets, with host assignment and guest override before Ready.
 const choose=async(t,slot,value)=>t.ev(`(()=>{const s=document.getElementById('character-${slot}');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change'));})()`);
 assert.equal(await b.ev('document.getElementById("character-0").disabled'),true);
 await choose(a,1,'yellow-alien');await until(()=>b.ev('testState.players[1].character==="yellow-alien"'),'host assigns friend');
 await choose(b,1,'pink-cowgirl');await until(()=>a.ev('testState.players[1].character==="pink-cowgirl"'),'friend chooses cowgirl');
 assert.equal(await a.ev('__coop.avatarLooks.find(a=>a.character==="pink-cowgirl")?.look.accessory'),'cowboy');
 assert.equal(await b.ev('__coop.avatarLooks.find(a=>a.character==="yellow-alien")?.look.accessory'),'goggles');
 await a.ev('document.getElementById("characterSlots").scrollIntoView({block:"center"})');
 const lobbyShot=await a.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-custom-characters.png',Buffer.from(lobbyShot.data,'base64'));
 console.log('Host assignment, guest choice and both custom 3D avatar looks verified.');
 // Real getUserMedia -> AudioWorklet -> 16k PCM -> WebSocket -> partner AudioBufferSource.
 for(const t of [a,b]){await t.cmd('Page.bringToFront');await click(t,'voice');await until(()=>t.ev('document.getElementById("voiceStatus").textContent.includes("Voice ready")'),'microphone enabled');}
 for(const [sender,receiver] of [[a,b],[b,a]]){
  const count=await receiver.ev('voicePlayback.count');await sender.cmd('Page.bringToFront');await key(sender,'keyDown');
  await until(()=>receiver.ev(`voicePlayback.count>${count+8}&&voicePlayback.peak>.01`),'audible voice playback');
  assert.match(await sender.ev('document.getElementById("voiceIndicator").textContent'),/TALKING/);
  await key(sender,'keyUp');await sleep(500);assert.equal(await sender.ev('document.getElementById("voiceIndicator").hidden'),true);
 }
 console.log('Microphone capture, resampling, two-way audible playback and key-up verified with 100ms send delay per peer.');
 // Open microphone transmits without holding V; mute and blur stop outbound packets.
 await a.cmd('Page.bringToFront');
 const setMode=async value=>a.ev(`(()=>{const s=document.getElementById('voiceMode');s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change'));})()`);
 let received=await b.ev('voicePlayback.count');await setMode('open');await until(()=>b.ev(`voicePlayback.count>${received+8}`),'open mic audio without a key');
 assert.match(await a.ev('document.getElementById("voiceIndicator").textContent'),/MIC ON/);
 await key(a,'keyDown');await key(a,'keyUp');await sleep(600);received=await b.ev('voicePlayback.count');await sleep(600);assert.equal(await b.ev('voicePlayback.count'),received,'V mute stops sending');
 await click(a,'voiceMute');await until(()=>b.ev(`voicePlayback.count>${received+8}`),'button unmutes open mic');
 await a.ev('window.dispatchEvent(new Event("blur"))');await sleep(600);received=await b.ev('voicePlayback.count');await sleep(600);assert.equal(await b.ev('voicePlayback.count'),received,'blur stops open mic');
 await a.ev('window.dispatchEvent(new Event("focus"))');await until(()=>b.ev(`voicePlayback.count>${received+8}`),'focus restores chosen open mic');
 await setMode('ptt');await sleep(600);received=await b.ev('voicePlayback.count');await sleep(600);assert.equal(await b.ev('voicePlayback.count'),received,'switching to push-to-talk closes open mic');
 console.log('Open mic, V mute, button unmute, blur/focus and return to push-to-talk verified.');
 await a.cmd('Page.bringToFront');await click(a,'ready');await sleep(500);
 assert.equal(await a.ev('testState.phase'),'waiting');assert.equal(await a.ev('document.getElementById("panel").hidden'),false,'first Ready stays in lobby');assert.equal(await a.ev('document.getElementById("ready").disabled'),true);
 await click(b,'ready');await until(()=>a.ev('testState.phase==="play"'),'both ready');await until(()=>b.ev('testState.phase==="play"'),'guest play');
 await a.cmd('Page.bringToFront');await click(a,'ready');await until(()=>a.ev('document.pointerLockElement?.id==="view"'),'host mouse capture');
 await key(a,'keyDown');await sleep(300);const image=await a.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-preflight-talking.png',Buffer.from(image.data,'base64'));await key(a,'keyUp');
 // Native protection catches accidental reloads during a run.
 let dialog=false;a.ws.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(m.method==='Page.javascriptDialogOpening'){dialog=true;await a.cmd('Page.handleJavaScriptDialog',{accept:false});}});
 await a.cmd('Page.reload');await sleep(700);assert.equal(dialog,true,'reload asks before ending run');
 assert.equal(await a.ev('testState.phase'),'play');
 // Lost connections end explicitly, with a usable way to start again.
 await b.ev('testSocket.close()');await until(()=>a.ev('testState.phase==="disconnected"'),'disconnect propagated');
 assert.match(await a.ev('document.getElementById("status").textContent'),/disconnected/);
 assert.equal(await a.ev('document.getElementById("panel").hidden'),false);assert.equal(await a.ev('document.getElementById("ready").hidden'),true);
 assert.equal(errors.length,0,JSON.stringify(errors));console.log('PASS: duplicate start, ready waiting, mouse capture, reload guard and disconnect feedback.');
}finally{sessions.forEach(s=>s.ws.close());chrome.kill();app.close();await sleep(300);fs.rmSync(profile,{recursive:true,force:true});}
