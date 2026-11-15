// A party left set up for far too long. Static, batched scenery at the edges;
// the committee still owns the open floor in the middle.
import { Vox, M, glow } from '../../../vox/vox.js';
import { lin } from '../../kit.js';
import { makeRng } from '../../gen.js';

const cream = M('#d8cba4', 2), icing = M('#e8d7b1', 2), jam = M('#702b36', 1);
const colors = ['#a64a44', '#c8a34e', '#557e76', '#9982a2'];

function cup(v, x, y, z, color, height = 8) {
  v.cyl('y', x, z, y, y + height, 3, M(color, 1), 4.5);
  v.cyl('y', x, z, y + height - 2, y + height, 3.4, M('#382e28', 1));
  v.cyl('y', x, z, y + height - 1, y + height, 4.6, cream);
  v.cyl('y', x, z, y + height - 1, y + height, 3.4, M('#382e28', 1));
}

function cake() {
  const v = new Vox();
  v.cyl('y', 0, 0, 0, 2, 24, M('#968f7e', 0));
  // Five offset tiers, exposed sponge/jam seams, scalloped piping and long
  // dried drips. Each tier has been added without removing the previous one.
  for (let tier = 0; tier < 5; tier++) {
    const x = tier * 3 - 4, z = tier % 2 ? -2 : 0, y = 2 + tier * 12, r = 21 - tier * 2;
    v.cyl('y', x, z, y, y + 11, r, M('#ad8c59', 2));
    v.cyl('y', x, z, y + 3, y + 5, r + .2, jam);
    v.cyl('y', x, z, y + 7, y + 9, r + .2, icing);
    v.cyl('y', x, z, y + 9, y + 12, r + .8, icing);
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2, px = Math.round(x + Math.sin(a) * r), pz = Math.round(z + Math.cos(a) * r);
      v.sphere(px, y + 11, pz, 1.6, M(tier % 2 ? '#9b6873' : '#7c9b88', 1));
      if (i % 3 === 0) v.rbox(px - 1, y + 4 - i % 4, pz - 1, px + 2, y + 11, pz + 2, 1, icing);
    }
    // A missing slice exposes the layers; it was never replaced.
    if (tier === 0) v.carve(x - 4, y, z + 12, x + 5, y + 11, z + r + 2);
  }
  for (let i = 0; i < 9; i++) {
    const x = -1 + (i % 3) * 6, z = -6 + Math.floor(i / 3) * 6;
    const y = 62, h = 7 + i % 3;
    v.box(x, y, z, x + 2, y + h, z + 2, M(colors[i % colors.length], 1));
    if (i % 2 === 0) v.ellipsoid(x + 1, y + h + 2, z + 1, 1, 3, 1, glow('#ffc76c'));
    else v.set(x, y + h, z, M('#3e3026', 1));
  }
  return v;
}

function buffet() {
  const v = new Vox(), metal = M('#626661', 1), cloth = M('#c4b4a0', 3);
  v.rbox(-58, 29, -21, 58, 33, 21, 1, cloth);
  for (const x of [-51, 50]) for (const z of [-15, 14]) v.box(x, 0, z, x + 3, 30, z + 3, metal);
  // Uneven, stained tablecloth falls in pleats over the front.
  for (let x = -58; x < 58; x += 4) {
    const low = 6 + Math.round(3 * Math.sin(x * .32));
    v.box(x, low, 20, x + 4, 31, 22 + (x % 8 ? 1 : 0), x % 12 ? cloth : M('#8d6571', 3));
    if (x > -16 && x < -5) v.box(x, low + 3, 23, x + 3, 29, 24, M('#88634d', 3));
  }
  v.stamp(cake(), -12, 33, -1);
  for (let i = 0; i < 15; i++) v.cyl('y', 42 + Math.floor(i / 6), 5, 33 + i * 2, 35 + i * 2, 8, i % 2 ? cream : M('#b4a88c', 2));
  for (let i = 0; i < 9; i++) cup(v, 31 + Math.floor(i / 4), 33 + i * 3, -10, '#a24742');
  for (let i = 0; i < 3; i++) cup(v, -43 + i * 9, 33, 11, colors[i]);
  return v;
}

