# What is under the office — a guide for whoever adds to it

**This file gives a secret away.** `WORLD.md` will not tell you what is behind
the wrong corner of the Back Room, or behind one stretch of wall in the
basement. This file has to, because it is for the people and agents who build
rooms for it. If you would rather find it yourself, stop reading and go and
lean on things.

It is a level called the Backrooms: yellow rooms that hum, seen through a
camcorder, generated from a seed and never the same twice. It is one building.
A visit goes down through three to five parts of it, each a different kind of
place (the code and this guide still call a part a *floor*; nothing down there
does, and nothing is numbered). Behind the fire door at the far end of each is
a way down that cannot be undone: a hole in the floor, a corridor that stops,
a post chute. Never a flight of stairs, and no key is pressed: the door's bar
is pushed by walking into it (the owner, twice: a level got to by a button and
some stairs is a video game's). There is no cut and no loading: the part
below is built while you walk and is really there under the edge, and near a
seam the carpet and paper of the next part turn up early. On the last part
there is no door. The fire stairs
run out at a wall somebody has papered over, taped a door on, and camped
beside; it gives if you lean on it, the way the first one did. Other walls
carry the same tape, and are only walls: lean on one and it knocks back. What
you find on the way (battery packs, a keycard) is only yours if you get out. In some
visit something follows you: a shop dummy for as long as you watch it from
across a room, and not safe to stand beside, watched or not. It only knows
where you are while it can see you, some doors can be shut on it, and it
cannot crawl. Others turn up with it, a different few each visit.

Everything is in `public/world/backrooms/`. Nothing in it needs a build step,
a dependency or the network.

## The rules of the place

These are the owner's, and every room is held to them.

1. **Nothing is explained.** No captions, no instructions, no control hints,
   nothing on screen but the camcorder. Words live in the world: on signs,
   screens, labels, sticky notes. The owner's requested Esc menu is the
   exception: its Controls page explains the hands and the inventory, over
   the paused camcorder picture. Room puzzles still explain themselves.
2. **A room may ask for more than one new thing.** This rule used to hold
   every room to at most one thing the visitor had had no chance to learn.
   The owner has dropped that: "I am unconvinced this 'one new rule' thing is
   even necessary. We are targeting adults with this game... we shouldn't
   think the player is dumb." A room should still say what it teaches and
   what it takes for granted (rule 3), so the plan can deal the plainest
   rooms first. A puzzle may borrow the shape of a well-loved mechanic; it
   may never be a recreation of a particular game's level, look or name.
3. **Rules stack with depth.** Since nothing is explained, the only teacher is
   the order things are met in. A room says what it is the first place to
   learn (`teaches`) and what it takes for granted (`needs`), and the visit's
   plan only deals a room on a floor below the rooms that taught everything it
   needs. The first floor teaches; deeper floors combine.
4. **Stumped is fine; silent is not.** Whatever somebody tries, the room
   answers: a sound, a movement, a refusal they can see. Being stuck must read
   as a puzzle and never as a fault.
5. **Never a trap.** Every doorway of a room can be walked to from every
   other, always. The level checks this when it builds a room, and if your
   furniture walls a doorway off, your furniture stops being solid.
6. **Most of the place is nothing much.** Being lost in mundane rooms is the
   point, and a set piece only lands if it is rare (see *The shape of a floor*).
7. **It is ours.** Take the feeling from wherever you like; take no names,
   level numbers, creatures or looks from anybody's wiki, film or game.
8. **The humour is dry and it is about work.** The level borrows the real
   office's project names, agent names and task titles (`o` in `roll`, below),
   and that is where most of the jokes come from. It never mocks a person.
9. **The same seed is the same room.** What a room looks like is decided by
   what it rolled and by the seeded `c.R`, and by nothing else. `Math.random`
   is for things that happen later, while somebody is standing in it.

## The shape of a floor

A floor is 20 to 40 rooms, about 30 as a rule. Five to eight of them are
**oddities** (the rooms in the deck); the rest are **plain rooms**. Measured
over 225 floors, between 73% and 81% of a floor's rooms are plain, and no
oddity ever opens straight into another: there is always at least one plain
room between them. Tests hold both.

Plain rooms are not written one at a time, and they are meant to be hard to
tell apart. Each floor has a small vocabulary (`quiet.js`, after Codex's
quiet-maze study): two or three wall-and-pillar motifs, turned and used again
and again; one way its corridors are lined, or not; and one or two things that
are quietly wrong, repeated in several rooms and never the mark of one — a
partition with a hole at crawl height and another at head height, a whole
workstation sunk in the carpet. Each kind of floor repeats in its own way
(`TELLS`): partitions and doglegs in the yellow, bay after bay and corridors of
piers in records, almost nothing at all out of hours, columns and half-built
stud walls where it is being fitted out, screens with a return on them on the
top floor. Nothing in a plain room can be used, and hardly any has anything
left in it (about one in sixteen): an empty room is the point.

| kind | what it is | how often |
|---|---|---|
| plain | the connective rooms: a wallpaper, a carpet, tubes, and a layout from the floor's small vocabulary | three quarters of every floor |
| oddity | a room from the deck: one idea, a few metres across | a visit's **hand** is 40–70% of the deck, chosen and scrambled by the seed and dealt across its parts (`plan.js`): two to five a part while the deck is this size, never a room twice in a visit. (A floor generated by itself, as the tests and `room=` do, still deals five to eight) |
| set piece | an oddity that says `big: true`, or has a view (`halo`) | one a floor at most |
| placed by the plan | a room that says `planned: true` and is put where the visit's plan decides. So far one: the hallway that is not sure where it leads (`rooms/unsure-hall.js`), below wherever the cardboard people were. It is also a **gate** (below): the way out of its part is through it | one in most visits, never two, never where you land |
| from the news | a room the place has half-remembered from the headlines and staged wrongly (`headline: true`). Wordless and unnamed, unless the owner has said what is written in it. **Only the owner decides which stories become rooms.** So far two: Dispatch (`rooms/dispatch.js`, after Codex's), and the MECHA training floor (`rooms/mecha.js`, Codex's; `docs/MECHA.md`), whose words are the owner's | one a visit at most, in about a third of visits, never on the floor you land on |

## Adding a room

A room is two things: a line in the deck, which is pure data, and a file that
builds it. `rooms/kanban.js` and its line in `gen.js` are the worked example;
read them beside this.

### 1. The line in the deck

New rooms go in `MORE_DECK` in `deck2.js`.

```js
{ id: 'kanban', name: 'The Board', landmark: 'the board with one card',
  w: [8, 10], d: [6, 7], ports: ['left', 'right'], weight: 1.3, lights: 'normal',
  module: './rooms/kanban.js',
  stash: (r) => [-r.W / 2 + 1.2, -r.D / 2 + 0.7, -0.6, -r.D / 2 + 1.25],
  roll: (R, o) => ({ text: o.tasks.length ? R.pick(o.tasks) : 'TODO', cards: R.int(44, 70), spill: R.int(14, 34) }) },
```

| field | | |
|---|---|---|
| `id` | required | lower-case words joined by hyphens. It is also the file name and what the dev page calls the room |
| `name` | required | its title on the dev page's plan. Never shown in the level |
| `landmark` | required | how somebody lost down here would give directions past it: "the board with one card" |
| `w`, `d` | required | `[fewest, most]` whole metres: across the wall you come in by, and deep. 3 to 20; a set piece (`big`) may go to 28 |
| `h` | | `[lowest, highest]` ceiling in metres, if not the usual one. 2.3 to 9; a set piece may go to 12 |
| `ports` | required | which of `back`, `left`, `right` may be given one more doorway, in the middle of the wall, so that the room can lie on a path. `[]` makes it a dead end. Never `front`: that is the way in |
| `weight` | required | how often it is dealt. 1 is ordinary; 3 at most |
| `lights` | required | what the ceiling does: `normal` (as the floor's theme has it), `dim` (about half the tubes out), `entry` (lit only near the door you came in by), `one` (a single tube), `dark` (none: the room lights itself) |
| `roll(R, o)` | required | everything the room decides from the seed, returned as plain data (numbers, strings, lists). `R` is the seeded source: `R()`, `R.range(a, b)`, `R.int(a, b)`, `R.pick(list)`, `R.some(list, n)`, `R.shuffle(list)`, `R.chance(p)`, `R.weighted(list, weightOf)`. `o` is the office: `o.name` (the visitor), `o.projects`, `o.agents`, `o.tasks`, any of which may be nearly empty. The builder reads the result as `c.params` |
| `module` | required for a new room | `'./rooms/<id>.js'`. Fetched the first time a floor has the room on it |
| `stash(r, side)` | required | the room's hiding place, where whatever the seed leaves in this room is put (a battery pack, a snack; it used to be a cassette): `[x0, z0, x1, z1]` (or a list of them) in the room's own frame, strictly inside its walls. `r` is the room as generated (`r.W`, `r.D`, `r.params`), `side` is −1 or 1 for rooms that have a left and a right. Your builder leaves that patch of floor clear |
| `teaches` | | the id of the one lesson this room is the first place to learn (`LESSONS` in `gen.js`) |
| `needs` | | lesson ids it takes for granted. It is only dealt on a floor below rooms that taught them all, so a room that needs anything but `lean` is never on the floor you land on |
| `themes` | | `{ yellow, archive, night, fitout, exec }` → a multiplier on `weight` for that kind of floor. 0 keeps it off one; `'*'` is every kind it does not name (*A new kind of floor*) |
| `big` | | `true`: a set piece. One a floor at most |
| `halo` | | `{ back, side, lip }`: metres of the plan kept empty behind and beside the room, for a room that is a balcony over a view drawn there. Makes it a set piece |
| `planned` | | `true`: never dealt by chance, only where the visit's plan puts it |
| `headline` | | `true`: staged from the news. The owner's call, nobody else's |
| `gate` | | `(room) => where along a side wall the way on goes`. The way out of the part is through this room and nowhere else: see "A room the way out is through" |
| `on` | | `false`: retired. It is out of the deck and nothing else has to change. Leave the line and the file: it may come back |

A new lesson is a line in `LESSONS` (an id, and what is learned, in a
sentence) and a room that teaches it. The lessons so far: `lean` (known from
the start: it is how you got in) and `unwatched` (some things only move while
nobody is looking at them, taught by the cardboard people).

### 2. The file

`rooms/<id>.js` exports one function.

```js
export function build(c) {
  const { W, D, H, R, params: p } = c;
  c.shell();                              // floor, ceiling and its tubes, four walls with their doorways
  // …everything else
}
```

Everything is in **the room's own frame**: metres, `x` across (−W/2 to W/2),
`z` deep, `y` up from the floor. You come in at `z = +D/2` (the `front` wall)
looking toward `back` at `z = −D/2`. The generator turns the room to face
whichever way the plan needs; you never see that.

A room may import `three`, the level's own modules (`../kit.js`, `../bits.js`,
`../gen.js`, …), the voxel kit (`../../vox/`), the office's props
(`../../props/`) and the office's people (`../../avatar/`, for a figure built
the way the colleagues upstairs are). Nothing else, nothing from the network,
and it keeps nothing in the browser's storage. A test reads the file to see. A room too big for one
file keeps the rest in a folder of its own, `rooms/<id>/`, and imports it from
there (`./<id>/crates.js`): `rooms/` itself holds one file to a room and
nothing that is nobody's.

