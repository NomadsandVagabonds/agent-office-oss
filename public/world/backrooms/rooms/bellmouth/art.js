import * as THREE from 'three';
import {Batch,lin,WHITE} from '../../kit.js';
import {bellPoint,SECTORS} from './rule.js';
export function bellTextures(kit) {
  const tile=(key,palette,n)=>kit.tex.custom('bellmouth:'+key,256,256,g=>{
    g.fillStyle=palette[3];g.fillRect(0,0,256,256);
    const size=256/n;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++) {
      const h=(x*17+y*41+x*y*7)%31;
      g.fillStyle=palette[h%3];g.fillRect(x*size+1,y*size+1,size-1,size-1);
      g.fillStyle='#ffffff1c';g.fillRect(x*size+2,y*size+2,size-3,1);
      if(h===0){g.fillStyle=palette[3];g.fillRect(x*size+1,y*size+1,3,2);}
    }
  });
  const tileMap=tile('glaze',['#d9d8c4','#d4d6c3','#dedecb','#a2aa97'],8);
  const deck=tile('mosaic',['#bbbca7','#c6c3ac','#bdbda9','#8e9786'],16);
  const green=tile('sea-green',['#6b8c7c','#738e7d','#688474','#536b5e'],8);
  const water=kit.tex.custom('bellmouth:water',128,128,g=>{
    g.fillStyle='#102b25';g.fillRect(0,0,128,128);
    for(let i=0;i<55;i++){g.fillStyle=i%4?'#748e7428':'#cad2b453';g.fillRect((i*37)%128,(i*61)%128,4+(i%7)*2,1);}
  });
  const tide=kit.tex.custom('bellmouth:tide',256,64,g=>{
    g.clearRect(0,0,256,64);
    for(let x=0;x<256;x++){
      const y=18+Math.sin(x*.11)*2;g.fillStyle='#8d92705c';g.fillRect(x,y,1,9+(x*7)%22);
      g.fillStyle='#8c906b8e';g.fillRect(x,y,1,3);
    }
  });
  const marker=kit.tex.custom('bellmouth:depth',256,128,g=>{
    g.fillStyle='#d6d5bc';g.fillRect(0,0,256,128);g.fillStyle='#46564a';g.font='bold 42px monospace';g.textAlign='center';g.fillText('0.45 m',128,61);g.fillRect(28,86,200,3);
  },{clamp:true});
  return {tile:tileMap,deck,green,water,tide,marker};
}

// Subdivide arbitrary sloping facets for the existing baked vertex lighting.
// Project UVs in an orthonormal face basis, so tile size stays metric on slopes.
export function face(batch,pts,{repeat=1.6,color=WHITE,step=.65}={}) {
  const [a,b,c,d]=pts,dist=(u,v)=>Math.hypot(...u.map((x,i)=>x-v[i]));
  const len=dist(a,b),vlen=dist(a,d),nu=Math.max(1,Math.ceil(len/step)),nv=Math.max(1,Math.ceil(vlen/step));
  const U=b.map((x,i)=>(x-a[i])/(len||1)),D=d.map((x,i)=>x-a[i]);
  const dot=D.reduce((s,x,i)=>s+x*U[i],0),V=D.map((x,i)=>x-dot*U[i]),vl=Math.hypot(...V)||1;
  for(let i=0;i<3;i++)V[i]/=vl;
  const at=(u,v)=>a.map((_,k)=>(a[k]*(1-u)+b[k]*u)*(1-v)+(d[k]*(1-u)+c[k]*u)*v);
  const uv=p=>[p.reduce((s,x,i)=>s+x*U[i],0)/repeat,p.reduce((s,x,i)=>s+x*V[i],0)/repeat];
  for(let y=0;y<nv;y++)for(let x=0;x<nu;x++) {
    const q=[at(x/nu,y/nv),at((x+1)/nu,y/nv),at((x+1)/nu,(y+1)/nv),at(x/nu,(y+1)/nv)];
    batch.quad(...q,color,q.map(uv));
  }
}

export function beam(batch,a,b,width,color=lin('#7c8779')) {
  const dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1,ox=-dz/n*width/2,oz=dx/n*width/2;
  const p=(v,sgn,up)=>[v[0]+ox*sgn,v[1]+up*width/2,v[2]+oz*sgn];
  batch.quad(p(a,-1,1),p(b,-1,1),p(b,1,1),p(a,1,1),color);
  batch.quad(p(a,1,-1),p(b,1,-1),p(b,-1,-1),p(a,-1,-1),color);
  for(const s of [-1,1])batch.quad(p(a,s,-s),p(b,s,-s),p(b,s,s),p(a,s,s),color);
}

export function bellWater(c,tex,p) {
  const batch=new Batch(),group=new THREE.Group(),phase={value:0};c.add(group);
  for(let i=0;i<SECTORS;i++) {
    const a=i*Math.PI*2/SECTORS,b=(i+1)*Math.PI*2/SECTORS;
    const q=[[0,p.water,0],bellPoint(p,a,.45,p.water),bellPoint(p,b,.45,p.water),[0,p.water,0]];
    batch.quad(...q,WHITE,q.map(v=>[v[0]/3,v[2]/3]));
  }
  c.after.push(()=>{
    const material=c.kit.surface({map:tex,room:c.rt.u,alpha:.82,side:THREE.DoubleSide});
    material.uniforms.uBellWater=phase;
    material.fragmentShader='uniform float uBellWater;\n'+material.fragmentShader.replace('texture2D(map, vUv)',
      'texture2D(map, vUv + vec2(sin(uBellWater * 0.7) * 0.012, uBellWater * 0.008))');
    const mesh=new THREE.Mesh(c.kit.geometry(batch,c.rt.lights,c.rt.amb),material);mesh.renderOrder=4;group.add(mesh);
  });
  c.liquid?.(group,{kind:'water',phase,y:p.water});
  return {phase,group};
}
