# Six-pocket inventory prototype

A Minecraft-inspired six-slot bar stays along the bottom of the Backrooms
picture. Number keys select a pocket; inspection expands just above the bar.
The user explicitly requested this HUD, simple combining, four-point health
and a limited camera battery. It is an optional workshop system for Fable to
evaluate; all four systems are enabled together by `inventory=1`.

## Play it

Start `node tools/backrooms-offline/preview.mjs --port 44324` and open:

`http://127.0.0.1:44324/world/dev/backrooms.html?study=flood-mark&seed=713&vhs=2&inventory=1`

The same `inventory=1` option works with `study=quiet`, `underfloor`,
`window-court`, or an ordinary generated preview. Seven physical supplies
rest near the initial arrival point: a partly charged flashlight, a battery
pack, chalk, five sheets of paper, scissors, a wrapped snack and a red balloon.
Look toward an object and press E to pick it up. There are still only six
pockets; fitting the battery frees a pocket, or drop an item to make room.
Additional packs are scattered through reachable rooms using the visit seed.

| Control | Action |
| --- | --- |
| E | Pick up the object in reach; existing room interactions still use E |
| 1–6 | Select a numbered pocket |
| Tab / I, or click a pocket | Inspect the selected object |
| Q, or the inspection button | Use the object |
| G, or Drop | Set the selected object on clear nearby floor |
| Escape | Cancel combining, then close inspection; with inventory closed, leave the visit as before |

The inspection panel pauses room hazards, movement, water exposure, the hit
cooldown and both batteries. It releases pointer lock; click the scene after closing to resume mouse
look. Buttons also support touch. On narrow pictures the camcorder stamp and
interaction prompt move above the bar.

## Supplies and simple combining

- **Flashlight:** a worn native voxel prop; switching it on uses the existing
  beam shader. A full pack lasts 180 seconds of active play. The arrival light
  starts at 30% so the battery operation is immediately useful. A carried
  light may remain on while another pocket is selected; dropping it switches
  it off. The remaining charge survives dropping and picking it up again.
- **Battery pack + flashlight:** select the battery, choose **Fit battery**,
  then select a flashlight below. This consumes one pack and restores the
  chosen light to 100%. A full light or incompatible pair consumes nothing.
  There is no crafting grid, ingredient tree or automatic combination.
- **Battery pack + camera:** the same combining panel offers **Camera +2:00**.
  This consumes one pack and adds up to 120 seconds, capped at full capacity.
  A full camera refuses the pack without consuming it. The camera is built
  into the recording and does not occupy a pocket.
- **Chalk:** six directional floor marks. A mark points where the player is
  facing and remains when they leave and return. Wet, obstructed or uneven
  ground rejects placement without consuming chalk. The last use consumes
  the stub. Geometry is bounded to the latest 24 marks per visit.
- **Paper:** up to ten sheets in each pocket, with a visible count. Pickups
  top up existing stacks before starting a new one. If only some sheets fit,
  the remainder stays on the floor. Drop places the entire selected stack.
  Pink slips and loose papers count as the same material and share stacks.
- **Scissors:** chipped red handles and steel blades. Carry, inspect and drop;
  cutting interactions can be added by a room later.
- **Wrapped snack:** a sealed oat bar. **Eat** or Q consumes the selected snack
  and restores exactly one health point. Eating at full health wastes nothing;
  a finished run cannot be revived. `ITEM_DEFS.snack.healAmount` is `1`.
- **Red balloon:** a stepped red balloon on a cord, occupying one pocket.
  The selected balloon is available to NPC rules as a held item. Its full
  height is considered when placing it on the floor or under a low ceiling.

Each object other than paper occupies one slot. A full bag leaves any sheets
or objects that do not fit on the floor. Drops validate the entire path and
the item's footprint, so they cannot pass through a wall or over a step/pit
lip. IDs, charge, chalk uses and stack quantities survive dropping and picking
up again. There is no hunger system or persistence of these supplies between
visits in this version.

## Health and camera power

