# After Hours — containment after closing time

Floor **A** is a local first-person office mission: a carried voxel crowbar,
physical jumping, and nine headcrabs across three connected combat rooms.
It replaces the browser's mallet wave game. **Night Shift (N)** remains the
separate monochrome stealth floor.

The current development preview is
`http://127.0.0.1:44319/?level=afterhours` on branch `codex/after-hours-fps`.
The lift's **A · After Hours** button reaches the same floor.

## Mission

1. Leave the safe reception area and cross Operations.
2. Take the east doorway into Maintenance. Jump the low shipping crates,
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
landing recovery. A crowbar hit defeats one headcrab; its reach, direction,
impact timing, and walls all matter. Each leap can damage the player once.

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

Losing focus pauses the mission. The wrist terminal shows health and the
current objective; instructions, route signs, and interaction hints live
in the room. Reduced motion disables camera bob and damage shake.

## Modules and state

- `core/afterhours-game.mjs`: pure deterministic mission state, movement,
  collision, melee, enemy navigation/leaps, interactions, and checkpoints.
  It has no browser, storage, or network dependencies.
- `public/world/levels/afterhours.js`: first-person camera, input, animation,
  sound, wrist terminal, pause, and level lifecycle through the shared kit.
- `public/world/levels/afterhours-scene.js`: room geometry, furnishing,
  lighting, signs, and power/mission feedback.
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
13 tests: movement and collision; the required jump and ceiling clearance;
melee timing/range/arc/line of sight; dodgeable enemy leaps, damage immunity,
and recovery; mission order; checkpoints; first aid; and route reachability.
A separate simulation completed the live-enemy mission using movement,
aiming, attacks, dodges, and interactions, with no teleport or retry.

`npm test` reported **212 passed / 213 total**. The remaining failure is the
existing `test/usage.test.mjs:197` status-line bridge assertion
(`meter.source` is undefined), outside this change. Full run log:
`/private/tmp/afterhours-full-test.log`.

Browser verification completed the mission using actual WASD, drag-look,
crowbar, jump, and interaction inputs: fuse collected, server room cleared,
power restored, shortcut opened, and lift extraction reached. Separate
checks verified death freezes movement, R restores the checkpoint, pause
freezes time, Escape returns to the lobby, and re-entry starts fresh.
The successful preview and lifecycle runs reported no browser errors.

The drag-look path is explicitly tested with pointer lock denied. A separate
normal Chrome window verified native mouse capture, mouse look, click to
swing, Escape to release and pause, P to resume, and returning to the lobby,
with no browser errors. Headless Chrome declined native capture, so capture
verification used the normal browser instead.
