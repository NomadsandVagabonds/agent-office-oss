// Reuse the production visit plan, with an explicitly audited co-op room deck.
import {planVisit,floorOf} from '../backrooms/plan.js';
export const COOP_ROOMS=Object.freeze(['ceiling-meeting','coolers','hall-of-fame','many-doors']);
export function coopVisit(seed,{slice=false}={}){
 const visit=planVisit(seed,{...(slice?{depths:1}:{}),pursuer:true});
 for(const [i,f]of visit.floors.entries()){
  f.hand=COOP_ROOMS.filter((_,k)=>k%2===i%2);f.must=[];f.mascot=true;
 }
 return visit;
}
export {floorOf};
export {carryFloor} from './transition.js';
