// The Flume Knot's material and architectural pass. Geometry stays on the
// room's measured routes; wear belongs to joints, waterlines and walking paths.
import { Batch, lin, ticks, WHITE } from '../../kit.js';
import { towelCart } from '../return-pool/dressing.js';

export const FLUME_PALETTE = Object.freeze({yellow:'#b79b54',blue:'#4d807d',red:'#914f40',green:'#647b64',cream:'#b6b29a'});
const random = seed => () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

export function flumeTextures(kit) {
  const paint=kit.tex.custom('flume:paint',128,128,g=>{
    const r=random(412);g.fillStyle='#b7b5a0';g.fillRect(0,0,128,128);
    for(let i=0;i<2300;i++){g.fillStyle=i%3?'#a9ad9825':'#e2d8bd35';g.fillRect(r()*128,r()*128,1+r()*3,1);}
    for(let i=0;i<14;i++){const x=r()*128;g.fillStyle='#69786318';g.fillRect(x,0,1+r()*4,24+r()*85);}
  });
  const tile=(id,colors)=>kit.tex.custom('flume:'+id,128,128,g=>{
    const r=random(id.length*137);g.fillStyle=colors[3];g.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=16)for(let x=0;x<128;x+=16){
      g.fillStyle=colors[Math.floor(r()*3)];g.fillRect(x+1,y+1,14,14);
      g.fillStyle='#eee4c52b';g.fillRect(x+2,y+2,12,1);
      if(r()<.18){g.fillStyle=colors[3];g.fillRect(x+1,y+1,2+r()*4,2);}
      if(r()<.13){g.strokeStyle='#6c746167';g.lineWidth=1;g.beginPath();g.moveTo(x+3,y+1);g.lineTo(x+7,y+7);g.lineTo(x+6,y+14);g.stroke();}
    }
    for(let i=0;i<310;i++){g.fillStyle='#716b5226';g.fillRect(r()*128,r()*128,1+r()*4,1);}
  });
  const deck=tile('deck',['#b8b6a1','#a5ad99','#cac4aa','#747e6b']);
  const bed=tile('bed',['#526e65','#60786c','#708274','#424f43']);
  const fiberglass=kit.tex.custom('flume:fiberglass',128,128,g=>{
    const r=random(81);g.fillStyle='#c9c7b9';g.fillRect(0,0,128,128);
    for(let i=0;i<1700;i++){g.fillStyle=i%2?'#f2e8c722':'#69735e19';g.fillRect(r()*128,r()*128,1+r()*3,1);}
    for(let i=0;i<26;i++){g.fillStyle='#6f77602b';g.fillRect(r()*128,r()*128,1,9+r()*27);}
    g.fillStyle='#525e472b';g.fillRect(0,0,128,3);g.fillRect(0,125,128,3);
  });
  const water=kit.tex.custom('flume:still-water',128,128,g=>{
    const r=random(911);g.fillStyle='#355c50';g.fillRect(0,0,128,128);
    for(let i=0;i<65;i++){g.fillStyle=i%4?'#6e8d7628':'#b8c7a34a';g.fillRect(r()*128,r()*128,4+r()*18,1);}
  });
  return {paint,deck,bed,fiberglass,water};
}

