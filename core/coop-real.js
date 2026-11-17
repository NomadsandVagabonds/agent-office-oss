import {guestPreset} from './guest-presets.mjs';
import {ITEM_DEFS,makeItem,createInventory} from '../public/world/backrooms/inventory-state.js';
// Transport guard for the trusted-browser real-room authority. It is not an
// anti-cheat server: the private host owns the simulation, including health.
export function validRealSnapshot(s, ids) {
 const finite = n => Number.isFinite(n) && Math.abs(n) < 1e6;
 if (!s || s.real !== true || !['play', 'dead', 'escaped','descending'].includes(s.phase) || !finite(s.time)) return false;
 if (!Array.isArray(s.players) || s.players.length !== ids.length
  || !s.players.every(p => p && ids.includes(p.id)
   && (p.character===undefined||!!guestPreset(p.character))
   && [p.x,p.z,p.yaw,p.pitch,p.health,p.battery].every(finite)
   && (p.y === undefined || finite(p.y)) && p.health >= 0 && p.health <= 4 && p.battery >= 0 && p.battery <= 400
   && Array.isArray(p.bag) && p.bag.length <= 6 && p.bag.every(id => typeof id === 'string'))
  || new Set(s.players.map(p => p.id)).size !== ids.length) return false;
 if (!Array.isArray(s.items) || s.items.length > 100 || !s.items.every(i => i && typeof i.id === 'string' && i.id.length < 80
  && Object.hasOwn(ITEM_DEFS,i.type) && [i.x,i.z].every(finite)
  && (i.owner === null || i.owner === 'used' || ids.includes(i.owner)))) return false;
 try {
  for(const i of s.items)makeItem(i.type,i.id,i);
  for(const p of s.players)if(p.inventory){
   const inv=createInventory({initial:p.inventory}).read();
   const held=inv.slots.filter(Boolean).map(i=>i.id);
   if(held.length!==p.bag.length||held.some(id=>!p.bag.includes(id)))return false;
   for(const i of inv.slots.filter(Boolean))if(!s.items.some(o=>o.id===i.id&&o.owner===p.id&&o.type===i.type))return false;
   if(inv.mountedTorch&&s.items.some(i=>i.id===inv.mountedTorch.id&&i.owner!=='used'))return false;
  }
 }catch{return false;}
 if(s.effects&&(!Array.isArray(s.effects.fires)||s.effects.fires.length>4||!Array.isArray(s.effects.marks)||s.effects.marks.length>64))return false;
 if (!Number.isInteger(s.nodeCount) || s.nodeCount < 1 || s.nodeCount >= 50000) return false;
 if(s.depth!==undefined&&(!Number.isInteger(s.depth)||!Number.isInteger(s.depths)||s.depth<0||s.depths<1||s.depths>8||s.depth>=s.depths))return false;
 if(s.scene){
  const q=s.scene;
  if(!Number.isInteger(q.baseNodes)||q.baseNodes<1||q.baseNodes>s.nodeCount||JSON.stringify(q).length>850000)return false;
  for(const k of ['added','geometries','materials','textures','parents','bindings','appearance','canvases'])if(!Array.isArray(q[k])||q[k].length>50000)return false;
  if(q.added.some(n=>!n||!Number.isInteger(n.id)||n.id<q.baseNodes||n.id>=s.nodeCount)||q.parents.some(row=>!Array.isArray(row)||row.length!==2||!Number.isInteger(row[0])||!Number.isInteger(row[1])||row[0]<1||row[0]>=s.nodeCount||row[1]< -1||row[1]>=s.nodeCount||row[1]===row[0]))return false;
 }
 if(s.furniture&&(!Array.isArray(s.furniture)||s.furniture.length>5000||s.furniture.some(f=>!f||![f.x,f.z].every(finite))))return false;
 if(s.collision&&(!Array.isArray(s.collision)||s.collision.length>1000||s.collision.some(cs=>!Array.isArray(cs)||cs.length>5000||cs.some(c=>!c||Object.values(c).some(v=>typeof v!=='boolean'&&!finite(v))))))return false;
 // Room-local geometry state and lighting cues are bounded JSON, never code.
 const roomId=n=>Number.isInteger(n)&&n>=0&&n<1000;
 const jsonValue=(v,depth=0)=>depth<20&&(v===null||typeof v==='boolean'||typeof v==='string'&&v.length<256||finite(v)||Array.isArray(v)&&v.length<5000&&v.every(x=>jsonValue(x,depth+1))||v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<100&&Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype'].includes(k)&&jsonValue(x,depth+1)));
 if(s.roomState&&(!Array.isArray(s.roomState)||s.roomState.length>1000||JSON.stringify(s.roomState).length>100000||s.roomState.some(row=>!Array.isArray(row)||row.length!==2||!roomId(row[0])||!jsonValue(row[1]))))return false;
 if(s.lighting&&(!Array.isArray(s.lighting)||s.lighting.length>1000||!s.lighting.every(v=>jsonValue(v))))return false;
 const rows = (data, size) => Array.isArray(data) && data.length <= s.nodeCount
  && data.every(row => Array.isArray(row) && row.length === size && row.every(finite)
   && Number.isInteger(row[0]) && row[0] >= 0 && row[0] < s.nodeCount);
 return rows(s.nodes, 12) && (s.tints === undefined || rows(s.tints, 4)) && (s.opacity === undefined || rows(s.opacity, 2))
  && (s.links === undefined || Array.isArray(s.links) && s.links.length < 1000 && s.links.every(v => typeof v === 'boolean'))
  && (s.solids === undefined || Array.isArray(s.solids) && s.solids.length < 1000 && s.solids.every(a => Array.isArray(a) && a.length < 5000 && a.every(v => typeof v === 'boolean')))
  && (s.lights === undefined || Array.isArray(s.lights) && s.lights.length < 1000 && s.lights.every(finite));
}
