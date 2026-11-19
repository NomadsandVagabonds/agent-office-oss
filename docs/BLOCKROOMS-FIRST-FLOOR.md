# BlockRooms: the first floor

Status: **an audit, nothing built.** Taken on `blockrooms-live` at 28b5997,
19 November, and re-graded the same day on what each room does. No game code
was changed to write it.

The owner: "only a couple minutes to grip a new player so our first floor has
to be stunning." And, since: the bar is **surreal and wrong, away from a
standard office**. And on the first version of this audit: "Screenshots are
not the best judge. For instance the elevator room could have more interesting
set dressing but the elevator itself is an interactive slot machine where you
never know what appears and is a good fit for our game."

So every room has two grades:

- **play:** keep / good / weak. What it does: its event, its creature, its
  surprise, what answers when you try something.
- **look:** stunning / good / plain. What the eye gets from the doorway in
  the first three seconds.

## Summary

**Top 5, on both:**

1. **server-chasm** (keep · stunning): a red-lit void of server towers. You
   throw breakers to run bridges out to a desk on a spire, watched from a lit
   doorway across the drop.
2. **last-light** (keep · stunning): a hall too long. Its lights die from the
   far end towards you, and the colleague at the end only stays put in your
   flashlight beam.
3. **keyboard-floor** (keep · stunning): the floor is a keyboard the size of
   a room. You type by walking, and the wall-sized screen answers.
4. **blackout-bay** (keep · stunning): pitch dark, one exit sign, a pale
   figure. Without the flashlight the dark ends the visit. With it, the
   figures freeze in the beam and creep when you look away.
5. **all-hands** (keep · good): a dark hall of seated figures facing a
   projector. When Q&A starts every head turns round to watch you, and the
   speaker comes closer in the blackouts.

**Bottom 5, on both** (weakest first). Each is weak in play and no better than
good to look at:

1. **museum** (weak · plain): plinths and ropes; nothing answers.
2. **party** (weak · plain): a good banner on a table; nothing happens.
3. **kanban** (weak · plain): E adds a sticky note, and that is all.
4. **wet-floor** (weak · good): forty signs and a drip; nothing to do.
5. **chairs** (weak · good): rings of chairs facing in; nothing to do.

**Needs dressing, not replacing.** These play well and look plain (13 rooms;
the one dressing change for each is in Part 1):

- lift, cutouts, hall-of-fame, tiny-door
- compactor-canyon, cable-drop, cover, vestibule, nested
- quiet-zone, mailroom, copiers, phone

**Plain in both:** museum, party, kanban. The landing is plain to look at too,
but it has a job of its own (you fall into it).

**Strong to look at, weak in play** (a look with no behaviour behind it):
ceiling-meeting, ceiling-plants, chairs, wet-floor, stress-pool.

**Decisions for the owner:**

1. **No C9 (decided, 19 Nov).** The owner does not want any room to show up
   more often: variety is the game. The measurement is kept as a note at the
   end.
2. **Dressing before replacing.** The 13 rooms above need set dressing, not
   new ideas. The three plain in both are the ones to rethink.
3. **Four first-floor rooms can end the visit.** In this walk-through the
   visit ended three times on the first floor: in cable-drop (the Trunk Line
   caught me), mandatory-fun (empty-handed, mobbed in about ten seconds) and
   cubicle-grid (off the beams). blackout-bay does it too without the
   flashlight. Is that wanted on the floor a new player lands on?
4. **The lift on the first floor never brings a creature.** The code turns
   that third of the slot machine off on the landing floor. The car comes
   for 45% of presses; it is empty, has an item in it, or has someone in it, a
   third each. On the first floor "someone" becomes "empty". That is the
   owner's slot machine with one reel removed where most players meet it
   first.
5. **The first floor is short.** On a walk that knows the way, seed 7's whole
   first floor is done in **81 seconds** (Part 2).
