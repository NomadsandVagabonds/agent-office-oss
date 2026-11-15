# Two tapes: private two-player prototype

Working branch: `codex/backrooms-coop-full-game`, with Fable development through `2ce180f`.
Full-content coverage and remaining differences: [BACKROOMS-COOP-COVERAGE.md](BACKROOMS-COOP-COVERAGE.md).
The full-content changes are local and are **not** in the Railway build below.
Private alpha: hosted on Railway; use the owner's private host bookmark.
Railway runs game build `69d7c55`, separately from the public BlockRooms site.

## Lobby refresh (live)

The co-op entry page now uses the homepage’s yellow wallpaper, original voxel
logo and sprites, navy window bars and beveled buttons. Instructions use plain
player-facing language. The host bookmark still hides the passcode and strips
it before generating an invite. Esc returns to the compact camcorder overlay
after play begins. Desktop and 390px layouts, asset loading, two-browser
joining/ready, and returning to the menu were checked in Chromium.

Artwork is exported from the existing homepage source with
`node tools/blockrooms/export-lobby-art.mjs`; no external images or dependencies.
The server serves CSS and SVG with their correct MIME types under `nosniff`.
Validation: 42/42 co-op tests pass; full suite 821/824, with the same three
known unrelated console/status-line failures. Deployed as `b756746`; the live
HTTPS page, CSS/SVG assets, private host-key stripping, guest invite and both
players entering a run passed in two Chromium clients.

## First-play preflight (live)

Small first-session fixes: starting a game disables the button until the request
finishes, times out after 15 seconds, and offers a useful retry after failure.
Ready stays in the lobby while waiting for the other visitor. Once both are
ready, Enter / resume captures the mouse. A native browser warning catches
refreshing or leaving during a run. A brief camcorder indicator shows when you
or your friend is transmitting voice. Clipboard failure selects the invite and
explains how to copy it manually.

`node tools/blockrooms/coop-preflight-check.mjs` uses Chrome's fake microphone
with a generated tone; it never accesses the real microphone. It verifies the
actual AudioWorklet capture, resampling, WebSocket relay and non-silent audio
playback in both directions, with 100ms outbound delay per peer. It also checks
failed creation/retry, repeated Start clicks, clipboard denial, readiness,
mouse capture, the refresh warning and disconnect feedback.

Three-floor (`first-play-preflight`) and five-floor (`first-play-1`) browser
runs escaped with health, batteries and possessions carried across every seam.
Inventory/crafting, mounted lights, fire, trades, revives, doors, shared pirate
attacks and host visibility feedback passed. The first unseeded long check
hit a later-floor loading timeout; reproducible checks passed after disabling
background timer throttling in the test browser, to represent two visible
browsers on separate computers. A separate probe measured sixteen build-style
yields at 9,689ms in a hidden tab versus 46ms visible. Loading messages now
remind both players to keep their tab visible. The original timeout seed was
not retained, so its exact cause is not proven. The harness prints the seed
and transition diagnostics for repeatable investigation.

Co-op tests: 42/42. Full suite: 821/824, same existing console/status-line failures.
Release `69d7c55` is live on Railway. The hosted check passed private-key
stripping, invite joining, two-way generated microphone audio over HTTPS/WSS,
readiness, mouse capture, the reload warning and disconnect feedback. Live
client/voice/page bytes match the commit and `/health` responds 200.
Physical microphones and the London–Argentina connections still need the real
playthrough. Use the private host bookmark to create, send only the resulting
invite, enable voice in both browsers, and keep the host tab visible. A selected
battery + Q (or R) refills the camera; I opens the full inventory/crafting view.

## Try the real rooms

Run `npm run coop`, then open http://127.0.0.1:4488/rooms.
Create a session, open its invite link in a second browser, and click Ready in
both. **The host browser must stay visible.** Two computers work better than two
tabs in one window; switching to the guest tab pauses a hidden host. The guest
gets an explicit pause message and resumes when the host returns.

