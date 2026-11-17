// Review-only waterpark room. A second pool is suspended upside down; the
// far changing tunnel returns to the entrance until circulation is reversed.
import {finishPoolRoom} from '../pool-finish.js';
import { Batch, lin, WHITE } from '../kit.js';
import { poolPlan, poolFloor, poolState, stepPool, turnValve, RETURN_POOL } from './return-pool/rule.js';
import { poolTextures, tiledPlane, waterMesh, officeDesk, valveVox, wakeRig } from './return-pool/art.js';
import { dressPool } from './return-pool/dressing.js';
import { roomReturn } from '../room-physics.js';

export function build(c) {
  const { W, D, H, rt, env, kit } = c, p = poolPlan(c.room), s = poolState(), tex = poolTextures(kit);
  rt.amb = lin('#91b9a1', .24); rt.level = .38;
  c.shell({ floor: false, panels: false, sockets: false });
  const ivory = c.mapped('return:ivory', tex.tile), deep = c.mapped('return:deep', tex.deep);
  const trim = lin('#335d52'), metal = lin('#849b88'), cream = lin('#d3d5b4');
  const box = (b, x0,y0,z0,x1,y1,z1, color = WHITE) => b.box(x0,y0,z0,x1,y1,z1,color,{step:.5,uv:1.6});
  const ground = (x0,z0,x1,z1,y=0,b=ivory) => tiledPlane(b,x0,z0,x1,z1,y);
  const ring = (half,end,innerHalf,innerEnd,y) => {
    ground(-half,-end,half,-innerEnd,y); ground(-half,innerEnd,half,end,y);
    ground(-half,-innerEnd,-innerHalf,innerEnd,y); ground(innerHalf,-innerEnd,half,innerEnd,y);
  };
  ground(-W/2,-D/2,W/2,-p.end); ground(-W/2,p.end,W/2,D/2);
  ground(-W/2,-p.end,-p.half,p.end); ground(p.half,-p.end,W/2,p.end);
  for (let i = 0; i < 4; i++) {
    const half = p.half - i*.32, end = p.end - i*.32, y = -(i+1)*.15;
    ring(half,end,half-.32,end-.32,y);
    box(deep,-half,y,-end,-half+.015,y+.15,end); box(deep,half-.015,y,-end,half,y+.15,end);
    box(deep,-half,y,-end,half,y+.15,-end+.015); box(deep,-half,y,end-.015,half,y+.15,end);
  }
  ground(-p.half+1.28,-p.end+1.28,p.half-1.28,p.end-1.28,-.6,deep);
  rt.floorY = (x,z) => poolFloor(p,x,z);
  // A square inspection plinth, stepped on every side. It is refuge, not an
  // invisible collision box masquerading as water.
  for (let i=3;i>=0;i--) {
    const half=p.island.half+i*.32, y=-i*.15;
    box(ivory,-half,y-.15,p.island.z-half,half,y,p.island.z+half);
  }
  for (const side of ['left','right']) {
    c.hang(ivory,side,0,.66,D,1.32,[[0,0],[D/1.6,0],[D/1.6,.8],[0,.8]],WHITE,.014);
    c.wbox(side,0,D,1.32,1.4,.014,.035,trim);
  }
  // Floor lane stripes continue across the island, as if it was tiled over
  // without anybody stopping the race.
  for(const x of [-1.15,1.15]) {
    box(c.flat,x-.055,-.594,-p.end+1.3,x+.055,-.588,p.end-1.3,trim);
    box(c.flat,x-.35,-.587,-p.end+1.5,x+.35,-.58,-p.end+1.6,trim);
  }
  const lowerWater = waterMesh(c,tex.water,-p.half,-p.end,p.half,p.end,-.075);

  // A pool built on the wrong face of the ceiling. Its tiled bottom, lane
  // marks and submerged workstations are all actually above the water.
  const roofHalf=2.75, roofEnd=p.end-.65;
  tiledPlane(deep,-roofHalf,-roofEnd,roofHalf,roofEnd,H-.12,true);
  for(const x of [-roofHalf,roofHalf]) box(ivory,x-.12,p.roof-.13,-roofEnd-.15,x+.12,H-.1,roofEnd+.15);
  for(const z of [-roofEnd,roofEnd]) box(ivory,-roofHalf-.12,p.roof-.13,z-.12,roofHalf+.12,H-.1,z+.12);
  for(const x of [-1.15,1.15]) box(c.flat,x-.07,H-.15,-roofEnd,x+.07,H-.13,roofEnd,trim);
  const upperWater = waterMesh(c,tex.water,-roofHalf,-roofEnd,roofHalf,roofEnd,p.roof,true);
  for(const [x,z,rot] of [[-1.2,-3.5,.15],[1.1,.2,-.2],[-1.3,3.5,.45]]) {
    officeDesk(c,x,z,-.6,false,rot);
    officeDesk(c,-x,z,H-.15,true,-rot);
  }
  // Wet carpet and an ordinary office waiting area make the tiled annex feel
  // attached to the building instead of a separate swimming-pool game.
  const carpet=c.mapped('return:carpet',kit.tex.floor(c.look));
  ground(-W/2+.08,D/2-2,W/2-.08,D/2-.06,.006,carpet);
  c.prop('chair',-W/2+.9,D/2-1.2,{rot:.2, fallback:[.55,.9,.55]});
  c.prop('chair',-W/2+1.7,D/2-1.2,{rot:-.2,fallback:[.55,.9,.55]});
  c.prop('cooler',-W/2+.7,D/2-2.6,{fallback:[.45,1.2,.45]});
  for(const z of [-4,0,4]) {
    // Abandoned cubicle partitions project from the water; none block the
    // central valve or the stepped rim.
    box(c.flat,-1.95,-.59,z-.65,-1.9,.32,z+.65,lin('#778f7c'));
    box(c.flat,-1.98,.32,z-.67,-1.87,.37,z+.67,metal);
  }

  // Two identical narrow changing tunnels, with an opaque tiled ceiling at
  // eye level. The actual return happens inside the second one.
  const x=p.fold.x, half=.96, wallZ=-D/2+3.45;
  for(const [a,b] of [[-W/2,x-half-.12],[x+half+.12,W/2]]) {
    box(ivory,a,0,wallZ,b,H,wallZ+.16); c.solid(a,wallZ,b,wallZ+.16,{tall:true,keep:true});
  }
  const tunnel = (start,end) => {
    for(const side of [-1,1]) {
      box(deep,x+side*half-.08,0,start,x+side*half+.08,2.25,end);
      c.solid(x+side*half-.08,start,x+side*half+.08,end,{tall:true,keep:true});
    }
    box(deep,x-half,2.15,start,x+half,2.3,end);
    for(const z of [start+.1,end-.1]) box(c.flat,x-half,2.07,z-.035,x+half,2.15,z+.035,cream);
    const label=c.mapped('return:tunnel-sign',tex.sign('return','RETURN'));
    c.board(label,x,2.57,end+.025,1.55,.38);
    const l=c.toWorld(x,end); return l;
  };
  tunnel(p.fold.z-.55,wallZ+.55);
  tunnel(p.fold.toZ-.75,p.fold.toZ+1.15);
  rt.headY=(xx,z)=>Math.abs(xx-x)<half && ((z>p.fold.z-.55&&z<wallZ+.55)||(z>p.fold.toZ-.75&&z<p.fold.toZ+1.15))?2.15:H;
  // Short showers hide the fold visually. Narrow staggered strips leave a
  // clear passage: these are water, never physical barriers.
  const curtains=[];
  for(const z of [p.fold.z+.06,p.fold.toZ+.06]) {
    const b=new Batch();
    for(let i=0;i<12;i++)box(b,x-half+i*.16,0,z,x-half+i*.16+.028,2.05,z+.018,lin('#8fb5a1'));
    const g=c.dynamic(b); curtains.push(g);
  }
  // Repeated lane numbers are the first clue that the far end is the same
  // end. The only explanatory text is on the actual pump casting.
  const digits=c.mapped('return:depth',tex.sign('depth','1.20 m'));
  for(const z of [-p.end,p.end]) c.board(digits,-3.55,.2,z,1.1,.3,z<0?0:Math.PI);
  c.hang(c.mapped('return:pump-label',tex.sign('pump','CIRCULATION')),'left',-1.9,1.95,2.2,.45);

  // The valve emerges from the flooded workstations. Three visible notches;
  // every crank moves the wheel, the gauge and the water's direction.
  box(c.flat,p.valve.x-.13,-.6,p.valve.z-.12,p.valve.x+.13,.65,p.valve.z+.12,metal);
  const wheelBatch=new Batch(true);
  c.place(kit.model('return:valve',valveVox),p.valve.x,p.valve.z+.13,{y:.65,solid:false,shadow:false,batch:wheelBatch});
  const wheel=c.dynamic(wheelBatch,{pivot:[p.valve.x,.65,p.valve.z+.13]});
  const lamps=[];
  for(let i=0;i<3;i++) {
    const b=new Batch();box(b,p.valve.x-.2+i*.16,.92,p.valve.z-.02,p.valve.x-.1+i*.16,1.02,p.valve.z+.09,lin('#c0b58c'));
    const lamp=c.dynamic(b);lamps.push(lamp);
  }
  const valve=c.use({x:p.valve.x,z:p.valve.z+.35,r:1.1,label:'turn circulation valve',when:()=>s.turns<3&&s.crank===0,use:()=>{
    if(!turnValve(s))return;
    const w=c.toWorld(p.valve.x,p.valve.z);env.play?.('rattle',w.x,w.z,12);env.play?.('thunk',w.x,w.z,12);
    if(s.turns===3)env.interfere?.(.18);
  }});
  // One upward waterfall, made of stepped translucent threads and bubbles.
  // It reverses after the pump is corrected. No simulation, reflection pass,
  // shadow maps or per-frame geometry rebuilding.
  const up=new Batch();
  for(let i=0;i<9;i++)box(up,-2.25+i*.09,-.06,-3.5,-2.21+i*.09,p.roof,-3.46,lin(i%2?'#b4d7bc':'#6fa393'));
  const fall=c.dynamic(up); const bubbles=[];
  for(let i=0;i<12;i++){
    const b=new Batch();box(b,-.035,-.035,-.035,.035,.035,.035,cream);
    const g=c.dynamic(b);g.position.set(-2.22+(i%4)*.17,.1+i*.34,-3.38);bubbles.push(g);
  }
  // Fluorescent office lights are confined to the dry walkway. Below the
  // upper pool, the watery green light leaves deep pockets of shadow.
  const glowing=c.shining('return:lamps',kit.tex.panel(true),1.5,lin('#dde3bd'));
  for(const side of [-1,1])for(const z of [-6,-1,4,9]) {
    const lx=side*(W/2-1.35);
    box(c.flat,lx-.23,3.35,z-.65,lx+.23,3.45,z+.65,metal);
    c.lay(glowing,lx,z,.36,1.15,0,null,WHITE,3.34,true);
    c.light(lx,3.2,z,'#d4e0b0',.75,{far:5.5,k:.65});
    box(c.flat,lx-.015,3.4,z,lx+.015,H,z+.025,metal);
  }
  for(const z of [-4,2])c.light(0,1.8,z,'#75ba9a',.32,{far:4.5,k:.8});
  c.light(0,H-.4,0,'#a2d5b8',.9,{far:8,k:.5});
  c.light(x,1.8,p.fold.toZ,'#a8c5a7',.3,{far:2.3,k:.6});
  // Tubular stainless rails and lane floats, all slightly blocky.
  for(const side of [-1,1]) {
    for(const z of [-p.end,p.end])for(const offset of [-.28,.28])box(c.flat,side*2.65+offset-.025,-.42,z-.04,side*2.65+offset+.025,.62,z+.04,metal);
    for(let i=0;i<22;i++) {
      const z=-p.end+.4+i*(2*p.end-.8)/21;
      box(c.flat,side*2.5-.07,-.055,z-.1,side*2.5+.07,.025,z+.1,lin(i%4<2?'#c9ccae':'#6c9e89'));
    }
  }
  const carts=dressPool(c), wake=wakeRig(c);let waterTime=0, wheelTurn=0, bubblesTime=0;
  rt.footstep='wade';
  c.tick((dt,time,me)=>{
    stepPool(s,dt,me,p);
    const wet=me.inside&&poolFloor(p,me.x,me.z)<-.3;
    if(wet&&me.world)me.world.slow=Math.min(me.world.slow??1,.67);
    rt.footstep=wet?'wade':'stone';
    if(s.warp&&env.player) {
      const dest=roomReturn(c,s.warp.x,s.warp.z);
      // Preserve bearing, including rotated room placements. The tape skips;
      // it does not turn the visitor around or drop them from above.
      // A visitor may park a cart in the return tunnel. Never fold into it.
      if(dest) {
        env.player.warp(dest.x,dest.z,me.world?.yaw);
        env.interfere?.(.12);env.play?.('wade',dest.x,dest.z,6);
      }
    }
    if(s.warning){const at=c.toWorld(s.wake.x,s.wake.z);env.play?.('wade',at.x,at.z,10);}
    if(s.hit){const hit=c.hurt(1);if(hit.landed){env.interfere?.(.2);if(me.world)me.world.shake=Math.max(me.world.shake||0,.22);}}
    const direction=s.turns===3?-1:1;waterTime+=dt*direction;bubblesTime+=dt*direction;
    lowerWater.phase.value=waterTime;upperWater.phase.value=-waterTime*.75;
    wheelTurn+=(s.turns*Math.PI/2-wheelTurn)*(1-Math.exp(-dt*5));wheel.rotation.z=wheelTurn;
    lamps.forEach((g,i)=>{g.position.y=i<s.turns?.055:0;const m=g.userData.mesh?.material;if(m)m.uniforms.uTint.value.setScalar(i<s.turns?2.1:.4);});
    curtains.forEach(g=>g.scale.set(1,.98+Math.sin(time*2)*.02,1));fall.scale.x=1+Math.sin(time*1.5)*.035;
    bubbles.forEach((g,i)=>{g.position.y=.1+((i*.34+bubblesTime*.68)%(p.roof-.2)+(p.roof-.2))%(p.roof-.2);});
    wake.group.visible=s.phase==='warning'||s.phase==='hunting';wake.group.position.set(s.wake.x,-.045,s.wake.z);
    wake.rings.forEach((g,i)=>{const k=1+Math.sin(time*3-i)*.12;g.scale.set(k,1,k);g.rotation.y=time*.25*(i%2?1:-1);});
    wake.fins[0].visible=s.phase==='hunting';
    wake.fins[0].rotation.y=Math.atan2(me.x-s.wake.x,me.z-s.wake.z);
  });
  rt.returnPool={plan:p,get state(){return {...s,wake:{...s.wake}};},valve,carts};
  finishPoolRoom(c,'return-pool');
}