6. **The things on screen.** Every frame has the six-slot inventory strip and
   the heart. Near anything usable an **E** key cap appears in mid-screen, and
   a picked-up item's name shows above the strip. Rule 1 says no control
   hints. If those were meant, leave them.
7. **Two likeness risks for the Q-1 sweep.** cubicle-grid's "Smiling Office
   Workers" (ear-to-ear grins, pursuing) and mandatory-fun's staff in party
   hats with red balloons are close to well-known community designs.

---

## How the rooms were shot and played

- **Where:** the level's own dev page, `/world/dev/backrooms.html`, served by
  the office daemon on a spare port with its data in a scratch folder. There is
  no `/play` route in this tree.
- **Parameters that exist** (`public/world/dev/backrooms.js`): `seed`, `room`
  (deals that room in beside the landing and stands you in it), `only`,
  `pursuer=0`, `mute=1`, `vhs`, `graphics`, `x`, `z`, `yaw`, `pitch`.
- **The doorway shot:**
  - `seed=7&room=<id>&pursuer=0&mute=1`, Graphics at Classic and the
    camcorder at Full VHS (both the defaults).
  - The page's own spawn for the room: 0.9 m inside the main door, at eye
    height, facing in.
- **The play:**
  - First, each room's code: its `c.tick`, `c.use` and `c.zone`, the creatures
    it places, the sounds it plays, its rule file.
  - Then each was played in the browser. I walked from the door to the far
    wall at walking pace and looked back, then pressed E at each of its first
    uses, logging every sound the room played.
  - The lift was called again and again.
  - An event shot (`<id>-event.jpg`) is kept where the event is visual.
- **Size:** 960 by 600 JPEG, quality 64 to 68. 62 files (42 doorway shots, 11
  event shots, 9 storyboard frames), 2.8 MB in all, the largest 63 KB.

**Which rooms can be on the first floor.**

- 40 of the deck's 97 lines are at home on the yellow floor
  (`themes.js` `atHome(line, 'yellow') > 0`).
- Three of the 40 are never dealt there: **unsure-hall** (`planned`: never
  where you land), **dispatch** and **mecha** (`headline`: never on the floor
  you land on). They are graded on looks only, and marked "not dealt here".
