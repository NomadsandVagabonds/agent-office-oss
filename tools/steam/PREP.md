# BlockRooms on Steam — prep for the app (D1)

Short and plain. Checked against primary docs on 19 Nov 2026 where a link is given; anything without a link
is the department's reading, to be confirmed.

## 0. Decided (owner, 19 Nov): no website in the app

The 1998 home page (the front page, `index.html`) is **not** in the Steam app, and neither is the trailer and its
`<video>`. The app gets a launcher of its own: an intro and a start menu (its own task, not built yet). So:
- the shell opens the play page (`play`), later the launcher, and never the front page;
- `package.mjs` (P-2) leaves out the front page and its parts (`index.html`, `home.*`, `art.js`, the
  trailer files, `shots/`, `og.jpg`, `muzak.mp3` unless the launcher wants the lift music), and the shell
  sends the play page's "return to homepage" to the launcher instead;
- the spike still opens the front page when run with no `--start`. Changing that default is a one-line change for
  the next shell task (the check already opens `play`).

## 1. Only the owner can do (or pay for) these

| What | Why it is needed | Cost / notes |
|---|---|---|
| **Steamworks partner account** | everything below hangs on it | sign-up, digital paperwork, identity check. [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding) |
| **Steam Direct fee** | one per app (the game; a demo is free on the same app) | **US$100**, not refundable, recouped after US$1,000 adjusted gross revenue. [App fee](https://partner.steamgames.com/doc/gettingstarted/appfee) |
| **Tax and bank** | payouts; the tax interview | in the partner paperwork; the invoice for the fee goes to the Steam user who paid it. Talk to a tax adviser |
| **The app ID** | Steamworks needs it at start-up (`steam_appid.txt` in development) | comes with paying the fee. Until then the agents can use Valve's public test app **480** to try the API locally, nothing more |
| **A test app ID / playtest** | achievements and Cloud are set up per app; a beta branch (P-7) | branches are free on the app itself; a Playtest app is free too |
| **Windows code signing** | an unsigned .exe is treated as unsigned by SmartScreen | EV certificate on hardware, or a cloud signer: Azure Artifact Signing is the cheapest, only in some countries. [Electron: code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing) |
| **Mac signing and notarization** | macOS blocks an app that is not signed and notarized | **Apple Developer Program, US$99/year**, a Developer ID certificate, and a Mac to run the signing (same Electron page) |
| **Steam Deck review** | the Verified badge | free; Valve tests. Needs a full default controller layout (D2), text ≥ 9 px at 1280×800 (12 px advised), and no launcher. Valve tests a native Linux build first, else the Windows one under Proton. [Deck compatibility](https://partner.steamgames.com/doc/steamdeck/compat) |

Signing is strictly optional for Steam itself (Steam installs unsigned builds), but without it Windows warns
and macOS refuses to open the app, so both are needed before anybody outside the team gets a build.

## 2. steamworks.js: what it gives, and its caveats (see 2b: the recommended binding is now steamworks-ffi-node)

[ceifa/steamworks.js](https://github.com/ceifa/steamworks.js): a native Node module (Rust) over the Steamworks
SDK. Its API ([client.d.ts](https://github.com/ceifa/steamworks.js/blob/main/client.d.ts)) has: `achievement`,
`stats` (getInt / setInt / store / resetAll), `cloud` (readFile / writeFile / listFiles / …), `overlay`,
`localplayer`, `input`, `workshop`, `matchmaking`, `networking`, `auth`, `apps`, `utils`.

- **Achievements and stats (C2, P-4):** covered.
- **Steam Cloud (P-4):** covered, through the Cloud API (`ISteamRemoteStorage`). Alternative with no code at
  all: Steam **Auto-Cloud**, which syncs a folder at launch and exit. The byte and file quotas per user are set
  by us in the app admin. [Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- **Overlay:** `electronEnableSteamOverlay()` in main. Known open issues in Electron: overlay drawn white
  (#116), a `<video>` breaking it (#148; no longer our problem, as the trailer is not in the app: section 0), ghost windows on alt-tab (#95), and
  Linux trouble (#195). Treat the overlay as **unproven until tried on each OS** with a real app ID.
- **Inventory Service (P-8): not in steamworks.js.** Two ways: grant items from our server through the Web
  API (a trusted server with a publisher key, which fits S-6 "granted when the server says so"), and read
  the player's items the same way or through a small native addition. Item definitions are uploaded in the
  app admin. [Inventory Service](https://partner.steamgames.com/doc/features/inventory)
- **Where it runs:** it is native, so it lives in the **main process**, never the page. The README's own
  example turns off context isolation to use it in the page; we will not: the page asks main through the
  preload (C1), and the game never imports it.
- **Upkeep:** the last npm release is 0.4.0 (Aug 2024). Its Steamworks SDK and Electron support may lag. See 2b.
- **Redistributables:** the SDK's `steam_api` libraries must be copied next to the app in each OS build.

## 2b. Which binding (asked by the owner, 19 Nov)

Looked at on 19 Nov 2026 from npm and each project's README. Stars and dates are what the pages showed then.

| | **steamworks-ffi-node** ([ArtyProf](https://github.com/ArtyProf/steamworks-ffi-node)) | **steamworks.js** ([ceifa](https://github.com/ceifa/steamworks.js)) | **greenworks** ([greenheartgames](https://github.com/greenheartgames/greenworks)) | **steamworks.ts** ([kyeshmz](https://github.com/kyeshmz/steamworks.ts)) |
|---|---|---|---|---|
| How it binds | Koffi FFI over `libsteam_api` (prebuilt Koffi only, **no rebuild per Electron version**) | Rust native addon (N-API prebuilt) | C++ NAN addon: **rebuilt per Electron/NW version** | fork of steamworks.js (Rust) |
| Maintenance | active: npm 0.11.3 (24 Sep 2026), pushed 12 Nov 2026; 93★, 12 open issues | most used; npm **0.4.0, Aug 2024**; last commit I could see on main, Sep 2025 | "best-effort", 63 open issues; ~1.6k★ but old | pushed 18 Nov 2026, **0★, not on npm**, CI switched off |
| Steamworks SDK | **1.64** | not stated (older; via the steamworks-rs crate) | 1.62 | not stated |
| SDK files | **not bundled**: we download the redistributables from the partner site (needs the account) | bundled (`libsteam_api` in the package) | supplied by us | as steamworks.js |
| Achievements, stats | yes (+ leaderboards) | yes | yes | yes |
| Cloud | yes (Remote Storage) | yes | yes | yes |
| Inventory (P-8) | **no** | **no** | partial (old) | claims yes, unverified |
| Overlay in Electron | its own fix, **experimental**: the page is drawn offscreen and each frame copied to a native window Steam hooks (Metal / OpenGL). Claims 1–3% CPU, 50–100 MB, ~1 frame latency. Linux **X11 only**, no Wayland | `electronEnableSteamOverlay()`; open issues: white overlay (#116), `<video>` breaks it (#148: moot for us, no video in the app), ghost windows (#95), Linux (#195) | no Electron notes | as steamworks.js |
| Steam Deck / Linux | Linux x64/ARM64; Deck detection; overlay tried in Deck desktop mode | Linux x64 | Linux | Linux x64 |
| Licence | MIT (SDK under Valve's agreement) | MIT | MIT | MIT |

**Tried here** (Electron 45.2.3 main process, Linux, Steam not installed; in a scratch folder, not committed):
- `steamworks.js`: loads (3 ms). `init(480)` **throws** "Failed to load module ~/.steam/sdk64/steamclient.so". It does not crash, so the bridge must wrap it in try/catch.
- `steamworks-ffi-node`: loads (29 ms). `init({ appId: 480 })` **returns false** and logs why (no SDK files here, then no Steam). It does not crash.
- I could not go further: no Steam client, no app ID, no SDK download (that needs the partner account). Nothing about the overlay, achievements or Cloud was exercised.

**Recommendation: steamworks-ffi-node, with steamworks.js as the fallback.**
- Why: it is maintained, on the current SDK, needs no rebuild when Electron moves, and is the only one with
  a worked answer to the overlay problem.
- Its risks: one maintainer; the overlay is experimental. The offscreen copy of every frame must be measured
  with the real game on a real GPU (D9). If it costs frames, ship **without the overlay at first**:
  achievements and Cloud do not need it.
- Fallback: steamworks.js. It works today and bundles the SDK, but is ageing.
- Not greenworks (a rebuild for every Electron version, best-effort upkeep). Not steamworks.ts yet: watch it
  for Inventory.
- **Inventory goes through our server either way** (the Web API with a publisher key, S-6), so P-8 does not
  depend on this choice.

**Keeping it swappable.** The binding lives in one main-process file (`tools/steam/steam.mjs`, to come). It
answers the preload's few calls (`achieve`, `stat`, `cloudGet`, `cloudSet`, `user`) and does nothing if `init`
fails. The page only ever sees `platform` (C1, `draft/platform.js`), so changing binding touches that one file
and `package.json`.

## 3. Offline (P-5)

What the site needs the network for: the book (`/api/book`), where you are (`/api/where`), and accounts
(Supabase, only in an accounts build). The spike already answers `/api/*` with 503 and the site carries on, so
a visit plays offline today. P-5 still has to: make the book and the daily say "offline" plainly, decide
which services the shell calls on the network when it is online (and add those origins to the shell's CSP, not
the web's), and keep the daily's edition working with no network.

## 4. Packaging per OS (P-2), rough sizes

Measured here (Linux x64): Electron 45 unpacked is **275 MB** (its zip is 124 MB); the built site is
**60 MB**, of which the front page's trailer is 31 MB. Without the front page (section 0) the site is under
**~29 MB**, so a Linux depot is about **305 MB** unpacked, roughly **130–160 MB** to download once compressed. Windows and Mac should be in
the same range (Mac a little larger, as a universal build doubles the binary) — **not measured**.

Plan: `tools/steam/package.mjs` builds the site, copies it into the app, adds the Steamworks
redistributable, and runs a packager (electron-builder or Electron Forge; to choose) once per OS, from a
clean checkout. The Mac and Windows builds have to be made, signed and notarized on those systems (or CI
runners for them).

## 5. Open questions for the owner

1. Decision 1: Electron + a Steam binding (steamworks-ffi-node recommended, 2b) as shell-only dependencies — yes?
2. Who holds the Steamworks account and pays the US$100, and when? The app ID unblocks P-4, P-7 and P-8.
3. Mac at launch, or Windows + Linux (and Deck) first? Mac adds US$99/year and a Mac to sign on.
4. Windows signing: Azure Artifact Signing (if your country is covered) or an EV certificate?
5. Steam Cloud: the Cloud API (finer control) or Auto-Cloud (no code)? D1 leans to the API, as the archive
   is already structured data.
6. ~~Ship the trailer inside the app?~~ **Answered (19 Nov): no website and no trailer in the app** (section 0).
7. Is launching without the Steam overlay acceptable, if it costs frames (2b)?
