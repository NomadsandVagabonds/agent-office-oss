# Two tapes: private two-player prototype

Branch: `codex/backrooms-coop`, based on development `a155afc`.
Nothing on this branch has been deployed or connected to the public game.

## Try the real rooms

Run `npm run coop`, then open http://127.0.0.1:4488/rooms.
Create a session, open its invite link in a second browser, and click Ready in
both. **The host browser must stay visible.** Two computers work better than two
tabs in one window; switching to the guest tab pauses a hidden host. The guest
gets an explicit pause message and resumes when the host returns.

WASD moves, mouse looks, Shift runs, C crouches and Space jumps. E picks up or
operates a door; 1–6 selects, R uses, G drops. Escape releases the mouse without
pausing a visible host. Enable voice in the menu, then hold V to talk.
At the bottom of the fire stairs, lean into the taped wall. Once somebody has
opened it, it waits for all living visitors to gather within three metres.
A dead visitor watches their surviving partner.

`/` still opens the older fixed-map prototype for comparison. Its simulation
runs on Node; `/rooms` uses the real game modules and a trusted host browser.
These are deliberately separate review modes, not a hidden public-game flag.

## Real-room integration now implemented

- The production generator, room builders, prop catalogue, collision and player
  controller. The seed requests 18 rooms, with plain maze connectors and a
  curated feature deck: ceiling meeting, coolers and hall of fame. The actual
  generated room count can vary. Existing stairs, geometry, doors and the real
  taped-wall exit are used.
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
- Six shared battery/snack supplies placed on clear floor in ordinary rooms.
  One ID, one owner: simultaneous claims cannot duplicate a pickup. Drop/use
  and the six-slot bags use the prototype inventory rather than production
  crafting. Each player has four health and 300 seconds of camera power,
  capped at 400; a pack adds 120 seconds and a snack restores one heart.
- A pirate kill costs that visitor their tape, not the whole team's run. The
  pirate breaks off and can hunt the survivor rather than getting stuck in its
  single-player final-shot animation. Both dead ends the run; survivors can
  finish together. Results stay in this private page, not the public scores.

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
`blockrooms-coop-2`; restart the server and reload both clients after updating.

The fixed maze retains `core/coop.js`'s Node-authoritative movement, pirate,
survival and items at 20 Hz. The review HTTP/WebSocket server serves only public
assets and an explicit list of core modules. It does not start the Office daemon.
Random 128-bit invites, matching origin/version, two-client capacity, packet and
buffer bounds, a 64-room cap and one-hour expiry apply to both modes. Restarting
the server loses all sessions. An invite is access to that private room.

## Not integrated yet

No connected-floor descent, full room deck, remaining creatures, production
inventory/crafting/fire, movable furniture, production sound/VHS effects,
scorecard/leaderboard, late joining, reconnection, saved runs or client movement
prediction. Voice is available, but game sound is stubbed in real-room mode.
This is a real-room multiplayer slice, not the full game in co-op.

The next useful work is:
1. Shared floor-transition readiness, health/bags carried across floors, and
   disposing/rebuilding both worlds together.
2. Production inventory IDs, crafting/fire and supplies under host authority.
3. Explicit per-visitor rules for each additional creature and room hazard.
4. Reliable replicated spawn/remove/reparent events for changing rooms and
   creatures that create new meshes, instead of relying on a fixed node list.
5. Sound events, movement prediction, visibility culling and two-network tests.

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
The full repository suite finished at 799/802 passing, with three counted
failures in the pre-existing console temporary-path and
usage/status-line failures, reproduced previously on unchanged base a155afc.
No real agent runtimes were launched by these checks.