- The other 37 can be dealt, plus the landing, plus the way down (shown here
  as seed 7's hole in the floor).

**How often** each is on the first floor, over 200 visits (`planVisit` then
`floorOf(v, 0)`):

- **cutouts** is there in 56% of visits. It teaches what the planned hallway
  needs, so the plan pulls it up top.
- Most others are there in 15 to 27% of visits.
- The rarest are shredding-bay 4%, blackout-bay 7% and cubicle-grid 7%.

---

## Part 1 · The audit

Each room: its two grades, what it **does** in one line, what the eye
**sees**, and the **one change** that would help most. A room that plays well
and looks plain is marked **needs dressing, not replacing**.

### Set pieces and the big rooms

**server-chasm** · play **keep** · look **stunning** · [door](first-floor/server-chasm.jpg) · [event](first-floor/server-chasm-event.jpg)
- Does: two knife-breakers each run a steel span out over the drop to a desk
  on a spire. A lever severs the cable trunk. A gaunt figure watches from a lit
  doorway across the void.
- Sees: server towers rising either side, a catwalk over a red glow.
- One change: cut the first metre of grating, so the drop shows from the
  door.

**last-light** · play **keep** · look **stunning** · [door](first-floor/last-light.jpg) · [event](first-floor/last-light-event.jpg)
- Does: the hall's lights go out from the far end towards you. The colleague
  at the end needs the real flashlight beam on it to stay still; out of the
  beam, it comes.
- Sees: a hall too long, door frames repeating, a figure at the far end.
- One change: the figure is a few pixels tall from the door. Make it read at
  once.

**blackout-bay** · play **keep** · look **stunning** · [door](first-floor/blackout-bay.jpg)
- Does: step into the dark without the yellow flashlight and the picture
  floods red and the visit ends. With it, the Stand-Ins freeze in the beam and
  creep closer when you look away. The flashlight lies by the door.
- Sees: near black, a green exit sign, a pale long-faced figure.
- One change: none to the room. Its danger on a first floor is decision 3.

**all-hands** · play **keep** · look **good** · [door](first-floor/all-hands.jpg) · [event](first-floor/all-hands-event.jpg)
- Does: walk down the aisle and every seated head turns round 180° to watch
  you. The tall keynote speaker advances in the projector's blackouts. You
  answer at the lectern ("advance transparency", "say 'no questions'").
- Sees: a dark hall and a white slide, but a pale lectern fills the bottom of
  the frame.
- One change: move the lectern out of the doorway's sightline, so the seated
  rows are seen first.

**drop-plenum** · play **keep** · look **good** · [door](first-floor/drop-plenum.jpg) · [event](first-floor/drop-plenum-event.jpg)
- Does: crank the jammed fire shutter, or climb the step-ladder through the
  ceiling into a red plenum. There another office hangs upside down overhead,
  some tiles give way, and blind Plenum Toners prowl and listen.
- Sees: a ladder into a red ceiling, a block wall, two desks.
- One change: put the upside-down office in sight from the door.

**cubicle-grid** · play **keep** · look **good** · [door](first-floor/cubicle-grid.jpg)
- Does: you cross a sunken cubicle farm on the tops of its partitions, with
  two spans buckled out. Step on and the workers below climb the walls after
  you; a fall ends the visit. Fire doors can be shut on them.
- Sees: an evenly lit grid of beams over a shallow-looking pit.
- One change: kill the tubes over the pit, so the beams cross black.
- Likeness: decision 7.

**re-org** · play **keep** · look **good** · [door](first-floor/re-org.jpg)
- Does: the room's lower exits are sealed. You climb a pile of tipped
  cubicles, up decks and fallen-door ramps to +4.8 m, and ring the bell at
  Desk 5A to unseal them. Uncanny half-faced colleagues sit in the pile.
- Sees: grey-beige cubicle walls piled and tipped, a dark ceiling. A
  cluttered storeroom from the door.
- One change: clear the line from the door, so the pile stands against the
  black of the pit.

**compactor-canyon** · play **keep** · look **plain** · **needs dressing, not replacing** · [door](first-floor/compactor-canyon.jpg)
- Does: hand-cranks roll 8.6 m archive stacks apart along floor rails.
  Something pale looks out of the seams and is gone when you crank. Slot 3
  hides a camp with files to take.
- Sees: a flat grey face of shelving a metre from the door.
- One change: open the doorway onto a seam between two stacks, lit from
  above, so their height is the first thing seen.

**mecha** · look **stunning** · not dealt here · [door](first-floor/mecha.jpg)
- A headline room and the owner's own; never on the first floor.

**dispatch** · look **plain** · not dealt here · [door](first-floor/dispatch.jpg)

**unsure-hall** · look **plain** · not dealt here · [door](first-floor/unsure-hall.jpg)

### Rooms with someone in them

**cable-drop** · play **keep** · look **plain** · **needs dressing, not replacing** · [door](first-floor/cable-drop.jpg) · [event](first-floor/cable-drop-event.jpg)
- Does: walk round the hanging leads and nothing stirs. Walk or run under
  them and the Trunk Line, a body of patch cable, drops out of the ceiling and
  hunts you until a fire door is shut in its face. It caught me.
- Sees: a hole in the tiles, a few cables, a red door.
- One change: ten times the cable, down to the carpet, so the drop is what
  you walk round.

**mandatory-fun** · play **keep** · look **good** · [door](first-floor/mandatory-fun.jpg) · [event](first-floor/mandatory-fun-event.jpg)
- Does: take a red balloon and the six party staff dance with you. Come in
  empty-handed and they all converge. I was mobbed and the visit ended inside
  ten seconds.
- Sees: bunting, a tall cake, "HAPPY LAST DAY · WE SAVED YOUR PIECE", staff
  in party hats.
- One change: put the balloons by the door, where a first-timer's hand finds
  one before the staff find them. Likeness: decision 7.

**shredding-bay** · play **keep** · look **good** · [door](first-floor/shredding-bay.jpg)
- Does: a whistling clerk wheels a shredder after you. Hand her paper (loose
  memos, or audit-pod's pink slip) and she goes back to her corner happy.
  Empty-handed, into the rollers you go.
- Sees: shelving, bins, the clerk.
- One change: shred ankle-deep across the floor.

**safety-corridor** · play **keep** · look **good** · [door](first-floor/safety-corridor.jpg)
- Does: the Floor Warden watches you walk past. Run and he whistles and
  sprints after you with three-foot scissors. Outrun him for 6.5 s, or shut a
  fire door, and he trips on his blades and leaves the scissors for you.
- Sees: a striped corridor and a man in hi-vis.
- One change: a corridor far longer than the room should allow.

**audit-pod** · play **good** · look **good** · [door](first-floor/audit-pod.jpg)
- Does: two consultants walk up, click their pens and hand you a pink slip
  with your name on it. The slip is paper, so it pays the shredder clerk and
  the vending machines.
- Sees: a consultant, a pink "NOTICE OF REDUNDANCY".
- One change: hold the slip smaller. Once taken it covers a quarter of the
  screen (Part 2).

**cutouts** · play **keep** · look **plain** · **needs dressing, not replacing** · [door](first-floor/cutouts.jpg)
- Does: cardboard colleagues (the office's real people, sometimes you) move
  only while you are not looking. They shuffle closer and turn to face you,
  and one may follow you out of the room. The floor's commonest oddity, and it
  earns it.
- Sees: an empty yellow box with three cut-outs against a side wall.
- One change: stand them in a line at the far wall, facing the door, so the
  first look sets them where the second look finds them gone.

**photo** · play **good** · look **good** · [door](first-floor/photo.jpg)
- Does: stand on the cross of tape with your name on it, and after a second
  the camera flashes. While you are blinded the whole line-up turns, towards
  you, then away, then back.
- Sees: a backdrop, seven cut-outs posed, a tripod pointed at you.
- One change: one person-shaped gap in the line-up.

**hall-of-fame** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/hall-of-fame.jpg)
- Does: walk past a portrait and, behind your back, it closes its eyes. The
  last frame is empty "next month", or is you.
- Sees: a corridor of framed portraits and a plinth.
- One change: light each portrait from its own picture lamp and drop the
  tubes, so the eyes are what the light is on.

### The lift, the machines and the rooms that answer

**lift** · play **keep** · look **plain** · **needs dressing, not replacing** · [door](first-floor/lift.jpg) · [event](first-floor/lift-event.jpg)
- Does: a slot machine. Press the button and the floor numbers run, it dings
  and the doors open on bricks ("OUT OF ORDER · PLEASE USE THE OTHER LIFT"), a
  cut-out, a poster, or a real car. A car is empty, holds a snack or the
  scissors, or brings someone up. On the first floor it never brings anyone
  (decision 4).
- Sees: a pair of steel doors filling the frame.
- One change: a lobby worth waiting in: a row of chairs facing the doors, a
  dead plant, a floor indicator that also shows floors that do not exist.

**vending** · play **keep** · look **good** · [door](first-floor/vending.jpg)
- Does: a real shop with no words on it. Three papers buy a common item, two
  commons buy another, three kinds buy a rare; two vends a floor. One machine
  may sulk, turned to the wall.
- Sees: an aisle of lit machines in a dark room.
- One change: the sulking machine turned to face the door, so it is seen
  first.

**keyboard-floor** · play **keep** · look **stunning** · [door](first-floor/keyboard-floor.jpg)
- Does: each key clacks and goes down under your foot, letters appear on the
  screen, and Enter runs the line. It answers: "WHY" gets "YOU LEANED ON IT.";
  anything else gets "BAD COMMAND OR FILE NAME".
- Sees: the keys, waist high, and the screen saying "READY."
- One change: none needed.

**many-doors** · play **good** · look **good** · [door](first-floor/many-doors.jpg) · [event](first-floor/many-doors-event.jpg)
- Does: every door has an HTTP status on it. E at any of them rattles it.
  Only 200 OK swings open, with light under it and a way on.
- Sees: five identical doors and "PLEASE USE THE CORRECT DOOR".
- One change: twice the doors, round all three walls.

**coolers** · play **keep** · look **good** · [door](first-floor/coolers.jpg)
- Does: one cooler bubbles and glugs, and every cup you take ends up on the
  carpet with the others. Walk on into the dark and, while you face it, the
  corridor quietly carries you back. It never ends.
- Sees: a narrow corridor of coolers running into black.
- One change: none to the look. The endlessness is invisible: let one dropped
  cup be found again further on.

**tiny-door** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/tiny-door.jpg) · [event](first-floor/tiny-door-event.jpg)
- Does: the corridor is a funnel. You stoop, then crawl, to a small door
  ("MEETING ROOM 0.3"). Knock and whoever is inside puts the light out and
  turns the plaque round, until they think you have gone.
- Sees: a long corridor, a lamp, plants, a wet sign. The shrinking does not
  show.
- One change: start the shrink within three metres, so the ceiling is visibly
  lower at the second lamp.

**quiet-zone** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/quiet-zone.jpg) · [event](first-floor/quiet-zone-event.jpg)
- Does: a decibel meter on the wall reads how fast you move. Go over its limit
  and shutters seal every doorway until you have been quiet for a while.
