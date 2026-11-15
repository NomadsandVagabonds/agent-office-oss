# The book on the existing Cloudflare account

The site stays on Vercel. Its `/api/book` function still validates names,
messages and runs, recomputes the score, authorizes moderation and caches
public reads. Only its storage calls go to the private `blockrooms-book`
Worker, backed by a dedicated `blockrooms-scores` D1 database. The browser
does not call Cloudflare or receive any storage credentials.

This needs no new provider subscription or application dependency. D1 and
Workers are available on Cloudflare's Free plan, which stops requests at its
limits rather than billing overages. Check the actual account's allowance
before connecting traffic; do not upgrade the account as part of this setup.
See [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Prepare and provision

Use the official Wrangler CLI, signed into the owner's existing Cloudflare
account. The commands below change remote infrastructure: review the
database, Worker and production release with the owner before running them.
The checked-in config deliberately has no live database ID.

From `tools/blockrooms/cloudflare`:

```sh
wrangler d1 create blockrooms-scores
# Copy that database UUID into wrangler.jsonc's database_id.
wrangler d1 migrations apply blockrooms-scores --remote
wrangler secret put BOOK_STORE_KEY
wrangler deploy
```

Use a newly generated random secret (32 bytes or more) for `BOOK_STORE_KEY`;
enter it privately at the prompt. Keep it out of source control, terminal
history, logs and browser code. The Worker only accepts authenticated POSTs
at `/book`, with bounded JSON input and the four known store operations.
No Cloudflare account token is installed on Vercel.

Configure **BlockRooms production only** on Vercel:

| Variable | Value |
|---|---|
| `BOOK_STORE_URL` | the deployed Worker's HTTPS URL ending in `/book` |
| `BOOK_STORE_KEY` | the same private secret |
| `BOOK_SALT` | a separate random secret for visitor hashes |
| `BOOK_ADMIN_KEY` | a separate random moderation secret, if moderation is wanted |
| `BOOK_BLOCKLIST` | optional comma-separated moderation words |

Redeploy the reviewed `blockrooms-live` release after setting these values.
Do not deploy a developer's game worktree merely to activate the store.
Keep the existing production-branch and Ignored Build Step settings.

## What is kept

The database has counters, a bounded set of entries, and expiring guards.
It retains the best 100 entries and latest 100 independently (at most 200
entries altogether). A removed/evicted score does not reappear just because
another score is moderated. Rate limits and the 90-day seed/name duplicate
guard match the existing API. Expired guards are pruned on writes through an
expiry index. Raw visitor IP addresses, cookies and request headers are not
sent to the Worker; only salted hashes and validated entry data are sent.

Each count, signing or moderation action is a D1 transaction (`batch`). A
failed statement rolls back the whole action, including counters and guards.
The old Redis adapter remains available for existing installations; these
transaction guarantees apply to D1.

## Verify and recover

Locally, run the book API, remote-store and D1 tests. The D1 suite executes
the real SQL against SQLite, including guard expiry, simultaneous requests,
retention and injected rollback failures. Before production traffic, verify
the deployed binding and migrations with an empty-book read, an unauthorized
request that must return 401, and a disposable staging submission/retry.
Do not insert fabricated high scores into the public production book.

After deployment, `GET /api/book` should return 200 with `ok: true`, counters
and arrays instead of `503 no-store`. A real completed visit then verifies
the end-to-end score path. The homepage continues to fall back to local
browser records if the store is unavailable or the free allowance is reached.

While the book is still shut, its answer says which of three things it is,
so that nobody has to guess:

| `GET /api/book` answers | What it means |
|---|---|
| 503, `"why": "no-store"`, `"settings": "none"` | no store settings reach that deployment at all: they are not set for Production, or it has not been deployed again since they were |
| 503, `"why": "no-store"`, `"settings": "incomplete"` | some are there and will not do. The function's log names the one that is wrong, once as it starts (`[book] no store: BOOK_STORE_KEY is shorter than 32 characters`) and never repeats what it is set to |
| 502, `"why": "store"` | the settings are accepted and the Worker did not answer as the store should. The log has what it answered (`[book] the book store answered 401` is a key that is not the Worker's) |

To disconnect, remove `BOOK_STORE_URL` and `BOOK_STORE_KEY` from production
and redeploy the current live release. Keep the D1 database for recovery;
deleting it is not necessary. Never repoint the binding at an unrelated
application's database.
