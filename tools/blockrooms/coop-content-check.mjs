// Local two-browser integration check; no internet or microphone permission.
// Run: node tools/blockrooms/coop-content-check.mjs (CHROME may override the executable).
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
 for(let n=0;n<80;n++){try{cdp='http://127.0.0.1:'+fs.readFileSync(profile+'/DevToolsActivePort','utf8').split('\n')[0];await fetch(cdp+'/json');break;}catch{await sleep(250);}}
 const a=await tab(origin+'/rooms?debug=1'),b=await tab(origin+'/rooms?debug=1');await sleep(1000);
 for(const [peer,isHost]of [[a,true],[b,false]])await peer.ev(`(async()=>{
 const THREE=await import('three'),{createRealRooms}=await import('/world/coop/real-rooms.js');
 const canvas=document.createElement('canvas');canvas.style='position:fixed;inset:0;z-index:10000';document.body.append(canvas);
 const renderer=new THREE.WebGLRenderer({canvas});renderer.setSize(960,600);const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1.6,.05,100);
 window.review={scene,camera,renderer,r:null};window.makeReview=async(seed,options)=>{review.r?.dispose();const visit=options.finale?(await import("/world/coop/showcase-preview.js")).previewFloor(3):null;review.r=await createRealRooms(seed,${isHost},scene,{slice:true,planOptions:options,visit});};
 window.drawReview=()=>{const r=review.r,rt=r.world.rooms.find(rt=>rt.def.arch);const def=rt?.def||r.level.rooms[0];camera.position.set(def.cx,def.y+1.25,def.cz+Math.min(2,def.D/3));camera.lookAt(def.cx,def.y+1,def.cz-4);renderer.render(scene,camera);};
 })()`);
 const {DECK}=await import('../../public/world/backrooms/gen.js');
 const selected=process.env.COOP_CHECK_ROOMS?.split(',');
 const cases=process.argv.includes('--bridge')?['bridge-gap','bridge-lines'].map(id=>({id,options:{only:'the-culvert',themes:['suburb'],members:id==='bridge-lines'?['the-lines']:[]}})):process.argv.includes('--finale')?[{id:'showcase-finale',options:{only:'mecha',finale:true}}]:DECK.filter(a=>!selected||selected.includes(a.id)).map(a=>({id:a.id,options:{only:a.id,themes:[a.themes?.suburb?'suburb':'yellow'],members:[]}}));
 if(!selected&&!process.argv.includes('--finale')&&!process.argv.includes('--bridge'))for(const member of ['pirate','moth','shadow','porter','toner','other-door'])cases.push({id:'cast-'+member,options:{only:member==='the-lines'?'the-culvert':'ceiling-meeting',themes:[member==='the-lines'?'suburb':'yellow'],members:[member]}});
 if(process.env.COOP_CAST)for(const member of process.env.COOP_CAST.split(','))cases.push({id:'cast-'+member,options:{only:member==='the-lines'?'the-culvert':'ceiling-meeting',themes:[member==='the-lines'?'suburb':'yellow'],members:[member]}});
 const {exercise}=await import('./coop-encounters.mjs');
 const {createSceneSender}=await import('../../public/world/coop/scene-wire.js');
 const results=[];
 for(const c of cases){
  const seed='coverage-'+c.id,opts=JSON.stringify(c.options),start=errors.length;
  await a.ev(`makeReview(${JSON.stringify(seed)},${opts})`);await b.ev(`makeReview(${JSON.stringify(seed)},${opts})`);
  await a.ev(`(async()=>{const {createSession,join,act}=await import('/core/coop.js'),r=review.r,s=createSession('test');join(s,'a');join(s,'b');act(s,'a',{type:'ready'});act(s,'b',{type:'ready'});r.step(.05,s);review.state=r.inspect().sim;const rt=r.world.rooms.find(rt=>rt.def.arch===${JSON.stringify(c.options.only)}),def=rt.def;
  for(const [i,v]of r.inspect().visitors.entries()){v.player.warp(def.cx+i*.7,def.cz,0);v.healthModel.heal(4);v.record.battery=390;}
  review.initialNodes=r.inspect().nodes.length;
  })()`);
  if(process.argv.includes('--encounters'))console.log('Encounter',c.id,await a.ev(`(${exercise.toString()})(review.r,${JSON.stringify(c.id)})`));
  const checkpoints=await a.ev('review.bridgeChecks||[]');
  for(const cp of checkpoints){
   await b.ev(`review.r.apply(${JSON.stringify(cp.state)})`);
   const floor=await b.ev(`review.r.world.floorY(${cp.x},${cp.z})`);assert.ok(Math.abs(floor-cp.floor)<1e-6,c.id+' guest floor '+cp.label);
  }
  const sendScene=createSceneSender();
  for(let pass=0;pass<3;pass++){
   const packet=await a.ev(`(()=>{const r=review.r;let out;for(let n=0;n<20;n++)out=r.step(.05,review.state);while(!out)out=r.step(.05,review.state);return JSON.stringify(out)})()`);
   assert.ok(packet.length<1000000,`${c.id}: snapshot ${packet.length} bytes`);
   const {validRealSnapshot}=await import('../../core/coop-real.js');assert.equal(validRealSnapshot(JSON.parse(packet),['a','b']),true,c.id+' snapshot valid');
   const wire=JSON.stringify(sendScene(JSON.parse(packet)));
   await b.ev(`review.r.apply(JSON.parse(${JSON.stringify(wire)}))`);
  }
  const detail=await a.ev(`(()=>{const r=review.r,s=r.inspect().sim;return {id:${JSON.stringify(c.id)},picked:r.level.picked,cast:Object.keys(r.world.env.pursuer.cast()),residents:r.world.env.denizens.all().length,nodes:s.nodeCount,bytes:JSON.stringify(s).length,furniture:r.world.furniture.length,lighting:r.world.rooms.filter(rt=>rt.lighting).length,added:s.scene.added.length}})()`);
  const signatures=await Promise.all([a,b].map(peer=>peer.ev(`(()=>{const {nodes}=review.r.inspect();let h=0;for(const n of nodes)for(const k of [...n.position.toArray(),...n.quaternion.toArray(),n.visible?1:0])h=(Math.imul(h,31)+Math.round(k*1000))|0;return h;})()`)));
  assert.equal(signatures[0],signatures[1],c.id+' scene agrees');
  assert.deepEqual(errors.slice(start),[],c.id+' browser errors');
  for(const peer of [a,b])await peer.ev('drawReview()');
  if(['cast-mother','cast-the-lines'].includes(c.id)){
   const at=await a.ev(`review.r.world.env.pursuer.of(${JSON.stringify(c.id.slice(5))}).at()`);
   for(const peer of [a,b])await peer.ev(`(()=>{const p=${JSON.stringify(at)},w=review.r.world;let eye={x:p.x,z:p.z+2.8};for(let a=0;a<Math.PI*2;a+=Math.PI/4){const x=p.x+Math.sin(a)*2.8,z=p.z+Math.cos(a)*2.8;if(w.free(x,z,.2)&&w.los(x,z,p.x,p.z)){eye={x,z};break;}}review.camera.position.set(eye.x,w.floorY(p.x,p.z)+1.4,eye.z);review.camera.lookAt(p.x,w.floorY(p.x,p.z)+1.1,p.z);review.renderer.render(review.scene,review.camera);})()`);
  }
  if(['dispatch','show-home','mecha','last-light','cast-mother','cast-the-lines'].includes(c.id)){const shot=await b.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(os.tmpdir()+'/coop-full-'+c.id+'.png',Buffer.from(shot.data,'base64'));}
  results.push(detail);console.log(JSON.stringify(detail));fs.writeFileSync('/tmp/coop-content-results.json',JSON.stringify(results,null,2));
 }
 console.log('PASS',results.length,'two-client room/cast build and snapshot checks. Behaviour encounter tests are separate.');
}finally{sessions.forEach(s=>s.ws.close());chrome.kill();app.close();await sleep(300);fs.rmSync(profile,{recursive:true,force:true});}
