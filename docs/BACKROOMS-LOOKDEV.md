# The look-dev lab — the level as it draws today, against the same room improved

Status: **a lab, not the level.** Nothing here ships to players and no file of
the level was changed for it. It exists so that the owner can judge, from
pictures, which parts of the graphics plan (`docs/BACKROOMS-GRAPHICS.md`,
phases 2–5) are worth building into the whole game. Every proposed feature is
a preview: rougher than the real thing would be, and honest about what it is.

## What it is

`public/world/dev/lookdev/` is a page that builds a real floor of the level
(the same `enterBackrooms` the dev page uses, on a stage of its own), stands in
one room of it, holds the camera still and stops the level's clock, and draws
it either as the level draws it today or with a chosen set of proposed
features. Then it shows the picture through the level's real camcorder
(`createVhs` from `vhs.js`, the same passes, pinned to a time).

- **Today** is the level's own material, untouched.
- **Proposed** swaps each kit mesh's material for a `ShaderMaterial` of the
  lab's own that starts from that same material's vertex and fragment source
  (read from the material at run time, because `kit.js` does not export
  `VERT`/`FRAG`; copying them would let the two drift) and adds terms behind
  `#define`s, one per feature (`look.js`, `patch()`). It shares the kit's
  uniforms (torch, dimmer, flicker, banks), so it is lit by exactly what lights
  today's picture. A kit change that moves the lines the patch hooks onto makes
  the lab throw, rather than quietly draw something else.
- **Determinism**: `Math.random` is replaced by a fixed sequence on the lab page
  (the level only uses it for things that happen later; the lab wants the same
  frame every time), the level's frame loop is stopped once the room is built,
  flicker is held on, and everything that moves (ripples, rings, drips, dust,
  the figure, the camcorder's noise) is drawn at `t=`.
- The level's overlay (REC, battery, hints) is hidden: the pictures are about
  the picture under it.

| file | what |
|---|---|
| `index.html` | the page; pins `Math.random` |
| `lab.js` | the stage stand-in, boots the level, fixes the camera, renders through the real camcorder, `window.__lab` |
| `rooms.js` | the test rooms: seed, kind of floor, room, cameras, and the few hand-built things |
| `look.js` | the proposed shading: the patch, lamps, cube picture, torch depth map, haze, dust, grade |
| `bake.js` | h1: tube shadows baked into the vertices and a floor lightmap |
| `water.js` | e: the water surface, the wet map |
| `rooms2.js`, `look2.js`, `movers.js`, `water2.js` | round two (below): its rooms, its passes, the figure, chair and held torch, its water |
| `tools/lookdev-shots.mjs` | the pictures and the frame times (`--round 2` for round two's) |

## Opening it

Run a server for the repository on a port of your own (never the office's
4317), for example a scratch daemon: `OFFICE_PORT=4434 OFFICE_QUIET=1
OFFICE_HARNESS=0 OFFICE_DATA_DIR=/some/tmp/dir node daemon.mjs &`, with the
session observer turned off as well (`AGENTS.md` lists the variable), and open `http://localhost:4434/world/dev/lookdev/?room=office&features=all&vhs=0`.

| query | |
|---|---|
| `room=` | `office` · `bank` · `torch` · `door` · `shiny` · `wet` · `tall` |
| `cam=` | a named camera of that room (below), or `x,z,yaw,pitch` in the room's own frame |
| `features=` | `none` (today) · `all` · a list of `tubeshadow, tubevert, figshadow, doorlight, torchshadow, relief, sheen, reflect, contact, water, air, grade, cold` |
| `vhs=` | `0` clean · `1` steady · `2` the camcorder as players have it (default) |
| `t=` | the time everything that moves is drawn at (default 2) |
| `bank=` | `bank` room: `all` · `out` (one bank of tubes failed) · `red` (with `lighting=emergency`) |
| `lighting=` | the level's own lighting modes (`failing`, `emergency`, …), forced in plain rooms |
| `seed= goto= themes= only=` | for finding a picture: any floor, any room |
| `live=1` | keep drawing (otherwise one frame, then the title says `ready`) |

`window.__lab.set({ features, t })` redraws; `__lab.time(n)` is the mean time of
n frames, read back so the GPU has finished each.

## The pictures

```
node tools/lookdev-shots.mjs --base http://localhost:4434 --out <dir>          # all pairs, vhs 0 and 2, the sheets
node tools/lookdev-shots.mjs --base http://localhost:4434 --out <dir> --only 05,16
node tools/lookdev-shots.mjs --base http://localhost:4434 --out <dir> --time 20  # frame times → frame-times.json
```

It uses the Chromium Playwright already has on the machine (it never installs
one), SwiftShader, 1280×800 at device scale 2, and ffmpeg's `hstack` to join
LEFT = today and RIGHT = the feature. Nothing is written on the pictures. Files
are `<nn>-<feature>-<room>-vhs<level>.png`; the sheets are
`sheet-0-light-and-shadow.png`, `sheet-1-light-and-materials.png`,
`sheet-2-water.png`, `sheet-3-everything-high-vs-today.png`.

## The test rooms: what is real and what is stand-in

Every room is a real floor built by the level's own code (`enterBackrooms` →
plan, generator, `world.js`, the room builders, `kit.js` and its bake). The lab
changes only what is listed as stand-in.

| room | real level | stand-in (hand-built, or changed by the lab) |
|---|---|---|
| `office` (1) | seed 7, yellow floor, room 11: the copier room, with its carpet, paper, tiles, tubes, copiers, papers, sign | the block figure (two kit boxes, grey) that walks across it for h2/d |
| `bank` (1b) | seed 7, yellow floor, room 24, a plain room in the level's own fluorescent-bank mode (`lighting=failing`, or `emergency` for the red wall lamps); its partition and doors | two desks with monitors, three chairs, two steel cabinets, built from kit boxes and baked by the kit (banks included), each with today's round blot under it, because plain rooms are mostly empty; the block figure in `cam=corner` |
| `torch` (2) | the copier room again | its light turned down with the kit's own per-room dimmer (`uDim` 0.04, as the level's black-outs do) and the lit panels darkened to match; torch at full power aimed a little left of the hand pose's default (`torchAim`); the block figure in `cam=figure` |
| `door` (h5) | seed 7, night floor (`only=vending,mailroom,all-hands`), room 3, dark, its doorway into the lit mailroom | the dark room dimmed to 0.06 so the doorway is the main light |
| `shiny` (3) | seed 7, archive floor (`only=mailroom`): the mailroom on Records' lino, its brass tube, glass and blockwork | nothing |
| `wet` (4) | seed 7, yellow floor, the wet-floor room with its signs, its puddle blot and ceiling stain | the flooded patch (water.js, over the real carpet), the mop bucket standing in it, the drip; the puddle surface sits on the level's own blot |
| `tall` (5) | seed 7, yellow floor (`only=all-hands`): the all-hands, 8.3 m | nothing |

