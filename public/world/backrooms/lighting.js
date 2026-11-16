// Seeded ambient lighting. No layout RNG is consumed: changing the lighting
// leaves rooms, supplies, furniture and residents where the seed put them.
import { makeRng } from './gen.js';

// Almost all bounce belongs to the tubes: a failed bank must lose its ambient
// contribution too. Keep a faint residual, without the camcorder rescuing it.
export const LIGHTING = Object.freeze({ ambientShare: .99, blackout: .0025, gainMax: 1.25, maxBanks: 4 });
export const LIGHTING_MIX = Object.freeze({ steady: .60, failing: .10, dim: .15, islands: .10, travel: .04, emergency: .01 });
export const LIGHTING_MODES = Object.freeze(['failing', 'dim', 'travel', 'emergency', 'islands']);
const ease = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const key = (p) => `${p.x}:${p.z}`;

export function planLighting(room, seed, mode = false) {
  if (!mode || room.kind !== 'plain' || room.crawl || !['normal', 'dim'].includes(room.light.mode)) return null;
  const panels = room.panels.filter(p => p.state !== 'dead');
  if (panels.length < 2) return null;
  const rng = makeRng(`${seed}:lighting:${room.id}`), roll = rng(), forced = LIGHTING_MODES.includes(mode);
  let kind = mode;
  if (!forced) {
    let ceiling = 0;
    for (const [name, share] of Object.entries(LIGHTING_MIX)) {
      ceiling += share;
      if (roll < ceiling) { kind = name; break; }
    }
  }
  if (kind === 'steady') return null;
  let axis = room.W > room.D ? 'x' : 'z';
  const rowsOn = a => [...new Set(panels.map(p => p[a]))].sort((a,b) => a-b);
  let rows = rowsOn(axis);
  if (rows.length < 2) { axis = axis === 'x' ? 'z' : 'x'; rows = rowsOn(axis); }
  if (rows.length < 2) return null;
  // A natural passing outage needs a corridor, with at least three successive
  // rows. The forced dev mode also admits wide rooms for comparison.
  if (kind === 'travel' && (rows.length < 3 || (!forced && Math.max(room.W,room.D) / Math.min(room.W,room.D) < 1.8))) {
    if (forced) return null;
    kind = 'failing';
  }
  const ceilingBanks = kind === 'travel' ? Math.min(LIGHTING.maxBanks, rows.length) : 2;
  const cuts = Array.from({length:ceilingBanks-1},(_,i) => {
    const n = Math.ceil((i+1)*rows.length/ceilingBanks); return (rows[n-1]+rows[n])/2;
  });
  const reverse = rng.chance(.5), period = kind === 'travel' ? rng.range(64,88) : kind === 'emergency' ? rng.range(5,6) : rng.range(38,54);
  const plan = {kind, axis, cuts, split:cuts[0], reverse, ceilingBanks, bankCount:ceilingBanks+(kind==='emergency'?1:0),
    emergencyBank:kind==='emergency'?2:null, period, offset:rng.range(0,period), ambientShare:LIGHTING.ambientShare};
  if (kind === 'islands') {
    const ordered = [...panels].sort((a,b) => a[axis]-b[axis]);
    // A single survivor in an ordinary room; two separated survivors in a
    // large ceiling. All the other fixtures still exist, but have no power.
    const first = ordered[Math.floor(ordered.length*(reverse ? .75 : .25))];
    plan.keepers = [key(first)];
    if (panels.length >= 12) plan.keepers.push(key(ordered.reduce((a,b) => (b.x-first.x)**2+(b.z-first.z)**2 > (a.x-first.x)**2+(a.z-first.z)**2 ? b:a)));
  }
  return plan;
}

export function planFloorLighting(level, mode) {
  let emergency = false;
  return level.rooms.map(room => {
    const p = planLighting(room,level.seed,mode);
    if (p?.kind==='emergency' && !LIGHTING_MODES.includes(mode)) {
      if (emergency) return null;
      emergency = true; // at most one emergency room per part in the normal mix
    }
    return p;
  });
}

export function panelBank(plan, panel) {
  if (plan.keepers) return plan.keepers.includes(key(panel)) ? 0 : 1;
  const cuts = plan.cuts || [plan.split], n = cuts.filter(c => panel[plan.axis] >= c).length;
  return plan.reverse ? cuts.length-n : n;
}

/** Pure visit-clock curves. Culling/frame rate cannot alter a cue's phase. */
export function bankLevels(plan, time, effect = 1, steady = false) {
  const count = plan.bankCount || 2, ceiling = plan.ceilingBanks || 2;
  const low = LIGHTING.blackout;
  const working = Array.from({length:count},(_,b) => b<ceiling?1:0);
  // Creature flashes/blackouts retain priority; red backup is off while they own the ceiling.
  if (effect !== 1 || plan.kind === 'steady' || plan.preview === 'working') return working;
  if (plan.preview === 'outage') return working.map((_,b) => b < ceiling ? low : .65);
  if (plan.kind === 'dim') return working.map((_,b) => b === 0 ? .78 : b < ceiling ? low : 0);
  if (plan.kind === 'islands') return [.88,low];
  const t = plan.cue ? time-plan.cue.start : ((time+plan.offset)%plan.period+plan.period)%plan.period;
  if (plan.kind === 'emergency') {
    // A broad red breath, not a sharp strobe: 1.3 s up, 1.3 s down, then quiet.
    const pulse = steady ? .55 : .08+.92*Math.sin(Math.PI*Math.min(t,2.6)/2.6)**2;
    return [low,low,pulse];
  }
  if (plan.kind === 'travel') {
    if (steady) return working.map(()=>.6);
    return working.map((_,b) => {
      const order = plan.cue?.reverse ? ceiling-1-b : b;
      const s = t-order*1.35;
      if (s<0) return 1;
      if (s<.4) return 1-(1-low)*ease(s/.4);
      if (s<6 || plan.cue?.hold) return low;
      if (s<8) return low+(1-low)*ease((s-6)/2);
      return 1;
    });
  }
  if (steady) return [1,.18];
  let k=1;
  if (t<.35) k=1-.82*ease(t/.35);
  else if (t<1.05) k=.18+.67*ease((t-.35)/.7);
  else if (t<1.6) k=.85-(.85-low)*ease((t-1.05)/.55);
  else if (t<10) k=low;
  else if (t<12.5) k=low+(1-low)*ease((t-10)/2.5);
  return [1,k];
}

/** Bounced light belongs to nearby ceiling tubes, never to the red wall lamps. */
export function bankWeights(lights, x, z, count = 2, ceiling = count) {
  const near = Array(count).fill(Infinity);
  for (const l of lights) if (Number.isInteger(l.bank) && l.bank>=0 && l.bank<ceiling) near[l.bank]=Math.min(near[l.bank],(l.x-x)**2+(l.z-z)**2);
  const weights=near.map(d=>1/(1+d)), total=weights.reduce((a,b)=>a+b,0);
  return weights.map((v,i)=>total?v/total:i<ceiling?1/ceiling:0);
}

export function localLightScale(plan, lights, levels, x, z) {
  const weights=bankWeights(lights,x,z,plan.bankCount||2,plan.ceilingBanks||2);
  return 1-plan.ambientShare+plan.ambientShare*weights.reduce((n,w,i)=>n+w*levels[i],0);
}
