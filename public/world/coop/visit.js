// Use the production dealer and complete room/cast catalogues. Suburbia is
// explicitly included in private co-op while it remains opt-in in solo play.
import {planVisit,floorOf} from '../backrooms/plan.js';
export function coopVisit(seed,{slice=false,...options}={}){
 const base=planVisit(seed,{...options,...(slice?{depths:1}:{})});
 if(slice||options.themes)return base;
 const themes=base.floors.map(f=>f.theme);
 themes[Math.min(2,themes.length-1)]='suburb';
 return planVisit(seed,{...options,depths:base.depths,themes});
}
export {floorOf};
export {carryFloor} from './transition.js';
