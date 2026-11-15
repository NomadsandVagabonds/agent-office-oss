# Fluorescent banks — lighting prototype

Branch: `codex/backrooms-lighting`, based on the working branch at `e3a7cab`.
Off by default. This is a first pass for judging atmosphere and flashlight
usefulness before dealing it into public visits.

## Try it

On the normal development server:

`/world/dev/backrooms.html?seed=7&lighting=failing&lightstudy=1&mute=1&vhs=1&pursuer=0`

The local study panel jumps between eligible rooms, switches between both banks
working, one failed, and the seeded cycle, and gives/selects/toggles a real
inventory flashlight. Its two percentages are the actual shader uniforms.
The comparison panel is only on the dev page with `lightstudy=1`; it is not
part of the game's HUD. The battery and normal gameplay clocks still run.

- `lighting=1`: normal distribution, about 70% of eligible rooms unchanged,
  20% failing-bank rooms, 10% with a permanently dim side.
- `lighting=failing` / `lighting=dim`: force that treatment in eligible rooms
  so a reviewer can find examples easily.
- Omit `lighting`: original lighting and camera response.

Only plain rooms with normal/dim lighting and at least two separable live
fixtures qualify. Landings, exits, crawlspaces and authored special rooms keep
their lighting. The lighting RNG is independent: switching the feature on
does not reroll furniture, rooms, creatures or supplies.

## Behavior

Two spatial banks share a room's ceiling. One stays on; the other hesitates,
recovers briefly, goes out for roughly eight seconds, then takes 2.5 seconds
to restart. A cycle lasts 38–54 seconds, with a seeded phase, so the building
is not constantly flashing. The dim treatment keeps one bank at 78% and the
other at 1.5%. Original dead fixtures stay dead.

Tube emission, baked direct/bounced light and moving-object light probes use
the same bank strengths. Bank phases use visit time rather than frame count
or visibility. Room/creature `setLights` effects temporarily override the
banks; resetting to 1 restores the normal bank cycle. Existing flickering
light probes now respect the actual flicker strength too.
The parts visible below/above a way down update their banks without running
their creatures, hazards or room-entry callbacks.

In the prototype, camera gain tops out at 1.65 rather than 2.3, and its weak
automatic lamp is 8% rather than 30% of the flashlight. Exposure and hum follow
the local bank. These are starting values for playtesting, not final balance.

## Cost and limits

This extends the existing bake. Two optional RGB vertex attributes hold each
bank's contribution, with two runtime multipliers. There are no new per-frame
lights, shadow maps or geometry rebuilds. Untouched rooms allocate neither
bank attribute. Bounced light uses proximity to tubes, not a full transport
simulation. Neighboring doorway spill remains baked; this does not add dynamic
shadows or make furniture occlude the flashlight.

A Node build of seed 7's 39 room shells, with the normal distribution, affected
8 rooms: bank attributes occupied 280,896 bytes; total vertex attributes grew
from 2,431,551 to 2,688,411 bytes, and mesh count from 223 to 230. This measures
shell overhead only; it is not a full-game GPU/mobile benchmark. Real-world
mobile frame time and longer flashlight/supply balance need playtesting.

## Verification

Seven lighting tests cover seeded distribution, unchanged layouts, encounter
priority, continuous cycles at different sampling rates, bake reconstruction,
spatial contrast, emissive independence, flicker probes, and actual world
meshes/fixture uniforms. Lighting plus menu/battery-ending tests: 15/15.

Full suite: 714/715. The status-line bridge usage test fails in this environment;
it also fails in a clean archive of base `e3a7cab` (at a different assertion).
The lighting change does not touch that code. The standalone build passes.

Browser checks: working/failed bank comparison, real inventory flashlight
on/off, and the cycling bank readout. No shader errors were reported.

## Next decisions

Judge how dark the failed side should be and how often it should appear before
adding emergency lighting. The same bank system can later support a corridor
outage or an authored breaker, while rare emergency fixtures would need a
separate colored contribution and a reduced-flashing setting. Those effects
are not part of this prototype.
