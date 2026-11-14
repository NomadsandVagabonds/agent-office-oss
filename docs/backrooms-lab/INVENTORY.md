# Six-pocket inventory prototype

A Minecraft-inspired six-slot bar stays along the bottom of the Backrooms
picture. Number keys select a pocket; inspection expands just above the bar.
The user explicitly requested this HUD and a very small amount of combining.
It is an optional workshop system for Fable to evaluate.

## Play it

Start `node tools/backrooms-offline/preview.mjs --port 44324` and open:

`http://127.0.0.1:44324/world/dev/backrooms.html?study=flood-mark&seed=713&vhs=2&inventory=1`

The same `inventory=1` option works with `study=quiet`, `underfloor`,
`window-court`, or an ordinary generated preview. Three physical supplies
rest near the initial arrival point: a partly charged flashlight, a battery
pack and chalk. Look toward an object and press E to pick it up.

| Control | Action |
| --- | --- |
| E | Pick up the object in reach; existing room interactions still use E |
| 1–6 | Select a numbered pocket |
| Tab / I, or click a pocket | Inspect the selected object |
| Q, or the inspection button | Use the object |
| G, or Drop | Set the selected object on clear nearby floor |
| Escape | Cancel combining, then close inspection; with inventory closed, leave the visit as before |

The inspection panel pauses room hazards, movement, water exposure and battery
use. It releases pointer lock; click the scene after closing to resume mouse
look. Buttons also support touch. On narrow pictures the camcorder stamp and
interaction prompt move above the bar.

## First supplies and one recipe

- **Flashlight:** a worn native voxel prop; switching it on uses the existing
  beam shader. A full pack lasts 180 seconds of active play. The arrival light
  starts at 30% so the battery operation is immediately useful. A carried
  light may remain on while another pocket is selected; dropping it switches
  it off. The remaining charge survives dropping and picking it up again.
- **Battery pack + flashlight:** select the battery, choose **Fit battery**,
  then select a flashlight below. This consumes one pack and restores the
  chosen light to 100%. A full light or incompatible pair consumes nothing.
  There is no crafting grid, ingredient tree or automatic combination.
- **Chalk:** six directional floor marks. A mark points where the player is
  facing and remains when they leave and return. Wet, obstructed or uneven
  ground rejects placement without consuming chalk. The last use consumes
  the stub. Geometry is bounded to the latest 24 marks per visit.

Each physical item occupies one slot. A full bag leaves the next pickup on
the floor. Drops validate the entire path and the item's footprint, so they
cannot pass through a wall or over a step/pit lip. Item IDs, charge and chalk
uses stay attached to the object. There is no stacking, health/hunger system,
or persistence of these supplies between visits in this version.

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

Debug access: `__backrooms.inventory.report()` returns pockets, selection,
light state, physical item locations and chalk marks. Supplies and UI are
removed with the visit; all geometry and materials belong to the visit's kit.

## Verification

Eight pure model tests cover capacity, duplicate/malformed items, independent
snapshots, selection, draining, drops, atomic combinations and chalk exhaustion.
The full suite reports 283/284 passing; the existing baseline status-line test
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
