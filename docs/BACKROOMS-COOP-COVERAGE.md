# Full-content co-op review

Branch: `codex/backrooms-coop-full-game`. Base: merge `1393d01`, incorporating
Fable development `2ce180f`. Full-content commit `de00cec` is pushed.
Custom-character/open-mic follow-up `bb4551a` is pushed and live on Railway,
deployment `ed437082-8346-4085-9846-c8b3cba30be7` (15 November 2026).

## Scope

The restricted four-room/two-creature dealer is removed. Co-op uses the same
production room and creature catalogues as this development base. All 53 feature
room types, ordinary maze connectors, six cast types, and room residents are
eligible. Suburbia is explicitly included as the third part of a private visit.
The existing seeded planner still chooses a subset of rooms and cast for each
run. **Eligible does not mean every room and creature appears in one visit.**
The requested curated “super seed” is deliberately deferred until this coverage
is reviewed; it is not a selectable mode here.

| System | This branch |
| --- | --- |
| Rooms | Production dealer and builders, including dynamically imported modules; no co-op feature whitelist. |
| Suburbia | Included in every normal private visit; its houses, outdoor illusions and resident encounters use the production builders. |
| Cast | Pirate, moth, shadow, porter, waste toner and other door follow the production seeded roster. Each ticks once under the appropriate living visitor. |
| Room residents | Production denizen system runs, including absorbed colleagues, paper exchanges, warden drops and MECHA capture. Visibility includes the guest's location. |
| Lighting | Production failing banks, dim pockets, travelling outages, isolated lamps, emergency lighting, ordinary fluorescent flicker and encounter lighting. Host clock drives both pictures. |
| Physics | Production furniture registration and movement for chairs, desks and trolleys. Either visitor can drag with E. The other visitor, creatures and walls block movement. Creature barricade contracts remain active. |
| Flashlights | Loose and mounted beams, matching optical pose, remote beam, both visitors' light available to relevant room encounters. |
| Inventory | Production six-pocket inventory, crafting, stacks, supplies requested by rooms/creatures, scissors, shared pickups, fires and chalk. Battery/snack density scaled for two players. |
| Team interactions | Existing snack revives, flat-camera battery rescue, consent-based trades, emotes, push-to-talk and opt-in open mic. |
| Characters | Gemini’s Yellow Alien and Pink Cowgirl, using the exact studio presets. Each visitor chooses their own; the host can assign both slots before Ready. Choices carry across floors. |
| Run | Production 3–5-part visit, shared descent and final taped-wall extraction, carried health/batteries/inventory and creature carry state. |
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

Protocol is `blockrooms-coop-7`: server and both clients must update together.
There are no new packages, accounts or hosting services.

## Verification

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
- Focused encounters: guest furniture grab/drag/release; guest-only MECHA capture
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
- `npm test`: 872/875 pass. Existing failures: Office console child test and its
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
