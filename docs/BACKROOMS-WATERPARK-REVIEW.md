# Waterpark integration and Flume Knot repair

Branch: `codex/waterpark-integration`.
Base: Fable's `claude/determined-maxwell-ayvlut` at `6829692`.

This brings Gemini's unfinished waterpark onto the working branch, with Codex's Return Pool and its movable towel carts. Gemini's original checkout is untouched. Its uncommitted work was snapshotted to `/tmp/blockrooms-waterpark-handoff-20261115` before importing only the aquatics files. The unrelated forest work is not part of this branch.

## Review build

The eight-room deck is available only when `waterpark` is explicitly selected. The theme remains `dealt:false`; ordinary visits do not receive it. A visit draws a selection from the deck, with repeated tiled corridors between features. It does not put all eight landmarks into each part.

- Whole visit: `http://127.0.0.1:44348/?themes=waterpark,waterpark,waterpark&depths=3&pursuer=0&mute=1&waterstudy=1&seed=waterpark-1&vhs=1`
- Slide room: `http://127.0.0.1:44348/?themes=waterpark&depths=1&room=slide-maze&pursuer=0&mute=1&waterstudy=1&seed=17&vhs=1`
- Return Pool: use `room=return-pool&poolstudy=1&themes=waterpark` on the dev page.

The whole-visit seed has 24, 28 and 21 rooms: Locker Showers and Return Pool; Wave Pool; then Diving Well and Flume Knot. Other seeds draw Lazy River, Drain Spa and Toadstool Lagoon. `pursuer=0` disables the ordinary roaming cast for review, not the rooms' own hazards. Remove the study flags for ordinary controls. Health and camera power are real; Escape pauses. C dives, Space surfaces, E uses. Study buttons only reposition the visitor; the normal E interaction starts a slide.

To reproduce the local staging without dependencies:

```sh
node --input-type=module -e "import {stage} from './tools/backrooms-sample/stage.mjs'; import fs from 'node:fs'; stage('/tmp/blockrooms-waterpark-review',{three:true}); fs.copyFileSync('public/world/dev/backrooms.html','/tmp/blockrooms-waterpark-review/index.html'); fs.cpSync('public/world/dev','/tmp/blockrooms-waterpark-review/world/dev',{recursive:true});"
node tools/blockrooms/serve.mjs /tmp/blockrooms-waterpark-review 44348
```

## Repairs and integration

- Flume Knot's crawl-tube footprint no longer overrides the boarding stairs. The actual player can climb in, automatically crouch, walk the tube network and descend the far stairs.
- The upper tubes and flooded sump use explicit room state. Querying another floor position cannot silently change which floor the visitor occupies. Walking in an upper tube no longer counts as swimming in the water underneath it.
- `player.setRidePose()` gives an authored slide temporary ownership of the camera. Gravity, collision escape and ordinary bob no longer fight the ride. Releasing the pose restores normal walking. Both the plunge and Drain Spa use this contract.
- Plunge and bailout rides land in the lower hall. The sump hatch returns to a clear point on the dry gallery. The abyss slide descends when another part exists and safely returns to the gallery on the last part.
- Drain Spa offers its drain only where descent exists and releases the camera if interrupted.
- Tube-toner and lifeguard strikes respect furniture between them and the visitor.
- Draft almond-water/quarter rewards were replaced with supported supplies. The slide has a battery on the lower island; the lagoon has three sheets of paper; the spa has a battery on its submerged bench.
- Current generator, movement, supplies and inventory code are retained. Only the waterpark palette, cabana vocabulary, dressing hooks and deck entries were ported from Gemini's older base.

The review deck is: Return Pool, Flume Knot, Surge Basin, Lazy River, Diving Well, Drain Spa, Toadstool Lagoon, and Locker Showers. No dependencies or binary assets were added.

## Validation

`node --test test/backrooms-waterpark-integration.test.mjs test/backrooms-waterpark.test.mjs test/backrooms-return-pool.test.mjs`: **53/53 pass**.

These cover each builder and doorway, all four slide rotations, real controller traversal/auto-duck, slide landing and sump escape, last-floor abyss fallback, deep diving/surfacing, interrupted drain cleanup, supported rewards, and complete generated waterpark floors. No tested room needs collision removal or geometry flattening to satisfy navigation. Separate pure rules tests cover water, currents, waves and creature states; these are not a claim that every draft rule has been wired into its room.

Chrome visually loaded the slide room with its overhead flumes, tube network and lower hall. Browser input automation was interrupted, so the complete ride/escape verification is through the real-controller integration tests, not a claimed uninterrupted manual playthrough. Production static build passes (291 files).

Full suite: **979/982 pass**. The three failures are the existing Office console temporary-path mismatch (`/var` versus `/private/var`, including its parent test) and usage/status-line bridge reading an undefined `source`. No Backrooms tests fail.

## Before public dealing

This is a single-player review package. Do not enable `dealt:true` for public/co-op visits yet. Room switches, rides, creatures and the Return Pool fold need the shared-state contract; in particular deep swimming currently changes the basin's support height for the local swimmer. Creature journal metadata, fire responses, physical skimmer/furniture behavior, difficulty tuning and mobile GPU costs also need a pass. The lagoon's richer snip rules exist as tested draft logic but are not wired into its current room animation. Sound was muted for visual review.

Keep Gemini's geometry and art direction; subsequent polish can bring the brighter areas down, replace literal key instructions on room signs with in-world clues, and tune creature density without crowding the quiet connectors.
