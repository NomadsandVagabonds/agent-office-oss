// Isolated review server: no Office daemon, credentials or leaderboard routes.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {WsHub} from '../../server/ws.mjs';
import {VERSION,createSession,join,act,tick,snapshot} from '../../core/coop.js';
import {validVoicePacket} from '../../core/coop-voice.js';
import {beginTransition,floorReady} from '../../public/world/coop/transition.js';
import {validRealSnapshot} from '../../core/coop-real.js';
import {SHOWCASE_ROUTE,SHOWCASE_SEED,SHOWCASE_PENDING,sessionLifetime} from '../../core/coop-routes.mjs';
import {GUEST_PRESETS,guestPreset} from '../../core/guest-presets.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function createCoopServer({alphaKey=process.env.COOP_ALPHA_KEY||'',defaultRooms=process.env.COOP_DEFAULT_MODE==='rooms'}={}) {
 const rooms=new Map();
 const server=http.createServer(async(req,res)=>{
  try {
   const u=new URL(req.url,'http://local'),p=decodeURIComponent(u.pathname);
   if(p==='/'&&defaultRooms){res.writeHead(302,{location:'/rooms'}).end();return;}
   if(p==='/health'){res.writeHead(200,{'content-type':'text/plain'}).end('ok');return;}
   if(p==='/new'&&req.method==='POST') {
    const hash=v=>createHash('sha256').update(String(v)).digest();
    if(alphaKey&&!timingSafeEqual(hash(req.headers['x-alpha-key']||''),hash(alphaKey))){res.writeHead(403).end('Private alpha: host passcode required');return;}
    if(rooms.size>=64){res.writeHead(503).end('Review server full');return;}
    const route=u.searchParams.get('mode')==='rooms'&&u.searchParams.get('route')===SHOWCASE_ROUTE?SHOWCASE_ROUTE:'random';
    if(route===SHOWCASE_ROUTE&&SHOWCASE_PENDING){res.writeHead(409,{'content-type':'text/plain'}).end(SHOWCASE_PENDING);return;}
    const code=randomBytes(16).toString('hex');rooms.set(code,{state:createSession(),mode:u.searchParams.get('mode')==='rooms'?'rooms':'maze',seed:route===SHOWCASE_ROUTE?SHOWCASE_SEED:code,route,depth:0,characters:GUEST_PRESETS.map(p=>p.id),slice:route==='random'&&u.searchParams.get('slice')==='1',host:null,clients:new Map(),born:Date.now()});
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({code}));return;
   }
   const rel=(p==='/'||p==='/rooms')?'public/world/coop/index.html':['/core/coop.js','/core/look.mjs','/core/coop-voice.js','/core/guest-presets.mjs','/core/coop-routes.mjs'].includes(p)?p.slice(1):`public${p}`;
   const file=path.resolve(root,rel);
   if(!file.startsWith(path.join(root,'public')+path.sep)&&!['core/coop.js','core/look.mjs','core/coop-voice.js','core/guest-presets.mjs','core/coop-routes.mjs'].some(p=>file===path.join(root,p))){res.writeHead(404).end();return;}
   const types={'.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg'};
   const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store','X-Content-Type-Options':'nosniff','Permissions-Policy':'microphone=(self), camera=()'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
 });
 const hub=new WsHub({maxPayload:1048576,maxBuffered:1048576,verify:req=>{
  try {return new URL(req.url,'http://local').pathname==='/socket'&&new URL(req.headers.origin).host===req.headers.host;}catch{return false;}
 }});
 server.on('upgrade',(req,socket,head)=>hub.handleUpgrade(req,socket,head));
 hub.on('connect',(client,req)=>{
  const q=new URL(req.url,'http://local').searchParams,r=rooms.get(q.get('room'));
  if(q.get('v')!==VERSION||!r||!join(r.state,String(client.id))){client.close(1008,'Room full, started, expired, or version mismatch');return;}
  const id=String(client.id);r.state.players.at(-1).character=r.characters[r.state.players.length-1];r.clients.set(id,client);r.host ||= id;client.send({type:'welcome',id,version:VERSION,mode:r.mode,seed:r.seed,route:r.route,host:r.host===id,slice:r.slice,characters:r.characters});
  let budget=80,voiceBudget=30,lastVoice=-1,window=Date.now();
  client.on('message',m=>{if(Date.now()-window>1000){budget=80;voiceBudget=30;window=Date.now();}if(--budget<0){client.close(1008,'Too many messages');return;}if(m.type==='character'){
   const slot=m.slot,own=r.state.players.findIndex(p=>p.id===id);
   if(r.state.phase!=='waiting'||!Number.isInteger(slot)||slot<0||slot>1||!guestPreset(m.character)||(id!==r.host&&slot!==own))return;
   r.characters[slot]=m.character;if(r.state.players[slot])r.state.players[slot].character=m.character;
   for(const p of r.state.players)p.ready=false;
   for(const c of r.clients.values())c.send({type:'characters',characters:r.characters});return;
  }if(m.type==='voice'){if(!validVoicePacket(m)||--voiceBudget<0||m.seq<=lastVoice)return;lastVoice=m.seq;for(const [other,c]of r.clients)if(other!==id)c.send(m);return;}if(r.mode==='rooms'){
   if(m.type==='floor-ready'){const message=floorReady(r,id,m.depth);if(message)for(const c of r.clients.values())c.send(message);return;}
   if(m.type==='real-state'){if(id!==r.host||!validRealSnapshot(m.state,r.state.players.map(p=>p.id))){client.close(1008,'Invalid authority snapshot');return;}if(r.state.phase!=='play'||(m.state.depth??0)!==r.depth)return;
   if(m.state.phase==='descending'){const message=beginTransition(r,m.state);if(message)for(const c of r.clients.values())c.send(message);return;}
   r.state=m.state;if(r.stalled){for(const c of r.clients.values())c.send({type:'host-paused',paused:false});r.stalled=false;}r.snapshotAt=Date.now();for(const [other,c]of r.clients)if(other!==id)c.send({type:'state',state:r.state});return;}
   if(m.type==='host-paused'&&id===r.host){for(const c of r.clients.values())c.send({type:'host-paused',paused:!!m.paused});return;}
   if(m.type!=='ready'){if(r.state.phase!=='play'||m.depth!==undefined&&m.depth!==r.depth)return;if(JSON.stringify(m).length>2048){client.close(1009,'Control too large');return;}r.clients.get(r.host)?.send({type:'control',id,action:m});return;}
  }act(r.state,id,m);});
  client.on('close',()=>{r.clients.delete(id);if(id===r.host&&r.mode==='rooms')r.state.phase='disconnected';else if(r.state.phase==='waiting'){r.state.players=r.state.players.filter(p=>p.id!==id);if(id===r.host)r.host=null;}else if(['play','loading'].includes(r.state.phase))r.state.phase='disconnected';});
  // A TCP FIN can leave an upgraded socket half-open until the next write.
  // Loading intentionally sends no snapshots, so close it immediately.
  client.socket.once('end',()=>client.terminate());
 });
 const timer=setInterval(()=>{
  for(const [code,r]of rooms){
   if(Date.now()-r.born>sessionLifetime(r.route)){for(const c of r.clients.values())c.close(1001,'Session expired');rooms.delete(code);continue;}
   if(r.transition&&Date.now()-r.transition.at>90000){r.state.phase='disconnected';r.transition=null;}
   if(r.mode==='rooms'&&r.state.real&&r.state.phase!=='disconnected'){if(r.state.phase==='play'&&Date.now()-r.snapshotAt>2500&&!r.stalled){r.stalled=true;for(const c of r.clients.values())c.send({type:'host-paused',paused:true});}continue;}
   if(r.mode!=='rooms')tick(r.state,.05);const state={type:'state',state:snapshot(r.state)};for(const c of r.clients.values())c.send(state);
  }
 },50);timer.unref();
 return {server,rooms,close:()=>{clearInterval(timer);for(const c of hub.clients)c.terminate();hub.close();server.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.COOP_HOST==='0.0.0.0'&&(process.env.COOP_ALPHA_KEY||'').length<24)throw Error('Public binding requires COOP_ALPHA_KEY of at least 24 characters');
 const {server}=createCoopServer();const port=Number(process.env.PORT)||4488;
 server.listen(port,process.env.COOP_HOST||'127.0.0.1',()=>console.log(`Co-op review: http://127.0.0.1:${port}/`));
}
