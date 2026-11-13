# Sculpting a prop

Everything you can see in the 3D office that is not a wall or a floor is a
**voxel model written as a small function**. No art files, no editor: a prop is
code that fills a `Vox` with little cubes, and the engine turns it into a
shaded, shadow-casting object. This is how to add one.

## The rules of the room

| | |
|---|---|
| Unit | **1 voxel = 2.5 cm.** 40 voxels to the metre. |
| Axes | **x** right, **y** up, **z** toward the viewer. |
| Floor | `y = 0`. Nothing goes below it. |
| Centre | The prop is centred on `x = 0, z = 0` (that point is where the floor plan puts it). |
| Front | The side you use or look at faces **+z**. A fridge door, a screen, the books on a shelf, the side of a counter you stand at: all +z. A wall or a back panel is on −z. |
| Seats | Something you sit on has the middle of its seat at the origin, and the sitter faces +z. |
| Wall things | Origin is the bottom centre of the back face: the back is the plane `z = 0`, and it sticks out toward +z. |
| Boxes | `box(x0,y0,z0, x1,y1,z1)` is **min-inclusive, max-exclusive**: `box(0,0,0, 4,2,4)` is 4×2×4 voxels. |

**Scale.** The people here are chibi: 52 voxels (1.3 m) tall, heads about 17
voxels. Furniture is scaled to *them*, not to real life:

| | voxels |
|---|---|
| desk / table top | 26 |
| kitchen counter top | 30 |
| seat top (chair, bench, sofa) | 16 |
| stool seat | 18 |
| a person's eye line | ~44 |
| door height | 85 |
| wall height | 104 |

Stay inside the footprint the floor plan reserves for the prop (see `PREFAB` in
`core/layout.mjs`, metres → ×40): a 0.9 × 0.7 m fridge is at most 36 × 28
voxels. A little overhang (a handle, a leaf) is fine.

## The toolkit

`../vox/vox.js` is the whole API and is short — read it. The essentials:

```js
import { Vox, M, glow, glass, tone, mix, noise3 } from '../vox/vox.js';

const v = new Vox();
v.box(x0,y0,z0, x1,y1,z1, color)            // a block
v.rbox(x0,y0,z0, x1,y1,z1, r, color, 'xyz') // rounded block; axes says which edges round
v.cyl('y', cx, cz, y0, y1, r, color, r1)    // cylinder / cone along an axis
v.sphere(cx,cy,cz, r, color)   v.ellipsoid(cx,cy,cz, rx,ry,rz, color)
v.tube(x0,y0,z0, x1,y1,z1, r, color)        // a capsule: legs, pipes, cables
v.ring(cx,cy,cz, R, r, color, 'y')          // a torus
v.carve(x0,y0,z0, x1,y1,z1)                 // remove
v.paint(x0,y0,z0, x1,y1,z1, color|fn)       // recolour what is already there
v.decal('+z', u0,v0, u1,v1, color)          // paint the surface seen from a side
v.set(x,y,z, color)   v.stamp(other, dx,dy,dz)   v.mirrorX()   v.turned(n)
```

A colour is `'#rrggbb'`, or better a **material**: `M('#9a6a3c', 2)` — the
number is surface grain: `0` plastic/metal/glass, `1` paint, `2` wood,
`3` cloth. `glow('#ffe2a8')` is self-lit (screens, LEDs, bulbs — these bloom,
and glow at night). `glass('#bfe0ea')` is see-through. `tone(c, ±0.2)` lightens
or darkens. A colour may also be a function `(x, y, z) => color` to shade a
shape as it is laid down.

## House style

Look at `office.js` before you start — it is the reference for the look.

- **Warm, slightly worn, 1990s office.** Honey and walnut wood, cream plastics,
  steel greys, a few saturated accents. Nothing neon unless it is a light.
- **Chunky, readable silhouettes.** These are seen from across a room, from
  above, at about 2–6 px per voxel. If a detail is one voxel thick, ask whether
  it reads at that size. Rounded corners (`rbox`) on soft or moulded things.
- **Two or three tones per material**, placed on purpose: a darker base or
  plinth, a lighter top edge, a shadow line where panels meet. The engine adds
  ambient occlusion and real shadows — do not paint fake shadows.
- **Grain comes from the material number, not from random colours.** Giving
  every voxel its own colour makes the mesh enormous (same-colour faces merge
  into big quads; different colours cannot). Use `noise3` sparingly, in bands
  or patches, never per voxel across a large surface.
- **One or two touches that make it feel used**: a handle, a cable, a sticky
  note, a coffee ring, a loose sheet of paper, a chipped corner.
- **Something that glows**, where it makes sense: a power LED, a display, a
  lit button. Small glows carry the night scenes.
- **All sides matter.** The camera orbits; the back can be plain but must exist.
- **Budget:** aim for under ~3 000 quads per prop (the studio prints the
  count); big simple furniture should be far less.

## Registering it

Each file exports a `CATALOGUE`, merged in `index.js`. One entry per kind of
object the floor plan can place:

```js
export const CATALOGUE = {
  fridge: { make: () => fridge() },
  // make(o) gets the layout object; variant(o) names the mesh so identical ones are shared
  boxes:  { make: (o) => boxes({ seed: 1 + pick(o, 3) }), variant: (o) => String(pick(o, 3)) },
  stool:  { make: () => stool(), seat: 18 },      // seat: height of the seat top, for whoever sits
  clock:  { make: () => clock(), wall: true, y: 1.7 },   // wall: hangs on a wall · y: metres above the floor
};
```

If part of the prop will be animated or dynamic later (a screen, clock hands,
a spinning ball), sculpt the static part and export where the live part goes,
the way `office.js` does with `CRT_SCREEN`:

```js
/** The arcade's screen: centre and size in voxels, in the plane z = SCREEN.z facing +z. */
export const ARCADE_SCREEN = Object.freeze({ x: 0, y: 46, z: 9.08, w: 18, h: 14 });
```

## Looking at it

The prop studio shows catalogue entries in the office's own light:

```
/world/dev/studio.html?show=fridge,vending,cooler&who=1
    &turn=2          quarter turns — look at the back and sides
    &cam=close|top|low|back
    &hour=22         night: check your glows
    &zoom=0.6        closer
```

While you are writing a file, add `&from=kitchen` (your file's name) so the
studio loads only that file. `name#2`, `name#3` show other variants of one
kind, and `&o.stage=3` passes a field to `make(o)`.

`who=1` stands a person next to the row for scale. Reload after every edit;
nothing is cached. `window.__stats` in the console lists each prop's size and
quad count.
