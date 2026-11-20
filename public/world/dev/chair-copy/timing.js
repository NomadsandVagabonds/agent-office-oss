import { summarize, percentile } from '../perf-stats.js';

import { GRAINS } from './transfer.js';

const median=list=>percentile([...list].sort((a,b)=>a-b),50);
export function frameTest({h,stage,world,original,copies,point,start,makeCopy,remove,reset,canAct,running,alive,setText}){
  let active=false,result=null,abort=null;
  const renderer=stage.renderer,info=renderer.info;
  async function run(){
    if(active)return;active=true;result=null;
    const read=renderer.render,gl=renderer.getContext();
    const debug=gl.getExtension('WEBGL_debug_renderer_info'),timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const pending=[],phases={},duration=[],origin={};
    let phase=null,last=performance.now(),sceneFrame=null,complete=null,failed=null,settleUntil=0,framePhase=null,armed=false;
    let picture='';
    function group(name){return phases[name]??={frames:[],calls:[],triangles:[],gpu:[]};}
    // Timestamp the actual game scene. Full-frame intervals also include the VHS and UI passes.
    function drain(){
      if(timer&&pending.length&&gl.getParameter(timer.GPU_DISJOINT_EXT)){
        for(const {q} of pending)gl.deleteQuery(q);pending.length=0;return;
      }
      while(pending.length&&gl.getQueryParameter(pending[0].q,gl.QUERY_RESULT_AVAILABLE)){
        const {q,tag}=pending.shift();
        group(tag).gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);
      }
    }
    renderer.render=function(scene,cam){
      // The VHS glow pass draws this root a second time at half resolution.
      // Count and time the first (main color) draw exactly once per presented frame.
      if(scene!==h.root||sceneFrame)return read.call(this,scene,cam);
      const calls=info.autoReset?0:info.render.calls,tri=info.autoReset?0:info.render.triangles;
      const tag=phase, q=tag&&timer&&pending.length<24?gl.createQuery():null;
      if(q)gl.beginQuery(timer.TIME_ELAPSED_EXT,q);
      try{return read.call(this,scene,cam);}
      finally{
        if(q){gl.endQuery(timer.TIME_ELAPSED_EXT);pending.push({q,tag});}
        const out=renderer.getRenderTarget();picture=out?out.width+'×'+out.height:renderer.domElement.width+'×'+renderer.domElement.height;
        sceneFrame={calls:info.render.calls-calls,tri:info.render.triangles-tri};framePhase=tag;
      }
    };
    function interrupt(reason){if(failed)return;failed=Error(reason);const cb=complete;complete=null;cb?.reject(failed);}
    abort=()=>interrupt('Frame test stopped.');
    const visibility=()=>{if(document.hidden)interrupt('Frame test interrupted. Keep the room in the foreground.');};
    document.addEventListener('visibilitychange',visibility);
    const off=stage.onFrame(()=>{
      if(!canAct()||document.hidden){interrupt('Frame test interrupted. Resume and press B to retry.');return;}
      if(armed){const me=h.player.me;if(Math.hypot(me.x-origin.x,me.z-origin.z)>.02||Math.abs(me.yaw-origin.yaw)>.02||Math.abs(me.pitch-origin.pitch)>.02){interrupt('Camera moved. Press B to repeat the fixed-view test.');return;}}
      const now=performance.now();drain();
      if(framePhase&&sceneFrame){
        const g=group(framePhase);g.frames.push(now-last);g.calls.push(sceneFrame.calls);g.triangles.push(sceneFrame.tri);
      }
      sceneFrame=null;framePhase=null;last=now;
      if(complete&&now>=settleUntil&&(!complete.flight||!running())){
        phase=null;const cb=complete;complete=null;cb.resolve();
      }
    });
    const collect=(name,ms,flight=false)=>{
      if(failed)return Promise.reject(failed);
      phase=name;settleUntil=performance.now()+ms;return new Promise((resolve,reject)=>{complete={resolve,reject,flight};});
    };
    function paste(){
      const p=point(1.12,-.30),t=performance.now();
      if(!start(original,p))throw Error('Target blocked during frame test.');
      duration.push(performance.now()-t);
    }
    async function repeat(n,base,swarm){
      for(let i=0;i<n;i++){
        const before=copies.size;
        await collect(base,1300);paste();await collect(swarm,0,true);
        if(copies.size!==before+1)throw Error('Copy did not land.');
        remove([...copies].at(-1));
      }
    }
    try{
      reset();await collect(null,800);
      Object.assign(origin,h.player.me);armed=true;
      setText('1/3 · Baseline and first transfer');await collect('oneChair',1300);
      paste();await collect('firstTransfer',0,true);const first=[...copies][0];if(!first)throw Error('First placement failed.');remove(first);
      setText('2/3 · Repeating the same transfer');await repeat(3,'oneChair','transfer');
      // Populate the same room with real, registered chair bodies. All test placements use the normal footprint check.
      const extra=[[-.87,-.42],[-.78,.56],[.78,.63],[1.72,.65],[-1.66,.54],[.12,-1.08],[1.13,-1.28],
        [-1.67,1.45],[1.68,1.40],[-.93,-1.39],[.91,1.57],[0,-1.88]];
      for(const [x,z] of extra){if(copies.size===7)break;makeCopy(point(x,z));}
      if(copies.size!==7)throw Error('Seven clear stress-test spots were unavailable.');
      setText('3/3 · Seven copies, then an eighth in flight');await collect(null,350);
      await repeat(3,'sevenCopies','crowdedTransfer');
      if(!makeCopy(point(1.12,-.30)))throw Error('Last chair could not be placed.');
      await collect('eightCopies',1700);await collect(null,180);
      const results={};
      for(const [name,g] of Object.entries(phases)){
        results[name]={frameMs:summarize(g.frames),medianDraws:median(g.calls),peakDraws:Math.max(...g.calls),
          medianTriangles:median(g.triangles),peakTriangles:Math.max(...g.triangles),sceneGpuMs:summarize(g.gpu)};
      }
      result={gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
        userAgent:navigator.userAgent,picture,viewport:[innerWidth,innerHeight],vhs:h.vhs.level,seed:h.level.seed,swarm:GRAINS,activeCopies:copies.size,
        transferSetupCpuMs:summarize(duration),phases:results};
      console.log('[chair-copy]',JSON.stringify(result));
      setText('p95 frame · one '+results.oneChair.frameMs.p95+' ms · swarm '+results.transfer.frameMs.p95+' ms · eight copies '+results.eightCopies.frameMs.p95+' ms');
    }finally{
      off();renderer.render=read;document.removeEventListener('visibilitychange',visibility);
      for(const {q} of pending)gl.deleteQuery(q);
      if(!result&&alive()&&world===h.world)reset();
      abort=null;active=false;
    }
  }
  return {run,stop(){abort?.();},get result(){return result;},get active(){return active;}};
}
