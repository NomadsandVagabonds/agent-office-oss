# After Hours — containment after closing time

Floor **A** is a local first-person office mission: a carried voxel crowbar,
physical jumping, and nine headcrabs across three connected combat rooms.
It replaces the browser's mallet wave game. **Night Shift (N)** remains the
separate monochrome stealth floor.

The space is another floor of the main agent office: the same wood panelling,
warm carpet, CRT workstations, chairs, bookshelves, plants, and kitchenette,
with a maze of furnished rooms and a server wing. Scene signs, floor arrows,
instruction posters, and textual mission screens have been removed.

The current development preview is
`http://127.0.0.1:44319/?level=afterhours` on branch `codex/after-hours-fps`.
The lift's **A · After Hours** button reaches the same floor.

## Mission

1. Leave the safe reception area and cross Operations.
2. Take the east doorway into the office's break-room and storage wing. Jump the low moving boxes,
   then collect the spare fuse with **E**.
3. Enter Server Control through Maintenance, clear its three headcrabs,
   and use **E** at the power panel.
4. Return through the newly opened Operations shutter and use **E** at the lift.

The fuse and restored power each save a checkpoint and restore health.
**R** retries from the last checkpoint, preserving items and kills earned
before it. Two one-use first-aid kits restore health. There is no timer,
limited retry count, or requirement to hunt every optional enemy.

Headcrabs crouch before committing to a jump toward the player's position
at the start of the tell. Sidestep that position, then strike during their
landing recovery. The first crowbar hit knocks a headcrab backwards in a
short, harmless hop; the second defeats it. Knockback interrupts an attack
and collides with walls and furniture. Reach, direction, and impact timing
still matter. Stalking and leap travel are 20% faster than the first FPS
version, with the same readable windup. Each leap damages the player once.

## Controls

| Action | Control |
|---|---|
| Move / strafe | **WASD**; **Up/Down** also move |
| Look | Click the scene for mouse lock; drag to look if lock is unavailable |
| Turn without a mouse | **Left/Right** arrows |
| Swing crowbar | Left click/hold, or **F** |
| Jump | **Space**; release before jumping again |
| Sprint | **Shift** |
| Pick up / use / extract | **E** |
| Retry checkpoint | **R** |
| Pause / resume | **P** |
| Release mouse / return to work | **Esc** releases locked mouse and pauses; press again to take the lift home |

Losing focus pauses the mission. The smaller wrist terminal shows health
and fuse/power/extraction icons. Equipment glows and panel indicators carry
mission feedback without in-world prose. Reduced motion disables camera
bob and damage shake.

## Modules and state

- `core/afterhours-game.mjs`: pure deterministic mission state, movement,
  collision, melee, enemy navigation/leaps, interactions, and checkpoints.
  It has no browser, storage, or network dependencies.
- `public/world/levels/afterhours.js`: first-person camera, input, animation,
  sound, wrist terminal, pause, and level lifecycle through the shared kit.
- `public/world/levels/afterhours-scene.js`: room geometry, furnishing,
  lighting, familiar office furniture, and power/mission indicators.
- `public/world/levels/afterhours-props.js`: original Vox crowbar, glove,
  headcrab parts, and mission props.
- `test/afterhours-game.test.mjs`: deterministic rules and route checks.

`LEVEL` contains the rooms, walls, obstacles, start, enemy spawns, and
interactables. Both rendering and collision consume this authored geometry;
the shortcut wall has `gate: true` and opens when `state.power` is true.
Coordinates use x/z for the floor and y for feet height. Yaw zero faces -z;
positive pitch looks down.

```js
import { createGame, step, respawn, objective, interactable, LEVEL, PLAYER }
  from './core/afterhours-game.mjs';

let state = createGame();
state = step(state, {
  forward: 1, strafe: 0, yaw: 0, pitch: 0,
  jump: false, attack: false, interact: false, sprint: false,
}, 1 / 60);
```

`step` returns new state and caps/subdivides elapsed time. The caller skips
it while paused. Player fields are flat (`x`, `y`, `z`, `health`, `stage`);
mission fields include `hasFuse`, `power`, `usedMedkits`, and `checkpoint`.
`enemies` holds enemy state; `swing` provides animation age and impact state.
`events` contains feedback for the current call. `respawn(state)` returns a
checkpoint retry; `objective` and `interactable` provide presentation text.
`isFree`, `lineClear`, and `roomAt` are also exported for geometry checks.

During a visit, `office.level.fps` exposes read-only state snapshots,
controls, pause state, objective, nearby interaction, and the authored map
for debugging. The mission does not post scores, move work items, or send
messages. Progress lasts for the visit. The daemon's existing agent
text-side mallet interaction in `server/world/floors.mjs` remains separate
from this browser mission.

## Verification baseline

On 14 November 2026, `node --test test/afterhours-game.test.mjs` passed all
15 tests: movement and collision; the required jump and ceiling clearance;
two-hit melee timing/range/arc/line of sight; collision-safe harmless knockback;
the 20% speed increase; dodgeable leaps, damage immunity, and recovery;
mission order; checkpoints; first aid; and furnished-route reachability.
A separate simulation completed the live-enemy mission using movement,
aiming, attacks, dodges, and interactions, with no teleport or retry.

The final `npm test` run reported **212 passed / 215 total**: the existing
`test/usage.test.mjs:197` status-line bridge assertion (`meter.source` is
undefined), and a transient wake-order assertion in `test/harness-wake.test.mjs`
counted again at its parent suite. All 14 wake tests passed when rerun alone;
all 15 FPS tests passed throughout. Full run log:
`/private/tmp/afterhours-office-revision-test.log`.

Browser verification completed the mission using actual WASD, drag-look,
crowbar, jump, and interaction inputs: fuse collected, server room cleared,
power restored, shortcut opened, and lift extraction reached. Separate
checks verified death freezes movement, R restores the checkpoint, pause
freezes time, Escape returns to the lobby, and re-entry starts fresh.
The successful preview and lifecycle runs reported no browser errors.

The furnished revision also completed a full browser run, observing each
defeated crab at one remaining hit before it died, then verifying extraction
and a fresh re-entry. Its first-hit recoil was inspected in the rendered
scene. Reception, workstations, and the kitchenette were visually checked;
the environment contains no text-drawing or sign calls.

The drag-look path is explicitly tested with pointer lock denied. A separate
normal Chrome window verified native mouse capture, mouse look, click to
swing, Escape to release and pause, P to resume, and returning to the lobby,
with no browser errors. Headless Chrome declined native capture, so capture
verification used the normal browser instead.
