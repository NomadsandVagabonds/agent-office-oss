// Vercel keeps the public API and its validation. This is its private,
// fetch-only connection to the book's Cloudflare Worker/D1 store.
/**
 * What is wrong with the two settings, for whoever is connecting the store:
 * the setting is named and its value never is. '' when they will do.
 */
export function remoteTrouble(env = process.env) {
  if (!env.BOOK_STORE_URL) return 'BOOK_STORE_URL is not set';
  let url;
  try { url = new URL(env.BOOK_STORE_URL); } catch { return 'BOOK_STORE_URL is not an address'; }
  if (url.protocol !== 'https:') return 'BOOK_STORE_URL is not an https address';
  if (url.username || url.password || url.search || url.hash) return 'BOOK_STORE_URL has a name, a query or a fragment in it';
  const key = String(env.BOOK_STORE_KEY || '');
  if (!key) return 'BOOK_STORE_KEY is not set';
  if (key.length < 32) return 'BOOK_STORE_KEY is shorter than 32 characters';
  return '';
}

export function remoteStore(env = process.env, fetchImpl = globalThis.fetch) {
  if (remoteTrouble(env)) return null;
  const url = new URL(env.BOOK_STORE_URL), key = String(env.BOOK_STORE_KEY);
  async function call(action, fields = {}) {
    const res = await fetchImpl(url.href, {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...fields }), redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`the book store answered ${res.status}`);
    const body = await res.json();
    if (!body || body.ok !== true || !Object.hasOwn(body, 'result')) throw new Error('the book store answered something else');
    return body.result;
  }
  return {
    read: (difficulty = '') => call('read', difficulty ? { difficulty } : {}),
    count: (kind, visitor) => call('count', { kind, visitor }),
    sign: (entry, visitor, duplicate) => call('sign', { entry, visitor, duplicate }),
    strike: id => call('strike', { id }),
  };
}
