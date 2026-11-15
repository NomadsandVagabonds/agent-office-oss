// BlockRooms — where the visitors' book is kept. The site is plain files; the
// book is the one thing that has to be somewhere everybody can reach, so it
// is kept behind a private Cloudflare/D1 service, or an existing Redis REST
// interface, with nothing but fetch (no client library: this repository has no
// dependencies, and this is not the place to start).
//
// The existing-account service takes BOOK_STORE_URL + BOOK_STORE_KEY. A Redis
// installation can instead use either pair below:
//
//   KV_REST_API_URL          KV_REST_API_TOKEN
//   UPSTASH_REDIS_REST_URL   UPSTASH_REDIS_REST_TOKEN
//
// With none of these, there is no store, and the site says so and carries on with
// what each browser keeps for itself.
import { remoteStore } from './book-remote.mjs';

/**
 * @param {object} [env]  where the address and the token are (default: process.env)
 * @param {Function} [fetchImpl]
 * @returns {object | null} A semantic store (read/count/sign/strike), legacy Redis pipeline, or no configured store.
 */
export function createStore(env = process.env, fetchImpl = globalThis.fetch) {
  // Prefer an explicitly configured existing-account store; never silently
  // send its traffic to a different provider when its settings are incomplete.
  if (env.BOOK_STORE_URL || env.BOOK_STORE_KEY) return remoteStore(env, fetchImpl);
  const url = String(env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
  const token = String(env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '');
  if (!/^https:\/\//.test(url) || !token) return null;
  return {
    /** Several commands in one request, in order: [['INCR', 'k'], ['GET', 'k']] → [1, '1']. One that fails, fails the lot. */
    async pipeline(commands) {
      const res = await fetchImpl(`${url}/pipeline`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(commands),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`the store answered ${res.status}`);
      const out = await res.json();
      if (!Array.isArray(out) || out.length !== commands.length) throw new Error('the store answered something else');
      return out.map((r) => { if (r && r.error) throw new Error(`the store refused a command: ${String(r.error).slice(0, 120)}`); return r ? r.result : null; });
    },
  };
}

/**
 * A store that is only a Map: for the tests, and for trying the site on one's own machine. It understands the few
 * commands the book uses (book-api.mjs) the way Redis does, and nothing else.
 */
export function memoryStore(now = () => Date.now()) {
  const data = new Map(), dies = new Map();
  const live = (k) => { if (dies.has(k) && dies.get(k) <= now()) { data.delete(k); dies.delete(k); } return data.get(k); };
  const run = ([cmd, ...a]) => {
    const key = a[0];
    switch (String(cmd).toUpperCase()) {
      case 'INCR': { const n = Number(live(key) || 0) + 1; data.set(key, String(n)); return n; }
      case 'GET': return live(key) ?? null;
      case 'DEL': { let n = 0; for (const k of a) { if (live(k) !== undefined) n++; data.delete(k); dies.delete(k); } return n; }
      case 'MGET': return a.map((k) => live(k) ?? null);
      case 'EXPIRE': if (live(key) === undefined) return 0; dies.set(key, now() + Number(a[1]) * 1000); return 1;
      case 'SET': {
        const opt = a.slice(2).map((s) => String(s).toUpperCase());
        if (opt.includes('NX') && live(key) !== undefined) return null;
        data.set(key, String(a[1])); dies.delete(key);
        const ex = opt.indexOf('EX'); if (ex >= 0) dies.set(key, now() + Number(a[2 + ex + 1]) * 1000);
        return 'OK';
      }
      case 'LPUSH': { const l = live(key) || []; l.unshift(String(a[1])); data.set(key, l); return l.length; }
      case 'LTRIM': { const l = live(key) || []; data.set(key, l.slice(Number(a[1]), Number(a[2]) + 1)); return 'OK'; }
      case 'LRANGE': return (live(key) || []).slice(Number(a[1]), Number(a[2]) + 1);
      case 'ZADD': { const z = live(key) || new Map(); const fresh = !z.has(String(a[2])); z.set(String(a[2]), Number(a[1])); data.set(key, z); return fresh ? 1 : 0; }
      case 'ZREM': { const z = live(key); return z && z.delete(String(a[1])) ? 1 : 0; }
      case 'LREM': { const l = live(key) || [], keep = l.filter((v) => v !== String(a[2])); data.set(key, keep); return l.length - keep.length; }
      case 'ZREVRANGE': { const z = [...(live(key) || new Map())].sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? 1 : -1)); return z.slice(Number(a[1]), Number(a[2]) + 1).map((m) => m[0]); }
      case 'ZREMRANGEBYRANK': {
        const z = live(key); if (!z) return 0;
        const asc = [...z].sort((p, q) => p[1] - q[1] || (p[0] < q[0] ? -1 : 1)), n = asc.length, at = (i) => (i < 0 ? n + i : i);
        const from = Math.max(0, at(Number(a[1]))), to = at(Number(a[2]));
        const gone = to < from ? [] : asc.slice(from, to + 1);
        for (const [m] of gone) z.delete(m);
        return gone.length;
      }
      default: throw new Error(`memoryStore does not know ${cmd}`);
    }
  };
  return { data, async pipeline(commands) { return commands.map(run); } };
}
