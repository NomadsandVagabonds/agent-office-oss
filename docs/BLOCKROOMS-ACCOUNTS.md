# BlockRooms optional accounts — review sprint

Branch: `codex/blockrooms-cloud-saves`, from Fable's `c9c3eab` on
`claude/determined-maxwell-ayvlut`. Nothing has been installed in a hosted
Supabase project or deployed to Vercel by this change.

## What the player gets

- Play still starts without an account. Guests do not create Supabase users,
  load its SDK, or wait for an auth request.
- The homepage, pause menu and score page link to **Visitor files** (`/archive`).
  The pause-menu link opens a new tab so OAuth cannot destroy a live visit.
- Google OAuth (PKCE) or a six-digit email code; no game passwords.
- Room/creature discoveries, personal best, visit/escape counts and the latest
  twelve escaped tapes sync. Tape seed, edition and mascot settings survive.
- Character editing uses `core/look.mjs` and the real `Avatar` rig. Species,
  clothing, hair, built-in accessories and colours save locally and sync. The
  selected appearance is passed through `office.walk.me` on the next visit.
- Every completed visit saves locally first. Cloud errors leave local play
  and saves usable; Sync now, returning to the tab, reconnecting, or the next
  change retries. The page says when browser storage itself is unavailable.
- Signing out selects a separate guest file. Cached accounts stay separate.
  A visit already running belongs to the identity it started under (including
  a guest file subsequently claimed by an account).

The visual pass uses the existing homepage's wallpaper, pixel logo/art,
system fonts, raised grey controls, blue title bars and compact tape rows.
The first draft's marketing taglines and large editorial heading are gone.

## Merge and storage

`core/archive.mjs` is pure and shared with tests. `archive-storage.js` owns
local namespaces, one-time import and cross-tab Web Locks. `archive-cloud.js`
retries compare-and-swap conflicts. `archive-client.js` owns SDK sessions and
background sync; each sync pins its access token to prevent an account switch
mid-request from uploading one person's document as another person.

The legacy `office-backrooms:record` and `blockrooms:me` are imported once into
the initial guest file, then left as a backup. Nickname and a stored `look` or
`character`, if present, are imported too. Previously generated appearances
still derive from the nickname with the existing crown default.

Discovery IDs are unioned, first-seen dates take the earliest, best score takes
the maximum, tapes deduplicate by seed + edition, and new visit counters merge
by a per-device writer. Retries cannot count the same visit twice. Nickname
and character changes carry edit timestamps and a deterministic tie-break;
uploading an unchanged old device does not overwrite a newer edit.

Old aggregate visit/escape counts have no visit IDs. On import from multiple
browsers they take the **maximum, not the sum**, because we cannot distinguish
copied saves from distinct visits. Distinct new visits after this change add
across devices. Concurrent replay counts take the maximum (conservative),
while discoveries from both replays are retained.

`blockrooms_profiles` is private. RLS permits only the authenticated owner to
read a row. Writes go through `blockrooms_save_profile`, which gets the owner
from `auth.uid()` (never from an argument), locks the row and checks its
revision. Anonymous requests and direct client table writes are denied. A save
is bounded at 256 KiB. No browser has a service-role key.

These are personal records, not trusted competitive scores. Imported records
are never submitted to the public leaderboard. Cloudflare's score/guestbook
store and the existing escape-only signing rule are unchanged.

## Local review

Requires Node, Docker and Supabase CLI. The supplied config uses a separate
local project and ports 56321–56329, not the other local Supabase projects.
Local CLI services bind Docker ports to the host; use a trusted development
machine/network and stop them when finished. Do not put production data here.

```sh
supabase start --exclude realtime,storage-api,imgproxy,studio,postgres-meta,edge-runtime,logflare,vector,supavisor
node tools/blockrooms/test-accounts.mjs
```

The integration check creates disposable `.invalid` users and sends email only
to **local Mailpit**, then removes those test users. It refuses non-loopback
API/mail addresses. It tests actual OTP verification, concurrent writes,
character sync, RLS isolation, anonymous/write rejection, payload size,
identity pinning, Google PKCE URL generation and sign-out.

To build a local account preview, take only `API_URL` and `PUBLISHABLE_KEY`
from `supabase status --output json` into these variables:

```sh
BLOCKROOMS_LOCAL_ACCOUNTS=1 \
BLOCKROOMS_SUPABASE_URL=http://127.0.0.1:56321 \
BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY='<local publishable key>' \
node tools/blockrooms/build.mjs dist
node tools/blockrooms/serve.mjs dist 44341
```

Open `http://127.0.0.1:44341/archive`. Codes appear in Mailpit at
`http://127.0.0.1:56324` rather than an inbox. Google needs a configured OAuth
provider and is not enabled in the local project. A build with no account
environment variables remains fully playable with local saves/editor.

## Hosted setup still required

