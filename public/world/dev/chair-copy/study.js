import * as T from 'three';
import { toLocal, toWorld } from '../../backrooms/frame.js';
import { boxHits, worldFootprint } from '../../backrooms/furniture-policy.js';
import { registerMovable } from '../../backrooms/movable-props.js';
import { CLOTH } from './misprint.js';
import { Batch } from '../../backrooms/kit.js';
import { readStock, stockIds, stockLabel } from './stock.js';
import { developEdition, editionNames } from './editions.js';
import { createViewfinder } from './viewfinder.js';
import { SECONDS, createTransfer } from './transfer.js';
import { frameTest } from './timing.js';
import { buildItemProp } from '../../backrooms/hand.js';
import { drawPositive } from './positive.js';

const REACH=4.8;
export function prepareRoom(level,builders){
  const def=level.rooms[level.start.room];
  builders.start=c=>{
    c.shell();
    const x=-c.W*.215,z=Math.min(1,c.D*.15);
    const desktop=.65, deskCollider=c.solid(x-.8,z-.4,x+.8,z+.4,{top:desktop,keep:true});
    c.shadow(x,z,1.6,.8,.35);
    const camera=buildItemProp(c.kit,'carbon-camera'), px=x+.49, pz=z+.10;
    camera.name='carbon-camera-pickup';
    camera.position.set(px,desktop+.003,pz);camera.rotation.y=2.63;c.add(camera);
    c.after.push(()=>camera.userData.light(c.sample(px,desktop+.12,pz)));
    const use=c.use({x:px,z:pz,r:1.38,inventoryItem:true,label:'Carbon Camera',
      when:()=>camera.visible,use:()=>c.env.carbonCopy?.take()});
    c.rt.carbonDesk={camera,use,x,z,desktop,deskCollider};
    c.leave('battery',1.65,1.70);
    c.prop('chair',0,0,{o:{color:CLOTH}});
  };
  const p=toWorld(def,0,Math.min(2,def.D/2-.55));
  Object.assign(level.start,{x:p.x,z:p.z,yaw:def.rot*Math.PI/2});
}

