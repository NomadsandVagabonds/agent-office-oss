# Scranton Paper Co.

Floor **11** is a paper-company sitcom detour built with the existing level kit,
voxel furniture and avatar rigs. Select **Scranton Paper Co.** in the lift, or
open the direct preview below. Its staff are fictional actors; the prank does
not change project tasks or send messages to agents.

## Nothing is explained

The floor keeps the house rule for every floor of the lift: nothing on screen
is addressed to whoever is playing. There is no caption, no control legend and
no line of instructions; the controls are written down here, for developers,
and nowhere on the floor.

The words on the floor are the branch's own: door plaques, the brand wall, desk
plates, the memo, the recipe card in the kitchenette, the note on the staff
fridge, the meeting clock, the copier's display, the training slides, a
certificate, a sticky note by the sales phone, the floor plan. The one prompt
is the level kit's chip, which names the thing within reach (`E the memo`,
`E the stapler`, `E the staff fridge`, …).

Where you are in the prank is in the room rather than in a caption: the stapler
in your hand, the bowl in your hand, the countdown on the fridge, pen ticks
against the memo's four lines, the dessert wobbling on the desk and its owner
with his head in his hands. The memo is stamped when an attempt is over, one
way or the other. Touch the stapler before any prank is on and its owner puts a
hand up.

## Operation Gelatin

The memo at reception is only a memo. Reading it (**E**) is what starts an
untimed attempt. Its four lines are the prank:

1. Borrow the stapler from the assistant-to-the-regional-manager's sales desk.
2. Mix it into gelatin at the kitchenette counter.
3. Put the dessert in the staff fridge and let it set for eight active seconds.
4. Collect it and return it to the original desk.

Use **WASD** to walk, **Shift** to hurry, and drag to look around. Press **E**
near an object or click it within reach. **Q** brings the reception memo into
view from anywhere; **E**, **Q**, movement or **Escape** puts it down. Outside
a closeup, **Escape** returns to the office.

The green clock beside the memo reads `THE BOSS IS IN A MEETING` and stands at
`02:00`. **E** at it sets it running: an optional **120-second challenge**
(**E** again restarts it). The timer and fridge pause while a closeup or lift
panel is open, or the browser tab is hidden. A timeout returns the stapler and
stamps the memo; the memo or the clock starts another attempt. Leaving the
floor resets the visit. Only the fastest completed challenge is saved, in this
browser's local storage, and shown on the clock as the branch record.

Between attempts, try the copier, sales phone, meeting-room presentation,
manager's award and wall-mounted floor plan. After success, inspect the
evidence on the desk.

## What it hides

The floor is one of the long game's hideouts (`core/game.mjs`): a keycard and
three coins. Everything uses the shared models (`public/world/props/loot.js`)
and the kit's `w.loot()`, so it is banked through `office.game` the moment it
is picked up and never appears again.

- **The keycard** is set in the gelatin beside the stapler once the prank is
  done and the dessert is back on the desk: it leans on the stapler and shows
  through the jelly. **E** at the evidence takes a close look, and a moment
  later the card is out and yours. It is there only while
  `office.game.left('scranton').card` is true (`cardInJelly()` in the rules).
- **Coin 1 — the copier.** It argues through four displays and makes exactly
  one copy on the fourth go at it (`copierPays()`); the coin comes up out of
  the paper drawer with it.
- **Coin 2 — the manager's award.** Accepting it picks it up off the desk for a
  moment. The coin is where it stood.
- **Coin 3 — the conference room.** On the floor in the far corner, behind the
  table. From the door only its top edge shows over the table.

None of the coins needs the prank. Where there is no long game (`office.game`
missing: an older client, a test harness) there is no loot and everything else
is the same.

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
| `core/levels.mjs` | Lift registration: `scranton`, floor `S`, storey `3`: a card floor hiding three coins. |
| `public/world/levels/index.js` | Lazy scene loader. |
| `public/world/levels/scranton.js` | Room, collisions, actors, interactables, clocks, physical displays, and where the loot is. |
| `public/world/levels/scranton-props.js` | Custom voxel desks, copier, gelatin, award and ceiling fixtures. |
| `public/world/props/loot.js`, `public/world/levels/kit.js` | The shared coin and keycard models, and `w.loot()`. |
| `core/scranton-game.mjs` | Pure recipe state machine and timing rules; what the memo ticks; when the card is in the jelly; which go at the copier pays. |
| `test/scranton-game.test.mjs` | Recipe ordering, retries, deadlines, refrigeration, state isolation, the memo's ticks and the loot rules. |

Run the focused checks with:

```sh
node --test test/scranton-game.test.mjs test/levels.test.mjs
```

Use `npm test` for the full repository suite. The unit checks do not establish
browser playability. The scene exposes `office.level.scranton` (`state`,
`clock`, `inventory`, `spots`, `stations`, and `objective` and `message`: the
rules' own account of the prank, never drawn on the floor) for inspecting a
local run.

Verified in headless Chromium against a real daemon, reading the office's
record (`GET /api/world/game`) after each step: the stapler refused before the
memo is read; the full relaxed recipe using **E** at each station; the keycard
visible in the jelly and banked from the evidence; the copier's coin on the
fourth go and not before; the award's coin; the conference-room coin walked to
with real **W** key presses; a timed challenge started at the clock, won, and
its record shown; a second challenge left to time out; a second visit on the
same record, where none of the four places offers anything; and a visit with
`office.game` removed, with no loot and the same prank. Walkable routes from
the lift to every station and to the coin on the floor were checked by
flooding the scene's real collision map. Station positions were set directly
for the recipe checks. No browser console errors were reported.
Deadline/timeout boundaries are covered by the pure game tests. Lift-panel
pause and hidden-tab pause are implemented but were not browser-tested in this
pass.

All twelve game checks pass: nine for the recipe, three for the memo's ticks
and the loot rules.