function supplies(variant) {
  const v = new Vox(), board = M('#93774e', 2), tape = M('#b6a47a', 1), seam = M('#51442e', 1);
  const box = (x, y, z, w, h, d) => {
    v.rbox(x-w/2,y,z-d/2,x+w/2,y+h,z+d/2,1,board);
    v.box(x-2,y+h,z-d/2,x+2,y+h+1,z+d/2,tape);
    v.box(x-2,y,z+d/2,x+2,y+h,z+d/2+1,tape);
    v.box(x-w/2+2,y+4,z+d/2,x-w/2+12,y+10,z+d/2+1,cream);
    for(let i=0;i<4;i++)v.box(x-w/2+3+i*2,y+5,z+d/2+1,x-w/2+4+i*2,y+9,z+d/2+2,seam);
  };
  box(0,0,0,30,19,25);box(-4,19,-1,32,18,24);box(2,37,0,26,16,22);
  if (variant === 0) {
    // More nested cups than the office could ever use, leaning off their boxes.
    for (let stack=0;stack<3;stack++) for(let i=0;i<12+stack*3;i++) cup(v,-9+stack*10+Math.floor(i/4),53+i*2,-3+stack*3,colors[stack]);
    for(let i=0;i<26;i++)v.cyl('y',-19+Math.floor(i/7),8,2+i*2,4+i*2,9,i%2?cream:M('#a5a088',2));
  } else {
    // Cones nested into an impossible paper totem, with a spill of folded hats.
    for(let i=0;i<13;i++) {
      const x=-4+Math.floor(i/3),y=53+i*2;
      v.cyl('y',x,0,y,y+12,7,M(colors[i%4],1),.5);
      v.cyl('y',x,0,y,y+2,7.5,cream);
    }
    for(const [x,z] of [[-18,9],[19,-5],[20,11]])v.cyl('y',x,z,0,13,7,M('#ba9f4a',1),.4);
  }
  return v;
}

function balloons() {
  const v=new Vox(), cord=M('#b2a98a',1);
  for(const [x,y,z,color] of [[-10,82,0,'#bba54b'],[9,91,-2,'#708d80'],[3,70,9,'#c1ac98']]) {
    for(let h=0;h<y-9;h++)v.set(Math.round(x*h/(y-9)+Math.sin(h*.12)),h,Math.round(z*h/(y-9)),cord);
    v.ellipsoid(x,y,z,7.5,10,7,M(color,1));
    v.box(x-4,y+3,z+4,x-1,y+6,z+6,M('#e0d1a0',1));
    v.box(x-1,y-12,z-1,x+1,y-9,z+1,M(color,1));
  }
  v.rbox(-5,0,-4,5,3,4,1,M('#8a7759',2));return v;
}

function agedCard(c, id, lines, {w=256,h=192,big=27}={}) {
  return c.kit.tex.custom(`party:card:${id}`,w,h,g=>{
    const R=makeRng(`party-paper:${id}`);
    g.fillStyle='#cec29a';g.fillRect(0,0,w,h);
    for(let i=0;i<900;i++){g.fillStyle=R()>.5?'#c4b58d':'#d8cca8';g.fillRect(R()*w,R()*h,1+R()*5,1);}
    g.strokeStyle='#79584c';g.lineWidth=2;g.strokeRect(6,6,w-12,h-12);
    g.textAlign='center';g.textBaseline='middle';
    lines.forEach((line,i)=>{g.font=`bold ${i===0?big:Math.round(big*.66)}px 'Courier New', monospace`;g.fillStyle=i===0?'#843f3a':'#342d26';g.fillText(line,w/2,30+i*(h-55)/Math.max(1,lines.length-1),w-22);});
    // Creases, old pin holes, and water running down one edge.
    g.fillStyle='#b2a27a';g.fillRect(w*.43,0,2,h);g.fillRect(0,h*.57,w,1);
    for(let i=0;i<10;i++)g.fillRect(w-8-i,0,1,12+R()*h*.55);
    g.fillStyle='#574f3a';for(const x of [9,w-10])for(const y of [10,h-10])g.fillRect(x,y,2,2);
  },{clamp:true});
}

function swag(c, ax, az, bx, bz, y, sag, color, width=.075) {
  const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),ux=-dz/len,uz=dx/len,n=Math.ceil(len/.22);
  for(let i=0;i<n;i++) {
    const a=i/n,b=(i+1)/n,ya=y-Math.sin(a*Math.PI)*sag,yb=y-Math.sin(b*Math.PI)*sag;
    const pts=[[ax+dx*a+ux*width,ya,az+dz*a+uz*width],[ax+dx*b+ux*width,yb,az+dz*b+uz*width],
      [ax+dx*b-ux*width,yb-.045,az+dz*b-uz*width],[ax+dx*a-ux*width,ya-.045,az+dz*a-uz*width]];
    c.flat.quad(...pts,color);c.flat.quad(...[...pts].reverse(),color);
  }
}

