# MECHA — Training Floor

An opt-in Backrooms set piece: a dark, crowded corporate laboratory of caged
professional workstations, surveillance cameras and one central computer.
The wall carries a cog logo, **MECHA**, and the owner's slogan:

> Profiting from the world's misery so you don't have to

The satire is aimed at the company extracting work from people to replace
them. The professionals remain recognizable as people. Their distorted
features and repeated motions belong to the Backrooms' visual language. Gantries, head cradles, restraints, clouded reservoirs and heavy
umbilical cables connect their bodies to the apparatus without gore. Ceiling
feeds converge on the mainframe. Small pools of sickly light leave the rows
in shadow; this room disables the automatic camcorder torch (`noTorch`).

## What happens in the room

Twenty-four occupied cages fill four banks of six. Eight workstations have
interactive training circuits: two lawyers, two accountants, two physicians
and two psychiatrists. Sixteen additional workers and their machinery form
the static background shifts. All twenty-four start from the native Office
human builder, with eight appearances: varied skin tones, sculpted hair, ears,
noses, collars, lapels and rounded hands remain visible beneath the machinery.
Small cheek and jaw distortions, held-open tired eyes and asymmetric seated
postures make them recognizably human. The active workers breathe, turn their
heads and move shoulders and elbows independently; reduced motion suppresses
repetitive motion while preserving their response to camera diversion. Displays across the room report replacement
percentages. Reaching 100% does not release a worker; the company continues
extracting their work.

Three red-eyed robot wardens patrol the central and side aisles in badly fitted
wigs, ponytails and false beards. They notice and chase the visitor, routing
around the cages. Turning a worker's camera away distracts the wardens toward
that workstation for four seconds and gives the worker a moment out of view.

There are two ways to shut the laboratory down:

- Reach the red button on the front of the mainframe and
  press **E** to deactivate technodeterminism. It works immediately, with no
  forms required, and stops the wardens and training.
- Collect one voluntary authorization from each of the four professions.
  The fourth unique authorization also shuts down training and the wardens.

To collect an authorization:

1. Approach a camera's manual pan control and press **E** to turn it away.
2. Give the worker two seconds out of view. Their posture changes.
3. Press **E** at the authorization tray to collect their form.
4. Repeat for the remaining professions.

The other cameras briefly turn toward a diverted workstation. A pan control
can be toggled back; a form already collected stays collected. Taking a second
form from the same profession does not replace a missing profession's consent.

A twenty-fifth cage has an open entrance and an empty conditioning chair.
Approaching it wakes its camera; voluntarily entering starts recording the
visitor's replacement percentage, and the visitor can still walk out.

If a warden catches the visitor, they are transported into this cage, its gate
closes and an internal ten-second capture timer begins. The monitor shows only
YOU, with no visible countdown. Movement is held during these ten active
seconds, followed by a local game over. **Escape** can still
end the visit. The development page offers another visit on any key after
game over; this starts fresh rather than resuming the captured state.

Normal doorways remain available while the visitor is free. Neither helping
the workers nor shutdown is required to continue the Backrooms visit. The
room's training and security state is local to the visit and is not stored.

## Local preview

From this checkout, run:

```sh
node tools/mecha-preview.mjs
```

