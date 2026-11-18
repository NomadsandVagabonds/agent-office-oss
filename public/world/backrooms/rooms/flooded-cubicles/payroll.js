// A service window cut into the last cubicle. Three real ranks of desks
// diminish toward a painted continuation at the back of the shallow recess.
import { Batch, lin, WHITE } from '../../kit.js';
import { addTranslucent } from '../../waterpark.js';

const frame=lin('#55695e'), lip=lin('#b6b2a0'), walnut=lin('#795e47');
const ink=lin('#33463e'), paper=lin('#cfcab3'), fabric=lin('#7a8880');

function farOffice(kit) {
  return kit.tex.custom('payroll:vanishing-office',384,168,(g,w,h)=>{
    const vanishing=[w*.52,h*.55];
    const at=(x,y,k)=>[vanishing[0]+(x-vanishing[0])*k,vanishing[1]+(y-vanishing[1])*k];
    function polygon(points,color) {
      g.fillStyle=color; g.beginPath(); g.moveTo(...points[0]);
      for(const p of points.slice(1)) g.lineTo(...p);
      g.closePath(); g.fill();
    }
    function strip(x,y,right,bottom,scale,color) {
      const [px,py]=at(x,y,scale);
      g.fillStyle=color; g.fillRect(px,py,(right-x)*scale,(bottom-y)*scale);
    }
    // The nearest ceiling and floor extend beyond the window frame. Receding
    // doorways and tile joints put an actual scale on the apparent distance.
    const nearLeft=-32, nearRight=w+32, ceiling=-14, floor=h+18;
    g.fillStyle='#485c54';g.fillRect(0,0,w,h);
    for(let row=15;row>=0;row--){
      const k=.82**row, far=k*.82;
      const surface=(a,b,color)=>polygon([at(...a,k),at(...b,k),at(...b,far),at(...a,far)],color);
      surface([nearLeft,ceiling],[nearRight,ceiling],row%3?'#8e8d77':'#858774');
      surface([nearLeft,floor],[nearRight,floor],row%2?'#697768':'#627264');
      for (const wall of [nearLeft,nearRight]) {
        surface([wall,ceiling],[wall,floor],row%2?'#7b8677':'#869081');
        surface([wall,62],[wall,65],'#435f56');
        const nearDoor=k*.98, farDoor=k*.90;
        const jamb=(a,b,color)=>polygon([at(wall,a,nearDoor),at(wall,b,nearDoor),
          at(wall,b,farDoor),at(wall,a,farDoor)],color);
        jamb(24,151,'#6a6854');jamb(32,66,'#3f584e');
        strip(wall-1,ceiling,wall+2,floor,k,'#616b5b');
      }
      for (const x of [5,84,165,246,327,405]) surface([x,ceiling],[x+2,ceiling],'#5c675a');
      strip(nearLeft,ceiling,nearRight,ceiling+2,k,'#616957');
      for (const [left,right] of [[62,86],[283,307]]) {
        const fixture=(a,b,color)=>polygon([at(a,ceiling,k*.98),at(b,ceiling,k*.98),
          at(b,ceiling,k*.90),at(a,ceiling,k*.90)],color);
        fixture(left-2,right+2,'#596456');fixture(left,left+9,'#f5e7b6');fixture(right-9,right,'#efe1b2');
      }
      // CRTs, pedestals and a return at the aisle edge of each desk bank.
      for (const [x,side] of [[-6,1],[w+6,-1]]) {
        const inner=x+side*129, outer=x-side*34;
        surface([inner,108],[inner,158],'#435d50');
        strip(Math.min(inner,outer),104,Math.max(inner,outer),155,k,'#72897a');
        strip(Math.min(inner,outer),103,Math.max(inner,outer),106,k,'#b2b39a');
        strip(inner-2,106,inner+2,156,k,'#465f55');
        const monitor=x+side*93;
        strip(monitor-18,83,monitor+15,101,k,'#cbbea2');
        strip(monitor-14,86,monitor+11,98,k,'#294c40');
        strip(monitor-10,88,monitor+3,90,k,'#7e9c7d');
        strip(monitor-5,101,monitor+6,104,k,'#a8a48a');
      }
    }
  },{clamp:true});
}

