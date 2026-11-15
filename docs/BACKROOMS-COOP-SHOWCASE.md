# The long way round — four-floor private tour

Prepared locally for review and deployment. Railway remains at `bb4551a` until
this release is approved and published. The waterpark is not included: Gemini
is still finishing it. No uncommitted files were taken from its worktree.

Seed: `blockrooms-the-long-way-round-v1`. Choose **The long way round** in the
host lobby, or open `/rooms?route=showcase` with the existing host bookmark's
private fragment. Invite codes remain random; the guest simply opens the
invite link and receives the host's route automatically.

| Floor | Place | Discoveries | Cast |
| --- | --- | --- | --- |
| 1 | Yellow offices | Moving cutouts, cake/party room, chairs, ceiling meeting, Blackout Bay, Dispatch | Pirate, night porter |
| 2 | Unfinished offices | Quiet Zone, Mailroom, Copiers, keyboard floor, Return Plenum | Waste Toner, Mother |
| 3 | Suburbia | Show Home, The Close, Back Garden, lemonade, Model Village, Walk-in, The Gap | Desk moth, The Lines |
| 4 | Night offices | Cover, Many Doors, ceiling plants, MECHA, Last Light, Unsure Hall | Other Door, shadow |

There are 113 rooms across four floors: 26 / 25 / 29 / 33. Ordinary maze accounts
for 73% / 76% / 72% / 79%, leaving space between discoveries. Every selected
feature and cast member is checked against the generated floor. The finale
combines the former last two floors; MECHA and Last Light are separated by
ordinary maze. The authored finale requests `setPieces: 2`; ordinary generator
calls retain the one-large-landmark limit.

## New creatures

Mother and The Lines are imported from Fable's `34b5c98`, including Mother's
wet appearance and procedural squish/retch sounds. Co-op changes:

- Mother's small ones independently target the nearest living visitor. Each
  has its own moving E interaction, so either player can tread on one.
- A small one's jump must retain line of sight to land a hit.
- The Lines continues after a surviving teammate if it downs the other.
- Wet materials and spawned brood meshes replicate to the guest.

## The Gap and its removable bridge

Suburbia now has the complete **Gap** room and The Lines encounter. The lawn
has a real missing strip, with narrow crossings and loose timber-backed
hoardings. E holds a hoarding; R lowers it when both ends have support. Cross,
then E holds the laid bridge and R raises it, including from the far bank.
The Lines walks onto a supported bridge and falls permanently when the bridge
is raised beneath it. The shorter panel cannot span the gap.

Both players share panel poses, floor surfaces, collision and navigation
changes. Raising/lowering checks both visitors, so a partner standing on the
bridge blocks the action. The Lines deliberately has no blocking body for this
interaction. Ordinary chairs, desks and trolleys retain their drag behavior;
loose hoardings can be carried. Hoardings are restored to a stranded bank when
needed, using the room's existing recovery rule.

A fall affects only that visitor. In co-op the fallen player is downed and
returned to their last safe bank, where the partner can use a snack to revive
them. It never lowers the entire room's floor beneath the other player.

This imports the bridge support, movable-panel registry and reachability proof
from Fable's development branch. A bridge must really connect both banks; the
room is not silently flattened to make it pass the no-trap check. The Lines
is explicitly scheduled in this tour; its upstream automatic room-linked
dealer remains outside the ordinary random-visit integration.

This is a curated selection, not every room in the catalogue. Side branches
can be missed. Health, camera power, crafting, trading, revives, lighting,
furniture, custom characters and voice remain active. No save, reconnect or
host migration; keep the host tab visible. Solo scorecard/guestbook and the
solo settings/death presentation remain outside this prototype.

## Verification

- `node --test test/coop-showcase.test.mjs test/coop-server.test.mjs` checks all
  floor layouts, authored cast, connected exits, spacing and private invites.
- `node tools/blockrooms/coop-browser-check.mjs --run --showcase` completed all
  four floors through the real relay with two browsers, retained health, bags,
  battery and mounted light, and reached final extraction in both clients.
  Positioning/time are accelerated; this is not a natural human playthrough.
  Adding `--bridge` also passed the guest’s real R key through the WebSocket
  relay, raised the bridge, and replicated the removed floor. The single-window
  test keeps host visibility logically true to represent two separate computers.
- `COOP_CHECK_ROOMS=the-culvert COOP_CAST=mother,the-lines node
  tools/blockrooms/coop-content-check.mjs --encounters` checks guest brood
  triggering, E stomping, guest-only damage, The Lines downing one player and
  continuing after the other, and matching replicated scene state. No browser
  errors. Mother's brood added 20–25 synchronized scene nodes; spent brood and its E interactions are cleaned up.
- `test/coop-new-creatures.test.mjs` retains Fable's pure creature-rule tests.

- `node tools/blockrooms/coop-content-check.mjs --bridge --encounters`:
  guest carries, lowers, walks across and raises a hoarding; the partner blocks
  removal while on it; per-player fall/downing and safe-bank recovery pass.
  The real creature walks from its lair onto the bridge, falls and disappears
  after removal, and awards an evasion. Both browsers agree on floor heights
  before, during and after tipping. Setup accelerates visitor positioning and
  temporarily hides the creature while preparing the fixture; pursuit itself
  runs normally. This is not a claim of a natural human playthrough.
- `test/backrooms-bridges.test.mjs`: support at both ends, short-panel rejection,
  real player/creature crossing, swept clearance, both-player protection,
  rotated/raised rooms and reachability from every entrance.

`npm test`: 888/891 pass. The three existing failures are the Office console
path-alias assertion, its parent suite, and the Office usage/status-line bridge.
All Backrooms and co-op unit tests pass.

When the waterpark is ready, integrate its reviewed commit, verify water
movement/hazards/shared state, place it at floor 4 and move this finale to 5.
Recheck the complete route before publishing that later release.