export function dressParty(c) {
  const {W,D,H}=c,R=makeRng(`party-dressing:${c.room.id}:${W}:${D}`),palette=colors.map(color=>lin(color));
  const placed=[];c.rt.partyDressing=placed;
  // Suspended crepe paper and flags leave the floor completely unobstructed.
  for(let i=0;i<5;i++) {
    const z=-D/2+.7+i*(D-1.4)/4;
    swag(c,-W/2+.1,z,W/2-.1,z+.22,H-.12,.22+(i%2)*.2,palette[i%4]);
    for(let j=1;j<=9;j++) {
      const t=j/10,x=-W/2+.1+(W-.2)*t,y=H-.17-Math.sin(t*Math.PI)*(.22+i%2*.2),zz=z+.22*t;
      const a=[x-.13,y,zz],b=[x+.13,y,zz],d=[x+.025,y-.28,zz+.025];
      c.flat.tri(a,d,b,palette[(i+j)%4]);c.flat.tri(b,d,a,palette[(i+j)%4]);
    }
  }
  // Search only free perimeter wall runs, never the route across the room.
  const runs=()=>['back','left','right','front'].flatMap(side=>c.spans(side,.45,2.3).map(([a,b])=>({side,a,b,at:(a+b)/2,width:b-a}))).sort((a,b)=>(b.side==='back'?2:0)-(a.side==='back'?2:0)||b.width-a.width);
  const place=(kind,make,width,depth,scale=1)=>{
    for(const s of runs()) {
      if(s.width<width+.3)continue;
      const p=c.wallAt(s.side,s.at,depth/2+.1);
      if(!c.clear(p.x,p.z,depth/2+.08))continue;
      const foot=c.model(`fun:${kind}:v2`,make,p.x,p.z,{rot:p.rot,scale});
      c.reserve(p.x,p.z,Math.hypot(foot.w,foot.d)/2+.1);c.keepWall(s.side,s.at-width/2-.1,s.at+width/2+.1);
      const item={kind,...s,...p,foot};placed.push(item);return item;
    }
    return null;
  };
  // Reserve the banner's width too, so it cannot hang across a doorway.
  const table=place('buffet',buffet,3.8,1.1,Math.min(1,(H-.7)/2.7));
  if(table) {
    const tex=agedCard(c,'last-day',['HAPPY LAST DAY','WE SAVED YOUR PIECE.'],{w:512,h:128,big:48});
    // A banner drooping in the middle, above the impossibly tall cake.
    const b=c.mapped('party:last-day',tex),span=3.6,n=18,p=c.wallAt(table.side,table.at,.04);
    for(let i=0;i<n;i++) {
      const t=i/n,u=(i+1)/n;
      const a={x:p.x+p.U[0]*(t-.5)*span,z:p.z+p.U[2]*(t-.5)*span};
      const d={x:p.x+p.U[0]*(u-.5)*span,z:p.z+p.U[2]*(u-.5)*span};
      const ya=H-.3-Math.sin(t*Math.PI)*.18,yb=H-.3-Math.sin(u*Math.PI)*.18;
      b.quad([a.x,ya-.65,a.z],[d.x,yb-.65,d.z],[d.x,yb,d.z],[a.x,ya,a.z],lin('#ffffff'),[[t,0],[u,0],[u,1],[t,1]]);
    }
    c.light(table.x,1.9,table.z,'#e6b06d',.22,{k:1.4,far:3});
  }
  for(let i=0;i<4;i++)place(`supplies:${i%2}`,()=>supplies(i%2),1.3,1.05,Math.min(1.15,(H-.2)/2.4));
  for(let i=0;i<3;i++)place('balloon-cluster',balloons,1,.7,Math.min(1.1,(H-.18)/2.55));

  const posters=[['SMILE!','The photograph','has already been taken.'],['PLEASE SIGN THE CARD','Even if you don\'t','remember them.'],['MANY HAPPY RETURNS','1978  1979  1980  1981','1982  1983  1984  1985','1986  1987  1988  1988'],['DO NOT CLEAR AWAY','We are still','expecting someone.']];
  for(let i=0;i<posters.length;i++) {
    const s=c.wallSpot(.85,['left','right','back','front'],.3,2.1);if(!s)break;
    const tex=agedCard(c,`notice:${i}`,posters[i]);c.hang(c.mapped(`party:notice:${i}`,tex),s.side,s.at,1.55,.82,.62);
    c.keepWall(s.side,s.at-.5,s.at+.5);
    c.wbox(s.side,s.at-.29,.13,1.85,1.91,.015,.022,lin('#c8b789'));
    c.wbox(s.side,s.at+.28,.13,1.21,1.27,.015,.022,lin('#c8b789'));
  }
  // Confetti has been swept into drifts, not removed. Sparse trails cross the
  // dance floor; everything here is flat and contributes no collider.
  for(let i=0;i<240;i++) {
    const side=i%4,along=R.range(-1,1),edge=R.range(.15,1.15);
    const x=side<2?(side?1:-1)*(W/2-edge):along*(W/2-.2),z=side>=2?(side===3?1:-1)*(D/2-edge):along*(D/2-.2);
    c.lay(c.flat,x,z,R.range(.025,.065),R.range(.04,.1),R.range(-3,3),null,palette[i%4],.012);
  }
}
