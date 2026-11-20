// A restrained moving light pattern from the flooded floor, confined to this
// room's wet materials. This is an art-directed caustic, not a second light bake.
export function showerGlaze(c) {
  const time={value:0};c.tick((dt,t)=>{time.value=t;});
  c.after.push(()=>c.rt.group.traverse(mesh=>{
    const mat=mesh.material;
    if(!mat?.defines?.WET||mat.transparent||mat.userData.changingGlaze)return;
    mat.userData.changingGlaze=true;mat.uniforms.uGlazeTime=time;
    if(mat.patchNode){
      mat.patchNode({
        color({T,c,vLit,uWet,localPos,localNormal,f,ss}){
          const {vec2,vec3,float,sin,cos,abs,min,normalize}=T;
          const q=localPos(),t=f('uGlazeTime');
          const p=vec2(q.x.add(q.z.mul(.61)),q.y.add(q.z.mul(.43))).mul(3.4);
          const wave=sin(p.x.add(sin(p.y.mul(1.31).add(t.mul(.31)))))
            .add(cos(p.y.add(cos(p.x.mul(.87).sub(t.mul(.27))))));
          const filament=float(1).sub(ss(.015,.13,abs(wave)));
          const wetWall=float(1).sub(ss(1.3,2.4,q.y)).mul(ss(-.3,.15,q.y))
            .mul(float(1).sub(ss(4.9,6.0,abs(q.x))))
            .mul(float(1).sub(ss(9.5,11.0,abs(q.z))));
          const facing=float(1).sub(ss(.35,.78,abs(normalize(localNormal()).y)));
          c.addAssign(filament.mul(wetWall).mul(facing).mul(uWet).mul(min(vLit,vec3(1.1))).mul(vec3(.10,.20,.18)));
        },
      });
      return;
    }
    mat.vertexShader='varying vec3 vGlazePoint;\nvarying vec3 vGlazeNormal;\n'+mat.vertexShader
      .replace('void main() {','void main() {\n vGlazePoint=position; vGlazeNormal=normal;');
    mat.fragmentShader=`uniform float uGlazeTime;
varying vec3 vGlazePoint;
varying vec3 vGlazeNormal;
`+mat.fragmentShader.replace('gl_FragColor = vec4(c, uAlpha);',`
  vec3 q=vGlazePoint;
  vec2 p=vec2(q.x+q.z*.61,q.y+q.z*.43)*3.4;
  float wave=sin(p.x+sin(p.y*1.31+uGlazeTime*.31))
             +cos(p.y+cos(p.x*.87-uGlazeTime*.27));
  float filament=1.0-smoothstep(.015,.13,abs(wave));
  float wetWall=(1.0-smoothstep(1.3,2.4,q.y))*smoothstep(-.3,.15,q.y);
  wetWall*=1.0-smoothstep(4.9,6.0,abs(q.x));
  wetWall*=1.0-smoothstep(9.5,11.0,abs(q.z));
  float facing=1.0-smoothstep(.35,.78,abs(normalize(vGlazeNormal).y));
  c+=filament*wetWall*facing*uWet*min(vLit,vec3(1.1))*vec3(.10,.20,.18);
  gl_FragColor = vec4(c,uAlpha);`);
  }));
}