1. Choose a dedicated Supabase project and apply
   `supabase/migrations/202611150001_archive.sql`. No existing unrelated app's
   database was used for this prototype.
2. Auth: site URL is the canonical BlockRooms origin; allow that origin's
   `/archive` redirect explicitly. Add each approved preview origin separately.
   Keep anonymous sign-ins disabled.
3. Google: create/configure a web OAuth client; its callback is the Supabase
   project's `/auth/v1/callback`. Put the client ID/secret in Supabase's Google
   provider settings, not this site. Complete the provider's publication flow
   so sign-in is available beyond Google test users.
4. Email: enable email confirmation, six-digit OTPs, ten-minute expiry and a
   60-second resend interval. Set **both Confirm signup and Magic link**
   templates to `supabase/templates/code.html` (`{{ .Token }}`). Configure
   production SMTP; Supabase's default sender is restricted to team addresses
   and is unsuitable for public players. Test a new user and a returning user.
5. Set Vercel build variables `BLOCKROOMS_SUPABASE_URL` and
   `BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY` for the intended environment, then
   redeploy. Do not set `BLOCKROOMS_LOCAL_ACCOUNTS` in production. Public config
   is generated at build time; changing variables needs a new build. The build
   rejects partial settings, service-role/secret keys, and non-HTTPS origins
   except explicitly enabled loopback review builds.
6. Confirm Google callback, email delivery, refresh after reload, a second
   device, sign-out, and instant guest play on the hosted preview before release.

Official setup references:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/database/postgres/row-level-security

Supabase handles verified same-email identity linking. We do not link accounts
by trusting email text in the browser or request access to Google contacts,
Drive, calendars or any other Google data.

## Status on the live site (18 Nov)

The live build reports `{"enabled":false}` at `/account-config.json`: none of the hosted setup above has been done,
so the archive page shows saves on this computer only and no sign-in. Nothing in the code is missing for sign-in to
work; what is missing is the setup above, in this order, by whoever holds the accounts (the owner, or Codex with the
owner):

1. A Supabase project for BlockRooms; apply both migrations in `supabase/migrations/` in name order.
2. Auth URL settings: the site's own origin as the site URL, and its `/archive` as an allowed redirect.
3. A Google Cloud OAuth client (type: web application). Authorised redirect URI: the Supabase project's
   `https://<project>.supabase.co/auth/v1/callback`. Paste its client ID and secret into Supabase → Authentication →
   Providers → Google. Publish the Google consent screen (out of "testing"), or only listed test users can sign in.
4. Email codes: production SMTP in Supabase, and the code template, as in step 4 above.
5. Vercel: set `BLOCKROOMS_SUPABASE_URL` and `BLOCKROOMS_SUPABASE_PUBLISHABLE_KEY` (the publishable key, never the
   secret or service-role key; the build refuses one) for Production, then redeploy.
6. Check: `/account-config.json` reads `"enabled":true`; sign in with Google on a phone and a computer; finish a
   visit; see the file on the other device.

## Who has signed up

`supabase/migrations/202611180001_signups.sql` adds two views for the owner, in a schema the web API does not serve
and that no browser key can read:

- `owner.signups`: one row per account: email, how they signed in (Google or email code), when they signed up, when
  they last signed in, and whether and when they have saved a visit.
- `owner.signups_by_day`: per day, how many signed up, with Google, with an email code, and how many have saved.

Read them in the Supabase dashboard's SQL editor (`select * from owner.signups_by_day;`). Supabase's own
Authentication → Users page lists the same accounts. These are personal email addresses: they are for knowing how
many people signed up and for support, not for mailing anybody; the sign-in page tells players their email is
private, and a mailing list would need its own opt-in and wording first.

## Review limits / follow-up

This saves the record **at visit completion**, not an active run's world state.
Replays still use the current generator; retaining an edition ID does not
archive old engine versions. Built-in character options sync, not uploaded
Office creations/voxel assets. Audio/accessibility settings stay per device.

There is no new public player directory, presence tracker or marketing email
opt-in. Supabase Auth can show registered users; the private profiles table
has `updated_at`, and the existing anonymous book counters remain. A separate
analytics/presence sprint can answer who is actively playing without coupling
instant play to accounts.

## Verification

- Pure merge, migration, account isolation, in-flight visits, storage denial,
  cross-tab writes, CAS conflicts, build configuration/CSP and asset tests.
- Local Supabase integration with the real official SDK and real email OTPs.
- Browser: character preview/edit/save; email code sign-in; “Archive synced”;
  play → Give Up → score → archive records the visit; sign-out selects an empty
  guest file. Desktop and 390px layout checked after the GeoCities style pass.
- Google OAuth URL/PKCE checked; a real Google login remains a hosted setup test.
- Full suite's console pipe test fails on macOS `/var` vs `/private/var` paths;
  its parent is also counted failed. The usage status-line test fails reading
  `source`. Both reproduce on unchanged `c9c3eab` in a separate worktree.
