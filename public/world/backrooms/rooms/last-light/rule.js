// The Last Light: pure layout and encounter rules. The room owns the clock,
// body and beam test; a glance, the camcorder lamp or fire is not a flashlight.
import { FLASHLIGHT, inFlashlight } from '../../flashlight.js';
export const LAST_LIGHT = Object.freeze({
  warning: 1.2, speed: 1.55, reach: .63, damage: 1, grace: 6,
  beamRange: FLASHLIGHT.holdRange, beamCos: FLASHLIGHT.holdCos, half: 1.25,
});

export function hallLayout({ W, D }) {
  const front = D / 2, back = -D / 2, half = LAST_LIGHT.half;
  const panels = Array.from({length:4}, (_,i) => ({x:0,z:back+3+i*(D-6)/3,state:'on'}));
  const pockets = [{side:-1,z:D*.16},{side:1,z:-D*.17}];
  const blocks = [];
  for (const side of [-1,1]) {
    const gap = pockets.find(p=>p.side===side), ends = [back+2.2,gap.z-1.6,gap.z+1.6,front-2.8];
    for (let i=0;i<ends.length;i+=2) if(ends[i+1]>ends[i]) blocks.push({x:side*(W/2+half)/2,z:(ends[i]+ends[i+1])/2,w:W/2-half,d:ends[i+1]-ends[i]});
  }
  return {front,back,half,panels,pockets,blocks,trigger:front-4,clear:back+1.25,home:{x:0,z:back+3.2}};
}

/** A body-sized target in the actual 3D beam. Pitch matters, as do walls,
 * finite range, and power from the inventory (including a taped-on torch). */
export function heldInBeam(eye, target, power, los=true) {
  return inFlashlight(eye,target,{power,los});
}

export const waiting = () => ({phase:'idle',age:0,frozen:false,scored:false});
export function stepHall(s, dt, sense={}) {
  const n={...s,start:false,caught:false,escaped:false};
  dt=Number.isFinite(dt)?Math.max(0,dt):0;
  n.frozen=!!sense.beam;
  if (s.phase==='done') return n;
  if (s.phase==='recover') {
    n.age=Math.max(0,s.age-dt);
    if (!n.age) n.phase='idle';
    return n;
  }
  if (!sense.inside || !sense.equipped) { n.phase='idle'; n.age=0; return n; }
  if (s.phase==='idle') {
    if (sense.trigger) { n.phase='warning'; n.age=0; }
    return n;
  }
  if (s.phase==='warning') {
    n.age=s.age+dt;
    if (n.age>=LAST_LIGHT.warning) { n.phase='hunt'; n.age=0; n.start=true; }
    return n;
  }
  if (sense.clear) { n.phase='done'; n.escaped=!s.scored; n.scored=true; return n; }
  n.age=s.age+dt;
  if (!n.frozen && sense.contact && sense.distance<LAST_LIGHT.reach) {
    n.caught=true; n.phase='recover'; n.age=LAST_LIGHT.grace;
  }
  return n;
}
