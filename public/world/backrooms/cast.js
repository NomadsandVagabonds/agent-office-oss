// The Backrooms — who is down here this time. Pure: a seed in, names out.
// The cast is a deck, like the rooms (gen.js): a line of plain data for each
// creature, and a file each under cast/ that builds it and works it
// (docs/BACKROOMS.md, "Adding a creature"). One of them is in every visit (the
// mascot); the rest are dealt from the seed, a different few each time, so
// that no two visits have the same company and nobody but him can be counted
// on. A visit is one roll: the same seed is the same company, on the same
// floors, in the same rooms — and a seed is only ever given once (index.js:
// the seed is the clock).
import { makeRng, roomDistances } from './gen.js';

/** What a creature is to the visitor. Only one that hunts may end a visit. */
export const DISPOSITIONS = Object.freeze(['hunts', 'keeps to itself', 'helps']);
/** Things a visitor may be carrying that a creature can care about (the inventory's item types). */
export const ITEMS = Object.freeze(['torch', 'battery', 'chalk', 'paper', 'pink-slip', 'scissors', 'snack', 'balloon', 'lighter', 'tape']);
/** What everybody knows before they have met anybody: the rooms' own first lessons (gen.js LESSONS). */
export const ROOM_LESSONS = Object.freeze(['lean', 'unwatched']);
/**
 * What the cast teaches: an id, and what is learned, in a sentence. A creature is the first place to learn at most one of
 * these (`teaches`) and may take others, or the rooms' lessons, for granted (`needs`).
 */
export const CAST_LESSONS = Object.freeze({
  sight: 'What follows you only knows where you are while it can see you.',
  doors: 'Some doors can be shut, and what is behind you has to stop and open them.',
  averted: 'Some things are better not looked at.',
  led: 'Something that waits for you to catch up is going somewhere.',
  tidy: 'What you knock over, you can stand up again.',
  hush: 'What hunts by ear passes over you while you keep still or stooped.',
});

/**
 * Everybody there is. One line each, plain data:
 *   id           lower-case words joined by hyphens: also the file (cast/<id>.js) and what the dev page calls it
 *   name         what it is called on the dev page and in the guide. Never shown in the level
 *   rule         its one rule, in a sentence, as somebody would say it who had worked it out. Never shown in the level
 *   disposition  'hunts' | 'keeps to itself' | 'helps'
 *   home         'roams' (walks the floor) | 'room' (lives in one room, which homeFor() chooses)
 *   always       in every visit (the mascot, and nobody else)
 *   weight       how often it is dealt, for the others: 1 is ordinary, 3 at most, 0 never
 *   teaches      the one lesson it is the first place to learn (CAST_LESSONS) — optional
 *   needs        lessons it takes for granted (CAST_LESSONS or ROOM_LESSONS). One that needs anything is never on the floor you land on
 *   themes       { yellow, archive, night, fitout, exec } → a multiplier on how likely each kind of floor is to be its floor. 0 keeps it off one
 *   items        the things a visitor might carry that change what it does (ITEMS) — so that whoever writes an item knows who is waiting for it
 *   fire         what a fire lit by the visitor is to it (cast/fire.rule.js FIRE_WAYS): 'fears' (will not go near one, and backs off from one
 *                lit beside it) | 'ignores' | 'drawn' (goes to it). Its own rule does it, with c.fire(x, z)
 *   caught       what it costs to be got by it: { hurt: points of health } (and with no health system, a creature that hunts ends the visit) ·
 *                { ends: true } only for one that hunts · { setback: 'in a sentence' } for the rest
 *   room         for home 'room': { w, d } the least floor it needs, metres; far: the fewest doorways from where you land (default 3)
 *   on           false: retired. It is out of the cast and nothing else has to change
 */
