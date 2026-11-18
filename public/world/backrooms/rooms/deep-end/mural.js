// Glazed ceramic tesserae from a municipal swimming diagram. The grid goes
// around real exits, preserving the spacing of the tile pattern on both sides.
import { WHITE } from '../../kit.js';

function inside(x,y,points) {
  let filled=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay]=points[j],[bx,by]=points[i];
    if ((ay>y)!==(by>y) && x < ax+(y-ay)*(bx-ax)/(by-ay)) filled=!filled;
  }
  return filled;
}

export function swimMural(c) {
  const cells=96, rows=18, tile=8;
  const swimmer=[[13,12],[18,7],[23,8],[28,5],[32,4],[35,5],[41,4],[46,3],[44,5],
    [36,7],[30,7],[25,10],[20,10],[16,14],[12,15]];
  const tie=[[27,6],[25,4],[22,4],[18,2],[23,3],[27,3],[29,5]];
  const art=c.kit.tex.custom('well:diver-mosaic',cells*tile,rows*tile,(g,w,h)=>{
    g.fillStyle='#747f70';g.fillRect(0,0,w,h);
    for(let y=0;y<rows;y++)for(let x=0;x<cells;x++){
      const wave=11.9+1.35*Math.sin(x*.13)+.55*Math.sin(x*.36);
      let color=[173,185,158];
      if(y>wave) color=[100,145,135];
      if(y>wave+1.65) color=[77,119,117];
      if(y>wave+3.2) color=[65,91,100];
      if(y>0 && y<4 && (x+2*y)%45<6) color=[196,194,158];
      const px=x+.5,py=y+.5;
      if(inside(px,py,swimmer)) color=[47,76,83];
      if((px-34.2)**2+(py-3.7)**2<1.95**2)color=py<3.45 ? [177,97,68]:[62,80,77];
      if(inside(px,py,tie))color=[179,103,69];
      // Angular backs and wakes recede in the neighbouring lanes.
      for(const offset of [53,74]){
        if (px>=offset && px<offset+13 && Math.abs(py-(10.7-Math.max(0,4-Math.abs(px-offset-5))*.85))<1.02)color=[51,93,97];
        if ((px-offset-12.6)**2+(py-9.45)**2<2.0)color=[178,105,72];
      }
      const grain=((x*73+y*31+x*y*13)%17)-8;
      const tint=n=>Math.max(0,Math.min(255,n+grain));
      g.fillStyle='rgb('+color.map(tint).join(',')+')';
      g.fillRect(x*tile,y*tile,tile-1,tile-1);
      g.fillStyle='rgba(224,226,194,.18)';g.fillRect(x*tile,y*tile,tile-1,1);
    }
  },{clamp:true});
  const batch=c.mapped('well:diver-mosaic',art);
  const left=-c.W/2+.28, right=c.W/2-.28;
  const bottom=.83, top=bottom+(right-left)*rows/cells;
  const z=-c.D/2+.024;
  function panel(a,b){
    if(b<=a) return;
    const u0=(a-left)/(right-left),u1=(b-left)/(right-left);
    batch.quad([a,bottom,z],[b,bottom,z],[b,top,z],[a,top,z],WHITE,[[u0,0],[u1,0],[u1,1],[u0,1]]);
  }
  let start=left;
  const doors=c.room.doors.filter(d=>d.side==='back').sort((a,b)=>a.c-b.c);
  for(const door of doors) {
    panel(start,Math.min(right,door.c-door.w/2-.09));
    start=Math.max(start,door.c+door.w/2+.09);
  }
  panel(start,right);
}
