-- Private D1 binding. No user or reporting tables are served through the public book.
CREATE TABLE players (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  google_sub TEXT UNIQUE,
  signup_method TEXT NOT NULL CHECK (signup_method IN ('google','email')),
  signed_up INTEGER NOT NULL,
  last_sign_in INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  document TEXT NOT NULL DEFAULT '{"v":1}',
  last_save INTEGER
) STRICT;

CREATE TABLE sessions (
  digest TEXT PRIMARY KEY NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_expiry ON sessions(expires);

-- Google accounts using a third-party mailbox prove email ownership once
-- before that address can join an existing visitor file.
CREATE TABLE google_links (
  digest TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT NOT NULL,
  email TEXT NOT NULL,
  expires INTEGER NOT NULL
) STRICT;
CREATE INDEX links_expiry ON google_links(expires);

CREATE TABLE email_challenges (
  email TEXT PRIMARY KEY NOT NULL,
  digest TEXT NOT NULL,
  issued INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX challenges_issued ON email_challenges(issued);

CREATE TABLE send_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires INTEGER NOT NULL
) STRICT;
CREATE INDEX limits_expiry ON send_limits(expires);

CREATE VIEW signups AS
  SELECT email, signup_method, datetime(signed_up,'unixepoch') AS signed_up,
    datetime(last_sign_in,'unixepoch') AS last_sign_in, datetime(last_save,'unixepoch') AS last_save,
    (coalesce(json_extract(document,'$.baseline.runs'),0) > 0 OR
      EXISTS (SELECT 1 FROM json_each(document,'$.counts') WHERE json_extract(value,'$.runs') > 0)) AS saved_visit
  FROM players;
CREATE VIEW signups_by_day AS
  SELECT date(signed_up) AS day, count(*) AS signups, sum(signup_method='google') AS google,
    sum(signup_method='email') AS email, sum(saved_visit) AS saved_a_visit
  FROM signups GROUP BY date(signed_up) ORDER BY day DESC;