function panel(){
  const el=document.createElement('aside');el.dataset.lightingStudy='';el.id='chair-copy';
  el.innerHTML=`<style>
  #chair-copy{position:fixed;bottom:13px;left:13px;z-index:50;box-sizing:border-box;width:min(286px,calc(100vw - 26px));background:#19221ff0;border:1px solid #a1ab8c;color:#eff0dc;padding:10px 12px;font:12px/1.4 ui-monospace,monospace}
  #chair-copy header{display:flex;justify-content:space-between;align-items:center;letter-spacing:.08em;color:#efef91}
  #chair-copy p{margin:6px 0}#chair-copy small{color:#c8cebd}#chair-copy button{font:inherit;cursor:pointer;color:#202821;padding:4px 7px;border:1px solid #acb395;background:#d9dfc9}
  #chair-copy .controls{display:flex;gap:5px;margin:6px 0}#chair-copy output{display:block;font-size:11px;color:#e6e7ac}
  #chair-copy select{max-width:117px}#chair-copy summary{cursor:pointer}#chair-copy details label{display:flex;justify-content:space-between;margin:5px 0}#chair-copy a{color:#c5f4da}#chair-copy [data-use]{touch-action:none;user-select:none}
  @media(max-width:600px) and (max-aspect-ratio:3/4){.backrooms.carbon-finder .br-inventory:not(.is-open) .br-inv-pack{bottom:auto;top:calc(100% + 22px)}}
  @media(max-height:490px){#chair-copy{padding:5px 8px;font-size:10px;bottom:4px}#chair-copy p{margin:2px}}
  </style><header><b>CARBON CAMERA</b><span data-count></span></header>
  <p data-hint>Pick up the copier beside the monitor.</p>
  <div class="controls"><button data-use>E · Pick up</button><button data-shutter hidden>Copy</button><button data-reset>Reset copies</button></div>
  <details><summary>Copy lab</summary><label>Test object <select data-stock></select></label>
  <label>Misprint <select data-edition><option value="cycle">Cycle four</option></select></label>
  <a href="/world/dev/chair-copy/contact-sheets.html" target="_blank" rel="noopener">Polaroid catalogue</a> · <button data-bench>Test FPS</button>
  <output data-timing></output><button data-save hidden>Save benchmark</button></details>`;
  document.body.append(el);
  return {el,hint:el.querySelector('[data-hint]'),count:el.querySelector('[data-count]'),action:el.querySelector('[data-use]'),timing:el.querySelector('output')};
}
export function attachStudy(h, stage) {
  const {world,env}=h, rt=world.rooms[h.level.start.room], def=rt.def, turn=def.rot*Math.PI/2;
  const {camera:pickup,use:pickupUse,x:deskX,z:deskZ,desktop,deskCollider}=rt.carbonDesk;
  const cameraId='chair-study:carbon-camera', eye=h.dev.viewCamera;
  const nativeChair=world.furniture.find(f=>f.room===rt.id&&f.type==='chair');
  const sources=[], livePickups=new WeakMap(), copies=new Set(), editions=new Map(), stocks=new Map();
  const ui=panel(), find=createViewfinder(world.scene);
  const photo=env.kit.tex.custom('carbon-camera:film',128,128,g=>{g.fillStyle='#efe8d8';g.fillRect(0,0,128,128);},{clamp:true});
  const ray=new T.Raycaster(), centre=new T.Vector2(), hits=[];
  ray.far=REACH;
  let scanned=null,flight=null,transfer=null,rigPlate=null,owner=null,lift=0,shot=0,elapsed=0,dead=false,ready=false,notice='',until=0;
  let selected=null,landing=null,plate=null,uiTime=0,aligned=false;
  const inHand=()=>h.inventory?.held()?.id===cameraId;
  const canAct=()=>!dead&&h.world===world&&h.state==='play'&&!h.paused&&!h.inventory?.isOpen&&!document.hidden;
  const say=s=>{notice=s;until=performance.now()+1350;};
  const point=(x,z)=>{const p=toWorld(def,x,z);return {...p,y:world.floorY(p.x,p.z)};};
  function bake(stock,key) {
    const model=env.kit.model('carbon-lab:'+key,()=>stock.vox,{ao:false});
    const matrix=new T.Matrix4().makeScale(stock.cell,stock.cell,stock.cell), b=new Batch(true);
    b.addVox(model.solid,matrix);b.addVox(model.glass,matrix);
    const geo=env.kit.geometry(b,rt.lights,rt.amb,rt.lighting);geo.computeBoundingBox();return geo;
  }
  const material=env.kit.surface({vox:true});
  const quiet=matchMedia('(prefers-reduced-motion: reduce)');let flickerChair=null,printCount=0;
  const flash=document.createElement('div');
  flash.setAttribute('aria-hidden','true');
  flash.style.cssText='position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,#fff8dc 0%,#fff2d2 40%,#cfc9aa 100%)';
  h.hud.el.querySelector('.br-frame').prepend(flash);
  let reviewUntil=0, doneUntil=0;
  function expose(){
    if(!quiet.matches)flash.animate([{opacity:.52},{opacity:.12,offset:.36},{opacity:0}],{duration:175,easing:'ease-out'});
    reviewUntil=elapsed+.40;
  }
  function stockOf(id){if(!stocks.has(id))stocks.set(id,readStock(id));return stocks.get(id);}
  function entry(id,x,z,y=0,collider=null,native=null) {
    const stock=stockOf(id), pos=toWorld(def,x,z);
    let body=native?.group.children.find(m=>m.isMesh&&!m.material.transparent);
    if(!body){
      const geo=bake(stock,'source:'+id);body=new T.Mesh(geo,material);
      body.position.set(pos.x,(def.y||0)+y,pos.z);body.rotation.y=turn;world.scene.add(body);
    }
    const f=native||{...pos,y:(def.y||0)+y,room:rt.id,collider};
    f.stock=stock;f.body=body;f.turn=turn;f.label=stockLabel(id);
    sources.push(f);return f;
  }
  const original=entry('chair',0,0,0,null,nativeChair);
  entry('desk',deskX,deskZ,0,deskCollider);
  entry('crt',deskX,deskZ,desktop,deskCollider);
  entry('keyboard',deskX,deskZ+.25,desktop,deskCollider);
  function display(id,x,z){
    const s=entry(id,x,z), b=s.body.geometry.boundingBox;
    const f=worldFootprint({x,z,x0:x+b.min.x,z0:z+b.min.z,x1:x+b.max.x,z1:z+b.max.z,bottom:0,top:b.max.y},def,toWorld);
    if(b.max.y>.10){
      s.collider={x0:f.x0,x1:f.x1,z0:f.z0,z1:f.z1,on:true,keep:true,tall:f.top-f.y>1.25,top:f.top};rt.colliders.push(s.collider);
    }
    return s;
  }
  display('file-four',1.82,-1.62);
  const stockSelect=ui.el.querySelector('[data-stock]'), edition=ui.el.querySelector('[data-edition]');
  for(const id of stockIds)stockSelect.add(new Option(stockLabel(id),id));
  const query=new URLSearchParams(location.search);
  stockSelect.value=stockIds.includes(query.get('stock'))?query.get('stock'):'printer';
  const specimen=stockOf(stockSelect.value), b=specimen.bounds;
  const span=specimen.cell*Math.max(b.x1-b.x0,b.y1-b.y0,b.z1-b.z0);
  if(span<.68){
    const plinth=display('pedestal',-1.45,-1.65);
    entry(specimen.id,-1.45,-1.65,plinth.body.geometry.boundingBox.max.y,plinth.collider);
  }else display(specimen.id,-1.45,-1.65);
  for(let i=0;i<4;i++)edition.add(new Option(['Registration slip','Repeated section','Wrong-way section','Feed jam'][i],String(i)));
  if(/^[0-3]$/.test(query.get('edition')||''))edition.value=query.get('edition');
  stockSelect.onchange=()=>{
    const url=new URL(location.href);url.searchParams.set('stock',stockSelect.value);url.searchParams.set('edition',edition.value);location.assign(url);
  };
  function variant(source) {
    const id=source.stock.id;
    const n=edition.value==='cycle'?(source.prints||0)%4:Number(edition.value);
    const key=id+':'+n;
    if(!editions.has(key)){
      const stock=developEdition(source.stock,n),geo=bake(stock,key);
      editions.set(key,{stock,geo,box:geo.boundingBox,turn,name:editionNames(stock)[n]});
    }
    return editions.get(key);
  }
  function take(){
    if(!canAct()||!pickup.visible||world.usable(h.player.me)!==pickupUse||env.grip?.held)return;
    const result=h.inventory.give({id:cameraId,type:'carbon-camera'});
    if(!result.ok){say('Make room in a pocket first.');return;}
    h.inventory.select(result.index);pickup.visible=false;say('Hold click or X to look through the finder.');
  }
  function clearLine(p,ignore){
    const from=ray.ray.origin, n=Math.max(1,Math.ceil(from.distanceTo(p)/.09));
    for(let i=1;i<n;i++){
      const k=i/n,x=from.x+(p.x-from.x)*k,z=from.z+(p.z-from.z)*k,y=from.y+(p.y-from.y)*k;
      if(!world.roomAt(x,z)||!world.free(x,z,.012,{ghost:true,ignoreCollider:ignore,furnitureY:y,tall:true}))return false;
      const room=world.roomAt(x,z);
      for(const c of room.colliders)if(c!==ignore&&c.on!==false&&!c.tall&&Number.isFinite(c.top)&&y<c.top&&x>c.x0&&x<c.x1&&z>c.z0&&z<c.z1)return false;
    }
    return true;
  }
  function acquire(){
    let nearest=null,distance=REACH;
    function consider(s){
      if(s.away||s.carried||s.twin||!s.body.visible)return;
      s.body.updateWorldMatrix(true,false); hits.length=0;
      ray.intersectObject(s.body,false,hits);
      if(hits.length&&hits[0].distance<distance&&clearLine(hits[0].point,s.collider)){nearest=s;distance=hits[0].distance;}
    }
    for(const s of sources)consider(s);
    h.inventory.physical.forEachNearbyPickup(ray.ray.origin.x,ray.ray.origin.z,REACH,(item,body)=>{
      let s=livePickups.get(body);
      if(!s){
        s={body,label:stockLabel(item.type),get stock(){return stockOf(item.type);},get away(){return !body.visible;},
          get x(){return body.matrixWorld.elements[12];},get y(){return body.matrixWorld.elements[13];},
          get z(){return body.matrixWorld.elements[14];},get turn(){return body.rotation.y+body.parent.rotation.y;}};
        livePickups.set(body,s);
      }
      consider(s);
    });
    return nearest;
  }
  function footprint(p,b,room,angle) {
    const local=toLocal(room.def,p.x,p.z);
    // min/max are asymmetric on a bad print. Transform every corner into the receiving room.
    const xs=[],zs=[];
    for(const x of [b.min.x,b.max.x])for(const z of [b.min.z,b.max.z]){
      const c=Math.cos(angle),s=Math.sin(angle),corner=toLocal(room.def,p.x+x*c+z*s,p.z-x*s+z*c);
      xs.push(corner.x);zs.push(corner.z);
    }
    const bottom=p.y-(room.def.y||0);
    return {x:local.x,z:local.z,x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),bottom,top:bottom+b.max.y};
  }
  function fits(p,v) {
    const room=world.roomAt(p.x,p.z);
    if(!room||room.fold||room.def.kind==='exit'||!Number.isFinite(p.y))return false;
    const box=worldFootprint(footprint(p,v.box,room,v.turn),room.def,toWorld);
    if(box.x1-box.x0>4||box.z1-box.z0>4||boxHits(box,{...h.player.me,r:h.player.RADIUS||.22}))return false;
    for(const x of [box.x0,p.x,box.x1])for(const z of [box.z0,p.z,box.z1]){
      if(!world.roomAt(x,z)||Math.abs(world.floorY(x,z)-p.y)>.035||world.headroom(x,z)<box.top-p.y+.01)return false;
    }
    return world.free(p.x,p.z,0,{bounds:box,bottom:p.y,top:box.top});
  }
  const aimPoint=new T.Vector3();
  function floorTarget(v){
    if(ray.ray.direction.y>=-.04)return null;
    // Find the first floor along the optical ray, including the hall beyond the doorway.
    for(let t=.10;t<=REACH;t+=.07){
      ray.ray.at(t,aimPoint);
      if(!world.roomAt(aimPoint.x,aimPoint.z))return null;
      const y=world.floorY(aimPoint.x,aimPoint.z);if(aimPoint.y>y)continue;
      const dist=(y-ray.ray.origin.y)/ray.ray.direction.y;ray.ray.at(dist,aimPoint);
      const p={x:aimPoint.x,y,z:aimPoint.z};aimPoint.y+=.025;
      if(!clearLine(aimPoint))return null;
      return {...p,valid:fits(p,v)};
    }
    return null;
  }
  function target(){
    eye.updateWorldMatrix(true,false);ray.setFromCamera(centre,eye);
    selected=scanned?null:acquire();landing=scanned?floorTarget(plate):null;
  }
  function makeCopy(p,source=original,v=variant(source)){
    if(!fits(p,v))return null;
    const room=world.roomAt(p.x,p.z),l=toLocal(room.def,p.x,p.z),group=new T.Group();
    group.position.set(l.x,p.y-(room.def.y||0),l.z);group.rotation.y=v.turn-room.def.rot*Math.PI/2;
    const mesh=new T.Mesh(v.geo,material);group.add(mesh);room.group.add(group);
    const type=source.stock.id==='desk'||source.stock.id.startsWith('file-')||source.stock.id==='cabinet'?'desk':source.stock.id==='chair'?'chair':'prop';
    const f=registerMovable(world,room,group,{foot:footprint(p,v.box,room,v.turn),type,label:'Copied '+source.label});
    if(source.stock.id==='chair'&&v.name===editionNames(source.stock)[0]){
      if(!flickerChair)flickerChair=bake(developEdition(source.stock,0,true),'chair:slipping');
      f.badRegistration={mesh,stable:v.geo,slip:flickerChair,phase:++printCount*1.73};
    }
    world.scene.attach(group);world.touchFurniture(f);world.refreshFurniture();f.source=source;copies.add(f);return f;
  }
  function remove(f){if(!copies.delete(f))return;if(env.grip?.held===f)env.grip.release();if(f.source.twin===f)f.source.twin=null;f.remove();world.refreshFurniture();}
  function stopFlight(){transfer?.stop();flight=null;}
  function start(source,p,v=variant(source),paid=false){
    if(flight||!fits(p,v)||source.carried||source.away||paid&&source.twin)return false;
    if(rigPlate!==v||transfer?.source!==source){
      transfer?.dispose();transfer=createTransfer(world.scene,source.body,source.turn,v.geo,source.stock,v.stock,material);transfer.source=source;rigPlate=v;
    }
    transfer.start(source,source.body,p,v.turn);flight={source,p,v,paid,t:0,x:source.x,z:source.z};return true;
  }
  function step(dt){
    if(!flight)return;
    const {source,p,v,paid,x,z}=flight;
    if(paid&&!inHand()||source.carried||source.away||source.x!==x||source.z!==z){stopFlight();say('Print interrupted.');return;}
    flight.t+=dt;transfer.at(Math.min(1,flight.t/SECONDS));
    if(flight.t<SECONDS)return;
    stopFlight();const twin=makeCopy(p,source,v);
    if(!twin){say('Landing occupied. Try another spot.');return;}
    if(paid){
      if(!h.inventory.model.spendPrint(cameraId)){remove(twin);return;}
      source.twin=twin;source.prints=(source.prints||0)+1;scanned=plate=null;doneUntil=elapsed+.55;
    }
    say(v.name+' · E to move the copy.');
  }
  function clearView(){if(owner!==null)h.hud.el.classList.remove('carbon-finder');owner=null;aligned=false;selected=landing=null;}
  function raise(who){
    if(!canAct()||!inHand()||bench.active||flight||env.grip?.held||owner!==null)return false;
    if(!h.inventory.held().charge){say('Fit a battery pack in your pockets.');return false;}
    if(bench.result)for(const f of copies)if(f.source.twin!==f)remove(f);
    owner=who;aligned=false;h.hud.el.classList.add('carbon-finder');return true;
  }
  function lower(who){
    if(owner===who)clearView();
  }
  function shutter(){
    if(!owner||!aligned||!canAct()||!inHand()||env.grip?.held||flight||elapsed<reviewUntil)return;
    if(!h.inventory.held().charge){say('Fit a battery pack in your pockets.');return;}
    target();
    if(!scanned&&selected){
      const src=selected;plate={...variant(src),turn:src.turn};scanned=src;shot++;
      drawPositive(photo.image.getContext('2d'),src.stock);photo.needsUpdate=true;
      doneUntil=0;expose();env.sound.carbonCamera('scan');say(src.label+' on film.');
    }else if(scanned&&landing?.valid&&start(scanned,landing,plate,true)){
      env.sound.carbonCamera('print');
    }else say(scanned?'Find clear floor for the whole object.':'Sight an original that has no twin.');
  }
  function reset(){
    stopFlight();clearView();lift=0;if(env.grip?.held)env.grip.release();
    for(const f of [...copies])remove(f);
    original.translate(def.cx-original.x,def.cz-original.z,(def.y||0)-original.y);
    scanned=plate=null;notice='';until=reviewUntil=doneUntil=0;
    h.goto(rt.id,0,Math.min(2,def.D/2-.55),0,-.34);
  }
  env.carbonCopy={take,raise,lower,shutter,photo,exposure:id=>id===cameraId&&scanned?shot:0,
    get aiming(){return owner!==null;},
    get printProgress(){return flight?.paid ? Math.min(1,flight.t/SECONDS) : 0;},
    get status(){return flight?.paid?'LOCK':elapsed<doneUntil?'DONE':!h.inventory.held()?.charge?'BATT':scanned?'PASTE':'COPY';},
    get lift(){return lift*lift*(3-2*lift);},sighted(){aligned=owner!==null&&lift===1;}};
  const bench=frameTest({h,stage,world,original,copies,point,start,makeCopy,remove,reset,canAct,
    running:()=>!!flight,alive:()=>!dead,setText:s=>{ui.timing.textContent=s;}});
  const save=ui.el.querySelector('[data-save]');
  save.onclick=()=>{
    if(!bench.result)return;
    const href=URL.createObjectURL(new Blob([JSON.stringify(bench.result,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=href;link.download='blockrooms-copy-benchmark.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  async function run(){if(!canAct()||flight||bench.active)return;clearView();save.hidden=true;ui.el.querySelector('details').open=true;
    try{await bench.run();if(!dead)save.hidden=!bench.result;}catch(e){if(!dead)ui.timing.textContent=e.message;}}
  const down=e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(e.code==='KeyX')raise('key');else if(e.code==='KeyB')run();
    else if(e.code==='KeyE'&&ui.el.contains(e.target))shutter();
    else if(e.code==='KeyR'&&owner&&scanned&&!flight){plate.turn+=Math.PI/2;target();}};
  const up=e=>{if(e.code==='KeyX')lower('key');};
  const blur=()=>{clearView();lift=0;reviewUntil=0;find.show(null,null,null,0);};
  const visibility=()=>{if(document.hidden)blur();};
  ui.action.onclick=()=>{if(pickup.visible)take();};
  const touchAction=ui.el.querySelector('[data-shutter]');
  let touchAimer=matchMedia('(pointer:coarse)').matches;
  touchAction.onclick=shutter;
  ui.action.onpointerdown=e=>{
    if(e.button!==0||pickup.visible)return;
    touchAimer=e.pointerType==='touch';
    if(touchAimer){if(owner==='touch')lower('touch');else raise('touch');}
    else if(raise('panel'))ui.action.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  ui.action.onpointerup=ui.action.onlostpointercapture=ui.action.onpointercancel=()=>lower('panel');
  ui.action.onkeydown=e=>{if(!pickup.visible&&['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)raise('panel-key');}};
  ui.action.onkeyup=e=>{if(['Space','Enter'].includes(e.code))lower('panel-key');};
  edition.onchange=()=>{if(scanned&&!flight)plate={...variant(scanned),turn:plate.turn};};
  ui.el.querySelector('[data-bench]').onclick=run;
  ui.el.querySelector('[data-reset]').onclick=()=>{if(canAct()&&!bench.active){reset();ui.timing.textContent='';save.hidden=true;}};
  window.addEventListener('keydown',down,true);window.addEventListener('keyup',up,true);
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  const off=stage.onFrame(dt=>{
    if(!canAct()){blur();if(h.world!==world)stopFlight();return;}
    if(!ready){ready=true;h.goto(rt.id,pickupUse.x,Math.min(def.D/2-.40,pickupUse.z+1.16),0,-.24);h.dev.clock(false);}
    step(dt);elapsed+=dt;
    if(scanned?.away){scanned=plate=null;say('Original lost. Hold to scan another object.');}
    for(const twin of copies){const glitch=twin.badRegistration;if(glitch)glitch.mesh.geometry=!quiet.matches&&(elapsed+glitch.phase)%5.3<.19?glitch.slip:glitch.stable;}
    if(!inHand()||env.grip?.held){clearView();lift=0;}
    const active=owner!==null;
    // A quick tap cannot take a photograph. Give the raised sight a frame on the optical axis first.
    lift=Math.min(1,Math.max(0,lift+(active?1:-1)*dt/.20));
    if(flight?.paid){
      find.show(null,flight.v,flight.p,elapsed,Math.min(1,flight.t/SECONDS));
    }else if(active&&aligned&&scanned&&elapsed<reviewUntil){
      selected=landing=null;
      find.show(scanned,null,null,elapsed,-1,Math.max(0,(reviewUntil-elapsed)/.4)*(quiet.matches ? .24 : 1));
    }else if(active&&aligned&&h.inventory.held()?.charge){target();find.show(selected,plate,landing,elapsed);}
    else find.show(null,null,null,0);
    if(performance.now()<uiTime)return;uiTime=performance.now()+65;
    ui.count.textContent=copies.size?copies.size+(copies.size===1?' twin':' twins'):'';
    ui.action.textContent=pickup.visible?'E · Pick up':touchAimer?(active?'Lower':'Aim'):(active?'Aiming':'Hold to aim');
    ui.action.disabled=bench.active||(pickup.visible?world.usable(h.player.me)!==pickupUse:!inHand());
    touchAction.hidden=owner!=='touch';touchAction.textContent=scanned?'Paste':'Copy';
    touchAction.disabled=!aligned||!!flight||elapsed<reviewUntil||!h.inventory.held()?.charge;
    ui.hint.textContent=bench.active?'Measuring the chair transfer…':flight?'Printing '+flight.source.label+'…':
      active?(lift<1?'Raising finder…':elapsed<reviewUntil&&scanned?scanned.label+' copied.':elapsed<doneUntil?'Paste complete.':!h.inventory.held()?.charge?'Fit a battery pack.':
        scanned?(landing?.valid?(touchAimer?'Tap Paste to lock the projection.':'E · Paste here · R to rotate'):landing?'Blocked · move the projection':'Aim at the floor'):(selected?(touchAimer?'Tap Copy · ':'E · Copy ')+selected.label:'Find an original in the wire sight')):
      performance.now()<until?notice:pickup.visible?'E to take the Carbon Camera beside the monitor.':!inHand()?'Select the pocket holding the Carbon Camera.':
      !h.inventory.held().charge?'Combine a battery pack with the copier.':touchAimer?'Tap Aim, then Copy or Paste.':scanned?scanned.label+' on film · hold click or X, then E to paste.':'Hold click or X to aim. Press E to copy.';
  });
  window.__chairCopy={get copies(){return [...copies];},get flight(){return !!flight;},get scanned(){return scanned;},get result(){return bench.result;},get selected(){return selected;},get landing(){return landing;},get sources(){return sources;},run,reset};
  return ()=>{dead=true;clearView();delete env.carbonCopy;bench.stop();off();stopFlight();transfer?.dispose();find.dispose();
    for(const f of [...copies])remove(f);for(const s of sources)if(s!==original)s.body.removeFromParent();
    window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',up,true);window.removeEventListener('blur',blur);
    document.removeEventListener('visibilitychange',visibility);flash.remove();ui.el.remove();delete window.__chairCopy;};
}
