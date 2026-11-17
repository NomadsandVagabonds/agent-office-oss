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
Since 17 Nov the row is offered on every visit, all five choices, default
Classic (it was held back to `?debug` visits until the ten-minute check below
came back).
What each tier switches is one table, `profile()` in
`public/world/backrooms/graphics.js`, read by the camcorder (`vhs.js`) and
handed to the kit when a part is built (`gfx: { contact, bounce, shadows, doorlight, fixtures }`).

| | Classic | Low | Medium | High |
|---|---|---|---|---|
| tape lines, Full VHS / Light VHS | 540 / 660 | 480 / 600 | 540 / 660 | 540 / 660 |
| scene under the tape (Full and Light VHS) | the tape's size | the tape's size | 1.5×, at most 1680 across | 2×, at most 2560 across |
| Clean picture, most pixels across | 1680 | 1280 | 1680 | 2560 |
| edge smoothing (MSAA) | 4× | 2× | 4× | 4× |
| bloom | as the host (office on; dev page, site off) | off | from what shines (`glow`) | from what shines (`glow`) |
| grade for the kind of floor | — | yes | yes | yes |
| haze beyond 8 m | — | — | yes | yes |
| corner darkening / bounce (bake) | 0 / 0 | 0.7 / 0 | 1 / 0.7 | 1 / 1 |
| a room's detail batches (`c.detail`) | drawn | hidden | drawn | drawn |
| the flashlight casts shadows (`beamShadows`) | — | — | — | yes, a 1024² depth picture |
| tube shadows (baked light map, per bank) | — | — | yes | yes |
| light through doorways (in the same map) | — | — | yes | yes |
| ceiling lights as sculpted fittings (`fixtures`) | — | — | yes | yes |
| bloom from what shines only (`glow`), in place of the thresholded bloom | — | — | yes | yes |
| water: a marked flat sheet drawn as water while in view (`water`) | — | — | yes (1) | yes (2: the mirror, to come; draws as 1 today) |

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
- **Tube shadows** are not at Low, though a frame pays only a lookup for them:
  the part being walked into pays their bake on the main thread, and Low is
  for the machines that can least afford it. See the next section.
- Measured only in software rendering so far; the costs in the table are
  guesses until phase 0 is run on real hardware.

### Beam shadows (built)

At High the flashlight is stopped by what is in its way: a copier throws its
shape on the wall behind it, a doorway's frame cuts the beam off where it
reaches the next room, and somebody standing in the beam puts their head on
the wall. The switch is `beamShadows` in `graphics.js` (its own lines beside
the table): the size of a square depth picture, 0 for off. It is 0 in Classic,
Low and Medium, 1024 at High.

- **The pass.** Each frame the flashlight is on (`uTorch` above the shader's
  own threshold) and held or mounted, the parts of the building that are up
  are drawn once more, depth only, from the flashlight's emitter
  (`beam-shadows.js`, called from `index.js` just before the camcorder draws).
  Its frustum is the beam's outer cone (18°) and a degree more, out to the
  beam's reach (14 m). Only what is visible is drawn (the rooms the world has
  shown) and only what the frustum holds. Cut-outs are cut out (`CUTOUT`,
  `alphaTest`); instanced meshes go through as they are. Nothing held in the
  hand (draw order 10000 and above) and nothing that writes no depth (blots,
  decals, the round shadows under things) is drawn into it.
- **The shader.** In the kit's surface shader only the flashlight's share of
  the light is multiplied by the shadow: nine hardware comparisons of the
  picture (a 3 × 3 kernel 1.25 texels apart), the point pushed out along its
  normal by a texel and a half and more on a grazing wall, and the outer 2 % of
  the picture fading to unshadowed. The code is in `beam-shadows.rule.js`
  (`BEAM_SHADOW_GLSL`) and only compiled where `BEAM_SHADOWS` is defined; the
  two places it touches in `kit.js`'s shader are marked `// --- beam shadows ---` (and one import).
- **Who takes it and who throws it.** Everything drawn with the kit's surface
  shader takes it: walls, floors, ceilings, furniture, voxel models, cut-outs,
  and the creatures built on it: the dummies, the stand-ins of the Last Light
  and Blackout Bay, the absorbed, carried interest, the head count, the intern,
  the mother, the moth, the other door's frame, the pirate, the porter, the
  shadow, the standing meeting, the lines and the toner (the wet ones too).
  Everything opaque throws it, including what is drawn with a material of its
  own and so does not take it: the office's avatars (the shared voxel Lambert
  material), glowing panels and signs. What is held in the hand neither takes
  it nor throws it.
- **Not shadowed.** The camcorder's own lamp: its emitter is 4 cm under the
  lens and it reaches 2.2 m, so anything it throws lies behind what throws it
  as the lens sees it. A pass for it would cost as much as the flashlight's and
  show nothing. A visit without pockets lights from the eye, and draws no pass
  for the same reason. Co-op's partner's beam (`coop/lights.js`) is not
  shadowed this round.
- **Off is as before.** With the switch at 0 nothing is allocated, no pass is
  drawn and no material gets the define: every surface compiles the shader it
  did. `test/backrooms-gfx-beamshadows.test.mjs` pins it, and Classic drawn by
  the code before and after this, from the same frozen scene, differed in no
  pixel (two rooms, Clean and Full VHS).
- **Resolution.** 512² and 1024² look the same up close (a texel is a few
  millimetres at 1.5 m, under a voxel either way); 1024² keeps the edge under a
  voxel to the far end of the beam, for 5 MB of targets. The emitter moves
  every frame with the hand; the comparisons are filtered, and stepping past a
  copier showed no shimmer.