What a material *is* is guessed by the lab, because the room contract does not
say yet: floor/wall/ceiling by texture (carpet vs lino/terrazzo/screed), and for
flat-painted boxes and voxel furniture from the colour (brass hues and mid
greys → metal, other voxel colours → plastic). The copier lids come out as
"metal" by that rule; a real build needs the room to say.

## The features

Costs are per pixel of a lit kit surface unless said. "Frame" is the relative
software frame time (next section), today = 1.0. "Survives vhs=2" is judged
from the vhs2 pictures.

### h — tube light and shadow (the lead feature)

| | what it does | cost | survives vhs=2 | verdict | baked / dynamic, level | building it in would touch |
|---|---|---|---|---|---|---|
| **h1** tube shadows, baked (`tubeshadow`) | each lamp's share at each vertex, and at each 5 cm cell of a floor lightmap, is cut by how much of the tube (5 points along its 1.2 m) can be seen past the room's solids; kept per bank (aLit/aFlk/aBank0-3), so a bank that fails takes its shadows with it; the bounce is cut by 0.8 of the hidden share as a stand-in for occluded ambient | build: 40–650 ms a room in JS here (3–32 k vertices × 8–16 lamps × up to 24 boxes; a 156×156 lightmap 40–630 ms). Frame: one extra nearest lookup on floors, a matrix multiply; nothing else | **yes**: clearly (01, 03, 04, sheet-0) | **worth it** — the biggest change for the least run-time cost in the lab | **baked**; medium and up (low could keep the blot) | `kit.js` bake() (a visibility term per lamp), a per-room R8 lightmap and one lookup in FRAG; the room contract (solids need heights, or the bake reads them from the voxels as the lab does); build-time budget (do it in slices, or on a worker) |
| h1 vertices only (`tubevert`) | the same, into the vertices the level already has | build only, no frame cost | no | **not worth it** — floors are cut every 0.5 m, so a chair's shadow is a faint smear (02). Use the lightmap for floors, vertices for walls and furniture | — | — |
| **h2** a figure's shadow (`figshadow`) | per pixel, each listed lamp (16) × 3 points along the tube is tested against the figure's two boxes (slab tests), so the shadow has the tube's soft edge and goes up walls | ≤ 96 slab tests per pixel inside the figure's room; no textures, no passes | yes in red/one-tube light (05); **in a fully lit room it is too faint to see** (06): a dozen tubes and a big ambient share wash it out, which is how such rooms really are | **worth it at high**, and for the horror moments (failing banks, emergency, one tube). A real shadow map from the one or two strongest tubes would be the "ultra" version | **dynamic**; high (medium: a skewed blob from the nearest lit tube) | kit FRAG (a loop over a few lamp uniforms and up to N moving boxes), the moving things' boxes (pursuer, cast, barricades) |
| **h3** shadows that obey failure | h1 per bank: `bank=out` and `lighting=emergency&bank=red` (the level's own modes) | as h1 | **yes**: the emergency picture (04) is the strongest in the lab: long, stepped shadows from the red wall lamps | **worth it** — free once h1 is per bank | baked per bank; medium | as h1: bake stores per-bank visibility; the floor lightmap needs one channel per bank (the lab recomputes its single channel when the levels change — fine for a lab, not for a flicker) |
| **h4** the torch casts shadows (`torchshadow`) | one 256² depth picture from the torch each frame (all of the scene once more, depth only), 4-tap compare | +1 depth pass of the visible rooms a frame, 1 target (256², 0.25 MB), 4 lookups where the beam is | **yes** where the thing is near the wall (08: the copier and lid thrown on the wall); weak when the torch looks along its own line (07: the shadow hides behind what casts it, as with a real torch held by the eye) | **worth it at high** | dynamic; high | stage/index (render the depth pass when the torch is on), kit FRAG (one sampler), a quality switch |
| **h5** light through a doorway (`doorlight`) | per pixel on the dark side, the lit room's tubes (up to 8 × 5 points) are traced to the doorway's opening; light only where the line passes through it (and past the figure) | ≤ 40 ray-plane tests a pixel in rooms next to a lit doorway; uniforms only | yes (09): door-shaped light on the side walls, the floor lit in front; the edges are soft steps | **worth it, but bake it**: rooms do not move, so the door patch belongs in h1's bake (the level already fakes it with one lamp at the door); keep the per-pixel version only for a moving thing in the doorway | baked (patch), dynamic only for blocking; medium | `world.js` door lamps → a bake term per doorway; the door leaves are not modelled (light passes through an open leaf in 09) |

### a–g

| | what it does | cost | survives vhs=2 | verdict | building it in would touch |
|---|---|---|---|---|---|
| **a** relief (`relief`) | height maps made from each level texture at its own texel grid (2.5 cm = 1 voxel): carpet speckle raised, paper print raised, tile pits and T-bar sunk, lino seams sunk; block-bevel normals (5 nearest lookups), lit by the sum of the room's lamps reaching the spot (stand-in for the bake's dominant direction) and by the beams; fades out where a texel is smaller than a pixel | 5 lookups + derivatives per pixel on mapped surfaces, one small R8 texture per texture | **no**: invisible at vhs=2; at vhs=0 only a grainier carpet (10, 11) | **not worth it** at this camera height and resolution; maybe for ceiling tiles at high, close up | kit FRAG, textures.js (a height channel), room contract (none) |
| **b** sheen and shine (`sheen`) | per material: velvet sheen at grazing angles on carpet, satin on paper, tight coloured highlight on metal, broad dull on plastic, hard on lino, an edge on glass; from the 16 strongest lamps and the torch | a 16-lamp loop per pixel | lino and glass: a little; carpet, paper, plastic: no (12, 13) | **worth it only at high, and only for lino/metal/glass** | kit FRAG, room contract (materials) |
| **c** reflections (`reflect`) | one 6×128² cube picture of the room, taken once with today's look, box-projected to the room, blurred by mip level | 1 cube target (~0.6 MB with mips), one capture at build (6 renders), 1 lookup on shiny pixels | barely (14): a soft blue-grey sheen on the lino | **worth it only with water and glass**; on lino alone it is too faint to pay for | bake time (6 renders a room), room budget (reflective surfaces) |
| **d** contact shadows (`contact`) | soft dark under and beside solids, analytic boxes (up to 24 + the figure) | a 26-box loop per pixel | slightly (15) | **superseded by h1** (which already darkens under and beside furniture, with direction); keep as the moving-thing blob at medium | the other agent's bake-time contact darkening covers the static part |
| **e** water (`water`) | flat surface over the real floor cut to a 5 cm grid; room reflected (cube, box-projected), tube glints, absorption by path length, ripples and rings stepped to the grid, drip with rings at `t=`; darker, shinier wet edge, tide line and caustics on walls nearby, caustics under it | 1 transparent surface, 1 cube lookup + ripple maths per water pixel; 1 wet-map lookup on nearby kit surfaces | partly (16, 17, sheet-2): the reflections of the signs and the blocky edge read; the sheet itself reads as grey film, not water, and the puddle on the level's dark blot looks like a stain with rings | **promising, did not reach the bar** — needs a real depth (a sunk floor) and a less grey body colour | room contract (liquid surfaces, a floor that can be lower), kit FRAG (wet map), budgets |
| **f** air (`air`) | haze in the floor's colour by distance (+ height fog in the tall room); ~700 square points of dust lit by being under a tube or in the beam | a few ALU per pixel; one draw of 700 points | haze yes but it greys the yellow (34); dust: a few specks (19) | **haze: worth it, gently, in the floor's own colour**; dust: not worth it at this size | kit FRAG; the other agent's phase-1 haze |
| **g** grade (`grade`, `cold`) | log-space contrast, split tone (teal shadows, warm highlights; colder: blue/green), 14–38 % less saturation, lifted blacks, before the camcorder | 1 full-screen pass + 1 half-float target at the camcorder's size | yes, it changes the whole picture | **worth it, but less**: with everything on, the yellow goes grey-beige (33, 34) and the place loses its colour; the cold variant reads as a different kind of floor | vhs.js (a pass before Signal), per-theme numbers (the other agent's per-theme grade) |

