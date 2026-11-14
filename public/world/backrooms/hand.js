// The Backrooms — the free hand (the other holds the camcorder). Whatever you
// pick up down here is shown in the corner of the picture itself, in 3D, with
// no overlay: a sheaf of memos, a pink slip, a red balloon bobbing on a string,
// or a yellow facilities flashlight.
import * as THREE from 'three';
import { Vox, M, glow } from '../vox/vox.js';
import { Batch, lamp, lin, drawText, WHITE } from './kit.js';
import { P } from './bits.js';
import { ITEM_IDS, createBag, isPaper, isBalloon, isFlashlight } from './items.js';

export { ITEM_IDS, isPaper, isBalloon, isFlashlight };

function paperSheetTex(kit, kind) {
  const pink = kind === 'pink-slip';
  return kit.tex.custom('itemtex:' + kind, 96, 128, (g, w, h) => {
    P(g, pink ? '#f3b3c0' : '#f1ede0', 0, 0, w, h);
    P(g, pink ? '#a62639' : '#2b3a52', 6, 7, w - 12, 18);
    drawText(g, [pink ? 'PINK SLIP' : 'INTERNAL MEMO'], 6, 8, w - 12, 16, { color: '#fff8f0', size: 10, pad: 3 });
    if (pink) {
      drawText(g, ['FORM HR-404', 'REDUNDANCY'], 6, 29, w - 12, 24, { color: '#6b1420', size: 9, pad: 3, leading: 1.15 });
      P(g, '#c86475', 10, 58, w - 20, 2);
    } else {
      P(g, '#8a94a2', 10, 32, w - 28, 3);
      P(g, '#b5483f', w - 18, 0, 5, 16);             // a red paperclip on the corner
    }
    for (let y = pink ? 66 : 44; y < h - 14; y += 9) P(g, pink ? '#c97a88' : '#b2aba0', 10, y, w - 20 - ((y * 7) % 18), 2);
  }, { clamp: true });
}

function balloonVox() {
  const v = new Vox(), red = M('#cf2323', 1), hi = M('#f26b6b', 0), knot = M('#8f1414', 1);
  v.ellipsoid(0, 11, 0, 5.6, 6.8, 5.6, red);
  v.box(-3, 13, 3, -1, 16, 5, hi);                  // glossy catchlight
  v.box(-1, 3, -1, 1, 5, 1, knot);
  return v;
}

function torchVox() {
  const v = new Vox(), yel = M('#d9a326', 1), blk = M('#1e2026', 2), rim = M('#3a3e48', 1), lens = glow('#fff4c8');
  v.cyl('z', 0, 0, -7, 7, 2.3, yel);
  v.cyl('z', 0, 0, -2, 4, 2.5, blk);                // rubberised grip
  v.box(-1, 2, -1, 1, 3, 2, M('#b5382e', 1));       // thumb switch
  v.cyl('z', 0, 0, -10, -7, 3.3, rim);              // octagonal-feel bezel
  v.cyl('z', 0, 0, -10.4, -9.8, 2.5, lens);
  return v;
}

