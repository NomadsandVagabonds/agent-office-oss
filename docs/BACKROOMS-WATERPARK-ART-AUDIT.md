# Waterpark: quality pass before release

15 November 2026 · `codex/waterpark-art-pass`, following the technical integration in `819f8cd`.

**The deck is a prototype, not a release candidate.** Passing navigation and water tests means it can be reviewed safely; it does not establish that the geometry, assets, pacing or atmosphere meet BlockRooms' standard. Keep `waterpark.dealt:false`.

## Direction

Build a worn indoor leisure centre that the office has swallowed. Ceramic has grout and chipped edges; painted walls have tide marks; fiberglass has seams and collars; rails have mounts; towels sit in usable carts. Most of it should be ordinary, repetitive and quiet. The impossible event needs that ordinary setting to be disturbing.

The recurring problem is not lack of props. The original set repeats a bright blue tiled box, a uniformly lit acoustic ceiling and luminous water, then adds several competing curiosities. Adding a monster or another stack does not fix the space. The lazy river's static browser view makes this particularly clear: neon-looking water lines, symmetrical ring towers and murals compete with the fused lifeguard.

Keep the house's faceted voxels and office furniture. Avoid turning every room into either a new theme-park attraction or an equally dark dungeon. Approximately 60–80% of the route should remain quiet connectors, including dry approaches, changing corridors, wet service passages and repeated shower bays. They need believable construction, not a unique puzzle each.

## First implementation: Flume Knot

- Solid fiberglass replaces transparent tube shells. Rounded junction chambers replace square cages, retaining the measured crawl paths.
- A restrained mustard, teal and oxblood palette replaces the rainbow. Scratches and mineral wear are procedural; no image dependencies.
- Cream ceramic dado, stained plaster, a high old waterline, service pipe clamps, coping drains and stair tread inserts establish a constructed place.
- Working and dead fluorescent fittings replace the blanket light layout. The lower service light and far gallery are subdued; the water ribbon no longer lights itself.
- An abandoned catalogue desk/CRT and a dirty towel cart connect it to the office. The cart registers with the existing trolley grab system.
- The giant sixteen-ring/noodle tower and three competing murals are removed. A few stored rings remain. The upward flume and boat are the main impossible image.
- The enemy-mechanic sign is replaced by a worn ordinary flume notice. No creature strategy is explained on the wall.

This is an initial art direction pass, not a claim that the slide is finished. The entrance view was inspected in Chrome. Close-up tube seams, the moving boat's reset, and the lower hall still need a continuous visual playthrough; native browser input was interrupted by activity in another Chrome window. Controller tests cover traversal separately.

## Room decisions

The following is an authoring/source audit, supplemented by browser views of the Flume Knot and lazy river. The shower review landed against a partition; that is insufficient evidence of its full composition. None of these rows represents a completed visual playtest of all seeds.

| Room | Keep | Work before release |
| --- | --- | --- |
| Flume Knot | Suspended crawl maze, split upper/lower routes, upward flume | Finish close-up shell seams, slide entry/exit framing, creature readability in opaque tubes, landing camera and sound. Current branch starts this work. |
| Return Pool | Repeated changing tunnel, overhead pool, circulation valve, hotel details | Use as a spatial reference, not an automatic pass. Verify the fold without instructions, both approaches, wet/dry lighting and silhouettes beneath the overhead water. |
| Surge Basin | Warning–surge–refuge rhythm and sloping beach | Rebuild the rectangular crest as a faceted water front with moving foam. Give caissons depth and a convincing warning sequence. Make shelter readable before the first hit. |
| Lazy River | Circulating canal and chair/lifeguard creature | Rebuild the space around partial views of the island. Remove duplicate visual spectacles and reduce water-pattern contrast. Make its silhouette readable before its transformation; check current and escape cues. |
| Diving Well | Submerged partition and air pocket | Build depth through attenuation, lane markers, submerged furniture and surface reflections. Avoid an evenly illuminated aquarium. Resolve the per-player swim support contract before co-op. |
| Drain Spa | Reversible current and tempting drain descent | Cut the simultaneous hanging furniture, ring tower, multiple siphons and murals to one dominant anomaly. Establish normal pump hardware and worn hydrotherapy fittings first. |
| Toadstool Lagoon | Child-height scale and apparently occupied floats | Finish the mushroom, quieter pool edges and approach. Reduce the number of visual gags; give a few floats credible motion and danger. Wire the richer snip rules before claiming the encounter complete. |
| Locker Showers | Repeating stalls, steam and mixing valves | Make an actual changing suite: benches, drains, lockers, pipe runs and wet/dry transitions. Show the valve's consequence through steam and hardware. Avoid putting every oddity in every bay. |
| Plain connectors | Repetition, lost bearings, occasional low/high openings | Highest shared priority after the feature-room benchmark: replace the universal blue skin with a small repeated architectural kit. Most have no creature or spectacle. Keep recognisable navigation shapes, but vary maintenance state, headroom and sound. |

## Release bar

1. Walk the whole route at player eye level: every doorway, low opening, edge, water transition and exit. No repair flattening, paper-thin solids, flickering surfaces or surprise invisible barriers.
2. Inspect each asset close enough to grab it. Consistent voxel scale, deliberate materials, appropriate pivots, and shared movability for shared furniture.
3. Each feature has one readable interaction and one principal unsettling image. Test with someone who has not read its code or review notes.
4. Listen through a complete visit. Water, warning signals, room reverb and silence must carry information; current screenshots were reviewed muted.
5. Verify creature damage/cooldowns, difficulty, fire, furniture and journal integration. Pure-rule tests alone do not prove the live room wiring.
6. Verify two players, shared valves, slides, fold state and independent swimming before co-op exposure. This branch remains a single-player study.
7. Measure frame time and transparency cost on an ordinary laptop, including adjacent active rooms. No performance claim from successful compilation.

A smaller release of a few finished features and convincing repeated connectors is preferable to enabling the entire draft deck. Suggested next order: connector kit, Return Pool finishing pass, Surge Basin rebuild, then the remaining rooms individually.

## Validation of this pass

The focused 53-test waterpark set checks real-controller traversal in four slide rotations, automatic crouch, dry upper tubes, lower landing and escape, last-floor fallback, supported supplies and generated floor reachability. Render attributes are now checked for finite values independently of navigation. These checks are technical evidence, not an art-quality score.

Results: 53/53 focused tests pass; static production build passes (292 files). Full suite remains 979/982, with the same three unrelated Office failures recorded in the integration note: the `/var` versus `/private/var` console path check and its parent, plus the usage/status-line undefined `source`. The subsequent junction/dado adjustments were rechecked with the focused set and rebuilt. No branch was pushed and nothing was deployed in this pass.