## Frame times

**Software-rendering numbers (SwiftShader, headless Chromium), only good for
comparing features with each other.** Mean milliseconds a frame, 20 frames per
cell (not 200: one frame takes 0.2–3 s in software), each frame read back so it
has finished, at the camcorder's default (vhs=2: a 720×540 picture, bloom and
both camcorder passes included), 1280×800 window, device scale 1. A feature that
does not apply to a room (no figure, no doorway, no torch, no water) compiles
to nothing there. The machine was shared: the noise is ±20 % (the `torch` row
measured "today" slower than several features, which is noise and a cold first
frame).

| room | none | tube-shadow | fig-shadow | door-light | torch-shadow | relief | sheen | reflect | contact | water | air | grade | all |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| office | 240 | 247 | 867 | 355 | 311 | 563 | 927 | 581 | 915 | 497 | 493 | 611 | 3083 |
| torch | 569 | 513 | 401 | 398 | 474 | 519 | 478 | 378 | 439 | 227 | 222 | 293 | 645 |
| shiny | 228 | 233 | 253 | 252 | 343 | 365 | 378 | 256 | 588 | 338 | 310 | 376 | 1105 |
| wet | 304 | 311 | 299 | 281 | 290 | 404 | 433 | 389 | 452 | 459 | 302 | 347 | 948 |
| tall | 383 | 368 | 373 | 374 | 354 | 473 | 973 | 693 | 1074 | 551 | 596 | 615 | 2052 |
| bank | 570 | 556 | 622 | 564 | 527 | 727 | 825 | 369 | 727 | 367 | 386 | 422 | 1373 |
| door | 326 | 313 | 618 | 520 | 320 | 509 | 583 | 345 | 628 | 341 | 329 | 406 | 1896 |

