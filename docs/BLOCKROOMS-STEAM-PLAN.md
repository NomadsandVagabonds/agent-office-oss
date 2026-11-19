# BlockRooms on Steam: the roadmap

For the team. This brings together what the owner and the cast session settled on 19 Nov 2026. **Status:** a
plan. Nothing in it is built yet. The decisions marked **(owner)** are open.

## The decisions so far

1. **A light web wrapper, not a port.** The game stays one codebase (three.js, no build step, zero npm deps
   in the game itself), and the Steam build is that game in a desktop shell.
2. **Early access first.** Get the store page up early and gather wishlists. The daily tape is the hook
   that brings people back.
3. **The brand is BlockRooms.** "Backrooms" stays out of the title and the store tags unless a trademark
   search says otherwise. The Scranton prank is part of the Agent Office easter eggs, not BlockRooms, and
   does not ship.
4. **Richer, not sharper.** The camcorder stays the look. What the Steam build adds is a richer scene
   under the tape, not more tape lines. It is voxel and found footage, not a Minecraft knockoff.

Related plans:
- [BACKROOMS-DAILY-PLAN.md](BACKROOMS-DAILY-PLAN.md): the daily tape.
- [BACKROOMS-MODES-ROADMAP.md](BACKROOMS-MODES-ROADMAP.md): modes for several players.
- [BACKROOMS-COOP.md](BACKROOMS-COOP.md): co-op as it is.

## 1. The wrapper

**Electron, not Tauri.**
- Electron ships one fixed Chromium on every machine, so WebGL (and later WebGPU) looks and behaves the
  same everywhere.
- Tauri uses each system's own web view (WebKit on a Mac), which brings back the "works in Chrome, odd in
  Safari" problem.

**What goes in.** The site build already makes the game a folder of plain files:
`node tools/blockrooms/build.mjs <folder>` puts in the play page, every module the level imports, the
vendored three.js, the fonts and the audio. The Steam build packages that folder. Nothing in the game
changes to be wrapped.

**What it gains over a browser.** Mostly reliability, not raw speed:
- a frame rate not capped to the display;
- no tab throttling, and no extensions competing for the CPU;
- the high-performance GPU on laptops with two;
- pointer lock and fullscreen that behave the same everywhere;
- one Chromium version for everybody.

**Online and offline.**

| Works offline (bundled) | Needs the network |
|---|---|
| The whole single-player game | The visitors' book (`/api/book`) |
| Kept tapes | The daily tape and its board |
| | Ghosts |
| | Co-op |
| | Cloud saves (or use Steam Cloud instead) |

With no network, the game says so where those things would be, and plays on.

**Steamworks.** A Node binding (steamworks.js is the usual one) gives:
- **The overlay.**
- **Achievements.** The natural ones are the cast met and got away from (already counted for each visit),
  getting out, the perks (`core/perks.mjs`), and the daily's streaks and "firsts".
- **Steam Cloud.** It could hold the archive the site keeps now (`archive-*`).
- **Steam names.** They could stand in for the book's typed names on Steam. **(owner)** Should they?

**Steam Deck.** Electron's Linux build runs on the Deck. What needs checking there:
- gamepad input (there is none today: mouse, keyboard and touch);
- the 1280 × 800 screen (the held-item fitting and the HUD on a narrow picture);
- the frame rate at the Deck's power.

## 2. Graphics for the Steam build

**Where it stands today** (`public/world/backrooms/graphics.js`):
- **The default is Classic.** It draws the scene at the tape's own size, with no grade, no haze, no baked
  shading and no shadows.
- **Medium and High already exist.** They draw the scene 1.5× and 2× under the tape and filter it down. On
  top of that they add:
  - the grade and haze;
  - baked corner darkening and colour bounce;
  - the tubes' light-mapped shadows;
  - the next room's light through doorways;
  - sculpted light fittings and glow from what shines;
  - and on High, shadows from the torch.
- **The tape keeps about 540 lines.** More lines made its wobble and scan lines look "thin and digital"
  (`graphics.js`). Keep that.

**What makes it not Minecraft** is not resolution. Minecraft is big blocks, flat light and pixel textures.
Ours are 2.5 cm voxels. The reference to aim at is a voxel world lit like a real place (Teardown is the
well-known example). The levers, by how much each buys:

1. **The default.** On Steam the game starts at High, or at Auto starting from High (Auto already steps
   down when frames cannot keep up).
2. **An Ultra tier.** About 3× supersampling under the tape, plus:
   - ambient occlusion on screen;
   - light shafts through doorways and dust;
   - more fittings casting shadows;
   - sharper light maps.
3. **The camcorder's optics, not only its tape.** These are the most found-footage and least
   block-game of all, and they are cheap:
   - auto-exposure that lags from a dark room into a lit one;
   - white balance drifting green under the tubes;
   - focus hunting when something comes close;
   - the vertical smear old camcorders draw from bright lights;
   - vignetting and a little barrel distortion;
   - all of it tied to what happens (a creature close, a hit), as the interference is now.
4. **Wear.** Grime, scuffs, stains, worn paths in the carpet and water damage, as decals or vertex colour.
   Flat even colour is what reads as "block game".