Health starts at **4/4**, shown as four small pixel hearts above the pockets.
At zero the visit ends as `caught`. Accepted hits grant 1.25 seconds of
invulnerability, advanced only by active gameplay. There is no passive healing.
Underfloor grabs and Flood-Mark drowning recoveries each cost one point.
Surviving a mascot catch also costs one; it retreats for 14–24 seconds and
leaves the player in control with the keycard. Fatal hits retain the caught
presentation. The original behavior remains unchanged without `inventory=1`.

The camera starts **75% full with five minutes remaining**. Its full capacity
is 400 seconds (6:40); each pack adds 120 seconds up to that cap. The existing
upper-right camcorder battery is now a live gauge and blinks below one quarter.
At zero it fades to black and ends the run as `battery`, without banking loot.
Both health and camera charge reset on the next visit.

Timing lives in `CAMERA_TUNING` in `camera-state.js`:

| Setting | Initial playtest value |
| --- | --- |
| `capacity` | 400 seconds |
| `start` | 300 seconds |
| `batterySeconds` | 120 seconds |

The camera target label derives from this tuning. In `inventory.js`,
`BATTERY_ROOM_INTERVAL = 4` tries one extra pack per group of four non-arrival,
non-exit rooms, falling back within that group if no suitable floor is found.
The seed fixes pickup locations; packs do not respawn during a visit. Supply
density and durations are initial playtest values, not a final difficulty curve.

The original reward coins and escape keycard remain in `loot.js`; their
carried display and bank-on-exit behavior are separate. With inventory enabled,
the carried flashlight replaces the automatic camcorder lamp. With the flag
absent the existing behavior and HUD remain intact. Manual light can be used
in rooms that suppress the automatic lamp.

## Code and adoption

- `inventory-state.js`: pure model, item definitions and atomic combination.
- `inventory-items.js`: original native Vox models.
- `inventory-world.js`: grounded pickups, safe drops, chalk and resource ownership.
- `inventory-hud.js`: six slots, inspection, combination targets and focus behavior.
- `inventory.js`: controller, feedback and arrival supplies for this preview.
- `health-state.js` / `camera-state.js`: pure health and recording-time rules.
- `survival.js`: visit guards, active-time clocks, damage feedback and endings.

`index.js` creates the system only for `opt.debug && opt.dev.inventory` and
owns its input, pause, beam and disposal hooks. The dev page turns the query
parameter into that option. No generator/deck, reward persistence or room
builder changes are required. Before adopting it, Fable can choose supply
placement, charge duration, stack rules and whether inspection should pause.
The arrival supplies are a review convenience, not a production loot table.

Rooms can later place an item through
`env.inventory.physical.spawn(makeItem(type, stableId, overrides), {room:id,x,z})`.
Coordinates are local to that room and instances need stable unique IDs.
The adapter rejects duplicate IDs and unsuitable placements. `model.add()`
returns a result rather than destroying a rejected item. `read()` returns a
detached inventory snapshot. Do not spend an item before its world action
has successfully completed.

## Wave 3 NPC integration contract

The shared Gemini plan describes `hand.js`, but that module is not yet in
this checkout. The inventory exposes a small interface for that adapter;
it does not create or overwrite `env.hand`, register NPCs or modify Gemini's
branch. Keep one source of item ownership when the two systems are joined.

| Room item name / accepted alias | Canonical inventory type | Planned interaction |
| --- | --- | --- |
| Loose Papers / `loose-papers` | `paper` | Retention Clerk takes one selected sheet |
| Pink Slip / `pink-slip` | `paper` | Efficiency Partners offer ordinary paper |
| Red Balloon / `red-balloon` | `balloon` | Fun Committee checks the selected pocket |
| Facilities Flashlight / `facilities-flashlight` | `torch` | Blackout Bay checks active light and the player's beam direction |

`makeItem()` and the physical spawn API normalize these explicit aliases.
Pink slips do not introduce another inventory type or split paper stacks.

- `env.inventory.held()` returns a detached copy of the **selected** item,
  or `null`. A selected flashlight also includes `lit`. A balloon somewhere
  else in the bag is not held. The active beam can remain on while selecting
  another item; use `torchPower()` for actual light state, plus the player's
  position/direction for the room's cone test. Possession alone is not light.