### 3. The toolbox

`c` is made in `world.js` (`roomContext`), and every method has a line there
saying what it does. In outline:

| for | use |
|---|---|
| the room | `c.shell(opt)` · `c.pillar(x, z, w, d)` a block of wall · `c.solid(x0, z0, x1, z1)` something you cannot walk through · `c.hole(x, z)` a missing ceiling tile |
| furniture | `c.prop(type, x, z, { rot, y, o })` anything from the office's catalogue (`desk`, `chair`, `crt`, `cooler`, `shelving`, `boxes`…; `c.hasProp(type)` asks) · `c.model(key, make, x, z)` a voxel model of your own (`Vox` from `../../vox/vox.js`), meshed once · `c.crate(…)` a plain painted block · `c.wallProp(type, side, at)` |
| flat things | `c.hang(batch, side, at, y, w, h)` on a wall · `c.lay(batch, x, z, w, d, rot)` on the floor · `c.board(…)` standing · `c.wbox(side, at, w, y0, y1, d0, d1, rgb)` a box against a wall · `c.paper(x, z)` · `c.blot(…)` a stain |
| surfaces to draw on | `c.flat` (plain colour), `c.wall`, `c.floor`, `c.ceil` · `c.mapped(key, texture)` lit by the room · `c.shining(key, texture, power)` lit by itself: screens, signs · textures from `c.kit.tex.custom(key, w, h, draw)` and `atlas(…)`, `drawText(…)` in `kit.js` |
| light | `c.light(x, y, z, color, power)`. Light is baked into the room once, when it is built: lights do not move, and things that move are lit by where they started |
| where things can go | `c.spot(r)` a free bit of floor · `c.corner()` · `c.wallSpot(need)` a free stretch of wall · `c.spans(side)` · `c.clear(x, z, r)` · `c.reserve(x, z, r)` · `c.doorPoint(door, off)` |
| things that happen | `c.tick((dt, t, me) => …)` every frame while somebody is in the room or next door (`me.x`, `me.z`, `me.yaw`, `me.inside`, `me.moving`, `me.speed`) · `c.zone({ x0, z0, x1, z1, enter, leave, stay })` · `c.use({ x, z, r, label, use, when })` something `E` does · `c.seen(x, z)` is that spot on their screen · `c.dynamic(batch, { pivot })` a part that moves · `c.rt.onEnter`, `c.rt.onLeave` |
| the level | `c.env.play(name, x, z, reach)` a sound from a spot · `c.env.interfere(0…1)` static on the tape · `c.env.sees(x, z)` · `c.env.who`, `c.env.cast` the visitor and the office's agents |

Things to know before they bite:

