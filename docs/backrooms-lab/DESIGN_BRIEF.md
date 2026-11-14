# Backrooms room workshop

This is an optional asset and room workshop for **The Office**, based on Fable's `e81f634` snapshot. Fable leads the Backrooms and decides what belongs in the integrated game. A working prototype here is a candidate for review, not a promise that it will ship.

## The place we are extending

The Backrooms is the hidden, first-person place underneath the office. A seeded generator assembles connected rooms, corridors, unusual spaces and an exit. It is finite today. The player explores, crouches, hops and uses objects; the existing mascot can pursue them. Coins and a keycard, when present, are only kept after leaving through the proper exit. The standalone development page uses fictional office names and can simulate those collectibles in memory.

Its visual language is specific:

- Warm, tired yellow wallpaper, stained carpet, skirting, ceiling tiles and imperfect fluorescent panels. Darkness is part of the composition.
- The same chunky voxel desks, printers, chairs, shelving and plants used upstairs. An object should still look handmade from small blocks when viewed closely.
- Static geometry is batched and its light baked into vertices. Moving objects should sit in that same lighting; avoid glossy materials or a new real-time lighting system.
- Soft, low-resolution camcorder presentation, 4:3 framing, restrained interference and quiet synthesized foley. A reveal should survive both the normal VHS view and the clean inspection view.

The humor is an ordinary office habit taken one impossible step too far: a party prepared for you, an employee portrait that closes its eyes, a phone that stops ringing when you approach. Mundane first, wrong second. The room should communicate through arrangement, timing, sound and physical behavior. **Do not add explanatory signs, captions, dialogue boxes or tutorial overlays.** A short existing-style interaction prompt, such as `E · print`, is enough. Existing rooms sometimes contain diegetic labels; that is not a requirement to add more.

Quiet gaps matter. A strange room should be a discovery in an otherwise believable, empty place. Do not fill every corner with jokes, creatures or effects. New encounters can be harmless, neutral or friendly without becoming bright mascot attractions.

## Pacing direction — 14 November 2026

The user's target is **60–80% generic, unsettling maze space**. Similar rooms
make the player doubt whether they have been somewhere before. A recognizable
set piece is also a navigation landmark; a succession of excellent set pieces
can make the building easier to remember and less unsettling.

Use roughly **75% ordinary space, 20% small anomalies and 5% major set pieces**
as an initial design study within that target, not a hard generation rule or a
measured result. The user specified the 60–80% range; this finer split is a
workshop proposal for Fable to assess.

| Role | What the player encounters | Authoring constraint |
| --- | --- | --- |
| Ordinary maze | Repeated yellow wallpaper, carpet, fluorescent grids, pillars, offset openings, doglegs and empty bays | No unique palette, named occupant, puzzle, explanatory sign, or mandatory event. It must work when nothing happens. |
| Small anomaly | A slightly wrong chair position, a damp patch, a gap in the ceiling grid, or an unexplained sound | Sparse, ambiguous and reusable. Avoid a unique visual fingerprint in every room. |
| Major set piece | A room such as Dispatch, a memorable creature, or a major spatial impossibility | Rare punctuation. Adding candidates to the library does not imply dealing more of them into each run. |

Judge this mix along exploration routes as well as across the whole generated
map. Large rooms, detours and dwell time change the experience; room count and
floor area are only proxies. Do not put an anomaly at every fixed number of
doors. Allow quiet stretches, similar branches and returns to familiar-looking
spaces. Disorientation should come from repeated architecture and limited
sightlines, while every required route remains physically traversable.

**Next workshop priority:** ordinary maze variations using the existing material
family and proportions: an offset doorway, an interrupted pillar aisle, and a
dogleg with a nearly identical side bay. Repeat these motifs across multiple
spaces, with restrained differences. These are structural candidates, not new
named attractions in the oddity deck. The proposed Waiting Room is deferred.

The first [quiet maze study](QUIET_MAZE.md) now provides nine connected rooms
using three repeated partition layouts, available only in the dev preview.
It is a geometry and atmosphere candidate, not a change to default pacing.

Gemini's room/creature/item slate is a useful catalogue of optional contributions.
Keep its modular organization, but distinguish authored and tested candidates
from proposed mechanics. Its hostile encounters, item dependencies and new
guidance systems are integration choices for Fable; they should not become
requirements of our quiet maze work. Work only in the assigned checkout so
parallel branches remain independent.

Before proposing runtime tuning, measure the current snapshot and give Fable
the source, sampling method and limitations. Shared generation, exit policy,
pursuit and persistence remain Fable's integration decisions. This direction
does not silently change their defaults.

### Baseline check

On workshop source revision `b26deb8`, 200 default visits (`i * 7919 + 13`,
`i = 0…199`, no forced room/count options) produced these medians:

| Measurement | Median |
| --- | ---: |
| Ordinary/start rooms as a share of rooms, excluding the exit | 60.0% |
| Ordinary/start interior rectangle area, excluding the exit | 36.2% |
| Special rooms along a shortest doorway route, excluding the exit | 33.3% |