- Sees: acoustic foam, one desk, the meter.
- One change: foam on floor and ceiling too, so the room swallows the hum on
  sight.

**mailroom** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/mailroom.jpg)
- Does: E at the desk dispatches a canister. It climbs the glass riser and
  rattles along the ceiling pipe that leads towards the way down, and that
  doorway's lamp lights. A guide nobody explains.
- Sees: a counter, one brass riser, pigeonholes.
- One change: many more pipes overhead, so the one that rattles is a choice.

**copiers** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/copiers.jpg)
- Does: the copiers scan the empty air as you pass (whirr, seek, clack). One
  prints a slip with an arrow pointing to the doorway that leads on.
- Sees: two rows of copiers, lids up.
- One change: every tray spilling paper onto the floor, so the one slip that
  matters has to be found.

**phone** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/phone.jpg)
- Does: the phone rings for as long as you are not near it, and stops the
  moment you could answer. Pick it up and there is only a dial tone.
- Sees: a big empty room, a small phone.
- One change: the cord running from the phone across the whole floor into the
  wall.

**vestibule** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/vestibule.jpg)
- Does: revolving drums carry you round, or refuse you (one is jammed and
  puts you back). A glass rotor flush in the floor drops you out of its twin
  in the ceiling. A third drum juts sideways out of a wall.
