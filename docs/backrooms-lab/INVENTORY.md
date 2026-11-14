# Six-pocket inventory on connected floors

This optional prototype adds a Minecraft-inspired six-slot bar, carry/inspect/
use/drop actions, two-input crafting, four-point health and limited camera
power. The crafting branch, `codex/backrooms-crafting`, builds on the published
inventory integration at `266bb8e`, which includes Fable's connected-building
and payout work through `2df6bd1`. It enables these systems together only for
`opt.debug && opt.dev.inventory`.

## Play it

Start the normal daemon with `npm run dev`, then open:

`http://127.0.0.1:4317/world/dev/backrooms.html?seed=713&depths=3&inventory=1`

The existing dev page also works through a local static server that serves the
project's `/world`, `/core` and vendored-module paths. Use the same page and
query string on that server's port. Add `depth=1` or `depth=2` to start below
the first floor. Without `inventory=1`, the existing HUD and automatic
camcorder lamp remain in use.

Nine supplies appear near the initial arrival: a partly charged flashlight,
a battery pack, chalk, five sheets of paper, scissors, a wrapped snack and a
red balloon, plus a lighter and adhesive tape. They are issued once per visit,
including when a debug visit starts below depth zero. They are not reissued at
a floor transition. There are six pockets, so fitting a battery or dropping
an object makes room for another. Extra packs, lighter, tape and paper are
scattered through reachable rooms on each floor.

| Control | Action |
| --- | --- |
| E | Pick up the object in reach, or use an existing room interaction |
| 1–6 | Select a numbered pocket |
| Tab / I, or click a pocket | Inspect the selected object |
| Q, or the inspection button | Use the object |
| F | Toggle the mounted flashlight, or the selected loose flashlight |
| G, or Drop | Put the selected object on clear nearby floor |
| Escape | Cancel combining, then close inspection; with inventory closed, leave the visit |

Inspection captures movement and look input and releases pointer lock.
**Opening an item card does not pause the world:** hazards, physics, the hit
cooldown, camera power and any emitting flashlight keep advancing. Click the
scene after closing to resume mouse look. Buttons also support touch.

## Supplies and combining

Choose **Combine** on a compatible item to open two ingredient boxes. The
selected item fills the first box; choose another pocket or the built-in
camera for the second. The preview describes the result, and **Craft** performs
it. Either ingredient order works. For a paper fire, the minus/plus controls
choose one to ten sheets from the selected stack, starting at one sheet.
Invalid pairs, stale ingredients and rejected world placement spend nothing.

- **Flashlight:** switching it on uses the native beam shader. A full charge
  lasts 180 seconds of actual illumination; the arrival light starts at 30%.
  A loose flashlight emits only while its pocket is selected. Selecting
  another pocket hides its beam and stops its drain; selecting it again
  restores the armed light. Dropping switches it off and preserves charge.
- **Battery pack + flashlight:** one pack restores the light to 100%. A full
  light refuses the pack without consuming it.
- **Battery pack + camera:** one pack adds up to 120 seconds, capped at full
  capacity. A full or depleted camera refuses the pack. The built-in camera
  appears as a crafting target and does not occupy a pocket.
- **Tape + flashlight:** consumes the tape to prepare that same flashlight
  for mounting. Its identity, charge and switch state stay intact. An already
  prepared light refuses another roll.
- **Prepared flashlight + camera:** mounts the light without spending either
  item. Only one light can be mounted; it still occupies its original pocket,
  but can emit while another item is held. Mounting does not switch it on.
  **F** prioritizes the mounted light, and only one flashlight can emit at a
  time. Dropping or giving away the light clears the mount; its tape remains
  fitted so it can be picked up and mounted again.
- **Chalk:** six directional floor marks. Wet, obstructed or uneven ground
  rejects placement without using chalk. The final mark consumes the stub.
  Each floor retains its latest 24 marks until that floor is disposed.
- **Paper:** up to ten sheets per pocket. Pickups fill existing stacks first;
  any sheets that do not fit remain on the floor. Dropping places the whole
  selected stack. Pink slips and loose papers share ordinary paper stacks.
