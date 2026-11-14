# BlockRooms

The level under the office ("Out of Office", `public/world/backrooms/`) built
as a site of its own, for people who want to walk it without running an
office. The name is the public one for the standalone; inside the office the
level keeps its own.

Nothing here is a second copy of the game. The site is the same modules,
copied out by a script, with a small page round them that stands in for the
office: an invented team to borrow names and faces from, a keycard that is
always down there to find, and one building after another.

## Build

```bash
node tools/blockrooms/build.mjs dist
```

No install step, no dependencies, no bundler. The folder that comes out is
plain files and can be served by anything.

| In the folder | What it is |
|---|---|
| `index.html` | the page (`tools/blockrooms/page.html`), with its head, its import map, its content policy and the list of modules to fetch at once filled in |
| `site.js` | the page's script (`tools/blockrooms/site.js`) |
| `world/`, `core/` | every module the level imports, found by reading the imports (`tools/backrooms-sample/stage.mjs`) |
| `vendor/` | three.js and the add-ons the level uses, the fonts it asks for, and their licences |
| `og.jpg` | the picture a link to the site is shown with, if `tools/blockrooms/og.jpg` exists |
| `robots.txt` | |

The page asks for nothing from any other site, and says so in a
Content-Security-Policy a browser enforces (`default-src 'self'`; the one
script written into the page, the import map, is allowed by its hash).
`test/blockrooms-site.test.mjs` builds the site and checks all of this.

**The site's address is not written anywhere in this repository.** Where a
link preview needs it whole (`og:url`, `og:image`, the canonical link), the
build takes it from `SITE_ORIGIN` (`https://…`), or, on Vercel, from
`VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets while it builds.

## Addresses

| Address | What happens |
|---|---|
| `/` | a building nobody has had before, then another when that one ends |
| `/?tape=<seed>` | that building first. A finished visit keeps its tape (its seed); while the card for it is on the wall the address bar shows this address, so copying it hands the building on |
| the tape's number on the card | a link to the same address; choosing it walks the building again |
| `/?debug` (with `depths=`, `depth=`, `mute`, `pursuer=0`) | for checking, not playing: exposes the level's handle as `window.__backrooms` and allows a shorter building |

A tape this browser has kept is **played back**: the picture says PLAY where
a visit says REC, nothing is hidden in it, and it scores but cannot beat the
best and is paid nothing (`core/runs.mjs`). A tape from somebody else is a
building like any other, walked for the first time.

## What is kept, and where

Only in the visitor's own browser (`localStorage`): whether the keycard has
been brought out, the record of visits (best score, kinds of room and
residents met, up to twelve tapes), and the two camcorder settings. No
cookies, no analytics, no accounts, and no request to anywhere but this site.

## Hosting (Vercel)

`vercel.json` at the root of the repository carries every setting, so a
Vercel project connected to this repository needs none typed in:

- framework: none ("Other") · install command: none · build command
  `node tools/blockrooms/build.mjs dist` · output directory `dist`
- headers: `nosniff`, no framing from other sites, no referrer
- `git.deploymentEnabled`: only the branch **`blockrooms-live`** deploys

Set the project's **production branch** to `blockrooms-live`.

Branches that do not have this `vercel.json` yet (anything cut before it
landed) would still be built as previews, of the wrong thing. To stop that for
good, set the project's *Ignored Build Step* to:

```bash
[ "$VERCEL_GIT_COMMIT_REF" != "blockrooms-live" ]
```

(exit 0 skips the build, exit 1 runs it).

**The domain.** Add it to the Vercel project and create at the registrar
exactly the records Vercel's domain page asks for. A `.app` address is
HTTPS-only by design (the whole top-level domain is on the HSTS preload
list); Vercel issues the certificate once the records resolve. Nothing in the
build depends on the domain.

## Releasing

`blockrooms-live` is moved forward by hand, to a commit that has passed
`npm test` and been played in a browser, and never by a merge from a helper:

```bash
git push origin <commit>:blockrooms-live
```

## Not yet verified

- **Touch.** The level has touch controls (a stick, drag to look, tap E); they
  have not been re-checked on a real phone since pockets and crafting landed.
- **Real graphics hardware.** Everything here was checked under software
  rendering, which shows that it works and nothing about how fast.
- **On Vercel itself.** The build and the built site are tested locally; the
  first deploy is the first time Vercel has seen this configuration.
