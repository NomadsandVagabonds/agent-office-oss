# Flood-Mark Hall

An optional environmental-horror study: an old, flooded room contains a crooked
raised path and three dry islands. A slow tide hides the path, then exposes it.
The player observes the route from a refuge and crosses in stages. There is no
valve puzzle, text, collectible, required jump or swimming system.

## Design card

| Aspect | Candidate |
| --- | --- |
| Geometry | 17.8 × 23.8 m interior, 5 m ceiling; centered front/back doorways at floor height. |
| Route | A 1.6 m-wide zigzag, three raised resting islands, dry entrance/exit docks. |
| Palette | Existing tired wallpaper and fluorescents, stained stone steps, cloudy green water, ordinary Office furniture partly submerged at the edges. |
| Tide | 56 s cycle: high 8 s, drain 8 s, low 20 s, rise 8 s, high 12 s. |
| Readable danger | The stone path is physically present throughout. Side terraces descend in 18 cm steps into darker water. A continuous horizontal stain indicates the tide's reach. |
| Consequence | Water deeper than 0.65 m slows and lowers the player, adds water sounds and mild interference; after 1.8 s the player returns to the last dry refuge. No death or lost inventory. |
| Restraint | No revealed creature, jumpscare, explanatory signs, extra UI or global pursuit change. |

The low-water interval comfortably permits one stage of the crossing. Players
who remember the route can continue through high water, with a modest wading
slowdown. Waiting in any refuge remains safe indefinitely. The initial high
water gives an arriving player time to observe before the first drawdown.
At low tide the whole basin is shallow enough to explore. The danger comes
from water rising around the player, rather than from standing on an arbitrary
floor tile; the raised path and islands remain safe throughout the cycle.

## Implementation

- `flood-mark-layout.js` is pure data and phase logic. It owns the exact floor
  cells used by rendering and controller floor-height queries. Adjacent floor
  heights change by at most 0.18 m, below the player's 0.26 m step limit.
- `flood-mark.js` exports `buildFloodMark(c)`. It uses the existing shell,
  batched geometry, baked lighting, catalogue props and generated foley.
  The short side rails have matching retained collision; each island's north
  and south approaches remain open.
- The water is one opaque, gently rippling surface with baked lighting and
  restrained fluorescent glints. It conceals the route by height, not through
  a collider swap. There is no reflection camera or new lighting system.
- The clock advances only while the player is inside and active. Leaving
  clears local exposure and player slowdown/sinking effects. Checkpoints are
  obtained only inside a dry platform, away from its lip.
- `roomRuntime.floodMark` exposes plan, time, phase, checkpoint, exposure and
  recovery count for inspection. `setTime(seconds)` allows review at low or
  high water; it adds no in-game controls.

## Inspiration

The starting points were the submerged, empty architecture of
[Level 37](https://backrooms.fandom.com/wiki/Level_37) and the depth uncertainty
of [Level 7](https://backrooms.fandom.com/wiki/Level_7). This room's tide,
traversal layout and nonfatal checkpoint mechanic are original workshop
choices. Geometry, texture patterns and sounds are generated locally; no wiki
prose, audio or images are included.

## Review

Run `node --test test/flood-mark.test.mjs`. Tests cover phase continuity, stable
floor geometry, stair-height limits, a full-width route and dry refuges across
three supported room sizes, deterministic exposure, and serializable plans.
Browser review should check both water extremes, traversal through all three
islands, a deliberate deep-water recovery, exit/return behavior and absence of
runtime no-trap fallbacks. This is a candidate for Fable's review, not a change
to production encounter frequency.

The seed-713 browser check after adding rail collision found 25,146 reachable free floor cells,
reachable entrance and exit, no disabled colliders and no fallback warnings.
The actual controller completed the full route in both directions across 18
waypoints with no recoveries, visiting the far and near checkpoints. A
deliberate deep-water test returned the player to the acquired second island;
leaving the room cleared slowdown and sinking. No runtime errors were reported.
After the depth-rule refinement, the controller remained on a deepest terrace
for three seconds at low tide with no exposure or recovery. Raising the same
location to high water triggered exactly one return to the second island.
