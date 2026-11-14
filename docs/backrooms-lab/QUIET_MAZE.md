# Quiet maze study

An optional authoring preview for the mostly static space between encounters. Nine
large, similar rooms repeat three wall arrangements. Two physical return loops
let the player approach a familiar-looking space from another direction.

This is a finite study, not a new oddity in the deck and not an implementation
of the proposed 60–80% pacing target. It provides room geometry for Fable to
assess alongside the existing set pieces.

## Design card

| Aspect | Implementation |
| --- | --- |
| Role | Repetitive maze space that works without an encounter; generic need not mean normal. |
| Scale | Nine adjoining 12 × 12 m rooms, with ordinary 2.6 m ceilings. |
| Repeated vocabulary | Staggered walls, short L returns, offset junctions and empty side bays. Each motif appears three times. |
| Look | One tired yellow wallpaper family, matching carpet and skirting, one repeated fluorescent grid. The existing room renderer supplies all materials and baked lighting. |
| Navigation | Offset ordinary openings and obstructed sightlines; real routes around partitions and two loops between rooms. |
| Static anomalies | Two copies of a partition with misplaced openings, and two copies of a half-buried workstation. Five rooms retain the bare architecture. |
| Restraint | No occupants, collectible, puzzle, labels, directional signs, soundtrack cue or scripted reveal in the quiet rooms. |
| Exit | The existing exit door in a separate annex. |

Small architectural differences should be difficult to place. They should not
become nine distinctive silhouettes. Static anomalies repeat too: seeing a
buried desk cannot reliably identify which room the player has entered. The
four-of-nine composition demonstrates the idea; it is not a proposed global
generation frequency.

The two cut-out partitions each have a 1.2 m-wide opening at carpet level,
0.85 m tall, and a second opening at 1.7–2.3 m. These are real holes into the
same room, with matching headroom under the low header. The normal paths
around both wall ends remain available; the low opening is an optional
crouch shortcut. There is no interaction prompt or event.

The two workstations use the Office's actual desk, CRT, keyboard, mouse and
chair. The entire arrangement is lowered 0.40 m through continuous carpet,
retaining normal proportions and relative placement. It stays still, uses
the room's ordinary lighting, and provides no item or interaction.

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
The seed changes the repeated motif orientations, shared material family
variation and which two matching bays receive the submerged workstation.
The study ignores pursuer, loot and normal deck options.

## Integration footprint

- `quiet-maze-layout.js` defines reusable partition footprints and inspection
  points as pure data.
- `quiet-details.js` defines static wall cuts and the buried furniture plan.
  `quiet-room.js` uses the existing shell, pillar and catalogue-prop APIs to
  render them, with collision and headroom that match the visible geometry.
- `quiet-study.js` assembles the optional connected fixture. It borrows visit
  metadata from the normal generator without mutating that generator's result.
- The standalone dev page opts in with `study=quiet`. A debug-only level
  factory and builder override in `index.js` supply the fixture; normal visits
  still call the existing generator and builders unchanged.

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

## Initial bare-layout verification

- 28 focused tests pass, including the existing generator and voxel checks.
  The layout flood tests cover 300 combinations of room size, motif and turn.
- Browser builds for seeds 713, 22 and 41 have reachable doors and floor
  probes, no isolated walkable cells, no disabled partition colliders and no
  fallback warnings.
- The actual player controller completes both return loops across 14 room
  transitions. The normal exit interaction completes the visit.
- The normal Dispatch preview still builds and its crate route remains
  reachable. No browser runtime errors were reported in these checks.

These establish traversal and integration of the initial bare layouts, not how
disorienting a person will find the study. Eye-level comparisons show the
intended repeated architecture; that experience is ready for playtesting.

## Static-detail verification

- 33 focused tests pass across the layout, study, static-detail, generator and
  voxel suites. The added checks cover the actual opening volumes, native prop
  bounds and placement, clearance, immutability and builder fallbacks.
- Browser builds for seeds 713, 22 and 41 retain reachable doors and floor
  probes, no isolated walkable cells, no disabled colliders and no fallback
  warnings. Each sunken workstation renders all five native props.
- The actual player controller crawls through both low openings in both
  directions for each seed: 12 successful crossings. The high openings remain
  blocked at floor level, matching their visible sill.
- All nine quiet rooms have no interaction targets or tick callbacks. The
  normal exit still completes the visit; the normal Dispatch preview still
  builds with a reachable crate route and no runtime errors.
- Eye-level screenshots confirm open cutouts and full-size Office furniture
  occluded by the carpet, with the existing palette and lighting.

This refinement remains an opt-in study. Its ability to confuse human spatial
memory still needs playtesting before changing production generation weights.
