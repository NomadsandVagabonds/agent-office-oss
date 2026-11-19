# BlockRooms previews

Previews on the dev page only (`&preview=`, comma list). Nothing in the game reads them.

## Clipping

The owner, from reference pictures: "assets clipping through walls … a design space we haven't done yet." Empty,
uniform rooms, each different by one small wrong thing: an ordinary object half inside the structure. Emptiness plus
one wrong thing, not office furniture. These are our own versions of the idea.

**Status: a preview.** Only with `&preview=clip` on the dev page. Without it the three rooms build exactly as before
(below), and nothing in the game passes the flag.

### What was built

- `public/world/backrooms/clipping.js`: `clip(c, what, x, z, opt)` puts an ordinary thing down (a catalogue type as
  `c.prop` takes, or any meshed voxel model) with part of it inside a wall, the floor or the ceiling.
  - **The cut** is made on the geometry once, at build time: every triangle is clipped against the room's shell (its
    four walls, floor and ceiling, each 1 cm behind its face), and against any planes the room adds (`cut`), with
    every vertex attribute carried along the cut edge. The shell's walls are one sheet each and rooms stand 20 cm
    apart, so nothing reaches the next room or the void. Nothing is done per frame.
  - What is left goes into the room's voxel batch through `c.place`, so it is baked and lit as everything else, on the
    half-voxel grid (positions snapped to 1.25 cm), with a contact blot on the carpet or on the ceiling tiles.
  - **Solid** only where it stands in open space at a body's height (as `c.place` decides), and never where it would
    meet the lane in front of a doorway (its width and 35 cm either side, 1.3 m in). Never `keep`, so the level's own
    no-trap check could still drop it. Never furniture: it cannot be dragged.
  - It reads no seeded stream: every choice is fixed, or taken from what the room already rolled.
- `world.js`: `c.propModel(type, o)`, what `c.prop` would put down without putting it down (six lines).
- `index.js`: `env.preview`, a Set from the dev page's `opt.dev.preview`; empty otherwise (two lines).
- `dev/backrooms.js`: `&preview=clip` → `opt.dev.preview` (two lines, and its line in the head of the file).

### The three rooms

Chosen from the first-floor audit's bottom five ("plain office"); their code confirms the play is thin: an empty room
with a phone that rings, a room whose doorway faces a blank wall, a dead end whose desk is out of view.

| room | the wrong thing |
|---|---|
| phone | the desk the phone was on has gone down into the carpet to its top, square to the room; its chair is down to the seat behind it. The phone sits on the desk top, its cord running off it. Walked over: nothing of it is solid but the chair's back |
| nested | an office chair coming out of the meeting room's blank wall at an angle, its back inside: the wall the way in looks at, or the right-hand one where the way in looks at its door. Cut at the middle of that wall, so nothing of it is in the meeting room. Its seat, in the corridor, is solid |
| cover | a filing cabinet coming down out of the ceiling upside down in front of the shutter, drawers to the room, the box that was on top of it hanging under it. Moved back a tile at a time from any ceiling light. Above anybody's head: not solid |

### Try it

```
/world/dev/backrooms.html?seed=7&room=phone&preview=clip&pursuer=0&mute=1
/world/dev/backrooms.html?seed=3&room=nested&preview=clip&pursuer=0&mute=1
/world/dev/backrooms.html?seed=7&room=cover&preview=clip&pursuer=0&mute=1
```

Drop `&preview=clip` for today's room. Pictures, each from the doorway, inside and close, at Classic and Medium, and
today from the doorway: `docs/previews/clip-<room>-<door|inside|close|today>-<classic|medium>.jpg`.

### Proof

