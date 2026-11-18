# The shopping centre: notes on making a room of it

The shopping centre (`themes.js` `mall`, still `dealt: false`) is a fever
dream of a mall, remembered by people who worked in a 1980s office park and
built out of that office park. The ideas list is `docs/MALL-PLAN.md`.

This file is in two parts, and they are not the same kind of thing.

- **Part one is rules.** They keep the game working, fair and inside its
  budget. Every room keeps them.
- **Part two is not rules.** It is what worked in the clothes shop
  (`rooms/mens-ladies.js`) and the hall of moving stairs
  (`rooms/moving-stairs.js`), written down so the next room can use it or
  do the opposite on purpose. A floor of rooms that all follow the same
  recipe is a floor nobody remembers. The owner: surprising things are what
  good games thrive on.

---

## Part one · Rules

### Budget

- 120,000 triangles in a room's ordinary batches, up to 250,000 with detail
  (`c.detail`, `{ detail: true }`), 45 meshes and 12 more that are detail,
  16 lights. What is only looked at goes in detail; what is walked into,
  stood on or read does not.
- Where a room fills itself (rails, tables, sets), cap it so its biggest
  dealt size stays under: sweep eight seeds and quote the range.

### Never a trap, never unfair

- From every doorway to every other on plain floor (no belt, no moving
  stair, no hole) for r 0.22; the room's middle out for the mascot (r 0.26).
- Set pieces keep their ground (`c.reserve`); what fills goes only where
  `c.clear` says, never across the way to a doorway.
