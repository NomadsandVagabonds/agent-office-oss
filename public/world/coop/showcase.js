// A fixed private tour, not a second room generator. Production geometry,
// lessons, maze spacing, hazards, supplies and exits still do their usual work.
export const SHOWCASE = Object.freeze([
 {theme:'yellow',rooms:['cutouts','party','chairs','ceiling-meeting','blackout-bay','dispatch'],members:['pirate','porter']},
 {theme:'fitout',rooms:['quiet-zone','mailroom','copiers','keyboard-floor','drop-plenum'],members:['toner']},
 {theme:'suburb',rooms:['show-home','the-close','back-garden','lemonade','model-village','walk-in'],members:['moth']},
 // Gemini is finishing this floor in its own worktree. No substitute office
 // floor: the complete new route stays unavailable until integration is tested.
 {theme:'waterpark',pending:true,rooms:[],members:[]},
 {theme:'night',size:28,setPieces:2,rooms:['cover','many-doors','ceiling-plants','mecha','last-light','unsure-hall'],members:['other-door','shadow']},
].map(f=>Object.freeze({...f,rooms:Object.freeze(f.rooms),members:Object.freeze(f.members)})));
export function curate(visit){
 visit.mascot=SHOWCASE.findIndex(f=>f.members.includes('pirate'));visit.headline=null;
 visit.company=SHOWCASE.flatMap((f,floor)=>f.members.map(id=>({id,floor})));
 visit.hand=SHOWCASE.flatMap(f=>f.rooms);
 visit.floors.forEach((f,i)=>{f.hand=[...SHOWCASE[i].rooms];f.must=[];f.rooms=SHOWCASE[i].size||24;f.setPieces=SHOWCASE[i].setPieces||1;f.mascot=SHOWCASE[i].members.includes('pirate');});
 return visit;
}
