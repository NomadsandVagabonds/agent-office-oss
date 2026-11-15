# Two tapes: two-player review prototype

Branch: `codex/backrooms-coop`, based on development `a155afc`.

Run `npm run coop`, then open http://127.0.0.1:4488/ in two tabs or browsers.
Create a session in the first, copy its invite link into the second, and click
Ready in both. Click Ready/resume again to capture the mouse after switching tabs.
WASD moves, Shift runs, E picks up, 1–6 selects, R uses, G drops. Escape releases
the mouse; the simulation continues. At the green doorway, both living visitors
must gather before E ends the run. A dead visitor watches the survivor.

The default listener is loopback. For a trusted LAN review, run
`COOP_HOST=0.0.0.0 npm run coop` and open the host's LAN address on both computers
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
  writes. No doors, movable furniture, crafting, voice, floor changes, late joins,
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
tile in a continuous simulation test. All 11 co-op tests pass.
The regular standalone build still passes. The full repository suite has existing
console temporary-path and usage/status-line failures; the same failing areas
were reproduced on unchanged base a155afc. No real agent runtimes were launched.
