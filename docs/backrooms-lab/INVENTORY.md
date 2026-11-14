# Six-pocket inventory on connected floors

> **As merged into the level** (see `docs/BACKROOMS.md`, "What a visitor
> carries"): these systems are on by default (`opt.inventory === false` and
> the dev page's `&inventory=0` turn them off). Nothing is issued on arrival:
> supplies are placed by the seed (`supplies.js`), and `&supplies=1` on the
> dev page lays out the review set described below. The pickup prompt is the
> plain `E`. The camcorder keeps a weak lamp of its own beside the torch, and
> `env.camera.drain(share)` and `env.inventory.count(type)` exist. The rest of
> this note is the prototype as it was handed over.

This optional prototype adds a Minecraft-inspired six-slot bar, carry/inspect/
use/drop actions, basic battery fitting, four-point health and limited camera
power. The integration branch, `codex/backrooms-inventory-connected`, is based
on Fable's connected-building and payout work through `2df6bd1`. It enables
these systems together only for `opt.debug && opt.dev.inventory`.

## Play it

Start the normal daemon with `npm run dev`, then open:

`http://127.0.0.1:4317/world/dev/backrooms.html?seed=713&depths=3&inventory=1`

The existing dev page also works through a local static server that serves the
project's `/world`, `/core` and vendored-module paths. Use the same page and
query string on that server's port. Add `depth=1` or `depth=2` to start below
the first floor. Without `inventory=1`, the existing HUD and automatic
camcorder lamp remain in use.

Seven supplies appear near the initial arrival: a partly charged flashlight,
a battery pack, chalk, five sheets of paper, scissors, a wrapped snack and a
red balloon. They are issued once per visit, including when a debug visit
starts below depth zero. They are not reissued at a floor transition. There
are six pockets, so fitting a battery or dropping an object makes room for
another. Extra packs are scattered through reachable rooms on each floor.

| Control | Action |
| --- | --- |
| E | Pick up the object in reach, or use an existing room interaction |
| 1–6 | Select a numbered pocket |
| Tab / I, or click a pocket | Inspect the selected object |
| Q, or the inspection button | Use the object |
| G, or Drop | Put the selected object on clear nearby floor |
| Escape | Cancel combining, then close inspection; with inventory closed, leave the visit |

Inspection captures movement and look input and releases pointer lock.
**Opening an item card does not pause the world:** hazards, physics, the hit
cooldown and both batteries keep advancing. Click the scene after closing to
resume mouse look. Buttons also support touch.

## Supplies and combining

- **Flashlight:** switching it on uses the native beam shader. A full charge
  lasts 180 seconds of running simulation; the arrival light starts at 30%.
  It can stay on while another pocket is selected. Dropping it switches it
  off and preserves its remaining charge.
- **Battery pack + flashlight:** select the pack, choose **Fit battery**, then
  select a flashlight. One pack restores the light to 100%. A full light or
  incompatible pair consumes nothing. There is no crafting grid or automatic
  combination.
- **Battery pack + camera:** the same panel offers **Camera +2:00**. One pack
  adds up to 120 seconds, capped at full capacity. A full or depleted camera
  refuses the pack. The camera does not occupy a pocket.
- **Chalk:** six directional floor marks. Wet, obstructed or uneven ground
  rejects placement without using chalk. The final mark consumes the stub.
  Each floor retains its latest 24 marks until that floor is disposed.
- **Paper:** up to ten sheets per pocket. Pickups fill existing stacks first;
  any sheets that do not fit remain on the floor. Dropping places the whole
  selected stack. Pink slips and loose papers share ordinary paper stacks.
- **Scissors:** carry, inspect and drop. There is no generic cutting action.
- **Wrapped snack:** eating consumes the selected snack only after restoring
  one health point. Full health or a finished visit consumes nothing.
- **Red balloon:** occupies one pocket and can be offered to NPC rules as the
  selected item. Placement checks its height and nearby ceiling clearance.

Non-paper objects occupy one slot each. IDs, charge, chalk uses and paper
counts survive drops and floor handovers. Drops check the route and footprint
so objects cannot pass through walls or across an unsupported edge. There is
no hunger system or persistent supply inventory between visits.

## Visit ownership and floor ownership

The inventory model, inventory HUD, health model and camera model belong to
one visit. `index.js` creates them once, advances their clocks once per frame
and disposes them once at the end. Building a floor ahead or keeping the old
floor visible above does not create or tick another inventory or survival
controller.

Physical supplies and chalk belong to individual floor scenes and kits:

- `inventory.hang(env)` creates that floor's physical adapter, scoped NPC
  facade and scattered packs after its world is built. A floor can be hung
  below the current one before it has a player.
- `inventory.attend(env)` makes a landed floor active after its player exists.
  It preserves the carried records and seeds the starter supplies only if
  this is the visit's first arrival.
- `inventory.forget(env)` removes a retired floor's meshes and interaction
  records before its kit is disposed. It does not empty the carried pockets.

Generated supply IDs include both the floor seed and depth. Room authors must
also choose stable IDs unique across the visit for their own items; the spawn
API does not invent a prefix for caller-provided IDs. A carried item's ID is
retained when it is dropped on a later floor.

Floor health/camera wrappers check that the caller owns the current floor.
NPC item actions and physical pickups/drops make the same check. Old-floor
and prebuilt-floor handles cannot spend, grant, heal or damage the current
player. Floor `end`, `hold` and `descend` callbacks are also scoped to their
owner. Arrival state is set before ready/enter callbacks run.

## Health, camera power and transition timing

Health starts at **4/4**, shown as four pixel hearts. Accepted nonfatal hits
grant 1.25 seconds of invulnerability. Zero health ends the visit as `caught`;
healing cannot revive it. The model has no passive healing.

The camera starts **75% full with five minutes remaining**. Full capacity is
400 seconds (6:40). The upper-right camcorder battery becomes a live gauge,
blinking below one quarter. Depletion fades to black and ends the visit as
`battery`, without banking loot. The carried flashlight replaces the
automatic camcorder lamp while the prototype is enabled.

| Visit state | Camera, flashlight and hit-cooldown clocks | Damage and supply actions |
| --- | --- | --- |
| `play`, including item inspection | Run | Allowed |
| `play` while a chute holds the controls | Run | Blocked |
| `drop` between floors | Run | Blocked |
| `held` while the next floor builds | Frozen | Blocked |
| Initial `loading` / `falling` | Frozen | Blocked |
| `through` / `ending` / `done` | Frozen | Blocked |

Queued descent also blocks actions until handover. The conductor passes clock
state explicitly to `survival.update(dt, running)`; it is separate from the
action guard. Death and battery expiry latch the survival controller so a
late frame cannot end it again or restore its resources. No floor transition
resets health, charge or the remaining hit grace period.

`CAMERA_TUNING` in `camera-state.js` holds `capacity: 400`, `start: 300` and
`batterySeconds: 120`. `BATTERY_ROOM_INTERVAL = 4` in `inventory.js` tries one
extra pack per group of four non-arrival, non-exit rooms on each floor, falling
back within that group when needed. Locations are seeded; packs do not
respawn. This is an initial density for route playtests, not a guarantee that
a player passes a pack every four rooms.

The pirate is **unchanged from upstream `2df6bd1`**. Fable's cast session owns
its health integration. The original Underfloor and Flood-Mark health hooks
remain on `codex/backrooms-expansion-lab` at `2959758`; those candidate rooms
are not imported into this inventory-only branch. Existing cast behavior
therefore remains the upstream behavior until its owner integrates health.

## Room and NPC interface

The pure model's `read()` returns a detached
`{slots, selected, activeTorch, revision}` snapshot. The visit controller owns
that model; floor NPCs receive the smaller `env.inventory` facade:

- `held()` returns a detached copy of the selected item, or `null` when the
  floor cannot act. A selected flashlight includes `lit`. Possession in a
  different pocket is not holding an item.
- `torchPower()` reports the active beam for the current floor, or zero for
  an inactive floor. The light can remain on while another item is selected;
  a cone test also needs the player's position and direction.
- `consumeHeld('paper', 1)` spends exactly one selected sheet. Wrong selection
  or insufficient quantity changes nothing. Acknowledge a handoff only after
  the returned result has `ok: true`.
- `give(item)` offers a record with a stable ID. Its result includes `ok`,
  `accepted` and `remainder`. The giver keeps a rejected offer or the returned
  paper remainder. Record a successful delivery so repeated frames do not
  grant it again. It changes selection only when the selected pocket was empty.
- `physical.spawn(makeItem(type, stableId, overrides), {room: id, x, z})`
  places a floor-owned object at room-local coordinates. Invalid or duplicate
  records and unsuitable locations are rejected.

| Accepted room alias | Canonical type |
| --- | --- |
| `loose-papers`, `pink-slip` | `paper` |
| `red-balloon` | `balloon` |
| `facilities-flashlight` | `torch` |

Aliases are explicit; pink slips do not create another type or paper variant.
These hooks do not register creatures or replace another branch's item system.

`env.health.damage(1)` returns `{ok, dead}` plus the accepted hit's health
snapshot. A room should perform survivor recoil/recovery only for an accepted
nonfatal hit. An accepted fatal hit already ends the visit. Rejected damage
must not trigger a second ending; retain a legacy fallback only when
`env.health` is absent. `env.health.read()` returns
`{current,max,dead,invulnerable,cooldown,revision}`.

`env.camera.read()` returns
`{remaining,capacity,fraction,depleted,revision}`. Direct recharge applies the
power effect only; use the inventory controller to consume a pack atomically.
Only the visit loop advances these resources. Eating and recharging work
while inspecting during normal play.

Debug access: `__backrooms.inventory.report()` includes carried contents,
selection, light, health, camera, active floor, physical objects and chalk.
`__backrooms.inventory.model.read()` exposes the pure inventory snapshot.
After the dev visit ends, `window.__backroomsResult` contains its receipt.

## Exit receipt and office rewards

On `reason: 'exit'`, `kept.batteries` counts unconsumed battery packs still in
the pockets. Installed charge, dropped packs and uncollected packs do not
count. Quit, caught and battery endings return zero. Existing `kept.card`,
`kept.coins` and `kept.told` remain intact, and the original purse banks only
on exit. Battery receipts work even when no original card or tapes remain.

The office owns payment. Under `372b12a` / `2df6bd1`, a spare pack is worth one
coin, subject to the office's cap, and the jar receives only the improvement
over its previous best battery haul. Repeating the same haul pays nothing.
This branch returns the receipt through the existing path; it does not add
another payout call or integrate run reporting or the scorecard. The newer
`game.report` / scorecard contract remains with Fable. If that is integrated
later, return its card so `eggs.js` suppresses the legacy `earn` call rather
than reporting and paying the same visit through both paths.

## Files and verification

- `inventory-state.js`: pure records, stacks, selected-item consumption and
  atomic battery fitting.
- `inventory-items.js`, `inventory-world.js`: native voxel props, pickups,
  drops, chalk and floor resource ownership.
- `inventory-hud.js`, `inventory.js`: pockets, inspection, combining, the NPC
  facade and visit/floor lifecycle.
- `health-state.js`, `camera-state.js`, `survival.js`: resource rules, action
  guards, recording clocks and endings.
- `index.js`, `input.js`, `hud.js`: conductor integration, input routing and
  the existing camcorder gauge.

All 47 focused inventory/health/camera/survival/input tests pass. They cover item
capacity, identity and detached snapshots; paper remainders; selected-item
handoffs; atomic fitting/healing; depletion; and transition timing, grace and
one-time endings, plus native input routing and pointer-lock cleanup.

The final full suite with `TMPDIR=/private/tmp` and loopback access reported **395/396
passing**. The sole failure is the known status-line bridge case at
`test/usage.test.mjs:197`, reading `source` from an undefined meter. No unrelated
code was changed to address it. Syntax checks pass for all 17 JavaScript/test
files in this integration.

The connected-world browser regression passed with no browser errors. It
covers real E pickups on floors zero and one; camera, torch and grace advancing
while inspecting; and a single resource tick with an ahead floor, then again
while the previous floor is visible above. Carried IDs, paper counts, chalk
uses and health survive handover.
Arrival callbacks see `drop` and reject actions; stale floor callbacks cannot
damage, recharge, end, hold, descend or mutate inventory. Old scene and adapter
resources are disposed, and the next floor's packs have distinct IDs.

The same regression covers chute clocks with actions blocked, frozen build
waits, camera expiry during a drop ending once, and quitting during an
asynchronous build. Exiting through the actual leaving sequence returns
exactly two loose packs alongside the original coin and `told` receipt, once.
With the flag absent, no inventory HUD is created.

The normal dev page also passed live desktop and 390×844 mobile checks:
selected-item caption, hearts, E prompt, feedback, LIGHT and date do not
overlap. Native Enter, Escape and touch combining work; inspection keeps the
camera draining while movement/look input stays blocked. A live descent
preserves the same inventory HUD, health and lit torch and updates the date
stamp for the lower floor. No browser errors were observed.
