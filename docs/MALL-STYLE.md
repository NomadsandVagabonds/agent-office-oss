# The shopping centre: how a room of it is made

The shopping centre (`themes.js` `mall`, still `dealt: false`) is a fever
dream of a mall, remembered by people who worked in a 1980s office park and
built out of that office park. This is what a room of it has to be, learned
from the clothes shop (`rooms/mens-ladies.js`, the first room taken all the
way) and the hall of moving stairs (`rooms/moving-stairs.js`, the second).
The owner's two reference pictures are the standard. A room that does not
meet this is not finished, however much is in it.

The ideas list is `docs/MALL-PLAN.md`; this is how to build them.

## 1 · One palette to a room

- Pick four or five colours and use nothing else. The clothes shop:
  dusty rose, beige, taupe, cream, a grey-green wall, and one accent (pink,
  for the fitting rooms). `PAL` in `rooms/mens-ladies.js` is the shopping
  centre's default; a room may shift it (the TV shop's blue-grey carpet,
  The Orange's orange and white) but keeps to as few colours.
- Even the props come from it: the jackets are the palette, the dummies are
  dressed in it, the signs are its red.
- Neon is the exception, and only as light: a few tubes, not a colour scheme.
  Saturated red banners across a room (the clothes shop's first version) are
  what this rule is for.

## 2 · Something to look at down the middle

- Every room has one thing that pulls the eye and the feet: the fitting
  rooms going away in pink frames to a corridor of doors; the shaft of doors
  with a stair down into it; the big set with a camera on it.
- Lay the room out so you see it from the way in, framed: rails either
  side of an aisle, a half-wall, a column.
- Layer it: something near (a rail, a plinth), something in the middle (a
  dummy, a bench), the thing at the back.

## 3 · The office is still in it

- The shop is in an office park, and you can see the office: in a mirror
  (cubicles, not you); behind panelling that has come away (built, not
  painted, at least the first metre: partitions, a desk, a beige set, a
  chair, a lower roof with its light); up three steps in a corner (a raised
  deck with a desk on it).
- Office things are sold as if they were the shop's: a table of stacked
  monitors, flipcharts, filing cabinets.

## 4 · What is wrong is built, not written

- The strangeness is in the space: a rail going into the floor (into an
  unmarked carpet, no hole: the owner); a dummy in a planter to the chest;
  frames each smaller than the last; a shaft with doors where nobody could
  reach; stairs that loop like a ride.
- Words are allowed to be nearly words (`garble`, `mallNeon`), but a room
  whose strangeness is all in its signs is not done.
- Repetition is a tool, not a fill: one thing repeated past sense (the
  frames, the doors, the sets) beats many things repeated a little.

## 5 · Shape, height and depth

- No room is a flat box with things standing in it. Give it at least one
  change of height (steps up to a deck with `c.rt.floorY`; a drop with
  `voidIn`, `relative: true` where a stair goes down into it), one half-wall
  or plinth, and one thing with depth behind a surface (a recessed bay, a
  tunnel, a gap in panelling).
- Set pieces are placed first and keep their ground (`c.reserve`); what
  fills (rails, tables) goes only where `c.clear` says, and never across the
  way to a doorway.

## 6 · Models: voxels, but not boxes

- Voxels at 2.5 cm. Sculpt the thing (a jacket has shoulders, sleeves, a
  lapel, buttons, a hanger), then keep it cheap: many of the same thing in a
  row are stamped into **one** model (`Vox.stamp`), so the faces between them
  are not drawn (the clothes shop's rails went from 203k to 119k triangles).
- `Vox.box` is half-open (`x0 ≤ x < x1`): a box of one row is `y, y + 1`,
  not `y, y`. A zero-thickness box draws nothing.
- Anything that can be got behind is drawn from behind: two faces, or a
  back (the back of a stage flat: bare board, battens, a brace). One-sided
  pieces vanish from behind (the owner found the Parade's).

## 7 · Surfaces

- Walls, floors and ceilings are drawn at 64 px to a 1.6 m repeat, so a
  pixel is a voxel: `MALL_TEX` in `mall.js` (`carpet`, `panel`, `tile`).
  A 32 px texture beside 2.5 cm voxels looks like a smaller game.
- Carpet: contract carpet, a small diamond repeat in the ground's own tones,
  tufts. Panelling: boards, a groove and its lit edge, a little grain, scuffs
  low down. Ceiling: mineral tiles with fissures and a bevel, one to a repeat.
- `wallFace` faces into the room on every wall (it did not on the left and
  front ones before 17 Nov).

## 8 · Light

- Rooms say where light is with `c.light` and what shines with
  `c.shining`. There is no other path, and a room does not add a Graphics
  switch of its own.
- At Medium and High what shines blooms (`glow.js`, the builder's). A room
  is toned at Classic and keeps Classic exactly as it is when it is changed
  for the higher tiers only. Per-batch bloom strength, lights made from a
  shining batch's own boxes, and light through a shop window are the
  builder's to add (asked 17 Nov); use them when they land, not before.
- Ceiling fittings are drawn as geometry (a frame, two tubes, a diffuser)
  where the shell does not draw them.

## 9 · Budget

- 120,000 triangles in a room's ordinary batches, up to 250,000 with detail
  (`c.detail`, `{ detail: true }`), 45 meshes and 12 more that are detail,
  16 lights. What is only looked at goes in detail; what is walked into,
  stood on or read does not.
- Cap what fills (the clothes shop holds 175 jackets) so the biggest
  dealt size stays under: sweep eight seeds and quote the range.

## 10 · Before it is pushed

- Eight seeds of the room with `&check=1`: no error, no doorway warning,
  triangles in range.
- From every doorway, every other doorway on plain floor (no belt, no
  moving stair, no hole) for r 0.22, and the room's middle out for the
  mascot (r 0.26).
- A fall: once on Easy (the ending) and once on the Tourist (one fall, then
  the floor's start).
- A look from behind anything free-standing; a look at High.
- A row in `docs/AUDIT-LOG.md`, five columns, saying what was not checked.

## Where each room is

| Room | Palette | Focal point | Office in it | Built strangeness | Height / depth | Surfaces |
|---|---|---|---|---|---|---|
| Clothes shop (`mens-ladies`) | yes | fitting-room frames | mirror, torn panelling, deck | sinking rail, planted dummy | deck, tunnel, torn wall | 64 px |
| Moving stairs (`moving-stairs`) | yes | shaft of doors | shop window, benches | rides, the shaft | shaft, landing, upper floor | 64 px |
| TV shop (`the-sets`) | own (blue-grey) | the big set's camera | sets themselves | figure in the feed | flat: to do | carpet 64 px; walls to do |
| The Orange | own (orange) | the big orange | — to do | server with an orange head | flat: to do | 32 px: to do |
| Food court | mixed: to do | the hole, FOOD | — to do | tables on the roof | the hole | 32 px: to do |
| Atrium | mixed: to do | the gallery | — to do | storeys going up | gallery, the drop | 32 px: to do |
| Level P | car-park yellow | the stacked cars | — | cars up the wall | the ramp down | 64 px wall |
| Photo booths, receipts, keys-cut, grotto | mixed: to do | each has one | — to do | each has one | flat: to do | 32 px: to do |
| The streets (plain rooms, `concourse`) | per street | — | service corridors | `MALL_WRONG` | flat | kit patterns: to do |
