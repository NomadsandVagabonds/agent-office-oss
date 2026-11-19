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
