# Dispatch — a Backrooms contribution

An optional room candidate on `codex/backrooms-expansion-lab`. Fable owns its
integration and frequency. This is an invented, wordless scene with two unnamed
figures and unbranded graphics cards; there are no character labels, dialogue,
flags, claims about real shipments, quest prompts or combat. Aged handling
marks and invented freight labels are part of the crate surfaces.

The room is a tall warehouse that retains office wallpaper, carpet, fluorescent
ceiling tiles and a familiar packing desk. Wooden pallet crates form a seeded
maze. A tall, lopsided heap of graphics cards buries the packing desk and tipped
office furniture. Loose cards spill around its base, with an accessible low
edge where the workers collect them. The two workers alternate between
embracing, collecting GPUs and loading an open crate. Arrival briefly startles
them. They watch and slowly approach,
then lose interest and resume work even if the player stays. They never attack,
block movement, leave their room or change the player's rewards.

The crates use shared, seeded texture atlases for aged timber and handling
marks: damp end grain, split fibres, replacement boards, old barcode labels,
overprinted lot stamps, Chinese handling marks and occasional marker graffiti.
Ink follows individual boards and is interrupted by their seams and braces.
The passage crate has the same wood wear but no marks that advertise its exit.
This adds two batched surfaces per room, with no per-label meshes or colliders.

The figures retain the supplied reference outfits: black leather jacket, dark
tee, swept silver hair and glasses; red botanical dress, long side-parted brown
hair and earrings. Their heads and layered hair derive from the main Office
avatar builder, with distinct face silhouettes and warm skin palettes. The
roughly 1.85 m figures have long limbs, fixed tiny pupils, unequal recessed
sockets and displaced closed mouths. Their stiff posing makes those familiar
forms uneasy. Both are unnamed, with no photographic textures.

A large wooden crate near the far wall is closed on its front and sides. Only
walking behind it reveals the opening. Walk into its interior to emerge in a
seeded random ordinary Backrooms room. No button is needed. Backtracking through
the original entrance also remains possible.

## Preview

From the repository root:

```sh
node tools/backrooms-offline/preview.mjs --port 44324
```

Open:

```text
http://127.0.0.1:44324/world/dev/backrooms.html?seed=713&room=freight&only=freight&pursuer=0&mute=1&vhs=2&loot=1
```

Use `vhs=0` to inspect geometry. Other useful seeds: 22 (smallest footprint),
20 (largest), 4 and 2 (other rotations). The existing debug handle exposes
`world.rooms.find(r => r.def.arch === 'freight').freight`: layout, clear work
floor, portal destination/use count and reachability result. `freightDuo.read()`
reports the current behavior and actor positions. This adds no production HUD.

## Integration pieces

- `freight-layout.js`: pure maze, crate, workstation and coin-clearance layout.
- `rooms5.js`: room construction and concealed walk-in passage.
- `freight-crates.js`: seeded weathered timber and handling-mark atlases.
- `freight-hoard.js`: batched, tilted GPU heap and buried catalogue furniture.
- `freight-figures.js`: original articulated voxel figures and GPU models.
- `freight-behavior.js`: pure attention/choreography state and local navigation.
- `freight-duo.js`: posing, movement and room lifecycle integration.
- `gen.js` / `rooms.js`: descriptor, stash region and builder registration.

The descriptor uses 18–22 × 22–26 m outer dimensions, a 5–6 m ceiling, no extra
ordinary ports, and weight 0.45. Adding a deck entry changes seeded layouts.
Room count, shared pursuer, exit policy and persistent economy are unchanged.
The crate warp is an extra one-way route; it is not an ordinary door-graph edge.
Its destination is checked against built furniture and reachable standing floor;
the current pursuer's room and its original lair are excluded.

The arrival reaction lasts 22 seconds, including its return-to-work phase.
Re-entering starts a fresh reaction. Pickup and travel phases wait for arrival
at their workstation before advancing, so a GPU cannot disappear mid-route.
Room-local grid routes respect static crate collision; figures remain
non-solid, stop short of the player and use a short follow leash. Ending freezes
the choreography, and leaving cancels attention. GPU/model counts are fixed.

The hoard contains 494 individual cards and four buried/protruding catalogue
props, rising to 3.68 m. It has a reserved footprint behind the pickup line,
separate from the open loading crate. Rotated models are fitted to that
footprint before batching; the heap uses one static collider and the existing
voxel batch. The cards share one cached model (211,432 GPU triangles total),
with no individual draw calls or per-frame physics.

The expanded deck exposed an existing decorative-pillar placement issue at
seed 15851: a pillar in front of a level doorway overlapped another doorway's
stairs. The small `stairZones` check in `gen.js` fixes that placement and keeps
the existing connectivity test passing.

## Verification

```sh
node --test test/backrooms.test.mjs test/freight-behavior.test.mjs test/freight-layout.test.mjs test/vox.test.mjs
npm test
```

All 26 focused Backrooms, freight and voxel tests pass. The latest figure and
crate pass was inspected in clean and full VHS views, including carrying and
embracing. A 110-second simulation completed all eight behavior phases with no
actor/crate overlaps, browser errors or room-reachability warnings.

Layout checks cover 108 size/seed combinations, including both worker standing
positions, coin floor, portal interior and the back-only opening. Independent
headless browser checks covered seven seeds, all four rotations, minimum and
maximum footprints, actual player-controller traversal, blocked front entry,
repeat crate use, frozen/re-entry state and 120 seconds of character behavior.
Those builds produced no console errors or room-reachability warnings, and the
actors completed every phase without crossing crate colliders.

The enlarged hoard was rechecked across all four rotations, including the
minimum and maximum room footprints. The workers completed their routines,
both back-entry portal uses worked, and the closed front remained blocked.
The final heap bounds fit the authored footprint and ceiling clearance;
its cards and furniture add no new geometry batches or textures.

The last full repository suite run reported 232/237 passing (five failed test
records, including parent suites). Failures are outside Backrooms: a macOS
`/var` versus `/private/var` path assertion in `console.test.mjs`, the existing
mail ordering assertion in `harness-wake.test.mjs`, and the status-line reading
in `usage.test.mjs`. Console and usage failures reproduce in the pristine
`e81f634` snapshot. The wake ordering check passes in isolated baseline runs;
its test and relevant harness files are byte-identical to the snapshot. No
changes to those unrelated systems are included.
