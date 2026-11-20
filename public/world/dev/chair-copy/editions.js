import { rowOffset, printInk } from './misprint.js';
import { Vox, mix } from '../../vox/vox.js';

// Each defect acts on a physical part of the object. Heights run from the feet to the crown.
// Flat props feed sideways so a sheet of paper or a keyboard can still tear across its face.
const desks = new Set(['desk','counter','hottable','cafetable','reception','sidetable','foosball','trolley','bench','stool','lectern']);
const cabinets = new Set(['cabinet','credenza','fridge','minifridge','rack','bookshelf','shelving','vending','boxes','printer']);
const heads = new Set(['chair','armchair','sofa','flamingo','floorlamp','desklamp','plant','planttall','tree','coatrack','fan','globe','gumball','telescope','fuelstand','balloon','scissors']);
const electronics = new Set(['crt','camera','carbon-camera','arcade','jukebox','pinball','console','acunit','cooler','coffeemachine','extinguisher','torch','torch-prepared','lighter','opener']);
const profiles = {
  desk:{band:.84,names:['Overhanging edge','Double worktop','Cross-grain return','Sagging corner']},
  drawers:{band:.43,names:['Drawer out of register','Extra compartment','Reversed bay','Slipped runners']},
  joint:{band:.59,names:['Dislocated joint','Echo joint','Wrong-way joint','Trailing edge']},
  case:{band:.46,names:['Split housing','Double exposure','Quarter-turn housing','Feed jam']},
  sheet:{band:.51,names:['Torn margin','Repeated strip','Folded field','Bleeding margin']},
  other:{band:.55,names:['Registration slip','Repeated section','Wrong-way section','Carbon leak']},
};
function profile(stock) {
  const {id,bounds:b}=stock;
  return profiles[desks.has(id)?'desk':cabinets.has(id)||id.startsWith('file-')?'drawers':heads.has(id)?'joint':electronics.has(id)?'case':
    (b.y1-b.y0)<.32*Math.max(b.x1-b.x0,b.z1-b.z0)||['painting','clock','whiteboard','taskboard','keycard','pink-slip','doormat','dartboard','neon'].includes(id)?'sheet':'other'];
}
export function editionNames(stock) {
  const names=[...profile(stock).names];
  const extra={scissors:'Third blade',torch:'Forked reflector','torch-prepared':'Forked reflector',flamingo:'Second beak',camera:'Split lens','carbon-camera':'Double bellows',extinguisher:'Twin valve'};
  if(extra[stock.id])names[1]=extra[stock.id];
  return names;
}

export function developEdition(stock, edition, slipping=false) {
  const {vox,bounds:b}=stock, p=profile(stock);
  const w=b.x1-b.x0,h=b.y1-b.y0,d=b.z1-b.z0, cx=(b.x1+b.x0-1)/2,cz=(b.z1+b.z0-1)/2;
  const flat=h<.30*Math.max(w,d), axis=flat?(d>=w?'z':'x'):'y';
  const span=axis==='y'?h:axis==='x'?w:d, low=axis==='y'?b.y0:axis==='x'?b.x0:b.z0;
  const file=stock.id.startsWith('file-');
  const cut=file?35:Math.min(span-1,Math.floor(span*p.band));
  const band=file?31:Math.max(1,Math.round(span*(p===profiles.drawers ? .23 : .13)));
  const jump=Math.max(2,Math.round(w*.16)), rise=file?31:Math.max(2,Math.round(span*.17));
  const result=new Vox(), isDrawer=p===profiles.drawers;
  vox.each((x,y,z,ink)=>{
    const a=(axis==='x'?x:axis==='z'?z:y)-low, u=(x-b.x0+.5)/w, v=(z-b.z0+.5)/d;
    const shifted=(distance,paint,dx=0,dz=0)=>result.set(x+dx+(axis==='x'?distance:0), y+(axis==='y'?distance:0), z+dz+(axis==='z'?distance:0),paint);
    if(stock.id==='chair'&&edition===0){
      result.set(x+rowOffset(y,slipping),y,z,printInk(x,y,ink));return;
    }
    if(edition===1&&['scissors','torch','torch-prepared','flamingo','carbon-camera','camera','extinguisher'].includes(stock.id)){
      // Repeat the working end: blades branch at the rivet, lenses at the nose, heads at the neck.
      result.set(x,y,z,ink);
      const high=['flamingo','extinguisher'].includes(stock.id);
      const part=high?(y-b.y0)/h:(b.z1-z)/d;
      if(part>.58){
        const offset=Math.round((part-.58)*w*(stock.id==='scissors'?1.58:.90));
        result.set(x+offset,y+Math.round(offset*.24),z,mix(ink,'#bf98ac',.18));
      }
      return;
    }
    if(edition===3&&file){
      const drawer=Math.max(0,Math.min(Math.floor((h-7)/31)-1,Math.floor((y-4)/31)));
      const extension=z>cz&&a>=4&&a<h-3?Math.round((z-cz)/(b.z1-cz)*d*(drawer%2?.37:.12)):0;
      result.set(x,y,z+extension,ink);return;
    }
    if(edition===0) {
      // Half a backrest or drawer skips one sprocket; a magenta edge exposes the torn pass.
      const jog=a<cut?0:a<cut+band?jump:-Math.ceil(jump*.35);
      result.set(x+(axis==='x'?0:jog),y,z+(axis==='x'?jog:0),a===cut?mix(ink,'#de779f',.69):a===cut+band?mix(ink,'#8edfc9',.70):ink);
    } else if(edition===1) {
      const repeat=a>=cut&&a<cut+rise;
      shifted(a>=cut+rise?rise:0,ink);
      if(repeat)shifted(rise,mix(ink,'#a48fa7',.23),axis==='x'?0:Math.round(jump*.32),axis==='x'?Math.round(jump*.32):0);
    } else if(edition===2) {
      const rotate=isDrawer?(a>=cut&&a<cut+band*1.2):a>=cut;
      // A drawer closes facing the wall; a thin sheet folds upward, leaving a displaced crease.
      if(!rotate)result.set(x,y,z,ink);
      else if(flat) {
        const lift=Math.round((a-cut)*.68);
        shifted(-Math.round((a-cut)*.32),mix(ink,'#a4c5b6',.2));
        result.set(x-(axis==='x'?a-cut:0),y+lift,z-(axis==='z'?a-cut:0),ink);
      } else {
        const dx=x-cx,dz=z-cz, turn=isDrawer?Math.PI*.88:Math.PI*.38;
        result.set(Math.round(cx+dx*Math.cos(turn)+dz*Math.sin(turn)+jump*.28),y,Math.round(cz-dx*Math.sin(turn)+dz*Math.cos(turn)),ink);
      }
    } else {
      const edge=Math.max(0,(u+.28*v-.61)/.68);
      const wave=Math.round(edge*edge*(flat?Math.max(w,d)*.24:h*.31));
      if(flat) result.set(x,y+wave,z+Math.round(edge*jump*.46),ink);
      else {
        const drop=Math.min(y-b.y0,Math.round(wave*(.24+.76*a/span)));
        const creep=isDrawer?Math.round(Math.floor((a/span)*4)*d*.055):Math.round(edge*jump*.7);
        result.set(x,y-drop,z+creep,(drop>1&&((x+z)%7===0))?mix(ink,'#b486a0',.36):ink);
      }
    }
  });
  return {...stock,vox:result,bounds:result.bounds()};
}
