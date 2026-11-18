# The waterpark (`waterpark`): an outside review

18 November 2026. A review of the waterpark floor by a session that built none of it. It covers all seventeen
`deck2.js` rooms with `themes: { waterpark: … }` and the floor's plain rooms. Nothing in the game was changed.
It is judged against the owner's standing rules: less is more; no narration, instruction cards or control hints;
words live in the world; mostly mundane rooms with rare features; a confusing, deadly building that people die in
and learn; feature rooms should not be dead ends unless they pay; do not assume the player is dumb; more detail and
items, not less.

**How I looked.** Local build (`tools/blockrooms/build.mjs`, `serve.mjs`) in headless Chromium with software
rendering (SwiftShader). That is not a real GPU: the frame rate is low, and when several pages share the machine,
game time slows down. I kept that out of the results by re-running every room alone. Each claim below says how I
know it:

- **played**: driven with real key presses (W, Shift, E) through the page.
- **loaded**: built and looked at, with the player placed by the debug handle.
- **read**: taken from the code only.

The pictures are in this session's scratchpad and are not committed.

---

## 1. The verdict

1. **Not ready to be dealt to ordinary visits today.** Nothing traps a visitor: every doorway of all seventeen rooms
   reaches every other on the engine's own walk grid (played and loaded). But three rooms break the owner's rules in
   ways a first visitor will hit.
2. **The Towel Return kills a visitor who walks.** Six figures, one heart each, a shared 1.6 s cooldown. Nothing in
   the hand answers them: scissors find no target, and a shove moves nothing (played). Make it survivable before
   dealing.
3. **Five rooms have signs that name keys or state the rule**, and two put a word on the screen (`ADULT SWIM`,
   `SUBMERGED`). Take them off. This is the forest's first fix again.
4. **The floor is two places.** Five older rooms and every plain room are bright aqua with neon caustics at Classic.
   The newer rooms are pale ivory, murky and good. Pick the second and bring the plain rooms to it; the older five
   can follow.
5. **Then deal it, at a low weight, single-player only**, and keep the Return Pool's valve and the pushing water as
   the owner's two decisions (sections 3 and 4).

**Found on the way, already fixed by the lead:** on a repeat load, 3 of 10 pages never started (`Failed to resolve
module specifier "three"`). `page.html` put the preload links above the import map. That is site-wide, not the
waterpark's. It is fixed on `blockrooms-live` (`page.html` now has the import map first). I reproduced it in
headless Chromium only.

---

## 2. The floor as a whole

**What it is.** An office whose pool was described to whoever built it: tile up the walls, an acoustic ceiling over
the water, damp carpet borders, rules signs that half make sense.

**Mostly mundane, features rare: yes, now.** On six fixed tapes (3, 7, 11, 19, 23, 31; first part only, loaded), a
waterpark floor is 21 to 27 rooms. Only 2 to 5 of them are feature rooms, counting the three-room flume connector
set as three. Plain rooms are 17 to 25 of each floor. None of the feature rooms on those six floors was a dead end;
each had two to four doorways. Asking for a room with `room=` places it next to the start and can make it a dead
end. That is how I first saw the Lane Archive, Hanging Changing Rooms, Drain Spa and Toadstool Lagoon with one door,
and it is not what an ordinary visit deals.

**Does it hang together: not yet.** There are two looks, and they read as two building teams.

- **The newer rooms** (Codex's: Lane Archive, Narrowing Bays, Hanging Changing Rooms, Bellmouth Baths, Return
  Pool, the Other Changing Room, Return Tubes, Flooded Office, Towel Return, Diving Tower) use ivory and bottle-green
  tile, real fittings, dark water and few things at once. They are the floor's best pictures. The Bellmouth from its
  door, the Other Changing Room's boardwalk and the Flooded Office are as good as anything in the building.
- **The older rooms** (Surge Basin, Lazy Loop, Diving Well, Drain Spa, Toadstool Lagoon) and **every plain room**
  are bright: cyan and white tile, all lights on, and at Classic a water texture of white-webbed aqua cells that
  glows. The Drain Spa has a cyan and a magenta flume, rings, hanging loungers and a mural in one 13 m room. The
  Lagoon is a toy: candy floats and a red spotted mushroom. Each is lively on its own. Next to the Bellmouth they
  are another game.

