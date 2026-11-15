// Host-only operations over the production pocket model. World identity stays
// in items; bag mirrors let the existing consensual trade/revive rules operate.
import {createInventory,makeItem} from '../backrooms/inventory-state.js';
import {CAMERA_TUNING} from '../backrooms/camera-state.js';
export function reconcileInventory(s,p){
 const owned=p.bag.map(id=>s.items.find(i=>i.id===id&&i.owner===p.id)).filter(Boolean);
 const before=p.inventory||{slots:Array(6).fill(null),selected:0,holstered:false};
 const slots=before.slots.map(i=>i&&owned.find(o=>o.id===i.id)||null);
 for(const item of owned)if(!slots.some(i=>i?.id===item.id)){const at=slots.indexOf(null);if(at>=0)slots[at]=item;}
 const model=createInventory({initial:{...before,slots}});p.inventory=model.read();return model;
}
export function inventoryView(s,p){
 return {...(p.inventory||{slots:Array(6).fill(null),selected:0}),health:{current:p.health,max:4,dead:p.health<=0},camera:{remaining:p.battery,capacity:CAMERA_TUNING.capacity,depleted:p.battery<=0}};
}
export function heldItem(p){const v=p.inventory;return v&&!v.holstered?v.slots[v.selected]:null;}
export function lightPower(p){
 if(p.health<=0||!p.inventory)return 0;const v=p.inventory,i=v.mountedTorch&&v.mountedTorch.id===v.activeTorch?v.mountedTorch:heldItem(p);
 return i?.type==='torch'&&i.id===v.activeTorch&&i.charge>0?1:0;
}
function save(s,p,model){
 const next=model.read(),ids=next.slots.filter(Boolean).map(i=>i.id);
 for(const i of s.items)if(i.owner===p.id&&!ids.includes(i.id))i.owner='used';
 for(const i of next.slots.filter(Boolean)){
  const record=s.items.find(o=>o.id===i.id);
  if(record)Object.assign(record,i,{owner:p.id});else s.items.push({...i,owner:p.id,x:p.x,z:p.z,y:p.y-1.1});
 }
 p.inventory=next;p.bag=ids;
}
export function tickInventory(s,p,dt){const model=reconcileInventory(s,p);if(p.health>0)model.tick(dt);save(s,p,model);}
export function inventoryAct(s,p,m,ctx){
 if(!['select','toggle-light','take','drop','use','craft'].includes(m.type))return false;
 if(s.phase!=='play'||p.health<=0)return true;
 const model=reconcileInventory(s,p),before=model.read();let out;
 const camera={read:()=>inventoryView(s,p).camera,recharge(seconds){const added=Math.min(seconds,CAMERA_TUNING.capacity-p.battery);if(p.battery<=0||added<=0)return {ok:false,reason:'full-charge'};p.battery+=added;return {ok:true,added};}};
 if(m.type==='select'){out={ok:model.select(m.slot,{toggle:!!m.toggle})};}
 else if(m.type==='toggle-light')out=model.toggleLight();
 else if(m.type==='take'){
  const item=s.items.find(i=>i.id===m.id&&i.owner===null);
  if(!item||!ctx.canTake(item))return true;
  out=model.add(item);
  if(out.ok){if(out.remainder)Object.assign(item,out.remainder);else item.owner='used';}
 }else if(m.type==='craft'){
  out=model.craft(m.refs,{paperCount:m.paperCount,camera,ignite:ctx.ignite});
 }else{
  const item=before.slots[before.selected];
  if(before.holstered||!item||item.id!==m.id)return true;
  if(m.type==='drop'){
   const pos=ctx.dropSpot(item);if(!pos)out={ok:false,reason:'no-space'};
   else{model.remove(item.id);const record=s.items.find(i=>i.id===item.id);Object.assign(record,item,pos,{owner:null});out={ok:true};}
  }else if(item.type==='battery')out=model.craft([{slot:before.selected,id:item.id},{device:'camera'}],{camera});
  else if(item.type==='chalk'){
   // Commit the world mark first; only spend a use when placement succeeds.
   const placed=item.uses>0?ctx.mark():{ok:false,reason:'empty-chalk'};out=placed.ok?model.useSelected({canMark:true}):placed;
  }else out=model.useSelected({heal:ctx.heal,snip:ctx.snip});
 }
 if(out?.ok){
  save(s,p,model);
  if(s.trade&&!['select','toggle-light'].includes(m.type))s.trade=null;
  p.inventoryResult={serial:(p.inventoryResult?.serial||0)+1,ok:true,action:m.type,recipe:out.recipe};
 }else if(out){p.inventoryResult={serial:(p.inventoryResult?.serial||0)+1,ok:false,action:m.type,reason:out.reason||'invalid-item'};p.notice={text:(out.description||out.reason||'Cannot use this item').replaceAll('-',' '),until:s.time+3};}
 return true;
}
export {makeItem};

export function mutateInventory(s,p,fn){const model=reconcileInventory(s,p),out=fn(model);if(out?.ok){save(s,p,model);s.trade=null;}return out;}
