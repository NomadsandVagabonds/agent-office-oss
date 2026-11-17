// Construction details for the folded showers. Assets are authored facing +Z,
// transformed into room coordinates, and batched by material across the room.
// They deliberately do not register collision: the room owns its walking route.
import * as THREE from 'three';
import {Batch,lin,WHITE} from '../../kit.js';
import {pipe} from '../../pool-finish.js';
import {showerTextures} from './textures.js';
export {showerTextures} from './textures.js';

const C={steel:lin('#a8aaa0'),edge:lin('#d0cdc0'),dark:lin('#3f4b48'),rust:lin('#82604d'),
  brass:lin('#b59a6b'),ivory:lin('#c9b9a5'),pink:lin('#c58f96'),latch:lin('#bdb7a5')};
const box=(b,q,col=WHITE,uv=.6)=>b.box(...q,col,{step:.8,uv});
const matrix=({x=0,y=0,z=0,rot=0,tilt=0}={})=>new THREE.Matrix4().compose(
  new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,rot,0,'YXZ')),new THREE.Vector3(1,1,1));
function append(dst,src,m){
  const base=dst.verts,p=new THREE.Vector3(),n=new THREE.Vector3(),nm=new THREE.Matrix3().getNormalMatrix(m);
  for(let i=0;i<src.verts;i++){
    p.fromArray(src.pos,i*3).applyMatrix4(m);n.fromArray(src.nor,i*3).applyMatrix3(nm).normalize();
    dst.pos.push(p.x,p.y,p.z);dst.nor.push(n.x,n.y,n.z);dst.uv.push(src.uv[i*2],src.uv[i*2+1]);
    dst.alb.push(...src.alb.slice(i*3,i*3+3));dst.ao.push(src.ao[i]);
  }
  for(const i of src.idx)dst.idx.push(base+i);
}
function context(c){
  if(c.rt.showerAssets)return c.rt.showerAssets;
  const textures=showerTextures(c.kit),batches=new Map(),meshes=new Map(),water=new Batch(),time={value:0};
  const get=(name)=>{
    if(!batches.has(name)){
      const wet={metal:.65,wood:.8,mauve:.65,pink:.85,glass:.9,cloth:.15}[name]??.5;
      const b=new Batch(),g=c.dynamic(b,{map:name==='metal'?c.kit.tex.white():textures[name],wet});
      g.name='shower-assets:'+name;batches.set(name,b);meshes.set(name,g);
    }
    return batches.get(name);
  };
  // One stream draw call for every shower. Narrow crossed ribbons catch the
  // room light; moving breaks in their opacity read as falling drops.
  const streams=new THREE.Group();streams.name='shower-streams';c.add(streams);
  c.after.push(()=>{
    if(!water.verts)return;
    const geo=c.kit.geometry(water,c.rt.lights,c.rt.amb,c.rt.lighting);
    const mat=c.kit.surface({map:c.kit.tex.white(),room:c.rt.u,alpha:.4,side:THREE.DoubleSide,flick:geo.userData.flick,banks:geo.userData.banks});
    mat.uniforms.uShowerTime=time;
    mat.fragmentShader='uniform float uShowerTime;\n'+mat.fragmentShader.replace('gl_FragColor = vec4(c, uAlpha);',
      'float drop = smoothstep(0.38, 0.73, fract(vUv.y * 17.0 + uShowerTime * 2.8 + vUv.x * 11.0));\n gl_FragColor = vec4(c, uAlpha * (0.17 + 0.83 * drop));');
    const mesh=new THREE.Mesh(geo,mat);mesh.renderOrder=4;streams.add(mesh);
  });
  c.tick((dt,t)=>{time.value=t;});
  return c.rt.showerAssets={get,textures,batches,meshes,water,streams};
}
function place(c,src,kind,pose){append(context(c).get(kind),src,matrix(pose));}
function screw(b,x,y,z,r=.012){
  // A flush screw has one exposed face; its buried sides add no silhouette.
  b.quad([x-r,y-r,z+.004],[x+r,y-r,z+.004],[x+r,y+r,z+.004],[x-r,y+r,z+.004],C.edge);
  b.quad([x-r*.7,y-.002,z+.006],[x+r*.7,y-.002,z+.006],[x+r*.7,y+.002,z+.006],[x-r*.7,y+.002,z+.006],C.dark);
}
function bounds(m,x0,z0,x1,z1,bottom,top){
  const pts=[[x0,z0],[x0,z1],[x1,z0],[x1,z1]].map(([x,z])=>new THREE.Vector3(x,0,z).applyMatrix4(m));
  return {x0:Math.min(...pts.map(p=>p.x)),x1:Math.max(...pts.map(p=>p.x)),z0:Math.min(...pts.map(p=>p.z)),z1:Math.max(...pts.map(p=>p.z)),bottom,top};
}

