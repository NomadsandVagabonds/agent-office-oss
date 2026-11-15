// WebSockets are ordered and reliable. Send immutable scene resources once and
// each screen revision once, rather than repeating a large canvas at 10 Hz.
// A disconnect ends the visit; reconnect is not a partial snapshot replay.
export function createSceneSender(){
 let floor=null;const sent=new Map();
 return state=>{
  if(!state.scene)return state;
  if(floor!==state.depth){floor=state.depth;sent.clear();}
  const scene={...state.scene};
  for(const key of ['added','geometries','materials','textures','canvases']){
   const seen=sent.get(key)||new Map();sent.set(key,seen);
   scene[key]=state.scene[key].filter(row=>{const version=row.version??0;if(seen.get(row.id)===version)return false;seen.set(row.id,version);return true;});
  }
  return {...state,scene};
 };
}