- `env.inventory.consumeHeld('paper', 1)` consumes exactly one selected
  sheet. It refuses a wrong selection or insufficient quantity without
  mutation. Only acknowledge the Clerk's successful handoff after `ok`.
- `env.inventory.give({id:stableId,type:'pink-slip',quantity:1})` offers a
  sheet. It can fill an existing stack even with all six pockets occupied.
  It selects the receiving pocket only if the current pocket was empty;
  it never replaces a selected flashlight or balloon. The result includes
  `ok`, `accepted` and `remainder`. On failure, the NPC keeps the offer; on a
  partial transfer, keep only the returned remainder. Record successful
  delivery in the NPC's state so repeated frames do not grant it again.

These item hooks do not implement Gemini's creatures. Paper, scissors and
balloons have no generic Use effect; snacks now heal, and packs can recharge
the camera or a flashlight.

NPCs and hazards can call `env.health.damage(1)`. Its `{ok, dead}` result tells
the caller whether to perform its survivor recoil/recovery; zero health ends
the run automatically, so do not call `end` again for an accepted fatal hit.
Paused, invulnerable, loading and finished visits reject damage. Keep an
explicit legacy fallback when `env.health` is absent. `env.health.read()`
returns `{current,max,dead,invulnerable,cooldown,revision}`.

`env.camera.read()` exposes `{remaining,capacity,fraction,depleted,revision}`.
Use the inventory's recharge action to consume a pack; direct `recharge()` is
the power effect only. Only the visit loop advances these clocks. Eating and
recharging are allowed while inspecting, but cannot revive a finished visit.

Debug access: `__backrooms.inventory.report()` returns pockets, selection,
light state, physical item locations and chalk marks. Supplies and UI are
removed with the visit; all geometry and materials belong to the visit's kit.

## Verification

Thirty-two focused model tests cover capacity, duplicate/malformed items, independent
snapshots, selection, draining, drops, atomic combinations, chalk exhaustion,
paper transfer/remainders, alias normalization, selected-item handoffs, snack
healing, hit cooldowns, death, camera recharge and one-time depletion.
The full suite reports 307/308 passing; the existing baseline status-line test
still fails at `test/usage.test.mjs:197` (`source` on an undefined reading).

Browser checks and the native-Three adapter harness exercise actual pickup,
use, drop and combining controls; full-bag refusal; charge/use preservation;
thin-wall and blocked-drop safety; wet chalk refusal; repeated pickup/drop
resource reuse; desktop/mobile layout and keyboard focus; and disposal.
Integrated regressions also verify that inspection freezes the Underfloor
shadow encounter and Flood-Mark submersion, a new visit resets all supplies,
and the ordinary inventory-disabled preview still collects and banks coins.
At a 390×844 touch viewport, the six pockets and inspection fit within the
4:3 picture; physical pickup, use, combination, marking, drop and close all
work without overlapping the camcorder stamp or interaction prompt.

Expanded-item checks exercise real E pickups and partial paper remainders,
ten-sheet drop/re-pick, selected-paper consumption, pink-slip grants without
replacing a held balloon, and safe refusal of unavailable item uses. All seven
arrival props fit in the Quiet, Underfloor, Flood-Mark and Window Court studies.
The native-Three harness conserves all sheets across 40 alternating stack
drop/pickup cycles without resource growth, and validates balloon clearance
under ceilings, adjacent beams, elevated spawn positions and drop paths.

Health/camera checks cover actual keyboard and touch Eat/recharge controls,
full-resource refusal without item loss, paused clocks, the hit grace period,
physical scattered-pack pickup, deterministic locations for the same seed,
death and battery-ending cleanup, and fresh-visit reset. Runtime hazard checks
cover surviving/fatal Underfloor, Flood-Mark and mascot hits, including legacy
no-health behavior. Desktop and 390×844 mobile layouts keep hearts, pockets,
camera target, E prompt and camcorder stamps separate; reduced motion disables
the low-camera blink. No browser errors were observed.
