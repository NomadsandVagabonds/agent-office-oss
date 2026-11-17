// The Backrooms — a vending machine that sells. The rules are vending.rule.js's; this is the metal: the front with its window and its
// panel, the panel's display (what has gone in, a picture of what it would give, a lit vend button and a return button), and E.
//
// No words anywhere on it: what has gone in, and what would come out, are pictures. E at the middle of the panel feeds what is in
// the hand; E at the left of it vends (when something is wanted of what is in); E at the right gives everything back. Where
// the vends of the floor are spent, every machine's panel goes dark.
import { makeRng } from './gen.js';
import { makeItem } from './inventory-state.js';
import { difficultyOf } from '../../../core/difficulty.mjs';
import { VENDS_PER_FLOOR, SLOTS, accepts, feed, recipeFor, vend, torchCharge, vendingSites } from './vending.rule.js';

export const MW = 0.96, MH = 1.78, MD = 0.7;
const CELL = { w: 92, h: 90 }, PANEL = { u0: 0.5, u1: 0.96, y0: 0.97, y1: 1.4 };       // (the display's cell in pixels · where it sits on the front: along it, and up it)
const FLOORS = new WeakMap();                                                                // (a floor's own count of vends: the machines of a floor share it)
const floorOf = (level) => { let f = FLOORS.get(level); if (!f) FLOORS.set(level, f = { done: 0, redraws: new Set() }); return f; };

/** A little picture of each thing, in coloured blocks on a 12×12 square. */
const ICONS = {
  snack: [['#c9852e', 1, 4, 10, 5], ['#7a4a18', 0, 3, 2, 7], ['#7a4a18', 10, 3, 2, 7], ['#f0d08a', 4, 5, 4, 2]],
  chalk: [['#f4f2ea', 4, 1, 4, 9], ['#9aa0a8', 4, 9, 4, 2]],
  tape: [['#cdbf9a', 1, 1, 10, 10], ['#1b1d22', 4, 4, 4, 4], ['#8f8566', 1, 9, 10, 2]],
  lighter: [['#8d949c', 3, 4, 6, 8], ['#f08a2c', 4, 0, 4, 4], ['#ffd25a', 5, 1, 2, 2], ['#3c4046', 3, 4, 6, 2]],
  paper: [['#f1eee2', 2, 0, 8, 12], ['#6a7380', 3, 2, 6, 1], ['#6a7380', 3, 4, 6, 1], ['#6a7380', 3, 6, 6, 1], ['#6a7380', 3, 8, 4, 1]],
  scissors: [['#b8bec6', 5, 0, 2, 6], ['#b8bec6', 3, 0, 2, 5], ['#d8372c', 1, 6, 5, 5], ['#d8372c', 6, 6, 5, 5], ['#2a1210', 2, 7, 3, 3], ['#2a1210', 7, 7, 3, 3]],
  torch: [['#e6b830', 4, 3, 4, 8], ['#33363c', 3, 0, 6, 4], ['#fff0a0', 4, 0, 4, 1], ['#33363c', 4, 9, 4, 3]],
};
function icon(g, type, x, y, s) {
  for (const [col, ix, iy, w, h] of ICONS[type] || []) { g.fillStyle = col; g.fillRect(x + ix * s, y + iy * s, w * s, h * s); }
}

/** The front all machines share: no words, a window of goods, a dark recess for the panel, a flap for what drops. */
function drawFront(g, w, h) {
  g.fillStyle = '#15171c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#3c6a86'; g.fillRect(2, 2, w - 4, 20);                      // the header, unlettered
  g.fillStyle = '#1a2c3a'; g.fillRect(w / 2 - 10, 9, 20, 6); g.fillStyle = '#0a0b0d'; g.fillRect(w / 2 - 8, 11, 16, 2);
  g.fillStyle = '#e9eef0'; g.fillRect(4, 26, 42, 100);                      // the window
  const cols = ['#c25a3c', '#4a86c2', '#d6b13a', '#58a06a', '#a8629c'];
  for (let r = 0; r < 5; r++) { g.fillStyle = '#9aa3a8'; g.fillRect(4, 44 + r * 20, 42, 2); for (let k = 0; k < 4; k++) { g.fillStyle = cols[(r + k) % 5]; g.fillRect(7 + k * 10, 29 + r * 20, 6, 14); g.fillStyle = '#ffffff'; g.fillRect(8 + k * 10, 30 + r * 20, 1, 10); } }
  g.fillStyle = '#0a0b0d'; g.fillRect(48, 26, 44, 100);                      // the recess the panel's display sits in (it is drawn live)
  g.fillStyle = '#0a0b0d'; g.fillRect(8, 138, 80, 28); g.fillStyle = '#2a2d34'; g.fillRect(10, 140, 76, 8);   // the flap
}

