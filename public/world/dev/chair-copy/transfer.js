import * as T from 'three';
import { chairVox, WORKSTATION } from '../../backrooms/workstation.model.js';
import { VOXEL } from '../../vox/vox.js';

export const GRAINS = 512, SECONDS = 1.65;
export const CLOTH = '#527e80';

// Windows into the normal room mesh. Sort once so revealing a band only changes a draw range.
function bands(base) {
  const positions = base.getAttribute('position'), index = base.index;
  const triangles = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    triangles.push({a, b, c, y:(positions.getY(a) + positions.getY(b) + positions.getY(c)) / 3});
  }
  triangles.sort((a,b) => a.y - b.y);
  const order = triangles.flatMap(t => [t.a,t.b,t.c]), height = WORKSTATION.bounds.chair.y1 * VOXEL * WORKSTATION.scale;
  const mesh = base.clone();
  mesh.setIndex(order);
  const head = mesh.clone();
  function draw(g, y, above) {
    let lo=0, hi=triangles.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(triangles[mid].y < y*height)lo=mid+1;else hi=mid;}
    const start=above?lo*3:0, end=above?order.length:lo*3;
    g.setDrawRange(start,end-start);
  }
  return {mesh,head,source:y=>draw(mesh,y,false),dest:y=>draw(head,y,true)};
}
function shell() {
  const vox=chairVox({colour:CLOTH}), sample=[], scale=VOXEL*WORKSTATION.scale;
  let seed=1345,seen=0;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  vox.each((x,y,z,c)=>{
    if(vox.has(x-1,y,z)&&vox.has(x+1,y,z)&&vox.has(x,y-1,z)&&vox.has(x,y+1,z)&&vox.has(x,y,z-1)&&vox.has(x,y,z+1))return;
    const slot=seen<GRAINS?seen:Math.floor(rnd()*(seen+1));seen++;
    if(slot<GRAINS)sample[slot]={x:(x+.5)*scale,y:(y+.5)*scale,z:(z+.5)*scale,c};
  });
  const cube=new T.BoxGeometry(1,1,1),g=new T.InstancedBufferGeometry();
  g.setIndex(cube.index);g.setAttribute('position',cube.attributes.position);g.setAttribute('normal',cube.attributes.normal);
  const positions=[],colors=[],seeds=[],color=new T.Color();
  for(const cell of sample){
    positions.push(cell.x,cell.y,cell.z);color.setHex(cell.c&0xffffff);colors.push(color.r,color.g,color.b);
    seeds.push(rnd(),rnd());
  }
  for(const [name,values,n] of [['cell',positions,3],['pigment',colors,3],['salt',seeds,2]])
    g.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(values),n));
  g.instanceCount=sample.length;
  const uniforms={clock:{value:0},from:{value:new T.Vector3()},to:{value:new T.Vector3()},turn:{value:new T.Vector2(1,0)}};
  const mat=new T.ShaderMaterial({uniforms,vertexShader:`
    attribute vec3 cell, pigment; attribute vec2 salt;
    uniform vec3 from, to; uniform float clock; uniform vec2 turn;
    varying vec3 ink;
    void main(){
      float h=clamp(cell.y/0.975,0.,1.);
      float u=clamp((clock-(1.-h)*.40)/.56,0.,1.);
      float s=smoothstep(0.,1.,u), arch=sin(3.141593*u), phase=salt.x*6.283;
      vec3 axis=vec3(cell.x*turn.x+cell.z*turn.y,cell.y,cell.z*turn.x-cell.x*turn.y);
      vec3 path=mix(from,to,s)+axis;
      float spread=arch*(.07+.20*salt.y);
      path+=vec3(spread*cos(phase+u*5.),arch*(.26+.38*salt.y),spread*sin(phase+u*5.));
      float a=arch*(1.+salt.y)*2.3, cs=cos(a),sn=sin(a);
      vec3 p=vec3(position.x*cs+position.z*sn,position.y,-position.x*sn+position.z*cs);
      float size=(u>0. && u<1.) ? (.022+.012*salt.y) : 0.;
      ink=pigment*(.57+.26*normal.y+.13*normal.z)+vec3(.033,.043,.031)*arch;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(path+p*size,1.);
    }`,fragmentShader:`
    varying vec3 ink; void main(){gl_FragColor=vec4(ink,1.);
    #include <colorspace_fragment>
    }`});
  const swarm=new T.Mesh(g,mat);swarm.frustumCulled=false;swarm.visible=false;
  return {swarm,uniforms};
}
export function createTransfer(scene,template,rot) {
  const {swarm,uniforms}=shell(), sliced=bands(template.geometry);
  const arriving=new T.Mesh(sliced.head,template.material);arriving.visible=false;
  scene.add(arriving,swarm);uniforms.turn.value.set(Math.cos(rot),Math.sin(rot));
  let mesh=null,original=null;
  function stop(){
    if(mesh)mesh.geometry=original;
    mesh=null;arriving.visible=false;swarm.visible=false;
  }
  return {
    start(source,body,target){
      stop();mesh=body;original=mesh.geometry;mesh.geometry=sliced.mesh;
      arriving.position.set(target.x,target.y,target.z);arriving.rotation.y=rot;
      arriving.visible=true;swarm.visible=true;
      uniforms.from.value.set(source.x,source.y,source.z);uniforms.to.value.copy(arriving.position);
      this.at(0);
    },
    at(t){
      uniforms.clock.value=t;
      // The original is read from the top down, then reconstitutes while its copy finishes.
      sliced.source(t<.45?1-t/.40:(t-.55)/.43);sliced.dest(1-(t-.56)/.40);
    },stop,
    dispose(){stop();swarm.removeFromParent();arriving.removeFromParent();swarm.geometry.dispose();swarm.material.dispose();sliced.mesh.dispose();sliced.head.dispose();}
  };
}