- **Paper + lighter:** places a small voxel fire on clear, dry ground. Each
  sheet burns for eight seconds, so the chosen stack contributes 8–80 seconds.
  Only those sheets are consumed after placement succeeds; the lighter stays
  in its pocket. There is no fuel meter on the lighter.
- **Scissors:** carry, inspect and drop. There is no generic cutting action.
- **Wrapped snack:** eating consumes the selected snack only after restoring
  one health point. Full health or a finished visit consumes nothing.
- **Red balloon:** occupies one pocket and can be offered to NPC rules as the
  selected item. Placement checks its height and nearby ceiling clearance.

Non-paper objects occupy one slot each. IDs, charge, fitted tape, chalk uses
and paper counts survive drops and floor handovers. Drops check the route and
footprint so objects cannot pass through walls or across an unsupported edge.
There is no hunger system or persistent supply inventory between visits.

## Visit ownership and floor ownership

The inventory model, inventory HUD, health model and camera model belong to
one visit. `index.js` creates them once, advances their clocks once per frame
and disposes them once at the end. Building a floor ahead or keeping the old
floor visible above does not create or tick another inventory or survival
controller.

Physical supplies, chalk and fires belong to individual floor scenes and kits:

- `inventory.hang(env)` creates that floor's physical adapter, scoped NPC
  facade and scattered supplies after its world is built. A floor can be hung
  below the current one before it has a player.
- `inventory.attend(env)` makes a landed floor active after its player exists.
  It preserves the carried records and seeds the starter supplies only if
  this is the visit's first arrival.
- `inventory.forget(env)` removes a retired floor's meshes and interaction
  records before its kit is disposed. It does not empty the carried pockets.

Placed fires keep burning while their old floor remains visible above. They
are disposed with that floor, not carried to the next one. Their timers follow
the same running/frozen visit states as the camera; they are advanced once
per live physical adapter rather than once per inventory model.

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

| Visit state | Camera, emitting flashlight, fire and hit-cooldown clocks | Damage and supply actions |
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

Crafting supplies use a separate seeded scatter pass. Each floor tries to
place one lighter, one tape roll and a three-to-five-sheet paper stack per
eight eligible rooms, with at least one paper stack. Arrival and exit rooms
are excluded. Placement searches reachable clear floor; supplies are not
guaranteed if no suitable location exists and do not respawn.

## Paper fires and pursuit

`FIRE_SECONDS_PER_SHEET = 8` in `crafting.js` is shared by the model, preview
and world placement. A floor supports four simultaneous fires, with a
0.45-unit placement radius and 1.1-unit overhead clearance. Fire has stepped
voxel flames, embers, smoke and a warm floor glow. It does not spread or deal
damage. Water extinguishes it, and its final second fades out. Rejected wet,
blocked or unsupported ground, insufficient headroom and the fire limit leave
the paper and lighter untouched.

A hostile pirate within six units of a visible fire retreats, including while
watched. The query rejects obstructed sightlines and a different floor height.
`fire-fear.js` moves it away at 2.7 units per second and remembers the last
fire for 1.5 seconds after losing sight. Movement still checks walls and drop
edges; a blocked retreat holds off pursuit instead of running the normal
attack in the same frame. Friendly cutouts do not react, and a fire cannot
undo an already-caught state.

The pirate change is this small fear hook only. Fable's cast session still
owns its health integration; its existing attack and ending behavior remains
upstream-owned. The original Underfloor and Flood-Mark health hooks remain on
`codex/backrooms-expansion-lab` at `2959758`; those candidate rooms are not
imported into this inventory branch.

## Room and NPC interface

The pure model's `read()` returns a detached
`{slots, selected, activeTorch, mountedTorch, revision}` snapshot.
`activeTorch` is the armed lamp ID; emission also requires that it is selected
or mounted. A torch record's `prepared` flag survives drops, while the mount
belongs to the visit model and clears when that item leaves the pockets.
The visit controller owns that model; floor NPCs receive the smaller
`env.inventory` facade:

