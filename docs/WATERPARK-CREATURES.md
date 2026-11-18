# The waterpark's creatures: what is there, and what to make instead

18 November 2026. Written for the owner, after their note on `WATERPARK-REVIEW-2.md`: "other than the lifeguard
these are by far our weakest creatures … They feel like afterthoughts currently." This is a document only. Nothing
in the game changes in this push. What I played and what I only read is said as before (`WATERPARK-REVIEW-2.md`
sections 3, 4 and 9). The health tiers are those of `cast/health.rule.js`: basic 1, medium 2, boss 3.

**The short version.** Four of the six creatures that hurt have the same rule: "do not move in the water". Two of
the six are borrowed from other floors. Only the lifeguard has a body that is a joke and a threat at once. The fix is
not more creatures. It is one rule each that belongs to its room, and a body that shows the rule.

---

## 1. What is there

### The Guard-Stand (Lazy Loop): keep

*What it is.* A lifeguard's chair that is the lifeguard, melted into its own legs. It whistles, unfolds into a
four-legged stilt walker and wades after you. *What it does.* It sits for about six seconds, whistles, then scans.
Moving in its sight, or running, brings it on at 2.7 m/s; one heart, then it goes home. Scissors make it recoil
(played). *Why it works.* The body shows the rule: a chair watches the pool, and a lifeguard blows a whistle before
coming in. The whistle is a tell you learn by being caught once.

**Keep.** Medium tier, as ruled. Two small changes:
- The scissors already make it recoil. With health, a second jab should fold it back into a chair for good. A dead
  lifeguard is a chair again, which is the right picture.
- A shove from the deck while it wades should topple it into the canal for a few seconds.

### The Lane Keeper (Lane Archive): rebuild its rule, keep its body

*What it is.* A lane-divider rope with a swimming cap and goggles at its head, and long hands. *What it does.*
Wading draws it after about 1.35 s; standing still for 1.6 s, or getting onto the dry banks, settles it. The pump
lures it to the outlet. It costs one heart (played). Scissors and a shove do nothing.

*Why it is weak.* The body is good, the best idea on the floor after the lifeguard. But its rule is the floor's
common rule (stand still in water), so nothing about it is learnt that the skimmer, the floats and the Return Pool's
wake do not also teach. The pump is the one thing that is its own, and a player meets it after being bitten.

**Rebuild the rule as: it is the rope.** It can only travel along the lane ropes, and you can see the ropes. Where
a rope is broken, or ends short of the wall, it cannot follow.
- *Sees:* three lane ropes down the archive's lane, one with a gap. The cap moves along whichever rope you are
  nearest, its floats bobbing behind it.
- *Learns by dying:* "it came along the rope I was standing beside."
- *Survived:* cross where the rope is broken, or wade between two ropes, never beside one. The pump stays: it pulls
  the keeper to the outlet's rope.
- *Scissors:* a jab cuts the rope it is on. It stops there, floats drifting apart, for good on that rope (it has
  to swim back to another). A second jab kills it. *Shove:* in the water, a shove sends it two metres back along its
  rope.
- *Tier:* medium.
- *Costs:* cast: the rule (a path on a polyline instead of open water; small). Animation: the head running along a
  rope (it already bobs along a path). Me: the room (three ropes, one gap; the ropes already exist as dressing).

### The inverted bathers (Toadstool Lagoon): replace

*What they are.* Office trousers and shoes sticking up out of candy-coloured inner tubes. *What they do.* Ten
rings bob in an ankle-deep pool. Hurrying past an occupied one lunges it at you for one heart (played: walking was
safe, hurrying cost two hearts). Scissors find no target.

*Why they are weak.* The picture is the floor's funniest and it is a picture: legs do not do anything legs can do.
The rule (do not hurry in the water) is the floor's common rule again, and it cannot be seen. Nothing tells you
which rings are occupied until one hits you, and nobody hurries in a paddling pool unless they are already running
from something.

**Replace with Under the Tiles, and let the bathers be scenery.** The lagoon is shallow and its floor is tiled, so
a shape under the tiles can be seen through the water. That is the one place on the floor where this creature reads.
- *Sees:* a dark shape the size of a person moving under the pool's tiles, as under ice. The tiles above it lift a
  few millimetres as it passes, and the ring nearest it tips over.
- *Learns by dying:* "it follows my steps on the tiles."
- *Survived:* it follows footfalls on tile (wet or dry), and loses you on the rubber mats and the coping. The
  lagoon's mats and the mushroom's base become the safe ground. It can only come up through the drain under the
  mushroom.
- *Scissors:* only when it is up, at the drain: one jab sends it down for good (basic). *Shove:* nothing; there is
  nothing above the tiles to push. That is the point: the counter is where you stand.
- *Tier:* basic.
- *Costs:* cast: the rule (footfall listener, tile versus mat). Animation: the shape under the floor (a dark decal
  that moves, plus the tile lift). Me: the room's mats and drain. The bathers stay as they are, harmless.

### The Smilers (Towel Return → Diving Tower): replace with the Attendants

*What they are.* Grinning swimmers in trunks, four of them now and fairly slow (`988b7c8`), on the cubicle grid's
rig (`cubicle-grid/rig.js`, `buildSmilingClimber`). *What they do.* When you are two metres into the towel maze the
lights drop and they come after you. The dive off the tower ends the chase. One heart a touch.

*Why they are weak.* They are another floor's creature. The rig, the grin and the id were the Open-Plan Pit's until
today, and the wall drawings were the Pit's. Their rule is "they chase you", which every chase has; nothing in the
Towel Return is about towels. Neither a jab nor a shove does anything to them today.