**Plain rooms of its own: enough in number, one-note in look.** I loaded eight plain rooms on tape 7. They are
blue-white tiled boxes with an aqua floor and every tube lit. They read cleanly and are rightly empty: median
4,000 triangles, no skimmer on any of six floors. But they are all the same box. The art audit's "replace the
universal blue skin" (15 November) has not been done, and it is the single change that would make the floor one
place. The `quiet.js` waterpark motifs (cabanas, colonnade, bays, dogleg) help. The skin is what you see.

**How it feels to cross.** The rooms that work make you choose between a dry long way and a wet short way: the
Lane Archive's banks against its lane, Hanging Changing Rooms' shelves against its channels. That is the floor's own
idea and it is good. Water slows you everywhere (to 0.66–0.78 of walking pace), so wading is a cost you can feel
without being told. The rooms that do not work stop you with a puzzle or a sign.

**Who else is down here.** The office's roaming cast is dealt onto waterpark floors like anywhere else: no cast
entry sets `waterpark: 0` (read). On tape 7 the mascot stood in a plain tiled room and a toner hung from its
ceiling (loaded). They do not look out of place. It also means the floor has no roaming creature of its own;
everything waterpark-specific lives in one room.

---

## 3. Room by room

Doorways: every room below was checked by flooding the engine's own walk grid (`world.walkable`) from each
doorway. Every doorway reached every other, in every room, and no load logged "a doorway … could not be reached"
(loaded, about forty loads). "Walked" means my key-press walker crossed it from the entrance.

Cost is ordinary triangles + detail triangles, meshes (+ detail), lights, from the instance I loaded (section 6).

