# Window Court

An opt-in feature-room candidate: a huge enclosed courtyard, repeated windows,
and one harmless inhabitant. It is a rare encounter for Fable to evaluate,
not an addition to the normal random deck.

## Room card

| Aspect | Candidate implementation |
| --- | --- |
| Scale | 23.8 × 27.8 m interior, 12 m high; centered front/back entrances. |
| Architecture | A depressed central court behind a continuous low railing; two wide perimeter routes, four rows of repeated curtained windows and sparse wall lamps. |
| First impression | More than a hundred windows could conceal an observer. Most are dark, several glow behind close curtains. |
| Inhabitant | An elongated derivative of the actual Office avatar sculptures, wearing muted clothing. Its head stays turned toward the outer wall even when its body walks parallel to it. |
| Behavior | It initially matches the visitor's progress along the court. After the visitor pauses, or approaches the right-hand shutter, it walks to that shutter, opens it, and stands aside. |
| Choice | Follow the inhabitant through the newly opened right route, or take the permanently available left route. There is no attack, item check, required interaction or hidden failure condition. |
| Persistence | The gate stays open once offered. Leaving pauses the encounter; returning cannot trap the player. |

No explanatory signs, captions, labels, dialogue or novelty props are added.
The upper windows are scenic architecture; the candidate has no unsupported
climbing, jumping or swimming requirement. Both playable paths are at floor
level. The central drop is visibly enclosed by a retaining wall and railing.

The shutter rises through a real clearance interval. Its collision releases
only after a crouched body fits, and its headroom follows the visible bottom
edge while it rises. The guide waits until it is fully open before crossing.
The left route remains available in every gate state.

## Files and preview contract

- `window-court-layout.js`: pure geometry, route checks and deterministic
  neutral behavior, independent of Three.js and wall-clock time.
- `window-court.js`: builder exported as `buildWindowCourt(c)`.
- `rt.windowCourt`: plan, behavior, actor, shutter, collider, validation and
  a `read()` snapshot for browser inspection.
- `test/window-court.test.mjs`: ordinary/alternate route clearance at three
  shell sizes, window bounds, offer completion, closed-shutter avoidance,
  inactivity and reentry, and the non-pursuing terminal behavior.

The common workshop preview supplies the builder and fixture separately;
normal generation remains unchanged. Room resources belong to the existing
kit. The encounter uses room-local ticks and no new timers or global listeners.

Preview: `http://127.0.0.1:44324/world/dev/backrooms.html?study=window-court&seed=713&vhs=2&mute=1`.

## Inspiration

The courtyard, repeated windows and uncertainty about an observer were
inspired by [Level 188](https://backrooms.fandom.com/wiki/Level_188). The layout,
inhabitant, movement rules, geometry and route choice here are original to this
workshop. No wiki images, prose, music or models are included. All materials
and figures are generated with the project's own primitives and avatar parts.

## Verification and review limits

Five focused pure tests pass. A seed-713 browser check retained collision,
reported no builder fallback, warnings or errors, and validated the ordinary
detour. The actual player controller completed both full perimeter routes;
the inhabitant finished its offer and kept the shutter open. Eye-level VHS
screenshots were inspected for court scale and the figure's silhouette.

These establish traversal and behavior rules for this candidate.
Human playtesting is needed to judge whether its offer feels unsettling or
merely useful, and whether the permanently available detour is discoverable.
