# Backrooms room and creature authoring

Reference checked against Fable's `e81f634` source. Paths below are relative to the source root. This is an authoring contract for an offline contribution, not an existing plugin API. Fable owns integration and overall pacing; return focused modules and the small registration changes they need.

## What already exists

`public/world/backrooms/gen.js` generates one finite visit. It deals 6–9 distinct oddities from 19 archetypes, adds connective rooms, then places an exit after ordinary doorway loops. `MIN_EXIT_STEPS = 7` applies to the ordinary door graph, and the exit is at maximum graph depth. Floor-to-ceiling hatch warps are added later and are not included in that distance calculation.

An audit of 100 seeds (`i * 7919 + 13`, `i = 0…99`) produced 16–25 rooms (median 20), exits 7–14 doorways away (median 9), and a median of three oddities on the shortest exit route. Including one-way hatches shortened 28 routes; 11 then took fewer than seven room transitions. These are graph measurements, not play times. Adding deck entries alone increases variety, not the number of rooms per visit.

The world builds all rooms once. It hides rooms beyond three hops and runs room behavior within one hop, using a sight graph that also includes windows. It does not stream, recycle, or generate new chunks while walking. The Hydration Corridor already suggests infinity by warping the player backward in darkness.

Keep the established language: yellowed wallpaper, carpet, fluorescent ceiling tiles, chunky office props, quiet spatial absurdity, and jokes discovered through behavior. Existing examples include the ceiling meeting, an impossible tiny door, cardboard coworkers, an empty work-life-balance museum pedestal, and the one functioning cooler. Favor a strong silhouette and one legible interaction over explanatory signage or a new HUD.

## Source map

| File | Responsibility |
| --- | --- |
| `public/world/backrooms/gen.js` | Pure seeded layout, archetypes, room parameters, lights, loot locations |
| `public/world/backrooms/rooms.js`, `rooms2.js`…`rooms4.js` | Room construction and local interactions |
| `public/world/backrooms/world.js` | Builder context, collision, navigation, room lifecycle |
| `public/world/backrooms/kit.js`, `bits.js` | Batches, baked lighting, textures, shared room details |
| `public/world/vox/vox.js` | Pure voxel sculpting API |
| `public/world/props/index.js` | Real office prop catalogue (`PROPS`) |
| `public/world/backrooms/pursuer.js` | Captain Legacy and the friendly cardboard follower |
| `public/world/backrooms/loot.js` | Carried coins/keycard and banking on escape |
| `public/world/backrooms/index.js` | Visit lifecycle, input, shared `env`, cleanup |
| `public/world/dev/backrooms.html`, `backrooms.js` | Standalone preview and debug handle |
| `test/backrooms.test.mjs` | Pure generator, registration, geometry, and loot contracts |

## Deliver modules and a small registration patch

Use an unused `roomsN.js` for builders, optionally a separate pure module for specs and voxel models. Do not copy the engine into a parallel implementation. Return these files, a unified patch or exact before/after registration snippets, preview URLs/seeds, and a short validation report. No Git access is required to do this.

There are three registration requirements:

1. Add each specification to the exported `DECK` array in `gen.js`. Its exported `ARCHETYPES` is derived automatically. A pure spec module can export `LAB_DECK`, imported and spread into `DECK`; it must not import `gen.js` back and create a cycle.
2. Add each builder to the `BUILDERS` object exported by `rooms.js`. The current chain is `BUILDERS` → `MORE` (`rooms2.js`) → `MORE2` (`rooms3.js`) → `MORE3` (`rooms4.js`). A new `rooms5.js` could export `MORE4`, imported and spread into `BUILDERS`.
3. Add `STASH[id]` in `gen.js`: a known clear coin region for every added archetype. This can similarly come from a pure `LAB_STASH` export.

The registration test reads source text: it recognizes files named `roomsN.js` and **single-line** exports named `BUILDERS` or `MORE` followed by optional digits. Follow this format, as well as actually importing the module:

```js
// public/world/backrooms/rooms5.js
function copyingRoom(c) { /* build the room */ }
export const MORE4 = { 'carbon-copy': copyingRoom };
```

`index.js` imports `DECK` and `BUILDERS` directly. There is no `opt.content` or plugin-registration API. Do not invent one or change generation, pursuit, persistence, or exit policy as part of a room submission. Registering a room changes the deck and can change existing seeded layouts; keep those registration edits easy for Fable to review separately.

## Archetype and stash shapes

```js
// Example specification; select dimensions and ports for the actual design.
{
  id: 'carbon-copy',
  name: 'Copies',
  landmark: 'the copying room', // the phone can use this as an exit landmark
  w: [7, 9], d: [7, 9],        // inclusive integer outer dimensions, metres
  ports: ['back', 'left', 'right'], // optional extra walls; [] means a dead end
  weight: 1.3,
  lights: 'normal',            // existing modes: normal, dim, dark, entry
  roll: (R, office) => ({ copies: R.int(3, 6), color: R.pick(['#aaa28e', '#677366']) })
}

// STASH entry: local rectangle, or an array of candidate rectangles.
'carbon-copy': (room, side) => [
  room.W / 2 - 1.0, room.D / 2 - 1.2,
  room.W / 2 - 0.7, room.D / 2 - 0.9,
]
```

