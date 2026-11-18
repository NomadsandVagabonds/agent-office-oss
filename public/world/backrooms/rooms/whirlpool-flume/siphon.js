// Separate strands pull away from the basin and disappear inside the lip.
// The wristband follows one strand; both ends of its loop are out of sight.
import {Batch, lin} from '../../kit.js';
import {addTranslucent} from '../../waterpark.js';

const TAU = Math.PI * 2;
const radiusAt = u => .115 + .22*(1-u)**3 + .12*u*u;
const turnAt = u => .48 + u*4.9 + .24*Math.sin(4*u);

export function poolSiphon(c,x,z,waterY,mouthY) {
  const span=mouthY-waterY, water=new Batch(), flow={value:0};
  const levels=34, strands=6;
  function point(i,u,edge){
    const phase=i*TAU/strands;
    const center=phase+turnAt(u)+.14*Math.sin(5*u+phase);
    const angle=center+edge*(.24+.09*Math.cos(phase+u*6));
    const r=radiusAt(u)+.035*Math.sin(7*u+phase)+.025*Math.cos(edge*Math.PI/2);
    return [x+r*Math.cos(angle),waterY+u*span,z+r*Math.sin(angle)];
  }
  for(let i=0;i<strands;i++) for(let level=0;level<levels;level++){
    const u=-.035+1.105*level/levels, v=u+1.105/levels;
    for(let k=0;k<3;k++){
      const a=k/3,b=(k+1)/3;
      water.quad(point(i,u,2*a-1),point(i,u,2*b-1),point(i,v,2*b-1),point(i,v,2*a-1),
        lin(i%3===0?'#b8e8d2':'#7cc7bd'),[[a,u+i*2],[b,u+i*2],[b,v+i*2],[a,v+i*2]]);
    }
  }
  addTranslucent(c,water,{alpha:.8,order:5,finishMaterial(mat){
    mat.forceSinglePass=true;
    mat.uniforms.uSiphonFlow=flow;
    mat.vertexShader='uniform float uSiphonFlow;\n'+mat.vertexShader.replace('vec4(position, 1.0)',`
      vec4(position + vec3(.025*sin(13.*uv.y-uSiphonFlow*3.), 0.,
                            .021*cos(15.*uv.y-uSiphonFlow*2.)), 1.)`);
    mat.fragmentShader='uniform float uSiphonFlow;\n'+mat.fragmentShader.replace('gl_FragColor = vec4(c, uAlpha);',`
      float s = vUv.y*27. - uSiphonFlow*8.2 + 1.2*sin(vUv.y*9. - uSiphonFlow*2.3);
      float fine = sin(16.*vUv.x + 2.*sin(s*.5));
      float glint = pow(.5+.5*cos(s + 3.*vUv.x + .65*fine), 5.);
      float edge = smoothstep(0.,.19,min(vUv.x,1.-vUv.x));
      gl_FragColor = vec4(c*(.80+.82*glint+.12*fine),uAlpha*edge*(.23+.67*glint+.18*fine+.17*sin(s)));`);
  }});

  // Punched plastic strap with an unsnapped tail, black holes and an ivory stud.
  const band=new Batch(), orange=lin('#f39143'), notch=lin('#643f31'), stud=lin('#ece1bb');
  const rim=(a,h)=>[.111*Math.cos(a),h,.090*Math.sin(a)];
  for(let i=0;i<20;i++){
    const a=.23+i*.275,b=a+.275;
    const p=rim(a,-.026),q=rim(a,.026),r=rim(b,.026),s=rim(b,-.026);
    band.quad(p,q,r,s,orange);band.quad(s,r,q,p,orange);
  }
  band.box(.097,-.026,-.090,.115,.026,.040,orange);
  for(let i=0;i<3;i++) band.box(.115,-.009,-.081+i*.026,.118,.009,-.073+i*.026,notch);
  band.box(.110,-.011,.015,.121,.012,.033,stud);
  const bracelet=c.dynamic(band,{wet:.6});bracelet.name='siphon-wristband';
  let time=1.2;
  function update(dt,surge){
    time+=dt*surge;
    flow.value=time%(20*Math.PI);
    const phase=(time%5.6)/5.6;
    // Approach sideways at the surface, catch, accelerate up into the throat.
    const rise=Math.min(1,Math.max(0,(phase-.26)/.57));
    const u=1.13*(.23*rise+.77*rise*rise);
    const approach=Math.max(0,1-phase/.26);
    const a=turnAt(u) + .14*Math.sin(5*u) + approach*1.65;
    const radius=radiusAt(u)+approach*.43;
    bracelet.visible=phase<.86;
    bracelet.position.set(x+radius*Math.cos(a),waterY+.018+span*u-.12*Math.max(0,1-phase/.11),z+radius*Math.sin(a));
    bracelet.rotation.set(.48+rise*.80+.16*Math.sin(a*3),-a,.28+rise*2.2);
  }
  update(0,1);
  return update;
}

export function vortexFoam(c,waterY) {
  const batch=new Batch();
  for(let i=0;i<21;i++){
    const radius=.43+(i%3)*.44, start=(i*.381966%1)*TAU;
    const tip=(k,edge)=>{
      const t=k/10, a=start+.56*t, r=radius+.17*t+edge*.033*Math.sin(t*Math.PI);
      return [r*Math.cos(a),waterY+.014+.006*(i%2),r*Math.sin(a)];
    };
    for(let k=0;k<10;k++) batch.quad(tip(k,-1),tip(k+1,-1),tip(k+1,1),tip(k,1),
      lin(i%3===1?'#87b5a5':'#a1c9b8'));
  }
  return c.dynamic(batch,{pivot:[0,waterY,0],wet:.7});
}