What the table says, roughly: the **baked tube shadows cost nothing a frame**
(the bake is paid once). The **per-pixel loops** are what costs: sheen (16
lamps), contact (26 boxes) and the figure's shadow (16 lamps × 3 × 2 boxes)
each roughly double or triple the frame in software where they apply; on a GPU
they are cheaper but are still the ones to keep to a few lamps and a few boxes.
The torch depth pass, the cube lookups, the haze and the grade pass are cheap.
"All" is 2–12× today in software.

## What did not work, and what was not checked

Did not work, or not well enough:

- **The figure's shadow in a fully lit room** (06) is too faint to see. That
  is physically right for a ceiling of a dozen tubes, and the lesson is that
  the horror shadow needs a failing bank, the emergency lamps or one tube.
- **The doorway shot as asked** (a figure out of sight, its shadow through the
  door first) was not found in this geometry: the mailroom's tubes are high
  above its doorway, so a figure behind the jamb throws its shadow only to
  the threshold, and the dark room is small enough that the light floods it.
  The out-of-frame shadow picture (05) is in the bank room instead: emergency
  red, the figure behind the camera's right shoulder, its shadow across the
  floor among the chairs' shadows.
- **Vertex-only tube shadows** (02): the floors are too coarse.
- **Relief** (10, 11) does nothing that survives the camcorder; at vhs=0 the
  carpet just looks grainier.