/** One cell of the display. */
function drawCell(g, ox, oy, inputs, ready, spent, want) {
  g.fillStyle = spent ? '#08090b' : '#0d1c26'; g.fillRect(ox, oy, CELL.w, CELL.h);
  if (spent) { g.fillStyle = '#5a1712'; g.fillRect(ox + 28, oy + 40, 36, 6); return; }          // (nothing lit but a dull red bar: no more)
  for (let i = 0; i < SLOTS; i++) {
    const x = ox + 8 + i * 27, y = oy + 6; g.fillStyle = '#16303f'; g.fillRect(x, y, 22, 22); g.fillStyle = '#0a141b'; g.fillRect(x + 1, y + 1, 20, 20);
    if (inputs[i]) icon(g, inputs[i], x + 5, y + 5, 1.0 + 0.0);
  }
  g.fillStyle = want ? '#6fd6ff' : '#233b49'; g.fillRect(ox + 43, oy + 31, 6, 3); g.fillRect(ox + 44, oy + 34, 4, 2);     // (the arrow: nothing yet, or something wanted)
  g.fillStyle = '#16303f'; g.fillRect(ox + 31, oy + 38, 30, 28); g.fillStyle = '#0a141b'; g.fillRect(ox + 32, oy + 39, 28, 26);
  if (want) icon(g, want, ox + 34, oy + 41, 2); else { g.fillStyle = '#233b49'; for (let k = 0; k < 3; k++) g.fillRect(ox + 40 + k * 5, oy + 51, 2, 2); }
  g.fillStyle = ready ? '#3ee068' : '#14351f'; g.fillRect(ox + 6, oy + 70, 46, 14);
  if (ready) { g.fillStyle = '#d8ffe0'; g.fillRect(ox + 10, oy + 72, 38, 2); }
  g.fillStyle = inputs.length ? '#e05040' : '#3a1612'; g.fillRect(ox + 58, oy + 70, 28, 14);
}

/**
 * The machines of one room. `count` is how many will be stood (the display is one atlas of that many cells, one mesh).
 * @returns { add({ sx, z, turned }) }
 */
