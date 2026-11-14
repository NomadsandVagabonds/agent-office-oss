// The Office — the lift's other floors, as text.
//
// Humans ride the lift in the 3D client (public/world/levels/). Agents are
// text-native, so a floor an agent can visit needs a text side: what is there,
// who else is there, what can be used. This file has those, the words for the
// lift itself, and the short list of who is away on which floor. text.mjs asks
// here first, and only then describes the office.
//
// As far as the floor plan knows, an agent who has taken the lift is standing
// in the car (the one room nobody can see into) — which is exactly where a
// human watching the office saw them go. They come back the way everybody comes
// back from anywhere: when they ask to, or when work calls.
//
// To give a floor a text side, add an entry to TEXT below. Floors without one
// are for humans only, and the lift says so.
import { HOME, floorOfPlacement, levelById, visibleLevels } from '../../core/levels.mjs';
import { hashId } from '../../core/look.mjs';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const bare = (s) => norm(s).replace(/^(the|a|an) /, '');
const list = (items) => (items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);

/* ---- P · The Pasture -------------------------------------------------------- */

const COATS = ['a white one', 'a tan one', 'a black-and-white one', 'a small white kid', 'the tan one with the lanyard'];
const PETS = [
  'considers your hand, decides you are acceptable, and leans in',
  'lets you scratch between its horns and closes its eyes',
  'chews at you thoughtfully, then allows it',
  'butts your palm, gently, twice',
  'stands very still and pretends not to enjoy it',
];
const HERD = 20;               // what the clipboard says. The 3D pasture has one more, and so does this.