export function flumeHall(c,tex,{bx0,bx1,bz0,bz1}) {
  const steel=lin('#707b6b'),dark=lin('#39483f'),rust=lin('#796044');
  // The wall has a real construction: ceramic dado, cracked paint, a pipe run.
  const tiles=c.mapped('flume:dado',tex.deck);
  for(const side of ['front','back','left','right']){
    for(const [a,b] of c.spans(side,.05)){
      if(b-a<.15)continue;
      const p=c.wallAt(side,side==='front'||side==='left'?b:a,.018);
      tiles.grid([p.x,.04,p.z],p.U,[0,1,0],ticks(b-a,.4,0),ticks(1.12,.35,0),(u,v)=>[u/.8,v/.8]);
      c.wbox(side,(a+b)/2,b-a,1.15,1.19,.016,.042,steel);
    }
    const len=side==='left'||side==='right'?c.D:c.W;
    c.wbox(side,0,len-.15,c.H-.67,c.H-.58,.03,.11,steel);
    for(let at=-len/2+.9;at<len/2;at+=2.1)c.wbox(side,at,.08,c.H-.73,c.H-.53,.02,.14,rust);
  }
  // Drain channels and missing/silty grates follow the coping, not random decals.
  const z=bz1+.34;
  c.flat.box(bx0,-.005,z-.09,bx1,.014,z+.09,dark);
  for(let x=bx0+.04;x<bx1;x+=.13)c.flat.box(x,.018,z-.085,x+.065,.028,z+.085,steel);
  for(const x of [bx0+.02,bx1-.02]){
    c.flat.box(x-.025,-1.25,bz0,x+.025,-1.16,bz1,lin('#68735a'));
    for(let i=0;i<14;i++){
      const zz=bz0+(bz1-bz0)*(i+.5)/14;
      c.flat.box(x-.026,-1.16,zz-.025,x+.026,-.88+(i%3)*.08,zz+.03,lin('#64705a'));
    }
  }
  // Worn stair-edge inserts make the actual boarding route readable.
  for(let i=0;i<4;i++){
    const y=((4-i)/5)*.84+.012;
    c.flat.box(-3.59,y,bz1+i*.32+.02,-2.41,y+.015,bz1+i*.32+.075,dark);
    c.flat.box(2.41,y,bz0-(i+1)*.32+.23,3.59,y+.015,bz0-(i+1)*.32+.29,dark);
  }
  // Real catalogue furniture forms an abandoned attendant station.
  const bx=-c.W/2+1.3,bz=c.D/2-1.4;
  if(c.clear(bx,bz,1.0)&&c.hasProp('desk')){
    c.prop('desk',bx,bz,{rot:Math.PI/2,shadow:false});
    if(c.hasProp('crt'))c.prop('crt',bx,bz,{y:.76,rot:Math.PI/2,solid:false,shadow:false});
    c.flat.box(bx-.12,.77,bz+.55,bx+.13,.78,bz+.82,lin('#cabf9e'));
  }
  // One grubby laundry cart, subject to the same grab rules as every trolley.
  const tx=c.W/2-1.15,tz=c.D/2-1.25;
  if(c.clear(tx,tz,.85)){
    const b=new Batch(true),foot=c.model('return-pool:towel-cart:0',()=>towelCart(0),tx,tz,{batch:b,solid:false,shadow:false,rot:Math.PI/2});
    const group=c.dynamic(b,{pivot:[tx,0,tz]});c.movable(group,{foot,type:'trolley',label:'Towel cart'});
  }
  // A previous waterline survives well ABOVE the current pool. Quiet wrongness.
  const stain=c.kit.tex.custom('flume:highwater',256,64,g=>{
    const r=random(27);g.clearRect(0,0,256,64);
    for(let x=0;x<256;x+=2){const y=17+Math.floor(r()*6);g.fillStyle='#8a9276';g.fillRect(x,y,2,5+r()*18);g.fillStyle='#ada58a';g.fillRect(x,y,2,2);}
  });
  const stainBatch=c.mapped('flume:highwater',stain,{cutout:true});
  for(const side of ['left','right'])for(const [a,b] of c.spans(side,.08))c.hang(stainBatch,side,(a+b)/2,2.65,b-a,.5,[[0,0],[(b-a)/2,0],[(b-a)/2,1],[0,1]],WHITE,.022);
}

export function flumeLights(c) {
  // Most lamps are ordinary dead fittings. Two lit rows frame the walk in;
  // a warmer lamp on the far gallery gives the maze a destination.
  const on=c.shining('flume:fluorescent',c.kit.tex.panel(true),1.65,lin('#ddd7b4'));
  const dead=c.mapped('flume:dead-panel',c.kit.tex.panel(false));
  const uv=[[0,0],[1,0],[1,1],[0,1]];
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const x=(col-1)*4.5,z=c.D/2-2.1-row*(c.D-3.8)/3,y=c.H-.018;
    const lit=(row===0&&col!==1)||(row===3&&col===1)||(row===1&&col===0);
    const batch=lit?on:dead;
    batch.quad([x-.29,y,z-.61],[x+.29,y,z-.61],[x+.29,y,z+.61],[x-.29,y,z+.61],WHITE,uv);
    if(lit)c.light(x,y-.1,z,'#ddd7b4',2.1,{axis:[0,-1,0],floor:.08,k:5,far:16});
  }
  c.light(3.2,2.45,-c.D/2+.95,'#dbc49b',.65,{k:2.6,far:7});
}
