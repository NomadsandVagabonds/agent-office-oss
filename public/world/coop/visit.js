// Use the production dealer and complete room/cast catalogues. Suburbia is
// and the live four-floor visit rules. The showcase is an explicit co-op option.
import {SHOWCASE_ROUTE,SHOWCASE_SEED,SHOWCASE_PENDING} from '../../../core/coop-routes.mjs';
import {SHOWCASE,curate} from './showcase.js';
import {planVisit,floorOf} from '../backrooms/plan.js';
export function coopVisit(seed,{slice=false,route='random',...options}={}){
 if(route===SHOWCASE_ROUTE&&SHOWCASE_PENDING)throw new Error(SHOWCASE_PENDING);
 if(route===SHOWCASE_ROUTE)return curate(planVisit(SHOWCASE_SEED,{...options,depths:SHOWCASE.length,themes:SHOWCASE.map(f=>f.theme),pursuer:true}));
 return planVisit(seed,{...options,...(slice?{depths:1}:{})});
}
export {floorOf};
export {carryFloor} from './transition.js';