- **Cost (software rendering, so only relative):** the pass drew 36 draw calls
  and 43,000 triangles standing in the copiers room (the scene pass: 71 and
  50,000); High went from about 590 to 750 ms a frame with it, against 280 for
  Classic.
- **What it cannot show.** The emitter is 15 cm to the right of the eye and
  12 cm below it, so most of a shadow lies behind the thing that throws it:
  the visible part is a band to its upper left, widest when the wall is well
  behind it, as with a real torch held at the chest.

### Tube shadows and doorway light (built)

The first of phase 2, and what the owner chose from the look-dev lab (h1, h3).
Medium and High; `&gfx=shadows,doorlight` on the dev page (with `contact`, `bounce`).
Classic and Low run none of it: no box is gathered, no map is made, no
material is given the shader's block, every baked number is as before
(`test/backrooms-gfx-shadows.test.mjs`).

**What is stored.** Each room that has something standing in it gets one small
texture (`shadowmap.js`, built in `world.js` `shadowRoom`): its floor at 5 cm a
texel (10 cm when the floor would need more than 60,000 texels) and each of its
walls at 10 cm, packed side by side with a one-texel gutter. For each group of
lamps the bake keeps apart (steady, flickering, and each lighting bank) a texel
holds how much of that group's light still arrives there, 0…1. Rooms without
banks need two channels (RG8: steady, flicker); rooms with banks four (RGBA8:
steady, flicker, banks 0 and 1) and a second RG8 texture with more than two
banks. The vertex attributes are not touched: the shader takes each group's
share of the vertex light off by its own channel, so a bank that fails takes its
shadows with it and the rest keep theirs, and a flickering tube's shadow
flickers with it.

**What casts.** What the contact darkening records as standing in the room
(boxes drawn into its own batches, models, pillars), less anything that can be
dragged (chairs, desks and trolleys while the barricades are on: they keep their
round blot, made a little darker, and leave no shadow behind when moved). A
model is not its bounding box: its triangles are gathered into columns 10 cm
across (at most 6 × 6), merged where alike, so a fixed chair throws a seat and
legs and a copier only what is drawn. Boxes within 25 cm of a lamp are its
fitting and cast nothing from it; things hung flat on a wall shade nothing on
that wall. Light from next door (the spill lamp at a doorway) is never
shadowed. A still thing whose shadow is baked has its round blot faded to 30 %.

**How.** Each ceiling tube is four points along its 1.2 m (other lamps one);
for each point and each box near enough, the box's shadow on the floor and each
wall is projected and filled in, so the cost goes with the area of shadow, not
the room's area times its lamps. Where a group's lamps are hidden, 60 % of its
share of the room's ambient light goes with them, and at least 30 % of a group
that has ambient light stays (the bounce off the lit floor round a shadow); the
red backup lamps, which bring none, can go black.

**Drawing.** One lookup a pixel (two with more than two banks), no loop over
lamps. The position is snapped to a 5 cm grid before a bilinear lookup, so the
edge steps at voxel scale even where the map is 10 cm. Only the room's own still
meshes read it (not glass, nothing that moves, nothing held, nothing shining by
itself); within them only surfaces on the floor at the room's level and on its
four walls, inside the room. Up to five more vertex outputs (one per group) and
one flat one.

**Bodies.** `world.lightAt` (creatures, the cast, dragged furniture, what is
held) reads the floor's channels where it stands, at 75 % (a head can be clear
of a shadow the feet are in).

**What it costs** (seed 7, the dev page's `&check=1`, software rendering on
the build machine; `map` is the shadows' own share of a room's bake, which at
High also holds the corner darkening and bounce):

| room | size | bake, Classic → High | of it, the map | map bytes |
|---|---|---|---|---|
| copiers | 6.8 × 11.8 | 39 → 129 ms | 68 ms | 141 KB |
| mailroom | 8.8 × 6.8 | 7 → 71 ms | 62 ms | 70 KB |
| cutouts | 7.8 × 7.8 | 30 → 85 ms | 39 ms | 68 KB |
| all-hands (walls only) | 19.8 × 20.8 × 8.7 | 95 → 130 ms | 3 ms | 150 KB |
| re-org (walls only) | 14.8 × 16.8 × 11.5 | 130 → 222 ms | 17 ms | 159 KB |
| a whole floor (all its rooms) | 34 rooms | 241 → 693 ms | | 0.96 MB |

No room gains a mesh or a triangle. Texture memory: 1 MB or so a floor; the
largest set piece the deck allows (28 × 28 m, 12 m high) would be about 0.6 MB,
a 20 × 20 m room with four banks about 1.3 MB.

