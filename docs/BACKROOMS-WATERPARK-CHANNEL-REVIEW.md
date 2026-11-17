# Waterpark: Lane Archive and Narrowing Bays

Branch: `codex/waterpark-channel-hall`, based on `b70b49c` (`codex/waterpark-detail-pass`). This extends the ten-room waterpark review wing to twelve rooms. The theme remains `dealt:false`; this is not a public release. It does not depend on the pending renderer upgrades or merge the newer working branch.

## The Lane Archive

An 18 × 26–28 m hall, almost eleven metres tall. Shuttered office windows repeat above a sunken swimming lane. Offset galleries, a high diagonal stair, deep ceramic soffits, corbels and suspended fittings make the office proportions disagree. The palette is aged ivory, dull green, oxidised metal and faded red plastic.

- Enter under a low vestibule and emerge into the central void. Both dry banks lead to the opposite vestibule and join at each end, making a reversible circuit.
- Shallow 16 cm steps descend into the lane. The central inspection plinth holds the room's seeded supply, when supplied. This is an optional reason to leave the dry route; no key, pump use or encounter is required to exit.
- Every bank and the plinth can be climbed back onto. The visible treads and collision floor use the same height function. A second visitor's floor queries cannot change the local player's elevation.
- The circulation pump is operated with the usual E interaction from dry ground. It runs for twelve seconds, with sixteen seconds between starts. Its handle moves, the submerged outlet bubbles, and water/rattle sounds locate the disturbance.
- The dirty towel cart uses the ordinary furniture grip and barricade system. A catalogue chair and desk remain recognisable office props. Bolted slat benches are visibly fixed.

The upper galleries and diagonal stair are **inaccessible scenery**. They have no reachable stair entrance. This prototype keeps a single floor height per X/Z position; it does not pretend to solve stacked walkable floors or portals.

## The Lane Keeper

A lane-divider rope with a swimming cap, empty goggles and long hands at its leading end. Eight ribbed floats follow its travelled path; the head, hands and floats bob independently. Float spacing is measured in distance, so a lower frame rate or a faster chase cannot stretch its body.

- Drifts along the lane until sustained movement in the water attracts it. About 1.35 seconds of splashing arms the chase; merely entering the room does not.
- Stillness for 1.6 seconds settles it. Dry banks and the plinth are safe; it cannot hit a visitor in the air above it.
- The running pump takes priority and draws it toward the visible outlet, by swimming there rather than resetting its position.
- Contact asks the existing health system for one damage, then gives the creature a 2.8-second recovery window. The shared health cooldown still applies. Furniture blocks both its movement and its attack trace.
- It records the encounter and an escape through the existing run hooks. Wall sketches show the cap, float body and crossed-out feet; their unfinished words hint at stillness and the pump. Drawings are only placed where the resident exists on that part or the next.

Its pure rule is in `rooms/channel-hall/rule.js`; the model, pump, shutters and bolted bench are reusable builders in `rooms/channel-hall/assets.js`. There are no added dependencies, binary assets or network calls.

## The Narrowing Bays

A quiet 10 × 18–20 m changing passage. Four real ceramic frames diminish along one sightline while hooks, tiles and other familiar details keep their normal scale. The last opening forces automatic crouching. Parallel passages wrap around the sequence and rejoin at both ends; the eastern one provides a clear standing route. Thin wet channels, drain grilles and repeated lighting connect it visually to the larger baths.

No resident, surprise damage, teleport or mandatory interaction. This is the deliberately ordinary space between larger encounters.

## Local review

Hall:

`http://127.0.0.1:44352/?themes=waterpark&depths=1&room=channel-hall&only=channel-hall&pursuer=0&mute=1&seed=17&vhs=1&inventory=1&channelstudy=1`

Connector:

`http://127.0.0.1:44352/?themes=waterpark&depths=1&room=nested-thresholds&only=nested-thresholds&pursuer=0&mute=1&seed=17&vhs=1&inventory=1&channelstudy=1`

`channelstudy=1` adds development-only camera shortcuts and the creature/pump state. H hides the panel. E at the pump uses the real interaction; the panel does not trigger it. `inventory=0` is useful for an untimed art inspection, but disables the health and battery systems.

```sh
node --input-type=module -e "import {stage} from './tools/backrooms-sample/stage.mjs'; import fs from 'node:fs'; stage('/tmp/blockrooms-waterpark-channel-review',{three:true}); fs.copyFileSync('public/world/dev/backrooms.html','/tmp/blockrooms-waterpark-channel-review/index.html'); fs.cpSync('public/world/dev','/tmp/blockrooms-waterpark-channel-review/world/dev',{recursive:true});"
node tools/blockrooms/serve.mjs /tmp/blockrooms-waterpark-channel-review 44352
```

Safari checks covered the hall's entrance and stacked galleries, the narrowed passage, and starting the pump with E (the live state changed to lured). Audio was muted. The Mac locked before the last creature close-up; the final distance-sampled float animation is covered by the runtime test but has not had a final visual pass. This is not a claim of mobile performance or a complete manual playthrough.

## Validation

- Focused room, generation, drawing and creature checks: **124/124 pass**. These include real-controller traversal at all four rotations, automatic crouching, dry and wet recovery routes, health callback/recovery, pump timing, furniture blocking, visitor swaps, frame-rate-independent float spacing, theme isolation and generated-room builds.
- The tested Lane Archive sizes peak at **90,454 base + 3,264 detail triangles**, 32 base + 1 detail meshes, and ten authored lights. Narrowing Bays peaks at **10,876 + 1,016 triangles**, 9 + 1 meshes, and six lights. Generated layouts also pass the established room budget checks.
- Production build: **346 files**, passes.
- Full `npm test`: **1,093/1,100 pass**. The seven failures match the previous detail review: four Return Pool cart-placement assertions, the console `/var` versus `/private/var` assertion and its parent, and the usage/status-line `source` failure. No new failure remains. An earlier run also saw the unrelated harness-wake ordering test fail; it passed on the final full run.
- `git diff --check`: passes.

## Before release

This room resident uses the ordinary room tick/health hooks. It has not been promoted into the shared creature conductor or tested with two networked players; that needs review before co-op dealing. Floor queries are actor-independent, which is tested separately. Difficulty-specific creature speed tuning, mobile GPU profiling and balance over a full visit remain playtest work.

The previous detail review's caveats still apply: water/lighting upgrades are not part of this branch, and the older Return Pool cart elevation/drop mismatch remains unresolved. Keep the waterpark out of automatic public dealing while the integration review continues.
