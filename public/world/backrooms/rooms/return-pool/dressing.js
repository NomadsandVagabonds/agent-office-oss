import { Batch, lin } from '../../kit.js';
import { Vox, M } from '../../../vox/vox.js';

// A laundry trolley, not a new exception to the office's grab rules. Every
// copy uses the existing trolley profile and keeps its towels in its body.
export function towelCart(variant) {
  const v = new Vox(), steel = M('#788d83', 0), worn = M('#b0b9a3', 0), rust = M('#79583b', 0);
  const rubber = M('#293e38', 0), canvas = M('#7f8c70', 0), seam = M('#526953', 0);
  const cloth = ['#d0ceb0', '#b6bc9c', '#9cae97', '#d9d3b5'].map(c => M(c, 0)), dirt = M('#7f8060', 0);
  for (const x of [-23, 20]) for (const z of [-14, 11]) {
    // Castor, fork, axle and swivel plate; same footprint as the old blocks.
    v.cyl('x',2.5,z+2,x,x+3,2.5,rubber);
    v.cyl('x',2.5,z+2,x-1,x+4,.7,worn);
    for(const xx of [x-1,x+3])v.box(xx,2,z+1,xx+1,6,z+3,steel);
    v.box(x-1,6,z-1,x+4,7,z+4,worn);
    v.box(x, 7, z, x + 2, 39, z + 2, steel);
  }
  v.box(-25, 7, -16, 25, 9, 16, steel);
  // Canvas bin: uneven top edge, sagging seams and damp patches.
  v.box(-23, 10, -14, 23, 29, 14, canvas);
  for (const z of [-15, 14]) {
    v.box(-25, 31, z, 25, 33, z + 1, worn);
    for (let x = -20; x < 23; x += 9) {
      v.box(x, 11, z, x + 1, 29 - Math.abs(x % 3), z + 1, seam);
      v.box(x + 2, 11, z, x + 7, 14 + Math.abs(x % 7), z + 1, dirt);
      for(let y=13;y<29;y+=4)v.set(x,y,z+1,worn);
    }
    for (const x of [-23, 21]) v.box(x, 24, z, x + 2, 27, z + 1, rust);
  }
  // Horizontal handles and their uprights extend beyond the canvas.
  for (const x of [-27, 25]) {
    for (const z of [-13, 12]) v.box(x, 29, z, x + 1, 41, z + 1, steel);
    v.box(x, 40, -13, x + 1, 42, 13, worn);
    v.box(x, 40, -8, x + 1, 42, 8, rubber);
  }
  for (let i = 0; i < 13; i++) {
    const x = -21 + (i * 13 + variant * 7) % 28, z = -12 + (i * 7) % 13, y = 28 + Math.floor(i / 4) * 4;
    const color = cloth[(i + variant) % cloth.length];
    v.rbox(x, y, z, x + 13, y + 3, z + 10, 1, color);
    v.box(x+1,y+1,z+9,x+12,y+2,z+10,seam);
    v.box(x+1,y+2,z+9,x+12,y+3,z+10,color);
    v.box(x+2,y+2,z+1,x+3,y+3,z+9,cloth[(i+variant+1)%cloth.length]);
    if (i % 3 === 0) v.box(x + 3, y + 2, z + 2, x + 7, y + 3, z + 6, dirt);
  }
  // One heavy towel folded over the front rim, with a faded hotel stripe.
  v.box(-13 + variant * 9, 21, 16, -1 + variant * 9, 35, 17, cloth[0]);
  v.box(-12 + variant * 9, 23, 17, -2 + variant * 9, 24, 18, seam);
  v.box(-12 + variant * 9, 22, 17, -10 + variant * 9, 29, 18, dirt);
  for(let i=0;i<4;i++) {
    const x=-13+variant*9+i*3;
    v.box(x,20+i%2,17,x+1,34,18,cloth[i%2]);
    v.box(x,23,18,x+1,24,19,seam);
  }
  return v;
}

