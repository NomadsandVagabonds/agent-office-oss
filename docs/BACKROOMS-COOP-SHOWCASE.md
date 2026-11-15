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
| 3 | Suburbia | Show Home, The Close, Back Garden, lemonade, Model Village, Walk-in, culvert | Desk moth, The Lines |
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

**The newer Gap bridge-removal puzzle is not included.** Suburbia uses the
existing culvert and leaning hoardings. The Lines can wake, fold through the
hallways and pursue visitors, but you cannot pull a bridge out from under it
in this build. Its rule supports falling; that does not mean the new room's
counterplay is connected. Reach the next floor together to leave it behind.
The Lines is explicitly scheduled in this tour; its upstream automatic
room-linked dealer has not been imported into ordinary random visits.

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
- `COOP_CHECK_ROOMS=the-culvert COOP_CAST=mother,the-lines node
  tools/blockrooms/coop-content-check.mjs --encounters` checks guest brood
  triggering, E stomping, guest-only damage, The Lines downing one player and
  continuing after the other, and matching replicated scene state. No browser
  errors. Mother's brood added 20–25 synchronized scene nodes; spent brood and its E interactions are cleaned up.
- `test/coop-new-creatures.test.mjs` retains Fable's pure creature-rule tests.

Full regression suite: **880/883 pass**. The three failures are the existing
Office console child/parent (`/var` versus `/private/var`) and Office status-line
bridge failures. The co-op and new creature checks pass.

When the waterpark is ready, integrate its reviewed commit, verify water
movement/hazards/shared state, place it at floor 4 and move this finale to 5.
Recheck the complete route before publishing that later release.
