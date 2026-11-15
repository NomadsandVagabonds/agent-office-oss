import {createSocialUI} from './social-ui.js';
import {EMOTES,REACH} from './social-rules.js';
import {createRealRooms} from './real-rooms.js';
import {createVoice} from './voice.js';
import * as THREE from 'three';
import {VERSION,MAP,CELL,EXIT,los} from '/core/coop.js';
import {createKit,Batch,lamp} from '../backrooms/kit.js';
import {makePirate} from '../backrooms/cast/pirate.js';
import {makeRng} from '../backrooms/gen.js';
import {INVENTORY_MODELS} from '../backrooms/inventory-items.js';
import {Avatar} from '../avatar/rig.js';
import {resolveLook} from '/core/look.mjs';
const realMode=location.pathname==='/rooms';let real=null,realHost=false,building=false,hostPaused=false,fatal=null;
const $=id=>document.getElementById(id),canvas=$('view'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
const scene=new THREE.Scene();scene.background=new THREE.Color('#16190e');scene.fog=new THREE.Fog('#232419',10,35);
scene.add(new THREE.HemisphereLight(0xfff7cd,0x5b5833,2));
const camera=new THREE.PerspectiveCamera(70,1,.05,60);camera.rotation.order='YXZ';
const kit=createKit(),wallTex=kit.tex.wallpaper({wall:'#b4ac64',ink:'#989350',pale:'#c2b975',pattern:'diamonds'});
const material=(map)=>{map.repeat.set(3,3);return new THREE.MeshLambertMaterial({map});};
const wall=material(wallTex),floor=material(kit.tex.carpet('#8a8354')),ceiling=material(kit.tex.ceiling('#b9b69a'));
const cube=new THREE.BoxGeometry(1,1,1);
function box(x,y,z,w,h,d,mat){const m=new THREE.Mesh(cube,mat);m.position.set(x,y,z);m.scale.set(w,h,d);scene.add(m);return m;}
if(!realMode)for(let z=0;z<MAP.length;z++)for(let x=0;x<MAP[z].length;x++){
 const wx=(x+.5)*CELL,wz=(z+.5)*CELL;
 if(MAP[z][x]==='#')box(wx,1.5,wz,CELL,3,CELL,wall);
 else {box(wx,-.06,wz,CELL,.12,CELL,floor);box(wx,3.06,wz,CELL,.12,CELL,ceiling);
 if((x+z)%3===0)box(wx,2.99,wz,.35,.025,1.25,new THREE.MeshBasicMaterial({color:0xf1f3ce}));}
}
if(!realMode)box(EXIT.x,1.1,EXIT.z+.8,1.3,2.2,.08,new THREE.MeshBasicMaterial({color:0x577762}));
const pirate=makePirate(kit,makeRng('coop-pirate'));pirate.show();pirate.hold(0);if(!realMode)scene.add(pirate.group);
const itemMeshes=new Map(),avatars=new Map(),keys=new Set();let state=null,id=null,socket=null,yaw=Math.PI,pitch=0,selected=0,lastHealth=4,ended=false;
function send(m){if(real?.host&&state?.phase==='play'&&['input','take','drop','use','exit','revive','emote','trade-request','trade-answer','trade-offer','trade-confirm','trade-cancel'].includes(m.type)){real.command(id,m);return;}if(socket?.readyState===1)socket.send(JSON.stringify(m));}
const voice=createVoice({send,enabled:()=>socket?.readyState===1&&!!state&&!ended,button:$('voice'),status:$('voiceStatus'),volume:$('voiceVolume')});
const socialUI=createSocialUI({read:()=>({state,me:state?.players.find(p=>p.id===id),real:realMode}),send,resume:()=>lock(),stop:()=>{keys.clear();send({type:'input',f:0,s:0,yaw,pitch});}});
const emoteCaption=document.createElement('div');emoteCaption.id='emoteCaption';document.body.append(emoteCaption);
function teammate(me){return realMode&&state.players.find(p=>p.id!==id&&Math.hypot(p.x-me.x,p.z-me.z)<=REACH&&Math.abs((p.y||0)-(me.y||0))<1&&real?.world.los(me.x,me.z,p.x,p.z));}
function teamPrompt(me,other){if(!other)return '';if(other.health>0)return 'E · request trade';const snack=state.items.find(i=>i.id===me.bag[selected])?.type==='snack';return snack?(other.battery<=0?'E · revive · snack + battery':'E · revive · one snack'):'Partner down · select a snack to revive';}
function signalSprite(){const c=document.createElement('canvas');c.width=128;c.height=128;const g=c.getContext('2d');const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,depthTest:true,transparent:true});const sprite=new THREE.Sprite(mat);sprite.scale.set(.55,.55,.55);sprite.userData.paint=kind=>{g.clearRect(0,0,128,128);g.fillStyle='#efefd8';g.font='84px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(EMOTES[kind]||'＋',64,65);tex.needsUpdate=true;};return sprite;}
function fail(error){fatal='Real room session stopped: '+error.message;ended=true;keys.clear();voice.off();document.exitPointerLock();$('panel').hidden=false;$('ready').hidden=true;$('status').textContent=fatal;socket?.close(1011,'Room runtime failed');}
function active(){return !socialUI.visible&&!ended&&!hostPaused&&document.pointerLockElement===canvas&&state?.phase==='play'&&state.players.find(p=>p.id===id)?.health>0;}
const slots=Array.from({length:6},(_,i)=>{const b=document.createElement('button');b.onclick=()=>selected=i;$('bar').append(b);return b;});
function itemMesh(type){const b=new Batch(true);b.addVox(kit.model('coop:'+type,INVENTORY_MODELS[type]).solid,new THREE.Matrix4().makeScale(.04,.04,.04));return new THREE.Mesh(kit.geometry(b,[lamp(0,3,0,[1,1,1],{k:8})],[.8,.8,.8]),kit.surface({vox:true}));}
function update(s){state=s;if(real&&!real.host)real.apply(s);for(const p of s.players){if(p.id!==id&&!avatars.has(p.id)){const a=new Avatar(resolveLook(p.id,{species:'human',outfit:'hoodie',outfitColor:'#498776',accessory:'none'}),{seed:p.id});scene.add(a.root);a.root.position.set(p.x,0,p.z);a.signal=signalSprite();scene.add(a.signal);avatars.set(p.id,a);}}
 for(const item of s.items){if(!itemMeshes.has(item.id)){const m=itemMesh(item.type);scene.add(m);itemMeshes.set(item.id,m);}const m=itemMeshes.get(item.id);m.visible=item.owner===null;m.position.set(item.x,(item.y||0)+.03,item.z);}
 const me=s.players.find(p=>p.id===id);if(!me)return;
 $('clock').textContent=`SP ${Math.floor(s.time/60).toString().padStart(2,'0')}:${Math.floor(s.time%60).toString().padStart(2,'0')}`;
 $('vitals').textContent=`♥ ${me.health}/4  ·  BAT ${Math.ceil(me.battery)}s  ·  PARTNER ${s.players.find(p=>p.id!==id)?.health??'—'}/4`;
 slots.forEach((b,i)=>{b.className=selected===i?'selected':'';b.textContent=`${i+1} ${s.items.find(t=>t.id===me.bag[i])?.type||'·'}`;});
 if(me.health<lastHealth){$('overlay').style.backgroundColor='#a0202044';setTimeout(()=>$('overlay').style.backgroundColor='',250);}lastHealth=me.health;
 socialUI.update();
 if(s.phase==='waiting'&&!building)$('status').textContent=`${s.players.length}/2 connected · ${s.players.filter(p=>p.ready).length}/2 ready`;
 if(!['waiting','play'].includes(s.phase)&&!ended){ended=true;voice.off();document.exitPointerLock();$('panel').hidden=false;$('ready').hidden=true;$('status').textContent=({escaped:'The surviving visitors escaped.',dead:'Neither tape was recovered.',disconnected:'Your partner disconnected. Start a new review session.'})[s.phase];}
}
async function connect(code){$('create').hidden=true;$('alphaKey').hidden=true;$('invite').hidden=$('copy').hidden=$('ready').hidden=false;
 const url=new URL(location.href);url.searchParams.set('room',code);history.replaceState(null,'',url);$('invite').value=url.href;
 socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/socket?room=${encodeURIComponent(code)}&v=${VERSION}`);
 socket.onmessage=async e=>{try{const m=JSON.parse(e.data);if(m.type==='control'){real?.command(m.id,m.action);return;}if(m.type==='host-paused'){hostPaused=m.paused;$('notice').textContent=hostPaused?'Host tab paused · waiting for return':'';return;}if(m.type==='voice')voice.receive(m);if(m.type==='welcome'){id=m.id;realHost=m.host;if((m.mode==='rooms')!==realMode){socket.close();return;}if(realMode){$('panel').querySelector('h1').textContent='TWO TAPES · REAL ROOMS';building=true;$('ready').disabled=true;$('status').textContent='Building the real rooms…';try{real=await createRealRooms(m.seed,m.host,scene);yaw=real.start.yaw;initialized=false;$('status').textContent='Real rooms ready · '+real.level.rooms.length+' rooms';}catch(e){$('status').textContent='Room build failed: '+e.message;throw e;}finally{building=false;$('ready').disabled=!real;}}}if(m.type==='state'){if(m.state.phase==='disconnected')hostPaused=true;update(m.state);}}catch(error){fail(error);}};
 socket.onclose=()=>{ended=true;hostPaused=true;voice.off();keys.clear();document.exitPointerLock();$('panel').hidden=false;$('ready').hidden=true;$('status').textContent=fatal||'Connection closed. The room may be full, started, or expired. Start a new session.';};
 socket.onerror=()=>{$('status').textContent='Could not connect to the co-op server.';};
}
$('create').onclick=async()=>{try{const r=await fetch(realMode?'/new?mode=rooms':'/new',{method:'POST',headers:{'x-alpha-key':$('alphaKey').value}});if(!r.ok)throw Error(r.status===403?'Host passcode required or incorrect.':'Server full');$('alphaKey').value='';await connect((await r.json()).code);}catch(e){$('status').textContent=e.message;}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);$('copy').textContent='Copied';}catch{$('invite').select();}};
function lock(){const request=canvas.requestPointerLock();request?.catch(()=>{$('panel').hidden=false;$('status').textContent='Click Ready / resume to give this tab mouse control.';});}
$('ready').onclick=()=>{send({type:'ready'});lock();};
canvas.onclick=()=>{if(state&&!ended)lock();};
document.addEventListener('pointerlockchange',()=>{keys.clear();$('panel').hidden=socialUI.visible||document.pointerLockElement===canvas;if(!active())send({type:'input',f:0,s:0,yaw,pitch});});
window.addEventListener('blur',()=>{keys.clear();send({type:'input',f:0,s:0,yaw,pitch});});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*.0023;pitch=Math.max(-1.2,Math.min(1.2,pitch-e.movementY*.0023));}});
window.addEventListener('keydown',e=>{if(realMode&&socialUI.key(e))return;if(document.pointerLockElement!==canvas)return;keys.add(e.key.toLowerCase());if(e.repeat)return;
 if(/^[1-6]$/.test(e.key))selected=Number(e.key)-1;
 const me=state?.players.find(p=>p.id===id);if(!me||!active())return;
 if(e.key.toLowerCase()==='e'){const other=teammate(me);if(other){send(other.health>0?{type:'trade-request'}:{type:'revive',item:me.bag[selected]});return;}const item=nearby(me);if(item)send({type:'take',id:item.id});else send({type:'exit'});}
 if(e.key.toLowerCase()==='r')send({type:'use',id:me.bag[selected]});
 if(e.key.toLowerCase()==='g')send({type:'drop',id:me.bag[selected]});
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function nearby(me){return state.items.filter(i=>i.owner===null&&Math.hypot(i.x-me.x,i.z-me.z)<1.5&&(real?real.world.los(me.x,me.z,i.x,i.z):los(me,i))).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];}
setInterval(()=>{if(active())send({type:'input',f:Number(keys.has('w'))-Number(keys.has('s')),s:Number(keys.has('d'))-Number(keys.has('a')),run:keys.has('shift'),crouch:keys.has('c'),jump:keys.has(' '),yaw,pitch});},50);
let last=performance.now(),initialized=false;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;
 if(real?.host&&!ended&&state?.phase==='play'&&!document.hidden){try{const out=real.step(dt,state);if(out){update(out);send({type:'real-state',state:out});}}catch(error){fail(error);}}
 if(state){const me=state.players.find(p=>p.id===id),view=me?.health>0?me:state.players.find(p=>p.health>0)||me;
 if(view){const target=new THREE.Vector3(view.x,view.y??1.1,view.z);if(!initialized){camera.position.copy(target);initialized=true;}else camera.position.lerp(target,1-Math.exp(-22*dt));camera.rotation.set(view===me?pitch:view.pitch,view===me?yaw:view.yaw,0);}
 for(const p of state.players){const a=avatars.get(p.id);if(a){a.root.visible=p!==view&&(realMode||p.health>0);a.root.position.lerp(new THREE.Vector3(p.x,(p.y??1.1)-1.1+(p.health<=0?.25:0),p.z),1-Math.exp(-15*dt));const emote=p.emote?.until>state.time?p.emote.kind:null;a.root.rotation.y=p.yaw+Math.PI+(emote==='dance'?Math.sin(now*.006)*.3:0);a.root.rotation.z=p.health<=0?-Math.PI/2:emote==='dance'?Math.sin(now*.012)*.12:0;a.setPose(p.health<=0?'sleep':emote==='wave'?'wave':emote==='dance'?'cheer':emote==='heart'?'bow':emote==='help'?'ask':'stand');a.signal.visible=p!==view&&(p.health<=0||!!emote);a.signal.position.set(p.x,(p.y??1.1)+.9,p.z);const signal=p.health<=0?'revive':emote;if(a.signal.userData.kind!==signal){a.signal.userData.kind=signal;a.signal.userData.paint(signal);}a.walking=p.health>0&&Math.abs(p.input?.f||0)+Math.abs(p.input?.s||0)>.1?1:0;a.bounce=emote==='dance'?.5:0;a.update(dt);}}
 if(!realMode){pirate.group.position.lerp(new THREE.Vector3(state.pirate.x,0,state.pirate.z),1-Math.exp(-18*dt));pirate.group.rotation.y=state.pirate.yaw;}
 if(me){const item=nearby(me),other=teammate(me);emoteCaption.textContent=me.emote?.until>state.time?`${EMOTES[me.emote.kind]} ${me.emote.kind}`:'';$('notice').textContent=hostPaused?'Host tab paused · waiting for return':me.health<=0?(realMode?'DOWN · your partner can revive you with a snack':'TAPE LOST · watching your partner'):me.notice?.until>state.time?me.notice.text:other?teamPrompt(me,other):item?`E · ${item.type}`:Math.hypot(me.x-(state.exit||EXIT).x,me.z-(state.exit||EXIT).z)<2?(realMode?(state.exitOpen?'Way open · gather here with your partner':'Find the taped wall · lean into it together'):'E · leave when both survivors are here'):'';}
 }renderer.render(scene,camera);
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();requestAnimationFrame(frame);
const room=new URLSearchParams(location.search).get('room');if(room)connect(room);

document.addEventListener('visibilitychange',()=>{if(realHost)send({type:'host-paused',paused:document.hidden});});

if(realMode){$('panel').querySelector('a').href='/rooms';$('panel').querySelector('small').innerHTML='V hold to talk · voice is not recorded<br>WASD move · mouse look · Shift run · C crouch · Space jump<br>E pick up / open doors · lean into the taped exit wall together<br>1–6 select · R use · G drop · B emotes<br>E near partner: trade / revive with selected snack<br>Esc release mouse · Host must keep this tab visible. Menu stays live.';$('status').textContent='Real rooms alpha · host must keep this tab visible';}else{const link=document.createElement('a');link.href='/rooms';link.textContent='Try real rooms →';$('panel').append(document.createElement('br'),link);}

if(new URLSearchParams(location.search).has('debug'))window.__coop={get runtime(){return real;},get state(){return state;}};
