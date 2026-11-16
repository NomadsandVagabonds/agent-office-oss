# How the level should look — a plan

Status: **a plan, not built, and being revised.** It was written against the
level as it was on 14 November; the level has since gained lighting modes, a
camcorder lamp, a flashlight and an outdoor floor, and the table and phases
below have not yet been checked against them. Nothing here has been prototyped; every cost is
an estimate until phase 0 has measured it. The owner asked for it: the office
looks like a finished thing and the level under it looks like 2015.

## Why the two look different

| | the office | the level |
|---|---|---|
| light | a sun and lamps, computed every frame | worked out once when a room is built and stored in its corners (`kit.js`) |
| shadows | soft, real | none, but a round blot under some furniture |
| surfaces | lit materials | one flat shader: a colour and a picture |
| the picture | filmic tone mapping, bloom, a tilt-shift blur | bloom, then the camcorder (`vhs.js`) |
| sharpness | the screen's own pixel density | one pixel to a CSS pixel |

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
   torch, whoever is down here, a door, a tube that flickers.
2. **A budget that is kept.** 60 frames a second on a laptop with no graphics
   card of its own; 30 on a phone four years old. Everything has a measured
   cost and a level of quality it belongs to.
3. **Levels of quality, chosen for you.** The level decides in its first
   seconds and lowers its own resolution to hold the frame rate. The panel is
   for overruling it.
4. **WebGL2 underneath, WebGPU on top.** Everything works on the first; only
   the highest level may ask for the second.
5. **It starts at once.** Little to fetch before the first step.

## Phases

### 0 · Measure

- A read-out on the dev page: frame time, draw calls, triangles in view.
- One fixed walk through three seeds, timed.
- Today's numbers on a weak laptop and on a phone (somebody with the hardware
  has to run this: the build machines only render in software).
- The budgets written down here.

### 1 · Light that is already paid for

- **Darkening where surfaces meet**, per corner, at build time. The largest
  single change for anything made of blocks.
- **Bounce**: a little of the carpet's and the wallpaper's colour on what is
  next to them.
- **Filmic tone mapping and a grade for each kind of floor** (yellow, archive,
  night, fit-out, executive), in the pass that already runs.
- **Sharpness**: the screen's own pixel density, capped by level of quality.
- **Haze** with distance, in the floor's colour.

### 2 · Light that behaves

- Pools under the tubes, light through a doorway onto the next room's floor,
  flicker that reaches the walls.
- The torch as a cone that lights what it points at, with a soft edge.
- A soft shadow under whoever is down here and under what can be carried.
- Things that glow (screens, exit signs, a copier's lamp) light what is near.

### 3 · What things are made of

The flat shader becomes a small lit one with a handful of materials. Each is a
few numbers and, where it helps, one small texture drawn by code:

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
  lights and the torch.
- **Reflections** come from one small picture of each room taken when it is
  built (six faces, a few hundred pixels), blurred by roughness. Shiny floors
  and glass use it. No ray tracing, no per-frame cost.
- **Wear, by seed**: water stains under ceiling holes, scuffs along skirting,
  a darker path where a carpet has been walked. Placed by the generator's
  seeded source so the same seed is the same stain.

### 4 · Water and other liquids

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
- **Wading**: the surface parts round you, and the sound follows speed. The
  player already slows and sinks in a pool.
- **Other liquids use the same layers** with other numbers: coffee, toner, the
  cooler's bottle, whatever is seeping from under a sealed stack.
- Where it applies first: the wet-floor room, the cooler rooms, the flooded
  rooms, puddles under ceiling holes.

### 5 · Air

- Dust in the light under a tube and in the torch's beam.
- Thin fog in the tall rooms, lit by what is in them.
- The camcorder reworked to sit on top of a good picture: fringing at the edge
  of the lens, a vignette, tape noise, all scaled by its setting. Its default
  comes down one step so the picture under it can be seen.

### 6 · Levels of quality, and the panel

| | low | medium (default) | high |
|---|---|---|---|
| phase 1 (stored light, grade, haze) | yes | yes | yes |
| pixel density | 1 | up to 1.5 | up to 2 |
| bloom | no | yes | yes |
| relief and sheen | no | yes | yes |
| room reflections | flat colour | yes | yes |
| soft shadows under things | blot | yes | yes |
| water | still, reflecting | ripples, rings | height field, light under it |
| dust, fog | no | fog | both |
| the torch casting shadows | no | no | yes |

- **Auto** picks one in the first seconds and scales resolution to hold the
  frame rate; it steps down a level if that is not enough, and says nothing.
- One panel for the office and the level, remembered in the browser.

### 7 · Keeping it fast

- A room's still geometry merged; repeated things (chairs, copiers, racks)
  drawn as instances.
- Only rooms that can be seen through a doorway are drawn.
- The next part built in the background in slices that do not drop a frame.
- A phone level: the low column with the camcorder simplified.

### 8 · Later, if the numbers allow

A WebGPU path for the highest level: real soft shadows from a few lights, and
light gathered from the screen. It means a second way of drawing and possibly
a newer three.js, so it is decided after phases 1 to 7 are measured.

## What has to be agreed before any of it is built

1. **Who owns the files.** `kit.js`, `world.js`, `vhs.js` and the shared
   `engine/stage.js` are used by every session working on the level. One
   session should own the drawing code while this is done.
2. **The room contract.** Rooms give colours to the kit today. Materials mean a
   room may also say what a surface is made of. That is an addition to the
   contract (a room that says nothing looks as it does now) and it goes in
   `docs/BACKROOMS.md` before any room uses it.
3. **Budgets.** A room's limits (triangles, meshes, lights) gain two: reflective
   surfaces and liquid surfaces a room may have.
4. **Order.** Phases 0 and 1 first, shown as the same rooms before and after.
   They are most of what is seen and nearly none of the risk.

## Not known yet

- What any of it costs on real hardware.
- Which three.js is vendored and whether its WebGPU renderer is usable from it.
- How much of phases 3 to 5 survives the camcorder at its present default.
- Whether the height-field water holds its frame rate on integrated graphics.
