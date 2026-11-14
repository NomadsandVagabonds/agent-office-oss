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
a way down that cannot be undone: stairs that run out, a hole in the floor, a
corridor that stops, a post chute. There is no cut and no loading: the part
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
   screens, labels, sticky notes.
2. **One new thing to learn per room.** A room may ask for as much as it
   likes, as long as at most one thing in it is something the visitor has had
   no chance to learn yet. Rules already met may come back and combine.
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
| placed by the plan | a room that says `planned: true` and is put where the visit's plan decides. So far one: the hallway that is not sure where it leads (`rooms/unsure-hall.js`), below wherever the cardboard people were | one in most visits, two in a long one now and then, never where you land |
| from the news | a room the place has half-remembered from the headlines and staged wrongly (`headline: true`). Wordless and unnamed. **Only the owner decides which stories become rooms.** So far one: Dispatch (`rooms/dispatch.js`, after Codex's) | one a visit at most, in about a third of visits, never on the floor you land on |

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
| `themes` | | `{ yellow, archive, night, fitout, exec }` → a multiplier on `weight` for that kind of floor. 0 keeps it off one |
| `big` | | `true`: a set piece. One a floor at most |
| `halo` | | `{ back, side, lip }`: metres of the plan kept empty behind and beside the room, for a room that is a balcony over a view drawn there. Makes it a set piece |
| `planned` | | `true`: never dealt by chance, only where the visit's plan puts it |
| `headline` | | `true`: staged from the news. The owner's call, nobody else's |
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
  handful of meshes. No new audio files: `sound.js` voices only.
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
| `caught` | required | what it costs to be got by it. `{ hurt: n }` points of health, of four · `{ ends: true }` the tape ends, whatever health there is (only for `hunts`) · `{ setback: 'in a sentence' }` for the rest |
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
| who and where | `c.member` its line · `c.home` its room's id (or null) · `c.R` the seeded source · `c.carried` what it left itself upstairs |
| the visitor | `c.me()` → `{ x, z, yaw, pitch, speed, moving }` · `c.room(x, z)` which room that is · `c.held()` what they are holding (`{ type, … }` or null: there may be no inventory at all) · `c.take(type, n)` · `c.give(item)` |
| seeing | `c.hidden(x, z, r)` that spot is off their screen or behind a wall · `c.los(ax, az, bx, bz)` a line of sight between two spots, whichever way anybody is facing · `c.drawn(thing)` its room is being drawn at all |
| getting about | `c.walk.go(walker, { x, z }, metres, keep)` → `{ went, door, cannot, there }` · `c.walk.exits(walker)` · `c.walk.spotIn(walker, room)` · `c.walk.steps(walker, { x, z })` · `c.walk.stand(walker, x, z)` |
| being there | `c.add(object)` into the scene, in world coordinates · `c.body({ x, z, r })` a body nobody walks through · `c.light(x, z)` the light falling there · `c.play(name, x, z, reach)` |
| things to use | `c.use({ x, z, r, when, use })` something `E` does at a spot of the world. Nothing says so on screen: it has to look as though it can be used |
| keeping count | `c.met()` once, the first time in a visit that the visitor has really seen it (in view, and near enough to know what it is) · `c.survived()` each time it had them and they got away: a grab they lived through, a chase it lost them in |
| catching them | `c.hurt(n)` → `{ landed, dead, ended }` · `c.drain(share)` takes that share of the camcorder's charge, where it has a battery |
| the rest | `c.env`: `env.doors`, `env.interfere(0…1)`, `env.hud.glitch(seconds)`, `env.kit` for models and textures |

A **walker** is any object `{ x, z, r, tall, opens }`: where it is, its
radius, the headroom it needs, and whether it can work a door handle. That is
all the difference there is between something that is stopped by a shut door
and slips through a crawl hole (`{ tall: 0.6, opens: false }`) and something
that opens doors and cannot crawl (the mascot: `{ tall: 1.62, opens: true }`).
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

## What a visitor carries

Six pockets, four hearts, and a camcorder that runs on batteries (Codex's
work: `inventory*.js`, `survival.js`; its own notes are
`docs/backrooms-lab/INVENTORY.md`). They belong to the visit, not to any one
part of the building, and they are on unless a visit is started with
`inventory: false`.

- **The clock.** The camcorder lands three quarters charged: five minutes.
  When it is flat the visit is over (`'battery'`). A battery pack puts two
  minutes back, up to six minutes forty. The clock runs while you are in
  play and while you fall; it does not stop for an open pocket.
- **Hearts.** Four. Being caught costs what the creature's line says
  (`caught: { hurt: 2 }` for the mascot), not the whole visit; a snack puts
  one back. After a hit there is a moment in which nothing else lands.
- **Nobody is handed anything.** What is lying about is decided by the seed
  (`supplies.js`, pure): a battery pack to every four rooms or so, a snack or
  two to a part, a torch more often than not where you land, chalk in about
  half the parts — and anything else (paper, scissors, a balloon) only on a
  floor where somebody wants it, which is the `items` of the cast dealt to
  that floor. Nothing is left where you land, at the way down, or in a room
  an earlier visitor left something in.
- **Spare packs are the currency.** The packs still in your pockets when you
  leave by the way out are `kept.batteries`, which is what the office pays
  for (`core/game.mjs`).
- **Light.** The camcorder's own lamp still comes on in the dark, but it is a
  weak one. A torch in the hand is the light, wherever it is switched on,
  for as long as its own charge lasts.
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
picture beside every line. (`opt.scorecard === false` for none; the dev page
shows it only with `&card=1`, so that a script is never left waiting.) What
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
| `seam.js` | the ways down and where the next part hangs (pure): `WAYS`, `GAP`, `dropOf`, `hangBelow` |
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
| `doors.js`, `doorleaf.js` | which doorways have a pair of fire doors (pure) · the doors themselves |
| `player.js`, `input.js`, `hud.js`, `vhs.js`, `sound.js` | walking, keys and touch, the camcorder, the tape, the hum |
| `../levels/basement.js` | the floor above it all, and the wall |
| `../dev/backrooms.js` | the level's own page |