- Sees: two glass panes in your face.
- One change: stand the drums back from the door, so they are seen whole and
  turning.

**nested** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/nested.jpg)
- Does: a meeting room inside a meeting room inside one you would have to be
  a mouse to book. You stoop to get into each, and the smallest has light
  inside that you can never reach.
- Sees: a blank wall a metre away (the doorway faces the inner room's side).
- One change: turn the inner room so its painted door faces the doorway.

**cover** · play **good** · look **plain** · **needs dressing, not replacing** · [door](first-floor/cover.jpg) · [event](first-floor/cover-event.jpg)
- Does: the desk's screen says ACTIVE, and the stock cupboard's shutter stays
  up, only while somebody looks at it. The tape deck records you and plays you
  back as a cardboard cut-out of yourself, so your decoy watches the desk
  while you take what is in the cupboard.
- Sees: an empty room and a grey shutter. The desk and the deck are not in
  view.
- One change: put the desk, its glowing AWAY screen and the deck in the
  doorway's line of sight.

**stress-pool** · play **weak** · look **good** · [door](first-floor/stress-pool.jpg)
- Does: you can wade in (slower, lower). E squeezes a ball or rustles a
  shred. Nothing else.
- Sees: a sunken pit of shred, a chair on a step-ladder.
- One change (play): something lost in the pit to wade for.

### Rooms that only look

**ceiling-meeting** · play **weak** · look **stunning** · [door](first-floor/ceiling-meeting.jpg)
- Does: nothing; no tick and no use. The table, chairs, mugs and agenda stay
  bolted upside down.
- One change (play): a chair falls once, when your back is turned.

**ceiling-plants** · play **weak** · look **good** · [door](first-floor/ceiling-plants.jpg)
- Does: nothing.
- One change (play): leaves drift down where you walked.

**chairs** · play **weak** · look **good** · [door](first-floor/chairs.jpg)
- Does: nothing. Its variants (a ring facing a corner thing, an arch of
  stacked chairs) are all still.
- One change (play): the chairs face you when you look back, as the
  cut-outs do.

**wet-floor** · play **weak** · look **good** · [door](first-floor/wet-floor.jpg)
- Does: a drip clicks now and then; the one wet patch is the one with no
  sign.
- One change (play): you slip on the unsigned patch.

**party** · play **weak** · look **plain** · [door](first-floor/party.jpg)
- Does: nothing: a banner with your name, a cake, guests in paper hats
  standing still.
- One change: rethink. It is plain in both, and mandatory-fun does a party
  better.

**museum** · play **weak** · look **plain** · [door](first-floor/museum.jpg)
- Does: nothing: plinths, ropes, labels ("MUG · not yours").
- One change: rethink. An exhibit that is missing when you look back would
  make it a room.

**kanban** · play **weak** · look **plain** · [door](first-floor/kanban.jpg)
- Does: E adds another card, up to 36.
- One change: rethink. Its landmark is "the board with one card", and the
  board is full.

### The landing and the way down

**landing** · play **n/a** · look **plain** · [door](first-floor/landing.jpg)
- Does: you land in it under the hole in its ceiling you came through, with
  the tiles you brought down. It is kept lit so you can see where you are.
- Sees: the "VOTED 6TH BEST OFFICE PARK" banner, a short hall, a dark doorway.
- One change: dim the near wall, so the eye is pulled to the dark doorway.

**the way down (hole)** · play **keep** · look **good** · [door](first-floor/exit.jpg)
- Does: a fire door whose bar you push by walking into it, and beyond it a
  hole in the carpet ("ASSEMBLY POINT ↓") you go down through. No key, no
  stairs.
- One change: paper lifting at the edge of the hole, a draught.

### The ranking, on both

Play first, then look. A room that plays well and looks plain sits above one
that looks good and does nothing.

| # | room | play · look |
|---|---|---|
| 1 | server-chasm | keep · stunning |
| 2 | last-light | keep · stunning |
| 3 | keyboard-floor | keep · stunning |
| 4 | blackout-bay | keep · stunning |
| 5 | all-hands | keep · good |
| 6 | drop-plenum | keep · good |
| 7 | coolers | keep · good |
| 8 | cubicle-grid | keep · good |
| 9 | re-org | keep · good |
| 10 | vending | keep · good |
| 11 | mandatory-fun | keep · good |
| 12 | shredding-bay | keep · good |
| 13 | safety-corridor | keep · good |
| 14 | way down | keep · good |
| 15 | lift | keep · plain |
| 16 | cutouts | keep · plain |
| 17 | cable-drop | keep · plain |
| 18 | compactor-canyon | keep · plain |
| 19 | photo | good · good |
| 20 | many-doors | good · good |
| 21 | audit-pod | good · good |
| 22 | cover | good · plain |
| 23 | vestibule | good · plain |
| 24 | hall-of-fame | good · plain |
| 25 | tiny-door | good · plain |
| 26 | quiet-zone | good · plain |
| 27 | mailroom | good · plain |
| 28 | copiers | good · plain |
| 29 | nested | good · plain |
| 30 | phone | good · plain |
| 31 | ceiling-meeting | weak · stunning |
| 32 | stress-pool | weak · good |
| 33 | ceiling-plants | weak · good |
| 34 | chairs | weak · good |
| 35 | wet-floor | weak · good |
| 36 | kanban | weak · plain |
| 37 | party | weak · plain |
| 38 | museum | weak · plain |

The landing (n/a · plain) is not ranked: it has a job of its own. Not dealt on
the first floor: mecha, dispatch, unsure-hall.

What the re-grade says:

- **The deck is better than its doorways.** 13 rooms that looked plain play
  well; their doorway view hides the very thing they do.
- **Only three rooms are plain in both:** museum, party and kanban.
- **The rooms that look best and do nothing are the ceiling rooms and the
  still lifes.** A single behaviour, borrowed from the cut-outs' rule (only
  while you are not looking), would lift most of them.

