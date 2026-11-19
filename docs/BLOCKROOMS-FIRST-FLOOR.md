# BlockRooms: the first floor

Status: **an audit and a proposal, nothing built.** Taken on `blockrooms-live`
at 28b5997, 19 November. No game code was changed to write it.

The owner: "only a couple minutes to grip a new player so our first floor has
to be stunning." And, since: the bar is **surreal and wrong, away from a
standard office**. This brief grades every room against that bar.

## Summary

**Top 5** (what a new player should meet first):

1. **server-chasm**: the floor gives way to a red-lit void of server towers.
2. **keyboard-floor**: you stand on a keyboard the size of a room.
3. **ceiling-meeting**: a meeting table and its chairs, upside down on the
   ceiling.
4. **last-light**: a hall too long, with somebody standing at the end of it.
5. **blackout-bay**: pitch dark, one exit sign, a pale figure beside it.

**Bottom 5** (weakest first):

1. **cover**: an empty box with a shutter; nothing reads.
2. **nested**: the doorway faces a blank wall.
3. **lift**: a pair of lift doors fills the frame, and that is all.
4. **phone**: an empty room, with a phone too small to see.
5. **vestibule**: glass panes in your face; no read of the revolving doors.

**Reads as a plain office** (an ordinary room with a joke or a character in
it; nothing about the space is wrong):

- the landing
- party, copiers, mailroom, quiet-zone, kanban
- hall-of-fame, museum, lift, phone, cover, nested
- audit-pod, shredding-bay, safety-corridor: a character in a plain room
- cutouts, cable-drop, vestibule, tiny-door (all from their doorway)
- dispatch (never on the first floor)

That is 21 of the 42 rooms shot. The yellow paper, the tubes and the camcorder
do all the work in them. The room itself does none.

**Decisions for the owner:**

1. **The four openers for C9.** server-chasm, keyboard-floor, ceiling-meeting
   and last-light. blackout-bay is left out on purpose: walk into it without the
   flashlight and the visit ends, so it must not be a new player's first room.
2. **When C9 lands.** It changes every building, so every saved tape and board
   entry is from an older edition (Part 3). Batch it with other changes that
   alter the edition.
3. **Keep, fix or move the plain-office rooms.** FF-8 says a weak room is
   polished or kept off the first floor. I would move cover, nested, lift and
   phone deeper now, and polish the rest.
4. **The first floor is short.** On a walk that knows the way, seed 7's whole
   first floor (five oddities and the way down) is done in **81 seconds**. A
   new player who is lost takes longer, but the pacing has less room than it
   seems.
5. **The things on screen.** Every frame has the six-slot inventory strip and
   the heart. Near anything usable an **E** key cap appears in mid-screen, and
   a picked-up item's name shows above the strip ("Pink slip"). Rule 1 says no
   control hints. If those were meant, leave them; if not, they are the first
   thing a new player reads.
6. **Two likeness risks for the Q-1 sweep.** cubicle-grid's "Smiling Office
   Workers" (ear-to-ear grins, pursuing) and mandatory-fun's staff in party
   hats with red balloons are close to well-known community designs.

---

## How the shots were taken

- **Where:** the level's own dev page, `/world/dev/backrooms.html`, served by
  the office daemon on a spare port with its data in a scratch folder. There is
  no `/play` route in this tree.
- **Parameters that exist** (`public/world/dev/backrooms.js`): `seed`, `room`
  (deals that room in beside the landing and stands you in it), `only`,
  `pursuer=0`, `mute=1`, `vhs`, `graphics`, `x`, `z`, `yaw`, `pitch`.
- **What a shot shows:**
  - `seed=7&room=<id>&pursuer=0&mute=1`, Graphics left at Classic (the
    default) and the camcorder at Full VHS (the default).
  - The page's own spawn for the room: 0.9 m inside the main door, at the
    game's eye height, facing in. That is the first thing a visitor sees from
    that doorway.
- **Size:** 960 by 600 JPEG, quality 68. 51 files (42 rooms, 9 storyboard frames), 2.4 MB in all.

**Which rooms can be on the first floor.**

- 40 of the deck's 97 lines are at home on the yellow floor
  (`themes.js` `atHome(line, 'yellow') > 0`).