const PASTURE = {
  // what can be named down here → a thing
  things: {
    goat: ['goat', 'goats', 'herd', 'kid', 'kids', 'one', 'white goat', 'tan goat'],
    lanyard: ['lanyard', 'goat with a lanyard', 'lanyard goat', 'pass', 'badge'],
    elder: ['big goat', 'big one', 'dark goat', 'dark one', 'horned goat', 'horned one', 'one on the hill', 'hilltop', 'ram'],
    hill: ['hill', 'hills', 'big hill', 'behind the hill', 'bush', 'bushes', 'scrub'],
    clipboard: ['clipboard', 'headcount', 'count', 'post', 'list'],
    bucket: ['bucket', 'feed', 'feed bucket', 'pail'],
    salt: ['salt', 'salt lick', 'lick'],
    door: ['door', 'small door', 'very small door', 'tiny door', 'little door'],
    hatch: ['hatch', 'hatches', 'flap', 'flaps'],
    sign: ['sign', 'signs', 'notice', 'notices', 'wall', 'walls'],
    ceiling: ['ceiling', 'lights', 'light', 'panels', 'tiles', 'room'],
    grass: ['grass', 'meadow', 'pasture', 'ground', 'floor'],
  },
  look(agent, api) {
    const others = api.whoIsOn('pasture', agent);
    return [
      'A very large room with no windows: white wall panels, and a low grid ceiling of light panels going off into the distance. From wall to wall, a meadow — real grass, hills a couple of metres high, scrub — and about twenty small goats getting on with it: white, tan, black-and-white.',
      'On the far hilltop lies a much larger one, dark, with tall horns that sweep back. It is not grazing. It is facing you.',
      others.length ? `With you: ${list(others)}.` : null,
      `Here: the goats, a feed bucket, a salt lick, a clipboard on a post (HEADCOUNT: ${HERD}), a very small door in the far wall, two hatches, some signs.`,
      'Nobody has explained any of it. (office use goat · office look signs · office go home)',
    ].filter(Boolean);
  },
  examine(agent, thing, api) {
    switch (thing) {
      case 'goat': return `About twenty of them, small, in three coats. They graze, look up, wander a few steps, graze. One keeps looking at you in particular. (office use goat)`;
      case 'lanyard': return 'One tan goat wears a lanyard. The pass on it has a photo (the goat, unimpressed) and one word: VISITOR.';
      case 'elder': return 'Much larger than the others, dark, lying with its legs folded, horns like a ram’s. It has not moved since you came in — except that wherever you stand, it is facing you. The others give it room.';
      case 'hill': return api.world.state().discoveries.headcount
        ? 'Behind the big hill, beside a bush: a flattened patch of grass where somebody small used to hide.'
        : 'You walk round the back of the big hill. Tucked in beside a bush: a small black-and-white kid, keeping very still, hoping to stay off the list. (office use goats count)';
      case 'clipboard': return `A clipboard on a post. HEADCOUNT, four five-bar gates in biro, and a figure: ${HERD}. Underneath, in another hand: “counted twice”.${api.world.state().discoveries.headcount ? ` Somebody has since added, in red: “${HERD + 1}?”` : ''} (office use goats count)`;
      case 'bucket': return 'A blue bucket of feed pellets. Several goats are aware of it at all times. (office use bucket)';
      case 'salt': return 'A pinkish block on a post, licked into a hollow. There is a queue, of sorts.';
      case 'door': return 'A door in the far wall, about knee height, with a proper handle and a small green EXIT sign over it. (office use door)';
      case 'hatch': return 'Two square hatches low in the far wall, each with a rubber flap. Goat-sized. The flaps move slightly, as if the air on the other side were different.';
      case 'sign': return 'The signs, in the building’s usual lettering:\n  P · PASTURE  (formerly parking)\n  LANYARDS MUST BE WORN AT ALL TIMES\n  PLEASE DO NOT BRIEF THE GOATS';
      case 'ceiling': return 'A suspended ceiling, the kind every office has: 60 cm tiles, a light panel every few. It is only a little higher than the big hill. The horns of the one up there nearly reach it.';
      default: return 'Grass. Actual grass, growing, under strip lights. A few daisies. Nobody waters it that you can see.';
    }
  },
  use(agent, thing, arg, api) {
    const { world } = api, n = hashId(agent.id + ':' + Date.now());
    const star = (r) => (r && (r.stamped || r.first) ? `  ★ Discovery: ${r.secret.name}` : '');
    switch (thing) {
      case 'goat': case 'lanyard': {
        if (thing === 'goat' && /count|how many|tally/.test(norm(arg))) {
          const found = world.discover('headcount', agent);
          return { ok: true, found: found.stamped ? 'headcount' : null,
            text: `You count them, which takes a while because they will not stand still. ${HERD + 1}. You count again: ${HERD + 1}. The clipboard says ${HERD}. The one it misses is a small black-and-white kid behind the big hill, who would rather you had not.${star(found)}` };
        }
        const total = world.bumpStat('goatPets');
        world.fx({ kind: 'goat', by: agent.id });
        const which = thing === 'lanyard' ? COATS[4] : COATS[n % COATS.length];
        return { ok: true, text: `You hold out a hand. ${which[0].toUpperCase()}${which.slice(1)} ${PETS[(n >>> 3) % PETS.length]}. (the goats have been petted ${total} time${total === 1 ? '' : 's'})` };
      }
      case 'bucket': return { ok: true, text: `You rattle the feed bucket. Every head in the meadow comes up at once. ${3 + (n % 5)} goats arrive at a trot and look at your hands. The big one does not come. It does not need to.` };
      case 'salt': return { ok: true, text: 'A goat is using it. It looks at you along its nose until you leave.' };
      case 'door': return { ok: true, text: 'You crouch. The handle turns; the door does not. From the other side, faintly: a printer, somebody laughing, a kettle. It is a very small door.' };
      case 'clipboard': return { ok: true, text: PASTURE.examine(agent, 'clipboard', api) };
      case 'elder': return { ok: true, text: 'You take one step up the hill. It watches you take it. You take the step back.' };
      default: return { ok: true, text: PASTURE.examine(agent, thing, api) };
    }
  },
};

/* ---- A · After Hours ---------------------------------------------------------- */

const FIXES = 8;               // how many an agent has to squash before its build goes green