5. **Silhouettes where the eye lands.** Bevelled and sculpted pieces (the fittings and the held items are
   already this; the creatures are rigged), with voxels for walls and dressing, where they read as texture.
6. **Particles.** Dust in the light, the extinguisher's spray, paper. They give depth and life.

**WebGPU, later, by stages.**
- **Why:** much cheaper draw calls on the CPU, compute shaders (particles, the notes' bending, swarms on
  the GPU), and more lights and shadows. Inside Electron WebGPU is simply on, so the Steam build can use it
  while the web keeps WebGL.
- **What it costs:** three.js's WebGPU renderer does not run GLSL `ShaderMaterial`s. About fifteen files
  have custom shaders to move to TSL (three.js's node shading):
  - `kit.js`, the surfaces and light nearly everything uses;
  - `vhs.js`, the tape;
  - glow, liquid, fire, the forest's effects, the beam shadows and the spray.
- **What TSL gives back:** it compiles to both WebGPU and WebGL2, and the renderer falls back by itself.
  It stays one codebase.
- **Vendoring:** we vendor three.js r180, but not its WebGPU build. Adding it is one more vendored file:
  still no npm, no build step.
- **Measure first.** three.js's WebGPU path is newer, and some scenes run slower on it today.

**Measure before changing anything.** The site already carries a measuring tape:
`/play?debug&bench=1` (`world/dev/perf.js`). Profile the heaviest floors first:
- If the time goes to the CPU's draw calls, WebGPU is a real gain.
- If it goes to the game's own JavaScript, fix that first.

## 3. The game, for early access

- **The daily tape** ([plan](BACKROOMS-DAILY-PLAN.md)): one building a day for everybody, with a board,
  ghosts, a share card and streaks. It is the main reason to come back, and it can also try out new rooms,
  creatures and items.
- **Co-op:** as it is ([BACKROOMS-COOP.md](BACKROOMS-COOP.md)). **(owner)** Is it in early access, or
  later?
- **Later modes:** the mole, one plays the building, the race ([roadmap](BACKROOMS-MODES-ROADMAP.md)).
  Early access updates are where they arrive.

## 4. Before the store page: names and likenesses

The team's rule already covers this (`docs/BACKROOMS.md`: no wiki, film or game names or looks). Before
submitting:
- **A trademark search** on "Backrooms", "The Backrooms" and "BlockRooms" in the game classes, with an IP
  lawyer's read.
- **A read-only sweep** of every room, creature, item, string, image and alt text against the community
  wiki's entity and level names and the well-known series' designs. It produces a list, and fixes go to
  each file's owner.
- **Known already:**
  - the front page's gallery alt text says "partygoers" (`tools/blockrooms/home.html`);
  - `smiler-maze` / `dive-smiler` are internal ids, so check the figure's look, not the name.

## 5. Store and early access (the logistics)

- **Steam Direct:** a one-off fee for each game ($100).
- **The store page:** Valve reviews it. A game sits as "Coming Soon" for at least two weeks before release.
  Wishlists gathered then are what Steam's visibility runs on, so the page goes up early.
- **What the page needs:**
  - capsule art in Valve's sizes;
  - screenshots (the shots tooling already makes them: `tools/blockrooms/shots/`);
  - a trailer (the trailer rig in this project films real play a frame at a time);
  - a short description that sells the camcorder, the daily and the creatures' rules;
  - system requirements, taken from the profiling.
- **The early access questions** Valve asks (why early access, how long, what changes, the price during
  and after): **(owner)**.

## Order of work

| Phase | What | Who | Size |
|---|---|---|---|
| 0 | Trademark search and lawyer's read; the names-and-likenesses sweep | owner; an agent, read-only | small |
| 1 | Profile the heaviest floors with `bench=1`; write down where each frame goes | an agent | small |
| 2 | The Electron shell around the site build: packaging, offline, Steamworks (overlay, achievements, cloud) | the swarm | medium |
| 3 | Graphics, first pass: default High or Auto on Steam; side-by-side shots of Classic, Medium and High to agree the look | lead deals; cast can stage the shots | small |
| 4 | The camcorder's optics and surface wear | the swarm, by the lead | medium |
| 5 | Steam Deck: gamepad input, the 1280 × 800 picture, frame rate | the swarm | medium |
| 6 | Store page: capsule art, shots, trailer, text; Coming Soon live | owner and agents | medium |
| 7 | The daily tape, steps 1–4 (no ghosts yet): seed, board, front page, share card | per its plan | medium |
| 8 | Ultra tier: about 3× supersampling, ambient occlusion, light shafts, more shadows | the swarm | medium |
| 9 | Early access release | owner | — |
| 10 | After: ghosts for the daily; the WebGPU port (materials to TSL, `kit.js` and `vhs.js` first, with shots matched); GPU particles; co-op and the modes | the swarm | large |

- Phases 0–1 decide the rest. Do them first.
- Phases 2–6 are what a store page and a playable build need.
- Phase 7 can run alongside.

## Decisions for the owner

1. Is co-op in early access, or later?
2. Steam names for the board, or typed names as now?
3. The early access answers: price, how long, what is promised.
4. The default tier on Steam: High, or Auto from High?
5. How far Ultra should go: the look agreed from the side-by-side shots (phase 3) before building it.
