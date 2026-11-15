// Local two-browser integration check; no internet or microphone permission.
// Run: node tools/blockrooms/coop-browser-check.mjs (CHROME may override the executable).
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
import {createCoopServer} from './coop-server.mjs';
const app=createCoopServer({alphaKey:''});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${app.server.address().port}`;
// Optional reproducible visit, without changing the server's production seed policy.
if(process.env.COOP_TEST_SEED){const put=app.rooms.set;app.rooms.set=function(code,room){room.seed=process.env.COOP_TEST_SEED;return put.call(this,code,room);};}

const profile=fs.mkdtempSync(os.tmpdir()+'/coop-review-');let cdp;
const chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-background-timer-throttling','--disable-renderer-backgrounding','--no-sandbox','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1280,800','about:blank'],{stdio:'ignore'});
chrome.on('exit',(code,signal)=>console.log('Chrome exit',code,signal));
const errors=[];const sessions=[];
async function tab(url){const t=await(await fetch(cdp+'/json/new?'+encodeURIComponent('about:blank'),{method:'PUT'})).json();const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m.result);pending.delete(m.id);}else if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry.text);else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};const cmd=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},45000);pending.set(n,result=>{clearTimeout(timer);resolve(result);});ws.send(JSON.stringify({id:n,method,params}));});await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Log.enable');await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`window.WebSocket=class extends WebSocket {constructor(...args){super(...args);window.testSocket=this;this.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='state')window.testState=m.state;if(m.type==='welcome')window.testId=m.id;});}}`});await cmd('Page.navigate',{url});const ev=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};const s={cmd,ev,ws};sessions.push(s);return s;}
try{
 for(let n=0;n<80;n++){try{cdp='http://127.0.0.1:'+fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0];await fetch(cdp+'/json');break;}catch{await sleep(250);}}if(!cdp)throw Error('Chrome did not start; set CHROME to its executable');
 const a=await tab(origin+'/rooms?debug=1'+(process.argv.includes('--run')?'':'&slice=1'));await sleep(2500);await a.ev('document.getElementById("create").click()');await sleep(500);console.log('Early errors',errors);const invite=await a.ev('document.getElementById("invite").value');if(!invite)throw Error('No invite: '+await a.ev('document.body.innerText'));
 console.log('Visit seed:',app.rooms.get(new URL(invite).searchParams.get('room')).seed);const b=await tab(invite);await sleep(2500);console.log('A lobby:',await a.ev('document.getElementById("status").textContent'));console.log('B lobby:',await b.ev('document.getElementById("status").textContent'));
 for(let n=0;n<120;n++){if(await a.ev('!document.getElementById("ready").disabled')&&await b.ev('!document.getElementById("ready").disabled'))break;await sleep(500);}console.log('build errors',errors);await a.ev('document.getElementById("ready").click()');await b.ev('document.getElementById("ready").click()');await sleep(1000);
 console.log('Before vitals errors',errors);console.log('A vitals:',await a.ev('document.getElementById("vitals").textContent'));console.log('B vitals:',await b.ev('document.getElementById("vitals").textContent'));

 await a.cmd('Page.bringToFront');await sleep(2000);
 const inspect=()=>a.ev('(()=>{const r=__coop.runtime;if(!r)return null;const {sim,visitors}=r.inspect();return {sim:sim&&Object.fromEntries(Object.entries(sim).filter(([k])=>!["scene","collision"].includes(k))),creatures:r.world.env.pursuer.cast(),visitors:visitors.map(v=>({id:v.id,x:v.me.x,z:v.me.z,h:v.health}))}})()');
 let host=await inspect();assert.ok(host.sim?.real,'real floor started');
 if(process.argv.includes('--inventory')){
  await a.ev('(async()=>{const r=__coop.runtime,{sim,visitors}=r.inspect(),{makeItem}=await import("/world/backrooms/inventory-state.js");if(r.world.env.pursuer.figure)r.world.env.pursuer.figure.entryGrace=10000;for(const v of visitors){v.healthModel.heal(4);v.player.warp(r.start.x,r.start.z,0);}const p=sim.players[1];p.bag=[];p.inventory=null;for(const [type,id,extra] of [["paper","test-paper",{quantity:5}],["lighter","test-lighter",{}],["torch","test-torch",{charge:25}],["tape","test-tape",{}],["battery","test-battery",{}],["battery","test-battery-2",{}]]){sim.items.push({...makeItem(type,id,extra),owner:p.id,x:r.start.x,z:r.start.z,y:0});p.bag.push(id);}p.battery=150;visitors[0].player.warp(r.start.x+2,r.start.z,0);})()');await sleep(500);
  const key=async(k,code)=>{await b.cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code});await b.cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code});await sleep(200);};
  const click=async expr=>{await b.ev(expr+'.click()');await sleep(250);};
  const pocket=i=>click(`document.querySelector('.br-inv-slot[data-slot="${i}"]')`);
  const button=text=>click(`[...document.querySelectorAll('.br-inv-panel button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})`);
  const guest=async()=>{const s=await b.ev('testState');return s.players[1];};
  await key('i','KeyI');await pocket(2);await key('f','KeyF');assert.equal((await guest()).inventory.activeTorch,'test-torch');
  await key('Escape','Escape');await b.ev('document.getElementById("panel").hidden=true');await sleep(250);const handShot=await b.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-torch-hand.png',Buffer.from(handShot.data,'base64'));await key('i','KeyI');
  await pocket(0);const charge=(await guest()).inventory.slots[2].charge;await sleep(500);assert.equal((await guest()).inventory.slots[2].charge,charge,'stowed beam does not drain');
  await pocket(3);await button('Combine');await pocket(2);await button('Craft');assert.equal((await guest()).inventory.slots[2].prepared,true);
  await pocket(2);await button('Combine');await button('Camcorder +');await button('Craft');assert.equal((await guest()).inventory.mountedTorch.id,'test-torch');assert.equal((await guest()).bag.includes('test-torch'),false);
  await key('f','KeyF');assert.equal((await guest()).inventory.activeTorch,null);await key('f','KeyF');
  await pocket(4);await button('Combine');await click('document.querySelector(".br-inv-equipment-choice")');await button('Craft');assert.ok((await guest()).inventory.mountedTorch.charge>179);
  await pocket(5);await button('Combine');await button('Camcorder +');await button('Craft');assert.ok((await guest()).battery>260);
  await pocket(0);await button('Combine');await pocket(1);
  await click(`document.querySelector('[aria-label="Burn one more sheet"]')`);await click(`document.querySelector('[aria-label="Burn one more sheet"]')`);
  const shot=await b.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-crafting.png',Buffer.from(shot.data,'base64'));
  await button('Craft');const s=await b.ev('testState');assert.equal(s.effects.fires.length,1,JSON.stringify({result:s.players[1].inventoryResult,errors,status:await a.ev('document.getElementById("status").textContent')}));assert.equal(s.effects.fires[0].duration,24);assert.equal(s.players[1].inventory.slots[0].quantity,2);
  assert.equal(await b.ev('__coop.runtime.world.scene.getObjectByName("inventory-fire-1")?.visible'),true);
  const hostFire=await a.ev('__coop.runtime.world.env.inventory.fire.threatAt(__coop.state.effects.fires[0].wx,__coop.state.effects.fires[0].wz)');assert.ok(hostFire?.remaining>0,'shared fire reaches creature contract');
  const fear=await a.ev('(()=>{const r=__coop.runtime,p=r.world.env.pursuer.figure,f=__coop.state.effects.fires[0];p.x=f.wx+.7;p.z=f.wz;p.plinth=false;p.state="awake";p.entryGrace=0;r.step(.04,__coop.state);const result=!!p.fear?.flee;p.entryGrace=10000;return result;})()');assert.equal(fear,true,'actual pirate backs away from crafted fire');
  await a.ev('__coop.runtime.world.env.inventory.physical.update(25)');await sleep(350);assert.equal((await b.ev('testState')).effects.fires.length,0);assert.equal(await b.ev('__coop.runtime.world.scene.getObjectByName("inventory-fire-1")?.visible'),false);
  await key('Escape','Escape');await b.ev('document.getElementById("panel").hidden=true');const sceneShot=await b.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-flashlight.png',Buffer.from(sceneShot.data,'base64'));
  assert.equal(errors.length,0,JSON.stringify(errors));console.log('Production inventory UI, guest crafting, loose/mounted flashlight, camera refill and shared 24s fire passed');
 }else if(process.argv.includes('--run')){
  const saved=await a.ev('(()=>{const r=__coop.runtime,{sim,visitors}=r.inspect();const i=sim.items[0];i.owner=sim.players[0].id;sim.players[0].bag=[i.id];visitors[0].healthModel.damage(1);sim.players[0].inventory={slots:Array(6).fill(null),selected:0,mountedTorch:{id:"carried-light",type:"torch",charge:150,prepared:true},activeTorch:"carried-light"};if(r.world.env.pursuer.figure)r.world.env.pursuer.figure.entryGrace=10000;return {id:i.id,depths:sim.depths};})()');
  for(let depth=0;depth<saved.depths-1;depth++){
   const before=await inspect();assert.equal(before.sim.depth,depth);
   const result=await a.ev('(async()=>{const r=__coop.runtime,{visitors}=r.inspect(),g=await import("/world/backrooms/gen.js"),seam=await import("/world/backrooms/seam.js"),def=r.level.rooms[r.level.exit.room],way=r.level.exit.way;let x=0,z=0;if(way==="hole"){const q=seam.holeIn(def.W,def.D);x=(q[0]+q[2])/2;z=(q[1]+q[3])/2;}else if(way==="ledge")z=seam.ledgeAt(def.D)-.65;else if(way==="chute")z=seam.ductIn(def.D).z1-.35;else{const f=seam.flight(def.D,true);z=(f.back+f.zB)/2;}const at=g.toWorld(def,x,z);if(r.world.env.pursuer.figure)r.world.env.pursuer.figure.entryGrace=10000;visitors[1].player.warp(at.x,at.z,def.rot*Math.PI/2);for(let i=0;i<10;i++)r.step(.04,__coop.state);return {way,descent:r.inspect().sim.descent,phase:r.inspect().sim.phase};})()');
   assert.ok(result.descent,JSON.stringify(result));assert.equal(result.phase,'play','guest must wait for host');await sleep(300);
   await a.ev('(()=>{const {sim,visitors}=__coop.runtime.inspect();visitors[0].player.warp(sim.descent.x,sim.descent.z,0);})()');
   let next;for(let i=0;i<160;i++){await sleep(250);next=await inspect().catch(()=>null);if(next?.sim?.depth===depth+1&&next.sim.nodeCount&&next.sim.phase==='play')break;}
   if(next?.sim?.depth!==depth+1||next.sim.phase!=='play')console.log('Transition diagnostic',await a.ev('document.getElementById("status").textContent'),await b.ev('document.getElementById("status").textContent'),errors);
   assert.equal(next?.sim?.depth,depth+1,'both browsers built next floor');assert.equal(next.sim.phase,'play');
   const guest=await b.ev('testState');assert.equal(guest.depth,depth+1);assert.equal(guest.nodeCount,next.sim.nodeCount);assert.ok(next.sim.players[0].bag.includes(saved.id));assert.equal(next.sim.players[0].health,3);assert.equal(next.sim.players[0].inventory.mountedTorch.id,'carried-light');assert.ok(next.sim.players[0].inventory.mountedTorch.charge<=before.sim.players[0].inventory.mountedTorch.charge);assert.ok(next.sim.players[0].battery<=before.sim.players[0].battery);assert.equal(next.sim.items.filter(i=>i.id===saved.id).length,1);assert.ok(next.sim.items.length>1);assert.equal(guest.items.find(i=>i.id===saved.id).owner,next.sim.players[0].id);
   console.log('Shared descent:',result.way,'→',next.sim.depth,next.sim.theme,'health/battery/bag retained');
  }
  await a.ev('(async()=>{const r=__coop.runtime,{visitors}=r.inspect(),g=await import("/world/backrooms/gen.js"),{flight}=await import("/world/backrooms/seam.js"),def=r.level.rooms[r.level.exit.room],at=g.toWorld(def,0,flight(def.D,false).back+.24);if(r.world.env.pursuer.figure)r.world.env.pursuer.figure.entryGrace=10000;for(const v of visitors)v.player.warp(at.x,at.z,def.rot*Math.PI/2);})()');
  for(let i=0;i<45;i++){await a.ev('(()=>{const r=__coop.runtime,v=r.inspect().visitors[0];r.command(v.id,{type:"input",f:1,s:0,yaw:r.level.rooms[r.level.exit.room].rot*Math.PI/2,pitch:0})})()');await sleep(50);}
  assert.equal((await b.ev('testState')).phase,'escaped');assert.equal((await inspect()).sim.phase,'escaped');assert.equal(errors.length,0);console.log('Complete multi-floor run escaped in both browsers');
 }else{
 await a.ev('(()=>{const r=__coop.runtime;for(let i=0;i<240;i++)r.step(.04,__coop.state);})()');await sleep(500);
 host=await inspect();let sb=await b.ev('testState');
 assert.ok(sb.real);assert.ok(sb.nodeCount>100);assert.ok(sb.creatures.moth);assert.ok(sb.creatures.pirate);assert.ok(host.sim.time>8);
 await a.ev('(()=>{const r=__coop.runtime;if(r.world.env.pursuer.figure)r.world.env.pursuer.figure.entryGrace=10000;for(const v of r.inspect().visitors)v.healthModel.heal(4);})()');
 console.log('Shared cast:',sb.creatures,'nodes:',sb.nodeCount,'snapshot bytes:',JSON.stringify(sb).length);
 // The moth reacts to the guest independently of the pirate's host target.
 const led=await a.ev('(()=>{const r=__coop.runtime,{visitors}=r.inspect(),m=r.world.env.pursuer.cast().moth,v=visitors[1];let spot;for(let a=0;a<Math.PI*2;a+=.3){const x=m.x+Math.sin(a)*2,z=m.z+Math.cos(a)*2;if(r.world.free(x,z,.23)&&r.world.los(x,z,m.x,m.z)){spot={x,z};break;}}if(!spot)throw Error("No clear moth approach");v.player.warp(spot.x,spot.z,Math.atan2(spot.x-m.x,spot.z-m.z));v.me.pitch=0;for(let i=0;i<15;i++)r.step(.04,__coop.state);return r.world.env.pursuer.cast().moth.mode;})()');assert.equal(led,'fly');await sleep(300);assert.equal((await b.ev('testState')).creatures.moth.mode,'fly');console.log('Guest wakes the guide moth; both views share its flight');
 // Place both visitors at one real supply and race through both authenticated sockets.
 const item=await a.ev('(()=>{const r=__coop.runtime,{sim,visitors}=r.inspect(),i=sim.items[0];for(const v of visitors)v.player.warp(i.x,i.z,0);return i.id;})()');await sleep(300);
 await Promise.all([a.ev(`testSocket.send(JSON.stringify({type:'take',id:${JSON.stringify(item)}}))`),b.ev(`testSocket.send(JSON.stringify({type:'take',id:${JSON.stringify(item)}}))`)]);await sleep(500);
 host=await inspect();sb=await b.ev('testState');assert.equal(host.sim.players.filter(p=>p.bag.includes(item)).length,1);assert.equal(sb.items.find(i=>i.id===item).owner,host.sim.items.find(i=>i.id===item).owner);console.log('Contested real pickup has one shared owner');
 if(process.argv.includes('--social')){
  assert.ok(sb.items.filter(i=>i.type==='battery').length>=6,'two-player refill budget');
  const kit=await a.ev('(()=>{const {sim}=__coop.runtime.inspect();for(const p of sim.players)p.bag=[];for(const i of sim.items)i.owner=null;const snack=sim.items.find(i=>i.type==="snack"),battery=sim.items.find(i=>i.type==="battery");snack.owner=sim.players[0].id;battery.owner=sim.players[1].id;sim.players[0].bag=[snack.id];sim.players[1].bag=[battery.id];return {snack:snack.id,battery:battery.id};})()');await sleep(300);
  const key=async(k,code)=>{await a.cmd('Input.dispatchKeyEvent',{type:'keyDown',key:k,code});await a.cmd('Input.dispatchKeyEvent',{type:'keyUp',key:k,code});};
  const aim=async()=>{await a.ev('document.getElementById("panel").hidden=true');for(const type of ['mousePressed','mouseReleased'])await a.cmd('Input.dispatchMouseEvent',{type,x:100,y:200,button:'left',clickCount:1});await sleep(100);assert.equal(await a.ev('document.pointerLockElement?.id'),'view');};
  await aim();await key('e','KeyE');await sleep(300);
  assert.match(await b.ev('document.getElementById("socialPanel").textContent'),/wants to trade/);
  await b.ev('[...document.querySelectorAll("#socialPanel button")].find(b=>b.textContent==="Accept trade").click()');await sleep(300);
  await a.ev(`document.querySelector('[data-item="${kit.snack}"]').click()`);await sleep(250);
  await a.ev('document.getElementById("tradeConfirm").click()');await sleep(250);
  await b.ev(`document.querySelector('[data-item="${kit.battery}"]').click()`);await sleep(250);
  assert.deepEqual((await b.ev('testState')).trade.confirmed,[],'edited offer resets both confirmations');
  const socialShot=await a.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-trade.png',Buffer.from(socialShot.data,'base64'));
  await a.ev('document.getElementById("tradeConfirm").click()');await b.ev('document.getElementById("tradeConfirm").click()');await sleep(400);
  sb=await b.ev('testState');assert.equal(sb.trade,null);assert.deepEqual(sb.players.map(p=>p.bag),[[kit.battery],[kit.snack]]);
  for(const peer of [a,b])await peer.ev('[...document.querySelectorAll("#socialPanel button")].find(b=>b.textContent==="Back to camera").click()');
  await aim();await key('b','KeyB');await a.ev('[...document.querySelectorAll("#socialPanel button")].find(b=>b.textContent.includes("wave")).click()');await sleep(300);assert.equal((await b.ev('testState')).players[0].emote.kind,'wave');
  const reviveSnack=await a.ev('(()=>{const {sim,visitors}=__coop.runtime.inspect();const snack=sim.items.find(i=>i.type==="snack"&&i.owner===null);snack.owner=sim.players[0].id;sim.players[0].bag.push(snack.id);visitors[1].healthModel.damage(4);visitors[1].record.battery=0;return snack.id;})()');await sleep(300);
  assert.equal((await b.ev('testState')).players[1].health,0);
  await aim();await key('2','Digit2');await sleep(150);await key('e','KeyE');await sleep(300);
  sb=await b.ev('testState');assert.equal(sb.players[1].health,1);assert.ok(sb.players[1].battery>119);assert.equal(sb.items.find(i=>i.id===reviveSnack).owner,'used');assert.equal(sb.items.find(i=>i.id===kit.battery).owner,'used');
  await a.ev('(()=>{for(const v of __coop.runtime.inspect().visitors){v.healthModel.tick(2);v.healthModel.heal(4);}})()');
  console.log('Trade consent, changed-offer reconfirmation, shared emote and flat-camera revive passed');
 }
 // Guest control travels through server and moves the production player controller.
 await a.ev('(()=>{const r=__coop.runtime,{visitors}=r.inspect(),v=visitors[1];for(const room of r.level.rooms){for(let z=room.cz-1;z<=room.cz+1;z+=.5)for(let x=room.cx-1;x<=room.cx+1;x+=.5)if([0,.2,.4,.6,.8,1].every(d=>r.world.free(x,z-d,.23))){v.player.warp(x,z,0);return;}}})()');await sleep(300);
 const before=(await inspect()).visitors[1];
 for(let i=0;i<10;i++){await b.ev('testSocket.send(JSON.stringify({type:"input",f:1,s:0,yaw:0,pitch:0}))');await sleep(70);}
 const after=(await inspect()).visitors[1];assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.15,'guest moves');console.log('Guest movement distance:',Math.hypot(after.x-before.x,after.z-before.z));
 // A real door refuses to close on either visitor, and a guest can operate it.
 const blockedDoor=await a.ev('(()=>{const r=__coop.runtime,w=r.world,{visitors}=r.inspect();const use=w.rooms.flatMap(rt=>rt.uses).find(u=>u.label==="the doors");if(!use)return null;const d=use.door;visitors[0].player.warp(d.x,d.z,0);const pt=d.point(0,1);visitors[1].player.warp(pt.x,pt.z,Math.atan2(pt.x-d.x,pt.z-d.z));return {closed:w.env.doors.shut(d),id:d.id};})()');assert.ok(blockedDoor);assert.equal(blockedDoor.closed,false,'door cannot shut on partner');
 await sleep(300);const door=await a.ev('(()=>{const r=__coop.runtime,w=r.world,{visitors}=r.inspect(),use=w.rooms.flatMap(rt=>rt.uses).find(u=>u.label==="the doors"),d=use.door;const far=d.point(0,3);visitors[0].player.warp(far.x,far.z,0);return {id:d.id,open:d.throat.open};})()');
 if(door){await b.ev('testSocket.send(JSON.stringify({type:"exit"}))');await sleep(1200);const d=await a.ev(`__coop.runtime.world.throats.find(t=>t.link.id===${door.id}).open`);const bd=await b.ev(`__coop.runtime.world.throats.find(t=>t.link.id===${door.id}).open`);assert.equal(d,false,'guest closes real door');assert.equal(d,bd);console.log('Shared door collision:',d);}
 // Hide the authority, observe explicit pause, resume.
 await b.cmd('Page.bringToFront');await sleep(500);assert.match(await b.ev('document.getElementById("notice").textContent'),/Host tab paused/);await a.cmd('Page.bringToFront');await sleep(500);assert.doesNotMatch(await b.ev('document.getElementById("notice").textContent'),/Host tab paused/);console.log('Host pause and resume communicated');
 await b.ev('document.getElementById("panel").hidden=true');const shot=await b.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-real-rooms.png',Buffer.from(shot.data,'base64'));
 // Exercise the actual taped wall tick with the guest, without ending a distant host's run.
 await a.ev('(async()=>{const r=__coop.runtime,{visitors}=r.inspect(),g=await import("/world/backrooms/gen.js"),{flight}=await import("/world/backrooms/seam.js"),def=r.level.rooms[r.level.exit.room],back=flight(def.D,false).back,at=g.toWorld(def,0,back+.24),v=visitors[1];visitors[0].player.warp(r.level.start.x,r.level.start.z,0);v.player.warp(at.x,at.z,def.rot*Math.PI/2);for(let i=0;i<80;i++){r.command(v.id,{type:"input",f:1,s:0,yaw:def.rot*Math.PI/2,pitch:0});r.step(.04,__coop.state);}return r.inspect().sim.exitOpen;})()').then(open=>assert.equal(open,true,'guest opened real taped wall'));await sleep(300);
 sb=await b.ev('testState');assert.equal(sb.exitOpen,true);assert.equal(sb.phase,'play','distant host must catch up');console.log('Guest opens real exit; it waits for distant teammate');
 // Put the guest in reach of the actual pirate, with the host safely away.
 await a.ev('(()=>{const r=__coop.runtime,w=r.world,{visitors}=r.inspect(),v=visitors[1],p=w.env.pursuer.figure;visitors[0].player.warp(r.level.start.x,r.level.start.z,0);visitors[0].me.pitch=1.2;v.player.warp(p.x,p.z-.6,0);v.me.pitch=1.2;v.healthModel.damage(2);v.healthModel.tick(2);p.plinth=false;p.state="awake";p.know.spent=0;p.entryGrace=0;for(let i=0;i<100;i++)r.step(.04,__coop.state);})()');await sleep(500);
 host=await inspect();sb=await b.ev('testState');console.log('Pirate catch:',sb.players.map(p=>p.health),sb.creatures.pirate.state);assert.equal(sb.players[1].health,0,'actual pirate caught guest');assert.equal(sb.players[0].health,4);assert.equal(sb.phase,'play');assert.notEqual(sb.creatures.pirate.state,'caught','pirate continues after a teammate dies');
 if(process.argv.includes('--escape')){await a.ev('(()=>{const {sim,visitors}=__coop.runtime.inspect();visitors[0].player.warp(sim.exit.x,sim.exit.z,0)})()');await sleep(400);sb=await b.ev('testState');assert.equal(sb.phase,'escaped');console.log('Survivor reaches opened real wall; both views end as escaped');}
 else{await a.ev('(()=>{const {visitors}=__coop.runtime.inspect();visitors[0].record.battery=.01})()');await sleep(400);sb=await b.ev('testState');assert.equal(sb.phase,'dead');assert.equal(sb.players[0].health,0);console.log('One pirate kill preserves run; last empty camera ends both views');}
 console.log('Browser errors:',JSON.stringify(errors));if(errors.length||!sb?.real)process.exitCode=1;
 }
}finally{sessions.forEach(s=>s.ws.close());chrome.kill();app.close();await sleep(300);fs.rmSync(profile,{recursive:true,force:true});}