**Replace with the Attendants.** Towel carts with nobody pushing them, which is what a towel return is for.
- *Sees:* four laundry carts, piled with damp towels, parked in the bays of the towel maze. When you are in, the
  lights drop and the castors start: a rattle you hear before you see them.
- *Learns by dying:* "they roll, and they cannot climb."
- *Survived:* keep moving through the maze and get onto the tower's stairs and boards. Carts cannot take a step,
  so the boards are safe, and the dive is still the way out. Standing in a bay with a cart in it is how you get
  caught.
- *Scissors:* a jab cuts the towels away; the cart rolls on empty and harmless (basic, one jab). *Shove:* a shove
  sends the cart rolling back the way it came, and it knocks over any cart behind it. This is the creature on the
  floor where the shove matters most.
- *Tier:* basic.
- *Costs:* cast: the rule (the chase's path code stays; carts cannot change height). Animation: castors, wobble, a
  cart tipping. Me: the room (bays, the carts' parking spots; the `trolley` prop and towel-cart batches already
  exist in `return-pool/dressing.js`). The Smilers go back to the Pit.

### The flume toner (Flume Knot): replace with the Rider

*What it is.* The building's waste toner, clinging upside-down inside a crawl tube. *What it does.* The cast
toner's rule, inside the tubes: crawl gently and it misses you; scramble and it drops for one heart. Scissors make it
recoil (read; not played).

*Why it is weak.* It is not the waterpark's. It is the toner, with its rule, met in a tube instead of a corridor.
In opaque tubes you cannot see it until it is on you, so the one tell (clicks) is the only one.

**Replace with the Rider.** The tubes are water slides; something should come down them.
- *Sees:* nothing at first. Then a rising rumble in the tube and a wash of water along its floor, and a figure in a
  rubber ring comes round the bend at slide speed.
- *Learns by dying:* "it comes down the straight tubes; the round hubs are wide enough to let it by."
- *Survived:* get into one of the eight junction hubs before it reaches you, and it slides past. It never leaves
  the tubes.
- *Scissors:* a jab as it passes punctures the ring; it grinds to a stop and blocks that tube for a while (basic,
  one jab). *Shove:* nothing; it is moving too fast to push.
- *Tier:* basic.
- *Costs:* cast: the rule (a path along the tube graph; the graph already exists as `walkSegs` and `nodes`).
  Animation: a ring on a spline, which the slide rides already do. Me: the room.

### The skimmer (plain-room footbaths): replace with Wet Footprints

*What it is.* A small thing in some plain rooms' footbaths (read; none dealt on six floors). *What it does.* Ripples
draw it; it bites for one heart.

*Why it is weak.* It is rare enough that nobody will meet it twice, it has the floor's common rule, and it is the
size of a mop head.

**Replace with Wet Footprints**, the floor's one roaming creature.
- *Sees:* wet footprints appearing on dry tile, one at a time, walking toward you.
- *Learns by dying:* "they walk into where I will be."
- *Survived:* they step onto the spot you will be on two seconds from now. Step off their line, or stop, and they
  walk past.
- *Scissors and shove:* nothing to touch, which is the point: the counter is the floor.
- *Tier:* none (it cannot be hit; `UNHITTABLE`).
- *Costs:* cast: the rule and a roaming home (`themes: { waterpark: 1, '*': 0 }`). Animation: prints only (decals
  that fade). Me: nothing. Cheapest of the six.

### The Return Pool's wake: keep, as a hazard

A fin and rings that come at you after about a second in the water. It is honestly a hazard and the lead has kept
it out of the health tiers. **Keep.** One change that would make it the room's own: let it come from the hanging
pool overhead, so the drips and a dark shape above the water are its tell.

### The things that hurt and are not creatures

The Surge Basin's wave, the vortex, the current, and running out of air when you stay under. These are water, and
the owner has ruled that water may push. The figures in the Other Changing Room's showers do nothing and should stay
that way.

---

## 2. The Whistle

The fourth idea from the review has no room of its own. **The Whistle**: a lifeguard's whistle, blown somewhere on
the floor, that every hunting thing goes to. It never hurts. Stand where it blew and things come to you; stay away
and it has drawn them off. It is a floor-wide event, not a resident.

It is worth making only once the floor has hunters of its own that roam (Wet Footprints), and only if the
Guard-Stand's whistle is not then confusing. Tier: none.

---

## 3. Ranked, and the two to do first

| rank | room | change | why first or later | who builds |
|---|---|---|---|---|
| 1 | Towel Return | **the Attendants** replace the Smilers | the floor's one chase, today on another floor's creature; the shove and scissors matter most here | cast, animation, me |
| 2 | Toadstool Lagoon | **Under the Tiles**; the bathers become scenery | the funniest picture keeps its joke and loses a rule nobody can see | cast, animation, me |
| 3 | Flume Knot | **the Rider** replaces the toner | the floor's set piece gets a creature of its own; path code mostly exists | cast, animation, me |
| 4 | plain rooms | **Wet Footprints** replaces the skimmer | the first waterpark creature that roams; cheapest | cast |
| 5 | Lane Archive | the Lane Keeper's **rope rule** | keeps the good body, gives it a rule of its own | cast, me |
| 6 | Lazy Loop | the Guard-Stand: a dying jab folds it, a shove topples it | small; it already works | cast, me |
| 7 | floor-wide | **the Whistle** | only once 4 is in | cast |

**Do first: the Attendants and Under the Tiles.** They fix the two creatures a first visitor is most likely to
meet and fail to learn anything from. Each gives the floor a rule it does not have: carts cannot climb; it hears
tile, not rubber. And each makes the shove or the floor itself the counter, where today every counter on this
floor is "stand still".