- `held()` returns a detached copy of the selected item, or `null` when the
  floor cannot act. A selected flashlight includes `lit`. Possession in a
  different pocket is not holding an item.
- `torchPower()` reports the active beam for the current floor, or zero for
  an inactive floor. A mounted light can remain on while another item is
  selected; a loose light cannot. A cone test also needs the player's position
  and direction.
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
- `fire.threatAt(x, z, y)` returns the nearest visible active fire in range,
  with its world position, radius and remaining time, or `null`. Inactive
  floor facades cannot expose a threat to the current cast. Actors decide
  their own response; the query itself does not move or damage anything.

Crafting uses stable references `{slot, id}` or the virtual
`CAMERA_INPUT = {device: 'camera'}`. `previewCraft(snapshot, refs, {paperCount})`
describes a pair without mutation. `model.craft(refs, {paperCount, camera,
ignite})` revalidates those references and consumes ingredients only after a
synchronous recharge or placement succeeds. Reentrant mutation is blocked
during that callback. The controller supplies the current floor's guarded
camera and fire services. Legacy battery `combine` and `rechargeCamera` entry
points remain available.

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
selection, light, health, camera, active floor, physical objects, chalk and
fires.
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

- `inventory-state.js`, `crafting.js`: pure records, stacks, held/mounted light
  state, recipe previews and atomic ingredient consumption.
- `inventory-items.js`, `inventory-world.js`: native voxel props, pickups,
  drops, chalk and floor resource ownership.
- `inventory-fire.js`: floor-owned voxel fires, placement limits and visible
  threat queries. `fire-fear.js`, `pursuer.js`: the pirate's retreat hook.
- `inventory-hud.js`, `inventory.js`: pockets, inspection, combining, the NPC
  facade and visit/floor lifecycle.
- `health-state.js`, `camera-state.js`, `survival.js`: resource rules, action
  guards, recording clocks and endings.
- `index.js`, `input.js`, `hud.js`: conductor integration, input routing and
  the existing camcorder gauge.

The focused pass covers **63/63** inventory, crafting, health, camera, survival
and fire-response tests. These exercise stale and duplicate inputs, safe
reentry, rejected placement, exact paper consumption,
camera/flashlight fitting, tape and mounting, held-versus-mounted charge
drain, health/depletion, one-time endings and safe retreat. The earlier six
input tests cover native routing and pointer-lock cleanup.

The full suite with `TMPDIR=/private/tmp` and loopback access reports
**417/418 passing**. The sole failure is the known status-line bridge case at
`test/usage.test.mjs:197`, reading `source` from an undefined meter. No unrelated
code was changed to address it. The new pure crafting and inventory modules
also pass syntax checks.

The previous connected-world browser regression passed with no browser errors.
It covers real E pickups on floors zero and one; camera, torch and grace advancing
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

Before the new crafting panel, the normal dev page also passed live desktop
and 390×844 mobile checks:
selected-item caption, hearts, E prompt, feedback, LIGHT and date do not
overlap. Native Enter, Escape and touch combining work; inspection keeps the
camera draining while movement/look input stays blocked. A live descent
preserves the same inventory HUD, health and lit torch and updates the date
stamp for the lower floor. No browser errors were observed.

The crafting/fire browser regression also passed in the real connected game,
with no browser errors. It covers **F** for selected and mounted lights;
native Enter to prepare and mount; cancelling without consumption; camera
recharge; a three-sheet, 24-second fire; continued clocks with the bag open;
and carried state across an actual two-floor handover. Dropping a mounted
light clears its mount while preserving fitted tape and charge. The original
plinth pirate retreats more than two units during the half-second test,
including its initial step off the plinth. Flag-off behavior remains intact.

The physical-fire harness verifies short wall occlusion, actor-body exclusion
from sight rays, nearest-fire and height limits, four concurrent fires, and
80 expiry/reuse cycles without new rig allocations. Wet, blocked, low-ceiling
and capped placements preserve paper; rising water extinguishes a fire.
Desktop and 390×844 checks cover both ingredient boxes, quantity controls,
native Enter/Space and touch activation, focus recovery and overlay spacing.