/** Full size steel lockers; x,z is the centre of the bank. Open leaf is a real
 * folded door with visible shelf edges and interior hooks, not a black decal. */
export function lockerBank(c,{x,z,y=0,count=6,spacing=.62,rot=0,openIndex=-1,height=2.1}={}){
  const skin=new Batch(),hardware=new Batch(),pose={x,z,y,rot},half=count*spacing/2;
  const leaf=(at,index,open)=>{
    const d=new Batch(),h=new Batch(),w=spacing-.07;
    box(d,[0,.09,-.028,w,height-.075,.018]);
    // Folded sheet-metal returns and the inset door panel catch grazing light.
    box(d,[.025,.13,.019,w-.025,height-.11,.031],lin(index%3===0?'#d5c7d6':'#e4d8e5'));
    for(const yy of [.35,height-.48])for(let j=0;j<4;j++){
      const v=yy+j*.058;
      box(h,[.10,v,.034,w-.1,v+.022,.039],C.dark);
      box(d,[.09,v+.023,.039,w-.09,v+.035,.058],lin('#d2c4d2'));
    }
    // Three knuckles per hinge, a riveted latch and tiny number plate.
    for(const yy of [.32,height-.4])for(let j=0;j<3;j++)
      box(h,[-.015,yy+j*.045,.02,.016,yy+j*.045+.035,.066],C.steel);
    box(h,[w-.085,.91,.035,w-.025,1.10,.075],C.latch);
    box(h,[w-.067,.98,.075,w-.041,1.015,.093],C.dark);
    for(const yy of [.935,1.075])screw(h,w-.056,yy,.079,.007);
    box(h,[w/2-.072,height-.21,.034,w/2+.072,height-.155,.047],C.latch);
    for(let k=0;k<3;k++)box(h,[w/2-.045+k*.027,height-.193,.048,w/2-.034+k*.027,height-.176,.05],C.dark);
    // Chipped enamel at the door's lower corners is three-dimensional.
    for(const xx of [.02,w-.05])box(h,[xx,.095,.021,xx+.024,.12,.033],C.rust);
    const hinge=new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(at-spacing/2+.035,0,.301),new THREE.Matrix4().makeRotationY(open?-1.68:0));
    append(skin,d,hinge);append(hardware,h,hinge);
  };
  for(let i=0;i<count;i++){
    const at=-half+spacing*(i+.5),a=at-spacing/2,b=at+spacing/2;
    // Separate sides, roof and back give open lockers actual depth.
    box(skin,[a+.012,.06,-.30,a+.038,height,.30]);
    box(skin,[b-.038,.06,-.30,b-.012,height,.30]);
    box(skin,[a+.012,height-.035,-.30,b-.012,height,.30]);
    box(skin,[a+.012,.06,-.30,b-.012,.10,.30]);
    box(skin,[a+.025,.08,-.30,b-.025,height-.025,-.27],lin('#9a8a9a'));
    if(i===openIndex){
      for(const yy of [.46,1.58])box(skin,[a+.04,yy,-.26,b-.04,yy+.025,.27],lin('#c4b7c8'));
      pipe(hardware,[at,1.81,-.22],[at,1.75,-.15],.015,C.steel,6);
      box(hardware,[a+.08,.12,-.22,b-.11,.15,.11],C.rust);
    }
    leaf(at,i,i===openIndex);
    for(const xx of [a+.06,b-.06])box(hardware,[xx-.025,0,-.25,xx+.025,.075,.22],C.dark);
  }
  // Continuous base rail reads as one institutional bank, not toy cupboards.
  box(hardware,[-half,.055,.28,half,.09,.32],C.steel);
  place(c,skin,'mauve',pose);place(c,hardware,'metal',pose);
  return bounds(matrix(pose),-half,-.3,half,.32,y,y+height);
}

