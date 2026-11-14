# Night Shift

Floor **N** is a short, side-on office stealth game. Its monochrome atmosphere
is a homage to Limbo, with an original office setting, employee, furniture and
workplace jokes. The scene uses real Vox meshes through the existing level kit;
it contains no borrowed game assets. The orthographic camera presents the voxel
building as a 2D cutaway.

## Clock out quietly

You came back for your badge. Cross the empty office, take the access card in
Records, use it at the security-power breaker, then reach the service elevator.
The breaker disables the final security light and opens the shutter.

Sweeping white beams build exposure before security catches you. Crouch behind
low desks, wait for the lamp's **3.2-second recalibration blackout**, and cross
when its display says **CROSS NOW**. Each lamp counts down to the next opening
and back to the next scan. Jump over the stacked paperwork.
Visible beam clipping and detection use the same cover geometry. Suspicion
fades in darkness; the small indicators above the lamps show its buildup.
Crouching bends the hips, knees and elbows while keeping the voxel body parts
at their normal size; the lowered silhouette fits beneath desk cover.

| Control | Action |
| --- | --- |
| **A / D** or **Left / Right** | Move. |
| **S / Down** | Crouch behind cover. |
| **Space**, **W** or **Up** | Jump; release before another jump. |
| **E** | Take the card, use the breaker, or clock out at the exit. |
| **P** | Pause or resume. |
| **R** | Restart the entire level. |
| **Escape** | Return to the lobby. |

Getting caught returns you to the latest dark checkpoint after a short pause.
Retries are unlimited, and an acquired keycard or disabled breaker remains
earned after a catch. **R** and leaving the floor reset the visit. Once the
shift is complete, press **E** again to return to the lobby, or **R** to replay.

Game time pauses while the tab is hidden, the browser window is unfocused, or
**P** pause is active. Instructions and progress appear on office signs and
equipment. The game does not move project tasks or send messages to agents.

## Local preview

The development preview is
[localhost:44318/?level=nightshift](http://localhost:44318/?level=nightshift).
If it is not running, start an isolated daemon from the repository:

```sh
OFFICE_PORT=44318 OFFICE_DATA_DIR=/private/tmp/nightshift-floor-preview \
  OFFICE_PROFILES_FILE=/private/tmp/nightshift-no-profiles.json \
  OFFICE_AUTO_OBSERVE_CODEX=0 OFFICE_HARNESS=0 OFFICE_DELEGATE=0 npm run dev
```

There is no dependency installation or build step. Stop the preview with Ctrl+C.

## Integration and checks

| File | Purpose |
| --- | --- |
| `core/levels.mjs` | Lift registration for `nightshift`, floor `N`. |
| `public/world/levels/index.js` | Lazy scene loader. |
| `public/world/levels/nightshift.js` | Orthographic scene, input, animation, lighting and physical signs. |
| `public/world/levels/nightshift-props.js` | Monochrome voxel furniture and articulated employee parts. |
| `public/world/levels/nightshift-worker.js` | Rigid-body crouch and walk poses, with knee joints and planted feet. |
| `core/nightshift-game.mjs` | Pure movement, collision, light detection, checkpoints and objectives. |
| `test/nightshift-game.test.mjs` | Ten checks covering rules, fully dark crossings and a complete traversal of the actual map. |

```sh
node --test test/nightshift-game.test.mjs
```

All ten rule checks pass, including a simulated run that completes the actual
map without teleporting. The two early desk gaps also have regression checks
for zero-exposure crouched crossings from seven arrival phases, with no grace
protection and a half-second reaction allowance. A separate headless Chrome playthrough used real keyboard
events to complete the entire map: movement, crouch, jumps, card, breaker and lift.
It also verified capture/respawn, manual pause, restart, lobby return and fresh
re-entry, with no console errors. Hidden/unfocused-tab pause is implemented but
was not separately browser-tested.

The pre-push full repository suite finished with 188 passing checks and one pre-existing
status-line bridge failure (`test/usage.test.mjs:197`, missing `meter.source`).
Use `npm test` to repeat that suite.

The console inspection surface is `office.level.nightshift`: `state` returns
a copy of the current game state, `paused` reports manual pause, and `map`
exposes the shared level geometry. Rendering calls `lightBeams` and
`beamPolygon` from the same core module used by detection.
