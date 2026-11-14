// The Backrooms — what there is to bring back: the office's keycard for this
// place, and its coins (core/game.mjs). Down here a coin is not a coin: it is
// a video cassette somebody labelled by hand, and the camcorder shows a small
// cassette for each one you are carrying. The office's ledger knows nothing
// of that — a tape carried out through the wall is one coin in its jar, the
// coin with that tape's number, exactly as before. Which of them are still to
// be found is the office's to say (office.game); where they hang is the generator's
// business (gen.js, and plan.js for which floor); the card is in the mascot's
// hand (pursuer.js). This file hangs the coins up, notices you walking into
// one, and keeps count of what you are carrying — and carrying is all it is.
// Only when you leave by the door is the office told. Get caught, or stop the
// tape, and every bit of it is down here again next time. The coins change
// nothing else about a floor: every room is furnished exactly as it would be
// with nothing to find. (The card does change one thing: a visit that would
// have had no mascot has one.)
//
// What you carry comes down the stairs with you, so the count belongs to the
// visit (createLoot) and only the coins themselves to a floor (hang).
import * as THREE from 'three';
import { Vox, M, glow } from '../vox/vox.js';
import { Batch, drawText } from './kit.js';
import { coinFits } from './gen.js';

const HIDEOUT = 'backrooms';
const SIZE = 0.56, HOVER = 0.5, REACH = 0.6;       // a tape's scale (one voxel: 1.4 cm, so that it is 28 cm long and can be seen across a room) · how high it hangs · how near takes it

/**
 * A video cassette, standing on its long edge: 20 × 12 × 3. It turns in the air, so both faces are the face — two
 * windows with a hub in each, and a label — or from half the room it would be a black book. The labels are white,
 * and what is written on them is drawn on afterwards.
 */
function cassette() {
  const v = new Vox(), shell = M('#1d1d21', 0), sticker = glow('#f1ecdd'), win = M('#59616b', 0), hub = glow('#e9e6da'), reel = M('#0d0b0a', 0);
  v.box(-10, 0, -1, 10, 12, 2, shell);
  v.box(-8, 11, -1, 8, 12, 2, sticker);                        // the spine: the edge that shows on a shelf
  for (const z of [1, -1]) {
    v.box(-8, 7, z, 8, 11, z + 1, sticker);                    // the face label
    for (const x of [-8, 2]) v.box(x, 1, z, x + 6, 6, z + 1, win);
    // most of the tape is on one reel: it has been watched nearly to the end
    const full = z > 0 ? -8 : 2, thin = z > 0 ? 2 : -8;
    v.box(full, 1, z, full + 6, 6, z + 1, reel); v.box(thin + 2, 2, z, thin + 4, 5, z + 1, reel);
    v.box(full + 2, 3, z, full + 4, 4, z + 1, hub); v.box(thin + 2, 3, z, thin + 4, 4, z + 1, hub);
  }
  return v;
}

/** What the office says is still down here → { card, coins: [numbers] }, or null: nothing left, or no office keeping count. */
export function lootLeft(office) {
  const game = office?.game;
  if (!game || typeof game.left !== 'function' || typeof game.take !== 'function') return null;
  let left = null;
  try { left = game.left(HIDEOUT); } catch { return null; }
  const coins = (Array.isArray(left?.coins) ? left.coins : []).filter((n) => Number.isInteger(n) && n >= 1);
  return left && (left.card || coins.length) ? { card: !!left.card, coins } : null;
}

/**
 * @param office  whose game keeps the record
 * @param hud, sound  the camcorder's overlay and the level's sound (index.js)
 * @returns { carried, pocket(item, n), forfeit(), hang(env), update(dt, t, playing), bank(), report() } — for the whole visit
 */
