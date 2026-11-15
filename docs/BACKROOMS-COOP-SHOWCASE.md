# The long way round

A private, repeatable five-floor co-op tour. Select **The long way round** under
**Which way?** before creating the invite. A host URL with `?route=showcase`
preselects it. Both players receive the route from the relay; the friend has
nothing to configure. Each invite is still a fresh random private room code.

Prepared locally after live build `bb4551a`; not deployed yet.

## What is in it

| Part | Place | Discoveries | Roaming / room cast |
| --- | --- | --- | --- |
| 1 | Yellow offices | Moving cardboard colleagues, cake/party room, chairs, ceiling meeting, Blackout Bay, Dispatch and its GPU warehouse | Pirate, night porter |
| 2 | Unfinished offices | Quiet Zone, Mailroom, Copiers, keyboard floor, Return Plenum | Waste Toner |
| 3 | Suburbia | Show Home, The Close, Back Garden, lemonade stand, Model Village, Walk-in | Desk moth |
| 4 | Executive offices | Team photo, phone, vending, Cover, MECHA | Other Door |
| 5 | Night offices | Stress Pool, Many Doors, ceiling plants, Last Light, Unsure Hall | Pirate, shadow |

The room residents are still present: stand-ins, plenum creature, MECHA warden,
lamplighter, and the neighbourhood's inhabitants. The roster does not put all
six roaming/room cast types on one floor. The pirate appears on floor 1 and
returns in the finale. The shadow moves to the final part to keep the opening from stacking both threats. Suburbia is a
breather with the guide moth. Floor 1 has six features and remains 73% ordinary
maze; the existing cutout encounter advances while neither visitor is watching.

There are **27 different feature rooms and 130 rooms total**. Ordinary maze
accounts for 72–79% of each floor. No two feature rooms share a doorway, and
there is at most one large set piece on each floor. Graph reachability, exit
distance, and earlier lessons are checked. Blackout Bay comes before Last Light;
cardboard colleagues come before Unsure Hall. The production generator still
builds the space, its strange geometry, doors, connectors, lighting and supplies.

This is a selection of the current catalogue, **not all 53 feature rooms**.
Some discoveries remain on branches: they are guaranteed to exist, but a player
can miss them. There is no objective checklist, forced sightseeing or extra
signage. The older Flood Archive, Window Court and underfloor workshop prototypes
are not in this branch's production deck and have not been silently added here.
Return Plenum is the current overhead crawlspace encounter.

Normal difficulty and camera drainage remain. Snacks, battery packs, crafting,
revives, trading, furniture, light and voice work as in ordinary co-op. The
private invite lasts three hours instead of one so a long tour is not cut off
at the old limit. This is still a live run: there is no save, reconnect or host
migration, and the host tab must remain visible.

## Construction and checks

- `core/coop-routes.mjs`: route identity, repeatable seed, label and invite lifetime.
- `world/coop/showcase.js`: authored room and creature schedule.
- `world/coop/visit.js`: applies that schedule to the production visit planner.
- `castFor()` accepts the authored visit's explicit company. Normal visits keep
  the seeded dealer. Creature placement, supplies and foreshadowing use the same
  schedule, instead of separately guessing who might appear.
- Protocol `blockrooms-coop-8` carries the server-owned route to both browsers.
- `node --test test/coop*.test.mjs`: 53/53 pass — route, generation, socket selection, private
  invite independence, and existing co-op tests.
- `node tools/blockrooms/coop-browser-check.mjs --run --showcase`: two real
  Chromium clients built all five floors, verified every scheduled feature and
  cast, crossed all four floor transitions with possessions/vitals intact, and
  escaped together with no browser errors. The check accelerates travel by
  placing visitors at exits; it is **not** a natural playthrough of every puzzle.

Full suite: 875/878 pass, with the same three unrelated Office console/status-line
failures as the prior release. The random visit remains selectable as
**Somewhere new**.
