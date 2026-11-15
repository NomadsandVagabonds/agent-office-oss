// The Backrooms — a room of the neighbourhood (themes.js `suburb`): The Close
// ("the six houses that are the same house"). A dead-end road and six house
// fronts round it, each with a name over its door: five colleagues, and the
// visitor. Five doors are painted shut. The one under your own name opens.
// The names change places whenever nobody is looking at them.
//
// The rule (pure, below): a front keeps its name while it is on screen, and
// while somebody is at its door or behind it. Every other front may be dealt a
// different name. So the way in is to find your name and walk to it without
// taking your eyes off it. Behind every front is the same cupboard of bare
// board; nobody is ever shut in one, because the front you are at never changes.
import * as THREE from 'three';
import { Batch, drawText, ticks, WHITE } from '../kit.js';
import { P } from '../bits.js';
import { lawn, flat, sheet, upright, daylight, cutBatch, setArt, WHITEWASH } from '../suburb.js';

export const CLOSE = Object.freeze({ w: 3.0, h: 2.6, deep: 1.5, door: 0.9, doorH: 2.0, off: 3.9, hold: 2.6, unseen: 0.7 });
/**
 * Deal the names again. names[i]: who front i says it is · free[i]: may front i change (off screen long enough, nobody at it).
 * → a new list: the fronts that are not free keep theirs, the rest have theirs among themselves in a new order. Pure.
 */
export function reshuffle(names, free, rnd = Math.random) {
  const idx = names.map((_, i) => i).filter((i) => free[i]), pool = idx.map((i) => names[i]), out = names.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  idx.forEach((i, k) => { out[i] = pool[k]; });
  return out;
}