- Three of the 40 are never dealt there: **unsure-hall** (`planned`: never
  where you land), **dispatch** and **mecha** (`headline`: never on the floor
  you land on). They are shot and graded, and marked "not dealt here".
- The other 37 can be dealt, plus the landing, plus the way down (shown here
  as seed 7's hole in the floor).

**How often** each is on the first floor, over 200 visits (`planVisit` then
`floorOf(v, 0)`):

- **cutouts** is there in 56% of visits. It teaches what the planned hallway
  needs, so the plan pulls it up top.
- Most others are there in 15 to 27% of visits.
- The weakest are rare: shredding-bay 4%, blackout-bay 7%, cubicle-grid 7%.
- The four openers (Part 3) are there in 15 to 26% of visits each.

---

## Part 1 · The audit

The grades are **stunning / good / plain / cut**, against "surreal and wrong
beats a nice office". "Plain office" is marked where the room reads as one.

### Set pieces and the big rooms

**server-chasm** · **stunning** · [shot](first-floor/server-chasm.jpg)
- First 3 s: banks of servers rise either side, a catwalk runs out over a red
  glow, and a lit desk and a picture stand alone across a void. Depth, colour,
  vertigo.
- One change: from the door the catwalk grating hides the drop. Cut the first
  metre of grating so the eye falls straight down.

**re-org** · **good** · [shot](first-floor/re-org.jpg)
- First 3 s: grey-beige cubicle walls piled and tipped, a ladder, a dark
  ceiling. The idea is stunning. From the door it reads as a cluttered
  storeroom.
- One change: clear the line from the door so the pit and the hanging
  cubicles stand against black.

**all-hands** · **good** · [shot](first-floor/all-hands.jpg)
- First 3 s: a dark hall, a white projector slide, rows of chairs in the
  gloom. But a pale lectern fills the bottom third of the frame.
- One change: move the lectern or the door so the first thing seen is the
  seated rows and the slide.

**compactor-canyon** · **plain** (from its door) · [shot](first-floor/compactor-canyon.jpg)
- First 3 s: a flat grey face of shelving a metre away, a "REC-90 SEALED"
  label, a small figure painted on it. The 8.6 m stacks never read as tall.
- One change: open the doorway onto a seam between two stacks, lit from the
  hole above, so the height is the first thing seen.

**drop-plenum** · **good** · [shot](first-floor/drop-plenum.jpg)
- First 3 s: a step-ladder climbing into a red-lit ceiling, a block wall, two
  plain desks. The red is the hook.
- One change: put the upside-down office overhead in sight from the door; it
  is the room's best idea and you cannot see it.

**last-light** · **stunning** · [shot](first-floor/last-light.jpg)
- First 3 s: a narrow hall, too long, door frames repeating into the distance,
  and a figure standing at the far end. Instant unease.
- One change: the figure is a few pixels tall at Full VHS. Make it a head
  taller, or lit from behind, so it reads in one glance.

**cubicle-grid** · **good** · [shot](first-floor/cubicle-grid.jpg)
- First 3 s: a grid of narrow beams over a sunken floor, a fire door beyond.
  It is evenly lit, so the pit looks shallow and the room looks finished.
- One change: kill the tubes over the pit; leave only the foyer and the far
  door lit, so the beams cross black.
- Likeness: see decision 6.

**blackout-bay** · **stunning** · [shot](first-floor/blackout-bay.jpg)
- First 3 s: nearly black, a green exit sign over a lit doorway, and a pale
  long-faced figure standing to one side. The best first fright in the deck.
- One change: none to the picture. Never deal it within the first few rooms
  (it ends the visit of anyone without the flashlight).

**mecha** · **stunning** · not dealt here · [shot](first-floor/mecha.jpg)
- First 3 s: a dark aisle of cages, people at benches inside, a red-eyed
  machine at the end, percentages on banners.
- One change: none for this brief. It is a headline room and the owner's own;
  it never comes on the first floor.

**dispatch** · **plain** · not dealt here · [shot](first-floor/dispatch.jpg)
- First 3 s: a warehouse of wooden crates under tubes. Plain office.
- One change: none for the first floor.

### Rooms with someone in them

**mandatory-fun** · **good** · [shot](first-floor/mandatory-fun.jpg)
- First 3 s: bunting, a stack of pizza boxes, four staff in party hats
  dancing towards you. Loud and readable; garish rather than wrong.
- One change: freeze them mid-step when first seen, and start the dance only
  when you move. Likeness: see decision 6.

**shredding-bay** · **good** · plain office · [shot](first-floor/shredding-bay.jpg)
- First 3 s: shelving, two bins, a bespectacled clerk behind a shredder. The
  character is strong; the room is a stockroom.
- One change: fill the floor ankle-deep with shred, so the room itself is
  wrong before she moves.

**safety-corridor** · **good** · plain office · [shot](first-floor/safety-corridor.jpg)
- First 3 s: a striped corridor and a man in hi-vis standing in it, watching.
- One change: make the corridor far longer than its room should allow, with
  the warden always the same distance away.

**audit-pod** · **good** · plain office · [shot](first-floor/audit-pod.jpg)
- First 3 s: a grey-haired consultant and a pink "NOTICE OF REDUNDANCY" with
  the player's name on it. Funny, not eerie.
- One change: the pink slip, once held, covers a quarter of the screen for
  the rest of the floor (see Part 2). Hold it smaller or lower.

**cutouts** · **plain** · plain office · [shot](first-floor/cutouts.jpg)
- First 3 s: an empty yellow box, boxes, and three cardboard colleagues
  pushed to the left wall.
- One change: stand them in a line at the far wall, facing the door. It is
  the floor's commonest room; it must earn that.

**photo** · **good** · [shot](first-floor/photo.jpg)
- First 3 s: a backdrop, seven cardboard colleagues posed for a group photo,
  a tripod pointing at you. Mildly wrong: you are where the photographer
  should be.
- One change: put one empty, person-shaped gap in the line-up.

### Rooms built on one idea

**keyboard-floor** · **stunning** · [shot](first-floor/keyboard-floor.jpg)
- First 3 s: the floor is the keys of a keyboard, waist high, and the wall is
  a screen that says "READY." The scale is wrong at once.
- One change: let a key sink under your foot with a click on the first step.

**ceiling-meeting** · **stunning** · [shot](first-floor/ceiling-meeting.jpg)
- First 3 s: a meeting table, red chairs and a laptop hang upside down from
  the tiles. Wrong in one look.
- One change: a slow creak and sway, so the eye catches movement.

**ceiling-plants** · **good** · [shot](first-floor/ceiling-plants.jpg)
- First 3 s: potted plants growing down from the ceiling, a watering can on
  the floor. The same trick as ceiling-meeting, softer.
- One change: plant them denser and longer, so you have to duck between
  them.

**coolers** · **good** · [shot](first-floor/coolers.jpg)
- First 3 s: a narrow corridor of water coolers running into darkness. The
  dark end does the work.
- One change: let the last cooler in the light glug once as you arrive.

**chairs** · **good** · [shot](first-floor/chairs.jpg)
- First 3 s: rings of office chairs, all facing the middle of the room. Quiet
  and wrong.
- One change: turn every chair to face the door instead.

**wet-floor** · **good** · [shot](first-floor/wet-floor.jpg)
- First 3 s: forty wet-floor signs in rows. Repetition reads as wrong.
- One change: one sign is lying face down, away from the others.

**many-doors** · **good** · [shot](first-floor/many-doors.jpg)
- First 3 s: five identical doors and "PLEASE USE THE CORRECT DOOR." Clear,
  but clean and evenly lit.
- One change: twice the doors, round all three walls.

**vending** · **good** · [shot](first-floor/vending.jpg)
- First 3 s: an aisle of lit vending machines in a dark room, a lit doorway
  at the end.
- One change: one machine at the far end is dark, with its glass broken.

**stress-pool** · **good** · [shot](first-floor/stress-pool.jpg)
- First 3 s: a sunken pit of shredded paper behind glass rails, a swivel
  chair on top of a step-ladder.
- One change: put the chair at the pit's edge, half sunk, instead of on the
  ladder.

**tiny-door** · **plain** · plain office from its door · [shot](first-floor/tiny-door.jpg)
- First 3 s: a long corridor with a lamp, plants and a wet sign. The
  shrinking that is its point does not show from the door.
- One change: start the shrink inside the first three metres, so the ceiling
  is visibly lower at the second lamp.

**cable-drop** · **plain** · plain office · [shot](first-floor/cable-drop.jpg)
- First 3 s: a hole in the tiles with some cables hanging down, a red door.
- One change: ten times the cable, down to the carpet, swaying.

**museum** · **plain** · plain office · [shot](first-floor/museum.jpg)
- First 3 s: rope barriers, plinths, "GALLERY 0", a mug ("not yours"). A
  joke you read rather than a room you feel.
- One change: dim it to one spotlight per plinth.

**hall-of-fame** · **plain** · plain office · [shot](first-floor/hall-of-fame.jpg)
- First 3 s: a corridor of framed portraits and a plinth.
- One change: every portrait is of the same person.

**party** · **plain** · plain office · [shot](first-floor/party.jpg)
- First 3 s: "GOODBYE <name>, WE WILL REPLACE YOU", balloons, a cake on a
  table. A good line on a plain room.
- One change: the table is set for thirty and there are two chairs.

**copiers** · **plain** · plain office · [shot](first-floor/copiers.jpg)
- First 3 s: two rows of photocopiers, lids up.
- One change: every copier is printing the same sheet onto the floor, and the
  pile is waist high.

**mailroom** · **plain** · plain office · [shot](first-floor/mailroom.jpg)
- First 3 s: a counter with one brass tube up to the ceiling, pigeonholes.
- One change: a hundred tubes, a forest of them, all rattling.

**quiet-zone** · **plain** · plain office · [shot](first-floor/quiet-zone.jpg)
- First 3 s: acoustic foam, one desk, a meter on the wall.
- One change: foam on the floor and ceiling too, and the hum gone.

**kanban** · **plain** · plain office · [shot](first-floor/kanban.jpg)
- First 3 s: a full whiteboard of cards, a chair, a side table. Its landmark
  is "the board with one card", but the board is full.
- One change: one card on a wall-sized board, as its landmark says.

**vestibule** · **plain** · plain office · [shot](first-floor/vestibule.jpg)
- First 3 s: two glass panes in your face, a slot in the floor. The revolving
  doors do not read.
- One change: stand the drum back from the door, so it is seen whole.

**phone** · **plain** · plain office · [shot](first-floor/phone.jpg)
- First 3 s: a big empty room and a small phone on the carpet. With sound it
  rings, and the shot is muted. To the eye it is empty.
- One change: the cord runs from the phone across the whole floor and into
  the wall.

**lift** · **plain** · plain office · [shot](first-floor/lift.jpg)
- First 3 s: a pair of lift doors filling the frame, "LIFT B", a "4".
- One change: the doors are a crack open, with darkness, not a car, behind.

**nested** · **cut** · plain office · [shot](first-floor/nested.jpg)
- First 3 s: a blank yellow wall with a window into a lit space. The doorway
  faces the inner room's side.
- One change: move it off the first floor until the doorway faces the room
  inside the room.

**cover** · **cut** · plain office · [shot](first-floor/cover.jpg)
- First 3 s: an empty room, a grey shutter at the edge. The desk "that wants
  looking at" is not in view.
- One change: off the first floor. It is a dead-end puzzle that asks for
  patience, which a new player does not have yet.

**unsure-hall** · **plain** · not dealt here · [shot](first-floor/unsure-hall.jpg)
- First 3 s: a wide yellow corridor turning out of sight, a box stack.
- One change: none for the first floor.

### The landing and the way down

**landing** · **plain** · plain office · [shot](first-floor/landing.jpg)
- First 3 s: "VOTED 6TH BEST OFFICE PARK IN THE TRI-COUNTY AREA" across the
  top, a short hall, and a dark doorway beyond it. A good joke, then nothing.
- One change: the dark doorway ahead is the right idea. Make it the only lit
  thing at the end, and dim the near wall, so the eye is pulled down the hall.

**the way down (hole)** · **good** · [shot](first-floor/exit.jpg)
- First 3 s: a narrow room, a hole cut in the carpet, toppled caution signs,
  "ASSEMBLY POINT" with an arrow pointing down.
- One change: a draught: paper lifting at the edge of the hole.

### The ranking, best first

| # | room | grade |
|---|---|---|
| 1 | server-chasm | stunning |
| 2 | keyboard-floor | stunning |
| 3 | ceiling-meeting | stunning |
| 4 | last-light | stunning |
| 5 | blackout-bay | stunning |
| 6 | drop-plenum | good |
| 7 | all-hands | good |
| 8 | cubicle-grid | good |
| 9 | re-org | good |
| 10 | ceiling-plants | good |
| 11 | coolers | good |
| 12 | chairs | good |
| 13 | wet-floor | good |
| 14 | many-doors | good |
| 15 | way down | good |
| 16 | mandatory-fun | good |
| 17 | vending | good |
| 18 | photo | good |
| 19 | safety-corridor | good |
| 20 | shredding-bay | good |
| 21 | stress-pool | good |
| 22 | audit-pod | good |
| 23 | compactor-canyon | plain |
| 24 | cutouts | plain |
| 25 | tiny-door | plain |
| 26 | cable-drop | plain |
| 27 | museum | plain |
| 28 | hall-of-fame | plain |
| 29 | party | plain |
| 30 | landing | plain |
| 31 | copiers | plain |
| 32 | mailroom | plain |
| 33 | quiet-zone | plain |
| 34 | kanban | plain |
| 35 | vestibule | plain |
| 36 | phone | plain |
| 37 | lift | plain |
| 38 | nested | cut |
| 39 | cover | cut |

Not dealt on the first floor: mecha (stunning), unsure-hall (plain), dispatch
(plain).

What the ranking says:

- Five rooms are stunning, and they win the same way: a space at the wrong
  scale, the wrong way up, too long, or too dark.
- None of them wins with a prop or a line of text.
- The plain rooms are mostly a good joke in an ordinary box.

---

## Part 2 · The first two minutes, as they are today

**The visit:** seed 7, a whole visit as the game deals it (four parts, the
pursuer as the seed has it), at Classic and Full VHS.

**The walk:**
- At the game's walking speed (2.05 m/s), always to the nearest oddity not yet
  seen. That is the most inviting way when every room is a box: the next
  unusual thing.
- Four seconds' look round in each oddity, then on. After the five, to the
  way down.
- The route knows the plan, so it is the quickest a new player could be.
  Someone lost takes longer.

**The route:** seed 7's first floor has five oddities: coolers, kanban, nested,
audit-pod, photo. None of them is in the top five.

Rooms in the order they are entered (seconds):

| s | room |
|---|---|
| 0 | the landing |
| 1 to 5 | two plain rooms |
| 5 | coolers |
| 18 to 25 | four plain rooms |
| 26 | audit-pod |
| 34 to 41 | five plain rooms |
| 42 | kanban |
| 50 to 55 | two plain rooms |
| 55 | nested |
| 64 to 66 | two plain rooms |
| 68 | photo |
| 76 to 79 | two plain rooms |
| 81 | the way down |

The camcorder's own counter on the shots does not match these times: the
frames were staged one at a time.

**0 s** · [shot](first-floor/walk-7-000s.jpg)
- The banner joke across the top of the frame. A short hall, and a dark
  doorway at its end with coolers just visible.
- Draws the eye: the banner (it is big and it is text), then the dark
  doorway.
- No sound yet: the level is silent until the first key is pressed. Then
  comes the mains hum, the ballast buzz, footsteps and the owner's music, all
  low.

**5 s** · [shot](first-floor/walk-7-005s.jpg)
- At the mouth of the water-cooler corridor: a row of coolers running into
  black. **The first oddity, at 5 s.** It is a good one to meet first.
- The first room-specific sound can be here: a cooler's glug.

**10 s** · [shot](first-floor/walk-7-010s.jpg)
- Inside the dark half of the corridor: the frame is black but for the
  camcorder's numbers.
- This is the first unease, and it is real. But a new player may read it as
  the game failing to draw.

**20 s** · [shot](first-floor/walk-7-020s.jpg)
- Back through the landing's neighbour: an EXIT sign, the banner seen from
  behind. A coat stand and an **E** key cap float mid-screen.
- The E is the first thing on screen that is not the camcorder (decision 5).
- Nothing new for the eye for about 8 seconds.

**30 s** · [shot](first-floor/walk-7-030s.jpg)
- A plain room on the way out of audit-pod: a bare yellow wall. In audit-pod
  (26 s), a consultant has walked up and put a pink slip in the player's hand.
- **The first sign of anything alive is at about 26 s**: a person, and a
  comic one, not a frightening one.
- The 30 s beat itself is an empty corner.

**45 s** · [shot](first-floor/walk-7-045s.jpg)
- kanban: a whiteboard of yellow cards, more cards on the walls. The pink
  slip, still held, covers the right quarter of the frame.
- A second E key cap.

**60 s** · [shot](first-floor/walk-7-060s.jpg)
- nested: a yellow wall a metre away, and the pink slip.
- The eye gets nothing.

**75 s** · [shot](first-floor/walk-7-075s.jpg)
- Leaving photo for the way down: a dark ceiling fitting that reads at a
  glance as something with legs.
- An EXIT sign, and a pale cut-out figure in the room ahead.
- **The second hint of something alive is an accident of the dressing**, and
  the best one in the two minutes.

**81 to 120 s** · [shot](first-floor/walk-7-090s.jpg)
- At the way down: a hole in the carpet, "ASSEMBLY POINT ↓", the pink slip.
- On this walk the first floor is over before the second minute is. A visitor
  who knows the way reaches the hole at about 81 s.
- A lost visitor is still looping the plain rooms between kanban, nested and
  photo.

**What the two minutes add up to today:**

- **First "whoa": none.**
  - Nothing in this deal is in the top five. The dark corridor at 5 to 10 s
    is the nearest thing to one.
  - In 42% of visits none of the four openers is on the first floor at all (1,000
    seeds, Part 3).
- **First unease: 10 s**, the black end of the coolers corridor. It is gone
  by 18 s.
- **First sign of life: 26 s**, the consultant: comic, and handing you a prop
  that then blocks the view.
- **No pursuer and no cast on this first floor.** For seed 7 the mascot is on
  the last part, and the cast's first member is on the second.
- **What draws the eye:**
  - text: the banner, the pink slip;
  - the dark end of a corridor;
  - lit doorways.
- **What does not:**
  - every plain room: about two thirds of the walk is yellow boxes with
    nothing in them, which is the level's design (rule 6);
  - nested's and cover's doorway views.

---

## Part 3 · C9: the first rooms always include a stunning one

**The rule (FF-7):** for any seed, within N doorways of the landing on the
first floor there is at least one room from a short list, the **openers**.
This is a proposal for the lead; plan.js is the lead's, and the owner decides
when.

### Where the deal happens today

1. `planVisit` (plan.js) makes the visit's source, `makeRng('visit:<seed>')`,
   and calls `dealHand(R.fork('hand'), themes, story)`.
2. `dealHand` deals the hand across the parts.
   - It draws the deck in an order weighted by `weight`.
   - It puts each room in a part that fits: lessons taught above it, at home
     on that kind of floor, one set piece and one resident to a part.
   - Then it shuffles each part's list: `hands.map((h) => R.shuffle(h))`.
3. Part 0's list goes to `floorOf` → `generate(seed, { hand })` (gen.js).
4. gen.js places the oddities **in the hand's order**.
   - The first one placed (`placeSpecial(arch, first = true)`) grows from the
     landing. `hubs` holds only the landing at that point.
   - It hangs at the end of a run of 1 to 3 plain rooms (`runLength()`), so it
     is 2 to 4 doorways from the landing.
   - Later oddities hang off later rooms.

So **the landing's nearest oddity is, in practice, the first in part 0's
list.** Measured over 200 seeds:

- it was the nearest 86% of the time;
- the nearest oddity was 2 to 4 doorways away in 99% of visits (1 doorway in
  the other 1%).

### What "reachable" means

- **The graph:** `level.rooms` and their `doors`. Each door is a link to
  another room. `gen.js` `roomDistances(level, level.start.room)` is a
  breadth-first count of doorways from the landing.
- Every doorway counts as one step: plain, stepped, or a crawl hole. Rule 5
  says every doorway can be walked to from every other.
- **N = 4** is the proposal: two to four doorways is where the first oddity
  always lands, and at a walk it is under 15 seconds.

### The openers

- The audit's stunning rooms that are safe to meet first: **server-chasm,
  keyboard-floor, ceiling-meeting, last-light**.
- Not blackout-bay: without the flashlight, walking in ends the visit.
- Kept as data, a list D12 owns, e.g. `export const OPENERS = [...]` beside the
  deck (`deck2.js`), or a flag `opener: true` on a deck line. plan.js only reads
  it.
- All four need nothing but `lean`, are at home on the yellow floor, and are
  never `planned` or `headline`.
- Two of them are set pieces (last-light `big`, server-chasm `halo`). The rule
  must respect one set piece to a part.

### The change, in plan.js only

At the end of `dealHand`, after the shuffle, for part 0 only:

1. **If part 0 already holds an opener**, move the first one to the front of
   part 0's list. That is 58% of visits.
2. **Else, if a part below holds one that may go in part 0**, swap them.
   - The opener comes up. One of part 0's rooms that fits that lower part goes
     down in its place.
   - The fit checks are those `fits()` already makes: set piece, resident,
     lessons. Part 0's rooms need nothing but `lean`, so a lower part can
     always take one.
   - Then move the opener to the front. That is 26% of visits.
3. **Else**, put an opener the visit was not dealt in place of part 0's last
   room (16%), then move it to the front. The hand stays the same size.
4. Every choice is made from a **fork of its own**: `R.fork('opener')` off the
   visit's source.
   - `fork` is by label and moves no other stream, so nothing else a seed
     rolls changes.
   - Which opener is picked can be weighted by `weight`, as the deck is.

**Why this keeps seeded determinism:**

- Every step is a pure function of the seed and the deck. The same seed
  always gives the same opener in the same place.
- The move to the front uses no randomness at all.

**A safety net, still in plan.js:**

- `floorOf` can check, after `generate`, that an opener is within N doorways.
- If one ever is not (say a big opener would not fit at the landing in 14
  tries), it deals the floor again from a deterministic fork,
  `{ seed: '<seed>/opener:2' }`.
- In 1,000 seeds the check never fired.

**A test**, beside `test/backrooms-depths.test.mjs`: over 1,000 seeds, the
nearest opener on part 0 is at most 4 doorways from the landing. Also, every
seed still deals the same building twice.

### Measured, without changing the code

I simulated it from outside: the planned visit's part 0 hand was edited as
above before `floorOf` built it. Over 1,000 seeds, doorways from the landing to
the nearest opener:

| doorways | today | with C9 |
|---|---|---|
| 1 | 0.1% | 0.7% |
| 2 | 2% | 15% |
| 3 | 9% | 55% |
| 4 | 6% | 29% |
| 5 or more | 41% | none |
| no opener on the floor | 42% | none |

Which opener led with C9:

| opener | share |
|---|---|
| ceiling-meeting | 38% |
| keyboard-floor | 33% |
| last-light | 18% |
| server-chasm | 11% |

If the owner wants the big set pieces to lead more often, weight the pick.

**What else it moves:**

- The swap and the replacement must never take out the room the `hall` fork
  put in part 0 (the planned hallway's teacher, usually cutouts). The hallway
  is dealt below it, and has to stay below it. My simulation did not hold to
  this; the real rule must, and the test should check it.
- The first-floor share of each room shifts toward the four openers. The
  floor's count of oddities and rooms is unchanged.

### What it does to the edition

- `edition()` (plan.js) hashes a fixed visit's whole plan and every part's
  rooms. The change moves part 0's order for every seed and swaps rooms
  between parts in about four visits in ten. So **the edition changes, for
  every building at once**.
- The edition is not bumped by hand: it is a hash, and it moves by itself on
  the merge.
- **Saved tapes:**
  - A kept tape says which edition it was shot in (`core/runs.mjs`).
  - The archive keys tapes by seed and edition (`core/archive.mjs`), so an
    older tape is kept, and is never confused with a new one of the same
    seed.
  - But it cannot be played back as the building it was walked in: that
    building is no longer what its seed deals.
- **Boards:**
  - A score made before C9 and one made after, on the same seed, are of
    different buildings. A board keyed by seed alone mixes them; a board keyed
    by seed and edition splits into two.
  - Once the daily is live (S-1 pins the edition on the day's ticket), the
    merge must land after midnight UTC (L-4), so no day's board straddles two
    buildings.
  - D-4 wants past days to play "as it was (its edition)". Today the code
    deals only the current edition. Either D-4 accepts that days before C9
    replay in the new building, or the deal grows a version switch
    (`planVisit(seed, { edition })`) that keeps the old order. That is the
    lead's call.
- **When:** batch it with the next edition change (the library's weekly batch,
  LB-5, or the FF-8 moves). Then players lose their old buildings once, not
  twice.

**The owner's call:** the opener list (decision 1), N = 4, and when it lands
(decision 2).
