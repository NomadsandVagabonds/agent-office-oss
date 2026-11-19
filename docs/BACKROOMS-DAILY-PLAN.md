# The daily tape: a plan

## What it is

Every day there is one building, the same for everybody who plays. You play against the whole community, not one
friend. You see where you placed, you can race the ghosts of the best runs, and tomorrow there is a new one. Ghost
runs against one friend stay possible inside it.

It is the owner's pick from [BACKROOMS-MODES-ROADMAP.md](BACKROOMS-MODES-ROADMAP.md): the race, played
asynchronously.

**Status:** a plan. Nothing here is built. The decisions marked **(owner)** are open.

## Why it suits this game

- **The seed:** the same seed is the same building, to the room. A daily is just a seed everybody gets.
- **The tape:** a run already is a tape, with a seed, a time and a route. A daily turns that tape into
  something you compare and share.
- **The cast:** readable rules make a known building learnable without making it solved. The creatures
  decide what to do at run time (`Math.random` for runtime only), so the same building plays a little
  differently each time. Knowledge helps; luck still bites.
- **Few players:** it works with few players. Nobody waits for a match, and a board with twenty names on it is
  still a board.

## What already exists (the plan builds on these, it does not replace them)

| Need | Already there |
|---|---|
| One building from one seed | `plan.js` / `gen.js` (`planVisit`, `floorOf`); `?tape=SEED` plays a given seed |
| Which make of the building | `edition()` in `plan.js` changes when the generator or the cast changes |
| A score | `core/runs.mjs` `scoreRun`. It rewards getting out and finishing under par (`POINTS.par`, `pace`, up to `paceMost`) |
| A public board | the visitors' book: `/api/book` (`tools/blockrooms/book-api.mjs`). It keeps the best hundred, the latest hundred, and a board per difficulty, in Cloudflare D1 (`cloudflare/`) or the KV-style store |
| Proof a run started when it says | `visit-ticket.mjs`: a signed ticket from `do: 'in'` |
| Proof the route fits the building | `core/trail.mjs` (a sample a second) and `visit-check.mjs`. The route is checked at signing, **but not kept** |
| Who you are | optional sign-in and cloud saves (`archive-*`, recent), plus the book's name. No address is ever stored |

## What it needs

### 1. Today's seed

- **Where it is made:** on the server, from the date in UTC and a secret: `HMAC(secret, 'daily|2026-11-20')`,
  cut to the seed alphabet. It is handed out with the ticket (`do: 'in', daily: true`).
- **Why a secret:** tomorrow's building cannot be worked out today, so nobody can scout it ahead.
- **The number:** each daily has one, `Daily №1, №2 …`, counted from launch day.
- **The difficulty:** fixed for the day. **(owner)** Always `normal`, or a weekly rhythm (for example, a hard
  Sunday)?
- **The edition:** the day's building is pinned to the edition live when the day began, and the ticket carries
  it.
  - A deploy that changes the edition mid-day makes a different building from the same seed. Either such deploys
    wait for UTC midnight, or the day's board is split by edition.
  - Recommendation: land edition-changing merges just after midnight UTC. The board shows the edition, and a
    run on a different edition is refused for that day with a plain message.

### 2. One take, or best of many **(owner)**

- **One ranked take a day** (recommended):
  - Your first run of the day is the one that counts. After it you may play the day again as often as you like,
    unranked, with the ghosts.
  - It keeps the board honest (no grinding the seed until the creatures happen to go easy) and makes the day an
    event.
  - It needs identity to hold: a signed-in account, or else a per-browser token. That is soft, and fine for a
    game.
- **Best of the day:** more play, but the board rewards time spent over skill, and the building is learned
  by the third try.

### 3. Today's board

- **The book:** a board per day, `br:daily:<date>`, or the D1 equivalent: a `daily` column on `br_entries`
  with an index on `(daily, score)`.
- **Ranking:** by `scoreRun`, as now. The daily needs no new scoring. Getting out and par already reward a
  quick, clean run.
  - **(owner)** Should time count for more on the daily? A daily weight on `pace` is one line in
    `core/runs.mjs`.
- **What you see after your take:**
  - your place and your percentile ("better than 63% of today's");
  - today's top ten;
  - the runs either side of yours;
  - yesterday's winner.
- **Kept:** every day's top hundred. Older days are summed, not deleted.
- **Runs that do not get out:** today the book only signs runs that get out, but most runs don't. The daily
  board should take every take, so that "caught on the second floor" still places you (below everyone who got
  out). That is the one real rule change to the book.

### 4. Ghosts

**Keep the route:**
- A signing already carries the trail (≤ 3,700 samples, ≤ 65 KB, usually far less).
- Keep it for:
  - the day's top twenty;
  - your own best;
  - the runs either side of yours (asked for by id: `GET /api/book/trail?id=`).
- It is under a few MB a day at most. Older days keep only the top three's.

**Draw it:**
- A ghost is the trail played back on the clock: one sample a second, smoothed between samples. Each part of
  the building is entered when the trail says.
- It is drawn as a figure doubled and smeared in the picture. On a VHS tape that is exactly what "ghosting"
  is, so the artifact is the look, and ours.
- It touches nothing:
  - no collider;
  - no creature sees, hears or chases it;
  - it takes nothing, opens nothing, and sets nothing off.
- **(owner)** Does it carry a name tag on screen, or only on the board? The picture's rule is that nothing is
  written on it but `E`.

**Which ghosts:**
- Up to three at once:
  - the day's leader;
  - the run just above yours;
  - your own best.
- A friend's ghost can be picked by name.
- During the ranked take, no ghosts. They would show the way (spoilers). Ghosts are for after the take, or for
  anybody playing a past day.