Then open
[the MECHA preview](http://127.0.0.1:44328/world/dev/backrooms.html?room=mecha&seed=713&vhs=2&mute=1&pursuer=0&check=1).
The server serves only `public/` and `core/` on loopback. It does not start the
Office daemon, observers, agent sessions or API routes. The existing development
page uses fictional office names. Use `--port <number>` if 44328 is occupied,
and Ctrl+C to stop the server.

Click the scene to enable mouse look. **WASD** moves; **Up/Down** move forward
and backward, while **Left/Right** turn. **Shift** hurries, **E** interacts,
**C** crouches, **Space** hops, **V** changes the camcorder picture and **M**
toggles sound. **Escape** leaves the visit; the browser may first consume it
to release the pointer, in which case press it again.
Cages carry only a profession name, a replacement percentage and its progress
bar. Camera plates use arrows; the mainframe shows TECHNODETERMINISM ON/OFF;
the visitor cage shows VACANT/YOU and a percentage before capture, then only
YOU while captured. The capture timer is internal.
There are no instructional placards, task descriptions or fine print. Loose
papers, the red button and physical camera levers carry the interactions.
The MECHA logo and the requested company slogan remain on the wall.

The linked preview starts with sound muted and the general Backrooms pursuer
absent. MECHA's three local wardens are still present.
Change `mute=0` for sound and `vhs=0` for a clean inspection picture. Test
`seed=713`, `seed=22` and `seed=41` to inspect different room dimensions and
doorway arrangements. A normal visit has connected floors; forcing this room
does not replace the full Backrooms with a separate level.

## Integration

Source base: `372b12a`. Working branch: `codex/mecha-training-floor`.

The human pass follows the avatar-derived approach in Gemini's
`gemini/backrooms-wave3` commit `aeb938081cd980dcbb4cb32a816a83b2c41c3fc7`,
particularly Audit Pod, Safety Corridor and Shredding Bay. The room imports
the existing `avatar/build.js` directly; it does not require merging the
other rooms or the new uncanny helper module.

The room's `MORE_DECK` entry uses `planned: true`, so normal random visits do
not deal it. The existing dev page turns `room=mecha` into a forced archetype
through its `only` option. No generator, player or development-page changes
are needed for this opt-in preview. Fable can decide its production frequency
after review.

This is a `big: true` set piece: one per floor at most. The current contract
permits up to **120,000 triangles**, while retaining **45 meshes** and
**16 lights**. Cage bars and static furnishings should share batches;
surveillance heads and actors should use few moving meshes. The whole room
must preserve a route between every doorway in every interaction state.

## Current revision validation

The human-model revision was measured in the browser at three seeds:

| Seed | Triangles | Meshes | Lights | Occupied cages | Wardens |
| --- | ---: | ---: | ---: | ---: | ---: |
| 713 | 116,138 | 42 | 14 | 24 | 3 |
| 22 | 115,136 | 42 | 13 | 24 | 3 |
| 41 | 114,258 | 42 | 13 | 24 | 3 |

All three are within the set-piece budget and built without browser errors or
a flattened-room fallback. Collision-grid traversal reached all 17 interaction
points and the visitor's workstation at every seed. The sole disabled collider
is intentional: the visitor cage's open gate, which becomes solid on capture.

Keyboard **E** activated the red shutdown button at all three seeds, completing
training shutdown and turning off all three wardens' eyes. An actual collision
capture transported the player to the visitor cage, closed the gate and held
them in place despite a held **W** key. The internal ten-second capture timer ended
with `over: caught`; pressing a key started a fresh visit with patrol restored.
A canvas-text check verified that both capture displays show only **YOU**,
with no visible clock, remaining seconds or replacement percentage after capture.
The timer continued internally, and capture, game over and retry passed again
after removing the visible countdown and its per-second display updates.

Camera diversion redirected all three wardens and allowed an authorization to
be collected after the worker rested. This also passed with reduced motion
enabled; **Escape** ended the visit normally.

All **42 focused tests** passed, covering MECHA's training rules, security
countdown, navigation, Backrooms room contracts and generation, plus native
voxel primitives and the optional AO meshing mode.

The rigs and ceiling feeds share existing room batches and add no meshes or
lights. Short flexible hose ends share each active worker's body batch and
follow the actual crown, nape and spine sockets. Browser checks measure the
rendered hose ends against their fixed feeds and moving sockets during work,
relief, head turns and reduced motion; errors remain below 0.01 mm.

Active workers still use two meshes each. Their shoulders and elbows animate
within vertex ranges at 24 Hz, while breathing and hose movement remain smooth.
The native voxel mesher has an opt-in `ao:false` mode for this dense crowd; it
preserves surfaces and materials while merging coplanar faces. All existing
callers retain the original AO behavior. Focused tests compare default output,
surface coverage, material channels, glass, origins and source immutability.
Guard navigation checks passed for cage-bank detours, rotated rooms, thin
barriers, wall-hugging targets, disconnected areas and a collider closing after
the route graph was built. Navigation uses a .25m grid and .36m guard radius;
every movement shortcut is checked against the full collision geometry.

The full repository suite was rerun for the final countdown revision: **363 of
367 checks passed**. Three failed entries represent two issues previously
reproduced on untouched base `372b12a`: the console's `/private/var` versus
`/var` temporary-path comparison (including its parent test), and an undefined
usage reading's `source`. An unchanged Claude trace fixture also failed once
when reading a frame's `request.subtype`; its focused rerun passed. No MECHA
test failed.

The live inspection handle is `window.__backrooms`. It exposes `goto`,
`where`, `level`, `world`, `player`, `env`, `plan` and `descend` on the
development page. `window.__stage.renderer.info` reports renderer resources.
