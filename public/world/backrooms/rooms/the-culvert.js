// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Gap
// ("the part of the lawn that was never drawn"; its id is still `the-culvert`,
// which is what it was). A lawn, and down the middle of it a strip that
// whoever made this place forgot: no grass, no floor, no bottom, the edge of
// it broken off square by square, wide in most places and in two places
// narrow. The squares next to it never got their grass either. It is a real
// hole (rt.floorY) and nothing is in the way of it: whoever walks to the
// very edge goes in, and that is the end of the visit.
//
// What the gap is for: the lines (cast/the-lines.js), flesh slung between six
// telephone poles, which has been following the visitor for some rooms by
// the time they get here. It walks only where there is floor. It cannot
// cross the gap. It can cross a bridge.
//
// The way over: the hoardings stood near the narrow places are loose
// (movable-cutout.js: E to take hold, R to let one down), and a tall one let
// down across a narrow place is a bridge, for anybody. So: over, and then
// the bridge up again before it has come after. One that is taken up from
// under it, and it goes where everything else here goes. (The owner: "take a
// cutout, go across before they are torn apart and remove it before the
// creature comes over… trapping it on the other side. High suspense!")
//
// The side doorways are on opposite banks, so the way on may be across.
// Every flat in this room is the loose kind: none goes over when leant on.
import { ticks } from '../kit.js';
import { P } from '../bits.js';
import { lawn, daylight, sheet } from '../suburb.js';
import { movableCutout } from '../movable-cutout.js';

// slab: the gap is made of strips this deep · neck: how wide it is where it can be bridged · deep: how far down, to whoever walks
// brink: how close to the edge the lawn gives way · falls: seconds of going down · panel: a tall hoarding · redraw: seconds stranded before one is drawn again
export const GAP = Object.freeze({ slab: 0.5, neck: 2.0, deep: 40, seen: 12, brink: 0.25, falls: 1.7, panel: 3.1, redraw: 5 });

/**
 * Where the gap is, strip by strip from the back wall: [from, to] in x. Narrow and straight at two necks, anything between.
 * It keeps clear of the side doorways (at z = 0) and comes to the front wall well to one side of the doorway there (side).
 */
export function gapOf(W, D, side, R) {
  const n = Math.round(D / GAP.slab), sl = D / n, snap = (v) => Math.round(v * 2) / 2, lim = W / 2 - 2.6;
  const necks = [-D / 4 + R.range(-0.4, 0.4), D / 4 + R.range(-0.6, 0.2)], from = R.range(-1.5, 1.5), wob = [];
  let w = 0; for (let j = 0; j < n; j++) { w = Math.max(-1, Math.min(1, w + R.pick([-0.5, 0, 0, 0.5]))); wob.push(w); }
  const mid = (z) => { const t = (z + D / 2) / D, k = t * t * (3 - 2 * t); return from + (3.4 - from) * k; };
  const out = [];
  for (let j = 0; j < n; j++) {
    const z = -D / 2 + (j + 0.5) * sl, neck = necks.find((q) => Math.abs(z - q) < 1.45);
    const wide = neck !== undefined ? GAP.neck : R.pick([3, 3.5, 4, 4.5, 5]), c0 = neck !== undefined ? snap(mid(neck)) : snap(mid(z) + wob[j]);
    let a = Math.max(-lim, snap(c0 - wide / 2)), b = a + wide; if (b > lim) { b = lim; a = Math.min(a, b - GAP.neck); }
    out.push(side > 0 ? [a, b] : [-b, -a]);
  }
  return { strips: out, sl, n, necks, at: (z) => out[Math.max(0, Math.min(n - 1, Math.floor((z + D / 2) / sl)))] };
}

