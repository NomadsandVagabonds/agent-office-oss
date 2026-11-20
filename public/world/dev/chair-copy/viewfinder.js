// Both overlays borrow the surfaces used by the original object and its final twin.
import * as T from 'three';

function phosphor(projected) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { ink: {value: new T.Color(0x9affdb)}, time: {value: 0} },
    vertexShader: `
      varying float height; varying vec3 facing, eye;
      void main() {
        vec4 view = modelViewMatrix * vec4(position,1.);
        height = position.y; facing = normalMatrix * normal; eye = -view.xyz;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      varying float height; varying vec3 facing, eye;
      uniform vec3 ink; uniform float time;
      void main() {
        float rim = pow(1.-abs(dot(normalize(facing),normalize(eye))), 1.4);
        float line = smoothstep(.54,.94,cos(height*194.));
        float sweep = 1.-smoothstep(.008,.055,abs(height-fract(time*.64)*1.1));
        float alpha = ${projected ? '.21 + .28*rim + .30*line + .19*sweep' : '.10 + .38*rim + .10*line + .27*sweep'};
        gl_FragColor = vec4(ink * (.83 + .17*line + .20*sweep), alpha);
        #include <colorspace_fragment>
      }`,
  });
}

export function createViewfinder(scene) {
  const glaze=phosphor(false), light=phosphor(true);
  const corners=new T.BufferGeometry(), points=[];
  for(const x of [-1,1])for(const z of [-1,1])points.push(x*.52,.012,z,x,.012,z,x,.012,z,x,.012,z*.52);
  corners.setAttribute('position',new T.Float32BufferAttribute(points,3));
  const ink=new T.LineBasicMaterial({color:0x9affdb,transparent:true,opacity:.9,depthWrite:false});
  const guides=new T.LineSegments(corners,ink);
  const target=new T.Mesh(corners,glaze), ghost=new T.Mesh(corners,light);
  target.name='carbon-scan-highlight'; ghost.name='carbon-placement-hologram';
  target.renderOrder=ghost.renderOrder=5;
  scene.add(target,ghost);ghost.add(guides);target.visible=ghost.visible=false;
  return {
    show(source, plate, landing, time) {
      target.visible=!!source;ghost.visible=!!(landing&&plate);
      if(source){
        target.geometry=source.body.geometry;target.matrixAutoUpdate=false;
        target.matrix.copy(scene.matrixWorld).invert().multiply(source.body.matrixWorld);
        target.matrixWorldNeedsUpdate=true;glaze.uniforms.time.value=time;
      }
      if(ghost.visible){
        ghost.geometry=plate.geo;ghost.rotation.y=plate.turn;ghost.position.set(landing.x,landing.y,landing.z);
        const b=plate.box;guides.scale.set((b.max.x-b.min.x)/2,1,(b.max.z-b.min.z)/2);
        guides.position.set((b.max.x+b.min.x)/2,0,(b.max.z+b.min.z)/2);
        light.uniforms.ink.value.setHex(landing.valid?0x9affdb:0xff7961);
        ink.color.copy(light.uniforms.ink.value);light.uniforms.time.value=time;
      }
    },
    dispose(){target.removeFromParent();ghost.removeFromParent();glaze.dispose();light.dispose();corners.dispose();ink.dispose();},
  };
}