- **Sheen on carpet and paper** (12) is invisible.
- **Water** (16, 17) is half there: reflections, glints and the voxel edge
  read; the body reads as grey film and the puddle as a stain with rings.
  A flat floor gives no depth to colour.
- **Air in the tall room** and **the grade** together drain the yellow (34):
  pick one, and keep the floor's own colour in both.
- Defects visible in the pictures: the vertex re-bake gives some furniture a
  jagged dark lower half where a vertex falls just inside another solid (the
  near chair's back in 04); the copiers' solids are larger than the copiers,
  so the 5 cm lightmap draws a thin dark line beside their plinths; light
  through the doorway passes through the open door leaves (they are not
  occluders here); the block figure is visible in the office pictures 06,
  10, 12, 15, 20, 21, 30 on both sides (it is part of the room there).

Not checked:

- Anything on real hardware: every number is SwiftShader. Integrated GPUs
  will be far faster in absolute terms, and the ratios will differ (software
  rendering is fill-rate bound and punishes the per-pixel loops more).
- The proposed shading against the level's other paths: voxel creatures, the
  cast, glowing materials, cutouts, the furniture light probes (moving
  furniture keeps `lightTint`; the lab never moves any), rooms with sloped
  ceilings, the outdoor floors.
- The lab's guess of materials from colour is not reviewed room by room.
- Determinism across machines: the pictures are the same run to run here.
- The bake times are for one room on the build machine's CPU, on the main
  thread; the level builds a floor's rooms while you walk.

## Round two

Round two stands on the level as it now draws at **High** (`graphics.js`):
its baked tube shadows per bank, the light through doorways, the sculpted
fittings, the grade, the haze past 8 m, the tier's tight bloom and the scene
drawn twice the tape's size. That is the baseline, and it is not approximated:
the lab boots the level with `graphics: 'high'` and draws it through the
camcorder with High's profile (`lab.js`: `gfx=` in the address, `high` for
every round-two room). The flashlight's own beam shadows are High too, but no
round-two picture has the torch on. Round one's rooms stay on Classic and
draw as they did.

| file | what |
|---|---|
| `rooms2.js` | the rooms: `r2office` (the copier room), `r2bank` (a plain room in the bank mode), `r2door` (the dark room and the lit mailroom), `r2lino` (a corridor of Records' lino), `r2shiny` (the mailroom on lino), `r2pool` (the waterpark's wading lagoon) |
| `look2.js` | the features: two small patches to the kit's shader (`movers`, `materials`), the extra pictures (a material picture, the movers' depth pictures, the floor's mirror, an emissive picture) and the screen passes; the result goes to the camcorder as a full-screen quad that also writes the scene's depth, so the tier's haze still reads it |
| `movers.js` | the figure (standing, or caught mid-stride), the dragged office chair with the level's round blot, the held torch drawn in front exactly as `hand.js` draws it (`holdInFront`) |
| `water2.js` | the pool's surface |

