// Static copies of the homepage's own artwork, without shipping its animation loop.
// Regenerate after changing art.js: node tools/blockrooms/export-lobby-art.mjs
import {mkdir,writeFile} from 'node:fs/promises';
import {drawLogo,paint,sizeOf} from './art.js';
const out=new URL('../../public/world/coop/art/',import.meta.url);
await mkdir(out,{recursive:true});
globalThis.matchMedia=()=>({matches:true});
function canvas(){
 const shapes=[];let points=[];
 const g={fillStyle:'#000',globalAlpha:1,
  clearRect(){shapes.length=0;},beginPath(){points=[];},
  moveTo(x,y){points.push(`${x},${y}`);},lineTo(x,y){points.push(`${x},${y}`);},
  fill(){shapes.push(`<polygon points="${points.join(' ')}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`);},
  fillRect(x,y,w,h){shapes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.fillStyle}" opacity="${this.globalAlpha}"/>`);}
 };
 return {width:0,height:0,getContext:()=>g,svg(){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" shape-rendering="crispEdges">${shapes.join('')}</svg>\n`;}};
}
const logo=canvas();drawLogo(logo);await writeFile(new URL('logo.svg',out),logo.svg());
for(const name of ['camcorder','battery','moth']){
 const c=canvas(),{w,h}=sizeOf(name);c.width=w;c.height=h;paint(c.getContext('2d'),name);
 await writeFile(new URL(`${name}.svg`,out),c.svg());
}