export function payrollWindow(c, material) {
  const left=-c.W/2+.43, right=-1.58, back=-c.D/2+.025, front=back+.98;
  const cx=(left+right)*.5, width=right-left;
  const body=c.flat, sill=.84, head=2.13;
  const dado=c.mapped('payroll:tile',material.deep,{wet:.68});
  dado.box(left,-.01,front-.10,right,sill,front,WHITE,{uv:.75});
  for(const x of [left,right-.10]) dado.box(x,0,back,x+.10,head+.29,front,WHITE,{uv:.75});
  body.box(left,sill-.035,back,right,sill,front+.10,walnut);
  body.box(left,sill,back,right,sill+.047,front+.10,lip);
  body.box(left,head,back,right,head+.29,front,frame);
  const scene=c.shining('payroll:far-office',farOffice(c.kit),.86);
  c.board(scene,cx,(head+sill)/2,back+.018,width-.18,head-sill);
  const lamp=c.shining('payroll:lit-strip',c.kit.tex.white(),1.18,lin('#ffe3a0'));
  for(let i=0;i<3;i++) {
    const scale=1-i*.26, z=front-.21-i*.27;
    // The near row and the progressively smaller rows converge on seat 04.
    const floor=sill+.07+(1-scale)*.56;
    for(const side of [-1,1]) {
      const end=cx+side*width*.16*scale, start=cx+side*width*.48*scale;
      const x0=Math.min(start,end),x1=Math.max(start,end), x=end+side*.36*scale;
      body.box(x0,floor,z-.15*scale,x1,floor+.22*scale,z-.11*scale,fabric);
      body.box(x0,floor+.20*scale,z-.13*scale,x1,floor+.24*scale,z+.09*scale,walnut);
      body.box(x-.11*scale,floor+.24*scale,z-.08*scale,x+.11*scale,floor+.42*scale,z+.04*scale,paper);
      body.box(x-.086*scale,floor+.273*scale,z+.04*scale,x+.086*scale,floor+.393*scale,z+.045*scale,ink);
    }
    const ceiling = head-.05-(1-scale)*.49;
    body.box(cx-.59*scale,ceiling-.02,z-.06*scale,cx+.59*scale,ceiling+.04,z+.06*scale,frame);
    c.lay(lamp,cx,z,1.10*scale,.115*scale,0,null,WHITE,ceiling-.023,true);
  }
  const panes=new Batch(), glass=lin('#b8d1b6');
  for(const x of [left+.06,cx,right-.06]) body.box(x-.025,sill,front-.055,x+.025,head,front+.006,frame);
  for (const y of [head-.22,head]) body.box(left,y-.022,front-.07,right,y+.018,front+.016,lip);
  for (const [a,b] of [[left+.09,cx-.027],[cx+.027,right-.09]]) {
    panes.quad([a,sill+.15,front-.021],[b,sill+.15,front-.021],[b,head,front-.021],[a,head,front-.021],glass);
  }
  addTranslucent(c,panes,{alpha:.12,order:2});
  const sign=c.kit.tex.custom('payroll:header',512,48,(g)=>{
    g.fillStyle='#e3d7b7';g.fillRect(0,0,512,48);
    g.fillStyle='#37524a';g.fillRect(4,4,504,40);
    g.font='bold 26px monospace';g.fillStyle='#eee4c4';g.fillText('PAYROLL',19,33);
    g.font='17px monospace';g.textAlign='right';g.fillText('WINDOW 04',490,31);
  },{clamp:true});
  c.board(c.shining('payroll:sign',sign,.86),cx,head+.137,front+.01,width-.14,.235);
  // A pass-through tray and a pile of pay envelopes on the public side.
  body.box(cx+.12,sill+.047,front-.06,cx+.65,sill+.061,front+.095,ink);
  for(let i=0;i<4;i++)body.box(cx+.19-i*.008,sill+.061+i*.011,front-.038+i*.007,
    cx+.54-i*.008,sill+.072+i*.011,front+.072+i*.007,paper);
  c.solid(left,back,right,front+.10,{keep:true,tall:true});
  c.light(cx,1.74,front-.20,'#ffe4aa',.76,{far:3.6,k:2.2});
}