- **`c.use`'s `label` is never shown.** The camcorder lights a small mark when
  `E` would do something, and that is all the prompt there is. If a thing can
  be used, it has to look as though it can.
- **Low places work by themselves.** A room may have parts with less headroom
  (`c.rt.headY = (x, z) => metres of it`): the eye sinks under them without a
  key being pressed, and the doorway check knows about them. `C` (a crouch,
  held) and `Space` (a small hop) exist, and neither may be *needed* to cross
  a room.
- **Nothing pushes the visitor.** No moving walls, no colliders that travel.
  If something carries them, take the controls for a second and move them
  along a path (`c.env.player.warp`), camera level, then let go.
- **Glass and anything see-through is expensive** and sorts badly. Few panes,
  simple tints.
- **A creature that lives in one room is part of that room's file**: its model
  (`c.dynamic`), its behaviour (`c.tick`), its sounds. Keep its rule in a pure
  function at the top of the file so that it can be read and tested. Anything
  that roams between rooms, or that should turn up in some visits and not
  others, is a member of the cast: see *Adding a creature*.
- **A room's own hazard sets somebody back; it does not end the visit.** Put
  them back at the door, take a moment from them, turn the lights out. Ending
  a visit is for the things that hunt.

### 4. What a room may cost

Measured on the nineteen rooms that are there now, the heaviest is 55,000
triangles, and none has more than 43 meshes or 16 lights. Stay inside that:
**60,000 triangles, 45 meshes, 16 lights.** A set piece may have
twice the triangles, since it is the only one on its floor. Batches are what
keep the mesh count down: everything drawn into the same batch is one mesh.

### 5. Trying it

Start the office (`node daemon.mjs`) and open the level's own page, which
needs no office to be set up:

```
/world/dev/backrooms.html?seed=7&room=<id>&vhs=0&mute=1&pursuer=0&check=1
```

`room=` deals your room into the floor and stands you in it. `x`, `z`, `yaw`
and `pitch` stand you somewhere particular, which is how to take a picture.
`vhs=0` is a clean picture, `vhs=2` is how it is really seen: look at both.
`seed=` anything; try several, since your room is a different size and has
different doorways each time. `map=1` prints the plan. The head of
`public/world/dev/backrooms.js` lists the rest, and `window.__backrooms` is
the live floor (`goto`, `where`, `world`, `level`).

`check=1` prints one line on the console when the floor is up:

```
[check] {"seed":"7","floor":0,"rooms":[{"arch":"kanban","room":1,"size":[8.8,6.8,2.6],"buildMs":84,"bakeMs":4,
  "meshes":9,"triangles":9628,"solids":2,"lights":7,"uses":1,"zones":0,"ticks":0}, …],"said":[]}
```

`said` is everything the level warned about while it built. It must be empty.
The three things it says about a room are *would not build — leaving it plain*
(your builder threw: the message follows), *would not load* (the file is not
where the deck says) and *a doorway … could not be reached — its furniture is
no longer solid* (rule 5).

Then `npm test`. `test/backrooms-rooms.test.mjs` holds every line of the table
above, and the older Backrooms tests deal your room into hundreds of floors.

### 6. Handing it over

If you can push a branch, push one. If you cannot, send back, as text:

1. the line for `MORE_DECK`, and a line for `LESSONS` if the room teaches something new;
2. `rooms/<id>.js`, whole, and any other file it needs;
3. the `[check]` line from three different seeds;
4. the addresses you looked at it from (the whole query string), so the same pictures can be taken again;
5. two sentences: what somebody learns in the room, and how the room answers somebody who does the wrong thing.

Nothing else is needed, and nothing else should change: a room that needs a
change to the generator, the player or the toolbox says so in words instead of
making it.

## Adding a creature

A creature is three things: a line in the cast, which is pure data; a file
that builds it and works it; and one rule, kept where a test can run it.
`cast/pirate.js`, its line in `cast.js` and its rules in `cast/hunt.js` are
the worked example. The mascot is in every visit; everybody else is dealt
from the visit's seed, two at most, a different two each time.

The first floor keeps that original, quieter deal. On each later floor the
mascot is already roaming: a seeded clear spot at least three doors and nine
metres from arrival, with twelve playable seconds before it can move or
attack. Falling does not spend that grace. It starts without knowing where
the visitor is, and keeps its carried face/keycard; there is only one body.
Explicitly quiet development visits still suppress it. `cast/roaming.rule.js`
chooses usable full-height rooms beyond low arrival openings.

Residents' meshes are positioned, lit and culled before they join a new
floor's scene. Their behaviour remains frozen during descent, so an office
avatar never appears at the landing merely because its first AI tick has
not happened yet.

The shadow has two stages: a central stare charges it for 1.1 seconds, then
it turns white and its 0.85-second fuse runs independently of your gaze.
Get it entirely out of view (or behind cover) before the flash and it burns
out for that floor, awarding one survived encounter without draining the
camera or blacking out the room. A short glance cools away and clears nothing.
Looking back before the fuse finishes still triggers the usual half-battery
loss and blackout; touching it also triggers that penalty. Failed encounters
keep the existing return delay. The white figure cannot relocate while armed.