Optional spec fields are `h: [min, max]` (ceiling height), `door` (entry width, default 1.8), and `doored` (a shut entry door). All rooms have the front entry; `ports` describes possible additional doors, not guaranteed ones. Outer dimensions lose `T = 0.2` to become the builder's inner `W`/`D`. Default ceiling height is 2.6 m. Do not assume a port wall will remain solid.

`roll(R, office)` must return serializable plain data and tolerate empty office inputs. `office` has `{name, projects, agents, tasks}`; agents are names. `R()` returns a random fraction and has `range(lo, hi)`, inclusive `int(lo, hi)`, `chance(p)`, `pick(list)`, `shuffle(list)`, `some(list, n)`, `weighted(list, weightFn)`, and `fork(label)`. Use seeded randomness for structure and asset variants.

`STASH[id](room, side)` receives `side` equal to `-1` or `1`. Its rectangle is `[x0, z0, x1, z1]` in room coordinates. Leave that region clear in every parameter variant. Coins need level floor, standing room, and clearance from doors, stairs and walls (`COIN_R = 0.35`). The runtime may relocate a blocked coin; that is a fallback, not a substitute for authoring its location. Do not mint new persistent coin IDs.

## Builder coordinates and geometry

The builder receives `c` with `{world, kit, env, level, room, rt, R, W, D, H, look, params}`. Work in metres, centered on the room: x across, y up, z toward its front entry. Floor is local y=0. The room's rotation and elevation are applied for you. `c.toWorld(x,z)` and `c.toLocal(x,z)` convert horizontal positions. The player's local yaw is zero when looking toward -z, into the room.

| API | Use |
| --- | --- |
| `c.shell(options = {})` | Standard walls, carpet, ceiling, doors and trim. Usually call once first. Options include `walls`, `floor`, `ceiling`, `panels`, `sockets`, texture overrides and `H`. |
| `c.prop(type, x, z, options)` | Real office prop. `options.o` supplies catalogue-specific variants; unknown types become a crate. Check `c.hasProp(type)`. |
| `c.model(key, make, x, z, options)` | `make() → Vox`, meshed once per key. Keys must distinguish geometry/material variants. |
| `c.flat`, `c.wall`, `c.floor`, `c.ceil`, `c.vox` | Geometry batches. `c.flat.box(x0,y0,z0,x1,y1,z1,linearRGB,options)` builds a box. `lin('#rrggbb')` converts colors. |
| `c.mapped(key, texture, options)` | Textured, lit batch. `c.shining(key, texture, power, rgb, options)` is self-lit. |
| `c.light(x,y,z,color,power,options)` | Adds a light to the room's one-time bake. Add before construction finishes. |
| `c.dynamic(batch, {pivot, map, unlit, …})` | Returns an animated `THREE.Group`; author the batch in room coordinates. Geometry is created after the builder returns. |
| `c.add(object)` | Adds an object under the room group. Register custom disposable resources with `c.kit.own(resource)`. |
| `c.after.push(fn)` | Runs once after the room's geometry/light bake. The player is not ready yet. |

Voxel models use `import { Vox, M } from '../vox/vox.js'` from a room module. One voxel is **0.025 m**; box maxima are exclusive. Example: `new Vox().box(-4, 0, -4, 4, 8, 4, M('#a49b83', 2))`. Prop/model placement options include `rot` (radians), `y`, `scale`, `solid`, `shadow`, `tall`, `flip`, `tilt`, `tint`, and `batch`. Ordinary models can automatically create a solid footprint. Use `{solid:false}` for decoration that must not obstruct traversal.

Lighting is vertex baked, not a system of runtime shadow-casting point lights. Moving a baked object does not rebake its illumination. Use the existing visual language and batches; avoid a mesh per voxel. The engine calls `c.finish()`; do not call it yourself or append to finished batches during play.

## Collision and interaction APIs