export const ALL_CAST = Object.freeze([
  Object.freeze({ id: 'pirate', name: 'The mascot', rule: 'It only moves while nobody is looking at it — and it only knows where you are while it can see you.',
    disposition: 'hunts', home: 'roams', always: true, weight: 1, teaches: 'sight', needs: [], items: ['paper', 'lighter'], fire: 'fears', caught: { hurt: 2 } }),
  Object.freeze({ id: 'shadow', name: 'The shadow', rule: 'Look straight at it and it goes off like a flashbulb, and half your battery goes with it.',
    disposition: 'hunts', home: 'roams', weight: 1, teaches: 'averted', needs: [], items: ['battery', 'torch'], fire: 'ignores',
    caught: { setback: 'the room goes dark for a while, and half the camcorder\'s charge is gone' } }),
  Object.freeze({ id: 'moth', name: 'The desk moth', rule: 'It goes to the next light, and waits there for you — and the next light is always nearer the way down. (A fire is a light too, and it does not come back from one.)',
    disposition: 'helps', home: 'roams', weight: 1, teaches: 'led', needs: [], items: ['torch', 'paper', 'lighter'], fire: 'drawn',
    caught: { setback: 'none: lose it and it is still going round the last tube you saw it at' } }),
  Object.freeze({ id: 'porter', name: 'The night porter', rule: 'Leave his bucket alone — and if you have not, stand it up again, because until you do he is looking at you.',
    disposition: 'keeps to itself', home: 'room', weight: 1, teaches: 'tidy', needs: [], items: ['battery'], fire: 'ignores', room: { w: 5, d: 5 },
    caught: { setback: 'his room goes dim, and if you walk out on it every pair of doors on the floor is shut' } }),
  Object.freeze({ id: 'toner', name: 'The waste toner',
    rule: 'It clings to the ceiling and listens with clicks — crouch or stand still and it creeps past; walk upright and it drops, zigzags through crawlways, cannot work a door handle, and after hurting you twice melts into black sludge that soon hatches more of its kind.',
    disposition: 'hunts', home: 'roams', weight: 1, teaches: 'hush', needs: [], items: ['paper', 'lighter'], fire: 'fears', caught: { hurt: 1 } }),
]);
export const CAST = Object.freeze(ALL_CAST.filter((m) => m.on !== false));
/** How many of the others turn up in one visit, at most. */
export const SUPPORTING = 2;

/**
 * The company for one visit.
 * @param {string|number} seed  the visit's seed
 * @param {object[]} [cast]     who there is to choose from (default: everybody)
 * @returns {string[]}  ids — everybody who is `always`, then up to SUPPORTING of the others, in the order they were dealt
 */
export function whoIsDown(seed, cast = CAST) {
  const R = makeRng(`cast:${seed}`), out = cast.filter((m) => m.always).map((m) => m.id);
  const pool = cast.filter((m) => !m.always && m.weight > 0);
  for (let n = Math.min(SUPPORTING, pool.length); n > 0 && pool.length; n--) {
    const m = R.weighted(pool, (k) => k.weight);
    out.push(m.id); pool.splice(pool.indexOf(m), 1);
  }
  return out;
}

/**
 * Which floor each of the company is on.
 * @param visit  { seed, depths, floors: [{ theme }] } — a planned visit (plan.js)
 * @param {number} [floor]  only those on this floor
 * @returns {{id:string, floor:number|null}[]}  floor null: wherever the visit's plan puts it (the mascot: plan.js decides, and he is made
 *          on every floor because he follows you down)
 */
export function castFor(visit, floor, cast = CAST) {
  if (!visit) return cast.filter((m) => m.always).map((m) => ({ id: m.id, floor: null }));
  const out = [];
  for (const id of whoIsDown(visit.seed, cast)) {
    const m = cast.find((k) => k.id === id);
    if (m.always) { out.push({ id, floor: null }); continue; }
    const R = makeRng(`cast:${visit.seed}:${id}`), able = [];
    for (let i = 0; i < visit.depths; i++) {
      const w = (i === 0 && (m.needs || []).length ? 0 : 1) * ((m.themes || {})[visit.floors[i].theme] ?? 1);
      if (w > 0) able.push([i, w]);
    }
    if (able.length) out.push({ id, floor: R.weighted(able, (k) => k[1])[0] });
  }
  return floor === undefined ? out : out.filter((k) => k.floor === null || k.floor === floor);
}

/**
 * The room a creature that lives in one room lives in, on a floor: a plain room of the size it asked for, a little way in, that is not
 * where you land, not on the way out, not somewhere to crawl, and not the mascot's. Seeded by the floor. → room id, or null (none will do:
 * it is not on this floor after all), and null for anything that roams.
 */
export function homeFor(level, member) {
  if (!member || member.home !== 'room') return null;
  const want = member.room || {}, far = roomDistances(level, level.start.room);
  const able = level.rooms.filter((r) => r.kind === 'plain' && !r.crawl && r.H >= 2.2 && !r.shape && !r.lows && !(level.pursuer && level.pursuer.room === r.id)
    && (far.get(r.id) ?? 0) >= (want.far ?? 3) && Math.max(r.W, r.D) >= Math.max(want.w || 0, want.d || 0) && Math.min(r.W, r.D) >= Math.min(want.w || 0, want.d || 0));
  return able.length ? makeRng(`${level.seed}/home/${member.id}`).pick(able).id : null;
}
