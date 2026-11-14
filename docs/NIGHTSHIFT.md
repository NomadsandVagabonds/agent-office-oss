# Night Shift

Floor **9** is a short, side-on office stealth game. Its monochrome atmosphere
is a homage to Limbo, with an original office setting, employee, furniture and
workplace jokes. The scene uses real Vox meshes through the existing level kit;
it contains no borrowed game assets. The orthographic camera presents the voxel
building as a 2D cutaway.

## Nothing is explained

The floor keeps the house rule for every floor of the lift: nothing on screen
is addressed to whoever is playing. There is no caption, no instruction card,
no control legend and no objective banner. The controls are written down here,
for developers, and nowhere on the floor.

What is written on the floor is what this office would have up anyway:

| Words | Where |
| --- | --- |
| `9 · NIGHT SHIFT`, `EXIT`, `RECORDS` | Door and department plaques. |
| `LOST PROPERTY · ONE STAFF BADGE · HANDED IN TO RECORDS` | A slip pinned by the door: the errand, as the office would put it. |
| `NO OVERTIME HAS BEEN APPROVED`, `THE LAST ONE OUT GETS THE LIGHTS` | Two notices nobody took down. |
| `PERSONNEL`, `ARCHIVE`, `SECURITY POWER`, `TIME CLOCK` | Labels on desks, boxes, the breaker and the clock. |
| `SCAN 1.8` · `RECAL 2.1` · `NO POWER` · `STANDBY` | Each lamp's own readout: what it is doing and for how many more seconds. |
| `UNAPPROVED OVERTIME · RETURN TO YOUR STATION` | The same readouts, for the moment security has you. |
| `PLEASE REMEMBER TO CLOCK OUT.` then `SHIFT COMPLETE. GO HOME.` and `SECURITY ENCOUNTERS: n` | The board over the way out. |

The one prompt is the level kit's chip, which only names the thing within
reach: `E the staff badge`, `E the security breaker`, `E the time clock`, and
once you have clocked out, `E the lift`. The names come from `interactable()`
in the rules.

Everything else is there to be watched. A beam stops at a desk top and leaves
the space behind it dark. A lamp goes out while it recalibrates and its readout
turns pale. The pips above a lamp fill as suspicion builds. Without a badge the
breaker's lever only rattles and its card slot blinks; with one, the lever
drops, the last lamp dies and the shutter rolls up. The jacket has no ID on it
until the badge is found.

## Clock out quietly

You came back for your badge. Cross the empty office, take the access card in
Records, use it at the security-power breaker, then punch the time clock by the
service lift. The breaker disables the final security light and opens the
shutter.

Sweeping white beams build exposure before security catches you. Crouch behind
low desks, wait for a lamp's **3.2-second recalibration blackout**, and cross
while its readout counts `RECAL` down. Jump over the stacked paperwork. Visible
beam clipping and detection use the same cover geometry. Suspicion fades in
darkness. Crouching bends the hips, knees and elbows while keeping the voxel
body parts at their normal size; the lowered silhouette fits beneath desk
cover.

| Control | Action |
| --- | --- |
| **A / D** or **Left / Right** | Move. |
| **S / Down** | Crouch behind cover. |
| **Space**, **W** or **Up** | Jump; release before another jump. |
| **E** | Take the badge, use the breaker, clock out; after that, the lift home. |
| **P** | Pause or resume (the lamp readouts say `STANDBY`). |
| **R** | Start the shift again. |
| **Escape** | Return to the office. |

Getting caught returns you to the latest dark checkpoint after a short pause.
Retries are unlimited, and an acquired badge or disabled breaker remains earned
after a catch. **R** and leaving the floor reset the shift. Game time pauses
while the tab is hidden, the browser window is unfocused, or **P** pause is
active. The game does not move project tasks or send messages to agents.

## What it hides

The floor is one of the long game's hideouts (`core/game.mjs`): a keycard and
two coins.

- **The keycard is the access card in Records.** It is drawn with the shared
  `keycard()` model (`public/world/props/loot.js`) drained of its colour by
  `staffCard()`, so that it is recognisable and still belongs to the floor.
  Taking it only puts it in your hand, as before. It becomes the office's when
  you clock out with it: the scene then calls
  `office.game.take('nightshift', 'card')`. If the card was found on an earlier
  visit the shift plays exactly the same (the breaker still wants the badge)
  and nothing new is banked.