/** Jambed 1m office door with a real wired-glass cutout. open is radians; tilt
 * rotates the entire assembly around X (useful for the door in the ceiling). */
export function officeDoor(c,{x,z,y=0,rot=0,tilt=0,open=0}={}){
  const frame=new Batch(),leaf=new Batch(),hardware=new Batch(),glass=new Batch(),pose={x,y,z,rot,tilt};
  for(const xx of [-.55,.55]){
    box(frame,[xx-.045,0,-.075,xx+.045,2.2,.075],C.ivory);
    box(frame,[xx-.055,0,.065,xx+.055,2.22,.09],C.edge);
  }
  box(frame,[-.6,2.13,-.075,.6,2.22,.075],C.ivory);
  box(frame,[-.52,.005,-.07,.52,.025,.12],C.steel);
  // The leaf's centre is empty at the window, with four rails around it.
  const a=-.49,b=.49,lo=.91,hi=1.9,l=-.30,r=.30;
  for(const q of [[a,.04,-.035,b,lo,.035],[a,hi,-.035,b,2.10,.035],[a,lo,-.035,l,hi,.035],[r,lo,-.035,b,hi,.035]])box(leaf,q,C.ivory);
  for(const xx of [l,r])box(hardware,[xx-.022,lo-.02,.035,xx+.022,hi+.02,.056],C.steel);
  for(const yy of [lo,hi])box(hardware,[l-.02,yy-.022,.035,r+.02,yy+.022,.056],C.steel);
  glass.quad([l,lo,.036],[r,lo,.036],[r,hi,.036],[l,hi,.036],WHITE);
  glass.quad([r,lo,-.036],[l,lo,-.036],[l,hi,-.036],[r,hi,-.036],WHITE);
  box(hardware,[a+.02,.10,.036,b-.02,.40,.053],C.steel);
  for(const xx of [a+.055,b-.055])for(const yy of [.14,.36])screw(hardware,xx,yy,.058,.009);
  box(hardware,[.35,.72,.037,.44,.97,.066],C.steel);
  pipe(hardware,[.395,.85,.075],[.395,.85,.13],.025,C.edge);
  pipe(hardware,[.395,.85,.13],[.245,.85,.13],.024,C.steel);
  for(const yy of [.29,1.03,1.83]){
    box(hardware,[-.53,yy,-.02,-.465,yy+.16,.045],C.steel);
    for(let i=0;i<3;i++)pipe(hardware,[-.505,yy+i*.05,.048],[-.505,yy+i*.05+.04,.048],.018,C.edge,6);
  }
  box(hardware,[-.37,1.99,.04,-.08,2.065,.12],C.steel);
  pipe(hardware,[-.22,2.03,.13],[.04,2.13,.18],.012,C.edge,6);
  const swing=new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().makeTranslation(-.5,0,0),new THREE.Matrix4().makeRotationY(open)).multiply(new THREE.Matrix4().makeTranslation(.5,0,0));
  const leafM=new THREE.Matrix4().multiplyMatrices(matrix(pose),swing);
  place(c,frame,'metal',pose);
  append(context(c).get('metal'),leaf,leafM);append(context(c).get('metal'),hardware,leafM);append(context(c).get('glass'),glass,leafM);
  return {width:1.2,height:2.22,pose,open};
}

