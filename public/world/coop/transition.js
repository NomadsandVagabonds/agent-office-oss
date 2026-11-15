// Only possessions cross a seam. Ground items stay upstairs; IDs never repeat.
export function carryFloor(s,next){
 const copy=structuredClone(s);copy.depth=next;copy.phase='play';copy.trade=null;
 copy.items=copy.items.filter(i=>copy.players.some(p=>i.owner===p.id&&p.bag.includes(i.id)));
 for(const p of copy.players){p.input={f:0,s:0};delete p.emote;delete p.notice;}
 for(const key of ['exit','exitOpen','descent','nodes','tints','opacity','lights','links','solids','nodeCount','creatures','pirate','sounds'])delete copy[key];
 return copy;
}

export function beginTransition(room,state,now=Date.now()){
 if(room.transition||room.state.phase!=='play'||state.phase!=='descending'||state.depth!==room.depth||state.depth+1>=state.depths)return null;
 const depth=state.depth+1,carry=carryFloor(state,depth);
 room.transition={depth,carry,ready:new Set(),at:now};room.state={...state,phase:'loading'};
 return {type:'floor-load',depth,carry};
}
export function floorReady(room,id,depth){
 const t=room.transition;if(!t||room.state.phase!=='loading'||t.depth!==depth||!room.clients.has(id))return null;
 t.ready.add(id);if(t.ready.size!==room.clients.size||t.ready.size!==2)return null;
 room.depth=depth;room.state=t.carry;room.snapshotAt=Date.now();room.stalled=false;room.transition=null;
 return {type:'floor-start',depth,state:room.state};
}
