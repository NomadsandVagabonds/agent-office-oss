// The Backrooms — who is down here this time. Pure: a seed in, names out.
// The cast is a deck, like the rooms (gen.js): a line of plain data for each
// creature, and a file each under cast/ that builds it and works it
// (docs/BACKROOMS.md, "Adding a creature"). One of them is in every visit (the
// mascot); the rest are dealt from the seed, a different few each time, so
// that no two visits have the same company and nobody but him can be counted
// on. A visit is one roll: the same seed is the same company, on the same
// floors, in the same rooms — and a seed is only ever given once (index.js:
// the seed is the clock).
import { difficultyOf } from '../../../core/difficulty.mjs';
import { makeRng, roomDistances, roomPath, wallSpans, ARCHETYPES } from './gen.js';

/** What a creature is to the visitor. Only one that hunts may end a visit. */
export const DISPOSITIONS = Object.freeze(['hunts', 'keeps to itself', 'helps']);
/** Things a visitor may be carrying that a creature can care about (the inventory's item types). */
export const ITEMS = Object.freeze(['torch', 'battery', 'chalk', 'paper', 'pink-slip', 'scissors', 'snack', 'balloon', 'lighter', 'tape', 'opener']);
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
 *   room         for home 'room': { w, d } the least floor it needs, metres; far: the fewest doorways from where you land (default 3);
 *                wall, clear: for one that hangs on a wall, the metres of it it needs, and how far that must be from any doorway
 *   music        'mascot': it has a piece of music of its own (sound.js), which is played once through from the moment a part's
 *                has first really been seen, and stopped early only if it is no more
 *   on           false: retired. It is out of the cast and nothing else has to change
 */
