# Two tapes: two-player review prototype

Branch: `codex/backrooms-coop`, based on development `a155afc`.

Run `npm run coop`, then open http://127.0.0.1:4488/ in two tabs or browsers.
Create a session in the first, copy its invite link into the second, and click
Ready in both. Click Ready/resume again to capture the mouse after switching tabs.
WASD moves, Shift runs, E picks up, 1–6 selects, R uses, G drops. Escape releases
the mouse; the simulation continues. At the green doorway, both living visitors
must gather before E ends the run. A dead visitor watches the survivor.

The default listener is loopback. For a trusted LAN review, run
`COOP_HOST=0.0.0.0 COOP_ALPHA_KEY=<24-or-more-character-private-key> npm run coop` and open the host's LAN address on both computers
before copying the invite. Mouse capture requires a browser that supports it;
clipboard copying may be unavailable over LAN HTTP, so the link is selectable.
No Railway/Vercel resources are provisioned. This is not a public deployment.

## Scope and design

- One fixed office-maze floor, two visitors, one pirate, five shared supplies.
- Real Office avatar rigs, Backrooms wallpaper/carpet/ceiling materials, existing
  pirate model and inventory models. Transparent camcorder overlay and six slots.
- Node owns movement, collision, pirate AI, damage, batteries, bags and pickups.
  Clients send bounded movement inputs and interaction requests, never positions
  or health. Simulation and snapshots run at 20 Hz. Both views interpolate state;
  camera rotation is immediate. No client movement prediction yet: WAN input lag
  is an explicit next experiment, not a solved problem.
- Each visitor has four health and 300 seconds of camera power (400-second cap).
  A battery adds 120 seconds; a snack heals one. Items consume one of six slots.
  Drop and pickup transfer the same item ID; a contested pickup has one winner.
- Pirate stands still if either living visitor looks toward it with clear line of
  sight. After eight seconds it routes around walls toward the nearest living
  visitor and takes two health at close range, with a three-second hit cooldown.
  Its visual model is reused; its test AI is deliberately simpler than the main
  game's hunt/memory/crawl/door/fire system. It knows target positions, even behind
  walls, but cannot move or attack through walls. No other creatures are enabled.
- One death does not end the team run. Camera depletion also kills that visitor.
  Both dead ends the session; survivors can leave together. No solo leaderboard
  writes. No doors, movable furniture, crafting, floor changes, late joins,
  reconnection, account system or saved runs in this slice.

## Integration boundaries

`core/coop.js` is the pure shared map, state and simulation. The server imports it;
clients reuse map and line-of-sight for presentation only. `VERSION` pins the
protocol and layout; change it when these are incompatible.

`tools/blockrooms/coop-server.mjs` is a dedicated HTTP/WebSocket review server.
It borrows only the Office's tested WebSocket framing, not its daemon or API.
It serves public assets plus the explicitly allowed core modules. Sessions use
random 128-bit invite tokens, accept two sockets, require matching origin and
version, cap messages/payload/buffers, expire after an hour, and cap stored rooms
at 64. Empty waiting sessions remain until expiry. Disconnect during play ends
that session explicitly. A server restart loses all sessions.

`public/world/coop/` is a separate developer entry point. The normal site builder
uses an explicit asset graph and does not include it. There is no live-site menu
or flag to accidentally turn it on. The only change to existing gameplay code
is exporting `makePirate` so the prototype can reuse its model. Single-player
logic is unchanged.

Before public hosting: exercise latency/loss and malicious-message load, add
room creation rate limiting, reconnect snapshots, client prediction/reconciliation,
TLS and operating limits. Before full-game integration: adapt the generated
world's collision and room occupancy, the cast targeting contract, per-player
survival and joint descent. Do not replace the current room conductor with this
fixed-map simulation.

## Validation

`node --test test/coop.test.mjs test/coop-server.test.mjs`: simulation and real
WebSocket tests cover readiness/capacity, version/origin rejection, pickup race,
item transfer, range/capacity, bounded/stale input, gaze, walls, pathfinding,
per-player damage, survival, exit and disconnect.

Two headless Chrome tabs check asset loading, lobby, readiness, movement, a
contested pickup with the same owner on both clients, and the rendered HUD;
no browser errors were recorded. The pirate can physically reach every open
tile in a continuous simulation test. All 13 co-op/voice tests pass.
The regular standalone build still passes. The full repository suite has existing
console temporary-path and usage/status-line failures; the same failing areas
were reproduced on unchanged base a155afc. No real agent runtimes were launched.


## Voice and private hosting preparation

Enable voice explicitly in the lobby/menu, then hold V to transmit. Releasing V,
blurring the tab, hiding the page, disabling voice, disconnecting, or ending the
run stops transmission. Disable voice also stops the microphone track. Partner
volume is independent of game audio. Both sides enable voice to initialize audio
playback. Microphone access requires HTTPS or localhost.

For this two-friend prototype, voice uses the authenticated game WebSocket rather
than WebRTC: 40 ms mono PCM packets at 16 kHz, 16-bit, base64 encoded. Thus no TURN
provider or peer-to-peer NAT traversal is required. This is deliberately less
bandwidth-efficient than Opus: roughly 43 KB/s per transmitting visitor before
protocol overhead. It needs WAN latency testing; it is not a production voice
architecture. The server forwards bounded packets only to the other room member,
rejects stale sequences and oversized/malformed packets, and limits packet rate.
There is no audio recording or persistence. Browser playout backlog is bounded.

Synthetic-microphone Chrome checks verified 25 received and scheduled audio
packets during a one-second transmission, reverse-direction audio, key-release
stop, blur stop, and disable. No browser errors occurred. This does not establish
real-microphone quality or performance between two internet connections.

The dedicated Dockerfile is `tools/blockrooms/coop/Dockerfile`, built from the
repository root. It launches only the review server as a non-root user, without
the Office daemon. Set `COOP_ALPHA_KEY` to a random private value (at least 24
characters). A public listener refuses to start without that key. Only the host
needs it to create a session; the invited friend uses the random room link.
Railway can assign HTTPS and PORT. Health endpoint: `/health`. No deployment or
account changes have been made. This container still serves the **test maze**.

## Full-game migration: not implemented

The full-game conductor is `backrooms/index.js`, not this prototype's client.
Its floor generator can be reused, but sending a seed alone is insufficient.
`world.js` currently has one current room, one zone occupancy bit, and simulation
activity follows local visibility. `pursuer.js` targets `env.player`; damage,
item consumption and camera drain implicitly use that same visitor. Many room
scripts also read `env.player` directly. Connected-floor disposal and endings
are whole-visit operations.

The next integration needs, in order:
1. Per-player world occupancy and explicit visitor IDs on interaction/damage.
2. One authority for existing creature and mutable-room state, with snapshots.
3. Existing item IDs claimed through authority, including drops/crafting/fire.
4. Team readiness for floor transitions, per-player death, and team endings.
5. Two-browser room-by-room validation under latency and disconnects.

Do not advertise the full room catalogue as co-op until these are wired and
verified. This branch's current multiplayer gameplay remains the fixed floor.
