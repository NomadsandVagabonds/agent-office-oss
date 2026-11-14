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
you find on the way (tapes, a keycard) is only yours if you get out. In some
visits something follows you: a shop dummy for as long as you watch it from
across a room, and not safe to stand beside, watched or not.

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
| oddity | a room from the deck: one idea, a few metres across | five to eight a floor, none twice in a visit while the deck lasts |
| set piece | an oddity that says `big: true`, or has a view (`halo`) | one a floor at most |
| placed by the plan | a room that says `planned: true` and is put where the visit's plan decides. So far one: the hallway that is not sure where it leads (`rooms/unsure-hall.js`), below wherever the cardboard people were | one in most visits, two in a long one now and then, never where you land |
| from the news | a room the place has half-remembered from the headlines and staged wrongly (`headline: true`). Wordless and unnamed. **Only the owner decides which stories become rooms** | one a visit at most, in about a third of visits, never on the floor you land on |

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
| `w`, `d` | required | `[fewest, most]` whole metres: across the wall you come in by, and deep. 3 to 20 |
| `h` | | `[lowest, highest]` ceiling in metres, if not the usual one. 2.3 to 9 |
| `ports` | required | which of `back`, `left`, `right` may be given one more doorway, in the middle of the wall, so that the room can lie on a path. `[]` makes it a dead end. Never `front`: that is the way in |
| `weight` | required | how often it is dealt. 1 is ordinary; 3 at most |
| `lights` | required | what the ceiling does: `normal` (as the floor's theme has it), `dim` (about half the tubes out), `entry` (lit only near the door you came in by), `one` (a single tube), `dark` (none: the room lights itself) |
| `roll(R, o)` | required | everything the room decides from the seed, returned as plain data (numbers, strings, lists). `R` is the seeded source: `R()`, `R.range(a, b)`, `R.int(a, b)`, `R.pick(list)`, `R.some(list, n)`, `R.shuffle(list)`, `R.chance(p)`, `R.weighted(list, weightOf)`. `o` is the office: `o.name` (the visitor), `o.projects`, `o.agents`, `o.tasks`, any of which may be nearly empty. The builder reads the result as `c.params` |
| `module` | required for a new room | `'./rooms/<id>.js'`. Fetched the first time a floor has the room on it |
| `stash(r, side)` | required | where a tape may be hidden: `[x0, z0, x1, z1]` (or a list of them) in the room's own frame, strictly inside its walls. `r` is the room as generated (`r.W`, `r.D`, `r.params`), `side` is −1 or 1 for rooms that have a left and a right. Your builder leaves that patch of floor clear |
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
`../gen.js`, …), the voxel kit (`../../vox/`) and the office's props
(`../../props/`). Nothing else, nothing from the network, and it keeps nothing
in the browser's storage. A test reads the file to see. A room too big for one
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
  that roams between rooms is not open yet (the thing that follows you is
  `pursuer.js`, and a shared way of walking the floor comes with the next
  creatures).
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

## The level on a page of its own

To show somebody the level without an office to run it in:

```
node tools/backrooms-sample/stage.mjs <folder>
```

copies the level's own page (`tools/backrooms-sample/index.html`: one screen,
nothing on it but the level) and every module it needs into one folder that
anything can serve. It follows the imports, and includes every room that lives
in a file of its own. three.js comes from a CDN there, at the vendored
version. The first tape on that page is always seed 7; after that, a different
building every time.

## Where things are

| file | what is in it |
|---|---|
| `index.js` | the conductor: plans the visit, builds each part (the one below, ahead of time, hung under the way down), hands you from one to the next mid-fall, runs the frame, ends it |
| `seam.js` | the ways down and where the next part hangs (pure): `WAYS`, `GAP`, `dropOf`, `hangBelow` |
| `plan.js` | a visit from its seed: how many floors, which kind each is and how it ends, what is hidden where, what each floor may take for granted |
| `gen.js` | the generator and the first deck. Pure: no three.js, no DOM. `frame.js` is its geometry |
| `deck2.js` | the deck, continued: where new rooms' lines go |
| `rooms/` | one file to a room, for every room written since the first deck |
| `rooms.js` … `rooms4.js` | the first deck's builders, and the plain room |
| `world.js` | builds a generated floor: the toolbox (`roomContext`), collision, the doorway check |
| `kit.js` | meshes, baked light, textures |
| `themes.js` | what each kind of floor is like |
| `stairwell.js` (also the hole, the ledge and the chute), `thin.js`, `marks.js`, `leaving.js` | the way down, and the taped door at the bottom of the last of it; the wall that gives and the walls that knock back; where the marks go, and the rule for leaning (`lean`, `answer`); what the camcorder sees as you leave |
| `traces.js` | what earlier visitors left |
| `loot.js` | tapes and the keycard: where they hide, what is kept |
| `pursuer.js`, `reach.js` | what follows you, and the rule for being within arm's reach of it (pure: the tape tears, and it moves in the torn frames) |
| `player.js`, `input.js`, `hud.js`, `vhs.js`, `sound.js` | walking, keys and touch, the camcorder, the tape, the hum |
| `../levels/basement.js` | the floor above it all, and the wall |
| `../dev/backrooms.js` | the level's own page |
