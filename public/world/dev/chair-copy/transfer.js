import * as T from 'three';

export const GRAINS = 512, SECONDS = 1.65;

// Windows into the normal room mesh. Sort once so revealing a band only changes a draw range.
function bands(base, above = false) {
  const positions = base.getAttribute('position'), index = base.index;
  const triangles = [];
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    triangles.push({a, b, c, y:(positions.getY(a) + positions.getY(b) + positions.getY(c)) / 3});
  }
  triangles.sort((a,b) => a.y - b.y);
  base.computeBoundingBox();
  const order = triangles.flatMap(t => [t.a,t.b,t.c]), bottom=base.boundingBox.min.y, height=base.boundingBox.max.y-bottom;
  const mesh = new T.BufferGeometry();
  for (const [name, attr] of Object.entries(base.attributes)) mesh.setAttribute(name, attr);
  mesh.setIndex(order);
  mesh.boundingSphere = base.boundingSphere;
  function draw(y) {
    let lo=y>=1?triangles.length:0, hi=triangles.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(triangles[mid].y < bottom+y*height)lo=mid+1;else hi=mid;}
    const start=above?lo*3:0, end=above?order.length:lo*3;
    mesh.setDrawRange(start,end-start);
  }
  return {mesh,draw};
}
function shell(stock, twin) {
  const {vox,cell:scale}=stock, sample=[];
  let seed=1345,seen=0;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  vox.each((x,y,z,c)=>{
    if(vox.has(x-1,y,z)&&vox.has(x+1,y,z)&&vox.has(x,y-1,z)&&vox.has(x,y+1,z)&&vox.has(x,y,z-1)&&vox.has(x,y,z+1))return;
    const slot=seen<GRAINS?seen:Math.floor(rnd()*(seen+1));seen++;
    if(slot<GRAINS)sample[slot]={x:(x+.5)*scale,y:(y+.5)*scale,z:(z+.5)*scale,c};
  });
  // A deterministic surface sample on each end of the transfer. Sorting both by height
  // keeps the moving grains attached to the reading and writing fronts for any silhouette.
  const dest=[]; seen=0;
  twin.vox.each((x,y,z,c)=>{
    if(twin.vox.has(x-1,y,z)&&twin.vox.has(x+1,y,z)&&twin.vox.has(x,y-1,z)&&twin.vox.has(x,y+1,z)&&twin.vox.has(x,y,z-1)&&twin.vox.has(x,y,z+1))return;
    const slot=seen<GRAINS?seen:Math.floor(rnd()*(seen+1));seen++;
    if(slot<GRAINS)dest[slot]={x:(x+.5)*scale,y:(y+.5)*scale,z:(z+.5)*scale,c};
  });
  const byHeight=(a,b)=>a.y-b.y||a.x-b.x;
  sample.sort(byHeight);dest.sort(byHeight);
  const cube=new T.BoxGeometry(1,1,1),g=new T.InstancedBufferGeometry();
  g.setIndex(cube.index);g.setAttribute('position',cube.attributes.position);g.setAttribute('normal',cube.attributes.normal);
  const positions=[],colors=[],print=[],ends=[],seeds=[],color=new T.Color();
  for(const [i,cell] of sample.entries()){
    const end=dest[Math.floor(i*dest.length/sample.length)]; ends.push(end.x,end.y,end.z);
    positions.push(cell.x,cell.y,cell.z);color.setHex(cell.c&0xffffff);colors.push(color.r,color.g,color.b);
    color.setHex(end.c&0xffffff);print.push(color.r,color.g,color.b);
    seeds.push(rnd(),rnd());
  }
  for(const [name,values,n] of [['cell',positions,3],['pigment',colors,3],['salt',seeds,2],['misprint',print,3],['destination',ends,3]])
    g.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(values),n));
  g.instanceCount=sample.length;
  const uniforms={clock:{value:0},height:{value:Math.max(.01,stock.bounds.y1*scale)},grain:{value:Math.min(.04,Math.max(.009,scale*1.7))},from:{value:new T.Vector3()},to:{value:new T.Vector3()},turn:{value:new T.Vector2(1,0)},exitTurn:{value:new T.Vector2(1,0)}};
  const mat=new T.ShaderMaterial({uniforms,vertexShader:`
    attribute vec3 cell, pigment, misprint, destination; attribute vec2 salt;
    uniform vec3 from, to; uniform float clock, height, grain; uniform vec2 turn, exitTurn;
    varying vec3 ink;
    void main(){
      float h=clamp(cell.y/height,0.,1.);
      float u=clamp((clock-(1.-h)*.40)/.56,0.,1.);
      float s=smoothstep(0.,1.,u), arch=sin(3.141593*u), phase=salt.x*6.283;
      vec3 entry=vec3(cell.x*turn.x+cell.z*turn.y,cell.y,cell.z*turn.x-cell.x*turn.y);
      vec3 exitCell=vec3(destination.x*exitTurn.x+destination.z*exitTurn.y,destination.y,destination.z*exitTurn.x-destination.x*exitTurn.y);
      vec3 axis=mix(entry,exitCell,s);
      vec3 path=mix(from,to,s)+axis;
      float spread=arch*(.07+.20*salt.y);
      path+=vec3(spread*cos(phase+u*5.),arch*(.26+.38*salt.y),spread*sin(phase+u*5.));
      float a=arch*(1.+salt.y)*2.3, cs=cos(a),sn=sin(a);
      vec3 p=vec3(position.x*cs+position.z*sn,position.y,-position.x*sn+position.z*cs);
      float size=(u>0. && u<1.) ? (grain*(.8+.4*salt.y)) : 0.;
      ink=mix(pigment,misprint,s)*(.57+.26*normal.y+.13*normal.z)+vec3(.033,.043,.031)*arch;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(path+p*size,1.);
    }`,fragmentShader:`
    varying vec3 ink; void main(){gl_FragColor=vec4(ink,1.);
    #include <colorspace_fragment>
    }`});
  const swarm=new T.Mesh(g,mat);swarm.frustumCulled=false;swarm.visible=false;
  return {swarm,uniforms};
}
export function createTransfer(scene,template,rot,printGeometry,stock,twin,arrivalMaterial) {
  const {swarm,uniforms}=shell(stock,twin), landing=bands(printGeometry,true);
  const arriving=new T.Mesh(landing.mesh,arrivalMaterial||template.material);
  let departure=null;
  const departing=new T.Mesh(template.geometry,template.material);
  departing.matrixAutoUpdate=false;
  scene.add(arriving,departing,swarm);
  function stop(){arriving.visible=departing.visible=swarm.visible=false;}
  stop();
  return {
    start(source,target,endTurn=rot,consume=false){
      stop();
      // Only a spent original leaves a silhouette behind. The first print samples its
      // surface for flying grains without ever touching the actual source mesh.
      if(consume){
        departure??=bands(template.geometry);
        departing.geometry=departure.mesh;
        template.updateWorldMatrix(true,false);
        scene.updateWorldMatrix(true,false);
        departing.matrix.copy(scene.matrixWorld).invert().multiply(template.matrixWorld);
        departing.matrixWorldNeedsUpdate=true;departing.visible=true;
      }
      uniforms.turn.value.set(Math.cos(source.turn),Math.sin(source.turn));
      arriving.position.set(target.x,target.y,target.z);arriving.rotation.y=endTurn;
      uniforms.exitTurn.value.set(Math.cos(endTurn),Math.sin(endTurn));
      arriving.visible=true;swarm.visible=true;
      uniforms.from.value.set(source.x,source.y,source.z);uniforms.to.value.copy(arriving.position);
      this.at(0);
    },
    at(t){
      uniforms.clock.value=t;
      if(departing.visible)departure.draw(1-t/.40);
      landing.draw(1-(t-.56)/.40);
    },stop,
    dispose(){stop();for(const mesh of [swarm,arriving,departing])mesh.removeFromParent();swarm.geometry.dispose();swarm.material.dispose();departure?.mesh.dispose();landing.mesh.dispose();}
  };
}
