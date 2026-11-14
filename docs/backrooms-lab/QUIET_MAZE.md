# Quiet maze study

An optional authoring preview for the ordinary space between encounters. Nine
large, similar rooms repeat three wall arrangements. Two physical return loops
let the player approach a familiar-looking space from another direction.

This is a finite study, not a new oddity in the deck and not an implementation
of the proposed 60–80% pacing target. It provides room geometry for Fable to
assess alongside the existing set pieces.

## Design card

| Aspect | Implementation |
| --- | --- |
| Role | Ordinary maze space that works without an encounter. |
| Scale | Nine adjoining 12 × 12 m rooms, with ordinary 2.6 m ceilings. |
| Repeated vocabulary | Staggered walls, short L returns, offset junctions and empty side bays. Each motif appears three times. |
| Look | One tired yellow wallpaper family, matching carpet and skirting, one repeated fluorescent grid. The existing room renderer supplies all materials and baked lighting. |
| Navigation | Offset ordinary openings and obstructed sightlines; real routes around partitions and two loops between rooms. |
| Restraint | No occupants, collectible, puzzle, labels, directional signs, soundtrack cue or scripted reveal in the quiet rooms. |
| Exit | The existing exit door in a separate annex. |

Small architectural differences should be difficult to place. They should not
become nine distinctive silhouettes. The empty bays are intentional; adding a
reward, chair or anomaly to every one would make them reliable landmarks.

## Preview

Run the existing static preview from this checkout:

```sh
node tools/backrooms-offline/preview.mjs --port 44324
```

Open:

```text
http://127.0.0.1:44324/world/dev/backrooms.html?study=quiet&seed=713&vhs=2&mute=1
```

Use the normal walking controls. `vhs=0` gives the clean inspection view;
`room=0` through `room=8` selects a quiet room and `room=exit` selects the annex.
The seed changes the repeated motif orientations and shared material family
variation. The study ignores pursuer, loot and normal deck options.

## Integration footprint

- `quiet-maze-layout.js` defines reusable partition footprints and inspection
  points as pure data. The existing plain-room builder renders them as
  wallpapered, skirted walls with solid collision.
- `quiet-study.js` assembles the optional connected fixture. It borrows visit
  metadata from the normal generator without mutating that generator's result.
- The standalone dev page opts in with `study=quiet`. A debug-only level
  factory hook in `index.js` supplies the fixture; normal visits still call the
  existing generator unchanged.

There are no new dependencies, textures, timers or moving objects. Neither
`gen.js` nor the oddity deck changes. Fable can reuse individual wall layouts
without adopting the fixture's graph, room size or frequency.

## Review criteria

Automated checks should cover seeded repeatability, reciprocal doorway
geometry, connected room loops, clear doorway approaches and reachable floor
space at the player's radius. Inspect the built scene as well: a warning that
disables a wall's collision is a failure even if the player can then get out.

Compare eye-level views from several rooms in both VHS and clean presentation.
Walking a loop should produce uncertainty about place through architectural
repetition. Connectivity and floor area alone cannot establish that effect;
it needs human playtesting. Record that feedback before proposing production
generation weights or exit-distance changes.

## Verified in this prototype

- 28 focused tests pass, including the existing generator and voxel checks.
  The layout flood tests cover 300 combinations of room size, motif and turn.
- Browser builds for seeds 713, 22 and 41 have reachable doors and floor
  probes, no isolated walkable cells, no disabled partition colliders and no
  fallback warnings.
- The actual player controller completes both return loops across 14 room
  transitions. The normal exit interaction completes the visit.
- The normal Dispatch preview still builds and its crate route remains
  reachable. No browser runtime errors were reported in these checks.

These establish traversal and integration, not how disorienting a person will
find the study. Eye-level comparisons show the intended repeated architecture;
that experience is ready for playtesting.
