// Local review controls only; the production entry point never imports this.
export function partyStudy(handle) {
  const rt = handle.world.rooms.find(r => r.def.arch === 'mandatory-fun');
  if (!rt) return () => {};
  let enemyDamage = false;
  const setMode = () => handle.setSetting('difficulty', enemyDamage ? 'easy' : 'tourist');
  setMode();
  const el = document.createElement('aside'); el.dataset.lightingStudy = '';
  Object.assign(el.style, { position: 'fixed', top: '10px', left: '10px', zIndex: 100, background: '#151912e8', color: '#eee9d3', padding: '12px', font: '13px monospace', maxWidth: '240px' });
  const title = document.createElement('b'); title.textContent = 'FUN COMMITTEE · STUDY'; el.append(title);
  const note = document.createElement('p'); note.textContent = 'Enemy damage starts OFF (Tourist). Enable it below to test real attacks. A held balloon protects you.'; el.append(note);
  const button = (label, action) => { const b=document.createElement('button');b.textContent=label;b.style.cssText='display:block;margin:6px 0';b.onclick=action;el.append(b);return b; };
  button('Stand in foyer', () => handle.goto(rt.id, 0, rt.def.D/2-1.5, 0, 0));
  button('Look at party buffet', () => {
    const table=rt.partyDressing?.find(p=>p.kind==='buffet');if(!table)return;
    const x=table.x+table.n[0]*3,z=table.z+table.n[2]*3;
    handle.goto(rt.id,x,z,Math.atan2(x-table.x,z-table.z),.06);
  });
  button('Look at supply piles', () => {
    const pile=rt.partyDressing?.find(p=>p.kind.startsWith('supplies:'));if(!pile)return;
    const x=pile.x+pile.n[0]*3,z=pile.z+pile.n[2]*3;
    handle.goto(rt.id,x,z,Math.atan2(x-pile.x,z-pile.z),0);
  });
  button('Hold red balloon', () => {
    const inv=handle.inventory;let index=inv.model.read().slots.findIndex(i=>i?.type==='balloon');
    if(index<0){inv.give({id:'party-study-balloon',type:'balloon'});index=inv.model.read().slots.findIndex(i=>i?.type==='balloon');}
    if(index>=0 && inv.held()?.type!=='balloon')inv.select(index);
  });
  button('Put balloon away', () => { const inv=handle.inventory;if(inv.held())inv.select(inv.model.read().selected); });
  const damageButton = button('Enable enemy damage', () => {
    enemyDamage = !enemyDamage; setMode();
    damageButton.textContent = enemyDamage ? 'Disable enemy damage (Tourist)' : 'Enable enemy damage';
  });
  button('Take one hit', () => {
    handle.setSetting('difficulty', 'easy');
    handle.health.damage(1);
    setMode();
  });
  button('Restart study', () => location.reload());
  const status=document.createElement('p');el.append(status);document.body.append(el);
  const timer=setInterval(()=>{status.textContent=`${rt.partyState().mode} · holding ${handle.inventory.held()?.type||'nothing'} · health ${handle.health.read().current}/4 · enemy damage ${enemyDamage?'ON':'OFF'}`;},100);
  return ()=>{clearInterval(timer);el.remove();};
}
