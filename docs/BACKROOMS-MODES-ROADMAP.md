# Two or more players: modes on the long-term roadmap

The owner's list (19 Nov 2026), for later, not now. The current game is survival: on most floors a visitor
has nothing that hurts anything. These are other ways to play the same building with more than one person.
Under each: what it can stand on that already exists, and what it would need. Nothing here is scheduled;
nothing here has been built or tried.

Today's two-player game is the co-op prototype: [BACKROOMS-COOP.md](BACKROOMS-COOP.md), with what it
carries and what it does not in [BACKROOMS-COOP-COVERAGE.md](BACKROOMS-COOP-COVERAGE.md).

## Which first, and why (cast's view, for the owner to weigh)

The test applied: what uses what only this game has?
- **The camcorder:** every run is already a tape with a timestamp.
- **The seed:** the same seed is the same building, so a run can be shared and compared.
- **The cast:** creatures with rules you can learn.
- **The building:** the building is the enemy.

The ranking:
1. **The mole (4, below).** The plot of the place, and the cheapest step toward one player playing the
   building, since the mole is a visitor with a few powers, not a creature driver. The tapes make it ours.
2. **A daily tape (1, below, played asynchronously).** The strongest reason to come back. It needs no
   live match, so it works with few players, and seeds and tapes become things to share.
3. **One plays the building (2, below).** The flagship, built up to from the mole in steps:
   - a mole who can briefly take one creature;
   - then switching between creatures, with spawn closets.
4. **Death match or capture the flag (3, below).** Last. It is least like this game: an event, not a mode.

What ties them together:
- **The cast met and got away from:** already counted per visit, it is a collection kept across modes.
- **Perks:** `core/perks.mjs` exists, and perks could be earned by play.
- **New creatures and rooms:** they land in every mode at once.
- **A new edition:** a change to the building's rules can be a new season of daily tapes.

## 1. Race (the easy one): 1v1 or 2v2

A variant, likely the stronger one: **the daily tape**, played asynchronously.
- **One seed a day:** the same building for everyone, with its own board.
- **Ghosts from tapes:** your run is kept as a tape, and you race the ghosts of other people's tapes, not a
  live opponent. No matchmaking, so it works with few players.
- **The live race:** the 1v1 version below stays as a variant of it.

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

## 4. The mole (Among Us inspired): one of the team is secretly working for the building

The owner's addition. A co-op visit in which one of the players has been dealt the building's side and
does not say so. It fits the place: the plot of the films is that the place wants you to stay.

The mole is a visitor, with a few quiet powers, each with a cooldown and each leaving a trace:
- **a noise:** a sound from where they stand, that draws whatever hears;
- **a door:** shut quietly behind the others;
- **a chalk mark:** smudged or moved (`marks`);
- **a paper fire:** put out (the extinguisher's `douse` path already exists);
- **a sticky note:** left where it will wake;
- **a lie:** walking the group the long way, or toward a creature's room, is simply a lie.

The tapes make it ours. Every visitor's camcorder records:
- **the vote:** at the end, or at a vote partway through, the others scrub through each other's tapes to find
  who did it;
- **the mole's glitch:** the mole can glitch a few seconds of their own tape, at a cost (battery, or the
  glitch itself looking suspicious).

Win conditions to try:
- **for the team:** the visitors leave with the mole named;
- **for the mole:** fewer than half get out, or the mole leaves unnamed.

What it stands on:
- **co-op:** the prototype exists (BACKROOMS-COOP.md);
- **interference:** the tape's interference (`env.interfere`) and glitch (`hud.glitch`);
- **record and replay:** what a run keeps and plays back (`core/runs.mjs`, the replay test);
- **the cast:** creatures with readable rules, so a lure is predictable to the mole and readable afterward to
  everyone.

What it would need:
- the role dealt in secret;
- the mole's powers, networked;
- a tape review: each visitor's picture kept for the run, not only the count;
- a vote;
- balance, so the powers are noticeable on tape but deniable in the moment.

