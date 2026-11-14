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