- A drop ends a careless visit only by a ride or a visible edge, never by
  walking in. Check it once on Easy (the ending) and once on the Tourist
  (one fall, then the floor's start).
- A creature put in the room can leave it.

### Things that must not look broken

- Anything free-standing a visitor can get behind has a back: two faces, or
  the back of a stage flat (bare board, battens, a brace). The owner found
  the Parade's missing.
- `Vox.box` is half-open (`x0 ≤ x < x1`): one row is `y, y + 1`. A
  zero-thickness box draws nothing.
- `wallFace` faces into the room on every wall (fixed 17 Nov); glass that
  should be clear is a cut-out with clear pixels, not a tint.

### Light

- Light through `c.light`, what shines through `c.shining`. No other path,
  no Graphics switch of a room's own.
- Classic stays exactly as it is when a room is changed for Medium and High
  only. The builder's per-batch bloom, lights from a shining batch's boxes
  and light through a shop window are to be used when they land, not
  worked round before.

### Before a push

- Eight seeds with `&check=1`: no error, no doorway warning, triangles in
  range. A look from behind anything free-standing. A look at High.
- A row in `docs/AUDIT-LOG.md`, five columns, saying what was not checked.

---

## Part two · What has worked (use it, bend it, or do the opposite)

Each of these is a note about why something landed, not a requirement. The
best next room may break most of them. Questions are more use than answers
here, so each comes with one.

**A limited palette** made the clothes shop read as one place and let one
accent (the pink frames) carry. *But:* a room that is suddenly all one
colour, or violently clashing, or colourless, can be the surprise. *Ask:*
what does this room's colour do to someone walking in from the last?

**Somewhere the eye goes** (the frames going away, the shaft of doors)
gave the clothes shop and the hall a reason to walk in. *But:* a room with
nothing to look at, or ten things, or its point behind you as you enter,
is another kind of feeling. *Ask:* where does the visitor look first, and
is that the room you meant?

**The office showing through** (the mirror, the torn panelling, the deck)
tied the mall to the backrooms. *But:* one room can be wholly mall, with not
a trace of the office, and be stranger for it. *Ask:* where is the seam
between the two in this room, if there is one?

**Strangeness built, not written** (a rail into the carpet, a dummy in a
planter) worked better than SALE banners. *But:* words can be the strange
thing when it is the right room for words: a wall of receipts, a tannoy that
almost speaks. *Ask:* would this still be strange with the sound off and the
signs blank?

**Height and depth** (a deck, a shaft, a tunnel) stopped the rooms feeling
like boxes. *But:* a dead-flat, low, endless room is its own dread. *Ask:*
what does the visitor's body do in here?

**Repetition past sense** (frames, doors, sets) beat lots of different
things a little. *But:* one single object alone in a big room can do more.
*Ask:* what is there one of, and what is there too many of?

**Voxel craft:** sculpt the thing properly (a jacket with lapels), then make
it cheap (stamp a row of them into one model: the rails went from 203k to
119k triangles). Surfaces at 64 px to a 1.6 m repeat match the voxels
(`MALL_TEX` in `mall.js`: `carpet`, `panel`, `tile`). These are tools, not
a look: a room drawn deliberately crude, or flat-shaded, or all one
texture, is allowed if it is on purpose.

**Do something no other room does.** This is the only note close to a rule.
Before building, list what the other mall rooms already do (a shaft, a
camera feed, frames going away, a hole in the floor) and make sure this one
has at least one thing that is not on the list: a new way to move, a new way
to see, a new thing that is wrong. If a room could be described as "like
the clothes shop but with X", it is not done yet.

## Weirdness that has worked, to steal from

Inspiration, from these floors and the backrooms idea itself. Take any of
them somewhere new.

- **The almost-right copy.** A thing remembered by someone who never quite
  saw it: lettering that is nearly letters, a shop selling one sandwich, a
  grotto in July. Wrong in a way you can't name at once.
- **Too many of one thing.** Doors up a shaft past any use, frames inside
  frames, a car stacked to the roof, every set on the same channel.
- **Scale slips.** A sandwich a stride long; the same three shops again
  inside the middle one's door, smaller; a model village with itself on a
  table.
- **Two places in one.** The mall in the office: cubicles behind the
  panelling, monitors sold as stock, a deck with a desk on it.
- **It notices you.** The sets wake as you pass; the camera shows someone
  where you stood; the dummies are one more each time you come back; the
  covered stair gives you the same stretch again if you hurry.
- **The quiet failure.** The tannoy chimes and never speaks; the fountain is
  a water cooler and dry; a door is locked and somebody knocks back.
- **Physics gone politely wrong.** A rail going into the carpet as if into
  water; tables bolted to the ceiling; stairs that loop like a ride.
- **Unreachable places.** Doors high on a wall, a corridor painted at the end
  of a tunnel, an office glimpsed through a hole you can't fit through.
- **Liminal emptiness.** A big lit room with nothing in it, a hum, carpet to
  the walls. Sometimes the strangest room has no set piece at all.

## Notes on gameplay

Also inspiration, from what has played well or badly so far.

- **Teach by showing.** The belts and the stair into the shaft are readable
  before they are dangerous: the slot is black and in view, the stair visibly
  moves. A visitor should be able to tell why they died.
- **A choice beats a hazard.** The covered stair (stand and it takes you,
  hurry and it holds you) and the landing (step off, or ride on to the drop)
  give the visitor something to decide. A hole with no choice is just a hole.
- **Reward the curious.** Something on the landing (a battery, a snack, a
  door that goes elsewhere) pays for going down. Put the good things where
  only the brave or nosy go.
- **Rhythm across the floor.** A loud set piece next to a quiet plain room
  makes both work. Not every room needs to be the biggest.
- **Let creatures matter.** The dummies punish coming back; the lines punish
  being followed to the gap. A room that changes how a creature behaves in it
  (somewhere to hide, somewhere it cannot follow) earns its place.
- **Make it readable at speed.** When something is chasing, the way out
  should be findable: light the doorways, don't hide them behind the set
  piece.
- **Co-op and the Tourist.** A trick that ends a visit should have a gentler
  version on the Tourist and should not strand the others in co-op.

## Where each room is

Not a checklist: what each has that is its own, and what it shares that it
could stop sharing.

| Room | Its own thing | Shares with others (could change) |
|---|---|---|
| Clothes shop | frames going away to a corridor; rail into the carpet | rails, dummies |
| Moving stairs | shaft of doors; rides that loop; a door that goes elsewhere | the mauve palette of the clothes shop |
| TV shop | sets that wake as you pass; the camera's late picture | dummies |
| The Orange | everything orange; the server with an orange head; a board that serves everyone but you (take a number: it stops one short) | neon menu |
| Food court | tables on the roof; a table that rises out of the hole to the empty hook, hangs, and lets go | neon, the hole (atrium, level-p) |
| Atrium | storeys going up, each smaller | neon, the hole |
| Level P | one car, stacked to the roof | the hole |
| Photo booths | a booth that flashes; the one waiting moves only in the flash, nearer each picture, as the strips show; the booths light the hall | neon fascias, a dummy |
| Receipts | a receipt that follows you, printed, charged by the metre on the till's display; tear it off and it reels back the way you came | neon fascias |
| Keys cut | doors that are walls; the machine cuts you a key to one of them, and behind it is a smaller door it does not fit; somebody knocks | neon fascias |
| Grotto | July; paper snow that falls only while you stand still and stops in the air when you move | neon fascias, a camera (its bulb only) |
| The streets (`concourse`) | `MALL_WRONG`, one wrong thing a room | shopfronts throughout |