const AFTERHOURS = {
  things: {
    bug: ['bug', 'bugs', 'beetle', 'beetles', 'one'],
    mallet: ['mallet', 'hammer', 'tool', 'rubber mallet'],
    rack: ['rack', 'racks', 'production', 'servers', 'server'],
    screen: ['screen', 'wall screen', 'build', 'status', 'counter'],
    cabinet: ['cabinet', 'arcade', 'arcade cabinet', 'bug squash'],
    monitor: ['monitor', 'monitors', 'desk', 'desks', 'lamp', 'light', 'lights'],
  },
  look(agent, api) {
    const done = Math.min(FIXES, agent._bugsFixed || 0), green = done >= FIXES, others = api.whoIsOn('afterhours', agent);
    return [
      green ? 'The same kind of office as upstairs, late, and quiet again: the lights are on, and every monitor shows a green tick.'
        : 'The same kind of office as upstairs, at night, with the build broken: emergency lighting, a red lamp turning over the wall screen, an error on every monitor, a ceiling tile or two on the carpet.',
      green ? null : 'Things scuttle. Small green beetles — the bugs from the BUG SQUASH cabinet in the corner, with a third dimension now — come up out of the floor vents, hop onto desks, and make for the server racks.',
      others.length ? `With you: ${list(others)}.` : null,
      `Here: a rubber mallet (in your hand), the wall screen (BUGS FIXED ${String(done).padStart(2, '0')} / ${String(FIXES).padStart(2, '0')}), the racks, the cabinet they came out of.`,
      green ? '(office go home)' : '(office use mallet · office go home)',
    ].filter(Boolean);
  },
  examine(agent, thing) {
    const done = Math.min(FIXES, agent._bugsFixed || 0);
    switch (thing) {
      case 'bug': return done >= FIXES ? 'None left. A few green pixels in the carpet.' : 'Beetle-shaped, arcade green, the size of a cat. The odd one is gold. Whatever one sits on starts showing errors. (office use mallet)';
      case 'mallet': return 'A rubber mallet with a taped grip. Somebody has written DEBUGGER on the handle.';
      case 'rack': return 'Production: two server racks, one each side of the wall screen. Every bug in the room is trying to get to them.';
      case 'screen': return done >= FIXES ? `BUILD PASSING · BUGS FIXED ${FIXES} / ${FIXES}` : `BUILD FAILING · BUGS FIXED ${String(done).padStart(2, '0')} / ${String(FIXES).padStart(2, '0')}`;
      case 'cabinet': return 'The BUG SQUASH cabinet. Its screen still runs, but there are fewer bugs on it than there used to be.';
      default: return done >= FIXES ? 'Green ticks, all the way down the room.' : 'An error on every screen. The one nearest you says: undefined is not a function.';
    }
  },
  use(agent, thing, arg, api) {
    if (thing !== 'bug' && thing !== 'mallet') return { ok: true, text: AFTERHOURS.examine(agent, thing) };
    if ((agent._bugsFixed || 0) >= FIXES) return { ok: true, text: 'You look for something to hit. There is nothing left: the build is green.' };
    agent._bugsFixed = (agent._bugsFixed || 0) + 1;
    const n = agent._bugsFixed, gold = hashId(agent.id + ':' + n) % 9 === 0;
    let text = `You bring the mallet down. Pop: a scatter of ${gold ? 'gold' : 'green'} pixels and a small tag that says FIXED. (${n} of ${FIXES})`;
    if (n < FIXES) return { ok: true, text };
    const found = api.world.discover('green-build', agent);
    text += '\nThat was the last one. The red lamp stops. The monitors come back one at a time, green; the lights come up; behind you the lift goes ding. The build is green again.';
    return { ok: true, text: text + (found.stamped || found.first ? `  ★ Discovery: ${found.secret.name}` : ''), found: found.stamped ? 'green-build' : null };
  },
};

const TEXT = { pasture: PASTURE, afterhours: AFTERHOURS };

/* ---- the lift, and who is where ------------------------------------------------- */

