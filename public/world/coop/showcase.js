// A fixed private tour, not a second room generator. Production geometry,
// lessons, maze spacing, hazards, supplies and exits still do their usual work.
export const SHOWCASE = Object.freeze([
 {theme:'yellow',rooms:['cutouts','party','chairs','ceiling-meeting','blackout-bay','dispatch'],members:['pirate','porter']},
 {theme:'fitout',rooms:['quiet-zone','mailroom','copiers','keyboard-floor','drop-plenum'],members:['toner']},
 {theme:'suburb',rooms:['show-home','the-close','back-garden','lemonade','model-village','walk-in'],members:['moth']},
 {theme:'exec',rooms:['photo','phone','vending','cover','mecha'],members:['other-door']},
 {theme:'night',rooms:['stress-pool','many-doors','ceiling-plants','last-light','unsure-hall'],members:['pirate','shadow']},
].map(f=>Object.freeze({...f,rooms:Object.freeze(f.rooms),members:Object.freeze(f.members)})));
export function curate(visit){
 visit.mascot=SHOWCASE.findIndex(f=>f.members.includes('pirate'));visit.headline=null;
 visit.company=SHOWCASE.flatMap((f,floor)=>f.members.map(id=>({id,floor})));
 visit.hand=SHOWCASE.flatMap(f=>f.rooms);
 visit.floors.forEach((f,i)=>{f.hand=[...SHOWCASE[i].rooms];f.must=[];f.rooms=24;f.mascot=SHOWCASE[i].members.includes('pirate');});
 return visit;
}
