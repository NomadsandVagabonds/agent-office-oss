// Three local wardens; their route graph respects every cage and room wall.
import { createGuard } from './guards.js';
import { createLabNavigation } from './navigation.js';
import { createSecurity, stepSecurity, releaseSecurity, CAPTURE_HEARTS, MERCY_SECONDS } from './security.js';
import { furnitureClear } from '../../furniture-rules.js';

export function createPatrol(c,{visitor,rows,outerX,diversion=()=>null,onChange=()=>{},onRelease=()=>{}}){
  let security=createSecurity(),clock=0,entered=false,mercy=0,known=false,disposed=false,navRevision=-1;
  const meet=()=>{if(!known){known=true;c.met('mecha-warden');}};
  const nav=createLabNavigation(c),gap=(2.8+outerX)/2;
  const guards=[{x:0,z:rows[2],lane:0},{x:-gap,z:rows[0],lane:-gap},{x:gap,z:rows[3],lane:gap}].map((p,id)=>({
    ...p,id,yaw:id===1?Math.PI:0,model:createGuard(c,{id,x:p.x,z:p.z,variant:id}),
    end:id%2,route:[],repath:0,acquire:0,lastSeen:-100,seen:null,mode:'patrol',moving:false,
  }));
  const bodies = c.env.barricadesEnabled ? (c.world.bodies ||= []) : null;
  for (const g of guards) {
    const p = c.toWorld(g.x,g.z);
    g.collider = { ...p, r: .36 };
    if (bodies) bodies.push(g.collider);
  }
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function thinClear(a,b){
    const from=c.toWorld(a.x,a.z),to=c.toWorld(b.x,b.z);
    if(!furnitureClear(c.world,from.x,from.z,to.x,to.z,.025))return false;
    const n=Math.max(1,Math.ceil(distance(a,b)/.08));
    for(let i=0;i<=n;i++){const p=c.toWorld(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n);
      if(!c.world.free(p.x,p.z,.025,{ghost:true}))return false;}
    return true;
  }
  function capture(){
    meet();
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
    if(disposed)return;
    const revision=nav.revision();
    if(revision!==navRevision){navRevision=revision;for(const g of guards){g.route=[];g.repath=0;}}
    if(me.inside&&!entered){entered=true;clock=0;}
    if(me.inside&&security.phase==='patrol'&&!me.world.frozen)clock+=dt;
    const before=security;
    security=stepSecurity(security,dt,{inside:me.inside});
    if(security.phase==='captured')c.env.hold(me.inside);
    if(security.phase==='gameover'&&before.phase!=='gameover'){
      // Ten seconds in the cage cost hearts, as being caught does everywhere in the building. The visit ends only
      // if they were the last (the conductor does that, through c.hurt); otherwise the gate opens and the wardens
      // go back to their rounds, and for a few seconds take no notice.
      c.env.hold(false);
      const hit=c.hurt(CAPTURE_HEARTS);
      if(!hit.ended){
        security=releaseSecurity(security);mercy=MERCY_SECONDS;
        for(const g of guards){g.acquire=0;g.lastSeen=-100;g.seen=null;g.repath=0;}
        onRelease();
        if(hit.landed){c.env.hud?.glitch?.(.6);c.survived('mecha-warden');}
      }
      onChange(security);
    }
    if(me.inside&&!me.world.frozen)mercy=Math.max(0,mercy-dt);
    for(const g of guards){
      g.moving=false;
      if(me.inside&&security.phase==='patrol'&&!me.world.frozen){
        const dx=me.x-g.x,dz=me.z-g.z,d=Math.hypot(dx,dz)||.001;
        const facing=(Math.sin(g.yaw)*dx+Math.cos(g.yaw)*dz)/d;
        const a=c.toWorld(g.x,g.z),b=c.toWorld(me.x,me.z);
        const distraction=diversion();
        if(!known&&d<9&&c.seen(g.x,g.z,{radius:.5}))meet();
        const sees=clock>2.5&&mercy<=0&&!distraction&&d<7.8&&(facing>.1||d<1.55)&&c.world.los(a.x,a.z,b.x,b.z);
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
        if(clock>2.5&&mercy<=0&&distance(g,me)<.62&&thinClear(g,me)){capture();}
      }
      g.model.update({x:g.x,z:g.z,yaw:g.yaw,time:t,moving:g.moving,disabled:security.phase==='disabled'});
      Object.assign(g.collider,c.toWorld(g.x,g.z));
    }
  }
  // hold belongs only to this visit; leaving or disposing never freezes another floor.
  const beforeLeave=c.rt.onLeave, beforeDispose=c.rt.group.userData.dispose;
  c.rt.onLeave=()=>{beforeLeave?.();if(security.phase==='captured')c.env.hold(false);};
  c.rt.group.userData.dispose=()=>{
    if(disposed)return;disposed=true;
    for(const g of guards){g.collider.on=false;const at=bodies?.indexOf(g.collider)??-1;if(at>=0)bodies.splice(at,1);}
    if(security.phase==='captured')c.env.hold(false);
    beforeDispose?.();
  };
  /** Stand a warden somewhere, facing something (the building's camera, after the last heart: rooms/mecha.js). */
  function post(i,x,z,yaw){const g=guards[i];if(!g)return;g.x=x;g.z=z;g.yaw=yaw;g.moving=false;g.model.update({x,z,yaw,time:clock,moving:false,disabled:false});}
  return {update,disable,post,count:guards.length,where:(i)=>({x:guards[i].x,z:guards[i].z}),state:()=>({...security}),read:()=>({security:{...security},guards:guards.map(g=>({id:g.id,x:g.x,z:g.z,yaw:g.yaw,mode:g.mode,moving:g.moving,eyesOn:g.model.read().eyesOn}))})};
}