export const ALL_CAST = Object.freeze([
  Object.freeze({ id: 'pirate', name: 'The mascot', rule: 'It only moves while nobody is looking at it — and it only knows where you are while it can see you.',
    disposition: 'hunts', home: 'roams', always: true, weight: 1, teaches: 'sight', needs: [], items: ['paper', 'lighter'], fire: 'fears', caught: { hurt: 2 }, music: 'mascot' }),
  Object.freeze({ id: 'shadow', name: 'The shadow', rule: 'Stare until it turns white, then look away before the flash to clear it; watch it go off and half your battery goes with it.',
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
  // (withRoom: it is in a part if and only if that part has that room; it is not dealt by weight. Its toolbox has c.lair: where it sleeps)
  Object.freeze({ id: 'the-lines', name: 'The lines',
    rule: 'It walks only where there is floor, and over anything that has been laid down — so take up what it is standing on.',
    disposition: 'hunts', home: 'roams', weight: 0, withRoom: 'the-culvert', needs: [], items: [], fire: 'ignores', caught: { hurt: 1 },
    themes: { yellow: 0, archive: 0, night: 0, fitout: 0, exec: 0, suburb: 1 } }),
  Object.freeze({ id: 'mother', name: 'Mother',
    rule: 'She sways and she waves, and comes over very slowly, and that is all she does herself. Near enough, she heaves and brings up four or five small pink ones that jump for your face. They are blind, and most jumps miss: tread on them before one does not.',
    disposition: 'hunts', home: 'roams', weight: 1, needs: [], items: ['paper', 'lighter'], fire: 'fears', caught: { hurt: 1 } }),
  Object.freeze({ id: 'head-count', name: 'Head count',
    rule: 'Three of them, joined, on their arms, and not a head between them. It cannot see you or hear you: it feels you walk. Stand still and you are not there, until a hand comes down on you — so stand still somewhere it is not going.',
    disposition: 'hunts', home: 'roams', weight: 1, needs: [], items: ['paper', 'lighter'], fire: 'fears', caught: { hurt: 2 } }),
  Object.freeze({ id: 'standing-meeting', name: 'The standing meeting',
    rule: 'Nine of them under one back, on short legs, in file. When you are in front of it, it stops and its feet drum, and then it comes straight at you faster than you can run. It cannot turn. Do not outrun it: step out of its line, and let the wall have it.',
    disposition: 'hunts', home: 'roams', weight: 1, needs: [], items: ['paper', 'lighter'], fire: 'fears', caught: { hurt: 2 } }),
  Object.freeze({ id: 'other-door', name: 'The other door',
    rule: 'One pair of doors is not doors: it shivers, now and then, and that is all that gives it away. Try it, walk into it or stand in front of it too long, and it opens on nothing and takes hold of you.',
    disposition: 'hunts', home: 'room', weight: 1, needs: ['doors'], items: ['paper', 'lighter'], fire: 'fears', room: { w: 4, d: 4, wall: 2.3, clear: 1.8 }, caught: { hurt: 2 } }),
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
  const pool = cast.filter((m) => !m.always && !m.withRoom && m.weight > 0);          // (one that comes with a room is not dealt: withRoomFor)
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
  // Private curated visits may schedule the production cast explicitly. Ordinary
  // visits keep exactly the seeded dealer below. Entries are authored, not input.
  if (Array.isArray(visit.company)) return visit.company.filter(m => cast.some(c => c.id === m.id) && Number.isInteger(m.floor) && m.floor >= 0 && m.floor < visit.depths && (floor === undefined || m.floor === floor));
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
  // Extra mobile threats, spread into separate territories by toner.js. The
  // authored supporting cast (including friendly residents) still appears.
  if (cast.some(m => m.id === 'toner')) for (let i = 0; i < visit.depths; i++) {
    const mode = visit.floors[i].difficulty;
    if (mode && difficultyOf(mode).toner && !out.some(k => k.id === 'toner' && k.floor === i)) out.push({ id: 'toner', floor: i });
  }
  return floor === undefined ? out : out.filter((k) => k.floor === null || k.floor === floor);
}

/**
 * The room a creature that lives in one room lives in, on a floor: a plain room of the size it asked for, a little way in, that is not
 * where you land, not on the way out, not somewhere to crawl, not the mascot's, and not already somebody else's. Seeded by the floor. → room id, or null (none will do:
 * it is not on this floor after all), and null for anything that roams.
 */
export function homeFor(level, member) {
  if (!member || member.home !== 'room') return null;
  const want = member.room || {}, far = roomDistances(level, level.start.room);
  const able = level.rooms.filter((r) => r.kind === 'plain' && !r.crawl && r.H >= 2.2 && !r.shape && !r.lows && !(level.pursuer && level.pursuer.room === r.id)
    && (far.get(r.id) ?? 0) >= (want.far ?? 3) && Math.max(r.W, r.D) >= Math.max(want.w || 0, want.d || 0) && Math.min(r.W, r.D) >= Math.min(want.w || 0, want.d || 0)
    // (and, for one that hangs on a wall: a stretch of it that long, that far from any doorway)
    && (!want.wall || ['back', 'front', 'left', 'right'].some((side) => wallSpans(r, side, want.clear ?? 0.3, 0).some(([a, b]) => b - a >= want.wall))));
  if (!able.length) return null;
  // no two of them have the same room: whoever is earlier on the list has the first pick of the floor
  const mine = CAST.indexOf(member), theirs = new Set(mine > 0 ? CAST.slice(0, mine).filter((m) => m.home === 'room').map((m) => homeFor(level, m)) : []);
  const free = able.filter((r) => !theirs.has(r.id));
  return free.length ? makeRng(`${level.seed}/home/${member.id}`).pick(free).id : null;
}

/** How much company a room may ask for at most (a deck line: `haunt: 1` or `haunt: 2`). */
export const HAUNT_MOST = 2;

/**
 * Rooms that ask for company (a deck line with `haunt: n`), and who of those dealt to this part keeps them company: nobody new, only
 * those of the cast who roam and are on this part anyway (never the mascot, never anybody with a room of their own). Seeded by the
 * floor; at most n to a room; nobody if nobody is dealt here. What keeping a room company means is the creature's own (`c.haunt`).
 * @param level  a generated floor
 * @param {string[]} ids  who is dealt to this part (castFor)
 * @param deck   id → deck line (default: the deck)
 * @returns {Map<string, number>}  creature id → room id
 */
export function hauntsFor(level, ids, deck = ARCHETYPES, cast = CAST) {
  const out = new Map();
  const rooms = (level?.rooms || []).filter((r) => r.arch && Number.isInteger(deck[r.arch]?.haunt) && deck[r.arch].haunt > 0 && r.kind !== 'start' && r.kind !== 'exit');
  if (!rooms.length) return out;
  const R = makeRng(`${level.seed}/haunt`), fromStart = level.start ? roomDistances(level, level.start.room) : new Map();
  const free = R.shuffle(ids.filter((id, i) => ids.indexOf(id) === i).map((id) => cast.find((m) => m.id === id)).filter((m) => m && m.home === 'roams' && !m.always && !m.withRoom).map((m) => m.id));
  for (const r of rooms) for (let n = Math.min(HAUNT_MOST, deck[r.arch].haunt); n > 0 && free.length; n--) {
    const i = free.findIndex(id => cast.find(m => m.id === id)?.disposition !== 'hunts' || (fromStart.get(r.id) ?? 0) >= 2);
    if (i < 0) break; out.set(free.splice(i, 1)[0], r.id);
  }
  return out;
}

/** How many doorways before its room one that comes with a room lies up, on the way from the landing: from, to. */
export const LAIR = Object.freeze([2, 4]);

/**
 * Who comes with a room (a cast line with `withRoom: '<arch id>'`): on a part if and only if that part has a room of that kind. Never
 * dealt by weight (whoIsDown leaves them out) and never in anybody's place: they are extra company on that part. It is asked of the
 * built floor and not of the plan (castFor), because only the floor knows which rooms it was dealt.
 * @returns {string[]} ids, in the order of the cast list
 */
export function withRoomFor(level, cast = CAST) {
  const here = new Set((level?.rooms || []).map((r) => r.arch).filter(Boolean));
  return cast.filter((m) => m.withRoom && !m.always && here.has(m.withRoom)).map((m) => m.id);
}

/**
 * Where one that comes with a room lies up: a room two to four doorways before its room on the way there from the landing, so that
 * there is some way to be followed before the room is reached. Never the landing, never the way out, never the room itself. If its
 * room is too near the landing for that, the allowed room nearest to two doorways before it. Seeded by the floor.
 * @returns {number|null} room id — null for anybody without `withRoom`, or if there is no such room or nowhere allowed
 */
export function lairFor(level, member) {
  if (!member?.withRoom || !level?.rooms) return null;
  const room = level.rooms.find((r) => r.arch === member.withRoom);
  const path = room && roomPath(level, level.start.room, room.id);
  if (!path) return null;
  const fromStart = roomDistances(level, level.start.room);
  const last = path.length - 1, ok = (i) => (fromStart.get(path[i]) ?? 0) >= 2 && i > 0 && i < last && path[i] !== level.exit?.room && path[i] !== level.start.room;
  const able = []; for (let back = LAIR[0]; back <= LAIR[1]; back++) if (ok(last - back)) able.push(path[last - back]);
  if (able.length) return makeRng(`${level.seed}/lair/${member.id}`).pick(able);
  for (let i = last - 1; i > 0; i--) if (ok(i)) return path[i];
  return null;
}

/** Separated mobile threat territories. A bad spot is skipped before it consumes a place. */
export function tonerHomes(level, count, { haunt = null, usable = () => true } = {}) {
  const dist = roomDistances(level, level.start.room), chosen = [];
  const eligible = r => r.kind !== 'start' && r.kind !== 'exit' && !r.crawl && r.H >= 2.2 && (dist.get(r.id) ?? 0) >= 4;
  const R = makeRng(`${level.seed}/toner-territories`);
  const candidates = R.shuffle(level.rooms.filter(r => r.kind === 'plain' && eligible(r)));
  const requested = level.rooms.find(r => r.id === haunt && eligible(r));
  if (requested) candidates.unshift(requested);
  for (const r of candidates) {
    if (chosen.some(id => (roomDistances(level, id).get(r.id) ?? 0) < 4) || !usable(r.id)) continue;
    chosen.push(r.id);
    if (chosen.length >= count) break;
  }
  return chosen;
}
