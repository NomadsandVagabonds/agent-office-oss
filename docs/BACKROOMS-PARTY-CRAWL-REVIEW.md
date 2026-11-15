# Crawl openings, the Fun Committee, and the party left behind

Review branch: `codex/backrooms-party-crawl`, based on `3a0aa90` of the working branch.

## Runtime clearance

The bridge change used the room ceiling in place of `headAt`, losing doorway
heights and the `lows` rectangles used by interior crawl holes. The runtime and
walkability grid now apply those limits, including rooms with custom floor/head
functions, before subtracting a movable walking surface. The existing player
controller again automatically ducks; no new crouch input is required.

## Committee encounter

- A visible visitor anywhere in the room is noticed for 1.25 seconds, then
  pursued at 3.35 m/s (previously 2.85). The foyer stripe no longer gates pursuit.
- Nonfatal hits no longer buy a seven-second retreat. Contact has a 1.3-second
  cooldown; the visit's shared 1.25-second damage grace also prevents simultaneous
  creatures from stacking hits. Furniture still blocks both movement and contact.
- A selected balloon immediately prevents contact damage. They gather around
  its holder (up to three seconds), sway for 2.4 seconds, and keep the new circle. The
  visitor remains free to move. They remember the welcome until seeing that
  visitor without a held balloon.
- Gathering keeps their current order around the visitor. Every transition
  uses capped walking motion; they walk home only after the visitor leaves.
- In two-player mode there are two separate foyer balloon pickups. The room
  clock runs once, with `rt.chooseVisitor` selecting the unprotected visitor's
  context for targeting and damage; a balloon does not protect a partner.
  The party reads the authoritative selected inventory item in co-op.
- Chase arms reach forward. The lower smile is a separate jaw with staggered
  chomping; the dance restores the wide arm pose. Joints move without remeshing.
- The held balloon has a glove and string, larger framing, and the flashlight's
  depth-clear treatment so nearby walls cannot erase it. Phone bounds are tested.

## Damage feedback

Successful health loss now triggers the existing camcorder red wash, fading
smoothly over about a second. Cooldown-blocked hits, Tourist immunity, healing,
and battery depletion do not flash. Co-op gets a matching smooth red fade on
the local visitor's health decrease, including lethal hits, without flashing
on the initial snapshot or a partner's damage.

## Party room

The flat blue panels, little cake, and HR banner are replaced with:

- A five-tier, off-center cake with exposed jam layers, dried icing drips,
  scalloped piping, a missing slice and half-burned candles, on a stained buffet.
- A sagging **HAPPY LAST DAY / WE SAVED YOUR PIECE.** banner.
- Leaning stacks of nested cups, plates, party hats and taped supply boxes.
- Faded ceiling streamers, flags, decorative balloon clusters and confetti drifts.
- Aged notices: **SMILE! The photograph has already been taken**, **PLEASE SIGN
  THE CARD. Even if you don't remember them**, a list of years that repeats 1988,
  and **DO NOT CLEAR AWAY. We are still expecting someone.**

The scenery uses the existing voxel mesher and room batches. It has no extra
per-frame animation work. Placement uses free perimeter wall runs and reserves
space for the banner as well as the table. Decorative balloons are muted colors;
red balloons remain the collectible ones. Door approaches and the middle floor
stay clear, including the minimum 9-by-9-metre room at all four rotations.

## Review

Dev page: `/world/dev/backrooms.html?room=mandatory-fun&count=7&partystudy=1&pursuer=0&mute=1`.
The study starts in Tourist mode and explicitly labels enemy damage OFF. Enable
enemy damage to switch to Easy and test real contact attacks. Its other buttons
show/hide the balloon, reposition the visitor, inspect the buffet and supplies,
take one hit, and restart. It is not in the production entry point. Tuning values
live together in `rooms/mandatory-fun/rule.js`.

Automated checks cover runtime crawl clearance and actual automatic ducking from
both directions at four rotations, existing bridge behavior, real room pickup
placement for 1P/2P, per-player targeting, reaction/dance/contact timing,
furniture barriers, continuous committee motion through state changes, visible
balloon framing, reaching arms, jaw movement, landed-hit red feedback, and the
real room attacking through survival's shared damage gate. The small-room tests
also check scenery bounds, doorway connectivity and an unobstructed dance floor
without relying on the world's fallback of disabling furniture collision.
Browser review covers the single-player approach, balloon, dance and release,
real contact damage, red feedback, and the cake, banner and supply dressing.
A full networked two-browser playthrough remains useful integration QA for the
suburb/co-op team; the two-player changes here have automated coverage.

Validation: 69/69 focused tests pass, and the standalone BlockRooms build passes.
The complete `npm test` run is 922/925: the existing macOS `/var` versus
`/private/var` console assertion (plus its parent subtest failure), and the
existing status-line bridge `source` failure remain. No new failures.