| API | Contract |
| --- | --- |
| `c.clear(x,z,r = 0.4,head = 0)` | Checks level floor, door approaches, stairs and reservations. It is not a general query of every furniture collider. |
| `c.reserve(x,z,r)` | Marks space unavailable to later placement helpers. |
| `c.spot(r = 0.4, options = {})` | Finds and reserves a seeded free spot, or returns `null`. Options include `head`, `pad`, `tries`, `near:[x,z,radius]`. |
| `c.wallSpot(need, sides, margin, minTop)` | Finds a free wall span, or returns `null`; `c.spans(side, margin, minTop)` exposes all spans. |
| `c.solid(x0,z0,x1,z1,{tall,keep,on})` | Static world-space collider; returns `{x0,z0,x1,z1,tall,keep,on}`. `tall` also blocks sight. |
| `c.use({x,z,r,label,use,when,cone})` | Registers an E interaction. Default range 1.5 m, facing cone 0.55; `when()` gates availability, `use()` handles activation. |
| `c.zone({x0,z0,x1,z1,enter,leave,stay})` | Floor trigger. `enter(me)`, `leave(me)`, `stay(dt,me)`. |
| `c.tick(fn)` | `fn(dt,t,me)` runs while this room is current or adjacent. |
| `c.rt.onEnter = fn`, `c.rt.onLeave = fn` | Arrival receives visit count; leave has no arguments. Chain an existing callback if present. |
| `c.seen(x,z,options)` | Player visibility in local coordinates, including FOV and wall checks. |
| `c.env.play(name,wx,wz,reach)` | Spatial sound; use sound names implemented in `sound.js`. Positions are world coordinates. |
| `c.env.interfere(k)` | Transient VHS interference, 0–1. |
| `c.world.setLights(c.rt,k)` | Changes the room's existing light intensity. `c.rt.noTorch = true` suppresses the automatic camera lamp. |

`tick`/zone `me` is `{x,z,inside,yaw,moving,speed,world}`; `me.world` is the actual player state. Timers in `tick` pause when the room is distant. Zones are also skipped then; do not rely on a zone's `leave` firing immediately after a distant warp. Use room lifecycle callbacks for state that must reset on departure.

For a hostile room-local creature, guard contact logic with `me.inside && !me.world.frozen`. An earned capture can call `c.env.end('caught')`. There is no general health/combat/inventory API. Space is a small hop and C crouches; the hop cannot clear an obstacle that ordinary movement cannot step over. Keep required interactions usable without jumping.

`c.dynamic` does **not** move a `c.solid` collider. Likewise, `c.use` caches `wx/wz` at registration; a moving interaction must update the returned record's world coordinates. Creature meshes are not automatically collidable or damaging. Do not replace `env.pursuer`, `env.lair`, `env.adopt`, `env.stash`, or `env.ready`: existing enemies, the follower and loot use those hooks. Keep new creatures local unless cross-room behavior is explicitly requested.

The player's radius is 0.22 m. The walkability grid uses radius 0.225 m, 0.125 m cells, a maximum ordinary step of 0.26 m, and minimum crouched headroom of 0.62 m. Prefer comfortable passage clearance over designing exactly at those limits. `c.world.walkable(c.rt)` returns `{cell,nx,nz,key,at,free,floor,head,flood}`; `flood(doorRecords)` marks reachable cells.

After construction, the engine checks multi-door connectivity. On failure it can disable furniture collision and, as a last resort, flatten clipping. A room that works only after those warnings is broken. The builder exception fallback can also replace your room with a plain shell. Watch the console and verify your actual content is visible.

No per-room disposal callback is called automatically. `world.dispose()` traverses objects and calls `object.userData.dispose()`; the kit disposes registered resources. Avoid intervals, global event listeners, or shared mutable state in builders. If unavoidable, attach explicit cleanup. Do not access `env.player` during construction; `env.ready` callbacks run after player creation. Loot is carried during the visit and banked only on escape; the preview's `?loot=1` uses an in-memory stand-in, not the live office.

## Validate and return

Use Node 20+ from the source root. No package installation is needed:

```sh
node --check public/world/backrooms/rooms5.js
node --test test/backrooms.test.mjs
```

Adapt the syntax-check path to your new module. Syntax-check any other changed JavaScript too. The focused test includes forced archetypes, registration discovery, door geometry, connectivity, exit distance and loot placement. It does not render builders or exercise their interactions. Before integration/push, Fable also runs the repository's `npm test`.

Start the bundled offline preview using START_HERE.md, then open:

```text
/world/dev/backrooms.html?seed=7&only=carbon-copy&room=carbon-copy&vhs=0&pursuer=0&loot=1
```

`only` forces inclusion near the front of the deck; it does not create a one-room world. Try several seeds and all parameter variants, both clean (`vhs=0`) and camcorder (`vhs=2`) views. Walk every generated entrance/exit, activate each interaction more than once, leave and return, try the minimum-size room, and test loot access. Confirm the creature's harmless/hostile behavior, freezing during endings, and cleanup across repeated visits. Report actual checks and any untested behavior.

Controls: WASD/arrows, mouse, Shift, Space, C, E, V, M, Esc. The preview exposes `window.__backrooms`: `goto(id,x,z,yaw,pitch)`, `where()`, `level`, `world`, `player`, `env`, `sketch()`, and optional `loot.report()`. `window.__stage.renderer.info` helps inspect resource growth across visits. `?list=1` lists registered archetypes; `?map=1` shows the layout. Keep `live=1` off in an offline contribution.

Return only the new/changed source, registration patch, and a short note with room IDs, intended behavior, test results, reproducible preview URLs, screenshots if available, and remaining limitations. Leave live office state and unrelated source files out of the submission.
