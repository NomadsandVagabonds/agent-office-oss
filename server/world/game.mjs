// The Office — the long game's record: which keycards have been found, which
// coins have been picked up, what has been bought. The rules are in
// core/game.mjs; this is the office's memory of them, kept in the world store
// so that it outlives browsers and is the same for everyone looking at this
// office. The jar is the office's: whoever finds a coin, it goes in the same
// jar, and what is bought stands where everybody can see it.
import crypto from 'node:crypto';
import { HIDEOUTS, PRIZES, STAMP_COINS, dealOrder, findPrize, hideoutById, jarOf, openFloors, payFor } from '../../core/game.mjs';
import { levelById } from '../../core/levels.mjs';
import { cleanRecord, cleanRun, settleRun } from '../../core/runs.mjs';

const fail = (status, error) => ({ error, status });
const PAID_KEPT = 30;                    // how many visits that were worth something are remembered

/**
 * @param {object} ctx
 * @param {object} state   the world store's data (this keeps its part under `state.game`)
 * @param {{save:()=>void, changed:()=>void}} hooks   changed: tell everyone the world is different
 */
export function createGame(ctx, state, hooks) {
  const rand = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;
  const g = state.game && typeof state.game === 'object' ? state.game : (state.game = {});
  g.cards = g.cards && typeof g.cards === 'object' ? g.cards : {};
  g.coins = g.coins && typeof g.coins === 'object' ? g.coins : {};
  g.prizes = g.prizes && typeof g.prizes === 'object' ? g.prizes : {};
  g.visited = Array.isArray(g.visited) ? g.visited : [];
  g.spent = Number.isFinite(g.spent) && g.spent > 0 ? Math.floor(g.spent) : 0;
  // what the best visit so far was worth, which is what has been paid into the jar for visits (core/game.mjs: `pay`),
  // and the last few visits that were worth anything
  g.earned = Number.isFinite(g.earned) && g.earned > 0 ? Math.floor(g.earned) : 0;
  g.paid = Array.isArray(g.paid) ? g.paid.slice(-PAID_KEPT) : [];
  // the office's record of visits to the place that pays (core/runs.mjs): its best, what has been seen, the tapes kept
  g.record = cleanRecord(g.record);
  // Which floor is open to begin with, and which each card opens, is drawn once per office — and re-read every start,
  // so a floor added since joins the end of the queue and one that is gone leaves it.
  const before = JSON.stringify(g.order || []);
  g.order = dealOrder(g.order, rand);
  if (JSON.stringify(g.order) !== before) hooks.save();

  const cardCount = () => HIDEOUTS.filter((h) => g.cards[h.id]).length;
  const coinCount = () => HIDEOUTS.reduce((n, h) => n + Object.keys(g.coins[h.id] || {}).filter((k) => Number(k) >= 1 && Number(k) <= h.coins).length, 0);
  const stamps = () => Object.keys(state.discoveries || {}).length;
  const purse = () => {
    const coins = coinCount(), s = stamps();
    return { have: jarOf({ coins, stamps: s, earned: g.earned, spent: g.spent }), found: coins, earned: g.earned, stamps: s * STAMP_COINS, spent: g.spent };
  };
  const open = () => openFloors(g.order, cardCount());
  const nameOf = (by, extra) => (by ? by.name : String(extra?.name || 'Lead').slice(0, 60));

  /** What everyone may know: which buttons are lit, what has been found where, what is in the jar, what has been bought. */
  function view() {
    const lit = open();
    return {
      open: lit,
      dark: g.order.length - lit.length,
      // lit, but nobody has ridden there yet: the panel makes something of these
      fresh: lit.filter((id) => !g.visited.includes(id)),
      cards: HIDEOUTS.filter((h) => g.cards[h.id]).map((h) => h.id),
      spare: Math.max(0, 1 + cardCount() - g.order.length),
      loot: Object.fromEntries(HIDEOUTS.map((h) => [h.id, {
        card: !!g.cards[h.id], of: h.coins,
        coins: Object.keys(g.coins[h.id] || {}).map(Number).filter((n) => n >= 1 && n <= h.coins).sort((a, b) => a - b),
      }])),
      coins: purse(),
      prizes: PRIZES.filter((p) => g.prizes[p.id]).map((p) => p.id),
      // visits to the place that pays: how many, how many got out, the best, how much of it has been seen, the tapes kept
      visits: {
        n: g.record.runs, out: g.record.out, best: g.record.best,
        seen: { rooms: Object.keys(g.record.rooms).length, cast: Object.keys(g.record.cast).length },
        tapes: g.record.tapes.map((t) => ({ ...t })),
      },
    };
  }

  /**
   * Somebody picked something up. `item` is 'card' or 'coin' (with `n`, 1…the number hidden there).
   * Picking up what is already gone is not an error: the answer says `taken: false`.
   * Every answer carries the whole view as well, so the caller need not ask again.
   */
  function collect(hideoutId, item, n, by, extra = {}) {
    const hideout = hideoutById(String(hideoutId || ''));
    if (!hideout) return fail(404, 'nothing is hidden in a place called that');
    const who = nameOf(by, extra), at = Date.now();
    if (item === 'card') {
      if (g.cards[hideout.id]) return { ok: true, ...view(), taken: false, item: 'card' };
      const litBefore = open();
      g.cards[hideout.id] = { at, by: who };
      hooks.save();
      const opened = open().find((id) => !litBefore.includes(id)) || null;
      const floor = opened ? levelById(opened) : null;
      ctx.activity?.log('loot', `${who} found a keycard in ${hideout.name}`, { hideout: hideout.id, item: 'card', agentId: by?.id || null, ...(opened ? { opened } : {}) });
      hooks.changed();
      return { ok: true, ...view(), taken: true, item: 'card', opened: floor ? { id: floor.id, floor: floor.floor, name: floor.name } : null };
    }
    if (item === 'coin') {
      const k = Math.floor(Number(n));
      if (!(k >= 1 && k <= hideout.coins)) return fail(400, `${hideout.name} hides ${hideout.coins} coin${hideout.coins === 1 ? '' : 's'}: say which, 1 to ${hideout.coins}`);
      g.coins[hideout.id] = g.coins[hideout.id] || {};
      if (g.coins[hideout.id][k]) return { ok: true, ...view(), taken: false, item: 'coin', n: k };
      g.coins[hideout.id][k] = { at, by: who };
      hooks.save();
      hooks.changed();
      return { ok: true, ...view(), taken: true, item: 'coin', n: k };
    }
    return fail(400, 'item is "card" or "coin"');
  }

  /**
   * Somebody got out of a place that pays for what is carried out of it. `carried`: { batteries }.
   * The office pays what that beats its best by: `paid` (0 for a visit that was no better, which is not an error),
   * and `best`, what the best is now. Every answer carries the whole view as well.
   */
  function earn(hideoutId, carried, by, extra = {}) {
    const hideout = hideoutById(String(hideoutId || ''));
    if (!hideout) return fail(404, 'nothing is hidden in a place called that');
    if (!hideout.pays) return fail(400, `nothing carried out of ${hideout.name} is paid for`);
    const raw = carried?.batteries, batteries = Math.floor(raw);
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return fail(400, 'batteries is how many were carried out: a number, none or more');
    const { worth, paid } = pay(hideout, batteries, nameOf(by, extra), by);
    if (!worth) return { ok: true, ...view(), paid: 0, best: g.earned };
    hooks.save();
    if (paid) hooks.changed();
    return { ok: true, ...view(), paid, batteries, best: g.earned };
  }

  /** What the jar gains for what was carried out: the office is paid what that beats its best by. → { worth, paid } */
  function pay(hideout, batteries, who, by) {
    const worth = payFor({ batteries }), coins = Math.max(0, worth - g.earned);
    if (!worth) return { worth: 0, paid: 0 };
    g.paid.push({ at: Date.now(), by: who, hideout: hideout.id, batteries, worth, coins });
    if (g.paid.length > PAID_KEPT) g.paid.splice(0, g.paid.length - PAID_KEPT);
    if (coins) {
      g.earned = worth;
      ctx.activity?.log('loot', `${who} came back from ${hideout.name} with ${batteries} spare batter${batteries === 1 ? 'y' : 'ies'}, the most anybody has: ${coins} coin${coins === 1 ? '' : 's'} for the jar`, { hideout: hideout.id, item: 'pay', batteries, coins, agentId: by?.id || null });
    }
    return { worth, paid: coins };
  }

  /**
   * A visit to the place that pays is over, however it ended. `report` is what the visit says of itself
   * (core/runs.mjs: cleanRun). The office enters it in its record and answers with the card: what it scored,
   * whether that is a new best, what was met for the first time, what the jar gained, whether the tape is kept.
   * A visit to a building whose tape is on the shelf is that tape played back (`card.replay`): scored, and paid nothing.
   */
  function run(hideoutId, report, by, extra = {}) {
    const hideout = hideoutById(String(hideoutId || ''));
    if (!hideout) return fail(404, 'nothing is hidden in a place called that');
    if (!hideout.pays) return fail(400, `no record is kept of visits to ${hideout.name}`);
    if (!report || typeof report !== 'object' || Array.isArray(report)) return fail(400, 'run is what the visit says of itself: { reason, seed, seconds, parts, rooms, cast, batteries, card, hearts }');
    const who = nameOf(by, extra), visit = cleanRun(report);
    const settled = settleRun(g.record, visit, { at: Date.now(), by: who });
    g.record = settled.record;
    // (a kept tape played back is paid nothing, whatever was carried out of it: the office decides which visits those
    // are, from the tapes it has, and not the visitor)
    const coins = visit.reason === 'exit' && !settled.card.replay ? pay(hideout, visit.batteries, who, by) : { worth: 0, paid: 0 };
    hooks.save();
    if (visit.reason === 'exit' && !settled.card.replay) ctx.activity?.log('visit', `${who} is back from ${hideout.name}: ${settled.card.score} points${settled.card.best.beaten ? ', the best yet' : ''}`, { hideout: hideout.id, score: settled.card.score, agentId: by?.id || null });
    hooks.changed();
    return { ok: true, ...view(), card: { ...settled.card, coins: { carried: visit.batteries, worth: coins.worth, paid: coins.paid, best: g.earned } } };
  }

  /** The panel showed a newly lit floor and somebody rode there: it is not news any more. */
  function visit(floorId) {
    const id = String(floorId || '');
    if (!g.order.includes(id) || g.visited.includes(id)) return { ok: true, ...view(), first: false };
    g.visited.push(id);
    hooks.save(); hooks.changed();
    return { ok: true, ...view(), first: true };
  }

  /** Put coins in the machine. */
  function buy(ref, by, extra = {}) {
    const prize = findPrize(ref);
    if (!prize) return fail(404, `the machine has nothing at “${String(ref || '').slice(0, 20)}”`);
    if (g.prizes[prize.id]) return fail(409, `${prize.slot} is empty: ${prize.name} has already been bought`);
    const jar = purse();
    if (jar.have < prize.price) return fail(402, `${prize.name} costs ${prize.price}; the jar has ${jar.have}`);
    const who = nameOf(by, extra);
    g.prizes[prize.id] = { at: Date.now(), by: who };
    g.spent += prize.price;
    hooks.save();
    ctx.activity?.log('prize', `${who} bought ${prize.name.replace(/^A |^The /, (m) => m.toLowerCase())} from the vending machine`, { prize: prize.id, agentId: by?.id || null });
    hooks.changed();
    return { ok: true, ...view(), prize: { id: prize.id, slot: prize.slot, name: prize.name, blurb: prize.blurb, price: prize.price } };
  }

  /** The machine's shelf, as anyone may read it. */
  function shelf() {
    const jar = purse();
    return { coins: jar, prizes: PRIZES.map((p) => ({ id: p.id, slot: p.slot, name: p.name, blurb: p.blurb, price: p.price, sold: !!g.prizes[p.id], by: g.prizes[p.id]?.by || null })) };
  }

  /**
   * The same in words, for an agent that has been asked how the game is going. It says how much has been found
   * where — never where a thing is hidden, and nothing about a place nobody has been.
   */
  function describe() {
    const v = view(), jar = v.coins, n = (k, word) => `${k} ${word}${k === 1 ? '' : 's'}`;
    const lit = v.open.map((id) => levelById(id)?.name || id);
    const lines = ['The long game: keycards light the lift\'s dark buttons, coins go in the office\'s jar, the jar buys things from the vending machine. It is the humans\' game to play; what agents find counts too.'];
    lines.push(`The lift: ${lit.length} of ${n(g.order.length, 'game floor')} lit${lit.length ? ` (${lit.join(', ')})` : ''}${v.dark ? `; ${v.dark} stay dark until a keycard turns up` : ''}.`);
    const been = HIDEOUTS.filter((h) => v.open.includes(h.id) || v.loot[h.id].card || v.loot[h.id].coins.length);
    for (const h of been) {
      const l = v.loot[h.id];
      lines.push(`  ${h.name}: keycard ${l.card ? `found by ${g.cards[h.id].by}` : 'still hidden'} · ${l.coins.length} of ${n(h.coins, 'coin')} found`);
    }
    if (been.length < HIDEOUTS.length) lines.push(`  …and ${n(HIDEOUTS.length - been.length, 'place')} nobody has found anything in yet.`);
    lines.push(`The jar: ${n(jar.have, 'coin')} (${jar.found} picked up, ${jar.earned ? `${jar.earned} for the most anybody has brought back from ${HIDEOUTS.filter((h) => h.pays).map((h) => h.name).join(' and ')}, ` : ''}${jar.stamps} from passport stamps — every stamp anyone earns pays ${STAMP_COINS} — ${jar.spent} spent).`);
    lines.push('The vending machine in the kitchen:');
    for (const p of shelf().prizes) lines.push(`  ${p.slot}  ${p.name} — ${p.sold ? `bought by ${p.by}; it is on top of the machine` : n(p.price, 'coin')}`);
    return lines.join('\n');
  }

  return { view, collect, earn, run, visit, buy, shelf, purse, describe };
}