export function build(c) {
  const { W, D, H, params: p, kit } = c, K = CLOSE;
  c.shell({ panels: false });
  daylight(c, 4, 3, 1, 1);
  lawn(c, { wrong: 0, paint: 'sky', width: 0.4, cloudTop: H - 0.8 });

  /* the road: in from the door, and a place to turn round that nothing has ever turned round in */
  { const road = c.mapped('close:road', kit.tex.carpet('#6c6d70')), R = (x0, z0, x1, z1) => road.grid([x0, 0.012, z0], [0, 0, 1], [1, 0, 0], ticks(z1 - z0), ticks(x1 - x0), (u, v) => [(x0 + v) / 0.8, (z0 + u) / 0.8]);
    R(-1.5, 0.5, 1.5, D / 2 - 0.4); R(-3.2, -3.2, 3.2, 0.5);
    for (let z = 1.2; z < D / 2 - 1; z += 1.5) c.flat.box(-0.06, 0.013, z, 0.06, 0.016, z + 0.7, WHITEWASH);
    c.flat.box(-0.9, 0, -2.1, 0.9, 0.09, -0.3, WHITEWASH, { skip: '-y' }); c.floor.grid([-0.8, 0.091, -2.0], [0, 0, 1], [1, 0, 0], [0, 1.6], [0, 1.6], (u, v) => [u / 1.6, v / 1.6]);
    flat(c, -0.8, -1.2, 0.8, -1.2, 'tree', { h: Math.min(2.8, H - 0.1), full: 2.8, back: 'treeBack', brace: 0.7 }); c.solid(-0.9, -2.1, 0.9, -0.3); }

  /* one house front, drawn once: boards, a window either side, and a hole where the door goes */
  const art = kit.tex.custom('close:front', 120, 104, (g, w, h) => {
    P(g, '#eceadf', 0, 18, w, h - 18); for (let y = 18; y < h; y += 8) { P(g, '#b9b6a8', 0, y + 7, w, 1); P(g, '#f6f5ee', 0, y, w, 1); }
    P(g, '#5b4b46', 0, 0, w, 18); for (let y = 0; y < 18; y += 6) { P(g, '#3d322f', 0, y + 5, w, 1); for (let x = (y / 6) % 2 ? 4 : 0; x < w; x += 8) P(g, '#3d322f', x, y, 1, 6); }
    P(g, '#f6f5ee', 0, 18, w, 3);
    for (const x of [8, 82]) { P(g, '#f6f5ee', x - 2, 42, 34, 30); P(g, '#ffd98a', x, 44, 30, 26); P(g, '#f6f5ee', x + 14, 44, 2, 26); P(g, '#f6f5ee', x, 56, 30, 2); }
    P(g, '#f6f5ee', 39, 21, 42, 3); g.clearRect(42, 24, 36, 80);
  }, { clamp: true });
  const front = c.mapped('close:front', art, { cutout: true }), cut = cutBatch(c), ply = setArt(kit).uv('ply');
  const plates = p.names.map((name) => kit.own(new THREE.MeshBasicMaterial({ map: kit.tex.custom('close:name:' + name, 96, 24, (g, w, h) => { P(g, '#1d1c1a', 0, 0, w, h); drawText(g, [name], 0, 0, w, h, { color: '#e8d9a0', size: 15, pad: 8 }); }, { clamp: true }) })));
  const plateGeo = kit.own(new THREE.PlaneGeometry(0.86, 0.2));

  const fronts = [];
  for (const side of ['left', 'back', 'right']) for (const at of [-K.off, K.off]) {
    const pt = (u, v) => { const q = c.wallAt(side, at + u, v); return [q.x, q.z]; }, rot = c.wallAt(side, at, 0).rot;
    const A = pt(-K.w / 2, K.deep), B = pt(K.w / 2, K.deep), dl = pt(-K.door / 2, K.deep), dr = pt(K.door / 2, K.deep), a0 = pt(-K.w / 2, 0), b0 = pt(K.w / 2, 0);
    // (which of the two ends is on the left as the room sees it depends on the wall: ask the art's own winding)
    const facing = (a, b) => { const q = c.wallAt(side, at, 0); return (-(b[1] - a[1])) * q.n[0] + (b[0] - a[0]) * q.n[2] > 0; }, [L, Rr] = facing(A, B) ? [A, B] : [B, A];
    upright(front, L[0], L[1], Rr[0], Rr[1], 0, K.h, [0, 0, 1, 1]); upright(cut, Rr[0], Rr[1], L[0], L[1], 0, K.h, ply);
    for (const [e, w0] of [[A, a0], [B, b0]]) { upright(cut, e[0], e[1], w0[0], w0[1], 0, K.h, ply); upright(cut, w0[0], w0[1], e[0], e[1], 0, K.h, ply); }
    const box = (a, b, o) => c.solid(Math.min(a[0], b[0]) - 0.04, Math.min(a[1], b[1]) - 0.04, Math.max(a[0], b[0]) + 0.04, Math.max(a[1], b[1]) + 0.04, o);
    box(A, dl, { tall: true, keep: true }); box(dr, B, { tall: true, keep: true }); box(A, a0, { tall: true, keep: true }); box(B, b0, { tall: true, keep: true });
    const shut = box(dl, dr, { tall: true, keep: true });
    // the door: a leaf that is only ever seen shut, or already open
    const [hl, hr] = facing(dl, dr) ? [dl, dr] : [dr, dl], leaf = new Batch();
    upright(leaf, hl[0], hl[1], hr[0], hr[1], 0.01, K.doorH, null, [0.5, 0.12, 0.1]);
    const door = c.dynamic(leaf, { pivot: [hl[0], 0, hl[1]], side: THREE.DoubleSide });
    const mid = pt(0, K.deep + 0.03), plate = new THREE.Mesh(plateGeo, plates[0]);
    plate.position.set(mid[0], K.doorH + 0.19, mid[1]); plate.rotation.y = rot; c.add(plate);
    const m = pt(0, K.deep + 0.5); c.flat.box(m[0] - 0.4, 0, m[1] - 0.4, m[0] + 0.4, 0.02, m[1] + 0.4, [0.36, 0.26, 0.14], { skip: '-y' });
    c.reserve(m[0], m[1], 1.6);
    fronts.push({ x: mid[0], z: mid[1], in: pt(0, K.deep / 2), door, shut, plate, unseen: 9 });
  }
  let names = p.order.slice();
  const show = () => fronts.forEach((f, i) => { const mine = names[i] === 0; f.plate.material = plates[names[i]]; f.shut.on = !mine; f.door.rotation.y = mine ? 1.45 : 0; });
  c.after.push(() => { const L = c.sample(0, 1.8, 0, 0, 0, 1); for (const mt of plates) mt.color.setRGB(L[0] * 1.6, L[1] * 1.6, L[2] * 1.6); show(); });

  let wait = 0;
  c.tick((dt, t, me) => {
    wait += dt; if (wait < 0.25) return;
    const step = wait; wait = 0;
    if (!me.inside) return;
    const free = fronts.map((f) => {
      const near = Math.hypot(me.x - f.x, me.z - f.z) < K.hold || Math.hypot(me.x - f.in[0], me.z - f.in[1]) < K.hold;
      f.unseen = near || c.seen(f.x, f.z, { radius: 0.9 }) ? 0 : f.unseen + step;
      return f.unseen >= K.unseen;
    });
    if (free.filter(Boolean).length < 2) return;
    const next = reshuffle(names, free);
    if (next.some((n, i) => n !== names[i])) { names = next; fronts.forEach((f, i) => { if (free[i]) f.unseen = -1.5; }); show(); c.env.play?.('shuffle', ...Object.values(c.toWorld(0, 0)), 6); }
  });
}
