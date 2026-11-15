import {EMOTES} from './social-rules.js';
// Camcorder overlay: game time keeps running while the two visitors agree.
export function createSocialUI({read,send,resume,stop}){
 const pane=document.createElement('section');pane.id='socialPanel';pane.hidden=true;pane.setAttribute('role','dialog');pane.setAttribute('aria-label','Teammate interactions');
 const launcher=document.createElement('button');launcher.id='emoteButton';launcher.textContent='☺ Emotes · B';launcher.hidden=true;
 document.body.append(pane,launcher);let mode=null,stamp='',previousTrade=null,dismissed=null;
 const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.onclick=action;return b;};
 function show(next){mode=next;pane.hidden=false;stop();document.exitPointerLock();document.getElementById('panel').hidden=true;stamp='';render();pane.querySelector('button')?.focus();}
 function close(){const {state}=read();if(state?.trade){dismissed=state.trade.id;send({type:'trade-cancel',trade:state.trade.id});}mode=null;pane.hidden=true;resume();}
 function emotes(){const {state,me}=read();if(state?.phase==='play'&&me?.health>0&&!state.trade)show('emotes');}
 launcher.onclick=emotes;
 function render(){
  const {state,me}=read();if(!mode||!state||!me)return;
  const t=state.trade,other=state.players.find(p=>p.id!==me.id);
  const key=JSON.stringify([mode,t,me.bag,other?.bag,me.notice?.text]);if(key===stamp)return;stamp=key;pane.replaceChildren();
  const title=document.createElement('h2');title.textContent=mode==='emotes'?'EMOTES':'TRADE';pane.append(title);
  const line=text=>{const p=document.createElement('p');p.textContent=text;pane.append(p);};
  if(mode==='emotes'){
   const row=document.createElement('div');row.className='signals';
   for(const [kind,emoji]of Object.entries(EMOTES))row.append(button(`${emoji} ${kind}`,()=>{send({type:'emote',kind});mode=null;pane.hidden=true;resume();}));pane.append(row,button('Back to camera',close));return;
  }
  if(!t){line(me.notice?.text||'Trade closed · no items moved');pane.append(button('Back to camera',close));return;}
  const command=(type,extra={})=>send({type,trade:t.id,revision:t.revision,...extra});
  if(t.status==='pending'){
   line(t.from===me.id?'Waiting for your partner to agree…':'Your partner wants to trade.');
   line('Stay close while trading.');
   if(t.from!==me.id)pane.append(button('Accept trade',()=>command('trade-answer',{accept:true})));
   pane.append(button(t.from===me.id?'Cancel request':'Decline',close));return;
  }
  line('Choose what to give. You can trade without giving anything back.');
  const columns=document.createElement('div');columns.className='tradeColumns';
  for(const p of [me,other]){
   const col=document.createElement('div'),h=document.createElement('h3');h.textContent=p===me?'YOUR POCKETS':'THEIR OFFER';col.append(h);
   const ids=p===me?p.bag:t.offers[p.id];
   if(!ids.length){const empty=document.createElement('p');empty.textContent=p===me?'Pockets empty':'Nothing offered';col.append(empty);}
   for(const id of ids){const i=state.items.find(i=>i.id===id);if(!i)continue;
    const b=button(`${t.offers[p.id].includes(id)?'▣':'□'} ${i.type}`,()=>command('trade-offer',{item:id}));
    if(p===me){b.setAttribute('aria-pressed',String(t.offers[p.id].includes(id)));b.dataset.item=id;}else b.disabled=true;col.append(b);
   }
   const foot=document.createElement('small');foot.textContent=`${p.bag.length}/6 pockets · ${t.offers[p.id].length} offered`;col.append(foot);columns.append(col);
  }
  pane.append(columns);line(t.confirmed.includes(other.id)?'Partner confirmed this offer.':'Both players must confirm. Changing an offer resets both confirmations.');
  if(me.notice?.until>state.time)line(me.notice.text);
  const confirm=button(t.confirmed.includes(me.id)?'Confirmed · waiting for partner':'Confirm exchange',()=>command('trade-confirm'));confirm.id='tradeConfirm';confirm.disabled=t.confirmed.includes(me.id)||!t.members.some(id=>t.offers[id].length);
  pane.append(confirm,button('Cancel trade',close));
 }
 function update(){const {state,me,real}=read();launcher.hidden=!real||state?.phase!=='play'||me?.health<=0;
  if(state?.phase!=='play'||me?.health<=0){pane.hidden=true;mode=null;return;}
  const t=state.trade;if(t&&t.id!==dismissed&&t.id!==previousTrade){previousTrade=t.id;show('trade');}
  if(mode)render();
 }
 return {update,get visible(){return !pane.hidden;},key(e){
  if(e.key==='Escape'&&mode){e.preventDefault();close();return true;}
  if(e.code==='KeyB'&&!e.repeat&&!mode){emotes();return true;}
  return !!mode;
 }};
}
