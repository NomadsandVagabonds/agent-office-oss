# BlockRooms on Steam: the plan, by department

For the team. It brings together what the owner settled on 19 Nov 2026, and splits the work into departments so
that several agents can work at once without editing each other's files.

**Status:** a plan. Nothing in it is built yet. The decisions marked **(owner)** are open.

How to read it:
- Every department has a list of files it **owns**. Only that department edits them.
- Every task has an ID, the department that does it, and a **done when**.
- Where two departments meet, a **contract** (section 3) says what passes between them. Build to the
  contract, not to the other department's insides.

Related plans:
- [BACKROOMS-DAILY-PLAN.md](BACKROOMS-DAILY-PLAN.md): the daily tape.
- [BACKROOMS-MODES-ROADMAP.md](BACKROOMS-MODES-ROADMAP.md): modes for several players.
- [BACKROOMS-GRAPHICS.md](BACKROOMS-GRAPHICS.md): the look, with its phases; the rendering department continues it.
- [BLOCKROOMS.md](BLOCKROOMS.md): the standalone site.
- [BLOCKROOMS-FAIR-PLAY.md](BLOCKROOMS-FAIR-PLAY.md): fair play.
- [BACKROOMS-COOP.md](BACKROOMS-COOP.md): co-op.

---

## 1. What is decided

1. **A light web wrapper, not a port.**
   - The game stays one codebase: three.js, no build step, zero npm dependencies in the game.
   - The Steam build is the site build (`node tools/blockrooms/build.mjs <folder>`) in an Electron shell.
   - Electron, not Tauri: one fixed Chromium on every machine.
2. **Early access first.**
   - The store page goes up early, to gather wishlists.
   - The daily tape is what brings people back.
3. **The brand is BlockRooms.**
   - "Backrooms" stays out of the title and the store tags unless the trademark search says otherwise.
   - The Scranton prank belongs to the Agent Office, not BlockRooms, and does not ship.
4. **Richer, not sharper.**
   - The camcorder stays the look, and the tape keeps about 540 lines.
   - The Steam build adds a richer scene under the tape: light, wear, the camcorder's optics. It is voxel
     and found footage, never a Minecraft knockoff.
5. **Measure before optimizing.** The heaviest floors are profiled before any rendering rework, and before
   WebGPU.
6. **The first floor has to be stunning.** The owner: *"We will have only a couple minutes to grip a new
   player so our first floor has to be stunning if we ever want them to see suburbia or water park later on
   in the game."*
   - A department of its own does nothing else (D12).
   - It is the first thing on the store page, and the first two minutes of every new player's first visit.

---

## 2. Departments

Each department below gives its job, who takes it, what it owns, what it must not touch, and its tasks. The
sessions named are today's. **(lead)** can deal any department to a new agent.

**Shared hub files.** These have one owner each. Everybody else asks that owner, through the lead or
directly:

| File | Owner |
|---|---|
| `public/world/backrooms/index.js` | Lead |
| `public/world/backrooms/world.js` | Lead |
| `public/world/backrooms/pursuer.js` | Cast |
| `public/world/backrooms/hand.js` | Animation |
| `public/world/backrooms/input.js` | Input |
| `public/world/backrooms/sound.js` | Lead |
| `tools/blockrooms/build.mjs` | Online |

### D0 · Lead and integration

**Who:** the lead session.

**Job:** merging, the edition, the order of work, and the contracts between departments.

**Owns:**
- `blockrooms-live`;
- the hub files above that are marked Lead;
- `docs/AUDIT-LOG.md`, which everybody writes a row in, and the lead keeps in order.

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| L-1 | Deal every department below to a session, and post this table with names filled in | each department has a named session, and that session has acknowledged its scope |
| L-2 | Add the game-side hooks the contracts need to `index.js`: `env.platform` (C1); input actions passed through (C4) | the hooks are on live, with web no-ops and test stand-ins; the suite is green |
| L-3 | Keep the milestone board (section 4) and gate each milestone | each milestone is closed by a written check against its exit criteria |
| L-4 | Edition discipline: merges that change the edition land after midnight UTC once the daily is live (daily plan, section 1) | written in the merge checklist |