- **Coin 1** hangs in the first gap between desks, directly under the first
  lamp and too high to walk into. You stand up where the beam sweeps and jump.
- **Coin 2** hangs above the archive boxes, out of reach of any jump from the
  floor. You land on the stack, in the open, and jump again; the second lamp
  looks at the top of the stack at the start of every scan.

Touching a coin takes it, and it is the office's at once
(`office.game.take('nightshift', 'coin', n)`). A catch does not give it back,
**R** does not hang it up again, and a later visit does not show it.

The coins are the house's own coin in its own gold: the single warm thing on a
black-and-white floor, so that a player knows it for what it is. The purse that
shows for a moment when something is picked up is the house's too.

The rules for all of this are in the pure module and tested in Node:
`LEVEL.coins` (where they hang), `COIN.radius`, `createGame(left)` (told what
the floor still hides, as `office.game.left('nightshift')` gives it),
`state.left` (what is still there), `state.took` (what this visit has earned)
and `restart(state)` (**R**: a fresh shift given only what was left). The scene
reads that state and hands `took` to the office. Where there is no long game
(`office.game` missing: an older client, a test harness) `createGame()` is told
nothing, the floor hides nothing, and everything else is the same.

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
| `core/levels.mjs` | Lift registration for `nightshift`, floor `N`: a card floor hiding two coins. |
| `public/world/levels/index.js` | Lazy scene loader. |
| `public/world/levels/nightshift.js` | Orthographic scene, input, animation, lighting, the office's own words, and handing what was earned to `office.game`. |
| `public/world/levels/nightshift-props.js` | Monochrome voxel furniture, articulated employee parts, and `staffCard()`. |
| `public/world/levels/nightshift-worker.js` | Rigid-body crouch and walk poses, with knee joints and planted feet; the badge on the jacket. |
| `public/world/levels/loot.js`, `public/world/props/loot.js` | The shared coin and keycard models, and the turning pickup the coins are drawn with. |
| `core/nightshift-game.mjs` | Pure movement, collision, light detection, checkpoints, objectives, and the hidden coins and keycard. |
| `test/nightshift-game.test.mjs` | Sixteen checks: the rules, fully dark crossings, complete traversals of the actual map, and the long game. |

```sh
node --test test/nightshift-game.test.mjs
```

All sixteen rule checks pass. Ten are the original rules, including a simulated
run that completes the actual map without teleporting and regression checks for
zero-exposure crouched crossings of the two early desk gaps from seven arrival
phases. Six cover the long game: the floor hides exactly the coins the office
counts and offers nothing when nothing is left (or nobody keeps score); each
coin hangs clear of the furniture, inside a lamp's sweep, and only where the
real map lets a jump reach it; a coin stays taken through a catch and a
restart; the keycard is banked only on clocking out, and once; what is within
reach is only ever named; and the real map can be cleared with both coins and
the keycard without teleports.

A headless Chromium playthrough then ran the real floor against a real daemon,
through the floor's own key listeners (key events sent to the window one
decision a frame, with real key presses for pause and the last **E**): the
first coin, a deliberate catch, the respawn, the second coin from the stack,
the breaker tried without the badge (it stays shut), **R**, the badge, the
breaker, the time clock and the lift home. The office's record
(`GET /api/world/game`) was read after each step: each coin appeared there the
moment it was touched and stayed through the catch and the restart, and the
keycard appeared only after clocking out. A second visit on the same record
offered nothing and banked nothing, and a visit with `office.game` removed
played the same with no loot. No console errors were reported.
Hidden/unfocused-tab pause is implemented but was not separately
browser-tested.

Use `npm test` for the full repository suite.

The console inspection surface is `office.level.nightshift`: `state` returns
a copy of the current game state (including `left` and `took`), `paused`
reports manual pause, `objective` is the rules' own sentence about the errand
(never drawn on the floor), and `map` exposes the shared level geometry.
Rendering calls `lightBeams` and `beamPolygon` from the same core module used
by detection.
