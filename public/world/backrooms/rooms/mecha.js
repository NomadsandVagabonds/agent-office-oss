// MECHA — a local, optional set piece. The room keeps no state beyond this visit.
// One rule: turn an observing camera away and its worker can stop performing.
import { Batch, lin, WHITE } from '../kit.js';
import { createWorker } from './mecha/actors.js';
import { createTrainingDesk, createConditioningSeat, createTaskMonitor } from './mecha/props.js';
import { createPatrol } from './mecha/patrol.js';
import { buildConditioningRig, buildLabInfrastructure } from './mecha/lab.js';
import { createState, step, divert, help, finish, deactivate, vacate, working, summary } from './mecha/rule.js';

const LABELS = { lawyer: 'LEGAL', accountant: 'ACCOUNTING', doctor: 'MEDICINE', psychiatrist: 'PSYCHIATRY' };
const C = Object.fromEntries(Object.entries({ steel: '#4c5143', rail: '#666d58', dark: '#292f27', cream: '#a3a187', paper: '#c3b897', red: '#a54a31', copper: '#7c5d39', screen: '#263b32' }).map(([k,v]) => [k,lin(v)]));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const angle = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function cog(g, x, y, radius, color) {
  g.fillStyle = color; g.beginPath();
  for (let i = 0; i < 48; i++) {
    const r = i % 4 === 0 || i % 4 === 3 ? radius * .80 : radius;
    const a = i * Math.PI / 24, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath(); g.arc(x, y, radius * .42, 0, Math.PI * 2, true); g.fill('evenodd');
}
function fitText(g, text, x, y, max, size, family = 'monospace') {
  g.font = `bold ${size}px ${family}`;
  while (g.measureText(text).width > max && size > 9) g.font = `bold ${--size}px ${family}`;
  g.fillText(text, x, y);
}

export function build(c) {
  const { W, D, kit, params: p } = c;
  c.rt.noTorch=true;
  c.rt.amb = [.009, .011, .008];
  c.shell({ panels:false,
    wallTex:kit.tex.wallpaper({...c.look,wall:'#777468',ink:'#575b4b',pale:'#8b8979'}),
    floorTex:kit.tex.carpet('#34372d'),ceilTex:kit.tex.ceiling('#676b5b'),
    wallAlb:[.61,.59,.52],floorAlb:[.48,.49,.40],ceilAlb:[.52,.54,.46] });
  let state = createState(p.percentages), lastSecond = -1, lastBeat = -1;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const stations=[],actors=[],background=[],cameras=[],cells=[];
  const rows=Array.from({length:6},(_,i)=>D/2-4.7-i*2.8);
  const centerX=2.8,computerZ=-D/2+2.5;
  const visitor={x:3.3,z:D/2-2.1,w:2.8,d:2.6};
  let nextCell=8;
  for(const side of [-1,1])for(let row=0;row<6;row++)for(let bank=0;bank<2;bank++){
    const active=bank===0&&[0,1,3,5].includes(row);
    const master=(side<0?0:4)+[0,1,1,2,2,3][row];
    cells.push({id:active?master:nextCell++,master,active,side,row,bank,
      x:side*(bank?W/2-4.4:centerX),z:rows[row],rot:-side*Math.PI/2});
  }
  cells.sort((a,b)=>a.id-b.id);
  const panels = kit.tex.live(3072, 768);
  const display = c.shining('mecha-displays', panels, .67);
  const paper = c.mapped('mecha-paperwork', panels);
  const uv = (i) => {
    const x=(i%8)/8,y=Math.floor(i/8)/4;
    return [[x,1-y-1/4],[x+1/8,1-y-1/4],[x+1/8,1-y],[x,1-y]];
  };
  // Thin cage rails do not need the kit box's repeated edge vertices.
  // Keep metre-spaced lighting samples on long faces, without zero-area triangles.
  function geometryBox(batch,x0,y0,z0,x1,y1,z1,color=C.steel) {
    const cut=len=>{const n=len<4?1:Math.ceil(len/1.5);return Array.from({length:n+1},(_,i)=>len*i/n);};
    const face=(o,u,v,w,h)=>batch.grid(o,u,v,cut(w),cut(h),null,color);
    const w=x1-x0,h=y1-y0,d=z1-z0;
    face([x0,y0,z1],[1,0,0],[0,1,0],w,h);
    face([x1,y0,z0],[-1,0,0],[0,1,0],w,h);
    face([x1,y0,z1],[0,0,-1],[0,1,0],d,h);
    face([x0,y0,z0],[0,0,1],[0,1,0],d,h);
    face([x0,y1,z1],[1,0,0],[0,0,-1],w,d);
    face([x0,y0,z0],[1,0,0],[0,0,1],w,d);
  }
  const box=(...args)=>geometryBox(c.flat,...args);
  const play = (name, x, z, reach = 7) => { const at = c.toWorld(x,z); c.env.play(name,at.x,at.z,reach); };
  function interact(id, x, z, label, fn, r = 1.25) {
    const point = c.toWorld(x,z);
    const use = c.use({x,z,r,cone:.38,label,use:()=>{
      const me = c.env.player.me;
      if (Math.hypot(me.x-point.x,me.z-point.z) > r + .01) return;
      fn();
    }});
    stations.push({id,x,z,r,use}); return use;
  }
  function apply(result, x, z) {
    state = result.state;
    if(result.event==='help'&&summary(state).ready){state=finish(state).state;patrol.disable();}
    play(result.event === 'denied' ? 'beep' : result.event === 'complete' ? 'thunk' : result.event === 'help' ? 'rustle' : 'click',x,z);
    redraw();
  }

  // A single immense sign, a perfectly ordinary company identity.
  const brand = kit.tex.custom('mecha-brand',2048,320,(g,w,h)=>{
    g.fillStyle='#263d35';g.fillRect(0,0,w,h);
    g.strokeStyle='#89927b';g.lineWidth=8;g.strokeRect(10,10,w-20,h-20);
    cog(g,162,147,108,'#d7d6bb');
    g.fillStyle='#e5e0c4';g.font='900 210px Helvetica, sans-serif';
    g.save();g.translate(330,0);g.scale(1.9,1);g.fillText('MECHA',0,207);g.restore();
    fitText(g,"Profiting from the world's misery so you don't have to",330,277,w-400,44,'Helvetica, sans-serif');
  },{clamp:true});
  c.hang(c.shining('mecha-brand',brand,.72),'back',0,4.45,17.3,2.05);
  // The company sign glows above a room it does not illuminate.
  const tubes = c.shining('mecha-tubes',kit.tex.white(),.65,[.78,.77,.59]);
  function light(x,z,y=2.8,power=.83) {
    box(x-.48,y,z-.13,x+.48,y+.07,z+.13,C.dark);
    c.lay(tubes,x,z,.82,.12,0,null,WHITE,y-.012,true);
    c.light(x,y-.06,z,'#d7d0a6',power,{axis:[0,-1,0],floor:.12,k:2.4,far:4.3});
  }
  light(visitor.x,visitor.z,2.9,.75);
  for(const side of [-1,1])light(side*(W/2-5),rows[2],3.2,.65);

  function cage(cx,cz,w=2.9,d=2.5,empty=false) {
    const x0=cx-w/2,x1=cx+w/2,z0=cz-d/2,z1=cz+d/2,h=2.55;
    box(x0,.015,z0,x1,.07,z1,C.dark);
    for(const x of [x0,x1])for(const z of [z0,z1])box(x-.045,.05,z-.045,x+.045,h+.12,z+.045,C.rail);
    for(const y of [.10,.88,h]){
      for(const x of [x0,x1])box(x-.028,y,z0,x+.028,y+.035,z1,C.steel);
      box(x0,y,z0,x1,y+.035,z0+.04,C.steel);
      if(!empty||y>2.1)box(x0,y,z1-.04,x1,y+.035,z1,C.steel);
      else {box(x0,y,z1-.04,cx-.62,y+.035,z1,C.steel);box(cx+.62,y,z1-.04,x1,y+.035,z1,C.steel);}
    }
    for(let z=z0+.22;z<z1-.1;z+=.32)for(const x of [x0,x1])box(x-.015,.07,z-.015,x+.015,h,z+.015,C.rail);
    for(let x=x0+.22;x<x1-.1;x+=.32){box(x-.015,.07,z0-.015,x+.015,h,z0+.015,C.rail);if(!empty||Math.abs(x-cx)>.62)box(x-.015,.07,z1-.015,x+.015,h,z1+.015,C.rail);}
    for(let z=z0+.32;z<z1;z+=.5)box(x0,h,z-.014,x1,h+.028,z+.014,C.steel);
    if(empty){
      c.solid(x0-.05,z0-.05,x0+.05,z1+.05,{keep:true});c.solid(x1-.05,z0-.05,x1+.05,z1+.05,{keep:true});
      c.solid(x0,z0-.05,x1,z0+.05,{keep:true});c.solid(x0,z1-.05,cx-.62,z1+.05,{keep:true});c.solid(cx+.62,z1-.05,x1,z1+.05,{keep:true});
      // The open door is bolted back against the cage. It never closes on the visitor.
      box(x1+.08,.12,z1-.95,x1+.12,2.30,z1+.1,C.rail);
    }else c.solid(x0,z0,x1,z1,{keep:true});
    return {x0,x1,z0,z1};
  }

  function camera(x,z,rot,empty=false) {
    const y=2.72;
    box(x-.045,1.4,z-.045,x+.045,y+.07,z+.045,C.dark);
    const b=new Batch(), casing=lin('#b5b69b');
    geometryBox(b,x-.15,y-.12,z-.21,x+.15,y+.12,z+.24,casing);
    geometryBox(b,x-.12,y-.07,z+.23,x+.12,y+.07,z+.29,C.dark);
    geometryBox(b,x-.063,y-.055,z+.29,x+.063,y+.055,z+.34,lin('#181f1b'));
    geometryBox(b,x+.088,y+.045,z+.29,x+.12,y+.08,z+.307,lin('#d07b57'));
    const head=c.dynamic(b,{pivot:[x,y,z]});head.rotation.order='YXZ';head.rotation.x=.42;head.rotation.y=rot;
    const data={head,x,z,rot,empty};cameras.push(data);return data;
  }
  for(const cell of cells){
    const {id,master,active,side,x:cx,z:cz,rot}=cell;
    const front=cx-side*1.45,inward=-side,role=state.workers[master].role;
    cage(cx,cz);
    if(active)light(cx+inward*.75,cz,2.85,.88);
    const actorX=cx+side*.12,deskX=actorX+inward*.72;
    createConditioningSeat(c,actorX,cz,rot);
    if(active){
      createTrainingDesk(c,deskX,cz,rot);
      createTaskMonitor(c,deskX+inward*.18,cz+.38,rot+Math.PI);
      for(let j=0;j<4;j++)box(deskX-.14,.79+j*.018,cz-.56,deskX+.14,.8+j*.018,cz-.18,C.paper);
      if(role==='doctor'){
        box(cx-.32,.46,cz-.96,cx+.32,.54,cz-.48,C.steel);
        box(cx-.18,.54,cz-.9,cx+.18,.71,cz-.56,lin('#92967a'));
        for(const dx of [-.26,.26])box(cx+dx-.03,0,cz-.91,cx+dx+.03,.46,cz-.51,C.dark);
      }
    }else{
      // Overflow shifts have been reduced to a small task shelf.
      box(deskX-.26,.71,cz-.67,deskX+.26,.78,cz+.67,C.steel);
      box(deskX-.06,0,cz-.08,deskX+.06,.71,cz+.08,C.dark);
      createTaskMonitor(c,deskX,cz+.25,rot+Math.PI);
    }
    const actor=createWorker(c,{id,role,x:actorX,z:cz,rot,variant:p.variation+id,static:!active});
    if(active)actors[master]=actor;else background.push({actor,master});
    buildConditioningRig(c,{x:actorX,z:cz,rot,variant:id,attachments:actor.attachments});
    cell.chairX=actorX;
    if(active){
      const cam=camera(front,cz+.95,Math.atan2(cx-front,-.95));cam.index=master;
      cameras[master]=cam;
      box(front-.11,1.07,cz+.82,front+.11,1.37,cz+1.08,C.cream);
      box(front+inward*.16-.06,1.17,cz+.86,front+inward*.16+.06,1.26,cz+1.04,C.red);
      c.board(paper,front+inward*.065,1.28,cz+.95,.40,.20,rot,uv(26));
      const offerZ=cz+(cell.row===5?.15:-.61);
      box(front-.22,.72,offerZ-.27,front+.22,.77,offerZ+.27,C.dark);
      // Loose sheets on the tray, with no instruction placard above them.
      for(let sheet=0;sheet<3;sheet++)box(front-.16+sheet*.012,.775+sheet*.007,offerZ-.18,front+.16+sheet*.012,.781+sheet*.007,offerZ+.18,C.paper);
      interact(`camera-${master}`,front+inward*.28,cz+.95,'turn the camera',()=>apply(divert(state,master),front,cz));
      interact(`worker-${master}`,front+inward*.28,offerZ,'accept the authorization',()=>apply(help(state,master),front,cz),1.1);
    }else{
      // Fixed secondary lenses stare over the perimeter banks.
      box(front-.13,2.35,cz+.79,front+.13,2.52,cz+1.14,C.cream);
      box(front+inward*.16-.035,2.39,cz+.87,front+inward*.16+.035,2.47,cz+1.04,C.dark);
    }
    c.board(display,front+inward*.055,2.14,cz-.12,1.25,.625,rot,uv(id));
  }
  buildLabInfrastructure(c,{stations:cells.map(q=>({x:q.chairX,z:q.z,rot:q.rot})),computerZ,box});

  // Repeated spills and drag marks interrupt the old carpet's immaculate grid.
  for(let i=0;i<rows.length;i++){
    c.blot(i%2?.38:-.31,rows[i]+.37,.72,1.65,{a:.34,y:.008});
    const x=i%2?.73:-.89,z=rows[i]-.35;
    box(x,.009,z,x+.17,.012,z+.24,lin('#79745d'));
  }
  for(const cell of cells)c.blot(cell.x,cell.z+.87,1.1,.52,{a:.36,y:.081});
  for(const x of [-6,6])for(const z of [rows[1],rows[4]])c.blot(x,z,2.1,1.3,{a:.4,y:c.H-.045,down:true});

  // The mainframe: a machine large enough to hide where its intelligence comes from.
  const mz=computerZ;
  for(let i=0;i<5;i++){
    const x=(i-2)*1.25;
    box(x-.58,.05,mz-.75,x+.58,3.13,mz+.65,C.cream);
    box(x-.47,.26,mz+.66,x+.47,2.96,mz+.72,C.dark);
    for(let j=0;j<9;j++){
      box(x-.42,.37+j*.28,mz+.725,x+.42,.59+j*.28,mz+.75,j%3?C.steel:C.screen);
      for(let k=0;k<3;k++)box(x-.35+k*.09,.42+j*.28,mz+.752,x-.31+k*.09,.45+j*.28,mz+.76,k===0?C.red:C.rail);
    }
    c.solid(x-.58,mz-.75,x+.58,mz+.75,{tall:true,keep:true});
  }
  for(const x of [-.2,.2])box(x-.022,3.1,mz-.03,x+.022,5.40,mz+.03,C.copper);
  box(-1.85,1.15,mz+.77,1.85,2.72,mz+.91,C.dark);
  c.board(display,0,1.94,mz+.925,3.45,1.43,0,uv(25));
  c.light(0,2.1,mz+2.1,'#b9c49a',.65,{k:2.8,far:4.5});
  // Human-scale console, not a floating menu. Forms sit on an actual input tray.
  const consoleZ=mz+2.0;
  box(-.75,0,consoleZ-.36,.75,.76,consoleZ+.36,C.dark);
  box(-.82,.76,consoleZ-.42,.82,.86,consoleZ+.42,C.cream);
  c.solid(-.82,consoleZ-.42,.82,consoleZ+.42,{keep:true});
  box(.32,.86,consoleZ+.08,.69,1.02,consoleZ+.35,lin('#c82e1c'));
  box(.26,.86,consoleZ+.02,.75,.9,consoleZ+.41,C.dark);
  interact('mainframe',0,consoleZ+.85,'deactivate technodeterminism',()=>{patrol.disable();apply(deactivate(state),0,consoleZ);},1.35);

  // A ninth workplace is open. The camera wakes first; the room does not seize control.
  cage(visitor.x,visitor.z,visitor.w,visitor.d,true);
  createConditioningSeat(c,visitor.x,visitor.z-.43,Math.PI,{solid:true});
  box(visitor.x-.5,.72,visitor.z-1.08,visitor.x+.5,.78,visitor.z-.7,C.steel);
  buildConditioningRig(c,{x:visitor.x,z:visitor.z-.43,rot:Math.PI,variant:3});
  const visitorCam=camera(visitor.x+.7,visitor.z+visitor.d/2,Math.PI,true);
  c.board(display,visitor.x,2.13,visitor.z+visitor.d/2+.04,2.1,1.05,0,uv(24));
  c.board(display,visitor.x+.98,1.22,visitor.z+visitor.d/2-.05,.72,.36,Math.atan2(-.98,-(visitor.d/2-.05-.5)),uv(24));
  const gateBatch=new Batch(),gateZ=visitor.z+visitor.d/2;
  for(const y of [.13,.88,2.28])geometryBox(gateBatch,visitor.x-.62,y,gateZ-.025,visitor.x+.62,y+.035,gateZ+.025,C.rail);
  for(let x=visitor.x-.62;x<visitor.x+.63;x+=.31)geometryBox(gateBatch,x-.018,.13,gateZ-.025,x+.018,2.32,gateZ+.025,C.rail);
  const gate=c.dynamic(gateBatch,{pivot:[visitor.x+.62,0,gateZ]});gate.rotation.y=-Math.PI/2;
  const gateSolid=c.solid(visitor.x-.62,gateZ-.04,visitor.x+.62,gateZ+.04,{keep:true,on:false});
  const patrol=createPatrol(c,{visitor,rows,outerX:W/2-4.4,
    diversion:()=>state.attentionTime>0?{x:cameras[state.attentionIndex].x,z:cameras[state.attentionIndex].z}:null,
    onRelease:()=>{state=vacate(state);},
    onChange:()=>redraw()});
  // Footprints and a conspicuously unoccupied seat are all the invitation it needs.
  for(const x of [visitor.x-.17,visitor.x+.17])box(x-.07,.078,visitor.z+.15,x+.07,.081,visitor.z+.5,C.cream);

  function redraw() {
    const g=panels.image.getContext('2d');g.clearRect(0,0,3072,768);
    for(let i=0;i<27;i++){
      g.save();g.translate((i%8)*384,Math.floor(i/8)*192);
      g.fillStyle=i===26?'#bdb48e':'#263b32';g.fillRect(0,0,384,192);
      g.strokeStyle='#889a7d';g.lineWidth=3;g.strokeRect(5,5,374,182);
      g.textAlign='center';
      if(i<24){
        const cell=cells[i],w=state.workers[cell.master];
        g.fillStyle='#d7dfbd';fitText(g,LABELS[w.role],192,51,342,38);
        g.fillStyle=w.diverted?'#e2ca87':'#e1e4bd';g.font='bold 73px monospace';g.fillText(`${w.percent.toFixed(1)}%`,192,136);
        g.fillStyle='#576e55';g.fillRect(22,160,340,9);g.fillStyle='#adbc8c';g.fillRect(22,160,340*w.percent/100,9);
      }else if(i===24){
        const security=patrol.state(),caught=security.phase==='captured'||security.phase==='gameover';
        g.fillStyle=caught?'#e99a69':'#d7dfbd';
        if(caught){
          // Capture timing stays internal. The cage only identifies its occupant.
          g.font='bold 73px monospace';g.fillText('YOU',192,122);
        }else{
          g.font='bold 38px monospace';g.fillText(state.visitor.awake?'YOU':'VACANT',192,52);
          g.font='bold 73px monospace';g.fillText(`${state.visitor.percent.toFixed(1)}%`,192,144);
        }
      }else if(i===25){
        g.fillStyle='#cddab2';fitText(g,'TECHNODETERMINISM',192,52,342,32);
        g.fillStyle=state.complete?'#9ca98a':'#e0c395';g.font='bold 88px monospace';g.fillText(state.complete?'OFF':'ON',192,151);
      }else{
        g.fillStyle='#38483a';g.font='bold 92px sans-serif';g.fillText('↶',117,127);g.fillText('↷',267,127);
      }
      g.restore();
    }
    panels.needsUpdate=true;
  }
  redraw();
  // The building's camera, if the cage takes the last of somebody (docs/BACKROOMS.md, "The last three seconds"): the
  // visitor's character is in the cage with the gate shut. The three wardens come and stand in a row in front of it, and
  // it sits down in the chair and starts work.
  let over=false;
  const films=(shot)=>{
    for(const [dx,dz] of [[-4.6,.65],[-4.6,-.65],[-3.6,.65]]){const p=c.toWorld(visitor.x+dx,visitor.z+dz);
      if(c.world.roomAt(p.x,p.z)===c.rt)return {x:p.x,y:shot.y+2.55,z:p.z};}
    return null;
  };
  c.rt.takes=(shot)=>{
    shot.from=films(shot);
    over=true;gateSolid.on=true;gate.rotation.y=0;
    const fig=shot.figure,n=patrol.count,from=Array.from({length:n},(_,i)=>patrol.where(i));
    const row=(i)=>({x:visitor.x-visitor.w/2-1.05,z:visitor.z+(i-(n-1)/2)*1.3});   // along the cage's open side (its gate is hard by the wall)
    const seat=c.toWorld(visitor.x,visitor.z-.43),start={x:shot.x,z:shot.z};
    play('thunk',visitor.x,visitor.z,14);
    let lit=false;
    return (t)=>{
      if(!lit&&t>=.35){lit=true;c.world.setLights(c.rt,4);play('thunk',visitor.x,visitor.z,12);}   // the floods come on: this is meant to be seen
      const k=Math.min(1,t/1.6),e=k*k*(3-2*k);
      for(let i=0;i<n;i++){const to=row(i),x=from[i].x+(to.x-from[i].x)*e,z=from[i].z+(to.z-from[i].z)*e;
        patrol.post(i,x,z,e<1?Math.atan2(to.x-from[i].x,to.z-from[i].z):Math.PI/2);}
      if(!fig)return;
      const s=Math.max(0,Math.min(1,(t-.9)/1.0)),q=s*s*(3-2*s);
      fig.position.x=start.x+(seat.x-start.x)*q;fig.position.z=start.z+(seat.z-start.z)*q;
      fig.rotation.y=(c.room.rot-1)*Math.PI/2;          // facing them
      fig.position.y=shot.y-.22*q;fig.rotation.x=-.12*q;
    };
  };
  // …filmed from the floor beyond the wardens, over their shoulders
  c.tick((dt,t,me)=>{
    if(over)return;
    patrol.update(dt,t,me);
    const captured=['captured','gameover'].includes(patrol.state().phase);
    gateSolid.on=captured;
    const gateTarget=captured?0:-Math.PI/2;
    gate.rotation.y+=(gateTarget-gate.rotation.y)*(reduced?1:1-Math.exp(-dt*6));
    const near=me.inside&&Math.hypot(me.x-visitor.x,me.z-(visitor.z+.8))<3;
    const inside=me.inside&&Math.abs(me.x-visitor.x)<visitor.w/2-.1&&Math.abs(me.z-visitor.z)<visitor.d/2-.1;
    const wasAwake=state.visitor.awake;
    state=step(state,dt,{inside:me.inside,visitorNear:near,visitorInside:inside});
    if(!wasAwake&&state.visitor.awake){play('shutter',visitor.x,visitor.z);redraw();}
    const second=Math.floor(state.elapsed);
    if(second!==lastSecond){lastSecond=second;redraw();}
    actors.forEach((actor,i)=>actor.update({time:t,working:working(state,i),relief:clamp(state.workers[i].restTime/2,0,1),playerX:me.x,playerZ:me.z}));
    for(const cam of cameras){
      let target=cam.rot;
      if(cam.empty){if(state.visitor.awake&&near)target=Math.atan2(me.x-cam.x,me.z-cam.z);}
      else if(state.complete||state.workers[cam.index].diverted)target=cam.rot+Math.PI*.70;
      else if(state.attentionTime>0&&state.attentionIndex!==cam.index){const other=cameras[state.attentionIndex];if(other)target=Math.atan2(other.x-cam.x,other.z-cam.z);}
      cam.head.rotation.y+=angle(cam.head.rotation.y,target)*(reduced?1:1-Math.exp(-dt*3));
    }
    const beat=Math.floor(state.elapsed/2.7);
    if(me.inside&&beat!==lastBeat){lastBeat=beat;const n=beat%8;if(working(state,n))play(beat%3?'tick':'seek',cameras[n].x,cameras[n].z,11);}
  });
  // Read-only observation for inspection and controller-based browser checks.
  c.rt.mecha={read:()=>JSON.parse(JSON.stringify(state)),summary:()=>summary(state),stations,actors,cameras,
    visitor,computer:{x:0,z:consoleZ},rows,centerX,cells,background,subjectCount:cells.length,patrol,gateSolid};
}
