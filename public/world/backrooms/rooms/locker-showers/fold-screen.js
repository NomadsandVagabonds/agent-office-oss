import * as THREE from 'three';
import {Batch,WHITE,lin} from '../../kit.js';
import {pipe} from '../../pool-finish.js';

// An opaque aerated shower hides the matched seam. Both sides use the same
// header, drain and falling pattern; the visitor can cross and turn back.
export function foldScreens(c,folds){
  const b=new Batch(),time={value:0},group=new THREE.Group();c.add(group);
  for(const {x,z} of folds){
    pipe(c.flat,[x-1.18,2.3,z],[x+1.18,2.3,z],.045,lin('#a8aaa0'),8);
    for(let xx=x-1.1;xx<x+1.15;xx+=.15)
      c.flat.box(xx-.025,2.21,z-.025,xx+.025,2.3,z+.025,lin('#a8aaa0'));
    b.quad([x-1.2,0,z],[x+1.2,0,z],[x+1.2,2.29,z],[x-1.2,2.29,z],WHITE);
    c.flat.box(x-1.2,.001,z-.14,x+1.2,.014,z+.14,lin('#53615c'));
    for(let xx=x-1.16;xx<x+1.2;xx+=.085)
      c.flat.box(xx,.015,z-.12,xx+.035,.021,z+.12,lin('#b5b4a5'));
  }
  c.after.push(()=>{
    const geo=c.kit.geometry(b,c.rt.lights,c.rt.amb,c.rt.lighting);
    const mat=c.kit.surface({room:c.rt.u,alpha:.985,side:THREE.DoubleSide,
      flick:geo.userData.flick,banks:geo.userData.banks});
    mat.forceSinglePass=true;mat.uniforms.uFoldWaterTime=time;
    mat.fragmentShader='uniform float uFoldWaterTime;\n'+mat.fragmentShader.replace('gl_FragColor = vec4(c, uAlpha);',`
      float bands=sin(vUv.x*180.0+sin(vUv.y*21.0+uFoldWaterTime*4.0));
      float drops=sin(vUv.y*82.0+uFoldWaterTime*15.0+vUv.x*70.0);
      c*=vec3(.63,.91,.88)*(1.1+bands*.21+drops*.12);
      gl_FragColor=vec4(c,uAlpha);`);
    const mesh=new THREE.Mesh(geo,mat);mesh.name='fold-water-screen';mesh.renderOrder=5;group.add(mesh);
  });
  c.tick((dt,t)=>{time.value=t;});
}