/** Brass riser and mixer with a faceted rain head and individual water jets. */
export function shower(c,{x,z,y=0,rot=0,run=true,reverse=false}={}){
  const b=new Batch(),pose={x,y,z,rot},m=matrix(pose);
  pipe(b,[0,.55,0],[0,1.88,0],.026,C.brass);
  pipe(b,[0,1.88,0],[0,2.02,.16],.026,C.brass);
  pipe(b,[0,2.02,.16],[0,2.02,.38],.025,C.brass);
  for(const yy of [.64,1.44]){
    pipe(b,[0,yy,-.06],[0,yy,.02],.066,C.steel,8);
    screw(b,-.035,yy,.024,.006);screw(b,.035,yy,.024,.006);
  }
  pipe(b,[-.23,.87,.035],[.23,.87,.035],.052,C.steel,8);
  for(const side of [-1,1]){
    pipe(b,[side*.21,.87,.035],[side*.21,.87,.11],.052,C.brass,8);
    box(b,[side*.21-.05,.86,.11,side*.21+.05,.88,.13],side<0?lin('#a65859'):lin('#6b9a9b'));
  }
  pipe(b,[0,1.95,.38],[0,2.005,.38],.135,C.brass,12);
  pipe(b,[0,1.94,.38],[0,1.955,.38],.124,C.dark,12);
  for(let i=0;i<9;i++){
    const a=i*Math.PI*2/9,xx=Math.cos(a)*.075,zz=.38+Math.sin(a)*.075;
    pipe(b,[xx,1.928,zz],[xx,1.947,zz],.012,C.edge,6);
  }
  // Recessed drain tray with genuinely separated grate bars.
  box(b,[-.23,-.008,.14,.23,.002,.60],C.dark);
  for(let i=0;i<7;i++)box(b,[-.21+i*.063,.003,.16,-.184+i*.063,.012,.58],C.steel);
  for(const zz of [.145,.585])box(b,[-.23,.002,zz,.23,.016,zz+.015],C.edge);
  place(c,b,'metal',pose);
  if(run){
    const water=new Batch(),col=lin('#d0e3d4');
    for(let i=0;i<11;i++){
      const a=i*Math.PI*2/11,r=.055+(i%3)*.025,xx=Math.cos(a)*r,zz=.38+Math.sin(a)*r;
      const endX=xx*1.7,endZ=.38+(zz-.38)*1.7,uv=[[i*.17,0],[i*.17+.02,0],[i*.17+.02,reverse?-1:1],[i*.17,reverse?-1:1]];
      water.quad([endX-.004,.025,endZ],[endX+.004,.025,endZ],[xx+.003,1.928,zz],[xx-.003,1.928,zz],col,uv);
      water.quad([endX,.025,endZ+.004],[endX,.025,endZ-.004],[xx,1.928,zz-.003],[xx,1.928,zz+.003],col,uv);
    }
    append(context(c).water,water,m);
  }
  return {x,z,y,rot,run,head:new THREE.Vector3(0,1.94,.38).applyMatrix4(m)};
}

