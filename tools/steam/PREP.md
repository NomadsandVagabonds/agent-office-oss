# BlockRooms on Steam — prep for the app (D1)

Short and plain. Checked against primary docs on 19 Nov 2026 where a link is given; anything without a link
is the department's reading, to be confirmed.

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

## 2. steamworks.js: what it gives, and its caveats

[ceifa/steamworks.js](https://github.com/ceifa/steamworks.js): a native Node module (Rust) over the Steamworks
SDK. Its API ([client.d.ts](https://github.com/ceifa/steamworks.js/blob/main/client.d.ts)) has: `achievement`,
`stats` (getInt / setInt / store / resetAll), `cloud` (readFile / writeFile / listFiles / …), `overlay`,
`localplayer`, `input`, `workshop`, `matchmaking`, `networking`, `auth`, `apps`, `utils`.

- **Achievements and stats (C2, P-4):** covered.
- **Steam Cloud (P-4):** covered, through the Cloud API (`ISteamRemoteStorage`). Alternative with no code at
  all: Steam **Auto-Cloud**, which syncs a folder at launch and exit. The byte and file quotas per user are set
  by us in the app admin. [Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- **Overlay:** `electronEnableSteamOverlay()` in main. Known open issues in Electron: overlay drawn white
  (#116), a `<video>` breaking it (#148, the front page has a trailer), ghost windows on alt-tab (#95), and
  Linux trouble (#195). Treat the overlay as **unproven until tried on each OS** with a real app ID.
- **Inventory Service (P-8): not in steamworks.js.** Two ways: grant items from our server through the Web
  API (a trusted server with a publisher key, which fits S-6 "granted when the server says so"), and read
  the player's items the same way or through a small native addition. Item definitions are uploaded in the
  app admin. [Inventory Service](https://partner.steamgames.com/doc/features/inventory)
- **Where it runs:** it is native, so it lives in the **main process**, never the page. The README's own
  example turns off context isolation to use it in the page; we will not: the page asks main through the
  preload (C1), and the game never imports it.
- **Upkeep:** the last npm release is 0.4.0 (Aug 2024). Its Steamworks SDK and Electron support may lag; if it
  stalls, the fallback is our own small native bridge (more work: P-4 would grow).
- **Redistributables:** the SDK's `steam_api` libraries must be copied next to the app in each OS build.

## 3. Offline (P-5)

What the site needs the network for: the book (`/api/book`), where you are (`/api/where`), and accounts
(Supabase, only in an accounts build). The spike already answers `/api/*` with 503 and the site carries on, so
a visit plays offline today. P-5 still has to: make the book and the daily say "offline" plainly, decide
which services the shell calls on the network when it is online (and add those origins to the shell's CSP, not
the web's), and keep the daily's edition working with no network.

## 4. Packaging per OS (P-2), rough sizes

Measured here (Linux x64): Electron 45 unpacked is **275 MB** (its zip is 124 MB); the built site is
**60 MB**, half of it the front page's trailer (31 MB), which the shell may not need. So a Linux depot is
about **335 MB** unpacked, roughly **150–180 MB** to download once compressed. Windows and Mac should be in
the same range (Mac a little larger, as a universal build doubles the binary) — **not measured**.

Plan: `tools/steam/package.mjs` builds the site, copies it into the app, adds the Steamworks
redistributable, and runs a packager (electron-builder or Electron Forge; to choose) once per OS, from a
clean checkout. The Mac and Windows builds have to be made, signed and notarized on those systems (or CI
runners for them).

## 5. Open questions for the owner

1. Decision 1: Electron + steamworks.js as shell-only dependencies — yes? (This spike assumes yes.)
2. Who holds the Steamworks account and pays the US$100, and when? The app ID unblocks P-4, P-7 and P-8.
3. Mac at launch, or Windows + Linux (and Deck) first? Mac adds US$99/year and a Mac to sign on.
4. Windows signing: Azure Artifact Signing (if your country is covered) or an EV certificate?
5. Steam Cloud: the Cloud API (finer control) or Auto-Cloud (no code)? D1 leans to the API, as the archive
   is already structured data.
6. Ship the trailer inside the app (31 MB), or only on the store page?
