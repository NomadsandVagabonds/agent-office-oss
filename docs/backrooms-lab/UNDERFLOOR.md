# Underfloor Walker

A local horror candidate: the space beneath an occupied room, where the player
can see almost nothing of its occupant. The low route, timber supports and
small borrowed Office furnishings use the existing voxel/material vocabulary.
There are no captions, collectible objectives or explanatory interaction prompts.

## Encounter

- Three unsupported spans cross a continuous crawl aisle. Side refuges have
  doubled timber supports; they remain safe at every point in the cycle.
- A footfall has two seconds of creaking and falling dust before the boards
  depress. The visible shoe descends with them. A grille gives a partial view
  of a much too long trouser leg in the room above.
- The six-step sequence travels toward the far end and back, at 6.4 seconds
  per step. Its clock starts near the crawl entrance and pauses outside this
  room. Waiting safely before entering cannot exhaust a one-time opportunity.
- Staying beneath a loaded span for more than 0.24 seconds causes a nonfatal
  recovery to the last reinforced refuge (or the arrival bay initially).
  Camera interference and impact foley accompany the recovery. Progress after
  each refuge is retained within the visit; there is no inventory penalty.
- Standing routes connect to both ordinary doorways. The player controller
  automatically ducks under the timber; holding C also crouches. No jump is
  required, and even a loaded span keeps more than the minimum crawl clearance.

## Preview and scope

Run `node tools/backrooms-offline/preview.mjs --port 44324`, then open:

`http://127.0.0.1:44324/world/dev/backrooms.html?study=underfloor&seed=713&vhs=2`

WASD walks, mouse turns, C crouches, Shift hurries, M toggles sound and V changes
the camcorder presentation. Click the view to capture the pointer and start
audio. `mute=1` is useful for silent inspection; dust and displacement still
communicate the timing. `vhs=0` gives a clean geometry view.

The standalone fixture contains an entry, this room and the normal exit annex.
It is not in the production deck. `underfloor-layout.js` owns the pure plan,
clearance and cadence; `underfloor.js` builds and animates the room. Debug state
is available at `__backrooms.world.rooms[1].underfloor`, including `setTime(t)`.

## Inspiration

The crawl-through entrances and wooden structures in the community wiki's
[Level 28](https://backrooms.fandom.com/wiki/Level_28) inspired the enclosed
structural space. The walker, refuge rule, model, textures and sounds are
original to this prototype or generated through the existing project tools.
No wiki prose, media, named entity or downloaded soundtrack is included.

## Review focus

Check that dust and creaking are noticeable from the approach, that the
reinforced refuges read as a sensible place to wait, and that the glimpse of
the upstairs occupant feels large without revealing it completely. This is
a traversal prototype; player feedback should determine cadence and recovery
severity before Fable chooses whether to include it.

Four focused layout/cadence tests pass. Browser checks retain every structural
collider, both doorways and all free floor cells across seeds 713, 22 and 41,
with no fallback or runtime warning. The actual controller completed the full
route through all three refuges against one continuous footstep cycle with
zero recoveries; a deliberate strike returned it to the last refuge, and
remaining in that refuge through a strike did not trigger recovery. VHS and
clean views were inspected at crawl height. The normal exit completes the visit.