The waste toner (Gemini's) hears and does not see, and is the one member of
the cast that is more than one body. It hangs from the ceiling, clicking every
two seconds or so, with black drips falling under it. Upright steps within
eleven metres turn the clicks to a rattle; 0.65 seconds of walking within 7.5
metres brings it down (a run, almost at once), and on the floor it is faster
than anybody runs. Somebody standing still or stooped is not heard at all.
Each has two bites in it, a heart apiece: after the first it goes back up and
keeps away for eight to ten seconds; after the second it melts into a puddle
that is waded at half speed and, a minute later, hatches two or three more,
which keep to the room they hatched in until they hear somebody. Never more
than seven are hunting on a part. It cannot open a door, a fire turns it
back, and it is the only thing that walks into the crawl spaces.

### What a creature is

- **One rule, never stated, and not somebody else's.** A creature is a rule
  you can learn by watching what it does. "It only moves while nobody is
  looking" is the mascot's. Write yours down in a sentence (`rule`) before you
  write anything else; if it takes two sentences it is two creatures.
- **Fair.** The danger can be read before it costs anything: a sound, a
  posture, a change in the picture. Only something that `hunts` may take
  health or end a visit. Everything else sets the visitor back, or helps.
- **Ours.** No names, looks or behaviours from anybody's wiki, film or game.
  They are of this office: colleagues, facilities, things from a workplace
  that has gone wrong.
- **Cheap.** A few thousand triangles, lit by where it stands (`c.light`), a
  handful of meshes. No new audio files: `sound.js` voices only. (The two
  files the level does load are the owner's own music: `music/room4.mp3`,
  played low under everything; `music/deep.mp3`, which takes its place from
  the third part of a visit on, quieter still; and `music/mascot.mp3`, the
  mascot's. Those
  were the owner's to add.)
- **The mascot has music.** A line of the cast may say `music: 'mascot'`,
  and only the mascot's does. The piece begins the moment a part's mascot
  has first really been seen (in view and near for a moment: `c.met()`), is
  played once through in place of the usual music, and the usual music
  comes back up when it has run out. Nothing else stops it: not losing
  sight of the mascot, not leaving the room or the part. A mascot that is
  no more takes it with it. Each part's mascot is met once, so it is once a
  part at most, and a piece still playing is not begun again. The file is
  not fetched until that moment; its volume, M and the menu apply to it as
  to the other. (The owner: "It can stop either when the mascot dies
  (unlikely) or the track runs out. If they encounter again on a new level
  it can play again.")
- **Seeded.** Which visit it is in, which floor and which room are decided by
  the seed and nothing else. `Math.random` is for what happens while somebody
  is playing.

### 1. The line in the cast

In `ALL_CAST` in `cast.js`:

```js
{ id: 'pirate', name: 'The mascot', rule: 'It only moves while nobody is looking at it — and it only knows where you are while it can see you.',
  disposition: 'hunts', home: 'roams', always: true, weight: 1, teaches: 'sight', needs: [], items: [], caught: { hurt: 2 } },
```

| field | | |
|---|---|---|
| `id` | required | lower-case words joined by hyphens. Also the file, `cast/<id>.js` |
| `name`, `rule` | required | for the dev page and this guide. Never shown in the level |
| `disposition` | required | `hunts` · `keeps to itself` · `helps` |
| `home` | required | `roams` (walks the floor) · `room` (lives in one plain room, which `homeFor()` chooses and hands you as `c.home`) |
| `weight` | required | how often it is dealt: 1 is ordinary, 3 at most, 0 never. (`always` is the mascot's and nobody else's) |
| `teaches` | | the one lesson it is the first place to learn: an id in `CAST_LESSONS`, where you add a line saying what is learned |
| `needs` | | lessons it takes for granted, the cast's or the rooms' (`lean`, `unwatched`). A creature that needs anything is never on the floor you land on |
| `themes` | | `{ yellow, archive, night, fitout, exec }` → a multiplier on how likely each kind of floor is to be its floor. 0 keeps it off one |
| `items` | required | which things a visitor may be carrying change what it does (`ITEMS`: `torch`, `battery`, `chalk`, `paper`, `scissors`, `snack`, `balloon`). `[]` for none. This is how whoever writes an item finds out who is waiting for it |
| `fire` | required | what paper the visitor has set light to is to it: `'fears'` (will not go within three metres of a fire it can see, and backs off from one lit beside it, watched or not) · `'ignores'` · `'drawn'` (goes to it). Its own rule does it, with `c.fire` and `cast/fire.rule.js` |
| `caught` | required | what it costs to be got by it. `{ hurt: n }` points of health, of four · `{ ends: true }` the tape ends, whatever health there is (only for `hunts`) · `{ setback: 'in a sentence' }` for the rest |
| `withRoom` | | the id of a kind of room (a deck line). Such a member is on a part if and only if that part has that room: it is never dealt by weight, takes nobody's place, and is handed `c.lair` (*Coming with a room*) |
| `room` | for `home: 'room'` | `{ w, d }` the least floor it needs, metres (3 to 12), and `far`, the fewest doorways from where you land (default 3) |
| `on` | | `false`: retired. Leave the line and the file |

Then one line in `cast/index.js`, so that the level (and the page it is staged
on for showing) can find the file.

### 2. The file

`cast/<id>.js` exports one function. Its rule is pure and lives in a module
beside it that imports nothing a test cannot (`cast/<id>.rule.js`; no
three.js, no DOM), with tests against a made-up clock. `cast/shadow.js` and
`cast/shadow.rule.js` are the short example (`cast/moth.js` is one that helps,
`cast/porter.js` one that lives in a room); `cast/pirate.js` with
`cast/hunt.js` and `reach.js` the long one.

```js
// cast/<id>.rule.js
export const RULE = Object.freeze({ near: 2.5 });
/** One moment of it. Pure: state in, state out. */
export function minds(s, dt, sense, rnd = Math.random) { … }

// cast/<id>.js
import { RULE, minds } from './<id>.rule.js';
export function create(c) {
  let me = null;
  return {
    ready() { … },             // the floor is built and somebody is standing on it: take your place
    update(dt, t) { … },       // every frame
    carry() { return null; },  // what you want handed to yourself on the next floor down (c.carried there), if anything
    at() { return { … }; },    // where you are and what you are doing, for the dev page and for scripts
    dispose() { … },           // take your objects out of the scene
  };
}
```

`create(c)` is called before the floor is built, for every creature on that
floor; `ready()` once it is up. A creature that throws is left out, and the
level says so (`check=1`: `said` must be empty).

It may import `three`, the voxel kit (`../../vox/`), the office's props
(`../../props/`), and the level's pure modules and kit (`../gen.js`,
`../kit.js`, `../bits.js`, `../reach.js`, `./hunt.js`, `./paths.js`). Not the
world, the player, the camcorder or the sound: what it needs of those comes
through `c`. It never calls `env.end`: being caught is `c.hurt`.

### 3. The toolbox

| for | use |
|---|---|
| who and where | `c.member` its line · `c.home` its room's id (or null) · `c.haunt` a room that asked for company and got you (id, or null: see below) · `c.lair` for one that comes with a room, where it lies up (id, or null) · `c.R` the seeded source · `c.carried` what it left itself upstairs |
| the visitor | `c.me()` → `{ x, z, yaw, pitch, speed, moving }` · `c.room(x, z)` which room that is · `c.held()` what they are holding (`{ type, … }` or null: there may be no inventory at all) · `c.take(type, n)` · `c.give(item)` |
| seeing | `c.hidden(x, z, r)` that spot is off their screen or behind a wall · `c.los(ax, az, bx, bz)` a line of sight between two spots, whichever way anybody is facing · `c.drawn(thing)` its room is being drawn at all |
| getting about | `c.walk.go(walker, { x, z }, metres, keep)` → `{ went, door, cannot, there }` · `c.walk.exits(walker)` · `c.walk.spotIn(walker, room)` · `c.walk.steps(walker, { x, z })` · `c.walk.stand(walker, x, z)` |
| being there | `c.add(object)` into the scene, in world coordinates · `c.body({ x, z, r })` a body nobody walks through · `c.light(x, z)` the light falling there · `c.play(name, x, z, reach)` |
| things to use | `c.use({ x, z, r, when, use })` something `E` does at a spot of the world. Nothing says so on screen: it has to look as though it can be used |
| keeping count | `c.met()` once, the first time in a visit that the visitor has really seen it (in view, and near enough to know what it is) · `c.survived()` each time it had them and they got away: a grab they lived through, a chase it lost them in |
| catching them | `c.hurt(n)` → `{ landed, dead, ended }` · `c.drain(share)` takes that share of the camcorder's charge, where it has a battery |
| fire | `c.fire(x, z)` → the fire that spot is within sight and reach of, `{ x, z, remaining }`, or null (always null in a visit without pockets). `afraid()` and `tooNear()` in `cast/fire.rule.js` are the fear, pure: the mascot uses them, and so can anything else that `fears` |
| the rest | `c.env`: `env.doors`, `env.interfere(0…1)`, `env.hud.glitch(seconds)`, `env.kit` for models and textures |

A **walker** is any object `{ x, z, r, tall, opens }`: where it is, its
radius, the headroom it needs, and whether it can work a door handle. That is
all the difference there is between something that is stopped by a shut door
and slips through a crawl hole (`{ tall: 0.6, opens: false }`) and something
that opens doors and cannot crawl (the mascot: `{ tall: 1.62, opens: true }`).
A hole in a wall is anybody's who fits through it; a crawl *space* (a room
you cannot stand up in) is only for a walker that says `crawls: true`, which
the waste toner does and the moth, small as it is, does not.
`go` never teleports and never decides anything: it takes the walker some of
the way, by whatever rooms lie between, and says what stopped it — `door` (a
shut pair it is standing at: `env.doors.open(door, 'it')` when your creature
has earned it), `cannot` (no way there at all for this walker), `there` (as
near as its body will go).

Things to know before they bite:

- **Doors are everybody's.** A few doorways a floor have a pair of fire doors
  that anybody can shut and open (`doors.js`, `doorleaf.js`). Shut, the
  doorway is wall to walking and to sight. `env.doors.at(linkId)`,
  `.shut(door, who)`, `.open(door, who)`, `.watched(door)`, `door.isShut`,
  `door.news` (shut by the visitor since anything last opened it). Do not
  build doors of your own.
- **Health may not be there.** `c.hurt(n)` takes n points where there is a
  health system and says whether the hit counted (it will not, for a moment
  after the last one) and whether it was the last of them, in which case the
  visit is already ending and you do nothing more. Where there is none, a
  creature that `hunts` ends the visit and anything else does nothing. After a
  hit that was survived, let go: back off, or go away for a while (the mascot
  keeps away for 14 to 24 seconds and takes no notice of you until then).
- **Items may not be there either.** `c.held()` is null where there is no
  inventory. A creature has to make sense with empty hands.
- **Never where it can be seen arriving,** if its rule involves not being
  watched: move, then check `c.hidden` at where it got to, and put it back if
  it would have walked into view. The mascot does this every frame.
- **The last three seconds are the building's.** When a hit through
  `c.hurt` takes the last heart, the tape does not go straight to static.
  The picture cuts to a fixed camera high in a corner of that room
  (`lastshot.js`), with the visitor's own office character standing where
  they stood, for three seconds; then static, then the card. Nobody of the
  cast is run during it but the one who took them, and only through
  `takes(shot)`, if what its `create` returns has one. `shot` is
  `{ x, y, z, yaw, room, figure, seconds }`: the spot (`y` is the floor),
  the room's id, the visitor's character (a THREE.Group, yours to move, turn,
  shrink or hide) and how long there is. Return a function `(t, dt)` and it
  is called ten times a second until `seconds`; set `shot.from = { x, y, z }`
  (world) to say where the camera films from, when the corner is a bad
  seat; return nothing and the
  character goes down where it stands. No `c.hurt` and no `c.met` from
  inside it. A room's resident does the same through its room: `c.rt.takes`.
  If the corner would not show it, say where it is filmed from: `films(shot)`
  beside `takes` (a room: `c.rt.films`) returns `{ x, y, z, at? }` in the
  world, the camera's place and what it is trained on (else the visitor's
  chest); return nothing and the corner camera has it. A flat battery,
  giving up and the way out end as they always did, and a hit that is
  survived stays in first person.
