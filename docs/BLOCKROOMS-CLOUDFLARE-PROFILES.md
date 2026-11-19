# BlockRooms private profiles

The site is hosted by Vercel. Its same-origin `/api/archive` function talks to the `blockrooms-profiles` Worker, which alone has a binding to the private D1 database of the same name. The public book has a separate service, key and database. An ordinary guest starts playing with local storage and creates no account.

The existing visitor-file editor, guest import, completed visits, discoveries, character and tape replay rules are described in [the archive documentation](BLOCKROOMS-ACCOUNTS.md). No in-progress world is uploaded. Two devices merge their documents using a revision check. An unchanged document needs no database write. Cookies are host-only, HttpOnly, Secure and SameSite=Lax. Each read and save checks the expected player against the session so switching accounts in another tab cannot upload an archive to the wrong person.

## Configuration

Run Wrangler with `-c tools/blockrooms/profiles/wrangler.jsonc`. The configured ENAM D1 binding is dedicated to this game. Apply the versioned migrations with `wrangler d1 migrations apply blockrooms-profiles --remote` and deploy the Worker. Set the following Worker secrets from a private credential store.

| Name | Value |
| --- | --- |
| PROFILE_KEY | A fresh random 32-byte or longer service key shared only with the Vercel function |
| GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET | Credentials for a published Google web client with the exact callback `https://blockrooms.app/api/archive` |
| RESEND_API_KEY and EMAIL_FROM | A Resend sending key and an address at a verified sending domain, e.g. `BlockRooms <archive@blockrooms.app>` |

Google uses authorization code with PKCE and browser-bound state. A Google account registered with a third-party mailbox proves ownership once by entering an email code in the same browser. Future visits can use Google directly. Google and email-code sign-in share the same file for a verified Gmail or Workspace address.

Resend sends a single transactional plain-text message on explicit request. The code is six digits, expires after ten minutes, and allows five attempts. The service enforces a one-minute resend interval, ten requests per address of origin per hour, and a ceiling of 90 attempted deliveries per UTC day across the game. Expired sessions, challenges and rate-limit keys are removed daily. The game stores no raw IP addresses. A dedicated free Resend account allows 100 emails per day and 3,000 per month. If sharing an account, its allowance is shared with every sender.

On the Vercel production project set `BLOCKROOMS_PROFILE_WORKER` (the HTTPS Worker origin), `BLOCKROOMS_PROFILE_KEY` (same shared secret), and `BLOCKROOMS_ACCOUNTS=cloudflare`. Only the provider name and enabled flag go in the public build. Apply by redeploying the BlockRooms site. An unprovisioned sign-in method is hidden. To return the site to guest-only mode, unset `BLOCKROOMS_ACCOUNTS` and redeploy without legacy Supabase settings. All existing saves remain in place.

## Owner reporting

In the Cloudflare dashboard, open D1 → blockrooms-profiles → Console. Use `SELECT * FROM signups_by_day` for daily Google/email registrations and the count that have saved a visit. Use `SELECT * FROM signups ORDER BY signed_up DESC` for email, initial sign-in method, last sign-in and last save. There is no browser route to either report.

## Verification

Run `node --test test/blockrooms-profiles.test.mjs test/blockrooms-archive.test.mjs test/blockrooms-site.test.mjs` with Node 22+. The tests exercise the production proxy and Worker with an isolated SQLite database and local Google/email stand-ins. The live acceptance check needs a consenting player to receive a real email or sign in with Google on two devices.

[Google web sign-in](https://developers.google.com/identity/openid-connect/openid-connect) · [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [Resend plans](https://resend.com/pricing)
