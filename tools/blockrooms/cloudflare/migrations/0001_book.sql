-- BlockRooms' shared book. Times are Unix milliseconds, including guard
-- expiry. Only salted visitor hashes / seed-and-name hashes enter guards.
CREATE TABLE IF NOT EXISTS br_counters (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  hits INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0),
  entered INTEGER NOT NULL DEFAULT 0 CHECK (entered >= 0),
  escaped INTEGER NOT NULL DEFAULT 0 CHECK (escaped >= 0)
) STRICT;
INSERT OR IGNORE INTO br_counters (id) VALUES (1);

-- A line can belong to either or both retained sets. Clearing a flag is
-- permanent: removing a better/newer line never resurrects an evicted one.
CREATE TABLE IF NOT EXISTS br_entries (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  line TEXT NOT NULL CHECK (json_valid(line)),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 1000000),
  top INTEGER NOT NULL DEFAULT 1 CHECK (top IN (0, 1)),
  latest INTEGER NOT NULL DEFAULT 1 CHECK (latest IN (0, 1))
) STRICT;
CREATE INDEX IF NOT EXISTS br_entries_top ON br_entries (score DESC, line DESC) WHERE top = 1;
CREATE INDEX IF NOT EXISTS br_entries_latest ON br_entries (seq DESC) WHERE latest = 1;

-- The token identifies the batch that acquired a guard, so subsequent
-- statements can be conditional without a read/modify/write round trip.
CREATE TABLE IF NOT EXISTS br_guards (
  kind TEXT NOT NULL CHECK (kind IN ('hit', 'in', 'sign', 'same')),
  hash TEXT NOT NULL CHECK (length(hash) BETWEEN 1 AND 128),
  expires INTEGER NOT NULL,
  token TEXT NOT NULL,
  PRIMARY KEY (kind, hash)
) STRICT, WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS br_guards_expiry ON br_guards (expires);