- **Company for a room.** A deck line may say `haunt: 1` or `haunt: 2`: the
  room asks for that many of the cast, and gets them only from those who roam
  and are dealt to that part anyway (`hauntsFor()` in `cast.js`: never the
  mascot, never anybody with `home: 'room'`, nobody if nobody is dealt
  there). Whoever is sent finds the room's id in `c.haunt`, and what it does
  about it is its own: the toner hangs there from the start if there is a
  place to hang, the moth waits at a light of it, the shadow shows itself
  within a second and a half of the visitor first walking in. Nothing new is
  made for it, and a creature may ignore it.
- **Coming with a room.** A cast line with `withRoom: '<arch id>'` belongs to
  one kind of room. It is on a part exactly when that part's floor has such a
  room (`withRoomFor(level)` in `cast.js`, asked of the built floor by the
  conductor, because the plan does not know which rooms a floor was dealt),
  and it is extra: `whoIsDown` and `castFor` never deal it, and nobody is
  left out to make room for it. Its `c.lair` is a room two to four doorways
  before its own on the way there from the landing (`lairFor()`: seeded by
  the floor; never the landing, the way out or the room itself; the nearest
  allowed if its room is closer than that; null if there is nowhere), so that
  it can be met and followed before the room is reached. What it does there
  is its own. Because the plan does not know of it, nothing that is planned
  from the cast (what is left lying about for them, what the walls warn of)
  counts it.
- **More than one body.** There are rooms that change the building and take
  whatever is in them (*A room the way out is through*). The conductor does
  this for you: it asks `at()` where you are, and if that is in the room it
  hides everything you added with `c.add`, takes your `c.body` out of the
  way, stops running you, and puts it all back when the room is. That is right
  for one thing in one place. If yours is several, in several places (the
  waste toner, its brood and its puddles), return `takeAway(inside, key)`,
  `bringBack(key)` and `awayWith()` from `create` and put away only the ones
  `inside(x, z)` is true of: the conductor then leaves it to you, and goes on
  running the rest of you.
- **A creature that lives in one room and is in every visit that room is in**
  is still part of that room's file. The cast is for what roams, and for what
  should be somewhere different, or nowhere, each time.

### 4. Trying it

```
/world/dev/backrooms.html?seed=7&vhs=0&mute=1&check=1
```

`window.__backrooms.env.pursuer.cast()` is everybody on the floor and what
each says of itself (`at()`); `.of('<id>')` is one of them. `plan()` and
`castFor` in `cast.js` say which floor yours is on for a seed; `&depth=` lands
you there. Then `npm test`: `test/backrooms-cast.test.mjs` holds every line of
the table above and reads your file, and it is where your rule's own test goes.

### 5. Handing it over

A branch if you can push one. Otherwise, as text: the line for `ALL_CAST` (and
for `CAST_LESSONS` if it teaches something), the line for `cast/index.js`,
`cast/<id>.js` whole, its tests, the addresses you looked at it from, and two
sentences: what its rule is, and how somebody who has not worked it out yet is
warned before it costs them anything.

## A room the way out is through

Most of what is odd down here is beside the way out. One room is the way out.

**The hallway that is not sure where it leads** (`rooms/unsure-hall.js`, its
rule and plan in `rooms/unsure-hall/rule.js`) is three rooms in a row, in one:
the room you come into, a hallway out of the far side of it, and a room at the
far end with nothing in it but a column. The first of them is three rooms
taking turns:

| It is | What is in it |
|---|---|
| `through` | the room you walked through: the doorway you came in by |
| `dead` | no way out of it but the hallway. The doorway is gone, and you know it was there because you came through it |
| `on` | a doorway that was not there before, an EXIT sign over it, and the lobby and the fire exit beyond |

