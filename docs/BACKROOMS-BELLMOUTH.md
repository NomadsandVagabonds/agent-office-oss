# Bellmouth Baths — first playable study

15 November 2026 · `codex/waterpark-bellmouth` · based on `0d92d8f`.

This is the first room built from the MACBETH-inspired architecture slate in
[the waterpark art audit](BACKROOMS-WATERPARK-ART-AUDIT.md). It is for review,
not a claim that the whole waterpark is ready. `waterpark.dealt` remains false.
No downloaded reference media is included in the game or this branch.

## What is playable

- A 26–28 × 28 metre ceramic bowl, with a ceiling rising from 9–10 metres
  at the perimeter to another 2.4 metres above the centre. Familiar doors and
  fluorescent housings retain their ordinary scale.
- Two short service passages connect the generated front and back doors.
  Carpet survives at the entrance. These are normal room connections, not
  visit exits or descent triggers.
- A broad gallery descends around both sides of the bowl and returns to the
  far doorway. On the right, a large tiled buttress conceals the water behind
  a lower covered passage. The left gallery has an unstaffed desk and CRT.
- Two stair fans reach the shallow basin. Either set returns to the gallery;
  no jumping, item, timed switch or monster is needed. The dark throat is
  closed by a visible metal grille. The deepest walking water is 0.47 metres.
- Bone tiles, smaller matte mosaic, a sea-green band, an old high waterline,
  drain channels, bolted rail feet and a mustard service hatch. A polygonal
  water surface carries slow, subdued movement.
- Empty by default. No new creature or encounter was added.

## Implementation boundaries

`bellmouth/rule.js` produces the floor facets and answers height queries from
those same triangles. The room clip follows the polygonal wall and service
passages. Rails have body colliders; the buttress also blocks sight. The
surface is single-valued at every x/z, without a shared player-layer latch,
teleport trick or camera ride. It does not require changes to the controller.

The geometry and lighting are batched through the existing kit. There is one
animated water material, no physics engine, reflection pass, shadow map or
per-frame geometry rebuild. New room files load through the existing module
registry. The broader theme is still gated off from ordinary visits.

This pass establishes the room's architecture and route. Compared with the
larger brief, the vestibules are straight rather than doglegged, the gallery
uses a gradual descent rather than separate flights, and the attendant nook
is on the dry rim rather than a separate lower service gallery. Dedicated
pump/drip acoustics, alternate bowl variants and a two-client playtest remain
later work. There are no added resident behaviors to review yet.

## Local review

The staged preview is served at:

`http://127.0.0.1:44349/?themes=waterpark&depths=1&room=bellmouth-baths&only=bellmouth-baths&pursuer=0&mute=1&bellstudy=1&seed=17&vhs=1`

The dev-only study panel offers entry, gallery, covered passage, basin and far
door viewpoints. H hides it; WASD walks normally. Reload for a fresh battery.
The served folder is `/tmp/blockrooms-bellmouth-review`; the standalone build
is `/tmp/blockrooms-bellmouth-build`. These are local outputs, not a deployment.

## Validation

- 67/67 focused room, waterpark and deck-contract checks pass. They include
  actual-controller gallery traversal in both directions, both stair returns
  and exit access in all four rotations; finite render attributes; generated
  floor connectivity without flattening; and keeping the theme out of live
  visits.
- The standalone BlockRooms build succeeds.
- Browser inspection caught and corrected a rectangular water edge and desk
  geometry intersecting the slope. The revised bowl/water entry view was
  inspected in Chrome. Performance has not been benchmarked on a low-end phone.
- Full-suite run: 983/989 initially passed. One new failure was the room
  exceeding the documented 28 metre footprint; fixed, and the relevant deck
  and runtime tests rerun successfully. The other failures were the existing
  Office console path assertion and parent test, the status-line source
  assertion, and a wake-mail ordering assertion plus its parent. Wake-mail
  passes 14/14 in isolation; none of those Office files changed here.

Before live release, review the room at player height with the intended VHS
setting and try it with two players and carried furniture. Automated route
checks are not a substitute for atmosphere or multiplayer review.
