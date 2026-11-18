# Full-content co-op review

Branch: `codex/backrooms-coop-full-game`, incorporating live `eadfb5d`.
The earlier private tour release was `6c7e7a3`; this merge is for Fable's review
and has not been deployed. Hosting details remain in private local records.

## Scope

The restricted four-room/two-creature dealer is removed. Co-op builds from the
production catalogue: 56 feature-room definitions, maze connectors, eight cast
types and room residents. The three mall rooms remain available only for dev
previews: the mall theme is deliberately not dealt by the normal planner.
Normal visits have four floors, with Suburbia second or third, exactly as live.
**Eligible does not mean every room and creature appears in one visit.**

The optional curated tour has four floors, ending in a combined night finale.
Mother joins floor 2; The Lines and the removable Gap bridge join Suburbia on
floor 3. See [the showcase notes](BACKROOMS-COOP-SHOWCASE.md). Waterpark is deferred.

| System | This branch |
| --- | --- |
| Rooms | Production dealer and builders, including dynamically imported modules; no co-op feature whitelist. |
| Suburbia | Included in every normal private visit; its houses, outdoor illusions and resident encounters use the production builders. |
| Cast | Pirate, moth, shadow, porter, waste toner and other door follow the production seeded roster. Mother and The Lines use the live dealer too; the showcase schedules both explicitly. Each ticks once under the appropriate living visitor; Mother’s brood chooses per small creature. |
| Room residents | Production denizen system runs, including absorbed colleagues, paper exchanges, warden drops and MECHA capture. Visibility includes the guest's location. |
| Lighting | Production failing banks, dim pockets, travelling outages, isolated lamps, emergency lighting, ordinary fluorescent flicker and encounter lighting. Host clock drives both pictures. |
| Physics | Production furniture registration and movement for chairs, desks and trolleys. Either visitor can carry with E; E sets it down only where the footprint fits, with a maximum 0.4 m difference from the carrier’s floor. Placement checks the partner, creatures and walls. Creature barricade contracts remain active. The Gap adds carried hoardings, R lower/raise, supported walkable bridges, shared surface state and protection for both visitors. |
| Flashlights | Loose and mounted beams, matching optical pose, remote beam, both visitors' light available to relevant room encounters. |
| Inventory | Production six-pocket inventory, crafting, stacks, supplies requested by rooms/creatures, scissors, shared pickups, fires and chalk. Battery/snack density scaled for two players. |
| Team interactions | Existing snack revives, flat-camera battery rescue, consent-based trades, emotes, push-to-talk and opt-in open mic. |
| Vending machines (Refreshments room, and one machine on a floor without it) | **Carried by design, not run.** The machine uses only what co-op's `env.inventory` offers (`held`, `consumeHeld`, `give`, `physical.spawn`); E runs once in the authority with the acting visitor, so a machine's inputs and the floor's two vends (one `level` object a floor) are shared by both visitors; its panel and front are canvas textures that `scene-sync.js` carries to guests on a version change. Read from the code, never run with two clients. The choice of what E does is by the acting visitor's gaze (`env.player.me`, as the door leaves do). |
| Characters | Gemini’s Yellow Alien and Pink Cowgirl, using the exact studio presets. Each visitor chooses their own; the host can assign both slots before Ready. Choices carry across floors. |
| Run | Production four-part visit, shared descent and final taped-wall extraction, carried health/batteries/inventory and creature carry state. |
| Picture/sound | Production VHS rendering and per-visitor interference/white/red effects; soundtrack, creature cue, positional events and lemonade recordings. |

## Multiplayer adaptation

One browser remains authoritative. Guests send actions; the host simulates both
visitors, rooms, cast and residents. Room clocks run once, while zone entry/stay/
leave runs for each visitor. A room actor follows a recent interaction, held
visitor, nearest actor position or active occupant as appropriate. MECHA pins
the captured visitor without freezing the partner. A dead visitor is distinct
from an ended team, including toner and other-door attacks.

Scenes now replicate spawned geometry/materials, reparenting, removals, texture
revisions and appearance changes as well as transforms. This includes toner
brood, dropped props, animated displays and changing room contents. Initial
scene resources are built deterministically in both browsers; additions and
canvas revisions are sent once per floor over ordered WebSockets. Mutable
terrain state, collider bounds, furniture positions and lighting cues travel
with the snapshot. Local held-item models stay outside the replicated graph.

This branch uses `blockrooms-coop-8`: server and both clients must update together.
There are no new packages, accounts or hosting services.

## Merge verification (15 November 2026)

