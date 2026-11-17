# Ambient lighting — review package

Branch: `codex/backrooms-lighting-effects`, based on Fable's working branch at
`a155afc`. Includes the first lighting pass (originally `04ad1c8`, carried onto
this base as `f1db571`) and the follow-up effects. Merge this branch as a whole;
it already includes the furniture work on that base. Lighting remains behind
the dev flag, off in ordinary public visits.

## Try it

`/world/dev/backrooms.html?seed=9&lighting=travel&lightstudy=1&mute=1&vhs=1&pursuer=0`

Choose room 13 for a narrow corridor on this review seed. The study panel lets
you switch profiles, jump to an eligible room, replay a cycle, compare ceiling
on/off, and give/select/toggle a real flashlight. **Hallway blackout** triggers
the one-way sequence and leaves the banks dark; **Replay cue** clears it.

For the backup fixtures, use seed 7, `lighting=emergency`, room 10. The
**Steady ambient lights** checkbox also works in the actual Esc → Settings
menu and saves with the other preferences. It holds the new effects steady
and settles ordinary flickering tubes. It does not disable authored creature
flashes or VHS effects and is not a comprehensive photosensitivity mode.
The study controls are dev-only. Gameplay and camera battery still run.

| Flag | Treatment |
| --- | --- |
| `lighting=1` | Seeded mix: 60% of eligible rooms unchanged; 10% failing; 15% dim; 10% islands; 4% travel candidates; 1% emergency candidates. |
| `lighting=failing` | One bank hesitates, goes out for about eight seconds, then slowly recovers. |
| `lighting=dim` | One side remains at 78%, the other at 0.25%. |
| `lighting=travel` | Three or four ceiling banks fail in sequence, 1.35 seconds apart, then recover. A passing cycle lasts 64–88 seconds. |
| `lighting=islands` | One surviving tube, or two in a large ceiling; the others sit at 0.25%. No pulsing. |
| `lighting=emergency` | Ceiling tubes at 0.25%, with real red wall fixtures. A broad 2.6-second pulse followed by a quiet interval; not a sharp strobe. |
| omitted | Original lighting/camera response. |

Natural travel candidates require a corridor at least 1.8 times as long as it
is wide and at least three live panel rows. Other travel candidates become
failing rooms. Emergency rooms are capped at one per part. Forced review
profiles bypass that cap; forced travel also admits wide rooms, but still
needs three rows. Actual effects are less frequent than the table across the
whole building because protected/unsuitable rooms are excluded.

Only plain rooms with normal/dim light and at least two separable live panel
rows qualify. Landings, exits, crawlspaces and authored special rooms keep
their lighting. Original dead panels stay dead. Lighting has its own RNG;
fixtures are added after furnishing without drawing from the room's RNG, so
rooms, supplies, residents and furniture keep their seeded positions.

## Shared behavior and integration

Tube emission, baked light, probes, exposure and hum follow the bank state.
Emergency fixtures have their own colored contribution and receive no generic
ambient bounce. They use free wall spans; a small ceiling fixture is the
fallback when all walls are occupied. They introduce no floor colliders.

The visible parts above and below a way down update their lighting from the
same visit clock without running their hazards, creatures or entry callbacks.
`world.setLights(rt, k)` retains encounter priority: while k is not 1, ceiling
banks are fully available to the encounter and red backup lamps go off.
Restoring k=1 resumes the ambient state.

Movable chairs, desks and trolleys use a shared light probe per carrier when
the flag is on. The probe follows their current position, including across
room boundaries. Carried voxel props, mapped surfaces and `c.dynamic` objects
follow it too. Contact shadows and self-lit screens remain separate. This
prevents a desk from carrying its old room's red bank with it.

The Last Light follow-up caps camera gain at 1.25. Failed banks keep 0.25%
output, and 99% of ambient bounce belongs to the ceiling banks. The subsequent
[camcorder lamp pass](BACKROOMS-CAMCORDER-LIGHT.md) gives the camera a separate,
broad beam with a 2.2 metre limit, and increases persistent dim/island rooms
from 13% to 25% of eligible rooms. Darkness/supply balance and natural effect
frequency still need longer playtesting.

## Hook for the proposed hallway encounter

An existing corridor built with a travel plan can be commanded with:

```js
world.startLightingCue(rt, { from: 'low', hold: true });
// …when the encounter releases the corridor:
world.clearLightingCue(rt);
```

`low` / `high` refers to the corridor's local lighting axis. The hook starts
from the current visit time, runs once, and can hold the blackout indefinitely.
It returns false on rooms without travel banks; it never changes baked bank
assignments after construction. The steady-light preference still wins over
ambient motion. The dev Hallway blackout button exercises this same hook.

**Room to build next:** a long hall whose lights click out toward the player.
A creature advances in darkness and stops only under the player's flashlight.
Side alcoves offer escape decisions while the player manages the beam and its
battery. Keep the approach readable and use a deliberate, held cue rather
than the ambient repeating cycle. This package supplies the lighting hook;
it does not add that creature, sound sequence or encounter room yet. An
authored special room will need an explicit plan opt-in before its bake.

## Cost and limits

The system extends the existing bake with two, three or four optional RGB
vertex attributes and a few scalar multipliers. Untouched rooms allocate no
bank attributes. Red fixtures add one emissive batch per emergency room plus
small housing geometry. No new Three lights, shadow maps, per-frame geometry
rebuilds or physics engine. Visible movable furniture adds one CPU light probe
per carrier per frame; desktop/mobile frame time still needs measurement.

Bounced light uses proximity to ceiling tubes, not full light transport.
Neighboring doorway spill remains baked, so an open doorway into a bright
room will soften a corridor blackout. Furniture does not cast dynamic shadows
or occlude the flashlight in this pass. Added custom meshes outside the normal
catalogue/`c.dynamic` path retain their author's lighting behavior.

## Verification

- Focused lighting, furniture integration, settings and menu tests: **28/28**.
  Covers bank order/recovery, held cues, rarity/cap, seeded layout stability,
  three/four-bank bake reconstruction, red probes, encounter priority,
  multi-part lighting updates, and carried furniture crossing room boundaries.
- Full suite: **793/794**. The status-line bridge test in `test/usage.test.mjs`
  fails in this environment (line 197); the same test also fails on an untouched
  archive of base `a155afc` (line 202). No usage/status-line code is changed.
- Standalone build: **212 files**, successful.
- Browser: corridor sequence, held blackout, flashlight on/off, emergency
  fixtures, surviving light pool and the live steady-light control checked.
  No shader errors reported. Browser-extension message-channel errors appeared
  during page navigation; these are distinct from the game's shader logs.