export function partitionFace(c) {
  // The cloth wicks water to an uneven tide line. Repeatable woven pixels
  // and mineral streaks make it recognizable even with the desk moved.
  const tex=c.kit.tex.custom('flooded-office:wet-fabric',192,128,(g,w,h)=>{
    g.fillStyle='#72847f';g.fillRect(0,0,w,h);
    for(let x=0;x<w;x+=2) {
      const tide=94+3*Math.sin(x*.07)+2*Math.cos(x*.22);
      g.fillStyle=x%4?'#475f58':'#526961';g.fillRect(x,tide,2,h-tide);
      g.fillStyle='#9b9c79';g.fillRect(x,tide-1,2,1);
    }
    g.fillStyle='#c3bca52f';for(let x=0;x<w;x+=4)g.fillRect(x,0,1,h);
    g.fillStyle='#273e3942';for(let y=1;y<h;y+=3)g.fillRect(0,y,w,1);
  });
  return c.mapped('flooded-office:fabric',tex,{wet:.22});
}

// Dry punch cards end exactly at an old flood line. The bottom row dried
// brown in its slots, including the card still caught inside the time clock.
export function timeClockRack(c) {
  const x=c.W*.255, z=-c.D/2+.045, width=2.56;
  if(c.room.doors.some(d=>d.side==='back' && Math.abs(d.c-x)<(width+d.w)/2+.12)) return;
  const b=c.flat;
  const cards=c.kit.tex.custom('payroll:punch-card',64,56,g=>{
    g.fillStyle='#d9cca9';g.fillRect(0,0,64,56);
    g.fillStyle='#905946';g.fillRect(4,9,56,2);
    g.fillStyle='#617169';
    for(let y=16;y<55;y+=6)g.fillRect(5,y,52,1);
    for(let j=0;j<7;j++)g.fillRect(7+(j*7)%45,15+j*6,5+(j*11)%12,2);
  },{clamp:true});
  const card=c.mapped('payroll:punch-card',cards);
  b.box(x-width/2,.73,z,x+width/2,2.05,z+.052,frame);
  b.box(x-width/2+.035,.775,z+.052,x+width/2-.035,2.01,z+.061,lin('#515e52'));
  const clockX=x+.79;
  for(let col=0;col<5;col++)for(let row=0;row<6;row++){
    const cx=x-1.10+col*.30, cy=.85+row*.196;
    const stained = row<2;
    b.box(cx-.142,cy-.03,z+.067,cx+.142,cy+.035,z+.128,stained?lin('#877853'):lip);
    if((col*3+row*2)%11===1) continue;
    c.board(card,cx+.006*Math.sin(col+row),cy+.092,z+.108,.239,.136,0,null,
      stained ? lin('#bc9e78') : WHITE);
  }
  b.box(clockX-.30,1.08,z+.06,clockX+.3,1.75,z+.23,lin('#84958b'));
  b.box(clockX-.25,1.11,z+.23,clockX+.25,1.24,z+.37,frame);
  c.board(card,clockX+.03,1.25,z+.27,.14,.18);
  const face=c.kit.tex.custom('payroll:punch-face',128,96,g=>{
    g.fillStyle='#ded8c1';g.fillRect(0,0,128,96);
    g.fillStyle='#38473f';g.font='bold 26px monospace';g.textAlign='center';g.fillText('17:00',64,42);
    g.fillRect(11,51,106,2);g.font='13px monospace';g.fillText('TIME RECORDER',64,72);
  },{clamp:true});
  c.board(c.mapped('payroll:punch-face',face),clockX,1.49,z+.232,.43,.31);
  const strip=c.shining('payroll:task-bulb',c.kit.tex.white(),1.18,lin('#f8e3ac'));
  b.box(x-width/2-.025,2.04,z-.005,x+width/2+.025,2.12,z+.31,frame);
  c.lay(strip,x,z+.23,width-.08,.10,0,null,WHITE,2.034,true);
  c.light(x,1.87,z+.45,'#ffdfa3',.69,{far:3.7,k:1.75});
}
