# BlockRooms fair play

The game runs in the visitor's browser, so a determined cheat can change what it does. These checks make a visit
that never happened, or one that broke the building's rules, hard to sign for and easy to spot. For a prize of real
value, add the last step below: a person looks at the winners.

## What is checked when a visit signs the book

1. **A ticket from the start.** When a visit begins, the page sends its building's seed (`POST /api/book { do: 'in',
   seed }`) and gets a ticket back, signed by the server (`tools/blockrooms/visit-ticket.mjs`). Signing must hand it
   back. The server refuses a signing when:
   - there is no ticket, or it was not written by the server, or it is for another building;
   - the visit claims more time than has really passed since it started (20 s of slack);
   - it is over 14 days old;
   - the ticket has been signed with before (one signing per ticket).

   The key is `BOOK_TICKET_KEY` if the host sets one, otherwise it is derived from the book's own secret
   (`BOOK_SALT`, `BOOK_STORE_KEY` or the store token). Nothing new has to be set for it to work.
2. **The route.** The game records where the visitor was once a second of play (`core/trail.mjs`, written by
   `tally.js`). The server rebuilds the same building from the seed and difficulty (the layout depends on nothing else)
   and checks the route against it (`tools/blockrooms/visit-check.mjs`):
   - every part, in order;
   - inside rooms;
   - moving only between rooms that are joined;
   - no faster than anybody moves;
   - each part left by its way out;
   - about one sample per second claimed.

   **A route that does not fit is not refused.** The visit is signed and marked `flag: <reasons>`, because a real
   visit can do odd things (a lift, a fall, a room that moves). The mark is kept with the entry and never shown on the
   site.

## Reading the marks (for whoever judges a prize)

- The book function logs every flagged signing: `[book] signed, and flagged: <id> <reasons>` in the Vercel logs.
- The entry itself carries `check` (`ok` or `flag: …`) and `started` (when its ticket was issued). In the Cloudflare
  book store (D1 `br_entries.line`):

  ```sql
  SELECT json_extract(line, '$.name') AS name, json_extract(line, '$.score') AS score,
         json_extract(line, '$.check') AS check_result, json_extract(line, '$.started') AS started
    FROM br_entries ORDER BY score DESC LIMIT 50;
  ```

  The book's Cloudflare Worker cleans each entry with `core/book.mjs` `cleanEntry`, which now keeps `check` and
  `started`. **The Worker must be redeployed** (`tools/blockrooms/cloudflare/`) before they are stored. Until then,
  the Vercel log is the record.

## What it cannot catch

A visitor who changes the game to be unhurt, or to carry more batteries, walks a route that fits. Hearts and
batteries are still the game's own word. For prizes:
- require a signed-in account (one prize per account);
- shortlist only entries whose `check` is `ok`;
- ask the shortlisted few for a screen recording of the run, or watch their route replayed.

Publish official rules before announcing prizes (eligibility, dates, how winners are chosen and checked, the right
to disqualify), and check them against the law where you are.

## Verification

`node --test test/blockrooms-visit-check.test.mjs`:
- a route walked door to door through a real building passes;
- a straight line through walls, a skipped part and a padded time are flagged;
- forged, foreign, too-fast, too-old and missing tickets are refused;
- a ticket signs once;
- the verdict is never shown.

A sweep of 100 buildings across four difficulties walked door to door gave 100 passes and no false flags. No real
played visit has been checked yet; real visits may show patterns the walker does not, so watch the flags in the first
days.
