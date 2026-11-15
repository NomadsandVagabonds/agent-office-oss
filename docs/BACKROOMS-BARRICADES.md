# Furniture barricades — prototype for Fable

Branch: `codex/backrooms-barricades`, based on working branch `83e658f`.

This is opt-in: `enterBackrooms(office, { barricades: true })`. The office and
BlockRooms production entry points do not enable it. No new physics dependency.

## Review

Run the usual local Office server from this checkout and open:

```
/world/dev/backrooms.html?seed=7&barricades=1&study=1&yaw=0&pitch=-0.3&mute=1
```

The landing contains two identical ordinary office chairs, a desk with its CRT
and keyboard, and a trolley. One chair was authored `solid:false`; both move.
The pirate stands in the neighboring room. Add `&wake=1` to wake it immediately.
The study only overrides the dev landing; it is not a new room in the deck.
Remove `study=1` to try furniture throughout a normal seeded visit. Remove
`barricades=1` to compare against the unchanged behavior.

Look at furniture within reach. Camcorder focus brackets and **E · Move Chair**
(or Desk/Trolley) appear. Tap E, walk to push or pull, then tap E to release.
The touch hand does the same. A working computer keeps its own E interaction;
aim below its tabletop to grab the desk. Pause, the bag, a fall or a changing
room releases the grip. Selected-pocket models hide while dragging.

## Consistent physical rules

- Every ordinary, floor-standing catalogue `chair`, `desk` and `trolley` follows
  the same rule, including existing decorative `solid:false` placements.
- Buried, suspended and wedged furniture remains structural. Stacked bases and
  explicitly fixed pieces have visible steel feet and bolt heads.
- The shifting hallway's authored furniture stays in its transforming face
  batch and has the same visible bolts. Furniture brought into that room is
  taken away and returned with its contents; it cannot remain as a ghost collider.
- Bespoke architecture built from raw primitives is still architecture. Room
  authors should use the catalogue for ordinary movable chairs/desks, or visibly
  anchor a fixed furnishing. Do not introduce identical-looking fixed copies.
- The reachability rescue remains in place. A visible rescued chair can still
  be grabbed; a validated placement restores its physical collision.

Desks carry supported catalogue props, raw screen/paper geometry, attached uses,
and contact shadows. Their support is inferred at build time. Room-specific
callbacks that retain old coordinates need an explicit movable-object contract.
Dispatch’s hoard workbench is visibly bolted down: its pickup choreography is
part of the fixed pile, rather than a free-standing desk.

## Movement and the pirate

Furniture slides upright, at fixed orientation and floor height. It cannot be
thrown, stacked, tipped, carried through a floor transition, or slid over holes,
steps or changing floor heights. There is no separate furniture save format yet.

| Object | Player speed | Pirate brace | Pirate push |
| --- | ---: | ---: | ---: |
| Chair | 1.10 m/s | 1.2 s | 0.85 m/s |
| Trolley | 0.85 m/s | 1.5 s | 0.65 m/s |
| Desk | 0.45 m/s | 2.4 s | 0.40 m/s |

Movement uses small swept steps over the full rectangular footprint. It checks
walls, closed doors, other furniture, creatures, the player, floor and ceiling.
Player and furniture steps commit together; a blocked player step rolls back
the furniture. An open, level doorway can transfer a piece into the next room.

Furniture blocks physical walkers and physical contact, independently of visual
line of sight. Creatures can see over a desk and continue pursuing; they cannot
reach or pull the visitor through it. Contact checks sweep the entire segment,
including very thin obstacles and grabs already in progress.

| Entity | Barricade behavior |
| --- | --- |
| Pirate | Routes around, or braces and shoves. Watched/spent/frozen/fire states stop shoving. Dismounts and grab poses also obey furniture. |
| Trunk Line, Retention Clerk, Safety Warden, Efficiency Partners | Live movement and contact checks; no shoving. Trunk Line waits above an obstructed landing. |
| Cardboard follower | Routes around; waits when no route remains. Has a physical body. |
| Dispatch duo, MECHA guards | Live collision plus refreshed navigation after furniture moves. Cannot shove. |
| Fun Committee, Stand-Ins, All-Hands Speaker | Checked pursuit, dancing and return movement; physical contact cannot cross furniture. Stay in their authored rooms. |
| Absorbed staff | Furniture interrupts reaching and sustained grabs; player pulls cannot cross it. |
| Night Porter | Stationary physical body; cannot shove. |
| Desk moth | Height-aware flight over low furniture, including fixed catalogue props. Checks wings/orbits, ceilings and door lintels; tall loads still obstruct it. |
| Shadow and Cover tape replay | Intentionally spectral: furniture does not trap them or prevent their supernatural effects. Walls retain their existing rules. |

Physical residents also stop the player dragging furniture into them. Their
bodies disappear with them, return with the same pose, and are removed on
teardown. Flying bodies only block a moved object at overlapping heights.
Desk attachments contribute to the object's final flight-clearance height.

Room-wide effects (such as Blackout Bay's darkness penalty) are environmental
hazards, not contact attacks, and remain effective behind a barricade.

The moving-furniture system and new room-resident bodies remain behind the
flag. General correctness fixes to the moth's flight and cardboard follower's
body also apply to fixed furniture in a visit without the prototype enabled.

## Validation and rollout

Focused tests cover the actual world builder and catalogue, mesh attachments,
visibility, room ownership, input-driven dragging, collision, transforming rooms,
navigation invalidation, detours and the real pirate controller's state gates.
Additional regressions exercise room update callbacks (including blocked and
unblocked attacks), dynamic NPC body lifecycles, flight height, spectral
exceptions, plinth/crawl poses, and grab interruption. The All-Hands stage traversal also
runs against its real room geometry, including a blocked stage lip. Render-only stand-ins are
used for controller tests; world/collider tests build the actual voxel props.
The normal BlockRooms static build also includes the modules successfully.

Final full-suite run after the entity integration: 770/771 pass. The sole failure is the unrelated status-line
bridge case in `test/usage.test.mjs` (`reading 'source'`). Running that test on a
clean, detached `83e658f` checkout reproduces the same failure (8/9 pass there).
Browser checks verified chair push/pull, release, loaded desk movement, trolley
movement, pause release, controls text and flag-off rendering; the updated
branch was also reloaded and checked for chair movement/grip/pause. The static
build succeeds with 205 files.

The prototype adds separate meshes per movable item; stationary items do not
need per-frame physics updates. Profile rendering on older phones and crowded
chair rooms before enabling it publicly. Baked vertex lighting still travels
with a piece; room dim/flicker ownership transfers, but full lighting rebakes do
not run during dragging. Rotating furniture, tipping, breakage, animated hands,
sound attracting creatures and multiplayer synchronization are future work.

Initial prototype measurement on this Mac (Node 22, real builder/catalogue,
mocked Canvas): a synthetic
40-room/240-item test took about 0.60 ms median for twenty desk moves and
2.06 ms median for one local navigation-grid rebuild. Six sample props became
12 meshes rather than 2, with unchanged vertex counts. These are CPU checks,
not browser frame-rate or mobile GPU measurements; profile the expanded
creature integration before enabling this publicly.

Useful playtests: block a doorway with the desk; watch the pirate stay still;
look away and hear it brace; move the desk while it approaches; try a clear
alternate corridor; pull furniture against a wall behind you; bring a chair
through a level doorway and into the shifting hallway; compare identical chairs.
