// BlockRooms — a D1 binding keeps the book. Each public operation is one
// transactional batch: a refused guard cannot increment a counter or leave
// half an entry behind. Only bound values cross into SQL; no client library.
import { KEEP, AGAIN } from '../book-policy.mjs';

const COUNTERS = 'SELECT hits, entered AS "in", escaped AS "out" FROM br_counters WHERE id = 1';
const OWN_SIGN = "EXISTS (SELECT 1 FROM br_guards WHERE kind = 'sign' AND hash = ? AND token = ?)";
const OWN_SAME = "EXISTS (SELECT 1 FROM br_guards WHERE kind = 'same' AND hash = ? AND token = ?)";
const OWN_BOTH = `${OWN_SIGN} AND ${OWN_SAME}`;
const counterOf = row => ({ hits: Number(row?.hits) || 0, in: Number(row?.in) || 0, out: Number(row?.out) || 0 });

/**
 * @param {object} db Cloudflare D1 binding (prepare / batch).
 * @param {{now?: () => number, token?: () => string}} [options] Clock is Unix milliseconds; token is unique per operation.
 */
export function createD1Store(db, { now = () => Date.now(), token = () => globalThis.crypto.randomUUID() } = {}) {
  if (!db?.prepare || !db?.batch) throw new TypeError('the book needs a D1 binding');
  const q = (sql, ...values) => db.prepare(sql).bind(...values);
  const hash = value => {
    if (typeof value !== 'string' || !value.length || value.length > 128) throw new TypeError('the book needs a bounded hash');
    return value;
  };
  const clock = () => {
    const at = now();
    if (!Number.isSafeInteger(at) || at < 0) throw new TypeError('the book needs a millisecond clock');
    return at;
  };
  async function batch(statements) {
    const results = await db.batch(statements);
    if (!Array.isArray(results) || results.length !== statements.length || results.some(r => !r || r.success === false || !Array.isArray(r.results))) {
      throw new Error('the book database did not finish its batch');
    }
    return results.map(r => r.results);
  }
  // Bounded, indexed tidying on writes. Expired guards also yield to an
  // upsert even if there are more than this many awaiting physical deletion.
  const tidy = at => q(`DELETE FROM br_guards WHERE (kind, hash) IN (
    SELECT kind, hash FROM br_guards WHERE expires <= ? ORDER BY expires LIMIT 256
  )`, at);
  const claim = (kind, who, at, mine) => q(`INSERT INTO br_guards (kind, hash, expires, token) VALUES (?, ?, ?, ?)
    ON CONFLICT (kind, hash) DO UPDATE SET expires = excluded.expires, token = excluded.token
    WHERE br_guards.expires <= ? RETURNING token`, kind, who, at + AGAIN[kind] * 1000, mine, at);

  return {
    async read() {
      const [counter, top, latest] = await batch([
        q(COUNTERS),
        q('SELECT line FROM br_entries WHERE top = 1 ORDER BY score DESC, line DESC LIMIT ?', KEEP.showTop),
        q('SELECT line FROM br_entries WHERE latest = 1 ORDER BY seq DESC LIMIT ?', KEEP.showLatest),
      ]);
      return { counter: counterOf(counter[0]), top: top.map(r => JSON.parse(r.line)), latest: latest.map(r => JSON.parse(r.line)) };
    },
    async count(kind, visitorHash) {
      if (kind !== 'hit' && kind !== 'in') throw new TypeError('unknown book counter');
      const who = hash(visitorHash), at = clock(), mine = token();
      // The only interpolated identifier comes from these two fixed names.
      const column = kind === 'hit' ? 'hits' : 'entered';
      const [, acquired, , counter] = await batch([
        tidy(at), claim(kind, who, at, mine),
        q(`UPDATE br_counters SET ${column} = ${column} + 1 WHERE id = 1
          AND EXISTS (SELECT 1 FROM br_guards WHERE kind = ? AND hash = ? AND token = ?)`, kind, who, mine),
        q(COUNTERS),
      ]);
      return { counted: acquired.length === 1, counter: counterOf(counter[0]) };
    },
    async sign(entry, visitorHash, duplicateHash) {
      const who = hash(visitorHash), same = hash(duplicateHash), at = clock(), mine = token();
      const line = JSON.stringify(entry), own = [who, mine, same, mine];
      const result = await batch([
        tidy(at), claim('sign', who, at, mine),
        q(`INSERT INTO br_guards (kind, hash, expires, token)
          SELECT 'same', ?, ?, ? WHERE ${OWN_SIGN}
          ON CONFLICT (kind, hash) DO UPDATE SET expires = excluded.expires, token = excluded.token
          WHERE br_guards.expires <= ?`, same, at + AGAIN.same * 1000, mine, who, mine, at),
        q(`INSERT INTO br_entries (id, line, score) SELECT ?, ?, ? WHERE ${OWN_BOTH}`, entry.id, line, entry.score, ...own),
        q(`UPDATE br_counters SET escaped = escaped + 1 WHERE id = 1 AND ${OWN_BOTH}`, ...own),
        q(`UPDATE br_entries SET top = 0 WHERE top = 1 AND seq NOT IN (
          SELECT seq FROM br_entries WHERE top = 1 ORDER BY score DESC, line DESC LIMIT ?
        )`, KEEP.top),
        q(`UPDATE br_entries SET latest = 0 WHERE latest = 1 AND seq NOT IN (
          SELECT seq FROM br_entries WHERE latest = 1 ORDER BY seq DESC LIMIT ?
        )`, KEEP.latest),
        q('DELETE FROM br_entries WHERE top = 0 AND latest = 0'),
        q(`SELECT CASE WHEN NOT (${OWN_SIGN}) THEN 'slow' WHEN NOT (${OWN_SAME}) THEN 'signed' ELSE 'ok' END AS status`, ...own),
        q(`SELECT place FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC, line DESC) AS place FROM br_entries WHERE top = 1
        ) WHERE id = ?`, entry.id),
      ]);
      const status = result[8][0]?.status;
      if (status === 'slow' || status === 'signed') return { ok: false, why: status };
      if (status !== 'ok') throw new Error('the book database did not return a signing result');
      return { ok: true, place: result[9][0]?.place ?? null };
    },
    async strike(id) {
      const [removed] = await batch([q('DELETE FROM br_entries WHERE id = ? RETURNING id', id)]);
      return removed.length;
    },
  };
}
