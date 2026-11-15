# The Last Light

Review branch: `codex/backrooms-last-light`.
Base: Fable's `c429e13`, plus `df45e9b`, the cherry-pick of the already submitted
lighting-effects change `cd99292`. The latter supplies the four-bank lighting
and encounter cue API; it is a dependency of this room.

## Encounter

A 20–22 metre hall, narrowed to a 2.5 metre passage by office partitions.
Repeated frames and two staggered recesses keep the silhouette simple.
An ordinary movable trolley and chair use the existing office catalogue and
barricade rules. A fully charged, collectible flashlight lies beside the
trolley in the entrance foyer. The ordinary seeded room stash is in the
right-hand recess, clear of the walking route.

Crossing into the hall starts a 1.2 second warning. Four fluorescent banks
then fail from the far end toward the visitor, 1.35 seconds apart, with relay
clicks at the corresponding fixtures. They stay out during the encounter.
The existing steady-lighting setting substitutes constant reduced light.

The Lamplighter is an elongated, corrupted version of the real office cast,
using Blackout Bay's Stand-In rig. It walks at 1.55 metres/second and stops
only in the actual powered flashlight beam: aim, pitch, line of sight and a
12 metre range count. A mounted flashlight works through the same inventory
contract. Merely looking, the camcorder lamp, and paper fires do not stop it.
Its body, turn and idle bob freeze together.

Keep the beam on it while sidestepping past, then back toward the far end.
The corridor has enough clearance to pass its physical body. It respects
walls and movable furniture, including contact damage blocked by a barricade.
It remains in this room and will not follow into the rest of the floor.

A grab costs one heart, returns a survivor to a free spot in the foyer, and
restores the lights for a six-second recovery. Reaching the far end resolves
the encounter once and leaves the figure inert, with its body no longer
blocking the route. Leaving before finishing resets the encounter. The hall
can be a through route or a dead end, according to the ordinary room planner;
clearing the far end makes either route safe to retrace. Visits without an
inventory leave the figure inert.

## Integration

- Rare `big` room with resident `lamplighter`, dealt only after the `beam`
  lesson (Blackout Bay); existing one-set-piece and one-resident-room limits
  still apply. No global increase in feature-room density.
- Its authored lighting works without the ambient lighting prototype flag.
  Most other rooms retain their current lighting. Camera gain, adjacent-floor
  light updates and movable prop light probes recognize authored room banks.
- Two unfinished wall warnings and a hand-drawn silhouette join Fable's
  existing warning system. `visit-198` is a natural seed with its drawing;
  the drawing regression includes it because this follow-up encounter is rare.
- Uses the normal `c.met`, `c.survived`, `c.hurt` and inventory contracts.
  No new dependencies, real-time shadow maps, or roaming cast changes.

## Review

With the normal office server, open:

`/world/dev/backrooms.html?seed=7&only=last-light&hallstudy=1&check=1&pursuer=0&vhs=1`

`hallstudy=1` starts in the foyer and adds dev-only controls for entering,
aiming, looking away and toggling a real inventory flashlight. Its readout
shows distance and the four bank levels. Reload for a fresh encounter.
The controls are absent from the standalone build.

1. Pick up the entrance torch with E and switch it on with F.
2. Walk into the hall; watch the far lights fail first.
3. Keep the figure in the beam, look up or away, then catch it again.
4. Sidestep past while tracking it, then back toward the far end.
5. Try the ordinary chair as a barricade and test a surviving grab.

Eight room tests cover beam geometry, timing at three frame rates, authored
lighting and pickup charge, rotated rooms, physical barricades, damage and
recovery, a continuous damage-free crossing, one-time completion and a visit
without inventory. Browser checks cover the real pickup, F, movement, ordered
blackout, beam freeze/release and surviving contact. The standalone build
includes the room and its helper automatically. Encounter pacing still needs
the owner's playtesting; speed, grace, warning, beam range and angle are in
`rooms/last-light/rule.js`.

Validation on this branch: 801/802 full-suite tests pass. The sole failure is
the existing status-line bridge test (`test/usage.test.mjs`), which also fails
on the unchanged `c429e13` base on this Mac. The standalone build succeeds
(224 files); the browser's world check reports no room warnings. Preview
screenshots are kept outside Git. Nothing from this branch has been deployed.