WASD moves, mouse looks, Shift runs, C crouches and Space jumps. E picks up, operates a door, or interacts with a nearby teammate; 1–6 holds/stows, Q (or R) uses, G drops, F toggles the flashlight. I or Tab opens the production camcorder inventory and its two-ingredient crafting panel. Escape releases the mouse without
pausing a visible host. Enable voice in the menu, then hold V to talk.
Visits now span 3–5 seeded floors. Find each floor’s way down and gather
within three metres to descend together. Both browsers must finish loading
before simulation resumes. On the final floor, lean into the taped wall at the
bottom of the fire stairs; extraction waits for all living visitors.
M toggles game audio independently of voice.
A downed visitor watches their surviving partner and can still be revived.
Select a snack and press E beside them to restore one heart. An empty camera
also consumes one battery from the rescuer and restores 120 seconds of power.
Press B (or the Emotes button) for wave, dance, heart and help signals.
E beside a living teammate requests a trade. They must accept; each player
selects what to offer and both confirm before anything moves. An empty offer
allows gifting. Changing either offer clears both confirmations. Walking away,
death, timeout or cancelling closes the trade without transferring items.
Trade screens do not pause hazards or batteries.

`/` still opens the older fixed-map prototype for comparison. Its simulation
runs on Node; `/rooms` uses the real game modules and a trusted host browser.
These are deliberately separate review modes, not a hidden public-game flag.

## Earlier deployed slice (69d7c55)

- The production generator, room builders, prop catalogue, collision and player
  controller. The production visit planner selects 3–5 themed floors, each
  requesting 20–28 rooms. Plain maze connectors surround an audited feature
  deck: ceiling meeting, coolers, hall of fame and many doors, alternating two
  per floor. Actual generated counts vary. Existing hole, ledge and chute
  entrances lead down; the real taped-wall exit ends the final floor.
- The production pirate **and desk moth**, including their real navigation and
  animation. Each creature ticks once, scoped to its nearest living visitor;
  either visitor's gaze can stop the pirate. For a short review the pirate is
  force-woken near the host after eight simulation seconds.
- Room activity follows both visitors. Room clocks tick once, zone entry/stay/
  leave tracks each visitor separately, and a moving/leaning guest can drive a
  room interaction while the host stands still in that same room.
- Shared mutable node transforms, visibility, tint/opacity, room light levels,
  door links and collider flags. The guest applies authoritative state instead
  of running a second creature simulation. Doors refuse to close on either
  player, including when the pirate operates them.
- Production six-pocket model, item definitions, stack limits, recipes, icons,
  inspection/crafting panel and flashlight grip. Camera/battery, torch/battery,
  tape/torch, prepared torch/camera and paper/lighter recipes are host-owned.
  Paper stacks to ten; one sheet burns for eight seconds. Invalid or stale
  ingredient identities spend nothing. Mounting removes the torch from pockets;
  F still controls it, and its equipment tile accepts replacement batteries.
- Loose flashlights shine and drain only when selected and equipped. Mounted
  lights work with empty hands or another selected item. Both clients see the
  same charge and on/off state. The local production beam and an additional
  partner cone illuminate baked surfaces; the partner cone has no shadow maps.
- Production supply planning with two-player consumables. Battery/snack plans
  are doubled; at least two snacks per floor. The first floor guarantees two
  torches, two tapes, a paper stack and a reusable lighter for alpha testing.
  Room-authored pickups are included. Later tools follow production seed odds.
  One ID has one owner. Partial paper pickup leaves the remainder on the floor.
- Host-placed paper fires and chalk arrows are replicated separately from the
  fixed room-node list. Both clients see the same fire lifetime; the existing
  pirate fire-fear contract makes it back away. Placement must pass production
  clear-floor/dryness checks before paper is spent. Fires/marks stay upstairs.
  Each player starts with four health and 300 seconds of camera power,
  capped at 400; a pack adds 120 seconds and a snack restores one heart.
- A pirate kill downs that visitor, not the whole team. A selected snack can
  revive them at close range with clear line of sight and a short hit cooldown. The
  pirate breaks off and can hunt the survivor rather than getting stuck in its
  single-player final-shot animation. Both dead ends the run; survivors can
  finish together. Results show rooms visited, floors and elapsed time in this
  private page, not the public scores.
- Health, remaining camera time, hit cooldown, both bags and total visit time
  carry between floors. Ground supplies stay behind; new supplies have unique
  floor-prefixed IDs. Downed teammates travel with the group still downed and
  can be revived afterward. No free healing or camera recharge on descent.
- Production soundtrack, mains hum, pirate cue and game sound events. The host
  publishes a bounded event stream; each browser deduplicates it and positions
  world sounds for its listener. M mutes game audio. Loading and host pauses
  pause the sound; a new floor stops the old pirate cue.

## Earlier slice: authority and implementation seams

