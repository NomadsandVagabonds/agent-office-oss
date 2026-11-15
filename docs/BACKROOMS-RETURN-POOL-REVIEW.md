# The Return Pool — waterpark room study

Branch: `codex/backrooms-return-pool`

Based on working branch `92f7d9d`. This is a separate contribution, not a replacement for Gemini's waterpark. No files were changed in Gemini's active worktree and none of its uncommitted waterpark infrastructure is required.

## What I took from the waterpark review

Gemini has a coherent leisure-centre palette, seven rooms, underwater offices, tangled crawl-tube slides, and a lifeguard stand that becomes a creature. That offers a strong movement/creature wing. This study adds a quieter spatial puzzle: a pool that physically returns the visitor to the same end until its circulation is corrected.

## Play it

Local review server: `http://127.0.0.1:44347/?room=return-pool&count=7&pursuer=0&mute=1&poolstudy=1&vhs=1&seed=17`

The dev page also supports `?room=return-pool&poolstudy=1` on an ordinary office dev server. Remove `poolstudy=1` for an unobstructed playthrough. The study buttons teleport to review positions; **Turn valve** calls the actual room interaction, and **Enter water** invokes no damage itself. It positions the visitor where the real wake can reach them.

The room is `planned:true` with `themes: { '*': 0 }`. Thus it does not change live visit balance or the number of rooms a visit draws. It can be explicitly requested through `only`/the dev room selector. After the other team's theme lands, add its `waterpark` affinity and remove `planned` when ready for automatic dealing; keep it excluded until integration and playtesting.

## The encounter

- Shallow tiled pool inset into an office: wallpaper, suspended fluorescent fixtures, damp carpet, submerged catalogue desks and CRTs, and cubicle dividers.
- A second pool hangs upside down above it. Its tiled floor and inverted workstations are real geometry behind an animated water surface. Water and little bubbles flow upward between the pools.
- Identical changing tunnels at either end. Walking forward through the far tunnel folds position back to the near one, retaining bearing and lateral position. The return is inside the tunnel. Walking back toward the entrance always remains possible; entering through the back door does not immediately fold you.
- The wheel in the flooded office takes three quarter turns, at least 1.8 seconds apart. Its three indicators rise/light as it turns. The third turn reverses water animation and stops the fold, leaving a normal route behind the far partition to the room's back door.
- A wake surfaces at the far end after entering the deeper water. A 1.5-second ripple warning precedes pursuit at 1.7 m/s. A submerged, long-fingered silhouette is only partially visible during pursuit.
- Contact calls the shared `health.damage` path via `c.hurt(1)`. A 2.5-second local recovery also prevents repeated hits. Dry coping and the stepped central plinth stop the encounter. Wading slows walking to 67%.

No item is required to solve the room. All basin edges and the central plinth use 15 cm steps with matching rendered geometry and floor heights. The ordinary room navigation validator can reach the valve, refuge and both doorways without disabling colliders or flattening the room.

## Files and integration

- `public/world/backrooms/rooms/return-pool.js`: geometry and engine hooks.
- `public/world/backrooms/rooms/return-pool/rule.js`: layout, floor heights, fold, valve and wake state; no renderer dependency.
- `public/world/backrooms/rooms/return-pool/art.js`: procedural tile/water textures, lit animated water, valve, furniture fallback and wake rig.
- One appended deck entry; one dev-only study import and selector.
- `test/backrooms-return-pool.test.mjs`: rules plus actual world/controller integration in four rotations and minimum/maximum room sizes, with both real catalogue furniture and fallbacks.

No new dependencies, downloaded textures, physics engine, reflection render targets or shadow maps. Water uses the existing lit material, with room-local shader time for UV movement. Its normal flashlight support remains. Geometry is built once; each frame updates transforms and uniforms. Resources belong to the kit for disposal.

## Validation and limits

- Six room tests pass: directional folding, reversal, warnings/recovery, actual health calls, room navigation and real player movement down/up steps.
- Room plus visit-planning tests: **35/35 pass**. Review-only registration does not alter ordinary room-count planning.
- Production static build passes.
- Full suite: **931/934 pass**. The three reported failures are the existing console temporary-path mismatch (`/var` versus `/private/var`, including its parent test) and the usage/status-line bridge reading an undefined `source`. No Backrooms tests fail.
- Browser playtest: walked through the fold (lap count incremented), turned the actual wheel three times, observed real damage and recovery, stood on the dry refuge, and crossed the return threshold after reversal without another fold. Inspected upper/lower water, furniture and the wake. The final tile-UV/hand silhouette polish was checked in code/tests after that visual pass.
- Sound was muted during the browser pass. It reuses positional `wade`, `rattle` and `thunk`; ambient water audio is still a useful next pass.
- Single-player prototype. The wheel and wake are room-local state; shared two-player authority/snapshots need integration before dealing this in co-op. It is deliberately not registered as a new collectible cast entry yet.
- No mobile hardware or GPU performance benchmark yet. No new full-screen effects or additional scene render passes.

## Good companion rooms for this wing

1. **The Ninth Landing:** a tiled stairwell with a flume running upward beside it. Descending repeatedly reaches the same wet landing; riding the upward water reaches the office whose ceiling you could see through the pool. Quiet navigation puzzle, no extra enemy.
2. **The Breath Budget:** a submerged records corridor with little dry air bells made from suspended office ceilings. Its route is visible through observation windows before entering; opening one sluice drains an air pocket while filling another. Deliberate route planning rather than an opaque oxygen timer.
3. **The Attendance Lane:** several parallel swimming lanes through open office doorways. A wake shadows the wrong lane. Crossing lane ropes changes which doorway is real, while the empty lifeguard booth tracks your position. Keep the room's population to that one suggestion of a swimmer.
