// A restrained moving light pattern from the flooded floor, confined to this
// room's wet materials. This is an art-directed caustic, not a second light bake.
export function showerGlaze(c) {
  const time={value:0};c.tick((dt,t)=>{time.value=t;});
  c.after.push(()=>c.rt.group.traverse(mesh=>{
    const mat=mesh.material;
    if(!mat?.defines?.WET||mat.transparent||mat.userData.changingGlaze)return;
    mat.userData.changingGlaze=true;mat.uniforms.uGlazeTime=time;
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
  float facing=1.0-abs(normalize(vGlazeNormal).y)*.72;
  c+=filament*wetWall*facing*uWet*min(vLit,vec3(1.1))*vec3(.10,.20,.18);
  gl_FragColor = vec4(c,uAlpha);`);
  }));
}