`real-rooms.js` owns the generated world on the host. The guest sends controls
through the WebSocket relay; the host validates interactions against its real
world, moves both visitors, advances rooms and creatures, and sends snapshots
roughly ten times a simulation second. Snapshot sizes in browser checks were
about 9–12 KB, before WebSocket overhead. This is an unoptimized prototype,
not a WAN performance claim. There is no guest movement prediction yet.

`population.js` provides two-visitor occupancy without changing the normal
single-player world conductor. Room ticks still receive one visitor at a time:
this is adequate for the curated rooms, not a guarantee for every puzzle or
hazard. All room groups are rendered in this slice; visibility optimization is
still needed. A creature's nearest visitor is selected independently of other
creatures. All-player visibility is currently a simple cone plus real LOS.

`pursuer.js` has three optional adapters: `members`, `withVisitor` and
`hasSurvivor`. With no options it keeps the normal seeded cast and single-player
contract. Its `hurt()` result distinguishes a dead visitor from an ended team
run. The pirate respects that distinction. The moth and pirate are the only
cast enabled here; adding a new cast member requires a behavior/visual audit.

`core/coop-real.js` validates bounded snapshots at the relay. Only the first
visitor may publish world state; guest input is sent only to that host. This
is **trusted-friend authority**, not server anti-cheat. A hidden or stalled host
pauses the guest; disconnect ends the session, with no host migration. A late
snapshot cannot resurrect a disconnected run. Protocol version is
`blockrooms-coop-5`; restart the server and reload both clients after updating.

The fixed maze retains `core/coop.js`'s Node-authoritative movement, pirate,
survival and items at 20 Hz. The review HTTP/WebSocket server serves only public
assets and an explicit list of core modules. It does not start the Office daemon.
Random 128-bit invites, matching origin/version, two-client capacity, packet and
buffer bounds, a 64-room cap and one-hour expiry apply to both modes. Restarting
the server loses all sessions. An invite is access to that private room.

## Earlier slice: what was not integrated

No full room deck, remaining creatures, movable furniture, full VHS effects, production scorecard/leaderboard, late
joining, reconnection, saved runs or client movement prediction. Descent uses
a coordinated loading cut, rather than single-player’s seamless two-floor
rendering. This is a complete run structure with a limited content deck, not
feature parity with the full single-player game.

The next useful work is:
1. Explicit per-visitor rules for each additional creature and room hazard.
2. Reliable replicated spawn/remove/reparent events for changing rooms and
   creatures that create new meshes, instead of relying on a fixed node list.
3. Movement prediction, visibility culling and two-network tests.

## Voice and private hosting preparation

Enable voice explicitly, then hold V. Key release, blur, hidden page, disabling
voice, ending the run and disconnect all stop transmission; disabling voice
also stops the microphone track. Partner volume is independent. Both players
must enable voice to initialize playback. Microphone access needs HTTPS or
localhost. No audio is recorded or persisted.

Voice uses the authenticated game WebSocket: 40 ms mono PCM16 packets at 16 kHz,
base64 encoded. No TURN service is needed for this design. It uses roughly
43 KB/s per speaker before overhead; Opus would be more efficient. Packet size,
sequence, rate and playout backlog are bounded. Synthetic-microphone tests
verified both directions and stop behavior in the earlier fixed-maze build.
Real microphones and different internet connections still need testing.

For private hosting, the prepared Dockerfile is
`tools/blockrooms/coop/Dockerfile`, with the repository root as build context.
It starts only this server as a non-root user. Set a random `COOP_ALPHA_KEY` of
at least 24 characters and `COOP_HOST=0.0.0.0`; only the creating host needs the
passcode, and the friend uses the invite. Railway can provide HTTPS and PORT.
The health endpoint is `/health`. A single private Railway service is now deployed; see the deployment notes below.

## Validation

`node --test test/coop*.test.mjs` covers the fixed-map simulation, real sockets,
authority rejection, contested supplies, room occupancy, single room clocks,
guest interaction priority, per-creature targeting, survivor endings, bounded
world snapshots and voice packets. The single-player taken-room and final-shot
checks also pass with the optional conductor adapters.

`node tools/blockrooms/coop-browser-check.mjs` starts its own local server and
two disposable headless Chrome pages, loads actual generated rooms and assets,
and checks shared pirate/moth state, the guest setting the moth flying, guest
movement, a pickup race, a door
blocked by the other visitor, guest door operation, host pause/resume, the guest
opening the real taped wall while the host is distant, an actual pirate kill
of the guest with the host still alive, and the last camera dying. `--escape`
checks the survivor reaching the opened wall instead of camera depletion.
Set `CHROME` if the executable is not at the default macOS Chrome path.
The temporary screenshot is `coop-real-rooms.png` in the system temp directory.
These checks use no microphone or outside network.

