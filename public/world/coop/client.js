import {createVoice} from './voice.js';
import * as THREE from 'three';
import {VERSION,MAP,CELL,EXIT,los} from '/core/coop.js';
import {createKit,Batch,lamp} from '../backrooms/kit.js';
import {makePirate} from '../backrooms/cast/pirate.js';
import {makeRng} from '../backrooms/gen.js';
import {INVENTORY_MODELS} from '../backrooms/inventory-items.js';
import {Avatar} from '../avatar/rig.js';
import {resolveLook} from '/core/look.mjs';
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
for(let z=0;z<MAP.length;z++)for(let x=0;x<MAP[z].length;x++){
 const wx=(x+.5)*CELL,wz=(z+.5)*CELL;
 if(MAP[z][x]==='#')box(wx,1.5,wz,CELL,3,CELL,wall);
 else {box(wx,-.06,wz,CELL,.12,CELL,floor);box(wx,3.06,wz,CELL,.12,CELL,ceiling);
 if((x+z)%3===0)box(wx,2.99,wz,.35,.025,1.25,new THREE.MeshBasicMaterial({color:0xf1f3ce}));}
}
box(EXIT.x,1.1,EXIT.z+.8,1.3,2.2,.08,new THREE.MeshBasicMaterial({color:0x577762}));
const pirate=makePirate(kit,makeRng('coop-pirate'));pirate.show();pirate.hold(0);scene.add(pirate.group);
const itemMeshes=new Map(),avatars=new Map(),keys=new Set();let state=null,id=null,socket=null,yaw=Math.PI,pitch=0,selected=0,lastHealth=4,ended=false;
function send(m){if(socket?.readyState===1)socket.send(JSON.stringify(m));}
const voice=createVoice({send,enabled:()=>socket?.readyState===1&&!!state&&!ended,button:$('voice'),status:$('voiceStatus'),volume:$('voiceVolume')});
function active(){return document.pointerLockElement===canvas&&state?.phase==='play'&&state.players.find(p=>p.id===id)?.health>0;}
const slots=Array.from({length:6},(_,i)=>{const b=document.createElement('button');b.onclick=()=>selected=i;$('bar').append(b);return b;});
function itemMesh(type){const b=new Batch(true);b.addVox(kit.model('coop:'+type,INVENTORY_MODELS[type]).solid,new THREE.Matrix4().makeScale(.04,.04,.04));return new THREE.Mesh(kit.geometry(b,[lamp(0,3,0,[1,1,1],{k:8})],[.8,.8,.8]),kit.surface({vox:true}));}
function update(s){state=s;for(const p of s.players){if(p.id!==id&&!avatars.has(p.id)){const a=new Avatar(resolveLook(p.id,{species:'human',outfit:'hoodie',outfitColor:'#498776',accessory:'none'}),{seed:p.id});scene.add(a.root);a.root.position.set(p.x,0,p.z);avatars.set(p.id,a);}}
 for(const item of s.items){if(!itemMeshes.has(item.id)){const m=itemMesh(item.type);scene.add(m);itemMeshes.set(item.id,m);}const m=itemMeshes.get(item.id);m.visible=item.owner===null;m.position.set(item.x,.03,item.z);}
 const me=s.players.find(p=>p.id===id);if(!me)return;
 $('clock').textContent=`SP ${Math.floor(s.time/60).toString().padStart(2,'0')}:${Math.floor(s.time%60).toString().padStart(2,'0')}`;
 $('vitals').textContent=`♥ ${me.health}/4  ·  BAT ${Math.ceil(me.battery)}s  ·  PARTNER ${s.players.find(p=>p.id!==id)?.health??'—'}/4`;
 slots.forEach((b,i)=>{b.className=selected===i?'selected':'';b.textContent=`${i+1} ${s.items.find(t=>t.id===me.bag[i])?.type||'·'}`;});
 if(me.health<lastHealth){$('overlay').style.backgroundColor='#a0202044';setTimeout(()=>$('overlay').style.backgroundColor='',250);}lastHealth=me.health;
 if(s.phase==='waiting')$('status').textContent=`${s.players.length}/2 connected · ${s.players.filter(p=>p.ready).length}/2 ready`;
 if(!['waiting','play'].includes(s.phase)&&!ended){ended=true;voice.off();document.exitPointerLock();$('panel').hidden=false;$('ready').hidden=true;$('status').textContent=({escaped:'The surviving visitors escaped.',dead:'Neither tape was recovered.',disconnected:'Your partner disconnected. Start a new review session.'})[s.phase];}
}
async function connect(code){$('create').hidden=true;$('alphaKey').hidden=true;$('invite').hidden=$('copy').hidden=$('ready').hidden=false;
 const url=new URL(location.href);url.searchParams.set('room',code);history.replaceState(null,'',url);$('invite').value=url.href;
 socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/socket?room=${encodeURIComponent(code)}&v=${VERSION}`);
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='voice')voice.receive(m);if(m.type==='welcome')id=m.id;if(m.type==='state')update(m.state);};
 socket.onclose=()=>{voice.off();keys.clear();document.exitPointerLock();$('panel').hidden=false;$('ready').hidden=true;$('status').textContent='Connection closed. The room may be full, started, or expired. Start a new session.';};
 socket.onerror=()=>{$('status').textContent='Could not connect to the co-op server.';};
}
$('create').onclick=async()=>{try{const r=await fetch('/new',{method:'POST',headers:{'x-alpha-key':$('alphaKey').value}});if(!r.ok)throw Error(r.status===403?'Host passcode required or incorrect.':'Server full');$('alphaKey').value='';await connect((await r.json()).code);}catch(e){$('status').textContent=e.message;}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);$('copy').textContent='Copied';}catch{$('invite').select();}};
function lock(){const request=canvas.requestPointerLock();request?.catch(()=>{$('panel').hidden=false;$('status').textContent='Click Ready / resume to give this tab mouse control.';});}
$('ready').onclick=()=>{send({type:'ready'});lock();};
canvas.onclick=()=>{if(state&&!ended)lock();};
document.addEventListener('pointerlockchange',()=>{keys.clear();$('panel').hidden=document.pointerLockElement===canvas;if(!active())send({type:'input',f:0,s:0,yaw,pitch});});
window.addEventListener('blur',()=>{keys.clear();send({type:'input',f:0,s:0,yaw,pitch});});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){yaw-=e.movementX*.0023;pitch=Math.max(-1.2,Math.min(1.2,pitch-e.movementY*.0023));}});
window.addEventListener('keydown',e=>{if(document.pointerLockElement!==canvas)return;keys.add(e.key.toLowerCase());if(e.repeat)return;
 if(/^[1-6]$/.test(e.key))selected=Number(e.key)-1;
 const me=state?.players.find(p=>p.id===id);if(!me||!active())return;
 if(e.key.toLowerCase()==='e'){const item=nearby(me);if(item)send({type:'take',id:item.id});else send({type:'exit'});}
 if(e.key.toLowerCase()==='r')send({type:'use',id:me.bag[selected]});
 if(e.key.toLowerCase()==='g')send({type:'drop',id:me.bag[selected]});
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function nearby(me){return state.items.filter(i=>i.owner===null&&Math.hypot(i.x-me.x,i.z-me.z)<1.5&&los(me,i)).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];}
setInterval(()=>{if(active())send({type:'input',f:Number(keys.has('w'))-Number(keys.has('s')),s:Number(keys.has('d'))-Number(keys.has('a')),run:keys.has('shift'),yaw,pitch});},50);
let last=performance.now(),initialized=false;
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;
 if(state){const me=state.players.find(p=>p.id===id),view=me?.health>0?me:state.players.find(p=>p.health>0)||me;
 if(view){const target=new THREE.Vector3(view.x,1.1,view.z);if(!initialized){camera.position.copy(target);initialized=true;}else camera.position.lerp(target,1-Math.exp(-22*dt));camera.rotation.set(view===me?pitch:view.pitch,view===me?yaw:view.yaw,0);}
 for(const p of state.players){const a=avatars.get(p.id);if(a){a.root.visible=p.health>0&&p!==view;a.root.position.lerp(new THREE.Vector3(p.x,0,p.z),1-Math.exp(-15*dt));a.root.rotation.y=p.yaw+Math.PI;a.walking=Math.abs(p.input.f)+Math.abs(p.input.s)>.1?1:0;a.update(dt);}}
 pirate.group.position.lerp(new THREE.Vector3(state.pirate.x,0,state.pirate.z),1-Math.exp(-18*dt));pirate.group.rotation.y=state.pirate.yaw;
 if(me){const item=nearby(me);$('notice').textContent=me.health<=0?'TAPE LOST · watching your partner':item?`E · ${item.type}`:Math.hypot(me.x-EXIT.x,me.z-EXIT.z)<2?'E · leave when both survivors are here':'';}
 }renderer.render(scene,camera);
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();requestAnimationFrame(frame);
const room=new URLSearchParams(location.search).get('room');if(room)connect(room);
