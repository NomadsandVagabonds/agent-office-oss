# Dispatch — a Backrooms contribution

An optional room candidate on `codex/backrooms-expansion-lab`. Fable owns its
integration and frequency. This is an invented, wordless scene with two unnamed
figures and unbranded graphics cards; there are no character labels, dialogue,
flags, shipping claims, quest prompts or combat.

The room is a tall warehouse that retains office wallpaper, carpet, fluorescent
ceiling tiles and a familiar packing desk. Wooden pallet crates form a seeded
maze. The two workers alternate between embracing, collecting GPUs and loading
an open crate. Arrival briefly startles them. They watch and slowly approach,
then lose interest and resume work even if the player stays. They never attack,
block movement, leave their room or change the player's rewards.

The figures retain the supplied reference outfits: black leather jacket, dark
tee, swept silver hair and glasses; red botanical dress, long side-parted brown
hair and earrings. Their original voxel faces have displaced eye sockets,
offset cheeks and layered mouth/jaw shapes. Long limbs and stiff posing make
the silhouettes uneasy. Both are unnamed, with no photographic textures.

A large wooden crate near the far wall is closed on its front and sides. Only
walking behind it reveals the opening. Walk into its interior to emerge in a
seeded random ordinary Backrooms room. No button is needed. Backtracking through
the original entrance also remains possible.

## Preview

From the repository root:

```sh
node tools/backrooms-offline/preview.mjs --port 44323
```

Open:

```text
http://127.0.0.1:44323/world/dev/backrooms.html?seed=713&room=freight&only=freight&pursuer=0&mute=1&vhs=2&loot=1
```

Use `vhs=0` to inspect geometry. Other useful seeds: 22 (smallest footprint),
20 (largest), 4 and 2 (other rotations). The existing debug handle exposes
`world.rooms.find(r => r.def.arch === 'freight').freight`: layout, clear work
floor, portal destination/use count and reachability result. `freightDuo.read()`
reports the current behavior and actor positions. This adds no production HUD.

## Integration pieces

- `freight-layout.js`: pure maze, crate, workstation and coin-clearance layout.
- `rooms5.js`: room construction and concealed walk-in passage.
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

The expanded deck exposed an existing decorative-pillar placement issue at
seed 15851: a pillar in front of a level doorway overlapped another doorway's
stairs. The small `stairZones` check in `gen.js` fixes that placement and keeps
the existing connectivity test passing.

## Verification

```sh
node --test test/backrooms.test.mjs test/freight-behavior.test.mjs test/freight-layout.test.mjs test/vox.test.mjs
npm test
```

All 26 focused Backrooms, freight and voxel tests pass. The final figure pass
was also inspected in clean and full VHS views with no browser errors/warnings.

Layout checks cover 108 size/seed combinations, including both worker standing
positions, coin floor, portal interior and the back-only opening. Independent
headless browser checks covered seven seeds, all four rotations, minimum and
maximum footprints, actual player-controller traversal, blocked front entry,
repeat crate use, frozen/re-entry state and 120 seconds of character behavior.
Those builds produced no console errors or room-reachability warnings, and the
actors completed every phase without crossing crate colliders.

The full repository suite currently reports 232/237 passing (five failed test
records, including parent suites). Failures are outside Backrooms: a macOS
`/var` versus `/private/var` path assertion in `console.test.mjs`, the existing
mail ordering assertion in `harness-wake.test.mjs`, and the status-line reading
in `usage.test.mjs`. Console and usage failures reproduce in the pristine
`e81f634` snapshot. The wake ordering check passes in isolated baseline runs;
its test and relevant harness files are byte-identical to the snapshot. No
changes to those unrelated systems are included.
