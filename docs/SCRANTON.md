# Scranton Paper Co.

Floor **S** is a paper-company sitcom detour built with the existing level kit,
voxel furniture and avatar rigs. Select **Scranton Paper Co.** in the lift, or
open the direct preview below. Its staff are fictional actors; the prank does
not change project tasks or send messages to agents.

## Operation Gelatin

Read the memo at reception to start an untimed attempt, then:

1. Borrow the stapler from the assistant-to-the-regional-manager's sales desk.
2. Mix it into gelatin at the kitchenette counter.
3. Put the dessert in the staff fridge and let it set for eight active seconds.
4. Collect it and return it to the original desk.

Use **WASD** to walk, **Shift** to hurry, and drag to look around. Press **E**
near an object or click it within reach. **Q** brings the reception memo into
view from anywhere; **E**, **Q**, movement or **Escape** puts it down. Outside
a closeup, **Escape** returns to the lobby.

The green clock beside the memo starts or restarts an optional **120-second
challenge**. The timer and fridge pause while a closeup or lift panel is open,
or the browser tab is hidden. A timeout returns the stapler; reception offers another attempt.
Leaving the floor resets the visit. Only the fastest completed challenge is
saved, in this browser's local storage.

Between attempts, try the copier, sales phone, meeting-room presentation,
manager's award and wall-mounted floor plan. After success, inspect the evidence
on the desk. Instructions, progress and jokes live on physical office objects.

## Local preview

The current development preview uses
[localhost:44318/?level=scranton](http://localhost:44318/?level=scranton).
If that preview is not already running, start an isolated daemon from the repo:

```sh
OFFICE_PORT=44318 OFFICE_DATA_DIR=/private/tmp/scranton-floor-preview \
  OFFICE_PROFILES_FILE=/private/tmp/scranton-no-profiles.json \
  OFFICE_AUTO_OBSERVE_CODEX=0 OFFICE_HARNESS=0 OFFICE_DELEGATE=0 npm run dev
```

No dependency installation or build step is needed. Stop the preview with
Ctrl+C in its terminal.

## Integration and checks

| File | Purpose |
| --- | --- |
| `core/levels.mjs` | Lift registration: `scranton`, floor `S`, storey `3`. |
| `public/world/levels/index.js` | Lazy scene loader. |
| `public/world/levels/scranton.js` | Room, collisions, actors, interactables, clocks and physical displays. |
| `public/world/levels/scranton-props.js` | Custom voxel desks, copier, gelatin, award and ceiling fixtures. |
| `core/scranton-game.mjs` | Pure recipe state machine and timing rules. |
| `test/scranton-game.test.mjs` | Recipe ordering, retries, deadlines, refrigeration and state isolation. |

Run the focused checks with:

```sh
node --test test/scranton-game.test.mjs test/levels.test.mjs
```

Use `npm test` for the full repository suite. The unit checks do not establish
browser playability. The scene exposes `office.level.scranton`
(`state`, `clock`, `inventory`, `spots`, `stations`) for inspecting a local run.

Verified in headless Chrome: full relaxed and challenge recipes using E;
walkable routes from the lift to all interaction stations; WASD movement;
memo and lift-panel pause; reach and partition guards; challenge restart;
best-time storage; and exit/re-entry. Station positions were set directly for
the recipe checks; the route check separately traversed the collision grid.
No browser console errors were reported. Deadline/timeout boundaries are
covered by the pure game tests. Hidden-tab pause is implemented but was not
separately browser-tested.

All 17 floor and game checks passed. The final full suite, including Night Shift,
finished with 188 passing checks and one unrelated status-line bridge failure
(`test/usage.test.mjs:197`) that also occurred before these floors.
