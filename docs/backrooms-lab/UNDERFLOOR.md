# Underfloor Walker

A sealed crawl beneath an occupied office. Three damaged inspection grates
reveal a hunched, elongated version of the native Office character. It patrols
above, bends down when it notices movement below, then reaches through the
missing bars. No captions, objectives or tutorial signs explain it.

## Encounter

- The figure moves continuously between three grates. Its first pause lasts
  5.8 seconds; later pauses last 2.6 seconds. It walks at 0.72m/s. Its clock
  begins near the crawl entrance and pauses outside the room or while frozen.
- Only a player directly beneath the occupied grate and below the deck can
  be seen. Solid boards and reinforced side pockets block detection. The
  body, head and fingers are articulated native voxel character parts.
- Detection builds for 1.05 seconds as the face bends toward the opening.
  Breaking sight lets it lose interest. A further 0.65-second windup commits
  the hand to a fixed position, followed by a visible reaching animation.
  Moving under covered boards or into an alcove avoids the grab; the hand
  cannot follow the player through the floor.
- Contact is checked only during the extended reach, near the locked hand
  target. A caught hand briefly closes before the player recoils to the last
  reinforced refuge (or the arrival bay initially). This is nonfatal and
  does not delete the visit or inventory. Retreat and cooldown prevent an
  immediate repeat. Leaving the room cancels a pending recovery.
- The deck bends with the actual creature's pose. There is no separate,
  invisible timed crushing hazard. Dust, creaks, footfalls, a grate rattle
  and restrained camcorder interference accompany the visible action.
- Warm low lights mark the supported side pockets. Cold overhead pools reveal
  the figure through the grates. The camera lamp stays off in this room;
  the crawl remains navigable without it.
- Both ordinary doorways remain accessible. The player automatically ducks;
  holding C also crouches. No jump is required. Even maximum deck flex leaves
  more than the minimum crawl clearance.

## Surface repair

The old masonry caps and planks shared a top plane, and independently spaced
plank sections overlapped at their seams. The new roof is an exact partition
of fixed boards, moving frames and real apertures. Masonry stops below the
roof underside. Muted worn lime blocks replace the contrasting red brick.
Upper end walls now enclose the office, leaving a low crawl opening instead
of exposing a brightly lit raised platform.

## Preview and scope

Run `node tools/backrooms-offline/preview.mjs --port 44324`, then open:

`http://127.0.0.1:44324/world/dev/backrooms.html?study=underfloor&seed=713&vhs=2`

WASD walks, mouse turns, C crouches, Shift hurries, M toggles sound and V changes
the camcorder presentation. Click to capture the pointer and start audio.
Look up beneath the first grate to see the inspection; retreat before the
hand arrives. `mute=1` permits silent inspection and `vhs=0` a clean geometry view.

The fixture contains an entry, this room and the normal exit annex. It remains
outside the production deck. Modules separate the responsibilities:

- `underfloor-layout.js`: pure structural plan, surface partition and clearance.
- `underfloor-shell.js`: architecture, materials, lights and bending frames.
- `underfloor-shadow-behavior.js`: pure patrol, sight, warning and grab state.
- `underfloor-creature.js`: native Office character rig and articulated reach.
- `underfloor.js`: encounter, sound, checkpoint and controller integration.

Debug state is `__backrooms.world.rooms[1].underfloor`. `read()` reports the
encounter; `reset()` restarts its behavior. `shadow` and `actor.read()` expose
timing and hand/head heights for inspection. Reset clears a pending grab but
retains visit-level attempt/recovery counters.

## Inspiration

The crawl-through entrances and wooden structures in the community wiki's
[Level 28](https://backrooms.fandom.com/wiki/Level_28) inspired the enclosed
structural space. This inhabitant, refuge rule and geometry are original to
this prototype; textures and sounds use the project's procedural tools.
No wiki prose, media, named entity or downloaded soundtrack is included.

## Review focus

Check whether the face and pause draw your eye upward before the hand arrives,
whether the warm alcoves read as cover, and how the nonfatal recoil feels.
A moving player can pass without getting caught; curiosity and lingering
under an opening create the risk. Tune encounter frequency only after Fable
chooses whether to include this room.

## Verification

All 12 Underfloor tests pass. They cover disjoint surface coverage, real grate
holes, clearances, continuous patrol, detection only through openings, warning
time, locked-target dodging, catches, cooldown and frame-rate consistency.
Browser checks at seeds 713, 22 and 41 retain all structural colliders, both
doors and all reachable floor cells, with no fallback, warnings or errors.
The actual controller completed the full route through every refuge with zero
recoveries, dodged a committed hand, and triggered one deliberate recovery to
the correct refuge. Frozen state, all three safe pockets, leaving during a
pending grab and the ordinary exit passed. Clean and VHS screenshots were
inspected. The hand's mesh bounds stay above the floor through the reach.

Full repository suite: 275/276 pass. The unchanged baseline status-line test
still fails at `test/usage.test.mjs:197` (`source` on an undefined reading).
