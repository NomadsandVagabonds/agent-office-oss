# Hanging Changing Rooms — first playable study

16 November 2026 · `codex/waterpark-hanging-changing`, based on Bellmouth's
`be7bbf5`. This branch contains that earlier room too. This addition is an
empty connector; it adds no resident, compulsory puzzle or consumable cost.
The whole waterpark remains `dealt:false` and is not a release candidate.

## What is built

A 20 × 26 m changing suite with three massive tiled partitions. Each hangs
above a shallow stepped channel. Their ends lift high enough to walk under;
one continues into a ceiling well while the others end below the main lid.
An uninterrupted dry path winds around alternating ends. Three wider low
slots shorten that path, with automatic crouching and shallow return steps.
Small bench islands create additional loops in the dry bays.

The material family is shared with Bellmouth: green ivory glaze, buff mosaic,
sea-green channel tile and dark moving water. Teal lockers repeat, along with
the same bench and hooks. Benches have visible anchor bolts. A towel hangs
above a channel, the shower's feed and return disagree, and ceiling slots
show more space above the nominal room. The shower has a fixed local sound
source and falling voxel droplets. There are no new signs explaining the room.

One dirty towel cart uses the existing trolley profile, normal gaze targeting,
carry speed, release placement and solid barricade behaviour. The custom room
does not introduce a separate interaction rule for it.

## Route and collision contract

- Front entry: `(0, 13)`. Far doorway: `(0, -13)`; generated doorway positions
  and sill heights still come from the normal shell.
- Hanging walls are centred at `z=7, 0, -7`. Their dry ends alternate right,
  left, right. Dry landings remain broad enough to pass the parked cart.
- A dry walkthrough uses `(8,10) → (8,5) → (-8,5) → (-8,-2) → (8,-2) →
  (8,-10) → (0,-12)`. Both doors remain connected without jumping or crouching.
- The three low cuts are centred at `(-2,7)`, `(2,0)`, `(-3,-7)`. They are
  2.5 m wide, with 0.83 m total headroom above the channel floor. This matches
  the existing 1.1 m eye-height avatar; a human-scale opening did not make it
  crouch. The player is above the water even while crouched.
- The narrow slots have only 0.58 m clearance and are physically blocked.
  The lifted ends have 2.93 m clearance over the channel bed and are real
  walkable paths, not decorative openings backed by invisible walls.
- Water is 0.21 m deep. Three 0.16 m steps wrap every channel edge, including
  its ends. No water cell needs a jump, teleport or ladder to recover.
- Floor meshes and controller queries use one pure floor field. Headroom
  queries never depend on who last queried the room. There is no shared
  upper/lower-player mode to break co-op.

The design looks impossible but uses ordinary geometry. No portals, recursive
views, gravity change, or new movement engine are claimed here.

## Review

The dev-only panel is enabled with `changingstudy=1`. It jumps to the first
bay, lifted wall end, shortcut, central shower, crouched view and far doorway.
`H` hides the panel. The public entry point never imports it.

Local preview (while the review server is running):

<http://127.0.0.1:44350/?themes=waterpark&depths=1&room=hanging-changing&only=hanging-changing&pursuer=0&mute=1&changingstudy=1&seed=17&vhs=1>

Review without instructions by omitting `changingstudy=1`. Sound is muted in
the linked review; remove `mute=1` to audition it. There are no loud encounter
events in this room.

## Validation and limits

The focused waterpark, return-pool and room-contract checks pass **75/75**.
The complete suite passes **994/997**; the three reported failures match the
existing Office console `/var` versus `/private/var` assertion (and its parent)
and the usage/status-line bridge's undefined `source`. No Backrooms test fails.
The production build succeeds with 297 files. No dependencies or media files
were added.

Integration tests build with the real catalogue, shaders' geometry attributes,
navigation and player controller. They walk the dry route, each wet cut and a
bench loop in all four rotations, check crouch release and floor recovery,
verify blocked narrow slots, and carry/release the real cart. Ray tests hit
the channel risers from both banks: an earlier winding error made those faces
look like holes despite valid navigation. The room also builds inside a full
generated waterpark without the navigation repair flattening it.

Browser review covers the entry, hanging-wall reveal, crouched passage,
central shower and exit bay. Two live networked players, mobile performance,
and roaming creature traversal have not been exercised here. In particular,
the low slots should not be enabled as chase routes for tall creatures without
checking their clearance rules. No room-specific creature is registered.

This is one authored layout at two ceiling heights and four placements, not
yet the planned family of differently arranged changing suites. Review the
empty room's pacing and material contrast before adding variants or danger.
