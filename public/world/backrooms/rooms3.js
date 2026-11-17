// The Backrooms — the rooms, part three: scenes somebody clearly went to some
// trouble over. Nothing here is explained; the signs and the furniture do
// the talking. Same contract as rooms.js.
import * as THREE from 'three';
import { Batch, lin, WHITE } from './kit.js';
import { card } from './bits.js';
import { cutoutArt } from './cutout.js';
import { MORE3 } from './rooms4.js';
import { LIFT_ODDS, liftPress } from './rooms/lift/rule.js';

/** A lift lobby. The doors open, and sometimes there is a car. */
function lift(c) {
  const { W, D, R, params: p } = c, kit = c.kit;
  c.shell({ sockets: false });
  const steel = lin(p.doors), dark = steel.map((v) => v * 0.55), OW = 1.5, OH = 2.02, CD = 1.5;        // CD: how deep the car is (the front of the lobby is that much nearer)
  const F = CD;                                                                                           // the face of the doors, out from the wall
  const wood = lin('#8a7552'), lining = lin('#9a9078'), floorC = lin('#3a3730');
  // the surround: three slabs of brushed steel with a hole in the middle, standing out from the wall as a shaft with the car in it
  c.wbox('back', -(OW / 2 + 0.45), 0.9, 0, OH + 0.34, 0, F + 0.11, steel);
  c.wbox('back', OW / 2 + 0.45, 0.9, 0, OH + 0.34, 0, F + 0.11, steel);
  c.wbox('back', 0, OW, OH, OH + 0.34, 0, F + 0.11, steel);
  c.wbox('back', 0, OW, 0, 0.02, F, F + 0.11, dark);
  c.solid(-(OW / 2 + 0.9), -D / 2, -OW / 2, -D / 2 + F + 0.11, { tall: true });
  c.solid(OW / 2, -D / 2, OW / 2 + 0.9, -D / 2 + F + 0.11, { tall: true });
  // the car: a floor, a lining, a rail, a light
  c.wbox('back', 0, OW, 0, 0.014, 0.03, F, floorC);
  c.wbox('back', 0, OW, 0.02, OH - 0.01, 0.0, 0.035, lining);                                                   // the back
  c.wbox('back', -(OW / 2 - 0.01), 0.03, 0.02, OH - 0.01, 0.03, F, lining);                                     // the sides
  c.wbox('back', OW / 2 - 0.01, 0.03, 0.02, OH - 0.01, 0.03, F, lining);
  c.wbox('back', 0, OW - 0.04, 0.9, 0.94, 0.035, 0.1, wood);                                                    // the rail
  c.wbox('back', -(OW / 2 - 0.04), 0.06, 0.9, 0.94, 0.1, F - 0.1, wood);
  c.wbox('back', OW / 2 - 0.04, 0.06, 0.9, 0.94, 0.1, F - 0.1, wood);
  c.wbox('back', 0, OW, OH - 0.01, OH + 0.02, 0, F, dark);                                                      // the ceiling of it
  const mid = c.wallAt('back', 0, F / 2);
  c.light(mid.x, OH - 0.15, mid.z, '#ffe9bd', 0.9, { k: 8, wrap: 0.5, far: 6 });
  // what is behind the doors when it is not a car: a flat thing across the opening
  const extras = {};
  { const b = new Batch(); c.hang(b, 'back', 0, OH / 2, OW, OH, [[0, 0], [OW / 1.0, 0], [OW / 1.0, OH / 1.0], [0, OH / 1.0]], WHITE, F + 0.012); extras.bricks = c.dynamic(b, { map: kit.tex.brick() }); }
  const who = c.env.cast[p.who % Math.max(1, c.env.cast.length)];
  if (who) {
    const art = cutoutArt(kit, 'lift:' + who.name, who.look, { creations: c.env.who.creations, name: who.name }), b = new Batch();
    c.hang(b, 'back', 0, art.h / 2, art.w, art.h, null, WHITE, F + 0.02);
    extras.cutout = c.dynamic(b, { map: art.front, cutout: true });
  }
  { const tex = card(c, 'liftposter', ['OUT OF ORDER', 'PLEASE USE', 'THE OTHER LIFT'], { w: 96, h: 64, bg: '#f4f1e6', fg: '#b5281c', size: 12, pad: 10 }), b = new Batch();
    c.hang(b, 'back', 0, 1.25, 0.75, 0.5, null, WHITE, F + 0.02);
    extras.poster = c.dynamic(b, { map: tex }); }
  // (bricks are always there unless it is a car; the cutout and the poster stand in front of them)
  const hideFlat = () => { for (const k of Object.keys(extras)) extras[k].visible = false; };
  hideFlat(); extras.bricks.visible = true;
  // the doors themselves: two leaves that slide away behind the surround
  const leaf = (sx) => { const b = new Batch(); c.wbox('back', sx * OW / 4, OW / 2, 0.02, OH, F + 0.05, F + 0.075, steel, { batch: b }); c.wbox('back', sx * (OW / 2 - 0.02), 0.012, 0.02, OH, F + 0.075, F + 0.08, dark, { batch: b }); c.wbox('back', sx * OW / 4, OW / 2 - 0.16, 0.25, OH - 0.25, F + 0.075, F + 0.078, steel.map((v) => v * 0.9), { batch: b }); return c.dynamic(b); };
  const left = leaf(-1), right = leaf(1);
  // the sign, the floor indicator, the button
  c.hang(c.mapped('liftsign', card(c, 'lift' + p.sign, [p.sign], { w: 112, h: 22, bg: '#2a2d34', fg: '#e8e2d0', size: 12 })), 'back', 0, OH + 0.24, 0.9, 0.18, null, WHITE, F + 0.113);
  const dial = kit.tex.live(48, 24), g = dial.image.getContext('2d');
  const show = (text) => { g.fillStyle = '#120806'; g.fillRect(0, 0, 48, 24); g.fillStyle = '#ff6a2a'; g.font = '700 17px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 24, 13); dial.needsUpdate = true; };
  show(p.floors[0]);
  { const b = new Batch(); c.hang(b, 'back', 0, OH + 0.09, 0.26, 0.13, null, WHITE, F + 0.113); c.add(new THREE.Mesh(kit.plain(b), kit.glowing(dial, 1.5))); }
  const bx = OW / 2 + 0.3, btn = new Batch();
  c.wbox('back', bx, 0.12, 0.92, 1.16, F + 0.11, F + 0.118, dark);
  c.hang(btn, 'back', bx, 1.04, 0.05, 0.05, null, WHITE, F + 0.12);
  const light = c.add(new THREE.Mesh(kit.plain(btn), kit.glowing(kit.tex.white(), 1, [0.45, 0.4, 0.3])));
  const lit = new THREE.Color().setRGB(2.2, 1.5, 0.5), unlit = light.material.color.clone();
  if (c.clear(-W / 2 + 0.6, -D / 2 + 0.5, 0.4)) c.prop('planttall', -W / 2 + 0.6, -D / 2 + 0.5, { o: { variant: 1 } });
  if (c.clear(W / 2 - 0.6, -D / 2 + 0.5, 0.35)) c.prop('bin', W / 2 - 0.6, -D / 2 + 0.5, {});
  c.prop('doormat', 0, -D / 2 + F + 0.75, { solid: false, shadow: false, fallback: [0.9, 0.02, 0.5] });
  // the doors, shut, are a wall: and a car with somebody in it does not close on them
  const doorWall = c.solid(-OW / 2, -D / 2 + F, OW / 2, -D / 2 + F + 0.1, { tall: true });
  // press the button: it thinks about floors, it arrives, it opens, and there you are
  let phase = 'idle', t0 = 0, visit = 0, open = 0, now = { kind: 'bricks' }, inCar = false, spawned = 0;
  const here = c.toWorld(0, -D / 2 + F + 0.3);
  const creatures = () => typeof c.env.pursuer?.summon === 'function' && c.env.difficulty?.() !== 'tourist';
  c.use({ x: bx, z: -D / 2 + F + 0.4, r: 1.5, label: 'call the lift', when: () => phase === 'idle', use: () => { phase = 'coming'; t0 = 0; light.material.color.copy(lit); c.env.play('click', here.x, here.z, 5); } });
  const arrive = () => {
    now = liftPress(R, p, visit, { creatures: creatures(), tourist: c.env.difficulty?.() === 'tourist', odds: p.odds || LIFT_ODDS });
    hideFlat();
    if (now.kind !== 'car') { extras.bricks.visible = true; const k = now.kind; if (extras[k]) extras[k].visible = true; return; }
    if (now.inside === 'item') {
      const id = `lift-${c.rt.id}-${visit}`;
      // (on the car's floor: somewhere that is free, if something has already been left there)
      try { import('./inventory-state.js').then(({ makeItem }) => { for (const [x, z] of [[0, 0.75], [0.3, 1.0], [-0.3, 1.0], [0, 1.2], [0.3, 0.6], [-0.3, 0.6]]) if (c.env.inventory?.physical?.spawn(makeItem(now.item, id, now.item === 'paper' ? { quantity: 2 } : {}), { room: c.rt.id, x, z: -D / 2 + z })?.ok) { spawned++; break; } }); } catch { /* no inventory on this visit */ }
    } else if (now.inside === 'creature') {
      try { c.env.pursuer?.summon?.(now.who, { room: c.rt.id, x: 0, z: -D / 2 + 0.7, yaw: 0, from: 'lift' }); } catch { /* nobody to put there */ }
    }
  };
  c.tick((dt, t, me) => {
    inCar = !!(me && me.inside && Math.abs(me.x) < OW / 2 - 0.05 && me.z < -D / 2 + F);
    if (phase === 'idle') return;
    t0 += dt;
    if (phase === 'coming') {
      const i = Math.floor(t0 / 0.42);
      if (i < p.floors.length) show(p.floors[i]);
      else { phase = 'opening'; t0 = 0; c.env.play('ding', here.x, here.z, 8); c.env.play('slide', here.x, here.z, 6); arrive(); }
    } else if (phase === 'opening') { open = Math.min(1, t0 / 1.1); if (open >= 1) { phase = 'open'; t0 = 0; } }
    else if (phase === 'open') { if (inCar) t0 = 0; if (t0 > 4) { phase = 'closing'; t0 = 0; c.env.play('slide', here.x, here.z, 6); } }
    else if (phase === 'closing') { if (inCar) { phase = 'opening'; t0 = open * 1.1; } else { open = Math.max(0, 1 - t0 / 1.1); if (open <= 0) { phase = 'idle'; visit++; light.material.color.copy(unlit); show(p.floors[(visit * 3) % p.floors.length]); } } }
    doorWall.on = open < 0.9;
    const k = open * open * (3 - 2 * open) * (OW / 2 - 0.03);
    left.position.x = -k; right.position.x = k;
  });
}

export const MORE2 = { lift, ...MORE3 };
