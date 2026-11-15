import {planSupplies,supplyRooms} from '../backrooms/supplies.js';
// Production seeded placement, with consumables scaled to two tapes. The first
// floor supplies two torches and one shared crafting kit for this private alpha.
export function coopSupplies(level,players=2){
 const base=planSupplies(level),out=[];
 for(const spec of base){
  out.push(spec);
  if(['battery','snack'].includes(spec.type))for(let n=1;n<players;n++)out.push({...spec,id:`${spec.id}-p${n}`,rooms:[...spec.rooms].reverse()});
 }
 const rooms=supplyRooms(level).map(r=>r.id);
 const ensure=(type,count,extra={})=>{for(let n=out.filter(s=>s.type===type).length;n<count;n++)out.push({id:`coop-${type}-${n}`,type,rooms:rooms.slice(n).concat(rooms.slice(0,n)),...extra});};
 ensure('snack',players);
 if(level.depth===0){ensure('torch',players,{charge:90});ensure('paper',1,{quantity:5});ensure('lighter',1);ensure('tape',players);}
 return out;
}