export function createLoot(office, { hud, sound }) {
  const game = office.game;
  const carried = { card: false, coins: [] };
  let kept = null, coins = [], env = null, kit = null, shine = null, hidden = null;
  const sets = new WeakMap();
  const show = () => hud.carry({ card: carried.card, coins: carried.coins.length });

  /**
   * Where a coin really goes. The generator chose a spot without knowing what the room would be furnished with; the
   * furniture is where it would have been anyway, so now and then something stands on that spot or walls it in. Then
   * the coin moves to the nearest floor that can be walked to — floor the generator would have accepted, if there is
   * any, and not wedged in between two things, if there is a choice.
   */
  function settle(c, k) {
    const walk = c.world.walkable(c.rt), seen = walk.flood(c.room.doors);
    const ok = (x, z) => Math.abs(x) < c.W / 2 && Math.abs(z) < c.D / 2 && seen[walk.key({ x, z })] === 1 && walk.free(x, z);
    let x = k.x, z = k.z, moved = false, best = Infinity;
    if (!ok(x, z)) for (let i = 0; i < seen.length; i++) {
      if (!seen[i]) continue;
      const p = walk.at(i);
      let d = Math.hypot(p.x - k.x, p.z - k.z);
      if (d >= best || !walk.free(p.x, p.z)) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([di, dj]) => ok(p.x + di * walk.cell * 2, p.z + dj * walk.cell * 2))) d += 0.75;
      if (d < best && !coinFits(c.room, p.x, p.z)) d += 6;
      if (d < best) { best = d; x = p.x; z = p.z; moved = true; }
    }
    return { x, z, y: walk.floor(x, z), moved };
  }

  /** A pool of light that is brightest in the middle and gone by the edge. */
  const halo = () => {
    const t = kit.tex.custom('coinshine', 32, 32, (g) => {
      const k = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      for (const [at, a] of [[0, 1], [0.22, 0.52], [0.5, 0.17], [0.78, 0.04], [1, 0]]) k.addColorStop(at, `rgba(255,255,255,${a})`);
      g.fillStyle = k; g.fillRect(0, 0, 32, 32);
    }, { clamp: true });
    t.magFilter = THREE.LinearFilter;
    return t;
  };
  /** One tape, turning in the air: its own small mesh, lit by its room like everything else in it — and a little light on the carpet under it. */
  function hangOne(c, k) {
    const at = settle(c, k), y = at.y + HOVER, s = kit.VOXEL * SIZE, b = new Batch(true);
    b.addVox(kit.model('loot:tape', cassette).solid, new THREE.Matrix4().compose(new THREE.Vector3(at.x, y, at.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    const node = c.dynamic(b, { pivot: [at.x, y, at.z] }), w = c.toWorld(at.x, at.z);
    // what somebody wrote on it: once across the face, once along the spine (unlit, like the white it is written on)
    const words = (k.label || ['', '']).filter(Boolean), text = kit.tex.custom('tape:' + words.join('|'), 128, 32, (g, tw, th) => {
      g.fillStyle = '#f1ecdd'; g.fillRect(0, 0, tw, th);
      drawText(g, words.length ? words : ['·'], 0, 0, tw, th, { color: '#1f2a52', size: words.length > 1 ? 13 : 17, pad: 8, weight: 700, font: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' });
    }, { clamp: true });
    const lb = new Batch(), fz = 2 * s + 0.002, fy0 = 7 * s, fy1 = 11 * s, hx = 8 * s, ty = 12 * s + 0.002;
    lb.quad([-hx, fy0, fz], [hx, fy0, fz], [hx, fy1, fz], [-hx, fy1, fz]);
    lb.quad([hx, fy0, -s - 0.002], [-hx, fy0, -s - 0.002], [-hx, fy1, -s - 0.002], [hx, fy1, -s - 0.002]);
    lb.quad([-hx, ty, 2 * s], [hx, ty, 2 * s], [hx, ty, -1 * s], [-hx, ty, -1 * s], undefined, [[0, 0.2], [1, 0.2], [1, 0.8], [0, 0.8]]);
    const label = new THREE.Mesh(kit.plain(lb), kit.glowing(text, 1.5));
    node.add(label);
    let pool = null;
    if (c.room.arch !== 'stress-pool') {                      // (out in the ball pit there is no carpet under it to light)
      shine ||= [kit.own(new THREE.PlaneGeometry(1.7, 1.7)), kit.own(new THREE.MeshBasicMaterial({ map: halo(), color: new THREE.Color().setRGB(0.2, 0.2, 0.17), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))];
      pool = c.add(new THREE.Mesh(shine[0], shine[1]));
      pool.rotation.x = -Math.PI / 2; pool.position.set(at.x, at.y + 0.016, at.z); pool.renderOrder = 2;
    }
    coins.push({ n: k.n, rt: c.rt, node, pool, y, x: at.x, z: at.z, wx: w.x, wz: w.z, wy: c.room.y + at.y, phase: k.n * 1.7, gone: 0, moved: at.moved });
  }

  /**
   * A new floor: its coins are hung as its rooms are built (world.js calls env.stash for every room once its furniture
   * is in), and the ones on the floor above are forgotten along with it.
   */
  function hang(next) {
    // (the part below is built while this one is still being walked, so each keeps its own: `attend` says which is underfoot)
    const mine = { env: next, kit: next.kit, coins: [], shine: null, hidden: next.level.loot || null };
    sets.set(next, mine);
    next.stash = mine.hidden ? (c) => {
      const was = [env, kit, coins, shine, hidden];
      [env, kit, coins, shine, hidden] = [mine.env, mine.kit, mine.coins, mine.shine, mine.hidden];
      for (const k of mine.hidden.coins) {
        if (k.room !== c.room.id) continue;
        try { hangOne(c, k); } catch (err) { console.warn('[backrooms] a coin would not hang', err); }
      }
      mine.shine = shine;
      [env, kit, coins, shine, hidden] = was;
    } : null;
    if (!env) attend(next);
  }
  /** This is the part somebody is in now. */
  function attend(next) {
    const mine = sets.get(next); if (!mine) return;
    ({ env, kit, coins, shine, hidden } = mine);
  }

  /** Something is picked up: carried from now on, not yet kept. (The card: pursuer.js, when it is taken out of the mascot's hand.) */
  function pocket(item, n) {
    if (item === 'card') { if (carried.card) return; carried.card = true; sound.play('clack'); }
    else { if (carried.coins.includes(n)) return; carried.coins.push(n); carried.coins.sort((a, b) => a - b); sound.play('ding', { vol: 0.6 }); }
    show();
  }

  return {
    carried, pocket, hang, attend,
    /** It has its card back. */
    forfeit() { if (carried.card) { carried.card = false; show(); } },
    update(dt, t, playing) {
      if (!env || !env.player) return;
      const me = env.player.me;
      for (const k of coins) {
        if (k.gone >= 1 || !k.rt.group.visible) continue;
        if (!k.gone) {
          k.node.rotation.y = t * 1.8 + k.phase;
          k.node.position.y = k.y + Math.sin(t * 2.4 + k.phase) * 0.05;
          if (!playing || !k.rt.near || Math.hypot(me.x - k.wx, me.z - k.wz) > REACH || Math.abs(env.world.floorY(me.x, me.z) - k.wy) > 0.7) continue;
          k.gone = 1e-6;
          if (k.pool) k.pool.visible = false;
          pocket('coin', k.n);
        } else {                                              // taken: it leaps, spins and is gone, as on every other floor
          k.gone = Math.min(1, k.gone + dt / 0.55);
          k.node.rotation.y += dt * 16;
          k.node.position.y = k.y + Math.sin(k.gone * Math.PI) * 0.45 + k.gone * 0.35;
          k.node.scale.setScalar(Math.max(0.001, 1 - k.gone * k.gone));
          if (k.gone >= 1) k.node.visible = false;
        }
      }
    },
    /**
     * You left by the door: what you carried is yours. The office is told, one thing after another; the tape does not
     * wait for its answer (kept.told settles when the office has heard it all, for whoever does want to wait).
     */
    bank() {
      if (kept) return kept;
      kept = { card: carried.card, coins: carried.coins.slice() };
      kept.told = (async () => {
        if (kept.card) await game.take(HIDEOUT, 'card', undefined, { quiet: true });
        for (const n of kept.coins) await game.take(HIDEOUT, 'coin', n, { quiet: true });
      })().catch((err) => console.warn('[backrooms] the office could not be told', err));
      return kept;
    },
    /** For the dev page: where everything is and what has become of it. */
    report: () => ({ card: !!(hidden && hidden.card), coins: coins.map((k) => ({ n: k.n, room: k.rt.id, x: +k.x.toFixed(2), z: +k.z.toFixed(2), wx: +k.wx.toFixed(2), wz: +k.wz.toFixed(2), moved: k.moved, taken: k.gone > 0 })), carried: { card: carried.card, coins: carried.coins.slice() }, kept: kept && { card: kept.card, coins: kept.coins.slice() } }),
  };
}
