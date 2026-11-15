// Isolated review server: no Office daemon, credentials or leaderboard routes.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {WsHub} from '../../server/ws.mjs';
import {VERSION,createSession,join,act,tick,snapshot} from '../../core/coop.js';
import {validVoicePacket} from '../../core/coop-voice.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function createCoopServer({alphaKey=process.env.COOP_ALPHA_KEY||''}={}) {
 const rooms=new Map();
 const server=http.createServer(async(req,res)=>{
  try {
   const u=new URL(req.url,'http://local'),p=decodeURIComponent(u.pathname);
   if(p==='/health'){res.writeHead(200,{'content-type':'text/plain'}).end('ok');return;}
   if(p==='/new'&&req.method==='POST') {
    const hash=v=>createHash('sha256').update(String(v)).digest();
    if(alphaKey&&!timingSafeEqual(hash(req.headers['x-alpha-key']||''),hash(alphaKey))){res.writeHead(403).end('Private alpha: host passcode required');return;}
    if(rooms.size>=64){res.writeHead(503).end('Review server full');return;}
    const code=randomBytes(16).toString('hex');rooms.set(code,{state:createSession(),clients:new Map(),born:Date.now()});
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify({code}));return;
   }
   const rel=p==='/'?'public/world/coop/index.html':['/core/coop.js','/core/look.mjs','/core/coop-voice.js'].includes(p)?p.slice(1):`public${p}`;
   const file=path.resolve(root,rel);
   if(!file.startsWith(path.join(root,'public')+path.sep)&&!['core/coop.js','core/look.mjs','core/coop-voice.js'].some(p=>file===path.join(root,p))){res.writeHead(404).end();return;}
   const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg'};
   const data=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store','X-Content-Type-Options':'nosniff','Permissions-Policy':'microphone=(self), camera=()'}).end(data);
  }catch{res.writeHead(404).end('Not found');}
 });
 const hub=new WsHub({maxPayload:2048,maxBuffered:65536,verify:req=>{
  try {return new URL(req.url,'http://local').pathname==='/socket'&&new URL(req.headers.origin).host===req.headers.host;}catch{return false;}
 }});
 server.on('upgrade',(req,socket,head)=>hub.handleUpgrade(req,socket,head));
 hub.on('connect',(client,req)=>{
  const q=new URL(req.url,'http://local').searchParams,r=rooms.get(q.get('room'));
  if(q.get('v')!==VERSION||!r||!join(r.state,String(client.id))){client.close(1008,'Room full, started, expired, or version mismatch');return;}
  const id=String(client.id);r.clients.set(id,client);client.send({type:'welcome',id,version:VERSION});
  let budget=80,voiceBudget=30,lastVoice=-1,window=Date.now();
  client.on('message',m=>{if(Date.now()-window>1000){budget=80;voiceBudget=30;window=Date.now();}if(--budget<0){client.close(1008,'Too many messages');return;}if(m.type==='voice'){if(!validVoicePacket(m)||--voiceBudget<0||m.seq<=lastVoice)return;lastVoice=m.seq;for(const [other,c]of r.clients)if(other!==id)c.send(m);return;}act(r.state,id,m);});
  client.on('close',()=>{r.clients.delete(id);if(r.state.phase==='waiting')r.state.players=r.state.players.filter(p=>p.id!==id);else if(r.state.phase==='play')r.state.phase='disconnected';});
 });
 const timer=setInterval(()=>{
  for(const [code,r]of rooms){
   if(Date.now()-r.born>60*60*1000){for(const c of r.clients.values())c.close(1001,'Session expired');rooms.delete(code);continue;}
   tick(r.state,.05);const state={type:'state',state:snapshot(r.state)};for(const c of r.clients.values())c.send(state);
  }
 },50);timer.unref();
 return {server,rooms,close:()=>{clearInterval(timer);for(const c of hub.clients)c.terminate();hub.close();server.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.env.COOP_HOST==='0.0.0.0'&&(process.env.COOP_ALPHA_KEY||'').length<24)throw Error('Public binding requires COOP_ALPHA_KEY of at least 24 characters');
 const {server}=createCoopServer();const port=Number(process.env.PORT)||4488;
 server.listen(port,process.env.COOP_HOST||'127.0.0.1',()=>console.log(`Co-op review: http://127.0.0.1:${port}/`));
}
