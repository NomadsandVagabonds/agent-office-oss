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

Whoever is measuring: a fast machine tests the high column and nothing else.
The numbers that set the budgets come from ordinary laptops and phones, so the
tour is made to be handed on: one address, a minute and a half, and a summary to
copy back. **Auto** is what protects a machine nobody measured.

**Built: the read-out and the tour.** Both are on the dev page, and on the
BlockRooms site under `?debug` (below), and off unless asked for; without the
flags neither page even fetches them.

- `/world/dev/backrooms.html?seed=7&perf=1` puts a small read-out in the top
  right corner, redrawn four times a second. *frame* is the time from one frame
  to the next, measured on the page itself: the last one, and the mean, 95th
  percentile and worst of the last five seconds (16.7 ms is 60 a second, 33.3
  is 30). *draws* and *tris* are what the level's scene pass drew in the last
  frame: the draw calls and triangles that survived being culled, so what is
  in view, not what is built. (The level draws through the camcorder's
  effect composer, so the renderer's own count only ever holds the last
  full-screen pass; the page adds up every render call of a frame instead, and
  counts the ones that drew the level's scene apart from *all passes*.)
  *held* is textures and geometries in memory. *picture* is the size the
  camcorder draws the level at, which with the camcorder on is a few hundred
  lines whatever the screen; *canvas* is the screen's buffer; *dpr* is the
  pixel ratio used, with the device's own beside it. Then the room you are in.
- `&bench=1` adds a fixed tour of the floor you land on (`perf-stats.js`,
  `stations`): the room you land in, then every oddity in the order the floor
  lists them, first just inside its door looking in, then from its centre
  turning one slow circle in four seconds, with a second to settle after each
  jump that is not measured. It is moved by the dev handle, not by keys, so it
  is the same walk for the same seed on any machine: about a minute. At the
  end the page title becomes `bench done`, the console gets one line
  `[bench] {…}` (seed, the flags that change the picture, browser, renderer,
  sizes, and for each station and overall the frame time's mean, p50, p95, p99
  and worst, and the draw calls' and triangles' mean and largest), and a
  summary appears under the read-out with a *copy result* button.
- `node tools/backrooms-bench.mjs` runs the tour headless for seeds 7, 21 and
  88 against an office that is already running (`--base
  http://localhost:4317`; also `--seeds`, `--size`, `--flags 'vhs=0'`,
  `--out`), writes every result to one JSON file and prints a table. It needs
  Playwright and its Chromium to be installed already. The build machines draw
  in software, so their numbers compare one version of the level with another
  on the same machine and say nothing about real hardware.

**To measure a laptop or a phone**: with the office running on a computer the
device can reach, open `/world/dev/backrooms.html?seed=7&bench=1` on it, leave
it alone (no keys, no touching) until the title or the read-out says
`bench done`, then press *copy result* and send the line, or on a phone take a
screenshot of the summary. Say what the device is and whether it was plugged
in. Leave the window at its usual size: the size is part of the result.

**Without an office: the BlockRooms site.** The same read-out and tour are on
the built site, under its `?debug` flag and nowhere else:
`https://<the site>/play?debug&tape=7&bench=1` (or `&perf=1` for the read-out
alone; `/?debug&tape=7&bench=1` on the front page goes straight through to
it). Any laptop or phone with a browser can open it; nothing needs to be
running. The tape is the seed, so the same address is the same walk on every
machine; a bench run there is also on the default difficulty, the full
camcorder (unless `&vhs=0|1|2`), quiet, with nothing following you, and never
a kept tape played back. Your saved settings that change the light
(steady lighting) are still yours. Like any `?debug` visit it is not counted
as somebody going in and walking out of it signs nothing. Without these
flags the site does not fetch the measuring modules at all.

**Stress: past the refresh rate.** A fast machine reads its display's
refresh interval at every station (8.3 ms at 120 Hz): that says there is
headroom, not how much. `&stress=<n>` (1…32, with `&perf=1` or `&bench=1`,
on the dev page or the site) draws the level's scene n times a frame — the
same scene and camera n − 1 extra times into the target the real render is
about to use, cleared again before it — so the scene pass costs about n
times as much and the picture does not change. `&stress=auto` (with
`&bench=1`) steps n through 1, 2, 3, 4, 6, 8, 12, 16, 24, 32 at the first
station, about 1.75 s each, until the mean frame time is over 1.25× the
unstressed one or n is 32; it reports the table of n → mean ms and
*headroom ≈ k×*, the largest n that still held the unstressed frame time
within 10%, then runs the ordinary tour unstressed. Both are in the
`[bench]` line (`stress`) and the summary;
`node tools/backrooms-bench.mjs --stress auto` does the same headless. What
it measures: how many times today's scene pass fits in a frame on that
machine. What it does not: what features that are not built yet will cost
(they are not in the scene to multiply), anything about the camcorder's own
passes after the scene (drawn once), or a higher internal resolution. The
camcorder's line count is fixed inside `vhs.js` (`layout`), which keeps its
composer to itself, so the dev tool cannot raise it without editing that
file; there is no `&lines=`. At `&vhs=0` the picture is the window, up to
1680 pixels wide, and on the dev page `&dpr=` raises it.

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

### The Graphics setting (built)

Esc → Settings → **Graphics**: Classic (the default), Low, Medium, High,
Auto; saved with the other preferences, and `&graphics=` on the dev page.
What each tier switches is one table, `profile()` in
`public/world/backrooms/graphics.js`, read by the camcorder (`vhs.js`) and
handed to the kit when a part is built (`gfx: { contact, bounce }`).

| | Classic | Low | Medium | High |
|---|---|---|---|---|
| tape lines, Full VHS / Light VHS | 540 / 660 | 480 / 600 | 540 / 660 | 540 / 660 |
| scene under the tape (Full and Light VHS) | the tape's size | the tape's size | 1.5×, at most 1680 across | 2×, at most 2560 across |
| Clean picture, most pixels across | 1680 | 1280 | 1680 | 2560 |
| edge smoothing (MSAA) | 4× | 2× | 4× | 4× |
| bloom | as the host (office on; dev page, site off) | off | on, tight | on, tight |
| grade for the kind of floor | — | yes | yes | yes |
| haze beyond 8 m | — | — | yes | yes |
| corner darkening / bounce (bake) | 0 / 0 | 0.7 / 0 | 1 / 0.7 | 1 / 1 |
| a room's detail batches (`c.detail`) | drawn | hidden | drawn | drawn |

- **Classic** draws exactly what the level drew before the setting existed.
- **The camcorder stays the look.** The tape's lines and the scene's size are
  two things: Medium and High draw the scene larger than the tape and bring
  it down with a small filter before the tape's own softness, smear, scan
  lines and noise, as a good lens records onto a soft medium. The tape keeps
  today's lines at every tier above Low: more of them (720 was tried at High)
  made its wobble and scan lines look thin and digital.
- **The grade** is a few numbers per kind of floor (`grade` in `themes.js`:
  lift, gamma, gain, saturation) applied in the camcorder's signal pass after
  its exposure curve and before its noise and smear. It changes on the way
  down into a part of another kind. It tints shadows; it does not darken them.
- **Haze** reads the depth of the drawn picture (a depth texture on the
  camcorder's multisampled targets, only while haze is on). It starts at 8 m,
  goes at most half way, takes the floor's colour, and is only as bright as
  what is behind it: a dark end of a corridor stays dark, and where nothing was
  drawn (the void past a view) is left black.
- **What is held in the hand** is drawn last, over the room (`hand.js`). It
  used to clear the room's depth to get there, which with haze on left the
  whole room reading as the void: the haze went out for as long as anything
  was held. Where a depth texture is being read, the held thing is now drawn
  into the nearest sliver of the depth range instead (`holdInFront`): it is
  still in front of everything, the room keeps its depth and its haze, and the
  held thing reads as nearer than the haze begins. Classic and Low have no
  depth texture and clear the depth as before. Nothing else is drawn that way:
  the pockets' icons are drawn by a renderer of their own, and the menu and
  the card are the page's.
- **Changing tier during a visit** (in the menu, or Auto) changes the picture
  at once: the camcorder's targets are remade, nothing errors, and Classic
  afterwards is Classic before to the pixel (checked paused, so the picture is
  a still: classic → medium → high → low → auto → classic, 0 of 691,200
  pixels different). The bake is not redone. Darkening and bounce are worked
  out per part as it is built, so the part somebody is in keeps the bake it was
  built with, and so does the part below if it was already built (it is, a few
  seconds after landing, when the way down is a hole); a part built after the
  change has the new tier's.
- **A tier that draws the scene larger than the tape** (Medium, High, Auto at
  Full or Light VHS) used to stop a visit dead if it was the saved setting: the
  camcorder drew the larger scene before anything had landed, when it had no
  scene yet, and threw on the first frame (the picture stayed black). It now
  has an empty scene until the first landing, as the ordinary pass always had.
- **Detail batches** are a room's fine detail in batches of their own
  (`c.detail`, or `detail: true` to `c.mapped` and `c.shining`: see "What a
  room may cost" in `docs/BACKROOMS.md`). Their meshes carry
  `userData.detail` (so does any mesh a room flags by hand, such as a theme's
  own `waterpark-detail` mesh: `showDetail` looks for the flag on every mesh
  in the part, at any depth, not for how it was made), and `showDetail` in
  `graphics.js` sets them visible or not
  by the tier's `detail`: when a part is built, and on every tier change
  (in the menu or by Auto), in every part that is up. They are always built;
  Low only hides them, so they cost memory and build time at every tier. A
  detail batch still darkens what it stands near in the bake (and Low has
  corner darkening at 0.7), so a hidden one can leave a faint shadow: keep
  detail to things small enough that this does not read. No room marks any
  yet, so no tier hides anything today.
- **Auto** starts at Medium; about 3 s of frames over 24 ms steps it down to
  Low, about 10 s under 13 ms at Low steps it back once; never two changes
  within 15 s, never more than three a visit, never while the next part is
  being built, and it never touches the Picture setting.
- Measured only in software rendering so far; the costs in the table are
  guesses until phase 0 is run on real hardware.

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

| | classic | low | medium | high | ultra (kept for later) |
|---|---|---|---|---|---|
| who it is for | today's look, unchanged; the default until the owner has compared | weak laptops, older phones | the browser's default in time | a good desktop or laptop | a copy that is downloaded and installed |
| phase 1 (stored light, grade, haze) | no | yes | yes | yes | yes |
| camcorder lines | as today | as today | more | more | the screen's own |
| bloom | by host, as today | no | yes | yes | yes |
| relief and sheen | no | no | yes | yes | yes, finer |
| room reflections | no | flat colour | yes | yes | redrawn as things move |
| soft shadows under things | blot | blot | yes | yes | real, from several lights |
| water | none | still, reflecting | ripples, rings | height field, light under it | the same, larger |
| dust, fog | no | no | fog | both | both |
| the beams casting shadows | no | no | no | yes | yes |

Every feature has a row here and nowhere else (`graphics.js` holds the same
table as data), so a level of quality is a column. **Ultra is a column that is
not built**: an installed copy can count on a modern graphics interface, more
memory and no limit on what is fetched, which a page in a browser cannot, and
when there is one it is filled in rather than drawn a second way.

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

## What the owner has decided since

- **High is the target, and it is not held back.** The level is designed for
  the high column first; medium and low are what is left when things are
  switched off, and auto protects a machine nobody measured. Lower levels can
  be cut further later if phones need it.
- **The camcorder stays the look.** "VHS of modern AAA voxels": some blur is
  welcome, it does the work of anti-aliasing. So medium and high draw the scene
  larger than the tape and bring it down, and the tape's own softness, smear,
  scan lines and noise are left alone. Full VHS stays the default.
- **Light and shadow first.** Of everything proposed, what the tubes, the
  beams and the doorways do is where the budget goes: baked where nothing
  moves, real-time where something does. Light through a doorway is a keeper.
- **WebGL2 first, WebGPU later.** Everything in the high column is built on the
  renderer the level has. The newer one is a later port, once the look is
  proven.
- **Beyond the table above, for high:** real-time shadows from the tubes and
  from both beams, ambient shadowing worked out from the screen (so it covers
  what moves), reflections from the screen on top of each room's stored
  picture, light shafts and lit dust.

## What has been measured

Software rendering on the build machines says nothing; these are real machines.

| date | machine | picture | frames | in view (most) | headroom |
|---|---|---|---|---|---|
| 17 Nov | Apple M4 Max laptop, 120 Hz, Chrome | 720×540 (Full VHS), dpr 1.5 | 8.3 ms at every station (the display's own rate); worst 11.4 ms; one 59 ms frame on a first run, not seen again | 75 draws, 69,000 triangles | the scene drawn 32 times a frame still held 8.3 ms: at least 32× |

No ordinary laptop and no phone has been measured yet. Those set medium and low.

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
