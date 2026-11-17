# The Offsite Reserve (`forest`): an outside review

17 November 2026. A review of Gemini's forest floor by a session that built none of it. Nothing in the
floor or in shared code was changed. Judged against the owner's standing rules: less is more, no
instruction cards or control hints, mostly mundane rooms with rare set pieces, one building, people die
and learn, a thing must be discoverable and not arbitrary.

## Read this first

**No crash and no way to break a visit was found.** About fifty loads over three seeds (3, 7 and 11, one of them also as a
two-part visit), every one of the fifteen rooms at Classic and at High, with and without the camcorder
picture: nothing logged, `said` empty every time, every room built, every doorway reachable.

Four things are closest to breaking a rule of the place, in order:

1. **Twelve of the fifteen rooms' signs are instruction cards, and five name a key.** `CROUCH [C] BELOW EYE
   SCARS`, `ACCEPT RATION [E] (+1 HEART)`, `AUTHORIZED ROOT DESCENT [E]`, `CROUCH [C] UNDER COCOONS`,
   `CROUCH [C] IN DRY BRACKEN`, and on plain walls `CROUCH [C] IN BRACKEN`. The others state the rule
   outright (`DO NOT TURN YOUR BACK`, `BEAM LOCKS TIMBER AUDITOR`, `LEAN NOTCHED PINE TO BRIDGE PIT`,
   `DECOY ARROWS TURN UNSEEN`). Only `tree-farm` and `burn-scar` have a sign that is just a sign. This is the owner's first rule, broken
   in twelve rooms.
2. **The bulldozer pushes the visitor.** `clear-cut` adds a collider that travels (`c.rt.colliders.push`,
   moved every frame). Standing in its lane I was shoved 3.6 m along it and lost two hearts in one pass
   (a heart every two seconds while it has you on the blade). It did not trap me. `docs/BACKROOMS.md`:
   "Nothing pushes the visitor. No moving walls, no colliders that travel."
3. **Three things that can be used do nothing that can be seen.** The sap manifold (`tree-farm`), the
   lanyard cord (`inverted-grove`) and the fire-finder (`fire-lookout`). See section 4: one of these is
   the owner's mystery room.
4. **Six of the fifteen rooms take hearts** (stag 2, facilitator, cocoons, auditor, marshal, bulldozer
   1 each), each with its own resident, on top of whatever the cast dealt. The guide's line is that a
   room's own hazard sets somebody back and ending a visit is for the things that hunt. Standing beside
   the stag ended my visit in two hits.

What I did not check is listed at the end of section 3. Game time runs slow under software rendering
here, so I give rule constants from the code where a duration matters, not stopwatch times.

Pictures are in the review session's scratchpad (`sheets/*.png`, one sheet a room: doorway and two
inside views at Classic, the same at High, and through the full camcorder). They are not committed.

---

## 1. The floor as a whole

**What it is.** An office floor where rolled moss stops short of the carpet, trunks go up through the
ceiling tiles, and the partitions are plasterboard painted with pixel trees. The idea is right for this
building and it is the same joke as the suburb: a place described to something that never saw one.

**Where the idea lands.** In the plain rooms, more than in the set pieces. A cream office wall, a
ceiling grid with every other panel on, a gravel strip, a desk with a lit monitor and ferns coming up
round it, a porter mopping moss: that picture is this game. It is one place and it is recognisably the
same building as the yellow floor.

**Where it does not.**

- **Nothing is empty.** The guide says most of the place is nothing much and about one plain room in
  sixteen has anything left in it. Here every plain room is planted to a budget: a tree for every
  2.5 m², ferns, mushrooms, stepped rock, hung drapes. On top of that, 45% of eligible plain rooms roll
  one of eight oddities (a grid of birdhouses, a sunk tent with shoes, a footbridge over dry carpet), 42%
  a sign, 32% a creature of their own (the Trail Spotter, 16% of the battery a flash). A plain forest
  room is busier than an oddity on the yellow floor, so the oddities have nothing to stand out against.
- **Every set room is the same room.** All fifteen are built from one kit: a ring or pinwheel of 2.4 m
  baffles (hedge with a yellow and a blue cable drawn on it, painted-tree plasterboard, cordwood, tarp),
  a centrepiece, a lantern, a battery and a snack, a thicket filled to the triangle cap, mist cards,
  a sign. From the doorway five of them (`campfire-circle`, `clear-cut`, `inverted-grove`, `old-growth`,
  `nursery-aisles`) show a wall three metres away and nothing else, and in most of the rest the
  centrepiece is behind a baffle. The comments say this is on purpose ("you NEVER see > 4 m"). It
  makes the first two rooms tense and the rest identical. The rooms that read best let you see them
  from the door: `hollow-tree` (an orange doorway in a trunk), `bog-boardwalk` (a plank walk across
  black water), `fire-lookout` (a tower jammed into the ceiling).
- **Everything is the same green.** Wall, moss, hedge, painted trees, the tubes (chartreuse `#dcf596`),
  the grade and the haze are all green. The three rooms that leave the palette (`burn-scar` grey and
  amber, `clear-cut` brown clay and a yellow machine, `hollow-tree` orange) are the three best pictures
  on the floor.
- **The stepped rock and dirt hills** (`buildPnwTerrain`: half-metre grass-topped dirt cubes and
  mossy cobble) read as another, very well known block-building game's terrain, not as an office's idea
  of a hill. Nothing else in the building is built of cubes of earth. I would cut them from every room
  that is not about them, and make what is left look like something facilities did: stacked carpet
  tiles, turf rolled over filing cabinets, pallets under a tarp.
- **Tone.** The sad fox with a bindle, the badger with an eviction notice and the fawn are charming and
  they are a cartoon. Beside the facilitator's grin and the marshal's detector face, which are this
  game's kind of wrong, they are a different register. One of them, alone, not looking at you, would do
  more.

**Pacing.** A forest floor on these seeds is 26 to 34 rooms with six or seven oddities, which is the
building's usual share. The problem is not the count, it is that three of every four dealt rooms have a
resident, a hazard or a puzzle, and the plain rooms have their own. There is no quiet to be lost in.
Proposal: the plain rooms lose the Spotter and the oddity roll entirely and two thirds of their
planting; half of the fifteen deck rooms lose their mechanic and become places (see the verdicts).

**Beside the other floors.** The suburb is bright, flat, wide and nearly empty, and its wrongness is in
proportion. The forest is the opposite on every axis: dark, tall, crowded, full of mechanics. As a
contrast that is worth having, but it should be the forest's trees that crowd, not its features. It
also brings a second vocabulary of controls (crouch as stealth, torch as weapon, a whistle item that is
a remote for every room) that no other floor asks for. Since floors stack lessons with depth, the forest
should lean on what the building already teaches (lean, unwatched, do not run) before adding its own.

---

## 2. Lighting and fog

### What is there now

| layer | where | what it does |
|---|---|---|
| Theme tubes and modes | `themes.js` `forest` | pale green-white tubes, 22 to 46% of panels dead, plain rooms dealt `dim` 6 : `normal` 3 : `one` 2 |
| Room light, replaced | `forest-fx.js` `woodlandDynamicLight`, called by all fifteen rooms | throws out the theme's ceiling. Ambient set to about 5% (`[0.052, 0.074, 0.046]`). 9 to 16 panels, 24 to 52% dead, live ones chartreuse with one amber. Each live panel is a tight downward cone (floor leak 0.14) |
| Four banks that move | `forest.rule.js` `stepCanopyBanks`, every frame | each bank's level swings between about half and full on its own slow sine ("wind-swayed"), bank 1 dips to a quarter every 19 s, the `islands` mode holds one bank at 11%. The whole baked room breathes, all the time |
| Accent lights | each room, bank 3 | a lantern, a fire, green monitors under water. These pulse too |
| Light shafts and pollen | `addLightShafts` | additive slanted quads under up to five live panels, and drifting dots |
| Mist veils | `forest-maze.js` `addMistVeils`, in thirteen rooms | flat upright cards 2.5 m high across a lane, one fixed colour, a moving blotch pattern, fading out as you come within 2.8 m |
| Smoke | `burn-scar` only | 150 billboards with a 64-pixel blob, and a flat sheet for the underside |
| Fake shadows | `castCanopyShadow`, `c.blot` | dark patches painted on the floor round trunks |
| Grade | `themes.js`, added by the lead | gentle cool green, haze colour `[0.74, 0.88, 0.72]` |
| Medium and High | the builder's pipeline | distance haze toward the theme's colour, glow on what shines, shadows from tubes |

### What is wrong with it

1. **The light never holds still.** Every set room pulses on a ten-second swell. Fluorescent tubes do
   not do this and neither does a forest. It reads as a fault in the picture, it hides the flicker of the
   one tube that is meant to be failing, and it removes the stillness the place depends on. I think this
   is most of "the lighting needs work".
2. **Green light on green things.** A chartreuse tube on a green wall has no shape. The plain rooms,
   which keep the theme's whiter tubes at full, look better than any set room for this reason alone.
3. **The mist is cards.** The veils are single rectangles with straight edges. In a dark room they are
   brighter than what is behind them and stand in the lane as pale blue-grey panels; in a lit room they
   are darker than what is behind and their pattern breaks into dark blotches. They vanish as you walk
   up to them. Two crossing a lane at once is common. They are the most artificial thing on the floor.
4. **The shafts are not light.** They are drawn under panels whether or not anything is in the air, they
   do not fall on anything, and they pulse with the banks. Through the camcorder they add to the grey.
5. **High washes it out.** At Medium and High the haze fades everything past a few metres toward pale
   green. These rooms are dark by design, so the haze lifts the blacks and the room goes milky: compare
   `tree-farm` at Classic (black aisles, hard green bags) with High (grey-green fog, bags as soft blobs).
   With the full camcorder the grain on dark green is heavy enough that the first view of `tree-farm`,
   `hollow-tree` and `campfire-circle` is mostly noise.
6. **What glows is too strong at High.** The drip bags, the fibre veins on trunks, the mushrooms and the
   items lying about all bloom to round blobs. In `tree-farm` the bags are the brightest thing in the
   room and say nothing.
7. **The dim rooms are not dim, and the dark rooms are only murky.** `old-growth` is called a cathedral
   and a dark labyrinth; in the picture it is evenly lit beige and green like its neighbours.
   `nursery-aisles` the same. Only `tree-farm`, `campfire-circle` and `burn-scar` are actually dark.
8. **The burn's smoke** is the best idea on the floor and its weakest picture: big blurred squares of
   grey, clearly squares. Crouched, the flat underside works. Standing, it is a pile of cards.

### Room by room, in a line

| room | now | wants |
|---|---|---|
| plain rooms | bright, even, readable | keep. A third of them one tube only, as the theme already deals |
| trailhead | flat green, no focus | full office white. The booth's own lamp the only warm thing |
| blaze-junction | even, with veils | one pool over the cairn, the posts in half light |
| campfire-circle | dark with a fire: right | keep the fire's flicker, hold the ceiling still, drop the veils |
| hollow-tree | dark with an orange mouth: right | keep. Nothing else lit within five metres of the trunk |
| burn-scar | dim amber, smoke cards | see proposal 7 |
| tree-farm | very dark, green blobs | one working tube per aisle end, bags at half strength |
| bog-boardwalk | good: black water, green screens | the boardwalk is too bright and flat. Dim it. Drop the four veils |
| old-growth | even | the darkest room on the floor: two live panels of sixteen |
| nursery-aisles | even | archive light: cold white, half dead, long shadows down the stacks |
| inverted-grove | even, cyan dots | light from below only (the pool), ceiling off |
| windthrow, fire-lookout, canopy-walk, timber-lot | even green | office white, half dead, no veils |
| clear-cut | bright on the clay: right | keep. The remnant wood behind the tape two stops darker than now |

### Proposals, ranked by effect for effort

The first four are numbers in Gemini's own files. The rest are for the builder session to judge; I have
not changed or tried any of them.

1. **Hold the ceiling still.** `stepCanopyBanks` already has a `steady` branch for accessibility. Make
   that the only behaviour for banks 0 to 2, and keep movement for bank 3 where it is a fire or a
   screen. One function. Largest single gain.
2. **Remove the mist veils and the shafts,** or keep one shaft in two rooms that earn it (`old-growth`,
   `hollow-tree`). Thirteen rooms get cleaner at once and lose a draw call each.
3. **White tubes, not green.** Use the theme's own tubes (or office white `#fffbe9`) in
   `woodlandDynamicLight`, keep the single amber bay. Green things then read as green because the light
   is not.
4. **Three recipes, chosen per room, not one.** Office (all on), half dead (pools), dark (the room lights
   itself). The table above assigns them. Today the `mode` names differ and the pictures do not.
5. **For the builder: a haze strength per theme.** The forest wants about half the yellow floor's haze
   and a neutral colour (grey, not green), or haze that starts further out. This is the fix for "fog"
   at Medium and High.
6. **For the builder: let trunks cast in the tube-shadow map at Medium and High.** Sixty trunks under
   four live panels would give long shadows across the moss, which is the one thing that says forest
   and is not there. The painted blots could then go at those tiers.
7. **For the builder: a height band of haze a room can ask for** (a floor and a ceiling for it, a colour,
   a density). The burn's smoke layer is exactly this, and so are bog mist and pool steam. It would
   replace 150 billboards with something that is actually under or over your eye.
8. **Turn down what shines** on this floor at the tiers that bloom: bags, fibre veins and mushrooms to
   about 60%, through the per-batch bloom strength the builder has said is coming.
9. **Grade.** Once the tubes are white, drop the green in the grade's gain and let the moss carry it.

---

## 3. Room by room

Cost is from `&check=1` and my own count over seeds 3, 7 and 11: ordinary triangles + triangles in
meshes marked `userData.detail`. Every ordinary room lands between 102,000 and 115,000 ordinary and
100,000 and 127,000 detail, because the thicket plants until it reaches the cap. The four `big` rooms
land at about 230,000 + 240,000. So cost says nothing about a room except that it is full; I give it
once per room and discuss it in section 7.

**trailhead (The Visitor Kiosk).** A ranger booth under the ceiling, a turnstile, a relief table with a
brass needle. *Works:* the needle really swings to the way out, a quiet and useful secret; the Trail
Call lies on the counter. *Does not:* the sign says `TAKE TRAIL CALL AT BOOTH / SPIN DIAL FOR EXIT
BEARING`, which gives both away. From the door you see painted partitions, not the booth. The room is
called a trailhead and is dealt anywhere on the floor. 103k + 122k. **Fix:** take the two instruction
lines off the sign, clear the partitions between door and booth, cut the hills.

**timber-lot (The Coat-Rack Stand).** Big. A peat channel, cordwood stacks, and the stag standing as a
coat-rack among two real coat-racks. *Works:* the stag is the floor's best creature. A coat-rack that
unfolds, 0.85 s of hoof scrape, a straight charge at 5.7 m/s, antlers that wedge in a trunk for 3.4 s
if you sidestep. One rule, a tell, a counter you find by using the room. *Does not:* it takes two
hearts (half of everything; all of it on Hard), which a room's resident should not. Standing in its
space I was dead in two hits, the second after its cooldown, with no sign it had reset. It also wakes
to a torch beam and to bracken and to running, which is three rules. The sign lists them. A decoy
bell, the whistle and two trunks to fell are in the same room. 234k + 235k. **Fix:** one heart; one
trigger (come within reach of the rack, or run); remove the bell; keep one felled-trunk bridge; sign
down to `CLEAR-CUT CLOAKROOM`.

**canopy-walk (The Rope Walk).** Big. Two decks at 1.8 m, a ramp, a drawbridge, three paper cocoons on
the ceiling. *Works:* the cocoons are a good shape and the height is welcome. The ramp and decks are
sound: I could not walk onto a deck from the ground or off its edge. *Does not:* a cocoon over the west
deck bit me while I walked the deck, which is the only way to the reward. The drawbridge comes down from
a winch on the ground that is nowhere near it and looks like a post. The lead measured this room at
468,000 triangles. **Rework:** make the bridge always down or worked from the deck, move the third
cocoon off the path, and decide whether this is a climbing room or an ambush room.

**blaze-junction (The Trail Loop).** Five posts with arrows that turn while unwatched, stumps with
rings to count, a cairn with a bell, a locked cache. *Works:* counting rings on a stump is a lovely
small act, and arrows that disagree is already this building's language. *Does not:* the cache is not
locked. Its snack and battery lie beside it and I picked them up without touching a post (the builder's
own comment in the file notices this and leaves it). The sign gives the answer's form, the trick and the
second clue (`TRUE STUMP = 4 RINGS / DECOY ARROWS TURN UNSEEN / SOUND CALL FOR ECHO`). A wrong latch
costs 12% of the battery (37 s when I tried it); the right one gives 28 s. So solving it earns less than
one wrong guess costs, and nothing but that. **Fix:** put the items inside the box and open the lid for
them; the sign says only `4`, burned into the cairn; a wrong latch buzzes and costs nothing.

**campfire-circle (Mandatory Offsite).** A cellophane fire, log benches, tents, and the Retreat
Facilitator holding out a skewer. *Works:* the best character on the floor. The grin, the lanyard, the
head that turns right round when your back does. Lit by the fire at High it is the floor's best frame.
Taking the skewer healed one heart, twice and no more, so it cannot be farmed. *Does not:* the sign is
the whole rule and the reward with a key on it. Two free hearts for pressing E, at no risk if you face
her, is the cheapest healing in the building (a snack is one heart and there is at most one a part).
**Fix:** one ration; the sign says only `MANDATORY CAMPFIRE`. Let people find out about backs.

**bog-boardwalk (The Fen).** A boardwalk in a cross over black water, drowned workstations glowing
green, loose boards that sink. *Works:* reads from the door, a clear picture, the water is good at every
tier. Wading is slow and sinks the eye, which is enough of a hazard. *Does not:* the reed walls are
green striped pillars and look like bamboo; four veils; a badger. The loose boards dip a few
centimetres and I could not tell they were a hazard. 111k + 120k. **Keep,** thinned: no reed walls, no
veils, boards that visibly go under.

**fire-lookout (The Fire Tower).** A timber tower whose cab is crushed into the ceiling. *Works:* the
image, and the climb (the stairs work; I could not get under the cab from the ground). *Does not:* the
fire-finder turns a quarter and dings and that is all it will ever do; `ROOF CLEARANCE: 0.00 M` is a
good line and the other is an instruction. From up there you look at ceiling tiles. **Fix:** either the
finder does nothing and cannot be used, or it does one real thing: sweeps the room's one working light
to where it points. Cut a window in the hedge so the cab looks down on something.

**hollow-tree (The Windfall Shaft).** A trunk three metres across through floor and ceiling with a lit
hollow, and an owl that turns its head to you. *Works:* the strongest doorway view on the floor, and it
is a real way down: on a two-part visit E took me in a spiral, the picture went to static, and I landed
in the next part. *Does not:* on the last part of a visit it only knocks. While the part below is still
building, the visitor is held in static (about twenty seconds on this machine; not measured on a real
one). It needs E, where the owner's rule for ways down is that no key is pressed. The sign says
`AUTHORIZED ROOT DESCENT [E]`. **Keep.** Walk in to go down, as the fire door's bar is walked into.
Never deal it on a last part.

**burn-scar (The Burn).** Ash, charred snags, a smoke layer, drill posters, an EXIT that points at a
tree, and a Fire Marshal with a smoke detector for a face. *Works:* this is the best-designed room
here and reads as written by a different hand. One rule, said by the room's own posters in the room's
own voice (`STAY LOW AND GO` is what such a poster says; it is not a control hint). Standing in smoke
costs battery, never a heart; the Marshal walked most of a round before it noticed me, chirped, came,
sprayed once for a heart and stood down. Crouched, the smoke is a ceiling you can see under. *Does not:* the
smoke cards (section 2). The trail board by the door repeats the poster. **Keep.** It is the model for
the rest.

**clear-cut (The Development).** Big. Half the room scraped to clay, two developers on stumps, a
billboard, a bulldozer on a lane, animals behind tape. *Works:* the only room with something to say,
and a full picture from inside. `0% TREES` is the dry line the building wants. *Does not:* the pushing
collider (top of this document). The shut-off is on the back of a moving machine and its E mark shows
through the body from the front. Stopping it makes the animals hop, which is a reward from another
game. 229k + 239k. **Fix:** no collider; the blade knocks you back once through `c.hurt`'s own throw
and the machine stops for a moment. One animal.

**old-growth (The Cathedral Stand).** Big. Sixty-odd trunks, a spring, lanyard wind chimes, the Timber
Auditor. *Works:* chimes you brush with your head that call something is a good tell. *Does not:* the
Auditor's rule is the mascot's (moves only while unwatched) with a torch clause, so the floor's own
deepest creature teaches nothing new. Not a cathedral: the same baffles, lit the same. I did not meet
the Auditor in play. **Rework:** drop the baffles, make it the one room of nothing but trunks to the
walls in near dark, and give the Auditor a rule of its own or leave the room empty, which would be
worse for the visitor in the right way.

**tree-farm (The Barcode Plantation).** Spruces on a grid, each with a tag and a drip bag. The owner's
mystery room: section 4. **Fix** as written there.

**windthrow (The Blowdown Tangle).** Root plates of carpet and screed torn upright, a flooded pit,
leaning trunks to duck under. *Works:* a root plate made of carpet tile is exactly the floor's idea.
*Does not:* you cannot see them for the hedges and cordwood. The sign tells you to duck and to lean.
I did not fell the pine. **Keep,** opened up: this is a place, it needs no mechanic.

**nursery-aisles (The Sapling Archive).** Rusted shelving with white birch poles growing through it;
six poles have amber eyes that follow you. *Works:* birch through filing is good, and an eye in bark
that shuts when lit is a good small horror. *Does not:* I stood upright for eight seconds 1.45 m from where the room
puts an eyed pole and nothing happened and no charge was taken. I may not have been beside a live one,
so the hazard is not confirmed either way.
The sign names the key and the counter. Crouch here is read from the C key directly. **Fix:** eyes
that only watch. No drain. They are worse if they do nothing.

**inverted-grove (The Ceiling Coppice).** Trees hanging crown-down from the ceiling over a pool, a
desk bolted to the ceiling, a cord. *Works:* crowns at head height you must stoop under. *Does not:*
the cord creaks, ripples the pool, and silently adds fifteen seconds of battery once. The desk on the
ceiling is the image and cannot be seen from the pool's edge without looking straight up. A flood fill
at the mascot's width (0.26 m) found 13 m² of its floor on seed 11 joined to nothing else. **Fix:** no cord.
The pool shows the desk (a painted reflection at Classic is enough).

**Plain rooms and the thicket motif.** Covered in section 1. Median 17,000 to 21,000 ordinary and
28,000 detail triangles a room, the largest 73,000 + 85,000; an office plain room is a few thousand.
On seed 11 one plain room was split in two for anything 0.26 m wide (3.3 and 2.9 m²), and one had an
8.6 m² pocket. Their signs include two control hints. **Fix:** a third of the planting, no Spotter,
no oddity roll (keep two or three of the eight as rare finds: the footbridge, the birdhouses, the tent),
signs that are park signs.

**The Trail Call.** Not a room, but nine of them answer it. Holding it, E is live anywhere within 11
to 16 m of a room's centre and fires that room's event: drops the bridge, stops the bulldozer, shuts
the eyes, rings the true post. It is a remote control for the floor and it skips each room's own
discovery. It also means the E mark is lit across whole rooms with nothing in front of you. **Cut,** or
make it do one thing everywhere (a sound that things come to).

**Not checked.** The Auditor and the eye-birches in play. Felling a notched trunk. The dial and the
alidade beyond one press. The loose boards beyond a dip. Medium. A phone. Co-op. Real frame times. How
long the hollow tree holds a visitor on real hardware. Whether anything is stashed in the unreachable
pockets. I read the sign texts in the code; in the picture they are small and about a quarter of the
letters are scrambled, so they half read, which is an instruction card that is also hard to read.

---

## 4. The mystery room

The owner: "confused about some dashed black lines and press E in one room around some lights? Maybe a
puzzle but not clear."

**The room is almost certainly `tree-farm`, The Barcode Plantation.** It is the one room with all three
things. `inverted-grove` is the second candidate and has the same fault.

**The dashed black lines are barcodes.** Every spruce has a white tag at eye height with one black bar
on it (`plantationSpruceVox`: a 13 × 7 cm black box on a cream plaque). On a seven by seven grid of
trunks that is a row of black dashes down every aisle. The cordwood walls in the same room carry three
more per 2.2 m of wall in the texture (`cordwoodStackTex`: a white tag, a black bar), which tile into
diagonal lines of dashes. The designer meant: the office has asset-tagged every tree and every log.
The same mark is on trunks in the plain rooms, and the birch poles everywhere have black bands that
read the same way.

**The lights are drip bags.** Half the spruces wear a glowing green pouch with a tube to the ceiling
("IV sap bags"). At High they bloom into green blobs and are the brightest things in a very dark room.

**The E is the Harvest Irrigation Manifold,** a block in the middle with an orange bar on a brass post.
The file's header says E "flushes the ceiling sap lines, lighting up the green exit-row beacons". What
it does: a glug, a ding, a ripple in two puddles, and fifteen seconds of battery the first time, added
without a sign. Nothing lights. Nothing is an exit-row beacon. And the battery and snack that should be
on the desk are on the floor in front of it (the known fault with items left at a height), so the first
press of E picks up a battery and looks like that was the whole point.

**Why it does not read.** A barcode drawn as one bar is a dash. A dash repeated on a grid looks like a
code. Lights on some trees and not others look like a state. An E prompt at the centre of a grid of
marks and lights looks like the place to enter the answer. All three are decoration that the room
arranged exactly like a puzzle, and the one thing that can be pressed has no visible effect. The room
also has no hazard and no reason to be crossed.

**To make it read, without a caption.** Pick one of two.

- *It is not a puzzle* (my choice: less is more). Remove the E. Draw the tag as a tag: five or six thin
  bars of uneven width and a row of digits, so it is a barcode at a glance. Take the tags off the
  cordwood. Let every tree have a bag, all the same dull colour, and let one be empty with its tree
  brown. Then it is a plantation, and the one dead tree is the room.
- *It is a small one.* The valve is a wheel that looks like a wheel. Turning it visibly sends a pulse of
  light down the ceiling lines to each bag in turn, row by row, and the last row to light is the aisle
  that leads to the way out of the room. The effect travels away from your hand along a pipe you can
  see: that is what makes cause and effect read.

In both, move the room's light off the bags (section 2).

---

## 5. Add-on rooms

The floor has plenty of events. What it lacks is rooms where nothing happens. Six of these eight are
that.

1. **The Trail Register.** A small bare room with a lectern and a sign-in book under one tube. Columns
   for name, party size, time out, time back. The names are the office's agents; nobody has signed
   back in. The last line already has the visitor's name, today, party of one. Nothing can be used.
   5 × 5 m.
2. **The Boot Room.** A corridor of plywood cubbies, a pair of wet walking boots in each, every pair
   toes to the wall. Carpet dark where they dripped. One cubby is empty and has the visitor's
   department on its label. 4 × 10 m.
3. **The Firebreak.** A room of trunks packed to the walls with a strip three metres wide mown straight
   through it down to bare office carpet, taped off both sides, a doorway at each end. The only long
   sightline on the floor. Nothing in it. Whatever is following you can see all of it. 8 × 20 m.
4. **The Picnic Area.** Six picnic tables bolted through the carpet under full office light, each laid
   with paper plates and a name card, all the benches on one side so that everyone faces the same blank
   wall. A flip chart with an agenda, one item ticked. 12 × 12 m.
5. **Leaf Storage.** A stock room of clear sacks stacked to the ceiling, labelled by season and quarter
   (`AUTUMN Q3`, `AUTUMN Q4`), a leaf blower on charge by the door, a narrow way between the stacks.
   One sack has split and the leaves are office paper cut to shape. 6 × 12 m.
6. **The Scenic Overlook.** A railing and a coin telescope facing a wall-sized photograph of a valley,
   printed in panels that do not line up, lit by one tube. Behind the railing the carpet stops at a
   kerb, as if it were an edge. Looking through the telescope shows the same photograph, closer.
   8 × 8 m.
7. **Lights Out** (a set piece). A dark room of twelve tents pitched on carpet, each lit from inside,
   zips half down, all empty. The one you are nearest goes dark, and comes back on when you move away,
   so you cross the room in a moving patch of dark. 14 × 14 m, `lights: 'dark'`.
8. **Scheduled Rain** (a set piece). Sprinklers come on over real carpet for twenty seconds every
   minute, by a timer on the wall that shows the time to the next. Umbrellas in a stand by each door.
   While it rains nothing that hunts by hearing can hear you, and the floor is slick if you run.
   12 × 12 m. This and the Firebreak give the floor's existing creatures something to do.

---

## 6. Entities

### What is there now

None of the forest's creatures is in the cast. All are residents built into one room's file, so none
roams, none is dealt differently from visit to visit, and what walks the forest's corridors is the
office's cast (on my seeds: the mascot, the toner, the porter, the shadow).

| resident | room | its rule | costs |
|---|---|---|---|
| The Coat-Rack Buck | timber-lot | wakes to reach, a torch beam, bracken or running; scrapes, then charges straight | 2 hearts |
| The Retreat Facilitator | campfire-circle | offers a ration; turn your back near her, or run, or stall, and she lunges | 1 heart (gives 2) |
| Manila Bagworm Husks, three | canopy-walk | drop on whoever walks upright beneath | 1 heart |
| The Fire Marshal | burn-scar | sees only a head that is up in the smoke | 1 heart |
| The CRT bulldozer | clear-cut | runs its lane | 1 heart per 2 s |
| The Timber Auditor | old-growth | moves only while unwatched or unlit; comes to a chime | 1 heart |
| Eye-scar birches, six | nursery-aisles | watch; drain an upright visitor nearby | 10% battery |
| The Trail Spotter | a third of plain rooms | flashes whoever is off the gravel and not looking at it | 16% battery |
| owl, badger, fox, fawn, two developers | three rooms | turn to look, or stand | nothing |

Three notes. The Auditor is the mascot's rule again and the Spotter is the shadow's turned round, so
two of eight teach nothing the building has not taught. Room hazards call `c.hurt` with fixed numbers
and take no account of difficulty the way the cast's table does (Tourist is honoured, by the health
system itself: I stood in the bulldozer's lane on Tourist and lost nothing). And four of them read the
C key directly for "crouched" where `burn-scar` reads the eye's real height, which is the right way.

### Six new ones

All for the cast (`cast.js`, `cast/<id>.js` with a pure `cast/<id>.rule.js`, `create(c)` returning
`ready/update/carry/at/dispose`), all `themes: { forest: 1, '*': 0 }`, all hurting only through
`c.hurt`, and each with a rule the building does not have yet.

1. **The Widowmaker** (`widowmaker`, hunts, roams). *Image:* nothing, until a ceiling tile lifts. A
   bundle of dead limbs, cable and tile that travels above the grid. *Rule:* it falls on where you have
   stood still under a missing tile. *Tell:* tiles above you lift and settle one after another as it
   comes over; dust sifts down; a long creak. Under whole ceiling it cannot get at you. *Caught:* 1
   heart. *Shove:* nothing while it is up; once fallen it is a heap that a shove slides clear of a
   doorway. *Lives:* above any room with a ceiling breach, which this floor has by the dozen and which
   mean nothing today.
2. **The Grazers** (`grazers`, keeps to itself, home: room, more than one body). *Image:* five office
   chairs with coat-hooks screwed to their backs, standing in a clearing with their backs bowed to the
   moss. *Rule:* anything sudden stampedes them, in a straight line, through whatever is in it. *Tell:*
   every back turns to face you at once, a castor squeaks, then they go. Walk and they part round you.
   *Caught:* `{ setback: 'run down and left on the floor where you stood' }` (a throw, a moment on the
   ground, no heart). *Shove:* the one you push rolls away and the rest follow it, so a herd can be
   sent down a corridor at something else. *Lives:* a wide plain room; afterwards wherever they stopped.
3. **The Groundskeeper** (`groundskeeper`, keeps to itself, roams). *Image:* a leaf blower on a strap
   with nobody in the strap, working along the gravel. *Rule:* it tidies whatever is off the trail,
   and that includes you. *Tell:* the two-stroke note rises and the ferns between you lie flat in a
   line. Stay on gravel and it passes within a metre. *Caught:* `{ setback: 'blown back to the gravel,
   and what was in your hand is somewhere over there' }` (the visitor is walked there with
   `player.warp`, never pushed by a collider). *Shove:* it goes over and runs on its side in a circle
   for six seconds. *Lives:* any plain room with a trail. It makes the gravel strip in every room mean
   something, which the Spotter tried to do with a camera flash.
4. **The Ranger** (`ranger`, helps, roams). *Image:* a campaign hat at head height and a torch beam
   under it, keys on a belt that is not there, walking its round. *Rule:* stay behind the light and it
   walks you toward the way down; step into its beam and it stops and takes what you are holding as
   evidence. *Tell:* the beam and the keys. It never turns round. *Caught:* `{ setback: 'the thing in
   your hand is confiscated' }`; nothing if your hands are empty. *Shove:* the hat falls, the beam
   swings to the floor, and it stands until the hat is put back by walking into it. *Lives:* the
   corridors; `items: ['torch', 'battery', 'snack']`.
5. **The Bear Bag** (`bear-bag`, hunts, roams). *Image:* lunch bags hung on string from ceiling tiles in
   ordinary rooms, the way a camp hangs its food; and a wheeled bin on its side with the lid working.
   *Rule:* it comes for food, and only for food: a visitor with a snack in a pocket is food. *Tell:*
   every hung bag in the room swings toward where it is, before it is in the room. *Caught:* 1 heart
   and the snack. Put the snack down and walk away and it takes that and goes. *Shove:* it drops what
   it took. *Lives:* roams; `items: ['snack']`, `fire: 'fears'`. It makes the one healing item a
   decision.
6. **The Buddy** (`buddy`, hunts, roams, needs `unwatched`). *Image:* a hi-vis vest and a whistle on a
   lanyard, upright, empty, two rooms behind. *Rule:* it walks exactly where you walked, a few seconds
   late, and stops when you stop; it only has you if you walk back into your own path where it is
   standing. *Tell:* a second set of steps out of time with yours, and the whistle ticking on its
   zip. *Caught:* 1 heart, "paired". *Shove:* sends it back four metres along the path it came by.
   *Lives:* roams. It punishes backtracking in a floor of dead ends, and a loop loses it.

If only two are made: the Widowmaker (it gives the floor's ceiling a purpose) and the Groundskeeper (it
gives the floor's trail one).

---

## 7. Cost

Measured, one-part visits at Classic:

| seed | rooms | plain | ordinary | detail | meshes |
|---|---|---|---|---|---|
| 7 | 26 | 18 | 1,226,000 | 1,392,000 | 500 |
| 3 | 28 | 19 | 1,391,000 | 1,519,000 | 539 |
| 11 | 34 | 25 | 1,659,000 | 1,837,000 | 608 |

An office floor is about 305,000 in all. The forest is eight to eleven times that.

**What is heavy.** Not any one thing. The thicket is written to spend whatever is left: each room
passes it a cap (`ordCap: 112000`, `detCap: 122000`) and it plants until it gets there. That is why
all eleven ordinary rooms cost the same to within a tenth and the big ones sit a few thousand under
their limit. The rooms were built to the budget, not to a picture.

**Whether it earns it.** No. Most of the planting is behind 2.4 m walls or more than four metres away
in rooms designed so that you cannot see four metres. The detail half (ferns, litter, drapes, binders)
is the half you do see, at your feet, and is the better half.

**What could go with no loss.**

- The stepped hills. Tens of thousands of triangles a room, and the look the floor is better without.
- Trees you cannot reach or see: everything behind a baffle, and the outer two metres of every room.
  A third of the trunks would read the same. Fewer, thicker trunks say "forest" better than many poles.
- Full corner shading on trunks. The guide's own note: relief meshed with it costs about ten times the
  triangles. Trunks at `{ ao: false }` with the bake doing the shading would be most of the saving.
- The plain rooms. Twenty of them at 45,000 each is most of the floor. At a third of the planting they
  would still be the forest and the floor would be near a million.
- `canopy-walk`, the one room over its limit.

If the baffles go (section 1) the trees behind them come into view and the budget starts to buy
something.

---

## 8. Five changes first

1. **Take the instructions and the keys off every sign.** Fifteen rooms and the plain-room list. A
   place name and one dry line each. An afternoon, and it is the owner's first rule.
2. **Hold the light still, drop the mist cards and shafts, use white tubes.** Three small edits in
   `forest.rule.js`, `forest-fx.js` and the rooms' `addMistVeils` calls. This is the lighting and fog
   complaint, as far as it can be answered without the builder.
3. **Fix the barcode room.** Remove the E or make it visibly do something, draw the tags as barcodes,
   take them off the cordwood. Do the same to the other two dead uses (`inverted-grove`'s cord,
   `fire-lookout`'s finder) and put `blaze-junction`'s reward inside its box.
4. **Empty the plain rooms and open the set rooms.** No Spotter, no oddity roll, a third of the
   planting, no hills; and take the baffle ring out of every room that has a centrepiece worth seeing
   from the door. This is pacing and cost in one move.
5. **Bring the hazards into line.** The bulldozer stops pushing. The stag takes one heart and has one
   trigger. One ration at the campfire. Cut the Trail Call. Then make the first two of the new cast,
   so that the forest has creatures of its own in its corridors and not only in its rooms.