Address: `room=r2office&features=movers,ao&vhs=2`, plus `variant=stand|stride`
(the movers), `held=1` (the torch in the hand), `flicker=1` (`r2bank`: its
second bank failing, pinned to `t`), `features=chosen` (that room's choice),
`dbg=mv|ao|ssr|planar|shafts|bloom|g|emit|water` (one of the lab's own
pictures in place of the scene). Pictures:
`node tools/lookdev-shots.mjs --round 2 --base http://localhost:4434 --out <dir> [--only 1a,6s] [--scale 2]`.
Every picture is LEFT = High as the level draws it now, RIGHT = the feature,
the same camera and the same frame; files are `<n>-<feature>-<what>-vhs0.png`
(clean) and `-vhs2.png` (Full VHS); the strips have the baseline as their top
row. Sheets: `sheet-vhs0.png`, `sheet-vhs2.png` (one picture of each feature),
`sheet-all-chosen.png` (the combination, through the tape). Made at device
scale 2 (2560 × 1600 at vhs0; the scene 1440 × 1080 under the tape); nothing
ran out of memory. Software rendering, so no frame times: "cost" below is a
class, counted, not measured.

### 1 · Shadows of what moves (`movers`)

**Tried.** The figure and the chair are on a layer of their own. Each frame the
up to four tubes that light them most (the room's own tubes, weighed by what
each brings to the movers' middle) get three depth pictures each, 512², of the
movers alone, from points 0.45 m apart along the tube, looking down (130°).
The room's own surfaces within 4 m of the movers take each of those tubes'
share of light off as far as its three points are hidden (2 × 2 comparisons
each), and 60 % of the hidden tubes' part of the ambient with it, as the
level's own bake does; never more than the tubes bring there, so a mover
standing in a baked shadow does not darken it twice. The chair's round blot
goes while this is on. Not done: the movers do not shadow each other or
themselves, and they do not shadow the air.

**Pictures.** `1-moving-shadows-standing`, `1-moving-shadows-midstride` (the
bank room, one bank failed: the figure under the two tubes still lit),
`1-moving-shadows-lit-room` (the copier room, everything on).

**Verdict: worth it, at High.** With one bank out the figure's shape lands on
the partition, stepped at the voxel scale, and the chair stands in a shadow
of its own base; both survive Full VHS. In the fully lit copier room it is
faint and soft, the same lesson as round one: a figure 0.4 m wide under a
1.2 m tube with a dozen others around has a wide, weak penumbra, which is how
such rooms are. It reads best exactly where the horror is (failing banks,
emergency light, a black-out with one tube).

**Cost class.** 12 tiny depth passes a frame (the movers only: a few hundred
triangles each; one 1536 × 2048 depth target), and on the room's pixels within
4 m of a mover up to 4 lamp evaluations and 48 texture reads. Two tubes and
two points would halve it and still read.

**In the game.** A layer (or list) of what moves (the pursuer, the cast,
dragged furniture); a depth atlas made once a frame before the scene; a block
in `kit.js`'s fragment shader beside `lightmapped()`; the tubes chosen per
mover from `rt.lights` with their bank and flicker levels (`world.js` already
has them for `lightAt`). Medium could keep the blot.

### 2 · Ambient occlusion from the screen (`ao`)

**Tried.** Horizon-based (the GTAO integral): from the scene's depth alone, at
the size the scene is drawn under the tape, four directions a pixel, eight
steps each way out to 0.42 m, then a 4 × 4 blur weighted by depth. The face's
normal comes from the depth (of each pair of neighbours, the one on the same
face), so a flat voxel face is exactly flat and nothing smears across it. What
is held in the hand (drawn into the depth range's nearest sliver, `hand.js`)
is skipped both ways: it is not darkened and it darkens nothing, so there is
no halo round it. Applied to the whole colour at 0.85 (the level's picture has
no separate ambient term to apply it to).

**Pictures.** `2-ao-held` (the copiers close, the torch in the hand),
`2-ao-room`.

**Verdict: worth it, cheap, but quiet.** Clean at vhs0: creases, the copiers'
feet, the trays, the corners, no halo round the torch, flat faces untouched.
Through Full VHS it is only a slight deepening of corners and feet; with the
baked tube shadows already there it adds less than it would to a flat-lit
picture. It does cover what moves, which the bake cannot.

**Cost class.** One full-screen pass at the scene's size (68 depth reads a
pixel) and one blur (16). **In the game:** the depth texture the haze already
reads at Medium and High; the held-item sliver already exists; a pass before
the supersample's filter in `vhs.js`.

### 3 · Reflections on hard floors and glass (`ssr`, `planar`)

**Tried.** A material picture (one more pass of the scene: normal and what a
surface is, by round one's guess: lino by texture, glass, metal by colour).
*SSR*: at half size, a ray marched through the depth picture (up to 56 growing
steps, then 5 halvings), the colour fetched where it hits, faded at the
picture's edges and with distance, a little jitter by roughness. *Planar*: the
room drawn once more from under the floor's plane (an oblique near plane clips
what is below it), looked up where each floor pixel is, blurred by roughness.
Both with Schlick fresnel and both at twice what bare lino would give
(`reflK: 2`, a waxed floor): bare, it is too faint to pay for, as round one
found.

**Pictures.** `3-ssr-corridor`, `3-planar-corridor`,
`3-planar-vs-ssr-corridor` (LEFT planar, RIGHT SSR), `3-ssr-glass-mailroom`.

**Verdict: planar is the better value for floors; SSR is not worth it.** The
planar mirror is exact for a flat floor, shows what the screen does not (the
tube overhead, above the top of the picture, lies in the floor), costs one
more draw of the room at half size, and is steady. SSR misses everything
off-screen (the overhead tubes, which are the point), leaves speckle where
rays miss or graze, and smears the walls; on the mailroom's glass tube it adds
almost nothing. Both survive Full VHS as a soft sheen with the tube's bright
patch; without a tube in it, a reflection does not survive the tape.

**Cost class.** Planar: one more scene pass at half size per reflecting plane
(a room has one floor), 5 lookups a floor pixel. SSR: a material and normal
picture (one more pass, or a second target of the main pass), then up to 61
depth reads a reflective pixel at half size. **In the game:** the room contract
has to say which floors are hard (the materials the plan already drafts), and
the floor's height per room; for SSR a normal target.

### 4 · Light in the air (`shafts`)

**Tried.** At half size, each pixel's line of sight marched in 28 steps (with
noise, then blurred): the air lit by the room's nearest eight tubes (only
downward out of the fittings, falling off) and by the next room's lamps
through the doorway's opening (three points a lamp, a ray-plane test against
the opening: a door-shaped prism of light). Nothing else shadows it. The
failing tube: `r2bank` with its second bank stuttering, eight steps pinned to
`t`; the tubes, their light and the air follow it together.

