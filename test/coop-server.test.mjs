import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {FrameParser} from '../server/ws.mjs';
import {createCoopServer} from '../tools/blockrooms/coop-server.mjs';
import {VERSION,spot} from '../core/coop.js';
function wire(port,room,origin=`http://127.0.0.1:${port}`,version=VERSION){
 return new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path:`/socket?room=${room}&v=${version}`,headers:{Origin:origin,Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':randomBytes(16).toString('base64')}});
  req.on('error',reject);req.on('response',r=>resolve({status:r.statusCode}));
  req.on('upgrade',(res,socket,head)=>{
   const parser=new FrameParser({requireMask:false}),messages=[];let closed=false;
   const read=chunk=>parser.push(chunk,f=>{if(f.opcode===1)messages.push(JSON.parse(f.payload));if(f.opcode===8){closed=true;socket.destroy();}});
   socket.on('data',read);socket.on('error',()=>{});if(head.length)read(head);
   resolve({socket,messages,get closed(){return closed;},send(m){const body=Buffer.from(JSON.stringify(m)),mask=randomBytes(4);const header=body.length<126?Buffer.from([0x81,0x80|body.length]):body.length<=65535?Buffer.from([0x81,0xfe,body.length>>8,body.length&255]):Buffer.alloc(10);if(body.length>65535){header[0]=0x81;header[1]=0xff;header.writeBigUInt64BE(BigInt(body.length),2);}socket.write(Buffer.concat([header,mask,Buffer.from(body.map((b,i)=>b^mask[i%4]))]));}});
  });req.end();
 });
}
async function until(fn){for(let n=0;n<100;n++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');}
test('two real sockets share one authoritative pickup; third player/version/origin rejected; disconnect freezes session',async t=>{
 const app=createCoopServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const port=app.server.address().port;
 const {code}=await(await fetch(`http://127.0.0.1:${port}/new`,{method:'POST'})).json();
 const a=await wire(port,code),b=await wire(port,code);t.after(()=>{a.socket.destroy();b.socket.destroy();});
 const aw=await until(()=>a.messages.find(m=>m.type==='welcome')),bw=await until(()=>b.messages.find(m=>m.type==='welcome'));
 const third=await wire(port,code);await until(()=>third.closed);
 const wrong=await wire(port,code,undefined,'old');await until(()=>wrong.closed);
 assert.equal((await wire(port,code,'http://evil.invalid')).status,403);
 const voice={type:'voice',seq:0,pcm:Buffer.alloc(1280).toString('base64')};
 a.send(voice);await until(()=>b.messages.some(m=>m.type==='voice'));assert.equal(a.messages.some(m=>m.type==='voice'),false);
 a.send(voice);a.send({...voice,seq:1,pcm:'invalid'});await new Promise(r=>setTimeout(r,60));assert.equal(b.messages.filter(m=>m.type==='voice').length,1);
 a.send({type:'ready'});b.send({type:'ready'});await until(()=>a.messages.some(m=>m.state?.phase==='play'));
 const s=app.rooms.get(code).state;for(const p of s.players)Object.assign(p,spot(2,2));
 a.send({type:'take',id:'supply-0'});b.send({type:'take',id:'supply-0'});
 await until(()=>s.items[0].owner!==null);assert.equal(s.players.reduce((n,p)=>n+p.bag.length,0),1);
 for(const peer of [a,b])await until(()=>peer.messages.some(m=>m.state?.items[0].owner===s.items[0].owner));
 assert.ok([aw.id,bw.id].includes(s.items[0].owner));
 b.socket.destroy();await until(()=>s.phase==='disconnected');
});
test('private deployment only lets the host create rooms',async t=>{
 const alphaKey='test-only-private-host-key-12345',app=createCoopServer({alphaKey});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url=`http://127.0.0.1:${app.server.address().port}/new`;
 assert.equal((await fetch(url,{method:'POST'})).status,403);
 assert.equal((await fetch(url,{method:'POST',headers:{'x-alpha-key':'wrong'}})).status,403);
 assert.equal((await fetch(url,{method:'POST',headers:{'x-alpha-key':alphaKey}})).status,200);
});
test('real-room controls go only to the host; guests cannot publish world state',async t=>{
 const app=createCoopServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const port=app.server.address().port;
 const {code}=await(await fetch(`http://127.0.0.1:${port}/new?mode=rooms`,{method:'POST'})).json();
 const a=await wire(port,code),b=await wire(port,code);t.after(()=>{a.socket.destroy();b.socket.destroy();});
 const aw=await until(()=>a.messages.find(m=>m.type==='welcome')),bw=await until(()=>b.messages.find(m=>m.type==='welcome'));assert.equal(aw.host,true);assert.equal(bw.host,false);assert.equal(aw.seed,bw.seed);
 a.send({type:'ready'});b.send({type:'ready'});await until(()=>a.messages.some(m=>m.state?.phase==='play'));
 b.send({type:'input',f:1,s:0,yaw:0,pitch:0});assert.equal((await until(()=>a.messages.find(m=>m.type==='control'))).id,bw.id);
 assert.equal(b.messages.some(m=>m.type==='control'),false);
 const s=app.rooms.get(code).state;s.real=true;s.nodeCount=1;s.nodes=[];
 a.send({type:'real-state',state:s});await until(()=>b.messages.some(m=>m.state?.real));
 b.send({type:'real-state',state:s});await until(()=>b.closed);assert.equal(app.rooms.get(code).state.phase,'disconnected');
 a.send({type:'real-state',state:{...s,phase:'play'}});await new Promise(r=>setTimeout(r,80));assert.equal(app.rooms.get(code).state.phase,'disconnected','in-flight host snapshot cannot revive a disconnected session');
});
test('real floor loading waits for both clients and ignores old-floor snapshots and commands',async t=>{
 const app=createCoopServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const port=app.server.address().port;
 const {code}=await(await fetch(`http://127.0.0.1:${port}/new?mode=rooms`,{method:'POST'})).json();
 const a=await wire(port,code),b=await wire(port,code);t.after(()=>{a.socket.destroy();b.socket.destroy();});
 await until(()=>b.messages.some(m=>m.type==='welcome'));a.send({type:'ready'});b.send({type:'ready'});await until(()=>a.messages.some(m=>m.state?.phase==='play'));
 const r=app.rooms.get(code),s={...structuredClone(r.state),real:true,depth:0,depths:3,nodeCount:1,nodes:[],phase:'descending'};
 a.send({type:'real-state',state:s});await until(()=>b.messages.some(m=>m.type==='floor-load'));assert.equal(r.state.phase,'loading');
 a.send({type:'floor-ready',depth:1});a.send({type:'floor-ready',depth:1});b.send({type:'floor-ready',depth:0});
 await new Promise(r=>setTimeout(r,80));assert.equal(r.state.phase,'loading');
 b.send({type:'floor-ready',depth:1});await until(()=>b.messages.some(m=>m.type==='floor-start'));assert.equal(r.depth,1);
 a.send({type:'real-state',state:{...s,phase:'play'}});b.send({type:'input',depth:0,f:1,s:0,yaw:0,pitch:0});
 await new Promise(r=>setTimeout(r,80));assert.equal(r.state.depth,1);assert.equal(a.messages.some(m=>m.type==='control'),false);
 b.send({type:'input',depth:1,f:1,s:0,yaw:0,pitch:0});await until(()=>a.messages.some(m=>m.type==='control'));
 a.send({type:'real-state',state:{...s,depth:1}});await until(()=>r.state.phase==='loading');b.socket.destroy();await until(()=>r.state.phase==='disconnected');
 a.send({type:'floor-ready',depth:2});await new Promise(r=>setTimeout(r,80));assert.equal(r.state.phase,'disconnected');
});
test('hosted entry opens the full-run lobby and keeps room creation passcode-protected',async t=>{
 const app=createCoopServer({defaultRooms:true,alphaKey:'test-private-key'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const root=`http://127.0.0.1:${app.server.address().port}`;
 const page=await fetch(root,{redirect:'manual'});assert.equal(page.status,302);assert.equal(page.headers.get('location'),'/rooms');
 assert.equal((await fetch(root+'/new?mode=rooms',{method:'POST'})).status,403);
 assert.equal(await(await fetch(root+'/health')).text(),'ok');
 const presets=await fetch(root+'/core/guest-presets.mjs');assert.equal(presets.status,200);assert.match(await presets.text(),/pink-cowgirl/);
 for(const [asset,type] of [['lobby.css','text/css'],['art/logo.svg','image/svg+xml']]){
  const res=await fetch(root+'/world/coop/'+asset);assert.equal(res.status,200);
  assert.equal(res.headers.get('content-type'),type);assert.equal(res.headers.get('x-content-type-options'),'nosniff');
 }
});

test('custom characters: host assigns either slot, guest chooses only their own, and selection locks at Ready',async t=>{
 const app=createCoopServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const port=app.server.address().port;
 const {code}=await(await fetch(`http://127.0.0.1:${port}/new?mode=rooms`,{method:'POST'})).json();
 const a=await wire(port,code);t.after(()=>a.socket.destroy());await until(()=>a.messages.some(m=>m.type==='welcome'));
 a.send({type:'character',slot:1,character:'yellow-alien'});await until(()=>app.rooms.get(code).characters[1]==='yellow-alien');
 const b=await wire(port,code);t.after(()=>b.socket.destroy());await until(()=>b.messages.some(m=>m.type==='welcome'));
 const s=app.rooms.get(code).state;assert.equal(s.players[1].character,'yellow-alien','host can prepare friend before arrival');
 b.send({type:'character',slot:0,character:'pink-cowgirl'});b.send({type:'character',slot:1,character:'untrusted-model'});
 await new Promise(r=>setTimeout(r,80));assert.deepEqual(s.players.map(p=>p.character),['yellow-alien','yellow-alien']);
 a.send({type:'ready'});await until(()=>s.players[0].ready);
 b.send({type:'character',slot:1,character:'pink-cowgirl'});await until(()=>s.players[1].character==='pink-cowgirl');assert.equal(s.players[0].ready,false,'a changed choice resets readiness');
 a.send({type:'ready'});b.send({type:'ready'});await until(()=>s.phase==='play');
 a.send({type:'character',slot:1,character:'yellow-alien'});await new Promise(r=>setTimeout(r,80));assert.equal(s.players[1].character,'pink-cowgirl');
});

test('real scene baseline larger than 512 KiB reaches the partner without closing the relay',async t=>{
 const app=createCoopServer();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const port=app.server.address().port;
 const {code}=await(await fetch(`http://127.0.0.1:${port}/new?mode=rooms`,{method:'POST'})).json();
 const a=await wire(port,code),b=await wire(port,code);t.after(()=>{a.socket.destroy();b.socket.destroy();});
 await until(()=>b.messages.some(m=>m.type==='welcome'));a.send({type:'ready'});b.send({type:'ready'});await until(()=>app.rooms.get(code).state.phase==='play');
 const s=structuredClone(app.rooms.get(code).state);s.real=true;s.nodeCount=20000;s.nodes=Array.from({length:s.nodeCount},(_,i)=>[i,0,0,0,0,0,0,1,1,1,1,1]);
 assert.ok(Buffer.byteLength(JSON.stringify(s))>524288);a.send({type:'real-state',state:s});
 await until(()=>b.messages.some(m=>m.state?.real));assert.equal(b.messages.find(m=>m.state?.real).state.nodes.length,20000);assert.equal(a.closed,false);
});