- Full suite: **956/957 pass** with canonical macOS temp paths and inherited
  Office connection settings removed. The remaining failure is the unchanged
  Office usage/status-line bridge. A focused IPv4 retry reaches its separate
  macOS `wc` whitespace assertion (`mine:      272` vs `mine: 272`). No game test
  fails; that unrelated Office test is not altered by this merge.
- Compared 32 solo visit plans and 16 generated floors directly with live
  `eadfb5d`: exact equality. Added a 32-seed co-op/solo isolation regression.
- Two-browser four-floor showcase, all descents, inventory/vitals carry and final
  extraction pass; the guest R bridge action travels through the actual relay.
- Gap carry/lower/cross/raise, partner protection, safe-bank fall recovery and
  The Lines falling after bridge removal pass against the merged code.
- Production inventory/crafting UI, loose/mounted lights, camera refill and
  shared 24-second fire pass. Custom looks and two-way generated microphone
  audio, open mic, mute, focus changes and disconnect handling pass.
- Focused Mother, The Lines and toner checks exercise guest brood stomping,
  guest-only damage, surviving-partner pursuit and live toner leap/brood behavior.
  The furniture fixture uses live carry and legal set-down rather than the
  retired drag interaction. The three hidden mall rooms and party room also
  build in two clients with matching scene, furniture heights and collision
  state; these are construction/replication checks, not full puzzle playthroughs.

## Earlier catalogue verification

The repeatable browser checks use Chromium software WebGL and real production
modules. Positioning and time can be accelerated; they are not a claim that a
human has completed every puzzle naturally.

- `node tools/blockrooms/coop-content-check.mjs --encounters`: all 53 feature
  rooms and six cast types built in two clients; validated streamed snapshots,
  matching scene transforms and no browser errors. Co-op treats room/cast build
  failures as errors, rather than silently replacing a special room with a plain
  one. Each case also includes the
  other rooms selected by its seed. This is catalogue/replication coverage,
  **not a complete behavioral playthrough of all 53 rooms**.
- Focused encounters: guest furniture interaction; guest-only MECHA capture
  and release; guest lemonade healing; porter reward; shadow stare/arm/look-away;
  toner brood spawning three new units and 132 mirrored scene nodes; clerk
  consuming exactly one guest paper sheet while leaving the host's paper alone. Warden evasion creates scissors that the guest can pick up.
- Two complete three-floor network runs (`full-coverage-1` and
  `full-coverage-2`) reached Suburbia and escaped in both browsers, preserving
  health, camera power, bags and mounted light across floors.
- `COOP_TEST_SEED=coop-regression-17 node tools/blockrooms/coop-browser-check.mjs --inventory`:
  actual networked inventory/crafting UI, loose/mounted flashlights, camera
  refill, shared 24-second fire and pirate fear of that fire pass. Fire's glow
  material uses a named local shader factory rather than transmitted shader code.
- The same seed with `--social`: contested pickup has one owner, trade consent,
  reconfirmation after edits, emotes, flat-camera revive, guest movement, shared
  door collision, host pause/resume, guest opening the exit and pirate downing
  only the guest all pass, with no browser errors.
- `coop-preflight-check.mjs`: real fake-microphone capture/resampling/relay and
  audible generated audio in both directions, with 100 ms outbound delay per
  peer. Joining, readiness, duplicate Start handling, mouse capture, reload
  warning and disconnect feedback pass. Custom character assignment, guest choice,
  both 3D looks, open mic without a held key, V mute, button unmute, blur/focus
  and switching back to push-to-talk also pass. No real microphone was accessed.
- Four-floor follow-up: real two-browser showcase completed all descents and final
  extraction. Mother brood triggering, guest stomping/damage, spent-brood cleanup,
  wet-material replication and The Lines continuing after downing a guest pass.
- Gap follow-up: both-client carry/lower/cross/raise, partner protection,
  independent falls and safe-bank revive position pass. The Lines follows onto
  the bridge and falls when it is raised; the guest R key also passes through
  the real relay. The complete four-floor route still escapes in both clients.
- Before the live merge, `npm test`: 888/891 passed. Existing failures: Office console child test and its
  parent (`/var` versus `/private/var` on macOS), and the Office usage/status-line
  bridge. The previously observed wake-order timing failure passed this run.

## Still different from solo / not included

These are explicit limits, not hidden exclusions from the room catalogue:

- The solo Escape settings panel, scorecard, public leaderboard/guestbook,
  full character editor/perks, saved tapes and Office rewards are not integrated.
  Co-op retains its own controls/voice overlay and simple end-of-run summary.
- Solo death cinematics and the final low-battery shutdown film are not ported.
  A downed visitor spectates their partner and can be revived instead.