**Pictures.** `4-shafts-doorway`, `4-shafts-tubes`,
`4-shafts-failing-tube-strip` (top row the baseline; five frames 1/6 s apart).

**Verdict: only at a doorway from a lit room into a dark one, and thinner than
shown.** The doorway's beam has the opening's shape and survives the tape, but
it lifts the whole dark room's blacks a little, which costs the dark more than
the beam gives. Under the tubes of a lit room it is a uniform pale veil that
greys the yellow (round one's warning again): not worth it. In the failing-tube
strip the room's own light carries the flicker; the air adds nothing that
survives the tape at this density.

**Cost class.** One half-size pass, 28 steps × (8 tubes + 8 lamps × 3 opening
tests) of arithmetic and one depth read; a blur. **In the game:** the depth
texture; the doorways with their openings and the lamps beyond (`world.js`
`doorLight` has both); the door leaves as blockers (they are not, here).

### 5 · Bloom for the fittings (`bloom`)

**Tried.** In place of the tier's bloom (which blooms anything bright enough,
the walls under a tube included): an emissive picture (the scene again, every
lit surface black, only what shines by itself drawn: the fittings' tubes and
pans, signs, screens), at half size, down a chain of six halvings and back up,
added in the tubes' own warm white at 0.5. With `materials` on, the brightest
highlights (above 2.2) join it.

**Pictures.** `5-bloom` (looking up at the fittings), `5-bloom-room`.

**Verdict: worth it.** The fittings glow as fittings, through the tape, and the
yellow walls keep their colour because nothing lit blooms. At Full VHS the
louvre's lines soften inside the glow; 0.35 would keep more of them.

