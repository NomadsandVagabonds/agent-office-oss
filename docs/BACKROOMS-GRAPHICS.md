# How the level should look — a plan

Status: **a plan, not built.** It was checked against the level as it was on
16 November. Nothing here has been prototyped; every cost is an estimate until
phase 0 has measured it. The owner asked for it: the office looks like a
finished thing and the level under it looks like 2015.

## Why the two look different

| | the office | the level |
|---|---|---|
| light | a sun and lamps, computed every frame | worked out once when a room is built and stored in its corners (`kit.js` `bake()`). Up to four banks of tubes and a flicker are turned up and down each frame (`lighting.js`): in co-op and in rooms such as The Last Light, not in an ordinary solo visit. And two beams are lit per pixel: the flashlight and the camcorder's lamp (`flashlight.js`). Things that move take one colour from the room's light at where they stand (`lightAt`) |
| darkening where surfaces meet | from the lights | baked on the room's shell (floor by the walls, walls by floor and ceiling, pillars: `world.js`) and per corner on voxel models (`vox/mesher.js`). None where furniture and props meet the floor and walls, and no colour bounce |
| shadows | soft, real | none. A round blot under furniture (it moves with furniture that moves) and under some creatures. Nothing under items, on the floor or in the hand. The beams pass through furniture |
| surfaces | lit materials | one shader for everything (`kit.js` `surface()`): a colour, a picture, grain and edges on voxels, and a wet glint a few creatures ask for. No relief, roughness or reflections. No fog, and the background is black |
| the picture | filmic tone mapping, bloom, a tilt-shift blur | the camcorder (`vhs.js`): its own film curve with gain from the room's light, no grade per kind of floor. Bloom only where the host has effects on: the office, not the dev page or the BlockRooms site |
| sharpness | the screen's own pixel density | the camcorder's: at most 540 lines at Full VHS (the default), 660 at Light VHS, the window (capped at 1680 pixels wide) at Clean, with 4× multisampling |
| quality | Ctrl-K → Graphics: auto, pretty, fast; auto steps down when frames are slow | none of its own. Its menu has Picture and Steady ambient lights |

The level's way is why it runs anywhere. The plan keeps that and spends what
is saved on the things that make a picture read as current.

## The rule

**Blocks stay blocks.** No smoothed geometry, no rounded corners, no
photographic textures. What changes is how light falls on the blocks, what
they are made of, and what the air and the water between them do.

And the level's own rules still hold: no build step, nothing downloaded that is
not in the repository, the same seed is the same building. Every texture below
is drawn by code when the level starts.

## What a large studio would do, and so what we do

1. **Work out everything that does not move, once.** Rooms do not move. Light,
   the darkening where surfaces meet, colour bouncing off carpet onto a wall:
   all at build time, stored with the room. Only what moves is lit live: the
   beams, whoever is down here, a door, a bank of tubes that fails.
2. **A budget that is kept.** 60 frames a second on a laptop with no graphics
   card of its own; 30 on a phone four years old. Everything has a measured
   cost and a level of quality it belongs to.
3. **Levels of quality, chosen for you.** The level decides in its first
   seconds and lowers its own resolution to hold the frame rate. The menu is
   for overruling it.
4. **WebGL2 underneath, WebGPU on top.** Everything works on the first; only
   the highest level may ask for the second.
5. **It starts at once.** Little to fetch before the first step.

## Phases

### 0 · Measure

- A frame read-out on the dev page: frame time (the stage already keeps a
  smoothed one, `frameMs`), draw calls, triangles in view. `&check=1` already
  gives build time, bake time, meshes, triangles and lights per room.
- One fixed walk through three seeds, timed, at each Picture setting.
- Today's numbers on a weak laptop and on a phone (somebody with the hardware
  has to run this: the build machines only render in software).
- The budgets written down here.

### 1 · Light that is already paid for

- **A Graphics setting** in the level's own menu. Its default for now is a
  value that means "as it is today"; low, medium, high and auto come later. It
  is kept with the level's other preferences (`core/backrooms-settings.mjs`).
