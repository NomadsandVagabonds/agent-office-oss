// Three local wardens; their route graph respects every cage and room wall.
import { createGuard } from './guards.js';
import { createLabNavigation } from './navigation.js';
import { createSecurity, stepSecurity } from './security.js';

export function createPatrol(c,{visitor,rows,outerX,diversion=()=>null,onChange=()=>{}}){
  let security=createSecurity(),clock=0,entered=false;
  const nav=createLabNavigation(c),gap=(2.8+outerX)/2;
  const guards=[{x:0,z:rows[2],lane:0},{x:-gap,z:rows[0],lane:-gap},{x:gap,z:rows[3],lane:gap}].map((p,id)=>({
    ...p,id,yaw:id===1?Math.PI:0,model:createGuard(c,{id,x:p.x,z:p.z,variant:id}),
    end:id%2,route:[],repath:0,acquire:0,lastSeen:-100,seen:null,mode:'patrol',moving:false,
  }));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function thinClear(a,b){
    const n=Math.max(1,Math.ceil(distance(a,b)/.08));
    for(let i=0;i<=n;i++){const p=c.toWorld(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n);
      if(!c.world.free(p.x,p.z,.025,{ghost:true}))return false;}
    return true;
  }
  function capture(){
    security=stepSecurity(security,0,{caught:true});
    const p=c.toWorld(visitor.x,visitor.z+.5),player=c.env.player;
    player.warp(p.x,p.z,Math.atan2(-.98,-(visitor.d/2-.05-.5))+c.room.rot*Math.PI/2);
    player.me.vx=0;player.me.vz=0;player.me.pitch=.10;
    c.env.hold(true);c.env.interfere?.(.8);
    c.env.play('thunk',p.x,p.z,10);onChange(security);
  }
  function disable(){
    security=stepSecurity(security,0,{disable:true});
    c.env.hold(false);onChange(security);
  }
  function update(dt,t,me){
    if(me.inside&&!entered){entered=true;clock=0;}
    if(me.inside&&security.phase==='patrol'&&!me.world.frozen)clock+=dt;
    const before=security;
    security=stepSecurity(security,dt,{inside:me.inside});
    if(security.phase==='captured')c.env.hold(me.inside);
    if(security.phase==='gameover'&&before.phase!=='gameover'){
      onChange(security);c.env.end('caught');
    }
    for(const g of guards){
      g.moving=false;
      if(me.inside&&security.phase==='patrol'&&!me.world.frozen){
        const dx=me.x-g.x,dz=me.z-g.z,d=Math.hypot(dx,dz)||.001;
        const facing=(Math.sin(g.yaw)*dx+Math.cos(g.yaw)*dz)/d;
        const a=c.toWorld(g.x,g.z),b=c.toWorld(me.x,me.z);
        const distraction=diversion();
        const sees=clock>2.5&&!distraction&&d<7.8&&(facing>.1||d<1.55)&&c.world.los(a.x,a.z,b.x,b.z);
        g.acquire=sees?Math.min(1,g.acquire+dt):Math.max(0,g.acquire-dt*2);
        if(g.acquire>=.55){g.lastSeen=clock;g.seen={x:me.x,z:me.z};}
        const chase=clock-g.lastSeen<4.5;
        const mode=distraction?'distracted':chase?'chase':'patrol';
        if(mode!==g.mode){g.repath=0;g.mode=mode;if(mode==='chase')c.env.play('beep',a.x,a.z,8);}
        let target=distraction||chase&&g.seen||{x:g.lane,z:g.end?rows[5]:rows[0]+.35};
        if(!distraction&&!chase&&distance(g,target)<.4){g.end=1-g.end;target={x:g.lane,z:g.end?rows[5]:rows[0]+.35};g.repath=0;}
        g.repath-=dt;
        if(g.repath<=0){g.route=nav.route(g,target);g.repath=.65;}
        let left=dt*(chase?1.42:distraction?1.0:.72);
        while(left>0&&g.route.length){
          const next=g.route[0],dx=next.x-g.x,dz=next.z-g.z,d=Math.hypot(dx,dz);
          if(d<.035){g.route.shift();continue;}
          const step=Math.min(left,d),x=g.x+dx/d*step,z=g.z+dz/d*step;
          if(!nav.clear(g.x,g.z,x,z)){g.route=[];g.repath=0;break;}
          g.x=x;g.z=z;g.yaw=Math.atan2(dx,dz);g.moving=true;left-=step;
          if(step>=d-.001)g.route.shift();
        }
        if(clock>2.5&&distance(g,me)<.62&&thinClear(g,me)){capture();}
      }
      g.model.update({x:g.x,z:g.z,yaw:g.yaw,time:t,moving:g.moving,disabled:security.phase==='disabled'});
    }
  }
  // hold belongs only to this visit; leaving or disposing never freezes another floor.
  c.rt.onLeave=()=>{if(security.phase==='captured')c.env.hold(false);};
  c.rt.group.userData.dispose=()=>{if(security.phase==='captured')c.env.hold(false);};
  return {update,disable,state:()=>({...security}),read:()=>({security:{...security},guards:guards.map(g=>({id:g.id,x:g.x,z:g.z,yaw:g.yaw,mode:g.mode,moving:g.moving,eyesOn:g.model.read().eyesOn}))})};
}
