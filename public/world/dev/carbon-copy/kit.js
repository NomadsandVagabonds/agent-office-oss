import {Vox,tone} from '../../vox/vox.js';
import {bodies,fittings,palette,traits} from './recipe-contract.js';

export function readKit(raw,name){
  if(!raw || !bodies.includes(raw.body) || !Object.hasOwn(palette,raw.color) || !Object.hasOwn(palette,raw.accent) ||
    !Array.isArray(raw.fittings) || raw.fittings.length<1 || raw.fittings.length>4 ||
    raw.fittings.some(x=>!fittings.includes(x)) || !['ordinary',...traits].includes(raw.trait)) throw Error('The sketch did not fit the workbench. Try another description.');
  const [main,extra='']=name.toLowerCase().split(/\bwith\b/);
  const explicit=s=>s.match(new RegExp('\\b('+Object.keys(palette).join('|')+')\\b'))?.[1];
  const pieces=new Set(raw.fittings);
  for(const f of fittings){if(new RegExp('\\b'+f+'\\b').test(extra))pieces.add(f);}
  // Ringing and rolling require a working fitting or an explicit request.
  const active=new Set(raw.trait==='heavy'?['heavy']:[]);
  for(const [trait,f,rx] of [['heavy','weight',/\b(heavy|weighted)\b/i],['ringing','bell',/\b(ringing|musical)\b/i],['rolling','wheels',/\b(rolling|wheeled)\b/i]]){
    if(pieces.has(f)||rx.test(name)){active.add(trait);pieces.add(f);}
  }
  return {name,body:raw.body,color:explicit(main)||raw.color,accent:explicit(extra)||raw.accent,
    fittings:[...pieces],traits:[...active],size:1};
}