- Descending uses a synchronized loading cut, not the solo game's seamless
  simultaneous rendering of two floors.
- Host tab must remain visible. No dedicated simulation server, host migration,
  reconnection, late joining, save/resume, guest movement prediction or touch
  controls. Voice is still the existing WebSocket PCM relay.
- This is not an exhaustive audit of every simultaneous two-player puzzle edge
  case. Room clocks are shared and some room puzzles still choose one visitor
  to drive a particular beat. Dedicated tests cover the encounters above.
- No real London–Argentina playthrough has occurred. Larger rooms and dynamic
  screens increase rendering and network cost. All room groups remain rendered;
  distance/portal culling and performance tuning remain follow-up work. Resource
  deduplication reduces repeated payload, but this is not a WAN performance
  guarantee. The largest measured full baseline snapshot was roughly 526 KB after the warden drops scissors. The relay now accepts packets up to 1 MiB,
  matching its outbound buffer bound and covering that baseline.
- The second flashlight cone has no shadow-map pass, matching the prototype's
  lightweight lighting approach.

Hosted verification: key client/module files match the deployment artifact, health
returns 200, and two Chromium clients pass invite/join, exact custom looks,
readiness, game entry, real generated-microphone audio in both directions, open
mic/mute/focus behavior, reload protection and disconnect feedback. These are
remote Railway checks from one test machine, not a London–Argentina playthrough.

## Known gap: the cast's health and deaths (18 November 2026)

Health for the cast (`cast/health.rule.js`, the conductor's `c.struck` / `c.vital`, `claude/backrooms-cast e422c9c`)
was written for one visitor. Nothing in it is sent to anybody else. This section says what that means, and how
much of it has been seen rather than read.

The sticky notes (`cast/sticky-notes.js`) are not carried either: each page has its own notes, and a note stuck on one
visitor's lens is that page's alone (`env.hand.stick`), as is what they drain. Not run with two visitors.

The same holds for somebody a room keeps (`resident.js`): `env.residents` is that page's own list, a jab or a shove
on one is resolved where the click happened, and its `vital` and its stagger are sent to nobody unless its room puts
them in its own `coopRead` / `coopApply`. Not run with two visitors.

What the code does, read from `pursuer.js`, `cast/toner.js`, `rooms/cable-drop.js` and `inventory-state.js` on live:

- A creature's health (`hp`, `hurt`, `dying`, `gone`) is a field of the conductor's own note of it, on the page that
  runs that conductor. A toner unit keeps its own, and the trunk line its own in its room. No message carries any of
  these, and neither `pursuer.js` nor any creature file has a `coopRead` / `coopApply` for them.
- A jab is resolved where the click happened: `index.js` asks that page's conductor for its targets and calls the
  target's `snip()`. So a hit takes health only from that page's copy of the creature.
- A creature that has been finished is no longer ticked and is taken off the floor by the page whose conductor
  finished it. Its `dies(progress, dt)` is called on that page only.
- The scissors' snap is rolled with that page's own `Math.random`. Two visitors do not share the roll, and need
  not: each has their own pair.

What a second visitor therefore sees when the first kills something, as far as the code says: whatever their own
page's conductor says, which has not been told. If each page runs its own copy of the creature, the second visitor's
copy is unhurt and still hunting while the first visitor's is gone. If one page runs the creature for both and sends
its picture across, the second visitor sees it stop and vanish with no flinch and no death, or does not see the hit
at all when the jab was theirs and the creature is run elsewhere: their jab would then take health from a copy nobody
is drawing. Which of these holds depends on the co-op transport, which is not in the files named above and which I
did not read or run.

Not tested: any of it with two clients. Nothing here has been seen; all of it is read.

What would have to be carried to close the gap: for each creature by id, `hp`, `hurt` and `dying` from the page that
runs it to the others; a jab from a visitor's page to the page that runs the creature, answered with whether it
landed; the same for each toner unit and for the trunk line; and the removal at `gone`. The stagger from a shove
(`c.stall`) is in the same position: it is kept by the conductor and sent to nobody.

**Lights Out (`rooms/lights-out.js`, the forest): noted, not fixed.** The tent that goes dark is the one nearest the
visitor the page itself plays (`c.tick`'s `me`). Nothing of it is sent between pages. So in a shared visit each of two
visitors sees a different tent out, their own nearest, and sees the other's tent lit while the other stands in the dark
beside it. Nothing depends on which tent is dark (nothing in the room can be used and nothing in it hurts), so no rule
disagrees between the two pictures; only the pictures do. To close it: the room would take the nearest tent over every
visitor in the room, which needs the other visitor's place in the room's frame at the tick.
