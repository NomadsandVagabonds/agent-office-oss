// Both overlays borrow the surfaces used by the original object and its final twin.
import * as T from 'three';

function phosphor(projected) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { ink: {value: new T.Color(0x9affdb)}, time: {value: 0},
      lock: {value:-1}, objectHeight: {value:1}, exposure: {value:0} },
    vertexShader: `
      varying float height; varying vec3 facing, eye;
      void main() {
        vec4 view = modelViewMatrix * vec4(position,1.);
        height = position.y; facing = normalMatrix * normal; eye = -view.xyz;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      varying float height; varying vec3 facing, eye;
      uniform vec3 ink; uniform float time, lock, objectHeight, exposure;
      void main() {
        float rim = pow(1.-abs(dot(normalize(facing),normalize(eye))), 1.4);
        float line = smoothstep(.54,.94,cos(height*194.));
        float sweep = 1.-smoothstep(.008,.055,abs(height-fract(time*.64)*1.1));
        float alpha = ${projected ? '.21 + .28*rim + .30*line + .19*sweep' : '.10 + .38*rim + .10*line + .27*sweep'};
        vec3 color = ink * (.83 + .17*line + .20*sweep);
        if(lock >= 0.){
          float level = clamp(height/objectHeight,0.,1.);
          float front = 1.-clamp((lock-.56)/.40,0.,1.);
          float edge = 1.-smoothstep(.008,.07,abs(level-front));
          color = mix(ink, vec3(1.,.91,.65), max(edge,1.-smoothstep(0.,.16,lock)));
          alpha = (.33 + .30*rim + .16*line + .18*edge)*(1.-smoothstep(front,front+.04,level));
        }
        color = mix(color,vec3(1.,.98,.87),exposure);
        gl_FragColor = vec4(color, mix(alpha,.86,exposure));
        #include <colorspace_fragment>
      }`,
  });
}

export function createViewfinder(scene) {
  const glaze=phosphor(false), light=phosphor(true);
  const corners=new T.BufferGeometry(), points=[];
  // Flat ribbons keep the four registration marks visible on the camcorder's low-resolution picture.
  for(const x of [-1,1])for(const z of [-1,1]){
    const strip=(x0,z0,x1,z1)=>{
      for(const [u,v] of [[x0,z0],[x1,z0],[x1,z1],[x0,z0],[x1,z1],[x0,z1]])points.push(x*u,.016,z*v);
    };
    strip(.54,.958,1,1);strip(.958,.54,1,.958);
  }
  corners.setAttribute('position',new T.Float32BufferAttribute(points,3));
  const ink=new T.MeshBasicMaterial({color:0x9affdb,transparent:true,opacity:.94,depthWrite:false,side:T.DoubleSide});
  const guides=new T.Mesh(corners,ink);guides.renderOrder=6;
  const target=new T.Mesh(corners,glaze), ghost=new T.Mesh(corners,light);
  target.name='carbon-scan-highlight'; ghost.name='carbon-placement-hologram';
  target.renderOrder=ghost.renderOrder=5;
  scene.add(target,ghost);ghost.add(guides);target.visible=ghost.visible=false;
  return {
    show(source, plate, landing, time, lock=-1, exposure=0) {
      target.visible=!!source;ghost.visible=!!(landing&&plate);
      if(source){
        target.geometry=source.body.geometry;target.matrixAutoUpdate=false;
        target.matrix.copy(scene.matrixWorld).invert().multiply(source.body.matrixWorld);
        target.matrixWorldNeedsUpdate=true;glaze.uniforms.time.value=time;glaze.uniforms.exposure.value=exposure;
      }
      if(ghost.visible){
        ghost.geometry=plate.geo;ghost.rotation.y=plate.turn;ghost.position.set(landing.x,landing.y,landing.z);
        const b=plate.box, snap=lock<0?1:1+.22*Math.max(0,1-lock*8)**2;
        guides.scale.set(snap*(b.max.x-b.min.x)/2,1,snap*(b.max.z-b.min.z)/2);
        guides.position.set((b.max.x+b.min.x)/2,0,(b.max.z+b.min.z)/2);
        light.uniforms.lock.value=lock;light.uniforms.objectHeight.value=Math.max(.01,b.max.y);
        light.uniforms.ink.value.setHex(lock>=0?0xffb74d:landing.valid?0x9affdb:0xff7961);
        ink.color.copy(light.uniforms.ink.value);light.uniforms.time.value=time;
      }
    },
    dispose(){target.removeFromParent();ghost.removeFromParent();glaze.dispose();light.dispose();corners.dispose();ink.dispose();},
  };
}
