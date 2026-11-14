// The Office — the long game, from the browser's side: what is still hidden
// on a floor, picking it up, and the small purse that shows for a moment when
// you do. The rules are in core/game.mjs and the office keeps the record
// (server/world/game.mjs); this only asks, tells, and remembers until the
// office has answered.
//
//   office.game.left('pasture')            → { card: true, coins: [1, 3] }   what has not been taken yet
//   office.game.take('pasture', 'coin', 3) → Promise<answer>                 it is yours (and gone from the floor)
//   office.game.earn('backrooms', { batteries: 3 }) → Promise<answer>        got out of a place that pays for what is carried out
//   office.game.report('backrooms', run)   → Promise<card>                   a visit there is over: the office's card for it
//   office.game.view()                     → what the office says (open floors, the jar, prizes), or null
//
// The purse also shows whenever the jar has more in it than it last said, however
// that came about: a stamp in somebody's passport pays a coin (core/game.mjs), and
// that is the one place a person can see that it does.
import { h } from './ui/dom.js';
import { hideoutById } from '/core/game.mjs';

export function createGame(office) {
  const net = office.net;
  const taken = new Set();                 // 'pasture:coin:2' — picked up here, not yet confirmed back
  let purse = null, purseTimer = null;
  let jar = null;                          // what the purse last said is in the jar (null: it has not said anything yet)
  let last = { item: null, at: 0 }, next = null, nextTimer = null;
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

  /**
   * The purse: a coin and how many are in the jar, or a keycard, shown for a moment and then gone. A card and a coin
   * never talk over each other: whichever is showing is given time to be read, and the other follows it.
   */
  function flash(item, count) {
    const root = document.getElementById('ui');
    if (!root) return;
    const now = Date.now(), wait = last.item && last.item !== item ? 1100 - (now - last.at) : 0;
    if (wait > 0) {
      next = [item, count];
      clearTimeout(nextTimer);
      nextTimer = setTimeout(() => { const n = next; next = null; if (n) flash(n[0], n[1]); }, wait);
      return;
    }
    if (next && next[0] === item) { next = null; clearTimeout(nextTimer); }
    last = { item, at: now };
    if (item === 'coin') jar = count;
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

  /**
   * Somebody got out of a place that pays for what is carried out of it (core/game.mjs: `pay`). Resolves with the
   * office's answer ({ paid, best, coins, … }: paid is what this beat the office's best by, which may be nothing) or
   * null if it could not be told; the purse shows a fuller jar by itself.
   */
  async function earn(hideoutId, carried = {}) {
    if (!(carried.batteries > 0)) return null;
    try {
      const answer = await net.api('/api/world/game/earn', { method: 'POST', body: { hideout: hideoutId, batteries: carried.batteries, name: office.walk?.me?.name || 'Lead' } });
      if (net.state.world && answer?.open) net.state.world.game = { ...(net.state.world.game || {}), ...answer };    // the bus says the same a moment later
      return answer;
    } catch (err) {
      console.warn('[game] the jar could not be paid:', err.message);
      return null;
    }
  }

  /**
   * A visit to the place that pays is over, however it ended. `run` is what the visit says of itself (core/runs.mjs).
   * Resolves with the office's card for it — score, best, what was new, what the jar gained, the tape — or null if
   * the office could not be asked (whoever shows the card then makes do with what it can work out itself).
   */
  async function report(hideoutId, run) {
    try {
      const answer = await net.api('/api/world/game/run', { method: 'POST', body: { hideout: hideoutId, run, name: office.walk?.me?.name || 'Lead' } });
      if (net.state.world && answer?.open) { const { card, ...rest } = answer; net.state.world.game = { ...(net.state.world.game || {}), ...rest }; }    // the bus says the same a moment later
      return answer?.card || null;
    } catch (err) {
      console.warn('[game] the office could not be told how that went:', err.message);
      return null;
    }
  }

  /**
   * Has the jar more in it than the purse last said? Then it says so: a stamp was earned (by anybody), or something
   * was carried out of a place that keeps its own count until you leave. Not while that place has the screen — the
   * purse could not be seen — so whatever arrived meanwhile is shown when you are back.
   */
  function show() {
    const have = view()?.coins?.have;
    if (typeof have !== 'number') return;
    if (jar === null || have < jar) { jar = have; return; }
    if (have > jar && !document.body.classList.contains('noclip')) flash('coin', have);
  }
  net.on?.('world', show);

  return { view, left, take, earn, report, flash, show };
}