- `test/backrooms-clipping.test.mjs`: the cut leaves nothing outside its planes; a chair through a wall, a desk in the
  floor and a cabinet out of the ceiling and a wall leave no vertex outside the room; solid only in open space and
  never in a doorway lane; on eight seeds with the three rooms dealt, every doorway is still reached, nothing had to
  stop being solid, and no cell reachable before is lost except next to the thing itself; without the flag (or with
  an empty one, or another preview's) the rooms hash the same as today's and have nothing clipped; the room's seeded
  stream is at the same place after building whether the preview is on or not.
- A whole-floor comparison (every room's geometry, baked light, light maps and lamps, Classic and Medium, lighting off
  and dim) on yellow seeds 7 and 21, whole and with the three rooms dealt: the same to the byte as before this change
  without the flag.

### Not done

- Looked at only from the three views in the pictures, at Classic and Medium; Low and High, `vhs=2`, and a phone, not.
- No stash change: on a visit with loot, a coin could land on the sunk desk's top in phone.
- Other objects the references suggest (a door flat in the floor, a sign out of the floor, a light fitting low on a
  wall, words on a wall) are not placed; `clip` takes any of them.

## Corner doors

A preview on the dev page, not in anybody's visit: doorways moved into the corners of rooms. The opening runs to the
end of its wall, so the side wall carries straight on into the room next door and you look into that room at a slant.
Where two of a room's doorways go to the same corner, the corner opens two ways: two half-openings on the two walls
that meet there, with only the post where the neighbours' own walls meet left standing.

Walk it:

- `/world/dev/backrooms.html?seed=7&preview=corners&room=4&x=1.6&z=0&yaw=1.5708&pursuer=0&mute=1`: the dev page's
  own seed. Room 4 has all three of its doorways in corners. From there, the far right corner opens two ways (into the
  room you land in, and into the one beside it), and the far left corner has the third. Turn round slowly.
- `/world/dev/backrooms.html?seed=7&preview=corners&room=4&x=1.2&z=1.2&yaw=0.785&pursuer=0&mute=1`: the same room,
  looking straight into the corner that opens two ways.
- `/world/dev/backrooms.html?seed=2&preview=corners&room=9&x=-2.5&z=3.5&yaw=-0.64&pursuer=0&mute=1`: a big room
  with a corner that opens two ways, seen from the far side.

Add `&graphics=medium` (or `classic`) to choose a tier, and `&preview=corners,hallways` for both previews at once.

**How it works** (`public/world/backrooms/preview.js`, `cornerDoors`). The dev page passes `preview` to the visit
(`dev.preview`). In `index.js`, `build()` changes the generated floor before it is built, and only when
`opt.debug && opt.dev?.preview` is set. `generate()`, `plan.js` and `world.js` are untouched, and none of them imports
the preview, so the default build and `plan.js` `edition()` cannot move. For every link between two plain rooms
(or the landing) at the same height, the preview finds the stretch of the dividing line that both rooms' insides
reach. It then tries the doorway at each end of that stretch. It tries first the end where both rooms' walls stop
together (a corner of both), then the corner another doorway of the room has already gone to, then the nearer end. The
doorway keeps its width, height and kind; only `link.from/to` and each room's `door.c` change. The move is kept only
if the new place passes every check the old one did:

- clear of the room's other doorways and windows by 30 cm, and of the thin wall and anybody's marks;
- a metre of level, pillar-free floor in front of it (the zone `quiet.js` `fits` keeps);
- no lower ceiling over it than before;
- `quiet.js` `fits(room)`: every doorway of both rooms still reached from every other.

What it leaves alone: doors with a leaf (`link.door`); doorways `doors.js` would hang a pair of leaves in (one leaf,
standing open, would be inside the side wall); crawl holes, slits, doorways up stairs, the mascot's room, and rooms
with a coin in them. It draws on nothing seeded and uses no `Math.random`. Over the first floors of seeds 1–80 it
moves about a quarter of all doorways (694 of 2704), close to half of them (320) into a corner of both rooms, and
gives about one room in fourteen (183 of 2590) two or more doorways in corners.

**Nothing to get stuck in.** The walls need no change. A room's collision is its rectangle and the doorway's throat
(`world.js` `inThroat`). A doorway flush with a corner puts the throat's edge exactly on the room's side wall, so a
body is never let into the thickness of the wall beside it. `test/backrooms-preview-corners.test.mjs` floods every
spot a body fits within 1.5 m of each moved doorway's corner end, on three built floors, and finds nothing that can be
stood on but not walked to.

**What it looks like** (`docs/previews/corner-*.jpg`, Classic unless named):

| picture | what |
|---|---|
| `corner-two-corners.jpg` / `corner-two-corners-today.jpg` | seed 7 room 4, looking at both far corners: now / as it is today |
| `corner-inside.jpg` / `corner-today.jpg` | straight into the corner that opens two ways: now / today |
| `corner-inside-2.jpg` | the other far corner: the doorway runs into the corner, the wall beside it goes on into the next room |
| `corner-doorway.jpg` | from beside the corner doorway, looking through it at a slant into the room you land in |
| `corner-medium.jpg` / `corner-today-medium.jpg` | the corner that opens two ways at Medium: now / today |

Verdict: it reads right, but quietly. Most doorways were already only 40 cm from a corner (gen.js keeps them half a
metre from the cell's corner), so a corner doorway is a 40 cm stub of wall gone. That is the kind of wrong that is
noticed late, which suits the place. The corner that opens two ways is the strong version: a bare post where two walls
should meet. To lose the post as well, so that you see diagonally into the third room, needs four rooms meeting at
one point and all open to each other. That is a change to how floors are laid out (gen.js `attach`), not to where
doorways go, so it is not in this preview.

**At Medium.** Tube shadows and doorway light still bake. One fault: where a corner doorway's jamb carries on as the
next room's wall, the light through the doorway lands on that wall at a grazing angle. Its edge there is stair-stepped
at the light map's texel size, a visible zigzag up the post (`corner-medium.jpg`, left of the right-hand opening). The
floor's own stepped bands at doorways are there today too (`corner-today-medium.jpg`). The fix belongs in the doorway
bake (`shadowmap.js` `bakeDoorway`: skip or soften faces coplanar with a jamb), not here.

## Hallways that are not rectangles

A preview on the dev page, not in anybody's visit: some of a floor's corridors get walls that are not a rectangle,
inside the rectangle the floor's route is still worked out on. There are four kinds:

- **taper**: the two walls are not parallel. The corridor closes toward the end away from the way in, down to the
  width of the doorway there, or 0.9 m.
- **dogleg**: halfway along, the corridor steps sideways by about half its width, with a short slanting jog. Neither
  half lines up with the other.
- **skew**: one wall 3–6° off true, against the room's wall at one end and in from it at the other. The ceiling grid
  stays square to the room, so its seams run at a slant to that wall and never meet it at a right angle.
- **dead end** (a corridor with one doorway): one wall skewed, the room's lights cut to the one panel nearest the
  end, and two ordinary grey chairs side by side at the end, facing the blank wall.

Walk it:

- `/world/dev/backrooms.html?seed=32&preview=hallways&room=8&x=-3&z=-0.2&yaw=-1.5708&pursuer=0&mute=1`: the dogleg.
- `/world/dev/backrooms.html?seed=1&preview=hallways&room=11&x=-2.6&z=0&yaw=-1.5708&pursuer=0&mute=1`: the taper (the
  same floor's room 2 is a skew: `room=2&x=-3.1&z=0.2`).
- `/world/dev/backrooms.html?seed=57&preview=hallways&room=32&x=-0.6&z=1.6&yaw=0&pursuer=0&mute=1`: the dead end with
  the chairs.

**How it works** (`preview.js` `shapeHallways`, `hallShape`, and the builder `hallway`). The floor is changed after it
is generated, behind the same flag as the corner doors. A corridor that will take a shape is:

- plain, less than 4 m wide, and at least 3.6 m long;
- empty of the floor's own things: no shape, pillars, partitions, windows, things left about, thin wall, mascot, coin,
  vending machine, or leaves hung in its doorways;
- at most three doorways, all at floor level.

Floors furnished by the floor itself (pool, lawn, concourse, trail) are left alone. Two-doorway corridors take the
next of taper, dogleg and skew, in an order hashed from the floor's seed. A corridor that will not take one kind
tries the next. Each wall is a polyline in the corridor's own (across, along) frame, and every doorway must keep its
opening: one on an end wall has both walls outside it, and one in a side wall has that wall against the room's own
for its width and 15 cm either side. Doorways into plain rooms are narrowed to a metre about their middle, where that
gives the shapes room. A doorway is narrowed only if `doors.js` would still hang leaves in exactly the doorways it
did, so which doorways have leaves is dealt as before.

The builder runs the plain builder with no sockets (they would be hung on walls that are now behind the new ones),
then draws each piece of new wall the way the shell draws a pinched waist: papered, skirted, cut into 30 cm columns
for the bake. It also sets `rt.clip` to the same polylines, so what stops you is exactly what is drawn. Panels not
wholly between the walls are left out. A corridor left with none gets one on its middle line, on the ceiling's grid,
turned to lie along the corridor where it is too narrow for one lying across it (`c.fitting`).

**Proven** (`test/backrooms-preview-hallways.test.mjs`):

- **Flag off.** The level is untouched, and `gen.js`, `plan.js`, `frame.js` and `world.js` do not reach the preview.
- **Flag on, first floors of 60 seeds.**
  - Every shaped corridor is walked from its first doorway to all the others by a body of the visitor's radius (0.22 m,
    `player.js`) on the level's 12.5 cm grid.
  - The narrowest point, measured at right angles between the walls, is never under 0.9 m (four radii).
  - Every doorway is open across its whole width.
  - The rooms next door still pass `quiet.js` `fits`.
  - Doorways of rooms not next to a shaped corridor are exactly where they were, and so are the door leaves.
- **Built (three floors).**
  - The no-trap check raises nothing.
  - Every wall vertex the room drew inside its rectangle lies on one of the polylines and faces into the corridor.
  - At the middle of every wall drawn, a body stops one radius off it and cannot stand behind it.
  - Every room not touched is built bit for bit as without the preview.

**What it looks like** (`docs/previews/hall-*.jpg`, Classic unless named):

| picture | what |
|---|---|
| `hall-dogleg-in.jpg` / `hall-dogleg-today.jpg` | the dogleg from its end doorway: now / today |
| `hall-dogleg-back.jpg` | looking back from the far half, a dark room through the side doorway |
| `hall-dogleg-medium.jpg` / `hall-dogleg-today-medium.jpg` | the same at Medium: now / today |
| `hall-taper-in.jpg` / `hall-taper-today.jpg` | the taper from the wide end: now / today |
| `hall-taper-back.jpg`, `hall-taper-medium.jpg` | from the narrow end looking back; the wide end at Medium |
| `hall-skew-in.jpg`, `hall-skew-back.jpg`, `hall-skew-medium.jpg` | the skew, both ways, and at Medium |
| `hall-deadend-in.jpg`, `hall-deadend-chairs.jpg`, `hall-deadend-medium.jpg` | the dead end from the doorway, the chairs, at Medium |

Verdict:

- **The dead end** is the best of them: one lit panel, two chairs facing a wall, nothing else. It is wrong in exactly
  the right way.
- **The dogleg** reads at once and looks built on purpose, which is the unsettling part.
- **The taper** is clear from the wide end, but mild when side doorways keep its walls straight for half its length.
- **The skew** at 6° mostly reads as perspective. It shows best looking up, where the ceiling seams drift off the
  wall. Any more and it would look like a mistake in the drawing rather than in the building.

How often: over the first floors of seeds 1–80, 40 corridors take a shape (20 skew, 12 taper, 6 dead ends, 2 doglegs).
The dogleg is rare because most corridors have a doorway in a side wall, which pins that wall flat for half the
corridor.

**At Medium.** The new walls are not on the rectangle's planes, so they are outside the room's light map
(`shadowmap.js` `regionOf`). They are lit as the pinched waist and furniture are, by the room's lamps only, with no
tube shadows and no doorway light on them. Where a straight stretch of the room's own wall meets an angled one, the
doorway light on the straight part stops at the joint with a stepped edge (`hall-taper-medium.jpg`, left wall). The
floor behind the new walls still takes doorway light, out of sight, and the doorway light on the floor inside
ignores the new walls: in a dogleg the jog casts no shadow from a doorway's light. The tube shadows are right, since
no lamp is ever behind a new wall. Fixing this means giving the bake the angled walls as faces and occluders
(`world.js` / `shadowmap.js`), which is beyond a preview.


## Floor lights

The owner: "what about one level where the florecent lights are on the floor facing up?" The lead's spec: fluorescent
panels set into the floor shining up, the ceiling dark, shadows thrown upward, so that faces and things are lit from
below.

**Status: a preview.** Only with `&preview=floorlight` on the dev page, in two rooms that are plain in both play and
look (docs/BLOCKROOMS-FIRST-FLOOR.md): **party** and **museum**. Without it both build exactly as before (below), and
nothing in the game passes the flag. It can be asked for with the other one: `&preview=clip,floorlight`.

### What was built

- `world.js`: `c.fitting(x, z, { mount: 'floor' })`. The fitting is let into the floor instead of hung from the
  ceiling: its flat form 4 mm over the carpet, the same corners wound the other way so it faces up, at every tier
  (there is no sculpted fitting for a floor: at Medium and High it stays the flat panel); its baked lamp 12 cm over it
  with the lobe turned up (`axis: [0, 1, 0]`). Everything else (power, colour, flicker, dead, banks, `light`) is as
  `c.fitting` always had it, for any `kind`. The ceiling path is the same code with the same numbers.
- `world.js`: `rt.uplit`, set by a room lit from its floor. A body there (the cast, the visitor's hands, a cut-out,
  anything tinted by `world.lightAt` or `c.sample` without a normal) is tinted by what reaches its underside, not its
  top; otherwise it would be nearly black. And `c.blot(…, { wall: side })`: a soft stain on a wall (it had the floor
  and the ceiling).
- `floorlight.js`: `uplit(c)` → null without the flag; else what the room needs to light itself from the floor:
  - `shell`: the shell without its panels (the ceiling sheet whole), the ceiling tiles' albedo at 0.2, the wallpaper's
    at 0.7 (a little darker, so the light low on it and a face against it read).
  - `panels(avoid)`: each of the room's own ceiling panels (what gen.js rolled: lit, dead, flickering) let into the
    floor under where it hung, or the nearest place half a tile at a time across or along where it misses `avoid`
    and the other panels, on flat floor, off the stairs of a raised doorway. Each in a steel frame a centimetre proud.
  - Each panel's lamp is brighter than a ceiling panel's (×3.4) but falls off much sooner (k 0.12 against 3.4) and is
    nearly as bright sideways as up (lobe floor 0.8): the walls are lit low down by the panels near them and go dark
    towards a dark ceiling, with a pale pool over each panel. The room's ambient light is at 8 %, the light spilling in
    from a brighter room next door at half.
  - `spot(x, z, o)`: a small uplight (a `can`, let into the floor) for one thing.
  - **Shadows thrown up.** The bake has no shadows at Classic and Low, and the light map at Medium and High covers only
    the floor and walls. So, once, at build time: each thing the room says stands in it (`stands(box)`), seen from each
    lit panel within 2.4 m, is pushed onto the ceiling (its top, by similar triangles) and, where there is no light
    map, its upper part onto the wall behind it, as soft blots, darker the nearer the panel and fainter the bigger the
    shadow. At Medium and High the light map throws the walls' shadows itself, from the panels' real lamps.
  - It reads no seeded stream: where the panels go is where the ceiling's were, everything else is a fixed choice.
- **The camcorder.** The room's `level` is left as it was, so the camera's gain and its little lamp behave as in a lit
  room: the lamp stays off (it would light every face from the front and undo the look), the gain stays near 1, and
  the room is darker than today's by what it lost overhead. Nothing is blown out at Classic; at Medium and High the
  glow (glow.js) blooms the panels in the floor as it did the ones in the ceiling.

### The two rooms

| room | under the flag |
|---|---|
| party | the tubes in the floor, under the table among them, so the table's underside and the chairs' fronts are lit and its top is dark; the balloons on a dark ceiling. And one more guest, who came early: a shop's dummy (the dummies' own model, cast/dummies.model.js), baked with the room, stood over a panel of its own at the end of the banner (or the end of the table: the first of four places that is clear), facing the cake, lit from under its chin, its shadow up the wall behind it and onto the ceiling. Solid; it does not move |
| museum | each exhibit's light comes up at it from a can in the floor inside its rope, in front, instead of down from 2.25 m; the room's panels in the aisles between the roped squares. Plinths, labels and posts lit from below, the wing's sign over them in the dark |

### Try it

```
/world/dev/backrooms.html?seed=7&room=party&preview=floorlight&pursuer=0&mute=1
/world/dev/backrooms.html?seed=7&room=party&preview=floorlight&pursuer=0&mute=1&x=1.8&z=-2&yaw=-0.2&pitch=0.12
/world/dev/backrooms.html?seed=7&room=museum&preview=floorlight&pursuer=0&mute=1
/world/dev/backrooms.html?seed=7&room=party&preview=floorlight&pursuer=0&mute=1&graphics=high
```

Drop `&preview=floorlight` for today's room. Pictures in `docs/previews/`: `floorlight-<room>-door-<classic|high|low>`
(the room from where you come in), `floorlight-party-guest-<classic|high>` (the dummy, lit from below),
`floorlight-museum-close-<classic|high>`, and `floorlight-<room>-door-today` (no flag) to compare.

### Proof

- `test/backrooms-floorlight.test.mjs`: a floor fitting is one quad at the carpet facing up, 0.6 × 1.2 m, with its lamp
  just over it shining up, at Classic and at Medium (no sculpted fitting), and otherwise the same lamp as the ceiling
  one; over a floor panel a downward face is lit many times more than an upward one; the shadow projection by similar
  triangles, and nothing when the thing is not between; on six seeds with both rooms dealt, at Classic and Medium,
  nothing shines down from the ceiling, both are lit from the floor within the 16-light budget, the ambient is down,
  the room's level (the camcorder's) is unchanged, a body in the room is lit, the underside of a thing over a panel is
  lit and its top is not, every doorway is still reached; no two panels overlap, none lands on a roped square, and
  something throws its shadow up in each; without the flag (or with an empty one, or `clip`) the rooms hash the same
  as today's and are not `uplit`; the rooms' seeded streams are where they were, flag or not; the preview code rolls
  nothing.