export function build(c) {
  const { W, D, H, R, params: p, kit } = c, K = GAP, s = p.side;
  const gap = gapOf(W, D, s, R), { sl, n } = gap;
  c.shell({ floor: false, panels: false });
  daylight(c, 3, 3, 1, 1);
  // Real terrain stays fixed for co-op. The solo fall retains its existing room-floor animation.
  const falls = new WeakMap(), safe = new WeakMap();
  let soloFall = null;
  const inGap = (x, z) => { if (Math.abs(z) >= D / 2) return false; const [a, b] = gap.at(z); return x > a && x < b; };
  c.rt.floorY = (x, z) => (!c.env.coopStrict && soloFall ? soloFall.y : inGap(x, z) ? -K.deep : 0);
  c.rt.headY = (x, z) => H - c.rt.floorY(x, z);

  /* the lawn, either side; the squares along the break, which never got their grass; under all of it, nothing */
  const turf = c.floor, grey = [[0.66, 0.67, 0.7], [0.5, 0.51, 0.55]];
  const grass = (x0, x1, z0) => { if (x1 - x0 > 0.01) turf.grid([x0, 0, z0], [0, 0, 1], [1, 0, 0], ticks(sl, sl, 0), ticks(x1 - x0), (u, v) => [(x0 + v + c.room.cx) / 1.6, (z0 + u + c.room.cz) / 1.6]); };
  const blank = (x, z0, j) => { const k = (Math.round(x * 2) + j) & 1; c.flat.box(x, -0.012, z0, x + 0.5, 0.004, z0 + sl, grey[k], { skip: '-y' }); };
  gap.strips.forEach(([a, b], j) => {
    const z0 = -D / 2 + j * sl, pa = j ? gap.strips[j - 1] : [a, b], nx = j < n - 1 ? gap.strips[j + 1] : [a, b];
    const la = Math.min(a, pa[0], nx[0]) - 0.5, rb = Math.max(b, pa[1], nx[1]) + 0.5;                    // (a square is blank if the break is beside it or in front of it)
    grass(-W / 2, la, z0); grass(rb, W / 2, z0);
    for (let x = la; x < a - 0.01; x += 0.5) blank(x, z0, j); for (let x = b; x < rb - 0.01; x += 0.5) blank(x, z0, j);
  });
  { // under the lawn: a box with nothing in it, black. The lawn is as thick as a sheet of paper from in there, and it shows.
    const dark = c.mapped('gap:void', kit.tex.custom('gap:void', 4, 4, (g) => P(g, '#000', 0, 0, 4, 4))), k = [0, 0, 0], y = -K.seen, x = W / 2, z = D / 2;
    sheet(dark, [-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z], 1, 1, null, k);
    sheet(dark, [-x, y, -z], [x, y, -z], [x, 0, -z], [-x, 0, -z], 1, 1, null, k); sheet(dark, [x, y, z], [-x, y, z], [-x, 0, z], [x, 0, z], 1, 1, null, k);
    sheet(dark, [-x, y, z], [-x, y, -z], [-x, 0, -z], [-x, 0, z], 1, 1, null, k); sheet(dark, [x, y, -z], [x, y, z], [x, 0, z], [x, 0, -z], 1, 1, null, k);
  }
  // squares that came away, and have not finished falling: some grey, some with their grass
  for (let i = 0; i < 16; i++) {
    const j = R.int(1, n - 2), [a, b] = gap.strips[j]; if (b - a < 2.6) continue;
    const x = a + 0.5 * R.int(1, Math.round((b - a) / 0.5) - 2), z0 = -D / 2 + j * sl, y = -R.range(0.12, 3.2), q = 0.5 - R.range(0, 0.12);
    c.flat.box(x, y - 0.016, z0, x + q, y, z0 + q, R.chance(0.35) ? [0.3, 0.52, 0.26] : grey[i & 1]);
  }
  lawn(c, { wrong: 0, paint: 'corn', width: 0.4, cloudTop: H - 0.7, neighbour: 0, border: false });

  /* the hoardings, at the necks: a tall one on either bank at each, stood back so that it has to be carried up; and one sawn short */
  // (eitherEnd: one that is down may be taken up from the far end of it too, and stands up where it stood: across the gap from whoever did it)
  const back = 1.1, edge = 0.5, talls = [], spots = { '-1': [], 1: [] };
  gap.necks.forEach((zn, i) => {
    const [a, b] = gap.at(zn);
    for (const [side, x0, facing, front] of [[-1, a, 1, i ? 'streetB' : 'streetC'], [1, b, 3, i ? 'streetC' : 'streetB']]) {
      const x = x0 + side * back, z = zn + side * (i ? 0.2 : -0.2);
      const it = movableCutout(c, { x, z, height: K.panel, facing, front, label: 'Hoarding', eitherEnd: true });
      if (it) { c.bridgeRoute(it, { stand: { x: x + side * 0.75, z }, path: [{ x: x0 + side * edge, z }] }); talls.push(it); spots[side].push({ x, z }); }
    }
  });
  { const [a] = gap.at(gap.necks[1]); movableCutout(c, { x: a - s * 0.0 - 2.4, z: gap.necks[1] + 1.6, height: 1.3, facing: 1, front: 'streetA', label: 'Hoarding, sawn short' }); }
  // what is over there
  c.leave('opener', s * (W / 2 - 2.0), -D / 2 + 2.0, { y: 0 });

  const env = c.env;
  const open = (x, z) => { const q = c.toWorld(x, z); return env.world.floorY(q.x, q.z) < c.room.y - 1; };
  const bankOf = (x, z) => { const [a, b] = gap.at(z); return x <= a ? -1 : x >= b ? 1 : 0; };
  /** The hoardings that are down, as this room has them: { x0, x1, z } — the two ends, and where across. */
  const bridges = () => (env.world.furniture || []).filter((f) => f.authored && f.room === c.rt.id && f.bridge && f.deployed && !f.transition && !f.away).map((f) => {
    const q0 = c.toLocal(f.collider.x0, f.collider.z0), q1 = c.toLocal(f.collider.x1, f.collider.z1); return { x0: Math.min(q0.x, q1.x), x1: Math.max(q0.x, q1.x), z: (q0.z + q1.z) / 2 };
  });
  // Nobody is left on a bank with no way off it. A hoarding that has been carried off, or stood up on the wrong side, is drawn
  // again where one was first drawn, on the bank of whoever needs it: the room forgets things, and it forgets that it forgot.
  const stuck = new WeakMap();
  const redraw = (dt, me) => {
    const body = env.player.me, bank = bankOf(me.x, me.z); if (!bank || bridges().length) { stuck.set(body,0); return; }
    const free = talls.filter((f) => !f.away && !f.deployed && !f.transition && !f.carried), here = free.some((f) => { const q = c.toLocal(f.x, f.z); return f.room === c.rt.id && Math.abs(q.x) < W / 2 && Math.abs(q.z) < D / 2 && bankOf(q.x, q.z) === bank; });
    if (here || talls.some((f) => f.carried)) { stuck.set(body,0); return; }
    const wait=(stuck.get(body)||0)+dt;stuck.set(body,wait);if(wait<GAP.redraw)return;
    stuck.set(body,0);
    for (const f of free) for (const sp of spots[bank]) { const q = c.toWorld(sp.x, sp.z); if (env.barricades?.place?.(f, q.x, q.z)) { env.interfere?.(0.7); env.play?.('rattle', q.x, q.z, 10); return; } }
  };

  // Each visitor falls independently. The room's floor stays put for their
  // partner and for the creature; only the falling visitor's camera descends.
  const tickVisitor = (dt, body) => {
    const p=c.toLocal(body.x,body.z), me={...p,inside:env.world.roomAt(body.x,body.z)===c.rt};
    const fall=falls.get(body);
    if(fall){
      fall.t+=dt;fall.y=-Math.min(20,.5*9.8*fall.t*fall.t);
      if(!env.coopStrict)env.player.warp(body.x,body.z);
      body.y=c.room.y+1.35-Math.min(20,.5*9.8*fall.t*fall.t);
      body.pitch=Math.min(.95,body.pitch+dt*1.3);
      env.red?.(Math.min(.9,fall.t*.5));env.interfere?.(.3+.5*Math.min(1,fall.t/K.falls));
      if(fall.t>=K.falls){
        falls.delete(body);env.hold?.(false);
        // In co-op a downed visitor must remain reachable for a snack revive.
        if(env.coopStrict){env.player.warp(fall.back.x,fall.back.z);body.y=env.world.floorY(body.x,body.z)+(env.player.EYE||1.35);}
        env.end?.('caught');
      }
      return;
    }
    if(!me.inside||body.frozen)return;
    for(let a=0;a<8;a++)if(open(me.x+Math.sin(a*.7854)*K.brink,me.z+Math.cos(a*.7854)*K.brink)){
      const [ga,gb]=gap.at(me.z),side=me.x<(ga+gb)/2?-1:1;
      const back=safe.get(body)||c.toWorld(side<0?ga-.8:gb+.8,me.z);
      falls.set(body,{t:0,back});env.hold?.(true);env.run?.met?.('the-culvert');
      const q=c.toWorld(me.x,me.z);env.play?.('rattle',q.x,q.z,6);return;
    }
    if(env.world.terrainY(body.x,body.z)>=c.room.y-.2)safe.set(body,{x:body.x,z:body.z});redraw(dt,me);
  };
  if (!env.coopStrict) c.tick((dt, t, me) => {
    /* the visitor, going in */
    if (soloFall) {
      soloFall.t += dt; soloFall.y = Math.max(-80, -0.5 * 9.8 * soloFall.t * soloFall.t);
      const q = c.toWorld(soloFall.x, soloFall.z); env.player?.warp?.(q.x, q.z);
      const eye = env.player?.me; if (eye) eye.pitch = Math.min(0.95, eye.pitch + dt * 1.3);          // the strip of ceiling, getting narrower
      env.red?.(Math.min(0.9, soloFall.t * 0.5)); env.interfere?.(0.3 + 0.5 * Math.min(1, soloFall.t / K.falls));
      if (soloFall.t >= K.falls && !soloFall.over) { soloFall.over = true; env.hold?.(false); env.end?.('caught'); if (env.difficulty?.() === 'tourist') soloFall = null; }
      return;
    }
    if (!me.inside || env.player?.me?.frozen) return;
    // the lawn ends where it ends: within a step of the break with nothing let down there, and it is not there to stand on.
    // (The floor as the building has it now is what counts: a hoarding that is down is floor, and has an edge either side.)
    for (let a = 0; a < 8; a++) if (open(me.x + Math.sin(a * 0.7854) * K.brink, me.z + Math.cos(a * 0.7854) * K.brink)) {
      const [ga, gb] = gap.at(me.z); soloFall = { x: Math.max(ga + 0.4, Math.min(gb - 0.4, me.x)), z: me.z, y: 0, t: 0 }; env.hold?.(true); env.run?.met?.('the-culvert');
      const q = c.toWorld(me.x, me.z); env.play?.('rattle', q.x, q.z, 6); return;
    }
    redraw(dt, me);
  });
  else c.tick((dt)=>{if(env.forEachVisitor)env.forEachVisitor(body=>tickVisitor(dt,body));else if(env.player?.me)tickVisitor(dt,env.player.me);});
}