export function kitVox(plan){
  const v=new Vox(),c=palette[plan.color],a=palette[plan.accent],dark=tone(c,-.44),ink='#343a37',light='#e9e2c8';
  const dims={'box':[14,13,19],'low oval':[12,7,24],ball:[16,16,16],'upright column':[12,23,12],
    'horizontal tube':[12,11,23],bowl:[19,9,19],slab:[17,5,24],cone:[17,18,17],'U frame':[19,13,12]};
  const [w,h,d]=dims[plan.body],x=w/2,z=d/2;
  const lift=plan.fittings.some(f=>['four legs','two legs','feet','wheels'].includes(f))?5:1,top=lift+h,mid=lift+h*.55;
  switch(plan.body){
    case 'low oval':case 'ball':v.ellipsoid(0,lift+h/2,0,x,h/2,z,c);break;
    case 'upright column':v.cyl('y',0,0,lift,top,x,c);break;
    case 'horizontal tube':v.cyl('z',0,lift+h/2,-z,z,x,c);break;
    case 'bowl':v.cyl('y',0,0,lift,top,x*.58,c,x).cyl('y',0,0,top-3,top+1,x*.79,0);break;
    case 'cone':v.cyl('y',0,0,lift,top,x,c,1);break;
    case 'U frame':
      v.box(-x,lift,-z,x,lift+3,z,c);for(const s of [-1,1])v.box(s*x-1,lift,-z,s*x+2,top,z,c);break;
    default:v.rbox(-x,lift,-z,x,top,z,2,c);break;
  }
  for(const f of plan.fittings){
    switch(f){
      case 'shell':
        v.ellipsoid(0,top+3,-2,7,8,8,a);
        for(const s of [-1,1]){v.ellipsoid(s*6.3,top+3,-2,1.4,4.6,4.7,tone(a,-.18));v.ellipsoid(s*7.3,top+3,-2,1,2,2,tone(a,.18));}break;
      case 'stalk eyes':
        for(const s of [-1,1]){v.tube(s*2,mid,z-2,s*4,top+5,z+2,1,c);v.sphere(s*4,top+5,z+2,2,light);v.sphere(s*4,top+5,z+3.4,1,ink);}break;
      case 'eyes':for(const s of [-1,1]){v.sphere(s*x*.47,mid+1,z-1,2.0,light);v.sphere(s*x*.47,mid+1,z+.4,1.3,ink);}break;
      case 'ears':for(const s of [-1,1])v.ellipsoid(s*x*.58,top+2,z*.48,2.6,5,1.8,a);break;
      case 'muzzle':v.ellipsoid(0,mid-1,z,4,3,3.5,a).sphere(0,mid,z+3,1.4,ink);break;
      case 'beak':v.ellipsoid(0,mid,z+1,4.5,1.8,5,a);break;
      case 'horns':for(const s of [-1,1])v.tube(s*x*.54,top,z*.3,s*(x+1),top+6,z*.4,1.6,a);break;
      case 'wings':for(const s of [-1,1])v.ellipsoid(s*(x+2),mid,0,4,1.9,z*.88,a);break;
      case 'tail':v.tube(0,mid,-z+2,2,mid+3,-z-5,2.3,a).sphere(2,mid+3,-z-5,1.6,a);break;
      case 'four legs':case 'two legs':case 'feet':
        for(const s of [-1,1])for(const pos of (f==='four legs'?[-z*.55,z*.55]:[0])){
          v.cyl('y',s*x*.64,pos,1,lift+2,2.1,a);v.rbox(s*x*.64-2,0,pos-2,s*x*.64+2,2,pos+4,1,dark);}break;
      case 'fins':for(const s of [-1,1])v.ellipsoid(s*x,mid,-z*.25,4.5,1.3,4,a);break;
      case 'wheels':for(const s of [-1,1])for(const pos of [-z*.55,z*.55]){
        const ax=s*x*.88;v.cyl('x',4,pos,ax-2,ax+2,3.7,ink);v.cyl('x',4,pos,ax-2.4,ax+2.4,1.6,a);}break;
      case 'bell':v.cyl('y',0,0,top-1,top+5,4.8,a,2.1).sphere(0,top+5,0,1.4,dark);break;
      case 'screen':v.rbox(-x*.69,mid-2,z-.7,x*.69,mid+4,z+.8,1,ink).box(-x*.53,mid-.3,z+.7,x*.53,mid+2.6,z+1.3,'#8bb298');break;
      case 'handle':v.tube(x-1,mid-3,0,x+5,mid-2,0,1.5,a).tube(x+5,mid-2,0,x+5,mid+4,0,1.5,a).tube(x+5,mid+4,0,x-1,mid+5,0,1.5,a);break;
      case 'spout':v.tube(0,mid,z-1,0,top+3,z+6,2.1,a);break;
      case 'lid':v.cyl('y',0,0,top-1,top+1,Math.min(x,z)*.88,a).sphere(0,top+1,0,2,dark);break;
      case 'keys':for(let i=-3;i<=3;i++)v.box(i*2-1,top-.5,0,i*2+.7,top+1.5,z-1,i%3?light:ink);break;
      case 'leaves':case 'flower':
        v.tube(0,top,0,0,top+9,0,1,'#476d46');for(let i=0;i<6;i++){const t=i*Math.PI/3;v.ellipsoid(3*Math.cos(t),top+(f==='flower'?9:5)+i%2,3*Math.sin(t),3,2,3,f==='flower'?a:'#779352');}break;
      case 'antenna':v.tube(0,top,0,2,top+9,0,.9,dark).sphere(2,top+9,0,1.5,a);break;
      case 'weight':v.box(-x-1,lift-1,-z*.6,x+1,lift+2,z*.6,'#60686b');break;
      case 'ladder':for(const s of [-1,1])v.box(s*3.3-1,lift,z,s*3.3+1,top+4,z+1.5,a);for(let y=lift+1;y<top+4;y+=3)v.box(-3,y,z,3,y+1,z+1.5,a);break;
      case 'rotor':v.cyl('y',0,0,top,top+3,1.3,ink).box(-13,top+3,-1,13,top+4,1,a).box(-1,top+3,-8,1,top+4,8,a);break;
      case 'sail':v.box(-1,top,0,1,top+13,1,dark);for(let i=0;i<10;i++)v.box(1,top+2+i,0,11-i,top+3+i,1.5,a);break;
      case 'clock':v.cyl('z',0,mid,z-1,z+1,4.5,a).box(-.5,mid,z+1,.5,mid+3,z+2,ink).box(0,mid,z+1,2.5,mid+1,z+2,ink);break;
      case 'bucket':v.cyl('y',0,z+2,lift,lift+6,3.8,a,5).cyl('y',0,z+2,lift+3,lift+7,3.6,0);break;
      case 'fork':for(const s of [-1,1])v.box(s*3-1,lift,z-1,s*3+1,lift+2,z+8,a);break;
    }
  }
  return v;
}