- A whole-floor comparison against the commit before this change, without the flag: 16 seeds (7, 21, 3, 11, 40, q, zz,
  102, 1, 2, 5, 9, 13, 77, abc, 999), each whole and with party, museum and kanban dealt, each at Classic and at Medium
  (contact, bounce, shadows, door light, fixtures): every room's meshes (every vertex attribute and index), colliders,
  lamps, ambient, level, light maps and shadow boxes, and the build's warnings: 1,818 rooms, the same to the byte.

### Not done, and what looked wrong

- Only party and museum, seed 7 looked at closely; Medium only through the tests, `vhs=0/1`, a phone, not.
- The cast keep their own shading: each creature's model is baked once against its own studio lamps overhead, then
  tinted by the room. Here the tint is what reaches its underside, so it is not left in the dark, but its face is
  still lit from above. Lighting the cast from below would mean baking each one's model a second time with those lamps
  turned under it (one line in each of about fifteen cast files), not done.
- The dummy has no face (it is the shop's dummy); what lights from below is its brow, nose and chin, and the steps of
  its head go dark on top. It reads best from a few metres; close to, it is coarse.
- The walls: the gradient (bright low near a panel, dark under the ceiling) is there in the bake, three to one, but the
  tape and the picture's curve flatten it to about one and a half to one on screen; on the party's yellow paper it is
  subtle. The ceiling is the strongest tell: about a third as bright as today's.
- The shadows thrown up at Classic are blots of a thing's box, not its shape: soft rectangles. Dragged furniture leaves
  its blot where it was.
- The museum loses some of its ceiling panels to the roped squares (seed 7: three of five lit ones find a place),
  which the exhibits' cans make up; the left of the room is darker than the right.
- With loot, a coin could land under the dummy (the party's stash is behind the table, under the banner).

### Recommendation: a whole floor, not a room

One room lit from the floor between ordinary ones reads as a dim room with odd lights; the look is the inversion, and
an inversion needs a whole floor of it to become the rule, so that the visitor stops expecting a ceiling to light
anything. **Sketch, not built:** a kind of floor in `themes.js` (say *Underlit*), dealt deep, where `c.shell` reads the
theme and puts every plain room's panels in the carpet through `c.fitting`'s `mount: 'floor'` with the dark ceiling,
and the corridors' too, so that the floor's own plain rooms need no code of their own; the oddities keep theirs or say
`uplit` and take `floorlight.js` as party and museum do. Its grade a little warmer and lower in the highlights, the
haze from below; the camcorder's level as a lit floor's, so its lamp never comes on. The cast dealt there baked once
more with their studio lamps under them (the one real cost). Its own few rooms: a corridor where a run of panels is
out and the next is lit, so you walk from pool to pool; a meeting room where the table is a light box and the chairs
face it; the dummies' kind of floor (themes.js `mall`) is the nearest relation, and the dummies would stand over the
panels.

## Carpet Allowance

The owner (art direction, `docs/art-direction/yellow-office/README.md` in 0fff96d, "Carpet Allowance", and the render
`docs/reference/blockrooms/render-carpet-mound.webp`): a wall-to-wall carpet cut several metres too long, the excess
risen in one great pleat with exposed backing and an opening tall enough to duck into. Two routes: the short blind one
under the fold, or round its edge. A normal stapler at the entrance for scale; three bright snags at the skirting where
the carpet pulled free of the wall.

**Status: a preview, and a new room.** Its id is `carpet-mound`. Its line is in `MORE_DECK` with `on: false`, so it is
out of the deck as a retired room is. Only `&preview=mound` on the dev page puts it in the deck, for that page
(`preview-deck.js`), and `&room=carpet-mound` then deals it where you land.
Without the flag the deck, `edition()`, the plan and every floor are exactly as before (below).

### What was built

- `rooms/carpet-mound.js`, the builder; `rooms/carpet-mound/layout.js`, pure: where everything is, the fold's shape, and
  its deck line `CARPET_MOUND` (w 8–10, d 10–12, ports left/right/back, weight 1, lights normal, a stash in the far corner
  of the walk round). To deal it like any other room later: drop `on: false` from its line at the end of `MORE_DECK`
  (`deck2.js`) and its line in `preview-deck.js`. Nothing else changes.
- **The fold** runs down the room's length, to one side (`side`, rolled), so that from the doorway you look into its mouth
  at a slant and the walk round is on the open side (2.4 m or more; 1.2 m on its own side). Its profile is a broad
  sagging crown, steep flanks and a flare at the foot: 1.62 m at the top, 3.8 m across, the crown sagging a few cm
  halfway along. Two smooth sheets of the carpet's own texture (outside, and the backing underneath, 10 cm apart square
  to the sheet), each vertex with its real normal, so the flanks turn from the tubes; the worn runner stripe the carpet
  was laid with runs over it and on across the flat carpet to both walls.
- **The cut edges** are the sheet's section in 5 cm voxel cubes of tan backing, chequered in two tans, each one or two
  steps proud of the cut: the outline steps, and a loose cube or two lie on the floor in front.
- **Under it** the floor is bare screed where the carpet came up, darker the further in (baked into its vertex shade,
  since Classic has no shadows), with a ragged tan lip where the floor's carpet tore. You can stand up under the crown
  (1.5 m: the visitor's eye is 1.1); towards its sides `rt.headY` lowers the headroom and the automatic duck takes you
  under. Solid (two tall colliders) only where the gap is lower than 0.7 m, out to the foot: what stops you is the
  sheet. The floor stays flat, so nothing snags the visitor or the cast.
- The stapler (beige, a little scuffed, a pale skid behind it), three snags of cream thread at the skirting with a dark
  line where the carpet came off its gripper, soft blots along the fold's feet and at its mouths, a stain on the tiles.
- It reads nothing seeded but its roll and what the shell reads (its sockets). Shared files: `deck2.js` (+4 lines: an
  import and the line), `dev/backrooms.js` (+3 lines), and the new `preview-deck.js`, which takes the line from
  `MORE_DECK` for any `&preview=` flag that names a room waiting there.

### Try it

```
/world/dev/backrooms.html?seed=7&room=carpet-mound&preview=mound&pursuer=0&mute=1&x=2.4&z=4.6&yaw=0.55&pitch=-0.05
/world/dev/backrooms.html?seed=7&room=carpet-mound&preview=mound&pursuer=0&mute=1&x=-1.8&z=3&yaw=0
/world/dev/backrooms.html?seed=7&room=carpet-mound&preview=mound&pursuer=0&mute=1&x=2.2&z=-4.3&yaw=2.6
```

Add `&graphics=high` for High. Pictures in `docs/previews/`: `carpet-mound-door-classic` (from beside the way in, as the
render), `carpet-mound-under-classic` (the blind route, looking through), `carpet-mound-round-classic` (from the walk
round, back towards the way in), `carpet-mound-door-high`.

### Proof

- `test/backrooms-carpet-mound.test.mjs`: without the flag the room is in no deck, floor or visit (and the plan is dealt
  as before); its deck line has no special weighting; the gap is tall enough to stand under the crown and wider than a
  body where a body gets through, the sheet keeps its thickness, the cut edge is on the voxel step; on six seeds at
  Classic and Medium every doorway is reached, the way under is reached from mouth to mouth, no body can stand inside
  the carpet, under its sides the visitor ducks, the walk round is clear its whole length, the light budget holds; built
  twice it is the same to the byte; nothing in the game imports the preview.
- A whole-floor comparison against fcf4338 (its `public/` and `core/` exported with `git archive`), without the flag: 16
  seeds (7, 21, 3, 11, 40, q, zz, 102, 1, 2, 5, 9, 13, 77, abc, 999), each at Classic and at Medium (contact, bounce,
  shadows, door light, fixtures): every room's meshes (every attribute and index), colliders, lamps, ambient, level and
  light map, the deck, and `edition()`: the same to the byte.

### What our lighting can't reach

The render's fold sits in the room because of light we do not have. Its underside and the floor beneath go dark by
occlusion, deepest in the middle and softest at the mouths, and the floor round its feet takes a broad soft contact
shadow; the flank away from the tubes is darker than the near one by bounce and occlusion, and the crown is lit by the
whole ceiling, not by one lamp. Here, at Classic, that darkness is painted: the underside and the screed carry a baked
"how far in" shade, the feet a blot. It reads (the gap is dark, the far mouth bright), but the outside of the fold is lit
as evenly as the floor, and the cut edge's cubes have no shadow between them. At Medium and High the tube shadows would
help most, but the fold is not in the light map: its pieces are not boxes standing on the floor, which is what
`shadowmap.js` takes as occluders, so the floor beside it is lit as if it were not there. Giving the bake the fold's
flanks as a few occluder columns is a CPU change (world.js / shadowmap.js), not a renderer one.

**WebGPU** (`claude/steam-webgpu`, phase 1 behind `?gpu=webgpu`): no, not by itself. Phase 1 is a port: the room surface,
the voxel material and the camcorder at Classic, the same baked look on node materials, and Medium's light maps since.
The things that would close the gap (screen-space AO under and round the fold, more shadow casters, soft contact) are
the Ultra tier, R-3, which that plan writes on top of the port, once, in TSL. That is where this room would get there.

### Not done, and what looked wrong

- Seed 7 looked at closely (fold to the left); the other side is covered by the tests only. Low, Medium, `vhs`, a phone:
  not looked at.
- From the doorway the stapler is small (it is a normal stapler at the chibi scale): it sells the scale close to, less so
  from where the render stands, whose camera is higher than our eye.
- The cut edge is coarser than the render's (5 cm cubes against its finer ones) and only at the two mouths; the long
  edges of the fold flare into the carpet without a seam.
- The cast walk under it as the visitor does, but nothing ducks them: a tall one's head goes through the backing.
- With loot, a coin could land in the stash corner only; nothing of the room is in the way of it.

## Interoffice Mail

The owner's brief (docs/art-direction/yellow-office, "Interoffice Mail", in commit 0fff96d, and the render
`render-in-tray.webp` in a9c60eb): a normal desk letter tray in front of three room-sized smoked-amber trays, each with
its own strip-lit office and an ordinary brown door. Enter on the middle tray, round the back of its short sidewall,
go down to the lower tray to leave. Keep a sightline back to the miniature on the desk. Two trays playable, the third
dressed as a visible upper office.

**Status: a preview.** A new room, `in-tray` (`rooms/in-tray.js`, its plan in `rooms/in-tray/layout.js`). Its deck
entry is an ordinary one (weight 1, no themes, `ports: ['back']`), but it sits in `deck2.js` `PREVIEW_DECK`, not
`MORE_DECK`, so nothing deals it and `edition()` does not see it. Only the dev page, with `&preview=intray`, adds it to
its deck, and then at home on no floor (`themes: { '*': 0 }`): it is never dealt by chance, only where `&room=in-tray`
(or `&only=`) asks for it. To deal it like any other room, move the entry into `MORE_DECK`.

### What it is

- **The atrium.** A compact, windowless room, 13–15 m wide, 14–15 m deep, 6.9–7.2 m high. The front doorway opens onto
  the atrium floor. A carpeted stair of ten 23 cm risers goes up to a landing at 2.3 m.
- **The middle tray, the way in.** It is pulled 0.9 m forward of the others. The landing meets its thumb notch, which
  is flat at the landing's height and two metres wide. Inside is a 3.3 m office: carpet, tiles, four strip lights and
  a closed brown door. Its sidewall on the side of the way down is short. Round the back of it is a 1.2 m opening into
  the gap between the trays and the room's wall.
- **The way down.** A stair goes down that gap toward the back wall. It ends beside an opening at the back of the
  lower tray's sidewall.
- **The lower tray, the way out.** It stands on the room's floor. Its walked part is the back 3.8 m: its back wall is
  the room's back wall, and its door is the room's back doorway (doors.js hangs leaves in it as anywhere). A ribbed
  amber divider runs across it under the middle office's back wall. Beyond the divider, the rest of the lower office
  runs under the middle office to its own low notched lip. It is lit and seen, over the divider from inside and over
  the lip from the atrium, but never walked.
- **The top tray.** Only seen. Its carpet is at 4.64 m. Its office reaches the room's own ceiling and the panels the
  floor rolled for it, and has a closed door on the room's back wall. It sits half a metre over toward the gap, and
  half a metre back, as stacked trays do.
- **The trays themselves.** Ribbed amber sidewalls on the outside, tall at the back and stepping down toward the front.
  Inside each tray, against its sidewalls, the front of the tray's own smoked side, in the room's glass batch: you see
  the office's paper through it. Each tray has a notched lip, a polished rim on every stepped edge, and stacking lugs at
  the front corners.
- **The miniature.** On the landing, on the near edge of a grey metal desk, is an ordinary two-tier letter tray, its
  open end toward the walkway. The top tier holds one sheet. In the lower tier is a very small office (1:30): carpet,
  paper, tiles, two lit strips and a brown door. From the middle office, the landing and the desk are in view through
  the notch.
- **Wear.** Contact blots along every office's skirting and under the lips, landing, stairs and desk. The carpet is
  darker where everybody comes in, turns and goes out. There are water stains on two ceilings, and a scuffed patch on
  the landing where a chair was.
- **The one wrong thing** is the scale.

**Why the walked offices do not overlap.** The floor is one height at any spot: world.js `floorY` is a heightfield and
colliders are 2D. So two offices that are walked cannot lie over one another. The middle office is the lower one's
walked depth shallower, and its back wall stands over the divider. Where the plan does not raise the floor, it is the
room's own floor. What stops you is what is drawn: sidewalls, lips, the divider, the ledge's rail and the desk are
colliders. A drop or a climb of more than a stair is stopped by the floor's own height (`world.passable`, STEP 0.26).
Every step is 23 cm, for the visitor and the cast alike. Nothing is furniture and nothing moves. The only thing read
from the seeded stream is the roll: which side the way down is on.

**A floor with no back doorway.** The lower office's door is drawn shut, and the room is a dead end. You walk it up,
round, down and back the way you came. Over the 12 seeds tried in node, 8 gave the back doorway.

### Try it

```
/world/dev/backrooms.html?seed=3&room=in-tray&preview=intray&pursuer=0&mute=1&x=3.6&z=6.6&yaw=0.3&pitch=0.32
/world/dev/backrooms.html?seed=3&room=in-tray&preview=intray&pursuer=0&mute=1&x=-0.6&z=1.55&yaw=0.12&pitch=0.22
/world/dev/backrooms.html?seed=3&room=in-tray&preview=intray&pursuer=0&mute=1&x=-1.65&z=1.2&yaw=1.571&pitch=-0.8
/world/dev/backrooms.html?seed=3&room=in-tray&preview=intray&pursuer=0&mute=1&x=-1&z=-3.9&yaw=0
```

These four are the atrium from the front corner, the landing looking into the middle office, the miniature, and the
lower office's door. Add `&graphics=high` for High. Without `&preview=intray`, `&room=in-tray` is unknown to the page
and the visit is today's.

Pictures in `docs/previews/`:

| picture | what |
|---|---|
| `in-tray-atrium-classic.jpg` | the three trays from the atrium floor |
| `in-tray-landing-classic.jpg` | into the middle office from the landing |
| `in-tray-turn-classic.jpg` | the stair down the gap, from the ledge |
| `in-tray-lower-classic.jpg` | the lower office and its door, the way on |
| `in-tray-mini-classic.jpg` | the letter tray on the desk |
| `in-tray-atrium-high.jpg` | the atrium at High |

### Proof

- `test/backrooms-in-tray.test.mjs`:
  - The room is not in the deck, any plan or `edition()`, and its entry carries only the usual fields.
  - Six seeds, Classic and Medium, with the room dealt:
    - every doorway is reached from the first, and the no-trap check raises nothing;
    - the lights are within 16;
    - the landing, the middle office, the turn, the foot of the stair down, the lower office and the atrium are each
      reached, at their heights, with standing room;
    - the part of the lower office under the middle one is never stood in at floor level;
    - a body cannot stand in the short sidewall, the lower sidewall or the far one.
  - The plan, for both sides and both ends of the size range: the stairs never rise by more than a step, there is
    headroom in both offices, and the stash is on the lower office's floor.
- **Byte-identity, the default build.**
  - Method: fcf4338's `public/` and `core/` exported with `git archive`, then the same script run over both trees.
  - What it builds: 16 seeds (7, 21, 3, 11, 40, q, zz, 102, 1, 2, 5, 9, 13, 77, abc, 999). Each is built whole and with
    cover, kanban and phone dealt, at Classic and at Medium.
  - What it hashes:
    - every room's meshes (each vertex attribute and the index), colliders, lamps, ambient and level;
    - the build's warnings;
    - `planVisit(seed)` for each seed, `edition()`, and the deck's ids.
  - Result: 1,844 rooms, the same to the byte.

### What our lighting can't reach

**What the render has.** Its look is mostly its light:

- **Contact shadows.** Every lip, plate and lug sits in a soft shadow, and each office's ceiling is darker at its
  back.
- **Light through the plastic.** The smoked amber glows where the office light passes through it.
- **Bounce.** Yellow light comes off the paper onto the carpet and ceilings, and the amber picks up warm highlights
  along its stepped edges.

**What ours does.**

- **Lamps.** Ours are baked per vertex with no occlusion at Classic. Each office's strips light it well. But nothing
  shades one tray from the lamps of another, and the lower office's front is as lit as its back.
- **Contact shadows** are blots: soft rectangles along skirtings and under edges, not true occlusion.
- **The amber** is vertex colour with a fixed brighter rim. It has no translucency, apart from the inner smoked panels
  at alpha 0.42, which tint but do not glow. It has no specular highlight.
- **At Medium and High**, contact and bounce are baked against the room's own floor and walls. The trays' plates,
  carpets and ceilings are outside the light map, so they gain little. The sculpted fittings and the glow help most:
  `in-tray-atrium-high.jpg` is brighter and softer than Classic, not more shadowed.

**The WebGPU path** (claude/steam-webgpu: phase 1 live behind `?gpu=webgpu`, and phase 2 has ported Classic and
Medium's light maps and glow) re-creates today's look node for node. By itself it does not get closer. What would get
closer is its planned "Ultra" (`ao()` SSAO, more shadow casters, light shafts, written in TSL once the port is done).
Screen-space AO would give the lips, plates and stair noses their contact shadows almost for free. Real shadow casters
would let the trays shade one another. The glow through the amber still needs a translucent material of its own.

### Not done, and what looked wrong

- Only seed 3 (and 8, a green floor) looked at closely; Low and Medium only through the tests; no phone, no `vhs=0`.
- **The amber.** It reads as painted wood more than smoked plastic. Its ribs are drawn as alternating colours, and the
  rim on every column top is busier than "a few highlights".
- **The divider.** The lower office's walked part ends at a waist-high amber divider. This is the price of one floor
  height per spot. From inside the lower office, it reads as a fence across the room.
- **The landing.** It is a raised block with a stair. There is no railing at its drops: they stop you, but they do not
  look as if they would.
- **The middle tray is not the widest**, as it is in the render. On the far side, all three trays stand almost against
  the room's wall, since a gap there could not be walked into safely.
- **The miniature's office** is at the edge of what the camera resolves. From standing height it is a lit yellow slot
  with a dark door; you have to stoop to see it as a room (C, held).
- **The cast** walk the stairs by the same STEP rule, but no creature was put in the room to watch it.
- **Loot.** The stash is in the lower office's far back corner. A coin dealt by `coinFits` is not checked against the
  raised floor.

## Please Be Seated

The owner's brief (docs/art-direction/yellow-office, "Please Be Seated", on `codex/blockrooms-art-direction`): one fixed
oversized chair at the end of a long straight hall. It looks normal until you reach its front legs. Walk between them
and turn back: the legs frame an ordinary door, the seat back pushes into the fluorescent grid, and the distance you
just walked finally makes sense. Then, relayed by the lead: a wide room to come in by, a chair blocking a squeeze, and a
side recess to shove it into while being chased. The lead's words for the owner's chase image (since saved as "Passing Place", below): a far
wall that curves in to a corridor too tight to see the end of, going green with distance; an ordinary red office chair
wedged in the mouth of the squeeze; a coat-hook alcove beside it; a two-drawer filing cabinet set flush into the left
wall.

**Status: a preview, and a room not in the deck.** Its deck entry is in `preview-deck.js`, not in `DECK`. Nothing
deals it and no plan or `edition()` has it. Only the dev page's `&preview=chair` lets it into `ARCHETYPES` (and its
stash into `STASH`), so that `&room=giant-chair` can deal it as `room=` deals any room. To deal it later, move the
entry into `MORE_DECK` as it is (weight 1, `big`, w 8–9, d 26–28, h 4.4, ports `back`) and delete it from
`preview-deck.js`. `test/backrooms-rooms.test.mjs` already holds it to every deck rule.

### What was built

- `rooms/giant-chair.js`: the room. Two beats in one room, in the order you meet them:
  - **The chase.** You come in through the front into an ordinary wide room under a 2.6 m grid. Its far wall steps in
    from both sides, three wall columns a side, each deeper than the last, to one squeeze 1.4 m wide and 1.2 m deep.
    An ordinary red office chair stands in the squeeze's mouth. It is the catalogue's `chair`, so it can be carried
    (E) and the pirate can brace against it and shove it. With it there, there is a 0.6 m sidle past it. Just beside
    the squeeze, behind a short divider, is a recess 0.9 × 0.75 m with a coat rail, three empty hooks and a shelf over them, and the chair fits in it. Carry the
    chair in and the squeeze is clear to run through. A three-drawer filing cabinet is let into the left wall with
    `clip` (clipping.js). It sits flush, 10 cm proud, and is sunk one drawer into the floor, so it reads as two drawers.
  - **The reveal.** Beyond the squeeze is a straight hall 2.4 m wide and about 10 m long, under its own 2.6 m ceiling.
    The panel nearest the end is out, one flickers, and the far two have a greener tube. At the end is a dark-brown
    doorway: two posts and a beam, and dark beyond. The posts are the rear legs of one chair (oxblood vinyl, wood, square
    and stepped) and the beam is its stretcher, at 1.95 m. Walk under the seat, 2.3 m up and 3 m deep, out between the
    front legs into a chamber with a 4.4 m ceiling, and turn back. The seat is over your head, the arms are at 3.9 m,
    and the back rises to 6 m through a neat rectangle cut out of the tile grid (4.2 × 2.4 m) into a lit gap 2.4 m
    high. Through the legs is the hall you came down. If the floor gave the room a back doorway (14 seeds in 20), there
    is an ordinary doorway in the far wall, and from the hall the two pairs of legs frame it.
  - **Tuned at standing eye height** (`player.js` EYE, 1.1 m). From anywhere more than a metre short of the hall's end,
    the hall's ceiling, the wall over its mouth, the seat, the cushion and a rail at the foot of the back hide the arms,
    the back, the hole and the cushion's top. The test casts every ray. From the door, all you see is the small red chair
    in the squeeze in front of a brown doorframe at the end of a long hall: the left panel of the owner's storyboard.
  - Light: 4 panels in the wide room, 3–4 in the hall, 3 in the chamber, one lamp in the gap shining down on the back
    and the seat, and the gap's walls lit by themselves, palest at the top: 11–12 lamps, plus doorway spill. The dark
    under the seat is a contact blot on the carpet, because Classic throws no shadow from above. Rolled: which hall panel
    flickers, the stains on the hall's tiles, how the vinyl is worn.
  - Solid: the walls (`c.pillar`, kept), the big chair's four legs (tall, exactly the legs drawn), the little chair
    (furniture), and a 10 cm strip of the cabinet. Nothing is used and nothing hurts. The big chair is architecture: it
    cannot be moved.
- `preview-deck.js`: `PREVIEW_ROOMS` and `admitPreviews(flags)` (new; any other room not yet dealt can go in it).
- `dev/backrooms.js` (+6 −1): imports `admitPreviews`, lets the flagged rooms in, and lets `&room=` deal one. Plus its
  line in the head of the file.
- `test/backrooms-rooms.test.mjs` (+3 −1): the deck-entry tests also cover `PREVIEW_ROOMS`, so that `rooms/giant-chair.js`
  is somebody's.
- Not touched: `index.js`, `world.js`, `gen.js`, `plan.js`, the deck files.

### Try it

```
/world/dev/backrooms.html?seed=7&room=giant-chair&preview=chair&pursuer=0&mute=1&cast=none&x=0&z=13.3&yaw=0
/world/dev/backrooms.html?seed=7&room=giant-chair&preview=chair&pursuer=0&mute=1&cast=none&x=0&z=5.8&yaw=0
/world/dev/backrooms.html?seed=7&room=giant-chair&preview=chair&pursuer=0&mute=1&cast=none&x=-3.2&z=-13.4&yaw=-2.7&pitch=0.42
```

The first is from the way in, the second from the start of the hall, the third turned back from the far wall. Add
`&graphics=high` (wait about 20 s for it to settle) and drop `&pursuer=0` for the chase. Seed 7's room is 8.8 × 27.8 m.
Other seeds give 7.8 or 8.8 m wide, 25.8–27.8 m deep, and every position is worked out from the room's size
(`layout(W, D, H)`).

Pictures in `docs/previews/`:

| picture | what |
|---|---|
| `giant-chair-chase-classic.jpg` | the wide room's far wall stepping in to the squeeze, the red chair in its mouth, the coat-hook recess, the hall beyond |
| `giant-chair-cabinet-classic.jpg` | the same from the right: the filing cabinet in the left wall |
| `giant-chair-hall-classic.jpg` | the hall: its panels running to the brown "doorway" (the rear legs and stretcher), the far doorway framed through both pairs of legs |
| `giant-chair-reveal-classic.jpg` | turned back from the far wall: the whole chair, the back through the hole into the lit gap |
| `giant-chair-under-classic.jpg` | from beside the front legs, looking up past the arm at the hole |
| `giant-chair-reveal-high.jpg` | the reveal at High: sculpted fittings, glow off the gap, the light map's soft shadow under the seat |

### Proof

- `test/backrooms-giant-chair.test.mjs` (4 tests):
  - Not in `DECK`. Not an archetype until `admitPreviews(['chair'])`, and other previews do not let it in. No planned
    visit has it.
  - The layout, for both room sizes. The rear legs are flush with the hall's walls, and the stretcher is well over
    head height. The back stops inside the gap, and the hole is wider than the chair. The hall is long and the wide room
    deep. The squeeze is narrower than the hall, with a recess beside it that a chair fits in. The far wall steps in.
  - The sightline: a ray from eye height at every 25 cm of the hall and the wide room to some 300 points of the back,
    the arms, the hole and the cushion's top is blocked every time.
  - Built on four seeds at Classic and Medium, it builds clean (no warning about it and no doorway rescue), within 16
    lights and the room budget. The four legs are solid and are the legs drawn. The cabinet is flush in the left wall.
    Walking from the way in reaches every doorway, under the seat, in front of the chair and the far corner, and nothing
    behind the hall's walls. The squeeze has a way past the chair and the chair is in the way. Carried into the recess,
    the chair fits there, the squeeze is clear across its width and every doorway is still reached.
- Byte-identity with fcf4338. Exported `public/` and `core/` at fcf4338 with `git archive`, then built both trees with
  the same script, with no flag: 16 seeds (7, 21, 3, 11, 40, q, zz, 102, 1, 2, 5, 9, 13, 77, abc, 999), each whole and
  with party, museum and kanban dealt, at Classic and Medium. For every room it compared meshes (every attribute and
  index), colliders, lamps, ambient, level, light maps, shadow boxes and the build's warnings: 1,818 rooms, plus
  `edition()` and the 16 seeds' planned visits. The output is the same to the byte.

### The push: what there is, and what a chair this size would need

What the engine already does:

- **Furniture** (docs/BACKROOMS-BARRICADES.md, on for everybody): every floor-standing catalogue `chair`, `desk` and
  `trolley` can be carried. Tap E to pick it up, walk (a chair at 1.1 m/s) and tap E to set it down where its footprint
  is clear. A room can register its own moving thing with `c.movable(group, { foot, type })` (movable-props.js), up to
  4 m across and 4 m tall, with one rectangular collider.
- **Being chased**: the pirate either routes round a moved piece or braces (1.2 s for a chair) and shoves it, in small
  swept steps (furniture-motion.js). The cardboard follower routes round or waits. The others collide with it live, and
  their paths are rebuilt when it is set down (`furnitureRevision`).
- **The visitor's shove** (`env.shove`, shove.rule.js) pushes the cast in front of you back a step. It does not push
  furniture: you carry it, you never push it.
- **The trap check** (world.js): if any doorway cannot be reached with everything in place, every collider that is not
  kept stops being solid. A chair that blocks the squeeze completely would become a ghost, which is why this one leaves
  a sidle past it. The bridge puzzles' route witness (`c.bridgeRoute`) is the only way a room says that a doorway is
  reached once something has been moved, and it is for bridges.

So the chase beat here uses only what exists: the small chair is ordinary furniture, and the recess is a place to set
it down. To push the big chair (3.2 × 3.0 m, 6 m tall, through the ceiling) it would need:

1. A movable without the 4 m height limit, with more than one collider (the four legs, not the box round them, or the
   way under the seat is lost).
2. A push verb for the visitor: the chair slides in front of you along the floor in swept steps, as the pirate's shove
   already does, rather than being carried floating at your eye.
3. A slot in the ceiling, or a hole that moves with it: the back goes through the grid, so it can only slide where the
   ceiling is open, for example along a long slot over its track.
4. A way for the trap check to accept a route that depends on moving it (a witness like `bridgeRoute` for "push this
   aside"), or the room must never need the move.
5. A light that follows it: its light is baked per vertex and travels with it unchanged. That is fine for a chair, but
   wrong for something that shadows a whole chamber.

### What our lighting can't reach

The storyboard is soft and bounced: the hall's walls glow evenly from the panels, the chair throws a soft, broad shadow
on the carpet, the light from the hole washes down the back and onto the seat, and the underside of the seat is a deep
warm dark. At Classic:

- **The dark under the seat** is a blot on the carpet plus whatever the per-vertex bake gives the underside. The bake
  has no occlusion at Classic, so the walls next to the legs and the legs themselves are lit as if the seat were not
  there.
- **The light down the back** is one lamp in the gap. It brightens the cushion and the back's front, but the back's
  outline casts nothing on the seat, and there is no shaft or haze in the hole: the gap is self-lit, not a light
  source you can see in the air.
- **Bounce** (the red of the vinyl on the carpet, the yellow of the walls on the wood) does not exist.

At Medium and High the light map adds tube shadows and the glow blooms the gap, which helps a lot (see
`giant-chair-reveal-high.jpg`). But the light map covers only the shell's floor and walls. The chair, the hall's blocks
and the ceilings the room draws itself are lit by lamps only, so the legs throw no shadow from the gap lamp. High also
takes about 20 s to settle on a slow machine. The pictures were taken under SwiftShader, and anything earlier is
grainy.

**WebGPU** (`claude/steam-webgpu`, `docs/BLOCKROOMS-WEBGPU.md`): phase 1 and step 2 are a port to the same look. The
Classic core, then Medium's light maps, on node materials. That alone brings nothing new here. The plan's "Ultra"
(R-3: SSAO through three.js's `ao()` node, light shafts, more shadow casters) is what would get close. Screen-space AO
would put the deep dark under the seat and the contact shadow round each leg, and a shaft node would put visible light
in the hole. Bounce would still be missing. That tier is written only after steps 3–6.

### Not done, and what looked wrong

- Built first from the lead's words for the chase image. The owner's render then landed as "Passing Place"
  (`docs/art-direction/yellow-office/volume-2/passing-place.png` and `-look-back.png`, commit 8ce12a8). It matches: a
  burgundy task chair in the narrowest point, a coat-hook recess with a shelf behind a short divider on the right, and a
  two-drawer cabinet flush in the left wall. Where it differs: the render's left wall curves, where ours steps in. Its
  lane beyond is about 1 m wide, long and green, where ours is a 1.2 m-deep squeeze that opens into the 2.4 m reveal
  hall. Here only the tubes go green with distance, not the walls or a haze. The render's chair fills the lane. Ours
  leaves a 0.6 m sidle, or the level's trap check would ghost it (above). Its "leave the near side clear for a second
  player" is met: the recess is off the lane, on the approach side.
- The little chair is the office's task chair (castors, gas lift), in oxblood, because only the catalogue's chair can be
  carried. The big one is a wooden visitor's chair, so they are not the same chair at two sizes, as the storyboard
  implies. A visitor's-chair model for the catalogue, at half-size voxels, would fix both.
- The hole is hard to see from straight in front at eye height 1.1 m: the near ceiling and the cushion cover most of it.
  It reads from the far corners and from beside the front legs (the pictures). The owner's storyboard is taken from
  higher up.
- From right under the hall's mouth (within a metre) a steep look up shows the back's rear face past the rear rail.
- The cabinet is the level's three-drawer cabinet sunk one drawer into the floor, not a two-drawer model.
- With loot, a coin may be hidden in the chamber's far left corner (its stash). Nothing is in the way there.
- At Medium and High the hall's walls are blocks (`c.pillar`), so they are not in the room's light map, as with the
  hallway preview's angled walls: no tube shadows on them, and the shell's own walls behind them are baked unseen.
- Looked at on seed 7 only. Low, `vhs=2` and a phone were not looked at. Played with the pirate on: not done.

## Borrowed Daylight

The owner's art direction (yellow-office README, "Borrowed Daylight", and `render-blinds.webp`): a wheeled Venetian
blind stands by itself in a windowless room. Late sun comes through it anyway, the wrong way, across the carpet and up
the wall opposite, except where that wall has a door-sized opening; the light goes on into the opening and picks out
its jamb. A paper cup lies in the light with a long ordinary shadow. You walk past the blind and round the jamb to
leave. Light from nowhere; one object, a lot of empty.

**Status: a preview, and a room of its own** (id `blinds`). Its line is in `MORE_DECK` (deck2.js) with `on: false` and
`preview: 'blinds'`, so it is out of every deal and of the building's edition, exactly as a retired room is. Only the dev
page's `&preview=blinds` puts it in the deck, for that page (`preview-rooms.js` `dealPreviewRooms`, called by
`dev/backrooms.js` before anything is generated); it is then dealt, fetched and built like any other room. To deal it
for real: drop `on` and `preview` from its line (weight 1, no favourite kind of floor).

### What was built

- `rooms/blinds.js`: the room. A rectangle (10–11 × 9–11 m, `ports: ['right']`, `lights: 'one'`) with a strip 2.6 m deep
  walled off along the right by blocks of papered, skirted wall (`c.pillar`): the false wall the light climbs. In it,
  the recessed hall: a door-sized mouth (1.1 m, lintel at 2.05) near the back, a short leg in, and a leg along the outer
  wall to the room's right doorway, with one fitting in it, out. One fitting lit in the room (`c.fitting`, on the
  tile grid; the shell's panels off). The blind: a varnished frame on two castered feet, posts, head and sill, an
  aluminium head rail, fifteen slats each at its own tilt (the bottom three hanging crooked), two ladder tapes, a cord
  and its pull; turned boxes in `c.flat`, solid along its length in short boxes, contact blots under the feet, and the
  casters' tracks in the carpet back toward the wall. The cup: a half-size voxel model on its side (`c.place`).
- `rooms/blinds/sun.js`: the light, pure (no three.js). It comes from one point 3.6 m behind the blind, aimed so its
  middle ray crosses the floor and meets the false wall just past the hall's mouth. Every surface it can reach (the
  carpet, the false wall each side of and over the mouth, the back wall, the hall's floor, the jamb at the back of the
  mouth, the outer wall round the doorway, and the skirting proud of each) is a rectangle; what of it that point sees
  through the blind's opening, and in the hall through the mouth as well, is cut out once at build as a convex polygon
  (the limits are planes through the point, so the cut is exact). `lightAt(L, X)` says how lit a spot is: where its ray
  crossed the blind, whether it met a slat (each slat's shadow on the blind's plane from its own width, tilt and droop,
  seen along that ray), a ladder tape or the cup (a tapered capsule), with edges that soften with distance from the
  blind.
- The drawing: those polygons, one mesh, a small `ShaderMaterial` running the same lines as `lightAt` per pixel,
  blended as `dst × (1 + sun)` (DstColor, One). So what it adds is in proportion to each surface's own colour: carpet
  goes amber, paper gold, skirting brown-orange. The same at every tier (Classic, Low, Medium, High); about 30
  triangles. A faint warm lamp low over the floor patch for the bounce, and `rt.level` raised to 0.15 so the camcorder
  does not pump its gain as for a one-tube room (the shade stays shade; `rt.amb` × 0.72).
- It reads nothing seeded but its own `roll`: a few degrees of heading, the cup's turn, and where along the light it
  lies (in the first gap past that, so it is always in the sun).
- **Static.** The sun does not move. Moving it would mean re-cutting the polygons as it went (cheap, a few dozen
  per frame) but a crawl of slats is a second wrong thing; the brief's is that the light is there at all.
- No dust or haze in the beam: the brief says "no mystical haze".

### Try it

```
/world/dev/backrooms.html?seed=7&room=blinds&preview=blinds&pursuer=0&mute=1&cast=none&x=-0.3&z=4.9&yaw=-0.12&pitch=-0.06
/world/dev/backrooms.html?seed=7&room=blinds&preview=blinds&pursuer=0&mute=1&cast=none&x=-0.6&z=-0.6&yaw=-1.25&pitch=-0.1
/world/dev/backrooms.html?seed=7&room=blinds&preview=blinds&pursuer=0&mute=1&cast=none&x=-0.5&z=0.7&yaw=-0.55&pitch=-0.55
/world/dev/backrooms.html?seed=7&room=blinds&preview=blinds&pursuer=0&mute=1&cast=none&x=4.3&z=-3&yaw=3.14
```

The first from the way in, the second at the hall's mouth, the third over the cup, the fourth down the hall's leg to
the doorway; add `&graphics=high` for High. Pictures: `docs/previews/blinds-<door|jamb|cup|hall>-classic.jpg`,
`blinds-door-high.jpg`, `blinds-jamb-high.jpg`. Without `&preview=blinds`, `room=blinds` is not in the deck and the page
lands you where it always does.

### Proof

- `test/backrooms-blinds.test.mjs`: the line is out of the deck and nothing in the game imports the preview; it is
  dealt only for its own flag, once; the light falls on the carpet, climbs the false wall above 1.4 m and picks out the
  jamb, and every bit of it is inside the room and came through the blind (three sizes, with and without the doorway);
  up the wall it is in crisp bands, as many as the gaps; a spot a quarter metre past the cup down the light is in its
  shadow and spots in front and beside are not; built on eight seeds at Classic and Medium, it says nothing wrong,
  every doorway is reached, the hall's mouth is walked, the right doorway is off the hall's leg, the cup lies in the
  light on its own carpet, it is within the light and triangle budgets; the room's code rolls nothing; and in a fresh
  process the deck, the edition and three whole floors are what they were before the preview.
- A whole-floor comparison against fcf4338 (its `public/` and `core/` exported with `git archive`), without the flag:
  16 seeds (7, 21, 3, 11, 40, q, zz, 102, 1, 2, 5, 9, 13, 77, abc, 999), whole, at Classic and at Medium: every room's
  meshes (every vertex attribute and index), colliders, lamps, ambient and level, the rooms' params and the build's
  warnings, 449 rooms: the same to the byte; `edition()` `yntnbj` both.

### What our lighting can't reach

The render's light is the room's key light: it lifts the whole room, bounces warm off the carpet onto the ceiling and
the far walls, and everything in the beam (the frame's feet, the cup) casts a soft-edged shadow that grows with distance.
Ours is a decal of light, exact in its geometry: the slats' bands are the slats as drawn, the edges soften with
distance, the cup's shadow is a real cast shadow inside the patch. What it cannot do: nothing but the cup throws a
shadow into it (not the visitor, not anything dragged in, not the frame's own feet, and a cast member walking
through is lit as if it were not there); it adds light only to surfaces we listed, so the bounce is one faint baked
lamp, not the warm fill of the render; there are no contact shadows from the sun under the cup and frame beyond the
usual blots; and the room's tube light is still the flat bake, so the shade is evenly lit where the render's falls off
into the corners. The WebGPU path (`claude/steam-webgpu`, `?gpu=webgpu`) would not get there by itself: it does not run
GLSL `ShaderMaterial`s at all, so this room's sun has to be ported to a node material first (small: the same lines in
TSL; until then the light is missing under that flag), and its phase plan has no shadow-casting lights for rooms. What
would close most of the gap is R-4/R-3 on that branch: a real shadow map from this one point (the visitor and
furniture in the beam, cheap for one light), and screen-space AO and a little bounce. The slats themselves, crisp and
warm and correct across floor and walls, we already have.

### Not done, and what looked wrong

- Looked at closely on seed 7 (and seeds 21 and 3 from the way in), Classic and High; Low and Medium from one view; a
  phone, not.
- From the front corners the blind is seen edge-on (a post and its feet): it faces between the light and the way in,
  and the light has to come out of its face. From the doorway it reads.
- The wall patch is a hard-topped rectangle; the render's runs off in a long parallelogram. Lower sun would stretch it
  but push the floor patch to the wall.
- The cup, at half-size voxels, is a white lump until you are a couple of metres from it; its shadow is short (the
  sun's point is high so that the wall is climbed).
- About half the floors give the room no right doorway (`ports: ['right']`, as for any room); then the hall is a dead
  end with its dead light, and you leave the way you came.
- With loot, what the seed leaves goes in the front left corner (the stash), away from the light and the blind.
- The hall is lit by the room's tube at Classic (no occlusion in the bake), so it is not as dim as the render's.
