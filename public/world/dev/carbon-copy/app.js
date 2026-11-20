import { catalogue, nouns, modelOptions, sketch, validateRecipe } from './recipes.js';
import { setupRoom, sources, bays } from './room.js';

const el=id=>document.getElementById(id);
const object=el('object'), controls=el('controls'), log=el('status');
const catalogText='Shapes: '+nouns.join(', ')+'. Add a color, heavy, rolling or ringing. Join two shapes with “with”.';
el('catalog').textContent=catalogText;
let source='cabinet',target='scale',room,transferActive=false,sound=false,ctx,request=null,modelState='unavailable';
const contents=new Map(),cache=new Map();

function tone(start,hz,endHz,length,volume,type='sine'){
  if(!sound || !ctx)return;
  const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+start;
  osc.type=type;osc.frequency.setValueAtTime(hz,t);osc.frequency.exponentialRampToValueAtTime(endHz,t+length);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.014);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
  osc.connect(gain).connect(ctx.destination);osc.start(t);osc.stop(t+length+.012);
}
function ringing(){for(const t of [0,.15,.31]){tone(t,1450,1430,.10,.032);tone(t,1080,1040,.09,.028);}}
function updateSound(){el('sound').textContent=sound?'Sound on':'Sound off';el('sound').setAttribute('aria-pressed',String(sound));}
el('sound').onclick=async()=>{
  sound=!sound;
  if(sound){try{ctx??=new AudioContext();await ctx.resume();tone(0,450,640,.09,.04);}catch{sound=false;}}
  updateSound();
};
function buttons(items,container,type){
  for(const item of items){
    const b=document.createElement('button');b.type='button';b.dataset.id=item.id;
    b.append(document.createTextNode(item.name));
    if(item.trait){const t=document.createElement('small');t.textContent=item.trait;b.append(t);}
    b.onclick=()=>choose(type,item.id);container.append(b);
  }
}
buttons(sources,el('donors'),'donor');buttons(bays,el('targets'),'target');
function update(){
  for(const [id,selected] of [['donors',source],['targets',target]]){
    for(const b of el(id).children)b.setAttribute('aria-pressed',String(b.dataset.id===selected));
  }
  room?.select(source,target);
}
function choose(type,id){
  if(transferActive)return;
  if(type==='donor')source=id;else target=id;
  const c=contents.get(id);
  if(type==='target')log.textContent=c?c.name+' · '+c.traits.join(' + ')+'. Printing here replaces this copy.':'Output set to '+bays.find(b=>b.id===id).name+'.';
  else log.textContent=sources.find(s=>s.id===id).name+' selected. Copies inherit '+sources.find(s=>s.id===id).trait+'.';
  update();
}
function locks(){
  const weight=contents.get('scale')?.traits.includes('heavy')||false;
  const audio=contents.get('receiver')?.traits.includes('ringing')||false;
  el('weight').classList.toggle('lit',weight);el('audio').classList.toggle('lit',audio);
  el('weight').textContent=weight?'Scale ✓':'Scale';el('audio').textContent=audio?'Receiver ✓':'Receiver';
  el('gate').textContent=weight&&audio?'Shutter open':'Shutter locked'; room?.interlocks(weight,audio);
  return {weight,audio};
}
function lockControls(busy){
  transferActive=busy;
  for(const widget of controls.querySelectorAll('input,button'))widget.disabled=busy;
  el('print').disabled=busy||!room;
}
function printed(out){
  contents.set(out.bay.id,{name:out.name,traits:out.traits});const {weight,audio}=locks();
  const traitList=out.traits.join(' + ');
  let result=out.bay.id==='bench'?'On the test track.':out.bay.id==='scale'?(weight?'Scale engaged.':'Too light for the scale.'):(audio?'Receiver engaged.':'The receiver heard nothing.');
  if(weight && audio){result='Both interlocks cleared. The returns shutter is open.';tone(.1,160,310,.5,.04,'triangle');}
  if(out.traits.includes('ringing'))ringing();
  else tone(0,110,62,.16,.08,'triangle');
  log.textContent=out.name+' · '+traitList+'. '+result;
  lockControls(false);request=null;
}
try{room=setupRoom(el('scene'),el('worldlabels'),choose,printed);}
catch(err){el('rendererFail').hidden=false;log.textContent='Renderer unavailable.';console.error(err);}
update();locks();lockControls(false);
for(const b of controls.querySelectorAll('[data-example]'))b.onclick=()=>{object.value=b.dataset.example;object.focus();};
el('scan').onclick=()=>{
  const donor=sources.find(s=>s.id===source);object.value=donor.id;
  log.textContent=donor.name+' shape scanned. Choose any feedstock to build it.';tone(0,420,780,.18,.035);
};
async function checkModel(){
  try{if(globalThis.LanguageModel)modelState=await LanguageModel.availability(modelOptions);}catch{}
  if(location.protocol==='http:' && ['localhost','127.0.0.1'].includes(location.hostname)){
    try{const r=await fetch('/_local/model',{signal:AbortSignal.timeout(2000)});if(r.ok && (await r.json()).ready)modelState='local';}catch{}
  }
  el('aiStatus').textContent=modelState==='local'?'Local AI ready. Type an unlisted object to sketch it on this computer.':modelState==='available'?'On-device AI ready. Unlisted objects are sketched locally.':'Catalog mode. Freeform AI needs a ready on-device language model in Chrome.';
}
checkModel();
controls.onsubmit=async e=>{
  e.preventDefault();if(transferActive||!room)return;
  const text=object.value.trim().slice(0,96);if(!text){object.focus();log.textContent='Enter a shape to copy.';return;}
  const key=text.toLowerCase();let plan=catalogue(text)||cache.get(key);
  const job=new AbortController();request=job;lockControls(true);
  try{
    if(!plan){
      if(!['available','local'].includes(modelState)){el('more').open=true;throw Error('Outside the local catalog. Try “teapot with a cactus” or choose a listed shape.');}
      log.textContent='Sketching “'+text+'” on this device…';
      const timer=setTimeout(()=>job.abort(),45000);
      try{
        if(modelState==='local'){
          const r=await fetch('/_local/recipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:job.signal});
          const raw=await r.json();if(!r.ok)throw Error(raw.error||'The local sketcher is busy.');
          plan=validateRecipe(raw,text);
        }else{plan=await sketch(text,job.signal);}
      }finally{clearTimeout(timer);}
      if(request!==job)return;
      if(cache.size>=32)cache.delete(cache.keys().next().value);
      cache.set(key,plan);
    }
    const donor=sources.find(s=>s.id===source);
    const traits=[...new Set([...plan.traits,donor.trait])];
    if(!room.transfer(plan,source,target,traits))throw Error('Transfer already in progress.');
    contents.delete(target);locks();
    log.textContent='Transferring '+donor.name.toLowerCase()+' into '+plan.name+'…';
    tone(0,90,350,.64,.040,'sawtooth');tone(.18,390,120,1.15,.026,'triangle');
  }catch(err){
    if(request!==job)return;request=null;lockControls(false);
    log.textContent=job.signal.aborted?'Sketch timed out. Try a simpler request or a catalog shape.':err.message;
  }
};
el('reset').onclick=()=>{
  request?.abort();request=null;room?.reset();contents.clear();source='cabinet';target='scale';
  object.value='rubber duck';log.textContent='Ready. Feedstock passes one trait to the copy.';locks();update();lockControls(false);
};