The standalone site build still passes and its asset graph excludes co-op.
The full repository suite finished at 819/822 passing, with three counted
failures in the pre-existing console temporary-path and
usage/status-line failures, reproduced previously on unchanged base a155afc.
No real agent runtimes were launched by these checks.

### Revive, emote and trade checks

All 42 co-op unit/socket/audio/inventory tests pass. `social-rules.js` owns consent, offer
revisions, final bag capacity and atomic transfers; the browser cannot directly
assign another player's items. Revive consumes the snack (and, only for a flat
camera, one battery) once. Emotes last three seconds and have a short cooldown.
Downed bodies remain visible with a rescue marker. These additions apply to
`/rooms`; the old fixed-grid comparison mode retains its earlier rules.

`node tools/blockrooms/coop-browser-check.mjs --social` also exercises real
keyboard E/B interaction and mouse controls: recipient acceptance, a changed
offer resetting confirmation, completed exchange, shared wave, and reviving a
flat-camera guest with one heart and restored charge. It verifies scaled
refill supplies. Its trade screenshot is `coop-trade.png` in the system temp
directory. No browser errors were observed. Supply density is an initial
two-person balance and still needs a normal-length human playthrough.

### Multi-floor run checks

`node tools/blockrooms/coop-browser-check.mjs --run` exercises the real descent
triggers through a complete seeded visit, waiting for both browsers on each
floor. It verifies that wounds, camera drain and an owned item survive every
handoff without duplication, then opens the final wall and checks both clients
escape. The harness warps players to entrances to isolate transition behavior;
it is not a normal-length human balance playtest. Default browser checks and
`--social` use `/rooms?slice=1` to retain a one-floor regression case.

Unit/socket checks cover stale commands and snapshots, duplicate readiness,
carry rules and a partner disconnecting during loading. TCP half-close is
handled immediately so loading does not wait for a nonexistent peer. The
loading barrier times out after 90 seconds. No automatic reconnect is provided.

Browser checks completed both a three-floor and a four-floor run (chute, hole
and ledge entrances), with both clients reaching the final escape. Audio unit
coverage also checks snapshot deduplication, listener-relative pan/attenuation,
private sound targeting and rejecting old-floor sounds after a transition.

### Production inventory checks

`node tools/blockrooms/coop-browser-check.mjs --inventory` operates the guest's
actual camcorder buttons and F key over two sockets. It checks loose-light
selection/drain, tape preparation and mounting, camera/equipment recharging,
a three-sheet 24-second fire, replicated disappearance, and the actual pirate
entering its fire-fear state. `--social` still passes trades, revives and emotes.
`--run` now carries a mounted flashlight alongside the existing survival/item
checks. Unit tests also exercise stale recipes, partial stacks at full capacity,
failed fire placement, gear trade metadata and invalid inventory snapshots.
55 production inventory/crafting/controller tests pass unchanged.

### Private Railway deployment

`node tools/blockrooms/package-coop.mjs /absolute/new/output-folder` copies only
tracked core/public files, the isolated server and its package metadata. It
excludes knowledge/transcripts, Office data and untracked local files. The
artifact has a root Dockerfile and Railway config: one replica, `/health` check,
no database, no Office daemon. The Docker image defaults `/` to `/rooms`.
Set a fresh `COOP_ALPHA_KEY` of at least 24 characters before starting it.

A private host bookmark can be `https://<host>/rooms#host=<creator-key>`. The
browser stores that key for its tab session and strips the fragment before
constructing invite links. Never send the host bookmark to a guest. The guest
only opens `/rooms?room=<random-session-id>`, clicks Ready, and optionally enables
voice. Both still need the host tab visible. Railway project/service: `blockrooms-coop`. Deployed from the explicit artifact
using game commit `69d7c55`, with one replica and US East configured in the
artifact’s Railway config. The creator key lives only in Railway variables and
the owner’s private local credential file; it is not committed. Hosted HTTPS/WSS
checks passed two-client joining, production crafting, mounted lights, shared
fire and synthetic voice packets in both directions. The hosted test allows
network round-trip time instead of the local test’s shorter fixed waits. International
latency and real microphones still need a London–Argentina playtest.
