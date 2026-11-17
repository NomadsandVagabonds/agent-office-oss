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
| `tools/lookdev-shots.mjs` | the pictures and the frame times |

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