**channel-hall: The Lane Archive.** Walked: entrance to back door straight down the lane, and to the island.
*Works:* the hall is a real place: stacked shuttered offices, a coral flume through an office doorway, a dark lane,
a glass office beside it. The Lane Keeper is fair. Wading down the middle cost me one heart on the way to the back
door and one more on the way to the island. By its rule the dry banks are safe; I did not walk them. Its pump has a
handle that moves and a visible outlet that bubbles (read). *Does not:* the upper galleries and the diagonal stair are scenery you
can never reach, and from the floor they look reachable (the art audit's own rule 4). It leaves nothing of its own;
the plinth holds a coin only when loot is on. *Words:* none needed. 117k + 3k, 40 (+1) meshes, 11 lights.
**Keep.**

**nested-thresholds: The Narrowing Bays.** Walked, both ways, no damage. *Works:* exactly the quiet connector the
floor needs. Four frames shrink down one sightline, the last forces a stoop, and a side passage gives a standing
way round. *Does not:* nothing. 11k + 1k. **Keep. Deal it more.**

**flume-connector: Return Tubes** (with **office-beach-day** and **flooded-cubicles**). All three crossed (walked
to each door; loaded inside the tube). *Works:* the Flooded Office is the best plain-feeling room on the floor:
desks standing in 20 cm of water, one live troffer, a flume mouth behind the partition. Office Beach Day's ride
down from the tube needs no key: you walk off the lip (read; I did not ride it). *Does not:* inside the tubes the
walk strip is a flat ribbon with white bars across it, so the floor of the tube reads as a road. The tube bore is
113,000 triangles in six meshes for a 10 × 12 m crawl (one voxel model): the most expensive triangles per square
metre on the floor, for a place you are in for ten seconds. 113k / 7k / 36k. **Keep;** see cost.

**smiler-maze → dive-tower: The Towel Return and The Diving Tower.** Played twice with real keys.
*Works:* the idea is strong. A tiled maze of towel bins, the lights drop when you are two metres in, six grinning
swimmers come out behind you, and the way out is to throw yourself off a diving tower into a pool fifteen metres
down. The dive works: I fell from the top board to the water and the chase ended there.
*Does not:*

- **Walking, I died.** At walking pace along the maze's one route, the pack closed from 3 m to touching in the last
  corridor and took all four hearts at the door to the tower.
- **Running, I got through the maze untouched,** but on the boards the pack hops down after you, board by board.
  Moving in short bursts, I lost three hearts before the plunge.
- **Nothing answers them.** They are not denizens, so scissors find nothing, and a shove only reaches the cast. A
  first visitor walks in, is told nothing, and dies. "Roguelite" covers that once.
- They record encounters as `pit-clerks`, the cubicle grid's resident. This room has no `resident` line, so no wall
  drawing warns of them, and if one ever did it would be the cubicle grid's (`KEEP ON THE WALL TOPS`) (read).

There is also a row of black dashes along the far deck edge in the tower, at every graphics setting (loaded). It
looks like a fault. 7k (maze) / 41k (tower), 15 lights in the tower. **Keep, retune** (section 8).

**hanging-changing: Hanging Changing Rooms.** Walked to the back door, no damage. *Works:* tiled slabs hang above
shallow channels and you go round or under. *Does not:* from the entrance the first thing you see is the underside
of a slab three metres away; the view that explains the room comes later. Nothing to find. 46k + 6k. **Keep.**

**bellmouth-baths: Bellmouth Baths.** Walked to the bottom of the bowl. *Works:* the strongest doorway picture on
the floor: an ordinary door onto a giant tiled drain, a crescent gallery, black water in the throat. Medium and High
make the water darker and better. *Does not:* nothing broken. It holds nothing, and it is a big room (26 × 28 m),
so on a floor where it ends up a dead end it costs a walk for a look. 32k + 2k. **Keep.**

**return-pool: The Return Pool.** Played: valve, fold and wake. *Works:* the fold is a good rule. Walk for the far
door down the side lane and the tape skips you back to the near end of the lane, carrying on as you were. I
did it and it reads. The valve has a wheel, three lamps and water that runs the other way once it is done (read).
*Does not:* the valve stands in the water, and being in the water wakes something after about a second. I turned
the wheel once; the wake hit me, the knock-back threw me out of the wheel's reach, and my next two presses did
nothing. The fold sent me back again and I lost a second heart without opening it. It is a press-E gate with a
creature on the button. Whether the far door is the only way on depends on the floor; when it is, the wheel is
compulsory. 45k + 10k, 40 (+1) meshes, 13 lights. **Keep, soften:** the wake keeps off whoever is at the wheel, or
one turn is enough.

**locker-showers: The Other Changing Room.** Walked to the side door and the centre, no damage. *Works:* the best
interior on the floor. Pink tile, a zigzag boardwalk over 32 cm of water, a wall of lockers, an upside-down shower
overhead. *Did not check:* the locker fold and the two figures under the showers, beyond loading the room. 116k,
28 meshes, 15 lights (one short of the limit). **Keep.**

**slide-maze: The Flume Knot.** Walked to the side door. Loaded the galleries. *Works:* the upward flume and the
coloured tubes are the floor's one big set piece, and they look built, not drawn. *Does not:* four things want E:
two one-way slides, the lower-hall slide that goes down a part, and the sump hatch. All are labelled only in code;
the camcorder shows a bare E (read). The sign reads `ONE BATHER AT A TIME / WAIT UNTIL WATER CLEARS / DO NOT RETURN
FOR LOST PROPERTY`, a pool's own voice, which is right. The tube toners repeat the cast's toner rule inside one
room (read). 66k + 16k. **Keep.** I did not ride the slides.

**wave-pool: The Surge Basin.** Walked to the centre; stood in the water for twenty seconds. *Works:* the room
reads from the door: a sloping tiled beach, dark grates, two piers. A surge moved me about a metre and cost no
heart; the battery went down while I stood there. *Does not:* the sign reads `DIVE UNDER [C] OR USE PIER`. At
Classic the water is the glowing aqua grid. The crest is a flat green band. The surge pushes you by your own
velocity (`me.world.vx`); `BACKROOMS.md` says nothing pushes the visitor (section 4). My walker stopped short of
both side doorways, at the jamb; the grid says they are open and the picture shows them open (loaded). 25k + 16k.
**Keep, take the key off the sign.**

**lazy-river: The Lazy Loop.** Walked across and to the island; played the Guard-Stand. *Works:* a lifeguard chair
that is a lifeguard. It sat, whistled, scanned, surged and went home; walking to the island through the canal cost
one heart. The scissors made it recoil (`snip → ok, mode recoil`). *Does not:* the sign reads `SUBMERGE [C] IN
CANAL`. While it is awake the camcorder shows `ADULT SWIM` in its corner (`hud.flag`). That is a caption, even
though a mesh in the room says it too. The current pushes you round the canal. A shove does nothing to it.
91k + 10k. **Keep, take the words off.**

**deep-end: The Diving Well.** Walked to the partition. *Works:* an office partition that stops under the water is
a fine image, and the dive under it is real (read; the room's tests cover it). The torch on the far deck is a reward
you can see. *Does not:* the partition faces the door and carries a board reading `DIVING WELL CLEARANCE / HOLD [C]
TO DIVE UNDER WALL / SPACE TO SURFACE`. A second sign says `HOLD [C] TO DIVE DEEP`. That is the whole room, told.
The dry deck goes round, so the dive is optional. Good, but with the board on it nobody discovers it. 15k + 13k.
**Keep, remove both boards.**

**whirlpool-flume: The Drain Spa.** Walked to the side door and the centre; pressed E at the drain. *Works:* the
battery on the submerged bench is a real reason to wade in. *Does not:* too much in one room: two translucent
flumes (one cyan, one magenta), hanging loungers and an umbrella, a ring tower, a mural reading `CENTRIFUGAL FLESH
JACUZZI / ROTATE IN BROTH UNTIL BONELESS`. The art audit's "cut to one anomaly" has not been done. The sign says
`VALVE REVERSES VORTEX SPIN`. The drain is a way down only when the visit's way down allows it, and only with E.
On my visit it was not offered: E did nothing, and the vortex carried me round the drain for a minute. The
underwater view from the spa's centre shows bright cyan slabs overhead. 91k + 7k. **Rework:** one anomaly; the
drain walked into, not pressed.

**kiddie-lagoon: The Toadstool Lagoon.** Played. *Works:* walking past the floats is safe, hurrying past them cost
two hearts. That is a rule you learn by doing it, and the sign (`WALK SLOWLY IN BASIN`) is a pool's own rule, which
is fine. The legs in the rings read at once. *Does not:* candy colours and the mushroom are a cartoon beside the
rest of the floor. Scissors find no target. The "richer snip rules" the art audit asked to wire are still not
wired. Three sheets of paper. 79k + 8k, 39 (+1) meshes. **Keep,** quieter colours.

### Where the earlier reviews are out of date

- `BACKROOMS-WATERPARK-REVIEW.md` (integration): it describes an eight-room deck and a `waterstudy` dev URL. The
  deck is seventeen rooms, `locker-showers` has been replaced, and the review URLs are the dev page's, not `/play`.
  Its "keep `dealt: false`; single-player only" still holds.
- `-ART-AUDIT.md`: done since: Flume Knot shells, Surge Basin's crest, the Other Changing Room, Bellmouth, Hanging
  Changing Rooms, Nested Thresholds. Not done: the plain rooms' blue skin; the Drain Spa's one anomaly; the Lagoon's
  snip rules. Release bar items 4 to 7 (sound, creature integration, co-op, frame time) are all still open.
- `-DETAIL-REVIEW.md`: "the current bright caustics are the older renderer; reassess when the new work lands". It
  has landed, at Medium and High only. Classic, the default, still shows the old bright caustics.
  Its four failing Return Pool cart tests now pass: `npm test` is 1,358 of 1,358 on `1a0271c`.
- `-CHANNEL-REVIEW.md`: "the pending water renderer is not introduced". It now is. "The Lane Keeper is not in the
  shared creature conductor" is still true, and it is not in the new health tiers either.
- `-SHOWER-REVIEW.md`: the reflection pass's cost on a phone or integrated GPU is still unmeasured.

---

## 4. Creatures of the waterpark

None of the waterpark's creatures is in the cast or in `cast/health.rule.js`'s tiers. All are built into one room.
A shove (`shove.rule.js`) reaches only the cast, so **no waterpark creature answers a shove** (played on the Lane
Keeper, Guard-Stand and pack; read for the rest).

| creature | room | rule | costs | fair way through | scissors | how I know |
|---|---|---|---|---|---|---|
| Lane Keeper | Lane Archive | wading draws it; still for 1.6 s, or dry, and it settles; the pump lures it | 1 heart, 2.8 s recovery | yes: dry banks | no target | played |
| Guard-Stand | Lazy Loop | chair for ~6 s, whistles, scans; moving in its sight or running wakes a surge (2.7 m/s) | 1 heart | yes: still, or under the water | recoils 2.1 s | played |
| the pack (`pit-clerks` id) | Towel Return → Diving Tower | six follow you from the maze to the boards; the pool ends it | 1 heart per contact, 1.6 s shared cooldown | only by running, and the boards still cost | no target | played |
| the wake | Return Pool | being in the water wakes it after ~1 s; hunts for 7 s at 1.7 m/s | 1 heart, knock-back | stay dry, but the valve is in the water | no | played |
| occupied floats | Toadstool Lagoon | hurrying past one (over 2.25 m/s) | 1 heart each | yes: walk | no target | played |
| surge | Surge Basin | a wave every cycle, after a horn | battery, a push | yes: piers, or under | — | played (push), read (rest) |
| tube toners | Flume Knot | the cast toner's rule, inside the tubes | 1 heart | yes: crawl slowly | recoils | read |
| pool skimmer | plain-room footbaths | ripples draw it | 1 heart | yes: dry | no | read; none dealt on six floors |
| figures in the showers | Other Changing Room | sway, turn their heads | nothing | — | — | read |

**Deadly:** the pack is. Everything else takes one heart and stands down, which matches the guide's line that a
room's own resident sets you back and the hunters end visits.

**Fair:** all but the pack and the Return Pool's wake have a tell and a counter you can find by being there. The
pack has a tell (the lights drop, a rattle) and only one counter, which costs hearts anyway. The wake punishes
doing the one thing the room asks of you.

**One rule four times.** The Lane Keeper, the wake, the floats and the skimmer all mean "do not move in the
water". The Guard-Stand adds "do not move in its sight", which is the mascot's family. Every creature on the floor
is about stillness. A floor needs at least one that asks for something else (section 7).

**Pushing water.** The surge, the vortex and the river current all add to the visitor's own velocity. Water that
moves you is natural, and none of them trapped me. But it is the thing the guide forbids, and it is the owner's
call whether water is the exception.

---

## 5. Looks: Classic, Medium, High

I took every room at each setting from the doorway and from its middle, about a hundred pictures (loaded). It was
software rendering, so this judges the picture, not the frame rate.

- **Classic is two floors.** The newer rooms look right at Classic; their water is dark and flat. The older five
  and every plain-room footbath show the glowing aqua cell texture with white webbing (`causticWaterTex`). At
  Classic it is the brightest thing in those rooms and reads as a swimming-pool emoji. This is the default most
  people will see.
- **Medium and High: water is better.** Water becomes a surface with depth and a faint reflection; the Bellmouth's
  throat and the Return Pool go properly dark. In the older rooms the aqua cells soften into a plausible pool. I
  saw little difference between Medium and High in these rooms.
- **Milky:** looking up from under the water (Diving Well, Drain Spa), the surface is a stack of opaque cyan slabs.
  The Diving Well's submerged steps glow pale at Medium and High.
- **Black:** the row of black dashes along the Diving Tower's far deck edge, at all three settings. A rail base
  strip or a shadow seam, by the look of it; I did not trace it.
- **Lights as flat squares.** My pictures predate `984ec10`, which moved the five older rooms' ceiling panels
  (`natatoriumLight`) onto `c.fitting`: the flat panel at Classic and Low, the sculpted fitting at Medium and High
  (read; not re-photographed). The squares still without a fitting are the Diving Tower's pool-floor lamps, the
  Towel Return's way lights (glowing rectangles on the wall at shin height) and the Flooded Office's single troffer.
  The newer rooms already hang a steel housing over each tube, and the Return Pool's pendant tubes are the best
  fitting on the floor.
- **Glow.** Nothing on this floor blooms badly at High; the forest's problem is not here.

---

## 6. Cost

Per room, from the instance I loaded at Classic. Budget: 120,000 ordinary / 250,000 with detail, 45 meshes + 12
detail, 16 lights.

| room | size | ordinary | detail | meshes | lights |
|---|---|---|---|---|---|
| channel-hall | 18 × 27 | 117,268 | 3,276 | 40 + 1 | 11 |
| locker-showers | 18 × 27 | 116,044 | 0 | 28 | 15 |
| flume-connector | 10 × 12 | 113,116 | 0 | 6 | 4 |
| whirlpool-flume | 13 × 14 | 91,308 | 7,356 | 34 + 1 | 11 |
| lazy-river | 17 × 17 | 90,848 | 10,152 | 26 + 1 | 10 |
| kiddie-lagoon | 14 × 14 | 78,644 | 8,124 | 39 + 1 | 10 |
| slide-maze | 17 × 17 | 65,620 | 15,984 | 26 + 1 | 10 |
| hanging-changing | 20 × 26 | 46,320 | 5,904 | 13 + 1 | 14 |
| return-pool | 15 × 23 | 44,612 | 9,864 | 40 + 1 | 13 |
| dive-tower | 18 × 26 | 40,544 | 0 | 14 | 15 |
| office-beach-day | 12 × 10 | 35,546 | 288 | 22 + 1 | 7 |
| bellmouth-baths | 26 × 28 | 32,212 | 1,536 | 13 + 1 | 14 |
| wave-pool | 16 × 20 | 25,366 | 15,500 | 24 + 1 | 9 |
| deep-end | 12 × 16 | 14,834 | 13,420 | 22 + 1 | 13 |
| nested-thresholds | 10 × 20 | 10,756 | 1,004 | 9 + 1 | 6 |
| flooded-cubicles | 12 × 8 | 7,318 | 0 | 14 | 4 |
| smiler-maze | 12 × 16 | 6,794 | 0 | 7 | 13 |

Every room is inside every limit. The closest are the Lane Archive and the Other Changing Room at 97% of
ordinary triangles, the Return Pool and the Lane Archive at 40 meshes, and the Other Changing Room and Diving Tower
at 15 lights. Whole floors on the six tapes ran 135,000 to 582,000 triangles in 280 to 316 meshes. An office floor
is about 305,000; the forest ran 1.2 to 1.7 million. The waterpark is not a cost problem.

**Value for money.** The one poor buy is Return Tubes: 113,000 triangles for a ten-second crawl, all in one voxel
bore. The Bellmouth, by contrast, makes the floor's best picture for 32,000. The Other Changing Room's reflection
pass is outside these counts and is still unmeasured on a real GPU.

---

## 7. Add-on rooms and creatures

The floor needs quiet rooms in the newer look more than it needs set pieces. Six of the eight are that. Ranked.

1. **The Spectators' Gallery.** *See:* you come in on the top row of tiered benches above a drained pool; one
   office chair stands on the pool floor, facing you. *Does:* nothing; the way on is down the benches and out
   through a doorway in the deep end's wall. *Costs:* ~25k, the benches one batched mesh.
2. **Lost Property.** *See:* a wire cage of goggles, odd flip-flops, towels, and one office lanyard. *Does:* a dead
   end that pays: one torch or chalk, always. Something worth turning into a corridor for. *Costs:* ~20k; the cage
   is cutout planes.
3. **The Footbath Corridor.** *See:* a long tiled corridor whose whole floor is a 10 cm footbath. *Does:* every
   step is a splash, so anything that hunts by sound hears you all the way down. The building's toner and the Lane
   Keeper's rule both get a stage. *Costs:* ~10k and one water sheet.
4. **Lane-Rope Office.** *See:* an open-plan office where the desks are divided by lane ropes instead of
   partitions, all slack, dry carpet. *Does:* nothing. *Costs:* ~30k; floats instanced as one model.
5. **Chlorine Store.** *See:* a dark plant room, drums on pallets, one pump humming, one tube. *Does:* nothing but
   dark and noise; a battery sometimes. *Costs:* ~15k, 3 lights.
6. **Kickboard Stacks.** *See:* waist-high stacks of foam kickboards in rows, too wide to step over. *Does:* a maze
   you can see across but not walk across. *Costs:* ~20k; stacks as one model.
7. **Night Swim** (set piece). *See:* a pool with the ceiling tubes off and the underwater lamps on. *Does:* the
   only light is under the water. Now and then a shape passes over a lamp and that lamp goes dark until it has
   gone. *Costs:* ~40k, 8 lights, the water surface.
8. **Shower Queue** (set piece, small). *See:* a row of shower stalls, every one running, a towel over each door,
   a pair of shoes under each. *Does:* one stops running when you pass, and starts again behind you. *Costs:*
   ~25k; the falling-water ribbons already exist in `locker-showers/`.

Four creatures, each with a rule the floor does not have yet. All would go in the cast (`themes: { waterpark: 1,
'*': 0 }`), hurt only through `c.hurt`, and sit in the health tiers.

1. **The Attendant** (keeps to itself, roams). *See:* a towel cart pushed by nobody. *Rule:* it collects anything
   left on the floor, dropped items included, and wheels it off to Lost Property, where it can be fetched back.
   *Shove:* tips it over and spills what it has. *Scissors:* none. It makes dropping something a decision. Basic.
2. **Wet Footprints** (hunts, roams). *See:* footprints appear on dry tile, walking toward you. *Rule:* they step
   where you are standing two seconds from now; step off their line. *Caught:* 1 heart. *Shove/scissors:* nothing
   to touch, which is the point: the counter is the floor. Medium.
3. **The Whistle** (helps and hurts). *See:* nothing; a lifeguard's whistle from one side of a room. *Rule:*
   everything that hunts on the floor goes to where the whistle blew. Stand where it blew and they come to you;
   stand away and it has drawn them off. It never hurts directly. Unhittable.
4. **Under the Tiles** (hunts, home: room). *See:* a dark shape moving under a dry tiled floor, as under ice.
   *Rule:* it follows footfalls on tile, and loses you on carpet or a mat. It can only come up through a floor
   drain. *Caught:* at a drain, 1 heart. *Scissors:* only when it is up at a drain. Medium.

If only one is made: Wet Footprints. Every creature on this floor is about standing still; this one is about where
you stand.

---

## 8. Fix order

1. **Take the words off.** Remove the key names and the rules from the signs in the Surge Basin, Lazy Loop, Diving
   Well (both boards) and Drain Spa. Remove the `ADULT SWIM` and `SUBMERGED` camcorder flags. Keep the pool-rules
   signs that are a pool's own voice. *Owner's go: not needed; it is their own rule.*
2. **Make the Towel Return survivable.** Any one of: three figures, not six; one heart for the whole chase; the pack
   stops at the tower door; or make them answer the scissors as basic or medium tier. Also give the room its own
   `resident` id and drawing, not `pit-clerks`. *Owner's go: yes, for which one.*
3. **Soften the Return Pool's valve.** The wake keeps off whoever is at the wheel, or one turn opens the fold.
   *Lead's call.*
4. **One look.** Re-skin the plain rooms in the newer rooms' ivory-and-green kit, and use dark water at Classic in
   the older five (the Return Pool's water is the model). Then cut the Drain Spa to one anomaly. *Owner's go: yes; it
   is art direction.*
5. **Bring the residents into the health tiers.** The Lane Keeper, Guard-Stand and wake as medium, the floats and
   skimmer as basic, each answering a jab. Let a shove reach room residents as well as the cast. *Owner's go: yes; it
   touches shared code.*
6. **Decide on pushing water.** Either water is the exception to "nothing pushes the visitor", or the surge, vortex
   and current slow you instead of moving you. *Owner's go: yes.*
7. **Deal it:** `dealt: true` at a low weight, single-player only, once 1 and 2 are in. Co-op stays off until the
   folds, rides and swimming have been played on two clients. *Owner's go: yes.*
8. Then the add-ons, quiet rooms first, and Wet Footprints.

**Not checked.** Sound (everything was muted). Co-op. A phone or a real GPU, and so frame times and the reflection
pass. The Flume Knot's slides and sump hatch, the Other Changing Room's locker fold and shower figures, the Drain
Spa's valve, and the Diving Well's dive (all read only). Tube toners and the skimmer in play. Any part but the first
of a visit. Difficulty settings other than the default. Whether the Return Pool's far door is ever the only way on.
