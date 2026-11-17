import * as THREE from 'three';
import {Batch,WHITE,lin} from '../../kit.js';
import {pipe} from '../../pool-finish.js';

// An opaque aerated shower hides the matched seam. Both sides use the same
// header, drain and falling pattern; the visitor can cross and turn back.
export function foldScreens(c, folds) {
  const b = new Batch(), time = { value: 0 }, group = new THREE.Group();
  c.add(group);
  const steel = lin('#a8aaa0'), grate = lin('#53615c');
  for (const { x, z, half, head } of folds) {
    const left = x - half, right = x + half, outlet = head - .031;
    pipe(c.flat, [left, outlet, z], [right, outlet, z], .029, steel, 8);
    for (let xx = left + .049; xx < right; xx += .09) {
      c.flat.box(xx - .012, outlet - .05, z - .012, xx + .012, outlet, z + .012, steel);
    }
    b.quad([left, .02, z], [right, .02, z], [right, outlet - .03, z], [left, outlet - .03, z], WHITE);
    c.flat.box(left, .001, z - .14, right, .014, z + .14, grate);
    for (let xx = left + .025; xx < right - .025; xx += .061) {
      c.flat.box(xx, .015, z - .12, xx + .025, .021, z + .12, steel);
    }
  }
  c.after.push(()=>{
    const geo=c.kit.geometry(b,c.rt.lights,c.rt.amb,c.rt.lighting);
    const mat=c.kit.surface({room:c.rt.u,alpha:.975,side:THREE.DoubleSide,
      flick:geo.userData.flick,banks:geo.userData.banks});
    mat.forceSinglePass=true;mat.uniforms.uFoldWaterTime=time;
    mat.fragmentShader=`
      uniform float uFoldWaterTime;
      float waterGrain(vec2 p) {
        p=fract(p*vec2(.1031,.11369));
        p+=dot(p,p.yx+19.19);
        return fract(p.x*p.y);
      }
    `+mat.fragmentShader.replace('gl_FragColor = vec4(c, uAlpha);',`
      float down = vUv.y + uFoldWaterTime*2.9;
      float jet = vUv.x*78.0 + .3*sin(down*5.9+vUv.x*54.0);
      float stream = pow(1.0-abs(fract(jet)*2.0-1.0),4.0);
      float glint = waterGrain(vec2(floor(jet),floor(down*72.0)));
      float mist = waterGrain(floor(vec2(vUv.x*211.0,down*137.0)));
      float foam = (1.0-smoothstep(0.0,.19,vUv.y))*mist;
      float shine = stream*(.14+.86*glint)*.47+mist*.08+foam*.30;
      c=c*vec3(.25,.49,.47)+vec3(.23,.38,.36)*(.16+shine);
      gl_FragColor=vec4(c,uAlpha);`);
    const mesh=new THREE.Mesh(geo,mat);mesh.name='fold-water-screen';mesh.renderOrder=5;group.add(mesh);
  });
  c.tick((dt,t)=>{time.value=t;});
}
