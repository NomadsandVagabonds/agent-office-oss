import * as THREE from 'three';
import { Batch, lin } from './kit.js';
import { MODE_WINDOW } from './carbon-camera.model.js';

// Five-by-seven LED characters. Bank the words in one mesh so changing mode only moves the draw range.
const letters={
  A:[14,17,17,31,17,17,17], B:[30,17,17,30,17,17,30], C:[14,17,16,16,16,17,14],
  D:[30,17,17,17,17,17,30], E:[31,16,16,30,16,16,31], K:[17,18,20,24,20,18,17],
  L:[16,16,16,16,16,16,31], N:[17,25,25,21,19,19,17], O:[14,17,17,17,17,17,14],
  P:[30,17,17,30,16,16,16], S:[15,16,16,14,1,1,30], T:[31,4,4,4,4,4,4], Y:[17,17,10,4,4,4,4],
};
export function modeDisplay(kit,unit){
  const b=new Batch(false), ranges=new Map();
  for(const [word,color] of Object.entries({COPY:'#9df4df',PASTE:'#9df4df',LOCK:'#ffbe54',DONE:'#c1ffac',BATT:'#ff8564'})){
    const first=b.idx.length, ink=lin(color), width=word.length*6-1;
    for(let i=0;i<word.length;i++)letters[word[i]].forEach((bits,row)=>{
      for(let col=0;col<5;col++)if(bits & (16>>col)){
        const x=(i*6+col-width/2)*.20, y=(2.5-row)*.208, w=.197, h=.199;
        b.quad([x,y,0],[x+w,y,0],[x+w,y+h,0],[x,y+h,0],ink);
      }
    });
    ranges.set(word,[first,b.idx.length-first]);
  }
  const mat=kit.surface();mat.transparent=true;
  const mesh=new THREE.Mesh(kit.geometry(b,[],[1.5,1.5,1.5]),mat);
  mesh.name='carbon-mode-led';mesh.renderOrder=10001;mesh.scale.setScalar(unit);
  mesh.position.set(MODE_WINDOW.x*unit,MODE_WINDOW.y*unit,(MODE_WINDOW.z+.20)*unit);
  mesh.rotation.x=-.09;
  return {mesh,show(word){
    if(mesh.userData.word===word)return;
    mesh.geometry.setDrawRange(...ranges.get(word));mesh.userData.word=word;
  }};
}
