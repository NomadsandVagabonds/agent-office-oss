# Two tapes: private two-player prototype

Branch: `codex/backrooms-coop`, based on development `a155afc`.
Nothing on this branch has been deployed or connected to the public game.

## Try the real rooms

Run `npm run coop`, then open http://127.0.0.1:4488/rooms.
Create a session, open its invite link in a second browser, and click Ready in
both. **The host browser must stay visible.** Two computers work better than two
tabs in one window; switching to the guest tab pauses a hidden host. The guest
gets an explicit pause message and resumes when the host returns.

WASD moves, mouse looks, Shift runs, C crouches and Space jumps. E picks up, operates a door, or interacts with a nearby teammate; 1–6 selects, R uses, G drops. Escape releases the mouse without
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

## Real-room integration now implemented

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
- Twelve shared supplies per floor for two visitors: six batteries and six snacks, twice
  the six-item solo budget. They are spread across clear floor in ordinary rooms.
  One ID, one owner: simultaneous claims cannot duplicate a pickup. Drop/use
  and the six-slot bags use the prototype inventory rather than production
  crafting. Each player has four health and 300 seconds of camera power,
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

## Authority and implementation seams

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
`blockrooms-coop-4`; restart the server and reload both clients after updating.

The fixed maze retains `core/coop.js`'s Node-authoritative movement, pirate,
survival and items at 20 Hz. The review HTTP/WebSocket server serves only public
assets and an explicit list of core modules. It does not start the Office daemon.
Random 128-bit invites, matching origin/version, two-client capacity, packet and
buffer bounds, a 64-room cap and one-hour expiry apply to both modes. Restarting
the server loses all sessions. An invite is access to that private room.

## Not integrated yet

No full room deck, remaining creatures, production inventory/crafting/fire,
movable furniture, full VHS effects, production scorecard/leaderboard, late
joining, reconnection, saved runs or client movement prediction. Descent uses
a coordinated loading cut, rather than single-player’s seamless two-floor
rendering. This is a complete run structure with a limited content deck, not
feature parity with the full single-player game.

The next useful work is:
1. Production inventory IDs, crafting/fire and supplies under host authority.
2. Explicit per-visitor rules for each additional creature and room hazard.
3. Reliable replicated spawn/remove/reparent events for changing rooms and
   creatures that create new meshes, instead of relying on a fixed node list.
4. Movement prediction, visibility culling and two-network tests.

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
The health endpoint is `/health`. No infrastructure has been provisioned.

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
The full repository suite finished at 811/814 passing, with three counted
failures in the pre-existing console temporary-path and
usage/status-line failures, reproduced previously on unchanged base a155afc.
No real agent runtimes were launched by these checks.

### Revive, emote and trade checks

All 33 co-op unit/socket/audio tests pass. `social-rules.js` owns consent, offer
revisions, final bag capacity and atomic transfers; the browser cannot directly
assign another player's items. Revive consumes the snack (and, only for a flat
camera, one battery) once. Emotes last three seconds and have a short cooldown.
Downed bodies remain visible with a rescue marker. These additions apply to
`/rooms`; the old fixed-grid comparison mode retains its earlier rules.

`node tools/blockrooms/coop-browser-check.mjs --social` also exercises real
keyboard E/B interaction and mouse controls: recipient acceptance, a changed
offer resetting confirmation, completed exchange, shared wave, and reviving a
flat-camera guest with one heart and restored charge. It verifies twelve
spawned supplies. Its trade screenshot is `coop-trade.png` in the system temp
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
