// The Backrooms — what there is to bring back: the office's keycard for this
// place, and its coins (core/game.mjs). Which of them are still to be found is
// the office's to say (office.game); where the coins hang is the generator's
// business (gen.js); the card is in the mascot's hand (pursuer.js). This file
// hangs the coins up, notices you walking into one, and keeps count of what
// you are carrying — and carrying is all it is. Only when you leave by the
// door is the office told. Get caught, or stop the tape, and every bit of it
// is down here again next time.
import * as THREE from 'three';
import { Batch } from './kit.js';
import { coin } from '../props/loot.js';

const HIDEOUT = 'backrooms';
const SIZE = 1.1, HOVER = 0.5, REACH = 0.6;        // a coin's scale (1 is the office's: 22 cm across) · how high it hangs · how near takes it
const VOX = 0.025;

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
 * @param env     the level's shared context (index.js): level, kit, hud, sound, and later world and player
 * @param office  whose game keeps the record
 * @returns null if this visit hides nothing; else { carried, pocket(item, n), forfeit(), update(dt, t, playing), bank(), report() }
 */
export function createLoot(env, office) {
  const { level, kit, hud, sound } = env, game = office.game;
  if (!level.loot) return null;
  const carried = { card: false, coins: [] }, coins = [];
  let kept = null;
  const show = () => hud.carry({ card: carried.card, coins: carried.coins.length });

  /** Where a coin really goes: the spot the generator chose if you can walk to it, else the nearest floor that you can. */
  function settle(c, k) {
    const walk = c.world.walkable(c.rt), seen = walk.flood(c.room.doors);
    const ok = (x, z) => Math.abs(x) < c.W / 2 && Math.abs(z) < c.D / 2 && seen[walk.key({ x, z })] === 1 && walk.free(x, z);
    let x = k.x, z = k.z, moved = false, best = Infinity;
    if (!ok(x, z)) for (let i = 0; i < seen.length; i++) {
      if (!seen[i]) continue;
      const p = walk.at(i);
      if (!walk.free(p.x, p.z)) continue;
      const roomy = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([di, dj]) => ok(p.x + di * walk.cell * 2, p.z + dj * walk.cell * 2));     // not wedged in between two things, if there is a choice
      const d = Math.hypot(p.x - k.x, p.z - k.z) + (roomy ? 0 : 0.75);
      if (d < best) { best = d; x = p.x; z = p.z; moved = true; }
    }
    return { x, z, y: walk.floor(x, z), moved };
  }

  /** One coin, turning in the air: its own small mesh, lit by its room like everything else in it. */
  function hang(c, k) {
    const at = settle(c, k), y = at.y + HOVER, s = VOX * SIZE, b = new Batch(true);
    b.addVox(kit.model('loot:coin', coin).solid, new THREE.Matrix4().compose(new THREE.Vector3(at.x, y, at.z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    const node = c.dynamic(b, { pivot: [at.x, y, at.z] }), w = c.toWorld(at.x, at.z);
    coins.push({ n: k.n, rt: c.rt, node, y, x: at.x, z: at.z, wx: w.x, wz: w.z, wy: c.room.y + at.y, phase: k.n * 1.7, gone: 0, moved: at.moved });
  }

  /** world.js calls this for every room once its furniture is in. */
  env.stash = (c) => {
    for (const k of level.loot.coins) {
      if (k.room !== c.room.id) continue;
      try { hang(c, k); } catch (err) { console.warn('[backrooms] a coin would not hang', err); }
    }
  };

  /** Something is picked up: carried from now on, not yet kept. (The card: pursuer.js, when it is taken out of the mascot's hand.) */
  function pocket(item, n) {
    if (item === 'card') { if (carried.card) return; carried.card = true; sound.play('clack'); }
    else { if (carried.coins.includes(n)) return; carried.coins.push(n); carried.coins.sort((a, b) => a - b); sound.play('ding', { vol: 0.6 }); }
    show();
  }

  return {
    carried, pocket,
    /** It has its card back. */
    forfeit() { if (carried.card) { carried.card = false; show(); } },
    update(dt, t, playing) {
      const me = env.player.me;
      for (const k of coins) {
        if (k.gone >= 1 || !k.rt.group.visible) continue;
        if (!k.gone) {
          k.node.rotation.y = t * 1.8 + k.phase;
          k.node.position.y = k.y + Math.sin(t * 2.4 + k.phase) * 0.05;
          if (!playing || !k.rt.near || Math.hypot(me.x - k.wx, me.z - k.wz) > REACH || Math.abs(env.world.floorY(me.x, me.z) - k.wy) > 0.7) continue;
          k.gone = 1e-6;
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
    /** You left by the door: what you carried is yours. The office is told, one thing after another; nobody waits for its answer. */
    bank() {
      if (kept) return kept;
      kept = { card: carried.card, coins: carried.coins.slice() };
      (async () => {
        if (kept.card) await game.take(HIDEOUT, 'card', undefined, { quiet: true });
        for (const n of kept.coins) await game.take(HIDEOUT, 'coin', n, { quiet: true });
      })().catch((err) => console.warn('[backrooms] the office could not be told', err));
      return kept;
    },
    /** For the dev page: where everything is and what has become of it. */
    report: () => ({ card: level.loot.card, coins: coins.map((k) => ({ n: k.n, room: k.rt.id, x: +k.x.toFixed(2), z: +k.z.toFixed(2), wx: +k.wx.toFixed(2), wz: +k.wz.toFixed(2), moved: k.moved, taken: k.gone > 0 })), carried: { card: carried.card, coins: carried.coins.slice() }, kept }),
  };
}