/** A towel draped from a two-pronged wall hook; y is the top of the hook. */
export function hangingTowel(c,{x,z,y=0,rot=0}={}){
  const cloth=new Batch(),b=new Batch(),pose={x,y,z,rot};
  box(b,[-.095,-.10,-.035,.095,.045,.005],C.steel);
  for(const xx of [-.055,.055]){
    pipe(b,[xx,-.05,0],[xx,-.05,.10],.014,C.edge,6);
    pipe(b,[xx,-.05,.10],[xx,.015,.12],.014,C.edge,6);
  }
  for(const xx of [-.065,.065])screw(b,xx,.019,.01,.009);
  // Nine folded strips form a stepped cloth silhouette and a dark inner fold.
  for(let i=0;i<9;i++){
    const xx=(i-4)*.045,width=.047,drop=.86+.045*Math.cos(i*.9)+(i===7?.07:0),zz=.10+Math.cos(i*1.8)*.035;
    const shade=lin(i%2?'#e3d2b4':'#c5b69e');
    box(cloth,[xx-width/2,-drop,zz,xx+width/2,-.015,zz+.023],shade,.28);
    box(cloth,[xx-width/2,-drop+.12,zz+.024,xx+width/2,-drop+.19,zz+.027],lin('#a38ba8'),.28);
    box(cloth,[xx-width/2,-drop+.21,zz+.024,xx+width/2,-drop+.235,zz+.027],lin('#b19ab4'),.28);
    for(let j=0;j<2;j++)box(cloth,[xx-.016+j*.018,-drop-.025,zz+.006,xx-.009+j*.018,-drop,zz+.014],shade,.28);
  }
  place(c,cloth,'cloth',pose);place(c,b,'metal',pose);
  return {width:.44,height:.96};
}

/** Bolted bench used as a walkway. `y` is its top and `bottom` the floor below.
 * from/to are [x,z]. The caller supplies matching floor support, not a collider. */
export function wetBenchSegment(c,from,to,{width=1.4,y=.16,bottom=-.32}={}){
  const dx=to[0]-from[0],dz=to[1]-from[1],length=Math.hypot(dx,dz);
  if(length<.01)throw new Error('A wet bench segment needs two different endpoints');
  const pose={x:(from[0]+to[0])/2,z:(from[1]+to[1])/2,rot:Math.atan2(dx,dz)},m=matrix(pose),wood=new Batch(),metal=new Batch();
  const slats=Math.ceil(length/.145),pitch=length/slats;
  for(let i=0;i<slats;i++){
    const z=-length/2+(i+.5)*pitch,w=width/2,a=z-pitch*.45,b=z+pitch*.45;
    box(wood,[-w,y-.055,a,w,y-.008,b],lin(i%7===0?'#cab39b':'#e3c2a9'),.9);
    box(wood,[-w+.012,y-.008,a+.008,w-.012,y,b-.008],lin(i%7===0?'#cab39b':'#e3c2a9'),.9);
    for(const x of [-w+.12,w-.12]){
      metal.quad([x-.015,y+.005,z+.015],[x+.015,y+.005,z+.015],[x+.015,y+.005,z-.015],[x-.015,y+.005,z-.015],C.steel);
      metal.quad([x-.009,y+.007,z+.002],[x+.009,y+.007,z+.002],[x+.009,y+.007,z-.002],[x-.009,y+.007,z-.002],C.dark);
    }
  }
  const rails=width/2-.18;
  for(const x of [-rails,rails])box(wood,[x-.055,y-.14,-length/2,x+.055,y-.055,length/2],lin('#ba9b82'),.9);
  for(let i=0;i<=Math.max(1,Math.floor(length/1.1));i++){
    const count=Math.max(1,Math.floor(length/1.1)),z=-length/2+.10+(length-.2)*i/count;
    for(const x of [-rails,rails]){
      box(metal,[x-.04,bottom,z-.045,x+.04,y-.13,z+.045],C.dark);
      box(metal,[x-.09,bottom+.005,z-.11,x+.09,bottom+.028,z+.11],C.steel);
      for(const zz of [z-.07,z+.07])box(metal,[x-.015,bottom+.028,zz-.015,x+.015,bottom+.044,zz+.015],C.dark);
    }
    box(metal,[-rails-.045,y-.17,z-.03,rails+.045,y-.135,z+.03],C.dark);
  }
  place(c,wood,'wood',pose);place(c,metal,'metal',pose);
  return {...bounds(m,-width/2,-length/2,width/2,length/2,bottom,y),from,to,width,length,top:y};
}