**Cost class.** One more scene pass (emissive only; could be a second target of
the main pass) and a chain of small passes about the size of the one it
replaces. **In the game:** the glowing materials are already their own
(`kit.glowing`, the panels' batches); `vhs.js`'s bloom fed from them.

### 6 · Water, again (`water`)

**Tried** in the waterpark's wading lagoon (`r2pool`): a real basin, 0.42 m
deep, so the water has depth to colour. The level's own surface there (a
translucent sheet with a caustic texture) is the baseline; the lab's replaces
it: the room's mirror image about the water's plane (as `planar`), the scene
under it displaced by the ripple and absorbed by the length of water the eye
looks through (red first, so a clear pool goes green-blue with depth), a ripple
worked out on 5 cm cells with its slope stepped, a pale line a cell wide where
the surface meets the basin's walls, the floats and the wader's legs (the
scene's depth just behind the surface), and a wake: rings left along the
wader's path over the last two seconds.

**Pictures.** `6-water`, `6-water-wide`, `6-water-strip` (five frames 0.2 s
apart; top row the baseline).

**Verdict: worth it, in rooms that have a basin.** It reads as water now: the
floats and the tubes in it, the tiles under it bent and blue-green with depth,
the legs under the surface, the edge line, and it stays blocky. Both survive
Full VHS. The wake is too faint to read at this camera and through the tape;
it needs a stronger, slower ring or a foam line behind the legs. On a flat
flooded carpet (round one) none of the depth would be there.

**Cost class.** One more scene pass at half size (the mirror) and the surface's
own pass: per water pixel three ripple evaluations of up to 12 rings and 4
texture reads. **In the game:** the depth texture and the opaque scene before
the water (one copy); the room contract's liquid surfaces (a basin and its
level); the waders' positions over the last two seconds.

### 7 · Materials (`materials`)

**Tried.** On round one's keepers only: lino (roughness 0.2), metal (0.32,
tinted by its colour), glass (0.06), each a GGX highlight of the room's 16
strongest tubes, each tube a 0.9 m line (the point on it nearest the reflected
ray). With a floor reflection on, the floor's highlight is left to the
reflection (it is the same light); the reflections take their blur from the
roughness, and the bloom takes the brightest highlights.

**Pictures.** `7-materials-mailroom` (lino), `7-materials-with-planar-and-bloom`
(LEFT planar and bloom, RIGHT the same with materials), `7-materials-copiers`.

**Verdict: lino yes; metal and glass wait for the contract.** The tubes'
streaks on the mailroom's lino are the most convincing modern touch in the
round and survive the tape. The copiers come out as plastic by the colour rule
(cream), so they gain nothing: that picture shows no change, and nothing in the
round tested metal properly.

**Cost class.** A 16-lamp loop on lino, metal and glass pixels only. **In the
game:** the room contract's materials; `kit.js`'s fragment shader.

### The combination (`chosen`)

Per room (`rooms2.js` `chosen`): the office movers, AO, bloom and materials;
the bank room movers, AO, bloom; the doorway shafts, AO, bloom; the corridor
the planar floor, materials, AO, bloom; the pool the water, movers, AO, bloom.
`sheet-all-chosen.png` and `all-chosen-*-vhs0.png` / `-vhs2.png`. The yellow
keeps its colour in all of them (no grade was added, and the bloom takes
nothing lit); the doorway room is greyer than it should be, which is the
shafts.

### Ranked, best value first

1. **Bloom from what shines**: about the cost of today's bloom; the fittings
   read through the tape; the yellow is untouched.
2. **Water in basins**: the biggest visible change, and it finally reads as
   water; needs the contract's liquids.
3. **Planar floor reflection** (hard floors only, waxed): steady, shows the
   tubes, one half-size pass.
4. **Highlights on lino** (materials): cheap and convincing; metal and glass
   wait for the contract.
5. **Shadows of what moves**: strong in failing light, faint in full light;
   12 tiny passes and a lookup loop.
6. **AO from the screen**: clean, no halos, but quiet through the tape.
7. **Shafts**: only through a doorway into a dark room, and thinner.
8. **SSR**: not worth it here; planar does the floors better and glass barely
   shows it.

### What looks wrong, and what was not done

- The doorway's shafts lift the dark room's blacks; their light also passes
  through the open door leaves (not blockers here, as in round one).
- SSR's speckle where rays miss, at vhs0; the tape's softness hides it.
- The wake does not read at Full VHS.
- `7-materials-copiers` shows no change (the copiers are not metal by the
  lab's colour rule).
- The movers do not shadow themselves or each other; the figure is lit by one
  tint, as the level lights what moves.
- Materials and reflections hang on the lab's guess of what each surface is;
  a real build needs the room to say.
- No frame times (software rendering).
