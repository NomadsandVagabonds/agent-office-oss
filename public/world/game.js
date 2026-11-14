// The Office — the long game, from the browser's side: what is still hidden
// on a floor, picking it up, and the small purse that shows for a moment when
// you do. The rules are in core/game.mjs and the office keeps the record
// (server/world/game.mjs); this only asks, tells, and remembers until the
// office has answered.
//
//   office.game.left('pasture')            → { card: true, coins: [1, 3] }   what has not been taken yet
//   office.game.take('pasture', 'coin', 3) → Promise<answer>                 it is yours (and gone from the floor)
//   office.game.view()                     → what the office says (open floors, the jar, prizes), or null
import { h } from './ui/dom.js';
import { hideoutById } from '/core/game.mjs';

export function createGame(office) {
  const net = office.net;
  const taken = new Set();                 // 'pasture:coin:2' — picked up here, not yet confirmed back
  let purse = null, purseTimer = null;
  const key = (hideout, item, n) => `${hideout}:${item}:${item === 'coin' ? n : 0}`;
  const view = () => net.state.world?.game || null;

  /** What is still there to find on a floor. A floor the office knows nothing of has nothing. */
  function left(hideoutId) {
    const hideout = hideoutById(hideoutId), loot = view()?.loot?.[hideoutId];
    if (!hideout) return { card: false, coins: [] };
    const got = new Set(loot?.coins || []);
    const coins = [];
    for (let n = 1; n <= hideout.coins; n++) if (!got.has(n) && !taken.has(key(hideoutId, 'coin', n))) coins.push(n);
    return { card: !(loot?.card) && !taken.has(key(hideoutId, 'card')), coins };
  }

  /** The purse: a coin and how many are in the jar, or a keycard, shown for a moment and then gone. */
  function flash(item, count) {
    const root = document.getElementById('ui');
    if (!root) return;
    if (!purse) purse = h('div.purse');
    if (purse.parentNode !== root || purse.nextSibling) root.append(purse);       // over whichever floor you are on
    purse.replaceChildren(item === 'card' ? h('i.card') : h('i.coin'), item === 'card' ? '' : h('b', String(count)));
    purse.classList.remove('show'); void purse.offsetWidth; purse.classList.add('show');
    clearTimeout(purseTimer);
    purseTimer = setTimeout(() => purse?.classList.remove('show'), 2600);
  }

  /**
   * Pick something up. Resolves with the office's answer ({ taken, opened?, coins, … }) or null if it could not be told.
   * opt.quiet: no sound and no purse (a floor that shows what you carry in its own way).
   */
  async function take(hideoutId, item, n, opt = {}) {
    const k = key(hideoutId, item, n);
    if (taken.has(k)) return null;
    taken.add(k);
    if (!opt.quiet) {
      try { office.sound?.play?.(item === 'card' ? 'discovery' : 'coin'); } catch { /* a sound is a nicety */ }
      flash(item, (view()?.coins?.have ?? 0) + (item === 'coin' ? 1 : 0));
    }
    try {
      const answer = await net.api('/api/world/game/collect', { method: 'POST', body: { hideout: hideoutId, item, n: item === 'coin' ? n : undefined, name: office.walk?.me?.name || 'Lead' } });
      if (net.state.world && answer?.open) net.state.world.game = { ...(net.state.world.game || {}), ...answer };    // the bus says the same a moment later
      if (!opt.quiet && item === 'coin' && answer?.coins) flash('coin', answer.coins.have);
      return answer;
    } catch (err) {
      taken.delete(k);                       // it is still there, then
      console.warn('[game] that could not be picked up:', err.message);
      return null;
    }
  }

  return { view, left, take, flash };
}
