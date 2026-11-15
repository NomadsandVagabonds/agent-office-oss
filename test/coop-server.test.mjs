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
   resolve({socket,messages,get closed(){return closed;},send(m){const body=Buffer.from(JSON.stringify(m)),mask=randomBytes(4);const header=body.length<126?Buffer.from([0x81,0x80|body.length]):Buffer.from([0x81,0xfe,body.length>>8,body.length&255]);socket.write(Buffer.concat([header,mask,Buffer.from(body.map((b,i)=>b^mask[i%4]))]));}});
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
