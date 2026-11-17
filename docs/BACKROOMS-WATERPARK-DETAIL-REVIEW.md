# Waterpark construction and prop pass

Branch: `codex/waterpark-detail-pass`.

Based on the integrated waterpark, Bellmouth and Hanging Changing Rooms, merged with Fable's working branch through `2991be2` (merge `75e756e`). This is a local art review. The waterpark remains `dealt:false`.

## What changed

The ten feature rooms have stronger structural silhouettes and more credible close-up fittings. The older six rooms use aged ivory ceramic walls instead of the blue wallpaper shell. Quieter stretches and existing routes remain open. No renderer, player, swimming, floor or collision contract was changed.

| Room | Added construction and dressing |
| --- | --- |
| Hanging Changing Rooms | Ceramic edge caps that follow the raised slab ends, suspended service pipes and brackets. Authored lights reduced to 14 so generated doors have room. |
| Bellmouth Baths | Radial vault ribs and hardware, inner ceiling ring; eight ring lamps, 14 authored lights total. |
| Flume Knot | Stepped overhead ribs, wallside supply pipes, joints and bolted collars on the flumes. The walkable bore is untouched. |
| Return Pool | Vented underside panels on the inverted pool, structural ribs, rebuilt towel-cart castors and folded/striped cloth. |
| Surge Basin | Pressure necks and flange collars above the caissons, crossbars on the grilles, trusses, and a curled wave profile with a broken foam lip. |
| Lazy River | Large circular coffer with an offset inner ring. One crooked faded float tower replaces three symmetric towers; one mural replaces two. |
| Diving Well | Bolted bulkhead seams, submerged pipework, overhead frames. The front sign remains clear of the seams. |
| Drain Spa | Nested square ceiling coffers compressing the circular basin, suspended pipework, flume collars. |
| Toadstool Lagoon | Offset nested canopy rings, rods, repaired mushroom neck and underside nozzles. |
| Locker Showers | Cross-lane manifolds, flanges, hanging supports and drain grilles. |

Shared props now have lounger hinges, rubber feet, reclining racks, ladder flange bolts, tread grooves and locker vents/hinges/folded towels. Basin edges have segmented ceramic bullnose and flush drainage returns.

## Inflatable rings and inverted bathers

The old ring used the final `Vox.cyl` argument as if it cut a hole; that argument tapers the cylinder. The result was a solid disc. `innerTubeVox` now models an actual torus with an open bore, rounded sides, underside shading, a welded seam, handles, valve and repair patch. Static stacked/ceiling copies use the same corrected asset.

`makeInnerTube` adds separate left/right leg groups to moving occupied floats. Each has a bent knee, trouser fold, sock, cuff, shaped shoe and tread. Small asynchronous sways and occasional twitches run at rest; the lagoon's existing startled state drives larger kicks. Lazy River and Drain Spa also animate their occupied floats. This does not add attacks or change the hazard trajectories. Stacked decorative bathers remain static.

## Review

The development-only `finishstudy=1` panel offers all ten rooms, three camera positions, a bather close-up where applicable, a hardware-detail toggle and geometry counts. H hides it. The ordinary game build does not include this panel.

Local review URL:

`http://127.0.0.1:44351/?themes=waterpark&depths=1&room=kiddie-lagoon&only=kiddie-lagoon&pursuer=0&mute=1&seed=17&vhs=1&inventory=0&finishstudy=1`

Reproduce without dependencies:

```sh
node --input-type=module -e "import {stage} from './tools/backrooms-sample/stage.mjs'; import fs from 'node:fs'; stage('/tmp/blockrooms-waterpark-detail-review',{three:true}); fs.copyFileSync('public/world/dev/backrooms.html','/tmp/blockrooms-waterpark-detail-review/index.html'); fs.cpSync('public/world/dev','/tmp/blockrooms-waterpark-detail-review/world/dev',{recursive:true});"
node tools/blockrooms/serve.mjs /tmp/blockrooms-waterpark-detail-review 44351
```

Safari visual checks covered all ten rooms, the moving crest, open tube centres and independently moving feet. Sound was muted. This is not a claim of a complete manual playthrough or mobile performance validation.

## Budgets and validation

`pool-finish.js` stores small hardware in one separately named `waterpark-detail` mesh per room. Major structural geometry stays in the ordinary batches. `userData.detail` is an accounting/review marker, not a renderer feature or quality switch. Added geometry is deterministic and consumes no room RNG.

The integration tests check actual mesh/triangle/light counts both in the two direct room sizes and in generated layouts. All tested rooms remain under the ordinary 120k base / 250k combined allowance, 45 base + 12 detail meshes, and 16 lights. Largest tested base: Lazy River at 91,000 triangles; highest mesh count: Return Pool at 40 + 1. Animated legs are included in these counts. Counts cover room geometry, not every independent scene/cast object or an FPS guarantee.

- `node --test test/backrooms-waterpark-integration.test.mjs`: **48/48 pass**. Includes real-controller traversal, ducking, water, slide exits, generated door reachability, mesh budgets, open ring geometry and independent foot motion.
- `node tools/blockrooms/build.mjs /tmp/blockrooms-waterpark-detail-build`: passes, 342 files.
- `git diff --check`: passes.
- Full `npm test`: **1,069 / 1,076 pass**. Seven failures remain: four Return Pool cart-placement assertions, the console `/var` versus `/private/var` assertion and its parent, and the usage/status-line `source` failure.

The four Return Pool failures were reproduced in a clean detached worktree at the unchanged merge base `75e756e`. Current lead furniture rules reject an authored object's change of elevation; the older test expects a trolley to be set down from the bank into the basin. This pass retains the lead's furniture rules. The console/status-line failures are the same ones recorded in the earlier integration review. They are not hidden or marked as passing.

## Still to review before release

The owner asked to continue asset/design work while the water and lighting upgrades are unfinished. Those changes are not folded into this branch. The current bright water caustics, translucency and lighting are still the older renderer; reassess material contrast and contact shadows when the new work lands. The ring/foot changes can be reviewed independently now.

The existing integration review's multiplayer, creature-contract, difficulty and mobile-GPU caveats still apply. This pass does not enable public dealing or claim that every older room has finished its gameplay and art review. The Return Pool elevation/drop contract also needs a deliberate resolution with the furniture lead before release.