It is the next one whenever nobody is looking at it and nobody is in it: once
per look away, and only after it has been looked at again. So: walk through,
go round the column (there is nowhere else to go), and the hallway ends in a
dead end; look away and back, and it ends in the way out; again, and it is the
room you came through. This was the owner's idea from the start: "an actual
room pathway to the exit would only be accessible by the triple look back, so
not simple cosmetics but actually the game engine swapping the room on the
map and the third one having an exit."

What makes it real and not paint:

- **The doorways are doorways.** The one it is entered by and the one the way
  out is beyond are links like any other, to real rooms. Each is open or shut
  with the room it is (`world.throats[link].open`), which is what a body walks
  through, what a line of sight passes, and what everything else that walks
  plans its way by. A doorway that is not there is papered over on both sides.
- **There is no way round.** A deck line that says `gate` is not dealt with
  the others. It goes in last (`gen.js`, `throughGate`): a run of plain rooms
  off the deepest room there is, the gate off the last of them, and the lobby
  and the fire exit off the gate and off nothing else. No doorway is ever
  added afterwards. A test takes the room out of each such part and checks
  that the exit can no longer be walked to.
- **The visitor is not shut in for good.** The rooms come round; the first
  has the way back in it and the third the way on. It never turns while the
  visitor is in it or in one of its doorways. And it never turns at all
  unless the visitor is in the hallway or the room beyond, so nobody who
  looked in from outside and walked off comes back to a wall.
- **It waits for nothing else.** The owner: "You don't want the swap to be
  blocked if an enemy is in a room. If an enemy is in a room it gets warped
  away with the room. The backrooms lore is not nice and considerate and
  waiting to make its changes." Whatever is in the room when it goes, goes
  with it, and is in it, as it was, when that room comes round again:
  the mascot and the rest of the cast (of the waste toner, the ones that
  are in the room and no others: a puddle on its carpet goes with its clock
  stopped), the colleague who came along, a resident that has walked in,
  anything put down on its floor, a chalk mark, a fire. While they are away they are not seen, not walked into, cannot be
  used and do nothing. (So a chalk mark made to find out whether it is the
  same room says what is true: it is not.) Each of the three rooms keeps its
  own. This is `env.takeAway(inside, key)` and `env.bringBack(key)`
  (`index.js`), which any room that changes the building may call; the cast
  (`pursuer.js`), the residents (`denizens.js`) and the floor
  (`inventory-world.js`, `inventory-fire.js`) each do their share.

