// The Backrooms — the rooms, part three: scenes somebody clearly went to some
// trouble over. Nothing here is explained; the signs and the furniture do
// the talking. Same contract as rooms.js.
import * as THREE from 'three';
import { Batch, lin, WHITE } from './kit.js';
import { card, wallVox } from './bits.js';
import { LIFT, surroundVox, liftLeafVox, callPlateVox } from './lift.model.js';
import { cutoutArt } from './cutout.js';
import { MORE3 } from './rooms4.js';
import { LIFT_ODDS, liftPress, liftCompany } from './rooms/lift/rule.js';

/**
 * A lift lobby. The doors open, and sometimes there is a car: the front stands out from the wall as a shaft (CD deep, to the
 * ceiling), and behind the doors is a real car, empty or with something on its floor or somebody in it (rooms/lift/rule.js: what
 * a press comes out as). The car is lobby floor, walkable, and the doors do not close on anything in it or in the doorway.
 */
function lift(c) {
  const { W, D, H, R, params: p } = c, kit = c.kit;
  c.shell({ sockets: false });
  const steel = lin(p.doors), dark = steel.map((v) => v * 0.55), OW = 1.5, OH = 2.02, CD = 1.5, F = CD;      // F: how far out of the wall the doors are
  const wood = lin('#8a7552'), lining = lin('#9a9078'), floorC = lin('#3a3730');
  // the surround is sculpted (lift.model.js): panels of brushed steel, an architrave stepping into the opening, a sill
  const SIDE = 0.9, HEAD = 0.34, colour = p.doors;
  wallVox(c, c.vox, kit.model(`lift:surround:${colour}`, () => surroundVox({ ow: OW, oh: OH, side: SIDE, head: HEAD, colour }), { ao: false }).solid, 'back', 0, 0, F, LIFT.voxel, LIFT.voxel, 0.11 / LIFT.deep);
  // …standing out from the wall as a shaft: steel down both sides and over the head, to the ceiling
  for (const sx of [-1, 1]) c.wbox('back', sx * (OW / 2 + SIDE / 2), SIDE, 0, H, 0, F, steel);
  c.wbox('back', 0, OW + 2 * SIDE, OH + HEAD, H, 0, F + 0.11, steel);
  c.solid(-(OW / 2 + SIDE), -D / 2, -OW / 2, -D / 2 + F + 0.11, { tall: true });
  c.solid(OW / 2, -D / 2, OW / 2 + SIDE, -D / 2 + F + 0.11, { tall: true });
  // the car: a floor, a lining to the ceiling, a rail, a light
  c.wbox('back', 0, OW, 0, 0.014, 0.03, F, floorC);
  c.wbox('back', 0, OW, 0.02, H, 0, 0.035, lining);
  for (const sx of [-1, 1]) c.wbox('back', sx * (OW / 2 - 0.01), 0.03, 0.02, H, 0.03, F, lining);
  c.wbox('back', 0, OW - 0.04, 0.9, 0.94, 0.035, 0.1, wood);
  for (const sx of [-1, 1]) c.wbox('back', sx * (OW / 2 - 0.04), 0.06, 0.9, 0.94, 0.1, F - 0.1, wood);
  const mid = c.wallAt('back', 0, F / 2);
  c.light(mid.x, OH - 0.15, mid.z, '#ffe9bd', 0.9, { k: 8, wrap: 0.5, far: 6 });
  // what is behind the doors when it is not a car: bricks across the opening, and the cutout or the poster in front of them
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
  const hideFlat = () => { for (const k of Object.keys(extras)) extras[k].visible = false; };
  hideFlat(); extras.bricks.visible = true;
  // the doors themselves: two leaves that slide away behind the surround
  const leaf = (sx) => { const b = new Batch(true), w = OW / 2, model = kit.model(`lift:leaf:${colour}`, () => liftLeafVox({ w, h: OH - 0.02, colour }), { ao: false });
    wallVox(c, b, model.solid, 'back', sx * OW / 4, 0.02, F + 0.05, -sx * LIFT.voxel, LIFT.voxel, 0.028 / (LIFT.leafDeep + 1)); return c.dynamic(b); };       // (mirrored for the right one: the rubber is at the edge they meet at)
  const left = leaf(-1), right = leaf(1);
  // the sign, the floor indicator, the button
  c.hang(c.mapped('liftsign', card(c, 'lift' + p.sign, [p.sign], { w: 112, h: 22, bg: '#2a2d34', fg: '#e8e2d0', size: 12 })), 'back', 0, OH + 0.24, 0.9, 0.18, null, WHITE, F + 0.113);
  const dial = kit.tex.live(48, 24), g = dial.image.getContext('2d');
  const show = (text) => { g.fillStyle = '#120806'; g.fillRect(0, 0, 48, 24); g.fillStyle = '#ff6a2a'; g.font = '700 17px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 24, 13); dial.needsUpdate = true; };
  show(p.floors[0]);
  { const b = new Batch(); c.hang(b, 'back', 0, OH + 0.09, 0.26, 0.13, null, WHITE, F + 0.113); c.add(new THREE.Mesh(kit.plain(b), kit.glowing(dial, 1.5))); }
  const bx = OW / 2 + 0.3, btn = new Batch();
  wallVox(c, c.vox, kit.model(`lift:plate:${colour}`, () => callPlateVox({ colour }), { ao: false }).solid, 'back', bx, 1.04, F + 0.11, LIFT.plateVoxel, LIFT.plateVoxel, 0.008 / 3);
  c.hang(btn, 'back', bx, 1.04, 0.05, 0.05, null, WHITE, F + 0.12);
  const light = c.add(new THREE.Mesh(kit.plain(btn), kit.glowing(kit.tex.white(), 1, [0.45, 0.4, 0.3])));
  const lit = new THREE.Color().setRGB(2.2, 1.5, 0.5), unlit = light.material.color.clone();
  if (c.clear(-W / 2 + 0.6, -D / 2 + 0.5, 0.4)) c.prop('planttall', -W / 2 + 0.6, -D / 2 + 0.5, { o: { variant: 1 } });
  if (c.clear(W / 2 - 0.6, -D / 2 + 0.5, 0.35)) c.prop('bin', W / 2 - 0.6, -D / 2 + 0.5, {});
  c.prop('doormat', 0, -D / 2 + F + 0.75, { solid: false, shadow: false, fallback: [0.9, 0.02, 0.5] });
  // the doors, shut, are a wall
  const doorWall = c.solid(-OW / 2, -D / 2 + F, OW / 2, -D / 2 + F + 0.1, { tall: true });

  // who or what is in the car or the doorway: the doors do not close on them. The visitor, a second one, anything with a body
  // (a creature), a creature the cast put there, and furniture (carried, or left) in the car or across the doorway.
  const wx = (x, z) => c.toWorld(x, z), corner = [wx(-OW / 2 - 0.05, -D / 2), wx(OW / 2 + 0.05, -D / 2 + F + 0.3)];
  const box = { x0: Math.min(corner[0].x, corner[1].x), z0: Math.min(corner[0].z, corner[1].z), x1: Math.max(corner[0].x, corner[1].x), z1: Math.max(corner[0].z, corner[1].z) };
  const near = (x, z, r) => x > box.x0 - r && x < box.x1 + r && z > box.z0 - r && z < box.z1 + r && Math.hypot(x - Math.max(box.x0, Math.min(box.x1, x)), z - Math.max(box.z0, Math.min(box.z1, z))) < r + 1e-6;
  const brought = [];                                                                                      // what the cast put in the car (handles)
  const occupied = () => {
    const env = c.env, w = env.world;
    for (const pl of (env.players?.() || [env.player])) { const m = pl?.me; if (m && near(m.x, m.z, pl.RADIUS || 0.22)) return true; }
    for (const b of w?.bodies || []) if (b.on !== false && !b.airborne && Number.isFinite(b.x) && near(b.x, b.z, b.r || 0.2)) return true;
    for (const h of brought) { try { const q = h.at?.(); if (q && Number.isFinite(q.x) && Number.isFinite(q.z) && near(q.x, q.z, 0.35)) return true; } catch { /* it has gone */ } }
    for (const f of w?.furniture || []) if (!f.away && f.x1 > box.x0 && f.x0 < box.x1 && f.z1 > box.z0 && f.z0 < box.z1) return true;
    return false;
  };

  // press the button: it thinks about floors, it arrives, it opens, and there you are
  let phase = 'idle', t0 = 0, visit = 0, open = 0, now = { kind: 'bricks' };
  const given = { item: false, creature: false };                                                          // (one of each to a lift: a visit has at most one lift)
  const here = c.toWorld(0, -D / 2 + F + 0.3);
  const carSpot = () => c.toWorld(0, -D / 2 + 0.75);
  c.use({ x: bx, z: -D / 2 + F + 0.4, r: 1.5, label: 'call the lift', when: () => phase === 'idle', use: () => { phase = 'coming'; t0 = 0; light.material.color.copy(lit); c.env.play('click', here.x, here.z, 5); } });
  const arrive = () => {
    const env = c.env, difficulty = env.difficulty?.(), shared = !!env.coopStrict || (env.players?.().length || 1) > 1, landing = (env.level?.depth ?? 0) === 0;
    const company = landing || shared || typeof env.pursuer?.summon !== 'function' ? { who: [], scale: 0 } : liftCompany(difficulty);
    now = liftPress(R, p, visit, { item: !given.item && !shared, who: given.creature ? [] : company.who, scale: company.scale, odds: p.odds || LIFT_ODDS });
    hideFlat();
    if (now.kind !== 'car') { extras.bricks.visible = true; if (extras[now.kind]) extras[now.kind].visible = true; return; }
    if (now.inside === 'item') {
      const id = `lift-${c.rt.id}-${visit}`;
      import('./inventory-state.js').then(({ makeItem }) => {
        for (const [x, z] of [[0, 0.75], [0.3, 1.0], [-0.3, 1.0], [0, 1.2], [0.3, 0.6], [-0.3, 0.6]]) if (env.inventory?.physical?.spawn(makeItem(now.item, id), { room: c.rt.id, x, z: -D / 2 + z })?.ok) { given.item = true; break; }
      }).catch(() => { /* no inventory on this visit: an empty car */ });
    }
  };
  /** The doors are all the way open: whoever the car holds is there to be seen (and not before, so that nothing lands unseen). */
  const reveal = () => {
    if (now.kind !== 'car' || now.inside !== 'creature' || given.creature) return;
    const q = carSpot(); let h = null;
    try { h = c.env.pursuer?.summon?.(now.who, { x: q.x, z: q.z }); } catch { h = null; }
    if (h) { given.creature = true; brought.push(h); }                                                       // (nobody came: it was an empty car)
  };
  c.tick((dt) => {
    if (phase === 'idle') return;
    t0 += dt;
    if (phase === 'coming') {
      const i = Math.floor(t0 / 0.42);
      if (i < p.floors.length) show(p.floors[i]);
      else { phase = 'opening'; t0 = 0; c.env.play('ding', here.x, here.z, 8); c.env.play('slide', here.x, here.z, 6); arrive(); }
    } else if (phase === 'opening') { open = Math.min(1, t0 / 1.1); if (open >= 1) { phase = 'open'; t0 = 0; reveal(); } }
    else if (phase === 'open') { if (occupied()) t0 = Math.min(t0, 3.9); if (t0 > 4) { phase = 'closing'; t0 = 0; c.env.play('slide', here.x, here.z, 6); } }
    else if (phase === 'closing') {
      if (occupied()) { phase = 'opening'; t0 = open * 1.1; }
      else { open = Math.max(0, 1 - t0 / 1.1); if (open <= 0) { phase = 'idle'; visit++; light.material.color.copy(unlit); show(p.floors[(visit * 3) % p.floors.length]); } }
    }
    doorWall.on = open < 0.9 || now.kind !== 'car';         // (bricks, a cutout and a poster are a wall however far the doors are open: only a car is walked into)
    const k = open * open * (3 - 2 * open) * (OW / 2 - 0.03);
    left.position.x = -k; right.position.x = k;
  });
}

export const MORE2 = { lift, ...MORE3 };