74 of the 200 visits had less than 60% ordinary rooms. The ordinary room share
ranged from 50.0% to 66.7%. Larger special rooms account for much of the nominal
area: adding a few tiny connectors alone would not create a predominantly
ordinary environment. A larger candidate library also does not automatically
increase the count dealt into a run; the current default remains 6–9 oddities.

Reproduce with `node tools/backrooms-offline/audit-pacing.mjs`; add `--details`
for the per-visit records. The audit also compares directed floor-hatch routes
and checks differences between equally short routes. Planned hatches may not
all survive furnishing, and other runtime warps are excluded. Rectangle area
does not subtract furniture. These are generator measurements, not evidence
of experienced time, perceptual sameness or actual navigation difficulty.

## What is already here

There are 19 special archetypes, plus the plain, starting and exit rooms. Use this list to avoid repeating an existing premise.

| Archetype | Existing idea |
| --- | --- |
| `cutouts` | Cardboard colleagues form queues, rings or crowds and move when unseen; one can follow. |
| `ceiling-meeting` | A properly furnished meeting is attached to the ceiling. |
| `coolers` | An improbable corridor of identical water coolers; one works. |
| `party` | A celebration prepared for the player, with colleagues, cake and balloons. |
| `many-doors` | Error-code doors; one is an actual passage. |
| `hall-of-fame` | Employee portraits, repeated honors and eyes that close behind your back. |
| `stress-pool` | A sunken pool of stress balls, packing peanuts or shredded paper. |
| `keyboard-floor` | Walking on giant keys types into a terminal with dry responses. |
| `tiny-door` | A narrowing corridor and progressively smaller furniture lead to an inhabited tiny door. |
| `vending` | Machines filled with the same improbable item, lit in a dark room. |
| `ceiling-plants` | Office plants and vines grow down through ceiling tiles. |
| `phone` | A lone phone rings at a distance, then stops when approached. |
| `chairs` | Many chairs arranged around a corner, an object, an empty center or an arch. |
| `wet-floor` | Caution signs on dry carpet; the actual wet patch is unmarked. |
| `kanban` | A wall of repeated task cards spills onto the room; you can add another. |
| `lift` | A plausible lift arrival opens onto an implausible obstruction or reveal. |
| `museum` | Ordinary office objects receive plinths, ropes and museum labels. |
| `photo` | A team photo has one place left for the player; the shutter changes the scene. |
| `nested` | One small room contains another, and another. |

More authored rooms can add variety, but they do not by themselves make the level endless. Exit placement, larger-scale generation and encounter pacing remain Fable's integration decisions. Prefer a few meaningful seeded variants of a good room over a crowded collection of unrelated props.

## How a room fits the code

Read the actual APIs before implementing. There is **no new plugin system** in this workshop. A room is an ordinary builder registered in the existing generator and builder table.

| File | Role |
| --- | --- |
| `public/world/backrooms/gen.js` | Pure seeded layout generation; `DECK` descriptors and per-room parameter rolls. |
| `public/world/backrooms/rooms.js`, `rooms2.js`, `rooms3.js`, `rooms4.js` | Existing room examples and the `BUILDERS` export chain. |
| `public/world/backrooms/world.js` | Builder context, geometry, collision, interactions, room ticking and walkability audit. |
| `public/world/backrooms/kit.js`, `bits.js` | Batched geometry, baked lighting, texture helpers and reusable room details. |
| `public/world/props/works.js`, `props/office.js`, `props/index.js` | The actual office printer, shelves, cabinets and other catalogue props. |
| `public/world/vox/vox.js` | Voxel model primitives and materials. |
| `public/world/backrooms/loot.js`, `pursuer.js` | Existing collectible and threat behavior; outside the starter room's scope. |
| `public/world/dev/backrooms.html`, `backrooms.js` | Playable standalone inspection page with fictional office state. |

Builders work in room-local coordinates: `x` across, `z` along depth, with the entrance on `+z`. Use `c.shell()`, the existing props, seeded `c.R` and the placement/reservation helpers. `c.prop()` returns bounds, not an animated scene object. Use `c.dynamic()` with a `Batch` for movable geometry, `c.use()` for interactions and `c.tick()` for updates. Own new disposable resources through `kit.own()`; do not introduce global timers or event listeners for a local encounter.

Keep doorway approaches and a continuous walking route open in every state. The runtime can disable obstructing furniture or fall back to a plain room after a builder error, so a successful page load is insufficient evidence: inspect warnings and check that the intended room and collision remain intact. Loot placement happens after furnishing and uses `world.walkable()`; do not create a new blocked pocket or a trap for existing collectibles.

## Inspiration and originality

The requested reference is the [Backrooms community wiki](https://backrooms.fandom.com/). It is useful for mood, liminal spaces and the idea that entities need not all attack. Different interpretations exist; do not imply our room is canon or part of a film adaptation. The Carbon Copy starter is an original office anomaly. Do not copy wiki prose, images, meshes, named creatures or audio into it. Record any specific outside references and asset licenses in the handoff; all-new geometry made with the project's own primitives is preferred.
