import {schema,instructions} from './recipe-contract.js';
import { Vox } from '../../vox/vox.js';
import { chair, cabinet, crt, desk, desklamp, plant, sofa, bookshelf } from '../../props/office.js';

import {readKit,kitVox} from './kit.js';
export {readKit as validateRecipe};
const colors = { red:'#c94d38', pink:'#e890a6', green:'#70965a', blue:'#477fa6', purple:'#a073a7', orange:'#e78b3c', black:'#363941', white:'#e8e0ce', yellow:'#e7b84d', teal:'#458f88', silver:'#97a6aa' };

function telephone() {
  const v=new Vox();
  v.rbox(-11,0,-8,11,4,8,2,'#463e36');
  v.rbox(-10,3,-8,10,7,6,2,'#cebd94');
  v.box(-5,7,-2,5,8,6,'#897d64');
  for (let x=-3;x<=3;x+=3) for(let z=0;z<=4;z+=2) v.box(x,8,z,x+2,9,z+1,'#ede6c7');
  v.rbox(-11,7,-8,11,11,-4,2,'#5b4c3f');
  for(const x of [-11,6]) v.rbox(x,6,-8,x+5,12,-2,2,'#493c32');
  for(let i=0;i<14;i++) v.sphere(-11-Math.sin(i*.7)*2,2+Math.max(0,7-i),-5+i*.5,1,'#3e3732');
  return v;
}
function duck() {
  const v=new Vox();
  v.ellipsoid(0,8,0,10,7,15,'#e4ac27').ellipsoid(0,17,7,7,7,7,'#f3c548');
  v.ellipsoid(0,15,14,5,2.5,4,'#da7737').ellipsoid(0,10,-12,5,5,5,'#eabb37');
  for(const x of [-1,1]) {
    v.ellipsoid(x*8,9,-2,2.6,4.5,9,'#ce901e');
    v.sphere(x*5,19,11,1.45,'#222a29');
  }
  return v;
}
function teapot() {
  const v=new Vox();
  v.ellipsoid(0,9,0,9,9,9,'#6b9d92').cyl('y',0,0,16,18,6,'#d5cba2').sphere(0,20,0,2.4,'#40746b');
  v.tube(6,7,0,15,16,0,2.8,'#6b9d92').tube(-6,15,0,-13,15,0,1.6,'#accbb4');
  v.tube(-13,15,0,-14,7,0,1.6,'#accbb4').tube(-14,7,0,-7,6,0,1.7,'#accbb4'); return v;
}
function mushroom() {
  const v=new Vox();
  v.cyl('y',0,0,0,14,3.4,'#e7d2a1',2.7).ellipsoid(0,15,0,11,6,11,'#b94336');
  v.carve(-13,6,-13,13,11,13); v.cyl('y',0,0,6,12,3,'#e7d2a1');
  for(const [x,y,z] of [[0,20,1],[5,18,3],[-5,18,5],[2,17,-8],[-8,17,-2]]) v.ellipsoid(x,y,z,1.8,1,1.6,'#efdfaf');
  return v;
}
function anvil(){
  const v=new Vox(); v.rbox(-8,0,-5,8,3,5,1,'#555964').box(-5,3,-3,5,9,3,'#646870');
  v.rbox(-10,8,-5,8,14,5,1,'#758087').cyl('x',11,0,8,17,3.6,'#758087',0.7); return v;
}
function cactus() {
  const v=new Vox(); v.cyl('y',0,0,0,9,5.2,'#bf7650',7).cyl('y',0,0,8,10,7.6,'#d59562');
  v.cyl('y',0,0,10,28,3.8,'#52815d').sphere(0,28,0,3.8,'#52815d');
  v.tube(-1,15,0,-8,16,0,2,'#70945e').tube(-8,15,0,-8,23,0,2,'#70945e');
  v.tube(1,20,0,7,20,0,2,'#66905e').tube(7,20,0,7,26,0,2,'#66905e'); return v;
}
const library = [
  ['cabinet', /\b(cabinet|safe|filing unit)\b/,cabinet,['heavy']],
  ['chair', /\b(chair|stool|seat)\b/,chair,['rolling']],
  ['phone', /\b(phone|telephone|ringer)\b/,telephone,['ringing']],
  ['duck', /\b(duck|duckling|rubber ducky|ducky)\b/,duck,[]],
  ['teapot',/\b(teapot|kettle)\b/,teapot,[]], ['mushroom',/\b(mushroom|toadstool)\b/,mushroom,[]],
  ['anvil',/\b(anvil)\b/,anvil,['heavy']], ['cactus',/\b(cactus|succulent)\b/,cactus,[]],
  ['lamp',/\b(lamp|light)\b/,desklamp,[]], ['desk',/\b(desk|table)\b/,desk,[]],
  ['monitor',/\b(monitor|computer|crt|television)\b/,crt,[]], ['plant',/\b(plant|fern)\b/,plant,[]],
  ['sofa',/\b(sofa|couch)\b/,sofa,['heavy']], ['bookcase',/\b(bookcase|bookshelf)\b/,bookshelf,['heavy']]
];
export const nouns=library.map(e=>e[0]);
const adjective = { heavy:/\b(heavy|weighted|weighty|lead|iron)\b/, ringing:/\b(ringing|noisy|musical|alarm|sings)\b/, rolling:/\b(rolling|wheeled|wheels|mobile)\b/ };
function bareName(s){return s.replace(/^(?:a|an|the)\s+/,'').trim();}
export function catalogue(text) {
  const phrase=bareName(text.trim().toLowerCase()).slice(0,96);
  const [main, attachment, ...extra]=phrase.split(/\s+(?:with|carrying)\s+/);
  if(extra.length) return null;
  const choose = s => library.find(([,pattern])=>pattern.test(s));
  const base=choose(main);
  if(!base) return null;
  const part=attachment && choose(attachment);
  if(attachment && !part && !/^(?:wheels|casters)$/.test(attachment)) return null;
  // A familiar adjective cannot turn an unknown noun into a different catalogue prop.
  const known = s => {
    let rest = s.replace(/\b(a|an|the|office|swivel|filing|file|desk(?=\s+(?:phone|lamp))|rubber|potted|three.drawer|banker.s|steel|tiny|giant|large|small|little|big|on|caster[s]?)\b/g,' ');
    for (const [,rx] of library) rest=rest.replace(new RegExp(rx.source,'g'),' ');
    for (const rx of Object.values(adjective)) rest=rest.replace(new RegExp(rx.source,'g'),' ');
    return rest.replace(new RegExp('\\b('+Object.keys(colors).join('|')+')\\b','g'),' ').trim()==='';
  };
  if(!known(main) || (attachment && !known(attachment))) return null;
  const traits=new Set([...base[3],...(part?.[3]||[])]);
  for(const [trait,rx] of Object.entries(adjective)) if(rx.test(phrase)) traits.add(trait);
  const color=Object.keys(colors).find(c=>phrase.split(/\W+/).includes(c));
  return {name:phrase, base:base[0], part:part?.[0], tint:colors[color], traits:[...traits],
    size:/\b(tiny|small|little)\b/.test(phrase)?.7:/\b(giant|large|big)\b/.test(phrase)?1.25:1};
}
export function makeVox(plan){
  if(plan.body) return kitVox(plan);
  const create=name=>library.find(e=>e[0]===name)[2]();
  const v=create(plan.base);
  if(plan.part){
    const a=create(plan.part), b=a.bounds(), top=v.bounds().y1;
    const factor=Math.min(.75,18/Math.max(b.x1-b.x0,b.y1-b.y0,b.z1-b.z0));
    a.each((x,y,z,c)=>v.set(Math.floor(x*factor),top+Math.floor((y-b.y0)*factor),Math.floor(z*factor),c));
  }
  if(plan.tint){
    const rgb=parseInt(plan.tint.slice(1),16);
    v.each((x,y,z,c)=>{
      const l=(((c>>16)&255)*.3+((c>>8)&255)*.59+(c&255)*.11)/255;
      if(l<.22) return;
      const t=.48+l*.57, ch=n=>Math.min(255,Math.round(((rgb>>n)&255)*t));
      v.set(x,y,z,(c&0xff000000)|(ch(16)<<16)|(ch(8)<<8)|ch(0));
    });
  }
  return v;
}
export const modelOptions={expectedInputs:[{type:'text',languages:['en']}],expectedOutputs:[{type:'text',languages:['en']}]};
export async function sketch(text, signal){
  const session=await LanguageModel.create({...modelOptions,signal,initialPrompts:[{role:'system',content:instructions}]});
  try{return readKit(JSON.parse(await session.prompt(text,{responseConstraint:schema,signal})),text);}finally{session.destroy();}
}
