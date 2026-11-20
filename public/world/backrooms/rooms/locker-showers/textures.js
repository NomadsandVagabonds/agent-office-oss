// Procedural surfaces for the folded changing rooms. Texture scale is metric:
// pink/floor repeat at 1.2m (six 20cm tiles), ceiling at 1.2m (four 60cm panels).
// The small highlights describe glaze and wear; they do not claim reflections.
import { LinearFilter } from 'three';
const hash=(x,y,s=0)=>{let n=Math.imul(x+913,s+374761393)^Math.imul(y+719,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};
const fill=(g,color,x,y,w,h)=>{g.fillStyle=color;g.fillRect(x,y,w,h);};
export function showerTextures(kit){
  const ceramic=(key,palette)=>kit.tex.custom('folded-shower:'+key,384,384,g=>{
    const joints=key==='pink'?['#aa9a91','#a4958c','#968a82','#b0a097']:['#82918a','#788b83','#6e817a','#89978e'];
    fill(g,joints[0],0,0,384,384);
    for(let y=0;y<6;y++)for(let x=0;x<6;x++){
      const h=hash(x,y,3),xx=x*64,yy=y*64;
      // Old grout varies between repaired stretches, with dark growth in a
      // few joints instead of outlining every tile in an identical black grid.
      fill(g,joints[h%joints.length],xx,yy,64,64);
      if(h%4===0)fill(g,'#625e5159',xx,yy+12+h%21,2,8+h%23);
      if(h%5===0)fill(g,'#b7ad8c90',xx+9+h%26,yy+62,12+h%17,2);
      fill(g,palette[h%palette.length],xx+2,yy+2,61,61);
      // The tiny bevel remains readable at an angle without thick black grout.
      fill(g,'#fff2e331',xx+3,yy+3,59,1);fill(g,'#fff2e31a',xx+3,yy+4,1,57);
      fill(g,'#543f4629',xx+3,yy+61,59,2);fill(g,'#543f461c',xx+61,yy+4,2,57);
      for(let i=0;i<12;i++){
        const n=hash(i,h,7),px=xx+4+n%55,py=yy+4+(n>>>8)%55;
        fill(g,i%4?'#fff5ec08':'#554d4820',px,py,1+n%3,1+(n>>>4)%3);
      }
      if(h%9===0){fill(g,'#584e463e',xx+2,yy+25,2,11);fill(g,'#e0c7b053',xx+4,yy+27,1,7);}
      if(h%7===0){fill(g,'#f8ece852',xx+12,yy+10,32,1);fill(g,'#f8ece826',xx+13,yy+11,13,1);}
    }
    // Calcium accumulates in joints and leaves thin dried runs.
    for(let i=0;i<21;i++){
      const x=hash(i,4)%384,y=(hash(i,7)%6)*64+2;
      fill(g,'#d8ccb642',x,y,1,12+hash(i,11)%28);
    }
  });
  const pink=ceramic('pink',['#b9838a','#c18b91','#c28d91','#bd858c','#c99598','#b7828b']);
  const floor=ceramic('floor',['#657e7a','#6d8580','#728984','#617b78','#79908a','#69827e']);
  const mauve=kit.tex.custom('folded-shower:enamel',256,256,g=>{
    fill(g,'#a08da2',0,0,256,256);
    // Broad bleach marks and moisture runs remain visible at room distance;
    // fine enamel grain alone vanishes under the VHS/downsampling pass.
    for(let i=0;i<26;i++){
      const n=hash(i,82),x=n%256,y=(n>>>8)%256,w=8+(n>>>16)%21,h=13+(n>>>21)%25;
      fill(g,i%3?'#ddcbd42c':'#62556435',x,y,w,h);
      fill(g,i%3?'#ddcbd423':'#62556428',x+3,y-4,w-4,h+8);
      fill(g,'#e5d8d42a',x+2,y+h-2,w-3,2);
    }
    for(let i=0;i<600;i++){
      const n=hash(i,13);fill(g,i%3?'#e6d6da14':'#514c5b19',n%256,(n>>>8)%256,1+(n>>>16)%3,1+(n>>>20)%4);
    }
    for(let i=0;i<27;i++){
      const n=hash(i,91),x=n%256,y=(n>>>8)%256;
      const w=3+(n>>>19)%17;
      fill(g,'#574d5768',x,y,w,1);fill(g,'#e7dadb70',x,y+1,w,1);
      if(i%3===0){
        fill(g,'#7e624d9b',x,y+1,2,9+(n>>>10)%21);
        fill(g,'#ad8c6496',x+1,y+2,1,5+(n>>>10)%13);
      }
    }
    // Flaked islands expose the old undercoat, with a pale lip of paint.
    for(let i=0;i<15;i++){
      const n=hash(i,116),x=n%256,y=(n>>>8)%256;
      fill(g,'#d1c2bca6',x-1,y-1,5,4);fill(g,'#746c659b',x,y,3,3);
      fill(g,'#86624db0',x+1,y+2,3,1);
    }
  });
  const ceiling=kit.tex.custom('folded-shower:ceiling',256,256,g=>{
    fill(g,'#908c85',0,0,256,256);
    for(let y=0;y<2;y++)for(let x=0;x<2;x++){
      fill(g,(x+y)%2?'#beb9aa':'#c7bfb0',x*128+2,y*128+2,124,124);
      fill(g,'#e3d9c8',x*128+2,y*128+2,124,1);
      fill(g,'#686c65',x*128+126,y*128,2,128);
    }
    for(let i=0;i<1700;i++){
      const n=hash(i,2);fill(g,i%5?'#565a5344':'#e6dfcf33',n%256,(n>>>8)%256,1+(n>>>18)%2,1+(n>>>20)%3);
    }
    // Irregular water tide marks instead of evenly distributed noise.
    for(let i=0;i<230;i++){
      const a=i/230*Math.PI*2,r=30+3*Math.sin(a*5)+2*Math.sin(a*11);
      fill(g,'#8d704d45',74+Math.cos(a)*r*1.5,65+Math.sin(a)*r,2,2);
    }
  });
  const wood=kit.tex.custom('folded-shower:wet-wood',256,256,g=>{
    // Chunky 4px voxel-grid bathhouse cedar/teak slats: warm soaked heartwood,
    // stepped grain ribs, pixel knots, bevelled slat edges and damp footstep patches.
    const base=['#8f593c','#865035','#986042','#7d4930'];
    fill(g,'#3b2217',0,0,256,256);
    for(let board=0;board<4;board++){
      const by=board*64,bh=62,bhHash=hash(board,19,5);
      fill(g,base[board],0,by+1,256,bh);
      // Chunky voxel woodgrain bands running along the plank length (x)
      for(let row=0;row<15;row++){
        const py=by+2+row*4;
        for(let col=0;col<64;col++){
          const px=col*4,h=hash(col,row+board*17,31);
          const wave=Math.sin(col*.19+board*1.7+row*.45)+Math.cos(col*.09-row*.6+board);
          if(wave>.75)fill(g,'#b9815955',px,py,4,4);
          else if(wave<-.65)fill(g,'#4b2b1d68',px,py,4,4);
          else if(h%5===0)fill(g,h%2?'#a9714d3d':'#5b352445',px,py,4,4);
          // Fine pore flecks snapped to 2px sub-voxels
          if(h%11===0)fill(g,'#381e1466',px+(h%2)*2,py+((h>>>2)%2)*2,4,2);
        }
      }
      // Occasional chunky voxel knot ring per plank
      const kx=24+(bhHash%196),ky=by+16+((bhHash>>>8)%30);
      fill(g,'#5a342377',kx-8,ky-4,20,12);
      fill(g,'#3f2317a8',kx-4,ky-2,12,8);
      fill(g,'#2b160ec0',kx,ky,4,4);
      fill(g,'#c68f6642',kx-8,ky-6,16,2);
      // Crisp pixel bevel: warm top catch-light, deep wet underside shadow & joint
      fill(g,'#dba97e52',0,by+2,256,2);
      fill(g,'#2e18106e',0,by+bh-1,256,2);
      // Subtle transverse plank butt-joint with darker end-grain wicking
      const jx=32+((hash(board,41,9)%48)*4);
      fill(g,'#2c170fa8',jx,by+1,2,bh);
      fill(g,'#4a2a1c55',jx-6,by+1,6,bh);
      fill(g,'#4a2a1c48',jx+2,by+1,6,bh);
      fill(g,'#d4a27930',jx+2,by+2,2,bh-3);
    }
    // Irregular water-soaked damp patches & mineral/chlorine edges
    for(let i=0;i<18;i++){
      const n=hash(i,67,13),px=(n%60)*4,py=((n>>>8)%60)*4;
      const w=(4+(n>>>16)%9)*4,h=(3+(n>>>20)%6)*4;
      fill(g,'#361d1344',px,py,w,h);
      fill(g,'#2c170f30',px+4,py+4,Math.max(4,w-8),Math.max(4,h-8));
      if(i%3===0)fill(g,'#f2dec42a',px+2,py+2,Math.max(4,w-6),2);
      if(i%4===0)fill(g,'#6477652c',px,py+h-2,w,2);
    }
  });
  // Chunky 4px voxel blocks stay crisp under LinearFilter, and WebGPU requires linear magFilter to enable anisotropic filtering on grazing floors.
  wood.magFilter = LinearFilter;
  wood.anisotropy = 8;
  const grime=kit.tex.custom('folded-shower:grime',256,256,g=>{
    g.clearRect(0,0,256,256);
    // CUTOUT discards alpha below .5. Use opaque broken islands for soft
    // irregular coverage, rather than transparent marks which never render.
    for(let x=0;x<256;x+=2){
      const n=hash(x,42),top=171+Math.round(12*Math.sin(x*.07)+6*Math.sin(x*.19));
      for(let y=top;y<256;y+=3){
        const h=hash(x,y,53),coverage=.22+.42*(y-top)/(256-top);
        if((h%100)/100>coverage)continue;
        fill(g,h%3?'#7e705ec7':'#9b9e80c2',x,y,2+h%3,3+(h>>>8)%5);
      }
      if(n%5<2)fill(g,'#b2ad8fe3',x,top-1,2,2+n%3);
    }
    for(let i=0;i<43;i++){
      const n=hash(i,12),x=n%256,y=66+(n>>>8)%111,len=18+(n>>>20)%69;
      fill(g,i%3?'#83755ac5':'#afa989d5',x,y,1+n%3,len);
      fill(g,'#c6c2a4d9',x-1,y+1,1,Math.floor(len*.6));
      fill(g,'#80715ee2',x-1,y+len-3,3,4);
    }
  });
  const glass=kit.tex.custom('folded-shower:wired-glass',128,256,g=>{
    fill(g,'#a8b9a9',0,0,128,256);
    for(let y=0;y<256;y+=3)for(let x=0;x<128;x+=3){const n=hash(x,y,16);fill(g,n%2?'#e6eee23c':'#426f6e30',x,y,2,2);}
    g.strokeStyle='#667d745f';g.lineWidth=.7;
    for(let i=-256;i<256;i+=16){g.beginPath();g.moveTo(i,0);g.lineTo(i+256,256);g.stroke();g.beginPath();g.moveTo(i+256,0);g.lineTo(i,256);g.stroke();}
  });
  return {pink,mauve,floor,ceiling,wood,grime,glass,cloth:terryCloth(kit)};
}

export function terryCloth(kit) {
  return kit.tex.custom('folded-shower:terry-cloth',128,128,g=>{
    fill(g,'#d4c7ab',0,0,128,128);
    for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){const n=hash(x,y,88);fill(g,n%3?'#fff1ce38':'#5d5b453c',x,y,1,1+n%2);}
  });
}
