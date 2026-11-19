# tools/steam — the BlockRooms desktop shell (SPIKE)

**This is a spike (P-1 of `docs/BLOCKROOMS-STEAM-PLAN.md`), not the shell.** It waits on the owner's
decision 1: Electron and a Steamworks binding as dependencies of the *shell only*. If the answer is no,
delete this folder; nothing else in the repository depends on it.

- Electron lives in `tools/steam/package.json` only. The game and the office stay free of npm.
- No Steamworks yet (P-4). No packaging yet (P-2). See `PREP.md` for what those need.

## What it does

`main.mjs` opens one window on the site exactly as `node tools/blockrooms/build.mjs <folder>` writes it,
read from disk through a scheme of its own, `app://blockrooms/`:

- the scheme is registered *standard* and *secure*, so the page has a real origin: its CSP (`'self'` plus the
  import map's hash), its import map (`three`, `/core/`, `/vendor/three-addons/`), `localStorage` and module
  scripts work as they do on https. Nothing in the built site is changed;
- paths are found the way `tools/blockrooms/serve.mjs` finds them (`/play` is `play.html`);
- `/api/*` (the book, where you are) answers 503: the shell is offline until P-5;
- only `app://blockrooms/` is shown in the window; https links go to the system browser;
- sandboxed renderer, context isolation, no Node in the page. `preload.cjs` adds a frame-rate counter
  (F3 hides it) and a read-only `window.blockroomsShell = { kind: 'steam', … }` for C1 to grow from;
- F11 is fullscreen. Background throttling is off and the discrete GPU is asked for (P-6, a hint only).

## Run it

```sh
cd tools/steam
npm install                 # Electron 45.2.3, here only
npm run site                # = node ../blockrooms/build.mjs site   (site/ is ignored by git)
npx electron . --start play # the play page (the app never shows the front page: PREP.md, section 0)
```

Flags: `--site <folder>`, `--start <page>`, `--fullscreen`, `--no-fps`, `--software-gl` (no GPU).
If `npm install` skipped Electron's download (scripts off), run `node node_modules/electron/install.js`.

## The check

```sh
xvfb-run -a node check.mjs [--depths 3] [--shot out/play.png] [--gpu]
```

It launches the shell through Playwright's Electron driver (Playwright is not a dependency here; it uses the
machine's), opens `play?debug&mute&depths=3`, waits for the level, goes down through every part with the
level's `?debug` handle, leaves by the way out, and waits for the card. It fails on anything the CSP refuses
and on page errors, and prints the counter's frame rate on each part.

**What it proves, and what it does not:**
- Proved here, on Linux x64 under Xvfb with software GL (SwiftShader): the built site loads from disk in
  Electron unchanged, CSP and import map included, and a 3-part visit plays from landing to the card.
- Not proved: Windows and Mac (not run at all); a real GPU; a person walking a visit with keyboard, mouse
  and pointer lock (the check jumps parts through the debug handle); audio (muted); the frame rate on real
  hardware (software GL numbers say nothing about it).

**Last run (19 Nov 2026, Linux x64, Xvfb, SwiftShader):** all steps ok — level up, parts 1→2→3, out by the way
out, card shown, nothing refused by the CSP, no page errors. Frame rate 4–6 fps (worst frame 180–450 ms): that is
the software renderer on a container CPU, expected, and not a measure of anything.

## Also here

- `PREP.md`: what the app needs that only the owner can do or pay for, steamworks.js and its caveats,
  offline, packaging sizes, open questions.
- `draft/platform.js`: a draft of contract C1 as web no-ops with a shell bridge, plus `draft/platform.check.mjs`.
  **Not wired into the game**: `public/world/backrooms/index.js` is the lead's (L-2).