### 5. Coming back (what makes it a habit)

- **Share card:** after the take, a short text with no spoilers to paste anywhere:

  ```
  BlockRooms Daily №37 · out in 7:42 · 3 floors · 2 ♥ left · 82nd percentile
  ▮▮▮▯ ▮▮▯▯ ▮▮▮▮  (rooms explored a floor)
  ```

  No seed in it (the seed would hand the building to people who have not played). A link opens the daily.
- **Streaks:** days in a row with a take. Getting out days in a row is a second, harder streak. These are
  kept with the account, or in the browser without one.
- **A past day:** any past daily is playable, unranked, against that day's ghosts. A new player has a
  back catalogue from day one.
- **Firsts:**
  - the first in the community to meet a creature on the day it lands;
  - the first out of a daily under five minutes.
  - These are kept on the board as a mark, not a prize.
- **Seasons:** a new edition can open a new season of dailies, with a season board summed over its days.

### 6. Cheating, honestly

The level runs in the player's browser, so a determined cheat can lie about almost anything. The book already
says so (`core/book.mjs`).

**What exists:**
- the ticket (a run cannot claim less time than passed);
- the route check (no walking through walls, no impossible speeds, the parts in order, out at the way out).

**The daily adds:**
- one ranked take per account or browser;
- the seed known only on the day;
- a flag, not a refusal, for routes that look wrong, so a person can judge the top of the board.

It is enough for a game nobody wins money from. If a prize is ever attached, the flagged runs are reviewed by
hand, as the book already allows.

### 7. The daily as a proving ground

The owner: *"use daily games to test new or experimental rooms, items and entities."*

Why the daily is the right place for it:
- **Everybody meets the same thing on the same day.** What one player found unfair, a thousand others met
  too.
- **One floor, one day.** A new creature or room is first tried by many people at once, for one day, in a
  building nobody has seen. Nobody's ordinary visit or record is touched by it.

How it would work:
- **What is on trial is part of the day.** A day can carry a short list of experiments with its seed:
  - a room from the deck that is not dealt yet;
  - a creature not yet in the ordinary cast;
  - an item at a different rate;
  - a tuning (a number in a rule).

  The list is published with the day, and it is fixed for the whole day.
- **Built by both sides alike.** The list goes to the building the same way a difficulty does: an option
  of `planVisit` (which already takes `themes` and `difficulty`). The book's route check then builds the
  same building from the same seed and list, so that `visit-check.mjs` and the player agree.
- **Its own edition.** A day with experiments is a different make of building from the same seed. The day's
  ticket carries the list, and the edition is worked out with it, so an experimental day never mixes with
  an ordinary one.
- **Said on the board, but not what it is.** A day with something new on it is marked as such, a mark only
  ("something here is new"). It keeps the surprise and warns that the day may be rougher than most. Records
  made on it are kept like any day's.

What is learned, counted for the whole day and never about anybody:
- per experiment:
  - how many met it;
  - how many got away from it;
  - how many it caught, and on which floor;
- for a room: how long people spent in it;
- for an item: how often it was picked up and used.

These are counts the run already reports (`run.met`, `run.survived`, `caught`, rooms explored), summed by
the day. No address, no route of a single person beyond what the book already keeps.

A one-tap question after the take, optional and about the new thing only: *"that was: fair / unfair /
dull / great"*.

What happens next:
- **Promoted:** it joins the ordinary game.
- **Tuned:** it is tried again on a later day with the numbers changed.
- **Retired:** it goes back in the drawer. A day it was on stays playable as it was, since that day's
  edition is that day's.

How often: **(owner)** One experimental day a week (a "pilot Friday"), or a small experiment on most
days?

## Order of work

| Step | What | Where | Size |
|---|---|---|---|
| 1 | Today's seed and number from the server; `?daily` on the play page; edition pinned on the ticket | book API, play page | small |
| 2 | The daily board: every take signed, one ranked take, place and percentile on the scorecard | book API, D1 migration, `scorecard.js` | medium |
| 3 | The front page: today's tape, yesterday's winner, your streak | `home.js` | small |
| 4 | Share card | `scorecard.js` | small |
| 5 | Trails kept for the top and for you; `GET` a trail | book API, D1 | small |
| 6 | Ghosts: playback, drawn as tape ghosting, untouchable | a new `ghost.js` in the level, read through `env` | medium |
| 7 | Past days, seasons, firsts | book API, home | medium |
| 8 | Experiments: a day's list as a `planVisit` option, built the same by the route check; edition with it; counts summed by day; the one-tap question | plan.js (lead), book API, scorecard | medium |

- **Steps 1–4** are a complete daily without ghosts, and could ship on their own.
- **Steps 5–6** are what makes it a race.

**Who:**
- the book and the site are the site's owner's;
- the scorecard, the play page and the ghost in the level are for the lead to deal;
- the cast (this session) can take the ghost's figure and its look, and a creature-side guarantee: one test
  that no creature senses a ghost.

## Decisions for the owner

1. Difficulty: always `normal`, or a weekly rhythm?
2. One ranked take a day (recommended), or best of the day?
3. Should time weigh more on the daily than in an ordinary visit?
4. Ghosts: a name on screen, or only on the board?
5. Does the camcorder battery stay as the clock on the daily? (Recommended: yes. It is the game; the daily
   should be the game.)
6. Reset at midnight UTC for everybody, or local midnight? (Recommended: UTC. One building at a time for
   everyone is the point.)
7. Experiments: one pilot day a week, or a small one on most days? And may an experimental day's results
   count toward a season board?
