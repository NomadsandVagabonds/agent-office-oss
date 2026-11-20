import * as T from 'three';
import { meshVox } from '../../vox/mesher.js';
import { copierVox } from '../../backrooms/rooms/copiers/model.js';
import { catalogue, makeVox } from './recipes.js';

export const sources=[
  {id:'cabinet',name:'File cabinet',trait:'heavy',x:-3.65,z:.92},
  {id:'chair',name:'Swivel chair',trait:'rolling',x:-1.95,z:.92},
  {id:'phone',name:'Desk phone',trait:'ringing',x:-.28,z:.92}
];
export const bays=[
  {id:'scale',name:'Scale',x:1.25,z:.72}, {id:'receiver',name:'Receiver',x:3.25,z:.72},
  {id:'bench',name:'Test track',x:-.32,z:-1.75}
];
const GRAINS=512, HEIGHT=.23;
const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=T.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function texture(kind,rx,ry){
  const c=document.createElement('canvas');c.width=c.height=192;
  const g=c.getContext('2d'),r=random(1749);
  g.fillStyle={wall:'#c8b87d',floor:'#777457',metal:'#67766c',tile:'#c5c1a7'}[kind];g.fillRect(0,0,192,192);
  for(let i=0;i<7300;i++){g.fillStyle=r()<.52?'rgba(36,37,23,.09)':'rgba(246,237,169,.14)';g.fillRect(r()*192,r()*192,1+r()*2,kind==='floor'?2.6:1.2);}
  if(kind==='wall'){
    for(let x=0;x<192;x+=32){g.fillStyle='rgba(102,84,44,.13)';g.fillRect(x,0,2,192);
      for(let y=0;y<192;y+=48){const a=x+16,b=y+(x%64===0?12:36);g.strokeStyle='rgba(122,95,46,.34)';
        g.beginPath();g.moveTo(a,b-7);g.lineTo(a+3,b);g.lineTo(a,b+7);g.lineTo(a-3,b);g.closePath();g.stroke();}}
  } else if(kind==='tile'){g.strokeStyle='#827f6d';g.lineWidth=3;g.strokeRect(0,0,192,192);}
  else if(kind==='metal'){for(let y=0;y<192;y+=12){g.fillStyle='#37463e';g.fillRect(0,y,192,2);g.fillStyle='#91a094';g.fillRect(0,y+2,192,2);}}
  const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(rx,ry);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
}
function labelled(text,bg,fg,width,height,scene,x,y,z,angle=0){
  const c=document.createElement('canvas');c.width=768;c.height=Math.round(768*height/width);
  const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);g.fillStyle=fg;
  g.font='bold '+Math.floor(c.height*.62)+'px Helvetica, Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(text,c.width/2,c.height*.53,c.width*.94);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const s=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map}));s.position.set(x,y,z);s.rotation.y=angle;scene.add(s);return s;
}
function modelData(vox,maxSide){
  const b=vox.bounds(), f=maxSide/Math.max(b.x1-b.x0,b.y1-b.y0,b.z1-b.z0,1);
  const g=meshVox(vox).solid;
  const tx=-(b.x0+b.x1)*.5, tz=-(b.z0+b.z1)*.5;
  g.translate(tx,-b.y0,tz);g.scale(f,f,f);g.computeBoundingBox();
  const pts=[],r=random(82011); let seen=0;
  vox.each((x,y,z,c)=>{
    if(vox.has(x+1,y,z)&&vox.has(x-1,y,z)&&vox.has(x,y+1,z)&&vox.has(x,y-1,z)&&vox.has(x,y,z+1)&&vox.has(x,y,z-1))return;
    const ix=seen<GRAINS?seen:Math.floor(r()*(seen+1));seen++;
    if(ix<GRAINS)pts[ix]={x:(x+.5+tx)*f,y:(y+.5-b.y0)*f,z:(z+.5+tz)*f,c:c&0xffffff};
  });
  pts.sort((a,b)=>a.y-b.y);
  return {g,pts,h:(b.y1-b.y0)*f,unit:f};
}
// Leave a physical trace of the donor on a mismatched copy.
function markCopy(v,source){
  const b=v.bounds(),w=b.x1-b.x0,h=b.y1-b.y0,d=b.z1-b.z0;
  const unit=Math.max(1,Math.round(Math.min(w,h,d)*.08));
  const cx=Math.round((b.x0+b.x1)*.5),z=Math.round((b.z0+b.z1)*.5);
  if(source==='chair'){
    const y=b.y0;
    for(const x of [cx-Math.round(w*.21),cx+Math.round(w*.21)])
      for(const dz of [-1,1]){
        const p=z+dz*Math.round(d*.23);
        v.box(x-unit,y-3*unit,p-unit,x+unit,y+unit,p+unit,'#85918e');
        v.cyl('x',y-3*unit,p,x-unit,x+unit,1.7*unit,'#353838');
      }
  }else if(source==='phone'){
    const y=b.y1;
    v.box(cx-4*unit,y,z-unit,cx+4*unit,y+2*unit,z+unit,'#564036');
    for(const side of [-1,1])v.rbox(cx+side*4*unit-unit,y-unit,z-2*unit,cx+side*4*unit+unit,y+2*unit,z+2*unit,unit,'#843d30');
  }else{
    const y=b.y0+Math.floor(h*.5);
    let front=b.z1;
    while(front>b.z0 && !v.has(cx,y,front-1))front--;
    if(front>b.z0)v.box(cx-3*unit,y,front-1,cx+3*unit,y+2*unit,front+unit,'#7e867f')
      .box(cx-2*unit,y+unit,front+unit,cx+2*unit,y+2*unit,front+unit+1,'#e7dcbc');
  }
}
export function setupRoom(canvas,overlay,onPick,afterPrint) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const scene=new T.Scene();scene.background=new T.Color('#333b32');
  const camera=new T.OrthographicCamera(-5,5,3,-3,.1,65);
  camera.position.set(3.55,5.35,13.8);camera.lookAt(-.12,1.21,-.25);camera.updateMatrixWorld();
  const hemi=new T.HemisphereLight('#fff3c9','#849181',1.38);scene.add(hemi);
  const sun=new T.DirectionalLight('#fff0c3',2.0);sun.position.set(-3,7,4);scene.add(sun);
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-8,right:8,top:7,bottom:-7,far:22});sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.014;
  const box=new T.BoxGeometry(1,1,1),materials=new Map();
  function paint(color){if(!materials.has(color))materials.set(color,new T.MeshLambertMaterial({color}));return materials.get(color);}
  function slab(x,y,z,w,h,d,mat,parent=scene){
    const m=new T.Mesh(box,typeof mat==='string'?paint(mat):mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.receiveShadow=true;parent.add(m);return m;
  }
  const wall=new T.MeshLambertMaterial({map:texture('wall',6.8,1.8)}), floor=new T.MeshLambertMaterial({map:texture('floor',8,5)});
  slab(0,-.16,-.02,10.9,.32,6.0,'#41483c');
  slab(0,.005,-.02,10.84,.035,5.94,floor);
  const rear=-2.96;
  // A working shutter breaks the wall. Beyond it the same lights recede down a narrow hall.
  const left=-5.44,right=5.44, jambL=1.12,jambR=3.37,gateH=2.36;
  slab((left+jambL)/2,1.63,rear,jambL-left,3.3,.14,wall);
  slab((jambR+right)/2,1.63,rear,right-jambR,3.3,.14,wall);
  slab((jambR+jambL)/2,2.82,rear,jambR-jambL,.94,.16,wall);
  slab(-5.39,1.63,-1.3,.14,3.3,3.45,wall);slab(-5.29,.18,-1.26,.09,.33,3.5,'#65533c');
  for(const [a,b] of [[left,jambL],[jambR,right]]) slab((a+b)/2,.15,rear+.08,b-a,.29,.08,'#66573d');
  for(const x of [jambL,jambR]){slab(x,1.17,rear+.11,.13,2.4,.26,'#424c41');slab(x+.015,1.16,rear+.25,.045,2.27,.035,'#939783');}
  slab(2.25,2.34,rear+.14,2.45,.15,.32,'#475145');
  slab(2.25,-.035,-6.2,2.35,.1,6.7,floor);
  for(let i=0;i<5;i++){
    const z=-3.72-i*1.14;
    for(const x of [1.08,3.42])slab(x,1.13,z,.11,2.28,1.16,wall);
    slab(2.25,2.27,z,2.42,.09,1.16,'#8f8e77');
    slab(2.25,2.21,z,.72,.04,.22,new T.MeshBasicMaterial({color:'#fff2c3'}));
  }
  slab(2.25,1.11,-9.05,2.36,2.3,.1,'#414738');
  const shutter=new T.Group();shutter.position.set(2.24,0,rear+.1);scene.add(shutter);
  const metal=new T.MeshLambertMaterial({map:texture('metal',1,1.4)});
  slab(0,gateH/2,0,2.1,gateH,.095,metal,shutter);slab(0,.075,.055,2.12,.15,.1,'#343d32',shutter);
  labelled('EQUIPMENT RETURNS','#415549','#efeed8',1.74,.22,scene,2.25,2.65,rear+.11);
  labelled('REPROGRAPHICS','#364b41','#f0ead0',2.16,.31,scene,-3.65,2.3,rear+.11);
  labelled('04','#cfbc78','#544e34',.73,.7,scene,.47,2.12,rear+.09);
  // Clerestory of frosted wire glass and the side of the copier feed.
  slab(-2.48,1.38,rear+.10,3.66,.9,.08,'#63583f');
  for(let i=0;i<7;i++){
    const x=-4.02+i*.515;
    slab(x,1.38,rear+.155,.47,.80,.05,i%3?'#899e85':'#a1b098');
    for(let j=0;j<5;j++)slab(x,1.07+j*.145,rear+.189,.455,.019,.013,'#707f69');
  }
  slab(-.0,3.19,rear+.32,10.87,.13,.8,new T.MeshLambertMaterial({map:texture('tile',12,1)}));
  for(const x of [-3.6,-.62,3.62]){
    slab(x,2.99,rear+.54,1.65,.12,.52,'#817e68');
    for(const o of [-.12,.1])slab(x,2.918,rear+.54+o,1.44,.046,.06,new T.MeshBasicMaterial({color:'#fff4c8'}));
  }
  // Columns on the left turn into a narrow unlit gap.
  slab(-5.1,1.5,-.52,.43,3,.46,wall);
  slab(-4.81,.16,-.52,.12,.28,.5,'#66573d');
  for(let i=0;i<12;i++)slab(-4.9+i*.22,.024,2.3,.11,.012,.095,'#b3a270');
  const propMaterial=()=>new T.MeshLambertMaterial({vertexColors:true,clippingPlanes:[]});
  function prop(data,x,y,z,angle=0){
    const obj=new T.Mesh(data.g,propMaterial());obj.position.set(x,y,z);obj.rotation.y=angle;obj.castShadow=true;obj.receiveShadow=true;scene.add(obj);return obj;
  }
  prop(modelData(copierVox(2),2.05),-3.92,.022,-1.72,-.84);
  // Impossible detail: the filing drawers pass through the back wall above the window.
  const drawer=modelData(makeVox(catalogue('cabinet')),1.05);
  const stuck=prop(drawer,-1.65,2.12,rear-.11,.04);stuck.rotation.z=.10;
  const hit=[],labels=[];
  function tag(item,type,y,zOffset){
    const label=document.createElement('span');label.className='tag';label.addEventListener('click',()=>onPick(type,item.id));label.textContent=item.name.toUpperCase();overlay.append(label);
    labels.push({item,type,label,anchor:vec(item.x,y,item.z+zOffset)});
  }
  const donorProps=new Map(),outputs=new Map();
  function pickZone(item,type,w,d,y,h){
    const zone=new T.Mesh(box,new T.MeshBasicMaterial({visible:false}));zone.position.set(item.x,y+h/2,item.z);zone.scale.set(w,h,d);
    zone.userData={id:item.id,type};scene.add(zone);hit.push(zone);
  }
  for(const s of sources){
    slab(s.x,.11,s.z,1.46,.2,1.28,'#656b59');
    slab(s.x,.21,s.z,1.42,.055,1.24,'#a69f80');
    for(const dx of [-.59,.59])slab(s.x+dx,.239,s.z,.04,.012,1.1,'#544e3a');
    const size={chair:1.35,cabinet:1.45,phone:1.02}[s.id];
    const data=modelData(makeVox(catalogue(s.id)),size);
    const obj=prop(data,s.x,HEIGHT+.013,s.z,-.24); donorProps.set(s.id,{obj,data});
    tag(s,'donor',.16,.84);pickZone(s,'donor',1.48,1.34,.03,1.52);
  }
  const lights={};
  for(const b of bays){
    const bench=b.id==='bench',w=bench?2.05:1.72,d=bench?.88:1.60;
    slab(b.x,.09,b.z,w,.17,d,'#444c42');slab(b.x,.193,b.z,w-.09,.055,d-.09,bench?'#817866':'#abb0a0');
    if(bench){for(let n=0;n<12;n++)slab(b.x-.91+n*.166,.224,b.z,.075,.018,.77,'#475449');}
    else {
      for(const dx of [-1,1]) for(const dz of [-1,1]){
        slab(b.x+dx*.70,.228,b.z+dz*.64,.18,.016,.052,'#66613f');
        slab(b.x+dx*.76,.228,b.z+dz*.59,.05,.016,.16,'#66613f');
      }
      const lampMat=new T.MeshBasicMaterial({color:'#92664a'});lights[b.id]=lampMat;slab(b.x,.127,b.z+.806,.55,.062,.024,lampMat);
    }
    tag(b,'target',bench?.55:.08,bench?-.34:d*.5+.18);pickZone(b,'target',w,d,.025,1.35);
  }
  // The microphone mast and an analog scale dial sit off the printing area.
  slab(2.93,.76,-.46,.075,1.5,.075,'#5e6657');slab(2.93,1.52,-.45,.45,.56,.25,'#494f43');
  for(let j=0;j<6;j++)slab(2.93,1.34+j*.068,-.313,.31,.031,.03,'#969781');
  slab(1.34,.58,-.37,.07,1.15,.09,'#545b4f');
  slab(1.34,1.14,-.35,.60,.38,.14,'#515b4e');
  labelled('0 — 100','#ddd3aa','#303b33',.48,.20,scene,1.34,1.14,-.26);
  const scratch=new T.Object3D(),tmpColor=new T.Color();
  const grains=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshLambertMaterial(),GRAINS);
  grains.instanceMatrix.setUsage(T.DynamicDrawUsage);grains.frustumCulled=false;grains.visible=false;scene.add(grains);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let transit=null,door=0,doorOpen=false,lastTime=0,frame,aspect=1,width=1,height=1;
  const ray=new T.Raycaster(),cursor=new T.Vector2(),p=vec(),start=vec(),end=vec();
  const destinations=new Map(bays.map(b=>[b.id,b]));
  function selectAt(ev,commit){
    const rect=canvas.getBoundingClientRect();cursor.set(2*(ev.clientX-rect.left)/rect.width-1,1-2*(ev.clientY-rect.top)/rect.height);
    ray.setFromCamera(cursor,camera);const obj=ray.intersectObjects(hit,false)[0]?.object;
    canvas.style.cursor=obj?'pointer':'default';if(commit && obj) onPick(obj.userData.type,obj.userData.id);
  }
  canvas.addEventListener('pointermove',e=>selectAt(e,false));canvas.addEventListener('click',e=>selectAt(e,true));
  function resize(){
    const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);aspect=width/height;
    const span=Math.max(11.35,5.58*aspect);
    Object.assign(camera,{left:-span/2,right:span/2,top:span/aspect*.5,bottom:-span/aspect*.5});
    camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    for(const l of labels){p.copy(l.anchor).project(camera);l.label.style.left=((p.x+1)*50)+'%';l.label.style.top=((1-p.y)*50)+'%';}
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function removeCopy(id){const out=outputs.get(id);if(!out)return;scene.remove(out.obj);out.obj.material.dispose();out.data.g.dispose();outputs.delete(id);}
  function transfer(plan,sourceId,targetId,traits){
    if(transit)return false;
    const donor=donorProps.get(sourceId), bay=destinations.get(targetId);
    const model=makeVox(plan);markCopy(model,sourceId);
    const data=modelData(model,(plan.size||1)*1.25);
    donor.refill=null;donor.obj.scale.setScalar(1);
    removeCopy(targetId);
    const angle=.16, obj=prop(data,bay.x,HEIGHT,bay.z,angle);
    obj.castShadow=false;donor.obj.castShadow=false;
    const fromClip=new T.Plane(vec(0,-1,0),20),toClip=new T.Plane(vec(0,-1,0),HEIGHT-.01);
    donor.obj.material.clippingPlanes=[fromClip];obj.material.clippingPlanes=[toClip];
    donor.obj.material.needsUpdate=true;obj.material.needsUpdate=true;
    const out={obj,data,bay,traits,name:plan.name};outputs.set(targetId,out);
    const count=Math.min(GRAINS,donor.data.pts.length,data.pts.length),r=random(741);
    const pieces=[];donor.obj.updateMatrixWorld();obj.updateMatrixWorld();
    for(let i=0;i<count;i++){
      const u=i/Math.max(1,count-1);
      const a=donor.data.pts[Math.round((1-u)*(donor.data.pts.length-1))],b=data.pts[Math.round(u*(data.pts.length-1))];
      start.set(a.x,a.y,a.z).applyMatrix4(donor.obj.matrixWorld);end.set(b.x,b.y,b.z).applyMatrix4(obj.matrixWorld);
      pieces.push({from:start.clone(),to:end.clone(),phase:r()*6.283,lift:.64+.55*r(),delay:u*.49,fromColor:new T.Color(a.c),toColor:new T.Color(b.c)});
    }
    transit={out,donor,pieces,fromClip,toClip,time:0};
    grains.count=count;grains.visible=true;renderer.shadowMap.needsUpdate=true;return true;
  }
  function updateTransfer(dt){
    const tr=transit;tr.time+=dt;const t=clamp(tr.time/(reduce?.42:2.45),0,1);
    const {donor,out}=tr;
    tr.fromClip.constant=donor.obj.position.y+donor.data.h*(1-clamp(t/.49,0,1))-.001;
    tr.toClip.constant=HEIGHT+out.data.h*clamp((t-.48)/.50,0,1)-.001;
    for(let i=0;i<tr.pieces.length;i++){
      const part=tr.pieces[i],k=clamp((t-part.delay)/.49,0,1),w=Math.sin(k*Math.PI),s=smooth(k);
      scratch.position.lerpVectors(part.from,part.to,s);scratch.position.y+=w*part.lift;
      scratch.position.z+=w*.23*Math.sin(k*5+part.phase);
      scratch.rotation.set(w*part.phase,w*part.phase*.7,w*.8);
      scratch.scale.setScalar(k<=0||k>=1?.00001:.045+w*.025);
      scratch.updateMatrix();grains.setMatrixAt(i,scratch.matrix);
      grains.setColorAt(i,tmpColor.copy(part.fromColor).lerp(part.toColor,s));
    }
    grains.instanceMatrix.needsUpdate=true;grains.instanceColor.needsUpdate=true;
    if(t<1)return;
    grains.visible=false;out.obj.material.clippingPlanes=[];donor.obj.material.clippingPlanes=[];
    donor.obj.material.needsUpdate=true;out.obj.material.needsUpdate=true;
    out.obj.castShadow=true;donor.obj.castShadow=true;donor.refill=0;donor.obj.scale.setScalar(.001);
    transit=null;renderer.shadowMap.needsUpdate=true;afterPrint(out);
  }
  function draw(ms){
    frame=requestAnimationFrame(draw);const dt=Math.min(.08,Math.max(0,(ms-lastTime)/1000));lastTime=ms;
    if(document.hidden)return;
    if(transit)updateTransfer(dt);
    for(const donor of donorProps.values()){if(donor.refill==null)continue;donor.refill+=dt;donor.obj.scale.setScalar(Math.max(.001,smooth(donor.refill/.55)));if(donor.refill>=.55){donor.refill=null;renderer.shadowMap.needsUpdate=true;}}
    for(const out of outputs.values()){
      if(transit?.out===out)continue;
      const r=out.traits.includes('ringing') && ms%2600<380;
      out.obj.rotation.z=r && !reduce?.055*Math.sin(ms*.065):0;
      if(out.traits.includes('rolling') && !reduce){const amp=out.bay.id==='bench'?.53:.18;out.obj.position.x=out.bay.x+Math.sin(ms*.0018)*amp;}
    }
    const amount=doorOpen?1:0;door+=Math.sign(amount-door)*Math.min(dt*(reduce?4:.87),Math.abs(amount-door));
    // Collapse the slats into the housing above the opening.
    shutter.scale.y=Math.max(.025,1-door);shutter.position.y=gateH*door;
    renderer.render(scene,camera);
  }
  function reset(){
    if(transit){transit.donor.obj.material.clippingPlanes=[];transit.donor.obj.material.needsUpdate=true;transit=null;}
    grains.visible=false;for(const d of donorProps.values()){d.refill=null;d.obj.castShadow=true;d.obj.scale.setScalar(1);}
    for(const id of [...outputs.keys()])removeCopy(id);
    doorOpen=false;renderer.shadowMap.needsUpdate=true;
  }
  renderer.shadowMap.needsUpdate=true;frame=requestAnimationFrame(draw);
  return {transfer,reset,select(d,b){for(const l of labels)l.label.classList.toggle('selected',l.item.id===(l.type==='donor'?d:b));},
    interlocks(weight,ring){doorOpen=weight&&ring;lights.scale.color.set(weight?'#d5ef71':'#92664a');lights.receiver.color.set(ring?'#d5ef71':'#92664a');},
    dispose(){cancelAnimationFrame(frame);observer.disconnect();renderer.dispose();}};
}
