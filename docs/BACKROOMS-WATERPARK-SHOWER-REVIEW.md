# The Other Changing Room

Branch: `codex/waterpark-shower-fold`, based on `0b859bc`. This branch also
contains the preceding Lane Archive/Narrowing Bays work. The waterpark remains
`dealt:false`; this is a local review build, not a public release.

## Reference and scope

The owner's pink shower/locker reference called for architecture that feels
wrong before a creature appears: a flooded zigzag route, ordinary fittings at
impossible heights, a door in the ceiling, and a locker deeper than its shell.
This replaces the old Scalding Bays builder at the existing `locker-showers`
ID. It removes that room's steam/valve puzzle and surprise damage. The old pure
waterpark rules remain for compatibility with their existing tests.

The room is 18 × 26–28 m and 6.6–7.2 m high. It is marked `big`, so the
generator treats it as a set piece rather than placing multiple large rooms
on one part. This pass does not depend on the pending lighting/water upgrade.

## Enter, explore, leave

- The low entrance opens onto a shallow flooded changing room. A raised wooden
  walkway changes direction three times; both dry banks also connect the ends.
- The wet floor is only 32 cm below the bank, with 16 cm recovery steps. The
  boardwalk, wet steps and navigation share one height function. Stepping off
  costs movement speed but does not trap or hurt a visitor.
- Twenty-seven detailed lockers form the right wall. The over-wide open locker
  enters a cyan corridor behind the bank. Follow it through the falling-water
  screen and emerge behind the showers on the other side of the room.
- The translation preserves heading, elevation and a carried prop. It is
  reversible immediately. If furniture or another physical obstruction fills
  the destination, the fold refuses the crossing and the visitor can retreat.
  A laid bridge cannot be moved through the fold under another visitor.
- The regular back/left exits remain reachable without using the locker route.
  The normal seeded stash remains on a dry rear corner. There is no mandatory
  interaction or resident in this room.

The upper shower landings and ceiling door are inaccessible scenery. The
locker connection is a matched, concealed translation, **not a live-rendered
portal** or a solution for stacked walkable floors. Each visitor has separate
crossing history; two networked clients have not yet been manually playtested.

## Construction and materials

- Pink ceramic bays with open wired-glass doors, closers, kickplates and solid
  jambs/leaves. Brass mixers and shower heads have separate nozzles and animated
  falling ribbons; towels have folded silhouettes and terry-cloth texture.
- Lockers have depth, shelves, hooks, open hinged leaves, louvers, rivets,
  latches and worn enamel. Fixed benches have individual planks, feet and bolts;
  a lost ring and an ordinary movable dirty-towel cart complete the dressing.
- Stepped ceiling slabs compress the distant sightline. Two upper shower bays
  hang above the walking route. A hollow cyan voxel flume passes through a real
  ceiling opening beside exposed pipes and framing.
- Mineral tide marks, repaired grout, bleached enamel and acoustic-tile stains
  are procedural textures. No reference image or binary asset is bundled.
- White-pink fluorescents, an amber shower and a cold locker passage establish
  distinct light zones. A subtle animated caustic pattern is confined to this
  room's wet materials; it is an art-directed light pattern, not ray tracing.

## Renderer changes and cost

`world.js` now forwards the existing `wet` material option through `c.mapped`
and `c.dynamic`. Defaults remain dry. A regression test builds real mapped and
dynamic surfaces and checks both options and unchanged defaults.

The room's water uses one 512 × 512 reflection target for the complete flooded
sheet. A mirrored camera clips submerged geometry; surface ripples distort the
reflection, and viewing angle changes its strength. It reflects world geometry,
not the HUD or held-item overlay. There is one extra scene render when the water
mesh renders, not one pass per puddle. Nested reflection passes are blocked,
resources are disposed by the kit, and renderer/viewport/scissor/lamp state is
restored even if rendering throws. The viewport test specifically covers a
large canvas with a smaller VHS target.

The tested room sizes peak at **100,006 base triangles, 21 meshes and 14 authored
lights**, below the existing room limits. The extra reflection pass is outside
that geometry count: mobile/integrated-GPU timing still needs measurement.
This is a stronger architectural prototype, not a claim that the current
baked renderer matches the reference's soft shadows, wet microdetail or global
illumination.

## Local review

`http://127.0.0.1:44352/?themes=waterpark&depths=1&room=locker-showers&only=locker-showers&pursuer=0&mute=1&seed=17&vhs=1&inventory=0&showerstudy=1`

The development panel provides entrance, cross-room, shower, locker and reverse
viewpoints. `inventory=0` is for an untimed art review. Remove it or use
`inventory=1` to play with the usual camera battery and health.

```sh
node --input-type=module -e "import {stage} from './tools/backrooms-sample/stage.mjs'; import fs from 'node:fs'; stage('/tmp/blockrooms-waterpark-channel-review',{three:true}); fs.copyFileSync('public/world/dev/backrooms.html','/tmp/blockrooms-waterpark-channel-review/index.html'); fs.cpSync('public/world/dev','/tmp/blockrooms-waterpark-channel-review/world/dev',{recursive:true});"
node tools/blockrooms/serve.mjs /tmp/blockrooms-waterpark-channel-review 44352
```

## Validation

- Focused room, navigation, deck-contract, wet-material and reflection checks:
  **94/94 pass**. Traversal uses the actual player controller at all four room
  rotations; it covers the walkway, both banks, wet recovery, regular exits,
  locker entry, forward/reverse folds, blocked destinations and carried props.
- Production build: **353 files**, passes.
- Safari visual review covered the entrance, cross-room composition, upper
  shower construction, caustics and corrected water reflection. Final manual
  passage traversal remains to be checked; automated controller checks pass.
- Full `npm test`: **1,116/1,123 pass**. The seven failures match the existing
  baseline: four Return Pool cart-placement assertions, the console `/var`
  versus `/private/var` assertion and its parent, and the usage/status-line
  `source` failure. No new failure remains.
- `git diff --check`: passes.

Keep this on the review branch until the pending renderer work is reconciled,
the fold has been played on two clients and the reflection cost is measured.
