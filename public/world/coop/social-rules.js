// Pure host-owned co-op rules. No transport, UI, or renderer dependencies.
export const EMOTES = Object.freeze({wave:'👋',dance:'💃',heart:'♥',help:'!'});
export const REACH = 2;
export const supplyPlan = players => Array.from({length:Math.max(1,Math.min(2,players))*6},(_,i)=>i%2?'snack':'battery');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const note=(s,p,text)=>{p.notice={text,until:s.time+4};};
const owned=(s,p,id)=>p.bag.includes(id)&&s.items.find(i=>i.id===id&&i.owner===p.id);
const pair=(s,a,b,ctx)=>a&&b&&a!==b&&distance(a,b)<=REACH&&Math.abs((a.y||0)-(b.y||0))<1&&ctx.canReach(a,b);
function cancel(s,text){if(s.trade)for(const p of s.players)note(s,p,text);s.trade=null;}
function validOffers(s,t){return t.members.every(id=>{const p=s.players.find(p=>p.id===id);return p&&t.offers[id].every(item=>owned(s,p,item));});}
export function socialTick(s,ctx){
 const t=s.trade;if(!t)return;
 const [a,b]=t.members.map(id=>s.players.find(p=>p.id===id));
 if(s.phase!=='play'||!a?.health||!b?.health||!pair(s,a,b,ctx)||s.time>=t.until||!validOffers(s,t))cancel(s,'Trade closed · no items moved');
}
export function socialAct(s,id,m,ctx){
 if(!['revive','emote','trade-request','trade-answer','trade-offer','trade-confirm','trade-cancel'].includes(m.type))return false;
 const p=s.players.find(p=>p.id===id);if(s.phase!=='play'||!p||p.health<=0)return true;
 const other=s.players.find(q=>q.id!==id);
 if(m.type==='emote'){
  if(!Object.hasOwn(EMOTES,m.kind)||(p.emoteNext||0)>s.time)return true;
  p.emote={kind:m.kind,until:s.time+3};p.emoteNext=s.time+.8;return true;
 }
 if(m.type==='revive'){
  if(!other||other.health>0||!pair(s,p,other,ctx))return true;
  const snack=owned(s,p,m.item);
  if(snack?.type!=='snack'){note(s,p,'Select a snack to revive your partner');return true;}
  const battery=other.battery<=0?s.items.find(i=>i.type==='battery'&&owned(s,p,i.id)):null;
  if(other.battery<=0&&!battery){note(s,p,'Flat camera · a battery pack is needed too');return true;}
  for(const item of [snack,battery].filter(Boolean)){item.owner='used';p.bag=p.bag.filter(id=>id!==item.id);}
  other.health=1;if(battery)other.battery=120;
  ctx.revive(other.id);note(s,p,'Partner revived');note(s,other,'Revived · one heart');socialTick(s,ctx);return true;
 }
 socialTick(s,ctx);
 if(m.type==='trade-request'){
  if(!other?.health||!pair(s,p,other,ctx)||s.trade||(p.tradeNext||0)>s.time)return true;
  p.tradeNext=s.time+5;s.tradeSerial=(s.tradeSerial||0)+1;
  s.trade={id:s.tradeSerial,members:[id,other.id],from:id,status:'pending',until:s.time+15,revision:0,offers:{[id]:[],[other.id]:[]},confirmed:[]};return true;
 }
 const t=s.trade;if(!t||m.trade!==t.id||!t.members.includes(id))return true;
 if(m.type==='trade-cancel'){cancel(s,'Trade cancelled · no items moved');return true;}
 if(m.type==='trade-answer'){
  if(t.status!=='pending'||t.from===id)return true;
  if(m.accept!==true){cancel(s,'Trade declined');return true;}
  t.status='open';t.until=s.time+60;return true;
 }
 if(t.status!=='open'||m.revision!==t.revision)return true;
 if(m.type==='trade-offer'){
  if(!owned(s,p,m.item))return true;
  const a=t.offers[id];t.offers[id]=a.includes(m.item)?a.filter(i=>i!==m.item):[...a,m.item];
  t.revision++;t.confirmed=[];t.until=s.time+60;return true;
 }
 if(m.type==='trade-confirm'){
  if(!validOffers(s,t)||!t.members.some(id=>t.offers[id].length))return true;
  if(!t.confirmed.includes(id))t.confirmed.push(id);
  if(t.confirmed.length<2)return true;
  const [a,b]=t.members.map(id=>s.players.find(p=>p.id===id));
  const ab=t.offers[a.id],ba=t.offers[b.id];
  if(a.bag.length-ab.length+ba.length>6||b.bag.length-ba.length+ab.length>6){t.confirmed=[];for(const p of [a,b])note(s,p,'Not enough pocket space · adjust the offer');return true;}
  // Commit both sides together, after rechecking ownership and final capacity.
  a.bag=[...a.bag.filter(id=>!ab.includes(id)),...ba];b.bag=[...b.bag.filter(id=>!ba.includes(id)),...ab];
  for(const id of ab)s.items.find(i=>i.id===id).owner=b.id;
  for(const id of ba)s.items.find(i=>i.id===id).owner=a.id;
  s.trade=null;for(const p of [a,b])note(s,p,'Trade complete');
 }
 return true;
}
