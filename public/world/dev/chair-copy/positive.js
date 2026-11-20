// Orthographic contact prints. The depth buffer keeps even thin overlapping legs and handles legible.
// Faces are filled in a tiny fixed-size raster, once per plate; gameplay never takes a second render pass.
export function drawPositive(g,stock) {
  const W=128,H=128,{vox,bounds:b}=stock;
  const data=g.createImageData(W,H), px=data.data, depth=new Float32Array(W*H).fill(-Infinity);
  const left=7,right=120,top=7,bottom=108;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++) {
    const inside=x>=left&&x<=right&&y>=top&&y<=bottom;
    const grain=((x*47+y*61+x*y*13)%9)-4, v=inside?grain-9*y/H:grain*.32;
    const k=(y*W+x)*4;
    px[k]=(inside?185:244)+v;px[k+1]=(inside?180:238)+v;px[k+2]=(inside?158:219)+v;px[k+3]=255;
  }
  const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,cz=(b.z0+b.z1)/2;
  const w=b.x1-b.x0,h=b.y1-b.y0,d=b.z1-b.z0;
  const scale=Math.min(102/(.91*w+.42*d),88/(.93*h+.16*w+.30*d));
  vox.each((x,y,z,ink)=>{
    const tx=!vox.has(x+1,y,z),ty=!vox.has(x,y+1,z),tz=!vox.has(x,y,z+1);
    if(!tx&&!ty&&!tz)return;
    const u=64+((x+.5-cx)*.91-(z+.5-cz)*.42)*scale;
    const v=57+(-(y+.5-cy)*.93+(x+.5-cx)*.16+(z+.5-cz)*.30)*scale;
    const range=Math.max(.56,.69*scale), row=Math.max(.56,.70*scale), order=.42*x+.35*y+.91*z;
    const shade=ty?1.09:tz?.94:.72;
    const R=((ink>>>16)&255)*shade+5,G=((ink>>>8)&255)*shade+4,B=(ink&255)*shade+3;
    for(let yy=Math.max(top,Math.ceil(v-row));yy<=Math.min(bottom,v+row);yy++)for(let xx=Math.max(left,Math.ceil(u-range));xx<=Math.min(right,u+range);xx++){
      const i=yy*W+xx;if(depth[i]>order)continue;depth[i]=order;
      px[i*4]=R;px[i*4+1]=G;px[i*4+2]=B;
    }
  });
  g.putImageData(data,0,0);
}