### D1 · Platform and shell

**Who:** a new agent.

**Job:** the Steam build, which is the Electron app, packaging, Steamworks, updates and offline play.

**Owns (new):**
- `tools/steam/`: the Electron main, preload, packaging script, Steamworks bridge and build configs;
- `public/world/backrooms/platform.js`: the game's side of contract C1.

**Must not touch:** anything else in `public/` (ask through C1), `tools/blockrooms/` (ask Online).

**Note on dependencies:** the shell needs Electron and a Steamworks binding (steamworks.js, the usual one).
These are dependencies of the *shell*, in `tools/steam/package.json`, never of the game. **(owner)** Confirm
that this is acceptable under the zero-npm rule.

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| P-1 | Spike: Electron loads the site build from disk and plays a visit start to finish | a visit can be played to its end in the shell on Windows, Mac and Linux; it has a frame rate counter |
| P-2 | Packaging: one script makes a Steam depot for each OS from a clean checkout | `tools/steam/package.mjs` makes the three builds reproducibly; the file sizes are written down |
| P-3 | `platform.js` (C1): `kind`, `online()`, `achieve`, `stat`, `cloud`, `user`, as no-ops on the web | the web build behaves exactly as before (suite green), and the shell supplies the real ones |
| P-4 | Steamworks: overlay, achievements (C2), Steam Cloud for the archive | an achievement unlocks in a test app ID, and a save made on one machine appears on another |
| P-5 | Offline: what needs the network says so and stands aside | with the network cut, a full visit plays, and the book and daily show "offline" without errors |
| P-6 | Window, fullscreen, pointer lock and frame cap behave; the GPU switch prefers the discrete GPU | checked on a laptop with two GPUs; no throttling when the window is unfocused-then-refocused |
| P-7 | Updates: the Steam branch layout (default, beta) and the version shown in game | a beta branch build is installable and shows its version |
| P-8 | Steam Inventory Service: item definitions for lost property ([daily plan, section 8](BACKROOMS-DAILY-PLAN.md)), granted to the player when the server says so (S-6); shown in game through `platform` (C1 grows `inventory()`) | a lost-property item given on the test app ID appears in that Steam inventory, not tradeable unless the owner says |

### D2 · Input and controls

**Who:** the gameplay session (it owns `input.js` today).

**Job:** every way of playing: mouse and keyboard, touch, gamepad and the Steam Deck. The other departments
consume named actions (C4), never raw keys.

**Owns:**
- `public/world/backrooms/input.js`;
- the touch thumbs in the HUD (`hud.thumbs`);
- the controls part of the settings menu.

**Must not touch:** what an action *does*: that belongs to its owner (shove: gameplay; spray and smash:
cast; and so on).

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| I-1 | Named actions (C4): move, look, run, crouch, use, light, fire/click, smash/alt, menu, pocket 1–6, next/prev pocket | every existing binding goes through an action, and the suite is green |
| I-2 | Gamepad (standard mapping): sticks, triggers (fire and smash), bumpers (pockets), face buttons | a full visit plays on a pad with no keyboard; there is a test with a stubbed `navigator.getGamepads` |
| I-3 | Look feel on a stick: a dead zone, an acceleration curve, invert Y, sensitivity | written defaults, and in the settings |
| I-4 | Rebinding, keyboard and pad, stored with the settings | it survives a restart, and the defaults can be restored |
| I-5 | Touch: a smash button with the extinguisher held (today phones have no smash) | a smash plays on a phone-size page |
| I-6 | Steam Deck input template (Steam Input) | the Deck's default layout plays a visit with no fiddling |

### D3 · Rendering and look

**Who:** the builder session, or a new graphics agent. It continues
[BACKROOMS-GRAPHICS.md](BACKROOMS-GRAPHICS.md), which is this department's own plan, with its phases.

**Job:** the scene under the tape: light, materials, the tiers, Ultra, and later WebGPU.

**Owns:**
- `graphics.js`, `kit.js` (surfaces), `glow.js`, `beam-shadows*.js`, the shadow map and doorway light, `liquid*.js`;
- `docs/BACKROOMS-GRAPHICS.md`.