The room at the back is a dead end with a column in the middle of it on
purpose (the owner's easier version): a walk round the column is a walk out of
sight of the hallway, so the first change happens to anybody who simply goes
in and comes back. What is hidden in the room, if anything, is behind the
column. The owner's harder version, where that room has other ways out of it
and coming back to the third room is still the only way to progress, is one
field away (`ports`) and is not built.

Adding another: give its deck line `gate: (room) => …` and `planned: true`,
have the plan `must` it, read `room.gate = { in, on }` (link ids) in its
builder, and keep the promises above. One to a part.

A creature needs to do nothing to be taken: the conductor puts away whatever
it added with `c.add` and whatever body it gave with `c.body` (or, for one
that builds itself as the mascot does, its `figure`: `{ group, body }`),
stops running it, and makes what it offered with `c.use` unusable. It is
found by where `at()` says it is. One that says it is nowhere is in no room.

## A new kind of floor

A visit goes down through several parts, and no two are the same kind of
place: the yellow one everybody remembers is only where you land. A kind of
floor is a **theme** (`themes.js`), and it is pure data. It changes what the
generator rolls and never how it works: the wallpaper, carpet and skirting
(`families`, from `FAMILIES` in `gen.js`, which also says what the floor
is made of), what the paper is printed with (`patterns`; `kit.js` draws
them), the colour of the tubes and how the ceilings behave, how the plain
rooms are proportioned and how high they are, what somebody left lying about
(`dressing`; `rooms.js` builds each thing), and the hum.

A new one needs more than its line:

- **Plain rooms of its own.** Most of a part is plain rooms (rule 6), and
  each kind of floor repeats in its own way: `quiet.js` gives a floor two or
  three ways of laying out a plain room and uses them again and again. A new
  kind of floor is told from the others by its own (`TELLS` in
  `test/backrooms.test.mjs`: add a line). If its plain rooms are the yellow
  floor's with different paper, it is not a new kind of floor.
- **Rooms that belong to it, and only those.** A theme that says
  `own: true` keeps to its own: a line of the deck that does not name that
  kind of floor is never dealt there, so the copier room does not turn up on
  it because nobody thought to say otherwise. And a room made for one kind
  of floor says `themes: { <id>: 1, '*': 0 }`, where `'*'` is every kind of
  floor the line does not name. Such a room is not counted in, or drawn
  for, a visit that has no such part, so adding rooms to a new kind of
  floor changes nobody else's building. An ordinary room that suits it too
  can be asked onto it: `themes: { <id>: 0.5 }`. (`atHome` in `themes.js`
  is the one place this is decided; the plan and the generator both ask
  it.)
- **Nothing of its own that the building already has.** Doorways, fire
  doors, the ways down (`seam.js`), the cast, pockets, the card: one
  building, whatever the part is dressed as.

**While it is being built it says `dealt: false`.** It is then in nobody's
visit: the plan deals from the finished ones (`dealtThemes()`). All that is
asked of it meanwhile is that it can be built as a part of a visit, however
few rooms have been made for it (none will do). What a kind of floor's plain
rooms must be like, and that a floor of it can be built by itself, are
tests of the finished ones, so taking the line out is what holds it to all
of them. It is looked at by asking for it by name:

```
/world/dev/backrooms.html?seed=7&themes=<id>&vhs=0&mute=1&pursuer=0&check=1
```

`themes=` is the kind of floor of each part, top down (`themes=yellow,<id>`
puts it second, where it will really be met); a part that is not named is
what the seed made it. On the site the same thing is `/play?debug&themes=`.
So a new kind of floor can be merged and released a room at a time, and
shown to whoever should see it, without being in anybody's game. Taking the
line out is what makes it live: it then turns up under the yellow floor like
the others, and the make of the building (`edition()`) changes with it.

## On a phone

A phone has no keys and no mouse, so while a finger is what is being used the
camcorder has a thumb stick and four buttons (`touch.js` draws them,
`touch.rule.js` says where they go and what a push means, `input.js`
listens). Nothing is made for a finger until there is one, and a mouse
pressed afterwards is rid of them again.

| Under a finger | What it is |
|---|---|
| the ring, low on the left | walking: it moves to wherever the thumb comes down, and goes as fast as it is pushed far |
| the ring, pushed well past its edge | running, until the thumb is back inside it. **A thumb walks unless it means to run**: the Floor Warden, the quiet zone and the cables all notice running, and the first stick ran whenever it was pushed all the way |
| a drag anywhere else | looking. A second finger looks while the first walks |
| the up and down arrows | a hop (for as long as it is held), and ducking (one tap ducks, the next stands: a thumb cannot hold C and look round) |
| the torch | the light: F, and one thing more. If there is a torch that works and it is not in the hand, it is taken out and switched on. Not there at all until there is a light to switch |
| the hand | E. Only there when there is something in front of you to use: it is the `[E]`, which a finger does not get |
| a pocket | the bag, as with a mouse; its buttons say nothing about keys |
| the pause mark | the menu |

**Where they go.** The picture is 4:3 and a phone is not. Held sideways there
is a black bar either side of the picture, and that is where they are: the
ring in the left bar, the buttons in the right (two across if the bar has
room, one column if the phone's notch has taken some of it). Held upright
the picture goes to the top of the screen and everything else is under it.
Only where the picture is the whole screen (a tablet) do they sit on it, and
then above the band along its bottom where the pockets are. The phone's own
edges (`env(safe-area-inset-*)`) are kept clear. Tests hold all of that on
nine shapes of screen.

**What they are.** Rings and plain shapes in the viewfinder's own colour: no
words on them, and no symbols a phone would draw its own way. The menu's
Controls page says what each does, for whoever goes to look.

Also for a phone: sound is asked for when a finger is *lifted* as well as
when it comes down (a phone only counts the first as a touch); the page
hidden (a phone in a pocket, another app in front) stops the tape with the
menu up; and the card at the end closes up on a short, wide screen so that
the way home is on it without a scroll.

## The camcorder menu

Esc opens the transparent camcorder menu; with the mouse captured, the
browser's release of the mouse opens the same menu. A small pause icon gives
touch screens the same controls; desktop play has no persistent menu hint.
Esc closes a submenu first, then resumes;
in the inventory it still closes the current card before opening the menu.

The menu pauses the whole visit: its tally, creatures and room hazards,
both batteries, hit cooldown, fire, falls, and the handover between parts.
Audio pauses at the same point. Opening the inventory alone does **not**
pause any of these. Resume clears held input and takes the mouse again when
the browser allows it.

Settings are remembered in `office.backrooms`: separate music and effects
levels, master mute, look sensitivity, inverted vertical look, and the
existing three picture modes. Defaults and saved-value validation live in
`core/backrooms-settings.mjs`; old saves with only mute and VHS still work.
Difficulty is visibly unavailable at Normal until it has real game rules.

Give Up confirms ending the recording and shows the scorecard, including
for a visit shorter than two seconds. The standalone site gives that card
Go back in (a building nobody has had) and Return to homepage buttons; the
Office keeps its return-to-work behavior.
The end reason remains `quit`, so giving up cannot count as escaping.

## What a visitor carries

Six pockets, four health points, and a camcorder that runs on batteries (Codex's
work: `inventory*.js`, `survival.js`; its own notes are
`docs/backrooms-lab/INVENTORY.md`). They belong to the visit, not to any one
part of the building, and they are on unless a visit is started with
`inventory: false`.

- **The clock.** The camcorder lands three quarters charged: five minutes.
  When it is flat the visit is over (`'battery'`). A battery pack puts two
  minutes back, up to six minutes forty. The clock runs while you are in
  play and while you fall; it does not stop for an open pocket. A pack in
  the hand goes into the camcorder with Q (or the bag's Recharge camera)
  while the camcorder is neither flat nor full; fitting one to a torch is a
  combination, and with the camcorder full Q opens the bag on that.
  In the final ten seconds a centered camcorder battery blinks above a
  countdown; fitting a pack clears that warning. At zero, the picture fades
  through dark static to black in 2.2 seconds. The empty battery holds until
  2.7 seconds, fades out by 3.6, and the scorecard opens automatically. These
  timings live in `battery-ending.js`. The ending cannot be paused or revived.
  The development page also shows the scorecard by default; `&card=0` skips
  it for automated checks.
- **Health.** One camcorder heart with four horizontal layers, filled from
  the bottom: white at four or three points, red at two or one, an empty
  outline at zero. Being caught costs what the creature's line says
  (`caught: { hurt: 2 }` for the mascot), not the whole visit; a snack puts
  one back. After a hit there is a moment in which nothing else lands.
- **Nobody is handed anything.** What is lying about is decided by the seed
  (`supplies.js`, pure): an early battery pack among the first four eligible
  rooms, then one per eight rooms. A part has zero or one snack and zero or
  one stack of 3–5 sheets. A torch is still likely in the first part (70%),
  rarer below (20%); chalk and a reusable lighter each have a 25% chance,
  tape 20%. Scissors and balloons are only scattered where somebody wants
  them. These rates roughly halve common scattered pickups; authored room
  props and creature gifts stay separate. Nothing is scattered where you
  land, at the way down, or in a room an earlier visitor left something in.
- **Spare packs are the currency.** The packs still in your pockets when you
  leave by the way out are `kept.batteries`, which is what the office pays
  for (`core/game.mjs`).
- **Empty hands.** Press the number of the held pocket again to stow its
  item; press it once more to hold it again. The item stays in its slot,
  with no use, drop, or creature handoff while stowed. `I` can still inspect
  that pocket. Picking something up does not undo an intentional stow.
  A stowed loose torch neither shines nor drains; a mounted torch still works.
- **Light.** The camcorder's own lamp still comes on in the dark, but it is a
  weak one. A torch in the hand is the light, wherever it is switched on,
  for as long as its own charge lasts. Its held model glows only when that
  particular torch is on, even if another torch is mounted and lit.
- **Attached light.** Tape and the torch, then combine the prepared torch
  with the camcorder. Mounting frees its pocket and keeps its charge and
  switch state. `F` works with any pocket selected, including empty hands.
  The **ATTACHED** row inside the bag shows its charge; choose **Fit batteries**
  and a spare pack to recharge it. It is equipment now, so it cannot be
  dropped or handed to a creature, and a second torch cannot be mounted.
- **The held model.** On narrow pictures, it fits above the pocket bar and
  its caption, with room to bob while walking. This uses the actual picture
  size in both VHS and clean modes. Opening inspection or crafting hides it.
  The torch points into the room in a gloved right hand, with its sleeve
  continuing offscreen. Only the held torch gets this grip; floor pickups
  and pocket icons keep their ordinary model. The grip draws after the room
  so standing against a wall cannot cut it away.
- **Nothing is written on the picture but `E`.** What a thing is, it has to
  look like; its name is said once it is in a pocket.

What a room or a creature may do with them, through `c.env` (a creature has
the same through its own toolbox: `c.hurt`, `c.drain`, `c.held`, `c.take`,
`c.give`):

| | |
|---|---|
| `env.health` | `read()` → `{ current, max, dead }` · `damage(n)` → `{ ok, dead }` · `heal(n)` |
| `env.camera` | `read()` → `{ remaining, capacity, fraction }` · `recharge(seconds)` · `drain(share)` takes that share of what is left (it never stops the tape by itself: the clock does that) |
| `env.inventory` | `held()` the thing in the selected pocket, or null · `give(item)` · `consumeHeld(type, n)` · `count(type)` · `physical.spawn(item, { room, x, z })` to leave something on the floor |

All of them refuse (`{ ok: false, reason: 'unavailable' }`) from a part of
the building the visitor is not in, and while nobody can act (a fall, a
chute, the end). Check that they are there before using them: a visit can be
run without.

On the dev page: `&inventory=0` for a visit without; `&supplies=1` for one of
everything on the floor where you land, for looking at them.

## How a visit ends, and the card

A visit resolves with `{ reason, kept, run }`. `reason` is `'exit'` (out by
the wall), `'caught'`, `'battery'` (the camcorder ran flat) or `'quit'`.
`kept` is what was carried out (`card`, `batteries`); `run` is what the visit
counted: `{ seed, seconds, parts: { reached, of }, rooms: { explored, kinds },
cast: { met, survived }, hearts }`. A creature tells the count about itself:
`env.run?.met(id)` the first time it is really seen, `env.run?.survived(id)`
each time it had somebody and they got away.

Before it resolves, the visit shows the card (`scorecard.js`): a wall of the
yellow paper with the score printed into it in the paper's own ink and a
picture beside every line. (`opt.scorecard === false` for none; on the dev
page, `&card=0` lets an automated check skip it.) What
the lines are worth is `POINTS` in `core/runs.mjs`; the first four are earned
however the visit ended, the rest only by getting out. The office keeps the
best score, every kind of room and resident anybody has met, and the tape
(the seed) of each visit that got out; on the level's own page, where there
is no office, the browser keeps the same record by the same rules. The jar
is paid for spare batteries only when a visit brings out more than any
before it (`payFor` in `core/game.mjs`).

## The level on a page of its own

To show somebody the level without an office to run it in:

```
node tools/backrooms-sample/stage.mjs <folder>
```

copies the level's own page (`tools/backrooms-sample/index.html`: one screen,
nothing on it but the level) and every module it needs into one folder that
anything can serve. It follows the imports, and includes every room that lives
in a file of its own. three.js comes from a CDN there, at the vendored
version. Every tape on that page is a different building, as every visit from
the office is: the seed is the clock, and no building is ever given twice.

## Where things are

| file | what is in it |
|---|---|
| `index.js` | the conductor: plans the visit, builds each part (the one below, ahead of time, hung under the way down), hands you from one to the next mid-fall, runs the frame, ends it |
| `seam.js` | the ways down and where the next part hangs (pure): `WAYS`, `DEALT` (the ones a visit is dealt: not the stairs), `GAP`, `dropOf`, `hangBelow`, and `pushes` (the fire door's bar) |
| `plan.js` | a visit from its seed: how many floors, which kind each is and how it ends, what is hidden where, what each floor may take for granted |
| `gen.js` | the generator and the first deck. Pure: no three.js, no DOM. `frame.js` is its geometry |
| `deck2.js` | the deck, continued: where new rooms' lines go |
| `rooms/vestibule.js`, `rooms/copiers.js`, `rooms/quiet-zone.js`, `rooms/mailroom.js` | four ordinary rooms dealt by chance: revolving doors that carry you (one of them out of the ceiling), photocopiers of which one prints the way on, a soundproofed room that shuts if you run in it and opens when you stand still, and a brass tube that sends a canister down whichever pipe leads toward the way down |
| `rooms/` | one file to a room, for every room written since the first deck |
| `rooms.js` … `rooms4.js` | the first deck's builders, and the plain room |
| `world.js` | builds a generated floor: the toolbox (`roomContext`), collision, the doorway check |
| `kit.js` | meshes, baked light, textures |
| `themes.js` | what each kind of floor is like |
| `stairwell.js` (also the hole, the ledge and the chute), `thin.js`, `marks.js`, `leaving.js` | the way down, and the taped door at the bottom of the last of it; the wall that gives and the walls that knock back; where the marks go, and the rule for leaning (`lean`, `answer`); what the camcorder sees as you leave |
| `traces.js` | what earlier visitors left: the marks on walls, the camp, and six things found in plain rooms (`TRACES` in `gen.js`: a camp left in a hurry, arrows that disagree, a note that stops, a tape measure run out, a map that is wrong, a queue at a bare wall, and a crude drawing of something that is really down here this visit, with what its artist had worked out about it, as far as they got: `drawings.js`) — two or three to a floor at most, far apart, in rooms with nothing else in them and no oddity next door |
| `loot.js` | the keycard: who holds it, what is kept (and the cassettes that used to be the office's coins down here; none are dealt now: spare battery packs are the currency) |
| `inventory.js`, `inventory-state.js`, `inventory-world.js`, `inventory-hud.js`, `inventory-items.js` | what a visitor carries: the controller · the pockets (pure) · things on the floor, picking up, putting down, chalk marks · the bar, the hearts and the inspection card · the models |
| `survival.js`, `health-state.js`, `camera-state.js` | the visit's hearts and the camcorder's battery, and who may touch them when · each of them (pure) |
| `supplies.js` | what is lying about in a part of the building, and in which rooms (pure, by the seed) |
| `cast.js`, `cast/` | who is down here (pure: the cast, who is dealt into a visit, on which floor, in which room) · one file to a creature, `cast/index.js` listing them; `cast/pirate.js` is the mascot; `cast/hunt.js` its rules (pure); `cast/paths.js` and `cast/walk.js` how anything gets about |
| `pursuer.js`, `reach.js` | the cast's conductor on a floor (and the cardboard colleague) · the rule for being within arm's reach of the mascot (pure: the tape tears, and it moves in the torn frames) |
| `denizens.js`, `absorbed.js`, `absorbed/` | residents that belong to one room and may walk out of it · colleagues the building is keeping (after Gemini's fifth pack): one to three a part, two thirds sunk into the wall, the carpet or the ceiling of a plain room, by dice of their own. They cannot move and never end a visit: within arm's reach they hold you for a second and a bit (less if you struggle), then leave you alone for three. A crouch goes under the ones in the ceiling and a hop over the hands of the ones in the floor. `absorbed/rule.js` is the rule (pure: how many, who, and the hold), `absorbed/rig.js` draws them |
| `banner.js`, `banner.rule.js` | the vinyl banner near where a visit lands: "VOTED 6TH BEST OFFICE PARK", and under it of where (a place name the page may hand the level as `where`; otherwise "IN THE TRI-COUNTY AREA"). Where it hangs is by the seed (pure, `bannerSpot`); it is not in the level's data, so a kept tape is the same tape |
| `doors.js`, `doorleaf.js` | which doorways have a pair of fire doors (pure) · the doors themselves |
| `player.js`, `input.js`, `hud.js`, `vhs.js`, `sound.js` | walking, keys and touch, the camcorder, the tape, the hum (and, from `music/`, the owner's music under it). Breath is `WIND` in `player.js`: about eight seconds of running from fresh, then out of breath for a few seconds (no running, a walk at half pace) with a recording of panting (`breath/pant.mp3`); nothing on the screen says how much is left |
| `touch.js`, `touch.rule.js` | what a phone has instead of keys: a thumb stick and four buttons, drawn · where they go on a screen of any shape, which part of it is the stick, and what a push means (pure) |
| `../levels/basement.js` | the floor above it all, and the wall |
| `../dev/backrooms.js` | the level's own page |