export function vendingGear(c, count) {
  const { W } = c, kit = c.kit, floor = floorOf(c.level), machines = [];
  const front = kit.tex.custom('vendfront2', 96, 176, (g, w, h) => drawFront(g, w, h), { clamp: true });
  const glowB = c.shining('vendfront2', front, 1.25);
  const cols = Math.min(count, 4), rows = Math.ceil(Math.max(1, count) / cols);
  const atlas = kit.tex.live(cols * CELL.w, rows * CELL.h, () => {}, { clamp: true });
  const glowD = c.shining('vend:display', atlas, 1.5);
  const inv = () => c.env.inventory, rt = c.rt;
  const nextStream = () => makeRng(`${c.level.seed}/vend/${c.level.depth ?? 0}/${floor.done}`);
  const paint = () => {
    const g = atlas.image.getContext('2d'), spent = floor.done >= VENDS_PER_FLOOR;
    machines.forEach((m, i) => {
      const recipe = recipeFor(m.inputs), next = !spent && recipe ? vend(m.inputs, floor, nextStream(), { exclude: exclusions() }) : null;   // (the picture is the very thing that will drop)
      drawCell(g, (i % cols) * CELL.w, Math.floor(i / cols) * CELL.h, m.inputs, !spent && !!recipe, spent, next?.ok ? next.out : null);
    });
    atlas.needsUpdate = true;
  };
  const exclusions = () => (difficultyOf(c.env.level?.difficulty || c.level.difficulty)?.snack === 0 ? ['snack'] : []);
  floor.redraws.add(paint);
  const spawnAt = (m, item) => {                                 // the tray, then anywhere close on clear floor
    for (let ring = 0; ring < 10; ring++) for (let k = 0; k < 8; k++) {
      const a = k * 0.785 + ring * 0.4, r = ring * 0.18, p = inv()?.physical?.spawn(item, { room: rt.id, x: m.tx + Math.cos(a) * r * 0.6, z: m.tz + Math.sin(a) * r });
      if (p?.ok) return true;
    }
    return false;
  };
  const sound = (name, m) => { const w = c.toWorld(m.tx, m.tz); c.env.play(name, w.x, w.z, 5); };

  const add = ({ sx, z, turned = false }) => {
    const xw = sx * W / 2, xf = xw - sx * MD;
    c.flat.box(Math.min(xw, xf), 0, z - MW / 2, Math.max(xw, xf), MH, z + MW / 2, [0.17, 0.18, 0.22], { skip: '-y' });
    c.solid(Math.min(xw, xf), z - MW / 2, Math.max(xw, xf), z + MW / 2, { tall: true });
    c.shadow((xw + xf) / 2, z, MD, MW, 0.5);
    if (turned) { for (let v = 0; v < 6; v++) c.flat.box(xf - sx * 0.004 - 0.004, 0.5 + v * 0.07, z - 0.3, xf - sx * 0.004 + 0.004, 0.53 + v * 0.07, z + 0.3, [0.05, 0.05, 0.06]); return null; }
    const m = { inputs: [], items: [], tx: xf - sx * 0.5, tz: z }, idx = machines.length; machines.push(m);
    const x = xf - sx * 0.006, a = sx < 0 ? z + MW / 2 : z - MW / 2, b = sx < 0 ? z - MW / 2 : z + MW / 2, zAt = (u) => a + (b - a) * u;
    glowB.quad([x, 0.02, a], [x, 0.02, b], [x, MH - 0.02, b], [x, MH - 0.02, a]);
    const x2 = xf - sx * 0.012, c0 = (idx % cols) * CELL.w / (cols * CELL.w), c1 = c0 + 1 / cols, r0 = Math.floor(idx / cols), v1 = 1 - r0 / rows, v0 = 1 - (r0 + 1) / rows;
    const za = zAt(PANEL.u0), zb = zAt(PANEL.u1);
    glowD.quad([x2, PANEL.y0, za], [x2, PANEL.y0, zb], [x2, PANEL.y1, zb], [x2, PANEL.y1, za], [1, 1, 1], [[c0, v0], [c1, v0], [c1, v1], [c0, v1]]);
    c.light(xf - sx * 0.45, 1.05, z, '#cfe6ff', 0.42, { k: 1.1, far: 5.5, wrap: 0.5 });
    const stand = xf - sx * 0.3, at = (u) => ({ x: stand, z: zAt(PANEL.u0 + (PANEL.u1 - PANEL.u0) * u) });
    const spent = () => floor.done >= VENDS_PER_FLOOR, ready = () => !spent() && !!recipeFor(m.inputs);
    // the middle of the panel: what is in the hand goes in
    const slot = at(0.5);
    c.use({ x: slot.x, z: slot.z, r: 0.9, cone: 0.5, label: 'the machine',
      when: () => { const h = inv()?.held?.(); return !spent() && !!h && accepts(h.type) && m.inputs.length < SLOTS; },
      use: () => {
        const h = inv().held(), next = h && feed(m.inputs, h.type); if (!next) return;
        const took = inv().consumeHeld(h.type, 1); if (!took?.ok) return;
        m.inputs = next; m.items.push(took.item); sound('click', m); paint();
      } });
    // the left: the lit button
    const go = at(0.2);
    c.use({ x: go.x, z: go.z, r: 0.9, cone: 0.5, label: 'the machine', when: ready,
      use: () => {
        const R = nextStream(), got = vend(m.inputs, floor, R, { exclude: exclusions() });
        if (!got.ok) return;
        const id = `vend:${c.level.seed}:${c.level.depth ?? 0}:${floor.done}`;
        const made = makeItem(got.out, id, got.out === 'torch' ? { charge: torchCharge(R) } : {});
        if (!spawnAt(m, made)) { if (!inv().give(made)?.ok) return; }              // (nowhere to drop it: into the bag, and if that is full it stays unvended)
        floor.done++; m.inputs = []; m.items = [];
        sound('thunk', m); for (const f of floor.redraws) f();
      } });
    // the right: everything back
    const back = at(0.8);
    c.use({ x: back.x, z: back.z, r: 0.9, cone: 0.5, label: 'the machine', when: () => m.items.length > 0,
      use: () => {
        for (const it of m.items) if (!inv().give(it)?.ok) spawnAt(m, it);
        m.inputs = []; m.items = []; sound('click', m); paint();
      } });
    paint();
    return m;
  };
  return { add, paint, floor };
}

const SITES = new WeakMap();
/** The shortlist of rooms (if any) this floor may stand its one machine in. */
export const siteOf = (level) => { if (!SITES.has(level)) SITES.set(level, new Set(vendingSites(level, makeRng(`${level.seed}/vending-site/${level.depth ?? 0}`)))); return SITES.get(level); };

/**
 * A floor with no Refreshments room: one machine in a plain room, against a side wall on clear floor with room to stand before it.
 * Called by the plain room's own builder, after its dressing, so it only ever takes floor nothing else has.
 */
export function standMachine(c) {
  const { W, D, R } = c, floor = floorOf(c.level);
  if (floor.stood) return false;                                  // (one to a floor: the first shortlisted room that has the room for it)
  for (const sx of R.shuffle([-1, 1])) {
    const zs = []; for (let z = -D / 2 + 1.0; z <= D / 2 - 1.0; z += 0.4) zs.push(z);
    for (const z of R.shuffle(zs)) {
      const xw = sx * W / 2, xf = xw - sx * MD;
      const mid = xw - sx * MD / 2;       // (the body is 0.7 deep and 0.96 wide against the wall: three spots along it, and the floor in front of it to stand on)
      if (![-0.4, 0, 0.4].every((dz) => c.clear(mid, z + dz, 0.34)) || !c.clear(xf - sx * 0.55, z, 0.3)) continue;
      for (const dz of [-0.4, 0, 0.4]) c.reserve(mid, z + dz, 0.36);
      c.reserve(xf - sx * 0.55, z, 0.32);
      vendingGear(c, 1).add({ sx, z });
      floor.stood = true;
      return true;
    }
  }
  return false;
}