- **Darkening where furniture and props meet** the floor and the walls, at
  build time. The room's shell and the voxel models have it already; what
  stands on them does not.
- **Bounce**: a little of the carpet's and the wallpaper's colour on what is
  next to them, at build time.
- **A grade for each kind of floor** (yellow, archive, night, fit-out,
  executive, the neighbourhood, the mall) and **haze** with distance in the
  floor's colour, both in the camcorder's Signal pass, which already runs.
  The neighbourhood is indoors on the same stored light, with a painted sky
  and sun; there is no outdoor way of lighting and this plan adds none.
- **Sharpness**: the camcorder's line count raised by level of quality within
  each Picture setting (today at most 540 at Full VHS, 660 at Light VHS, the
  window up to 1680 pixels wide at Clean). Bloom becomes a choice of the
  quality level and not of which page the level is in.

### 2 · Light that behaves

- Pools under the tubes, light through a doorway onto the next room's floor,
  flicker that reaches the walls.
- The flashlight and the camcorder's lamp stopped by what is in the way, with
  a soft shadow behind it.
- A soft shadow under what lies on the floor, under what is in the hand, and
  under the creatures that have none of their own.
- Things that glow (screens, exit signs, a copier's lamp) light what is near.

### 3 · What things are made of

The one shader gains a handful of materials. Each is a few numbers and, where
it helps, one small texture drawn by code:

| material | where | what it gets |
|---|---|---|
| carpet | most floors | a pile pattern in relief, a soft sheen at a glancing angle, no shine |
| wallpaper | most walls | the printed pattern very slightly raised, a satin sheen, seams |
| ceiling tile | ceilings | pitting in relief, matte |
| painted wall, plaster | stairwells, the chasm | roller marks, matte |
| lino, tile | wet floor, corridors | a hard shine and a blurred reflection of the tubes |
| metal | brass tubes, stacks, gratings | a tight highlight, scratches along one direction |
| glass, acrylic | revolving doors, the riser | see-through, an edge that catches the light |
| plastic | monitors, copiers, cubicles | a broad dull highlight |
| paper, cardboard | notes, crates | matte, fibres |

- **Relief without triangles.** Each of those has a relief texture (a normal
  map) made from a height pattern drawn at the same coarse grid as the blocks,
  so a bump is a block-sized bump and not a photograph. Low quality skips it.
- **Sheen and shine** are a few lines in the shader, lit by the room's stored
  light and the beams. The wet glint that some creatures have is where it
  starts.
- **Reflections** come from one small picture of each room taken when it is
  built (six faces, a few hundred pixels), blurred by roughness. Shiny floors
  and glass use it. No ray tracing, no per-frame cost.
- **Wear, by seed**: water stains under ceiling holes, scuffs along skirting,
  a darker path where a carpet has been walked. Placed from a seeded source
  of its own, as the lighting is, so the same seed is the same stain and the
  layout the seed makes does not change.

### 4 · Water and other liquids

There is no liquid surface in the level today. The wet-floor room's puddle is
blots, the atrium's fountain is dry, the garden's paddling pool is a voxel
model, and the hook for a flooded room (`floodMark` in `inventory-world.js`)
is not used. So this phase starts from nothing.

Nothing is simulated as a fluid. A surface that looks like one is built from
cheap layers, and each layer belongs to a level of quality:

| layer | what it does | from |
|---|---|---|
| a flat, still surface with the room reflected in it | the base | low |
| colour that deepens with depth | you can see the bottom at the edge and not in the middle | low |
| slow ripples in the relief | it is never quite still | medium |
| rings from where you step, and from drips | it answers you | medium (a few rings worked out directly); high (a small height field that carries them and bounces them off the sides) |
| a bright wobbling pattern on the floor under it and on nearby walls | light through water | high |
| a wet edge: darker, shinier carpet around it, a line on the wall where it has been | it has been here a while | low (it is build-time) |
| drips from ceiling holes, with a splash and a sound | where it came from | medium |

- **Blocky water**: the ripples are stepped to the same grid as the blocks and
  the surface's edge follows the voxels, so it reads as this world's water.
- **Wading**: the surface parts round you, and the sound follows speed.
- **Other liquids use the same layers** with other numbers: coffee, toner, the
  cooler's bottle, whatever is seeping from under a sealed stack.
- Where it applies first: the wet-floor room, the cooler rooms, the flooded
  rooms, puddles under ceiling holes.

### 5 · Air

- Dust in the light under a tube and in the beams.
- Thin fog in the tall rooms, lit by what is in them.
- The camcorder reworked to sit on top of a good picture: fringing at the edge
  of the lens, a vignette, tape noise, all scaled by its setting. A lower
  default is offered to the owner as a choice; it is not shipped.

### 6 · Levels of quality, and the menu

| | low | medium | high |
|---|---|---|---|
| phase 1 (stored light, grade, haze) | yes | yes | yes |
| camcorder lines | as today | more | more |
| bloom | no | yes | yes |
| relief and sheen | no | yes | yes |
| room reflections | flat colour | yes | yes |
| soft shadows under things | blot | yes | yes |
| water | still, reflecting | ripples, rings | height field, light under it |
| dust, fog | no | fog | both |
| the beams casting shadows | no | no | yes |

- **Auto** picks one in the first seconds and scales resolution to hold the
  frame rate; it steps down a level if that is not enough, and says nothing.
- The level's own menu gains the setting. Underneath it uses the stage's
  quality switch (`engine/stage.js` `quality`, `setQuality`, `frameMs`), which
  only the office uses today.

### 7 · Keeping it fast

- A room's still geometry merged; repeated things (chairs, copiers, racks)
  drawn as instances.
- Only rooms that can be seen through a doorway are drawn.
- The next part built in the background in slices that do not drop a frame.
- A phone level: the low column with the camcorder simplified.

### 8 · Later, if the numbers allow

A WebGPU path for the highest level: real soft shadows from a few lights, and
light gathered from the screen. The vendored three.js is r180 and only its
WebGL build is in the repository, so it means a second way of drawing and new
vendored files. It is decided after phases 1 to 7 are measured.

## What has been agreed

1. **Who owns the files.** One session owns the drawing code for this work:
   `kit.js`, `world.js`, `vhs.js` and the shared `engine/stage.js`. Other
   sessions still push to them, so this work goes in small pushes, each merged
   from the live branch first.
2. **Order.** Only phases 0 and 1 are built now. Nothing past phase 1 starts
   until the owner has seen the same rooms before and after.
3. **Behind a setting.** Every visible change sits behind a graphics setting.
   With the setting at its present-day value the level draws exactly as now.
4. **The same seed is the same building.** Nothing here may change what a seed
   generates, and `plan.js` `edition()` must not move. The tests that pin this
   area stay as they are: `backrooms-lighting`, `backrooms-flashlight`,
   `backrooms-last-light`, `backrooms-menu`, `backrooms-settings` and
   `backrooms-replay`.
5. **The room contract.** Rooms give colours to the kit today. Materials mean a
   room may also say what a surface is made of. That is an addition only (a
   room that says nothing looks as it does now), it is drafted in
   `docs/BACKROOMS.md` before any room uses it, and phases 0 and 1 do not need
   it.
6. **Budgets.** A room's limits (triangles, meshes, lights) gain two:
   reflective surfaces and liquid surfaces. They get numbers once they have
   been measured.
7. **The camcorder's default.** Full VHS is the owner's look. A lower default
   is offered to the owner as a choice, not shipped.
8. **Hardware.** The numbers need a person with a laptop and a phone. The
   build machines render in software.

## Not known yet

- What any of it costs on real hardware.
- Whether a WebGPU build of r180, or a newer three.js, can be vendored without
  a build step.
- How much of phases 3 to 5 survives the camcorder at its present default.
- Whether the height-field water holds its frame rate on integrated graphics.
