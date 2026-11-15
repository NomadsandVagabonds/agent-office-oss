// Review one authored floor without pretending the unfinished waterpark is
// available. This is used only by local tooling, never the invite endpoint.
import {planVisit,floorOf} from '../backrooms/plan.js';
import {SHOWCASE} from './showcase.js';
import {SHOWCASE_SEED} from '../../../core/coop-routes.mjs';
export function previewFloor(index){
 const spec=SHOWCASE[index];
 if(!spec||spec.pending)throw Error('This showcase floor is not ready for review.');
 const v=planVisit(`${SHOWCASE_SEED}/floor:${index}`,{depths:1,themes:[spec.theme],pursuer:spec.members.includes('pirate')});
 const f=v.floors[0];f.hand=[...spec.rooms];f.must=[];f.rooms=spec.size||24;f.setPieces=spec.setPieces||1;
 v.company=spec.members.map(id=>({id,floor:0}));v.hand=[...spec.rooms];v.headline=null;
 return v;
}
export {floorOf};