/** Build a compact 3D mesh group for `kind` (`view = true` for camera-space, `false` for lying in a room). */
export function buildItemProp(kit, kind, { view = false } = {}) {
  const group = new THREE.Group();
  const lights = [lamp(0.2, 2.0, 0.8, [1.25, 1.25, 1.25], { k: 8, wrap: 0.5, far: 20 })], amb = [0.68, 0.68, 0.68];
  if (kind === 'papers' || kind === 'pink-slip') {
    const tex = paperSheetTex(kit, kind);
    const b = new Batch(), under = new Batch();
    const w = view ? 0.105 : 0.21, d = view ? 0.14 : 0.28;
    const baseCol = lin(kind === 'pink-slip' ? '#e29aa8' : '#dfd9c8');
    if (view) {
      // held tilted toward the lens so the heading can be read right-side up
      b.quad([-w / 2, -d / 2, 0.004], [w / 2, -d / 2, 0.004], [w / 2, d / 2, 0.004], [-w / 2, d / 2, 0.004], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      under.box(-w / 2 - 0.004, -d / 2 - 0.004, -0.006, w / 2 + 0.004, d / 2 + 0.002, 0.003, baseCol);
    } else {
      b.quad([-w / 2, 0.018, d / 2], [w / 2, 0.018, d / 2], [w / 2, 0.018, -d / 2], [-w / 2, 0.018, -d / 2], WHITE, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      under.box(-w / 2 - 0.008, 0, -d / 2 - 0.006, w / 2 + 0.008, 0.016, d / 2 + 0.006, baseCol, { skip: '-y' });
    }
    const mSheet = kit.surface({ map: tex }), mStack = kit.surface({});
    group.add(new THREE.Mesh(kit.geometry(under, lights, amb), mStack));
    group.add(new THREE.Mesh(kit.geometry(b, lights, amb), mSheet));
    group.userData.mats = [mSheet, mStack];
  } else if (kind === 'balloon') {
    const sc = view ? 0.0082 : 0.019;
    const m4 = new THREE.Matrix4().makeScale(sc, sc, sc);
    const stringH = view ? 0.135 : 0.72;
    m4.setPosition(0, stringH, 0);
    const b = new Batch(true);
    b.addVox(kit.model('item:balloon', balloonVox).solid, m4);
    const lineB = new Batch();
    const r = view ? 0.0014 : 0.003;
    lineB.box(-r, 0, -r, r, stringH + sc * 4, r, [0.75, 0.72, 0.68]);
    if (!view) lineB.box(-0.035, 0, -0.035, 0.035, 0.022, 0.035, [0.35, 0.34, 0.38], { skip: '-y' });
    const mVox = kit.surface({ vox: true }), mLine = kit.surface({});
    group.add(new THREE.Mesh(kit.geometry(b, lights, amb), mVox));
    group.add(new THREE.Mesh(kit.geometry(lineB, lights, amb), mLine));
    group.userData.mats = [mVox, mLine];
  } else if (kind === 'flashlight') {
    const sc = view ? 0.0072 : 0.017;
    const m4 = new THREE.Matrix4().makeScale(sc, sc, sc);
    if (!view) m4.setPosition(0, 3.2 * sc, 0);
    const b = new Batch(true);
    b.addVox(kit.model('item:torch', torchVox).solid, m4);
    const mVox = kit.surface({ vox: true });
    group.add(new THREE.Mesh(kit.geometry(b, lights, amb), mVox));
    group.userData.mats = [mVox];
  }
  group.userData.light = (rgb) => {
    for (const m of group.userData.mats || []) m.uniforms.uTint.value.set(rgb[0], rgb[1], rgb[2]);
  };
  return group;
}

/** Attach the 3D held-item rig to a floor's `env`. */
export function createHand(env, camera, initial = null) {
  const bag = createBag(initial);
  const root = new THREE.Group();
  const views = new Map();
  for (const id of ITEM_IDS) {
    const g = buildItemProp(env.kit, id, { view: true });
    g.visible = false;
    // sit inside the 0.22 m body cylinder and past the 0.06 m near plane
    if (id === 'balloon') { g.position.set(0.105, -0.068, -0.215); g.rotation.set(0.06, -0.2, 0.04); }
    else if (id === 'flashlight') { g.position.set(0.105, -0.092, -0.22); g.rotation.set(0.08, 0.22, 0); }
    else { g.position.set(0.096, -0.088, -0.215); g.rotation.set(-0.28, -0.24, 0.06); }
    g.userData.home = g.position.clone();
    g.userData.homeRot = g.rotation.clone();
    root.add(g);
    views.set(id, g);
  }

  const syncVisible = () => {
    const cur = bag.get();
    for (const [id, g] of views) g.visible = id === cur;
  };
  syncVisible();

  (env.ready || (env.ready = [])).push(() => { env.world.scene.add(root); });

  let bobPhase = 0;
  const hand = {
    get: () => bag.get(),
    has: (k) => bag.has(k),
    hasPaper: () => bag.hasPaper(),
    hasBalloon: () => bag.hasBalloon(),
    hasFlashlight: () => bag.hasFlashlight(),
    swap(next = null) {
      const prev = bag.swap(next);
      syncVisible();
      return prev;
    },
    give(next) {
      if (!ITEM_IDS.includes(next)) return false;
      bag.swap(next);
      syncVisible();
      return true;
    },
    consume(pred) {
      const got = bag.consume(pred);
      if (got) syncVisible();
      return got;
    },
    /** Extra torch power when holding the facilities flashlight. */
    torchPower: () => (bag.hasFlashlight() ? 0.92 : 0),
    update(dt, time) {
      if (!env.world || !env.player) return;
      const me = env.player.me;
      root.position.copy(camera.position);
      root.quaternion.copy(camera.quaternion);
      const cur = bag.get();
      if (!cur) return;
      const g = views.get(cur);
      bobPhase += dt * (me.moving ? 7.5 : 1.8);
      const amp = me.moving ? 0.0055 : 0.0016;
      const h = g.userData.home, hr = g.userData.homeRot;
      g.position.set(h.x + Math.cos(bobPhase * 0.5) * amp, h.y + Math.sin(bobPhase) * amp, h.z);
      if (cur === 'balloon') g.rotation.z = hr.z + Math.sin(time * 2.1) * 0.07;
      const L = env.world.lightAt(me.x, me.z, 1.0);
      const boost = cur === 'flashlight' ? 0.45 : 0.22;
      g.userData.light([Math.max(boost, L[0]), Math.max(boost, L[1]), Math.max(boost, L[2])]);
    },
    dispose() { root.removeFromParent(); },
  };
  env.hand = hand;
  return hand;
}

/**
 * Put a pickup item in a room at local `(x, z)` and height `y`. Pressing E takes
 * it — or swaps it cleanly with whatever was already in your hand so nothing can
 * ever be lost.
 */
export function placePickup(c, initialKind, x, z, y = 0, opt = {}) {
  let slot = ITEM_IDS.includes(initialKind) ? initialKind : null;
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  if (opt.rot) holder.rotation.y = opt.rot;
  c.rt.group.add(holder);

  const models = new Map();
  const ensure = (k) => {
    if (!k || models.has(k)) return models.get(k);
    const m = buildItemProp(c.kit, k, { view: false });
    holder.add(m);
    models.set(k, m);
    return m;
  };
  ensure(slot);

  const refresh = () => {
    for (const [k, m] of models) m.visible = k === slot;
    const L = c.sample(x, y + 0.35, z);
    const lit = [Math.max(0.2, L[0]), Math.max(0.2, L[1]), Math.max(0.2, L[2])];
    for (const m of models.values()) m.userData.light(lit);
  };
  c.after.push(refresh);

  if (slot === 'balloon') {
    c.tick((dt, t) => {
      const m = models.get('balloon');
      if (m && m.visible) m.rotation.z = Math.sin(t * 1.7 + x) * 0.06;
    });
  }

  const w = c.toWorld(x, z);
  c.use({
    x, z, r: opt.r ?? 1.5, cone: opt.cone ?? 0.45,
    label: opt.label || `take ${initialKind}`,
    when: () => slot !== null && !!c.env.hand,
    use: () => {
      const hand = c.env.hand; if (!hand || !slot) return;
      const taking = slot;
      const prev = hand.swap(taking);
      slot = prev;                                    // if you were holding something else, leave it here
      if (slot) ensure(slot);
      refresh();
      c.env.play(isPaper(taking) ? 'rustle' : taking === 'flashlight' ? 'click' : 'squeak', w.x, w.z, 4);
      opt.onTake?.(taking, prev);
    },
  });

  return { get: () => slot, set(next) { slot = next; if (slot) ensure(slot); refresh(); } };
}
