// The Backrooms — Cover ("the desk that wants looking at"). An optional room, a dead end: nobody has to work it out.
//
// A standing desk on one wall with a screen that says AWAY. A stock cupboard in the far corner behind a roller
// shutter. A tape deck on a trolley. Stand at the desk and look at its screen and it says ACTIVE, and the shutter
// goes up, for exactly as long as you go on looking. The deck records you for as long as its tape is and plays you
// back as a cardboard cut-out of yourself, which stops on its last frame: a body at the desk, and eyes on whatever
// you were looking at when the tape ran out. Tape yourself turning to watch the shutter and your cut-out turns its
// back on the screen as well.
//
// The rule is rooms/cover/rule.js (and ../tape.js, which other tape rooms share); this file only draws it.
// Nothing here can hurt anybody, and the shutter never comes down on somebody who is inside.
import { Batch, lin, WHITE } from '../kit.js';
import { card } from '../bits.js';
import { makeCutout } from '../cutout.js';
import { COVER, layout, fresh, press, step, open } from './cover/rule.js';

const mmss = (t) => `0:${String(Math.max(0, Math.floor(t))).padStart(2, '0')}`;

export function build(c) {
  const { W, D, H, kit, params: p } = c, L = layout(W, D, p), s = L.side;
  c.shell();
  const steel = lin('#8f959b'), dark = lin('#2a2c31'), wood = lin('#b79a6b'), beige = lin('#cfc6ad');
  for (const q of [L.desk.mat, L.deck.stand, L.mouth, L.reward]) c.reserve(q.x, q.z, 0.8);

  // ---- the desk: a standing desk against the wall, a mat in front of it, a monitor that faces the room
  { const d = L.desk, x0 = Math.min(d.x - 0.36, d.x + 0.36), x1 = x0 + 0.72, f = c.flat;
    f.box(x0, 1.0, d.z - 0.75, x1, 1.04, d.z + 0.75, wood);
    for (const z of [d.z - 0.68, d.z + 0.62]) f.box(x0 + 0.08, 0, z, x1 - 0.08, 1.0, z + 0.06, steel);
    c.solid(x0, d.z - 0.75, x1, d.z + 0.75, { tall: false });
    c.shadow(d.x, d.z, 0.72, 1.5, 0.4);
    const mx = d.x + s * 0.06;                                                        // the monitor
    f.box(mx - 0.2, 1.04, d.z - 0.26, mx + 0.2, 1.46, d.z + 0.26, beige);
    f.box(mx - 0.12, 1.04, d.z - 0.1, mx + 0.12, 1.08, d.z + 0.1, lin('#b3aa94'));
    f.box(d.mat.x - 0.5, 0, d.mat.z - 0.55, d.mat.x + 0.5, 0.018, d.mat.z + 0.55, lin('#33363b'), { skip: '-y' });   // the mat
    const xs = mx - s * 0.203, z0 = d.z - 0.21, z1 = d.z + 0.21, a = s > 0 ? z0 : z1, b = s > 0 ? z1 : z0;            // its glass faces −s
    const face = (lines, o) => { const bt = new Batch(); bt.quad([xs, 1.1, a], [xs, 1.1, b], [xs, 1.42, b], [xs, 1.42, a]); return c.dynamic(bt, { map: card(c, 'cover' + lines.join(), lines, o), unlit: true }); };
    const name = String(c.level.name || 'YOU').toUpperCase().slice(0, 12);
    d.on = face([name, 'ACTIVE'], { w: 96, h: 72, bg: '#dff3e2', fg: '#12301a', size: 13, weight: 700 });
    d.off = face(['AWAY'], { w: 96, h: 72, bg: '#0c0f12', fg: '#3d4a44', size: 13, weight: 700 });
  }

  // ---- the cupboard: a partition, shelves, and a roller shutter across its mouth
  const cup = L.cup, zs = cup.z1;
  c.pillar(L.inner, (cup.z0 + cup.z1) / 2, 0.12, COVER.deep);
  { const f = c.flat, far = -s * W / 2;
    for (const y of [0.55, 1.1, 1.65]) f.box(Math.min(far, far + s * 0.3), y, cup.z0 + 0.04, Math.max(far, far + s * 0.3), y + 0.03, cup.z1 - 0.3, steel);
    f.box(cup.x0, 2.05, zs - 0.09, cup.x1, H, zs + 0.09, lin('#6c7278'));                                              // the box it rolls up into
    for (const x of [cup.x0 + 0.03, cup.x1 - 0.09]) f.box(x, 0, zs - 0.04, x + 0.06, 2.05, zs + 0.04, steel);        // its guides
  }
  const slats = new Batch();
  for (let i = 0; i < 16; i++) slats.box(cup.x0 + 0.09, i * 0.13, zs - 0.015, cup.x1 - 0.09, i * 0.13 + 0.115, zs + 0.015, i % 2 ? lin('#9aa0a6') : lin('#868c92'));
  const shutter = c.dynamic(slats), bar = c.solid(cup.x0, zs - 0.08, cup.x1, zs + 0.08, { tall: true, on: false });
  c.after.push(() => { bar.on = true; });                               // (after the level has checked the doorways with everything in place)
  c.leave('battery', L.reward.x, L.reward.z, { y: 0.58 });
  c.leave('snack', L.reward.x, L.reward.z + 0.55, { y: 0.58 });

  // ---- the deck: a trolley, a recorder, a small monitor that says what the tape is doing
  const dk = L.deck, tex = kit.tex.live(128, 96), g = tex.image.getContext('2d');
  { const f = c.flat, x0 = Math.min(dk.x - 0.3, dk.x + 0.3), x1 = x0 + 0.6;
    for (const y of [0.18, 0.62]) f.box(x0, y, dk.z - 0.4, x1, y + 0.03, dk.z + 0.4, steel);
    for (const [x, z] of [[x0, dk.z - 0.4], [x1 - 0.04, dk.z - 0.4], [x0, dk.z + 0.36], [x1 - 0.04, dk.z + 0.36]]) f.box(x, 0, z, x + 0.04, 0.65, z + 0.04, steel);
    f.box(x0 + 0.06, 0.65, dk.z - 0.3, x1 - 0.06, 0.77, dk.z + 0.3, dark);                                             // the recorder
    f.box(dk.x + s * 0.245, 0.69, dk.z - 0.2, dk.x + s * 0.252, 0.72, dk.z + 0.08, lin('#0a0a0c'));                    // its slot
    f.box(x0 + 0.1, 0.77, dk.z - 0.24, x1 - 0.1, 1.17, dk.z + 0.24, beige);                                            // the monitor
    c.solid(x0, dk.z - 0.4, x1, dk.z + 0.4, { tall: false });
    c.shadow(dk.x, dk.z, 0.6, 0.8, 0.4);
    const xs = dk.x + s * 0.203, a = s > 0 ? dk.z + 0.2 : dk.z - 0.2, b = s > 0 ? dk.z - 0.2 : dk.z + 0.2, bt = new Batch();   // its glass faces +s
    bt.quad([xs, 0.82, a], [xs, 0.82, b], [xs, 1.12, b], [xs, 1.12, a]);
    c.dynamic(bt, { map: tex, unlit: true });
  }
  const lamp = (() => { const bt = new Batch(); bt.box(dk.x - 0.04, 1.17, dk.z - 0.04, dk.x + 0.04, 1.23, dk.z + 0.04, [3.2, 0.25, 0.18]); return c.dynamic(bt, { unlit: true }); })();
  let shown = '';
  const show = (st) => {
    const t = st.tape, line = t.state === 'rec' ? ['REC', mmss(t.t)] : t.state === 'play' ? (st.figure && st.figure.held ? ['PAUSE', mmss(t.seconds)] : ['PLAY', mmss(t.t)]) : ['STOP', mmss(0)];
    const key = line.join(); if (key === shown) return; shown = key;
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 128, 96);
    g.textBaseline = 'top'; g.textAlign = 'left'; g.font = '700 26px ui-monospace, Menlo, Consolas, monospace';
    g.fillStyle = t.state === 'rec' ? '#ff4a3a' : '#e8f0f4';
    if (t.state === 'rec') { g.beginPath(); g.arc(20, 26, 9, 0, 7); g.fill(); } else if (line[0] === 'PLAY') { g.beginPath(); g.moveTo(11, 15); g.lineTo(29, 26); g.lineTo(11, 37); g.fill(); }
    else if (line[0] === 'PAUSE') { g.fillRect(11, 15, 6, 22); g.fillRect(22, 15, 6, 22); } else g.fillRect(11, 16, 19, 19);
    g.fillText(line[0], 38, 12); g.fillStyle = '#e8f0f4'; g.fillText(line[1], 38, 52);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < 96; y += 3) g.fillRect(0, y, 128, 1);
    tex.needsUpdate = true;
  };

  // ---- the cut-out of you that comes out of it. This is a spectral recording,
  // not another physical resident: furniture cannot alter the recorded route.
  const who = c.env.who || {}, fig = c.add(makeCutout(kit, 'tape:' + (c.level.name || 'you'), who.look || {}, { creations: who.creations, name: c.level.name }));
  fig.visible = false;

  // ---- and what happens
  let st = fresh(L), at = null;
  const here = c.toWorld(dk.x, dk.z), there = c.toWorld(L.mouth.x, L.mouth.z), desk = c.toWorld(L.desk.x, L.desk.z);
  const draw = () => {
    L.desk.on.visible = st.awake; L.desk.off.visible = !st.awake;
    shutter.position.y = st.lift * 1.98; bar.on = !open(st);
    lamp.visible = st.tape.state === 'rec';
    const f = st.figure; fig.visible = !!f;
    if (f) { fig.position.set(f.x, 0, f.z); fig.rotation.y = f.yaw + Math.PI; fig.userData.light(c.sample(f.x, 1.0, f.z)); }
    show(st);
  };
  c.after.push(draw);
  c.use({ x: L.deck.stand.x, z: L.deck.stand.z, r: COVER.deckR, label: 'record', when: () => st.tape.state !== 'rec',
    use: () => { if (at) { st = press(st, L, at); if (st.said.includes('rec')) c.env.play('thunk', here.x, here.z, 6); draw(); } } });
  c.tick((dt, t, me) => {
    at = me;
    st = step(st, Math.min(dt, 0.25), me, L);
    for (const what of st.said) {
      if (what === 'tick') c.env.play('tick', here.x, here.z, 9);
      else if (what === 'play') { c.env.play('thunk', here.x, here.z, 9); c.env.play('whir', here.x, here.z, 7); }
      else if (what === 'held') c.env.play('click', here.x, here.z, 7);
      else if (what === 'wake') c.env.play('beep', desk.x, desk.z, 7);
      else if (what === 'up' || what === 'down') c.env.play('shutter', there.x, there.z, 10);
    }
    draw();
  });
  c.rt.cover = { get state() { return st; }, layout: L };                // (for the dev page and for scripts)
}