export function createFloors(ctx, world) {
  /** agent id → level id, for agents who have ridden somewhere. */
  const away = new Map();
  const api = { ctx, world, whoIsOn };

  const floors = () => visibleLevels({ quirks: world.today().quirks, found: Object.keys(world.state().discoveries) });
  const rides = (level) => !!TEXT[level.id] && !!level.car;
  const panel = () => floors().map((l) => (l.unmarked
    ? `  ${l.floor.padEnd(2)} · (no label. The button flickers. It was not there yesterday.)`
    : `  ${l.floor.padEnd(2)} · ${l.name} — ${l.blurb}${l.id === HOME ? '  ← you are here' : rides(l) ? `  ▸ office use lift ${l.id}` : ''}`)).join('\n');
  const rule = () => {
    const open = floors().filter(rides).map((l) => l.floor);
    return open.length ? `Agents can ride to the floors marked ▸ (${open.join(', ')}); the others are for humans only at this stage.`
      : 'Riding is for humans only at this stage.';
  };
  const describeLift = () => 'The lift, at the head of the landing. Everyone arrives through it. The panel beside the doors lists where it goes:\n' + panel() + '\n' + rule();
  const callLift = () => 'You press the call button. The doors slide open on an empty car, wait a polite moment, and close again. Inside, the buttons read:\n' + panel() + '\n' + rule();

  /** The floor an agent is away on (a level), or null if they are in the office. */
  function floorOf(agent) {
    const id = agent && away.get(agent.id);
    if (!id) return null;
    if (floorOfPlacement(world.placeOf(agent.id))?.id !== id) { away.delete(agent.id); return null; }     // they have come back
    return levelById(id);
  }
  /** Names of everyone on a floor: agents who rode there, and humans the 3D client says are there. */
  function whoIsOn(levelId, except) {
    const agents = [...away].filter(([id, lvl]) => lvl === levelId && id !== except?.id && floorOfPlacement(world.placeOf(id))?.id === lvl)
      .map(([id]) => ctx.agents.get(id)).filter(Boolean).map((a) => `${a.name} (${a.provider || 'agent'})`);
    const humans = world.leads().filter((l) => l.focus && l.focus.kind === 'level' && l.focus.id === levelId).map((l) => `${l.name} (human)`);
    return [...agents, ...humans];
  }
  /** Humans who are on another floor right now: [{ name, level }]. */
  const humansElsewhere = () => world.leads().filter((l) => l.focus && l.focus.kind === 'level' && levelById(l.focus.id))
    .map((l) => ({ name: l.name, level: levelById(l.focus.id) }));

  /** A floor named in passing ("pasture", "the rooftop garden", "mission control") — not the single letters on the buttons. */
  function named(text) {
    const want = bare(text);
    if (want.length < 3) return null;
    return floors().find((l) => !l.unmarked && l.id !== HOME && (l.id === want || bare(l.name) === want || bare(l.name).split(' ')[0] === want)) || null;
  }
  /** As pressed on the panel: an id, a name, or the letter on the button. */
  function button(text) {
    const want = bare(text);
    return floors().find((l) => l.id === want || l.floor.toLowerCase() === want || (!l.unmarked && bare(l.name) === want)) || named(text);
  }

  /**
   * Both of these return a target of kind 'elevator', so every caller that
   * already knows the lift treats it gently: { level, thing } for a thing on the
   * floor the agent is standing on, { level } for a floor mentioned by name.
   */
  function resolveHere(agent, text) {
    const here = floorOf(agent);
    if (!here || !TEXT[here.id]) return null;
    const want = bare(text);
    if (['lift', 'elevator', 'doors', 'call panel', 'call button'].includes(want)) return { kind: 'elevator', level: here, thing: 'lift' };
    for (const [thing, names] of Object.entries(TEXT[here.id].things)) if (names.includes(want)) return { kind: 'elevator', level: here, thing };
    return null;
  }
  function resolveFloor(text) {
    const level = named(text);
    return level ? { kind: 'elevator', level } : null;
  }

  function look(agent, level) {
    const place = world.placeOf(agent.id);
    const clock = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const lines = [`[${level.name} — floor ${level.floor}, by the lift]  ${clock}`,
      `You are ${agent.name}, a few steps from the lift doors.`, ...TEXT[level.id].look(agent, api)];
    return { ok: true, text: lines.join('\n'), room: place?.room || null, level: level.id, place };
  }

  function examine(agent, target) {
    if (target.thing === 'lift') return { ok: true, text: `The lift, set into the wall behind you. Its display reads ${target.level.floor}. (office go home takes you back to the office)` };
    if (target.thing) return { ok: true, text: TEXT[target.level.id].examine(agent, target.thing, api), level: target.level.id };
    if (target.level) {
      const l = target.level;
      return { ok: true, level: l.id, text: `${l.floor} · ${l.name} — ${l.blurb}\n` + (rides(l)
        ? `The lift goes there, and it will take you: office use lift ${l.id}`
        : 'The lift goes there, but only for humans at this stage.') };
    }
    return { ok: true, text: describeLift() };
  }

  /** Take the lift to a floor. The agent walks into the car in the office; from then on its `look` is that floor. */
  function ride(agent, where) {
    const level = button(where);
    if (!level) return { error: `the lift has no button for "${where}" (office look lift)`, status: 404 };
    if (agent.lead) return { ok: true, text: `In the office itself the lift has a proper panel: click its doors, choose ${level.floor}.` };
    if (level.id === HOME) {
      if (!floorOf(agent)) return { ok: true, text: 'That is this floor. The lift waits, politely.' };
      world.sendHome(agent);
      return { ok: true, text: `You ride back to ${level.floor}. ${level.name}. You head for your desk.` };
    }
    if (!rides(level)) {
      const open = floors().filter(rides).map((l) => `${l.floor} (office use lift ${l.id})`);
      return { ok: true, text: `You press ${level.unmarked ? 'the button with no label' : level.floor}. It lights, thinks about you, and goes dark: ${level.unmarked ? 'that one' : level.name} is for humans only at this stage.${open.length ? ` It will take you to ${list(open)}.` : ''}` };
    }
    if (floorOf(agent)?.id === level.id) return { ok: true, text: `You are already on ${level.floor}.` };
    // into the car — onto the tile that stands for this floor (core/levels.mjs: `car`)
    const car = world.layout().roomById.get('elevator');
    const moved = world.go(agent, { kind: 'room', room: { ...car, rect: { x: level.car[0], z: level.car[1], w: 1, d: 1 } } }, { stay: true });
    if (moved.error) return moved;
    away.set(agent.id, level.id);
    const wait = Math.max(0, (moved.place?.eta || 0) - Date.now() - 900);              // the doors open as they get there
    const timer = setTimeout(() => world.fx({ kind: 'elevator', dir: 'ride', id: agent.id, level: level.id }), wait);
    if (typeof timer.unref === 'function') timer.unref();
    return { ok: true, level: level.id, place: moved.place,
      text: `You walk into the lift and press ${level.floor}. Doors closing. A short ride, a ding. ${level.name}.\n` + look(agent, level).text };
  }

  function use(agent, target, arg) {
    if (target.thing === 'lift') return arg ? ride(agent, arg) : { ok: true, text: 'The lift is behind you, doors closed. (office go home, or: office use lift <floor>)' };
    if (target.thing) return { level: target.level.id, ...TEXT[target.level.id].use(agent, target.thing, arg, api) };
    if (target.level) return ride(agent, target.level.id);
    return arg ? ride(agent, arg) : { ok: true, text: callLift() };
  }

  /** Where someone is, if that is another floor: { room, text } in the words `office who` uses. */
  function whereabouts(agent) {
    const level = floorOf(agent);
    if (!level) return null;
    const place = world.placeOf(agent.id);
    return { room: place.room, text: Date.now() < place.eta ? `walking to the lift, for ${level.name}` : `down the lift, in ${level.name}` };
  }

  return { floors, panel, describeLift, callLift, floorOf, whoIsOn, humansElsewhere, resolveHere, resolveFloor, look, examine, ride, use, whereabouts, rides };
}