**What a frame pays.** A part is built a room at a time (`world.js`
`buildWorld`, `tick` awaited between rooms; the part below is built while the
visitor walks, three frames between rooms, `index.js` `prepare`). With a map to
make, a room is three slices, each its own frame: its build, then its map and
what darkens what (`ctx.shade()`), then the bake of its meshes (`finish`); the
breaths between them are one frame each, so a room takes the frames it took
before. Nothing is drawn until the part is: the part below is hung in the scene
only once it is ready, so no room is seen with half a map. Classic and Low have
no map, and build and tick exactly as before. Measured on the build machine
(software rendering, a 480 × 270 window, seeds 7 and 21: the frames themselves
are slow here, about 75 ms at Classic and 105 ms at Medium with nothing being
built, so only the comparison means anything; the bake is JavaScript on the
main thread, and those milliseconds are this CPU's):

| the part below, built ahead | worst frame | largest piece one frame pays | ready after |
|---|---|---|---|
| Classic | 253 / 370 ms | 156 / 265 ms (a room's build and bake) | 7.3 / 12.5 s |
| Medium, before the slices | 485 / 434 ms | 340 / 302 ms (the same, with the map) | 19.2 / 31.5 s |
| Medium | 223 / 303 ms | 120 / 171 ms (the largest room's build) | 10.3 / 16.4 s |
| High | 209 ms | 105 ms | 10.3 s |

The first part (behind the loading picture) has its worst frame in one room's
own build at every tier (the copiers, about 350 ms, the first time the
catalogue's models are made), not in a map. The re-org's bell rebuilds
nothing: what it moves is moved by its own tick.

**Fell back** (no floor in the map; walls only), by room, from the rooms
themselves and the dev page across seeds 7, 21 and 88, floors 0–2, every
archetype dealt on its own, and the mall and waterpark floors:

- their own floor heights (`rt.floorY`): the all-hands, the re-org, the
  keyboard floor, the cubicle grid, the drop plenum, the culvert; the mall's
  food court, level P, moving stairs and atrium; every waterpark room (the
  bellmouth baths, the deep end, the hanging changing rooms, the kiddie lagoon,
  the lazy river, the return pool, the slide maze, the wave pool, the
  whirlpool flume); the exit when its stairs are the floor.
- no floor of the shell's (they lay their own): the exit's stairwell, the
  stress pool, the tiny door.
- a pit or a dais in a plain room (pits seen; a dais would do the same), and a
  room the no-trap check flattens (none seen).

The mall's plain rooms keep their floor. **No map at all:** a room with nothing
standing in it and no doorway's light reaching it (a few plain rooms, the
landing, the culvert now and then); and a room whose map would hold only a wall
or two that nothing shades and no doorway lights, so it is dropped: the coolers
and the server chasm (the shell's front wall only, the rest their own), and the
odd landing with one small thing in it.

**Light through a doorway** (`doorlight`; `&gfx=doorlight` on the dev page).
Once every room of a part is built (the room next door's lamps are known only
then: `world.js` `doorLight`, `shadowmap.js` `bakeDoorway`), each room with a
map gets the light of its neighbours through up to four of its doorways (the
brightest), one channel a doorway in a further RGBA8 texture at the map's size.
For each point of each lamp next door, the opening's two faces (this side of
the wall and the far side) are projected onto the floor and each wall but the
doorway's own, and where both shapes overlap the light comes through: a
door-shaped patch on the floor and up the side walls, with the frame's edges.
What stands near the doorway on either side, and the open leaves of a hung door
(`doors.js` says where they stand open), cut it. Each frame each doorway's light
is that patch × how open the doorway is (a hung door's swing, `doorleaf.js`
`k`; a doorway shut any other way: `world.throats`) × how lit the room beyond
is (its banks, its flicker, its dimmer: a creature's black-out next door puts
it out), in that room's tubes' colours (`uDoorL`, four numbers). A shut door
lets nothing through. The old glow at a doorway from a brighter room next door
(a lamp in the bake) is kept at half at this tier: it still lights the ceiling
and what stands by the door, which the map does not reach, and it does not
follow the doorway or the room beyond. Bodies standing in the patch are lit by
it (`world.lightAt`). Through the doorway's light is 2.5× the bake's own
falloff (`DOOR_GAIN`): the bake was tuned for rooms lit by their own tubes and a
large ambient share, and through a doorway there is no ambient to carry it.
Cost: at most 33 ms a room on the same floors (the copiers 22, the mailroom 19,
the cutouts 29), about 0.2 s for a whole floor, done a room at a time with one
frame between rooms; the doorways' texture is four bytes a texel at the map's
size, which brings a floor's maps to about 3.3–4.2 MB. A frame pays one more
lookup and four multiplies.

**Not waited for.** The first part bakes its doorways behind the loading
picture. The part below is ready (can be fallen into) once its rooms and maps
are; its doorways' light fills in after (`world.doorsLit`; `env.lateDoorLight`,
set for a part built ahead), the rooms round the landing first. Each room's
doorways arrive whole, in one frame; until then the room draws as it does
without them. In a part being played in, a doorway's light that arrives comes
up over 0.8 s (`DOOR_FADE`) rather than appearing; in a part still hanging
unlit below, it is at full when it arrives, as before. A part thrown away stops
its pass. Waiting at the way down from the first moment (the dev page's
`descend()` as play begins, seed 7, software): Classic 8.9 s, Medium 22.5 s
when the doorways were waited for, 12.6 s now. Of that 22.5 s, 9 s was the
doorway pass: 0.2 s of work and three frames between each of its 29 rooms.

The wait for somebody who goes straight to the way down when play begins
(software rendering, tape and seed 7), on the dev page and on the built site
(a 480 × 360 window):

| | dev page | built site (480 × 360) |
|---|---|---|
| Classic | 8.9 s | 14.2 s |
| Medium | 12.6 s | 30.1 s |

This wait, tier by tier, is the number wanted from ordinary machines, more
than their frame times.

### Ceiling fixtures (built)

`fixtures` (`&gfx=fixtures` on the dev page; Medium and High). Each ceiling
light the shell draws (`world.js` `shell`) is the sculpted fitting of
`ceiling.model.js` instead of the flat panel: the housing let into the ceiling
(trim, sloped pan, lamp holders), its two tubes, and the louvre under them, on
the ceiling plane over the panel, in half-size voxels (`CEILING.scale`). The
panel's two tiles are left out of the ceiling sheet (`Batch.grid`'s `keepOf`),
so the pan is seen through the opening. A fitting goes only where both tiles
were left out whole, at the height of the ceiling there and with the ceiling
level across the panel; anywhere else (a sloping ceiling, a tile cut short at a
wall) the light stays the flat panel.

- **What shines is the flat panel's.** The tubes, and the inside of the pan
  (its pale faces above the trim that face down or inward: `world.js` `panOf`),
  are drawn into the very batch the flat panel would have been in (`panel`,
  `panel-bank-N`, or a flickering light's own mesh), at two spots of the
  panel's own texture (`Batch.addVox` with `uv`): the tubes at its white strip,
  the pan at its diffuser shade, a little under them. So a lit fitting is a
  glowing opening about as bright as the panel was, and blooms as it did; and
  the dimmer, the banks, the flicker, the emergency mode's dead ceiling,
  islands and a creature's black-out turn tubes and pan exactly as they turned
  the panel: the per-frame code is untouched. A dead light is
  `lightVox({ dead: true })`: grey tubes (one gone) and its pan darkened to
  0.3 (the inside of an unlit box is in its own shadow, which the bake does not
  know), lit by the room, in no glowing batch.
- **Housing and louvre** are two voxel batches of the room's own
  (`world.js` `voxBatch`, the shell's and not handed to rooms: baked and drawn
  as `c.vox`, each one mesh however many lights the room has), lit by the bake
  bank by bank like the walls. The blades do not shine; they are drawn at 0.6 of
  the model's colour so that they read as lines across the glow and, when the
  light is out, darker than the tiles. The louvre's batch is marked as detail,
  as `c.detail` marks boxes, so Low leaves it out (and a fitting forced on at
  Low is a recessed glowing box). Neither is put down with `c.place`, so nothing
  of a fitting is gathered as standing for the tube shadows or the contact
  darkening (the shadow map's bytes are the same with and without fittings); the
  flashlight's beam shadows draw them, as everything.
- **The lamps and the plan do not move.** The same lamps at the same places,
  nothing drawn from the room's seeded stream, `generate()` unchanged. Off
  (Classic, Low), not a mesh, a triangle or a baked number differs.
- **Cost**, meshed `{ ao: false }`: a lit light is 280 triangles of housing
  (142 of it the shining inside of the pan) and 72 of tubes, 240 of louvre
  (detail); a dead one 422 + 84, louvre 336; less six (its two tiles and the
  flat quad). A room gains at most one ordinary and one detail mesh: what
  shines joins meshes it had. On seed 7: the copier room (9 lights, 5 dead)
  +3,884 triangles ordinary and +2,640 detail, meshes 22 → 22 (the dead panels'
  batch goes, the housing's comes) and one detail mesh; a plain 6.8 × 7.8 m room
  (9 lights, 1 dead) +3,268 and +2,256, meshes 12 → 12 and one detail mesh. The
  most lights a room has had is 56 (a set piece): at most about 28,000 ordinary
  and 19,000 detail triangles more.
- **Not placed**: the vent (`ventVox`), since the level draws no ceiling vent
  today, and the sagging tile (`sagVox`), since a damaged tile is only ever a
  missing one (`c.hole`) and choosing new places for it would take from the seed.
- **The louvre at a shallow angle.** The first louvre (cross blades 2.5 cm
  deep every 10 cm) hid the whole opening below about 16° above the eye, and a
  lit fitting across a room was a grey grid. The model's louvre is now one voxel
  deep with a cross blade every 20 cm (cut-off about 3.6°), and a lit fitting
  reads as a bright light from across the copier room.

`test/backrooms-gfx-fixtures.test.mjs` pins all of the above.

### Bloom from what shines (built)

`glow` in `graphics.js` (its own lines beside the table, as `beamShadows`): 0 in
Classic and Low, 1 at Medium and High (and Auto). The look-dev lab's best-value
finding (`BACKROOMS-LOOKDEV.md`, round two, 5): the tier's bloom took anything
bright enough, so a pale yellow wall under a tube bloomed and washed out. This
one is made only from what shines by itself, and replaces it at those tiers.

- **What emits.** What the kit draws as shining (`kit.glowing`, which now marks
  its material `userData.glow`), at the colour it is drawn that frame, so a bank
  turned down, a failing tube and the emergency mode's dead ceiling glow as much
  as they shine. Two kinds: a **lamp** (a plain light: the white texture or the
  lit panel's, so the ceiling's panels, the sculpted fittings' tubes and pans,
  `panel-bank-N`, a flickering light's own mesh, plain glowing strips and
  buttons), whose glow is laid over it in full; and a **picture** (anything else
  that shines: exit signs, notices, slides, neon, labels), which the glow goes
  round as a halo and lays only 15 % of itself over, so what it says stays as
  crisp as it is drawn. And the voxels that light themselves (`bake()`: a voxel
  whose glow is above 0.5 is its colour × `GLOW`): screens, lamps, the exit
  box's charge lamp, a creature's eyes; treated as pictures.
- **What does not.** Every lit surface, however bright: walls, floors,
  ceilings, furniture, a dead fitting (grey, in no shining batch), the louvre's
  blades (they cross the glow as lines), the flashlight's and the camcorder
  lamp's patch (light, not emission: the kit's emissive part reads nothing of
  either beam, nor the wet glint), avatars, the office's own Lambert material,
  sprites, whatever is held in the hand, and a shining sheet that is
  see-through and writes no depth: that is light painted on to something (the
  all-hands microphone's pool on the stage, the lamp halo of `rooms.js`), and
  blooming it would bloom the room's light again.
- **How strongly each batch blooms.** `kit.glowing(map, power, rgb, { bloom })`
  and so `c.shining(key, texture, power, rgb, { bloom })`: a number, 1 unless
  given, held to 0…3 (`glow.rule.js` `glowStrength`; anything not a number is
  1), carried as the material's `userData.bloom` beside `userData.glow`. It
  scales only what that batch draws into the emissive picture (its stand-in's
  colour is its colour × the number), on top of its class's own share: a
  picture still gets only 15 % over itself, so a neon fascia at 3 throws three
  times the halo and its words stay readable (looked at in the-orange at High,
  plain and Full VHS: the field round the letters goes from black to a warm
  haze, the letters still read). How the batch itself is drawn does not change,
  the kit's scene shader has no new text or uniform, and Classic and Low, which
  have no glow, ignore it. At 0 a lamp is left out of the emissive picture (one
  draw fewer; in the fallback it is drawn black, as it still hides what is
  behind it) and a picture is drawn black with its mark, so a neighbour's glow
  still leaves it crisp. The pass reads the number every frame, so the dev
  page's handle can try one out: set `userData.bloom` on a shining mesh's
  material from `__backrooms.root`. A `c.shining` key keeps the options of its
  first call: asked for again with another number, it adds to the first batch
  at the first number, so two strengths need two keys. With no `bloom` given
  anywhere the stand-ins, draw list and uniforms are the ones there were: in
  the copier room at Medium and High, Clean, the same paused frame through the
  old pass and the new one differs in 0 of 576,000 pixels, and draws and
  triangles are unchanged. Pinned by `test/backrooms-gfx-glow-strength.test.mjs`.
- **How it is drawn** (`glow.js`, a pass in the camcorder's chain where the
  tier's bloom is, after the scene and before the tape's signal). Each frame
  what shines is drawn once more, at half the size the scene is drawn at (High:
  the tape's size; Medium: three quarters of it), without multisampling, into a
  picture of its own, and nothing else is: a lamp as it is; a picture as it is
  with its alpha set to a quarter, the mark that says "leave me crisp"; and of a
  kit mesh only the triangles whose voxels light themselves (worked out once per
  geometry, `glowFaces`: a small copy of those triangles and their corners), by
  a twin (the kit's own shader and uniforms with `EMISSIVE_BLOOM` defined: what
  it shows, alpha 0). A kit mesh with no such voxel, every wall, floor, piece of
  furniture, avatar and held thing is not drawn at all.
- **Hiding by the scene's own depth.** At Medium and High the camcorder keeps a
  depth texture of the scene it has just drawn, for the haze (`vhs.js`: the
  supersampled scene's, or at Clean the picture's own; multisampled, and
  resolved by three.js as the haze already relies on); held things are written
  into its nearest sliver (`hand.js` `holdInFront`). Every fragment of what
  shines reads that depth at its pixel (`glow.rule.js`: four reads a quarter of
  one of its own pixels from the middle, the nearest kept) and is left out where
  the scene is nearer by more than 1 % of the distance and 2 cm: a wall, a
  copier, a door frame or the hand hides a tube without being drawn again,
  while a ceiling seen at a slant 8 m off keeps its own tubes. The shader text
  is `GLOW_DEPTH_GLSL`, compiled only where `EMISSIVE_BLOOM_DEPTH` is defined
  (the stand-ins of this path). **The fallback:** where a profile has glow and
  no depth texture (none does today), the pass draws as the first version did:
  everything that hides anything again, black where it does not shine, kit
  meshes whole, the picture's own depth doing the hiding; so the feature never
  silently breaks. Both paths are pinned.
- The level's materials and geometries are only swapped for the one draw and
  put back; none is changed. Then the lab's chain: six halvings down, five steps
  back up, each adding the level it lands on (the first, the shining thing
  itself hardly blurred, at half), added over the scene at 0.5 in the tubes'
  warm white (1, 0.97, 0.9): in full where the picture's alpha says lamp or
  nothing, at 15 % where it says picture. The kit's shader blocks are marked
  `// --- emissive bloom ---` and only compiled with `EMISSIVE_BLOOM`, which
  only the twins have.
- **A room that draws the scene itself.** A room may render the scene again
  mid-frame (the mall's television sets, `rooms/the-sets.js`, draw it into
  their own small picture from a room tick, before the camcorder draws). The
  stand-ins are only on inside the pass's own draw, and every material,
  visibility, the background, the render target, clear colour, autoClear and
  the shadow maps' autoUpdate are put back in a `finally` even if the draw
  throws; nothing reads state left by the other draw (the only `onBeforeRender`
  in the level is the hand's, which sets and undoes its own per draw). The
  sets' live screen is a `c.shining` picture, so it glows as a picture does (a
  halo, its picture crisp, the map followed each frame); what their camera sees
  is the scene without glow.
- **Readable signs.** A first version laid the whole glow over everything that
  shone, and an exit sign's letters drowned in their own light. With the
  picture's mark, WAY OUT reads as clearly as at the tier before it, at Clean and
  Full VHS, close and from across a room, at Medium and High; a slide's words in
  the all-hands room and the quiet zone's meter likewise.
- **Cost.** Per frame: what shines in view drawn once more, at a quarter of
  the scene's pixels, unsmoothed, and twelve small screen passes in place of the
  tier's bloom's (that pass is switched off, not removed). Counted with the dev
  page's `&perf=1` read-out at Full VHS, seed 7, the code before and after,
  standing at the same spot (draws of the level's scene / all passes /
  triangles):

  | | before | after |
  |---|---|---|
  | Medium, copier room | 60 / 76 / 61,528 | 71 / 86 / 67,196 |
  | Medium, a plain room | 61 / 77 / 47,010 | 71 / 86 / 51,516 |
  | High, copier room | 60 / 76 / 61,528 | 71 / 86 / 67,196 |
  | High, a plain room | 61 / 77 / 47,010 | 71 / 86 / 51,516 |

  About a sixth more draws of the scene and a tenth more triangles (the panels,
  the exit sign and the few voxel faces that light themselves); the first
  version, which drew every occluder again in black, doubled both (117 / 132 /
  123,034 in the copier room). Medium and High draw the same things; they
  differ in pixels. Frame times are not given: these machines render in
  software, and a millisecond measured there says nothing about a graphics
  card. Memory at Full VHS: the picture 720 × 540 (half float, and its depth)
  4.7 MB and the chain 2.1 MB at High; about 3.8 MB at Medium; at Clean it
  follows the window (at 2560 × 1600, about 18 MB). A program per kind of kit
  surface and of shining material is compiled the first frame it is on.
  `cost()` counts it.
- **Off is as before.** At 0 no pass is made and the chain is the five passes
  it was; no target, material or define exists; Classic keeps the host's bloom
  and Low none. A kit surface's shader, with its block taken out, is the text it
  was (recorded). Switching the tier at run time puts the pass in or takes it
  out and lets go of everything it made: in one page load High → Classic →
  High → Classic → High through the menu's setting (`setSetting('graphics', …)`
  on the dev page's handle), then Auto, whose stepper took it from Medium to Low
  by itself, with no error; each removal released all twelve targets and the
  renderer's textures and programs came back to the same counts each time
  (78 / 62 textures, 28 / 17 programs). `test/backrooms-gfx-glow.test.mjs` pins
  all of it.
- **Not covered.** A fire's embers and flames (`inventory-fire.js`) and co-op's
  stand-in rooms (`coop/client.js`) are not marked as shining, so none glows.
  The held torch's lens does not glow: the torch is not a voxel model with a
  self-lit voxel. Something drawn with its own vertex shader that moves its
  corners is drawn undisplaced in the black. The glow does not light anything:
  it is in the picture, not in the room.

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

The level has liquid surfaces today, all in the waterpark (more than ten: its
basins through `createBasin` in `waterpark.js`, `waterMesh` in
`rooms/return-pool/art.js`, `bellWater` in `rooms/bellmouth/art.js`, and the
showers' film); elsewhere the wet-floor room's puddle is blots, the atrium's
fountain is dry and the garden's paddling pool is a voxel model.

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

### Water (built: the surface)

`water` in `graphics.js` (its own lines beside the table, as `glow`): 0 in
Classic and Low, 1 at Medium, 2 at High (and Auto starts at 1). 2 is kept for
the mirror (push three); today 1 and 2 draw the same. The look-dev lab's
second-best finding (`BACKROOMS-LOOKDEV.md`, round two, 6), adapted to the real
rooms: the lab found its surface by a guess, drew one rectangle in a scene of
its own with no depth test, rippled on the world's grid and had no case for an
eye under the water; none of that is kept. This is push one of four (the mark
and the surface); the wake, the currents and the mirror are to come.

**No ordinary visit can reach it yet**: the only liquids are the waterpark's,
and the waterpark is not dealt (`dealt: false`). The dev page reaches it with
`&themes=waterpark` and `&graphics=medium` or `high`.

- **The contract** (`world.js` `roomContext`, the mark in `liquid.mark.js`, which imports no three.js so that the
  rooms' own node tests load it as they load `world.js`): `c.liquid(target, { kind:
  'water', phase, flow, y })` marks a sheet the room already drew; it draws
  nothing. The target is the mesh, the group the mesh is put in once the room
  is lit, or the batch it is drawn from (the waterpark's helpers make their
  mesh in `c.after`). The mark is kept in `rt.liquids`; once the room is built
  (`c.after`) it finds its mesh(es) and measures them in the room's frame: flat
  (corners within 1 cm up and down) or refused, quietly (the sheet stays as
  it is). It returns `{ disturb() }`, which does nothing yet (the wake). `phase`
  (a `{ value }`, the room's own uniform object) drifts the ripple: the return
  pool's drift turns round with its valve. `flow` and `y` are stored and not
  read yet (`flow` is push four's). At every tier the mark is all a room's
  build does: no material, mesh or texture is made there, and a room built in
  node (the waterpark's tests) is as it was.
- **What a room does**: nothing more than the one call. The waterpark's three
  helpers each have one line, written as an optional call so that a context
  without it is safe (the reviewer allowed exactly these; nothing else in those
  files is touched, `test/backrooms-gfx-water.test.mjs` pins it against
  `origin/blockrooms-live`):
  - `public/world/backrooms/waterpark.js` line 1261, in `createBasin` after its
    sheet: `  c.liquid?.(waterSurf, { kind: 'water', y: waterY });`
  - `public/world/backrooms/waterpark.js` line 1688, the footbath in
    `poolroom`: `      c.liquid?.(wb, { kind: 'water', y: 0.15 });`
  - `public/world/backrooms/rooms/return-pool/art.js` line 51, in `waterMesh`:
    `  c.liquid?.(group, { kind: 'water', phase, y });`
  - `public/world/backrooms/rooms/bellmouth/art.js` line 73, in `bellWater`:
    `  c.liquid?.(group,{kind:'water',phase,y:p.water});`
- **The surface** (`liquid.js`, its numbers and shader text in
  `liquid.rule.js`). Where the tier has water, the first frame a marked flat
  sheet's part is drawn, a second mesh is put beside it on the same geometry
  (rectangles, the bellmouth's 60-sector fan, the changing room's three strips:
  anything flat) with a material of its own. It is lit by the sheet's own
  baked light and the room's very uniform objects (dimmer, flicker, banks,
  tint): a pool in a room that has gone dark is dark. Its tint is the sheet's:
  its picture's average colour (pushed back towards its hue, since the picture
  averages its pale caustic lines in) times its vertex colour, and its opacity
  sets how murky, steeply (as the seventh power: the green rooms' 0.63 and
  0.82 sheets stay dark green murk, the waterpark's 0.52 and 0.56 stay clear):
  the return pool stays green, the deep end emerald. What it draws: what is
  under it, from a copy of the opaque scene, nudged by the ripple and absorbed
  by the length of water the eye looks through to reach it (from the copy's
  depth; red first, so a bed goes blue-green with depth and the floats'
  undersides, the deep end's desk and its drowned monitor show under the
  surface; however much a clear sheet's water absorbs, it lets at least
  e^-0.3 per metre of what is behind it through in its own colours, so 2 m of
  the waterpark's keeps 55 % in its clearest channel and a deep pool reads as
  deep clear water, not fog, while the green rooms' murk is untouched; what
  lights itself under it, brighter than the room's light there, a drowned
  screen, keeps more of its light), with a little of the water's own colour as
  soon as there is any depth of it, giving way again with depth; light playing on what is under it, worked out in the shader where the eye's ray
  reaches the bed (no picture read: the sheet's picture gives the water its tint
  and nothing else): two layers of a net of wavy lines, turned against each
  other and at scales that never line up, each bending, meeting and parting
  with the clock, brighter where their lines cross; on 5 cm cells of the room's
  frame, moved by the same ripple slope that bends the bed, softer and wider
  with depth, drifting with the room's phase, fading by e^-0.35 per metre of a
  clear sheet's water (times the murk squared, so the dark green pools show
  none); it only brightens what it lands on, by up to 1.3 times, and never
  tints it; a pale line where the surface is within
  6 cm of what is behind it (the basin's walls, the floats, the steps), as
  bright as the room and what is
  under it; a ripple worked out on 5 cm cells of the room's own frame, its
  slope stepped, laid flat where a cell is under about two pixels (no speckle
  far off); fresnel towards a flat tint of the room's light (one function,
  `reflection()`, where push three's mirror goes). No wake: the rings'
  uniforms are there and none is set. The new mesh is never visible outside
  the camcorder's own draw, so whatever else draws the scene (the mall's
  television sets, the bloom's picture, the flashlight's shadows) sees each
  room's sheet as it always was. It throws no beam shadow
  (`userData.noBeamShadow`) and does not shine.
- **The split pass** (`vhs.js`; only while a marked surface of a part that is
  up has been in view in the last half second: its box against the camera's
  frustum, held 0.5 s so it cannot flicker at the edge of the picture). Into
  the scene's own target (multisampled, at the supersampled size): (1) under:
  everything opaque, by the ordinary draw itself (what is see-through, the
  water and what is held are put on a layer of their own for the length of the
  draw, the camera kept off it); (2) a copy of that picture and its depth into
  a plain pair at the scene's size; (3) over, into the same target, not
  cleared: the water (it writes depth, so the haze and the bloom read the
  surface), then everything see-through, then what is held (`holdInFront` as
  ever). Layers, visibility, the background, autoClear and the render target
  are put back in a `finally`. Nothing depends on one render a frame or on the
  scene being untouched, so a room that draws the scene itself mid-frame is
  unaffected. **When no surface is in view the old single pass runs exactly as
  before, at every tier**, and at 0 nothing of it exists (no view, no copy, no
  material, no mesh).
- **The eye under the surface** (its plane plus 2 cm): that surface is not
  drawn, the room's own sheet is (the waterpark's veil and underside as now),
  and it does not count as in view. The return pool's upside-down upper pool is
  always over the eye, so it keeps its own sheet.
- **The two ways are the same where there is no water.** At the kiddie
  lagoon's doorway looking out, the two-part draw forced on and off gives the
  same picture: 0 of 576,000 pixels differ, at High (Clean) and at Medium
  (Full VHS), paused. With the pool in view, only the water's pixels differ.
- **What is lost under water.** What is see-through is drawn after the water,
  so a see-through thing below the surface (a blot on a pool's bed, the
  submerged end of a translucent flume) is hidden by it rather than seen
  through it.
- **Not reached.** Co-op's beam (`public/world/coop/lights.js` patches the
  kit's shader) does not reach the new surface, nor does the flashlight's own
  patch: the beam lights the bed, which is seen through the water, but not the
  surface itself. The showers' film and the stream sheets are not marked.
- **Known faults.**
  1. ~~The deep end's desk top went lime under the caustic net.~~ Fixed: the
     net added the room's own light on top of a pale desk the water had
     already turned green, and brightened it up to 2.5 times; the caustics
     now only multiply what is under them, by at most 1.3 times, so they
     brighten it and keep its colour.
  2. A see-through thing below the surface is hidden by the water rather than
     seen through it (it is drawn after the water).
  3. A pool behind a wall but in the frustum still asks for the split draw: it
     costs the copy and changes nothing seen.
  4. The drowned monitor's screen is no brighter than under the old sheet.
- **Cost class.** While a surface is in view: one full-screen copy of the
  scene's colour and depth (High at Full VHS: 1440 × 1080, half float and
  depth, about 19 MB held while the tier has water and a pool has been seen),
  the scene's draws split between two renders (the same draws and triangles in
  all), and on the water's pixels three ripple evaluations, four texture
  reads and the caustics' two layers (a handful of sines and two exponentials;
  the texture read the first version's net took is gone). Counted with `&perf=1` at Full VHS, seed 7, the code before and after
  (draws of the level's scene / all passes / triangles):

  | | before | after |
  |---|---|---|
  | Medium, kiddie lagoon (water in view) | 43 / 58 / 88,114 | 43 / 59 / 88,114 |
  | High, kiddie lagoon (water in view) | 43 / 58 / 88,114 | 43 / 59 / 88,114 |
  | Medium, deep end (water in view) | 109 / 124 / 111,382 | 109 / 125 / 111,382 |
  | High, deep end (water in view) | 109 / 124 / 111,382 | 109 / 125 / 111,382 |
  | Medium, copier room (dry) | 87 / 102 / 63,678 | 87 / 102 / 63,678 |
  | High, copier room (dry) | 87 / 102 / 63,678 | 87 / 102 / 63,678 |

  With water in view the scene's draws are the same in number (the water's
  mesh is drawn in place of the room's sheet, and the rest are split between
  the two renders), plus one pass, the copy. A dry room is the same before
  and after. The test for "in view" is the surface's box against the frustum,
  not whether a wall is in the way: a pool in the next room, behind a wall but
  in the frustum, also asks for the split (at the cost above, and nothing
  different on the screen).

  Software rendering, so no milliseconds.

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

- **After round two of the look-dev lab (17 Nov):** build bloom from what
  shines first, then water (the waterpark is a whole kind of floor, so it is
  the bigger unlock), then the mirror floor. The stepped shadows under fixed
  chairs are fine for now; refining them is low priority.
- **The deep end's drowned monitors (17 Nov):** leave them glowing. Every
  workstation on the bottom of the pool keeps its lit screen, under the old
  sheet and under the new water.
- **The water's caustics (17 Nov):** the owner found the tile-like caustic net
  (the old sheet's picture laid on the bed) fake, "almost like tile grout",
  and asked for a moving, blurred, refracted one, or none. It is now worked
  out in the shader and moves; a variant with none was pictured alongside.
  Shown both, the owner chose the faint moving one (strength 1.3).

## The ten-minute check, before the Graphics row is for everybody

This check came back, and since 17 Nov the Graphics row is public: offered on
every visit, all five choices, default Classic. Everything here is on the
BlockRooms site; nothing needs an office running. Classic is what everybody has today and needs no checking.

**Where:** `https://<the site>/play?debug&tape=7`. Open Settings, set
**Graphics**, leave Picture at Full VHS. The setting is kept on that device.

**On each of: Safari on a Mac, Firefox, a phone (its own browser), and one
ordinary laptop if there is one.** At **Medium**, then at **High**:

1. **Does it start?** The fall, then the first floor, with a picture. A black
   or frozen picture is a fail: say which browser and which tier.
2. **Look up** in the first lit room. Each light should be a recessed fitting
   with tubes and a thin grid, glowing. Grey or black fittings in a lit room
   are a fail.
3. **Find something standing** (a copier, a partition, a pillar). It should
   sit in a soft, stepped shadow on the floor. A jagged line across a floor,
   or a floor that is black, is a fail.
4. **Stand in a doorway** to a brighter room: a paler patch of floor on the
   darker side. Subtle is fine; a hard flash when it appears is worth a note.
5. **High only: the flashlight** (pick one up, or use the one you start with).
   Point it past a door frame or at somebody: the frame or the body should cut
   the beam and throw a shadow. Stripes or speckle all over lit walls is a fail.
6. **Go straight to the way down** on the second floor you reach, as fast as
   you can, and count the seconds of static before the next floor plays.
7. **Change Graphics in the menu** from High to Classic and back while
   standing in a room. The picture should change and nothing should break.

**Then the number.** On the same device open
`https://<the site>/play?debug&tape=7&bench=1` at Medium and again at High, let
the tour finish (about a minute), and press **copy** on the read-out.

**Send back, per device and tier:** the browser and device; pass or fail for 1
to 5 and 7 with a word on any fail; the seconds from 6; the copied `[bench]`
line. A screenshot of anything that looks wrong is worth more than a
description.

**Co-op at Medium** needs two people in one building: both at Medium, one
holds a flashlight, the other should see its beam on the walls. If that is not
to hand, say so and it stays on the list below.

## What the owner should look at next

The Graphics row is public, so what nobody has checked is now a real player's
risk. One line each, newest first:

- **Bloom from what shines (17 Nov).** On Safari and on a phone, at Medium:
  look at a lit sign and a ceiling tube. Each should have a soft halo. A black
  or missing picture, or black fittings, is a fail. (It reads the scene's depth
  as the haze does; that is the part not proven on those browsers.)

## What has been measured

Software rendering on the build machines says nothing; these are real machines.

| date | machine | picture | frames | in view (most) | headroom |
|---|---|---|---|---|---|
| 17 Nov | Apple M4 Max laptop, 120 Hz, Chrome | 720×540 (Full VHS), dpr 1.5 | 8.3 ms at every station (the display's own rate); worst 11.4 ms; one 59 ms frame on a first run, not seen again | 75 draws, 69,000 triangles | the scene drawn 32 times a frame still held 8.3 ms: at least 32× |

**The ten-minute check (17 Nov).** The owner ran it and reports that every
step passed. No device list, no seconds for the wait at the way down and no
`[bench]` lines came back with it, so this is a pass by eye on the owner's own
devices, not a measurement: the table above still has one machine in it.

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