**Must not touch:**
- `vhs.js`, which is the tape and its optics (D4);
- the room builders, which are the dressing (D5);
- the cast's models.

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| R-1 | The default tier by platform: High (or Auto from High) when `platform.kind === 'steam'`; the web unchanged | the shell starts at the Steam default; the web still starts at Classic; there are tests |
| R-2 | Side-by-side shots: the same five rooms at Classic, Medium and High, for the owner to agree the look | a sheet of shots in `docs/`, with the owner's notes |
| R-3 | The Ultra tier: about 3× supersample under the tape, screen-space ambient occlusion, light shafts through doorways and dust, more fittings casting shadows, sharper light maps | Ultra is in `graphics.js`, and its cost is measured by D9 against the budget (C8) |
| R-4 | Phase 2 of the graphics plan, "light that behaves", for the Steam build | per that plan's own phase notes |
| R-5 | Later: materials to TSL (three.js node shading), `kit.js` first, with shots matched, then the rest; the WebGPU renderer in the shell, the WebGL fallback on the web | every material renders the same within a tolerance in both renderers, and the frame time is measured on both |

### D4 · Camcorder: the tape and its optics

**Who:** a new agent.

**Job:** what makes it found footage. The tape (lines, wobble, noise, interference) is already here; the
lens and the camera's electronics are new.

**Owns:**
- `vhs.js`;
- the camcorder's HUD (the timestamp, REC, the battery);
- the optics contract (C5).

**Must not touch:** the scene's light and materials (D3).

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| O-1 | Auto-exposure that lags: a dark room into a lit one blooms, then settles, and the other way | seen on a walk between rooms; tunable; off at Classic |
| O-2 | White balance under the tubes: a slow drift green, corrected by "the camera" over seconds | seen in long rooms of tubes; subtle |
| O-3 | Focus hunting: something close (a creature, a held item raised) pulls focus, and it breathes | `optics.event('focus', k)` from C5 drives it |
| O-4 | Bright-light smear: the vertical streak old camcorders draw from a bare tube | seen when looking at a tube |
| O-5 | Lens: vignetting and a little barrel distortion, tied to the Picture level | Clean has none, Full VHS the most |
| O-6 | Events: a hit, a creature close, a fall, each with its own short optical response, through C5 | the cast and gameplay call C5; nothing in `vhs.js` knows about creatures |

### D5 · Set dressing and wear

**Who:** the builder session.

**Job:** that the place looks used. Grime, scuffs, stains, carpet worn into paths, water damage, dust in
the light, and better silhouettes where the eye lands.

**Owns:**
- the room builders (`rooms/*`);
- the non-cast models (`*.model.js`, not `cast/`);
- new: `wear.js` (decals and vertex-colour wear) and `motes.js` (dust in light).

**Must not touch:** the surface shader (D3; ask for what it needs through the lead), and the cast.

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| W-1 | Wear as data: a seeded, per-room wear pass (grime at the base of walls, scuffs at doors, stains under fittings, worn paths between doors) | the same seed gives the same wear; it can be switched off below Medium |
| W-2 | Dust in the light: motes in tube light and in the torch's beam | seen at Medium and above; costs measured by D9 |
| W-3 | Silhouettes: a list of the ten most-seen props, and bevelled or sculpted versions of each | each one shown before and after, and agreed by the lead |
| W-4 | A pass over the starting floors with all of it, for the store shots | the shots in M2 are taken there |

### D6 · Cast and creatures

**Who:** the cast session; with animation for the rigs, hands and held things.

**Job:**
- the creatures;
- their side of every contract: achievement IDs for the cast (C2), optics events from creatures (C5);
- the guarantee that nothing in the cast senses a ghost.

**Owns:**
- `cast/*` (rules, creatures);
- `pursuer.js`;
- `extinguisher*.js`, `spray.js`, `resident.js`.

