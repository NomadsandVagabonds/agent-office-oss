# Two or more players: modes on the long-term roadmap

The owner's list (19 Nov 2026), for later, not now. The current game is survival: on most floors a visitor
has nothing that hurts anything. These are other ways to play the same building with more than one person.
Under each: what it can stand on that already exists, and what it would need. Nothing here is scheduled;
nothing here has been built or tried.

Today's two-player game is the co-op prototype: [BACKROOMS-COOP.md](BACKROOMS-COOP.md), with what it
carries and what it does not in [BACKROOMS-COOP-COVERAGE.md](BACKROOMS-COOP-COVERAGE.md).

## 1. Race (the easy one): 1v1 or 2v2

Both play the same building at the same time, each in their own copy of it, and the scores are compared at
the end. The other player can be seen as a ghost walking your copy.

- **Score:** the finishing time is a big part of it. The camcorder battery as the clock that ends a visit
  might come out of this mode. A visit could still fail after a set, longer time.
- **Supplies:** fewer battery packs, to make up for that.

What it stands on:
- **The same building:** the same seed always builds the same building (`plan.js`, `gen.js`), so two
  copies are the same map with nothing shared but the seed.
- **The ghost:** co-op already sends where each visitor is. A ghost is that position drawn and ignored by
  everything: no collider, no creature notices it, no pickups.
- **The score:** it is kept in `core/runs.mjs` (`scoreRun`, `settleRun`). The battery ending is
  `battery-ending.js`, and supplies are `supplies.js` (`SUPPLY.batteryEvery`).

What it would need:
- **A score rule:** time-weighted, and its own leaderboard, not mixed with the survival one.
- **A battery switch:** the battery-as-clock turned off or lengthened, and the battery packs thinned, for
  this mode only.
- **Fairness:** creatures and supplies are already decided by the seed, so the two copies start equal. What
  a creature does after that depends on the player, so the copies drift apart. That is fine for a race.

## 2. One plays the building: 1v1 to 1v4

One player is the building, and the others are the visitors (inspired by Left 4 Dead's infected players and
Dead by Daylight).

- **Playing the creatures:** the building's player switches between the creatures on the floor and plays
  them. Spawn closets would give them ways in.
- **The first win condition:** the visitors get out, by the way out.
- **The maps:** they would need tweaking and balancing. Probably larger, one level to a map, with good
  ambush points.

What it stands on:
- **The cast's rules:** each creature's rule is already pure and separate from its body (`cast/*.rule.js`
  with `cast/*.js`). A creature's moves are what it is allowed to do, so a person could drive the same
  limits: the middle manager still cannot crawl, the notes still only come off the wall when someone is near.
- **The conductor:** `pursuer.js` already runs them all, and can summon one at a place (`summon`, the dev
  page's `beside=`).
- **Doorways and limits:** the doorway rule (`cast/doorway.rule.js`) and each creature's where-it-may-go
  rules (`GOES`) carry over as the limits on a player too.

What it would need:
- **Control:** a way for a player to take over a creature's moves while its rule still applies.
- **The building's view:** what the building's player sees, a camera of its own, and the switching between
  creatures.
- **Spawn closets:** placed by the map, not by the seed.
- **Maps:** single-level maps built for it.
- **Balance:** a lot of it.

### A variant: the hostage

Like a hostage map in Counter-Strike: someone is held in the building (a room past the entries) and the
visitors have to get them out.

- **The hostage:** could be a visitor or a stand-in, perhaps a colleague the creatures took on the way down.
- **What exists to build on:** co-op already has a revive (BACKROOMS-COOP.md), which is the nearest thing
  there is to freeing someone.

## 3. Death match or capture the flag

The classic modes, with more weapons that hurt, and the creatures kept on as hazards to both sides.

What it stands on:
- **Weapons:** the jab, the shove and the extinguisher (spray and smash), with health from
  `cast/health.rule.js` and `health-state.js`.

What it would need:
- **Player-hurts-player:** neither the shove nor the jab touches another visitor today.
- **More weapons:** offensive ones.
- **The modes themselves:** flags and respawns.
- **Creatures as neutral hazards:** creatures that hunt whoever is nearest, not "the visitor".
