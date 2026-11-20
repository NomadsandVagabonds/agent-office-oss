import * as T from 'three';
import { toLocal, toWorld } from '../../backrooms/frame.js';
import { boxHits } from '../../backrooms/furniture-policy.js';
import { registerMovable } from '../../backrooms/movable-props.js';
import { CLOTH, makePrintPoses } from './misprint.js';
import { SECONDS, createTransfer } from './transfer.js';
import { frameTest } from './timing.js';

const LIMIT=8, REACH=4.8;
export function prepareRoom(level,builders){
  const def=level.rooms[level.start.room];
  builders.start=c=>{
    c.shell();
    const x=-c.W*.215,z=-c.D*.315;
    const desk=c.prop('desk',x,z,{fixed:true});
    c.prop('crt',x,z,{y:desk.top,solid:false});
    c.prop('keyboard',x,z+.22,{y:desk.top,solid:false});
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
  #chair-aim{position:fixed;left:50%;top:50%;width:6px;height:6px;border:1px solid #f4f3dd;transform:translate(-50%,-50%);pointer-events:none;z-index:22;box-shadow:0 0 2px #172018}
  @media(max-height:490px){#chair-copy{padding:5px 8px;font-size:10px;bottom:4px}#chair-copy p{margin:2px}}
  </style><header><b>CARBON COPY</b><span data-count>0 / 8</span></header>
  <p data-hint>Locate the teal swivel chair.</p>
  <div class="controls"><button data-use>X · Scan</button><button data-bench title="Resets the chairs and runs a fixed-view test">B · Test FPS</button><button data-reset>Reset</button></div>
  <small>WASD move · mouse look · E carry / set down</small>
  <output data-timing></output><button data-save hidden>Save benchmark</button>`;
  const dot=document.createElement('div');dot.id='chair-aim';document.body.append(el,dot);
  return {el,dot,hint:el.querySelector('[data-hint]'),count:el.querySelector('[data-count]'),action:el.querySelector('[data-use]'),timing:el.querySelector('output')};
}
export function attachStudy(h,stage){
  const world=h.world,rt=world.rooms[h.level.start.room],def=rt.def;
  const original=world.furniture.find(f=>f.room===rt.id&&f.type==='chair');
  if(!original)throw Error('Chair fixture missing. Enable barricades.');
  const parts=original.group.children.filter(o=>o.isMesh).map(o=>({geo:o.geometry,mat:o.material,order:o.renderOrder}));
  const body=f=>f.group.children.find(o=>o.isMesh&&!o.material.transparent);
  const rot=def.rot*Math.PI/2, half={x:original.placement.foot.w/2,z:original.placement.foot.d/2};
  const originalBody=body(original);
  const originalGeometry=originalBody.geometry;
  const print=makePrintPoses(h.env.kit,rt,!!original.lightTint);
  const transfer=createTransfer(world.scene,originalBody,rot,print.rest);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed=0, serial=0;
  const copies=new Set(), ui=panel(), footHeight=original.top-original.y;
  const corners=new Float32Array([-1,0,-1,1,0,-1, 1,0,-1,1,0,1, 1,0,1,-1,0,1, -1,0,1,-1,0,-1]);
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(corners,3));
  const marker=new T.LineSegments(geom,new T.LineBasicMaterial({color:0xc9f38a}));marker.visible=false;marker.rotation.y=rot;
  marker.scale.set(half.x,1,half.z);world.scene.add(marker);
  const ray=new T.Ray(),bounds=new T.Box3(),hit=new T.Vector3();
  let scanned=null,flight=null,aim=null,ready=false,notice='',noticeUntil=0,dead=false,uiTime=0;
  const canAct=()=>!dead && h.world===world && h.state==='play' && !h.paused && !h.inventory?.isOpen;
  function say(s){notice=s;noticeUntil=performance.now()+1600;}
  function home(){h.goto(rt.id,0,Math.min(2,def.D/2-.55),0,-.34);}
  function direction(){
    const me=h.player.me,cp=Math.cos(me.pitch);
    ray.origin.set(me.x,me.y,me.z);
    ray.direction.set(-Math.sin(me.yaw)*cp,Math.sin(me.pitch),-Math.cos(me.yaw)*cp);
  }
  function clearRay(x,y,z,ignore){
    const me=h.player.me,n=Math.max(1,Math.ceil(Math.hypot(x-me.x,z-me.z)/.09));
    for(let i=1;i<n;i++){
      const k=i/n,px=me.x+(x-me.x)*k,pz=me.z+(z-me.z)*k,py=me.y+(y-me.y)*k;
      if(world.roomAt(px,pz)!==rt || !world.free(px,pz,.012,{ghost:true,ignoreCollider:ignore,furnitureY:py,tall:true}))return false;
      for(const c of rt.colliders){
        if(c===ignore||c.on===false||c.tall||!Number.isFinite(c.top)||py>=c.top)continue;
        if(px>c.x0&&px<c.x1&&pz>c.z0&&pz<c.z1)return false;
      }
    }
    return true;
  }
  function aimChair(){
    let best=null,dist=REACH;
    for(const f of [original,...copies]){
      if(f.room!==rt.id||f.carried||f.away)continue;
      bounds.min.set(f.x0,f.y,f.z0);bounds.max.set(f.x1,f.top,f.z1);
      if(ray.intersectBox(bounds,hit)){
        const d=ray.origin.distanceTo(hit);
        if(d<dist&&clearRay(hit.x,hit.y,hit.z,f.collider)){best=f;dist=d;}
      }
    }
    return best;
  }
  function point(x,z){
    const f=toWorld(def,x,z);return {x:f.x,z:f.z,y:world.floorY(f.x,f.z)};
  }
  function fits(p){
    if(!p||!Number.isFinite(p.y)||world.roomAt(p.x,p.z)!==rt)return false;
    const local=toLocal(def,p.x,p.z);
    if(Math.abs(local.x)+half.x>def.W/2-.09||Math.abs(local.z)+half.z>def.D/2-.09)return false;
    const hx=(original.x1-original.x0)/2,hz=(original.z1-original.z0)/2;
    const b={x0:p.x-hx,x1:p.x+hx,z0:p.z-hz,z1:p.z+hz};
    const me=h.player.me;
    if(boxHits(b,{x:me.x,z:me.z,r:h.player.RADIUS||.22}))return false;
    for(const x of [b.x0,b.x1])for(const z of [b.z0,b.z1]){
      if(Math.abs(world.floorY(x,z)-p.y)>.015||world.headroom(x,z)<footHeight+.01)return false;
    }
    return world.free(p.x,p.z,0,{bounds:b,bottom:p.y,top:p.y+footHeight});
  }
  function floorTarget(){
    if(ray.direction.y>=-.04)return null;
    const t=((def.y||0)-ray.origin.y)/ray.direction.y;
    if(t<=0||t>REACH)return null;
    ray.at(t,hit);if(world.roomAt(hit.x,hit.z)!==rt)return null;
    const p={x:hit.x,z:hit.z,y:world.floorY(hit.x,hit.z)};
    return {...p,valid:fits(p)&&clearRay(p.x,p.y+.04,p.z)};
  }
  function makeCopy(p){
    if(copies.size>=LIMIT||!fits(p))return null;
    const l=toLocal(def,p.x,p.z);
    const group=new T.Group();group.position.set(l.x,p.y-(def.y||0),l.z);rt.group.add(group);
    for(const part of parts){
      const mesh=new T.Mesh(part.geo===originalGeometry?print.rest:part.geo,part.mat);mesh.renderOrder=part.order;group.add(mesh);
    }
    const y=group.position.y;
    const foot={x:l.x,z:l.z,x0:l.x-half.x,x1:l.x+half.x,z0:l.z-half.z,z1:l.z+half.z,bottom:y,top:y+footHeight};
    const f=registerMovable(world,rt,group,{foot,type:'chair',label:'Copied chair'});
    // A few frames of bad registration, at a different time on each print.
    f.printPhase=(++serial*1.73)%5.3;
    f.printBody=body(f);
    world.scene.attach(group);world.touchFurniture(f);world.refreshFurniture();copies.add(f);
    return f;
  }
  function remove(f){if(!copies.delete(f))return;if(h.env.grip?.held===f)h.env.grip.release();f.remove();world.refreshFurniture();}
  function cancel(){transfer.stop();flight=null;}
  function start(source,p){
    if(flight||!fits(p)||copies.size>=LIMIT||source.carried||source.away||source.room!==rt.id)return false;
    transfer.start(source,body(source),p,source!==original);
    flight={source,p,elapsed:0,x:source.x,z:source.z};marker.visible=false;
    return true;
  }
  function step(dt){
    if(!flight)return;
    const {source,p,x,z}=flight;
    if(source.carried||source.away||source.x!==x||source.z!==z||source.room!==rt.id){cancel();say('Source moved. Scan ready.');return;}
    flight.elapsed+=dt;const t=Math.min(1,flight.elapsed/SECONDS);transfer.at(t);
    if(t>=1){cancel();const f=makeCopy(p);say(f?'Copy placed. E to pick it up.':'Landing occupied. Aim and paste again.');}
  }
  function reset(){
    cancel();if(h.env.grip?.held)h.env.grip.release();
    for(const f of [...copies])remove(f);
    original.translate(def.cx-original.x,def.cz-original.z,(def.y||0)-original.y);
    scanned=null;notice='';noticeUntil=0;marker.visible=false;home();
  }
  function action(){
    if(!canAct()||bench.active||flight)return;
    if(h.env.grip?.held){say('Set down the chair with E first.');return;}
    direction();const target=aimChair();
    if(target){scanned=target;say('Chair scanned. Aim at open carpet.');return;}
    if(!scanned){say('Center the reticle on a chair, then press X.');return;}
    const p=floorTarget();
    if(copies.size===LIMIT)say('Eight copies placed. Reset for another run.');
    else if(!p?.valid||!start(scanned,p))say('Needs clear carpet within reach.');
  }
  const bench=frameTest({h,stage,world,original,copies,point,start,makeCopy,remove,reset,canAct,
    running:()=>!!flight,alive:()=>!dead,setText:s=>{ui.timing.textContent=s;}});
  const save=ui.el.querySelector('[data-save]');
  save.onclick=()=>{
    if(!bench.result)return;
    const href=URL.createObjectURL(new Blob([JSON.stringify(bench.result,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=href;link.download='blockrooms-chair-benchmark.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  async function run(){
    if(!canAct()||flight||bench.active)return;
    save.hidden=true;
    try{await bench.run();if(!dead)save.hidden=!bench.result;}
    catch(e){if(!dead)ui.timing.textContent=e.message;}
  }
  const key=e=>{
    if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||!canAct())return;
    if(e.code==='KeyX')action();else if(e.code==='KeyB')run();
  };
  window.addEventListener('keydown',key,true);ui.action.onclick=action;
  ui.el.querySelector('[data-bench]').onclick=run;
  ui.el.querySelector('[data-reset]').onclick=()=>{if(canAct()&&!bench.active){reset();ui.timing.textContent='';save.hidden=true;}};
  const off=stage.onFrame(dt=>{
    if(!canAct()||document.hidden){marker.visible=false;ui.dot.hidden=true;if(h.world!==world)cancel();return;}
    ui.dot.hidden=false;
    if(!ready){ready=true;home();h.dev.clock(false);}
    step(dt);
    elapsed+=dt;
    for(const f of copies){
      if(f===flight?.source)continue;
      const slips=!reducedMotion.matches&&(elapsed+f.printPhase)%5.3<.19;
      f.printBody.geometry=slips?print.slip:print.rest;
    }
    if(performance.now()<uiTime)return;uiTime=performance.now()+70;
    direction();const chair=aimChair();aim=scanned&&!chair&&!flight&&!bench.active?floorTarget():null;
    marker.visible=!!aim;
    if(aim){marker.position.set(aim.x,aim.y+.014,aim.z);marker.material.color.setHex(aim.valid?0xbfea74:0xf57868);}
    ui.count.textContent=copies.size+' / '+LIMIT;
    ui.action.textContent=chair||!scanned?'X · Scan':'X · Paste';
    ui.hint.textContent=bench.active?'Measuring from the same camera position…':flight?'Reading and rebuilding the chair…':performance.now()<noticeUntil?notice:
      chair?(chair===original?'Teal swivel chair':'Misprinted chair')+' · X to copy its shape.':!scanned?'Aim at the teal chair and press X.':aim?.valid?'X to print here. E moves a finished chair.':'Aim down at clear carpet within reach.';
  });
  // Browser automation uses the same transfer, registry and frame test as the panel.
  window.__chairCopy={get copies(){return [...copies];},get flight(){return !!flight;},get scanned(){return scanned;},get result(){return bench.result;},run,reset,action};
  return ()=>{dead=true;bench.stop();off();cancel();for(const f of [...copies])remove(f);marker.removeFromParent();geom.dispose();marker.material.dispose();transfer.dispose();window.removeEventListener('keydown',key,true);ui.el.remove();ui.dot.remove();delete window.__chairCopy;};
}
