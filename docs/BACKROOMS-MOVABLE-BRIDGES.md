# Movable scenery and bridge support

Review branch: `codex/backrooms-movable-bridges`, based on the working branch
at `62d609c`. This adds the shared machinery requested by the suburb session.
It does not change the Culvert, suburb room layouts, or the dealt room mix.

## What players do

- Aim at loose scenery and press **E** (or tap the hand) to grab/release it.
  Walk to drag it using the same collision rules as chairs, desks and trolleys.
- A timber-backed cutout also offers **R** / a tappable camcorder prompt to
  lower or raise it. Lowering takes 0.45 seconds and reserves the swept volume.
- A laid panel becomes walkable only after the animation finishes. Grounded
  creatures use the same new floor and refreshed paths. Existing flying and
  phasing creature rules remain in effect.
- Both ends must rest on level ground across the panel's entire width. A short
  panel, floating stack, wall, low ceiling or body in the sweep prevents a tip.
- A bridge spanning a gap stays put; neither visitors nor creatures can slide
  it out from under somebody. Retrieve it from the hinge bank, with the panel
  clear. Raising immediately reserves its sweep so nobody can walk onto it.
- A room with a way on from both banks may pass `eitherEnd: true` to
  `movableCutout`: that panel may then be raised from the far bank too, behind
  whoever crossed. It still stands up on its hinge bank. (Added by the lead for
  the culvert, where pulling the bridge up behind you is the point.)

The visual distinction is construction: loose panels have exposed timber
rails, while fixed scenery retains its braces, feet or attachment to the set.
The existing targeting brackets and E prompt apply to all registered objects.
Use this helper consistently for a family of loose panels; do not make one
identical-looking copy movable and another fixed.

## A cutout that can become a bridge

```js
import { movableCutout } from '../movable-cutout.js';

export function build(c) {
  // First build the banks and pit, with accurate floorY/headY, as usual.
  const panel = movableCutout(c, {
    x: -1.5, z: 1.8, width: 1.3, height: 2.7,
    facing: 2, front: 'streetB', label: 'Scenery panel',
  });
  if (panel) c.bridgeRoute(panel, {
    stand: { x: -1.5, z: 2.55 },
    path: [{ x: -1.5, z: 1.35 }],
  });
}
```

All coordinates are room-local. `facing` is a quarter turn: 0 falls toward +z,
1 toward +x, 2 toward −z, 3 toward −x. `height` becomes the bridge length.
The helper borrows the suburb's existing painted-front and plywood atlas and
builds its own timber rails. Width is 0.72–4m, height 0.8–4m, thickness 8cm.
The default is 1.3 × 2.7m. No extra texture or physics dependency is needed.

In the example, a pit from z = −0.85 to +0.85 can be spanned after dragging
the hinge from z = 1.8 to 1.35. Give the opposite bank another usable panel
or another accessible solution when the room can be entered from that side.
The regression fixture demonstrates two independent bank solutions.

`bridgeRoute` records a solution witness, not an exemption from validation.
The validator checks the starting point is reachable, rehearses each drag
with the actual movement rules, checks the lowering sweep and both supports,
then floods the new floor. It repeats this from **every doorway** without
moving live objects. An inaccessible far-bank prop cannot justify a route.
Bad plans keep the existing room rescue in force; inspect warnings and
`rt.bridgePuzzleVerified` during development.

Witnesses have at most eight hinge waypoints, 16m total travel, and eight plans
per room. The visitor keeps the same offset from the hinge while dragging.
Plans are attempted in author order; this is a conservative bounded solver,
not a search over every possible arrangement or arbitrary player mistakes.
Build required-route puzzles so panels cannot be abandoned where they block
their own recovery; use alcoves or optional alternate paths, and playtest.

## Register another room-built object

```js
import { Batch } from '../kit.js';

const b = new Batch();
b.box(2.75, 0, 2.75, 3.25, .6, 3.25, [.45, .32, .18]);
const box = c.movable(c.dynamic(b, { pivot: [3, 0, 3] }), {
  type: 'prop', label: 'Wooden box',
  foot: { x: 3, z: 3, x0: 2.75, x1: 3.25, z0: 2.75, z1: 3.25,
    bottom: 0, top: .6 },
});
```

Pass one room-owned Group holding the whole movable assembly. Its footprint
must enclose all of its geometry; each dimension is at most 4m. Do not also
add a static `c.solid` for it, or it leaves an invisible body behind.
The registry handles detaching it into the world, lighting, room ownership,
collision and path revisions. Use `env.barricades.move()` for scripted moves;
the record's `translate()` is the internal already-checked commit/rollback.
`remove()` unregisters it. Existing `takeAway`/`bringBack` also hide/restore a
bridge's floor and invalidate navigation.

## Room integration constraints

- Build a real hole in both visible geometry and `rt.floorY`. If the ceiling
  is level, `rt.headY = (x,z) => c.H - rt.floorY(x,z)` expresses that correctly.
  A bridge raises the floor and reduces headroom by its own thickness.
- Keep `rt.clip` traversable across the intended bridge. An invisible pit
  fence or unconditional room hazard still blocks/kills the player. A pit
  hazard must check the current `world.floorY`, not just its static rectangle.
- Bank support uses the underlying terrain, not another movable. Allow about
  0.32m of bearing at each end (22cm minimum plus a conservative 10cm sample).
  Keep bridges inside one room and away from folds, exits and ways down.
- No stacking, free yaw rotation, slopes, falling furniture or room-to-room
  bridge spans in this first pass. Upright props drag only on level ground.
- The existing `barricadesEnabled` switch applies. `c.movable()` returns null
  with the feature off, retaining a fixed body. Required bridge rooms need a
  fixed crossing or should be excluded when the feature is off; do not rely
  on the validator's last-resort invisible flat floor as shipped content.
- This prototype is for a local visit. Movable transforms are not replicated
  through the co-op authority protocol yet. Do not deal required movable
  bridge puzzles into shared visits until that protocol carries them.

## Local review

```sh
node tools/blockrooms/build.mjs dist
cp -R public/world/dev dist/world/dev
node tools/blockrooms/serve.mjs dist 44343
```

Open `/world/dev/backrooms.html?seed=7&bridgestudy=1&pursuer=0&inventory=0&mute=1&vhs=0`.
The review-only start room has a tall panel, a short panel and a generic box.
There are side paths, so this demonstration never cuts off generated doors.
The browser controls reposition the visitor only; dragging/tipping uses E,
WASD and R, exactly as in play. A status line reports the initial solution.

Automated coverage in `test/backrooms-bridges.test.mjs` includes quarter-turned
and raised rooms, mesh/body agreement, a non-catalogue box, feature-off,
animated floor activation, player and grounded-creature traversal, occupied
or obstructed sweeps, too-short panels, both-entry solution checks, and
surface removal/restoration. The battery-ending HUD stub is updated for the
new prompt. The controls paragraph in `menu.js` should be retained alongside
the account branch's menu additions if that file conflicts at merge time.

Verified on 15 November 2026:

- Chrome: unsupported lowering feedback; E grab; WASD drag; R and clicked
  prompt lowering; walking from z = 2.29 across the pit to z = −1.95; rejection
  of retrieval from the far bank; successful retrieval from the hinge bank.
- Standalone site build passes. No production deployment was performed.
- `npm test`: 860/863 pass. The three failures are two underlying unrelated
  issues (the console test also fails its enclosing suite): macOS `/var`
  versus `/private/var` in the console cwd check, and the usage status-line
  bridge's missing `source`. Both reproduce in a clean checkout of `62d609c`.
