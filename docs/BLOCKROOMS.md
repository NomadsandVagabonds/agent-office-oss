# BlockRooms

The level under the office ("Out of Office", `public/world/backrooms/`) built
as a site of its own, for people who want to walk it without running an
office. The name is the public one for the standalone; inside the office the
level keeps its own.

Nothing here is a second copy of the game. The site is the same modules,
copied out by a script, with a small page round them that stands in for the
office: an invented team to borrow names and faces from, a keycard that is
always down there to find, and a building nobody has had before.

In front of that is a home page, and it is 1998: "The Unofficial Home Page
of Paranormal Office Phenomena", with what a home page had then. A door
marked ENTER, a visitor counter, high scores and a guestbook, a webring,
spoof banner adverts, screenshots, and a bottom that keeps going.

**Only a door starts the game** (the owner's rule for this page): the door,
the ENTER buttons, a tape somebody chooses, and the wall at the bottom for
whoever leans on it. The adverts and the screenshots are pictures. An advert
that dropped a visitor into the level without a word was not wanted; one of
them opens a window of its own (the store), and more may later.

**Nothing on it is called an advert where a browser can see** (no `ad`,
`ads`, `sponsor` in a class, an id or an attribute): blockers hide by name,
and one of these was being hidden. They are `plug`s in the markup.

**The words on it are plain on purpose** (the owner's rule for this page):
what somebody would really have typed on a home page in 1998, which is
labels, a welcome and a changelog. No asides, no captions explaining a joke,
no clever phrases. The trappings do the work.

## Build

```bash
node tools/blockrooms/build.mjs dist
```

No install step, no dependencies, no bundler. The folder that comes out is
plain files and can be served by anything.

| In the folder | What it is |
|---|---|
| `index.html` | the home page (`home.html`, with `home.css`, `home.js` and `art.js`). Small, and with nothing of the level in it, so it is there at once |
| `play.html` | the page the level is played on (`page.html`), with its head, its import map, its content policy and the list of modules to fetch at once filled in. Served as `/play` |
| `site.js` | that page's script |
| `world/`, `core/` | every module the level imports, found by reading the imports (`tools/backrooms-sample/stage.mjs`), any file a module keeps beside itself and asks for by its own address (the level's music, `world/backrooms/music/`), and the rules of the book (`core/book.mjs`) |
| `vendor/` | three.js and the add-ons the level uses, the fonts it asks for, and their licences |
| `shots/` | pictures from inside, for the home page (`tools/blockrooms/shots/`: taken through the level's own camcorder) |
| `muzak.mp3` | the home page's music when its MUSIC switch is on: the lift's music from the office (`public/audio/elevator-muzak.mp3`) |
| `og.jpg` | the picture a link to the site is shown with |
| `robots.txt` | |

Neither page asks for anything from any other site, and each says so in a
Content-Security-Policy a browser enforces (`default-src 'self'`; the one
script written into the play page, the import map, is allowed by its hash;
the home page has no script written into it at all).
`test/blockrooms-site.test.mjs` builds the site and checks all of this.

Every picture on the home page that moves is drawn by `art.js`, a character
a pixel; none of it came from anybody else's page.

To try the built site on one's own machine, book and all:

```bash
node tools/blockrooms/build.mjs dist
```

```bash
node tools/blockrooms/serve.mjs dist
```

(`serve.mjs` answers `/api/book` out of a store that is only a Map: empty
every time it starts, and nothing in it goes anywhere.)

**The site's address is not written anywhere in this repository.** Where a
link preview needs it whole (`og:url`, `og:image`, the canonical link), the
build takes it from `SITE_ORIGIN` (`https://…`), or, on Vercel, from
`VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets while it builds.

## Addresses

| Address | What happens |
|---|---|
| `/` | the home page |
| `/play` | a building nobody has had before. Esc opens the camcorder menu, mouse held or not. Give Up ends the recording and shows its score, as do the way out, being caught or a flat battery. The card stays until **Return to homepage** is chosen, or a kept tape is played again |
| `/play?tape=<seed>` | that building first. A finished visit keeps its tape (its seed); while the card for it is on the wall the address bar shows this address, so copying it hands the building on. (`/?tape=` from before there was a home page goes straight through.) |
| the tape's number on the card | a link to the same address; choosing it walks the building again |
| `/play?room=<a room of the deck>` | a building with that room where you land, for looking at one room. Nothing on the home page leads here. A room that does not exist is an ordinary door |
| `/play?debug` (with `depths=`, `depth=`, `mute`, `pursuer=0`) | for checking, not playing: exposes the level's handle as `window.__backrooms` and allows a shorter building |
| `/api/book` | the visitors' book (below) |

A tape this browser has kept is **played back**: the picture says PLAY where
a visit says REC, nothing is hidden in it, and it scores but cannot beat the
best and is paid nothing (`core/runs.mjs`). A tape from somebody else is a
building like any other, walked for the first time.

## The camcorder menu

Esc opens the transparent camcorder menu. Resume returns to the recording;
Controls lists the keyboard and touch controls; Settings adjusts music and
sound effects separately, look sensitivity, inverted vertical look and the
VHS picture. Difficulty is shown as unavailable until its gameplay exists.
The recording, batteries and hazards pause while the menu is open.

Give Up ends the visit and brings up its score. On this site, a score stays
on screen until **Return to homepage** is chosen or a kept tape is selected
to play again. An accidental click or a key still held from play does not
close it. The Office's own scorecard retains its usual return behavior.

## What is kept, and where

In the visitor's own browser (`localStorage`): whether the keycard has been
brought out, the record of visits (best score, kinds of room and residents
met, up to twelve tapes), the camcorder's picture, sound and look settings, and the name and note
they sign with. No cookies, no analytics, no accounts, and no request to
anywhere but this site.

On the site, if it keeps a book: see the next section.

## The visitors' book

High scores, a guestbook and the traffic counter are one small thing: a
function at `/api/book` (`api/book.mjs`, which is three lines;
`tools/blockrooms/book-api.mjs` is what it does; `core/book.mjs` is the rules)
over a small persistent store, spoken to with `fetch`. The Cloudflare D1
adapter uses an existing Cloudflare account; the original Redis adapter is
also supported. No client library: this repository still has no dependencies.

**What the host has to be given** (environment variables on the project):

| Variable | What for |
|---|---|
| `BOOK_STORE_URL` + `BOOK_STORE_KEY` | private Cloudflare Worker `/book` URL and a shared secret of at least 32 characters. The Worker stores the book in D1. See [the setup guide](BLOCKROOMS-STORE.md). This pair takes priority if configured |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | optional existing Redis REST store. There is no need to purchase one when using D1. With neither store configured, `/api/book` answers 503 and the home page shows this browser's own scores and tapes instead |
| `BOOK_ADMIN_KEY` | a secret of sixteen characters or more: what strikes a line out of the book. With none set, nothing can be struck |
| `BOOK_BLOCKLIST` | words no name in the book may have in it, separated by commas. Matched inside a name however it is spelled round (`0` for `o`, dots between letters). The list is the keeper's and is not in this repository |
| `BOOK_SALT` | salt for the short-lived hashes that stop one visitor counting twice (defaults to the configured store's secret; a separate random value is recommended) |

**What is written in it.** A visit that got out, as counted again by the
site from what the browser reports (`checkRun`): a name, a short message if
one was typed, the points, how long the tape ran, parts and rooms, spare
batteries, hearts, and the building's seed (so that anybody can walk the same
building: every line in the high scores is a link to one).

- **The name is typed by whoever signs**: that is the fun of a table of high
  scores. It is held to sixteen characters of letters, figures, spaces and
  `. - _ '`, refused if it could be an address, refused if it has a blocked
  word in it, and only ever put on a page as text. Somebody who types nothing
  gets a made-up name ("Amber Vireo").
- **The message is typed too, and optional**: sixty characters, the same
  plain characters and a little more punctuation, no addresses, the same
  blocked words, text only.
- Both are typed on the home page (by the door) and kept in the browser; the
  book is signed when a visit gets out, unless the box there is unticked.
- **Scores are kept on trust.** The level runs in the visitor's browser, so a
  determined person can be in the book with a score they did not make. The
  site refuses what a building could not allow (rooms and seconds per part,
  hearts, batteries) and counts the points itself, which stops carelessness
  and casual tampering and nothing more.
- **Nothing about who anybody is.** No address of theirs is stored; a salted
  hash of it is kept for seconds or minutes, so that the same visitor is not
  counted twice and cannot sign line after line.

**Striking a line out** (the `id` is in what `/api/book` returns):

```bash
curl -X POST https://YOUR-SITE/api/book -H 'content-type: application/json' -d '{"do":"strike","id":"THE-LINE-ID","key":"YOUR-BOOK-ADMIN-KEY"}'
```

`test/blockrooms-book.test.mjs` covers the rules and the keeping of it
against a store that is only a Map.

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
- **The function, with a store behind it.** The whole site has deployed from
  `blockrooms-live` with this `vercel.json`: the home page, `/play`, and the
  function at `/api/book`, which answers 503 `no-store` as it should while
  the project has no Redis. What it does once it has one has only been run
  against the stand-in.
- **The book against a real store.** Its tests run against a stand-in; the
  REST calls follow Upstash's documentation and have not been run against a
  live database from here.
- **Signing, against a real store.** A whole visit of three parts, out by the
  wall and into the book with a typed name and message, has been played end
  to end on the built site, with `serve.mjs` keeping the book. Not yet with
  the real function and the real store behind it.