function rulesTexture(kit) {
  return kit.tex.custom('return-pool:hotel-rules', 384, 512, g => {
    const paper = '#d3d0a9', ink = '#244b43', faded = '#697c64', red = '#8f4635';
    g.fillStyle = paper; g.fillRect(0, 0, 384, 512);
    g.strokeStyle = ink; g.lineWidth = 5; g.strokeRect(9.5, 9.5, 365, 493);
    g.lineWidth = 1; g.strokeRect(15.5, 15.5, 353, 481);
    g.textAlign = 'center'; g.fillStyle = ink; g.font = '12px serif';
    g.fillText('H O T E L   M E R I D I A N', 192, 37);
    g.font = 'bold 39px sans-serif'; g.fillText('POOL RULES', 192, 78.5);
    g.font = '9.5px monospace'; g.fillText('FOR THE COMFORT OF ALL REMAINING GUESTS', 192, 98);
    const line = points => { g.beginPath(); points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.stroke(); };
    const head = (x,y,r=4.5) => {g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
    const person = (x,y,stretch=1) => {
      head(x,y); line([[x,y+7],[x,y+22.5*stretch]]);
      line([[x-10,y+15.5],[x,y+10],[x+11,y+18]]);
      line([[x-11,y+35*stretch],[x,y+22.5*stretch],[x+10,y+35*stretch]]);
    };
    const rows = [
      ['WALK. DO NOT RUN.', 'It has right of way.'],
      ['SHOWER BEFORE RE-ENTRY.', 'Even if you have not left.'],
      ['CHECK THE DEPTH.', 'Both ends.'],
      ['DO NOT FEED THE DRAIN.', 'Lost property is not returned.'],
    ];
    rows.forEach(([title,sub],i) => {
      const y=121.5+i*78.5;
      g.strokeStyle=faded;g.lineWidth=1;line([[27,y-8.5],[357,y-8.5]]);
      g.save();g.translate(28.5,y);g.fillStyle=ink;g.strokeStyle=ink;g.lineWidth=4;g.lineCap='square';
      g.strokeRect(0,0,63,59);
      if(i===0) {
        person(31,9); line([[31,31.5],[14.5,34],[7,47.5]]); // one leg too many
        g.strokeStyle=red;g.lineWidth=3;line([[3,56],[59.5,3.5]]);
      } else if(i===1) {
        person(31.5,14);line([[7.5,16],[7.5,4.5],[49.5,4.5]]);
        for(const x of [19,31.5,44]) {line([[x,4],[x,10.5]]);line([[x-2,6.5],[x,4],[x+2,6.5]]);}
      } else if(i===2) {
        person(19.5,10,.7);g.save();g.translate(63,59);g.rotate(Math.PI);person(17.5,8.5,.75);g.restore();
        g.lineWidth=1.5;line([[6.5,30],[56,30]]);
      } else {
        person(16.5,8,.8);line([[24,22.5],[39.5,27.5]]);head(41,34.5,2);
        g.fillRect(31.5,45.5,27,4);g.fillStyle=paper;
        for(let j=0;j<5;j++)g.fillRect(34+j*4.5,43.5,2,4.5);
      }
      g.restore();g.textAlign='left';g.fillStyle=ink;g.font='bold 14px sans-serif';g.fillText(title,105.5,y+19.5);
      g.fillStyle=faded;g.font='11px serif';g.fillText(sub,105.5,y+41.5);
    });
    g.textAlign='center';g.fillStyle=red;g.font='bold 13.5px monospace';g.fillText('POOL CLOSES AT 00:00',192,460.5);
    g.fillStyle=ink;g.font='10px serif';g.fillText('Please collect all of your belongings.',192,480.5);
    // A badly registered reprint, missing type strokes and long mineral runs.
    g.globalAlpha=.13;g.fillStyle=red;g.font='bold 39px sans-serif';g.fillText('POOL RULES',194.5,80.5);g.globalAlpha=1;
    for(let i=0;i<75;i++) {
      g.fillStyle=i%3===0?'#64735c38':'#efe5ba62';
      const x=21+((i*107)%680)*0.5,y=19+((i*137)%930)*0.5;
      g.fillRect(x,y,(2+i%5)*0.5,(14+(i*19)%97)*0.5);
    }
    g.fillStyle=paper;
    for(const [x,y,w,h] of [[88,59.5,14,2.5],[215,69,31.5,2],[140.5,137.5,22,1.5],[236,302.5,13.5,2],[202.5,451.5,25.5,2.5]])g.fillRect(x,y,w,h);
    // Peeling lower corner, split laminate and dead screw heads.
    g.fillStyle='#8d967b';g.beginPath();g.moveTo(342,495.5);g.lineTo(367,463);g.lineTo(367.5,495);g.fill();
    g.strokeStyle='#807d5e';g.lineWidth=1;line([[360,22.5],[347.5,52],[353.5,72.5],[342,95]]);
    for(const x of [22,362])for(const y of [22.5,488.5]){g.fillStyle='#706a50';head(x,y,2.5);g.strokeStyle=paper;g.lineWidth=1;line([[x-1.5,y],[x+1.5,y]]);}
  }, {clamp:true});
}

function maintenanceVox() {
  const v=new Vox(), steel=M('#81968b',0), dark=M('#243e34',0), plastic=M('#a69a62',0), cloth=M('#c3c2a1',0), stain=M('#7a8468',0);
  // Open bucket, rag and a tall pool skimmer leaning against the wall.
  v.box(-8,0,-8,8,1,8,plastic);
  for(const x of [-8,7])v.box(x,1,-8,x+1,16,8,plastic);
  for(const z of [-8,7])v.box(-8,1,z,8,16,z+1,plastic);
  v.box(-6,10,-6,6,10,6,dark);
  v.box(-5,8,9,3,18,10,cloth);v.box(-4,9,11,-1,12,11,stain);
  for(let y=0;y<78;y++)v.box(13+Math.floor(y/16),y,0,14+Math.floor(y/16),y,1,steel);
  v.box(11,78,0,24,79,1,steel);v.box(11,92,0,24,93,1,steel);
  for(const x of [11,24])v.box(x,78,0,x,93,1,steel);
  for(let x=13;x<24;x+=3)v.box(x,80,0,x,91,0,stain);
  for(let y=81;y<92;y+=3)v.box(12,y,0,23,y,0,stain);
  return v;
}

export function dressPool(c) {
  const carts=[];
  for(const [variant,x,z] of [[0,-c.W/2+1.45,6.3],[1,c.W/2-1.65,-3.3]]) {
    const b=new Batch(true), foot=c.model('return-pool:towel-cart:'+variant,()=>towelCart(variant),x,z,{batch:b,solid:false,shadow:false});
    const group=c.dynamic(b,{pivot:[x,0,z]});
    carts.push(c.movable(group,{foot,type:'trolley',label:'Towel cart'}));
  }
  const sign=c.mapped('return:hotel-rules',rulesTexture(c.kit));
  c.wbox('left',3.8,2.27,.77,3.73,.016,.055,lin('#596e5c'));
  c.hang(sign,'left',3.8,2.25,2.2,2.9,null,undefined,.061);
  c.model('return-pool:maintenance',maintenanceVox,-c.W/2+.4,1.6,{solid:false,shadow:false,rot:Math.PI/2});
  // A few damp towels dropped behind the cart, not a route full of obstacles.
  for(const [i,x,z] of [[0,-c.W/2+1,7.4],[1,c.W/2-.7,-1.8],[2,-c.W/2+.6,.7]]) {
    c.crate(x,z,.38,.025,.62,i*.7,lin('#aaa98a'),{solid:false,shadow:false});
    c.crate(x+.08,z-.1,.14,.03,.25,i*.7,lin('#747f64'),{solid:false,shadow:false});
  }
  // Wet bare feet leave the pool, then continue up the tiled wall and stop.
  const wet=lin('#526f61');
  for(let i=0;i<8;i++) {
    const x=-3.4-i*.43,z=-1+(i%2?-.12:.12);
    c.lay(c.flat,x,z,.21,.09,0,null,wet,.012);
    for(let toe=0;toe<4;toe++)c.lay(c.flat,x-.13,z-.032+toe*.021,.025,.017,0,null,wet,.013);
  }
  for(let i=0;i<5;i++) {
    const at=-1+(i%2?-.13:.13),y=.24+i*.36;
    c.hang(c.flat,'left',at,y,.09,.21,null,wet,.04);
    c.hang(c.flat,'left',at,y+.13,.1,.025,null,wet,.04);
  }
  return carts.filter(Boolean);
}