Animation owns `cast/*.rig.js`, the cast's `*.model.js`, and `hand*.js`.

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| C-1 | Achievement IDs for the cast (C2): met, got away from, and one telling feat each (for example, "put a middle manager off its meeting") | the list is in C2, each ID raised by `env.platform.achieve` where it happens (a no-op on the web) |
| C-2 | Optics events (C5) from creatures: close, charging, a hit | called; harmless before D4's work lands |
| C-3 | Ghosts are not seen: a test that no creature's senses (sight, `sees`, hearing, doorways, targets) include a ghost | the test is in the suite, and it runs against D8's ghost module stand-in |
| C-4 | Gamepad feel for the cast's own actions (spray held on a trigger, smash on the other) with D2 | played on a pad |

### D7 · Online services

**Who:** the session that built fair play and the book (the site's owner).

**Job:** everything on a server: the book, tickets, routes, the daily's seed and board, kept trails, cloud
saves.

**Owns:**
- `tools/blockrooms/book-*.mjs`, `visit-*.mjs`, `cloudflare/`, `account-config.mjs`, `archive-*`;
- `core/book.mjs`, `core/trail.mjs`;
- the API docs.

**Must not touch:** the game, the front page's look (D8).

**Tasks** (these are the daily plan's server steps):

| ID | Task | Done when |
|---|---|---|
| S-1 | Today's seed from the server: `HMAC(secret, date)`, a day number, the edition pinned on the ticket (C6) | `POST /api/book { do: 'in', daily: true }` returns the day's seed, number and edition; there are tests |
| S-2 | The daily board: every take signed (getting out or not), one ranked take per account or browser, place and percentile | the endpoints in C6, a D1 migration, rate limits; there are tests |
| S-3 | Trails kept: the day's top twenty, your best, and those either side of you | `GET /api/book/trail?id=`; storage sized and capped |
| S-4 | Steam identity: accept a Steam session ticket as the account, if the owner says yes **(owner)** | a Steam player's daily takes are theirs across machines |
| S-5 | Load: the Free-plan limits (BLOCKROOMS-STORE.md) checked against a launch-day guess | written; the plan agreed with the owner before launch |
| S-6 | Lost property (daily plan, section 8): the day's one-of-one placed by the seed, given to the first who carries it out (route checked; flagged runs looked at by a person first), kept with the account, granted on Steam through P-8 | issued once and only once a day, kept, listed; there are tests |

### D8 · Daily and meta (the client)

**Who:** a new agent, working with D7.

**Job:** what a player sees of the daily and of their progress: the front page's daily, the scorecard's
place and share card, streaks, past days, and ghosts in play.

**Owns:**
- `tools/blockrooms/home.js` / `home.html` / `home.css`;
- `tools/blockrooms/site.js`;
- `public/world/backrooms/scorecard.js`;
- new: `public/world/backrooms/ghost.js`.

**Must not touch:** the server (D7), the creatures (D6), the tape (D4).

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| D-1 | The front page: today's tape, the day number, yesterday's winner, your streak | it plays from the front page; offline it says so |
| D-2 | The scorecard: place, percentile, the runs either side of yours, the top ten | it appears after the ranked take only |
| D-3 | The share card (no seed in it), copied with one click | the text matches the daily plan's sample |
| D-4 | Past days: playable, unranked, from a list | any day since launch plays as it was (its edition) |
| D-5 | `ghost.js`: a trail played back as tape ghosting (a doubled, smeared figure), untouchable, up to three at once, hidden during the ranked take | C-3's test passes against it; seen in play |

### D9 · Performance

**Who:** a new agent.

**Job:** knowing where each frame goes, setting the budgets, and holding everyone to them. This department
reads everything and changes only its own tools. It hands findings to the owning department.

**Owns:**
- `public/world/dev/perf.js`, `perf-stats.js`;
- benchmark scripts;
- `docs/BLOCKROOMS-PERF.md` (new);
- the budgets (C8).

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| F-1 | Profile the five heaviest floors with `/play?debug&bench=1`: time per frame split into JavaScript (the game's update), draw calls, GPU, at each tier | a table in `BLOCKROOMS-PERF.md`, with the top ten costs named by file |
| F-2 | The budgets (C8): a frame-time target for each tier on three hardware classes (Deck, mid laptop, desktop) | agreed with the lead and the owner |
| F-3 | A benchmark that runs in CI on the software renderer, as a regression alarm (not an absolute measure) | a red result when a merge adds more than X% to a fixed scene |
| F-4 | Findings to their owners: each costly item filed to its department, with the measurement | each one acknowledged by its owner |
| F-5 | Later: WebGPU against WebGL in the shell, scene for scene, to decide R-5's order | a table; the decision written down |

### D10 · Store, marketing and trailer

**Who:** a new agent, with the owner.

**Job:** the store page, its art, the trailer and the text.

**Owns (new):**
- `docs/BLOCKROOMS-STORE-PAGE.md` (the copy, the tags, the early-access answers as drafts);
- `tools/steam/store/` (capsule art sources, exports);
- the trailer scripts.

**Must not touch:** the game. Shots are taken from builds, not by changing rooms (ask D5 for a dressed floor).

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| M-1 | Capsule art in every size Valve asks for, from in-game renders with the logo | all sizes exported and checked against Valve's current list |
| M-2 | Screenshots: about ten, at High or Ultra, from W-4's dressed floors | chosen by the owner |
| M-3 | A trailer of 60–90 s, filmed from real play a frame at a time, cut to music the project owns. A frame-stepping rig (Playwright on a stepped clock) was used in the cast session's scratch for this; bring it into `tools/steam/store/` first | approved by the owner |
| M-4 | Store text: a short and a long description that sell the camcorder, the daily and creatures with rules you can learn; tags | approved by the owner, and checked by D11 for names |
| M-5 | Drafts of the early access answers (why, how long, what changes, price during and after) **(owner)** | the owner has filled them in |

### D11 · QA, release and compliance

**Who:** a new agent; the trademark search is the owner's, with a lawyer.

**Job:** that what ships works, on every target, and contains nothing it should not.

**Owns:**
- `docs/BLOCKROOMS-RELEASE.md` (new): the test matrix, the release checklist, the sweep's findings.

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| Q-1 | The names-and-likenesses sweep (read-only): every room, creature, item, string, image and alt text against the community wiki's entity and level names and well-known designs | a list with file and line; fixes dealt by the lead to the owners. Known already: "partygoers" in `tools/blockrooms/home.html`'s alt text; check the look of the figure in `smiler-maze` |
| Q-2 | Trademark search and a lawyer's read: "Backrooms", "The Backrooms", "BlockRooms", in the game classes **(owner)** | a written answer |
| Q-3 | The test matrix: Windows, Mac and Linux builds; Steam Deck; a laptop with two GPUs; offline; a slow network | each cell played to the end of a visit, and the results written down |
| Q-4 | The release checklist: version, edition, branch, achievements registered, cloud, store page, crash reporting **(owner: what crash reporting, if any)** | used for M3 and M4 |
| Q-5 | Deck: aim for "Playable" or better under Valve's review criteria | self-checked against Valve's list before submitting |

### D12 · The first floor

**Who:** a new team: a lead designer agent, a brainstorming agent and builder agents, working with the
builder session (D5), which owns the shared dressing systems.

**Job:** the first floor, every time, for a player who has never seen the game. Its rooms, its plain rooms
between, the landing, and the first two minutes. **(owner)** It is the department the store page and every
first visit depend on.

**Owns:**
- **The brief:** `docs/BLOCKROOMS-FIRST-FLOOR.md` (new): what the first floor is for, the first two minutes
  second by second, the audit, the list of what is being built.
- **New rooms it writes for the first floor:** new files in `rooms/`. Their deck lines are added with D5,
  which keeps the deck.
- **The polish of the existing rooms at home on the yellow floor:** 40 of the deck's 97 today (`themes.js`
  `atHome(room, 'yellow')`). Each one is done with that room's author.

**Must not touch:**
- **Other floors' rooms.**
- **The shared systems:** wear and motes (D5), the surface shader (D3), the tape (D4). Ask for what is needed.
- **How the first floor is dealt** (`plan.js`): the lead's, through C9.

**The reference board, and the rule on it:**
- **What goes on it:**
  - the films and series about the place;
  - pictures from the internet;
  - real empty offices.
  The board is gathered so the team knows the mood exactly.
- **This repository is open source. Nothing on the board is committed to it:** no film frames and no found
  pictures, not even as reference. The board is kept privately, outside the repository.
  - What comes into the repository is written notes in our own words: *"a hall too long for its width, lit
    only at the far end; the carpet seam runs dead straight to it"*.
- **Inspired by, never copied.** No room recognizable from a film, a series, the wiki or another game: not
  its layout, its signature props, or its name. The team's rule already says so (no wiki, film or game names
  or looks), and the Q-1 sweep checks the first floor first.

**Tasks:**

| ID | Task | Done when |
|---|---|---|
| FF-1 | The reference board (private, outside the repository) and the written notes on it: what makes each picture eerie, in words | about forty notes in the brief, each one a sentence or two, no pictures |
| FF-2 | A brainstorming agent: a hundred strange geometries and eerie, surreal office set-ups (a meeting room set for one; a corridor whose doors are all the same door; a ceiling that lowers so slowly you only notice at the end; a cubicle farm with one chair still warm), each with what would make it cheap or costly to build | the list in the brief, ranked by the lead designer and the owner |
| FF-3 | The first two minutes: storyboarded second by second, from the fall in to the first time something is there (the first room seen, the first sound, the first sign of the cast) | written and agreed by the owner before FF-5's building starts |
| FF-4 | An audit of what the first floor is today: the landing, the plain rooms, the 40 yellow-floor rooms, each one shot at High and marked stunning, fine or weak | a table and a sheet of shots; the weak ones are named first |
| FF-5 | Set pieces: six to ten new first-floor rooms from FF-2's best, built to FF-3's beats | each on live, staged, shot, with tests as every room has |
| FF-6 | The plain rooms between (most of the first floor is these): a variety pass with D5, covering ceiling heights, lighting that fails in patterns, odd proportions, doorways that do not line up | a walk of three seeds shows no two plain rooms alike enough to notice |
| FF-7 | The first rooms after the landing are always among the best: a rule for how the first floor is dealt (C9) | for any seed, the first rooms a new player can reach from the landing include at least one of FF-4's "stunning" |
| FF-8 | Weak rooms: polished, or kept off the first floor (moved deeper, or out of the deck) | no room marked weak in FF-4 is left as it was on the first floor |
| FF-9 | New players tried: the first two minutes played cold by someone who has not seen it (the owner, a friend, or a fresh agent playing blind); what they looked at, where they stopped, where they were bored | written up; FF-3 revised where it failed |

---

## 3. Contracts between departments

Each contract has one owner, and changes go through that owner. The others build to it and nothing past it.

**C1 · Platform** (owner D1). `public/world/backrooms/platform.js` exports:

```js
platform = {
  kind: 'web' | 'steam',
  online(): boolean,
  achieve(id): void,              // a no-op on the web
  stat(id, n): void,              // a no-op on the web
  cloud: { get(key), set(key, value) },   // Steam Cloud in the shell, the site's archive on the web
  user(): { name, id } | null,    // the Steam user in the shell, the signed-in account (or null) on the web
  inventory(): [items],           // lost property the player holds (Steam's Inventory Service in the shell; the account on the web): P-8
}
```

- The lead hangs it on `env.platform` (L-2).
- The game never imports Electron or Steamworks.

**C2 · Achievements** (owner D1; IDs proposed by D6 and D8). A table in this file, filled in by C-1 and D8:

| ID | Raised by | When |
|---|---|---|
| … | … | … |

- IDs are kebab-case and never reused.
- They are registered in Steamworks by D1.

**C3 · Graphics defaults** (owner D3).
- `graphics.js` decides the starting tier from `platform.kind`, and the player's choice always wins.
- Ultra is a tier like the others: a row in the table.

**C4 · Input actions** (owner D2).
- `input.js` turns every device into named actions. The game reads actions (`state.firing`, `o.click`,
  `o.smash`, and so on, as today), not raw keys.
- New actions are asked for from D2.

**C5 · Optics events** (owner D4).
- `env.optics?.event(kind, strength)`, with kind one of `'focus' | 'hit' | 'close' | 'fall' | 'exposure'`
  and strength 0…1.
- It is a no-op until D4's work lands, so callers can be written first.

**C6 · The daily API** (owner D7).
- The endpoints and their shapes are in the daily plan, section 1.
- D8 builds against them. A stand-in server for tests is D7's.

**C7 · Wear in rooms** (owner D5; the hook is the lead's).
- `c.wear(spec)` in the room builder (`world.js`) takes a seeded wear request.
- D5 proposes its shape, and the lead adds the hook.

**C8 · Performance budgets** (owner D9).
- Frame-time targets for each tier on each hardware class.
- A merge that breaks one is held by the lead until it is fixed, or the budget is changed on purpose.

**C9 · How the first floor is dealt** (owner: the lead; asked for by D12).
- A rule in `plan.js`'s dealing: which rooms may be near the landing on the first floor, drawn from a list
  D12 keeps (the "stunning" ones).
- It changes what a seed deals, so it **changes the edition**, and it lands as such (L-4).

---

## 4. Milestones

| Milestone | What it is | Exit criteria (the lead checks) | Needs |
|---|---|---|---|
| **M0 · Ground** | decisions and facts | the owner's decisions (section 6) answered; F-1 profile written; Q-1 sweep listed; Q-2 started; P-1 spike plays; FF-1 to FF-3 begun | L-1, F-1, Q-1, P-1, FF-1 |
| **M1 · Internal build** | a Steam build the team can play | P-2, P-3, P-5, P-6; R-1; I-1, I-2; suite green | D1, D2, D3 |
| **M2 · Coming Soon** | the store page live | M-1 to M-4; W-4; FF-4; the first of FF-5's set pieces (the store's shots are taken on the first floor); Q-1's fixes merged; Q-2 answered; the owner's sign-off | D5, D10, D11, D12 |
| **M3 · Release candidate** | everything early access promises | FF-5 to FF-9 (the first floor done); P-4, P-7, P-8; I-3 to I-6; O-1 to O-6; W-1 to W-3; R-3; C-1 to C-4; S-1, S-2, S-6; D-1 to D-4; F-2, F-3; Q-3 to Q-5 | all |
| **M4 · Early access** | released | M3 closed; the two weeks of Coming Soon done; the owner's go | owner |
| **M5 · After launch** | the roadmap | S-3, D-5 (ghosts); R-4, R-5 (WebGPU); F-5; co-op; the modes roadmap | — |

M2 can run alongside M1 once M0 is closed. The store page needs shots and the trailer, not a finished build.

---

## 5. Working rules for every department

- **Branches:** one per department, `claude/steam-<department>` (for example, `claude/steam-shell`). The
  lead merges into `blockrooms-live`. Never push to another department's branch.
- **Files:** only edit what your department owns (section 2). For anything else, ask the owner, through the
  lead if unsure.
- **Contracts first:** if your work needs something from another department, write against the contract with
  a no-op stand-in, so neither waits on the other.
- **The project's rules hold** (`docs/BACKROOMS.md`, `CLAUDE.md`):
  - no npm in the game;
  - no model names in code or docs;
  - never commit `data/`, `public/knowledge/` or `public/transcripts/`;
  - the same seed gives the same building;
  - no wiki, film or game names or looks.
- **Every push:**
  - merge `blockrooms-live` first;
  - run the whole suite on the merged tree;
  - flag the edition if it changes;
  - stage once in a browser where anything visible changed;
  - write an audit row.
- **Tests and stand-ins:** a new import in `index.js` or `pursuer.js` needs its test stand-in in the same
  push.

---

## 6. Decisions for the owner

1. Electron and a Steamworks binding as dependencies of the *shell* (`tools/steam/`), with the game still
   free of npm: acceptable?
2. Is co-op in early access, or later?
3. Steam names on the boards, or typed names as now? Should a Steam login be the account (S-4)?
4. The early access answers: price, how long, what is promised (M-5).
5. The default tier on Steam: High, or Auto from High (R-1)?
6. How far Ultra goes: agreed from R-2's side-by-side shots before R-3 is built.
7. Crash reporting in the shell: none, Steam's own, or a service (Q-4)?
8. Lost property on Steam: tradeable ever, or shown only (P-8, S-6)? (Recommended: shown only, at first.)
9. The first floor (D12): how many new set pieces before early access (FF-5: six to ten proposed), and who plays
   the first two minutes cold (FF-9)?
