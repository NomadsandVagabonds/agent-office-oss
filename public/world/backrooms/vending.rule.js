// The Backrooms — the vending machines, as a shop. Pure: no three.js, nothing of the page, no clock, no chance.
//
// Every machine works the same (the owner's rules): three papers buy one common item; two other commons buy one common;
// three items of three different kinds buy one rare. Two vends to a floor in all, whichever machines they are at. Batteries
// are neither taken nor given (they are the score's currency). The prices are the plain numbers in PRICE: tune them here.
//
// GOODS is the one table: an item a machine can take (`in`) and give (`out`), and its tier. A thing only a machine will give
// (a vend-only item, later) is one more line with `in: false`.
import { SUPPLY } from './supplies.js';

/** What it costs. papers: that many papers → a common · commons: that many (non-paper) commons → a common · kinds: that many items of as many kinds → a rare */
export const PRICE = Object.freeze({ papers: 3, commons: 2, kinds: 3 });
/** How many vends a floor has, all machines together. */
export const VENDS_PER_FLOOR = 2;

export const GOODS = Object.freeze([
  { type: 'snack', tier: 'common' },
  { type: 'chalk', tier: 'common' },
  { type: 'tape', tier: 'common' },
  { type: 'lighter', tier: 'common' },
  { type: 'paper', tier: 'common', out: false },      // (it buys, and is bought with, but is never what comes out: that would be a refund)
  { type: 'scissors', tier: 'rare' },
  { type: 'torch', tier: 'rare' },
]);

const good = (type) => GOODS.find((g) => g.type === type) || null;
/** How many things a machine holds at once: the dearest price. */
export const SLOTS = Math.max(PRICE.papers, PRICE.commons, PRICE.kinds);
/** Does a machine take this kind of thing? */
export const accepts = (type) => { const g = good(type); return !!g && g.in !== false; };

/**
 * What is wanted of what has been put in, or null for nothing yet.
 * @param inputs  the types fed in, in order
 * @returns {{ tier: 'common'|'rare', by: 'kinds'|'papers'|'commons' } | null}
 */
export function recipeFor(inputs) {
  const n = inputs.length;
  if (n === PRICE.kinds && new Set(inputs).size === PRICE.kinds) return { tier: 'rare', by: 'kinds' };
  if (n === PRICE.papers && inputs.every((t) => t === 'paper')) return { tier: 'common', by: 'papers' };
  if (n === PRICE.commons && inputs.every((t) => t !== 'paper' && good(t)?.tier === 'common')) return { tier: 'common', by: 'commons' };
  return null;
}

/** Put one more in: → the new list, or null when it will not go (not a thing it takes, or no room). */
export function feed(inputs, type) {
  if (!accepts(type) || inputs.length >= SLOTS) return null;
  return [...inputs, type];
}

/** What a recipe could give, given what went in: not what was put in, if there is any other; never a thing that cannot come out. */
export function outputs(recipe, inputs, { exclude = [] } = {}) {
  const able = GOODS.filter((g) => g.tier === recipe.tier && g.out !== false && !exclude.includes(g.type));
  const fresh = able.filter((g) => !inputs.includes(g.type));
  return (fresh.length ? fresh : able).map((g) => g.type);
}

/**
 * The next vend. `rng.pick(list)` is the floor's own seeded stream for this vend (so the same seed and the same vends give the
 * same goods, and nothing is chance). `floor.done` is how many have been had.
 * @returns {{ ok: false, reason: 'spent'|'nothing'|'none' } | { ok: true, out: string, tier: string, by: string }}
 */
export function vend(inputs, floor, rng, opt = {}) {
  if (floor.done >= VENDS_PER_FLOOR) return { ok: false, reason: 'spent' };
  const recipe = recipeFor(inputs);
  if (!recipe) return { ok: false, reason: 'nothing' };
  const pool = outputs(recipe, inputs, opt);
  if (!pool.length) return { ok: false, reason: 'none' };
  return { ok: true, out: rng.pick(pool), tier: recipe.tier, by: recipe.by };
}

/** A part-used torch, as torches are left about (supplies.js). */
export const torchCharge = (rng) => rng.int(SUPPLY.torchCharge[0], SUPPLY.torchCharge[1]);

/** How many rooms are shortlisted for a floor's machine (the first of them, as the floor is built, with room for it, gets it). */
export const SITE_SHORTLIST = 12;

/**
 * The rooms a floor with no Refreshments room may stand its one machine in (never a plan change: chosen when the floor is built).
 * Not where you land, not the way down or the room before it, not a lair, nowhere with its own business (a shaped room, a
 * thin wall, a traced room, a sign) and nowhere cramped; a seeded shortlist of those, because a given room may have no clear wall.
 * @param level  what gen.js gave
 * @param rng    { shuffle }
 * @returns {number[]} room ids
 */
export function vendingSites(level, rng) {
  if (!level || level.rooms.some((r) => r.arch === 'vending')) return [];
  const ex = level.exit?.room, beside = new Set();
  for (const l of level.links || []) { if (l.a === ex) beside.add(l.b); if (l.b === ex) beside.add(l.a); }
  const fit = level.rooms.filter((r) => r.kind === 'plain' && !r.arch && !r.crawl && !r.shape && !r.blocks && !r.sign
    && r.id !== level.start?.room && r.id !== ex && !beside.has(r.id) && r.id !== level.pursuer?.room && level.thin?.room !== r.id
    && !(r.dress || []).some((d) => d.type === 'trace') && r.w >= 3 && r.d >= 3);
  return rng.shuffle(fit).slice(0, SITE_SHORTLIST).map((r) => r.id);
}