### Surprises in the code

- **The coolers corridor is endless.** While you face the dark it carries you
  back 2.4 m at a time (`c.zone` in `rooms.js`). No shot can show it, and
  nothing on screen tells a player.
- **The lift's creature reel is off on the first floor** (`rooms3.js`: no
  company when the depth is 0). Decision 4.
- **Rooms that point the way.** copiers prints an arrow to the doorway that
  leads on, and mailroom's canister rattles along the pipe towards the way
  down. Two quiet guides nobody would guess from their doorways.
- **Rooms that feed each other.** audit-pod's pink slip is paper. It pays the
  shredder clerk in shredding-bay and buys from the vending machines.
- **The cover room's decoy is a cardboard you.** It is one of the cleverest
  things in the deck, and the doorway shows an empty room.
- **re-org seals its lower exits until the bell is rung.** It is the one room
  on the first floor that holds you until you solve it.
- **The visit ended three times in this walk-through** (decision 3).

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
- Re-graded: this is also the room's play. Keep walking into the black and
  the corridor carries you back; it never ends. The scripted walk turned back
  here, as a visitor who does not know that would. Nothing tells a player the
  corridor is endless, so most will turn back too.

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
- Re-graded: the slip is worth having. It is paper, and pays the shredder
  clerk and the vending machines. On seed 7's first floor there is neither, so
  here it is only a prop in the way.

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
  - In 42% of visits none of the four rooms the note measured is on the
    first floor at all (1,000 seeds, the note at the end).
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

## Note · How often a strong room is near the landing (C9, not adopted)

A rule that the first rooms off the landing always include one of the four
strongest by their looks (C9) was proposed and **turned down by the owner on
19 November**: no room should show up more often than another; variety is the game. Nothing
was built. The measurement is kept because it says how the first floor deals
today.


I simulated it from outside: the planned visit's part 0 hand was edited as
above before `floorOf` built it. Over 1,000 seeds, doorways from the landing to
the nearest of those four: server-chasm, keyboard-floor, ceiling-meeting and
last-light, chosen on looks before the re-grade on play.

| doorways | today | with the rule |
|---|---|---|
| 1 | 0.1% | 0.7% |
| 2 | 2% | 15% |
| 3 | 9% | 55% |
| 4 | 6% | 29% |
| 5 or more | 41% | none |
| none of the four on the floor | 42% | none |

Which of the four would have led:

| room | share |
|---|---|
| ceiling-meeting | 38% |
| keyboard-floor | 33% |
| last-light | 18% |
| server-chasm | 11% |
